/**
 * FOUNDER LIFETIME OFFER — one-time purchase, lifetime access (Model A)
 *
 * The public site has advertised this offer for a while — "$99 for the first 25,
 * $199 for the next 25, first 50 keep lifetime access" — but nothing was ever
 * built behind it. There was no founder plan, no Stripe price, and the CTA
 * dead-ended on "Invalid plan for checkout".
 *
 * This module owns the whole flow:
 *   - tier pricing: first 25 at $99, next 25 at $199, then sold out at 50
 *   - a one-time Stripe checkout (mode: 'payment', NOT 'subscription')
 *   - a claim record, and lifetime Passport access granted on webhook confirm
 *
 * WHY NOT A PLAN ROW
 * Founders are not a subscription. There is no recurring price, nothing to renew,
 * nothing to cancel. Modelling them as a row in subscription_plans would push them
 * through code paths that assume a Stripe subscription object exists — renewal
 * sync, invoice.paid, grace periods, dunning — none of which apply. A claim record
 * plus a lifetime flag on user_subscriptions keeps the entitlement checks happy
 * without lying to the billing system.
 */

import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import { getDb } from '@/lib/mongodb';
import { passportOrigin } from '@/lib/checkout-origin';
import {
  FOUNDER_LIMIT,
  FIRST_TIER_CAP,
  FIRST_TIER_PRICE,
  NEXT_TIER_PRICE,
  tierForClaim,
  priceForTier,
} from '@/lib/founder-tiers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export {
  FOUNDER_LIMIT,
  FIRST_TIER_CAP,
  FIRST_TIER_PRICE,
  NEXT_TIER_PRICE,
  tierForClaim,
  priceForTier,
};

const CLAIMS = 'founder_claims';
const CONFIG = 'founder_config';

async function col(name) {
  const db = await getDb();
  return db.collection(name);
}

/** Public state of the offer — drives the pricing page and the CTA. */
export async function getFounderStatus() {
  const claims = await col(CLAIMS);
  const claimed = await claims.countDocuments({});
  const tier = tierForClaim(claimed);

  return {
    claimed,
    limit: FOUNDER_LIMIT,
    remaining: Math.max(0, FOUNDER_LIMIT - claimed),
    first_tier_remaining: Math.max(0, FIRST_TIER_CAP - claimed),
    current_tier: tier,
    current_price: priceForTier(tier),
    sold_out: tier === null,
  };
}

/**
 * Create the Stripe product and one-time prices once, then reuse them.
 * Prices are immutable in Stripe, so a price change means a NEW price object —
 * which is why these are cached by id rather than recomputed each time.
 */
async function ensureFounderPrices() {
  const cfg = await col(CONFIG);
  const existing = await cfg.findOne({ id: 'offer' });
  const doc = existing || { id: 'offer' };

  if (doc.price_first_25 && doc.price_next_25) return doc;

  const patch = { updated_at: new Date() };

  let productId = doc.stripe_product_id;
  if (!productId) {
    const product = await stripe.products.create({
      name: 'SoulPrint Passport — Founder Lifetime',
      description: 'One-time payment for lifetime Passport access. No subscription.',
      metadata: { type: 'founder_lifetime' },
    });
    productId = product.id;
    patch.stripe_product_id = productId;
  }

  if (!doc.price_first_25) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: FIRST_TIER_PRICE * 100,
      currency: 'usd',
      metadata: { tier: 'first_25' },
    });
    patch.price_first_25 = price.id;
  }

  if (!doc.price_next_25) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: NEXT_TIER_PRICE * 100,
      currency: 'usd',
      metadata: { tier: 'next_25' },
    });
    patch.price_next_25 = price.id;
  }

  await cfg.updateOne(
    { id: 'offer' },
    { $set: patch, $setOnInsert: { created_at: new Date() } },
    { upsert: true }
  );

  return { ...doc, ...patch };
}

/**
 * Start a one-time founder checkout.
 *
 * The tier is resolved at session creation, so the buyer is charged the price
 * that was live when they clicked. If two people race for the last $99 slot they
 * both pay $99 — the alternative (deciding the price at webhook time) would mean
 * charging a card an amount the buyer never agreed to, which is worse. The hard
 * cap at 50 is still enforced on claim.
 */
export async function createFounderCheckout(userId) {
  const status = await getFounderStatus();
  if (status.sold_out) {
    return { error: 'The founder offer has closed — all 50 spots are claimed.' };
  }

  const claims = await col(CLAIMS);
  if (await claims.findOne({ user_id: userId })) {
    return { error: 'You already claimed a founder spot.' };
  }

  const tier = status.current_tier;
  const price = status.current_price;

  const cfg = await ensureFounderPrices();
  const priceId = tier === 'first_25' ? cfg.price_first_25 : cfg.price_next_25;
  if (!priceId) {
    return { error: 'Founder pricing is not configured in Stripe.' };
  }

  // Reuse the customer if this account has one, so the receipt and the account
  // are linked the same way subscription purchases are.
  const subCol = await col('user_subscriptions');
  const sub = await subCol.findOne({ user_id: userId });
  let customerId = sub?.stripe_customer_id || null;

  if (!customerId) {
    const usersCol = await col('users');
    const user =
      (await usersCol.findOne({ id: userId })) ||
      (await usersCol.findOne({ user_id: userId })) ||
      (await usersCol.findOne({ _id: userId }));
    const customer = await stripe.customers.create({
      email: user?.email,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    await subCol.updateOne(
      { user_id: userId },
      {
        $set: { stripe_customer_id: customerId, updated_at: new Date() },
        $setOnInsert: { id: uuidv4(), user_id: userId, created_at: new Date() },
      },
      { upsert: true }
    );
  }

  const origin = passportOrigin();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/thank-you?plan=founder&price=${price}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?checkout=canceled`,
    metadata: {
      user_id: userId,
      type: 'founder',
      tier,
      price: String(price),
    },
    payment_intent_data: {
      metadata: { user_id: userId, type: 'founder', tier },
    },
  });

  // Mirror the subscription flow: a pending transaction row, flipped to paid by
  // the webhook. processSuccessfulPayment() routes on txn.type.
  await (await col('payment_transactions')).insertOne({
    id: uuidv4(),
    session_id: session.id,
    user_id: userId,
    type: 'founder',
    plan_id: 'passport',
    tier,
    amount: price,
    currency: 'usd',
    status: 'pending',
    processed: false,
    created_at: new Date(),
  });

  return { url: session.url, session_id: session.id, tier, price };
}

/**
 * Grant lifetime access. Called from the Stripe webhook once payment completes.
 *
 * Idempotent by both user and session: Stripe retries webhooks, and a double
 * grant would consume two of the fifty spots.
 */
export async function grantFounderAccess({ userId, tier, price, sessionId }) {
  const claims = await col(CLAIMS);

  const byUser = await claims.findOne({ user_id: userId });
  if (byUser) return { already_claimed: true, claim: byUser };

  if (sessionId) {
    const bySession = await claims.findOne({ session_id: sessionId });
    if (bySession) return { already_claimed: true, claim: bySession };
  }

  const claimed = await claims.countDocuments({});
  const claim = {
    id: uuidv4(),
    user_id: userId,
    tier: tier || tierForClaim(claimed),
    price: Number(price) || priceForTier(tier),
    session_id: sessionId || null,
    claim_number: claimed + 1,
    claimed_at: new Date(),
  };
  await claims.insertOne(claim);

  // Lifetime entitlement. status:'active' satisfies every existing entitlement
  // check; lifetime:true marks it so nothing later treats the absence of a Stripe
  // subscription as a lapsed one and downgrades it.
  await (await col('user_subscriptions')).updateOne(
    { user_id: userId },
    {
      $set: {
        plan_id: 'passport',
        status: 'active',
        lifetime: true,
        founder: true,
        founder_tier: claim.tier,
        founder_price: claim.price,
        founder_claim_number: claim.claim_number,
        founder_claimed_at: new Date(),
        lifetime_since: new Date(),
        updated_at: new Date(),
      },
      $setOnInsert: { id: uuidv4(), user_id: userId, created_at: new Date() },
    },
    { upsert: true }
  );

  console.log(
    `[Founder] Granted lifetime Passport to ${userId} — claim #${claim.claim_number} (${claim.tier} at $${claim.price})`
  );

  return { granted: true, claim };
}
