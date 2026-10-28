/**
 * Pagination for soulprint_get_memories.
 *
 * Why this exists: the tool was capped at 50 results with no offset, so an agent looking
 * at a 1,956-memory store could read 2.6% of it and had no way to reach the rest. Worse,
 * the response carried `total` without saying the list was short, so an agent reported a
 * targeted cleanup as a complete audit.
 *
 * These pin the arithmetic and, more importantly, the honesty flags: `truncated` must be
 * true whenever `returned < total`, and `next_offset` must walk the caller to the end
 * without repeating or skipping a row.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { paginate, MAX_MEMORY_LIMIT } from '../lib/mcp/memory-engine.js';

const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: i }));

test('first page reports truncation against the real total', () => {
  const r = paginate(rows(1956), 1956, { limit: 50 });
  assert.equal(r.returned, 50);
  assert.equal(r.offset, 0);
  assert.equal(r.truncated, true, '50 of 1956 is a page, not the store');
  assert.equal(r.has_more, true);
  assert.equal(r.next_offset, 50);
});

test('a page that covers everything is not truncated', () => {
  const r = paginate(rows(12), 12, { limit: 50 });
  assert.equal(r.returned, 12);
  assert.equal(r.truncated, false);
  assert.equal(r.has_more, false);
  assert.equal(r.next_offset, null);
});

test('walking next_offset over the whole store visits every row exactly once', () => {
  const total = 137;
  const all = rows(total);
  const seen = [];
  let offset = 0;
  let guard = 0;
  for (;;) {
    const r = paginate(all, total, { offset, limit: 25 });
    seen.push(...r.page.map((x) => x.id));
    if (!r.has_more) break;
    offset = r.next_offset;
    assert.ok(++guard < 50, 'pagination failed to terminate');
  }
  assert.equal(seen.length, total);
  assert.deepEqual(seen, Array.from({ length: total }, (_, i) => i), 'order preserved, no gaps or repeats');
});

test('the final page is exact, not padded', () => {
  const r = paginate(rows(137), 137, { offset: 125, limit: 25 });
  assert.equal(r.returned, 12);
  assert.equal(r.has_more, false);
  assert.equal(r.truncated, true, 'still short of the store as a whole');
});

test('offset past the end yields an empty page that says so', () => {
  const r = paginate(rows(10), 10, { offset: 500, limit: 50 });
  assert.equal(r.returned, 0);
  assert.equal(r.has_more, false);
  assert.equal(r.next_offset, null);
});

test('negative or garbage offsets clamp to the start', () => {
  for (const offset of [-10, 'nonsense', NaN, undefined]) {
    const r = paginate(rows(100), 100, { offset, limit: 10 });
    assert.equal(r.offset, 0, `offset ${String(offset)} should clamp`);
    assert.equal(r.page[0].id, 0);
  }
});

test('a caller cannot exceed the hard cap', () => {
  const r = paginate(rows(5000), 5000, { limit: 999999 });
  assert.equal(r.returned, MAX_MEMORY_LIMIT);
  assert.ok(r.truncated);
});

test('limit below the minimum still returns something', () => {
  for (const limit of [0, -5, 0.5]) {
    const r = paginate(rows(100), 100, { limit });
    assert.ok(r.returned >= 1, `limit ${limit} returned nothing`);
  }
});

test('the old 50 ceiling is gone', () => {
  assert.ok(MAX_MEMORY_LIMIT > 50, 'the cap that caused the original problem must be raised');
});
