'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  MessageSquare, ChevronLeft, Clock, Bot, User, 
  ExternalLink, Lock, Eye, Loader2, AlertCircle, Image as ImageIcon
} from 'lucide-react';

// Simple markdown-like rendering for message content
function renderContent(content) {
  if (!content) return null;
  
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3);
      const firstNewline = code.indexOf('\n');
      const lang = firstNewline > 0 ? code.slice(0, firstNewline).trim() : '';
      const codeContent = firstNewline > 0 ? code.slice(firstNewline + 1) : code;
      return (
        <pre key={i} className="bg-black/40 rounded-lg p-3 my-2 overflow-x-auto text-xs">
          {lang && <div className="text-gray-500 text-[10px] mb-1">{lang}</div>}
          <code className="text-green-300">{codeContent}</code>
        </pre>
      );
    }
    
    // Process inline formatting
    return (
      <span key={i}>
        {part.split('\n').map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {line.split(/(\*\*.*?\*\*)/g).map((seg, k) => {
              if (seg.startsWith('**') && seg.endsWith('**')) {
                return <strong key={k} className="font-semibold">{seg.slice(2, -2)}</strong>;
              }
              return seg;
            })}
          </span>
        ))}
      </span>
    );
  });
}

export default function SharedProjectPage() {
  const params = useParams();
  const shareCode = params.code;
  
  const [project, setProject] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load project data
  useEffect(() => {
    async function loadProject() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/project/${shareCode}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Project not found or not publicly shared');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setProject(data.project);
        setConversations(data.conversations || []);
      } catch (e) {
        setError('Failed to load project');
      }
      setLoading(false);
    }
    if (shareCode) loadProject();
  }, [shareCode]);

  // Load conversation messages
  async function loadMessages(conv) {
    setSelectedConv(conv);
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/public/project/${shareCode}/conversation/${conv.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
    setMessagesLoading(false);
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Go to SoulPrint <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0d1117]/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ backgroundColor: project?.color + '30' }}
          >
            {project?.icon || '📁'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">{project?.name}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Eye className="w-3 h-3" />
              <span>Public view by {project?.owner_name}</span>
              <span>•</span>
              <span>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-[10px] font-medium">
              Read Only
            </span>
            <a
              href="/"
              className="px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 rounded-lg text-orange-400 text-xs transition-colors"
            >
              Join SoulPrint
            </a>
          </div>
        </div>
      </header>

      {project?.description && (
        <div className="max-w-5xl mx-auto px-4 py-3 border-b border-white/5">
          <p className="text-gray-400 text-sm">{project.description}</p>
        </div>
      )}

      <div className="max-w-5xl mx-auto flex" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Conversation sidebar */}
        <div className={`${selectedConv ? 'hidden md:block' : 'block'} w-full md:w-80 border-r border-white/10 overflow-y-auto`}>
          <div className="p-3">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-3 px-2">Conversations</p>
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">No conversations yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => loadMessages(conv)}
                    className={`w-full text-left p-3 rounded-xl transition-colors ${
                      selectedConv?.id === conv.id
                        ? 'bg-orange-500/10 border border-orange-500/20'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className={`w-4 h-4 shrink-0 ${selectedConv?.id === conv.id ? 'text-orange-400' : 'text-gray-600'}`} />
                      <span className={`text-sm truncate ${selectedConv?.id === conv.id ? 'text-orange-400' : 'text-white'}`}>
                        {conv.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-6 text-[10px] text-gray-600">
                      <span>{conv.message_count} messages</span>
                      <span>•</span>
                      <Clock className="w-2.5 h-2.5" />
                      <span>{new Date(conv.updated_at || conv.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message view */}
        <div className={`${selectedConv ? 'block' : 'hidden md:flex md:items-center md:justify-center'} flex-1 overflow-y-auto`}>
          {!selectedConv ? (
            <div className="text-center px-4">
              <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Select a conversation to view</p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Conversation header */}
              <div className="border-b border-white/10 p-3 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => { setSelectedConv(null); setMessages([]); }}
                  className="md:hidden p-1 hover:bg-white/10 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-400" />
                </button>
                <MessageSquare className="w-4 h-4 text-orange-400 shrink-0" />
                <h2 className="text-sm font-medium text-white truncate">{selectedConv.title}</h2>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 text-sm">No messages in this conversation</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`flex gap-3 ${msg.role === 'user' ? '' : ''}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        msg.role === 'user' 
                          ? 'bg-blue-500/20' 
                          : 'bg-orange-500/20'
                      }`}>
                        {msg.role === 'user' 
                          ? <User className="w-3.5 h-3.5 text-blue-400" />
                          : <Bot className="w-3.5 h-3.5 text-orange-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${msg.role === 'user' ? 'text-blue-400' : 'text-orange-400'}`}>
                            {msg.role === 'user' ? 'User' : 'AI'}
                          </span>
                          {msg.model_used && (
                            <span className="text-[9px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">
                              {msg.model_used}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                          {renderContent(msg.content)}
                        </div>
                        {msg.image_url && (
                          <div className="mt-2">
                            <img 
                              src={msg.image_url} 
                              alt="Generated" 
                              className="max-w-sm rounded-xl border border-white/10"
                              loading="lazy"
                            />
                          </div>
                        )}
                        {msg.video_url && (
                          <div className="mt-2">
                            <video 
                              src={msg.video_url} 
                              controls 
                              className="max-w-sm rounded-xl border border-white/10"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Read-only notice */}
              <div className="border-t border-white/10 p-3 flex items-center justify-center gap-2 bg-[#0d1117]/50">
                <Eye className="w-4 h-4 text-gray-600" />
                <span className="text-gray-600 text-xs">This is a read-only view of a shared project</span>
                <a href="/" className="text-orange-400 text-xs hover:underline ml-2">Sign up to create your own</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
