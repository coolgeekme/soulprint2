/**
 * Tests for lib/beta.js — the switch that grants beta users access to Passport's
 * core features (auto-extraction, the MCP connector, custom Imprints).
 *
 * Run: node --test tests/beta.test.mjs
 *
 * lib/beta.js is deliberately dependency-free so it can be tested directly, without
 * importing the Next.js app or a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Fresh import per case so process.env changes take effect.
async function load() {
  const url = new URL('../lib/beta.js', import.meta.url);
  url.search = `?v=${Math.random()}`;         // bust the module cache between cases
  return import(url.href);
}

test('beta is ON by default', async () => {
  delete process.env.BETA_MODE;
  const { isBetaMode } = await load();
  assert.equal(isBetaMode(), true,
    'beta must default ON — the failure mode of an unset flag should be granting access, not denying it');
});

test('BETA_MODE=false turns beta off', async () => {
  process.env.BETA_MODE = 'false';
  const { isBetaMode } = await load();
  assert.equal(isBetaMode(), false);
  process.env.BETA_MODE = '';
});

test('any value other than the literal "false" keeps beta on', async () => {
  for (const v of ['true', '1', 'yes', 'FALSE', 'False', '0', '']) {
    process.env.BETA_MODE = v;
    const { isBetaMode } = await load();
    assert.equal(isBetaMode(), true, `BETA_MODE=${JSON.stringify(v)} should keep beta ON`);
  }
  delete process.env.BETA_MODE;
});

test('beta tier is pro — the tier that already carries every gated capability', async () => {
  const { BETA_TIER_ID } = await load();
  assert.equal(BETA_TIER_ID, 'pro');
});

// ── betaGrantsAccess ────────────────────────────────────────────────────────

test('a user with no subscription gets beta access', async () => {
  delete process.env.BETA_MODE;
  const { betaGrantsAccess } = await load();
  assert.equal(betaGrantsAccess(null), true);
  assert.equal(betaGrantsAccess(undefined), true);
});

test('a user on the free plan gets beta access', async () => {
  delete process.env.BETA_MODE;
  const { betaGrantsAccess } = await load();
  assert.equal(betaGrantsAccess({ plan_id: 'free', status: 'active' }), true,
    'this is the case that was broken — every beta user resolves to free');
});

test('a paying subscriber is NOT granted beta access, so their own plan resolves', async () => {
  delete process.env.BETA_MODE;
  const { betaGrantsAccess } = await load();
  assert.equal(betaGrantsAccess({ plan_id: 'base', status: 'active' }), false);
  assert.equal(betaGrantsAccess({ plan_id: 'pro', status: 'active' }), false);
});

test('a lapsed paid subscriber falls back to beta access', async () => {
  delete process.env.BETA_MODE;
  const { betaGrantsAccess } = await load();
  assert.equal(betaGrantsAccess({ plan_id: 'base', status: 'canceled' }), true,
    'we are in beta — a lapsed subscriber should still get the full product');
  assert.equal(betaGrantsAccess({ plan_id: 'base', status: 'past_due' }), true);
});

test('with beta OFF, nobody is granted beta access', async () => {
  process.env.BETA_MODE = 'false';
  const { betaGrantsAccess } = await load();
  assert.equal(betaGrantsAccess(null), false);
  assert.equal(betaGrantsAccess({ plan_id: 'free', status: 'active' }), false);
  process.env.BETA_MODE = '';
});
