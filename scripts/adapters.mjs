#!/usr/bin/env node
/**
 * Manage the extension's assistant adapters.
 *
 *   node scripts/adapters.mjs list
 *   node scripts/adapters.mjs add --id gemini \
 *       --hosts gemini.google.com \
 *       --patterns /batchexecute \
 *       --strategy prepend-prompt \
 *       --selector '[data-test-id="model-response"]'
 *   node scripts/adapters.mjs remove gemini
 *
 * WHY A SCRIPT AND NOT A DEPLOY
 * The extension fetches /api/extension/adapters and caches it for an hour. A new row
 * therefore reaches users without a build, a Chrome Web Store review, or an engine
 * deploy. That is the entire point of the exercise.
 *
 * AUTH
 * `add` and `remove` need ADMIN_TOKEN in the environment. `list` is public.
 *
 * STRATEGIES (implemented in the extension — see src/shared/adapters.js)
 *   system-message       context rides in a hidden system message, created if absent
 *   prepend-prompt       context is prepended to a `prompt` field
 *   prepend-last-message context is prepended to the last message in a messages array
 *
 * A strategy the client does not implement is rejected by the server, not stored —
 * a row that the extension cannot execute looks like support and behaves like a bug.
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SOULPRINT_BASE || 'https://soulprintengine.ai';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function token() {
  const t = process.env.ADMIN_TOKEN;
  if (!t) {
    console.error('ADMIN_TOKEN is not set. Export it before running add/remove.');
    process.exit(1);
  }
  return t;
}

async function list() {
  const res = await fetch(`${BASE}/api/extension/adapters`, { cache: 'no-store' });
  // A missing endpoint must not look like "zero adapters configured" — that reads as a
  // working empty state when the real answer is that nothing is deployed.
  if (!res.ok) {
    console.error(`Endpoint returned ${res.status}. Is the engine deployed with /api/extension/adapters?`);
    process.exit(1);
  }
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.adapters)) {
    console.error('Response was not adapter JSON:', JSON.stringify(data).slice(0, 200));
    process.exit(1);
  }
  console.log(`source: ${data.source}   version: ${data.version}   adapters: ${data.adapters.length}\n`);
  for (const a of data.adapters || []) {
    console.log(`  ${a.id}`);
    console.log(`    hosts      ${(a.hostnames || []).join(', ')}`);
    console.log(`    patterns   ${(a.apiPatterns || []).join(', ') || '—'}`);
    console.log(`    strategy   ${a.strategy}`);
    console.log(`    selector   ${a.assistantSelector || '—'}`);
    console.log('');
  }
}

async function add() {
  const id = arg('id');
  const hosts = (arg('hosts') || '').split(',').map(s => s.trim()).filter(Boolean);
  const patterns = (arg('patterns') || '').split(',').map(s => s.trim()).filter(Boolean);
  const strategy = arg('strategy');
  const selector = arg('selector');

  if (!id || !hosts.length || !strategy) {
    console.error('Required: --id, --hosts, --strategy');
    process.exit(1);
  }

  const res = await fetch(`${BASE}/api/admin/extension/adapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({
      adapter: { id, hostnames: hosts, apiPatterns: patterns, strategy, assistantSelector: selector },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    console.error(`Failed (${res.status}):`, data.error || data);
    process.exit(1);
  }
  console.log(`Saved ${data.adapter.id} — ${data.count} adapter(s) configured.`);
  console.log('Users see it within the hour, or immediately after an extension restart.');
}

async function remove() {
  const id = process.argv[3];
  if (!id || id.startsWith('--')) {
    console.error('Usage: adapters.mjs remove <id>');
    process.exit(1);
  }

  const res = await fetch(`${BASE}/api/admin/extension/adapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ remove: id }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    console.error(`Failed (${res.status}):`, data.error || data);
    process.exit(1);
  }
  console.log(`Removed ${data.removed} — ${data.count} adapter(s) remain.`);
}

async function seed() {
  const file = arg('file', 'scripts/adapters-seed.json');
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  } catch (e) {
    console.error(`Could not read ${file}:`, e.message);
    process.exit(1);
  }
  const rows = Array.isArray(doc.adapters) ? doc.adapters : [];
  if (!rows.length) {
    console.error('No adapters in that file.');
    process.exit(1);
  }

  let ok = 0;
  const failed = [];
  for (const row of rows) {
    const res = await fetch(`${BASE}/api/admin/extension/adapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ adapter: row }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      ok++;
      console.log(`  ✓ ${row.id}${row._warning ? '   ⚠ ' + row._warning : ''}`);
    } else {
      failed.push(`${row.id}: ${data.error || res.status}`);
      console.log(`  ✗ ${row.id} — ${data.error || res.status}`);
    }
  }
  console.log(`\n${ok} saved, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

const cmd = process.argv[2];
const commands = { list, add, remove, seed };
if (!commands[cmd]) {
  console.error('Usage: adapters.mjs <list|add|remove|seed> [options]');
  process.exit(1);
}
commands[cmd]().catch(e => {
  console.error(e.message || e);
  process.exit(1);
});
