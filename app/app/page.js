'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Plus, Mic, Send, Settings, ChevronLeft, ThumbsUp, ThumbsDown,
  MessageSquare, Upload, X, ChevronDown, Loader2, FileText
} from 'lucide-react';

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Best)', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)', provider: 'openai' },
  { value: 'gpt-4.1', label: 'GPT-4.1 (Advanced)', provider: 'openai' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (Balanced)', provider: 'openai' },
];

function SoulPrintLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <path d="M40 8 C55 8, 70 18, 70 35 C70 52, 55 62, 40 55 C25 48, 15 35, 22 22 C29 9, 42 12, 48 20 C54 28, 50 40, 42 44 C34 48, 28 42, 30 36 C32 30, 38 28, 42 32" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9"/>
      <path d="M40 14 C52 14, 64 22, 64 36 C64 50, 52 58, 40 52 C28 46, 20 34, 26 24 C32 14, 44 16, 49 23 C54 30, 51 40, 44 43 C37 46, 32 41, 34 36 C36 31, 40 30, 43 33" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6"/>
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0,1,2].map(i => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full bg-orange-500/60 typing-dot`} style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

// Settings / Imports Modal
function SettingsModal({ onClose, token }) {
  const [activeTab, setActiveTab] = useState('imports');
  const [imports, setImports] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    fetch('/api/imports', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setImports(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setProfile(d.profile))
      .catch(() => {});
  }, [token]);

  async function handleUpload(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    try {
      const res = await fetch('/api/imports/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        setTimeout(() => {
          fetch('/api/imports', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => setImports(Array.isArray(d) ? d : []));
        }, 1000);
      }
    } catch (e) { console.error(e); }
    setUploading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-semibold">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {['imports', 'profile'].map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-xs font-bold tracking-widest uppercase transition-colors ${activeTab === tab ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'imports' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-sm font-semibold mb-1">Import Your Data</h3>
                <p className="text-gray-500 text-xs mb-4">Upload your ChatGPT or Facebook data to build a richer SoulProfile. Your AI will use this to understand you better.</p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-xl p-4 border border-white/10 bg-white/3">
                    <FileText className="w-6 h-6 text-green-400 mb-2" />
                    <p className="text-white text-sm font-medium mb-1">ChatGPT Export</p>
                    <p className="text-gray-600 text-xs mb-3">conversations.json or export.zip</p>
                    <input ref={fileRef} type="file" accept=".json,.zip" className="hidden"
                      onChange={e => handleUpload(e, 'chatgpt')} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full py-2 text-xs btn-orange rounded-lg disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                  <div className="rounded-xl p-4 border border-white/10 bg-white/3">
                    <FileText className="w-6 h-6 text-blue-400 mb-2" />
                    <p className="text-white text-sm font-medium mb-1">Facebook Archive</p>
                    <p className="text-gray-600 text-xs mb-3">messages.json or archive.zip</p>
                    <input type="file" accept=".json,.zip" className="hidden" id="fb-upload"
                      onChange={e => handleUpload(e, 'facebook')} />
                    <label htmlFor="fb-upload"
                      className="block w-full py-2 text-xs btn-orange rounded-lg text-center cursor-pointer"
                    >
                      Upload
                    </label>
                  </div>
                </div>

                {imports.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-3">Import History</p>
                    <div className="space-y-2">
                      {imports.map(imp => (
                        <div key={imp.id} className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/5">
                          <div>
                            <p className="text-white text-xs font-medium">{imp.file_name}</p>
                            <p className="text-gray-600 text-[10px]">{imp.type} · {new Date(imp.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            imp.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                            imp.status === 'error' ? 'bg-red-500/20 text-red-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {imp.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {profile?.soul_profile_summary && (
                <div>
                  <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Your Soul Profile Summary</p>
                  <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                    <p className="text-gray-300 text-xs leading-relaxed">{profile.soul_profile_summary}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && profile && (
            <div className="space-y-4">
              <div>
                <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Display Name</p>
                <p className="text-white text-sm">{profile.display_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Assistant Name</p>
                <p className="text-white text-sm">{profile.assistant_name || 'SoulPrint'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Field</p>
                <p className="text-white text-sm">{profile.field || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Role</p>
                <p className="text-white text-sm">{profile.descriptors?.join(', ') || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Help With</p>
                <div className="flex flex-wrap gap-1">
                  {(profile.help_with || []).map(h => (
                    <span key={h} className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">{h}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [user, setUser] = useState(null);
  const [assistantName, setAssistantName] = useState('SoulPrint');
  const [token, setToken] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = localStorage.getItem('sp_token');
    const u = localStorage.getItem('sp_user');
    if (!t) { router.push('/auth'); return; }
    setToken(t);

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.accepted && d.role === 'user') { router.push('/waitlist'); return; }
        setUser(d);
        setAssistantName(d.profile?.assistant_name || 'SoulPrint');

        // Add greeting message
        const greet = d.profile?.display_name || 'there';
        const botName = d.profile?.assistant_name || 'SoulPrint';
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: `Hey ${greet} 👋 I'm **${botName}**, your personal AI. I've learned about your communication style and what matters to you.\n\nWhat's on your mind today?`,
          created_at: new Date().toISOString(),
        }]);
      })
      .catch(() => router.push('/auth'));

    fetch('/api/conversations', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => setConversations(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput('');
    setLoading(true);
    setStreamingContent('');

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev.filter(m => m.id !== 'greeting' || prev.length === 1), userMsg]);

    let fullContent = '';
    let newConvId = conversationId;

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: newConvId,
          content,
          model: selectedModel,
          provider: 'hosted',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => [...prev, {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.error || 'Something went wrong'}`,
          created_at: new Date().toISOString(),
        }]);
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
            } else if (data.type === 'delta') {
              fullContent += data.content;
              setStreamingContent(fullContent);
            } else if (data.type === 'done') {
              setMessages(prev => [...prev, {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: fullContent,
                created_at: new Date().toISOString(),
                model_used: selectedModel,
              }]);
              setStreamingContent('');
              // Refresh conversations
              fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(d => setConversations(Array.isArray(d) ? d : []));
            } else if (data.type === 'error') {
              setMessages(prev => [...prev, {
                id: `e-${Date.now()}`,
                role: 'assistant',
                content: `Error: ${data.error}`,
                created_at: new Date().toISOString(),
              }]);
              setStreamingContent('');
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'Connection error. Please try again.',
        created_at: new Date().toISOString(),
      }]);
      setStreamingContent('');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, token, selectedModel, conversationId]);

  async function loadConversation(convId) {
    setConversationId(convId);
    setMessages([]);
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const msgs = await res.json();
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {}
    setShowSidebar(false);
  }

  function newConversation() {
    setConversationId(null);
    const greet = user?.profile?.display_name || 'there';
    const botName = user?.profile?.assistant_name || 'SoulPrint';
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: `Hey ${greet} 👋 Starting fresh! What's on your mind?`,
      created_at: new Date().toISOString(),
    }]);
    setShowSidebar(false);
  }

  async function submitFeedback(messageId, rating) {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversation_id: conversationId, message_id: messageId, rating }),
    }).catch(() => {});
  }

  const currentModel = MODELS.find(m => m.value === selectedModel) || MODELS[0];

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Sidebar */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setShowSidebar(false)} />
      )}
      <div className={`fixed lg:relative z-50 h-full w-64 bg-[#0f0f0f] border-r border-white/5 flex flex-col transform transition-transform duration-200 ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <SoulPrintLogo size={22} />
            <span className="font-condensed font-bold text-white text-sm tracking-widest uppercase">{assistantName}</span>
          </div>
          <button onClick={newConversation} className="w-full btn-orange py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="text-gray-700 text-xs text-center mt-6">No conversations yet</p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs text-gray-400 hover:bg-white/5 hover:text-white transition-all mb-1 truncate ${conv.id === conversationId ? 'bg-white/5 text-white' : ''}`}
              >
                <MessageSquare className="w-3 h-3 inline mr-2 opacity-50" />
                {conv.title || 'Conversation'}
              </button>
            ))
          )}
        </div>
        <div className="p-3 border-t border-white/5">
          <p className="text-gray-700 text-[10px] text-center">{user?.email}</p>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
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
          <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
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
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-orange-500/15 border border-orange-500/20 text-white'
                      : 'bg-white/4 border border-white/8 text-gray-200'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                          code: ({inline, children}) => inline
                            ? <code className="bg-white/10 px-1 rounded text-orange-300 text-xs">{children}</code>
                            : <pre className="bg-[#0a0a0a] p-3 rounded-lg mt-2 overflow-x-auto text-xs"><code>{children}</code></pre>,
                          ul: ({children}) => <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal pl-4 space-y-1 mb-2">{children}</ol>,
                          strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                          a: ({href, children}) => <a href={href} className="text-orange-400 underline hover:text-orange-300">{children}</a>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>

                  {msg.role === 'assistant' && msg.id !== 'greeting' && (
                    <div className="flex items-center gap-2 mt-1.5 ml-1">
                      <button onClick={() => submitFeedback(msg.id, 'up')}
                        className="text-gray-700 hover:text-green-400 transition-colors">
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => submitFeedback(msg.id, 'down')}
                        className="text-gray-700 hover:text-red-400 transition-colors">
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      {msg.model_used && (
                        <span className="text-[10px] text-gray-700">{msg.model_used}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming */}
            {streamingContent && (
              <div className="msg-appear flex justify-start">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                  <SoulPrintLogo size={14} />
                </div>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white/4 border border-white/8 text-sm text-gray-200 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                    }}
                  >
                    {streamingContent}
                  </ReactMarkdown>
                  <span className="inline-block w-0.5 h-4 bg-orange-500 ml-0.5 animate-pulse" />
                </div>
              </div>
            )}

            {loading && !streamingContent && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-3 flex-shrink-0">
                  <SoulPrintLogo size={14} />
                </div>
                <TypingIndicator />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 px-4 pb-6">
          <div className="max-w-2xl mx-auto">
            {/* Model selector */}
            <div className="flex justify-center mb-2 relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors bg-white/4 border border-white/8 px-3 py-1.5 rounded-full"
              >
                <span>{currentModel.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showModelPicker && (
                <div className="absolute bottom-full mb-2 bg-[#111] border border-white/10 rounded-xl p-1.5 shadow-2xl min-w-[220px] z-10">
                  {MODELS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => { setSelectedModel(m.value); setShowModelPicker(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${selectedModel === m.value ? 'bg-orange-500/15 text-orange-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="flex items-center gap-2 bg-[#111] border border-white/10 rounded-2xl px-3 py-2 focus-within:border-orange-500/30 transition-colors">
              <button className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0">
                <Plus className="w-5 h-5" />
              </button>
              <button className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0">
                <Mic className="w-5 h-5" />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Enter command…"
                className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none py-1.5"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} token={token} />}
    </div>
  );
}
