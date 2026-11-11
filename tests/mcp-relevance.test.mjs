/**
 * Relevance is a requirement on the hosted engine too — this is the path MCP clients and the
 * extension both end up hitting, so it gets its own guard rather than relying on the
 * extension's test plus the parity gate.
 *
 * Observed in the field: asking "what are my current dogs' names?" injected 25 memories about
 * a dentist, two business contacts, a CRM choice and a domain strategy. importance(0.06) +
 * recency(0.15) = 0.21 cleared every threshold with zero keyword overlap.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchMemories,
  MIN_RELEVANCE,
  FALLBACK_CONTEXT_MEMORIES,
} from '../lib/mcp/memory-engine.js';

const NOW = Date.now();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

const business = (n = 20) =>
  Array.from({ length: n }, (_, i) => ({
    id: 'biz-' + i,
    content: `Client ${i}: practice management advisory for an oral surgery group in metro area ${i}.`,
    importance: 'medium',
    created_at: daysAgo(i % 20),
  }));

test('MIN_RELEVANCE is a real gate, not a formality', () => {
  assert.ok(MIN_RELEVANCE > 0);
  assert.equal(FALLBACK_CONTEXT_MEMORIES, 3);
});

test('an off-topic question does not return recent-but-irrelevant memories', () => {
  const memories = [
    ...business(20),
    { id: 'dogs', content: 'Has two dogs named Ouzo and Skyy.', importance: 'medium', created_at: daysAgo(3) },
  ];
  const out = matchMemories('what are my current dogs names?', memories, 25);
  assert.ok(out.length <= 3, `expected a focused result, got ${out.length}`);
  assert.ok(out.some((m) => /Ouzo|Skyy/.test(m.memory.content)));
  assert.ok(!out.some((m) => /practice management advisory/.test(m.memory.content)));
});

test('generic queries fall back to a small curated set, not a flood', () => {
  const out = matchMemories('what do you know about me?', business(20), 25);
  assert.ok(out.length > 0 && out.length <= FALLBACK_CONTEXT_MEMORIES);
});

test('the returned shape stays { memory, score } — no internal fields leak', () => {
  const out = matchMemories('tell me about my dog', [
    { id: 'd', content: 'My dog is called Ouzo.', importance: 'medium', created_at: daysAgo(1) },
  ], 25);
  assert.deepEqual(Object.keys(out[0]).sort(), ['memory', 'score']);
});

test('a long memory containing the answer is retrieved, not filtered (coverage, not Jaccard)', () => {
  const longMemory = {
    id: 'dogs-long',
    content:
      'Household and pets: Reggie lives in Phoenix with his partner Tiffany. ' +
      'He has four dogs named Ouzo, Skyy, Stoli and Maui. The dogs are small breeds with ' +
      'dental problems and one has had teeth removed. Feeding duties rotate between kids.',
    importance: 'medium',
    created_at: daysAgo(240),
  };
  const out = matchMemories('what are my current dogs names?', [...business(20), longMemory], 25);
  assert.ok(out.some((m) => m.memory.id === 'dogs-long'),
    'Jaccard divided by union, so a 60-word memory scored 0.033 and was dropped');
});
