'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Plus, Mic, Send, Settings, ChevronLeft, ThumbsUp, ThumbsDown,
  MessageSquare, X, ChevronDown, Loader2, FileText, Globe,
  Image as ImageIcon, Paperclip, Search, Video, Download, RefreshCw, Play,
  MapPin, Upload, MoreVertical, Pencil, Trash2, Check, MessageCircle, Megaphone, ExternalLink, Shield, Brain,
  GitCompare, CheckCircle2, Clock, Zap, Sparkles, Film, ImagePlus, Palette, GalleryHorizontal,
  Cloud, Link2, HardDrive, AlertCircle, FileArchive, Newspaper, ChevronRight, LogOut, Copy, Edit3
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import InstallPrompt from '@/app/components/InstallPrompt';

// Image Generation Models (sorted by cost - cheapest first)
const IMAGE_MODELS = [
  { value: 'seedream-5-lite', label: 'Seedream 5.0 Lite', provider: 'kie', cost: 5.5, costLabel: '$0.03', description: 'Fast & affordable' },
  { value: 'nano-banana', label: 'Nano Banana', provider: 'kie', cost: 10, costLabel: '$0.05', description: 'Gemini-powered' },
  { value: 'gpt4o-image', label: 'GPT-4o Image', provider: 'kie', cost: 20, costLabel: '$0.10', description: 'High quality text' },
  { value: 'flux-pro', label: 'Flux Pro', provider: 'kie', cost: 25, costLabel: '$0.13', description: 'Artistic styles' },
  { value: 'midjourney-v7', label: 'Midjourney V7', provider: 'kie', cost: 40, costLabel: '$0.20', description: 'Premium quality' },
  { value: 'gpt-image-1-5', label: 'GPT Image 1.5', provider: 'kie', cost: 50, costLabel: '$0.25', description: 'OpenAI flagship' },
];

// Video Generation Models (sorted by cost - cheapest first)
const VIDEO_MODELS = [
  { value: 'kling-3-720p', label: 'Kling 3.0 (720p)', provider: 'kie', cost: 20, costLabel: '$0.10/s', description: '5s, no audio' },
  { value: 'sora-2-stable', label: 'Sora 2 Stable', provider: 'kie', cost: 35, costLabel: '$0.18', description: '10s video' },
  { value: 'kling-2-6', label: 'Kling 2.6', provider: 'kie', cost: 55, costLabel: '$0.28', description: '5s with options' },
  { value: 'runway', label: 'Runway Gen-3', provider: 'kie', cost: 100, costLabel: '$0.50', description: 'Pro quality' },
  { value: 'wan-2-6', label: 'Wan 2.6', provider: 'kie', cost: 150, costLabel: '$0.75', description: '15s 1080p' },
];

const MODELS = [
  // OpenAI
  { value: 'gpt-4o',       label: 'GPT-4o',             provider: 'openai',      group: 'OpenAI' },
  { value: 'gpt-4o-mini',  label: 'GPT-4o Mini',        provider: 'openai',      group: 'OpenAI' },
  { value: 'gpt-4.1',      label: 'GPT-4.1',            provider: 'openai',      group: 'OpenAI' },
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

const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.md,.csv,.json,.docx';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Speech recognition hook ─────────────────────────────────────────────────
function useSpeechRecognition({ onTranscript, onInterim, token }) {
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState(null); // 'live' | 'whisper'

  const hasNativeSpeech = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function startLive() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e) => {
      const interim = Array.from(e.results).map(r => r[0].transcript).join('');
      const final = Array.from(e.results).filter(r => r.isFinal).map(r => r[0].transcript).join('');
      if (final) onTranscript(final);
      else onInterim(interim);
    };
    rec.onerror = (e) => { console.error('Speech error', e); setIsListening(false); };
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    setMode('live');
  }

  async function startWhisper() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, 'recording.webm');
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          const data = await res.json();
          if (data.text) onTranscript(data.text.trim());
        } catch (err) { console.error('Whisper error', err); }
        setIsListening(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsListening(true);
      setMode('whisper');
    } catch (err) {
      console.error('Mic access denied', err);
      setIsListening(false);
    }
  }

  function start() {
    if (hasNativeSpeech) startLive();
    else startWhisper();
  }

  function stop() {
    if (mode === 'live' && recognitionRef.current) {
      recognitionRef.current.stop();
    } else if (mode === 'whisper' && mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }

  function toggle() {
    if (isListening) stop();
    else start();
  }

  return { isListening, toggle, mode };
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
  const isImage = file.type.startsWith('image/');
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
  } else {
    // Document — read as text
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
function VideoCard({ taskId, prompt, token, initialStatus = 'generating' }) {
  const [status, setStatus] = useState(initialStatus);
  const [videoUrl, setVideoUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (status === 'success' || status === 'failed') return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/generate/video/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (d.status === 'success') {
          setStatus('success');
          setVideoUrl(d.videoUrl);
          setThumbnailUrl(d.thumbnailUrl);
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
      <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#111]">
        {/* Embedded Video Player */}
        <div className="relative bg-black">
          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full max-h-80 object-contain"
            poster={thumbnailUrl || undefined}
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" /> Video ready!
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5 truncate max-w-xs">{prompt}</p>
          </div>
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" download
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-lg hover:bg-orange-500/25 transition-colors whitespace-nowrap">
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> Video generation failed: {error}
        </p>
      </div>
    );
  }

  // Generating state
  return (
    <div className="mt-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-orange-500/15 flex items-center justify-center flex-shrink-0">
          <Video className="w-4 h-4 text-orange-400 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-orange-400 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating your video...
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">This usually takes 1-3 minutes. I'll update automatically.</p>
          <div className="mt-2 w-full bg-white/5 rounded-full h-1 overflow-hidden">
            <div className="h-full bg-orange-500/50 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-700 mt-2 truncate italic">"{prompt}"</p>
    </div>
  );
}

// ── ImageCard: renders a generated image with download option ─────────────────
function ImageCard({ url, revisedPrompt }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#111]">
      <div className="relative">
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
      </div>
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> Generated with DALL-E 3
          </p>
          {revisedPrompt && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{revisedPrompt}</p>}
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" download
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-lg hover:bg-orange-500/25 transition-colors whitespace-nowrap flex-shrink-0">
          <Download className="w-3.5 h-3.5" /> Save
        </a>
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
      <div className={`flex-1 overflow-y-auto ${contentMaxHeight} mb-4 text-base text-gray-200 prose prose-invert prose-base prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-li:my-1 prose-code:text-orange-300`}>
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
        <div className="absolute bottom-full mb-2 left-0 bg-[#111] border border-white/10 rounded-xl p-2 shadow-2xl min-w-[280px] z-20 max-h-80 overflow-y-auto">
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
    setIsOpen(false);
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
          <Sparkles className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-0 bg-[#111] border border-white/10 rounded-2xl shadow-2xl w-72 sm:w-80 overflow-hidden z-30">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                activeTab === 'image' ? 'text-pink-400 bg-pink-500/10 border-b-2 border-pink-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <ImagePlus className="w-4 h-4" />
              Image
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                activeTab === 'video' ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Film className="w-4 h-4" />
              Video
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Model Selector */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-600 mb-2 block">
                {activeTab === 'image' ? 'Image Model' : 'Video Model'}
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {(activeTab === 'image' ? IMAGE_MODELS : VIDEO_MODELS).map(model => (
                  <button
                    key={model.value}
                    onClick={() => activeTab === 'image' ? setSelectedImageModel(model.value) : setSelectedVideoModel(model.value)}
                    className={`w-full flex items-center px-3 py-2 rounded-lg text-xs transition-colors ${
                      (activeTab === 'image' ? selectedImageModel : selectedVideoModel) === model.value
                        ? 'bg-gradient-to-r from-pink-500/20 to-blue-500/20 border border-pink-500/30 text-white'
                        : 'bg-white/3 border border-white/5 text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{model.label}</span>
                      <span className="text-[9px] text-gray-600">{model.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio for Images */}
            {activeTab === 'image' && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-600 mb-2 block">Aspect Ratio</label>
                <div className="flex gap-2">
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
              <label className="text-[10px] uppercase tracking-wider text-gray-600 mb-2 block">
                Describe what you want to create
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTab === 'image' 
                  ? "A serene mountain landscape at sunset with golden light..."
                  : "A cinematic drone shot flying through a futuristic city..."
                }
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-pink-500/50"
                rows={3}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                prompt.trim()
                  ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white hover:from-pink-600 hover:to-purple-600'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
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
function GalleryModal({ item, onClose }) {
  if (!item) return null;
  
  const isVideo = item.type === 'video';
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className={`text-xs px-2 py-1 rounded ${isVideo ? 'bg-blue-500/30 text-purple-300' : 'bg-pink-500/30 text-pink-300'}`}>
              {isVideo ? 'Video' : 'Image'} • {item.model_label || item.model}
            </span>
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
              className="max-w-full max-h-[70vh] rounded-lg"
            />
          ) : (
            <img 
              src={item.url} 
              alt={item.prompt} 
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </div>
        
        <div className="mt-4 p-4 bg-white/5 rounded-xl">
          <p className="text-sm text-gray-300 mb-2">{item.prompt}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {new Date(item.created_at).toLocaleString()}
            </span>
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
  );
}

// ── CloudImportModal: Import with client-side ZIP processing ──────────────────
function CloudImportModal({ onClose, token, onImportComplete }) {
  const [importType, setImportType] = useState('chatgpt');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const getTotalSize = () => selectedFiles.reduce((sum, f) => sum + f.size, 0);

  // Extract data from ZIP file client-side
  const extractFromZip = async (file, type) => {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const messages = [];
    const posts = [];

    if (type === 'chatgpt') {
      // Look for conversations.json
      const conversationsFile = zip.file('conversations.json');
      if (conversationsFile) {
        const content = await conversationsFile.async('string');
        const conversations = JSON.parse(content);
        
        for (const conv of conversations) {
          if (conv.mapping) {
            for (const nodeId in conv.mapping) {
              const node = conv.mapping[nodeId];
              if (node.message?.content?.parts?.[0]) {
                const role = node.message.author?.role;
                const content = node.message.content.parts.join('\n');
                if (content && content.trim() && (role === 'user' || role === 'assistant')) {
                  messages.push({
                    role: role === 'user' ? 'user' : 'assistant',
                    content: content.trim(),
                    timestamp: node.message.create_time ? new Date(node.message.create_time * 1000).toISOString() : null,
                    conversation_id: conv.id,
                    conversation_title: conv.title
                  });
                }
              }
            }
          }
        }
      }
    } else if (type === 'facebook') {
      // Look for messages in inbox folder
      const messageFiles = Object.keys(zip.files).filter(f => 
        f.includes('messages/inbox/') && f.endsWith('.json')
      );
      
      for (const filePath of messageFiles) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          if (data.messages) {
            for (const msg of data.messages) {
              if (msg.content) {
                messages.push({
                  role: msg.sender_name?.toLowerCase().includes('you') ? 'user' : 'other',
                  content: msg.content,
                  timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms).toISOString() : null,
                  sender: msg.sender_name
                });
              }
            }
          }
        } catch (e) {
          console.log('Skipping file:', filePath);
        }
      }

      // Look for posts
      const postFiles = Object.keys(zip.files).filter(f => 
        f.includes('posts/') && f.endsWith('.json')
      );
      
      for (const filePath of postFiles) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            for (const post of data) {
              if (post.data?.[0]?.post) {
                posts.push({
                  content: post.data[0].post,
                  timestamp: post.timestamp ? new Date(post.timestamp * 1000).toISOString() : null
                });
              }
            }
          }
        } catch (e) {
          console.log('Skipping file:', filePath);
        }
      }
    }

    return { messages, posts };
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const invalidFiles = files.filter(f => !f.name.endsWith('.zip'));
    if (invalidFiles.length > 0) {
      setError('Please select only ZIP files');
      return;
    }
    
    setSelectedFiles(files);
    setError('');
    setExtractedData(null);
    
    // Auto-extract preview
    setImportStatus({ status: 'extracting', message: 'Reading ZIP file...', progress: 10 });
    
    try {
      let totalMessages = [];
      let totalPosts = [];
      
      for (let i = 0; i < files.length; i++) {
        setImportStatus({ 
          status: 'extracting', 
          message: `Processing ${files[i].name}...`, 
          progress: Math.round(((i + 1) / files.length) * 80) 
        });
        
        const { messages, posts } = await extractFromZip(files[i], importType);
        totalMessages.push(...messages);
        totalPosts.push(...posts);
      }
      
      setExtractedData({
        messages: totalMessages,
        posts: totalPosts,
        dataSize: JSON.stringify({ messages: totalMessages, posts: totalPosts }).length
      });
      setImportStatus(null);
      
    } catch (err) {
      console.error('Extraction error:', err);
      setError('Failed to read ZIP file. Make sure it\'s a valid export.');
      setImportStatus(null);
    }
  };

  const removeFile = () => {
    setSelectedFiles([]);
    setExtractedData(null);
    setError('');
  };

  const handleImport = async () => {
    if (!extractedData || extractedData.messages.length === 0) {
      setError('No messages found to import');
      return;
    }
    
    setIsImporting(true);
    setError('');
    setImportStatus({ status: 'uploading', message: 'Uploading extracted data...', progress: 20 });

    try {
      // Upload extracted data (much smaller than full ZIP!)
      const res = await fetch('/api/imports/extracted', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: importType,
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
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#111] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Smart Import</h2>
              <p className="text-xs text-gray-500">Fast • Processes locally • Private</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1" disabled={isImporting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Data Source Selection */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">Data Source</label>
            <div className="flex gap-2">
              <button 
                onClick={() => { setImportType('chatgpt'); setExtractedData(null); setSelectedFiles([]); }} 
                disabled={isImporting}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  importType === 'chatgpt' 
                    ? 'bg-green-500/20 border border-green-500/40 text-green-400' 
                    : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20'
                }`}>
                ChatGPT Export
              </button>
              <button 
                onClick={() => { setImportType('facebook'); setExtractedData(null); setSelectedFiles([]); }} 
                disabled={isImporting}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  importType === 'facebook' 
                    ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400' 
                    : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20'
                }`}>
                Facebook Export
              </button>
            </div>
          </div>

          {/* File Selection */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl p-4">
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
                className="w-full py-8 border-2 border-dashed border-white/20 hover:border-emerald-500/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-all">
                {importStatus?.status === 'extracting' ? (
                  <>
                    <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                    <span className="text-sm text-emerald-400">{importStatus.message}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-500" />
                    <span className="text-sm text-gray-400">Click to select your {importType === 'chatgpt' ? 'ChatGPT' : 'Facebook'} export ZIP</span>
                    <span className="text-xs text-gray-600">We'll extract just the conversations • Files stay on your device</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                {/* Selected File */}
                <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileArchive className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-gray-300 truncate">{selectedFiles[0]?.name}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(getTotalSize())})</span>
                  </div>
                  <button onClick={removeFile} disabled={isImporting} className="text-gray-500 hover:text-red-400 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Extraction Preview */}
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
              disabled={!extractedData || extractedData.messages.length === 0 || isImporting}
              className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                extractedData && extractedData.messages.length > 0 && !isImporting
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:opacity-90' 
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}>
              {isImporting 
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 5) {
      setError('Please enter at least 5 characters');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      const res = await fetch('/api/user-feedback', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          message: message.trim(),
          category,
          rating: rating > 0 ? rating : null,
        }),
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
function SettingsModal({ onClose, token, onAssessmentReset }) {
  const [activeTab, setActiveTab] = useState('imports');
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

  useEffect(() => {
    fetch('/api/imports', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setImports(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setProfile(d.profile)).catch(() => {});
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
      await fetch('/api/imports/upload', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      setTimeout(() => {
        fetch('/api/imports', { headers: { Authorization: `Bearer ${token}` } })
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
  const [newMemory, setNewMemory] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('other');
  const memoryCategories = ['health', 'preferences', 'personal', 'work', 'relationships', 'goals', 'other'];

  const loadMemories = async () => {
    setMemoriesLoading(true);
    try {
      const res = await fetch('/api/memories', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setMemories(d.memories || []);
    } catch (e) {}
    setMemoriesLoading(false);
  };

  const addMemory = async () => {
    if (!newMemory.trim()) return;
    try {
      await fetch('/api/memories', {
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

  const tabs = ['soulprint', 'imports', 'telegram', 'schedules', 'memories', 'profile', 'privacy', 'feedback'];

  // SoulPrint data
  const [soulPrintData, setSoulPrintData] = useState(null);
  const [soulPrintLoading, setSoulPrintLoading] = useState(false);
  const [generatingSnapshot, setGeneratingSnapshot] = useState(false);
  const [editingAssistantName, setEditingAssistantName] = useState(null);

  const loadSoulPrint = async () => {
    setSoulPrintLoading(true);
    try {
      const res = await fetch('/api/profile/soulprint', {
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
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm sm:text-base">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="border-b border-white/10 px-2 py-2">
          <div className="grid grid-cols-4 gap-1">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-2 py-2 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase transition-colors rounded-lg text-center ${activeTab === tab ? 'text-orange-500 bg-orange-500/10 border border-orange-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'}`}>
                <span className="block text-sm mb-0.5">{tab === 'soulprint' ? '🪪' : tab === 'imports' ? '📥' : tab === 'telegram' ? '💬' : tab === 'schedules' ? '📅' : tab === 'memories' ? '🧠' : tab === 'profile' ? '👤' : tab === 'privacy' ? '🔒' : '📝'}</span>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* SOULPRINT TAB */}
          {activeTab === 'soulprint' && (
            <div className="space-y-5">
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
                      <Sparkles className="w-8 h-8 text-orange-400" />
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
                <h3 className="text-white text-sm font-semibold mb-1">📥 Import Your Data</h3>
                <p className="text-gray-500 text-xs mb-4">Upload your ChatGPT or Facebook data export (ZIP file). I'll analyze your communication style to personalize your experience.</p>
                
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

                <div className="grid grid-cols-1 gap-3">
                  {/* ChatGPT Upload */}
                  <div className="p-3 sm:p-4 rounded-xl bg-[#1a1a1a] border border-white/5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg sm:text-xl">💬</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">ChatGPT Export</p>
                        <p className="text-gray-600 text-[10px] sm:text-xs mt-0.5 mb-2 sm:mb-3">Export from Settings → Data controls → Export data</p>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-xs hover:bg-green-500/15 transition-colors">
                          <Upload className="w-3.5 h-3.5" /> 
                          <span className="hidden sm:inline">Select ZIP File(s)</span>
                          <span className="sm:hidden">Upload</span>
                          <input type="file" accept=".zip" multiple className="hidden" onChange={(e) => { handleDataImportUpload(e.target.files, 'chatgpt'); e.target.value = ''; }} disabled={uploading} />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Facebook Upload */}
                  <div className="p-3 sm:p-4 rounded-xl bg-[#1a1a1a] border border-white/5 opacity-60">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg sm:text-xl">📘</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium">Facebook Archive</p>
                          <span className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full">Coming Soon</span>
                        </div>
                        <p className="text-gray-600 text-[10px] sm:text-xs mt-0.5 mb-2 sm:mb-3">Import your Facebook messages and posts</p>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400/50 text-xs cursor-not-allowed">
                          <Upload className="w-3.5 h-3.5" /> 
                          <span>Coming Soon</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cloud Import for Large Files */}
                  <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border border-cyan-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                        <Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">Large File Import</p>
                        <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 mb-2 sm:mb-3">Fast import - processes locally, only uploads conversation data</p>
                        <button
                          onClick={() => {
                            onClose();
                            // Dispatch custom event to open cloud import modal
                            window.dispatchEvent(new CustomEvent('openCloudImport'));
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs hover:from-emerald-500/30 hover:to-green-500/30 transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5" /> 
                          <span className="hidden sm:inline">Smart Import</span>
                          <span className="sm:hidden">Import</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 text-[10px] mt-3 text-center">
                  🔒 Your raw data is analyzed and immediately deleted. Only the insights are saved.
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
                            {imp.stats?.messageCount || imp.stats?.conversationCount || 0} items analyzed · {new Date(imp.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

                  {/* AI Model selector for Telegram */}
                  <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-xs font-semibold">AI Model for Telegram</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">Choose which AI responds to your Telegram messages</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {['OpenAI', 'Claude', 'Gemini', 'Perplexity', 'Kimi'].map(group => {
                        const groupModels = TELEGRAM_MODELS.filter(m => m.group === group);
                        if (!groupModels.length) return null;
                        return (
                          <div key={group}>
                            <p className="text-[9px] font-bold text-gray-600 tracking-widest uppercase px-1 mt-2 mb-1">{group}</p>
                            {groupModels.map(m => (
                              <button key={m.value}
                                onClick={() => saveTelegramModel(m.value)}
                                disabled={savingModel}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${telegramModel === m.value ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
                                <span>{m.label}</span>
                                {telegramModel === m.value && <span className="text-[9px] font-bold text-orange-500/70">ACTIVE</span>}
                                {m.group === 'Perplexity' && <span className="text-[9px] text-blue-400/70 ml-1">🌐 online</span>}
                              </button>
                            ))}
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
                      <li>Open Telegram and find the bot (ask your admin for the bot username)</li>
                      <li>Send <code className="bg-white/10 px-1 rounded">/start</code> to the bot</li>
                      <li>The bot will reply with a link code</li>
                      <li>Enter that code below</li>
                    </ol>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2 block">Enter Link Code</label>
                    <div className="flex gap-2">
                      <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())}
                        placeholder="e.g. A1B2C3D4" maxLength={8}
                        className="flex-1 bg-[#0a0a0a] border border-white/10 text-white text-sm px-4 py-2.5 rounded-xl font-mono tracking-widest focus:border-orange-500/40 transition-colors" />
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
                      className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:border-orange-500/40 transition-colors"
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
                      className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:border-orange-500/40 transition-colors resize-none"
                    />
                  </div>

                  {/* Time settings */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Hour</label>
                      <select
                        value={newSchedule.local_hour}
                        onChange={e => setNewSchedule(p => ({ ...p, local_hour: parseInt(e.target.value) }))}
                        className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm px-2 py-2 rounded-lg"
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
                        className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm px-2 py-2 rounded-lg"
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
                        className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm px-2 py-2 rounded-lg"
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
              </div>

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

              {/* Load Memories Button */}
              <button onClick={loadMemories} className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-gray-500 hover:text-white text-xs transition-colors">
                {memoriesLoading ? 'Loading...' : 'Load Memories'}
              </button>

              {/* Memories List */}
              {memories.length > 0 ? (
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
              ) : (
                <p className="text-gray-600 text-xs text-center py-4">
                  No memories yet. Chat with the AI and important facts will be automatically remembered, or add them manually above.
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
                              await fetch('/api/profile', {
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

                  {/* Other profile fields */}
                  {[
                    ['Display Name', profile.display_name],
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
                      const res = await fetch('/api/profile/export', { headers: { Authorization: `Bearer ${token}` } });
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
                  <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-md w-full">
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
                  className="w-full h-28 bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-600 resize-none focus:border-orange-500/40 focus:outline-none"
                />
              </div>

              {/* Submit button */}
              <button
                onClick={async () => {
                  if (!feedbackText.trim()) return;
                  setFeedbackSubmitting(true);
                  try {
                    await fetch('/api/user-feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ 
                        category: feedbackType === 'issue' ? 'bug' : feedbackType === 'idea' ? 'feature' : 'general',
                        message: feedbackText,
                        rating: feedbackType === 'love' ? 5 : feedbackType === 'good' ? 4 : null
                      }),
                    });
                    setFeedbackText('');
                    setFeedbackType('');
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
function AttachmentPill({ att, onRemove }) {
  const isImage = att.type === 'image';
  return (
    <div className="flex items-center gap-1.5 bg-white/8 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-[160px]">
      {isImage ? <ImageIcon className="w-3 h-3 text-blue-400 flex-shrink-0" /> : <FileText className="w-3 h-3 text-orange-400 flex-shrink-0" />}
      <span className="truncate">{att.name}</span>
      <button onClick={onRemove} className="flex-shrink-0 text-gray-500 hover:text-white transition-colors ml-1">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [searchQueries, setSearchQueries] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [user, setUser] = useState(null);
  const [assistantName, setAssistantName] = useState('SoulPrint');
  const [token, setToken] = useState('');
  const [attachments, setAttachments] = useState([]); // [{type, base64/text, name, mimeType}]
  const [fileError, setFileError] = useState('');
  // Location state
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  // Conversation management state
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [convMenuId, setConvMenuId] = useState(null); // which conversation's menu is open
  const [searchQuery, setSearchQuery] = useState(''); // conversation search
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
  // Gradual assessment state
  const [gradualQuestion, setGradualQuestion] = useState(null);
  const [gradualAnswer, setGradualAnswer] = useState('');
  const [gradualProgress, setGradualProgress] = useState(null);
  const [showGradualPrompt, setShowGradualPrompt] = useState(false);
  const [submittingGradual, setSubmittingGradual] = useState(false);
  const streamingImageUrlRef = useRef(null);
  const streamingVideoTaskRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [interimText, setInterimText] = useState('');

  // Keep refs in sync with state
  useEffect(() => { streamingImageUrlRef.current = streamingImageUrl; }, [streamingImageUrl]);
  useEffect(() => { streamingVideoTaskRef.current = streamingVideoTask; }, [streamingVideoTask]);

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
        setMessages([{
          id: 'greeting', role: 'assistant',
          content: `Hey ${greet} 👋 I'm **${botName}**, your personal AI.\n\nI can help with research, analysis, planning, and more. I also have **real-time web search** — just ask me anything current.\n\nWhat's on your mind?`,
          created_at: new Date().toISOString(),
        }]);
      })
      .catch(() => router.push('/auth'));
    fetch('/api/conversations', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : [])).catch(() => {});
    // Fetch announcements
    fetch('/api/announcements', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => setAnnouncements(d.unread || [])).catch(() => {});
    // Fetch latest news/blog posts
    fetch('/api/blog/posts?limit=3')
      .then(r => r.json()).then(d => setLatestNews(d.posts || [])).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Close conversation menu when clicking outside
  useEffect(() => {
    if (!convMenuId) return;
    const handleClickOutside = () => setConvMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [convMenuId]);

  // Dismiss announcement
  async function dismissAnnouncement(announcementId) {
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
    try {
      await fetch('/api/announcements/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ announcementId }),
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

  // Request and save user's browser location
  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    setLocationLoading(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch('/api/user/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
          const data = await res.json();
          if (res.ok) {
            setUserLocation({ lat: latitude, lng: longitude, address: data.address });
            // Show confirmation in chat
            setMessages(prev => [...prev, {
              id: `loc-${Date.now()}`, role: 'assistant',
              content: `📍 **Location saved!**\n\n${data.address}\n\nYou can now ask me things like:\n- "Find restaurants near me"\n- "What coffee shops are nearby?"\n- "Show me gas stations close by"`,
              created_at: new Date().toISOString(),
            }]);
          }
        } catch (err) {
          console.error('Failed to save location:', err);
        }
        setLocationLoading(false);
      },
      (error) => {
        setLocationLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          alert('Location permission denied. Please enable location access in your browser settings.');
        } else {
          alert('Could not get your location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [token]);

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

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || loading || compareLoading) return;
    const content = input.trim();
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setStreamingContent('');
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
        fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []));
      } catch (err) {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error during comparison. Please try again.', created_at: new Date().toISOString() }]);
      } finally {
        setCompareLoading(false);
      }
      return;
    }

    // ── Single Model Mode: Stream response ──
    setLoading(true);
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: newConvId, content, model: selectedModel,
          provider: currentModel.provider, attachments: currentAttachments, enableWebSearch: webSearchEnabled,
        }),
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
            } else if (data.type === 'search') {
              setSearchingWeb(true);
              setSearchQueries(data.queries || []);
            } else if (data.type === 'image') {
              // Image generated – store url for rendering
              setStreamingImageUrl(data.url);
              setStreamingRevPrompt(data.revised_prompt);
            } else if (data.type === 'video_task') {
              // Video job started – store taskId for polling
              setStreamingVideoTask({ taskId: data.taskId, status: 'generating', prompt: data.prompt });
            } else if (data.type === 'delta') {
              setSearchingWeb(false);
              // Skip the markdown content if it's an image (we render the image directly)
              if (!streamingImageUrlRef.current) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              }
            } else if (data.type === 'done') {
              const finalMsg = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: fullContent,
                created_at: new Date().toISOString(),
                model_used: selectedModel,
                image_url: streamingImageUrlRef.current || undefined,
                video_task: streamingVideoTaskRef.current || undefined,
              };
              setMessages(prev => [...prev, finalMsg]);
              setStreamingContent('');
              setStreamingImageUrl(null);
              setStreamingVideoTask(null);
              setSearchQueries([]);
              fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []));
            } else if (data.type === 'error') {
              setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${data.error}`, created_at: new Date().toISOString() }]);
              setStreamingContent('');
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error. Please try again.', created_at: new Date().toISOString() }]);
      setStreamingContent('');
    } finally {
      setLoading(false);
      setSearchingWeb(false);
      inputRef.current?.focus();
    }
  }, [input, loading, compareLoading, token, selectedModel, conversationId, attachments, webSearchEnabled, compareMode, compareModels]);

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
      
      // Clear comparison state after a short delay (to show the selection)
      setTimeout(() => {
        setCompareResponses(null);
        setSelectedCompareResponse(null);
      }, 1500);
      
      // Refresh conversations
      fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
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

  async function loadConversation(convId) {
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
    setConversationId(null);
    const greet = user?.profile?.display_name || 'there';
    const botName = user?.profile?.assistant_name || 'SoulPrint';
    setMessages([{ id: 'greeting', role: 'assistant', content: `Hey ${greet} 👋 Starting fresh! What's on your mind?`, created_at: new Date().toISOString() }]);
    setAttachments([]);
    setShowSidebar(false);
  }

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

  // Delete a conversation
  async function deleteConversation(convId) {
    if (!confirm('Are you sure you want to delete this conversation? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
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
  const filteredConversations = (searchQuery.trim() 
    ? conversations.filter(c => (c.title || 'Conversation').toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations
  ).sort((a, b) => {
    // Pin Telegram conversations to the top
    if (a.source === 'telegram' && b.source !== 'telegram') return -1;
    if (a.source !== 'telegram' && b.source === 'telegram') return 1;
    // Keep original order for same type (most recent first)
    return 0;
  });

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden safe-area-all">
      {showSidebar && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setShowSidebar(false)} />}

      {/* Sidebar */}
      <div className={`fixed lg:relative z-50 h-full w-64 bg-[#0f0f0f] border-r border-white/5 flex flex-col transform transition-transform duration-200 ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-white/5 pwa-header">
          <div className="flex items-center gap-2 mb-3">
            <SoulPrintLogo size={22} />
            <span className="font-condensed font-bold text-white text-sm tracking-widest uppercase">{assistantName}</span>
          </div>
          <button onClick={newConversation} className="w-full btn-orange py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Chat
          </button>
        </div>
        
        {/* Search conversations */}
        {conversations.length > 0 && (
          <div className="px-3 py-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:border-orange-500/40 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="text-gray-700 text-xs text-center mt-6">No conversations yet</p>
          ) : filteredConversations.length === 0 ? (
            <p className="text-gray-600 text-xs text-center mt-6">No matching conversations</p>
          ) : filteredConversations.map(conv => (
            <div key={conv.id} className="relative group mb-1">
              {editingConvId === conv.id ? (
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
                <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[120px]">
                  <button
                    onClick={() => startEditing(conv)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Rename
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
        
        {/* Latest News Widget */}
        {latestNews.length > 0 && (
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
        
        <div className="p-3 border-t border-white/5 space-y-2">
          {/* Gallery button */}
          <button 
            onClick={() => setShowGallery(true)}
            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-gradient-to-r from-pink-500/10 to-blue-500/10 hover:from-pink-500/20 hover:to-blue-500/20 border border-pink-500/30 rounded-lg text-pink-400 hover:text-pink-300 text-xs transition-colors"
          >
            <GalleryHorizontal className="w-3.5 h-3.5" /> Media Gallery
          </button>
          {/* Admin Dashboard link - only for admins */}
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <a 
              href="/admin"
              className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:text-orange-300 text-xs transition-colors"
            >
              <Shield className="w-3.5 h-3.5" /> Admin Dashboard
            </a>
          )}
          <button 
            onClick={() => setShowFeedbackModal(true)}
            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white text-xs transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Send Feedback
          </button>
          <p className="text-gray-700 text-[10px] text-center truncate">{user?.email}</p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar - with safe area padding for PWA */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0 pwa-header bg-[#0a0a0a]">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="text-gray-500 hover:text-white transition-colors lg:hidden">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => router.push('/')} className="text-gray-500 hover:text-white transition-colors hidden lg:flex items-center gap-1 text-sm">
              <ChevronLeft className="w-4 h-4" />
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
            <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

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
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1.5 transition-colors"
                    >
                      Learn more <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <button 
                  onClick={() => dismissAnnouncement(ann.id)} 
                  className="text-gray-600 hover:text-white transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {messages.map((msg, idx) => (
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
                  <div className={`rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-[13px] sm:text-sm leading-relaxed break-words ${msg.role === 'user' ? 'bg-orange-500/15 border border-orange-500/20 text-white' : 'bg-white/4 border border-white/8 text-gray-200'}`}>
                    {msg.role === 'assistant' ? (
                      <>
                        {/* Image card */}
                        {msg.image_url && (
                          <ImageCard url={msg.image_url} revisedPrompt={msg.content?.match(/\*Prompt used: (.+)\*/)?.[1] || ''} />
                        )}
                        {/* Video card - for polling state */}
                        {msg.video_task && (
                          <VideoCard
                            taskId={msg.video_task.taskId}
                            prompt={msg.video_task.prompt}
                            token={token}
                            initialStatus={msg.video_task.status}
                          />
                        )}
                        {/* Saved video - direct URL from database */}
                        {msg.video_url && !msg.video_task && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-white/10 bg-[#111]">
                            <video
                              src={msg.video_url}
                              controls
                              playsInline
                              className="w-full max-h-60 sm:max-h-80 object-contain"
                            >
                              Your browser does not support the video tag.
                            </video>
                            <div className="p-2 flex justify-end">
                              <a href={msg.video_url} target="_blank" rel="noopener noreferrer" download
                                className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[11px] sm:text-xs rounded-lg hover:bg-orange-500/25 transition-colors">
                                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Download
                              </a>
                            </div>
                          </div>
                        )}
                        {/* Regular text (skip for pure image/video messages) */}
                        {!msg.image_url && !msg.video_url && (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({children}) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                              code: ({inline, children}) => inline 
                                ? <code className="bg-white/10 px-1 rounded text-orange-300 text-[11px] sm:text-xs break-all">{children}</code> 
                                : <pre className="bg-[#0a0a0a] p-2 sm:p-3 rounded-lg mt-2 overflow-x-auto text-[11px] sm:text-xs whitespace-pre-wrap break-words"><code>{children}</code></pre>,
                              ul: ({children}) => <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-4 space-y-1 mb-2">{children}</ol>,
                              strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                              a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-orange-300 break-all">{children}</a>,
                              h1: ({children}) => <h1 className="text-base sm:text-lg font-bold text-white mb-2">{children}</h1>,
                              h2: ({children}) => <h2 className="text-sm sm:text-base font-bold text-white mb-1.5">{children}</h2>,
                              h3: ({children}) => <h3 className="text-[13px] sm:text-sm font-semibold text-white mb-1">{children}</h3>,
                              blockquote: ({children}) => <blockquote className="border-l-2 border-orange-500/40 pl-3 italic text-gray-400">{children}</blockquote>,
                              img: ({src, alt}) => <img src={src} alt={alt} className="max-w-full rounded-lg mt-2" />,
                              table: ({children}) => <div className="overflow-x-auto my-2"><table className="min-w-full text-[11px] sm:text-xs border-collapse">{children}</table></div>,
                              th: ({children}) => <th className="border border-white/20 px-2 py-1 bg-white/5 text-left font-semibold">{children}</th>,
                              td: ({children}) => <td className="border border-white/10 px-2 py-1">{children}</td>,
                            }}>
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </>
                    ) : (
                      // User message - support editing
                      editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-orange-500/30 rounded-lg p-2 text-white text-[13px] sm:text-sm focus:outline-none focus:border-orange-500/50 resize-none"
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
                      {msg.model_used && <span className="text-[9px] sm:text-[10px] text-gray-700 truncate max-w-[80px] sm:max-w-none">{msg.model_used}</span>}
                    </div>
                  )}
                </div>
              </div>
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
            {(streamingContent || streamingImageUrl || streamingVideoTask) && (
              <div className="msg-appear flex justify-start">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0 mt-0.5">
                  <SoulPrintLogo size={12} className="sm:hidden" />
                  <SoulPrintLogo size={14} className="hidden sm:block" />
                </div>
                <div className="min-w-0 max-w-[95%] sm:max-w-[90%] lg:max-w-[85%] rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 bg-white/4 border border-white/8 text-[13px] sm:text-sm text-gray-200 leading-relaxed break-words">
                  {/* Live image preview */}
                  {streamingImageUrl && (
                    <ImageCard url={streamingImageUrl} revisedPrompt={streamingRevPrompt} />
                  )}
                  {/* Live video card */}
                  {streamingVideoTask && !streamingImageUrl && (
                    <VideoCard
                      taskId={streamingVideoTask.taskId}
                      prompt={streamingVideoTask.prompt}
                      token={token}
                      initialStatus={streamingVideoTask.status}
                    />
                  )}
                  {/* Regular text (only if not a pure image message) */}
                  {streamingContent && !streamingImageUrl && (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({children}) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                          strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                          a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline break-all">{children}</a>,
                          code: ({inline, children}) => inline 
                            ? <code className="bg-white/10 px-1 rounded text-orange-300 text-[11px] sm:text-xs break-all">{children}</code> 
                            : <pre className="bg-[#0a0a0a] p-2 sm:p-3 rounded-lg mt-2 overflow-x-auto text-[11px] sm:text-xs whitespace-pre-wrap break-words"><code>{children}</code></pre>,
                        }}>
                        {streamingContent}
                      </ReactMarkdown>
                      <span className="inline-block w-0.5 h-4 bg-orange-500 ml-0.5 animate-pulse" />
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

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer - with safe area padding at bottom for PWA */}
        <div className="flex-shrink-0 px-4 pb-6 safe-area-bottom">
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

              {/* Single Model Selector (when not in compare mode) */}
              {!compareMode && (
                <div className="relative">
                  <button onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors bg-white/4 border border-white/8 px-3 py-1.5 rounded-full">
                    <span className="text-orange-400/80">{currentModel.group}</span>
                    <span className="text-gray-600">/</span>
                    <span>{currentModel.label}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showModelPicker && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#111] border border-white/10 rounded-xl p-1.5 shadow-2xl min-w-[240px] z-10 max-h-72 overflow-y-auto">
                      {['OpenAI', 'Claude', 'Gemini', 'Perplexity', 'Kimi'].map(group => {
                        const groupModels = MODELS.filter(m => m.group === group);
                        if (!groupModels.length) return null;
                        return (
                          <div key={group}>
                            <div className="px-3 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider mt-1">{group}</div>
                            {groupModels.map(m => (
                              <button key={m.value} onClick={() => { setSelectedModel(m.value); setShowModelPicker(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${selectedModel === m.value ? 'bg-orange-500/15 text-orange-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        );
                      })}
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
              <div className="flex flex-wrap gap-2 mb-2 px-1">
                {attachments.map((att, i) => (
                  <AttachmentPill key={i} att={att} onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
            {fileError && <p className="text-red-400 text-xs mb-1 px-1">{fileError}</p>}

            {/* Input bar */}
            <div className={`flex items-center gap-1.5 sm:gap-2 bg-[#111] border rounded-2xl px-2 sm:px-3 py-2 transition-colors ${speech.isListening ? 'border-orange-500/60 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'border-white/10 focus-within:border-orange-500/30'}`}>
              {/* File attach button */}
              <button onClick={() => fileInputRef.current?.click()}
                className="text-gray-600 hover:text-orange-400 transition-colors flex-shrink-0" title="Attach file or image">
                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={handleFileSelect} />

              {/* Location button - hide on very small screens */}
              <button
                onClick={requestLocation}
                disabled={locationLoading}
                title={userLocation ? `Location: ${userLocation.address}` : 'Share your location for "near me" searches'}
                className={`flex-shrink-0 transition-colors hidden xs:block ${userLocation ? 'text-green-500 hover:text-green-400' : 'text-gray-600 hover:text-orange-400'} ${locationLoading ? 'animate-pulse' : ''}`}
              >
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Mic button */}
              <button
                onClick={speech.toggle}
                title={speech.isListening ? 'Stop recording' : 'Start voice input'}
                className={`flex-shrink-0 transition-all relative ${speech.isListening ? 'text-orange-500' : 'text-gray-600 hover:text-orange-400'}`}
              >
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                {speech.isListening && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                )}
              </button>

              {/* Create (Image/Video) button */}
              <CreateMenu onGenerate={handleMediaGenerate} isGenerating={isGeneratingMedia} />

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
                  onKeyDown={e => { 
                    if (e.key === 'Enter' && !e.shiftKey) { 
                      e.preventDefault(); 
                      sendMessage();
                      // Reset height after sending
                      e.target.style.height = 'auto';
                    }
                    // Shift+Enter creates new line (default textarea behavior)
                  }}
                  placeholder={speech.isListening ? (speech.mode === 'whisper' ? 'Recording…' : 'Listening…') : attachments.length > 0 ? 'Add message…' : 'Message…'}
                  className={`w-full bg-transparent text-[13px] sm:text-sm placeholder-gray-600 focus:outline-none py-1 sm:py-1.5 resize-none overflow-hidden ${speech.isListening ? 'text-orange-300' : 'text-white'}`}
                  disabled={loading}
                  readOnly={speech.isListening}
                  rows={1}
                  style={{ minHeight: '24px', maxHeight: '150px' }}
                />
              </div>

              <button onClick={() => {
                sendMessage();
                // Reset textarea height after sending
                if (inputRef.current) {
                  inputRef.current.style.height = 'auto';
                }
              }}
                disabled={(!input.trim() && attachments.length === 0 && !speech.isListening) || loading || compareLoading || (compareMode && compareModels.length === 0)}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                  compareMode ? 'bg-gradient-to-r from-orange-500 to-blue-500 hover:from-orange-600 hover:to-purple-600' : 'bg-orange-500 hover:bg-orange-600'
                }`}>
                {loading || compareLoading ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-spin" /> : compareMode ? <GitCompare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" /> : <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />}
              </button>
            </div>
            <p className="text-center text-[9px] sm:text-[10px] text-gray-700 mt-1.5 sm:mt-2 px-2">
              {speech.isListening
                ? <span className="text-orange-500/70 animate-pulse">🎙 {speech.mode === 'live' ? 'Listening — tap mic to stop' : 'Recording — tap to stop'}</span>
                : compareMode
                  ? <span className="text-blue-400/70">Compare: {compareModels.length} model{compareModels.length !== 1 ? 's' : ''}</span>
                  : <span className="hidden sm:inline">Supports JPG, PNG, PDF, TXT, CSV · Tap 🎙 for voice · Max 10MB</span>}
              {!speech.isListening && !compareMode && <span className="sm:hidden">Tap 🎙 for voice · Attach files</span>}
            </p>
          </div>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} token={token} />}
      
      {/* Feedback Modal */}
      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} token={token} />}
      
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
        <GalleryModal item={selectedGalleryItem} onClose={() => setSelectedGalleryItem(null)} />
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
          <div className="bg-[#111] border border-orange-500/30 rounded-2xl p-4 shadow-2xl shadow-orange-500/10">
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
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/50 resize-none"
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
      
      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
