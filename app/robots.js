import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt — generated at /robots.txt by the Next.js metadata API.
 *
 * Two groups on purpose:
 *
 * 1. The default `*` rule keeps the app surface out of every index. Anything
 *    behind a login, mid-funnel, or a duplicate of a live page is listed in
 *    PRIVATE_PATHS.
 *
 * 2. AI assistants get an explicit, named allow. SoulPrint is an AI-native
 *    product and being readable by answer engines is a growth channel, not a
 *    leak — but that has to be stated, because a crawler that honors robots.txt
 *    will otherwise inherit the conservative default. Named agents are listed
 *    individually so the intent survives any future tightening of the `*` rule.
 *
 * `/api/blog/image/` is re-allowed beneath the `/api/` block: crawlers need it
 * to fetch post images, and longest-match means the Allow wins.
 */

/** Never index these: private app surface, mid-funnel steps, and archived duplicates. */
const PRIVATE_PATHS = [
  '/admin',
  '/api/',
  '/activate',
  '/assessment',
  '/auth',
  '/chat',
  '/feedback',
  '/invite/',
  '/lp/',
  '/memories',
  '/mockup/',
  '/og-pages/',
  '/onboarding',
  '/pitch',
  '/purchase/',
  '/shared/',
  '/subscription/',
  '/test-composite',
  '/thank-you',
  '/verify-email',
  '/waitlist',
];

/** Answer engines and AI crawlers we want to serve. */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'cohere-ai',
  'meta-externalagent',
  'DuckAssistBot',
  'YouBot',
  'MistralAI-User',
];

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/blog/image/'],
        disallow: PRIVATE_PATHS,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ['/', '/api/blog/image/'],
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
