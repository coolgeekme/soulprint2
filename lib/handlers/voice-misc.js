/**
 * Voice settings, feature flags, admin, transcription, models, and misc handlers
 * Extracted from the main catch-all route.js for maintainability.
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err } from '@/lib/api-utils';
import { AVAILABLE_MODELS } from '@/lib/llm/providers';

// Admin: Deny User
async function handleAdminDenyUser(request, userId) {
  const user = await authenticate(request);
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return err('Forbidden', 403);
  }

  const db = await getDb();
  await db.collection('users').updateOne({ id: userId }, { $set: { accepted: false } });

  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: user.id,
    action: 'deny_user',
    target_user_id: userId,
    created_at: new Date(),
  });

  return ok({ success: true });
}

// Privacy helper: Categorize conversation topic
function categorizeConversationTopic(title) {
  if (!title) return 'General Chat';
  const lower = title.toLowerCase();
  
  if (/\b(code|coding|programming|javascript|python|react|api|debug|error|function|bug|deploy|database|sql|html|css|git)\b/.test(lower)) {
    return '💻 Coding & Development';
  }
  if (/\b(write|writing|draft|email|blog|article|essay|content|copy|edit|proofread|story|poem)\b/.test(lower)) {
    return '✍️ Writing & Content';
  }
  if (/\b(business|work|meeting|project|strategy|marketing|sales|startup|pitch|investor|client|presentation)\b/.test(lower)) {
    return '💼 Business & Work';
  }
  if (/\b(research|learn|study|explain|understand|how does|what is|why|teach|tutorial|course)\b/.test(lower)) {
    return '📚 Research & Learning';
  }
  if (/\b(design|creative|art|image|logo|brand|color|style|ui|ux|graphic|video|animation)\b/.test(lower)) {
    return '🎨 Creative & Design';
  }
  if (/\b(travel|trip|vacation|hotel|flight|restaurant|visit|tour|city|country|location|nearby)\b/.test(lower)) {
    return '✈️ Travel & Places';
  }
  if (/\b(health|fitness|workout|diet|medical|doctor|symptom|exercise|wellness|mental|therapy)\b/.test(lower)) {
    return '🏥 Health & Wellness';
  }
  if (/\b(money|finance|invest|stock|crypto|budget|save|price|cost|salary|tax|bank)\b/.test(lower)) {
    return '💰 Finance & Money';
  }
  if (/\b(twitter|instagram|linkedin|tiktok|facebook|post|caption|social media|viral|followers)\b/.test(lower)) {
    return '📱 Social Media';
  }
  if (/\b(news|today|current|latest|2024|2025|2026|happened|event|update|trending)\b/.test(lower)) {
    return '📰 News & Current Events';
  }
  if (/\b(personal|life|family|relationship|friend|advice|help me|feeling|emotion)\b/.test(lower)) {
    return '🌟 Personal & Life';
  }
  if (/\b(image|picture|photo|generate|create|draw|illustration|video|animation)\b/.test(lower)) {
    return '🖼️ Image & Media Generation';
  }
  
  return '💬 General Chat';
}

// Feature Flags
async function handleGetFeatureFlags(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });

  return ok({
    voice_chat_enabled: settings?.voice_chat_enabled !== false,
    viral_invites_enabled: settings?.viral_invites_enabled === true,
  });
}

// Voice Settings
async function handleGetVoiceSettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  const settings = await db.collection('voice_settings').findOne({ user_id: user.id });
  
  return ok(settings || {
    voice: 'alloy',
    default_voice: 'alloy',
    default_gemini_voice: 'Puck',
    voice_engine: 'openai',
    speed: 1.0,
    autoPlay: true,
    saveTranscripts: true,
    web_search_enabled: true,
  });
}

async function handleUpdateVoiceSettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const db = await getDb();
  
  await db.collection('voice_settings').updateOne(
    { user_id: user.id },
    { $set: { ...body, user_id: user.id, updated_at: new Date() } },
    { upsert: true }
  );
  
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: { voice_settings: body, updated_at: new Date() } }
  );
  
  return ok({ message: 'Voice settings saved' });
}

async function handleGetVoiceStats(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  const sessions = await db.collection('voice_sessions')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
  
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const lastSession = sessions[0] || null;
  
  return ok({
    totalSessions,
    totalDuration,
    averageDuration: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0,
    lastSessionAt: lastSession?.created_at || null,
    recentSessions: sessions.slice(0, 10).map(s => ({
      id: s.id,
      duration: s.duration || 0,
      created_at: s.created_at,
      transcript_length: s.transcript?.length || 0,
    })),
  });
}

// Transcribe - Whisper audio transcription
async function handleTranscribe(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    if (!audioFile) return err('No audio file provided');

    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    return ok({ text: transcription.text });
  } catch (error) {
    return err(`Transcription failed: ${error.message}`, 500);
  }
}

// Models - Get available
async function handleGetModels(request) {
  return ok(AVAILABLE_MODELS);
}

export {
  handleAdminDenyUser,
  categorizeConversationTopic,
  handleGetFeatureFlags,
  handleGetVoiceSettings,
  handleUpdateVoiceSettings,
  handleGetVoiceStats,
  handleTranscribe,
  handleGetModels,
};
