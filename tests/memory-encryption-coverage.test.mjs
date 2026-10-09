/**
 * Guards for memory encryption coverage.
 *
 * Run: node --test tests/memory-encryption-coverage.test.mjs
 *
 * WHY A SOURCE-LEVEL TEST
 * -----------------------
 * Memory content is encrypted only where the code remembers to do it, and there is no
 * single data-access layer to enforce that. Any new handler that writes `content`
 * straight to user_memories silently stores plaintext in a collection that is supposed
 * to be encrypted — no error, no log, and it only shows up when someone sets the key
 * and a reader gets back a value it cannot parse.
 *
 * That is not hypothetical. The first pass of this audit fixed one file and missed
 * seven other write sites across five files, plus three read sites in one route.
 *
 * These tests read the source and fail when a write or read site is added without the
 * matching call. They are deliberately textual: a future handler is what we are
 * guarding against, so it cannot be imported and exercised here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

const SOURCES = walk(path.join(ROOT, 'lib'))
  .concat(walk(path.join(ROOT, 'app')))
  .map((f) => ({ path: path.relative(ROOT, f), text: readFileSync(f, 'utf8') }))
  .filter((f) => f.text.includes('user_memories'));

test('the audit found files to check (guards against a broken walker)', () => {
  assert.ok(SOURCES.length >= 5,
    `expected several files touching user_memories, found ${SOURCES.length} — ` +
    'the walker is probably broken, which would make every test below vacuous');
});

// ── writes ───────────────────────────────────────────────────────────────────

test('every file that writes user_memories encrypts before storing', () => {
  const offenders = [];

  for (const { path: p, text } of SOURCES) {
    // Scope the check to the object literal actually handed to a memories write.
    // A whole-file `content:` scan is useless here: chat-stream.js alone has two dozen
    // `content:` fields for chat messages, and flagging those would make the test noise
    // that everyone learns to ignore.
    const writeCall = /user_memories'\)\.(insertOne|insertMany)\(/g;
    let m;
    while ((m = writeCall.exec(text)) !== null) {
      const window = text.slice(m.index, m.index + 900);
      // Stop at the end of the call so we don't read into the next function.
      const end = window.indexOf('\n  });');
      const block = end > 0 ? window.slice(0, end) : window;

      const contentAssignments = [...block.matchAll(/content:\s*([^,\n]+),/g)].map((x) => x[1].trim());
      for (const expr of contentAssignments) {
        if (/encryptMemory\(/.test(expr)) continue;
        offenders.push(`${p}: content: ${expr}`);
      }
    }
  }

  assert.deepEqual(offenders, [],
    'these write to user_memories with unencrypted content — wrap in encryptMemory():\n  ' +
    offenders.join('\n  '));
});

// ── the specific files we fixed ──────────────────────────────────────────────

const MUST_ENCRYPT = [
  'lib/handlers/memory-system.js',
  'lib/handlers/chat-stream.js',
  'lib/handlers/cloud-import.js',
  'lib/mcp/handlers.js',
  'app/api/user/[...path]/route.js',
];

const MUST_DECRYPT = [
  'lib/handlers/memory-system.js',
  'lib/handlers/memory-cleanup.js',
  'lib/handlers/gradual-assessment.js',
  'lib/handlers/cloud-import.js',
  'lib/handlers/cloud-import.js',
  'lib/mcp/handlers.js',
  'app/api/telegram/[...path]/route.js',
  'app/api/voice/[...path]/route.js',
  'app/api/admin/[...path]/route.js',
];

test('every known write site calls encryptMemory', () => {
  for (const rel of MUST_ENCRYPT) {
    const f = SOURCES.find((s) => s.path === rel);
    assert.ok(f, `expected to find ${rel}`);
    assert.ok(/encryptMemory\(/.test(f.text),
      `${rel} writes user_memories but never calls encryptMemory — ` +
      'it would store plaintext in an encrypted collection');
  }
});

test('every known read site actually CALLS a decrypt helper', () => {
  for (const rel of MUST_DECRYPT) {
    const f = SOURCES.find((s) => s.path === rel);
    assert.ok(f, `expected to find ${rel}`);

    // Strip the import block first. Matching the raw string is not enough: deleting the
    // call while leaving the import passed this test during fault injection, because
    // the import line contains the same identifier.
    const body = f.text.replace(/import\s*\{[^}]*\}\s*from\s*'@\/lib\/memory-crypto';/s, '');

    assert.ok(/\bdecryptMemoryDoc(s)?\s*\(/.test(body),
      `${rel} reads user_memories but never CALLS decryptMemoryDoc(s) — it would surface ` +
      'ciphertext to a user, an AI prompt, or a tool result');
  }
});

// ── imports resolve ──────────────────────────────────────────────────────────

test('files using the crypto helpers actually import them', () => {
  for (const { path: p, text } of SOURCES) {
    if (/encryptMemory\(|decryptMemoryDoc/.test(text)) {
      assert.ok(/from '@\/lib\/memory-crypto'/.test(text),
        `${p} uses the crypto helpers without importing them`);
    }
  }
});
