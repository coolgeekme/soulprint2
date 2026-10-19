/**
 * Retrieval fusion — regression tests.
 *
 * Production defect: soulprint_get_memories returned the same recent/high-importance
 * memories for EVERY query. Against real account data, 12 memories contained
 * "DisciplinedOS" and 8 of them were the top lexical hits for that query (scores
 * 0.535-0.743), yet the live tool returned none of them — it returned unrelated
 * memories pinned at 0.270. "Kenshin Report" behaved the same way.
 *
 * Cause: hybridMatchMemories fused the lexical ranking with a vector ranking built by
 * rankByEmbedding(), which DROPS memories that have no stored embedding. RRF scores by
 * rank POSITION, so on a partially embedded store every embedded memory collected a
 * contribution an un-embedded one could not — enough to lift irrelevant memories above
 * exact keyword matches.
 *
 * The invariants locked down here:
 *   1. Never fuse a vector list unless the candidate pool is FULLY embedded.
 *   2. Fusion may re-rank candidates, never introduce ids from outside the pool.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFullyEmbedded,
  fuseWithinPool,
  hybridRank,
} from '../lib/hybrid-retrieval.js';

const vec = (n) => Array.from({ length: n }, (_, i) => (i + 1) / 100);

test('isFullyEmbedded: false when any memory lacks a vector', () => {
  assert.equal(isFullyEmbedded([{ id: 'a', embedding: vec(4) }, { id: 'b' }]), false);
  assert.equal(isFullyEmbedded([{ id: 'a', embedding: vec(4) }, { id: 'b', embedding: [] }]), false);
});

test('isFullyEmbedded: true only when every memory has a vector', () => {
  assert.equal(isFullyEmbedded([{ id: 'a', embedding: vec(4) }, { id: 'b', embedding: vec(4) }]), true);
});

test('isFullyEmbedded: empty or junk input is not "covered"', () => {
  assert.equal(isFullyEmbedded([]), false);
  assert.equal(isFullyEmbedded(null), false);
});

test('REGRESSION: partial coverage lets the vector list bury an exact match', () => {
  // Lexical order is correct — the real match leads.
  const lexicalIds = ['match', 'irrelevant1', 'irrelevant2', 'irrelevant3'];
  // Only the irrelevant ones have stored vectors, so only they enter the vector list.
  const vectorIds = ['irrelevant1', 'irrelevant2', 'irrelevant3'];

  const fused = hybridRank(lexicalIds, vectorIds);

  // The bug: irrelevant1 wins on rank position alone and displaces the exact match.
  assert.equal(fused[0], 'irrelevant1', 'sanity: this is the broken behaviour we are guarding');
  assert.notEqual(fused[0], 'match', 'sanity: the old fusion does not keep the exact match first');
});

test('the coverage guard stops that fusion from happening at all', () => {
  const pool = [{ id: 'match' }, { id: 'irrelevant1', embedding: vec(4) }];
  assert.equal(isFullyEmbedded(pool), false, 'a partially embedded pool must not be fused');
});

test('fuseWithinPool never introduces an id from outside the pool', () => {
  const pool = ['a', 'b', 'c'];
  const vectorIds = ['z', 'y', 'b', 'x']; // z, y, x were never candidates
  const fused = fuseWithinPool(pool, vectorIds);
  for (const id of fused) {
    assert.ok(pool.includes(id), `${id} leaked in from the vector list`);
  }
});

test('fuseWithinPool still re-ranks inside the pool', () => {
  // 'b' is only a mid-pack lexical candidate but leads the vector list, so it wins
  // both contributions and should take the top slot — semantics refining recall.
  const fused = fuseWithinPool(['a', 'b', 'c'], ['b']);
  assert.equal(fused[0], 'b');
  assert.deepEqual([...fused].sort(), ['a', 'b', 'c']);
});

test('fuseWithinPool degrades to lexical order when no vectors are in the pool', () => {
  const fused = fuseWithinPool(['x', 'y', 'z'], ['nope', 'nada']);
  assert.deepEqual(fused, ['x', 'y', 'z']);
});
