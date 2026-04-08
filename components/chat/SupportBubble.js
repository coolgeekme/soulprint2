'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Minus, Send, Loader2, AlertTriangle } from 'lucide-react';

const ACE_AVATAR = 'https://customer-assets.emergentagent.com/job_04f65d68-fd79-43ef-a03b-b9263d8f6209/artifacts/3s5ouxqh_9BCBB119-5703-48DD-B2AC-8A3C81920B84.png';

const LS_POS_KEY = 'ace_position';
const LS_DISMISS_KEY = 'ace_dismissed';

function clamp(x, y, w, h) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  return { x: Math.max(0, Math.min(x, vw - w)), y: Math.max(0, Math.min(y, vh - h)) };
}

function loadPos(def) {
  try { const p = JSON.parse(localStorage.getItem(LS_POS_KEY)); if (p?.x != null) return p; } catch {} return def;
}
function savePos(p) { try { localStorage.setItem(LS_POS_KEY, JSON.stringify(p)); } catch {} }
function loadDismissed() { try { return localStorage.getItem(LS_DISMISS_KEY) === 'true'; } catch { return false; } }
function saveDismissed(v) { try { localStorage.setItem(LS_DISMISS_KEY, v ? 'true' : 'false'); } catch {} }

export default function SupportBubble({ token, conversationId, recentMessages = [] }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showEscalation, setShowEscalation] = useState(false);
  const [escalationDesc, setEscalationDesc] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [escalationSubject, setEscalationSubject] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalationSent, setEscalationSent] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Position state (x/y in px from top-left of viewport)
  const [position, setPosition] = useState(null);
  const posRef = useRef(null);
  const bubbleRef = useRef(null);

  // Drag refs
  const dragging = useRef(false);
  const moved = useRef(false);
  const startPt = useRef({ px: 0, py: 0, sx: 0, sy: 0 });

  // Init on mount
  useEffect(() => {
    setDismissed(loadDismissed());
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    // Set initial position
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mob = vw < 768;
    const def = { x: vw - (mob ? 70 : 80), y: vh - (mob ? 200 : 100) };
    const loaded = clamp(loadPos(def).x, loadPos(def).y, 64, 64);
    setPosition(loaded);
    posRef.current = loaded;
    return () => window.removeEventListener('resize', check);
  }, []);

  // Keep in bounds on resize
  useEffect(() => {
    const h = () => {
      if (!posRef.current) return;
      const c = clamp(posRef.current.x, posRef.current.y, 64, 64);
      posRef.current = c;
      setPosition(c);
      savePos(c);
    };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current && open && !minimized) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, minimized]);

  // Focus input on open
  useEffect(() => {
    if (open && !minimized && inputRef.current) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open, minimized]);

  // Welcome message
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: "Hey! 👋 I'm Ace, your SoulPrint AI Support Agent. I can help with anything — chat features, image & video generation tips, account issues, prompting advice, or troubleshooting.\n\nWhat can I help you with?" }]);
    }
  }, [open]);

  // ─── Drag via document-level listeners ───
  const onDown = useCallback((e) => {
    // Ignore if it's inside interactive elements of the chat panel
    if (e.target.closest('textarea, input, [data-no-drag]')) return;
    dragging.current = true;
    moved.current = false;
    startPt.current = { px: e.clientX, py: e.clientY, sx: posRef.current?.x ?? 0, sy: posRef.current?.y ?? 0 };

    const onMove = (ev) => {
      if (!dragging.current) return;
      const dx = ev.clientX - startPt.current.px;
      const dy = ev.clientY - startPt.current.py;
      if (!moved.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      moved.current = true;
      const sz = dismissed ? 28 : 64;
      const np = clamp(startPt.current.sx + dx, startPt.current.sy + dy, sz, sz);
      posRef.current = np;
      if (bubbleRef.current) {
        bubbleRef.current.style.left = `${np.x}px`;
        bubbleRef.current.style.top = `${np.y}px`;
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (!dragging.current) return;
      dragging.current = false;
      if (moved.current && posRef.current) {
        setPosition({ ...posRef.current });
        savePos(posRef.current);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [dismissed]);

  // ─── API handlers ───
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const payload = { message: userMsg, sessionId, chatHistory: messages.slice(-10) };
      if (conversationId && recentMessages.length > 0) {
        payload.conversationContext = { conversationId, recentMessages: recentMessages.slice(-6).map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content.substring(0, 300) : '' })) };
      }
      const res = await fetch('/api/support/bot-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
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
      const res = await fetch('/api/support/escalate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ subject: escalationSubject || 'Support Escalation', description: escalationDesc, sessionId, conversationId }) });
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

  // Click handlers (only fire if NOT a drag)
  const handleBubbleClick = () => {
    if (moved.current) return;
    if (minimized) { setMinimized(false); setOpen(true); }
    else if (open) { setMinimized(true); }
    else { setOpen(true); }
    setHasUnread(false);
  };

  const handleDismiss = (e) => {
    e?.stopPropagation();
    setOpen(false);
    setMinimized(false);
    setDismissed(true);
    saveDismissed(true);
  };

  const handleRestore = () => {
    if (moved.current) return;
    setDismissed(false);
    saveDismissed(false);
  };

  // Not ready yet
  if (!position) return null;

  // ─── DISMISSED: tiny avatar dot ───
  if (dismissed) {
    return (
      <div
        ref={bubbleRef}
        onPointerDown={onDown}
        onClick={handleRestore}
        className="fixed z-[9999] select-none touch-none"
        style={{ left: position.x, top: position.y, cursor: 'grab' }}
      >
        <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-orange-500/60 shadow-lg hover:scale-125 active:scale-95 transition-transform"
          style={{ boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}>
          <img src={ACE_AVATAR} alt="Ace" className="w-full h-full object-cover" style={{ objectPosition: 'center 25%' }} draggable={false} />
        </div>
      </div>
    );
  }

  // ─── CLOSED / MINIMIZED: full bubble ───
  if (!open || minimized) {
    return (
      <div
        ref={bubbleRef}
        onPointerDown={onDown}
        onClick={handleBubbleClick}
        className="fixed z-[9999] select-none touch-none group"
        style={{ left: position.x, top: position.y, cursor: 'grab' }}
      >
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-semibold text-orange-400 mb-1 opacity-80 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded-full border border-orange-500/20"
            style={{ backgroundColor: 'var(--theme-bg)', backdropFilter: 'blur(8px)' }}>
            Ask Ace
          </span>
          <div className="relative">
            <div className="rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 overflow-hidden border-2 border-orange-500/50"
              style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              <img src={ACE_AVATAR} alt="Ace" className="w-full h-full object-cover" style={{ objectPosition: 'center 25%' }} draggable={false} />
            </div>
            {hasUnread && (
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 rounded-full animate-pulse" style={{ borderWidth: 2, borderColor: 'var(--theme-bg)' }} />
            )}
            {minimized && (
              <span className="absolute bottom-0 left-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center" style={{ borderWidth: 2, borderColor: 'var(--theme-bg)' }}>
                <Minus className="w-3 h-3 text-white" />
              </span>
            )}
          </div>
        </div>
        {/* Dismiss X */}
        <button
          data-no-drag="true"
          onClick={handleDismiss}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-700/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 transition-all"
          style={{ borderWidth: 1, borderColor: 'var(--theme-border)' }}
          title="Dismiss Ace"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    );
  }

  // ─── OPEN: chat window ───
  const chatW = isMobile ? Math.min(typeof window !== 'undefined' ? window.innerWidth - 20 : 360, 360) : 380;
  const chatH = isMobile ? Math.min(typeof window !== 'undefined' ? window.innerHeight - 100 : 500, 500) : 520;
  const chatPos = clamp(position.x - chatW + 60, position.y - chatH - 10, chatW, chatH);

  return (
    <>
      {/* Anchor bubble (faded, draggable) */}
      <div
        ref={bubbleRef}
        onPointerDown={onDown}
        className="fixed z-[9998] select-none touch-none"
        style={{ left: position.x, top: position.y, cursor: 'grab' }}
      >
        <div className="rounded-full shadow-lg overflow-hidden border-2 border-orange-500/30 opacity-30"
          style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56 }}>
          <img src={ACE_AVATAR} alt="Ace" className="w-full h-full object-cover" style={{ objectPosition: 'center 25%' }} draggable={false} />
        </div>
      </div>

      {/* Chat panel */}
      <div className="fixed z-[9999] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        style={{
          left: chatPos.x, top: chatPos.y, width: chatW, height: chatH,
          maxHeight: 'calc(100vh - 40px)',
          background: 'var(--theme-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header (draggable) */}
        <div
          onPointerDown={onDown}
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--theme-border)', background: 'var(--theme-bg-secondary)', cursor: 'grab' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-orange-500/30">
              <img src={ACE_AVATAR} alt="Ace" className="w-full h-full object-cover" style={{ objectPosition: 'center 25%' }} draggable={false} />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight" style={{ color: 'var(--theme-text)' }}>Ace</h3>
              <p className="text-green-400 text-[10px] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> AI Support Agent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button data-no-drag="true" onClick={() => setMinimized(true)}
              className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--theme-text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--theme-text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--theme-text-muted)'}
              title="Minimize"><Minus className="w-4 h-4" /></button>
            <button data-no-drag="true" onClick={handleDismiss}
              className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--theme-text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--theme-text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--theme-text-muted)'}
              title="Dismiss Ace"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${msg.role === 'user' ? 'bg-orange-500 text-white rounded-br-md' : 'rounded-bl-md'}`}
                style={msg.role !== 'user' ? { backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)', border: '1px solid var(--theme-border)' } : undefined}
              >
                {msg.content.split('\n').map((line, j) => (
                  <React.Fragment key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</React.Fragment>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ backgroundColor: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)' }}>
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
          <div className="px-3 py-3 space-y-2 flex-shrink-0" style={{ borderTop: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
            <div className="flex items-center justify-between">
              <p className="text-orange-400 text-xs font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Escalate to Human Support</p>
              <button onClick={() => setShowEscalation(false)} className="p-1" style={{ color: 'var(--theme-text-muted)' }}><X className="w-3.5 h-3.5" /></button>
            </div>
            <input value={escalationSubject} onChange={e => setEscalationSubject(e.target.value)} placeholder="Subject (optional)"
              className="w-full rounded-lg px-3 py-1.5 text-xs outline-none transition-colors"
              style={{ backgroundColor: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-text)' }} />
            <textarea value={escalationDesc} onChange={e => setEscalationDesc(e.target.value)} placeholder="Describe your issue in detail..." rows={3}
              className="w-full rounded-lg px-3 py-1.5 text-xs outline-none resize-none transition-colors"
              style={{ backgroundColor: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-text)' }} />
            <button onClick={handleEscalate} disabled={escalating || !escalationDesc.trim()}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
              {escalating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {escalating ? 'Sending...' : 'Send to Support Team'}
            </button>
          </div>
        )}

        {/* Input */}
        <div className="px-3 py-2.5 flex-shrink-0" style={{ borderTop: '1px solid var(--theme-border)', background: 'var(--theme-bg-secondary)' }}>
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask anything..." rows={1}
                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none resize-none max-h-[80px] overflow-y-auto transition-colors"
                style={{ backgroundColor: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-text)', minHeight: 40 }} />
            </div>
            <button onClick={handleSend} disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center disabled:opacity-30 transition-all flex-shrink-0"
              style={!input.trim() || loading ? { backgroundColor: 'var(--theme-bg-tertiary, var(--theme-bg-secondary))' } : undefined}>
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>Powered by GPT-4o</p>
            {!showEscalation && !escalationSent && (
              <button onClick={() => setShowEscalation(true)} className="text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors">Escalate to support →</button>
            )}
            {escalationSent && <span className="text-[10px] text-green-400">✓ Escalation submitted</span>}
          </div>
        </div>
      </div>
    </>
  );
}
