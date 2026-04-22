import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

// Pitch deck passwords mapped to names for tracking
const PITCH_PASSWORDS = {
  'BenPitch': 'Ben',
  'AdrianPitch': 'Adrian',
  'ReggiePitch': 'Reggie',
};

function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}
function err(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Helper: check admin auth
async function isAdmin(request) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return false;
    const token = auth.split(' ')[1];
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
    const db = await getDb();
    const user = await db.collection('users').findOne({ 
      $or: [
        { id: decoded.userId || decoded.user_id },
        { user_id: decoded.userId || decoded.user_id }
      ]
    });
    return user?.is_admin === true || user?.role === 'superadmin';
  } catch {
    return false;
  }
}

export async function POST(request, { params }) {
  const pathSegments = params?.path || [];
  const pathStr = pathSegments.join('/');

  try {
    // POST /api/pitch/access — Validate password + log access
    if (pathStr === 'access') {
      const { email, password } = await request.json();

      if (!email || !password) {
        return err('Email and password are required');
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return err('Please enter a valid email address');
      }

      const ownerName = PITCH_PASSWORDS[password];
      if (!ownerName) {
        return err('Invalid access code');
      }

      // Log access
      const db = await getDb();
      await db.collection('pitch_access').insertOne({
        email: email.toLowerCase().trim(),
        password_owner: ownerName,
        password_used: password,
        accessed_at: new Date(),
        user_agent: request.headers.get('user-agent') || 'unknown',
      });

      return ok({ success: true, owner: ownerName });
    }

    return err('Not found', 404);
  } catch (error) {
    console.error('[Pitch API] POST error:', error);
    return err(error.message, 500);
  }
}

export async function GET(request, { params }) {
  const pathSegments = params?.path || [];
  const pathStr = pathSegments.join('/');

  try {
    // GET /api/pitch/check-admin — Check if current user is admin (can bypass gate)
    if (pathStr === 'check-admin') {
      const admin = await isAdmin(request);
      return ok({ isAdmin: admin });
    }

    // GET /api/pitch/analytics — Admin-only: get pitch access stats
    if (pathStr === 'analytics') {
      const admin = await isAdmin(request);
      if (!admin) return err('Admin access required', 403);

      const db = await getDb();

      // Get all access logs
      const logs = await db.collection('pitch_access')
        .find({})
        .sort({ accessed_at: -1 })
        .limit(500)
        .toArray();

      // Aggregate by password owner
      const byOwner = {};
      const byEmail = {};
      const recentAccess = [];

      for (const log of logs) {
        // Count by owner
        byOwner[log.password_owner] = (byOwner[log.password_owner] || 0) + 1;

        // Count by email
        const email = log.email;
        if (!byEmail[email]) {
          byEmail[email] = { email, count: 0, passwords: new Set(), first_access: log.accessed_at, last_access: log.accessed_at };
        }
        byEmail[email].count++;
        byEmail[email].passwords.add(log.password_owner);
        if (log.accessed_at > byEmail[email].last_access) byEmail[email].last_access = log.accessed_at;
        if (log.accessed_at < byEmail[email].first_access) byEmail[email].first_access = log.accessed_at;
      }

      // Convert sets to arrays for JSON
      const emailStats = Object.values(byEmail).map(e => ({
        ...e,
        passwords: [...e.passwords],
      })).sort((a, b) => b.count - a.count);

      return ok({
        total_views: logs.length,
        by_password: {
          Ben: byOwner['Ben'] || 0,
          Adrian: byOwner['Adrian'] || 0,
          Reggie: byOwner['Reggie'] || 0,
        },
        unique_viewers: Object.keys(byEmail).length,
        viewers: emailStats,
        recent: logs.slice(0, 20).map(l => ({
          email: l.email,
          password_owner: l.password_owner,
          accessed_at: l.accessed_at,
        })),
      });
    }

    return err('Not found', 404);
  } catch (error) {
    console.error('[Pitch API] GET error:', error);
    return err(error.message, 500);
  }
}
