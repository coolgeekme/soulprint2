import { NextResponse } from 'next/server';
import {
  seedPlans, getPlans, getPlan, updatePlan, syncPlansToStripe,
  getUserSubscription, createCheckoutSession, createCreditPackCheckout,
  getCheckoutStatus, cancelSubscription, getCustomerPortalUrl,
  trackUsage, getUsage, getUserUsageSummary,
  getVideoCredits, addVideoCredits,
  createDiscountCode, validateDiscountCode, getDiscountCodes, updateDiscountCode, deleteDiscountCode,
  startGracePeriod, startGracePeriodForAllUsers,
  handleStripeWebhook,
  getAdminSubscriptionOverview, adminSetUserPlan, getPaymentHistory,
} from '@/lib/handlers/pricing';
import { checkUserAccess } from '@/lib/handlers/access-check';
import { getUserEnforcementStatus, checkActionAllowed, getUserUsageSummary as getEnforcementUsage } from '@/lib/handlers/access-enforcement';
import jwt from 'jsonwebtoken';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}
function err(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// Auth helper
async function getAuthUser(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch {
    return null;
  }
}

async function requireAuth(request) {
  const user = await getAuthUser(request);
  if (!user) throw new Error('Unauthorized');
  return user;
}

async function requireAdmin(request) {
  const user = await requireAuth(request);
  const db = await getDb();
  const dbUser = await db.collection('users').findOne({ id: user.userId || user.id });
  if (!dbUser?.is_admin) throw new Error('Admin access required');
  return user;
}

// ══════════════════════════════════════════════════════════════════════════
// GET Routes
// ══════════════════════════════════════════════════════════════════════════

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');
  const url = new URL(request.url);

  try {
    // ── Public Routes ──────────────────────────────────────────────────

    // GET /api/pricing/gate — Check if pricing UI is visible for this user
    if (pathStr === 'gate') {
      const PRICING_LAUNCH_DATE = new Date('2026-05-01T00:00:00Z');
      const user = await getAuthUser(request);
      let role = null;
      if (user) {
        const db = await getDb();
        const dbUser = await db.collection('users').findOne({ id: user.userId || user.id });
        role = dbUser?.role || (dbUser?.is_admin ? 'admin' : 'user');
      }
      const isAdmin = role === 'admin' || role === 'superadmin';
      const isLive = new Date() >= PRICING_LAUNCH_DATE;
      return ok({ visible: isAdmin || isLive, launch_date: '2026-05-01T00:00:00Z', role });
    }

    // GET /api/pricing/plans — List all active plans
    if (pathStr === 'plans') {
      const plans = await getPlans();
      return ok({ plans });
    }

    // GET /api/pricing/credit-packs — List media credit packs
    if (pathStr === 'credit-packs') {
      const db = await getDb();
      const packs = await db.collection('media_credit_packs').find({ is_active: true }).toArray();
      return ok({ packs });
    }

    // ── Authenticated Routes ───────────────────────────────────────────

    // GET /api/pricing/access-check — User's plan limits vs usage for upgrade banners
    if (pathStr === 'access-check') {
      const user = await requireAuth(request);
      const db = await getDb();
      const dbUser = await db.collection('users').findOne({ id: user.userId || user.id });
      const role = dbUser?.role || (dbUser?.is_admin ? 'admin' : 'user');
      const accessData = await checkUserAccess(user.userId || user.id, role);
      if (!accessData) {
        return ok({ gated: true, message: 'Pricing not yet active' });
      }
      return ok(accessData);
    }

    // GET /api/pricing/enforcement — User's enforcement status (grace period, cohort, effective plan)
    if (pathStr === 'enforcement') {
      const user = await requireAuth(request);
      const status = await getUserEnforcementStatus(user.userId || user.id);
      return ok(status);
    }

    // GET /api/pricing/enforcement/usage — Full usage summary with limits
    if (pathStr === 'enforcement/usage') {
      const user = await requireAuth(request);
      const summary = await getEnforcementUsage(user.userId || user.id);
      return ok(summary);
    }

    // GET /api/pricing/enforcement/check?action=premium_model — Check if specific action is allowed
    if (pathStr === 'enforcement/check') {
      const user = await requireAuth(request);
      const action = url.searchParams.get('action');
      const model = url.searchParams.get('model');
      if (!action) return err('action query param required');
      const result = await checkActionAllowed(user.userId || user.id, action, { model });
      return ok(result);
    }

    // GET /api/pricing/subscription — Get current user's subscription
    if (pathStr === 'subscription') {
      const user = await requireAuth(request);
      const sub = await getUserSubscription(user.userId || user.id);
      const plan = await getPlan(sub.plan_id);
      return ok({ subscription: sub, plan });
    }

    // GET /api/pricing/usage — Get current user's usage
    if (pathStr === 'usage') {
      const user = await requireAuth(request);
      const summary = await getUserUsageSummary(user.userId || user.id);
      return ok(summary);
    }

    // GET /api/pricing/credits — Get current user's video credits
    if (pathStr === 'credits') {
      const user = await requireAuth(request);
      const credits = await getVideoCredits(user.userId || user.id);
      return ok(credits);
    }

    // GET /api/pricing/history — Get payment history
    if (pathStr === 'history') {
      const user = await requireAuth(request);
      const history = await getPaymentHistory(user.userId || user.id);
      return ok({ transactions: history });
    }

    // GET /api/pricing/checkout/status/:sessionId — Poll checkout status
    if (pathStr.startsWith('checkout/status/')) {
      const sessionId = pathArr[2];
      if (!sessionId) return err('Missing session ID');
      const status = await getCheckoutStatus(sessionId);
      return ok(status);
    }

    // GET /api/pricing/portal — Get Stripe customer portal URL
    if (pathStr === 'portal') {
      const user = await requireAuth(request);
      const returnUrl = url.searchParams.get('return_url') || `${url.protocol}//${url.host}/chat`;
      const portal = await getCustomerPortalUrl(user.userId || user.id, returnUrl);
      return ok(portal);
    }

    // ── Admin Routes ───────────────────────────────────────────────────

    // GET /api/pricing/admin/overview — Subscription statistics
    if (pathStr === 'admin/overview') {
      await requireAdmin(request);
      const overview = await getAdminSubscriptionOverview();
      return ok(overview);
    }

    // GET /api/pricing/admin/plans — All plans including inactive (auto-seeds if empty)
    if (pathStr === 'admin/plans') {
      await requireAdmin(request);
      let plans = await getPlans(true);
      if (!plans || plans.length === 0) {
        console.log('[Pricing] No plans found — auto-seeding defaults');
        await seedPlans();
        plans = await getPlans(true);
      }
      return ok({ plans });
    }

    // GET /api/pricing/admin/discounts — All discount codes
    if (pathStr === 'admin/discounts') {
      await requireAdmin(request);
      const codes = await getDiscountCodes(true);
      return ok({ discounts: codes });
    }

    // GET /api/pricing/admin/subscriptions — All user subscriptions
    if (pathStr === 'admin/subscriptions') {
      await requireAdmin(request);
      const db = await getDb();
      const subs = await db.collection('user_subscriptions').find({}).sort({ updated_at: -1 }).toArray();
      return ok({ subscriptions: subs });
    }

    return err('Not found', 404);
  } catch (error) {
    if (error.message === 'Unauthorized') return err('Unauthorized', 401);
    if (error.message === 'Admin access required') return err('Admin access required', 403);
    console.error('[Pricing GET] Error:', error);
    return err(error.message, 500);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// POST Routes
// ══════════════════════════════════════════════════════════════════════════

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // ── Stripe Webhook (no auth required) ──────────────────────────────
    if (pathStr === 'webhook/stripe') {
      const body = await request.text();
      const signature = request.headers.get('stripe-signature');
      const result = await handleStripeWebhook(body, signature);
      return ok(result);
    }

    // ── Public Routes ──────────────────────────────────────────────────

    // POST /api/pricing/discounts/validate — Validate a discount code
    if (pathStr === 'discounts/validate') {
      const { code } = await request.json();
      if (!code) return err('Code is required');
      const result = await validateDiscountCode(code);
      return ok(result);
    }

    // ── Authenticated Routes ───────────────────────────────────────────

    // POST /api/pricing/checkout — Create subscription checkout
    if (pathStr === 'checkout') {
      const user = await requireAuth(request);
      const { planId, billingPeriod, originUrl, discountCode } = await request.json();
      if (!planId || !billingPeriod || !originUrl) {
        return err('planId, billingPeriod, and originUrl are required');
      }
      const session = await createCheckoutSession(
        user.userId || user.id, planId, billingPeriod, originUrl, discountCode
      );
      return ok(session);
    }

    // POST /api/pricing/checkout/credits — Buy video credit pack
    if (pathStr === 'checkout/credits') {
      const user = await requireAuth(request);
      const { packId, originUrl } = await request.json();
      if (!packId || !originUrl) return err('packId and originUrl are required');
      const session = await createCreditPackCheckout(user.userId || user.id, packId, originUrl);
      return ok(session);
    }

    // POST /api/pricing/cancel — Cancel subscription
    if (pathStr === 'cancel') {
      const user = await requireAuth(request);
      const result = await cancelSubscription(user.userId || user.id);
      return ok(result);
    }

    // ── Admin Routes ───────────────────────────────────────────────────

    // POST /api/pricing/admin/seed — Seed default plans
    if (pathStr === 'admin/seed') {
      await requireAdmin(request);
      await seedPlans();
      return ok({ success: true, message: 'Plans seeded' });
    }

    // POST /api/pricing/admin/sync-stripe — Sync plans to Stripe
    if (pathStr === 'admin/sync-stripe') {
      await requireAdmin(request);
      await syncPlansToStripe();
      return ok({ success: true, message: 'Plans synced to Stripe' });
    }

    // POST /api/pricing/admin/plans/:planId — Update a plan
    if (pathStr.startsWith('admin/plans/') && pathArr.length === 3) {
      await requireAdmin(request);
      const planId = pathArr[2];
      const updates = await request.json();
      await updatePlan(planId, updates);
      return ok({ success: true });
    }

    // POST /api/pricing/admin/discounts — Create discount code
    if (pathStr === 'admin/discounts') {
      await requireAdmin(request);
      const body = await request.json();
      try {
        const code = await createDiscountCode(body);
        return ok({ success: true, discount: code });
      } catch (createErr) {
        if (createErr.message?.includes('already exists')) {
          return err(createErr.message, 400);
        }
        throw createErr;
      }
    }

    // POST /api/pricing/admin/discounts/:id/update — Update discount
    if (pathStr.startsWith('admin/discounts/') && pathStr.endsWith('/update')) {
      await requireAdmin(request);
      const codeId = pathArr[2];
      const updates = await request.json();
      await updateDiscountCode(codeId, updates);
      return ok({ success: true });
    }

    // POST /api/pricing/admin/discounts/:id/delete — Delete discount
    if (pathStr.startsWith('admin/discounts/') && pathStr.endsWith('/delete')) {
      await requireAdmin(request);
      const codeId = pathArr[2];
      await deleteDiscountCode(codeId);
      return ok({ success: true });
    }

    // POST /api/pricing/admin/user-plan — Override user's plan
    if (pathStr === 'admin/user-plan') {
      await requireAdmin(request);
      const { userId, planId, reason } = await request.json();
      if (!userId || !planId) return err('userId and planId are required');
      const result = await adminSetUserPlan(userId, planId, reason);
      return ok(result);
    }

    // POST /api/pricing/admin/grace-period — Start grace period for all users
    if (pathStr === 'admin/grace-period') {
      await requireAdmin(request);
      const { days } = await request.json();
      const result = await startGracePeriodForAllUsers(days || 14);
      return ok(result);
    }

    // POST /api/pricing/admin/grace-period/user — Start grace period for single user
    if (pathStr === 'admin/grace-period/user') {
      await requireAdmin(request);
      const { userId, days } = await request.json();
      if (!userId) return err('userId is required');
      await startGracePeriod(userId, days || 14);
      return ok({ success: true });
    }

    return err('Not found', 404);
  } catch (error) {
    if (error.message === 'Unauthorized') return err('Unauthorized', 401);
    if (error.message === 'Admin access required') return err('Admin access required', 403);
    console.error('[Pricing POST] Error:', error);
    return err(error.message, 500);
  }
}
