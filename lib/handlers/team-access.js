/**
 * Team Pro Access
 *
 * Company domains get automatic Pro-tier access, plus named individuals whose address sits on
 * a personal domain. The founder's own account is the reason the email list exists: it runs on
 * a personal domain, so a domain-only rule silently left him on Free — no auto-extraction, a
 * 10-memory cap — while the product was telling everyone else it worked.
 *
 * THIS LIST IS THE ONLY SOURCE OF TRUTH. Every entitlement path must call isTeamProEmail()
 * rather than re-testing a domain inline; the old inline `endsWith('@archeforge.com')` in
 * access-enforcement drifted from this file the moment the rule changed.
 */

export const TEAM_PRO_DOMAINS = ['archeforge.com'];

export const TEAM_PRO_EMAILS = ['reggie@coolgeek.me'];

export function isTeamProEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  // Require a real address: a local part AND a domain. Splitting on '@' and reading index 1
  // makes '@archeforge.com' look like a team member, which is a stranger's malformed input
  // away from granting Pro to an empty account.
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return false;
  const domain = normalized.slice(at + 1);
  if (!domain.includes('.')) return false;

  if (TEAM_PRO_EMAILS.includes(normalized)) return true;
  return TEAM_PRO_DOMAINS.includes(domain);
}


/**
 * Bootstrap admins.
 *
 * Admin is a `users.role` value, read by ~37 separate checks across the API and UI, so there
 * is no "admin list" to append to. That also means an account whose role was never set cannot
 * grant itself the role through the admin API — the handler that changes roles requires a
 * superadmin to call it. Chicken and egg.
 *
 * This list is the bootstrap out of that: an address here is treated as `admin` wherever
 * identity is resolved, without waiting for a database edit. It is deliberately short, it is
 * code (so it is reviewable and survives a database restore), and it should stay that way —
 * every entry is a standing privilege grant.
 */
export const BOOTSTRAP_ADMIN_EMAILS = ['reggie@coolgeek.me'];

export function isBootstrapAdmin(email) {
  if (!email || typeof email !== 'string') return false;
  return BOOTSTRAP_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Resolve the effective role for a user record.
 *
 * Bootstrap admins are elevated to `admin` here rather than at each of the 37 call sites, so
 * every entitlement path sees one consistent answer.
 */
export function effectiveRole(user) {
  if (!user) return null;
  if (isBootstrapAdmin(user.email)) return 'admin';
  return user.role || null;
}
