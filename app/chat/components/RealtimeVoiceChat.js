// OpenAI Realtime Voice Chat Component
// Uses WebRTC for bidirectional audio streaming with gpt-realtime-1.5 model
// Architecture: SDP offer → Backend proxy → OpenAI /v1/realtime/calls → SDP answer
// Features: Voice preview, web search, session tracking

'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Loader2, AudioWaveform, ChevronDown, X, Play, Square, Globe, Search } from 'lucide-react';

const REALTIME_MODEL = 'gpt-realtime-1.5';

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
  const [micSensitivity, setMicSensitivity] = useState('medium'); // low, medium, high
  const [fullSystemPrompt, setFullSystemPrompt] = useState(null); // Full system prompt with memory
  const [toolActions, setToolActions] = useState([]); // Tool action feedback messages
  
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const audioElementRef = useRef(null);
  const localStreamRef = useRef(null);
  const previewAudioRef = useRef(null);
  const wakeLockRef = useRef(null); // Screen Wake Lock reference
  
  // Screen Wake Lock - keep screen awake during voice chat
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[Realtime] Screen Wake Lock acquired');
        
        // Re-acquire if released (e.g., user switches tabs and comes back)
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[Realtime] Screen Wake Lock released');
        });
      }
    } catch (err) {
      console.log('[Realtime] Wake Lock not supported or failed:', err.message);
    }
  };
  
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('[Realtime] Screen Wake Lock released manually');
      } catch (err) {
        console.log('[Realtime] Wake Lock release error:', err.message);
      }
    }
  };
  
  // Re-acquire wake lock when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && status === 'connected') {
        await requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status]);
  
  // Sensitivity thresholds: higher = less sensitive
  const sensitivitySettings = {
    low: { threshold: 0.6, silence: 600 },    // More sensitive
    medium: { threshold: 0.75, silence: 700 }, // Balanced (default)
    high: { threshold: 0.85, silence: 800 },   // Less sensitive (noisy environments)
  };

  // Load user's voice settings and full system prompt on mount
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        // Load voice settings
        const res = await fetch('/api/user/voice-settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const settings = data.voice_settings || data;
          if (settings.default_voice) setSelectedVoice(settings.default_voice);
          if (settings.web_search_enabled !== undefined) setWebSearchEnabled(settings.web_search_enabled);
        }
        
        // Load full system prompt with memories and soulprint
        const promptRes = await fetch('/api/voice/system-prompt', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (promptRes.ok) {
          const promptData = await promptRes.json();
          if (promptData.systemPrompt) {
            setFullSystemPrompt(promptData.systemPrompt);
            console.log('[Realtime] Loaded full system prompt with memories');
          }
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
      const response = await fetch('/api/voice/tts/preview', {
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
      const response = await fetch('/api/voice/search', {
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
      const trackResponse = await fetch('/api/voice/sessions', {
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

      // 2. Create WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionRef.current = pc;

      // 3. Set up audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      pc.ontrack = (event) => {
        console.log('[Realtime] Received audio track');
        audioEl.srcObject = event.streams[0];
      };

      // 4. Add local audio track
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

      // 5. Set up data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('[Realtime] Data channel opened');
        
        // Build the instructions using the full system prompt if available
        const baseInstructions = fullSystemPrompt || systemPrompt || `You are a helpful AI assistant having a voice conversation. The user's name is ${userName || 'User'}.`;
        
        // Configure session with tools (Updated to new Realtime GA format)
        const sessionConfig = {
          type: 'session.update',
          session: {
            type: 'realtime',
            output_modalities: ['audio'],
            audio: {
              input: {
                transcription: {
                  model: 'whisper-1',
                },
                turn_detection: mode === 'vad' ? {
                  type: 'semantic_vad',
                  eagerness: micSensitivity === 'low' ? 'high' : micSensitivity === 'high' ? 'low' : 'medium',
                } : null,
              },
              output: {
                voice: selectedVoice,
              },
            },
            instructions: `${baseInstructions}

## Voice Chat Tools

You have access to powerful tools that give you the SAME capabilities as text chat:

### 1. USER MEMORY & IDENTITY
- **get_user_memories / recall_memory**: Retrieve stored facts about the user (preferences, health info, personal details, etc.)
- **get_soulprint / who_am_i**: Get the user's complete profile, interests, communication style, and personality insights

WHEN THE USER ASKS "What do you know about me?" or similar:
- Use get_soulprint to retrieve their full profile
- Reference their interests, communication style, important memories
- Be personal - show that you truly know them as a person!

### 2. WEB SEARCH (web_search)
Use for current news, weather, sports scores, stock prices, or any real-time information.

### 3. EMAIL ACCESS
- get_emails: Check the user's emails. Always ask which account if multiple are connected.
- send_email: Send an email. ALWAYS confirm with user before sending.

### 4. CALENDAR ACCESS
- get_calendar: Check calendar events. Can specify date range.
- create_calendar_event: Create a new event. ALWAYS confirm details before creating.

### 5. GOOGLE ACCOUNTS (get_google_accounts)
List connected Google accounts and calendars.

## CRITICAL RULES

**For Memory/Identity Queries:**
- ALWAYS use get_soulprint or get_user_memories when asked about the user
- Reference their profile data naturally in conversation
- Mention their interests, preferences, and important details

**For Web Search:**
- When you call web_search, READ THE RESULTS CAREFULLY
- For sports: Look for "defeated", "final score", "won" with numbers
- NEVER say "I don't have access" - you DO have access!

**For Email/Calendar:**
- Always ask which account to use if user has multiple
- ALWAYS confirm before sending emails or creating events
- Summarize information naturally when speaking

Be conversational, warm, and personal. You KNOW this user - their profile, memories, and preferences are available to you. Use them!`,
            tools: [
              // Memory and identity tools
              {
                type: 'function',
                name: 'get_user_memories',
                description: 'Retrieve the user\'s stored memories - facts, preferences, health info, personal details that they\'ve shared. Use when asked "what do you know about me?" or to recall specific information.',
                parameters: {
                  type: 'object',
                  properties: {},
                  required: [],
                },
              },
              {
                type: 'function',
                name: 'get_soulprint',
                description: 'Get the user\'s complete SoulPrint profile including: name, interests, communication style, personality insights, important memories. Use when asked about the user\'s identity or to personalize responses.',
                parameters: {
                  type: 'object',
                  properties: {},
                  required: [],
                },
              },
              // Web search
              {
                type: 'function',
                name: 'web_search',
                description: 'Search the web for current, real-time information. Use for: weather, news, sports scores, stock prices, current events. For sports scores, include team names, "final score", and the date (e.g., "Lakers vs Celtics final score March 12 2026").',
                parameters: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'The search query - be specific! For sports include both team names + "final score" + date. For weather include city name.' },
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

      // 6. Create SDP offer and send to our backend (which proxies to OpenAI /v1/realtime/calls)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('[Realtime] Sending SDP offer to backend...');
      const sdpResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdp: offer.sdp,
          model: REALTIME_MODEL,
          voice: selectedVoice,
          instructions: fullSystemPrompt || systemPrompt || `You are a helpful AI assistant. The user's name is ${userName || 'User'}. Be conversational and natural.`,
        }),
      });

      if (!sdpResponse.ok) {
        let errMsg = 'Failed to negotiate with OpenAI';
        try {
          const errData = await sdpResponse.json();
          errMsg = errData.error || errMsg;
        } catch (e) {
          // Response might not be JSON
        }
        throw new Error(errMsg);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      setStatus('connected');
      console.log('[Realtime] Voice chat connected!');
      
      // Keep screen awake during voice chat
      await requestWakeLock();

    } catch (err) {
      console.error('[Realtime] Error:', err);
      setError(err.message);
      setStatus('error');
      cleanup();
    }
  }, [token, systemPrompt, fullSystemPrompt, userName, mode, selectedVoice, webSearchEnabled, micSensitivity]);

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
            'get_user_memories': `🧠 Recalling your memories...`,
            'recall_memory': `🧠 Recalling your memories...`,
            'get_soulprint': `✨ Loading your profile...`,
            'who_am_i': `✨ Loading your profile...`,
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
          
          // Update UI with detailed result feedback
          if (!result.success) {
            setToolActions(prev => [...prev.slice(-4), { 
              text: `❌ ${toolName} failed: ${result.error || 'Unknown error'}`, 
              timestamp: new Date() 
            }]);
          } else if (result.result?.error) {
            setToolActions(prev => [...prev.slice(-4), { 
              text: `⚠️ ${toolName}: ${result.result.error}`, 
              timestamp: new Date() 
            }]);
          } else {
            const successMsg = toolName === 'get_calendar' 
              ? `✅ Found ${result.result?.events?.length || 0} calendar events`
              : toolName === 'get_emails'
                ? `✅ Found ${result.result?.emails?.length || 0} emails`
                : `✅ ${toolName} completed`;
            setToolActions(prev => [...prev.slice(-4), { 
              text: successMsg, 
              timestamp: new Date() 
            }]);
          }
          
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
    // Release screen wake lock when ending voice chat
    releaseWakeLock();
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 pb-safe">
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
        
        <div className="relative bg-gray-900/90 rounded-3xl p-6 sm:p-8 border border-white/10 max-h-[85vh] overflow-y-auto mb-4">
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
            <div className="mb-4">
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

          {/* Mic sensitivity selector - only when idle */}
          {status === 'idle' && (
            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-2">Microphone Sensitivity</label>
              <div className="flex gap-2">
                {[
                  { id: 'low', label: 'High', desc: 'Quiet room' },
                  { id: 'medium', label: 'Medium', desc: 'Normal' },
                  { id: 'high', label: 'Low', desc: 'Noisy area' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setMicSensitivity(opt.id)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-center transition-all ${
                      micSensitivity === opt.id
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-xs font-medium">{opt.label}</p>
                    <p className="text-[10px] text-gray-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main visual - SoulPrint Logo with glow effect */}
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
              // SoulPrint logo with dynamic pulsating effect when AI is speaking
              <div className="relative flex items-center justify-center">
                {/* Animated rings when AI is speaking */}
                {isAISpeaking && (
                  <>
                    {/* Ring 1 - slowest, largest */}
                    <div 
                      className="absolute rounded-full bg-orange-500/15"
                      style={{
                        width: '140px',
                        height: '140px',
                        animation: 'voicePulseRing1 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      }}
                    />
                    {/* Ring 2 - medium */}
                    <div 
                      className="absolute rounded-full bg-orange-500/25"
                      style={{
                        width: '115px',
                        height: '115px',
                        animation: 'voicePulseRing2 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        animationDelay: '0.2s',
                      }}
                    />
                    {/* Ring 3 - inner glow */}
                    <div 
                      className="absolute rounded-full bg-orange-500/35"
                      style={{
                        width: '98px',
                        height: '98px',
                        animation: 'voicePulseRing3 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      }}
                    />
                  </>
                )}
                
                {/* Main logo container with breathing animation */}
                <div 
                  className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
                    isAISpeaking 
                      ? 'bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600' 
                      : isSearching
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-600 shadow-[0_0_30px_rgba(59,130,246,0.5)]'
                        : 'bg-gradient-to-br from-gray-700 to-gray-800 shadow-lg'
                  }`}
                  style={{
                    boxShadow: isAISpeaking 
                      ? '0 0 50px rgba(249,115,22,0.6), 0 0 80px rgba(249,115,22,0.4), 0 0 120px rgba(249,115,22,0.2)' 
                      : undefined,
                    animation: isAISpeaking ? 'voiceBreathe 1.5s ease-in-out infinite' : undefined,
                  }}
                >
                  {/* Logo with pulse effect */}
                  <img 
                    src="/logo.svg" 
                    alt="SoulPrint" 
                    className="w-12 h-12 sm:w-14 sm:h-14 transition-transform duration-300"
                    style={{
                      filter: isAISpeaking 
                        ? 'brightness(1.4) drop-shadow(0 0 10px rgba(255,255,255,0.6))' 
                        : 'brightness(1)',
                      animation: isAISpeaking ? 'voiceLogoPulse 0.75s ease-in-out infinite' : undefined,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Keyframe animations for voice chat pulsating logo */}
          <style>{`
            @keyframes voicePulseRing1 {
              0% { transform: scale(0.8); opacity: 0.8; }
              50% { transform: scale(1.1); opacity: 0.3; }
              100% { transform: scale(1.3); opacity: 0; }
            }
            @keyframes voicePulseRing2 {
              0% { transform: scale(0.85); opacity: 0.9; }
              50% { transform: scale(1.05); opacity: 0.4; }
              100% { transform: scale(1.2); opacity: 0; }
            }
            @keyframes voicePulseRing3 {
              0%, 100% { transform: scale(0.95); opacity: 0.7; }
              50% { transform: scale(1.02); opacity: 1; }
            }
            @keyframes voiceBreathe {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.06); }
            }
            @keyframes voiceLogoPulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.12); }
            }
          `}</style>

          {/* Controls - Mic, Hang up, and other buttons */}
          {status === 'connected' && (
            <div className="flex justify-center items-center gap-3 mb-4">
              {/* Mute button */}
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
              
              {/* Hang up button */}
              <button
                onClick={endVoiceChat}
                className="p-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white transition-all transform hover:scale-105 shadow-lg shadow-red-500/30"
                title="End call"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
              
              {/* Interrupt button (only when AI is speaking) */}
              {isAISpeaking && (
                <button
                  onClick={interruptAI}
                  className="p-3 rounded-full bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all"
                  title="Interrupt"
                >
                  <VolumeX className="w-5 h-5" />
                </button>
              )}
              
              {/* Web search indicator */}
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
          <p className="mt-4 text-center text-xs text-gray-500 pb-6">
            {status === 'idle' ? 'Transcript saved when you end the call' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
