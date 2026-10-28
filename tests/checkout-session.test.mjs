/**
 * The rules that decide whether a page may claim a payment happened.
 *
 * These exist because the confirmation page is static. It previously answered that
 * question from a query parameter, so any URL with any `session_id` produced a paid
 * confirmation and a `$99` conversion in GA4/Quantcast. Revenue reporting built on an
 * unverified input is worse than no reporting: it looks authoritative.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidSessionId,
  isPaid,
  planFromMetadata,
  shapeSession,
} from '../lib/checkout-session.js';

// ── session id format ──────────────────────────────────────────────────────

test('accepts real Stripe session ids', () => {
  assert.ok(isValidSessionId('cs_live_a1B2c3D4e5F6g7H8i9J0'));
  assert.ok(isValidSessionId('cs_test_a1B2c3D4e5F6g7H8i9J0'));
});

test('rejects anything that is not a session id', () => {
  const bad = [
    '', 'anything', 'cs_test_', 'cs_live_short',
    'cs_bogus_aaaaaaaaaaaa', 'pk_live_aaaaaaaaaaaa',
    'cs_test_a1B2c3D4e5F6g7H8i9J0 extra',
    null, undefined, 42, {},
  ];
  for (const v of bad) {
    assert.equal(isValidSessionId(v), false, `should reject ${String(v)}`);
  }
});

test('a rejected id never reaches Stripe', () => {
  // The route returns 400 before constructing a client. This asserts the gate exists at
  // the validation layer the route calls first.
  assert.equal(isValidSessionId('junk'), false);
});

// ── paid determination ─────────────────────────────────────────────────────

test('only a paid status counts as paid', () => {
  assert.equal(isPaid('paid'), true);
  assert.equal(isPaid('no_payment_required'), true);
  assert.equal(isPaid('unpaid'), false);
  assert.equal(isPaid(''), false);
  assert.equal(isPaid(undefined), false);
  assert.equal(isPaid(null), false);
});

// ── plan resolution ────────────────────────────────────────────────────────

test('subscriptions read plan_id, founder reads type', () => {
  assert.equal(planFromMetadata({ plan_id: 'passport' }), 'passport');
  assert.equal(planFromMetadata({ type: 'founder', tier: 'first_25' }), 'founder');
});

test('unknown metadata returns null rather than guessing a plan', () => {
  assert.equal(planFromMetadata({}), null);
  assert.equal(planFromMetadata({ type: 'credits' }), null);
  assert.equal(planFromMetadata(null), null);
});

// ── the response body ──────────────────────────────────────────────────────

const session = {
  id: 'cs_test_x',
  status: 'complete',
  payment_status: 'paid',
  mode: 'payment',
  amount_total: 9900,
  currency: 'usd',
  customer: 'cus_secret',
  customer_email: 'buyer@example.com',
  customer_details: { email: 'buyer@example.com', name: 'A Person' },
  metadata: { type: 'founder', tier: 'first_25', price: '99', user_id: 'u_1' },
};

test('the payload carries what a confirmation page needs', () => {
  const out = shapeSession(session);
  assert.equal(out.ok, true);
  assert.equal(out.paid, true);
  assert.equal(out.plan, 'founder');
  assert.equal(out.tier, 'first_25');
  assert.equal(out.amount_total, 9900);
  assert.equal(out.currency, 'usd');
});

test('the payload leaks no personal data', () => {
  const out = shapeSession(session);
  const json = JSON.stringify(out);
  for (const leak of ['buyer@example.com', 'cus_secret', 'A Person', 'u_1']) {
    assert.ok(!json.includes(leak), `response must not carry ${leak}`);
  }
  assert.ok(!('customer_email' in out));
  assert.ok(!('customer' in out));
  assert.ok(!('metadata' in out), 'raw metadata can carry user_id');
});

test('amount stays in the smallest currency unit', () => {
  // 9900 cents, not 99. Converting here would invite a second conversion downstream.
  assert.equal(shapeSession(session).amount_total, 9900);
});

test('an unpaid session reports unpaid and claims no plan it cannot see', () => {
  const out = shapeSession({ ...session, payment_status: 'unpaid', metadata: {} });
  assert.equal(out.paid, false);
  assert.equal(out.plan, null);
});

test('a malformed session does not throw', () => {
  const out = shapeSession({});
  assert.equal(out.paid, false);
  assert.equal(out.amount_total, null);
  assert.equal(out.plan, null);
});
