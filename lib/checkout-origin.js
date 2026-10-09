/**
 * Resolve the origin used for Stripe success and cancel URLs.
 *
 * WHY THIS EXISTS
 * ---------------
 * Stripe sends the customer to `${origin}/thank-you` after payment, so whatever this
 * returns must be an origin that can actually serve that page. The engine is the only
 * one that can: /thank-you reads the checkout session and the database, and the
 * product site is static.
 *
 * The checkout endpoint used to take `originUrl` straight from the request body and
 * paste it into both URLs. That produced two problems:
 *
 *   - A checkout started from a page on another origin went to `${thatHost}/thank-you`,
 *     which 404s on the static product site. The customer pays and lands on nothing.
 *   - The value is caller-controlled, so it decides where a customer is sent after
 *     handing over payment details. That is not something a request body should decide.
 *
 * So the canonical origin is authoritative and a caller-supplied value is only
 * honoured when it is an origin we already recognise.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not an auth boundary — it only decides a redirect target for the person making the
 * request. It matters because a wrong value breaks the post-payment experience and a
 * hostile value is a bait-and-switch on a paying customer, not because it protects
 * server data.
 *
 * Dependency-free on purpose so it can be unit-tested without Next.js, Stripe or Mongo.
 */

export const DEFAULT_CANONICAL_ORIGIN = 'https://soulprintengine.ai';

/** Strip a trailing slash so origins compare equal to `new URL(x).origin`. */
function normalize(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

/** The origin we consider authoritative. Configurable, but never caller-supplied. */
export function canonicalOrigin() {
  return normalize(process.env.APP_ORIGIN) || DEFAULT_CANONICAL_ORIGIN;
}

/**
 * Origins we will accept from a caller, in addition to the canonical one.
 * Configured through CHECKOUT_ALLOWED_ORIGINS (comma-separated) — for preview
 * deployments or a staging domain. Never read from the request.
 */
function extraAllowedOrigins() {
  return String(process.env.CHECKOUT_ALLOWED_ORIGINS || '')
    .split(',')
    .map(normalize)
    .filter(Boolean);
}

/** Local development only; unreachable in a production build. */
function isLocalDev(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === canonicalOrigin()) return true;
  if (extraAllowedOrigins().includes(origin)) return true;
  return isLocalDev(origin);
}

/**
 * Return an origin safe to place in a Stripe redirect URL.
 * Falls back to the canonical origin for anything missing, unparseable or
 * unrecognised — a wrong-but-working redirect beats a 404 after payment.
 */
export function resolveCheckoutOrigin(candidate) {
  try {
    const origin = new URL(candidate).origin;
    if (isAllowedOrigin(origin)) return origin;
    console.warn(
      `[checkout-origin] Ignoring unrecognised origin ${origin}; using ${canonicalOrigin()}`
    );
  } catch {
    // missing or unparseable — fall through
  }
  return canonicalOrigin();
}
