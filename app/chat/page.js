'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Plus, Mic, Send, Settings, ChevronLeft, ThumbsUp, ThumbsDown,
  MessageSquare, X, ChevronDown, Loader2, FileText, Globe,
  Image as ImageIcon, Paperclip, Search, Video, Download, RefreshCw, Play,
  MapPin, Upload, MoreVertical, Pencil, Trash2, Check, MessageCircle
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import InstallPrompt from '@/app/components/InstallPrompt';

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

  // Handle assessment reset
  async function handleResetAssessment() {
    if (!confirm('Are you sure you want to retake the 36-question assessment? Your previous answers will be archived.')) return;
    
    try {
      const res = await fetch('/api/assessment/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        onAssessmentReset?.();
        onClose();
        window.location.href = '/assessment';
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

  const tabs = ['imports', 'telegram', 'schedules', 'profile', 'feedback'];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 safe-area-all">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm sm:text-base">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex border-b border-white/10 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-5 py-3 text-[10px] sm:text-xs font-bold tracking-widest uppercase transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === tab ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
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
                  <div className="p-3 sm:p-4 rounded-xl bg-[#1a1a1a] border border-white/5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg sm:text-xl">📘</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">Facebook Archive</p>
                        <p className="text-gray-600 text-[10px] sm:text-xs mt-0.5 mb-2 sm:mb-3">Select all ZIP files from your Facebook export</p>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs hover:bg-blue-500/15 transition-colors">
                          <Upload className="w-3.5 h-3.5" /> 
                          <span className="hidden sm:inline">Select ZIP File(s)</span>
                          <span className="sm:hidden">Upload</span>
                          <input type="file" accept=".zip" multiple className="hidden" onChange={(e) => { handleDataImportUpload(e.target.files, 'facebook'); e.target.value = ''; }} disabled={uploading} />
                        </label>
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
                    <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20 mb-3">
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

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {profile && (
                <>
                  {[
                    ['Display Name', profile.display_name],
                    ['Assistant Name', profile.assistant_name || 'SoulPrint'],
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
                    <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 mb-4">
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
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg text-white text-sm hover:from-purple-500/30 hover:to-blue-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Profile (Markdown)
                </button>
                <p className="text-gray-700 text-[10px] mt-2 text-center">Same profile powers both web & Telegram</p>
              </div>

              {/* Retake Assessment Section */}
              <div className="pt-5 border-t border-white/10">
                <h3 className="text-white text-sm font-semibold mb-2">📋 36-Question Assessment</h3>
                <p className="text-gray-500 text-xs mb-4">
                  Your SoulPrint personality assessment helps me understand your communication style, preferences, and goals. 
                  You can retake it anytime to update your profile.
                </p>
                <button
                  onClick={handleResetAssessment}
                  className="w-full py-2.5 px-4 bg-white/5 border border-white/10 rounded-lg text-white text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake Assessment
                </button>
                <p className="text-gray-700 text-[10px] mt-2 text-center">Your previous answers will be archived</p>
              </div>

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
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${feedbackType === 'idea' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/5'}`}
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
                    await fetch('/api/feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ type: feedbackType, message: feedbackText }),
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
                  <a href="mailto:feedback@soulprint.ai" className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <span className="text-sm">📧</span>
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">Email</p>
                      <p className="text-gray-600 text-[10px]">feedback@soulprint.ai</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}
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
  // Media generation state
  const [streamingImageUrl, setStreamingImageUrl] = useState(null);
  const [streamingRevPrompt, setStreamingRevPrompt] = useState('');
  const [streamingVideoTask, setStreamingVideoTask] = useState(null); // { taskId, status, prompt }
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

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;
    const content = input.trim();
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setLoading(true);
    setStreamingContent('');
    setSearchingWeb(false);
    setSearchQueries([]);

    // Build display content for user bubble
    const displayContent = content + (currentAttachments.length > 0
      ? '\n' + currentAttachments.map(a => `📎 ${a.name}`).join('\n') : '');

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: displayContent, created_at: new Date().toISOString(), attachments: currentAttachments };
    setMessages(prev => [...prev.filter(m => m.id !== 'greeting' || prev.length === 1), userMsg]);

    let newConvId = conversationId;
    let fullContent = '';

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
  }, [input, loading, token, selectedModel, conversationId, attachments, webSearchEnabled]);

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

  async function submitFeedback(messageId, rating) {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversation_id: conversationId, message_id: messageId, rating }),
    }).catch(() => {});
  }

  const currentModel = MODELS.find(m => m.value === selectedModel) || MODELS[0];

  // Filter conversations based on search query
  const filteredConversations = searchQuery.trim() 
    ? conversations.filter(c => (c.title || 'Conversation').toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

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
        <div className="p-3 border-t border-white/5 space-y-2">
          <a 
            href="mailto:feedback@soulprint.ai?subject=SoulPrint Feedback"
            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white text-xs transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Send Feedback
          </a>
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
            <a
              href="mailto:feedback@soulprint.ai?subject=SoulPrint Feedback"
              title="Send Feedback"
              className="text-gray-500 hover:text-orange-400 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
            </a>
            <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`msg-appear flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                    <SoulPrintLogo size={14} />
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'max-w-[75%]' : ''}`}>
                  {/* Show image preview in user message */}
                  {msg.role === 'user' && msg.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                      {msg.attachments.map((att, i) => (
                        att.type === 'image' ? (
                          <img key={i} src={`data:${att.mimeType};base64,${att.base64}`} alt={att.name}
                            className="h-24 rounded-lg object-cover border border-white/10" />
                        ) : (
                          <div key={i} className="flex items-center gap-1.5 bg-white/8 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white">
                            <FileText className="w-3 h-3 text-orange-400" />{att.name}
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-orange-500/15 border border-orange-500/20 text-white' : 'bg-white/4 border border-white/8 text-gray-200'}`}>
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
                              className="w-full max-h-80 object-contain"
                            >
                              Your browser does not support the video tag.
                            </video>
                            <div className="p-2 flex justify-end">
                              <a href={msg.video_url} target="_blank" rel="noopener noreferrer" download
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-lg hover:bg-orange-500/25 transition-colors">
                                <Download className="w-3.5 h-3.5" /> Download
                              </a>
                            </div>
                          </div>
                        )}
                        {/* Regular text (skip for pure image/video messages) */}
                        {!msg.image_url && !msg.video_url && (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                              code: ({inline, children}) => inline ? <code className="bg-white/10 px-1 rounded text-orange-300 text-xs">{children}</code> : <pre className="bg-[#0a0a0a] p-3 rounded-lg mt-2 overflow-x-auto text-xs"><code>{children}</code></pre>,
                              ul: ({children}) => <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-4 space-y-1 mb-2">{children}</ol>,
                              strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                              a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-orange-300">{children}</a>,
                              h1: ({children}) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                              h2: ({children}) => <h2 className="text-base font-bold text-white mb-1.5">{children}</h2>,
                              h3: ({children}) => <h3 className="text-sm font-semibold text-white mb-1">{children}</h3>,
                              blockquote: ({children}) => <blockquote className="border-l-2 border-orange-500/40 pl-3 italic text-gray-400">{children}</blockquote>,
                              img: ({src, alt}) => <img src={src} alt={alt} className="max-w-full rounded-lg mt-2" />,
                            }}>
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === 'assistant' && msg.id !== 'greeting' && (
                    <div className="flex items-center gap-2 mt-1.5 ml-1">
                      <button onClick={() => submitFeedback(msg.id, 'up')} className="text-gray-700 hover:text-green-400 transition-colors"><ThumbsUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => submitFeedback(msg.id, 'down')} className="text-gray-700 hover:text-red-400 transition-colors"><ThumbsDown className="w-3.5 h-3.5" /></button>
                      {msg.model_used && <span className="text-[10px] text-gray-700">{msg.model_used}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Web searching indicator */}
            {searchingWeb && (
              <div className="flex justify-start msg-appear">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-3 flex-shrink-0">
                  <SoulPrintLogo size={14} />
                </div>
                <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                  <span className="text-gray-400 text-sm">
                    Searching: <span className="text-orange-400">{searchQueries[0] || 'the web'}...</span>
                  </span>
                </div>
              </div>
            )}

            {/* Streaming */}
            {(streamingContent || streamingImageUrl || streamingVideoTask) && (
              <div className="msg-appear flex justify-start">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                  <SoulPrintLogo size={14} />
                </div>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white/4 border border-white/8 text-sm text-gray-200 leading-relaxed">
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
                          p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                          a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">{children}</a>,
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
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-3 flex-shrink-0"><SoulPrintLogo size={14} /></div>
                <TypingIndicator />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer - with safe area padding at bottom for PWA */}
        <div className="flex-shrink-0 px-4 pb-6 safe-area-bottom">
          <div className="max-w-2xl mx-auto">
            {/* Model selector */}
            <div className="flex justify-center mb-2 relative">
              <button onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors bg-white/4 border border-white/8 px-3 py-1.5 rounded-full">
                <span className="text-orange-400/80">{currentModel.group}</span>
                <span className="text-gray-600">/</span>
                <span>{currentModel.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showModelPicker && (
                <div className="absolute bottom-full mb-2 bg-[#111] border border-white/10 rounded-xl p-1.5 shadow-2xl min-w-[240px] z-10 max-h-72 overflow-y-auto">
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
            <div className={`flex items-center gap-2 bg-[#111] border rounded-2xl px-3 py-2 transition-colors ${speech.isListening ? 'border-orange-500/60 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'border-white/10 focus-within:border-orange-500/30'}`}>
              {/* File attach button */}
              <button onClick={() => fileInputRef.current?.click()}
                className="text-gray-600 hover:text-orange-400 transition-colors flex-shrink-0" title="Attach file or image">
                <Paperclip className="w-5 h-5" />
              </button>
              <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={handleFileSelect} />

              {/* Location button */}
              <button
                onClick={requestLocation}
                disabled={locationLoading}
                title={userLocation ? `Location: ${userLocation.address}` : 'Share your location for "near me" searches'}
                className={`flex-shrink-0 transition-colors ${userLocation ? 'text-green-500 hover:text-green-400' : 'text-gray-600 hover:text-orange-400'} ${locationLoading ? 'animate-pulse' : ''}`}
              >
                <MapPin className="w-5 h-5" />
              </button>

              {/* Mic button */}
              <button
                onClick={speech.toggle}
                title={speech.isListening ? 'Stop recording' : 'Start voice input'}
                className={`flex-shrink-0 transition-all relative ${speech.isListening ? 'text-orange-500' : 'text-gray-600 hover:text-orange-400'}`}
              >
                <Mic className="w-5 h-5" />
                {speech.isListening && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                )}
              </button>

              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={speech.isListening && interimText ? input + (input ? ' ' : '') + interimText : input}
                  onChange={e => { if (!speech.isListening) setInput(e.target.value); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={speech.isListening ? (speech.mode === 'whisper' ? 'Recording… tap mic to stop' : 'Listening…') : attachments.length > 0 ? 'Add a message or just send...' : 'Enter command…'}
                  className={`w-full bg-transparent text-sm placeholder-gray-600 focus:outline-none py-1.5 ${speech.isListening ? 'text-orange-300' : 'text-white'}`}
                  disabled={loading}
                  readOnly={speech.isListening}
                />
              </div>

              <button onClick={sendMessage}
                disabled={(!input.trim() && attachments.length === 0 && !speech.isListening) || loading}
                className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-700 mt-2">
              {speech.isListening
                ? <span className="text-orange-500/70 animate-pulse">🎙 {speech.mode === 'live' ? 'Listening in real-time — tap mic to stop' : 'Recording — tap mic to stop & transcribe'}</span>
                : 'Supports JPG, PNG, PDF, TXT, CSV · Tap 🎙 for voice input · Max 10MB'}
            </p>
          </div>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} token={token} />}
      
      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
