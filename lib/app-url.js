/**
 * The one place that decides what public URL to put in a user-facing link.
 *
 * WHY THIS EXISTS
 * The Emergent preview host gets written into NEXT_PUBLIC_BASE_URL in some
 * environments, and several call sites read that env var directly. That shipped
 * https://soulprint-engine.preview.emergentagent.com inside account-verification
 * emails — an internal preview domain, in a link a real user clicks.
 *
 * Any code building a link that leaves the app (email, OAuth redirect, device
 * login) must call getAppUrl() rather than reading the env var itself.
 */

const PRODUCTION_URL = 'https://soulprintengine.ai';

// Hosts that are internal infrastructure and must never appear in a user-facing link.
const INTERNAL_HOSTS = [
  'preview.emergentagent.com',
  'emergentagent.com',
  'emergent.host',
  'localhost',
  '127.0.0.1',
];

export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_BASE_URL;

  if (!configured) return PRODUCTION_URL;
  if (INTERNAL_HOSTS.some(h => configured.includes(h))) return PRODUCTION_URL;

  return configured;
}

/** True when the configured base URL is internal infrastructure. */
export function isInternalBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_BASE_URL;
  return !!configured && INTERNAL_HOSTS.some(h => configured.includes(h));
}
