// Gemini Voice Chat Component - Real-time bidirectional audio
// Uses gemini-2.5-flash-native-audio-latest via WebSocket
// Supports: Audio I/O, text input, tool calling, voice previews

'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, VolumeX, Volume2, Loader2, AudioWaveform, X, Globe, Search, Sparkles, Play, Square } from 'lucide-react';

const GEMINI_MODEL = 'gemini-2.5-flash-native-audio-latest';
const WS_BASE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const TARGET_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

// Gemini native voices
const GEMINI_VOICES = [
  { id: 'Puck', name: 'Puck', desc: 'Playful & bright' },
  { id: 'Charon', name: 'Charon', desc: 'Deep & resonant' },
  { id: 'Kore', name: 'Kore', desc: 'Clear & warm' },
  { id: 'Fenrir', name: 'Fenrir', desc: 'Bold & strong' },
  { id: 'Aoede', name: 'Aoede', desc: 'Melodic & smooth' },
  { id: 'Leda', name: 'Leda', desc: 'Gentle & calm' },
  { id: 'Orus', name: 'Orus', desc: 'Rich & steady' },
  { id: 'Zephyr', name: 'Zephyr', desc: 'Light & airy' },
];

// PCM audio utilities
function float32ToInt16(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
}

function int16ToFloat32(int16Array) {
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
  }
  return float32Array;
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Downsample audio from source rate to target rate
function downsample(inputData, inputRate, outputRate) {
  if (inputRate === outputRate) return inputData;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(inputData.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = Math.floor(i * ratio);
    output[i] = inputData[srcIdx];
  }
  return output;
}

export default function GeminiVoiceChat({ token, onClose, onSaveTranscript, systemPrompt, userName, defaultVoice }) {
  const [status, setStatus] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState(defaultVoice || 'Puck');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [previewLoadingVoice, setPreviewLoadingVoice] = useState(null);

  // Refs
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const localStreamRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const playbackContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const wakeLockRef = useRef(null);
  const setupCompleteRef = useRef(false);
  const processorNodeRef = useRef(null);
  const isMutedRef = useRef(false);
  const previewSourceRef = useRef(null);
  const previewContextRef = useRef(null);
  const gainNodeRef = useRef(null);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Wake Lock
  const requestWakeLock = async () => {
    try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {}
  };
  const releaseWakeLock = async () => {
    try { if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null; } } catch {}
  };

  useEffect(() => {
    const h = async () => { if (document.visibilityState === 'visible' && status === 'connected') await requestWakeLock(); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [status]);

  // Load voice settings
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/user/voice-settings', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const s = data.voice_settings || data;
          if (s.default_gemini_voice) setSelectedVoice(s.default_gemini_voice);
          if (s.web_search_enabled !== undefined) setWebSearchEnabled(s.web_search_enabled);
        }
      } catch {}
    };
    if (token) load();
  }, [token]);

  // ── Voice Preview ──
  const playVoicePreview = useCallback(async (voiceId) => {
    // Stop any current preview
    if (previewSourceRef.current) {
      try { previewSourceRef.current.stop(); } catch {}
      previewSourceRef.current = null;
    }
    
    if (previewingVoice === voiceId) {
      setPreviewingVoice(null);
      return;
    }

    setPreviewLoadingVoice(voiceId);
    try {
      const res = await fetch('/api/gemini/voice-sample', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voiceId }),
      });
      
      if (!res.ok) throw new Error('Failed to generate preview');
      const data = await res.json();
      
      if (!data.audio) throw new Error('No audio data');

      // Play the PCM audio
      if (!previewContextRef.current || previewContextRef.current.state === 'closed') {
        previewContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      }
      const ctx = previewContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      
      const rawBuffer = base64ToArrayBuffer(data.audio);
      const int16Data = new Int16Array(rawBuffer);
      const float32Data = int16ToFloat32(int16Data);
      
      const audioBuffer = ctx.createBuffer(1, float32Data.length, OUTPUT_SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32Data);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        setPreviewingVoice(null);
        previewSourceRef.current = null;
      };
      
      previewSourceRef.current = source;
      source.start();
      setPreviewingVoice(voiceId);
      setSelectedVoice(voiceId);
    } catch (err) {
      console.error('[Gemini] Preview error:', err);
    } finally {
      setPreviewLoadingVoice(null);
    }
  }, [token, previewingVoice]);

  // ── Audio Playback Queue ──
  const playNextChunk = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift();
    
    try {
      if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
        playbackContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      }
      const ctx = playbackContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const rawBuffer = base64ToArrayBuffer(audioData);
      const int16Data = new Int16Array(rawBuffer);
      const float32Data = int16ToFloat32(int16Data);
      
      const audioBuffer = ctx.createBuffer(1, float32Data.length, OUTPUT_SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32Data);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        isPlayingRef.current = false;
        if (audioQueueRef.current.length > 0) {
          playNextChunk();
        } else {
          setIsAISpeaking(false);
        }
      };
      
      source.start();
      setIsAISpeaking(true);
    } catch (err) {
      console.error('[Gemini] Playback error:', err);
      isPlayingRef.current = false;
      if (audioQueueRef.current.length > 0) playNextChunk();
    }
  }, []);

  // ── Tool Calls ──
  const handleToolCall = useCallback(async (functionCall) => {
    const { name, args, id } = functionCall;
    setIsSearching(true);
    const label = { web_search: `🔍 Searching: "${args?.query}"...`, get_user_memories: `🧠 Recalling...`, get_soulprint: `✨ Loading profile...` }[name] || `⚡ ${name}...`;
    setConversationHistory(prev => [...prev, { role: 'system', text: label, timestamp: new Date() }]);

    try {
      const response = await fetch('/api/voice/tool', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_name: name, tool_args: args || {} }),
      });
      const result = await response.json();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          toolResponse: { functionResponses: [{ id, name, response: result.success ? result.result : { error: result.error || 'Failed' } }] }
        }));
      }
    } catch (err) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ toolResponse: { functionResponses: [{ id, name, response: { error: err.message } }] } }));
      }
    } finally {
      setIsSearching(false);
    }
  }, [token]);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    releaseWakeLock();
    if (processorNodeRef.current) { processorNodeRef.current.disconnect(); processorNodeRef.current = null; }
    if (gainNodeRef.current) { gainNodeRef.current.disconnect(); gainNodeRef.current = null; }
    if (sourceNodeRef.current) { sourceNodeRef.current.disconnect(); sourceNodeRef.current = null; }
    if (audioContextRef.current?.state !== 'closed') { audioContextRef.current?.close().catch(() => {}); audioContextRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (wsRef.current) { wsRef.current.close(1000, 'User ended'); wsRef.current = null; }
    if (playbackContextRef.current?.state !== 'closed') { playbackContextRef.current?.close().catch(() => {}); playbackContextRef.current = null; }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setupCompleteRef.current = false;
  }, []);

  // ── Start Voice Chat ──
  const startVoiceChat = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      setConversationHistory([]);
      setSessionStartTime(new Date());
      setupCompleteRef.current = false;

      // 1. Get API key
      const tokenRes = await fetch('/api/gemini/live-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GEMINI_MODEL }),
      });
      if (!tokenRes.ok) throw new Error('Failed to get Gemini credentials');
      const tokenData = await tokenRes.json();
      const apiKey = tokenData.apiKey;
      if (!apiKey) throw new Error('No API key received');

      // 2. Track session
      try {
        const tr = await fetch('/api/voice/sessions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ voice: selectedVoice, mode: 'vad', web_search_enabled: webSearchEnabled, engine: 'gemini' }),
        });
        if (tr.ok) { const d = await tr.json(); setSessionId(d.session_id); }
      } catch {}

      // 3. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;

      // 4. Set up audio capture with proper resampling
      // Don't force sampleRate - let browser use native rate, we'll resample
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const actualSampleRate = audioContext.sampleRate;
      console.log('[Gemini] Mic AudioContext sample rate:', actualSampleRate);
      
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Use a gain node at 0 to prevent feedback (mic → speakers)
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      gainNodeRef.current = silentGain;

      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !setupCompleteRef.current) return;
        if (isMutedRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Resample to 16kHz if browser uses different rate
        const resampled = downsample(inputData, actualSampleRate, TARGET_SAMPLE_RATE);
        const int16Data = float32ToInt16(resampled);
        const base64Audio = arrayBufferToBase64(int16Data.buffer);

        try {
          wsRef.current.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{ mimeType: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`, data: base64Audio }]
            }
          }));
        } catch {}
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      // 5. Connect WebSocket
      const wsUrl = `${WS_BASE_URL}?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Gemini] WS connected, sending setup...');
        const basePrompt = systemPrompt || `You are a helpful AI assistant having a voice conversation with ${userName || 'the user'}.`;
        
        const tools = [];
        if (webSearchEnabled) {
          tools.push({
            functionDeclarations: [
              { name: 'web_search', description: 'Search the web for current info (weather, news, scores, prices).', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Search query' } }, required: ['query'] } },
              { name: 'get_user_memories', description: "Retrieve user's stored memories and personal info.", parameters: { type: 'OBJECT', properties: {} } },
              { name: 'get_soulprint', description: "Get the user's complete SoulPrint profile.", parameters: { type: 'OBJECT', properties: {} } },
            ],
          });
        }

        ws.send(JSON.stringify({
          setup: {
            model: `models/${GEMINI_MODEL}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } }
            },
            systemInstruction: { parts: [{ text: `${basePrompt}\n\nBe conversational, warm, and concise. This is a real-time voice call.` }] },
            ...(tools.length > 0 ? { tools } : {}),
          },
        }));
      };

      // Handle messages
      ws.onmessage = async (event) => {
        try {
          let textData;
          if (typeof event.data === 'string') {
            textData = event.data;
          } else if (event.data instanceof Blob) {
            textData = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            textData = new TextDecoder().decode(event.data);
          } else {
            return;
          }
          
          const data = JSON.parse(textData);
          
          if (data.setupComplete !== undefined) {
            console.log('[Gemini] Setup complete!');
            setupCompleteRef.current = true;
            return;
          }

          if (data.serverContent) {
            const { modelTurn, turnComplete } = data.serverContent;
            
            if (modelTurn?.parts) {
              for (const part of modelTurn.parts) {
                if (part.inlineData?.mimeType?.includes('audio')) {
                  audioQueueRef.current.push(part.inlineData.data);
                  if (!isPlayingRef.current) playNextChunk();
                }
                if (part.text) {
                  setAiResponse(prev => prev + part.text);
                }
              }
            }

            if (data.serverContent.inputTranscription) {
              setTranscript(data.serverContent.inputTranscription);
            }
            
            if (turnComplete) {
              setAiResponse(cur => {
                if (cur) setConversationHistory(prev => [...prev, { role: 'assistant', text: cur, timestamp: new Date() }]);
                return '';
              });
              setTranscript('');
            }
          }

          if (data.toolCall?.functionCalls) {
            for (const fc of data.toolCall.functionCalls) {
              await handleToolCall(fc);
            }
          }
        } catch (err) {
          console.error('[Gemini] Message error:', err);
        }
      };

      ws.onerror = () => { setError('Connection error'); setStatus('error'); };
      ws.onclose = (ev) => {
        if (ev.code !== 1000 && setupCompleteRef.current) {
          setError(`Disconnected: ${ev.reason || `Code ${ev.code}`}`);
          setStatus('error');
        }
      };

      // Wait for setup
      await new Promise((resolve, reject) => {
        const start = Date.now();
        const check = setInterval(() => {
          if (setupCompleteRef.current) { clearInterval(check); resolve(); }
          if (ws.readyState >= WebSocket.CLOSING) { clearInterval(check); reject(new Error('Connection closed')); }
          if (Date.now() - start > 15000) { clearInterval(check); reject(new Error('Setup timeout')); }
        }, 100);
      });

      setStatus('connected');
      await requestWakeLock();

      // Send initial greeting request so the AI speaks first
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: 'Hello!' }] }],
          turnComplete: true
        }
      }));

    } catch (err) {
      console.error('[Gemini] Start error:', err);
      setError(err.message);
      setStatus('error');
      cleanup();
    }
  }, [token, systemPrompt, userName, selectedVoice, webSearchEnabled, playNextChunk, handleToolCall, cleanup]);

  // ── End Voice Chat ──
  const endVoiceChat = useCallback(async () => {
    const duration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
    cleanup();

    if (sessionId) {
      try {
        await fetch(`/api/voice/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed', duration_seconds: duration, message_count: conversationHistory.length }),
        });
      } catch {}
    }

    if (conversationHistory.length > 0 && onSaveTranscript) onSaveTranscript(conversationHistory);
    setStatus('idle');
    setTranscript('');
    setAiResponse('');
    setConversationHistory([]);
    setSessionId(null);
    setSessionStartTime(null);
    if (onClose) onClose();
  }, [cleanup, onClose, onSaveTranscript, conversationHistory, sessionId, sessionStartTime, token]);

  const toggleMute = useCallback(() => setIsMuted(p => !p), []);
  const interruptAI = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsAISpeaking(false);
  }, []);

  useEffect(() => { return () => { cleanup(); if (previewSourceRef.current) try { previewSourceRef.current.stop(); } catch {} }; }, [cleanup]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 pb-safe">
        <div className={`absolute inset-0 rounded-3xl transition-all duration-500 ${
          status === 'connected' 
            ? isAISpeaking ? 'bg-gradient-to-br from-blue-500/30 to-purple-600/20 animate-pulse' 
              : isSearching ? 'bg-gradient-to-br from-cyan-500/30 to-blue-600/20 animate-pulse'
              : 'bg-gradient-to-br from-blue-500/20 to-indigo-600/10'
            : 'bg-gradient-to-br from-gray-800/50 to-gray-900/50'
        }`} />
        
        <div className="relative bg-gray-900/90 rounded-3xl p-6 sm:p-8 border border-white/10 max-h-[85vh] overflow-y-auto mb-4">
          {/* Close */}
          <button onClick={status === 'connected' ? endVoiceChat : onClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/10 z-10">
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Gemini Voice</h2>
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xs text-blue-400/70 mb-1">Powered by Gemini Flash Live</p>
            <p className="text-sm text-gray-400">
              {status === 'idle' && 'Tap a voice to preview, then start'}
              {status === 'connecting' && 'Connecting to Gemini...'}
              {status === 'connected' && (isSearching ? '🔍 Searching...' : isAISpeaking ? 'AI is speaking...' : 'Listening...')}
              {status === 'error' && 'Connection error'}
            </p>
          </div>

          {/* Voice selector with preview */}
          {status === 'idle' && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">Gemini Voice</label>
                <p className="text-[10px] text-gray-600">🔊 Tap speaker to preview</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {GEMINI_VOICES.map(voice => (
                  <div
                    key={voice.id}
                    className={`relative flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      selectedVoice === voice.id ? 'bg-blue-500/20 border-blue-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedVoice(voice.id)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      selectedVoice === voice.id ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-gray-400'
                    }`}>
                      {voice.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${selectedVoice === voice.id ? 'text-blue-400' : 'text-white'}`}>
                        {voice.name}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">{voice.desc}</p>
                    </div>
                    {/* Preview button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); playVoicePreview(voice.id); }}
                      className={`flex-shrink-0 p-1.5 rounded-full transition-all ${
                        previewingVoice === voice.id ? 'bg-blue-500/30 text-blue-300' :
                        previewLoadingVoice === voice.id ? 'bg-white/10 text-gray-400' :
                        'bg-white/5 text-gray-500 hover:bg-white/15 hover:text-white'
                      }`}
                      title={`Preview ${voice.name}`}
                    >
                      {previewLoadingVoice === voice.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : previewingVoice === voice.id ? (
                        <Square className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-2">💡 Set default in <span className="text-blue-400/70">Settings → Voice</span></p>
            </div>
          )}

          {/* Web search toggle */}
          {status === 'idle' && (
            <div className="mb-5">
              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <div className={`p-2 rounded-lg ${webSearchEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-500'}`}>
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">Real-time Web Search</p>
                  <p className="text-xs text-gray-500">News, weather, stocks, etc.</p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${webSearchEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 mt-1 rounded-full bg-white transition-transform ${webSearchEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <input type="checkbox" checked={webSearchEnabled} onChange={e => setWebSearchEnabled(e.target.checked)} className="sr-only" />
              </label>
            </div>
          )}

          {/* Start/Status visual */}
          <div className="flex justify-center mb-6">
            {status === 'idle' || status === 'error' ? (
              <button onClick={startVoiceChat}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-blue-500/30">
                <AudioWaveform className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </button>
            ) : status === 'connecting' ? (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-800 flex items-center justify-center">
                <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                {isAISpeaking && (
                  <>
                    <div className="absolute rounded-full bg-blue-500/15" style={{ width: '140px', height: '140px', animation: 'geminiPulse1 2s ease-in-out infinite' }} />
                    <div className="absolute rounded-full bg-purple-500/25" style={{ width: '115px', height: '115px', animation: 'geminiPulse2 1.5s ease-in-out infinite 0.2s' }} />
                  </>
                )}
                <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isAISpeaking ? 'bg-gradient-to-br from-blue-400 via-purple-500 to-blue-600' :
                  isSearching ? 'bg-gradient-to-br from-cyan-500 to-blue-600' :
                  'bg-gradient-to-br from-gray-700 to-gray-800'
                }`} style={{ boxShadow: isAISpeaking ? '0 0 50px rgba(99,102,241,0.5)' : undefined,
                  animation: isAISpeaking ? 'geminiBreathe 1.5s ease-in-out infinite' : undefined }}>
                  <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-white" style={{
                    animation: isAISpeaking ? 'geminiIcon 0.75s ease-in-out infinite' : undefined }} />
                </div>
              </div>
            )}
          </div>

          <style>{`
            @keyframes geminiPulse1 { 0% { transform: scale(0.8); opacity: 0.6; } 50% { transform: scale(1.15); opacity: 0; } 100% { transform: scale(1.3); opacity: 0; } }
            @keyframes geminiPulse2 { 0% { transform: scale(0.85); opacity: 0.7; } 50% { transform: scale(1.1); opacity: 0.2; } 100% { transform: scale(1.2); opacity: 0; } }
            @keyframes geminiBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes geminiIcon { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
          `}</style>

          {/* Controls */}
          {status === 'connected' && (
            <div className="flex justify-center items-center gap-3 mb-4">
              <button onClick={toggleMute}
                className={`p-3 rounded-full transition-all ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
                title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button onClick={endVoiceChat}
                className="p-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white transition-all transform hover:scale-105 shadow-lg shadow-red-500/30"
                title="End call">
                <PhoneOff className="w-5 h-5" />
              </button>
              {isAISpeaking && (
                <button onClick={interruptAI}
                  className="p-3 rounded-full bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all" title="Interrupt">
                  <VolumeX className="w-5 h-5" />
                </button>
              )}
              {webSearchEnabled && (
                <div className={`p-3 rounded-full ${isSearching ? 'bg-blue-500/20 text-blue-400 animate-pulse' : 'bg-white/5 text-gray-500'}`}>
                  <Search className="w-5 h-5" />
                </div>
              )}
            </div>
          )}

          {/* Transcript */}
          {status === 'connected' && (transcript || aiResponse) && (
            <div className="space-y-2 mb-4">
              {transcript && <div className="bg-white/5 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">You:</p><p className="text-sm text-white">{transcript}</p></div>}
              {aiResponse && <div className="bg-blue-500/10 rounded-xl p-3"><p className="text-xs text-blue-400 mb-1">AI:</p><p className="text-sm text-white">{aiResponse}</p></div>}
            </div>
          )}

          {/* History */}
          {status === 'connected' && conversationHistory.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <p className="text-xs text-gray-500 mb-2">History ({conversationHistory.length})</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {conversationHistory.slice(-4).map((item, i) => (
                  <div key={i} className={`text-xs p-2 rounded-lg ${
                    item.role === 'user' ? 'bg-white/5 text-gray-300' : item.role === 'system' ? 'bg-blue-500/10 text-blue-300' : 'bg-purple-500/10 text-purple-200'
                  }`}>
                    <span className="font-medium">{item.role === 'user' ? 'You' : item.role === 'system' ? '⚡' : 'AI'}:</span> {item.text?.slice(0, 80)}{(item.text?.length || 0) > 80 ? '...' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
              {status === 'error' && <button onClick={() => { setError(null); setStatus('idle'); }} className="mt-2 text-xs text-gray-400 hover:text-white underline">Try again</button>}
            </div>
          )}

          <p className="mt-4 text-center text-xs text-gray-500 pb-4">
            {status === 'idle' ? 'Transcript saved when you end the call' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
