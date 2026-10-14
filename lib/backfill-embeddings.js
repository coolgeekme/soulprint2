/**
 * One-shot, idempotent backfill: embed every memory that still lacks a vector.
 *
 * WHY IT EXISTS SEPARATELY
 * ------------------------
 * The semantic-hybrid wiring embeds memories on WRITE, but every memory created before
 * that commit has no `embedding` and therefore can only participate in lexical (not
 * semantic) ranking until it is re-embedded. This backfills those older rows.
 *
 * DESIGN
 * ------
 * - Idempotent and safe to re-run: it only touches documents where `embedding` is
 *   missing or null, so a partial run (pod restart) resumes cleanly on the next boot
 *   and an already-complete run is a cheap no-op.
 * - Soft-fail: if embedding is unavailable (no key / API failure) a memory is simply
 *   skipped, never altered. Semantic retrieval already degrades to lexical when a
 *   vector is absent, so this module can only ADD coverage — it can never take recall
 *   down or corrupt a row.
 * - Content is decrypted per-document via the same `decryptMemoryDoc` the read path
 *   uses, so it handles both legacy plaintext and `enc:v1:` ciphertext. Unreadable
 *   records are skipped, not written.
 * - Batched bulk writes keep the write amplification low on a large collection.
 */
import { embedForWrite } from './memory-embedding.js';
import { decryptMemoryDoc } from './memory-crypto.js';

const BATCH_SIZE = 100;

/**
 * Embed any memory in `user_memories` that lacks a vector.
 *
 * @param {import('mongodb').Db} db
 * @returns {Promise<{scanned: number, embedded: number, skipped: number}>}
 */
export async function backfillEmbeddings(db) {
  const coll = db.collection('user_memories');

  const cursor = coll.find(
    { $or: [{ embedding: { $exists: false } }, { embedding: null }] },
    { projection: { id: 1, user_id: 1, content: 1 } },
  );

  const stats = { scanned: 0, embedded: 0, skipped: 0 };
  let batch = [];

  for await (const doc of cursor) {
    stats.scanned += 1;

    const dec = decryptMemoryDoc(doc);
    if (dec.unreadable || !dec.content) {
      stats.skipped += 1;
      continue;
    }

    const { embedding } = await embedForWrite(dec.content);
    if (!embedding) {
      stats.skipped += 1; // embedding offline — soft-fail, lexical still works
      continue;
    }

    batch.push({
      updateOne: {
        filter: { id: doc.id, user_id: doc.user_id },
        update: { $set: { embedding } },
      },
    });
    stats.embedded += 1;

    if (batch.length >= BATCH_SIZE) {
      await coll.bulkWrite(batch);
      batch = [];
    }
  }

  if (batch.length) await coll.bulkWrite(batch);

  return stats;
}
