import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, ensureCriticalIndexes } from '@/lib/mongodb';
import { generateToken, hashPassword, comparePassword, getTokenFromRequest, verifyToken } from '@/lib/auth';
import { sendWelcomeEmail, sendBetaCodeEmail } from '@/lib/email';
import { ok, err, authenticate, requireAdmin, checkRateLimit } from '@/lib/api-utils';
import { 
  handleGoogleAuthStart, 
  handleGoogleAuthCallback 
} from '@/lib/handlers/google-integration';

// Ensure critical indexes on first load (non-blocking)
let indexesEnsured = false;
async function maybeEnsureIndexes() {
  if (!indexesEnsured) {
    indexesEnsured = true;
    ensureCriticalIndexes().catch(() => {}); // fire-and-forget
  }
}

// ============================================================
// EMAIL NOTIFICATION HELPERS
// ============================================================

async function sendNewUserNotificationEmail(user) {
  const ADMIN_EMAIL = 'reggie@archeforge.com';
  
  try {
    const { sendNewUserNotification } = await import('@/lib/email.js');
    const result = await sendNewUserNotification(ADMIN_EMAIL, user);
    
    if (result.success) {
      console.log('[Email] New user notification sent to', ADMIN_EMAIL);
    } else {
      console.error('[Email] Failed to send new user notification:', result.error);
    }
  } catch (e) {
    console.error('[Email] Failed to send new user notification:', e.message);
  }
}

// ============================================================
// AUTH HANDLERS
// ============================================================

// POST /api/auth/register
async function handleRegister(request) {
  const body = await request.json();
  const { email, passcode, access_code } = body;
  if (!email || !passcode) return err('Email and passcode required');

  const db = await getDb();
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already registered');

  const userId = uuidv4();
  const hashed = await hashPassword(passcode);
  const now = new Date();

  // Check if this is first user -> make superadmin
  const count = await db.collection('users').countDocuments();
  const role = count === 0 ? 'superadmin' : 'user';

  // Check if valid beta code was provided
  let acceptedViaBetaCode = false;
  let usedCodeId = null;
  if (access_code && role !== 'superadmin') {
    // Try v2 codes first
    const v2Code = await db.collection('beta_codes_v2').findOne({ 
      code: access_code.toUpperCase().trim(),
      active: true,
    });
    
    if (v2Code) {
      const isExpired = v2Code.expires_at && new Date(v2Code.expires_at) < new Date();
      const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
      const isExhausted = v2Code.max_uses && currentUses >= v2Code.max_uses;
      
      if (!isExpired && !isExhausted) {
        acceptedViaBetaCode = true;
        usedCodeId = v2Code._id || v2Code.id;
        await db.collection('beta_codes_v2').updateOne(
          { code: access_code.toUpperCase().trim() },
          { $inc: { uses: 1, uses_count: 1 } }
        );
      }
    } else {
      // Fallback to legacy code
      const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
      if (betaCode && betaCode.code && 
          betaCode.code.toUpperCase() === access_code.toUpperCase().trim() &&
          (!betaCode.expires_at || new Date(betaCode.expires_at) >= new Date())) {
        acceptedViaBetaCode = true;
        await db.collection('beta_codes').updateOne(
          { id: 'current' },
          { $inc: { uses: 1 } }
        );
      }
    }
  }

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role,
    accepted: true,  // Auto-accept all new users
    created_at: now,
    last_active_at: now,
    access_code_used: access_code || null,
    beta_code_used: acceptedViaBetaCode ? access_code : null,
    beta_code_id: usedCodeId,
    auth_provider: 'legacy',
  });

  // Record beta code redemption
  if (usedCodeId) {
    await db.collection('beta_code_redemptions').insertOne({
      id: uuidv4(),
      code_id: usedCodeId,
      code: access_code.toUpperCase().trim(),
      user_id: userId,
      user_email: email.toLowerCase(),
      redeemed_at: now,
    });
  }

  // Create empty profile
  await db.collection('profiles').insertOne({
    user_id: userId,
    display_name: '',
    assistant_name: 'SoulPrint',
    descriptors: [],
    field: '',
    help_with: [],
    discovery_source: '',
    soul_profile_summary: '',
    onboarding_completed: false,
    assessment_complete: false,
    created_at: now,
  });

  const token = generateToken(userId);
  
  // Send emails (non-blocking)
  sendWelcomeEmail(email, null).catch(e => console.error('Welcome email failed:', e));
  sendNewUserNotificationEmail({
    email: email.toLowerCase(),
    beta_code_used: acceptedViaBetaCode ? access_code : null,
    accepted: true,  // Auto-accept all new users
  }).catch(e => console.error('Admin notification email failed:', e));
  
  return ok({ 
    token, 
    userId, 
    role, 
    accepted: true,  // Auto-accept all new users
    onboarding_completed: false,
    assessment_complete: false,
  });
}

// POST /api/auth/login
async function handleLogin(request) {
  const body = await request.json();
  const { email, passcode } = body;
  if (!email || !passcode) return err('Email and passcode required');

  const rateCheck = checkRateLimit(email.toLowerCase(), 'auth');
  if (!rateCheck.allowed) {
    return err(`Too many login attempts. Try again in ${rateCheck.retryAfter} seconds.`, 429);
  }

  let db;
  try {
    db = await getDb();
  } catch (dbErr) {
    console.error('[Auth] Database connection failed:', dbErr.message);
    return err('Service temporarily unavailable. Please try again in a moment.', 503);
  }

  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return err('User not found', 404);

  const valid = await comparePassword(passcode, user.passcode_hash);
  if (!valid) return err('Invalid credentials', 401);

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const isLegacyUser = !user.hasOwnProperty('email_verified');
  if (!isAdmin && !isLegacyUser && user.email_verified === false) {
    return err('Please verify your email before signing in.', 403);
  }

  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { last_active_at: new Date() } }
  );

  const token = generateToken(user.id);
  const profile = await db.collection('profiles').findOne({ user_id: user.id });

  return ok({
    token,
    userId: user.id,
    role: user.role,
    accepted: user.accepted,
    onboarding_completed: profile?.onboarding_completed || false,
    assessment_complete: profile?.assessment_complete || false,
  });
}

// POST /api/auth/firebase
async function handleFirebaseAuth(request) {
  console.log('[Firebase Auth] Starting Firebase auth handler');
  const body = await request.json();
  const { idToken, email, displayName, photoURL, uid, accessCode } = body;
  
  console.log('[Firebase Auth] Received:', { email, displayName, uid: uid?.substring(0, 10) + '...', hasIdToken: !!idToken });
  
  if (!idToken || !email || !uid) {
    console.log('[Firebase Auth] Missing required fields');
    return err('Missing required Firebase authentication data');
  }

  let payload;
  let isGoogleAuth = false;
  let firebaseEmailVerified = false;
  
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      console.log('[Firebase Auth] Invalid token format - not 3 parts');
      return err('Invalid token format', 401);
    }
    
    payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('[Firebase Auth] Token payload:', { email: payload.email, exp: payload.exp, provider: payload.firebase?.sign_in_provider });
    
    if (payload.email !== email) {
      console.log('[Firebase Auth] Token email mismatch:', payload.email, 'vs', email);
      return err('Token email mismatch', 401);
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.log('[Firebase Auth] Token expired');
      return err('Token expired', 401);
    }
    
    isGoogleAuth = payload.firebase?.sign_in_provider === 'google.com';
    firebaseEmailVerified = payload.email_verified === true;
    console.log('[Firebase Auth] isGoogleAuth:', isGoogleAuth, 'emailVerified:', firebaseEmailVerified);
  } catch (e) {
    console.log('[Firebase Auth] Token parse error:', e.message);
    return err('Invalid authentication token', 401);
  }

  const db = await getDb();
  const now = new Date();
  
  console.log('[Firebase Auth] Looking up user:', email.toLowerCase());
  let user = await db.collection('users').findOne({ email: email.toLowerCase() });
  
  // SAFETY: If user not found on first try, retry once after a brief delay.
  // This guards against transient Atlas connection issues returning null.
  if (!user) {
    console.warn('[Firebase Auth] User NOT found on first lookup. Retrying in 500ms...');
    await new Promise(r => setTimeout(r, 500));
    user = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (user) {
      console.log('[Firebase Auth] User found on RETRY (transient issue detected):', user.id);
    }
  }
  
  console.log('[Firebase Auth] User found:', !!user, user ? { id: user.id, role: user.role, accepted: user.accepted } : null);
  
  if (user) {
    const updateFields = { 
      firebase_uid: uid,
      firebase_photo_url: photoURL || user.firebase_photo_url,
      last_active_at: now,
      ...(displayName && !user.display_name ? { display_name: displayName } : {}),
      ...(firebaseEmailVerified || isGoogleAuth ? { email_verified: true } : {})
    };
    
    await db.collection('users').updateOne({ id: user.id }, { $set: updateFields });
    user = await db.collection('users').findOne({ id: user.id });
    
    if (displayName) {
      await db.collection('profiles').updateOne(
        { user_id: user.id, display_name: { $in: ['', null] } },
        { $set: { display_name: displayName } }
      );
    }
  } else {
    const userId = uuidv4();
    const count = await db.collection('users').countDocuments();
    const role = count === 0 ? 'superadmin' : 'user';
    
    let acceptedViaBetaCode = false;
    let usedCodeId = null;
    if (accessCode && role !== 'superadmin') {
      const v2Code = await db.collection('beta_codes_v2').findOne({ 
        code: accessCode.toUpperCase().trim(),
        active: true,
      });
      
      if (v2Code && 
          (!v2Code.expires_at || new Date(v2Code.expires_at) >= new Date()) &&
          (!v2Code.max_uses || v2Code.uses_count < v2Code.max_uses)) {
        acceptedViaBetaCode = true;
        usedCodeId = v2Code.id;
        await db.collection('beta_codes_v2').updateOne(
          { id: v2Code.id },
          { $inc: { uses_count: 1 } }
        );
      } else {
        const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
        if (betaCode && betaCode.code && 
            betaCode.code.toUpperCase() === accessCode.toUpperCase().trim() &&
            (!betaCode.expires_at || new Date(betaCode.expires_at) >= new Date())) {
          acceptedViaBetaCode = true;
          await db.collection('beta_codes').updateOne({ id: 'current' }, { $inc: { uses: 1 } });
        }
      }
    }
    
    await db.collection('users').insertOne({
      id: userId,
      email: email.toLowerCase(),
      firebase_uid: uid,
      firebase_photo_url: photoURL || null,
      display_name: displayName || null,
      role,
      accepted: true,  // Auto-accept all new users
      created_at: now,
      last_active_at: now,
      access_code_used: accessCode || null,
      beta_code_used: acceptedViaBetaCode ? accessCode : null,
      beta_code_id: usedCodeId,
      auth_provider: isGoogleAuth ? 'google' : 'firebase',
      email_verified: firebaseEmailVerified || isGoogleAuth,
    });
    
    if (usedCodeId) {
      await db.collection('beta_code_redemptions').insertOne({
        id: uuidv4(),
        code_id: usedCodeId,
        code: accessCode.toUpperCase().trim(),
        user_id: userId,
        user_email: email.toLowerCase(),
        redeemed_at: now,
      });
    }
    
    await db.collection('profiles').insertOne({
      user_id: userId,
      display_name: displayName || '',
      assistant_name: 'SoulPrint',
      descriptors: [],
      field: '',
      help_with: [],
      discovery_source: '',
      soul_profile_summary: '',
      onboarding_completed: false,
      assessment_complete: false,
      created_at: now,
    });
    
    sendWelcomeEmail(email, displayName).catch(e => console.error('Welcome email failed:', e));
    sendNewUserNotificationEmail({
      email: email.toLowerCase(),
      beta_code_used: acceptedViaBetaCode ? accessCode : null,
      accepted: true,  // Auto-accept all new users
    }).catch(e => console.error('Admin notification email failed:', e));
    
    user = { id: userId, role, accepted: true };
  }
  
  const token = generateToken(user.id);
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  return ok({
    token,
    userId: user.id,
    role: user.role,
    accepted: user.accepted,
    onboarding_completed: profile?.onboarding_completed || false,
    assessment_complete: profile?.assessment_complete || false,
    firebase_linked: true,
  });
}

// POST /api/auth/redeem-code
async function handleRedeemBetaCode(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { code } = body;
  if (!code) return err('Access code required');

  const db = await getDb();
  
  if (user.accepted) {
    return ok({ success: true, message: 'Already accepted' });
  }

  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const hasDisplayName = profile?.display_name || user.profile?.display_name;
  const hasDiscoverySource = profile?.discovery_source || user.profile?.discovery_source;
  
  if (!hasDisplayName || !hasDiscoverySource) {
    return err('Please complete the onboarding questions first.', 400);
  }

  const assessmentAnswerCount = await db.collection('assessment_answers').countDocuments({ user_id: user.id });
  const gradualAnswerCount = await db.collection('gradual_assessment_progress').countDocuments({ user_id: user.id });
  
  if (assessmentAnswerCount + gradualAnswerCount < 12) {
    return err('Please complete the assessment questions first.', 400);
  }

  const codeToCheck = code.toUpperCase().trim();
  let validCode = false;
  let usedCodeSource = null;

  const v2Code = await db.collection('beta_codes_v2').findOne({ 
    code: codeToCheck,
    active: true,
  });
  
  if (v2Code) {
    if (v2Code.expires_at && new Date(v2Code.expires_at) < new Date()) {
      return err('This access code has expired', 400);
    }
    const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
    if (v2Code.max_uses && currentUses >= v2Code.max_uses) {
      return err('This access code has reached its usage limit', 400);
    }
    
    validCode = true;
    usedCodeSource = 'v2';
    await db.collection('beta_codes_v2').updateOne(
      { code: codeToCheck },
      { $inc: { uses: 1, uses_count: 1 } }
    );
  } else {
    const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
    if (legacyCode?.code?.toUpperCase() === codeToCheck) {
      if (legacyCode.expires_at && new Date(legacyCode.expires_at) < new Date()) {
        return err('This access code has expired', 400);
      }
      validCode = true;
      usedCodeSource = 'legacy';
      await db.collection('beta_codes').updateOne({ id: 'current' }, { $inc: { uses: 1 } });
    }
  }

  if (!validCode) {
    return err('Invalid access code', 400);
  }

  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { accepted: true, beta_code_used: code, accepted_at: new Date() } }
  );

  return ok({ success: true, message: 'Access granted!' });
}

// POST /api/auth/validate-code
async function handleValidateBetaCode(request) {
  const body = await request.json();
  const { code } = body;
  if (!code) return ok({ valid: false });

  const db = await getDb();
  const codeToCheck = code.toUpperCase().trim();

  const v2Code = await db.collection('beta_codes_v2').findOne({ 
    code: codeToCheck,
    active: true,
  });
  
  if (v2Code) {
    if (v2Code.expires_at && new Date(v2Code.expires_at) < new Date()) {
      return ok({ valid: false, expired: true });
    }
    const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
    if (v2Code.max_uses && currentUses >= v2Code.max_uses) {
      return ok({ valid: false, exhausted: true });
    }
    return ok({ valid: true });
  }

  const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
  if (legacyCode?.code?.toUpperCase() === codeToCheck) {
    if (legacyCode.expires_at && new Date(legacyCode.expires_at) < new Date()) {
      return ok({ valid: false, expired: true });
    }
    return ok({ valid: true });
  }

  return ok({ valid: false });
}

// POST /api/auth/verify-captcha
async function handleVerifyCaptcha(request) {
  try {
    const { token, action } = await request.json();
    if (!token) return err('Captcha token required', 400);

    const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
    if (!RECAPTCHA_SECRET) return err('Captcha verification not configured', 500);

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${RECAPTCHA_SECRET}&response=${token}`,
    });

    const verifyData = await verifyRes.json();
    if (!verifyData.success) return err('Security verification failed', 400);
    if (verifyData.score !== undefined && verifyData.score < 0.3) {
      return err('Security check failed. Please try again.', 400);
    }
    if (action && verifyData.action !== action) {
      return err('Security verification mismatch', 400);
    }

    return ok({ success: true, score: verifyData.score });
  } catch (error) {
    return err('Captcha verification failed', 500);
  }
}

// POST /api/auth/send-verification
async function handleSendVerificationEmail(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);

    const { email } = await request.json();
    if (!email) return err('Email required', 400);

    const db = await getDb();
    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.collection('users').updateOne(
      { id: user.id },
      { $set: { verification_token: verificationToken, verification_expires: expiresAt, email_verified: false } }
    );

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://soulprintengine.ai';
    const verifyUrl = `${BASE_URL}/verify-email?token=${verificationToken}`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SoulPrint <team@soulprintengine.ai>',
        to: [email],
        subject: 'Verify your SoulPrint account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D1217; padding: 40px; border-radius: 12px;">
            <h1 style="color: #F64000; text-align: center;">SoulPrint</h1>
            <div style="background: #141a21; border-radius: 8px; padding: 30px; text-align: center;">
              <h2 style="color: white;">Verify Your Email</h2>
              <p style="color: #D2D3D7;">Click the button below to verify your email address.</p>
              <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #F64000, #d63600); color: white; padding: 14px 32px; border-radius: 8px; font-weight: bold; text-decoration: none;">Verify My Email</a>
              <p style="color: #707176; font-size: 12px; margin-top: 20px;">This link expires in 24 hours.</p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) return err('Failed to send verification email', 500);
    return ok({ success: true, message: 'Verification email sent' });
  } catch (error) {
    return err('Failed to send verification email', 500);
  }
}

// POST /api/auth/verify-email
async function handleVerifyEmail(request) {
  try {
    const { token } = await request.json();
    if (!token) return err('Verification token required', 400);

    const db = await getDb();
    const user = await db.collection('users').findOne({
      verification_token: token,
      verification_expires: { $gt: new Date() },
    });

    if (!user) return err('Invalid or expired verification link', 400);

    await db.collection('users').updateOne(
      { id: user.id },
      { $set: { email_verified: true }, $unset: { verification_token: '', verification_expires: '' } }
    );

    return ok({ success: true, message: 'Email verified successfully!' });
  } catch (error) {
    return err('Verification failed', 500);
  }
}

// POST /api/auth/verify-token — lightweight token check for extension
async function handleVerifyToken(request) {
  const token = getTokenFromRequest(request);
  if (!token) return err('Unauthorized', 401);

  const decoded = verifyToken(token);
  if (!decoded) return err('Invalid token', 401);

  const db = await getDb();
  const user = await db.collection('users').findOne({ id: decoded.userId });
  if (!user) return err('User not found', 404);

  // Resolve identity-platform tier
  const tier = await resolveIdentityTier(user.id, user.email);

  return ok({
    connected: true,
    user: {
      email: user.email,
      role: user.role,
    },
    tier,
  });
}

// ── Identity Platform Tier Definitions ──────────────────────────────────
const IDENTITY_TIERS = {
  free: {
    name: 'Free',
    maxMemories: 10,
    maxConnectedSurfaces: 2,
    mcpAccess: false,
    autoExtraction: false,
    customImprints: false,
    advancedSearch: false,
    importHistory: false,
  },
  plus: {
    name: 'Plus',
    maxMemories: 250,
    maxConnectedSurfaces: 3,
    mcpAccess: false,
    autoExtraction: true,
    customImprints: false,
    advancedSearch: false,
    importHistory: false,
  },
  pro: {
    name: 'Pro',
    maxMemories: 2000,
    maxConnectedSurfaces: Infinity,
    mcpAccess: true,
    autoExtraction: true,
    customImprints: true,
    advancedSearch: true,
    importHistory: true,
  },
  family: {
    name: 'Family',
    maxMemories: 250,
    maxConnectedSurfaces: 3,
    mcpAccess: false,
    autoExtraction: true,
    customImprints: false,
    advancedSearch: false,
    importHistory: false,
  },
  team: {
    name: 'Team',
    maxMemories: 2000,
    maxConnectedSurfaces: Infinity,
    mcpAccess: true,
    autoExtraction: true,
    customImprints: true,
    advancedSearch: true,
    importHistory: true,
  },
};

async function resolveIdentityTier(userId, email) {
  try {
    const db = await getDb();

    // Check for an explicit identity-tier override on the user document
    const user = await db.collection('users').findOne(
      { id: userId },
      { projection: { identity_tier: 1, role: 1 } }
    );
    if (user?.identity_tier && IDENTITY_TIERS[user.identity_tier]) {
      return { id: user.identity_tier, ...IDENTITY_TIERS[user.identity_tier] };
    }

    // Superadmin/Admin — always Pro tier, bypassing subscription check
    if (user?.role === 'superadmin' || user?.role === 'admin') {
      return { id: 'pro', ...IDENTITY_TIERS.pro };
    }

    // Check active subscription for tier mapping
    const sub = await db.collection('user_subscriptions').findOne(
      { user_id: userId, status: 'active' },
      { projection: { plan_id: 1 } }
    );

    // Map subscription plans to identity tiers
    const PLAN_TO_TIER = {
      free: 'free',
      base: 'plus',
      power: 'pro',
      pro: 'pro',
      plus: 'plus',
      family: 'family',
      team: 'team',
    };

    // Known plan → mapped tier. Unknown paid plan → Pro. No subscription → Free.
    let tierId
    if (sub) {
      tierId = PLAN_TO_TIER[sub.plan_id] || 'pro'
    } else {
      tierId = 'free'
    }

    return { id: tierId, ...IDENTITY_TIERS[tierId] };
  } catch (e) {
    // Fallback to free tier on any error
    console.error('[resolveIdentityTier] Error:', e.message);
    return { id: 'free', ...IDENTITY_TIERS.free };
  }
}

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const endpoint = pathArr[0]; // First segment after /api/auth/
  
  // Ensure critical DB indexes on first auth request (non-blocking)
  maybeEnsureIndexes();

  try {
    switch (endpoint) {
      case 'register':
        return await handleRegister(request);
      case 'login':
        return await handleLogin(request);
      case 'firebase':
        return await handleFirebaseAuth(request);
      case 'google':
        // POST /api/auth/google - Start OAuth flow
        return await handleGoogleAuthStart(request);
      case 'redeem-code':
        return await handleRedeemBetaCode(request);
      case 'validate-code':
        return await handleValidateBetaCode(request);
      case 'verify-captcha':
        return await handleVerifyCaptcha(request);
      case 'send-verification':
        return await handleSendVerificationEmail(request);
      case 'verify-email':
        return await handleVerifyEmail(request);
      case 'verify-token':
        return await handleVerifyToken(request);
      default:
        return err('Auth endpoint not found', 404);
    }
  } catch (error) {
    console.error('[Auth API] Error:', error);
    // Provide more helpful error message for DB connection issues
    if (error.name === 'MongoServerSelectionError' || error.message?.includes('ECONNREFUSED') || error.message?.includes('connect')) {
      return err('Service temporarily unavailable. Please try again in a moment.', 503);
    }
    return err(error.message || 'Internal server error', 500);
  }
}

// GET handler for /api/auth/me
export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const endpoint = pathArr[0];

  try {
    if (endpoint === 'me') {
      return await handleMe(request);
    }
    
    if (endpoint === 'google' && pathArr[1] === 'callback') {
      // GET /api/auth/google/callback - OAuth callback
      return await handleGoogleAuthCallback(request);
    }

    if (endpoint === 'verify-token') {
      return await handleVerifyToken(request);
    }
    
    return err('Auth endpoint not found', 404);
  } catch (error) {
    console.error('[Auth API] GET Error:', error);
    if (error.name === 'MongoServerSelectionError' || error.message?.includes('ECONNREFUSED') || error.message?.includes('connect')) {
      return err('Service temporarily unavailable. Please try again in a moment.', 503);
    }
    return err(error.message || 'Internal server error', 500);
  }
}

// Handle GET /api/auth/me
async function handleMe(request) {
  const token = getTokenFromRequest(request);
  if (!token) return err('Unauthorized', 401);
  
  const decoded = verifyToken(token);
  if (!decoded) return err('Unauthorized', 401);

  const db = await getDb();
  
  // First try the users collection
  const user = await db.collection('users').findOne({ id: decoded.userId });
  if (user) {
    await db.collection('users').updateOne(
      { id: decoded.userId },
      { $set: { last_active_at: new Date() } }
    );
    
    const profile = await db.collection('profiles').findOne({ user_id: user.id });
    const googleConnections = await db.collection('google_connections')
      .find({ user_id: user.id })
      .toArray();
    
    const connectedAccounts = googleConnections.map(conn => ({
      email: conn.email,
      name: conn.name,
      picture: conn.picture,
      is_default: conn.is_default,
      connection_id: conn.connection_id
    }));

    // ── Sliding token refresh ──
    // If the token was issued more than 7 days ago, issue a fresh one.
    // Subscribed users or any active user gets a renewed session automatically.
    let refreshedToken = null;
    try {
      const tokenAge = decoded.iat ? (Date.now() / 1000 - decoded.iat) : Infinity;
      const sevenDays = 7 * 24 * 60 * 60;
      if (tokenAge > sevenDays) {
        refreshedToken = generateToken(user.id);
      }
    } catch (e) { /* Don't break /me if refresh fails */ }

    return ok({
      id: user.id,
      email: user.email,
      role: user.role,
      accepted: user.accepted,
      email_verified: user.email_verified || false,
      firebase_linked: !!user.firebase_uid,
      profile: {
        ...profile,
        display_name: profile?.display_name || user.display_name,
      },
      onboarding_completed: profile?.onboarding_completed || false,
      assessment_complete: profile?.assessment_complete || false,
      connected_accounts: connectedAccounts,
      ...(refreshedToken ? { refreshed_token: refreshedToken } : {}),
    });
  }
  
  // Fallback: check support_agents collection
  const supportAgent = await db.collection('support_agents').findOne({ id: decoded.userId });
  if (supportAgent && supportAgent.active) {
    return ok({
      id: supportAgent.id,
      email: supportAgent.email,
      role: 'support',
      accepted: true,
      name: supportAgent.name,
      profile: { display_name: supportAgent.name },
    });
  }

  return err('Unauthorized', 401);
}
