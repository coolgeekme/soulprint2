/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MUSIC MODELS — Suno AI music generation via Kie.ai
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handles music generation using the Suno API through Kie.ai.
 * Supports text-to-music with lyrics, instrumental, style control.
 * Uses polling (GET record-info) to track async generation status.
 */

import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';

// ─── Endpoints ─────────────────────────────────────────────────────────────
const SUNO_GENERATE_URL = 'https://api.kie.ai/api/v1/generate';
const SUNO_STATUS_URL = 'https://api.kie.ai/api/v1/generate/record-info';

// ─── Available Suno Models ─────────────────────────────────────────────────
export const SUNO_MODELS = {
  'V5_5': { label: 'Suno V5.5', description: 'Custom models tailored to your unique taste', maxPrompt: 5000, maxStyle: 1000, maxDuration: '8 min' },
  'V5':   { label: 'Suno V5', description: 'Superior musical expression, faster generation', maxPrompt: 5000, maxStyle: 1000, maxDuration: '8 min' },
  'V4_5PLUS': { label: 'Suno V4.5+', description: 'Richer sound, new creation modes, max 8 min', maxPrompt: 5000, maxStyle: 1000, maxDuration: '8 min' },
  'V4_5': { label: 'Suno V4.5', description: 'Smarter prompts, faster generation, max 8 min', maxPrompt: 5000, maxStyle: 1000, maxDuration: '8 min' },
  'V4':   { label: 'Suno V4', description: 'Improved vocal quality, max 4 min', maxPrompt: 3000, maxStyle: 200, maxDuration: '4 min' },
};

const DEFAULT_MODEL = 'V4_5PLUS';

// ─── Music detection patterns ──────────────────────────────────────────────
const MUSIC_PATTERNS = [
  /\b(create|make|generate|compose|write|produce)\b.{0,20}\b(song|music|track|beat|melody|tune|anthem|jingle|lullaby|ballad|rap|hip[- ]?hop)\b/i,
  /\b(sing|rap)\b.{0,30}\b(about|for|a)\b/i,
  /\bsong\s+(about|for|called|titled|named)\b/i,
  /\bmusic\s+(about|for|that|with)\b/i,
  /\b(instrumental|acoustic|piano|guitar|orchestral)\s+(track|piece|song|music)\b/i,
  /\bgenerate\s+(an?\s+)?(audio|song|track|music)\b/i,
  /\b(write me|make me|create me)\s+(a\s+)?(song|track|beat|tune)\b/i,
  /\b(lo-?fi|hip[- ]?hop|electronic|jazz|classical|pop|rock|country|r&b|reggae|funk)\s+(song|track|beat|music)\b/i,
];

/**
 * Check if user message is requesting music generation.
 */
export function isMusicRequest(text) {
  if (!text || typeof text !== 'string') return false;
  return MUSIC_PATTERNS.some(p => p.test(text));
}

/**
 * Extract music parameters from user prompt using LLM.
 * Returns { title, style, lyrics, instrumental, cleanPrompt }
 */
export async function parseMusicPrompt(prompt, openaiApiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `You extract music generation parameters from user requests. Return valid JSON only.
Rules:
- "title": A catchy title for the song (max 80 chars)
- "style": Music genre/style tags (e.g., "pop, upbeat, electronic") (max 200 chars)
- "lyrics": If the user provided specific lyrics or wants specific lyrics, include them. Otherwise set to null.
- "instrumental": true if user explicitly wants no vocals/instrumental only, false otherwise
- "description": A brief clean description of the desired song (max 200 chars)
Respond ONLY with valid JSON.`
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[Music] Failed to parse prompt with LLM:', err.message);
    // Fallback: basic extraction
    return {
      title: prompt.slice(0, 80),
      style: 'pop',
      lyrics: null,
      instrumental: /\b(instrumental|no vocals|without vocals|no lyrics|without lyrics)\b/i.test(prompt),
      description: prompt.slice(0, 200),
    };
  }
}

/**
 * Generate music using Suno via Kie.ai.
 * 
 * @param {object} params - { prompt, title, style, lyrics, instrumental, model }
 * @param {string} kieApiKey - Kie.ai API key
 * @param {string} userId - User ID for tracking
 * @returns {Promise<{ jobId, taskId }>}
 */
export async function generateMusic(params, kieApiKey, userId) {
  const {
    prompt,
    title = 'Untitled Song',
    style = 'pop',
    lyrics = null,
    instrumental = false,
    model = DEFAULT_MODEL,
  } = params;

  const db = await getDb();
  const jobId = uuidv4();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://localhost:3000';

  // Build Suno request body
  const body = {
    prompt: lyrics || prompt,
    customMode: true,
    instrumental,
    model: model,
    style: style.slice(0, SUNO_MODELS[model]?.maxStyle || 200),
    title: title.slice(0, 80),
    callBackUrl: `${baseUrl}/api/music/callback`,
  };

  console.log('[Music] Generating:', { jobId, model, title, style, instrumental });

  // Call Suno API
  const response = await fetch(SUNO_GENERATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${kieApiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(data.msg || `Suno API error: ${data.code}`);
  }

  const taskId = data.data?.taskId;
  if (!taskId) throw new Error('No taskId returned from Suno API');

  // Store job in database
  await db.collection('music_jobs').insertOne({
    id: jobId,
    task_id: taskId,
    user_id: userId,
    status: 'pending',
    prompt: prompt,
    title: title,
    style: style,
    instrumental: instrumental,
    model: model,
    tracks: [],
    created_at: new Date(),
    updated_at: new Date(),
  });

  return { jobId, taskId };
}

/**
 * Check music generation status from Suno via Kie.ai.
 * Updates the database record and returns current state.
 */
export async function checkMusicStatus(jobId) {
  const db = await getDb();
  const job = await db.collection('music_jobs').findOne({ id: jobId });

  if (!job) throw new Error(`Music job not found: ${jobId}`);

  // If already completed or failed, return immediately
  if (job.status === 'completed' || job.status === 'failed') {
    return formatJobResponse(job);
  }

  const kieApiKey = process.env.KIE_API_KEY;
  if (!kieApiKey) {
    return formatJobResponse(job);
  }

  try {
    const response = await fetch(`${SUNO_STATUS_URL}?taskId=${job.task_id}`, {
      headers: { 'Authorization': `Bearer ${kieApiKey}` },
    });

    const data = await response.json();

    if (data.code !== 200) {
      console.error('[Music] Status check error:', data.msg);
      return formatJobResponse(job);
    }

    const taskData = data.data;
    const status = taskData?.status || taskData?.response?.status;

    // Map Suno status to our status
    let newStatus = job.status;
    let tracks = job.tracks || [];
    let error = null;

    if (status === 'SUCCESS') {
      newStatus = 'completed';
      const sunoTracks = taskData?.response?.sunoData || [];
      tracks = sunoTracks.map(t => ({
        id: t.id,
        audioUrl: t.audioUrl,
        streamUrl: t.streamAudioUrl,
        imageUrl: t.imageUrl,
        title: t.title || job.title,
        lyrics: t.prompt || '',
        tags: t.tags || job.style,
        duration: t.duration || 0,
        modelName: t.modelName,
      }));
    } else if (status === 'FIRST_SUCCESS') {
      newStatus = 'partial';
      const sunoTracks = taskData?.response?.sunoData || [];
      tracks = sunoTracks.filter(t => t.audioUrl).map(t => ({
        id: t.id,
        audioUrl: t.audioUrl,
        streamUrl: t.streamAudioUrl,
        imageUrl: t.imageUrl,
        title: t.title || job.title,
        lyrics: t.prompt || '',
        tags: t.tags || job.style,
        duration: t.duration || 0,
        modelName: t.modelName,
      }));
    } else if (status === 'TEXT_SUCCESS') {
      newStatus = 'lyrics_ready';
    } else if (['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'SENSITIVE_WORD_ERROR', 'CALLBACK_EXCEPTION'].includes(status)) {
      newStatus = 'failed';
      error = taskData?.response?.errorMessage || taskData?.errorMessage || `Generation failed: ${status}`;
    } else {
      newStatus = 'generating';
    }

    // Update database
    await db.collection('music_jobs').updateOne(
      { id: jobId },
      {
        $set: {
          status: newStatus,
          tracks: tracks.length > 0 ? tracks : job.tracks,
          error: error,
          suno_status: status,
          updated_at: new Date(),
        },
      }
    );

    return formatJobResponse({
      ...job,
      status: newStatus,
      tracks: tracks.length > 0 ? tracks : job.tracks,
      error,
      suno_status: status,
    });
  } catch (err) {
    console.error('[Music] Status check failed:', err.message);
    return formatJobResponse(job);
  }
}

/**
 * Format job data for API response.
 */
function formatJobResponse(job) {
  return {
    jobId: job.id,
    taskId: job.task_id,
    status: job.status,
    title: job.title,
    style: job.style,
    instrumental: job.instrumental,
    model: job.model,
    tracks: (job.tracks || []).map(t => ({
      id: t.id,
      audioUrl: t.audioUrl,
      streamUrl: t.streamUrl,
      imageUrl: t.imageUrl,
      title: t.title,
      lyrics: t.lyrics,
      tags: t.tags,
      duration: t.duration,
    })),
    error: job.error || null,
    createdAt: job.created_at,
  };
}

/**
 * Get all music jobs for a user.
 */
export async function getUserMusicJobs(userId, limit = 20) {
  const db = await getDb();
  return db.collection('music_jobs')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray()
    .then(jobs => jobs.map(formatJobResponse));
}

// ─── UX Progress Config ────────────────────────────────────────────────────
export const MUSIC_GENERATION_UX = {
  estimatedTimeLabel: '1-3 min',
  estimatedTimeMinSec: 60,
  estimatedTimeMaxSec: 180,
  pollIntervalMs: 5000,
  pollTimeoutMs: 10 * 60 * 1000,
  progressStages: [
    { threshold: 0, message: '🎵 Queuing your song...' },
    { threshold: 15, message: '✍️ Composing lyrics & melody...' },
    { threshold: 30, message: '🎹 Arranging instruments...' },
    { threshold: 50, message: '🎤 Generating vocals...' },
    { threshold: 70, message: '🎛️ Mixing & mastering...' },
    { threshold: 85, message: '🎶 Encoding final audio...' },
    { threshold: 95, message: '✨ Almost ready...' },
  ],
};
