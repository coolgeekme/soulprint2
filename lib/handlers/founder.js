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
import crypto from 'crypto';
import Stripe from 'stripe';
import { getDb } from '@/lib/mongodb';
import { passportOrigin, DEFAULT_CANONICAL_ORIGIN } from '@/lib/checkout-origin';
import { hashPassword } from '@/lib/auth';
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
export async function createFounderCheckout(userOrOptions) {
  // Accept either a bare userId (the /api/pricing/checkout path) or an options
  // object (the public guest path). A null userId means guest checkout: Stripe
  // collects the email and we attribute the purchase from it.
  const opts = (userOrOptions && typeof userOrOptions === 'object')
    ? userOrOptions
    : { userId: userOrOptions };
  const userId = opts.userId || null;

  const status = await getFounderStatus();
  if (status.sold_out) {
    return { error: 'The founder offer has closed — all 50 spots are claimed.' };
  }

  if (userId) {
    const claims = await col(CLAIMS);
    if (await claims.findOne({ user_id: userId })) {
      return { error: 'You already claimed a founder spot.' };
    }
  }

  const tier = status.current_tier;
  const price = status.current_price;

  const cfg = await ensureFounderPrices();
  const priceId = tier === 'first_25' ? cfg.price_first_25 : cfg.price_next_25;
  if (!priceId) {
    return { error: 'Founder pricing is not configured in Stripe.' };
  }

  // Signed-in buyers reuse their existing Stripe customer. Guests let Checkout
  // create one from the email they type, so the purchase is still attributable.
  let customerId = null;
  if (userId) {
    const subCol = await col('user_subscriptions');
    const sub = await subCol.findOne({ user_id: userId });
    customerId = sub?.stripe_customer_id || null;

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
  }

  const origin = passportOrigin();
  const meta = {
    type: 'founder',
    tier,
    price: String(price),
    ...(userId ? { user_id: userId } : {}),
  };

  const sessionParams = {
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/thank-you?plan=founder&price=${price}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?checkout=canceled`,
    metadata: meta,
    payment_intent_data: { metadata: meta },
  };
  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    // Guest checkout — Checkout creates the customer from the email they enter,
    // and checkout.session.completed carries it back as customer_details.email.
    sessionParams.customer_creation = 'always';
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

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

/**
 * Attribute a completed founder payment to a person and give them lifetime access.
 *
 * Guest checkout means the payment carries an EMAIL, not a user id. So:
 *   - account already exists  → grant immediately, email "you're in"
 *   - no account yet          → park the purchase against that email and send a
 *                               signed claim link; the account is created when they
 *                               set a password
 *
 * We deliberately do NOT create a password-less account here. If someone buys and
 * never claims, an abandoned account with no way to sign in is worse than a park
 * record — and the park record still holds their money's worth against the email
 * that paid.
 */
export async function resolveFounderBuyer({ email, sessionId, tier, price }) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) {
    console.error(`[Founder] Paid session ${sessionId} carried no email — cannot attribute`);
    return { error: 'no_email' };
  }

  const usersCol = await col('users');
  const user =
    (await usersCol.findOne({ email: normalized })) ||
    (await usersCol.findOne({ email: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }));

  if (user) {
    const result = await grantFounderAccess({
      userId: user.id || user.user_id,
      tier,
      price,
      sessionId,
    });
    try {
      const { sendEmail } = await import('@/lib/email');
      const origin = DEFAULT_CANONICAL_ORIGIN;
      await sendEmail({
        to: normalized,
        subject: "You're a SoulPrint founder",
        html: founderConfirmEmailHtml({ tier, price, origin, hasAccount: true }),
      });
    } catch (e) {
      console.error('[Founder] Confirm email failed:', e.message);
    }
    return { ...result, existing_account: true, email: normalized };
  }

  // No account yet — park the purchase against the paying email.
  const pending = await col('founder_pending');
  const token = crypto.randomBytes(32).toString('hex');
  const claimTier = tier || tierForClaim(await (await col(CLAIMS)).countDocuments({}));
  const claimPrice = Number(price) || priceForTier(claimTier);

  await pending.updateOne(
    { email: normalized },
    {
      $set: {
        email: normalized,
        token,
        tier: claimTier,
        price: claimPrice,
        session_id: sessionId || null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updated_at: new Date(),
      },
      $setOnInsert: { id: uuidv4(), created_at: new Date(), claimed: false },
    },
    { upsert: true }
  );

  const origin = DEFAULT_CANONICAL_ORIGIN;
  try {
    const { sendEmail } = await import('@/lib/email');
    await sendEmail({
      to: normalized,
      subject: "You're in — claim your SoulPrint founder access",
      html: founderConfirmEmailHtml({ tier: claimTier, price: claimPrice, origin, claimToken: token }),
    });
  } catch (e) {
    console.error('[Founder] Claim email failed:', e.message);
  }

  console.log(`[Founder] Parked founder claim for ${normalized} (${claimTier} at $${claimPrice})`);

  return { pending_claim: true, email: normalized };
}

/**
 * Finish a guest founder purchase: set a password and grant lifetime access.
 *
 * The token is the only credential, so it is validated for existence, single use
 * and expiry before anything is written.
 */
export async function claimFounderByToken({ token, password }) {
  if (!token) return { error: 'This link is missing its token. Check the email we sent you.' };
  if (!password || String(password).length < 8) {
    return { error: 'Choose a password with at least 8 characters.' };
  }

  const pending = await col('founder_pending');
  const claim = await pending.findOne({ token });

  if (!claim) return { error: 'This link is not valid. Check the email we sent, or reply to your receipt.' };
  if (claim.claimed) return { error: 'This founder spot was already claimed. Try signing in instead.' };
  if (claim.expires_at && new Date(claim.expires_at) < new Date()) {
    return { error: 'This link has expired. Reply to your receipt and we will reissue it.' };
  }

  const usersCol = await col('users');
  const existing =
    (await usersCol.findOne({ email: claim.email })) ||
    (await usersCol.findOne({ email: new RegExp(`^${claim.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }));

  const passcode_hash = await hashPassword(password);
  let userId;

  if (existing) {
    // They signed up separately after buying — attach to that account.
    userId = existing.id || existing.user_id;
    await usersCol.updateOne(
      { id: userId },
      { $set: { passcode_hash, updated_at: new Date(), last_active_at: new Date() } }
    );
  } else {
    userId = uuidv4();
    await usersCol.insertOne({
      id: userId,
      email: claim.email,
      passcode_hash,
      role: 'user',
      accepted: true,
      created_at: new Date(),
      last_active_at: new Date(),
      auth_provider: 'purchase',
      founder_purchase: true,
    });

    await (await col('profiles')).insertOne({
      user_id: userId,
      display_name: '',
      assistant_name: 'SoulPrint',
      descriptors: [],
      field: '',
      help_with: [],
      discovery_source: 'founder_purchase',
      soul_profile_summary: '',
      onboarding_completed: false,
      assessment_complete: false,
      created_at: new Date(),
    });
  }

  await grantFounderAccess({
    userId,
    tier: claim.tier,
    price: claim.price,
    sessionId: claim.session_id,
  });

  await pending.updateOne(
    { token },
    { $set: { claimed: true, claimed_user_id: userId, claimed_at: new Date() } }
  );

  return { success: true, user_id: userId, email: claim.email, tier: claim.tier, price: claim.price };
}

/** Confirmation / claim email. Deliberately plain — it must survive every client. */
function founderConfirmEmailHtml({ tier, price, origin, claimToken, hasAccount }) {
  const amount = Number(price) || priceForTier(tier) || 99;
  const action = claimToken
    ? { url: `${origin}/claim?token=${claimToken}`, label: 'Set your password and get started' }
    : { url: `${origin}/auth`, label: 'Sign in to Passport' };

  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0D0D0D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#151515;border:1px solid #262626;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:34px 34px 8px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#F5531A;font-weight:700;">FOUNDING MEMBER</p>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#fff;font-weight:700;">You're a SoulPrint founder.</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#A3A3A3;">
            Your one-time payment of <strong style="color:#fff;">$${amount}</strong> went through.
            Passport is yours for life — no subscription, nothing to renew, ever.
          </p>
          ${claimToken ? `<p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#A3A3A3;">
            One last step: set a password on the email that paid, and your account is ready.
          </p>` : ''}
          <p style="margin:0 0 26px;">
            <a href="${action.url}" style="display:inline-block;background:#F5531A;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:9px;">${action.label}</a>
          </p>
          <p style="margin:0 0 26px;font-size:13px;line-height:1.6;color:#6B6B6B;">
            ${claimToken
              ? 'This link works once and expires in 30 days. If it ever expires, just reply to your receipt and we will reissue it.'
              : 'Your lifetime access is already active on your account.'}
          </p>
        </td></tr>
        <tr><td style="padding:0 34px 30px;">
          <p style="margin:0;font-size:12px;color:#4D4D4D;line-height:1.6;">
            SoulPrint · Different AI, same you.<br>
            Questions? Just reply to this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
