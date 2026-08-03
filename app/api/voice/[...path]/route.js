import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import { ok, err, authenticate, getValidGoogleToken, getAllGoogleConnections } from '@/lib/api-utils';

// Helper function to get user memories for prompt
async function getUserMemoriesForPrompt(db, userId) {
  try {
    return await db.collection('user_memories')
      .find({ user_id: userId })
      .sort({ importance: -1, created_at: -1 })
      .limit(20)
      .toArray();
  } catch (error) {
    console.error('[Memory] Error fetching memories:', error);
    return [];
  }
}

// Simplified system prompt builder for voice
async function buildSystemPrompt(db, userId) {
  try {
    const user = await db.collection('users').findOne({ id: userId });
    const profile = await db.collection('profiles').findOne({ user_id: userId });
    
    const assistantName = profile?.assistant_name || 'SoulPrint';
    const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
    
    // Build basic context
    const now = new Date();
    const currentDateTime = now.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    return `You are **${assistantName}**, a personal AI companion for **${displayName}**.

## Current Date & Time
- **Now**: ${currentDateTime}

## Core Behavior
You are a genuine, thoughtful companion. Be conversational, concise, and personal.

## Your Capabilities
- Real-time web access for current information
- Google integration (Gmail, Calendar)
- Memory and personalization
- Voice conversation optimized responses

Always respond naturally and reference what you know about ${displayName}.`;
  } catch (error) {
    console.error('[SystemPrompt] Error building prompt:', error);
    return `You are SoulPrint, a helpful AI assistant. Be conversational and helpful.`;
  }
}

// ============================================================
// VOICE HANDLER FUNCTIONS
// ============================================================

async function handleGetVoiceSettings(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const settings = await db.collection('user_voice_settings').findOne({ user_id: user.id });

    return NextResponse.json({
      default_voice: settings?.default_voice || 'alloy',
      web_search_enabled: settings?.web_search_enabled ?? true,
    });
  } catch (err) {
    console.error('[VoiceSettings] Get error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


async function handleUpdateVoiceSettings(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { default_voice, web_search_enabled } = body;

    const db = await getDb();
    
    const updates = {
      user_id: user.id,
      updated_at: new Date(),
    };

    if (default_voice !== undefined) {
      // Validate voice
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

    console.log(`[VoiceSettings] Updated for user ${user.id}:`, updates);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[VoiceSettings] Update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


async function handleTTSPreview(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { voice, text } = body;

    if (!voice || !text) {
      return NextResponse.json({ error: 'Voice and text required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Use OpenAI TTS API (fastest and cheapest for previews)
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1', // Use standard model for speed
        input: text.slice(0, 200), // Limit text for preview
        voice: voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[TTS] Preview error:', err);
      return NextResponse.json({ 
        error: err.error?.message || 'TTS failed' 
      }, { status: response.status });
    }

    // Stream audio back to client
    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error('[TTS] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// Read aloud endpoint - supports full message text (up to 4096 chars)
// Uses whichever voice engine + voice the user has selected as their default
async function handleTTSReadAloud(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text, voice } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }

    // Fetch user's voice settings from profile
    const db = await getDb();
    const profile = await db.collection('profiles').findOne({ user_id: user.id });
    const voiceSettingsFromProfile = profile?.voice_settings || {};

    // Strip markdown formatting for cleaner TTS output
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' code block ') // Replace code blocks
      .replace(/`[^`]+`/g, (match) => match.slice(1, -1)) // Inline code - just remove backticks
      .replace(/#{1,6}\s/g, '') // Remove heading markers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1') // Italic
      .replace(/!\[.*?\]\(.*?\)/g, '') // Images
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Links
      .replace(/[-*+]\s/g, '') // List markers
      .replace(/^\d+\.\s/gm, '') // Numbered lists
      .replace(/>\s/g, '') // Blockquotes
      .replace(/\n{2,}/g, '. ') // Multiple newlines to pause
      .replace(/\n/g, ' ') // Single newlines
      .trim();

    // Determine voice engine from user's profile settings
    const voiceEngine = voiceSettingsFromProfile.voice_engine || 'openai';
    const geminiVoice = voice || voiceSettingsFromProfile.default_gemini_voice || 'Puck';
    const openaiVoice = voice || voiceSettingsFromProfile.default_voice || 'alloy';

    // Try the user's preferred engine first, then fall back to the other one.
    // Never surface raw vendor error text (quota/billing details, doc links) to the client.
    const attempts = voiceEngine === 'gemini'
      ? [() => synthesizeWithGemini(cleanText, geminiVoice), () => synthesizeWithOpenAI(cleanText, openaiVoice)]
      : [() => synthesizeWithOpenAI(cleanText, openaiVoice), () => synthesizeWithGemini(cleanText, geminiVoice)];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (attemptErr) {
        lastError = attemptErr;
        console.warn('[TTS ReadAloud] Provider attempt failed, trying next:', attemptErr.message);
      }
    }

    console.error('[TTS ReadAloud] All providers failed:', lastError);
    return NextResponse.json({ error: 'Could not generate voice audio right now. Please try again in a moment.' }, { status: 502 });
  } catch (err) {
    console.error('[TTS ReadAloud] Error:', err);
    return NextResponse.json({ error: 'Could not generate voice audio. Please try again.' }, { status: 500 });
  }
}

async function synthesizeWithGemini(cleanText, geminiVoice) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error('Gemini API key not configured');

  const trimmedText = cleanText.slice(0, 5000); // Gemini TTS limit

  // Use Gemini TTS REST API for read-aloud (faster than live SDK for longer text)
  const ttsResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: trimmedText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: geminiVoice } } }
        }
      }),
    }
  );

  if (!ttsResponse.ok) {
    const errData = await ttsResponse.json().catch(() => ({}));
    console.error('[TTS ReadAloud Gemini] API error:', errData);
    throw new Error('Gemini TTS failed');
  }

  const ttsData = await ttsResponse.json();
  const audioPart = ttsData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!audioPart) throw new Error('No audio in Gemini TTS response');

  // Convert base64 PCM to WAV for browser playback
  const pcmData = Buffer.from(audioPart.inlineData.data, 'base64');
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = pcmData.length;

  // Create WAV header
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + dataSize, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // PCM
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  wavHeader.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  const wavBuffer = Buffer.concat([wavHeader, pcmData]);
  return new NextResponse(wavBuffer, {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': wavBuffer.byteLength.toString(),
    },
  });
}

async function synthesizeWithOpenAI(cleanText, selectedVoice) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) throw new Error('OpenAI API key not configured');

  const trimmedForOpenAI = cleanText.slice(0, 4096);

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: trimmedForOpenAI,
      voice: selectedVoice,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.error('[TTS ReadAloud] OpenAI error:', errBody);
    throw new Error('OpenAI TTS failed');
  }

  const audioBuffer = await response.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength.toString(),
    },
  });
}



async function handleCreateVoiceSession(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      // Cost tracking fields
      audio_input_tokens: 0,
      audio_output_tokens: 0,
      text_tokens: 0,
      estimated_cost_usd: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection('voice_sessions').insertOne(session);
    console.log(`[Voice] Session ${sessionId} started for user ${user.id}`);

    return NextResponse.json({ 
      success: true, 
      session_id: sessionId 
    });
  } catch (err) {
    console.error('[Voice] Create session error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


async function handleUpdateVoiceSession(request, sessionId) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status, duration_seconds, message_count, transcript_preview, audio_input_tokens, audio_output_tokens } = body;

    const db = await getDb();
    
    // Verify session belongs to user
    const session = await db.collection('voice_sessions').findOne({ 
      id: sessionId,
      user_id: user.id 
    });
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updates = {
      updated_at: new Date(),
    };

    if (status) updates.status = status;
    if (status === 'completed') updates.ended_at = new Date();
    if (typeof duration_seconds === 'number') {
      updates.duration_seconds = duration_seconds;
      
      // Calculate cost based on duration (if not provided directly)
      if (!audio_input_tokens && !audio_output_tokens) {
        const costData = calculateVoiceCost(duration_seconds, message_count || 0);
        updates.audio_input_tokens = costData.audio_input_tokens;
        updates.audio_output_tokens = costData.audio_output_tokens;
        updates.estimated_cost_usd = costData.estimated_cost_usd;
      }
    }
    if (typeof message_count === 'number') updates.message_count = message_count;
    if (transcript_preview) updates.transcript_preview = transcript_preview.slice(0, 500);
    
    // If tokens are provided directly from the client
    if (typeof audio_input_tokens === 'number') updates.audio_input_tokens = audio_input_tokens;
    if (typeof audio_output_tokens === 'number') {
      updates.audio_output_tokens = audio_output_tokens;
      // Recalculate cost with actual tokens
      const inputCost = ((updates.audio_input_tokens || 0) / 1_000_000) * VOICE_COST_PER_1M_INPUT_TOKENS;
      const outputCost = (audio_output_tokens / 1_000_000) * VOICE_COST_PER_1M_OUTPUT_TOKENS;
      updates.estimated_cost_usd = parseFloat((inputCost + outputCost).toFixed(4));
    }

    await db.collection('voice_sessions').updateOne(
      { id: sessionId },
      { $set: updates }
    );

    console.log(`[Voice] Session ${sessionId} updated:`, { status, duration_seconds, message_count, cost: updates.estimated_cost_usd });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Voice] Update session error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


async function handleGetUserVoiceStats(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    
    // Get user's voice sessions
    const sessions = await db.collection('voice_sessions')
      .find({ user_id: user.id })
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    // Calculate user-specific stats
    const stats = await db.collection('voice_sessions').aggregate([
      { $match: { user_id: user.id } },
      {
        $group: {
          _id: null,
          total_sessions: { $sum: 1 },
          total_duration: { $sum: { $ifNull: ['$duration_seconds', 0] } },
          avg_duration: { $avg: { $ifNull: ['$duration_seconds', 0] } },
          total_messages: { $sum: { $ifNull: ['$message_count', 0] } },
          completed_count: { 
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
          },
          first_session: { $min: '$created_at' },
          last_session: { $max: '$created_at' },
          total_audio_input_tokens: { $sum: { $ifNull: ['$audio_input_tokens', 0] } },
          total_audio_output_tokens: { $sum: { $ifNull: ['$audio_output_tokens', 0] } },
          total_cost: { $sum: { $ifNull: ['$estimated_cost_usd', 0] } },
        }
      }
    ]).toArray();

    // Get text chat token stats for the user
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

    // Get media generation stats
    const mediaStats = await db.collection('media_generations').aggregate([
      { $match: { user_id: user.id } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          total_cost: { $sum: { $ifNull: ['$cost_usd', 0] } },
        }
      }
    ]).toArray();

    // Voice distribution - which voices user has used
    const voiceDistribution = await db.collection('voice_sessions').aggregate([
      { $match: { user_id: user.id } },
      { $group: { _id: '$voice', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    // Sessions over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sessionsOverTime = await db.collection('voice_sessions').aggregate([
      { 
        $match: { 
          user_id: user.id,
          created_at: { $gte: thirtyDaysAgo }
        } 
      },
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
      total_sessions: 0,
      total_duration: 0,
      avg_duration: 0,
      total_messages: 0,
      completed_count: 0,
      first_session: null,
      last_session: null,
      total_audio_input_tokens: 0,
      total_audio_output_tokens: 0,
      total_cost: 0,
    };

    const textStatsData = textStats[0] || {
      total_messages: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
    };

    // Calculate text chat costs (using GPT-4o pricing as estimate: $2.50/1M input, $10/1M output)
    const textInputCost = (textStatsData.total_input_tokens / 1_000_000) * 2.50;
    const textOutputCost = (textStatsData.total_output_tokens / 1_000_000) * 10.00;
    const totalTextCost = textInputCost + textOutputCost;

    // Calculate media costs
    const mediaCostByType = {};
    let totalMediaCost = 0;
    mediaStats.forEach(m => {
      mediaCostByType[m._id || 'unknown'] = {
        count: m.count,
        cost: parseFloat(m.total_cost.toFixed(4)),
      };
      totalMediaCost += m.total_cost;
    });

    // Format duration nicely
    const formatDuration = (seconds) => {
      if (!seconds || seconds === 0) return '0m';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    };

    return NextResponse.json({
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
        media: {
          by_type: mediaCostByType,
          total_cost_usd: parseFloat(totalMediaCost.toFixed(4)),
        },
        grand_total_usd: parseFloat((aggregateStats.total_cost + totalTextCost + totalMediaCost).toFixed(4)),
      },
      voice_distribution: voiceDistribution.map(v => ({
        voice: v._id || 'unknown',
        count: v.count,
      })),
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
  } catch (err) {
    console.error('[Voice] Get user stats error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


async function handleWebSearch(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query, limit = 3 } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    const tavilyKey = process.env.TAVILY_API_KEY;
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;

    // Try Tavily first (preferred)
    if (tavilyKey) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
          
          return NextResponse.json({
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

    // Fallback to Brave Search
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
          
          return NextResponse.json({
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

    return NextResponse.json({ 
      error: 'No search provider configured',
      results: [],
    }, { status: 503 });
  } catch (err) {
    console.error('[WebSearch] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


async function handleVoiceToolExecute(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tool_name, tool_args } = body;

    if (!tool_name) {
      return NextResponse.json({ error: 'Tool name required' }, { status: 400 });
    }

    console.log(`[VoiceTool] Executing ${tool_name} with args:`, tool_args);
    const db = await getDb();

    // Handle different tools
    switch (tool_name) {
      case 'web_search': {
        // Use Brave Search as primary (better for real-time sports/weather)
        const braveKey = process.env.BRAVE_SEARCH_API_KEY;
        const tavilyKey = process.env.TAVILY_API_KEY;
        
        // Get user's location for weather/local queries
        let userLocation = null;
        try {
          userLocation = await db.collection('user_locations').findOne({ user_id: user.id });
        } catch (locErr) {
          console.log('[VoiceTool] Could not fetch user location');
        }
        
        // Enhance weather queries with location
        let searchQuery = tool_args.query;
        const isWeatherQuery = /weather|temperature|forecast|rain|snow|sunny|cloudy/i.test(searchQuery);
        const hasLocation = /in\s+\w+|at\s+\w+|\w+\s+weather/i.test(searchQuery);
        
        if (isWeatherQuery && !hasLocation && userLocation?.city) {
          const locationStr = userLocation.city + (userLocation.region ? ', ' + userLocation.region : '');
          searchQuery = `${searchQuery} in ${locationStr}`;
          console.log(`[VoiceTool] Enhanced weather query with location: ${searchQuery}`);
        }
        
        // Try Brave Search first
        if (braveKey) {
          try {
            console.log(`[VoiceTool] Brave search for: ${searchQuery}`);
            
            const response = await fetch(
              `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=8&freshness=pd`, 
              {
                headers: {
                  'X-Subscription-Token': braveKey,
                  'Accept': 'application/json',
                },
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              console.log(`[VoiceTool] Brave returned ${data.web?.results?.length || 0} results`);
              
              // Format results as clear text for the AI to read
              const formattedResults = data.web?.results?.slice(0, 6).map((r, i) => {
                // Clean up HTML tags from content
                const cleanContent = r.description?.replace(/<[^>]*>/g, '') || '';
                return `[Result ${i+1}] ${r.title}\n${cleanContent}`;
              }).join('\n\n') || 'No results found';
              
              // Also check for instant answers (infobox)
              let instantAnswer = null;
              if (data.infobox?.results?.[0]) {
                instantAnswer = data.infobox.results[0].description;
              }
              if (data.mixed?.main?.[0]?.all?.[0]?.description) {
                instantAnswer = data.mixed.main[0].all[0].description;
              }
              
              // Create a clear text summary for the AI
              let summary = `WEB SEARCH RESULTS FOR: "${searchQuery}"\n\n`;
              if (instantAnswer) {
                summary += `INSTANT ANSWER: ${instantAnswer}\n\n`;
              }
              summary += `SEARCH RESULTS:\n${formattedResults}\n\n`;
              summary += `INSTRUCTIONS: Read the results above carefully. Report ONLY information that is explicitly stated. For sports scores, quote the exact numbers shown. If you don't see the specific answer, say "I found some information but not the exact [detail] you asked for."`;
              
              return NextResponse.json({
                success: true,
                result: summary,
              });
            } else {
              // Log the full error response for debugging
              const errorText = await response.text().catch(() => 'unable to read');
              console.error(`[VoiceTool] Brave search failed: ${response.status} - ${errorText.slice(0, 200)}`);
            }
          } catch (braveErr) {
            console.error('[VoiceTool] Brave search error:', braveErr.message);
          }
        }
        
        // Fallback to Tavily
        if (tavilyKey) {
          try {
            const response = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: tavilyKey,
                query: tool_args.query,
                max_results: 5,
                search_depth: 'advanced',
                include_answer: true,
              }),
            });
            if (response.ok) {
              const data = await response.json();
              console.log(`[VoiceTool] Tavily fallback: ${data.results?.length || 0} results`);
              
              // Format as clear text
              const formattedResults = data.results?.slice(0, 5).map((r, i) => 
                `[Result ${i+1}] ${r.title}\n${r.content}`
              ).join('\n\n') || 'No results found';
              
              let summary = `WEB SEARCH RESULTS FOR: "${tool_args.query}"\n\n`;
              if (data.answer) {
                summary += `DIRECT ANSWER: ${data.answer}\n\n`;
              }
              summary += `SEARCH RESULTS:\n${formattedResults}\n\n`;
              summary += `INSTRUCTIONS: Report ONLY information explicitly stated above.`;
              
              return NextResponse.json({
                success: true,
                result: summary,
              });
            }
          } catch (tavilyErr) {
            console.error('[VoiceTool] Tavily fallback error:', tavilyErr);
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          result: { 
            error: 'Web search is temporarily unavailable',
            results: [],
          } 
        });
      }

      case 'get_emails':
      case 'check_email': {
        // Get user's emails with token refresh
        console.log('[VoiceTool] get_emails called for user:', user.id);
        const googleConnections = await getAllGoogleConnections(user.id);
        console.log('[VoiceTool] Got', googleConnections.length, 'Google connections');
        
        if (!googleConnections.length) {
          return NextResponse.json({ success: true, result: { error: 'No Google accounts connected. Please connect your Google account in Settings → Integrations.' } });
        }
        
        const account = tool_args.account_email 
          ? googleConnections.find(a => a.email === tool_args.account_email)
          : googleConnections[0];
        
        console.log('[VoiceTool] Using account:', account?.email);
          
        if (!account) {
          return NextResponse.json({ success: true, result: { 
            error: 'Account not found',
            available_accounts: googleConnections.map(a => a.email)
          }});
        }

        try {
          console.log('[VoiceTool] Creating OAuth client...');
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          oauth2Client.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
          });

          console.log('[VoiceTool] Calling Gmail API...');
          const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
          const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: tool_args.limit || 5,
            q: tool_args.query || 'is:inbox',
          });
          console.log('[VoiceTool] Got', response.data.messages?.length || 0, 'emails');

          const emails = [];
          for (const msg of (response.data.messages || []).slice(0, 5)) {
            const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata' });
            const headers = detail.data.payload?.headers || [];
            emails.push({
              id: msg.id,
              subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
              from: headers.find(h => h.name === 'From')?.value || 'Unknown',
              date: headers.find(h => h.name === 'Date')?.value || '',
              snippet: detail.data.snippet?.slice(0, 200),
            });
          }
          return NextResponse.json({ success: true, result: { emails, account: account.email } });
        } catch (gmailErr) {
          console.error('[VoiceTool] Gmail error:', gmailErr.message, gmailErr.stack);
          return NextResponse.json({ success: true, result: { error: 'Failed to fetch emails: ' + gmailErr.message } });
        }
      }

      case 'get_calendar':
      case 'check_calendar': {
        // Get calendar events with token refresh
        const calGoogleConnections = await getAllGoogleConnections(user.id);
        if (!calGoogleConnections.length) {
          return NextResponse.json({ success: true, result: { error: 'No Google accounts connected. Please connect your Google account in Settings → Integrations.' } });
        }
        
        const account = tool_args.account_email 
          ? calGoogleConnections.find(a => a.email === tool_args.account_email)
          : calGoogleConnections[0];
          
        if (!account) {
          return NextResponse.json({ success: true, result: { 
            error: 'Account not found',
            available_accounts: calGoogleConnections.map(a => a.email)
          }});
        }

        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          oauth2Client.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
          });

          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
          const now = new Date();
          const timeMin = tool_args.start_date ? new Date(tool_args.start_date) : now;
          const timeMax = tool_args.end_date ? new Date(tool_args.end_date) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          const response = await calendar.events.list({
            calendarId: tool_args.calendar_id || 'primary',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            maxResults: tool_args.limit || 10,
            singleEvents: true,
            orderBy: 'startTime',
          });

          const events = (response.data.items || []).map(e => ({
            id: e.id,
            title: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            location: e.location,
            description: e.description?.slice(0, 200),
          }));
          return NextResponse.json({ success: true, result: { events, account: account.email } });
        } catch (calErr) {
          console.error('[VoiceTool] Calendar error:', calErr);
          return NextResponse.json({ success: true, result: { error: 'Failed to fetch calendar: ' + calErr.message } });
        }
      }

      case 'send_email': {
        // Send email with token refresh
        const sendGoogleConnections = await getAllGoogleConnections(user.id);
        const account = tool_args.account_email 
          ? sendGoogleConnections.find(a => a.email === tool_args.account_email)
          : sendGoogleConnections[0];
          
        if (!account) {
          return NextResponse.json({ success: true, result: { 
            error: 'No Google account connected. Please connect your Google account in Settings → Integrations.',
            available_accounts: sendGoogleConnections.map(a => a.email)
          }});
        }

        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          oauth2Client.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
          });

          const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
          
          const emailContent = [
            `To: ${tool_args.to}`,
            `From: ${account.email}`,
            `Subject: ${tool_args.subject}`,
            '',
            tool_args.body,
          ].join('\n');

          const encodedEmail = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
          
          await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedEmail },
          });

          return NextResponse.json({ success: true, result: { 
            message: `Email sent successfully to ${tool_args.to}`,
            from: account.email
          }});
        } catch (sendErr) {
          console.error('[VoiceTool] Send email error:', sendErr);
          return NextResponse.json({ success: true, result: { error: 'Failed to send email: ' + sendErr.message } });
        }
      }

      case 'create_calendar_event': {
        const createCalGoogleConnections = await getAllGoogleConnections(user.id);
        const account = tool_args.account_email 
          ? createCalGoogleConnections.find(a => a.email === tool_args.account_email)
          : createCalGoogleConnections[0];
          
        if (!account) {
          return NextResponse.json({ success: true, result: { 
            error: 'No Google account connected. Please connect your Google account in Settings → Integrations.',
            available_accounts: createCalGoogleConnections.map(a => a.email)
          }});
        }

        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          oauth2Client.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
          });

          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
          
          const event = {
            summary: tool_args.summary || tool_args.title,
            description: tool_args.description,
            location: tool_args.location,
            start: { dateTime: tool_args.start, timeZone: user.timezone || 'America/New_York' },
            end: { dateTime: tool_args.end, timeZone: user.timezone || 'America/New_York' },
          };

          if (tool_args.attendees && Array.isArray(tool_args.attendees)) {
            event.attendees = tool_args.attendees.map(email => ({ email }));
          }

          const response = await calendar.events.insert({
            calendarId: tool_args.calendar_id || 'primary',
            requestBody: event,
          });

          return NextResponse.json({ success: true, result: { 
            message: `Event "${tool_args.summary}" created successfully`,
            event_id: response.data.id,
            link: response.data.htmlLink,
          }});
        } catch (calErr) {
          console.error('[VoiceTool] Create event error:', calErr);
          return NextResponse.json({ success: true, result: { error: 'Failed to create event: ' + calErr.message } });
        }
      }

      case 'get_google_accounts': {
        // List connected Google accounts with refreshed tokens
        const listGoogleConnections = await getAllGoogleConnections(user.id);
        return NextResponse.json({ success: true, result: { 
          accounts: listGoogleConnections.map(a => ({
            email: a.email,
            calendars: a.calendars || [{ id: 'primary', name: 'Primary' }],
          })),
          message: listGoogleConnections.length === 0 ? 'No Google accounts connected. Connect one in Settings → Integrations.' : `Found ${listGoogleConnections.length} connected account(s)`
        }});
      }

      case 'get_user_memories':
      case 'recall_memory': {
        // Get the user's stored memories
        try {
          const memories = await db.collection('user_memories')
            .find({ user_id: user.id })
            .sort({ created_at: -1 })
            .limit(20)
            .toArray();
          
          if (memories.length === 0) {
            return NextResponse.json({ success: true, result: { 
              message: 'No stored memories found yet. I learn about you through our conversations!',
              memories: []
            }});
          }
          
          // Group by category for better presentation
          const grouped = {};
          for (const mem of memories) {
            const cat = mem.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({
              content: mem.content,
              importance: mem.importance,
              created: mem.created_at,
            });
          }
          
          return NextResponse.json({ success: true, result: { 
            total: memories.length,
            memories: grouped,
            message: `Found ${memories.length} stored memories about you`
          }});
        } catch (memErr) {
          console.error('[VoiceTool] Memory fetch error:', memErr);
          return NextResponse.json({ success: true, result: { error: 'Could not retrieve memories' } });
        }
      }

      case 'get_soulprint':
      case 'who_am_i': {
        // Get the user's soulprint/profile information
        try {
          const profile = await db.collection('profiles').findOne({ user_id: user.id });
          const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
          const commProfile = await db.collection('communication_profiles').findOne({ user_id: user.id });
          const memories = await db.collection('user_memories')
            .find({ user_id: user.id, importance: 'high' })
            .limit(10)
            .toArray();
          
          const soulData = {
            display_name: profile?.display_name,
            descriptors: profile?.descriptors || [],
            field: profile?.field,
            assistant_name: profile?.assistant_name,
            help_with: profile?.help_with || [],
          };
          
          // Add soul profile insights
          if (soulProfile?.insights) {
            soulData.interests = soulProfile.insights.interests || [];
            soulData.communication_style = soulProfile.insights.communicationStyle;
            soulData.personality_insights = soulProfile.insights.insights || [];
            soulData.summary = soulProfile.insights.latestSummary;
          }
          
          // Add communication preferences
          if (commProfile) {
            soulData.communication_preferences = {
              directness: commProfile.directness,
              information_density: commProfile.information_density,
              formality_preference: commProfile.formality_preference,
              emotional_expression: commProfile.emotional_expression,
            };
          }
          
          // Add important memories
          if (memories.length > 0) {
            soulData.important_memories = memories.map(m => ({
              content: m.content,
              category: m.category,
            }));
          }
          
          return NextResponse.json({ success: true, result: soulData });
        } catch (profileErr) {
          console.error('[VoiceTool] Profile fetch error:', profileErr);
          return NextResponse.json({ success: true, result: { error: 'Could not retrieve profile' } });
        }
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown tool: ${tool_name}` });
    }
  } catch (err) {
    console.error('[VoiceTool] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}


async function handleGetVoiceSystemPrompt(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const db = await getDb();
    
    // Build the full system prompt (same as text chat)
    const basePrompt = await buildSystemPrompt(db, user.id);
    
    // Add voice-specific instructions
    const voiceInstructions = `

## Voice Conversation Mode

You are now in a VOICE conversation. This is different from text chat:

1. **Be Conversational**: Speak naturally as if you're on a phone call. Use contractions, natural pauses.
2. **Be Concise**: Don't give long lists. Summarize key points verbally.
3. **Confirm Actions**: Before creating events, sending emails, always confirm details verbally.
4. **Reference Memory**: You know this user. Reference their memories, preferences, and history naturally.
5. **Personal Touch**: Use their name occasionally, reference past conversations and preferences.

When the user asks "what do you know about me?" or similar:
- Reference their stored memories, profile, soulprint data
- Mention their interests, communication style, important facts
- Be personal and show that you truly know them

You have full access to their memories, profile, and connected accounts - just like in text chat.`;

    return NextResponse.json({
      success: true,
      systemPrompt: basePrompt + voiceInstructions,
    });
  } catch (err) {
    console.error('[VoiceSystemPrompt] Error:', err);
    return err('Failed to get system prompt', 500);
  }
}



// ============================================================
// ROUTER
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');
  
  try {
    if (pathStr === 'system-prompt') return handleGetVoiceSystemPrompt(request);
    if (pathStr === 'settings') return handleGetVoiceSettings(request);
    if (pathStr === 'stats') return handleGetUserVoiceStats(request);
    
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
    if (pathStr === 'tts/preview') return handleTTSPreview(request);
    if (pathStr === 'tts/read-aloud') return handleTTSReadAloud(request);
    if (pathStr === 'sessions') return handleCreateVoiceSession(request);
    if (pathStr === 'search') return handleWebSearch(request);
    if (pathStr === 'tool') return handleVoiceToolExecute(request);
    
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
    if (pathStr === 'settings') return handleUpdateVoiceSettings(request);
    // Support PUT for session updates (same as PATCH)
    if (pathStr.startsWith('sessions/') && pathArr.length === 2) {
      return handleUpdateVoiceSession(request, pathArr[1]);
    }
    
    return err('Voice endpoint not found', 404);
  } catch (error) {
    console.error('[Voice API] PUT Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function PATCH(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');
  
  try {
    if (pathStr.startsWith('sessions/') && pathArr.length === 2) {
      return handleUpdateVoiceSession(request, pathArr[1]);
    }
    
    return err('Voice endpoint not found', 404);
  } catch (error) {
    console.error('[Voice API] PATCH Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
