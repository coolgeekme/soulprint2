/**
 * Hosted MCP memory engine — regression tests.
 *
 * Covers two production defects that were only found by running the deployed
 * code against the pending code side by side:
 *
 *   1. The profile line was emitted FIRST and the context was capped at 600
 *      chars, so a long profile filled the budget and the tail truncation
 *      dropped EVERY memory. Users got a personality line and zero facts.
 *   2. `limit` was passed straight through to matchMemories, so a caller
 *      asking for limit:2000 got the whole store back (~50k tokens).
 *
 * These are the guardrails for both.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchMemories,
  buildContext,
  clampLimit,
  stalenessNote,
  factLine,
  MAX_MEMORIES,
  MAX_MEMORY_LIMIT,
  MAX_CONTEXT_CHARS,
  MAX_PROFILE_CHARS,
} from '../lib/mcp/memory-engine.js';

const DAY = 24 * 60 * 60 * 1000;

const mem = (id, content, daysAgo, category = 'work') => ({
  id,
  content,
  category,
  importance: 'medium',
  created_at: new Date(Date.now() - daysAgo * DAY).toISOString(),
});

// A deliberately bloated profile — the shape that caused defect #1.
const BLOATED_PROFILE = {
  basicProfile: {
    displayName: 'Reggie',
    descriptors: ['builder', 'systems thinker', 'direct communicator', 'founder', 'operator'],
    soulProfileSummary:
      'Reggie is a pattern-driven builder who ships fast, prefers direct answers without ' +
      'preamble or filler, and works across several concurrent products with a bias toward ' +
      'shipping working software over planning documents of any length whatsoever.',
  },
};

const MEMORIES = [
  mem('a', 'The HalfSalt films are built with Remotion and rendered on the VPS.', 4),
  mem('b', 'PlayTrackr runs on port 8321 with postgres on 5433.', 9),
  mem('c', 'Keri is my ex-wife and Ian is our son.', 15, 'relationships'),
  mem('d', 'The kia carnival registration still needs to be filed with the dmv.', 40),
];

// ── defect #1: memories must never be starved by the profile ────────────────

test('a bloated profile does not truncate the memories away', () => {
  const matches = matchMemories('what about the halfsalt films', MEMORIES, MAX_MEMORIES);
  assert.ok(matches.length > 0, 'expected matches for a topic that is in the store');

  const ctx = buildContext(matches, BLOATED_PROFILE);
  assert.ok(ctx, 'context must not be null');

  // The regression: every present memory's content survived into the context.
  for (const m of matches) {
    assert.ok(
      ctx.includes(m.memory.content),
      `memory was dropped from the context: ${m.memory.content}`,
    );
  }
});

test('facts are emitted before the profile', () => {
  const matches = matchMemories('halfsalt films', MEMORIES, MAX_MEMORIES);
  const ctx = buildContext(matches, BLOATED_PROFILE);

  const factsIdx = ctx.indexOf('Use these facts about me');
  const profileIdx = ctx.indexOf('You are speaking with');

  assert.ok(factsIdx !== -1, 'expected the facts line');
  assert.ok(profileIdx !== -1, 'expected the profile line');
  assert.ok(factsIdx < profileIdx, 'facts must precede the profile so tail truncation spares them');
});

test('the profile is capped so it cannot crowd out the facts', () => {
  const matches = matchMemories('halfsalt films', MEMORIES, MAX_MEMORIES);
  const ctx = buildContext(matches, BLOATED_PROFILE);

  // The profile portion alone must stay within its own budget.
  const profilePart = ctx.slice(ctx.indexOf('You are speaking with'));
  assert.ok(
    profilePart.length <= MAX_PROFILE_CHARS,
    `profile block was ${profilePart.length} chars, over the ${MAX_PROFILE_CHARS} cap`,
  );
});

test('context never exceeds maxChars', () => {
  const big = Array.from({ length: 60 }, (_, i) =>
    mem(`x${i}`, `A fairly long memory sentence number ${i} about a website project detail.`, i),
  );
  const matches = matchMemories('website project', big, MAX_MEMORIES);
  const ctx = buildContext(matches, BLOATED_PROFILE);

  assert.ok(ctx.length <= MAX_CONTEXT_CHARS, `context was ${ctx.length} chars`);
});

test('context budget is 2000 chars, matching the extension', () => {
  // The deployed value was 600, which is what made defect #1 possible.
  assert.equal(MAX_CONTEXT_CHARS, 2000);
});

// ── defect #2: the caller-supplied limit must be bounded ────────────────────

test('clampLimit caps an oversized request', () => {
  assert.equal(clampLimit(2000), MAX_MEMORY_LIMIT);
  assert.equal(clampLimit(MAX_MEMORY_LIMIT + 1), MAX_MEMORY_LIMIT);
  assert.equal(clampLimit(Number.MAX_SAFE_INTEGER), MAX_MEMORY_LIMIT);
});

test('clampLimit floors to a whole number', () => {
  assert.equal(clampLimit(10.9), 10);
});

test('clampLimit raises a too-small request to 1', () => {
  assert.equal(clampLimit(0), 1);
  assert.equal(clampLimit(-5), 1);
});

test('clampLimit falls back to the default on junk input', () => {
  for (const junk of [undefined, null, NaN, 'abc', {}, []]) {
    assert.equal(clampLimit(junk), MAX_MEMORIES, `junk input ${String(junk)} should default`);
  }
});

test('clampLimit honors a value inside the range', () => {
  assert.equal(clampLimit(12), 12);
  assert.equal(clampLimit(1), 1);
});

test('matchMemories never returns more than the default', () => {
  const many = Array.from({ length: 300 }, (_, i) => mem(`m${i}`, `memory numbered ${i}`, i));
  assert.equal(matchMemories('memory numbered', many, MAX_MEMORIES).length, MAX_MEMORIES);
});

// ── temporal grounding ──────────────────────────────────────────────────────

test('every injected fact carries an age marker', () => {
  const matches = matchMemories('halfsalt films', MEMORIES, MAX_MEMORIES);
  const ctx = buildContext(matches, BLOATED_PROFILE);

  for (const m of matches) {
    const line = factLine(m.memory);
    assert.ok(line.length > 0, 'factLine must not be empty for a memory with content');
    // shortAge() emits one of: today | Nd ago | Nmo ago | Ny ago
    const hasMarker = /\((?:today|\d+d ago|\d+mo ago|\d+y ago)\)/.test(line);
    assert.ok(hasMarker, `no age marker on: ${line}`);
  }
  assert.ok(ctx.includes('ago'), 'the injected context should carry at least one age marker');
});

test('a stale memory keeps the explicit warning', () => {
  const old = mem('old', 'Has 3 kids.', 400);
  const note = stalenessNote(old);
  assert.match(note, /may be outdated/);
});

test('a fresh memory carries a compact age tag instead of the warning', () => {
  const fresh = mem('fresh', 'Has 4 kids.', 2);
  assert.equal(stalenessNote(fresh), '');
  assert.match(factLine(fresh), /\(2d ago\)/);
});
