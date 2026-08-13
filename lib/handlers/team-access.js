/**
 * Team Pro Domain Access
 * Certain company domains (e.g., @archeforge.com) get automatic Pro-tier access.
 */

const TEAM_PRO_DOMAINS = ['archeforge.com'];

export function isTeamProEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return TEAM_PRO_DOMAINS.includes(domain);
}
