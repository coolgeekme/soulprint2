'use client';
import { useState, useEffect, useRef } from 'react';

function useSpeechRecognition({ onTranscript, onInterim, token }) {
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false); // Ref to track listening state for callbacks
  const [mode, setMode] = useState(null); // 'live' | 'whisper'
  const [error, setError] = useState(null);
  const lastFinalIndexRef = useRef(0); // Track last processed final result index
  const lastFinalTextRef = useRef(''); // Track last final text to prevent duplicates

  // Keep ref in sync with state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Check for native Web Speech API support
  const hasNativeSpeech = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Check for MediaRecorder support (for Whisper fallback)
  const hasMediaRecorder = typeof window !== 'undefined' && 
    typeof MediaRecorder !== 'undefined';

  // Detect browser for optimal settings
  const getBrowserInfo = () => {
    if (typeof navigator === 'undefined') return { name: 'unknown', supportsWebm: true };
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return { name: 'firefox', supportsWebm: true };
    if (ua.includes('Safari') && !ua.includes('Chrome')) return { name: 'safari', supportsWebm: false };
    if (ua.includes('Chrome')) return { name: 'chrome', supportsWebm: true };
    if (ua.includes('Edg')) return { name: 'edge', supportsWebm: true };
    return { name: 'unknown', supportsWebm: true };
  };

  async function startLive() {
    try {
      console.log('startLive: Requesting microphone permission...');
      // First request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('startLive: Microphone permission granted');
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(t => t.stop());
      
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = true; // Keep listening
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (e) => {
        let interim = '';
        let final = '';
        // Only process results we haven't seen yet
        const startIdx = Math.max(e.resultIndex, lastFinalIndexRef.current);
        for (let i = startIdx; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            // Deduplicate: skip if this exact text was just finalized
            const trimmed = transcript.trim();
            if (trimmed && trimmed !== lastFinalTextRef.current) {
              final += transcript;
              lastFinalTextRef.current = trimmed;
            }
            lastFinalIndexRef.current = i + 1;
          } else {
            interim = transcript; // Use ONLY the latest interim, don't concatenate
          }
        }
        if (final) {
          console.log('startLive: Final transcript:', final);
          onTranscript(final);
        }
        if (interim) onInterim(interim);
        else if (final) onInterim(''); // Clear interim when we get a final
      };
      
      rec.onerror = (e) => { 
        console.error('Speech recognition error:', e.error, e); 
        if (e.error === 'not-allowed') {
          setError('Microphone access denied');
        } else if (e.error === 'no-speech') {
          // This is normal - just means no speech detected yet
          console.log('startLive: No speech detected, continuing...');
          return;
        } else if (e.error === 'aborted') {
          // User stopped, this is fine
          console.log('startLive: Recognition aborted by user');
          return;
        } else if (e.error === 'network') {
          // Network error - try Whisper fallback
          console.log('startLive: Network error, falling back to Whisper');
          stop();
          startWhisper();
          return;
        } else {
          setError(`Speech error: ${e.error}`);
        }
        setIsListening(false);
        isListeningRef.current = false;
      };
      
      rec.onend = () => {
        console.log('startLive: Recognition ended, isListeningRef:', isListeningRef.current);
        // Auto-restart if still supposed to be listening (for continuous mode)
        if (isListeningRef.current && recognitionRef.current) {
          try {
            // Reset tracking refs for the new session
            lastFinalIndexRef.current = 0;
            // Delay restart to avoid echo pickup on mobile
            setTimeout(() => {
              if (isListeningRef.current && recognitionRef.current) {
                console.log('startLive: Auto-restarting recognition');
                try {
                  recognitionRef.current.start();
                } catch (e) {
                  console.error('Failed to restart recognition:', e);
                  setIsListening(false);
                  isListeningRef.current = false;
                }
              }
            }, 300);
          } catch (e) {
            console.error('Failed to restart recognition:', e);
            setIsListening(false);
            isListeningRef.current = false;
          }
        }
      };

      recognitionRef.current = rec;
      lastFinalIndexRef.current = 0;
      lastFinalTextRef.current = '';
      console.log('startLive: Starting recognition...');
      rec.start();
      console.log('startLive: Recognition started successfully');
      setIsListening(true);
      isListeningRef.current = true;
      setMode('live');
      setError(null);
    } catch (err) {
      console.error('Mic permission error:', err);
      setError('Microphone access denied. Please allow microphone access in your browser settings.');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }

  async function startWhisper() {
    if (!hasMediaRecorder) {
      setError('Voice recording not supported in this browser');
      return;
    }

    try {
      console.log('startWhisper: Requesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('startWhisper: Microphone granted');
      const browser = getBrowserInfo();
      console.log('startWhisper: Browser info:', browser);
      
      // Choose appropriate mime type based on browser support
      let mimeType = 'audio/webm';
      if (!browser.supportsWebm || !MediaRecorder.isTypeSupported('audio/webm')) {
        // Safari and some browsers don't support webm
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          // Fallback to default
          mimeType = '';
        }
      }
      console.log('startWhisper: Using mimeType:', mimeType);
      
      const recorderOptions = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];
      
      mr.ondataavailable = (e) => { 
        if (e.data.size > 0) {
          console.log('startWhisper: Received audio chunk, size:', e.data.size);
          chunksRef.current.push(e.data);
        }
      };
      
      mr.onstop = async () => {
        console.log('startWhisper: Recording stopped, processing...');
        stream.getTracks().forEach(t => t.stop());
        const actualMimeType = mr.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        console.log('startWhisper: Created blob, size:', blob.size, 'type:', actualMimeType);
        
        // Determine file extension based on mime type
        let extension = 'webm';
        if (actualMimeType.includes('mp4')) extension = 'mp4';
        else if (actualMimeType.includes('wav')) extension = 'wav';
        else if (actualMimeType.includes('ogg')) extension = 'ogg';
        
        const form = new FormData();
        form.append('audio', blob, `recording.${extension}`);
        
        try {
          console.log('startWhisper: Sending to transcribe API...');
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          const data = await res.json();
          console.log('startWhisper: Transcribe response:', data);
          if (data.text) {
            onTranscript(data.text.trim());
          } else if (data.error) {
            console.error('Transcription error:', data.error);
            setError('Transcription failed. Please try again.');
          }
        } catch (err) { 
          console.error('Whisper error', err); 
          setError('Transcription failed. Please try again.');
        }
        setIsListening(false);
        isListeningRef.current = false;
      };
      
      mr.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setError('Recording failed. Please try again.');
        setIsListening(false);
        isListeningRef.current = false;
      };
      
      mediaRecorderRef.current = mr;
      console.log('startWhisper: Starting recording...');
      mr.start();
      console.log('startWhisper: Recording started');
      setIsListening(true);
      isListeningRef.current = true;
      setMode('whisper');
      setError(null);
    } catch (err) {
      console.error('Mic access denied', err);
      setError('Microphone access denied. Please allow microphone access in your browser settings.');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }

  function start() {
    setError(null);
    console.log('Starting speech recognition...', { hasNativeSpeech, hasMediaRecorder });
    // Use native speech recognition if available (Chrome, Edge, Safari)
    // Otherwise fall back to Whisper API (Firefox, etc.)
    if (hasNativeSpeech) {
      console.log('Using native Web Speech API');
      startLive();
    } else if (hasMediaRecorder) {
      console.log('Using Whisper fallback (MediaRecorder)');
      startWhisper();
    } else {
      setError('Voice input not supported in this browser. Please try Chrome, Edge, or Safari.');
    }
  }

  function stop() {
    if (mode === 'live' && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
      recognitionRef.current = null;
    } else if (mode === 'whisper' && mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    isListeningRef.current = false;
    lastFinalIndexRef.current = 0;
    lastFinalTextRef.current = '';
  }

  function toggle() {
    if (isListening) stop();
    else start();
  }

  return { isListening, toggle, mode, error, hasNativeSpeech, hasMediaRecorder };
}

export default useSpeechRecognition;
