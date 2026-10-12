/**
 * Hybrid retrieval — fuse lexical and semantic (embedding) rankings.
 *
 * WHY
 * ---
 * Lexical retrieval scores memory candidates by token overlap, entity match, substring
 * match, and importance/recency heuristics. Semantic retrieval scores them by cosine
 * distance between the query embedding and each memory's stored embedding. Neither wins
 * alone:
 *   - lexical excels at exact-ish matches (IDs, names, exact phrases) but misses paraphrase;
 *   - semantic excels at paraphrase but can surface "about-the-same-topic" memories that
 *     are not actually relevant, and it is blind to exact token hits (a verbatim phrase
 *     may rank below a thematically similar one).
 * Fusing both with Reciprocal Rank Fusion (RRF) lets each list vote by rank, which is
 * order-only and therefore robust to the two scorers' wildly different scales (a lexical
 * score is 0–~100; a cosine is -1–1 — you cannot average them, but you can fuse their
 * ranks).
 *
 * WHY RRF OVER SCORE NORMALIZATION
 * --------------------------------
 * RRF uses only each list's ordering, never the raw score magnitudes. That sidesteps the
 * entire problem of calibrating two incomparable scoring functions, and it is the same
 * technique the competitors (MemoryPlugin, MemoryLake) use for their hybrid retrieval.
 *
 * PURE / DEPENDENCY-FREE
 * ----------------------
 * No imports beyond nothing. Testable with `node --test` exactly like lib/beta.js and
 * lib/memory-crypto.js. It never calls the network and never touches the DB.
 *
 * ENCRYPTION NOTE
 * ---------------
 * Vectors arrive here already decrypted-in-effect: `content` is decrypted on read, and a
 * memory's `embedding` is stored plaintext (see memory-embedding.js). This module only
 * sees the `embedding` array and never the ciphertext.
 */

/**
 * Cosine similarity between two equal-length vectors. Range [-1, 1]; 1 = identical
 * direction. Returns 0 for any malformed input so a bad vector can never crash retrieval.
 *
 * @param {number[]|null|undefined} a
 * @param {number[]|null|undefined} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Reciprocal Rank Fusion. Each list is an ordered array of ids, best first. Every item
 * contributes 1/(k + rank) from each list that contains it; items are returned best-first.
 * Items missing from a list simply get no contribution from it (correct: a memory with no
 * embedding should still be reachable by its lexical rank).
 *
 * @param {Array<Array<string|number>>} lists  one ordered id list per retriever
 * @param {number} [k]                         RRF constant, default 60 (the common default)
 * @returns {Array<string|number>} fused ids, best first
 */
export function reciprocalRankFusion(lists, k = 60) {
  const scores = new Map();
  for (const list of lists) {
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      scores.set(id, (scores.get(id) || 0) + 1 / (k + i + 1));
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

/**
 * Rank memories by cosine similarity to a query embedding, best first. Memories without
 * an `embedding` are skipped (they cannot participate in semantic ranking).
 *
 * @param {number[]|null} queryEmbedding
 * @param {Array<{id: *, embedding: number[]}>} memories
 * @returns {Array<*>} memory ids, best-first by cosine
 */
export function rankByEmbedding(queryEmbedding, memories) {
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];
  return memories
    .filter((m) => Array.isArray(m?.embedding) && m.embedding.length > 0)
    .map((m) => ({ id: m.id, cos: cosineSimilarity(queryEmbedding, m.embedding) }))
    .sort((a, b) => b.cos - a.cos)
    .map((x) => x.id);
}

/**
 * Fuse a lexical id list and a semantic id list into one hybrid ordering.
 *
 * @param {Array<*>} lexicalIds  already ranked best-first (e.g. from matchMemories)
 * @param {Array<*>} vectorIds   already ranked best-first (e.g. from rankByEmbedding)
 * @param {number} [k]           RRF constant
 * @returns {Array<*>} fused ids, best first
 */
export function hybridRank(lexicalIds, vectorIds, k = 60) {
  const lists = [];
  if (Array.isArray(lexicalIds) && lexicalIds.length > 0) lists.push(lexicalIds);
  if (Array.isArray(vectorIds) && vectorIds.length > 0) lists.push(vectorIds);
  if (lists.length === 0) return [];
  return reciprocalRankFusion(lists, k);
}
