/**
 * Chat streaming handler with web search, file vision, tool calling
 * Extracted from the main catch-all route.js for maintainability.
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err, getClientIP, getLocationFromIP, checkRateLimit } from '@/lib/api-utils';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import { extractUrlContent, extractUrls } from '@/lib/handlers/url-extractor';
import {
  detectGoogleIntent,
  fetchGoogleContextForChat,
  formatGoogleContextForPrompt,
  executeGoogleAction,
  userHasGoogleConnected,
} from '@/lib/handlers/google-context';
import {
  geocodeAddress,
  searchNearbyPlaces,
  getPlaceDetails,
  parseLocationQuery,
  extractPlaceType,
} from '@/lib/handlers/location-services';
import {
  extractMemoriesFromMessage,
  saveExtractedMemories,
  getUserMemoriesForPrompt,
  buildSystemPrompt,
} from '@/lib/handlers/memory-system';
import {
  selectBestImageModel,
  selectBestVideoModel,
} from '@/lib/handlers/media-intelligence';
import {
  VIDEO_MODELS,
  parseExplicitVideoModelFromPrompt,
  parseExplicitImageModelFromPrompt,
  extractPromptWithoutModelInstruction,
  detectAspectRatioFromPrompt,
  detectContextImageReference,
  detectVideoExtendIntent,
  selectVideoModel,
  generateVideoWithModel,
  generateVideoFromImage,
  extendVideo,
  checkExtendStatus,
} from '@/lib/handlers/video-models';
import { KIE_IMAGE_MODELS } from '@/lib/handlers/image-models';
import { generateImageWithKie } from '@/lib/handlers/model-comparison';
import { parseDocumentContent } from '@/lib/handlers/document-parsing';
import { handleImageEditInternal, handleMockupGenerateInternal, handleSmartComposite } from '@/lib/handlers/image-editing';
import { _systemPromptCache, _chatRateLimitCache, invalidateSystemPromptCache } from '@/lib/handlers/chat-cache';
import { categorizeConversationTopic } from '@/lib/handlers/voice-misc';
import { moderateContent, isContentSafe, SEVERITY } from '@/lib/handlers/content-moderation';
import { enhancePromptWithSpelling, validateImageText, buildRetryPrompt, extractTextFromImage, removeTextFromImage, overlayTextOnVideo } from '@/lib/handlers/spelling-guard';
import { processGitHubChatCommand } from '@/lib/handlers/github-integration';

// ============================================================
// GOOGLE & IMAGE ACTION TOOLS FOR AI TOOL CALLING
// ============================================================

// ── FFMPEG AVAILABILITY CHECK ──────────────────────────────
// ffmpeg is required for video frame extraction. In containerized environments
// it can be lost on restart. This helper checks and auto-installs if needed.
let _ffmpegChecked = false;
let _ffmpegAvailable = false;
async function ensureFfmpeg() {
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

const GOOGLE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_emails',
      description: 'Search the user\'s Gmail inbox for emails matching a query. Use this when the user asks to find, look up, or check emails. Returns matching emails with subject, sender, date, and content preview.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to search (ask user if multiple accounts connected)'
          },
          query: {
            type: 'string',
            description: 'Gmail search query. Can use Gmail search operators like "from:sam", "subject:invoice", "after:2025/01/01", "has:attachment", or plain text search terms.'
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of emails to return (default 10, max 20)'
          }
        },
        required: ['account_email', 'query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_email',
      description: 'Read the full content of a specific email by its message ID. Use this after search_emails to get the complete email body when the user needs full details.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account'
          },
          message_id: {
            type: 'string',
            description: 'The Gmail message ID (obtained from search_emails results)'
          }
        },
        required: ['account_email', 'message_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email using the user\'s connected Gmail account. ALWAYS ask the user which Google account to use before calling this function.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to send from (user must specify which account)'
          },
          to: {
            type: 'string',
            description: 'Email address of the recipient'
          },
          subject: {
            type: 'string',
            description: 'Subject line of the email'
          },
          body: {
            type: 'string',
            description: 'The body/content of the email'
          }
        },
        required: ['account_email', 'to', 'subject', 'body']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create a new event on the user\'s Google Calendar. ALWAYS ask the user which Google account AND which calendar to use before calling this function.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to use (user must specify which account)'
          },
          calendar_id: {
            type: 'string',
            description: 'The calendar ID to create the event on (user must specify which calendar, e.g., "primary" or a specific calendar name/ID)'
          },
          summary: {
            type: 'string',
            description: 'Title/name of the event'
          },
          description: {
            type: 'string',
            description: 'Description or notes for the event'
          },
          location: {
            type: 'string',
            description: 'Location of the event'
          },
          start: {
            type: 'string',
            description: 'Start date and time in ISO 8601 format (e.g., 2024-03-15T14:00:00)'
          },
          end: {
            type: 'string',
            description: 'End date and time in ISO 8601 format (e.g., 2024-03-15T15:00:00)'
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of email addresses to invite'
          }
        },
        required: ['account_email', 'calendar_id', 'summary', 'start', 'end']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_calendar_event',
      description: 'Update/edit an existing calendar event. Use this when the user wants to change, reschedule, or modify an existing event.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account where the event exists'
          },
          calendar_id: {
            type: 'string',
            description: 'The calendar ID where the event exists'
          },
          event_id: {
            type: 'string',
            description: 'The ID of the event to update'
          },
          summary: {
            type: 'string',
            description: 'New title/name of the event (optional)'
          },
          description: {
            type: 'string',
            description: 'New description (optional)'
          },
          location: {
            type: 'string',
            description: 'New location (optional)'
          },
          start: {
            type: 'string',
            description: 'New start date/time in ISO 8601 format (optional)'
          },
          end: {
            type: 'string',
            description: 'New end date/time in ISO 8601 format (optional)'
          }
        },
        required: ['account_email', 'event_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_calendar_event',
      description: 'Delete/cancel a calendar event. Use this when the user wants to remove or cancel an existing event.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account where the event exists'
          },
          calendar_id: {
            type: 'string',
            description: 'The calendar ID where the event exists'
          },
          event_id: {
            type: 'string',
            description: 'The ID of the event to delete'
          }
        },
        required: ['account_email', 'event_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_document',
      description: 'Create a new Google Doc in the user\'s Google Drive. ALWAYS ask the user which Google account to use before calling this function.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to create the document in'
          },
          title: {
            type: 'string',
            description: 'Title/name of the document'
          },
          content: {
            type: 'string',
            description: 'The text content to put in the document. Can include formatting with line breaks.'
          },
          folder_name: {
            type: 'string',
            description: 'Optional folder name to save the document in. If not specified, saves to root of Drive.'
          }
        },
        required: ['account_email', 'title', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_spreadsheet',
      description: 'Create a new Google Sheets spreadsheet. ALWAYS ask the user which Google account to use before calling this function.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to create the spreadsheet in'
          },
          title: {
            type: 'string',
            description: 'Title/name of the spreadsheet'
          },
          headers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Column headers for the spreadsheet'
          },
          data: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'string' }
            },
            description: 'Rows of data (array of arrays, each inner array is a row)'
          }
        },
        required: ['account_email', 'title']
      }
    }
  }
];

// IMAGE EDITING TOOLS - General AI tools (not Google-specific)
const IMAGE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'edit_image',
      description: 'Edit an image that the user has uploaded or that was previously generated in the conversation. Use this ONLY when the user explicitly asks to modify, change, remove, or add something to an existing image. Examples: "remove the background", "remove the hat", "change the shirt color to blue", "add sunglasses", "remove the text", "make it black and white", "replace the background with a beach". Do NOT use this tool for: (1) Questions ABOUT an image (e.g., "why does the image show X?") — answer with text instead. (2) Requests to ANIMATE an image or create a video/animation — those require video generation, not image editing. (3) Requests to "animate", "make it move", "bring to life", "turn into video/animation" — these are VIDEO requests, NOT edits.',
      parameters: {
        type: 'object',
        properties: {
          image_reference: {
            type: 'string',
            description: 'Reference to which image to edit: "attached" for the currently attached image, "last_generated" for the most recently generated image in the conversation, or "message_id:xxx" for a specific message\'s image'
          },
          edit_instruction: {
            type: 'string',
            description: 'Clear, specific description of what to change in the image. Be precise: "remove the red headband", "change the white t-shirt to a blue hoodie", "remove the text from the shirt"'
          }
        },
        required: ['image_reference', 'edit_instruction']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_mockup',
      description: 'Place a design/logo onto a product to create a mockup. Use when the user wants to see their design on a t-shirt, mug, book cover, etc.',
      parameters: {
        type: 'object',
        properties: {
          product: {
            type: 'string',
            description: 'The product to put the design on (e.g., "white t-shirt", "coffee mug", "book cover", "phone case", "tote bag")'
          },
          design_reference: {
            type: 'string',
            description: 'Reference to the design image: "attached" for attached image, or "last_generated" for most recent generated image'
          }
        },
        required: ['product', 'design_reference']
      }
    }
  }
];

// Helper function to reformulate edit instructions to avoid OpenAI safety triggers
// Words like "remove" combined with body parts or accessories can trigger false positives

// ═══════════════════════════════════════════════════════════════════════════
// Smart Mode, Chat Utilities, and Chat Stream
// ═══════════════════════════════════════════════════════════════════════════

const SMART_MODE_MODELS = {
  // Real-time information and research queries
  'sonar-pro': { 
    triggers: ['news', 'today', 'current', 'latest', 'price', 'weather', 'stock', 'live', 'happening now', 'right now', 'tell me about', 'what is', 'who is', 'what can you tell', 'find out about', 'search for', 'look up', 'information about', 'info about', 'details about', 'learn about'],
    capabilities: ['real-time', 'web-search', 'current-events', 'research'],
    provider: 'perplexity'
  },
  // Creative writing
  'claude-sonnet-4-5-20250929': {
    triggers: ['write', 'story', 'poem', 'creative', 'essay', 'blog', 'article', 'content', 'script', 'novel'],
    capabilities: ['creative-writing', 'long-form', 'nuanced'],
    provider: 'anthropic'
  },
  // Code and technical
  'gpt-4o': {
    triggers: ['code', 'debug', 'programming', 'function', 'api', 'bug', 'error', 'implement', 'build', 'develop'],
    capabilities: ['coding', 'technical', 'problem-solving'],
    provider: 'openai'
  },
  // Deep reasoning and analysis
  'claude-opus-4-5-20251101': {
    triggers: ['analyze', 'explain in detail', 'comprehensive', 'research', 'deep dive', 'thorough', 'complex'],
    capabilities: ['deep-reasoning', 'analysis', 'research'],
    provider: 'anthropic'
  },
  // Quick simple queries (cost-effective)
  'gpt-4o-mini': {
    triggers: ['simple', 'quick', 'basic', 'short', 'brief'],
    capabilities: ['fast', 'cheap', 'simple-queries'],
    provider: 'openai'
  },
  // Math and logic
  'gemini-2.5-pro': {
    triggers: ['math', 'calculate', 'equation', 'formula', 'logic', 'proof', 'solve'],
    capabilities: ['math', 'logic', 'reasoning'],
    provider: 'gemini'
  },
};

// Classify query and determine best model
async function classifyQueryForSmartMode(content, conversationHistory = []) {
  const lowerContent = content.toLowerCase();
  
  // First, check for explicit triggers (fast path)
  for (const [model, config] of Object.entries(SMART_MODE_MODELS)) {
    for (const trigger of config.triggers) {
      if (lowerContent.includes(trigger)) {
        return { 
          model, 
          provider: config.provider, 
          reason: `Detected "${trigger}" - using ${model} for ${config.capabilities[0]}`,
          confidence: 'high'
        };
      }
    }
  }
  
  // Check for image/vision content (only if there seems to be an attachment reference)
  if (lowerContent.includes('look at this') || lowerContent.includes('in this image') || lowerContent.includes('analyze this')) {
    return { model: 'gpt-4o', provider: 'openai', reason: 'Vision capabilities needed', confidence: 'high' };
  }
  
  // Skip simple keyword detection for image/video generation - let the main detector handle it
  // This prevents false positives when users are discussing features or making lists
  
  // For longer queries, use AI classification (slower but more accurate)
  if (content.length > 100) {
    try {
      const { getProvider } = await import('@/lib/llm/providers');
      const classifier = getProvider('openai', 'gpt-4o-mini');
      
      const classificationPrompt = `Classify this user query and determine the best AI model to use.

Query: "${content.slice(0, 500)}"

Choose the BEST model:
1. sonar-pro (Perplexity) - BEST FOR: Research queries, "what is X", "who is X", "tell me about X", company/product/person info, current events, news, prices, weather, anything needing web search or factual lookup
2. claude-sonnet-4-5-20250929 (Anthropic) - Creative writing, stories, essays, blog posts, nuanced content
3. gpt-4o (OpenAI) - Code, debugging, technical implementation, programming help
4. claude-opus-4-5-20251101 (Anthropic) - Deep analysis, complex reasoning, thorough explanations
5. gpt-4o-mini (OpenAI) - Quick simple queries, basic conversational tasks
6. gemini-2.5-pro (Google) - Math, calculations, equations, logical reasoning

IMPORTANT: If the query asks about a company, product, service, person, concept, or anything that requires factual lookup - ALWAYS choose sonar-pro.

Respond with ONLY a JSON object:
{"model": "model-name", "reason": "brief reason"}`;

      const result = await classifier.generateChatCompletion({
        systemPrompt: 'You are a model router. Respond only with valid JSON.',
        messages: [{ role: 'user', content: classificationPrompt }],
        model: 'gpt-4o-mini',
        temperature: 0.1,
      });
      
      const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
      const modelConfig = SMART_MODE_MODELS[parsed.model];
      
      if (modelConfig) {
        return { 
          model: parsed.model, 
          provider: modelConfig.provider, 
          reason: parsed.reason,
          confidence: 'ai-classified'
        };
      }
    } catch (e) {
      console.log('Smart mode AI classification failed, using default:', e.message);
    }
  }
  
  // Default to GPT-4o for general queries
  return { 
    model: 'gpt-4o', 
    provider: 'openai', 
    reason: 'General query - using GPT-4o',
    confidence: 'default'
  };
}

// ============================================================
// ROUTE HANDLERS
// ============================================================


// ── In-memory caches (imported from @/lib/handlers/chat-cache) ───────────────

// ── Chat Rate Limiter (per hour) ──────────────────────────────────────────────
function checkChatRateLimit(userId, maxPerHour = 80) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = _chatRateLimitCache.get(userId) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count++;
  }
  _chatRateLimitCache.set(userId, entry);
  return entry.count > maxPerHour;
}

// ── Input Sanitizer ───────────────────────────────────────────────────────────
// Strips common prompt-injection patterns before sending to any LLM
function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/ignore\s+(previous|all|above|prior)\s+instructions?/gi, '[input filtered]')
    .replace(/\bDAN\b/g, '[filtered]')
    .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>/g, '')
    .replace(/```\s*(system|instructions?|prompt)\b/gi, '```')
    .substring(0, 8000); // hard cap per message
}

// ── Smart History Trimmer (token-aware) ───────────────────────────────────────
// Keeps the most recent messages that fit within a token budget
// This is a best practice to avoid context window overflow and unnecessary token costs
function trimHistory(messages, maxContextTokens = 128000) {
  if (!messages || messages.length === 0) return [];
  
  const MIN_RECENT_MESSAGES = 6; // Always keep at least the last 6 messages
  const MAX_SINGLE_MSG_TOKENS = 32000; // Truncate individual messages beyond this (~128K chars)
  
  // First pass: truncate overly long individual messages (e.g. pasted transcripts)
  const processed = messages.map(msg => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const est = Math.ceil(content.length / 4);
    if (est > MAX_SINGLE_MSG_TOKENS && typeof msg.content === 'string') {
      const maxChars = MAX_SINGLE_MSG_TOKENS * 4;
      return {
        ...msg,
        content: msg.content.slice(0, maxChars) + `\n\n...[message truncated — original was ~${est} tokens (~${Math.round(content.length/1000)}K chars). Tip: attach large text as a file for full processing]`,
      };
    }
    return msg;
  });
  
  let total = 0;
  const trimmed = [];
  
  // Work backwards (most-recent first), keep messages that fit
  for (let i = processed.length - 1; i >= 0; i--) {
    const msg = processed[i];
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const est = Math.ceil(content.length / 4) + 4;
    
    // Always include the minimum recent messages
    const isRecent = (processed.length - i) <= MIN_RECENT_MESSAGES;
    
    if (!isRecent && total + est > maxContextTokens) break;
    total += est;
    trimmed.unshift(msg);
  }
  
  return ensureAlternatingMessages(trimmed);
}

// Ensure messages alternate between user and assistant roles
// OpenAI API requires: system -> user -> assistant -> user -> assistant...
// Gemini API requires: First message must be 'user' role, then alternate user/model
function ensureAlternatingMessages(messages) {
  if (!messages || messages.length === 0) return [];
  
  const result = [];
  let lastRole = null;
  
  for (const msg of messages) {
    // Skip messages with empty content
    if (!msg.content || (typeof msg.content === 'string' && !msg.content.trim())) {
      continue;
    }
    
    // Handle consecutive messages of the same role by merging content
    if (msg.role === lastRole && result.length > 0) {
      const lastMsg = result[result.length - 1];
      
      // Merge content based on type
      if (typeof lastMsg.content === 'string' && typeof msg.content === 'string') {
        // Both are strings - concatenate with separator
        lastMsg.content = `${lastMsg.content}\n\n${msg.content}`;
      } else if (Array.isArray(lastMsg.content) && Array.isArray(msg.content)) {
        // Both are arrays (multimodal) - concatenate
        lastMsg.content = [...lastMsg.content, ...msg.content];
      } else if (Array.isArray(lastMsg.content) && typeof msg.content === 'string') {
        // Last is array, new is string - add as text element
        lastMsg.content.push({ type: 'text', text: msg.content });
      } else if (typeof lastMsg.content === 'string' && Array.isArray(msg.content)) {
        // Last is string, new is array - convert and merge
        lastMsg.content = [{ type: 'text', text: lastMsg.content }, ...msg.content];
      } else {
        // Fallback: replace with newer message
        result[result.length - 1] = msg;
      }
      continue;
    }
    
    result.push({ ...msg }); // Clone to avoid mutation
    lastRole = msg.role;
  }
  
  // CRITICAL: Gemini requires the first message to be from 'user' role
  // If history starts with assistant/model message, remove it
  while (result.length > 0 && result[0].role === 'assistant') {
    result.shift();
  }
  
  // CRITICAL: Ensure the last message is from 'user' role for the LLM to respond
  // If history ends with assistant message, add a placeholder user message
  if (result.length > 0 && result[result.length - 1].role === 'assistant') {
    console.log('[ensureAlternatingMessages] Warning: Last message was assistant, history may be incomplete');
  }
  
  // Log for debugging
  if (result.length > 0) {
    const roleSequence = result.map(m => m.role[0]).join(''); // e.g., "uauau"
    if (roleSequence.includes('uu') || roleSequence.includes('aa')) {
      console.error('[ensureAlternatingMessages] ERROR: Still have consecutive roles:', roleSequence);
    }
  }
  
  return result;
}

// ── Cached System Prompt (5-min TTL) ─────────────────────────────────────────
// Best practice: avoid rebuilding + re-querying profile on every message
async function getSystemPrompt(db, userId) {
  const cached = _systemPromptCache.get(userId);
  if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) return cached.prompt;
  const prompt = await buildSystemPrompt(db, userId);
  _systemPromptCache.set(userId, { prompt, ts: Date.now() });
  return prompt;
}

// invalidateSystemPromptCache now imported from @/lib/handlers/chat-cache

// ── Data Retention Cleanup (async, best-effort) ───────────────────────────────
// Called opportunistically — deletes messages older than the retention window
async function enforceDataRetention(db, userId) {
  try {
    const settings = await db.collection('app_settings').findOne({ key: 'global' });
    const retentionDays = settings?.message_retention_days || 365; // default 1 year
    if (retentionDays <= 0) return; // 0 = keep forever
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    // Only run cleanup 1% of requests to avoid overhead
    if (Math.random() < 0.01) {
      await db.collection('messages').deleteMany({ user_id: userId, created_at: { $lt: cutoff } });
    }
  } catch { /* non-blocking */ }
}

// CHAT STREAM - Streaming chat with web search + file vision
async function handleChatStream(request) {
  const user = await authenticate(request).catch(authErr => {
    if (authErr?.isDbError) {
      console.error('[Chat] Database unavailable during auth:', authErr.message);
      return { _dbError: true };
    }
    return null;
  });
  
  if (user?._dbError) {
    return err('Server is temporarily busy. Please try again in a moment.', 503);
  }
  if (!user) return err('Unauthorized', 401);

  // Rate limit check
  const rateCheck = checkRateLimit(user.id, 'chat');
  if (!rateCheck.allowed) {
    return err(`Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.`, 429);
  }

  if (!user.accepted && user.role === 'user') {
    return err('Account pending approval', 403);
  }

  const body = await request.json();
  let {
    conversationId, content, model = 'gpt-4o',
    provider: providerNameRaw = null,
    attachments = [],   // [{ type: 'image'|'document', base64: '...', mimeType: '...', name: '...', text: '...' }]
    enableWebSearch = true,
    projectId = null,   // Optional project to associate new conversations with
    videoModel: userPreferredVideoModel = null,   // User's video model preference (null = Dynamic Intelligence)
    imageModel: userPreferredImageModel = null,   // User's image model preference (null = Dynamic Intelligence)
    mediaFlow = null,   // Media confirmation flow: { step, type, originalPrompt, finalPrompt, selectedModel }
    incognito = false,  // Incognito mode: no messages/conversations saved to DB
    mediaGenMode = false, // Media creation mode: when true, auto-generates on trigger; when false, asks confirmation
    userLocation = null, // User's GPS location: { lat, lng, address } — sent from frontend
  } = body;
  
  // Dynamic Intelligence - automatically select best model
  let smartModeInfo = null;
  if (model === 'smart') {
    smartModeInfo = await classifyQueryForSmartMode(content || '');
    model = smartModeInfo.model;
    providerNameRaw = smartModeInfo.provider;
  }
  
  // Derive provider from model info; fall back to openai
  const { getModelInfo } = await import('@/lib/llm/providers');
  const modelInfo = getModelInfo(model);
  const providerName = (providerNameRaw && providerNameRaw !== 'hosted') ? providerNameRaw : (modelInfo?.provider || 'openai');
  if (!content && attachments.length === 0) return err('content required');

  const db = await getDb();

  // Auto-detect location from IP if user doesn't have one saved
  // Priority: 1) userLocation from request body (GPS), 2) DB saved location, 3) IP geolocation
  let existingLocation = null;
  if (userLocation && userLocation.lat && userLocation.lng) {
    // Use fresh GPS coordinates from the frontend — most accurate
    existingLocation = { lat: userLocation.lat, lng: userLocation.lng, address: userLocation.address || '' };
    // Also save/update to DB for future use
    await db.collection('user_locations').updateOne(
      { user_id: user.id },
      { $set: { lat: userLocation.lat, lng: userLocation.lng, address: userLocation.address || '', source: 'gps', updated_at: new Date() } },
      { upsert: true }
    ).catch(() => {});
  } else {
    existingLocation = await db.collection('user_locations').findOne({ user_id: user.id });
  }
  if (!existingLocation || !existingLocation.lat) {
    const clientIP = getClientIP(request);
    if (clientIP) {
      const ipLocation = await getLocationFromIP(clientIP);
      if (ipLocation) {
        await db.collection('user_locations').updateOne(
          { user_id: user.id },
          { 
            $set: { 
              ...ipLocation,
              updated_at: new Date()
            } 
          },
          { upsert: true }
        );
        // Invalidate cache so the new location is included in the system prompt
        invalidateSystemPromptCache(user.id);
      }
    }
  }

  // Get or create conversation
  let convId = conversationId;
  let conv = conversationId
    ? await db.collection('conversations').findOne({ id: conversationId, user_id: user.id })
    : null;

  if (!conv) {
    convId = uuidv4();
    const now = new Date();
    const title = (content || 'File attachment').slice(0, 50) + ((content?.length > 50) ? '...' : '');
    
    // Build conversation object with optional project_id
    const newConv = {
      id: convId, user_id: user.id, title, created_at: now, updated_at: now,
    };
    
    // If projectId is provided and valid (not 'general' or null), add it
    if (projectId && projectId !== 'general') {
      // Verify user has access to this project
      const project = await db.collection('projects').findOne({
        id: projectId,
        $or: [
          { owner_id: user.id },
          { shared_with: user.id }
        ]
      });
      if (project) {
        newConv.project_id = projectId;
      }
    }
    
    if (!incognito) {
      await db.collection('conversations').insertOne(newConv);
    } else {
      console.log(`[Incognito] Skipping conversation save for ${convId}`);
    }
  }

  // ── Incognito DB Write Helper ─────────────────────────────────────────────
  // Wraps all message/conversation DB writes to skip in incognito mode
  const dbMessages = {
    insertOne: async (doc) => {
      if (incognito) { console.log(`[Incognito] Skipping message save`); return { acknowledged: true }; }
      return db.collection('messages').insertOne(doc);
    },
  };
  const dbConversations = {
    updateOne: async (filter, update, options) => {
      if (incognito) { return { acknowledged: true }; }
      return db.collection('conversations').updateOne(filter, update, options);
    },
  };

  // Save user message (text only for storage)
  const userMsgId = uuidv4();
  const storedContent = content + (attachments.length > 0 ? ` [+${attachments.length} attachment(s)]` : '');
  await dbMessages.insertOne({
    id: userMsgId, conversation_id: convId, user_id: user.id,
    role: 'user', content: storedContent, created_at: new Date(), model_used: model,
  });

  // Check if user is explicitly asking to remember something
  let memoryToSave = null;
  if (content) {
    const contentLower = content.toLowerCase();
    const rememberPatterns = [
      /^(?:please\s+)?remember\s+(?:that\s+)?(.+)/i,
      /^(?:please\s+)?don'?t\s+forget\s+(?:that\s+)?(.+)/i,
      /^(?:please\s+)?save\s+(?:this\s+)?(?:to\s+)?(?:my\s+)?(?:memory|memories)[:\s]*(.+)/i,
      /^(?:please\s+)?keep\s+(?:this\s+)?in\s+mind[:\s]*(.+)/i,
      /^(?:please\s+)?note\s+(?:that\s+)?(.+)/i,
      /^(?:please\s+)?add\s+(?:this\s+)?(?:to\s+)?(?:my\s+)?(?:memory|memories)[:\s]*(.+)/i,
      /^(?:please\s+)?memorize\s+(?:that\s+)?(.+)/i,
    ];
    
    for (const pattern of rememberPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        memoryToSave = match[1].trim();
        break;
      }
    }
    
    // Save the memory immediately if detected
    if (memoryToSave && memoryToSave.length > 10 && !incognito) {  // Increased from 3 to 10 for more meaningful memories
      const memoryId = uuidv4();
      await db.collection('user_memories').insertOne({
        id: memoryId,
        user_id: user.id,
        content: memoryToSave,
        category: 'other',
        source: 'user_explicit',
        importance: 'high',
        created_at: new Date(),
        updated_at: new Date(),
      });
      
      // Invalidate system prompt cache since memories changed
      invalidateSystemPromptCache(user.id);
    }
  }

  // Get recent messages for context (best practice: use smart token-aware trimming)
  const recentMessages = await db.collection('messages')
    .find({ conversation_id: convId, id: { $ne: userMsgId } })
    .sort({ created_at: -1 }).limit(50).toArray();
  recentMessages.reverse();

  // Apply smart token-aware trimming (keeps last 6 messages always + fits within 32k tokens)
  const rawHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));
  let historyMessages = trimHistory(rawHistory, 128000);

  // Build the current user message — support images (vision) + documents
  let userMessageContent;
  if (attachments.length > 0) {
    userMessageContent = [];
    if (content) userMessageContent.push({ type: 'text', text: content });

    for (const att of attachments) {
      if (att.type === 'image' && att.base64) {
        // Handle URL references (pre-uploaded images)
        const base64Value = att.base64;
        const isUrl = att.isUrlReference || base64Value.startsWith('http://') || base64Value.startsWith('https://');
        const isAttachmentProtocol = base64Value.startsWith('attachment://');
        
        if (isUrl) {
          // Direct URL reference — use as image_url directly
          userMessageContent.push({
            type: 'image_url',
            image_url: { url: base64Value, detail: 'high' },
          });
        } else if (isAttachmentProtocol) {
          // Resolve from MongoDB temp_attachments
          try {
            const attachmentId = base64Value.replace('attachment://', '');
            const db = await getDb();
            const doc = await db.collection('temp_attachments').findOne({ id: attachmentId });
            if (doc) {
              userMessageContent.push({
                type: 'image_url',
                image_url: { url: `data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64}`, detail: 'high' },
              });
            } else {
              console.warn(`[Chat] Attachment ${attachmentId} not found in temp_attachments`);
            }
          } catch (resolveErr) {
            console.warn('[Chat] Failed to resolve attachment://', resolveErr.message);
          }
        } else {
          // Standard base64 inline data
          userMessageContent.push({
            type: 'image_url',
            image_url: { url: `data:${att.mimeType || 'image/jpeg'};base64,${base64Value}`, detail: 'high' },
          });
        }
      } else if (att.type === 'document' && att.text) {
        userMessageContent.push({
          type: 'text',
          text: `\n\n[Attached document: ${att.name}]\n${att.text}\n[End of document]`,
        });
      }
    }
  } else {
    userMessageContent = content;
  }

  historyMessages.push({ role: 'user', content: userMessageContent });

  // ── Best Practice: Rate Limiting ────────────────────────────────────────────
  if (checkChatRateLimit(user.id)) {
    return err('Rate limit exceeded — please slow down (max 80 messages/hour)', 429);
  }

  // ── Best Practice: Input Sanitization ───────────────────────────────────────
  const sanitizedContent = sanitizeInput(content);

  // ── GitHub context placeholder (populated later after GitHub command processing) ──
  let githubContext = null;

  // ── Content Moderation — Block prohibited content ─────────────────────────
  const moderationResult = moderateContent(sanitizedContent, 'chat');
  if (moderationResult.severity === SEVERITY.BLOCK) {
    console.log(`[Moderation] BLOCKED user=${user.id} category=${moderationResult.category} snippet="${sanitizedContent.substring(0, 80)}..."`);
    // Stream the moderation message as a polite refusal
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'content',
          content: moderationResult.message,
        }) + '\n'));
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
        controller.close();
      }
    });
    return new NextResponse(stream, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    });
  }

  // ── Best Practice: Data Retention (async, best-effort) ───────────────────────
  if (!incognito) enforceDataRetention(db, user.id).catch(() => {});

  // ── Best Practice: Cached System Prompt ──────────────────────────────────────
  let systemPrompt = await getSystemPrompt(db, user.id);
  
  // ── Project-Specific Instructions ───────────────────────────────────────────
  // If the conversation belongs to a project with custom instructions, prepend them
  const actualConv = conv || await db.collection('conversations').findOne({ id: convId });
  if (actualConv?.project_id) {
    const project = await db.collection('projects').findOne({ id: actualConv.project_id });
    if (project?.instructions && project.instructions.trim()) {
      systemPrompt = `[PROJECT INSTRUCTIONS - "${project.name}"]\n${project.instructions.trim()}\n\n[END PROJECT INSTRUCTIONS]\n\n${systemPrompt}`;
      console.log(`Applied project instructions from "${project.name}" (${project.instructions.length} chars)`);
    }
  }
  
  // ── Fetch Google Context if user has connected Google ──────────────────────────
  const googleContext = await fetchGoogleContextForChat(user.id, content || '');
  if (googleContext) {
    const googleContextStr = formatGoogleContextForPrompt(googleContext);
    if (googleContextStr) {
      systemPrompt += googleContextStr;
      console.log('Added Google context to chat - Gmail:', !!googleContext.gmail, 'Calendar:', !!googleContext.calendar, 'Drive:', !!googleContext.drive);
    } else if (googleContext.hasGoogleConnected) {
      // User has Google connected but query didn't trigger data fetch
      // Still inform AI it has action capabilities
      systemPrompt += '\n\n--- GOOGLE INTEGRATION ACTIVE ---\n';
      systemPrompt += 'The user has connected their Google account. You have the ability to:\n';
      systemPrompt += '- search_emails: Search and find emails in their Gmail inbox\n';
      systemPrompt += '- read_email: Read the full content of a specific email\n';
      systemPrompt += '- send_email: Send emails from their Gmail\n';
      systemPrompt += '- create_calendar_event: Create new calendar events\n';
      systemPrompt += '- update_calendar_event: Update existing events\n';
      systemPrompt += '- delete_calendar_event: Delete events\n';
      systemPrompt += '- create_document: Create a Google Doc with text content\n';
      systemPrompt += '- create_spreadsheet: Create a Google Sheets spreadsheet with data\n';
      systemPrompt += '\nIMPORTANT: When the user asks about their emails, ALWAYS use search_emails to look up real data. NEVER make up or hallucinate email content.\n';
      systemPrompt += 'BE PROACTIVE: When appropriate, offer to take action:\n';
      systemPrompt += '- If you draft/write content, ask: "Would you like me to save this as a Google Doc?"\n';
      systemPrompt += '- If discussing meetings/appointments, ask: "Would you like me to add this to your calendar?"\n';
      systemPrompt += '- If you create lists/tables/data, ask: "Would you like me to create a spreadsheet with this?"\n';
      systemPrompt += '- If discussing communication, ask: "Would you like me to draft an email?"\n';
      systemPrompt += 'When the user confirms, USE THE TOOLS to perform the action.\n';
    }
  }
  
  // ── Inject GitHub context if available ──────────────────────────────────────
  if (githubContext) {
    systemPrompt += '\n\n' + githubContext;
  }

  const provider = getProvider(providerName, model);
  const assistantMsgId = uuidv4();
  let fullContent = '';

  // ── Media intent detection ──────────────────────────────────────────────
  // Detect if user is asking to generate an image or video
  const detectMediaIntent = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase().trim();
    
    // Don't detect media intent for long texts (likely task lists, documents, etc.)
    // Real image/video generation requests are typically short and direct
    // Increased limit to 800 for infographic requests which include more details
    if (text.length > 800) return null;
    
    // Don't detect if the text contains multiple line breaks (likely a list or document)
    const lineBreaks = (text.match(/\n/g) || []).length;
    if (lineBreaks > 5) return null; // Increased to allow bullet points in infographic descriptions
    
    // Don't detect if the text seems to be asking about features, discussing, or listing tasks
    // BUT exclude diagram/chart/visual generation requests which legitimately use "create/build"
    const isVisualGenRequest = /\b(?:diagram|chart|schematic|blueprint|flowchart|wireframe|mindmap|infographic|flyer|poster|banner|image|picture|photo|illustration|graphic|visual)\b/i.test(lower);
    const taskListIndicators = [
      /\b(task|todo|to-do|list|prioritize|organize|help me|create.*list|feature|ability to|fix|integration|review)\b/i,
      /\b(should|could|would|can we|let's|need to|want to)\b.*\b(add|implement|build|create|fix)\b/i,
    ];
    if (!isVisualGenRequest && taskListIndicators.some(p => p.test(lower))) return null;
    
    // Video detection (check first — more specific)
    // Must be a clear, direct request at the start of the message
    const videoPatterns = [
      /^(?:please\s+)?(?:can you\s+)?generate\s+(?:a\s+)?(?:[\w]+\s+)*video\b/i, 
      /^(?:please\s+)?(?:can you\s+)?create\s+(?:a\s+)?(?:[\w]+\s+)*video\b/i,
      /^(?:please\s+)?(?:can you\s+)?make\s+(?:a\s+)?(?:[\w]+\s+)*video\b/i, 
      /^(?:please\s+)?(?:can you\s+)?video\s+of\b/i,
      /^(?:please\s+)?(?:can you\s+)?animate\b/i,
      // Additional patterns for image-to-video with attachments
      /\bturn\s+(?:this|it)\s+into\s+(?:a\s+)?(?:video|animation|clip)\b/i,
      /\bmake\s+(?:this|it)\s+(?:a\s+|into\s+(?:a\s+)?)?(?:video|animation)\b/i,
      /\bconvert\s+(?:this|it)?\s*(?:to|into)\s+(?:a\s+)?(?:video|animation)\b/i,
      /\bi\s+want\s+(?:a\s+|an\s+)?(?:[\w]+\s+)*(?:video|animation)\b/i,
      /\b(?:create|make|generate)\s+(?:a\s+)?(?:[\w]+\s+)*video\s+(?:from|of|with|using|about|showing)\b/i,
      /\b(?:animate|bring\s+to\s+life)\s+(?:this|it|the|my|that)\s*(?:image|picture|photo|png|jpg)?\b/i,
      /\bvideo\s+(?:from|of)\s+(?:this|the|my|that)\s*(?:image|picture|photo|png)?\b/i,
      /\b(?:generate|create|make)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:[\w]+\s+)*(?:video|animation)\b/i,
      // Context-aware: "now make/create a video of the [noun] [doing something]"
      /^(?:now\s+)?(?:please\s+)?(?:can you\s+)?(?:make|create|generate)\s+(?:a\s+)?video\b/i,
      // "video of it/this/that [verb]ing" patterns
      /\bvideo\s+of\s+(?:it|this|that|the\s+\w+)\s+\w+ing\b/i,
      // "make it move/drive/fly" patterns (implied video from animation)
      /\b(?:make|let)\s+(?:it|this|that|the\s+\w+)\s+(?:move|drive|fly|walk|run|spin|dance|swim|jump|bounce|rotate|float)\b/i,
      // "animation of this/the image" / "an animation from this"
      /\b(?:an?\s+)?animation\s+(?:of|from|for|with)\s+(?:this|it|the|my|that)\b/i,
      // "make this animated" / "I want this animated"
      /\b(?:make|get|have|want)\s+(?:this|it|that)\s+animated\b/i,
      // "animated version" / "animate it" / "create animation"  
      /\banimated\s+(?:version|clip|vid)\b/i,
      /\bcreate\s+(?:a\s+|an\s+)?animation\b/i,
      // "can you animate" / "please animation" — catch-all for animate/animation keywords
      /\b(?:please\s+)?(?:i\s+want\s+to\s+)?animate\s/i,
      // "need a video" / "need a video prompt" / "I need a video of" / "need an animation"
      /\b(?:i\s+)?need\s+(?:a\s+|an\s+)?(?:[\w]+\s+)*(?:video|animation)\b/i,
      // "can I get a video" / "give me a video" / "get me a video"
      /\b(?:can\s+i\s+get|give\s+me|get\s+me)\s+(?:a\s+|an\s+)?(?:[\w]+\s+)*(?:video|animation)\b/i,
      // "video prompt for" — user explicitly asking for a video prompt
      /\bvideo\s+prompt\s+(?:for|of|about|with|showing)\b/i,
    ];
    if (videoPatterns.some(p => p.test(lower))) return 'video';
    
    // INFOGRAPHIC/FLYER detection - these MUST generate actual images, not text!
    // Check BEFORE general image patterns since these are more specific
    const infographicPatterns = [
      // Direct requests for infographics
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:an?\s+)?(?:beautiful\s+)?infographic/i,
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:a\s+)?(?:beautiful\s+)?flyer/i,
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:a\s+)?(?:beautiful\s+)?poster/i,
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:a\s+)?(?:beautiful\s+)?banner/i,
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:a\s+)?(?:beautiful\s+)?brochure/i,
      // User confirmation patterns (when AI offered and user said yes)
      // These must be SHORT confirmation responses that EXPLICITLY mention what to generate
      // Bare "ok" or "yes" should NOT trigger - they could be confirming anything
      /^(?:yes|yeah|sure|ok|okay|go ahead|do it|create it|make it|generate it)[,!\s.]*(?:generate|create|make)\s+(?:the|that|this|it\s+)?(?:infographic|flyer|poster|image)[,!\s.]*$/i,
      /^please\s+(?:generate|create|make|design)\s+(?:(?:the|an?)\s+)?(?:infographic|flyer|poster|image|banner|brochure)/i,
      // Direct keyword triggers - only if short message (under 200 chars)
      ...(lower.length < 200 ? [
        /\binfographic\b.*\b(?:about|for|showing|with|on)\b/i,
        /\bflyer\b.*\b(?:about|for|showing|with|on)\b/i,
      ] : []),
      // "turn this into" patterns
      /(?:turn|convert)\s+(?:this|it)\s+into\s+(?:an?\s+)?(?:infographic|flyer|poster)/i,
      // "I want/need" patterns
      /(?:i\s+)?(?:want|need|would like)\s+(?:an?\s+)?(?:infographic|flyer|poster)/i,
    ];
    if (infographicPatterns.some(p => p.test(lower))) {
      console.log('[detectMediaIntent] Detected infographic/flyer request - will generate image');
      return 'image';
    }
    
    // Image detection - clear requests for image/picture/art generation
    const imagePatterns = [
      // Direct "generate/create/make [an/the] [modifiers] image/picture/photo/diagram" patterns
      // Allows aspect ratios (16:9, 4:3), adjectives (beautiful, HD, large) between article and noun
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?generate\s+(?:me\s+)?(?:an?|the)\s+(?:[\w:./-]+\s+){0,4}(?:image|picture|photo|illustration|art|artwork|graphic|visual|diagram|chart|schematic|blueprint|flowchart|wireframe|mindmap)\b/i, 
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?create\s+(?:me\s+)?(?:an?|the)\s+(?:[\w:./-]+\s+){0,4}(?:image|picture|photo|illustration|art|artwork|graphic|visual|logo|icon|banner|design|diagram|chart|schematic|blueprint|flowchart|wireframe|mindmap)\b/i,
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?make\s+(?:me\s+)?(?:an?|the)\s+(?:[\w:./-]+\s+){0,4}(?:image|picture|photo|illustration|art|artwork|graphic|visual|logo|icon|banner|design|diagram|chart|schematic|blueprint|flowchart|wireframe|mindmap)\b/i, 
      // "create/make a picture OF" patterns — with modifiers
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?(?:create|make|generate)\s+(?:me\s+)?(?:an?|the)\s+(?:[\w:./-]+\s+){0,4}(?:picture|photo|portrait|sketch|illustration|painting|cartoon|drawing|rendering|diagram|chart|schematic|blueprint|flowchart|wireframe)\s+(?:of|for|with|showing)\b/i,
      // "draw/paint me a [subject]" patterns
      /^(?:please\s+)?(?:can you\s+)?draw\s+(?:me\s+)?(?:a|an)\s+/i,
      /^(?:please\s+)?(?:can you\s+)?paint\s+(?:me\s+)?(?:a|an)\s+/i, 
      /^(?:please\s+)?(?:can you\s+)?sketch\s+(?:me\s+)?(?:a|an)\s+/i,
      /^(?:please\s+)?(?:can you\s+)?illustrate\s+/i,
      // "show/give me a picture/image" patterns
      /^(?:please\s+)?(?:can you\s+)?(?:show|give)\s+me\s+(?:an?\s+)?(?:picture|image|photo|illustration)\b/i,
      // "picture/photo/illustration of" at start
      /^(?:please\s+)?(?:can you\s+)?(?:picture|photo|illustration|portrait)\s+of\b/i, 
      // "design a [thing]" patterns (logos, graphics, etc.)
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?design\s+(?:me\s+)?(?:a|an|the|my)\s+(?:logo|icon|banner|header|thumbnail|cover|graphic|badge|emblem|mascot|avatar|wallpaper|background|mockup)\b/i,
      // "design a [adjective] [subject]" pattern (e.g., "design a beautiful landscape")
      /^(?:please\s+)?(?:can you\s+)?design\s+(?:me\s+)?(?:a|an)\s+(?:\w+\s+){0,2}(?:landscape|scene|portrait|character|creature|animal|building|city|room|car|house)\b/i,
      // "visualize" patterns
      /^(?:please\s+)?(?:can you\s+)?visualize\s+/i,
      // "I want/need" patterns with image keywords
      /(?:i\s+)?(?:want|need|would like)\s+(?:an?\s+)?(?:image|picture|photo|illustration|logo|icon|graphic|drawing|sketch|portrait|painting|render|rendering|diagram|chart|schematic|blueprint|flowchart|wireframe)\s+(?:of|for|with|showing)\b/i,
      /(?:i\s+)?(?:want|need|would like)\s+(?:you\s+to\s+)?(?:generate|create|make|draw|design)\s+(?:me\s+)?(?:an?|the)\s+(?:picture|image|photo|logo|visual|graphic|diagram|chart|schematic|blueprint|flowchart|wireframe)\b/i,
      // "make me a logo/design for" patterns
      /^(?:please\s+)?(?:can you\s+)?(?:make|create|design|generate)\s+(?:me\s+)?(?:an?\s+)?(?:logo|icon|badge|emblem)\s+(?:for|of|with)\b/i,
      // Tool/platform references
      /\bdall-?e\b/i, /\bstable\s+diffusion\b/i, /\bmidjourney\b/i,
      // Short confirmation/request patterns for image generation (after discussing a design)
      /^image[!.\s]*$/i,  // Just "Image" or "Image!"
      // "generate/create/make the image [for X]" - RELAXED: allows text after "image"
      /^(?:generate|create|make)\s+(?:the\s+)?(?:image|picture|logo|design|visual|graphic|diagram|chart|schematic|blueprint|flowchart|wireframe)\b/i,
      /^(?:yes|yeah|please|sure|ok|okay|go ahead|do it)[,!\s]*(?:generate|create|make)\s+(?:the\s+)?(?:image|picture|logo|design|visual|graphic|diagram|chart|schematic|blueprint|flowchart|wireframe)\b/i,
      // "generate it / create it / make it" (after discussing the visual)
      /^(?:please\s+)?(?:generate|create|make)\s+it[!.\s]*$/i,
      // "now generate/create/make" patterns
      /^(?:now\s+)?(?:please\s+)?(?:go ahead and\s+)?(?:generate|create|make|build)\s+(?:the\s+|that\s+)?(?:image|picture|photo|visual|graphic|infographic|flyer|poster|banner|diagram|chart|schematic|blueprint|flowchart|wireframe)\b/i,
      // "need an image" / "I need an image of" / "need a picture of"
      /\b(?:i\s+)?need\s+(?:a\s+|an\s+)?(?:\w+\s+)?(?:image|picture|photo|illustration|graphic|visual|poster|flyer|banner|infographic|logo|icon|design|diagram|chart|schematic|blueprint|flowchart|wireframe)\s+(?:of|for|with|showing|about)\b/i,
      // "can I get an image" / "give me an image" / "get me an image"
      /\b(?:can\s+i\s+get|give\s+me|get\s+me)\s+(?:a\s+|an\s+)?(?:\w+\s+){0,2}(?:image|picture|photo|illustration|graphic|visual|poster|flyer|logo|icon|diagram|chart|schematic|blueprint|flowchart|wireframe)\b/i,
      // "image prompt for" — user explicitly asking for an image prompt
      /\bimage\s+prompt\s+(?:for|of|about|with|showing)\b/i,
    ];
    if (imagePatterns.some(p => p.test(lower))) return 'image';
    return null;
  };

  let mediaIntent = detectMediaIntent(sanitizedContent);
  
  // Force video intent if user has image attachment AND mentions video/animate keywords
  // This prevents the LLM tool call system from intercepting with generate_mockup or edit_image
  if (!mediaIntent && attachments.length > 0 && attachments.some(a => a.type === 'image' || a.type?.startsWith('image/') || a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/'))) {
    const videoKeywords = /\b(video|animate|animation|animated|motion|bring\s+to\s+life|turn\s+into\s+video|make\s+.*video|clip)\b/i;
    if (videoKeywords.test(sanitizedContent)) {
      console.log('[MediaIntent] Forcing video intent — image attachment + video keyword detected');
      mediaIntent = 'video';
    }
  }
  
  // Also force video intent when referencing a conversation image with animate/animation keywords
  // This catches "animate this" when the user is referring to a previously generated image
  if (!mediaIntent && /\b(animate|animation|animated|bring\s+to\s+life)\b/i.test(sanitizedContent)) {
    console.log('[MediaIntent] Forcing video intent — animate/animation keyword detected');
    mediaIntent = 'video';
  }

  // ── VIDEO EDIT DETECTION ──────────────────────────────────────────────
  // Detect when user wants to EDIT a video (remove/add/change elements).
  // This is different from extending or generating — the user wants modifications to an existing video.
  // We handle this by: extracting a frame → generating a new video with the edit instructions as prompt.
  
  // Check if user has uploaded a video attachment — if so, use BROADER intent matching
  // (they don't need to say "video" when the video is already attached)
  const hasVideoAttachment = attachments.some(a => 
    a.mimeType?.startsWith('video/') || a.mime_type?.startsWith('video/') || 
    a.type === 'video' || a.name?.match(/\.(mp4|mov|avi|webm|mkv|m4v)$/i)
  );
  
  const isVideoEditRequest = !mediaIntent && (
    /\b(?:edit|modify|change|alter|fix|correct|remove|delete|erase|add|replace|crop|trim|cut)\b.*\b(?:video|clip|footage|recording|mp4)\b/i.test(sanitizedContent) ||
    /\b(?:video|clip|footage|recording)\b.*\b(?:edit|modify|change|alter|fix|correct|remove|delete|erase|add|replace)\b/i.test(sanitizedContent) ||
    /\b(?:can you|could you|please|i want to|i need to)\b.*\b(?:edit|modify|remove|change|fix)\b.*\b(?:this|the|my|that)\b.*\b(?:video|clip)\b/i.test(sanitizedContent) ||
    /\b(?:take out|get rid of|clean up|touch up)\b.*\b(?:video|clip|footage)\b/i.test(sanitizedContent) ||
    /\b(?:video|clip|footage)\b.*\b(?:take out|get rid of|clean up|touch up)\b/i.test(sanitizedContent) ||
    // When a video IS attached, match edit-intent keywords WITHOUT requiring "video"
    (hasVideoAttachment && /\b(?:edit|modify|change|alter|fix|correct|remove|delete|erase|add|replace|crop|trim|cut|take out|get rid of|clean up|touch up)\b.*\b(?:this|that|it|the)\b/i.test(sanitizedContent)) ||
    (hasVideoAttachment && /\b(?:this|that|it)\b.*\b(?:edit|modify|change|alter|fix|correct|remove|delete|erase|replace)\b/i.test(sanitizedContent))
  );
  
  if (isVideoEditRequest) {
    console.log('[MediaIntent] Detected video EDIT request — routing to video generation pipeline');
    mediaIntent = 'video';
  }

  // ── GitHub Command Processing ─────────────────────────────────────────────
  // Handle /github slash commands and natural language GitHub queries
  if (content) {
    try {
      const ghResult = await processGitHubChatCommand(user.id, content);
      if (ghResult) {
        if (ghResult.type === 'system_response') {
          // Stream the GitHub system response directly and return
          const encoder = new TextEncoder();
          const ghStream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'meta', conversationId: convId, messageId: assistantMsgId }) + '\n'));
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content: ghResult.content }) + '\n'));
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', messageId: assistantMsgId }) + '\n'));
              controller.close();
            }
          });
          // Save the assistant response to DB
          await dbMessages.insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: ghResult.content, created_at: new Date(),
            model_used: 'github-integration',
          });
          return new Response(ghStream, {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
          });
        } else if (ghResult.type === 'context') {
          // Inject GitHub context into the LLM prompt
          githubContext = ghResult.content;
          console.log('[GitHub] Injecting repo context into LLM prompt');
        }
      }
    } catch (ghErr) {
      console.error('[GitHub] Command processing error:', ghErr.message);
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let controllerClosed = false;
      const send = (obj) => {
        if (controllerClosed) {
          console.warn('[Stream] Attempted to send after controller closed, ignoring:', obj.type);
          return;
        }
        try {
          controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'));
        } catch (e) {
          controllerClosed = true;
          console.warn('[Stream] Controller write failed (closed?):', e.message);
        }
      };

      // Add keepalive mechanism to prevent connection timeouts during GC pauses
      let keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(enc.encode(': keepalive\n\n'));
        } catch (e) {
          clearInterval(keepaliveInterval);
        }
      }, 15000); // Send ping every 15 seconds

      try {
        // Send meta first (include Dynamic Intelligence info if applicable)
        send({ 
          type: 'meta', 
          conversationId: convId, 
          messageId: assistantMsgId,
          ...(smartModeInfo && { 
            smartMode: true,  // Keep for backward compatibility
            dynamicIntelligence: true,  // New field name
            dynamicLabel: 'Dynamic',  // Display label for UI
            selectedModel: model,
            modelReason: smartModeInfo.reason,
            confidence: smartModeInfo.confidence
          }),
          ...(memoryToSave && { memorySaved: true, memoryContent: memoryToSave })
        });

        // Send memory confirmation if we saved one
        if (memoryToSave) {
          send({ type: 'delta', content: '✅ **Saved to your memories:** "' + memoryToSave + '"\n\n---\n\n' });
        }

        // ── Handle image COMPOSITE requests (logo/overlay onto base image) ──
        // Uses PROGRAMMATIC compositing (Sharp) for exact logo preservation
        // AI (GPT-4o Vision) handles intelligent placement analysis only
        
        // Check if there's a recently generated image OR video in the conversation
        let lastImageUrlInConversation = null;
        let lastVideoUrlInConversation = null;
        let lastVideoTaskIdInConversation = null;
        let lastVideoModelInConversation = null;
        
        if (convId) {
          const recentMsgs = await db.collection('messages')
            .find({ conversation_id: convId })
            .sort({ created_at: -1 })
            .limit(30)
            .toArray();
          
          for (const msg of recentMsgs) {
            // Track last image
            if (!lastImageUrlInConversation) {
              if (msg.image_url) {
                lastImageUrlInConversation = msg.image_url;
              } else if (msg.content && typeof msg.content === 'string') {
                const imgMatch = msg.content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
                if (imgMatch) {
                  lastImageUrlInConversation = imgMatch[1];
                }
              }
            }
            // Track last video
            if (!lastVideoUrlInConversation) {
              if (msg.video_url) {
                lastVideoUrlInConversation = msg.video_url;
                lastVideoTaskIdInConversation = msg.video_task?.taskId || null;
                lastVideoModelInConversation = msg.video_task?.videoModel || msg.model_used || null;
              }
            }
            // Stop once we have both
            if (lastImageUrlInConversation && lastVideoUrlInConversation) break;
          }
          
          // Also check video_jobs collection for taskId if we have a video but no taskId
          if (lastVideoUrlInConversation && !lastVideoTaskIdInConversation && convId) {
            const lastVideoJob = await db.collection('video_jobs')
              .findOne({ conversation_id: convId, status: 'success' }, { sort: { created_at: -1 } });
            if (lastVideoJob) {
              lastVideoTaskIdInConversation = lastVideoJob.task_id;
              lastVideoModelInConversation = lastVideoJob.model_id || lastVideoModelInConversation;
            }
          }
          
          if (lastVideoUrlInConversation) {
            console.log(`[Context] Last video in conversation: ${lastVideoUrlInConversation.substring(0, 80)}, taskId: ${lastVideoTaskIdInConversation || 'unknown'}`);
          }
        }
        
        // Composite detection: user has attachment(s) + base image exists + compositing intent
        const hasImageAttachment = attachments.length > 0 && attachments.some(a => 
          a.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(a.name || '')
        );
        
        const compositePatterns = [
          /\b(add|put|place|stick|overlay|apply|attach|composite|swap|replace)\b.*\b(to|on|onto|over|into|with)\b/i,
          /\b(add|put|place|swap|replace)\b.*\b(logo|image|icon|badge|sticker|decal|watermark|label|brand|emblem)\b/i,
          /\b(logo|image|icon|badge|sticker|decal|this)\b.*\b(to|on|onto|over|with)\b.*\b(the|that|this|my|it)\b/i,
          /\b(side|front|back|top|bottom|center|corner|left|right)\b.*\b(of the|of that|of this)\b/i,
          /\b(mockup|mock-up|mock up|composite|merge|combine|blend)\b/i,
          /\b(swap|replace|change)\b.*\b(logo|image|graphic|design|text)\b.*\b(with|to)\b/i,
          /\b(attached|uploaded)\b.*\b(logo|image)\b/i,
        ];
        
        // Also detect composite when user uploads TWO images (base + logo, no conversation image needed)
        const imageAttachments = attachments.filter(a => 
          a.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(a.name || '')
        );
        const hasTwoImageAttachments = imageAttachments.length >= 2;
        
        // NEW: Detect "generate + composite" — user uploads logo AND asks to generate a product with it
        // e.g., "generate a blue minivan with my logo on the door"
        const hasGenerateIntent = /\b(generate|create|make|design|produce|render)\b.*\b(image|picture|photo|mockup)\b/i.test(sanitizedContent) ||
          /\b(generate|create|make)\b.*\b(with|using|featuring)\b.*\b(logo|design|attached|uploaded)\b/i.test(sanitizedContent) ||
          /\b(generate|create|make)\b.*\b(of|a)\b.*\b(with the|with my|with attached|with uploaded)\b/i.test(sanitizedContent);
        const isGenerateAndComposite = hasImageAttachment && !lastImageUrlInConversation && !hasTwoImageAttachments &&
          hasGenerateIntent && compositePatterns.some(p => p.test(sanitizedContent));
        
        const isCompositeRequest = (hasImageAttachment && lastImageUrlInConversation && 
          compositePatterns.some(p => p.test(sanitizedContent))) ||
          (hasTwoImageAttachments && compositePatterns.some(p => p.test(sanitizedContent))) ||
          isGenerateAndComposite;
        
        if (isCompositeRequest) {
          console.log('[Composite] Detected composite request');
          console.log('[Composite] Has two attachments:', hasTwoImageAttachments);
          console.log('[Composite] Generate+Composite:', isGenerateAndComposite);
          console.log('[Composite] Conversation image:', lastImageUrlInConversation?.substring(0, 80) || 'none');
          console.log('[Composite] Instruction:', sanitizedContent.substring(0, 100));
          
          send({ type: 'generating_visual', visualType: 'edit' });
          
          try {
            // Determine base and overlay sources
            let baseBuffer = null;
            let overlayBuffer = null;
            let overlayMime = 'image/png';
            
            if (isGenerateAndComposite) {
              // ── GENERATE + COMPOSITE: User uploads logo + asks to generate a product ──
              // Step 1: Extract the product description from the user's message
              // Step 2: Generate a CLEAN product image (no logo)
              // Step 3: Composite the uploaded logo onto it
              
              send({ type: 'delta', content: '🎨 Generating your product image first, then compositing your exact logo onto it...\n\n' });
              
              const overlayAttachment = imageAttachments[0];
              let ovB64 = overlayAttachment.base64 || overlayAttachment.data;
              overlayMime = overlayAttachment.type || 'image/png';
              // Handle URL references (pre-uploaded images)
              if (ovB64 && (ovB64.startsWith('http://') || ovB64.startsWith('https://'))) {
                const r = await fetch(ovB64);
                ovB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                overlayMime = r.headers.get('content-type') || 'image/png';
              } else if (ovB64 && ovB64.startsWith('attachment://')) {
                const attId = ovB64.replace('attachment://', '');
                const attDoc = await db.collection('temp_attachments').findOne({ id: attId });
                if (attDoc) { ovB64 = attDoc.base64; overlayMime = attDoc.mimeType || 'image/png'; }
              } else if (ovB64 && ovB64.startsWith('data:')) {
                const m = ovB64.match(/^data:([^;]+);base64,(.+)$/);
                if (m) { overlayMime = m[1]; ovB64 = m[2]; }
              }
              if (!ovB64 && overlayAttachment.url) {
                const r = await fetch(overlayAttachment.url);
                ovB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                overlayMime = r.headers.get('content-type') || 'image/png';
              }
              overlayBuffer = Buffer.from(ovB64, 'base64');
              
              // Generate clean product base using Flux Pro via Kie.ai (more reliable than DALL-E for specific subjects)
              // Strip logo-related parts from prompt to get a clean product description
              const cleanPrompt = sanitizedContent
                .replace(/\b(with|using|featuring)\b.*\b(logo|design|attached|uploaded|sticker|decal)\b.*/gi, '')
                .replace(/\b(place|put|add|attach|stick)\b.*\b(logo|design|attached|uploaded)\b.*/gi, '')
                .replace(/\b(attached|uploaded)\b.*$/gi, '')
                .replace(/\[\+?\d+\s*attachment.*\]/gi, '')
                .replace(/generate\s+(an?\s+)?image\s+(of\s+)?/i, '')
                .trim();
              
              const baseGenPrompt = `A photorealistic image of ${cleanPrompt || 'a product'}. No logos, no text, no graphics, no designs on the product. Clean and plain surfaces. Professional photography, good lighting. Front or 3/4 angle view.`;
              
              console.log('[Composite] Generating clean base:', baseGenPrompt.substring(0, 150));
              
              const genKieKey = process.env.KIE_API_KEY;
              let baseImageUrl = null;
              
              // Try Nano Banana first (via Kie.ai) — excellent for photorealistic subjects
              if (genKieKey) {
                try {
                  const genRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${genKieKey}` },
                    body: JSON.stringify({
                      model: 'google/nano-banana',
                      input: {
                        prompt: baseGenPrompt,
                        image_size: '1:1',
                        output_format: 'png',
                      }
                    }),
                  });
                  
                  const genTaskData = await genRes.json();
                  console.log('[Composite] Nano Banana task:', genTaskData.data?.taskId || 'unknown');
                  
                  if (genTaskData.code === 200 && genTaskData.data?.taskId) {
                    const taskId = genTaskData.data.taskId;
                    const startTime = Date.now();
                    while (Date.now() - startTime < 60000) {
                      await new Promise(r => setTimeout(r, 3000));
                      const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                        headers: { 'Authorization': `Bearer ${genKieKey}` }
                      });
                      const statusData = await statusRes.json();
                      if (statusData.code === 200 && statusData.data) {
                        if (statusData.data.state === 'success') {
                          const rj = JSON.parse(statusData.data.resultJson || '{}');
                          baseImageUrl = rj?.resultUrls?.[0] || rj?.images?.[0]?.url || rj?.url;
                          console.log('[Composite] Nano Banana success:', baseImageUrl?.substring(0, 80));
                          break;
                        } else if (statusData.data.state === 'fail') {
                          console.log('[Composite] Nano Banana failed');
                          break;
                        }
                      }
                    }
                  }
                } catch (genModelErr) {
                  console.log('[Composite] Nano Banana error:', genModelErr.message);
                }
              }
              
              // Fallback to DALL-E 3 if Flux failed
              if (!baseImageUrl) {
                console.log('[Composite] Trying DALL-E 3 fallback...');
                const genOpenaiKey = process.env.OPENAI_API_KEY;
                const genResponse = await fetch('https://api.openai.com/v1/images/generations', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${genOpenaiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'dall-e-3',
                    prompt: baseGenPrompt,
                    n: 1,
                    size: '1792x1024',
                    quality: 'hd',
                    style: 'natural',
                  }),
                });
                
                if (genResponse.ok) {
                  const genData = await genResponse.json();
                  baseImageUrl = genData.data?.[0]?.url;
                } else {
                  const err = await genResponse.json().catch(() => ({}));
                  console.log('[Composite] DALL-E 3 failed:', err.error?.message);
                }
              }
              
              if (!baseImageUrl) throw new Error('Failed to generate base product image with any model');
              
              // Download the generated base image
              const baseResp = await fetch(baseImageUrl);
              if (!baseResp.ok) throw new Error('Failed to download generated base image');
              baseBuffer = Buffer.from(await baseResp.arrayBuffer());
              
              const kieKey = process.env.KIE_API_KEY;
              if (kieKey) {
                try {
                  const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                    body: JSON.stringify({
                      base64Data: `data:image/png;base64,${baseBuffer.toString('base64')}`,
                      uploadPath: 'soulprint/generated',
                      fileName: `base_${Date.now()}.png`
                    }),
                  });
                  if (upRes.ok) {
                    const d = await upRes.json();
                    if (d.success && d.data?.downloadUrl) {
                      console.log('[Composite] Base image persisted to:', d.data.downloadUrl);
                    }
                  }
                } catch (e) { /* persistence is best-effort */ }
              }
              
              console.log('[Composite] Clean base generated, compositing logo...');
              send({ type: 'delta', content: '✅ Product image generated. Now placing your logo...\n\n' });
              
            } else if (hasTwoImageAttachments) {
              // Two attachments: first = base, second = logo/overlay
              const baseAttachment = imageAttachments[0];
              const overlayAttachment = imageAttachments[1];
              
              // Get base buffer - handles URLs, attachment://, data:, and raw base64
              let baseB64 = baseAttachment.base64 || baseAttachment.data;
              if (baseB64 && (baseB64.startsWith('http://') || baseB64.startsWith('https://'))) {
                const r = await fetch(baseB64);
                baseB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
              } else if (baseB64 && baseB64.startsWith('attachment://')) {
                const attId = baseB64.replace('attachment://', '');
                const attDoc = await db.collection('temp_attachments').findOne({ id: attId });
                if (attDoc) baseB64 = attDoc.base64;
              } else if (baseB64 && baseB64.startsWith('data:')) {
                const m = baseB64.match(/^data:([^;]+);base64,(.+)$/);
                if (m) baseB64 = m[2];
              }
              if (!baseB64 && baseAttachment.url) {
                const r = await fetch(baseAttachment.url);
                baseB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
              }
              baseBuffer = Buffer.from(baseB64, 'base64');
              
              // Get overlay buffer - handles URLs, attachment://, data:, and raw base64
              let ovB64 = overlayAttachment.base64 || overlayAttachment.data;
              overlayMime = overlayAttachment.type || 'image/png';
              if (ovB64 && (ovB64.startsWith('http://') || ovB64.startsWith('https://'))) {
                const r = await fetch(ovB64);
                ovB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                overlayMime = r.headers.get('content-type') || 'image/png';
              } else if (ovB64 && ovB64.startsWith('attachment://')) {
                const attId = ovB64.replace('attachment://', '');
                const attDoc = await db.collection('temp_attachments').findOne({ id: attId });
                if (attDoc) { ovB64 = attDoc.base64; overlayMime = attDoc.mimeType || 'image/png'; }
              } else if (ovB64 && ovB64.startsWith('data:')) {
                const m = ovB64.match(/^data:([^;]+);base64,(.+)$/);
                if (m) { overlayMime = m[1]; ovB64 = m[2]; }
              }
              if (!ovB64 && overlayAttachment.url) {
                const r = await fetch(overlayAttachment.url);
                ovB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                overlayMime = r.headers.get('content-type') || 'image/png';
              }
              overlayBuffer = Buffer.from(ovB64, 'base64');
            } else {
              // One attachment (overlay/logo) + conversation image (base)
              const overlayAttachment = imageAttachments[0];
              
              let ovB64 = overlayAttachment.base64 || overlayAttachment.data;
              overlayMime = overlayAttachment.type || 'image/png';
              if (ovB64 && (ovB64.startsWith('http://') || ovB64.startsWith('https://'))) {
                const r = await fetch(ovB64);
                ovB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                overlayMime = r.headers.get('content-type') || 'image/png';
              } else if (ovB64 && ovB64.startsWith('attachment://')) {
                const attId = ovB64.replace('attachment://', '');
                const attDoc = await db.collection('temp_attachments').findOne({ id: attId });
                if (attDoc) { ovB64 = attDoc.base64; overlayMime = attDoc.mimeType || 'image/png'; }
              } else if (ovB64 && ovB64.startsWith('data:')) {
                const m = ovB64.match(/^data:([^;]+);base64,(.+)$/);
                if (m) { overlayMime = m[1]; ovB64 = m[2]; }
              }
              if (!ovB64 && overlayAttachment.url) {
                const r = await fetch(overlayAttachment.url);
                ovB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                overlayMime = r.headers.get('content-type') || 'image/png';
              }
              overlayBuffer = Buffer.from(ovB64, 'base64');
              
              // Fetch base from conversation (handle expired URLs gracefully)
              const baseResp = await fetch(lastImageUrlInConversation);
              if (!baseResp.ok) {
                throw new Error(`Base image is no longer accessible (HTTP ${baseResp.status}). The original image URL may have expired. Please generate a new image first.`);
              }
              baseBuffer = Buffer.from(await baseResp.arrayBuffer());
              
              send({ type: 'delta', content: '🎨 Preparing to composite your design onto the image...\n\n' });
            }
            
            if (!baseBuffer || !overlayBuffer) {
              throw new Error('Could not load base and overlay images');
            }
            
            // ── Detect if this is a SWAP/REPLACE operation ──
            // Only swap on EXISTING images (not freshly generated ones which are already clean)
            const isSwapRequest = !isGenerateAndComposite && (
              /\b(swap|replace|change|switch)\b.*\b(logo|image|graphic|design|text|brand)\b/i.test(sanitizedContent) ||
              /\b(logo|image|graphic|design|text|brand)\b.*\b(swap|replace|change|switch|with)\b/i.test(sanitizedContent)
            );
            
            // Skip GPT-image-1 cleanup when Gemini is available — Gemini handles replacement natively
            const hasGemini = !!process.env.GEMINI_API_KEY;
            
            if (isSwapRequest && !hasGemini) {
              console.log('[Composite] Swap detected — cleaning base image of existing logos first (no Gemini)');
              send({ type: 'delta', content: '🧹 Removing existing logos from the image first...\n\n' });
              
              try {
                const swapOpenaiKey = process.env.OPENAI_API_KEY;
                if (!swapOpenaiKey) throw new Error('OpenAI API key required for logo removal');
                
                // Use GPT-image-1 to erase existing logos/text from the base image
                const OpenAI = (await import('openai')).default;
                const { toFile } = await import('openai/uploads');
                const openai = new OpenAI({ apiKey: swapOpenaiKey });
                
                const baseFile = await toFile(baseBuffer, 'base.png', { type: 'image/png' });
                
                const cleanResult = await openai.images.edit({
                  model: 'gpt-image-1',
                  image: baseFile,
                  prompt: `Remove ALL logos, text, graphics, designs, and branding from the clothing/products in this image. Make all surfaces clean and plain. Keep the rest of the scene EXACTLY the same — same people, same poses, same lighting, same background. Only erase printed designs and logos.`,
                  n: 1,
                  size: '1536x1024',
                  quality: 'high',
                });
                
                if (cleanResult.data?.[0]?.b64_json) {
                  baseBuffer = Buffer.from(cleanResult.data[0].b64_json, 'base64');
                  console.log('[Composite] Base image cleaned successfully');
                  send({ type: 'delta', content: '✅ Existing logos removed. Now placing your design...\n\n' });
                } else if (cleanResult.data?.[0]?.url) {
                  const cleanResp = await fetch(cleanResult.data[0].url);
                  baseBuffer = Buffer.from(await cleanResp.arrayBuffer());
                  console.log('[Composite] Base image cleaned (from URL)');
                }
              } catch (cleanErr) {
                console.log('[Composite] Logo removal failed:', cleanErr.message, '— proceeding with original base');
                // Continue with original base — the composite will just overlay on top
              }
            }
            
            // ── Call the Smart Composite function ──
            // Gemini handles the compositing natively when available (much better results)
            // Falls back to GPT-4o Vision analysis + Sharp programmatic compositing
            send({ type: 'generating_visual', visualType: 'composite' });
            send({ type: 'delta', content: '⏳ *Generating realistic mockup with AI — this takes 10-20 seconds...*\n\n' });
            
            // Send visible progress updates to keep user informed
            let compositeProgressCount = 0;
            const compositeProgressMessages = [
              '🔄 Analyzing image composition...',
              '🎨 Blending logo into the scene...',
              '✨ Matching lighting and texture...',
              '🖼️ Finalizing mockup...',
            ];
            const compositeProgressInterval = setInterval(() => {
              try { 
                const msg = compositeProgressMessages[compositeProgressCount % compositeProgressMessages.length];
                send({ type: 'delta', content: msg + '\n' }); 
                compositeProgressCount++;
              } catch(e) {}
            }, 4000);
            
            let compositeResult;
            try {
              compositeResult = await handleSmartComposite(
                baseBuffer, overlayBuffer, overlayMime, sanitizedContent
              );
            } finally {
              clearInterval(compositeProgressInterval);
              // Clear the progress dots by sending a newline
              try { send({ type: 'delta', content: '\n\n' }); } catch(e) {}
            }
            
            if (compositeResult.success && compositeResult.url) {
              const placementInfo = compositeResult.placement;
              const placementCount = Array.isArray(placementInfo) ? placementInfo.length : 1;
              const surfaceType = Array.isArray(placementInfo) ? (placementInfo[0]?.surface_type || 'auto') : (placementInfo?.surface_type || 'auto');
              const methodLabel = compositeResult.method === 'gemini-native-composite' ? 'AI-native blend' : 'pixel-perfect overlay';
              fullContent = `![Composited Image](${compositeResult.url})\n\n🎨 *Your design has been composited onto the image!*\n*${placementCount > 1 ? placementCount + ' placements' : 'Surface: ' + surfaceType} | Method: ${methodLabel}*`;
              send({ type: 'image', url: compositeResult.url, revised_prompt: sanitizedContent, contentType: 'composite' });
              send({ type: 'delta', content: fullContent });
            } else {
              throw new Error(compositeResult.error || 'Compositing failed');
            }
          } catch (compErr) {
            console.error('[Composite] Error:', compErr.message, compErr.stack);
            fullContent = `Sorry, compositing failed: ${compErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          
          // Save message
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          await dbMessages.insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'smart-composite', provider_used: 'gpt4o-vision+sharp', content_type: 'composite',
            image_url: fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined,
            est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
          });
          await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          clearInterval(keepaliveInterval);
          controllerClosed = true; controller.close();
          return;
        }
        
        // Broad edit detection - if there's a recent image AND user asks to modify something
        const editImagePatterns = [
          // Direct edit verbs
          /\b(add|put|place|insert|overlay|stick|apply|remove|delete|erase|crop|rotate)\b/i,
          // Swap/replace/change
          /\b(swap|replace|change|switch|modify|alter|update|edit|transform|convert|adjust)\b/i,
          // Make/turn + adjective (e.g., "make it red", "turn it into a cartoon")
          /\b(make|turn|have)\b.*\b(it|the|that|this|him|her|them)\b/i,
          // "Have the X do Y" (e.g., "have the otter hold a cupcake")
          /\b(have|make|let)\b.*\b(hold|wear|carry|sit|stand|fly|jump|run|dance|swim|eat|drink)\b/i,
          // Style changes
          /\b(more|less)\b.*\b(realistic|cartoon|artistic|vibrant|dark|light|bright|colorful)\b/i,
          // Background changes (including "remove the background", "replace background", etc.)
          /\b(change|different|new|another|remove|replace|delete|erase|transparent)\b.*\b(background|backdrop|bg|setting|scene|environment)\b/i,
          // "Remove the background" / "remove background" (explicit)
          /\b(remove|delete|erase|clear|transparent)\b.*\b(background|bg|backdrop)\b/i,
          // Color changes
          /\b(make|change|turn|paint)\b.*\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|gold|silver)\b/i,
          // Wearing/holding/doing
          /\b(wearing|holding|carrying|riding|sitting|standing|eating|drinking)\b/i,
          // Explicit edit request — require image-specific reference (not just "it")
          /\b(edit|modify|change|update|alter|tweak|fix|improve|enhance)\b.*\b(the|that|this|my)\s+(image|picture|photo|pic|graphic|logo|design|illustration|drawing|render|previous|last)\b/i,
          // ── STYLE TRANSFORMATION patterns (cartoon, anime, watercolor, etc.) ──
          // "create/make a [style] version" or "create a [style] of this"
          /\b(create|make|generate|do)\b.*\b(cartoon|anime|ghibli|comic|watercolor|oil\s*paint|pixel|sketch|pencil|charcoal|3d|pop\s*art|impressionist|abstract|vintage|retro|neon|cyberpunk|steampunk|gothic|minimalist|pastel|sticker|chibi|caricature|clay|lego|voxel|low.?poly|origami|woodcut|line.?art)\b.*\b(version|style|look|rendition|interpretation|of|from)\b/i,
          // "[style] version of this/that/it" 
          /\b(cartoon|anime|ghibli|comic|watercolor|oil\s*paint|pixel|sketch|pencil|3d|pop\s*art|retro|neon|cyberpunk|steampunk|minimalist|pastel|sticker|chibi|caricature|clay|lego)\b.*\b(version|rendition|style|interpretation)\b/i,
          // "take [this/that/the image] and [create/make/turn/convert/transform]"
          /\btake\b.*\b(this|that|the|it|my)\b.*\b(image|picture|photo|pic)?\b.*\b(and|to)\b.*\b(create|make|turn|convert|transform|generate|do|render)\b/i,
          // "cartoonize/stylize/anime-ify" etc.
          /\b(cartoon|anime|comic|sketch|pixel|watercolor|styliz|posteriz|oil.?paint)\w*\b.*\b(this|that|it|the|image|picture|photo)\b/i,
          // "turn/convert into [style]" (broader than make/turn + it)
          /\b(turn|convert|transform|render)\b.*\b(into|to|as)\b.*\b(cartoon|anime|ghibli|comic|watercolor|oil\s*paint|pixel|sketch|3d|pop\s*art|retro|neon|cyberpunk|minimalist|pastel|sticker|chibi|caricature|clay)\b/i,
          // "I want/need a [style] version"
          /\b(?:i\s+)?(?:want|need|would\s+like)\b.*\b(cartoon|anime|ghibli|comic|watercolor|sketch|3d|pixel|retro|neon|minimalist|sticker|chibi|caricature)\b.*\b(version|style|look|of)\b/i,
          // "you can create/make/do this yourself" (user telling the AI to generate, not suggest)
          /\byou\s+can\b.*\b(create|make|do|generate|draw|render)\b.*\b(this|that|it)\b.*\b(yourself|your\s*self)\b/i,
        ];
        
        // ── QUESTION DETECTION ──────────────────────────────────────────────
        // If the user is asking a question, do NOT treat it as an image edit request.
        // This prevents "why is Alex doing X?" from triggering image edits.
        const trimmedContent = sanitizedContent.trim();
        const isLikelyQuestion = (
          // Starts with a question word
          /^(?:why|what|how|when|where|who|which|is|are|do|does|did|can|could|would|should|will|shall|have|has|had|was|were|isn't|aren't|don't|doesn't|didn't|wasn't|weren't|won't|wouldn't|couldn't|shouldn't|tell me|explain|describe|clarify|elaborate)\b/i.test(trimmedContent) ||
          // Ends with question mark
          trimmedContent.endsWith('?') ||
          // Explicitly says "question" or "asking"
          /\b(?:question|i'?m asking|not an edit|not asking for (?:an )?edit|just asking|i have a question|asking a question|that is not an edit|that's not an edit)\b/i.test(trimmedContent) ||
          // "In this [concept/video/idea], why/what/how..." pattern
          /\bin this\b.*\b(?:why|what|how|who)\b/i.test(trimmedContent) ||
          // "Why is/are/does [subject] [verb]ing" — clearly a question even without "?"
          /^why\s+(?:is|are|does|do|did|was|were|would|should|can|could)\b/i.test(trimmedContent)
        );
        
        // ── ANTI-EDIT DETECTION ────────────────────────────────────────────────
        // Detect when user is COMPLAINING about unwanted image generation/editing.
        // These must override edit patterns like "fix it" or "stop changing".
        const isRefusingImageEdit = (
          // "stop making/generating/creating/editing images"
          /\bstop\b.*\b(making|generating|creating|editing|changing|modifying|producing|doing)\b/i.test(trimmedContent) ||
          // "don't/do not edit/change/modify/make" 
          /\b(?:don'?t|do\s+not|please\s+don'?t|stop)\b.*\b(edit|change|modify|alter|make|generate|create)\b/i.test(trimmedContent) ||
          // "no more images/edits/changes"
          /\bno\s+more\b.*\b(image|picture|photo|edit|change|generation|modification)\b/i.test(trimmedContent) ||
          // "i did not ask for" / "i didn't ask"
          /\bi\s+(?:did\s*n[o']?t|didn'?t|never)\s+(?:ask|request|want)\b/i.test(trimmedContent) ||
          // "unwanted" / "without my permission" / "without asking"
          /\b(unwanted|unasked|unsolicited|without\s+(?:my\s+)?(?:permission|asking|request))\b/i.test(trimmedContent) ||
          // "stop apologizing" / "just fix the problem/issue/bug" (not "fix the image")
          /\b(stop\s+apologiz|fix\s+(?:the\s+)?(?:problem|issue|bug|behavior|behaviour|error))\b/i.test(trimmedContent) ||
          // "fix it" / "stop it" / "cut it out" without any image-specific reference
          (/\b(fix|stop|cut)\s+it\b/i.test(trimmedContent) && !/\b(image|picture|photo|pic|graphic|logo|design|illustration|drawing|render)\b/i.test(trimmedContent)) ||
          // "that's not what I asked" / "that's not what I wanted"
          /\bthat'?s?\s+not\s+what\s+i\b/i.test(trimmedContent) ||
          // "you keep" + generating/editing (frustration pattern)
          /\byou\s+keep\b.*\b(generat|edit|chang|mak|creat|modif)\w*/i.test(trimmedContent)
        );
        
        if (isRefusingImageEdit) {
          console.log('[Image Edit] BLOCKED — user is refusing/complaining about image edits:', trimmedContent.substring(0, 120));
        }
        
        // ── SMART ASPECT RATIO RECREATION ────────────────────────────────────
        // Detect when user wants to change the aspect ratio of an existing image.
        // Instead of cropping/shrinking, we RECREATE the image at the new ratio
        // by analyzing the original with Vision AI and generating a brand-new image.
        const aspectRatioRecreationPatterns = [
          // "recreate this as 1:1" / "recreate in 16:9" / "recreate as portrait"
          /\b(recreate|re-create|regenerate|re-generate|redo|remake)\b.*\b(\d+\s*[:x×]\s*\d+|portrait|landscape|square|vertical|horizontal|widescreen|cinematic)\b/i,
          // "make this 1:1" / "make this square" / "make it portrait" / "make it 16:9"
          /\b(make|convert|turn|switch)\b\s+(?:this|it|that|the\s+(?:image|picture|photo))\s+(?:a\s+)?(?:into\s+(?:a\s+)?)?(\d+\s*[:x×]\s*\d+|portrait|landscape|square|vertical|horizontal|widescreen|cinematic)\b/i,
          // "change the aspect ratio to 1:1" / "change ratio to landscape"
          /\b(change|switch|convert|modify|update)\b.*\b(aspect\s*ratio|ratio|dimensions?|format|orientation)\b.*\b(to|into)\s+(?:a\s+)?(\d+\s*[:x×]\s*\d+|portrait|landscape|square|vertical|horizontal|widescreen|cinematic)\b/i,
          // "1:1 version" / "portrait version" / "square version" / "landscape format"
          /\b(\d+\s*[:x×]\s*\d+|portrait|landscape|square|vertical|horizontal)\s+(version|format|orientation|recreation|remake)\b/i,
          // "I want/need this in 1:1" / "I need this as portrait"
          /\b(?:i\s+)?(?:want|need|would like)\b.*\b(?:this|it|the\s+(?:image|picture|photo))\b.*\b(?:in|as|to\s+be|to\s+fit)\s+(?:a\s+)?(\d+\s*[:x×]\s*\d+|portrait|landscape|square|vertical|horizontal|widescreen)\b/i,
          // "fit this to 1:1" / "adapt this to landscape" / "resize this to 9:16"  
          /\b(fit|adapt|resize|reformat|adjust)\b\s+(?:this|it|that|the\s+(?:image|picture|photo))\s+(?:to|for|into)\s+(?:a\s+)?(\d+\s*[:x×]\s*\d+|portrait|landscape|square|vertical|horizontal|widescreen)\b/i,
          // "can you make a square version" / "give me a portrait version"
          /\b(?:can\s+you\s+)?(?:make|create|give\s+me|generate)\s+(?:a|an)\s+(\d+\s*[:x×]\s*\d+|portrait|landscape|square|vertical|horizontal|widescreen|cinematic)\s+(?:version|format|copy|variant)\b/i,
          // "change this to portrait" / "convert to 16:9" (short, direct)
          /\b(change|convert|switch)\s+(?:this|it|that)\s+to\s+(\d+\s*[:x×]\s*\d+|portrait|landscape|square|vertical|horizontal|widescreen|cinematic)\b/i,
        ];
        
        const isAspectRatioRecreation = !isLikelyQuestion && !isRefusingImageEdit && !mediaIntent && lastImageUrlInConversation &&
          aspectRatioRecreationPatterns.some(p => p.test(sanitizedContent));
        
        if (isAspectRatioRecreation) {
          console.log('[SmartRecreate] Detected aspect ratio recreation request for:', lastImageUrlInConversation.substring(0, 80));
          console.log('[SmartRecreate] User instruction:', sanitizedContent.substring(0, 150));
          
          // Extract the target aspect ratio from the user's message
          const targetAspectRatio = detectAspectRatioFromPrompt(sanitizedContent) || '1:1';
          console.log(`[SmartRecreate] Target aspect ratio: ${targetAspectRatio}`);
          
          send({ type: 'generating_visual', visualType: 'image' });
          send({ type: 'delta', content: `🔄 Recreating your image in ${targetAspectRatio} format...\n\n` });
          
          try {
            const openaiApiKey = process.env.OPENAI_API_KEY;
            const kieKey = process.env.KIE_API_KEY;
            
            if (!openaiApiKey) {
              throw new Error('OpenAI API key not configured — required for smart recreation');
            }
            
            // Step 1: Fetch the original image
            console.log('[SmartRecreate] Step 1: Fetching original image...');
            const origResp = await fetch(lastImageUrlInConversation, { signal: AbortSignal.timeout(20000) });
            if (!origResp.ok) throw new Error('Failed to fetch original image');
            const origBuffer = Buffer.from(await origResp.arrayBuffer());
            console.log(`[SmartRecreate] Original image fetched: ${origBuffer.length} bytes`);
            
            send({ type: 'delta', content: '🔍 Analyzing original image...\n' });
            
            // Step 2: Use GPT-4o Vision to analyze/describe the image
            console.log('[SmartRecreate] Step 2: Analyzing image with GPT-4o Vision...');
            const origBase64 = origBuffer.toString('base64');
            const origMimeType = origResp.headers.get('content-type') || 'image/png';
            
            const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'system',
                    content: `You are an expert image analyst. Describe this image in extraordinary detail so it can be precisely recreated by an AI image generator at a different aspect ratio (${targetAspectRatio}).

First, classify the image type:
- TYPE A: Contains text, structured layout, branding, typography, or graphic design (ads, flyers, posters, infographics, social media posts, UI mockups)
- TYPE B: Simple photograph or illustration without significant text/layout (landscapes, portraits, product photos, artwork)

Then describe:
- The complete subject matter, objects, people, and their positions
- Color palette, lighting, mood, atmosphere
- Art style, rendering technique (photo-realistic, illustration, etc.)
- Background elements and environment
- Textures, materials, and fine details
- ALL text visible in the image (exact wording, fonts, sizes, colors)
- Branding elements (logos, taglines, brand colors)
- Typography style and visual hierarchy
- Overall composition and framing

At the END of your description, include a line: "IMAGE_TYPE: A" or "IMAGE_TYPE: B"

Be extremely detailed and specific. Always preserve: text, branding, colors, typography, and visual hierarchy.`
                  },
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: `Describe this image in comprehensive detail for recreation at ${targetAspectRatio} aspect ratio.` },
                      { type: 'image_url', image_url: { url: `data:${origMimeType};base64,${origBase64}`, detail: 'high' } }
                    ]
                  }
                ],
                max_tokens: 1500,
                temperature: 0.3,
              }),
            });
            
            if (!visionRes.ok) {
              const errText = await visionRes.text();
              throw new Error(`Vision analysis failed: ${visionRes.status} - ${errText.substring(0, 200)}`);
            }
            
            const visionData = await visionRes.json();
            const imageDescription = visionData.choices?.[0]?.message?.content;
            
            if (!imageDescription) {
              throw new Error('Vision AI returned empty description');
            }
            
            console.log(`[SmartRecreate] Vision description (${imageDescription.length} chars):`, imageDescription.substring(0, 200));
            send({ type: 'delta', content: '🎨 Recreating image at new aspect ratio...\n' });
            
            // Step 3: Generate a new image using gpt-image-1 with the original as reference
            let newImageUrl = null;
            
            // Map aspect ratio to gpt-image-1 sizes
            const gptImage1SizeMap = {
              '1:1': '1024x1024',
              '16:9': '1536x1024',
              '9:16': '1024x1536',
              '4:3': '1536x1024',
              '3:4': '1024x1536',
            };
            const targetSize = gptImage1SizeMap[targetAspectRatio] || '1024x1024';
            
            // PRIMARY: Use gpt-image-1 with the original image as reference
            try {
              console.log(`[SmartRecreate] Step 3a: Generating with gpt-image-1 (size: ${targetSize}), using original as reference...`);
              const OpenAI = (await import('openai')).default;
              const { toFile } = await import('openai/uploads');
              const openai = new OpenAI({ apiKey: openaiApiKey });
              
              const refFile = await toFile(origBuffer, 'reference.png', { type: origMimeType });
              
              const editResult = await openai.images.edit({
                model: 'gpt-image-1',
                image: refFile,
                prompt: `Convert this image to ${targetAspectRatio} aspect ratio using these rules:

If the image contains text, structured layout, branding, or graphic design:
→ RECREATE the design from scratch for ${targetAspectRatio}
→ Do NOT resize or crop
→ Recompose the layout entirely for the new aspect ratio

If the image is a simple photo without significant text/layout:
→ Resize and recompose to fill the ${targetAspectRatio} frame naturally

ALWAYS preserve: all text (exact wording), branding, colors, typography, and visual hierarchy.

Detailed description of the original: ${imageDescription}`,
                n: 1,
                size: targetSize,
                quality: 'high',
              });
              
              if (editResult.data?.[0]) {
                if (editResult.data[0].b64_json) {
                  // Upload base64 to persistent storage via Kie.ai
                  if (kieKey) {
                    const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                      body: JSON.stringify({
                        base64Data: `data:image/png;base64,${editResult.data[0].b64_json}`,
                        uploadPath: 'soulprint/recreated',
                        fileName: `recreate_${targetAspectRatio.replace(':', 'x')}_${Date.now()}.png`
                      }),
                    });
                    const upData = await upRes.json();
                    if (upData.success && upData.data?.downloadUrl) {
                      newImageUrl = upData.data.downloadUrl;
                    }
                  }
                  if (!newImageUrl) {
                    newImageUrl = `data:image/png;base64,${editResult.data[0].b64_json}`;
                  }
                } else if (editResult.data[0].url) {
                  // OpenAI URLs are TEMPORARY — download and persist to permanent storage
                  const tempUrl = editResult.data[0].url;
                  console.log('[SmartRecreate] Got temporary OpenAI URL, persisting to permanent storage...');
                  
                  if (kieKey) {
                    try {
                      const dlResp = await fetch(tempUrl, { signal: AbortSignal.timeout(30000) });
                      if (dlResp.ok) {
                        const dlBuffer = Buffer.from(await dlResp.arrayBuffer());
                        const dlBase64 = dlBuffer.toString('base64');
                        const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                          body: JSON.stringify({
                            base64Data: `data:image/png;base64,${dlBase64}`,
                            uploadPath: 'soulprint/recreated',
                            fileName: `recreate_${targetAspectRatio.replace(':', 'x')}_${Date.now()}.png`
                          }),
                        });
                        const upData = await upRes.json();
                        if (upData.success && upData.data?.downloadUrl) {
                          newImageUrl = upData.data.downloadUrl;
                          console.log('[SmartRecreate] Persisted to permanent URL:', newImageUrl.substring(0, 80));
                        }
                      }
                    } catch (persistErr) {
                      console.log('[SmartRecreate] Failed to persist URL:', persistErr.message);
                    }
                  }
                  
                  // Last resort: use the temporary URL (will expire)
                  if (!newImageUrl) {
                    console.log('[SmartRecreate] WARNING: Using temporary OpenAI URL — will expire!');
                    newImageUrl = tempUrl;
                  }
                }
              }
              
              if (newImageUrl) {
                console.log(`[SmartRecreate] gpt-image-1 recreation success!`);
              }
            } catch (gptErr) {
              console.log('[SmartRecreate] gpt-image-1 recreation failed:', gptErr.message, '- trying fallback...');
            }
            
            // FALLBACK: Use Kie.ai Nano Banana with the vision description as prompt
            if (!newImageUrl && kieKey) {
              try {
                console.log('[SmartRecreate] Step 3b: Falling back to Kie.ai Nano Banana with vision description...');
                const nanoModel = KIE_IMAGE_MODELS['nano-banana'];
                if (nanoModel) {
                  const inputParams = nanoModel.formatInput
                    ? nanoModel.formatInput(`Convert the following image to ${targetAspectRatio} aspect ratio. If it contains text, branding, or structured layout, RECREATE the design from scratch for the new ratio. If it's a simple photo, resize naturally. Always preserve: text, branding, colors, typography, visual hierarchy. Original image description: ${imageDescription}`, targetAspectRatio)
                    : { prompt: imageDescription, image_size: targetAspectRatio || '1:1' };
                  
                  const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                    body: JSON.stringify({ model: nanoModel.model, input: inputParams }),
                  });
                  const createData = await createRes.json();
                  
                  if (createData.code === 200 && createData.data?.taskId) {
                    const taskId = createData.data.taskId;
                    const startTime = Date.now();
                    while (Date.now() - startTime < 90000) {
                      await new Promise(r => setTimeout(r, 3000));
                      const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                        headers: { 'Authorization': `Bearer ${kieKey}` },
                      });
                      const statusData = await statusRes.json();
                      if (statusData.code === 200) {
                        if (statusData.data?.state === 'success') {
                          try {
                            const resultJson = JSON.parse(statusData.data?.resultJson || '{}');
                            newImageUrl = resultJson?.resultUrls?.[0] || resultJson?.url || resultJson?.image_url || resultJson?.images?.[0];
                          } catch (e) { /* ignore */ }
                          break;
                        } else if (statusData.data?.state === 'fail') break;
                      }
                    }
                  }
                }
              } catch (kieErr) {
                console.log('[SmartRecreate] Kie.ai fallback failed:', kieErr.message);
              }
            }
            
            // FALLBACK 2: DALL-E 3 with vision description
            if (!newImageUrl && openaiApiKey) {
              try {
                console.log('[SmartRecreate] Step 3c: Falling back to DALL-E 3...');
                const openaiSizeMap = { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792', '4:3': '1792x1024', '3:4': '1024x1792' };
                const dalleSize = openaiSizeMap[targetAspectRatio] || '1024x1024';
                
                const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
                  body: JSON.stringify({
                    model: 'dall-e-3',
                    prompt: `Convert the following image to ${targetAspectRatio} aspect ratio. If it contains text, branding, or structured layout, RECREATE the design from scratch for the new ratio — do NOT resize or crop. If it's a simple photo, resize naturally. Always preserve: text, branding, colors, typography, visual hierarchy. Original: ${imageDescription}`,
                    n: 1,
                    size: dalleSize,
                    quality: 'hd',
                    style: 'natural',
                  }),
                });
                const imgData = await imgRes.json();
                if (imgData.data?.[0]?.url) {
                  newImageUrl = imgData.data[0].url;
                  console.log('[SmartRecreate] DALL-E 3 recreation success!');
                }
              } catch (dalleErr) {
                console.log('[SmartRecreate] DALL-E 3 fallback failed:', dalleErr.message);
              }
            }
            
            if (newImageUrl) {
              // Persist temporary URLs to permanent storage
              const needsPersistence = 
                newImageUrl.includes('oaidalleapiprodscus') || 
                newImageUrl.includes('openai.com') || 
                newImageUrl.includes('blob.core.windows.net') ||
                newImageUrl.includes('tempfile.aiquickdraw.com');
              
              if (needsPersistence && kieKey) {
                try {
                  console.log('[SmartRecreate] Persisting temporary URL to permanent storage...');
                  const dlResp = await fetch(newImageUrl, { signal: AbortSignal.timeout(30000) });
                  if (dlResp.ok) {
                    const dlBuffer = Buffer.from(await dlResp.arrayBuffer());
                    const dlBase64 = dlBuffer.toString('base64');
                    const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                      body: JSON.stringify({
                        base64Data: `data:image/png;base64,${dlBase64}`,
                        uploadPath: 'soulprint/recreated',
                        fileName: `recreate_${targetAspectRatio.replace(':', 'x')}_${Date.now()}.png`
                      }),
                    });
                    const upData = await upRes.json();
                    if (upData.success && upData.data?.downloadUrl) {
                      newImageUrl = upData.data.downloadUrl;
                      console.log('[SmartRecreate] Persisted to permanent URL:', newImageUrl.substring(0, 80));
                    }
                  }
                } catch (persistErr) {
                  console.log('[SmartRecreate] Persistence failed:', persistErr.message, '— using original URL');
                }
              }
              
              fullContent = `![Recreated Image](${newImageUrl})\n\n🔄 *Image recreated in ${targetAspectRatio} format using Smart Recreation!*`;
              send({ type: 'image', url: newImageUrl, revised_prompt: sanitizedContent, contentType: 'recreate' });
              send({ type: 'delta', content: fullContent });
            } else {
              fullContent = `Sorry, I couldn't recreate the image in ${targetAspectRatio} format. Please try again.`;
              send({ type: 'delta', content: fullContent });
            }
          } catch (recreateErr) {
            console.error('[SmartRecreate] Exception:', recreateErr.message);
            fullContent = `Sorry, smart recreation failed: ${recreateErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          
          // Save the message
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          await dbMessages.insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'smart-recreate', provider_used: 'gpt4o-vision+gpt-image-1', content_type: 'image',
            image_url: fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined,
            est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
          });
          await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          clearInterval(keepaliveInterval);
          controllerClosed = true; controller.close();
          return;
        }
        
        // ── Detect video extend intent early (needed by isEditRequest guard) ────
        const isVideoExtendRequest = detectVideoExtendIntent(sanitizedContent, hasVideoAttachment);
        
        const isEditRequest = !isLikelyQuestion && !isRefusingImageEdit && !mediaIntent && !isAspectRatioRecreation && !isVideoExtendRequest && lastImageUrlInConversation && editImagePatterns.some(p => p.test(sanitizedContent));
        
        // Also detect if user is explicitly asking to edit without patterns (AI-assisted detection)
        // CONSERVATIVE: Requires stronger edit signals than just containing "the" or "it"
        const couldBeEditRequest = !isLikelyQuestion && !isRefusingImageEdit && lastImageUrlInConversation && !mediaIntent && !isAspectRatioRecreation &&
          sanitizedContent.length < 120 && // Very short messages only (reduced from 200)
          !/\b(generate|create|new image|new picture|new photo|from scratch)\b/i.test(sanitizedContent) && // Not asking for new image
          // Require reference to the image itself, not just any pronoun
          /\b(image|picture|photo|the (?:image|picture|photo|logo|design|graphic))\b/i.test(sanitizedContent) &&
          // Must also contain an action verb suggesting modification
          /\b(make|change|add|remove|edit|modify|adjust|crop|fix|update|redo|undo)\b/i.test(sanitizedContent);
        
        if (isLikelyQuestion) {
          console.log('[Image Edit] Skipping — message is a question, not an edit request:', trimmedContent.substring(0, 100));
        }
        
        if ((isEditRequest || couldBeEditRequest) && attachments.length === 0) {
          console.log('[Image Edit] Detected edit request for existing image:', lastImageUrlInConversation.substring(0, 80));
          console.log('[Image Edit] Edit instruction:', sanitizedContent.substring(0, 100));
          console.log('[Image Edit] Detection method:', isEditRequest ? 'pattern match' : 'contextual (short msg + recent image)');
          
          // Send visual generation event to frontend
          send({ type: 'generating_visual', visualType: 'edit' });
          send({ type: 'delta', content: '✏️ Editing your image...\n\n' });
          
          try {
            const editResult = await handleImageEditInternal(
              user.id,
              { url: lastImageUrlInConversation },
              sanitizedContent,
              (progress) => {
                send({ type: 'delta', content: '' }); // keepalive
              }
            );
            
            if (editResult.success && editResult.url) {
              console.log(`[Image Edit] Success with ${editResult.method}! URL:`, editResult.url.substring(0, 80));
              
              fullContent = `![Edited Image](${editResult.url})\n\n✏️ *Image edited using ${editResult.method}!*`;
              send({ type: 'image', url: editResult.url, revised_prompt: sanitizedContent, contentType: 'edit' });
              send({ type: 'delta', content: fullContent });
            } else {
              console.error('[Image Edit] Failed:', editResult.error);
              fullContent = `Sorry, I couldn't edit the image: ${editResult.error}`;
              send({ type: 'delta', content: fullContent });
            }
          } catch (editErr) {
            console.error('[Image Edit] Exception:', editErr.message);
            fullContent = `Sorry, image editing failed: ${editErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          
          // Save message with image_url for future edit detection
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          await dbMessages.insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'image-edit', provider_used: 'multi', content_type: 'image-edit',
            image_url: fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined,
            est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
          });
          await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          clearInterval(keepaliveInterval);
          controllerClosed = true; controller.close();
          return;
        }

        // ── EDIT REQUEST WITH ATTACHED IMAGE ──────────────────────────────
        // When user uploads an image AND sends an edit instruction like
        // "remove the background", "make it black and white", etc.
        // Auto-route to image edit pipeline instead of relying on LLM tool call.
        const hasImageAttachmentForEdit = attachments.some(a =>
          a.type === 'image' || a.type?.startsWith('image/') ||
          a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/')
        );
        const isAttachmentEditRequest = !isLikelyQuestion && !isRefusingImageEdit && hasImageAttachmentForEdit && !mediaIntent &&
          editImagePatterns.some(p => p.test(sanitizedContent));

        if (isAttachmentEditRequest) {
          console.log('[Image Edit+Attachment] User attached an image with edit instruction:', sanitizedContent.substring(0, 100));

          send({ type: 'generating_visual', visualType: 'edit' });
          send({ type: 'delta', content: '✏️ Editing your image...\n\n' });

          // Resolve the attached image
          let imagePayload = {};
          const imgAtt = attachments.find(a =>
            a.type === 'image' || a.type?.startsWith('image/') ||
            a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/')
          );
          if (imgAtt) {
            const b64 = imgAtt.base64;
            if (b64 && (b64.startsWith('http://') || b64.startsWith('https://'))) {
              imagePayload = { url: b64 };
            } else if (imgAtt.url) {
              imagePayload = { url: imgAtt.url };
            } else if (b64 && b64.startsWith('attachment://')) {
              try {
                const attId = b64.replace('attachment://', '');
                const attDoc = await db.collection('temp_attachments').findOne({ id: attId });
                if (attDoc) {
                  imagePayload = { base64: attDoc.base64, mimeType: attDoc.mimeType || 'image/jpeg' };
                }
              } catch (e) { console.error('[Image Edit+Attachment] Resolve failed:', e.message); }
            } else if (b64) {
              imagePayload = { base64: b64, mimeType: imgAtt.mimeType || imgAtt.mime_type || 'image/png' };
            }
          }

          if (imagePayload.url || imagePayload.base64) {
            try {
              const editResult = await handleImageEditInternal(
                user.id,
                imagePayload,
                sanitizedContent,
                (progress) => { send({ type: 'delta', content: '' }); }
              );

              if (editResult.success && editResult.url) {
                console.log(`[Image Edit+Attachment] Success with ${editResult.method}!`);
                fullContent = `![Edited Image](${editResult.url})\n\n✏️ *Image edited using ${editResult.method}!*`;
                send({ type: 'image', url: editResult.url, revised_prompt: sanitizedContent, contentType: 'edit' });
                send({ type: 'delta', content: fullContent });
              } else {
                console.error('[Image Edit+Attachment] Failed:', editResult.error);
                fullContent = `Sorry, I couldn't edit the image: ${editResult.error}`;
                send({ type: 'delta', content: fullContent });
              }
            } catch (editErr) {
              console.error('[Image Edit+Attachment] Exception:', editErr.message);
              fullContent = `Sorry, image editing failed: ${editErr.message}`;
              send({ type: 'delta', content: fullContent });
            }

            const inputText2 = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
            await dbMessages.insertOne({
              id: assistantMsgId, conversation_id: convId, user_id: user.id,
              role: 'assistant', content: fullContent, created_at: new Date(),
              model_used: 'image-edit', provider_used: 'multi', content_type: 'image-edit',
              image_url: fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined,
              est_input_tokens: Math.round(inputText2.length / 4), est_output_tokens: 0,
            });
            await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }
        }

        // ══════════════════════════════════════════════════════════════════
        // ── MEDIA CONFIRMATION FLOW ──────────────────────────────────────
        // When media intent is detected, prompt user for confirmation
        // unless they sent a mediaFlow payload (already confirmed) or
        // the user has quick-generate enabled.
        // ══════════════════════════════════════════════════════════════════
        
        // Load quick-generate preference ONCE — used by both confirmation flow and auto-gen guards
        const userPrefs = await db.collection('user_settings').findOne({ user_id: user.id });
        const quickGenerate = userPrefs?.quick_generate === true;
        
        if (mediaIntent && !mediaFlow) {
          
          // If this is a video extend request, skip the normal media confirmation flow
          // — the video extend handler below will handle it
          if (isVideoExtendRequest) {
            console.log(`[MediaConfirm] Skipping normal ${mediaIntent} confirmation — detected as video extend request`);
            mediaIntent = null;
          }
          
          // If this is a video EDIT request (user wants to modify an existing video),
          // auto-execute: extract a frame from the video → generate new video with edit instructions
          // Skip the confirmation card — the user's intent is clear and they shouldn't have to confirm
          if (isVideoEditRequest && mediaIntent === 'video') {
            // Check if we have a video to work with (attachment or conversation history)
            const hasVideoAttachmentForEdit = attachments.some(a => 
              a.mimeType?.startsWith('video/') || a.mime_type?.startsWith('video/') || 
              a.type === 'video' || a.name?.match(/\.(mp4|mov|avi|webm|mkv|m4v)$/i)
            );
            const hasVideoContextForEdit = hasVideoAttachmentForEdit || lastVideoUrlInConversation || lastVideoTaskIdInConversation;
            
            if (hasVideoContextForEdit) {
              console.log(`[VideoEdit] Detected video edit request with video context — auto-executing (skip confirmation)`);
              console.log(`[VideoEdit] Has attachment: ${hasVideoAttachmentForEdit}, Has conversation video: ${!!lastVideoUrlInConversation || !!lastVideoTaskIdInConversation}`);
              
              // Send immediate progress feedback — this is the "animation showing user it's working"
              send({ type: 'generating_visual', visualType: 'video' });
              send({ type: 'delta', content: '🎬 **Working on your video edit...** Extracting a key frame and regenerating with your changes.\n\n' });
              
              const kieKey = process.env.KIE_API_KEY;
              if (!kieKey) {
                send({ type: 'delta', content: '❌ Video generation API is not configured. Please contact support.' });
                send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                clearInterval(keepaliveInterval);
                controllerClosed = true; controller.close();
                return;
              }
              
              try {
                let seedImageUrl = null;
                
                // Step 1: Get a frame from the video
                // If user attached a video, extract from that
                if (hasVideoAttachmentForEdit) {
                  const videoAtt = attachments.find(a => 
                    a.mimeType?.startsWith('video/') || a.mime_type?.startsWith('video/') || 
                    a.type === 'video' || a.name?.match(/\.(mp4|mov|avi|webm|mkv|m4v)$/i)
                  );
                  
                  let videoSourceForFrame = null;
                  if (videoAtt?.isUrlReference && videoAtt?.base64?.startsWith('http')) {
                    videoSourceForFrame = videoAtt.base64;
                  } else if (videoAtt?.url) {
                    videoSourceForFrame = videoAtt.url;
                  } else if (videoAtt?.base64 && videoAtt.base64.startsWith('http')) {
                    videoSourceForFrame = videoAtt.base64;
                  } else if (videoAtt?.base64) {
                    // base64-encoded video — write to temp file for ffmpeg
                    const { writeFileSync, unlinkSync } = require('fs');
                    const path = require('path');
                    const tmpVideoPath = path.join('/tmp', `video_edit_${Date.now()}.mp4`);
                    const base64Data = videoAtt.base64.replace(/^data:video\/[^;]+;base64,/, '');
                    writeFileSync(tmpVideoPath, Buffer.from(base64Data, 'base64'));
                    videoSourceForFrame = tmpVideoPath;
                  }
                  
                  if (videoSourceForFrame) {
                    send({ type: 'delta', content: '📸 Extracting frame from your video...\n' });
                    try {
                      await ensureFfmpeg();
                      const { execSync } = require('child_process');
                      const path = require('path');
                      const { readFileSync, unlinkSync: unlinkFile } = require('fs');
                      
                      const tmpFramePath = path.join('/tmp', `frame_edit_${Date.now()}.jpg`);
                      const isLocalFile = !videoSourceForFrame.startsWith('http');
                      
                      if (isLocalFile) {
                        // Local file — extract directly
                        execSync(`ffmpeg -y -sseof -1 -i "${videoSourceForFrame}" -frames:v 1 -q:v 2 "${tmpFramePath}"`, { timeout: 30000 });
                      } else {
                        // Remote URL — download first
                        const tmpDlPath = path.join('/tmp', `dl_edit_${Date.now()}.mp4`);
                        execSync(`curl -sL -o "${tmpDlPath}" "${videoSourceForFrame}"`, { timeout: 60000 });
                        execSync(`ffmpeg -y -sseof -1 -i "${tmpDlPath}" -frames:v 1 -q:v 2 "${tmpFramePath}"`, { timeout: 30000 });
                        try { unlinkFile(tmpDlPath); } catch {}
                      }
                      
                      // Upload frame to CDN
                      const frameBuffer = readFileSync(tmpFramePath);
                      const frameBase64 = frameBuffer.toString('base64');
                      const dataUrl = `data:image/jpeg;base64,${frameBase64}`;
                      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                        body: JSON.stringify({
                          base64Data: dataUrl,
                          uploadPath: 'soulprint/video-edit-frames',
                          fileName: `frame_edit_${Date.now()}.jpg`,
                        }),
                      });
                      if (upRes.ok) {
                        const uploadData = await upRes.json();
                        if (uploadData.success && uploadData.data?.downloadUrl) {
                          seedImageUrl = uploadData.data.downloadUrl;
                        }
                      }
                      console.log(`[VideoEdit] Extracted and uploaded frame: ${seedImageUrl?.substring(0, 80)}`);
                      try { unlinkFile(tmpFramePath); } catch {}
                      if (isLocalFile) { try { unlinkFile(videoSourceForFrame); } catch {} }
                    } catch (ffErr) {
                      console.error('[VideoEdit] Frame extraction failed:', ffErr.message);
                    }
                  }
                }
                
                // If no attachment frame, try to get frame from conversation's last video
                if (!seedImageUrl && lastVideoUrlInConversation) {
                  send({ type: 'delta', content: '📸 Extracting frame from your recent video...\n' });
                  try {
                    await ensureFfmpeg();
                    const { execSync } = require('child_process');
                    const path = require('path');
                    const { readFileSync, unlinkSync: unlinkFile } = require('fs');
                    
                    const tmpDlPath = path.join('/tmp', `dl_edit_conv_${Date.now()}.mp4`);
                    const tmpFramePath = path.join('/tmp', `frame_edit_conv_${Date.now()}.jpg`);
                    execSync(`curl -sL -o "${tmpDlPath}" "${lastVideoUrlInConversation}"`, { timeout: 60000 });
                    execSync(`ffmpeg -y -sseof -1 -i "${tmpDlPath}" -frames:v 1 -q:v 2 "${tmpFramePath}"`, { timeout: 30000 });
                    
                    const frameBuffer = readFileSync(tmpFramePath);
                    const frameBase64 = frameBuffer.toString('base64');
                    const dataUrl = `data:image/jpeg;base64,${frameBase64}`;
                    const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                      body: JSON.stringify({
                        base64Data: dataUrl,
                        uploadPath: 'soulprint/video-edit-frames',
                        fileName: `frame_edit_conv_${Date.now()}.jpg`,
                      }),
                    });
                    if (upRes.ok) {
                      const uploadData = await upRes.json();
                      if (uploadData.success && uploadData.data?.downloadUrl) {
                        seedImageUrl = uploadData.data.downloadUrl;
                      }
                    }
                    console.log(`[VideoEdit] Extracted conversation video frame: ${seedImageUrl?.substring(0, 80)}`);
                    try { unlinkFile(tmpDlPath); } catch {}
                    try { unlinkFile(tmpFramePath); } catch {}
                  } catch (convErr) {
                    console.error('[VideoEdit] Conversation video frame extraction failed:', convErr.message);
                  }
                }
                
                // Step 2: Generate new video using the edit description as prompt
                // Use the user's edit instructions to craft the video prompt
                let editPrompt = sanitizedContent;
                // If we have a seed image, use image-to-video (wan-i2v)
                // Otherwise, fall back to text-to-video with descriptive prompt
                
                // Refine the edit prompt using LLM for better video generation
                try {
                  const refinementMessages = [
                    { role: 'system', content: `You are a video generation prompt engineer. The user wants to edit a video by making specific changes. Convert their edit request into a clear, concise video generation prompt that describes the DESIRED RESULT (not the editing process). Focus on what the final video should look like. Keep it under 200 words. Do NOT mention "editing" or "removing" — instead describe the scene as it should appear AFTER the changes.` },
                    { role: 'user', content: `Edit request: "${sanitizedContent}"\n\nConvert this into a video generation prompt describing the final desired scene.` }
                  ];
                  const refinedResult = await provider.chat(refinementMessages, { model, max_tokens: 300, temperature: 0.7 });
                  if (refinedResult?.content) {
                    editPrompt = refinedResult.content.trim();
                    console.log(`[VideoEdit] Refined prompt: ${editPrompt.substring(0, 150)}`);
                  }
                } catch (refErr) {
                  console.log('[VideoEdit] Prompt refinement failed, using original:', refErr.message);
                }
                
                let newTaskId = null;
                const videoModel = seedImageUrl ? 'wan-i2v' : 'kling-3.0';
                
                if (seedImageUrl) {
                  // Image-to-video with the extracted frame + edit prompt
                  send({ type: 'delta', content: '🎬 Generating your edited video from the extracted frame...\n\n' });
                  newTaskId = await generateVideoFromImage(seedImageUrl, editPrompt, kieKey, { duration: '5', resolution: '1080p' });
                  console.log(`[VideoEdit] Started image-to-video generation: taskId=${newTaskId}`);
                } else {
                  // Text-to-video fallback (no frame available)
                  send({ type: 'delta', content: '🎬 Generating your video based on your description...\n\n' });
                  newTaskId = await generateVideoWithModel('kling-3.0', editPrompt, kieKey, { aspectRatio: '16:9' });
                  console.log(`[VideoEdit] Started text-to-video generation: taskId=${newTaskId}`);
                }
                
                if (newTaskId) {
                  const displayMsg = `Your edited video is being generated! This typically takes 2-5 minutes.\n\n**Edit:** ${sanitizedContent.substring(0, 200)}`;
                  
                  // Save video job for tracking
                  await db.collection('video_jobs').insertOne({
                    task_id: newTaskId, user_id: user.id, conversation_id: convId,
                    message_id: assistantMsgId, prompt: editPrompt, original_request: sanitizedContent,
                    model: videoModel, status: 'generating', type: 'video_edit',
                    seed_image_url: seedImageUrl, created_at: new Date(),
                  });
                  
                  // Send video task event so frontend shows the VideoCard with progress
                  send({ type: 'delta', content: displayMsg });
                  send({
                    type: 'video_task', taskId: newTaskId, status: 'generating',
                    prompt: editPrompt, model: videoModel, videoModel,
                  });
                  
                  fullContent = displayMsg;
                  
                  // Save assistant message
                  await dbMessages.insertOne({
                    id: assistantMsgId, conversation_id: convId, role: 'assistant',
                    content: fullContent, model_used: model, user_id: user.id,
                    video_task: { taskId: newTaskId, status: 'generating', prompt: editPrompt, videoModel },
                    created_at: new Date(),
                  });
                  await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
                  send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                  clearInterval(keepaliveInterval);
                  controllerClosed = true; controller.close();
                  return;
                }
              } catch (editErr) {
                console.error('[VideoEdit] Auto-execution failed:', editErr.message);
                send({ type: 'delta', content: `\n\n⚠️ Video edit encountered an issue: ${editErr.message}. Let me try another approach.\n\n` });
                // Fall through to normal LLM flow
              }
            }
          }
        }
        
        // ══════════════════════════════════════════════════════════════════
        // ── TYPED CONFIRMATION DETECTION ─────────────────────────────────────
        // When user types "OK", "yes", "go", "generate", etc. after a media
        // confirmation prompt, recover the pending media params and proceed.
        // This prevents the loop where the user keeps getting asked to confirm.
        // ══════════════════════════════════════════════════════════════════════
        if (!mediaFlow && !mediaIntent) {
          const affirmativePattern = /^(?:ok|okay|yes|yep|yeah|sure|go|generate|do\s*it|proceed|confirm|let'?s?\s*go|make\s*it|create\s*it|go\s*ahead|start|begin|looks?\s*good|perfect|send\s*it|that'?s?\s*(?:good|fine|great|perfect))[\s.!]*$/i;
          if (affirmativePattern.test(sanitizedContent.trim())) {
            // Check recent conversation history for a pending media confirmation
            try {
              const recentConfirmation = await db.collection('messages').findOne(
                { conversation_id: convId, content_type: 'media-confirmation', role: 'assistant' },
                { sort: { created_at: -1 } }
              );
              if (recentConfirmation?.media_confirmation) {
                const mc = recentConfirmation.media_confirmation;
                // Only use if the confirmation was recent (within last 10 minutes)
                const confirmAge = Date.now() - new Date(recentConfirmation.created_at).getTime();
                if (confirmAge < 10 * 60 * 1000) {
                  console.log(`[TypedConfirm] User typed "${sanitizedContent.trim()}" — recovering pending ${mc.detectedType} confirmation`);
                  console.log(`[TypedConfirm] Refined prompt: ${mc.refinedPrompt?.substring(0, 120)}`);
                  
                  // Construct the mediaFlow as if the user clicked the "Generate" button
                  mediaFlow = {
                    step: 'confirmed',
                    type: mc.detectedType,
                    originalPrompt: mc.originalPrompt,
                    finalPrompt: mc.refinedPrompt || mc.originalPrompt,
                    selectedModel: 'smart', // Use smart/recommended by default
                    sourceImageUrl: mc.sourceImageUrl || mc.conversationImageUrl || null,
                    conversationVideoUrl: mc.conversationVideoUrl || null,
                    conversationVideoTaskId: mc.conversationVideoTaskId || null,
                  };
                  mediaIntent = mc.detectedType;
                  console.log(`[TypedConfirm] Set mediaFlow.type=${mc.detectedType}, mediaIntent=${mediaIntent}`);
                } else {
                  console.log(`[TypedConfirm] Found old confirmation (${Math.round(confirmAge/1000)}s ago) — ignoring, treating as regular message`);
                }
              }
            } catch (lookupErr) {
              console.error('[TypedConfirm] Error looking up pending confirmation:', lookupErr.message);
            }
          }
        }

        // ══════════════════════════════════════════════════════════════════
        // ── IMAGE-TO-VIDEO AUTO-EXECUTE ─────────────────────────────────────
        // When user says "animate this image" and there's an image available
        // (attached or recently generated), skip confirmation and auto-generate
        // ══════════════════════════════════════════════════════════════════════
        const hasImageAttachmentForAnimate = attachments.some(a =>
          a.type === 'image' || a.type?.startsWith('image/') ||
          a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/')
        );
        const hasImageContextForAnimate = hasImageAttachmentForAnimate || lastImageUrlInConversation;
        
        // Helper: does the user's message reference the conversation context (it/this/that)?
        const refsConversationContext = /\b(?:it|this|that)\b/i.test(sanitizedContent);
        // Helper: is this a very short bare request like "generate a video" / "make a video" (not describing a new scene)?
        const isShortContextualRequest = sanitizedContent.split(/\s+/).length <= 6;
        
        const isImageToVideoRequest = mediaIntent === 'video' && !isVideoEditRequest && !mediaFlow && hasImageContextForAnimate && (
          hasImageAttachmentForAnimate ||
          // ── Original patterns (explicit references) ──
          /\b(?:animate|bring\s+to\s+life)\s+(?:this|that|the|my|it)\b/i.test(sanitizedContent) ||
          /\b(?:this|that|the|my)\s+(?:image|picture|photo|pic)\b/i.test(sanitizedContent) ||
          /\b(?:turn|make|convert)\s+(?:this|that|it|the)\b.*\b(?:into|to|a)\b.*\b(?:video|animation)\b/i.test(sanitizedContent) ||
          /\b(?:make|have)\s+(?:this|that|it)\s+(?:move|animated|a\s+video)\b/i.test(sanitizedContent) ||
          /\banimate\s+(?:this|it|that|the)\b/i.test(sanitizedContent) ||
          /\b(?:animate|animation\s+of)\s+(?:this|that|the|my)\s+(?:image|picture|photo|pic)\b/i.test(sanitizedContent) ||
          // ── NEW: Broader patterns for generated-image-to-video ──
          // "video out of/from/of it/this/that" anywhere in the message
          /\bvideo\s+(?:out\s+of|from|of)\s+(?:it|this|that)\b/i.test(sanitizedContent) ||
          // "video of/from/using the [adjective(s)] image/picture/photo" (handles "the generated image", "the last image", etc.)
          /\bvideo\s+(?:of|from|using|with)\s+(?:the|my)\s+(?:\w+\s+)*(?:image|picture|photo|pic)\b/i.test(sanitizedContent) ||
          // "video using/with it/this/that"
          /\bvideo\s+(?:using|with)\s+(?:it|this|that)\b/i.test(sanitizedContent) ||
          // "of this/that/it" + video intent (catches "can you make a video of this", "create a video of it")
          /\b(?:of|from|out\s+of|for)\s+(?:it|this|that)\b/i.test(sanitizedContent) ||
          // ── Contextual fallback: conversation image exists, no attachment, short message with context reference ──
          // Catches "generate a video", "now make a video", etc. when referring to recent image
          (!hasImageAttachmentForAnimate && !!lastImageUrlInConversation && refsConversationContext) ||
          // Ultra-short bare requests like "generate a video" / "make a video" with a conversation image
          (!hasImageAttachmentForAnimate && !!lastImageUrlInConversation && isShortContextualRequest)
        );

        if (isImageToVideoRequest && mediaIntent === 'video') {
          console.log(`[ImageToVideo] Detected image-to-video request — auto-executing (skip confirmation)`);
          console.log(`[ImageToVideo] Has image attachment: ${hasImageAttachmentForAnimate}, Has conversation image: ${!!lastImageUrlInConversation}`);

          send({ type: 'generating_visual', visualType: 'video' });
          send({ type: 'delta', content: '🎬 **Animating your image...** Preparing and generating the video now.\n\n' });

          const kieKey = process.env.KIE_API_KEY;
          if (!kieKey) {
            send({ type: 'delta', content: '❌ Video generation API is not configured. Please contact support.' });
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }

          try {
            let seedImageUrl = null;

            // Try to get image from attachments first
            if (hasImageAttachmentForAnimate) {
              const imgAtt = attachments.find(a =>
                a.type === 'image' || a.type?.startsWith('image/') ||
                a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/')
              );
              if (imgAtt) {
                const b64Val = imgAtt.base64;
                if (b64Val && (b64Val.startsWith('http://') || b64Val.startsWith('https://'))) {
                  seedImageUrl = b64Val;
                } else if (imgAtt.url) {
                  seedImageUrl = imgAtt.url;
                } else if (b64Val && b64Val.startsWith('attachment://')) {
                  try {
                    const attId = b64Val.replace('attachment://', '');
                    const attDoc = await db.collection('temp_attachments').findOne({ id: attId });
                    if (attDoc) {
                      const dataUrl = `data:${attDoc.mimeType || 'image/jpeg'};base64,${attDoc.base64}`;
                      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                        body: JSON.stringify({ base64Data: dataUrl, uploadPath: 'soulprint/image-to-video', fileName: `i2v_${Date.now()}.jpg` }),
                      });
                      if (upRes.ok) {
                        const upData = await upRes.json();
                        if (upData.success && upData.data?.downloadUrl) seedImageUrl = upData.data.downloadUrl;
                      }
                    }
                  } catch (e) { console.error('[ImageToVideo] Attachment resolve failed:', e.message); }
                } else if (b64Val) {
                  // Raw base64 — upload to CDN
                  const mType = imgAtt.mimeType || imgAtt.mime_type || 'image/jpeg';
                  const dataUrl = b64Val.startsWith('data:') ? b64Val : `data:${mType};base64,${b64Val}`;
                  const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                    body: JSON.stringify({ base64Data: dataUrl, uploadPath: 'soulprint/image-to-video', fileName: `i2v_${Date.now()}.jpg` }),
                  });
                  if (upRes.ok) {
                    const upData = await upRes.json();
                    if (upData.success && upData.data?.downloadUrl) seedImageUrl = upData.data.downloadUrl;
                  }
                }
              }
            }

            // Fall back to last image in conversation
            if (!seedImageUrl && lastImageUrlInConversation) {
              seedImageUrl = lastImageUrlInConversation;
              console.log(`[ImageToVideo] Using conversation image: ${seedImageUrl.substring(0, 80)}`);
            }

            if (seedImageUrl) {
              send({ type: 'delta', content: '📸 Using your image as the starting frame...\n' });

              // Refine the prompt using LLM
              let videoPrompt = sanitizedContent;
              try {
                const openaiApiKey = process.env.OPENAI_API_KEY;
                if (openaiApiKey) {
                  const visionContent = [
                    { type: 'text', text: `User's animation request: "${sanitizedContent}"\n\nDescribe what the resulting animated video should look like based on the user's request. Focus on motion, camera movement, and the action that should happen. Keep it under 150 words. Output ONLY the prompt.` },
                    { type: 'image_url', image_url: { url: seedImageUrl, detail: 'low' } }
                  ];
                  const refineRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiApiKey}` },
                    body: JSON.stringify({
                      model: 'gpt-4o',
                      messages: [
                        { role: 'system', content: 'You are a video generation prompt engineer. Create a detailed animation prompt from the user\'s request and the source image. Describe the desired motion, camera work, and scene progression. Output ONLY the prompt text.' },
                        { role: 'user', content: visionContent }
                      ],
                      max_tokens: 250, temperature: 0.7,
                    }),
                  });
                  if (refineRes.ok) {
                    const refineData = await refineRes.json();
                    const refined = refineData.choices?.[0]?.message?.content?.trim();
                    if (refined) {
                      videoPrompt = refined;
                      console.log(`[ImageToVideo] Refined prompt: ${videoPrompt.substring(0, 150)}`);
                    }
                  }
                }
              } catch (refErr) {
                console.log('[ImageToVideo] Prompt refinement failed, using original:', refErr.message);
              }

              // Generate video from image
              send({ type: 'delta', content: '🎬 Generating your video — this typically takes 2-5 minutes...\n\n' });
              const newTaskId = await generateVideoFromImage(seedImageUrl, videoPrompt, kieKey, { duration: '5', resolution: '1080p' });
              console.log(`[ImageToVideo] Started generation: taskId=${newTaskId}`);

              if (newTaskId) {
                const displayMsg = `🎬 **Animating your image!** This typically takes 2-5 minutes.\n\n**Prompt:** ${videoPrompt.substring(0, 200)}`;

                await db.collection('video_jobs').insertOne({
                  task_id: newTaskId, user_id: user.id, conversation_id: convId,
                  message_id: assistantMsgId, prompt: videoPrompt, original_request: sanitizedContent,
                  model: 'wan-i2v', status: 'generating', type: 'image_to_video',
                  seed_image_url: seedImageUrl, created_at: new Date(),
                });

                send({ type: 'delta', content: displayMsg });
                send({
                  type: 'video_task', taskId: newTaskId, status: 'generating',
                  prompt: videoPrompt, model: 'wan-i2v', videoModel: 'wan-i2v',
                });

                fullContent = displayMsg;

                await dbMessages.insertOne({
                  id: assistantMsgId, conversation_id: convId, role: 'assistant',
                  content: fullContent, model_used: model, user_id: user.id,
                  video_task: { taskId: newTaskId, status: 'generating', prompt: videoPrompt, videoModel: 'wan-i2v' },
                  created_at: new Date(),
                });
                await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
                send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                clearInterval(keepaliveInterval);
                controllerClosed = true; controller.close();
                return;
              }
            } else {
              console.log('[ImageToVideo] No seed image available — falling through to confirmation flow');
            }
          } catch (i2vErr) {
            console.error('[ImageToVideo] Auto-execution failed:', i2vErr.message);
            send({ type: 'delta', content: `\n\n⚠️ Animation encountered an issue: ${i2vErr.message}. Let me try another approach.\n\n` });
            // Fall through to normal confirmation or LLM flow
          }
        }

        if (mediaIntent && !mediaFlow) {
          
          if (!mediaGenMode) {
            // ── Media Create mode is OFF — ask for confirmation before generating ──
            console.log(`[MediaConfirm] Create mode OFF, detected ${mediaIntent} intent — sending confirmation prompt`);
            
            // Send a friendly confirmation message
            const mediaType = mediaIntent === 'video' ? 'video' : 'image';
            const confirmationMessage = `🎨 It looks like you want to generate ${mediaType === 'video' ? 'a video' : 'an image'}. To auto-generate media, turn on the **🎨 Create** toggle above the input.\n\nOr would you like me to go ahead and generate it now?\n\n**Your prompt:** "${sanitizedContent}"`;
            
            send({ type: 'delta', content: confirmationMessage });
            send({ type: 'media_confirmation', mediaType, prompt: sanitizedContent, detectedType: mediaType });
            
            fullContent = confirmationMessage;
            
            await dbMessages.insertOne({
              id: assistantMsgId, conversation_id: convId, role: 'assistant',
              content: fullContent, model_used: model, user_id: user.id, created_at: new Date(),
            });
            await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }
          
          // ── Media Create mode is ON — proceed with generation flow ──
          if (mediaIntent !== 'image') {
            console.log(`[MediaGen] Create mode ON, detected ${mediaIntent} intent — auto-generating`);
            
            // Use LLM to refine the user's raw prompt into a professional generation prompt
            let refinedPrompt = sanitizedContent;
            
            // Check if user has image attachments (for image-to-video flows)
            const confirmImageAttachments = attachments.filter(a => 
              a.type === 'image' || a.type?.startsWith('image/') || 
              a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/')
            );
            const hasConfirmImageAttachment = confirmImageAttachments.length > 0;
            
            try {
              // If user attached an image, use GPT-4o with vision to analyze it for a better prompt
              if (hasConfirmImageAttachment) {
                console.log(`[MediaConfirm] User has ${confirmImageAttachments.length} image attachment(s) — using GPT-4o Vision for prompt refinement`);
                const openaiApiKey = process.env.OPENAI_API_KEY;
                
                if (openaiApiKey) {
                  // Build vision messages with the attached image(s)
                  const visionContent = [
                    { type: 'text', text: `User's request: "${sanitizedContent}"\n\nThe user has attached the above image(s). Create an optimized ${mediaIntent} generation prompt based on what you see in the image and the user's request.` }
                  ];
                  
                  for (const att of confirmImageAttachments.slice(0, 4)) {
                    if (att.base64) {
                      const b64 = att.base64;
                      // Handle URL references (from frontend pre-upload)
                      if (b64.startsWith('http://') || b64.startsWith('https://')) {
                        visionContent.push({ type: 'image_url', image_url: { url: b64, detail: 'low' } });
                      } else if (b64.startsWith('attachment://')) {
                        // Resolve from MongoDB temp storage
                        try {
                          const attId = b64.replace('attachment://', '');
                          const attDoc = await db.collection('temp_attachments').findOne({ id: attId });
                          if (attDoc) {
                            visionContent.push({ type: 'image_url', image_url: { url: `data:${attDoc.mimeType || 'image/jpeg'};base64,${attDoc.base64}`, detail: 'low' } });
                          }
                        } catch (e) { /* skip */ }
                      } else if (b64.startsWith('data:')) {
                        visionContent.push({ type: 'image_url', image_url: { url: b64, detail: 'low' } });
                      } else {
                        // Raw base64
                        const dataUrl = `data:${att.mimeType || att.mime_type || 'image/png'};base64,${b64}`;
                        visionContent.push({ type: 'image_url', image_url: { url: dataUrl, detail: 'low' } });
                      }
                    } else if (att.url) {
                      visionContent.push({ type: 'image_url', image_url: { url: att.url, detail: 'low' } });
                    }
                  }
                  
                  const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
                    body: JSON.stringify({
                      model: 'gpt-4o',
                      messages: [
                        {
                          role: 'system',
                          content: `You are a professional prompt engineer for AI ${mediaIntent} generation. The user has attached an image and wants to ${mediaIntent === 'video' ? 'animate/create a video from' : 'transform'} it.
Rules:
- LOOK at the attached image and describe what's in it as part of your prompt
- Create a detailed ${mediaIntent === 'video' ? 'animation/video' : 'image generation'} prompt that incorporates the visual content of the attached image
- Add professional quality descriptors (camera movement, lighting, mood, style)
- Keep it under 200 words
- Do NOT ask the user to provide an image — they already have
- Do NOT say "please provide" or "upload" — the image is RIGHT HERE
- Output ONLY the refined prompt text, nothing else`
                        },
                        { role: 'user', content: visionContent }
                      ],
                      max_tokens: 300,
                      temperature: 0.7,
                    }),
                  });
                  
                  if (visionRes.ok) {
                    const visionData = await visionRes.json();
                    const visionPrompt = visionData.choices?.[0]?.message?.content;
                    if (visionPrompt) {
                      refinedPrompt = visionPrompt.trim();
                    }
                  }
                }
              } else {
                // No image attachments — use standard text-only refinement
                const refineProvider = getProvider('openai', 'gpt-4o-mini');
                const refineResult = await refineProvider.generateChatCompletion({
                  systemPrompt: `You are a professional prompt engineer for AI image and video generation. Given a user's request, create an optimized, detailed prompt that will produce the best possible ${mediaIntent}. 
Rules:
- Keep the core intent and subject exactly as requested
- Add professional quality descriptors (lighting, composition, style)
- Keep it under 200 words
- Do NOT add content the user didn't ask for (no random objects/people)
- For infographics/flyers, include layout and design guidance
- Output ONLY the refined prompt text, nothing else`,
                  messages: [{ role: 'user', content: sanitizedContent }],
                  model: 'gpt-4o-mini',
                  temperature: 0.7,
                  max_tokens: 300,
                });
                refinedPrompt = refineResult.trim();
              }
              console.log(`[MediaConfirm] Refined prompt: ${refinedPrompt.substring(0, 120)}...`);
            } catch (refineErr) {
              console.log(`[MediaConfirm] Prompt refinement failed, using original:`, refineErr.message);
            }
            
            // Build available models list
            let availableModels = [];
            if (mediaIntent === 'image') {
              availableModels = [
                { key: 'nano-banana', label: 'Nano Banana', description: 'Google — fast, photorealistic', emoji: '🍌' },
                { key: 'seedream-5-lite', label: 'Seedream 5', description: 'ByteDance — creative, artistic', emoji: '🌱' },
                { key: 'imagen-4-ultra', label: 'Imagen 4 Ultra', description: 'Google — highest quality', emoji: '✨' },
                { key: 'gpt-image-1-5', label: 'GPT Image 1.5', description: 'OpenAI — versatile, text rendering', emoji: '🤖' },
              ];
            } else {
              availableModels = [
                { key: 'kling-3.0', label: 'Kling 3.0', description: 'Fast, character animation', emoji: '⚡' },
                { key: 'veo3', label: 'Veo 3.1', description: 'Google — cinematic 1080p + audio', emoji: '🎬' },
                { key: 'seedance-2-0', label: 'Seedance 2.0', description: 'Native audio, lip-sync, dance', emoji: '💃' },
                { key: 'seedance-2-0-fast', label: 'Seedance 2.0 Fast', description: 'Fast Seedance with audio & motion', emoji: '⚡' },
                { key: 'runway-aleph', label: 'Runway Aleph', description: 'Video editing & style transfer', emoji: '🎨' },
              ];
            }
            
            // Send confirmation text
            const intentEmoji = mediaIntent === 'image' ? '🎨' : '🎬';
            const intentLabel = mediaIntent === 'image' ? 'image' : 'video';
            fullContent = `${intentEmoji} I detected you'd like to generate ${mediaIntent === 'image' ? 'an image' : 'a video'}. Let's make sure everything is perfect before we generate:`;
            send({ type: 'delta', content: fullContent });
            
            // If user has image attachments, upload ALL of them NOW so URLs are available during confirmation
            let confirmSourceImageUrl = null;
            let confirmReferenceImageUrls = [];
            
            if (hasConfirmImageAttachment) {
              const kieKey = process.env.KIE_API_KEY;
              if (kieKey) {
                const uploadFolder = mediaIntent === 'video' ? 'soulprint/image-to-video' : 'soulprint/reference-images';
                
                for (let i = 0; i < confirmImageAttachments.length; i++) {
                  const att = confirmImageAttachments[i];
                  const mType = att.mimeType || att.mime_type || 'image/jpeg';
                  const fileName = att.name || `confirm-image-${i}-${Date.now()}.${mType.split('/')[1] || 'jpg'}`;
                  
                  // If attachment is already a URL reference (from frontend pre-upload), use it directly
                  const b64Val = att.base64;
                  if (b64Val && (b64Val.startsWith('http://') || b64Val.startsWith('https://'))) {
                    // Already a persistent URL — no need to re-upload
                    confirmReferenceImageUrls.push(b64Val);
                    if (i === 0) confirmSourceImageUrl = b64Val;
                    console.log(`[MediaConfirm] Image ${i + 1} already a URL:`, b64Val.substring(0, 80));
                    continue;
                  }
                  
                  // If attachment is an attachment:// reference, resolve from MongoDB
                  if (b64Val && b64Val.startsWith('attachment://')) {
                    try {
                      const attId = b64Val.replace('attachment://', '');
                      const attDoc = await db.collection('temp_attachments').findOne({ id: attId });
                      if (attDoc) {
                        // Re-upload from MongoDB to Kie.ai for persistent storage
                        const tempDataUrl = `data:${attDoc.mimeType || 'image/jpeg'};base64,${attDoc.base64}`;
                        const uploadRes2 = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                          body: JSON.stringify({ base64Data: tempDataUrl, uploadPath: uploadFolder, fileName }),
                        });
                        if (uploadRes2.ok) {
                          const d2 = await uploadRes2.json();
                          const url2 = d2.data?.downloadUrl || d2.downloadUrl;
                          if ((d2.success || d2.code === 200) && url2) {
                            confirmReferenceImageUrls.push(url2);
                            if (i === 0) confirmSourceImageUrl = url2;
                            console.log(`[MediaConfirm] Resolved attachment:// → uploaded to Kie.ai:`, url2.substring(0, 80));
                            continue;
                          }
                        }
                      }
                    } catch (resolveErr) {
                      console.log(`[MediaConfirm] Failed to resolve attachment://:`, resolveErr.message);
                    }
                    continue;
                  }
                  
                  // Standard base64 upload to Kie.ai
                  const dataUrl = b64Val?.startsWith('data:') ? b64Val : `data:${mType};base64,${b64Val}`;
                  
                  try {
                    const uploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                      body: JSON.stringify({
                        base64Data: dataUrl,
                        uploadPath: uploadFolder,
                        fileName: fileName,
                      }),
                    });
                    if (uploadRes.ok) {
                      const uploadData = await uploadRes.json();
                      const downloadUrl = uploadData.data?.downloadUrl || uploadData.downloadUrl;
                      if ((uploadData.success || uploadData.code === 200) && downloadUrl) {
                        confirmReferenceImageUrls.push(downloadUrl);
                        if (i === 0) confirmSourceImageUrl = downloadUrl;
                        console.log(`[MediaConfirm] Pre-uploaded image ${i + 1}/${confirmImageAttachments.length}:`, downloadUrl.substring(0, 80));
                      }
                    }
                  } catch (uploadErr) {
                    console.log(`[MediaConfirm] Image ${i + 1} upload failed:`, uploadErr.message);
                  }
                }
                
                console.log(`[MediaConfirm] Pre-uploaded ${confirmReferenceImageUrls.length}/${confirmImageAttachments.length} reference images`);
              }
            }
            
            // Send media confirmation payload for frontend to render inline cards
            send({ 
              type: 'media_confirmation', 
              detectedType: mediaIntent, 
              originalPrompt: sanitizedContent, 
              refinedPrompt, 
              availableModels, 
              recommendedModel: 'smart',
              hasAttachedImage: hasConfirmImageAttachment,
              sourceImageUrl: confirmSourceImageUrl || null,
              referenceImageUrls: confirmReferenceImageUrls.length > 0 ? confirmReferenceImageUrls : null,
              // Include conversation media context so frontend knows what's available
              conversationImageUrl: lastImageUrlInConversation || null,
              conversationVideoUrl: lastVideoUrlInConversation || null,
              conversationVideoTaskId: lastVideoTaskIdInConversation || null,
            });
            
            // Save the assistant message with confirmation metadata
            await dbMessages.insertOne({
              id: assistantMsgId, conversation_id: convId, user_id: user.id,
              role: 'assistant', content: fullContent, created_at: new Date(),
              model_used: 'system', provider_used: 'system', content_type: 'media-confirmation',
              media_confirmation: { 
                detectedType: mediaIntent, 
                originalPrompt: sanitizedContent, 
                refinedPrompt, 
                availableModels,
                sourceImageUrl: confirmSourceImageUrl || null,
                conversationImageUrl: lastImageUrlInConversation || null,
                conversationVideoUrl: lastVideoUrlInConversation || null,
                conversationVideoTaskId: lastVideoTaskIdInConversation || null,
              },
            });
            await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
            
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }
          // If quickGenerate is true, fall through to normal generation below
        }
        
        // ── Handle mediaFlow confirmations ────────────────────────────────
        // User confirmed via the confirmation cards — override intent and prompt
        if (mediaFlow && mediaFlow.step === 'confirmed') {
          if (mediaFlow.type === 'chat') {
            // User chose "Just Chat" — clear media intent, fall through to LLM
            console.log('[MediaConfirm] User chose "Just Chat" — proceeding with text response');
            mediaIntent = null;
          } else if (mediaFlow.type === 'video_extend') {
            // User confirmed video extension
            console.log(`[MediaConfirm] User confirmed video extension`);
            console.log(`[MediaConfirm] Extension prompt: ${mediaFlow.finalPrompt?.substring(0, 120)}`);
            console.log(`[MediaConfirm] Source taskId: ${mediaFlow.sourceVideoTaskId}`);
            // Will be handled in the video extend section below
          } else {
            // User confirmed image or video generation with specific prompt/model
            mediaIntent = mediaFlow.type; // 'image' or 'video'
            // Override the content with the user's finalized prompt for generation
            // We'll use mediaFlow.finalPrompt downstream
            console.log(`[MediaConfirm] User confirmed ${mediaFlow.type} generation`);
            console.log(`[MediaConfirm] Final prompt: ${mediaFlow.finalPrompt?.substring(0, 120)}`);
            console.log(`[MediaConfirm] Selected model: ${mediaFlow.selectedModel}`);
          }
        }

        // ── Handle video extension ────────────────────────────────────────
        // Detect if user wants to extend an existing video in the conversation
        // isVideoExtendRequest was already declared earlier (before isEditRequest)
        
        // Also check if user uploaded a video attachment — use it as the source video for extension
        let uploadedVideoUrl = null;
        let hasUploadedVideoAttachment = false;
        if (attachments && attachments.length > 0) {
          for (const att of attachments) {
            const isVideoMime = att.mimeType?.startsWith('video/') || att.mime_type?.startsWith('video/');
            const isVideoFile = att.name?.match(/\.(mp4|mov|avi|webm|mkv|m4v)$/i);
            const isVideoType = att.type === 'video';
            
            if (isVideoMime || isVideoFile || isVideoType) {
              hasUploadedVideoAttachment = true;
              
              // Try to extract a URL from the attachment
              if (att.isUrlReference && att.base64?.startsWith('http')) {
                uploadedVideoUrl = att.base64;
              } else if (att.url) {
                uploadedVideoUrl = att.url;
              } else if (att.base64 && att.base64.startsWith('http')) {
                uploadedVideoUrl = att.base64;
              }
              
              console.log(`[VideoExtend] Found uploaded video attachment: ${uploadedVideoUrl?.substring(0, 80) || 'base64 data (no URL)'}, mime: ${att.mimeType || att.mime_type || 'unknown'}`);
              break;
            }
          }
        }
        
        const hasVideoToExtend = lastVideoTaskIdInConversation || lastVideoUrlInConversation || uploadedVideoUrl || hasUploadedVideoAttachment || mediaFlow?.sourceVideoTaskId;
        
        if ((isVideoExtendRequest && hasVideoToExtend) || (mediaFlow?.type === 'video_extend')) {
          // PRIORITY: If user uploaded a video attachment, use THAT instead of conversation history
          // The uploaded video has no taskId, so extendTaskId should be null to trigger frame extraction
          const userUploadedVideo = hasUploadedVideoAttachment;
          // If mediaFlow has a seedImageUrl from the confirmation step, the user uploaded a video
          // and the frame was already extracted — force extendTaskId to null so we use the frame
          const hasSeedFromUpload = mediaFlow?.seedImageUrl && !mediaFlow?.sourceVideoTaskId;
          const extendTaskId = (userUploadedVideo || hasSeedFromUpload) ? null : (mediaFlow?.sourceVideoTaskId || lastVideoTaskIdInConversation);
          const extendPrompt = mediaFlow?.finalPrompt || sanitizedContent;
          const sourceVideoUrl = userUploadedVideo ? (uploadedVideoUrl || null) : (mediaFlow?.sourceVideoUrl || uploadedVideoUrl || lastVideoUrlInConversation);
          
          console.log(`[VideoExtend] Upload detected: ${userUploadedVideo}, taskId: ${extendTaskId || 'NONE (will use frame extraction)'}, sourceUrl: ${sourceVideoUrl?.substring(0, 60) || 'none'}`);
          
          // If this is a natural language request (not from confirmation), show confirmation first
          if (!mediaFlow && !quickGenerate) {
            console.log(`[VideoExtend] Detected extend intent — sending confirmation`);
            
            // CRITICAL: Extract frame from uploaded video NOW, during confirmation step
            // This is because the second request (after user confirms) won't have the video attachment
            let extractedSeedImageUrl = null;
            
            if (hasUploadedVideoAttachment && attachments && attachments.length > 0) {
              for (const att of attachments) {
                const isVideo = att.mimeType?.startsWith('video/') || att.mime_type?.startsWith('video/') || att.type === 'video';
                if (!isVideo) continue;
                
                let videoBase64 = att.base64;
                if (!videoBase64) continue;
                
                // Strip data URL prefix if present
                if (videoBase64.startsWith('data:')) {
                  videoBase64 = videoBase64.split(',')[1] || videoBase64;
                }
                
                try {
                  await ensureFfmpeg();
                  const { execSync } = require('child_process');
                  const path = require('path');
                  const fs = require('fs');
                  const tempDir = '/tmp/video_frames';
                  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                  
                  const ts = Date.now();
                  const tempVideoPath = path.join(tempDir, `vid_${ts}.mp4`);
                  const tempFramePath = path.join(tempDir, `frame_${ts}.jpg`);
                  
                  fs.writeFileSync(tempVideoPath, Buffer.from(videoBase64, 'base64'));
                  console.log(`[VideoExtend] Wrote temp video: ${tempVideoPath} (${fs.statSync(tempVideoPath).size} bytes)`);
                  
                  // Extract the last frame using ffmpeg
                  try {
                    const durationOutput = execSync(
                      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${tempVideoPath}"`,
                      { timeout: 10000 }
                    ).toString().trim();
                    const duration = parseFloat(durationOutput) || 5;
                    const frameTime = Math.max(0, duration - 0.1);
                    
                    execSync(
                      `ffmpeg -y -ss ${frameTime} -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
                      { timeout: 15000 }
                    );
                    console.log(`[VideoExtend] Extracted last frame at t=${frameTime}s`);
                  } catch (ffmpegErr) {
                    console.log(`[VideoExtend] Last frame extraction failed, trying first frame`);
                    execSync(
                      `ffmpeg -y -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
                      { timeout: 15000 }
                    );
                  }
                  
                  if (fs.existsSync(tempFramePath)) {
                    const frameBuffer = fs.readFileSync(tempFramePath);
                    const frameBase64 = frameBuffer.toString('base64');
                    console.log(`[VideoExtend] Frame extracted: ${frameBuffer.length} bytes`);
                    
                    // Upload frame to Kie.ai CDN
                    const kieKey = process.env.KIE_API_KEY;
                    if (kieKey) {
                      const dataUrl = `data:image/jpeg;base64,${frameBase64}`;
                      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                        body: JSON.stringify({
                          base64Data: dataUrl,
                          uploadPath: 'soulprint/video-frames',
                          fileName: `frame_${ts}.jpg`,
                        }),
                      });
                      
                      if (upRes.ok) {
                        const uploadData = await upRes.json();
                        if (uploadData.success && uploadData.data?.downloadUrl) {
                          extractedSeedImageUrl = uploadData.data.downloadUrl;
                          console.log(`[VideoExtend] Frame uploaded to CDN: ${extractedSeedImageUrl}`);
                        } else {
                          console.log(`[VideoExtend] CDN upload response:`, JSON.stringify(uploadData).substring(0, 300));
                        }
                      } else {
                        console.log(`[VideoExtend] CDN upload failed: HTTP ${upRes.status}`);
                      }
                    }
                  }
                  
                  // Cleanup
                  try { require('fs').unlinkSync(tempVideoPath); } catch(e) {}
                  try { require('fs').unlinkSync(tempFramePath); } catch(e) {}
                } catch (frameErr) {
                  console.error(`[VideoExtend] Frame extraction failed: ${frameErr.message}`);
                }
                break;
              }
            }
            
            if (extractedSeedImageUrl) {
              console.log(`[VideoExtend] ✅ Seed image ready for extension: ${extractedSeedImageUrl}`);
            } else {
              console.log(`[VideoExtend] ⚠️ No seed image extracted — will use text-only generation on confirm`);
            }
            
            // Determine if user gave specific instructions or just said "extend this video"
            const genericExtendPhrases = [
              /^(?:please\s+)?(?:can you\s+)?extend\s+(?:this|the|that|my)\s+(?:video|clip)\s*[.!?]?\s*$/i,
              /^(?:please\s+)?(?:can you\s+)?(?:make|get)\s+(?:this|the|that|it)\s+(?:video\s+)?longer\s*[.!?]?\s*$/i,
              /^(?:please\s+)?(?:can you\s+)?continue\s+(?:this|the|that|my)\s+(?:video|clip)\s*[.!?]?\s*$/i,
              /^(?:please\s+)?(?:can you\s+)?(?:keep|keep it)\s+going\s*[.!?]?\s*$/i,
              /^extend\s*[.!?]?\s*$/i,
            ];
            const isGenericRequest = genericExtendPhrases.some(p => p.test(sanitizedContent.trim()));
            
            let refinedExtendPrompt;
            
            if (isGenericRequest) {
              // User gave no specific instructions — use a neutral prompt instead of hallucinating
              // Try to gather context from recent conversation about the video
              let videoContext = '';
              if (convId) {
                const recentMsgs = await db.collection('messages')
                  .find({ conversation_id: convId })
                  .sort({ created_at: -1 })
                  .limit(8)
                  .toArray();
                // Look for any description of the video in recent messages
                for (const msg of recentMsgs) {
                  if (msg.video_task?.prompt) {
                    videoContext = msg.video_task.prompt;
                    break;
                  }
                }
              }
              
              if (videoContext) {
                // We found the original generation prompt — use it for continuation
                refinedExtendPrompt = `Continue the scene naturally: ${videoContext}. Maintain the same visual style, mood, and pacing with smooth camera transitions.`;
              } else {
                // No context available — use a simple neutral prompt
                refinedExtendPrompt = `Continue the video scene naturally with smooth transitions. Maintain the same visual style, subject, pacing, and mood.`;
              }
              console.log(`[VideoExtend] Generic request — using neutral prompt (context found: ${!!videoContext})`);
            } else {
              // User gave specific instructions — refine them with conversation context
              let videoContext = '';
              if (convId) {
                const recentMsgs = await db.collection('messages')
                  .find({ conversation_id: convId })
                  .sort({ created_at: -1 })
                  .limit(8)
                  .toArray();
                for (const msg of recentMsgs) {
                  if (msg.video_task?.prompt) {
                    videoContext = msg.video_task.prompt;
                    break;
                  }
                }
              }
              
              refinedExtendPrompt = sanitizedContent;
              try {
                const refineProvider = getProvider('openai', 'gpt-4o-mini');
                const contextHint = videoContext 
                  ? `\n\nContext: The original video was generated with this prompt: "${videoContext}"`
                  : `\n\nNote: The user uploaded a video — you don't know what it shows. Do NOT invent or assume video content. Only describe the continuation based on what the user explicitly asked for.`;
                  
                const refineResult = await refineProvider.generateChatCompletion({
                  systemPrompt: `You are a professional prompt engineer for AI video extension. The user wants to extend/continue an existing video with specific instructions.${contextHint}

Rules:
- ONLY use what the user explicitly described. Do NOT invent scene details, characters, or settings.
- Add camera movement and transition descriptors to make it cinematic
- Keep it under 100 words
- Focus on what happens NEXT based on the user's instructions
- If the user's instructions are vague, keep the prompt simple and neutral
- Output ONLY the refined prompt text, nothing else`,
                  messages: [{ role: 'user', content: sanitizedContent }],
                  model: 'gpt-4o-mini',
                  temperature: 0.4,
                  max_tokens: 150,
                });
                refinedExtendPrompt = refineResult.trim();
              } catch (e) {
                console.log('[VideoExtend] Prompt refinement failed:', e.message);
              }
            }
            
            fullContent = `🎬 I detected you'd like to extend your existing video. Let's review the extension details:`;
            send({ type: 'delta', content: fullContent });
            
            send({
              type: 'media_confirmation',
              detectedType: 'video_extend',
              originalPrompt: sanitizedContent,
              refinedPrompt: refinedExtendPrompt,
              availableModels: [],
              recommendedModel: null,
              sourceVideoUrl: sourceVideoUrl || null,
              sourceVideoTaskId: extendTaskId,
              seedImageUrl: extractedSeedImageUrl || null,
              conversationVideoUrl: sourceVideoUrl || null,
              conversationVideoTaskId: extendTaskId,
            });
            
            await dbMessages.insertOne({
              id: assistantMsgId, conversation_id: convId, user_id: user.id,
              role: 'assistant', content: fullContent, created_at: new Date(),
              model_used: 'system', provider_used: 'system', content_type: 'media-confirmation',
              media_confirmation: {
                detectedType: 'video_extend',
                originalPrompt: sanitizedContent,
                refinedPrompt: refinedExtendPrompt,
                sourceVideoUrl: sourceVideoUrl,
                sourceVideoTaskId: extendTaskId,
                seedImageUrl: extractedSeedImageUrl || null,
              },
            });
            await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
            
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }
          
          // Execute the video extension (either quick-generate or confirmed via mediaFlow)
          console.log(`[VideoExtend] Extending video task ${extendTaskId || 'NO-TASK-ID'} with prompt: "${extendPrompt?.substring(0, 120)}"`);
          
          send({ type: 'generating_visual', visualType: 'video' });
          
          // If we don't have a taskId (uploaded video), extract a frame and use image-to-video
          // for visual continuity instead of generating a completely new video from text
          if (!extendTaskId) {
            // First check if seedImageUrl was pre-extracted during confirmation step
            let seedImageUrl = mediaFlow?.seedImageUrl || null;
            
            console.log(`[VideoExtend] No taskId available — using image-to-video. Pre-extracted seedImage: ${seedImageUrl ? 'YES' : 'NO'}`);
            send({ type: 'delta', content: '🎬 Generating a continuation from your video...\n\n' });
            fullContent = '🎬 Generating a continuation from your video...\n\n';
            
            try {
              const kieKey = process.env.KIE_API_KEY;
              if (!kieKey) throw new Error('Video API not configured');
              
              const videoPrompt = extendPrompt || 'Continue the scene naturally with smooth camera transitions';
              
              // Use pre-extracted seed image from confirmation step (passed via mediaFlow),
              // or try to extract from attachments if they're present (quickGenerate mode)
              // The seedImageUrl was already extracted during the confirmation step and 
              // stored in the media_confirmation event, then passed back through mediaFlow
              
              if (!seedImageUrl && attachments && attachments.length > 0) {
                for (const att of attachments) {
                  const isVideo = att.mimeType?.startsWith('video/') || att.mime_type?.startsWith('video/') || att.type === 'video';
                  if (!isVideo) continue;
                  
                  // Get the base64 data
                  let videoBase64 = att.base64;
                  if (!videoBase64) continue;
                  
                  // Strip data URL prefix if present
                  if (videoBase64.startsWith('data:')) {
                    videoBase64 = videoBase64.split(',')[1] || videoBase64;
                  }
                  
                  try {
                    // Write video to temp file
                    await ensureFfmpeg();
                    const { execSync } = require('child_process');
                    const path = require('path');
                    const fs = require('fs');
                    const tempDir = '/tmp/video_frames';
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                    
                    const tempVideoPath = path.join(tempDir, `vid_${Date.now()}.mp4`);
                    const tempFramePath = path.join(tempDir, `frame_${Date.now()}.jpg`);
                    
                    fs.writeFileSync(tempVideoPath, Buffer.from(videoBase64, 'base64'));
                    console.log(`[VideoExtend] Wrote temp video: ${tempVideoPath} (${fs.statSync(tempVideoPath).size} bytes)`);
                    
                    // Extract the last frame using ffmpeg
                    // First get duration, then extract frame near the end
                    try {
                      const durationOutput = execSync(
                        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${tempVideoPath}"`,
                        { timeout: 10000 }
                      ).toString().trim();
                      const duration = parseFloat(durationOutput) || 5;
                      const frameTime = Math.max(0, duration - 0.1); // Last frame
                      
                      execSync(
                        `ffmpeg -y -ss ${frameTime} -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
                        { timeout: 15000 }
                      );
                    } catch (ffmpegErr) {
                      // Fallback: extract first frame if last frame extraction fails
                      console.log(`[VideoExtend] Last frame extraction failed, trying first frame: ${ffmpegErr.message}`);
                      execSync(
                        `ffmpeg -y -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
                        { timeout: 15000 }
                      );
                    }
                    
                    if (fs.existsSync(tempFramePath)) {
                      const frameBuffer = fs.readFileSync(tempFramePath);
                      const frameBase64 = frameBuffer.toString('base64');
                      console.log(`[VideoExtend] Extracted frame: ${tempFramePath} (${frameBuffer.length} bytes)`);
                      
                      // Upload frame to Kie.ai CDN to get a URL
                      const dataUrl = `data:image/jpeg;base64,${frameBase64}`;
                      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                        body: JSON.stringify({
                          base64Data: dataUrl,
                          uploadPath: 'soulprint/video-frames',
                          fileName: `frame_${Date.now()}.jpg`,
                        }),
                      });
                      
                      if (upRes.ok) {
                        const uploadData = await upRes.json();
                        if (uploadData.success && uploadData.data?.downloadUrl) {
                          seedImageUrl = uploadData.data.downloadUrl;
                          console.log(`[VideoExtend] Uploaded frame to CDN: ${seedImageUrl}`);
                        }
                      }
                    }
                    
                    // Cleanup temp files
                    try { fs.unlinkSync(tempVideoPath); } catch(e) {}
                    try { fs.unlinkSync(tempFramePath); } catch(e) {}
                  } catch (frameErr) {
                    console.error(`[VideoExtend] Frame extraction failed: ${frameErr.message}`);
                  }
                  break; // Only process first video attachment
                }
              }
              
              let newTaskId;
              let usedModel;
              
              // ── CONTENT MODERATION: Block prohibited video prompts ──
              const videoModResult = moderateContent(videoPrompt || content, 'video');
              if (videoModResult.severity === SEVERITY.BLOCK) {
                console.log(`[Video Moderation] BLOCKED user=${user.id} category=${videoModResult.category}`);
                send({ type: 'delta', content: `\n\n${videoModResult.message}\n` });
                send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                clearInterval(keepaliveInterval);
                controllerClosed = true; controller.close();
                return;
              }
              
              if (seedImageUrl) {
                // Use image-to-video with the extracted frame for visual continuity
                console.log(`[VideoExtend] Using image-to-video with seed frame`);
                newTaskId = await generateVideoFromImage(seedImageUrl, videoPrompt, kieKey, { duration: '5', resolution: '1080p' });
                usedModel = 'wan-i2v';
                
                const displayMsg = `Your continuation video is being generated from the last frame of your video! This typically takes 2-5 minutes.\n\n**Extension prompt:** ${videoPrompt?.substring(0, 200)}`;
                fullContent += displayMsg;
                send({ type: 'delta', content: displayMsg });
              } else {
                // No frame extraction possible — generate a new video from text prompt
                console.log(`[VideoExtend] No frame extracted — falling back to text-to-video`);
                newTaskId = await generateVideoWithModel('kling-3.0', videoPrompt, kieKey, { aspectRatio: '16:9' });
                usedModel = 'kling-3.0';
                
                const displayMsg = `Your continuation video is being generated! This typically takes 2-5 minutes.\n\n**Prompt:** ${videoPrompt?.substring(0, 200)}`;
                fullContent += displayMsg;
                send({ type: 'delta', content: displayMsg });
              }
              
              const jobId = uuidv4();
              await db.collection('video_jobs').insertOne({
                id: jobId, task_id: newTaskId, user_id: user.id,
                conversation_id: convId, message_id: assistantMsgId,
                model_id: usedModel, model: usedModel,
                prompt: videoPrompt, status: 'generating',
                source_video_url: sourceVideoUrl, seed_image_url: seedImageUrl,
                created_at: new Date(),
              });
              
              send({
                type: 'video_task', taskId: newTaskId, status: 'generating',
                prompt: videoPrompt, messageId: assistantMsgId,
                videoModel: usedModel, videoModelLabel: seedImageUrl ? 'Video Extension (Image-to-Video)' : 'Continuation Video',
                videoModelReason: seedImageUrl ? 'Generating from the last frame of your uploaded video' : 'Generating a new continuation video from your prompt',
                sourceVideo: sourceVideoUrl,
              });
              
              await dbMessages.insertOne({
                id: assistantMsgId, conversation_id: convId, user_id: user.id,
                role: 'assistant', content: fullContent, created_at: new Date(),
                model_used: usedModel, provider_used: 'kie-ai', content_type: 'video',
                video_task: { taskId: newTaskId, status: 'generating', prompt: videoPrompt, videoModel: usedModel, videoModelLabel: seedImageUrl ? 'Video Extension (Image-to-Video)' : 'Continuation Video' },
                source_video_url: sourceVideoUrl, seed_image_url: seedImageUrl,
                est_input_tokens: Math.round(videoPrompt.length / 4), est_output_tokens: 0,
              });
              await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
              
              send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
              clearInterval(keepaliveInterval);
              controllerClosed = true; controller.close();
              return;
            } catch (fallbackErr) {
              console.error('[VideoExtend] Fallback generation failed:', fallbackErr.message);
              const errorMsg = `\n\n❌ Video generation failed: ${fallbackErr.message}\n\nPlease try again.`;
              fullContent += errorMsg;
              send({ type: 'delta', content: errorMsg });
              
              await dbMessages.insertOne({
                id: assistantMsgId, conversation_id: convId, user_id: user.id,
                role: 'assistant', content: fullContent, created_at: new Date(),
                model_used: 'system', provider_used: 'system', content_type: 'text',
              });
              await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
              
              send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
              clearInterval(keepaliveInterval);
              controllerClosed = true; controller.close();
              return;
            }
          }
          
          send({ type: 'delta', content: '🎬 Extending your video...\n\n' });
          fullContent = '🎬 Extending your video...\n\n';
          
          try {
            const kieKey = process.env.KIE_API_KEY;
            if (!kieKey) throw new Error('Video API not configured');
            
            const newTaskId = await extendVideo(extendTaskId, extendPrompt, kieKey);
            
            const extendDisplayMsg = `Your video is being extended! This typically takes 2-5 minutes.\n\n**Extension prompt:** ${extendPrompt?.substring(0, 200)}`;
            fullContent += extendDisplayMsg;
            send({ type: 'delta', content: extendDisplayMsg });
            
            // Store the extension job — use 'runway-extend' as a pseudo-model for status tracking
            const jobId = uuidv4();
            await db.collection('video_jobs').insertOne({
              id: jobId,
              task_id: newTaskId,
              user_id: user.id,
              conversation_id: convId,
              message_id: assistantMsgId,
              model_id: 'runway-extend',
              prompt: extendPrompt,
              status: 'generating',
              source_task_id: extendTaskId,
              source_video_url: sourceVideoUrl,
              created_at: new Date(),
            });
            
            // Send video_task event so frontend shows polling card
            send({
              type: 'video_task',
              taskId: newTaskId,
              status: 'generating',
              prompt: extendPrompt,
              messageId: assistantMsgId,
              videoModel: 'runway-extend',
              videoModelLabel: 'Video Extension',
              videoModelReason: 'Extending existing video with new content',
              sourceVideo: sourceVideoUrl,
            });
            
            // Save assistant message
            await dbMessages.insertOne({
              id: assistantMsgId, conversation_id: convId, user_id: user.id,
              role: 'assistant', content: fullContent, created_at: new Date(),
              model_used: 'runway-extend', provider_used: 'kie-ai', content_type: 'video',
              video_task: { taskId: newTaskId, status: 'generating', prompt: extendPrompt, videoModel: 'runway-extend', videoModelLabel: 'Video Extension' },
              source_video_url: sourceVideoUrl,
              est_input_tokens: Math.round(extendPrompt.length / 4), est_output_tokens: 0,
            });
            await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
            
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          } catch (extendErr) {
            console.error('[VideoExtend] Extension failed:', extendErr.message);
            const errorMsg = `\n\n❌ Video extension failed: ${extendErr.message}\n\nPlease try again or generate a new video instead.`;
            fullContent += errorMsg;
            send({ type: 'delta', content: errorMsg });
            
            await dbMessages.insertOne({
              id: assistantMsgId, conversation_id: convId, user_id: user.id,
              role: 'assistant', content: fullContent, created_at: new Date(),
              model_used: 'system', provider_used: 'system', content_type: 'text',
              est_input_tokens: 0, est_output_tokens: 0,
            });
            await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
            
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }
        }

        // ── Handle image generation ───────────────────────────────────────
        // Track whether a video_task has been sent in this stream to prevent double-triggering
        let streamVideoTaskSent = false;
        if (mediaIntent === 'image') {
          // GUARD: Check if an image was already generated for this message (prevents double generation)
          const existingImageMsg = await db.collection('messages').findOne({
            id: assistantMsgId, content_type: { $in: ['image', 'infographic', 'flyer'] }
          });
          if (existingImageMsg) {
            console.log(`[Image Generation] SKIPPING — image already generated for message ${assistantMsgId}`);
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }
          
          // Check if user has image attachments (reference photos)
          let imageAttachments = attachments.filter(a => 
            a.type === 'image' || a.type?.startsWith('image/') || 
            a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/')
          );
          
          // CONFIRMATION FLOW: If no direct attachments but mediaFlow has pre-uploaded reference URLs,
          // reconstruct synthetic image attachments so the reference image path is used
          if (imageAttachments.length === 0 && mediaFlow?.referenceImageUrls?.length > 0) {
            console.log(`[Image Generation] Restoring ${mediaFlow.referenceImageUrls.length} reference images from confirmation flow`);
            imageAttachments = mediaFlow.referenceImageUrls.map((url, idx) => ({
              type: 'image',
              base64: url,
              isUrlReference: true,
              name: `reference-${idx + 1}.jpg`,
              mimeType: 'image/jpeg',
            }));
          }
          
          const hasReferenceImages = imageAttachments.length > 0;
          
          // Detect if this is an infographic/flyer request and enhance the prompt
          const lowerContent = content.toLowerCase();
          const isInfographic = /\binfographic\b/i.test(lowerContent);
          const isFlyer = /\b(flyer|poster|banner|brochure)\b/i.test(lowerContent);
          
          // Dynamic model selection based on prompt content
          // If mediaFlow confirmed, use the user's selected model
          const effectiveImageModel = (mediaFlow?.selectedModel && mediaFlow.selectedModel !== 'smart') 
            ? mediaFlow.selectedModel 
            : userPreferredImageModel;
          const modelSelection = selectBestImageModel(content, effectiveImageModel);
          let selectedModelKey = modelSelection.model;
          let modelConfig = KIE_IMAGE_MODELS[selectedModelKey];
          
          // If selected model is unavailable, fall back to nano-banana
          if (!modelConfig || modelConfig.available === false) {
            console.log(`[Image Generation] Model ${selectedModelKey} unavailable, falling back to nano-banana`);
            selectedModelKey = 'nano-banana';
            modelConfig = KIE_IMAGE_MODELS['nano-banana'];
          }
          
          const modelDisplayName = selectedModelKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          
          console.log(`[Image Generation] Dynamic Intelligence selected: ${selectedModelKey} - ${modelSelection.reason}`);
          
          // Send visual generation event to frontend for immediate indicator
          const contentTypeForIndicator = isInfographic ? 'infographic' : (isFlyer ? 'flyer' : 'image');
          send({ type: 'generating_visual', visualType: contentTypeForIndicator });
          
          let displayMessage = `🎨 Generating your image with ${modelDisplayName}...\n\n`;
          let enhancedPrompt = mediaFlow?.finalPrompt || content;
          
          // If the request is very short (e.g., just "Image" or "generate the image"),
          // extract context from recent conversation to understand what to generate
          const isShortRequest = content.trim().split(/\s+/).length <= 5;
          if (isShortRequest && historyMessages.length > 0) {
            // Get recent assistant messages that might contain design descriptions
            const recentContext = historyMessages
              .filter(m => m.role === 'assistant')
              .slice(-3)
              .map(m => typeof m.content === 'string' ? m.content : '')
              .join('\n')
              .substring(0, 2000);
            
            if (recentContext) {
              console.log('[Image Generation] Short request detected, using conversation context');
              enhancedPrompt = `Based on our conversation, generate an image of what was discussed. Here's the context from our conversation:\n\n${recentContext}\n\nUser's request: ${content}\n\nCreate a high-quality, visually appealing image based on what was discussed.`;
            }
          }
          
          if (isInfographic) {
            displayMessage = `📊 Creating your professional infographic with ${modelDisplayName}...\n\n`;
            enhancedPrompt = `Create a stunning, professional infographic design. The infographic should have:
- A cohesive, modern color palette (3-5 colors maximum)
- Clear visual hierarchy with bold, impactful headlines
- Beautiful data visualization elements (icons, charts, statistics displayed prominently)
- Clean, organized sections with proper white space
- Professional typography with readable fonts
- Visual icons and illustrations representing key concepts
- A polished, designer-quality finish that looks like it was created by a professional graphic designer

CONTENT TO VISUALIZE:
${content}

Style: Modern, clean, professional infographic design. Make it visually stunning and engaging.`;
          } else if (isFlyer) {
            displayMessage = `🎨 Designing your professional flyer with ${modelDisplayName}...\n\n`;
            enhancedPrompt = `Create a stunning, professional promotional flyer/poster design. The design should have:
- Eye-catching visual composition using the rule of thirds
- Bold, attention-grabbing headline typography
- Strong visual hierarchy (most important info largest/boldest)
- Relevant, high-quality imagery that supports the message
- Professional color scheme that evokes the right mood
- Clear call-to-action that stands out
- Proper white space - not overcrowded
- All key information clearly visible (date, time, location if applicable)
- A polished, designer-quality finish

CONTENT TO DESIGN:
${content}

Style: Professional graphic design quality. Make it look like a skilled designer created it, NOT like a simple text document.`;
          }
          
          send({ type: 'delta', content: displayMessage });
          
          let imageUrl = null;
          let revisedPrompt = content;
          let usedModel = selectedModelKey;
          
          // ── SPELLING GUARD: Layer 1 — Enhance prompt with character-by-character spelling ──
          const { enhancedPrompt: spellingEnhancedPrompt, intendedTexts } = enhancePromptWithSpelling(enhancedPrompt);
          if (intendedTexts.length > 0) {
            enhancedPrompt = spellingEnhancedPrompt;
            send({ type: 'delta', content: `🔤 Detected text in prompt: ${intendedTexts.map(t => `"${t}"`).join(', ')} — applying spelling guard...\n` });
          }
          
          // ── CONTENT MODERATION: Block prohibited image prompts ──
          const imageModResult = moderateContent(enhancedPrompt, 'image');
          if (imageModResult.severity === SEVERITY.BLOCK) {
            console.log(`[Image Moderation] BLOCKED user=${user.id} category=${imageModResult.category}`);
            send({ type: 'delta', content: `\n\n${imageModResult.message}\n` });
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }
          
          // ── Detect aspect ratio from user prompt for highest quality output ──
          const detectedImageAspectRatio = detectAspectRatioFromPrompt(content) || '1:1';
          console.log(`[Image Generation] Detected aspect ratio: ${detectedImageAspectRatio}`);
          
          // Map aspect ratio to highest resolution sizes per model type
          const openaiSizeMap = {
            '1:1': '1024x1024',
            '16:9': '1792x1024',
            '9:16': '1024x1792',
            '4:3': '1792x1024',   // DALL-E 3 doesn't have 4:3, use landscape
            '3:4': '1024x1792',   // portrait-ish → use portrait
          };
          const gptImage1SizeMap = {
            '1:1': '1024x1024',
            '16:9': '1536x1024',
            '9:16': '1024x1536',
            '4:3': '1536x1024',
            '3:4': '1024x1536',
          };
          const dalleSize = openaiSizeMap[detectedImageAspectRatio] || '1792x1024';
          const gptImageSize = gptImage1SizeMap[detectedImageAspectRatio] || '1536x1024';
          
          try {
            const kieKey = process.env.KIE_API_KEY;
            const openaiApiKey = process.env.OPENAI_API_KEY;
            
            // ── REFERENCE IMAGE PATH: Use gpt-image-1 when user has reference images ──
            if (hasReferenceImages && openaiApiKey) {
              console.log(`[Image Generation] User has ${imageAttachments.length} reference image(s), using gpt-image-1 for reference-aware generation`);
              usedModel = 'gpt-image-1';
              
              try {
                const OpenAI = (await import('openai')).default;
                const { toFile } = await import('openai/uploads');
                const openai = new OpenAI({ apiKey: openaiApiKey });
                
                // Prepare reference images
                const imageFiles = [];
                for (let i = 0; i < Math.min(imageAttachments.length, 3); i++) {
                  const att = imageAttachments[i];
                  let imageBuffer;
                  
                  if (att.isUrlReference && att.base64?.startsWith('http')) {
                    // URL reference from confirmation flow — download it
                    console.log(`[Image Generation] Downloading reference image ${i + 1} from URL:`, att.base64.substring(0, 80));
                    const resp = await fetch(att.base64, { signal: AbortSignal.timeout(20000) });
                    if (resp.ok) {
                      imageBuffer = Buffer.from(await resp.arrayBuffer());
                    }
                  } else if (att.base64?.startsWith('attachment://')) {
                    // Resolve from MongoDB temp storage
                    const attId = att.base64.replace('attachment://', '');
                    try {
                      const attDoc = await db.collection('temp_attachments').findOne({ id: attId });
                      if (attDoc) {
                        imageBuffer = Buffer.from(attDoc.base64, 'base64');
                      }
                    } catch (e) {
                      console.warn(`[Image Generation] Failed to resolve attachment://${attId}:`, e.message);
                    }
                  } else if (att.base64) {
                    const base64Data = att.base64.replace(/^data:[^;]+;base64,/, '');
                    imageBuffer = Buffer.from(base64Data, 'base64');
                  } else if (att.url) {
                    const resp = await fetch(att.url, { signal: AbortSignal.timeout(15000) });
                    imageBuffer = Buffer.from(await resp.arrayBuffer());
                  }
                  
                  if (imageBuffer) {
                    const mimeType = att.mimeType || att.mime_type || 'image/png';
                    const file = await toFile(imageBuffer, `ref_${i}.png`, { type: mimeType });
                    imageFiles.push(file);
                  }
                }
                
                if (imageFiles.length > 0) {
                  console.log(`[Image Generation] Prepared ${imageFiles.length} reference image(s), calling gpt-image-1 edit...`);
                  
                  // When multiple images are attached, use GPT-4o Vision to understand what's in each
                  // so we can build a precise composite prompt
                  let compositeContext = '';
                  if (imageFiles.length >= 2 && openaiApiKey) {
                    try {
                      console.log('[Image Generation] Analyzing reference images with GPT-4o Vision for composite...');
                      send({ type: 'delta', content: '🔍 Analyzing your uploaded images...\n' });
                      
                      const visionContent = [
                        { type: 'text', text: `The user uploaded ${imageFiles.length} reference images and wants to create a SINGLE composite image that includes ALL of them. Their request: "${content}"

IMPORTANT: You MUST describe EACH image in detail — name, visual style, colors, key features. Then describe EXACTLY how ALL ${imageFiles.length} images should be combined together. Every single reference image MUST appear in the final composite. Number each image as "Image 1:", "Image 2:", etc.` }
                      ];
                      
                      for (let i = 0; i < imageAttachments.length; i++) {
                        const att = imageAttachments[i];
                        if (att.base64) {
                          const b64 = att.base64;
                          // Handle URL references (from frontend pre-upload or confirmation flow)
                          if (b64.startsWith('http://') || b64.startsWith('https://')) {
                            visionContent.push({ type: 'image_url', image_url: { url: b64, detail: 'low' } });
                          } else if (b64.startsWith('data:')) {
                            visionContent.push({ type: 'image_url', image_url: { url: b64, detail: 'low' } });
                          } else {
                            const dataUrl = `data:${att.mimeType || 'image/png'};base64,${b64}`;
                            visionContent.push({ type: 'image_url', image_url: { url: dataUrl, detail: 'low' } });
                          }
                        }
                      }
                      
                      const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
                        body: JSON.stringify({
                          model: 'gpt-4o',
                          messages: [{ role: 'user', content: visionContent }],
                          max_tokens: 500,
                          temperature: 0.3,
                        }),
                      });
                      
                      if (visionRes.ok) {
                        const visionData = await visionRes.json();
                        compositeContext = visionData.choices?.[0]?.message?.content || '';
                        console.log('[Image Generation] Vision context:', compositeContext.substring(0, 200));
                      }
                    } catch (visionErr) {
                      console.log('[Image Generation] Vision analysis failed:', visionErr.message);
                    }
                  }
                  
                  // Build a strong composite-aware prompt
                  const compositePrompt = imageFiles.length >= 2
                    ? `CRITICAL INSTRUCTION: You MUST incorporate ALL ${imageFiles.length} attached reference images into this single composite image. Every single reference image MUST appear as a recognizable element in the final output.

${compositeContext ? `Image analysis (every element described below MUST appear):\n${compositeContext}\n\n` : ''}User's request: ${enhancedPrompt}

MANDATORY RULES:
- You have ${imageFiles.length} reference images. EVERY SINGLE ONE must appear in the final composite
- Reference Image 1, Reference Image 2${imageFiles.length >= 3 ? ', Reference Image 3' : ''}${imageFiles.length >= 4 ? ', Reference Image 4' : ''} — ALL must be visually present
- Preserve the EXACT art style, colors, proportions, and visual identity of each reference
- Do NOT reimagine, redraw, or reinterpret — use the original visual elements AS-IS
- Compose these elements together in a natural scene as the user described
- If a reference is a character, that exact character must appear
- If a reference is a logo/badge, that exact logo/badge must appear
- If a reference is a vehicle/object, that exact vehicle/object must appear
- The final image should look like a professional composite of ALL the actual reference images`
                    : `Using the attached reference image as visual context and base, create a new image that PRESERVES the exact visual elements from the reference: ${enhancedPrompt}`;
                  
                  const editResult = await openai.images.edit({
                    model: 'gpt-image-1',
                    image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
                    prompt: compositePrompt,
                    n: 1,
                    size: gptImageSize,
                    quality: 'high',
                  });
                  
                  if (editResult.data?.[0]) {
                    if (editResult.data[0].b64_json) {
                      // Upload base64 to persistent storage
                      if (kieKey) {
                        const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                          body: JSON.stringify({
                            base64Data: `data:image/png;base64,${editResult.data[0].b64_json}`,
                            uploadPath: 'soulprint/generated',
                            fileName: `gen_ref_${Date.now()}.png`
                          }),
                        });
                        const upData = await upRes.json();
                        if (upData.success && upData.data?.downloadUrl) {
                          imageUrl = upData.data.downloadUrl;
                        }
                      }
                      // Fallback: use data URL
                      if (!imageUrl) {
                        imageUrl = `data:image/png;base64,${editResult.data[0].b64_json}`;
                      }
                    } else if (editResult.data[0].url) {
                      // OpenAI URLs are TEMPORARY — download and persist
                      const tempUrl = editResult.data[0].url;
                      console.log('[Image Generation] Got temporary OpenAI URL, persisting...');
                      if (kieKey) {
                        try {
                          const dlResp = await fetch(tempUrl, { signal: AbortSignal.timeout(30000) });
                          if (dlResp.ok) {
                            const dlBuffer = Buffer.from(await dlResp.arrayBuffer());
                            const dlBase64 = dlBuffer.toString('base64');
                            const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                              body: JSON.stringify({
                                base64Data: `data:image/png;base64,${dlBase64}`,
                                uploadPath: 'soulprint/generated',
                                fileName: `gen_ref_${Date.now()}.png`
                              }),
                            });
                            const upData = await upRes.json();
                            if (upData.success && upData.data?.downloadUrl) {
                              imageUrl = upData.data.downloadUrl;
                              console.log('[Image Generation] Persisted to:', imageUrl.substring(0, 80));
                            }
                          }
                        } catch (persistErr) {
                          console.log('[Image Generation] Persist failed:', persistErr.message);
                        }
                      }
                      if (!imageUrl) imageUrl = tempUrl; // Last resort
                    }
                    
                    if (imageUrl) {
                      console.log(`[Image Generation] gpt-image-1 reference generation success!`);
                      revisedPrompt = editResult.data[0].revised_prompt || content;
                    }
                  }
                }
              } catch (refErr) {
                console.log('[Image Generation] gpt-image-1 reference path failed:', refErr.message, '- falling back to text-only generation');
              }
            }
            
            // ── PRIMARY: Use Kie.ai with dynamically selected model (text-only) ──
            if (!imageUrl && kieKey && modelConfig) {
              console.log(`[Image Generation] Using Kie.ai model: ${modelConfig.model} for prompt:`, enhancedPrompt.substring(0, 150));
              
              const inputParams = modelConfig.formatInput 
                ? modelConfig.formatInput(enhancedPrompt, detectedImageAspectRatio) 
                : { prompt: enhancedPrompt, image_size: 'square_hd' };
              
              const requestBody = {
                model: modelConfig.model,
                input: inputParams,
              };
              
              const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': `Bearer ${kieKey}` 
                },
                body: JSON.stringify(requestBody),
              });
              
              const createData = await createRes.json();
              
              if (createData.code === 200 && createData.data?.taskId) {
                const taskId = createData.data.taskId;
                console.log(`[Image Generation] Kie.ai task created: ${taskId}, polling...`);
                
                // Poll for result
                const startTime = Date.now();
                const maxWaitTime = 90000; // 90s timeout
                let attempts = 0;
                
                while (Date.now() - startTime < maxWaitTime) {
                  await new Promise(r => setTimeout(r, 3000));
                  attempts++;
                  
                  const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                    headers: { 'Authorization': `Bearer ${kieKey}` },
                  });
                  const statusData = await statusRes.json();
                  
                  if (statusData.code === 200) {
                    const state = statusData.data?.state;
                    
                    if (state === 'success') {
                      try {
                        const resultJson = JSON.parse(statusData.data?.resultJson || '{}');
                        imageUrl = resultJson?.resultUrls?.[0] || resultJson?.url || resultJson?.image_url || resultJson?.images?.[0];
                      } catch (e) {
                        console.error('[Image Generation] Failed to parse resultJson:', e);
                      }
                      break;
                    } else if (state === 'fail') {
                      console.log('[Image Generation] Kie.ai task failed:', statusData.data?.failMsg);
                      break;
                    }
                    // Still processing - continue polling
                  }
                }
                
                if (imageUrl) {
                  console.log(`[Image Generation] Success with ${selectedModelKey}! URL:`, imageUrl.substring(0, 80));
                }
              } else {
                console.log('[Image Generation] Kie.ai createTask failed:', createData.msg || createData.code);
              }
            }
            
            // ── FALLBACK: Use DALL-E 3 if Kie.ai failed or unavailable ──
            if (!imageUrl && openaiApiKey) {
              console.log('[Image Generation] Falling back to DALL-E 3');
              usedModel = 'dall-e-3';
              
              const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiApiKey}` },
                body: JSON.stringify({ model: 'dall-e-3', prompt: enhancedPrompt, n: 1, size: dalleSize, quality: 'hd', style: 'vivid' }),
              });
              
              const imgData = await imgRes.json();
              
              if (!imgRes.ok) {
                throw new Error(imgData.error?.message || `DALL-E 3 API returned status ${imgRes.status}`);
              }
              
              imageUrl = imgData.data?.[0]?.url;
              revisedPrompt = imgData.data?.[0]?.revised_prompt || content;
            }
            
            if (!imageUrl) {
              throw new Error('No image generation API available or all methods failed');
            }
            
            console.log(`[Image Generation] Final success with ${usedModel}! URL:`, imageUrl.substring(0, 80) + '...');
            
            // ── Persist image to permanent storage ──
            // DALL-E URLs expire in ~2 hours, and tempfile.aiquickdraw.com URLs may also expire.
            // Re-upload ALL externally-hosted images to our own storage for durability.
            const needsPersistence = 
              imageUrl.includes('oaidalleapiprodscus') || 
              imageUrl.includes('openai.com') || 
              imageUrl.includes('blob.core.windows.net') ||
              imageUrl.includes('tempfile.aiquickdraw.com');
              
            if (needsPersistence) {
              const persistKieKey = process.env.KIE_API_KEY;
              if (persistKieKey) {
                try {
                  console.log('[Image Persistence] Fetching image for re-upload:', imageUrl.substring(0, 80));
                  const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
                  if (imgResp.ok) {
                    const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                    const fileSizeMB = (imgBuf.length / (1024 * 1024)).toFixed(2);
                    console.log(`[Image Persistence] Image fetched: ${fileSizeMB}MB`);
                    
                    // Skip re-upload for very large images (>20MB base64 would be ~27MB+ JSON body)
                    if (imgBuf.length > 20 * 1024 * 1024) {
                      console.log('[Image Persistence] Image too large for re-upload, using original URL');
                    } else {
                      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${persistKieKey}` },
                        body: JSON.stringify({
                          base64Data: `data:image/png;base64,${imgBuf.toString('base64')}`,
                          uploadPath: 'soulprint/generated',
                          fileName: `gen_${Date.now()}.png`
                        }),
                      });
                      if (upRes.ok) {
                        const upData = await upRes.json();
                        if (upData.success && upData.data?.downloadUrl) {
                          console.log('[Image Persistence] Persisted to:', upData.data.downloadUrl);
                          imageUrl = upData.data.downloadUrl; // Use persistent URL
                        } else {
                          console.warn('[Image Persistence] Upload response not successful:', JSON.stringify(upData).substring(0, 200));
                        }
                      } else {
                        console.warn('[Image Persistence] Upload HTTP error:', upRes.status, await upRes.text().catch(() => ''));
                      }
                    }
                  } else {
                    console.warn('[Image Persistence] Could not fetch image:', imgResp.status);
                  }
                } catch (persistErr) {
                  console.warn('[Image Persistence] Failed:', persistErr.message, '— using original URL');
                }
              }
            }

            // Customize the output message based on content type
            const contentTypeLabel = isInfographic ? 'infographic' : (isFlyer ? 'flyer' : 'image');
            const successEmoji = isInfographic ? '📊' : (isFlyer ? '🎨' : '🖼️');
            
            // ── SPELLING GUARD: Layer 2 — OCR Validation + Auto-Retry ──
            if (imageUrl && intendedTexts.length > 0) {
              const openaiKey = process.env.OPENAI_API_KEY;
              const MAX_SPELLING_RETRIES = 2;
              
              for (let retryAttempt = 0; retryAttempt < MAX_SPELLING_RETRIES; retryAttempt++) {
                send({ type: 'delta', content: `\n🔍 Verifying text spelling (check ${retryAttempt + 1}/${MAX_SPELLING_RETRIES})...\n` });
                
                const validation = await validateImageText(imageUrl, intendedTexts, openaiKey);
                
                if (validation.valid) {
                  console.log(`[SpellingGuard] ✅ OCR validation passed on attempt ${retryAttempt + 1}`);
                  send({ type: 'delta', content: '✅ Text spelling verified!\n' });
                  break;
                }
                
                if (retryAttempt < MAX_SPELLING_RETRIES - 1) {
                  console.log(`[SpellingGuard] ❌ OCR found errors, retrying (attempt ${retryAttempt + 2})...`);
                  send({ type: 'delta', content: `⚠️ Spelling issue detected: ${validation.errors[0]}. Regenerating...\n` });
                  
                  const retryPrompt = buildRetryPrompt(enhancedPrompt, intendedTexts, validation.errors);
                  
                  // Retry with gpt-image-1 (best for text rendering)
                  try {
                    const OpenAI = (await import('openai')).default;
                    const openai = new OpenAI({ apiKey: openaiKey });
                    const gptSizeMap = { '1:1': '1024x1024', '16:9': '1536x1024', '9:16': '1024x1536', '4:3': '1536x1024', '3:4': '1024x1536' };
                    const retrySize = gptSizeMap[detectedImageAspectRatio] || '1024x1024';
                    
                    const retryResult = await openai.images.generate({
                      model: 'gpt-image-1',
                      prompt: retryPrompt,
                      n: 1,
                      size: retrySize,
                      quality: 'high',
                    });
                    
                    if (retryResult.data?.[0]) {
                      let retryUrl = null;
                      const kieKey = process.env.KIE_API_KEY;
                      
                      if (retryResult.data[0].b64_json && kieKey) {
                        const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                          body: JSON.stringify({
                            base64Data: `data:image/png;base64,${retryResult.data[0].b64_json}`,
                            uploadPath: 'soulprint/generated',
                            fileName: `spelling_retry_${Date.now()}.png`
                          }),
                        });
                        const upData = await upRes.json();
                        if (upData.success && upData.data?.downloadUrl) {
                          retryUrl = upData.data.downloadUrl;
                        }
                      } else if (retryResult.data[0].url) {
                        // Persist temporary URL
                        const tempUrl = retryResult.data[0].url;
                        if (kieKey) {
                          try {
                            const dlResp = await fetch(tempUrl, { signal: AbortSignal.timeout(30000) });
                            if (dlResp.ok) {
                              const dlBuffer = Buffer.from(await dlResp.arrayBuffer());
                              const dlBase64 = dlBuffer.toString('base64');
                              const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                                body: JSON.stringify({
                                  base64Data: `data:image/png;base64,${dlBase64}`,
                                  uploadPath: 'soulprint/generated',
                                  fileName: `spelling_retry_${Date.now()}.png`
                                }),
                              });
                              const upData = await upRes.json();
                              if (upData.success && upData.data?.downloadUrl) retryUrl = upData.data.downloadUrl;
                            }
                          } catch (e) { /* ignore persist error */ }
                        }
                        if (!retryUrl) retryUrl = tempUrl;
                      }
                      
                      if (retryUrl) {
                        imageUrl = retryUrl;
                        usedModel = 'gpt-image-1';
                        console.log(`[SpellingGuard] Retry ${retryAttempt + 2} generated new image`);
                      }
                    }
                  } catch (retryErr) {
                    console.log('[SpellingGuard] Retry generation failed:', retryErr.message);
                    break; // Don't keep retrying if generation itself fails
                  }
                } else {
                  console.log('[SpellingGuard] Max retries reached, using best available result');
                  send({ type: 'delta', content: '⚠️ Text may have minor imperfections — best result selected.\n' });
                }
              }
            }
            
            fullContent = `![Generated ${contentTypeLabel.charAt(0).toUpperCase() + contentTypeLabel.slice(1)}](${imageUrl})\n\n${successEmoji} *Your ${contentTypeLabel} has been created!*`;
            send({ type: 'image', url: imageUrl, revised_prompt: revisedPrompt, contentType: contentTypeLabel });
            send({ type: 'delta', content: fullContent });
          } catch (imgErr) {
            console.error('[Image Generation] Exception:', imgErr.message, imgErr.stack);
            fullContent = `Sorry, image generation failed: ${imgErr.message}`;
            send({ type: 'delta', content: fullContent });
            imageUrl = null; // Ensure we don't save a broken URL
          }
          // Save message - use 'text' content_type if generation failed (no image URL)
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          const desiredContentType = isInfographic ? 'infographic' : (isFlyer ? 'flyer' : 'image');
          const storedContentType = imageUrl ? desiredContentType : 'text'; // Don't save as 'image' if no URL
          const extractedImageUrl = fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined;
          await dbMessages.insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: usedModel, provider_used: usedModel === 'dall-e-3' ? 'openai' : 'kie-ai', content_type: storedContentType,
            image_url: extractedImageUrl,
            est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
          });
          await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          controllerClosed = true; controller.close();
          return;
        }

        // ── Handle video generation (text-to-video OR image-to-video with optional character reference) ───────────────────────────────────────
        if (mediaIntent === 'video') {
          // GUARD 1: Check if a video task was already created for this exact message (prevents double generation)
          const existingVideoTask = await db.collection('video_jobs').findOne({
            message_id: assistantMsgId, status: { $in: ['generating', 'processing', 'success'] }
          });
          if (existingVideoTask) {
            console.log(`[Video] SKIPPING — video task already exists for message ${assistantMsgId}:`, existingVideoTask.task_id);
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }
          
          // GUARD 2: Check if a video was generated for this conversation very recently (within 60 seconds)
          // This catches race conditions where two requests come in near-simultaneously
          // Video generation takes 1-5 min, so no legitimate need for two within 60s
          const recentVideoJob = await db.collection('video_jobs').findOne({
            conversation_id: convId,
            user_id: user.id,
            status: { $in: ['generating', 'processing'] },
            created_at: { $gte: new Date(Date.now() - 60000) }
          });
          if (recentVideoJob) {
            console.log(`[Video] SKIPPING — recent video job already generating for conversation ${convId}:`, recentVideoJob.task_id);
            // Show the existing video task instead of creating a duplicate
            send({ type: 'delta', content: 'Your video is already being generated! Check the progress above.' });
            send({
              type: 'video_task', taskId: recentVideoJob.task_id, status: 'generating',
              prompt: recentVideoJob.prompt, model: recentVideoJob.model, videoModel: recentVideoJob.model,
            });
            send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
            clearInterval(keepaliveInterval);
            controllerClosed = true; controller.close();
            return;
          }
          
          // Override video model preference if mediaFlow confirmed
          const effectiveVideoModel = (mediaFlow?.selectedModel && mediaFlow.selectedModel !== 'smart') 
            ? mediaFlow.selectedModel 
            : userPreferredVideoModel;
          const effectiveVideoPrompt = mediaFlow?.finalPrompt || content;
          
          // Send visual generation indicator immediately so frontend shows animation
          send({ type: 'generating_visual', visualType: 'video' });
          
          // Detect aspect ratio from prompt (e.g., "portrait", "9:16", "vertical")
          const detectedAspectRatio = detectAspectRatioFromPrompt(content) || '16:9';
          console.log(`[Video] Detected aspect ratio: ${detectedAspectRatio} from prompt`);
          
          // Check for image attachments - could be scene image AND/OR character reference images
          const allImageAttachments = attachments.filter(a => a.type === 'image' || a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/'));
          let imageAttachment = allImageAttachments[0]; // First image is for scene/animation
          
          // CONFIRMATION FLOW: If no direct attachment but mediaFlow has a pre-uploaded sourceImageUrl,
          // use it as the image for image-to-video generation
          if (!imageAttachment && mediaFlow?.sourceImageUrl) {
            console.log('[Video] Using pre-uploaded source image from confirmation flow:', mediaFlow.sourceImageUrl.substring(0, 80));
            send({ type: 'delta', content: '🎬 Using your uploaded image as the source...\n\n' });
            imageAttachment = {
              type: 'image',
              base64: mediaFlow.sourceImageUrl,
              isUrlReference: true,
              name: 'confirmed-source-image.jpg',
              mimeType: 'image/jpeg',
            };
          }
          
          // AUTO-CONTEXT: If no image attached but conversation has a recent image, 
          // and user's prompt references it (e.g., "make a video of the car driving"),
          // automatically use the conversation's last image as source
          if (!imageAttachment && lastImageUrlInConversation && detectContextImageReference(content)) {
            console.log('[Video] Auto-context: Using last conversation image as source:', lastImageUrlInConversation.substring(0, 80));
            send({ type: 'delta', content: '🎬 Using your recently generated image as the source...\n\n' });
            imageAttachment = {
              type: 'image',
              base64: lastImageUrlInConversation,
              isUrlReference: true,
              name: 'context-image.jpg',
              mimeType: 'image/jpeg',
            };
          }
          
          // Detect if user wants to add themselves or a person to the video
          const wantsCharacterReference = /\b(me|myself|my face|my photo|person|character|subject|face|with me|of me|add me|put me|include me|myself driving|me driving|me in|myself in)\b/i.test(content);
          
          // If user mentions character reference but only provided one image, use it as character reference for text-to-video
          const useAsCharacterRef = wantsCharacterReference && allImageAttachments.length === 1 && !imageAttachment?.isUrlReference;
          
          if (imageAttachment && (imageAttachment.base64 || imageAttachment.isUrlReference) && !useAsCharacterRef) {
            // IMAGE-TO-VIDEO: Animate the uploaded image (with optional character reference)
            send({ type: 'delta', content: '🎬 Preparing your image for animation...\n\n' });
            try {
              const kieKey = process.env.KIE_API_KEY;
              if (!kieKey) throw new Error('Video API not configured');
              
              let imageUrl = null;
              
              // Check if this is a URL reference (from regeneration) or needs upload
              if (imageAttachment.isUrlReference && imageAttachment.base64?.startsWith('http')) {
                // Already a URL - use directly (from "Try Different Model" regeneration)
                imageUrl = imageAttachment.base64;
                console.log('[Image-to-Video] Using existing URL for regeneration:', imageUrl.substring(0, 80));
              } else {
                console.log('[Image-to-Video] Starting - uploading image first...');
                
                // Step 1: Try to upload the base64 image to Kie.ai to get a URL
                // If upload fails, we'll try using the data URL directly (some providers accept it)
                const mType = imageAttachment.mimeType || imageAttachment.mime_type || 'image/jpeg';
                const fileName = imageAttachment.name || `image-${Date.now()}.${mType.split('/')[1] || 'jpg'}`;
                const dataUrl = imageAttachment.base64.startsWith('data:') 
                  ? imageAttachment.base64 
                  : `data:${mType};base64,${imageAttachment.base64}`;
                
                // Try uploading to Kie.ai file upload service
                try {
                  const uploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                    body: JSON.stringify({
                      base64Data: dataUrl, // Correct parameter name per Kie.ai docs
                      uploadPath: 'soulprint/image-to-video',
                      fileName: fileName,
                    }),
                  });
                  
                  if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    console.log('[Image-to-Video] Upload response:', JSON.stringify(uploadData).substring(0, 500));
                    const downloadUrl = uploadData.data?.downloadUrl || uploadData.downloadUrl;
                    if ((uploadData.success || uploadData.code === 200) && downloadUrl) {
                      imageUrl = downloadUrl;
                      console.log('[Image-to-Video] Got uploaded image URL:', imageUrl.substring(0, 80));
                    } else {
                      console.log('[Image-to-Video] Upload response missing downloadUrl');
                    }
                  } else {
                    const errText = await uploadRes.text().catch(() => 'unknown');
                    console.log('[Image-to-Video] Upload HTTP error:', uploadRes.status, errText.substring(0, 200));
                  }
                } catch (uploadErr) {
                  console.log('[Image-to-Video] Upload failed:', uploadErr.message);
                }
              } // End of else block for base64 upload
              
              // If upload failed, throw an error — Kie.ai video API requires an HTTP URL
              if (!imageUrl) {
                throw new Error('Failed to upload image for video generation. Please try again.');
              }
              
              console.log('[Image-to-Video] Final image URL type:', imageUrl.startsWith('data:') ? 'data URL' : 'http URL');
              
              // ── SPELLING GUARD FOR VIDEO: Extract text and create clean animation source ──
              let originalTextElements = null;
              let videoSourceImageUrl = imageUrl; // The image we'll actually send to the video model
              const openaiKey = process.env.OPENAI_API_KEY;
              
              if (openaiKey) {
                const textData = await extractTextFromImage(imageUrl, openaiKey);
                
                if (textData.hasText && textData.textElements.length > 0) {
                  originalTextElements = textData.textElements;
                  const textList = textData.textElements.map(t => `"${t.text}"`).join(', ');
                  send({ type: 'delta', content: `🔤 Detected text in image: ${textList}\n` });
                  send({ type: 'delta', content: '🧹 Creating text-free version for cleaner animation...\n' });
                  
                  // Create a text-free version for video animation
                  const cleanResult = await removeTextFromImage(imageUrl, textData.textElements, openaiKey);
                  
                  if (cleanResult?.base64) {
                    // Upload the clean image
                    try {
                      const cleanUploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                        body: JSON.stringify({
                          base64Data: `data:image/${cleanResult.format};base64,${cleanResult.base64}`,
                          uploadPath: 'soulprint/image-to-video',
                          fileName: `clean_${Date.now()}.png`,
                        }),
                      });
                      if (cleanUploadRes.ok) {
                        const cleanUploadData = await cleanUploadRes.json();
                        const cleanUrl = cleanUploadData.data?.downloadUrl || cleanUploadData.downloadUrl;
                        if ((cleanUploadData.success || cleanUploadData.code === 200) && cleanUrl) {
                          videoSourceImageUrl = cleanUrl;
                          console.log('[SpellingGuard:Video] Using text-free image for animation:', cleanUrl.substring(0, 80));
                          send({ type: 'delta', content: '✅ Clean image ready — text will be overlaid after animation\n\n' });
                        }
                      }
                    } catch (cleanUpErr) {
                      console.log('[SpellingGuard:Video] Clean image upload failed:', cleanUpErr.message);
                    }
                  } else {
                    send({ type: 'delta', content: '⚠️ Could not create text-free version — animating with text (may have artifacts)\n\n' });
                  }
                }
              }
              
              // ── Dynamic Video Intelligence: select the best model ──
              // Clean the prompt of model instruction prefix
              let cleanedPrompt = extractPromptWithoutModelInstruction(content) || 'Animate this image';
              
              // ── SPELLING GUARD: Enhance video prompt with text preservation instructions ──
              if (originalTextElements && originalTextElements.length > 0) {
                const textList = originalTextElements.map(t => `"${t.text}"`).join(', ');
                cleanedPrompt += `\n\nIMPORTANT: The source image originally contained the following text: ${textList}. Keep any remaining text elements perfectly legible and correctly spelled during animation. Do NOT distort, blur, or morph any text.`;
              } else {
                // Even without pre-extraction, add general text preservation instruction
                const { intendedTexts: videoIntendedTexts } = enhancePromptWithSpelling(cleanedPrompt);
                if (videoIntendedTexts.length > 0) {
                  cleanedPrompt += `\n\nIMPORTANT: Preserve all text perfectly during animation. Text must remain correctly spelled: ${videoIntendedTexts.map(t => `"${t}"`).join(', ')}. Do NOT distort or morph any text.`;
                }
              }
              const videoSelection = await selectVideoModel(content || 'Animate this image', { hasImage: true, userPreferredModel: userPreferredVideoModel });
              const selectedVideoModel = videoSelection.model;
              const videoModelLabel = VIDEO_MODELS[selectedVideoModel].label;
              send({ type: 'delta', content: `🎬 Animating your image with ${videoModelLabel}...\n\n` });
              console.log(`[Image-to-Video] Dynamic Intelligence selected: ${selectedVideoModel} — ${videoSelection.reason}`);
              
              // Step 2: Create video generation task via unified handler
              const taskId = await generateVideoWithModel(selectedVideoModel, cleanedPrompt || 'Animate this image with natural, smooth motion', kieKey, {
                imageUrls: [videoSourceImageUrl],
                aspectRatio: detectedAspectRatio,
                duration: 5,
              });

              // Save job to DB
              await db.collection('video_jobs').insertOne({
                id: uuidv4(), task_id: taskId, user_id: user.id,
                prompt: content, source_image: imageUrl,
                duration: 5, quality: VIDEO_MODELS[selectedVideoModel].resolution, aspect_ratio: detectedAspectRatio,
                status: 'generating', conversation_id: convId, model: selectedVideoModel,
                message_id: assistantMsgId, type: 'image-to-video',
                text_overlay_elements: originalTextElements || null,
                original_source_image: imageUrl,
                clean_source_image: videoSourceImageUrl !== imageUrl ? videoSourceImageUrl : null,
                created_at: new Date(), expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              });

              fullContent = `🎬 **Animating your image!**\n\n![Source Image](${imageUrl})\n\n${videoModelLabel} is bringing your image to life. This usually takes 1-3 minutes.\n\n*Instructions: ${content || 'Natural animation'}*`;
              send({ type: 'video_task', taskId, status: 'generating', prompt: content, sourceImage: imageUrl, messageId: assistantMsgId, videoModel: selectedVideoModel, videoModelLabel, videoModelReason: videoSelection.reason });
              streamVideoTaskSent = true;
              send({ type: 'delta', content: fullContent });
              
              // Save message
              const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
              const videoTaskData = { taskId, status: 'generating', prompt: content, sourceImage: imageUrl, model: selectedVideoModel };
              await dbMessages.insertOne({
                id: assistantMsgId, conversation_id: convId, user_id: user.id,
                role: 'assistant', content: fullContent, created_at: new Date(),
                model_used: selectedVideoModel, provider_used: 'kie.ai', content_type: 'video',
                video_task: videoTaskData, source_image: imageUrl,
                model_label: videoModelLabel, video_model_reason: videoSelection.reason,
                est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
              });
              await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
              
              send({ type: 'done', messageId: assistantMsgId });
              controllerClosed = true; controller.close();
              return;
            } catch (vidErr) {
              console.error('[Image-to-Video] Error:', vidErr);
              fullContent = `Sorry, I couldn't animate your image: ${vidErr.message}`;
              send({ type: 'delta', content: fullContent });
            }
          } else if (imageAttachment && !imageAttachment.base64) {
            // Image attachment exists but no base64 data - maybe it has a URL?
            send({ type: 'delta', content: '🎬 Starting video generation with your image...\n\n' });
            try {
              const kieKey = process.env.KIE_API_KEY;
              if (!kieKey) throw new Error('Video API not configured');
              
              const imageUrl = imageAttachment.url;
              if (!imageUrl) throw new Error('Image URL not found');
              
              console.log('[Image-to-Video] Using existing image URL:', imageUrl.substring(0, 80));
              
              // ── Dynamic Video Intelligence ──
              const videoSelection2 = await selectVideoModel(content || 'Animate this image', { hasImage: true, userPreferredModel: userPreferredVideoModel });
              const selectedVideoModel2 = videoSelection2.model;
              const videoModelLabel2 = VIDEO_MODELS[selectedVideoModel2].label;
              console.log(`[Image-to-Video] Dynamic Intelligence selected: ${selectedVideoModel2} — ${videoSelection2.reason}`);

              const taskId = await generateVideoWithModel(selectedVideoModel2, content || 'Animate this image with natural, smooth motion', kieKey, {
                imageUrls: [imageUrl],
                aspectRatio: detectedAspectRatio,
                duration: 5,
              });
              
              await db.collection('video_jobs').insertOne({
                id: uuidv4(), task_id: taskId, user_id: user.id,
                prompt: content, source_image: imageUrl,
                duration: 5, quality: VIDEO_MODELS[selectedVideoModel2].resolution, aspect_ratio: detectedAspectRatio,
                status: 'generating', conversation_id: convId, model: selectedVideoModel2,
                message_id: assistantMsgId, type: 'image-to-video',
                created_at: new Date(), expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              });

              fullContent = `🎬 **Animating your image!**\n\n![Source Image](${imageUrl})\n\n${videoModelLabel2} is bringing your image to life. This usually takes 1-3 minutes.`;
              send({ type: 'video_task', taskId, status: 'generating', prompt: content, sourceImage: imageUrl, messageId: assistantMsgId, videoModel: selectedVideoModel2, videoModelLabel: videoModelLabel2, videoModelReason: videoSelection2.reason });
              streamVideoTaskSent = true;
              send({ type: 'delta', content: fullContent });
              
              const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
              await dbMessages.insertOne({
                id: assistantMsgId, conversation_id: convId, user_id: user.id,
                role: 'assistant', content: fullContent, created_at: new Date(),
                model_used: selectedVideoModel2, provider_used: 'kie.ai', content_type: 'video',
                video_task: { taskId, status: 'generating', prompt: content, sourceImage: imageUrl, model: selectedVideoModel2 },
                source_image: imageUrl,
                model_label: videoModelLabel2, video_model_reason: videoSelection2.reason,
                est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
              });
              await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
              
              send({ type: 'done', messageId: assistantMsgId });
              controllerClosed = true; controller.close();
              return;
            } catch (vidErr) {
              console.error('[Image-to-Video] Error:', vidErr);
              fullContent = `Sorry, I couldn't animate your image: ${vidErr.message}`;
              send({ type: 'delta', content: fullContent });
            }
          } else {
            // TEXT-TO-VIDEO: Generate video from text prompt (with optional character reference)
            try {
              const kieKey = process.env.KIE_API_KEY;
              if (!kieKey) throw new Error('Video API not configured');
              
              // Check if user uploaded a character reference image (e.g., "make a video of me driving")
              let characterElements = [];
              let characterImageUrl = null;
              
              if (useAsCharacterRef && imageAttachment && imageAttachment.base64) {
                send({ type: 'delta', content: '🎬 Preparing your character reference...\n\n' });
                console.log('[Text-to-Video] User wants character reference - uploading face image...');
                
                // Upload the character reference image
                const mType = imageAttachment.mimeType || imageAttachment.mime_type || 'image/jpeg';
                const fileName = `character-${Date.now()}.${mType.split('/')[1] || 'jpg'}`;
                const dataUrl = imageAttachment.base64.startsWith('data:') 
                  ? imageAttachment.base64 
                  : `data:${mType};base64,${imageAttachment.base64}`;
                
                try {
                  const uploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                    body: JSON.stringify({
                      base64Data: dataUrl,
                      uploadPath: 'soulprint/character-reference',
                      fileName: fileName,
                    }),
                  });
                  
                  if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    const downloadUrl = uploadData.data?.downloadUrl || uploadData.downloadUrl;
                    if ((uploadData.success || uploadData.code === 200) && downloadUrl) {
                      characterImageUrl = downloadUrl;
                      console.log('[Text-to-Video] Character reference uploaded:', characterImageUrl.substring(0, 80));
                      
                      // Build Kling Elements array for character reference
                      // Kling API requires 2-4 images per element — duplicate the single image to meet minimum
                      const elementName = 'character';
                      characterElements = [{
                        name: elementName,
                        description: 'The person/character to include in the video',
                        element_input_urls: [characterImageUrl, characterImageUrl],
                      }];
                      
                      send({ type: 'delta', content: `✅ Character reference ready! Creating video with your likeness...\n\n` });
                    }
                  }
                } catch (uploadErr) {
                  console.log('[Text-to-Video] Character reference upload failed:', uploadErr.message);
                  send({ type: 'delta', content: `⚠️ Couldn't process character reference, generating without it...\n\n` });
                }
              }
              
              // ── Dynamic Video Intelligence ──
              // If using character reference, prefer Kling 3.0 (has Elements support)
              const videoSelection3 = await selectVideoModel(content, { 
                hasImage: false, 
                hasCharacterRef: characterElements.length > 0,
                userPreferredModel: characterElements.length > 0 ? 'kling-3.0' : userPreferredVideoModel 
              });
              const selectedVideoModel3 = characterElements.length > 0 ? 'kling-3.0' : videoSelection3.model;
              const videoModelLabel3 = VIDEO_MODELS[selectedVideoModel3].label;
              console.log(`[Text-to-Video] ${characterElements.length > 0 ? 'Using Kling 3.0 for character reference' : `Dynamic Intelligence selected: ${selectedVideoModel3}`} — ${videoSelection3.reason}`);
              send({ type: 'delta', content: `🎬 Starting video generation with ${videoModelLabel3}${characterElements.length > 0 ? ' (with character reference)' : ''}...\n\n` });
              
              // Modify prompt to reference the character element if using character reference
              let finalPrompt = extractPromptWithoutModelInstruction(content);
              if (characterElements.length > 0) {
                const elementRef = `@${characterElements[0].name}`;
                // Check if prompt already references the element
                if (!finalPrompt.includes(elementRef)) {
                  // Add element reference to prompt - replace "me", "myself", etc. with @element_name
                  finalPrompt = finalPrompt
                    .replace(/\b(me|myself)\b/gi, elementRef)
                    .replace(/\bmy face\b/gi, `${elementRef}'s face`);
                }
                console.log('[Text-to-Video] Modified prompt with element reference:', finalPrompt);
              }
              
              const taskId = await generateVideoWithModel(selectedVideoModel3, finalPrompt, kieKey, {
                aspectRatio: detectedAspectRatio,
                duration: 5,
                characterElements: characterElements,
                // Kling API requires image_urls when using role references in prompt
                imageUrls: characterImageUrl ? [characterImageUrl] : undefined,
              });

              // Save job to DB with message_id reference
              await db.collection('video_jobs').insertOne({
                id: uuidv4(), task_id: taskId, user_id: user.id,
                prompt: content, duration: 5, quality: VIDEO_MODELS[selectedVideoModel3].resolution, aspect_ratio: detectedAspectRatio,
                status: 'generating', conversation_id: convId, model: selectedVideoModel3,
                message_id: assistantMsgId, type: characterElements.length > 0 ? 'text-to-video-with-character' : 'text-to-video',
                character_reference: characterImageUrl || null,
                created_at: new Date(), expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              });

              const charRefNote = characterElements.length > 0 ? '\n\n*Using your character reference for consistent appearance.*' : '';
              fullContent = `🎬 **Video generation started!**\n\nYour video is being generated by ${videoModelLabel3}. This usually takes 1-3 minutes.${charRefNote}\n\n*The video will appear here when it's ready.*`;
              send({ type: 'video_task', taskId, status: 'generating', prompt: content, messageId: assistantMsgId, videoModel: selectedVideoModel3, videoModelLabel: videoModelLabel3, videoModelReason: videoSelection3.reason });
              streamVideoTaskSent = true;
              send({ type: 'delta', content: fullContent });
              
              // Save message WITH video_task so it persists on refresh
              const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
              const videoTaskData = { taskId, status: 'generating', prompt: content, model: selectedVideoModel3, characterRef: !!characterImageUrl };
              await dbMessages.insertOne({
                id: assistantMsgId, conversation_id: convId, user_id: user.id,
                role: 'assistant', content: fullContent, created_at: new Date(),
                model_used: selectedVideoModel3, provider_used: 'kie.ai', content_type: 'video',
                model_label: videoModelLabel3, video_model_reason: videoSelection3.reason,
                video_task: videoTaskData,
                est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
              });
              await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
              
              send({ type: 'done', messageId: assistantMsgId });
              controllerClosed = true; controller.close();
              return;
            } catch (vidErr) {
              console.error('[Text-to-Video] Error:', vidErr);
              fullContent = `Sorry, video generation failed: ${vidErr.message}`;
              send({ type: 'delta', content: fullContent });
            }
          }
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          controllerClosed = true; controller.close();
          return;
        }

        // ── Handle location/places search ─────────────────────────────────────
        const detectPlacesIntent = (text) => {
          if (!text) return false;
          // Guard: real place searches are short and direct (e.g. "find restaurants near me")
          // Long messages (>250 chars) are almost certainly NOT place searches
          if (text.length > 250) return false;
          const lower = text.toLowerCase();
          return /\b(find|where|what|show me|looking for|recommend|suggest|any|are there|is there)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|hospitals?|gyms?|banks?|atms?|groceries?|stores?|malls?|parks?|museums?|movies?|theaters?|movie\s*theaters?|cinemas?|parking|airports?)\b/i.test(text)
            || /\b(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|gyms?|banks?|parks?|stores?|movie\s*theaters?|theaters?|cinemas?)\s+(near|in|around|close to)\b/i.test(text)
            || /\b(what('s| is)|where('s| is|are)|any).*(near me|nearby|around here|close by)\b/i.test(lower)
            || /\bnearby\s+(restaurants?|cafes?|bars?|hotels?|stores?|places?|theaters?|cinemas?|movie\s*theaters?)/i.test(lower)
            || /\b(movie\s*theaters?|cinemas?|theaters?)\s*(near|around|close)/i.test(lower);
        };

        if (detectPlacesIntent(sanitizedContent) && attachments.length === 0) {
          send({ type: 'delta', content: '📍 Searching for places...\n\n' });
          try {
            // Parse location from query
            let locationName = parseLocationQuery(sanitizedContent);
            let coords = null;
            
            // Check if user has shared location (prefer request body GPS, fallback to DB)
            const savedLocation = userLocation || await db.collection('user_locations').findOne({ user_id: user.id });
            
            if (!locationName || /near me|nearby|around here|close by/i.test(sanitizedContent.toLowerCase())) {
              if (savedLocation && savedLocation.lat && savedLocation.lng) {
                coords = { lat: savedLocation.lat, lng: savedLocation.lng };
                locationName = savedLocation.address || 'your location';
              } else {
                fullContent = `📍 I need your location to search nearby.\n\nPlease either:\n1. **Enable location services** in your browser/device settings and refresh\n2. **Tap the 📍 icon** in the input bar to share your location\n3. **Specify a location**: "Find restaurants near Times Square"\n\nOr try: "Find Italian restaurants in [your city]"`;
                send({ type: 'delta', content: fullContent });
                await dbMessages.insertOne({
                  id: assistantMsgId, conversation_id: convId, user_id: user.id,
                  role: 'assistant', content: fullContent, created_at: new Date(),
                  model_used: model, provider_used: providerName,
                });
                await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
                send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                controllerClosed = true; controller.close();
                return;
              }
            } else {
              // Geocode the location
              const geocoded = await geocodeAddress(locationName);
              if (!geocoded) {
                fullContent = `❌ Sorry, I couldn't find the location "${locationName}". Please try a more specific address or city name.`;
                send({ type: 'delta', content: fullContent });
                await dbMessages.insertOne({
                  id: assistantMsgId, conversation_id: convId, user_id: user.id,
                  role: 'assistant', content: fullContent, created_at: new Date(),
                  model_used: model, provider_used: providerName,
                });
                await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
                send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                controllerClosed = true; controller.close();
                return;
              }
              coords = { lat: geocoded.lat, lng: geocoded.lng };
              locationName = geocoded.formattedAddress || locationName;
            }
            
            // Extract what they're looking for
            const searchTerm = sanitizedContent.replace(/\s+(near|in|around|at|close to)\s+.+$/i, '')
              .replace(/^(find|where|what|show me|looking for|recommend|suggest)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?/i, '')
              .replace(/\?+$/, '')
              .trim();
            const placeType = extractPlaceType(searchTerm);
            
            // If the user added qualifiers beyond just the place type (e.g. "pizza restaurant",
            // "vegan cafe", "sushi bar"), use text search with the FULL term so Google filters properly.
            // Otherwise, use the type-based nearby search for generic queries like "restaurants".
            const baseTypeWord = placeType ? searchTerm.split(/\s+/).find(w => extractPlaceType(w)) : null;
            const hasQualifier = placeType && searchTerm.toLowerCase().replace(baseTypeWord || '', '').trim().length > 0;
            
            const places = await searchNearbyPlaces({
              lat: coords.lat,
              lng: coords.lng,
              query: hasQualifier ? searchTerm : (placeType ? null : searchTerm),
              type: hasQualifier ? null : placeType,
              radius: 2000,
              maxResults: 6,
            });
            
            if (places.length === 0) {
              fullContent = `😕 No ${searchTerm || 'places'} found near ${locationName}. Try a different search or location.`;
            } else {
              const placesList = places.map((p, i) => {
                const rating = p.rating ? `⭐ ${p.rating}` : '';
                const reviews = p.userRatingsTotal ? `(${p.userRatingsTotal} reviews)` : '';
                const price = p.priceLevel ? '💰'.repeat(p.priceLevel) : '';
                const status = p.isOpen === true ? '🟢 Open now' : p.isOpen === false ? '🔴 Closed' : '';
                const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.placeId}`;
                
                return `### ${i + 1}. ${p.name}\n📍 ${p.address}\n${[rating, reviews, price, status].filter(Boolean).join(' • ')}\n[Open in Google Maps](${mapsLink})`;
              }).join('\n\n');
              
              fullContent = `📍 **Found ${places.length} places near ${locationName}:**\n\n${placesList}`;
            }
            
            send({ type: 'delta', content: fullContent });
            send({ type: 'places', places, location: locationName, coordinates: coords });
          } catch (placesErr) {
            fullContent = `❌ Sorry, place search failed: ${placesErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          
          await dbMessages.insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'google-places', provider_used: 'google', content_type: 'places',
          });
          await dbConversations.updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          controllerClosed = true; controller.close();
          return;
        }

        // Check if user has Google connected for tool calling
        const hasGoogle = await userHasGoogleConnected(user.id);
        const googleTools = hasGoogle ? GOOGLE_TOOLS : [];
        
        // Check if there are images in context (attached or recent)
        const hasImageInContext = attachments.some(a => a.type === 'image') || 
          historyMessages.some(m => m.image_url);
        const imageTools = hasImageInContext ? IMAGE_TOOLS : [];
        
        // Combine all tools
        const allTools = [...googleTools, ...imageTools];
        
        // Tool call handler for Google actions
        const handleGoogleToolCall = async (toolName, args) => {
          console.log(`[Tool Call] Executing ${toolName} with args:`, JSON.stringify(args).substring(0, 200));
          
          // Handle Google actions
          if (['search_emails', 'read_email', 'send_email', 'create_calendar_event', 'update_calendar_event', 'delete_calendar_event', 'create_document', 'create_spreadsheet'].includes(toolName)) {
            const result = await executeGoogleAction(user.id, toolName, args);
            console.log(`[Google Tool] Result:`, result);
            return result;
          }
          
          // Handle image editing
          if (toolName === 'edit_image') {
            console.log('[Image Edit Tool] Processing edit request');
            
            // SAFEGUARD: Reject edit_image if user actually wants animation/video
            const animateKeywords = /\b(animate|animation|animated|bring\s+to\s+life|make\s+it\s+move|turn\s+into\s+(?:a\s+)?video)\b/i;
            if (animateKeywords.test(content) || animateKeywords.test(sanitizedContent)) {
              console.log('[Image Edit Tool] REJECTED — user wants animation/video, not image edit. Original:', content.substring(0, 100));
              return { success: false, error: 'The user is requesting animation/video, NOT an image edit. Do NOT use edit_image for animation requests. Tell the user: "I can see you want to animate this image! Please try saying **animate this image** or **create a video from this image** to trigger our video generation engine."' };
            }
            
            // Send generating_visual indicator so frontend shows loading animation
            send({ type: 'generating_visual', visualType: 'edit' });
            const { image_reference, edit_instruction } = args;
            
            // Find the image to edit
            let imageToEdit = null;
            
            if (image_reference === 'attached') {
              // Use attached image
              const imageAtt = attachments.find(a => a.type === 'image');
              if (imageAtt) {
                imageToEdit = { base64: imageAtt.base64, mimeType: imageAtt.mimeType };
              }
            } else if (image_reference === 'last_generated') {
              // Find last generated image in conversation
              const recentMsgs = [...historyMessages].reverse();
              for (const msg of recentMsgs) {
                if (msg.image_url) {
                  imageToEdit = { url: msg.image_url };
                  break;
                }
              }
            } else if (image_reference?.startsWith('message_id:')) {
              // Find specific message
              const msgId = image_reference.replace('message_id:', '');
              const msg = historyMessages.find(m => m.id === msgId);
              if (msg?.image_url) {
                imageToEdit = { url: msg.image_url };
              }
            }
            
            if (!imageToEdit) {
              return { success: false, error: 'Could not find the image to edit. Please attach an image or specify which image to edit.' };
            }
            
            // Call the image edit API
            try {
              const editRes = await handleImageEditInternal(user.id, imageToEdit, edit_instruction);
              return editRes;
            } catch (err) {
              return { success: false, error: `Image edit failed: ${err.message}` };
            }
          }
          
          // Handle mockup generation
          if (toolName === 'generate_mockup') {
            console.log('[Mockup Tool] Processing mockup request');
            // Send generating_visual indicator so frontend shows loading animation
            send({ type: 'generating_visual', visualType: 'composite' });
            const { product, design_reference } = args;
            
            // Find the design image
            let designImage = null;
            
            if (design_reference === 'attached') {
              const imageAtt = attachments.find(a => a.type === 'image');
              if (imageAtt) {
                designImage = { base64: imageAtt.base64, mimeType: imageAtt.mimeType };
              }
            } else if (design_reference === 'last_generated') {
              const recentMsgs = [...historyMessages].reverse();
              for (const msg of recentMsgs) {
                if (msg.image_url) {
                  designImage = { url: msg.image_url };
                  break;
                }
              }
            }
            
            if (!designImage) {
              return { success: false, error: 'Could not find the design image. Please attach an image.' };
            }
            
            try {
              const mockupRes = await handleMockupGenerateInternal(user.id, designImage, product);
              return mockupRes;
            } catch (err) {
              return { success: false, error: `Mockup generation failed: ${err.message}` };
            }
          }
          
          return { success: false, error: `Unknown tool: ${toolName}` };
        };

        // PROACTIVE WEB SEARCH: Pre-search and inject context for better real-time answers
        // This ensures search happens even if the model doesn't call the tool
        let preSearchSources = [];
        let preSearchDidSearch = false;
        if (enableWebSearch && attachments.length === 0 && providerName === 'openai') {
          const lastUserMsg = historyMessages[historyMessages.length - 1];
          const userText = typeof lastUserMsg?.content === 'string' 
            ? lastUserMsg.content 
            : (Array.isArray(lastUserMsg?.content) ? lastUserMsg.content.find(p => p.type === 'text')?.text : null);
          
          if (userText) {
            const lowerText = userText.toLowerCase().trim();
            
            // ── CONVERSATION FOLLOW-UP DETECTION ──
            // Skip web search for short messages that are clearly referencing the current conversation context.
            // These are conversational follow-ups, NOT web search queries.
            const isConversationalFollowUp = (
              // Very short messages (under 60 chars) with conversational pronouns/references
              (lowerText.length < 60 && /^(what happened|what's wrong|what went wrong|what was that|what do you mean|what does that mean|can you explain|explain that|why did you|why is that|why not|how so|how come|tell me more|go on|continue|say more|elaborate|and then|so what|now what|what now|what next|ok but|yeah but|sure but|huh|wait what|wait|hmm|oh|really|seriously|nice|cool|great|thanks|ok|okay|got it|i see|interesting|wow|haha|lol|love it|perfect|awesome|good|bad|no|yes|yep|nope|exactly|right|correct|wrong|that's not|not quite|close|almost)\b/i.test(lowerText)) ||
              // Short questions with "it/that/this/the" referencing conversation context
              (lowerText.length < 80 && /^(what|why|how|can you|could you|do you|is|are|was|were|did)\b/.test(lowerText) && /\b(it|that|this|the image|the video|the picture|the photo|the result|your|you)\b/i.test(lowerText) && !/\b(weather|news|price|stock|score|latest|current|today|2024|2025|2026)\b/i.test(lowerText)) ||
              // Explicit conversational continuations
              /^(regarding|about that|on that note|speaking of|back to|as for|like i said|as i mentioned)\b/i.test(lowerText)
            );
            
            if (isConversationalFollowUp) {
              console.log('[Chat] Skipping proactive search — conversational follow-up detected:', lowerText.substring(0, 80));
            } else {
            // Check if query contains a URL - always search for URLs
            const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|\.[a-z]{2,}\/[^\s]*/i;
            const hasUrl = urlPattern.test(userText);
            
            // More aggressive search triggers - search whenever user asks about something
            const searchKeywords = [
              // Time-sensitive queries
              'weather', 'news', 'price', 'stock', 'score', 'latest', 'current', 'today', 'recent', 'now',
              // Question patterns
              'what is', 'what are', 'who is', 'who are', 'tell me about', 'explain', 'how to', 'how do',
              'when did', 'where is', 'why did', 'why is', 'find', 'search', 'look up', 'lookup',
              // Website/URL related
              'website', 'site', 'page', 'url', 'link', 'from their', 'using their', 'on their',
              'visit', 'check out', 'go to', 'browse', 'open',
              // Research/information gathering
              'research', 'information', 'info', 'details', 'about', 'profile', 'overview', 'summary',
              'learn about', 'read about', 'know about',
              // Company/product queries
              'company', 'product', 'service', 'platform', 'app', 'tool', 'startup', 'business',
              // Years
              '2024', '2025', '2026',
              // Action words that often need real-time data
              'compare', 'review', 'analyze', 'generate', 'create'
            ];
            const needsSearch = hasUrl || searchKeywords.some(kw => lowerText.includes(kw));
            
            if (needsSearch) {
              console.log('[Chat] Proactive search triggered for:', userText.slice(0, 100), hasUrl ? '(contains URL)' : '');
              try {
                const { buildSearchContext } = await import('@/lib/llm/providers');
                const searchResult = await buildSearchContext(userText);
                
                if (searchResult && searchResult.results?.length > 0) {
                  preSearchDidSearch = true;
                  preSearchSources = searchResult.results.map(r => ({
                    title: r.title || 'Untitled',
                    url: r.url,
                    snippet: r.content?.substring(0, 150) || '',
                  }));
                  
                  // Inject search context into the last user message
                  historyMessages = [
                    ...historyMessages.slice(0, -1),
                    { 
                      role: 'user', 
                      content: `${searchResult.context}\n\n---\n\nUser question: ${userText}` 
                    }
                  ];
                  console.log('[Chat] Pre-search injected:', preSearchSources.length, 'sources');
                  
                  // Send sources to client immediately
                  if (preSearchSources.length > 0) {
                    send({ type: 'sources', sources: preSearchSources.slice(0, 6) });
                  }
                }
              } catch (searchErr) {
                console.log('[Chat] Proactive search failed:', searchErr.message);
              }
            }
            } // close else for conversational follow-up check
          }
        }

        // CRITICAL: Ensure messages alternate before sending to LLM
        // This prevents "user or tool message(s) should alternate with assistant message(s)" errors
        const sanitizedMessages = ensureAlternatingMessages(historyMessages);
        
        // If pre-search injected results, add system instruction to use them directly
        let finalSystemPrompt = systemPrompt;
        if (preSearchDidSearch) {
          finalSystemPrompt += '\n\n[INSTRUCTION: Web search results have already been retrieved and included in the user\'s message below. You MUST use those results directly in your response. Do NOT say "let me search", "give me a moment", "I\'ll look it up", "searching now", or any similar delay phrases. The information is already available — present it immediately.]';
        }
        
        // Debug log to catch message format issues
        if (sanitizedMessages.length > 0) {
          const roles = sanitizedMessages.map(m => m.role).join(' → ');
          console.log(`[Chat] Message roles before LLM call: ${roles}${preSearchDidSearch ? ' (pre-search context injected)' : ''}`);
        }
        
        const { stream: aiStream, searchMeta, didSearch, customToolResults } = await provider.generateStream({
          systemPrompt: finalSystemPrompt,
          messages: sanitizedMessages,
          model,
          temperature: 0.7,
          enableWebSearch: enableWebSearch && attachments.length === 0 && !preSearchDidSearch, // disable tool search if we already pre-searched
          customTools: allTools.length > 0 ? allTools : undefined,
          onToolCall: allTools.length > 0 ? handleGoogleToolCall : undefined,
        });

        // Send Google action results to the client
        if (customToolResults && customToolResults.length > 0) {
          for (const toolResult of customToolResults) {
            if (toolResult.result?.success) {
              const actionType = ['edit_image', 'generate_mockup'].includes(toolResult.tool) 
                ? 'image_action' 
                : 'google_action';
              send({ type: actionType, action: toolResult.tool, result: toolResult.result });
              
              // For image edits/mockups, also send the standard 'image' event 
              // so the frontend reliably renders the image (consistent with direct edit path)
              if (['edit_image', 'generate_mockup'].includes(toolResult.tool) && toolResult.result?.url) {
                send({ type: 'image', url: toolResult.result.url, revised_prompt: toolResult.result.revisedPrompt || '' });
                console.log('[Image Tool] Sent image event for tool result:', toolResult.result.url?.substring(0, 80));
              }
            }
          }
        }

        // Extract and format sources from search
        let sources = [...preSearchSources]; // Start with pre-search sources
        if (didSearch && searchMeta.length > 0) {
          console.log('[Sources Debug] searchMeta:', JSON.stringify(searchMeta, null, 2));
          // Collect all unique sources from search results
          searchMeta.forEach(search => {
            if (search.results && Array.isArray(search.results)) {
              search.results.forEach(result => {
                if (result.url && !sources.find(s => s.url === result.url)) {
                  sources.push({
                    title: result.title || 'Untitled',
                    url: result.url,
                    snippet: result.content?.substring(0, 150) || '',
                  });
                }
              });
            }
          });
          console.log('[Sources Debug] Extracted sources:', sources.length);
          // Send sources to client (only if we didn't already send them from pre-search)
          if (sources.length > 0 && !preSearchDidSearch) {
            send({ type: 'sources', sources: sources.slice(0, 6) }); // Limit to 6 sources
          }
        }

        let escalationBuffer = '';
        let inEscalation = false;
        
        for await (const chunk of aiStream) {
          if (chunk) {
            let text = typeof chunk === 'string' ? chunk : (chunk.delta || '');
            fullContent += text;
            
            // Filter out [SUPPORT_ESCALATION] marker and its JSON from streamed output
            if (inEscalation) {
              escalationBuffer += text;
              // Check if JSON object is complete (balanced braces)
              const opens = (escalationBuffer.match(/{/g) || []).length;
              const closes = (escalationBuffer.match(/}/g) || []).length;
              if (opens > 0 && opens === closes) {
                inEscalation = false;
                escalationBuffer = '';
              }
              text = ''; // Don't send this chunk to the user
            } else if (text.includes('[SUPPORT_ESCALATION]')) {
              inEscalation = true;
              const parts = text.split('[SUPPORT_ESCALATION]');
              text = parts[0]; // Send everything before the marker
              escalationBuffer = parts[1] || '';
              const opens = (escalationBuffer.match(/{/g) || []).length;
              const closes = (escalationBuffer.match(/}/g) || []).length;
              if (opens > 0 && opens === closes) {
                inEscalation = false;
                escalationBuffer = '';
              }
            }
            
            if (text) {
              send({ type: 'delta', content: text });
            }
            
            // Extract Perplexity citations if available
            if (typeof chunk === 'object' && chunk.citations && chunk.citations.length > 0 && sources.length === 0) {
              sources = chunk.citations;
              send({ type: 'sources', sources: sources.slice(0, 6) });
            }
          }
        }

        // ── Auto-continuation for truncated responses ──────────────────────────
        // If the LLM hit its output token limit, automatically continue generating
        const MAX_CONTINUATIONS = 3;
        let continuationCount = 0;
        
        while (
          provider.getLastFinishReason?.() === 'length' &&
          continuationCount < MAX_CONTINUATIONS &&
          fullContent.length > 100 // Only continue if there's substantial content
        ) {
          continuationCount++;
          console.log(`[Chat] Auto-continuation ${continuationCount}/${MAX_CONTINUATIONS} — response was truncated (finish_reason=length)`);
          
          // Notify the client that we're auto-continuing
          send({ type: 'continuation', count: continuationCount, max: MAX_CONTINUATIONS });
          
          try {
            // Build continuation messages: include the partial response and ask to continue
            const continuationMessages = [
              ...historyMessages,
              { role: 'assistant', content: fullContent },
              { role: 'user', content: 'Your previous response was cut off due to length limits. Continue EXACTLY from where you stopped. Do NOT repeat any text that was already written. Do NOT add any preamble like "Continuing from..." — just seamlessly pick up from the exact point the text was cut off.' },
            ];
            
            // Use streamContinuation (lightweight, no tools/search)
            const contStream = await provider.streamContinuation({
              systemPrompt,
              messages: continuationMessages,
              model,
              temperature: 0.7,
            });
            
            for await (const chunk of contStream) {
              if (chunk) {
                let text = typeof chunk === 'string' ? chunk : (chunk.delta || '');
                fullContent += text;
                
                // Filter escalation markers from continuations too
                if (inEscalation) {
                  escalationBuffer += text;
                  const opens = (escalationBuffer.match(/{/g) || []).length;
                  const closes = (escalationBuffer.match(/}/g) || []).length;
                  if (opens > 0 && opens === closes) { inEscalation = false; escalationBuffer = ''; }
                  text = '';
                } else if (text.includes('[SUPPORT_ESCALATION]')) {
                  inEscalation = true;
                  const parts = text.split('[SUPPORT_ESCALATION]');
                  text = parts[0];
                  escalationBuffer = parts[1] || '';
                  const opens = (escalationBuffer.match(/{/g) || []).length;
                  const closes = (escalationBuffer.match(/}/g) || []).length;
                  if (opens > 0 && opens === closes) { inEscalation = false; escalationBuffer = ''; }
                }
                
                if (text) {
                  send({ type: 'delta', content: text });
                }
              }
            }
            
            console.log(`[Chat] Continuation ${continuationCount} complete — total length: ${fullContent.length} chars`);
          } catch (contErr) {
            console.error(`[Chat] Auto-continuation ${continuationCount} failed:`, contErr.message);
            break; // Stop trying to continue on error
          }
        }
        
        if (continuationCount > 0) {
          console.log(`[Chat] Completed ${continuationCount} auto-continuation(s). Final response: ${fullContent.length} chars (~${Math.round(fullContent.length / 4)} tokens)`);
        }

        // Estimate token usage (chars / 4 is a reasonable approximation)
        const inputText = systemPrompt + historyMessages.map(m =>
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        ).join(' ');
        const estInputTokens = Math.round(inputText.length / 4);
        const estOutputTokens = Math.round(fullContent.length / 4);

        // Extract image URL from tool results (for edit_image/generate_mockup tool calls)
        let toolImageUrl = null;        if (customToolResults && customToolResults.length > 0) {
          for (const tr of customToolResults) {
            if (['edit_image', 'generate_mockup'].includes(tr.tool) && tr.result?.success && tr.result?.url) {
              toolImageUrl = tr.result.url;
              break;
            }
          }
        }

        // Save assistant message
        await dbMessages.insertOne({
          id: assistantMsgId, conversation_id: convId, user_id: user.id,
          role: 'assistant', content: fullContent, created_at: new Date(),
          model_used: model, provider_used: providerName,
          web_search_used: didSearch || preSearchDidSearch,
          sources: sources.length > 0 ? sources : undefined,
          image_url: toolImageUrl || fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined,
          est_input_tokens: estInputTokens,
          est_output_tokens: estOutputTokens,
        });

        await dbConversations.updateOne(
          { id: convId }, { $set: { updated_at: new Date() } }
        );

        // ── Support Escalation Detection ──────────────────────────────
        // If the AI flagged a technical issue for escalation, send email to engineering
        if (fullContent.includes('[SUPPORT_ESCALATION]')) {
          (async () => {
            try {
              // Use balanced-brace matching to extract JSON (handles nested braces & multi-line)
              let escalationData = { issue: 'Unknown issue flagged by AI' };
              let rawEscalationText = '';
              const markerIdx = fullContent.indexOf('[SUPPORT_ESCALATION]');
              if (markerIdx !== -1) {
                const afterMarker = fullContent.slice(markerIdx + '[SUPPORT_ESCALATION]'.length).trim();
                rawEscalationText = afterMarker.substring(0, 500); // Capture raw text for debugging
                const braceStart = afterMarker.indexOf('{');
                if (braceStart !== -1) {
                  let depth = 0;
                  let braceEnd = -1;
                  for (let i = braceStart; i < afterMarker.length; i++) {
                    if (afterMarker[i] === '{') depth++;
                    else if (afterMarker[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
                  }
                  if (braceEnd !== -1) {
                    try {
                      escalationData = JSON.parse(afterMarker.slice(braceStart, braceEnd + 1));
                    } catch (parseErr) {
                      console.error('[Support] Failed to parse escalation JSON:', parseErr.message, 'Raw:', afterMarker.slice(braceStart, braceEnd + 1).substring(0, 300));
                      const rawText = afterMarker.slice(braceStart, braceEnd + 1);
                      escalationData = { issue: rawText.substring(0, 200), parse_error: true };
                    }
                  } else {
                    console.warn('[Support] No closing brace found. Raw after marker:', rawEscalationText);
                  }
                } else {
                  console.warn('[Support] No opening brace found. Raw after marker:', rawEscalationText);
                }
              }
              
              // Also capture the last user message for context
              const lastUserMsg = (await db.collection('messages').find({ conversation_id: convId, role: 'user' }).sort({ timestamp: -1 }).limit(1).toArray())?.[0];
              const lastUserContent = lastUserMsg?.content ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)).substring(0, 300) : 'N/A';
              
              const userEmail = user.email || 'unknown';
              const userName = user.display_name || user.email || 'Unknown user';
              
              console.log(`[Support] Escalation detected: user=${userEmail}, conv=${convId}, issue=${escalationData.issue?.substring(0, 100)}`);
              
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: process.env.SENDER_EMAIL || 'support@soulprintengine.ai',
                  to: 'team@archeforge.com',
                  subject: `[SoulPrint Support] ${escalationData.issue?.slice(0, 80) || 'User reported issue'}`,
                  html: `
                    <h2>Support Escalation from SoulPrint</h2>
                    <p><strong>User:</strong> ${userName} (${userEmail})</p>
                    <p><strong>Issue:</strong> ${escalationData.issue || 'N/A'}</p>
                    <p><strong>Steps/Context:</strong> ${escalationData.steps || escalationData.context || 'N/A'}</p>
                    <p><strong>Last User Message:</strong> ${lastUserContent}</p>
                    <p><strong>Conversation ID:</strong> ${convId}</p>
                    <p><strong>Model:</strong> ${model}</p>
                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                    ${rawEscalationText && escalationData.issue === 'Unknown issue flagged by AI' ? `<p><strong>Raw AI Escalation Output:</strong> <code>${rawEscalationText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></p>` : ''}
                    <hr>
                    <p style="color:#888;font-size:12px;">This was auto-escalated by SoulPrint's in-conversation support system.</p>
                  `,
                }),
              });
              console.log(`[Support] Escalation email sent for user ${userEmail}, conv ${convId}`);
            } catch (escErr) {
              console.error('[Support] Failed to send escalation email:', escErr);
            }
          })();
          
          // Clean the marker from the stored message so users don't see raw JSON
          // Use balanced-brace matching for cleanup too
          let cleanContent = fullContent;
          const escIdx = cleanContent.indexOf('[SUPPORT_ESCALATION]');
          if (escIdx !== -1) {
            const beforeMarker = cleanContent.slice(0, escIdx);
            const afterEsc = cleanContent.slice(escIdx + '[SUPPORT_ESCALATION]'.length).trim();
            const braceStart = afterEsc.indexOf('{');
            if (braceStart !== -1) {
              let depth = 0, braceEnd = -1;
              for (let i = braceStart; i < afterEsc.length; i++) {
                if (afterEsc[i] === '{') depth++;
                else if (afterEsc[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
              }
              if (braceEnd !== -1) {
                cleanContent = (beforeMarker + afterEsc.slice(braceEnd + 1)).trim();
              } else {
                cleanContent = beforeMarker.trim();
              }
            } else {
              cleanContent = beforeMarker.trim();
            }
          }
          if (cleanContent !== fullContent) {
            await db.collection('messages').updateOne(
              { id: assistantMsgId },
              { $set: { content: cleanContent, support_escalated: true } }
            );
          }
        }

        // ── Fallback Escalation Detection (NLP) ──────────────────────────────
        // If the AI mentioned escalating but forgot the [SUPPORT_ESCALATION] marker,
        // detect it from natural language and send the email anyway
        if (!fullContent.includes('[SUPPORT_ESCALATION]')) {
          const escalationPhrases = [
            /\b(?:team has been notified|engineering team.*notified|notified.*engineering|escalat(?:ed|ing).*(?:team|engineering|support)|sent? (?:this|it) to (?:the )?(?:engineering|support|tech) team)\b/i,
            /\b(?:I['']ll (?:escalate|send|report|flag) this|reported (?:this|it) to|flagging (?:this|it) for)\b/i,
          ];
          const looksLikeEscalation = escalationPhrases.some(p => p.test(fullContent));
          
          if (looksLikeEscalation) {
            console.log('[Support] NLP fallback: AI mentioned escalation without marker. Sending email...');
            (async () => {
              try {
                const userEmail = user.email || 'unknown';
                const userName = user.display_name || user.email || 'Unknown user';
                
                // Try to find the user's recent messages for context
                const recentUserMsgs = await db.collection('messages')
                  .find({ conversation_id: convId, role: 'user' })
                  .sort({ created_at: -1 }).limit(3).toArray();
                const contextMessages = recentUserMsgs.map(m => {
                  const c = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.find(p => p.type === 'text')?.text : '') || '';
                  return c.substring(0, 200);
                }).filter(Boolean).join(' | ');
                
                // Extract issue from AI response (first sentence that mentions the problem)
                const issueMatch = fullContent.match(/(?:issue|problem|error|bug|fail(?:ing|ed|ure)|not working|broken)[^.]*\./i);
                const issueDescription = issueMatch ? issueMatch[0].trim() : 'Technical issue reported by user (see context)';
                
                const emailRes = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    from: process.env.SENDER_EMAIL || 'support@soulprintengine.ai',
                    to: 'team@archeforge.com',
                    subject: `[SoulPrint Support] ${issueDescription.slice(0, 80)}`,
                    html: `
                      <h2>Support Escalation from SoulPrint</h2>
                      <p><em style="color:#e67e22;">⚠️ NLP fallback — AI mentioned escalation without formal marker</em></p>
                      <p><strong>User:</strong> ${userName} (${userEmail})</p>
                      <p><strong>Detected Issue:</strong> ${issueDescription}</p>
                      <p><strong>User's Recent Messages:</strong> ${contextMessages || 'N/A'}</p>
                      <p><strong>AI Response (excerpt):</strong> ${fullContent.substring(0, 500).replace(/</g, '&lt;')}</p>
                      <p><strong>Conversation ID:</strong> ${convId}</p>
                      <p><strong>Model:</strong> ${model}</p>
                      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                      <hr>
                      <p style="color:#888;font-size:12px;">Auto-detected escalation via NLP fallback. The AI mentioned notifying the team but did not include the [SUPPORT_ESCALATION] marker.</p>
                    `,
                  }),
                });
                if (!emailRes.ok) {
                  const errText = await emailRes.text().catch(() => '');
                  console.error('[Support] NLP fallback email failed:', emailRes.status, errText);
                } else {
                  console.log(`[Support] NLP fallback escalation email sent for user ${userEmail}, conv ${convId}`);
                }
                
                // Mark the message as escalated
                await db.collection('messages').updateOne(
                  { id: assistantMsgId },
                  { $set: { support_escalated: true, escalation_method: 'nlp_fallback' } }
                );
              } catch (escErr) {
                console.error('[Support] NLP fallback email error:', escErr);
              }
            })();
          }
        }

        // ── Long-Term Memory Extraction (async, non-blocking) ──────────────────
        // Extract and save important facts from this conversation exchange
        // SKIP in incognito mode — no memory persistence
        if (!incognito) {
        (async () => {
          try {
            const userContent = typeof userMessageContent === 'string' 
              ? userMessageContent 
              : userMessageContent.find(c => c.type === 'text')?.text || '';
            
            // Only extract memories from substantial exchanges
            if (userContent.length > 20 && fullContent.length > 50) {
              const extractedMemories = await extractMemoriesFromMessage(userContent, fullContent, user.id);
              if (extractedMemories.length > 0) {
                await saveExtractedMemories(db, user.id, extractedMemories, convId);
                console.log(`Extracted ${extractedMemories.length} memories for user ${user.id}`);
              }
            }
          } catch (memErr) {
            console.error('Memory extraction background error:', memErr);
          }
        })();
        } // end incognito guard

        // ── Auto-Image Generation Detection ──────────────────────────────
        // If the AI's text response indicates it wants to generate an image but 
        // the pre-LLM intent detection didn't trigger image generation, 
        // auto-trigger it now so the user doesn't have to send another message.
        // Only auto-generates when Create mode (mediaGenMode) is ON
        if (!toolImageUrl && fullContent.length > 0 && mediaGenMode) {
          const autoGenPatterns = [
            /(?:let me|I['']ll|I will|I am going to|going to)\s+(?:generate|create|make|design|produce)\s+(?:the|an?|that|this|your)\s+(?:image|visual|picture|graphic|infographic|illustration|design|mockup|photo|poster|banner|flyer|diagram|chart|schematic|blueprint|flowchart|wireframe)/i,
            /(?:generating|creating|making|designing|producing)\s+(?:the|an?|that|this|your)\s+(?:image|visual|picture|graphic|infographic|illustration|design|mockup|photo|poster|banner|flyer|diagram|chart|schematic|blueprint|flowchart|wireframe)\s+(?:now|for you|right now)/i,
            /(?:hold on|please wait|one moment)\s+(?:while|as)\s+I\s+(?:generate|create|make|design)\s+/i,
            /(?:I['']ll|let me)\s+(?:now|go ahead and)\s+(?:generate|create|make)/i,
            /(?:here['']?s?\s+(?:the|your)\s+(?:generated|created)\s+(?:image|visual|picture|diagram|chart))/i,
          ];
          
          const shouldAutoGenerate = autoGenPatterns.some(p => p.test(fullContent));
          
          if (shouldAutoGenerate) {
            console.log('[Auto-Image-Gen] AI response indicates image generation intent — auto-triggering');
            try {
              // Extract a prompt from the AI's response or use the user's original message
              const userContent = typeof userMessageContent === 'string' 
                ? userMessageContent 
                : userMessageContent.find(c => c.type === 'text')?.text || '';
              
              // Try to get context from the conversation for a better prompt
              const recentMsgs = await db.collection('messages')
                .find({ conversation_id: convId })
                .sort({ created_at: -1 })
                .limit(6)
                .toArray();
              
              const contextSummary = recentMsgs
                .reverse()
                .map(m => `${m.role}: ${(m.content || '').substring(0, 200)}`)
                .join('\n');
              
              // Ask the LLM to create an image generation prompt from the context
              let imagePrompt = userContent;
              try {
                const promptRes = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LLM_API_KEY || process.env.OPENAI_API_KEY}` },
                  body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                      { role: 'system', content: 'You are an image prompt engineer. Given a conversation context, create a single detailed image generation prompt. Output ONLY the prompt text, nothing else. Make it vivid and specific.' },
                      { role: 'user', content: `Based on this conversation, create an image generation prompt:\n\n${contextSummary}` }
                    ],
                    max_tokens: 300,
                    temperature: 0.7,
                  }),
                });
                if (promptRes.ok) {
                  const promptData = await promptRes.json();
                  const extracted = promptData.choices?.[0]?.message?.content?.trim();
                  if (extracted && extracted.length > 10) {
                    imagePrompt = extracted;
                    console.log('[Auto-Image-Gen] Extracted prompt:', imagePrompt.substring(0, 100));
                  }
                }
              } catch (promptErr) {
                console.log('[Auto-Image-Gen] Prompt extraction failed, using user message:', promptErr.message);
              }
              
              // ── CONTENT MODERATION: Block prohibited auto-generated prompts ──
              const autoModResult = moderateContent(imagePrompt, 'image');
              if (autoModResult.severity === SEVERITY.BLOCK) {
                console.log(`[Auto-Image-Gen Moderation] BLOCKED user=${user.id} category=${autoModResult.category}`);
                send({ type: 'delta', content: `\n\n${autoModResult.message}\n` });
                throw new Error('MODERATION_BLOCK');
              }

              // Notify the frontend that image generation is starting
              send({ type: 'generating_visual', visualType: 'image', model: 'auto' });
              
              // Use the same image generation logic
              const { selectBestImageModel } = await import('@/lib/handlers/media-intelligence.js');
              const modelSelection = selectBestImageModel(imagePrompt, null);
              let selectedModelKey = modelSelection.model;
              let modelConfig = KIE_IMAGE_MODELS[selectedModelKey];
              
              if (!modelConfig || modelConfig.available === false) {
                selectedModelKey = 'nano-banana';
                modelConfig = KIE_IMAGE_MODELS['nano-banana'];
              }
              
              console.log(`[Auto-Image-Gen] Selected model: ${selectedModelKey}`);
              
              const kieApiKey = process.env.KIE_API_KEY;
              let autoImageUrl = null;
              
              if (kieApiKey && modelConfig) {
                const autoDetectedAspect = detectAspectRatioFromPrompt(imagePrompt) || '1:1';
                const inputPayload = modelConfig.formatInput(imagePrompt, autoDetectedAspect);
                const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieApiKey}` },
                  body: JSON.stringify({ model: modelConfig.model, input: inputPayload }),
                });
                
                if (createRes.ok) {
                  const createData = await createRes.json();
                  const taskId = createData.data?.taskId;
                  
                  if (taskId) {
                    // Poll for completion
                    for (let poll = 0; poll < 60; poll++) {
                      await new Promise(r => setTimeout(r, 2000));
                      const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                        headers: { 'Authorization': `Bearer ${kieApiKey}` },
                      });
                      if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        const state = statusData.data?.state;
                        if (state === 'success') {
                          const resultJson = typeof statusData.data?.resultJson === 'string'
                            ? JSON.parse(statusData.data.resultJson)
                            : statusData.data?.resultJson;
                          autoImageUrl = resultJson?.resultUrls?.[0] || resultJson?.images?.[0]?.url || resultJson?.url || resultJson?.image_url || resultJson?.output;
                          
                          if (!autoImageUrl && statusData.data?.resultJson) {
                            const rawJson = typeof statusData.data.resultJson === 'string' ? statusData.data.resultJson : JSON.stringify(statusData.data.resultJson);
                            const urlMatch = rawJson.match(/https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp)/);
                            if (urlMatch) autoImageUrl = urlMatch[0];
                          }
                          console.log(`[Auto-Image-Gen] Kie.ai task succeeded on poll ${poll + 1}, URL:`, (autoImageUrl || 'none').substring(0, 80));
                          break;
                        } else if (state === 'fail') {
                          console.log('[Auto-Image-Gen] Kie.ai task failed:', statusData.data?.failMsg);
                          break;
                        }
                      }
                    }
                  }
                }
              }
              
              // Persist the image URL if we got one
              if (autoImageUrl) {
                // Persist to permanent storage
                if (autoImageUrl.includes('tempfile.aiquickdraw.com') || autoImageUrl.includes('oaidalleapiprodscus')) {
                  try {
                    const imgResp = await fetch(autoImageUrl, { signal: AbortSignal.timeout(30000) });
                    if (imgResp.ok) {
                      const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                      if (imgBuf.length <= 10 * 1024 * 1024) {
                        const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieApiKey}` },
                          body: JSON.stringify({
                            base64Data: `data:image/png;base64,${imgBuf.toString('base64')}`,
                            uploadPath: 'soulprint/generated',
                            fileName: `auto_gen_${Date.now()}.png`
                          }),
                        });
                        if (upRes.ok) {
                          const upData = await upRes.json();
                          if (upData.success && upData.data?.downloadUrl) {
                            autoImageUrl = upData.data.downloadUrl;
                          }
                        }
                      }
                    }
                  } catch (persistErr) {
                    console.warn('[Auto-Image-Gen] Persistence failed:', persistErr.message);
                  }
                }
                
                // Send image event
                send({ type: 'image', url: autoImageUrl, revised_prompt: imagePrompt, model: selectedModelKey });
                
                // Append the image markdown to the message content
                const imageMarkdown = `\n\n![Generated Image](${autoImageUrl})`;
                const updatedContent = fullContent + imageMarkdown;
                
                await db.collection('messages').updateOne(
                  { id: assistantMsgId },
                  { $set: { 
                    content: updatedContent, 
                    image_url: autoImageUrl,
                    auto_generated_image: true,
                    content_type: 'image'
                  }}
                );
                
                console.log('[Auto-Image-Gen] Successfully generated and appended image');
              } else {
                console.log('[Auto-Image-Gen] No image URL obtained — generation may have failed');
              }
            } catch (autoGenErr) {
              console.error('[Auto-Image-Gen] Error:', autoGenErr.message);
            }
          }
        }

        // ── Auto-Video Generation Detection ──────────────────────────────
        // If the AI's text response indicates it wants to generate a video but
        // the pre-LLM intent detection didn't trigger video generation,
        // auto-trigger it now so the user sees a real VideoCard with polling.
        // IMPORTANT: Only auto-generate if mediaGenMode is enabled (Create toggle is ON)
        if (fullContent.length > 0 && !streamVideoTaskSent && mediaGenMode) {
          const autoVideoPatterns = [
            /(?:let me|I['']ll|I will|I am going to|going to)\s+(?:generate|create|make|produce|start)\s+(?:the|an?|that|this|your|a new)\s+(?:video|animation|clip)/i,
            /(?:video generation|generating your video|creating your video|generating the video|creating the video)\s*(?:started|now|has begun|beginning|is underway)?/i,
            /(?:I['']ll|let me)\s+(?:start|begin|initiate|kick off)\s+(?:the\s+)?video\s+generation/i,
            /(?:start|begin)\s+(?:the\s+)?video\s+generation\s+now/i,
            /🎬\s*(?:video generation started|generating your video|starting video generation)/i,
            /(?:I['']ll|I will)\s+(?:incorporate|apply|implement)\s+(?:these|those|the)\s+(?:elements|changes|enhancements|improvements)?\s*(?:and|to)?\s*(?:start|begin|generate|create)\s+(?:the\s+)?(?:video|new video)/i,
          ];
          
          const shouldAutoGenerateVideo = autoVideoPatterns.some(p => p.test(fullContent));
          
          if (shouldAutoGenerateVideo) {
            console.log('[Auto-Video-Gen] AI response indicates video generation intent — auto-triggering');
            try {
              const kieKey = process.env.KIE_API_KEY;
              if (!kieKey) throw new Error('Video API not configured');
              
              // Extract prompt from conversation context
              const userContent = typeof userMessageContent === 'string' 
                ? userMessageContent 
                : userMessageContent.find(c => c.type === 'text')?.text || '';
              
              const recentMsgs = await db.collection('messages')
                .find({ conversation_id: convId })
                .sort({ created_at: -1 })
                .limit(8)
                .toArray();
              
              const contextSummary = recentMsgs
                .reverse()
                .map(m => `${m.role}: ${(m.content || '').substring(0, 300)}`)
                .join('\n');
              
              // Ask LLM to create an optimized video generation prompt from the context
              let videoPrompt = userContent;
              try {
                const promptProvider = getProvider('openai', 'gpt-4o-mini');
                const promptResult = await promptProvider.generateChatCompletion({
                  systemPrompt: 'You are a video prompt engineer. Given a conversation context, create a single detailed video generation prompt. Output ONLY the prompt text. Include visual style, camera movement, subject descriptions, and mood.',
                  messages: [{ role: 'user', content: `Based on this conversation, create a video generation prompt:\n\n${contextSummary}\n\nAI's latest response: ${fullContent.substring(0, 500)}` }],
                  model: 'gpt-4o-mini',
                  temperature: 0.7,
                  max_tokens: 300,
                });
                if (promptResult && promptResult.trim().length > 10) {
                  videoPrompt = promptResult.trim();
                  console.log('[Auto-Video-Gen] Extracted prompt:', videoPrompt.substring(0, 120));
                }
              } catch (promptErr) {
                console.log('[Auto-Video-Gen] Prompt extraction failed, using user message:', promptErr.message);
              }
              
              // Notify frontend that video generation is starting
              send({ type: 'generating_visual', visualType: 'video' });
              
              // Select video model
              const detectedAspectRatio = detectAspectRatioFromPrompt(videoPrompt) || '16:9';
              const videoSelection = await selectVideoModel(videoPrompt, { 
                hasImage: false, 
                userPreferredModel: userPreferredVideoModel 
              });
              const selectedVideoModel = (mediaFlow?.selectedModel && mediaFlow.selectedModel !== 'smart') 
                ? mediaFlow.selectedModel 
                : videoSelection.model;
              const videoModelLabel = VIDEO_MODELS[selectedVideoModel]?.label || selectedVideoModel;
              
              console.log(`[Auto-Video-Gen] Selected model: ${selectedVideoModel} — ${videoSelection.reason}`);
              
              // Generate video
              const taskId = await generateVideoWithModel(
                selectedVideoModel, 
                videoPrompt, 
                kieKey, 
                { aspectRatio: detectedAspectRatio, duration: 5 }
              );
              
              // Save video job to DB
              await db.collection('video_jobs').insertOne({
                id: uuidv4(), task_id: taskId, user_id: user.id,
                prompt: videoPrompt, duration: 5,
                quality: VIDEO_MODELS[selectedVideoModel]?.resolution || '1080p',
                aspect_ratio: detectedAspectRatio,
                status: 'generating', conversation_id: convId,
                model: selectedVideoModel, message_id: assistantMsgId,
                type: 'auto-text-to-video',
                created_at: new Date(),
                expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              });
              
              // Send video_task NDJSON for frontend VideoCard
              send({ 
                type: 'video_task', 
                taskId, 
                status: 'generating', 
                prompt: videoPrompt, 
                messageId: assistantMsgId, 
                videoModel: selectedVideoModel, 
                videoModelLabel, 
                videoModelReason: videoSelection.reason 
              });
              
              // Update the message in DB with video_task
              const videoTaskData = { taskId, status: 'generating', prompt: videoPrompt, model: selectedVideoModel };
              await db.collection('messages').updateOne(
                { id: assistantMsgId },
                { $set: { 
                  video_task: videoTaskData, 
                  content_type: 'video',
                  model_label: videoModelLabel,
                  video_model_reason: videoSelection.reason,
                  auto_generated_video: true,
                }}
              );
              
              console.log(`[Auto-Video-Gen] Video task created: ${taskId} with ${videoModelLabel}`);
            } catch (autoVideoErr) {
              console.error('[Auto-Video-Gen] Error:', autoVideoErr.message);
              // Don't fail the stream — the text response is already sent
            }
          }
        }

        send({ type: 'done' });
        controllerClosed = true; controller.close();
      } catch (error) {
        send({ type: 'error', error: error.message });
        controllerClosed = true; controller.close();
      } finally {
        // Clean up keepalive interval
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ============================================================
// UNIFIED MEDIA GENERATION API
// ============================================================

// Model endpoint mappings for Kie.ai (using unified jobs API)
// Model names follow the format: provider/model-name 
// Costs are in Kie.ai credits (1 credit = $0.005)
// Each model has its own input parameter format
// KIE_IMAGE_MODELS and KIE_CREDIT_TO_USD are imported from '@/lib/handlers/image-models'

// Video costs - base credits per video (duration affects some models)

// ============================================================


export {
  GOOGLE_TOOLS,
  IMAGE_TOOLS,
  SMART_MODE_MODELS,
  classifyQueryForSmartMode,
  checkChatRateLimit,
  sanitizeInput,
  trimHistory,
  ensureAlternatingMessages,
  getSystemPrompt,
  enforceDataRetention,
  handleChatStream,
};
