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

// ============================================================
// BUSINESS INSIGHTS HANDLER
// ============================================================

async function handleAdminGetInsights(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Get all users and their message counts
  const userActivity = await db.collection('messages').aggregate([
    { $group: { _id: '$user_id', message_count: { $sum: 1 } } },
  ]).toArray();

  // Segment users by activity level
  const totalUsers = await db.collection('users').countDocuments();
  const segments = {
    inactive: { count: 0, percentage: 0, messages: 0 },
    light: { count: 0, percentage: 0, messages: 0, range: '1-10' },
    moderate: { count: 0, percentage: 0, messages: 0, range: '11-50' },
    heavy: { count: 0, percentage: 0, messages: 0, range: '51-200' },
    power: { count: 0, percentage: 0, messages: 0, range: '200+' },
  };

  const activeUserIds = new Set(userActivity.map(u => u._id));
  segments.inactive.count = totalUsers - activeUserIds.size;

  for (const user of userActivity) {
    const msgCount = user.message_count;
    if (msgCount <= 10) {
      segments.light.count++;
      segments.light.messages += msgCount;
    } else if (msgCount <= 50) {
      segments.moderate.count++;
      segments.moderate.messages += msgCount;
    } else if (msgCount <= 200) {
      segments.heavy.count++;
      segments.heavy.messages += msgCount;
    } else {
      segments.power.count++;
      segments.power.messages += msgCount;
    }
  }

  // Calculate percentages
  for (const key in segments) {
    segments[key].percentage = totalUsers > 0 ? Math.round((segments[key].count / totalUsers) * 100) : 0;
  }

  // Get cost data
  const totalMessages = await db.collection('messages').countDocuments();
  const tokensByModel = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true } } },
    { $group: { _id: '$model_used', total_input: { $sum: '$est_input_tokens' }, total_output: { $sum: '$est_output_tokens' } } },
  ]).toArray();

  let totalLLMCost = 0;
  for (const row of tokensByModel) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    const cost = (row.total_input / 1_000_000) * p.input + (row.total_output / 1_000_000) * p.output;
    totalLLMCost += cost;
  }

  // Get media generation cost
  const mediaJobs = await db.collection('media_gallery').find({}).toArray();
  const totalMediaCost = mediaJobs.reduce((sum, job) => sum + (job.cost_usd || job.estimated_cost_usd || 0), 0);

  // Get voice chat costs
  const voiceMetrics = await getVoiceChatMetrics(db, new Date(now - 7 * 24 * 60 * 60 * 1000), thirtyDaysAgo);
  const voiceCosts = voiceMetrics.cost || {};

  // Calculate pricing recommendations (including voice costs)
  const costPerMessage = totalMessages > 0 ? totalLLMCost / totalMessages : 0;
  const avgCostPerUser = totalUsers > 0 ? totalLLMCost / totalUsers : 0;
  const voiceCostPerUser = voiceMetrics.unique_users > 0 ? (voiceCosts.total_cost_usd || 0) / voiceMetrics.unique_users : 0;
  const mediaCostPerUser = totalUsers > 0 ? totalMediaCost / totalUsers : 0;
  const totalCostPerUser = avgCostPerUser + voiceCostPerUser + mediaCostPerUser;
  const totalPlatformCost = totalLLMCost + totalMediaCost + (voiceCosts.total_cost_usd || 0);

  // Combined cost per message tier (LLM + estimated voice + media per-msg)
  const combinedCostPerMsg = costPerMessage + (voiceCostPerUser > 0 ? voiceCostPerUser / (totalMessages > 0 ? totalMessages / totalUsers : 10) : 0);

  const pricingRecommendations = {
    cost_per_message: costPerMessage,
    avg_cost_per_user: avgCostPerUser,
    total_llm_cost: totalLLMCost,
    total_media_cost: totalMediaCost,
    total_voice_cost: voiceCosts.total_cost_usd || 0,
    total_platform_cost: totalPlatformCost,
    voice_cost_per_user: voiceCostPerUser,
    media_cost_per_user: mediaCostPerUser,
    total_cost_per_user: totalCostPerUser,
    tiers: {
      free: {
        message_limit: 25,
        estimated_cost: parseFloat((25 * combinedCostPerMsg).toFixed(2)),
      },
      basic: {
        message_limit: 100,
        estimated_cost: parseFloat((100 * combinedCostPerMsg).toFixed(2)),
        price_at_70_margin: parseFloat((100 * combinedCostPerMsg / 0.3).toFixed(2)),
        price_at_80_margin: parseFloat((100 * combinedCostPerMsg / 0.2).toFixed(2)),
        price_at_90_margin: parseFloat((100 * combinedCostPerMsg / 0.1).toFixed(2)),
        recommended_price: Math.max(10, Math.ceil((100 * combinedCostPerMsg / 0.2))),
      },
      pro: {
        message_limit: 500,
        estimated_cost: parseFloat((500 * combinedCostPerMsg).toFixed(2)),
        price_at_70_margin: parseFloat((500 * combinedCostPerMsg / 0.3).toFixed(2)),
        price_at_80_margin: parseFloat((500 * combinedCostPerMsg / 0.2).toFixed(2)),
        price_at_90_margin: parseFloat((500 * combinedCostPerMsg / 0.1).toFixed(2)),
        recommended_price: Math.max(20, Math.ceil((500 * combinedCostPerMsg / 0.2))),
      },
      enterprise: {
        message_limit: 'unlimited',
        estimated_cost: parseFloat((totalCostPerUser * 10).toFixed(2)),
        recommended_price: Math.max(99, Math.ceil((totalCostPerUser * 10 / 0.2))),
      },
    },
  };

  // Revenue potential scenarios
  const usersExceeding20 = userActivity.filter(u => u.message_count > 20).length;
  const usersExceeding50 = userActivity.filter(u => u.message_count > 50).length;
  const enterpriseCandidates = userActivity.filter(u => u.message_count > 500).length;

  const revenuePotential = {
    if_free_tier_20_msgs: {
      paying_users: usersExceeding20,
      at_10_per_month: usersExceeding20 * 10,
      at_20_per_month: usersExceeding20 * 20,
    },
    if_free_tier_50_msgs: {
      paying_users: usersExceeding50,
      at_10_per_month: usersExceeding50 * 10,
      at_20_per_month: usersExceeding50 * 20,
    },
    enterprise_candidates: enterpriseCandidates,
  };

  // Top users by message count
  const allUsers = await db.collection('users').find({}, { projection: { _id: 0, id: 1, email: 1 } }).toArray();
  const allProfiles = await db.collection('profiles').find({}, { projection: { _id: 0, user_id: 1, display_name: 1 } }).toArray();
  const profileMap = Object.fromEntries(allProfiles.map(p => [p.user_id, p]));
  const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

  // Get media counts per user
  const mediaByUser = await db.collection('media_gallery').aggregate([
    { $group: { _id: '$user_id', count: { $sum: 1 }, cost: { $sum: { $ifNull: ['$cost_usd', 0] } } } },
  ]).toArray();
  const mediaUserMap = Object.fromEntries(mediaByUser.map(m => [m._id, m]));

  // Get last active per user
  const lastActiveByUser = await db.collection('users').find({}, { projection: { _id: 0, id: 1, last_active_at: 1 } }).toArray();
  const lastActiveMap = Object.fromEntries(lastActiveByUser.map(u => [u.id, u.last_active_at]));

  const topUsers = userActivity
    .sort((a, b) => b.message_count - a.message_count)
    .slice(0, 20)
    .map(u => {
      const user = userMap[u._id] || {};
      const profile = profileMap[u._id] || {};
      const media = mediaUserMap[u._id] || {};
      const estCost = (u.message_count * costPerMessage).toFixed(2);
      return {
        name: profile.display_name || 'Unknown',
        email: user.email || '',
        messages: u.message_count,
        media_generated: media.count || 0,
        estimated_cost: estCost,
        last_active: lastActiveMap[u._id] || null,
      };
    });

  // Model popularity
  const modelUsage = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', model_used: { $exists: true, $ne: null } } },
    { $group: { _id: '$model_used', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
  const totalModelMessages = modelUsage.reduce((sum, m) => sum + m.count, 0);
  const modelPopularity = modelUsage.map(m => ({
    model: m._id || 'unknown',
    count: m.count,
    percentage: totalModelMessages > 0 ? Math.round((m.count / totalModelMessages) * 100) : 0,
  }));

  // Feature adoption
  const profilesCount = await db.collection('profiles').countDocuments();
  const assessmentComplete = await db.collection('profiles').countDocuments({ assessment_complete: true });
  const onboardingComplete = await db.collection('profiles').countDocuments({ onboarding_complete: true });
  const usersWithImports = await db.collection('import_jobs').distinct('user_id');
  const usersWithMedia = await db.collection('media_gallery').distinct('user_id');
  const usersWithMemories = await db.collection('memories').distinct('user_id');
  const telegramLinked = await db.collection('telegram_mappings').countDocuments({ linked: true });
  const voiceUsers = voiceMetrics.unique_users || 0;

  const featureAdoption = {
    assessment: { rate: totalUsers > 0 ? Math.round((assessmentComplete / totalUsers) * 100) : 0, users: assessmentComplete },
    onboarding: { rate: totalUsers > 0 ? Math.round((onboardingComplete / totalUsers) * 100) : 0, users: onboardingComplete },
    chat_import: { rate: totalUsers > 0 ? Math.round((usersWithImports.length / totalUsers) * 100) : 0, users: usersWithImports.length },
    media_generation: { rate: totalUsers > 0 ? Math.round((usersWithMedia.length / totalUsers) * 100) : 0, users: usersWithMedia.length },
    memories: { rate: totalUsers > 0 ? Math.round((usersWithMemories.length / totalUsers) * 100) : 0, users: usersWithMemories.length },
    telegram: { rate: totalUsers > 0 ? Math.round((telegramLinked / totalUsers) * 100) : 0, users: telegramLinked },
    voice_chat: { rate: totalUsers > 0 ? Math.round((voiceUsers / totalUsers) * 100) : 0, users: voiceUsers },
  };

  // Churn indicators
  const inactive30d = await db.collection('users').countDocuments({ last_active_at: { $lt: thirtyDaysAgo } });
  const neverEngaged = totalUsers - activeUserIds.size;
  const churnRate = totalUsers > 0 ? Math.round((inactive30d / totalUsers) * 100) : 0;
  const dropOffRate = totalUsers > 0 ? Math.round((neverEngaged / totalUsers) * 100) : 0;

  const churnIndicators = {
    inactive_30d: inactive30d,
    churn_rate: churnRate,
    never_engaged: neverEngaged,
    drop_off_rate: dropOffRate,
  };

  // Weekly trends (last 4 weeks)
  const weeklyTrends = [];
  for (let i = 0; i < 4; i++) {
    const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd - 7 * 24 * 60 * 60 * 1000);
    const weekMessages = await db.collection('messages').countDocuments({ created_at: { $gte: weekStart, $lt: weekEnd } });
    const weekActiveUsers = await db.collection('messages').aggregate([
      { $match: { created_at: { $gte: weekStart, $lt: weekEnd } } },
      { $group: { _id: '$user_id' } },
      { $count: 'total' },
    ]).toArray();
    const weekNewUsers = await db.collection('users').countDocuments({ created_at: { $gte: weekStart, $lt: weekEnd } });
    weeklyTrends.push({
      week: `Week ${4 - i}`,
      start: weekStart.toISOString().split('T')[0],
      messages: weekMessages,
      active_users: weekActiveUsers[0]?.total || 0,
      new_users: weekNewUsers,
    });
  }
  weeklyTrends.reverse();

  // Media insights
  const mediaUsers = usersWithMedia.length;
  const totalMediaJobs = mediaJobs.length;
  const mediaAdoptionRate = totalUsers > 0 ? Math.round((mediaUsers / totalUsers) * 100) : 0;
  const avgMediaPerUser = mediaUsers > 0 ? parseFloat((totalMediaJobs / mediaUsers).toFixed(1)) : 0;

  const mediaByType = await db.collection('media_gallery').aggregate([
    { $group: { _id: { $ifNull: ['$media_type', '$type'] }, count: { $sum: 1 }, total_cost: { $sum: { $ifNull: ['$cost_usd', 0] } } } },
  ]).toArray();

  const mediaInsights = {
    users_using_media: mediaUsers,
    media_adoption_rate: mediaAdoptionRate,
    avg_media_per_user: avgMediaPerUser,
    by_type: mediaByType.map(m => ({
      type: m._id || 'Unknown',
      count: m.count,
      total_cost: parseFloat((m.total_cost || 0).toFixed(2)),
    })),
  };

  return ok({
    generated_at: new Date().toISOString(),
    user_segments: segments,
    pricing_recommendations: pricingRecommendations,
    voice_costs: {
      ...voiceCosts,
      total_sessions: voiceMetrics.total_sessions,
      unique_users: voiceMetrics.unique_users,
      total_duration_seconds: voiceMetrics.total_duration_seconds,
      avg_duration_seconds: voiceMetrics.avg_duration_seconds,
      total_audio_input_tokens: voiceCosts.total_audio_input_tokens,
      total_audio_output_tokens: voiceCosts.total_audio_output_tokens,
      cost_per_session: voiceMetrics.completed_sessions > 0 ? voiceCosts.total_cost_usd / voiceMetrics.completed_sessions : 0,
      cost_per_minute: voiceMetrics.total_duration_seconds > 0 ? voiceCosts.total_cost_usd / (voiceMetrics.total_duration_seconds / 60) : 0,
      cost_per_user: voiceMetrics.unique_users > 0 ? voiceCosts.total_cost_usd / voiceMetrics.unique_users : 0,
    },
    revenue_potential: revenuePotential,
    top_users: topUsers,
    model_popularity: modelPopularity,
    feature_adoption: featureAdoption,
    churn_indicators: churnIndicators,
    weekly_trends: weeklyTrends,
    media_insights: mediaInsights,
  });
}

// ============================================================
// METRICS HANDLER
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

  // Cost calculations (all time)
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

  // Cost calculations (last 30 days)
  const tokensByModel30d = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true }, created_at: { $gte: thirtyDaysAgo } } },
    { $group: { _id: '$model_used', total_input: { $sum: '$est_input_tokens' }, total_output: { $sum: '$est_output_tokens' }, count: { $sum: 1 } } },
  ]).toArray();

  const costByModel30d = {};
  let totalEstCost30d = 0;
  for (const row of tokensByModel30d) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    const cost = (row.total_input / 1_000_000) * p.input + (row.total_output / 1_000_000) * p.output;
    costByModel30d[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    totalEstCost30d += cost;
  }

  // Media generation cost calculations
  const mediaJobs = await db.collection('media_gallery').find({}).toArray();
  let totalMediaCost = 0;
  let mediaCost30d = 0;
  const mediaCostByModel = {};

  for (const job of mediaJobs) {
    const cost = job.cost_usd || job.estimated_cost_usd || 0;
    totalMediaCost += cost;
    
    if (job.created_at && new Date(job.created_at) >= thirtyDaysAgo) {
      mediaCost30d += cost;
    }
    
    const model = job.model || 'unknown';
    if (!mediaCostByModel[model]) {
      mediaCostByModel[model] = { cost: 0, jobs: 0 };
    }
    mediaCostByModel[model].cost += cost;
    mediaCostByModel[model].jobs += 1;
  }

  // Round media costs
  for (const model in mediaCostByModel) {
    mediaCostByModel[model].cost = parseFloat(mediaCostByModel[model].cost.toFixed(4));
  }

  // Voice metrics
  let voiceChatMetrics;
  try {
    voiceChatMetrics = await getVoiceChatMetrics(db, sevenDaysAgo, thirtyDaysAgo);
  } catch (e) {
    voiceChatMetrics = { total_sessions: 0, sessions_7d: 0, sessions_30d: 0, completed_sessions: 0, unique_users: 0, total_duration_seconds: 0, avg_duration_seconds: 0, total_voice_messages: 0, avg_messages_per_session: 0, voice_distribution: {}, cost: {} };
  }

  // Computed cost metrics the frontend needs
  const avgCostPerMessage = totalMessages > 0 ? totalEstCost / totalMessages : 0;
  const avgCostPerMessage30d = totalMessagesLast30d > 0 ? totalEstCost30d / totalMessagesLast30d : 0;
  const estCostPerActiveUser30d = activeUsersLast30d > 0 ? totalEstCost30d / activeUsersLast30d : 0;
  const messagesPerActiveUser30d = activeUsersLast30d > 0 ? (totalMessagesLast30d / activeUsersLast30d).toFixed(1) : '0';
  const estCostPerUserAllTime = acceptedUsers > 0 ? totalEstCost / acceptedUsers : 0;
  const messagesPerUserAllTime = acceptedUsers > 0 ? (totalMessages / acceptedUsers).toFixed(1) : '0';
  const estProjectedMonthlyCost = totalEstCost30d;

  // Media generation counts
  const mediaCountTotal = mediaJobs.length;
  const mediaCount30d = mediaJobs.filter(j => j.created_at && new Date(j.created_at) >= thirtyDaysAgo).length;

  // Grand totals (LLM + media + voice)
  const voiceCostTotal = voiceChatMetrics?.cost?.total_cost_usd || 0;
  const voiceCost30d = voiceChatMetrics?.cost?.cost_last_30d_usd || 0;
  const grandTotalCost = totalEstCost + totalMediaCost + voiceCostTotal;
  const grandTotalCost30d = totalEstCost30d + mediaCost30d + voiceCost30d;

  // Enhanced media_cost_by_model with fields the frontend expects
  const enhancedMediaCostByModel = {};
  for (const job of mediaJobs) {
    const model = job.model || 'unknown';
    const type = job.media_type || job.type || 'image';
    const key = `${type}-${model}`;
    if (!enhancedMediaCostByModel[key]) {
      enhancedMediaCostByModel[key] = { cost: 0, count: 0, credits: 0, model, type, jobs: 0 };
    }
    enhancedMediaCostByModel[key].cost += (job.cost_usd || job.estimated_cost_usd || 0);
    enhancedMediaCostByModel[key].count += 1;
    enhancedMediaCostByModel[key].credits += (job.credits_used || 0);
    enhancedMediaCostByModel[key].jobs += 1;
  }
  for (const key in enhancedMediaCostByModel) {
    enhancedMediaCostByModel[key].cost = parseFloat(enhancedMediaCostByModel[key].cost.toFixed(4));
  }

  // Telegram metrics for the engagement tab
  const telegramMessagesLast30d = await db.collection('messages').countDocuments({ source: 'telegram', created_at: { $gte: thirtyDaysAgo } });
  const telegramWeeklyActive = await db.collection('messages').aggregate([
    { $match: { source: 'telegram', created_at: { $gte: sevenDaysAgo } } },
    { $group: { _id: '$user_id' } },
    { $count: 'total' },
  ]).toArray();
  const telegramConversations = await db.collection('conversations').countDocuments({ source: 'telegram' });
  const telegramAdoptionRate = totalUsers > 0 ? Math.round((telegramLinkedUsers / totalUsers) * 100) : 0;

  // Platform breakdown
  const webMessages = totalMessages - telegramMessages;
  const webMessagesLast30d = totalMessagesLast30d - telegramMessagesLast30d;

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
    est_total_cost_30d: parseFloat(totalEstCost30d.toFixed(4)),
    cost_by_model: costByModel,
    cost_by_model_30d: costByModel30d,
    media_cost_total: parseFloat(totalMediaCost.toFixed(4)),
    media_cost_30d: parseFloat(mediaCost30d.toFixed(4)),
    media_cost_by_model: enhancedMediaCostByModel,
    voice_chat: voiceChatMetrics,
    // Computed cost fields
    est_projected_monthly_cost: parseFloat(estProjectedMonthlyCost.toFixed(4)),
    est_cost_per_active_user_30d: parseFloat(estCostPerActiveUser30d.toFixed(4)),
    messages_per_active_user_30d: messagesPerActiveUser30d,
    avg_cost_per_message_30d: parseFloat(avgCostPerMessage30d.toFixed(6)),
    est_cost_per_user_all_time: parseFloat(estCostPerUserAllTime.toFixed(4)),
    messages_per_user_all_time: messagesPerUserAllTime,
    avg_cost_per_message: parseFloat(avgCostPerMessage.toFixed(6)),
    // Media counts
    media_count_total: mediaCountTotal,
    media_count_30d: mediaCount30d,
    // Grand totals
    grand_total_cost: parseFloat(grandTotalCost.toFixed(4)),
    grand_total_cost_30d: parseFloat(grandTotalCost30d.toFixed(4)),
    // Telegram metrics
    telegram: {
      linked_users: telegramLinkedUsers,
      adoption_rate: telegramAdoptionRate,
      messages_total: telegramMessages,
      messages_30d: telegramMessagesLast30d,
      weekly_active_users: telegramWeeklyActive[0]?.total || 0,
      conversations: telegramConversations,
    },
    // Platform breakdown
    platform_breakdown: {
      web: {
        messages_total: webMessages,
        messages_30d: webMessagesLast30d,
      },
      telegram: {
        messages_total: telegramMessages,
        messages_30d: telegramMessagesLast30d,
      },
    },
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
// Conversations Handler
// ============================================================

async function handleAdminGetConversations(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 25;
  const search = searchParams.get('search') || '';

  const query = {};
  if (search) {
    // Search by user email, topic, or message content
    const matchingUsers = await db.collection('users')
      .find({ email: { $regex: search, $options: 'i' } }, { projection: { _id: 0, id: 1, email: 1 } })
      .toArray();
    const userIds = matchingUsers.map(u => u.id);

    // Find conversations that contain messages matching the search
    const matchingMsgConvs = await db.collection('messages').aggregate([
      { $match: { content: { $regex: search, $options: 'i' } } },
      { $group: { _id: '$conversation_id' } },
    ]).toArray();
    const msgConvIds = matchingMsgConvs.map(m => m._id).filter(Boolean);

    const orConditions = [
      { topic: { $regex: search, $options: 'i' } },
    ];
    if (userIds.length > 0) orConditions.push({ user_id: { $in: userIds } });
    if (msgConvIds.length > 0) orConditions.push({ id: { $in: msgConvIds } });

    query.$or = orConditions;
  }

  const total = await db.collection('conversations').countDocuments(query);
  const pages = Math.max(1, Math.ceil(total / limit));

  const conversations = await db.collection('conversations')
    .find(query, { projection: { _id: 0 } })
    .sort({ updated_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  // Get user emails
  const userIds = [...new Set(conversations.map(c => c.user_id))];
  const users = await db.collection('users')
    .find({ id: { $in: userIds } }, { projection: { _id: 0, id: 1, email: 1 } })
    .toArray();
  const userMap = Object.fromEntries(users.map(u => [u.id, u.email]));

  // Get message counts per conversation
  const convIds = conversations.map(c => c.id).filter(Boolean);
  const msgCounts = await db.collection('messages').aggregate([
    { $match: { conversation_id: { $in: convIds } } },
    { $group: { _id: '$conversation_id', count: { $sum: 1 } } },
  ]).toArray();
  const msgCountMap = Object.fromEntries(msgCounts.map(m => [m._id, m.count]));

  const enriched = conversations.map(c => ({
    id: c.id,
    user_email: userMap[c.user_id] || 'Unknown',
    topic: c.topic || null,
    message_count: msgCountMap[c.id] || c.message_count || 0,
    source: c.source || 'web',
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  return ok({ conversations: enriched, page, pages, total });
}

// ============================================================
// USER DETAILS HANDLER
// ============================================================

async function handleAdminGetUserDetails(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();

  // Get user
  const user = await db.collection('users').findOne({ id: userId });
  if (!user) {
    return err('User not found', 404);
  }

  // Get profile
  const profile = await db.collection('profiles').findOne({ user_id: userId });

  // Get conversations
  const conversations = await db.collection('conversations')
    .find({ user_id: userId })
    .sort({ updated_at: -1 })
    .toArray();
  
  // Get all messages for this user to analyze LLM usage
  const messages = await db.collection('messages')
    .find({ user_id: userId })
    .toArray();

  // Analyze LLM model usage - check both 'model' and 'model_used' fields
  const modelUsage = {};
  messages.forEach(m => {
    const modelName = m.model_used || m.model;
    if (modelName) {
      modelUsage[modelName] = (modelUsage[modelName] || 0) + 1;
    }
  });
  const modelUsageSorted = Object.entries(modelUsage)
    .sort((a, b) => b[1] - a[1])
    .map(([model, count]) => ({ model, count }));

  // Derive conversation topics by analyzing actual message content
  // Get messages grouped by conversation for topic analysis
  const conversationMessages = {};
  messages.forEach(m => {
    if (!conversationMessages[m.conversation_id]) {
      conversationMessages[m.conversation_id] = [];
    }
    conversationMessages[m.conversation_id].push(m);
  });

  // Analyze each conversation to derive a meaningful topic
  const topicBreakdown = {};
  
  for (const conv of conversations) {
    let topic = conv.topic_category || conv.topic;
    
    // If no existing topic or it's too vague, analyze the content
    if (!topic || topic === 'Uncategorized' || topic === 'General') {
      const convMessages = conversationMessages[conv.id] || [];
      // Get the first few user messages to understand context
      const userMessages = convMessages
        .filter(m => m.role === 'user')
        .slice(0, 5)
        .map(m => m.content || '')
        .join(' ')
        .toLowerCase();
      
      const title = (conv.title || '').toLowerCase();
      const combined = `${title} ${userMessages}`;
      
      // More specific topic detection based on actual content
      if (/\b(python|javascript|react|node|api|code|function|debug|error|bug|deploy|git|database|sql|css|html|typescript|json)\b/.test(combined)) {
        topic = 'Software Development';
      } else if (/\b(soulprint|app features|settings|how do i|tutorial|onboarding)\b/.test(combined)) {
        topic = 'App Usage & Features';
      } else if (/\b(email|reply to|draft|message to|respond|correspondence)\b/.test(combined)) {
        topic = 'Email & Messaging';
      } else if (/\b(blog|article|write about|essay|content for|post about|copywriting)\b/.test(combined)) {
        topic = 'Content Writing';
      } else if (/\b(story|fiction|creative writing|poem|narrative|character)\b/.test(combined)) {
        topic = 'Creative Writing';
      } else if (/\b(business|startup|entrepreneur|company|revenue|customers|market|strategy)\b/.test(combined)) {
        topic = 'Business & Startups';
      } else if (/\b(marketing|social media|brand|campaign|audience|engagement|seo|ads)\b/.test(combined)) {
        topic = 'Marketing & Social Media';
      } else if (/\b(ai|machine learning|gpt|llm|model|prompt|chatbot|neural)\b/.test(combined)) {
        topic = 'AI & Technology';
      } else if (/\b(product|feature|ux|ui|design|user experience|prototype|wireframe)\b/.test(combined)) {
        topic = 'Product & Design';
      } else if (/\b(meeting|agenda|presentation|slides|pitch|deck)\b/.test(combined)) {
        topic = 'Presentations & Meetings';
      } else if (/\b(research|study|paper|academic|thesis|analyze|data)\b/.test(combined)) {
        topic = 'Research & Analysis';
      } else if (/\b(learn|explain|teach|understand|what is|how does|tutorial)\b/.test(combined)) {
        topic = 'Learning & Education';
      } else if (/\b(schedule|calendar|plan|organize|todo|task|reminder|deadline)\b/.test(combined)) {
        topic = 'Planning & Organization';
      } else if (/\b(image|generate.*picture|create.*image|dalle|photo|illustration|art)\b/.test(combined)) {
        topic = 'Image Generation';
      } else if (/\b(video|animation|movie|clip|footage)\b/.test(combined)) {
        topic = 'Video Creation';
      } else if (/\b(money|budget|finance|invest|salary|expense|save|cost)\b/.test(combined)) {
        topic = 'Personal Finance';
      } else if (/\b(health|fitness|workout|diet|exercise|mental|therapy|wellness|sleep)\b/.test(combined)) {
        topic = 'Health & Wellness';
      } else if (/\b(relationship|dating|partner|friend|family|social|communication)\b/.test(combined)) {
        topic = 'Relationships & Social';
      } else if (/\b(travel|trip|vacation|flight|hotel|visit|destination)\b/.test(combined)) {
        topic = 'Travel Planning';
      } else if (/\b(recipe|cook|food|meal|restaurant|eat)\b/.test(combined)) {
        topic = 'Food & Cooking';
      } else if (/\b(career|job|resume|interview|hiring|work|profession|linkedin)\b/.test(combined)) {
        topic = 'Career & Jobs';
      } else if (/\b(legal|contract|agreement|terms|lawyer|law)\b/.test(combined)) {
        topic = 'Legal & Contracts';
      } else if (/\b(summarize|summary|tldr|key points|main ideas)\b/.test(combined)) {
        topic = 'Summarization';
      } else if (/\b(translate|translation|language|spanish|french|german|chinese)\b/.test(combined)) {
        topic = 'Translation';
      } else if (/\b(brainstorm|ideas|creative|innovate|concept|think of)\b/.test(combined)) {
        topic = 'Brainstorming & Ideas';
      } else if (/\b(feedback|review|critique|improve|edit|revise)\b/.test(combined)) {
        topic = 'Feedback & Review';
      } else if (/\b(personal|myself|my life|feeling|emotion|thought|reflect)\b/.test(combined)) {
        topic = 'Personal Reflection';
      } else if (combined.length > 50) {
        // If we have substantial content but no match, use the conversation title or first few words
        const firstUserMsg = convMessages.find(m => m.role === 'user')?.content || '';
        const snippet = firstUserMsg.split(' ').slice(0, 5).join(' ');
        topic = conv.title && conv.title.length > 3 ? conv.title.substring(0, 40) : snippet.substring(0, 40) || 'Miscellaneous';
      } else {
        topic = 'Quick Chat';
      }
    }
    
    topicBreakdown[topic] = (topicBreakdown[topic] || 0) + 1;
  }
  
  const topicsSorted = Object.entries(topicBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));

  // Get memories and analyze by category
  const memories = await db.collection('user_memories')
    .find({ user_id: userId })
    .toArray();
  
  const memoryCategories = {};
  memories.forEach(m => {
    const cat = m.category || 'general';
    memoryCategories[cat] = (memoryCategories[cat] || 0) + 1;
  });
  const memoryCategoriesSorted = Object.entries(memoryCategories)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));

  // Get assessment status (just completion info, not details)
  const assessmentAnswers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .toArray();
  
  // Get unique pillars answered
  const questions = await db.collection('assessment_questions')
    .find({ id: { $in: assessmentAnswers.map(a => a.question_id) } })
    .toArray();
  const pillarsAnswered = [...new Set(questions.map(q => q.pillar).filter(Boolean))];

  // Get imports summary
  const imports = await db.collection('data_imports')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();

  // Get media generated - analyze by type/model
  const mediaItems = await db.collection('media_gallery')
    .find({ user_id: userId })
    .toArray();
  
  const mediaByType = {};
  const mediaByModel = {};
  mediaItems.forEach(m => {
    const type = m.type || 'image';
    const model = m.model || 'unknown';
    mediaByType[type] = (mediaByType[type] || 0) + 1;
    mediaByModel[model] = (mediaByModel[model] || 0) + 1;
  });

  // Get voice chat usage
  const voiceSessions = await db.collection('voice_sessions')
    .find({ user_id: userId })
    .toArray();
  
  const totalVoiceMinutes = voiceSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60;

  // Get telegram link
  const telegramLink = await db.collection('telegram_links')
    .findOne({ user_id: userId });

  // Get google connections
  const googleConnections = await db.collection('google_tokens')
    .find({ user_id: userId })
    .toArray();

  // Calculate costs
  const llmCostEstimate = messages.length * 0.002;
  const mediaCost = mediaItems.reduce((sum, m) => sum + (m.cost || 0), 0);
  const voiceCost = voiceSessions.reduce((sum, s) => sum + (s.estimated_cost_usd || 0), 0);

  // Get feedback summary
  const feedback = await db.collection('user_feedback')
    .find({ user_id: userId })
    .toArray();
  const thumbsUp = feedback.filter(f => f.rating === 'up').length;
  const thumbsDown = feedback.filter(f => f.rating === 'down').length;

  // Analyze usage patterns - messages by source
  const messagesBySource = {};
  messages.forEach(m => {
    const source = m.source || 'web';
    messagesBySource[source] = (messagesBySource[source] || 0) + 1;
  });

  // Get soul profile summary
  const soulProfile = await db.collection('soul_profiles')
    .findOne({ user_id: userId });

  return ok({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      accepted: user.accepted,
      created_at: user.created_at,
      last_active_at: user.last_active_at,
      auth_provider: user.auth_provider,
      firebase_linked: !!user.firebase_uid,
    },
    profile: profile ? {
      display_name: profile.display_name,
      assistant_name: profile.assistant_name,
      onboarding_complete: profile.onboarding_complete,
      field: profile.field,
      help_with: profile.help_with,
      discovery_source: profile.discovery_source,
      timezone: profile.timezone,
      location: profile.location,
    } : null,
    
    // Usage Statistics
    usage_stats: {
      total_conversations: conversations.length,
      total_messages: messages.length,
      total_memories: memories.length,
      total_media_generated: mediaItems.length,
      total_voice_sessions: voiceSessions.length,
      total_voice_minutes: Math.round(totalVoiceMinutes * 10) / 10,
      total_imports: imports.length,
    },
    
    // Cost Breakdown
    costs: {
      llm_cost: parseFloat(llmCostEstimate.toFixed(4)),
      media_cost: parseFloat(mediaCost.toFixed(4)),
      voice_cost: parseFloat(voiceCost.toFixed(4)),
      total_cost: parseFloat((llmCostEstimate + mediaCost + voiceCost).toFixed(4)),
    },
    
    // LLM Model Usage
    llm_usage: {
      models: modelUsageSorted,
      total_llm_messages: messages.filter(m => m.role === 'assistant').length,
    },
    
    // Conversation Topics
    conversation_topics: {
      topics: topicsSorted,
      total_conversations: conversations.length,
    },
    
    // Memory Categories (not content)
    memory_breakdown: {
      categories: memoryCategoriesSorted,
      total: memories.length,
    },
    
    // Assessment Status (completion only)
    assessment_status: {
      completed: assessmentAnswers.length >= 10,
      type: assessmentAnswers.length >= 30 ? 'full' : assessmentAnswers.length >= 10 ? 'quick' : assessmentAnswers.length > 0 ? 'partial' : 'none',
      questions_answered: assessmentAnswers.length,
      pillars_covered: pillarsAnswered,
    },
    
    // Media Generation Usage
    media_usage: {
      by_type: Object.entries(mediaByType).map(([type, count]) => ({ type, count })),
      by_model: Object.entries(mediaByModel).map(([model, count]) => ({ model, count })),
      total: mediaItems.length,
    },
    
    // Platform Usage (web vs telegram vs voice)
    platform_usage: {
      by_source: Object.entries(messagesBySource).map(([source, count]) => ({ source, count })),
    },
    
    // Integrations
    integrations: {
      telegram: telegramLink ? {
        linked: true,
        username: telegramLink.telegram_username,
        linked_at: telegramLink.created_at,
      } : { linked: false },
      google: googleConnections.length > 0 ? {
        connected: true,
        account_count: googleConnections.length,
      } : { connected: false },
    },
    
    // Feedback Summary
    feedback_summary: {
      total: feedback.length,
      thumbs_up: thumbsUp,
      thumbs_down: thumbsDown,
      satisfaction_rate: feedback.length > 0 ? Math.round((thumbsUp / feedback.length) * 100) : null,
    },
    
    // Data Imports
    imports: imports.map(i => ({
      type: i.type || i.source,
      status: i.status,
      items_processed: i.items_processed || i.messages_count || 0,
      date: i.created_at,
    })),
    
    // Soul Profile (high-level only)
    soul_profile: soulProfile ? {
      has_profile: true,
      interests_count: soulProfile.interests?.length || 0,
      updated_at: soulProfile.updated_at,
    } : { has_profile: false },
  });
}

// ============================================================
// APP UPDATES HANDLERS
// ============================================================

async function handleAdminGetAppUpdates(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  const updates = await db.collection('app_updates')
    .find({})
    .sort({ created_at: -1 })
    .toArray();

  return ok({
    updates: updates.map(u => ({
      id: u.id,
      title: u.title,
      description: u.description,
      version: u.version,
      type: u.type,
      published: u.published,
      release_date: u.release_date,
      created_at: u.created_at,
      updated_at: u.updated_at,
      created_by: u.created_by,
    })),
  });
}

async function handleAdminCreateAppUpdate(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { title, description, version, type, published, release_date } = body;

  if (!title || !description) {
    return err('Title and description are required', 400);
  }

  const db = await getDb();
  
  const newUpdate = {
    id: uuidv4(),
    title,
    description,
    version: version || null,
    type: type || 'feature',
    published: published || false,
    release_date: release_date ? new Date(release_date) : new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    created_by: admin.id,
  };

  await db.collection('app_updates').insertOne(newUpdate);

  return ok({ success: true, update: newUpdate });
}

async function handleAdminUpdateAppUpdate(request, updateId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  const existing = await db.collection('app_updates').findOne({ id: updateId });
  if (!existing) return err('Update not found', 404);

  const updates = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.version !== undefined) updates.version = body.version;
  if (body.type !== undefined) updates.type = body.type;
  if (body.published !== undefined) updates.published = body.published;
  if (body.release_date !== undefined) updates.release_date = new Date(body.release_date);
  updates.updated_at = new Date();

  await db.collection('app_updates').updateOne(
    { id: updateId },
    { $set: updates }
  );

  return ok({ success: true });
}

async function handleAdminDeleteAppUpdate(request, updateId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  const existing = await db.collection('app_updates').findOne({ id: updateId });
  if (!existing) return err('Update not found', 404);

  await db.collection('app_updates').deleteOne({ id: updateId });

  return ok({ success: true });
}

// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'users') return handleAdminGetUsers(request);
    if (pathStr === 'waitlist') return handleAdminGetWaitlist(request);
    if (pathStr === 'metrics') return handleAdminGetMetrics(request);
    if (pathStr === 'insights') return handleAdminGetInsights(request);
    if (pathStr === 'settings') return handleAdminGetSettings(request);
    if (pathStr === 'feedback') return handleAdminGetFeedback(request);
    if (pathStr === 'conversations') return handleAdminGetConversations(request);
    if (pathStr === 'beta-groups') return handleAdminGetBetaGroups(request);
    if (pathStr === 'beta-codes') return handleAdminGetBetaCodes(request);
    if (pathStr === 'blog/posts') return handleAdminGetBlogPosts(request);
    if (pathStr === 'app-updates') return handleAdminGetAppUpdates(request);
    // User details: users/:userId (but not users/export, etc.)
    if (pathStr.match(/^users\/[^\/]+$/) && !pathStr.includes('export')) {
      const userId = pathArr[1];
      return handleAdminGetUserDetails(request, userId);
    }

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
    if (pathStr === 'app-updates') return handleAdminCreateAppUpdate(request);

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
    if (pathStr.match(/^app-updates\/[^\/]+$/)) {
      const updateId = pathArr[1];
      return handleAdminUpdateAppUpdate(request, updateId);
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
    if (pathStr.match(/^app-updates\/[^\/]+$/)) {
      const updateId = pathArr[1];
      return handleAdminDeleteAppUpdate(request, updateId);
    }

    return err('Admin endpoint not found', 404);
  } catch (error) {
    console.error('[Admin API] DELETE Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
