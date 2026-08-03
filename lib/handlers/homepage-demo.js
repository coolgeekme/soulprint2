/**
 * Homepage live demo — anonymous "SoulPrint vs a stock model" comparison.
 * No auth, no persistence: a visitor sends one message and gets back two
 * responses side-by-side so they can feel the difference before signing up.
 */
import { getProvider } from '@/lib/llm/providers';
import { ok, err, getClientIP, checkRateLimit } from '@/lib/api-utils';

// Deliberately smaller/cheaper models than the authenticated app uses —
// this endpoint is unauthenticated and cost-bearing per request.
const DEMO_MODELS = {
  auto:      { value: 'gpt-4o-mini',               provider: 'openai',    label: 'Auto' },
  'gpt-4o':  { value: 'gpt-4o',                    provider: 'openai',    label: 'GPT-4o' },
  gemini:    { value: 'gemini-2.0-flash',          provider: 'gemini',    label: 'Gemini' },
  claude:    { value: 'claude-3-5-haiku-20241022', provider: 'anthropic', label: 'Claude' },
};

const MAX_MESSAGE_LENGTH = 600;

const BASELINE_SYSTEM_PROMPT =
  'You are a helpful, generic AI assistant. Answer directly and concisely.';

const SOULPRINT_DEMO_SYSTEM_PROMPT = `You are SoulPrint Engine — an AI built to learn a person's identity (their tone, decision style, communication cadence, and preferences) and carry that context into every future conversation, unlike stock AI assistants that forget the user the moment a session ends.

This is a public, unauthenticated demo, so you have no real persisted memory of this visitor yet. Answer their message helpfully and with personality, and briefly note — naturally, in one short sentence at most — that a real SoulPrint account is what would let you remember this and adapt to them permanently. Never fabricate specific facts about the visitor as if you already know them.`;

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

  const modelKey = DEMO_MODELS[body?.model] ? body.model : 'auto';
  const { value: modelValue, provider: providerName, label } = DEMO_MODELS[modelKey];

  try {
    const [baselineText, soulprintText] = await Promise.all([
      getProvider(providerName, modelValue).generateChatCompletion({
        systemPrompt: BASELINE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
        model: modelValue,
      }),
      getProvider(providerName, modelValue).generateChatCompletion({
        systemPrompt: SOULPRINT_DEMO_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
        model: modelValue,
      }),
    ]);

    return ok({
      baseline: { label, text: baselineText },
      soulprint: { label: 'SoulPrint Engine', text: soulprintText },
    });
  } catch (e) {
    console.error('[HomepageDemo] generation error:', e.message);
    return err('Demo is temporarily unavailable — please try again shortly', 502);
  }
}
