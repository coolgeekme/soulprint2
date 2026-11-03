/**
 * Team Pro access — the single source of truth for who gets Pro without paying.
 *
 * The rule used to live in five places as five copies. The founder's address sits on a
 * personal domain (coolgeek.me), so every domain-only copy silently handed him Free: no
 * auto-extraction, a 10-memory cap, and a product that never learned anything about him. The
 * team list is now one export, and every entitlement path calls it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTeamProEmail,
  TEAM_PRO_DOMAINS,
  TEAM_PRO_EMAILS,
} from '../lib/handlers/team-access.js';

test('named addresses on a personal domain get Pro', () => {
  assert.equal(isTeamProEmail('reggie@coolgeek.me'), true);
});

test('the whole archeforge.com domain gets Pro', () => {
  assert.equal(isTeamProEmail('ben@archeforge.com'), true);
  assert.equal(isTeamProEmail('anyone@archeforge.com'), true);
});

test('matching is case-insensitive and whitespace tolerant', () => {
  assert.equal(isTeamProEmail('REGGIE@COOLGEEK.ME'), true);
  assert.equal(isTeamProEmail('Ben@ArcheForge.com'), true);
  assert.equal(isTeamProEmail('  reggie@coolgeek.me  '), true);
});

test('other addresses on the personal domain do NOT get Pro', () => {
  // Only the named address is listed. A domain-wide grant for coolgeek.me would hand Pro to
  // anyone whose mail happens to share it.
  assert.equal(isTeamProEmail('someone@coolgeek.me'), false);
  assert.equal(isTeamProEmail('info@coolgeek.me'), false);
});

test('ordinary users are unaffected', () => {
  assert.equal(isTeamProEmail('user@gmail.com'), false);
  assert.equal(isTeamProEmail('someone@disciplinedhustle.com'), false);
});

test('malformed input returns false rather than throwing', () => {
  for (const v of [null, undefined, '', '   ', 'not-an-email', '@archeforge.com', 42, {}, []]) {
    assert.equal(isTeamProEmail(v), false, `expected false for ${JSON.stringify(v)}`);
  }
});

test('the lists are exported so other call sites cannot drift', () => {
  assert.deepEqual(TEAM_PRO_DOMAINS, ['archeforge.com']);
  assert.ok(TEAM_PRO_EMAILS.includes('reggie@coolgeek.me'));
});

// ── bootstrap admin ─────────────────────────────────────────────────────────
import { isBootstrapAdmin, effectiveRole, BOOTSTRAP_ADMIN_EMAILS } from '../lib/handlers/team-access.js';

test('the bootstrap admin address is recognised', () => {
  assert.equal(isBootstrapAdmin('reggie@coolgeek.me'), true);
  assert.equal(isBootstrapAdmin('  REGGIE@CoolGeek.me '), true);
});

test('nobody else is silently an admin', () => {
  // Admin is read by ~37 separate checks. Anything on this list is a standing privilege grant,
  // so it stays short and it stays code.
  assert.equal(isBootstrapAdmin('someone@coolgeek.me'), false);
  assert.equal(isBootstrapAdmin('ben@archeforge.com'), false, 'team domain != admin');
  assert.equal(isBootstrapAdmin(null), false);
  assert.equal(isBootstrapAdmin(''), false);
  assert.deepEqual(BOOTSTRAP_ADMIN_EMAILS, ['reggie@coolgeek.me']);
});

test('effectiveRole elevates a bootstrap admin over a stored role', () => {
  assert.equal(effectiveRole({ email: 'reggie@coolgeek.me', role: 'user' }), 'admin');
  assert.equal(effectiveRole({ email: 'reggie@coolgeek.me' }), 'admin');
});

test('effectiveRole leaves everyone else exactly as stored', () => {
  assert.equal(effectiveRole({ email: 'ben@archeforge.com', role: 'user' }), 'user');
  assert.equal(effectiveRole({ email: 'x@y.com', role: 'superadmin' }), 'superadmin');
  assert.equal(effectiveRole(null), null);
});
