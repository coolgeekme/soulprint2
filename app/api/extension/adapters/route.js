import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

/**
 * GET /api/extension/adapters
 *
 * The extension's per-assistant configuration: which hostnames it applies to, which URL
 * patterns carry the message payload, and how to inject. Fetched by the background
 * worker and cached for an hour.
 *
 * WHY THIS IS SERVED RATHER THAN BUNDLED
 * Assistant APIs and reply selectors change whenever a site ships a redesign. When that
 * lived in the extension bundle, every fix cost a version bump and a Chrome Web Store
 * review. Served from here, a selector fix takes effect within the cache window.
 *
 * STRATEGY NAMES ARE CODE. An adapter names a strategy that ships in the extension
 * (`system-message`, `prepend-prompt`, `prepend-last-message`). A new assistant that
 * reuses one of those needs only a row in the collection. A genuinely new request shape
 * still needs a build — that boundary is deliberate, and the client rejects unknown
 * strategies rather than failing silently.
 *
 * FALLBACK ALWAYS COVERS WHAT SHIPPED. If the database is unreachable the response is
 * the built-in set, so this endpoint being down can never remove support for a platform
 * that already works on the user's machine.
 */

const FALLBACK = {
  version: 1,
  adapters: [
    {
      id: 'chatgpt',
      hostnames: ['chatgpt.com', 'chat.openai.com'],
      // Both namespaces carry a /f/ segment — /backend-anon/f/conversation (logged out)
      // and /backend-api/f/conversation (logged in). Omitting /f/ silently skipped
      // injection for logged-in sessions.
      apiPatterns: ['/backend-anon/f/conversation', '/backend-api/f/conversation'],
      strategy: 'system-message',
      assistantSelector: '[data-message-author-role="assistant"]',
    },
    {
      id: 'claude',
      hostnames: ['claude.ai'],
      apiPatterns: ['api/organizations', 'completion', 'append_message'],
      strategy: 'prepend-prompt',
      assistantSelector:
        '[class*="message-row"]:not(:has([data-testid="user-message"])), ' +
        '[data-testid="assistant-message"], [class*="font-claude-message"]',
    },
  ],
};

const VALID_STRATEGIES = new Set(['system-message', 'prepend-prompt', 'prepend-last-message', 'generic-chat']);

/** Drop anything the client would reject anyway, so one bad row can't poison the set. */
function sanitise(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const a of raw) {
    if (!a || typeof a.id !== 'string' || !a.id) continue;
    if (!Array.isArray(a.hostnames) || !a.hostnames.length) continue;
    if (!VALID_STRATEGIES.has(a.strategy)) continue;
    out.push({
      id: a.id,
      hostnames: a.hostnames.map(String),
      apiPatterns: Array.isArray(a.apiPatterns) ? a.apiPatterns.map(String) : [],
      strategy: a.strategy,
      assistantSelector: typeof a.assistantSelector === 'string' ? a.assistantSelector : null,
    });
  }
  return out;
}

export async function GET() {
  const headers = {
    // Short max-age: a selector fix should reach clients quickly, and the client already
    // caches locally for an hour, so a tight edge cache costs nothing.
    'Cache-Control': 'public, max-age=300, s-maxage=300',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const db = await getDb();
    const doc = await db.collection('extension_adapters').findOne({ _id: 'current' });
    const adapters = sanitise(doc?.adapters);
    if (adapters.length) {
      return NextResponse.json(
        { version: doc?.version || 1, adapters, source: 'db' },
        { headers }
      );
    }
  } catch (err) {
    console.error('[extension/adapters] database read failed:', err?.message);
  }

  return NextResponse.json({ ...FALLBACK, source: 'fallback' }, { headers });
}
