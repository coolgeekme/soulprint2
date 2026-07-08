# SoulPrint Chrome Extension - Technical Specifications

**Version:** 1.0.0  
**Last Updated:** 2026-07-07  
**Status:** Ready for Development

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Technical Stack](#technical-stack)
3. [Architecture](#architecture)
4. [Features & Requirements](#features--requirements)
5. [File Structure](#file-structure)
6. [Authentication Flow](#authentication-flow)
7. [API Integration](#api-integration)
8. [UI/UX Specifications](#uiux-specifications)
9. [Permissions & Security](#permissions--security)
10. [Chrome Web Store Requirements](#chrome-web-store-requirements)
11. [Testing Plan](#testing-plan)
12. [Deployment](#deployment)
13. [Known Limitations](#known-limitations)

---

## Overview

### What is it?
A Chrome extension that provides **AI chat in a sidebar** without leaving the current page. Users can:
- Ask questions about the current webpage
- Summarize articles
- Get quick answers
- Analyze content
- Save to SoulPrint projects

### Value Proposition
- **No tab switching** - AI available where you need it
- **Context-aware** - Knows what page you're on
- **Unified account** - Same SoulPrint login and memory
- **Free tier gateway** - Easy trial, drives upgrades

### Target Users
- Free tier: 10 messages/day (shares web app limit)
- Base tier: Unlimited messages
- Plus/Power tier: Advanced features unlocked

---

## Technical Stack

### Required Technologies
```json
{
  "manifest_version": 3,
  "frontend": {
    "framework": "React 18",
    "bundler": "Webpack 5",
    "styling": "Tailwind CSS",
    "icons": "Lucide React"
  },
  "backend": "SoulPrint API (existing)",
  "auth": "JWT tokens (existing)",
  "storage": "chrome.storage.local",
  "communication": "chrome.runtime messaging"
}
```

### Dependencies
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "tailwindcss": "^3.4.0",
  "lucide-react": "^0.263.0",
  "marked": "^11.0.0",
  "dompurify": "^3.0.0"
}
```

### Build Tools
- **Webpack** - Bundle extension files
- **Babel** - Transpile React/JSX
- **PostCSS** - Process Tailwind CSS
- **ESLint** - Code quality

---

## Architecture

### Extension Components

```
┌─────────────────────────────────────────────────────┐
│                  Chrome Extension                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   Popup      │  │   Sidebar    │  │ Content  │ │
│  │   (Auth)     │  │   (Main UI)  │  │  Script  │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│         ↓                  ↓                ↓       │
│  ┌──────────────────────────────────────────────┐  │
│  │        Background Service Worker              │  │
│  │  - API calls                                  │  │
│  │  - Token management                           │  │
│  │  - Message routing                            │  │
│  └──────────────────────────────────────────────┘  │
│                          ↓                          │
└──────────────────────────┼──────────────────────────┘
                           ↓
                   ┌───────────────┐
                   │  SoulPrint    │
                   │  Backend API  │
                   └───────────────┘
```

### Component Roles

**1. Popup (popup.html/popup.js)**
- Login form
- Quick settings toggle
- Extension enable/disable

**2. Sidebar (sidebar.html/sidebar.js)**
- Main chat interface
- Message history
- Input area
- Context controls

**3. Content Script (content.js)**
- Inject sidebar into webpage
- Extract page content
- Detect text selection
- Listen for keyboard shortcuts

**4. Background Service Worker (background.js)**
- Handle API requests
- Manage authentication tokens
- Store conversation history
- Background sync

---

## Features & Requirements

### Core Features (MVP)

#### ✅ **F1: Authentication**
**Description:** Users log in with existing SoulPrint credentials

**Requirements:**
- Login form in popup
- JWT token storage in `chrome.storage.local`
- Auto-refresh tokens before expiry
- Logout functionality
- "Forgot password" link to web app

**User Flow:**
```
1. User clicks extension icon
2. If not logged in → Show login popup
3. User enters email/password
4. POST /api/auth/login
5. Store JWT token
6. Redirect to sidebar
```

**Technical Notes:**
- Token stored at: `chrome.storage.local.set({ jwt_token: "..." })`
- Token refresh every 50 minutes (before 60min expiry)
- On 401 error → Clear token, show login

---

#### ✅ **F2: Sidebar Chat Interface**
**Description:** Main AI chat interface in a sidebar

**Requirements:**
- Toggle sidebar with keyboard shortcut (Ctrl+Shift+S or Cmd+Shift+S)
- Toggle sidebar with extension icon click
- Sidebar slides in from right side (400px wide)
- Overlay on current page (doesn't push content)
- Resizable width (300px - 600px)
- Collapsible/expandable
- Message history scrolling
- Markdown rendering
- Syntax highlighting for code blocks

**UI Layout:**
```
┌────────────────────────────────┐
│  SoulPrint     [Settings] [×]  │  ← Header
├────────────────────────────────┤
│                                │
│  [User message]                │
│                                │
│         [AI response]          │  ← Chat messages
│                                │
│  [User message]                │
│                                │
├────────────────────────────────┤
│  ┌──────────────────────────┐ │
│  │ Type a message...       │ │  ← Input area
│  └──────────────────────────┘ │
│  [📎] [🔗] [Send]              │
└────────────────────────────────┘
```

**Technical Notes:**
- Sidebar injected via content script
- React root mounted at `<div id="soulprint-sidebar-root">`
- Z-index: 2147483647 (max value, above all page content)
- CSS scoped to avoid conflicts: `#soulprint-sidebar-root *`
- Shadow DOM for style isolation (optional, advanced)

---

#### ✅ **F3: Page Context Awareness**
**Description:** AI knows what page user is on

**Requirements:**
- Auto-detect current page URL
- Show page title in sidebar header
- Option to "Ask about this page"
- Extract visible text from page
- Handle dynamic content (SPAs)

**Context Sent to API:**
```json
{
  "message": "Summarize this article",
  "context": {
    "url": "https://example.com/article",
    "title": "Article Title",
    "content": "First 5000 chars of page text...",
    "selected_text": "User highlighted text (if any)"
  }
}
```

**Technical Notes:**
- Use `document.title` for title
- Use `document.body.innerText` for content (max 5000 chars)
- Strip scripts, styles, nav, footer
- Detect text selection: `window.getSelection().toString()`

---

#### ✅ **F4: Quick Actions**
**Description:** Context menu shortcuts

**Requirements:**
- Right-click selected text → "Ask SoulPrint"
- Right-click selected text → "Summarize with SoulPrint"
- Right-click selected text → "Explain with SoulPrint"
- Opens sidebar with pre-filled prompt

**Context Menu Items:**
```javascript
chrome.contextMenus.create({
  id: "ask-soulprint",
  title: "Ask SoulPrint about '%s'",
  contexts: ["selection"]
});
```

**Technical Notes:**
- Created in `background.js`
- `%s` replaced with selected text (max 200 chars)
- Opens sidebar if closed
- Auto-submits message

---

#### ✅ **F5: Conversation Sync**
**Description:** Conversations sync with SoulPrint web app

**Requirements:**
- Extension conversations appear in web app
- Web conversations visible in extension
- Real-time sync (no refresh needed)
- Use same conversation IDs
- Project assignment works

**Technical Notes:**
- Use existing `/api/conversations` endpoints
- Store `conversation_id` in local storage
- Poll for updates every 30 seconds (or use WebSocket)
- Show "Synced" indicator in sidebar

---

#### ✅ **F6: Keyboard Shortcuts**
**Description:** Power user shortcuts

**Requirements:**
- `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac) → Toggle sidebar
- `Ctrl+Shift+A` → Focus input field
- `Esc` → Close sidebar
- `Enter` → Send message
- `Shift+Enter` → New line in message

**Technical Notes:**
- Register in `manifest.json`:
```json
"commands": {
  "toggle-sidebar": {
    "suggested_key": {
      "default": "Ctrl+Shift+S",
      "mac": "Command+Shift+S"
    },
    "description": "Toggle SoulPrint sidebar"
  }
}
```

---

### Advanced Features (Post-MVP)

#### ⏸️ **F7: Text Selection Actions**
**Description:** Quick AI actions on selected text

**Requirements:**
- Hover mini-toolbar appears on text selection
- Quick buttons: Summarize, Explain, Translate, Define
- Opens sidebar with result

---

#### ⏸️ **F8: Page Summarization**
**Description:** One-click article/page summaries

**Requirements:**
- "Summarize Page" button in sidebar header
- Extracts article content (ignore nav/ads)
- Generates bullet-point summary
- Saves summary to project (optional)

---

#### ⏸️ **F9: Save to Projects**
**Description:** Save webpage or conversation to SoulPrint project

**Requirements:**
- "Save to Project" button in sidebar
- Select project from dropdown
- Saves URL, title, summary, timestamp

---

#### ⏸️ **F10: Quick Commands**
**Description:** Slash commands for power users

**Requirements:**
- `/summarize` → Summarize current page
- `/translate [lang]` → Translate page
- `/search [query]` → Web search
- `/help` → Show command list

---

## File Structure

```
soulprint-extension/
├── manifest.json                 # Extension manifest (Manifest V3)
├── package.json                  # NPM dependencies
├── webpack.config.js             # Webpack bundler config
├── tailwind.config.js            # Tailwind CSS config
├── .eslintrc.js                  # ESLint config
├── README.md                     # Development guide
│
├── public/                       # Static assets
│   ├── icons/
│   │   ├── icon-16.png          # Extension icon (16×16)
│   │   ├── icon-48.png          # Extension icon (48×48)
│   │   ├── icon-128.png         # Extension icon (128×128)
│   │   └── logo.svg             # SoulPrint logo
│   └── _locales/                # Internationalization (future)
│       └── en/
│           └── messages.json
│
├── src/                          # Source code
│   ├── background/
│   │   └── background.js        # Service worker (API calls, auth)
│   │
│   ├── popup/                   # Login/settings popup
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   │
│   ├── sidebar/                 # Main chat sidebar
│   │   ├── Sidebar.jsx          # Main React component
│   │   ├── components/
│   │   │   ├── ChatMessage.jsx
│   │   │   ├── InputArea.jsx
│   │   │   ├── Header.jsx
│   │   │   └── ContextBar.jsx
│   │   ├── sidebar.html
│   │   ├── sidebar.js           # Entry point
│   │   └── sidebar.css
│   │
│   ├── content/                 # Content scripts (inject sidebar)
│   │   ├── content.js           # Main content script
│   │   └── inject-sidebar.js   # Sidebar injection logic
│   │
│   ├── shared/                  # Shared utilities
│   │   ├── api.js               # API wrapper
│   │   ├── auth.js              # Auth helpers
│   │   ├── storage.js           # Chrome storage wrapper
│   │   ├── messaging.js         # Chrome messaging helpers
│   │   └── constants.js         # Constants (API URLs, etc.)
│   │
│   └── styles/                  # Global styles
│       ├── tailwind.css         # Tailwind entry
│       └── markdown.css         # Markdown rendering styles
│
└── dist/                        # Build output (Webpack generates)
    ├── manifest.json
    ├── background.js
    ├── popup.html
    ├── popup.js
    ├── sidebar.html
    ├── sidebar.js
    ├── content.js
    └── icons/
```

---

## Authentication Flow

### Initial Login

```
┌──────────────┐
│ User clicks  │
│ extension    │
└──────┬───────┘
       ↓
┌──────────────────┐
│ Check if token   │
│ exists in        │
│ chrome.storage   │
└──────┬───────────┘
       ↓
   ┌───────┐
   │Token? │
   └───┬───┘
       │
   ┌───┴────┐
   │  Yes   │  No
   │        │
   ↓        ↓
┌────────┐  ┌──────────┐
│ Verify │  │  Show    │
│ token  │  │  login   │
│ valid? │  │  popup   │
└───┬────┘  └────┬─────┘
    │            │
    ↓            ↓
 Valid?      User enters
 Yes│No      credentials
    │            │
    ↓            ↓
 ┌──────┐   POST /api/auth/login
 │ Open │        │
 │ side │        ↓
 │ bar  │   ┌────────────┐
 └──────┘   │ Store JWT  │
            │ in storage │
            └─────┬──────┘
                  ↓
            ┌──────────┐
            │ Open     │
            │ sidebar  │
            └──────────┘
```

### Token Refresh

```javascript
// background.js - Auto-refresh token every 50 minutes
setInterval(async () => {
  const token = await chrome.storage.local.get('jwt_token');
  if (token) {
    try {
      const response = await fetch(API_BASE_URL + '/api/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.jwt_token}` }
      });
      const data = await response.json();
      await chrome.storage.local.set({ jwt_token: data.token });
    } catch (err) {
      // Token invalid - force re-login
      await chrome.storage.local.remove('jwt_token');
    }
  }
}, 50 * 60 * 1000); // 50 minutes
```

### Logout Flow

```javascript
// Clear all stored data
await chrome.storage.local.clear();
// Notify all tabs to close sidebar
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'logout' });
  });
});
// Show login popup
chrome.action.openPopup();
```

---

## API Integration

### Base Configuration

```javascript
// src/shared/constants.js
export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://soulprintengine.ai'
  : 'http://localhost:3000';

export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  REFRESH: '/api/auth/refresh',
  ME: '/api/auth/me',
  CHAT_STREAM: '/api/chat/stream',
  CONVERSATIONS: '/api/conversations',
  MESSAGES: '/api/messages',
};
```

### API Wrapper

```javascript
// src/shared/api.js
export class SoulPrintAPI {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async getToken() {
    const result = await chrome.storage.local.get('jwt_token');
    return result.jwt_token;
  }

  async request(endpoint, options = {}) {
    const token = await this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Token expired - clear and force re-login
      await chrome.storage.local.remove('jwt_token');
      throw new Error('UNAUTHORIZED');
    }

    return response;
  }

  async login(email, password) {
    const response = await this.request(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.token) {
      await chrome.storage.local.set({ jwt_token: data.token });
    }
    return data;
  }

  async sendMessage(message, conversationId, context) {
    const response = await this.request(API_ENDPOINTS.CHAT_STREAM, {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversationId,
        context,
        source: 'chrome_extension'
      })
    });
    return response;
  }

  async getConversations() {
    const response = await this.request(API_ENDPOINTS.CONVERSATIONS);
    return response.json();
  }
}
```

### Streaming Response Handling

```javascript
// Handle NDJSON streaming from chat API
async function streamChatResponse(message, conversationId, onChunk) {
  const api = new SoulPrintAPI();
  const response = await api.sendMessage(message, conversationId, {
    url: window.location.href,
    title: document.title
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        onChunk(data); // Call callback with each chunk
      } catch (err) {
        console.error('Failed to parse chunk:', line);
      }
    }
  }
}
```

---

## UI/UX Specifications

### Design System

**Colors:**
```css
/* Based on SoulPrint branding */
:root {
  --sp-bg-dark: #0a0a0a;
  --sp-bg-card: #1a1a1a;
  --sp-border: rgba(255, 255, 255, 0.1);
  --sp-text-primary: #ffffff;
  --sp-text-secondary: #a0a0a0;
  --sp-orange: #f97316;
  --sp-orange-hover: #ea580c;
  --sp-success: #22c55e;
  --sp-error: #ef4444;
}
```

**Typography:**
```css
/* Font stack */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             'Helvetica Neue', Arial, sans-serif;

/* Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
```

**Spacing:**
```css
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-6: 1.5rem;   /* 24px */
```

### Component Specifications

#### Sidebar Container
```css
#soulprint-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: var(--sp-bg-dark);
  border-left: 1px solid var(--sp-border);
  z-index: 2147483647;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
  transform: translateX(100%);
  transition: transform 0.3s ease-in-out;
}

#soulprint-sidebar.open {
  transform: translateX(0);
}
```

#### Chat Message Bubbles
```css
/* User message */
.message-user {
  background: var(--sp-orange);
  color: white;
  padding: 12px 16px;
  border-radius: 16px 16px 4px 16px;
  margin-left: auto;
  max-width: 80%;
}

/* AI message */
.message-assistant {
  background: var(--sp-bg-card);
  color: var(--sp-text-primary);
  padding: 12px 16px;
  border-radius: 16px 16px 16px 4px;
  margin-right: auto;
  max-width: 80%;
  border: 1px solid var(--sp-border);
}
```

#### Input Area
```css
.input-container {
  padding: 16px;
  border-top: 1px solid var(--sp-border);
  background: var(--sp-bg-card);
}

.input-textarea {
  width: 100%;
  min-height: 60px;
  max-height: 200px;
  padding: 12px;
  background: var(--sp-bg-dark);
  border: 1px solid var(--sp-border);
  border-radius: 8px;
  color: var(--sp-text-primary);
  resize: none;
  font-size: 14px;
  line-height: 1.5;
}

.send-button {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 36px;
  height: 36px;
  background: var(--sp-orange);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.send-button:hover {
  background: var(--sp-orange-hover);
}
```

### Responsive Behavior

```javascript
// Allow sidebar resize
let isResizing = false;
let startX = 0;
let startWidth = 0;

sidebarResizeHandle.addEventListener('mousedown', (e) => {
  isResizing = true;
  startX = e.clientX;
  startWidth = sidebar.offsetWidth;
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const width = startWidth - (e.clientX - startX);
  const clampedWidth = Math.max(300, Math.min(600, width));
  sidebar.style.width = `${clampedWidth}px`;
});

document.addEventListener('mouseup', () => {
  isResizing = false;
});
```

---

## Permissions & Security

### Required Permissions

```json
// manifest.json
{
  "permissions": [
    "storage",           // Store JWT token, settings
    "activeTab",         // Access current tab content
    "scripting",         // Inject sidebar into pages
    "contextMenus"       // Right-click menu actions
  ],
  "host_permissions": [
    "https://soulprintengine.ai/*",  // API access
    "http://localhost:3000/*"         // Dev environment
  ]
}
```

### Security Best Practices

**1. Token Storage**
```javascript
// ✅ DO: Use chrome.storage.local (encrypted)
await chrome.storage.local.set({ jwt_token: token });

// ❌ DON'T: Use localStorage (accessible by page scripts)
localStorage.setItem('jwt_token', token);
```

**2. Content Security Policy**
```json
// manifest.json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**3. Sanitize User Input**
```javascript
import DOMPurify from 'dompurify';

// Always sanitize HTML before rendering
const cleanHTML = DOMPurify.sanitize(userMessage);
```

**4. Validate API Responses**
```javascript
// Don't trust API responses blindly
function validateResponse(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response');
  }
  // Additional validation...
}
```

**5. Limit Page Access**
```javascript
// Only extract necessary content, not entire DOM
function getPageContent() {
  const article = document.querySelector('article, main, .content');
  return article ? article.innerText.slice(0, 5000) : document.body.innerText.slice(0, 5000);
}
```

---

## Chrome Web Store Requirements

### Manifest.json (Complete)

```json
{
  "manifest_version": 3,
  "name": "SoulPrint - AI Chat Sidebar",
  "version": "1.0.0",
  "description": "AI-powered chat sidebar. Ask questions, summarize pages, and get instant answers without leaving your current tab.",
  "author": "SoulPrint Engine",
  "homepage_url": "https://soulprintengine.ai",
  
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    },
    "default_title": "Open SoulPrint"
  },

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["sidebar.css"],
      "run_at": "document_idle"
    }
  ],

  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "contextMenus"
  ],

  "host_permissions": [
    "https://soulprintengine.ai/*"
  ],

  "commands": {
    "toggle-sidebar": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "Toggle SoulPrint sidebar"
    }
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },

  "web_accessible_resources": [
    {
      "resources": ["sidebar.html", "icons/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### Store Listing Requirements

**Short Description (132 chars max):**
```
AI chat sidebar. Get instant answers, summaries, and assistance without leaving your current page. Powered by SoulPrint Engine.
```

**Detailed Description:**
```markdown
# SoulPrint - Your AI Assistant in Every Tab

Never switch tabs again. SoulPrint brings powerful AI chat directly into your browser sidebar.

## ✨ Features

**AI Chat Sidebar**
- Open with one click or keyboard shortcut (Ctrl+Shift+S)
- Chat with advanced AI models (GPT-4o, Gemini, Claude)
- Conversation history syncs with your SoulPrint account

**Page-Aware Intelligence**
- Ask questions about the current webpage
- Summarize long articles instantly
- Explain complex topics in simple terms
- Extract key information

**Quick Actions**
- Right-click any text → "Ask SoulPrint"
- Highlight text → Get instant explanations
- One-click page summaries

**Seamless Integration**
- Same account as SoulPrint web app
- Access your conversation history everywhere
- Save important findings to projects

## 🚀 Getting Started

1. Install the extension
2. Click the SoulPrint icon
3. Log in with your SoulPrint account (or create one free)
4. Start chatting!

## 💳 Pricing

**Free Tier** - 10 messages/day
**Base Plan** - $20/mo - Unlimited messages
**Power Plan** - $99/mo - Advanced features

## 🔒 Privacy & Security

- Your data is encrypted
- No tracking or analytics
- Open source (code available on GitHub)
- Complies with Chrome Web Store policies

## 📧 Support

Need help? Visit https://soulprintengine.ai/support

---

By installing this extension, you agree to SoulPrint's Terms of Service and Privacy Policy.
```

**Screenshots Required:**
1. Main sidebar view (1280×800)
2. Login screen (1280×800)
3. Context menu action (1280×800)
4. Settings panel (1280×800)
5. Example conversation (1280×800)

**Promotional Images:**
- Small tile: 440×280
- Marquee: 1400×560

**Category:**
- Primary: Productivity
- Secondary: Tools

**Privacy Policy URL:**
- https://soulprintengine.ai/privacy

**Terms of Service URL:**
- https://soulprintengine.ai/terms

---

## Testing Plan

### Manual Testing Checklist

#### Authentication
- [ ] Can log in with valid credentials
- [ ] Cannot log in with invalid credentials
- [ ] Token persists after browser restart
- [ ] Token refreshes automatically
- [ ] Logout clears all data
- [ ] Multiple accounts can be switched

#### Sidebar Functionality
- [ ] Sidebar toggles with keyboard shortcut
- [ ] Sidebar toggles with extension icon
- [ ] Sidebar slides in/out smoothly
- [ ] Sidebar is resizable (300-600px)
- [ ] Sidebar overlays page (doesn't push content)
- [ ] Messages render correctly (text, markdown, code)
- [ ] Scrolling works in message history
- [ ] Input field auto-expands with content

#### Page Context
- [ ] AI knows current page URL
- [ ] AI can access page content
- [ ] Selected text is detected
- [ ] Dynamic content (SPAs) is handled
- [ ] Iframes don't break detection

#### Context Menu
- [ ] Right-click menu appears on text selection
- [ ] "Ask SoulPrint" opens sidebar
- [ ] Selected text is pre-filled in message
- [ ] Works on all websites

#### Conversation Sync
- [ ] Extension conversations appear in web app
- [ ] Web conversations appear in extension
- [ ] Switching conversations works
- [ ] New conversations are created correctly

#### Edge Cases
- [ ] Works on Chrome, Edge, Brave
- [ ] Works on HTTP and HTTPS pages
- [ ] Works on file:// pages (if enabled)
- [ ] Doesn't break on complex sites (Gmail, Twitter, etc.)
- [ ] Handles network errors gracefully
- [ ] Handles API rate limits
- [ ] Works in incognito mode (if enabled)

### Automated Testing

```javascript
// Example: Puppeteer test
const puppeteer = require('puppeteer');

describe('SoulPrint Extension', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=/path/to/extension`,
        `--load-extension=/path/to/extension`
      ]
    });
    page = await browser.newPage();
  });

  test('should toggle sidebar with keyboard shortcut', async () => {
    await page.goto('https://example.com');
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('S');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');

    const sidebar = await page.$('#soulprint-sidebar');
    expect(sidebar).toBeTruthy();
  });

  // More tests...
});
```

---

## Deployment

### Development Build

```bash
# Install dependencies
npm install

# Start development server (auto-reload)
npm run dev

# Load extension in Chrome:
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist/` folder
```

### Production Build

```bash
# Build for production
npm run build

# Output: dist/ folder
# This folder contains the extension ready for Chrome Web Store
```

### Versioning

Follow semantic versioning:
- **1.0.0** - Initial release (MVP)
- **1.1.0** - New features (page summarization, etc.)
- **1.0.1** - Bug fixes

Update version in:
- `manifest.json`
- `package.json`

### Chrome Web Store Submission

```bash
# 1. Create ZIP of dist/ folder
cd dist/
zip -r soulprint-extension-v1.0.0.zip *

# 2. Go to Chrome Web Store Developer Dashboard
# https://chrome.google.com/webstore/devconsole

# 3. Click "New Item"
# 4. Upload ZIP
# 5. Fill out store listing (screenshots, description, etc.)
# 6. Submit for review (takes 1-3 days)
```

### Update Submission

```bash
# 1. Increment version in manifest.json
# 2. Build production
npm run build

# 3. Create new ZIP
cd dist/
zip -r soulprint-extension-v1.1.0.zip *

# 4. Go to Developer Dashboard
# 5. Click on existing extension
# 6. Click "Package" tab
# 7. Upload new ZIP
# 8. Submit for review
```

---

## Known Limitations

### Technical Limitations

1. **Cannot access certain pages:**
   - chrome:// pages (e.g., chrome://settings)
   - chrome-extension:// pages
   - Chrome Web Store pages
   - Browser security restricts these

2. **Content script conflicts:**
   - Some sites block all extensions (rare)
   - Other AI extensions may conflict (ChatGPT extension, etc.)

3. **Streaming limitations:**
   - NDJSON parsing can fail on slow connections
   - No native Server-Sent Events in service workers (Manifest V3)

4. **Storage limits:**
   - chrome.storage.local: 5MB limit (unlikely to hit)
   - Must implement conversation history cleanup

### User Experience Limitations

1. **First-time setup:**
   - Requires SoulPrint account (can't use without login)
   - No guest mode

2. **Keyboard shortcut conflicts:**
   - Ctrl+Shift+S may conflict with other extensions
   - Users must manually change if needed

3. **Mobile not supported:**
   - Chrome extensions don't work on mobile Chrome (Android/iOS)
   - Mobile app needed for that use case

---

## Development Timeline

### Week 1-2: Core Infrastructure
- [ ] Setup project structure
- [ ] Configure Webpack/Babel/Tailwind
- [ ] Create manifest.json
- [ ] Build authentication flow (login popup)
- [ ] Setup API wrapper
- [ ] Test token storage/refresh

### Week 2-3: Sidebar UI
- [ ] Create sidebar React components
- [ ] Inject sidebar via content script
- [ ] Implement chat interface
- [ ] Add message rendering (Markdown, code highlighting)
- [ ] Build input area with auto-expand
- [ ] Add keyboard shortcuts

### Week 3-4: Features & Polish
- [ ] Page context detection
- [ ] Context menu actions
- [ ] Conversation sync with web app
- [ ] Settings panel
- [ ] Error handling & loading states
- [ ] Add animations/transitions

### Week 4: Testing & Submission
- [ ] Manual testing on multiple sites
- [ ] Fix bugs
- [ ] Create screenshots for store listing
- [ ] Write store description
- [ ] Submit to Chrome Web Store
- [ ] Wait for review (1-3 days)

---

## Resources & References

### Documentation
- [Chrome Extension Docs (Manifest V3)](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Scripting API](https://developer.chrome.com/docs/extensions/reference/scripting/)
- [React 18 Docs](https://react.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

### Similar Extensions (For Reference)
- ChatGPT for Chrome
- Perplexity Chrome Extension
- Notion Web Clipper
- Grammarly

### Design Inspiration
- [Linear Extension](https://linear.app)
- [Notion Web Clipper](https://notion.so)
- [Arc Browser](https://arc.net)

---

## Questions & Decisions

### Open Questions
1. **Auto-open on install?** Should sidebar auto-open after first install?
2. **Default position?** Always right side, or let user choose left/right?
3. **Themes?** Support light mode, or dark only?
4. **Offline mode?** Cache conversations for offline viewing?
5. **Analytics?** Track usage metrics (with user consent)?

### Technical Decisions
1. ✅ Use Manifest V3 (required for new extensions)
2. ✅ Use React (team familiarity, component reuse)
3. ✅ Use Tailwind CSS (matches web app styling)
4. ✅ NDJSON streaming (matches web app API)
5. ✅ No local AI models (keep extension lightweight)

---

## Success Metrics

### Launch Goals (First 3 Months)
- 10,000 installs
- 4.5+ star rating
- 5% conversion (free → paid)
- 500 new paid users

### Engagement Metrics
- Daily active users (DAU)
- Messages per user per day
- Retention (D1, D7, D30)
- Upgrade rate (free → Base/Power)

### Technical Metrics
- Crash rate < 0.1%
- API error rate < 1%
- Average load time < 500ms
- Chrome Web Store review score > 4.5

---

## Contact & Support

**Developer Contact:**
- Email: dev@soulprintengine.ai
- GitHub: github.com/soulprint/chrome-extension

**User Support:**
- Email: support@soulprintengine.ai
- Help Center: https://soulprintengine.ai/help
- Discord: discord.gg/soulprint

---

**Last Updated:** 2026-07-07  
**Version:** 1.0.0  
**Status:** ✅ Ready for Development
