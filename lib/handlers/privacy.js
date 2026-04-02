/**
 * Privacy & Data Management handlers
 * Extracted from the main catch-all route.js for maintainability.
 */

import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// PRIVACY & DATA MANAGEMENT
// ============================================================

// Export all user data (GDPR compliance)
async function handleExportUserData(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Collect all user data from all collections
  const [
    profile,
    conversations,
    messages,
    assessmentAnswers,
    importedMessages,
    memories,
    feedbacks,
    schedules,
    commProfile,
    soulProfile,
    soulprintSnapshots,
  ] = await Promise.all([
    db.collection('profiles').findOne({ user_id: user.id }),
    db.collection('conversations').find({ user_id: user.id }).toArray(),
    db.collection('messages').find({ user_id: user.id }).toArray(),
    db.collection('assessment_answers').find({ user_id: user.id }).toArray(),
    db.collection('imported_messages').find({ user_id: user.id }).toArray(),
    db.collection('memories').find({ user_id: user.id }).toArray(),
    db.collection('feedback').find({ user_id: user.id }).toArray(),
    db.collection('schedules').find({ user_id: user.id }).toArray(),
    db.collection('communication_profiles').findOne({ user_id: user.id }),
    db.collection('soul_profiles').findOne({ user_id: user.id }),
    db.collection('soulprint_snapshots').find({ user_id: user.id }).toArray(),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      role: user.role,
    },
    profile: profile ? {
      display_name: profile.display_name,
      assistant_name: profile.assistant_name,
      descriptors: profile.descriptors,
      field: profile.field,
      help_with: profile.help_with,
      discovery_source: profile.discovery_source,
      soul_profile_summary: profile.soul_profile_summary,
    } : null,
    communication_profile: commProfile ? {
      directness: commProfile.directness,
      emotional_warmth: commProfile.emotional_warmth,
      information_density: commProfile.information_density,
      proactivity: commProfile.proactivity,
      decision_support: commProfile.decision_support,
      feedback_style: commProfile.feedback_style,
    } : null,
    assessment_answers: assessmentAnswers.map(a => ({
      question_id: a.question_id,
      answer_text: a.answer_text,
      answered_at: a.created_at,
    })),
    conversations: conversations.map(c => ({
      id: c.id,
      title: c.title,
      created_at: c.created_at,
    })),
    messages: messages.map(m => ({
      conversation_id: m.conversation_id,
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    })),
    imported_messages_count: importedMessages.length,
    imported_messages_sample: importedMessages.slice(0, 100).map(m => ({
      content: m.content?.substring(0, 500),
      source: m.source,
      timestamp: m.timestamp,
    })),
    memories: memories.map(m => ({
      content: m.content,
      created_at: m.created_at,
    })),
    soulprint_snapshots: soulprintSnapshots.map(s => ({
      generated_at: s.created_at,
      summary: s.summary,
      communication_style: s.communication_style,
      interests: s.interests,
    })),
    schedules: schedules.map(s => ({
      name: s.name,
      schedule: s.schedule,
      active: s.active,
    })),
    feedback_given: feedbacks.length,
  };

  // Log the export
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'data_export',
    created_at: new Date(),
  });

  return ok(exportData);
}

// Delete all user data (GDPR right to erasure)
async function handleDeleteUserData(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { confirm_email } = body;

  // Require email confirmation for safety
  if (confirm_email?.toLowerCase() !== user.email?.toLowerCase()) {
    return err('Please confirm your email address to delete your account', 400);
  }

  const db = await getDb();

  // Delete from all collections
  const collections = [
    'profiles',
    'conversations', 
    'messages',
    'assessment_answers',
    'imported_messages',
    'memories',
    'feedback',
    'schedules',
    'communication_profiles',
    'soul_profiles',
    'soulprint_snapshots',
    'soul_profile_history',
    'imports',
    'announcements_read',
  ];

  const deletionResults = {};
  for (const collection of collections) {
    const result = await db.collection(collection).deleteMany({ user_id: user.id });
    deletionResults[collection] = result.deletedCount;
  }

  // Delete telegram links
  await db.collection('telegram_links').deleteMany({ user_id: user.id });

  // Log deletion before removing user
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    action: 'account_deleted',
    user_email: user.email,
    deletion_results: deletionResults,
    created_at: new Date(),
  });

  // Finally delete the user
  await db.collection('users').deleteOne({ id: user.id });

  return ok({ 
    success: true, 
    message: 'Your account and all associated data have been permanently deleted.',
    deleted: deletionResults 
  });
}

// Get user privacy settings
async function handleGetPrivacySettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const settings = await db.collection('user_privacy_settings').findOne({ user_id: user.id });

  return ok({
    ai_training_opt_out: settings?.ai_training_opt_out || false,
    data_retention_days: settings?.data_retention_days || null, // null = keep forever
    analytics_opt_out: settings?.analytics_opt_out || false,
    created_at: settings?.created_at,
    updated_at: settings?.updated_at,
  });
}

// Update user privacy settings
async function handleUpdatePrivacySettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { ai_training_opt_out, data_retention_days, analytics_opt_out } = body;

  const db = await getDb();
  await db.collection('user_privacy_settings').updateOne(
    { user_id: user.id },
    { 
      $set: { 
        user_id: user.id,
        ai_training_opt_out: !!ai_training_opt_out,
        data_retention_days: data_retention_days || null,
        analytics_opt_out: !!analytics_opt_out,
        updated_at: new Date(),
      },
      $setOnInsert: { created_at: new Date() }
    },
    { upsert: true }
  );

  // Log the change
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'privacy_settings_updated',
    changes: body,
    created_at: new Date(),
  });

  return ok({ success: true });
}

// Delete all conversations (purge chat history)
async function handlePurgeChatHistory(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Delete all messages
  const messagesResult = await db.collection('messages').deleteMany({ user_id: user.id });
  
  // Delete all conversations
  const convsResult = await db.collection('conversations').deleteMany({ user_id: user.id });

  // Log the purge
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'chat_history_purged',
    messages_deleted: messagesResult.deletedCount,
    conversations_deleted: convsResult.deletedCount,
    created_at: new Date(),
  });

  return ok({ 
    success: true, 
    messages_deleted: messagesResult.deletedCount,
    conversations_deleted: convsResult.deletedCount,
  });
}

// Delete all imported data
async function handlePurgeImportedData(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Delete from all import-related collections
  const [
    importedMsgsResult,
    importsResult,
    dataImportsResult,
    importJobsResult,
    uploadSessionsResult,
    corpusChunksResult,
  ] = await Promise.all([
    db.collection('imported_messages').deleteMany({ user_id: user.id }),
    db.collection('imports').deleteMany({ user_id: user.id }),
    db.collection('data_imports').deleteMany({ user_id: user.id }),
    db.collection('import_jobs').deleteMany({ user_id: user.id }),
    db.collection('upload_sessions').deleteMany({ user_id: user.id }),
    db.collection('source_corpus_chunks').deleteMany({ user_id: user.id }),
  ]);
  
  // Clear soul profile (derived from imports)
  await db.collection('soul_profiles').deleteOne({ user_id: user.id });
  
  // Clear soul profile summary from profiles
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $unset: { soul_profile_summary: '', soul_profile_updated_at: '', soul_profile_source: '' } }
  );
  
  // Clear communication profiles
  await db.collection('communication_profiles').deleteMany({ user_id: user.id });

  const totalDeleted = importedMsgsResult.deletedCount + importsResult.deletedCount + 
    dataImportsResult.deletedCount + importJobsResult.deletedCount + 
    uploadSessionsResult.deletedCount + corpusChunksResult.deletedCount;

  // Log the purge
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'imported_data_purged',
    details: {
      imported_messages: importedMsgsResult.deletedCount,
      imports: importsResult.deletedCount,
      data_imports: dataImportsResult.deletedCount,
      import_jobs: importJobsResult.deletedCount,
      upload_sessions: uploadSessionsResult.deletedCount,
      corpus_chunks: corpusChunksResult.deletedCount,
    },
    created_at: new Date(),
  });

  return ok({ 
    success: true, 
    imported_messages_deleted: importedMsgsResult.deletedCount,
    imports_deleted: importsResult.deletedCount + dataImportsResult.deletedCount,
    total_deleted: totalDeleted,
  });
}

// Delete all user memories
async function handlePurgeMemories(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Delete all memories from user_memories collection
  const memoriesResult = await db.collection('user_memories').deleteMany({ user_id: user.id });
  
  // Also clean legacy memories collection if exists
  const legacyResult = await db.collection('memories').deleteMany({ user_id: user.id });

  // Log the purge
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'memories_purged',
    memories_deleted: memoriesResult.deletedCount + legacyResult.deletedCount,
    created_at: new Date(),
  });

  return ok({ 
    success: true, 
    memories_deleted: memoriesResult.deletedCount + legacyResult.deletedCount,
  });
}

// Delete ALL user data (memories + imports + chat history) — nuclear option
async function handlePurgeAll(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Delete all chat data
  const [messagesResult, convsResult] = await Promise.all([
    db.collection('messages').deleteMany({ user_id: user.id }),
    db.collection('conversations').deleteMany({ user_id: user.id }),
  ]);

  // Delete all imported data
  await Promise.all([
    db.collection('imported_messages').deleteMany({ user_id: user.id }),
    db.collection('imports').deleteMany({ user_id: user.id }),
    db.collection('data_imports').deleteMany({ user_id: user.id }),
    db.collection('import_jobs').deleteMany({ user_id: user.id }),
    db.collection('upload_sessions').deleteMany({ user_id: user.id }),
    db.collection('source_corpus_chunks').deleteMany({ user_id: user.id }),
  ]);
  
  // Delete all memories
  const [memoriesResult, legacyMemResult] = await Promise.all([
    db.collection('user_memories').deleteMany({ user_id: user.id }),
    db.collection('memories').deleteMany({ user_id: user.id }),
  ]);

  // Clear profiles/soul data
  await Promise.all([
    db.collection('soul_profiles').deleteOne({ user_id: user.id }),
    db.collection('communication_profiles').deleteMany({ user_id: user.id }),
    db.collection('profiles').updateOne(
      { user_id: user.id },
      { $unset: { soul_profile_summary: '', soul_profile_updated_at: '', soul_profile_source: '' } }
    ),
  ]);

  const totalMemories = memoriesResult.deletedCount + legacyMemResult.deletedCount;

  // Log the purge
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'all_data_purged',
    details: {
      messages: messagesResult.deletedCount,
      conversations: convsResult.deletedCount,
      memories: totalMemories,
    },
    created_at: new Date(),
  });

  return ok({ 
    success: true, 
    messages_deleted: messagesResult.deletedCount,
    conversations_deleted: convsResult.deletedCount,
    memories_deleted: totalMemories,
  });
}

// Get data usage summary (transparency)
async function handleGetDataUsageSummary(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Count data in each collection
  const [
    messagesCount,
    conversationsCount,
    importedMessagesCount,
    memoriesCount,
    assessmentAnswersCount,
    snapshotsCount,
  ] = await Promise.all([
    db.collection('messages').countDocuments({ user_id: user.id }),
    db.collection('conversations').countDocuments({ user_id: user.id }),
    db.collection('imported_messages').countDocuments({ user_id: user.id }),
    db.collection('memories').countDocuments({ user_id: user.id }),
    db.collection('assessment_answers').countDocuments({ user_id: user.id }),
    db.collection('soulprint_snapshots').countDocuments({ user_id: user.id }),
  ]);

  // Get privacy settings
  const privacySettings = await db.collection('user_privacy_settings').findOne({ user_id: user.id });

  // Get user info
  const userDoc = await db.collection('users').findOne({ id: user.id });

  return ok({
    account: {
      created_at: userDoc?.created_at,
      email: userDoc?.email,
      auth_provider: userDoc?.auth_provider || 'email',
    },
    data_stored: {
      chat_messages: messagesCount,
      conversations: conversationsCount,
      imported_messages: importedMessagesCount,
      memories: memoriesCount,
      assessment_answers: assessmentAnswersCount,
      soulprint_snapshots: snapshotsCount,
    },
    privacy_settings: {
      ai_training_opt_out: privacySettings?.ai_training_opt_out || false,
      data_retention_days: privacySettings?.data_retention_days || 'Forever',
      analytics_opt_out: privacySettings?.analytics_opt_out || false,
    },
    data_usage: [
      { purpose: 'Personalization', description: 'Your assessment and chat history help personalize AI responses to your communication style.' },
      { purpose: 'Memory', description: 'Memories you save are used to provide context in future conversations.' },
      { purpose: 'SoulPrint Analysis', description: 'We analyze your data to generate your SoulPrint profile when you request it.' },
    ],
  });
}

// Get active sessions
async function handleGetSessions(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const sessions = await db.collection('user_sessions')
    .find({ user_id: user.id, expires_at: { $gt: new Date() } })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();

  return ok({
    sessions: sessions.map(s => ({
      id: s.id,
      device: s.device || 'Unknown device',
      location: s.location || 'Unknown',
      created_at: s.created_at,
      last_active: s.last_active,
      is_current: s.token_hash === request.headers.get('authorization')?.replace('Bearer ', '').substring(0, 20),
    }))
  });
}

// Revoke a session
async function handleRevokeSession(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { session_id } = body;

  if (!session_id) return err('Session ID required', 400);

  const db = await getDb();
  const result = await db.collection('user_sessions').deleteOne({ 
    id: session_id, 
    user_id: user.id 
  });

  if (result.deletedCount === 0) {
    return err('Session not found', 404);
  }

  return ok({ success: true });
}



export {
  handleExportUserData,
  handleDeleteUserData,
  handleGetPrivacySettings,
  handleUpdatePrivacySettings,
  handlePurgeChatHistory,
  handlePurgeImportedData,
  handlePurgeMemories,
  handlePurgeAll,
  handleGetDataUsageSummary,
  handleGetSessions,
  handleRevokeSession,
};
