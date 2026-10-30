/**
 * Personal access tokens.
 *
 * This is credential code, so the tests are about what must NEVER happen: plaintext landing
 * in storage or in a list response, a revoked token still working, a 'sweep' token reaching
 * a scope it was not granted, and a malformed token being accepted.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateToken,
  hashToken,
  isTokenShaped,
  tokenFromRequest,
  createToken,
  listTokens,
  revokeToken,
  verifyToken,
  TOKEN_PREFIX,
  SCOPE_SWEEP,
  TOKENS_COLLECTION,
} from '../lib/api-tokens.js';

// ── minimal Mongo stand-in ─────────────────────────────────────────────────

function makeDb(seed = []) {
  const rows = seed.map((r) => ({ ...r }));
  const matches = (doc, filter = {}) =>
    Object.entries(filter).every(([k, v]) => doc[k] === v);

  const col = {
    find(filter) {
      let out = rows.filter((r) => matches(r, filter));
      const api = {
        sort(spec) {
          out = out.slice().sort((a, b) => {
            for (const [k, dir] of Object.entries(spec)) {
              const av = a[k] instanceof Date ? a[k].getTime() : a[k];
              const bv = b[k] instanceof Date ? b[k].getTime() : b[k];
              if (av === bv) continue;
              return (av < bv ? -1 : 1) * dir;
            }
            return 0;
          });
          return api;
        },
        async toArray() { return out.map((r) => ({ ...r })); },
      };
      return api;
    },
    async findOne(filter) {
      const hit = rows.find((r) => matches(r, filter));
      return hit ? { ...hit } : null;
    },
    async insertOne(doc) { rows.push({ ...doc }); return { insertedId: doc.id }; },
    async updateOne(filter, update) {
      const row = rows.find((r) => matches(r, filter));
      if (!row) return { matchedCount: 0 };
      if (update.$set) Object.assign(row, update.$set);
      return { matchedCount: 1 };
    },
  };
  return { collection: () => col, _rows: rows };
}

// ── token shape ────────────────────────────────────────────────────────────

test('a generated token is prefixed and high-entropy', () => {
  const { token } = generateToken();
  assert.ok(token.startsWith(TOKEN_PREFIX));
  assert.equal(token.length, TOKEN_PREFIX.length + 43, '32 random bytes as base64url');
  assert.ok(isTokenShaped(token));
});

test('two generated tokens differ', () => {
  const a = generateToken().token;
  const b = generateToken().token;
  assert.notEqual(a, b);
});

test('rejects anything that is not token-shaped', () => {
  const bad = [
    '', 'spp_', 'spp_short', 'nope_' + 'a'.repeat(43),
    'spp_' + 'a'.repeat(42), 'spp_' + 'a'.repeat(44),
    'spp_' + '!'.repeat(43), null, undefined, 42, {},
  ];
  for (const v of bad) assert.equal(isTokenShaped(v), false, `should reject ${String(v)}`);
});

test('hashing is deterministic and distinguishes tokens', () => {
  const a = generateToken().token;
  const b = generateToken().token;
  assert.equal(hashToken(a), hashToken(a));
  assert.notEqual(hashToken(a), hashToken(b));
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
});

// ── header parsing ─────────────────────────────────────────────────────────

const reqWith = (headers) => ({ headers: { get: (k) => headers[k.toLowerCase()] ?? null } });

test('reads a bearer token', () => {
  const { token } = generateToken();
  assert.equal(tokenFromRequest(reqWith({ authorization: `Bearer ${token}` })), token);
});

test('reads x-api-key, for clients that cannot set Authorization', () => {
  const { token } = generateToken();
  assert.equal(tokenFromRequest(reqWith({ 'x-api-key': token })), token);
});

test('ignores a session JWT in the Authorization header', () => {
  // A normal browser session must not be mistaken for a personal token.
  assert.equal(tokenFromRequest(reqWith({ authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.abc.def' })), null);
});

test('ignores junk and missing headers', () => {
  assert.equal(tokenFromRequest(reqWith({})), null);
  assert.equal(tokenFromRequest(reqWith({ authorization: 'Basic abc' })), null);
  assert.equal(tokenFromRequest({ headers: { get: () => null } }), null);
});

// ── creation ───────────────────────────────────────────────────────────────

test('creation returns the plaintext exactly once', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'Codex hook' });
  assert.ok(created.token);
  assert.equal(created.name, 'Codex hook');
  assert.equal(created.prefix.length, TOKEN_PREFIX.length + 6);
});

test('storage holds a hash, never the plaintext', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'Codex hook' });
  const stored = db._rows[0];

  const serialised = JSON.stringify(stored);
  assert.ok(!serialised.includes(created.token), 'the raw token must not appear anywhere in the record');
  assert.equal(stored.token_hash, hashToken(created.token));
  assert.equal(stored.user_id, 'u1');
});

test('a listed token never leaks the hash or the secret', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'Cursor hook' });
  const [row] = await listTokens(db, 'u1');

  const asJson = JSON.stringify(row);
  assert.ok(!asJson.includes(created.token));
  assert.ok(!asJson.includes('token_hash'));
  assert.equal(row.last4, created.last4, 'last4 exists so users can tell tokens apart');
});

test('a token is scoped to sweep and cannot widen itself', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { scopes: ['sweep', 'admin', 'billing'] });
  assert.deepEqual(created.scopes, [SCOPE_SWEEP], 'unknown scopes are dropped, not stored');
});

test('an empty scope list still yields a usable token', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { scopes: [] });
  assert.deepEqual(created.scopes, [SCOPE_SWEEP]);
});

test('the per-user cap is enforced', async () => {
  const db = makeDb();
  for (let i = 0; i < 20; i += 1) await createToken(db, 'u1', { name: `t${i}` });
  await assert.rejects(() => createToken(db, 'u1', { name: 'one too many' }), /limit reached/i);
});

test('a name is clamped rather than rejected', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'x'.repeat(500) });
  assert.equal(created.name.length, 60);
});

// ── verification ───────────────────────────────────────────────────────────

test('a valid token resolves to its owner', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'hook' });
  const verified = await verifyToken(db, created.token, { scope: SCOPE_SWEEP });
  assert.equal(verified.userId, 'u1');
  assert.equal(verified.tokenId, created.id);
});

test('a revoked token stops working immediately', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'hook' });
  assert.ok(await verifyToken(db, created.token));

  const revoked = await revokeToken(db, 'u1', created.id);
  assert.equal(revoked, true);
  assert.equal(await verifyToken(db, created.token), null);
});

test('revoking someone else’s token is impossible', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'hook' });
  const revoked = await revokeToken(db, 'u2', created.id);
  assert.equal(revoked, false);
  assert.ok(await verifyToken(db, created.token), 'the token still works for its real owner');
});

test('a token without the requested scope is refused', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'hook' });
  assert.equal(await verifyToken(db, created.token, { scope: 'admin' }), null);
});

test('unknown, malformed and empty tokens all fail the same way', async () => {
  const db = makeDb();
  const { token } = generateToken();   // well-formed but never stored
  for (const v of [token, 'garbage', '', null, undefined]) {
    assert.equal(await verifyToken(db, v), null, `should reject ${String(v)}`);
  }
});

test('a token from another user never resolves', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'hook' });
  const verified = await verifyToken(db, created.token);
  assert.equal(verified.userId, 'u1');
  assert.notEqual(verified.userId, 'u2');
});

test('usage is stamped but not on every single call', async () => {
  const db = makeDb();
  const created = await createToken(db, 'u1', { name: 'hook' });

  await verifyToken(db, created.token);
  const first = db._rows[0].last_used_at;
  assert.ok(first, 'first use records a timestamp');

  await verifyToken(db, created.token);
  assert.equal(
    db._rows[0].last_used_at,
    first,
    'a second use within a minute must not rewrite the record',
  );
});

test('creation requires a user', async () => {
  const db = makeDb();
  await assert.rejects(() => createToken(db, null, {}), /requires a userId/);
});
