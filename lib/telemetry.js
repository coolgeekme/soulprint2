import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';

// Mirrors the whitelists in app/api/events/route.js — keep in sync.
const ALLOWED_EVENTS = new Set(['prompt', 'extract', 'import', 'export', 'mcp_connect']);
const ALLOWED_SURFACES = new Set(['chatgpt', 'claude', 'gemini', 'web', 'mcp', 'other', 'unknown']);

/**
 * Server-side fire-and-forget usage telemetry.
 *
 * Records ONLY an event name, a surface, and a timestamp keyed to a user id —
 * never memory content, prompt text, or conversation data. A failed write is
 * swallowed (telemetry must never fail the product). The caller may `await` for
 * write durability, or ignore the returned promise to stay non-blocking.
 */
export async function recordEvent(userId, event, surface = 'unknown') {
  if (!userId || !ALLOWED_EVENTS.has(event)) return;
  if (!ALLOWED_SURFACES.has(surface)) surface = 'unknown';
  try {
    const db = await getDb();
    await db.collection('usage_events').insertOne({
      id: uuidv4(),
      user_id: userId,
      event,
      surface,
      created_at: new Date(),
    });
  } catch (e) {
    console.error('[telemetry] write failed:', e.message);
  }
}
