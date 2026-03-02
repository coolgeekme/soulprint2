'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, MessageSquare, User, Sparkles, ChevronDown, 
  Mic, Plus, Settings, X, Check, Loader2, Globe,
  Image as ImageIcon, MoreHorizontal, ArrowLeft, Paperclip,
  Copy, Edit3, ThumbsUp, ThumbsDown, Trash2, MoreVertical,
  Video, Search, ChevronRight, Square
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SoulPrintLogo from '@/components/SoulPrintLogo';

// Full MODELS list matching desktop
const MODELS = [
  // Smart Mode - AI auto-selects best model
  { value: 'smart', label: '🧠 Smart Mode', provider: 'auto', group: 'Smart', isSmartMode: true, description: 'AI picks the best model for your query' },
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

// Image Generation Models (matching desktop) - no pricing shown
const IMAGE_MODELS = [
  { value: 'seedream-5-lite', label: 'Seedream 5.0 Lite', description: 'Fast & affordable' },
  { value: 'nano-banana', label: 'Nano Banana', description: 'Gemini-powered' },
  { value: 'gpt4o-image', label: 'GPT-4o Image', description: 'High quality text' },
  { value: 'flux-pro', label: 'Flux Pro', description: 'Artistic styles' },
  { value: 'midjourney-v7', label: 'Midjourney V7', description: 'Premium quality' },
  { value: 'gpt-image-1-5', label: 'GPT Image 1.5', description: 'OpenAI flagship' },
];

// Video Generation Models (matching desktop) - no pricing shown
const VIDEO_MODELS = [
  { value: 'kling-3-720p', label: 'Kling 3.0 (720p)', description: '5s, no audio' },
  { value: 'sora-2-stable', label: 'Sora 2 Stable', description: '10s video' },
  { value: 'kling-2-6', label: 'Kling 2.6', description: '5s with options' },
  { value: 'runway', label: 'Runway Gen-3', description: 'Pro quality' },
  { value: 'wan-2-6', label: 'Wan 2.6', description: '15s 1080p' },
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
  const [mode, setMode] = useState(null);

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
    rec.onerror = () => setIsListening(false);
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

// Bottom Tab Bar
const TabBar = ({ activeTab, onTabChange, assistantName, unreadCount = 0 }) => {
  const tabs = [
    { id: 'chat', icon: null, useLogo: true, label: assistantName || 'Chat' },
    { id: 'history', icon: MessageSquare, label: 'History', badge: unreadCount },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 safe-area-bottom z-50">
      <div className="flex items-center justify-around py-2 px-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center py-2 px-6 rounded-2xl transition-all duration-300 ${
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
const ChatHeader = ({ assistantName, model, onModelClick, isOnline, webSearchEnabled, onToggleWebSearch, onMoreClick }) => (
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
const MessageBubble = ({ message, isUser, assistantName, onCopy, onEdit, onFeedback, token }) => {
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
            <div className="mb-3 rounded-2xl overflow-hidden">
              <img 
                src={message.image_url} 
                alt="Generated" 
                className="w-full h-auto max-h-80 object-contain bg-black/20"
              />
            </div>
          )}
          
          {/* Show generated video */}
          {message.video_url && (
            <div className="mb-3 rounded-2xl overflow-hidden">
              <video 
                src={message.video_url} 
                controls 
                className="w-full h-auto max-h-80 bg-black/20"
              />
            </div>
          )}
          
          {/* Show loading spinner for generating media */}
          {message.is_generating && (
            <div className="flex items-center gap-2 mb-3 text-orange-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Generating...</span>
            </div>
          )}
          
          <div className="text-gray-200 text-[15px] leading-relaxed prose prose-invert prose-sm max-w-none">
            <ReactMarkdown 
              components={{
                p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                code: ({children}) => <code className="bg-black/30 px-1.5 py-0.5 rounded text-orange-300 text-sm">{children}</code>,
              }}
            >
              {message.content}
            </ReactMarkdown>
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
        {/* Model info - show Smart Mode badge if applicable */}
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
const ConversationItem = ({ conversation, isActive, onClick, onDelete, onRename }) => {
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
              {conversation.preview || 'No messages yet'}
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

// Profile View
const ProfileView = ({ profile, soulPrint, onSettingsClick, isAdmin, onAdminClick, announcements, onAnnouncementsClick }) => (
  <div className="min-h-screen bg-[#0a0a0a] pt-16 pb-24 px-4">
    <div className="text-center mb-8">
      <div className="w-24 h-24 mx-auto bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-full flex items-center justify-center mb-4">
        <SoulPrintLogo size={48} />
      </div>
      <h1 className="text-white text-xl font-semibold">{profile?.display_name || 'Your Profile'}</h1>
      <p className="text-gray-500 text-sm mt-1">{profile?.email}</p>
      {isAdmin && (
        <span className="inline-block mt-2 px-3 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
          Admin
        </span>
      )}
    </div>

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
          <Sparkles className="w-4 h-4" /> Your Communication Style
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">{soulPrint.communicationStyle}</p>
      </div>
    )}

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
    <div className="fixed inset-0 bg-[#0a0a0a] z-[60]">
      <div className="safe-area-top bg-[#0a0a0a] p-4 flex items-center gap-3 border-b border-white/10">
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
              <Paperclip className="w-4 h-4 text-gray-400" />
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

// More Options Menu (bottom sheet) - now only has Import and Settings
const MoreOptionsSheet = ({ isOpen, onClose, onSettings, onImport }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">Options</h3>
        <div className="space-y-2">
          <button 
            onClick={() => { onImport?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Paperclip className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <span className="text-white font-medium">Import Chats</span>
              <p className="text-gray-500 text-xs">Import from ChatGPT and other platforms</p>
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
const CreateOptionsSheet = ({ isOpen, onClose, onFileSelect, onCameraSelect, onImageGen, onVideoGen, onCompare, onGallery }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">Create</h3>
        <div className="space-y-2">
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
              <Sparkles className="w-5 h-5 text-blue-400" />
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
              <Paperclip className="w-5 h-5 text-blue-400" />
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
      <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
      <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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

// Rename Conversation Modal
const RenameModal = ({ isOpen, onClose, title, onTitleChange, onSave }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#111] rounded-2xl p-6" onClick={e => e.stopPropagation()}>
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
const GalleryView = ({ isOpen, onClose, items, onItemClick }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] z-[60]">
      <div className="safe-area-top bg-[#0a0a0a] p-4 flex items-center gap-3 border-b border-white/10">
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
                onClick={() => onItemClick?.(item)}
                className="aspect-square rounded-xl overflow-hidden bg-white/5"
              >
                {item.type === 'image' ? (
                  <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                ) : (
                  <video src={item.url} className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
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
      <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
    <div className="fixed inset-0 bg-[#0a0a0a] z-[60] overflow-y-auto">
      <div className="safe-area-top bg-[#0a0a0a] p-4 flex items-center gap-3 border-b border-white/10 sticky top-0">
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

// Cloud Import Sheet
const ImportSheet = ({ isOpen, onClose, onImport }) => {
  const fileRef = useRef(null);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-2">Import Conversations</h3>
        <p className="text-gray-500 text-sm mb-4">Import your chat history from other platforms</p>
        
        <input
          type="file"
          ref={fileRef}
          accept=".zip,.json"
          onChange={(e) => onImport(e.target.files?.[0])}
          className="hidden"
        />
        
        <button 
          onClick={() => fileRef.current?.click()}
          className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3 mb-2"
        >
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Paperclip className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <span className="text-white font-medium">ChatGPT Export</span>
            <p className="text-gray-500 text-xs">Upload conversations.json or ZIP file</p>
          </div>
        </button>
        
        <button onClick={onClose} className="w-full mt-4 p-4 text-gray-500 text-sm">
          Cancel
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
  initialConversationId = null 
}) {
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [selectedModel, setSelectedModel] = useState('smart'); // Default to Smart Mode
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [profile, setProfile] = useState(null);
  const [soulPrint, setSoulPrint] = useState(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [lastSmartSelection, setLastSmartSelection] = useState(null); // Track which model Smart Mode selected
  
  // AbortController for stopping requests
  const abortControllerRef = useRef(null);
  
  // New state for additional features
  const [showImageGenSheet, setShowImageGenSheet] = useState(false);
  const [showVideoGenSheet, setShowVideoGenSheet] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState('seedream-5-lite');
  const [selectedVideoModel, setSelectedVideoModel] = useState('kling-3-720p');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('1:1');
  const [mediaPrompt, setMediaPrompt] = useState('');
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingConversation, setRenamingConversation] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [showCompareMode, setShowCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState(['gpt-4o', 'claude-sonnet-4-5-20250929']);
  const [compareResponses, setCompareResponses] = useState(null);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Load conversations
  useEffect(() => {
    if (!token) return;
    fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [token]);

  // Load profile
  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.profile) setProfile(data.profile);
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
        setAnnouncements(Array.isArray(data.unread) ? data.unread : []);
      })
      .catch(console.error);
  }, [token]);

  // Load conversation messages
  useEffect(() => {
    if (!token || !conversationId) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: `Hey! I'm ${assistantName}. What's on your mind?`,
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
  }, [token, conversationId, assistantName]);

  // Process file for attachment
  const processFile = async (file) => {
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
      }
    }
    e.target.value = '';
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
      let smartModeReason = null;

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
              // Capture Smart Mode selection info
              if (data.smartMode) {
                actualModelUsed = data.selectedModel;
                smartModeReason = data.modelReason;
                setLastSmartSelection({ model: data.selectedModel, reason: data.modelReason });
              }
            } else if (data.type === 'delta') {
              fullContent += data.content;
              setStreamingContent(fullContent);
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
          smart_reason: smartModeReason,
        }]);
      }

      setStreamingContent('');
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
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: `Hey! I'm ${assistantName}. What's on your mind?`,
        }]);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // New conversation
  const newConversation = () => {
    setConversationId(null);
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: `Hey! I'm ${assistantName}. What's on your mind?`,
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

  // Handle cloud import
  const handleImport = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/chatgpt', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.imported > 0) {
        alert(`Successfully imported ${data.imported} conversations!`);
        // Refresh conversations
        fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => setConversations(Array.isArray(data) ? data : []));
      } else {
        alert('No conversations found to import.');
      }
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    setShowImportSheet(false);
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

  // Group models by provider
  const groupedModels = MODELS.reduce((acc, model) => {
    if (!acc[model.group]) acc[model.group] = [];
    acc[model.group].push(model);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
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
        <>
          <ChatHeader 
            assistantName={assistantName}
            model={MODELS.find(m => m.value === selectedModel)?.label || selectedModel}
            onModelClick={() => setShowModelPicker(true)}
            isOnline={true}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
            onMoreClick={() => setShowMoreOptions(true)}
          />
          
          {/* Messages */}
          <div className="pt-24 pb-44 overflow-y-auto">
            {messages.map((msg, idx) => (
              <MessageBubble 
                key={msg.id || idx} 
                message={msg} 
                isUser={msg.role === 'user'}
                assistantName={assistantName}
                onFeedback={handleFeedback}
                token={token}
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
            
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment Preview */}
          <AttachmentPreview 
            attachments={attachments} 
            onRemove={(idx) => setAttachments(prev => prev.filter((_, i) => i !== idx))}
          />

          {/* Input Area */}
          <div className="fixed left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-8 input-area-bottom">
            {/* Interim speech text */}
            {interimText && (
              <div className="text-gray-500 text-sm mb-2 px-2 italic">{interimText}</div>
            )}
            <div className="flex items-end gap-2">
              <button 
                onClick={() => setShowAttachmentSheet(true)}
                className="p-3 text-gray-500 hover:text-orange-400 transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl px-4 py-3 flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Message..."
                  className="flex-1 bg-transparent text-white text-[16px] placeholder-gray-600 focus:outline-none resize-none min-h-[24px] max-h-[120px]"
                  rows={1}
                  disabled={loading}
                />
                {/* Voice input button */}
                <button 
                  onClick={speech.toggle}
                  className={`p-2 rounded-full transition-all ${
                    speech.isListening 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'text-gray-500 hover:text-orange-400'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </button>
                {/* Show Stop button when loading, otherwise show Send button */}
                {loading ? (
                  <button 
                    onClick={stopRequest}
                    className="p-2 rounded-full bg-red-500 text-white transition-all animate-pulse"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                ) : (
                  <button 
                    onClick={sendMessage}
                    disabled={!input.trim() && !attachments.length}
                    className={`p-2 rounded-full transition-all ${
                      input.trim() || attachments.length
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/5 text-gray-600'
                    }`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="pt-4 pb-24">
          <div className="px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">Conversations</h1>
            <button 
              onClick={newConversation}
              className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
          
          <div className="mt-2">
            {conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No conversations yet</p>
                <button 
                  onClick={newConversation}
                  className="mt-4 text-orange-400 text-sm font-medium"
                >
                  Start your first chat →
                </button>
              </div>
            ) : (
              conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === conversationId}
                  onClick={() => loadConversation(conv.id)}
                  onDelete={deleteConversation}
                  onRename={openRenameModal}
                />
              ))
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
        />
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
          <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="text-white font-semibold text-lg mb-4">Select Model</h3>
            
            {/* Smart Mode - Featured at top */}
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
                      🧠 Smart Mode
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
        onImport={() => setShowImportSheet(true)}
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
        onClose={() => setShowImportSheet(false)}
        onImport={handleImport}
      />

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
      `}</style>
    </div>
  );
}
