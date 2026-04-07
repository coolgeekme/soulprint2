import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// FEATURE FLAG SYSTEM
// ============================================================
// Supports:
//   - Global enable/disable
//   - Per-user targeting (whitelist specific users)
//   - Percentage rollout (enable for X% of users)
//   - Environment targeting (dev/staging/production)
// ============================================================

/**
 * Check if a feature is enabled for a specific user.
 * This is the main utility function used throughout the codebase.
 * 
 * Usage: 
 *   import { isFeatureEnabled } from '@/lib/handlers/feature-flags';
 *   if (await isFeatureEnabled('mask_editor', userId)) { ... }
 */
export async function isFeatureEnabled(flagKey, userId = null) {
  try {
    const db = await getDb();
    const flag = await db.collection('feature_flags').findOne({ key: flagKey });
    
    if (!flag) return false; // Unknown flags default to off
    if (!flag.enabled) return false; // Globally disabled
    
    // Check environment targeting
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    if (flag.environments && flag.environments.length > 0 && !flag.environments.includes(env)) {
      return false;
    }
    
    // If no user targeting, feature is globally enabled
    if (!flag.targeted_users?.length && !flag.rollout_percentage) {
      return true;
    }
    
    // Check user-specific targeting
    if (userId && flag.targeted_users?.length > 0) {
      if (flag.targeted_users.includes(userId)) return true;
    }
    
    // Check percentage rollout
    if (flag.rollout_percentage && userId) {
      // Deterministic hash: same user always gets same result for same flag
      const hash = simpleHash(`${flagKey}:${userId}`);
      const bucket = hash % 100;
      return bucket < flag.rollout_percentage;
    }
    
    // If targeting exists but user doesn't match, feature is off for them
    if (flag.targeted_users?.length > 0) return false;
    
    return true;
  } catch (error) {
    console.error(`[FeatureFlags] Error checking flag "${flagKey}":`, error.message);
    return false; // Fail closed — if we can't check, feature is off
  }
}

// Simple deterministic hash for percentage rollouts
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// In-memory cache for high-frequency flag checks (refreshes every 30s)
let _flagCache = new Map();
let _flagCacheTime = 0;
const FLAG_CACHE_TTL = 30_000; // 30 seconds

export async function isFeatureEnabledCached(flagKey, userId = null) {
  const now = Date.now();
  if (now - _flagCacheTime > FLAG_CACHE_TTL) {
    _flagCache.clear();
    _flagCacheTime = now;
  }
  
  const cacheKey = `${flagKey}:${userId || 'global'}`;
  if (_flagCache.has(cacheKey)) return _flagCache.get(cacheKey);
  
  const result = await isFeatureEnabled(flagKey, userId);
  _flagCache.set(cacheKey, result);
  return result;
}

// ============================================================
// ADMIN API HANDLERS
// ============================================================

/** GET /api/admin/feature-flags — List all feature flags */
export async function handleAdminGetFeatureFlags(request) {
  const user = await authenticate(request);
  if (!user || !['support', 'admin', 'superadmin'].includes(user.role)) {
    return err('Forbidden', 403);
  }
  
  const db = await getDb();
  const flags = await db.collection('feature_flags')
    .find({})
    .sort({ created_at: -1 })
    .toArray();
  
  return ok({ flags });
}

/** POST /api/admin/feature-flags — Create a new feature flag */
export async function handleAdminCreateFeatureFlag(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return err('Forbidden — admin only', 403);
  }
  const body = await request.json();
  const { key, name, description, enabled, targeted_users, rollout_percentage, environments } = body;
  
  if (!key || !name) {
    return err('Key and name are required', 400);
  }
  
  // Validate key format (alphanumeric + underscores only)
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return err('Key must be lowercase alphanumeric with underscores (e.g., mask_editor)', 400);
  }
  
  const db = await getDb();
  
  // Check for duplicate key
  const existing = await db.collection('feature_flags').findOne({ key });
  if (existing) {
    return err(`Feature flag with key "${key}" already exists`, 409);
  }
  
  const flag = {
    id: uuidv4(),
    key,
    name,
    description: description || '',
    enabled: enabled || false,
    targeted_users: targeted_users || [], // Array of user IDs
    rollout_percentage: rollout_percentage || null, // 0-100 or null
    environments: environments || [], // ['development', 'production'] or empty for all
    created_at: new Date(),
    updated_at: new Date(),
  };
  
  await db.collection('feature_flags').insertOne(flag);
  _flagCache.clear(); // Invalidate cache
  
  console.log(`[FeatureFlags] Created flag: ${key} (enabled: ${flag.enabled})`);
  return ok({ flag });
}

/** PATCH /api/admin/feature-flags — Update a feature flag */
export async function handleAdminUpdateFeatureFlag(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return err('Forbidden — admin only', 403);
  }
  
  const body = await request.json();
  const { id, key, ...updates } = body;
  
  if (!id && !key) {
    return err('Flag id or key is required', 400);
  }
  
  const db = await getDb();
  const query = id ? { id } : { key };
  const flag = await db.collection('feature_flags').findOne(query);
  
  if (!flag) {
    return err('Feature flag not found', 404);
  }
  
  // Only allow updating specific fields
  const allowedFields = ['name', 'description', 'enabled', 'targeted_users', 'rollout_percentage', 'environments'];
  const safeUpdates = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      safeUpdates[field] = updates[field];
    }
  }
  safeUpdates.updated_at = new Date();
  
  await db.collection('feature_flags').updateOne(query, { $set: safeUpdates });
  _flagCache.clear(); // Invalidate cache
  
  const action = safeUpdates.enabled !== undefined 
    ? (safeUpdates.enabled ? 'ENABLED' : 'DISABLED') 
    : 'UPDATED';
  console.log(`[FeatureFlags] ${action} flag: ${flag.key}`);
  
  return ok({ flag: { ...flag, ...safeUpdates } });
}

/** DELETE /api/admin/feature-flags — Delete a feature flag */
export async function handleAdminDeleteFeatureFlag(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return err('Forbidden — admin only', 403);
  }
  
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const key = searchParams.get('key');
  
  if (!id && !key) {
    return err('Flag id or key is required', 400);
  }
  
  const db = await getDb();
  const query = id ? { id } : { key };
  const result = await db.collection('feature_flags').deleteOne(query);
  
  if (result.deletedCount === 0) {
    return err('Feature flag not found', 404);
  }
  
  _flagCache.clear();
  console.log(`[FeatureFlags] Deleted flag: ${id || key}`);
  return ok({ deleted: true });
}

/** GET /api/feature-flags/check — Public endpoint to check a flag for the current user */
export async function handleCheckFeatureFlag(request) {
  const user = await authenticate(request);
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  
  if (!key) {
    return err('Flag key is required', 400);
  }
  
  const enabled = await isFeatureEnabledCached(key, user?.id);
  return ok({ key, enabled });
}

// ============================================================
// SUPPORT ROLE HELPERS
// ============================================================

/**
 * Require at least "support" role.
 * Support < Admin < Superadmin
 */
export async function requireSupport(request) {
  const user = await authenticate(request);
  if (!user || !['support', 'admin', 'superadmin'].includes(user.role)) return null;
  return user;
}

/**
 * Require at least "admin" role (excludes support).
 */
export async function requireAdminOnly(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) return null;
  return user;
}
