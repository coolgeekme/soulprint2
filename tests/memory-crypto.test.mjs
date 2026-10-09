/**
 * Tests for lib/memory-crypto.js.
 *
 * Run: node --test tests/memory-crypto.test.mjs
 *
 * The module is dependency-free apart from node:crypto, so it is tested directly
 * without the Next.js app or a database.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const url = new URL('../lib/memory-crypto.js', import.meta.url);

/** Fresh module per case so the key cache and the once-only warning reset. */
async function load(env = {}) {
  const u = new URL(url.href); u.search = `?v=${Math.random()}`;
  const mod = await import(u.href);
  mod._resetKeyCache();
  delete process.env.MEMORY_ENCRYPTION_KEY;
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  return mod;
}

beforeEach(() => { delete process.env.MEMORY_ENCRYPTION_KEY; });

// ── round trip ──────────────────────────────────────────────────────────────

test('encrypts and decrypts back to the original', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const plain = 'Allergic to peanuts and carries an EpiPen.';
  const enc = m.encryptMemory(plain);
  assert.notEqual(enc, plain, 'ciphertext must differ from plaintext');
  assert.equal(m.decryptMemory(enc), plain);
});

test('ciphertext does not contain the plaintext', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const enc = m.encryptMemory('lives in Phoenix Arizona');
  assert.ok(!enc.includes('Phoenix'), 'the stored value must not leak the fact');
});

test('handles unicode, emoji and long content', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  for (const s of ['café — naïve', '🎯 emoji ok', 'x'.repeat(5000), 'line\nbreak']) {
    assert.equal(m.decryptMemory(m.encryptMemory(s)), s);
  }
});

test('every encryption uses a fresh IV, so identical facts differ at rest', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const a = m.encryptMemory('Has two kids.');
  const b = m.encryptMemory('Has two kids.');
  assert.notEqual(a, b, 'identical plaintext must not produce identical ciphertext');
  assert.equal(m.decryptMemory(a), m.decryptMemory(b));
});

test('re-encrypting an encrypted value is a no-op (re-save is idempotent)', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const once = m.encryptMemory('stable');
  assert.equal(m.encryptMemory(once), once);
});

// ── legacy plaintext ────────────────────────────────────────────────────────

test('legacy plaintext passes through unchanged — no migration needed', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  assert.equal(m.decryptMemory('written before encryption existed'), 'written before encryption existed');
  assert.equal(m.isEncrypted('written before encryption existed'), false);
  assert.equal(m.isEncrypted(m.encryptMemory('x')), true);
});

// ── key configuration ───────────────────────────────────────────────────────

test('with no key, encryption is off and content is stored as-is', async () => {
  const m = await load({});
  assert.equal(m.encryptionEnabled(), false);
  assert.equal(m.encryptMemory('plain'), 'plain', 'must preserve existing behaviour so deploy order is safe');
});

test('a malformed key disables encryption rather than being silently accepted', async () => {
  for (const bad of ['tooshort', 'z'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)]) {
    const m = await load({ MEMORY_ENCRYPTION_KEY: bad });
    assert.equal(m.encryptionEnabled(), false, `key ${JSON.stringify(bad.slice(0, 12))} should be rejected`);
    assert.equal(m.encryptMemory('plain'), 'plain');
  }
});

test('uppercase hex keys are accepted', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: 'A'.repeat(64) });
  assert.equal(m.encryptionEnabled(), true);
  assert.equal(m.decryptMemory(m.encryptMemory('v')), 'v');
});

// ── wrong key / tampering ───────────────────────────────────────────────────

test('the wrong key fails closed — returns null, never garbage', async () => {
  const a = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const enc = a.encryptMemory('secret fact');
  const b = await load({ MEMORY_ENCRYPTION_KEY: KEY_B });
  assert.equal(b.decryptMemory(enc), null,
    'a wrong key must not return ciphertext or a wrong value');
});

test('missing key on an encrypted record fails closed', async () => {
  const a = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const enc = a.encryptMemory('secret fact');
  const b = await load({});
  assert.equal(b.decryptMemory(enc), null);
});

test('tampered ciphertext fails closed (GCM is authenticated)', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const enc = m.encryptMemory('original fact');
  const parts = enc.split(':');
  const data = Buffer.from(parts[4], 'base64');
  data[0] ^= 0xff;                       // flip a bit
  const tampered = [...parts.slice(0, 4), data.toString('base64')].join(':');
  assert.equal(m.decryptMemory(tampered), null);
});

test('a malformed payload fails closed', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  for (const bad of ['enc:v1:', 'enc:v1:only', 'enc:v1:a:b', 'enc:v1:!!!:!!!:!!!']) {
    assert.equal(m.decryptMemory(bad), null, `should reject ${bad}`);
  }
});

// ── hashing, for database-level equality ────────────────────────────────────

test('the content hash is stable and case/whitespace insensitive', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const h = s => m.memoryContentHash(s);
  assert.equal(h('Has two kids.'), h('  has TWO kids.  '),
    'must preserve the case-insensitivity the old $regex provided');
  assert.notEqual(h('Has two kids.'), h('Has three kids.'));
});

test('the hash is keyed — the same fact hashes differently under another key', async () => {
  // Compute each hash while its own key is the active one. loadKey() reads the env
  // lazily, so holding two module instances and calling them out of order would
  // compare a key against itself and pass for the wrong reason.
  const a = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const hashUnderA = a.memoryContentHash('Has two kids.');

  const b = await load({ MEMORY_ENCRYPTION_KEY: KEY_B });
  const hashUnderB = b.memoryContentHash('Has two kids.');

  assert.notEqual(hashUnderA, hashUnderB,
    'an unkeyed hash of a short guessable sentence would defeat the encryption');
});

test('the hash is null without a key, so callers can fall back', async () => {
  const m = await load({});
  assert.equal(m.memoryContentHash('anything'), null);
});

// ── document helpers ────────────────────────────────────────────────────────

test('decryptMemoryDoc decrypts content and flags unreadable records', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const doc = { id: '1', content: m.encryptMemory('lives in Tempe'), category: 'work' };
  const out = m.decryptMemoryDoc(doc);
  assert.equal(out.content, 'lives in Tempe');
  assert.equal(out.category, 'work', 'other fields must be preserved');
  assert.equal(out.unreadable, undefined);

  const broken = m.decryptMemoryDoc({ id: '2', content: 'enc:v1:zzz:zzz:zzz' });
  assert.equal(broken.content, null);
  assert.equal(broken.unreadable, true);
});

test('decryptMemoryDoc passes through documents with no content field', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  assert.deepEqual(m.decryptMemoryDoc({ id: '1' }), { id: '1' });
  assert.equal(m.decryptMemoryDoc(null), null);
});

test('decryptMemoryDocs maps a list', async () => {
  const m = await load({ MEMORY_ENCRYPTION_KEY: KEY_A });
  const docs = [
    { id: '1', content: m.encryptMemory('one') },
    { id: '2', content: m.encryptMemory('two') },
  ];
  assert.deepEqual(m.decryptMemoryDocs(docs).map(d => d.content), ['one', 'two']);
});
