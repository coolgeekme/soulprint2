/**
 * Dedupe filter — regression tests.
 *
 * Production defect this locks down: with no MEMORY_ENCRYPTION_KEY set,
 * memoryContentHash() returns null, and the dedupe query still included
 * `{ content_hash: null }`. Mongo matches every document that is MISSING the
 * field, so every save collided with an arbitrary existing memory and the client
 * was told `duplicate: true` for a fact that was never stored. Observed live:
 * saving an unrelated fact was rejected against an unrelated memory.
 *
 * The invariant: no content_hash clause may be emitted unless there is a real hash.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDedupeFilter, escapeRegex } from '../lib/mcp/dedupe.js';

const HASH = 'a'.repeat(64);

test('a real hash adds the hash clause alongside the exact match', () => {
  const f = buildDedupeFilter('u1', 'Has a dog named Ouzo', HASH);
  assert.equal(f.user_id, 'u1');
  assert.equal(f.$or.length, 2);
  assert.deepEqual(f.$or[0], { content_hash: HASH });
  assert.equal(f.$or[1].content.$regex, '^Has a dog named Ouzo$');
  assert.equal(f.$or[1].content.$options, 'i');
});

test('NO hash clause is emitted when the key is missing', () => {
  const f = buildDedupeFilter('u1', 'Has a dog named Ouzo', null);
  // The whole defect: { content_hash: null } matches every doc missing the field.
  assert.ok(!JSON.stringify(f).includes('content_hash'));
  assert.equal(f.$or, undefined);
  assert.equal(f.content.$regex, '^Has a dog named Ouzo$');
});

test('a falsy hash of any kind never produces a hash clause', () => {
  for (const h of [null, undefined, '', 0, false]) {
    const serialized = JSON.stringify(buildDedupeFilter('u1', 'x', h));
    assert.ok(!serialized.includes('content_hash'), `hash=${JSON.stringify(h)} leaked a clause`);
  }
});

test('the filter is always scoped to one user', () => {
  for (const h of [HASH, null, undefined, '']) {
    assert.equal(buildDedupeFilter('u1', 'x', h).user_id, 'u1');
  }
});

test('regex metacharacters are escaped so they match literally', () => {
  const content = 'Costs $5 (approx.) a+b';
  const f = buildDedupeFilter('u1', content, HASH);
  const pattern = new RegExp(f.$or[1].content.$regex, 'i');
  assert.ok(pattern.test(content), 'matches itself');
  assert.ok(!pattern.test('Costs 5 approx aaab'), 'unescaped metachars would over-match');
});

test('matching is exact and anchored, so prefixes and substrings do not collide', () => {
  const f = buildDedupeFilter('u1', 'Ian is 17', HASH);
  const pattern = new RegExp(f.$or[1].content.$regex, 'i');
  assert.ok(pattern.test('ian is 17'), 'case-insensitive');
  assert.ok(!pattern.test('Ian is 17 years old'), 'no prefix match');
  assert.ok(!pattern.test('My son Ian is 17'), 'no substring match');
});

test('escapeRegex tolerates non-string input', () => {
  assert.equal(escapeRegex(5), '5');
  assert.equal(typeof escapeRegex(undefined), 'string');
});
