// Dedupe filter for memory writes — shared by the hosted MCP and the REST handlers.
//
// The trap this exists to prevent: Mongo's `{ content_hash: null }` matches every
// document that is MISSING the field, not just documents whose hash is null.
// `memoryContentHash` returns null whenever MEMORY_ENCRYPTION_KEY is absent or
// invalid, so emitting that clause unconditionally makes EVERY save collide with an
// arbitrary existing memory — the write is skipped and the client is told
// `duplicate: true` about a memory it never asked about.
//
// So: only include the hash clause when there is a real hash. The exact-content
// regex still dedupes plaintext rows written before encryption was enabled.

/** Escape a string so it can be used literally inside a RegExp. */
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string} userId  owner scope — never optional
 * @param {string} trimmed the plaintext memory content (already trimmed)
 * @param {string|null} contentHash output of memoryContentHash(); null when no key
 */
export function buildDedupeFilter(userId, trimmed, contentHash) {
  const exactMatch = { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' };
  const filter = { user_id: userId };
  if (contentHash) {
    filter.$or = [{ content_hash: contentHash }, { content: exactMatch }];
  } else {
    filter.content = exactMatch;
  }
  return filter;
}
