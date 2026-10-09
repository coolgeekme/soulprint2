/**
 * Guards for the retired-plan / grandfathering arrangement.
 *
 * Run: node --test tests/plan-retirement.test.mjs
 *
 * WHY A SOURCE-LEVEL TEST
 * -----------------------
 * Grandfathering existing subscribers works for exactly one reason: the code paths
 * that resolve a subscriber's plan look it up by `id` ALONE, with no `is_active`
 * filter. That is what lets a plan be hidden from the public list while still
 * entitling the people already on it.
 *
 * That property is invisible and easy to destroy. Adding `is_active: true` to either
 * of those queries looks like a tidy-up, passes review, and silently strips every
 * grandfathered subscriber of their features — they would fall through to the `free`
 * fallback in each handler. There is no error, no log, and no failing request.
 *
 * These tests read the source and fail if that filter appears, so the break is caught
 * at the point it is introduced rather than by an angry customer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const PRICING = 'lib/handlers/pricing.js';
const ACCESS_CHECK = 'lib/handlers/access-check.js';
const ENFORCEMENT = 'lib/handlers/access-enforcement.js';

// ── the grandfathering invariant ────────────────────────────────────────────

test('subscriber plan resolution does not filter on is_active', () => {
  // access-check.js — resolves the plan a user's subscription points at.
  const ac = read(ACCESS_CHECK);
  const acQuery = ac.match(/plansCol\.findOne\(\{[^}]*\}\)/);
  assert.ok(acQuery, 'expected to find the plan-resolution query in access-check.js');
  assert.ok(!/is_active/.test(acQuery[0]),
    'access-check.js plan resolution must not filter on is_active, or grandfathered ' +
    `subscribers lose their entitlements. Found: ${acQuery[0]}`);

  // access-enforcement.js — resolves the plan for the enforcement path.
  const enf = read(ENFORCEMENT);
  const enfQuery = enf.match(/subscription_plans'\)\.findOne\(\{[^}]*\}\)/);
  assert.ok(enfQuery, 'expected to find the plan-resolution query in access-enforcement.js');
  assert.ok(!/is_active/.test(enfQuery[0]),
    'access-enforcement.js plan resolution must not filter on is_active, or ' +
    `grandfathered subscribers lose their entitlements. Found: ${enfQuery[0]}`);
});

test('public plan listing DOES filter on is_active (so retirement actually hides)', () => {
  const p = read(PRICING);
  assert.ok(/includeInactive \? \{\} : \{ is_active: true \}/.test(p),
    'getPlans() must keep filtering on is_active, or retired tiers stay purchasable');
});

// ── the retirement itself ───────────────────────────────────────────────────

test('legacy Engine tiers are retired through the shared constant', () => {
  const p = read(PRICING);
  assert.ok(/const LEGACY_TIER_ACTIVE = false;/.test(p),
    'the retirement constant must exist and be false');

  for (const id of ['base', 'plus', 'power']) {
    const block = p.slice(p.indexOf(`id: '${id}',`));
    const untilNextPlan = block.slice(0, block.indexOf('description:'));
    assert.ok(/is_active: LEGACY_TIER_ACTIVE/.test(untilNextPlan),
      `${id} must be retired via LEGACY_TIER_ACTIVE`);
    assert.ok(!/is_active: true/.test(untilNextPlan),
      `${id} must not still be flagged active — it would remain purchasable`);
  }
});

test('retired tiers stay in DEFAULT_PLANS so seedPlans updates rather than orphans them', () => {
  const p = read(PRICING);
  const array = p.slice(p.indexOf('const DEFAULT_PLANS = ['), p.indexOf('// ── Media Credit Pack Definitions'));
  for (const id of ['base', 'plus', 'power']) {
    assert.ok(array.includes(`id: '${id}',`),
      `${id} must remain in DEFAULT_PLANS. Removing it would leave a stale ` +
      'is_active: true document in the database that is still purchasable.');
  }
});

test('free stays active — it is the default plan for every new user', () => {
  const p = read(PRICING);
  const freeBlock = p.slice(p.indexOf("id: 'free',"));
  assert.ok(/is_active: true/.test(freeBlock.slice(0, freeBlock.indexOf('description:'))),
    'the free plan must remain active');
});

// ── the Passport plan ───────────────────────────────────────────────────────

test('the Passport plan exists at the promised prices', () => {
  const p = read(PRICING);
  const block = p.slice(p.indexOf("id: 'passport',"));
  const end = block.indexOf('description:');
  const plan = block.slice(0, end);

  assert.ok(/price_monthly: 9\b/.test(plan), 'Passport monthly must be $9');
  assert.ok(/price_annual: 90\b/.test(plan), 'Passport annual must be $90');
  assert.ok(/slug: 'passport'/.test(plan));
});

test('Passport is unpurchasable while we are in beta', () => {
  const p = read(PRICING);
  const block = p.slice(p.indexOf("id: 'passport',"));
  assert.ok(/is_active: !isBetaMode\(\)/.test(block.slice(0, block.indexOf('description:'))),
    'Passport visibility must follow the beta switch, so ending beta stays one flag');
  assert.ok(/from '@\/lib\/beta'/.test(p), 'pricing.js must import the beta switch');
});

test('nothing is purchasable during beta — every paid plan is inactive', () => {
  // The product is free during beta and the site promises "no card, no commitment".
  // A purchasable plan during beta would contradict both.
  const p = read(PRICING);
  const array = p.slice(p.indexOf('const DEFAULT_PLANS = ['), p.indexOf('// ── Media Credit Pack Definitions'));

  const activeLiterallyTrue = (array.match(/is_active: true/g) || []).length;
  assert.equal(activeLiterallyTrue, 1,
    'exactly one plan (free) should be hard-coded active; every paid plan must be ' +
    'hidden during beta. Found ' + activeLiterallyTrue);
});
