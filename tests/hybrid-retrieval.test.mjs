import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cosineSimilarity,
  reciprocalRankFusion,
  rankByEmbedding,
  hybridRank,
} from '../lib/hybrid-retrieval.js';

// ── cosineSimilarity ──────────────────────────────────────────────────────────

test('cosine: identical vectors are 1', () => {
  assert.equal(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1);
});

test('cosine: orthogonal vectors are 0', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
});

test('cosine: opposite vectors are -1', () => {
  assert.equal(cosineSimilarity([2, 0], [-2, 0]), -1);
});

test('cosine: malformed inputs return 0, never throw', () => {
  assert.equal(cosineSimilarity(null, [1, 2]), 0);
  assert.equal(cosineSimilarity([1, 2], undefined), 0);
  assert.equal(cosineSimilarity([], []), 0);
  assert.equal(cosineSimilarity([1], [1, 2]), 0); // length mismatch
});

test('cosine: close vectors beat distant vectors', () => {
  const q = [1, 0, 0];
  const near = cosineSimilarity(q, [1, 0.2, 0]);
  const far = cosineSimilarity(q, [0, 1, 0]);
  assert.ok(near > far);
});

// ── reciprocalRankFusion ──────────────────────────────────────────────────────

test('rrf: a single list returns its own order', () => {
  assert.deepEqual(reciprocalRankFusion([['a', 'b', 'c']]), ['a', 'b', 'c']);
});

test('rrf: consistently-high ranks win over one-hit-wonders', () => {
  // A: #1 and #2. C: #3 and #1. B: #2 and #3.
  // A is near the top of both lists, so it must win; B is lowest on both, so it loses.
  const fused = reciprocalRankFusion([
    ['a', 'b', 'c'],
    ['c', 'a', 'b'],
  ]);
  assert.equal(fused[0], 'a');
  assert.equal(fused[2], 'b');
});

test('rrf: an item present in only one list still appears', () => {
  const fused = reciprocalRankFusion([['a', 'b'], ['c']]);
  assert.deepEqual(new Set(fused), new Set(['a', 'b', 'c']));
});

test('rrf: empty list input yields empty output', () => {
  assert.deepEqual(reciprocalRankFusion([]), []);
});

// ── rankByEmbedding ───────────────────────────────────────────────────────────

test('rankByEmbedding: best cosine first, skips unembedded memories', () => {
  const q = [1, 0];
  const memories = [
    { id: 'far', embedding: [0, 1] },
    { id: 'no-embedding' },            // skipped
    { id: 'near', embedding: [1, 0.1] },
    { id: 'exact', embedding: [1, 0] },
  ];
  const ranked = rankByEmbedding(q, memories);
  assert.deepEqual(ranked, ['exact', 'near', 'far']);
});

test('rankByEmbedding: null query returns empty', () => {
  assert.deepEqual(rankByEmbedding(null, [{ id: 'x', embedding: [1] }]), []);
});

// ── hybridRank ────────────────────────────────────────────────────────────────

test('hybridRank: a memory top of both lists wins outright', () => {
  // lexical says A first; semantic says A first → A must be first fused.
  const fused = hybridRank(['a', 'b', 'c'], ['a', 'c', 'b']);
  assert.equal(fused[0], 'a');
});

test('hybridRank: degrades to lexical-only when no vector list', () => {
  assert.deepEqual(hybridRank(['a', 'b', 'c'], []), ['a', 'b', 'c']);
});

test('hybridRank: degrades to vector-only when no lexical list', () => {
  assert.deepEqual(hybridRank([], ['x', 'y']), ['x', 'y']);
});

test('hybridRank: both empty returns empty', () => {
  assert.deepEqual(hybridRank([], []), []);
});

// ── the scenario this whole feature exists for ────────────────────────────────

test('semantic rank surfaces a paraphrase the lexical rank would miss', () => {
  // Query asks about "my daughter's school start time". One memory stores the fact
  // using the school's proper name (Giovanna / Las Brisas) with no token overlap to
  // the query — lexical alone would bury it. Its embedding is nearest the query, and
  // a semantically *unrelated* memory (gym) is farthest, not second.
  const queryEmbedding = [1, 0];
  const schoolFact = { id: 'school', embedding: [0.9, 0.1] }; // paraphrase, nearest
  const workFact = { id: 'work', embedding: [0.6, 0.5] };
  const carFact = { id: 'car', embedding: [0.3, 0.8] };
  const gymFact = { id: 'gym', embedding: [0, 1] };           // unrelated, farthest

  // Lexical ranking (wrong: a shared token with the gym memory puts it first).
  const lexicalIds = ['gym', 'school', 'work', 'car'];
  // Semantic ranking (right).
  const vectorIds = rankByEmbedding(queryEmbedding, [schoolFact, workFact, carFact, gymFact]);
  assert.deepEqual(vectorIds, ['school', 'work', 'car', 'gym']);

  // Fused: 'school' is #1 semantically and #2 lexically, so it wins; 'gym' is #1
  // lexically but *last* semantically, so fusion demotes it below 'school'.
  const fused = hybridRank(lexicalIds, vectorIds);
  assert.equal(fused[0], 'school');
  assert.ok(fused.indexOf('school') < fused.indexOf('gym'));
});
// ── whole-store semantic retrieval ──────────────────────────────────────────
// Imported from the pure library rather than the handler: handlers.js uses the '@/lib'
// alias, which only resolves inside the Next bundler, not under node --test.
import { rankVectorHits, fuseLexicalAndVector, MIN_VECTOR_SIMILARITY } from '../lib/hybrid-retrieval.js';
import { matchMemories } from '../lib/mcp/memory-engine.js';

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const QUERY_VEC = [1, 0, 0];

const business = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: 'biz-' + i,
    content: `Practice management advisory for oral surgery group ${i} in metro area ${i}.`,
    importance: 'medium',
    created_at: daysAgo(1),
    embedding: [0, 1, 0],   // orthogonal to the query
  }));

function retrieve(prompt, memories, maxMemories = 5) {
  const lexical = matchMemories(prompt, memories, memories.length || 1);
  const vectorHits = rankVectorHits(QUERY_VEC, memories);
  return fuseLexicalAndVector({
    lexicalIds: lexical.map((m) => m.memory.id),
    lexicalScores: new Map(lexical.map((m) => [m.memory.id, m.score])),
    vectorHits,
    memories,
    maxMemories,
  });
}

test('the similarity floor is a real number, not a formality', () => {
  assert.ok(MIN_VECTOR_SIMILARITY > 0.2 && MIN_VECTOR_SIMILARITY < 0.6);
});

test('a vector-only match is retrieved with zero keyword overlap', () => {
  const memories = [
    ...business(10),
    { id: 'dogs', content: 'Ouzo and Skyy are the two here.', importance: 'medium',
      created_at: daysAgo(300), embedding: [1, 0, 0] },
  ];
  const ids = retrieve('what are the names of my animals?', memories).map((m) => m.memory.id);
  assert.ok(ids.includes('dogs'), `semantic match must surface; got ${ids.join(',')}`);
});

test('a weak vector match stays out', () => {
  const memories = [
    ...business(10),
    { id: 'weak', content: 'Quarterly partner review covers regional expansion planning.',
      importance: 'medium', created_at: daysAgo(1), embedding: [0.15, 0.99, 0] },
  ];
  const ids = retrieve('what are the names of my animals?', memories).map((m) => m.memory.id);
  assert.ok(!ids.includes('weak'), 'on-topic-but-weak must not clear the floor');
});

test('an un-embedded memory is still reachable by keyword', () => {
  const memories = [
    ...business(5),
    { id: 'unembedded', content: 'My dogs are Ouzo and Skyy.', importance: 'medium', created_at: daysAgo(300) },
  ];
  const ids = retrieve('what are my dogs called?', memories).map((m) => m.memory.id);
  assert.ok(ids.includes('unembedded'),
    'a row without a vector must not become invisible once other rows have one');
});
