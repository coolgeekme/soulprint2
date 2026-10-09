/**
 * Tests for lib/checkout-origin.js.
 *
 * Run: node --test tests/checkout-origin.test.mjs
 *
 * This decides where Stripe sends a customer after payment. The cases that matter are
 * the hostile and the simply-wrong ones, because the failure they cause — landing on a
 * 404 after handing over card details — is invisible until someone pays.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const url = new URL('../lib/checkout-origin.js', import.meta.url);

async function load(env = {}) {
  const u = new URL(url.href); u.search = `?v=${Math.random()}`;
  const mod = await import(u.href);
  delete process.env.APP_ORIGIN;
  delete process.env.CHECKOUT_ALLOWED_ORIGINS;
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  return mod;
}

beforeEach(() => {
  delete process.env.APP_ORIGIN;
  delete process.env.CHECKOUT_ALLOWED_ORIGINS;
});

// ── the default ─────────────────────────────────────────────────────────────

test('defaults to the engine origin', async () => {
  const m = await load();
  assert.equal(m.canonicalOrigin(), 'https://soulprintengine.ai');
});

test('APP_ORIGIN overrides it', async () => {
  const m = await load({ APP_ORIGIN: 'https://staging.example.com' });
  assert.equal(m.canonicalOrigin(), 'https://staging.example.com');
});

test('a trailing slash on APP_ORIGIN is normalised away', async () => {
  const m = await load({ APP_ORIGIN: 'https://staging.example.com///' });
  assert.equal(m.canonicalOrigin(), 'https://staging.example.com');
});

// ── the regression this module exists for ───────────────────────────────────

test('a checkout started from the product site lands on the engine, not the static site', async () => {
  // This is the real bug: passport.ai is static and cannot serve /thank-you, so
  // honouring its origin sends a paying customer to a 404.
  const m = await load();
  assert.equal(m.resolveCheckoutOrigin('https://soulprintpassport.ai'), 'https://soulprintengine.ai');
});

test('an arbitrary origin is refused', async () => {
  const m = await load();
  for (const hostile of [
    'https://evil.example.com',
    'https://soulprintengine.ai.evil.com',   // suffix trick
    'http://soulprintengine.ai',             // wrong scheme
  ]) {
    assert.equal(m.resolveCheckoutOrigin(hostile), 'https://soulprintengine.ai',
      `${hostile} must not be honoured`);
  }
});

test('missing, empty and unparseable values fall back safely', async () => {
  const m = await load();
  for (const bad of [undefined, null, '', 'not a url', '://', '/relative']) {
    assert.equal(m.resolveCheckoutOrigin(bad), 'https://soulprintengine.ai');
  }
});

// ── the legitimate cases that must keep working ─────────────────────────────

test('the canonical origin is honoured', async () => {
  const m = await load();
  assert.equal(m.resolveCheckoutOrigin('https://soulprintengine.ai'), 'https://soulprintengine.ai');
});

test('a configured extra origin is honoured', async () => {
  const m = await load({ CHECKOUT_ALLOWED_ORIGINS: 'https://preview.vercel.app, https://staging.example.com' });
  assert.equal(m.resolveCheckoutOrigin('https://preview.vercel.app'), 'https://preview.vercel.app');
  assert.equal(m.resolveCheckoutOrigin('https://staging.example.com'), 'https://staging.example.com');
  assert.equal(m.resolveCheckoutOrigin('https://other.vercel.app'), 'https://soulprintengine.ai');
});

test('a path or query on an allowed origin is reduced to the origin', async () => {
  const m = await load();
  assert.equal(m.resolveCheckoutOrigin('https://soulprintengine.ai/some/path?x=1'), 'https://soulprintengine.ai');
});

test('localhost is allowed outside production', async () => {
  const m = await load();
  assert.equal(m.resolveCheckoutOrigin('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(m.resolveCheckoutOrigin('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
});

test('localhost is refused in production', async () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const m = await load();
    assert.equal(m.resolveCheckoutOrigin('http://localhost:3000'), 'https://soulprintengine.ai',
      'a production build must never redirect a customer to localhost');
  } finally {
    process.env.NODE_ENV = original;
  }
});

test('when APP_ORIGIN is set it is the only implicit allow', async () => {
  const m = await load({ APP_ORIGIN: 'https://staging.example.com' });
  assert.equal(m.resolveCheckoutOrigin('https://staging.example.com'), 'https://staging.example.com');
  assert.equal(m.resolveCheckoutOrigin('https://soulprintengine.ai'), 'https://staging.example.com',
    'the configured origin is authoritative, so the old default falls back to it');
});
