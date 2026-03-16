import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { ok, err, requireAdmin, authenticate } from '@/lib/api-utils';
import { hashPassword } from '@/lib/auth';
import { sendWelcomeEmail, sendAcceptedEmail, sendBetaCodeEmail } from '@/lib/email';

// ============================================================
// MODEL PRICING CONSTANTS
// ============================================================

const MODEL_PRICING = {
  'gpt-5.2':                       { input: 10.00, output: 30.00 },
  'gpt-5':                         { input: 8.00,  output: 24.00 },
  'o3':                            { input: 15.00, output: 60.00 },
  'o3-mini':                       { input: 1.10,  output: 4.40  },
  'gpt-4.1':                       { input: 2.00,  output: 8.00  },
  'gpt-4.1-mini':                  { input: 0.40,  output: 1.60  },
  'gpt-4o':                        { input: 5.00,  output: 15.00 },
  'gpt-4o-mini':                   { input: 0.15,  output: 0.60  },
  'claude-opus-4-5-20251101':      { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5-20250929':    { input: 3.00,  output: 15.00 },
  'claude-3-5-haiku-20241022':     { input: 0.80,  output: 4.00  },
  'gemini-2.5-pro':                { input: 1.25,  output: 10.00 },
  'gemini-2.0-flash':              { input: 0.075, output: 0.30  },
  'sonar-pro':                     { input: 3.00,  output: 15.00 },
  'sonar':                         { input: 1.00,  output: 1.00  },
  'sonar-reasoning':               { input: 1.00,  output: 5.00  },
  'kimi-k2-0711-preview':          { input: 2.00,  output: 8.00  },
  'moonshot-v1-8k':                { input: 1.50,  output: 1.50  },
  'moonshot-v1-32k':               { input: 3.00,  output: 3.00  },
  'moonshot-v1-128k':              { input: 8.00,  output: 8.00  },
};
const DEFAULT_PRICING = { input: 5.00, output: 15.00 };

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function getVoiceChatMetrics(db, sevenDaysAgo, thirtyDaysAgo) {
  try {
    const totalSessions = await db.collection('voice_sessions').countDocuments();
    const sessionsLast7d = await db.collection('voice_sessions').countDocuments({ created_at: { $gte: sevenDaysAgo } });
    const sessionsLast30d = await db.collection('voice_sessions').countDocuments({ created_at: { $gte: thirtyDaysAgo } });
    const completedSessions = await db.collection('voice_sessions').countDocuments({ status: 'completed' });
    const uniqueVoiceUsers = await db.collection('voice_sessions').distinct('user_id');
    
    const stats = await db.collection('voice_sessions').aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          total_duration: { $sum: '$duration_seconds' },
          avg_duration: { $avg: '$duration_seconds' },
          total_messages: { $sum: '$message_count' },
          avg_messages: { $avg: '$message_count' },
          total_input_tokens: { $sum: { $ifNull: ['$audio_input_tokens', 0] } },
          total_output_tokens: { $sum: { $ifNull: ['$audio_output_tokens', 0] } },
          total_cost: { $sum: { $ifNull: ['$estimated_cost_usd', 0] } },
        }
      }
    ]).toArray();
    
    const aggregateStats = stats[0] || { total_duration: 0, avg_duration: 0, total_messages: 0, avg_messages: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost: 0 };
    
    const costStats30d = await db.collection('voice_sessions').aggregate([
      { $match: { status: 'completed', created_at: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total_cost: { $sum: { $ifNull: ['$estimated_cost_usd', 0] } }, total_duration: { $sum: '$duration_seconds' } } }
    ]).toArray();
    
    const cost30d = costStats30d[0] || { total_cost: 0, total_duration: 0 };
    
    const voiceDistribution = await db.collection('voice_sessions').aggregate([
      { $group: { _id: '$voice', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    const totalMinutes = aggregateStats.total_duration / 60;
    const costPerMinute = totalMinutes > 0 ? aggregateStats.total_cost / totalMinutes : 0;
    const avgCostPerSession = completedSessions > 0 ? aggregateStats.total_cost / completedSessions : 0;
    const costPerUser = uniqueVoiceUsers.length > 0 ? aggregateStats.total_cost / uniqueVoiceUsers.length : 0;
    
    return {
      total_sessions: totalSessions,
      sessions_7d: sessionsLast7d,
      sessions_30d: sessionsLast30d,
      completed_sessions: completedSessions,
      unique_users: uniqueVoiceUsers.length,
      total_duration_seconds: aggregateStats.total_duration,
      avg_duration_seconds: Math.round(aggregateStats.avg_duration || 0),
      total_voice_messages: aggregateStats.total_messages,
      avg_messages_per_session: Math.round(aggregateStats.avg_messages || 0),
      voice_distribution: voiceDistribution.reduce((acc, v) => { acc[v._id || 'unknown'] = v.count; return acc; }, {}),
      cost: {
        total_cost_usd: parseFloat(aggregateStats.total_cost.toFixed(2)),
        cost_last_30d_usd: parseFloat(cost30d.total_cost.toFixed(2)),
        cost_per_minute_usd: parseFloat(costPerMinute.toFixed(4)),
        avg_cost_per_session_usd: parseFloat(avgCostPerSession.toFixed(4)),
        cost_per_user_usd: parseFloat(costPerUser.toFixed(4)),
        total_audio_input_tokens: aggregateStats.total_input_tokens,
        total_audio_output_tokens: aggregateStats.total_output_tokens,
        pricing_note: 'Based on gpt-4o-realtime: $40/1M input, $80/1M output audio tokens',
      },
    };
  } catch (err) {
    console.error('Voice metrics error:', err);
    return {
      total_sessions: 0, sessions_7d: 0, sessions_30d: 0, completed_sessions: 0, unique_users: 0,
      total_duration_seconds: 0, avg_duration_seconds: 0, total_voice_messages: 0, avg_messages_per_session: 0,
      voice_distribution: {},
      cost: { total_cost_usd: 0, cost_last_30d_usd: 0, cost_per_minute_usd: 0, avg_cost_per_session_usd: 0, cost_per_user_usd: 0, total_audio_input_tokens: 0, total_audio_output_tokens: 0, pricing_note: '' },
    };
  }
}

function generateBetaCode(prefix = 'BETA') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix + '-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================================
// USER MANAGEMENT HANDLERS
// ============================================================

async function handleAdminGetUsers(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const onboardingFilter = searchParams.get('onboarding');
  const assessmentFilter = searchParams.get('assessment');

  const db = await getDb();
  const query = {};
  
  if (search) query.email = { $regex: search, $options: 'i' };
  if (startDate || endDate) {
    query.created_at = {};
    if (startDate) query.created_at.$gte = new Date(startDate);
    if (endDate) {
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      query.created_at.$lt = endDatePlusOne;
    }
  }

  let users = await db.collection('users').find(query).sort({ created_at: -1 }).toArray();
  const profiles = await db.collection('profiles').find({ user_id: { $in: users.map(u => u.id) } }).toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  const assessmentCounts = await db.collection('assessment_answers').aggregate([
    { $match: { user_id: { $in: users.map(u => u.id) } } },
    { $group: { _id: '$user_id', count: { $sum: 1 } } }
  ]).toArray();
  const assessmentCountMap = Object.fromEntries(assessmentCounts.map(a => [a._id, a.count]));

  const getAssessmentType = (userId) => {
    const count = assessmentCountMap[userId] || 0;
    if (count >= 30) return 'full';
    if (count >= 10) return 'quick';
    if (count > 0) return 'partial';
    return 'none';
  };

  if (onboardingFilter === 'complete') users = users.filter(u => profileMap[u.id]?.onboarding_complete === true);
  else if (onboardingFilter === 'incomplete') users = users.filter(u => !profileMap[u.id]?.onboarding_complete);
  
  if (assessmentFilter === 'complete') users = users.filter(u => profileMap[u.id]?.assessment_complete === true);
  else if (assessmentFilter === 'incomplete') users = users.filter(u => !profileMap[u.id]?.assessment_complete);
  else if (assessmentFilter === 'quick') users = users.filter(u => getAssessmentType(u.id) === 'quick');
  else if (assessmentFilter === 'full') users = users.filter(u => getAssessmentType(u.id) === 'full');

  const total = users.length;
  const paginatedUsers = users.slice((page - 1) * limit, page * limit);

  return ok({
    users: paginatedUsers.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      accepted: u.accepted,
      created_at: u.created_at,
      last_active_at: u.last_active_at,
      display_name: profileMap[u.id]?.display_name || '',
      assessment_complete: profileMap[u.id]?.assessment_complete || false,
      assessment_answer_count: assessmentCountMap[u.id] || 0,
      assessment_type: getAssessmentType(u.id),
      onboarding_complete: profileMap[u.id]?.onboarding_complete || false,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

async function handleAdminUpdateUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  const user = await db.collection('users').findOne({ id: userId });
  if (!user) return err('User not found', 404);

  const { role, accepted } = body;
  const updateFields = {};
  
  if (role !== undefined) updateFields.role = role;
  if (accepted !== undefined) updateFields.accepted = accepted;

  if (Object.keys(updateFields).length > 0) {
    await db.collection('users').updateOne({ id: userId }, { $set: updateFields });
    
    if (accepted === true && !user.accepted) {
      sendAcceptedEmail(user.email).catch(e => console.error('Accepted email failed:', e));
    }
  }

  return ok({ success: true });
}

async function handleAdminCreateUser(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { email, passcode, role = 'user', accepted = false, sendWelcome = false } = body;

  if (!email || !passcode) return err('Email and passcode required');

  const db = await getDb();
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already registered');

  const userId = uuidv4();
  const hashed = await hashPassword(passcode);
  const now = new Date();

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role,
    accepted,
    created_at: now,
    last_active_at: now,
    created_by_admin: admin.id,
    auth_provider: 'legacy',
  });

  await db.collection('profiles').insertOne({
    user_id: userId,
    display_name: '',
    assistant_name: 'SoulPrint',
    descriptors: [],
    field: '',
    help_with: [],
    discovery_source: 'admin_created',
    soul_profile_summary: '',
    onboarding_complete: false,
    assessment_complete: false,
    created_at: now,
  });

  if (sendWelcome) {
    sendWelcomeEmail(email, null).catch(e => console.error('Welcome email failed:', e));
  }

  return ok({ success: true, userId });
}

async function handleAdminDeleteUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const user = await db.collection('users').findOne({ id: userId });
  if (!user) return err('User not found', 404);

  if (user.role === 'superadmin') return err('Cannot delete superadmin', 403);
  if (user.id === admin.id) return err('Cannot delete yourself', 403);

  await Promise.all([
    db.collection('users').deleteOne({ id: userId }),
    db.collection('profiles').deleteOne({ user_id: userId }),
    db.collection('conversations').deleteMany({ user_id: userId }),
    db.collection('messages').deleteMany({ user_id: userId }),
    db.collection('memories').deleteMany({ user_id: userId }),
    db.collection('assessment_answers').deleteMany({ user_id: userId }),
  ]);

  return ok({ success: true });
}

async function handleAdminResetPasscode(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { newPasscode } = body;
  if (!newPasscode) return err('New passcode required');

  const db = await getDb();
  const hashed = await hashPassword(newPasscode);
  await db.collection('users').updateOne({ id: userId }, { $set: { passcode_hash: hashed } });

  return ok({ success: true });
}

// ============================================================
// METRICS HANDLERS
// ============================================================

async function handleAdminGetMetrics(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const totalUsers = await db.collection('users').countDocuments();
  const wauUsers = await db.collection('users').countDocuments({ last_active_at: { $gte: sevenDaysAgo } });
  const waitlistCount = await db.collection('users').countDocuments({ accepted: false });
  const acceptedUsers = await db.collection('users').countDocuments({ accepted: true });
  const activeUsersLast30d = await db.collection('users').countDocuments({ accepted: true, last_active_at: { $gte: thirtyDaysAgo } });

  const usersWithMultiConversations = await db.collection('conversations').aggregate([
    { $group: { _id: '$user_id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'total' },
  ]).toArray();
  const multiSessionCount = usersWithMultiConversations[0]?.total || 0;

  const usersCreated7DaysAgo = await db.collection('users').countDocuments({
    created_at: { $lte: sevenDaysAgo, $gte: new Date(now - 14 * 24 * 60 * 60 * 1000) },
  });
  const retainedUsers = await db.collection('users').countDocuments({
    created_at: { $lte: sevenDaysAgo },
    last_active_at: { $gte: sevenDaysAgo },
  });
  const day7Retention = usersCreated7DaysAgo > 0 ? Math.round((retainedUsers / usersCreated7DaysAgo) * 100) : 0;

  const conversationsIn7d = await db.collection('conversations').countDocuments({ created_at: { $gte: sevenDaysAgo } });
  const avgSessionsPerUser = wauUsers > 0 ? (conversationsIn7d / wauUsers).toFixed(1) : 0;

  const msgAgg = await db.collection('messages').aggregate([
    { $group: { _id: '$conversation_id', count: { $sum: 1 } } },
    { $group: { _id: null, avg: { $avg: '$count' } } },
  ]).toArray();
  const avgMsgPerSession = msgAgg[0]?.avg?.toFixed(1) || 0;

  const usersWithCompleteAssessment = await db.collection('profiles').countDocuments({ assessment_complete: true });
  const assessmentRate = totalUsers > 0 ? Math.round((usersWithCompleteAssessment / totalUsers) * 100) : 0;

  const usersWithImports = await db.collection('import_jobs').distinct('user_id');
  const importRate = totalUsers > 0 ? Math.round((usersWithImports.length / totalUsers) * 100) : 0;

  const telegramLinkedUsers = await db.collection('telegram_mappings').countDocuments({ linked: true });
  const telegramMessages = await db.collection('messages').countDocuments({ source: 'telegram' });
  const totalMessages = await db.collection('messages').countDocuments();
  const totalMessagesLast30d = await db.collection('messages').countDocuments({ created_at: { $gte: thirtyDaysAgo } });

  const thumbsUp = await db.collection('feedback').countDocuments({ rating: 'up' });
  const thumbsDown = await db.collection('feedback').countDocuments({ rating: 'down' });
  const csat = (thumbsUp + thumbsDown) > 0 ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100) : null;

  const recentSignups = await db.collection('users').countDocuments({ created_at: { $gte: thirtyDaysAgo } });

  // Cost calculations
  const tokensByModel = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true } } },
    { $group: { _id: '$model_used', total_input: { $sum: '$est_input_tokens' }, total_output: { $sum: '$est_output_tokens' }, count: { $sum: 1 } } },
  ]).toArray();

  const costByModel = {};
  let totalEstCost = 0;
  for (const row of tokensByModel) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    const cost = (row.total_input / 1_000_000) * p.input + (row.total_output / 1_000_000) * p.output;
    costByModel[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    totalEstCost += cost;
  }

  // Voice metrics
  let voiceChatMetrics;
  try {
    voiceChatMetrics = await getVoiceChatMetrics(db, sevenDaysAgo, thirtyDaysAgo);
  } catch (e) {
    voiceChatMetrics = { total_sessions: 0, sessions_7d: 0, sessions_30d: 0, completed_sessions: 0, unique_users: 0, total_duration_seconds: 0, avg_duration_seconds: 0, total_voice_messages: 0, avg_messages_per_session: 0, voice_distribution: {}, cost: {} };
  }

  return ok({
    wau: wauUsers,
    total_users: totalUsers,
    accepted_users: acceptedUsers,
    active_users_30d: activeUsersLast30d,
    waitlist_count: waitlistCount,
    multi_session_rate: totalUsers > 0 ? Math.round((multiSessionCount / totalUsers) * 100) : 0,
    day7_retention: day7Retention,
    avg_sessions_per_user_7d: avgSessionsPerUser,
    avg_messages_per_session: avgMsgPerSession,
    assessment_completion_rate: assessmentRate,
    import_adoption_rate: importRate,
    csat,
    recent_signups_30d: recentSignups,
    total_messages: totalMessages,
    total_messages_30d: totalMessagesLast30d,
    telegram_linked_users: telegramLinkedUsers,
    telegram_messages: telegramMessages,
    thumbs_up: thumbsUp,
    thumbs_down: thumbsDown,
    est_total_cost: parseFloat(totalEstCost.toFixed(4)),
    cost_by_model: costByModel,
    voice_chat: voiceChatMetrics,
  });
}

// ============================================================
// WAITLIST HANDLERS
// ============================================================

async function handleAdminGetWaitlist(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const waitlist = await db.collection('users')
    .find({ accepted: false })
    .sort({ created_at: -1 })
    .toArray();

  const profiles = await db.collection('profiles')
    .find({ user_id: { $in: waitlist.map(u => u.id) } })
    .toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  return ok({
    waitlist: waitlist.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      display_name: profileMap[u.id]?.display_name || '',
      discovery_source: profileMap[u.id]?.discovery_source || '',
      onboarding_complete: profileMap[u.id]?.onboarding_complete || false,
    })),
  });
}

async function handleAdminApproveWaitlist(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { userIds, sendEmail = true } = body;
  if (!userIds?.length) return err('User IDs required');

  const db = await getDb();
  await db.collection('users').updateMany(
    { id: { $in: userIds } },
    { $set: { accepted: true, accepted_at: new Date(), accepted_by: admin.id } }
  );

  if (sendEmail) {
    const users = await db.collection('users').find({ id: { $in: userIds } }).toArray();
    for (const user of users) {
      sendAcceptedEmail(user.email).catch(e => console.error('Accepted email failed:', e));
    }
  }

  return ok({ success: true, approved: userIds.length });
}

// ============================================================
// BETA CODE HANDLERS
// ============================================================

async function handleAdminGetBetaGroups(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const groups = await db.collection('beta_groups').find({}).sort({ created_at: -1 }).toArray();
  
  const groupsWithMetrics = await Promise.all(groups.map(async (group) => {
    const codes = await db.collection('beta_codes_v2').find({ group_id: group.id }).toArray();
    const totalCodes = codes.length;
    const activeCodes = codes.filter(c => c.active && (!c.expires_at || new Date(c.expires_at) >= new Date())).length;
    const totalRedemptions = codes.reduce((sum, c) => sum + (c.uses_count || 0), 0);
    
    return { ...group, totalCodes, activeCodes, totalRedemptions };
  }));

  return ok({ groups: groupsWithMetrics });
}

async function handleAdminCreateBetaGroup(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { name, description } = body;
  if (!name) return err('Group name required');

  const db = await getDb();
  const groupId = uuidv4();
  
  await db.collection('beta_groups').insertOne({
    id: groupId,
    name,
    description: description || '',
    created_at: new Date(),
    created_by: admin.id,
  });

  return ok({ success: true, groupId });
}

async function handleAdminGetBetaCodes(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');

  const db = await getDb();
  const query = groupId ? { group_id: groupId } : {};
  const codes = await db.collection('beta_codes_v2').find(query).sort({ created_at: -1 }).toArray();

  return ok({ codes });
}

async function handleAdminCreateBetaCodes(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { groupId, count = 1, prefix = 'BETA', maxUses = 1, expiresAt = null } = body;

  const db = await getDb();
  const codes = [];
  
  for (let i = 0; i < count; i++) {
    const code = {
      id: uuidv4(),
      code: generateBetaCode(prefix),
      group_id: groupId || null,
      max_uses: maxUses,
      uses_count: 0,
      active: true,
      expires_at: expiresAt ? new Date(expiresAt) : null,
      created_at: new Date(),
      created_by: admin.id,
    };
    codes.push(code);
  }

  await db.collection('beta_codes_v2').insertMany(codes);

  return ok({ success: true, codes: codes.map(c => c.code) });
}

async function handleAdminSendBetaCode(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { email, name } = body;
  if (!email) return err('Email required');

  const db = await getDb();
  const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
  
  if (!betaCode?.code) return err('No beta code configured');
  if (betaCode.expires_at && new Date(betaCode.expires_at) < new Date()) return err('Beta code has expired');

  const result = await sendBetaCodeEmail(email, betaCode.code, name);
  if (!result.success) return err(`Failed to send email: ${result.error}`);

  await db.collection('beta_code_sends').insertOne({
    id: uuidv4(),
    email,
    name: name || null,
    code: betaCode.code,
    sent_by: admin.id,
    sent_at: new Date(),
  });

  return ok({ success: true, message: `Beta code sent to ${email}` });
}

// ============================================================
// FEEDBACK HANDLERS
// ============================================================

async function handleAdminGetFeedback(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const rating = searchParams.get('rating');
  const reviewed = searchParams.get('reviewed');

  const db = await getDb();
  const query = {};
  if (rating) query.rating = rating;
  if (reviewed === 'true') query.reviewed = true;
  else if (reviewed === 'false') query.reviewed = { $ne: true };

  const total = await db.collection('feedback').countDocuments(query);
  const feedback = await db.collection('feedback')
    .find(query)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return ok({ feedback, total, page, pages: Math.ceil(total / limit) });
}

async function handleAdminUpdateFeedback(request, feedbackId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  await db.collection('feedback').updateOne(
    { id: feedbackId },
    { $set: { reviewed: body.reviewed, reviewed_by: admin.id, reviewed_at: new Date() } }
  );

  return ok({ success: true });
}

// ============================================================
// SETTINGS HANDLERS
// ============================================================

async function handleAdminGetSettings(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });
  const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });

  return ok({
    settings: settings || {},
    betaCode: betaCode || { code: '', expires_at: null, uses: 0 },
  });
}

async function handleAdminUpdateSettings(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  if (body.betaCode !== undefined) {
    await db.collection('beta_codes').updateOne(
      { id: 'current' },
      { $set: { code: body.betaCode.code, expires_at: body.betaCode.expires_at ? new Date(body.betaCode.expires_at) : null, updated_at: new Date() } },
      { upsert: true }
    );
  }

  if (body.settings !== undefined) {
    await db.collection('settings').updateOne(
      { id: 'global' },
      { $set: { ...body.settings, updated_at: new Date() } },
      { upsert: true }
    );
  }

  return ok({ success: true });
}

// ============================================================
// BLOG HANDLERS
// ============================================================

async function handleAdminGetBlogPosts(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const posts = await db.collection('blog_posts').find({}).sort({ created_at: -1 }).toArray();
  return ok({ posts });
}

async function handleAdminCreateBlogPost(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { title, slug, content, excerpt, coverImage, published = false, category, tags = [] } = body;

  if (!title || !slug || !content) return err('Title, slug, and content required');

  const db = await getDb();
  const existing = await db.collection('blog_posts').findOne({ slug });
  if (existing) return err('Slug already exists');

  const postId = uuidv4();
  await db.collection('blog_posts').insertOne({
    id: postId,
    title,
    slug,
    content,
    excerpt: excerpt || '',
    cover_image: coverImage || null,
    published,
    category: category || 'general',
    tags,
    author_id: admin.id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return ok({ success: true, postId });
}

async function handleAdminUpdateBlogPost(request, postId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  const updateFields = { updated_at: new Date() };
  if (body.title !== undefined) updateFields.title = body.title;
  if (body.content !== undefined) updateFields.content = body.content;
  if (body.excerpt !== undefined) updateFields.excerpt = body.excerpt;
  if (body.coverImage !== undefined) updateFields.cover_image = body.coverImage;
  if (body.published !== undefined) updateFields.published = body.published;
  if (body.category !== undefined) updateFields.category = body.category;
  if (body.tags !== undefined) updateFields.tags = body.tags;

  await db.collection('blog_posts').updateOne({ id: postId }, { $set: updateFields });
  return ok({ success: true });
}

async function handleAdminDeleteBlogPost(request, postId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  await db.collection('blog_posts').deleteOne({ id: postId });
  return ok({ success: true });
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'users') return handleAdminGetUsers(request);
    if (pathStr === 'waitlist') return handleAdminGetWaitlist(request);
    if (pathStr === 'metrics') return handleAdminGetMetrics(request);
    if (pathStr === 'settings') return handleAdminGetSettings(request);
    if (pathStr === 'feedback') return handleAdminGetFeedback(request);
    if (pathStr === 'beta-groups') return handleAdminGetBetaGroups(request);
    if (pathStr === 'beta-codes') return handleAdminGetBetaCodes(request);
    if (pathStr === 'blog/posts') return handleAdminGetBlogPosts(request);

    return err('Admin endpoint not found', 404);
  } catch (error) {
    console.error('[Admin API] GET Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'users') return handleAdminCreateUser(request);
    if (pathStr === 'waitlist/approve') return handleAdminApproveWaitlist(request);
    if (pathStr === 'beta-groups') return handleAdminCreateBetaGroup(request);
    if (pathStr === 'beta-codes') return handleAdminCreateBetaCodes(request);
    if (pathStr === 'beta-codes/send') return handleAdminSendBetaCode(request);
    if (pathStr === 'blog/posts') return handleAdminCreateBlogPost(request);

    return err('Admin endpoint not found', 404);
  } catch (error) {
    console.error('[Admin API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function PUT(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'settings') return handleAdminUpdateSettings(request);
    
    if (pathStr.match(/^users\/[^\/]+$/)) {
      const userId = pathArr[1];
      return handleAdminUpdateUser(request, userId);
    }
    if (pathStr.match(/^users\/[^\/]+\/reset-passcode$/)) {
      const userId = pathArr[1];
      return handleAdminResetPasscode(request, userId);
    }
    if (pathStr.match(/^feedback\/[^\/]+$/)) {
      const feedbackId = pathArr[1];
      return handleAdminUpdateFeedback(request, feedbackId);
    }
    if (pathStr.match(/^blog\/posts\/[^\/]+$/)) {
      const postId = pathArr[2];
      return handleAdminUpdateBlogPost(request, postId);
    }

    return err('Admin endpoint not found', 404);
  } catch (error) {
    console.error('[Admin API] PUT Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr.match(/^users\/[^\/]+$/)) {
      const userId = pathArr[1];
      return handleAdminDeleteUser(request, userId);
    }
    if (pathStr.match(/^blog\/posts\/[^\/]+$/)) {
      const postId = pathArr[2];
      return handleAdminDeleteBlogPost(request, postId);
    }

    return err('Admin endpoint not found', 404);
  } catch (error) {
    console.error('[Admin API] DELETE Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
