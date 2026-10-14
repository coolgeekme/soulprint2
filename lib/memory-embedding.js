/**
 * Memory embeddings — generate vectors for semantic retrieval.
 *
 * WHY THIS EXISTS
 * ---------------
 * The memory matcher is lexical (token overlap + entity/substring/importance heuristics).
 * Lexical matching misses paraphrases: "when does my daughter need to be at school" has
 * no token overlap with "Giovanna starts at Las Brisas at 8:15am", so the memory never
 * surfaces. Embeddings turn both into nearby vectors, so the query finds the memory by
 * meaning rather than by shared words.
 *
 * DESIGN
 * ------
 * - Model: OpenAI `text-embedding-3-small` (1536-dim). Chosen because an OpenAI key is
 *   already configured for the app; no new provider.
 * - Transport: raw `fetch` to the embeddings endpoint, not the OpenAI SDK. Keeps this
 *   module dependency-free and testable (the fetcher is injectable), and avoids coupling
 *   to any specific SDK version's method shape.
 * - In-memory cache keyed on the normalized text: the same fact is never embedded twice
 *   in one process lifetime. Bounded (20k entries) so it cannot grow without limit.
 * - FAILS SOFT: any missing key, non-2xx, malformed body, or thrown error returns null.
 *   Callers treat null as "no vector available" and fall back to lexical retrieval. An
 *   embedding outage must never break memory recall.
 *
 * PRIVACY
 * -------
 * An embedding is derived from the content and must stay comparable to be searchable, so
 * it cannot be encrypted the way `content` is. This is a deliberate tradeoff: the vector
 * leaks information about what a memory is *about* (its meaning) while revealing nothing
 * of the exact words. Flagged to Reggie before this was built.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_ENDPOINT = 'https://api.openai.com/v1/embeddings';
const MAX_CACHE = 20000;

const cache = new Map();

/** Test seam — drop the cache between tests. */
export function _clearEmbeddingCache() {
  cache.clear();
}

/** True when an API key exists, so callers can decide whether to attempt embedding. */
export function embeddingEnabled() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY);
}

/**
 * Embed a string to a vector.
 *
 * @param {string} text         the plaintext to embed
 * @param {Function} [fetcher]  injectable for tests; defaults to global fetch
 * @returns {Promise<number[]|null>} the vector, or null when embedding is unavailable
 */
export async function embedText(text, fetcher = fetch) {
  const key = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
  if (!key) return null;

  const normalized = String(text ?? '').trim();
  if (!normalized) return null;

  if (cache.has(normalized)) return cache.get(normalized);

  try {
    const res = await fetcher(EMBEDDING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: normalized }),
    });

    if (!res.ok) {
      console.warn(`[embedding] HTTP ${res.status} — falling back to lexical`);
      return null;
    }

    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length === 0) {
      console.warn('[embedding] empty/malformed response — falling back to lexical');
      return null;
    }

    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(normalized, vec);
    return vec;
  } catch (e) {
    console.warn('[embedding] failed:', e.message);
    return null;
  }
}

/**
 * Embed a memory's plaintext for storage. Returns `{ embedding }` on success or an
 * empty object when embedding is unavailable (no key / API failure), so callers spread
 * it into the memory document unconditionally and simply omit the field when semantic
 * search is offline. Update paths should reassign `embedding` explicitly (clearing any
 * stale vector) rather than spread, so a failed recompute can't leave an old vector.
 */
export async function embedForWrite(plaintext) {
  const embedding = await embedText(plaintext);
  return embedding ? { embedding } : {};
}
