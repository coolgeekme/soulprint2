/**
 * Founder pricing ladder.
 *
 * The public page makes three promises: $99 for the first 25, $199 for the next
 * 25, and closed at 50. These tests lock the boundaries, because an off-by-one
 * here charges a real customer the wrong amount in live Stripe.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOUNDER_LIMIT,
  FIRST_TIER_CAP,
  FIRST_TIER_PRICE,
  NEXT_TIER_PRICE,
  tierForClaim,
  priceForTier,
} from '../lib/founder-tiers.js';

test('first 25 claims get the $99 tier', () => {
  assert.equal(tierForClaim(0), 'first_25');
  assert.equal(tierForClaim(1), 'first_25');
  assert.equal(tierForClaim(24), 'first_25');
});

test('claims 26-50 get the $199 tier', () => {
  assert.equal(tierForClaim(25), 'next_25');   // the 26th claimant
  assert.equal(tierForClaim(26), 'next_25');
  assert.equal(tierForClaim(49), 'next_25');   // the 50th and last claimant
});

test('the 51st claim is sold out', () => {
  assert.equal(tierForClaim(50), null);
  assert.equal(tierForClaim(51), null);
  assert.equal(tierForClaim(1000), null);
});

test('prices match the published ladder', () => {
  assert.equal(priceForTier('first_25'), 99);
  assert.equal(priceForTier('next_25'), 199);
  assert.equal(priceForTier(null), null);
  assert.equal(priceForTier('nope'), null);
});

test('exactly 25 spots at each price, and the cap totals 50', () => {
  const tiers = Array.from({ length: FOUNDER_LIMIT }, (_, i) => tierForClaim(i));
  assert.equal(tiers.filter(t => t === 'first_25').length, 25);
  assert.equal(tiers.filter(t => t === 'next_25').length, 25);
  assert.equal(tiers.length, FOUNDER_LIMIT);
  assert.equal(FIRST_TIER_CAP * 2, FOUNDER_LIMIT);
});

test('the offer is worth the figure quoted to Reggie', () => {
  const revenue = FIRST_TIER_CAP * FIRST_TIER_PRICE + FIRST_TIER_CAP * NEXT_TIER_PRICE;
  assert.equal(revenue, 7450);   // 25 * 99 + 25 * 199
});

test('bad input never yields a purchasable tier', () => {
  assert.equal(tierForClaim(-1), null);
  assert.equal(tierForClaim(NaN), null);
  assert.equal(tierForClaim(Infinity), null);
  assert.equal(tierForClaim(undefined), null);
});
