/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACCESS ENFORCEMENT ENGINE — Phase 5
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Determines a user's effective access level based on:
 *   1. Registration date (cohort classification)
 *   2. Grace period status
 *   3. Assessment completion (for new trial users)
 *   4. Current subscription plan
 *   5. Admin/superadmin exemption
 * 
 * Cohorts:
 *   - 'og'         → Registered before April 1, 2026. Full access until May 31, 2026.
 *   - 'early'      → Registered April 1 – May 1, 2026. Full access until May 15, 2026.
 *   - 'new_trial'  → Registered after May 1, 2026. Base-plan trial until assessment
 *                     complete OR any plan limit hit.
 *   - 'subscribed' → Has an active paid subscription (Base or Power).
 *   - 'admin'      → Admin/superadmin, always exempt from enforcement.
 * 
 * After grace period expires:
 *   - Soft block: Premium models visible but greyed out with "Upgrade to unlock"
 *   - Old conversations using premium models show fallback notice
 *   - Daily message limit enforced for Free plan (50/day)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getDb } from '@/lib/mongodb';

// ── Key Dates ───────────────────────────────────────────────────────────────
const PRICING_LAUNCH_DATE = new Date('2026-05-01T00:00:00Z');
const OG_CUTOFF_DATE = new Date('2026-04-01T00:00:00Z');
const OG_GRACE_END = new Date('2026-05-31T23:59:59Z');
const EARLY_GRACE_END = new Date('2026-05-15T23:59:59Z');

// ── Plan Feature Defaults (used for trial equivalents) ──────────────────────
const BASE_TRIAL_FEATURES = {
  chat_model_tier: 'all',
  premium_chat: true,
  premium_chat_msgs_per_month: 50,
  standard_msgs_per_day: null, // unlimited during trial
  images_per_month: 50,
  image_watermark: false,
  videos_per_month: 1,
  video_duration_sec: 5,
  video_resolution: '720p',
  pdfs_per_month: 25,
  voice_chat: true,
  voice_minutes_per_month: 30,
  file_analysis_advanced: true,
  conversation_search: true,
};

const UNRESTRICTED_FEATURES = {
  chat_model_tier: 'all',
  premium_chat: true,
  premium_chat_unlimited: true,
  standard_msgs_per_day: null,
  images_per_month: null,
  image_watermark: false,
  videos_per_month: null,
  video_duration_sec: null,
  video_resolution: 'all',
  pdfs_per_month: null,
  voice_chat: true,
  voice_unlimited: true,
  file_analysis_advanced: true,
  conversation_search: true,
};

/**
 * Get a user's enforcement status — the single source of truth for access control.
 * 
 * @param {string} userId - The user's UUID
 * @returns {Object} Enforcement status object
 */
export async function getUserEnforcementStatus(userId) {
  const db = await getDb();
  const now = new Date();
  
  // ── Fetch user data ───────────────────────────────────────────────────────
  const user = await db.collection('users').findOne({ id: userId });
  if (!user) {
    return {
      cohort: 'unknown',
      enforcement_active: true,
      effective_plan: 'free',
      effective_features: null,
      grace_expires_at: null,
      days_remaining: 0,
      show_countdown: false,
      assessment_complete: false,
      is_trial: false,
      trial_limit_hit: false,
      error: 'User not found',
    };
  }

  // ── Admin exemption ───────────────────────────────────────────────────────
  if (user.role === 'admin' || user.role === 'superadmin') {
    return {
      cohort: 'admin',
      enforcement_active: false,
      effective_plan: 'power',
      effective_features: UNRESTRICTED_FEATURES,
      grace_expires_at: null,
      days_remaining: null,
      show_countdown: false,
      assessment_complete: true,
      is_trial: false,
      trial_limit_hit: false,
    };
  }

  // ── Fetch subscription & profile ──────────────────────────────────────────
  const subscription = await db.collection('user_subscriptions').findOne({ user_id: userId });
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  
  const planId = subscription?.plan_id || 'free';
  const registeredAt = user.created_at ? new Date(user.created_at) : now;
  const assessmentComplete = profile?.assessment_complete === true;

  // ── Active paid subscriber — no enforcement needed ────────────────────────
  if (planId !== 'free' && subscription?.status === 'active') {
    const plan = await db.collection('subscription_plans').findOne({ id: planId });
    return {
      cohort: 'subscribed',
      enforcement_active: false,
      effective_plan: planId,
      effective_features: plan?.features || UNRESTRICTED_FEATURES,
      grace_expires_at: null,
      days_remaining: null,
      show_countdown: false,
      assessment_complete: assessmentComplete,
      is_trial: false,
      trial_limit_hit: false,
    };
  }

  // ── Pre-launch: No enforcement active yet ─────────────────────────────────
  if (now < PRICING_LAUNCH_DATE) {
    return {
      cohort: classifyCohort(registeredAt),
      enforcement_active: false,
      effective_plan: 'power_equivalent',
      effective_features: UNRESTRICTED_FEATURES,
      grace_expires_at: getGraceEndDate(registeredAt),
      days_remaining: getDaysRemaining(getGraceEndDate(registeredAt), now),
      show_countdown: false, // Don't show countdown before launch
      assessment_complete: assessmentComplete,
      is_trial: false,
      trial_limit_hit: false,
    };
  }

  // ── Post-launch logic ─────────────────────────────────────────────────────
  const cohort = classifyCohort(registeredAt);
  const graceEnd = getGraceEndDate(registeredAt);
  const daysRemaining = getDaysRemaining(graceEnd, now);
  const graceActive = graceEnd && now <= graceEnd;

  // ── OG / Early users still in grace period ────────────────────────────────
  if ((cohort === 'og' || cohort === 'early') && graceActive) {
    return {
      cohort,
      enforcement_active: false,
      effective_plan: 'power_equivalent',
      effective_features: UNRESTRICTED_FEATURES,
      grace_expires_at: graceEnd,
      days_remaining: daysRemaining,
      show_countdown: daysRemaining <= 7,
      assessment_complete: assessmentComplete,
      is_trial: false,
      trial_limit_hit: false,
    };
  }

  // ── New user trial (post May 1, assessment not complete) ──────────────────
  if (cohort === 'new_user' && !assessmentComplete) {
    // Check if they've hit any trial limits
    const trialLimitHit = await checkTrialLimitsHit(userId, db);
    
    if (!trialLimitHit) {
      return {
        cohort: 'new_trial',
        enforcement_active: false, // Trial is active, no enforcement yet
        effective_plan: 'base_trial',
        effective_features: BASE_TRIAL_FEATURES,
        grace_expires_at: null, // No fixed date — ends on assessment/limit
        days_remaining: null,
        show_countdown: false,
        assessment_complete: false,
        is_trial: true,
        trial_limit_hit: false,
      };
    }
    
    // Trial limit hit — must choose a plan
    return {
      cohort: 'new_trial',
      enforcement_active: true,
      effective_plan: 'free',
      effective_features: await getFreePlanFeatures(db),
      grace_expires_at: null,
      days_remaining: 0,
      show_countdown: false,
      assessment_complete: false,
      is_trial: false,
      trial_limit_hit: true,
      choose_plan_prompt: true,
    };
  }

  // ── New user post-assessment (assessment complete, still on free) ──────────
  if (cohort === 'new_user' && assessmentComplete && planId === 'free') {
    return {
      cohort: 'post_trial',
      enforcement_active: true,
      effective_plan: 'free',
      effective_features: await getFreePlanFeatures(db),
      grace_expires_at: null,
      days_remaining: 0,
      show_countdown: false,
      assessment_complete: true,
      is_trial: false,
      trial_limit_hit: false,
      choose_plan_prompt: true,
    };
  }

  // ── Grace expired for OG/Early users ──────────────────────────────────────
  if ((cohort === 'og' || cohort === 'early') && !graceActive) {
    return {
      cohort,
      enforcement_active: true,
      effective_plan: 'free',
      effective_features: await getFreePlanFeatures(db),
      grace_expires_at: graceEnd,
      days_remaining: 0,
      show_countdown: false,
      assessment_complete: assessmentComplete,
      is_trial: false,
      trial_limit_hit: false,
    };
  }

  // ── Fallback: enforce free plan ───────────────────────────────────────────
  return {
    cohort: cohort || 'unknown',
    enforcement_active: true,
    effective_plan: 'free',
    effective_features: await getFreePlanFeatures(db),
    grace_expires_at: graceEnd,
    days_remaining: 0,
    show_countdown: false,
    assessment_complete: assessmentComplete,
    is_trial: false,
    trial_limit_hit: false,
  };
}

/**
 * Check if a specific action is allowed for the user.
 * This is the primary enforcement gate — called before premium model access,
 * image/video generation, voice, and PDF generation.
 * 
 * @param {string} userId
 * @param {string} action - One of: 'premium_model', 'standard_message', 'image_generation',
 *                          'video_generation', 'voice_chat', 'pdf_generation', 'conversation_search'
 * @param {Object} context - Additional context (e.g., { model: 'gpt-5.2' })
 * @returns {Object} { allowed: true } or { allowed: false, reason, upgrade_url, alternatives }
 */
export async function checkActionAllowed(userId, action, context = {}) {
  const status = await getUserEnforcementStatus(userId);
  
  // No enforcement — everything allowed
  if (!status.enforcement_active) {
    return { allowed: true, status };
  }

  const features = status.effective_features;
  if (!features) {
    return { allowed: false, reason: 'Unable to determine plan features', status };
  }

  const db = await getDb();

  switch (action) {
    case 'premium_model': {
      if (!features.premium_chat) {
        return {
          allowed: false,
          reason: 'Premium models require a Base or Power subscription',
          upgrade_url: '/pricing',
          alternatives: await getStandardModels(),
          soft_block: true,
          status,
        };
      }
      // Check monthly premium message limit
      if (features.premium_chat_msgs_per_month && !features.premium_chat_unlimited) {
        const used = await getPremiumMsgsUsedThisMonth(userId, db);
        if (used >= features.premium_chat_msgs_per_month) {
          return {
            allowed: false,
            reason: `You've used all ${features.premium_chat_msgs_per_month} premium messages this month`,
            upgrade_url: '/pricing',
            add_on_available: true,
            add_on_type: 'premium_messages',
            used,
            limit: features.premium_chat_msgs_per_month,
            soft_block: true,
            status,
          };
        }
      }
      return { allowed: true, status };
    }

    case 'standard_message': {
      if (features.standard_msgs_per_day) {
        const used = await getStandardMsgsUsedToday(userId, db);
        if (used >= features.standard_msgs_per_day) {
          return {
            allowed: false,
            reason: `You've reached your daily limit of ${features.standard_msgs_per_day} messages. Upgrade to keep chatting, or come back tomorrow.`,
            upgrade_url: '/pricing',
            used,
            limit: features.standard_msgs_per_day,
            resets_at: getNextMidnightUTC(),
            soft_block: true,
            status,
          };
        }
      }
      return { allowed: true, status };
    }

    case 'image_generation': {
      if (features.images_per_month === 0) {
        return {
          allowed: false,
          reason: 'Image generation is not available on your current plan',
          upgrade_url: '/pricing',
          soft_block: true,
          status,
        };
      }
      if (features.images_per_month !== null) {
        const used = await getImagesUsedThisMonth(userId, db);
        if (used >= features.images_per_month) {
          return {
            allowed: false,
            reason: `You've used all ${features.images_per_month} images this month`,
            upgrade_url: '/pricing',
            add_on_available: true,
            add_on_type: 'media_credits',
            used,
            limit: features.images_per_month,
            soft_block: true,
            status,
          };
        }
      }
      // Check hourly rate limit
      if (features.image_rate_limit_per_hour) {
        const usedThisHour = await getImagesUsedThisHour(userId, db);
        if (usedThisHour >= features.image_rate_limit_per_hour) {
          return {
            allowed: false,
            reason: `Rate limit: max ${features.image_rate_limit_per_hour} images per hour. Try again soon.`,
            rate_limited: true,
            status,
          };
        }
      }
      return { allowed: true, watermark: features.image_watermark || false, status };
    }

    case 'video_generation': {
      if (features.videos_per_month === 0 || features.videos_per_month === null && features.chat_model_tier === 'standard') {
        return {
          allowed: false,
          reason: 'Video generation is not available on the Free plan',
          upgrade_url: '/pricing',
          add_on_available: true,
          add_on_type: 'media_credits',
          soft_block: true,
          status,
        };
      }
      if (features.videos_per_month !== null) {
        const used = await getVideosUsedThisMonth(userId, db);
        if (used >= features.videos_per_month) {
          return {
            allowed: false,
            reason: `You've used your ${features.videos_per_month} video${features.videos_per_month > 1 ? 's' : ''} this month`,
            upgrade_url: '/pricing',
            add_on_available: true,
            add_on_type: 'media_credits',
            used,
            limit: features.videos_per_month,
            soft_block: true,
            status,
          };
        }
      }
      return { allowed: true, watermark: features.video_watermark || false, status };
    }

    case 'voice_chat': {
      if (!features.voice_chat) {
        return {
          allowed: false,
          reason: 'Voice chat requires a Base or Power subscription',
          upgrade_url: '/pricing',
          soft_block: true,
          status,
        };
      }
      if (features.voice_minutes_per_month && !features.voice_unlimited) {
        const used = await getVoiceMinutesUsedThisMonth(userId, db);
        if (used >= features.voice_minutes_per_month) {
          return {
            allowed: false,
            reason: `You've used all ${features.voice_minutes_per_month} voice minutes this month`,
            upgrade_url: '/pricing',
            used,
            limit: features.voice_minutes_per_month,
            soft_block: true,
            status,
          };
        }
      }
      return { allowed: true, status };
    }

    case 'pdf_generation': {
      if (features.pdfs_per_month !== null && features.pdfs_per_month !== undefined) {
        const used = await getPdfsUsedThisMonth(userId, db);
        if (used >= features.pdfs_per_month) {
          return {
            allowed: false,
            reason: `You've used all ${features.pdfs_per_month} PDF generations this month`,
            upgrade_url: '/pricing',
            used,
            limit: features.pdfs_per_month,
            soft_block: true,
            status,
          };
        }
      }
      return { allowed: true, status };
    }

    case 'conversation_search': {
      if (!features.conversation_search) {
        return {
          allowed: false,
          reason: 'Conversation search requires a Base or Power subscription',
          upgrade_url: '/pricing',
          soft_block: true,
          status,
        };
      }
      return { allowed: true, status };
    }

    default:
      return { allowed: true, status };
  }
}

/**
 * Record usage for a specific action (call AFTER the action succeeds).
 * 
 * @param {string} userId
 * @param {string} action - 'standard_message', 'premium_message', 'image', 'video', 'pdf', 'voice_minute'
 * @param {Object} metadata - Additional data (e.g., { model: 'gpt-5.2', credits_used: 5 })
 */
export async function recordUsage(userId, action, metadata = {}) {
  const db = await getDb();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const monthStr = todayStr.substring(0, 7); // YYYY-MM
  const hourStr = now.toISOString().substring(0, 13); // YYYY-MM-DDTHH

  const usageDoc = {
    user_id: userId,
    action,
    timestamp: now,
    date: todayStr,
    month: monthStr,
    hour: hourStr,
    ...metadata,
  };

  await db.collection('usage_log').insertOne(usageDoc);

  // Update aggregated counters for fast lookups
  const counterKey = `${userId}:${action}`;
  
  if (action === 'standard_message') {
    await db.collection('usage_counters').updateOne(
      { key: `${counterKey}:daily:${todayStr}` },
      { $inc: { count: 1 }, $set: { user_id: userId, action, period: todayStr, updated_at: now } },
      { upsert: true }
    );
  }
  
  if (action === 'premium_message') {
    await db.collection('usage_counters').updateOne(
      { key: `${counterKey}:monthly:${monthStr}` },
      { $inc: { count: 1 }, $set: { user_id: userId, action, period: monthStr, updated_at: now } },
      { upsert: true }
    );
  }

  if (action === 'image') {
    await db.collection('usage_counters').updateOne(
      { key: `${counterKey}:monthly:${monthStr}` },
      { $inc: { count: 1 }, $set: { user_id: userId, action, period: monthStr, updated_at: now } },
      { upsert: true }
    );
    await db.collection('usage_counters').updateOne(
      { key: `${counterKey}:hourly:${hourStr}` },
      { $inc: { count: 1 }, $set: { user_id: userId, action, period: hourStr, updated_at: now } },
      { upsert: true }
    );
  }

  if (action === 'video') {
    await db.collection('usage_counters').updateOne(
      { key: `${counterKey}:monthly:${monthStr}` },
      { $inc: { count: 1 }, $set: { user_id: userId, action, period: monthStr, updated_at: now } },
      { upsert: true }
    );
  }

  if (action === 'pdf') {
    await db.collection('usage_counters').updateOne(
      { key: `${counterKey}:monthly:${monthStr}` },
      { $inc: { count: 1 }, $set: { user_id: userId, action, period: monthStr, updated_at: now } },
      { upsert: true }
    );
  }

  if (action === 'voice_minute') {
    await db.collection('usage_counters').updateOne(
      { key: `${counterKey}:monthly:${monthStr}` },
      { $inc: { count: 1 }, $set: { user_id: userId, action, period: monthStr, updated_at: now } },
      { upsert: true }
    );
  }
}

/**
 * Get the user's current usage summary for the billing dashboard.
 */
export async function getUserUsageSummary(userId) {
  const db = await getDb();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);
  const status = await getUserEnforcementStatus(userId);
  const features = status.effective_features;

  const [stdMsgsToday, premiumMsgsMonth, imagesMonth, videosMonth, pdfsMonth, voiceMonth] = await Promise.all([
    getStandardMsgsUsedToday(userId, db),
    getPremiumMsgsUsedThisMonth(userId, db),
    getImagesUsedThisMonth(userId, db),
    getVideosUsedThisMonth(userId, db),
    getPdfsUsedThisMonth(userId, db),
    getVoiceMinutesUsedThisMonth(userId, db),
  ]);

  // Get media credits balance
  const creditsDoc = await db.collection('user_credits').findOne({ user_id: userId });
  const mediaCredits = creditsDoc?.media_credits || 0;
  const premiumMessagesBalance = creditsDoc?.premium_messages || 0;

  return {
    plan: status.effective_plan,
    cohort: status.cohort,
    enforcement_active: status.enforcement_active,
    grace_expires_at: status.grace_expires_at,
    days_remaining: status.days_remaining,
    show_countdown: status.show_countdown,
    is_trial: status.is_trial,
    media_credits_balance: mediaCredits,
    premium_messages_balance: premiumMessagesBalance,
    usage: {
      standard_messages: {
        used: stdMsgsToday,
        limit: features?.standard_msgs_per_day || null,
        period: 'daily',
        resets_at: features?.standard_msgs_per_day ? getNextMidnightUTC() : null,
      },
      premium_messages: {
        used: premiumMsgsMonth,
        limit: features?.premium_chat_unlimited ? null : (features?.premium_chat_msgs_per_month || 0),
        period: 'monthly',
      },
      images: {
        used: imagesMonth,
        limit: features?.images_per_month,
        period: 'monthly',
        watermark: features?.image_watermark || false,
      },
      videos: {
        used: videosMonth,
        limit: features?.videos_per_month,
        period: 'monthly',
      },
      pdfs: {
        used: pdfsMonth,
        limit: features?.pdfs_per_month,
        period: 'monthly',
      },
      voice_minutes: {
        used: voiceMonth,
        limit: features?.voice_unlimited ? null : (features?.voice_minutes_per_month || 0),
        period: 'monthly',
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function classifyCohort(registeredAt) {
  if (registeredAt < OG_CUTOFF_DATE) return 'og';
  if (registeredAt < PRICING_LAUNCH_DATE) return 'early';
  return 'new_user';
}

function getGraceEndDate(registeredAt) {
  const cohort = classifyCohort(registeredAt);
  if (cohort === 'og') return OG_GRACE_END;
  if (cohort === 'early') return EARLY_GRACE_END;
  return null; // New users don't have a fixed grace end
}

function getDaysRemaining(graceEnd, now) {
  if (!graceEnd) return null;
  const diff = graceEnd.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getNextMidnightUTC() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
}

async function getFreePlanFeatures(db) {
  const plan = await db.collection('subscription_plans').findOne({ id: 'free' });
  return plan?.features || {
    chat_model_tier: 'standard',
    premium_chat: false,
    standard_msgs_per_day: 50,
    images_per_month: 10,
    image_watermark: true,
    image_rate_limit_per_hour: 5,
    videos_per_month: 0,
    pdfs_per_month: 5,
    voice_chat: false,
    conversation_search: false,
  };
}

async function getStandardModels() {
  // Return list of standard models user can use instead of premium
  return [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
    { id: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
  ];
}

async function getStandardMsgsUsedToday(userId, db) {
  const todayStr = new Date().toISOString().split('T')[0];
  const counter = await db.collection('usage_counters').findOne({
    key: `${userId}:standard_message:daily:${todayStr}`,
  });
  return counter?.count || 0;
}

async function getPremiumMsgsUsedThisMonth(userId, db) {
  const monthStr = new Date().toISOString().substring(0, 7);
  const counter = await db.collection('usage_counters').findOne({
    key: `${userId}:premium_message:monthly:${monthStr}`,
  });
  return counter?.count || 0;
}

async function getImagesUsedThisMonth(userId, db) {
  const monthStr = new Date().toISOString().substring(0, 7);
  const counter = await db.collection('usage_counters').findOne({
    key: `${userId}:image:monthly:${monthStr}`,
  });
  return counter?.count || 0;
}

async function getImagesUsedThisHour(userId, db) {
  const hourStr = new Date().toISOString().substring(0, 13);
  const counter = await db.collection('usage_counters').findOne({
    key: `${userId}:image:hourly:${hourStr}`,
  });
  return counter?.count || 0;
}

async function getVideosUsedThisMonth(userId, db) {
  const monthStr = new Date().toISOString().substring(0, 7);
  const counter = await db.collection('usage_counters').findOne({
    key: `${userId}:video:monthly:${monthStr}`,
  });
  return counter?.count || 0;
}

async function getPdfsUsedThisMonth(userId, db) {
  const monthStr = new Date().toISOString().substring(0, 7);
  const counter = await db.collection('usage_counters').findOne({
    key: `${userId}:pdf:monthly:${monthStr}`,
  });
  return counter?.count || 0;
}

async function getVoiceMinutesUsedThisMonth(userId, db) {
  const monthStr = new Date().toISOString().substring(0, 7);
  const counter = await db.collection('usage_counters').findOne({
    key: `${userId}:voice_minute:monthly:${monthStr}`,
  });
  return counter?.count || 0;
}

/**
 * Check if a new trial user has hit any of their trial limits.
 * Trial limits are equivalent to the Base plan limits.
 */
async function checkTrialLimitsHit(userId, db) {
  const monthStr = new Date().toISOString().substring(0, 7);
  
  // Check images (50/mo trial limit)
  const images = await getImagesUsedThisMonth(userId, db);
  if (images >= BASE_TRIAL_FEATURES.images_per_month) return true;

  // Check videos (1/mo trial limit)
  const videos = await getVideosUsedThisMonth(userId, db);
  if (videos >= BASE_TRIAL_FEATURES.videos_per_month) return true;

  // Check premium messages (50/mo trial limit)
  const premiumMsgs = await getPremiumMsgsUsedThisMonth(userId, db);
  if (premiumMsgs >= BASE_TRIAL_FEATURES.premium_chat_msgs_per_month) return true;

  // Check voice (30 min/mo trial limit)
  const voice = await getVoiceMinutesUsedThisMonth(userId, db);
  if (voice >= BASE_TRIAL_FEATURES.voice_minutes_per_month) return true;

  // Check PDFs (25/mo trial limit)
  const pdfs = await getPdfsUsedThisMonth(userId, db);
  if (pdfs >= BASE_TRIAL_FEATURES.pdfs_per_month) return true;

  return false;
}

// ── Exports ─────────────────────────────────────────────────────────────────
export {
  PRICING_LAUNCH_DATE,
  OG_CUTOFF_DATE,
  OG_GRACE_END,
  EARLY_GRACE_END,
  BASE_TRIAL_FEATURES,
  UNRESTRICTED_FEATURES,
  classifyCohort,
  getGraceEndDate,
  getDaysRemaining,
};
