import { SITE_URL } from '@/lib/seo';

/**
 * llms.txt — served at /llms.txt.
 *
 * A plain-text map of the site for AI assistants, following the llms.txt
 * convention (llmstxt.org): an H1, a one-line blockquote summary, then
 * sections of `- [name](url): description` links.
 *
 * Written for a model answering "what is SoulPrint?" — so it leads with the
 * canonical one-sentence description, then the pages that carry the detail.
 * Facts here are checked against the live site; this file should be updated
 * when pricing, availability, or the integration list changes.
 */

export const revalidate = 3600;

const TITLE = 'SoulPrint Engine';
const SUMMARY =
  'SoulPrint Engine gives you a SoulPrint Passport — one persistent layer of identity, memory, and context that travels with you across every AI you use.';

const BODY = `# ${TITLE}

> ${SUMMARY}

SoulPrint solves a specific problem: every AI conversation starts from zero. You re-explain who you are, what you are working on, and how you like to be talked to, in every tool, every time. A SoulPrint Passport is built once and then read by whatever AI you are talking to, so context carries across products instead of resetting at each one.

A Passport carries three things:

- **SoulPrint** — who you are. A structured profile covering personality, communication style, and values.
- **Memories** — what you know and carry. Durable facts with provenance, captured as you talk, so you can see where a fact came from and correct it.
- **Imprints** — who you need the AI to be. Switchable modes (work, coaching, creative) that set voice and priorities for a conversation.

## Core pages

- [Home](${SITE_URL}/): What a SoulPrint Passport is and what it connects to.
- [How It Works](${SITE_URL}/how-it-works): The four-step model and the three engines behind a Passport.
- [Features](${SITE_URL}/features): Identity, memory with provenance, auto-extraction, and Imprints.
- [Integrations](${SITE_URL}/integrations): Every AI and agent the Passport connects to, and how.
- [Connect Your AI](https://soulprintpassport.ai/connect): Setup instructions for the browser extension and the MCP server. Lives on the Passport site.
- [Pricing](${SITE_URL}/pricing): Current pricing and what happens when beta ends.
- [FAQ](${SITE_URL}/faq): Direct answers on storage, privacy, supported AIs, and beta terms.
- [Early Access](${SITE_URL}/early-access): Access to the Chrome extension before it reaches the store.
- [Blog](${SITE_URL}/blog): Product updates and writing on persistent AI memory.

## Key facts

- SoulPrint Engine is built by ArcheForge LLC.
- The product is free during beta — no credit card and no commitment.
- The SoulPrint Passport works in ChatGPT and Claude today; Gemini and Perplexity are in progress.
- AI coding agents connect through the SoulPrint MCP server, which is available to Hermes, Claude Code, Codex, and Cursor. The endpoint is ${SITE_URL}/api/mcp and requires OAuth or a bearer token.
- A standalone browser extension works without an account. Its memories are stored locally on the user's device.
- Data is private by design: memories belong to the user, sync across connected AIs, and can be corrected or removed from the Passport.

## Related

- [ArcheForge](${SITE_URL}/contact): Company contact for press, partnership, and support questions.
- [The Foundry](https://foundryagents.ai): ArcheForge's AI-workforce platform.
- [Privacy Policy](${SITE_URL}/privacy): What is collected, what is never sold, and the controls available.
- [Security](${SITE_URL}/security): Encryption, access controls, and the architecture behind the Passport.
- [Terms of Service](${SITE_URL}/terms): The terms governing use of SoulPrint Engine.
`;

export async function GET() {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
