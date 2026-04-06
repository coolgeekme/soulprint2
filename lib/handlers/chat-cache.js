/**
 * Shared in-memory caches for chat system.
 * Extracted to a separate module so multiple handler modules can share state.
 */

// Per-process caches
const _systemPromptCache = new Map(); // userId → { prompt, ts }
const _chatRateLimitCache = new Map(); // userId → { count, windowStart }

function invalidateSystemPromptCache(userId) {
  if (userId) {
    _systemPromptCache.delete(userId);
  } else {
    _systemPromptCache.clear();
  }
}

export { _systemPromptCache, _chatRateLimitCache, invalidateSystemPromptCache };
