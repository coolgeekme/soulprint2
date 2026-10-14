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
