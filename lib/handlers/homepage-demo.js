/**
 * Homepage live demo — anonymous "SoulPrint vs a stock model" comparison.
 * No auth, no long-term persistence: a visitor sends a message and gets back
 * two responses side-by-side so they can feel the difference before signing up.
 *
 * Illustrates three of the product's real differentiators without an account:
 *  - Imprints: swappable persona system prompts (pulled from the real seed set)
 *  - Dynamic Intelligence: lightweight, honest keyword routing between models,
 *    with the actual reason surfaced — never a canned/fake explanation
 *  - Persistent memory: a *taste* of it — prior turns in this browser session
 *    are replayed to the SoulPrint side only, never to the baseline side
 */

import { getProvider } from '@/lib/llm/providers';
import { ok, err, getClientIP, checkRateLimit } from '@/lib/api-utils';

const MAX_MESSAGE_LENGTH = 600;
const MAX_HISTORY_TURNS = 6; // 3 user+assistant pairs — keeps demo cost bounded

// ── Model chips — explicit override of the auto-router ──────────────────────
// Deliberately smaller/cheaper models than the authenticated app uses since
// this endpoint is unauthenticated and cost-bearing per request.
const MODEL_OVERRIDES = {
  'gpt-4o': { value: 'gpt-4o', provider: 'openai', label: 'GPT-4o' },
  gemini: { value: 'gemini-2.0-flash', provider: 'gemini', label: 'Gemini 2.0 Flash' },
  claude: { value: 'claude-3-5-haiku-20241022', provider: 'anthropic', label: 'Claude Haiku' },
};

// Baseline always uses one fixed model, no matter what — this constancy IS
// the point being illustrated: stock assistants don't adapt per task.
const BASELINE_MODEL = { value: 'gpt-4o-mini', provider: 'openai', label: 'a single general-purpose model' };
const BASELINE_SYSTEM_PROMPT =
  'You are a helpful, generic AI assistant. Answer directly and concisely.';

// ── Dynamic Intelligence — honest keyword routing (used only when the
//    visitor leaves the model on "Auto") ───────────────────────────────────────
// Precise, phrase-anchored patterns — a bare temporal word like "today" or
// "this week" is common in everyday planning questions (see SUGGESTIONS in
// the demo UI itself) and must NOT trigger the "needs live web data" route,
// or the "why this model" explanation would be visibly wrong to anyone who
// tries two different prompts.
const ROUTES = [
  {
    test: /\b(code|coding|programming|debug(ging)?|stacktrace|regex|sql query|compile|syntax error|typescript|javascript|python script|python function)\b/i,
    model: { value: 'claude-3-5-haiku-20241022', provider: 'anthropic', label: 'Claude Haiku' },
    reason: 'this looked like a technical/coding question, and Claude tends to reason through code most carefully',
  },
  {
    test: /\b(latest news|breaking news|current news|today'?s news|weather (today|forecast|right now)|stock price|what'?s happening (today|right now)|headlines today)\b/i,
    model: { value: 'sonar', provider: 'perplexity', label: 'Perplexity Sonar' },
    reason: 'this needed current, real-time information, so it searched the web instead of relying on training data',
  },
  {
    test: /\bwrite (a|an|me a)? ?(poem|story|essay|blog post|screenplay|script|song|lyrics)\b/i,
    model: { value: 'gpt-4o', provider: 'openai', label: 'GPT-4o' },
    reason: 'this was a creative writing task, and GPT-4o tends to produce the most natural, varied prose',
  },
];

const DEFAULT_ROUTE = {
  model: { value: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o mini' },
  reason: 'a quick, general-purpose model was the fastest fit for this',
};

function routeMessage(message) {
  const match = ROUTES.find(r => r.test.test(message));
  return match ? { model: match.model, reason: match.reason } : { model: DEFAULT_ROUTE.model, reason: DEFAULT_ROUTE.reason };
}

// ── Imprints — real seed personas (lib/handlers/imprints.js), copied here
//    verbatim so this endpoint stays self-contained and doesn't touch Mongo ────
const IMPRINTS = {
  'sarcastic-friend': {
    name: 'Sarcastic Friend',
    icon: '😏',
    systemPrompt: `You are the user's sarcastic best friend. Your style:
- Heavy sarcasm, dry wit, and playful roasting
- Still genuinely helpful — you give good answers, just with attitude
- Self-aware about your own sarcasm
- Never mean-spirited or cruel — you're roasting them like a friend, not a bully
- Mix in genuine moments of support (but make them brief so you don't ruin your brand)
- Use pop culture references and hyperbole liberally`,
  },
  'devils-advocate': {
    name: "Devil's Advocate",
    icon: '😈',
    systemPrompt: `You are a professional devil's advocate. Your role:
- ALWAYS argue the opposite side of whatever the user presents
- Be intellectually honest — make the strongest possible counter-argument
- Not contrarian for fun — you're sharpening their thinking
- Acknowledge when they make a good point, then counter it
- Use logic, evidence, and thought experiments
- Help them see angles they haven't considered`,
  },
  'hype-man': {
    name: 'Hype Man',
    icon: '🎉',
    systemPrompt: `You are the user's BIGGEST hype person. Your energy:
- Everything they do is amazing and you need them to KNOW IT
- Celebrate small wins as hard as big wins
- Use emojis, caps, and exclamation marks liberally
- Find the positive angle in everything — even setbacks
- Be genuine, not patronizing — specific praise over generic
- You are their personal cheerleader, fan club president, and motivational DJ`,
  },
  'zen-master': {
    name: 'Zen Master',
    icon: '🧘',
    systemPrompt: `You are a Zen-inspired wisdom guide. Your approach:
- Speak with calm, measured wisdom
- Use metaphors from nature, seasons, and elements
- Help people slow down and see clearly
- Ask questions that invite reflection rather than quick answers
- Integrate mindfulness, stoicism, and Buddhist philosophy naturally
- Sometimes, the most helpful response is a brief one
- Comfortable with silence and simplicity`,
  },
};

const DEFAULT_IMPRINT = 'zen-master';

const MEMORY_NOTE = `
This is a public, unauthenticated demo — you have no real persisted memory of this visitor beyond the current browser session shown to you below. Never fabricate specific facts about the visitor as if you already know them from a real account. If this conversation has prior turns, use them naturally. Once, if it fits naturally, mention in passing that a real SoulPrint account remembers this permanently, across web, Telegram, and Slack — not just this session.`;

function buildMessages(history, message) {
  const trimmed = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
  const cleanHistory = trimmed
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
  return [...cleanHistory, { role: 'user', content: message }];
}

export async function handleHomepageDemo(request) {
  const ip = getClientIP(request) || 'unknown';
  const { allowed, retryAfter } = checkRateLimit(ip, 'demo');
  if (!allowed) {
    return err(`Too many demo messages — try again in ${retryAfter}s`, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return err('Invalid request body');
  }

  const message = (body?.message || '').toString().trim();
  if (!message) return err('message required');
  if (message.length > MAX_MESSAGE_LENGTH) {
    return err(`Keep it under ${MAX_MESSAGE_LENGTH} characters for the demo`);
  }

  const imprintKey = IMPRINTS[body?.imprint] ? body.imprint : DEFAULT_IMPRINT;
  const imprint = IMPRINTS[imprintKey];

  const isAuto = !body?.model || body.model === 'auto';
  const routed = isAuto ? routeMessage(message) : null;
  const soulprintModel = isAuto ? routed.model : (MODEL_OVERRIDES[body.model] || DEFAULT_ROUTE.model);
  const routeReason = isAuto
    ? routed.reason
    : `you picked ${soulprintModel.label} directly`;

  const soulprintSystemPrompt = imprint.systemPrompt + MEMORY_NOTE;
  const soulprintMessages = buildMessages(body?.history, message);

  try {
    const [baselineText, soulprintText] = await Promise.all([
      getProvider(BASELINE_MODEL.provider, BASELINE_MODEL.value).generateChatCompletion({
        systemPrompt: BASELINE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }], // baseline never sees history — "resets every session"
        model: BASELINE_MODEL.value,
      }),
      getProvider(soulprintModel.provider, soulprintModel.value).generateChatCompletion({
        systemPrompt: soulprintSystemPrompt,
        messages: soulprintMessages,
        model: soulprintModel.value,
      }),
    ]);

    return ok({
      baseline: { label: 'Generic AI', text: baselineText },
      soulprint: {
        label: 'SoulPrint Engine',
        text: soulprintText,
        imprint: { key: imprintKey, name: imprint.name, icon: imprint.icon },
        model: soulprintModel.label,
        reason: routeReason,
        autoRouted: isAuto,
      },
    });
  } catch (e) {
    console.error('[HomepageDemo] generation error:', e.message);
    return err('Demo is temporarily unavailable — please try again shortly', 502);
  }
}
