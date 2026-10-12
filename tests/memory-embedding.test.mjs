import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  embedText,
  embeddingEnabled,
  _clearEmbeddingCache,
} from '../lib/memory-embedding.js';

// A fake fetch that echoes a fixed vector, and records what it was asked for.
function fakeFetch(impl) {
  return async (url, opts) => impl(url, opts);
}

function okFetch(vector) {
  return fakeFetch(async (_url, opts) => {
    const body = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: vector, input: body.input }] }),
    };
  });
}

// Ensure a key is present for the tests that need one; restore in finally.
function withKey(fn) {
  const had = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  try {
    return fn();
  } finally {
    if (had === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = had;
  }
}

test('embeddingEnabled: false with no key, true with a key', () => {
  const had = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.EMERGENT_LLM_KEY;
  assert.equal(embeddingEnabled(), false);
  if (had !== undefined) process.env.OPENAI_API_KEY = had;
  else delete process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'x';
  assert.equal(embeddingEnabled(), true);
});

test('embedText: returns null when no key is set', async () => {
  const hadO = process.env.OPENAI_API_KEY;
  const hadE = process.env.EMERGENT_LLM_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.EMERGENT_LLM_KEY;
  try {
    assert.equal(await embedText('hello'), null);
  } finally {
    if (hadO !== undefined) process.env.OPENAI_API_KEY = hadO;
    else delete process.env.OPENAI_API_KEY;
    if (hadE !== undefined) process.env.EMERGENT_LLM_KEY = hadE;
    else delete process.env.EMERGENT_LLM_KEY;
  }
});

test('embedText: returns the vector on success', async () => {
  await withKey(async () => {
    _clearEmbeddingCache();
    const vec = [0.1, 0.2, 0.3];
    const v = await embedText('some memory', okFetch(vec));
    assert.deepEqual(v, vec);
  });
});

test('embedText: caches identical text, embedding once', async () => {
  await withKey(async () => {
    _clearEmbeddingCache();
    let calls = 0;
    const fetcher = fakeFetch(async () => {
      calls++;
      return { ok: true, status: 200, json: async () => ({ data: [{ embedding: [1] }] }) };
    });
    await embedText('same text', fetcher);
    await embedText('same text', fetcher);
    assert.equal(calls, 1);
  });
});

test('embedText: trims and normalizes, so " a " and "a" share a cache entry', async () => {
  await withKey(async () => {
    _clearEmbeddingCache();
    let calls = 0;
    const fetcher = fakeFetch(async () => {
      calls++;
      return { ok: true, status: 200, json: async () => ({ data: [{ embedding: [1] }] }) };
    });
    await embedText('  a  ', fetcher);
    await embedText('a', fetcher);
    assert.equal(calls, 1);
  });
});

test('embedText: non-2xx returns null, does not throw', async () => {
  await withKey(async () => {
    _clearEmbeddingCache();
    const fetcher = fakeFetch(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    assert.equal(await embedText('x', fetcher), null);
  });
});

test('embedText: malformed body returns null', async () => {
  await withKey(async () => {
    _clearEmbeddingCache();
    const fetcher = fakeFetch(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    assert.equal(await embedText('x', fetcher), null);
  });
});

test('embedText: a thrown fetch error returns null', async () => {
  await withKey(async () => {
    _clearEmbeddingCache();
    const fetcher = async () => { throw new Error('network down'); };
    assert.equal(await embedText('x', fetcher), null);
  });
});

test('embedText: empty string returns null without calling fetch', async () => {
  await withKey(async () => {
    _clearEmbeddingCache();
    let calls = 0;
    const fetcher = fakeFetch(async () => { calls++; return { ok: true, status: 200, json: async () => ({ data: [{ embedding: [1] }] }) }; });
    assert.equal(await embedText('   ', fetcher), null);
    assert.equal(calls, 0);
  });
});
