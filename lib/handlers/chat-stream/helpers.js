/**
 * Chat Stream Helper Utilities
 * Extracted from chat-stream.js for maintainability
 */

// ── FFMPEG AVAILABILITY CHECK ──────────────────────────────
// ffmpeg is required for video frame extraction. In containerized environments
// it can be lost on restart. This helper checks and auto-installs if needed.
let _ffmpegChecked = false;
let _ffmpegAvailable = false;

export async function ensureFfmpeg() {
  if (_ffmpegChecked) return _ffmpegAvailable;
  try {
    const { execSync } = require('child_process');
    execSync('which ffmpeg', { timeout: 3000 });
    _ffmpegAvailable = true;
    _ffmpegChecked = true;
    return true;
  } catch {
    console.log('[ffmpeg] Not found — attempting auto-install...');
    try {
      const { execSync } = require('child_process');
      execSync('apt-get update -qq && apt-get install -y -qq ffmpeg', { timeout: 120000 });
      _ffmpegAvailable = true;
      _ffmpegChecked = true;
      console.log('[ffmpeg] ✅ Auto-installed successfully');
      return true;
    } catch (e) {
      console.error('[ffmpeg] ❌ Auto-install failed:', e.message);
      _ffmpegChecked = true;
      _ffmpegAvailable = false;
      return false;
    }
  }
}

// ── IMAGE URL VALIDATION ──────────────────────────────────
// Validates that an image URL is still accessible before using it for video generation.
// Expired/broken URLs from tempfile storage cause silent video generation failures.
export async function isImageUrlAccessible(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      // Must be an image content type (not HTML error page, etc.)
      return contentType.startsWith('image/') || contentType === 'application/octet-stream';
    }
    console.log(`[ImageValidation] URL returned HTTP ${res.status}: ${url.substring(0, 80)}`);
    return false;
  } catch (e) {
    console.log(`[ImageValidation] URL check failed: ${e.message} — ${url.substring(0, 80)}`);
    return false;
  }
}

// ── INPUT SANITIZATION ──────────────────────────────────
export function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove null bytes and control characters except newlines/tabs
  return text
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

// ── CONVERSATION HISTORY TRIMMING ──────────────────────────
// Trim conversation history to fit within token limits
// Rough estimate: 1 token ≈ 4 characters
export function trimHistory(messages, maxContextTokens = 32000) {
  const maxChars = maxContextTokens * 4;
  let totalChars = 0;
  const trimmedMessages = [];
  
  // Process messages in reverse (most recent first)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const msgLength = msgContent.length;
    
    if (totalChars + msgLength > maxChars) {
      // If adding this message would exceed the limit, stop here
      break;
    }
    
    totalChars += msgLength;
    trimmedMessages.unshift(msg); // Add to beginning to maintain order
  }
  
  // Always keep at least the last message if history is too long
  if (trimmedMessages.length === 0 && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    const content = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
    // Truncate the last message if it's too long
    if (content.length > maxChars) {
      return [{
        ...lastMsg,
        content: content.substring(0, maxChars) + '... [truncated]'
      }];
    }
    return [lastMsg];
  }
  
  return trimmedMessages;
}

// ── MESSAGE ALTERNATION FIX ──────────────────────────────
// Some LLM APIs require strict user/assistant alternation
// This function ensures messages alternate properly
export function ensureAlternatingMessages(messages) {
  if (!messages || messages.length === 0) return messages;
  
  const fixed = [];
  let lastRole = null;
  
  for (const msg of messages) {
    const currentRole = msg.role;
    
    // If same role appears consecutively, merge the messages
    if (currentRole === lastRole && fixed.length > 0) {
      const lastMsg = fixed[fixed.length - 1];
      const currentContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const lastContent = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
      
      fixed[fixed.length - 1] = {
        ...lastMsg,
        content: lastContent + '\n\n' + currentContent
      };
    } else {
      fixed.push(msg);
      lastRole = currentRole;
    }
  }
  
  // If the first message is an assistant message, prepend a dummy user message
  if (fixed.length > 0 && fixed[0].role === 'assistant') {
    fixed.unshift({
      role: 'user',
      content: 'Hello'
    });
  }
  
  // If the last message is an assistant message, we need to remove it
  // (since we're about to get a new assistant response)
  if (fixed.length > 0 && fixed[fixed.length - 1].role === 'assistant') {
    fixed.pop();
  }
  
  return fixed;
}

// ── RATE LIMITING ──────────────────────────────────────
// Simple in-memory rate limiter for chat requests
const _chatRateLimitCache = new Map();

export function checkChatRateLimit(userId, maxPerHour = 80) {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  
  let userRequests = _chatRateLimitCache.get(userId) || [];
  // Remove requests older than 1 hour
  userRequests = userRequests.filter(timestamp => timestamp > hourAgo);
  
  if (userRequests.length >= maxPerHour) {
    return { allowed: false, retryAfter: Math.ceil((userRequests[0] + 60 * 60 * 1000 - now) / 1000) };
  }
  
  userRequests.push(now);
  _chatRateLimitCache.set(userId, userRequests);
  
  return { allowed: true };
}
