'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircleQuestion, X, Minus, Send, Loader2, AlertTriangle, ChevronDown } from 'lucide-react';

const ACE_AVATAR = 'https://customer-assets.emergentagent.com/job_04f65d68-fd79-43ef-a03b-b9263d8f6209/artifacts/3s5ouxqh_9BCBB119-5703-48DD-B2AC-8A3C81920B84.png';

export default function SupportBubble({ token, conversationId, recentMessages = [] }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showEscalation, setShowEscalation] = useState(false);
  const [escalationDesc, setEscalationDesc] = useState('');
  const [escalationSubject, setEscalationSubject] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalationSent, setEscalationSent] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatEndRef.current && open && !minimized) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, minimized]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, minimized]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hey! 👋 I'm Ace, your SoulPrint AI Support Agent. I can help with anything — chat features, image & video generation tips, account issues, prompting advice, or troubleshooting.\n\nWhat can I help you with?",
      }]);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const payload = {
        message: userMsg,
        sessionId,
        chatHistory: messages.slice(-10),
      };

      // Pass conversation context if available
      if (conversationId && recentMessages.length > 0) {
        payload.conversationContext = {
          conversationId,
          recentMessages: recentMessages.slice(-6).map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content.substring(0, 300) : '',
          })),
        };
      }

      const res = await fetch('/api/support/bot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, something went wrong.' }]);
      if (data.sessionId) setSessionId(data.sessionId);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again." }]);
    }
    setLoading(false);
  }, [input, loading, messages, sessionId, conversationId, recentMessages, token]);

  const handleEscalate = async () => {
    if (!escalationDesc.trim()) return;
    setEscalating(true);
    try {
      const res = await fetch('/api/support/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: escalationSubject || 'Support Escalation',
          description: escalationDesc,
          sessionId,
          conversationId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEscalationSent(true);
        setMessages(prev => [...prev, { role: 'assistant', content: `✅ Your issue has been escalated to our support team (Ticket #${data.ticketId?.slice(0, 8)}). We'll review it and get back to you soon!` }]);
        setShowEscalation(false);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Failed to submit escalation. Please try again." }]);
    }
    setEscalating(false);
  };

  const toggleOpen = () => {
    if (minimized) {
      setMinimized(false);
      setOpen(true);
    } else if (open) {
      setMinimized(true);
    } else {
      setOpen(true);
    }
    setHasUnread(false);
  };

  // Minimized / closed bubble
  if (!open || minimized) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-5 right-5 z-[9999] w-14 h-14 rounded-full shadow-lg shadow-black/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 group overflow-hidden border-2 border-orange-500/50"
        title="Ask Ace"
      >
        <img src={ACE_AVATAR} alt="Ace" className="w-full h-full object-cover" />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-[#0a0a0a] animate-pulse" />
        )}
        {minimized && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-[#0a0a0a] flex items-center justify-center">
            <Minus className="w-3 h-3 text-white" />
          </span>
        )}
      </button>
    );
  }

  // Expanded chat window
  return (
    <div className="fixed bottom-5 right-5 z-[9999] w-[380px] max-w-[calc(100vw-40px)] h-[520px] max-h-[calc(100vh-100px)] bg-[#0f1318] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500/10 to-transparent border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-orange-500/30">
            <img src={ACE_AVATAR} alt="Ace" className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="text-white text-sm font-semibold leading-tight">Ace</h3>
            <p className="text-green-400 text-[10px] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> AI Support Agent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors" title="Minimize">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={() => { setOpen(false); setMinimized(false); }} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
              msg.role === 'user'
                ? 'bg-orange-500 text-white rounded-br-md'
                : 'bg-white/7 text-gray-200 border border-white/5 rounded-bl-md'
            }`}>
              {msg.content.split('\n').map((line, j) => (
                <React.Fragment key={j}>
                  {line}
                  {j < msg.content.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/7 border border-white/5 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-orange-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-orange-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-orange-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Escalation Panel */}
      {showEscalation && (
        <div className="px-3 py-3 border-t border-white/8 bg-red-500/5 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-orange-400 text-xs font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Escalate to Human Support
            </p>
            <button onClick={() => setShowEscalation(false)} className="text-gray-500 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            value={escalationSubject}
            onChange={e => setEscalationSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500/40"
          />
          <textarea
            value={escalationDesc}
            onChange={e => setEscalationDesc(e.target.value)}
            placeholder="Describe your issue in detail..."
            rows={3}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500/40 resize-none"
          />
          <button
            onClick={handleEscalate}
            disabled={escalating || !escalationDesc.trim()}
            className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            {escalating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {escalating ? 'Sending...' : 'Send to Support Team'}
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-white/8 flex-shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask anything..."
              rows={1}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder-gray-500 outline-none focus:border-orange-500/40 resize-none max-h-[80px] overflow-y-auto transition-colors"
              style={{ minHeight: '40px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center disabled:opacity-30 disabled:bg-white/10 transition-all flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px] text-gray-600">Powered by GPT-4o</p>
          {!showEscalation && !escalationSent && (
            <button
              onClick={() => setShowEscalation(true)}
              className="text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors"
            >
              Escalate to support →
            </button>
          )}
          {escalationSent && (
            <span className="text-[10px] text-green-400">✓ Escalation submitted</span>
          )}
        </div>
      </div>
    </div>
  );
}
