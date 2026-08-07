/**
 * Auth handlers (Register, Login, Firebase Auth, Me, Profile Update)
 * Extracted from the main catch-all route.js for maintainability.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { generateToken, hashPassword, comparePassword } from '@/lib/auth';
import { authenticate, ok, err, checkRateLimit } from '@/lib/api-utils';
import { sendWelcomeEmail } from '@/lib/email';
import { sendNewUserNotificationEmail } from '@/lib/handlers/invites-beta';

// AUTH - Register
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

  // Check if valid beta code was provided (v2 codes first, then legacy)
  let acceptedViaBetaCode = false;
  let usedCodeId = null;
  if (access_code && role !== 'superadmin') {
    // Try v2 codes first
    const v2Code = await db.collection('beta_codes_v2').findOne({ 
      code: access_code.toUpperCase().trim(),
      active: true,
    });
    
    console.log('[Beta Code] Checking code:', access_code, 'Found:', v2Code ? 'yes' : 'no');
    
    if (v2Code) {
      const isExpired = v2Code.expires_at && new Date(v2Code.expires_at) < new Date();
      const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
      const isExhausted = v2Code.max_uses && currentUses >= v2Code.max_uses;
      
      console.log('[Beta Code] Code details - expired:', isExpired, 'uses:', currentUses, '/', v2Code.max_uses, 'exhausted:', isExhausted);
      
      if (!isExpired && !isExhausted) {
        acceptedViaBetaCode = true;
        usedCodeId = v2Code._id || v2Code.id;
        await db.collection('beta_codes_v2').updateOne(
          { code: access_code.toUpperCase().trim() },
          { $inc: { uses: 1, uses_count: 1 } }
        );
        console.log('[Beta Code] Accepted code:', access_code, 'for user:', email);
      } else {
        console.log('[Beta Code] Code rejected - expired:', isExpired, 'exhausted:', isExhausted);
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
        console.log('[Beta Code] Accepted legacy code:', access_code, 'for user:', email);
      } else {
        console.log('[Beta Code] Invalid code:', access_code, 'for user:', email);
      }
    }
  }

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role,
    accepted: true,
    created_at: now,
    last_active_at: now,
    access_code_used: access_code || null,
    beta_code_used: acceptedViaBetaCode ? access_code : null,
    beta_code_id: usedCodeId,
    auth_provider: 'legacy',
  });

  // Record beta code redemption if v2 code was used
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

  // Create default Free tier subscription record
  // This ensures every user is visible in admin subscription metrics from day one
  await db.collection('user_subscriptions').insertOne({
    id: uuidv4(),
    user_id: userId,
    plan_id: 'free',
    status: 'active',
    billing_period: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_start: now,
    current_period_end: null,
    grace_period_end: null,
    trial_end: null,
    discount_code: null,
    lifetime_deal: false,
    created_at: now,
    updated_at: now,
  });

  const token = generateToken(userId);
  
  // Send welcome email (non-blocking)
  sendWelcomeEmail(email, null).catch(e => console.error('Welcome email failed:', e));
  
  // Send new user notification email to admin (non-blocking)
  sendNewUserNotificationEmail({
    email: email.toLowerCase(),
    beta_code_used: acceptedViaBetaCode ? access_code : null,
    accepted: true,
  }).catch(e => console.error('Admin notification email failed:', e));
  
  return ok({ 
    token, 
    userId, 
    role, 
    accepted: true,
    onboarding_completed: false,
    assessment_complete: false,
  });
}

// AUTH - Login
async function handleLogin(request) {
  const body = await request.json();
  const { email, passcode } = body;
  if (!email || !passcode) return err('Email and passcode required');

  // Rate limit by email to prevent brute force
  const rateCheck = checkRateLimit(email.toLowerCase(), 'auth');
  if (!rateCheck.allowed) {
    return err(`Too many login attempts. Try again in ${rateCheck.retryAfter} seconds.`, 429);
  }

  const db = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return err('User not found', 404);

  const valid = await comparePassword(passcode, user.passcode_hash);
  if (!valid) return err('Invalid credentials', 401);

  // Check email verification (skip for admins and existing verified users)
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const isLegacyUser = !user.hasOwnProperty('email_verified');
  if (!isAdmin && !isLegacyUser && user.email_verified === false) {
    return err('Please verify your email before signing in. Check your inbox for the verification link.', 403);
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

// AUTH - Firebase Authentication (Google + Email/Password)
async function handleFirebaseAuth(request) {
  const body = await request.json();
  const { idToken, email, displayName, photoURL, uid, accessCode } = body;
  
  if (!idToken || !email || !uid) {
    return err('Missing required Firebase authentication data');
  }

  let payload;
  let isGoogleAuth = false;
  let firebaseEmailVerified = false;
  
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return err('Invalid token format', 401);
    }
    
    payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    if (payload.email !== email) {
      return err('Token email mismatch', 401);
    }
    
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return err('Token expired', 401);
    }
    
    isGoogleAuth = payload.firebase?.sign_in_provider === 'google.com';
    firebaseEmailVerified = payload.email_verified === true;
  } catch (e) {
    console.error('Token verification failed:', e);
    return err('Invalid authentication token', 401);
  }

  const db = await getDb();
  const now = new Date();
  
  let user = await db.collection('users').findOne({ email: email.toLowerCase() });
  let isNewUser = false;
  
  if (user) {
    const updateFields = { 
      firebase_uid: uid,
      firebase_photo_url: photoURL || user.firebase_photo_url,
      last_active_at: now,
      ...(displayName && !user.display_name ? { display_name: displayName } : {}),
      ...(firebaseEmailVerified || isGoogleAuth ? { email_verified: true } : {})
    };
    
    await db.collection('users').updateOne(
      { id: user.id },
      { $set: updateFields }
    );
    
    user = await db.collection('users').findOne({ id: user.id });
    
    if (displayName) {
      await db.collection('profiles').updateOne(
        { user_id: user.id, display_name: { $in: ['', null] } },
        { $set: { display_name: displayName } }
      );
    }
  } else {
    isNewUser = true;
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
      firebase_uid: uid,
      firebase_photo_url: photoURL || null,
      display_name: displayName || null,
      role,
      accepted: true,
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
      accepted: true,
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
    is_new_user: isNewUser,
  });
}

// AUTH - Me
async function handleMe(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  let voiceSettings = profile?.voice_settings;
  if (!voiceSettings) {
    const vs = await db.collection('voice_settings').findOne({ user_id: user.id });
    if (vs) {
      voiceSettings = { default_voice: vs.default_voice, default_gemini_voice: vs.default_gemini_voice, voice_engine: vs.voice_engine, web_search_enabled: vs.web_search_enabled };
    }
  }

  return ok({
    id: user.id,
    email: user.email,
    role: user.role,
    accepted: user.accepted,
    created_at: user.created_at,
    profile: profile ? {
      display_name: profile.display_name,
      assistant_name: profile.assistant_name,
      descriptors: profile.descriptors,
      field: profile.field,
      help_with: profile.help_with,
      discovery_source: profile.discovery_source,
      soul_profile_summary: profile.soul_profile_summary,
      onboarding_completed: profile.onboarding_completed,
      assessment_complete: profile.assessment_complete,
      custom_greeting: profile.custom_greeting,
      default_model: profile.default_model,
      default_video_model: profile.default_video_model || 'smart',
      default_image_model: profile.default_image_model || 'smart',
      ai_greeting_enabled: profile.ai_greeting_enabled,
      voice_settings: voiceSettings,
    } : null,
  });
}

// PROFILE - Update
async function handleProfileUpdate(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { display_name, descriptors, field, help_with, discovery_source, assistant_name, onboarding_completed, custom_greeting, default_model, default_video_model, default_image_model, show_greeting, ai_greeting_enabled } = body;

  const db = await getDb();
  const update = {};
  if (display_name !== undefined) update.display_name = display_name;
  if (descriptors !== undefined) update.descriptors = descriptors;
  if (field !== undefined) update.field = field;
  if (help_with !== undefined) update.help_with = help_with;
  if (discovery_source !== undefined) update.discovery_source = discovery_source;
  if (assistant_name !== undefined) update.assistant_name = assistant_name;
  if (onboarding_completed !== undefined) update.onboarding_completed = onboarding_completed;
  if (custom_greeting !== undefined) update.custom_greeting = custom_greeting;
  if (default_model !== undefined) update.default_model = default_model;
  if (default_video_model !== undefined) update.default_video_model = default_video_model;
  if (default_image_model !== undefined) update.default_image_model = default_image_model;
  if (show_greeting !== undefined) update.ai_greeting_enabled = show_greeting;
  if (ai_greeting_enabled !== undefined) update.ai_greeting_enabled = ai_greeting_enabled;

  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: update },
    { upsert: true }
  );

  return ok({ success: true });
}

export {
  handleRegister,
  handleLogin,
  handleFirebaseAuth,
  handleMe,
  handleProfileUpdate,
};
