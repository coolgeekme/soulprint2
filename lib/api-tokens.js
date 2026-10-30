/**
 * Personal access tokens for unattended hooks.
 *
 * WHY THIS EXISTS
 * ---------------
 * Lifecycle-hook automation needs a credential that survives the user closing their browser.
 * A session JWT doesn't: it's short-lived, it lives in localStorage, and asking a hook to
 * scrape it out of a browser profile is both fragile and a bad idea.
 *
 * Testing on the real CLIs settled the requirement. Claude Code can drive an MCP tool call
 * from a `Stop` hook with no credential at all, but Codex 0.145 and every shell-hook harness
 * (Cursor, Gemini CLI, Windsurf, Cline, Copilot) can only run a command — which means a
 * `curl` to /api/sweep — which means a token.
 *
 * DESIGN RULES
 * ------------
 * - Tokens are shown ONCE, at creation. Only a hash is stored, so a database dump does not
 *   hand anyone working credentials.
 * - The plaintext is never logged, never returned by a list call, and never re-derivable.
 * - A token carries explicit SCOPES. It is not a session: `sweep` permits writing memories
 *   and nothing else. A token must never be able to read the account, change billing, or
 *   delete anything.
 * - Revocation is immediate and is a timestamp, not a delete, so an audit trail survives.
 */

import crypto from 'crypto';

export const TOKENS_COLLECTION = 'api_tokens';

/** Distinguishable in logs and secret scanners, and obviously ours in a support ticket. */
export const TOKEN_PREFIX = 'spp_';

/** 32 bytes = 256 bits of entropy, base64url → 43 characters. */
const TOKEN_BYTES = 32;

/** The only scope a harness hook needs today. Deliberately narrow. */
export const SCOPE_SWEEP = 'sweep';
export const ALLOWED_SCOPES = [SCOPE_SWEEP];

const MAX_TOKENS_PER_USER = 20;
const MAX_NAME_LENGTH = 60;

/**
 * Build a new token. The caller must show `token` to the user and then discard it — it is
 * not recoverable from the record we store.
 */
export function generateToken() {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const token = `${TOKEN_PREFIX}${raw}`;
  return {
    token,
    token_hash: hashToken(token),
    // Enough to let someone tell two tokens apart in a list, useless for authentication.
    prefix: `${TOKEN_PREFIX}${raw.slice(0, 6)}`,
    last4: raw.slice(-4),
  };
}

/** SHA-256 of the full token. Fast is fine: the input is 256 bits of randomness, not a password. */
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Validate the SHAPE before any lookup, so garbage never reaches the database and a
 * malformed token can never be confused with a valid one.
 */
export function isTokenShaped(value) {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (!t.startsWith(TOKEN_PREFIX)) return false;
  return /^spp_[A-Za-z0-9_-]{43}$/.test(t);
}

/** Pull a bearer/compat token out of a request without caring which header style a harness used. */
export function tokenFromRequest(request) {
  const auth = request?.headers?.get?.('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const candidate = auth.slice(7).trim();
    if (isTokenShaped(candidate)) return candidate;
  }
  const apiKey = request?.headers?.get?.('x-api-key');
  if (isTokenShaped(apiKey)) return apiKey.trim();
  return null;
}

function newId() {
  return crypto.randomUUID();
}

function cleanName(name) {
  const n = String(name || '').trim();
  return (n || 'Unnamed token').slice(0, MAX_NAME_LENGTH);
}

function cleanScopes(scopes) {
  const wanted = Array.isArray(scopes) && scopes.length ? scopes : [SCOPE_SWEEP];
  const kept = wanted.filter((s) => ALLOWED_SCOPES.includes(s));
  // Never mint a token with no valid scope — it would be unusable, which reads as a bug.
  return kept.length ? kept : [SCOPE_SWEEP];
}

/** Public shape. Notably absent: token_hash, and anything that reconstructs the secret. */
function shape(record) {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    last4: record.last4,
    scopes: record.scopes || [],
    created_at: record.created_at,
    last_used_at: record.last_used_at || null,
    revoked_at: record.revoked_at || null,
  };
}

export async function createToken(db, userId, { name, scopes } = {}) {
  if (!userId) throw new Error('createToken requires a userId');
  const col = db.collection(TOKENS_COLLECTION);

  const active = await col
    .find({ user_id: userId, revoked_at: null })
    .toArray();
  if (active.length >= MAX_TOKENS_PER_USER) {
    throw new Error(`Token limit reached (${MAX_TOKENS_PER_USER}). Revoke one before creating another.`);
  }

  const { token, token_hash, prefix, last4 } = generateToken();
  const record = {
    id: newId(),
    user_id: userId,
    name: cleanName(name),
    token_hash,
    prefix,
    last4,
    scopes: cleanScopes(scopes),
    created_at: new Date(),
    last_used_at: null,
    revoked_at: null,
  };
  await col.insertOne(record);

  // `token` is returned exactly once, here, and never again.
  return { token, ...shape(record) };
}

export async function listTokens(db, userId) {
  const rows = await db
    .collection(TOKENS_COLLECTION)
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
  return rows.map(shape);
}

export async function revokeToken(db, userId, tokenId) {
  if (!tokenId) throw new Error('revokeToken requires a token id');
  const result = await db
    .collection(TOKENS_COLLECTION)
    .updateOne(
      { id: tokenId, user_id: userId, revoked_at: null },
      { $set: { revoked_at: new Date() } },
    );
  return (result?.matchedCount ?? 0) > 0;
}

/**
 * Resolve a token to its owner, or null.
 *
 * Returns null for: malformed, unknown, revoked, or missing the requested scope. The caller
 * gets one failure mode on purpose — telling a caller "this token exists but lacks scope"
 * confirms a stolen token is real.
 */
export async function verifyToken(db, rawToken, { scope = SCOPE_SWEEP } = {}) {
  if (!isTokenShaped(rawToken)) return null;

  const col = db.collection(TOKENS_COLLECTION);
  const record = await col.findOne({ token_hash: hashToken(rawToken) });
  if (!record) return null;
  if (record.revoked_at) return null;
  if (!Array.isArray(record.scopes) || !record.scopes.includes(scope)) return null;

  // Track usage without turning every sweep into a write amplification problem: a hook can
  // fire several times a minute and nobody needs minute-resolution on this field.
  const now = new Date();
  const last = record.last_used_at ? new Date(record.last_used_at).getTime() : 0;
  if (now.getTime() - last > 60_000) {
    await col.updateOne({ id: record.id }, { $set: { last_used_at: now } });
  }

  return { userId: record.user_id, tokenId: record.id, scopes: record.scopes };
}
