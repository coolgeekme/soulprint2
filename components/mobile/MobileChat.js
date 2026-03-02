'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, MessageSquare, User, Sparkles, ChevronDown, 
  Mic, Plus, Settings, X, Check, Loader2, Globe,
  Image as ImageIcon, MoreHorizontal, ArrowLeft, Paperclip,
  Copy, Edit3, ThumbsUp, ThumbsDown, Trash2, MoreVertical,
  Video, Search, ChevronRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SoulPrintLogo from '@/components/SoulPrintLogo';

// Full MODELS list matching desktop
const MODELS = [
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
    { id: 'chat', icon: Sparkles, label: assistantName || 'Chat' },
    { id: 'history', icon: MessageSquare, label: 'History', badge: unreadCount },
    { id: 'soul', icon: User, label: 'Soul' },
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
                <Icon className={`w-6 h-6 transition-colors ${isActive ? 'text-orange-400' : 'text-gray-500'}`} />
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
        {message.model_used && (
          <span className="text-[10px] text-gray-600 ml-2 mt-1 block">{message.model_used}</span>
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

// Soul/Profile View
const SoulView = ({ profile, soulPrint, onSettingsClick }) => (
  <div className="min-h-screen bg-[#0a0a0a] pt-16 pb-24 px-4">
    <div className="text-center mb-8">
      <div className="w-24 h-24 mx-auto bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-full flex items-center justify-center mb-4">
        <SoulPrintLogo size={48} />
      </div>
      <h1 className="text-white text-xl font-semibold">{profile?.display_name || 'Your SoulPrint'}</h1>
      <p className="text-gray-500 text-sm mt-1">{profile?.email}</p>
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

    {/* Settings Button */}
    <button 
      onClick={onSettingsClick}
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors"
    >
      <span className="text-white text-sm">Settings & Privacy</span>
      <Settings className="w-5 h-5 text-gray-500" />
    </button>
  </div>
);

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

// More Options Menu (bottom sheet)
const MoreOptionsSheet = ({ isOpen, onClose, onImageGen, onVideoGen, onSettings }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">Options</h3>
        <div className="space-y-2">
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

// Attachment Options Sheet
const AttachmentSheet = ({ isOpen, onClose, onFileSelect, onCameraSelect }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">Add Attachment</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => { onFileSelect?.(); onClose(); }}
            className="p-4 rounded-2xl bg-white/5 flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Paperclip className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-white text-sm">File</span>
          </button>
          <button 
            onClick={() => { onCameraSelect?.(); onClose(); }}
            className="p-4 rounded-2xl bg-white/5 flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-white text-sm">Photo</span>
          </button>
        </div>
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
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [profile, setProfile] = useState(null);
  const [soulPrint, setSoulPrint] = useState(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  
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
    
    fetch(`/api/conversations/${conversationId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.messages) setMessages(data.messages);
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
          model_used: selectedModel,
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
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
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
                <button 
                  onClick={sendMessage}
                  disabled={(!input.trim() && !attachments.length) || loading}
                  className={`p-2 rounded-full transition-all ${
                    (input.trim() || attachments.length) && !loading
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/5 text-gray-600'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
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
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Soul Tab */}
      {activeTab === 'soul' && (
        <SoulView 
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
        />
      )}

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
            {Object.entries(groupedModels).map(([group, models]) => (
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

      {/* Attachment Sheet */}
      <AttachmentSheet 
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
