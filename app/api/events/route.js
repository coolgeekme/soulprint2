import { ok, err, authenticate } from '@/lib/api-utils';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/events — content-free product telemetry.
 *
 * WHAT THIS IS
 * ------------
 * A deliberately minimal, server-side usage counter. It records ONLY an event name, a
 * surface, and a timestamp, keyed to a signed-in user. It does not record, and has no
 * field to record, any memory content, prompt text, search text, or conversation data.
 *
 * The product's positioning is "your memories stay yours", so telemetry that reads what
 * people are storing would contradict it. This is the narrow set that answers "how many
 * people are using the extension, where, and how often" — nothing more.
 *
 * WHY A SEPARATE COLLECTION, NOT THE MEMORY PATH
 * ----------------------------------------------
 * Memory writes are audited for encryption and must stay lean. Analytics is a different
 * concern with a different lifecycle (append-only, never read into user context, safe to
 * drop or disable wholesale). Keeping it in its own collection means turning it off — or
 * purging it — is a one-line operation with no effect on the product.
 *
 * HARD LIMITS
 * -----------
 * - `event` and `surface` are strictly whitelisted. An unknown value is rejected, not
 *   stored, so this endpoint can never become a dumping ground for arbitrary fields.
 * - Everything is fire-and-forget from the client's perspective; a failed write is
 *   swallowed by the caller and never blocks the product.
 */

const ALLOWED_EVENTS = new Set(['prompt', 'extract', 'import', 'export', 'mcp_connect']);
const ALLOWED_SURFACES = new Set(['chatgpt', 'claude', 'gemini', 'web', 'mcp', 'other', 'unknown']);

export async function POST(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON', 400);
  }

  const event = body?.event;
  const surface = body?.surface || 'unknown';

  if (!ALLOWED_EVENTS.has(event)) {
    return err('Invalid event', 400);
  }
  if (!ALLOWED_SURFACES.has(surface)) {
    return err('Invalid surface', 400);
  }

  try {
    const db = await getDb();
    await db.collection('usage_events').insertOne({
      id: uuidv4(),
      user_id: user.id,
      event,
      surface,
      created_at: new Date(),
    });
    return ok({ recorded: true });
  } catch (e) {
    console.error('[Events] write failed:', e.message);
    // Telemetry must never fail the product. The client treats this as best-effort.
    return err('Failed to record event', 500);
  }
}

/**
 * GET /api/events — aggregate read for the dashboard.
 *
 * Returns counts grouped by event, by surface, and by day (last 30 days), plus the
 * number of distinct active users. This is the "how many / where / how often" answer,
 * and it contains no per-user detail and no content.
 */
export async function GET(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return err('Forbidden', 403);
  }

  const db = await getDb();
  const col = db.collection('usage_events');

  const [byEvent, bySurface, byDay, activeUsers] = await Promise.all([
    col.aggregate([{ $group: { _id: '$event', count: { $sum: 1 } } }]).toArray(),
    col.aggregate([{ $group: { _id: '$surface', count: { $sum: 1 } } }]).toArray(),
    col.aggregate([
      { $match: { created_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    col.distinct('user_id'),
  ]);

  return ok({
    total_events: (await col.estimatedDocumentCount?.()) ?? undefined,
    by_event: Object.fromEntries(byEvent.map((r) => [r._id, r.count])),
    by_surface: Object.fromEntries(bySurface.map((r) => [r._id, r.count])),
    by_day: byDay.map((r) => ({ day: r._id, count: r.count })),
    active_users: (activeUsers || []).length,
  });
}
