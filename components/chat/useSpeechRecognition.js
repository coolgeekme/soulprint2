'use client';
import { useState, useEffect, useRef } from 'react';

function useSpeechRecognition({ onTranscript, onInterim, token }) {
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const [mode, setMode] = useState(null); // 'live' | 'whisper'
  const [error, setError] = useState(null);
  const lastFinalIndexRef = useRef(0);
  const lastFinalTextRef = useRef('');
  const silenceTimerRef = useRef(null); // Auto-stop after silence

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const hasNativeSpeech = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const hasMediaRecorder = typeof window !== 'undefined' && 
    typeof MediaRecorder !== 'undefined';

  const getBrowserInfo = () => {
    if (typeof navigator === 'undefined') return { name: 'unknown', supportsWebm: true };
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return { name: 'firefox', supportsWebm: true };
    if (ua.includes('Safari') && !ua.includes('Chrome')) return { name: 'safari', supportsWebm: false };
    if (ua.includes('Chrome')) return { name: 'chrome', supportsWebm: true };
    if (ua.includes('Edg')) return { name: 'edge', supportsWebm: true };
    return { name: 'unknown', supportsWebm: true };
  };

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  // Start a silence timeout — auto-stop if no speech activity for N seconds
  function resetSilenceTimer(durationMs = 8000) {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (isListeningRef.current) {
        console.log('Voice: Silence timeout — auto-stopping');
        stop();
      }
    }, durationMs);
  }

  async function startLive() {
    try {
      console.log('startLive: Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = true; // Keep recording continuously until user stops
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (e) => {
        // Reset silence timer on every result (speech is active)
        resetSilenceTimer(10000); // 10s of silence after last speech → auto-stop

        let interim = '';
        let final = '';
        const startIdx = Math.max(e.resultIndex, lastFinalIndexRef.current);
        for (let i = startIdx; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            const trimmed = transcript.trim();
            if (trimmed && trimmed !== lastFinalTextRef.current) {
              final += transcript;
              lastFinalTextRef.current = trimmed;
            }
            lastFinalIndexRef.current = i + 1;
          } else {
            interim = transcript;
          }
        }
        if (final) {
          console.log('startLive: Final transcript:', final);
          onTranscript(final);
        }
        if (interim) onInterim(interim);
        else if (final) onInterim('');
      };
      
      rec.onerror = (e) => { 
        console.error('Speech recognition error:', e.error, e);
        clearSilenceTimer();
        if (e.error === 'not-allowed') {
          setError('Microphone access denied');
        } else if (e.error === 'no-speech') {
          // No speech detected — just end gracefully
          console.log('startLive: No speech detected, stopping.');
          setIsListening(false);
          isListeningRef.current = false;
          recognitionRef.current = null;
          return;
        } else if (e.error === 'aborted') {
          console.log('startLive: Recognition aborted');
          return;
        } else if (e.error === 'network') {
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
        console.log('startLive: Recognition ended');
        clearSilenceTimer();
        
        // In continuous mode, if we're still supposed to be listening, restart
        if (isListeningRef.current && recognitionRef.current) {
          console.log('startLive: Restarting recognition for continuous mode...');
          try {
            recognitionRef.current.start();
          } catch (err) {
            console.log('startLive: Could not restart, likely stopped by user');
            recognitionRef.current = null;
            setIsListening(false);
            isListeningRef.current = false;
          }
        } else {
          // User stopped or error occurred
          recognitionRef.current = null;
          setIsListening(false);
          isListeningRef.current = false;
          onInterim(''); // Clear any leftover interim text
        }
      };

      recognitionRef.current = rec;
      lastFinalIndexRef.current = 0;
      lastFinalTextRef.current = '';
      console.log('startLive: Starting recognition...');
      rec.start();
      console.log('startLive: Recognition started (single-utterance mode)');
      setIsListening(true);
      isListeningRef.current = true;
      setMode('live');
      setError(null);
      // Safety timeout: auto-stop after 30s max in case something hangs
      resetSilenceTimer(30000);
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
      
      let mimeType = 'audio/webm';
      if (!browser.supportsWebm || !MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/wav')) mimeType = 'audio/wav';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }
      
      const recorderOptions = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];
      
      mr.ondataavailable = (e) => { 
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mr.onstop = async () => {
        console.log('startWhisper: Recording stopped, processing...');
        stream.getTracks().forEach(t => t.stop());
        const actualMimeType = mr.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        
        let extension = 'webm';
        if (actualMimeType.includes('mp4')) extension = 'mp4';
        else if (actualMimeType.includes('wav')) extension = 'wav';
        else if (actualMimeType.includes('ogg')) extension = 'ogg';
        
        const form = new FormData();
        form.append('audio', blob, `recording.${extension}`);
        
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          const data = await res.json();
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
      mr.start();
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
    if (hasNativeSpeech) {
      console.log('Using native Web Speech API (single-utterance)');
      startLive();
    } else if (hasMediaRecorder) {
      console.log('Using Whisper fallback (MediaRecorder)');
      startWhisper();
    } else {
      setError('Voice input not supported in this browser. Please try Chrome, Edge, or Safari.');
    }
  }

  function stop() {
    clearSilenceTimer();
    if (mode === 'live' && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { console.error('Error stopping recognition:', e); }
      recognitionRef.current = null;
    } else if (mode === 'whisper' && mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    isListeningRef.current = false;
    lastFinalIndexRef.current = 0;
    lastFinalTextRef.current = '';
    onInterim(''); // Clear interim text
  }

  function toggle() {
    if (isListening) stop();
    else start();
  }

  return { isListening, toggle, mode, error, hasNativeSpeech, hasMediaRecorder };
}

export default useSpeechRecognition;
