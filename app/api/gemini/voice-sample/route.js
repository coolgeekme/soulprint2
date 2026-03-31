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

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];

const VOICE_GREETINGS = {
  Puck: "Hey there! I'm Puck, your playful and bright voice assistant!",
  Charon: "Greetings. I am Charon, deep and resonant, here to guide you.",
  Kore: "Hello! I'm Kore, clear and warm, ready to help you out.",
  Fenrir: "Hello! I'm Fenrir, bold and strong, at your service.",
  Aoede: "Hi there! I'm Aoede, melodic and smooth, nice to meet you.",
  Leda: "Hello, I'm Leda. Gentle and calm, always here for you.",
  Orus: "Hi, I'm Orus. Rich and steady, ready to assist.",
  Zephyr: "Hey! I'm Zephyr, light and airy like a breeze!",
};

// Generate voice sample using @google/genai SDK with same model as chat
async function generateVoiceSampleSDK(apiKey, voiceName, greeting) {
  const { GoogleGenAI, Modality } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  return new Promise((resolve, reject) => {
    const audioChunks = [];
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Voice sample generation timeout'));
      }
    }, 20000);

    ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-latest',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        },
        systemInstruction: {
          parts: [{ text: `Say EXACTLY the following text naturally, nothing more: "${greeting}"` }]
        }
      },
      callbacks: {
        onopen: function () {
          console.log(`[Voice Sample SDK] Connected for ${voiceName}`);
        },
        onmessage: function (msg) {
          // Collect audio data
          if (msg.data) {
            // SDK returns audio as base64 data
            audioChunks.push(msg.data);
          }
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                audioChunks.push(part.inlineData.data);
              }
            }
          }
          if (msg.serverContent?.turnComplete) {
            clearTimeout(timeout);
            if (!resolved) {
              resolved = true;
              // Combine audio chunks
              const buffers = audioChunks.map(chunk => Buffer.from(chunk, 'base64'));
              const combined = Buffer.concat(buffers);
              resolve({
                audio: combined.toString('base64'),
                mimeType: 'audio/L16;codec=pcm;rate=24000',
              });
            }
          }
        },
        onerror: function (e) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            reject(new Error(e?.message || 'SDK error'));
          }
        },
        onclose: function (e) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            if (audioChunks.length > 0) {
              const buffers = audioChunks.map(chunk => Buffer.from(chunk, 'base64'));
              const combined = Buffer.concat(buffers);
              resolve({ audio: combined.toString('base64'), mimeType: 'audio/L16;codec=pcm;rate=24000' });
            } else {
              reject(new Error(`Closed before audio received: ${e?.code} ${e?.reason}`));
            }
          }
        },
      },
    }).then((session) => {
      // Send text for the model to speak
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: 'Please introduce yourself.' }] }],
        turnComplete: true,
      });
    }).catch((err) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
  });
}

// Fallback: Use TTS REST API
async function generateVoiceSampleTTS(apiKey, voiceName, greeting) {
  const ttsResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: greeting }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
        }
      }),
    }
  );

  if (!ttsResponse.ok) throw new Error('TTS API failed');
  const ttsData = await ttsResponse.json();
  const audioPart = ttsData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!audioPart) throw new Error('No audio in TTS response');
  return { audio: audioPart.inlineData.data, mimeType: audioPart.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000' };
}

// POST /api/gemini/voice-sample
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

    // Check cache (24h)
    const db = await getDb();
    const cached = await db.collection('voice_samples').findOne({ 
      voice: voiceName,
      model: 'native-audio-v2',
      created_at: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    if (cached) {
      return NextResponse.json({ 
        audio: cached.audio_base64, mimeType: cached.mime_type, voice: voiceName, cached: true
      });
    }

    const greeting = VOICE_GREETINGS[voiceName];
    console.log(`[Voice Sample] Generating for ${voiceName}...`);

    let result;
    try {
      // Try SDK (same model as chat) first
      result = await generateVoiceSampleSDK(apiKey, voiceName, greeting);
      console.log(`[Voice Sample] SDK success for ${voiceName}: ${result.audio.length} bytes`);
    } catch (sdkErr) {
      console.warn(`[Voice Sample] SDK failed for ${voiceName}: ${sdkErr.message}, falling back to TTS`);
      // Fallback to TTS REST API  
      result = await generateVoiceSampleTTS(apiKey, voiceName, greeting);
      console.log(`[Voice Sample] TTS fallback success for ${voiceName}`);
    }

    // Cache
    await db.collection('voice_samples').updateOne(
      { voice: voiceName, model: 'native-audio-v2' },
      { $set: { voice: voiceName, model: 'native-audio-v2', audio_base64: result.audio, mime_type: result.mimeType, greeting, created_at: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ audio: result.audio, mimeType: result.mimeType, voice: voiceName, cached: false });
  } catch (err) {
    console.error('[Voice Sample] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
