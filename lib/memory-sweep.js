/**
 * Batch memory sweep — the one-call path for end-of-session capture.
 *
 * WHY THIS EXISTS
 * ---------------
 * An MCP server cannot schedule anything: the protocol is client-initiated, so a harness has
 * to fire the write. Both Claude Code and Codex can do that from a lifecycle hook, and the
 * remaining harnesses can from a shell hook hitting the REST mirror. But a hook that calls
 * `soulprint_add_memory` once per fact forces the CLIENT to decide what is a duplicate —
 * and the semantic gate that decides that lives here, behind saveMemory().
 *
 * So the sweep takes many candidates and runs every one through the same gate. The client
 * supplies "what I learned today"; the server decides what is new, what reinforces an
 * existing record, and what is ambiguous enough to flag. Those rules cannot drift between
 * the MCP tool and the REST endpoint because both call this function.
 *
 * Deliberately sequential: each item may hit the embedding API, and a hook firing 40 of them
 * in parallel is a good way to get rate-limited halfway through a sweep.
 */

import { saveMemory, MEMORY_CATEGORIES, IMPORTANCE_LEVELS } from './memory-write.js';

/**
 * A hook that sweeps a day's work should send tens of items, not thousands. The cap keeps a
 * runaway agent from turning one hook fire into an unbounded write.
 */
export const MAX_SWEEP_ITEMS = 100;

/** Anything the caller omits lands here rather than being rejected outright. */
export const DEFAULT_CATEGORY = 'other';
export const DEFAULT_IMPORTANCE = 'medium';

function coerceChoice(value, allowed, fallback) {
  const v = String(value || '').trim().toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

/**
 * Accept either `"a plain fact"` or `{ content, category, importance }`.
 * A hook author will reach for the string form; an agent will send objects.
 */
function normaliseItem(raw) {
  if (typeof raw === 'string') return { content: raw };
  if (raw && typeof raw === 'object') {
    return {
      content: raw.content ?? raw.text ?? raw.memory,
      category: raw.category,
      importance: raw.importance,
    };
  }
  return { content: null };
}

/**
 * Run a batch through the write gate.
 *
 * Returns per-item outcomes, not just totals — a hook needs to be able to say what happened,
 * and a caller that only sees "inserted: 7" cannot tell a dedupe from a failure.
 */
export async function sweepMemories(db, userId, items, { embedImpl, source = 'sweep' } = {}) {
  if (!userId) throw new Error('sweepMemories requires a userId');
  if (!Array.isArray(items)) throw new Error('memories must be an array');

  const received = items.length;
  const batch = items.slice(0, MAX_SWEEP_ITEMS);

  const results = [];
  const counts = { inserted: 0, reinforced: 0, flagged: 0, skipped: 0 };

  for (const raw of batch) {
    const item = normaliseItem(raw);
    const content = String(item.content || '').trim();

    if (content.length < 3) {
      counts.skipped += 1;
      results.push({ content: content || null, action: 'skipped', reason: 'too_short' });
      continue;
    }

    try {
      const { action, memory } = await saveMemory(db, userId, {
        content,
        category: coerceChoice(item.category, MEMORY_CATEGORIES, DEFAULT_CATEGORY),
        importance: coerceChoice(item.importance, IMPORTANCE_LEVELS, DEFAULT_IMPORTANCE),
        source,
        ...(embedImpl ? { embedImpl } : {}),
      });

      // saveMemory reports 'inserted' | 'reinforced' | 'flagged'.
      if (action === 'reinforced') counts.reinforced += 1;
      else if (action === 'flagged') counts.flagged += 1;
      else counts.inserted += 1;

      results.push({
        content,
        action,
        id: memory?.id || null,
        review_state: memory?.review_state || null,
        reinforced_count: memory?.reinforced_count ?? null,
        duplicate_score: action === 'flagged' ? (memory?.duplicate_score ?? null) : null,
      });
    } catch (error) {
      // One bad item must not abort the sweep — a hook gets no second chance to send the rest.
      counts.skipped += 1;
      results.push({ content, action: 'failed', reason: error?.message || 'error' });
    }
  }

  return {
    received,
    processed: batch.length,
    truncated: received > batch.length,
    ...counts,
    results,
  };
}
