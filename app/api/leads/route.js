import { ok, err, checkRateLimit, getClientIP } from '@/lib/api-utils';
import { getDb } from '@/lib/mongodb';

/**
 * POST /api/leads — lightweight email capture for free extension users.
 *
 * WHY THIS EXISTS
 * ---------------
 * The extension works locally with no account (a privacy selling point), which means
 * we have no email for the free tier. This endpoint lets a free user trade an email
 * for a small benefit (double the free memory cap, 10 -> 20) without creating an
 * account or password. It is lead capture, not authentication.
 *
 * WHAT IT STORES
 * --------------
 * Only the email, the capture source (first_open | memory_limit), and timestamps.
 * No memory content, no prompt text, nothing else. The email is PII and is covered by
 * the privacy policy; it is never read back into the product.
 *
 * NO AUTH
 * -------
 * Free users have no token, so this endpoint is unauthenticated. It is rate-limited by
 * IP and upserts on the email address (re-submitting the same email only refreshes the
 * record), so abuse surfaces as at most a handful of extra writes.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_SOURCES = new Set(['first_open', 'memory_limit']);

export async function POST(request) {
  const ip = getClientIP(request) || 'unknown';
  const rl = checkRateLimit(`lead:${ip}`, 'default');
  if (!rl.allowed) {
    return err('Too many requests', 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON', 400);
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const source = ALLOWED_SOURCES.has(body?.source) ? body.source : 'unknown';

  if (!EMAIL_RE.test(email)) {
    return err('Invalid email', 400);
  }

  try {
    const db = await getDb();
    await db.collection('leads').updateOne(
      { email },
      {
        $set: { email, source, updated_at: new Date() },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );
    return ok({ ok: true });
  } catch (e) {
    console.error('[Leads] write failed:', e.message);
    return err('Failed to record email', 500);
  }
}
