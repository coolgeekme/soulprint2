import { DEFAULT_API_BASE_URL, DEFAULT_SETTINGS, MESSAGE, STORAGE_KEYS } from '../shared/constants';

const menus = [
  { id: 'ask-soulprint', title: 'Ask SoulPrint about “%s”', prompt: (text) => `Help me understand this:\n\n${text}` },
  { id: 'summarize-soulprint', title: 'Summarize with SoulPrint', prompt: (text) => `Summarize this selection:\n\n${text}` },
  { id: 'explain-soulprint', title: 'Explain with SoulPrint', prompt: (text) => `Explain this clearly:\n\n${text}` }
];

async function getSettings() { const stored = await chrome.storage.local.get(STORAGE_KEYS.settings); return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.settings] || {}) }; }
async function apiRequest(path, options = {}) {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.token);
  const settings = await getSettings();
  const response = await fetch(`${settings.apiBaseUrl || DEFAULT_API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(stored[STORAGE_KEYS.token] ? { Authorization: `Bearer ${stored[STORAGE_KEYS.token]}` } : {}), ...(options.headers || {}) } });
  if (response.status === 401) { await chrome.storage.local.remove([STORAGE_KEYS.token, STORAGE_KEYS.user]); broadcast({ type: MESSAGE.authChanged, authenticated: false }); }
  return response;
}
async function jsonRequest(path, options = {}) { const response = await apiRequest(path, options); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`); return data; }
async function broadcast(message) { const tabs = await chrome.tabs.query({}); await Promise.allSettled(tabs.map((tab) => tab.id && chrome.tabs.sendMessage(tab.id, message))); }
async function sendToActiveTab(message) { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab?.id) throw new Error('No active tab'); await chrome.tabs.sendMessage(tab.id, message); }

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(STORAGE_KEYS.settings);
  if (!current[STORAGE_KEYS.settings]) await chrome.storage.local.set({ [STORAGE_KEYS.settings]: DEFAULT_SETTINGS });
  chrome.contextMenus.removeAll(() => menus.forEach((menu) => chrome.contextMenus.create({ id: menu.id, title: menu.title, contexts: ['selection'] })));
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menu = menus.find((item) => item.id === info.menuItemId); if (!menu || !tab?.id) return;
  const selection = String(info.selectionText || '').slice(0, 5000);
  await chrome.tabs.sendMessage(tab.id, { type: MESSAGE.openPrompt, prompt: menu.prompt(selection), selectedText: selection, autoSubmit: true }).catch(() => {});
});
chrome.commands.onCommand.addListener((command) => { if (command === 'toggle-sidebar') sendToActiveTab({ type: MESSAGE.toggle }).catch(() => {}); });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'login': {
        const data = await jsonRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: message.email, passcode: message.password }) });
        await chrome.storage.local.set({ [STORAGE_KEYS.token]: data.token, [STORAGE_KEYS.user]: { userId: data.userId, role: data.role, email: message.email } });
        broadcast({ type: MESSAGE.authChanged, authenticated: true }); return data;
      }
      case 'googleLogin': {
        const settings = await getSettings();
        const redirectUrl = chrome.identity.getRedirectURL('soulprint-auth');
        const authUrl = new URL('/auth', settings.apiBaseUrl || DEFAULT_API_BASE_URL);
        authUrl.searchParams.set('extension_redirect', redirectUrl);
        let callbackUrl;
        try {
          callbackUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
        } catch (error) {
          if (/did not approve|canceled|cancelled|closed/i.test(error.message)) {
            throw new Error('The Google sign-in window closed before SoulPrint finished connecting. Complete sign-in and leave the window open; it will close automatically.');
          }
          throw error;
        }
        if (!callbackUrl) throw new Error('Google sign-in did not return to SoulPrint.');

        const callback = new URL(callbackUrl);
        const params = new URLSearchParams(callback.hash.slice(1));
        const token = params.get('token');
        if (!token) throw new Error(params.get('error') || 'Google sign-in did not return a session token.');

        await chrome.storage.local.set({ [STORAGE_KEYS.token]: token });
        try {
          const me = await jsonRequest('/api/auth/me');
          if (me.refreshed_token) await chrome.storage.local.set({ [STORAGE_KEYS.token]: me.refreshed_token });
          await chrome.storage.local.set({ [STORAGE_KEYS.user]: me });
          broadcast({ type: MESSAGE.authChanged, authenticated: true });
          return me;
        } catch (error) {
          await chrome.storage.local.remove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
          throw error;
        }
      }
      case 'session': {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.token); if (!stored[STORAGE_KEYS.token]) return { authenticated: false };
        try { const me = await jsonRequest('/api/auth/me'); if (me.refreshed_token) await chrome.storage.local.set({ [STORAGE_KEYS.token]: me.refreshed_token }); await chrome.storage.local.set({ [STORAGE_KEYS.user]: me }); return { authenticated: true, user: me }; } catch { return { authenticated: false }; }
      }
      case 'logout': await chrome.storage.local.remove([STORAGE_KEYS.token, STORAGE_KEYS.user, STORAGE_KEYS.conversationId]); await broadcast({ type: MESSAGE.authChanged, authenticated: false }); return { success: true };
      case 'openSidebar': await sendToActiveTab({ type: MESSAGE.open }); return { success: true };
      case 'getConversations': return jsonRequest('/api/user/conversations');
      case 'getMessages': return jsonRequest(`/api/messages?conversationId=${encodeURIComponent(message.conversationId)}`);
      default: throw new Error('Unknown extension request');
    }
  })().then((data) => sendResponse({ ok: true, data })).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'soulprint-chat') return; let controller;
  port.onMessage.addListener(async (message) => {
    if (message.action === 'abort') { controller?.abort(); return; } if (message.action !== 'start') return;
    controller = new AbortController();
    try {
      const response = await apiRequest('/api/chat/stream', { method: 'POST', body: JSON.stringify(message.payload), signal: controller.signal });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `Chat failed (${response.status})`); }
      if (!response.body) throw new Error('Streaming is unavailable');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) { if (!line.trim()) continue; try { port.postMessage({ type: 'event', data: JSON.parse(line) }); } catch {} } }
      if (buffer.trim()) { try { port.postMessage({ type: 'event', data: JSON.parse(buffer) }); } catch {} }
      port.postMessage({ type: 'complete' });
    } catch (error) { if (error.name !== 'AbortError') port.postMessage({ type: 'error', error: error.message }); }
  });
  port.onDisconnect.addListener(() => controller?.abort());
});
