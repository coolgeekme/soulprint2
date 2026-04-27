/**
 * Access Check — Phase 4: Grace Period Enforcement
 * 
 * Returns user's plan limits vs current usage so the frontend
 * can display contextual upgrade nudges. Does NOT block anything.
 */
import { v4 as uuidv4 } from 'uuid';
import { getClientPromise } from '@/lib/mongodb';
import { AVAILABLE_MODELS, getModelTier, isModelPremium, getStandardModels, getPremiumModels } from '@/lib/llm/providers';
import { isPricingVisible } from '@/lib/feature-gates';

let _db = null;
async function getDb() {
  if (_db) return _db;
  const client = await getClientPromise();
  _db = client.db();
  return _db;
}

async function getCollection(name) {
  const db = await getDb();
  return db.collection(name);
}

function getUsagePeriodKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Checks a user's plan features vs their current usage.
 * Returns structured data for the frontend to render upgrade banners.
 */
export async function checkUserAccess(userId, userRole) {
  // If pricing isn't visible for this user, return null (no banners)
  if (!isPricingVisible(userRole)) {
    return null;
  }

  const subCol = await getCollection('user_subscriptions');
  const plansCol = await getCollection('subscription_plans');
  const usageCol = await getCollection('usage_tracking');

  // Get subscription
  let sub = await subCol.findOne({ user_id: userId });
  if (!sub) {
    sub = { plan_id: 'free', status: 'active' };
  }

  // Get plan details
  const plan = await plansCol.findOne({ id: sub.plan_id }) || { 
    id: 'free', name: 'Free', features: { chat_model_tier: 'standard' } 
  };

  // Get usage for current period
  const periodKey = getUsagePeriodKey();
  const usage = await usageCol.findOne({ user_id: userId, period: periodKey });
  const currentUsage = {
    images: usage?.images || 0,
    premium_chats: usage?.premium_chats || 0,
    voice_minutes: usage?.voice_minutes || 0,
    videos: usage?.videos || 0,
  };

  // Build feature access map
  const features = plan.features || {};
  const premiumModelIds = getPremiumModels().map(m => m.value);
  const standardModelIds = getStandardModels().map(m => m.value);

  const warnings = [];

  // Check image usage
  const imageLimit = features.images_per_month;
  if (imageLimit != null) {
    const remaining = Math.max(0, imageLimit - currentUsage.images);
    if (remaining <= 5 && remaining > 0) {
      warnings.push({
        id: 'images_approaching',
        feature: 'images',
        type: 'limit_approaching',
        message: `You have ${remaining} image${remaining === 1 ? '' : 's'} left this month.`,
        remaining,
        limit: imageLimit,
      });
    } else if (remaining === 0) {
      warnings.push({
        id: 'images_exhausted',
        feature: 'images',
        type: 'limit_reached',
        message: `You've used all ${imageLimit} free images this month. Upgrade for more.`,
        remaining: 0,
        limit: imageLimit,
      });
    }
  }

  // Check premium chat access
  const hasPremiumChat = features.premium_chat === true;
  const premiumChatLimit = features.premium_chat_unlimited ? null : (features.premium_chat_msgs_per_month || 0);
  if (hasPremiumChat && premiumChatLimit != null) {
    const remaining = Math.max(0, premiumChatLimit - currentUsage.premium_chats);
    if (remaining <= 10 && remaining > 0) {
      warnings.push({
        id: 'premium_chats_approaching',
        feature: 'premium_chat',
        type: 'limit_approaching',
        message: `${remaining} premium message${remaining === 1 ? '' : 's'} left this month.`,
        remaining,
        limit: premiumChatLimit,
      });
    }
  }

  // Check voice access
  if (!features.voice_chat) {
    warnings.push({
      id: 'voice_unavailable',
      feature: 'voice',
      type: 'feature_unavailable',
      message: 'Voice chat is available on the Base plan and above.',
    });
  }

  return {
    plan_id: sub.plan_id,
    plan_name: plan.name || 'Free',
    status: sub.status,
    features: {
      chat_model_tier: features.chat_model_tier || 'standard',
      premium_chat: hasPremiumChat,
      premium_chat_limit: premiumChatLimit,
      premium_chat_unlimited: features.premium_chat_unlimited || false,
      images_per_month: imageLimit,
      voice_chat: features.voice_chat || false,
      voice_minutes_per_month: features.voice_minutes_per_month || 0,
      image_watermark: features.image_watermark !== false,
    },
    usage: currentUsage,
    premium_model_ids: premiumModelIds,
    standard_model_ids: standardModelIds,
    warnings,
  };
}
