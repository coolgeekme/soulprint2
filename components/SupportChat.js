'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, HelpCircle, ChevronDown, RotateCcw } from 'lucide-react';

export default function SupportChat({ token, userEmail }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Initialize chat with greeting
  const initializeChat = () => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hi! I'm the SoulPrint Support Bot. 👋\n\nHow can I help you today? Describe any issue you're experiencing and I'll either help you troubleshoot it or escalate it to the team.",
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    initializeChat();
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleReset = () => {
    setMessages([{
      id: 'welcome-reset',
      role: 'assistant',
      content: "No problem! Let's start fresh. 🔄\n\nWhat issue would you like help with?",
      timestamp: new Date().toISOString()
    }]);
    setConversationId(null);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          userEmail
        })
      });

      const data = await res.json();

      if (res.ok) {
        setConversationId(data.conversationId);
        setMessages(prev => [...prev, {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
          escalated: data.escalated
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: "Sorry, I encountered an error. Please try again or email support directly.",
          timestamp: new Date().toISOString(),
          isError: true
        }]);
      }
    } catch (err) {
      console.error('Support chat error:', err);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Connection error. Please check your internet and try again.",
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Quick action buttons
  const quickActions = [
    { label: "Location not working", message: "My location isn't working" },
    { label: "Can't login", message: "I can't log in to my account" },
    { label: "App not loading", message: "The app isn't loading properly" },
    { label: "Other issue", message: "" }
  ];

  const handleQuickAction = (action) => {
    if (action.message) {
      setInput(action.message);
      setTimeout(() => sendMessage(), 100);
    } else {
      inputRef.current?.focus();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 group"
        title="Get Help"
      >
        <HelpCircle className="w-6 h-6" />
        <span className="absolute -top-10 right-0 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
          Need help?
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all ${isMinimized ? 'h-14' : 'h-[500px] max-h-[calc(100vh-100px)]'}`}
      style={{
        backgroundColor: 'var(--theme-bg)',
        border: '1px solid var(--theme-border)',
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        style={{ borderBottom: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>Support Chat</h3>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>We're here to help</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleReset(); }}
            className="p-2 transition-colors"
            style={{ color: 'var(--theme-text-muted)' }}
            title="Start over"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-2 transition-colors"
            style={{ color: 'var(--theme-text-muted)' }}
            title={isMinimized ? "Expand" : "Minimize"}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            className="p-2 transition-colors"
            style={{ color: 'var(--theme-text-muted)' }}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : msg.isError
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : ''
                  }`}
                  style={msg.role !== 'user' && !msg.isError ? {
                    backgroundColor: 'var(--theme-bg-secondary)',
                    color: 'var(--theme-text)',
                    border: '1px solid var(--theme-border)',
                  } : undefined}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.escalated && (
                    <p className="text-xs text-green-400 mt-2 pt-2" style={{ borderTop: '1px solid var(--theme-border)' }}>
                      ✓ Escalated to the team
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)' }}>
                  <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions - show only at start */}
          {messages.length === 1 && (
            <div className="px-4 pb-2">
              <p className="text-xs mb-2" style={{ color: 'var(--theme-text-muted)' }}>Common issues:</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickAction(action)}
                    className="text-xs px-3 py-1.5 rounded-full transition-colors"
                    style={{
                      backgroundColor: 'var(--theme-bg-secondary)',
                      color: 'var(--theme-text-secondary)',
                      border: '1px solid var(--theme-border)',
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4" style={{ borderTop: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your issue..."
                disabled={isLoading}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none disabled:opacity-50 transition-colors"
                style={{
                  backgroundColor: 'var(--theme-bg)',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
