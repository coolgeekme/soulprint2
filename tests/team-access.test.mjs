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
