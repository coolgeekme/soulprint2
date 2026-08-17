// Device Authorization Flow (RFC 8628) for the SoulPrint MCP server.
// Lets a CLI/stdio MCP client log in WITHOUT a manually-copied API token:
//   1. POST /api/oauth/device          -> device_code + user_code + verification_uri
//   2. User visits /activate, enters the short code, approves (logged in)
//   3. POST /api/oauth/token (poll)    -> access_token once approved
// The access token is the SAME 365-day JWT that generateToken() issues elsewhere,
// so it works with the existing authenticate() path unchanged.
import { randomBytes } from 'crypto';
import { getDb } from '@/lib/mongodb';
import { generateToken } from '@/lib/auth';
import { ok, err, authenticate } from '@/lib/api-utils';

// Unambiguous alphabet — no 0/O, 1/I/L to avoid typos when the user types the code.
const USER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const USER_CODE_LENGTH = 8;

const DEVICE_CODE_TTL_MS = 15 * 60 * 1000; // device_code / overall flow lifetime
const POLL_INTERVAL_SECONDS = 5;
const ACCESS_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60; // matches generateToken()'s 365d

const COLLECTION = 'oauth_device_codes';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://soulprintengine.ai';

function generateUserCode() {
  let code = '';
  const bytes = randomBytes(USER_CODE_LENGTH);
  for (let i = 0; i < USER_CODE_LENGTH; i++) {
    code += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length];
  }
  return code; // stored/compared WITHOUT hyphen; hyphen only for display
}

function generateDeviceCode() {
  return randomBytes(32).toString('hex'); // 64 hex chars, unguessable
}

// ── Step 1: request a device code (no auth) ────────────────────────────────────
export async function handleDeviceAuth(request) {
  try {
    const db = await getDb();
    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const now = Date.now();

    await db.collection(COLLECTION).insertOne({
      device_code: deviceCode,
      user_code: userCode,
      status: 'pending', // pending -> approved -> used | expired
      user_id: null,
      created_at: new Date(now),
      expires_at: new Date(now + DEVICE_CODE_TTL_MS),
      approved_at: null,
      used_at: null,
    });

    return ok({
      device_code: deviceCode,
      user_code: userCode,
      user_code_display: `${userCode.slice(0, 4)}-${userCode.slice(4)}`,
      verification_uri: `${BASE_URL}/activate`,
      expires_in: Math.floor(DEVICE_CODE_TTL_MS / 1000),
      interval: POLL_INTERVAL_SECONDS,
    });
  } catch (e) {
    console.error('[DeviceAuth] device:', e.message);
    return err('Internal error', 500);
  }
}

// ── Step 2: poll for the token (no auth) ──────────────────────────────────────
export async function handleTokenExchange(request) {
  try {
    const body = await request.json().catch(() => null);
    const deviceCode = body?.device_code || '';
    if (!deviceCode) return err('device_code is required', 400);

    const db = await getDb();
    const record = await db.collection(COLLECTION).findOne({ device_code: deviceCode });
    if (!record) return err('invalid_grant', 400);

    // Expire on access if past TTL
    if (record.expires_at && record.expires_at.getTime() < Date.now()) {
      await db.collection(COLLECTION).updateOne(
        { device_code: deviceCode, status: 'pending' },
        { $set: { status: 'expired' } }
      );
      return err('expired_token', 400);
    }

    if (record.status === 'pending') return err('authorization_pending', 400);
    if (record.status === 'expired') return err('expired_token', 400);
    if (record.status === 'used') return err('invalid_grant', 400);
    if (record.status !== 'approved' || !record.user_id) return err('invalid_grant', 400);

    // Single-use: mark used BEFORE issuing the token
    await db.collection(COLLECTION).updateOne(
      { device_code: deviceCode, status: 'approved' },
      { $set: { status: 'used', used_at: new Date() } }
    );

    const accessToken = generateToken(record.user_id);
    return ok({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    });
  } catch (e) {
    console.error('[DeviceAuth] token:', e.message);
    return err('Internal error', 500);
  }
}

// ── Step 3: user approves the code on /activate (auth required) ───────────────
export async function handleDeviceActivate(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);

    const body = await request.json().catch(() => null);
    // Normalize: uppercase, strip everything non-alphanumeric (accepts "ABCD-1234" or "abcd1234")
    const code = (body?.user_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== USER_CODE_LENGTH) return err('Enter the 8-character code', 400);

    const db = await getDb();
    const record = await db.collection(COLLECTION).findOne({ user_code: code });

    if (!record) return err('Invalid code', 404);

    if (record.expires_at && record.expires_at.getTime() < Date.now()) {
      await db.collection(COLLECTION).updateOne(
        { device_code: record.device_code, status: 'pending' },
        { $set: { status: 'expired' } }
      );
      return err('This code has expired. Run the connect command again.', 400);
    }

    if (record.status !== 'pending') return err('This code was already used', 400);

    await db.collection(COLLECTION).updateOne(
      { device_code: record.device_code, status: 'pending' },
      { $set: { status: 'approved', user_id: user.id, approved_at: new Date() } }
    );

    return ok({ status: 'approved' });
  } catch (e) {
    console.error('[DeviceAuth] activate:', e.message);
    return err('Internal error', 500);
  }
}
