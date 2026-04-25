/**
 * Feature Gates — Controls visibility of features before public launch
 * 
 * Usage:
 *   import { isPricingVisible } from '@/lib/feature-gates';
 *   if (isPricingVisible(user?.role)) { show pricing UI }
 * 
 * Admin/superadmin users can always see gated features.
 * Public users see features only after the launch date.
 */

// ── Launch Dates ────────────────────────────────────────────────────────
const PRICING_LAUNCH_DATE = new Date('2026-05-01T00:00:00Z');

// ── Gate Checks ─────────────────────────────────────────────────────────

export function isPricingVisible(userRole) {
  if (userRole === 'admin' || userRole === 'superadmin') return true;
  return new Date() >= PRICING_LAUNCH_DATE;
}

export function isPricingLive() {
  return new Date() >= PRICING_LAUNCH_DATE;
}

// Server-side gate check (for API routes)
export function checkPricingGate(userRole) {
  if (!isPricingVisible(userRole)) {
    return { gated: true, message: 'Pricing is not yet available. Launching May 1st, 2026.' };
  }
  return { gated: false };
}
