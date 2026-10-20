/**
 * Founder offer tier math — pure, no imports.
 *
 * Kept separate from handlers/founder.js so the pricing ladder can be tested
 * without dragging in Stripe and the Mongo client.
 *
 *   0–24    → first_25   $99    lifetime
 *   25–49   → next_25    $199   lifetime
 *   50+     → sold out
 */

export const FOUNDER_LIMIT = 50;
export const FIRST_TIER_CAP = 25;
export const FIRST_TIER_PRICE = 99;
export const NEXT_TIER_PRICE = 199;

/** Which tier does a claim get, given how many came before it? null = sold out. */
export function tierForClaim(claimedCount) {
  if (!Number.isFinite(claimedCount) || claimedCount < 0) return null;
  if (claimedCount >= FOUNDER_LIMIT) return null;
  return claimedCount < FIRST_TIER_CAP ? 'first_25' : 'next_25';
}

export function priceForTier(tier) {
  if (tier === 'first_25') return FIRST_TIER_PRICE;
  if (tier === 'next_25') return NEXT_TIER_PRICE;
  return null;
}
