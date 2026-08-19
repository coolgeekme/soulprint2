// MCP tier gating (Pro/Team only). The soulprint-mcp server sends an
// `x-soulprint-client: mcp` header; the Chrome extension does NOT, so this gate
// only affects MCP clients and leaves the extension (the free-tier path) untouched.
//
// Mirrors IDENTITY_TIERS / resolveIdentityTier in app/api/auth/[...path]/route.js
// and getImprintAccess in imprints.js — keep these tier tables in sync when
// plans or tier capabilities change.

import { getDb } from '@/lib/mongodb';
import { err } from '@/lib/api-utils';
import { isTeamProEmail } from '@/lib/handlers/team-access';

const MCP_ACCESS_BY_TIER = {
  free: false,
  plus: false,
  pro: true,
  family: false,
  team: true,
};

const PLAN_TO_TIER = {
  free: 'free',
  base: 'plus',
  power: 'pro',
  pro: 'pro',
  plus: 'plus',
  family: 'family',
  team: 'team',
};

export function isMcpRequest(request) {
  return (request.headers.get('x-soulprint-client') || '').toLowerCase() === 'mcp';
}

export async function getMcpAccess(user) {
  try {
    // Explicit identity-tier override on the user doc — matches resolveIdentityTier precedence.
    if (user?.identity_tier && MCP_ACCESS_BY_TIER[user.identity_tier] !== undefined) {
      return MCP_ACCESS_BY_TIER[user.identity_tier];
    }
    // Superadmin/Admin — Pro-equivalent.
    if (user?.role === 'superadmin' || user?.role === 'admin') return true;
    // Team Pro domain (@archeforge.com, etc.).
    if (user?.email && isTeamProEmail(user.email)) return true;
    // Active subscription → mapped tier; unknown paid plan → Pro; none → Free.
    const db = await getDb();
    const sub = await db.collection('user_subscriptions').findOne(
      { user_id: user.id, status: 'active' },
      { projection: { plan_id: 1 } },
    );
    const tierId = sub ? (PLAN_TO_TIER[sub.plan_id] || 'pro') : 'free';
    return MCP_ACCESS_BY_TIER[tierId] ?? false;
  } catch (e) {
    // Fail closed — deny MCP access on any resolution error.
    console.error('[getMcpAccess] Error:', e.message);
    return false;
  }
}

// Returns a 403 response when an MCP request comes from a user without MCP access;
// returns null otherwise (non-MCP traffic is unaffected).
export async function gateMcpRequest(request, user) {
  if (isMcpRequest(request) && !(await getMcpAccess(user))) {
    return err('MCP access requires a Pro or Team plan. Upgrade at soulprintengine.ai/pricing.', 403);
  }
  return null;
}
