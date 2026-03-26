'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import RealtimeVoiceChat to avoid SSR issues with WebRTC
const RealtimeVoiceChat = dynamic(
  () => import('@/app/chat/components/RealtimeVoiceChat'),
  { 
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="text-white">Loading voice chat...</div>
      </div>
    )
  }
);
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MessageErrorBoundary from '@/components/MessageErrorBoundary';
import {
  Plus, Mic, Send, Settings, ChevronLeft, ThumbsUp, ThumbsDown,
  MessageSquare, X, ChevronDown, Loader2, FileText, Globe,
  Image as ImageIcon, Paperclip, Search, Video, Download, RefreshCw, Play,
  MapPin, Upload, MoreVertical, Pencil, Trash2, Check, MessageCircle, Megaphone, ExternalLink, Shield, Brain, AudioWaveform,
  GitCompare, CheckCircle2, Clock, Zap, Sparkles, Film, ImagePlus, Palette, GalleryHorizontal,
  Cloud, Link2, HardDrive, AlertCircle, FileArchive, Newspaper, ChevronRight, LogOut, Copy, Edit3, Square, ArrowRight,
  Folder, FolderPlus, Share2, Users, UserPlus, ArrowLeft, Sun, Moon, Code, Bot
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { CloudUploadIcon, RobotIcon, FeedbackIcon, MicrophoneIcon, SendIcon, SparklesIcon, ImagePlusIcon, VideoIcon, LocationIcon, StopIcon, AttachIcon, PlusIcon } from '@/components/icons/SoulPrintIcons';
import InstallPrompt from '@/app/components/InstallPrompt';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileChat from '@/components/mobile/MobileChat';
import { useTheme } from '@/lib/providers/ThemeProvider';
import { useToast } from '@/hooks/use-toast';

// Image Generation Models (sorted by cost - cheapest first)
const IMAGE_MODELS = [
  { value: 'smart', label: '🧠 Dynamic Intelligence', provider: 'auto', cost: 0, costLabel: 'Auto', description: 'AI picks best model', isSmartMode: true },
  { value: 'seedream-5-lite', label: 'Seedream 5.0 Lite', provider: 'kie', cost: 5.5, costLabel: '$0.03', description: 'Fast & affordable' },
  { value: 'nano-banana', label: 'Nano Banana', provider: 'kie', cost: 10, costLabel: '$0.05', description: 'Gemini-powered' },
  { value: 'gpt4o-image', label: 'GPT-4o Image', provider: 'kie', cost: 20, costLabel: '$0.10', description: 'High quality text' },
  { value: 'flux-pro', label: 'Flux Pro', provider: 'kie', cost: 25, costLabel: '$0.13', description: 'Artistic styles' },
  { value: 'midjourney-v7', label: 'Midjourney V7', provider: 'kie', cost: 40, costLabel: '$0.20', description: 'Premium quality' },
  { value: 'gpt-image-1-5', label: 'GPT Image 1.5', provider: 'kie', cost: 50, costLabel: '$0.25', description: 'OpenAI flagship' },
];

// Video Generation Models (sorted by cost - cheapest first)
const VIDEO_MODELS = [
  { value: 'smart', label: '🧠 Dynamic Intelligence', provider: 'auto', cost: 0, costLabel: 'Auto', description: 'AI picks best model for your prompt', isSmartMode: true },
  { value: 'kling-3.0', label: 'Kling 3.0', provider: 'kie', cost: 20, costLabel: '$0.10/s', description: 'Fast, general purpose, 720p 5s' },
  { value: 'veo3', label: 'Veo 3.1', provider: 'google', cost: 35, costLabel: '$0.18/s', description: 'Cinematic 1080p, audio sync' },
  { value: 'runway-aleph', label: 'Runway Aleph', provider: 'runway', cost: 40, costLabel: '$0.20/s', description: 'Video-to-video editing & style' },
];

const MODELS = [
  // Dynamic Intelligence - AI auto-selects best model
  { value: 'smart', label: '🧠 Dynamic Intelligence', provider: 'auto', group: 'Dynamic', isSmartMode: true, description: 'AI picks the best model for your query' },
  // OpenAI
  { value: 'gpt-4o',       label: 'GPT-4o',             provider: 'openai',      group: 'OpenAI' },
  { value: 'gpt-4o-mini',  label: 'GPT-4o Mini',        provider: 'openai',      group: 'OpenAI' },
  { value: 'gpt-4.1',      label: 'GPT-4.1',            provider: 'openai',      group: 'OpenAI' },
  // Coming Soon - GPT-5 family
  { value: 'gpt-5.2',      label: 'GPT-5.2 (Coming Soon)',  provider: 'openai', group: 'OpenAI', comingSoon: true },
  { value: 'gpt-5',        label: 'GPT-5 (Coming Soon)',    provider: 'openai', group: 'OpenAI', comingSoon: true },
  { value: 'o3',           label: 'o3 (Coming Soon)',       provider: 'openai', group: 'OpenAI', comingSoon: true },
  { value: 'o3-mini',      label: 'o3 Mini (Coming Soon)',  provider: 'openai', group: 'OpenAI', comingSoon: true },
  // Anthropic
  { value: 'claude-opus-4-5-20251101',   label: 'Claude Opus 4.5',   provider: 'anthropic', group: 'Claude' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', provider: 'anthropic', group: 'Claude' },
  { value: 'claude-3-5-haiku-20241022',  label: 'Claude Haiku 3.5',  provider: 'anthropic', group: 'Claude' },
  // Google Gemini
  { value: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   provider: 'gemini', group: 'Gemini' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash',  provider: 'gemini', group: 'Gemini' },
  // Perplexity
  { value: 'sonar-pro',       label: 'Sonar Pro (Online)', provider: 'perplexity', group: 'Perplexity' },
  { value: 'sonar',           label: 'Sonar (Online)',     provider: 'perplexity', group: 'Perplexity' },
  { value: 'sonar-reasoning', label: 'Sonar Reasoning',    provider: 'perplexity', group: 'Perplexity' },
  // Kimi
  { value: 'kimi-k2-0711-preview', label: 'Kimi K2 (Flagship)', provider: 'kimi', group: 'Kimi' },
  { value: 'moonshot-v1-32k',      label: 'Moonshot 32k',       provider: 'kimi', group: 'Kimi' },
  { value: 'moonshot-v1-8k',       label: 'Moonshot 8k (Fast)', provider: 'kimi', group: 'Kimi' },
];

// Telegram model list — same as MODELS, used in Settings modal
const TELEGRAM_MODELS = MODELS;

const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.txt,.md,.csv,.json,.docx';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Speech recognition hook ─────────────────────────────────────────────────
function useSpeechRecognition({ onTranscript, onInterim, token }) {
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false); // Ref to track listening state for callbacks
  const [mode, setMode] = useState(null); // 'live' | 'whisper'
  const [error, setError] = useState(null);

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
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        if (final) {
          console.log('startLive: Final transcript:', final);
          onTranscript(final);
        }
        if (interim) onInterim(interim);
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
            setTimeout(() => {
              if (isListeningRef.current && recognitionRef.current) {
                console.log('startLive: Auto-restarting recognition');
                recognitionRef.current.start();
              }
            }, 100);
          } catch (e) {
            console.error('Failed to restart recognition:', e);
            setIsListening(false);
            isListeningRef.current = false;
          }
        }
      };

      recognitionRef.current = rec;
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
  }

  function toggle() {
    if (isListening) stop();
    else start();
  }

  return { isListening, toggle, mode, error, hasNativeSpeech, hasMediaRecorder };
}
// ─────────────────────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0,1,2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-orange-500/60 typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

// Convert file to processable data
async function processFile(file) {
  const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
  const isImage = file.type.startsWith('image/') || isHeic;
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isDOCX = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                 file.name.toLowerCase().endsWith('.docx');
  
  if (isImage) {
    let fileToRead = file;
    
    // Convert HEIC/HEIF to JPEG for browser compatibility
    if (isHeic) {
      try {
        const heic2any = (await import('heic2any')).default;
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        fileToRead = Array.isArray(blob) ? blob[0] : blob;
      } catch (err) {
        console.error('HEIC conversion failed:', err);
        // Fallback: try reading as-is
      }
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        const mimeType = isHeic ? 'image/jpeg' : file.type;
        resolve({ type: 'image', base64, mimeType, name: file.name });
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileToRead);
    });
  } else if (isPDF || isDOCX) {
    // Parse PDF/DOCX on the server
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('sp_token');
      const res = await fetch('/api/parse/document', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to parse document');
      }
      
      const data = await res.json();
      
      // Check if this is an image-based PDF that was converted to PNG
      if (data.metadata?.imageBasedPdf && data.metadata?.base64) {
        // Return as image type so it gets sent to vision model
        return { 
          type: 'image',
          base64: data.metadata.base64,
          mimeType: data.metadata.convertedMimeType || 'image/png',
          name: file.name,
          isImageBasedPdf: true,
          text: data.text || '' // Keep the indicator text
        };
      }
      
      return { 
        type: 'document', 
        text: data.text || '', 
        name: file.name, 
        mimeType: file.type,
        metadata: data.metadata 
      };
    } catch (err) {
      console.error('Document parse error:', err);
      // Fallback: return empty text with error indication
      return { 
        type: 'document', 
        text: `[Error reading ${file.name}: ${err.message}]`, 
        name: file.name, 
        mimeType: file.type 
      };
    }
  } else {
    // Text-based documents — read as text
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({ type: 'document', text: e.target.result?.slice(0, 20000) || '', name: file.name, mimeType: file.type });
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}

// ── VideoCard: polls for video status and renders player when ready ──────────
function VideoCard({ taskId, prompt, token, initialStatus = 'generating', modelLabel, messageId, onVideoReady, videoModelReason, onCancel, onRegenerateWith, sourceImageUrl }) {
  const [status, setStatus] = useState(initialStatus);
  const [videoUrl, setVideoUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [error, setError] = useState(null);
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const pollRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const onVideoReadyRef = useRef(onVideoReady);
  const cancelledRef = useRef(false);
  useEffect(() => { onVideoReadyRef.current = onVideoReady; }, [onVideoReady]);

  // Available video models for regeneration
  const VIDEO_MODELS_LIST = [
    { id: 'kling-3.0', label: 'Kling 3.0', description: 'Fast, general purpose' },
    { id: 'veo3', label: 'Veo 3.1', description: 'Cinematic, 1080p' },
    { id: 'runway-aleph', label: 'Runway Aleph', description: 'Creative, artistic' },
  ];

  const handleCancel = () => {
    cancelledRef.current = true;
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    setStatus('cancelled');
    if (onCancel) onCancel(taskId);
  };

  const handleRegenerateWith = (modelId) => {
    setShowModelPicker(false);
    if (onRegenerateWith) {
      // Pass media context for image-to-video regeneration
      onRegenerateWith(prompt, modelId, {
        type: 'video',
        sourceImageUrl: sourceImageUrl,
        videoUrl: videoUrl
      });
    }
  };

  useEffect(() => {
    if (status === 'success' || status === 'failed' || status === 'cancelled') return;
    const poll = async () => {
      if (cancelledRef.current) return;
      try {
        const res = await fetch(`/api/media/status/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (cancelledRef.current) return;
        if (d.status === 'success' || d.status === 'completed') {
          const vUrl = d.videoUrl || d.url;
          const tUrl = d.thumbnailUrl || d.thumbnail_url;
          setStatus('success');
          setVideoUrl(vUrl);
          setThumbnailUrl(tUrl);
          setProgress(100);
          clearInterval(pollRef.current);
          // Persist video_url to the message in DB so it survives navigation
          if (messageId && vUrl) {
            fetch(`/api/messages/${messageId}/video-complete`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ video_url: vUrl, thumbnail_url: tUrl }),
            }).catch(() => {});
          }
          if (onVideoReadyRef.current) onVideoReadyRef.current(vUrl);
        } else if (d.status === 'failed') {
          setStatus('failed');
          setError(d.error || 'Generation failed');
          clearInterval(pollRef.current);
        } else {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const estimatedProgress = Math.min(90, Math.round((elapsed / 120) * 90));
          setProgress(estimatedProgress);
        }
      } catch (e) {}
    };
    poll();
    pollRef.current = setInterval(poll, 6000);
    return () => clearInterval(pollRef.current);
  }, [taskId, status, token, messageId]);

  const saveToGallery = async () => {
    if (saving || savedToGallery || !videoUrl) return;
    setSaving(true);
    try {
      const res = await fetch('/api/media/save-to-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url: videoUrl,
          prompt: prompt || '',
          model: modelLabel || 'unknown',
          modelLabel: modelLabel || 'AI Generated',
          type: 'video',
        }),
      });
      if (res.ok) setSavedToGallery(true);
    } catch (e) {
      console.error('Failed to save video to gallery:', e);
    } finally {
      setSaving(false);
    }
  };

  if (status === 'success' && videoUrl) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#141a21]">
        <div className="relative group bg-black">
          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full max-h-96 object-contain"
            poster={thumbnailUrl || undefined}
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" /> Generated with {modelLabel || 'AI'}
              </p>
              {prompt && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{prompt}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={saveToGallery}
                disabled={saving || savedToGallery}
                className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs rounded-lg transition-colors whitespace-nowrap ${
                  savedToGallery 
                    ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                    : saving
                      ? 'bg-white/5 border-white/10 text-gray-500 cursor-wait'
                      : 'bg-purple-500/15 border-purple-500/30 text-purple-400 hover:bg-purple-500/25'
                }`}
              >
                {savedToGallery ? <><Check className="w-3.5 h-3.5" /> Saved</> : saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><GalleryHorizontal className="w-3.5 h-3.5" /> Gallery</>}
              </button>
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" download
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-lg hover:bg-orange-500/25 transition-colors whitespace-nowrap">
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          </div>
          {/* Try Different Model */}
          {onRegenerateWith && (
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-lg hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Different Model
              </button>
              {showModelPicker && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f26] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                  {VIDEO_MODELS_LIST.filter(m => m.label !== modelLabel).map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleRegenerateWith(model.id)}
                      className="w-full px-3 py-2.5 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                    >
                      <p className="text-xs font-medium text-white">{model.label}</p>
                      <p className="text-[10px] text-gray-500">{model.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="mt-3 rounded-xl border border-gray-500/20 bg-gray-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-500/15 flex items-center justify-center flex-shrink-0">
            <Square className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400">Video generation cancelled</p>
            <p className="text-[10px] text-gray-500 mt-0.5">You stopped this generation</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-red-400">Video generation failed</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Generating state — animated loading card matching image generation UX
  return (
    <div className="mt-3 rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-purple-500/5 p-4 overflow-hidden relative">
      {/* Animated background shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-pulse" />
      <div className="relative">
        {/* Video preview placeholder */}
        <div className="aspect-video rounded-lg bg-black/30 border border-white/5 mb-3 flex items-center justify-center overflow-hidden">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-2">
              <Film className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
            <p className="text-xs font-medium text-blue-400">Creating your video...</p>
            <p className="text-[10px] text-gray-600 mt-1">{modelLabel || 'AI'}</p>
          </div>
        </div>
        {/* Model selection reason badge */}
        {videoModelReason && (
          <div className="mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" />
            <p className="text-[10px] text-purple-300/80 truncate">
              <span className="font-medium text-purple-300">Dynamic Intelligence:</span> {videoModelReason}
            </p>
          </div>
        )}
        {/* Progress bar */}
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-2">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
            <p className="text-[11px] text-gray-400">
              {progress < 30 ? 'Queuing...' : progress < 60 ? 'Rendering frames...' : progress < 90 ? 'Almost done...' : 'Finalizing...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-gray-600">~1-3 min</p>
            <button
              onClick={handleCancel}
              className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-700 mt-2 truncate italic">"{prompt}"</p>
        {/* Leave notification hint */}
        <div className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
          <span className="text-[10px]">💡</span>
          <p className="text-[10px] text-cyan-400/70">You can leave this chat — we'll notify you when it's ready.</p>
        </div>
      </div>
    </div>
  );
}

// ── SavedVideoCard: renders a saved video with matching image card UX ────────
function SavedVideoCard({ videoUrl, modelLabel, prompt, token, onRegenerateWith, sourceImageUrl }) {
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Available video models for regeneration
  const VIDEO_MODELS_LIST = [
    { id: 'kling-3.0', label: 'Kling 3.0', description: 'Fast, general purpose' },
    { id: 'veo3', label: 'Veo 3.1', description: 'Cinematic, 1080p' },
    { id: 'runway-aleph', label: 'Runway Aleph', description: 'Creative, artistic' },
  ];

  const saveToGallery = async () => {
    if (saving || savedToGallery || !videoUrl) return;
    setSaving(true);
    try {
      const res = await fetch('/api/media/save-to-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url: videoUrl,
          prompt: prompt || '',
          model: modelLabel || 'unknown',
          modelLabel: modelLabel || 'AI Generated',
          type: 'video',
        }),
      });
      if (res.ok) setSavedToGallery(true);
    } catch (e) {
      console.error('Failed to save video to gallery:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateWith = (modelId) => {
    setShowModelPicker(false);
    const actualPrompt = prompt || 'Regenerate this video';
    if (onRegenerateWith) {
      // Pass media context for regeneration
      onRegenerateWith(actualPrompt, modelId, {
        type: 'video',
        sourceImageUrl: sourceImageUrl,
        videoUrl: videoUrl
      });
    }
  };

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#141a21]">
      <div className="relative group bg-black">
        <video
          src={videoUrl}
          controls
          playsInline
          className="w-full max-h-60 sm:max-h-96 object-contain"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" /> {modelLabel ? `Generated with ${modelLabel}` : 'Video'}
            </p>
            {prompt && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{prompt}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={saveToGallery}
              disabled={saving || savedToGallery}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 border text-[11px] sm:text-xs rounded-lg transition-colors whitespace-nowrap ${
                savedToGallery 
                  ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                  : saving
                    ? 'bg-white/5 border-white/10 text-gray-500 cursor-wait'
                    : 'bg-purple-500/15 border-purple-500/30 text-purple-400 hover:bg-purple-500/25'
              }`}
            >
              {savedToGallery ? <><Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Saved</> : saving ? <><Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" /> ...</> : <><GalleryHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Gallery</>}
            </button>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" download
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[11px] sm:text-xs rounded-lg hover:bg-orange-500/25 transition-colors whitespace-nowrap">
              <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Download
            </a>
          </div>
        </div>
        {/* Try Different Model */}
        {onRegenerateWith && prompt && (
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-lg hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Different Model
            </button>
            {showModelPicker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f26] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                {VIDEO_MODELS_LIST.filter(m => !modelLabel?.toLowerCase().includes(m.label.toLowerCase().split(' ')[0])).map(model => (
                  <button
                    key={model.id}
                    onClick={() => handleRegenerateWith(model.id)}
                    className="w-full px-3 py-2.5 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                  >
                    <p className="text-xs font-medium text-white">{model.label}</p>
                    <p className="text-[10px] text-gray-500">{model.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ── ImageEditor: Canvas-based image editing with mask drawing ─────────────────
function ImageEditor({ image, onClose, onEdit, isEditing }) {
  const containerRef = useRef(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [overlayImage, setOverlayImage] = useState(null); // { base64, mimeType, name }
  const fileInputRef = useRef(null);
  
  const imgSrc = image?.base64 ? `data:image/png;base64,${image.base64}` : image?.url;
  
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      setOverlayImage({
        base64,
        mimeType: file.type || 'image/png',
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };
  
  const handleEdit = () => {
    if (!editPrompt.trim()) return;
    onEdit({
      prompt: editPrompt,
      overlayImage: overlayImage || null,
      hasMask: false,
      maskDataUrl: null,
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-[#111820] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-white">Edit Image</h3>
              <p className="text-[10px] sm:text-xs text-gray-500">Describe changes or add a logo/image</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Image Preview */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="relative mx-auto rounded-xl overflow-hidden border border-white/20 bg-black/30 max-w-md">
            {imgSrc && (
              <img 
                src={imgSrc} 
                alt="Edit" 
                className="w-full h-auto max-h-[40vh] sm:max-h-[45vh] object-contain"
                crossOrigin="anonymous"
              />
            )}
            
            {/* Overlay image preview */}
            {overlayImage && (
              <div className="absolute bottom-2 right-2 bg-black/70 rounded-lg p-1 border border-white/20">
                <img 
                  src={overlayImage.base64} 
                  alt="Overlay" 
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded"
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); setOverlayImage(null); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            )}
            
            {/* Loading overlay */}
            {isEditing && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                  <p className="text-white text-sm font-medium">
                    {overlayImage ? 'Creating mockup...' : 'Editing image...'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">This takes 10-20 seconds</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Upload overlay image button */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isEditing}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {overlayImage ? 'Change Logo/Image' : 'Add Logo/Image'}
            </button>
            {overlayImage && (
              <span className="text-xs text-purple-400 truncate max-w-[120px] sm:max-w-[200px]">
                {overlayImage.name}
              </span>
            )}
          </div>
          
          {overlayImage && (
            <p className="text-center text-green-400/70 text-[10px] sm:text-xs mt-1.5">
              ✓ Logo/image attached — describe where to place it below
            </p>
          )}
        </div>
        
        {/* Edit Prompt & Actions */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-black/20 shrink-0">
          <div className="flex gap-2 sm:gap-3">
            <input
              type="text"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleEdit()}
              placeholder={overlayImage 
                ? "e.g., 'Place this logo on both t-shirts'" 
                : "e.g., 'Remove the hat', 'Make the sky sunset'"}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              disabled={isEditing}
            />
            <button
              onClick={handleEdit}
              disabled={!editPrompt.trim() || isEditing}
              className="px-4 py-2.5 sm:px-6 sm:py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center gap-1.5 sm:gap-2 transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              {isEditing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> <span className="hidden sm:inline">Editing...</span></>
              ) : (
                <><Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">Apply</span></>
              )}
            </button>
          </div>
          <p className="text-gray-600 text-[10px] sm:text-xs mt-1.5 text-center">
            {overlayImage ? 'AI will blend the logo/image naturally into the photo' : 'Powered by Gemini AI — describe any edit you want'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── MockupGenerator: Create product mockups with uploaded designs ─────────────
const MOCKUP_TEMPLATES = [
  // Apparel
  { id: 'tshirt-front', name: 'T-Shirt (Front)', category: 'Apparel', emoji: '👕', 
    placement: { x: 0.3, y: 0.25, width: 0.4, height: 0.35 } },
  { id: 'tshirt-back', name: 'T-Shirt (Back)', category: 'Apparel', emoji: '👕',
    placement: { x: 0.3, y: 0.2, width: 0.4, height: 0.4 } },
  { id: 'hoodie-front', name: 'Hoodie (Front)', category: 'Apparel', emoji: '🧥',
    placement: { x: 0.32, y: 0.35, width: 0.36, height: 0.3 } },
  { id: 'hat-front', name: 'Baseball Cap', category: 'Apparel', emoji: '🧢',
    placement: { x: 0.25, y: 0.3, width: 0.5, height: 0.35 } },
  // Drinkware  
  { id: 'mug-center', name: 'Coffee Mug', category: 'Drinkware', emoji: '☕',
    placement: { x: 0.15, y: 0.25, width: 0.7, height: 0.5 } },
  { id: 'tumbler', name: 'Tumbler', category: 'Drinkware', emoji: '🥤',
    placement: { x: 0.2, y: 0.15, width: 0.6, height: 0.7 } },
  { id: 'water-bottle', name: 'Water Bottle', category: 'Drinkware', emoji: '🍶',
    placement: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 } },
  // Print
  { id: 'book-cover', name: 'Book Cover', category: 'Print', emoji: '📕',
    placement: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } },
  { id: 'poster', name: 'Poster/Print', category: 'Print', emoji: '🖼️',
    placement: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 } },
  { id: 'business-card', name: 'Business Card', category: 'Print', emoji: '💳',
    placement: { x: 0.1, y: 0.15, width: 0.8, height: 0.7 } },
  // Tech
  { id: 'phone-case', name: 'Phone Case', category: 'Tech', emoji: '📱',
    placement: { x: 0.1, y: 0.15, width: 0.8, height: 0.7 } },
  { id: 'laptop-sleeve', name: 'Laptop Sleeve', category: 'Tech', emoji: '💻',
    placement: { x: 0.15, y: 0.2, width: 0.7, height: 0.6 } },
  { id: 'tote-bag', name: 'Tote Bag', category: 'Other', emoji: '👜',
    placement: { x: 0.2, y: 0.25, width: 0.6, height: 0.5 } },
];

function MockupGenerator({ design, onClose, onGenerate, isGenerating, token }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Apparel');
  const [customProduct, setCustomProduct] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  
  // Design placement state
  const [designPosition, setDesignPosition] = useState({ x: 0.3, y: 0.25 });
  const [designSize, setDesignSize] = useState({ width: 0.4, height: 0.4 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const previewRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });
  
  // Categories for filtering
  const categories = ['Apparel', 'Drinkware', 'Print', 'Tech', 'Other'];
  
  // Update position when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setDesignPosition({ x: selectedTemplate.placement.x, y: selectedTemplate.placement.y });
      setDesignSize({ width: selectedTemplate.placement.width, height: selectedTemplate.placement.height });
    }
  }, [selectedTemplate]);
  
  const handleMouseDown = (e, type) => {
    e.preventDefault();
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    if (type === 'drag') {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - (designPosition.x * rect.width),
        y: e.clientY - (designPosition.y * rect.height)
      };
    } else if (type === 'resize') {
      setIsResizing(true);
      dragStart.current = { x: e.clientX, y: e.clientY, ...designSize };
    }
  };
  
  const handleMouseMove = (e) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    if (isDragging) {
      const newX = Math.max(0, Math.min(1 - designSize.width, (e.clientX - dragStart.current.x) / rect.width));
      const newY = Math.max(0, Math.min(1 - designSize.height, (e.clientY - dragStart.current.y) / rect.height));
      setDesignPosition({ x: newX, y: newY });
    } else if (isResizing) {
      const deltaX = (e.clientX - dragStart.current.x) / rect.width;
      const deltaY = (e.clientY - dragStart.current.y) / rect.height;
      const newWidth = Math.max(0.1, Math.min(1 - designPosition.x, dragStart.current.width + deltaX));
      const newHeight = Math.max(0.1, Math.min(1 - designPosition.y, dragStart.current.height + deltaY));
      setDesignSize({ width: newWidth, height: newHeight });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };
  
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing]);
  
  const handleGenerate = () => {
    const productName = useCustom ? customProduct : selectedTemplate?.name;
    if (!productName) return;
    
    onGenerate({
      template: selectedTemplate,
      productName,
      isCustom: useCustom,
      position: designPosition,
      size: designSize,
    });
  };
  
  const designSrc = design?.base64 
    ? `data:${design.mimeType || 'image/png'};base64,${design.base64}` 
    : design?.url;
  
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">🎨</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Mockup Generator</h3>
              <p className="text-xs text-gray-500">Place your design on products</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Product Selection */}
          <div className="w-72 border-r border-white/10 flex flex-col overflow-hidden">
            {/* Category tabs */}
            <div className="p-3 border-b border-white/10 flex flex-wrap gap-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setUseCustom(false); }}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                    activeCategory === cat && !useCustom
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                onClick={() => setUseCustom(true)}
                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                  useCustom
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Custom
              </button>
            </div>
            
            {/* Product list or custom input */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {useCustom ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">Describe any product and AI will generate a mockup:</p>
                  <textarea
                    value={customProduct}
                    onChange={e => setCustomProduct(e.target.value)}
                    placeholder="e.g., white ceramic plate, canvas shopping bag, throw pillow..."
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 resize-none"
                  />
                </div>
              ) : (
                MOCKUP_TEMPLATES
                  .filter(t => t.category === activeCategory)
                  .map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'bg-orange-500/20 border-orange-500/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{template.emoji}</span>
                        <span className="text-sm text-white">{template.name}</span>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
          
          {/* Right: Preview & Controls */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Preview area */}
            <div className="flex-1 p-6 flex items-center justify-center bg-[#0a0e12] overflow-hidden">
              <div 
                ref={previewRef}
                className="relative bg-gray-800 rounded-xl overflow-hidden"
                style={{ width: '400px', height: '400px' }}
              >
                {/* Product background placeholder */}
                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                  {selectedTemplate ? (
                    <span className="text-8xl opacity-20">{selectedTemplate.emoji}</span>
                  ) : useCustom && customProduct ? (
                    <span className="text-6xl opacity-20">🎨</span>
                  ) : (
                    <span className="text-sm">Select a product</span>
                  )}
                </div>
                
                {/* Design overlay - draggable */}
                {designSrc && (selectedTemplate || (useCustom && customProduct)) && (
                  <div
                    className={`absolute cursor-move border-2 ${isDragging || isResizing ? 'border-orange-500' : 'border-dashed border-orange-500/50'} rounded-lg overflow-hidden`}
                    style={{
                      left: `${designPosition.x * 100}%`,
                      top: `${designPosition.y * 100}%`,
                      width: `${designSize.width * 100}%`,
                      height: `${designSize.height * 100}%`,
                    }}
                    onMouseDown={e => handleMouseDown(e, 'drag')}
                  >
                    <img 
                      src={designSrc} 
                      alt="Design" 
                      className="w-full h-full object-contain pointer-events-none"
                      draggable={false}
                    />
                    {/* Resize handle */}
                    <div
                      className="absolute bottom-0 right-0 w-4 h-4 bg-orange-500 cursor-se-resize rounded-tl-lg"
                      onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, 'resize'); }}
                    />
                  </div>
                )}
                
                {/* Generating overlay */}
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-2" />
                      <p className="text-white text-sm">Generating mockup...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Controls */}
            <div className="p-4 border-t border-white/10 bg-black/20">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-gray-500">
                  {selectedTemplate || (useCustom && customProduct)
                    ? 'Drag to position • Corner to resize'
                    : 'Select a product to preview'}
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={(!selectedTemplate && !customProduct) || isGenerating}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center gap-2 transition-all"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate Mockup</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ImageCard: renders a generated image with download option ─────────────────
function ImageCard({ url, revisedPrompt, modelLabel, generationParams, onEdit, onRegenerateWith }) {
  const [loaded, setLoaded] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Available image models for regeneration
  const IMAGE_MODELS_LIST = [
    { id: 'nano-banana', label: 'Nano Banana', description: 'Fast, versatile' },
    { id: 'gemini-2.0-flash-exp-image-generation', label: 'Gemini Image', description: 'High quality' },
    { id: 'gpt-image-1', label: 'GPT Image', description: 'Creative, detailed' },
  ];
  
  // Build the JSON object for this generation
  const jsonData = {
    type: 'image',
    model: generationParams?.model || modelLabel || 'unknown',
    prompt: generationParams?.prompt || revisedPrompt || '',
    revisedPrompt: revisedPrompt || '',
    aspectRatio: generationParams?.aspectRatio || '1:1',
    generatedAt: generationParams?.generatedAt || new Date().toISOString(),
    imageUrl: url,
  };
  
  const jsonString = JSON.stringify(jsonData, null, 2);
  
  const copyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };
  
  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `soulprint-image-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };
  
  const saveToGallery = async () => {
    if (saving || savedToGallery) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/media/save-to-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url,
          prompt: revisedPrompt || '',
          model: generationParams?.model || modelLabel || 'unknown',
          modelLabel: modelLabel || 'AI Generated',
        }),
      });
      if (res.ok) {
        setSavedToGallery(true);
      }
    } catch (e) {
      console.error('Failed to save to gallery:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateWith = (modelId) => {
    setShowModelPicker(false);
    const originalPrompt = generationParams?.prompt || revisedPrompt || 'Regenerate this image';
    if (onRegenerateWith) {
      // Pass image URL for regeneration context
      onRegenerateWith(originalPrompt, modelId, {
        type: 'image',
        imageUrl: url
      });
    }
  };
  
  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#141a21]">
      <div className="relative group">
        {!loaded && (
          <div className="w-full h-48 flex items-center justify-center bg-white/3">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500/50" />
          </div>
        )}
        <img
          src={url}
          alt={revisedPrompt || 'Generated image'}
          className={`w-full max-h-96 object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
          onLoad={() => setLoaded(true)}
        />
        {/* Edit button - visible on mobile, hover on desktop */}
        {onEdit && loaded && (
          <button
            onClick={() => onEdit({ url, source: 'generated' })}
            className="absolute top-2 right-2 px-3 py-1.5 bg-purple-500/90 hover:bg-purple-600 text-white text-xs rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all flex items-center gap-1.5 shadow-lg backdrop-blur-sm"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Generated with {modelLabel || 'AI'}
            </p>
            {revisedPrompt && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{revisedPrompt}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={saveToGallery}
              disabled={saving || savedToGallery}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs rounded-lg transition-colors whitespace-nowrap ${
                savedToGallery 
                  ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                  : saving
                    ? 'bg-white/5 border-white/10 text-gray-500 cursor-wait'
                    : 'bg-purple-500/15 border-purple-500/30 text-purple-400 hover:bg-purple-500/25'
              }`}
            >
              {savedToGallery ? <><Check className="w-3.5 h-3.5" /> Saved</> : saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><GalleryHorizontal className="w-3.5 h-3.5" /> Gallery</>}
            </button>
            <button
              onClick={() => setShowJson(!showJson)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs rounded-lg transition-colors whitespace-nowrap ${
                showJson 
                  ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Code className="w-3.5 h-3.5" /> JSON
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-lg hover:bg-orange-500/25 transition-colors whitespace-nowrap">
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          </div>
        </div>
        
        {/* Try Different Model */}
        {onRegenerateWith && (generationParams?.prompt || revisedPrompt) && (
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-lg hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Different Model
            </button>
            {showModelPicker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f26] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                {IMAGE_MODELS_LIST.filter(m => !modelLabel?.toLowerCase().includes(m.label.toLowerCase().split(' ')[0])).map(model => (
                  <button
                    key={model.id}
                    onClick={() => handleRegenerateWith(model.id)}
                    className="w-full px-3 py-2.5 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                  >
                    <p className="text-xs font-medium text-white">{model.label}</p>
                    <p className="text-[10px] text-gray-500">{model.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* JSON Panel */}
        {showJson && (
          <div className="bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/3">
              <span className="text-[10px] text-gray-500 font-mono">Generation Parameters</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyJson}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                    jsonCopied 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {jsonCopied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
                <button
                  onClick={downloadJson}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] bg-white/5 text-gray-400 hover:bg-white/10 rounded transition-colors"
                >
                  <Download className="w-3 h-3" /> Download
                </button>
              </div>
            </div>
            <pre className="p-3 text-[10px] text-gray-400 font-mono overflow-x-auto max-h-48 overflow-y-auto">
              {jsonString}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CompareResponseCard: Displays a single model's response in comparison mode ──
function CompareResponseCard({ response, onSelect, isLoading, selected, totalModels = 2 }) {
  const { model, provider, label, group, content, duration, success, error, usedSearch } = response || {};
  
  // Color coding by provider
  const getProviderColor = (prov) => {
    switch (prov) {
      case 'openai': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'anthropic': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'gemini': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'perplexity': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
      case 'kimi': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };
  
  const providerColorClass = getProviderColor(provider);
  
  // Dynamic height based on number of models - more height when fewer models
  const contentMaxHeight = totalModels <= 2 ? 'max-h-[400px]' : 'max-h-[300px]';
  
  if (isLoading) {
    return (
      <div className={`rounded-xl border ${providerColorClass.split(' ')[1]} ${providerColorClass.split(' ')[2]} p-5 flex-1 min-w-0`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${providerColorClass.split(' ')[0]}`}>{group}</span>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400">{label}</span>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-4/5" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-3/5" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-2/3" />
        </div>
      </div>
    );
  }
  
  if (!success) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-red-400">{group}</span>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400">{label}</span>
          </div>
          <X className="w-5 h-5 text-red-400" />
        </div>
        <p className="text-sm text-red-400">Failed: {error || 'Unknown error'}</p>
      </div>
    );
  }
  
  return (
    <div className={`rounded-xl border ${selected ? 'border-orange-500 ring-2 ring-orange-500/30' : providerColorClass.split(' ')[1]} ${providerColorClass.split(' ')[2]} p-5 flex-1 min-w-0 flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${providerColorClass.split(' ')[0]}`}>{group}</span>
          <span className="text-gray-600">/</span>
          <span className="text-sm text-gray-400">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {usedSearch && (
            <span className="flex items-center gap-1 text-xs text-cyan-400" title="Web search was used">
              <Globe className="w-3.5 h-3.5" /> Search
            </span>
          )}
          {duration && (
            <span className="flex items-center gap-1 text-xs text-gray-500" title={`Response time: ${(duration / 1000).toFixed(1)}s`}>
              <Clock className="w-3.5 h-3.5" />
              {(duration / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
      
      {/* Content - larger text and more height */}
      <div className={`flex-1 overflow-y-auto ${contentMaxHeight} mb-4 text-base text-gray-200 leading-7 prose prose-invert prose-base prose-p:my-3 prose-headings:my-4 prose-ul:my-3 prose-li:my-1.5 prose-code:text-orange-300`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ''}</ReactMarkdown>
      </div>
      
      {/* Select Button */}
      <button
        onClick={() => onSelect(response)}
        disabled={selected}
        className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 flex-shrink-0 ${
          selected 
            ? 'bg-orange-500 text-white cursor-default' 
            : 'bg-white/5 border border-white/10 text-white hover:bg-orange-500/20 hover:border-orange-500/50'
        }`}
      >
        {selected ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Selected
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Use this response
          </>
        )}
      </button>
    </div>
  );
}

// ── CompareModePicker: Multi-select model picker for comparison mode ──────────
function CompareModePicker({ selectedModels, setSelectedModels, maxModels = 3 }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleModel = (model) => {
    const modelConfig = { model: model.value, provider: model.provider };
    const isSelected = selectedModels.some(m => m.model === model.value);
    
    if (isSelected) {
      setSelectedModels(prev => prev.filter(m => m.model !== model.value));
    } else if (selectedModels.length < maxModels) {
      setSelectedModels(prev => [...prev, modelConfig]);
    }
  };
  
  const getProviderBadgeColor = (provider) => {
    switch (provider) {
      case 'openai': return 'bg-green-500/20 text-green-400';
      case 'anthropic': return 'bg-blue-500/20 text-blue-400';
      case 'gemini': return 'bg-blue-500/20 text-blue-400';
      case 'perplexity': return 'bg-cyan-500/20 text-cyan-400';
      case 'kimi': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <GitCompare className="w-4 h-4 text-orange-400" />
        <span className="text-gray-300">
          {selectedModels.length === 0 
            ? 'Select models to compare' 
            : `${selectedModels.length} model${selectedModels.length > 1 ? 's' : ''} selected`}
        </span>
        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Selected model badges */}
      {selectedModels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedModels.map(sm => {
            const modelInfo = MODELS.find(m => m.value === sm.model);
            return (
              <span 
                key={sm.model}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${getProviderBadgeColor(sm.provider)}`}
              >
                {modelInfo?.label || sm.model}
                <button 
                  onClick={() => toggleModel({ value: sm.model, provider: sm.provider })}
                  className="hover:bg-white/10 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 bg-[#141a21] border border-white/10 rounded-xl p-2 shadow-2xl min-w-[280px] z-20 max-h-80 overflow-y-auto">
          <p className="text-[10px] text-gray-600 px-2 mb-2">
            Select up to {maxModels} models to compare • {maxModels - selectedModels.length} remaining
          </p>
          {['OpenAI', 'Claude', 'Gemini', 'Perplexity', 'Kimi'].map(group => {
            const groupModels = MODELS.filter(m => m.group === group);
            if (!groupModels.length) return null;
            return (
              <div key={group}>
                <div className="px-2 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider mt-1">{group}</div>
                {groupModels.map(m => {
                  const isSelected = selectedModels.some(sm => sm.model === m.value);
                  const isDisabled = !isSelected && selectedModels.length >= maxModels;
                  return (
                    <button 
                      key={m.value} 
                      onClick={() => toggleModel(m)}
                      disabled={isDisabled}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                        isSelected 
                          ? 'bg-orange-500/15 text-orange-400' 
                          : isDisabled 
                            ? 'text-gray-700 cursor-not-allowed' 
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{m.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CreateMenu: Dropdown for Image/Video generation ──────────────────────────
function CreateMenu({ onGenerate, isGenerating }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('image'); // 'image' or 'video'
  const [selectedImageModel, setSelectedImageModel] = useState(IMAGE_MODELS[0].value);
  const [selectedVideoModel, setSelectedVideoModel] = useState(VIDEO_MODELS[0].value);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [loadedFromJson, setLoadedFromJson] = useState(false);
  const jsonInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const model = activeTab === 'image' ? selectedImageModel : selectedVideoModel;
    onGenerate({
      type: activeTab,
      model,
      prompt: prompt.trim(),
      aspectRatio,
    });
    setPrompt('');
    setLoadedFromJson(false);
    setIsOpen(false);
  };

  // Handle JSON file upload to pre-fill generation params
  const handleJsonUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        
        // Validate it's an image generation JSON
        if (json.type === 'image' || json.prompt) {
          setActiveTab('image');
          
          // Set prompt
          if (json.prompt) setPrompt(json.prompt);
          
          // Set model if it matches available models
          if (json.model && IMAGE_MODELS.some(m => m.value === json.model)) {
            setSelectedImageModel(json.model);
          }
          
          // Set aspect ratio
          if (json.aspectRatio && ['1:1', '16:9', '9:16', '4:3'].includes(json.aspectRatio)) {
            setAspectRatio(json.aspectRatio);
          }
          
          setLoadedFromJson(true);
        } else if (json.type === 'video') {
          setActiveTab('video');
          if (json.prompt) setPrompt(json.prompt);
          if (json.model && VIDEO_MODELS.some(m => m.value === json.model)) {
            setSelectedVideoModel(json.model);
          }
          setLoadedFromJson(true);
        } else {
          alert('Invalid JSON format. Expected an image/video generation config.');
        }
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const currentImageModel = IMAGE_MODELS.find(m => m.value === selectedImageModel) || IMAGE_MODELS[0];
  const currentVideoModel = VIDEO_MODELS.find(m => m.value === selectedVideoModel) || VIDEO_MODELS[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isGenerating}
        className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
          isOpen 
            ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white' 
            : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
        } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Create Image or Video"
      >
        {isGenerating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <SparklesIcon className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-[#141a21] border border-white/10 rounded-2xl shadow-2xl w-[calc(100vw-2rem)] sm:w-80 max-w-80 overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
             style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {/* Tabs */}
          <div className="flex border-b border-white/10 sticky top-0 bg-[#141a21] z-10">
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                activeTab === 'image' ? 'text-pink-400 bg-pink-500/10 border-b-2 border-pink-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <ImagePlusIcon className="w-4 h-4" />
              Image
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                activeTab === 'video' ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <VideoIcon className="w-4 h-4" />
              Video
            </button>
          </div>

          {/* Load from JSON option */}
          <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-0">
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleJsonUpload}
              className="hidden"
            />
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 border border-dashed border-white/20 rounded-lg text-xs text-gray-400 hover:text-white hover:border-white/40 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Load from JSON
            </button>
            {loadedFromJson && (
              <p className="text-[10px] text-green-400 text-center mt-1.5 flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> Loaded from JSON — tweak and regenerate
              </p>
            )}
          </div>

          <div className="p-3 sm:p-4 space-y-3">
            {/* Model Selector */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 block">
                {activeTab === 'image' ? 'Image Model' : 'Video Model'}
              </label>
              <div className="space-y-1 max-h-28 sm:max-h-32 overflow-y-auto">
                {(activeTab === 'image' ? IMAGE_MODELS : VIDEO_MODELS).map(model => (
                  <button
                    key={model.value}
                    onClick={() => activeTab === 'image' ? setSelectedImageModel(model.value) : setSelectedVideoModel(model.value)}
                    className={`w-full flex items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      (activeTab === 'image' ? selectedImageModel : selectedVideoModel) === model.value
                        ? 'bg-gradient-to-r from-pink-500/20 to-blue-500/20 border border-pink-500/30 text-white'
                        : 'bg-white/3 border border-white/5 text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-[11px]">{model.label}</span>
                      <span className="text-[9px] text-gray-600">{model.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio for Images */}
            {activeTab === 'image' && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 block">Aspect Ratio</label>
                <div className="flex gap-1.5">
                  {['1:1', '16:9', '9:16', '4:3'].map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${
                        aspectRatio === ratio
                          ? 'bg-pink-500/20 border border-pink-500/40 text-pink-400'
                          : 'bg-white/5 border border-white/10 text-gray-500 hover:text-white'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt Input */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 block">
                Describe what you want
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTab === 'image' 
                  ? "A serene mountain landscape at sunset..."
                  : "A cinematic drone shot flying through a city..."
                }
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-pink-500/50"
                rows={2}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className={`w-full py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                prompt.trim()
                  ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white hover:from-pink-600 hover:to-purple-600'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              <SparklesIcon className="w-4 h-4" />
              Generate {activeTab === 'image' ? 'Image' : 'Video'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GalleryItem: Single item in the media gallery ────────────────────────────
function GalleryItem({ item, onClick }) {
  const isVideo = item.type === 'video';
  
  return (
    <div 
      onClick={() => onClick(item)}
      className="relative group cursor-pointer rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all"
    >
      {isVideo ? (
        <div className="aspect-video bg-gradient-to-br from-blue-500/10 to-pink-500/10 flex items-center justify-center">
          {item.thumbnail_url ? (
            <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Film className="w-8 h-8 text-blue-400" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-10 h-10 text-white" />
          </div>
        </div>
      ) : (
        <div className="aspect-square">
          <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
        </div>
      )}
      
      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-[10px] text-white truncate">{item.prompt}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${isVideo ? 'bg-blue-500/30 text-purple-300' : 'bg-pink-500/30 text-pink-300'}`}>
            {item.model_label || item.model}
          </span>
          <span className="text-[9px] text-gray-500">
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── GalleryModal: Full-screen view of a gallery item ─────────────────────────
function GalleryModal({ item, onClose, onDelete, onRegenerate, token }) {
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  
  useEffect(() => {
    if (item) setEditedPrompt(item.prompt || '');
  }, [item]);
  
  if (!item) return null;
  
  const isVideo = item.type === 'video';
  const promptIsTruncated = item.prompt && item.prompt.length > 150;
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this from your gallery?')) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        onDelete?.(item.id);
        onClose();
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
    setDeleting(false);
  };
  
  const handleRegenerate = async () => {
    if (!editedPrompt.trim()) {
      alert('Please enter a prompt');
      return;
    }
    
    setRegenerating(true);
    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: item.type,
          model: item.model || 'smart',
          prompt: editedPrompt,
          aspectRatio: item.aspect_ratio || '1:1',
          duration: item.duration || '5',
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert('Regeneration failed: ' + data.error);
      } else {
        onRegenerate?.(data);
        onClose();
        alert(isVideo ? 'Video generation started! Check the gallery in a few minutes.' : 'New image generated! Check the gallery.');
      }
    } catch (e) {
      alert('Regeneration failed: ' + e.message);
    }
    setRegenerating(false);
  };
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${isVideo ? 'bg-blue-500/30 text-purple-300' : 'bg-pink-500/30 text-pink-300'}`}>
              {isVideo ? 'Video' : 'Image'} • {item.model_label || item.model}
            </span>
            {item.duration && isVideo && (
              <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-400">
                {item.duration}s
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center overflow-hidden rounded-xl bg-black">
          {isVideo ? (
            <video 
              src={item.url} 
              controls 
              autoPlay 
              className="max-w-full max-h-[60vh] rounded-lg"
            />
          ) : (
            <img 
              src={item.url} 
              alt={item.prompt} 
              className="max-w-full max-h-[60vh] object-contain rounded-lg"
            />
          )}
        </div>
        
        {/* Prompt Section */}
        <div className="mt-4 p-4 bg-white/5 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">ORIGINAL PROMPT</span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              {isEditing ? 'Cancel Edit' : 'Edit & Regenerate'}
            </button>
          </div>
          
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none"
                rows={4}
                placeholder="Enter your prompt..."
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating || !editedPrompt.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate {isVideo ? 'Video' : 'Image'}
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className={`text-sm text-gray-300 ${!showFullPrompt && promptIsTruncated ? 'line-clamp-2' : ''}`}>
                {item.prompt || 'No prompt available'}
              </p>
              {promptIsTruncated && (
                <button
                  onClick={() => setShowFullPrompt(!showFullPrompt)}
                  className="text-xs text-orange-400 hover:text-orange-300 mt-1"
                >
                  {showFullPrompt ? 'Show less' : 'Show full prompt'}
                </button>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
            <span className="text-xs text-gray-500">
              {new Date(item.created_at).toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
              <a 
                href={item.url} 
                download 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-white hover:bg-white/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CloudImportModal: Universal Import with Auto-Detection ──────────────────
function CloudImportModal({ onClose, token, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [detectedPlatform, setDetectedPlatform] = useState(null);
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const getTotalSize = () => selectedFiles.reduce((sum, f) => sum + f.size, 0);

  // Upload large file in chunks for server-side processing
  // Upload large files using disk-based chunked upload (more reliable for GB-sized files)
  const uploadLargeFileForImport = async (file, onProgress, onStatus) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for faster upload
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const MAX_RETRIES = 3;
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    
    console.log(`[LargeUpload] Starting upload: ${file.name} (${fileSizeMB} MB, ${totalChunks} chunks)`);
    onStatus?.(`Preparing upload of ${fileSizeMB} MB file...`);
    
    // Step 1: Initialize upload session using disk-based storage
    let initRes;
    try {
      initRes = await fetch('/api/import/chunked/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          filename: file.name, 
          fileSize: file.size, 
          totalChunks,
          type: 'chatgpt'
        }),
      });
    } catch (networkErr) {
      console.error('[LargeUpload] Network error during init:', networkErr);
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      console.error('[LargeUpload] Init failed:', errData);
      throw new Error(errData.error || 'Failed to start upload. Please try again.');
    }
    
    const { uploadId } = await initRes.json();
    console.log(`[LargeUpload] Upload session created: ${uploadId}`);
    onProgress(2);
    
    // Step 2: Upload chunks with retry logic
    let uploadedBytes = 0;
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkSizeMB = ((end - start) / (1024 * 1024)).toFixed(1);
      
      let retries = 0;
      let success = false;
      
      while (retries < MAX_RETRIES && !success) {
        try {
          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', i.toString());
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout for large chunks
          
          const chunkRes = await fetch('/api/import/chunked/chunk', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (chunkRes.ok) {
            success = true;
            uploadedBytes += (end - start);
            const uploadedMB = (uploadedBytes / (1024 * 1024)).toFixed(1);
            onStatus?.(`Uploaded ${uploadedMB} MB of ${fileSizeMB} MB...`);
          } else {
            const errData = await chunkRes.json().catch(() => ({}));
            throw new Error(errData.error || `Chunk ${i+1} failed`);
          }
        } catch (chunkErr) {
          retries++;
          console.warn(`[LargeUpload] Chunk ${i+1}/${totalChunks} failed (attempt ${retries}):`, chunkErr.message);
          
          if (retries < MAX_RETRIES) {
            const waitTime = 2000 * retries;
            onStatus?.(`Upload interrupted, retrying in ${waitTime/1000}s...`);
            await new Promise(r => setTimeout(r, waitTime));
          } else {
            const progressPct = Math.round((i / totalChunks) * 100);
            throw new Error(`Upload failed at ${progressPct}% (${(uploadedBytes / (1024 * 1024)).toFixed(1)} MB uploaded). ${chunkErr.message || 'Please check your connection and try again.'}`);
          }
        }
      }
      
      // Progress: chunks take 2-85%, processing takes 85-100%
      const progressPct = 2 + Math.round(((i + 1) / totalChunks) * 83);
      onProgress(progressPct);
    }
    
    console.log(`[LargeUpload] All ${totalChunks} chunks uploaded successfully`);
    onStatus?.('Processing your data...');
    onProgress(87);
    
    // Step 3: Process the uploaded file
    const processRes = await fetch('/api/import/chunked/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        uploads: [{ uploadId, fileName: file.name }],
        type: 'chatgpt'
      }),
    });
    
    if (!processRes.ok) {
      const errData = await processRes.json().catch(() => ({}));
      console.error('[LargeUpload] Processing failed:', errData);
      throw new Error(errData.error || 'Processing failed. Your file was uploaded but could not be processed.');
    }
    
    const result = await processRes.json();
    console.log(`[LargeUpload] Processing started:`, result);
    onProgress(95);
    
    // Return the import job ID for status tracking
    return result;
  };

  // Auto-detect platform and extract data from ZIP file
  const extractFromZip = async (file) => {
    try {
      // Check file size - warn for very large files
      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`Processing ZIP file: ${fileSizeMB.toFixed(1)} MB`);
      
      if (fileSizeMB > 500) {
        console.warn('Large file detected, processing may take a while...');
      }
      
      const JSZip = (await import('jszip')).default;
      
      // Load the ZIP with timeout protection
      let zip;
      try {
        zip = await Promise.race([
          JSZip.loadAsync(file),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('ZIP loading timed out. File may be too large for browser processing.')), 120000)
          )
        ]);
      } catch (loadErr) {
        console.error('Failed to load ZIP:', loadErr);
        throw new Error(`Failed to open ZIP file: ${loadErr.message}. Try a smaller export or upload individual JSON files.`);
      }
      
      const allFiles = Object.keys(zip.files);
      const messages = [];
      const posts = [];
      let platform = 'unknown';

    // ── Detect ChatGPT ──
    const hasChatGPT = allFiles.some(f => 
      f.includes('conversations.json') || 
      f.includes('chat.html') ||
      f.includes('model_comparisons') ||
      /conversations-\d+\.json$/.test(f)
    );

    // ── Detect Facebook ──
    const hasFacebook = allFiles.some(f => 
      f.includes('messages/inbox/') || 
      f.includes('your_posts') ||
      f.includes('profile_information')
    );

    // ── Detect Claude ──
    const hasClaude = allFiles.some(f => 
      f.includes('conversations') && f.endsWith('.json')
    ) && allFiles.some(f => f.includes('Claude') || f.includes('claude'));

    // ── Detect Google/Gemini ──
    const hasGoogle = allFiles.some(f => 
      f.includes('Takeout') || 
      f.includes('My Activity') ||
      f.includes('Gemini')
    );

    // Process based on detected platform
    if (hasChatGPT) {
      platform = 'ChatGPT';
      
      // Look for conversations.json or split files (conversations-000.json, etc.)
      let conversationFiles = [];
      
      // Check for single conversations.json
      let conversationsFile = zip.file('conversations.json');
      if (conversationsFile) {
        conversationFiles.push(conversationsFile);
      } else {
        // Check for nested conversations.json
        const convFile = allFiles.find(f => f.endsWith('conversations.json'));
        if (convFile) {
          conversationFiles.push(zip.file(convFile));
        }
      }
      
      // Check for split conversation files (conversations-000.json, conversations-001.json, etc.)
      const splitFiles = allFiles.filter(f => /conversations-\d+\.json$/.test(f));
      if (splitFiles.length > 0) {
        console.log('Found split conversation files:', splitFiles.length);
        for (const splitFile of splitFiles.sort()) {
          const zf = zip.file(splitFile);
          if (zf) conversationFiles.push(zf);
        }
      }
      
      console.log('Total conversation files to process:', conversationFiles.length);
      
      for (const convFileObj of conversationFiles) {
        if (!convFileObj) continue;
        try {
          const content = await convFileObj.async('string');
          const conversations = JSON.parse(content);
          const convArray = Array.isArray(conversations) ? conversations : [conversations];
          
          for (const conv of convArray) {
            // Standard ChatGPT format with mapping
            if (conv.mapping) {
              for (const nodeId in conv.mapping) {
                const node = conv.mapping[nodeId];
                if (node.message?.content?.parts?.[0]) {
                  const role = node.message.author?.role;
                  const msgContent = node.message.content.parts.join('\n');
                  if (msgContent && msgContent.trim() && (role === 'user' || role === 'assistant')) {
                    messages.push({
                      role: role === 'user' ? 'user' : 'assistant',
                      content: msgContent.trim(),
                      timestamp: node.message.create_time ? new Date(node.message.create_time * 1000).toISOString() : null,
                      conversation_id: conv.id,
                      conversation_title: conv.title,
                      source: 'chatgpt'
                    });
                  }
                }
              }
            }
            
            // Alternative format - direct messages array
            if (conv.messages && Array.isArray(conv.messages)) {
              for (const msg of conv.messages) {
                if (msg.content && (msg.role === 'user' || msg.role === 'assistant')) {
                  messages.push({
                    role: msg.role,
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                    timestamp: msg.timestamp || msg.create_time ? new Date((msg.timestamp || msg.create_time) * 1000).toISOString() : null,
                    conversation_id: conv.id || conv.conversation_id,
                    conversation_title: conv.title,
                    source: 'chatgpt'
                  });
                }
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing ChatGPT conversations file:', parseError);
        }
      }
    }
    
    if (hasFacebook) {
      platform = platform === 'unknown' ? 'Facebook' : platform + ' + Facebook';
      
      // Look for messages in inbox folder
      const messageFiles = allFiles.filter(f => 
        f.includes('messages/inbox/') && f.endsWith('.json') && !f.includes('__MACOSX')
      );
      
      for (const filePath of messageFiles) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (msg.content) {
                // Decode Facebook's UTF-8 encoding
                let decodedContent = msg.content;
                try {
                  decodedContent = decodeURIComponent(escape(msg.content));
                } catch (e) {}
                
                messages.push({
                  role: 'user', // Facebook messages are your side of conversations
                  content: decodedContent,
                  timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms).toISOString() : null,
                  sender: msg.sender_name,
                  source: 'facebook'
                });
              }
            }
          }
        } catch (e) {
          // Skip unparseable files
        }
      }

      // Look for posts
      const postFiles = allFiles.filter(f => 
        (f.includes('posts/') || f.includes('your_posts')) && f.endsWith('.json')
      );
      
      for (const filePath of postFiles) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          const postArray = Array.isArray(data) ? data : (data.posts || []);
          
          for (const post of postArray) {
            const postContent = post.data?.[0]?.post || post.post || post.message;
            if (postContent) {
              posts.push({
                content: postContent,
                timestamp: post.timestamp ? new Date(post.timestamp * 1000).toISOString() : null,
                source: 'facebook'
              });
            }
          }
        } catch (e) {
          // Skip unparseable files
        }
      }
    }

    if (hasClaude) {
      platform = platform === 'unknown' ? 'Claude' : platform + ' + Claude';
      
      const jsonFiles = allFiles.filter(f => f.endsWith('.json') && !f.includes('__MACOSX'));
      for (const filePath of jsonFiles) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          
          // Handle Claude's conversation format
          if (data.chat_messages || data.messages) {
            const msgArray = data.chat_messages || data.messages;
            for (const msg of msgArray) {
              if (msg.text || msg.content) {
                messages.push({
                  role: msg.sender === 'human' ? 'user' : 'assistant',
                  content: msg.text || msg.content,
                  timestamp: msg.created_at || msg.timestamp,
                  source: 'claude'
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    // Fallback: Try to find ANY JSON with conversation-like data
    if (messages.length === 0 && posts.length === 0) {
      platform = 'Auto-detected';
      const jsonFiles = allFiles.filter(f => f.endsWith('.json') && !f.includes('__MACOSX'));
      
      for (const filePath of jsonFiles.slice(0, 20)) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          
          // Look for any array of message-like objects
          const findMessages = (obj, depth = 0) => {
            if (depth > 3) return;
            if (Array.isArray(obj)) {
              for (const item of obj) {
                if (item.content || item.text || item.message) {
                  messages.push({
                    role: item.role || (item.sender === 'user' ? 'user' : 'assistant'),
                    content: item.content || item.text || item.message,
                    timestamp: item.timestamp || item.created_at,
                    source: 'auto'
                  });
                }
                if (typeof item === 'object') findMessages(item, depth + 1);
              }
            } else if (typeof obj === 'object' && obj !== null) {
              for (const key of Object.keys(obj)) {
                findMessages(obj[key], depth + 1);
              }
            }
          };
          
          findMessages(data);
        } catch (e) {}
      }
    }

    console.log(`Import: Detected ${platform}, found ${messages.length} messages, ${posts.length} posts`);
    return { messages, posts, platform };
    } catch (zipErr) {
      console.error('ZIP extraction error:', zipErr);
      // Throw a more descriptive error
      throw new Error(zipErr.message || 'Failed to read ZIP file');
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const invalidFiles = files.filter(f => !f.name.endsWith('.zip'));
    if (invalidFiles.length > 0) {
      setError('Please select only ZIP files');
      return;
    }
    
    // Clear all previous state first
    setSelectedFiles(files);
    setError('');
    setExtractedData(null);
    setDetectedPlatform(null);
    setImportStatus(null);
    
    const file = files[0];
    const fileSizeMB = file.size / (1024 * 1024);
    const fileSizeGB = fileSizeMB / 1024;
    
    console.log(`Processing file: ${file.name}, size: ${fileSizeMB.toFixed(1)} MB`);
    
    // === LARGE FILE DETECTION ===
    // For files larger than 100MB, skip client-side processing entirely
    // Browser memory cannot handle loading large ZIPs with JSZip
    const LARGE_FILE_THRESHOLD_MB = 100;
    
    if (fileSizeMB > LARGE_FILE_THRESHOLD_MB) {
      console.log(`Large file detected (${fileSizeMB.toFixed(1)} MB > ${LARGE_FILE_THRESHOLD_MB} MB), using server-side processing`);
      setImportStatus({ 
        status: 'ready', 
        message: `Large file (${fileSizeGB >= 1 ? fileSizeGB.toFixed(2) + ' GB' : fileSizeMB.toFixed(0) + ' MB'}) ready for upload. Click Import to begin.`, 
        progress: 100 
      });
      setDetectedPlatform('ChatGPT (Server Processing)');
      setExtractedData({
        messages: [],
        posts: [],
        messageCount: 0,
        totalSize: fileSizeMB,
        useServerFallback: true,
        isLargeFile: true
      });
      return;
    }
    
    setImportStatus({ status: 'extracting', message: `Reading ${file.name}...`, progress: 10 });
    
    try {
      // === Try client-side extraction (only for files under 100MB) ===
      const JSZip = (await import('jszip')).default;
      
      setImportStatus({ status: 'extracting', message: 'Opening ZIP file...', progress: 20 });
      
      const zip = await JSZip.loadAsync(file);
      const allFiles = Object.keys(zip.files);
      
      setImportStatus({ status: 'extracting', message: `Found ${allFiles.length} files, analyzing...`, progress: 30 });
      
      let messages = [];
      let platform = 'Unknown';
      
      // Check for ChatGPT format (single file OR split files)
      const chatgptFile = allFiles.find(f => f.endsWith('conversations.json'));
      const splitChatgptFiles = allFiles.filter(f => /conversations-\d+\.json$/.test(f)).sort();
      
      if (chatgptFile || splitChatgptFiles.length > 0) {
        platform = 'ChatGPT';
        const filesToProcess = chatgptFile ? [chatgptFile] : splitChatgptFiles;
        setImportStatus({ status: 'extracting', message: `Detected ChatGPT export, reading ${filesToProcess.length} file(s)...`, progress: 40 });
        
        let fileIndex = 0;
        for (const convFile of filesToProcess) {
          fileIndex++;
          const progressPct = 40 + Math.floor((fileIndex / filesToProcess.length) * 40);
          setImportStatus({ status: 'extracting', message: `Processing file ${fileIndex}/${filesToProcess.length}...`, progress: progressPct });
          
          try {
            const content = await zip.file(convFile).async('string');
            const conversations = JSON.parse(content);
            const convArray = Array.isArray(conversations) ? conversations : [conversations];
            
            for (const conv of convArray) {
              if (conv.mapping) {
                for (const nodeId in conv.mapping) {
                  const node = conv.mapping[nodeId];
                  const msg = node?.message;
                  if (msg?.content?.parts?.[0] && (msg.author?.role === 'user' || msg.author?.role === 'assistant')) {
                    messages.push({
                      role: msg.author.role,
                      content: msg.content.parts.join('\n').slice(0, 2000),
                      timestamp: msg.create_time ? new Date(msg.create_time * 1000) : new Date()
                    });
                  }
                }
              }
            }
          } catch (parseErr) {
            console.error(`Error parsing ${convFile}:`, parseErr);
          }
        }
      }
      
      // Check for Facebook format
      if (messages.length === 0) {
        const fbFiles = allFiles.filter(f => f.includes('message_') && f.endsWith('.json'));
        if (fbFiles.length > 0) {
          platform = 'Facebook';
          setImportStatus({ status: 'extracting', message: `Detected Facebook export, reading ${fbFiles.length} files...`, progress: 40 });
          
          for (const fbFile of fbFiles.slice(0, 100)) {
            try {
              const content = await zip.file(fbFile).async('string');
              const data = JSON.parse(content);
              if (data.messages) {
                for (const msg of data.messages) {
                  if (msg.content) {
                    messages.push({
                      role: 'user',
                      content: msg.content.slice(0, 2000),
                      sender: msg.sender_name,
                      timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms) : new Date()
                    });
                  }
                }
              }
            } catch (e) { /* skip bad files */ }
          }
        }
      }
      
      // === SUCCESS: Found messages client-side ===
      if (messages.length > 0) {
        setImportStatus({ status: 'complete', message: `Found ${messages.length} messages from ${platform}!`, progress: 100 });
        setDetectedPlatform(platform);
        setExtractedData({
          messages,
          posts: [],
          dataSize: JSON.stringify(messages).length
        });
        return;
      }
      
      // === STEP 2: No messages found client-side, try server upload ===
      setImportStatus({ status: 'uploading', message: 'Uploading to server for processing...', progress: 40 });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'auto');
      
      const uploadRes = await fetch('/api/import/data', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      
      const uploadData = await uploadRes.json();
      const jobId = uploadData.jobId || uploadData.importId;
      
      if (jobId) {
        setImportStatus({ status: 'processing', message: 'Server is processing your data...', progress: 60 });
        
        // Poll for completion
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          
          const statusRes = await fetch(`/api/imports/status?importId=${jobId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const statusData = await statusRes.json();
          
          if (statusData.status === 'completed' || statusData.status === 'complete') {
            setImportStatus({ status: 'complete', message: 'Import complete!', progress: 100 });
            setDetectedPlatform(statusData.stats?.source || 'Unknown');
            setExtractedData({
              messages: [],
              posts: [],
              dataSize: 0,
              serverProcessed: true,
              stats: statusData.stats
            });
            return;
          }
          
          if (statusData.status === 'failed') {
            throw new Error(statusData.error || 'Processing failed');
          }
          
          setImportStatus({ 
            status: 'processing', 
            message: `Processing... ${Math.round((i / 60) * 100)}%`, 
            progress: 60 + Math.round((i / 60) * 35) 
          });
        }
        
        // Timeout but still processing
        setImportStatus({ status: 'complete', message: 'Still processing, check back soon!', progress: 100 });
        setExtractedData({ messages: [], posts: [], dataSize: 0, serverProcessed: true });
        return;
      }
      
      // No job ID means direct success
      setImportStatus({ status: 'complete', message: 'Upload complete!', progress: 100 });
      setExtractedData({ messages: [], posts: [], dataSize: 0, serverProcessed: true });
      
    } catch (err) {
      console.error('Client-side extraction error:', err);
      
      // Offer server fallback for large/complex files
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        setImportStatus({ status: 'ready', message: `Browser processing failed. Will upload to server instead.`, progress: 100 });
        setDetectedPlatform('Server Processing');
        setExtractedData({
          messages: [],
          posts: [],
          messageCount: 0,
          totalSize: fileSizeMB,
          useServerFallback: true
        });
      } else {
        setError(`Import failed: ${err.message}`);
        setImportStatus(null);
      }
    }
  };

  const removeFile = () => {
    setSelectedFiles([]);
    setExtractedData(null);
    setError('');
  };

  const handleImport = async () => {
    // Handle server fallback for files that couldn't be read client-side
    if (extractedData?.useServerFallback && selectedFiles.length > 0) {
      setIsImporting(true);
      setError('');
      
      const file = selectedFiles[0];
      const fileSizeMB = file.size / (1024 * 1024);
      const fileSizeDisplay = fileSizeMB >= 1024 
        ? `${(fileSizeMB / 1024).toFixed(2)} GB` 
        : `${fileSizeMB.toFixed(0)} MB`;
      
      // For large files, use chunked upload with disk-based storage
      setImportStatus({ status: 'uploading', message: `Preparing to upload ${fileSizeDisplay}...`, progress: 1 });
      
      try {
        const result = await uploadLargeFileForImport(
          file, 
          (progress) => {
            // Progress callback
            setImportStatus(prev => ({ 
              ...prev, 
              progress: Math.min(progress, 99) 
            }));
          },
          (statusMessage) => {
            // Status message callback
            setImportStatus(prev => ({ 
              ...prev, 
              message: statusMessage 
            }));
          }
        );
        
        // Check if we got an import job ID to poll
        if (result.importId) {
          setImportStatus({ status: 'processing', message: 'Analyzing your conversation history...', progress: 95 });
          
          // Poll for import job completion
          const pollImportStatus = async (attempts = 0) => {
            if (attempts > 120) { // 4 minutes max
              setImportStatus({ status: 'complete', message: 'Processing in background. This may take a few minutes for large files.', progress: 100 });
              setIsImporting(false);
              setTimeout(() => onImportComplete?.(), 2000);
              return;
            }
            
            try {
              const statusRes = await fetch(`/api/imports/status?importId=${result.importId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const statusData = await statusRes.json();
              
              if (statusData.status === 'completed' || statusData.status === 'complete') {
                setImportStatus({ 
                  status: 'complete', 
                  message: `Import complete! ${statusData.stats?.messagesCount || ''} messages analyzed.`, 
                  progress: 100 
                });
                setIsImporting(false);
                setTimeout(() => {
                  onImportComplete?.();
                  onClose();
                }, 2000);
                return;
              }
              
              if (statusData.status === 'failed') {
                throw new Error(statusData.error || 'Processing failed');
              }
              
              // Still processing
              setImportStatus({ 
                status: 'processing', 
                message: statusData.message || 'Processing your data...', 
                progress: Math.min(95 + attempts * 0.04, 99) 
              });
              
              setTimeout(() => pollImportStatus(attempts + 1), 2000);
            } catch (pollErr) {
              console.error('Poll error:', pollErr);
              setTimeout(() => pollImportStatus(attempts + 1), 3000);
            }
          };
          
          pollImportStatus();
        } else {
          // No import ID, assume success
          setImportStatus({ status: 'complete', message: 'Upload complete! Your data is being processed.', progress: 100 });
          setIsImporting(false);
          setTimeout(() => {
            onImportComplete?.();
            onClose();
          }, 2000);
        }
      } catch (err) {
        console.error('Upload error:', err);
        setError(err.message || 'Upload failed. Please try again.');
        setIsImporting(false);
        setImportStatus(null);
      }
      return;
    }
    
    if (!extractedData || extractedData.messages.length === 0) {
      setError('No messages found to import');
      return;
    }
    
    setIsImporting(true);
    setError('');
    setImportStatus({ status: 'uploading', message: 'Uploading extracted data...', progress: 20 });

    try {
      // Upload extracted data (much smaller than full ZIP!)
      const res = await fetch('/api/import/data', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: detectedPlatform?.toLowerCase() || 'auto',
          messages: extractedData.messages,
          posts: extractedData.posts
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      
      setImportStatus({ status: 'processing', message: 'Analyzing your data...', progress: 60 });
      
      // Poll for completion
      if (data.importId) {
        const poll = async (polls = 0) => {
          if (polls > 120) return setError('Timeout');
          const r = await fetch(`/api/imports/status?importId=${data.importId}`, { 
            headers: { Authorization: `Bearer ${token}` } 
          });
          const d = await r.json();
          
          if (d.status === 'completed') {
            setImportStatus({ 
              status: 'completed', 
              message: d.message || `Imported ${d.messagesCount || 0} messages!`, 
              progress: 100 
            });
            setIsImporting(false);
            if (d.analysis || d.profileComparison || d.memoriesAdded) {
              setAnalysisResult({
                analysis: d.analysis,
                profile: d.profileComparison,
                memoriesAdded: d.memoriesAdded || 0,
                messagesCount: d.messagesCount || 0
              });
            }
          } else if (d.status === 'failed') {
            setError(d.error || 'Import failed');
            setImportStatus(null);
            setIsImporting(false);
          } else {
            setImportStatus({ 
              status: 'processing', 
              message: d.message || 'Processing...', 
              progress: Math.min(95, 60 + polls) 
            });
            setTimeout(() => poll(polls + 1), 2000);
          }
        };
        poll();
      }
    } catch (err) {
      setError(err.message);
      setImportStatus(null);
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#141a21] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#141a21] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Import History</h2>
              <p className="text-xs text-gray-500">Currently supports ChatGPT • More platforms coming soon</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1" disabled={isImporting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Instructions - only show before file selected */}
          {!selectedFiles.length && !extractedData && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-sm text-gray-300 mb-3">Upload your data export ZIP file from any of these:</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs rounded-full">ChatGPT</span>
                <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">Facebook</span>
                <span className="px-2.5 py-1 bg-orange-500/10 text-orange-400 text-xs rounded-full">Claude</span>
                <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">Google/Gemini</span>
              </div>
              <p className="text-xs text-gray-500 mt-3">We'll automatically detect the format.</p>
            </div>
          )}

          {/* File Selection */}
          <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".zip" 
              className="hidden" 
              disabled={isImporting} 
            />
            
            {!extractedData ? (
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isImporting || importStatus?.status === 'extracting'}
                className="w-full py-8 border-2 border-dashed border-white/20 hover:border-orange-500/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-all">
                {importStatus?.status === 'extracting' ? (
                  <>
                    <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />
                    <span className="text-sm text-orange-400">{importStatus.message}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-500" />
                    <span className="text-sm text-gray-400">Click to select your ZIP file</span>
                    <div className="flex items-center gap-1 text-xs text-green-500/80">
                      <Shield className="w-3 h-3" />
                      <span>Messages analyzed then deleted — only insights kept</span>
                    </div>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                {/* Selected File */}
                <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileArchive className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-gray-300 truncate">{selectedFiles[0]?.name}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(getTotalSize())})</span>
                  </div>
                  <button onClick={removeFile} disabled={isImporting} className="text-gray-500 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Detected platform */}
                {detectedPlatform && (
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400">Detected platform:</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      detectedPlatform.toLowerCase().includes('chatgpt') ? 'bg-green-500/20 text-green-400' :
                      detectedPlatform.toLowerCase().includes('facebook') ? 'bg-blue-500/20 text-blue-400' :
                      detectedPlatform.toLowerCase().includes('claude') ? 'bg-orange-500/20 text-orange-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>{detectedPlatform}</span>
                  </div>
                )}
                
                {/* Server Processed Success */}
                {extractedData?.serverProcessed ? (
                  <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Import Complete!</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Your {detectedPlatform || 'chat'} history has been processed and added to your SoulPrint profile.
                    </p>
                    {extractedData.stats && (
                      <div className="mt-3 text-xs text-gray-500">
                        {extractedData.stats.messageCount && <span>• {extractedData.stats.messageCount} messages analyzed</span>}
                      </div>
                    )}
                  </div>
                ) : extractedData?.useServerFallback ? (
                  <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Upload className="w-5 h-5 text-blue-400" />
                      <span className="text-blue-400 font-medium">Server Upload Available</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Your browser couldn't read this file directly. Click below to upload it to our servers for processing.
                    </p>
                    <div className="text-xs text-blue-400/80 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span>Files are processed securely and deleted after import</span>
                    </div>
                  </div>
                ) : (
                  /* Extraction Preview */
                  <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Ready to Import</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-black/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-white">{extractedData.messages.length.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Messages Found</div>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-white">{formatFileSize(extractedData.dataSize)}</div>
                        <div className="text-xs text-gray-500">Data to Upload</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-emerald-400/80 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      <span>
                        {getTotalSize() > 100 * 1024 * 1024 
                          ? `${Math.round(getTotalSize() / extractedData.dataSize)}x smaller than original file!` 
                          : 'Fast upload - only conversation data'
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Progress */}
          {importStatus && importStatus.status !== 'extracting' && (
            <div className={`p-4 rounded-lg ${
              importStatus.status === 'completed' 
                ? 'bg-green-500/10 border border-green-500/30' 
                : 'bg-cyan-500/10 border border-cyan-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {importStatus.status === 'completed' 
                  ? <CheckCircle2 className="w-4 h-4 text-green-400" /> 
                  : <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                }
                <span className={`text-sm font-medium ${
                  importStatus.status === 'completed' ? 'text-green-400' : 'text-cyan-400'
                }`}>
                  {importStatus.message}
                </span>
              </div>
              {importStatus.progress > 0 && importStatus.status !== 'completed' && (
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div 
                    className="bg-cyan-500 h-2 rounded-full transition-all" 
                    style={{ width: `${importStatus.progress}%` }} 
                  />
                </div>
              )}
            </div>
          )}

          {/* Completion with Analysis */}
          {importStatus?.status === 'completed' && analysisResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{analysisResult.messagesCount}</div>
                  <div className="text-xs text-gray-500">Messages Imported</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-400">{analysisResult.memoriesAdded}</div>
                  <div className="text-xs text-gray-500">Memories Added</div>
                </div>
              </div>

              {analysisResult.analysis && (
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Personalization Enhanced</span>
                  </div>
                  
                  {analysisResult.analysis.summary && (
                    <p className="text-gray-300 text-sm mb-3">{analysisResult.analysis.summary}</p>
                  )}

                  {analysisResult.analysis.interests?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {analysisResult.analysis.interests.slice(0, 5).map((interest, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white/10 text-gray-300 text-xs rounded">
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          {importStatus?.status === 'completed' ? (
            <button 
              onClick={onClose} 
              className="w-full py-3 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Continue to Chat
            </button>
          ) : (
            <button 
              onClick={handleImport} 
              disabled={(!extractedData || (extractedData.messages.length === 0 && !extractedData.useServerFallback)) || isImporting}
              className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                extractedData && (extractedData.messages.length > 0 || extractedData.useServerFallback) && !isImporting
                  ? extractedData.useServerFallback 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90'
                    : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:opacity-90' 
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}>
              {isImporting 
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {extractedData?.useServerFallback ? 'Uploading...' : 'Importing...'}</>
                : extractedData?.useServerFallback 
                  ? <><Upload className="w-4 h-4" /> Upload to Server</>
                  : <><Zap className="w-4 h-4" /> Import {extractedData?.messages?.length?.toLocaleString() || 0} Messages</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
// Schedule templates for UI
const SCHEDULE_TEMPLATES = [
  { id: 'ai_news',    name: '🤖 AI News Digest',     prompt: 'Summarize the top 5 most important AI and machine learning stories from the last 24 hours. For each story include: what happened, why it matters, and a source if available. Format it clearly.' },
  { id: 'world_news', name: '🌍 World News Brief',    prompt: 'What are the top 5 most important world news stories from the last 24 hours? Give a clear, concise summary of each.' },
  { id: 'market',     name: '📈 Market Summary',      prompt: 'Give me a summary of today\'s financial markets: major indices performance, top gainers/losers, notable news, and key economic events from the last 24 hours.' },
  { id: 'tech_news',  name: '💻 Tech News',           prompt: 'What are the most significant technology news stories from the last 24 hours? Focus on product launches, funding, acquisitions, and industry trends.' },
  { id: 'crypto',     name: '₿ Crypto Brief',         prompt: 'Summarize the cryptocurrency market over the last 24 hours: Bitcoin and Ethereum prices, major movers, key news and developments.' },
  { id: 'custom',     name: '✏️ Custom',              prompt: '' },
];

const TIMEZONES = [
  { label: 'UTC', offset: 0 },
  { label: 'EST (UTC-5)', offset: -5 },
  { label: 'CST (UTC-6)', offset: -6 },
  { label: 'MST (UTC-7)', offset: -7 },
  { label: 'PST (UTC-8)', offset: -8 },
  { label: 'London (UTC+0)', offset: 0 },
  { label: 'Paris (UTC+1)', offset: 1 },
  { label: 'Dubai (UTC+4)', offset: 4 },
  { label: 'India (UTC+5:30)', offset: 5.5 },
  { label: 'Singapore (UTC+8)', offset: 8 },
  { label: 'Tokyo (UTC+9)', offset: 9 },
  { label: 'Sydney (UTC+10)', offset: 10 },
];

// Feedback Modal Component
function FeedbackModal({ onClose, token }) {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);

  const handleAttachmentSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Only allow images up to 5MB
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      setAttachment({
        name: file.name,
        mimeType: file.type,
        base64,
        preview: ev.target.result,
      });
      setError('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 5) {
      setError('Please enter at least 5 characters');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      const payload = {
        message: message.trim(),
        category,
        rating: rating > 0 ? rating : null,
      };
      
      // Include attachment if present
      if (attachment) {
        payload.attachment = {
          name: attachment.name,
          mimeType: attachment.mimeType,
          base64: attachment.base64,
        };
      }
      
      const res = await fetch('/api/user-feedback', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      
      setSubmitted(true);
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h3 className="text-xl font-semibold text-white mb-2">Thank You!</h3>
          <p className="text-gray-400">Your feedback has been submitted. We truly appreciate it!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-orange-500" />
            Send Feedback
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {['general', 'bug', 'feature', 'other'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-all ${
                    category === cat 
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 border' 
                      : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {cat === 'bug' ? '🐛 Bug' : cat === 'feature' ? '💡 Feature Request' : cat === 'other' ? '📝 Other' : '💬 General'}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Your Feedback</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind... What's working well? What could be better? Any ideas?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-orange-500/50 outline-none transition-colors min-h-[120px] resize-none"
              required
            />
          </div>

          {/* Attachment */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Screenshot (optional)</label>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAttachmentSelect} 
              accept="image/*" 
              className="hidden" 
            />
            
            {attachment ? (
              <div className="relative inline-block">
                <img 
                  src={attachment.preview} 
                  alt="Screenshot preview" 
                  className="w-32 h-24 object-cover rounded-xl border-2 border-orange-500/40"
                />
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"
                >
                  <X className="w-4 h-4" />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-[128px]">{attachment.name}</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-gray-400 hover:bg-white/10 hover:border-white/30 transition-all w-full"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm">Click to attach a screenshot</span>
              </button>
            )}
            <p className="text-xs text-gray-600 mt-1">Max 5MB • PNG, JPG, GIF</p>
          </div>

          {/* Rating (optional) */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Rating (optional)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(rating === star ? 0 : star)}
                  className={`text-2xl transition-transform hover:scale-110 ${star <= rating ? 'text-orange-400' : 'text-gray-700'}`}
                >
                  ★
                </button>
              ))}
              {rating > 0 && <span className="text-sm text-gray-500 ml-2 self-center">{rating}/5</span>}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="w-full btn-orange py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Feedback
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-600 text-center">
            Your feedback helps us improve SoulPrint for everyone.
          </p>
        </form>
      </div>
    </div>
  );
}

// Appearance Tab Component - Theme toggle
function AppearanceTab() {
  const { theme, setTheme, isDark } = useTheme();
  
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white text-sm font-semibold mb-1">🎨 Appearance</h3>
        <p className="text-gray-500 text-xs mb-4">Customize how SoulPrint looks</p>
      </div>

      {/* Theme Selection */}
      <div className="space-y-3">
        <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Theme</p>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Dark Mode */}
          <button
            onClick={() => setTheme('dark')}
            className={`relative p-4 rounded-xl border-2 transition-all ${
              isDark
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#0D1217]' : 'bg-[#1a1a1a]'}`}>
                <Moon className="w-6 h-6 text-orange-400" />
              </div>
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-400'}`}>
                Dark
              </span>
              {isDark && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-orange-500" />
                </div>
              )}
            </div>
            {/* Preview */}
            <div className="mt-3 p-2 rounded-lg bg-[#0D1217] border border-white/10">
              <div className="h-1.5 w-8 bg-orange-500 rounded mb-1.5"></div>
              <div className="h-1 w-full bg-white/20 rounded mb-1"></div>
              <div className="h-1 w-3/4 bg-white/10 rounded"></div>
            </div>
          </button>

          {/* Light Mode */}
          <button
            onClick={() => setTheme('light')}
            className={`relative p-4 rounded-xl border-2 transition-all ${
              !isDark
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${!isDark ? 'bg-white shadow-md' : 'bg-gray-200'}`}>
                <Sun className="w-6 h-6 text-orange-500" />
              </div>
              <span className={`text-sm font-medium ${!isDark ? 'text-white' : 'text-gray-400'}`}>
                Light
              </span>
              {!isDark && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-orange-500" />
                </div>
              )}
            </div>
            {/* Preview */}
            <div className="mt-3 p-2 rounded-lg bg-white border border-gray-200">
              <div className="h-1.5 w-8 bg-orange-500 rounded mb-1.5"></div>
              <div className="h-1 w-full bg-gray-300 rounded mb-1"></div>
              <div className="h-1 w-3/4 bg-gray-200 rounded"></div>
            </div>
          </button>
        </div>
      </div>

      {/* Info Note */}
      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">Your preference is saved</p>
            <p className="text-gray-400 text-xs mt-1">
              SoulPrint will remember your theme choice across sessions. 
              The orange brand colors work beautifully in both themes!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Privacy & Data Management Tab Component
function PrivacyTab({ token }) {
  const [dataUsage, setDataUsage] = useState(null);
  const [privacySettings, setPrivacySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usageRes, settingsRes] = await Promise.all([
        fetch('/api/privacy/data-usage', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/privacy/settings', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setDataUsage(await usageRes.json());
      setPrivacySettings(await settingsRes.json());
    } catch (e) {
      console.error('Failed to load privacy data:', e);
    }
    setLoading(false);
  };

  const updateSetting = async (key, value) => {
    try {
      await fetch('/api/privacy/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: value })
      });
      setPrivacySettings(prev => ({ ...prev, [key]: value }));
    } catch (e) {
      alert('Failed to update setting');
    }
  };

  const exportData = async () => {
    setActionLoading('export');
    try {
      const res = await fetch('/api/privacy/export', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soulprint-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export data');
    }
    setActionLoading(null);
  };

  const purgeChatHistory = async () => {
    if (!confirm('Are you sure you want to delete ALL your chat history? This cannot be undone.')) return;
    setActionLoading('purge-chats');
    try {
      const res = await fetch('/api/privacy/purge-chats', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      alert(`Deleted ${data.messages_deleted} messages and ${data.conversations_deleted} conversations.`);
      loadData();
    } catch (e) {
      alert('Failed to purge chat history');
    }
    setActionLoading(null);
  };

  const purgeImportedData = async () => {
    if (!confirm('Are you sure you want to delete all imported data (ChatGPT, Facebook, etc.)? This cannot be undone.')) return;
    setActionLoading('purge-imports');
    try {
      const res = await fetch('/api/privacy/purge-imports', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      alert(`Deleted ${data.imported_messages_deleted} imported messages.`);
      loadData();
    } catch (e) {
      alert('Failed to purge imported data');
    }
    setActionLoading(null);
  };

  const deleteAccount = async () => {
    setActionLoading('delete');
    try {
      const res = await fetch('/api/privacy/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm_email: deleteEmail })
      });
      if (res.ok) {
        alert('Your account has been deleted. You will be logged out.');
        localStorage.removeItem('sp_token');
        localStorage.removeItem('sp_user');
        window.location.href = '/';
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete account');
      }
    } catch (e) {
      alert('Failed to delete account');
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b border-white/10">
        <div className="w-12 h-12 mx-auto bg-green-500/10 rounded-xl flex items-center justify-center mb-3 border border-green-500/20">
          <Shield className="w-6 h-6 text-green-400" />
        </div>
        <h3 className="text-white font-semibold">Privacy & Security</h3>
        <p className="text-gray-500 text-xs mt-1">Manage your data and privacy settings</p>
      </div>

      {/* Data Usage Summary */}
      {dataUsage && (
        <div>
          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
            <span>📊</span> Your Data
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(dataUsage.data_stored || {}).map(([key, val]) => (
              <div key={key} className="p-2 bg-[#1a1a1a] rounded-lg border border-white/5">
                <p className="text-gray-500 text-[10px] uppercase">{key.replace(/_/g, ' ')}</p>
                <p className="text-white text-lg font-semibold">{val.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Training Opt-Out */}
      <div>
        <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
          <span>🤖</span> AI Privacy
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-xl border border-white/5">
            <div>
              <p className="text-white text-sm">Opt out of AI training</p>
              <p className="text-gray-500 text-[10px]">Your data won't be used to improve our models</p>
            </div>
            <button
              onClick={() => updateSetting('ai_training_opt_out', !privacySettings?.ai_training_opt_out)}
              className={`w-10 h-5 rounded-full transition-all relative ${privacySettings?.ai_training_opt_out ? 'bg-green-500' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${privacySettings?.ai_training_opt_out ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-xl border border-white/5">
            <div>
              <p className="text-white text-sm">Analytics opt-out</p>
              <p className="text-gray-500 text-[10px]">Disable anonymous usage tracking</p>
            </div>
            <button
              onClick={() => updateSetting('analytics_opt_out', !privacySettings?.analytics_opt_out)}
              className={`w-10 h-5 rounded-full transition-all relative ${privacySettings?.analytics_opt_out ? 'bg-green-500' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${privacySettings?.analytics_opt_out ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div>
        <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
          <span>📥</span> Export Your Data
        </h4>
        <p className="text-gray-500 text-xs mb-3">Download a copy of all your data in JSON format.</p>
        <button
          onClick={exportData}
          disabled={actionLoading === 'export'}
          className="w-full px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {actionLoading === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download My Data
        </button>
      </div>

      {/* Data Deletion */}
      <div>
        <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
          <span>🗑️</span> Delete Data
        </h4>
        <div className="space-y-2">
          <button
            onClick={purgeChatHistory}
            disabled={!!actionLoading}
            className="w-full px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading === 'purge-chats' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Delete All Chat History
          </button>
          <button
            onClick={purgeImportedData}
            disabled={!!actionLoading}
            className="w-full px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading === 'purge-imports' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Delete All Imported Data
          </button>
        </div>
      </div>

      {/* Delete Account */}
      <div className="pt-4 border-t border-white/10">
        <h4 className="text-red-400 text-sm font-semibold mb-3 flex items-center gap-2">
          <span>⚠️</span> Danger Zone
        </h4>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-xl transition-colors"
          >
            Delete My Account
          </button>
        ) : (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
            <p className="text-red-400 text-xs">This will permanently delete your account and ALL associated data. This action cannot be undone.</p>
            <input
              type="email"
              placeholder="Type your email to confirm"
              value={deleteEmail}
              onChange={e => setDeleteEmail(e.target.value)}
              className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-white text-sm focus:border-red-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteEmail(''); }}
                className="flex-1 px-3 py-2 bg-white/5 text-gray-400 text-sm rounded-lg hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={!deleteEmail || actionLoading === 'delete'}
                className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Delete Forever
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Disclosure */}
      <div className="pt-4 border-t border-white/5">
        <p className="text-gray-600 text-[10px] text-center">
          🤖 SoulPrint uses AI to generate responses. All conversations are with an AI assistant, not a human.
        </p>
      </div>
    </div>
  );
}

// Settings / Telegram / Imports Modal
function SettingsModal({ onClose, token, onAssessmentReset, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'imports');
  const [imports, setImports] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [profile, setProfile] = useState(null);
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [linkCode, setLinkCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const fileRef = useRef();
  const fbFileRef = useRef();
  
  // Data imports state
  const [dataImports, setDataImports] = useState([]);
  const [soulProfile, setSoulProfile] = useState(null);
  const [showInsights, setShowInsights] = useState(false);

  // Schedules state
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '', prompt: '', local_hour: 8, minute: 0, timezone_offset: 0, timezone_label: 'UTC', schedule_type: 'daily',
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Feedback state
  const [feedbackType, setFeedbackType] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackAttachment, setFeedbackAttachment] = useState(null);
  const feedbackFileRef = useRef(null);

  useEffect(() => {
    fetch('/api/imports', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setImports(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        setProfile(d.profile);
        if (d.profile?.default_model) {
          const validModel = MODELS.find(m => m.value === d.profile.default_model && !m.comingSoon);
          if (validModel) {
            setSelectedModel(d.profile.default_model);
            setDefaultModelSaved(d.profile.default_model);
          }
        }
        // Load default video model
        if (d.profile?.default_video_model) {
          const validVideo = VIDEO_MODELS.find(m => m.value === d.profile.default_video_model);
          if (validVideo) {
            setSelectedVideoModel(d.profile.default_video_model);
            setDefaultVideoModelSaved(d.profile.default_video_model);
          }
        }
        // Load default image model
        if (d.profile?.default_image_model) {
          const validImage = IMAGE_MODELS.find(m => m.value === d.profile.default_image_model);
          if (validImage) {
            setSelectedImageModel(d.profile.default_image_model);
            setDefaultImageModelSaved(d.profile.default_image_model);
          }
        }
      }).catch(() => {});
    fetch('/api/telegram/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setTelegramStatus).catch(() => {});
    fetch('/api/data-imports', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        setDataImports(d.imports || []);
        setSoulProfile(d.soulProfile || null);
      }).catch(() => {});
    fetchSchedules();
  }, [token]);

  // Handle data import ZIP upload - supports multiple files
  async function handleDataImportUpload(files, source) {
    const fileList = Array.isArray(files) ? files : (files instanceof FileList ? Array.from(files) : [files]);
    if (!fileList.length || !fileList[0]) return;
    
    // 3GB max per file
    const MAX_IMPORT_SIZE = 3 * 1024 * 1024 * 1024;
    for (const file of fileList) {
      if (file.size > MAX_IMPORT_SIZE) {
        setUploadProgress(`Error: ${file.name} is too large (${(file.size / (1024 * 1024 * 1024)).toFixed(1)}GB). Maximum is 3GB per file.`);
        setTimeout(() => setUploadProgress(''), 8000);
        return;
      }
    }
    
    setUploading(true);
    
    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks
    const MAX_RETRIES = 5;
    const FETCH_TIMEOUT = 45000; // 45 second timeout per chunk
    
    // Helper function to fetch with timeout
    async function fetchWithTimeout(url, options, timeout = FETCH_TIMEOUT) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Request timed out - please try again');
        }
        throw err;
      }
    }
    
    // Helper function to upload a single chunk with retries
    async function uploadChunkWithRetry(uploadId, chunkIndex, chunkBlob, retries = 0) {
      const chunkFormData = new FormData();
      chunkFormData.append('uploadId', uploadId);
      chunkFormData.append('chunkIndex', chunkIndex.toString());
      chunkFormData.append('chunk', chunkBlob);
      
      try {
        const chunkRes = await fetchWithTimeout('/api/data-import/chunked/chunk', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: chunkFormData,
        });
        
        if (!chunkRes.ok) {
          const chunkErr = await chunkRes.json().catch(() => ({}));
          throw new Error(chunkErr.error || `HTTP ${chunkRes.status}`);
        }
        return true;
      } catch (err) {
        if (retries < MAX_RETRIES) {
          const waitTime = 1000 * Math.pow(2, retries);
          setUploadProgress(`Retry ${retries + 1}/${MAX_RETRIES}... (waiting ${waitTime/1000}s)`);
          await new Promise(r => setTimeout(r, waitTime));
          return uploadChunkWithRetry(uploadId, chunkIndex, chunkBlob, retries + 1);
        }
        throw err;
      }
    }
    
    // Upload a single file
    async function uploadSingleFile(file, fileIndex, totalFiles) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const filePrefix = totalFiles > 1 ? `[${fileIndex + 1}/${totalFiles}] ` : '';
      
      try {
        // For small files (< 10MB), use direct upload
        if (file.size < 10 * 1024 * 1024) {
          setUploadProgress(`${filePrefix}Uploading ${file.name} (${fileSizeMB}MB)...`);
          
          const formData = new FormData();
          formData.append('file', file);
          formData.append('source', source);
          
          setUploadProgress(`${filePrefix}Analyzing ${file.name}...`);
          
          const res = await fetchWithTimeout('/api/data-import/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          }, 120000); // 2 min timeout for processing
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload failed');
          return true;
        } else {
          // Large file: use chunked upload with PARALLEL uploads
          setUploadProgress(`${filePrefix}Preparing ${file.name} (${fileSizeMB}MB)...`);
          
          // 1. Initialize upload session
          const initRes = await fetchWithTimeout('/api/data-import/chunked/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ filename: file.name, fileSize: file.size, source, totalChunks }),
          });
          
          const initData = await initRes.json();
          if (!initRes.ok) throw new Error(initData.error || 'Failed to initialize upload');
          
          const { uploadId } = initData;
          
          // 2. Upload chunks in PARALLEL batches
          const PARALLEL_UPLOADS = 6; // 6 parallel uploads
          let completedChunks = 0;
          
          for (let batchStart = 0; batchStart < totalChunks; batchStart += PARALLEL_UPLOADS) {
            const batchEnd = Math.min(batchStart + PARALLEL_UPLOADS, totalChunks);
            const batchPromises = [];
            
            for (let i = batchStart; i < batchEnd; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const chunk = file.slice(start, end);
              batchPromises.push(uploadChunkWithRetry(uploadId, i, chunk));
            }
            
            await Promise.all(batchPromises);
            completedChunks = batchEnd;
            
            const progress = Math.round((completedChunks / totalChunks) * 100);
            const uploadedMB = ((completedChunks * CHUNK_SIZE) / (1024 * 1024)).toFixed(1);
            setUploadProgress(`${filePrefix}Uploading: ${progress}% (${Math.min(parseFloat(uploadedMB), parseFloat(fileSizeMB))}/${fileSizeMB}MB)`);
          }
          
          // 3. Complete upload and process
          setUploadProgress(`${filePrefix}✅ Upload complete! Analyzing...`);
          
          const completeRes = await fetchWithTimeout('/api/data-import/chunked/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ uploadId }),
          }, 180000); // 3 min timeout for processing
          
          const completeData = await completeRes.json();
          if (!completeRes.ok) throw new Error(completeData.error || 'Processing failed');
          return true;
        }
      } catch (err) {
        throw new Error(`${file.name}: ${err.message}`);
      }
    }
    
    try {
      // Process all files
      for (let i = 0; i < fileList.length; i++) {
        await uploadSingleFile(fileList[i], i, fileList.length);
      }
      
      // Refresh data after all uploads complete
      setUploadProgress('');
      const refreshRes = await fetch('/api/data-imports', { headers: { Authorization: `Bearer ${token}` } });
      const refreshData = await refreshRes.json();
      setDataImports(refreshData.imports || []);
      setSoulProfile(refreshData.soulProfile || null);
      setShowInsights(true);
    } catch (e) {
      setUploadProgress(`Error: ${e.message}`);
      setTimeout(() => setUploadProgress(''), 10000);
    }
    setUploading(false);
  }

  // Handle assessment reset - show choice modal
  const [showAssessmentChoice, setShowAssessmentChoice] = useState(false);
  
  async function handleResetAssessment(type = 'full') {
    try {
      const res = await fetch('/api/assessment/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        onAssessmentReset?.();
        onClose();
        // Navigate to the appropriate assessment type
        if (type === 'quick') {
          window.location.href = '/assessment/quick';
        } else {
          window.location.href = '/assessment';
        }
      } else {
        alert('Failed to reset assessment');
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  async function fetchSchedules() {
    setLoadingSchedules(true);
    try {
      const res = await fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setSchedules(Array.isArray(d) ? d : []);
    } catch { setSchedules([]); }
    setLoadingSchedules(false);
  }

  async function createSchedule() {
    if (!newSchedule.name || !newSchedule.prompt) {
      setScheduleError('Name and prompt are required');
      return;
    }
    setCreatingSchedule(true);
    setScheduleError('');
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newSchedule),
      });
      const d = await res.json();
      if (res.ok) {
        setSchedules(prev => [d, ...prev]);
        setShowCreateForm(false);
        setNewSchedule({ name: '', prompt: '', local_hour: 8, minute: 0, timezone_offset: 0, timezone_label: 'UTC', schedule_type: 'daily' });
        setSelectedTemplate(null);
      } else {
        setScheduleError(d.error || 'Failed to create schedule');
      }
    } catch { setScheduleError('Connection error'); }
    setCreatingSchedule(false);
  }

  async function toggleSchedule(taskId, active) {
    try {
      await fetch(`/api/schedules/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active }),
      });
      setSchedules(prev => prev.map(s => s.id === taskId ? { ...s, active } : s));
    } catch {}
  }

  async function deleteSchedule(taskId) {
    if (!confirm('Delete this schedule?')) return;
    try {
      await fetch(`/api/schedules/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchedules(prev => prev.filter(s => s.id !== taskId));
    } catch {}
  }

  function selectTemplate(template) {
    setSelectedTemplate(template.id);
    setNewSchedule(prev => ({
      ...prev,
      name: template.name.replace(/^[^\w]+/, '').trim(),
      prompt: template.prompt,
    }));
  }

  async function handleUpload(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    try {
      await fetch('/api/import/data', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      setTimeout(() => {
        fetch('/api/import/data', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(d => setImports(Array.isArray(d) ? d : []));
      }, 1000);
    } catch (e) { console.error(e); }
    setUploading(false);
    e.target.value = '';
  }

  const [telegramModel, setTelegramModel] = useState('gpt-4o');
  const [savingModel, setSavingModel] = useState(false);
  const [modelSaveMsg, setModelSaveMsg] = useState('');

  async function saveTelegramModel(model) {
    setSavingModel(true);
    setModelSaveMsg('');
    try {
      const res = await fetch('/api/telegram/model', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model }),
      });
      const d = await res.json();
      if (res.ok) {
        setTelegramModel(model);
        setModelSaveMsg('✅ Model updated!');
        setTimeout(() => setModelSaveMsg(''), 2000);
      } else {
        setModelSaveMsg('❌ ' + (d.error || 'Failed'));
      }
    } catch { setModelSaveMsg('❌ Error'); }
    setSavingModel(false);
  }

  // Sync model from status
  useEffect(() => {
    if (telegramStatus?.preferred_model) setTelegramModel(telegramStatus.preferred_model);
  }, [telegramStatus]);

  const linkTelegramFn = async () => {
    if (!linkCode.trim()) return;
    setLinking(true);
    setLinkMsg('');
    try {
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ link_code: linkCode.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setLinkMsg('✅ ' + d.message);
        setTelegramStatus(s => ({ ...s, linked: true }));
      } else {
        setLinkMsg('❌ ' + d.error);
      }
    } catch { setLinkMsg('❌ Connection error'); }
    setLinking(false);
  }

  // Memories state
  const [memories, setMemories] = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  const [newMemory, setNewMemory] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('other');
  const memoryCategories = ['health', 'preferences', 'personal', 'work', 'relationships', 'goals', 'other'];

  const loadMemories = async () => {
    console.log('[Memories] Starting load, token exists:', !!token);
    setMemoriesLoading(true);
    try {
      const res = await fetch('/api/user/memories', { headers: { Authorization: `Bearer ${token}` } });
      console.log('[Memories] API response status:', res.status);
      const d = await res.json();
      console.log('[Memories] Loaded:', d.memories?.length || 0, 'memories', d.error ? `Error: ${d.error}` : '');
      if (d.error) {
        console.error('[Memories] API Error:', d.error);
      }
      setMemories(d.memories || []);
      setMemoriesLoaded(true);
    } catch (e) {
      console.error('[Memories] Failed to load:', e);
    }
    setMemoriesLoading(false);
  };

  // Auto-load memories when memories tab is opened
  useEffect(() => {
    if (activeTab === 'memories' && token && !memoriesLoaded && !memoriesLoading) {
      loadMemories();
    }
  }, [activeTab, token, memoriesLoaded, memoriesLoading]);

  const addMemory = async () => {
    if (!newMemory.trim()) return;
    try {
      await fetch('/api/user/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newMemory, category: newMemoryCategory, importance: 'medium' }),
      });
      setNewMemory('');
      loadMemories();
    } catch (e) {}
  };

  const deleteMemory = async (id) => {
    if (!confirm('Delete this memory?')) return;
    try {
      await fetch(`/api/memories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadMemories();
    } catch (e) {}
  };

  const tabs = ['soulprint', 'imports', 'integrations', 'telegram', 'voice', 'schedules', 'memories', 'invites', 'announcements', 'profile', 'privacy', 'appearance', 'feedback'];

  // Voice Chat Settings
  const [voiceSettings, setVoiceSettings] = useState({ default_voice: 'alloy', web_search_enabled: true });
  const [voiceSettingsLoading, setVoiceSettingsLoading] = useState(false);
  const [voiceSettingsSaving, setVoiceSettingsSaving] = useState(false);

  // Load voice settings
  const loadVoiceSettings = async () => {
    setVoiceSettingsLoading(true);
    try {
      const res = await fetch('/api/user/voice-settings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setVoiceSettings(data);
      }
    } catch (e) {
      console.error('Failed to load voice settings:', e);
    }
    setVoiceSettingsLoading(false);
  };

  // Save voice settings
  const saveVoiceSetting = async (key, value) => {
    setVoiceSettingsSaving(true);
    try {
      const newSettings = { ...voiceSettings, [key]: value };
      setVoiceSettings(newSettings);
      
      await fetch('/api/user/voice-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newSettings),
      });
    } catch (e) {
      console.error('Failed to save voice settings:', e);
    }
    setVoiceSettingsSaving(false);
  };

  // Auto-load voice settings when voice tab is opened
  useEffect(() => {
    if (activeTab === 'voice' && token && !voiceSettingsLoading) {
      loadVoiceSettings();
      loadVoiceStats();
    }
  }, [activeTab, token]);

  // Voice Stats
  const [voiceStats, setVoiceStats] = useState(null);
  const [voiceStatsLoading, setVoiceStatsLoading] = useState(false);

  // Load voice stats
  const loadVoiceStats = async () => {
    if (voiceStatsLoading) return;
    setVoiceStatsLoading(true);
    try {
      const res = await fetch('/api/user/voice-stats', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setVoiceStats(data);
      }
    } catch (e) {
      console.error('Failed to load voice stats:', e);
    }
    setVoiceStatsLoading(false);
  };

  // SoulPrint data
  const [soulPrintData, setSoulPrintData] = useState(null);
  const [soulPrintLoading, setSoulPrintLoading] = useState(false);
  const [generatingSnapshot, setGeneratingSnapshot] = useState(false);
  const [editingAssistantName, setEditingAssistantName] = useState(null);
  const [editingDisplayName, setEditingDisplayName] = useState(null);
  const [editingCustomGreeting, setEditingCustomGreeting] = useState(null);
  // All announcements state (for viewing in settings)
  const [allAnnouncements, setAllAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  // Invites state
  const [invitesData, setInvitesData] = useState(null);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  const loadInvitesData = async () => {
    setInvitesLoading(true);
    try {
      const res = await fetch('/api/invites', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setInvitesData(data);
    } catch (e) {
      console.error('Failed to load invites:', e);
    }
    setInvitesLoading(false);
  };

  const copyInviteLink = () => {
    if (!invitesData?.invite_code) return;
    const link = `${window.location.origin}/invite/${invitesData.invite_code}`;
    navigator.clipboard.writeText(link);
    setInviteLinkCopied(true);
    setTimeout(() => setInviteLinkCopied(false), 2000);
  };

  // Auto-load invites when invites tab is opened
  useEffect(() => {
    if (activeTab === 'invites' && token && !invitesData && !invitesLoading) {
      loadInvitesData();
    }
  }, [activeTab, token, invitesData, invitesLoading]);

  const loadAllAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAllAnnouncements(data.announcements || []);
    } catch (e) {
      console.error('Failed to load announcements:', e);
    }
    setAnnouncementsLoading(false);
  };

  const restoreAnnouncement = async (announcementId) => {
    try {
      await fetch('/api/announcements/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ announcementId }),
      });
      // Refresh the list
      loadAllAnnouncements();
      // Also refresh the main announcements display
      fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setAnnouncements(d.unread || [])).catch(() => {});
    } catch (e) {
      console.error('Failed to restore announcement:', e);
    }
  };

  const loadSoulPrint = async () => {
    setSoulPrintLoading(true);
    try {
      const res = await fetch('/api/user/profile/soul', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        console.error('SoulPrint API error:', res.status);
        setSoulPrintData(null);
        return;
      }
      const data = await res.json();
      console.log('SoulPrint data loaded:', data);
      setSoulPrintData(data);
    } catch (e) {
      console.error('Failed to load SoulPrint:', e);
      setSoulPrintData(null);
    }
    setSoulPrintLoading(false);
  };

  const generateSoulPrint = async () => {
    setGeneratingSnapshot(true);
    try {
      const res = await fetch('/api/profile/soulprint/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.snapshot) {
        // Update the soulPrintData with the new snapshot
        setSoulPrintData(prev => ({
          ...prev,
          previousSnapshot: prev?.latestSnapshot || null,
          latestSnapshot: data.snapshot
        }));
      } else {
        alert(data.error || 'Failed to generate SoulPrint');
      }
    } catch (e) {
      console.error('Failed to generate SoulPrint:', e);
      alert('Failed to generate SoulPrint');
    }
    setGeneratingSnapshot(false);
  };

  useEffect(() => {
    if (activeTab === 'soulprint' && !soulPrintData) {
      loadSoulPrint();
    }
  }, [activeTab]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 safe-area-all">
      <div className="bg-[#141a21] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm sm:text-base">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="border-b border-white/10 px-2 py-2">
          <div className="grid grid-cols-4 gap-1">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-2 py-2 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase transition-colors rounded-lg text-center ${activeTab === tab ? 'text-orange-500 bg-orange-500/10 border border-orange-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'}`}>
                <span className="block text-sm mb-0.5">{tab === 'soulprint' ? '🪪' : tab === 'imports' ? '📥' : tab === 'integrations' ? '🔗' : tab === 'telegram' ? '💬' : tab === 'voice' ? '🎙️' : tab === 'schedules' ? '📅' : tab === 'memories' ? '🧠' : tab === 'invites' ? '🎁' : tab === 'announcements' ? '📢' : tab === 'profile' ? '👤' : tab === 'privacy' ? '🔒' : tab === 'appearance' ? '🎨' : '📝'}</span>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* SOULPRINT TAB */}
          {activeTab === 'soulprint' && (
            <div className="space-y-5">
              {/* What is a SoulPrint? - Collapsible Section */}
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer p-4 bg-gradient-to-r from-orange-500/5 to-purple-500/5 border border-orange-500/20 rounded-xl hover:border-orange-500/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🧬</span>
                    <div>
                      <p className="text-white text-sm font-semibold">What is a SoulPrint?</p>
                      <p className="text-gray-500 text-[10px]">The philosophy behind your AI identity</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-3 p-4 bg-sp-black rounded-xl border border-white/5 space-y-4">
                  <p className="text-gray-300 text-sm leading-relaxed">
                    A SoulPrint is your <span className="text-orange-400 font-medium">persistent AI identity layer</span>. Not a chatbot. Not a prompt wrapper. Not a memory plugin.
                  </p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    It's a mapped, structured imprint of how you <span className="text-white">think</span>, <span className="text-white">decide</span>, <span className="text-white">react</span>, <span className="text-white">prioritize</span>, <span className="text-white">trust</span>, and <span className="text-white">communicate</span> — embedded into an AI system so the interaction reflects <em>you</em>, not generic model behavior.
                  </p>
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <p className="text-orange-300 text-xs font-medium mb-2">It captures:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Decision style', 'Conflict response', 'Boundary thresholds', 'Communication cadence', 'Emotional weighting', 'Pattern recognition'].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-1 h-1 bg-orange-500 rounded-full"></span>
                          <span className="text-gray-400 text-[10px]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">🔄 Most AI resets every session.</span>
                    <span className="text-orange-400 font-medium">✨ Your SoulPrint doesn't.</span>
                  </div>
                  <p className="text-gray-400 text-xs italic border-t border-white/5 pt-3">
                    In short: A SoulPrint is the <span className="text-white font-medium">operating system of you</span> — running on AI.
                  </p>
                </div>
              </details>

              {soulPrintLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : soulPrintData ? (
                <>
                  {/* Profile Completion Progress */}
                  {soulPrintData.assessmentProgress && !soulPrintData.assessmentProgress.fullAssessmentComplete && (
                    <div className="p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-orange-400 text-xs font-medium">Profile Completion</span>
                        <span className="text-white text-sm font-semibold">{soulPrintData.assessmentProgress?.overall?.percentage || 0}%</span>
                      </div>
                      <div className="h-2 bg-black/30 rounded-full overflow-hidden mb-2">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${soulPrintData.assessmentProgress?.overall?.percentage || 0}%` }}
                        />
                      </div>
                      <p className="text-gray-500 text-[10px]">
                        {soulPrintData.assessmentProgress?.overall?.answered || 0} of 36 questions answered across 6 pillars.
                        {soulPrintData.assessmentProgress?.overall?.percentage < 100 && " I'll ask more as we chat."}
                      </p>
                    </div>
                  )}

                  {/* Header with Generate Button */}
                  <div className="text-center pb-4 border-b border-white/10">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-3 border border-orange-500/30">
                      <SoulPrintLogo size={40} />
                    </div>
                    <h3 className="text-white font-semibold">{soulPrintData.displayName}'s SoulPrint</h3>
                    <p className="text-gray-500 text-xs mt-1">Your dynamic communication identity</p>
                    
                    {/* Generate/Refresh Button */}
                    <button
                      onClick={generateSoulPrint}
                      disabled={generatingSnapshot}
                      className="mt-4 px-4 py-2 bg-gradient-to-r from-orange-500 to-purple-500 hover:from-orange-600 hover:to-purple-600 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
                    >
                      {generatingSnapshot ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Analyzing your data...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {soulPrintData.latestSnapshot ? 'Refresh SoulPrint' : 'Generate SoulPrint'}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Latest AI-Generated Snapshot */}
                  {soulPrintData.latestSnapshot && (
                    <>
                      {/* Data Sources Badge */}
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {soulPrintData.latestSnapshot.dataSources?.map((src, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white/5 text-gray-500 text-[9px] rounded-full border border-white/10 uppercase tracking-wider">
                            {src.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>

                      {/* Summary */}
                      {soulPrintData.latestSnapshot.summary && (
                        <div className="p-4 bg-gradient-to-br from-orange-500/10 to-purple-500/10 rounded-xl border border-orange-500/20">
                          <p className="text-gray-300 text-sm leading-relaxed">{soulPrintData.latestSnapshot.summary}</p>
                        </div>
                      )}

                      {/* Communication Style */}
                      {soulPrintData.latestSnapshot.communicationStyle && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🎨</span> Communication Style
                          </h4>
                          <div className="p-4 bg-[#1a1a1a] rounded-xl border border-white/5 space-y-3">
                            <p className="text-gray-300 text-sm">{soulPrintData.latestSnapshot.communicationStyle.overall}</p>
                            <div className="flex flex-wrap gap-2">
                              <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] rounded-full border border-blue-500/20">
                                {soulPrintData.latestSnapshot.communicationStyle.tone}
                              </span>
                              <span className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] rounded-full border border-green-500/20">
                                {soulPrintData.latestSnapshot.communicationStyle.directness}
                              </span>
                              <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] rounded-full border border-purple-500/20">
                                {soulPrintData.latestSnapshot.communicationStyle.detail_preference}
                              </span>
                            </div>
                            {soulPrintData.latestSnapshot.communicationStyle.traits?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-2">
                                {soulPrintData.latestSnapshot.communicationStyle.traits.map((trait, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-white/5 text-gray-400 text-[10px] rounded-full">
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Show Changes from Previous */}
                          {soulPrintData.previousSnapshot?.communicationStyle && (
                            <div className="mt-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                              <p className="text-yellow-400 text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                                <GitCompare className="w-3 h-3" /> Changes from previous
                              </p>
                              <p className="text-gray-500 text-[11px]">
                                Previous: {soulPrintData.previousSnapshot.communicationStyle.tone} / {soulPrintData.previousSnapshot.communicationStyle.directness}
                                {soulPrintData.previousSnapshot.communicationStyle.tone !== soulPrintData.latestSnapshot.communicationStyle.tone && (
                                  <span className="text-yellow-400"> → Now more {soulPrintData.latestSnapshot.communicationStyle.tone}</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Personality */}
                      {soulPrintData.latestSnapshot.personality && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🧠</span> Personality Profile
                          </h4>
                          <div className="p-4 bg-[#1a1a1a] rounded-xl border border-white/5 space-y-3">
                            <p className="text-gray-300 text-sm">{soulPrintData.latestSnapshot.personality.overview}</p>
                            {soulPrintData.latestSnapshot.personality.strengths?.length > 0 && (
                              <div>
                                <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1.5">Strengths</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {soulPrintData.latestSnapshot.personality.strengths.map((s, i) => (
                                    <span key={i} className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] rounded-full border border-green-500/20">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Interests */}
                      {soulPrintData.latestSnapshot.interests?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>💡</span> Interests & Topics
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {soulPrintData.latestSnapshot.interests.map((interest, i) => (
                              <span key={i} className="px-2 py-1 bg-orange-500/10 text-orange-400 text-[11px] rounded-full border border-orange-500/20">
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Values */}
                      {soulPrintData.latestSnapshot.values?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>❤️</span> What You Value
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {soulPrintData.latestSnapshot.values.map((value, i) => (
                              <span key={i} className="px-2 py-1 bg-pink-500/10 text-pink-400 text-[11px] rounded-full border border-pink-500/20">
                                {value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* How to Communicate */}
                      {soulPrintData.latestSnapshot.howToCommunicate?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🤖</span> How {soulPrintData.assistantName || 'SoulPrint'} Adapts to You
                          </h4>
                          <div className="p-4 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl border border-blue-500/20">
                            <ul className="space-y-2">
                              {soulPrintData.latestSnapshot.howToCommunicate.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-gray-400 text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Unique Insights */}
                      {soulPrintData.latestSnapshot.insights?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>✨</span> Unique Insights
                          </h4>
                          <div className="space-y-2">
                            {soulPrintData.latestSnapshot.insights.map((insight, i) => (
                              <div key={i} className="p-3 bg-[#1a1a1a] rounded-lg border border-white/5">
                                <p className="text-gray-400 text-xs">{insight}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Growth Areas */}
                      {soulPrintData.latestSnapshot.growthAreas?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🌱</span> Growth Opportunities
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {soulPrintData.latestSnapshot.growthAreas.map((area, i) => (
                              <span key={i} className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-[11px] rounded-full border border-cyan-500/20">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Generated timestamp */}
                      <div className="pt-3 border-t border-white/5 text-center">
                        <p className="text-gray-600 text-[10px]">
                          Generated {new Date(soulPrintData.latestSnapshot.generatedAt).toLocaleDateString()} at {new Date(soulPrintData.latestSnapshot.generatedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Show basic data if no snapshot yet */}
                  {!soulPrintData.latestSnapshot && (
                    <>
                      {/* Communication Traits from Assessment */}
                      {soulPrintData.communicationTraits?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🎨</span> Communication Style (from Assessment)
                          </h4>
                          <div className="space-y-3">
                            {soulPrintData.communicationTraits.map((trait, i) => (
                              <div key={i} className="p-3 bg-[#1a1a1a] rounded-xl border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{trait.icon}</span>
                                    <span className="text-white text-sm font-medium">{trait.name}</span>
                                  </div>
                                  <span className="text-orange-400 text-xs font-semibold">{trait.label}</span>
                                </div>
                                {trait.value && typeof trait.value === 'number' && (
                                  <div className="h-1.5 bg-black/30 rounded-full overflow-hidden mb-2">
                                    <div className="h-full bg-gradient-to-r from-orange-500 to-purple-500 rounded-full" style={{ width: `${trait.value}%` }} />
                                  </div>
                                )}
                                <p className="text-gray-500 text-[11px]">{trait.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Soul Insights from Imports */}
                      {soulPrintData.soulInsights && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>💡</span> From Your Imported Data
                          </h4>
                          {soulPrintData.soulInsights.interests?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Interests</p>
                              <div className="flex flex-wrap gap-1.5">
                                {soulPrintData.soulInsights.interests.slice(0, 10).map((interest, i) => (
                                  <span key={i} className="px-2 py-1 bg-orange-500/10 text-orange-400 text-[11px] rounded-full border border-orange-500/20">
                                    {interest}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Prompt to generate */}
                      <div className="text-center py-6 border border-dashed border-white/10 rounded-xl">
                        <Sparkles className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm mb-2">Ready to see your full SoulPrint?</p>
                        <p className="text-gray-600 text-xs mb-4">Click "Generate SoulPrint" above to analyze all your data</p>
                      </div>
                    </>
                  )}

                  {/* No data at all */}
                  {!soulPrintData.latestSnapshot && 
                   !soulPrintData.communicationTraits?.length && 
                   !soulPrintData.soulInsights &&
                   !soulPrintData.assessmentComplete && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-gray-600" />
                      </div>
                      <p className="text-gray-500 text-sm mb-2">Build your SoulPrint</p>
                      <p className="text-gray-600 text-xs mb-4">Complete an assessment or import chat history to get started.</p>
                      <button
                        onClick={() => window.location.href = '/assessment'}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
                      >
                        Take Assessment
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">Unable to load your SoulPrint</p>
                  <button onClick={loadSoulPrint} className="mt-2 text-orange-500 text-xs hover:text-orange-400">
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* IMPORTS TAB */}
          {activeTab === 'imports' && (
            <div className="space-y-5 sm:space-y-6">
              <div>
                <h3 className="text-white text-sm font-semibold mb-1">📥 Import Your History</h3>
                <p className="text-gray-500 text-xs mb-4">Upload your ChatGPT conversation history. Support for Facebook, Claude, and other platforms coming soon!</p>
                
                {uploadProgress && (
                  <div className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <p className="text-orange-400 text-xs flex items-center gap-2 break-words">
                      <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" /> {uploadProgress}
                    </p>
                    {uploadProgress.includes('%') && (
                      <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 transition-all duration-300"
                          style={{ width: (uploadProgress.match(/(\d+)%/)?.[1] || '0') + '%' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Single Import Option */}
                <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-base font-medium">Import History</p>
                      <p className="text-gray-500 text-xs sm:text-sm mt-1 mb-3">Currently supports ChatGPT exports. Facebook, Claude, Google coming soon!</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] rounded-full">ChatGPT</span>
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded-full">Facebook</span>
                        <span className="px-2 py-0.5 bg-orange-500/10 text-orange-300 text-[10px] rounded-full">Claude</span>
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] rounded-full">Google</span>
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          window.dispatchEvent(new CustomEvent('openCloudImport'));
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors text-sm"
                      >
                        <Upload className="w-4 h-4" /> 
                        <span>Upload ZIP File</span>
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 text-[10px] mt-3 text-center">
                  🔒 Your data is processed locally. Only insights are saved, not your raw conversations.
                </p>
              </div>

              {/* Soul Profile Insights */}
              {soulProfile && (
                <div className="border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white text-sm font-semibold">✨ What I've Learned</h3>
                    <button onClick={() => setShowInsights(!showInsights)} className="text-gray-500 hover:text-white text-xs">
                      {showInsights ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  
                  {soulProfile.latestSummary && (
                    <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-blue-500/10 border border-orange-500/20 mb-3">
                      <p className="text-gray-300 text-xs leading-relaxed">{soulProfile.latestSummary}</p>
                    </div>
                  )}

                  {showInsights && (
                    <div className="space-y-3">
                      {/* Interests */}
                      {soulProfile.interests?.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">Topics You Discuss</p>
                          <div className="flex flex-wrap gap-1.5">
                            {soulProfile.interests.slice(0, 10).map((interest, i) => (
                              <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-gray-400">{interest}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Communication Style */}
                      {soulProfile.communicationStyle && Object.keys(soulProfile.communicationStyle).map(source => (
                        <div key={source}>
                          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">Style ({source})</p>
                          <div className="p-2.5 rounded-lg bg-white/3 border border-white/5">
                            <p className="text-gray-400 text-xs">{soulProfile.communicationStyle[source].description || 'Analyzed'}</p>
                            <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                              <span className="text-gray-600">Tone: <span className="text-gray-400">{soulProfile.communicationStyle[source].tone}</span></span>
                              <span className="text-gray-600">Style: <span className="text-gray-400">{soulProfile.communicationStyle[source].formality}</span></span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Insights */}
                      {soulProfile.insights?.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">Key Insights</p>
                          <ul className="space-y-1.5">
                            {soulProfile.insights.slice(0, 5).map((insight, i) => (
                              <li key={i} className="text-gray-400 text-xs flex items-start gap-2">
                                <span className="text-orange-500">•</span> {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Import History */}
              {dataImports.length > 0 && (
                <div className="border-t border-white/10 pt-5">
                  <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-3">Import History ({dataImports.length})</p>
                  <div className="space-y-2">
                    {dataImports.map(imp => (
                      <div key={imp.id} className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/5">
                        <div>
                          <p className="text-white text-xs flex items-center gap-2">
                            {imp.source === 'chatgpt' ? '💬' : '👤'} {imp.source} import
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${imp.status === 'complete' ? 'bg-green-500/20 text-green-400' : imp.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                              {imp.status}
                            </span>
                          </p>
                          <p className="text-gray-600 text-[10px]">
                            {imp.stats?.messageCount || imp.stats?.userMessageCount || imp.stats?.conversationCount
                              ? `${imp.stats.messageCount || imp.stats.userMessageCount || imp.stats.conversationCount} items analyzed`
                              : imp.stats?.analyzed ? 'Analysis complete' : '0 items analyzed'} · {new Date(imp.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INTEGRATIONS TAB */}
          {activeTab === 'integrations' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-semibold">Google Workspace</p>
                  <p className="text-gray-400 text-xs">Gmail, Calendar, Drive</p>
                </div>
              </div>
              
              <p className="text-gray-400 text-sm">
                Connect your Google account to let your AI assistant help with emails, calendar events, and files.
              </p>
              
              <a
                href="/integrations"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Manage Integrations
              </a>
              
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-blue-400 text-xs">
                  <span className="font-semibold">🔒 Privacy First:</span> Your connected accounts are encrypted and you can disconnect at any time.
                </p>
              </div>
            </div>
          )}

          {/* TELEGRAM TAB */}
          {activeTab === 'telegram' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#229ED9]/10 border border-[#229ED9]/20">
                <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="#229ED9"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.012 9.483c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.496.969z"/></svg>
                <div>
                  <p className="text-white text-sm font-semibold">Telegram Bot</p>
                  <p className="text-gray-400 text-xs">Chat with your SoulPrint via Telegram</p>
                </div>
                {telegramStatus?.linked && (
                  <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full font-bold">LINKED</span>
                )}
              </div>

              {!telegramStatus?.configured ? (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Telegram not configured</p>
                  <p className="text-gray-500 text-xs">An admin needs to add <code className="bg-white/10 px-1 rounded">TELEGRAM_BOT_TOKEN</code> to the server environment and run setup from the Admin panel.</p>
                </div>
              ) : telegramStatus?.linked ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <p className="text-green-400 text-xs font-semibold mb-1">✅ Telegram is linked!</p>
                    <p className="text-gray-400 text-xs">You can chat with your SoulPrint directly in Telegram. Type <code className="bg-white/10 px-1 rounded">/help</code> in the bot for commands.</p>
                  </div>

                  {/* Disconnect Telegram */}
                  <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-xs font-semibold">Disconnect Telegram</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">Unlink your Telegram account from SoulPrint</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('Are you sure you want to disconnect Telegram? You can re-link later.')) return;
                          try {
                            const res = await fetch('/api/telegram/unlink', {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            if (res.ok) {
                              setTelegramStatus(s => ({ ...s, linked: false }));
                            } else {
                              const d = await res.json().catch(() => ({}));
                              alert(d.error || 'Failed to disconnect');
                            }
                          } catch {
                            alert('Connection error. Please try again.');
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-colors"
                        data-testid="telegram-disconnect-btn"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  {/* AI Model selector for Telegram */}
                  <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-xs font-semibold">AI Model for Telegram</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">Choose which AI responds to your Telegram messages</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {['Dynamic', 'OpenAI', 'Claude', 'Gemini', 'Perplexity', 'Kimi'].map(group => {
                        const groupModels = TELEGRAM_MODELS.filter(m => m.group === group && !m.comingSoon);
                        if (!groupModels.length) return null;
                        return (
                          <div key={group}>
                            <p className="text-[9px] font-bold text-gray-600 tracking-widest uppercase px-1 mt-2 mb-1">{group === 'Dynamic' ? '🧠 Dynamic' : group}</p>
                            {groupModels.map(m => (
                              <button key={m.value}
                                onClick={() => saveTelegramModel(m.value)}
                                disabled={savingModel}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${telegramModel === m.value ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
                                <span>{m.label}</span>
                                {telegramModel === m.value && <span className="text-[9px] font-bold text-orange-500/70">ACTIVE</span>}
                                {m.group === 'Perplexity' && <span className="text-[9px] text-blue-400/70 ml-1">🌐 online</span>}
                                {m.isSmartMode && <span className="text-[9px] text-purple-400/70 ml-1">auto</span>}
                              </button>
                            ))}
                            {group === 'Dynamic' && (
                              <p className="text-[9px] text-gray-600 px-1 mt-1 mb-2">Auto-selects best model: code → GPT-4o, search → Sonar, creative → Claude</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {modelSaveMsg && <p className={`text-xs ${modelSaveMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{modelSaveMsg}</p>}
                    <p className="text-[10px] text-gray-700 border-t border-white/5 pt-2">
                      You can also switch models directly in Telegram with <code className="bg-white/10 px-1 rounded">/model [name]</code>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-2">
                    <p className="text-white text-xs font-semibold">How to connect:</p>
                    <ol className="text-gray-400 text-xs space-y-1.5 list-decimal list-inside">
                      <li>Open Telegram and search for <code className="bg-white/10 px-1 rounded text-orange-400">@soulprintengine_bot</code></li>
                      <li>Send <code className="bg-white/10 px-1 rounded">/start</code> to the bot</li>
                      <li>The bot will reply with a link code</li>
                      <li>Enter that code below</li>
                    </ol>
                    <a href="https://t.me/soulprintengine_bot" target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 text-xs text-[#0088cc] hover:underline mt-2">
                      💬 Open @soulprintengine_bot in Telegram
                    </a>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2 block">Enter Link Code</label>
                    <div className="flex gap-2">
                      <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())}
                        placeholder="e.g. A1B2C3D4" maxLength={8}
                        className="flex-1 bg-sp-black border border-white/10 text-white text-sm px-4 py-2.5 rounded-xl font-mono tracking-widest focus:border-orange-500/40 transition-colors" />
                      <button onClick={linkTelegramFn} disabled={linking || !linkCode.trim()}
                        className="btn-orange px-4 rounded-xl text-sm disabled:opacity-50">
                        {linking ? '...' : 'Link'}
                      </button>
                    </div>
                    {linkMsg && <p className={`text-xs mt-2 ${linkMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{linkMsg}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VOICE SETTINGS TAB */}
          {activeTab === 'voice' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-white text-sm font-semibold">🎙️ Voice Chat Settings</h3>
                <p className="text-gray-500 text-xs mt-0.5">Configure your default voice and preferences for voice conversations</p>
              </div>

              {voiceSettingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : (
                <>
                  {/* Default Voice Selection */}
                  <div className="p-4 bg-white/3 border border-white/8 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-semibold">Default Voice</p>
                        <p className="text-gray-500 text-xs">Choose the AI voice that will be used by default in voice chats</p>
                      </div>
                      {voiceSettingsSaving && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'alloy', name: 'Alloy', desc: 'Neutral & balanced' },
                        { id: 'ash', name: 'Ash', desc: 'Soft & thoughtful' },
                        { id: 'ballad', name: 'Ballad', desc: 'Warm & expressive' },
                        { id: 'coral', name: 'Coral', desc: 'Clear & friendly' },
                        { id: 'echo', name: 'Echo', desc: 'Smooth & calm' },
                        { id: 'sage', name: 'Sage', desc: 'Wise & measured' },
                        { id: 'shimmer', name: 'Shimmer', desc: 'Bright & energetic' },
                        { id: 'verse', name: 'Verse', desc: 'Dynamic & engaging' },
                      ].map(voice => (
                        <button
                          key={voice.id}
                          onClick={() => saveVoiceSetting('default_voice', voice.id)}
                          className={`p-3 rounded-xl border transition-all text-left ${
                            voiceSettings.default_voice === voice.id 
                              ? 'bg-orange-500/20 border-orange-500/50' 
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <p className={`font-medium text-sm ${voiceSettings.default_voice === voice.id ? 'text-orange-400' : 'text-white'}`}>
                            {voice.name}
                          </p>
                          <p className="text-xs text-gray-500">{voice.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Web Search Toggle */}
                  <div className="p-4 bg-white/3 border border-white/8 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${voiceSettings.web_search_enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-500'}`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">Real-time Web Search</p>
                          <p className="text-gray-500 text-xs">AI can search for current news, weather, stocks, etc. during voice calls</p>
                        </div>
                      </div>
                      <button
                        onClick={() => saveVoiceSetting('web_search_enabled', !voiceSettings.web_search_enabled)}
                        className={`w-12 h-6 rounded-full transition-colors ${voiceSettings.web_search_enabled ? 'bg-blue-500' : 'bg-gray-600'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-0.5 ${voiceSettings.web_search_enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Voice Chat Statistics */}
                  <div className="p-4 bg-gradient-to-br from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-orange-400 text-xs font-semibold">📊 Your Voice Chat Stats</p>
                      {voiceStatsLoading && <Loader2 className="w-3 h-3 animate-spin text-orange-500" />}
                    </div>
                    
                    {voiceStats ? (
                      <div className="space-y-4">
                        {/* Main Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold text-white">{voiceStats.stats.total_sessions}</p>
                            <p className="text-gray-500 text-xs">Total Sessions</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold text-white">{voiceStats.stats.total_duration_formatted}</p>
                            <p className="text-gray-500 text-xs">Total Time</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold text-white">{voiceStats.stats.avg_duration_formatted}</p>
                            <p className="text-gray-500 text-xs">Avg Duration</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold text-white">{voiceStats.stats.total_messages}</p>
                            <p className="text-gray-500 text-xs">Messages</p>
                          </div>
                        </div>

                        {/* Voice Distribution */}
                        {voiceStats.voice_distribution?.length > 0 && (
                          <div>
                            <p className="text-gray-500 text-xs mb-2">🎤 Voices Used</p>
                            <div className="flex flex-wrap gap-2">
                              {voiceStats.voice_distribution.map((v, i) => (
                                <span 
                                  key={i} 
                                  className="px-2 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400"
                                >
                                  {v.voice} <span className="text-orange-400">({v.count})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent Sessions */}
                        {voiceStats.recent_sessions?.length > 0 && (
                          <div>
                            <p className="text-gray-500 text-xs mb-2">🕐 Recent Sessions</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {voiceStats.recent_sessions.slice(0, 5).map((session, i) => (
                                <div key={i} className="flex items-center justify-between p-2 bg-white/3 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${session.status === 'completed' ? 'bg-green-500' : session.status === 'active' ? 'bg-orange-500' : 'bg-gray-500'}`} />
                                    <span className="text-white text-xs">{session.voice || 'Default'}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-gray-500 text-xs">
                                    <span>{session.message_count || 0} msgs</span>
                                    <span>{session.duration_seconds ? `${Math.round(session.duration_seconds / 60)}m` : '-'}</span>
                                    <span>{new Date(session.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* First/Last Session */}
                        {voiceStats.stats.first_session && (
                          <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-white/5">
                            <span>First: {new Date(voiceStats.stats.first_session).toLocaleDateString()}</span>
                            <span>Last: {new Date(voiceStats.stats.last_session).toLocaleDateString()}</span>
                          </div>
                        )}

                        {/* Cost Breakdown Section */}
                        {voiceStats.costs && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-green-400 text-xs font-semibold mb-3">💰 Cost Breakdown (Your Usage)</p>
                            
                            {/* Grand Total */}
                            <div className="p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg mb-3">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400 text-xs">Total Cost (All Services)</span>
                                <span className="text-xl font-bold text-green-400">${voiceStats.costs.grand_total_usd?.toFixed(2) || '0.00'}</span>
                              </div>
                            </div>

                            {/* Cost by Service */}
                            <div className="space-y-2">
                              {/* Voice Chat Costs */}
                              <div className="p-3 bg-white/3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-white text-xs font-medium">🎙️ Voice Chat</span>
                                  <span className="text-orange-400 text-sm font-semibold">${voiceStats.costs.voice.total_cost_usd?.toFixed(4) || '0.00'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                  <div>
                                    <span className="block text-gray-600">Input Tokens</span>
                                    <span className="text-gray-400">{(voiceStats.costs.voice.audio_input_tokens || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Output Tokens</span>
                                    <span className="text-gray-400">{(voiceStats.costs.voice.audio_output_tokens || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Cost/Session</span>
                                    <span className="text-gray-400">${voiceStats.costs.voice.cost_per_session?.toFixed(4) || '0.00'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Cost/Minute</span>
                                    <span className="text-gray-400">${voiceStats.costs.voice.cost_per_minute?.toFixed(4) || '0.00'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Text Chat Costs */}
                              <div className="p-3 bg-white/3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-white text-xs font-medium">💬 Text Chat</span>
                                  <span className="text-blue-400 text-sm font-semibold">${voiceStats.costs.text.estimated_cost_usd?.toFixed(4) || '0.00'}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                                  <div>
                                    <span className="block text-gray-600">Messages</span>
                                    <span className="text-gray-400">{(voiceStats.costs.text.total_messages || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Input Tokens</span>
                                    <span className="text-gray-400">{(voiceStats.costs.text.input_tokens || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Output Tokens</span>
                                    <span className="text-gray-400">{(voiceStats.costs.text.output_tokens || 0).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Media Generation Costs */}
                              {voiceStats.costs.media.total_cost_usd > 0 && (
                                <div className="p-3 bg-white/3 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-white text-xs font-medium">🖼️ Media Generation</span>
                                    <span className="text-purple-400 text-sm font-semibold">${voiceStats.costs.media.total_cost_usd?.toFixed(4) || '0.00'}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {Object.entries(voiceStats.costs.media.by_type || {}).map(([type, data]) => (
                                      <span key={type} className="px-2 py-1 bg-white/5 rounded text-gray-400">
                                        {type}: {data.count} (${data.cost?.toFixed(2)})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Pricing Note */}
                            <p className="text-gray-600 text-[10px] mt-3 italic">
                              * Costs are estimates based on OpenAI API pricing. Voice: $40/1M input, $80/1M output tokens. Text: ~$2.50/1M input, ~$10/1M output.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 text-xs">No voice chat history yet</p>
                        <p className="text-gray-600 text-xs mt-1">Start a voice conversation to see your stats!</p>
                      </div>
                    )}
                  </div>

                  {/* Voice Chat Tips */}
                  <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                    <p className="text-purple-400 text-xs font-semibold mb-2">💡 Tips for Voice Chat</p>
                    <ul className="space-y-1.5 text-gray-400 text-xs">
                      <li>• Click the waveform icon 🎙️ in the chat input area to start a voice conversation</li>
                      <li>• You can preview any voice before starting by clicking the play button</li>
                      <li>• Say "search for..." or ask about current events to trigger web search</li>
                      <li>• Your conversation transcript is saved when you end the call</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SCHEDULES TAB */}
          {activeTab === 'schedules' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-sm font-semibold">⏰ Scheduled Tasks</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Receive recurring briefings via Telegram</p>
                </div>
                <button
                  onClick={() => { setShowCreateForm(true); setScheduleError(''); }}
                  className="btn-orange px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" /> New Schedule
                </button>
              </div>

              {!telegramStatus?.linked && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Link Telegram first</p>
                  <p className="text-gray-500 text-xs">You need to link your Telegram account to receive scheduled briefings. Go to the Telegram tab above to set it up.</p>
                </div>
              )}

              {/* Create form */}
              {showCreateForm && (
                <div className="p-4 rounded-xl bg-white/3 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-white text-sm font-semibold">Create New Schedule</p>
                    <button onClick={() => setShowCreateForm(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>

                  {/* Templates */}
                  <div>
                    <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">Quick Templates</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SCHEDULE_TEMPLATES.filter(t => t.id !== 'custom').map(t => (
                        <button
                          key={t.id}
                          onClick={() => selectTemplate(t)}
                          className={`p-2.5 rounded-lg text-left text-xs border transition-colors ${selectedTemplate === t.id ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-white/3 border-white/5 text-gray-400 hover:text-white'}`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Name</label>
                    <input
                      value={newSchedule.name}
                      onChange={e => setNewSchedule(p => ({ ...p, name: e.target.value }))}
                      placeholder="AI News Digest"
                      className="w-full bg-sp-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:border-orange-500/40 transition-colors"
                    />
                  </div>

                  {/* Prompt */}
                  <div>
                    <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Prompt</label>
                    <textarea
                      value={newSchedule.prompt}
                      onChange={e => setNewSchedule(p => ({ ...p, prompt: e.target.value }))}
                      placeholder="Summarize the top 5 AI news stories..."
                      rows={3}
                      className="w-full bg-sp-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:border-orange-500/40 transition-colors resize-none"
                    />
                  </div>

                  {/* Time settings */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Hour</label>
                      <select
                        value={newSchedule.local_hour}
                        onChange={e => setNewSchedule(p => ({ ...p, local_hour: parseInt(e.target.value) }))}
                        className="w-full bg-sp-black border border-white/10 text-white text-sm px-2 py-2 rounded-lg"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Timezone</label>
                      <select
                        value={newSchedule.timezone_label}
                        onChange={e => {
                          const tz = TIMEZONES.find(t => t.label === e.target.value);
                          setNewSchedule(p => ({ ...p, timezone_label: e.target.value, timezone_offset: tz?.offset || 0 }));
                        }}
                        className="w-full bg-sp-black border border-white/10 text-white text-sm px-2 py-2 rounded-lg"
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz.label} value={tz.label}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Frequency</label>
                      <select
                        value={newSchedule.schedule_type}
                        onChange={e => setNewSchedule(p => ({ ...p, schedule_type: e.target.value }))}
                        className="w-full bg-sp-black border border-white/10 text-white text-sm px-2 py-2 rounded-lg"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="weekends">Weekends</option>
                      </select>
                    </div>
                  </div>

                  {scheduleError && <p className="text-xs text-red-400">{scheduleError}</p>}

                  <button
                    onClick={createSchedule}
                    disabled={creatingSchedule || !newSchedule.name || !newSchedule.prompt}
                    className="w-full btn-orange py-2.5 rounded-lg text-sm disabled:opacity-50"
                  >
                    {creatingSchedule ? 'Creating...' : 'Create Schedule'}
                  </button>
                </div>
              )}

              {/* Schedules list */}
              {loadingSchedules ? (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-3">
                    <RefreshCw className="w-5 h-5 text-orange-500/50" />
                  </div>
                  <p className="text-gray-500 text-xs">No scheduled tasks yet</p>
                  <p className="text-gray-700 text-[10px] mt-1">Create one to get recurring briefings via Telegram!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map(task => (
                    <div key={task.id} className="p-3 rounded-xl bg-white/3 border border-white/8">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium truncate">{task.name}</p>
                            {task.active ? (
                              <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">ACTIVE</span>
                            ) : (
                              <span className="text-[9px] bg-gray-500/20 text-gray-500 px-1.5 py-0.5 rounded font-bold">PAUSED</span>
                            )}
                          </div>
                          <p className="text-gray-600 text-[10px] mt-0.5 flex items-center gap-2">
                            <span>{task.schedule_type} at {String(task.local_hour).padStart(2, '0')}:{String(task.minute || 0).padStart(2, '0')} {task.timezone_label}</span>
                            {task.run_count > 0 && <span>· {task.run_count} runs</span>}
                          </p>
                          <p className="text-gray-700 text-[10px] mt-1 truncate">{task.prompt}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleSchedule(task.id, !task.active)}
                            className={`px-2 py-1 text-[10px] rounded border transition-colors ${task.active ? 'text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10' : 'text-green-400 border-green-500/30 hover:bg-green-500/10'}`}
                          >
                            {task.active ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => deleteSchedule(task.id)}
                            className="px-2 py-1 text-[10px] text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-white/5">
                <p className="text-[10px] text-gray-700">
                  💡 You can also manage schedules via Telegram: <code className="bg-white/10 px-1 rounded">/schedule</code> to create, <code className="bg-white/10 px-1 rounded">/schedule list</code> to view all.
                </p>
              </div>
            </div>
          )}

          {/* MEMORIES TAB */}
          {activeTab === 'memories' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-500/10 to-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <h4 className="text-white text-sm font-medium mb-1">🧠 Long-Term Memory</h4>
                <p className="text-gray-500 text-xs">
                  Important facts about you that the AI remembers across ALL conversations. Memories are auto-extracted from chats and can also be added manually.
                </p>
                <p className="text-gray-500 text-[10px] mt-2">
                  💡 <span className="text-blue-400">Tip:</span> Say "Remember that..." in chat to instantly save to memory
                </p>
              </div>

              {/* How Memories Work - Expandable Info Panel */}
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/8 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">ℹ️</span>
                    <span className="text-white text-sm font-medium">How do memories work?</span>
                  </div>
                  <span className="text-gray-500 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-2 p-4 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-white/10 rounded-lg space-y-4">
                  
                  {/* Where Stored */}
                  <div>
                    <h5 className="text-white text-xs font-semibold mb-2">🔒 Where Are Memories Stored?</h5>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Your memories are stored securely in our cloud database, associated only with your account. They are:
                    </p>
                    <ul className="text-gray-500 text-xs mt-2 space-y-1">
                      <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Private - Only accessible to you</li>
                      <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Cloud-synced - Available across all devices</li>
                      <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Deletable - Remove any memory anytime</li>
                      <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Exportable - Download your data (GDPR)</li>
                    </ul>
                  </div>

                  {/* What Gets Saved */}
                  <div>
                    <h5 className="text-white text-xs font-semibold mb-2">📝 What Gets Saved?</h5>
                    <p className="text-gray-400 text-xs mb-2">SoulPrint automatically detects important info you share:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-white/5 rounded">
                        <span className="text-pink-400">Personal</span>
                        <p className="text-gray-600 text-[10px]">Name, birthday, preferences</p>
                      </div>
                      <div className="p-2 bg-white/5 rounded">
                        <span className="text-red-400">Health</span>
                        <p className="text-gray-600 text-[10px]">Allergies, medications</p>
                      </div>
                      <div className="p-2 bg-white/5 rounded">
                        <span className="text-purple-400">Relationships</span>
                        <p className="text-gray-600 text-[10px]">Family, pets, friends</p>
                      </div>
                      <div className="p-2 bg-white/5 rounded">
                        <span className="text-green-400">Work</span>
                        <p className="text-gray-600 text-[10px]">Job, company, projects</p>
                      </div>
                    </div>
                  </div>

                  {/* How Used */}
                  <div>
                    <h5 className="text-white text-xs font-semibold mb-2">✨ How Are Memories Used?</h5>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Your memories personalize every conversation. The AI naturally references them 
                      (e.g., "How's your dog Max?"), prioritizes health/safety info, and adapts to your preferences.
                    </p>
                  </div>

                  {/* Security Note */}
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-blue-400 text-[10px]">
                      🔐 <strong>Security:</strong> Memories are encrypted in transit and at rest. We never sell or share your personal data. 
                      You can delete all memories or your entire account at any time from Privacy settings.
                    </p>
                  </div>
                </div>
              </details>

              {/* Add Memory Form */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="Add a fact about yourself... (e.g., 'I am allergic to peanuts')"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500/40 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                  />
                  <button onClick={addMemory} disabled={!newMemory.trim()} className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors disabled:opacity-50">
                    Add
                  </button>
                </div>
                <select
                  value={newMemoryCategory}
                  onChange={(e) => setNewMemoryCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-400 text-xs"
                >
                  {memoryCategories.map(cat => (
                    <option key={cat} value={cat}>Category: {cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Memory Status & Refresh */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {memoriesLoading ? (
                    <div className="flex items-center gap-2 text-blue-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading memories...
                    </div>
                  ) : memoriesLoaded ? (
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${memories.length > 0 ? 'bg-green-500' : 'bg-orange-500'}`} />
                      <span className="text-gray-400 text-xs">
                        {memories.length > 0 
                          ? `${memories.length} memories stored` 
                          : 'No memories yet'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-600 text-xs">Click to load memories</span>
                  )}
                </div>
                <button 
                  onClick={loadMemories} 
                  disabled={memoriesLoading}
                  className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-500 hover:text-white text-xs transition-colors disabled:opacity-50"
                >
                  {memoriesLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh
                </button>
              </div>

              {/* Memories List */}
              {memoriesLoaded && memories.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {memories.map(mem => (
                    <div key={mem.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                      mem.category === 'health' ? 'bg-red-500/5 border-red-500/20' :
                      mem.category === 'preferences' ? 'bg-blue-500/5 border-blue-500/20' :
                      mem.category === 'relationships' ? 'bg-pink-500/5 border-pink-500/20' :
                      mem.category === 'work' ? 'bg-green-500/5 border-green-500/20' :
                      'bg-white/5 border-white/10'
                    }`}>
                      <div className="flex-1">
                        <p className="text-white text-sm">{mem.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            mem.category === 'health' ? 'bg-red-500/20 text-red-400' :
                            mem.category === 'preferences' ? 'bg-blue-500/20 text-blue-400' :
                            mem.category === 'relationships' ? 'bg-pink-500/20 text-pink-400' :
                            mem.category === 'work' ? 'bg-green-500/20 text-green-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {mem.category}
                          </span>
                          <span className="text-gray-600 text-[10px]">{mem.source === 'auto' ? '🤖 Auto' : '✍️ Manual'}</span>
                          {mem.importance === 'high' && <span className="text-orange-400 text-[10px]">⚠️ Important</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteMemory(mem.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : memoriesLoaded ? (
                <div className="text-center py-6 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                  <div className="text-3xl mb-2">🧠</div>
                  <p className="text-gray-400 text-sm mb-1">No memories stored yet</p>
                  <p className="text-gray-600 text-xs">Chat with the AI and important facts will be automatically remembered, or add them manually above.</p>
                </div>
              ) : (
                <div className="text-center py-6 bg-white/5 border border-white/10 rounded-xl">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Loading your memories...</p>
                </div>
              )}
            </div>
          )}

          {/* INVITES TAB */}
          {activeTab === 'invites' && (
            <div className="space-y-5">
              {invitesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 text-orange-400 animate-spin mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Loading your invites...</p>
                </div>
              ) : !invitesData?.enabled ? (
                <div className="text-center py-8 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-3xl mb-3 block">🔒</span>
                  <h4 className="text-white text-sm font-medium mb-2">Invites Coming Soon</h4>
                  <p className="text-gray-500 text-xs">The invite system is not currently active.</p>
                </div>
              ) : (
                <>
                  {/* Invite Stats */}
                  <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white text-sm font-medium">🎁 Invite Friends to SoulPrint</h4>
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/20 rounded-lg">
                        <span className="text-orange-400 text-xs font-bold">{invitesData?.invites_remaining ?? 0}</span>
                        <span className="text-orange-400/70 text-[10px]">left</span>
                      </div>
                    </div>
                    <p className="text-gray-400 text-xs">
                      Share your unique invite link with friends. They'll get instant access, and you'll earn badges!
                    </p>
                  </div>

                  {/* Invite Code & Link */}
                  <div className="bg-[#0d1117] border border-white/10 rounded-xl p-4 space-y-3">
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Your Invite Code</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-orange-400 font-mono text-lg tracking-wider text-center">
                          {invitesData?.invite_code || '--------'}
                        </code>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Shareable Link</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={invitesData?.invite_code && typeof window !== 'undefined' ? `${window.location.origin}/invite/${invitesData.invite_code}` : ''}
                          className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm truncate"
                        />
                        <button
                          onClick={copyInviteLink}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                            inviteLinkCopied 
                              ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
                              : 'bg-orange-500 hover:bg-orange-600 text-white'
                          }`}
                        >
                          {inviteLinkCopied ? (
                            <><Check className="w-4 h-4" /> Copied!</>
                          ) : (
                            <><Copy className="w-4 h-4" /> Copy</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  {invitesData?.all_badges?.length > 0 && (
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-3 block">Invite Badges</label>
                      <div className="grid grid-cols-2 gap-2">
                        {invitesData.all_badges.map(badge => {
                          const earned = invitesData.badges?.some(b => b.id === badge.id);
                          return (
                            <div 
                              key={badge.id}
                              className={`p-3 rounded-xl border ${
                                earned 
                                  ? 'bg-orange-500/10 border-orange-500/30' 
                                  : 'bg-white/3 border-white/10 opacity-50'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{badge.icon}</span>
                                <span className={`text-xs font-medium ${earned ? 'text-orange-400' : 'text-gray-500'}`}>
                                  {badge.name}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-500">{badge.description}</p>
                              {!earned && (
                                <p className="text-[9px] text-gray-600 mt-1">Invite {badge.threshold} friend{badge.threshold > 1 ? 's' : ''} to unlock</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Invited Users */}
                  {invitesData?.invited_users?.length > 0 && (
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-3 block">
                        Friends You've Invited ({invitesData.invites_used || 0})
                      </label>
                      <div className="space-y-2">
                        {invitesData.invited_users.map((user, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{user.email}</p>
                              <p className="text-gray-500 text-[10px]">
                                Joined {new Date(user.joined_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Who invited you */}
                  {invitesData?.invited_by && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                      <p className="text-purple-400 text-xs">
                        <span className="text-purple-300 font-medium">{invitesData.invited_by.name}</span> invited you to SoulPrint ✨
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ANNOUNCEMENTS TAB */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4">
                <h4 className="text-white text-sm font-medium mb-1">📢 Announcements</h4>
                <p className="text-gray-500 text-xs">
                  View all announcements, including ones you've dismissed. Restore any announcement to see it again.
                </p>
              </div>

              <button 
                onClick={loadAllAnnouncements}
                className="w-full py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-2"
              >
                {announcementsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Load Announcements
                  </>
                )}
              </button>

              {allAnnouncements.length > 0 ? (
                <div className="space-y-3">
                  {allAnnouncements.map(ann => (
                    <div 
                      key={ann.id}
                      className={`p-4 rounded-xl border ${
                        ann.permanently_dismissed 
                          ? 'bg-red-500/5 border-red-500/20 opacity-60' 
                          : ann.temporarily_dismissed 
                            ? 'bg-yellow-500/5 border-yellow-500/20 opacity-80'
                            : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-white text-sm font-medium">{ann.title}</h4>
                            {ann.permanently_dismissed && (
                              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] rounded">Dismissed Forever</span>
                            )}
                            {ann.temporarily_dismissed && !ann.permanently_dismissed && (
                              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[9px] rounded">Hidden 24h</span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs">{ann.content}</p>
                          {ann.link && (
                            <a href={ann.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline mt-1 inline-flex items-center gap-1">
                              View link <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <p className="text-gray-600 text-[10px] mt-2">
                            Posted: {new Date(ann.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {(ann.permanently_dismissed || ann.temporarily_dismissed) && (
                          <button
                            onClick={() => restoreAnnouncement(ann.id)}
                            className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg hover:bg-green-500/30 transition-colors flex-shrink-0"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-xs text-center py-4">
                  {announcementsLoading ? 'Loading...' : 'Click "Load Announcements" to view all announcements.'}
                </p>
              )}
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {profile && (
                <>
                  {/* Assistant Name - Editable */}
                  <div>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">Assistant Name</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingAssistantName ?? (profile.assistant_name || 'SoulPrint')}
                        onChange={e => setEditingAssistantName(e.target.value)}
                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                        placeholder="Name your AI assistant"
                      />
                      {editingAssistantName !== null && editingAssistantName !== profile.assistant_name && (
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/user/profile', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ assistant_name: editingAssistantName })
                              });
                              setProfile(p => ({ ...p, assistant_name: editingAssistantName }));
                              setAssistantName(editingAssistantName);
                              setEditingAssistantName(null);
                              alert('Assistant name updated!');
                            } catch (e) {
                              alert('Failed to update');
                            }
                          }}
                          className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Save
                        </button>
                      )}
                    </div>
                    <p className="text-gray-600 text-[10px] mt-1">This is what you'll call your AI companion</p>
                  </div>

                  {/* Display Name (Your Name) - Editable */}
                  <div>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">Your Name</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingDisplayName ?? (profile.display_name || '')}
                        onChange={e => setEditingDisplayName(e.target.value)}
                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                        placeholder="What should the AI call you?"
                      />
                      {editingDisplayName !== null && editingDisplayName !== profile.display_name && (
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/user/profile', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ display_name: editingDisplayName })
                              });
                              setProfile(p => ({ ...p, display_name: editingDisplayName }));
                              setEditingDisplayName(null);
                              alert('Your name has been updated! The AI will now call you ' + editingDisplayName);
                            } catch (e) {
                              alert('Failed to update');
                            }
                          }}
                          className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Save
                        </button>
                      )}
                    </div>
                    <p className="text-gray-600 text-[10px] mt-1">The AI will address you by this name</p>
                  </div>

                  {/* Custom Greeting - Editable */}
                  <div>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">Custom Greeting</p>
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editingCustomGreeting ?? (profile.custom_greeting || '')}
                        onChange={e => setEditingCustomGreeting(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none resize-none"
                        placeholder="Hey {name} 👋 I'm {assistant}! Ready to help you today."
                        rows={3}
                      />
                      {editingCustomGreeting !== null && editingCustomGreeting !== (profile.custom_greeting || '') && (
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await fetch('/api/user/profile', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ custom_greeting: editingCustomGreeting })
                                });
                                setProfile(p => ({ ...p, custom_greeting: editingCustomGreeting }));
                                setEditingCustomGreeting(null);
                                alert('Greeting saved! Start a new conversation to see it.');
                              } catch (e) {
                                alert('Failed to update');
                              }
                            }}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            Save Greeting
                          </button>
                          <button
                            onClick={() => setEditingCustomGreeting(null)}
                            className="px-3 py-1.5 bg-white/5 text-gray-400 text-xs rounded-lg hover:bg-white/10"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 text-[10px] mt-1.5">
                      Use <code className="bg-white/10 px-1 rounded">{'{name}'}</code> for your name and <code className="bg-white/10 px-1 rounded">{'{assistant}'}</code> for the AI name. Leave blank for default.
                    </p>
                  </div>

                  {/* Other profile fields (read-only) */}
                  {[
                    ['Field', profile.field],
                    ['Role', profile.descriptors?.join(', ')],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">{label}</p>
                      <p className="text-white text-sm">{val || '—'}</p>
                    </div>
                  ))}
                  {profile.help_with?.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Help With</p>
                      <div className="flex flex-wrap gap-1">
                        {profile.help_with.map(h => (
                          <span key={h} className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Soul Profile Section */}
              {soulProfile && (
                <div className="pt-5 border-t border-white/10">
                  <h3 className="text-white text-sm font-semibold mb-3">🧠 Soul Profile</h3>
                  
                  {soulProfile.latestSummary && (
                    <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-blue-500/10 border border-blue-500/20 mb-4">
                      <p className="text-gray-300 text-xs leading-relaxed">{soulProfile.latestSummary}</p>
                    </div>
                  )}
                  
                  {/* Communication Style */}
                  {soulProfile.communicationStyle && Object.keys(soulProfile.communicationStyle).length > 0 && (
                    <div className="mb-4">
                      <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">💬 Communication Style</p>
                      {Object.entries(soulProfile.communicationStyle).map(([source, style]) => style && (
                        <div key={source} className="text-xs text-gray-400 mb-2">
                          <span className="text-white capitalize">{source}:</span> {style.formality || 'mixed'} formality, {style.verbosity || 'balanced'} verbosity, {style.tone || 'neutral'} tone
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Interests */}
                  {soulProfile.interests?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">🎯 Topics of Interest</p>
                      <div className="flex flex-wrap gap-1">
                        {soulProfile.interests.slice(0, 10).map(i => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">{i}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Insights */}
                  {soulProfile.insights?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">✨ Personality Insights</p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        {soulProfile.insights.slice(0, 5).map((ins, i) => (
                          <li key={i}>• {ins}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Export Profile Section */}
              <div className="pt-5 border-t border-white/10">
                <h3 className="text-white text-sm font-semibold mb-2">📤 Export Profile</h3>
                <p className="text-gray-500 text-xs mb-4">
                  Download your complete SoulPrint profile as a markdown file. This includes your assessment answers, communication style, and personality insights.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/user/profile/export', { headers: { Authorization: `Bearer ${token}` } });
                      const data = await res.json();
                      if (data.markdown) {
                        const blob = new Blob([data.markdown], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = data.filename || 'soulprint-profile.md';
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    } catch (e) {
                      console.error('Export error:', e);
                    }
                  }}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-500/20 to-blue-500/20 border border-blue-500/30 rounded-lg text-white text-sm hover:from-blue-500/30 hover:to-blue-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Profile (Markdown)
                </button>
                <p className="text-gray-700 text-[10px] mt-2 text-center">Same profile powers both web & Telegram</p>
              </div>

              {/* Retake Assessment Section */}
              <div className="pt-5 border-t border-white/10">
                <h3 className="text-white text-sm font-semibold mb-2">📋 Retake Assessment</h3>
                <p className="text-gray-500 text-xs mb-4">
                  Your SoulPrint personality assessment helps me understand your communication style, preferences, and goals. 
                  You can retake it anytime to update your profile.
                </p>
                <button
                  onClick={() => setShowAssessmentChoice(true)}
                  className="w-full py-2.5 px-4 bg-white/5 border border-white/10 rounded-lg text-white text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake Assessment
                </button>
                <p className="text-gray-700 text-[10px] mt-2 text-center">Your previous answers will be archived</p>
              </div>

              {/* Assessment Choice Modal */}
              {showAssessmentChoice && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                  <div className="bg-[#141a21] border border-white/10 rounded-2xl p-6 max-w-md w-full">
                    <h2 className="text-white font-semibold text-lg mb-2">Choose Assessment Type</h2>
                    <p className="text-gray-500 text-sm mb-6">Your previous answers will be archived. Select which assessment you'd like to take:</p>
                    
                    <div className="space-y-3">
                      {/* Quick Start Option */}
                      <button
                        onClick={() => handleResetAssessment('quick')}
                        className="w-full p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl text-left hover:border-green-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-green-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-medium group-hover:text-green-300 transition-colors">Quick Start</h3>
                            <p className="text-gray-500 text-xs mt-0.5">6 questions now • Full profile over time</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs mt-3">Start chatting quickly. I'll ask the remaining questions naturally during our conversations to build your complete 6-pillar profile.</p>
                      </button>
                      
                      {/* Full Assessment Option */}
                      <button
                        onClick={() => handleResetAssessment('full')}
                        className="w-full p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl text-left hover:border-orange-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-orange-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-medium group-hover:text-orange-300 transition-colors">Full Assessment</h3>
                            <p className="text-gray-500 text-xs mt-0.5">36 questions • ~10 minutes</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs mt-3">Complete all 6 pillars now for the most accurate profile from the start.</p>
                      </button>
                    </div>
                    
                    <button
                      onClick={() => setShowAssessmentChoice(false)}
                      className="w-full mt-4 py-2 text-gray-500 hover:text-white text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Install App Section */}
              <div className="pt-5 border-t border-white/10">
                <h3 className="text-white text-sm font-semibold mb-2">📱 Install App</h3>
                <p className="text-gray-500 text-xs mb-4">
                  Install SoulPrint on your device for quick access and a full-screen experience without browser UI.
                </p>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <p className="text-xs text-orange-300 font-medium mb-2">🖥️ Desktop (Chrome/Edge)</p>
                    <p className="text-[10px] text-orange-200/70">
                      Look for the install icon (⊕) in your browser's address bar, or use the browser menu → "Install SoulPrint"
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs text-blue-300 font-medium mb-2">📱 iOS (Safari)</p>
                    <p className="text-[10px] text-blue-200/70">
                      Tap Share → "Add to Home Screen" → "Add"
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-300 font-medium mb-2">📱 Android (Chrome)</p>
                    <p className="text-[10px] text-green-200/70">
                      Tap the menu (⋮) → "Install app" or "Add to Home screen"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRIVACY TAB */}
          {activeTab === 'privacy' && (
            <PrivacyTab token={token} />
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <AppearanceTab />
          )}

          {/* FEEDBACK TAB */}
          {activeTab === 'feedback' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-white text-sm font-semibold mb-1">💬 Share Your Feedback</h3>
                <p className="text-gray-500 text-xs mb-4">Help us improve SoulPrint! Your feedback is invaluable.</p>
              </div>

              {/* Quick feedback buttons */}
              <div className="space-y-3">
                <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">How's your experience?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFeedbackType('love')}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${feedbackType === 'love' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/5'}`}
                  >
                    <span className="text-lg">😍</span>
                    <p className="text-[10px] mt-1">Love it!</p>
                  </button>
                  <button 
                    onClick={() => setFeedbackType('good')}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${feedbackType === 'good' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/5'}`}
                  >
                    <span className="text-lg">👍</span>
                    <p className="text-[10px] mt-1">It's good</p>
                  </button>
                  <button 
                    onClick={() => setFeedbackType('issue')}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${feedbackType === 'issue' ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/5'}`}
                  >
                    <span className="text-lg">🐛</span>
                    <p className="text-[10px] mt-1">Found issue</p>
                  </button>
                  <button 
                    onClick={() => setFeedbackType('idea')}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${feedbackType === 'idea' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/5'}`}
                  >
                    <span className="text-lg">💡</span>
                    <p className="text-[10px] mt-1">Have idea</p>
                  </button>
                </div>
              </div>

              {/* Feedback text area */}
              <div>
                <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Your feedback</label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={feedbackType === 'issue' ? "Describe the issue you encountered..." : feedbackType === 'idea' ? "Tell us your idea..." : "Share your thoughts..."}
                  className="w-full h-28 bg-sp-black border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-600 resize-none focus:border-orange-500/40 focus:outline-none"
                />
              </div>

              {/* Screenshot attachment */}
              <div>
                <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Screenshot (optional)</label>
                <input 
                  type="file" 
                  ref={feedbackFileRef} 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      alert('Only image files are allowed');
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      alert('File size must be less than 5MB');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const base64 = ev.target.result.split(',')[1];
                      setFeedbackAttachment({
                        name: file.name,
                        mimeType: file.type,
                        base64,
                        preview: ev.target.result,
                      });
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                {feedbackAttachment ? (
                  <div className="relative inline-block">
                    <img 
                      src={feedbackAttachment.preview} 
                      alt="Screenshot" 
                      className="w-24 h-20 object-cover rounded-xl border-2 border-orange-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setFeedbackAttachment(null)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <p className="text-[10px] text-gray-500 mt-1 truncate max-w-[96px]">{feedbackAttachment.name}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => feedbackFileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-dashed border-white/20 rounded-xl text-gray-400 hover:bg-white/10 hover:border-white/30 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-xs">Attach screenshot</span>
                  </button>
                )}
              </div>

              {/* Submit button */}
              <button
                onClick={async () => {
                  if (!feedbackText.trim()) return;
                  setFeedbackSubmitting(true);
                  try {
                    const payload = { 
                      category: feedbackType === 'issue' ? 'bug' : feedbackType === 'idea' ? 'feature' : 'general',
                      message: feedbackText,
                      rating: feedbackType === 'love' ? 5 : feedbackType === 'good' ? 4 : null
                    };
                    
                    // Include attachment if present
                    if (feedbackAttachment) {
                      payload.attachment = {
                        name: feedbackAttachment.name,
                        mimeType: feedbackAttachment.mimeType,
                        base64: feedbackAttachment.base64,
                      };
                    }
                    
                    await fetch('/api/user-feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify(payload),
                    });
                    setFeedbackText('');
                    setFeedbackType('');
                    setFeedbackAttachment(null);
                    setFeedbackSubmitted(true);
                    setTimeout(() => setFeedbackSubmitted(false), 3000);
                  } catch (e) {
                    console.error('Feedback error:', e);
                  }
                  setFeedbackSubmitting(false);
                }}
                disabled={!feedbackText.trim() || feedbackSubmitting}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {feedbackSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : feedbackSubmitted ? (
                  <><ThumbsUp className="w-4 h-4" /> Thank you!</>
                ) : (
                  <><Send className="w-4 h-4" /> Send Feedback</>
                )}
              </button>

              {/* Contact options */}
              <div className="pt-4 border-t border-white/10">
                <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-3">Other ways to reach us</p>
                <div className="space-y-2">
                  <a href="mailto:team@archeforge.com" className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <span className="text-sm">📧</span>
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">Email</p>
                      <p className="text-gray-600 text-[10px]">team@archeforge.com</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Legal Links Footer */}
          <div className="mt-6 pt-4 border-t border-white/10">
            {/* Logout Button */}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to log out?')) {
                  localStorage.removeItem('sp_token');
                  localStorage.removeItem('sp_user');
                  window.location.href = '/auth';
                }
              }}
              className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
            
            <div className="flex items-center justify-center gap-4">
              <Link href="/terms" className="text-gray-500 text-xs hover:text-orange-500 transition-colors">
                Terms of Service
              </Link>
              <span className="text-gray-700">•</span>
              <Link href="/privacy" className="text-gray-500 text-xs hover:text-orange-500 transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Attachment preview pill
function AttachmentPill({ att, onRemove, onGenerateJson }) {
  const isImage = att.type === 'image';
  return (
    <div className="relative group">
      {isImage ? (
        <div className="relative">
          <img 
            src={`data:${att.mimeType};base64,${att.base64}`} 
            alt={att.name} 
            className="w-16 h-16 object-cover rounded-xl border-2 border-orange-500/40 shadow-lg" 
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl px-1 py-0.5">
            <span className="text-[8px] text-white truncate block">{att.name}</span>
          </div>
          {/* Generate JSON button for images */}
          {onGenerateJson && (
            <button 
              onClick={() => onGenerateJson(att)}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-500 rounded-full text-[8px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-lg whitespace-nowrap"
              title="Generate image config JSON"
            >
              <Code className="w-2.5 h-2.5" /> JSON
            </button>
          )}
        </div>
      ) : (
        <div className="w-16 h-16 bg-white/10 border-2 border-orange-500/40 rounded-xl flex flex-col items-center justify-center p-1 shadow-lg">
          <FileText className="w-5 h-5 text-orange-400" />
          <span className="text-[8px] text-gray-300 truncate w-full text-center mt-0.5">{att.name}</span>
        </div>
      )}
      <button 
        onClick={onRemove} 
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3 text-white" />
      </button>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { isDark } = useTheme(); // Get theme state for input styling
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingStalled, setStreamingStalled] = useState(false); // Track if streaming seems stalled
  const [lastChunkTime, setLastChunkTime] = useState(null); // Track last chunk received time
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [searchQueries, setSearchQueries] = useState([]);
  const [streamingSources, setStreamingSources] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedModel, setSelectedModel] = useState('smart');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showVideoModelPicker, setShowVideoModelPicker] = useState(false);
  const [defaultModelSaved, setDefaultModelSaved] = useState(null); // persisted default
  const [defaultVideoModelSaved, setDefaultVideoModelSaved] = useState('smart');
  const [defaultImageModelSaved, setDefaultImageModelSaved] = useState('smart');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState(null); // For opening settings to specific tab
  const [showVoiceChat, setShowVoiceChat] = useState(false); // For voice conversations
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(true); // Feature flag from admin
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop sidebar collapse state
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [user, setUser] = useState(null);
  const [assistantName, setAssistantName] = useState('SoulPrint');
  const [token, setToken] = useState('');
  const [attachments, setAttachments] = useState([]); // [{type, base64/text, name, mimeType}]
  const [pendingMediaAttachment, setPendingMediaAttachment] = useState(null); // For regeneration with source image
  const [lastSmartSelection, setLastSmartSelection] = useState(null); // Track which model Dynamic Intelligence selected
  const [fileError, setFileError] = useState('');
  // Location state
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [locationError, setLocationError] = useState(null);
  // Conversation management state
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [convMenuId, setConvMenuId] = useState(null); // which conversation's menu is open
  const [searchQuery, setSearchQuery] = useState(''); // conversation search
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const searchTimeoutRef = useRef(null);
  // Projects state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null); // null = all, 'general' = uncategorized, or project id
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState('create'); // 'create' | 'edit' | 'share'
  const [editingProject, setEditingProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectInstructions, setNewProjectInstructions] = useState(''); // Custom AI instructions for project
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('collaborator');
  const [projectShareLink, setProjectShareLink] = useState(null);
  const [showMoveToProject, setShowMoveToProject] = useState(false);
  const [movingConversation, setMovingConversation] = useState(null);
  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState([]);
  // Media generation state
  const [streamingImageUrl, setStreamingImageUrl] = useState(null);
  const [streamingRevPrompt, setStreamingRevPrompt] = useState('');
  const [streamingVideoTask, setStreamingVideoTask] = useState(null); // { taskId, status, prompt }
  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState([]); // [{ model, provider }]
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResponses, setCompareResponses] = useState(null); // { responses: [], comparisonId, userMessageId }
  const [selectedCompareResponse, setSelectedCompareResponse] = useState(null);
  // Gallery & Media generation state
  const [showGallery, setShowGallery] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [selectedGalleryItem, setSelectedGalleryItem] = useState(null);
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  // Cloud import state
  const [showCloudImport, setShowCloudImport] = useState(false);
  // Latest news state
  const [latestNews, setLatestNews] = useState([]);
  const [showNewsExpanded, setShowNewsExpanded] = useState(false);
  // What's New (App Updates) state
  const [appUpdates, setAppUpdates] = useState([]);
  const [appUpdatesUnread, setAppUpdatesUnread] = useState(0);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  // Gradual assessment state
  const [gradualQuestion, setGradualQuestion] = useState(null);
  const [gradualAnswer, setGradualAnswer] = useState('');
  const [gradualProgress, setGradualProgress] = useState(null);
  const [showGradualPrompt, setShowGradualPrompt] = useState(false);
  const [submittingGradual, setSubmittingGradual] = useState(false);
  // PWA Install prompt state
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  // Onboarding modal state
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Media intent detection state (for natural language generation requests)
  const [detectedMediaIntent, setDetectedMediaIntent] = useState(null); // 'image' | 'video' | null
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [mediaOptionsExpanded, setMediaOptionsExpanded] = useState(false);
  const [quickAspectRatio, setQuickAspectRatio] = useState('1:1');
  const [quickVideoLength, setQuickVideoLength] = useState('5');
  const [selectedImageModel, setSelectedImageModel] = useState('smart');
  const [selectedVideoModel, setSelectedVideoModel] = useState('smart');
  // Visual content generation state (flyers, infographics, images)
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [visualGenerationType, setVisualGenerationType] = useState(''); // 'flyer', 'infographic', 'image'
  // Image-to-JSON generation state
  const [generatingImageJson, setGeneratingImageJson] = useState(false);
  const [imageJsonResult, setImageJsonResult] = useState(null);
  const [showImageJsonModal, setShowImageJsonModal] = useState(false);
  // Image editing state
  const [editableImage, setEditableImage] = useState(null); // { url, base64, source: 'upload'|'generated', messageId }
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  // Mockup generator state
  const [showMockupGenerator, setShowMockupGenerator] = useState(false);
  const [mockupDesign, setMockupDesign] = useState(null);
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
  const streamingImageUrlRef = useRef(null);
  const streamingVideoTaskRef = useRef(null);
  const streamingSourcesRef = useRef([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null); // For stopping requests
  const modelPickerRef = useRef(null); // For click-outside detection on model dropdown
  const videoModelPickerRef = useRef(null); // For click-outside detection on video model dropdown
  const [interimText, setInterimText] = useState('');

  // Keep refs in sync with state
  useEffect(() => { streamingImageUrlRef.current = streamingImageUrl; }, [streamingImageUrl]);
  useEffect(() => { streamingVideoTaskRef.current = streamingVideoTask; }, [streamingVideoTask]);
  useEffect(() => { streamingSourcesRef.current = streamingSources; }, [streamingSources]);

  // ── Global Media Notification System ──
  // Polls /api/media/pending for completed tasks across ALL conversations
  // Shows toast notifications when media finishes generating
  const { toast } = useToast();
  const notifiedTasksRef = useRef(new Set());
  const mediaPollIntervalRef = useRef(null);
  const conversationIdRef = useRef(conversationId);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  useEffect(() => {
    if (!token) return;
    
    const pollPendingMedia = async () => {
      try {
        const res = await fetch('/api/media/pending', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const tasks = await res.json();
        
        for (const task of tasks) {
          if (task.status === 'success' && !notifiedTasksRef.current.has(task.taskId)) {
            notifiedTasksRef.current.add(task.taskId);
            
            // Only show notification if user is NOT in the same conversation
            const isInSameConv = conversationIdRef.current === task.conversationId;
            
            // Update messages if in the same conversation
            if (isInSameConv) {
              setMessages(prev => prev.map(m => {
                if (m.video_task?.taskId === task.taskId) {
                  return { ...m, video_url: task.videoUrl, video_task: { ...m.video_task, status: 'success' } };
                }
                return m;
              }));
            }
            
            // Show toast notification
            toast({
              title: `🎬 ${task.type === 'image' ? 'Image' : 'Video'} Ready!`,
              description: isInSameConv 
                ? `Your ${task.modelLabel || 'AI'} ${task.type || 'video'} is ready.`
                : `${task.modelLabel || 'AI'} ${task.type || 'video'} ready in "${task.conversationTitle}". Click to view.`,
              duration: 6000,
              className: 'bg-[#1a1f2e] border-orange-500/30 text-white cursor-pointer',
            });
          }
        }
      } catch (e) {
        // Silently fail
      }
    };
    
    // Poll every 10 seconds
    pollPendingMedia();
    mediaPollIntervalRef.current = setInterval(pollPendingMedia, 10000);
    
    return () => {
      if (mediaPollIntervalRef.current) clearInterval(mediaPollIntervalRef.current);
    };
  }, [token, toast]);

  // Handle URL params to open settings with specific tab (e.g., /chat?settings=telegram)
  useEffect(() => {
    const settingsTab = searchParams.get('settings');
    if (settingsTab && token) {
      setSettingsInitialTab(settingsTab);
      setShowSettings(true);
      // Clean up URL
      router.replace('/chat', { scroll: false });
    }
  }, [searchParams, token, router]);

  // Capture the beforeinstallprompt event for PWA install
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Media intent detection function
  const detectMediaIntent = useCallback((text) => {
    if (!text || text.length > 500) return null;
    const lower = text.toLowerCase().trim();
    
    // Negative patterns - don't trigger on these common false positives
    const negativePatterns = [
      /\b(how|can|could|would|should|do|does|did|will|what|why|is|are|was|were)\b.*\b(generate|create|make)\b/i,
      /\b(generate|create|make)\b.*\b(idea|list|plan|report|summary|code|text|content|response|email|message)\b/i,
      /\b(generate|create|make)\b.*\b(money|revenue|income|profit|leads|sales|results)\b/i,
      /\bdraw\s+(a\s+)?(conclusion|comparison|parallel|line|boundary|distinction|connection)\b/i,
      /\bpicture\s+(this|that|yourself)\b/i,
      /\bvisualize\s+(your|the\s+future|success|yourself|data|the\s+data)\b/i,
    ];
    if (negativePatterns.some(p => p.test(lower))) return null;
    
    // Video patterns - check first (more specific)
    const videoPatterns = [
      /\b(generate|create|make)\s+(a\s+|me\s+a\s+)?(video|clip|animation|short film)\b/i,
      /\banimate\s+(a|an|the|my|this)\s+\w/i,
      /\b(video|animation)\s+(of|for|about|showing)\b/i,
    ];
    if (videoPatterns.some(p => p.test(lower))) return 'video';
    
    // Image patterns - require clear generation intent
    const imagePatterns = [
      /\b(generate|create|make|draw|paint|design)\s+(me\s+)?(a|an)\s+(image|picture|photo|illustration|artwork|painting|poster|flyer|infographic|logo|banner|thumbnail|meme|wallpaper|portrait|headshot)\b/i,
      /\b(show|give)\s+me\s+(a|an)\s+(picture|image|photo|illustration)\s+(of|with|showing)\b/i,
      /\b(draw|paint|sketch|illustrate)\s+(me\s+)?(a|an|my|the)\s+\w/i,
      /\b(image|picture|photo|illustration)\s+(of|for|about|showing|with)\b.*\b(please|style|realistic|cartoon|anime)\b/i,
    ];
    if (imagePatterns.some(p => p.test(lower))) return 'image';
    
    return null;
  }, []);

  // Watch input for media intent changes
  useEffect(() => {
    const intent = detectMediaIntent(input);
    if (intent !== detectedMediaIntent) {
      setDetectedMediaIntent(intent);
      if (intent) {
        setShowMediaOptions(true);
      }
    }
  }, [input, detectMediaIntent, detectedMediaIntent]);

  // Check if we should show the install prompt
  useEffect(() => {
    if (!token) return;
    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;
    if (isStandalone) return; // Already installed
    
    // Check user preference from API
    fetch('/api/pwa/install-status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.showPrompt) {
          setShowInstallPrompt(true);
        }
      })
      .catch(() => {});
  }, [token]);

  // Handle PWA install prompt actions
  const handleInstallAction = async (action) => {
    if (action === 'install' && deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      if (result.outcome === 'accepted') {
        action = 'installed';
      } else {
        action = 'remind_later';
      }
      setDeferredInstallPrompt(null);
    }
    
    // Save preference to API
    try {
      await fetch('/api/pwa/install-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
    } catch (e) {
      console.error('Failed to save install preference:', e);
    }
    
    setShowInstallPrompt(false);
  };

  // Speech-to-text hook — needs token so init after token is set
  const speech = useSpeechRecognition({
    token,
    onTranscript: (text) => {
      setInput(prev => (prev ? prev + ' ' + text : text));
      setInterimText('');
    },
    onInterim: (text) => setInterimText(text),
  });

  useEffect(() => {
    const t = localStorage.getItem('sp_token');
    if (!t) { router.push('/auth'); return; }
    setToken(t);
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.accepted && d.role === 'user') { router.push('/waitlist'); return; }
        setUser(d);
        setAssistantName(d.profile?.assistant_name || 'SoulPrint');
        const greet = d.profile?.display_name || 'there';
        const botName = d.profile?.assistant_name || 'SoulPrint';
        const customGreeting = d.profile?.custom_greeting;
        
        // Check if new user (show onboarding if they haven't seen it)
        const hasSeenOnboarding = localStorage.getItem('sp_onboarding_seen');
        if (!hasSeenOnboarding && !d.profile?.onboarding_completed) {
          setShowOnboarding(true);
        }
        
        // Use custom greeting if set, otherwise use default
        const greetingContent = customGreeting 
          ? customGreeting.replace('{name}', greet).replace('{assistant}', botName)
          : `Hey ${greet} 👋 I'm **${botName}**, your personal AI.\n\nI can help with research, analysis, planning, and more. I also have **real-time web search** — just ask me anything current.\n\nWhat's on your mind?`;
        
        setMessages([{
          id: 'greeting', role: 'assistant',
          content: greetingContent,
          created_at: new Date().toISOString(),
        }]);
      })
      .catch(() => router.push('/auth'));
    // Fetch feature flags
    fetch('/api/feature-flags', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(flags => {
        if (flags.voice_chat_enabled !== undefined) {
          setVoiceChatEnabled(flags.voice_chat_enabled);
        }
      })
      .catch(() => {}); // Silent fail, default to enabled
    fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => {
        const convList = Array.isArray(d) ? d : [];
        setConversations(convList);
        // Resume the most recent conversation if one exists
        if (convList.length > 0) {
          const lastConv = convList[0]; // Already sorted by updated_at desc
          setConversationId(lastConv.id);
          fetch(`/api/messages?conversationId=${lastConv.id}`, { headers: { Authorization: `Bearer ${t}` } })
            .then(r => r.json())
            .then(msgs => {
              if (Array.isArray(msgs) && msgs.length > 0) {
                setMessages(msgs);
              }
            })
            .catch(() => {});
        }
      }).catch(() => {});
    // Fetch projects
    fetch('/api/projects', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => {
        const allProjects = [
          ...(d.owned || []),
          ...(d.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
      }).catch(() => {});
    // Fetch announcements
    fetch('/api/announcements', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => setAnnouncements(d.unread || [])).catch(() => {});
    // Fetch app updates (What's New)
    fetch('/api/app-updates', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => {
        setAppUpdates(d.updates || []);
        setAppUpdatesUnread(d.unread_count || 0);
      }).catch(() => {});
    // Fetch latest news/blog posts
    fetch('/api/blog/posts?limit=3')
      .then(r => r.json()).then(d => setLatestNews(d.posts || [])).catch(() => {});
  }, []);

  // Auto-request location when user loads the app (if not already set)
  useEffect(() => {
    if (!token || !user) return;
    
    // Check if we already have location or have asked before this session
    const hasAskedLocation = sessionStorage.getItem('sp_location_asked');
    if (hasAskedLocation) return;
    
    // Mark that we've asked this session
    sessionStorage.setItem('sp_location_asked', 'true');
    
    // Check if user already has location saved
    fetch('/api/user/location', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.hasLocation) {
          // User already has location, just set it
          setUserLocation({ lat: data.lat, lng: data.lng, address: data.address, timezone: data.timezone });
        } else {
          // Request location automatically (silently - no error messages shown)
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                  const res = await fetch('/api/user/location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ 
                      lat: latitude, 
                      lng: longitude,
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    }),
                  });
                  const locData = await res.json();
                  if (res.ok) {
                    setUserLocation({ lat: latitude, lng: longitude, address: locData.address, timezone: locData.timezone });
                  }
                } catch (err) {
                  console.log('Auto location save failed:', err);
                }
              },
              (error) => {
                // Silently fail - user can manually set location later
                console.log('Auto location request denied or failed:', error.message);
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
            );
          }
        }
      })
      .catch(() => {});
  }, [token, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Detect stalled streaming - if no chunk received for 8 seconds while loading
  useEffect(() => {
    if (!loading || !lastChunkTime) return;
    
    const checkStall = setInterval(() => {
      const timeSinceLastChunk = Date.now() - lastChunkTime;
      if (timeSinceLastChunk > 8000 && streamingContent) {
        setStreamingStalled(true);
      }
    }, 2000);
    
    return () => clearInterval(checkStall);
  }, [loading, lastChunkTime, streamingContent]);

  // Close conversation menu when clicking outside
  useEffect(() => {
    if (!convMenuId) return;
    const handleClickOutside = () => setConvMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [convMenuId]);

  // Close model picker when clicking outside
  useEffect(() => {
    if (!showModelPicker) return;
    const handleClickOutside = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
        setShowModelPicker(false);
      }
    };
    // Use timeout so the current click event that opened the picker doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModelPicker]);

  // Close video model picker when clicking outside
  useEffect(() => {
    if (!showVideoModelPicker) return;
    const handleClickOutside = (e) => {
      if (videoModelPickerRef.current && !videoModelPickerRef.current.contains(e.target)) {
        setShowVideoModelPicker(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVideoModelPicker]);


  // Dismiss announcement
  async function dismissAnnouncement(announcementId, permanent = false) {
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
    try {
      await fetch('/api/announcements/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ announcementId, permanent }),
      });
    } catch (e) {
      console.error('Failed to dismiss announcement:', e);
    }
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    setFileError('');
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) { setFileError(`${file.name} is too large (max 10MB)`); continue; }
      try {
        const processed = await processFile(file);
        setAttachments(prev => [...prev, processed]);
      } catch (err) {
        setFileError(`Could not process ${file.name}`);
      }
    }
    e.target.value = '';
  }

  // Handle paste events for images
  async function handlePaste(e) {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;
    
    const imageItems = Array.from(clipboardItems).filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return; // Let default paste behavior handle text
    
    e.preventDefault(); // Prevent default only if we have images
    setFileError('');
    
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`Pasted image is too large (max 10MB)`);
        continue;
      }
      
      try {
        const processed = await processFile(file);
        setAttachments(prev => [...prev, processed]);
      } catch (err) {
        setFileError(`Could not process pasted image`);
      }
    }
  }

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Handle drag and drop for files/images
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.items?.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    
    setFileError('');
    
    for (const file of files) {
      // Check if it's an accepted file type
      const isHeicFile = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
      const isImage = file.type.startsWith('image/') || isHeicFile;
      const isAccepted = ACCEPTED_FILE_TYPES.split(',').some(type => {
        const cleanType = type.trim();
        if (cleanType.startsWith('.')) {
          return file.name.toLowerCase().endsWith(cleanType);
        }
        return file.type === cleanType || file.type.startsWith(cleanType.replace('/*', '/'));
      });
      
      if (!isImage && !isAccepted) {
        setFileError(`${file.name} is not a supported file type`);
        continue;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`${file.name} is too large (max 10MB)`);
        continue;
      }
      
      try {
        const processed = await processFile(file);
        setAttachments(prev => [...prev, processed]);
      } catch (err) {
        setFileError(`Could not process ${file.name}`);
      }
    }
  }, []);

  // Check if running as iOS PWA
  const isIOSPwa = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true;
    return isIOS && isStandalone;
  }, []);

  // Request and save user's browser location
  const requestLocation = useCallback(async () => {
    // Clear previous errors
    setLocationError(null);
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please enter your location manually.');
      setShowLocationModal(true);
      return;
    }
    
    // Check if running as PWA on iOS - may need special handling
    const isPwaIOS = isIOSPwa();
    
    setLocationLoading(true);
    
    // Attempt to get location with a shorter timeout for better UX
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          const res = await fetch('/api/user/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ 
              lat: latitude, 
              lng: longitude,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setUserLocation({ lat: latitude, lng: longitude, address: data.address, timezone: data.timezone, accuracy });
            setLocationError(null);
            // Show confirmation in chat
            setMessages(prev => [...prev, {
              id: `loc-${Date.now()}`, role: 'assistant',
              content: `📍 **Location saved!**\n\n${data.address}${data.timezone ? `\n🕐 Timezone: ${data.timezone}` : ''}\n\nYou can now ask me things like:\n- "Find restaurants near me"\n- "What's on my calendar today?"\n- "Schedule a meeting for tomorrow at 3pm"`,
              created_at: new Date().toISOString(),
            }]);
          } else {
            setLocationError(data.error || 'Failed to save location');
          }
        } catch (err) {
          console.error('Failed to save location:', err);
          setLocationError('Failed to save location. Please try again.');
        }
        setLocationLoading(false);
      },
      (error) => {
        setLocationLoading(false);
        
        // Build helpful error message based on error type and platform
        let errorMsg = '';
        
        // Detect platform for better instructions
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            if (isIOS && isPWA) {
              errorMsg = '**Location access denied**\n\nFor iOS PWA:\n1. Open Settings → Privacy & Security → Location Services\n2. Find Safari Websites\n3. Enable "While Using"\n4. Return and try again\n\nOr enter your location manually below.';
            } else if (isIOS) {
              errorMsg = '**Location access denied**\n\nOn iOS Safari:\n1. Open Settings → Safari → Location\n2. Set to "Ask" or "Allow"\n3. Refresh this page and try again\n\nOr enter your location manually below.';
            } else if (isAndroid && isChrome) {
              errorMsg = '**Location access denied**\n\nOn Android Chrome:\n1. Tap the lock icon in the address bar\n2. Tap "Permissions"\n3. Enable "Location"\n4. Refresh and try again\n\nOr enter your location manually below.';
            } else if (isChrome) {
              errorMsg = '**Location access denied**\n\nIn Chrome:\n1. Click the lock/info icon in the address bar\n2. Find "Location" and set to "Allow"\n3. Refresh the page\n\nOr enter your location manually below.';
            } else if (isFirefox) {
              errorMsg = '**Location access denied**\n\nIn Firefox:\n1. Click the lock icon in the address bar\n2. Click "Connection secure" → "More Information"\n3. Go to Permissions tab and allow Location\n\nOr enter your location manually below.';
            } else if (isSafari) {
              errorMsg = '**Location access denied**\n\nIn Safari:\n1. Go to Safari → Settings for This Website\n2. Set Location to "Allow"\n3. Refresh the page\n\nOr enter your location manually below.';
            } else {
              errorMsg = '**Location access denied**\n\nPlease enable location access:\n1. Click the lock/site icon in your browser\'s address bar\n2. Find Location permissions and set to "Allow"\n3. Refresh the page and try again\n\nOr enter your location manually below.';
            }
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = '**Could not determine your location**\n\nThis may be due to:\n- Poor GPS/network signal\n- Location services disabled on your device\n- VPN or network restrictions\n\nPlease enter your location manually below.';
            break;
          case error.TIMEOUT:
            errorMsg = '**Location request timed out**\n\nThis can happen with poor signal. Please try again or enter your location manually below.';
            break;
          default:
            errorMsg = '**Could not get your location**\n\nPlease enter it manually below.';
        }
        
        setLocationError(errorMsg);
        setShowLocationModal(true);
      },
      { 
        enableHighAccuracy: true, 
        timeout: (isIOSPwa() || /iPad|iPhone|iPod/.test(navigator.userAgent)) ? 15000 : 10000,
        maximumAge: 300000 // 5 minutes cache
      }
    );
  }, [token, isIOSPwa]);

  // Save manually entered location
  const saveManualLocation = useCallback(async () => {
    if (!manualLocationInput.trim()) {
      setLocationError('Please enter a location (city, address, or zip code)');
      return;
    }
    
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      // Use geocode API to convert address to coordinates
      const res = await fetch('/api/places/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: manualLocationInput.trim() }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.lat && data.lng) {
        // Save the geocoded location
        const saveRes = await fetch('/api/user/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat: data.lat, lng: data.lng }),
        });
        
        const saveData = await saveRes.json();
        
        if (saveRes.ok) {
          setUserLocation({ 
            lat: data.lat, 
            lng: data.lng, 
            address: data.formattedAddress || saveData.address || manualLocationInput,
            manual: true 
          });
          setShowLocationModal(false);
          setManualLocationInput('');
          
          // Show confirmation in chat
          setMessages(prev => [...prev, {
            id: `loc-${Date.now()}`, role: 'assistant',
            content: `📍 **Location saved!**\n\n${data.formattedAddress || manualLocationInput}\n\nYou can now ask me things like:\n- "Find restaurants near me"\n- "What coffee shops are nearby?"\n- "Show me gas stations close by"`,
            created_at: new Date().toISOString(),
          }]);
        } else {
          setLocationError(saveData.error || 'Failed to save location');
        }
      } else {
        setLocationError(data.error || 'Could not find that location. Please try a different address.');
      }
    } catch (err) {
      console.error('Failed to geocode location:', err);
      setLocationError('Failed to look up location. Please check your internet connection and try again.');
    }
    
    setLocationLoading(false);
  }, [token, manualLocationInput]);

  // Fetch saved location on load
  useEffect(() => {
    if (!token) return;
    fetch('/api/user/location', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.hasLocation) {
          setUserLocation({ lat: d.lat, lng: d.lng, address: d.address });
        }
      })
      .catch(() => {});
  }, [token]);

  // Check for gradual assessment questions
  const checkGradualQuestion = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/assessment/gradual/next', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await res.json();
      
      if (data.hasQuestion && data.question) {
        setGradualQuestion(data.question);
        setGradualProgress(data.progress);
        // Don't show immediately - wait a moment after conversation activity
        setTimeout(() => setShowGradualPrompt(true), 2000);
      } else if (data.progress) {
        setGradualProgress(data.progress);
      }
    } catch (e) {
      console.error('Failed to check gradual question:', e);
    }
  }, [token]);

  // Check for gradual question after messages change (but not too often)
  useEffect(() => {
    if (!token || messages.length < 5) return;
    
    // Only check every 5 messages after first 5
    if (messages.length % 5 !== 0) return;
    
    // Don't check if we already have a question pending
    if (showGradualPrompt || gradualQuestion) return;
    
    checkGradualQuestion();
  }, [messages.length, token, showGradualPrompt, gradualQuestion, checkGradualQuestion]);

  // Submit gradual assessment answer
  const submitGradualAnswer = async () => {
    if (!gradualAnswer.trim() || !gradualQuestion) return;
    
    setSubmittingGradual(true);
    try {
      const res = await fetch('/api/assessment/gradual/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          question_id: gradualQuestion.id, 
          answer: gradualAnswer 
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setGradualProgress(data.progress);
        setShowGradualPrompt(false);
        setGradualQuestion(null);
        setGradualAnswer('');
        
        // Show thank you message in chat
        setMessages(prev => [...prev, {
          id: `gradual-${Date.now()}`,
          role: 'assistant',
          content: `✨ **Thanks for sharing!** Your profile is now ${data.progress.percentage}% complete across all 6 pillars.${data.progress.isComplete ? '\n\n🎉 **Congratulations!** Your full profile is now complete!' : ''}`,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (e) {
      console.error('Failed to submit gradual answer:', e);
    }
    setSubmittingGradual(false);
  };

  // Skip gradual question for now
  const skipGradualQuestion = async () => {
    if (!gradualQuestion) return;
    
    try {
      await fetch('/api/assessment/gradual/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question_id: gradualQuestion.id }),
      });
    } catch (e) {
      console.error('Failed to skip gradual question:', e);
    }
    
    setShowGradualPrompt(false);
    setGradualQuestion(null);
    setGradualAnswer('');
  };

  // Save voice conversation transcript to chat history
  const saveVoiceTranscript = async (transcriptItems) => {
    if (!transcriptItems || transcriptItems.length === 0) return;
    
    try {
      // Create a new conversation for the voice chat if needed
      let voiceConvId = conversationId;
      if (!voiceConvId) {
        const convRes = await fetch('/api/user/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ 
            title: `Voice Conversation - ${new Date().toLocaleDateString()}`,
            model: 'gpt-4o-realtime'
          }),
        });
        const convData = await convRes.json();
        voiceConvId = convData.id;
        setConversationId(voiceConvId);
      }
      
      // Save each transcript item as a message
      for (const item of transcriptItems) {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            conversation_id: voiceConvId,
            role: item.role,
            content: `🎤 *Voice*: ${item.text}`,
          }),
        });
        
        // Add to local messages too
        setMessages(prev => [...prev, {
          id: `voice-${Date.now()}-${Math.random()}`,
          role: item.role,
          content: `🎤 *Voice*: ${item.text}`,
          created_at: new Date().toISOString(),
        }]);
      }
      
      // Refresh conversations list
      loadConversations();
    } catch (e) {
      console.error('Failed to save voice transcript:', e);
    }
  };

  // Generate media (image or video) with quick options
  const generateMediaWithOptions = useCallback(async () => {
    if (!input.trim() || loading || isGeneratingMedia) return;
    
    setShowMediaOptions(false);
    setLoading(true);
    setIsGeneratingMedia(true);
    
    const content = input.trim();
    const userMessage = { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      content: content,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setDetectedMediaIntent(null);
    
    try {
      if (detectedMediaIntent === 'image') {
        // Generate image using selected model (or default to first in list)
        const modelToUse = selectedImageModel || IMAGE_MODELS[0].value;
        const res = await fetch('/api/media/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: 'image',
            model: modelToUse,
            prompt: content,
            aspectRatio: quickAspectRatio,
            quality: 'standard',
            style: 'vivid',
            conversationId: currentConversationId,
          }),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Image generation failed');
        
        const modelLabel = IMAGE_MODELS.find(m => m.value === modelToUse)?.label || modelToUse;
        const assistantMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `🎨 Image generated with ${modelLabel}!\n\n**Prompt:** ${content}`,
          image_url: data.url,
          model_label: modelLabel,
        };
        setMessages(prev => [...prev, assistantMsg]);
        
      } else if (detectedMediaIntent === 'video') {
        // Generate video using selected model (or default to first in list)
        const modelToUse = selectedVideoModel || VIDEO_MODELS[0].value;
        const res = await fetch('/api/media/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: 'video',
            model: modelToUse,
            prompt: content,
            aspectRatio: quickAspectRatio === '1:1' ? '16:9' : quickAspectRatio,
            duration: parseInt(quickVideoLength) || 5,
            conversationId: currentConversationId,
          }),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Video generation failed');
        
        const modelLabel = VIDEO_MODELS.find(m => m.value === modelToUse)?.label || modelToUse;
        const assistantMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `🎬 Video generation started with ${modelLabel}!\n\n**Prompt:** ${content}\n\nYour video is being generated and will appear when ready (1-3 min)...`,
          video_task: { taskId: data.taskId, status: 'generating', prompt: content },
          model_label: modelLabel,
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      console.error('Media generation error:', error);
      const errorMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, ${detectedMediaIntent} generation failed: ${error.message}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setIsGeneratingMedia(false);
    }
  }, [input, loading, isGeneratingMedia, detectedMediaIntent, token, mediaOptionsExpanded, quickAspectRatio, quickVideoLength]);

  // Send as regular chat (bypass media detection)
  const sendAsChat = useCallback(() => {
    setShowMediaOptions(false);
    setDetectedMediaIntent(null);
    // Trigger the sendMessage function directly after resetting states
    setTimeout(() => {
      if (inputRef.current) {
        // This will be called when user clicks "Just Chat"
      }
    }, 0);
  }, []);

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0 && !pendingMediaAttachment) || loading || compareLoading) return;
    const content = input.trim();
    
    // Handle pending media attachment for regeneration
    let currentAttachments = [...attachments];
    if (pendingMediaAttachment && pendingMediaAttachment.url) {
      // Add URL reference attachment for regeneration
      currentAttachments.push({
        type: 'image',
        base64: pendingMediaAttachment.url, // Backend will handle URL vs base64
        mimeType: 'image/jpeg',
        name: 'regeneration-source.jpg',
        isUrlReference: true, // Flag to indicate this is a URL not base64
      });
    }
    
    setInput('');
    setAttachments([]);
    setPendingMediaAttachment(null); // Clear pending attachment
    setStreamingContent('');
    setStreamingImageUrl(null);
    setStreamingVideoTask(null);
    // CRITICAL: Also clear refs directly to prevent stale data leaking into next message
    streamingImageUrlRef.current = null;
    streamingVideoTaskRef.current = null;
    streamingSourcesRef.current = [];
    setSearchingWeb(false);
    setSearchQueries([]);

    // Build display content for user bubble
    const displayContent = content + (currentAttachments.length > 0
      ? '\n' + currentAttachments.map(a => `📎 ${a.name}`).join('\n') : '');

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: displayContent, created_at: new Date().toISOString(), attachments: currentAttachments };
    setMessages(prev => [...prev.filter(m => m.id !== 'greeting' || prev.length === 1), userMsg]);

    // Clear any previous comparison
    setCompareResponses(null);
    setSelectedCompareResponse(null);

    let newConvId = conversationId;
    let fullContent = '';

    // ── Compare Mode: Send to multiple models ──
    if (compareMode && compareModels.length > 0) {
      setCompareLoading(true);
      try {
        const res = await fetch('/api/chat/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            conversationId: newConvId,
            content,
            models: compareModels,
            attachments: currentAttachments,
            enableWebSearch: webSearchEnabled,
            projectId: selectedProject && selectedProject !== 'general' ? selectedProject : null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${errData.error || 'Comparison failed'}`, created_at: new Date().toISOString() }]);
          setCompareLoading(false);
          return;
        }

        const data = await res.json();
        setConversationId(data.conversationId);
        setCompareResponses({
          responses: data.responses,
          comparisonId: data.comparisonId,
          userMessageId: data.userMessageId,
          usedWebSearch: data.usedWebSearch,
        });

        // Refresh conversations list
        fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []));
      } catch (err) {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error during comparison. Please try again.', created_at: new Date().toISOString() }]);
      } finally {
        setCompareLoading(false);
        // Restore focus to input after compare mode completes
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      return;
    }

    // ── Single Model Mode: Stream response ──
    setLoading(true);
    
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: newConvId, content, model: selectedModel,
          provider: currentModel.provider, attachments: currentAttachments, enableWebSearch: webSearchEnabled,
          projectId: selectedProject && selectedProject !== 'general' ? selectedProject : null,
          videoModel: selectedVideoModel !== 'smart' ? selectedVideoModel : null, // Pass user's video model preference
          imageModel: selectedImageModel !== 'smart' ? selectedImageModel : null, // Pass user's image model preference
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json();
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${errData.error || 'Something went wrong'}`, created_at: new Date().toISOString() }]);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let actualModelUsed = selectedModel;
      let dynamicIntelligenceReason = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'meta') {
              newConvId = data.conversationId;
              setConversationId(data.conversationId);
              // Capture Dynamic Intelligence selection info
              if (data.smartMode) {
                actualModelUsed = data.selectedModel;
                dynamicIntelligenceReason = data.modelReason;
                setLastSmartSelection({ model: data.selectedModel, reason: data.modelReason });
              }
            } else if (data.type === 'search') {
              setSearchingWeb(true);
              setSearchQueries(data.queries || []);
            } else if (data.type === 'sources') {
              // Received sources from web search
              setStreamingSources(data.sources || []);
              streamingSourcesRef.current = data.sources || [];
            } else if (data.type === 'generating_visual') {
              // Backend is generating an image/video - show indicator immediately
              setIsGeneratingVisual(true);
              setVisualGenerationType(data.visualType || 'image');
            } else if (data.type === 'image') {
              // Image generated – store url for rendering
              setStreamingImageUrl(data.url);
              streamingImageUrlRef.current = data.url; // Direct ref update for same-batch done handler
              setStreamingRevPrompt(data.revised_prompt);
              // Reset visual generation state since image arrived
              setIsGeneratingVisual(false);
              setVisualGenerationType('');
            } else if (data.type === 'image_action') {
              // Tool-based image edit/mockup result – extract URL and show
              const actionResult = data.result;
              if (actionResult?.imageUrl || actionResult?.url) {
                const imgUrl = actionResult.imageUrl || actionResult.url;
                setStreamingImageUrl(imgUrl);
                streamingImageUrlRef.current = imgUrl;
                setStreamingRevPrompt(actionResult.revisedPrompt || actionResult.prompt || '');
                setIsGeneratingVisual(false);
                setVisualGenerationType('');
              }
            } else if (data.type === 'video_task') {
              // Video job started – store taskId for polling (include messageId & model info for DB persistence)
              const videoTaskData = { 
                taskId: data.taskId, status: 'generating', prompt: data.prompt, 
                messageId: data.messageId,
                videoModel: data.videoModel, videoModelLabel: data.videoModelLabel, 
                videoModelReason: data.videoModelReason,
                sourceImage: data.sourceImage || undefined,
              };
              setStreamingVideoTask(videoTaskData);
              // CRITICAL: Also update ref directly so it's available synchronously
              // when 'done' event fires in the same batch (useEffect runs AFTER render)
              streamingVideoTaskRef.current = videoTaskData;
              // Dismiss the generating_visual animation — the VideoCard takes over
              setIsGeneratingVisual(false);
              setVisualGenerationType('');
            } else if (data.type === 'delta') {
              setSearchingWeb(false);
              setLastChunkTime(Date.now()); // Track when we last received content
              setStreamingStalled(false); // Reset stall indicator
              // Skip the markdown content if it's an image (we render the image directly)
              if (!streamingImageUrlRef.current) {
                fullContent += data.content;
                setStreamingContent(fullContent);
                
                // Detect if AI is about to generate visual content
                const lowerContent = fullContent.toLowerCase();
                const generatingPhrases = [
                  // Infographic/Flyer/Poster generation
                  'generating the infographic', 'generate the infographic', 'create the infographic', 'creating the infographic',
                  'generating the flyer', 'generate the flyer', 'create the flyer', 'creating the flyer',
                  'generating the poster', 'generate the poster', 'create the poster', 'creating the poster',
                  // Image generation - common phrases
                  'generating this image', 'generate this image', 'creating this image',
                  'generating your image', 'creating your image',
                  'generating an image', 'creating an image',
                  // Video generation - common phrases
                  'generating your video', 'creating your video',
                  'generating a video', 'creating a video',
                  'generating the video', 'creating the video',
                  'video generation started', 'video is being generated',
                  'working on your video', 'crafting your video',
                  // Intent phrases
                  'i\'ll generate', 'i will generate', 'let me generate', 'let me create',
                  'hold on for a moment', 'please hold', 'one moment while i',
                  'working on your', 'designing your', 'crafting your',
                  // Design phrases
                  'i\'ll create a design', 'let me create a design', 'creating a design',
                  'i\'ll update', 'let me update', 'updating the',
                  'i\'ll edit', 'let me edit', 'editing the',
                  'generating a new', 'creating a new', 'making a new',
                  'give me a moment', 'moment while i work', 'while i generate',
                  'working on this', 'work on this', 'creating this for you',
                  'hold on while', 'wait while', 'please wait',
                  'incorporating', 'applying the changes', 'making the changes',
                  // Edit-specific phrases
                  'editing your image', 'editing the image', 'applying the edit',
                  'adding your logo', 'adding the logo', 'composite',
                  // Model names indicate image generation in progress
                  'nano banana', 'dall-e', 'seedream', 'gpt-image',
                  // Video model names
                  'kling', 'minimax', 'luma', 'runway',
                  // Emoji prefixed messages from backend
                  '🎨 generating', '✨ generating', '🖼️ generating',
                  '🎨 creating', '✨ creating', '🖼️ creating',
                  '🎬 generating', '🎬 creating', '🎬 video',
                ];
                const isGeneratingVisualContent = generatingPhrases.some(phrase => lowerContent.includes(phrase));
                
                if (isGeneratingVisualContent && !isGeneratingVisual) {
                  // Determine what type of visual is being generated
                  let type = 'image';
                  if (lowerContent.includes('infographic')) type = 'infographic';
                  else if (lowerContent.includes('flyer')) type = 'flyer';
                  else if (lowerContent.includes('poster')) type = 'poster';
                  else if (lowerContent.includes('edit')) type = 'edit';
                  else if (lowerContent.includes('video') || lowerContent.includes('🎬')) type = 'video';
                  setIsGeneratingVisual(true);
                  setVisualGenerationType(type);
                }
              }
            } else if (data.type === 'continuation') {
              // Backend is auto-continuing a truncated response
              console.log(`[Chat] Auto-continuation ${data.count}/${data.max}`);
              setStreamingStalled(false);
              setLastChunkTime(Date.now());
            } else if (data.type === 'done') {
              setStreamingStalled(false);
              setLastChunkTime(null);
              // Use real messageId from backend if available (critical for video PATCH calls)
              const realMessageId = data.messageId || streamingVideoTaskRef.current?.messageId;
              const finalMsg = {
                id: realMessageId || `a-${Date.now()}`,
                role: 'assistant',
                content: fullContent,
                created_at: new Date().toISOString(),
                model_used: actualModelUsed || selectedModel,
                smart_mode: selectedModel === 'smart',
                smart_reason: dynamicIntelligenceReason,
                image_url: streamingImageUrlRef.current || undefined,
                video_task: streamingVideoTaskRef.current || undefined,
                model_label: streamingVideoTaskRef.current ? (streamingVideoTaskRef.current.videoModelLabel || 'AI Video') : undefined,
                video_model_reason: streamingVideoTaskRef.current?.videoModelReason || undefined,
                sources: streamingSourcesRef.current?.length > 0 ? streamingSourcesRef.current : undefined,
              };
              setMessages(prev => [...prev, finalMsg]);
              setStreamingContent('');
              setStreamingImageUrl(null);
              setStreamingVideoTask(null);
              setSearchQueries([]);
              setStreamingSources([]);
              streamingSourcesRef.current = [];
              fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []));
            } else if (data.type === 'error') {
              setStreamingStalled(false);
              setLastChunkTime(null);
              setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${data.error}`, created_at: new Date().toISOString() }]);
              setStreamingContent('');
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      // Handle aborted requests gracefully - don't show error
      if (err.name === 'AbortError') {
        // Request was cancelled by user, handled by stopRequest
        return;
      }
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error. Please try again.', created_at: new Date().toISOString() }]);
      setStreamingContent('');
    } finally {
      setLoading(false);
      setSearchingWeb(false);
      setIsGeneratingVisual(false);
      setVisualGenerationType('');
      abortControllerRef.current = null;
      // Use setTimeout to ensure focus after all React state updates complete
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, compareLoading, token, selectedModel, conversationId, attachments, webSearchEnabled, compareMode, compareModels]);

  // Stop ongoing request
  const stopRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setSearchingWeb(false);
      // If there's streaming content, save it as a partial response
      if (streamingContent) {
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: streamingContent + '\n\n*(Response stopped)*',
          created_at: new Date().toISOString(),
          model_used: selectedModel,
        }]);
        setStreamingContent('');
      }
      abortControllerRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [streamingContent, selectedModel]);

  // Generate JSON config from an uploaded image
  const generateImageJson = useCallback(async (attachment) => {
    if (!attachment || attachment.type !== 'image' || !token) return;
    
    setGeneratingImageJson(true);
    setShowImageJsonModal(true);
    setImageJsonResult(null);
    
    try {
      const response = await fetch('/api/analyze/image-to-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: {
            base64: attachment.base64,
            mimeType: attachment.mimeType,
          },
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }
      
      setImageJsonResult(data);
    } catch (err) {
      setImageJsonResult({ error: err.message });
    } finally {
      setGeneratingImageJson(false);
    }
  }, [token]);

  // Set an image as editable (from message or attachment)
  const setImageForEditing = useCallback((imageData) => {
    setEditableImage(imageData);
  }, []);

  // Handle image edit submission
  const handleImageEdit = useCallback(async ({ prompt, overlayImage: overlayImg, maskDataUrl, hasMask }) => {
    if (!editableImage || !prompt || !token) return;
    
    setIsEditingImage(true);
    
    try {
      const requestBody = {
        image: {
          url: editableImage.url,
          base64: editableImage.base64,
          mimeType: editableImage.mimeType || 'image/png',
        },
        mask: hasMask ? maskDataUrl : null,
        prompt,
        conversationId,
      };
      
      // If overlay image is provided, add it to the request
      if (overlayImg) {
        requestBody.overlayImage = {
          base64: overlayImg.base64,
          mimeType: overlayImg.mimeType || 'image/png',
        };
      }
      
      const response = await fetch('/api/image/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to edit image');
      }
      
      // Add the edited image as a new message
      const editMsg = {
        id: `edit-${Date.now()}`,
        role: 'assistant',
        content: `✏️ Image edited!\n\n**Edit:** ${prompt}`,
        created_at: new Date().toISOString(),
        image_url: data.url,
        is_edit: true,
        original_image: editableImage.url || `data:image/png;base64,${editableImage.base64}`,
      };
      
      setMessages(prev => [...prev, editMsg]);
      
      // Set the new image as the editable one for chaining edits
      setEditableImage({
        url: data.url,
        source: 'edited',
        messageId: editMsg.id,
      });
      
      setShowImageEditor(false);
      setEditPrompt('');
    } catch (err) {
      alert('Edit failed: ' + err.message);
    } finally {
      setIsEditingImage(false);
    }
  }, [editableImage, token, conversationId]);

  // Handle mockup generation
  const handleGenerateMockup = useCallback(async ({ template, productName, isCustom, position, size }) => {
    if (!mockupDesign || !productName || !token) return;
    
    setIsGeneratingMockup(true);
    
    try {
      const response = await fetch('/api/mockup/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          design: {
            base64: mockupDesign.base64,
            mimeType: mockupDesign.mimeType,
          },
          product: productName,
          isCustom,
          position,
          size,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate mockup');
      }
      
      // Add the mockup as a message
      const mockupMsg = {
        id: `mockup-${Date.now()}`,
        role: 'assistant',
        content: `🎨 **Mockup Generated!**\n\n**Product:** ${productName}`,
        created_at: new Date().toISOString(),
        image_url: data.url,
        is_mockup: true,
      };
      
      setMessages(prev => [...prev, mockupMsg]);
      setShowMockupGenerator(false);
    } catch (err) {
      alert('Mockup generation failed: ' + err.message);
    } finally {
      setIsGeneratingMockup(false);
    }
  }, [mockupDesign, token]);

  // Handle selecting a response from comparison
  const handleSelectCompareResponse = useCallback(async (response) => {
    if (!compareResponses || selectedCompareResponse) return;
    
    setSelectedCompareResponse(response.model);
    
    try {
      const res = await fetch('/api/chat/compare/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          comparisonId: compareResponses.comparisonId,
          selectedModel: response.model,
          selectedContent: response.content,
        }),
      });

      if (!res.ok) {
        console.error('Failed to save comparison selection');
        return;
      }

      const data = await res.json();
      
      // Add the selected response as a message and switch to that model
      const finalMsg = {
        id: data.messageId || `a-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        created_at: new Date().toISOString(),
        model_used: response.model,
        from_comparison: true,
      };
      setMessages(prev => [...prev, finalMsg]);
      
      // Switch to the selected model for future messages
      setSelectedModel(response.model);
      
      // Exit compare mode and revert to single model mode
      setCompareMode(false);
      
      // Clear comparison state after a short delay (to show the selection)
      setTimeout(() => {
        setCompareResponses(null);
        setSelectedCompareResponse(null);
      }, 1500);
      
      // Refresh conversations
      fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []));
        
    } catch (err) {
      console.error('Error saving comparison selection:', err);
    }
  }, [compareResponses, selectedCompareResponse, token]);

  // ── Media Generation Handler ──────────────────────────────────────────────
  const handleMediaGenerate = useCallback(async ({ type, model, prompt, aspectRatio }) => {
    setIsGeneratingMedia(true);
    
    // Add a placeholder message showing what's being generated
    const placeholderMsg = {
      id: `gen-${Date.now()}`,
      role: 'assistant',
      content: `🎨 Generating ${type}...\n\n**Prompt:** ${prompt}\n**Model:** ${model}${type === 'image' ? `\n**Aspect:** ${aspectRatio}` : ''}`,
      created_at: new Date().toISOString(),
      is_generating: true,
    };
    setMessages(prev => [...prev, placeholderMsg]);

    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, model, prompt, aspectRatio, conversationId }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? { ...m, content: `❌ Generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
            : m
        ));
        setIsGeneratingMedia(false);
        return;
      }

      // For async tasks (video), we need to poll
      if (data.taskId && !data.url) {
        // Start polling for video completion
        pollMediaTask(data.taskId, placeholderMsg.id, type, prompt, model);
      } else if (data.url) {
        // Immediate result (image)
        const modelInfo = IMAGE_MODELS.find(m => m.value === model) || { label: model };
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? {
                ...m,
                content: `✨ ${type === 'image' ? 'Image' : 'Video'} generated!\n\n**Prompt:** ${prompt}`,
                is_generating: false,
                image_url: type === 'image' ? data.url : undefined,
                video_url: type === 'video' ? data.url : undefined,
                model_used: model,
                model_label: modelInfo.label || model,
                generation_params: {
                  type,
                  model,
                  modelLabel: modelInfo.label || model,
                  prompt,
                  aspectRatio,
                  generatedAt: new Date().toISOString(),
                },
              }
            : m
        ));
        // Refresh gallery
        loadGallery();
      }
    } catch (err) {
      setMessages(prev => prev.map(m => 
        m.id === placeholderMsg.id 
          ? { ...m, content: `❌ Connection error: ${err.message}`, is_generating: false }
          : m
      ));
    } finally {
      setIsGeneratingMedia(false);
    }
  }, [token, conversationId]);

  // Poll for async media tasks (videos)
  const pollMediaTask = useCallback(async (taskId, messageId, type, prompt, model) => {
    const maxPolls = 60; // 5 minutes max
    let polls = 0;
    
    const poll = async () => {
      if (polls >= maxPolls) {
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { ...m, content: `⏱️ Generation timed out. Please try again.`, is_generating: false }
            : m
        ));
        return;
      }
      
      try {
        const res = await fetch(`/api/media/status?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        
        if (data.status === 'completed' && data.url) {
          setMessages(prev => prev.map(m => 
            m.id === messageId 
              ? {
                  ...m,
                  content: `✨ Video generated!\n\n**Prompt:** ${prompt}`,
                  is_generating: false,
                  video_url: data.url,
                  thumbnail_url: data.thumbnail_url,
                  model_used: model,
                }
              : m
          ));
          loadGallery();
          return;
        } else if (data.status === 'failed') {
          setMessages(prev => prev.map(m => 
            m.id === messageId 
              ? { ...m, content: `❌ Generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
              : m
          ));
          return;
        }
        
        // Still processing, update status and continue polling
        setMessages(prev => prev.map(m => 
          m.id === messageId && m.is_generating
            ? { ...m, content: `🎬 Generating video... (${data.progress || 'processing'})\n\n**Prompt:** ${prompt}` }
            : m
        ));
        
        polls++;
        setTimeout(poll, 5000); // Poll every 5 seconds
      } catch (err) {
        polls++;
        setTimeout(poll, 5000);
      }
    };
    
    poll();
  }, [token]);

  // ── Gallery Loader ────────────────────────────────────────────────────────
  const loadGallery = useCallback(async () => {
    if (!token) return;
    setGalleryLoading(true);
    try {
      const res = await fetch('/api/media/gallery', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGalleryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading gallery:', err);
    } finally {
      setGalleryLoading(false);
    }
  }, [token]);

  // Load gallery when showing it
  useEffect(() => {
    if (showGallery && token) {
      loadGallery();
    }
  }, [showGallery, token, loadGallery]);

  // Listen for cloud import modal open event
  useEffect(() => {
    const handleOpenCloudImport = () => setShowCloudImport(true);
    window.addEventListener('openCloudImport', handleOpenCloudImport);
    return () => window.removeEventListener('openCloudImport', handleOpenCloudImport);
  }, []);

  // Auto-save user's timezone on page load (doesn't require location permission)
  useEffect(() => {
    if (!token) return;
    
    const saveTimezone = async () => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await fetch('/api/user/timezone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ timezone }),
        });
      } catch (err) {
        console.error('Failed to save timezone:', err);
      }
    };
    
    saveTimezone();
  }, [token]);

  async function loadConversation(convId) {
    // Abort any active SSE stream so user can interact with new chat
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Reset all generating/loading states
    setLoading(false);
    setIsGeneratingVisual(false);
    setVisualGenerationType('');
    setStreamingImageUrl(null);
    setStreamingVideoTask(null);
    setStreamingContent('');
    setStreamingSources(null);
    
    setConversationId(convId);
    setMessages([]);
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`, { headers: { Authorization: `Bearer ${token}` } });
      const msgs = await res.json();
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {}
    setShowSidebar(false);
  }

  function newConversation() {
    // Abort any active SSE stream so user can interact with new chat
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Reset all generating/loading states
    setLoading(false);
    setIsGeneratingVisual(false);
    setVisualGenerationType('');
    setStreamingImageUrl(null);
    setStreamingVideoTask(null);
    setStreamingContent('');
    setStreamingSources(null);
    
    setConversationId(null);
    const greet = user?.profile?.display_name || 'there';
    const botName = user?.profile?.assistant_name || 'SoulPrint';
    const customGreeting = user?.profile?.custom_greeting;
    
    // Use custom greeting if set, otherwise use default for new conversation
    const greetingContent = customGreeting 
      ? customGreeting.replace('{name}', greet).replace('{assistant}', botName)
      : `Hey ${greet} 👋 Starting fresh! What's on your mind?`;
    
    setMessages([{ id: 'greeting', role: 'assistant', content: greetingContent, created_at: new Date().toISOString() }]);
    setAttachments([]);
    setShowSidebar(false);
  }

  // Check for Google just connected flag and show welcome message
  const [showGoogleWelcome, setShowGoogleWelcome] = useState(false);
  
  useEffect(() => {
    const googleJustConnected = localStorage.getItem('google_just_connected');
    if (googleJustConnected === 'true' && token) {
      // Remove the localStorage flag
      localStorage.removeItem('google_just_connected');
      // Show the welcome banner
      setShowGoogleWelcome(true);
    }
  }, [token]);
  
  // Function to dismiss Google welcome
  const dismissGoogleWelcome = () => {
    setShowGoogleWelcome(false);
  };

  // Rename a conversation
  async function renameConversation(convId, newTitle) {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: newTitle.trim() } : c));
      }
    } catch (e) {
      console.error('Error renaming conversation:', e);
    }
    setEditingConvId(null);
    setEditingTitle('');
  }

  // Regenerate media with a different model
  // Regenerate media with a different model
  // mediaContext can include: { type: 'image'|'video', sourceImageUrl, videoUrl, imageUrl }
  const handleRegenerateWithModel = (originalPrompt, modelId, mediaContext = {}) => {
    if (!modelId) return;
    
    const actualPrompt = originalPrompt || 'Regenerate this';
    
    // Construct a prompt that requests the specific model
    let newPrompt = actualPrompt;
    
    // For videos, prepend with model instruction
    if (['kling-3.0', 'veo3', 'runway-aleph'].includes(modelId)) {
      const modelNames = {
        'kling-3.0': 'Kling 3.0',
        'veo3': 'Veo 3.1',
        'runway-aleph': 'Runway Aleph'
      };
      newPrompt = `Use ${modelNames[modelId]} to generate: ${actualPrompt}`;
    } else {
      // For images
      const modelNames = {
        'nano-banana': 'Nano Banana',
        'gemini-2.0-flash-exp-image-generation': 'Gemini',
        'gpt-image-1': 'GPT Image'
      };
      newPrompt = `Use ${modelNames[modelId] || modelId} to generate: ${actualPrompt}`;
    }
    
    // If there's a source image, we need to attach it for image-to-video regeneration
    if (mediaContext.sourceImageUrl || mediaContext.imageUrl) {
      const imageUrl = mediaContext.sourceImageUrl || mediaContext.imageUrl;
      // Store the image URL to be attached when sending
      setPendingMediaAttachment({
        type: 'image',
        url: imageUrl,
        forRegeneration: true,
      });
    }
    
    // Set the input
    setInput(newPrompt);
  };

  // Delete a conversation
  async function deleteConversation(convId) {
    // Find the conversation to check if it's in a project
    const conv = conversations.find(c => c.id === convId);
    const isInProject = conv?.project_id && conv.project_id !== 'general';
    const isViewingProject = selectedProject && selectedProject !== 'general';
    
    // Different confirmation messages based on context
    let confirmMsg = 'Are you sure you want to delete this conversation? This cannot be undone.';
    if (!isViewingProject && isInProject) {
      confirmMsg = 'This will remove the chat from "All Chats" but it will still be available in its Project. Continue?';
    }
    
    if (!confirm(confirmMsg)) return;
    
    try {
      // Pass from_project=true when deleting from within a project view
      const url = isViewingProject 
        ? `/api/conversations/${convId}?from_project=true`
        : `/api/conversations/${convId}`;
        
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== convId));
        // If we deleted the current conversation, start fresh
        if (convId === conversationId) {
          newConversation();
        }
      }
    } catch (e) {
      console.error('Error deleting conversation:', e);
    }
    setConvMenuId(null);
  }

  // Start editing a conversation title
  function startEditing(conv) {
    setEditingConvId(conv.id);
    setEditingTitle(conv.title || 'Conversation');
    setConvMenuId(null);
  }

  // ─────────────────────────────────────────────────────────────────
  // PROJECT MANAGEMENT FUNCTIONS
  // ─────────────────────────────────────────────────────────────────
  
  // Create a new project
  async function createProject() {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: newProjectName.trim(), 
          description: newProjectDescription.trim(),
          instructions: newProjectInstructions.trim()
        }),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects(prev => [{ ...project, is_owner: true, conversation_count: 0 }, ...prev]);
        setShowProjectModal(false);
        setNewProjectName('');
        setNewProjectDescription('');
        setNewProjectInstructions('');
      }
    } catch (err) {
      console.error('Create project error:', err);
    }
  }
  
  // Update project
  async function updateProject() {
    if (!editingProject || !newProjectName.trim()) return;
    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: newProjectName.trim(), 
          description: newProjectDescription.trim(),
          instructions: newProjectInstructions.trim()
        }),
      });
      if (res.ok) {
        setProjects(prev => prev.map(p => 
          p.id === editingProject.id 
            ? { ...p, name: newProjectName.trim(), description: newProjectDescription.trim(), instructions: newProjectInstructions.trim() } 
            : p
        ));
        setShowProjectModal(false);
        setEditingProject(null);
        setNewProjectName('');
        setNewProjectDescription('');
        setNewProjectInstructions('');
      }
    } catch (err) {
      console.error('Update project error:', err);
    }
  }
  
  // Delete project
  async function deleteProject(projectId) {
    if (!confirm('Delete this project? Conversations will be moved to uncategorized.')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (selectedProject === projectId) {
          setSelectedProject(null);
        }
        // Reload conversations
        const convRes = await fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${token}` } });
        const convData = await convRes.json();
        setConversations(Array.isArray(convData) ? convData : []);
      }
    } catch (err) {
      console.error('Delete project error:', err);
    }
  }
  
  // Open project edit modal
  function openEditProject(project) {
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectDescription(project.description || '');
    setNewProjectInstructions(project.instructions || '');
    setProjectModalMode('edit');
    setShowProjectModal(true);
  }
  
  // Open project share modal
  async function openShareProject(project) {
    setEditingProject(project);
    setProjectModalMode('share');
    setShareEmail('');
    setShareRole('collaborator');
    // Fetch/create share link
    try {
      const res = await fetch(`/api/projects/${project.id}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: true, role: 'viewer' }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjectShareLink(data.share_link);
      }
    } catch (err) {
      console.error('Error fetching share link:', err);
    }
    setShowProjectModal(true);
  }
  
  // Share project with user by email
  async function shareProjectWithUser() {
    if (!editingProject || !shareEmail.trim()) return;
    try {
      const res = await fetch(`/api/projects/${editingProject.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: shareEmail.trim(), role: shareRole }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Project shared successfully!');
        setShareEmail('');
        // Refresh projects
        const projRes = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
        const projData = await projRes.json();
        const allProjects = [
          ...(projData.owned || []),
          ...(projData.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
        const updatedProject = allProjects.find(p => p.id === editingProject.id);
        if (updatedProject) setEditingProject(updatedProject);
      } else {
        alert(data.error || 'Failed to share project');
      }
    } catch (err) {
      console.error('Share project error:', err);
      alert('Failed to share project');
    }
  }
  
  // Copy share link
  function copyShareLink() {
    if (!projectShareLink?.code) return;
    // Use /shared/ for public links, /join/ for registered-only links
    const prefix = projectShareLink?.public_view ? '/shared/' : '/join/';
    const link = `${window.location.origin}${prefix}${projectShareLink.code}`;
    navigator.clipboard.writeText(link);
    alert('Share link copied!');
  }
  
  // Move conversation to project
  async function moveConversationToProject(convId, projectId) {
    console.log('[UI] Moving conversation', convId, 'to project', projectId);
    try {
      const res = await fetch(`/api/conversations/${convId}/project`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId }),
      });
      console.log('[UI] Move response status:', res.status);
      if (res.ok) {
        // Update the local conversation's project_id immediately
        setConversations(prev => prev.map(c => 
          c.id === convId ? { ...c, project_id: projectId } : c
        ));
        // Also refresh conversations from server to ensure sync
        const convRes = await fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } });
        if (convRes.ok) {
          const convData = await convRes.json();
          setConversations(Array.isArray(convData) ? convData : []);
        }
        // Refresh projects
        const projRes = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
        const projData = await projRes.json();
        const allProjects = [
          ...(projData.owned || []),
          ...(projData.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('[UI] Move failed:', errData);
        alert('Failed to move conversation: ' + (errData.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Move conversation error:', err);
      alert('Failed to move conversation');
    }
    setShowMoveToProject(false);
    setMovingConversation(null);
    setConvMenuId(null);
  }
  
  // Open move to project dialog
  function openMoveToProject(conv) {
    setMovingConversation(conv);
    setShowMoveToProject(true);
    setConvMenuId(null);
  }

  // State for message feedback and editing
  const [messageFeedback, setMessageFeedback] = useState({}); // { messageId: 'up' | 'down' }
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  async function submitFeedback(messageId, rating) {
    // Update local state immediately for visual feedback
    setMessageFeedback(prev => ({ ...prev, [messageId]: rating }));
    
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          conversation_id: conversationId, 
          message_id: messageId, 
          rating,
          context: {
            model: messages.find(m => m.id === messageId)?.model_used,
            timestamp: new Date().toISOString(),
          }
        }),
      });
    } catch (e) {
      console.error('Feedback submission failed:', e);
    }
  }

  // Copy message to clipboard
  async function copyMessage(content, messageId) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }

  // Start editing a user message
  function startEditMessage(msg) {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  }

  // Cancel editing
  function cancelEdit() {
    setEditingMessageId(null);
    setEditingContent('');
  }

  // Submit edited message - creates a new branch in the conversation
  async function submitEditedMessage() {
    if (!editingContent.trim() || !editingMessageId) return;
    
    const editedMsgIndex = messages.findIndex(m => m.id === editingMessageId);
    if (editedMsgIndex === -1) return;
    
    // Keep messages up to and including the one before the edited message
    const messagesBeforeEdit = messages.slice(0, editedMsgIndex);
    
    // Create the edited message
    const editedMessage = {
      id: `edited-${Date.now()}`,
      role: 'user',
      content: editingContent.trim(),
      created_at: new Date().toISOString(),
      edited_from: editingMessageId,
    };
    
    // Update UI with trimmed history + edited message
    setMessages([...messagesBeforeEdit, editedMessage]);
    setEditingMessageId(null);
    setEditingContent('');
    setLoading(true);
    
    // Send the edited message to get a new response
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: editingContent.trim(),
          conversation_id: conversationId,
          model: selectedModel,
          history: messagesBeforeEdit.map(m => ({ role: m.role, content: m.content })),
          edited_from: editingMessageId,
          web_search_enabled: webSearchEnabled,
        }),
      });
      
      if (res.ok) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        
        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setStreamingContent(fullContent);
                }
              } catch {}
            }
          }
        }
        
        if (fullContent) {
          setMessages(prev => [...prev, {
            id: `response-${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            model_used: selectedModel,
            created_at: new Date().toISOString(),
          }]);
        }
        setStreamingContent('');
      }
    } catch (e) {
      console.error('Edit message failed:', e);
    }
    setLoading(false);
  }

  const currentModel = MODELS.find(m => m.value === selectedModel) || MODELS[0];

  // Filter conversations based on search query and pin Telegram chats to top
  const baseConversations = searchResults !== null ? searchResults : conversations;
  const filteredConversations = baseConversations.sort((a, b) => {
    // Pin Telegram conversations to the top
    if (a.source === 'telegram' && b.source !== 'telegram') return -1;
    if (a.source !== 'telegram' && b.source === 'telegram') return 1;
    return 0;
  });

  // Render mobile interface on mobile devices
  if (isMobile && token && user) {
    return (
      <>
        <MobileChat
          token={token}
          user={user}
          assistantName={assistantName}
          onOpenSettings={() => setShowSettings(true)}
          onOpenVoiceChat={voiceChatEnabled ? () => setShowVoiceChat(true) : null}
          initialConversationId={conversationId}
        />
        {showSettings && <SettingsModal onClose={() => { setShowSettings(false); setSettingsInitialTab(null); }} token={token} initialTab={settingsInitialTab} />}
        
        {/* Voice Conversation Modal */}
        {showVoiceChat && voiceChatEnabled && (
          <RealtimeVoiceChat 
            token={token} 
            onClose={() => setShowVoiceChat(false)}
            onSaveTranscript={saveVoiceTranscript}
            systemPrompt={`You are ${assistantName || 'a helpful AI assistant'} having a voice conversation with ${user?.displayName || user?.email || 'the user'}. Be conversational, natural, and concise. Respond as if you're having a real phone call - be warm and engaging.`}
            userName={user?.displayName || user?.email?.split('@')[0]}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex h-screen bg-sp-black overflow-hidden safe-area-all">
      {showSidebar && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setShowSidebar(false)} />}

      {/* Sidebar */}
      <div className={`fixed lg:relative z-50 h-full bg-[#111820] border-r border-white/5 flex flex-col transform transition-all duration-300 ${
        sidebarCollapsed 
          ? 'w-16 lg:w-16' 
          : 'w-64'
      } ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`p-4 border-b border-white/5 pwa-header ${sidebarCollapsed ? 'px-2' : ''}`}>
          {/* Header with collapse toggle */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-3`}>
            <div className={`flex items-center ${sidebarCollapsed ? '' : 'gap-2'}`}>
              <SoulPrintLogo size={22} />
              {!sidebarCollapsed && <span className="font-condensed font-bold text-white text-sm tracking-widest uppercase">{assistantName}</span>}
            </div>
            {/* Collapse toggle button - desktop only */}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex items-center justify-center p-1.5 text-gray-600 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {sidebarCollapsed ? (
            <button onClick={newConversation} className="w-full btn-orange py-2.5 rounded-lg flex items-center justify-center" title="New Chat">
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={newConversation} className="w-full btn-orange py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> New Chat
            </button>
          )}
        </div>
        
        {/* Search conversations - hidden when collapsed */}
        {!sidebarCollapsed && conversations.length > 0 && (
          <div className="px-3 py-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                  if (!val.trim()) {
                    setSearchResults(null);
                    return;
                  }
                  searchTimeoutRef.current = setTimeout(() => {
                    fetch(`/api/user/conversations?search=${encodeURIComponent(val)}`, { headers: { Authorization: `Bearer ${token}` } })
                      .then(r => r.json())
                      .then(d => setSearchResults(Array.isArray(d) ? d : []))
                      .catch(() => {});
                  }, 300);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:border-orange-500/40 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
        
        <div className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'p-1' : 'p-2'}`}>
          {!sidebarCollapsed && (
            <>
              {/* Projects Section */}
              <div className="mb-3">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Projects</span>
                  <button
                    onClick={() => {
                      setProjectModalMode('create');
                      setNewProjectName('');
                      setNewProjectDescription('');
                      setEditingProject(null);
                      setShowProjectModal(true);
                    }}
                    className="p-1 text-gray-600 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors"
                    title="New Project"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {projects.length === 0 ? (
                  <p className="text-gray-700 text-[10px] text-center py-2">No projects yet</p>
                ) : (
                  <div className="space-y-0.5">
                    {projects.map(project => (
                      <div key={project.id} className="group relative">
                        <button
                          onClick={() => setSelectedProject(selectedProject === project.id ? null : project.id)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all ${
                            selectedProject === project.id 
                              ? 'bg-purple-500/20 text-purple-300' 
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="flex-1 text-left truncate">{project.name}</span>
                          {project.is_shared && <Users className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                          <span className="text-[10px] text-gray-600">{project.conversation_count || 0}</span>
                        </button>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditProject(project); }}
                            className="p-1 text-gray-600 hover:text-white hover:bg-white/10 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openShareProject(project); }}
                            className="p-1 text-gray-600 hover:text-purple-400 hover:bg-purple-500/10 rounded"
                            title="Share"
                          >
                            <Share2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Divider */}
              <div className="border-t border-white/5 my-2" />
              
              {/* Conversations label */}
              <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {selectedProject ? (selectedProject === 'general' ? 'Uncategorized' : projects.find(p => p.id === selectedProject)?.name || 'Project') : 'All Chats'}
                </span>
                {selectedProject && (
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="text-[10px] text-orange-400 hover:text-orange-300"
                  >
                    Show all
                  </button>
                )}
              </div>
            </>
          )}
          
          {conversations.length === 0 ? (
            !sidebarCollapsed && <p className="text-gray-700 text-xs text-center mt-6">No conversations yet</p>
          ) : filteredConversations.length === 0 ? (
            !sidebarCollapsed && <p className="text-gray-600 text-xs text-center mt-6">No matching conversations</p>
          ) : filteredConversations
            .filter(conv => {
              if (!selectedProject) return true;
              if (selectedProject === 'general') return !conv.project_id;
              return conv.project_id === selectedProject;
            })
            .map(conv => (
            <div key={conv.id} className="relative group mb-1">
              {sidebarCollapsed ? (
                // Collapsed view - icon only
                <button 
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-all ${conv.id === conversationId ? 'bg-white/10 text-orange-400' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
                  title={conv.title || 'Conversation'}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              ) : editingConvId === conv.id ? (
                // Editing mode - inline rename
                <div className="flex items-center gap-1 px-2 py-1.5 bg-white/5 rounded-lg">
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameConversation(conv.id, editingTitle);
                      if (e.key === 'Escape') { setEditingConvId(null); setEditingTitle(''); }
                    }}
                    className="flex-1 bg-transparent text-white text-xs outline-none border-none"
                    autoFocus
                  />
                  <button
                    onClick={() => renameConversation(conv.id, editingTitle)}
                    className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setEditingConvId(null); setEditingTitle(''); }}
                    className="p-1 text-gray-500 hover:bg-white/10 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                // Normal display mode
                <div className="flex items-center">
                  <button 
                    onClick={() => loadConversation(conv.id)}
                    className={`flex-1 text-left px-3 py-2.5 rounded-lg text-xs text-gray-400 hover:bg-white/5 hover:text-white transition-all truncate ${conv.id === conversationId ? 'bg-white/5 text-white' : ''}`}
                  >
                    <MessageSquare className="w-3 h-3 inline mr-2 opacity-50" />
                    {conv.title || 'Conversation'}
                    {conv.source === 'telegram' && <span className="ml-1 text-[#229ED9] text-[9px]">TG</span>}
                  </button>
                  {/* Menu trigger - shows on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setConvMenuId(convMenuId === conv.id ? null : conv.id); }}
                    className="p-1.5 text-gray-600 hover:text-white hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              
              {/* Dropdown menu */}
              {convMenuId === conv.id && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                  <button
                    onClick={() => startEditing(conv)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Rename
                  </button>
                  <button
                    onClick={() => openMoveToProject(conv)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-400 hover:bg-purple-500/10 transition-colors"
                  >
                    <Folder className="w-3 h-3" /> Move to Project
                  </button>
                  <button
                    onClick={() => deleteConversation(conv.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Latest News Widget - hidden when collapsed */}
        {!sidebarCollapsed && latestNews.length > 0 && (
          <div className="px-3 py-2 border-t border-white/5">
            <button 
              onClick={() => setShowNewsExpanded(!showNewsExpanded)}
              className="flex items-center justify-between w-full text-left mb-2"
            >
              <div className="flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Latest News</span>
              </div>
              <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${showNewsExpanded ? 'rotate-180' : ''}`} />
            </button>
            <div className={`space-y-1.5 overflow-hidden transition-all ${showNewsExpanded ? 'max-h-40' : 'max-h-16'}`}>
              {latestNews.slice(0, showNewsExpanded ? 3 : 1).map(post => (
                <a 
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-blue-500/30 rounded-lg transition-colors group"
                >
                  <p className="text-[11px] text-gray-300 group-hover:text-white line-clamp-2 leading-tight">{post.title}</p>
                  <p className="text-[9px] text-gray-600 mt-0.5">{new Date(post.published_at || post.created_at).toLocaleDateString()}</p>
                </a>
              ))}
            </div>
            {latestNews.length > 1 && (
              <a 
                href="/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mt-2 py-1"
              >
                View all posts <ChevronRight className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
        
        <div className={`p-3 border-t border-white/5 space-y-2 safe-area-bottom ${sidebarCollapsed ? 'px-2' : ''}`} style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)' }}>
          {/* Gallery button */}
          <button 
            onClick={() => setShowGallery(true)}
            className={`flex items-center justify-center ${sidebarCollapsed ? '' : 'gap-1.5'} w-full py-2 px-3 bg-gradient-to-r from-pink-500/10 to-blue-500/10 hover:from-pink-500/20 hover:to-blue-500/20 border border-pink-500/30 rounded-lg text-pink-400 hover:text-pink-300 text-xs transition-colors`}
            title="Media Gallery"
          >
            <GalleryHorizontal className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'Media Gallery'}
          </button>
          {/* Admin Dashboard link - only for admins */}
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <a 
              href="/admin"
              className={`flex items-center justify-center ${sidebarCollapsed ? '' : 'gap-1.5'} w-full py-2 px-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:text-orange-300 text-xs transition-colors`}
              title="Admin Dashboard"
            >
              <Shield className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'Admin Dashboard'}
            </a>
          )}
          <button 
            onClick={() => setShowFeedbackModal(true)}
            className={`flex items-center justify-center ${sidebarCollapsed ? '' : 'gap-1.5'} w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white text-xs transition-colors`}
            title="Send Feedback"
          >
            <MessageCircle className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'Send Feedback'}
          </button>
          {!sidebarCollapsed && <p className="text-gray-700 text-[10px] text-center truncate">{user?.email}</p>}
          
          {/* View Home Page link */}
          <a 
            href="/"
            className={`flex items-center justify-center ${sidebarCollapsed ? '' : 'gap-1.5'} w-full py-2 px-3 text-gray-600 hover:text-white hover:bg-white/5 rounded-lg text-xs transition-colors`}
            title="View Home Page"
          >
            <ExternalLink className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'View Home Page'}
          </a>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar - with safe area padding for PWA */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0 pwa-header bg-sp-black">
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button onClick={() => setShowSidebar(!showSidebar)} className="text-gray-500 hover:text-white transition-colors lg:hidden">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <SoulPrintLogo size={20} />
              <span className="text-white font-medium text-sm">{assistantName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Web search toggle */}
            <button
              onClick={() => setWebSearchEnabled(v => !v)}
              title={webSearchEnabled ? 'Web search ON — click to disable' : 'Web search OFF — click to enable'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] border transition-all ${webSearchEnabled ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-white/4 border-white/10 text-gray-600'}`}>
              <Globe className="w-3 h-3" />
              {webSearchEnabled ? 'Web On' : 'Web Off'}
            </button>
            {/* Feedback button */}
            <button
              onClick={() => setShowFeedbackModal(true)}
              title="Send Feedback"
              className="text-gray-500 hover:text-orange-400 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            {/* Admin Dashboard button - only for admins */}
            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <a
                href="/admin"
                title="Admin Dashboard"
                className="text-gray-500 hover:text-orange-400 transition-colors"
              >
                <Shield className="w-5 h-5" />
              </a>
            )}
            {/* What's New button with badge */}
            <button 
              onClick={() => setShowWhatsNew(true)} 
              className="text-gray-500 hover:text-orange-400 transition-colors relative"
              title="What's New"
            >
              <Sparkles className="w-5 h-5" />
              {appUpdatesUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {appUpdatesUnread > 9 ? '9+' : appUpdatesUnread}
                </span>
              )}
            </button>
            <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Project Breadcrumb Bar - shows when viewing a project */}
        {selectedProject && selectedProject !== 'general' && (
          <div className="flex items-center justify-between px-4 py-2 bg-purple-500/5 border-b border-purple-500/20 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <button 
                onClick={() => setSelectedProject(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                All Chats
              </button>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <div className="flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 font-medium">
                  {projects.find(p => p.id === selectedProject)?.name || 'Project'}
                </span>
                {projects.find(p => p.id === selectedProject)?.instructions && (
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[9px] rounded">
                    Custom AI
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                // Start a new conversation in this project
                setConversationId(null);
                setMessages([]);
                setInput('');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>
        )}

        {/* Announcements Banner */}
        {announcements.length > 0 && (
          <div className="px-4 pt-4 space-y-2">
            {announcements.slice(0, 3).map(ann => (
              <div 
                key={ann.id} 
                className={`relative flex items-start gap-3 p-3 rounded-xl border backdrop-blur-sm ${
                  ann.type === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
                  ann.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                  ann.type === 'update' ? 'bg-blue-500/10 border-blue-500/30' :
                  'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  ann.type === 'warning' ? 'bg-orange-500/20' :
                  ann.type === 'success' ? 'bg-green-500/20' :
                  ann.type === 'update' ? 'bg-blue-500/20' :
                  'bg-blue-500/20'
                }`}>
                  <Megaphone className={`w-4 h-4 ${
                    ann.type === 'warning' ? 'text-orange-400' :
                    ann.type === 'success' ? 'text-green-400' :
                    ann.type === 'update' ? 'text-blue-400' :
                    'text-blue-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-sm font-medium">{ann.title}</h4>
                  <p className="text-gray-400 text-xs mt-0.5">{ann.content}</p>
                  {ann.link && (
                    <a 
                      href={ann.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      onClick={() => {
                        // Track click
                        fetch('/api/announcements/click', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ announcementId: ann.id }),
                        }).catch(() => {});
                      }}
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1.5 transition-colors"
                    >
                      Learn more <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {/* Dismiss buttons - always visible */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => dismissAnnouncement(ann.id, false)}
                    className="px-2.5 py-1 text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                    title="Hide for 24 hours, then show again"
                  >
                    Remind Later
                  </button>
                  <button
                    onClick={() => dismissAnnouncement(ann.id, true)}
                    className="px-2.5 py-1 text-[10px] text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                    title="Don't show this announcement again"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PWA Install Prompt Banner */}
        {showInstallPrompt && (
          <div className="px-4 pt-3">
            <div className="relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white text-sm font-medium">Install SoulPrint App</h4>
                <p className="text-gray-400 text-xs mt-1">
                  Get quick access from your home screen! This is <span className="text-green-400 font-medium">not a download</span> — it's just a shortcut. 
                  No storage used, no malware, completely safe.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button 
                    onClick={() => handleInstallAction('install')}
                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Install App
                  </button>
                  <button 
                    onClick={() => handleInstallAction('remind_later')}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    Remind Me Later
                  </button>
                  <button 
                    onClick={() => handleInstallAction('dismiss_forever')}
                    className="px-3 py-1.5 text-gray-500 hover:text-gray-300 text-xs transition-colors"
                  >
                    Don't show again
                  </button>
                </div>
              </div>
              <button 
                onClick={() => handleInstallAction('remind_later')}
                className="absolute top-2 right-2 text-gray-600 hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {/* Google Welcome Banner */}
            {showGoogleWelcome && (
              <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-xl p-4 relative animate-fade-in">
                <button
                  onClick={dismissGoogleWelcome}
                  className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-sm mb-2">🎉 Google Account Connected!</h3>
                    <p className="text-gray-300 text-xs leading-relaxed mb-3">
                      I can now help you with Gmail, Calendar, and Drive. Try asking:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-black/20 rounded-lg p-2">
                        <span className="text-blue-400 font-medium">📧 Gmail</span>
                        <p className="text-gray-400 mt-1">"Show my unread emails"</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-2">
                        <span className="text-green-400 font-medium">📅 Calendar</span>
                        <p className="text-gray-400 mt-1">"What's on my calendar?"</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-2">
                        <span className="text-yellow-400 font-medium">📁 Drive</span>
                        <p className="text-gray-400 mt-1">"Find my recent docs"</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <MessageErrorBoundary key={`eb-${msg.id || idx}`}>
              <div key={msg.id || idx} className={`msg-appear group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0 mt-0.5">
                    <SoulPrintLogo size={12} className="sm:hidden" />
                    <SoulPrintLogo size={14} className="hidden sm:block" />
                  </div>
                )}
                <div className={`min-w-0 ${msg.role === 'user' ? 'max-w-[90%] sm:max-w-[85%] lg:max-w-[80%]' : 'max-w-[95%] sm:max-w-[90%] lg:max-w-[85%]'}`}>
                  {/* User message edit controls */}
                  {msg.role === 'user' && !loading && (
                    <div className="flex justify-end mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEditMessage(msg)}
                        className="text-gray-600 hover:text-orange-400 transition-colors p-1 rounded"
                        title="Edit message"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {/* Show image preview in user message */}
                  {msg.role === 'user' && msg.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                      {msg.attachments.map((att, i) => (
                        att.type === 'image' ? (
                          <img key={i} src={`data:${att.mimeType};base64,${att.base64}`} alt={att.name}
                            className="h-16 sm:h-24 rounded-lg object-cover border border-white/10" />
                        ) : (
                          <div key={i} className="flex items-center gap-1.5 bg-white/8 border border-white/15 rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs text-white">
                            <FileText className="w-3 h-3 text-orange-400" /><span className="truncate max-w-[100px] sm:max-w-none">{att.name}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  <div className={`rounded-2xl px-3 py-2.5 sm:px-5 sm:py-3.5 text-[15px] sm:text-base leading-7 break-words ${msg.role === 'user' ? 'bg-orange-500/15 border border-orange-500/20 text-white' : 'bg-white/4 border border-white/8 text-gray-200'}`}>
                    {msg.role === 'assistant' ? (
                      <>
                        {/* Generating Animation - show when creating flyers/infographics/images */}
                        {msg.is_generating && (
                          <div className="mb-4">
                            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-white/10 p-4">
                              {/* Animated background shimmer */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                              
                              {/* Content */}
                              <div className="relative flex items-center gap-4">
                                {/* Animated icon */}
                                <div className="relative">
                                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                                    <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                                  </div>
                                  {/* Spinning ring */}
                                  <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
                                </div>
                                
                                {/* Text */}
                                <div className="flex-1">
                                  <p className="text-white font-medium text-sm mb-1">Creating your design...</p>
                                  <p className="text-gray-400 text-xs">This may take a moment. We're crafting something beautiful!</p>
                                </div>
                              </div>
                              
                              {/* Progress dots */}
                              <div className="flex justify-center gap-1.5 mt-4">
                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Image card */}
                        {msg.image_url && (
                          <ImageCard 
                            url={msg.image_url} 
                            revisedPrompt={msg.content?.match(/\*Prompt used: (.+)\*/)?.[1] || msg.generation_params?.prompt || ''} 
                            modelLabel={msg.model_label || msg.generation_params?.modelLabel} 
                            generationParams={msg.generation_params}
                            onEdit={(imageData) => {
                              setEditableImage({ ...imageData, messageId: msg.id });
                              setShowImageEditor(true);
                            }}
                            onRegenerateWith={handleRegenerateWithModel}
                          />
                        )}
                        {/* Video card - for polling state (only if no video_url yet) */}
                        {msg.video_task && !msg.video_url && (
                          <VideoCard
                            taskId={msg.video_task.taskId}
                            prompt={msg.video_task.prompt}
                            token={token}
                            initialStatus={msg.video_task.status === 'success' ? 'success' : 'generating'}
                            modelLabel={msg.model_label || 'Kling 3.0'}
                            messageId={msg.id}
                            videoModelReason={msg.video_model_reason || msg.video_task?.videoModelReason}
                            sourceImageUrl={msg.source_image || msg.video_task?.sourceImage}
                            onVideoReady={(videoUrl) => {
                              // Update the message in state so SavedVideoCard takes over
                              setMessages(prev => prev.map(m => 
                                m.id === msg.id ? { ...m, video_url: videoUrl } : m
                              ));
                            }}
                            onRegenerateWith={handleRegenerateWithModel}
                          />
                        )}
                        {/* Saved video - direct URL from database */}
                        {msg.video_url && (
                          <SavedVideoCard 
                            videoUrl={msg.video_url} 
                            modelLabel={msg.model_label} 
                            prompt={msg.video_task?.prompt || msg.generation_params?.prompt || ''} 
                            token={token}
                            sourceImageUrl={msg.source_image || msg.video_task?.sourceImage}
                            onRegenerateWith={handleRegenerateWithModel}
                          />
                        )}
                        {/* Regular text (skip for pure image/video messages and active video tasks) */}
                        {!msg.image_url && !msg.video_url && !(msg.video_task && !msg.video_url) && (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({children}) => <p className="mb-3 last:mb-0 break-words">{children}</p>,
                              code: ({inline, children}) => inline 
                                ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-orange-300 text-[13px] sm:text-sm break-all">{children}</code> 
                                : <pre className="bg-sp-black p-3 sm:p-4 rounded-lg my-3 overflow-x-auto text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words"><code>{children}</code></pre>,
                              ul: ({children}) => <ul className="list-disc pl-5 space-y-1.5 mb-3">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-5 space-y-1.5 mb-3">{children}</ol>,
                              li: ({children}) => <li className="pl-1">{children}</li>,
                              strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                              a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-orange-300 break-all">{children}</a>,
                              h1: ({children}) => <h1 className="text-lg sm:text-xl font-bold text-white mt-5 mb-3">{children}</h1>,
                              h2: ({children}) => <h2 className="text-base sm:text-lg font-bold text-white mt-4 mb-2.5">{children}</h2>,
                              h3: ({children}) => <h3 className="text-[15px] sm:text-base font-semibold text-white mt-3.5 mb-2">{children}</h3>,
                              blockquote: ({children}) => <blockquote className="border-l-2 border-orange-500/40 pl-4 my-3 italic text-gray-400">{children}</blockquote>,
                              img: ({src, alt}) => <img src={src} alt={alt} className="max-w-full rounded-lg my-3" />,
                              table: ({children}) => <div className="overflow-x-auto my-3"><table className="min-w-full text-[13px] sm:text-sm border-collapse">{children}</table></div>,
                              th: ({children}) => <th className="border border-white/20 px-3 py-1.5 bg-white/5 text-left font-semibold">{children}</th>,
                              td: ({children}) => <td className="border border-white/10 px-3 py-1.5">{children}</td>,
                            }}>
                            {typeof msg.content === 'string' ? msg.content : String(msg.content || '')}
                          </ReactMarkdown>
                        )}
                        
                        {/* Sources Section - Like Perplexity */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                              <Globe className="w-3 h-3" /> Sources
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.sources.map((source, idx) => (
                                <a
                                  key={idx}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30 rounded-lg px-2.5 py-1.5 transition-all"
                                  title={source.snippet || source.title}
                                >
                                  <span className="w-4 h-4 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="text-[11px] text-gray-400 group-hover:text-white truncate max-w-[150px] transition-colors">
                                    {source.title}
                                  </span>
                                  <ExternalLink className="w-2.5 h-2.5 text-gray-600 group-hover:text-orange-400 flex-shrink-0 transition-colors" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // User message - support editing
                      editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full bg-sp-black border border-orange-500/30 rounded-lg p-2 text-white text-[13px] sm:text-sm focus:outline-none focus:border-orange-500/50 resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={cancelEdit} className="px-3 py-1 text-gray-500 hover:text-white text-xs transition-colors">
                              Cancel
                            </button>
                            <button 
                              onClick={submitEditedMessage}
                              disabled={!editingContent.trim()}
                              className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg disabled:opacity-50 transition-colors"
                            >
                              Save & Regenerate
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )
                    )}
                  </div>
                  {msg.role === 'assistant' && msg.id !== 'greeting' && (
                    <div className="flex items-center gap-2 mt-1.5 ml-1">
                      {/* Thumbs Up */}
                      <button 
                        onClick={() => submitFeedback(msg.id, 'up')} 
                        className={`transition-colors p-1 rounded ${messageFeedback[msg.id] === 'up' ? 'text-green-400 bg-green-400/10' : 'text-gray-700 hover:text-green-400'}`}
                        title="Good response"
                      >
                        <ThumbsUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                      {/* Thumbs Down */}
                      <button 
                        onClick={() => submitFeedback(msg.id, 'down')} 
                        className={`transition-colors p-1 rounded ${messageFeedback[msg.id] === 'down' ? 'text-red-400 bg-red-400/10' : 'text-gray-700 hover:text-red-400'}`}
                        title="Poor response"
                      >
                        <ThumbsDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                      {/* Copy Button */}
                      <button 
                        onClick={() => copyMessage(msg.content, msg.id)} 
                        className={`transition-colors p-1 rounded ${copiedMessageId === msg.id ? 'text-green-400' : 'text-gray-700 hover:text-white'}`}
                        title={copiedMessageId === msg.id ? 'Copied!' : 'Copy message'}
                      >
                        {copiedMessageId === msg.id ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                      </button>
                      {/* Continue Button - show for last assistant message if it might be truncated */}
                      {idx === messages.length - 1 && msg.content && msg.content.length > 500 && !loading && (
                        <button
                          onClick={() => {
                            setInput('Please continue from where you left off.');
                            setTimeout(() => sendMessage(), 100);
                          }}
                          className="transition-colors p-1 rounded text-gray-700 hover:text-orange-400 flex items-center gap-1"
                          title="Continue response"
                        >
                          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="text-[9px] sm:text-[10px]">Continue</span>
                        </button>
                      )}
                      {msg.model_used && <span className="text-[9px] sm:text-[10px] text-gray-700 truncate max-w-[80px] sm:max-w-none">{msg.model_used}</span>}
                    </div>
                  )}
                </div>
              </div>
              </MessageErrorBoundary>
            ))}

            {/* Web searching indicator */}
            {searchingWeb && (
              <div className="flex justify-start msg-appear">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                  <SoulPrintLogo size={12} className="sm:hidden" />
                  <SoulPrintLogo size={14} className="hidden sm:block" />
                </div>
                <div className="bg-white/4 border border-white/8 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2">
                  <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 animate-pulse" />
                  <span className="text-gray-400 text-[13px] sm:text-sm">
                    Searching: <span className="text-orange-400 truncate max-w-[120px] sm:max-w-none inline-block align-bottom">{searchQueries[0] || 'the web'}...</span>
                  </span>
                </div>
              </div>
            )}

            {/* Streaming */}
            {(streamingContent || (streamingImageUrl && loading) || streamingVideoTask) && (
              <div className="msg-appear flex justify-start">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0 mt-0.5">
                  <SoulPrintLogo size={12} className="sm:hidden" />
                  <SoulPrintLogo size={14} className="hidden sm:block" />
                </div>
                <div className="min-w-0 max-w-[95%] sm:max-w-[90%] lg:max-w-[85%] rounded-2xl px-3 py-2.5 sm:px-5 sm:py-3.5 bg-white/4 border border-white/8 text-[15px] sm:text-base text-gray-200 leading-7 break-words">
                  {/* Live image preview - only show while loading */}
                  {streamingImageUrl && loading && (
                    <ImageCard url={streamingImageUrl} revisedPrompt={streamingRevPrompt} onRegenerateWith={handleRegenerateWithModel} />
                  )}
                  {/* Live video card */}
                  {streamingVideoTask && !streamingImageUrl && (
                    <VideoCard
                      taskId={streamingVideoTask.taskId}
                      prompt={streamingVideoTask.prompt}
                      token={token}
                      initialStatus={streamingVideoTask.status}
                      modelLabel={streamingVideoTask.videoModelLabel || 'AI Video'}
                      messageId={streamingVideoTask.messageId}
                      videoModelReason={streamingVideoTask.videoModelReason}
                      sourceImageUrl={streamingVideoTask.sourceImage}
                      onVideoReady={(videoUrl) => {
                        // Video completed during streaming - update message state
                        if (streamingVideoTask.messageId) {
                          setMessages(prev => prev.map(m => 
                            m.id === streamingVideoTask.messageId 
                              ? { ...m, video_url: videoUrl, video_task: { ...m.video_task, status: 'success' } } 
                              : m
                          ));
                        }
                        // Clear streaming state
                        setStreamingVideoTask(null);
                      }}
                      onRegenerateWith={handleRegenerateWithModel}
                    />
                  )}
                  {/* Regular text (only if not a pure image/video message) */}
                  {streamingContent && !streamingImageUrl && !streamingVideoTask && !(isGeneratingVisual && visualGenerationType === 'video') && (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({children}) => <p className="mb-3 last:mb-0 break-words">{children}</p>,
                          strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                          a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline break-all">{children}</a>,
                          code: ({inline, children}) => inline 
                            ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-orange-300 text-[13px] sm:text-sm break-all">{children}</code> 
                            : <pre className="bg-sp-black p-3 sm:p-4 rounded-lg my-3 overflow-x-auto text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words"><code>{children}</code></pre>,
                        }}>
                        {typeof streamingContent === 'string' ? streamingContent : String(streamingContent || '')}
                      </ReactMarkdown>
                      <span className="inline-block w-0.5 h-4 bg-orange-500 ml-0.5 animate-pulse" />
                      
                      {/* Show "still generating" indicator if stalled */}
                      {streamingStalled && (
                        <div className="mt-3 flex items-center gap-2 text-gray-400 text-xs">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span>Still generating, please wait...</span>
                        </div>
                      )}
                      
                      {/* Sources during streaming */}
                      {streamingSources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                            <Globe className="w-3 h-3" /> Sources
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {streamingSources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30 rounded-lg px-2.5 py-1.5 transition-all"
                                title={source.snippet || source.title}
                              >
                                <span className="w-4 h-4 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-[11px] text-gray-400 group-hover:text-white truncate max-w-[150px] transition-colors">
                                  {source.title}
                                </span>
                                <ExternalLink className="w-2.5 h-2.5 text-gray-600 group-hover:text-orange-400 flex-shrink-0 transition-colors" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {loading && !streamingContent && !searchingWeb && (
              <div className="flex justify-start">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                  <SoulPrintLogo size={12} className="sm:hidden" />
                  <SoulPrintLogo size={14} className="hidden sm:block" />
                </div>
                <TypingIndicator />
              </div>
            )}

            {/* Compare Mode Loading */}
            {compareLoading && (
              <div className="msg-appear -mx-4 md:-mx-8 lg:-mx-16 px-4 md:px-8 lg:px-16">
                <div className="bg-gradient-to-br from-orange-500/5 to-blue-500/5 border border-white/10 rounded-2xl p-5 mb-4">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <GitCompare className="w-5 h-5 text-orange-400 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-white">Comparing {compareModels.length} models...</p>
                      <p className="text-sm text-gray-500">This may take a moment</p>
                    </div>
                  </div>
                  <div className={`grid gap-4 ${compareModels.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                    {compareModels.map(m => {
                      const modelInfo = MODELS.find(mod => mod.value === m.model);
                      return (
                        <CompareResponseCard 
                          key={m.model} 
                          response={{ model: m.model, provider: m.provider, label: modelInfo?.label, group: modelInfo?.group }}
                          isLoading={true}
                          totalModels={compareModels.length}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Compare Mode Responses */}
            {compareResponses && !compareLoading && (
              <div className="msg-appear -mx-4 md:-mx-8 lg:-mx-16 px-4 md:px-8 lg:px-16">
                <div className="bg-gradient-to-br from-orange-500/5 to-blue-500/5 border border-white/10 rounded-2xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <GitCompare className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-white">Compare Responses</p>
                        <p className="text-sm text-gray-500">
                          {compareResponses.usedWebSearch && <span className="text-cyan-400 mr-2">🌐 Web search used</span>}
                          Select your preferred response to continue
                        </p>
                      </div>
                    </div>
                    {selectedCompareResponse && (
                      <span className="text-sm text-green-400 flex items-center gap-1.5 bg-green-500/10 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" /> Response selected
                      </span>
                    )}
                  </div>
                  <div className={`grid gap-4 ${compareResponses.responses.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                    {compareResponses.responses.map(response => (
                      <CompareResponseCard 
                        key={response.model} 
                        response={response}
                        onSelect={handleSelectCompareResponse}
                        selected={selectedCompareResponse === response.model}
                        totalModels={compareResponses.responses.length}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Visual Content Generating Indicator — only before VideoCard takes over */}
            {isGeneratingVisual && !streamingVideoTask && (
              <div className="px-2 sm:px-4 py-3">
                <div className="max-w-3xl mx-auto">
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 p-5">
                    {/* Animated background shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                    
                    {/* Content */}
                    <div className="relative flex items-center gap-4">
                      {/* Animated icon */}
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                          <Sparkles className="w-7 h-7 text-purple-400 animate-pulse" />
                        </div>
                        {/* Spinning ring */}
                        <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
                      </div>
                      
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-base mb-1">
                          {visualGenerationType === 'infographic' ? '📊 Creating your infographic...' :
                           visualGenerationType === 'flyer' ? '📄 Designing your flyer...' :
                           visualGenerationType === 'poster' ? '🖼️ Creating your poster...' :
                           visualGenerationType === 'edit' ? '✏️ Editing your image...' :
                           visualGenerationType === 'composite' ? '🎨 Creating realistic mockup...' :
                           visualGenerationType === 'video' ? '🎬 Generating your video...' :
                           '✨ Generating your image...'}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {visualGenerationType === 'video' 
                            ? 'This may take 1-3 minutes. Creating cinematic magic!' 
                            : visualGenerationType === 'composite'
                            ? 'AI is blending your design into the image naturally. ~15-20 seconds.'
                            : 'This may take 15-30 seconds. We\'re crafting something beautiful!'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress animation */}
                    <div className="mt-4 relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full animate-progress" />
                    </div>
                    
                    {/* Progress dots */}
                    <div className="flex justify-center gap-2 mt-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>

                    {/* Leave notification hint */}
                    {visualGenerationType === 'video' && (
                      <div className="mt-4 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                        <span className="text-xs">💡</span>
                        <p className="text-[11px] text-cyan-400/70">You can leave this chat — we'll notify you when it's ready.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer - with safe area padding at bottom for PWA */}
        <div 
          className={`flex-shrink-0 px-4 pb-6 safe-area-bottom relative transition-all ${isDragging ? 'ring-2 ring-orange-500 ring-inset' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-orange-500/10 border-2 border-dashed border-orange-500 rounded-2xl flex items-center justify-center z-50 pointer-events-none">
              <div className="text-center">
                <Upload className="w-10 h-10 text-orange-400 mx-auto mb-2" />
                <p className="text-orange-400 font-medium">Drop files here</p>
                <p className="text-orange-400/60 text-sm">Images, PDFs, documents</p>
              </div>
            </div>
          )}
          <div className="max-w-4xl mx-auto">
            {/* Mode Toggle & Model selector */}
            <div className="flex flex-col items-center gap-2 mb-3">
              {/* Compare Mode Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCompareMode(!compareMode);
                    if (!compareMode && compareModels.length === 0) {
                      // Pre-select some popular models when enabling compare mode
                      setCompareModels([
                        { model: 'gpt-4o', provider: 'openai' },
                        { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
                      ]);
                    }
                  }}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all ${
                    compareMode 
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' 
                      : 'bg-white/4 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
                  }`}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>{compareMode ? 'Compare Mode' : 'Single Model'}</span>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${compareMode ? 'bg-orange-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${compareMode ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </button>
              </div>

              {/* ── Unified Model Selector (Dynamic Intelligence) ── */}
              {!compareMode && (
                <div className="relative" ref={modelPickerRef}>
                  <button onClick={() => { setShowModelPicker(!showModelPicker); setShowVideoModelPicker(false); }}
                    className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors bg-white/4 border border-white/8 px-3 py-1.5 rounded-full">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    {selectedModel === 'smart' && selectedVideoModel === 'smart' && selectedImageModel === 'smart' ? (
                      <span className="text-cyan-400/90">Dynamic Intelligence</span>
                    ) : (
                      <span className="flex items-center gap-1 flex-wrap">
                        {selectedModel !== 'smart' && <span className="text-orange-400/80">{currentModel.label}</span>}
                        {selectedVideoModel !== 'smart' && (
                          <>
                            {selectedModel !== 'smart' && <span className="text-gray-600">·</span>}
                            <span className="text-blue-400/80">{VIDEO_MODELS.find(m => m.value === selectedVideoModel)?.label}</span>
                          </>
                        )}
                        {selectedImageModel !== 'smart' && (
                          <>
                            {(selectedModel !== 'smart' || selectedVideoModel !== 'smart') && <span className="text-gray-600">·</span>}
                            <span className="text-pink-400/80">{IMAGE_MODELS.find(m => m.value === selectedImageModel)?.label}</span>
                          </>
                        )}
                        {(selectedModel === 'smart' || selectedVideoModel === 'smart' || selectedImageModel === 'smart') && <span className="text-cyan-400/60 ml-0.5">+ Auto</span>}
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showModelPicker && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#141a21] border border-white/10 rounded-xl shadow-2xl min-w-[280px] z-10 max-h-[400px] overflow-y-auto">
                      {/* Dynamic Intelligence - Auto for all */}
                      <div className="p-1.5 border-b border-white/5">
                        <button
                          onClick={() => { setSelectedModel('smart'); setSelectedVideoModel('smart'); setSelectedImageModel('smart'); setShowModelPicker(false); }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                            selectedModel === 'smart' && selectedVideoModel === 'smart' && selectedImageModel === 'smart'
                              ? 'bg-cyan-500/15 text-cyan-400'
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}>
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          <div>
                            <span className="font-medium">Dynamic Intelligence</span>
                            <span className="ml-1.5 text-[9px] text-cyan-400/70">Auto</span>
                            <p className="text-[9px] text-gray-600 mt-0.5">AI picks the best model for text, images & video</p>
                          </div>
                          {selectedModel === 'smart' && selectedVideoModel === 'smart' && selectedImageModel === 'smart' && <Check className="w-3.5 h-3.5 text-cyan-400 ml-auto" />}
                        </button>
                      </div>

                      {/* Text Models */}
                      <div className="p-1.5">
                        <div className="px-3 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Text
                          {selectedModel === 'smart' && <span className="text-cyan-400/60 ml-1 normal-case font-normal">Auto</span>}
                        </div>
                        {MODELS.filter(m => !m.isSmartMode).map(m => (
                          <button 
                            key={m.value} 
                            onClick={() => { if (!m.comingSoon) setSelectedModel(m.value); }}
                            disabled={m.comingSoon}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-between ${
                              m.comingSoon ? 'text-gray-700 cursor-not-allowed' 
                                : selectedModel === m.value ? 'bg-orange-500/15 text-orange-400' 
                                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}>
                            <span>
                              {m.label}
                              {m.comingSoon && <span className="ml-1 text-[8px] text-orange-500/50">soon</span>}
                              {defaultModelSaved === m.value && <span className="ml-1.5 text-[8px] text-green-400/80">★ default</span>}
                            </span>
                            {selectedModel === m.value && !m.comingSoon && <Check className="w-3 h-3 text-orange-400" />}
                          </button>
                        ))}
                        {selectedModel !== 'smart' && selectedModel !== defaultModelSaved && (
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ default_model: selectedModel }) });
                            setDefaultModelSaved(selectedModel);
                            toast({ title: '✅ Text Default Saved', description: `${MODELS.find(m => m.value === selectedModel)?.label} is now your default text model.`, duration: 2500, className: 'bg-[#1a1f2e] border-green-500/30 text-white' });
                          }} className="w-full text-center mt-0.5 px-3 py-1 text-[9px] text-gray-600 hover:text-green-400 transition-colors">
                            Set as text default
                          </button>
                        )}
                      </div>

                      {/* Image Models */}
                      <div className="p-1.5 border-t border-white/5">
                        <div className="px-3 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                          <ImagePlus className="w-3 h-3" /> Image
                          {selectedImageModel === 'smart' && <span className="text-cyan-400/60 ml-1 normal-case font-normal">Auto</span>}
                        </div>
                        {IMAGE_MODELS.filter(m => !m.isSmartMode).map(m => (
                          <button 
                            key={m.value}
                            onClick={() => setSelectedImageModel(m.value)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-between ${
                              selectedImageModel === m.value
                                ? 'bg-pink-500/15 text-pink-400'
                                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}>
                            <div>
                              <span>{m.label}</span>
                              <span className="ml-1.5 text-[8px] text-gray-700">{m.description}</span>
                              {defaultImageModelSaved === m.value && <span className="ml-1.5 text-[8px] text-green-400/80">★ default</span>}
                            </div>
                            {selectedImageModel === m.value && <Check className="w-3 h-3 text-pink-400" />}
                          </button>
                        ))}
                        {selectedImageModel !== 'smart' && selectedImageModel !== defaultImageModelSaved && (
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ default_image_model: selectedImageModel }) });
                            setDefaultImageModelSaved(selectedImageModel);
                            toast({ title: '✅ Image Default Saved', description: `${IMAGE_MODELS.find(m => m.value === selectedImageModel)?.label} is now your default image model.`, duration: 2500, className: 'bg-[#1a1f2e] border-green-500/30 text-white' });
                          }} className="w-full text-center mt-0.5 px-3 py-1 text-[9px] text-gray-600 hover:text-pink-400 transition-colors">
                            Set as image default
                          </button>
                        )}
                      </div>

                      {/* Video Models */}
                      <div className="p-1.5 border-t border-white/5">
                        <div className="px-3 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                          <Film className="w-3 h-3" /> Video
                          {selectedVideoModel === 'smart' && <span className="text-cyan-400/60 ml-1 normal-case font-normal">Auto</span>}
                        </div>
                        {VIDEO_MODELS.filter(m => !m.isSmartMode).map(m => (
                          <button 
                            key={m.value}
                            onClick={() => setSelectedVideoModel(m.value)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-between ${
                              selectedVideoModel === m.value
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}>
                            <div>
                              <span>{m.label}</span>
                              <span className="ml-1.5 text-[8px] text-gray-700">{m.description}</span>
                              {defaultVideoModelSaved === m.value && <span className="ml-1.5 text-[8px] text-green-400/80">★ default</span>}
                            </div>
                            {selectedVideoModel === m.value && <Check className="w-3 h-3 text-blue-400" />}
                          </button>
                        ))}
                        {selectedVideoModel !== 'smart' && selectedVideoModel !== defaultVideoModelSaved && (
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ default_video_model: selectedVideoModel }) });
                            setDefaultVideoModelSaved(selectedVideoModel);
                            toast({ title: '✅ Video Default Saved', description: `${VIDEO_MODELS.find(m => m.value === selectedVideoModel)?.label} is now your default video model.`, duration: 2500, className: 'bg-[#1a1f2e] border-green-500/30 text-white' });
                          }} className="w-full text-center mt-0.5 px-3 py-1 text-[9px] text-gray-600 hover:text-blue-400 transition-colors">
                            Set as video default
                          </button>
                        )}
                      </div>

                      {/* Save all defaults button */}
                      <div className="p-1.5 border-t border-white/10">
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/profile', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  default_model: selectedModel,
                                  default_video_model: selectedVideoModel,
                                  default_image_model: selectedImageModel,
                                }),
                              });
                              setDefaultModelSaved(selectedModel);
                              setDefaultVideoModelSaved(selectedVideoModel);
                              setDefaultImageModelSaved(selectedImageModel);
                              toast({
                                title: '✅ All Defaults Saved',
                                description: 'Text, Image, and Video model defaults updated.',
                                duration: 3000,
                                className: 'bg-[#1a1f2e] border-green-500/30 text-white',
                              });
                              setShowModelPicker(false);
                            } catch (e) {
                              console.error('Failed to save defaults:', e);
                            }
                          }}
                          className="w-full text-center px-3 py-2 rounded-lg text-[10px] font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          💾 Save All as Defaults
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Compare Mode Model Picker */}
              {compareMode && (
                <CompareModePicker 
                  selectedModels={compareModels} 
                  setSelectedModels={setCompareModels} 
                  maxModels={3} 
                />
              )}
            </div>

            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="mb-3 px-1 animate-in slide-in-from-bottom-2 duration-200">
                <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <span className="text-orange-400 text-xs font-medium">
                      {attachments.length} file{attachments.length > 1 ? 's' : ''} attached — ready to send
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {attachments.map((att, i) => (
                      <AttachmentPill 
                        key={i} 
                        att={att} 
                        onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        onGenerateJson={att.type === 'image' ? generateImageJson : null}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {fileError && <p className="text-red-400 text-xs mb-1 px-1">{fileError}</p>}

            {/* Media generation handled dynamically through chat - no manual controls needed */}

            {/* Input bar */}
            <div className={`flex items-center gap-1.5 sm:gap-2 bg-[#141a21] border rounded-2xl px-2 sm:px-3 py-2 transition-colors ${speech.isListening ? 'border-orange-500/60 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'border-white/10 focus-within:border-orange-500/30'}`}>
              {/* File attach button */}
              <button onClick={() => fileInputRef.current?.click()}
                className="text-gray-600 hover:text-orange-400 transition-colors flex-shrink-0" title="Attach file or image">
                <CloudUploadIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={handleFileSelect} />

              {/* Location button - hide on very small screens */}
              <button
                onClick={() => {
                  if (userLocation) {
                    // If location already set, show modal to update
                    setShowLocationModal(true);
                  } else {
                    requestLocation();
                  }
                }}
                disabled={locationLoading}
                title={userLocation ? `📍 ${userLocation.address} (click to update)` : 'Share your location for "near me" searches'}
                className={`flex-shrink-0 transition-colors hidden xs:block ${userLocation ? 'text-green-500 hover:text-green-400' : locationError ? 'text-red-400 hover:text-red-300' : 'text-gray-600 hover:text-orange-400'} ${locationLoading ? 'animate-pulse' : ''}`}
              >
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Mic button */}
              <button
                onClick={speech.toggle}
                title={speech.error || (speech.isListening ? 'Stop recording' : 'Start voice input')}
                className={`flex-shrink-0 transition-all relative ${speech.isListening ? 'text-orange-500' : speech.error ? 'text-red-400' : 'text-gray-600 hover:text-orange-400'}`}
              >
                <MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                {speech.isListening && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                )}
              </button>

              {/* Voice Conversation button - Real-time voice chat */}
              {voiceChatEnabled && (
                <button
                  onClick={() => setShowVoiceChat(true)}
                  title="Voice conversation"
                  className="flex-shrink-0 text-gray-600 hover:text-green-400 transition-all p-1 -m-1"
                >
                  <AudioWaveform className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {/* Image/Video generation removed - handled dynamically through chat */}

              {/* Edit Image button - shows when there's an image attachment or editable image */}
              {(attachments.some(a => a.type === 'image') || editableImage) && (
                <button
                  onClick={() => {
                    // If there's an attached image, use that; otherwise use the editable image from conversation
                    const imageAtt = attachments.find(a => a.type === 'image');
                    if (imageAtt) {
                      setEditableImage({ base64: imageAtt.base64, mimeType: imageAtt.mimeType, source: 'upload' });
                    }
                    setShowImageEditor(true);
                  }}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all flex-shrink-0"
                  title="Edit image with AI"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              {/* Mockup button - shows when there's an image attachment */}
              {attachments.some(a => a.type === 'image') && (
                <button
                  onClick={() => {
                    const imageAtt = attachments.find(a => a.type === 'image');
                    if (imageAtt) {
                      setMockupDesign({ base64: imageAtt.base64, mimeType: imageAtt.mimeType });
                      setShowMockupGenerator(true);
                    }
                  }}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-orange-400 hover:from-orange-500/30 hover:to-pink-500/30 transition-all flex-shrink-0"
                  title="Create product mockup"
                >
                  <span className="text-sm">🎨</span>
                </button>
              )}

              <div className="flex-1 relative min-w-0">
                <textarea
                  ref={inputRef}
                  value={speech.isListening && interimText ? input + (input ? ' ' : '') + interimText : input}
                  onChange={e => { 
                    if (!speech.isListening) {
                      setInput(e.target.value);
                      // Auto-resize
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                    }
                  }}
                  onPaste={handlePaste}
                  onKeyDown={e => { 
                    if (e.key === 'Enter' && !e.shiftKey) { 
                      e.preventDefault(); 
                      sendMessage();
                      // Reset height after sending
                      e.target.style.height = 'auto';
                      // Ensure focus stays on input
                      setTimeout(() => e.target.focus(), 50);
                    }
                    // Shift+Enter creates new line (default textarea behavior)
                  }}
                  placeholder={speech.isListening ? (speech.mode === 'whisper' ? 'Recording…' : 'Listening…') : attachments.length > 0 ? 'Add message…' : 'Message…'}
                  className={`w-full bg-transparent text-[13px] sm:text-sm placeholder-gray-600 focus:outline-none py-1 sm:py-1.5 resize-none overflow-hidden ${speech.isListening ? 'text-orange-300' : isDark ? 'text-white' : 'text-black'}`}
                  disabled={loading}
                  readOnly={speech.isListening}
                  rows={1}
                  style={{ 
                    minHeight: '24px', 
                    maxHeight: '150px',
                    color: speech.isListening ? '#fdba74' : isDark ? '#ffffff' : '#000000'
                  }}
                />
              </div>

              {/* Show Stop button when loading (not in compare mode), otherwise show Send button */}
              {loading && !compareLoading ? (
                <button 
                  onClick={stopRequest}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors flex-shrink-0 animate-pulse"
                  title="Stop generating"
                >
                  <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </button>
              ) : (
                <button onClick={() => {
                  sendMessage();
                  // Reset textarea height and refocus after sending
                  if (inputRef.current) {
                    inputRef.current.style.height = 'auto';
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }
                }}
                  disabled={(!input.trim() && attachments.length === 0 && !speech.isListening) || loading || compareLoading || (compareMode && compareModels.length === 0)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                    compareMode ? 'bg-gradient-to-r from-orange-500 to-blue-500 hover:from-orange-600 hover:to-purple-600' : 'bg-orange-500 hover:bg-orange-600'
                  }`}>
                  {compareLoading ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-spin" /> : compareMode ? <GitCompare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" /> : <SendIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />}
                </button>
              )}
            </div>
            <p className="text-center text-[9px] sm:text-[10px] text-gray-700 mt-1.5 sm:mt-2 px-2">
              {speech.isListening
                ? <span className="text-orange-500/70 animate-pulse">🎙 {speech.mode === 'live' ? 'Listening — tap mic to stop' : 'Recording — tap to stop'}</span>
                : compareMode
                  ? <span className="text-blue-400/70">Compare: {compareModels.length} model{compareModels.length !== 1 ? 's' : ''}</span>
                  : <span className="hidden sm:inline">Supports JPG, PNG, PDF, TXT, CSV · Paste images with Ctrl+V · Max 10MB</span>}
              {!speech.isListening && !compareMode && <span className="sm:hidden">Tap 🎙 for voice · Paste or attach files</span>}
            </p>
          </div>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} token={token} />}
      
      {/* Feedback Modal */}
      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} token={token} />}
      
      {/* What's New Modal */}
      {showWhatsNew && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWhatsNew(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">What's New</h3>
                    <p className="text-xs text-gray-500">Latest updates and features</p>
                  </div>
                </div>
                <button onClick={() => setShowWhatsNew(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {appUpdates.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No updates yet</p>
                  <p className="text-gray-600 text-xs mt-1">Check back soon for new features!</p>
                </div>
              ) : (
                appUpdates.map(upd => (
                  <div key={upd.id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        upd.type === 'feature' ? 'bg-green-500/20' :
                        upd.type === 'improvement' ? 'bg-blue-500/20' :
                        upd.type === 'fix' ? 'bg-orange-500/20' :
                        'bg-purple-500/20'
                      }`}>
                        <span className="text-sm">
                          {upd.type === 'feature' ? '✨' :
                           upd.type === 'improvement' ? '🔧' :
                           upd.type === 'fix' ? '🐛' : '📢'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-white font-medium text-sm">{upd.title}</h4>
                          {upd.version && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-gray-400 rounded">
                              {upd.version}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs leading-relaxed">{upd.description}</p>
                        <p className="text-gray-600 text-[10px] mt-2">
                          {upd.release_date ? new Date(upd.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {appUpdates.length > 0 && (
              <div className="p-4 border-t border-white/10">
                <button 
                  onClick={async () => {
                    await fetch('/api/app-updates/mark-viewed', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    setAppUpdatesUnread(0);
                    setShowWhatsNew(false);
                  }}
                  className="w-full py-2.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-xl text-sm font-medium transition-colors"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Image JSON Generation Modal */}
      {showImageJsonModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowImageJsonModal(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Code className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Image Generation Config</h3>
                    <p className="text-xs text-gray-500">AI-generated parameters to recreate this image</p>
                  </div>
                </div>
                <button onClick={() => setShowImageJsonModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {generatingImageJson ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Analyzing image...</p>
                  <p className="text-gray-600 text-sm mt-1">Detecting style, composition, colors, and subjects</p>
                </div>
              ) : imageJsonResult?.error ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <X className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-red-400">{imageJsonResult.error}</p>
                </div>
              ) : imageJsonResult ? (
                <div className="space-y-4">
                  {/* Suggested Prompt */}
                  <div>
                    <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Suggested Prompt</label>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="text-white text-sm leading-relaxed">{imageJsonResult.prompt}</p>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(imageJsonResult.prompt);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10 transition-colors text-sm"
                    >
                      <Copy className="w-4 h-4" /> Copy Prompt
                    </button>
                    <button
                      onClick={() => {
                        setInput(imageJsonResult.prompt);
                        setShowImageJsonModal(false);
                        setDetectedMediaIntent('image');
                        setShowMediaOptions(true);
                        setTimeout(() => inputRef.current?.focus(), 100);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors text-sm"
                    >
                      <Sparkles className="w-4 h-4" /> Generate Similar
                    </button>
                  </div>
                  
                  {/* Full JSON */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Full JSON Config</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(JSON.stringify(imageJsonResult, null, 2))}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-white/5 text-gray-400 hover:bg-white/10 rounded transition-colors"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(imageJsonResult, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `image-config-${Date.now()}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-white/5 text-gray-400 hover:bg-white/10 rounded transition-colors"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                      </div>
                    </div>
                    <pre className="bg-[#0d1117] border border-white/10 rounded-xl p-4 text-[11px] text-gray-400 font-mono overflow-x-auto">
                      {JSON.stringify(imageJsonResult, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      
      {/* Image Editor Modal */}
      {showImageEditor && editableImage && (
        <ImageEditor
          image={editableImage}
          onClose={() => {
            setShowImageEditor(false);
          }}
          onEdit={handleImageEdit}
          isEditing={isEditingImage}
        />
      )}
      
      {/* Mockup Generator Modal */}
      {showMockupGenerator && mockupDesign && (
        <MockupGenerator
          design={mockupDesign}
          onClose={() => setShowMockupGenerator(false)}
          onGenerate={handleGenerateMockup}
          isGenerating={isGeneratingMockup}
          token={token}
        />
      )}
      
      {/* Location Modal - Manual Input Fallback */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLocationModal(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Set Your Location</h3>
                  <p className="text-xs text-gray-500">For "near me" searches</p>
                </div>
              </div>
              
              {/* Error Message */}
              {locationError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm whitespace-pre-line">{locationError}</p>
                </div>
              )}
              
              {/* Manual Input */}
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-2">Enter your location</label>
                  <input
                    type="text"
                    value={manualLocationInput}
                    onChange={(e) => setManualLocationInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveManualLocation()}
                    placeholder="City, address, or zip code..."
                    className="w-full bg-sp-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40"
                    autoFocus
                  />
                  <p className="text-gray-500 text-xs mt-1.5">Example: "San Francisco, CA" or "90210"</p>
                </div>
                
                {/* Try Again Button (for permission retry) */}
                <button
                  onClick={() => {
                    setShowLocationModal(false);
                    setLocationError(null);
                    requestLocation();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm">Try automatic location again</span>
                </button>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowLocationModal(false);
                    setManualLocationInput('');
                    setLocationError(null);
                  }}
                  className="flex-1 py-2.5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveManualLocation}
                  disabled={locationLoading || !manualLocationInput.trim()}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {locationLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Location</span>
                  )}
                </button>
              </div>
              
              {/* Current Location Display */}
              {userLocation && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-gray-500 text-xs mb-1">Current saved location:</p>
                  <p className="text-green-400 text-sm">{userLocation.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Project Modal (Create/Edit/Share) */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowProjectModal(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              {projectModalMode === 'create' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <FolderPlus className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">New Project</h3>
                  </div>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none mb-3"
                    autoFocus
                  />
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none resize-none mb-3"
                  />
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      Custom AI Instructions (optional)
                    </label>
                    <textarea
                      value={newProjectInstructions}
                      onChange={(e) => setNewProjectInstructions(e.target.value)}
                      placeholder="Enter custom instructions for AI in this project... (e.g., persona, tone, specific knowledge, rules)"
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none resize-none text-sm"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">These instructions will be applied to all chats in this project.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowProjectModal(false)}
                      className="flex-1 py-2.5 px-4 border border-white/10 rounded-xl text-gray-400 hover:bg-white/5 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createProject}
                      disabled={!newProjectName.trim()}
                      className="flex-1 py-2.5 px-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:opacity-50 rounded-xl text-white transition-colors text-sm font-medium"
                    >
                      Create Project
                    </button>
                  </div>
                </>
              )}
              
              {projectModalMode === 'edit' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                      <Pencil className="w-5 h-5 text-orange-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Edit Project</h3>
                  </div>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500/40 outline-none mb-3"
                    autoFocus
                  />
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500/40 outline-none resize-none mb-3"
                  />
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      Custom AI Instructions
                    </label>
                    <textarea
                      value={newProjectInstructions}
                      onChange={(e) => setNewProjectInstructions(e.target.value)}
                      placeholder="Enter custom instructions for AI in this project... (e.g., persona, tone, specific knowledge, rules)"
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500/40 outline-none resize-none text-sm"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">These instructions will be applied to all chats in this project.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => deleteProject(editingProject?.id)}
                      className="py-2.5 px-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowProjectModal(false)}
                      className="flex-1 py-2.5 px-4 border border-white/10 rounded-xl text-gray-400 hover:bg-white/5 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updateProject}
                      disabled={!newProjectName.trim()}
                      className="flex-1 py-2.5 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:opacity-50 rounded-xl text-white transition-colors text-sm font-medium"
                    >
                      Save
                    </button>
                  </div>
                </>
              )}
              
              {projectModalMode === 'share' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Share Project</h3>
                      <p className="text-gray-500 text-xs">{editingProject?.name}</p>
                    </div>
                  </div>
                  
                  {/* Share link */}
                  {projectShareLink?.code && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-4">
                      <div className="flex items-center gap-2 text-purple-400 text-xs mb-2">
                        <Link2 className="w-3.5 h-3.5" /> Share Link
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <code className="flex-1 text-[10px] text-gray-400 truncate bg-black/20 rounded px-2 py-1">
                          {window.location.origin}/{projectShareLink.public_view ? 'shared' : 'join'}/{projectShareLink.code}
                        </code>
                        <button
                          onClick={copyShareLink}
                          className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-400 text-xs"
                        >
                          Copy
                        </button>
                      </div>
                      
                      {/* Public access toggle */}
                      <div className="flex items-center justify-between bg-black/20 rounded-lg p-2.5">
                        <div>
                          <p className="text-white text-xs font-medium">Public access</p>
                          <p className="text-gray-500 text-[10px]">Anyone with the link can view (read-only)</p>
                        </div>
                        <button
                          onClick={async () => {
                            const newPublicView = !projectShareLink.public_view;
                            try {
                              const res = await fetch(`/api/projects/${editingProject.id}/share-link`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ enabled: true, public_view: newPublicView }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setProjectShareLink(data.share_link);
                              }
                            } catch (err) {
                              console.error('Error toggling public view:', err);
                            }
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            projectShareLink.public_view ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            projectShareLink.public_view ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Invite by email */}
                  <p className="text-gray-400 text-xs mb-2">Invite by email</p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="email"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="Enter email"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/40 outline-none"
                    />
                    <select
                      value={shareRole}
                      onChange={(e) => setShareRole(e.target.value)}
                      className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white cursor-pointer"
                    >
                      <option value="viewer" className="bg-[#1a1a1a] text-white">Viewer</option>
                      <option value="collaborator" className="bg-[#1a1a1a] text-white">Collaborator</option>
                    </select>
                  </div>
                  <button
                    onClick={shareProjectWithUser}
                    disabled={!shareEmail.trim()}
                    className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:opacity-50 rounded-xl text-white transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" /> Send Invite
                  </button>
                  
                  {/* Current members */}
                  {editingProject?.shared_with?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-gray-400 text-xs mb-2">Shared with</p>
                      {editingProject.shared_with.map((member, idx) => (
                        <div key={idx} className="flex items-center gap-3 py-2">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white text-sm">{member.email || member.user_id}</p>
                            <p className="text-gray-500 text-xs capitalize">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowProjectModal(false)}
                    className="w-full mt-4 py-2 text-gray-500 hover:text-white text-sm"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Move to Project Modal */}
      {showMoveToProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowMoveToProject(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Folder className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Move to Project</h3>
                  <p className="text-gray-500 text-xs truncate max-w-[200px]">{movingConversation?.title || 'Conversation'}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
              {/* Uncategorized option */}
              <button
                onClick={() => moveConversationToProject(movingConversation.id, null)}
                className={`w-full text-left p-3 rounded-xl transition-colors flex items-center gap-3 ${
                  !movingConversation?.project_id ? 'bg-gray-500/20 border border-gray-500/30' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <MessageSquare className="w-5 h-5 text-gray-400" />
                <span className="text-white text-sm">Uncategorized</span>
                {!movingConversation?.project_id && <Check className="w-4 h-4 text-gray-400 ml-auto" />}
              </button>
              
              {/* Projects */}
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={async () => {
                    console.log('Clicked project:', project.id, project.name);
                    await moveConversationToProject(movingConversation.id, project.id);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-colors flex items-center gap-3 ${
                    movingConversation?.project_id === project.id 
                      ? 'bg-purple-500/20 border border-purple-500/30' 
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <Folder className="w-5 h-5 text-purple-400" />
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm block truncate">{project.name}</span>
                    {project.description && (
                      <span className="text-gray-500 text-xs truncate block">{project.description}</span>
                    )}
                  </div>
                  {movingConversation?.project_id === project.id && (
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  )}
                </button>
              ))}
              
              {projects.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm mb-3">No projects yet</p>
                  <button
                    onClick={() => {
                      setShowMoveToProject(false);
                      setProjectModalMode('create');
                      setShowProjectModal(true);
                    }}
                    className="text-purple-400 text-sm font-medium hover:text-purple-300"
                  >
                    Create your first project →
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => setShowMoveToProject(false)}
                className="w-full py-2 text-gray-500 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Onboarding Modal - What is a SoulPrint? */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#111820] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-[#111820] border-b border-white/10 p-6 text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-4 border border-orange-500/30">
                <SoulPrintLogo size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to SoulPrint</h2>
              <p className="text-gray-500 text-sm">Your persistent AI identity layer</p>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-lg text-gray-300 leading-relaxed">
                  A SoulPrint is your <span className="text-orange-400 font-semibold">persistent AI identity layer</span>.
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                  <p className="text-gray-500 line-through text-xs">Not a chatbot</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                  <p className="text-gray-500 line-through text-xs">Not a prompt wrapper</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                  <p className="text-gray-500 line-through text-xs">Not a memory plugin</p>
                </div>
              </div>
              
              <p className="text-gray-400 text-sm leading-relaxed">
                It's a mapped, structured imprint of how you <span className="text-white">think</span>, <span className="text-white">decide</span>, <span className="text-white">react</span>, <span className="text-white">prioritize</span>, <span className="text-white">trust</span>, and <span className="text-white">communicate</span> — embedded into an AI system so the interaction reflects <em>you</em>, not generic model behavior.
              </p>
              
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                <p className="text-orange-300 font-medium mb-3 text-sm">Your SoulPrint captures:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {['Decision style', 'Conflict response', 'Boundary thresholds', 'Communication cadence', 'Emotional weighting', 'Pattern recognition'].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      <span className="text-gray-300 text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-sp-black rounded-xl">
                <div className="flex-1">
                  <p className="text-gray-500 text-xs mb-1">🔄 Most AI</p>
                  <p className="text-gray-400 text-sm">Resets every session</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-600" />
                <div className="flex-1">
                  <p className="text-orange-400 text-xs mb-1">✨ Your SoulPrint</p>
                  <p className="text-white text-sm">Builds continuity forever</p>
                </div>
              </div>
              
              <div className="text-center pt-4 border-t border-white/10">
                <p className="text-lg text-gray-300">
                  <span className="text-orange-400">In short:</span> A SoulPrint is the{' '}
                  <span className="text-white font-semibold">operating system of you</span> — running on AI.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-[#111820] border-t border-white/10 p-6">
              <button
                onClick={() => {
                  localStorage.setItem('sp_onboarding_seen', 'true');
                  setShowOnboarding(false);
                }}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all"
              >
                Get Started with My SoulPrint
              </button>
              <p className="text-center text-gray-600 text-xs mt-3">
                You can always revisit this in Settings → SoulPrint tab
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col" onClick={() => setShowGallery(false)}>
          <div className="flex-1 max-w-6xl w-full mx-auto p-6 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-blue-500 flex items-center justify-center">
                  <GalleryHorizontal className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Media Gallery</h2>
                  <p className="text-xs text-gray-500">{galleryItems.length} items generated</p>
                </div>
              </div>
              <button onClick={() => setShowGallery(false)} className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto">
              {galleryLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
                </div>
              ) : galleryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Sparkles className="w-12 h-12 text-gray-700 mb-4" />
                  <p className="text-gray-500 text-sm mb-2">No media generated yet</p>
                  <p className="text-gray-700 text-xs">Use the ✨ button in the chat to create images and videos</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {galleryItems.map(item => (
                    <GalleryItem key={item.id} item={item} onClick={setSelectedGalleryItem} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Gallery Item Detail Modal */}
      {selectedGalleryItem && (
        <GalleryModal 
          item={selectedGalleryItem} 
          onClose={() => setSelectedGalleryItem(null)} 
          token={token}
          onDelete={(deletedId) => {
            setGalleryItems(prev => prev.filter(item => item.id !== deletedId));
          }}
          onRegenerate={() => {
            // Refresh gallery after regeneration
            setTimeout(() => loadGallery(), 2000);
          }}
        />
      )}
      
      {/* Cloud Import Modal */}
      {showCloudImport && (
        <CloudImportModal 
          onClose={() => setShowCloudImport(false)} 
          token={token}
          onImportComplete={(data) => {
            // Don't close immediately - let the user see the success message
            // The modal will show "Successfully imported X messages" with a green checkmark
            // User can close it manually or it stays open showing the result
            console.log('Import completed:', data);
          }}
        />
      )}
      
      {/* Gradual Assessment Prompt */}
      {showGradualPrompt && gradualQuestion && (
        <div className="fixed bottom-24 right-4 z-40 max-w-sm w-full animate-in slide-in-from-right-5 duration-300">
          <div className="bg-[#141a21] border border-orange-500/30 rounded-2xl p-4 shadow-2xl shadow-orange-500/10">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-orange-400 text-xs font-medium uppercase tracking-wider">Quick Question</span>
                  <button onClick={skipGradualQuestion} className="text-gray-600 hover:text-gray-400 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-gray-500 text-[10px] mt-0.5">
                  Building your profile • {gradualProgress?.percentage || 0}% complete
                </p>
              </div>
            </div>
            
            {/* Question */}
            <p className="text-white text-sm mb-3 leading-relaxed">
              {gradualQuestion.question_text}
            </p>
            
            {/* Pillar badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full capitalize">
                {gradualQuestion.pillar?.replace('_', ' ')}
              </span>
            </div>
            
            {/* Answer input */}
            <textarea
              value={gradualAnswer}
              onChange={(e) => setGradualAnswer(e.target.value)}
              placeholder="Share your thoughts..."
              className="w-full bg-sp-black border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/50 resize-none"
              rows={3}
            />
            
            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={skipGradualQuestion}
                className="flex-1 py-2 text-gray-500 hover:text-white text-xs transition-colors"
              >
                Ask me later
              </button>
              <button
                onClick={submitGradualAnswer}
                disabled={!gradualAnswer.trim() || submittingGradual}
                className="flex-1 btn-orange py-2 rounded-lg text-xs disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {submittingGradual ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Voice Conversation Modal - Desktop */}
      {showVoiceChat && voiceChatEnabled && (
        <RealtimeVoiceChat 
          token={token} 
          onClose={() => setShowVoiceChat(false)}
          onSaveTranscript={saveVoiceTranscript}
          systemPrompt={`You are ${assistantName || 'a helpful AI assistant'} having a voice conversation with ${user?.displayName || user?.email || 'the user'}. Be conversational, natural, and concise. Respond as if you're having a real phone call - be warm and engaging.`}
          userName={user?.displayName || user?.email?.split('@')[0]}
        />
      )}
    </div>
  );
}
