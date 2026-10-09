/**
 * Beta mode — the single switch that decides whether the product is in beta.
 *
 * WHY THIS EXISTS
 * ---------------
 * Passport's three core features (auto-extraction of memories, the MCP connector,
 * and custom Imprints) are gated on capability flags that only Pro and Team tiers
 * carry. Those flags are correct for a POST-launch product, but during beta nobody
 * has a paid subscription, so every user resolved to `free` — which meant all three
 * core features were switched off for all of them.
 *
 * The old safety net covered this only until May 2026: `PRICING_LAUNCH_DATE`
 * (2026-05-01) granted unrestricted access before launch, and the OG/early grace
 * windows ended 2026-05-31 and 2026-05-14. Once those passed, every non-paying user
 * silently fell to free, while /pricing went on promising "everything included".
 *
 * So this module is the honest version of that promise: while beta is on, a user
 * with no paid subscription is treated as Pro-equivalent.
 *
 * TURNING IT OFF
 * --------------
 * Set `BETA_MODE=false` in the environment. Nothing else needs to change — every
 * caller reads this one function. At that point users fall back to the real tier
 * resolution below it (subscription → admin → team domain → free), which is the
 * correct post-launch behaviour and already tested.
 *
 * It defaults to ON deliberately: the failure mode of "beta ended but the switch is
 * still on" is that we give away features we meant to charge for, which is
 * recoverable. The failure mode of the opposite — beta is running but access is off,
 * which is what actually happened — is a product that appears broken to every user.
 *
 * SCOPE
 * -----
 * This grants FEATURE access only. It does not create a subscription, does not make
 * anyone a paying customer, and does not affect billing. Real subscribers resolve
 * exactly as they did before, because their branch is checked first in each caller.
 */

/** True while the product is in beta. Defaults to true; set BETA_MODE=false to end it. */
export function isBetaMode() {
  // Explicit opt-out only. Anything other than the literal string 'false' means beta.
  return process.env.BETA_MODE !== 'false';
}

/**
 * The tier id used for beta users. 'pro' is deliberate rather than a new tier:
 * IDENTITY_TIERS.pro already carries every capability a beta user should have
 * (mcpAccess, autoExtraction, customImprints, advancedSearch), so reusing it keeps
 * the three mirrored tier tables in agreement instead of adding a fourth concept
 * that could drift.
 */
export const BETA_TIER_ID = 'pro';

/**
 * Should this user be granted beta access?
 *
 * Returns false for anyone with a real subscription — not to deny them anything, but
 * because their own branch resolves correctly and beta should not mask a billing
 * problem. An expired or cancelled subscription falling back to beta access is the
 * behaviour we want anyway: we are in beta, everything is included.
 *
 * @param {object|null} subscription  the user's user_subscriptions doc, if any
 */
export function betaGrantsAccess(subscription) {
  if (!isBetaMode()) return false;
  // A live paid subscription resolves through its own plan; leave it alone.
  if (subscription?.plan_id && subscription.plan_id !== 'free' && subscription.status === 'active') {
    return false;
  }
  return true;
}
