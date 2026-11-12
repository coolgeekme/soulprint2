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
 * Runs in BOUNDED CHUNKS. A whole-store run is one embedding call per memory and can take
 * the better part of an hour on an established account; doing it inside a single HTTP request
 * means the request times out, the connection drops, and the work is invisible either way.
 * With a limit the caller can drive it in slices and watch progress, and because the query
 * only selects rows still missing a vector, each slice picks up exactly where the last stopped.
 *
 * @param {import('mongodb').Db} db
 * @param {{limit?: number}} [options]  rows to scan this run (Infinity = drain everything)
 * @returns {Promise<{scanned: number, embedded: number, skipped: number, remaining: number|null}>}
 */
export async function backfillEmbeddings(db, { limit = Infinity } = {}) {
  const coll = db.collection('user_memories');

  const cursor = coll.find(
    { $or: [{ embedding: { $exists: false } }, { embedding: null }] },
    { projection: { id: 1, user_id: 1, content: 1 } },
  );

  const stats = { scanned: 0, embedded: 0, skipped: 0 };
  let batch = [];

  for await (const doc of cursor) {
    if (stats.scanned >= limit) break;
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

  // How much work is left. This is what tells a driver loop whether to call again — the
  // alternative is guessing from a timeout, which is how a half-migrated index looks fine.
  let remaining = null;
  try {
    remaining = await coll.countDocuments({
      $or: [{ embedding: { $exists: false } }, { embedding: null }],
    });
  } catch { /* not fatal — the caller just cannot know the remaining count */ }

  return { ...stats, remaining };
}
