// The single write gate for user memories.
//
// Every path that creates a memory should go through saveMemory(), so the dedupe rules
// cannot drift between the MCP tool, the REST API, auto-extraction, chat capture and
// import. Before this, five separate call sites each did their own insertOne() with their
// own idea of what "already exists" meant — four of them did no semantic check at all.
//
// Order of checks, cheapest first:
//   1. exact hash / exact text   (indexed, no embedding call)
//   2. semantic neighbour        (reuses the embedding we must compute anyway)
//   3. insert, or reinforce, or insert-and-flag

import { buildDedupeFilter } from './mcp/dedupe.js'
import { encryptMemory, memoryContentHash } from './memory-crypto.js'
import { embedForWrite } from './memory-embedding.js'
import { invalidateSystemPromptCache } from './handlers/chat-cache.js'
import { findSemanticMatch, DUPLICATE_THRESHOLD, REVIEW_THRESHOLD } from './semantic-dedupe.js'
import { v4 as uuidv4 } from 'uuid'

export const MEMORY_CATEGORIES = [
  'health', 'preferences', 'personal', 'work', 'relationships', 'goals', 'other',
]
export const IMPORTANCE_LEVELS = ['high', 'medium', 'low']

const normaliseCategory = (c) =>
  MEMORY_CATEGORIES.includes(c) ? c : 'other'
const normaliseImportance = (i) =>
  IMPORTANCE_LEVELS.includes(i) ? i : 'medium'

/**
 * Create a memory, refusing to create a restatement of one we already hold.
 *
 * @returns {Promise<{action: 'inserted'|'reinforced'|'flagged', memory: object}>}
 *   memory.content is always the PLAINTEXT echo — the stored value is ciphertext, and
 *   callers use this for counts and API responses.
 */
export async function saveMemory(db, userId, {
  content,
  category,
  importance,
  source = 'manual',
  sourceConversationId = null,
  extra = {},
  // Injectable purely so tests can run without a live embedding endpoint.
  embedImpl = embedForWrite,
} = {}) {
  if (!userId) throw new Error('saveMemory requires a userId')
  const trimmed = String(content || '').trim()
  if (trimmed.length < 3) {
    throw new Error('Memory content is required (at least 3 characters)')
  }

  const now = new Date()
  const contentHash = memoryContentHash(trimmed)

  // ── 1. exact duplicate ────────────────────────────────────────────────────
  const existing = await db
    .collection('user_memories')
    .findOne(buildDedupeFilter(userId, trimmed, contentHash))

  if (existing) {
    await reinforce(db, userId, existing.id, now)
    return {
      action: 'reinforced',
      memory: { ...existing, content: trimmed, reinforced_count: (existing.reinforced_count || 1) + 1 },
    }
  }

  // ── 2. semantic neighbour ─────────────────────────────────────────────────
  const embedded = await embedImpl(trimmed)
  const embedding = embedded.embedding || null
  const match = await findSemanticMatch(db, userId, embedding)

  if (match && match.verdict === 'duplicate') {
    // Same fact, different words. Strengthen the existing record instead of adding a
    // fifth paraphrase. Content is left alone: the stored wording is already right, and
    // rewriting it would mean re-encrypting and re-hashing on every restatement.
    await reinforce(db, userId, match.memory.id, now)
    return {
      action: 'reinforced',
      memory: {
        id: match.memory.id,
        content: trimmed,
        reinforcement_of: match.memory.id,
        similarity: Number(match.score.toFixed(4)),
      },
    }
  }

  // ── 3. insert, flagging the ambiguous band ────────────────────────────────
  const flagged = match && match.verdict === 'review'

  const memory = {
    id: uuidv4(),
    user_id: userId,
    content: encryptMemory(trimmed),
    content_hash: contentHash,
    ...embedded,
    category: normaliseCategory(category),
    importance: normaliseImportance(importance),
    source,
    source_conversation_id: sourceConversationId,
    created_at: now,
    updated_at: now,
    last_verified_at: now,
    // 'needs_review' is the existing "don't trust this yet" state that retrieval already
    // penalises and the cleanup pass already routes to a human. A near-miss lands here
    // rather than being merged or dropped.
    review_state: flagged ? 'needs_review' : 'active',
    reinforced_count: 1,
    ...(flagged
      ? {
          duplicate_candidate_id: match.memory.id,
          duplicate_score: Number(match.score.toFixed(4)),
          flagged_at: now,
        }
      : {}),
    ...extra,
  }

  await db.collection('user_memories').insertOne(memory)
  invalidateSystemPromptCache(userId)

  return { action: flagged ? 'flagged' : 'inserted', memory: { ...memory, content: trimmed } }
}

async function reinforce(db, userId, memoryId, now) {
  await db.collection('user_memories').updateOne(
    { user_id: userId, id: memoryId },
    {
      $inc: { reinforced_count: 1 },
      $set: { last_verified_at: now },
    },
  )
}

/** Retrieval filter: history is kept, but never returned as current truth. */
export const CURRENT_MEMORY_FILTER = { review_state: { $ne: 'superseded' } }

export { DUPLICATE_THRESHOLD, REVIEW_THRESHOLD }
