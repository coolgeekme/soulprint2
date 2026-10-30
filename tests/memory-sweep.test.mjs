/**
 * Batch sweep.
 *
 * The behaviour under test is the one a lifecycle hook depends on: send every fact worth
 * keeping in one call and get a truthful account of what happened to each. A hook fires once
 * and cannot retry, so "one bad item aborts the batch" or "the totals lie" are the two
 * failure modes that matter.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { sweepMemories, MAX_SWEEP_ITEMS } from '../lib/memory-sweep.js';
import { DUPLICATE_THRESHOLD, REVIEW_THRESHOLD } from '../lib/semantic-dedupe.js';

// ── minimal Mongo stand-in (same shape as the write-gate tests) ────────────

function makeDb(seed = []) {
  const rows = seed.map((r) => ({ ...r }));
  const matches = (doc, filter = {}) => {
    for (const [k, v] of Object.entries(filter)) {
      if (k === '$or') {
        if (!v.some((c) => matches(doc, c))) return false;
      } else if (v && typeof v === 'object' && '$ne' in v) {
        if (doc[k] === v.$ne) return false;
      } else if (doc[k] !== v) {
        return false;
      }
    }
    return true;
  };
  const col = {
    find(filter) {
      let out = rows.filter((r) => matches(r, filter));
      const api = {
        sort(spec) {
          out = out.slice().sort((a, b) => {
            for (const [k, dir] of Object.entries(spec)) {
              const av = a[k] instanceof Date ? a[k].getTime() : a[k];
              const bv = b[k] instanceof Date ? b[k].getTime() : b[k];
              if (av === bv) continue;
              return (av < bv ? -1 : 1) * dir;
            }
            return 0;
          });
          return api;
        },
        limit(n) { out = out.slice(0, n); return api; },
        async toArray() { return out.map((r) => ({ ...r })); },
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
  return { collection: () => col, _rows: rows };
}

const vec = (...parts) => {
  const v = new Array(8).fill(0);
  parts.forEach((p, i) => { v[i] = p; });
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

/**
 * Deterministic pseudo-embedding from the text itself.
 *
 * The first version of this fixture returned `vec(1)` for every unknown string, which made
 * every item in a batch look identical and turned "save these two facts" into
 * "save one, reinforce it". A fixture that collapses distinct inputs is not a neutral
 * default — it silently asserts the opposite of what the test claims.
 */
function hashVec(text, dims = 8) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const v = [];
  for (let i = 0; i < dims; i += 1) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    v.push(((h >>> 0) % 2000) - 1000);
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

// Distinct text gets a distinct vector, so items only collide when a test says they do.
function embedderFor(map = {}) {
  return async (text) => ({ embedding: map[text] ?? hashVec(text) });
}

// ── happy path ─────────────────────────────────────────────────────────────

test('saves every item in one call', async () => {
  const db = makeDb([]);
  const out = await sweepMemories(db, 'u1', ['Lives in Phoenix', 'Works at Acme'], {
    embedImpl: embedderFor(),
  });
  assert.equal(out.received, 2);
  assert.equal(out.processed, 2);
  assert.equal(out.inserted, 2);
  assert.equal(out.skipped, 0);
  assert.equal(db._rows.length, 2);
});

test('accepts bare strings and full objects in the same batch', async () => {
  const db = makeDb([]);
  const out = await sweepMemories(db, 'u1', [
    'plain string fact',
    { content: 'object fact', category: 'work', importance: 'high' },
  ], { embedImpl: embedderFor() });
  assert.equal(out.inserted, 2);
  const obj = out.results.find((r) => r.content === 'object fact');
  assert.equal(obj.action, 'inserted');
});

test('every result carries an action so a caller can report honestly', async () => {
  const db = makeDb([]);
  const out = await sweepMemories(db, 'u1', ['one fact here'], { embedImpl: embedderFor() });
  assert.equal(out.results.length, 1);
  assert.ok(['inserted', 'reinforced', 'flagged'].includes(out.results[0].action));
  assert.ok(out.results[0].id, 'result should point at the stored row');
});

// ── the gate is actually applied ───────────────────────────────────────────

test('a repeat inside one batch reinforces instead of duplicating', async () => {
  const db = makeDb([]);
  const out = await sweepMemories(db, 'u1', ['Lives in Phoenix', 'Lives in Phoenix'], {
    embedImpl: embedderFor(),
  });
  assert.equal(out.inserted, 1);
  assert.equal(out.reinforced, 1);
  assert.equal(db._rows.length, 1, 'the batch must not write two rows for one fact');
});

test('an ambiguous near-miss is flagged, not merged', async () => {
  const near = new Array(8).fill(0);
  const t = 0.9;
  near[0] = t; near[1] = Math.sqrt(1 - t * t);
  const db = makeDb([]);
  const out = await sweepMemories(db, 'u1', ['Works at Acme', 'Left Acme in June'], {
    embedImpl: embedderFor({ 'Works at Acme': vec(1), 'Left Acme in June': near }),
  });
  assert.equal(out.inserted, 1);
  assert.equal(out.flagged, 1);
  assert.equal(db._rows.length, 2, 'a flagged fact is still stored');
});

// ── degradation ────────────────────────────────────────────────────────────

test('one unusable item does not abort the rest of the batch', async () => {
  const db = makeDb([]);
  const out = await sweepMemories(db, 'u1', ['ok fact one', '', 'ok fact two'], {
    embedImpl: embedderFor(),
  });
  assert.equal(out.inserted, 2, 'the good items still land');
  assert.equal(out.skipped, 1);
  assert.equal(db._rows.length, 2);
});

test('items with no usable content are skipped, not thrown', async () => {
  const db = makeDb([]);
  const out = await sweepMemories(db, 'u1', [null, 42, {}, { content: '   ' }], {
    embedImpl: embedderFor(),
  });
  assert.equal(out.skipped, 4);
  assert.equal(out.inserted, 0);
  assert.equal(db._rows.length, 0);
});

test('a failing embed fails only its own item', async () => {
  const db = makeDb([]);
  let n = 0;
  const flaky = async (text) => {
    n += 1;
    if (n === 2) throw new Error('embedding service unavailable');
    return { embedding: hashVec(text) };
  };
  const out = await sweepMemories(db, 'u1', ['first fact', 'second fact', 'third fact'], {
    embedImpl: flaky,
  });
  assert.equal(out.skipped, 1, 'the failed item is counted as skipped');
  assert.equal(out.inserted, 2, 'its neighbours still save');
  assert.ok(out.results.some((r) => r.action === 'failed'));
});

// ── bounds ─────────────────────────────────────────────────────────────────

test('a huge batch is capped and says so', async () => {
  const db = makeDb([]);
  const many = Array.from({ length: MAX_SWEEP_ITEMS + 25 }, (_, i) => `distinct fact number ${i}`);
  const out = await sweepMemories(db, 'u1', many, { embedImpl: embedderFor() });
  assert.equal(out.received, MAX_SWEEP_ITEMS + 25);
  assert.equal(out.processed, MAX_SWEEP_ITEMS);
  assert.equal(out.truncated, true, 'silently dropping items is the failure this prevents');
});

test('a batch at the cap is not reported as truncated', async () => {
  const db = makeDb([]);
  const many = Array.from({ length: MAX_SWEEP_ITEMS }, (_, i) => `distinct fact number ${i}`);
  const out = await sweepMemories(db, 'u1', many, { embedImpl: embedderFor() });
  assert.equal(out.truncated, false);
});

test('rejects a non-array and a missing user', async () => {
  const db = makeDb([]);
  await assert.rejects(() => sweepMemories(db, 'u1', 'not an array'), /must be an array/);
  await assert.rejects(() => sweepMemories(db, null, []), /requires a userId/);
});

test('an empty batch is a no-op, not an error', async () => {
  const db = makeDb([]);
  const out = await sweepMemories(db, 'u1', [], { embedImpl: embedderFor() });
  assert.equal(out.received, 0);
  assert.equal(out.inserted, 0);
});

// ── the thresholds it inherits ─────────────────────────────────────────────

test('the sweep uses the same thresholds as the write gate', () => {
  // If these drift, the MCP tool and the REST mirror would disagree about duplicates.
  assert.ok(DUPLICATE_THRESHOLD > REVIEW_THRESHOLD);
  assert.ok(DUPLICATE_THRESHOLD <= 1 && REVIEW_THRESHOLD > 0);
});
