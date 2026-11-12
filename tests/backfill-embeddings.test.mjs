import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backfillEmbeddings } from '../lib/backfill-embeddings.js';

function makeDb(docs) {
  const writes = [];
  const coll = {
    find(_query, _projection) {
      return (async function* () {
        for (const d of docs) yield d;
      })();
    },
    async bulkWrite(batch) {
      writes.push(...batch);
      return { insertedCount: batch.length };
    },
  };
  const db = {
    collection: (name) => {
      assert.equal(name, 'user_memories');
      return coll;
    },
  };
  return { db, writes };
}

test('backfill: embeds plaintext memories missing a vector, skips unreadable/empty', async () => {
  const { db, writes } = makeDb([
    { id: 'm1', user_id: 'u1', content: 'Likes black coffee' },
    { id: 'm2', user_id: 'u1', content: 'enc:v1:corrupt' }, // ciphertext, no key → unreadable
    { id: 'm3', user_id: 'u2', content: 'Has two kids' },
  ]);

  process.env.OPENAI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
  });

  try {
    const stats = await backfillEmbeddings(db);
    assert.equal(stats.scanned, 3);
    assert.equal(stats.embedded, 2);
    assert.equal(stats.skipped, 1);

    assert.equal(writes.length, 2);
    const updated = writes.map((w) => w.updateOne.filter.id).sort();
    assert.deepEqual(updated, ['m1', 'm3']);
    for (const w of writes) {
      assert.ok(Array.isArray(w.updateOne.update.$set.embedding));
      assert.equal(w.updateOne.update.$set.embedding.length, 3);
    }
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test('backfill: no-op on an empty collection', async () => {
  const { db, writes } = makeDb([]);
  const stats = await backfillEmbeddings(db);
  assert.equal(stats.scanned, 0);
  assert.equal(stats.embedded, 0);
  assert.equal(writes.length, 0);
});

// ── bounded, resumable runs ────────────────────────────────────────────────
// A whole-store run is one embedding call per memory and can take most of an hour. Driving it
// inside a single HTTP request means the request times out and the work becomes invisible, so
// the caller runs it in slices and loops on `remaining`.

function makeChunkedDb(docs, remainingAfter) {
  const writes = [];
  const coll = {
    find: () => (async function* () { for (const d of docs) yield d; })(),
    async bulkWrite(batch) { writes.push(...batch); return { insertedCount: batch.length }; },
    async countDocuments() { return remainingAfter; },
  };
  return { db: { collection: () => coll }, writes };
}

test('backfill: limit stops the run early', async () => {
  const docs = Array.from({ length: 5 }, (_, i) => ({ id: 'm' + i, user_id: 'u1', content: 'fact ' + i }));
  const { db, writes } = makeChunkedDb(docs, 3);

  process.env.OPENAI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [{ embedding: [1, 0] }] }) });
  try {
    const stats = await backfillEmbeddings(db, { limit: 2 });
    assert.equal(stats.scanned, 2, 'must stop at the limit, not drain the collection');
    assert.equal(stats.embedded, 2);
    assert.equal(writes.length, 2);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test('backfill: reports how much work remains so a driver knows when to stop', async () => {
  const { db } = makeChunkedDb([{ id: 'm1', user_id: 'u1', content: 'one' }], 17);

  process.env.OPENAI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [{ embedding: [1, 0] }] }) });
  try {
    const stats = await backfillEmbeddings(db, { limit: 10 });
    assert.equal(stats.remaining, 17, 'remaining drives the loop; without it the caller guesses');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test('backfill: a failed countDocuments does not fail the run', async () => {
  const writes = [];
  const coll = {
    find: () => (async function* () { yield { id: 'm1', user_id: 'u1', content: 'one' }; })(),
    async bulkWrite(b) { writes.push(...b); },
    async countDocuments() { throw new Error('db hiccup'); },
  };
  process.env.OPENAI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [{ embedding: [1, 0] }] }) });
  try {
    const stats = await backfillEmbeddings({ collection: () => coll }, { limit: 5 });
    assert.equal(stats.embedded, 1);
    assert.equal(stats.remaining, null, 'unknown is honest; the work still happened');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  }
});
