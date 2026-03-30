// Gemini 3.1 Flash Live Voice Chat Component
// Uses WebSocket for bidirectional audio streaming with Gemini Live API
// Architecture: API key → WebSocket → Gemini BidiGenerateContent → Audio I/O
// Features: Voice selection (Gemini native), web search, session tracking

'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, VolumeX, Loader2, AudioWaveform, X, Globe, Search, Sparkles } from 'lucide-react';

const GEMINI_MODEL = 'gemini-3.1-flash-live-preview';
const WS_BASE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

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

export default function GeminiVoiceChat({ token, onClose, onSaveTranscript, systemPrompt, userName, defaultVoice }) {
  const [status, setStatus] = useState('idle'); // idle, connecting, connected, error
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
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Refs for mutable state (avoids stale closures)
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
  const tokenRef = useRef(token);

  // Keep refs in sync with state
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Screen Wake Lock
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.log('[Gemini] Wake Lock not supported:', err.message);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); wakeLockRef.current = null; } catch (err) {}
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && status === 'connected') {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status]);

  // Load voice settings on mount
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const res = await fetch('/api/user/voice-settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const settings = data.voice_settings || data;
          if (settings.default_gemini_voice) setSelectedVoice(settings.default_gemini_voice);
          if (settings.web_search_enabled !== undefined) setWebSearchEnabled(settings.web_search_enabled);
        }
      } catch (err) {
        console.error('Failed to load voice settings:', err);
      }
      setSettingsLoaded(true);
    };
    if (token) loadVoiceSettings();
  }, [token]);

  // Play queued audio chunks
  const playNextChunk = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift();
    
    try {
      if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = playbackContextRef.current;
      
      const rawBuffer = base64ToArrayBuffer(audioData);
      const int16Data = new Int16Array(rawBuffer);
      const float32Data = int16ToFloat32(int16Data);
      
      const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
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

  // Handle tool calls from Gemini
  const handleToolCall = useCallback(async (functionCall) => {
    const { name, args, id } = functionCall;
    setIsSearching(true);
    
    const actionLabel = {
      'web_search': `🔍 Searching: "${args?.query}"...`,
      'get_user_memories': `🧠 Recalling your memories...`,
      'get_soulprint': `✨ Loading your profile...`,
    }[name] || `⚡ Running ${name}...`;

    setConversationHistory(prev => [...prev, { role: 'system', text: actionLabel, timestamp: new Date() }]);

    try {
      const response = await fetch('/api/voice/tool', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tool_name: name, tool_args: args || {} }),
      });
      
      const result = await response.json();
      console.log(`[Gemini] Tool result for ${name}:`, result);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          toolResponse: {
            functionResponses: [{
              id: id,
              name: name,
              response: result.success ? result.result : { error: result.error || 'Tool failed' },
            }],
          },
        }));
      }
    } catch (err) {
      console.error('[Gemini] Tool call error:', err);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          toolResponse: {
            functionResponses: [{ id, name, response: { error: err.message } }],
          },
        }));
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    releaseWakeLock();
    
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User ended session');
      wsRef.current = null;
    }
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }
    
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setupCompleteRef.current = false;
  }, []);

  // Start voice chat
  const startVoiceChat = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      setConversationHistory([]);
      setSessionStartTime(new Date());
      setupCompleteRef.current = false;

      // 1. Get API key from backend
      const tokenRes = await fetch('/api/gemini/live-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: GEMINI_MODEL }),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get Gemini credentials');
      }
      const tokenData = await tokenRes.json();
      
      const apiKey = tokenData.apiKey || tokenData.token;
      if (!apiKey) throw new Error('No API key received');
      console.log('[Gemini] Got API key, length:', apiKey.length);

      // 2. Track session in backend
      try {
        const trackResponse = await fetch('/api/voice/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voice: selectedVoice,
            mode: 'vad',
            web_search_enabled: webSearchEnabled,
            engine: 'gemini',
          }),
        });
        if (trackResponse.ok) {
          const trackData = await trackResponse.json();
          setSessionId(trackData.session_id);
        }
      } catch (e) {
        console.log('[Gemini] Session tracking skipped:', e.message);
      }

      // 3. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      localStreamRef.current = stream;

      // 4. Set up audio capture (mic → PCM → base64 → WebSocket)
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !setupCompleteRef.current) return;
        if (isMutedRef.current) return; // Use ref to avoid stale closure

        const inputData = e.inputBuffer.getChannelData(0);
        const int16Data = float32ToInt16(inputData);
        const base64Audio = arrayBufferToBase64(int16Data.buffer);

        try {
          wsRef.current.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: 'audio/pcm;rate=16000',
                data: base64Audio,
              }],
            },
          }));
        } catch (sendErr) {
          console.error('[Gemini] Send error:', sendErr.message);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // 5. Connect WebSocket to Gemini
      const wsUrl = `${WS_BASE_URL}?key=${apiKey}`;
      console.log('[Gemini] Connecting WebSocket...');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Gemini] WebSocket connected, sending setup...');
        
        const baseInstructions = systemPrompt || `You are a helpful AI assistant having a voice conversation. The user's name is ${userName || 'User'}.`;

        const tools = [];
        if (webSearchEnabled) {
          tools.push({
            functionDeclarations: [
              {
                name: 'web_search',
                description: 'Search the web for current, real-time information. Use for: weather, news, sports scores, stock prices.',
                parameters: {
                  type: 'OBJECT',
                  properties: { query: { type: 'STRING', description: 'The search query' } },
                  required: ['query'],
                },
              },
              {
                name: 'get_user_memories',
                description: 'Retrieve the user\'s stored memories and personal information.',
                parameters: { type: 'OBJECT', properties: {} },
              },
              {
                name: 'get_soulprint',
                description: 'Get the user\'s complete SoulPrint profile.',
                parameters: { type: 'OBJECT', properties: {} },
              },
            ],
          });
        }

        const setupMsg = {
          setup: {
            model: `models/${GEMINI_MODEL}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: selectedVoice,
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: `${baseInstructions}\n\nBe conversational, warm, and personal. Keep responses concise since this is a voice conversation.` }],
            },
            ...(tools.length > 0 ? { tools } : {}),
          },
        };

        ws.send(JSON.stringify(setupMsg));
        console.log('[Gemini] Setup message sent');
      };

      // Handle messages - use inline handler to avoid stale closure
      ws.onmessage = async (event) => {
        try {
          // Browser WebSocket can return Blob, ArrayBuffer, or string
          let textData;
          if (typeof event.data === 'string') {
            textData = event.data;
          } else if (event.data instanceof Blob) {
            textData = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            textData = new TextDecoder().decode(event.data);
          } else {
            console.error('[Gemini] Unknown message type:', typeof event.data);
            return;
          }
          
          const data = JSON.parse(textData);
          
          // Setup complete
          if (data.setupComplete !== undefined) {
            console.log('[Gemini] ✅ Setup complete received');
            setupCompleteRef.current = true;
            return;
          }

          // Server content (audio/text)
          if (data.serverContent) {
            const { modelTurn, turnComplete } = data.serverContent;
            
            if (modelTurn?.parts) {
              for (const part of modelTurn.parts) {
                if (part.inlineData?.mimeType?.includes('audio/pcm')) {
                  audioQueueRef.current.push(part.inlineData.data);
                  if (!isPlayingRef.current) {
                    playNextChunk();
                  }
                }
                if (part.text) {
                  setAiResponse(prev => prev + part.text);
                }
              }
            }

            if (data.serverContent.inputTranscription) {
              const userText = data.serverContent.inputTranscription;
              setTranscript(userText);
              if (userText.trim()) {
                setConversationHistory(prev => [...prev, { role: 'user', text: userText, timestamp: new Date() }]);
              }
            }
            
            if (turnComplete) {
              setAiResponse(currentResponse => {
                if (currentResponse) {
                  setConversationHistory(prev => [...prev, { role: 'assistant', text: currentResponse, timestamp: new Date() }]);
                }
                return '';
              });
              setTranscript('');
            }
          }

          // Tool call
          if (data.toolCall) {
            const { functionCalls } = data.toolCall;
            if (functionCalls) {
              for (const fc of functionCalls) {
                console.log('[Gemini] Tool call:', fc.name);
                await handleToolCall(fc);
              }
            }
          }

        } catch (err) {
          console.error('[Gemini] Message parse error:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[Gemini] WebSocket error:', event);
        setError('WebSocket connection error. Please try again.');
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log('[Gemini] WebSocket closed:', event.code, event.reason);
        if (event.code !== 1000 && status !== 'idle') {
          setError(`Connection closed: ${event.reason || `Code ${event.code}`}`);
          setStatus('error');
        }
      };

      // Wait for setup to complete
      await new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (setupCompleteRef.current) {
            clearInterval(checkInterval);
            resolve();
          }
          if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            clearInterval(checkInterval);
            reject(new Error('WebSocket closed before setup complete'));
          }
          if (Date.now() - startTime > 15000) {
            clearInterval(checkInterval);
            reject(new Error('Setup timeout - please check your connection and try again'));
          }
        }, 100);
      });

      setStatus('connected');
      console.log('[Gemini] Voice chat connected!');
      await requestWakeLock();

    } catch (err) {
      console.error('[Gemini] Error:', err);
      setError(err.message);
      setStatus('error');
      cleanup();
    }
  }, [token, systemPrompt, userName, selectedVoice, webSearchEnabled, playNextChunk, handleToolCall, cleanup]);

  // End voice chat
  const endVoiceChat = useCallback(async () => {
    const endTime = new Date();
    const duration = sessionStartTime ? Math.round((endTime - sessionStartTime) / 1000) : 0;
    
    cleanup();

    if (sessionId) {
      try {
        await fetch(`/api/voice/sessions/${sessionId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
            duration_seconds: duration,
            message_count: conversationHistory.length,
            transcript_preview: conversationHistory.slice(0, 3).map(h => h.text).join(' ').slice(0, 200),
          }),
        });
      } catch (err) {
        console.error('Failed to update session:', err);
      }
    }

    if (conversationHistory.length > 0 && onSaveTranscript) {
      onSaveTranscript(conversationHistory);
    }

    setStatus('idle');
    setTranscript('');
    setAiResponse('');
    setConversationHistory([]);
    setSessionId(null);
    setSessionStartTime(null);
    if (onClose) onClose();
  }, [cleanup, onClose, onSaveTranscript, conversationHistory, sessionId, sessionStartTime, token]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Interrupt AI
  const interruptAI = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsAISpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 pb-safe">
        {/* Background animation */}
        <div className={`absolute inset-0 rounded-3xl transition-all duration-500 ${
          status === 'connected' 
            ? isAISpeaking 
              ? 'bg-gradient-to-br from-blue-500/30 to-purple-600/20 animate-pulse' 
              : isSearching
                ? 'bg-gradient-to-br from-cyan-500/30 to-blue-600/20 animate-pulse'
                : 'bg-gradient-to-br from-blue-500/20 to-indigo-600/10'
            : 'bg-gradient-to-br from-gray-800/50 to-gray-900/50'
        }`} />
        
        <div className="relative bg-gray-900/90 rounded-3xl p-6 sm:p-8 border border-white/10 max-h-[85vh] overflow-y-auto mb-4">
          {/* Close button */}
          <button
            onClick={status === 'connected' ? endVoiceChat : onClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/10 z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Gemini Voice</h2>
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xs text-blue-400/70 mb-1">Powered by Gemini 3.1 Flash Live</p>
            <p className="text-sm text-gray-400">
              {status === 'idle' && 'Select a voice and click to start'}
              {status === 'connecting' && 'Connecting to Gemini...'}
              {status === 'connected' && (
                isSearching ? '🔍 Searching the web...' :
                isAISpeaking ? 'AI is speaking...' : 'Listening...'
              )}
              {status === 'error' && 'Connection error'}
            </p>
          </div>

          {/* Voice selector - only when idle */}
          {status === 'idle' && (
            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-2">Gemini Voice</label>
              <p className="text-[10px] text-gray-600 mb-2">💡 Set your default Gemini voice in <span className="text-blue-400/70">Settings → Voice</span></p>
              <div className="grid grid-cols-2 gap-2">
                {GEMINI_VOICES.map(voice => (
                  <div
                    key={voice.id}
                    className={`relative flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedVoice === voice.id 
                        ? 'bg-blue-500/20 border-blue-500/50' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedVoice(voice.id)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      selectedVoice === voice.id ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-gray-400'
                    }`}>
                      {voice.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${selectedVoice === voice.id ? 'text-blue-400' : 'text-white'}`}>
                        {voice.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{voice.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Web search toggle - only when idle */}
          {status === 'idle' && (
            <div className="mb-6">
              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <div className={`p-2 rounded-lg ${webSearchEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-500'}`}>
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">Real-time Web Search</p>
                  <p className="text-xs text-gray-500">AI can search for current news, weather, stocks, etc.</p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${webSearchEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 mt-1 rounded-full bg-white transition-transform ${webSearchEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <input
                  type="checkbox"
                  checked={webSearchEnabled}
                  onChange={(e) => setWebSearchEnabled(e.target.checked)}
                  className="sr-only"
                />
              </label>
            </div>
          )}

          {/* Main visual */}
          <div className="flex justify-center mb-6">
            {status === 'idle' || status === 'error' ? (
              <button
                onClick={startVoiceChat}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-blue-500/30"
              >
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
                    <div className="absolute rounded-full bg-blue-500/15"
                      style={{ width: '140px', height: '140px', animation: 'geminiPulseRing1 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                    <div className="absolute rounded-full bg-purple-500/25"
                      style={{ width: '115px', height: '115px', animation: 'geminiPulseRing2 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite', animationDelay: '0.2s' }} />
                    <div className="absolute rounded-full bg-blue-500/35"
                      style={{ width: '98px', height: '98px', animation: 'geminiPulseRing3 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                  </>
                )}
                
                <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
                  isAISpeaking 
                    ? 'bg-gradient-to-br from-blue-400 via-purple-500 to-blue-600' 
                    : isSearching
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_30px_rgba(59,130,246,0.5)]'
                      : 'bg-gradient-to-br from-gray-700 to-gray-800 shadow-lg'
                }`}
                  style={{
                    boxShadow: isAISpeaking ? '0 0 50px rgba(99,102,241,0.6), 0 0 80px rgba(99,102,241,0.4)' : undefined,
                    animation: isAISpeaking ? 'geminiBreathe 1.5s ease-in-out infinite' : undefined,
                  }}
                >
                  <Sparkles 
                    className="w-10 h-10 sm:w-12 sm:h-12 text-white transition-transform duration-300"
                    style={{
                      filter: isAISpeaking ? 'brightness(1.4) drop-shadow(0 0 10px rgba(255,255,255,0.6))' : 'brightness(1)',
                      animation: isAISpeaking ? 'geminiLogoPulse 0.75s ease-in-out infinite' : undefined,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <style>{`
            @keyframes geminiPulseRing1 { 0% { transform: scale(0.8); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 0.3; } 100% { transform: scale(1.3); opacity: 0; } }
            @keyframes geminiPulseRing2 { 0% { transform: scale(0.85); opacity: 0.9; } 50% { transform: scale(1.05); opacity: 0.4; } 100% { transform: scale(1.2); opacity: 0; } }
            @keyframes geminiPulseRing3 { 0%, 100% { transform: scale(0.95); opacity: 0.7; } 50% { transform: scale(1.02); opacity: 1; } }
            @keyframes geminiBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
            @keyframes geminiLogoPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
          `}</style>

          {/* Controls */}
          {status === 'connected' && (
            <div className="flex justify-center items-center gap-3 mb-4">
              <button
                onClick={toggleMute}
                className={`p-3 rounded-full transition-all ${
                  isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              <button
                onClick={endVoiceChat}
                className="p-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white transition-all transform hover:scale-105 shadow-lg shadow-red-500/30"
                title="End call"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
              
              {isAISpeaking && (
                <button
                  onClick={interruptAI}
                  className="p-3 rounded-full bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all"
                  title="Interrupt"
                >
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

          {/* Current transcript */}
          {status === 'connected' && (transcript || aiResponse) && (
            <div className="space-y-2 mb-4">
              {transcript && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">You:</p>
                  <p className="text-sm text-white">{transcript}</p>
                </div>
              )}
              {aiResponse && (
                <div className="bg-blue-500/10 rounded-xl p-3">
                  <p className="text-xs text-blue-400 mb-1">AI:</p>
                  <p className="text-sm text-white">{aiResponse}</p>
                </div>
              )}
            </div>
          )}

          {/* Conversation history */}
          {status === 'connected' && conversationHistory.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <p className="text-xs text-gray-500 mb-2">History ({conversationHistory.length})</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {conversationHistory.slice(-4).map((item, i) => (
                  <div key={i} className={`text-xs p-2 rounded-lg ${
                    item.role === 'user' ? 'bg-white/5 text-gray-300' : 
                    item.role === 'system' ? 'bg-blue-500/10 text-blue-300' :
                    'bg-purple-500/10 text-purple-200'
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
              {status === 'error' && (
                <button
                  onClick={() => { setError(null); setStatus('idle'); }}
                  className="mt-2 text-xs text-gray-400 hover:text-white underline"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {/* Info */}
          <p className="mt-4 text-center text-xs text-gray-500 pb-6">
            {status === 'idle' ? 'Transcript saved when you end the call' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
