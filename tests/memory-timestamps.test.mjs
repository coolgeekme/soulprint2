/**
 * Timestamps on memory entries.
 *
 * The bug this pins: `cleanMatches` returned content, id, category, importance and score —
 * and nothing else. The dates were stored on every write all along, so a client could read
 * the entire store and still be unable to answer "did anything get saved today?". That was
 * reported as a real question ("I just asked Claude Code… and it couldn't confirm"), which
 * makes it a correctness bug in the tool surface, not a cosmetic one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanMatches, isoDate, newestTimestamp } from '../lib/mcp/memory-engine.js';

const row = (over = {}) => ({
  memory: {
    id: 'm1',
    content: 'Works at Acme',
    category: 'work',
    importance: 'high',
    created_at: new Date('2026-10-28T14:00:00Z'),
    updated_at: new Date('2026-10-28T15:00:00Z'),
    last_verified_at: new Date('2026-10-28T16:00:00Z'),
    reinforced_count: 3,
    review_state: 'active',
    ...over,
  },
  score: 0.9234,
});

test('entries carry their timestamps', () => {
  const [m] = cleanMatches([row()]);
  assert.equal(m.created_at, '2026-10-28T14:00:00.000Z');
  assert.equal(m.updated_at, '2026-10-28T15:00:00.000Z');
  assert.equal(m.last_verified_at, '2026-10-28T16:00:00.000Z');
});

test('the existing fields are untouched', () => {
  const [m] = cleanMatches([row()]);
  assert.equal(m.content, 'Works at Acme');
  assert.equal(m.id, 'm1');
  assert.equal(m.category, 'work');
  assert.equal(m.importance, 'high');
  assert.equal(m.score, 0.923);
});

test('reinforcement and review state survive', () => {
  const [m] = cleanMatches([row()]);
  assert.equal(m.reinforced_count, 3);
  assert.equal(m.review_state, 'active');
});

test('a memory saved once reports a count of 1, not undefined', () => {
  const [m] = cleanMatches([row({ reinforced_count: undefined })]);
  assert.equal(m.reinforced_count, 1);
});

test('updated_at falls back to created_at when never edited', () => {
  const [m] = cleanMatches([row({ updated_at: undefined })]);
  assert.equal(m.updated_at, '2026-10-28T14:00:00.000Z');
});

test('a missing date is null, never "Invalid Date"', () => {
  const [m] = cleanMatches([row({ created_at: undefined, last_verified_at: undefined })]);
  assert.equal(m.created_at, null);
  assert.equal(m.last_verified_at, null);
  // and it must survive JSON without becoming a string called Invalid Date
  assert.equal(JSON.parse(JSON.stringify(m)).created_at, null);
});

test('string dates are normalised to the same ISO form', () => {
  // Mongo can hand back either a Date or an ISO string depending on how it was written.
  const [m] = cleanMatches([row({ created_at: '2026-10-28T14:00:00Z' })]);
  assert.equal(m.created_at, '2026-10-28T14:00:00.000Z');
});

test('garbage dates degrade to null instead of throwing', () => {
  assert.equal(isoDate('not a date'), null);
  assert.equal(isoDate(undefined), null);
  assert.equal(isoDate(''), null);
  assert.equal(isoDate(0), null, 'epoch-zero is treated as absent, not 1970');
});

test('newestTimestamp finds the most recent save across the store', () => {
  const memories = [
    { created_at: new Date('2026-10-01T00:00:00Z') },
    { created_at: new Date('2026-10-28T14:00:00Z') },
    { created_at: new Date('2026-09-15T00:00:00Z') },
  ];
  assert.equal(newestTimestamp(memories), '2026-10-28T14:00:00.000Z');
});

test('newestTimestamp on an empty or dateless set is null', () => {
  assert.equal(newestTimestamp([]), null);
  assert.equal(newestTimestamp(null), null);
  assert.equal(newestTimestamp([{}, { created_at: null }]), null);
});

test('newestTimestamp answers "anything added today?" in one comparison', () => {
  const memories = [{ created_at: new Date('2026-10-27T23:00:00Z') }];
  const newest = newestTimestamp(memories);
  const today = Date.parse('2026-10-28T00:00:00Z');
  assert.ok(Date.parse(newest) < today, 'yesterday is correctly not today');
});
