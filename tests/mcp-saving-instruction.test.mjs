/**
 * Guard: the saving directive must ride on EVERY read tool.
 *
 * The bug this exists for: `SAVING_INSTRUCTION` was attached to `get_context` only. A client
 * that opens with get_profile or get_memories — which is most of them — never received it,
 * so a user could have the MCP "connected" and get no proactive saving at all. That is
 * exactly the report that surfaced it: memories saved by hand, MCP hooked up in Claude, and
 * nothing new ever saved automatically.
 *
 * An MCP server cannot push; it only speaks when called. So the instruction has to be on
 * whatever the model happens to call, and this test fails if a future read tool forgets it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SOURCE = fs.readFileSync(new URL('../lib/mcp/handlers.js', import.meta.url), 'utf8');

/**
 * Pull one `export async function NAME(...) { ... }` body by brace matching.
 *
 * The first `{` after the name is NOT necessarily the body — a destructured parameter
 * (`{ limit = 20 } = {}`) opens and closes one first, so naive matching returns a body of a
 * few characters and every check against it fails for the wrong reason. Walk the parameter
 * parens to their close, then take the next brace as the body.
 */
function bodyOf(name) {
  const start = SOURCE.indexOf(`export async function ${name}(`);
  if (start === -1) return null;

  let parens = 0;
  let i = SOURCE.indexOf('(', start);
  for (; i < SOURCE.length; i += 1) {
    if (SOURCE[i] === '(') parens += 1;
    else if (SOURCE[i] === ')') {
      parens -= 1;
      if (parens === 0) break;
    }
  }
  i = SOURCE.indexOf('{', i);

  let depth = 0;
  const open = i;
  for (; i < SOURCE.length; i += 1) {
    if (SOURCE[i] === '{') depth += 1;
    else if (SOURCE[i] === '}') {
      depth -= 1;
      if (depth === 0) return SOURCE.slice(open, i + 1);
    }
  }
  return null;
}

const READ_TOOLS = ['getProfile', 'getMemories', 'getContext', 'listImprints', 'suggestMemories'];

test('the shared field exists and carries the instruction', () => {
  assert.match(SOURCE, /const SAVING_FIELD = \{ saving_instruction: SAVING_INSTRUCTION\.trim\(\) \}/);
});

test('every read tool returns the saving instruction', () => {
  for (const tool of READ_TOOLS) {
    const body = bodyOf(tool);
    assert.ok(body, `${tool} not found — has it been renamed?`);
    assert.ok(
      body.includes('SAVING_INSTRUCTION') || body.includes('SAVING_FIELD'),
      `${tool} does not return the saving instruction; a client calling it learns nothing about saving`,
    );
  }
});

test('a write tool does NOT need it', () => {
  // addMemory/sweep are the outcome, not the prompt. Asserting this keeps someone from
  // "fixing" the check above by pasting the field into everything.
  for (const tool of ['addMemory', 'sweep']) {
    const body = bodyOf(tool);
    assert.ok(body, `${tool} not found`);
    assert.ok(!body.includes('SAVING_FIELD'), `${tool} should not echo the saving instruction`);
  }
});
