/**
 * Prompt Cache — Simple in-memory TTL cache for system prompts.
 *
 * System prompts are expensive to build (they aggregate memories, profiles,
 * assessments, etc.). This cache stores built prompts per-user with a
 * configurable TTL so they don't need to be rebuilt on every message.
 *
 * Zero dependencies. Pure JavaScript.
 */

export class PromptCache {
  /**
   * @param {object} [options]
   * @param {number} [options.ttlMs=300000] - Time-to-live in milliseconds (default: 5 minutes)
   * @param {number} [options.maxEntries=1000] - Maximum cached entries before LRU eviction
   */
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 5 * 60 * 1000; // 5 minutes default
    this.maxEntries = options.maxEntries || 1000;
    this._cache = new Map(); // key → { value, ts, accessTs }
  }

  /**
   * Get a cached value if it exists and hasn't expired.
   *
   * @param {string} key - Usually a userId
   * @returns {string | null}
   */
  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.ts > this.ttlMs) {
      this._cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.accessTs = Date.now();
    return entry.value;
  }

  /**
   * Store a value in the cache.
   *
   * @param {string} key
   * @param {string} value
   */
  set(key, value) {
    // Enforce max entries — evict least recently accessed
    if (this._cache.size >= this.maxEntries && !this._cache.has(key)) {
      let oldestKey = null;
      let oldestAccess = Infinity;
      for (const [k, v] of this._cache) {
        if (v.accessTs < oldestAccess) {
          oldestAccess = v.accessTs;
          oldestKey = k;
        }
      }
      if (oldestKey) this._cache.delete(oldestKey);
    }

    this._cache.set(key, {
      value,
      ts: Date.now(),
      accessTs: Date.now(),
    });
  }

  /**
   * Invalidate a specific user's cached prompt.
   * Call this when memories, profile, or assessment data changes.
   *
   * @param {string} [key] - If omitted, clears entire cache
   */
  invalidate(key) {
    if (key) {
      this._cache.delete(key);
    } else {
      this._cache.clear();
    }
  }

  /**
   * Check if a key exists and is still valid.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Get the number of cached entries.
   * @returns {number}
   */
  get size() {
    return this._cache.size;
  }
}
