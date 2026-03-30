import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

// Auth helper
async function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'soulprint-secret-key-2024');
    const db = await getDb();
    return await db.collection('users').findOne({ id: decoded.userId });
  } catch {
    return null;
  }
}

// Available Gemini voices
const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];

const VOICE_GREETINGS = {
  Puck: "Hey there! I'm Puck, your playful voice assistant!",
  Charon: "Greetings. I am Charon, here to guide your conversations.",
  Kore: "Hello! I'm Kore, warm and ready to help you out.",
  Fenrir: "Hello! I'm Fenrir, bold and ready to assist.",
  Aoede: "Hi there! I'm Aoede, with a smooth and melodic voice.",
  Leda: "Hello, I'm Leda. I'm gentle and calm, here to help.",
  Orus: "Hi, I'm Orus. Rich and steady, at your service.",
  Zephyr: "Hey! I'm Zephyr, light and airy like a breeze!",
};

// POST /api/gemini/voice-sample - Generate a voice sample for preview
export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const voiceName = body.voice || 'Puck';
    
    if (!VOICES.includes(voiceName)) {
      return NextResponse.json({ error: 'Invalid voice name' }, { status: 400 });
    }

    // Check cache first
    const db = await getDb();
    const cached = await db.collection('voice_samples').findOne({ 
      voice: voiceName,
      created_at: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24h cache
    });
    
    if (cached) {
      return NextResponse.json({ 
        audio: cached.audio_base64,
        mimeType: cached.mime_type,
        voice: voiceName,
        cached: true
      });
    }

    // Generate via Gemini TTS API
    const greeting = VOICE_GREETINGS[voiceName] || `Hello! I'm ${voiceName}.`;
    
    const ttsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: greeting }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName }
              }
            }
          }
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error('[Voice Sample] TTS error:', ttsResponse.status, errText);
      return NextResponse.json({ error: 'Failed to generate voice sample' }, { status: 500 });
    }

    const ttsData = await ttsResponse.json();
    const audioPart = ttsData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    
    if (!audioPart) {
      return NextResponse.json({ error: 'No audio in TTS response' }, { status: 500 });
    }

    const audioBase64 = audioPart.inlineData.data;
    const mimeType = audioPart.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000';

    // Cache the sample
    await db.collection('voice_samples').updateOne(
      { voice: voiceName },
      { $set: { 
        voice: voiceName, 
        audio_base64: audioBase64, 
        mime_type: mimeType,
        greeting,
        created_at: new Date() 
      }},
      { upsert: true }
    );

    return NextResponse.json({
      audio: audioBase64,
      mimeType,
      voice: voiceName,
      cached: false
    });
  } catch (err) {
    console.error('[Voice Sample] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
