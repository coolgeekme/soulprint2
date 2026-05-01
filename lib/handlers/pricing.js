/**
 * PRICING & SUBSCRIPTION SYSTEM — Phase 1: Backend Infrastructure
 * 
 * Collections:
 *   - subscription_plans: Plan definitions (Free, Base, Power)
 *   - user_subscriptions: Each user's active subscription
 *   - usage_tracking: Per-user monthly usage metering
 *   - discount_codes: Promo codes & lifetime deals
 *   - video_credits: User credit wallets
 *   - payment_transactions: All payment history
 */

import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import { getDb } from '@/lib/mongodb';
import { getStandardModels, getPremiumModels } from '@/lib/llm/providers';

// ── Stripe Client ───────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function getCollection(name) {
  const db = await getDb();
  return db.collection(name);
}

// ── Default Plan Definitions ────────────────────────────────────────────
const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'Free',
    slug: 'free',
    price_monthly: 0,
    price_annual: 0,
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    sort_order: 0,
    features: {
      chat_model_tier: 'standard',  // Only standard-tier models (see lib/llm/providers.js)
      premium_chat: false,
      standard_msgs_per_day: 50,
      images_per_month: 10,
      image_watermark: true,
      image_models: ['nano-banana', 'seedream', 'qwen-image-edit'],
      image_rate_limit_per_hour: 5,
      videos_per_month: 0,
      video_duration_sec: null,
      video_resolution: null,
      video_watermark: true,
      video_models: [],
      pdfs_per_month: 5,
      voice_chat: false,
      file_analysis_basic: true,
      file_analysis_advanced: false,
      file_max_pages: 10,
      conversation_search: false,
      multi_platform: ['web', 'telegram'],
      memory_soulprint: true,
      assessment: true,
      support_level: 'ace_agent_24_7_email',
    },
    add_ons: {},
    description: 'Get started with AI that knows you.',
  },
  {
    id: 'base',
    name: 'Base',
    slug: 'base',
    price_monthly: 20.01,
    price_annual: 192.10, // 20.01 * 12 * 0.80
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    sort_order: 1,
    features: {
      chat_model_tier: 'all',  // Standard + Premium models (see lib/llm/providers.js)
      premium_chat: true,
      premium_chat_msgs_per_month: 50,
      images_per_month: 50,
      image_watermark: false,
      image_models: ['nano-banana', 'seedream', 'qwen-image-edit', 'nano-banana-pro', 'seedream-v4-edit', 'imagen4-ultra'],
      image_rate_limit_per_hour: null,
      videos_per_month: 1,
      video_duration_sec: 5,
      video_resolution: '720p',
      video_watermark: true,
      video_models: ['kling-3.0'],
      pdfs_per_month: 25,
      voice_chat: true,
      voice_minutes_per_month: 30,
      file_analysis_basic: true,
      file_analysis_advanced: true,
      file_max_pages: null,
      conversation_search: true,
      multi_platform: ['web', 'telegram'],
      memory_soulprint: true,
      assessment: true,
      support_level: 'ace_agent_24_7_email',
    },
    add_ons: {
      premium_chat_per_msg: 0.15,
      image_per_gen: 0.20,
      voice_per_min: 0.40,
      file_advanced_per_file: 0.15,
    },
    description: 'For daily users who want premium AI and clean media.',
  },
  {
    id: 'power',
    name: 'Power',
    slug: 'power',
    price_monthly: 99.01,
    price_annual: 950.50, // 99.01 * 12 * 0.80
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    sort_order: 2,
    features: {
      chat_model_tier: 'all',  // Standard + Premium models, unlimited (see lib/llm/providers.js)
      premium_chat: true,
      premium_chat_unlimited: true,
      images_per_month: null, // unlimited
      image_watermark: false,
      image_models: 'all',
      image_rate_limit_per_hour: null,
      videos_per_month: null, // unlimited
      video_duration_sec: null, // all durations
      video_resolution: 'all',
      video_watermark: false,
      video_models: 'all',
      pdfs_per_month: null, // unlimited
      voice_chat: true,
      voice_unlimited: true,
      file_analysis_basic: true,
      file_analysis_advanced: true,
      file_max_pages: null,
      conversation_search: true,
      multi_platform: ['web', 'telegram'],
      memory_soulprint: true,
      assessment: true,
      support_level: 'ace_agent_24_7_priority_email',
    },
    add_ons: {},
    description: 'Unlimited everything. Predictable flat rate.',
  },
];

// ── Media Credit Pack Definitions (covers Images + Videos) ──────────────
const MEDIA_CREDIT_PACKS = [
  { id: 'spark', name: 'Spark Creator Studio', credits: 30, price: 2.99, stripe_price_id: null },
  { id: 'creator', name: 'Creator Pack', credits: 150, price: 14.99, stripe_price_id: null },
  { id: 'pro', name: 'Pro Pack', credits: 500, price: 49.99, stripe_price_id: null },
  { id: 'studio', name: 'Studio Pack', credits: 1500, price: 149.99, stripe_price_id: null },
];

// ── Image Model Credit Costs (80% margin, $0.10/credit) ────────────────
const IMAGE_MODEL_CREDITS = {
  'seedream': 2,          // Cost: $0.03 → Charge: $0.20
  'seedream-5-lite': 2,   // Cost: $0.03 → Charge: $0.20
  'nano-banana': 3,       // Cost: $0.05 → Charge: $0.30
  'gpt4o-image': 5,       // Cost: $0.10 → Charge: $0.50
  'flux-pro': 7,          // Cost: $0.13 → Charge: $0.70
  'midjourney-v7': 10,    // Cost: $0.20 → Charge: $1.00
  'gpt-image-1-5': 13,    // Cost: $0.25 → Charge: $1.30
};

// ── Video Model Credit Costs ────────────────────────────────────────────
const VIDEO_MODEL_CREDITS = {
  'seedance-2-0-fast': 10,
  'seedance-2.0': 10,
  'kling-3.0': 38,     // $3.80 / $0.10 per credit
  'wan-2.6-i2v': 53,   // $5.25 / $0.10 per credit  
  'veo3': 105,          // $10.50 / $0.10 per credit
};

// ── Premium Message Packs (Add-On) ─────────────────────────────────────
const PREMIUM_MESSAGE_PACKS = [
  { id: 'msg-25', name: '25 Premium Messages', messages: 25, price: 3.75, stripe_price_id: null },
  { id: 'msg-50', name: '50 Premium Messages', messages: 50, price: 7.50, stripe_price_id: null },
  { id: 'msg-100', name: '100 Premium Messages', messages: 100, price: 14.00, stripe_price_id: null },
];

// ══════════════════════════════════════════════════════════════════════════
// PLAN MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════

async function seedPlans() {
  const col = await getCollection('subscription_plans');
  
  for (const plan of DEFAULT_PLANS) {
    // Preserve Stripe IDs and creation date from existing record
    const existing = await col.findOne({ id: plan.id });
    const mergedPlan = {
      ...plan,
      updated_at: new Date(),
      created_at: existing?.created_at || new Date(),
    };
    // Preserve Stripe product/price IDs if they exist
    if (existing?.stripe_product_id) mergedPlan.stripe_product_id = existing.stripe_product_id;
    if (existing?.stripe_price_id_monthly) mergedPlan.stripe_price_id_monthly = existing.stripe_price_id_monthly;
    if (existing?.stripe_price_id_annual) mergedPlan.stripe_price_id_annual = existing.stripe_price_id_annual;
    
    // Replace entire document to cleanly remove deprecated fields
    if (existing) {
      await col.replaceOne({ id: plan.id }, mergedPlan);
    } else {
      await col.insertOne(mergedPlan);
    }
    console.log(`[Pricing] Synced plan: ${plan.name}`);
  }

  // Seed media credit packs
  const packCol = await getCollection('media_credit_packs');
  for (const pack of MEDIA_CREDIT_PACKS) {
    await packCol.findOneAndUpdate(
      { id: pack.id },
      { $set: { ...pack, is_active: true }, $setOnInsert: { created_at: new Date() } },
      { upsert: true }
    );
  }

  console.log('[Pricing] Plan seeding complete');
}

async function getPlans(includeInactive = false) {
  const col = await getCollection('subscription_plans');
  const filter = includeInactive ? {} : { is_active: true };
  return col.find(filter).sort({ sort_order: 1 }).toArray();
}

async function getPlan(planId) {
  const col = await getCollection('subscription_plans');
  return col.findOne({ id: planId });
}

async function updatePlan(planId, updates) {
  const col = await getCollection('subscription_plans');
  const { id, _id, ...safeUpdates } = updates;
  return col.updateOne(
    { id: planId },
    { $set: { ...safeUpdates, updated_at: new Date() } }
  );
}

// ══════════════════════════════════════════════════════════════════════════
// STRIPE PRODUCT/PRICE SYNC
// ══════════════════════════════════════════════════════════════════════════

async function syncPlansToStripe() {
  const plans = await getPlans(true);
  const col = await getCollection('subscription_plans');
  const packCol = await getCollection('media_credit_packs');

  for (const plan of plans) {
    if (plan.price_monthly === 0) continue; // Skip free tier

    try {
      // Create or find Stripe product
      let product;
      if (plan.stripe_product_id) {
        product = await stripe.products.retrieve(plan.stripe_product_id);
      } else {
        product = await stripe.products.create({
          name: `SoulPrint Engine — ${plan.name}`,
          description: plan.description,
          metadata: { plan_id: plan.id },
        });
        await col.updateOne({ id: plan.id }, { $set: { stripe_product_id: product.id } });
      }

      // Create monthly price
      if (!plan.stripe_price_id_monthly) {
        const monthlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(plan.price_monthly * 100),
          currency: 'usd',
          recurring: { interval: 'month' },
          metadata: { plan_id: plan.id, billing_period: 'monthly' },
        });
        await col.updateOne({ id: plan.id }, { $set: { stripe_price_id_monthly: monthlyPrice.id } });
        console.log(`[Stripe] Created monthly price for ${plan.name}: ${monthlyPrice.id}`);
      }

      // Create annual price (20% discount)
      if (!plan.stripe_price_id_annual) {
        const annualPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(plan.price_annual * 100),
          currency: 'usd',
          recurring: { interval: 'year' },
          metadata: { plan_id: plan.id, billing_period: 'annual' },
        });
        await col.updateOne({ id: plan.id }, { $set: { stripe_price_id_annual: annualPrice.id } });
        console.log(`[Stripe] Created annual price for ${plan.name}: ${annualPrice.id}`);
      }
    } catch (err) {
      console.error(`[Stripe] Error syncing plan ${plan.name}:`, err.message);
    }
  }

  // Use existing packCol from line 252
  const packs = await packCol.find({ is_active: true }).toArray();
  for (const pack of packs) {
    if (pack.stripe_price_id) continue;
    try {
      const product = await stripe.products.create({
        name: `SoulPrint Media Credits — ${pack.name}`,
        description: `${pack.credits} media credits (images + videos)`,
        metadata: { pack_id: pack.id, credits: String(pack.credits) },
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(pack.price * 100),
        currency: 'usd',
        metadata: { pack_id: pack.id },
      });
      await packCol.updateOne({ id: pack.id }, { $set: { stripe_product_id: product.id, stripe_price_id: price.id } });
      console.log(`[Stripe] Created credit pack price for ${pack.name}: ${price.id}`);
    } catch (err) {
      console.error(`[Stripe] Error syncing pack ${pack.name}:`, err.message);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// USER SUBSCRIPTIONS
// ══════════════════════════════════════════════════════════════════════════

async function getUserSubscription(userId) {
  const col = await getCollection('user_subscriptions');
  let sub = await col.findOne({ user_id: userId });
  
  if (!sub) {
    // Create default free subscription
    sub = {
      id: uuidv4(),
      user_id: userId,
      plan_id: 'free',
      status: 'active', // active, trialing, grace_period, past_due, canceled
      billing_period: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_start: new Date(),
      current_period_end: null,
      grace_period_end: null,
      trial_end: null,
      discount_code: null,
      lifetime_deal: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await col.insertOne(sub);
  }
  
  return sub;
}

async function createCheckoutSession(userId, planId, billingPeriod, originUrl, discountCode = null) {
  const plan = await getPlan(planId);
  if (!plan || plan.price_monthly === 0) {
    throw new Error('Invalid plan for checkout');
  }

  const priceId = billingPeriod === 'annual' ? plan.stripe_price_id_annual : plan.stripe_price_id_monthly;
  if (!priceId) {
    throw new Error('Plan not synced with Stripe. Run sync first.');
  }

  // Get or create Stripe customer
  const sub = await getUserSubscription(userId);
  const usersCol = await getCollection('users');
  const user = await usersCol.findOne({ id: userId }) || await usersCol.findOne({ user_id: userId });
  
  let customerId = sub.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    const subCol = await getCollection('user_subscriptions');
    await subCol.updateOne({ user_id: userId }, { $set: { stripe_customer_id: customerId } });
  }

  // Check for discount code
  let couponId = null;
  if (discountCode) {
    const discount = await validateDiscountCode(discountCode);
    if (discount?.stripe_coupon_id) {
      couponId = discount.stripe_coupon_id;
    }
  }

  const sessionParams = {
    customer: customerId,
    mode: 'subscription',
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${originUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${originUrl}/chat?subscription_canceled=true`,
    metadata: {
      user_id: userId,
      plan_id: planId,
      billing_period: billingPeriod,
    },
    subscription_data: {
      metadata: { user_id: userId, plan_id: planId },
    },
  };

  if (couponId) {
    sessionParams.discounts = [{ coupon: couponId }];
    delete sessionParams.allow_promotion_codes; // Can't use both
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  // Record the pending transaction
  const txnCol = await getCollection('payment_transactions');
  await txnCol.insertOne({
    id: uuidv4(),
    session_id: session.id,
    user_id: userId,
    type: 'subscription',
    plan_id: planId,
    billing_period: billingPeriod,
    amount: billingPeriod === 'annual' ? plan.price_annual : plan.price_monthly,
    currency: 'usd',
    status: 'pending',
    payment_status: 'initiated',
    discount_code: discountCode,
    metadata: sessionParams.metadata,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return { url: session.url, session_id: session.id };
}

async function createCreditPackCheckout(userId, packId, originUrl) {
  const packCol = await getCollection('media_credit_packs');
  const pack = await packCol.findOne({ id: packId, is_active: true });
  if (!pack?.stripe_price_id) {
    throw new Error('Invalid credit pack or not synced with Stripe');
  }

  const sub = await getUserSubscription(userId);
  let customerId = sub.stripe_customer_id;
  if (!customerId) {
    const usersCol = await getCollection('users');
    const user = await usersCol.findOne({ id: userId }) || await usersCol.findOne({ user_id: userId });
    const customer = await stripe.customers.create({
      email: user?.email,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    const subCol = await getCollection('user_subscriptions');
    await subCol.updateOne({ user_id: userId }, { $set: { stripe_customer_id: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    allow_promotion_codes: true,
    line_items: [{ price: pack.stripe_price_id, quantity: 1 }],
    success_url: `${originUrl}/purchase/success?type=credits&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${originUrl}/chat?credits_canceled=true`,
    metadata: {
      user_id: userId,
      pack_id: packId,
      credits: String(pack.credits),
      type: 'credit_pack',
    },
  });

  const txnCol = await getCollection('payment_transactions');
  await txnCol.insertOne({
    id: uuidv4(),
    session_id: session.id,
    user_id: userId,
    type: 'credit_pack',
    pack_id: packId,
    amount: pack.price,
    currency: 'usd',
    credits: pack.credits,
    status: 'pending',
    payment_status: 'initiated',
    created_at: new Date(),
    updated_at: new Date(),
  });

  return { url: session.url, session_id: session.id };
}

async function createMessagePackCheckout(userId, packId, originUrl) {
  const packs = PREMIUM_MESSAGE_PACKS;
  const pack = packs.find(p => p.id === packId);
  if (!pack) {
    throw new Error('Invalid message pack');
  }

  const sub = await getUserSubscription(userId);
  let customerId = sub.stripe_customer_id;
  if (!customerId) {
    const usersCol = await getCollection('users');
    const user = await usersCol.findOne({ id: userId }) || await usersCol.findOne({ user_id: userId });
    const customer = await stripe.customers.create({
      email: user?.email,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    const subCol = await getCollection('user_subscriptions');
    await subCol.updateOne({ user_id: userId }, { $set: { stripe_customer_id: customerId } });
  }

  // Create a Stripe price on-the-fly for the message pack (or use stored price_id if available)
  let priceId = pack.stripe_price_id;
  if (!priceId) {
    const price = await stripe.prices.create({
      unit_amount: Math.round(pack.price * 100),
      currency: 'usd',
      product_data: {
        name: `SoulPrint Premium Messages — ${pack.name}`,
      },
    });
    priceId = price.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${originUrl}/purchase/success?type=messages&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${originUrl}/chat?messages_canceled=true`,
    metadata: {
      user_id: userId,
      pack_id: packId,
      messages: String(pack.messages),
      type: 'message_pack',
    },
  });

  const txnCol = await getCollection('payment_transactions');
  await txnCol.insertOne({
    id: uuidv4(),
    session_id: session.id,
    user_id: userId,
    type: 'message_pack',
    pack_id: packId,
    amount: pack.price,
    currency: 'usd',
    messages: pack.messages,
    status: 'pending',
    payment_status: 'initiated',
    created_at: new Date(),
    updated_at: new Date(),
  });

  return { url: session.url, session_id: session.id };
}

async function getCheckoutStatus(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  
  // Update transaction status
  const txnCol = await getCollection('payment_transactions');
  const txn = await txnCol.findOne({ session_id: sessionId });
  
  if (txn && txn.payment_status !== 'paid') {
    const newStatus = session.payment_status === 'paid' ? 'paid' : 
                      session.status === 'expired' ? 'expired' : 'pending';
    
    await txnCol.updateOne(
      { session_id: sessionId },
      { $set: { 
        status: session.status, 
        payment_status: newStatus,
        stripe_payment_intent: session.payment_intent,
        updated_at: new Date() 
      }}
    );

    // If payment is successful and not already processed
    if (newStatus === 'paid' && !txn.processed) {
      await processSuccessfulPayment(txn, session);
      await txnCol.updateOne({ session_id: sessionId }, { $set: { processed: true } });
    }
  }

  return {
    status: session.status,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    currency: session.currency,
    metadata: session.metadata,
  };
}

async function processSuccessfulPayment(txn, session) {
  if (txn.type === 'subscription') {
    // Activate subscription
    const subCol = await getCollection('user_subscriptions');
    const stripeSubId = session.subscription;
    
    await subCol.updateOne(
      { user_id: txn.user_id },
      {
        $set: {
          plan_id: txn.plan_id,
          status: 'active',
          billing_period: txn.billing_period,
          stripe_subscription_id: stripeSubId,
          current_period_start: new Date(),
          discount_code: txn.discount_code,
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`[Pricing] Activated ${txn.plan_id} subscription for user ${txn.user_id}`);
  } else if (txn.type === 'credit_pack') {
    // Add media credits to user wallet
    await addVideoCredits(txn.user_id, txn.credits, `Purchased ${txn.pack_id} pack`);
    console.log(`[Pricing] Added ${txn.credits} media credits for user ${txn.user_id}`);
  } else if (txn.type === 'message_pack') {
    // Add premium messages to user wallet
    const creditsCol = await getCollection('user_credits');
    await creditsCol.updateOne(
      { user_id: txn.user_id },
      { 
        $inc: { premium_messages: txn.messages },
        $set: { updated_at: new Date() },
        $push: { 
          purchase_history: { 
            pack_id: txn.pack_id, 
            messages: txn.messages, 
            amount: txn.amount, 
            purchased_at: new Date() 
          } 
        }
      },
      { upsert: true }
    );
    console.log(`[Pricing] Added ${txn.messages} premium messages for user ${txn.user_id}`);
  }
}

async function cancelSubscription(userId) {
  const sub = await getUserSubscription(userId);
  if (!sub.stripe_subscription_id) {
    throw new Error('No active Stripe subscription');
  }

  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  const subCol = await getCollection('user_subscriptions');
  await subCol.updateOne(
    { user_id: userId },
    { $set: { status: 'canceling', updated_at: new Date() } }
  );

  return { success: true, message: 'Subscription will cancel at end of billing period' };
}

async function getCustomerPortalUrl(userId, returnUrl) {
  const sub = await getUserSubscription(userId);
  if (!sub.stripe_customer_id) {
    throw new Error('No Stripe customer found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: returnUrl,
  });

  return { url: session.url };
}

// ══════════════════════════════════════════════════════════════════════════
// USAGE TRACKING
// ══════════════════════════════════════════════════════════════════════════

function getUsagePeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function trackUsage(userId, category, amount = 1, metadata = {}) {
  const col = await getCollection('usage_tracking');
  const period = getUsagePeriodKey();
  
  await col.updateOne(
    { user_id: userId, period },
    {
      $inc: { [`usage.${category}`]: amount },
      $push: {
        events: {
          $each: [{
            category,
            amount,
            metadata,
            timestamp: new Date(),
          }],
          $slice: -500, // Keep last 500 events
        },
      },
      $setOnInsert: { user_id: userId, period, created_at: new Date() },
      $set: { updated_at: new Date() },
    },
    { upsert: true }
  );
}

async function getUsage(userId, period = null) {
  const col = await getCollection('usage_tracking');
  const periodKey = period || getUsagePeriodKey();
  const doc = await col.findOne({ user_id: userId, period: periodKey });
  return doc?.usage || {
    images_basic: 0,
    images_premium: 0,
    videos: 0,
    voice_minutes: 0,
    premium_messages: 0,
    file_analyses: 0,
    api_calls: 0,
  };
}

async function getUserUsageSummary(userId) {
  const usage = await getUsage(userId);
  const sub = await getUserSubscription(userId);
  const plan = await getPlan(sub.plan_id);

  return {
    plan: sub.plan_id,
    plan_name: plan?.name || 'Free',
    period: getUsagePeriodKey(),
    usage,
    limits: {
      images_per_month: plan?.features?.images_per_month,
      videos_per_month: plan?.features?.videos_per_month || 0,
      pdfs_per_month: plan?.features?.pdfs_per_month || null,
      voice_included: plan?.features?.voice_chat || false,
    },
    subscription_status: sub.status,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// VIDEO CREDITS
// ══════════════════════════════════════════════════════════════════════════

async function getVideoCredits(userId) {
  const col = await getCollection('video_credits');
  const doc = await col.findOne({ user_id: userId });
  return doc || { user_id: userId, balance: 0, total_purchased: 0, total_spent: 0 };
}

async function addVideoCredits(userId, amount, reason) {
  const col = await getCollection('video_credits');
  await col.updateOne(
    { user_id: userId },
    {
      $inc: { balance: amount, total_purchased: amount },
      $push: {
        history: {
          $each: [{ type: 'credit', amount, reason, timestamp: new Date() }],
          $slice: -200,
        },
      },
      $setOnInsert: { user_id: userId, created_at: new Date() },
      $set: { updated_at: new Date() },
    },
    { upsert: true }
  );
}

async function spendVideoCredits(userId, amount, model, reason) {
  const col = await getCollection('video_credits');
  const wallet = await getVideoCredits(userId);
  
  if (wallet.balance < amount) {
    return { success: false, error: 'Insufficient credits', balance: wallet.balance, required: amount };
  }

  await col.updateOne(
    { user_id: userId },
    {
      $inc: { balance: -amount, total_spent: amount },
      $push: {
        history: {
          $each: [{ type: 'debit', amount, model, reason, timestamp: new Date() }],
          $slice: -200,
        },
      },
      $set: { updated_at: new Date() },
    }
  );

  return { success: true, balance: wallet.balance - amount };
}

// ══════════════════════════════════════════════════════════════════════════
// DISCOUNT CODES & LIFETIME DEALS
// ══════════════════════════════════════════════════════════════════════════

async function createDiscountCode({
  code, type, value, plan_ids, max_uses, expires_at,
  is_lifetime_deal = false, lifetime_plan_id = null, lifetime_price = null,
  description = '', duration = 'once', duration_in_months = null,
}) {
  const col = await getCollection('discount_codes');
  
  // Check for duplicate
  const existing = await col.findOne({ code: code.toUpperCase() });
  if (existing) throw new Error('Discount code already exists');

  // Create Stripe coupon if applicable
  let stripeCouponId = null;
  // Duration options: 'once' (first payment), 'forever' (every payment), 'repeating' (X months)
  const stripeDuration = is_lifetime_deal ? 'forever' : (duration || 'once');
  const durationParams = { duration: stripeDuration };
  if (stripeDuration === 'repeating' && duration_in_months) {
    durationParams.duration_in_months = parseInt(duration_in_months);
  }
  
  if (type === 'percent_off') {
    const coupon = await stripe.coupons.create({
      percent_off: value,
      ...durationParams,
      metadata: { code: code.toUpperCase() },
    });
    stripeCouponId = coupon.id;
  } else if (type === 'amount_off') {
    const coupon = await stripe.coupons.create({
      amount_off: Math.round(value * 100),
      currency: 'usd',
      ...durationParams,
      metadata: { code: code.toUpperCase() },
    });
    stripeCouponId = coupon.id;
  }

  const discount = {
    id: uuidv4(),
    code: code.toUpperCase(),
    type, // 'percent_off', 'amount_off', 'lifetime_deal'
    value,
    plan_ids: plan_ids || ['base', 'power'],
    max_uses: max_uses || null,
    current_uses: 0,
    expires_at: expires_at ? new Date(expires_at) : null,
    is_active: true,
    is_lifetime_deal,
    lifetime_plan_id,
    lifetime_price,
    duration: duration || 'once',
    duration_in_months: duration_in_months || null,
    stripe_coupon_id: stripeCouponId,
    description,
    created_at: new Date(),
    updated_at: new Date(),
  };

  await col.insertOne(discount);
  return discount;
}

async function validateDiscountCode(code) {
  const col = await getCollection('discount_codes');
  const discount = await col.findOne({ code: code.toUpperCase(), is_active: true });

  if (!discount) return { valid: false, error: 'Invalid discount code' };
  if (discount.expires_at && new Date() > discount.expires_at) {
    return { valid: false, error: 'Discount code has expired' };
  }
  if (discount.max_uses && discount.current_uses >= discount.max_uses) {
    return { valid: false, error: 'Discount code has been fully redeemed' };
  }

  return { valid: true, ...discount };
}

async function redeemDiscountCode(code) {
  const col = await getCollection('discount_codes');
  await col.updateOne(
    { code: code.toUpperCase() },
    { $inc: { current_uses: 1 }, $set: { updated_at: new Date() } }
  );
}

async function getDiscountCodes(includeInactive = false) {
  const col = await getCollection('discount_codes');
  const filter = includeInactive ? {} : { is_active: true };
  return col.find(filter).sort({ created_at: -1 }).toArray();
}

async function updateDiscountCode(codeId, updates) {
  const col = await getCollection('discount_codes');
  const { id, _id, ...safeUpdates } = updates;
  return col.updateOne(
    { id: codeId },
    { $set: { ...safeUpdates, updated_at: new Date() } }
  );
}

async function deleteDiscountCode(codeId) {
  const col = await getCollection('discount_codes');
  return col.updateOne({ id: codeId }, { $set: { is_active: false, updated_at: new Date() } });
}

// ══════════════════════════════════════════════════════════════════════════
// GRACE PERIOD MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════

async function startGracePeriod(userId, days = 14) {
  const subCol = await getCollection('user_subscriptions');
  const end = new Date();
  end.setDate(end.getDate() + days);

  await subCol.updateOne(
    { user_id: userId },
    {
      $set: {
        status: 'grace_period',
        grace_period_end: end,
        updated_at: new Date(),
      },
    },
    { upsert: true }
  );
}

async function startGracePeriodForAllUsers(days = 14) {
  const subCol = await getCollection('user_subscriptions');
  const usersCol = await getCollection('users');
  const end = new Date();
  end.setDate(end.getDate() + days);

  // Get all users who don't have a paid subscription
  const allUsers = await usersCol.find({}).toArray();
  let count = 0;
  
  for (const user of allUsers) {
    const uid = user.id || user.user_id;
    if (!uid) continue;
    
    const sub = await subCol.findOne({ user_id: uid });
    if (!sub || sub.plan_id === 'free') {
      await subCol.updateOne(
        { user_id: uid },
        {
          $set: {
            plan_id: 'free',
            status: 'grace_period',
            grace_period_end: end,
            updated_at: new Date(),
          },
          $setOnInsert: { id: uuidv4(), user_id: uid, created_at: new Date() },
        },
        { upsert: true }
      );
      count++;
    }
  }

  return { users_affected: count, grace_period_end: end };
}

// ══════════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK HANDLER
// ══════════════════════════════════════════════════════════════════════════

async function handleStripeWebhook(body, signature) {
  let event;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (endpointSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      throw new Error('Webhook signature verification failed');
    }
  } else {
    event = JSON.parse(body);
    console.warn('[Stripe Webhook] No webhook secret configured — accepting unverified event');
  }

  console.log(`[Stripe Webhook] Received: ${event.type}`);
  const subCol = await getCollection('user_subscriptions');
  const txnCol = await getCollection('payment_transactions');

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const txn = await txnCol.findOne({ session_id: session.id });
      if (txn && !txn.processed) {
        await processSuccessfulPayment(txn, session);
        await txnCol.updateOne(
          { session_id: session.id },
          { $set: { status: 'completed', payment_status: 'paid', processed: true, updated_at: new Date() } }
        );
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const userId = invoice.subscription_details?.metadata?.user_id || invoice.metadata?.user_id;
      if (userId) {
        await subCol.updateOne(
          { user_id: userId },
          { $set: { status: 'active', updated_at: new Date() } }
        );
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const userId = invoice.subscription_details?.metadata?.user_id || invoice.metadata?.user_id;
      if (userId) {
        await subCol.updateOne(
          { user_id: userId },
          { $set: { status: 'past_due', updated_at: new Date() } }
        );
        // Send failed payment email notification
        try {
          const usersCol = await getCollection('users');
          const user = await usersCol.findOne({ id: userId }) || await usersCol.findOne({ user_id: userId });
          if (user?.email) {
            const { sendPaymentFailedEmail } = await import('@/lib/email');
            await sendPaymentFailedEmail(user.email, user.name || user.display_name);
            console.log(`[Pricing] Payment failed email sent to ${user.email}`);
          }
        } catch (emailErr) {
          console.error('[Pricing] Failed to send payment failed email:', emailErr.message);
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;
      if (userId) {
        await subCol.updateOne(
          { user_id: userId },
          {
            $set: {
              status: subscription.cancel_at_period_end ? 'canceling' : 'active',
              current_period_start: new Date(subscription.current_period_start * 1000),
              current_period_end: new Date(subscription.current_period_end * 1000),
              updated_at: new Date(),
            },
          }
        );
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;
      if (userId) {
        await subCol.updateOne(
          { user_id: userId },
          {
            $set: {
              plan_id: 'free',
              status: 'canceled',
              stripe_subscription_id: null,
              updated_at: new Date(),
            },
          }
        );
        console.log(`[Pricing] Subscription canceled for user ${userId}, reverted to free`);
      }
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  return { received: true };
}

// ══════════════════════════════════════════════════════════════════════════
// ADMIN HELPERS
// ══════════════════════════════════════════════════════════════════════════

async function getAdminSubscriptionOverview() {
  const subCol = await getCollection('user_subscriptions');
  const usersCol = await getCollection('users');

  const subs = await subCol.find({}).toArray();
  const summary = { free: 0, base: 0, power: 0, grace_period: 0, total: subs.length };

  for (const s of subs) {
    if (s.status === 'grace_period') summary.grace_period++;
    else if (s.plan_id) summary[s.plan_id] = (summary[s.plan_id] || 0) + 1;
  }

  return summary;
}

async function adminSetUserPlan(userId, planId, reason = 'admin_override') {
  const subCol = await getCollection('user_subscriptions');
  await subCol.updateOne(
    { user_id: userId },
    {
      $set: {
        plan_id: planId,
        status: 'active',
        admin_override: true,
        admin_override_reason: reason,
        updated_at: new Date(),
      },
      $setOnInsert: { id: uuidv4(), user_id: userId, created_at: new Date() },
    },
    { upsert: true }
  );
  return { success: true, user_id: userId, plan_id: planId };
}

async function getPaymentHistory(userId) {
  const col = await getCollection('payment_transactions');
  return col.find({ user_id: userId }).sort({ created_at: -1 }).limit(50).toArray();
}

// ══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════

export {
  // Plan management
  seedPlans,
  getPlans,
  getPlan,
  updatePlan,
  syncPlansToStripe,
  
  // Subscriptions
  getUserSubscription,
  createCheckoutSession,
  createCreditPackCheckout,
  createMessagePackCheckout,
  getCheckoutStatus,
  cancelSubscription,
  getCustomerPortalUrl,
  
  // Usage
  trackUsage,
  getUsage,
  getUserUsageSummary,
  
  // Media credits (images + videos)
  getVideoCredits,
  addVideoCredits,
  spendVideoCredits,
  VIDEO_MODEL_CREDITS,
  IMAGE_MODEL_CREDITS,
  MEDIA_CREDIT_PACKS,
  PREMIUM_MESSAGE_PACKS,
  
  // Discounts
  createDiscountCode,
  validateDiscountCode,
  redeemDiscountCode,
  getDiscountCodes,
  updateDiscountCode,
  deleteDiscountCode,
  
  // Grace period
  startGracePeriod,
  startGracePeriodForAllUsers,
  
  // Stripe webhook
  handleStripeWebhook,
  
  // Admin
  getAdminSubscriptionOverview,
  adminSetUserPlan,
  getPaymentHistory,
};
