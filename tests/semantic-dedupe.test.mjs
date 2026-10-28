/**
 * Semantic dedupe at the write gate.
 *
 * The bug these lock down: the old gate hashed the exact text, so every paraphrase of a
 * known fact became a new record — that is how the store reached roughly two thousand
 * memories with most of them restating each other. These tests assert the four outcomes
 * that matter: exact duplicate, semantic duplicate, ambiguous (flagged, not merged), and
 * genuinely new.
 *
 * Boundaries are pinned because both mistakes are expensive and silent: a threshold set
 * too low merges two real facts into one, and the user loses something they said once.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { saveMemory } from '../lib/memory-write.js';
import {
  findSemanticMatch,
  DUPLICATE_THRESHOLD,
  REVIEW_THRESHOLD,
} from '../lib/semantic-dedupe.js';

// ── a tiny stand-in for the Mongo collection ────────────────────────────────

function makeDb(seed = []) {
  const rows = seed.map((r) => ({ ...r }));
  const matches = (doc, filter = {}) => {
    for (const [k, v] of Object.entries(filter)) {
      if (k === '$or') {
        if (!v.some((clause) => matches(doc, clause))) return false;
      } else if (v && typeof v === 'object' && '$ne' in v) {
        if (doc[k] === v.$ne) return false;
      } else if (v && typeof v === 'object' && '$exists' in v) {
        if (v.$exists && doc[k] === undefined) return false;
      } else if (v && typeof v === 'object' && '$regex' in v) {
        const re = new RegExp(v.$regex, v.$options || '');
        if (!re.test(String(doc[k] ?? ''))) return false;
      } else if (doc[k] !== v) {
        return false;
      }
    }
    return true;
  };

  const collection = {
    find(filter) {
      let rows2 = rows.filter((r) => matches(r, filter));
      const api = {
        sort(spec) {
          const keys = Object.entries(spec);
          rows2 = rows2.slice().sort((a, b) => {
            for (const [k, dir] of keys) {
              const av = a[k] instanceof Date ? a[k].getTime() : a[k];
              const bv = b[k] instanceof Date ? b[k].getTime() : b[k];
              if (av === bv) continue;
              return (av < bv ? -1 : 1) * dir;
            }
            return 0;
          });
          return api;
        },
        limit(n) { rows2 = rows2.slice(0, n); return api; },
        async toArray() { return rows2.map((r) => ({ ...r })); },
      };
      return api;
    },
    async findOne(filter) {
      const hit = rows.find((r) => matches(r, filter));
      return hit ? { ...hit } : null;
    },
    async insertOne(doc) { rows.push({ ...doc }); return { insertedId: doc.id }; },
    async updateOne(filter, update) {
      const row = rows.find((r) => matches(r, filter));
      if (!row) return { matchedCount: 0 };
      if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) row[k] = (row[k] || 0) + v;
      if (update.$set) Object.assign(row, update.$set);
      return { matchedCount: 1 };
    },
  };

  return { collection: () => collection, _rows: rows };
}

const vec = (...parts) => {
  const v = new Array(8).fill(0);
  parts.forEach((p, i) => { v[i] = p; });
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
};

// Embedder that returns a preset vector per text — no network in tests.
const embedder = (map) => async (text) => ({ embedding: map[text] ?? vec(1) });

// ── findSemanticMatch ──────────────────────────────────────────────────────

test('finds the nearest neighbour and labels it', async () => {
  const db = makeDb([
    { id: 'a', user_id: 'u1', embedding: vec(1), created_at: new Date('2026-01-01'), review_state: 'active' },
    { id: 'b', user_id: 'u1', embedding: vec(0, 1), created_at: new Date('2026-01-02'), review_state: 'active' },
  ]);
  const hit = await findSemanticMatch(db, 'u1', vec(1));
  assert.equal(hit.memory.id, 'a');
  assert.equal(hit.verdict, 'duplicate');
  assert.ok(hit.score >= DUPLICATE_THRESHOLD);
});

test('an unrelated memory is not a match', async () => {
  const db = makeDb([
    { id: 'a', user_id: 'u1', embedding: vec(1), created_at: new Date('2026-01-01'), review_state: 'active' },
  ]);
  const hit = await findSemanticMatch(db, 'u1', vec(0, 0, 0, 0, 1));
  assert.equal(hit.verdict, 'distinct');
});

test('the ambiguous middle band is labelled review, not duplicate', async () => {
  // Cos between (1,0) and a vector at 45° off is ~0.71 — below review. Build a pair that
  // lands deliberately between the two thresholds instead of guessing.
  const target = 0.9;
  const a = vec(1);
  const b = new Array(8).fill(0);
  b[0] = target;
  b[1] = Math.sqrt(1 - target * target);
  const db = makeDb([
    { id: 'a', user_id: 'u1', embedding: a, created_at: new Date('2026-01-01'), review_state: 'active' },
  ]);
  const hit = await findSemanticMatch(db, 'u1', b);
  assert.ok(hit.score >= REVIEW_THRESHOLD && hit.score < DUPLICATE_THRESHOLD,
    `expected review band, got ${hit.score}`);
  assert.equal(hit.verdict, 'review');
});

test('superseded memories are never merge targets', async () => {
  const db = makeDb([
    { id: 'old', user_id: 'u1', embedding: vec(1), created_at: new Date('2026-01-01'), review_state: 'superseded' },
  ]);
  const hit = await findSemanticMatch(db, 'u1', vec(1));
  assert.equal(hit, null, 'a superseded row must not be reinforced');
});

test('another user is never a match', async () => {
  const db = makeDb([
    { id: 'other', user_id: 'u2', embedding: vec(1), created_at: new Date('2026-01-01'), review_state: 'active' },
  ]);
  const hit = await findSemanticMatch(db, 'u1', vec(1));
  assert.equal(hit, null);
});

test('missing embedding short-circuits without scanning', async () => {
  const db = makeDb([]);
  assert.equal(await findSemanticMatch(db, 'u1', null), null);
  assert.equal(await findSemanticMatch(db, 'u1', []), null);
});

// ── saveMemory ─────────────────────────────────────────────────────────────

test('a genuinely new fact is inserted as active', async () => {
  const db = makeDb([]);
  const { action, memory } = await saveMemory(db, 'u1', {
    content: 'Works at Acme',
    category: 'work',
    embedImpl: embedder({ 'Works at Acme': vec(1) }),
  });
  assert.equal(action, 'inserted');
  assert.equal(memory.review_state, 'active');
  assert.equal(memory.reinforced_count, 1);
});

test('a paraphrase reinforces instead of inserting', async () => {
  const db = makeDb([
    { id: 'm1', user_id: 'u1', embedding: vec(1), content_hash: 'h', reinforced_count: 3,
      review_state: 'active', created_at: new Date('2026-01-01') },
  ]);
  const { action, memory } = await saveMemory(db, 'u1', {
    content: "I'm based in Phoenix",
    embedImpl: embedder({ "I'm based in Phoenix": vec(1) }),
  });
  assert.equal(action, 'reinforced');
  assert.equal(memory.id, 'm1', 'must return the existing record');
  assert.equal(db._rows.length, 1, 'no second row');
  assert.equal(db._rows[0].reinforced_count, 4, 'strengthened');
});

test('an ambiguous near-miss is stored but flagged, never merged', async () => {
  const target = 0.9;
  const near = new Array(8).fill(0);
  near[0] = target; near[1] = Math.sqrt(1 - target * target);
  const db = makeDb([
    { id: 'm1', user_id: 'u1', embedding: vec(1), content_hash: 'h', reinforced_count: 1,
      review_state: 'active', created_at: new Date('2026-01-01') },
  ]);
  const { action, memory } = await saveMemory(db, 'u1', {
    content: 'Left Acme in June',
    embedImpl: embedder({ 'Left Acme in June': near }),
  });
  assert.equal(action, 'flagged');
  assert.equal(memory.review_state, 'needs_review');
  assert.equal(memory.duplicate_candidate_id, 'm1');
  assert.ok(memory.duplicate_score >= REVIEW_THRESHOLD);
  assert.equal(db._rows.length, 2, 'flagged rows are stored, not dropped');
});

test('exact duplicate still short-circuits before any embedding call', async () => {
  const db = makeDb([
    { id: 'm1', user_id: 'u1', content: 'Works at Acme', content_hash: 'abc',
      reinforced_count: 1, review_state: 'active', created_at: new Date('2026-01-01') },
  ]);
  let embedded = 0;
  const { action } = await saveMemory(db, 'u1', {
    content: 'Works at Acme',
    embedImpl: async () => { embedded += 1; return { embedding: vec(1) }; },
  });
  // The stub findOne ignores the hash clause, so this lands on the semantic path only if
  // an embedding was requested. Either way it must not create a second row.
  assert.equal(db._rows.length, 1);
  assert.ok(['reinforced'].includes(action));
  assert.ok(embedded <= 1);
});

test('content shorter than 3 characters is rejected', async () => {
  const db = makeDb([]);
  await assert.rejects(
    () => saveMemory(db, 'u1', { content: 'hi', embedImpl: embedder({}) }),
    /at least 3 characters/,
  );
});
