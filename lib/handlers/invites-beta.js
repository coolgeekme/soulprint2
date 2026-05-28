/**
 * Viral Invite System + Beta Access Codes + Captcha & Email Verification
 * Extracted from route.js for maintainability.
 */
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { hashPassword, generateToken } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';

// VIRAL INVITE SYSTEM
// ============================================================

// Generate a unique invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like O, 0, I, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if viral invites are enabled
async function isViralInvitesEnabled() {
  try {
    const db = await getDb();
    const settings = await db.collection('app_settings').findOne({ key: 'global' });
    return settings?.viral_invites_enabled !== false; // Enabled by default
  } catch {
    return true; // Default to enabled if settings can't be read
  }
}

// Get user's invite info
async function handleGetUserInvites(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Check if viral invites are enabled
  const enabled = await isViralInvitesEnabled();
  if (!enabled) {
    return ok({ enabled: false });
  }

  // Get user's invite data
  let userData = await db.collection('users').findOne({ id: user.id });
  
  // Initialize invite code if user doesn't have one
  let inviteCode = userData?.invite_code;
  if (!inviteCode) {
    inviteCode = generateInviteCode();
    await db.collection('users').updateOne(
      { id: user.id },
      { 
        $set: { 
          invite_code: inviteCode,
          invites_remaining: userData?.invites_remaining ?? 5,
          invites_used: userData?.invites_used ?? 0,
        } 
      }
    );
    userData = await db.collection('users').findOne({ id: user.id });
  }

  // Auto-replenish: If user has 0 invites remaining and has used at least 1 invite,
  // automatically grant 5 more invites. This ensures users who ran out before the
  // auto-replenish feature was deployed also get new invites.
  if ((userData?.invites_remaining ?? 0) <= 0 && (userData?.invites_used ?? 0) > 0) {
    await db.collection('users').updateOne(
      { id: user.id },
      { $inc: { invites_remaining: 5 } }
    );
    console.log(`[Invites] Auto-replenished 5 invites for ${userData.email} on status check (total used: ${userData?.invites_used})`);
    // Refresh user data
    userData = await db.collection('users').findOne({ id: user.id });
  }

  // Get list of people this user has invited
  const invitedUsers = await db.collection('users')
    .find({ invited_by: user.id })
    .project({ id: 1, email: 1, created_at: 1 })
    .toArray();

  // Get inviter info if this user was invited
  let invitedBy = null;
  if (userData?.invited_by) {
    const inviter = await db.collection('users').findOne({ id: userData.invited_by });
    if (inviter) {
      const inviterProfile = await db.collection('profiles').findOne({ user_id: inviter.id });
      invitedBy = {
        id: inviter.id,
        name: inviterProfile?.display_name || inviter.email.split('@')[0],
      };
    }
  }

  // Check for invite badges
  const badges = userData?.badges || [];
  const inviteBadges = [
    { id: 'first_invite', name: 'First Invite', description: 'Invited your first friend', threshold: 1, icon: '🌟' },
    { id: 'social_butterfly', name: 'Social Butterfly', description: 'Invited 5 friends', threshold: 5, icon: '🦋' },
    { id: 'community_builder', name: 'Community Builder', description: 'Invited 10 friends', threshold: 10, icon: '🏗️' },
    { id: 'influencer', name: 'Influencer', description: 'Invited 25 friends', threshold: 25, icon: '⭐' },
  ];

  const earnedBadges = inviteBadges.filter(b => (userData?.invites_used || 0) >= b.threshold);

  return ok({
    enabled: true,
    invite_code: inviteCode,
    invites_remaining: userData?.invites_remaining ?? 5,
    invites_used: userData?.invites_used ?? 0,
    invited_users: invitedUsers.map(u => ({
      email: u.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Partially mask email
      joined_at: u.created_at,
    })),
    invited_by: invitedBy,
    badges: earnedBadges,
    all_badges: inviteBadges,
  });
}

// Validate an invite code (public endpoint - no auth required)
async function handleValidateInviteCode(request) {
  const { code } = await request.json();
  if (!code) return err('Invite code required');

  const db = await getDb();
  
  // Check if viral invites are enabled
  const enabled = await isViralInvitesEnabled();
  if (!enabled) {
    return err('Invite program is not currently active', 400);
  }

  // Find user with this invite code
  const inviter = await db.collection('users').findOne({ 
    invite_code: code.toUpperCase().trim() 
  });

  if (!inviter) {
    return err('Invalid invite code', 404);
  }

  // Check if inviter has remaining invites — auto-replenish if depleted
  if ((inviter.invites_remaining ?? 0) <= 0) {
    // Auto-replenish if user has used at least 1 invite before
    if ((inviter.invites_used ?? 0) > 0) {
      await db.collection('users').updateOne(
        { id: inviter.id },
        { $inc: { invites_remaining: 5 } }
      );
      console.log(`[Invites] Auto-replenished 5 invites for ${inviter.email} on validate (total used: ${inviter.invites_used})`);
      inviter.invites_remaining = 5;
    } else {
      return err('This invite code has no remaining uses', 400);
    }
  }

  // Get inviter's profile for display
  const inviterProfile = await db.collection('profiles').findOne({ user_id: inviter.id });
  
  return ok({
    valid: true,
    inviter_name: inviterProfile?.display_name || inviter.email.split('@')[0],
    invites_remaining: inviter.invites_remaining,
  });
}

// Redeem an invite code during registration
async function handleRedeemInviteCode(request) {
  const { code, email, passcode } = await request.json();
  if (!code || !email || !passcode) return err('Code, email and passcode required');

  const db = await getDb();
  
  // Check if viral invites are enabled
  const enabled = await isViralInvitesEnabled();
  if (!enabled) {
    return err('Invite program is not currently active', 400);
  }

  // Check if email already exists
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already registered');

  // Find inviter
  const inviter = await db.collection('users').findOne({ 
    invite_code: code.toUpperCase().trim() 
  });

  if (!inviter) {
    return err('Invalid invite code', 404);
  }

  if ((inviter.invites_remaining ?? 0) <= 0) {
    // Auto-replenish if user has used at least 1 invite before
    if ((inviter.invites_used ?? 0) > 0) {
      await db.collection('users').updateOne(
        { id: inviter.id },
        { $inc: { invites_remaining: 5 } }
      );
      console.log(`[Invites] Auto-replenished 5 invites for ${inviter.email} on redeem attempt (total used: ${inviter.invites_used})`);
      inviter.invites_remaining = 5;
    } else {
      return err('This invite code has no remaining uses', 400);
    }
  }

  // Create new user
  const userId = uuidv4();
  const hashed = await hashPassword(passcode);
  const now = new Date();
  const newInviteCode = generateInviteCode();

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role: 'user',
    accepted: true, // Auto-accept invited users
    created_at: now,
    last_active_at: now,
    invited_by: inviter.id,
    invite_code: newInviteCode,
    invites_remaining: 5, // New users also get 5 invites
    invites_used: 0,
    badges: [],
    auth_provider: 'invite',
  });

  // Decrement inviter's remaining invites and increment used count
  const newInvitesUsed = (inviter.invites_used || 0) + 1;
  
  // Check and award badges
  const badgesToAward = [];
  if (newInvitesUsed === 1) badgesToAward.push({ id: 'first_invite', awarded_at: now });
  if (newInvitesUsed === 5) badgesToAward.push({ id: 'social_butterfly', awarded_at: now });
  if (newInvitesUsed === 10) badgesToAward.push({ id: 'community_builder', awarded_at: now });
  if (newInvitesUsed === 25) badgesToAward.push({ id: 'influencer', awarded_at: now });

  const updateOps = {
    $inc: { invites_remaining: -1, invites_used: 1 },
  };
  
  if (badgesToAward.length > 0) {
    updateOps.$push = { badges: { $each: badgesToAward } };
  }

  await db.collection('users').updateOne(
    { id: inviter.id },
    updateOps
  );

  // Auto-replenish: Give inviter 5 more invites when they run out
  const updatedInviter = await db.collection('users').findOne({ id: inviter.id });
  if ((updatedInviter?.invites_remaining ?? 0) <= 0) {
    await db.collection('users').updateOne(
      { id: inviter.id },
      { $inc: { invites_remaining: 5 } }
    );
    console.log(`[Invites] Auto-replenished 5 invites for ${inviter.email} (total used: ${updatedInviter?.invites_used})`);
  }

  // Record the invite redemption
  await db.collection('invite_redemptions').insertOne({
    id: uuidv4(),
    inviter_id: inviter.id,
    invitee_id: userId,
    invitee_email: email.toLowerCase(),
    invite_code: code.toUpperCase().trim(),
    redeemed_at: now,
  });

  // Create empty profile for new user
  await db.collection('profiles').insertOne({
    user_id: userId,
    display_name: '',
    assistant_name: 'SoulPrint',
    descriptors: [],
    field: '',
    help_with: [],
    discovery_source: 'invite',
    soul_profile_summary: '',
    onboarding_complete: false,
    assessment_complete: false,
    created_at: now,
  });

  // Create default Free tier subscription record
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

  return ok({
    token,
    userId,
    role: 'user',
    accepted: true,
    onboarding_complete: false,
    assessment_complete: false,
    invite_code: newInviteCode, // Their own invite code
  });
}

// Admin: Get viral invite stats

// Admin: Toggle viral invites on/off

// Admin: Grant more invites to a user

// ============================================================
// PRICING FEATURES MANAGEMENT
// ============================================================

// Get all pricing features (current and future)

// Add a new pricing feature

// Update a pricing feature

// Delete a pricing feature

// Calculate pricing with custom features

// ============================================================
// BUSINESS INSIGHTS & PRICING ANALYTICS
// ============================================================

// Get detailed business insights for pricing decisions

// ============================================================


// ============================================================
// BETA ACCESS CODE MANAGEMENT
// ============================================================

// Get beta code stats

// Create/Update beta code

// Delete/Disable beta code

// Redeem beta code (for waitlisted users)
async function handleRedeemBetaCode(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { code } = body;
  
  if (!code) return err('Access code required');

  const db = await getDb();
  
  // Check if user is already accepted
  if (user.accepted) {
    return ok({ success: true, message: 'Already accepted' });
  }

  // Check if user has completed required onboarding questions
  // Required fields: display_name, discovery_source (how did you find us)
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  const hasDisplayName = profile?.display_name || user.profile?.display_name;
  const hasDiscoverySource = profile?.discovery_source || user.profile?.discovery_source;
  
  if (!hasDisplayName || !hasDiscoverySource) {
    return err('Please complete the onboarding questions before redeeming your access code. Go to the profile setup to answer required questions.', 400);
  }

  // Check if user has completed assessment (Quick Start = 12 questions, Full = 36 questions)
  const assessmentAnswerCount = await db.collection('assessment_answers').countDocuments({ user_id: user.id });
  const gradualAnswerCount = await db.collection('gradual_assessment_progress').countDocuments({ user_id: user.id });
  const totalAnswers = assessmentAnswerCount + gradualAnswerCount;
  
  // Require at least 12 answers (Quick Start minimum)
  if (totalAnswers < 12) {
    return err(`Please complete the assessment questions before redeeming your access code. You have answered ${totalAnswers}/12 required questions.`, 400);
  }

  const codeToCheck = code.toUpperCase().trim();
  let validCode = false;
  let usedCodeSource = null;

  // First check beta_codes_v2 (admin-created codes)
  const v2Code = await db.collection('beta_codes_v2').findOne({ 
    code: codeToCheck,
    active: true,
  });
  
  if (v2Code) {
    // Check expiration
    const isExpired = v2Code.expires_at && new Date(v2Code.expires_at) < new Date();
    if (isExpired) {
      return err('This access code has expired', 400);
    }
    
    // Check usage limits
    const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
    const isExhausted = v2Code.max_uses && currentUses >= v2Code.max_uses;
    if (isExhausted) {
      return err('This access code has reached its usage limit', 400);
    }
    
    validCode = true;
    usedCodeSource = 'v2';
    
    // Increment usage count
    await db.collection('beta_codes_v2').updateOne(
      { code: codeToCheck },
      { $inc: { uses: 1, uses_count: 1 } }
    );
  } else {
    // Fallback: check legacy beta_codes collection
    const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
    
    if (legacyCode && legacyCode.code && legacyCode.code.toUpperCase() === codeToCheck) {
      // Check if expired
      if (legacyCode.expires_at && new Date(legacyCode.expires_at) < new Date()) {
        return err('This access code has expired', 400);
      }
      
      validCode = true;
      usedCodeSource = 'legacy';
      
      // Increment usage count
      await db.collection('beta_codes').updateOne(
        { id: 'current' },
        { $inc: { uses: 1 } }
      );
    }
  }

  if (!validCode) {
    console.log('[Redeem Code] Invalid code attempted:', code, 'by user:', user.email);
    return err('Invalid access code', 400);
  }

  // Accept the user
  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { accepted: true, beta_code_used: code, accepted_at: new Date() } }
  );

  console.log('[Redeem Code] Code accepted:', code, 'for user:', user.email, 'source:', usedCodeSource);
  return ok({ success: true, message: 'Access granted!' });
}

// Validate beta code during registration (without requiring auth)
async function handleValidateBetaCode(request) {
  const body = await request.json();
  const { code } = body;
  
  if (!code) return ok({ valid: false });

  const db = await getDb();
  const codeToCheck = code.toUpperCase().trim();

  // First check beta_codes_v2 (admin-created codes)
  const v2Code = await db.collection('beta_codes_v2').findOne({ 
    code: codeToCheck,
    active: true,
  });
  
  if (v2Code) {
    // Check expiration
    if (v2Code.expires_at && new Date(v2Code.expires_at) < new Date()) {
      return ok({ valid: false, expired: true });
    }
    
    // Check usage limits
    const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
    if (v2Code.max_uses && currentUses >= v2Code.max_uses) {
      return ok({ valid: false, exhausted: true });
    }
    
    return ok({ valid: true });
  }

  // Fallback: check legacy beta_codes collection
  const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
  
  if (legacyCode && legacyCode.code && legacyCode.code.toUpperCase() === codeToCheck) {
    // Check if expired
    if (legacyCode.expires_at && new Date(legacyCode.expires_at) < new Date()) {
      return ok({ valid: false, expired: true });
    }
    
    return ok({ valid: true });
  }

  return ok({ valid: false });
}

// Send beta code via email

// ============================================================
// CAPTCHA & EMAIL VERIFICATION
// ============================================================

// Verify Google reCAPTCHA token
async function handleVerifyCaptcha(request) {
  try {
    const { token, action } = await request.json();
    
    if (!token) {
      return err('Captcha token required', 400);
    }

    const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
    if (!RECAPTCHA_SECRET) {
      console.error('RECAPTCHA_SECRET_KEY not configured');
      return err('Captcha verification not configured', 500);
    }

    // Verify with Google
    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${RECAPTCHA_SECRET}&response=${token}`,
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      console.error('reCAPTCHA verification failed:', verifyData);
      return err('Security verification failed', 400);
    }

    // Check score (reCAPTCHA v3 returns a score 0.0-1.0)
    if (verifyData.score !== undefined && verifyData.score < 0.3) {
      console.warn('Low reCAPTCHA score:', verifyData.score);
      return err('Security check failed. Please try again.', 400);
    }

    // Check action matches
    if (action && verifyData.action !== action) {
      console.warn('reCAPTCHA action mismatch:', verifyData.action, 'expected:', action);
      return err('Security verification mismatch', 400);
    }

    return ok({ success: true, score: verifyData.score });
  } catch (error) {
    console.error('Captcha verification error:', error);
    return err('Captcha verification failed', 500);
  }
}

// Send email verification
async function handleSendVerificationEmail(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);

    const { email } = await request.json();
    if (!email) return err('Email required', 400);

    const db = await getDb();
    
    // Generate verification token
    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save verification token
    await db.collection('users').updateOne(
      { id: user.id },
      { 
        $set: { 
          verification_token: verificationToken,
          verification_expires: expiresAt,
          email_verified: false,
        } 
      }
    );

    // Send verification email
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://soulprintengine.ai';
    const verifyUrl = `${BASE_URL}/verify-email?token=${verificationToken}`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SoulPrint <team@soulprintengine.ai>',
        to: [email],
        subject: 'Verify your SoulPrint account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D1217; padding: 40px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #F64000; margin: 0;">SoulPrint</h1>
              <p style="color: #707176; margin-top: 8px;">Your Personal AI</p>
            </div>
            
            <div style="background: #141a21; border-radius: 8px; padding: 30px; text-align: center;">
              <h2 style="color: white; margin-top: 0;">Verify Your Email</h2>
              <p style="color: #D2D3D7; line-height: 1.6;">
                Thanks for signing up for SoulPrint! Click the button below to verify your email address and activate your account.
              </p>
              
              <a href="${verifyUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #F64000, #d63600); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                Verify My Email
              </a>
              
              <p style="color: #707176; font-size: 12px; margin-top: 20px;">
                This link expires in 24 hours. If you didn't create an account, you can ignore this email.
              </p>
            </div>
            
            <p style="color: #4B5057; font-size: 12px; text-align: center; margin-top: 30px;">
              © ${new Date().getFullYear()} SoulPrint by ArcheForge
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errorData = await emailRes.json();
      console.error('Failed to send verification email:', errorData);
      return err('Failed to send verification email', 500);
    }

    return ok({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Send verification error:', error);
    return err('Failed to send verification email', 500);
  }
}

// Verify email token (GET endpoint handled separately)
async function handleVerifyEmail(request) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return err('Verification token required', 400);
    }

    const db = await getDb();
    
    // Find user with this token
    const user = await db.collection('users').findOne({
      verification_token: token,
      verification_expires: { $gt: new Date() },
    });

    if (!user) {
      return err('Invalid or expired verification link', 400);
    }

    // Mark email as verified
    await db.collection('users').updateOne(
      { id: user.id },
      { 
        $set: { email_verified: true },
        $unset: { verification_token: '', verification_expires: '' },
      }
    );

    return ok({ success: true, message: 'Email verified successfully!' });
  } catch (error) {
    console.error('Verify email error:', error);
    return err('Verification failed', 500);
  }
}

// ============================================================
// ADVANCED BETA CODE MANAGEMENT (Groups, Multiple Codes, Analytics)
// ============================================================

// Generate a random code with prefix
function generateBetaCode(prefix = 'BETA') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix + '-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all beta groups with metrics

// Create a new beta group

// Delete a beta group (and optionally its codes)

// Get all beta codes with full details

// Create beta codes (single or bulk)

// Update a beta code

// Delete a beta code

// Get redemption history for a code or all codes

// Validate and redeem a beta code (V2 - supports multiple codes)
async function handleValidateBetaCodeV2(request) {
  const body = await request.json();
  const { code, user_id, user_email } = body;
  
  if (!code) return ok({ valid: false });

  const db = await getDb();
  
  // First check v2 codes
  const betaCode = await db.collection('beta_codes_v2').findOne({ 
    code: code.toUpperCase().trim(),
    active: true,
  });
  
  if (!betaCode) {
    // Fall back to legacy single code
    const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
    if (legacyCode && legacyCode.code && 
        legacyCode.code.toUpperCase() === code.toUpperCase().trim() &&
        (!legacyCode.expires_at || new Date(legacyCode.expires_at) >= new Date())) {
      return ok({ valid: true, legacy: true });
    }
    return ok({ valid: false });
  }

  // Check if expired
  if (betaCode.expires_at && new Date(betaCode.expires_at) < new Date()) {
    return ok({ valid: false, expired: true });
  }

  // Check if exhausted
  if (betaCode.max_uses && betaCode.uses_count >= betaCode.max_uses) {
    return ok({ valid: false, exhausted: true });
  }

  // If user info provided, record the redemption
  if (user_id && user_email) {
    // Check if user already used this code
    const existingRedemption = await db.collection('beta_code_redemptions').findOne({
      code_id: betaCode.id,
      user_id,
    });
    
    if (existingRedemption) {
      return ok({ valid: true, already_used: true });
    }
    
    // Record redemption
    await db.collection('beta_code_redemptions').insertOne({
      id: uuidv4(),
      code_id: betaCode.id,
      code: betaCode.code,
      user_id,
      user_email,
      redeemed_at: new Date(),
    });
    
    // Increment usage count
    await db.collection('beta_codes_v2').updateOne(
      { id: betaCode.id },
      { $inc: { uses_count: 1 } }
    );
  }

  return ok({ 
    valid: true, 
    code_id: betaCode.id,
    group_id: betaCode.group_id,
  });
}

// Send notification email when a new user registers
async function sendNewUserNotificationEmail(user) {
  const ADMIN_EMAIL = 'reggie@archeforge.com';
  
  try {
    // Use the email service instead of inline Resend call
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


export {
  generateInviteCode,
  handleGetUserInvites,
  handleValidateInviteCode,
  handleRedeemInviteCode,
  handleRedeemBetaCode,
  handleValidateBetaCode,
  handleVerifyCaptcha,
  handleSendVerificationEmail,
  handleVerifyEmail,
  generateBetaCode,
  handleValidateBetaCodeV2,
  sendNewUserNotificationEmail,
};
