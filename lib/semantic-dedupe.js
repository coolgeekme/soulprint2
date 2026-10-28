// Semantic dedupe — is this memory something we already know?
//
// The exact-match gate in lib/mcp/dedupe.js hashes the literal text, so it only catches
// a repeat word-for-word. Natural language paraphrases all pass through: "I live in
// Phoenix", "I'm based in Phoenix" and "lives in Phoenix" hash differently and become
// three records. That is how the store accumulated roughly two thousand memories, most of
// them restatements.
//
// Every memory is already embedded on write and the retrieval path already computes
// cosine similarity over stored embeddings, so this is a lookup against vectors we are
// paying for anyway — not new infrastructure.
//
// Deliberately NOT auto-merging the middle band. Two genuinely different facts can sit at
// 0.85–0.95 ("works at Acme" vs "left Acme"), and collapsing them destroys something the
// user said once. That band is flagged for review instead, which matches the standing
// rule that update and delete require approval while adds do not.

import { cosineSimilarity } from './hybrid-retrieval.js'

/** At or above this, treat the write as the same fact. */
export const DUPLICATE_THRESHOLD = 0.95

/** Between this and DUPLICATE_THRESHOLD, store it but flag it for review. */
export const REVIEW_THRESHOLD = 0.85

/**
 * How many existing memories to compare against, most recent first.
 *
 * Content is encrypted at rest, so a lexical pre-filter is impossible — we cannot regex
 * the ciphertext. Candidate selection therefore has to be recency-bounded, which means a
 * near-duplicate of a very old memory can slip past this gate. The batch audit
 * (lib/handlers/memory-cleanup.js) is what covers that long tail; this gate's job is to
 * stop NEW duplicates, and new facts are overwhelmingly compared against recent ones.
 */
export const CANDIDATE_LIMIT = 5000

/**
 * Find the closest existing memory to `embedding`.
 *
 * @returns {Promise<null|{memory: object, score: number, verdict: 'duplicate'|'review'|'distinct'}>}
 *   null when there is nothing to compare against (no embedding, or no stored memories)
 */
export async function findSemanticMatch(db, userId, embedding, { excludeId = null } = {}) {
  if (!userId) throw new Error('findSemanticMatch requires a userId')
  if (!Array.isArray(embedding) || embedding.length === 0) return null

  const candidates = await db
    .collection('user_memories')
    .find(
      {
        user_id: userId,
        // Superseded rows are history, not current truth — never merge into them.
        review_state: { $ne: 'superseded' },
        embedding: { $exists: true, $ne: null },
      },
      {
        projection: {
          id: 1,
          embedding: 1,
          content_hash: 1,
          category: 1,
          reinforced_count: 1,
          review_state: 1,
          created_at: 1,
        },
      },
    )
    .sort({ created_at: -1 })
    .limit(CANDIDATE_LIMIT)
    .toArray()

  let best = null
  for (const candidate of candidates) {
    if (excludeId && candidate.id === excludeId) continue
    if (!Array.isArray(candidate.embedding) || candidate.embedding.length === 0) continue
    const score = cosineSimilarity(embedding, candidate.embedding)
    if (!Number.isFinite(score)) continue
    if (!best || score > best.score) best = { memory: candidate, score }
  }

  if (!best) return null

  const verdict =
    best.score >= DUPLICATE_THRESHOLD
      ? 'duplicate'
      : best.score >= REVIEW_THRESHOLD
        ? 'review'
        : 'distinct'

  return { ...best, verdict }
}
