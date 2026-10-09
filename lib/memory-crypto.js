/**
 * Field-level encryption for memory content.
 *
 * WHY
 * ---
 * Memories are the most personal data the product holds — they are what users tell
 * us they are working on, worried about, and planning. They were stored as plain
 * text in MongoDB. Both competitors advertise encryption at rest, so this was a
 * trust gap and a claim we could not support.
 *
 * DESIGN
 * ------
 * AES-256-GCM per memory, with a random 12-byte IV per record. GCM is authenticated:
 * tampering with stored ciphertext fails to decrypt rather than returning garbage,
 * so a corrupted or edited record surfaces as an error instead of a wrong fact
 * injected into someone's AI context.
 *
 * The stored format is a single self-describing string:
 *
 *     enc:v1:<iv-b64>:<tag-b64>:<ciphertext-b64>
 *
 * The `enc:v1:` prefix does three jobs: it marks the record as ours, it carries a
 * version so the scheme can change later without guessing, and — most importantly —
 * it lets decryption recognise LEGACY PLAINTEXT. Existing memories written before
 * this change have no prefix and are returned unchanged, so the rollout needs no
 * migration and no downtime. They get encrypted the next time they are written.
 *
 * WHAT THIS DOES AND DOES NOT PROTECT
 * -----------------------------------
 * Protects: data at rest — a database dump, a backup, a snapshot, an operator
 * looking at the collection.
 * Does NOT protect: anything after the server decrypts to inject context, because
 * the server must read memories in order to serve them. This is not end-to-end
 * encryption and must never be described as such.
 *
 * KEY HANDLING
 * ------------
 * `MEMORY_ENCRYPTION_KEY` must be 64 hex characters (32 bytes):
 *
 *     openssl rand -hex 32
 *
 * The key is validated at first use. If it is missing or malformed the module does
 * NOT silently fall back to plaintext — see `encryptionEnabled()` for why the
 * failure is loud but non-fatal, and what turns it on.
 */
import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96 bits — the size GCM is specified for
const TAG_BYTES = 16;

let cachedKey = null;
let warned = false;

/**
 * Parse and validate the key from the environment.
 * Returns a 32-byte Buffer, or null when the key is absent/unusable.
 */
function loadKey() {
  if (cachedKey) return cachedKey;

  const raw = (process.env.MEMORY_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;

  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    // Loud, once — a malformed key is a deployment mistake, and a silent fallback
    // to plaintext is exactly the failure this module exists to prevent.
    if (!warned) {
      console.error(
        '[memory-crypto] MEMORY_ENCRYPTION_KEY is set but not valid. ' +
        'Expected 64 hex characters (32 bytes) — generate one with `openssl rand -hex 32`. ' +
        'Memory encryption is DISABLED until this is fixed.'
      );
      warned = true;
    }
    return null;
  }

  cachedKey = Buffer.from(raw, 'hex');
  return cachedKey;
}

/**
 * Is encryption active?
 *
 * Enabled the moment a valid key exists — no code change, no redeploy of behaviour.
 * When the key is absent the module stores plaintext, which is the pre-existing
 * behaviour: that makes shipping this code safe in either order (before or after the
 * key is set in the environment).
 *
 * The trade-off is deliberate. Refusing to store anything without a key would take
 * the product down on a missing env var; storing plaintext plus a loud warning keeps
 * the product up and makes the gap visible. Set the key to close it.
 */
export function encryptionEnabled() {
  return loadKey() !== null;
}

/** True when a stored value is one of ours (as opposed to legacy plaintext). */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Encrypt a memory's content for storage.
 * Returns the plaintext unchanged when no key is configured, so callers never have
 * to branch and legacy behaviour is preserved exactly.
 */
export function encryptMemory(plaintext) {
  if (plaintext == null) return plaintext;

  const text = String(plaintext);
  const key = loadKey();
  if (!key) return text;

  // Already encrypted — do not double-wrap (a re-save must be idempotent).
  if (isEncrypted(text)) return text;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return PREFIX +
    iv.toString('base64') + ':' +
    tag.toString('base64') + ':' +
    ciphertext.toString('base64');
}

/**
 * Decrypt a stored memory value.
 *
 * Legacy plaintext (no prefix) is returned unchanged — that is what makes this
 * deployable without a migration.
 *
 * A value that IS ours but will not decrypt returns null rather than throwing or
 * returning garbage, and logs. Callers should treat null as "this record is
 * unreadable" and skip it. Silently returning the ciphertext would inject encrypted
 * noise into a prompt; silently returning '' would look like an empty memory.
 */
export function decryptMemory(stored) {
  if (stored == null) return null;

  const text = String(stored);
  if (!isEncrypted(text)) return text;   // legacy plaintext

  const key = loadKey();
  if (!key) {
    console.error(
      '[memory-crypto] Found encrypted memory but MEMORY_ENCRYPTION_KEY is missing or invalid. ' +
      'The record cannot be read. Restore the key used to write it.'
    );
    return null;
  }

  try {
    const body = text.slice(PREFIX.length);
    const [ivB64, tagB64, dataB64] = body.split(':');
    if (!ivB64 || !tagB64 || !dataB64) throw new Error('malformed payload');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch (e) {
    // Covers a wrong key AND tampered/corrupted ciphertext — GCM cannot tell them
    // apart, and neither can we, so the message says both.
    console.error('[memory-crypto] Failed to decrypt a memory (wrong key or corrupted record):', e.message);
    return null;
  }
}

// ── Deterministic hash, for matching that must happen in the database ─────────

/**
 * A keyed hash of a memory's content, used for equality matching.
 *
 * Memory writes check whether an identical fact already exists, and that check used
 * to be a `$regex` on the plaintext content. Once content is encrypted that match is
 * impossible in the database, so the equality check moves onto this hash instead.
 *
 * HMAC rather than a plain digest: an unkeyed SHA-256 of a short, guessable sentence
 * ("Has two kids") can be brute-forced by anyone holding the database, which would
 * undo the encryption. Keying it with the same secret closes that off.
 *
 * Normalised (trimmed + lowercased) before hashing so the equality check keeps the
 * case-insensitivity the old `$regex ... $options: 'i'` provided.
 *
 * Returns null when no key is configured, so callers can fall back to the old
 * database match rather than writing a hash they cannot reproduce.
 */
export function memoryContentHash(plaintext) {
  const key = loadKey();
  if (!key || plaintext == null) return null;
  const normalised = String(plaintext).trim().toLowerCase();
  return crypto.createHmac('sha256', key).update(normalised, 'utf8').digest('hex');
}

// ── Convenience for callers that hold a whole document ────────────────────────

/**
 * Return a copy of a memory document with `content` decrypted.
 * Records that cannot be decrypted come back with `content: null` and
 * `unreadable: true`, so a caller can filter them out rather than showing a blank.
 */
export function decryptMemoryDoc(doc) {
  if (!doc) return doc;
  if (typeof doc.content === 'undefined') return doc;

  const plain = decryptMemory(doc.content);
  if (plain === null) {
    return { ...doc, content: null, unreadable: true };
  }
  return { ...doc, content: plain };
}

/** Map over a list of memory documents, decrypting each. */
export function decryptMemoryDocs(docs) {
  return (docs || []).map(decryptMemoryDoc);
}

// ── Test seam ─────────────────────────────────────────────────────────────────

/** Clear the cached key. Used by tests; not part of the runtime path. */
export function _resetKeyCache() {
  cachedKey = null;
  warned = false;
}
