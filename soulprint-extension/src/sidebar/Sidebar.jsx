import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import xml from 'highlight.js/lib/languages/xml';
import { marked } from 'marked';
import { ChevronDown, History, LogOut, MessageSquarePlus, Send, Settings, Sparkles, X } from 'lucide-react';
import { getStored, sendRuntimeMessage, setStored } from '../shared/chrome';
import { DEFAULT_SETTINGS, MESSAGE, STORAGE_KEYS } from '../shared/constants';

hljs.registerLanguage('javascript', javascript); hljs.registerLanguage('js', javascript); hljs.registerLanguage('json', json); hljs.registerLanguage('python', python); hljs.registerLanguage('html', xml);
marked.setOptions({ gfm: true, breaks: true });

function Markdown({ content }) {
  const ref = useRef(null);
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(String(content || ''))), [content]);
  useEffect(() => { ref.current?.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block)); }, [html]);
  return <div ref={ref} className="sp-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

function getPageContext(selectedText = '') {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script,style,noscript,nav,footer,header,aside,form,[aria-hidden="true"],#soulprint-sidebar-root').forEach((node) => node.remove());
  const primary = clone.querySelector('article,main,[role="main"],.content,.post') || clone;
  return { url: location.href.slice(0, 2048), title: document.title.slice(0, 300), content: String(primary.innerText || primary.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 5000), selected_text: String(selectedText || window.getSelection()?.toString() || '').slice(0, 5000) };
}

export default function Sidebar() {
  const [open, setOpen] = useState(false), [authenticated, setAuthenticated] = useState(null), [messages, setMessages] = useState([]), [streaming, setStreaming] = useState(''), [input, setInput] = useState(''), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [conversationId, setConversationId] = useState(null), [conversations, setConversations] = useState([]), [historyOpen, setHistoryOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [settings, setSettings] = useState(DEFAULT_SETTINGS), [width, setWidth] = useState(DEFAULT_SETTINGS.sidebarWidth);
  const inputRef = useRef(null), messagesRef = useRef(null), portRef = useRef(null), selectedTextRef = useRef('');

  const refreshConversations = useCallback(async () => { try { const data = await sendRuntimeMessage({ action: 'getConversations' }); setConversations(Array.isArray(data) ? data : []); } catch {} }, []);
  useEffect(() => { Promise.all([sendRuntimeMessage({ action: 'session' }), getStored([STORAGE_KEYS.settings, STORAGE_KEYS.conversationId])]).then(([session, stored]) => { setAuthenticated(session.authenticated); const next = { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.settings] || {}) }; setSettings(next); setWidth(next.sidebarWidth); setConversationId(stored[STORAGE_KEYS.conversationId] || null); if (session.authenticated) refreshConversations(); }).catch(() => setAuthenticated(false)); }, [refreshConversations]);
  useEffect(() => { if (!authenticated) return undefined; const timer = setInterval(refreshConversations, 30000); return () => clearInterval(timer); }, [authenticated, refreshConversations]);
  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, streaming, loading]);

  useEffect(() => {
    const focus = () => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); };
    const close = () => setOpen(false);
    window.addEventListener(MESSAGE.focus, focus); window.addEventListener(MESSAGE.close, close);
    const listener = (message) => {
      if (message.type === MESSAGE.toggle) setOpen((value) => !value);
      if (message.type === MESSAGE.open) setOpen(true);
      if (message.type === MESSAGE.close) setOpen(false);
      if (message.type === MESSAGE.authChanged) setAuthenticated(message.authenticated);
      if (message.type === MESSAGE.openPrompt) { selectedTextRef.current = message.selectedText || ''; setOpen(true); setInput(message.prompt || ''); if (message.autoSubmit) setTimeout(() => window.dispatchEvent(new CustomEvent('SOULPRINT_AUTOSUBMIT', { detail: message.prompt || '' })), 50); }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => { chrome.runtime.onMessage.removeListener(listener); window.removeEventListener(MESSAGE.focus, focus); window.removeEventListener(MESSAGE.close, close); };
  }, []);

  const submit = useCallback(async (textOverride) => {
    const content = String(textOverride ?? input).trim(); if (!content || loading || !authenticated) return;
    setError(''); setInput(''); setMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'user', content }]); setLoading(true); setStreaming('');
    const port = chrome.runtime.connect({ name: 'soulprint-chat' }); portRef.current = port; let fullContent = '', completed = false;
    port.onMessage.addListener((message) => {
      if (message.type === 'error') { setError(message.error); setLoading(false); return; }
      if (message.type === 'complete') { if (!completed && fullContent) setMessages((current) => [...current, { id: `a-${Date.now()}`, role: 'assistant', content: fullContent, partial: true }]); setStreaming(''); setLoading(false); refreshConversations(); return; }
      const data = message.data;
      if (data.type === 'meta' && data.conversationId) { setConversationId(data.conversationId); setStored({ [STORAGE_KEYS.conversationId]: data.conversationId }); }
      else if (data.type === 'delta' || data.type === 'content') { fullContent += data.content || ''; setStreaming(fullContent); }
      else if (data.type === 'done') { completed = true; if (data.conversationId) { setConversationId(data.conversationId); setStored({ [STORAGE_KEYS.conversationId]: data.conversationId }); } if (fullContent) setMessages((current) => [...current, { id: data.messageId || `a-${Date.now()}`, role: 'assistant', content: fullContent }]); setStreaming(''); setLoading(false); refreshConversations(); }
      else if (data.type === 'error') { setError(data.error || 'SoulPrint could not complete that response.'); setLoading(false); }
    });
    port.postMessage({ action: 'start', payload: { conversationId, content, model: 'smart', enableWebSearch: false, source: 'chrome_extension', pageContext: settings.includePageContext ? getPageContext(selectedTextRef.current) : null } });
    selectedTextRef.current = '';
  }, [authenticated, conversationId, input, loading, refreshConversations, settings.includePageContext]);
  useEffect(() => { const handler = (event) => submit(event.detail); window.addEventListener('SOULPRINT_AUTOSUBMIT', handler); return () => window.removeEventListener('SOULPRINT_AUTOSUBMIT', handler); }, [submit]);

  async function loadConversation(id) { setHistoryOpen(false); setError(''); setLoading(true); try { const data = await sendRuntimeMessage({ action: 'getMessages', conversationId: id }); setMessages(Array.isArray(data) ? data : []); setConversationId(id); await setStored({ [STORAGE_KEYS.conversationId]: id }); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  async function updateSettings(patch) { const next = { ...settings, ...patch }; setSettings(next); if (patch.sidebarWidth) setWidth(patch.sidebarWidth); await setStored({ [STORAGE_KEYS.settings]: next }); }
  function newConversation() { portRef.current?.postMessage({ action: 'abort' }); setConversationId(null); setMessages([]); setStreaming(''); setError(''); setStored({ [STORAGE_KEYS.conversationId]: null }); setTimeout(() => inputRef.current?.focus(), 50); }
  function beginResize(event) { event.preventDefault(); const startX = event.clientX, startWidth = width; const move = (e) => setWidth(Math.max(300, Math.min(600, startWidth + startX - e.clientX))); const up = (e) => { const finalWidth = Math.max(300, Math.min(600, startWidth + startX - e.clientX)); updateSettings({ sidebarWidth: finalWidth }); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); }

  return <aside className={`sp-sidebar ${open ? 'open' : ''}`} style={{ width }} aria-hidden={!open}>
    <div className="sp-resize" onPointerDown={beginResize} />
    <header className="sp-header"><div className="sp-brand"><span><Sparkles size={17} /></span><div><strong>SoulPrint</strong><small title={document.title}>{document.title || 'Current page'}</small></div></div><div className="sp-actions"><button title="New conversation" onClick={newConversation}><MessageSquarePlus size={18} /></button><button title="Conversation history" onClick={() => setHistoryOpen((v) => !v)}><History size={18} /></button><button title="Settings" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button><button title="Close" onClick={() => setOpen(false)}><X size={19} /></button></div></header>
    {historyOpen && <div className="sp-history"><div><strong>Recent chats</strong><button onClick={() => setHistoryOpen(false)}><X size={16} /></button></div>{conversations.length ? conversations.map((c) => <button key={c.id} className={c.id === conversationId ? 'active' : ''} onClick={() => loadConversation(c.id)}><span>{c.title || 'Untitled chat'}</span><small>{c.source === 'chrome_extension' ? 'Extension' : 'SoulPrint'} · {new Date(c.updated_at || c.created_at).toLocaleDateString()}</small></button>) : <p>No conversations yet.</p>}</div>}
    {!authenticated ? <div className="sp-empty"><Sparkles size={28} /><h2>Sign in to SoulPrint</h2><p>Open the extension from your browser toolbar to connect your account.</p></div> : <><div className="sp-context"><span className={settings.includePageContext ? 'on' : ''} /><span>{settings.includePageContext ? 'Page context on' : 'Page context off'}</span><button onClick={() => submit('Summarize this page in concise bullet points.')}>Summarize page</button></div><main className="sp-messages" ref={messagesRef}>
      {!messages.length && !streaming && <div className="sp-empty"><Sparkles size={28} /><h2>Ask about this page</h2><p>I can summarize, explain selected text, or help with anything you’re viewing.</p><div className="sp-starters"><button onClick={() => submit('What are the key points on this page?')}>Key points</button><button onClick={() => submit('Explain the main idea of this page simply.')}>Explain simply</button></div></div>}
      {messages.map((message) => <div key={message.id || `${message.role}-${message.created_at}`} className={`sp-message ${message.role === 'user' ? 'user' : 'assistant'}`}><Markdown content={message.content} />{message.partial && <small>Partial response</small>}</div>)}
      {streaming && <div className="sp-message assistant streaming"><Markdown content={streaming} /></div>}{loading && !streaming && <div className="sp-thinking"><i /><i /><i /></div>}{error && <div className="sp-error">{error}</div>}
    </main><footer className="sp-compose"><textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} rows={1} placeholder="Ask SoulPrint…" /><button className="sp-send" onClick={() => submit()} disabled={!input.trim() || loading} title="Send"><Send size={17} /></button><div><span>Enter to send · Shift+Enter for a new line</span><span className="sp-synced">● Synced</span></div></footer></>}
    {settingsOpen && <div className="sp-settings"><header><strong>Settings</strong><button onClick={() => setSettingsOpen(false)}><X size={18} /></button></header><label><span><strong>Use page context</strong><small>Include up to 5,000 characters from the current page with each request.</small></span><input type="checkbox" checked={settings.includePageContext} onChange={(e) => updateSettings({ includePageContext: e.target.checked })} /></label><div className="sp-setting-row"><span><strong>Sidebar width</strong><small>{Math.round(width)} px</small></span><ChevronDown size={16} /></div><button className="sp-logout" onClick={async () => { await sendRuntimeMessage({ action: 'logout' }); setAuthenticated(false); setSettingsOpen(false); }}><LogOut size={16} /> Sign out</button><a href="https://soulprintengine.ai/chat" target="_blank" rel="noreferrer">Open SoulPrint web app</a></div>}
  </aside>;
}
