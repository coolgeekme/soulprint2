/**
 * Pure helpers for the public checkout-session verification endpoint.
 *
 * Kept dependency-free and separate from the Next route so the rules that decide
 * "may this page claim a payment happened" can be unit-tested without Stripe, Mongo
 * or a running server.
 *
 * The failure this guards against: the product site's thank-you page is static, so it
 * cannot read Stripe. It previously decided a purchase had happened from the mere
 * presence of `?session_id=`. Anything that confirms revenue from an unverified input
 * will eventually write fabricated conversions into GA4 and Quantcast, which is exactly
 * the data the pricing conversation runs on.
 */

/** Stripe session ids look like `cs_test_…` / `cs_live_…`. */
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9_]{8,}$/;

// A wildcard here would let any page on the web test a leaked session id for
// "did this person buy, and how much did they spend".
export const ALLOWED_ORIGINS = [
  'https://soulprintpassport.ai',
  'https://www.soulprintpassport.ai',
  'https://soulprintengine.ai',
];

export const DEFAULT_ALLOWED_ORIGIN = 'https://soulprintpassport.ai';

/**
 * Reject before the network call so garbage never reaches Stripe's rate limit.
 * Note this is a FORMAT check, not proof the session exists — only Stripe can say that.
 */
export function isValidSessionId(value) {
  if (typeof value !== 'string') return false;
  return SESSION_ID.test(value.trim());
}

/** Narrow the CORS origin to something we recognise, never echo back an arbitrary one. */
export function resolveAllowedOrigin(origin) {
  if (typeof origin !== 'string') return DEFAULT_ALLOWED_ORIGIN;
  return ALLOWED_ORIGINS.includes(origin) ? origin : DEFAULT_ALLOWED_ORIGIN;
}

/**
 * `paid` is the only field a confirmation page may act on.
 *
 * Stripe returns `payment_status: 'paid' | 'unpaid' | 'no_payment_required'`. A
 * subscription's FIRST redirect can arrive as 'no_payment_required' when a trial or a
 * zero-value invoice is involved, so it is reported as paid — but only because the
 * session itself had to exist and be retrieved from Stripe to get here. A client cannot
 * reach this by asserting anything.
 */
export function isPaid(paymentStatus) {
  return paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
}

/**
 * Subscriptions stamp `plan_id`; the founder offer stamps `type: 'founder'` plus a tier.
 * Returns null rather than guessing, so the page falls back to its neutral copy.
 */
export function planFromMetadata(metadata) {
  const meta = metadata || {};
  if (typeof meta.plan_id === 'string' && meta.plan_id) return meta.plan_id;
  if (meta.type === 'founder') return 'founder';
  return null;
}

/**
 * The response body. Deliberately minimal: no email, no customer id, no address.
 *
 * A session id travels in a URL, where it can leak through a referrer, a screenshot or
 * shared browser history. Whoever holds one just paid — but the payload still carries
 * only what a confirmation page needs and nothing that identifies them.
 */
export function shapeSession(session) {
  const meta = session?.metadata || {};
  return {
    ok: true,
    paid: isPaid(session?.payment_status),
    status: session?.status ?? null,
    payment_status: session?.payment_status ?? null,
    mode: session?.mode ?? null,
    plan: planFromMetadata(meta),
    tier: meta.tier || null,
    billing_period: meta.billing_period || null,
    // Smallest currency unit, as Stripe reports it. Converting to dollars here would
    // invite a second conversion somewhere downstream.
    amount_total: session?.amount_total ?? null,
    currency: session?.currency ?? null,
  };
}
