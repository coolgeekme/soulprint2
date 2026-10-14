/**
 * Runs once at server startup. Fires an idempotent, non-blocking backfill that embeds
 * any memory still missing a vector (see lib/backfill-embeddings.js).
 *
 * Non-blocking by design: boot must never wait on — or fail from — an embedding
 * backfill. The work runs in the background and logs its own result under `[backfill]`.
 */
export function register() {
  runBackfill().catch((e) => console.warn('[backfill] embeddings skipped:', e.message));
}

async function runBackfill() {
  const { getDb } = await import('@/lib/mongodb');
  const { backfillEmbeddings } = await import('@/lib/backfill-embeddings');
  const db = await getDb();
  const stats = await backfillEmbeddings(db);
  console.log(`[backfill] embeddings done: ${JSON.stringify(stats)}`);
}
