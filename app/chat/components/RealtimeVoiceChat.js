// OpenAI Realtime Voice Chat Component
// Uses WebRTC for bidirectional audio streaming with gpt-4o-realtime model
// Features: Voice preview, web search, session tracking

'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Loader2, AudioWaveform, ChevronDown, X, Play, Square, Globe, Search } from 'lucide-react';

const REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';

// Available voices from OpenAI Realtime API
const VOICES = [
  { id: 'alloy', name: 'Alloy', desc: 'Neutral & balanced', preview: 'Hello! I\'m Alloy, your AI assistant.' },
  { id: 'ash', name: 'Ash', desc: 'Soft & thoughtful', preview: 'Hi there. I\'m Ash, here to help you.' },
  { id: 'ballad', name: 'Ballad', desc: 'Warm & expressive', preview: 'Hey! I\'m Ballad, ready to chat with you.' },
  { id: 'coral', name: 'Coral', desc: 'Clear & friendly', preview: 'Hello! I\'m Coral, nice to meet you.' },
  { id: 'echo', name: 'Echo', desc: 'Smooth & calm', preview: 'Greetings. I\'m Echo, at your service.' },
  { id: 'sage', name: 'Sage', desc: 'Wise & measured', preview: 'Hello. I\'m Sage, here to assist you.' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Bright & energetic', preview: 'Hi! I\'m Shimmer, excited to help!' },
  { id: 'verse', name: 'Verse', desc: 'Dynamic & engaging', preview: 'Hey there! I\'m Verse, let\'s talk!' },
];

export default function RealtimeVoiceChat({ token, onClose, onSaveTranscript, systemPrompt, userName }) {
  const [status, setStatus] = useState('idle'); // idle, connecting, connected, error
  const [isMuted, setIsMuted] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('vad'); // 'vad' or 'push-to-talk'
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [previewAudio, setPreviewAudio] = useState(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const audioElementRef = useRef(null);
  const localStreamRef = useRef(null);
  const previewAudioRef = useRef(null);

  // Load user's voice settings on mount
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const res = await fetch('/api/user/voice-settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const settings = await res.json();
          if (settings.default_voice) setSelectedVoice(settings.default_voice);
          if (settings.web_search_enabled !== undefined) setWebSearchEnabled(settings.web_search_enabled);
        }
      } catch (err) {
        console.error('Failed to load voice settings:', err);
      }
      setSettingsLoaded(true);
    };
    
    if (token) loadVoiceSettings();
  }, [token]);

  // Preview a voice using TTS API
  const previewVoice = useCallback(async (voiceId) => {
    // Stop any current preview
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    
    if (previewingVoice === voiceId) {
      setPreviewingVoice(null);
      return;
    }
    
    setPreviewingVoice(voiceId);
    
    try {
      const voice = VOICES.find(v => v.id === voiceId);
      const response = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voice: voiceId,
          text: voice?.preview || 'Hello, this is a voice preview.',
        }),
      });
      
      if (!response.ok) throw new Error('Failed to generate preview');
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      
      audio.onended = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play();
    } catch (err) {
      console.error('Voice preview error:', err);
      setPreviewingVoice(null);
    }
  }, [token, previewingVoice]);

  // Stop preview
  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewingVoice(null);
  }, []);

  // Web search function for the AI to call
  const performWebSearch = useCallback(async (query) => {
    setIsSearching(true);
    try {
      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit: 3 }),
      });
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      return data.results || [];
    } catch (err) {
      console.error('Web search error:', err);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [token]);

  // Start voice chat session and track it
  const startVoiceChat = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      setConversationHistory([]);
      setSessionStartTime(new Date());

      // 1. Create session in our backend for tracking
      const trackResponse = await fetch('/api/voice-sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voice: selectedVoice,
          mode: mode,
          web_search_enabled: webSearchEnabled,
        }),
      });
      
      if (trackResponse.ok) {
        const trackData = await trackResponse.json();
        setSessionId(trackData.session_id);
      }

      // 2. Get ephemeral token from OpenAI
      const sessionResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: REALTIME_MODEL,
          voice: selectedVoice,
          instructions: systemPrompt || `You are a helpful AI assistant. The user's name is ${userName || 'User'}. Be conversational and natural.`,
        }),
      });

      if (!sessionResponse.ok) {
        const err = await sessionResponse.json();
        throw new Error(err.error || 'Failed to create session');
      }

      const sessionData = await sessionResponse.json();
      const ephemeralKey = sessionData.client_secret?.value;

      if (!ephemeralKey) {
        throw new Error('No ephemeral key received');
      }

      // 3. Create WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionRef.current = pc;

      // 4. Set up audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      pc.ontrack = (event) => {
        console.log('[Realtime] Received audio track');
        audioEl.srcObject = event.streams[0];
      };

      // 5. Add local audio track
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      localStreamRef.current = stream;
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // 6. Set up data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('[Realtime] Data channel opened');
        
        // Configure session with tools for web search
        const sessionConfig = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice: selectedVoice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: mode === 'vad' ? {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            } : null,
            instructions: `${systemPrompt || `You are a helpful AI assistant having a voice conversation. The user's name is ${userName || 'User'}.`}

IMPORTANT: You have access to several tools that give you the SAME capabilities as text chat:

1. WEB SEARCH (web_search): Use for current news, weather, sports scores, stock prices, or any real-time information.

2. EMAIL ACCESS:
   - get_emails: Check the user's emails. Always ask which account if multiple are connected.
   - send_email: Send an email. ALWAYS confirm with user before sending.

3. CALENDAR ACCESS:
   - get_calendar: Check calendar events. Can specify date range.
   - create_calendar_event: Create a new event. ALWAYS confirm details before creating.

4. GOOGLE ACCOUNTS (get_google_accounts): List connected Google accounts and calendars.

TOOL USAGE RULES:
- For web search: Use automatically for current events, weather, news, stocks, sports.
- For email/calendar: Always ask which account to use if the user has multiple.
- Before sending emails or creating events, ALWAYS confirm with the user first.
- When showing emails or events, summarize key information naturally.

Be conversational, warm, and concise. Speak naturally as if you're having a real phone call.`,
            tools: [
              {
                type: 'function',
                name: 'web_search',
                description: 'Search the web for current, real-time information. Use for: weather, news, sports scores, stock prices, current events.',
                parameters: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'The search query' },
                  },
                  required: ['query'],
                },
              },
              {
                type: 'function',
                name: 'get_emails',
                description: 'Get emails from the user\'s Gmail inbox. Ask which account to use first.',
                parameters: {
                  type: 'object',
                  properties: {
                    account_email: { type: 'string', description: 'The Google account email to check' },
                    query: { type: 'string', description: 'Optional Gmail search query (e.g., "is:unread", "from:boss@company.com")' },
                    limit: { type: 'number', description: 'Number of emails to fetch (default 5)' },
                  },
                  required: [],
                },
              },
              {
                type: 'function',
                name: 'send_email',
                description: 'Send an email using Gmail. ALWAYS confirm with user before sending.',
                parameters: {
                  type: 'object',
                  properties: {
                    account_email: { type: 'string', description: 'The Google account to send from' },
                    to: { type: 'string', description: 'Recipient email address' },
                    subject: { type: 'string', description: 'Email subject' },
                    body: { type: 'string', description: 'Email body content' },
                  },
                  required: ['account_email', 'to', 'subject', 'body'],
                },
              },
              {
                type: 'function',
                name: 'get_calendar',
                description: 'Get calendar events. Ask which account to use first.',
                parameters: {
                  type: 'object',
                  properties: {
                    account_email: { type: 'string', description: 'The Google account email' },
                    calendar_id: { type: 'string', description: 'Calendar ID (default "primary")' },
                    start_date: { type: 'string', description: 'Start date (ISO format, default today)' },
                    end_date: { type: 'string', description: 'End date (ISO format, default 7 days from now)' },
                    limit: { type: 'number', description: 'Max events to return (default 10)' },
                  },
                  required: [],
                },
              },
              {
                type: 'function',
                name: 'create_calendar_event',
                description: 'Create a new calendar event. ALWAYS confirm details before creating.',
                parameters: {
                  type: 'object',
                  properties: {
                    account_email: { type: 'string', description: 'The Google account to use' },
                    calendar_id: { type: 'string', description: 'Calendar ID (default "primary")' },
                    summary: { type: 'string', description: 'Event title' },
                    description: { type: 'string', description: 'Event description' },
                    location: { type: 'string', description: 'Event location' },
                    start: { type: 'string', description: 'Start datetime (ISO 8601)' },
                    end: { type: 'string', description: 'End datetime (ISO 8601)' },
                    attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
                  },
                  required: ['account_email', 'summary', 'start', 'end'],
                },
              },
              {
                type: 'function',
                name: 'get_google_accounts',
                description: 'List the user\'s connected Google accounts and their calendars.',
                parameters: {
                  type: 'object',
                  properties: {},
                  required: [],
                },
              },
            ],
            tool_choice: 'auto',
          },
        };
        
        dc.send(JSON.stringify(sessionConfig));
      };

      dc.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleRealtimeEvent(data);
      };

      // 7. Create and send offer to OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        throw new Error('Failed to negotiate with OpenAI');
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      setStatus('connected');
      console.log('[Realtime] Voice chat connected!');

    } catch (err) {
      console.error('[Realtime] Error:', err);
      setError(err.message);
      setStatus('error');
      cleanup();
    }
  }, [token, systemPrompt, userName, mode, selectedVoice, webSearchEnabled]);

  // Handle events from OpenAI Realtime API
  const handleRealtimeEvent = useCallback(async (event) => {
    console.log('[Realtime Event]', event.type, event);

    switch (event.type) {
      case 'session.created':
        console.log('[Realtime] Session created:', event.session);
        break;
        
      case 'session.updated':
        console.log('[Realtime] Session updated - tools:', event.session?.tools);
        break;

      case 'input_audio_buffer.speech_started':
        setIsAISpeaking(false);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const userText = event.transcript || '';
        setTranscript(userText);
        if (userText) {
          setConversationHistory(prev => [...prev, { role: 'user', text: userText, timestamp: new Date() }]);
        }
        break;

      case 'response.audio_transcript.delta':
        setAiResponse(prev => prev + (event.delta || ''));
        break;

      case 'response.audio_transcript.done':
        const aiText = event.transcript || '';
        if (aiText) {
          setConversationHistory(prev => [...prev, { role: 'assistant', text: aiText, timestamp: new Date() }]);
        }
        break;

      case 'response.audio.started':
        setIsAISpeaking(true);
        break;

      case 'response.audio.done':
        setIsAISpeaking(false);
        setAiResponse('');
        break;

      case 'response.done':
        setTranscript('');
        break;

      case 'response.function_call_arguments.done':
        // Handle ALL function calls through unified backend API
        console.log('[Realtime] Function call received:', event.name, event);
        try {
          const args = JSON.parse(event.arguments || '{}');
          const toolName = event.name;
          console.log(`[Realtime] Executing tool: ${toolName}`, args);
          setIsSearching(true);
          
          // Add visual feedback
          const actionLabel = {
            'web_search': `🔍 Searching: "${args.query}"...`,
            'get_emails': `📧 Checking emails${args.account_email ? ` (${args.account_email})` : ''}...`,
            'send_email': `✉️ Sending email to ${args.to}...`,
            'get_calendar': `📅 Checking calendar${args.account_email ? ` (${args.account_email})` : ''}...`,
            'create_calendar_event': `📅 Creating event: "${args.summary}"...`,
            'get_google_accounts': `🔗 Getting connected accounts...`,
          }[toolName] || `⚡ Running ${toolName}...`;
          
          setConversationHistory(prev => [...prev, { 
            role: 'system', 
            text: actionLabel, 
            timestamp: new Date() 
          }]);
          
          // Call unified voice tool API
          const response = await fetch('/api/voice/tool', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tool_name: toolName,
              tool_args: args,
            }),
          });
          
          const result = await response.json();
          console.log(`[Realtime] Tool result for ${toolName}:`, result);
          
          // Send results back to the conversation
          if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            const functionOutput = {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: event.call_id,
                output: JSON.stringify(result.success ? result.result : { error: result.error }),
              },
            };
            console.log('[Realtime] Sending function output:', functionOutput);
            dataChannelRef.current.send(JSON.stringify(functionOutput));
            
            // Trigger response generation
            dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
          }
          setIsSearching(false);
        } catch (err) {
          console.error('Function call error:', err);
          setIsSearching(false);
          // Send error output
          if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            dataChannelRef.current.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: event.call_id,
                output: JSON.stringify({ error: 'Tool execution failed', message: err.message }),
              },
            }));
            dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
          }
        }
        break;

      case 'error':
        console.error('[Realtime] Error:', event.error);
        setError(event.error?.message || 'Unknown error');
        break;
    }
  }, [token]);

  // Cleanup function
  const cleanup = useCallback(() => {
    stopPreview();
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
  }, [stopPreview]);

  // End voice chat, save transcript, and update session metrics
  const endVoiceChat = useCallback(async () => {
    const endTime = new Date();
    const duration = sessionStartTime ? Math.round((endTime - sessionStartTime) / 1000) : 0;
    
    cleanup();
    
    // Update session metrics in backend
    if (sessionId) {
      try {
        await fetch(`/api/voice-sessions/${sessionId}`, {
          method: 'PATCH',
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
    
    // Save transcript
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
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Interrupt AI
  const interruptAI = useCallback(() => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'response.cancel' }));
      setIsAISpeaking(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const selectedVoiceData = VOICES.find(v => v.id === selectedVoice) || VOICES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4">
        {/* Background animation */}
        <div className={`absolute inset-0 rounded-3xl transition-all duration-500 ${
          status === 'connected' 
            ? isAISpeaking 
              ? 'bg-gradient-to-br from-orange-500/30 to-orange-600/20 animate-pulse' 
              : isSearching
                ? 'bg-gradient-to-br from-blue-500/30 to-cyan-600/20 animate-pulse'
                : 'bg-gradient-to-br from-green-500/20 to-emerald-600/10'
            : 'bg-gradient-to-br from-gray-800/50 to-gray-900/50'
        }`} />
        
        <div className="relative bg-gray-900/90 rounded-3xl p-6 sm:p-8 border border-white/10 max-h-[90vh] overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white mb-2">Voice Conversation</h2>
            <p className="text-sm text-gray-400">
              {status === 'idle' && 'Select a voice and click to start'}
              {status === 'connecting' && 'Connecting...'}
              {status === 'connected' && (
                isSearching ? '🔍 Searching the web...' :
                isAISpeaking ? 'AI is speaking...' : 'Listening...'
              )}
              {status === 'error' && 'Connection error'}
            </p>
          </div>

          {/* Voice selector with preview - only when idle */}
          {status === 'idle' && (
            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-2">AI Voice (tap speaker to preview)</label>
              <div className="grid grid-cols-2 gap-2">
                {VOICES.map(voice => (
                  <div
                    key={voice.id}
                    className={`relative flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedVoice === voice.id 
                        ? 'bg-orange-500/20 border-orange-500/50' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedVoice(voice.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        previewVoice(voice.id);
                      }}
                      className={`p-1.5 rounded-full transition-all ${
                        previewingVoice === voice.id 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {previewingVoice === voice.id ? (
                        <Square className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${selectedVoice === voice.id ? 'text-orange-400' : 'text-white'}`}>
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

          {/* Main button */}
          <div className="flex justify-center mb-6">
            {status === 'idle' || status === 'error' ? (
              <button
                onClick={startVoiceChat}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-orange-500/30"
              >
                <AudioWaveform className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </button>
            ) : status === 'connecting' ? (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-800 flex items-center justify-center">
                <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500 animate-spin" />
              </div>
            ) : (
              <button
                onClick={endVoiceChat}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-red-500/30"
              >
                <PhoneOff className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </button>
            )}
          </div>

          {/* Controls */}
          {status === 'connected' && (
            <div className="flex justify-center gap-4 mb-4">
              <button
                onClick={toggleMute}
                className={`p-3 rounded-full transition-all ${
                  isMuted 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              {isAISpeaking && (
                <button
                  onClick={interruptAI}
                  className="p-3 rounded-full bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all"
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
                <div className="bg-orange-500/10 rounded-xl p-3">
                  <p className="text-xs text-orange-400 mb-1">AI:</p>
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
                    item.role === 'user' ? 'bg-white/5 text-gray-300' : 'bg-orange-500/10 text-orange-200'
                  }`}>
                    <span className="font-medium">{item.role === 'user' ? 'You' : 'AI'}:</span> {item.text.slice(0, 80)}{item.text.length > 80 ? '...' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Mode selector - only when idle */}
          {status === 'idle' && (
            <div className="mt-4 flex justify-center">
              <div className="inline-flex bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setMode('vad')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mode === 'vad' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Auto (VAD)
                </button>
                <button
                  onClick={() => setMode('push-to-talk')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mode === 'push-to-talk' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Push-to-Talk
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <p className="mt-4 text-center text-xs text-gray-500">
            {status === 'idle' ? 'Transcript saved when you end the call' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
