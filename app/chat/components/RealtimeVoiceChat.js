// OpenAI Realtime Voice Chat Component
// Uses WebRTC for bidirectional audio streaming with gpt-4o-realtime model

'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Settings, Loader2 } from 'lucide-react';

const REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';

export default function RealtimeVoiceChat({ token, onClose, systemPrompt, userName }) {
  const [status, setStatus] = useState('idle'); // idle, connecting, connected, error
  const [isMuted, setIsMuted] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('vad'); // 'vad' or 'push-to-talk'
  
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const audioElementRef = useRef(null);
  const localStreamRef = useRef(null);

  // Initialize WebRTC connection
  const startVoiceChat = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);

      // 1. Get ephemeral token from our backend
      const sessionResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: REALTIME_MODEL,
          voice: 'alloy',
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
        // Configure the session
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice: 'alloy',
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
            instructions: systemPrompt || `You are a helpful AI assistant having a voice conversation. The user's name is ${userName || 'User'}. Be conversational, natural, and concise. Respond as if you're having a real conversation.`,
          },
        }));
      };

      dc.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleRealtimeEvent(data);
      };

      // 6. Create and send offer to OpenAI
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
  }, [token, systemPrompt, userName, mode]);

  // Handle events from OpenAI Realtime API
  const handleRealtimeEvent = (event) => {
    console.log('[Realtime Event]', event.type);

    switch (event.type) {
      case 'session.created':
        console.log('[Realtime] Session created');
        break;

      case 'session.updated':
        console.log('[Realtime] Session updated');
        break;

      case 'input_audio_buffer.speech_started':
        console.log('[Realtime] User started speaking');
        setIsAISpeaking(false);
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('[Realtime] User stopped speaking');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        console.log('[Realtime] User transcript:', event.transcript);
        setTranscript(event.transcript || '');
        break;

      case 'response.audio_transcript.delta':
        setAiResponse(prev => prev + (event.delta || ''));
        break;

      case 'response.audio_transcript.done':
        console.log('[Realtime] AI response complete:', event.transcript);
        break;

      case 'response.audio.started':
        setIsAISpeaking(true);
        break;

      case 'response.audio.done':
        setIsAISpeaking(false);
        break;

      case 'response.done':
        setAiResponse('');
        break;

      case 'error':
        console.error('[Realtime] Error:', event.error);
        setError(event.error?.message || 'Unknown error');
        break;
    }
  };

  // Cleanup function
  const cleanup = useCallback(() => {
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
  }, []);

  // End voice chat
  const endVoiceChat = useCallback(() => {
    cleanup();
    setStatus('idle');
    setTranscript('');
    setAiResponse('');
    if (onClose) onClose();
  }, [cleanup, onClose]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Send text message (for push-to-talk mode)
  const sendTextMessage = useCallback((text) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      }));
      dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
  }, []);

  // Interrupt AI response
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4">
        {/* Background animation */}
        <div className={`absolute inset-0 rounded-3xl transition-all duration-500 ${
          status === 'connected' 
            ? isAISpeaking 
              ? 'bg-gradient-to-br from-orange-500/30 to-orange-600/20 animate-pulse' 
              : 'bg-gradient-to-br from-green-500/20 to-emerald-600/10'
            : 'bg-gradient-to-br from-gray-800/50 to-gray-900/50'
        }`} />
        
        <div className="relative bg-gray-900/90 rounded-3xl p-8 border border-white/10">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-white mb-2">Voice Conversation</h2>
            <p className="text-sm text-gray-400">
              {status === 'idle' && 'Click to start talking'}
              {status === 'connecting' && 'Connecting...'}
              {status === 'connected' && (isAISpeaking ? 'AI is speaking...' : 'Listening...')}
              {status === 'error' && 'Connection error'}
            </p>
          </div>

          {/* Main button */}
          <div className="flex justify-center mb-8">
            {status === 'idle' || status === 'error' ? (
              <button
                onClick={startVoiceChat}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-orange-500/30"
              >
                <Phone className="w-10 h-10 text-white" />
              </button>
            ) : status === 'connecting' ? (
              <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              </div>
            ) : (
              <button
                onClick={endVoiceChat}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-red-500/30"
              >
                <PhoneOff className="w-10 h-10 text-white" />
              </button>
            )}
          </div>

          {/* Controls */}
          {status === 'connected' && (
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all ${
                  isMuted 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              {isAISpeaking && (
                <button
                  onClick={interruptAI}
                  className="p-4 rounded-full bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all"
                  title="Interrupt"
                >
                  <VolumeX className="w-6 h-6" />
                </button>
              )}
            </div>
          )}

          {/* Transcript display */}
          {status === 'connected' && (transcript || aiResponse) && (
            <div className="space-y-3 max-h-40 overflow-y-auto">
              {transcript && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">You said:</p>
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

          {/* Error display */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            ✕
          </button>

          {/* Mode selector */}
          {status === 'idle' && (
            <div className="mt-6 flex justify-center">
              <div className="inline-flex bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setMode('vad')}
                  className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                    mode === 'vad' 
                      ? 'bg-orange-500 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Auto (VAD)
                </button>
                <button
                  onClick={() => setMode('push-to-talk')}
                  className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                    mode === 'push-to-talk' 
                      ? 'bg-orange-500 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Push-to-Talk
                </button>
              </div>
            </div>
          )}

          {/* Info text */}
          <p className="mt-6 text-center text-xs text-gray-500">
            {status === 'idle' 
              ? 'Voice conversations use OpenAI Realtime API' 
              : status === 'connected'
                ? mode === 'vad' 
                  ? 'Speak naturally - AI will respond automatically'
                  : 'Press and hold the mic button to speak'
                : ''
            }
          </p>
        </div>
      </div>
    </div>
  );
}
