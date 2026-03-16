import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

// ============================================================
// RESPONSE HELPERS
// ============================================================

export function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ============================================================
// AUTHENTICATION HELPERS
// ============================================================

export async function authenticate(request) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      console.log('[Auth] No token provided');
      return null;
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('[Auth] Token verification failed');
      return null;
    }
    const db = await getDb();
    const user = await db.collection('users').findOne({ id: decoded.userId });
    if (user) {
      await db.collection('users').updateOne(
        { id: decoded.userId },
        { $set: { last_active_at: new Date() } }
      );
    } else {
      console.log('[Auth] User not found in database:', decoded.userId);
    }
    return user;
  } catch (err) {
    console.error('[Auth] Authentication error:', err.message);
    return null;
  }
}

export async function requireAdmin(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) return null;
  return user;
}

// ============================================================
// RATE LIMITING
// ============================================================

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMITS = {
  chat: 30,
  auth: 10,
  export: 5,
  default: 60,
};

export function checkRateLimit(identifier, type = 'default') {
  const key = `${identifier}:${type}`;
  const now = Date.now();
  const limit = RATE_LIMITS[type] || RATE_LIMITS.default;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: limit - 1 };
  }
  
  const record = rateLimitStore.get(key);
  
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
    return { allowed: true, remaining: limit - 1 };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  
  record.count++;
  return { allowed: true, remaining: limit - record.count };
}

// Clean up old rate limit entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 60 * 1000);
}

// ============================================================
// GOOGLE CONNECTION CHECK
// ============================================================

export async function userHasGoogleConnected(userId) {
  const db = await getDb();
  const connection = await db.collection('google_connections').findOne({ user_id: userId });
  return !!connection;
}
