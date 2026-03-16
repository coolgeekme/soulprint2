import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate, requireAdmin } from '@/lib/api-utils';
import { getValidGoogleToken, getAllGoogleConnections } from '@/app/api/google/[...path]/route';

// ============================================================
// VOICE COST CONSTANTS (OpenAI Realtime API pricing)
// ============================================================

const VOICE_COST_PER_1M_INPUT_TOKENS = 40.00;  // gpt-4o-realtime: $40/1M input
const VOICE_COST_PER_1M_OUTPUT_TOKENS = 80.00; // gpt-4o-realtime: $80/1M output
const AUDIO_TOKENS_PER_SECOND = 50; // Approximate

function calculateVoiceCost(durationSeconds, messageCount) {
  const userSpeakingSeconds = durationSeconds * 0.4;
  const aiSpeakingSeconds = durationSeconds * 0.6;
  
  const inputTokens = Math.round(userSpeakingSeconds * AUDIO_TOKENS_PER_SECOND);
  const outputTokens = Math.round(aiSpeakingSeconds * AUDIO_TOKENS_PER_SECOND);
  
  const inputCost = (inputTokens / 1_000_000) * VOICE_COST_PER_1M_INPUT_TOKENS;
  const outputCost = (outputTokens / 1_000_000) * VOICE_COST_PER_1M_OUTPUT_TOKENS;
  
  return {
    audio_input_tokens: inputTokens,
    audio_output_tokens: outputTokens,
    estimated_cost_usd: parseFloat((inputCost + outputCost).toFixed(4)),
  };
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ============================================================
// VOICE SETTINGS HANDLERS
// ============================================================

async function handleGetVoiceSettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const settings = await db.collection('user_voice_settings').findOne({ user_id: user.id });

  return ok({
    default_voice: settings?.default_voice || 'alloy',
    web_search_enabled: settings?.web_search_enabled ?? true,
  });
}

async function handleUpdateVoiceSettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { default_voice, web_search_enabled } = body;

  const db = await getDb();
  
  const updates = { user_id: user.id, updated_at: new Date() };

  if (default_voice !== undefined) {
    const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];
    if (validVoices.includes(default_voice)) {
      updates.default_voice = default_voice;
    }
  }

  if (web_search_enabled !== undefined) {
    updates.web_search_enabled = !!web_search_enabled;
  }

  await db.collection('user_voice_settings').updateOne(
    { user_id: user.id },
    { $set: updates, $setOnInsert: { created_at: new Date() } },
    { upsert: true }
  );

  return ok({ success: true });
}

// ============================================================
// TTS PREVIEW
// ============================================================

async function handleTTSPreview(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { voice, text } = body;

  if (!voice || !text) return err('Voice and text required', 400);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) return err('OpenAI API key not configured', 500);

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text.slice(0, 200),
      voice: voice,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    return NextResponse.json({ error: errData.error?.message || 'TTS failed' }, { status: response.status });
  }

  const audioBuffer = await response.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength.toString(),
    },
  });
}

// ============================================================
// SESSION HANDLERS
// ============================================================

async function handleCreateVoiceSession(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { voice, mode, web_search_enabled } = body;

  const db = await getDb();
  const sessionId = uuidv4();

  const session = {
    id: sessionId,
    user_id: user.id,
    user_email: user.email,
    voice: voice || 'alloy',
    mode: mode || 'vad',
    web_search_enabled: web_search_enabled ?? true,
    status: 'started',
    started_at: new Date(),
    ended_at: null,
    duration_seconds: 0,
    message_count: 0,
    transcript_preview: null,
    audio_input_tokens: 0,
    audio_output_tokens: 0,
    text_tokens: 0,
    estimated_cost_usd: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  await db.collection('voice_sessions').insertOne(session);
  console.log(`[Voice] Session ${sessionId} started for user ${user.id}`);

  return ok({ success: true, session_id: sessionId });
}

async function handleUpdateVoiceSession(request, sessionId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { status, duration_seconds, message_count, transcript_preview, audio_input_tokens, audio_output_tokens } = body;

  const db = await getDb();
  
  const session = await db.collection('voice_sessions').findOne({ id: sessionId, user_id: user.id });
  if (!session) return err('Session not found', 404);

  const updates = { updated_at: new Date() };

  if (status) updates.status = status;
  if (status === 'completed') updates.ended_at = new Date();
  if (typeof duration_seconds === 'number') {
    updates.duration_seconds = duration_seconds;
    
    if (!audio_input_tokens && !audio_output_tokens) {
      const costData = calculateVoiceCost(duration_seconds, message_count || 0);
      updates.audio_input_tokens = costData.audio_input_tokens;
      updates.audio_output_tokens = costData.audio_output_tokens;
      updates.estimated_cost_usd = costData.estimated_cost_usd;
    }
  }
  if (typeof message_count === 'number') updates.message_count = message_count;
  if (transcript_preview) updates.transcript_preview = transcript_preview.slice(0, 500);
  
  if (typeof audio_input_tokens === 'number') updates.audio_input_tokens = audio_input_tokens;
  if (typeof audio_output_tokens === 'number') {
    updates.audio_output_tokens = audio_output_tokens;
    const inputCost = ((updates.audio_input_tokens || 0) / 1_000_000) * VOICE_COST_PER_1M_INPUT_TOKENS;
    const outputCost = (audio_output_tokens / 1_000_000) * VOICE_COST_PER_1M_OUTPUT_TOKENS;
    updates.estimated_cost_usd = parseFloat((inputCost + outputCost).toFixed(4));
  }

  await db.collection('voice_sessions').updateOne({ id: sessionId }, { $set: updates });
  console.log(`[Voice] Session ${sessionId} updated:`, { status, duration_seconds, message_count, cost: updates.estimated_cost_usd });

  return ok({ success: true });
}

async function handleGetVoiceSessions(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const page = parseInt(url.searchParams.get('page')) || 1;
  const skip = (page - 1) * limit;

  const sessions = await db.collection('voice_sessions')
    .find({})
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await db.collection('voice_sessions').countDocuments();

  const stats = await db.collection('voice_sessions').aggregate([
    {
      $group: {
        _id: null,
        total_sessions: { $sum: 1 },
        total_duration: { $sum: '$duration_seconds' },
        avg_duration: { $avg: '$duration_seconds' },
        total_messages: { $sum: '$message_count' },
        completed_count: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      }
    }
  ]).toArray();

  const aggregateStats = stats[0] || {
    total_sessions: 0, total_duration: 0, avg_duration: 0, total_messages: 0, completed_count: 0,
  };

  return ok({ sessions, total, page, limit, stats: aggregateStats });
}

// ============================================================
// USER VOICE STATS
// ============================================================

async function handleGetUserVoiceStats(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  const sessions = await db.collection('voice_sessions')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();

  const stats = await db.collection('voice_sessions').aggregate([
    { $match: { user_id: user.id } },
    {
      $group: {
        _id: null,
        total_sessions: { $sum: 1 },
        total_duration: { $sum: { $ifNull: ['$duration_seconds', 0] } },
        avg_duration: { $avg: { $ifNull: ['$duration_seconds', 0] } },
        total_messages: { $sum: { $ifNull: ['$message_count', 0] } },
        completed_count: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        first_session: { $min: '$created_at' },
        last_session: { $max: '$created_at' },
        total_audio_input_tokens: { $sum: { $ifNull: ['$audio_input_tokens', 0] } },
        total_audio_output_tokens: { $sum: { $ifNull: ['$audio_output_tokens', 0] } },
        total_cost: { $sum: { $ifNull: ['$estimated_cost_usd', 0] } },
      }
    }
  ]).toArray();

  const textStats = await db.collection('messages').aggregate([
    { $match: { user_id: user.id, role: 'assistant', est_input_tokens: { $exists: true } } },
    {
      $group: {
        _id: null,
        total_messages: { $sum: 1 },
        total_input_tokens: { $sum: { $ifNull: ['$est_input_tokens', 0] } },
        total_output_tokens: { $sum: { $ifNull: ['$est_output_tokens', 0] } },
      }
    }
  ]).toArray();

  const voiceDistribution = await db.collection('voice_sessions').aggregate([
    { $match: { user_id: user.id } },
    { $group: { _id: '$voice', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const sessionsOverTime = await db.collection('voice_sessions').aggregate([
    { $match: { user_id: user.id, created_at: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
        count: { $sum: 1 },
        total_duration: { $sum: { $ifNull: ['$duration_seconds', 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();

  const aggregateStats = stats[0] || {
    total_sessions: 0, total_duration: 0, avg_duration: 0, total_messages: 0, completed_count: 0,
    first_session: null, last_session: null, total_audio_input_tokens: 0, total_audio_output_tokens: 0, total_cost: 0,
  };

  const textStatsData = textStats[0] || { total_messages: 0, total_input_tokens: 0, total_output_tokens: 0 };
  
  const textInputCost = (textStatsData.total_input_tokens / 1_000_000) * 2.50;
  const textOutputCost = (textStatsData.total_output_tokens / 1_000_000) * 10.00;
  const totalTextCost = textInputCost + textOutputCost;

  return ok({
    stats: {
      total_sessions: aggregateStats.total_sessions,
      total_duration_seconds: aggregateStats.total_duration,
      total_duration_formatted: formatDuration(aggregateStats.total_duration),
      avg_duration_seconds: Math.round(aggregateStats.avg_duration || 0),
      avg_duration_formatted: formatDuration(Math.round(aggregateStats.avg_duration || 0)),
      total_messages: aggregateStats.total_messages,
      completed_rate: aggregateStats.total_sessions > 0 
        ? Math.round((aggregateStats.completed_count / aggregateStats.total_sessions) * 100) 
        : 0,
      first_session: aggregateStats.first_session,
      last_session: aggregateStats.last_session,
    },
    costs: {
      voice: {
        audio_input_tokens: aggregateStats.total_audio_input_tokens,
        audio_output_tokens: aggregateStats.total_audio_output_tokens,
        total_cost_usd: parseFloat(aggregateStats.total_cost.toFixed(4)),
        cost_per_session: aggregateStats.total_sessions > 0 
          ? parseFloat((aggregateStats.total_cost / aggregateStats.total_sessions).toFixed(4))
          : 0,
        cost_per_minute: aggregateStats.total_duration > 0
          ? parseFloat((aggregateStats.total_cost / (aggregateStats.total_duration / 60)).toFixed(4))
          : 0,
      },
      text: {
        total_messages: textStatsData.total_messages,
        input_tokens: textStatsData.total_input_tokens,
        output_tokens: textStatsData.total_output_tokens,
        estimated_cost_usd: parseFloat(totalTextCost.toFixed(4)),
      },
      grand_total_usd: parseFloat((aggregateStats.total_cost + totalTextCost).toFixed(4)),
    },
    voice_distribution: voiceDistribution.map(v => ({ voice: v._id || 'unknown', count: v.count })),
    sessions_over_time: sessionsOverTime,
    recent_sessions: sessions.map(s => ({
      id: s.id,
      voice: s.voice,
      duration_seconds: s.duration_seconds,
      message_count: s.message_count,
      status: s.status,
      created_at: s.created_at,
      cost_usd: s.estimated_cost_usd,
    })),
  });
}

// ============================================================
// WEB SEARCH (for voice chat)
// ============================================================

async function handleWebSearch(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { query, limit = 3 } = body;

  if (!query) return err('Query required', 400);

  const tavilyKey = process.env.TAVILY_API_KEY;
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;

  // Try Tavily first
  if (tavilyKey) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: query,
          max_results: limit,
          search_depth: 'basic',
          include_answer: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[WebSearch] Tavily returned ${data.results?.length || 0} results for: ${query}`);
        
        return ok({
          results: data.results?.map(r => ({
            title: r.title,
            url: r.url,
            content: r.content?.slice(0, 500),
          })) || [],
          answer: data.answer,
          query: query,
        });
      }
    } catch (tavilyErr) {
      console.error('[WebSearch] Tavily error:', tavilyErr);
    }
  }

  // Fallback to Brave
  if (braveKey) {
    try {
      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`, {
        headers: {
          'X-Subscription-Token': braveKey,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[WebSearch] Brave returned ${data.web?.results?.length || 0} results for: ${query}`);
        
        return ok({
          results: data.web?.results?.map(r => ({
            title: r.title,
            url: r.url,
            content: r.description?.slice(0, 500),
          })) || [],
          query: query,
        });
      }
    } catch (braveErr) {
      console.error('[WebSearch] Brave error:', braveErr);
    }
  }

  return NextResponse.json({ error: 'No search provider configured', results: [] }, { status: 503 });
}

// ============================================================
// TOOL EXECUTE (for voice chat)
// ============================================================

async function handleVoiceToolExecute(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { tool_name, tool_args } = body;

  if (!tool_name) return err('Tool name required', 400);

  const db = await getDb();

  // Handle different tools
  switch (tool_name) {
    case 'search_web': {
      const query = tool_args?.query;
      if (!query) return ok({ error: 'Query required' });
      
      const tavilyKey = process.env.TAVILY_API_KEY;
      if (!tavilyKey) return ok({ error: 'Search not configured' });
      
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            max_results: 3,
            search_depth: 'basic',
            include_answer: true,
          }),
        });
        const data = await response.json();
        return ok({
          results: data.results?.slice(0, 3).map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content?.slice(0, 300),
          })),
          answer: data.answer,
        });
      } catch (e) {
        return ok({ error: e.message });
      }
    }

    case 'get_calendar_events': {
      const tokenResult = await getValidGoogleToken(user.id);
      if (!tokenResult?.token) return ok({ error: 'Google Calendar not connected' });
      
      const timeMin = tool_args?.start_time || new Date().toISOString();
      const maxDays = tool_args?.days || 7;
      const timeMax = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000).toISOString();
      
      try {
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=10&singleEvents=true&orderBy=startTime`,
          { headers: { 'Authorization': `Bearer ${tokenResult.token}` } }
        );
        const data = await response.json();
        return ok({
          events: data.items?.slice(0, 10).map(e => ({
            title: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            location: e.location,
          })) || [],
        });
      } catch (e) {
        return ok({ error: e.message });
      }
    }

    case 'get_emails': {
      const tokenResult = await getValidGoogleToken(user.id);
      if (!tokenResult?.token) return ok({ error: 'Gmail not connected' });
      
      const maxResults = Math.min(tool_args?.limit || 5, 10);
      
      try {
        const response = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
          { headers: { 'Authorization': `Bearer ${tokenResult.token}` } }
        );
        const data = await response.json();
        
        if (!data.messages?.length) return ok({ emails: [] });
        
        const emails = await Promise.all(
          data.messages.slice(0, 5).map(async (msg) => {
            const detail = await fetch(
              `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              { headers: { 'Authorization': `Bearer ${tokenResult.token}` } }
            ).then(r => r.json());
            
            const headers = detail.payload?.headers || [];
            return {
              subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
              from: headers.find(h => h.name === 'From')?.value || '',
              date: headers.find(h => h.name === 'Date')?.value || '',
              snippet: detail.snippet || '',
            };
          })
        );
        
        return ok({ emails });
      } catch (e) {
        return ok({ error: e.message });
      }
    }

    case 'save_memory': {
      const content = tool_args?.content;
      const category = tool_args?.category || 'general';
      if (!content) return ok({ error: 'Content required' });
      
      await db.collection('memories').insertOne({
        id: uuidv4(),
        user_id: user.id,
        content,
        category,
        importance: tool_args?.importance || 'medium',
        source: 'voice',
        created_at: new Date(),
      });
      
      return ok({ success: true, message: `Saved: "${content.slice(0, 50)}..."` });
    }

    default:
      return ok({ error: `Unknown tool: ${tool_name}` });
  }
}

// ============================================================
// SYSTEM PROMPT (for voice chat)
// ============================================================

async function handleGetVoiceSystemPrompt(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const memories = await db.collection('memories').find({ user_id: user.id }).sort({ created_at: -1 }).limit(20).toArray();
  const googleConnected = await db.collection('google_connections').findOne({ user_id: user.id });

  const assistantName = profile?.assistant_name || 'SoulPrint';
  const displayName = profile?.display_name || 'there';
  
  let prompt = `You are ${assistantName}, a voice AI assistant for ${displayName}. Be conversational and helpful. Keep responses concise for voice.`;
  
  if (memories.length > 0) {
    prompt += `\n\nUser memories:\n${memories.map(m => `- ${m.content}`).join('\n')}`;
  }
  
  if (googleConnected) {
    prompt += `\n\nYou have access to ${displayName}'s Google Calendar and Gmail.`;
  }

  return ok({ system_prompt: prompt });
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'settings') return handleGetVoiceSettings(request);
    if (pathStr === 'sessions') return handleGetVoiceSessions(request);
    if (pathStr === 'user-stats') return handleGetUserVoiceStats(request);
    if (pathStr === 'system-prompt') return handleGetVoiceSystemPrompt(request);
    
    return err('Voice endpoint not found', 404);
  } catch (error) {
    console.error('[Voice API] GET Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'settings') return handleUpdateVoiceSettings(request);
    if (pathStr === 'tts/preview') return handleTTSPreview(request);
    if (pathStr === 'sessions') return handleCreateVoiceSession(request);
    if (pathStr === 'search') return handleWebSearch(request);
    if (pathStr === 'tool/execute') return handleVoiceToolExecute(request);
    
    return err('Voice endpoint not found', 404);
  } catch (error) {
    console.error('[Voice API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function PUT(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr.match(/^sessions\/[^\/]+$/)) {
      return handleUpdateVoiceSession(request, pathArr[1]);
    }
    
    return err('Voice endpoint not found', 404);
  } catch (error) {
    console.error('[Voice API] PUT Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
