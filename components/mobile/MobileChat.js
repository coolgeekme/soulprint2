'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, MessageSquare, User, Sparkles, ChevronDown, 
  Mic, Plus, Settings, X, Check, Loader2, Globe,
  Image as ImageIcon, MoreHorizontal, ArrowLeft
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SoulPrintLogo from '@/components/SoulPrintLogo';

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
                isActive 
                  ? 'bg-orange-500/15' 
                  : 'hover:bg-white/5'
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

// Minimal Chat Header
const ChatHeader = ({ assistantName, model, onModelClick, isOnline }) => (
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
        <button className="p-2 text-gray-500 hover:text-white transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
);

// Message Bubble - Mobile optimized
const MessageBubble = ({ message, isUser, assistantName }) => {
  if (isUser) {
    return (
      <div className="flex justify-end mb-4 px-4">
        <div className="max-w-[85%] bg-orange-500/20 border border-orange-500/30 rounded-3xl rounded-br-lg px-4 py-3">
          <p className="text-white text-[15px] leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4 px-4">
      <div className="max-w-[90%]">
        <div className="bg-white/5 rounded-3xl rounded-bl-lg px-4 py-3">
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
        </div>
        {message.model_used && (
          <span className="text-[10px] text-gray-600 ml-2 mt-1 block">{message.model_used}</span>
        )}
      </div>
    </div>
  );
};

// Conversation List Item
const ConversationItem = ({ conversation, isActive, onClick }) => (
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
      <span className="text-gray-600 text-[10px]">
        {conversation.updated_at ? new Date(conversation.updated_at).toLocaleDateString() : ''}
      </span>
    </div>
  </button>
);

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
  const [profile, setProfile] = useState(null);
  const [soulPrint, setSoulPrint] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
      .then(data => setConversations(data.conversations || []))
      .catch(console.error);
  }, [token]);

  // Load profile - using /api/auth/me which returns profile info
  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.profile) {
          setProfile(data.profile);
        }
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

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = { id: `u-${Date.now()}`, role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: userMessage.content,
          conversation_id: conversationId,
          model: selectedModel,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let newConvId = conversationId;

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
              if (parsed.conversation_id) newConvId = parsed.conversation_id;
            } catch {}
          }
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

  // Models
  const MODELS = [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet' },
    { value: 'gemini-2.0-flash', label: 'Gemini Flash' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <>
          <ChatHeader 
            assistantName={assistantName}
            model={MODELS.find(m => m.value === selectedModel)?.label || selectedModel}
            onModelClick={() => setShowModelPicker(true)}
            isOnline={true}
          />
          
          {/* Messages */}
          <div className="pt-24 pb-36 overflow-y-auto">
            {messages.map((msg, idx) => (
              <MessageBubble 
                key={msg.id || idx} 
                message={msg} 
                isUser={msg.role === 'user'}
                assistantName={assistantName}
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

          {/* Input Area */}
          <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-8 safe-area-bottom">
            <div className="flex items-end gap-2">
              <button className="p-3 text-gray-500 hover:text-orange-400 transition-colors">
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
                <button 
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className={`p-2 rounded-full transition-all ${
                    input.trim() && !loading
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end">
          <div className="w-full bg-[#111] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up">
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="text-white font-semibold text-lg mb-4">Select Model</h3>
            <div className="space-y-2">
              {MODELS.map(model => (
                <button
                  key={model.value}
                  onClick={() => { setSelectedModel(model.value); setShowModelPicker(false); }}
                  className={`w-full p-4 rounded-2xl text-left transition-colors ${
                    selectedModel === model.value
                      ? 'bg-orange-500/15 border border-orange-500/30'
                      : 'bg-white/5 border border-transparent'
                  }`}
                >
                  <span className={`font-medium ${selectedModel === model.value ? 'text-orange-400' : 'text-white'}`}>
                    {model.label}
                  </span>
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowModelPicker(false)}
              className="w-full mt-4 p-4 text-gray-500 text-sm"
            >
              Cancel
            </button>
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
      `}</style>
    </div>
  );
}
