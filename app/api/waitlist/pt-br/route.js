// Public endpoint for the Brazilian Portuguese waitlist.
// Accepts an email (required) and a region (optional) and persists an entry
// in the `brazilian_waitlist` MongoDB collection. Designed to be idempotent:
// submitting the same email twice returns success without creating a
// duplicate. Rate-limited per client IP to prevent abuse.
//
// Request shape:
//   POST /api/waitlist/pt-br
//   { email: string, region?: string, source?: string }
// Response shape:
//   200 { success: true, already_registered?: boolean }
//   400 { error: string }
//   429 { error: string }

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb } from '@/lib/mongodb';
import { ok, err, getClientIP, checkRateLimit } from '@/lib/api-utils';

const VALID_REGIONS = new Set([
  'sao-paulo',
  'rio-de-janeiro',
  'minas-gerais',
  'nordeste',
  'sul',
  'centro-oeste',
  'norte',
  'prefer-not-to-say',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashIP(ip) {
  if (!ip) return null;
  // One-way hash so we can rate-limit and spot abuse without storing raw IPs
  // (LGPD-friendly). Salt with a static value — goal is bucketing, not secrecy.
  return crypto.createHash('sha256').update(`sp-br:${ip}`).digest('hex').slice(0, 32);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rawRegion = typeof body.region === 'string' ? body.region.trim().toLowerCase() : '';
    const source = typeof body.source === 'string' ? body.source.slice(0, 64) : 'waitlist-page';

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail) || rawEmail.length > 254) {
      return err('INVALID_EMAIL', 400);
    }

    const region = rawRegion && VALID_REGIONS.has(rawRegion) ? rawRegion : null;

    // Rate limit by hashed IP — prevents bots from enumerating or spamming.
    const ip = getClientIP(request) || 'unknown';
    const ipHash = hashIP(ip);
    const rate = checkRateLimit(`pt-br-waitlist:${ipHash}`, 'auth');
    if (!rate.allowed) {
      return err('RATE_LIMITED', 429);
    }

    const db = await getDb();
    const collection = db.collection('brazilian_waitlist');

    // Ensure unique index on email (idempotent operation — safe to call repeatedly).
    try {
      await collection.createIndex({ email: 1 }, { unique: true });
      await collection.createIndex({ created_at: -1 });
      await collection.createIndex({ region: 1 });
    } catch (_) {
      // Index may already exist — ignore.
    }

    const existing = await collection.findOne({ email: rawEmail });
    if (existing) {
      // Update region if the user now provides one and didn't before.
      if (region && !existing.region) {
        await collection.updateOne(
          { email: rawEmail },
          { $set: { region, updated_at: new Date() } }
        );
      }
      return ok({ success: true, already_registered: true });
    }

    const userAgent = request.headers.get('user-agent') || '';

    const doc = {
      id: uuidv4(),
      email: rawEmail,
      region,
      locale: 'pt-BR',
      source,
      ip_hash: ipHash,
      user_agent: userAgent.slice(0, 256),
      created_at: new Date(),
      updated_at: new Date(),
    };

    await collection.insertOne(doc);

    return ok({ success: true, already_registered: false });
  } catch (e) {
    console.error('[pt-br waitlist] POST failed:', e?.message || e);
    return err('SERVER_ERROR', 500);
  }
}
