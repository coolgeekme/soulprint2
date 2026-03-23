'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, User, ChevronDown, 
  Plus, Settings, X, Check, Loader2, Globe, Sparkles,
  Image as ImageIcon, MoreHorizontal, ArrowLeft,
  Copy, Edit3, ThumbsUp, ThumbsDown, Trash2, MoreVertical,
  Video, Search, ChevronRight, Square, Download, Home, ExternalLink, FileText, RefreshCw,
  Folder, FolderPlus, Share2, Users, Link2, UserPlus, Upload, Sun, Moon, MapPin, AudioWaveform, Pencil
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { MicrophoneIcon, SendIcon, SparklesIcon, AttachIcon, CloudUploadIcon } from '@/components/icons/SoulPrintIcons';
import { useTheme } from '@/lib/providers/ThemeProvider';
import MaskEditor from '@/app/chat/components/MaskEditor';

// Full MODELS list matching desktop
const MODELS = [
  // Dynamic Intelligence - AI auto-selects best model
  { value: 'smart', label: '🧠 Dynamic Intelligence', provider: 'auto', group: 'Smart', isSmartMode: true, description: 'AI picks the best model for your query' },
  // OpenAI
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai', group: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', group: 'OpenAI' },
  { value: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai', group: 'OpenAI' },
  { value: 'gpt-5.2', label: 'GPT-5.2 (Coming Soon)', provider: 'openai', group: 'OpenAI', comingSoon: true },
  { value: 'gpt-5', label: 'GPT-5 (Coming Soon)', provider: 'openai', group: 'OpenAI', comingSoon: true },
  { value: 'o3', label: 'o3 (Coming Soon)', provider: 'openai', group: 'OpenAI', comingSoon: true },
  { value: 'o3-mini', label: 'o3 Mini (Coming Soon)', provider: 'openai', group: 'OpenAI', comingSoon: true },
  // Anthropic
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5', provider: 'anthropic', group: 'Claude' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', provider: 'anthropic', group: 'Claude' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5', provider: 'anthropic', group: 'Claude' },
  // Google Gemini
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini', group: 'Gemini' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini', group: 'Gemini' },
  // Perplexity
  { value: 'sonar-pro', label: 'Sonar Pro (Online)', provider: 'perplexity', group: 'Perplexity' },
  { value: 'sonar', label: 'Sonar (Online)', provider: 'perplexity', group: 'Perplexity' },
  { value: 'sonar-reasoning', label: 'Sonar Reasoning', provider: 'perplexity', group: 'Perplexity' },
  // Kimi
  { value: 'kimi-k2-0711-preview', label: 'Kimi K2 (Flagship)', provider: 'kimi', group: 'Kimi' },
  { value: 'moonshot-v1-32k', label: 'Moonshot 32k', provider: 'kimi', group: 'Kimi' },
  { value: 'moonshot-v1-8k', label: 'Moonshot 8k (Fast)', provider: 'kimi', group: 'Kimi' },
];

const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.md,.csv,.json,.docx';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ── MobileVideoCard: handles video generation with polling ─────────────────
function MobileVideoCard({ taskId, prompt, token, initialStatus = 'generating' }) {
  const [status, setStatus] = useState(initialStatus);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (status === 'success' || status === 'failed') return;
    
    const poll = async () => {
      try {
        const res = await fetch(`/api/media/status/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (d.status === 'completed' && d.url) {
          setStatus('success');
          setVideoUrl(d.url);
          clearInterval(pollRef.current);
        } else if (d.status === 'failed') {
          setStatus('failed');
          setError(d.error || 'Generation failed');
          clearInterval(pollRef.current);
        }
      } catch (e) {}
    };
    poll();
    pollRef.current = setInterval(poll, 6000);
    return () => clearInterval(pollRef.current);
  }, [taskId, status, token]);

  if (status === 'success' && videoUrl) {
    return (
      <div className="mb-3 rounded-2xl overflow-hidden border border-white/10 bg-[#141a21]">
        <video
          src={videoUrl}
          controls
          playsInline
          className="w-full max-h-80 object-contain"
        >
          Your browser does not support the video tag.
        </video>
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-green-400 text-xs">
            <Video className="w-3.5 h-3.5" /> Video ready!
          </div>
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" download
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-xl">
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-3">
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> Video generation failed: {error}
        </p>
      </div>
    );
  }

  // Generating state
  return (
    <div className="mb-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-orange-500/15 flex items-center justify-center">
          <Video className="w-4 h-4 text-orange-400 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-orange-400 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating video...
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">This takes 1-3 minutes</p>
        </div>
      </div>
      <p className="text-[10px] text-gray-600 mt-2 truncate italic">"{prompt}"</p>
    </div>
  );
}

// Image Generation Models (matching desktop) - no pricing shown
const IMAGE_MODELS = [
  { value: 'smart', label: '🧠 Dynamic Intelligence', description: 'AI picks best model', isSmartMode: true },
  { value: 'seedream-5-lite', label: 'Seedream 5.0 Lite', description: 'Fast & affordable' },
  { value: 'nano-banana', label: 'Nano Banana', description: 'Gemini-powered' },
  { value: 'gpt4o-image', label: 'GPT-4o Image', description: 'High quality text' },
  { value: 'flux-pro', label: 'Flux Pro', description: 'Artistic styles' },
  { value: 'midjourney-v7', label: 'Midjourney V7', description: 'Premium quality' },
  { value: 'gpt-image-1-5', label: 'GPT Image 1.5', description: 'OpenAI flagship' },
];

// Video Generation Models (matching desktop) - no pricing shown
const VIDEO_MODELS = [
  { value: 'smart', label: '🧠 Dynamic Intelligence', description: 'AI picks best model', isSmartMode: true },
  { value: 'kling-3', label: 'Kling 3.0 (Std)', description: '5s std quality' },
  { value: 'kling-3-pro', label: 'Kling 3.0 (Pro)', description: '5s Pro quality' },
  { value: 'sora-2', label: 'Sora 2', description: 'OpenAI, 10s HD' },
  { value: 'seedance-1-5', label: 'Seedance 1.5', description: 'Cinematic, audio' },
  { value: 'kling-2-6', label: 'Kling 2.6', description: '5s, audio support' },
  { value: 'wan-2-6', label: 'Wan 2.6', description: '5s 720p, lip sync' },
  { value: 'sora-2-pro', label: 'Sora 2 Pro (HD)', description: 'OpenAI, 1080p HD' },
];

// Aspect ratios for image generation
const ASPECT_RATIOS = [
  { value: '1:1', label: 'Square (1:1)' },
  { value: '16:9', label: 'Landscape (16:9)' },
  { value: '9:16', label: 'Portrait (9:16)' },
  { value: '4:3', label: 'Standard (4:3)' },
];

// Speech recognition hook for mobile
function useSpeechRecognition({ onTranscript, onInterim, token }) {
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const [mode, setMode] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const hasNativeSpeech = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const hasMediaRecorder = typeof window !== 'undefined' && 
    typeof MediaRecorder !== 'undefined';

  // Detect browser for optimal audio format
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
      // Request microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = true;
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
        if (final) onTranscript(final);
        if (interim) onInterim(interim);
      };
      
      rec.onerror = (e) => {
        console.error('Speech error:', e.error);
        if (e.error === 'not-allowed') {
          setError('Microphone access denied');
        } else if (e.error === 'network') {
          // Network error - fall back to Whisper
          stop();
          startWhisper();
          return;
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
          setError(`Speech error: ${e.error}`);
        }
        if (e.error !== 'no-speech') {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };
      
      rec.onend = () => {
        if (isListeningRef.current && recognitionRef.current) {
          setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                setIsListening(false);
                isListeningRef.current = false;
              }
            }
          }, 100);
        }
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
      isListeningRef.current = true;
      setMode('live');
      setError(null);
    } catch (err) {
      console.error('Mic permission error:', err);
      setError('Microphone access denied');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }

  async function startWhisper() {
    if (!hasMediaRecorder) {
      setError('Voice recording not supported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const browser = getBrowserInfo();
      
      // Choose appropriate mime type based on browser support
      let mimeType = 'audio/webm';
      if (!browser.supportsWebm || !MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }
      
      const recorderOptions = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];
      
      mr.ondataavailable = (e) => { 
        if (e.data.size > 0) chunksRef.current.push(e.data); 
      };
      
      mr.onstop = async () => {
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
            setError('Transcription failed');
          }
        } catch (err) { 
          console.error('Whisper error', err);
          setError('Transcription failed');
        }
        setIsListening(false);
        isListeningRef.current = false;
      };
      
      mr.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setError('Recording failed');
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
      setError('Microphone access denied');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }

  function start() {
    setError(null);
    if (hasNativeSpeech) startLive();
    else if (hasMediaRecorder) startWhisper();
    else setError('Voice input not supported');
  }

  function stop() {
    if (mode === 'live' && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
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

  return { isListening, toggle, mode, error };
}

// Bottom Tab Bar
const TabBar = ({ activeTab, onTabChange, assistantName, unreadCount = 0 }) => {
  const tabs = [
    { id: 'chat', icon: null, useLogo: true, label: assistantName || 'Chat' },
    { id: 'history', icon: MessageSquare, label: 'History', badge: unreadCount },
    { id: 'home', icon: Home, label: 'Website', isExternal: true },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  const handleTabClick = (tab) => {
    if (tab.isExternal) {
      window.location.href = '/';
    } else {
      onTabChange(tab.id);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-sp-black/95 backdrop-blur-xl border-t border-white/10 safe-area-bottom z-50">
      <div className="flex items-center justify-around py-2 px-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={`flex flex-col items-center py-2 px-4 rounded-2xl transition-all duration-300 ${
                isActive ? 'bg-orange-500/15' : 'hover:bg-white/5'
              }`}
            >
              <div className="relative">
                {tab.useLogo ? (
                  <SoulPrintLogo size={24} className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-50'}`} />
                ) : (
                  <Icon className={`w-6 h-6 transition-colors ${isActive ? 'text-orange-400' : 'text-gray-500'}`} />
                )}
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
                {tab.isExternal && (
                  <ExternalLink className="absolute -top-1 -right-1 w-3 h-3 text-gray-500" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium transition-colors ${isActive ? 'text-orange-400' : 'text-gray-600'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Chat Header with web search toggle
const ChatHeader = ({ assistantName, model, onModelClick, isOnline, webSearchEnabled, onToggleWebSearch, onMoreClick, inviteData, onInviteClick }) => (
  <div className="fixed top-0 left-0 right-0 z-40 safe-area-top">
    <div className="bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/95 to-transparent pb-8 pt-2">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <SoulPrintLogo size={36} />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">{assistantName}</h1>
            <button 
              onClick={onModelClick}
              className="text-gray-500 text-xs flex items-center gap-1 hover:text-orange-400 transition-colors"
            >
              {model} <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Invite Button - Only shown if viral invites enabled */}
          {inviteData?.enabled && inviteData?.invites_remaining > 0 && (
            <button 
              onClick={onInviteClick}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
            >
              <span className="text-sm">🎟️</span>
              <span>{inviteData.invites_remaining}</span>
            </button>
          )}
          {/* Web Search Toggle */}
          <button 
            onClick={onToggleWebSearch}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
              webSearchEnabled 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'bg-white/5 text-gray-500 border border-white/10'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>Web</span>
          </button>
          <button onClick={onMoreClick} className="p-2 text-gray-500 hover:text-white transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Message Bubble with actions
const MessageBubble = ({ message, isUser, assistantName, onCopy, onEdit, onFeedback, token, onImageEdit, onMaskEdit }) => {
  const [showActions, setShowActions] = useState(false);
  const [feedback, setFeedback] = useState(message.feedback || null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setShowActions(false);
  };

  const handleFeedback = async (type) => {
    setFeedback(type);
    setShowActions(false);
    if (onFeedback) {
      onFeedback(message.id, type);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 px-4">
        <div 
          className="max-w-[85%] bg-orange-500/20 border border-orange-500/30 rounded-3xl rounded-br-lg px-4 py-3"
          onClick={() => setShowActions(!showActions)}
        >
          <p className="text-white text-[15px] leading-relaxed">{message.content}</p>
          {showActions && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-orange-500/20">
              <button onClick={handleCopy} className="text-orange-300 text-xs flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy
              </button>
              {onEdit && (
                <button onClick={() => { onEdit(message); setShowActions(false); }} className="text-orange-300 text-xs flex items-center gap-1">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4 px-4">
      <div className="max-w-[90%]">
        <div 
          className="bg-white/5 rounded-3xl rounded-bl-lg px-4 py-3"
          onClick={() => setShowActions(!showActions)}
        >
          {/* Show generated image */}
          {message.image_url && (
            <div className="mb-3 rounded-2xl overflow-hidden border border-white/10 bg-[#141a21]">
              <div className="relative group">
                <img 
                  src={message.image_url} 
                  alt="Generated" 
                  className="w-full h-auto max-h-80 object-contain bg-black/20"
                />
                {/* Mobile edit buttons - always visible on mobile */}
                <div className="absolute bottom-2 right-2 flex gap-2">
                  {onImageEdit && (
                    <button 
                      onClick={() => onImageEdit({ url: message.image_url, source: 'generated' })}
                      className="px-2.5 py-1.5 bg-purple-500/90 text-white text-xs rounded-lg flex items-center gap-1 shadow-lg"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                  {onMaskEdit && (
                    <button 
                      onClick={() => onMaskEdit(message.image_url)}
                      className="px-2.5 py-1.5 bg-red-500/90 text-white text-xs rounded-lg flex items-center gap-1 shadow-lg"
                    >
                      <Square className="w-3 h-3" /> Mask
                    </button>
                  )}
                </div>
              </div>
              {message.model_label && (
                <div className="px-3 py-2 text-xs text-orange-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> Generated with {message.model_label}
                </div>
              )}
            </div>
          )}
          
          {/* Show generated video */}
          {message.video_url && !message.video_task && (
            <div className="mb-3 rounded-2xl overflow-hidden border border-white/10 bg-[#141a21]">
              <video 
                src={message.video_url} 
                controls 
                playsInline
                className="w-full h-auto max-h-80 bg-black/20"
              />
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-green-400 text-xs">
                  <Video className="w-3.5 h-3.5" /> Video ready!
                </div>
                <a href={message.video_url} target="_blank" rel="noopener noreferrer" download
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-xl">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              </div>
            </div>
          )}
          
          {/* Show video task with polling */}
          {message.video_task && (
            <MobileVideoCard
              taskId={message.video_task.taskId}
              prompt={message.video_task.prompt || 'Video generation'}
              token={token}
              initialStatus={message.video_task.status}
            />
          )}
          
          {/* Show animated generating state for media/flyers/infographics */}
          {message.is_generating && (
            <div className="mb-4">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-white/10 p-4">
                {/* Animated background shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                
                {/* Content */}
                <div className="relative flex items-center gap-3">
                  {/* Animated icon */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                    </div>
                    {/* Spinning ring */}
                    <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
                  </div>
                  
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm mb-0.5">Creating your design...</p>
                    <p className="text-gray-400 text-xs">Crafting something beautiful!</p>
                  </div>
                </div>
                
                {/* Progress dots */}
                <div className="flex justify-center gap-1.5 mt-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div className="text-gray-200 text-[15px] leading-relaxed prose prose-invert prose-sm max-w-none">
            <ReactMarkdown 
              components={{
                p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                code: ({children}) => <code className="bg-black/30 px-1.5 py-0.5 rounded text-orange-300 text-sm">{children}</code>,
                a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">{children}</a>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            
            {/* Sources Section */}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Sources
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {message.sources.slice(0, 4).map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1"
                    >
                      <span className="w-4 h-4 rounded bg-orange-500/20 text-orange-400 text-[9px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-[10px] text-gray-400 truncate max-w-[100px]">
                        {source.title}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          {showActions && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/10">
              <button onClick={handleCopy} className="text-gray-400 text-xs flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button 
                onClick={() => handleFeedback('up')} 
                className={`text-xs flex items-center gap-1 ${feedback === 'up' ? 'text-green-400' : 'text-gray-400'}`}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button 
                onClick={() => handleFeedback('down')} 
                className={`text-xs flex items-center gap-1 ${feedback === 'down' ? 'text-red-400' : 'text-gray-400'}`}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {/* Model info - show Dynamic Intelligence badge if applicable */}
        {message.model_used && (
          <div className="ml-2 mt-1 flex items-center gap-2">
            {message.smart_mode && (
              <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">
                🧠 Smart
              </span>
            )}
            <span className="text-[10px] text-gray-600">{message.model_used}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Conversation List Item with actions
const ConversationItem = ({ conversation, isActive, onClick, onDelete, onRename, onMove }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`w-full text-left p-4 border-b border-white/5 transition-colors ${
          isActive ? 'bg-orange-500/10' : 'hover:bg-white/5 active:bg-white/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isActive ? 'bg-orange-500/20' : 'bg-white/5'
          }`}>
            <MessageSquare className={`w-5 h-5 ${isActive ? 'text-orange-400' : 'text-gray-500'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium text-sm truncate ${isActive ? 'text-orange-400' : 'text-white'}`}>
              {conversation.title || 'New Conversation'}
            </h3>
            <p className="text-gray-500 text-xs truncate mt-0.5">
              {conversation.preview || ''}
            </p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-2 text-gray-500"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </button>
      {showMenu && (
        <div className="absolute right-4 top-12 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden">
          <button 
            onClick={(e) => { e.stopPropagation(); onRename?.(conversation); setShowMenu(false); }}
            className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" /> Rename
          </button>
          {onMove && (
            <button 
              onClick={(e) => { e.stopPropagation(); onMove?.(conversation); setShowMenu(false); }}
              className="w-full px-4 py-3 text-left text-sm text-purple-400 hover:bg-purple-500/10 flex items-center gap-2"
            >
              <Folder className="w-4 h-4" /> Move to Project
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(conversation.id); setShowMenu(false); }}
            className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

// Theme Toggle Component for Profile
const ThemeToggle = () => {
  const { theme, toggleTheme, isDark } = useTheme();
  
  return (
    <button 
      onClick={toggleTheme}
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors mb-3"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-indigo-500/20' : 'bg-yellow-500/20'}`}>
          {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-yellow-500" />}
        </div>
        <div className="text-left">
          <span className="text-white text-sm block">Appearance</span>
          <span className="text-gray-500 text-xs">{isDark ? 'Dark mode' : 'Light mode'}</span>
        </div>
      </div>
      <div className={`w-12 h-6 rounded-full relative transition-colors ${isDark ? 'bg-indigo-500/30' : 'bg-yellow-500/30'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
          isDark 
            ? 'left-0.5 bg-indigo-500' 
            : 'right-0.5 bg-yellow-500'
        }`} />
      </div>
    </button>
  );
};

// Profile View
const ProfileView = ({ profile, soulPrint, onSettingsClick, isAdmin, onAdminClick, announcements, onAnnouncementsClick, onEditName, inviteData, onInviteClick, onImportClick }) => (
  <div className="min-h-screen bg-sp-black pt-16 pb-24 px-4">
    <div className="text-center mb-8">
      <div className="w-24 h-24 mx-auto bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-full flex items-center justify-center mb-4">
        <SoulPrintLogo size={48} />
      </div>
      <h1 className="text-white text-xl font-semibold">{profile?.display_name || 'Your Profile'}</h1>
      <button 
        onClick={onEditName}
        className="text-orange-400 text-xs mt-1 hover:underline"
      >
        ✏️ Edit name
      </button>
      <p className="text-gray-500 text-sm mt-1">{profile?.email}</p>
      {isAdmin && (
        <span className="inline-block mt-2 px-3 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
          Admin
        </span>
      )}
    </div>

    {/* Import Chat History - Prominent placement */}
    <button 
      onClick={onImportClick}
      className="w-full bg-gradient-to-r from-emerald-500/10 to-green-500/10 hover:from-emerald-500/20 hover:to-green-500/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between transition-colors mb-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Upload className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="text-left">
          <span className="text-white text-sm font-medium block">Import Chat History</span>
          <span className="text-emerald-400/70 text-xs">ChatGPT, WhatsApp, iMessage & more</span>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-emerald-400" />
    </button>

    {/* Viral Invite Section - Only shown if enabled */}
    {inviteData?.enabled && (
      <button 
        onClick={onInviteClick}
        className="w-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between transition-colors mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
            <span className="text-lg">🎟️</span>
          </div>
          <div className="text-left">
            <span className="text-white text-sm font-medium block">Invite Friends</span>
            <span className="text-purple-400 text-xs">{inviteData.invites_remaining} invites remaining</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inviteData.badges?.length > 0 && (
            <div className="flex -space-x-1">
              {inviteData.badges.slice(0, 3).map((badge, i) => (
                <span key={i} className="text-sm" title={badge.name}>{badge.icon || '🏆'}</span>
              ))}
            </div>
          )}
          <ChevronRight className="w-5 h-5 text-purple-400" />
        </div>
      </button>
    )}

    {/* Quick Stats */}
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-white/5 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-orange-400">{soulPrint?.messageCount || 0}</p>
        <p className="text-gray-500 text-xs mt-1">Messages</p>
      </div>
      <div className="bg-white/5 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-orange-400">{soulPrint?.conversationCount || 0}</p>
        <p className="text-gray-500 text-xs mt-1">Conversations</p>
      </div>
      <div className="bg-white/5 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-orange-400">{soulPrint?.daysActive || 0}</p>
        <p className="text-gray-500 text-xs mt-1">Days Active</p>
      </div>
    </div>

    {/* Communication Style */}
    {soulPrint?.communicationStyle && (
      <div className="bg-white/5 rounded-2xl p-5 mb-4">
        <h3 className="text-orange-400 text-sm font-semibold mb-3 flex items-center gap-2">
          <SparklesIcon className="w-4 h-4" /> Your Communication Style
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">{soulPrint.communicationStyle}</p>
      </div>
    )}

    {/* Visit Website Button */}
    <button 
      onClick={() => window.location.href = '/'}
      className="w-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/20 hover:to-amber-500/20 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between transition-colors mb-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
          <Home className="w-4 h-4 text-orange-400" />
        </div>
        <div className="text-left">
          <span className="text-white text-sm block">Visit Website</span>
          <span className="text-gray-500 text-xs">Updates, features & more</span>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-orange-400" />
    </button>

    {/* Announcements Section */}
    <button 
      onClick={onAnnouncementsClick}
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors mb-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-left">
          <span className="text-white text-sm block">Announcements</span>
          {announcements?.length > 0 && (
            <span className="text-gray-500 text-xs">{announcements.length} announcement{announcements.length > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-500" />
    </button>

    {/* Theme Toggle */}
    <ThemeToggle />

    {/* Settings Button */}
    <button 
      onClick={onSettingsClick}
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors mb-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
          <Settings className="w-4 h-4 text-gray-400" />
        </div>
        <span className="text-white text-sm">Settings & Privacy</span>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-500" />
    </button>

    {/* Admin Dashboard Button - only shown to admins */}
    {isAdmin && (
      <button 
        onClick={onAdminClick}
        className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Settings className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-orange-400 text-sm font-medium">Admin Dashboard</span>
        </div>
        <ChevronRight className="w-5 h-5 text-orange-400" />
      </button>
    )}
  </div>
);

// Announcements View
const AnnouncementsView = ({ isOpen, onClose, announcements }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-sp-black z-[60]">
      <div className="safe-area-top bg-sp-black p-4 flex items-center gap-3 border-b border-white/10">
        <button onClick={onClose} className="p-2 text-gray-400">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-white font-semibold text-lg">Announcements</h3>
      </div>
      
      <div className="p-4 overflow-y-auto pb-20" style={{ height: 'calc(100vh - 60px)' }}>
        {announcements?.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements?.map((announcement, idx) => (
              <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-white font-medium text-sm">{announcement.title}</h4>
                  {announcement.type && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      announcement.type === 'update' ? 'bg-blue-500/20 text-blue-400' :
                      announcement.type === 'feature' ? 'bg-green-500/20 text-green-400' :
                      announcement.type === 'alert' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {announcement.type}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{announcement.content}</p>
                {announcement.created_at && (
                  <p className="text-gray-600 text-xs mt-3">
                    {new Date(announcement.created_at).toLocaleDateString('en-US', { 
                      month: 'short', day: 'numeric', year: 'numeric' 
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Attachment Preview
const AttachmentPreview = ({ attachments, onRemove }) => {
  if (!attachments.length) return null;
  
  return (
    <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
      {attachments.map((att, idx) => (
        <div key={idx} className="relative flex-shrink-0">
          {att.type === 'image' ? (
            <img src={`data:${att.mimeType};base64,${att.base64}`} alt={att.name} className="w-16 h-16 object-cover rounded-xl" />
          ) : (
            <div className="w-16 h-16 bg-white/5 rounded-xl flex flex-col items-center justify-center p-1">
              <AttachIcon className="w-4 h-4 text-gray-400" />
              <span className="text-[8px] text-gray-500 truncate w-full text-center mt-1">{att.name}</span>
            </div>
          )}
          <button 
            onClick={() => onRemove(idx)}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ))}
    </div>
  );
};

// More Options Menu (bottom sheet) - Website and Settings
const MoreOptionsSheet = ({ isOpen, onClose, onSettings }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">Options</h3>
        <div className="space-y-2">
          <button 
            onClick={() => { window.location.href = '/'; onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Home className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <span className="text-white font-medium">Visit Website</span>
              <p className="text-gray-500 text-xs">Check out new features and updates</p>
            </div>
          </button>
          <button 
            onClick={() => { onSettings?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <span className="text-white font-medium">Settings</span>
              <p className="text-gray-500 text-xs">Customize your experience</p>
            </div>
          </button>
        </div>
        <button onClick={onClose} className="w-full mt-4 p-4 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Attachment/Create Options Sheet (+ button menu)
const CreateOptionsSheet = ({ isOpen, onClose, onFileSelect, onCameraSelect, onImageGen, onVideoGen, onCompare, onGallery, onNewConversation }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">Create</h3>
        <div className="space-y-2">
          {/* New Conversation - First Option */}
          <button 
            onClick={() => { onNewConversation?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-orange-500/30 flex items-center justify-center">
              <Plus className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <span className="text-white font-medium">New Conversation</span>
              <p className="text-gray-500 text-xs">Start a fresh chat</p>
            </div>
          </button>

          {/* Generate Image */}
          <button 
            onClick={() => { onImageGen?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <span className="text-white font-medium">Generate Image</span>
              <p className="text-gray-500 text-xs">Create AI-generated images</p>
            </div>
          </button>
          
          {/* Generate Video */}
          <button 
            onClick={() => { onVideoGen?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
              <Video className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <span className="text-white font-medium">Generate Video</span>
              <p className="text-gray-500 text-xs">Create AI-generated videos</p>
            </div>
          </button>
          
          {/* Compare Models */}
          <button 
            onClick={() => { onCompare?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-white font-medium">Compare Models</span>
              <p className="text-gray-500 text-xs">Compare responses from multiple AI models</p>
            </div>
          </button>
          
          {/* Media Gallery */}
          <button 
            onClick={() => { onGallery?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-white font-medium">Media Gallery</span>
              <p className="text-gray-500 text-xs">View your generated images and videos</p>
            </div>
          </button>
          
          {/* Divider */}
          <div className="border-t border-white/10 my-3"></div>
          
          {/* Attach File */}
          <button 
            onClick={() => { onFileSelect?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <AttachIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-white font-medium">Attach File</span>
              <p className="text-gray-500 text-xs">Upload documents and files</p>
            </div>
          </button>
          
          {/* Take Photo */}
          <button 
            onClick={() => { onCameraSelect?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <span className="text-white font-medium">Take Photo</span>
              <p className="text-gray-500 text-xs">Capture with camera</p>
            </div>
          </button>
        </div>
        <button onClick={onClose} className="w-full mt-4 p-4 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Image Generation Sheet
const ImageGenSheet = ({ 
  isOpen, onClose, models, selectedModel, onModelChange, 
  aspectRatios, selectedAspect, onAspectChange,
  prompt, onPromptChange, onGenerate, isGenerating 
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">🎨 Generate Image</h3>
        
        {/* Prompt */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Describe your image</label>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="A serene mountain landscape at sunset..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 resize-none h-24 focus:outline-none focus:border-orange-500/50"
          />
        </div>

        {/* Model Selection */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Model</label>
          <div className="grid grid-cols-2 gap-2">
            {models.map(model => (
              <button
                key={model.value}
                onClick={() => onModelChange(model.value)}
                className={`p-3 rounded-xl text-left transition-colors ${
                  selectedModel === model.value
                    ? 'bg-purple-500/20 border border-purple-500/50'
                    : 'bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-white text-sm font-medium block">{model.label}</span>
                <span className="text-gray-500 text-xs">{model.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className="mb-6">
          <label className="text-gray-400 text-xs mb-2 block">Aspect Ratio</label>
          <div className="flex gap-2">
            {aspectRatios.map(ar => (
              <button
                key={ar.value}
                onClick={() => onAspectChange(ar.value)}
                className={`flex-1 p-2 rounded-xl text-center text-sm transition-colors ${
                  selectedAspect === ar.value
                    ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400'
                    : 'bg-white/5 border border-transparent text-gray-400'
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={() => onGenerate('image')}
          disabled={!prompt.trim() || isGenerating}
          className={`w-full p-4 rounded-xl font-medium transition-all ${
            prompt.trim() && !isGenerating
              ? 'bg-purple-500 text-white'
              : 'bg-white/10 text-gray-500'
          }`}
        >
          {isGenerating ? 'Generating...' : '✨ Generate Image'}
        </button>
        
        <button onClick={onClose} className="w-full mt-3 p-3 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Video Generation Sheet
const VideoGenSheet = ({ 
  isOpen, onClose, models, selectedModel, onModelChange, 
  prompt, onPromptChange, onGenerate, isGenerating 
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">🎬 Generate Video</h3>
        
        {/* Prompt */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Describe your video</label>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="A butterfly landing on a flower in slow motion..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 resize-none h-24 focus:outline-none focus:border-pink-500/50"
          />
        </div>

        {/* Model Selection */}
        <div className="mb-6">
          <label className="text-gray-400 text-xs mb-2 block">Model</label>
          <div className="space-y-2">
            {models.map(model => (
              <button
                key={model.value}
                onClick={() => onModelChange(model.value)}
                className={`w-full p-3 rounded-xl text-left transition-colors ${
                  selectedModel === model.value
                    ? 'bg-pink-500/20 border border-pink-500/50'
                    : 'bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-white text-sm font-medium">{model.label}</span>
                <span className="text-gray-500 text-xs ml-2">{model.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={() => onGenerate('video')}
          disabled={!prompt.trim() || isGenerating}
          className={`w-full p-4 rounded-xl font-medium transition-all ${
            prompt.trim() && !isGenerating
              ? 'bg-pink-500 text-white'
              : 'bg-white/10 text-gray-500'
          }`}
        >
          {isGenerating ? 'Generating...' : '🎬 Generate Video'}
        </button>
        
        <button onClick={onClose} className="w-full mt-3 p-3 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Flyer Generation Sheet
const FlyerGenSheet = ({ 
  isOpen, onClose, onGenerate, isGenerating 
}) => {
  const [flyerPrompt, setFlyerPrompt] = useState('');
  const [flyerType, setFlyerType] = useState('promotional');
  const [flyerSize, setFlyerSize] = useState('8.5x11');
  const [outputFormat, setOutputFormat] = useState('png');
  
  const flyerTypes = [
    { value: 'promotional', label: '🎉 Promotional', desc: 'Events, sales, announcements' },
    { value: 'informational', label: '📋 Informational', desc: 'Classes, services, programs' },
    { value: 'social', label: '📱 Social Media', desc: 'Instagram, Facebook posts' },
    { value: 'poster', label: '🖼️ Poster', desc: 'Large format displays' },
  ];
  
  const flyerSizes = [
    { value: '8.5x11', label: 'Letter (8.5×11")', aspect: '8.5:11' },
    { value: '11x17', label: 'Tabloid (11×17")', aspect: '11:17' },
    { value: '1080x1080', label: 'Square (1080×1080)', aspect: '1:1' },
    { value: '1080x1920', label: 'Story (1080×1920)', aspect: '9:16' },
  ];
  
  if (!isOpen) return null;
  
  const handleGenerate = () => {
    const sizeInfo = flyerSizes.find(s => s.value === flyerSize);
    const fullPrompt = `Create a professional ${flyerType} flyer with the following details: ${flyerPrompt}. 
    
Design requirements:
- Size: ${sizeInfo?.label}
- Style: Modern, professional, eye-catching
- Include all text clearly and legibly
- Use appropriate colors and imagery
- Make it print-ready with proper margins`;
    
    onGenerate(fullPrompt, sizeInfo?.aspect || '8.5:11', outputFormat);
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-1">📄 Generate Flyer</h3>
        <p className="text-gray-500 text-xs mb-4">Create professional flyers, posters & promotional materials</p>
        
        {/* Flyer Description */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">What's the flyer about?</label>
          <textarea
            value={flyerPrompt}
            onChange={(e) => setFlyerPrompt(e.target.value)}
            placeholder="Pickleball clinic on March 22nd at Johnson Park. $25 per person. Beginners welcome. Contact coach@example.com..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 resize-none h-28 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Flyer Type */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Flyer Type</label>
          <div className="grid grid-cols-2 gap-2">
            {flyerTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setFlyerType(type.value)}
                className={`p-3 rounded-xl text-left transition-colors ${
                  flyerType === type.value
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-white text-sm font-medium">{type.label}</span>
                <p className="text-gray-500 text-[10px]">{type.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Size Selection */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Size</label>
          <div className="grid grid-cols-2 gap-2">
            {flyerSizes.map(size => (
              <button
                key={size.value}
                onClick={() => setFlyerSize(size.value)}
                className={`p-3 rounded-xl text-center transition-colors ${
                  flyerSize === size.value
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-white text-sm">{size.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Output Format */}
        <div className="mb-6">
          <label className="text-gray-400 text-xs mb-2 block">Output Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setOutputFormat('png')}
              className={`flex-1 p-3 rounded-xl transition-colors ${
                outputFormat === 'png'
                  ? 'bg-cyan-500/20 border border-cyan-500/50'
                  : 'bg-white/5 border border-transparent'
              }`}
            >
              <span className="text-white text-sm font-medium">PNG</span>
              <p className="text-gray-500 text-[10px]">Best for digital</p>
            </button>
            <button
              onClick={() => setOutputFormat('pdf')}
              className={`flex-1 p-3 rounded-xl transition-colors ${
                outputFormat === 'pdf'
                  ? 'bg-cyan-500/20 border border-cyan-500/50'
                  : 'bg-white/5 border border-transparent'
              }`}
            >
              <span className="text-white text-sm font-medium">PDF</span>
              <p className="text-gray-500 text-[10px]">Best for printing</p>
            </button>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!flyerPrompt.trim() || isGenerating}
          className={`w-full p-4 rounded-xl font-medium transition-all ${
            flyerPrompt.trim() && !isGenerating
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
              : 'bg-white/10 text-gray-500'
          }`}
        >
          {isGenerating ? 'Generating...' : '✨ Generate Flyer'}
        </button>
        
        <p className="text-gray-600 text-[10px] text-center mt-3">
          Tip: Be specific! Include dates, times, locations, pricing, and contact info.
        </p>
        
        <button onClick={onClose} className="w-full mt-3 p-3 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Rename Conversation Modal
const RenameModal = ({ isOpen, onClose, title, onTitleChange, onSave }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#141a21] rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-semibold text-lg mb-4">Rename Conversation</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Enter new title..."
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 mb-4"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 p-3 rounded-xl bg-white/5 text-gray-400">
            Cancel
          </button>
          <button onClick={onSave} className="flex-1 p-3 rounded-xl bg-orange-500 text-white font-medium">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Media Gallery View
const GalleryView = ({ isOpen, onClose, items, onItemClick, token, onDeleteItem, onRegenerate }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  
  // Update edited prompt when selected item changes
  useEffect(() => {
    if (selectedItem) {
      setEditedPrompt(selectedItem.prompt || '');
      setIsEditing(false);
      setShowFullPrompt(false);
    }
  }, [selectedItem]);
  
  if (!isOpen) return null;
  
  const handleDelete = async (item) => {
    if (!confirm('Delete this from your gallery?')) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        onDeleteItem?.(item.id);
        setSelectedItem(null);
      } else {
        alert('Failed to delete');
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
          type: selectedItem.type,
          model: selectedItem.model || 'smart',
          prompt: editedPrompt,
          aspectRatio: selectedItem.aspect_ratio || '1:1',
          duration: selectedItem.duration || '5',
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert('Regeneration failed: ' + data.error);
      } else {
        onRegenerate?.(data);
        setSelectedItem(null);
        onClose();
        alert(selectedItem.type === 'video' ? 'Video generation started! Check the gallery in a few minutes.' : 'New image generated! Check the gallery.');
      }
    } catch (e) {
      alert('Regeneration failed: ' + e.message);
    }
    setRegenerating(false);
  };
  
  const promptIsTruncated = selectedItem?.prompt && selectedItem.prompt.length > 100;
  
  return (
    <div className="fixed inset-0 bg-sp-black z-[60]">
      <div className="safe-area-top bg-sp-black p-4 flex items-center gap-3 border-b border-white/10">
        <button onClick={onClose} className="p-2 text-gray-400">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-white font-semibold text-lg">Media Gallery</h3>
      </div>
      
      <div className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 60px)' }}>
        {items.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No generated media yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedItem(item)}
                className="aspect-square rounded-xl overflow-hidden bg-white/5 relative"
              >
                {item.type === 'image' ? (
                  <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                ) : (
                  <div className="relative w-full h-full">
                    <video src={item.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Video className="w-8 h-8 text-white/80" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Item Detail Modal with Edit & Regenerate */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col" onClick={() => !isEditing && setSelectedItem(null)}>
          {/* Header with safe area for notch */}
          <div className="bg-black border-b border-white/10" style={{ paddingTop: 'env(safe-area-inset-top, 12px)' }}>
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${selectedItem.type === 'video' ? 'bg-blue-500/30 text-purple-300' : 'bg-pink-500/30 text-pink-300'}`}>
                  {selectedItem.type === 'video' ? 'Video' : 'Image'} • {selectedItem.model_label || selectedItem.model}
                </span>
                {selectedItem.duration && selectedItem.type === 'video' && (
                  <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-400">
                    {selectedItem.duration}s
                  </span>
                )}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedItem(null); }} 
                className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {selectedItem.type === 'video' ? (
              <video src={selectedItem.url} controls autoPlay playsInline className="max-w-full max-h-[45vh] rounded-xl" />
            ) : (
              <img src={selectedItem.url} alt={selectedItem.prompt} className="max-w-full max-h-[45vh] object-contain rounded-xl" />
            )}
          </div>
          
          {/* Prompt & Actions Section */}
          <div className="p-4 bg-white/5 safe-area-bottom max-h-[45vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Prompt Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">ORIGINAL PROMPT</span>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  {isEditing ? 'Cancel' : 'Edit & Regenerate'}
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
                    autoFocus
                  />
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating || !editedPrompt.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Regenerate {selectedItem.type === 'video' ? 'Video' : 'Image'}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <p className={`text-sm text-gray-300 ${!showFullPrompt && promptIsTruncated ? 'line-clamp-2' : ''}`}>
                    {selectedItem.prompt || 'No prompt available'}
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
            </div>
            
            {/* Date and Action Buttons */}
            {!isEditing && (
              <>
                <div className="text-xs text-gray-500 mb-3">
                  {new Date(selectedItem.created_at).toLocaleString()}
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleDelete(selectedItem)}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete
                  </button>
                  <a 
                    href={selectedItem.url} 
                    download 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500/15 border border-orange-500/30 rounded-xl text-orange-400 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Compare Mode Sheet
const CompareModeSheet = ({ 
  isOpen, onClose, models, selectedModels, onToggleModel, onCompare 
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-2">Compare Models</h3>
        <p className="text-gray-500 text-sm mb-4">Select 2+ models to compare their responses</p>
        
        <div className="space-y-2 mb-6">
          {models.filter(m => !m.comingSoon).map(model => (
            <button
              key={model.value}
              onClick={() => onToggleModel(model.value)}
              className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition-colors ${
                selectedModels.includes(model.value)
                  ? 'bg-blue-500/20 border border-blue-500/50'
                  : 'bg-white/5 border border-transparent'
              }`}
            >
              <div>
                <span className="text-white text-sm font-medium">{model.label}</span>
                <span className="text-gray-500 text-xs ml-2">{model.group}</span>
              </div>
              {selectedModels.includes(model.value) && (
                <Check className="w-5 h-5 text-blue-400" />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onCompare}
          disabled={selectedModels.length < 2}
          className={`w-full p-4 rounded-xl font-medium transition-all ${
            selectedModels.length >= 2
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-gray-500'
          }`}
        >
          Compare {selectedModels.length} Models
        </button>
        
        <button onClick={onClose} className="w-full mt-3 p-3 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Compare Results View
const CompareResultsView = ({ responses, onSelect, onClose }) => {
  if (!responses) return null;
  
  return (
    <div className="fixed inset-0 bg-sp-black z-[60] overflow-y-auto">
      <div className="safe-area-top bg-sp-black p-4 flex items-center gap-3 border-b border-white/10 sticky top-0">
        <button onClick={onClose} className="p-2 text-gray-400">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-white font-semibold text-lg">Compare Results</h3>
      </div>
      
      <div className="p-4 space-y-4 pb-20">
        {responses.map((resp, idx) => (
          <div key={idx} className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-orange-400 font-medium text-sm">{resp.model}</span>
              <button
                onClick={() => onSelect(resp)}
                className="px-3 py-1 bg-orange-500 text-white text-xs rounded-full"
              >
                Use This
              </button>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">{resp.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Chat History Import Sheet - Unified import for all platforms
const ImportSheet = ({ isOpen, onClose, onImport, isUploading, uploadProgress }) => {
  const fileRef = useRef(null);
  const wakeLockRef = useRef(null);
  
  // Request wake lock to prevent screen from turning off during upload
  useEffect(() => {
    const requestWakeLock = async () => {
      if (isUploading && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Wake lock acquired for upload');
        } catch (err) {
          console.log('Wake lock failed:', err);
        }
      }
    };
    
    const releaseWakeLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake lock released');
      }
    };
    
    if (isUploading) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    
    // Re-acquire wake lock if page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isUploading) {
        requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUploading]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={isUploading ? undefined : onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Import History</h3>
          <p className="text-gray-500 text-sm">Currently supports ChatGPT • More platforms coming soon</p>
        </div>
        
        <input
          type="file"
          ref={fileRef}
          accept=".zip"
          onChange={(e) => onImport(e.target.files?.[0])}
          className="hidden"
        />
        
        {isUploading ? (
          <div className="text-center py-6">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-3" />
            <p className="text-white text-sm font-medium">{uploadProgress || 'Processing...'}</p>
            <p className="text-gray-500 text-xs mt-2">Keep this screen open</p>
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-xs">
                💡 Screen will stay on during upload
              </p>
            </div>
          </div>
        ) : (
          <>
            <button 
              onClick={() => fileRef.current?.click()}
              className="w-full p-4 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-center mb-4 hover:bg-orange-500/30 transition-colors"
            >
              <Upload className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <span className="text-white font-medium block">Choose ZIP File</span>
              <p className="text-orange-400/70 text-xs mt-1">We auto-detect the format</p>
            </button>
            
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs rounded-full">ChatGPT</span>
              <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">Facebook</span>
              <span className="px-2.5 py-1 bg-orange-500/10 text-orange-300 text-xs rounded-full">Claude</span>
              <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">Google</span>
            </div>
            
            <p className="text-gray-600 text-[10px] text-center mb-4 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3 text-green-500" />
              <span className="text-green-500/80">Messages analyzed then deleted — only insights kept for your SoulPrint</span>
            </p>
          </>
        )}
        
        <button 
          onClick={onClose} 
          disabled={isUploading}
          className={`w-full p-3 text-sm ${isUploading ? 'text-gray-700 cursor-not-allowed' : 'text-gray-500'}`}
        >
          {isUploading ? 'Please wait...' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};

// Main Mobile Chat Component
export default function MobileChat({ 
  token, 
  user, 
  assistantName = 'SoulPrint',
  onOpenSettings,
  onOpenVoiceChat,
  initialConversationId = null 
}) {
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSources, setStreamingSources] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [selectedModel, setSelectedModel] = useState('smart'); // Default to Dynamic Intelligence
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showFlyerGenSheet, setShowFlyerGenSheet] = useState(false);
  const [profile, setProfile] = useState(null);
  const [soulPrint, setSoulPrint] = useState(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [lastSmartSelection, setLastSmartSelection] = useState(null); // Track which model Dynamic Intelligence selected
  
  // AbortController for stopping requests
  const abortControllerRef = useRef(null);
  
  // New state for additional features
  const [showImageGenSheet, setShowImageGenSheet] = useState(false);
  const [showVideoGenSheet, setShowVideoGenSheet] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState('smart');
  const [selectedVideoModel, setSelectedVideoModel] = useState('smart');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('1:1');
  const [mediaPrompt, setMediaPrompt] = useState('');
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  // Visual content generation state (flyers, infographics, images)
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [visualGenerationType, setVisualGenerationType] = useState(''); // 'flyer', 'infographic', 'image'
  const [streamingImageUrl, setStreamingImageUrl] = useState(null);
  const [streamingVideoTask, setStreamingVideoTask] = useState(null);
  const streamingImageUrlRef = useRef(null);
  const streamingVideoTaskRef = useRef(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingConversation, setRenamingConversation] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [showCompareMode, setShowCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState(['gpt-4o', 'claude-sonnet-4-5-20250929']);
  const [compareResponses, setCompareResponses] = useState(null);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [conversationSearch, setConversationSearch] = useState(''); // For searching conversations
  // PWA Install prompt state
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  // Edit display name state
  const [showEditNameSheet, setShowEditNameSheet] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState('');
  // Onboarding modal state
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Viral invite state
  const [inviteData, setInviteData] = useState(null);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  
  // Projects state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null); // null = show all, 'general' = uncategorized
  const [showProjectSheet, setShowProjectSheet] = useState(false);
  const [projectSheetMode, setProjectSheetMode] = useState('create'); // 'create' | 'edit' | 'share'
  const [editingProject, setEditingProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('collaborator');
  const [projectShareLink, setProjectShareLink] = useState(null);
  const [showMoveToProjectSheet, setShowMoveToProjectSheet] = useState(false);
  const [movingConversation, setMovingConversation] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  
  // Media intent detection state
  const [detectedMediaIntent, setDetectedMediaIntent] = useState(null); // 'image' | 'video' | null
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [mediaOptionsExpanded, setMediaOptionsExpanded] = useState(false); // Advanced options
  const [quickAspectRatio, setQuickAspectRatio] = useState('1:1');
  const [quickVideoLength, setQuickVideoLength] = useState('5');
  
  // Image editing state (mask editor)
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [maskEditImageUrl, setMaskEditImageUrl] = useState(null);
  const [isMaskEditing, setIsMaskEditing] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editableImage, setEditableImage] = useState(null);
  
  // iOS Keyboard handling
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Location state
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [locationError, setLocationError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputContainerRef = useRef(null);

  // Speech recognition
  const speech = useSpeechRecognition({
    token,
    onTranscript: (text) => {
      setInput(prev => (prev ? prev + ' ' + text : text));
      setInterimText('');
    },
    onInterim: (text) => setInterimText(text),
  });

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // iOS/Android Keyboard handling - keep input visible above keyboard
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateInputPosition = () => {
      if (!inputContainerRef.current) return;
      
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        const offsetFromBottom = window.innerHeight - viewport.height - viewport.offsetTop;
        
        if (offsetFromBottom > 100) {
          // Keyboard is open
          setKeyboardVisible(true);
          setKeyboardHeight(offsetFromBottom);
          // Position input at the top of keyboard
          inputContainerRef.current.style.bottom = `${offsetFromBottom}px`;
          inputContainerRef.current.style.zIndex = '9999';
        } else {
          // Keyboard is closed
          setKeyboardVisible(false);
          setKeyboardHeight(0);
          inputContainerRef.current.style.bottom = 'calc(4.5rem + env(safe-area-inset-bottom, 0px))';
          inputContainerRef.current.style.zIndex = '60';
        }
      }
    };
    
    const handleFocus = () => {
      // Small delay to let keyboard animation start
      setTimeout(updateInputPosition, 100);
      setTimeout(updateInputPosition, 300);
    };
    
    const handleBlur = () => {
      setTimeout(() => {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setKeyboardVisible(false);
          setKeyboardHeight(0);
          if (inputContainerRef.current) {
            inputContainerRef.current.style.bottom = 'calc(4.5rem + env(safe-area-inset-bottom, 0px))';
            inputContainerRef.current.style.zIndex = '60';
          }
        }
      }, 100);
    };
    
    const input = inputRef.current;
    if (input) {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
    }
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateInputPosition);
      window.visualViewport.addEventListener('scroll', updateInputPosition);
    }
    
    // Fallback resize handler
    window.addEventListener('resize', updateInputPosition);
    
    return () => {
      if (input) {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateInputPosition);
        window.visualViewport.removeEventListener('scroll', updateInputPosition);
      }
      window.removeEventListener('resize', updateInputPosition);
    };
  }, []);

  // Media intent detection function
  const detectMediaIntent = useCallback((text) => {
    if (!text || text.length > 500) return null;
    const lower = text.toLowerCase().trim();
    
    // Video patterns - check first (more specific)
    const videoPatterns = [
      /\b(generate|create|make|animate)\s+(a\s+)?(video|clip|animation|short film)\b/i,
      /\bvideo\s+of\b/i,
      /\banimate\s+(a|an|the|my|this)?\s*\w/i,
    ];
    if (videoPatterns.some(p => p.test(lower))) return 'video';
    
    // Image patterns
    const imagePatterns = [
      /\b(generate|create|make|draw|paint)\s+(an?\s+)?(image|picture|photo|illustration|artwork|painting)\b/i,
      /\b(show|give)\s+me\s+(an?\s+)?(picture|image|photo)\b/i,
      /\b(picture|photo|image|illustration)\s+of\b/i,
      /\bvisualize\b/i,
      /\bdraw\s+(me\s+)?(a|an|the)?\s*\w/i,
    ];
    if (imagePatterns.some(p => p.test(lower))) return 'image';
    
    return null;
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
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported. Please enter your location manually.');
      setShowLocationSheet(true);
      return;
    }
    
    const isPwaIOS = isIOSPwa();
    setLocationLoading(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          const res = await fetch('/api/user/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
          const data = await res.json();
          if (res.ok) {
            setUserLocation({ lat: latitude, lng: longitude, address: data.address, accuracy });
            setLocationError(null);
            setShowLocationSheet(false);
            // Show confirmation in chat
            setMessages(prev => [...prev, {
              id: `loc-${Date.now()}`, role: 'assistant',
              content: `📍 **Location saved!**\n\n${data.address}\n\nYou can now ask me things like:\n- "Find restaurants near me"\n- "What coffee shops are nearby?"`,
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
        
        // Detect platform for better instructions
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        
        let errorMsg = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            if (isIOS && isPWA) {
              errorMsg = 'Location denied.\n\nFor iOS PWA:\n1. Settings → Privacy → Location Services\n2. Find Safari Websites\n3. Enable "While Using"\n\nOr enter location manually.';
            } else if (isIOS) {
              errorMsg = 'Location denied.\n\nOn iOS:\n1. Settings → Safari → Location\n2. Set to "Ask" or "Allow"\n3. Refresh and retry\n\nOr enter manually.';
            } else if (isAndroid) {
              errorMsg = 'Location denied.\n\nOn Android:\n1. Tap lock icon in address bar\n2. Enable Location permission\n3. Refresh and retry\n\nOr enter manually.';
            } else {
              errorMsg = 'Location denied.\n\nEnable in browser settings or enter manually.';
            }
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Could not detect location.\n\nPoor GPS signal or location services disabled.\n\nEnter location manually.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Location request timed out.\n\nTry again or enter manually.';
            break;
          default:
            errorMsg = 'Could not get location.\n\nEnter manually.';
        }
        
        setLocationError(errorMsg);
        setShowLocationSheet(true);
      },
      { 
        enableHighAccuracy: true, 
        timeout: isPwaIOS ? 15000 : 10000,
        maximumAge: 300000
      }
    );
  }, [token, isIOSPwa]);

  // Save manually entered location
  const saveManualLocation = useCallback(async () => {
    if (!manualLocationInput.trim()) {
      setLocationError('Please enter a location');
      return;
    }
    
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      // Geocode the address
      const res = await fetch('/api/places/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: manualLocationInput.trim() }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.lat && data.lng) {
        // Save the location
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
          setShowLocationSheet(false);
          setManualLocationInput('');
          
          setMessages(prev => [...prev, {
            id: `loc-${Date.now()}`, role: 'assistant',
            content: `📍 **Location saved!**\n\n${data.formattedAddress || manualLocationInput}\n\nYou can now ask for nearby places!`,
            created_at: new Date().toISOString(),
          }]);
        } else {
          setLocationError(saveData.error || 'Failed to save location');
        }
      } else {
        setLocationError('Could not find that location. Please try a different address.');
      }
    } catch (err) {
      console.error('Failed to geocode:', err);
      setLocationError('Failed to look up location. Please try again.');
    }
    
    setLocationLoading(false);
  }, [token, manualLocationInput]);

  // Fetch saved location on mount
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

  // Watch input for media intent - DISABLED: Now uses Dynamic Intelligence like desktop
  // The popup for selecting image/video models has been removed.
  // All image/video generation now goes through the normal chat stream
  // and Dynamic Intelligence selects the appropriate model automatically.
  /*
  useEffect(() => {
    const intent = detectMediaIntent(input);
    if (intent !== detectedMediaIntent) {
      setDetectedMediaIntent(intent);
      if (intent) {
        setShowMediaOptions(true);
      }
    }
  }, [input, detectMediaIntent, detectedMediaIntent]);
  */

  // Capture the beforeinstallprompt event for PWA install
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

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

  // Load conversations
  useEffect(() => {
    if (!token) return;
    const projectQuery = selectedProject ? `?project_id=${selectedProject}` : '';
    fetch(`/api/conversations${projectQuery}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [token, selectedProject]);
  
  // Load projects
  useEffect(() => {
    if (!token) return;
    setProjectsLoading(true);
    fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        // API returns { owned: [], shared: [], uncategorized_count: n }
        const allProjects = [
          ...(data.owned || []),
          ...(data.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
      })
      .catch(console.error)
      .finally(() => setProjectsLoading(false));
  }, [token]);

  // Load profile
  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.profile) setProfile(data.profile);
        // Check if new user (show onboarding if they haven't seen it)
        const hasSeenOnboarding = localStorage.getItem('sp_onboarding_seen');
        if (!hasSeenOnboarding && !data.profile?.onboarding_completed) {
          setShowOnboarding(true);
        }
      })
      .catch(console.error);
  }, [token]);

  // Load announcements (unread list which respects 24h dismiss)
  useEffect(() => {
    if (!token) return;
    fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        // API returns { announcements: [...], unread: [...] }
        // Use unread for display (respects 24h dismiss)
        const unreadList = Array.isArray(data.unread) ? data.unread : [];
        setAnnouncements(unreadList);
      })
      .catch(console.error);
  }, [token]);

  // Auto-request location when app loads (if not already set)
  useEffect(() => {
    if (!token) return;
    
    // Check if we already asked this session
    const hasAskedLocation = sessionStorage.getItem('sp_location_asked_mobile');
    if (hasAskedLocation) return;
    
    // Mark that we've asked this session
    sessionStorage.setItem('sp_location_asked_mobile', 'true');
    
    // Check if user already has location saved
    fetch('/api/user/location', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.hasLocation) {
          // User already has location, just set it
          setUserLocation({ lat: data.lat, lng: data.lng, address: data.address });
        } else {
          // Request location automatically (silently - no error messages)
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                  const res = await fetch('/api/user/location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ lat: latitude, lng: longitude }),
                  });
                  const locData = await res.json();
                  if (res.ok) {
                    setUserLocation({ lat: latitude, lng: longitude, address: locData.address });
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
  }, [token]);

  // Load invite data (if viral invites are enabled)
  useEffect(() => {
    if (!token) return;
    fetch('/api/invites', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.enabled) {
          setInviteData(data);
        }
      })
      .catch(console.error);
  }, [token]);

  // Load conversation messages
  useEffect(() => {
    if (!token || !conversationId) {
      const greet = profile?.display_name || user?.profile?.display_name || 'there';
      const customGreeting = profile?.custom_greeting || user?.profile?.custom_greeting;
      
      // Use custom greeting if set, otherwise use default
      const greetingContent = customGreeting 
        ? customGreeting.replace('{name}', greet).replace('{assistant}', assistantName)
        : `Hey ${greet}! I'm ${assistantName}. What's on your mind?`;
      
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: greetingContent,
      }]);
      return;
    }
    
    // Use the same endpoint as desktop: /api/messages?conversationId=
    fetch(`/api/messages?conversationId=${conversationId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch(console.error);
  }, [token, conversationId, assistantName, profile, user]);

  // Process file for attachment
  const processFile = async (file) => {
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDOCX = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   file.name.toLowerCase().endsWith('.docx');
    
    if (isImage) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result.split(',')[1];
          resolve({ type: 'image', base64, mimeType: file.type, name: file.name });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else if (isPDF || isDOCX) {
      // Parse PDF/DOCX on the server
      try {
        const formData = new FormData();
        formData.append('file', file);
        
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
        return { 
          type: 'document', 
          text: data.text || '', 
          name: file.name, 
          mimeType: file.type,
          metadata: data.metadata 
        };
      } catch (err) {
        console.error('Document parse error:', err);
        return { 
          type: 'document', 
          text: `[Error reading ${file.name}: ${err.message}]`, 
          name: file.name, 
          mimeType: file.type 
        };
      }
    } else {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({ type: 'document', text: e.target.result?.slice(0, 20000) || '', name: file.name, mimeType: file.type });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setIsProcessingFile(true);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File ${file.name} is too large. Max size is 10MB.`);
        continue;
      }
      try {
        const processed = await processFile(file);
        setAttachments(prev => [...prev, processed]);
      } catch (err) {
        console.error('Error processing file:', err);
        alert(`Failed to process ${file.name}. Please try again.`);
      }
    }
    setIsProcessingFile(false);
    e.target.value = '';
  };

  // Generate media (image or video) with options
  const generateMediaWithOptions = async () => {
    if (!input.trim() || loading) return;
    
    setShowMediaOptions(false);
    setLoading(true);
    
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
        // Generate image using selected model
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
        // Generate video using selected model
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
          }),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Video generation failed');
        
        const modelLabel = VIDEO_MODELS.find(m => m.value === modelToUse)?.label || modelToUse;
        const assistantMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `🎬 Video generation started with ${modelLabel}!\n\n**Prompt:** ${content}\n\nYour video is being generated (1-3 min)...`,
          video_task: { taskId: data.taskId, status: 'generating', prompt: content },
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      const errorMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, ${detectedMediaIntent} generation failed: ${error.message}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Send as regular chat (bypass media detection)
  const sendAsChat = () => {
    setShowMediaOptions(false);
    setDetectedMediaIntent(null);
    sendMessage();
  };

  // Send message
  const sendMessage = async () => {
    if ((!input.trim() && !attachments.length) || loading) return;
    
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    
    const content = input.trim();
    const userMessage = { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      content: content || '[Attachment]',
      attachments: attachments.length > 0 ? attachments : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setLoading(true);
    
    try {
      // Get current model provider
      const currentModel = MODELS.find(m => m.value === selectedModel) || { provider: 'openai' };
      
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: conversationId,
          content: content,
          model: selectedModel,
          provider: currentModel.provider,
          attachments: userMessage.attachments,
          enableWebSearch: webSearchEnabled,
          projectId: selectedProject && selectedProject !== 'general' ? selectedProject : null,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send message');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let newConvId = conversationId;
      let buffer = '';
      let actualModelUsed = selectedModel;
      let dynamicIntelligenceReason = null;

      while (reader) {
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
            } else if (data.type === 'image') {
              // Image generated – store url for rendering
              setStreamingImageUrl(data.url);
              streamingImageUrlRef.current = data.url;
              // Reset visual generation state since image arrived
              setIsGeneratingVisual(false);
              setVisualGenerationType('');
            } else if (data.type === 'video_task') {
              // Video job started – store taskId for polling
              const videoTask = { taskId: data.taskId, status: 'generating', prompt: data.prompt };
              setStreamingVideoTask(videoTask);
              streamingVideoTaskRef.current = videoTask;
            } else if (data.type === 'delta') {
              // Skip the markdown content if it's an image (we render the image directly)
              if (!streamingImageUrlRef.current) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else {
                fullContent += data.content;
              }
              
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
                let type = 'image';
                if (lowerContent.includes('infographic')) type = 'infographic';
                else if (lowerContent.includes('flyer')) type = 'flyer';
                else if (lowerContent.includes('poster')) type = 'poster';
                else if (lowerContent.includes('edit')) type = 'edit';
                else if (lowerContent.includes('video') || lowerContent.includes('🎬')) type = 'video';
                setIsGeneratingVisual(true);
                setVisualGenerationType(type);
              }
            } else if (data.type === 'sources') {
              // Received sources from web search
              setStreamingSources(data.sources || []);
            } else if (data.type === 'done') {
              // Message complete
            }
          } catch {}
        }
      }

      if (fullContent) {
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          model_used: actualModelUsed,
          smart_mode: selectedModel === 'smart',
          smart_reason: dynamicIntelligenceReason,
          sources: streamingSources.length > 0 ? [...streamingSources] : undefined,
          image_url: streamingImageUrlRef.current || undefined,
          video_task: streamingVideoTaskRef.current || undefined,
        }]);
      }

      setStreamingContent('');
      setStreamingSources([]);
      setStreamingImageUrl(null);
      setStreamingVideoTask(null);
      streamingImageUrlRef.current = null;
      streamingVideoTaskRef.current = null;
      setIsGeneratingVisual(false);
      setVisualGenerationType('');
      if (newConvId && newConvId !== conversationId) {
        setConversationId(newConvId);
        // Refresh conversations list
        fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => setConversations(Array.isArray(data) ? data : []))
          .catch(console.error);
      }

    } catch (err) {
      // Handle abort gracefully
      if (err.name === 'AbortError') {
        // If there's streaming content, save it as partial response
        if (streamingContent) {
          setMessages(prev => [...prev, {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: streamingContent + '\n\n*(Response stopped)*',
            model_used: selectedModel,
          }]);
          setStreamingContent('');
        }
      } else {
        setMessages(prev => [...prev, {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        }]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Stop ongoing request
  const stopRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      // If there's streaming content, save it
      if (streamingContent) {
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: streamingContent + '\n\n*(Response stopped)*',
          model_used: selectedModel,
        }]);
        setStreamingContent('');
      }
    }
  };

  // Handle message feedback
  const handleFeedback = async (messageId, feedbackType) => {
    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: messageId, feedback: feedbackType }),
      });
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  // Handle mask edit save
  const handleMaskEditSave = async (imageBase64, maskBase64, editPrompt) => {
    if (!token) return;
    
    setIsMaskEditing(true);
    setShowMaskEditor(false);
    
    try {
      const response = await fetch('/api/image/mask-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageBase64,
          maskBase64,
          prompt: editPrompt,
          conversationId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Mask edit failed');
      }
      
      // Add the edited image as a new message
      const editMsg = {
        id: `mask-edit-${Date.now()}`,
        role: 'assistant',
        content: `🎨 Mask edit applied!\n\n**Edit:** ${editPrompt}`,
        created_at: new Date().toISOString(),
        image_url: data.url,
      };
      
      setMessages(prev => [...prev, editMsg]);
      setMaskEditImageUrl(null);
      
    } catch (err) {
      alert('Mask edit failed: ' + err.message);
    } finally {
      setIsMaskEditing(false);
    }
  };

  // Delete conversation
  const deleteConversation = async (id) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) {
        setConversationId(null);
        const greet = profile?.display_name || user?.profile?.display_name || 'there';
        const customGreeting = profile?.custom_greeting || user?.profile?.custom_greeting;
        const greetingContent = customGreeting 
          ? customGreeting.replace('{name}', greet).replace('{assistant}', assistantName)
          : `Hey ${greet}! I'm ${assistantName}. What's on your mind?`;
        
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: greetingContent,
        }]);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // New conversation
  const newConversation = () => {
    setConversationId(null);
    const greet = profile?.display_name || user?.profile?.display_name || 'there';
    const customGreeting = profile?.custom_greeting || user?.profile?.custom_greeting;
    const greetingContent = customGreeting 
      ? customGreeting.replace('{name}', greet).replace('{assistant}', assistantName)
      : `Hey ${greet}! I'm ${assistantName}. What's on your mind?`;
    
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: greetingContent,
    }]);
    setActiveTab('chat');
  };

  // Load conversation
  const loadConversation = (id) => {
    setConversationId(id);
    setActiveTab('chat');
  };

  // Rename conversation
  const renameConversation = async () => {
    if (!renamingConversation || !renameTitle.trim()) return;
    try {
      await fetch(`/api/conversations/${renamingConversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: renameTitle.trim() }),
      });
      setConversations(prev => prev.map(c => 
        c.id === renamingConversation.id ? { ...c, title: renameTitle.trim() } : c
      ));
    } catch (err) {
      console.error('Rename error:', err);
    }
    setShowRenameModal(false);
    setRenamingConversation(null);
    setRenameTitle('');
  };

  // Open rename modal
  const openRenameModal = (conv) => {
    setRenamingConversation(conv);
    setRenameTitle(conv.title || '');
    setShowRenameModal(true);
  };

  // ─────────────────────────────────────────────────────────────────
  // PROJECT MANAGEMENT FUNCTIONS
  // ─────────────────────────────────────────────────────────────────
  
  // Create a new project
  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: newProjectName.trim(), 
          description: newProjectDescription.trim() 
        }),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects(prev => [{ ...project, is_owner: true, conversation_count: 0 }, ...prev]);
        setShowProjectSheet(false);
        setNewProjectName('');
        setNewProjectDescription('');
      }
    } catch (err) {
      console.error('Create project error:', err);
    }
  };
  
  // Update project
  const updateProject = async () => {
    if (!editingProject || !newProjectName.trim()) return;
    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: newProjectName.trim(), 
          description: newProjectDescription.trim() 
        }),
      });
      if (res.ok) {
        setProjects(prev => prev.map(p => 
          p.id === editingProject.id 
            ? { ...p, name: newProjectName.trim(), description: newProjectDescription.trim() } 
            : p
        ));
        setShowProjectSheet(false);
        setEditingProject(null);
        setNewProjectName('');
        setNewProjectDescription('');
      }
    } catch (err) {
      console.error('Update project error:', err);
    }
  };
  
  // Delete project
  const deleteProject = async (projectId) => {
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
        // Reload conversations since they've been uncategorized
        fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => setConversations(Array.isArray(data) ? data : []));
      }
    } catch (err) {
      console.error('Delete project error:', err);
    }
  };
  
  // Open project edit sheet
  const openEditProjectSheet = (project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectDescription(project.description || '');
    setProjectSheetMode('edit');
    setShowProjectSheet(true);
  };
  
  // Open project share sheet
  const openShareProjectSheet = async (project) => {
    setEditingProject(project);
    setProjectSheetMode('share');
    setShareEmail('');
    setShareRole('collaborator');
    // Fetch share link if exists
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
    setShowProjectSheet(true);
  };
  
  // Share project with user by email
  const shareProjectWithUser = async () => {
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
        // Refresh projects to get updated shared_with
        const projRes = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
        const projData = await projRes.json();
        const allProjects = [
          ...(projData.owned || []),
          ...(projData.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
        // Update editing project too
        const updatedProject = allProjects.find(p => p.id === editingProject.id);
        if (updatedProject) setEditingProject(updatedProject);
      } else {
        alert(data.error || 'Failed to share project');
      }
    } catch (err) {
      console.error('Share project error:', err);
      alert('Failed to share project');
    }
  };
  
  // Copy share link
  const copyShareLink = () => {
    if (!projectShareLink?.code) return;
    const link = `${window.location.origin}/join/${projectShareLink.code}`;
    navigator.clipboard.writeText(link);
    alert('Share link copied!');
  };
  
  // Move conversation to project
  const moveConversationToProject = async (convId, projectId) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/project`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (res.ok) {
        // Refresh conversations
        const projectQuery = selectedProject ? `?project_id=${selectedProject}` : '';
        const convRes = await fetch(`/api/conversations${projectQuery}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await convRes.json();
        setConversations(Array.isArray(data) ? data : []);
        // Also refresh projects to update conversation counts
        const projRes = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
        const projData = await projRes.json();
        const allProjects = [
          ...(projData.owned || []),
          ...(projData.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
      }
    } catch (err) {
      console.error('Move conversation error:', err);
    }
    setShowMoveToProjectSheet(false);
    setMovingConversation(null);
  };
  
  // Open move to project sheet
  const openMoveToProjectSheet = (conv) => {
    setMovingConversation(conv);
    setShowMoveToProjectSheet(true);
  };

  // Handle media generation (image/video)
  const handleMediaGenerate = async (type) => {
    if (!mediaPrompt.trim()) return;
    setIsGeneratingMedia(true);
    
    const model = type === 'image' ? selectedImageModel : selectedVideoModel;
    const placeholderMsg = {
      id: `gen-${Date.now()}`,
      role: 'assistant',
      content: `🎨 Generating ${type}...\n\n**Prompt:** ${mediaPrompt}\n**Model:** ${model}${type === 'image' ? `\n**Aspect:** ${selectedAspectRatio}` : ''}`,
      created_at: new Date().toISOString(),
      is_generating: true,
    };
    setMessages(prev => [...prev, placeholderMsg]);
    setShowImageGenSheet(false);
    setShowVideoGenSheet(false);
    setActiveTab('chat');

    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          type, 
          model, 
          prompt: mediaPrompt, 
          aspectRatio: selectedAspectRatio, 
          conversationId 
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? { ...m, content: `❌ Generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
            : m
        ));
      } else if (data.taskId && !data.url) {
        // Video task - poll for completion
        pollMediaTask(data.taskId, placeholderMsg.id, type, mediaPrompt, model);
      } else if (data.url) {
        // Immediate result (image)
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? {
                ...m,
                content: `✨ ${type === 'image' ? 'Image' : 'Video'} generated!\n\n**Prompt:** ${mediaPrompt}`,
                is_generating: false,
                image_url: type === 'image' ? data.url : undefined,
                video_url: type === 'video' ? data.url : undefined,
                model_used: model,
              }
            : m
        ));
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
      setMediaPrompt('');
    }
  };

  // Handle flyer generation
  const handleFlyerGenerate = async (prompt, aspectRatio, outputFormat) => {
    if (!prompt.trim()) return;
    setIsGeneratingMedia(true);
    
    const placeholderMsg = {
      id: `flyer-${Date.now()}`,
      role: 'assistant',
      content: `📄 Generating flyer...\n\n**Details:** ${prompt.slice(0, 200)}...\n**Format:** ${outputFormat.toUpperCase()}\n**Size:** ${aspectRatio}`,
      created_at: new Date().toISOString(),
      is_generating: true,
    };
    setMessages(prev => [...prev, placeholderMsg]);
    setShowFlyerGenSheet(false);
    setActiveTab('chat');

    try {
      // Use the image generation endpoint with flyer-optimized settings
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          type: 'image', 
          model: 'gpt-image-1', // Use DALL-E 3 / gpt-image-1 for flyers
          prompt: prompt, 
          aspectRatio: aspectRatio === '8.5:11' ? '2:3' : aspectRatio === '11:17' ? '2:3' : aspectRatio === '9:16' ? '9:16' : '1:1',
          conversationId,
          isFlyer: true,
          outputFormat: outputFormat,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? { ...m, content: `❌ Flyer generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
            : m
        ));
      } else if (data.url) {
        // Generate PDF if requested
        let pdfUrl = null;
        if (outputFormat === 'pdf') {
          try {
            const pdfRes = await fetch('/api/media/convert-to-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ imageUrl: data.url, aspectRatio }),
            });
            const pdfData = await pdfRes.json();
            if (pdfRes.ok && pdfData.pdfUrl) {
              pdfUrl = pdfData.pdfUrl;
            }
          } catch (pdfErr) {
            console.error('PDF conversion failed:', pdfErr);
          }
        }

        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? {
                ...m,
                content: `✨ Flyer generated!\n\n**Details:** ${prompt.slice(0, 150)}...${pdfUrl ? '\n\n📥 PDF version available!' : ''}`,
                is_generating: false,
                image_url: data.url,
                pdf_url: pdfUrl,
                model_used: 'gpt-image-1',
                is_flyer: true,
              }
            : m
        ));
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
  };

  // Poll for video task completion
  const pollMediaTask = async (taskId, msgId, type, prompt, model) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/media/status/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        
        if (data.status === 'completed' && data.url) {
          clearInterval(pollInterval);
          setMessages(prev => prev.map(m => 
            m.id === msgId 
              ? {
                  ...m,
                  content: `✨ ${type === 'image' ? 'Image' : 'Video'} generated!\n\n**Prompt:** ${prompt}`,
                  is_generating: false,
                  video_url: data.url,
                  model_used: model,
                }
              : m
          ));
          loadGallery();
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          setMessages(prev => prev.map(m => 
            m.id === msgId 
              ? { ...m, content: `❌ Generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
              : m
          ));
        }
      } catch (err) {
        clearInterval(pollInterval);
      }
    }, 3000);
    
    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  // Load gallery items
  const loadGallery = async () => {
    try {
      const res = await fetch('/api/media/gallery', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGalleryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Gallery load error:', err);
    }
  };

  // Handle compare mode
  const handleCompare = async () => {
    if (!input.trim() || compareModels.length < 2) return;
    setLoading(true);
    setShowCompareMode(false);
    
    const userMessage = { id: `u-${Date.now()}`, role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    const prompt = input.trim();
    setInput('');

    try {
      const responses = await Promise.all(
        compareModels.map(async (model) => {
          const modelInfo = MODELS.find(m => m.value === model) || { provider: 'openai' };
          const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              conversationId,
              content: prompt,
              model,
              provider: modelInfo.provider,
              enableWebSearch: webSearchEnabled,
              projectId: selectedProject && selectedProject !== 'general' ? selectedProject : null,
            }),
          });
          
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';
          let buffer = '';
          
          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.type === 'delta') fullContent += data.content;
              } catch {}
            }
          }
          return { model, content: fullContent };
        })
      );
      
      setCompareResponses(responses);
    } catch (err) {
      console.error('Compare error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Select compare response
  const selectCompareResponse = (response) => {
    setMessages(prev => [...prev, {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: response.content,
      model_used: response.model,
    }]);
    setCompareResponses(null);
  };

  // Handle cloud import with chunked upload for large files
  const handleImport = async (file) => {
    if (!file) return;
    
    setIsImporting(true);
    const fileSizeMB = file.size / (1024 * 1024);
    
    // Warn about very large files
    if (fileSizeMB > 500) {
      const proceed = window.confirm(
        `Your file is ${fileSizeMB.toFixed(0)}MB which will take a while to upload.\n\n` +
        `For faster imports, re-export with ONLY messages selected (no photos/videos).\n\n` +
        `Continue anyway?`
      );
      if (!proceed) {
        setIsImporting(false);
        return;
      }
    }
    
    try {
      // For large files (>10MB), use chunked upload
      if (fileSizeMB > 10) {
        setImportProgress(`Preparing ${fileSizeMB.toFixed(0)}MB file...`);
        
        // Adaptive chunk size based on file size
        // Smaller files: 1MB chunks, Larger files: 2MB chunks
        const CHUNK_SIZE = fileSizeMB > 200 ? 2 * 1024 * 1024 : 1 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const MAX_RETRIES = 5; // More retries for mobile
        
        // Initialize chunked upload
        const initRes = await fetch('/api/data-import/chunked/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            filename: file.name,
            fileSize: file.size,
            totalChunks,
            source: 'auto-detect'
          }),
        });
        
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to initialize upload');
        }
        
        const { uploadId } = await initRes.json();
        
        // Upload chunks with retry logic
        let successfulChunks = 0;
        const startTime = Date.now();
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const progress = Math.round(((i + 1) / totalChunks) * 80);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = successfulChunks > 0 ? (successfulChunks * CHUNK_SIZE) / elapsed / 1024 : 0;
          const remaining = rate > 0 ? Math.round((totalChunks - i) * CHUNK_SIZE / 1024 / rate) : 0;
          
          setImportProgress(
            `Uploading ${progress}%\n` +
            `${remaining > 60 ? Math.round(remaining/60) + ' min' : remaining + 's'} remaining`
          );
          
          let retries = 0;
          let chunkSuccess = false;
          
          while (retries < MAX_RETRIES && !chunkSuccess) {
            try {
              const formData = new FormData();
              formData.append('chunk', chunk);
              formData.append('uploadId', uploadId);
              formData.append('chunkIndex', i.toString());
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
              
              const chunkRes = await fetch('/api/data-import/chunked/chunk', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              
              if (chunkRes.ok) {
                chunkSuccess = true;
                successfulChunks++;
              } else {
                const err = await chunkRes.json().catch(() => ({}));
                throw new Error(err.error || 'Chunk failed');
              }
            } catch (chunkErr) {
              retries++;
              if (chunkErr.name === 'AbortError') {
                setImportProgress(`Slow connection, retrying... (${retries}/${MAX_RETRIES})`);
              } else {
                setImportProgress(`Retry ${retries}/${MAX_RETRIES}...`);
              }
              
              if (retries < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 2000 * retries)); // Longer backoff
              } else {
                throw new Error(
                  `Upload failed at ${progress}%.\n\n` +
                  `Try again on WiFi or with a smaller export file.`
                );
              }
            }
          }
        }
        
        // Complete and process
        setImportProgress('Processing your data...\nThis may take a few minutes');
        const completeRes = await fetch('/api/data-import/chunked/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ uploadId }),
        });
        
        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({}));
          throw new Error(err.error || 'Processing failed');
        }
        
        const result = await completeRes.json();
        
        if (result.success) {
          setImportProgress('Import complete! ✓');
          // Refresh conversations
          const projectQuery = selectedProject ? `?project_id=${selectedProject}` : '';
          fetch(`/api/conversations${projectQuery}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => setConversations(Array.isArray(data) ? data : []));
          
          setTimeout(() => {
            setShowImportSheet(false);
            setIsImporting(false);
            setImportProgress('');
          }, 2000);
        } else {
          throw new Error(result.error || 'Import failed');
        }
        
      } else {
        // Small files: direct upload
        setImportProgress('Uploading file...');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'auto');
        
        const res = await fetch('/api/imports/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed');
        }
        
        if (data.jobId) {
          // Async processing - poll for status
          setImportProgress('Processing your data...');
          
          let attempts = 0;
          const maxAttempts = 60;
          
          const checkStatus = async () => {
            try {
              const statusRes = await fetch(`/api/imports/status?jobId=${data.jobId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const statusData = await statusRes.json();
              
              if (statusData.status === 'completed') {
                setImportProgress('Import complete! ✓');
                const projectQuery = selectedProject ? `?project_id=${selectedProject}` : '';
                fetch(`/api/conversations${projectQuery}`, { headers: { Authorization: `Bearer ${token}` } })
                  .then(r => r.json())
                  .then(data => setConversations(Array.isArray(data) ? data : []));
                
                setTimeout(() => {
                  setShowImportSheet(false);
                  setIsImporting(false);
                  setImportProgress('');
                }, 2000);
                return;
              } else if (statusData.status === 'failed') {
                throw new Error(statusData.error || 'Import processing failed');
              } else if (attempts < maxAttempts) {
                attempts++;
                setImportProgress(`Processing... ${Math.round((attempts/maxAttempts)*100)}%`);
                setTimeout(checkStatus, 2000);
              } else {
                setImportProgress('Processing in background. Check back later!');
                setTimeout(() => {
                  setShowImportSheet(false);
                  setIsImporting(false);
                  setImportProgress('');
                }, 3000);
              }
            } catch (e) {
              setImportProgress('Processing in background!');
              setTimeout(() => {
                setShowImportSheet(false);
                setIsImporting(false);
                setImportProgress('');
              }, 2000);
            }
          };
          
          setTimeout(checkStatus, 2000);
        } else {
          setImportProgress('Upload complete!');
          setTimeout(() => {
            setShowImportSheet(false);
            setIsImporting(false);
            setImportProgress('');
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportProgress('Error: ' + err.message);
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress('');
      }, 3000);
    }
  };

  // Edit message
  const handleEditMessage = async (message, newContent) => {
    if (!newContent.trim()) return;
    try {
      await fetch('/api/chat/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: message.id, content: newContent.trim() }),
      });
      setMessages(prev => prev.map(m => 
        m.id === message.id ? { ...m, content: newContent.trim() } : m
      ));
    } catch (err) {
      console.error('Edit error:', err);
    }
    setEditingMessage(null);
  };

  // Dismiss announcement (24-hour dismiss or permanent)
  const dismissAnnouncement = async (announcementId, permanent = false) => {
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
  };

  // Track announcement click
  const trackAnnouncementClick = (announcementId) => {
    fetch('/api/announcements/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ announcementId }),
    }).catch(() => {});
  };

  // Save display name
  const saveDisplayName = async () => {
    if (!editingDisplayName.trim()) return;
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: editingDisplayName.trim() }),
      });
      setProfile(p => ({ ...p, display_name: editingDisplayName.trim() }));
      setShowEditNameSheet(false);
      setEditingDisplayName('');
    } catch (e) {
      console.error('Failed to update name:', e);
    }
  };

  // Open edit name sheet
  const openEditNameSheet = () => {
    setEditingDisplayName(profile?.display_name || user?.profile?.display_name || '');
    setShowEditNameSheet(true);
  };

  // Group models by provider
  const groupedModels = MODELS.reduce((acc, model) => {
    if (!acc[model.group]) acc[model.group] = [];
    acc[model.group].push(model);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-sp-black text-white">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={ACCEPTED_FILE_TYPES}
        multiple
        className="hidden"
      />

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div 
          className="flex flex-col bg-sp-black"
          style={{ 
            height: 'calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))',
            minHeight: 'calc(100vh - 4rem - env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* Header takes its natural height */}
          <ChatHeader 
            assistantName={assistantName}
            model={MODELS.find(m => m.value === selectedModel)?.label || selectedModel}
            onModelClick={() => setShowModelPicker(true)}
            isOnline={true}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
            onMoreClick={() => setShowMoreOptions(true)}
            inviteData={inviteData}
            onInviteClick={() => setShowInviteSheet(true)}
          />
          
          {/* Scrollable Messages Area - takes remaining space */}
          <div 
            className="flex-1 overflow-y-auto"
            style={{ 
              paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))',
              paddingBottom: '6rem'  /* Space for fixed input bar */
            }}
          >
            {/* Announcements Banner */}
            {announcements.length > 0 && (
              <div className="px-3 pt-2 pb-1">
              {announcements.slice(0, 2).map(ann => (
                <div 
                  key={ann.id}
                  className={`mb-2 p-3 rounded-xl border ${
                    ann.type === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
                    ann.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                    ann.type === 'update' ? 'bg-blue-500/10 border-blue-500/30' :
                    'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ann.type === 'warning' ? 'bg-orange-500/20' :
                      ann.type === 'success' ? 'bg-green-500/20' :
                      ann.type === 'update' ? 'bg-blue-500/20' :
                      'bg-blue-500/20'
                    }`}>
                      <SparklesIcon className={`w-4 h-4 ${
                        ann.type === 'warning' ? 'text-orange-400' :
                        ann.type === 'success' ? 'text-green-400' :
                        ann.type === 'update' ? 'text-blue-400' :
                        'text-blue-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{ann.title}</p>
                      <p className="text-gray-400 text-xs mt-1">{ann.content}</p>
                      {ann.link && (
                        <a 
                          href={ann.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={() => trackAnnouncementClick(ann.id)}
                          className="text-xs text-blue-400 flex items-center gap-1 mt-2"
                        >
                          Learn more <ChevronRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-white/5">
                    <button 
                      onClick={() => dismissAnnouncement(ann.id, false)} 
                      className="px-3 py-1.5 bg-white/5 text-gray-300 text-xs rounded-lg"
                    >
                      Remind Later
                    </button>
                    <button 
                      onClick={() => dismissAnnouncement(ann.id, true)} 
                      className="px-3 py-1.5 text-gray-500 text-xs rounded-lg"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
            {/* PWA Install Prompt Banner - Mobile */}
            {showInstallPrompt && (
              <div className="px-3 py-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Download className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium">Add to Home Screen</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    Quick access! <span className="text-green-400">Safe shortcut</span>, no download needed.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => handleInstallAction('install')}
                      className="px-2.5 py-1 bg-green-500 text-white text-[10px] font-medium rounded-lg"
                    >
                      Install
                    </button>
                    <button 
                      onClick={() => handleInstallAction('remind_later')}
                      className="px-2.5 py-1 bg-white/5 text-gray-300 text-[10px] rounded-lg"
                    >
                      Later
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => handleInstallAction('dismiss_forever')}
                  className="text-gray-500 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            )}
          
            {/* Messages */}
            <div className="px-2 pb-4">
              {messages.map((msg, idx) => (
                <MessageBubble 
                  key={msg.id || idx} 
                  message={msg} 
                  isUser={msg.role === 'user'}
                  assistantName={assistantName}
                  onFeedback={handleFeedback}
                  token={token}
                  onImageEdit={(imageData) => {
                    setEditableImage(imageData);
                    setShowImageEditor(true);
                  }}
                  onMaskEdit={(url) => {
                    setMaskEditImageUrl(url);
                    setShowMaskEditor(true);
                  }}
                />
              ))}
              
              {/* Streaming message */}
              {streamingContent && (
                <MessageBubble 
                  message={{ content: streamingContent }}
                  isUser={false}
                  assistantName={assistantName}
                />
              )}
              
              {/* Loading indicator */}
              {loading && !streamingContent && (
                <div className="flex justify-start mb-4 px-4">
                  <div className="bg-white/5 rounded-3xl px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Visual Content Generating Indicator */}
              {isGeneratingVisual && (
                <div className="py-3">
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 p-4">
                    {/* Animated background shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                    
                    {/* Content */}
                    <div className="relative flex items-center gap-3">
                      {/* Animated icon */}
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                        </div>
                        {/* Spinning ring */}
                        <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
                      </div>
                      
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm mb-0.5">
                          {visualGenerationType === 'infographic' ? '📊 Creating your infographic...' :
                           visualGenerationType === 'flyer' ? '📄 Designing your flyer...' :
                           visualGenerationType === 'poster' ? '🖼️ Creating your poster...' :
                           visualGenerationType === 'edit' ? '✏️ Editing your image...' :
                           visualGenerationType === 'video' ? '🎬 Generating your video...' :
                           '✨ Generating your image...'}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {visualGenerationType === 'video' 
                            ? 'This may take 1-3 minutes' 
                            : 'This may take 15-30 seconds'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress animation */}
                    <div className="mt-3 relative h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full animate-progress" />
                    </div>
                    
                    {/* Progress dots */}
                    <div className="flex justify-center gap-1.5 mt-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}
      
      {/* Input Area - FIXED above tab bar (only shown on chat tab) */}
      {activeTab === 'chat' && (
        <div 
          ref={inputContainerRef}
          className="fixed left-0 right-0 bg-sp-black border-t border-white/10 px-3 py-3"
          style={{ 
            bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
            zIndex: 60,
          }}
        >
            {/* Attachment Preview - show uploaded files */}
            {(attachments.length > 0 || isProcessingFile) && (
              <div className="mb-3 px-1 animate-in slide-in-from-bottom-2 duration-200">
                <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center">
                      {isProcessingFile ? (
                        <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-orange-400" />
                      )}
                    </div>
                    <span className="text-orange-400 text-xs font-medium">
                      {isProcessingFile 
                        ? 'Processing file...' 
                        : `${attachments.length} file${attachments.length > 1 ? 's' : ''} attached`}
                    </span>
                  </div>
                  
                  {attachments.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {attachments.map((att, idx) => (
                        <div key={idx} className="relative flex-shrink-0 group">
                          {att.type === 'image' ? (
                            <div className="relative">
                              <img 
                                src={`data:${att.mimeType};base64,${att.base64}`} 
                                alt={att.name} 
                                className="w-20 h-20 object-cover rounded-xl border-2 border-orange-500/40 shadow-lg" 
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl px-1.5 py-1">
                                <span className="text-[9px] text-white truncate block font-medium">{att.name}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-20 h-20 bg-white/10 border-2 border-orange-500/40 rounded-xl flex flex-col items-center justify-center p-2 shadow-lg">
                              <FileText className="w-6 h-6 text-orange-400" />
                              <span className="text-[9px] text-gray-300 truncate w-full text-center mt-1 font-medium">{att.name}</span>
                            </div>
                          )}
                          <button 
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-[10px] text-orange-300/70 mt-2">
                    Ready to send with your message • Tap × to remove
                  </p>
                </div>
              </div>
            )}

            {/* Media Intent Detection Banner */}
            {detectedMediaIntent && showMediaOptions && (
              <div className="mb-3 media-intent-banner">
                <div className="bg-gradient-to-r from-orange-500/20 to-purple-500/20 border border-orange-500/30 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {detectedMediaIntent === 'image' ? (
                        <ImageIcon className="w-5 h-5 text-orange-400" />
                      ) : (
                        <Video className="w-5 h-5 text-purple-400" />
                      )}
                      <span className="text-white text-sm font-medium">
                        {detectedMediaIntent === 'image' ? '🎨 Image generation detected' : '🎬 Video generation detected'}
                      </span>
                    </div>
                    <button 
                      onClick={() => setShowMediaOptions(false)}
                      className="text-gray-500 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Quick Options */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">Aspect:</span>
                      <div className="flex gap-1 flex-wrap">
                        {[
                          { value: '1:1', label: '1:1' },
                          { value: '16:9', label: '16:9' },
                          { value: '9:16', label: '9:16' },
                        ].map(ratio => (
                          <button
                            key={ratio.value}
                            onClick={() => setQuickAspectRatio(ratio.value)}
                            className={`px-2 py-1 text-xs rounded-lg transition-all ${
                              quickAspectRatio === ratio.value
                                ? 'bg-orange-500 text-white'
                                : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                          >
                            {ratio.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Video-specific options */}
                    {detectedMediaIntent === 'video' && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">Length:</span>
                        <div className="flex gap-1">
                          {['5', '10'].map(len => (
                            <button
                              key={len}
                              onClick={() => setQuickVideoLength(len)}
                              className={`px-2 py-1 text-xs rounded-lg transition-all ${
                                quickVideoLength === len
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
                              }`}
                            >
                              {len}s
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Advanced toggle */}
                    <button
                      onClick={() => setMediaOptionsExpanded(!mediaOptionsExpanded)}
                      className="text-gray-500 text-xs flex items-center gap-1 hover:text-gray-300"
                    >
                      <ChevronRight className={`w-3 h-3 transition-transform ${mediaOptionsExpanded ? 'rotate-90' : ''}`} />
                      Advanced options
                    </button>
                    
                    {/* Advanced Options Panel */}
                    {mediaOptionsExpanded && (
                      <div className="mt-2 p-2 bg-white/5 rounded-xl media-options-panel">
                        <div className="text-gray-400 text-xs mb-2">Model:</div>
                        <div className="flex flex-wrap gap-1">
                          {(detectedMediaIntent === 'image' ? IMAGE_MODELS : VIDEO_MODELS).slice(0, 4).map(model => (
                            <button
                              key={model.value}
                              onClick={() => detectedMediaIntent === 'image' 
                                ? setSelectedImageModel(model.value) 
                                : setSelectedVideoModel(model.value)
                              }
                              className={`px-2 py-1 text-xs rounded-lg transition-all ${
                                (detectedMediaIntent === 'image' ? selectedImageModel : selectedVideoModel) === model.value
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
                              }`}
                            >
                              {model.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={generateMediaWithOptions}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <SparklesIcon className="w-4 h-4" />
                      Generate {detectedMediaIntent === 'image' ? 'Image' : 'Video'}
                    </button>
                    <button
                      onClick={sendAsChat}
                      className="bg-white/10 hover:bg-white/20 text-gray-300 py-2 px-3 rounded-xl text-sm transition-colors"
                    >
                      Just Chat
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Interim speech text */}
            {interimText && (
              <div className="text-gray-500 text-sm mb-2 px-2 italic">{interimText}</div>
            )}
            <div className="flex items-end gap-2">
              <button 
                onClick={() => setShowAttachmentSheet(true)}
                className="p-3 text-gray-500 hover:text-orange-400 transition-colors flex-shrink-0"
              >
                <Plus className="w-6 h-6" />
              </button>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl px-4 py-2.5 flex items-center gap-2 min-w-0">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (detectedMediaIntent && showMediaOptions) {
                        generateMediaWithOptions();
                      } else {
                        sendMessage();
                      }
                    }
                  }}
                  onFocus={() => {
                    // Scroll into view on focus for iOS
                    setTimeout(() => {
                      inputContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }, 300);
                  }}
                  placeholder="Message..."
                  className="flex-1 bg-transparent text-white text-[16px] placeholder-gray-600 focus:outline-none resize-none min-h-[28px] max-h-[100px] min-w-0 leading-normal"
                  rows={1}
                  disabled={loading}
                  style={{ fontSize: '16px', lineHeight: '1.4' }} // Prevent iOS zoom on focus
                />
                {/* Voice input button */}
                <button 
                  onClick={speech.toggle}
                  title={speech.error || (speech.isListening ? 'Stop recording' : 'Voice input')}
                  className={`p-2 rounded-full transition-all flex-shrink-0 ${
                    speech.isListening 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : speech.error 
                        ? 'text-red-400 hover:text-red-300'
                        : 'text-gray-500 hover:text-orange-400'
                  }`}
                >
                  <MicrophoneIcon className="w-5 h-5" />
                </button>
                {/* Voice conversation button */}
                {onOpenVoiceChat && (
                  <button 
                    onClick={onOpenVoiceChat}
                    title="Voice conversation"
                    className="p-2 rounded-full transition-all flex-shrink-0 text-gray-500 hover:text-green-400"
                  >
                    <AudioWaveform className="w-5 h-5" />
                  </button>
                )}
                {/* Show Stop button when loading, otherwise show Send button */}
                {loading ? (
                  <button 
                    onClick={stopRequest}
                    className="p-2 rounded-full bg-red-500 text-white transition-all animate-pulse flex-shrink-0"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      if (detectedMediaIntent && showMediaOptions) {
                        generateMediaWithOptions();
                      } else {
                        sendMessage();
                      }
                    }}
                    disabled={!input.trim() && !attachments.length}
                    className={`p-2 rounded-full transition-all flex-shrink-0 ${
                      input.trim() || attachments.length
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/5 text-gray-600'
                    }`}
                  >
                    <SendIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="pt-4 pb-24">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedProject && (
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h1 className="text-xl font-semibold text-white">
                {selectedProject 
                  ? (selectedProject === 'general' 
                      ? 'Uncategorized' 
                      : projects.find(p => p.id === selectedProject)?.name || 'Project')
                  : 'Projects & Chats'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {!selectedProject && (
                <button 
                  onClick={() => {
                    setProjectSheetMode('create');
                    setNewProjectName('');
                    setNewProjectDescription('');
                    setEditingProject(null);
                    setShowProjectSheet(true);
                  }}
                  className="p-2 rounded-full bg-white/5 text-gray-400 hover:bg-white/10"
                  title="New Project"
                >
                  <FolderPlus className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={newConversation}
                className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> New Chat
              </button>
            </div>
          </div>
          
          {/* Search bar */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                placeholder={selectedProject ? "Search conversations..." : "Search projects & chats..."}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500/40 outline-none"
              />
              {conversationSearch && (
                <button
                  onClick={() => setConversationSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="mt-2">
            {!selectedProject ? (
              // Show Projects List
              <>
                {/* Projects */}
                {projects.length > 0 && (
                  <div className="mb-4">
                    <p className="px-4 text-xs text-gray-500 uppercase tracking-wider mb-2">Projects</p>
                    {projects
                      .filter(p => !conversationSearch || p.name.toLowerCase().includes(conversationSearch.toLowerCase()))
                      .map(project => (
                        <button
                          key={project.id}
                          onClick={() => setSelectedProject(project.id)}
                          className="w-full text-left p-4 border-b border-white/5 hover:bg-white/5 active:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <Folder className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm text-white truncate">{project.name}</h3>
                                {project.is_shared && (
                                  <Users className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-gray-500 text-xs truncate mt-0.5">
                                {project.conversation_count || 0} conversations
                                {project.description && ` · ${project.description}`}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          </div>
                        </button>
                      ))}
                  </div>
                )}
                
                {/* Uncategorized */}
                <button
                  onClick={() => setSelectedProject('general')}
                  className="w-full text-left p-4 border-b border-white/5 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-white">Uncategorized</h3>
                      <p className="text-gray-500 text-xs mt-0.5">
                        Chats not in any project
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </div>
                </button>
                
                {/* Recent Conversations (when no search) */}
                {!conversationSearch && conversations.length > 0 && (
                  <div className="mt-4">
                    <p className="px-4 text-xs text-gray-500 uppercase tracking-wider mb-2">Recent Chats</p>
                    {conversations.slice(0, 5).map(conv => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === conversationId}
                        onClick={() => loadConversation(conv.id)}
                        onDelete={deleteConversation}
                        onRename={openRenameModal}
                        onMove={openMoveToProjectSheet}
                      />
                    ))}
                    {conversations.length > 5 && (
                      <button 
                        onClick={() => setSelectedProject('general')}
                        className="w-full p-3 text-center text-orange-400 text-sm hover:bg-white/5"
                      >
                        View all {conversations.length} conversations →
                      </button>
                    )}
                  </div>
                )}
                
                {/* Empty state */}
                {projects.length === 0 && conversations.length === 0 && (
                  <div className="text-center py-12 px-4">
                    <Folder className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No projects or chats yet</p>
                    <button 
                      onClick={newConversation}
                      className="mt-4 text-orange-400 text-sm font-medium"
                    >
                      Start your first chat →
                    </button>
                  </div>
                )}
              </>
            ) : (
              // Show Conversations in Selected Project
              <>
                {/* Project actions (if viewing a specific project, not general) */}
                {selectedProject !== 'general' && (
                  <div className="px-4 pb-3 flex items-center gap-2">
                    <button
                      onClick={() => openEditProjectSheet(projects.find(p => p.id === selectedProject))}
                      className="flex-1 py-2 px-3 rounded-lg bg-white/5 text-gray-300 text-sm flex items-center justify-center gap-2 hover:bg-white/10"
                    >
                      <Edit3 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => openShareProjectSheet(projects.find(p => p.id === selectedProject))}
                      className="flex-1 py-2 px-3 rounded-lg bg-purple-500/20 text-purple-400 text-sm flex items-center justify-center gap-2 hover:bg-purple-500/30"
                    >
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                    <button
                      onClick={() => deleteProject(selectedProject)}
                      className="py-2 px-3 rounded-lg bg-red-500/10 text-red-400 text-sm flex items-center justify-center gap-2 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {/* Conversations list */}
                {conversations.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                      {selectedProject === 'general' ? 'No uncategorized chats' : 'No conversations in this project'}
                    </p>
                    <button 
                      onClick={newConversation}
                      className="mt-4 text-orange-400 text-sm font-medium"
                    >
                      Start a new chat →
                    </button>
                  </div>
                ) : (
                  (() => {
                    const filteredConversations = conversationSearch.trim()
                      ? conversations.filter(c => 
                          (c.title || 'Conversation').toLowerCase().includes(conversationSearch.toLowerCase())
                        )
                      : conversations;
                    
                    return filteredConversations.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <Search className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No matching conversations</p>
                        <button 
                          onClick={() => setConversationSearch('')}
                          className="mt-4 text-orange-400 text-sm font-medium"
                        >
                          Clear search
                        </button>
                      </div>
                    ) : (
                      filteredConversations.map(conv => (
                        <ConversationItem
                          key={conv.id}
                          conversation={conv}
                          isActive={conv.id === conversationId}
                          onClick={() => loadConversation(conv.id)}
                          onDelete={deleteConversation}
                          onRename={openRenameModal}
                          onMove={openMoveToProjectSheet}
                        />
                      ))
                    );
                  })()
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <ProfileView 
          profile={{ 
            ...profile, 
            display_name: profile?.display_name || user?.profile?.display_name || user?.email?.split('@')[0],
            email: user?.email 
          }}
          soulPrint={{
            messageCount: conversations.reduce((sum, c) => sum + (c.message_count || 0), 0),
            conversationCount: conversations.length,
            daysActive: conversations.length > 0 ? Math.ceil((Date.now() - new Date(conversations[conversations.length - 1]?.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) : 0,
            ...soulPrint
          }}
          onSettingsClick={onOpenSettings}
          isAdmin={user?.role === 'admin' || user?.role === 'superadmin'}
          onAdminClick={() => window.location.href = '/admin'}
          announcements={announcements}
          onAnnouncementsClick={() => setShowAnnouncements(true)}
          onEditName={openEditNameSheet}
          inviteData={inviteData}
          onInviteClick={() => setShowInviteSheet(true)}
          onImportClick={() => setShowImportSheet(true)}
        />
      )}

      {/* Edit Display Name Sheet */}
      {showEditNameSheet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowEditNameSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="text-white font-semibold text-lg mb-2">Edit Your Name</h3>
            <p className="text-gray-500 text-sm mb-4">This is how the AI will address you</p>
            <input
              type="text"
              value={editingDisplayName}
              onChange={(e) => setEditingDisplayName(e.target.value)}
              placeholder="Enter your preferred name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white mb-4 focus:border-orange-500/50 outline-none"
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowEditNameSheet(false)}
                className="flex-1 py-3 bg-white/5 text-gray-300 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={saveDisplayName}
                disabled={!editingDisplayName.trim()}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends Sheet */}
      {showInviteSheet && inviteData?.enabled && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowInviteSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">🎟️</span>
              </div>
              <h3 className="text-white font-semibold text-xl mb-1">Invite Friends</h3>
              <p className="text-gray-500 text-sm">Share SoulPrint with people you care about</p>
            </div>
            
            {/* Invites Remaining */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Invites Remaining</span>
                <span className="text-purple-400 font-bold text-2xl">{inviteData.invites_remaining}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${(inviteData.invites_remaining / 5) * 100}%` }}
                />
              </div>
            </div>
            
            {/* Invite Link */}
            <div className="mb-6">
              <label className="text-gray-400 text-xs font-medium mb-2 block">Your Invite Link</label>
              <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inviteData.invite_code}`}
                  className="flex-1 bg-transparent text-white text-sm truncate outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteData.invite_code}`);
                    setInviteCopied(true);
                    setTimeout(() => setInviteCopied(false), 2000);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    inviteCopied 
                      ? 'bg-green-500 text-white' 
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  {inviteCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            
            {/* Invite Code */}
            <div className="mb-6">
              <label className="text-gray-400 text-xs font-medium mb-2 block">Or Share Your Code</label>
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-white font-mono text-2xl tracking-widest">{inviteData.invite_code}</p>
              </div>
            </div>
            
            {/* Share Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                onClick={() => {
                  const text = `Join me on SoulPrint - your personal AI companion! Use my invite link: ${window.location.origin}/invite/${inviteData.invite_code}`;
                  if (navigator.share) {
                    navigator.share({ text });
                  } else {
                    navigator.clipboard.writeText(text);
                    alert('Link copied to clipboard!');
                  }
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
              >
                <span className="text-2xl">📤</span>
                <span className="text-gray-400 text-xs">Share</span>
              </button>
              <button
                onClick={() => {
                  const text = encodeURIComponent(`Join me on SoulPrint! ${window.location.origin}/invite/${inviteData.invite_code}`);
                  window.open(`https://wa.me/?text=${text}`, '_blank');
                }}
                className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
              >
                <span className="text-2xl">💬</span>
                <span className="text-green-400 text-xs">WhatsApp</span>
              </button>
              <button
                onClick={() => {
                  const text = encodeURIComponent(`Join me on SoulPrint - your personal AI companion! ${window.location.origin}/invite/${inviteData.invite_code}`);
                  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
                }}
                className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
              >
                <span className="text-2xl">𝕏</span>
                <span className="text-blue-400 text-xs">Twitter/X</span>
              </button>
            </div>
            
            {/* Badges Section */}
            {inviteData.all_badges?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-gray-400 text-xs font-medium mb-3">Invite Badges</h4>
                <div className="grid grid-cols-2 gap-2">
                  {inviteData.all_badges.map((badge) => {
                    const earned = inviteData.badges?.some(b => b.id === badge.id);
                    return (
                      <div 
                        key={badge.id}
                        className={`p-3 rounded-xl border transition-colors ${
                          earned 
                            ? 'bg-purple-500/10 border-purple-500/30' 
                            : 'bg-white/5 border-white/10 opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{badge.icon}</span>
                          <span className={`text-sm font-medium ${earned ? 'text-purple-400' : 'text-gray-500'}`}>
                            {badge.name}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs">{badge.description}</p>
                        {!earned && (
                          <p className="text-gray-600 text-[10px] mt-1">Invite {badge.threshold} friend{badge.threshold > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* People You've Invited */}
            {inviteData.invited_users?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-gray-400 text-xs font-medium mb-3">People You've Invited ({inviteData.invites_used})</h4>
                <div className="space-y-2">
                  {inviteData.invited_users.map((user, idx) => (
                    <div key={idx} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-400" />
                        </div>
                        <span className="text-white text-sm">{user.email}</span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(user.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Invited By */}
            {inviteData.invited_by && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-xs mb-1">You were invited by</p>
                <p className="text-white font-medium">{inviteData.invited_by.name}</p>
              </div>
            )}
            
            <button 
              onClick={() => setShowInviteSheet(false)}
              className="w-full mt-6 py-3 bg-white/5 text-gray-400 rounded-xl text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Announcements View */}
      <AnnouncementsView
        isOpen={showAnnouncements}
        onClose={() => setShowAnnouncements(false)}
        announcements={announcements}
      />

      {/* Tab Bar */}
      <TabBar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        assistantName={assistantName}
      />

      {/* Model Picker Modal */}
      {showModelPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowModelPicker(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="text-white font-semibold text-lg mb-4">Select Model</h3>
            
            {/* Dynamic Intelligence - Featured at top */}
            <div className="mb-4">
              <button
                onClick={() => { 
                  setSelectedModel('smart'); 
                  setShowModelPicker(false); 
                }}
                className={`w-full p-4 rounded-xl text-left transition-colors ${
                  selectedModel === 'smart'
                    ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/50'
                    : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-semibold text-sm flex items-center gap-2 ${selectedModel === 'smart' ? 'text-purple-400' : 'text-white'}`}>
                      🧠 Dynamic Intelligence
                      {selectedModel === 'smart' && <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full">Active</span>}
                    </span>
                    <p className="text-gray-400 text-xs mt-1">AI automatically picks the best model for your query</p>
                  </div>
                </div>
                {lastSmartSelection && selectedModel === 'smart' && (
                  <div className="mt-2 text-[10px] text-gray-500">
                    Last used: {lastSmartSelection.model}
                  </div>
                )}
              </button>
            </div>
            
            <div className="border-t border-white/10 my-4"></div>
            
            {Object.entries(groupedModels).filter(([group]) => group !== 'Smart').map(([group, models]) => (
              <div key={group} className="mb-4">
                <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2 px-2">{group}</h4>
                <div className="space-y-1">
                  {models.map(model => (
                    <button
                      key={model.value}
                      onClick={() => { 
                        if (!model.comingSoon) {
                          setSelectedModel(model.value); 
                          setShowModelPicker(false); 
                        }
                      }}
                      disabled={model.comingSoon}
                      className={`w-full p-3 rounded-xl text-left transition-colors flex items-center justify-between ${
                        model.comingSoon 
                          ? 'bg-white/5 opacity-50 cursor-not-allowed'
                          : selectedModel === model.value
                            ? 'bg-orange-500/15 border border-orange-500/30'
                            : 'bg-white/5 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      <span className={`font-medium text-sm ${selectedModel === model.value ? 'text-orange-400' : 'text-white'}`}>
                        {model.label}
                      </span>
                      {model.comingSoon && (
                        <span className="text-[10px] text-gray-500 bg-white/10 px-2 py-0.5 rounded-full">Soon</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button 
              onClick={() => setShowModelPicker(false)}
              className="w-full mt-4 p-4 text-gray-500 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* More Options Sheet */}
      <MoreOptionsSheet 
        isOpen={showMoreOptions}
        onClose={() => setShowMoreOptions(false)}
        onSettings={onOpenSettings}
      />

      {/* Create Options Sheet (+ button) */}
      <CreateOptionsSheet 
        isOpen={showAttachmentSheet}
        onClose={() => setShowAttachmentSheet(false)}
        onFileSelect={() => fileInputRef.current?.click()}
        onCameraSelect={() => {
          // Create a camera-specific file input
          const cameraInput = document.createElement('input');
          cameraInput.type = 'file';
          cameraInput.accept = 'image/*';
          cameraInput.capture = 'environment';
          cameraInput.onchange = handleFileSelect;
          cameraInput.click();
        }}
        onImageGen={() => setShowImageGenSheet(true)}
        onVideoGen={() => setShowVideoGenSheet(true)}
        onCompare={() => setShowCompareMode(true)}
        onGallery={() => { loadGallery(); setShowGallery(true); }}
        onNewConversation={newConversation}
      />

      {/* Image Generation Sheet */}
      <ImageGenSheet
        isOpen={showImageGenSheet}
        onClose={() => setShowImageGenSheet(false)}
        models={IMAGE_MODELS}
        selectedModel={selectedImageModel}
        onModelChange={setSelectedImageModel}
        aspectRatios={ASPECT_RATIOS}
        selectedAspect={selectedAspectRatio}
        onAspectChange={setSelectedAspectRatio}
        prompt={mediaPrompt}
        onPromptChange={setMediaPrompt}
        onGenerate={handleMediaGenerate}
        isGenerating={isGeneratingMedia}
      />

      {/* Video Generation Sheet */}
      <VideoGenSheet
        isOpen={showVideoGenSheet}
        onClose={() => setShowVideoGenSheet(false)}
        models={VIDEO_MODELS}
        selectedModel={selectedVideoModel}
        onModelChange={setSelectedVideoModel}
        prompt={mediaPrompt}
        onPromptChange={setMediaPrompt}
        onGenerate={handleMediaGenerate}
        isGenerating={isGeneratingMedia}
      />

      {/* Flyer Generation Sheet */}
      <FlyerGenSheet
        isOpen={showFlyerGenSheet}
        onClose={() => setShowFlyerGenSheet(false)}
        onGenerate={handleFlyerGenerate}
        isGenerating={isGeneratingMedia}
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={showRenameModal}
        onClose={() => { setShowRenameModal(false); setRenamingConversation(null); }}
        title={renameTitle}
        onTitleChange={setRenameTitle}
        onSave={renameConversation}
      />

      {/* Gallery View */}
      <GalleryView
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        items={galleryItems}
        token={token}
        onDeleteItem={(deletedId) => {
          setGalleryItems(prev => prev.filter(item => item.id !== deletedId));
        }}
        onRegenerate={() => {
          // Refresh gallery after regeneration
          setTimeout(() => loadGallery(), 2000);
        }}
      />

      {/* Compare Mode Sheet */}
      <CompareModeSheet
        isOpen={showCompareMode}
        onClose={() => setShowCompareMode(false)}
        models={MODELS}
        selectedModels={compareModels}
        onToggleModel={(model) => {
          setCompareModels(prev => 
            prev.includes(model) 
              ? prev.filter(m => m !== model)
              : [...prev, model]
          );
        }}
        onCompare={handleCompare}
      />

      {/* Compare Results View */}
      <CompareResultsView
        responses={compareResponses}
        onSelect={selectCompareResponse}
        onClose={() => setCompareResponses(null)}
      />

      {/* Import Sheet */}
      <ImportSheet
        isOpen={showImportSheet}
        onClose={() => { setShowImportSheet(false); setIsImporting(false); setImportProgress(''); }}
        onImport={handleImport}
        isUploading={isImporting}
        uploadProgress={importProgress}
      />

      {/* Location Sheet - Manual Input */}
      {showLocationSheet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowLocationSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            
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
            <div className="space-y-3">
              <input
                type="text"
                value={manualLocationInput}
                onChange={(e) => setManualLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveManualLocation()}
                placeholder="City, address, or zip code..."
                className="w-full bg-sp-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40"
                autoFocus
              />
              <p className="text-gray-500 text-xs">Example: "San Francisco, CA" or "90210"</p>
              
              {/* Try Again Button */}
              <button
                onClick={() => {
                  setLocationError(null);
                  requestLocation();
                }}
                disabled={locationLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:border-white/20 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${locationLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm">Try automatic location</span>
              </button>
            </div>
            
            {/* Current Location Display */}
            {userLocation && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-gray-400 text-xs mb-1">Current saved location:</p>
                <p className="text-green-400 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {userLocation.address}
                </p>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLocationSheet(false);
                  setManualLocationInput('');
                  setLocationError(null);
                }}
                className="flex-1 py-3 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveManualLocation}
                disabled={locationLoading || !manualLocationInput.trim()}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          </div>
        </div>
      )}

      {/* Project Sheet (Create/Edit/Share) */}
      {showProjectSheet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowProjectSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            
            {projectSheetMode === 'create' && (
              <>
                <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-purple-400" /> New Project
                </h3>
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none resize-none mb-4"
                />
                <button
                  onClick={createProject}
                  disabled={!newProjectName.trim()}
                  className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Create Project
                </button>
              </>
            )}
            
            {projectSheetMode === 'edit' && (
              <>
                <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-orange-400" /> Edit Project
                </h3>
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500/40 outline-none resize-none mb-4"
                />
                <button
                  onClick={updateProject}
                  disabled={!newProjectName.trim()}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Save Changes
                </button>
              </>
            )}
            
            {projectSheetMode === 'share' && (
              <>
                <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-purple-400" /> Share "{editingProject?.name}"
                </h3>
                
                {/* Share link */}
                {projectShareLink?.code && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-purple-400 text-sm mb-2">
                      <Link2 className="w-4 h-4" /> Share Link
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-gray-400 truncate">
                        {window.location.origin}/join/{projectShareLink.code}
                      </code>
                      <button
                        onClick={copyShareLink}
                        className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-400 text-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Invite by email */}
                <p className="text-gray-400 text-sm mb-2">Invite by email</p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="Enter email"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none"
                  />
                  <select
                    value={shareRole}
                    onChange={(e) => setShareRole(e.target.value)}
                    className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-3 text-white text-sm cursor-pointer"
                  >
                    <option value="viewer" className="bg-[#1a1a1a] text-white">Viewer</option>
                    <option value="collaborator" className="bg-[#1a1a1a] text-white">Collaborator</option>
                  </select>
                </div>
                <button
                  onClick={shareProjectWithUser}
                  disabled={!shareEmail.trim()}
                  className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Send Invite
                </button>
                
                {/* Current members */}
                {editingProject?.shared_with?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-gray-400 text-sm mb-2">Shared with</p>
                    {editingProject.shared_with.map((member, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm">{member.email || member.user_id}</p>
                          <p className="text-gray-500 text-xs capitalize">{member.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Move to Project Sheet */}
      {showMoveToProjectSheet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowMoveToProjectSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
              <Folder className="w-5 h-5 text-purple-400" /> Move to Project
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Moving: "{movingConversation?.title || 'Conversation'}"
            </p>
            
            {/* Project options */}
            <button
              onClick={() => moveConversationToProject(movingConversation.id, null)}
              className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors mb-2 flex items-center gap-3"
            >
              <MessageSquare className="w-5 h-5 text-gray-400" />
              <span className="text-white">Uncategorized</span>
            </button>
            
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => moveConversationToProject(movingConversation.id, project.id)}
                className={`w-full text-left p-4 rounded-xl transition-colors mb-2 flex items-center gap-3 ${
                  movingConversation?.project_id === project.id 
                    ? 'bg-purple-500/20 border border-purple-500/30' 
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <Folder className="w-5 h-5 text-purple-400" />
                <div className="flex-1">
                  <span className="text-white">{project.name}</span>
                  {project.description && (
                    <p className="text-gray-500 text-xs mt-0.5">{project.description}</p>
                  )}
                </div>
                {movingConversation?.project_id === project.id && (
                  <Check className="w-4 h-4 text-purple-400" />
                )}
              </button>
            ))}
            
            {projects.length === 0 && (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm mb-3">No projects yet</p>
                <button
                  onClick={() => {
                    setShowMoveToProjectSheet(false);
                    setProjectSheetMode('create');
                    setShowProjectSheet(true);
                  }}
                  className="text-purple-400 text-sm font-medium"
                >
                  Create your first project →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Onboarding Modal - What is a SoulPrint? */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#111820] border border-white/10 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-[#111820] border-b border-white/10 p-5 text-center">
              <div className="w-14 h-14 mx-auto bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-xl flex items-center justify-center mb-3 border border-orange-500/30">
                <span className="text-2xl">🧬</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Welcome to SoulPrint</h2>
              <p className="text-gray-500 text-xs">Your persistent AI identity layer</p>
            </div>
            
            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-300 leading-relaxed text-center">
                A SoulPrint is your <span className="text-orange-400 font-semibold">persistent AI identity layer</span>.
              </p>
              
              <div className="flex gap-2 justify-center">
                {['Not a chatbot', 'Not a wrapper', 'Not a plugin'].map((text, i) => (
                  <span key={i} className="bg-white/5 rounded-lg px-2 py-1 text-[10px] text-gray-500 line-through border border-white/5">
                    {text}
                  </span>
                ))}
              </div>
              
              <p className="text-gray-400 text-xs leading-relaxed">
                It's a mapped imprint of how you <span className="text-white">think</span>, <span className="text-white">decide</span>, <span className="text-white">react</span>, and <span className="text-white">communicate</span> — embedded into AI so it reflects <em>you</em>.
              </p>
              
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <p className="text-orange-300 font-medium mb-2 text-xs">Your SoulPrint captures:</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Decision style', 'Conflict response', 'Communication cadence', 'Pattern recognition'].map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-orange-500 rounded-full"></span>
                      <span className="text-gray-300 text-[10px]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-sp-black rounded-xl text-xs">
                <span className="text-gray-500">🔄 Most AI resets</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span className="text-orange-400">✨ SoulPrint builds forever</span>
              </div>
              
              <p className="text-center text-xs text-gray-400 pt-2 border-t border-white/10">
                <span className="text-orange-400">In short:</span> The{' '}
                <span className="text-white font-medium">operating system of you</span> — running on AI.
              </p>
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-[#111820] border-t border-white/10 p-4">
              <button
                onClick={() => {
                  localStorage.setItem('sp_onboarding_seen', 'true');
                  setShowOnboarding(false);
                }}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all text-sm"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Mask Editor Modal */}
      {showMaskEditor && maskEditImageUrl && (
        <MaskEditor
          imageUrl={maskEditImageUrl}
          onClose={() => {
            setShowMaskEditor(false);
            setMaskEditImageUrl(null);
          }}
          onSave={handleMaskEditSave}
        />
      )}
      
      {/* Loading overlay for mask editing */}
      {isMaskEditing && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#111820] border border-white/10 rounded-2xl p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto mb-3" />
            <p className="text-white text-sm font-medium">Applying mask edit...</p>
            <p className="text-gray-400 text-xs mt-1">This may take a moment</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .safe-area-bottom {
          padding-bottom: max(env(safe-area-inset-bottom, 16px), 16px);
        }
        .safe-area-top {
          padding-top: env(safe-area-inset-top, 0);
        }
        .input-area-bottom {
          bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
        }
        .tab-bar-height {
          height: calc(4rem + env(safe-area-inset-bottom, 0px));
        }
        
        /* Mobile input area base styles */
        .mobile-input-area {
          padding: 12px 16px;
          transition: all 0.2s ease-out;
        }
        
        /* Ensure textarea text is always visible */
        .mobile-input-area textarea {
          -webkit-appearance: none;
          appearance: none;
          overflow-y: auto;
          overflow-x: hidden;
        }
        
        /* When keyboard is visible - ensure input stays above keyboard */
        @supports (height: 100dvh) {
          .mobile-input-area {
            /* Use dynamic viewport units when available */
          }
        }
        
        /* iOS specific: handle visual viewport */
        @supports (-webkit-touch-callout: none) {
          .mobile-input-area {
            /* iOS Safari specific adjustments */
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
        }
        
        /* Android Chrome fix for textarea visibility */
        @media screen and (-webkit-min-device-pixel-ratio: 0) {
          textarea {
            -webkit-text-fill-color: white;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
