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

// Attach the auth JWT as an httpOnly session cookie so server-side
// authenticate() (the OAuth authorize endpoint, server-rendered pages) can see
// the logged-in user on plain browser navigations. The client still uses the
// Bearer token from localStorage; this cookie is additive for server flows.
export function setTokenCookie(response, token) {
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 365 days (matches JWT expiry)
  });
  return response;
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
    // Distinguish database errors from auth errors
    // If the token is valid but DB is unreachable, throw a specific error
    if (err.message?.includes('MongoDB') || err.message?.includes('connection') || 
        err.message?.includes('timed out') || err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('pool') || err.message?.includes('topology')) {
      const dbErr = new Error('Database temporarily unavailable');
      dbErr.statusCode = 503;
      dbErr.isDbError = true;
      throw dbErr;
    }
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
  demo: 5,
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

// ============================================================
// MESSAGE UTILITIES
// ============================================================

export function trimHistory(messages, maxContextTokens = 6000) {
  if (!messages || messages.length === 0) return [];
  let total = 0;
  const trimmed = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const est = Math.ceil(content.length / 4) + 4;
    if (total + est > maxContextTokens) break;
    total += est;
    trimmed.unshift(msg);
  }
  return ensureAlternatingMessages(trimmed);
}

export function ensureAlternatingMessages(messages) {
  if (!messages || messages.length === 0) return [];
  
  const result = [];
  let lastRole = null;
  
  for (const msg of messages) {
    if (!msg.content || (typeof msg.content === 'string' && !msg.content.trim())) {
      continue;
    }
    
    if (msg.role === lastRole && result.length > 0) {
      const lastMsg = result[result.length - 1];
      
      if (typeof lastMsg.content === 'string' && typeof msg.content === 'string') {
        lastMsg.content = `${lastMsg.content}\n\n${msg.content}`;
      } else if (Array.isArray(lastMsg.content) && Array.isArray(msg.content)) {
        lastMsg.content = [...lastMsg.content, ...msg.content];
      } else if (Array.isArray(lastMsg.content) && typeof msg.content === 'string') {
        lastMsg.content.push({ type: 'text', text: msg.content });
      } else if (typeof lastMsg.content === 'string' && Array.isArray(msg.content)) {
        lastMsg.content = [{ type: 'text', text: lastMsg.content }, ...msg.content];
      } else {
        result[result.length - 1] = msg;
      }
      continue;
    }
    
    result.push({ ...msg });
    lastRole = msg.role;
  }
  
  while (result.length > 0 && result[0].role === 'assistant') {
    result.shift();
  }
  
  return result;
}

// ============================================================
// IP & LOCATION UTILITIES
// ============================================================

export function getClientIP(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  
  return null;
}

export async function getLocationFromIP(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }
  
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,timezone`);
    const data = await res.json();
    
    if (data.status === 'success' && data.lat && data.lon) {
      return {
        lat: data.lat,
        lng: data.lon,
        city: data.city,
        region: data.regionName,
        country: data.country,
        timezone: data.timezone,
        address: [data.city, data.regionName, data.country].filter(Boolean).join(', '),
        source: 'ip_auto'
      };
    }
  } catch (e) {
    console.error('IP geolocation error:', e.message);
  }
  return null;
}


// ============================================================
// GOOGLE TOKEN HELPERS
// ============================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function refreshGoogleToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  return response.json();
}

export async function getValidGoogleToken(userId, accountIdentifier = null) {
  const db = await getDb();
  
  let connection;
  
  if (accountIdentifier) {
    const searchTerm = accountIdentifier.toLowerCase();
    connection = await db.collection('google_connections').findOne({ 
      user_id: userId,
      $or: [
        { email: { $regex: searchTerm, $options: 'i' } },
        { name: { $regex: searchTerm, $options: 'i' } }
      ]
    });
    
    if (!connection) {
      connection = await db.collection('google_connections').findOne({ 
        user_id: userId,
        connection_id: accountIdentifier
      });
    }
  }
  
  if (!connection) {
    connection = await db.collection('google_connections').findOne({ 
      user_id: userId, 
      is_default: true 
    });
  }
  
  if (!connection) {
    connection = await db.collection('google_connections').findOne({ user_id: userId });
  }
  
  if (!connection) return null;
  
  const isExpired = new Date(connection.expires_at) < new Date(Date.now() + 5 * 60 * 1000);
  
  if (isExpired && connection.refresh_token) {
    try {
      const tokens = await refreshGoogleToken(connection.refresh_token);
      if (tokens.access_token) {
        await db.collection('google_connections').updateOne(
          { connection_id: connection.connection_id },
          { 
            $set: { 
              access_token: tokens.access_token,
              expires_at: new Date(Date.now() + tokens.expires_in * 1000),
              updated_at: new Date()
            }
          }
        );
        return { token: tokens.access_token, connection };
      }
    } catch (err) {
      console.error('[Google Token] Refresh failed:', err.message);
      return null;
    }
  }
  
  return { token: connection.access_token, connection };
}

export async function getAllGoogleConnections(userId) {
  const db = await getDb();
  const connections = await db.collection('google_connections').find({ user_id: userId }).toArray();
  
  const validConnections = [];
  for (const conn of connections) {
    const result = await getValidGoogleToken(userId, conn.connection_id);
    if (result?.token) {
      validConnections.push({ ...conn, access_token: result.token });
    }
  }
  
  return validConnections;
}
