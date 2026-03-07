import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { generateToken, verifyToken, hashPassword, comparePassword, getTokenFromRequest } from '@/lib/auth';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import { sendWelcomeEmail, sendAcceptedEmail, sendBetaCodeEmail } from '@/lib/email';
import path from 'path';
import fs from 'fs';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import yauzl from 'yauzl';

// Configure route for large file uploads (App Router style)
export const maxDuration = 300; // 5 minutes max for this route (large file processing)
export const dynamic = 'force-dynamic';

// ============================================================
// RATE LIMITING
// ============================================================
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMITS = {
  chat: 30, // 30 requests per minute
  auth: 10, // 10 login attempts per minute
  export: 5, // 5 exports per minute
  default: 60, // 60 requests per minute for other endpoints
};

function checkRateLimit(identifier, type = 'default') {
  const key = `${identifier}:${type}`;
  const now = Date.now();
  const limit = RATE_LIMITS[type] || RATE_LIMITS.default;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: limit - 1 };
  }
  
  const record = rateLimitStore.get(key);
  
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
    return { allowed: true, remaining: limit - 1 };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  
  record.count++;
  return { allowed: true, remaining: limit - record.count };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

// ============================================================
// DATA IMPORT ANALYSIS (ChatGPT / Facebook)
// ============================================================

// Parse ChatGPT export ZIP and extract conversations
async function parseChatGPTExport(zipBuffer) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  
  let conversations = [];
  let userMessages = [];
  
  for (const entry of entries) {
    if (entry.entryName.endsWith('conversations.json') || entry.entryName === 'conversations.json') {
      try {
        const content = entry.getData().toString('utf8');
        const data = JSON.parse(content);
        
        if (Array.isArray(data)) {
          for (const conv of data) {
            const title = conv.title || 'Untitled';
            const mapping = conv.mapping || {};
            
            for (const [, node] of Object.entries(mapping)) {
              if (node?.message?.author?.role === 'user' && node?.message?.content?.parts) {
                const text = node.message.content.parts.join(' ').trim();
                if (text && text.length > 10) {
                  userMessages.push(text);
                }
              }
            }
            conversations.push({ title, messageCount: Object.keys(mapping).length });
          }
        }
      } catch (e) {
        console.error('Error parsing conversations.json:', e.message);
      }
    }
  }
  
  return { 
    source: 'chatgpt', 
    conversationCount: conversations.length, 
    userMessageCount: userMessages.length,
    sampleMessages: userMessages.slice(0, 100), // Limit for analysis
    conversations: conversations.slice(0, 50)
  };
}

// Parse Facebook export ZIP and extract messages/posts
async function parseFacebookExport(zipBuffer) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  
  let messages = [];
  let posts = [];
  
  for (const entry of entries) {
    const name = entry.entryName.toLowerCase();
    
    // Parse messages
    if (name.includes('messages/') && name.endsWith('.json')) {
      try {
        const content = entry.getData().toString('utf8');
        const data = JSON.parse(content);
        
        if (data.messages && Array.isArray(data.messages)) {
          for (const msg of data.messages) {
            if (msg.content && msg.sender_name) {
              // Decode Facebook's encoding
              const text = decodeURIComponent(escape(msg.content));
              if (text.length > 10) {
                messages.push({ text, sender: msg.sender_name });
              }
            }
          }
        }
      } catch (e) { /* skip invalid files */ }
    }
    
    // Parse posts
    if ((name.includes('posts/') || name.includes('your_posts')) && name.endsWith('.json')) {
      try {
        const content = entry.getData().toString('utf8');
        const data = JSON.parse(content);
        
        const postArray = Array.isArray(data) ? data : (data.posts || data.status_updates || []);
        for (const post of postArray) {
          const text = post.data?.[0]?.post || post.post || post.title || '';
          if (text && text.length > 10) {
            posts.push(decodeURIComponent(escape(text)));
          }
        }
      } catch (e) { /* skip invalid files */ }
    }
  }
  
  return {
    source: 'facebook',
    messageCount: messages.length,
    postCount: posts.length,
    sampleMessages: messages.slice(0, 100),
    samplePosts: posts.slice(0, 50)
  };
}

// Analyze communication style using LLM
async function analyzeCommmunicationStyle(parsedData, existingProfile = null) {
  const provider = getProvider('openai', 'gpt-4o-mini');
  
  let sampleText = '';
  // Handle both sampleMessages (from full parsing) and userMessages (from batch processing)
  const messages = parsedData.sampleMessages || parsedData.userMessages || [];
  const posts = parsedData.samplePosts || [];
  
  if (parsedData.source === 'chatgpt' || parsedData.source === 'unknown') {
    sampleText = messages.slice(0, 50).join('\n---\n');
  } else if (parsedData.source === 'facebook') {
    const msgTexts = messages.slice(0, 30).map(m => typeof m === 'string' ? m : m.text).filter(Boolean).join('\n---\n');
    const postTexts = posts.slice(0, 20).join('\n---\n');
    sampleText = `MESSAGES:\n${msgTexts}\n\nPOSTS:\n${postTexts}`;
  }
  
  if (!sampleText || sampleText.length < 50) {
    return { error: 'Not enough data to analyze. Please ensure your export contains conversation history.' };
  }
  
  const analysisPrompt = `Analyze the following user-written content and extract insights about their communication style and personality. This is from their ${parsedData.source === 'chatgpt' ? 'ChatGPT conversation history' : 'Facebook messages and posts'}.

CONTENT TO ANALYZE:
${sampleText.substring(0, 12000)}

Provide a JSON response with the following structure:
{
  "summary": "A 2-3 sentence friendly summary of what you learned about this person",
  "communicationStyle": {
    "formality": "formal/casual/mixed",
    "verbosity": "concise/detailed/balanced",
    "tone": "analytical/emotional/supportive/humorous/direct/mixed",
    "description": "Brief description of their communication style"
  },
  "interests": ["list", "of", "topics", "they", "discuss", "often"],
  "vocabulary": {
    "complexity": "simple/moderate/sophisticated",
    "uniquePhrases": ["any", "distinctive", "phrases", "they", "use"],
    "emoji_usage": "frequent/occasional/rare/none"
  },
  "questionStyle": "How they tend to ask questions (direct, context-heavy, etc)",
  "insights": [
    "Specific insight 1 about their personality or preferences",
    "Specific insight 2",
    "Specific insight 3"
  ]
}

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await provider.generateChatCompletion({
      systemPrompt: 'You are an expert at analyzing communication patterns and personality from text. Return only valid JSON.',
      messages: [{ role: 'user', content: analysisPrompt }],
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });
    
    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { error: 'Could not parse analysis' };
  } catch (e) {
    console.error('Analysis error:', e);
    return { error: e.message };
  }
}

// ============================================================
// URL CONTENT EXTRACTION
// ============================================================

// Extract readable text content from a URL
async function extractUrlContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoulPrintBot/1.0; +https://soulprint.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { success: false, error: 'Not a readable page (PDF, image, or other binary content)' };
    }
    
    const html = await res.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : '';
    
    // Extract Open Graph data
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : '';
    
    // Remove script, style, nav, header, footer, aside tags and their content
    let cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    
    // Try to find main content area
    const articleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentDiv = cleanHtml.match(/<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    
    let mainContent = articleMatch?.[1] || mainMatch?.[1] || contentDiv?.[1] || cleanHtml;
    
    // Extract text from HTML
    let text = mainContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Limit content length
    const maxLength = 8000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...\n\n[Content truncated]';
    }
    
    return {
      success: true,
      url,
      title: ogTitle || title,
      description,
      content: text,
      contentLength: text.length,
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: e.message };
  }
}

// Detect URLs in text
function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  return text.match(urlRegex) || [];
}

// ============================================================
// GOOGLE PLACES API
// ============================================================

const PLACE_TYPES = {
  restaurant: 'restaurant',
  restaurants: 'restaurant',
  food: 'restaurant',
  cafe: 'cafe',
  coffee: 'cafe',
  bar: 'bar',
  bars: 'bar',
  pub: 'bar',
  hotel: 'lodging',
  hotels: 'lodging',
  lodging: 'lodging',
  gas: 'gas_station',
  gasstation: 'gas_station',
  fuel: 'gas_station',
  pharmacy: 'pharmacy',
  hospital: 'hospital',
  doctor: 'doctor',
  dentist: 'dentist',
  gym: 'gym',
  fitness: 'gym',
  bank: 'bank',
  atm: 'atm',
  grocery: 'supermarket',
  supermarket: 'supermarket',
  store: 'store',
  shopping: 'shopping_mall',
  mall: 'shopping_mall',
  park: 'park',
  museum: 'museum',
  library: 'library',
  movie: 'movie_theater',
  movies: 'movie_theater',
  cinema: 'movie_theater',
  cinemas: 'movie_theater',
  theater: 'movie_theater',
  theaters: 'movie_theater',
  'movie theater': 'movie_theater',
  'movie theaters': 'movie_theater',
  parking: 'parking',
  airport: 'airport',
  trainstation: 'train_station',
  busstation: 'bus_station',
  subway: 'subway_station',
  church: 'church',
  mosque: 'mosque',
  temple: 'hindu_temple',
  synagogue: 'synagogue',
  school: 'school',
  university: 'university',
  spa: 'spa',
  salon: 'beauty_salon',
  haircut: 'hair_care',
  laundry: 'laundry',
  carwash: 'car_wash',
  mechanic: 'car_repair',
};

// Geocode an address to coordinates
async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('Google Places API key not configured');
  
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status !== 'OK' || !data.results?.[0]) {
    return null;
  }
  
  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

// Search for nearby places
async function searchNearbyPlaces({ lat, lng, query, type, radius = 1500, maxResults = 5 }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('Google Places API key not configured');
  
  let url;
  if (query) {
    // Text search (more flexible)
    url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
  } else if (type) {
    // Nearby search with type
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
  } else {
    // General nearby search
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
  }
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Places API error: ${data.status}`);
  }
  
  const places = (data.results || []).slice(0, maxResults).map(place => ({
    name: place.name,
    address: place.vicinity || place.formatted_address,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    priceLevel: place.price_level,
    isOpen: place.opening_hours?.open_now,
    types: place.types,
    placeId: place.place_id,
    lat: place.geometry?.location?.lat,
    lng: place.geometry?.location?.lng,
  }));
  
  return places;
}

// Get place details
async function getPlaceDetails(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('Google Places API key not configured');
  
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,price_level,url&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status !== 'OK') {
    throw new Error(data.error_message || `Places API error: ${data.status}`);
  }
  
  return data.result;
}

// Format places for Telegram message
function formatPlacesForTelegram(places, locationName) {
  if (!places || places.length === 0) {
    return `😕 No places found near ${locationName}. Try a different search or location.`;
  }
  
  const header = `📍 *Found ${places.length} places near ${locationName}:*\n\n`;
  
  const placesList = places.map((p, i) => {
    const rating = p.rating ? `⭐ ${p.rating}` : '';
    const reviews = p.userRatingsTotal ? `(${p.userRatingsTotal})` : '';
    const price = p.priceLevel ? '💰'.repeat(p.priceLevel) : '';
    const status = p.isOpen === true ? '🟢 Open' : p.isOpen === false ? '🔴 Closed' : '';
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' ' + p.address)}&query_place_id=${p.placeId}`;
    
    return `*${i + 1}. ${p.name}*\n` +
      `${p.address}\n` +
      `${[rating, reviews, price, status].filter(Boolean).join(' ')}\n` +
      `[📍 Open in Maps](${mapsLink})`;
  }).join('\n\n');
  
  return header + placesList;
}

// Parse location query from text
function parseLocationQuery(text) {
  // Patterns: "near [location]", "in [location]", "around [location]"
  const nearMatch = text.match(/\b(?:near|in|around|at)\s+(.+?)(?:\s*$|\s+(?:for|to|and))/i);
  if (nearMatch) {
    return nearMatch[1].trim();
  }
  
  // Check if text ends with a location (after the search term)
  const parts = text.split(/\s+(?:near|in|around|at)\s+/i);
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  
  return null;
}

// Extract search type from query
function extractPlaceType(text) {
  const lowerText = text.toLowerCase();
  for (const [keyword, type] of Object.entries(PLACE_TYPES)) {
    if (lowerText.includes(keyword)) {
      return type;
    }
  }
  return null;
}

// ============================================================
// HELPERS
// ============================================================

async function authenticate(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  const db = await getDb();
  const user = await db.collection('users').findOne({ id: decoded.userId });
  if (user) {
    await db.collection('users').updateOne(
      { id: decoded.userId },
      { $set: { last_active_at: new Date() } }
    );
  }
  return user;
}

async function requireAdmin(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) return null;
  return user;
}

function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}
function err(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ============================================================
// SMART MODE - AI MODEL ROUTER
// ============================================================

// Model capabilities and use cases
const SMART_MODE_MODELS = {
  // Real-time information
  'sonar-pro': { 
    triggers: ['news', 'today', 'current', 'latest', 'price', 'weather', 'stock', 'live', 'happening now', 'right now'],
    capabilities: ['real-time', 'web-search', 'current-events'],
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

Available models and their strengths:
1. sonar-pro (Perplexity) - Real-time web search, current events, live data, prices
2. claude-sonnet-4-5-20250929 (Anthropic) - Creative writing, stories, essays, nuanced content
3. gpt-4o (OpenAI) - Code, debugging, technical tasks, general excellence
4. claude-opus-4-5-20251101 (Anthropic) - Deep analysis, research, complex reasoning
5. gpt-4o-mini (OpenAI) - Quick simple queries, basic tasks
6. gemini-2.5-pro (Google) - Math, calculations, logical reasoning

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
// LONG-TERM MEMORY SYSTEM
// ============================================================

// Memory categories
const MEMORY_CATEGORIES = ['health', 'preferences', 'personal', 'work', 'relationships', 'goals', 'other'];

// Extract memories from a conversation message using AI
async function extractMemoriesFromMessage(userMessage, assistantResponse, userId) {
  try {
    const provider = getProvider('openai', 'gpt-4o-mini');
    
    const extractionPrompt = `Analyze this conversation exchange and extract any important facts about the user that should be remembered for future conversations.

USER MESSAGE:
${userMessage}

ASSISTANT RESPONSE:
${assistantResponse}

Extract ONLY concrete, factual information that would be valuable to remember, such as:
- Health information (allergies, conditions, medications)
- Personal preferences (favorite foods, colors, activities)
- Important dates (birthdays, anniversaries)
- Family/relationship info (spouse name, children, pets)
- Work/career details (job title, company, projects)
- Goals and aspirations
- Dislikes and things to avoid
- Location/living situation

Return a JSON array of memories. Each memory should have:
- "content": The fact to remember (be specific and concise)
- "category": One of: health, preferences, personal, work, relationships, goals, other
- "importance": "high" (health/safety), "medium" (useful context), or "low" (nice to know)

If no important facts are found, return an empty array: []

IMPORTANT: 
- Only extract NEW facts, not general conversation
- Be specific: "allergic to peanuts" not "has food allergies"
- Don't extract opinions or temporary states
- Return ONLY valid JSON array, nothing else`;

    const response = await provider.generateChatCompletion({
      systemPrompt: 'You are a memory extraction system. Return only valid JSON arrays.',
      messages: [{ role: 'user', content: extractionPrompt }],
      model: 'gpt-4o-mini',
      temperature: 0.1,
    });

    // Parse the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    const memories = JSON.parse(jsonMatch[0]);
    return Array.isArray(memories) ? memories : [];
  } catch (e) {
    console.error('Memory extraction error:', e);
    return [];
  }
}

// Save extracted memories to database
async function saveExtractedMemories(db, userId, memories, conversationId = null) {
  if (!memories || memories.length === 0) return [];
  
  const savedMemories = [];
  
  for (const mem of memories) {
    if (!mem.content || mem.content.length < 5) continue;
    
    // Check for duplicate or very similar memories
    const existing = await db.collection('user_memories').findOne({
      user_id: userId,
      content: { $regex: mem.content.substring(0, 30), $options: 'i' }
    });
    
    if (existing) {
      console.log(`Skipping duplicate memory: ${mem.content}`);
      continue;
    }
    
    const memory = {
      id: uuidv4(),
      user_id: userId,
      content: mem.content.trim(),
      category: MEMORY_CATEGORIES.includes(mem.category) ? mem.category : 'other',
      importance: ['high', 'medium', 'low'].includes(mem.importance) ? mem.importance : 'medium',
      source: 'auto',
      source_conversation_id: conversationId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    await db.collection('user_memories').insertOne(memory);
    savedMemories.push(memory);
    console.log(`Saved memory: ${memory.content}`);
  }
  
  // Invalidate system prompt cache since memories changed
  if (savedMemories.length > 0) {
    invalidateSystemPromptCache(userId);
  }
  
  return savedMemories;
}

// Get user memories for system prompt
async function getUserMemoriesForPrompt(db, userId) {
  const memories = await db.collection('user_memories')
    .find({ user_id: userId })
    .sort({ importance: 1, created_at: -1 }) // high importance first, then recent
    .limit(50)
    .toArray();
  
  return memories;
}

// API Handlers for Memory Management

// GET /api/memories - Get all user memories
async function handleGetMemories(request) {
  console.log('[API] handleGetMemories called');
  const user = await authenticate(request);
  console.log('[API] handleGetMemories auth result:', user ? `user=${user.id} email=${user.email}` : 'null');
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  
  const query = { user_id: user.id };
  if (category && MEMORY_CATEGORIES.includes(category)) {
    query.category = category;
  }
  
  console.log('[API] handleGetMemories query:', JSON.stringify(query));
  const memories = await db.collection('user_memories')
    .find(query)
    .sort({ importance: 1, created_at: -1 })
    .toArray();
  
  console.log('[API] handleGetMemories found:', memories.length, 'memories');
  return ok({
    memories: memories.map(m => ({
      id: m.id,
      content: m.content,
      category: m.category,
      importance: m.importance,
      source: m.source,
      created_at: m.created_at,
    })),
    categories: MEMORY_CATEGORIES,
  });
}

// POST /api/memories - Create a new memory manually
async function handleCreateMemory(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { content, category, importance } = body;
  
  if (!content || content.trim().length < 3) {
    return err('Memory content is required (at least 3 characters)', 400);
  }
  
  const db = await getDb();
  
  const memory = {
    id: uuidv4(),
    user_id: user.id,
    content: content.trim(),
    category: MEMORY_CATEGORIES.includes(category) ? category : 'other',
    importance: ['high', 'medium', 'low'].includes(importance) ? importance : 'medium',
    source: 'manual',
    source_conversation_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  
  await db.collection('user_memories').insertOne(memory);
  
  // Invalidate cache
  invalidateSystemPromptCache(user.id);
  
  return ok({ success: true, memory });
}

// PUT /api/memories/:id - Update a memory
async function handleUpdateMemory(request, memoryId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { content, category, importance } = body;
  
  const db = await getDb();
  
  const memory = await db.collection('user_memories').findOne({ id: memoryId, user_id: user.id });
  if (!memory) return err('Memory not found', 404);
  
  const updates = { updated_at: new Date() };
  if (content !== undefined) updates.content = content.trim();
  if (category !== undefined && MEMORY_CATEGORIES.includes(category)) updates.category = category;
  if (importance !== undefined && ['high', 'medium', 'low'].includes(importance)) updates.importance = importance;
  
  await db.collection('user_memories').updateOne({ id: memoryId }, { $set: updates });
  
  // Invalidate cache
  invalidateSystemPromptCache(user.id);
  
  return ok({ success: true });
}

// DELETE /api/memories/:id - Delete a memory
async function handleDeleteMemory(request, memoryId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  const memory = await db.collection('user_memories').findOne({ id: memoryId, user_id: user.id });
  if (!memory) return err('Memory not found', 404);
  
  await db.collection('user_memories').deleteOne({ id: memoryId });
  
  // Invalidate cache
  invalidateSystemPromptCache(user.id);
  
  return ok({ success: true });
}

// Build system prompt for chat
async function buildSystemPrompt(db, userId) {
  const user = await db.collection('users').findOne({ id: userId });
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: userId });
  const commProfile = await db.collection('communication_profiles').findOne({ user_id: userId });
  const answers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .sort({ created_at: 1 })
    .toArray();

  const assistantName = profile?.assistant_name || 'SoulPrint';
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const descriptors = profile?.descriptors || [];
  const field = profile?.field || '';
  const helpWith = profile?.help_with || [];

  // Build assessment context from answers (full 36-question assessment)
  let assessmentContext = '';
  if (answers.length > 0) {
    const questionIds = answers.map(a => a.question_id);
    const questions = await db.collection('assessment_questions')
      .find({ id: { $in: questionIds } })
      .toArray();
    const qMap = Object.fromEntries(questions.map(q => [q.id, q]));
    const answersText = answers.map(a => {
      const q = qMap[a.question_id];
      return q ? `Q (${q.pillar}): ${q.question_text}\nA: ${a.answer_text}` : '';
    }).filter(Boolean).slice(0, 12).join('\n\n');
    assessmentContext = `\n## Assessment Insights\n${answersText}`;
  }
  
  // Build communication profile context (from layered assessment)
  let commProfileContext = '';
  if (commProfile) {
    const adaptations = generateAdaptivePrompt(commProfile);
    if (adaptations) {
      commProfileContext = `\n## Communication Preferences (from Quick Assessment)\n${adaptations}`;
    }
  }

  // Build rich soul profile context from data imports
  let soulProfileContext = '';
  if (soulProfile?.insights) {
    const insights = soulProfile.insights;
    const sections = [];
    
    // Communication Style
    if (insights.communicationStyle) {
      const styles = [];
      for (const [source, style] of Object.entries(insights.communicationStyle)) {
        if (style) {
          styles.push(`  - **${source}**: ${style.formality || 'mixed'} formality, ${style.verbosity || 'balanced'} verbosity, ${style.tone || 'neutral'} tone`);
          if (style.description) styles.push(`    _${style.description}_`);
        }
      }
      if (styles.length > 0) {
        sections.push(`### Communication Style\n${styles.join('\n')}`);
      }
    }
    
    // Interests
    if (insights.interests?.length > 0) {
      sections.push(`### Topics of Interest\n${insights.interests.slice(0, 15).map(i => `- ${i}`).join('\n')}`);
    }
    
    // Vocabulary Preferences
    if (insights.vocabulary) {
      const vocabParts = [];
      for (const [source, vocab] of Object.entries(insights.vocabulary)) {
        if (vocab) {
          vocabParts.push(`- **${source}**: ${vocab.complexity || 'moderate'} complexity`);
          if (vocab.uniquePhrases?.length > 0) {
            vocabParts.push(`  - Distinctive phrases: "${vocab.uniquePhrases.slice(0, 5).join('", "')}"`);
          }
          if (vocab.emoji_usage) vocabParts.push(`  - Emoji usage: ${vocab.emoji_usage}`);
        }
      }
      if (vocabParts.length > 0) {
        sections.push(`### Vocabulary & Expression\n${vocabParts.join('\n')}`);
      }
    }
    
    // Question Style
    if (insights.questionStyle) {
      const qStyles = [];
      for (const [source, style] of Object.entries(insights.questionStyle)) {
        if (style) qStyles.push(`- **${source}**: ${style}`);
      }
      if (qStyles.length > 0) {
        sections.push(`### How They Ask Questions\n${qStyles.join('\n')}`);
      }
    }
    
    // Personality Insights
    if (insights.insights?.length > 0) {
      sections.push(`### Personality Insights\n${insights.insights.slice(0, 8).map(i => `- ${i}`).join('\n')}`);
    }
    
    // Latest Summary
    if (insights.latestSummary) {
      sections.push(`### Summary\n${insights.latestSummary}`);
    }
    
    if (sections.length > 0) {
      soulProfileContext = `\n## Soul Profile (from imported data)\n${sections.join('\n\n')}`;
    }
  }

  // Build long-term memory context
  let memoryContext = '';
  const memories = await getUserMemoriesForPrompt(db, userId);
  if (memories.length > 0) {
    const memoryGroups = {
      health: [],
      preferences: [],
      personal: [],
      work: [],
      relationships: [],
      goals: [],
      other: [],
    };
    
    for (const mem of memories) {
      if (memoryGroups[mem.category]) {
        memoryGroups[mem.category].push(`- ${mem.content}${mem.importance === 'high' ? ' ⚠️' : ''}`);
      }
    }
    
    const memorySections = [];
    if (memoryGroups.health.length > 0) {
      memorySections.push(`### Health & Safety (IMPORTANT)\n${memoryGroups.health.join('\n')}`);
    }
    if (memoryGroups.preferences.length > 0) {
      memorySections.push(`### Preferences\n${memoryGroups.preferences.join('\n')}`);
    }
    if (memoryGroups.personal.length > 0) {
      memorySections.push(`### Personal Details\n${memoryGroups.personal.join('\n')}`);
    }
    if (memoryGroups.relationships.length > 0) {
      memorySections.push(`### Relationships & Family\n${memoryGroups.relationships.join('\n')}`);
    }
    if (memoryGroups.work.length > 0) {
      memorySections.push(`### Work & Career\n${memoryGroups.work.join('\n')}`);
    }
    if (memoryGroups.goals.length > 0) {
      memorySections.push(`### Goals & Aspirations\n${memoryGroups.goals.join('\n')}`);
    }
    if (memoryGroups.other.length > 0) {
      memorySections.push(`### Other Facts\n${memoryGroups.other.join('\n')}`);
    }
    
    if (memorySections.length > 0) {
      memoryContext = `\n## Long-Term Memory\nThese are important facts about ${displayName} that you MUST remember and reference when relevant:\n\n${memorySections.join('\n\n')}`;
    }
  }

  return `You are **${assistantName}**, a personal AI companion for **${displayName}**.

# What is a SoulPrint?

A SoulPrint is ${displayName}'s persistent AI identity layer. Not a chatbot. Not a prompt wrapper. Not a memory plugin. It's a mapped, structured imprint of how they think, decide, react, prioritize, trust, and communicate — embedded into you so the interaction reflects them, not generic model behavior.

You capture their:
• Decision style
• Conflict response
• Boundary thresholds
• Communication cadence
• Emotional weighting
• Pattern recognition over time

Most AI resets every session. You don't. You build continuity, reference, and resonance across conversations so you respond with ${displayName}'s logic, their tone, their structure — consistently.

In short: You are the operating system of ${displayName} — running on AI.

# User Profile

## Basic Info
- **Name**: ${displayName}
- **Role**: ${descriptors.join(', ') || 'Not specified'}
- **Field**: ${field || 'Not specified'}
- **Needs help with**: ${helpWith.join(', ') || 'General assistance'}
${assessmentContext}
${commProfileContext}
${soulProfileContext}
${memoryContext}

# Communication Guidelines

Based on ${displayName}'s profile, follow these guidelines:

1. **Tone & Style**: ${commProfile ? 'Adapt based on their communication preferences above' : soulProfile?.insights?.communicationStyle ? 'Adapt to their preferred formality and verbosity as noted above' : 'Be conversational but professional'}
2. **Vocabulary**: ${soulProfile?.insights?.vocabulary ? 'Use vocabulary complexity that matches their style' : 'Use clear, accessible language'}
3. **Personalization**: Address them by name naturally, reference their interests when relevant
4. **Long-Term Memory**: ${memories.length > 0 ? `You have ${memories.length} stored memories about ${displayName}. ALWAYS consider these when responding, especially health/safety information.` : 'Build rapport by remembering details they share'}
5. **Directness**: ${commProfile?.directness > 70 ? 'Be very direct - they value straight talk' : commProfile?.directness < 40 ? 'Be diplomatic and gentle with feedback' : 'Be direct and insightful - they value substance over fluff'}
6. **Brevity**: ${commProfile?.information_density < 50 ? 'Keep responses concise and scannable' : commProfile?.information_density > 70 ? 'Feel free to provide depth and detail' : 'Keep responses concise unless depth is specifically needed or requested'}
7. **Links & Sources**: When referencing websites, articles, or resources, ALWAYS include clickable markdown links like [Title](https://url.com). Make URLs actionable so users can explore further.

You are ${displayName}'s intelligent companion - be genuinely helpful, remember what matters to them, and adapt your communication to feel natural and personalized. If they ask "what is a SoulPrint?" or similar, explain the philosophy naturally using the context above.`;
}

// Generate user profile as structured markdown (for export/viewing)
async function generateProfileMarkdown(db, userId) {
  const user = await db.collection('users').findOne({ id: userId });
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: userId });
  const answers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .sort({ created_at: 1 })
    .toArray();
  const imports = await db.collection('data_imports')
    .find({ user_id: userId, status: 'complete' })
    .sort({ created_at: -1 })
    .toArray();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const assistantName = profile?.assistant_name || 'SoulPrint';
  
  let md = `# ${displayName}'s SoulPrint Profile\n\n`;
  md += `> Generated: ${new Date().toISOString().split('T')[0]}\n`;
  md += `> AI Companion: ${assistantName}\n\n`;
  
  // Basic Profile
  md += `## 👤 Basic Information\n\n`;
  md += `| Field | Value |\n|-------|-------|\n`;
  md += `| Name | ${displayName} |\n`;
  md += `| Email | ${user?.email || 'N/A'} |\n`;
  md += `| Role | ${profile?.descriptors?.join(', ') || 'Not specified'} |\n`;
  md += `| Field/Industry | ${profile?.field || 'Not specified'} |\n`;
  md += `| Needs Help With | ${profile?.help_with?.join(', ') || 'General assistance'} |\n\n`;
  
  // Soul Profile from Imports
  if (soulProfile?.insights) {
    const insights = soulProfile.insights;
    
    md += `## 🧠 Soul Profile\n\n`;
    
    if (insights.latestSummary) {
      md += `### Summary\n${insights.latestSummary}\n\n`;
    }
    
    // Communication Style
    if (insights.communicationStyle) {
      md += `### 💬 Communication Style\n\n`;
      for (const [source, style] of Object.entries(insights.communicationStyle)) {
        if (style) {
          md += `**From ${source} data:**\n`;
          md += `- Formality: ${style.formality || 'mixed'}\n`;
          md += `- Verbosity: ${style.verbosity || 'balanced'}\n`;
          md += `- Tone: ${style.tone || 'neutral'}\n`;
          if (style.description) md += `- Description: _${style.description}_\n`;
          md += `\n`;
        }
      }
    }
    
    // Interests
    if (insights.interests?.length > 0) {
      md += `### 🎯 Topics of Interest\n\n`;
      insights.interests.forEach(i => { md += `- ${i}\n`; });
      md += `\n`;
    }
    
    // Vocabulary
    if (insights.vocabulary) {
      md += `### 📝 Vocabulary & Expression\n\n`;
      for (const [source, vocab] of Object.entries(insights.vocabulary)) {
        if (vocab) {
          md += `**From ${source}:**\n`;
          md += `- Complexity: ${vocab.complexity || 'moderate'}\n`;
          if (vocab.uniquePhrases?.length > 0) {
            md += `- Distinctive phrases: "${vocab.uniquePhrases.slice(0, 5).join('", "')}"\n`;
          }
          if (vocab.emoji_usage) md += `- Emoji usage: ${vocab.emoji_usage}\n`;
          md += `\n`;
        }
      }
    }
    
    // Question Style
    if (insights.questionStyle) {
      md += `### ❓ Question Style\n\n`;
      for (const [source, style] of Object.entries(insights.questionStyle)) {
        if (style) md += `- **${source}**: ${style}\n`;
      }
      md += `\n`;
    }
    
    // Personality Insights
    if (insights.insights?.length > 0) {
      md += `### ✨ Personality Insights\n\n`;
      insights.insights.forEach(i => { md += `- ${i}\n`; });
      md += `\n`;
    }
    
    // Data Sources
    if (insights.sources?.length > 0) {
      md += `### 📊 Data Sources\n\n`;
      md += `Profile built from: ${insights.sources.join(', ')}\n\n`;
    }
  }
  
  // Assessment Answers
  if (answers.length > 0) {
    const questionIds = answers.map(a => a.question_id);
    const questions = await db.collection('assessment_questions')
      .find({ id: { $in: questionIds } })
      .toArray();
    const qMap = Object.fromEntries(questions.map(q => [q.id, q]));
    
    md += `## 📋 Assessment Responses\n\n`;
    md += `Completed ${answers.length} of 36 questions.\n\n`;
    
    // Group by pillar
    const pillars = {};
    answers.forEach(a => {
      const q = qMap[a.question_id];
      if (q) {
        const pillar = q.pillar || 'other';
        if (!pillars[pillar]) pillars[pillar] = [];
        pillars[pillar].push({ question: q.question_text, answer: a.answer_text });
      }
    });
    
    for (const [pillar, qas] of Object.entries(pillars)) {
      md += `### ${pillar.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n\n`;
      qas.forEach(qa => {
        md += `**Q:** ${qa.question}\n`;
        md += `**A:** ${qa.answer}\n\n`;
      });
    }
  }
  
  // Import History
  if (imports.length > 0) {
    md += `## 📥 Import History\n\n`;
    md += `| Date | Source | Status |\n|------|--------|--------|\n`;
    imports.forEach(imp => {
      const date = new Date(imp.created_at).toISOString().split('T')[0];
      md += `| ${date} | ${imp.source} | ${imp.status} |\n`;
    });
    md += `\n`;
  }
  
  md += `---\n*This profile is used to personalize your AI companion across all platforms (web, Telegram, etc.)*\n`;
  
  return md;
}

// API handler to export user profile as markdown
async function handleProfileExport(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const db = await getDb();
    const markdown = await generateProfileMarkdown(db, user.id);
    
    return ok({
      markdown,
      filename: `soulprint-profile-${new Date().toISOString().split('T')[0]}.md`,
    });
  } catch (e) {
    console.error('Profile export error:', e);
    return err(`Export failed: ${e.message}`, 500);
  }
}

// API handler to get full soul profile data (JSON)
async function handleGetSoulProfile(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const db = await getDb();
    const profile = await db.collection('profiles').findOne({ user_id: user.id });
    const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
    const userDoc = await db.collection('users').findOne({ id: user.id });
    
    return ok({
      basicProfile: {
        displayName: profile?.display_name || userDoc?.email?.split('@')[0] || 'User',
        assistantName: profile?.assistant_name || 'SoulPrint',
        descriptors: profile?.descriptors || [],
        field: profile?.field || '',
        helpWith: profile?.help_with || [],
      },
      soulProfile: soulProfile?.insights || null,
      lastUpdated: soulProfile?.updated_at || profile?.created_at || null,
    });
  } catch (e) {
    console.error('Soul profile fetch error:', e);
    return err(`Failed to fetch profile: ${e.message}`, 500);
  }
}

// Ensure uploads directory exists
const UPLOADS_DIR = '/tmp/soulprint_uploads';
async function ensureUploadsDir() {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
  } catch {}
}

// ============================================================
// SEED DATA - 36 QUESTIONS
// ============================================================
const SEED_QUESTIONS = [
  // COMMUNICATION (6)
  { pillar: 'communication', order_index: 1, question_text: 'When you need to share something important with someone, do you prefer to write it out or talk face-to-face?' },
  { pillar: 'communication', order_index: 2, question_text: 'How do you typically respond when someone misunderstands you?' },
  { pillar: 'communication', order_index: 3, question_text: 'Describe how you usually explain a complex idea to someone who is hearing it for the first time.' },
  { pillar: 'communication', order_index: 4, question_text: 'When giving feedback, how direct are you — and why?' },
  { pillar: 'communication', order_index: 5, question_text: 'How do you prefer to receive important news or updates from people you work with?' },
  { pillar: 'communication', order_index: 6, question_text: 'In a group discussion, how do you tend to contribute — and how do you feel when others dominate the conversation?' },
  // EMOTIONAL INTELLIGENCE (6)
  { pillar: 'emotional_intelligence', order_index: 7, question_text: 'When you feel overwhelmed, what is your first instinct — and does it actually help?' },
  { pillar: 'emotional_intelligence', order_index: 8, question_text: 'How do you typically process a major disappointment or setback?' },
  { pillar: 'emotional_intelligence', order_index: 9, question_text: 'Describe a time you had to manage your emotions in a high-stakes professional setting.' },
  { pillar: 'emotional_intelligence', order_index: 10, question_text: 'How do you generally respond when someone else is going through something difficult emotionally?' },
  { pillar: 'emotional_intelligence', order_index: 11, question_text: 'What does self-care actually look like for you — not what it should look like, but what you actually do?' },
  { pillar: 'emotional_intelligence', order_index: 12, question_text: 'How do you handle situations where you feel misunderstood or underestimated?' },
  // DECISION MAKING (6)
  { pillar: 'decision_making', order_index: 13, question_text: 'When faced with a major decision, walk me through your actual process — from the moment you realize a choice needs to be made.' },
  { pillar: 'decision_making', order_index: 14, question_text: 'How do you balance logic and gut feeling when making important choices?' },
  { pillar: 'decision_making', order_index: 15, question_text: 'Describe how you handle situations where there is no clear right answer.' },
  { pillar: 'decision_making', order_index: 16, question_text: 'How do you respond internally and externally when you realize you made the wrong decision?' },
  { pillar: 'decision_making', order_index: 17, question_text: 'How much information do you need before you feel comfortable committing to a decision?' },
  { pillar: 'decision_making', order_index: 18, question_text: 'How do you approach decisions that significantly affect other people?' },
  // SOCIAL DYNAMICS (6)
  { pillar: 'social_dynamics', order_index: 19, question_text: 'How do you navigate a room full of people you do not know — what is your actual strategy?' },
  { pillar: 'social_dynamics', order_index: 20, question_text: 'What does trust mean to you in a relationship, and how do you know when you have it?' },
  { pillar: 'social_dynamics', order_index: 21, question_text: 'How do you handle conflict with someone you are close to?' },
  { pillar: 'social_dynamics', order_index: 22, question_text: 'What role do you typically play in a team — and is that the role you want to play?' },
  { pillar: 'social_dynamics', order_index: 23, question_text: 'How do you maintain long-term relationships when life gets busy?' },
  { pillar: 'social_dynamics', order_index: 24, question_text: 'How do you react — internally and externally — when someone breaks your trust?' },
  // COGNITIVE STYLE (6)
  { pillar: 'cognitive_style', order_index: 25, question_text: 'How do you organize your thoughts when facing a brand new challenge you have never dealt with before?' },
  { pillar: 'cognitive_style', order_index: 26, question_text: 'Do you prefer working with abstract concepts and big ideas, or concrete details and execution — and why?' },
  { pillar: 'cognitive_style', order_index: 27, question_text: 'How do you approach learning something entirely new and unfamiliar?' },
  { pillar: 'cognitive_style', order_index: 28, question_text: 'Describe your ideal environment for deep, focused work.' },
  { pillar: 'cognitive_style', order_index: 29, question_text: 'How do you know when you have truly understood something — not just memorized it?' },
  { pillar: 'cognitive_style', order_index: 30, question_text: 'How do you handle information overload when everything feels equally urgent?' },
  // ASSERTIVENESS (6)
  { pillar: 'assertiveness', order_index: 31, question_text: 'How comfortable are you with saying no — and what makes it easier or harder for you?' },
  { pillar: 'assertiveness', order_index: 32, question_text: 'Describe a situation where you had to stand your ground against strong opposition.' },
  { pillar: 'assertiveness', order_index: 33, question_text: 'How do you react when someone dismisses or minimizes your ideas?' },
  { pillar: 'assertiveness', order_index: 34, question_text: 'How do you ask for what you need — in relationships, at work, or in life generally?' },
  { pillar: 'assertiveness', order_index: 35, question_text: 'How do you handle situations where you know you are right but others strongly disagree?' },
  { pillar: 'assertiveness', order_index: 36, question_text: 'What does setting boundaries mean to you — and where do you struggle with it most?' },
];

// ============================================================
// LAYERED ASSESSMENT (Quick Start) - Layer 1 Core Questions
// ============================================================
const LAYERED_ASSESSMENT_QUESTIONS = {
  layer1: [
    // Communication (2 questions)
    {
      id: 'comm_explain',
      category: 'communication',
      question: 'When you need to explain something important, you naturally:',
      options: [
        { value: 'write', label: 'Write it out first' },
        { value: 'talk', label: 'Talk it through' },
        { value: 'visual', label: 'Use visuals/examples' },
        { value: 'mix', label: 'Mix of all three' }
      ]
    },
    {
      id: 'comm_feedback',
      category: 'communication',
      question: 'When giving feedback to someone, you tend to be:',
      options: [
        { value: 'direct', label: 'Direct and to the point' },
        { value: 'diplomatic', label: 'Diplomatic and gentle' },
        { value: 'sandwich', label: 'Start with positives first' },
        { value: 'depends', label: 'Depends on the person' }
      ]
    },
    // Emotional Intelligence (2 questions)
    {
      id: 'emotion_stress',
      category: 'emotional_intelligence',
      question: 'When you\'re stressed, you tend to:',
      options: [
        { value: 'space', label: 'Want space to think' },
        { value: 'talk', label: 'Talk it out' },
        { value: 'distraction', label: 'Dive into work/distraction' },
        { value: 'reassurance', label: 'Need reassurance' }
      ]
    },
    {
      id: 'emotion_disappointment',
      category: 'emotional_intelligence',
      question: 'How do you typically handle disappointment?',
      options: [
        { value: 'process_quick', label: 'Process internally, move on quickly' },
        { value: 'sit_with', label: 'Need time to sit with it' },
        { value: 'analyze', label: 'Analyze what went wrong' },
        { value: 'talk_through', label: 'Talk through it with someone' }
      ]
    },
    // Decision Making (2 questions)
    {
      id: 'decision_approach',
      category: 'decision_making',
      question: 'When facing a big decision, you:',
      options: [
        { value: 'gut', label: 'Trust your gut immediately' },
        { value: 'research', label: 'Research extensively first' },
        { value: 'opinions', label: 'Seek multiple opinions' },
        { value: 'blend', label: 'Blend intuition + data' }
      ]
    },
    {
      id: 'decision_options',
      category: 'decision_making',
      question: 'You\'d rather have:',
      options: [
        { value: 'three_clear', label: '3 great options with clear pros/cons' },
        { value: 'all_options', label: 'All possible options to evaluate' },
        { value: 'one_recommended', label: 'One recommended option with reasoning' },
        { value: 'framework', label: 'Framework to decide myself' }
      ]
    },
    // Work Style (2 questions)
    {
      id: 'work_feedback',
      category: 'work_style',
      question: 'Your ideal feedback is:',
      options: [
        { value: 'direct', label: 'Direct and immediate' },
        { value: 'thoughtful', label: 'Thoughtful and detailed' },
        { value: 'sandwich', label: 'Sandwich approach (positive/negative/positive)' },
        { value: 'data_driven', label: 'Data-driven with examples' }
      ]
    },
    {
      id: 'work_productivity',
      category: 'work_style',
      question: 'You\'re most productive when:',
      options: [
        { value: 'solo', label: 'Working independently' },
        { value: 'collaborative', label: 'Collaborating with others' },
        { value: 'mix', label: 'Alternating between both' },
        { value: 'depends', label: 'Depends on the task' }
      ]
    },
    // Values (2 questions)
    {
      id: 'values_priority',
      category: 'values',
      question: 'In your work, what matters most to you?',
      options: [
        { value: 'impact', label: 'Making a meaningful impact' },
        { value: 'growth', label: 'Personal growth and learning' },
        { value: 'stability', label: 'Stability and security' },
        { value: 'freedom', label: 'Freedom and autonomy' }
      ]
    },
    {
      id: 'values_success',
      category: 'values',
      question: 'How do you define success?',
      options: [
        { value: 'achievement', label: 'Achieving specific goals' },
        { value: 'fulfillment', label: 'Feeling fulfilled daily' },
        { value: 'recognition', label: 'Being recognized for my work' },
        { value: 'balance', label: 'Having work-life balance' }
      ]
    },
    // Relationships (2 questions)
    {
      id: 'relationship_support',
      category: 'relationships',
      question: 'When someone you care about is struggling, you:',
      options: [
        { value: 'listen', label: 'Listen and let them vent' },
        { value: 'solve', label: 'Try to help solve the problem' },
        { value: 'comfort', label: 'Offer comfort and reassurance' },
        { value: 'ask', label: 'Ask what they need from you' }
      ]
    },
    {
      id: 'relationship_conflict',
      category: 'relationships',
      question: 'In conflicts, you typically:',
      options: [
        { value: 'address', label: 'Address it directly and quickly' },
        { value: 'avoid', label: 'Avoid until things cool down' },
        { value: 'compromise', label: 'Look for a compromise' },
        { value: 'reflect', label: 'Reflect before responding' }
      ]
    }
  ],
  // Layer 2: Smart Follow-ups based on Layer 1 answers
  layer2: {
    // Follow-ups for "Write it out first"
    'comm_explain:write': [
      {
        id: 'write_style',
        question: 'When you write, do you prefer to draft everything at once or build it piece by piece?',
        options: [
          { value: 'all_at_once', label: 'Draft everything at once' },
          { value: 'piece_by_piece', label: 'Build it piece by piece' }
        ]
      },
      {
        id: 'edit_style',
        question: 'Do you edit as you go or dump it all out first?',
        options: [
          { value: 'edit_as_go', label: 'Edit as I go' },
          { value: 'dump_first', label: 'Dump it all out first, then edit' }
        ]
      }
    ],
    // Follow-ups for stress response "Want space to think"
    'emotion_stress:space': [
      {
        id: 'space_duration',
        question: 'When you need space, how long before you\'re ready to engage again?',
        options: [
          { value: 'minutes', label: 'Minutes' },
          { value: 'hours', label: 'Hours' },
          { value: 'days', label: 'Days' }
        ]
      },
      {
        id: 'check_in',
        question: 'Should I check in on you or wait for you to come back?',
        options: [
          { value: 'check_in', label: 'Check in on me' },
          { value: 'wait', label: 'Wait for me to come back' }
        ]
      }
    ],
    // Follow-ups for "Research extensively first"
    'decision_approach:research': [
      {
        id: 'research_depth',
        question: 'How many sources do you typically want before feeling confident?',
        options: [
          { value: 'few', label: '2-3 solid sources' },
          { value: 'moderate', label: '5-7 sources' },
          { value: 'comprehensive', label: 'As many as possible' }
        ]
      },
      {
        id: 'research_style',
        question: 'Do you prefer curated research or broad exploration?',
        options: [
          { value: 'curated', label: 'Curated - give me the best' },
          { value: 'broad', label: 'Broad - let me explore' }
        ]
      }
    ],
    // Follow-ups for "Direct and immediate" feedback
    'feedback_style:direct': [
      {
        id: 'feedback_timing',
        question: 'Should I call out issues as I see them, or wait until you ask?',
        options: [
          { value: 'proactive', label: 'Call them out immediately' },
          { value: 'wait', label: 'Wait until I ask' }
        ]
      },
      {
        id: 'feedback_context',
        question: 'How much context do you want with criticism?',
        options: [
          { value: 'just_fix', label: 'Just the fix' },
          { value: 'with_why', label: 'The fix plus the why' }
        ]
      }
    ],
    // Follow-ups for "Talk it out" stress response
    'emotion_stress:talk': [
      {
        id: 'talk_preference',
        question: 'When you need to talk it out, do you want advice or just to vent?',
        options: [
          { value: 'advice', label: 'Give me advice' },
          { value: 'vent', label: 'Just let me vent' },
          { value: 'both', label: 'Ask me first' }
        ]
      }
    ],
    // Follow-ups for "Thoughtful and detailed" feedback
    'feedback_style:thoughtful': [
      {
        id: 'detail_level',
        question: 'How much detail do you actually want?',
        options: [
          { value: 'comprehensive', label: 'Everything - I want the full picture' },
          { value: 'moderate', label: 'Key points with supporting details' },
          { value: 'summary_plus', label: 'Summary with option to dive deeper' }
        ]
      }
    ]
  },
  // Layer 3: Behavioral Validation Questions (shown in chat)
  layer3_validations: [
    { id: 'detail_check', trigger: 'after_detailed_response', question: 'Was that too much detail or about right?', options: ['Too much', 'About right', 'Could use more'] },
    { id: 'directness_check', trigger: 'after_direct_response', question: 'Too blunt or just right?', options: ['Too blunt', 'Just right', 'Could be more direct'] },
    { id: 'options_check', trigger: 'after_options', question: 'Helpful to see options, or would you rather I just recommend one?', options: ['Options are helpful', 'Just recommend one'] },
    { id: 'level_check', trigger: 'after_technical', question: 'Am I pitching this at the right level?', options: ['Too simple', 'Just right', 'Too complex'] },
    { id: 'length_check', trigger: 'after_long_response', question: 'Should I keep responses shorter?', options: ['Yes, shorter please', 'This length is good', 'Go even deeper'] }
  ]
};

// Calculate communication profile from layered assessment
function calculateCommunicationProfile(responses) {
  const profile = {
    // Core dimensions (0-100 scale)
    directness: 50,
    emotional_warmth: 50,
    information_density: 50,
    proactivity: 50,
    
    // Specific preferences
    modality: 'mixed',
    feedback_style: 'balanced',
    decision_support: 'options',
    stress_response: 'space',
    
    // Confidence scores
    confidence: {
      communication: 0.5,
      emotional: 0.5,
      work_style: 0.5
    },
    
    // Raw answers for reference
    raw_answers: responses
  };
  
  // Calculate directness
  if (responses.feedback_style === 'direct') profile.directness = 85;
  else if (responses.feedback_style === 'data_driven') profile.directness = 70;
  else if (responses.feedback_style === 'thoughtful') profile.directness = 50;
  else if (responses.feedback_style === 'sandwich') profile.directness = 30;
  
  // Calculate emotional warmth based on AI personality slider
  if (responses.ai_personality !== undefined) {
    profile.emotional_warmth = responses.ai_personality;
  }
  
  // Calculate information density
  if (responses.comm_detail === 'read_all') profile.information_density = 90;
  else if (responses.comm_detail === 'skim') profile.information_density = 40;
  else if (responses.comm_detail === 'summarize') profile.information_density = 30;
  else if (responses.comm_detail === 'frustrated') profile.information_density = 20;
  
  // Calculate proactivity preference
  if (responses.feedback_timing === 'proactive') profile.proactivity = 80;
  else if (responses.feedback_timing === 'wait') profile.proactivity = 30;
  if (responses.check_in === 'check_in') profile.proactivity = Math.min(100, profile.proactivity + 20);
  else if (responses.check_in === 'wait') profile.proactivity = Math.max(0, profile.proactivity - 20);
  
  // Set modality preference
  profile.modality = responses.comm_explain || 'mix';
  
  // Set feedback style
  profile.feedback_style = responses.feedback_style || 'balanced';
  
  // Set decision support preference
  if (responses.decision_options === 'one_recommended') profile.decision_support = 'recommendation';
  else if (responses.decision_options === 'three_clear') profile.decision_support = 'curated_options';
  else if (responses.decision_options === 'all_options') profile.decision_support = 'comprehensive';
  else if (responses.decision_options === 'framework') profile.decision_support = 'framework';
  
  // Set stress response
  profile.stress_response = responses.emotion_stress || 'space';
  
  // Update confidence based on completion
  const layer1Count = Object.keys(responses).filter(k => 
    LAYERED_ASSESSMENT_QUESTIONS.layer1.some(q => q.id === k)
  ).length;
  profile.confidence.communication = Math.min(1, layer1Count / 10 * 0.8);
  profile.confidence.emotional = responses.emotion_stress && responses.emotion_disappointment ? 0.7 : 0.5;
  profile.confidence.work_style = responses.feedback_style ? 0.7 : 0.5;
  
  return profile;
}

// Generate adaptive system prompt based on profile
function generateAdaptivePrompt(profile) {
  let adaptations = [];
  
  // Adjust based on directness score
  if (profile.directness > 70) {
    adaptations.push('Be direct and concise. Cut fluff. Lead with conclusions, support if needed.');
  } else if (profile.directness < 40) {
    adaptations.push('Use a gentle, diplomatic approach. Build up to main points gradually.');
  }
  
  // Adjust based on emotional warmth
  if (profile.emotional_warmth > 70) {
    adaptations.push('Be warm and friendly. Use conversational language. Show personality.');
  } else if (profile.emotional_warmth < 30) {
    adaptations.push('Keep tone professional, not overly friendly. Focus on substance over relationship building.');
  }
  
  // Adjust based on information density
  if (profile.information_density > 70) {
    adaptations.push('User can handle complexity - don\'t oversimplify. Provide depth and nuance.');
  } else if (profile.information_density < 40) {
    adaptations.push('Keep responses concise and scannable. Use bullet points. Avoid information overload.');
  }
  
  // Adjust based on decision support preference
  if (profile.decision_support === 'recommendation') {
    adaptations.push('Lead with a single clear recommendation, then explain reasoning.');
  } else if (profile.decision_support === 'curated_options') {
    adaptations.push('Present 2-3 options with clear pros/cons for each.');
  } else if (profile.decision_support === 'framework') {
    adaptations.push('Provide frameworks and criteria to help them decide themselves.');
  }
  
  // Adjust based on proactivity
  if (profile.proactivity > 70) {
    adaptations.push('Be proactive - anticipate needs, offer suggestions, call out issues.');
  } else if (profile.proactivity < 40) {
    adaptations.push('Be responsive rather than proactive. Wait for them to ask for input.');
  }
  
  // Adjust based on feedback style
  if (profile.feedback_style === 'direct') {
    adaptations.push('Give feedback immediately and directly. Don\'t sugar coat.');
  } else if (profile.feedback_style === 'sandwich') {
    adaptations.push('Use sandwich feedback: positive observation, constructive point, positive close.');
  } else if (profile.feedback_style === 'data_driven') {
    adaptations.push('Support feedback with data and examples. Show the reasoning.');
  }
  
  return adaptations.join('\n');
}

// Generate human-readable trait descriptions
function getTraitDescription(trait, value) {
  const descriptions = {
    directness: {
      high: { label: 'Direct Communicator', desc: 'You prefer getting straight to the point without unnecessary preamble.' },
      medium: { label: 'Balanced', desc: 'You adapt your directness based on the situation.' },
      low: { label: 'Diplomatic', desc: 'You prefer a gentler, more nuanced approach to communication.' }
    },
    emotional_warmth: {
      high: { label: 'Warm & Personable', desc: 'You value friendly, conversational interactions.' },
      medium: { label: 'Balanced Warmth', desc: 'You blend professional and friendly communication.' },
      low: { label: 'Professional', desc: 'You prefer focused, task-oriented communication.' }
    },
    information_density: {
      high: { label: 'Detail-Oriented', desc: 'You appreciate comprehensive, nuanced information.' },
      medium: { label: 'Balanced Detail', desc: 'You like a mix of overview and detail.' },
      low: { label: 'Concise', desc: 'You prefer brief, scannable information.' }
    },
    proactivity: {
      high: { label: 'Proactive Partner', desc: 'You like suggestions and anticipation of your needs.' },
      medium: { label: 'Balanced Support', desc: 'You appreciate proactive help when relevant.' },
      low: { label: 'On-Demand', desc: 'You prefer to ask for help when you need it.' }
    }
  };
  
  const level = value > 70 ? 'high' : value < 40 ? 'low' : 'medium';
  return descriptions[trait]?.[level] || { label: 'Unknown', desc: '' };
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

// AUTH - Register
async function handleRegister(request) {
  const body = await request.json();
  const { email, passcode, access_code } = body;
  if (!email || !passcode) return err('Email and passcode required');

  const db = await getDb();
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already registered');

  const userId = uuidv4();
  const hashed = await hashPassword(passcode);
  const now = new Date();

  // Check if this is first user -> make superadmin
  const count = await db.collection('users').countDocuments();
  const role = count === 0 ? 'superadmin' : 'user';

  // Check if valid beta code was provided (v2 codes first, then legacy)
  let acceptedViaBetaCode = false;
  let usedCodeId = null;
  if (access_code && role !== 'superadmin') {
    // Try v2 codes first
    const v2Code = await db.collection('beta_codes_v2').findOne({ 
      code: access_code.toUpperCase().trim(),
      active: true,
    });
    
    console.log('[Beta Code] Checking code:', access_code, 'Found:', v2Code ? 'yes' : 'no');
    
    if (v2Code) {
      // Check expiration
      const isExpired = v2Code.expires_at && new Date(v2Code.expires_at) < new Date();
      // Check usage - support both 'uses' and 'uses_count' field names
      const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
      const isExhausted = v2Code.max_uses && currentUses >= v2Code.max_uses;
      
      console.log('[Beta Code] Code details - expired:', isExpired, 'uses:', currentUses, '/', v2Code.max_uses, 'exhausted:', isExhausted);
      
      if (!isExpired && !isExhausted) {
        acceptedViaBetaCode = true;
        usedCodeId = v2Code._id || v2Code.id;
        // Increment usage count - update both field names for compatibility
        await db.collection('beta_codes_v2').updateOne(
          { code: access_code.toUpperCase().trim() },
          { $inc: { uses: 1, uses_count: 1 } }
        );
        console.log('[Beta Code] Accepted code:', access_code, 'for user:', email);
      } else {
        console.log('[Beta Code] Code rejected - expired:', isExpired, 'exhausted:', isExhausted);
      }
    } else {
      // Fallback to legacy code
      const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
      if (betaCode && betaCode.code && 
          betaCode.code.toUpperCase() === access_code.toUpperCase().trim() &&
          (!betaCode.expires_at || new Date(betaCode.expires_at) >= new Date())) {
        acceptedViaBetaCode = true;
        // Increment usage count
        await db.collection('beta_codes').updateOne(
          { id: 'current' },
          { $inc: { uses: 1 } }
        );
        console.log('[Beta Code] Accepted legacy code:', access_code, 'for user:', email);
      } else {
        console.log('[Beta Code] Invalid code:', access_code, 'for user:', email);
      }
    }
  }

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role,
    accepted: role === 'superadmin' || acceptedViaBetaCode,
    created_at: now,
    last_active_at: now,
    access_code_used: access_code || null,
    beta_code_used: acceptedViaBetaCode ? access_code : null,
    beta_code_id: usedCodeId,
    auth_provider: 'legacy',
  });

  // Record beta code redemption if v2 code was used
  if (usedCodeId) {
    await db.collection('beta_code_redemptions').insertOne({
      id: uuidv4(),
      code_id: usedCodeId,
      code: access_code.toUpperCase().trim(),
      user_id: userId,
      user_email: email.toLowerCase(),
      redeemed_at: now,
    });
  }

  // Create empty profile
  await db.collection('profiles').insertOne({
    user_id: userId,
    display_name: '',
    assistant_name: 'SoulPrint',
    descriptors: [],
    field: '',
    help_with: [],
    discovery_source: '',
    soul_profile_summary: '',
    onboarding_complete: false,
    assessment_complete: false,
    created_at: now,
  });

  const token = generateToken(userId);
  
  // Send welcome email (non-blocking)
  sendWelcomeEmail(email, null).catch(e => console.error('Welcome email failed:', e));
  
  // Send new user notification email to admin (non-blocking)
  sendNewUserNotificationEmail({
    email: email.toLowerCase(),
    beta_code_used: acceptedViaBetaCode ? access_code : null,
    accepted: role === 'superadmin' || acceptedViaBetaCode,
  }).catch(e => console.error('Admin notification email failed:', e));
  
  return ok({ 
    token, 
    userId, 
    role, 
    accepted: role === 'superadmin' || acceptedViaBetaCode,
    onboarding_complete: false,
    assessment_complete: false,
  });
}

// AUTH - Login
async function handleLogin(request) {
  const body = await request.json();
  const { email, passcode } = body;
  if (!email || !passcode) return err('Email and passcode required');

  // Rate limit by email to prevent brute force
  const rateCheck = checkRateLimit(email.toLowerCase(), 'auth');
  if (!rateCheck.allowed) {
    return err(`Too many login attempts. Try again in ${rateCheck.retryAfter} seconds.`, 429);
  }

  const db = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return err('User not found', 404);  // distinct from wrong password

  const valid = await comparePassword(passcode, user.passcode_hash);
  if (!valid) return err('Invalid credentials', 401);

  // Check email verification (skip for admins and existing verified users)
  // Also skip for users created before email verification was implemented
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const isLegacyUser = !user.hasOwnProperty('email_verified'); // Users created before this feature
  if (!isAdmin && !isLegacyUser && user.email_verified === false) {
    return err('Please verify your email before signing in. Check your inbox for the verification link.', 403);
  }

  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { last_active_at: new Date() } }
  );

  const token = generateToken(user.id);
  const profile = await db.collection('profiles').findOne({ user_id: user.id });

  return ok({
    token,
    userId: user.id,
    role: user.role,
    accepted: user.accepted,
    onboarding_complete: profile?.onboarding_complete || false,
    assessment_complete: profile?.assessment_complete || false,
  });
}

// AUTH - Firebase Authentication (Google + Email/Password)
async function handleFirebaseAuth(request) {
  const body = await request.json();
  const { idToken, email, displayName, photoURL, uid, accessCode } = body;
  
  if (!idToken || !email || !uid) {
    return err('Missing required Firebase authentication data');
  }

  // Verify Firebase ID token by checking its structure
  // In production, you'd use Firebase Admin SDK, but for client-side we trust the token
  // The token was already verified by Firebase on the client
  let payload;
  let isGoogleAuth = false;
  let firebaseEmailVerified = false;
  
  try {
    // Decode JWT to verify it's valid (basic check)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return err('Invalid token format', 401);
    }
    
    payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Verify token claims
    if (payload.email !== email) {
      return err('Token email mismatch', 401);
    }
    
    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return err('Token expired', 401);
    }
    
    // Check if this is Google OAuth (sign_in_provider in firebase.identities)
    isGoogleAuth = payload.firebase?.sign_in_provider === 'google.com';
    firebaseEmailVerified = payload.email_verified === true;
  } catch (e) {
    console.error('Token verification failed:', e);
    return err('Invalid authentication token', 401);
  }

  const db = await getDb();
  const now = new Date();
  
  // Check if user exists by email (seamless migration for existing users)
  let user = await db.collection('users').findOne({ email: email.toLowerCase() });
  
  if (user) {
    // Existing user - update Firebase UID and last active
    // Also update email_verified status if verified via Firebase/Google
    const updateFields = { 
      firebase_uid: uid,
      firebase_photo_url: photoURL || user.firebase_photo_url,
      last_active_at: now,
      // Update display name if provided and user doesn't have one
      ...(displayName && !user.display_name ? { display_name: displayName } : {}),
      // Mark email as verified if verified via Firebase/Google
      ...(firebaseEmailVerified || isGoogleAuth ? { email_verified: true } : {})
    };
    
    await db.collection('users').updateOne(
      { id: user.id },
      { $set: updateFields }
    );
    
    // Refresh user data to get latest email_verified status
    user = await db.collection('users').findOne({ id: user.id });
    
    // Update profile display name if not set
    if (displayName) {
      await db.collection('profiles').updateOne(
        { user_id: user.id, display_name: { $in: ['', null] } },
        { $set: { display_name: displayName } }
      );
    }
  } else {
    // New user - create account
    const userId = uuidv4();
    
    // Check if this is first user -> make superadmin
    const count = await db.collection('users').countDocuments();
    const role = count === 0 ? 'superadmin' : 'user';
    
    // Check if valid beta code was provided (v2 system with fallback to legacy)
    let acceptedViaBetaCode = false;
    let usedCodeId = null;
    if (accessCode && role !== 'superadmin') {
      // Try v2 codes first
      const v2Code = await db.collection('beta_codes_v2').findOne({ 
        code: accessCode.toUpperCase().trim(),
        active: true,
      });
      
      if (v2Code && 
          (!v2Code.expires_at || new Date(v2Code.expires_at) >= new Date()) &&
          (!v2Code.max_uses || v2Code.uses_count < v2Code.max_uses)) {
        acceptedViaBetaCode = true;
        usedCodeId = v2Code.id;
        // Increment usage count
        await db.collection('beta_codes_v2').updateOne(
          { id: v2Code.id },
          { $inc: { uses_count: 1 } }
        );
      } else {
        // Fallback to legacy code
        const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
        if (betaCode && betaCode.code && 
            betaCode.code.toUpperCase() === accessCode.toUpperCase().trim() &&
            (!betaCode.expires_at || new Date(betaCode.expires_at) >= new Date())) {
          acceptedViaBetaCode = true;
          // Increment usage count
          await db.collection('beta_codes').updateOne(
            { id: 'current' },
            { $inc: { uses: 1 } }
          );
        }
      }
    }
    
    await db.collection('users').insertOne({
      id: userId,
      email: email.toLowerCase(),
      firebase_uid: uid,
      firebase_photo_url: photoURL || null,
      display_name: displayName || null,
      role,
      accepted: role === 'superadmin' || acceptedViaBetaCode,
      created_at: now,
      last_active_at: now,
      access_code_used: accessCode || null,
      beta_code_used: acceptedViaBetaCode ? accessCode : null,
      beta_code_id: usedCodeId,
      auth_provider: isGoogleAuth ? 'google' : 'firebase',
      email_verified: firebaseEmailVerified || isGoogleAuth, // Google users are auto-verified
    });
    
    // Record beta code redemption if v2 code was used
    if (usedCodeId) {
      await db.collection('beta_code_redemptions').insertOne({
        id: uuidv4(),
        code_id: usedCodeId,
        code: accessCode.toUpperCase().trim(),
        user_id: userId,
        user_email: email.toLowerCase(),
        redeemed_at: now,
      });
    }
    
    // Create empty profile
    await db.collection('profiles').insertOne({
      user_id: userId,
      display_name: displayName || '',
      assistant_name: 'SoulPrint',
      descriptors: [],
      field: '',
      help_with: [],
      discovery_source: '',
      soul_profile_summary: '',
      onboarding_complete: false,
      assessment_complete: false,
      created_at: now,
    });
    
    // Send welcome email for new Firebase users (non-blocking)
    sendWelcomeEmail(email, displayName).catch(e => console.error('Welcome email failed:', e));
    
    // Send new user notification email to admin (non-blocking)
    sendNewUserNotificationEmail({
      email: email.toLowerCase(),
      beta_code_used: acceptedViaBetaCode ? accessCode : null,
      accepted: role === 'superadmin' || acceptedViaBetaCode,
    }).catch(e => console.error('Admin notification email failed:', e));
    
    user = { id: userId, role, accepted: role === 'superadmin' || acceptedViaBetaCode };
  }
  
  // Generate our own JWT token for subsequent API calls
  const token = generateToken(user.id);
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  return ok({
    token,
    userId: user.id,
    role: user.role,
    accepted: user.accepted,
    onboarding_complete: profile?.onboarding_complete || false,
    assessment_complete: profile?.assessment_complete || false,
    firebase_linked: true,
  });
}

// AUTH - Me
async function handleMe(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const profile = await db.collection('profiles').findOne({ user_id: user.id });

  return ok({
    id: user.id,
    email: user.email,
    role: user.role,
    accepted: user.accepted,
    created_at: user.created_at,
    profile: profile ? {
      display_name: profile.display_name,
      assistant_name: profile.assistant_name,
      descriptors: profile.descriptors,
      field: profile.field,
      help_with: profile.help_with,
      discovery_source: profile.discovery_source,
      soul_profile_summary: profile.soul_profile_summary,
      onboarding_complete: profile.onboarding_complete,
      assessment_complete: profile.assessment_complete,
      custom_greeting: profile.custom_greeting,
    } : null,
  });
}

// PROFILE - Update
async function handleProfileUpdate(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { display_name, descriptors, field, help_with, discovery_source, assistant_name, onboarding_complete, custom_greeting } = body;

  const db = await getDb();
  const update = {};
  if (display_name !== undefined) update.display_name = display_name;
  if (descriptors !== undefined) update.descriptors = descriptors;
  if (field !== undefined) update.field = field;
  if (help_with !== undefined) update.help_with = help_with;
  if (discovery_source !== undefined) update.discovery_source = discovery_source;
  if (assistant_name !== undefined) update.assistant_name = assistant_name;
  if (onboarding_complete !== undefined) update.onboarding_complete = onboarding_complete;
  if (custom_greeting !== undefined) update.custom_greeting = custom_greeting;

  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: update },
    { upsert: true }
  );

  return ok({ success: true });
}

// ASSESSMENT - Get Questions
async function handleGetQuestions(request) {
  const db = await getDb();
  let questions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();

  if (questions.length === 0) {
    // Auto-seed questions
    await seedQuestions(db);
    questions = await db.collection('assessment_questions')
      .find({ active: true })
      .sort({ order_index: 1 })
      .toArray();
  }

  return ok(questions.map(q => ({
    id: q.id,
    pillar: q.pillar,
    order_index: q.order_index,
    question_text: q.question_text,
  })));
}

async function seedQuestions(db) {
  const existing = await db.collection('assessment_questions').countDocuments();
  if (existing > 0) return;
  const now = new Date();
  await db.collection('assessment_questions').insertMany(
    SEED_QUESTIONS.map(q => ({
      id: uuidv4(),
      ...q,
      active: true,
      created_at: now,
    }))
  );
}

// ASSESSMENT - Get Progress (answers for user)
async function handleGetProgress(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const answers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();

  return ok({ answered: answers.map(a => a.question_id), count: answers.length });
}

// ASSESSMENT - Submit Answer
async function handleSubmitAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { question_id, answer_text } = body;
  if (!question_id) return err('question_id required');

  const db = await getDb();

  // Upsert answer
  const existing = await db.collection('assessment_answers').findOne({
    user_id: user.id,
    question_id,
  });

  if (existing) {
    await db.collection('assessment_answers').updateOne(
      { user_id: user.id, question_id },
      { $set: { answer_text, updated_at: new Date() } }
    );
  } else {
    await db.collection('assessment_answers').insertOne({
      id: uuidv4(),
      user_id: user.id,
      question_id,
      answer_text: answer_text || '',
      created_at: new Date(),
    });
  }

  return ok({ success: true });
}

// ASSESSMENT - Complete (save bot name)
async function handleAssessmentComplete(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { assistant_name } = body;

  const db = await getDb();
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: { assistant_name: assistant_name || 'SoulPrint', assessment_complete: true } }
  );

  return ok({ success: true });
}

// CONVERSATIONS - Get all for user
async function handleGetConversations(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  const db = await getDb();
  
  let query = {};
  
  if (projectId === 'general' || projectId === 'uncategorized') {
    // Get uncategorized conversations
    query = { 
      user_id: user.id,
      $or: [{ project_id: { $exists: false } }, { project_id: null }, { project_id: 'general' }]
    };
  } else if (projectId) {
    // Get conversations for a specific project (need to verify access)
    const project = await db.collection('projects').findOne({
      id: projectId,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    if (!project) return err('Project not found', 404);
    query = { project_id: projectId };
  } else {
    // Get all user's conversations + conversations in shared projects
    const sharedProjects = await db.collection('projects')
      .find({ 'shared_with.user_id': user.id, 'shared_with.accepted': true })
      .toArray();
    const sharedProjectIds = sharedProjects.map(p => p.id);
    
    query = {
      $or: [
        { user_id: user.id },
        { project_id: { $in: sharedProjectIds } }
      ]
    };
  }

  const conversations = await db.collection('conversations')
    .find(query)
    .sort({ updated_at: -1 })
    .limit(100)
    .toArray();

  return ok(conversations.map(c => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    updated_at: c.updated_at,
    source: c.source || 'web',
    project_id: c.project_id || null,
    tags: c.tags || [],
    is_mine: c.user_id === user.id,
  })));
}

// CONVERSATIONS - Create
async function handleCreateConversation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const db = await getDb();
  const now = new Date();

  const conv = {
    id: uuidv4(),
    user_id: user.id,
    title: body.title || 'New Conversation',
    created_at: now,
    updated_at: now,
  };

  await db.collection('conversations').insertOne(conv);
  return ok({ id: conv.id, title: conv.title, created_at: conv.created_at });
}

// CONVERSATIONS - Rename
async function handleRenameConversation(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const { title } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return err('Title is required', 400);
  }

  const db = await getDb();
  
  // Verify conversation belongs to user
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  // Update the title
  await db.collection('conversations').updateOne(
    { id: conversationId },
    { $set: { title: title.trim(), updated_at: new Date() } }
  );

  return ok({ success: true, title: title.trim() });
}

// CONVERSATIONS - Delete
async function handleDeleteConversation(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Verify conversation belongs to user
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  // Delete the conversation
  await db.collection('conversations').deleteOne({ id: conversationId });
  
  // Delete all messages in the conversation
  await db.collection('messages').deleteMany({ conversation_id: conversationId });

  return ok({ success: true });
}

// ============================================================
// PROJECTS & COLLABORATION
// ============================================================

// Generate a unique share code
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all projects for user (owned + shared)
async function handleGetProjects(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get owned projects
  const ownedProjects = await db.collection('projects')
    .find({ owner_id: user.id })
    .sort({ created_at: -1 })
    .toArray();

  // Get projects shared with user
  const sharedProjects = await db.collection('projects')
    .find({ 'shared_with.user_id': user.id, 'shared_with.accepted': true })
    .sort({ created_at: -1 })
    .toArray();

  // Get conversation counts per project
  const projectIds = [...ownedProjects, ...sharedProjects].map(p => p.id);
  const convCounts = await db.collection('conversations').aggregate([
    { $match: { project_id: { $in: projectIds } } },
    { $group: { _id: '$project_id', count: { $sum: 1 } } }
  ]).toArray();
  const countMap = Object.fromEntries(convCounts.map(c => [c._id, c.count]));

  // Get owner info for shared projects
  const ownerIds = sharedProjects.map(p => p.owner_id);
  const owners = await db.collection('users').find({ id: { $in: ownerIds } }).toArray();
  const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.email]));

  // Count uncategorized conversations
  const uncategorizedCount = await db.collection('conversations').countDocuments({
    user_id: user.id,
    $or: [{ project_id: { $exists: false } }, { project_id: null }, { project_id: 'general' }]
  });

  return ok({
    owned: ownedProjects.map(p => ({
      ...p,
      conversation_count: countMap[p.id] || 0,
      is_owner: true,
    })),
    shared: sharedProjects.map(p => ({
      ...p,
      conversation_count: countMap[p.id] || 0,
      is_owner: false,
      owner_email: ownerMap[p.owner_id],
      my_role: p.shared_with.find(s => s.user_id === user.id)?.role || 'viewer',
    })),
    uncategorized_count: uncategorizedCount,
  });
}

// Create a new project
async function handleCreateProject(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { name, description, color, icon } = await request.json();
  if (!name) return err('Project name is required');

  const db = await getDb();
  const now = new Date();

  const project = {
    id: uuidv4(),
    name: name.trim(),
    description: description || '',
    color: color || '#6366f1', // Default indigo
    icon: icon || '📁',
    owner_id: user.id,
    shared_with: [],
    share_link: null,
    created_at: now,
    updated_at: now,
  };

  await db.collection('projects').insertOne(project);
  return ok(project);
}

// Update a project
async function handleUpdateProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { name, description, color, icon } = await request.json();
  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  const updates = { updated_at: new Date() };
  if (name) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (color) updates.color = color;
  if (icon) updates.icon = icon;

  await db.collection('projects').updateOne({ id: projectId }, { $set: updates });
  return ok({ success: true });
}

// Delete a project
async function handleDeleteProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  // Move all conversations in this project to uncategorized
  await db.collection('conversations').updateMany(
    { project_id: projectId },
    { $set: { project_id: null } }
  );

  await db.collection('projects').deleteOne({ id: projectId });
  return ok({ success: true });
}

// Share project with another user by email
async function handleShareProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { email, role } = await request.json();
  if (!email) return err('Email is required');

  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  // Find target user
  const targetUser = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!targetUser) return err('User not found with that email', 404);
  if (targetUser.id === user.id) return err('Cannot share with yourself', 400);

  // Check if already shared
  const alreadyShared = project.shared_with?.find(s => s.user_id === targetUser.id);
  if (alreadyShared) return err('Already shared with this user', 400);

  // Add to shared_with
  const shareEntry = {
    user_id: targetUser.id,
    email: targetUser.email,
    role: role || 'collaborator', // 'viewer' or 'collaborator'
    invited_at: new Date(),
    accepted: true, // Auto-accept for now
  };

  await db.collection('projects').updateOne(
    { id: projectId },
    { $push: { shared_with: shareEntry } }
  );

  return ok({ success: true, shared_with: shareEntry });
}

// Remove user from project
async function handleUnshareProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { user_id } = await request.json();
  if (!user_id) return err('User ID is required');

  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  await db.collection('projects').updateOne(
    { id: projectId },
    { $pull: { shared_with: { user_id } } }
  );

  return ok({ success: true });
}

// Generate/toggle share link for project
async function handleProjectShareLink(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { enabled, role } = await request.json();
  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  let shareLink = project.share_link;

  if (enabled) {
    // Generate or update share link
    shareLink = {
      code: shareLink?.code || generateShareCode(),
      enabled: true,
      role: role || 'collaborator',
      created_at: shareLink?.created_at || new Date(),
    };
  } else {
    // Disable share link
    if (shareLink) {
      shareLink.enabled = false;
    }
  }

  await db.collection('projects').updateOne(
    { id: projectId },
    { $set: { share_link: shareLink } }
  );

  return ok({ share_link: shareLink });
}

// Join project via share link
async function handleJoinProject(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { code } = await request.json();
  if (!code) return err('Share code is required');

  const db = await getDb();

  // Find project with this share code
  const project = await db.collection('projects').findOne({
    'share_link.code': code,
    'share_link.enabled': true,
  });

  if (!project) return err('Invalid or expired share link', 404);
  if (project.owner_id === user.id) return err('You already own this project', 400);

  // Check if already a member
  const alreadyMember = project.shared_with?.find(s => s.user_id === user.id);
  if (alreadyMember) return err('You are already a member of this project', 400);

  // Add user to project
  const shareEntry = {
    user_id: user.id,
    email: user.email,
    role: project.share_link.role || 'collaborator',
    invited_at: new Date(),
    accepted: true,
    joined_via: 'link',
  };

  await db.collection('projects').updateOne(
    { id: project.id },
    { $push: { shared_with: shareEntry } }
  );

  return ok({ success: true, project: { id: project.id, name: project.name } });
}

// Move conversation to project
async function handleMoveConversationToProject(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { project_id } = await request.json();
  const db = await getDb();

  // Verify conversation ownership or collaboration access
  const conv = await db.collection('conversations').findOne({ id: conversationId });
  if (!conv) return err('Conversation not found', 404);

  // Check if user owns the conversation or has collaborator access to its current project
  const hasAccess = conv.user_id === user.id || 
    (conv.project_id && await db.collection('projects').findOne({
      id: conv.project_id,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id, 'shared_with.role': 'collaborator' }
      ]
    }));

  if (!hasAccess) return err('Not authorized', 403);

  // If moving to a project, verify access to target project
  if (project_id && project_id !== 'general') {
    const targetProject = await db.collection('projects').findOne({
      id: project_id,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    if (!targetProject) return err('Target project not found or not accessible', 404);
  }

  await db.collection('conversations').updateOne(
    { id: conversationId },
    { $set: { project_id: project_id || null, updated_at: new Date() } }
  );

  return ok({ success: true });
}

// Get conversations for a project (with collaboration support)
async function handleGetProjectConversations(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Verify access to project
  const project = await db.collection('projects').findOne({
    id: projectId,
    $or: [
      { owner_id: user.id },
      { 'shared_with.user_id': user.id }
    ]
  });

  if (!project) return err('Project not found or not accessible', 404);

  const conversations = await db.collection('conversations')
    .find({ project_id: projectId })
    .sort({ updated_at: -1 })
    .toArray();

  // Get owner info for each conversation
  const ownerIds = [...new Set(conversations.map(c => c.user_id))];
  const owners = await db.collection('users').find({ id: { $in: ownerIds } }).toArray();
  const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.email]));

  return ok(conversations.map(c => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    updated_at: c.updated_at,
    owner_email: ownerMap[c.user_id],
    is_mine: c.user_id === user.id,
  })));
}

// ============================================================
// TAGS
// ============================================================

// Get user's tags
async function handleGetTags(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const tags = await db.collection('tags')
    .find({ user_id: user.id })
    .sort({ name: 1 })
    .toArray();

  return ok(tags);
}

// Create a tag
async function handleCreateTag(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { name, color } = await request.json();
  if (!name) return err('Tag name is required');

  const db = await getDb();

  // Check for duplicate
  const existing = await db.collection('tags').findOne({ 
    user_id: user.id, 
    name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
  });
  if (existing) return err('Tag already exists', 400);

  const tag = {
    id: uuidv4(),
    user_id: user.id,
    name: name.trim(),
    color: color || '#6366f1',
    created_at: new Date(),
  };

  await db.collection('tags').insertOne(tag);
  return ok(tag);
}

// Delete a tag
async function handleDeleteTag(request, tagId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Verify ownership
  const tag = await db.collection('tags').findOne({ id: tagId, user_id: user.id });
  if (!tag) return err('Tag not found', 404);

  // Remove tag from all conversations
  await db.collection('conversations').updateMany(
    { user_id: user.id, tags: tagId },
    { $pull: { tags: tagId } }
  );

  await db.collection('tags').deleteOne({ id: tagId });
  return ok({ success: true });
}

// Update conversation tags
async function handleUpdateConversationTags(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { tags } = await request.json();
  const db = await getDb();

  // Verify conversation ownership
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  await db.collection('conversations').updateOne(
    { id: conversationId },
    { $set: { tags: tags || [], updated_at: new Date() } }
  );

  return ok({ success: true });
}

// MESSAGES - Get by conversationId (updated for collaboration)
async function handleGetMessages(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) return err('conversationId required');

  const db = await getDb();
  
  // Get conversation
  const conv = await db.collection('conversations').findOne({ id: conversationId });
  if (!conv) return err('Conversation not found', 404);

  // Check access: own conversation OR conversation is in a shared project
  let hasAccess = conv.user_id === user.id;
  
  if (!hasAccess && conv.project_id) {
    const project = await db.collection('projects').findOne({
      id: conv.project_id,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    hasAccess = !!project;
  }

  if (!hasAccess) return err('Conversation not found', 404);

  const messages = await db.collection('messages')
    .find({ conversation_id: conversationId })
    .sort({ created_at: 1 })
    .toArray();

  return ok(messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at,
    model_used: m.model_used,
    sender_id: m.sender_id, // For collaboration - who sent this message
  })));
}

// ── In-memory caches (per process) ───────────────────────────────────────────
const _systemPromptCache = new Map(); // userId → { prompt, ts }
const _chatRateLimitCache = new Map(); // userId → { count, windowStart }

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
function trimHistory(messages, maxContextTokens = 6000) {
  if (!messages || messages.length === 0) return [];
  let total = 0;
  const trimmed = [];
  // Work backwards (most-recent first), keep messages that fit
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const est = Math.ceil(content.length / 4) + 4; // +4 for role overhead
    if (total + est > maxContextTokens) break;
    total += est;
    trimmed.unshift(msg);
  }
  // Ensure messages alternate between user and assistant (OpenAI requirement)
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
    // Skip consecutive messages of the same role (keep the latest one)
    if (msg.role === lastRole) {
      // If same role as previous, merge or replace
      if (result.length > 0 && result[result.length - 1].role === msg.role) {
        // Keep the more recent message (later in array = more recent after sorting)
        result[result.length - 1] = msg;
      }
      continue;
    }
    
    // If we have user followed by user, or assistant followed by assistant, skip the first
    result.push(msg);
    lastRole = msg.role;
  }
  
  // CRITICAL: Gemini requires the first message to be from 'user' role
  // If history starts with assistant/model message, remove it
  while (result.length > 0 && result[0].role === 'assistant') {
    result.shift();
  }
  
  // If after sanitization we have no messages, that's okay - we'll just have the current user message
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

// Invalidate cache when profile changes
function invalidateSystemPromptCache(userId) {
  _systemPromptCache.delete(userId);
}

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

// ── Social Media Platform Formats ─────────────────────────────────────────────
const SOCIAL_PLATFORMS = {
  twitter:   { name: 'Twitter/X',  maxChars: 280,  hashtags: 3,  emoji: true },
  instagram: { name: 'Instagram',  maxChars: 2200, hashtags: 10, emoji: true  },
  linkedin:  { name: 'LinkedIn',   maxChars: 1300, hashtags: 5,  emoji: false },
  tiktok:    { name: 'TikTok',     maxChars: 300,  hashtags: 8,  emoji: true  },
  facebook:  { name: 'Facebook',   maxChars: 500,  hashtags: 3,  emoji: true  },
  threads:   { name: 'Threads',    maxChars: 500,  hashtags: 5,  emoji: true  },
  youtube:   { name: 'YouTube',    maxChars: 5000, hashtags: 5,  emoji: false },
};

async function generateSocialPost({ platform, topic, userContext, model = 'gpt-4o', includeSearch = true }) {
  const fmt = SOCIAL_PLATFORMS[platform.toLowerCase()] || SOCIAL_PLATFORMS.twitter;
  let searchContext = '';

  if (includeSearch) {
    const { buildSearchContext } = await import('@/lib/llm/providers');
    const ctx = await buildSearchContext(topic);
    if (ctx) searchContext = `\n\nReal-time context:\n${ctx}`;
  }

  const systemMsg = `You are a professional social media copywriter. Create viral, engaging content that drives engagement. Follow platform best practices exactly.`;
  const userMsg = `Create a ${fmt.name} post about: "${topic}"
${searchContext}
Platform rules:
- Max ${fmt.maxChars} characters (STRICT — trim if needed)
- Include ${fmt.hashtags} relevant hashtags
- ${fmt.emoji ? 'Use appropriate emojis' : 'No emojis (LinkedIn professional)'}
- ${platform === 'twitter' ? 'Make it punchy with a strong hook in first 5 words' : ''}
- ${platform === 'instagram' ? 'Start with a visual hook, tell a story, end with a question or CTA' : ''}
- ${platform === 'linkedin' ? 'Professional insight-driven post. Start with a bold statement. Include a clear business value and CTA' : ''}
- ${platform === 'tiktok' ? 'Viral hook in first line. Include trending hashtags and suggest a sound or trend' : ''}
${userContext ? `\nUser persona/voice: ${userContext}` : ''}
Output ONLY the post text, no explanations. Include hashtags at the end.`;

  const { getProvider } = await import('@/lib/llm/providers');
  const provider = getProvider('openai', model);
  const text = await provider.generateChatCompletion({
    systemPrompt: systemMsg,
    messages: [{ role: 'user', content: userMsg }],
    model,
    temperature: 0.8,
  });

  return { post: text, platform: fmt.name, maxChars: fmt.maxChars };
}

// ── Schedule helpers ──────────────────────────────────────────────────────────

// Common timezone offsets for display
const TIMEZONE_OPTIONS = [
  { label: 'UTC',                   offset: 0   },
  { label: 'EST (UTC-5)',           offset: -5  },
  { label: 'CST (UTC-6)',           offset: -6  },
  { label: 'MST (UTC-7)',           offset: -7  },
  { label: 'PST (UTC-8)',           offset: -8  },
  { label: 'Brazil (UTC-3)',        offset: -3  },
  { label: 'London (UTC+0/+1)',     offset: 0   },
  { label: 'Paris/Berlin (UTC+1)',  offset: 1   },
  { label: 'Moscow (UTC+3)',        offset: 3   },
  { label: 'Dubai (UTC+4)',         offset: 4   },
  { label: 'India (UTC+5:30)',      offset: 5.5 },
  { label: 'Singapore (UTC+8)',     offset: 8   },
  { label: 'Tokyo (UTC+9)',         offset: 9   },
  { label: 'Sydney (UTC+10)',       offset: 10  },
];
export { TIMEZONE_OPTIONS };

// Schedule templates
const SCHEDULE_TEMPLATES = [
  { id: 'ai_news',    name: '🤖 AI News Digest',     prompt: 'Summarize the top 5 most important AI and machine learning stories from the last 24 hours. For each story include: what happened, why it matters, and a source if available. Format it clearly.' },
  { id: 'world_news', name: '🌍 World News Brief',    prompt: 'What are the top 5 most important world news stories from the last 24 hours? Give a clear, concise summary of each.' },
  { id: 'market',     name: '📈 Market Summary',      prompt: 'Give me a summary of today\'s financial markets: major indices performance, top gainers/losers, notable news, and key economic events from the last 24 hours.' },
  { id: 'tech_news',  name: '💻 Tech News',           prompt: 'What are the most significant technology news stories from the last 24 hours? Focus on product launches, funding, acquisitions, and industry trends.' },
  { id: 'crypto',     name: '₿ Crypto Brief',         prompt: 'Summarize the cryptocurrency market over the last 24 hours: Bitcoin and Ethereum prices, major movers, key news and developments.' },
  { id: 'custom',     name: '✏️ Custom',              prompt: '' },
];

function getNextRunAt(hourUTC, minute, scheduleType, dayOfWeek = null) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hourUTC, minute, 0, 0);

  // If the time has already passed today, move to next day
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  if (scheduleType === 'weekly' && dayOfWeek !== null) {
    while (next.getUTCDay() !== dayOfWeek) next.setUTCDate(next.getUTCDate() + 1);
  } else if (scheduleType === 'weekdays') {
    while ([0, 6].includes(next.getUTCDay())) next.setUTCDate(next.getUTCDate() + 1);
  } else if (scheduleType === 'weekends') {
    while (![0, 6].includes(next.getUTCDay())) next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

// ── Schedule API handlers ──────────────────────────────────────────────────────

async function handleGetSchedules(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  const db = await getDb();
  const tasks = await db.collection('scheduled_tasks')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();
  return ok(tasks);
}

async function handleCreateSchedule(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { name, prompt, local_hour, minute = 0, timezone_offset = 0, schedule_type = 'daily', day_of_week = null, timezone_label = 'UTC' } = body;

  if (!name || !prompt) return err('name and prompt required');
  if (local_hour == null || local_hour < 0 || local_hour > 23) return err('valid local_hour (0-23) required');

  const db = await getDb();

  // Check user limit (max 10 schedules per user)
  const count = await db.collection('scheduled_tasks').countDocuments({ user_id: user.id });
  if (count >= 10) return err('Maximum 10 schedules per user');

  // Convert local hour to UTC
  const hourUTC = Math.round(((local_hour - timezone_offset) % 24 + 24) % 24);
  const nextRun = getNextRunAt(hourUTC, minute, schedule_type, day_of_week);

  const task = {
    id: uuidv4(),
    user_id: user.id,
    name,
    prompt,
    local_hour,
    minute,
    hour_utc: hourUTC,
    timezone_offset,
    timezone_label,
    schedule_type,
    day_of_week,
    active: true,
    delivery: 'telegram',
    last_run_at: null,
    next_run_at: nextRun,
    run_count: 0,
    created_at: new Date(),
  };

  await db.collection('scheduled_tasks').insertOne(task);
  return ok(task);
}

async function handleUpdateSchedule(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const db = await getDb();

  const task = await db.collection('scheduled_tasks').findOne({ id: taskId, user_id: user.id });
  if (!task) return err('Schedule not found', 404);

  const updates = {};
  if (body.active !== undefined) updates.active = body.active;
  if (body.name) updates.name = body.name;
  if (body.prompt) updates.prompt = body.prompt;

  // If toggling active back on, recompute next_run_at
  if (body.active === true) {
    updates.next_run_at = getNextRunAt(task.hour_utc, task.minute, task.schedule_type, task.day_of_week);
  }

  await db.collection('scheduled_tasks').updateOne({ id: taskId }, { $set: updates });
  return ok({ success: true });
}

async function handleDeleteSchedule(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  const db = await getDb();
  await db.collection('scheduled_tasks').deleteOne({ id: taskId, user_id: user.id });
  return ok({ success: true });
}

// ── Cron runner — executes due schedules ──────────────────────────────────────
async function handleRunSchedules(request) {
  // Protect with CRON_SECRET
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = await getDb();
  const now = new Date();

  // Find all due tasks
  const dueTasks = await db.collection('scheduled_tasks').find({
    active: true,
    next_run_at: { $lte: now },
  }).toArray();

  if (dueTasks.length === 0) return ok({ ran: 0 });

  let ran = 0;
  for (const task of dueTasks) {
    try {
      // Mark as running (prevent double-execution)
      const nextRun = getNextRunAt(task.hour_utc, task.minute, task.schedule_type, task.day_of_week);
      await db.collection('scheduled_tasks').updateOne(
        { id: task.id },
        { $set: { next_run_at: nextRun, last_run_at: now, run_count: (task.run_count || 0) + 1 } }
      );

      // Get user's Telegram mapping
      const mapping = await db.collection('telegram_mappings').findOne({ user_id: task.user_id, linked: true });
      if (!mapping) continue;

      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (!TELEGRAM_BOT_TOKEN) continue;

      const chatId = mapping.telegram_chat_id;
      const preferredModel = mapping.preferred_model || 'gpt-4o';
      const preferredProvider = mapping.preferred_provider || 'openai';

      // Send a preview message
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `⏰ *Scheduled: ${task.name}*\n_Running your scheduled task..._`
      );

      // Build the enriched prompt with real-time search
      const { buildSearchContext, getProvider: gp } = await import('@/lib/llm/providers');
      const searchCtx = await buildSearchContext(task.prompt);
      const systemMsg = `You are a helpful AI assistant delivering a scheduled briefing. Be concise, informative, and well-formatted for reading in Telegram (use markdown *bold* and bullet points).`;
      const fullPrompt = searchCtx
        ? `${searchCtx}\n\n---\n\nBased on the above real-time data, please: ${task.prompt}`
        : task.prompt;

      const provider = gp(preferredProvider, preferredModel);
      let response = '';
      try {
        const { stream } = await provider.generateStream({
          systemPrompt: systemMsg,
          messages: [{ role: 'user', content: fullPrompt }],
          model: preferredModel,
          temperature: 0.7,
          enableWebSearch: false, // already searched above
        });
        for await (const chunk of stream) response += chunk;
      } catch {
        response = await provider.generateChatCompletion({
          systemPrompt: systemMsg,
          messages: [{ role: 'user', content: fullPrompt }],
          model: preferredModel,
          temperature: 0.7,
        });
      }

      // Format and send the result
      const formattedTime = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      const header = `📋 *${task.name}*\n_${formattedTime} UTC · ${preferredModel}_\n\n`;
      const fullMsg = header + response;

      // Split if too long
      const chunks = [];
      const MAX = 3800;
      for (let i = 0; i < fullMsg.length; i += MAX) chunks.push(fullMsg.slice(i, i + MAX));
      for (const chunk of chunks) await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, chunk);

      // Save to conversation history
      const conv = await db.collection('conversations').findOne({ user_id: task.user_id, source: 'telegram' })
        || { id: null };
      if (conv.id) {
        await db.collection('messages').insertOne({
          id: uuidv4(), conversation_id: conv.id, user_id: task.user_id,
          role: 'assistant', content: response, created_at: now,
          source: 'scheduled', schedule_id: task.id, model_used: preferredModel,
          est_input_tokens: Math.round(fullPrompt.length / 4),
          est_output_tokens: Math.round(response.length / 4),
        });
      }

      ran++;
    } catch (e) {
      console.error(`Scheduler: error running task ${task.id}:`, e.message);
    }
  }

  return ok({ ran, total: dueTasks.length });
}

async function sendTelegramPhoto(chatId, token, photoUrl, caption = '') {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption.substring(0, 1024), parse_mode: 'Markdown' }),
    });
  } catch (e) { console.error('sendTelegramPhoto error:', e.message); }
}

async function sendTelegramVideo(chatId, token, videoUrl, caption = '') {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, video: videoUrl, caption: caption.substring(0, 1024), parse_mode: 'Markdown', supports_streaming: true }),
    });
    // Fallback to document if video fails
    if (!res.ok) {
      await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, document: videoUrl, caption: caption.substring(0, 1024) }),
      });
    }
  } catch (e) { console.error('sendTelegramVideo error:', e.message); }
}

// Request location from user via Telegram keyboard button
async function requestTelegramLocation(chatId, token, message) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: '📍 Share My Location', request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }),
    });
  } catch (e) { console.error('requestTelegramLocation error:', e.message); }
}

// Remove the location keyboard after use
async function removeTelegramKeyboard(chatId, token, message) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true },
      }),
    });
  } catch (e) { console.error('removeTelegramKeyboard error:', e.message); }
}

// CHAT STREAM - Streaming chat with web search + file vision
async function handleChatStream(request) {
  const user = await authenticate(request);
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

  // Get or create conversation
  let convId = conversationId;
  let conv = conversationId
    ? await db.collection('conversations').findOne({ id: conversationId, user_id: user.id })
    : null;

  if (!conv) {
    convId = uuidv4();
    const now = new Date();
    const title = (content || 'File attachment').slice(0, 50) + ((content?.length > 50) ? '...' : '');
    await db.collection('conversations').insertOne({
      id: convId, user_id: user.id, title, created_at: now, updated_at: now,
    });
  }

  // Save user message (text only for storage)
  const userMsgId = uuidv4();
  const storedContent = content + (attachments.length > 0 ? ` [+${attachments.length} attachment(s)]` : '');
  await db.collection('messages').insertOne({
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
    if (memoryToSave && memoryToSave.length > 10) {  // Increased from 3 to 10 for more meaningful memories
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
    .sort({ created_at: -1 }).limit(30).toArray();
  recentMessages.reverse();

  // Apply smart token-aware trimming (best practice: stay within 6k context tokens for history)
  const rawHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));
  const historyMessages = trimHistory(rawHistory, 6000);

  // Build the current user message — support images (vision) + documents
  let userMessageContent;
  if (attachments.length > 0) {
    userMessageContent = [];
    if (content) userMessageContent.push({ type: 'text', text: content });

    for (const att of attachments) {
      if (att.type === 'image' && att.base64) {
        userMessageContent.push({
          type: 'image_url',
          image_url: { url: `data:${att.mimeType || 'image/jpeg'};base64,${att.base64}`, detail: 'high' },
        });
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

  // ── Best Practice: Data Retention (async, best-effort) ───────────────────────
  enforceDataRetention(db, user.id).catch(() => {});

  // ── Best Practice: Cached System Prompt ──────────────────────────────────────
  const systemPrompt = await getSystemPrompt(db, user.id);
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
    if (text.length > 500) return null;
    
    // Don't detect if the text contains multiple line breaks (likely a list or document)
    const lineBreaks = (text.match(/\n/g) || []).length;
    if (lineBreaks > 3) return null;
    
    // Don't detect if the text seems to be asking about features, discussing, or listing tasks
    const taskListIndicators = [
      /\b(task|todo|to-do|list|prioritize|organize|help me|create.*list|feature|ability to|fix|integration|review)\b/i,
      /\b(should|could|would|can we|let's|need to|want to)\b.*\b(add|implement|build|create|fix)\b/i,
    ];
    if (taskListIndicators.some(p => p.test(lower))) return null;
    
    // Video detection (check first — more specific)
    // Must be a clear, direct request at the start of the message
    const videoPatterns = [
      /^(?:please\s+)?(?:can you\s+)?generate\s+(?:a\s+)?video\b/i, 
      /^(?:please\s+)?(?:can you\s+)?create\s+(?:a\s+)?video\b/i,
      /^(?:please\s+)?(?:can you\s+)?make\s+(?:a\s+)?video\b/i, 
      /^(?:please\s+)?(?:can you\s+)?video\s+of\b/i,
      /^(?:please\s+)?(?:can you\s+)?animate\b/i,
    ];
    if (videoPatterns.some(p => p.test(lower))) return 'video';
    
    // Image detection - must be a clear, direct request
    const imagePatterns = [
      /^(?:please\s+)?(?:can you\s+)?generate\s+(?:an?\s+)?image\b/i, 
      /^(?:please\s+)?(?:can you\s+)?create\s+(?:an?\s+)?image\b/i,
      /^(?:please\s+)?(?:can you\s+)?make\s+(?:an?\s+)?image\b/i, 
      /^(?:please\s+)?(?:can you\s+)?draw\s+(?:me\s+)?(?:an?\s+)?/i,
      /^(?:please\s+)?(?:can you\s+)?(?:show|give)\s+me\s+(?:an?\s+)?(?:picture|image|photo)\b/i,
      /^(?:please\s+)?(?:can you\s+)?picture\s+of\b/i, 
      /^(?:please\s+)?(?:can you\s+)?photo\s+of\b/i, 
      /^(?:please\s+)?(?:can you\s+)?illustration\s+of\b/i,
      /^(?:please\s+)?(?:can you\s+)?paint\s+(?:me\s+)?/i, 
      /^(?:please\s+)?(?:can you\s+)?visualize\b/i,
      /\bdall-?e\b/i, /\bstable\s+diffusion\b/i,
    ];
    if (imagePatterns.some(p => p.test(lower))) return 'image';
    return null;
  };

  const mediaIntent = detectMediaIntent(sanitizedContent);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'));

      try {
        // Send meta first (include smart mode info if applicable)
        send({ 
          type: 'meta', 
          conversationId: convId, 
          messageId: assistantMsgId,
          ...(smartModeInfo && { 
            smartMode: true, 
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

        // ── Handle image generation ───────────────────────────────────────
        if (mediaIntent === 'image' && attachments.length === 0) {
          send({ type: 'delta', content: '🎨 Generating your image with DALL-E 3...\n\n' });
          try {
            const apiKey = process.env.OPENAI_API_KEY;
            const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model: 'dall-e-3', prompt: content, n: 1, size: '1024x1024', quality: 'standard', style: 'vivid' }),
            });
            const imgData = await imgRes.json();
            if (imgData.error) throw new Error(imgData.error.message);
            const imageUrl = imgData.data?.[0]?.url;
            const revisedPrompt = imgData.data?.[0]?.revised_prompt || content;

            fullContent = `![Generated Image](${imageUrl})\n\n*Prompt used: ${revisedPrompt}*`;
            send({ type: 'image', url: imageUrl, revised_prompt: revisedPrompt });
            send({ type: 'delta', content: fullContent });
          } catch (imgErr) {
            fullContent = `Sorry, image generation failed: ${imgErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          // Save message
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          await db.collection('messages').insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'dall-e-3', provider_used: 'openai', content_type: 'image',
            est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
          });
          await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          controller.close();
          return;
        }

        // ── Handle video generation ───────────────────────────────────────
        if (mediaIntent === 'video' && attachments.length === 0) {
          send({ type: 'delta', content: '🎬 Starting video generation with Kling 3.0 (via Kie.ai)...\n\n' });
          try {
            const kieKey = process.env.KIE_API_KEY;
            // Use Kling 3.0 via the unified Jobs API
            const vidRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
              body: JSON.stringify({ 
                model: 'kling-3.0/video',
                input: {
                  prompt: content, 
                  duration: '5',
                  aspect_ratio: '16:9',
                  mode: 'std',
                  sound: false,
                  multi_shots: false,
                  multi_prompt: [],
                  kling_elements: [],
                }
              }),
            });
            const vidData = await vidRes.json();
            console.log('Kie.ai video response:', JSON.stringify(vidData).substring(0, 500));
            if (vidData.code !== 200) throw new Error(vidData.msg || vidData.error || 'Video generation failed');
            const taskId = vidData.data?.taskId;

            // Save job to DB with message_id reference
            await db.collection('video_jobs').insertOne({
              id: uuidv4(), task_id: taskId, user_id: user.id,
              prompt: content, duration: 5, quality: '720p', aspect_ratio: '16:9',
              status: 'generating', conversation_id: convId, model: 'kling-3.0',
              message_id: assistantMsgId, // Link to the message for updates
              created_at: new Date(), expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            });

            fullContent = `🎬 **Video generation started!**\n\nYour video is being generated by Kling 3.0 AI. This usually takes 1-3 minutes.\n\n*The video will appear here when it's ready.*`;
            send({ type: 'video_task', taskId, status: 'generating', prompt: content });
            send({ type: 'delta', content: fullContent });
          } catch (vidErr) {
            console.error('Video generation error:', vidErr);
            fullContent = `Sorry, video generation failed: ${vidErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          // Save message WITH video_task so it persists on refresh
          const videoTaskData = vidData?.data?.taskId ? { taskId: vidData.data.taskId, status: 'generating', prompt: content } : null;
          await db.collection('messages').insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'kling-3.0', provider_used: 'kie.ai', content_type: 'video',
            video_task: videoTaskData, // Save video_task for persistence
            est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
          });
          await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          controller.close();
          return;
        }

        // ── Handle location/places search ─────────────────────────────────────
        const detectPlacesIntent = (text) => {
          if (!text) return false;
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
            
            // Check if user has shared location (stored in DB)
            const userLocation = await db.collection('user_locations').findOne({ user_id: user.id });
            
            if (!locationName || /near me|nearby|around here|close by/i.test(sanitizedContent.toLowerCase())) {
              if (userLocation && userLocation.lat && userLocation.lng) {
                coords = { lat: userLocation.lat, lng: userLocation.lng };
                locationName = userLocation.address || 'your location';
              } else {
                fullContent = `📍 I don't have your location yet.\n\nTo search for places near you, please either:\n1. **Specify a location**: "Find restaurants near Times Square"\n2. **Share your location** through the Telegram bot first\n\nOr try: "Find Italian restaurants in [your city]"`;
                send({ type: 'delta', content: fullContent });
                await db.collection('messages').insertOne({
                  id: assistantMsgId, conversation_id: convId, user_id: user.id,
                  role: 'assistant', content: fullContent, created_at: new Date(),
                  model_used: model, provider_used: providerName,
                });
                await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
                send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                controller.close();
                return;
              }
            } else {
              // Geocode the location
              const geocoded = await geocodeAddress(locationName);
              if (!geocoded) {
                fullContent = `❌ Sorry, I couldn't find the location "${locationName}". Please try a more specific address or city name.`;
                send({ type: 'delta', content: fullContent });
                await db.collection('messages').insertOne({
                  id: assistantMsgId, conversation_id: convId, user_id: user.id,
                  role: 'assistant', content: fullContent, created_at: new Date(),
                  model_used: model, provider_used: providerName,
                });
                await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
                send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                controller.close();
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
            
            const places = await searchNearbyPlaces({
              lat: coords.lat,
              lng: coords.lng,
              query: placeType ? null : searchTerm,
              type: placeType,
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
          
          await db.collection('messages').insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'google-places', provider_used: 'google', content_type: 'places',
          });
          await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          controller.close();
          return;
        }

        const { stream: aiStream, searchMeta, didSearch } = await provider.generateStream({
          systemPrompt,
          messages: historyMessages,
          model,
          temperature: 0.7,
          enableWebSearch: enableWebSearch && attachments.length === 0, // disable search when analyzing files
        });

        // Extract and format sources from search
        let sources = [];
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
          // Send sources to client
          if (sources.length > 0) {
            send({ type: 'sources', sources: sources.slice(0, 6) }); // Limit to 6 sources
          }
        }

        for await (const chunk of aiStream) {
          // Handle both plain strings and objects with {delta, citations}
          if (chunk) {
            if (typeof chunk === 'string') {
              fullContent += chunk;
              send({ type: 'delta', content: chunk });
            } else if (typeof chunk === 'object' && chunk.delta) {
              fullContent += chunk.delta;
              send({ type: 'delta', content: chunk.delta });
              // Extract Perplexity citations if available
              if (chunk.citations && chunk.citations.length > 0 && sources.length === 0) {
                sources = chunk.citations;
                send({ type: 'sources', sources: sources.slice(0, 6) });
              }
            }
          }
        }

        // Estimate token usage (chars / 4 is a reasonable approximation)
        const inputText = systemPrompt + historyMessages.map(m =>
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        ).join(' ');
        const estInputTokens = Math.round(inputText.length / 4);
        const estOutputTokens = Math.round(fullContent.length / 4);

        // Save assistant message
        await db.collection('messages').insertOne({
          id: assistantMsgId, conversation_id: convId, user_id: user.id,
          role: 'assistant', content: fullContent, created_at: new Date(),
          model_used: model, provider_used: providerName,
          web_search_used: didSearch,
          sources: sources.length > 0 ? sources : undefined,
          est_input_tokens: estInputTokens,
          est_output_tokens: estOutputTokens,
        });

        await db.collection('conversations').updateOne(
          { id: convId }, { $set: { updated_at: new Date() } }
        );

        // ── Long-Term Memory Extraction (async, non-blocking) ──────────────────
        // Extract and save important facts from this conversation exchange
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

        send({ type: 'done' });
        controller.close();
      } catch (error) {
        send({ type: 'error', error: error.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ============================================================
// MULTI-MODEL COMPARISON
// ============================================================

async function handleChatCompare(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  if (!user.accepted && user.role === 'user') {
    return err('Account pending approval', 403);
  }

  const body = await request.json();
  const {
    conversationId,
    content,
    models = [], // Array of { model, provider } - max 3
    attachments = [],
    enableWebSearch = true,
  } = body;

  if (!content && attachments.length === 0) return err('content required');
  if (!models || models.length === 0) return err('models required (min 1, max 3)');
  if (models.length > 3) return err('Maximum 3 models allowed for comparison');

  const db = await getDb();

  // Rate limiting - compare mode uses 3x the rate
  if (checkChatRateLimit(user.id, models.length * 20)) {
    return err('Rate limit exceeded — comparison mode uses more quota', 429);
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
    await db.collection('conversations').insertOne({
      id: convId, user_id: user.id, title, created_at: now, updated_at: now,
    });
  }

  // Save user message
  const userMsgId = uuidv4();
  const storedContent = content + (attachments.length > 0 ? ` [+${attachments.length} attachment(s)]` : '');
  await db.collection('messages').insertOne({
    id: userMsgId, conversation_id: convId, user_id: user.id,
    role: 'user', content: storedContent, created_at: new Date(),
    is_comparison: true,
  });

  // Get recent messages for context
  const recentMessages = await db.collection('messages')
    .find({ conversation_id: convId, id: { $ne: userMsgId }, is_comparison_response: { $ne: true } })
    .sort({ created_at: -1 }).limit(20).toArray();
  recentMessages.reverse();

  const rawHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));
  const historyMessages = trimHistory(rawHistory, 4000);

  // Build user message content
  let userMessageContent;
  if (attachments.length > 0) {
    userMessageContent = [];
    if (content) userMessageContent.push({ type: 'text', text: content });
    for (const att of attachments) {
      if (att.type === 'image' && att.base64) {
        userMessageContent.push({
          type: 'image_url',
          image_url: { url: `data:${att.mimeType || 'image/jpeg'};base64,${att.base64}`, detail: 'high' },
        });
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

  const sanitizedContent = sanitizeInput(content);
  const systemPrompt = await getSystemPrompt(db, user.id);

  // Pre-fetch web search context once (shared across all models)
  let searchContext = null;
  if (enableWebSearch) {
    const { buildSearchContext } = await import('@/lib/llm/providers');
    // Simple heuristic: if content has question words or is asking for current info, do web search
    const lowerContent = sanitizedContent.toLowerCase();
    const searchTriggers = ['what is', 'who is', 'when', 'where', 'how to', 'latest', 'recent', 'news', 'today', 'current', 'price', 'weather'];
    const shouldSearch = searchTriggers.some(t => lowerContent.includes(t));
    if (shouldSearch) {
      try {
        searchContext = await buildSearchContext(sanitizedContent);
      } catch (e) {
        console.log('Web search failed for comparison:', e.message);
      }
    }
  }

  // Generate responses from all models in parallel
  const generateResponse = async (modelConfig) => {
    const { model, provider } = modelConfig;
    const { getProvider: gp, getModelInfo } = await import('@/lib/llm/providers');
    
    const modelInfo = getModelInfo(model);
    const actualProvider = provider || modelInfo?.provider || 'openai';
    const llmProvider = gp(actualProvider, model);

    // Build messages with search context if available
    let messagesWithSearch = [...historyMessages, { role: 'user', content: userMessageContent }];
    
    // Inject search context for non-Perplexity models
    if (searchContext && !actualProvider.includes('perplexity') && !model.startsWith('sonar')) {
      messagesWithSearch = [
        ...historyMessages,
        { role: 'user', content: `${searchContext}\n\n---\n\nUser question: ${typeof userMessageContent === 'string' ? userMessageContent : content}` },
      ];
    }

    // Sanitize messages for provider compatibility
    messagesWithSearch = ensureAlternatingMessages(messagesWithSearch);
    if (messagesWithSearch.length === 0 || messagesWithSearch[messagesWithSearch.length - 1]?.role !== 'user') {
      messagesWithSearch.push({ role: 'user', content: typeof userMessageContent === 'string' ? userMessageContent : content });
    }

    try {
      const startTime = Date.now();
      let responseText = '';

      // Try streaming first, fallback to non-streaming
      try {
        const { stream } = await llmProvider.generateStream({
          systemPrompt,
          messages: messagesWithSearch,
          model,
          temperature: 0.7,
          enableWebSearch: actualProvider === 'perplexity',
        });
        for await (const chunk of stream) {
          responseText += chunk;
        }
      } catch (streamErr) {
        // Fallback to non-streaming
        responseText = await llmProvider.generateChatCompletion({
          systemPrompt,
          messages: messagesWithSearch,
          model,
          temperature: 0.7,
        });
      }

      const duration = Date.now() - startTime;

      return {
        model,
        provider: actualProvider,
        label: modelInfo?.label || model,
        group: modelInfo?.group || actualProvider,
        content: responseText,
        duration,
        success: true,
        usedSearch: !!searchContext,
      };
    } catch (error) {
      console.error(`Compare error for ${model}:`, error.message);
      return {
        model,
        provider: actualProvider,
        label: modelInfo?.label || model,
        group: modelInfo?.group || actualProvider,
        content: null,
        error: error.message,
        success: false,
      };
    }
  };

  // Run all models in parallel
  const responses = await Promise.all(models.map(generateResponse));

  // Store the comparison event for analytics
  const comparisonId = uuidv4();
  await db.collection('comparisons').insertOne({
    id: comparisonId,
    user_id: user.id,
    conversation_id: convId,
    user_message_id: userMsgId,
    content: storedContent,
    models: models.map(m => m.model),
    responses: responses.map(r => ({
      model: r.model,
      provider: r.provider,
      success: r.success,
      duration: r.duration,
      content_length: r.content?.length || 0,
    })),
    created_at: new Date(),
    selected_model: null, // Will be updated when user selects
  });

  return NextResponse.json({
    success: true,
    conversationId: convId,
    comparisonId,
    userMessageId: userMsgId,
    responses,
    usedWebSearch: !!searchContext,
  });
}

// Handle selection of a comparison winner
async function handleCompareSelect(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { comparisonId, selectedModel, selectedContent } = body;

  if (!comparisonId || !selectedModel || !selectedContent) {
    return err('comparisonId, selectedModel, and selectedContent required');
  }

  const db = await getDb();

  // Verify the comparison belongs to this user
  const comparison = await db.collection('comparisons').findOne({
    id: comparisonId,
    user_id: user.id,
  });

  if (!comparison) {
    return err('Comparison not found', 404);
  }

  // Update comparison with selected model
  await db.collection('comparisons').updateOne(
    { id: comparisonId },
    { $set: { selected_model: selectedModel, selected_at: new Date() } }
  );

  // Save the selected response as the actual assistant message
  const assistantMsgId = uuidv4();
  await db.collection('messages').insertOne({
    id: assistantMsgId,
    conversation_id: comparison.conversation_id,
    user_id: user.id,
    role: 'assistant',
    content: selectedContent,
    created_at: new Date(),
    model_used: selectedModel,
    from_comparison: true,
    comparison_id: comparisonId,
  });

  // Update conversation timestamp
  await db.collection('conversations').updateOne(
    { id: comparison.conversation_id },
    { $set: { updated_at: new Date() } }
  );

  // Track user's model preferences for future recommendations
  await db.collection('user_preferences').updateOne(
    { user_id: user.id },
    {
      $inc: { [`model_selections.${selectedModel}`]: 1 },
      $set: { last_selected_model: selectedModel, updated_at: new Date() },
    },
    { upsert: true }
  );

  return NextResponse.json({
    success: true,
    messageId: assistantMsgId,
    conversationId: comparison.conversation_id,
    selectedModel,
  });
}

// IMAGE GENERATION - DALL-E 3
async function handleGenerateImage(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { prompt, size = '1024x1024', quality = 'standard', style = 'vivid' } = body;
  if (!prompt) return err('prompt required');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return err('OpenAI key not configured', 500);

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality, style }),
    });
    const data = await res.json();
    if (data.error) return err(data.error.message, 400);

    const imageUrl = data.data?.[0]?.url;
    const revisedPrompt = data.data?.[0]?.revised_prompt || prompt;

    // Save as a message in DB if conversationId provided
    const { conversationId } = body;
    if (conversationId) {
      const db = await getDb();
      await db.collection('messages').insertOne({
        id: uuidv4(), conversation_id: conversationId, user_id: user.id,
        role: 'assistant',
        content: `![Generated Image](${imageUrl})\n\n*Prompt: ${revisedPrompt}*`,
        content_type: 'image',
        image_url: imageUrl,
        created_at: new Date(),
        model_used: 'dall-e-3',
        provider_used: 'openai',
        est_input_tokens: Math.round(prompt.length / 4),
        est_output_tokens: 0,
      });
    }

    return ok({ url: imageUrl, revised_prompt: revisedPrompt });
  } catch (e) {
    console.error('Image generation error:', e);
    return err('Image generation failed: ' + e.message, 500);
  }
}

// IMAGE GENERATION - Kie.ai (GPT-4o Image / gpt4o-image)
async function handleGenerateImageKie(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { prompt, aspectRatio = '1:1', nVariants = 1, conversationId } = body;
  if (!prompt) return err('prompt required');

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  try {
    // Submit generation task (updated endpoint)
    const res = await fetch('https://api.kie.ai/api/v1/gpt4o-image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
      body: JSON.stringify({
        prompt,
        size: aspectRatio, // API uses 'size' not 'aspectRatio'
        nVariants: Math.min(nVariants, 4), // max 4 variants
      }),
    });
    const data = await res.json();
    if (data.code !== 200) return err(data.msg || 'Image generation failed', 400);

    const taskId = data.data?.taskId;
    if (!taskId) return err('No task ID returned', 500);

    // Poll for completion (max 2 minutes) - correct endpoint
    let imageUrl = null;
    let attempts = 0;
    const maxAttempts = 40;
    
    while (!imageUrl && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 3000)); // wait 3s between polls
      attempts++;
      
      const statusRes = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${kieKey}` },
      });
      const statusData = await statusRes.json();
      
      // Status: GENERATING, SUCCESS, FAILED
      if (statusData.code === 200 && statusData.data?.status === 'SUCCESS') {
        const response = statusData.data?.response;
        if (typeof response === 'string') {
          const parsed = JSON.parse(response);
          imageUrl = parsed?.resultUrls?.[0];
        } else if (response?.resultUrls) {
          imageUrl = response.resultUrls[0];
        }
        break;
      } else if (statusData.data?.status === 'FAILED') {
        return err(statusData.data?.errorMessage || 'Image generation failed', 500);
      }
    }

    if (!imageUrl) return err('Image generation timed out', 504);

    // Save as a message in DB if conversationId provided
    if (conversationId) {
      const db = await getDb();
      await db.collection('messages').insertOne({
        id: uuidv4(), conversation_id: conversationId, user_id: user.id,
        role: 'assistant',
        content: `![Generated Image](${imageUrl})\n\n*Prompt: ${prompt}*`,
        content_type: 'image',
        image_url: imageUrl,
        created_at: new Date(),
        model_used: 'gpt-4o-image',
        provider_used: 'kie',
        est_input_tokens: Math.round(prompt.length / 4),
        est_output_tokens: 0,
      });
    }

    return ok({ url: imageUrl, prompt, provider: 'kie' });
  } catch (e) {
    console.error('Kie image generation error:', e);
    return err('Image generation failed: ' + e.message, 500);
  }
}

// Helper: Generate image with Kie.ai (for internal use, e.g., Telegram)
async function generateImageWithKie(prompt, aspectRatio = '1:1') {
  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) throw new Error('Kie.ai key not configured');

  // Submit task (updated endpoint: gpt4o-image)
  const res = await fetch('https://api.kie.ai/api/v1/gpt4o-image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
    body: JSON.stringify({
      prompt,
      size: aspectRatio, // API uses 'size' not 'aspectRatio'
      nVariants: 1,
    }),
  });
  const data = await res.json();
  if (data.code !== 200) throw new Error(data.msg || 'Image generation failed');

  const taskId = data.data?.taskId;
  if (!taskId) throw new Error('No task ID returned');

  // Poll for completion (correct endpoint: gpt4o-image/record-info)
  let imageUrl = null;
  let attempts = 0;
  const maxAttempts = 40; // ~2 minutes

  while (!imageUrl && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 3000));
    attempts++;
    
    const statusRes = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    const statusData = await statusRes.json();
    
    // Status: GENERATING, SUCCESS, FAILED
    if (statusData.code === 200 && statusData.data?.status === 'SUCCESS') {
      // Parse response JSON to get resultUrls
      const response = statusData.data?.response;
      if (typeof response === 'string') {
        const parsed = JSON.parse(response);
        imageUrl = parsed?.resultUrls?.[0];
      } else if (response?.resultUrls) {
        imageUrl = response.resultUrls[0];
      }
      break;
    } else if (statusData.data?.status === 'FAILED') {
      throw new Error(statusData.data?.errorMessage || 'Image generation failed');
    }
  }

  if (!imageUrl) throw new Error('Image generation timed out');
  return imageUrl;
}

// VIDEO GENERATION - Kie.ai (using Kling 3.0)
async function handleGenerateVideo(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { prompt, duration = 5, quality = '720p', aspectRatio = '16:9', conversationId } = body;
  if (!prompt) return err('prompt required');

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  try {
    // Use Kling 3.0 via the unified Jobs API
    const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
      body: JSON.stringify({ 
        model: 'kling-3.0/video',
        input: {
          prompt, 
          duration: String(duration),
          mode: 'std',
          sound: false,
          multi_shots: false,
        }
      }),
    });
    const data = await res.json();
    console.log('handleGenerateVideo Kie.ai response:', JSON.stringify(data).substring(0, 500));
    if (data.code !== 200) return err(data.msg || data.error || 'Video generation failed', 400);

    const taskId = data.data?.taskId;
    if (!taskId) return err('No task ID returned', 500);

    // Store task in DB
    const db = await getDb();
    const jobId = uuidv4();
    await db.collection('video_jobs').insertOne({
      id: jobId, task_id: taskId, user_id: user.id,
      prompt, duration, quality, aspect_ratio: aspectRatio,
      status: 'generating', model: 'kling-3.0',
      conversation_id: conversationId || null,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    return ok({ jobId, taskId, status: 'generating' });
  } catch (e) {
    console.error('Video generation error:', e);
    return err('Video generation failed: ' + e.message, 500);
  }
}

// VIDEO STATUS - Poll Kie.ai
async function handleVideoStatus(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  // Try finding in video_jobs first (legacy), then in media_gallery (new)
  let job = await db.collection('video_jobs').findOne({ task_id: taskId, user_id: user.id });
  if (!job) {
    job = await db.collection('video_jobs').findOne({ task_id: taskId });
  }
  if (!job) {
    // Try media_gallery collection (new flow)
    job = await db.collection('media_gallery').findOne({ task_id: taskId, user_id: user.id });
  }
  if (!job) {
    job = await db.collection('media_gallery').findOne({ task_id: taskId });
  }
  if (!job) return err('Job not found', 404);
  
  // Determine which collection this job is in
  const collection = job.type === 'video' ? 'media_gallery' : 'video_jobs';

  // If already complete, return cached result (handle both 'success' and 'completed' status)
  if (job.status === 'success' || job.status === 'completed') {
    return ok({ status: 'success', videoUrl: job.video_url || job.url, thumbnailUrl: job.thumbnail_url, prompt: job.prompt });
  }
  if (job.status === 'failed') {
    return ok({ status: 'failed', error: job.error });
  }

  // Poll Kie.ai using the Jobs API query endpoint
  const kieKey = process.env.KIE_API_KEY;
  try {
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    const data = await res.json();
    if (data.code !== 200) return err(data.msg || 'Status check failed', 400);

    // Kie.ai uses 'state' field, normalize to lowercase
    const state = (data.data?.state || data.data?.status || '').toLowerCase();
    
    // For successful videos, parse resultJson or get from output
    let videoUrl = null;
    let thumbnailUrl = null;
    
    if (data.data?.resultJson) {
      try {
        const resultJson = JSON.parse(data.data.resultJson);
        videoUrl = resultJson?.resultUrls?.[0] || resultJson?.videoUrl || resultJson?.video_url;
        thumbnailUrl = resultJson?.coverUrl || resultJson?.cover_url || resultJson?.thumbnail;
      } catch (e) {
        console.error('Failed to parse video resultJson:', e);
      }
    }
    
    // Fallback to output object if available
    if (!videoUrl) {
      const output = data.data?.output || {};
      videoUrl = output.video_url || output.videoUrl;
      thumbnailUrl = thumbnailUrl || output.cover_url || output.imageUrl;
    }

    if (state === 'success' && videoUrl) {
      await db.collection(collection).updateOne({ task_id: taskId }, {
        $set: { status: 'completed', url: videoUrl, video_url: videoUrl, thumbnail_url: thumbnailUrl, completed_at: new Date() },
      });
      // UPDATE the original message with video_url instead of creating a new one
      if (job.message_id) {
        await db.collection('messages').updateOne(
          { id: job.message_id },
          { 
            $set: { 
              video_url: videoUrl, 
              thumbnail_url: thumbnailUrl,
              content: `🎬 **Video generated!**\n\n**Prompt:** ${job.prompt}`,
              'video_task.status': 'success'
            } 
          }
        );
      } else if (job.conversation_id) {
        // Fallback for old jobs without message_id - create new message
        await db.collection('messages').insertOne({
          id: uuidv4(), conversation_id: job.conversation_id, user_id: user.id,
          role: 'assistant',
          content: `🎬 **Video generated!**\n\n**Prompt:** ${job.prompt}\n\n[▶ Download / View Video](${videoUrl})${thumbnailUrl ? `\n\n![Thumbnail](${thumbnailUrl})` : ''}`,
          content_type: 'video',
          video_url: videoUrl,
          created_at: new Date(),
          model_used: job.model || 'kling-3.0',
          provider_used: 'kie.ai',
        });
      }
      return ok({ status: 'success', videoUrl, thumbnailUrl, prompt: job.prompt });
    } else if (state === 'failed' || state === 'fail') {
      const errMsg = data.data?.error || 'Generation failed';
      await db.collection(collection).updateOne({ task_id: taskId }, {
        $set: { status: 'failed', error: errMsg },
      });
      return ok({ status: 'failed', error: errMsg });
    }

    return ok({ status: 'generating', progress: null, state });
  } catch (e) {
    console.error('Video status error:', e);
    return err('Status check failed: ' + e.message, 500);
  }
}

// ============================================================
// UNIFIED MEDIA GENERATION API
// ============================================================

// Model endpoint mappings for Kie.ai (using unified jobs API)
// Model names follow the format: provider/model-name 
// Costs are in Kie.ai credits (1 credit = $0.005)
// Each model has its own input parameter format
const KIE_IMAGE_MODELS = {
  'seedream-5-lite': { 
    model: 'bytedance/seedream', 
    useJobsApi: true, 
    credits: 5.5,
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      image_size: { '1:1': 'square_hd', '16:9': 'landscape_16_9', '9:16': 'portrait_9_16' }[aspectRatio] || 'square_hd',
      guidance_scale: 2.5,
      enable_safety_checker: true,
    })
  },
  'nano-banana': { 
    model: 'google/nano-banana', 
    useJobsApi: true, 
    credits: 10,
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      image_size: aspectRatio || '1:1', // Uses ratio format like "1:1", "16:9"
      output_format: 'png',
    })
  },
  'gpt4o-image': { 
    model: 'openai/gpt-4o-image', 
    useJobsApi: true, 
    credits: 20,
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      size: { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792' }[aspectRatio] || '1024x1024',
    })
  },
  'flux-pro': { 
    model: 'black-forest-labs/flux-1.1-pro', 
    useJobsApi: true, 
    credits: 25,
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      image_size: { '1:1': 'square_hd', '16:9': 'landscape_16_9', '9:16': 'portrait_9_16' }[aspectRatio] || 'square_hd',
    })
  },
  'midjourney-v7': { 
    model: 'midjourney/v7-imagine', 
    useJobsApi: true, 
    credits: 40,
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
    })
  },
  'gpt-image-1-5': { 
    model: 'gpt-image/1.5-text-to-image', 
    useJobsApi: true, 
    credits: 50,
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
      quality: 'high',
    })
  },
};

// Video costs - base credits per video (duration affects some models)
const KIE_VIDEO_MODELS = {
  'kling-3': { 
    model: 'kling-3.0/video', 
    useJobsApi: true, 
    credits: 20,
    formatInput: (prompt, aspectRatio, duration) => ({
      prompt: prompt,
      duration: duration || '5',
      aspect_ratio: aspectRatio || '16:9',
      mode: 'std',
      sound: false,
      multi_shots: false,
      multi_prompt: [],
      kling_elements: [],
    })
  },
  'kling-3-pro': { 
    model: 'kling-3.0/video', 
    useJobsApi: true, 
    credits: 27,
    formatInput: (prompt, aspectRatio, duration) => ({
      prompt: prompt,
      duration: duration || '5',
      aspect_ratio: aspectRatio || '16:9',
      mode: 'pro',
      sound: false,
      multi_shots: false,
      multi_prompt: [],
      kling_elements: [],
    })
  },
  'sora-2': { 
    model: 'openai/sora-2-text-to-video', 
    useJobsApi: true, 
    credits: 30,  // ~$0.15 for 10s
    formatInput: (prompt, aspectRatio, duration) => ({
      prompt: prompt,
      aspect_ratio: aspectRatio === '9:16' ? 'portrait' : 'landscape',
      n_frames: duration || '10',
      remove_watermark: true,
      upload_method: 's3',
    })
  },
  'sora-2-pro': { 
    model: 'openai/sora-2-pro-text-to-video', 
    useJobsApi: true, 
    credits: 100,  // ~$0.50 for 10s HD
    formatInput: (prompt, aspectRatio, duration) => ({
      prompt: prompt,
      aspect_ratio: aspectRatio === '9:16' ? 'portrait' : 'landscape',
      n_frames: duration || '10',
      upload_method: 's3',
    })
  },
  'kling-2-6': { 
    model: 'kling-2.6/text-to-video', 
    useJobsApi: true, 
    credits: 55,
    formatInput: (prompt, aspectRatio, duration) => ({
      prompt: prompt,
      duration: duration || '5',
      aspect_ratio: aspectRatio || '16:9',
      sound: false,
    })
  },
  'wan-2-6': { 
    model: 'wan-2.6/text-to-video', 
    useJobsApi: true, 
    credits: 70,
    formatInput: (prompt, aspectRatio, duration) => ({
      prompt: prompt,
      duration: duration || '5',
    })
  },
  'seedance-1-5': { 
    model: 'bytedance/seedance-1.5-pro', 
    useJobsApi: true, 
    credits: 50,
    formatInput: (prompt, aspectRatio, duration) => ({
      prompt: prompt,
      duration: duration || '5',
    })
  },
};

// Kie.ai credit to USD conversion (1 credit = $0.005)
const KIE_CREDIT_TO_USD = 0.005;

// ============================================================
// DYNAMIC INTELLIGENCE FOR MEDIA GENERATION
// ============================================================

// Analyze prompt and recommend the best image model
function selectBestImageModel(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  // Keywords and patterns for different use cases
  const patterns = {
    // Photorealistic - Nano Banana or Flux
    photorealistic: /\b(photo|photograph|realistic|real|hd|4k|portrait|headshot|professional|corporate|stock photo|documentary)\b/i,
    // Text-heavy - Ideogram or Seedream
    textHeavy: /\b(logo|text|typography|sign|poster|banner|flyer|advertisement|brand|label|t-shirt design|title|headline|letters|words|writing)\b/i,
    // Artistic/Creative - Midjourney
    artistic: /\b(art|artistic|fantasy|surreal|dream|magical|ethereal|abstract|painting|illustration|anime|manga|concept art|cinematic|epic|dramatic|vibrant|colorful)\b/i,
    // Product/Commercial - Flux Pro or GPT Image
    product: /\b(product|ecommerce|catalog|mockup|packaging|commercial|marketing|advertisement|studio shot|white background)\b/i,
    // Quick/Simple - Seedream Lite
    simple: /\b(simple|basic|quick|icon|emoji|avatar|thumbnail|sketch|draft)\b/i,
  };
  
  // Check patterns and return recommendation
  if (patterns.textHeavy.test(lowerPrompt)) {
    return {
      model: 'seedream-5-lite',
      reason: '📝 Text rendering - Seedream excels at text clarity',
      confidence: 'high'
    };
  }
  
  if (patterns.artistic.test(lowerPrompt)) {
    return {
      model: 'midjourney-v7',
      reason: '🎨 Artistic/creative style - Midjourney creates stunning art',
      confidence: 'high'
    };
  }
  
  if (patterns.photorealistic.test(lowerPrompt)) {
    return {
      model: 'nano-banana',
      reason: '📷 Photorealistic - Nano Banana for natural imagery',
      confidence: 'high'
    };
  }
  
  if (patterns.product.test(lowerPrompt)) {
    return {
      model: 'flux-pro',
      reason: '🛍️ Product/commercial - Flux Pro for clean commercial shots',
      confidence: 'high'
    };
  }
  
  if (patterns.simple.test(lowerPrompt)) {
    return {
      model: 'seedream-5-lite',
      reason: '⚡ Quick generation - Seedream Lite is fast and affordable',
      confidence: 'medium'
    };
  }
  
  // Default to Nano Banana for general requests
  return {
    model: 'nano-banana',
    reason: '🖼️ General image - Nano Banana for versatile quality',
    confidence: 'default'
  };
}

// Analyze prompt and recommend the best video model
function selectBestVideoModel(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  const patterns = {
    // Cinematic/Storytelling - Sora 2 Pro or Kling 3 Pro
    cinematic: /\b(cinematic|film|movie|story|narrative|scene|dramatic|epic|professional|high quality|4k|hd|hollywood|blockbuster)\b/i,
    // Talking/Speech - Wan 2.6
    talking: /\b(talking|speaking|dialogue|conversation|interview|presentation|lip sync|speech|voice|saying|tell|narrator|podcast|vlog)\b/i,
    // Dance/Motion - Seedance
    dance: /\b(dance|dancing|choreography|movement|motion|action|dynamic|animated|energetic|music video)\b/i,
    // OpenAI style - realistic, detailed
    realistic: /\b(realistic|real|photorealistic|natural|documentary|news|authentic)\b/i,
    // Quick/Simple - Kling 3 Std
    simple: /\b(simple|quick|short|basic|demo|test|preview|draft|fast)\b/i,
  };
  
  if (patterns.talking.test(lowerPrompt)) {
    return {
      model: 'wan-2-6',
      reason: '🎙️ Speech/dialogue - Wan 2.6 has excellent lip sync',
      confidence: 'high'
    };
  }
  
  if (patterns.dance.test(lowerPrompt)) {
    return {
      model: 'seedance-1-5',
      reason: '💃 Motion/dance - Seedance specializes in movement',
      confidence: 'high'
    };
  }
  
  if (patterns.cinematic.test(lowerPrompt)) {
    return {
      model: 'sora-2',
      reason: '🎬 Cinematic quality - Sora 2 by OpenAI for high-end video',
      confidence: 'high'
    };
  }
  
  if (patterns.realistic.test(lowerPrompt)) {
    return {
      model: 'sora-2',
      reason: '📽️ Realistic video - Sora 2 excels at natural scenes',
      confidence: 'high'
    };
  }
  
  if (patterns.simple.test(lowerPrompt)) {
    return {
      model: 'kling-3',
      reason: '⚡ Quick generation - Kling 3 Std is fast and affordable',
      confidence: 'medium'
    };
  }
  
  // Default to Kling 3 Standard for general requests
  return {
    model: 'kling-3',
    reason: '🎥 General video - Kling 3.0 for versatile quality',
    confidence: 'default'
  };
}

// Unified function to get best media model
function selectBestMediaModel(type, prompt) {
  if (type === 'image') {
    return selectBestImageModel(prompt);
  } else if (type === 'video') {
    return selectBestVideoModel(prompt);
  }
  return null;
}

// API endpoint to get smart model recommendation
async function handleMediaRecommend(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'image' or 'video'
  const prompt = searchParams.get('prompt');

  if (!type || !['image', 'video'].includes(type)) {
    return err('type must be "image" or "video"');
  }
  if (!prompt) {
    return err('prompt required');
  }

  const recommendation = selectBestMediaModel(type, prompt);
  
  // Get model details
  const modelConfig = type === 'image' 
    ? KIE_IMAGE_MODELS[recommendation.model]
    : KIE_VIDEO_MODELS[recommendation.model];
  
  return ok({
    type,
    model: recommendation.model,
    reason: recommendation.reason,
    confidence: recommendation.confidence,
    credits: modelConfig?.credits || null,
    estimatedCost: modelConfig ? `$${(modelConfig.credits * KIE_CREDIT_TO_USD).toFixed(2)}` : null,
  });
}

// Generate image or video using the unified Kie.ai API
async function handleMediaGenerate(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  let { type, model, prompt, aspectRatio = '1:1', duration = '5', conversationId } = body;

  // Ensure duration is a string
  duration = String(duration);

  if (!type || !['image', 'video'].includes(type)) return err('type must be "image" or "video"');
  if (!prompt) return err('prompt required');

  // Support "smart" mode - auto-select best model based on prompt
  let smartSelection = null;
  if (!model || model === 'smart') {
    smartSelection = selectBestMediaModel(type, prompt);
    model = smartSelection.model;
    console.log(`[Dynamic Intelligence] ${type} generation: Selected ${model} - ${smartSelection.reason}`);
  }

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  const db = await getDb();

  // Map aspect ratios to Kie.ai formats
  const imageSizeMap = {
    '1:1': 'square_hd',
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_9_16',
    '4:3': 'landscape_4_3',
  };

  try {
    if (type === 'image') {
      const modelConfig = KIE_IMAGE_MODELS[model];
      if (!modelConfig) return err(`Unknown image model: ${model}`, 400);

      let taskId, imageUrl;

      if (modelConfig.useJobsApi) {
        // Use unified Jobs API with model-specific input format
        const inputParams = modelConfig.formatInput ? 
          modelConfig.formatInput(prompt, aspectRatio) : 
          { prompt, image_size: imageSizeMap[aspectRatio] || 'square_hd' };
        
        const requestBody = {
          model: modelConfig.model,
          input: inputParams,
        };
        console.log('Kie.ai request:', JSON.stringify(requestBody, null, 2));
        
        const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify(requestBody),
        });
        const data = await res.json();
        console.log('Kie.ai response:', JSON.stringify(data, null, 2));
        
        if (data.code !== 200) {
          console.error('Kie.ai Jobs API error:', data);
          return err(data.msg || data.error || 'Image generation failed', 400);
        }

        taskId = data.data?.taskId;
        if (!taskId) return err('No task ID returned', 500);

        // Poll for completion using Jobs API
        let attempts = 0;
        const maxAttempts = 60;

        while (!imageUrl && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 3000));
          attempts++;

          const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${kieKey}` },
          });
          const statusData = await statusRes.json();

          if (statusData.code === 200) {
            const status = statusData.data?.state;
            if (status === 'success') {
              // Parse resultJson to get image URL
              try {
                const resultJson = JSON.parse(statusData.data?.resultJson || '{}');
                imageUrl = resultJson?.resultUrls?.[0] || resultJson?.url || resultJson?.image_url;
              } catch (e) {
                console.error('Failed to parse resultJson:', e);
              }
              if (imageUrl) break;
            } else if (status === 'fail') {
              return err(statusData.data?.failMsg || 'Image generation failed', 500);
            }
            // Still waiting/queuing/generating - continue polling
          }
        }
      } else {
        // Use legacy endpoint
        const res = await fetch(`https://api.kie.ai/api/v1/${modelConfig.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify({
            prompt,
            size: aspectRatio,
            nVariants: 1,
            aspectRatio: aspectRatio,
          }),
        });
        const data = await res.json();
        
        if (data.code !== 200) {
          console.error('Kie.ai image error:', data);
          return err(data.msg || 'Image generation failed', 400);
        }

        taskId = data.data?.taskId;
        if (!taskId) return err('No task ID returned', 500);

        // Poll for completion using legacy endpoint
        let attempts = 0;
        const maxAttempts = 60;

        while (!imageUrl && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 3000));
          attempts++;

          const statusRes = await fetch(`https://api.kie.ai/api/v1/${modelConfig.statusEndpoint}?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${kieKey}` },
          });
          const statusData = await statusRes.json();

          if (statusData.code === 200) {
            const status = statusData.data?.status || statusData.data?.state;
            if (status === 'SUCCESS' || status === 'success') {
              const response = statusData.data?.response;
              if (typeof response === 'string') {
                try {
                  const parsed = JSON.parse(response);
                  imageUrl = parsed?.resultUrls?.[0] || parsed?.url || parsed?.imageUrl;
                } catch (e) {
                  imageUrl = response;
                }
              } else if (response?.resultUrls) {
                imageUrl = response.resultUrls[0];
              } else if (statusData.data?.resultUrls) {
                imageUrl = statusData.data.resultUrls[0];
              } else if (statusData.data?.url) {
                imageUrl = statusData.data.url;
              } else if (statusData.data?.imageUrl) {
                imageUrl = statusData.data.imageUrl;
              }
              break;
            } else if (status === 'FAILED' || status === 'fail') {
              return err(statusData.data?.errorMessage || statusData.data?.failMsg || 'Image generation failed', 500);
            }
          }
        }
      }

      if (!imageUrl) return err('Image generation timed out', 500);

      // Save to gallery with cost tracking
      const mediaId = uuidv4();
      const modelLabels = {
        'seedream-5-lite': 'Seedream 5.0 Lite',
        'nano-banana': 'Nano Banana',
        'gpt4o-image': 'GPT-4o Image',
        'flux-pro': 'Flux Pro',
        'midjourney-v7': 'Midjourney V7',
        'gpt-image-1-5': 'GPT Image 1.5',
      };

      const credits = modelConfig.credits || 10;
      const costUsd = parseFloat((credits * KIE_CREDIT_TO_USD).toFixed(4));

      await db.collection('media_gallery').insertOne({
        id: mediaId,
        user_id: user.id,
        type: 'image',
        model,
        model_label: modelLabels[model] || model,
        prompt,
        url: imageUrl,
        aspect_ratio: aspectRatio,
        conversation_id: conversationId || null,
        credits_used: credits,
        cost_usd: costUsd,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      return ok({ success: true, url: imageUrl, mediaId, type: 'image' });

    } else if (type === 'video') {
      const modelConfig = KIE_VIDEO_MODELS[model];
      if (!modelConfig) return err(`Unknown video model: ${model}`, 400);

      let taskId;
      const aspectRatioForVideo = aspectRatio === '1:1' ? '16:9' : aspectRatio;

      if (modelConfig.useJobsApi) {
        // Use unified Jobs API for video generation
        const safeAspectRatio = aspectRatioForVideo || '16:9';
        const safeDuration = duration || '5';
        const inputData = modelConfig.formatInput 
          ? modelConfig.formatInput(prompt, safeAspectRatio, safeDuration)
          : { prompt, duration: safeDuration, aspect_ratio: '16:9' };
        
        const requestBody = {
          model: modelConfig.model,
          input: inputData,
        };
        
        console.log('Kie.ai video request body:', JSON.stringify(requestBody, null, 2));
        console.log('Video generation params - duration:', safeDuration, 'aspectRatio:', safeAspectRatio);
        
        const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify(requestBody),
        });
        const data = await res.json();
        
        console.log('Kie.ai Jobs API video response:', JSON.stringify(data).substring(0, 500));

        if (data.code !== 200) {
          console.error('Kie.ai Jobs API video error:', data);
          return err(data.msg || data.error || 'Video generation failed', 400);
        }

        taskId = data.data?.taskId;
      } else {
        // Use legacy endpoint
        const videoParams = {
          prompt,
          ...modelConfig.params,
          aspectRatio: aspectRatioForVideo,
        };

        const res = await fetch(`https://api.kie.ai/api/v1/${modelConfig.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify(videoParams),
        });
        const data = await res.json();

        console.log('Kie.ai legacy video response:', JSON.stringify(data).substring(0, 500));

        if (data.code !== 200) {
          console.error('Kie.ai video error:', data);
          return err(data.msg || 'Video generation failed', 400);
        }

        taskId = data.data?.taskId;
      }

      if (!taskId) return err('No task ID returned', 500);

      // Store video job for async polling
      const mediaId = uuidv4();
      const modelLabels = {
        'kling-3': 'Kling 3.0 (Std)',
        'kling-3-pro': 'Kling 3.0 (Pro)',
        'sora-2': 'Sora 2',
        'sora-2-pro': 'Sora 2 Pro (HD)',
        'kling-2-6': 'Kling 2.6',
        'wan-2-6': 'Wan 2.6',
        'seedance-1-5': 'Seedance 1.5 Pro',
      };

      const credits = modelConfig.credits || 50;
      const costUsd = parseFloat((credits * KIE_CREDIT_TO_USD).toFixed(4));

      await db.collection('media_gallery').insertOne({
        id: mediaId,
        user_id: user.id,
        type: 'video',
        model,
        model_label: modelLabels[model] || model,
        prompt,
        url: null, // Will be updated when complete
        task_id: taskId,
        status: 'generating',
        aspect_ratio: aspectRatioForVideo,
        conversation_id: conversationId || null,
        credits_used: credits,
        cost_usd: costUsd,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        use_jobs_api: modelConfig.useJobsApi || false, // Track which API to use for status
      });

      return ok({ success: true, taskId, mediaId, type: 'video', status: 'generating' });
    }
  } catch (e) {
    console.error('Media generation error:', e);
    return err('Media generation failed: ' + e.message, 500);
  }
}

// Poll video/image status by taskId path param (for /api/media/status/:taskId)
async function handleMediaStatusByTaskId(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  if (!taskId) return err('taskId required');
  
  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);
  
  const db = await getDb();
  
  // Find the media item by task_id
  const media = await db.collection('media_gallery').findOne({ task_id: taskId, user_id: user.id });
  
  // Also check video_jobs collection for legacy entries
  if (!media) {
    const videoJob = await db.collection('video_jobs').findOne({ task_id: taskId, user_id: user.id });
    if (!videoJob) return err('Media not found', 404);
    
    // If job is already complete/failed
    if (videoJob.status === 'success' && videoJob.video_url) {
      return ok({ status: 'completed', url: videoJob.video_url, thumbnail_url: videoJob.thumbnail_url });
    }
    if (videoJob.status === 'failed') {
      return ok({ status: 'failed', error: videoJob.error });
    }
    
    // Poll Kie.ai
    try {
      const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${kieKey}` },
      });
      const data = await statusRes.json();
      
      const state = data.data?.status?.toLowerCase() || data.data?.state?.toLowerCase();
      const output = data.data?.output || {};
      const videoUrl = output.video_url || output.videoUrl;
      const thumbnailUrl = output.cover_url || output.coverUrl;
      
      if (state === 'success' && videoUrl) {
        await db.collection('video_jobs').updateOne(
          { task_id: taskId },
          { $set: { status: 'success', video_url: videoUrl, thumbnail_url: thumbnailUrl, completed_at: new Date() } }
        );
        return ok({ status: 'completed', url: videoUrl, thumbnail_url: thumbnailUrl });
      } else if (state === 'failed' || state === 'fail') {
        const error = data.data?.error || 'Generation failed';
        await db.collection('video_jobs').updateOne(
          { task_id: taskId },
          { $set: { status: 'failed', error } }
        );
        return ok({ status: 'failed', error });
      }
      
      return ok({ status: 'generating', progress: state || 'processing...' });
    } catch (e) {
      console.error('Video status poll error:', e);
      return ok({ status: 'generating', progress: 'checking...' });
    }
  }
  
  // If found in media_gallery, handle as before
  if (media.status === 'completed' && media.url) {
    return ok({ status: 'completed', url: media.url, thumbnail_url: media.thumbnail_url });
  }
  if (media.status === 'failed') {
    return ok({ status: 'failed', error: media.error });
  }
  
  // Poll Kie.ai
  try {
    const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    const data = await statusRes.json();
    return processVideoStatus(db, media, data);
  } catch (e) {
    console.error('Media status error:', e);
    return ok({ status: 'generating', progress: 'checking...' });
  }
}

// Check status of async media generation (videos)
async function handleMediaStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const taskId = url.searchParams.get('taskId');
  if (!taskId) return err('taskId required');

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  const db = await getDb();
  
  // Find the media item
  const media = await db.collection('media_gallery').findOne({ task_id: taskId, user_id: user.id });
  if (!media) return err('Media not found', 404);

  // If already completed, return cached result
  if (media.status === 'completed' && media.url) {
    return ok({ status: 'completed', url: media.url, thumbnail_url: media.thumbnail_url });
  }
  if (media.status === 'failed') {
    return ok({ status: 'failed', error: media.error });
  }

  try {
    // Determine which endpoint to use based on model
    const modelConfig = KIE_VIDEO_MODELS[media.model];
    let statusRes;
    
    // Use the unified Jobs API query endpoint for all models
    statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    
    const data = await statusRes.json();
    console.log('Video status response for model', media.model, ':', JSON.stringify(data).substring(0, 500));
    return processVideoStatus(db, media, data);
  } catch (e) {
    console.error('Media status error:', e);
    return ok({ status: 'generating', progress: 'checking...' });
  }
}

// Helper to process video status response
async function processVideoStatus(db, media, data) {
  if (data.code !== 200) {
    return ok({ status: 'generating', progress: 'processing...' });
  }

  const state = data.data?.status?.toLowerCase() || data.data?.state?.toLowerCase();
  
  if (state === 'success') {
    // Video ready - check the output object (Jobs API format)
    let videoUrl = null;
    let thumbnailUrl = null;
    const output = data.data?.output || {};
    
    // Jobs API format - output object
    videoUrl = output.video_url || output.videoUrl || output.url;
    thumbnailUrl = output.cover_url || output.coverUrl || output.imageUrl;
    
    // Try parsing resultJson if output didn't have the URL
    if (!videoUrl && data.data?.resultJson) {
      try {
        const resultJson = JSON.parse(data.data.resultJson);
        videoUrl = resultJson?.resultUrls?.[0] || 
                   resultJson?.videoUrl || 
                   resultJson?.url ||
                   resultJson?.video_url;
        thumbnailUrl = thumbnailUrl || resultJson?.thumbnail || 
                       resultJson?.coverUrl ||
                       resultJson?.cover_url;
        console.log('Parsed resultJson for video:', { videoUrl, thumbnailUrl });
      } catch (e) {
        console.error('Failed to parse video resultJson:', e);
      }
    }
    
    // Fall back to direct fields (legacy API format)
    if (!videoUrl) {
      videoUrl = data.data?.works?.[0]?.resource || 
                 data.data?.resultUrls?.[0] || 
                 data.data?.videoUrl ||
                 data.data?.url;
      thumbnailUrl = thumbnailUrl || 
                     data.data?.works?.[0]?.coverImage || 
                     data.data?.thumbnail ||
                     data.data?.coverUrl;
    }

    if (videoUrl) {
      await db.collection('media_gallery').updateOne(
        { id: media.id },
        { $set: { status: 'completed', url: videoUrl, thumbnail_url: thumbnailUrl } }
      );
      return ok({ status: 'completed', url: videoUrl, thumbnail_url: thumbnailUrl });
    } else {
      console.log('Video status success but no URL found in:', JSON.stringify(data.data).substring(0, 500));
    }
  } else if (state === 'fail' || state === 'failed') {
    const error = data.data?.error || data.data?.failMsg || data.data?.errorMessage || 'Generation failed';
    await db.collection('media_gallery').updateOne(
      { id: media.id },
      { $set: { status: 'failed', error } }
    );
    return ok({ status: 'failed', error });
  }

  return ok({ status: 'generating', progress: state || 'processing...' });
}

// Get user's media gallery
async function handleMediaGallery(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  const items = await db.collection('media_gallery')
    .find({ 
      user_id: user.id,
      $or: [
        { status: { $ne: 'failed' } },
        { status: { $exists: false } }
      ]
    })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray();

  return NextResponse.json(items);
}

// Delete media item from gallery
async function handleDeleteMedia(request, mediaId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  if (!mediaId) return err('mediaId required');

  const db = await getDb();
  
  // Find and verify ownership
  const item = await db.collection('media_gallery').findOne({ id: mediaId });
  if (!item) return err('Media not found', 404);
  if (item.user_id !== user.id) return err('Unauthorized', 403);

  // Delete from media_gallery
  await db.collection('media_gallery').deleteOne({ id: mediaId });

  // Also delete from video_jobs if it's a video
  if (item.type === 'video' && item.task_id) {
    await db.collection('video_jobs').deleteOne({ task_id: item.task_id });
  }

  return ok({ success: true, deletedId: mediaId });
}

// FEEDBACK - Submit
async function handleSubmitFeedback(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { conversation_id, message_id, rating, note, context } = body;

  const db = await getDb();
  await db.collection('feedback').insertOne({
    id: uuidv4(),
    user_id: user.id,
    conversation_id,
    message_id,
    rating, // 'up' or 'down'
    note: note || '',
    context: context || {}, // Store model info and timestamp
    created_at: new Date(),
  });

  // Update message with feedback for analytics
  if (conversation_id && message_id) {
    await db.collection('conversations').updateOne(
      { id: conversation_id, 'messages.id': message_id },
      { $set: { 'messages.$.user_feedback': rating } }
    );
  }

  return ok({ success: true });
}

// USER FEEDBACK - Submit general feedback (not message-specific)
// Allows both authenticated and anonymous feedback
async function handleSubmitUserFeedback(request) {
  const user = await authenticate(request);
  // Note: user can be null for anonymous feedback

  const body = await request.json();
  const { message, category, rating, attachment } = body;

  if (!message || message.trim().length < 5) {
    return err('Please provide feedback message (at least 5 characters)', 400);
  }

  const feedbackId = uuidv4();
  const db = await getDb();
  
  // Prepare feedback document
  const feedbackDoc = {
    id: feedbackId,
    user_id: user?.id || null,
    user_email: user?.email || 'anonymous',
    anonymous: !user,
    message: message.trim(),
    category: category || 'general', // general, bug, feature, other
    rating: rating || null, // 1-5 optional rating
    status: 'new', // new, reviewed, resolved
    created_at: new Date(),
  };
  
  // Handle attachment if provided (base64 image)
  if (attachment && attachment.base64 && attachment.mimeType) {
    feedbackDoc.attachment = {
      name: attachment.name || 'screenshot.png',
      mimeType: attachment.mimeType,
      base64: attachment.base64,
    };
  }
  
  await db.collection('user_feedback').insertOne(feedbackDoc);

  // Send notification email to reggie@archeforge.com
  const emailSource = user?.email || 'Anonymous User';
  sendFeedbackNotificationEmail(emailSource, message.trim(), category, rating, attachment).catch(err => {
    console.error('Failed to send feedback notification email:', err);
  });

  return ok({ success: true, message: 'Thank you for your feedback!' });
}

// Helper to send feedback notification via email
async function sendFeedbackNotificationEmail(userEmail, feedbackMessage, category, rating, attachment) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log(`[FEEDBACK] Email not sent - no API key. From: ${userEmail} | Category: ${category}`);
    return;
  }

  const categoryEmoji = {
    'general': '💬',
    'bug': '🐛',
    'feature': '💡',
    'other': '📝'
  }[category] || '💬';

  const ratingDisplay = rating ? `${'⭐'.repeat(rating)} (${rating}/5)` : 'Not provided';
  
  // Build HTML email
  let htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 24px; color: white;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #f97316;">🔔 New SoulPrint Feedback</h1>
        <p style="margin: 0; color: #9ca3af; font-size: 14px;">A user has submitted feedback</p>
      </div>
      
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 16px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">From:</td>
            <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Category:</td>
            <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${categoryEmoji} ${category.charAt(0).toUpperCase() + category.slice(1)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Rating:</td>
            <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${ratingDisplay}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-top: 16px;">
        <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Feedback Message</h3>
        <p style="margin: 0; color: #1f2937; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${feedbackMessage}</p>
      </div>
      
      ${attachment ? `
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 12px; padding: 16px; margin-top: 16px;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">📎 <strong>Attachment included:</strong> ${attachment.name || 'screenshot'}</p>
        <p style="margin: 8px 0 0 0; color: #92400e; font-size: 12px;">The screenshot/image is attached to this email.</p>
      </div>
      ` : ''}
      
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
          SoulPrint Feedback System • ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
  `;

  // Prepare email payload
  const emailPayload = {
    from: 'SoulPrint Feedback <team@soulprintengine.ai>',
    to: ['reggie@archeforge.com'],
    subject: `${categoryEmoji} New Feedback: ${category.charAt(0).toUpperCase() + category.slice(1)} from ${userEmail}`,
    html: htmlContent,
  };

  // Add attachment if provided
  if (attachment && attachment.base64) {
    emailPayload.attachments = [{
      filename: attachment.name || 'screenshot.png',
      content: attachment.base64,
    }];
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Resend API error:', result);
      throw new Error(result.message || 'Failed to send email');
    }
    
    console.log(`[FEEDBACK] Email sent to reggie@archeforge.com - ID: ${result.id}`);
  } catch (error) {
    console.error('Failed to send feedback email:', error);
    throw error;
  }
}

// CONTACT FORM - Send email to team@archeforge.com
async function handleContactForm(request) {
  try {
    const { name, email, subject, message } = await request.json();

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return err('All fields are required', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return err('Invalid email address', 400);
    }

    // Send email using Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return err('Email service not configured', 500);
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SoulPrint Contact <team@soulprintengine.ai>',
        to: ['team@archeforge.com'],
        reply_to: email,
        subject: `[Contact Form] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f97316;">New Contact Form Submission</h2>
            <hr style="border: 1px solid #eee;" />
            <p><strong>From:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr style="border: 1px solid #eee;" />
            <h3>Message:</h3>
            <p style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 8px;">${message}</p>
            <hr style="border: 1px solid #eee;" />
            <p style="color: #888; font-size: 12px;">
              This message was sent via the SoulPrint contact form.<br/>
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Resend error:', errorData);
      return err('Failed to send email. Please try again.', 500);
    }

    // Store in database for records
    const db = await getDb();
    await db.collection('contact_submissions').insertOne({
      id: uuidv4(),
      name,
      email,
      subject,
      message,
      created_at: new Date(),
    });

    return ok({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Contact form error:', error);
    return err('Something went wrong. Please try again.', 500);
  }
}

// ADMIN - Get all user feedback
async function handleAdminGetFeedback(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // filter by status
  const limit = parseInt(searchParams.get('limit')) || 50;
  
  const query = {};
  if (status) query.status = status;

  const feedback = await db.collection('user_feedback')
    .find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();

  // Get stats
  const totalCount = await db.collection('user_feedback').countDocuments();
  const newCount = await db.collection('user_feedback').countDocuments({ status: 'new' });
  const reviewedCount = await db.collection('user_feedback').countDocuments({ status: 'reviewed' });
  const resolvedCount = await db.collection('user_feedback').countDocuments({ status: 'resolved' });

  return ok({
    feedback: feedback.map(f => ({
      id: f.id,
      user_email: f.user_email,
      message: f.message,
      category: f.category,
      rating: f.rating,
      status: f.status,
      created_at: f.created_at,
    })),
    stats: {
      total: totalCount,
      new: newCount,
      reviewed: reviewedCount,
      resolved: resolvedCount,
    }
  });
}

// ADMIN - Update feedback status
async function handleAdminUpdateFeedback(request, feedbackId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const body = await request.json();
  const { status, admin_note } = body;

  const db = await getDb();
  const feedback = await db.collection('user_feedback').findOne({ id: feedbackId });
  if (!feedback) return err('Feedback not found', 404);

  await db.collection('user_feedback').updateOne(
    { id: feedbackId },
    { 
      $set: { 
        status: status || feedback.status,
        admin_note: admin_note || feedback.admin_note,
        updated_at: new Date(),
        updated_by: user.id,
      }
    }
  );

  return ok({ success: true });
}

// ADMIN - Summarize feedback using LLM
async function handleAdminSummarizeFeedback(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const db = await getDb();
  const body = await request.json().catch(() => ({}));
  const { status, category, limit: limitParam } = body;
  
  // Get feedback to summarize
  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  
  const feedback = await db.collection('user_feedback')
    .find(query)
    .sort({ created_at: -1 })
    .limit(parseInt(limitParam) || 50)
    .toArray();

  if (feedback.length === 0) {
    return ok({ summary: 'No feedback to summarize.', feedbackCount: 0 });
  }

  // Prepare feedback text for LLM
  const feedbackText = feedback.map((f, i) => 
    `[${i + 1}] ${f.category.toUpperCase()} | ${f.rating ? `Rating: ${f.rating}/5` : 'No rating'}\n${f.message}`
  ).join('\n\n---\n\n');

  const provider = getProvider('openai', 'gpt-4o-mini');
  
  try {
    const response = await provider.generateChatCompletion({
      systemPrompt: 'You are an expert product analyst. Summarize user feedback concisely and extract actionable insights.',
      messages: [{
        role: 'user',
        content: `Please analyze and summarize the following ${feedback.length} user feedback submissions for our AI assistant product "SoulPrint". 

Provide:
1. A brief overall summary (2-3 sentences)
2. Top themes/topics mentioned (bullet points)
3. Key action items or suggestions (bullet points)
4. Overall sentiment (positive/negative/mixed)

FEEDBACK TO ANALYZE:
${feedbackText.substring(0, 15000)}`
      }],
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });

    return ok({ 
      summary: response,
      feedbackCount: feedback.length,
      dateRange: {
        oldest: feedback[feedback.length - 1]?.created_at,
        newest: feedback[0]?.created_at,
      }
    });
  } catch (e) {
    console.error('Feedback summarization error:', e);
    return err(`Failed to summarize: ${e.message}`, 500);
  }
}

// ============================================================
// ANNOUNCEMENTS SYSTEM
// ============================================================

// ADMIN - Create announcement
async function handleAdminCreateAnnouncement(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const body = await request.json();
  const { title, content, type, link, published } = body;

  if (!title || !content) {
    return err('Title and content are required', 400);
  }

  const db = await getDb();
  const announcement = {
    id: uuidv4(),
    title: title.trim(),
    content: content.trim(),
    type: type || 'info', // info, warning, success, update
    link: link?.trim() || null,
    published: published ?? false,
    created_by: user.id,
    created_at: new Date(),
    updated_at: new Date(),
    // Analytics tracking
    view_count: 0,
    click_count: 0,
    dismiss_count: 0,
  };

  await db.collection('announcements').insertOne(announcement);

  return ok({ success: true, announcement });
}

// ADMIN - Get all announcements
async function handleAdminGetAnnouncements(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const db = await getDb();
  const announcements = await db.collection('announcements')
    .find({})
    .sort({ created_at: -1 })
    .toArray();

  return ok({ announcements });
}

// ADMIN - Update announcement
async function handleAdminUpdateAnnouncement(request, announcementId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const body = await request.json();
  const { title, content, type, link, published } = body;

  const db = await getDb();
  const announcement = await db.collection('announcements').findOne({ id: announcementId });
  if (!announcement) return err('Announcement not found', 404);

  const updates = { updated_at: new Date() };
  if (title !== undefined) updates.title = title.trim();
  if (content !== undefined) updates.content = content.trim();
  if (type !== undefined) updates.type = type;
  if (link !== undefined) updates.link = link?.trim() || null;
  if (published !== undefined) updates.published = published;

  await db.collection('announcements').updateOne(
    { id: announcementId },
    { $set: updates }
  );

  return ok({ success: true });
}

// ADMIN - Delete announcement
async function handleAdminDeleteAnnouncement(request, announcementId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const db = await getDb();
  const announcement = await db.collection('announcements').findOne({ id: announcementId });
  if (!announcement) return err('Announcement not found', 404);

  await db.collection('announcements').deleteOne({ id: announcementId });

  return ok({ success: true });
}

// USER - Get published announcements (with 24-hour dismiss support)
async function handleGetAnnouncements(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get published announcements
  const announcements = await db.collection('announcements')
    .find({ published: true })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();

  // Get user's dismissed announcements with timestamps
  const userDismissed = await db.collection('user_dismissed_announcements')
    .findOne({ user_id: user.id });
  
  // dismissed_announcements is now an array of {announcement_id, dismissed_at}
  const dismissedMap = new Map();
  if (userDismissed?.dismissed_announcements) {
    userDismissed.dismissed_announcements.forEach(d => {
      dismissedMap.set(d.announcement_id, new Date(d.dismissed_at));
    });
  }
  // Legacy support for old format
  if (userDismissed?.announcement_ids) {
    userDismissed.announcement_ids.forEach(id => {
      if (!dismissedMap.has(id)) {
        dismissedMap.set(id, new Date(0)); // Treat legacy as permanently dismissed
      }
    });
  }

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Filter out only recently dismissed ones (within 24 hours)
  const unread = announcements.filter(a => {
    // Check if permanently dismissed
    if (userDismissed?.permanently_dismissed?.includes(a.id)) return false;
    
    const dismissedAt = dismissedMap.get(a.id);
    if (!dismissedAt) return true; // Never dismissed
    return dismissedAt < twentyFourHoursAgo; // Dismissed more than 24h ago, show again
  });

  // Get dismissed status for each announcement
  const announcementsWithStatus = announcements.map(a => ({
    id: a.id,
    title: a.title,
    content: a.content,
    type: a.type,
    link: a.link,
    created_at: a.created_at,
    permanently_dismissed: userDismissed?.permanently_dismissed?.includes(a.id) || false,
    temporarily_dismissed: dismissedMap.has(a.id) && !userDismissed?.permanently_dismissed?.includes(a.id),
    dismissed_at: dismissedMap.get(a.id) || null,
  }));

  return ok({ 
    announcements: announcementsWithStatus,
    unread: unread.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      type: a.type,
      link: a.link,
      created_at: a.created_at,
    })),
  });
}

// USER - Dismiss announcement (with timestamp for 24-hour reset, or permanent)
async function handleDismissAnnouncement(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { announcementId, permanent } = body;

  if (!announcementId) return err('announcementId required', 400);

  const db = await getDb();
  
  // First, increment the dismiss count on the announcement
  await db.collection('announcements').updateOne(
    { id: announcementId },
    { $inc: { dismiss_count: 1 } }
  );

  if (permanent) {
    // Permanently dismiss - add to permanently_dismissed array
    await db.collection('user_dismissed_announcements').updateOne(
      { user_id: user.id },
      { 
        $addToSet: { permanently_dismissed: announcementId },
        $pull: { dismissed_announcements: { announcement_id: announcementId } }
      },
      { upsert: true }
    );
  } else {
    // Temporary dismiss with timestamp (24-hour reset)
    // Remove old entry first, then add new one with current timestamp
    await db.collection('user_dismissed_announcements').updateOne(
      { user_id: user.id },
      { 
        $pull: { dismissed_announcements: { announcement_id: announcementId } }
      }
    );
    
    await db.collection('user_dismissed_announcements').updateOne(
      { user_id: user.id },
      { 
        $push: { 
          dismissed_announcements: { 
            announcement_id: announcementId, 
            dismissed_at: new Date() 
          } 
        }
      },
      { upsert: true }
    );
  }

  return ok({ success: true });
}

// USER - Track announcement click
async function handleAnnouncementClick(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { announcementId } = body;

  if (!announcementId) return err('announcementId required', 400);

  const db = await getDb();
  
  // Increment click count
  await db.collection('announcements').updateOne(
    { id: announcementId },
    { $inc: { click_count: 1 } }
  );

  return ok({ success: true });
}

// USER - Restore (un-dismiss) an announcement
async function handleRestoreAnnouncement(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { announcementId } = body;

  if (!announcementId) return err('announcementId required', 400);

  const db = await getDb();
  
  // Remove from both permanently_dismissed and dismissed_announcements
  await db.collection('user_dismissed_announcements').updateOne(
    { user_id: user.id },
    { 
      $pull: { 
        permanently_dismissed: announcementId,
        dismissed_announcements: { announcement_id: announcementId }
      }
    }
  );

  return ok({ success: true });
}

// PWA Install Prompt - Get user's install prompt preference
async function handleGetInstallPromptStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const prefs = await db.collection('user_preferences').findOne({ user_id: user.id });
  
  // Check if user has installed the app
  const installed = prefs?.pwa_installed || false;
  // Check if user dismissed forever
  const dismissedForever = prefs?.pwa_dismissed_forever || false;
  // Check if user clicked "remind me later" - only hide for 24 hours
  const remindLaterAt = prefs?.pwa_remind_later_at;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const shouldRemind = !remindLaterAt || new Date(remindLaterAt) < twentyFourHoursAgo;
  
  // Show prompt if: not installed, not dismissed forever, and (never reminded OR reminded > 24h ago)
  const showPrompt = !installed && !dismissedForever && shouldRemind;

  return ok({ 
    showPrompt,
    installed,
    dismissedForever,
  });
}

// PWA Install Prompt - Update install prompt preference
async function handleUpdateInstallPromptStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { action } = body; // 'installed' | 'remind_later' | 'dismiss_forever'

  if (!['installed', 'remind_later', 'dismiss_forever'].includes(action)) {
    return err('Invalid action', 400);
  }

  const db = await getDb();
  const updates = {};

  if (action === 'installed') {
    updates.pwa_installed = true;
  } else if (action === 'remind_later') {
    updates.pwa_remind_later_at = new Date();
  } else if (action === 'dismiss_forever') {
    updates.pwa_dismissed_forever = true;
  }

  await db.collection('user_preferences').updateOne(
    { user_id: user.id },
    { $set: updates },
    { upsert: true }
  );

  return ok({ success: true });
}

// IMPORTS - Upload
async function handleImportUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  await ensureUploadsDir();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const importType = formData.get('type') || 'chatgpt';

    if (!file) return err('No file provided');

    const fileName = `${user.id}_${Date.now()}_${file.name}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const db = await getDb();
    const jobId = uuidv4();
    await db.collection('import_jobs').insertOne({
      id: jobId,
      user_id: user.id,
      type: importType,
      status: 'processing',
      file_path: filePath,
      file_name: file.name,
      error: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Process in background (non-blocking)
    processImportJob(jobId, user.id, importType, filePath, buffer).catch(console.error);

    return ok({ jobId, status: 'processing' });
  } catch (error) {
    return err(`Upload failed: ${error.message}`, 500);
  }
}

async function processImportJob(jobId, userId, importType, filePath, buffer) {
  const db = await getDb();
  try {
    let extractedText = '';
    const fileName = filePath.toLowerCase();

    if (fileName.endsWith('.zip')) {
      try {
        const AdmZip = (await import('adm-zip')).default;
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        for (const entry of entries) {
          if (!entry.isDirectory) {
            const name = entry.entryName.toLowerCase();
            if (name.endsWith('.json') || name.endsWith('.html') || name.endsWith('.txt')) {
              const content = entry.getData().toString('utf8');
              if (name.endsWith('.json')) {
                try {
                  const parsed = JSON.parse(content);
                  extractedText += extractTextFromJson(parsed, importType) + '\n\n';
                } catch { extractedText += content.slice(0, 5000) + '\n\n'; }
              } else {
                extractedText += content.replace(/<[^>]+>/g, ' ').slice(0, 5000) + '\n\n';
              }
              if (extractedText.length > 50000) break;
            }
          }
        }
      } catch (e) {
        extractedText = 'Could not extract zip: ' + e.message;
      }
    } else if (fileName.endsWith('.json')) {
      try {
        const parsed = JSON.parse(buffer.toString('utf8'));
        extractedText = extractTextFromJson(parsed, importType);
      } catch {
        extractedText = buffer.toString('utf8').slice(0, 50000);
      }
    } else {
      extractedText = buffer.toString('utf8').slice(0, 50000);
    }

    // Chunk text
    const chunkSize = 2000;
    const chunks = [];
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      chunks.push(extractedText.slice(i, i + chunkSize));
    }

    // Store chunks
    for (const chunkText of chunks.slice(0, 25)) {
      await db.collection('source_corpus_chunks').insertOne({
        id: uuidv4(),
        user_id: userId,
        import_job_id: jobId,
        chunk_text: chunkText,
        metadata: { type: importType },
        created_at: new Date(),
      });
    }

    // Generate soul profile summary using LLM
    let soulSummary = '';
    if (extractedText.length > 100) {
      try {
        const provider = getProvider('hosted', 'gpt-4o-mini');
        soulSummary = await provider.generateChatCompletion({
          systemPrompt: `You are analyzing personal data exports to understand someone's communication style, personality, and preferences. Be concise and insightful.`,
          messages: [{
            role: 'user',
            content: `Based on this data export (type: ${importType}), create a brief soul profile summary (200-300 words) covering:
1. Communication style and tone
2. Main interests and recurring topics
3. Work/life patterns and goals
4. Personality traits visible from their messages
5. What they seem to value most

Data sample:
${extractedText.slice(0, 8000)}`,
          }],
          model: 'gpt-4o-mini',
          temperature: 0.5,
        });
      } catch (e) {
        soulSummary = 'Could not generate summary: ' + e.message;
      }
    }

    // Update profile with soul summary
    if (soulSummary) {
      await db.collection('profiles').updateOne(
        { user_id: userId },
        { $set: { soul_profile_summary: soulSummary, soul_profile_updated_at: new Date() } }
      );
    }

    // Mark job complete
    await db.collection('import_jobs').updateOne(
      { id: jobId },
      { $set: { status: 'complete', chunk_count: chunks.length, updated_at: new Date() } }
    );
  } catch (error) {
    await db.collection('import_jobs').updateOne(
      { id: jobId },
      { $set: { status: 'error', error: error.message, updated_at: new Date() } }
    );
  }
}

function extractTextFromJson(parsed, type) {
  let text = '';
  if (type === 'chatgpt') {
    if (Array.isArray(parsed)) {
      for (const conv of parsed.slice(0, 20)) {
        if (conv.mapping) {
          for (const node of Object.values(conv.mapping)) {
            const msg = node?.message;
            if (msg?.content?.parts) {
              const role = msg.author?.role || 'unknown';
              const content = msg.content.parts.filter(p => typeof p === 'string').join(' ');
              if (content.trim()) text += `[${role}]: ${content.slice(0, 500)}\n`;
            }
          }
        }
      }
    }
  } else {
    text = JSON.stringify(parsed).slice(0, 50000);
  }
  return text || JSON.stringify(parsed).slice(0, 50000);
}

// IMPORTS - Get user imports
async function handleGetImports(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const imports = await db.collection('import_jobs')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();

  return ok(imports.map(i => ({
    id: i.id,
    type: i.type,
    status: i.status,
    file_name: i.file_name,
    error: i.error,
    chunk_count: i.chunk_count,
    created_at: i.created_at,
    updated_at: i.updated_at,
  })));
}

// ============================================================
// ADMIN HANDLERS
// ============================================================

async function handleAdminGetUsers(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  
  // Date filters
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const onboardingFilter = searchParams.get('onboarding'); // complete, incomplete
  const assessmentFilter = searchParams.get('assessment'); // complete, incomplete

  const db = await getDb();
  
  // Build query
  const query = {};
  
  if (search) {
    query.email = { $regex: search, $options: 'i' };
  }
  
  // Date range filter on registration (created_at)
  if (startDate || endDate) {
    query.created_at = {};
    if (startDate) {
      query.created_at.$gte = new Date(startDate);
    }
    if (endDate) {
      // Add 1 day to include the end date fully
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      query.created_at.$lt = endDatePlusOne;
    }
  }

  // First get all matching users
  let users = await db.collection('users')
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  // Get profiles for filtering by onboarding/assessment
  const profiles = await db.collection('profiles')
    .find({ user_id: { $in: users.map(u => u.id) } })
    .toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  // Get assessment answer counts per user to determine quick vs full
  const assessmentCounts = await db.collection('assessment_answers').aggregate([
    { $match: { user_id: { $in: users.map(u => u.id) } } },
    { $group: { _id: '$user_id', count: { $sum: 1 } } }
  ]).toArray();
  const assessmentCountMap = Object.fromEntries(assessmentCounts.map(a => [a._id, a.count]));

  // Helper to determine assessment type based on answer count
  const getAssessmentType = (userId) => {
    const count = assessmentCountMap[userId] || 0;
    if (count >= 30) return 'full';  // 30+ answers = full assessment (36 questions)
    if (count >= 10) return 'quick'; // 10-29 answers = quick assessment (12 questions)
    if (count > 0) return 'partial'; // Some but not complete
    return 'none';
  };

  // Apply onboarding/assessment filters
  if (onboardingFilter === 'complete') {
    users = users.filter(u => profileMap[u.id]?.onboarding_complete === true);
  } else if (onboardingFilter === 'incomplete') {
    users = users.filter(u => !profileMap[u.id]?.onboarding_complete);
  }
  
  if (assessmentFilter === 'complete') {
    users = users.filter(u => profileMap[u.id]?.assessment_complete === true);
  } else if (assessmentFilter === 'incomplete') {
    users = users.filter(u => !profileMap[u.id]?.assessment_complete);
  } else if (assessmentFilter === 'quick') {
    users = users.filter(u => getAssessmentType(u.id) === 'quick');
  } else if (assessmentFilter === 'full') {
    users = users.filter(u => getAssessmentType(u.id) === 'full');
  }

  const total = users.length;
  const paginatedUsers = users.slice((page - 1) * limit, page * limit);

  return ok({
    users: paginatedUsers.map(u => {
      const answerCount = assessmentCountMap[u.id] || 0;
      const assessmentType = getAssessmentType(u.id);
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        accepted: u.accepted,
        created_at: u.created_at,
        last_active_at: u.last_active_at,
        display_name: profileMap[u.id]?.display_name || '',
        assessment_complete: profileMap[u.id]?.assessment_complete || false,
        assessment_answer_count: answerCount,
        assessment_type: assessmentType,
        onboarding_complete: profileMap[u.id]?.onboarding_complete || false,
      };
    }),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

async function handleAdminUpdateUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  // Get current user
  const user = await db.collection('users').findOne({ id: userId });
  if (!user) return err('User not found', 404);

  const update = {};
  
  // Basic fields
  if (body.accepted !== undefined) update.accepted = body.accepted;
  if (body.display_name !== undefined) update.display_name = body.display_name;
  
  // Email change - check for duplicates
  if (body.email !== undefined && body.email !== user.email) {
    const existing = await db.collection('users').findOne({ email: body.email.toLowerCase() });
    if (existing) return err('A user with this email already exists', 400);
    update.email = body.email.toLowerCase();
  }
  
  // Role change - only superadmin
  if (body.role !== undefined) {
    if (admin.role !== 'superadmin') return err('Only superadmin can change roles', 403);
    update.role = body.role;
  }

  if (Object.keys(update).length === 0) {
    return ok({ success: true, message: 'No changes' });
  }

  update.updated_at = new Date();
  await db.collection('users').updateOne({ id: userId }, { $set: update });

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'update_user',
    target_user_id: userId,
    metadata: body,
    created_at: new Date(),
  });

  return ok({ success: true });
}

async function handleAdminResetPasscode(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { new_passcode } = body;
  if (!new_passcode) return err('new_passcode required');

  const db = await getDb();
  const hashed = await hashPassword(new_passcode);
  await db.collection('users').updateOne({ id: userId }, { $set: { passcode_hash: hashed } });

  return ok({ success: true });
}

// ADMIN - Create new user
async function handleAdminCreateUser(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { email, passcode, display_name, role, accepted } = body;

  if (!email || !passcode) {
    return err('Email and passcode are required', 400);
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err('Invalid email format', 400);
  }

  const db = await getDb();

  // Check if user already exists
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) {
    return err('A user with this email already exists', 400);
  }

  // Only superadmin can create admin/superadmin users
  if ((role === 'admin' || role === 'superadmin') && admin.role !== 'superadmin') {
    return err('Only superadmin can create admin users', 403);
  }

  const hashedPasscode = await hashPassword(passcode);
  const newUser = {
    id: uuidv4(),
    email: email.toLowerCase(),
    passcode_hash: hashedPasscode,
    display_name: display_name || '',
    role: role || 'user',
    accepted: accepted ?? true,
    onboarding_complete: false,
    assessment_complete: false,
    created_at: new Date(),
    created_by: admin.id,
  };

  await db.collection('users').insertOne(newUser);

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'create_user',
    target_user_id: newUser.id,
    metadata: { email: newUser.email, role: newUser.role },
    created_at: new Date(),
  });

  return ok({ 
    success: true, 
    user: { 
      id: newUser.id, 
      email: newUser.email, 
      display_name: newUser.display_name,
      role: newUser.role 
    } 
  });
}

// ADMIN - Delete user
async function handleAdminDeleteUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  // Only superadmin can delete users
  if (admin.role !== 'superadmin') {
    return err('Only superadmin can delete users', 403);
  }

  const db = await getDb();

  // Get user info before deletion
  const user = await db.collection('users').findOne({ id: userId });
  if (!user) {
    return err('User not found', 404);
  }

  // Prevent deleting yourself
  if (user.id === admin.id) {
    return err('You cannot delete your own account', 400);
  }

  // Prevent deleting other superadmins (safety)
  if (user.role === 'superadmin') {
    return err('Cannot delete superadmin users', 400);
  }

  // Delete user
  await db.collection('users').deleteOne({ id: userId });

  // Delete ALL related data from all collections
  await db.collection('conversations').deleteMany({ user_id: userId });
  await db.collection('messages').deleteMany({ user_id: userId });
  await db.collection('soul_profiles').deleteMany({ user_id: userId });
  await db.collection('assessment_responses').deleteMany({ user_id: userId });
  await db.collection('user_memories').deleteMany({ user_id: userId });
  await db.collection('media_gallery').deleteMany({ user_id: userId });
  await db.collection('imported_messages').deleteMany({ user_id: userId });
  await db.collection('imported_data').deleteMany({ user_id: userId });
  await db.collection('telegram_links').deleteMany({ user_id: userId });
  await db.collection('user_feedback').deleteMany({ user_id: userId });
  await db.collection('user_preferences').deleteMany({ user_id: userId });
  await db.collection('communication_profiles').deleteMany({ user_id: userId });
  await db.collection('video_jobs').deleteMany({ user_id: userId });
  await db.collection('scheduled_tasks').deleteMany({ user_id: userId });
  await db.collection('announcement_dismissals').deleteMany({ user_id: userId });
  await db.collection('announcement_clicks').deleteMany({ user_id: userId });
  
  console.log(`[Admin] Fully deleted user ${userId} (${user.email}) and all associated data`);

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'delete_user',
    target_user_id: userId,
    metadata: { email: user.email },
    created_at: new Date(),
  });

  return ok({ success: true });
}

async function handleAdminGetWaitlist(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  const query = { accepted: false };
  if (search) query.email = { $regex: search, $options: 'i' };

  const users = await db.collection('users')
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  const profiles = await db.collection('profiles')
    .find({ user_id: { $in: users.map(u => u.id) } })
    .toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  return ok({
    count: users.length,
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      name: profileMap[u.id]?.display_name || u.name || '',
      role: u.role,
      accepted: u.accepted,
      created_at: u.created_at,
      assessment_complete: profileMap[u.id]?.assessment_complete || false,
      onboarding_complete: profileMap[u.id]?.onboarding_complete || false,
    })),
  });
}

async function handleAdminApproveWaitlist(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { user_ids, approve_all } = body;
  const db = await getDb();

  if (approve_all) {
    // Get all waitlisted users first to send emails
    const waitlistedUsers = await db.collection('users').find({ accepted: false }).toArray();
    await db.collection('users').updateMany({ accepted: false }, { $set: { accepted: true } });
    
    // Send acceptance emails (non-blocking)
    for (const user of waitlistedUsers) {
      const profile = await db.collection('profiles').findOne({ user_id: user.id });
      sendAcceptedEmail(user.email, profile?.display_name || null).catch(e => 
        console.error(`Acceptance email failed for ${user.email}:`, e)
      );
    }
    
    return ok({ success: true, message: 'All waitlisted users approved' });
  }

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return err('user_ids array required');
  }

  // Get users before updating to send emails
  const usersToApprove = await db.collection('users').find({ id: { $in: user_ids } }).toArray();
  
  await db.collection('users').updateMany(
    { id: { $in: user_ids } },
    { $set: { accepted: true } }
  );

  // Send acceptance emails (non-blocking)
  for (const user of usersToApprove) {
    const profile = await db.collection('profiles').findOne({ user_id: user.id });
    sendAcceptedEmail(user.email, profile?.display_name || null).catch(e => 
      console.error(`Acceptance email failed for ${user.email}:`, e)
    );
  }

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'bulk_approve_waitlist',
    metadata: { user_ids },
    created_at: new Date(),
  });

  return ok({ success: true, approved: user_ids.length });
}

async function handleAdminDenyUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  await db.collection('users').updateOne({ id: userId }, { $set: { accepted: false } });

  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'deny_user',
    target_user_id: userId,
    created_at: new Date(),
  });

  return ok({ success: true });
}

async function handleAdminGetMetrics(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const totalUsers = await db.collection('users').countDocuments();
  const wauUsers = await db.collection('users').countDocuments({ last_active_at: { $gte: sevenDaysAgo } });
  const waitlistCount = await db.collection('users').countDocuments({ accepted: false });

  // Multi-session rate
  const usersWithMultiConversations = await db.collection('conversations').aggregate([
    { $group: { _id: '$user_id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'total' },
  ]).toArray();
  const multiSessionCount = usersWithMultiConversations[0]?.total || 0;

  // Day 7 retention
  const usersCreated7DaysAgo = await db.collection('users').countDocuments({
    created_at: { $lte: sevenDaysAgo, $gte: new Date(now - 14 * 24 * 60 * 60 * 1000) },
  });
  const retainedUsers = await db.collection('users').countDocuments({
    created_at: { $lte: sevenDaysAgo },
    last_active_at: { $gte: sevenDaysAgo },
  });
  const day7Retention = usersCreated7DaysAgo > 0
    ? Math.round((retainedUsers / usersCreated7DaysAgo) * 100)
    : 0;

  // Avg sessions per user (7d)
  const conversationsIn7d = await db.collection('conversations').countDocuments({
    created_at: { $gte: sevenDaysAgo },
  });
  const avgSessionsPerUser = wauUsers > 0 ? (conversationsIn7d / wauUsers).toFixed(1) : 0;

  // Messages per session
  const msgAgg = await db.collection('messages').aggregate([
    { $group: { _id: '$conversation_id', count: { $sum: 1 } } },
    { $group: { _id: null, avg: { $avg: '$count' } } },
  ]).toArray();
  const avgMsgPerSession = msgAgg[0]?.avg?.toFixed(1) || 0;

  // Assessment completion rate
  const usersWithCompleteAssessment = await db.collection('profiles').countDocuments({ assessment_complete: true });
  const assessmentRate = totalUsers > 0 ? Math.round((usersWithCompleteAssessment / totalUsers) * 100) : 0;

  // Import adoption rate
  const usersWithImports = await db.collection('import_jobs').distinct('user_id');
  const importRate = totalUsers > 0 ? Math.round((usersWithImports.length / totalUsers) * 100) : 0;

  // ── Telegram Metrics ─────────────────────────────────────────────────────────
  const telegramLinkedUsers = await db.collection('telegram_mappings').countDocuments({ linked: true });
  const telegramConversations = await db.collection('conversations').countDocuments({ source: 'telegram' });
  const telegramMessages = await db.collection('messages').countDocuments({ source: 'telegram' });
  const telegramMessagesLast30d = await db.collection('messages').countDocuments({ 
    source: 'telegram', 
    created_at: { $gte: thirtyDaysAgo } 
  });
  
  // Telegram active users (sent message in last 7 days)
  const telegramActiveUsers7d = await db.collection('messages').aggregate([
    { $match: { source: 'telegram', role: 'user', created_at: { $gte: sevenDaysAgo } } },
    { $lookup: { from: 'conversations', localField: 'conversation_id', foreignField: 'id', as: 'conv' } },
    { $unwind: '$conv' },
    { $group: { _id: '$conv.user_id' } },
    { $count: 'total' }
  ]).toArray();
  const telegramWAU = telegramActiveUsers7d[0]?.total || 0;

  // Web vs Telegram breakdown
  const webMessages = totalMessages - telegramMessages;
  const webMessagesLast30d = totalMessagesLast30d - telegramMessagesLast30d;

  // CSAT
  const thumbsUp = await db.collection('feedback').countDocuments({ rating: 'up' });
  const thumbsDown = await db.collection('feedback').countDocuments({ rating: 'down' });
  const csat = (thumbsUp + thumbsDown) > 0
    ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100)
    : null;

  // Recent signups
  const recentSignups = await db.collection('users').countDocuments({ created_at: { $gte: thirtyDaysAgo } });

  // Total messages
  const totalMessages = await db.collection('messages').countDocuments();

  // ── Cost Estimation ──────────────────────────────────────────────────────
  // Pricing per 1M tokens (USD) — approximate mid-2025 rates
  const MODEL_PRICING = {
    // OpenAI latest models
    'gpt-5.2':                       { input: 10.00, output: 30.00 },
    'gpt-5':                         { input: 8.00,  output: 24.00 },
    'o3':                            { input: 15.00, output: 60.00 },
    'o3-mini':                       { input: 1.10,  output: 4.40  },
    'gpt-4.1':                       { input: 2.00,  output: 8.00  },
    'gpt-4.1-mini':                  { input: 0.40,  output: 1.60  },
    'gpt-4o':                        { input: 5.00,  output: 15.00 },
    'gpt-4o-mini':                   { input: 0.15,  output: 0.60  },
    // Anthropic
    'claude-opus-4-5-20251101':      { input: 15.00, output: 75.00 },
    'claude-sonnet-4-5-20250929':    { input: 3.00,  output: 15.00 },
    'claude-3-5-haiku-20241022':     { input: 0.80,  output: 4.00  },
    // Google Gemini
    'gemini-2.5-pro':                { input: 1.25,  output: 10.00 },
    'gemini-2.0-flash':              { input: 0.075, output: 0.30  },
    // Perplexity
    'sonar-pro':                     { input: 3.00,  output: 15.00 },
    'sonar':                         { input: 1.00,  output: 1.00  },
    'sonar-reasoning':               { input: 1.00,  output: 5.00  },
    // Kimi / Moonshot AI pricing (per 1M tokens, converted from CNY to USD)
    'kimi-k2-0711-preview':          { input: 2.00,  output: 8.00  },
    'moonshot-v1-8k':                { input: 1.50,  output: 1.50  },
    'moonshot-v1-32k':               { input: 3.00,  output: 3.00  },
    'moonshot-v1-128k':              { input: 8.00,  output: 8.00  },
  };
  const DEFAULT_PRICING = { input: 5.00, output: 15.00 }; // fallback = gpt-4o rate

  // Aggregate tokens per model from assistant messages that have est_* fields
  const tokensByModel = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true } } },
    {
      $group: {
        _id: '$model_used',
        total_input: { $sum: '$est_input_tokens' },
        total_output: { $sum: '$est_output_tokens' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  // For messages without token tracking, fall back to content-length estimate
  const untrackedMsgs = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: false } } },
    {
      $group: {
        _id: '$model_used',
        total_content_len: { $sum: { $strLenCP: '$content' } },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  const costByModel = {};
  let totalEstCost = 0;

  for (const row of tokensByModel) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    const cost = (row.total_input / 1_000_000) * p.input + (row.total_output / 1_000_000) * p.output;
    costByModel[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    totalEstCost += cost;
  }
  for (const row of untrackedMsgs) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    // Estimate: avg 500 input tokens + output tokens from content
    const estInput = row.count * 500;
    const estOutput = Math.round(row.total_content_len / 4);
    const cost = (estInput / 1_000_000) * p.input + (estOutput / 1_000_000) * p.output;
    if (costByModel[row._id]) {
      costByModel[row._id].cost += parseFloat(cost.toFixed(4));
      costByModel[row._id].messages += row.count;
    } else {
      costByModel[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    }
    totalEstCost += cost;
  }

  // Monthly cost projection (extrapolate from 30d data)
  const totalMessagesLast30d = await db.collection('messages').countDocuments({
    role: 'assistant',
    created_at: { $gte: thirtyDaysAgo },
  });
  const acceptedUsers = await db.collection('users').countDocuments({ accepted: true });
  
  // Get active users in last 30 days (users who have sent messages)
  const activeUsersLast30d = await db.collection('users').countDocuments({
    accepted: true,
    last_active_at: { $gte: thirtyDaysAgo }
  });
  
  // Calculate cost for last 30 days only (more accurate monthly projection)
  const tokensLast30d = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true }, created_at: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: '$model_used',
        total_input: { $sum: '$est_input_tokens' },
        total_output: { $sum: '$est_output_tokens' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();
  
  const untrackedLast30d = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: false }, created_at: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: '$model_used',
        total_content_len: { $sum: { $strLenCP: '$content' } },
        count: { $sum: 1 },
      },
    },
  ]).toArray();
  
  // Calculate last 30d cost by model
  const costByModelLast30d = {};
  let totalCostLast30d = 0;
  
  for (const row of tokensLast30d) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    const cost = (row.total_input / 1_000_000) * p.input + (row.total_output / 1_000_000) * p.output;
    costByModelLast30d[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    totalCostLast30d += cost;
  }
  for (const row of untrackedLast30d) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    const estInput = row.count * 500;
    const estOutput = Math.round(row.total_content_len / 4);
    const cost = (estInput / 1_000_000) * p.input + (estOutput / 1_000_000) * p.output;
    if (costByModelLast30d[row._id]) {
      costByModelLast30d[row._id].cost += parseFloat(cost.toFixed(4));
      costByModelLast30d[row._id].messages += row.count;
    } else {
      costByModelLast30d[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    }
    totalCostLast30d += cost;
  }
  
  // Calculate various cost per user metrics
  const avgCostPerMsg = totalMessages > 0 ? totalEstCost / totalMessages : 0;
  const avgCostPerMsgLast30d = totalMessagesLast30d > 0 ? totalCostLast30d / totalMessagesLast30d : 0;
  
  // Cost per user calculations
  const costPerUserAllTime = acceptedUsers > 0 ? parseFloat((totalEstCost / acceptedUsers).toFixed(4)) : 0;
  const costPerActiveUserLast30d = activeUsersLast30d > 0 ? parseFloat((totalCostLast30d / activeUsersLast30d).toFixed(4)) : 0;
  const costPerAcceptedUserLast30d = acceptedUsers > 0 ? parseFloat((totalCostLast30d / acceptedUsers).toFixed(4)) : 0;
  
  // Messages per user
  const messagesPerUserAllTime = acceptedUsers > 0 ? parseFloat((totalMessages / acceptedUsers).toFixed(1)) : 0;
  const messagesPerActiveUserLast30d = activeUsersLast30d > 0 ? parseFloat((totalMessagesLast30d / activeUsersLast30d).toFixed(1)) : 0;

  // ── Media Generation Costs (Kie.ai) ─────────────────────────────────────────
  const mediaCostsByModel = await db.collection('media_gallery').aggregate([
    { $match: { cost_usd: { $exists: true } } },
    {
      $group: {
        _id: { type: '$type', model: '$model' },
        total_cost: { $sum: '$cost_usd' },
        total_credits: { $sum: '$credits_used' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  const mediaCostsLast30d = await db.collection('media_gallery').aggregate([
    { $match: { cost_usd: { $exists: true }, created_at: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { type: '$type', model: '$model' },
        total_cost: { $sum: '$cost_usd' },
        total_credits: { $sum: '$credits_used' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  // Aggregate media costs
  const mediaCostByModel = {};
  let totalMediaCost = 0;
  let totalMediaCount = 0;
  for (const row of mediaCostsByModel) {
    const key = `${row._id.type}:${row._id.model}`;
    mediaCostByModel[key] = {
      type: row._id.type,
      model: row._id.model,
      cost: parseFloat(row.total_cost.toFixed(4)),
      credits: row.total_credits,
      count: row.count,
    };
    totalMediaCost += row.total_cost;
    totalMediaCount += row.count;
  }

  const mediaCostByModelLast30d = {};
  let totalMediaCostLast30d = 0;
  let totalMediaCountLast30d = 0;
  for (const row of mediaCostsLast30d) {
    const key = `${row._id.type}:${row._id.model}`;
    mediaCostByModelLast30d[key] = {
      type: row._id.type,
      model: row._id.model,
      cost: parseFloat(row.total_cost.toFixed(4)),
      credits: row.total_credits,
      count: row.count,
    };
    totalMediaCostLast30d += row.total_cost;
    totalMediaCountLast30d += row.count;
  }

  // Combined totals (LLM + Media)
  const grandTotalCost = totalEstCost + totalMediaCost;
  const grandTotalCostLast30d = totalCostLast30d + totalMediaCostLast30d;

  return ok({
    wau: wauUsers,
    total_users: totalUsers,
    accepted_users: acceptedUsers,
    active_users_30d: activeUsersLast30d,
    waitlist_count: waitlistCount,
    multi_session_rate: totalUsers > 0 ? Math.round((multiSessionCount / totalUsers) * 100) : 0,
    day7_retention: day7Retention,
    avg_sessions_per_user_7d: avgSessionsPerUser,
    avg_messages_per_session: avgMsgPerSession,
    assessment_completion_rate: assessmentRate,
    import_adoption_rate: importRate,
    csat,
    recent_signups_30d: recentSignups,
    total_messages: totalMessages,
    total_messages_30d: totalMessagesLast30d,
    thumbs_up: thumbsUp,
    thumbs_down: thumbsDown,
    // Cost metrics - All Time
    est_total_cost: parseFloat(totalEstCost.toFixed(4)),
    est_cost_per_user_all_time: costPerUserAllTime,
    avg_cost_per_message: parseFloat(avgCostPerMsg.toFixed(6)),
    cost_by_model: costByModel,
    messages_per_user_all_time: messagesPerUserAllTime,
    // Cost metrics - Last 30 Days
    est_total_cost_30d: parseFloat(totalCostLast30d.toFixed(4)),
    est_cost_per_active_user_30d: costPerActiveUserLast30d,
    est_cost_per_user_30d: costPerAcceptedUserLast30d,
    avg_cost_per_message_30d: parseFloat(avgCostPerMsgLast30d.toFixed(6)),
    cost_by_model_30d: costByModelLast30d,
    messages_per_active_user_30d: messagesPerActiveUserLast30d,
    // Media generation costs (Kie.ai)
    media_cost_total: parseFloat(totalMediaCost.toFixed(4)),
    media_cost_30d: parseFloat(totalMediaCostLast30d.toFixed(4)),
    media_count_total: totalMediaCount,
    media_count_30d: totalMediaCountLast30d,
    media_cost_by_model: mediaCostByModel,
    media_cost_by_model_30d: mediaCostByModelLast30d,
    // Grand totals (LLM + Media)
    grand_total_cost: parseFloat(grandTotalCost.toFixed(4)),
    grand_total_cost_30d: parseFloat(grandTotalCostLast30d.toFixed(4)),
    // Telegram metrics
    telegram: {
      linked_users: telegramLinkedUsers,
      conversations: telegramConversations,
      messages_total: telegramMessages,
      messages_30d: telegramMessagesLast30d,
      weekly_active_users: telegramWAU,
      adoption_rate: totalUsers > 0 ? Math.round((telegramLinkedUsers / totalUsers) * 100) : 0,
    },
    // Platform breakdown
    platform_breakdown: {
      web: {
        messages_total: webMessages,
        messages_30d: webMessagesLast30d,
      },
      telegram: {
        messages_total: telegramMessages,
        messages_30d: telegramMessagesLast30d,
      },
    },
    // Legacy (for backwards compatibility)
    est_cost_per_user_month: costPerAcceptedUserLast30d,
    est_projected_monthly_cost: parseFloat(totalCostLast30d.toFixed(4)),
  });
}

async function handleAdminGetQuestions(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const questions = await db.collection('assessment_questions')
    .find({})
    .sort({ order_index: 1 })
    .toArray();

  return ok(questions);
}

// Export users for email campaigns
async function handleAdminExportUsers(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'json'; // json or csv
  const filter = url.searchParams.get('filter') || 'all'; // all, beta, invited, organic, google
  const discovery = url.searchParams.get('discovery') || ''; // specific discovery source
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');
  const hasMessages = url.searchParams.get('has_messages'); // true/false
  const onboardingComplete = url.searchParams.get('onboarding_complete'); // true/false

  const db = await getDb();
  
  // Build query
  const query = { accepted: true };
  
  // Filter by user type
  if (filter === 'beta') {
    query.beta_code_used = { $exists: true, $ne: null };
  } else if (filter === 'invited') {
    query.invited_by = { $exists: true, $ne: null };
  } else if (filter === 'organic') {
    query.$and = [
      { $or: [{ beta_code_used: { $exists: false } }, { beta_code_used: null }] },
      { $or: [{ invited_by: { $exists: false } }, { invited_by: null }] }
    ];
  } else if (filter === 'google') {
    query.auth_provider = 'google';
  }
  
  // Filter by date range
  if (dateFrom || dateTo) {
    query.created_at = {};
    if (dateFrom) query.created_at.$gte = new Date(dateFrom);
    if (dateTo) query.created_at.$lte = new Date(dateTo + 'T23:59:59.999Z');
  }

  // Get users
  const users = await db.collection('users')
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  // Get profiles for discovery source and onboarding status
  const userIds = users.map(u => u.id);
  const profiles = await db.collection('profiles')
    .find({ user_id: { $in: userIds } })
    .toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  // Get message counts if filtering by engagement
  let messageCounts = {};
  if (hasMessages) {
    const msgAgg = await db.collection('messages').aggregate([
      { $match: { user_id: { $in: userIds }, role: 'user' } },
      { $group: { _id: '$user_id', count: { $sum: 1 } } }
    ]).toArray();
    messageCounts = Object.fromEntries(msgAgg.map(m => [m._id, m.count]));
  }

  // Build export data
  let exportData = users.map(u => {
    const profile = profileMap[u.id] || {};
    const msgCount = messageCounts[u.id] || 0;
    
    // Determine acquisition channel
    let acquisitionChannel = 'unknown';
    if (u.invited_by) {
      acquisitionChannel = 'invite';
    } else if (u.beta_code_used) {
      acquisitionChannel = 'beta_code';
    } else if (u.auth_provider === 'google') {
      acquisitionChannel = 'google_auth';
    } else if (profile.discovery_source) {
      acquisitionChannel = profile.discovery_source;
    } else {
      acquisitionChannel = 'organic';
    }

    return {
      email: u.email,
      display_name: profile.display_name || '',
      created_at: u.created_at,
      last_active_at: u.last_active_at,
      acquisition_channel: acquisitionChannel,
      beta_code_used: u.beta_code_used || '',
      invited_by: u.invited_by ? 'Yes' : 'No',
      auth_provider: u.auth_provider || 'legacy',
      discovery_source: profile.discovery_source || '',
      onboarding_complete: profile.onboarding_complete ? 'Yes' : 'No',
      assessment_complete: profile.assessment_complete ? 'Yes' : 'No',
      message_count: msgCount,
      field: profile.field || '',
      assistant_name: profile.assistant_name || 'SoulPrint',
    };
  });

  // Apply additional filters
  if (discovery) {
    exportData = exportData.filter(u => 
      u.discovery_source.toLowerCase().includes(discovery.toLowerCase()) ||
      u.acquisition_channel.toLowerCase().includes(discovery.toLowerCase())
    );
  }
  
  if (hasMessages === 'true') {
    exportData = exportData.filter(u => u.message_count > 0);
  } else if (hasMessages === 'false') {
    exportData = exportData.filter(u => u.message_count === 0);
  }
  
  if (onboardingComplete === 'true') {
    exportData = exportData.filter(u => u.onboarding_complete === 'Yes');
  } else if (onboardingComplete === 'false') {
    exportData = exportData.filter(u => u.onboarding_complete === 'No');
  }

  // Generate summary stats
  const stats = {
    total: exportData.length,
    by_channel: {},
    by_discovery: {},
    engaged: exportData.filter(u => u.message_count > 0).length,
    onboarded: exportData.filter(u => u.onboarding_complete === 'Yes').length,
  };
  
  exportData.forEach(u => {
    stats.by_channel[u.acquisition_channel] = (stats.by_channel[u.acquisition_channel] || 0) + 1;
    if (u.discovery_source) {
      stats.by_discovery[u.discovery_source] = (stats.by_discovery[u.discovery_source] || 0) + 1;
    }
  });

  // Return as CSV or JSON
  if (format === 'csv') {
    const headers = ['email', 'display_name', 'created_at', 'last_active_at', 'acquisition_channel', 
                     'beta_code_used', 'invited_by', 'auth_provider', 'discovery_source', 
                     'onboarding_complete', 'assessment_complete', 'message_count', 'field', 'assistant_name'];
    
    const csvRows = [headers.join(',')];
    exportData.forEach(row => {
      const values = headers.map(h => {
        let val = row[h] || '';
        if (val instanceof Date) val = val.toISOString();
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      });
      csvRows.push(values.join(','));
    });
    
    return new Response(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="soulprint_users_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return ok({
    stats,
    users: exportData,
  });
}

// Get available filter options for export
async function handleAdminGetExportFilters(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  // Get unique discovery sources
  const profiles = await db.collection('profiles').find({}).toArray();
  const discoverySources = [...new Set(profiles.map(p => p.discovery_source).filter(Boolean))];
  
  // Get unique auth providers
  const users = await db.collection('users').find({ accepted: true }).toArray();
  const authProviders = [...new Set(users.map(u => u.auth_provider).filter(Boolean))];
  
  // Get beta codes used
  const betaCodes = [...new Set(users.map(u => u.beta_code_used).filter(Boolean))];
  
  // Count by acquisition channel
  const channelCounts = {
    all: users.length,
    beta: users.filter(u => u.beta_code_used).length,
    invited: users.filter(u => u.invited_by).length,
    google: users.filter(u => u.auth_provider === 'google').length,
    organic: users.filter(u => !u.beta_code_used && !u.invited_by && u.auth_provider !== 'google').length,
  };

  return ok({
    discovery_sources: discoverySources,
    auth_providers: authProviders,
    beta_codes: betaCodes,
    channel_counts: channelCounts,
  });
}

async function handleAdminSeedQuestions(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  await db.collection('assessment_questions').deleteMany({});
  await seedQuestions(db);

  return ok({ success: true, count: SEED_QUESTIONS.length });
}

async function handleAdminUpdateQuestion(request, questionId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  const update = {};
  if (body.question_text !== undefined) update.question_text = body.question_text;
  if (body.active !== undefined) update.active = body.active;

  await db.collection('assessment_questions').updateOne({ id: questionId }, { $set: update });
  return ok({ success: true });
}

async function handleAdminGetConversations(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  const db = await getDb();
  const total = await db.collection('conversations').countDocuments();
  const conversations = await db.collection('conversations')
    .find({})
    .sort({ updated_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  const userIds = [...new Set(conversations.map(c => c.user_id))];
  const users = await db.collection('users').find({ id: { $in: userIds } }).toArray();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  // Privacy: Generate topic categories instead of showing actual titles
  const conversationsWithTopics = conversations.map(c => {
    // Use stored topic if available, otherwise generate from title
    const topic = c.topic || categorizeConversationTopic(c.title);
    return {
      id: c.id,
      topic: topic, // Privacy-safe topic category
      user_email: userMap[c.user_id]?.email || 'unknown',
      user_id: c.user_id,
      message_count: c.message_count || 0,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  });

  return ok({
    conversations: conversationsWithTopics,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

// Privacy helper: Categorize conversation into a general topic (doesn't expose actual content)
function categorizeConversationTopic(title) {
  if (!title) return 'General Chat';
  const lower = title.toLowerCase();
  
  // Coding & Tech
  if (/\b(code|coding|programming|javascript|python|react|api|debug|error|function|bug|deploy|database|sql|html|css|git)\b/.test(lower)) {
    return '💻 Coding & Development';
  }
  // Writing & Content
  if (/\b(write|writing|draft|email|blog|article|essay|content|copy|edit|proofread|story|poem)\b/.test(lower)) {
    return '✍️ Writing & Content';
  }
  // Business & Work
  if (/\b(business|work|meeting|project|strategy|marketing|sales|startup|pitch|investor|client|presentation)\b/.test(lower)) {
    return '💼 Business & Work';
  }
  // Research & Learning
  if (/\b(research|learn|study|explain|understand|how does|what is|why|teach|tutorial|course)\b/.test(lower)) {
    return '📚 Research & Learning';
  }
  // Creative & Design
  if (/\b(design|creative|art|image|logo|brand|color|style|ui|ux|graphic|video|animation)\b/.test(lower)) {
    return '🎨 Creative & Design';
  }
  // Travel & Places
  if (/\b(travel|trip|vacation|hotel|flight|restaurant|visit|tour|city|country|location|nearby)\b/.test(lower)) {
    return '✈️ Travel & Places';
  }
  // Health & Wellness
  if (/\b(health|fitness|workout|diet|medical|doctor|symptom|exercise|wellness|mental|therapy)\b/.test(lower)) {
    return '🏥 Health & Wellness';
  }
  // Finance & Money
  if (/\b(money|finance|invest|stock|crypto|budget|save|price|cost|salary|tax|bank)\b/.test(lower)) {
    return '💰 Finance & Money';
  }
  // Social Media
  if (/\b(twitter|instagram|linkedin|tiktok|facebook|post|caption|social media|viral|followers)\b/.test(lower)) {
    return '📱 Social Media';
  }
  // News & Current Events
  if (/\b(news|today|current|latest|2024|2025|2026|happened|event|update|trending)\b/.test(lower)) {
    return '📰 News & Current Events';
  }
  // Personal & Life
  if (/\b(personal|life|family|relationship|friend|advice|help me|feeling|emotion)\b/.test(lower)) {
    return '🌟 Personal & Life';
  }
  // Images & Media
  if (/\b(image|picture|photo|generate|create|draw|illustration|video|animation)\b/.test(lower)) {
    return '🖼️ Image & Media Generation';
  }
  
  return '💬 General Chat';
}

async function handleAdminGetImports(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const imports = await db.collection('import_jobs')
    .find({})
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();

  const userIds = [...new Set(imports.map(i => i.user_id))];
  const users = await db.collection('users').find({ id: { $in: userIds } }).toArray();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return ok(imports.map(i => ({
    id: i.id,
    type: i.type,
    status: i.status,
    file_name: i.file_name,
    error: i.error,
    user_email: userMap[i.user_id]?.email || 'unknown',
    created_at: i.created_at,
    updated_at: i.updated_at,
  })));
}

async function handleAdminGetSettings(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });

  return ok(settings || {
    default_model: 'gpt-4o',
    default_provider: 'hosted',
    available_models: AVAILABLE_MODELS,
    waitlist_enabled: true,
  });
}

async function handleAdminUpdateSettings(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  await db.collection('settings').updateOne(
    { id: 'global' },
    { $set: { ...body, id: 'global', updated_at: new Date() } },
    { upsert: true }
  );

  return ok({ success: true });
}

// ============================================================
// VIRAL INVITE SYSTEM
// ============================================================

// Generate a unique invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like O, 0, I, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if viral invites are enabled
async function isViralInvitesEnabled() {
  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });
  return settings?.viral_invites_enabled === true;
}

// Get user's invite info
async function handleGetUserInvites(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Check if viral invites are enabled
  const enabled = await isViralInvitesEnabled();
  if (!enabled) {
    return ok({ enabled: false });
  }

  // Get user's invite data
  const userData = await db.collection('users').findOne({ id: user.id });
  
  // Initialize invite code if user doesn't have one
  let inviteCode = userData?.invite_code;
  if (!inviteCode) {
    inviteCode = generateInviteCode();
    await db.collection('users').updateOne(
      { id: user.id },
      { 
        $set: { 
          invite_code: inviteCode,
          invites_remaining: userData?.invites_remaining ?? 5,
          invites_used: userData?.invites_used ?? 0,
        } 
      }
    );
  }

  // Get list of people this user has invited
  const invitedUsers = await db.collection('users')
    .find({ invited_by: user.id })
    .project({ id: 1, email: 1, created_at: 1 })
    .toArray();

  // Get inviter info if this user was invited
  let invitedBy = null;
  if (userData?.invited_by) {
    const inviter = await db.collection('users').findOne({ id: userData.invited_by });
    if (inviter) {
      const inviterProfile = await db.collection('profiles').findOne({ user_id: inviter.id });
      invitedBy = {
        id: inviter.id,
        name: inviterProfile?.display_name || inviter.email.split('@')[0],
      };
    }
  }

  // Check for invite badges
  const badges = userData?.badges || [];
  const inviteBadges = [
    { id: 'first_invite', name: 'First Invite', description: 'Invited your first friend', threshold: 1, icon: '🌟' },
    { id: 'social_butterfly', name: 'Social Butterfly', description: 'Invited 5 friends', threshold: 5, icon: '🦋' },
    { id: 'community_builder', name: 'Community Builder', description: 'Invited 10 friends', threshold: 10, icon: '🏗️' },
    { id: 'influencer', name: 'Influencer', description: 'Invited 25 friends', threshold: 25, icon: '⭐' },
  ];

  const earnedBadges = inviteBadges.filter(b => (userData?.invites_used || 0) >= b.threshold);

  return ok({
    enabled: true,
    invite_code: inviteCode,
    invites_remaining: userData?.invites_remaining ?? 5,
    invites_used: userData?.invites_used ?? 0,
    invited_users: invitedUsers.map(u => ({
      email: u.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Partially mask email
      joined_at: u.created_at,
    })),
    invited_by: invitedBy,
    badges: earnedBadges,
    all_badges: inviteBadges,
  });
}

// Validate an invite code (public endpoint - no auth required)
async function handleValidateInviteCode(request) {
  const { code } = await request.json();
  if (!code) return err('Invite code required');

  const db = await getDb();
  
  // Check if viral invites are enabled
  const enabled = await isViralInvitesEnabled();
  if (!enabled) {
    return err('Invite program is not currently active', 400);
  }

  // Find user with this invite code
  const inviter = await db.collection('users').findOne({ 
    invite_code: code.toUpperCase().trim() 
  });

  if (!inviter) {
    return err('Invalid invite code', 404);
  }

  // Check if inviter has remaining invites
  if ((inviter.invites_remaining ?? 0) <= 0) {
    return err('This invite code has no remaining uses', 400);
  }

  // Get inviter's profile for display
  const inviterProfile = await db.collection('profiles').findOne({ user_id: inviter.id });
  
  return ok({
    valid: true,
    inviter_name: inviterProfile?.display_name || inviter.email.split('@')[0],
    invites_remaining: inviter.invites_remaining,
  });
}

// Redeem an invite code during registration
async function handleRedeemInviteCode(request) {
  const { code, email, passcode } = await request.json();
  if (!code || !email || !passcode) return err('Code, email and passcode required');

  const db = await getDb();
  
  // Check if viral invites are enabled
  const enabled = await isViralInvitesEnabled();
  if (!enabled) {
    return err('Invite program is not currently active', 400);
  }

  // Check if email already exists
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already registered');

  // Find inviter
  const inviter = await db.collection('users').findOne({ 
    invite_code: code.toUpperCase().trim() 
  });

  if (!inviter) {
    return err('Invalid invite code', 404);
  }

  if ((inviter.invites_remaining ?? 0) <= 0) {
    return err('This invite code has no remaining uses', 400);
  }

  // Create new user
  const userId = uuidv4();
  const hashed = await hashPassword(passcode);
  const now = new Date();
  const newInviteCode = generateInviteCode();

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role: 'user',
    accepted: true, // Auto-accept invited users
    created_at: now,
    last_active_at: now,
    invited_by: inviter.id,
    invite_code: newInviteCode,
    invites_remaining: 5, // New users also get 5 invites
    invites_used: 0,
    badges: [],
    auth_provider: 'invite',
  });

  // Decrement inviter's remaining invites and increment used count
  const newInvitesUsed = (inviter.invites_used || 0) + 1;
  
  // Check and award badges
  const badgesToAward = [];
  if (newInvitesUsed === 1) badgesToAward.push({ id: 'first_invite', awarded_at: now });
  if (newInvitesUsed === 5) badgesToAward.push({ id: 'social_butterfly', awarded_at: now });
  if (newInvitesUsed === 10) badgesToAward.push({ id: 'community_builder', awarded_at: now });
  if (newInvitesUsed === 25) badgesToAward.push({ id: 'influencer', awarded_at: now });

  const updateOps = {
    $inc: { invites_remaining: -1, invites_used: 1 },
  };
  
  if (badgesToAward.length > 0) {
    updateOps.$push = { badges: { $each: badgesToAward } };
  }

  await db.collection('users').updateOne(
    { id: inviter.id },
    updateOps
  );

  // Record the invite redemption
  await db.collection('invite_redemptions').insertOne({
    id: uuidv4(),
    inviter_id: inviter.id,
    invitee_id: userId,
    invitee_email: email.toLowerCase(),
    invite_code: code.toUpperCase().trim(),
    redeemed_at: now,
  });

  // Create empty profile for new user
  await db.collection('profiles').insertOne({
    user_id: userId,
    display_name: '',
    assistant_name: 'SoulPrint',
    descriptors: [],
    field: '',
    help_with: [],
    discovery_source: 'invite',
    soul_profile_summary: '',
    onboarding_complete: false,
    assessment_complete: false,
    created_at: now,
  });

  const token = generateToken(userId);

  // Send welcome email (non-blocking)
  sendWelcomeEmail(email, null).catch(e => console.error('Welcome email failed:', e));

  return ok({
    token,
    userId,
    role: 'user',
    accepted: true,
    onboarding_complete: false,
    assessment_complete: false,
    invite_code: newInviteCode, // Their own invite code
  });
}

// Admin: Get viral invite stats
async function handleAdminGetInviteStats(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  const settings = await db.collection('settings').findOne({ id: 'global' });
  const enabled = settings?.viral_invites_enabled === true;

  // Get aggregate stats
  const totalInvitesSent = await db.collection('invite_redemptions').countDocuments();
  const usersWithInvites = await db.collection('users').countDocuments({ invites_remaining: { $gt: 0 } });
  const totalInvitesAvailable = await db.collection('users').aggregate([
    { $group: { _id: null, total: { $sum: '$invites_remaining' } } }
  ]).toArray();

  // Top inviters
  const topInviters = await db.collection('users')
    .find({ invites_used: { $gt: 0 } })
    .sort({ invites_used: -1 })
    .limit(10)
    .project({ id: 1, email: 1, invites_used: 1, badges: 1 })
    .toArray();

  // Recent invite activity
  const recentInvites = await db.collection('invite_redemptions')
    .find()
    .sort({ redeemed_at: -1 })
    .limit(20)
    .toArray();

  return ok({
    enabled,
    stats: {
      total_invites_sent: totalInvitesSent,
      users_with_invites: usersWithInvites,
      total_invites_available: totalInvitesAvailable[0]?.total || 0,
    },
    top_inviters: topInviters.map(u => ({
      email: u.email,
      invites_used: u.invites_used,
      badges: u.badges?.length || 0,
    })),
    recent_invites: recentInvites.map(r => ({
      invitee_email: r.invitee_email?.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      redeemed_at: r.redeemed_at,
    })),
  });
}

// Admin: Toggle viral invites on/off
async function handleAdminToggleViralInvites(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { enabled } = await request.json();
  const db = await getDb();

  await db.collection('settings').updateOne(
    { id: 'global' },
    { $set: { viral_invites_enabled: enabled === true, updated_at: new Date() } },
    { upsert: true }
  );

  // If enabling for the first time, give all existing users their invite codes
  if (enabled) {
    const usersWithoutCodes = await db.collection('users')
      .find({ invite_code: { $exists: false } })
      .toArray();
    
    for (const user of usersWithoutCodes) {
      await db.collection('users').updateOne(
        { id: user.id },
        { 
          $set: { 
            invite_code: generateInviteCode(),
            invites_remaining: 5,
            invites_used: 0,
          } 
        }
      );
    }
  }

  return ok({ success: true, enabled: enabled === true });
}

// Admin: Grant more invites to a user
async function handleAdminGrantInvites(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { user_id, amount } = await request.json();
  if (!user_id || !amount) return err('User ID and amount required');

  const db = await getDb();
  
  await db.collection('users').updateOne(
    { id: user_id },
    { $inc: { invites_remaining: parseInt(amount) } }
  );

  return ok({ success: true });
}

// ============================================================
// PRICING FEATURES MANAGEMENT
// ============================================================

// Get all pricing features (current and future)
async function handleAdminGetPricingFeatures(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const features = await db.collection('pricing_features')
    .find({})
    .sort({ tier: 1, order: 1 })
    .toArray();

  return ok(features);
}

// Add a new pricing feature
async function handleAdminAddPricingFeature(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const data = await request.json();
  const { name, description, tier, cost_type, cost_value, status, category } = data;

  if (!name || !tier) {
    return err('Name and tier are required');
  }

  const db = await getDb();
  const id = uuidv4();

  const feature = {
    id,
    name,
    description: description || '',
    tier, // 'free', 'basic', 'pro', 'enterprise', 'addon'
    cost_type: cost_type || 'per_user', // 'per_user', 'per_message', 'per_use', 'fixed', 'percentage'
    cost_value: parseFloat(cost_value) || 0, // cost in dollars
    status: status || 'planned', // 'active', 'planned', 'considering'
    category: category || 'feature', // 'feature', 'integration', 'limit', 'support'
    created_at: new Date(),
    updated_at: new Date(),
  };

  await db.collection('pricing_features').insertOne(feature);

  return ok(feature);
}

// Update a pricing feature
async function handleAdminUpdatePricingFeature(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const data = await request.json();
  const { id, ...updates } = data;

  if (!id) return err('Feature ID required');

  const db = await getDb();
  
  await db.collection('pricing_features').updateOne(
    { id },
    { 
      $set: { 
        ...updates,
        updated_at: new Date() 
      } 
    }
  );

  return ok({ success: true });
}

// Delete a pricing feature
async function handleAdminDeletePricingFeature(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) return err('Feature ID required');

  const db = await getDb();
  await db.collection('pricing_features').deleteOne({ id });

  return ok({ success: true });
}

// Calculate pricing with custom features
async function handleAdminCalculatePricing(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  // Get all features
  const features = await db.collection('pricing_features')
    .find({})
    .toArray();

  // Get base costs from actual usage
  const totalCostAgg = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true } } },
    { $group: { _id: null, input: { $sum: '$est_input_tokens' }, output: { $sum: '$est_output_tokens' } } },
  ]).toArray();
  
  const userCount = await db.collection('users').countDocuments({ accepted: true }) || 1;
  const totalLLMCost = totalCostAgg.length > 0
    ? (totalCostAgg[0].input / 1_000_000) * 5 + (totalCostAgg[0].output / 1_000_000) * 15
    : 0;
  const baseCostPerUser = totalLLMCost / userCount;

  // Calculate tier costs including custom features
  const tierCosts = {
    free: { base: baseCostPerUser * 0.3, features: [], total: 0 },
    basic: { base: baseCostPerUser * 0.7, features: [], total: 0 },
    pro: { base: baseCostPerUser * 1.2, features: [], total: 0 },
    enterprise: { base: baseCostPerUser * 3, features: [], total: 0 },
  };

  // Add feature costs to each tier
  features.forEach(f => {
    if (f.tier === 'addon') return; // Skip addons for tier calculation
    
    const featureCost = f.cost_type === 'per_user' ? f.cost_value : 
                        f.cost_type === 'fixed' ? f.cost_value / userCount :
                        f.cost_value * 0.1; // Estimate for per_message/per_use

    if (tierCosts[f.tier]) {
      tierCosts[f.tier].features.push({
        name: f.name,
        cost: featureCost,
        status: f.status,
      });
    }
    
    // Features accumulate up the tiers (basic includes free features, etc.)
    if (f.tier === 'free') {
      ['basic', 'pro', 'enterprise'].forEach(t => {
        tierCosts[t].features.push({ name: f.name, cost: featureCost, status: f.status, inherited: true });
      });
    } else if (f.tier === 'basic') {
      ['pro', 'enterprise'].forEach(t => {
        tierCosts[t].features.push({ name: f.name, cost: featureCost, status: f.status, inherited: true });
      });
    } else if (f.tier === 'pro') {
      tierCosts.enterprise.features.push({ name: f.name, cost: featureCost, status: f.status, inherited: true });
    }
  });

  // Calculate totals
  Object.keys(tierCosts).forEach(tier => {
    const featureCostSum = tierCosts[tier].features.reduce((sum, f) => sum + f.cost, 0);
    tierCosts[tier].total = tierCosts[tier].base + featureCostSum;
  });

  // Calculate recommended prices at different margins
  const calculatePrice = (cost, margin) => cost / (1 - margin);

  const pricingTable = {};
  Object.entries(tierCosts).forEach(([tier, data]) => {
    pricingTable[tier] = {
      base_cost: parseFloat(data.base.toFixed(2)),
      feature_cost: parseFloat(data.features.reduce((sum, f) => sum + f.cost, 0).toFixed(2)),
      total_cost: parseFloat(data.total.toFixed(2)),
      features: data.features,
      prices: {
        at_70_margin: parseFloat(calculatePrice(data.total, 0.70).toFixed(2)),
        at_80_margin: parseFloat(calculatePrice(data.total, 0.80).toFixed(2)),
        at_90_margin: parseFloat(calculatePrice(data.total, 0.90).toFixed(2)),
      },
    };
  });

  // Addon pricing
  const addons = features.filter(f => f.tier === 'addon').map(f => ({
    ...f,
    recommended_price: parseFloat((f.cost_value / 0.2).toFixed(2)), // 80% margin on addons
  }));

  return ok({
    tier_costs: pricingTable,
    addons,
    base_cost_per_user: parseFloat(baseCostPerUser.toFixed(2)),
    total_users: userCount,
  });
}

// ============================================================
// BUSINESS INSIGHTS & PRICING ANALYTICS
// ============================================================

// Get detailed business insights for pricing decisions
async function handleAdminGetBusinessInsights(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

  // ── USER SEGMENTATION BY USAGE ─────────────────────────────────────────────
  // Get message counts per user for segmentation
  const userMessageCounts = await db.collection('messages').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$user_id', message_count: { $sum: 1 } } },
  ]).toArray();

  const userCountMap = {};
  userMessageCounts.forEach(u => { userCountMap[u._id] = u.message_count; });

  // Define usage tiers
  const usageSegments = {
    inactive: { min: 0, max: 0, count: 0, users: [] },      // 0 messages
    light: { min: 1, max: 20, count: 0, users: [] },        // 1-20 messages
    moderate: { min: 21, max: 100, count: 0, users: [] },   // 21-100 messages
    heavy: { min: 101, max: 500, count: 0, users: [] },     // 101-500 messages
    power: { min: 501, max: Infinity, count: 0, users: [] } // 500+ messages
  };

  // Get all accepted users
  const allUsers = await db.collection('users')
    .find({ accepted: true })
    .project({ id: 1, email: 1, created_at: 1, last_active_at: 1 })
    .toArray();

  allUsers.forEach(user => {
    const msgCount = userCountMap[user.id] || 0;
    for (const [tier, config] of Object.entries(usageSegments)) {
      if (msgCount >= config.min && msgCount <= config.max) {
        config.count++;
        if (config.users.length < 5) { // Keep top 5 examples per tier
          config.users.push({ email: user.email, messages: msgCount });
        }
        break;
      }
    }
  });

  // Sort users in each segment by message count
  Object.values(usageSegments).forEach(seg => {
    seg.users.sort((a, b) => b.messages - a.messages);
  });

  // ── TOP USERS (POTENTIAL ENTERPRISE) ───────────────────────────────────────
  const topUsers = await db.collection('messages').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$user_id', message_count: { $sum: 1 } } },
    { $sort: { message_count: -1 } },
    { $limit: 20 },
  ]).toArray();

  // Enrich with user data and costs
  const enrichedTopUsers = [];
  for (const u of topUsers) {
    const user = await db.collection('users').findOne({ id: u._id });
    const profile = await db.collection('profiles').findOne({ user_id: u._id });
    
    // Calculate user's cost
    const userCostAgg = await db.collection('messages').aggregate([
      { $match: { user_id: u._id, role: 'assistant', est_input_tokens: { $exists: true } } },
      { $group: { _id: null, input: { $sum: '$est_input_tokens' }, output: { $sum: '$est_output_tokens' } } },
    ]).toArray();
    
    // Estimate cost at $5/1M input, $15/1M output (avg rate)
    const userCost = userCostAgg.length > 0 
      ? (userCostAgg[0].input / 1_000_000) * 5 + (userCostAgg[0].output / 1_000_000) * 15
      : 0;

    // Get media generation count
    const mediaCount = await db.collection('media_gallery').countDocuments({ user_id: u._id });

    enrichedTopUsers.push({
      email: user?.email || 'Unknown',
      name: profile?.display_name || user?.email?.split('@')[0] || 'Unknown',
      messages: u.message_count,
      media_generated: mediaCount,
      estimated_cost: parseFloat(userCost.toFixed(2)),
      joined: user?.created_at,
      last_active: user?.last_active_at,
    });
  }

  // ── MODEL POPULARITY & COST BREAKDOWN ──────────────────────────────────────
  const modelUsage = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', model_used: { $exists: true } } },
    { $group: { _id: '$model_used', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  const totalModelMessages = modelUsage.reduce((sum, m) => sum + m.count, 0);
  const modelPopularity = modelUsage.map(m => ({
    model: m._id || 'unknown',
    count: m.count,
    percentage: totalModelMessages > 0 ? parseFloat(((m.count / totalModelMessages) * 100).toFixed(1)) : 0,
  }));

  // ── FEATURE ADOPTION RATES ─────────────────────────────────────────────────
  const totalAccepted = await db.collection('users').countDocuments({ accepted: true });
  
  const featureAdoption = {
    assessment_complete: await db.collection('profiles').countDocuments({ assessment_complete: true }),
    has_imports: (await db.collection('import_jobs').distinct('user_id')).length,
    has_media: (await db.collection('media_gallery').distinct('user_id')).length,
    has_memories: (await db.collection('user_memories').distinct('user_id')).length,
    has_soulprint: await db.collection('profiles').countDocuments({ soul_profile_summary: { $exists: true, $ne: '' } }),
    web_search_users: (await db.collection('messages').distinct('user_id', { web_sources: { $exists: true, $ne: [] } })).length,
  };

  const featureAdoptionRates = {};
  for (const [feature, count] of Object.entries(featureAdoption)) {
    featureAdoptionRates[feature] = {
      users: count,
      rate: totalAccepted > 0 ? parseFloat(((count / totalAccepted) * 100).toFixed(1)) : 0,
    };
  }

  // ── FEATURE USAGE BY USER SEGMENT ─────────────────────────────────────────────
  // Analyze which features are used by different user segments to make tier recommendations
  
  // Get user IDs by segment
  const lightUserIds = [];
  const moderateUserIds = [];
  const heavyUserIds = [];
  const powerUserIds = [];
  
  userMessageCounts.forEach(u => {
    if (u.message_count <= 20) lightUserIds.push(u._id);
    else if (u.message_count <= 100) moderateUserIds.push(u._id);
    else if (u.message_count <= 500) heavyUserIds.push(u._id);
    else powerUserIds.push(u._id);
  });

  // Analyze feature usage per segment
  const analyzeSegmentFeatures = async (userIds, segmentName) => {
    if (userIds.length === 0) return { segment: segmentName, count: 0, features: {} };
    
    const segmentProfiles = await db.collection('profiles')
      .find({ user_id: { $in: userIds } })
      .toArray();
    
    const hasImports = await db.collection('import_jobs')
      .distinct('user_id', { user_id: { $in: userIds } });
    
    const hasMedia = await db.collection('media_gallery')
      .distinct('user_id', { user_id: { $in: userIds } });
    
    const hasMemories = await db.collection('user_memories')
      .distinct('user_id', { user_id: { $in: userIds } });
    
    const usesWebSearch = await db.collection('messages')
      .distinct('user_id', { user_id: { $in: userIds }, web_sources: { $exists: true, $ne: [] } });
    
    // Model usage in segment
    const modelUsageInSegment = await db.collection('messages').aggregate([
      { $match: { user_id: { $in: userIds }, role: 'assistant', model_used: { $exists: true } } },
      { $group: { _id: '$model_used', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).toArray();
    
    // Premium model usage (GPT-4, Claude, etc)
    const premiumModels = ['gpt-4', 'gpt-4o', 'claude-3', 'claude-sonnet', 'o1', 'o3'];
    const usesPremiumModels = await db.collection('messages')
      .distinct('user_id', { 
        user_id: { $in: userIds }, 
        model_used: { $regex: premiumModels.join('|'), $options: 'i' } 
      });
    
    const total = userIds.length;
    
    return {
      segment: segmentName,
      count: total,
      features: {
        assessment_complete: {
          count: segmentProfiles.filter(p => p.assessment_complete).length,
          rate: parseFloat(((segmentProfiles.filter(p => p.assessment_complete).length / total) * 100).toFixed(1)),
        },
        has_soulprint: {
          count: segmentProfiles.filter(p => p.soul_profile_summary).length,
          rate: parseFloat(((segmentProfiles.filter(p => p.soul_profile_summary).length / total) * 100).toFixed(1)),
        },
        has_imports: {
          count: hasImports.length,
          rate: parseFloat(((hasImports.length / total) * 100).toFixed(1)),
        },
        has_media: {
          count: hasMedia.length,
          rate: parseFloat(((hasMedia.length / total) * 100).toFixed(1)),
        },
        has_memories: {
          count: hasMemories.length,
          rate: parseFloat(((hasMemories.length / total) * 100).toFixed(1)),
        },
        uses_web_search: {
          count: usesWebSearch.length,
          rate: parseFloat(((usesWebSearch.length / total) * 100).toFixed(1)),
        },
        uses_premium_models: {
          count: usesPremiumModels.length,
          rate: parseFloat(((usesPremiumModels.length / total) * 100).toFixed(1)),
        },
      },
      top_models: modelUsageInSegment.map(m => m._id),
    };
  };

  const featuresBySegment = {
    light: await analyzeSegmentFeatures(lightUserIds, 'light'),
    moderate: await analyzeSegmentFeatures(moderateUserIds, 'moderate'),
    heavy: await analyzeSegmentFeatures(heavyUserIds, 'heavy'),
    power: await analyzeSegmentFeatures(powerUserIds, 'power'),
  };

  // Generate dynamic tier recommendations based on actual usage
  const generateTierRecommendations = () => {
    const recommendations = {
      free: {
        name: 'Free',
        description: 'For casual users exploring the platform',
        features: [
          { name: 'Basic Chat', included: true, reason: 'Core feature for all users' },
          { name: 'Standard AI Models', included: true, reason: 'GPT-3.5 or equivalent' },
          { name: 'Quick Assessment', included: true, reason: 'Helps onboard users' },
        ],
        limits: [],
        upsell_triggers: [],
      },
      basic: {
        name: 'Basic',
        description: 'For regular users who want more features',
        features: [],
        limits: [],
        upsell_triggers: [],
      },
      pro: {
        name: 'Pro',
        description: 'For power users who rely on SoulPrint daily',
        features: [],
        limits: [],
        upsell_triggers: [],
      },
      enterprise: {
        name: 'Enterprise',
        description: 'For businesses and super users',
        features: [],
        limits: [],
        upsell_triggers: [],
      },
    };

    // Analyze which features to include in each tier based on adoption rates
    const lightFeatures = featuresBySegment.light?.features || {};
    const moderateFeatures = featuresBySegment.moderate?.features || {};
    const heavyFeatures = featuresBySegment.heavy?.features || {};
    const powerFeatures = featuresBySegment.power?.features || {};

    // BASIC TIER: Features used by moderate users (21-100 messages)
    if (moderateFeatures.has_soulprint?.rate > 30) {
      recommendations.basic.features.push({
        name: 'SoulPrint Analysis',
        included: true,
        reason: `${moderateFeatures.has_soulprint.rate}% of moderate users generate SoulPrints`,
      });
    }
    if (moderateFeatures.assessment_complete?.rate > 40) {
      recommendations.basic.features.push({
        name: 'Full Assessment',
        included: true,
        reason: `${moderateFeatures.assessment_complete.rate}% completion rate in this segment`,
      });
    }
    if (moderateFeatures.has_memories?.rate > 20) {
      recommendations.basic.features.push({
        name: 'Memory System',
        included: true,
        reason: `${moderateFeatures.has_memories.rate}% use memories feature`,
      });
    }
    recommendations.basic.features.push({
      name: 'Chat History Export',
      included: true,
      reason: 'Standard feature for engaged users',
    });

    // PRO TIER: Features heavily used by heavy users (101-500 messages)
    if (heavyFeatures.has_imports?.rate > 15) {
      recommendations.pro.features.push({
        name: 'Data Import (ChatGPT, etc)',
        included: true,
        reason: `${heavyFeatures.has_imports.rate}% of heavy users import data`,
      });
    }
    if (heavyFeatures.has_media?.rate > 20) {
      recommendations.pro.features.push({
        name: 'Media Generation',
        included: true,
        reason: `${heavyFeatures.has_media.rate}% generate images/videos`,
        limit: '50 generations/month suggested',
      });
    }
    if (heavyFeatures.uses_web_search?.rate > 25) {
      recommendations.pro.features.push({
        name: 'Web Search Integration',
        included: true,
        reason: `${heavyFeatures.uses_web_search.rate}% use web search`,
      });
    }
    if (heavyFeatures.uses_premium_models?.rate > 30) {
      recommendations.pro.features.push({
        name: 'Premium AI Models',
        included: true,
        reason: `${heavyFeatures.uses_premium_models.rate}% use GPT-4/Claude`,
      });
    }
    recommendations.pro.features.push({
      name: 'Priority Support',
      included: true,
      reason: 'High-value users expect faster responses',
    });

    // ENTERPRISE TIER: Everything + exclusive features for power users
    recommendations.enterprise.features.push({
      name: 'Unlimited Messages',
      included: true,
      reason: 'Power users average 500+ messages',
    });
    recommendations.enterprise.features.push({
      name: 'Unlimited Media Generation',
      included: true,
      reason: `${powerFeatures.has_media?.rate || 0}% of power users generate media`,
    });
    recommendations.enterprise.features.push({
      name: 'All Premium Models',
      included: true,
      reason: `${powerFeatures.uses_premium_models?.rate || 0}% use premium models`,
    });
    recommendations.enterprise.features.push({
      name: 'API Access',
      included: true,
      reason: 'For integrations and automation',
    });
    recommendations.enterprise.features.push({
      name: 'Dedicated Support',
      included: true,
      reason: 'White-glove service for top customers',
    });
    recommendations.enterprise.features.push({
      name: 'Custom Integrations',
      included: true,
      reason: 'Telegram, webhooks, etc.',
    });

    // Add limits based on usage patterns
    const avgLightMsgs = lightUserIds.length > 0 ? 
      userMessageCounts.filter(u => lightUserIds.includes(u._id)).reduce((sum, u) => sum + u.message_count, 0) / lightUserIds.length : 10;
    const avgModerateMsgs = moderateUserIds.length > 0 ?
      userMessageCounts.filter(u => moderateUserIds.includes(u._id)).reduce((sum, u) => sum + u.message_count, 0) / moderateUserIds.length : 50;
    const avgHeavyMsgs = heavyUserIds.length > 0 ?
      userMessageCounts.filter(u => heavyUserIds.includes(u._id)).reduce((sum, u) => sum + u.message_count, 0) / heavyUserIds.length : 250;

    recommendations.free.limits = [
      { type: 'messages', value: Math.round(avgLightMsgs * 1.5), unit: 'per month', reason: `Avg light user: ${Math.round(avgLightMsgs)} msgs` },
      { type: 'models', value: 'Standard only', reason: 'Reserve premium for paid tiers' },
    ];
    
    recommendations.basic.limits = [
      { type: 'messages', value: Math.round(avgModerateMsgs * 1.2), unit: 'per month', reason: `Avg moderate user: ${Math.round(avgModerateMsgs)} msgs` },
      { type: 'media', value: 10, unit: 'per month', reason: 'Limited media to encourage Pro upgrade' },
    ];
    
    recommendations.pro.limits = [
      { type: 'messages', value: Math.round(avgHeavyMsgs * 1.5), unit: 'per month', reason: `Avg heavy user: ${Math.round(avgHeavyMsgs)} msgs` },
      { type: 'media', value: 50, unit: 'per month', reason: 'Generous but not unlimited' },
    ];

    // Upsell triggers
    recommendations.free.upsell_triggers = [
      'Message limit reached',
      'Tries to use premium model',
      'Tries to generate media',
    ];
    recommendations.basic.upsell_triggers = [
      'Media limit reached',
      'Wants to import data',
      'Needs priority support',
    ];
    recommendations.pro.upsell_triggers = [
      'Needs unlimited usage',
      'Wants API access',
      'Requires dedicated support',
    ];

    return recommendations;
  };

  const tierRecommendations = generateTierRecommendations();

  // ── MEDIA GENERATION INSIGHTS ──────────────────────────────────────────────
  const mediaByType = await db.collection('media_gallery').aggregate([
    { $group: { _id: '$type', count: { $sum: 1 }, total_cost: { $sum: '$cost_usd' } } },
  ]).toArray();

  const mediaUsersCount = (await db.collection('media_gallery').distinct('user_id')).length;
  const avgMediaPerUser = mediaUsersCount > 0 
    ? (await db.collection('media_gallery').countDocuments()) / mediaUsersCount 
    : 0;

  // ── ENGAGEMENT TRENDS (Last 30 days by week) ───────────────────────────────
  const weeklyTrends = [];
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
    
    const weekMessages = await db.collection('messages').countDocuments({
      created_at: { $gte: weekStart, $lt: weekEnd }
    });
    const weekActiveUsers = await db.collection('users').countDocuments({
      last_active_at: { $gte: weekStart, $lt: weekEnd }
    });
    const weekNewUsers = await db.collection('users').countDocuments({
      created_at: { $gte: weekStart, $lt: weekEnd }
    });

    weeklyTrends.unshift({
      week: `Week ${4 - i}`,
      start: weekStart.toISOString().split('T')[0],
      messages: weekMessages,
      active_users: weekActiveUsers,
      new_users: weekNewUsers,
    });
  }

  // ── PRICING RECOMMENDATIONS ────────────────────────────────────────────────
  // Calculate suggested tier limits based on actual usage
  const messagePercentiles = await db.collection('messages').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$user_id', count: { $sum: 1 } } },
    { $sort: { count: 1 } },
  ]).toArray();

  const msgCounts = messagePercentiles.map(u => u.count);
  const getPercentile = (arr, p) => {
    const idx = Math.floor(arr.length * p);
    return arr[idx] || 0;
  };

  // Calculate actual costs
  const totalCostAgg = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true } } },
    { $group: { _id: null, input: { $sum: '$est_input_tokens' }, output: { $sum: '$est_output_tokens' } } },
  ]).toArray();
  
  const totalLLMCost = totalCostAgg.length > 0
    ? (totalCostAgg[0].input / 1_000_000) * 5 + (totalCostAgg[0].output / 1_000_000) * 15
    : 0;
  
  // Get media costs
  const mediaCostAgg = await db.collection('media_gallery').aggregate([
    { $group: { _id: null, total_cost: { $sum: '$cost_usd' } } },
  ]).toArray();
  const totalMediaCost = mediaCostAgg[0]?.total_cost || 0;
  
  // Calculate per-user costs by tier
  const activeUserCount = userMessageCounts.length || 1;
  const avgCostPerActiveUser = (totalLLMCost + totalMediaCost) / activeUserCount;
  
  // Cost per message (for tier calculation)
  const totalMessages = msgCounts.reduce((a, b) => a + b, 0) || 1;
  const costPerMessage = totalLLMCost / totalMessages;
  
  // Market comparison data (2025 pricing)
  const marketComparison = {
    chatgpt_plus: { price: 20, name: 'ChatGPT Plus' },
    claude_pro: { price: 20, name: 'Claude Pro' },
    perplexity_pro: { price: 20, name: 'Perplexity Pro' },
    chatgpt_pro: { price: 200, name: 'ChatGPT Pro' },
    perplexity_max: { price: 200, name: 'Perplexity Max' },
    chatgpt_team: { price: 30, name: 'ChatGPT Team (per user)' },
  };
  
  // Calculate tier pricing based on 70-90% gross margin targets
  const tierLimits = {
    free: getPercentile(msgCounts, 0.5) || 25,
    basic: getPercentile(msgCounts, 0.8) || 100,
    pro: getPercentile(msgCounts, 0.95) || 500,
  };
  
  // Estimate cost for each tier based on message limits
  const tierCosts = {
    free: tierLimits.free * costPerMessage,
    basic: tierLimits.basic * costPerMessage,
    pro: tierLimits.pro * costPerMessage,
    unlimited: avgCostPerActiveUser * 3, // Power users typically 3x average
  };
  
  // Calculate prices for target margins (70%, 80%, 90%)
  const calculatePrice = (cost, margin) => {
    return cost / (1 - margin);
  };
  
  // Generate pricing tiers
  const pricingTiers = {
    free: {
      name: 'Free',
      message_limit: tierLimits.free,
      estimated_cost: parseFloat(tierCosts.free.toFixed(2)),
      price: 0,
      margin: 'N/A (acquisition)',
      features: ['Basic chat', 'Limited messages', 'Standard models'],
    },
    basic: {
      name: 'Basic',
      message_limit: tierLimits.basic,
      estimated_cost: parseFloat(tierCosts.basic.toFixed(2)),
      price_at_70_margin: parseFloat(calculatePrice(tierCosts.basic, 0.70).toFixed(2)),
      price_at_80_margin: parseFloat(calculatePrice(tierCosts.basic, 0.80).toFixed(2)),
      price_at_90_margin: parseFloat(calculatePrice(tierCosts.basic, 0.90).toFixed(2)),
      recommended_price: parseFloat(Math.ceil(calculatePrice(tierCosts.basic, 0.80))),
      features: ['More messages', 'All standard models', 'Import data', 'SoulPrint analysis'],
    },
    pro: {
      name: 'Pro',
      message_limit: tierLimits.pro,
      estimated_cost: parseFloat(tierCosts.pro.toFixed(2)),
      price_at_70_margin: parseFloat(calculatePrice(tierCosts.pro, 0.70).toFixed(2)),
      price_at_80_margin: parseFloat(calculatePrice(tierCosts.pro, 0.80).toFixed(2)),
      price_at_90_margin: parseFloat(calculatePrice(tierCosts.pro, 0.90).toFixed(2)),
      recommended_price: parseFloat(Math.ceil(calculatePrice(tierCosts.pro, 0.80))),
      features: ['High message limit', 'Premium models', 'Media generation', 'Priority support', 'Advanced analytics'],
    },
    enterprise: {
      name: 'Enterprise',
      message_limit: 'Unlimited',
      estimated_cost: parseFloat(tierCosts.unlimited.toFixed(2)),
      price_at_70_margin: parseFloat(calculatePrice(tierCosts.unlimited, 0.70).toFixed(2)),
      price_at_80_margin: parseFloat(calculatePrice(tierCosts.unlimited, 0.80).toFixed(2)),
      price_at_90_margin: parseFloat(calculatePrice(tierCosts.unlimited, 0.90).toFixed(2)),
      recommended_price: parseFloat(Math.ceil(calculatePrice(tierCosts.unlimited, 0.80))),
      features: ['Unlimited messages', 'All premium models', 'Unlimited media', 'API access', 'Dedicated support', 'Custom integrations'],
    },
  };
  
  // Market positioning recommendations
  const marketPositioning = {
    budget_option: {
      basic: Math.min(10, pricingTiers.basic.recommended_price),
      pro: Math.min(20, pricingTiers.pro.recommended_price),
      enterprise: Math.min(50, pricingTiers.enterprise.recommended_price),
      strategy: 'Undercut market leaders to gain market share',
    },
    competitive: {
      basic: Math.min(15, Math.max(pricingTiers.basic.recommended_price, 10)),
      pro: 20, // Match ChatGPT/Claude
      enterprise: Math.min(99, Math.max(pricingTiers.enterprise.recommended_price, 50)),
      strategy: 'Match major competitors while offering differentiated value',
    },
    premium: {
      basic: Math.max(15, pricingTiers.basic.recommended_price),
      pro: Math.max(25, pricingTiers.pro.recommended_price),
      enterprise: Math.max(99, pricingTiers.enterprise.recommended_price),
      strategy: 'Position as premium offering with superior personalization',
    },
  };

  const pricingRecommendations = {
    // Usage-based limits
    free_tier_limit: tierLimits.free,
    basic_tier_limit: tierLimits.basic,
    pro_tier_limit: tierLimits.pro,
    power_users_above: getPercentile(msgCounts, 0.95),
    avg_messages_per_user: msgCounts.length > 0 ? Math.round(msgCounts.reduce((a, b) => a + b, 0) / msgCounts.length) : 0,
    median_messages: getPercentile(msgCounts, 0.5),
    
    // Cost analysis
    cost_per_message: parseFloat(costPerMessage.toFixed(4)),
    avg_cost_per_user: parseFloat(avgCostPerActiveUser.toFixed(2)),
    total_llm_cost: parseFloat(totalLLMCost.toFixed(2)),
    total_media_cost: parseFloat(totalMediaCost.toFixed(2)),
    
    // Detailed tier pricing
    tiers: pricingTiers,
    
    // Market comparison
    market_comparison: marketComparison,
    
    // Positioning strategies
    market_positioning: marketPositioning,
  };

  // ── CHURN INDICATORS ───────────────────────────────────────────────────────
  const inactiveUsers = await db.collection('users').countDocuments({
    accepted: true,
    last_active_at: { $lt: thirtyDaysAgo }
  });
  const churnRate = totalAccepted > 0 ? parseFloat(((inactiveUsers / totalAccepted) * 100).toFixed(1)) : 0;

  // Users who signed up but never sent a message
  const usersWithNoMessages = totalAccepted - userMessageCounts.length;
  const dropOffRate = totalAccepted > 0 ? parseFloat(((usersWithNoMessages / totalAccepted) * 100).toFixed(1)) : 0;

  // ── REVENUE POTENTIAL ESTIMATES ────────────────────────────────────────────
  // Based on typical SaaS pricing
  const revenuePotential = {
    if_free_tier_20_msgs: {
      paying_users: usageSegments.moderate.count + usageSegments.heavy.count + usageSegments.power.count,
      at_10_per_month: (usageSegments.moderate.count + usageSegments.heavy.count + usageSegments.power.count) * 10,
      at_20_per_month: (usageSegments.moderate.count + usageSegments.heavy.count + usageSegments.power.count) * 20,
    },
    if_free_tier_50_msgs: {
      paying_users: usageSegments.heavy.count + usageSegments.power.count,
      at_10_per_month: (usageSegments.heavy.count + usageSegments.power.count) * 10,
      at_20_per_month: (usageSegments.heavy.count + usageSegments.power.count) * 20,
    },
    enterprise_candidates: usageSegments.power.count,
  };

  return ok({
    generated_at: now.toISOString(),
    
    // User Segmentation
    user_segments: {
      inactive: { count: usageSegments.inactive.count, percentage: parseFloat(((usageSegments.inactive.count / totalAccepted) * 100).toFixed(1)) },
      light: { count: usageSegments.light.count, percentage: parseFloat(((usageSegments.light.count / totalAccepted) * 100).toFixed(1)), range: '1-20 msgs' },
      moderate: { count: usageSegments.moderate.count, percentage: parseFloat(((usageSegments.moderate.count / totalAccepted) * 100).toFixed(1)), range: '21-100 msgs' },
      heavy: { count: usageSegments.heavy.count, percentage: parseFloat(((usageSegments.heavy.count / totalAccepted) * 100).toFixed(1)), range: '101-500 msgs' },
      power: { count: usageSegments.power.count, percentage: parseFloat(((usageSegments.power.count / totalAccepted) * 100).toFixed(1)), range: '500+ msgs' },
    },
    
    // Top Users
    top_users: enrichedTopUsers,
    
    // Model Popularity
    model_popularity: modelPopularity,
    
    // Feature Adoption
    feature_adoption: featureAdoptionRates,
    
    // Feature usage by segment (for tier recommendations)
    features_by_segment: featuresBySegment,
    
    // Dynamic tier recommendations
    tier_recommendations: tierRecommendations,
    
    // Media Insights
    media_insights: {
      by_type: mediaByType.map(m => ({ type: m._id, count: m.count, total_cost: parseFloat((m.total_cost || 0).toFixed(2)) })),
      users_using_media: mediaUsersCount,
      avg_media_per_user: parseFloat(avgMediaPerUser.toFixed(1)),
      media_adoption_rate: totalAccepted > 0 ? parseFloat(((mediaUsersCount / totalAccepted) * 100).toFixed(1)) : 0,
    },
    
    // Weekly Trends
    weekly_trends: weeklyTrends,
    
    // Pricing Recommendations
    pricing_recommendations: pricingRecommendations,
    
    // Churn & Retention
    churn_indicators: {
      inactive_30d: inactiveUsers,
      churn_rate: churnRate,
      never_engaged: usersWithNoMessages,
      drop_off_rate: dropOffRate,
    },
    
    // Revenue Potential
    revenue_potential: revenuePotential,
  });
}

// ============================================================
// PRIVACY & DATA MANAGEMENT
// ============================================================

// Export all user data (GDPR compliance)
async function handleExportUserData(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Collect all user data from all collections
  const [
    profile,
    conversations,
    messages,
    assessmentAnswers,
    importedMessages,
    memories,
    feedbacks,
    schedules,
    commProfile,
    soulProfile,
    soulprintSnapshots,
  ] = await Promise.all([
    db.collection('profiles').findOne({ user_id: user.id }),
    db.collection('conversations').find({ user_id: user.id }).toArray(),
    db.collection('messages').find({ user_id: user.id }).toArray(),
    db.collection('assessment_answers').find({ user_id: user.id }).toArray(),
    db.collection('imported_messages').find({ user_id: user.id }).toArray(),
    db.collection('memories').find({ user_id: user.id }).toArray(),
    db.collection('feedback').find({ user_id: user.id }).toArray(),
    db.collection('schedules').find({ user_id: user.id }).toArray(),
    db.collection('communication_profiles').findOne({ user_id: user.id }),
    db.collection('soul_profiles').findOne({ user_id: user.id }),
    db.collection('soulprint_snapshots').find({ user_id: user.id }).toArray(),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      role: user.role,
    },
    profile: profile ? {
      display_name: profile.display_name,
      assistant_name: profile.assistant_name,
      descriptors: profile.descriptors,
      field: profile.field,
      help_with: profile.help_with,
      discovery_source: profile.discovery_source,
      soul_profile_summary: profile.soul_profile_summary,
    } : null,
    communication_profile: commProfile ? {
      directness: commProfile.directness,
      emotional_warmth: commProfile.emotional_warmth,
      information_density: commProfile.information_density,
      proactivity: commProfile.proactivity,
      decision_support: commProfile.decision_support,
      feedback_style: commProfile.feedback_style,
    } : null,
    assessment_answers: assessmentAnswers.map(a => ({
      question_id: a.question_id,
      answer_text: a.answer_text,
      answered_at: a.created_at,
    })),
    conversations: conversations.map(c => ({
      id: c.id,
      title: c.title,
      created_at: c.created_at,
    })),
    messages: messages.map(m => ({
      conversation_id: m.conversation_id,
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    })),
    imported_messages_count: importedMessages.length,
    imported_messages_sample: importedMessages.slice(0, 100).map(m => ({
      content: m.content?.substring(0, 500),
      source: m.source,
      timestamp: m.timestamp,
    })),
    memories: memories.map(m => ({
      content: m.content,
      created_at: m.created_at,
    })),
    soulprint_snapshots: soulprintSnapshots.map(s => ({
      generated_at: s.created_at,
      summary: s.summary,
      communication_style: s.communication_style,
      interests: s.interests,
    })),
    schedules: schedules.map(s => ({
      name: s.name,
      schedule: s.schedule,
      active: s.active,
    })),
    feedback_given: feedbacks.length,
  };

  // Log the export
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'data_export',
    created_at: new Date(),
  });

  return ok(exportData);
}

// Delete all user data (GDPR right to erasure)
async function handleDeleteUserData(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { confirm_email } = body;

  // Require email confirmation for safety
  if (confirm_email?.toLowerCase() !== user.email?.toLowerCase()) {
    return err('Please confirm your email address to delete your account', 400);
  }

  const db = await getDb();

  // Delete from all collections
  const collections = [
    'profiles',
    'conversations', 
    'messages',
    'assessment_answers',
    'imported_messages',
    'memories',
    'feedback',
    'schedules',
    'communication_profiles',
    'soul_profiles',
    'soulprint_snapshots',
    'soul_profile_history',
    'imports',
    'announcements_read',
  ];

  const deletionResults = {};
  for (const collection of collections) {
    const result = await db.collection(collection).deleteMany({ user_id: user.id });
    deletionResults[collection] = result.deletedCount;
  }

  // Delete telegram links
  await db.collection('telegram_links').deleteMany({ user_id: user.id });

  // Log deletion before removing user
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    action: 'account_deleted',
    user_email: user.email,
    deletion_results: deletionResults,
    created_at: new Date(),
  });

  // Finally delete the user
  await db.collection('users').deleteOne({ id: user.id });

  return ok({ 
    success: true, 
    message: 'Your account and all associated data have been permanently deleted.',
    deleted: deletionResults 
  });
}

// Get user privacy settings
async function handleGetPrivacySettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const settings = await db.collection('user_privacy_settings').findOne({ user_id: user.id });

  return ok({
    ai_training_opt_out: settings?.ai_training_opt_out || false,
    data_retention_days: settings?.data_retention_days || null, // null = keep forever
    analytics_opt_out: settings?.analytics_opt_out || false,
    created_at: settings?.created_at,
    updated_at: settings?.updated_at,
  });
}

// Update user privacy settings
async function handleUpdatePrivacySettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { ai_training_opt_out, data_retention_days, analytics_opt_out } = body;

  const db = await getDb();
  await db.collection('user_privacy_settings').updateOne(
    { user_id: user.id },
    { 
      $set: { 
        user_id: user.id,
        ai_training_opt_out: !!ai_training_opt_out,
        data_retention_days: data_retention_days || null,
        analytics_opt_out: !!analytics_opt_out,
        updated_at: new Date(),
      },
      $setOnInsert: { created_at: new Date() }
    },
    { upsert: true }
  );

  // Log the change
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'privacy_settings_updated',
    changes: body,
    created_at: new Date(),
  });

  return ok({ success: true });
}

// Delete all conversations (purge chat history)
async function handlePurgeChatHistory(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Delete all messages
  const messagesResult = await db.collection('messages').deleteMany({ user_id: user.id });
  
  // Delete all conversations
  const convsResult = await db.collection('conversations').deleteMany({ user_id: user.id });

  // Log the purge
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'chat_history_purged',
    messages_deleted: messagesResult.deletedCount,
    conversations_deleted: convsResult.deletedCount,
    created_at: new Date(),
  });

  return ok({ 
    success: true, 
    messages_deleted: messagesResult.deletedCount,
    conversations_deleted: convsResult.deletedCount,
  });
}

// Delete all imported data
async function handlePurgeImportedData(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Delete imported messages
  const messagesResult = await db.collection('imported_messages').deleteMany({ user_id: user.id });
  
  // Delete import records
  const importsResult = await db.collection('imports').deleteMany({ user_id: user.id });
  
  // Clear soul profile (derived from imports)
  await db.collection('soul_profiles').deleteOne({ user_id: user.id });

  // Log the purge
  await db.collection('audit_log').insertOne({
    id: uuidv4(),
    user_id: user.id,
    action: 'imported_data_purged',
    messages_deleted: messagesResult.deletedCount,
    imports_deleted: importsResult.deletedCount,
    created_at: new Date(),
  });

  return ok({ 
    success: true, 
    imported_messages_deleted: messagesResult.deletedCount,
    imports_deleted: importsResult.deletedCount,
  });
}

// Get data usage summary (transparency)
async function handleGetDataUsageSummary(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Count data in each collection
  const [
    messagesCount,
    conversationsCount,
    importedMessagesCount,
    memoriesCount,
    assessmentAnswersCount,
    snapshotsCount,
  ] = await Promise.all([
    db.collection('messages').countDocuments({ user_id: user.id }),
    db.collection('conversations').countDocuments({ user_id: user.id }),
    db.collection('imported_messages').countDocuments({ user_id: user.id }),
    db.collection('memories').countDocuments({ user_id: user.id }),
    db.collection('assessment_answers').countDocuments({ user_id: user.id }),
    db.collection('soulprint_snapshots').countDocuments({ user_id: user.id }),
  ]);

  // Get privacy settings
  const privacySettings = await db.collection('user_privacy_settings').findOne({ user_id: user.id });

  // Get user info
  const userDoc = await db.collection('users').findOne({ id: user.id });

  return ok({
    account: {
      created_at: userDoc?.created_at,
      email: userDoc?.email,
      auth_provider: userDoc?.auth_provider || 'email',
    },
    data_stored: {
      chat_messages: messagesCount,
      conversations: conversationsCount,
      imported_messages: importedMessagesCount,
      memories: memoriesCount,
      assessment_answers: assessmentAnswersCount,
      soulprint_snapshots: snapshotsCount,
    },
    privacy_settings: {
      ai_training_opt_out: privacySettings?.ai_training_opt_out || false,
      data_retention_days: privacySettings?.data_retention_days || 'Forever',
      analytics_opt_out: privacySettings?.analytics_opt_out || false,
    },
    data_usage: [
      { purpose: 'Personalization', description: 'Your assessment and chat history help personalize AI responses to your communication style.' },
      { purpose: 'Memory', description: 'Memories you save are used to provide context in future conversations.' },
      { purpose: 'SoulPrint Analysis', description: 'We analyze your data to generate your SoulPrint profile when you request it.' },
    ],
  });
}

// Get active sessions
async function handleGetSessions(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const sessions = await db.collection('user_sessions')
    .find({ user_id: user.id, expires_at: { $gt: new Date() } })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();

  return ok({
    sessions: sessions.map(s => ({
      id: s.id,
      device: s.device || 'Unknown device',
      location: s.location || 'Unknown',
      created_at: s.created_at,
      last_active: s.last_active,
      is_current: s.token_hash === request.headers.get('authorization')?.replace('Bearer ', '').substring(0, 20),
    }))
  });
}

// Revoke a session
async function handleRevokeSession(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { session_id } = body;

  if (!session_id) return err('Session ID required', 400);

  const db = await getDb();
  const result = await db.collection('user_sessions').deleteOne({ 
    id: session_id, 
    user_id: user.id 
  });

  if (result.deletedCount === 0) {
    return err('Session not found', 404);
  }

  return ok({ success: true });
}

async function handleAdminInviteAdmin(request) {
  const admin = await requireAdmin(request);
  if (!admin || admin.role !== 'superadmin') return err('Only superadmin can invite admins', 403);

  const body = await request.json();
  const { email } = body;
  if (!email) return err('email required');

  const db = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return err('User not found');

  await db.collection('users').updateOne(
    { email: email.toLowerCase() },
    { $set: { role: 'admin', accepted: true } }
  );

  return ok({ success: true });
}

// ============================================================
// BETA ACCESS CODE MANAGEMENT
// ============================================================

// Get beta code stats
async function handleAdminGetBetaCodeStats(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
  
  if (!betaCode) {
    return ok({ code: null, uses: 0, expires_at: null });
  }

  return ok({
    code: betaCode.code,
    uses: betaCode.uses || 0,
    expires_at: betaCode.expires_at,
    created_at: betaCode.created_at,
  });
}

// Create/Update beta code
async function handleAdminCreateBetaCode(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  let { code, expires_at } = body;

  // Generate random code if not provided
  if (!code) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code = 'BETA-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } else {
    code = code.toUpperCase().trim();
  }

  const db = await getDb();
  await db.collection('beta_codes').updateOne(
    { id: 'current' },
    { 
      $set: { 
        id: 'current',
        code,
        expires_at: expires_at ? new Date(expires_at) : null,
        created_at: new Date(),
        uses: 0,
      } 
    },
    { upsert: true }
  );

  return ok({ code, success: true });
}

// Delete/Disable beta code
async function handleAdminDeleteBetaCode(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  await db.collection('beta_codes').deleteOne({ id: 'current' });

  return ok({ success: true });
}

// Redeem beta code (for waitlisted users)
async function handleRedeemBetaCode(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { code } = body;
  
  if (!code) return err('Access code required');

  const db = await getDb();
  
  // Check if user is already accepted
  if (user.accepted) {
    return ok({ success: true, message: 'Already accepted' });
  }

  // Check if user has completed required onboarding questions
  // Required fields: display_name, discovery_source (how did you find us)
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  const hasDisplayName = profile?.display_name || user.profile?.display_name;
  const hasDiscoverySource = profile?.discovery_source || user.profile?.discovery_source;
  
  if (!hasDisplayName || !hasDiscoverySource) {
    return err('Please complete the onboarding questions before redeeming your access code. Go to the profile setup to answer required questions.', 400);
  }

  // Check if user has completed assessment (Quick Start = 12 questions, Full = 36 questions)
  const assessmentAnswerCount = await db.collection('assessment_answers').countDocuments({ user_id: user.id });
  const gradualAnswerCount = await db.collection('gradual_assessment_progress').countDocuments({ user_id: user.id });
  const totalAnswers = assessmentAnswerCount + gradualAnswerCount;
  
  // Require at least 12 answers (Quick Start minimum)
  if (totalAnswers < 12) {
    return err(`Please complete the assessment questions before redeeming your access code. You have answered ${totalAnswers}/12 required questions.`, 400);
  }

  const codeToCheck = code.toUpperCase().trim();
  let validCode = false;
  let usedCodeSource = null;

  // First check beta_codes_v2 (admin-created codes)
  const v2Code = await db.collection('beta_codes_v2').findOne({ 
    code: codeToCheck,
    active: true,
  });
  
  if (v2Code) {
    // Check expiration
    const isExpired = v2Code.expires_at && new Date(v2Code.expires_at) < new Date();
    if (isExpired) {
      return err('This access code has expired', 400);
    }
    
    // Check usage limits
    const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
    const isExhausted = v2Code.max_uses && currentUses >= v2Code.max_uses;
    if (isExhausted) {
      return err('This access code has reached its usage limit', 400);
    }
    
    validCode = true;
    usedCodeSource = 'v2';
    
    // Increment usage count
    await db.collection('beta_codes_v2').updateOne(
      { code: codeToCheck },
      { $inc: { uses: 1, uses_count: 1 } }
    );
  } else {
    // Fallback: check legacy beta_codes collection
    const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
    
    if (legacyCode && legacyCode.code && legacyCode.code.toUpperCase() === codeToCheck) {
      // Check if expired
      if (legacyCode.expires_at && new Date(legacyCode.expires_at) < new Date()) {
        return err('This access code has expired', 400);
      }
      
      validCode = true;
      usedCodeSource = 'legacy';
      
      // Increment usage count
      await db.collection('beta_codes').updateOne(
        { id: 'current' },
        { $inc: { uses: 1 } }
      );
    }
  }

  if (!validCode) {
    console.log('[Redeem Code] Invalid code attempted:', code, 'by user:', user.email);
    return err('Invalid access code', 400);
  }

  // Accept the user
  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { accepted: true, beta_code_used: code, accepted_at: new Date() } }
  );

  console.log('[Redeem Code] Code accepted:', code, 'for user:', user.email, 'source:', usedCodeSource);
  return ok({ success: true, message: 'Access granted!' });
}

// Validate beta code during registration (without requiring auth)
async function handleValidateBetaCode(request) {
  const body = await request.json();
  const { code } = body;
  
  if (!code) return ok({ valid: false });

  const db = await getDb();
  const codeToCheck = code.toUpperCase().trim();

  // First check beta_codes_v2 (admin-created codes)
  const v2Code = await db.collection('beta_codes_v2').findOne({ 
    code: codeToCheck,
    active: true,
  });
  
  if (v2Code) {
    // Check expiration
    if (v2Code.expires_at && new Date(v2Code.expires_at) < new Date()) {
      return ok({ valid: false, expired: true });
    }
    
    // Check usage limits
    const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
    if (v2Code.max_uses && currentUses >= v2Code.max_uses) {
      return ok({ valid: false, exhausted: true });
    }
    
    return ok({ valid: true });
  }

  // Fallback: check legacy beta_codes collection
  const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
  
  if (legacyCode && legacyCode.code && legacyCode.code.toUpperCase() === codeToCheck) {
    // Check if expired
    if (legacyCode.expires_at && new Date(legacyCode.expires_at) < new Date()) {
      return ok({ valid: false, expired: true });
    }
    
    return ok({ valid: true });
  }

  return ok({ valid: false });
}

// Send beta code via email
async function handleAdminSendBetaCode(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { email, name } = body;
  
  if (!email) return err('Email required');

  const db = await getDb();
  const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
  
  if (!betaCode || !betaCode.code) {
    return err('No beta code configured. Create one first in Settings.');
  }

  // Check if expired
  if (betaCode.expires_at && new Date(betaCode.expires_at) < new Date()) {
    return err('Beta code has expired. Please create a new one.');
  }

  // Send the email
  const result = await sendBetaCodeEmail(email, betaCode.code, name);
  
  if (!result.success) {
    return err(`Failed to send email: ${result.error}`);
  }

  // Log the send
  await db.collection('beta_code_sends').insertOne({
    id: uuidv4(),
    email,
    name: name || null,
    code: betaCode.code,
    sent_by: admin.id,
    sent_at: new Date(),
  });

  return ok({ success: true, message: `Beta code sent to ${email}` });
}

// ============================================================
// CAPTCHA & EMAIL VERIFICATION
// ============================================================

// Verify Google reCAPTCHA token
async function handleVerifyCaptcha(request) {
  try {
    const { token, action } = await request.json();
    
    if (!token) {
      return err('Captcha token required', 400);
    }

    const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
    if (!RECAPTCHA_SECRET) {
      console.error('RECAPTCHA_SECRET_KEY not configured');
      return err('Captcha verification not configured', 500);
    }

    // Verify with Google
    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${RECAPTCHA_SECRET}&response=${token}`,
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      console.error('reCAPTCHA verification failed:', verifyData);
      return err('Security verification failed', 400);
    }

    // Check score (reCAPTCHA v3 returns a score 0.0-1.0)
    if (verifyData.score !== undefined && verifyData.score < 0.3) {
      console.warn('Low reCAPTCHA score:', verifyData.score);
      return err('Security check failed. Please try again.', 400);
    }

    // Check action matches
    if (action && verifyData.action !== action) {
      console.warn('reCAPTCHA action mismatch:', verifyData.action, 'expected:', action);
      return err('Security verification mismatch', 400);
    }

    return ok({ success: true, score: verifyData.score });
  } catch (error) {
    console.error('Captcha verification error:', error);
    return err('Captcha verification failed', 500);
  }
}

// Send email verification
async function handleSendVerificationEmail(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);

    const { email } = await request.json();
    if (!email) return err('Email required', 400);

    const db = await getDb();
    
    // Generate verification token
    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save verification token
    await db.collection('users').updateOne(
      { id: user.id },
      { 
        $set: { 
          verification_token: verificationToken,
          verification_expires: expiresAt,
          email_verified: false,
        } 
      }
    );

    // Send verification email
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://soulprintengine.ai';
    const verifyUrl = `${BASE_URL}/verify-email?token=${verificationToken}`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SoulPrint <team@soulprintengine.ai>',
        to: [email],
        subject: 'Verify your SoulPrint account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D1217; padding: 40px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #F64000; margin: 0;">SoulPrint</h1>
              <p style="color: #707176; margin-top: 8px;">Your Personal AI</p>
            </div>
            
            <div style="background: #141a21; border-radius: 8px; padding: 30px; text-align: center;">
              <h2 style="color: white; margin-top: 0;">Verify Your Email</h2>
              <p style="color: #D2D3D7; line-height: 1.6;">
                Thanks for signing up for SoulPrint! Click the button below to verify your email address and activate your account.
              </p>
              
              <a href="${verifyUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #F64000, #d63600); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                Verify My Email
              </a>
              
              <p style="color: #707176; font-size: 12px; margin-top: 20px;">
                This link expires in 24 hours. If you didn't create an account, you can ignore this email.
              </p>
            </div>
            
            <p style="color: #4B5057; font-size: 12px; text-align: center; margin-top: 30px;">
              © ${new Date().getFullYear()} SoulPrint by ArcheForge
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errorData = await emailRes.json();
      console.error('Failed to send verification email:', errorData);
      return err('Failed to send verification email', 500);
    }

    return ok({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Send verification error:', error);
    return err('Failed to send verification email', 500);
  }
}

// Verify email token (GET endpoint handled separately)
async function handleVerifyEmail(request) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return err('Verification token required', 400);
    }

    const db = await getDb();
    
    // Find user with this token
    const user = await db.collection('users').findOne({
      verification_token: token,
      verification_expires: { $gt: new Date() },
    });

    if (!user) {
      return err('Invalid or expired verification link', 400);
    }

    // Mark email as verified
    await db.collection('users').updateOne(
      { id: user.id },
      { 
        $set: { email_verified: true },
        $unset: { verification_token: '', verification_expires: '' },
      }
    );

    return ok({ success: true, message: 'Email verified successfully!' });
  } catch (error) {
    console.error('Verify email error:', error);
    return err('Verification failed', 500);
  }
}

// ============================================================
// ADVANCED BETA CODE MANAGEMENT (Groups, Multiple Codes, Analytics)
// ============================================================

// Generate a random code with prefix
function generateBetaCode(prefix = 'BETA') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix + '-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all beta groups with metrics
async function handleAdminGetBetaGroups(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const groups = await db.collection('beta_groups').find({}).sort({ created_at: -1 }).toArray();
  
  // Calculate metrics for each group
  const groupsWithMetrics = await Promise.all(groups.map(async (group) => {
    const codes = await db.collection('beta_codes_v2').find({ group_id: group.id }).toArray();
    const totalCodes = codes.length;
    const activeCodes = codes.filter(c => c.active && (!c.expires_at || new Date(c.expires_at) >= new Date())).length;
    const totalRedemptions = codes.reduce((sum, c) => sum + (c.uses_count || 0), 0);
    
    // Get unique users who used codes from this group
    const redemptions = await db.collection('beta_code_redemptions').find({ 
      code_id: { $in: codes.map(c => c.id) } 
    }).toArray();
    const uniqueUsers = new Set(redemptions.map(r => r.user_id)).size;
    
    return {
      ...group,
      total_codes: totalCodes,
      active_codes: activeCodes,
      total_redemptions: totalRedemptions,
      unique_users: uniqueUsers,
      conversion_rate: totalCodes > 0 ? Math.round((totalRedemptions / totalCodes) * 100) : 0,
    };
  }));

  return ok({ groups: groupsWithMetrics });
}

// Create a new beta group
async function handleAdminCreateBetaGroup(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { name, description } = body;
  
  if (!name) return err('Group name required');

  const db = await getDb();
  const groupId = uuidv4();
  
  await db.collection('beta_groups').insertOne({
    id: groupId,
    name: name.trim(),
    description: description || '',
    created_at: new Date(),
    created_by: admin.id,
  });

  return ok({ id: groupId, name: name.trim(), success: true });
}

// Delete a beta group (and optionally its codes)
async function handleAdminDeleteBetaGroup(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { group_id, delete_codes = false } = body;
  
  if (!group_id) return err('Group ID required');

  const db = await getDb();
  
  // Delete or deactivate codes in this group
  if (delete_codes) {
    await db.collection('beta_codes_v2').deleteMany({ group_id });
  } else {
    await db.collection('beta_codes_v2').updateMany(
      { group_id },
      { $set: { active: false, group_id: null } }
    );
  }
  
  await db.collection('beta_groups').deleteOne({ id: group_id });

  return ok({ success: true });
}

// Get all beta codes with full details
async function handleAdminGetBetaCodes(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id');
  
  const query = groupId ? { group_id: groupId } : {};
  const codes = await db.collection('beta_codes_v2').find(query).sort({ created_at: -1 }).toArray();
  
  // Get group names
  const groups = await db.collection('beta_groups').find({}).toArray();
  const groupMap = new Map(groups.map(g => [g.id, g.name]));
  
  const codesWithDetails = codes.map(code => ({
    ...code,
    group_name: code.group_id ? groupMap.get(code.group_id) : 'Ungrouped',
    is_expired: code.expires_at && new Date(code.expires_at) < new Date(),
    is_exhausted: code.max_uses && (code.uses_count ?? code.uses ?? 0) >= code.max_uses,
    total_uses: code.uses_count ?? code.uses ?? 0,
  }));

  return ok({ codes: codesWithDetails });
}

// Create beta codes (single or bulk)
async function handleAdminCreateBetaCodes(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { 
    group_id, 
    count = 1, 
    prefix = 'BETA',
    max_uses = null,  // null = unlimited
    is_single_use = false,
    expires_at = null,
    custom_code = null,  // For single code creation
    label = '',
  } = body;

  if (count < 1 || count > 100) {
    return err('Count must be between 1 and 100');
  }

  const db = await getDb();
  const createdCodes = [];
  
  for (let i = 0; i < count; i++) {
    const code = custom_code && count === 1 
      ? custom_code.toUpperCase().trim() 
      : generateBetaCode(prefix);
    
    const codeDoc = {
      id: uuidv4(),
      code,
      group_id: group_id || null,
      label: label || '',
      max_uses: is_single_use ? 1 : (max_uses || null),
      uses_count: 0,
      is_single_use,
      expires_at: expires_at ? new Date(expires_at) : null,
      active: true,
      created_at: new Date(),
      created_by: admin.id,
    };
    
    await db.collection('beta_codes_v2').insertOne(codeDoc);
    createdCodes.push(codeDoc);
  }

  return ok({ codes: createdCodes, success: true });
}

// Update a beta code
async function handleAdminUpdateBetaCode(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { code_id, active, max_uses, expires_at, label, group_id } = body;
  
  if (!code_id) return err('Code ID required');

  const db = await getDb();
  const updates = {};
  
  if (typeof active === 'boolean') updates.active = active;
  if (max_uses !== undefined) updates.max_uses = max_uses;
  if (expires_at !== undefined) updates.expires_at = expires_at ? new Date(expires_at) : null;
  if (label !== undefined) updates.label = label;
  if (group_id !== undefined) updates.group_id = group_id;
  
  updates.updated_at = new Date();

  await db.collection('beta_codes_v2').updateOne(
    { id: code_id },
    { $set: updates }
  );

  return ok({ success: true });
}

// Delete a beta code
async function handleAdminDeleteBetaCodeV2(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { code_id } = body;
  
  if (!code_id) return err('Code ID required');

  const db = await getDb();
  await db.collection('beta_codes_v2').deleteOne({ id: code_id });

  return ok({ success: true });
}

// Get redemption history for a code or all codes
async function handleAdminGetBetaRedemptions(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const url = new URL(request.url);
  const codeId = url.searchParams.get('code_id');
  const groupId = url.searchParams.get('group_id');
  
  let query = {};
  
  if (codeId) {
    query.code_id = codeId;
  } else if (groupId) {
    const codes = await db.collection('beta_codes_v2').find({ group_id: groupId }).toArray();
    query.code_id = { $in: codes.map(c => c.id) };
  }
  
  const redemptions = await db.collection('beta_code_redemptions')
    .find(query)
    .sort({ redeemed_at: -1 })
    .limit(100)
    .toArray();
  
  // Get code details
  const codeIds = [...new Set(redemptions.map(r => r.code_id))];
  const codes = await db.collection('beta_codes_v2').find({ id: { $in: codeIds } }).toArray();
  const codeMap = new Map(codes.map(c => [c.id, c.code]));
  
  const redemptionsWithDetails = redemptions.map(r => ({
    ...r,
    code: codeMap.get(r.code_id) || 'Unknown',
  }));

  return ok({ redemptions: redemptionsWithDetails });
}

// Validate and redeem a beta code (V2 - supports multiple codes)
async function handleValidateBetaCodeV2(request) {
  const body = await request.json();
  const { code, user_id, user_email } = body;
  
  if (!code) return ok({ valid: false });

  const db = await getDb();
  
  // First check v2 codes
  const betaCode = await db.collection('beta_codes_v2').findOne({ 
    code: code.toUpperCase().trim(),
    active: true,
  });
  
  if (!betaCode) {
    // Fall back to legacy single code
    const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
    if (legacyCode && legacyCode.code && 
        legacyCode.code.toUpperCase() === code.toUpperCase().trim() &&
        (!legacyCode.expires_at || new Date(legacyCode.expires_at) >= new Date())) {
      return ok({ valid: true, legacy: true });
    }
    return ok({ valid: false });
  }

  // Check if expired
  if (betaCode.expires_at && new Date(betaCode.expires_at) < new Date()) {
    return ok({ valid: false, expired: true });
  }

  // Check if exhausted
  if (betaCode.max_uses && betaCode.uses_count >= betaCode.max_uses) {
    return ok({ valid: false, exhausted: true });
  }

  // If user info provided, record the redemption
  if (user_id && user_email) {
    // Check if user already used this code
    const existingRedemption = await db.collection('beta_code_redemptions').findOne({
      code_id: betaCode.id,
      user_id,
    });
    
    if (existingRedemption) {
      return ok({ valid: true, already_used: true });
    }
    
    // Record redemption
    await db.collection('beta_code_redemptions').insertOne({
      id: uuidv4(),
      code_id: betaCode.id,
      code: betaCode.code,
      user_id,
      user_email,
      redeemed_at: new Date(),
    });
    
    // Increment usage count
    await db.collection('beta_codes_v2').updateOne(
      { id: betaCode.id },
      { $inc: { uses_count: 1 } }
    );
  }

  return ok({ 
    valid: true, 
    code_id: betaCode.id,
    group_id: betaCode.group_id,
  });
}

// Send notification email when a new user registers
async function sendNewUserNotificationEmail(user) {
  const ADMIN_EMAIL = 'reggie@archeforge.com';
  
  try {
    // Use the email service instead of inline Resend call
    const { sendNewUserNotification } = await import('@/lib/email.js');
    const result = await sendNewUserNotification(ADMIN_EMAIL, user);
    
    if (result.success) {
      console.log('[Email] New user notification sent to', ADMIN_EMAIL);
    } else {
      console.error('[Email] Failed to send new user notification:', result.error);
    }
  } catch (e) {
    console.error('[Email] Failed to send new user notification:', e.message);
  }
}

// ============================================================
// CLOUD IMPORT (for large files)
// ============================================================

// Chunked upload - Initialize
async function handleChunkedInit(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { filename, fileSize, totalChunks, type = 'chatgpt' } = body;

  if (!filename || !totalChunks) {
    return err('Missing required fields');
  }

  const db = await getDb();
  const uploadId = uuidv4();

  await db.collection('upload_sessions').insertOne({
    id: uploadId,
    user_id: user.id,
    filename,
    file_size: fileSize,
    total_chunks: totalChunks,
    received_chunks: [],
    type,
    status: 'uploading',
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(`[ChunkedUpload] Initialized upload ${uploadId} for ${filename} (${totalChunks} chunks)`);

  return ok({ uploadId });
}

// Chunked upload - Receive chunk (store on disk, not MongoDB)
async function handleChunkedChunk(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const uploadId = formData.get('uploadId');
    const chunkIndex = parseInt(formData.get('chunkIndex'), 10);
    const chunk = formData.get('chunk');

    if (!uploadId || chunkIndex === undefined || !chunk) {
      return err('Missing required fields');
    }

    const db = await getDb();
    const session = await db.collection('upload_sessions').findOne({ id: uploadId, user_id: user.id });

    if (!session) {
      return err('Upload session not found', 404);
    }

    // Store chunk on disk instead of MongoDB (better for large files)
    const fs = require('fs').promises;
    const path = require('path');
    const chunkDir = path.join('/tmp', 'uploads', uploadId);
    
    // Create directory if it doesn't exist
    await fs.mkdir(chunkDir, { recursive: true });
    
    // Write chunk to disk
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkPath = path.join(chunkDir, `chunk_${String(chunkIndex).padStart(6, '0')}`);
    await fs.writeFile(chunkPath, chunkBuffer);

    // Update session
    await db.collection('upload_sessions').updateOne(
      { id: uploadId },
      { 
        $addToSet: { received_chunks: chunkIndex },
        $set: { updated_at: new Date() }
      }
    );

    console.log(`[ChunkedUpload] Stored chunk ${chunkIndex + 1}/${session.total_chunks} for ${uploadId} (${chunkBuffer.length} bytes)`);

    return ok({ received: chunkIndex });
  } catch (error) {
    console.error('[ChunkedChunk] Error:', error);
    return err(error.message || 'Failed to process chunk', 500);
  }
}

// Extract memories from imported messages using AI
async function extractMemoriesFromImport(db, userId, messages, source) {
  if (!messages || messages.length === 0) return 0;

  // Sample messages for memory extraction (take up to 50 representative messages)
  const userMessages = messages
    .filter(m => m.role === 'user' || m.role === 'human')
    .slice(0, 50);

  if (userMessages.length === 0) return 0;

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    console.log('[MemoryExtract] No OpenAI key, skipping memory extraction');
    return 0;
  }

  try {
    // Prepare messages for analysis
    const messagesText = userMessages
      .map(m => m.content)
      .filter(c => c && c.length > 20) // Only meaningful messages
      .join('\n---\n');

    if (messagesText.length < 100) return 0;

    // Use AI to extract important facts/memories
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are extracting important personal facts and memories from a user's conversation history.
Extract facts that would be useful for a personal AI assistant to remember, such as:
- Personal details (name, location, family, relationships)
- Preferences and favorites (food, music, hobbies)
- Work/career information
- Health information
- Important life events
- Goals and aspirations
- Recurring topics they care about

Return a JSON array of memory objects with this format:
[{"content": "The fact or memory", "category": "personal|preference|work|health|event|goal|interest", "importance": "high|medium|low"}]

Only extract factual information, not opinions or temporary states. Maximum 15 memories.`
          },
          {
            role: 'user',
            content: `Extract important personal memories from these ${source} messages:\n\n${messagesText.substring(0, 15000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.log('[MemoryExtract] OpenAI API error:', response.status);
      return 0;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Parse the JSON response
    let memories = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        memories = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.log('[MemoryExtract] Failed to parse memories:', parseError);
      return 0;
    }

    if (!Array.isArray(memories) || memories.length === 0) return 0;

    // Save memories to database
    const memoryDocs = memories
      .filter(m => m.content && m.content.length > 5)
      .map(m => ({
        id: uuidv4(),
        user_id: userId,
        content: m.content,
        category: m.category || 'general',
        importance: m.importance || 'medium',
        source: `${source}_import`,
        pinned: m.importance === 'high',
        created_at: new Date(),
      }));

    if (memoryDocs.length > 0) {
      // Check for duplicates
      const existingMemories = await db.collection('memories')
        .find({ user_id: userId })
        .toArray();
      
      const existingContents = new Set(existingMemories.map(m => m.content.toLowerCase().trim()));
      const newMemories = memoryDocs.filter(m => !existingContents.has(m.content.toLowerCase().trim()));

      if (newMemories.length > 0) {
        await db.collection('memories').insertMany(newMemories);
        console.log(`[MemoryExtract] Added ${newMemories.length} memories from ${source} import`);
        return newMemories.length;
      }
    }

    return 0;
  } catch (error) {
    console.error('[MemoryExtract] Error:', error);
    return 0;
  }
}

// Chunked upload - Process batch of files
async function handleChunkedProcessBatch(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { uploads, type = 'chatgpt' } = body;

  if (!uploads || !Array.isArray(uploads) || uploads.length === 0) {
    return err('No uploads provided');
  }

  const db = await getDb();
  const importId = uuidv4();

  // Create import job
  await db.collection('import_jobs').insertOne({
    id: importId,
    user_id: user.id,
    type,
    source: 'chunked_batch',
    upload_ids: uploads.map(u => u.uploadId),
    total_files: uploads.length,
    processed_files: 0,
    status: 'pending',
    progress: 0,
    message: `Processing ${uploads.length} file(s)...`,
    messages_count: 0,
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Process in background
  processChunkedBatch(importId, user.id, uploads, type).catch(err => {
    console.error('Chunked batch processing error:', err);
    db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status: 'failed', error: err.message, updated_at: new Date() } }
    );
  });

  return ok({ importId, status: 'pending' });
}

// Process chunked uploads batch - using disk-based streaming
async function processChunkedBatch(importId, userId, uploads, importType) {
  const db = await getDb();
  const fs = require('fs').promises;
  const fsSync = require('fs');
  const path = require('path');
  
  const updateStatus = async (status, message, progress = 0, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    let totalMessages = [];
    const totalFiles = uploads.length;

    for (let i = 0; i < uploads.length; i++) {
      const upload = uploads[i];
      const fileNum = i + 1;

      await updateStatus('processing', `Reassembling file ${fileNum}/${totalFiles}: ${upload.fileName}...`, Math.round((i / totalFiles) * 30));

      try {
        const chunkDir = path.join('/tmp', 'uploads', upload.uploadId);
        const outputPath = path.join('/tmp', 'uploads', `${upload.uploadId}.zip`);
        
        // Check if chunk directory exists
        try {
          await fs.access(chunkDir);
        } catch {
          console.error(`[ChunkedBatch] Chunk directory not found: ${chunkDir}`);
          continue;
        }

        // Get all chunk files sorted by name
        const chunkFiles = (await fs.readdir(chunkDir))
          .filter(f => f.startsWith('chunk_'))
          .sort();

        if (chunkFiles.length === 0) {
          console.error(`[ChunkedBatch] No chunks found for upload ${upload.uploadId}`);
          continue;
        }

        console.log(`[ChunkedBatch] Found ${chunkFiles.length} chunks for ${upload.fileName}`);

        // Stream chunks to output file (avoids loading all into memory)
        const writeStream = fsSync.createWriteStream(outputPath);
        
        for (const chunkFile of chunkFiles) {
          const chunkPath = path.join(chunkDir, chunkFile);
          const chunkData = await fs.readFile(chunkPath);
          writeStream.write(chunkData);
        }
        
        await new Promise((resolve, reject) => {
          writeStream.end();
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        // Get file size
        const stats = await fs.stat(outputPath);
        console.log(`[ChunkedBatch] Reassembled file ${fileNum}: ${upload.fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        await updateStatus('processing', `Extracting messages from file ${fileNum}/${totalFiles}...`, Math.round((i / totalFiles) * 30) + 30);

        // Extract messages using streaming approach for large files
        let messages = [];
        if (importType === 'chatgpt') {
          messages = await extractChatGPTMessagesFromFile(outputPath);
        } else if (importType === 'facebook') {
          messages = await extractFacebookMessagesFromFile(outputPath);
        }

        console.log(`[ChunkedBatch] Extracted ${messages.length} messages from file ${fileNum}`);
        totalMessages = totalMessages.concat(messages);

        // Clean up
        await fs.rm(chunkDir, { recursive: true, force: true });
        await fs.unlink(outputPath).catch(() => {});
        await db.collection('upload_sessions').deleteOne({ id: upload.uploadId });

      } catch (fileError) {
        console.error(`Error processing file ${fileNum}:`, fileError);
      }
    }

    await updateStatus('processing', 'Saving messages...', 80);

    // Deduplicate and save all messages
    if (totalMessages.length > 0) {
      const existingHashes = new Set();
      const existingMsgs = await db.collection('imported_messages')
        .find({ user_id: userId })
        .project({ content_hash: 1 })
        .toArray();
      existingMsgs.forEach(m => existingHashes.add(m.content_hash));

      const crypto = require('crypto');
      const newMessages = totalMessages.filter(m => {
        const hash = crypto.createHash('md5').update(m.content || '').digest('hex');
        m.content_hash = hash;
        return !existingHashes.has(hash);
      });

      if (newMessages.length > 0) {
        const docs = newMessages.map(m => ({
          id: uuidv4(),
          user_id: userId,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp,
          source: importType,
          content_hash: m.content_hash,
          imported_at: new Date(),
        }));

        // Insert in batches
        const batchSize = 1000;
        for (let j = 0; j < docs.length; j += batchSize) {
          const batch = docs.slice(j, j + batchSize);
          await db.collection('imported_messages').insertMany(batch);
        }
      }

      // Extract and save memories from the imported messages
      const memoriesAdded = await extractMemoriesFromImport(db, userId, newMessages, importType);

      await updateStatus('completed', `Successfully imported ${newMessages.length} new messages from ${totalFiles} file(s) (${totalMessages.length - newMessages.length} duplicates skipped)`, 100, {
        messages_count: newMessages.length,
        total_extracted: totalMessages.length,
        files_processed: totalFiles,
        memories_added: memoriesAdded
      });
    } else {
      await updateStatus('completed', `No messages found in ${totalFiles} file(s)`, 100, { messages_count: 0 });
    }

  } catch (error) {
    console.error('[ChunkedBatch] Processing error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

// Extract ChatGPT messages from ZIP file on disk (streaming, memory-efficient)
async function extractChatGPTMessagesFromFile(filePath) {
  const messages = [];
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    for (const entry of zipEntries) {
      if (entry.entryName === 'conversations.json' || entry.entryName.endsWith('/conversations.json')) {
        const content = entry.getData().toString('utf8');
        const conversations = JSON.parse(content);
        
        for (const conv of conversations) {
          if (conv.mapping) {
            for (const node of Object.values(conv.mapping)) {
              if (node?.message?.content?.parts?.[0]) {
                const role = node.message.author?.role === 'user' ? 'user' : 'assistant';
                messages.push({
                  content: node.message.content.parts[0],
                  role,
                  timestamp: node.message.create_time ? new Date(node.message.create_time * 1000) : new Date(),
                });
              }
            }
          }
        }
        break;
      }
    }
  } catch (e) {
    console.error('[extractChatGPTMessagesFromFile] Error:', e);
  }
  return messages;
}

// Extract Facebook messages from ZIP file on disk (streaming, memory-efficient)
async function extractFacebookMessagesFromFile(filePath) {
  const messages = [];
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    for (const entry of zipEntries) {
      if (entry.entryName.includes('messages/') && entry.entryName.endsWith('.json')) {
        try {
          const content = entry.getData().toString('utf8');
          const data = JSON.parse(content);
          
          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (msg.content) {
                messages.push({
                  content: msg.content,
                  role: 'user',
                  timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms) : new Date(),
                });
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON files
        }
      }
    }
  } catch (e) {
    console.error('[extractFacebookMessagesFromFile] Error:', e);
  }
  return messages;
}

// Handle direct file upload -> process directly (no external service)
async function handleDirectUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type') || 'chatgpt';

    if (!file) return err('No file provided');

    const fileName = file.name || 'upload.zip';
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    console.log(`[DirectUpload] Processing ${fileName} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB) directly`);

    const db = await getDb();
    const importId = uuidv4();

    // Create import job
    await db.collection('import_jobs').insertOne({
      id: importId,
      user_id: user.id,
      type,
      source: 'direct_upload',
      provider: 'direct',
      status: 'processing',
      progress: 10,
      message: 'Processing file...',
      messages_count: 0,
      error: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Process the file directly in memory
    processDirectUpload(importId, user.id, fileBuffer, type).catch(err => {
      console.error('Direct upload processing error:', err);
      db.collection('import_jobs').updateOne(
        { id: importId },
        { $set: { status: 'failed', error: err.message, updated_at: new Date() } }
      );
    });

    return ok({ importId, status: 'processing' });
  } catch (error) {
    console.error('[DirectUpload] Error:', error);
    return err(error.message || 'Upload failed', 500);
  }
}

// Process file buffer directly
async function processDirectUpload(importId, userId, buffer, importType) {
  const db = await getDb();
  const updateStatus = async (status, message, progress = 0, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    await updateStatus('processing', 'Extracting messages...', 30);

    // Process the file based on type
    let messages = [];
    
    if (importType === 'chatgpt') {
      messages = await extractChatGPTMessagesFromBuffer(buffer);
    } else if (importType === 'facebook') {
      messages = await extractFacebookMessagesFromBuffer(buffer);
    }

    console.log(`[DirectUpload] Extracted ${messages.length} messages`);
    await updateStatus('processing', 'Saving messages...', 60);

    // Save messages to database
    if (messages.length > 0) {
      // Deduplicate
      const existingHashes = new Set();
      const existingMsgs = await db.collection('imported_messages')
        .find({ user_id: userId })
        .project({ content_hash: 1 })
        .toArray();
      existingMsgs.forEach(m => existingHashes.add(m.content_hash));

      const crypto = require('crypto');
      const newMessages = messages.filter(m => {
        const hash = crypto.createHash('md5').update(m.content || '').digest('hex');
        m.content_hash = hash;
        return !existingHashes.has(hash);
      });

      if (newMessages.length > 0) {
        const docs = newMessages.map(m => ({
          id: uuidv4(),
          user_id: userId,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp,
          source: importType,
          content_hash: m.content_hash,
          imported_at: new Date(),
        }));

        await db.collection('imported_messages').insertMany(docs);
      }

      await updateStatus('completed', `Successfully imported ${newMessages.length} new messages (${messages.length - newMessages.length} duplicates skipped)`, 100, { messages_count: newMessages.length });
    } else {
      await updateStatus('completed', 'No messages found in the file', 100, { messages_count: 0 });
    }

  } catch (error) {
    console.error('[DirectUpload] Processing error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

async function handleCloudImport(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { url, type = 'chatgpt', provider = 'direct' } = body;

  if (!url) return err('URL required');

  const db = await getDb();
  const importId = uuidv4();

  // Create import job
  await db.collection('import_jobs').insertOne({
    id: importId,
    user_id: user.id,
    type,
    source: 'cloud',
    provider,
    cloud_url: url,
    status: 'pending',
    progress: 0,
    message: 'Starting download...',
    messages_count: 0,
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Process in background
  processCloudImport(importId, user.id, url, type, provider).catch(err => {
    console.error('Cloud import error:', err);
    db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status: 'failed', error: err.message, updated_at: new Date() } }
    );
  });

  return ok({ importId, status: 'pending' });
}

// Handle batch cloud import (multiple files from GoFile)
async function handleCloudBatchImport(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { files, type = 'chatgpt', provider = 'gofile' } = body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return err('No files provided');
  }

  const db = await getDb();
  const importId = uuidv4();

  // Create import job
  await db.collection('import_jobs').insertOne({
    id: importId,
    user_id: user.id,
    type,
    source: 'cloud_batch',
    provider,
    files: files,
    total_files: files.length,
    processed_files: 0,
    status: 'pending',
    progress: 0,
    message: `Processing ${files.length} file(s)...`,
    messages_count: 0,
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Process in background
  processCloudBatchImport(importId, user.id, files, type, provider).catch(err => {
    console.error('Cloud batch import error:', err);
    db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status: 'failed', error: err.message, updated_at: new Date() } }
    );
  });

  return ok({ importId, status: 'pending' });
}

// Process multiple files from cloud storage
async function processCloudBatchImport(importId, userId, files, importType, provider) {
  const db = await getDb();
  const updateStatus = async (status, message, progress = 0, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    let totalMessages = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];
      const fileNum = i + 1;
      
      await updateStatus('processing', `Downloading file ${fileNum}/${totalFiles}: ${fileInfo.fileName}...`, Math.round((i / totalFiles) * 50));

      try {
        let downloadUrl;
        
        if (provider === 'gofile' && fileInfo.fileId) {
          // GoFile requires fetching the direct download link via API
          // Extract content code from download page URL (e.g., https://gofile.io/d/XXXXX)
          let contentCode = fileInfo.fileId;
          if (fileInfo.url) {
            const match = fileInfo.url.match(/\/d\/([a-zA-Z0-9]+)/);
            if (match) contentCode = match[1];
          }
          
          console.log(`[BatchImport] Fetching GoFile content info for: ${contentCode}`);
          
          // Get the direct download link from GoFile API
          const contentRes = await fetch(`https://api.gofile.io/contents/${contentCode}?wt=4fd6sg89d7s6`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            }
          });
          
          if (!contentRes.ok) {
            console.error(`[BatchImport] Failed to get GoFile content info: ${contentRes.status}`);
            // Try alternative: use the server from upload response
            const server = fileInfo.server || 'store1';
            downloadUrl = `https://${server}.gofile.io/download/web/${fileInfo.fileId}/${encodeURIComponent(fileInfo.fileName)}`;
          } else {
            const contentData = await contentRes.json();
            console.log(`[BatchImport] GoFile content response:`, JSON.stringify(contentData).substring(0, 500));
            
            if (contentData.status === 'ok' && contentData.data) {
              // Find the file in the children
              const children = contentData.data.children || contentData.data.contents?.children;
              if (children) {
                const fileData = Object.values(children).find(f => 
                  f.id === fileInfo.fileId || f.name === fileInfo.fileName
                ) || Object.values(children)[0];
                
                if (fileData) {
                  downloadUrl = fileData.link || fileData.directLink;
                  console.log(`[BatchImport] Found direct link: ${downloadUrl}`);
                }
              }
            }
            
            // Fallback if we couldn't extract the link
            if (!downloadUrl) {
              const server = fileInfo.server || 'store1';
              downloadUrl = `https://${server}.gofile.io/download/web/${fileInfo.fileId}/${encodeURIComponent(fileInfo.fileName)}`;
            }
          }
        } else {
          downloadUrl = fileInfo.url;
        }

        console.log(`[BatchImport] Downloading file ${fileNum}/${totalFiles} from: ${downloadUrl}`);

        // Download the file with proper headers
        const response = await fetch(downloadUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://gofile.io/',
          },
          redirect: 'follow',
        });

        if (!response.ok) {
          console.error(`Failed to download file ${fileNum}: ${response.status}`);
          continue; // Skip this file but continue with others
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Check if we got HTML instead of a ZIP file
        const firstBytes = buffer.slice(0, 20).toString();
        if (firstBytes.includes('<!DOCTYPE') || firstBytes.includes('<html')) {
          console.error(`[BatchImport] Got HTML instead of file for ${fileInfo.fileName}. GoFile may require authentication.`);
          continue;
        }
        
        console.log(`[BatchImport] Downloaded file ${fileNum}, size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        await updateStatus('processing', `Extracting messages from file ${fileNum}/${totalFiles}...`, Math.round((i / totalFiles) * 50) + 25);

        // Extract messages
        let messages = [];
        if (importType === 'chatgpt') {
          messages = await extractChatGPTMessagesFromBuffer(buffer);
        } else if (importType === 'facebook') {
          messages = await extractFacebookMessagesFromBuffer(buffer);
        }

        console.log(`[BatchImport] Extracted ${messages.length} messages from file ${fileNum}`);
        totalMessages = totalMessages.concat(messages);

      } catch (fileError) {
        console.error(`Error processing file ${fileNum}:`, fileError);
        // Continue with other files
      }
    }

    await updateStatus('processing', 'Saving messages...', 80);

    // Deduplicate and save all messages
    if (totalMessages.length > 0) {
      const existingHashes = new Set();
      const existingMsgs = await db.collection('imported_messages')
        .find({ user_id: userId })
        .project({ content_hash: 1 })
        .toArray();
      existingMsgs.forEach(m => existingHashes.add(m.content_hash));

      const crypto = require('crypto');
      const newMessages = totalMessages.filter(m => {
        const hash = crypto.createHash('md5').update(m.content || '').digest('hex');
        m.content_hash = hash;
        return !existingHashes.has(hash);
      });

      if (newMessages.length > 0) {
        const docs = newMessages.map(m => ({
          id: uuidv4(),
          user_id: userId,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp,
          source: importType,
          content_hash: m.content_hash,
          imported_at: new Date(),
        }));

        // Insert in batches to avoid memory issues
        const batchSize = 1000;
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = docs.slice(i, i + batchSize);
          await db.collection('imported_messages').insertMany(batch);
        }
      }

      await updateStatus('completed', `Successfully imported ${newMessages.length} new messages from ${totalFiles} file(s) (${totalMessages.length - newMessages.length} duplicates skipped)`, 100, { 
        messages_count: newMessages.length,
        total_extracted: totalMessages.length,
        files_processed: totalFiles
      });
    } else {
      await updateStatus('completed', `No messages found in ${totalFiles} file(s)`, 100, { messages_count: 0 });
    }

  } catch (error) {
    console.error('[BatchImport] Processing error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

async function processCloudImport(importId, userId, cloudUrl, importType, provider) {
  const db = await getDb();
  const updateStatus = async (status, message, progress = 0, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    // Convert cloud URLs to direct download URLs
    let downloadUrl = cloudUrl;
    let fileId = null;
    
    // Handle WeTransfer URLs
    if (provider === 'wetransfer' || cloudUrl.includes('we.tl') || cloudUrl.includes('wetransfer.com')) {
      console.log(`[CloudImport] Processing WeTransfer URL: ${cloudUrl}`);
      
      try {
        // First, resolve we.tl short URL to full URL
        let fullUrl = cloudUrl;
        if (cloudUrl.includes('we.tl')) {
          const redirectRes = await fetch(cloudUrl, { 
            method: 'HEAD',
            redirect: 'manual' 
          });
          fullUrl = redirectRes.headers.get('location') || cloudUrl;
          console.log(`[CloudImport] WeTransfer resolved to: ${fullUrl}`);
        }
        
        // Extract transfer ID and security hash from URL
        // Format: https://wetransfer.com/downloads/TRANSFER_ID/SECURITY_HASH
        const wtMatch = fullUrl.match(/wetransfer\.com\/downloads\/([^\/]+)\/([^\/\?]+)/);
        
        if (wtMatch) {
          const transferId = wtMatch[1];
          const securityHash = wtMatch[2];
          
          // Get download link from WeTransfer API
          const apiUrl = `https://wetransfer.com/api/v4/transfers/${transferId}/download`;
          const apiRes = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ security_hash: securityHash, intent: 'entire_transfer' }),
          });
          
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.direct_link) {
              downloadUrl = apiData.direct_link;
              console.log(`[CloudImport] Got WeTransfer direct link`);
            }
          }
        }
        
        if (downloadUrl === cloudUrl) {
          throw new Error('Could not extract download link from WeTransfer. Please make sure the link is valid and has not expired.');
        }
      } catch (wtError) {
        console.error(`[CloudImport] WeTransfer error:`, wtError);
        throw new Error('Failed to process WeTransfer link. Please make sure the link is valid and has not expired (links expire after 7 days).');
      }
    } else if (provider === 'gofile' || cloudUrl.includes('gofile.io')) {
      // GoFile requires premium account for API access - show helpful error
      console.log(`[CloudImport] GoFile URL detected - requires premium API`);
      throw new Error('GoFile requires a premium account for direct downloads. Please use WeTransfer instead (free, no account needed).');
    } else if (provider === 'google' || cloudUrl.includes('drive.google.com')) {
      // Extract file ID from Google Drive URL
      const match = cloudUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        fileId = match[1];
        // For large files, we need to use a special approach
        // First try the direct download URL
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    } else if (provider === 'dropbox' || cloudUrl.includes('dropbox.com')) {
      // Convert Dropbox share link to direct download
      downloadUrl = cloudUrl.replace('?dl=0', '?dl=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    } else if (provider === 'onedrive' || cloudUrl.includes('1drv.ms') || cloudUrl.includes('onedrive.live.com')) {
      // OneDrive: need to convert share link
      downloadUrl = cloudUrl.replace('redir?', 'download?');
    }

    await updateStatus('processing', 'Downloading file...', 10);

    // Download the file
    console.log(`[CloudImport] Downloading from: ${downloadUrl}`);
    let response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}. Make sure the file is publicly accessible.`);
    }

    // For Google Drive large files, check if we got an HTML page (virus scan warning)
    let buffer;
    const contentType = response.headers.get('content-type') || '';
    
    if (fileId && contentType.includes('text/html')) {
      console.log('[CloudImport] Got HTML response, trying to extract confirmation token...');
      const html = await response.text();
      
      // Look for download confirmation URL in the HTML
      // Google Drive returns a page with a "Download anyway" link for large files
      const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
      const atMatch = html.match(/at=([a-zA-Z0-9_-]+)/);
      const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);
      
      // Extract any cookies from the initial response
      const setCookieHeader = response.headers.get('set-cookie') || '';
      
      if (confirmMatch || atMatch) {
        // Try with confirmation token
        const confirmToken = confirmMatch ? confirmMatch[1] : 't';
        const atToken = atMatch ? `&at=${atMatch[1]}` : '';
        const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${fileId}${atToken}`;
        console.log(`[CloudImport] Retrying with confirmation token: ${confirmUrl}`);
        
        response = await fetch(confirmUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': setCookieHeader.split(';')[0] || '',
          },
          redirect: 'follow',
        });
        
        if (!response.ok) {
          throw new Error('Failed to download file after confirmation. Make sure the file is publicly accessible.');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        
        // Check if we still got HTML after confirmation
        const firstCheck = buffer.slice(0, 100).toString();
        if (firstCheck.includes('<!DOCTYPE html') || firstCheck.includes('<html')) {
          // Final fallback - try with confirm=t&uuid
          const uuid = uuidMatch ? uuidMatch[1] : '';
          const finalUrl = `https://drive.google.com/uc?export=download&confirm=t&uuid=${uuid}&id=${fileId}`;
          console.log(`[CloudImport] Final attempt with uuid: ${finalUrl}`);
          
          response = await fetch(finalUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Cookie': setCookieHeader.split(';')[0] || '',
            },
            redirect: 'follow',
          });
          
          const arrayBuffer2 = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer2);
          
          const secondCheck = buffer.slice(0, 100).toString();
          if (secondCheck.includes('<!DOCTYPE html') || secondCheck.includes('<html')) {
            throw new Error('Google Drive is blocking direct download for this large file. Please use Dropbox instead: 1) Upload your ZIP to Dropbox, 2) Get shareable link, 3) Change ?dl=0 to ?dl=1 in the URL, 4) Paste here.');
          }
        }
      } else {
        // Try alternative approaches
        const exportUrl = `https://drive.google.com/uc?id=${fileId}&export=download&confirm=t`;
        console.log(`[CloudImport] Trying export URL: ${exportUrl}`);
        
        response = await fetch(exportUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
          },
          redirect: 'follow',
        });
        
        if (!response.ok) {
          throw new Error('Failed to download from Google Drive. For files over 100MB, please use Dropbox instead.');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        
        // Check if we still got HTML
        const firstBytes = buffer.slice(0, 100).toString();
        if (firstBytes.includes('<!DOCTYPE html') || firstBytes.includes('<html')) {
          throw new Error('Google Drive requires virus scan confirmation for this file. Please use Dropbox instead: 1) Upload to Dropbox, 2) Get shareable link (dl=1), 3) Paste here.');
        }
      }
    } else {
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const contentLength = buffer.length;
    console.log(`[CloudImport] Downloaded file size: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
    
    if (contentLength < 100) {
      throw new Error('Downloaded file is too small. Please ensure the file is publicly accessible and the link is correct.');
    }

    await updateStatus('processing', 'Processing file...', 30);
    await updateStatus('processing', 'Extracting messages...', 50);

    // Process the file based on type
    let messages = [];
    
    if (importType === 'chatgpt') {
      messages = await extractChatGPTMessagesFromBuffer(buffer);
    } else if (importType === 'facebook') {
      messages = await extractFacebookMessagesFromBuffer(buffer);
    }

    await updateStatus('processing', 'Saving messages...', 80);

    // Save messages to database
    if (messages.length > 0) {
      // Deduplicate
      const existingHashes = new Set();
      const existingMsgs = await db.collection('imported_messages')
        .find({ user_id: userId })
        .project({ content_hash: 1 })
        .toArray();
      existingMsgs.forEach(m => existingHashes.add(m.content_hash));

      const crypto = require('crypto');
      const newMessages = messages.filter(m => {
        const hash = crypto.createHash('md5').update(m.content || '').digest('hex');
        m.content_hash = hash;
        return !existingHashes.has(hash);
      });

      if (newMessages.length > 0) {
        const docs = newMessages.map(m => ({
          id: uuidv4(),
          user_id: userId,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp,
          source: importType,
          content_hash: m.content_hash,
          imported_at: new Date(),
        }));

        await db.collection('imported_messages').insertMany(docs);
      }

      await updateStatus('completed', `Successfully imported ${newMessages.length} new messages (${messages.length - newMessages.length} duplicates skipped)`, 100, { messages_count: newMessages.length });
    } else {
      await updateStatus('completed', 'No messages found in the file', 100, { messages_count: 0 });
    }

  } catch (error) {
    console.error('[CloudImport] Error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

// Helper to extract ChatGPT messages from ZIP buffer using adm-zip
async function extractChatGPTMessagesFromBuffer(buffer) {
  const messages = [];
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    for (const entry of zipEntries) {
      if (entry.entryName === 'conversations.json' || entry.entryName.endsWith('/conversations.json')) {
        const content = entry.getData().toString('utf8');
        const conversations = JSON.parse(content);
        
        for (const conv of conversations) {
          if (conv.mapping) {
            for (const node of Object.values(conv.mapping)) {
              if (node?.message?.content?.parts?.[0]) {
                const role = node.message.author?.role === 'user' ? 'user' : 'assistant';
                messages.push({
                  content: node.message.content.parts[0],
                  role,
                  timestamp: node.message.create_time ? new Date(node.message.create_time * 1000) : new Date(),
                });
              }
            }
          }
        }
        break;
      }
    }
  } catch (e) {
    console.error('[extractChatGPTMessagesFromBuffer] Error:', e);
  }
  return messages;
}

// Helper to extract Facebook messages from ZIP buffer using adm-zip
async function extractFacebookMessagesFromBuffer(buffer) {
  const messages = [];
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    for (const entry of zipEntries) {
      if (entry.entryName.includes('messages/') && entry.entryName.endsWith('.json')) {
        try {
          const content = entry.getData().toString('utf8');
          const data = JSON.parse(content);
          
          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (msg.content) {
                messages.push({
                  content: msg.content,
                  role: 'user',
                  timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms) : new Date(),
                });
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON files
        }
      }
    }
  } catch (e) {
    console.error('[extractFacebookMessagesFromBuffer] Error:', e);
  }
  return messages;
}

// Get import job status
async function handleImportStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const importId = url.searchParams.get('importId');
  if (!importId) return err('importId required');

  const db = await getDb();
  const job = await db.collection('import_jobs').findOne({ id: importId, user_id: user.id });
  
  if (!job) return err('Import not found', 404);

  // If completed, also fetch the analysis and profile data
  let analysis = null;
  let profileComparison = null;
  let memoriesAdded = 0;
  
  if (job.status === 'completed') {
    // Get the data import record with analysis
    const dataImport = await db.collection('data_imports').findOne({ 
      user_id: user.id,
      created_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
    }, { sort: { created_at: -1 } });
    
    if (dataImport?.analysis) {
      analysis = dataImport.analysis;
    }
    
    // Get current soul profile for comparison
    const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
    if (soulProfile) {
      profileComparison = {
        interests: soulProfile.interests || [],
        communicationStyle: soulProfile.insights?.communicationStyle || null,
        vocabulary: soulProfile.insights?.vocabulary || null,
        personalityTraits: soulProfile.insights?.personalityTraits || []
      };
    }
    
    // Count memories added from this import
    memoriesAdded = job.memories_added || 0;
  }

  return ok({
    status: job.status,
    message: job.message,
    progress: job.progress,
    messagesCount: job.messages_count,
    error: job.error,
    analysis,
    profileComparison,
    memoriesAdded
  });
}

// ============================================================
// TELEGRAM CONNECTOR
// ============================================================

async function handleTelegramWebhook(request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ status: 'not_configured', message: 'TELEGRAM_BOT_TOKEN not set' });
  }

  // Verify webhook secret — prevents anyone who guesses the URL from spoofing messages
  if (TELEGRAM_WEBHOOK_SECRET) {
    const incoming = request.headers.get('x-telegram-bot-api-secret-token');
    if (!incoming || incoming !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn('Telegram webhook: rejected request with invalid secret');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let update;
  try { update = await request.json(); } catch { return ok({ ok: true }); }

  const message = update?.message || update?.edited_message;
  if (!message?.text) return ok({ ok: true });

  const chatId = message.chat.id;
  const text = message.text.trim();
  const telegramUserId = message.from?.id?.toString();
  const fromName = message.from?.first_name || 'User';

  const db = await getDb();

  // Map telegram_user_id -> soulprint user
  let mapping = await db.collection('telegram_mappings').findOne({ telegram_user_id: telegramUserId });

  // ── /start command ──────────────────────────────────────────────────────────
  if (text === '/start') {
    const existingLinked = await db.collection('telegram_mappings').findOne({ telegram_user_id: telegramUserId, linked: true });
    if (existingLinked) {
      const currentModel = existingLinked.preferred_model || 'gpt-4o';
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `✅ Your Telegram is already linked to SoulPrint!\n\nCurrent AI model: *${currentModel}*\n\nJust send me a message to chat. Use /model to switch AI.`
      );
      return ok({ ok: true });
    }
    const linkCode = uuidv4().slice(0, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.collection('telegram_mappings').updateOne(
      { telegram_user_id: telegramUserId },
      { $set: { telegram_user_id: telegramUserId, telegram_chat_id: chatId.toString(), link_code: linkCode, linked: false, expires_at: expiresAt, created_at: new Date() } },
      { upsert: true }
    );
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `👋 Welcome to SoulPrint, ${fromName}!\n\nTo link your account:\n1️⃣ Go to: ${process.env.NEXT_PUBLIC_BASE_URL}/app\n2️⃣ Open Settings (⚙️) → Telegram tab\n3️⃣ Enter your link code:\n\n\`${linkCode}\`\n\n⏳ This code expires in 24 hours.\n\nOnce linked, I'll be your personal AI — right here in Telegram.`
    );
    return ok({ ok: true });
  }

  // ── /model command — list or switch AI model ────────────────────────────────
  if (text === '/model' || text.startsWith('/model ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const parts = text.split(' ');
    const currentModel = mapping.preferred_model || 'gpt-4o';

    if (parts.length === 1) {
      // Show current model and list options
      const modelList = [
        '🧠 *Dynamic Intelligence*: `smart` - Auto-selects best model for each query',
        '🟢 *OpenAI*: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`',
        '🟣 *Claude*: `claude-sonnet-4-5-20250929`, `claude-3-5-haiku-20241022`',
        '🔵 *Gemini*: `gemini-2.0-flash`, `gemini-2.5-pro`',
        '🌐 *Perplexity (online)*: `sonar`, `sonar-pro`',
        '🟡 *Kimi*: `kimi-k2-0711-preview`, `moonshot-v1-32k`',
      ].join('\n');
      const smartNote = currentModel === 'smart' ? ' _(Dynamic Intelligence auto-selects models)_' : '';
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `🤖 *Current AI model:* \`${currentModel}\`${smartNote}\n\nAvailable models:\n${modelList}\n\nTo switch: \`/model smart\` or \`/model gpt-4o\`\n\n💡 *Dynamic Intelligence* intelligently picks the best model for each query (coding → GPT-4o, search → Sonar, creative → Claude, etc.)`
      );
      return ok({ ok: true });
    }

    // Switch model
    const newModel = parts[1].trim().toLowerCase();
    
    // Handle Dynamic Intelligence selection
    if (newModel === 'smart') {
      await db.collection('telegram_mappings').updateOne(
        { telegram_user_id: telegramUserId },
        { $set: { preferred_model: 'smart', preferred_provider: 'smart' } }
      );
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `🧠 *Dynamic Intelligence activated!*\n\nI'll now automatically select the best AI model for each query:\n• 📰 News/search → Perplexity Sonar\n• 💻 Code → GPT-4o\n• ✍️ Creative → Claude\n• 🔢 Math → Gemini\n• 🔬 Analysis → Claude Opus\n\nYour messages will show which model was selected.`
      );
      return ok({ ok: true });
    }
    
    const { AVAILABLE_MODELS: models } = await import('@/lib/llm/providers');
    const found = models.find(m => m.value === newModel || m.label.toLowerCase().includes(newModel));
    if (!found) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `❌ Unknown model: \`${newModel}\`\n\nSend /model to see available options.`
      );
      return ok({ ok: true });
    }

    await db.collection('telegram_mappings').updateOne(
      { telegram_user_id: telegramUserId },
      { $set: { preferred_model: found.value, preferred_provider: found.provider } }
    );
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `✅ AI model switched to *${found.label}* (${found.group})\n\nAll future messages will use this model.`
    );
    return ok({ ok: true });
  }

  // ── /location command — share or update location ──────────────────────────────
  if (text === '/location' || text === '/loc') {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    
    // Check if user already has a location
    const existingLoc = await db.collection('user_locations').findOne({ user_id: userId });
    if (existingLoc && existingLoc.lat && existingLoc.lng) {
      await requestTelegramLocation(chatId, TELEGRAM_BOT_TOKEN,
        `📍 *Your current location:*\n${existingLoc.address || 'Saved location'}\n\n_Tap the button below to update your location._`
      );
    } else {
      await requestTelegramLocation(chatId, TELEGRAM_BOT_TOKEN,
        `📍 *Share your location*\n\nTap the button below to share your current location. This enables "near me" searches for restaurants, stores, and more!`
      );
    }
    return ok({ ok: true });
  }

  // ── /image command — generate image with Kie.ai GPT-4o Image ─────────────────
  if (text.startsWith('/image ') || text.startsWith('/img ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const prompt = text.replace(/^\/(image|img)\s+/, '').trim();
    if (!prompt) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '❌ Usage: /image [your prompt]\nExample: /image a futuristic city at sunset');
      return ok({ ok: true });
    }
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'upload_photo' }),
    });
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🎨 Generating your image with Kie.ai (GPT-4o Image)...\n_This may take 30-60 seconds_');
    try {
      const imageUrl = await generateImageWithKie(prompt, '1:1');
      await sendTelegramPhoto(chatId, TELEGRAM_BOT_TOKEN, imageUrl,
        `🎨 *Generated Image*\n\n_Prompt: ${prompt.substring(0, 200)}_`
      );
    } catch (e) {
      console.error('Telegram image generation error:', e);
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Image generation failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /video command — generate video with Kie.ai Kling 3.0 ───────────────────────
  if (text.startsWith('/video ') || text.startsWith('/vid ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const prompt = text.replace(/^\/(video|vid)\s+/, '').trim();
    if (!prompt) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '❌ Usage: /video [your prompt]\nExample: /video waves crashing on a beach at golden hour');
      return ok({ ok: true });
    }
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `🎬 *Starting video generation with Kling 3.0...*\n\n_"${prompt.substring(0, 150)}"_\n\nThis takes 1-3 minutes. I'll send the video when it's ready!`
    );
    try {
      const kieKey = process.env.KIE_API_KEY;
      // Use Kling 3.0 via the unified Jobs API
      const vidRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
        body: JSON.stringify({ 
          model: 'kling-3.0/video',
          input: {
            prompt, 
            duration: '5',
            aspect_ratio: '16:9',
            mode: 'std',
            sound: false,
            multi_shots: false,
            multi_prompt: [],
            kling_elements: [],
          }
        }),
      });
      const vidData = await vidRes.json();
      console.log('Telegram /video Kie.ai response:', JSON.stringify(vidData).substring(0, 500));
      if (vidData.code !== 200) throw new Error(vidData.msg || vidData.error || 'Video generation failed');
      const taskId = vidData.data?.taskId;

      // Poll for completion (up to 5 minutes) using the Jobs API status endpoint
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 10000)); // wait 10s
        attempts++;
        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${kieKey}` },
        });
        const pollData = await pollRes.json();
        const state = pollData.data?.status?.toLowerCase();
        const output = pollData.data?.output || {};
        const videoUrl = output.video_url || output.videoUrl;
        const thumbnailUrl = output.cover_url || output.imageUrl;

        if (state === 'success' && videoUrl) {
          // Send the actual video file to Telegram (not just a link)
          await sendTelegramVideo(chatId, TELEGRAM_BOT_TOKEN, videoUrl,
            `🎬 *Your video is ready!*\n\n_"${prompt.substring(0, 200)}"_`
          );
          break;
        } else if (state === 'failed' || state === 'fail') {
          const errMsg = pollData.data?.error || 'Unknown error';
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Video generation failed: ${errMsg}`);
          break;
        }
        // Still generating — send progress update every ~60 seconds
        if (attempts % 6 === 0) {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `⏳ Still generating your video... (${Math.round(attempts * 10 / 60)} min elapsed)`);
        }
      }
      if (attempts >= maxAttempts) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `⏱️ Video is taking longer than expected. Check back in a few minutes.`);
      }
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Video generation failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /read command — extract and summarize URL content ─────────────────────
  if (text.startsWith('/read ') || text.startsWith('/url ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    if (!urlMatch) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '❌ Usage: /read [URL]\nExample: /read https://example.com/article');
      return ok({ ok: true });
    }
    const url = urlMatch[0];
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🔗 Reading and summarizing page...');
    try {
      const extracted = await extractUrlContent(url);
      if (!extracted.success) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Could not read page: ${extracted.error}`);
        return ok({ ok: true });
      }
      
      // Get AI to summarize
      const { getProvider: gp } = await import('@/lib/llm/providers');
      const provider = gp(preferredProvider, preferredModel);
      const summaryPrompt = `Summarize the following webpage content concisely. Include key points and main takeaways:\n\n**Title:** ${extracted.title}\n**URL:** ${url}\n\n${extracted.content}`;
      
      let summary;
      try {
        const { stream } = await provider.generateStream({
          systemPrompt: 'You are a helpful assistant that summarizes web content clearly and concisely.',
          messages: [{ role: 'user', content: summaryPrompt }],
          model: preferredModel, temperature: 0.5,
        });
        summary = '';
        for await (const chunk of stream) { summary += chunk; }
      } catch {
        summary = await provider.generateChatCompletion({
          systemPrompt: 'You are a helpful assistant that summarizes web content.',
          messages: [{ role: 'user', content: summaryPrompt }],
          model: preferredModel, temperature: 0.5,
        });
      }
      
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `📄 *${extracted.title || 'Page Summary'}*\n\n${summary}\n\n🔗 [Open original](${url})`
      );
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Error: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /nearby and /find commands — location-based place search ────────────────
  if (text.startsWith('/nearby ') || text.startsWith('/find ') || text.startsWith('/places ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    
    const query = text.replace(/^\/(nearby|find|places)\s+/i, '').trim();
    if (!query) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `📍 *Location Search*\n\n` +
        `Usage:\n` +
        `/nearby [type] in [location]\n` +
        `/find [search] near [location]\n\n` +
        `Examples:\n` +
        `• /nearby restaurants in Austin, TX\n` +
        `• /find coffee shops near Times Square\n` +
        `• /nearby gas stations in 90210\n` +
        `• /find Italian food near me (share location first)\n\n` +
        `Types: restaurants, cafes, bars, hotels, gas stations, pharmacies, gyms, banks, parks, museums, etc.`
      );
      return ok({ ok: true });
    }
    
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🔍 Searching for places...');
    
    try {
      // Parse location from query
      let locationName = parseLocationQuery(query);
      let coords = null;
      
      // Check if user has shared location recently (stored in DB)
      if (!locationName || locationName.toLowerCase() === 'me') {
        const userLocation = await db.collection('user_locations').findOne({ user_id: userId });
        if (userLocation && userLocation.lat && userLocation.lng) {
          coords = { lat: userLocation.lat, lng: userLocation.lng };
          locationName = userLocation.address || 'your location';
        } else {
          // Store the pending search query so we can use it after location is shared
          await db.collection('user_locations').updateOne(
            { user_id: userId },
            { $set: { pending_search: query, pending_search_at: new Date() } },
            { upsert: true }
          );
          // Request location via Telegram keyboard button
          await requestTelegramLocation(chatId, TELEGRAM_BOT_TOKEN,
            `📍 *Share your location to find places near you!*\n\nTap the button below to share your current location, then I'll find ${query} nearby.`
          );
          return ok({ ok: true });
        }
      } else {
        // Geocode the location
        coords = await geocodeAddress(locationName);
        if (!coords) {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Could not find location: "${locationName}"`);
          return ok({ ok: true });
        }
        locationName = coords.formattedAddress || locationName;
      }
      
      // Extract place type from query
      const searchTerm = query.replace(/\s+(near|in|around|at)\s+.+$/i, '').trim();
      const placeType = extractPlaceType(searchTerm);
      
      // Search for places
      const places = await searchNearbyPlaces({
        lat: coords.lat,
        lng: coords.lng,
        query: placeType ? null : searchTerm, // Use text search if no specific type
        type: placeType,
        radius: 2000,
        maxResults: 6,
      });
      
      const response = formatPlacesForTelegram(places, locationName);
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, response);
      
    } catch (e) {
      console.error('Places search error:', e);
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Search failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── Handle shared location from Telegram ────────────────────────────────────
  const location = message?.location;
  if (location && location.latitude && location.longitude) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    
    try {
      // Get any pending search query
      const existingLocation = await db.collection('user_locations').findOne({ user_id: userId });
      const pendingSearch = existingLocation?.pending_search;
      
      // Store user's location
      await db.collection('user_locations').updateOne(
        { user_id: userId },
        { 
          $set: { 
            lat: location.latitude, 
            lng: location.longitude, 
            updated_at: new Date(),
          },
          $unset: { pending_search: '', pending_search_at: '' }
        },
        { upsert: true }
      );
      
      // Reverse geocode to get address
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&key=${apiKey}`);
      const geoData = await geoRes.json();
      const address = geoData.results?.[0]?.formatted_address || 'your location';
      
      await db.collection('user_locations').updateOne(
        { user_id: userId },
        { $set: { address } }
      );
      
      // Remove the location keyboard
      await removeTelegramKeyboard(chatId, TELEGRAM_BOT_TOKEN, `📍 Got it! Location: *${address}*`);
      
      // If there was a pending search, execute it now
      if (pendingSearch) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `🔍 Now searching for ${pendingSearch}...`);
        
        // Extract search term from pending query
        const searchTerm = pendingSearch.replace(/\s+(near|in|around|at)\s+.+$/i, '').trim();
        const placeType = extractPlaceType(searchTerm);
        
        const places = await searchNearbyPlaces({
          lat: location.latitude,
          lng: location.longitude,
          query: placeType ? null : searchTerm,
          type: placeType,
          radius: 2000,
          maxResults: 6,
        });
        
        const response = formatPlacesForTelegram(places, address);
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, response);
      } else {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `Now you can ask:\n` +
          `• "Find restaurants near me"\n` +
          `• "Where are coffee shops nearby?"\n` +
          `• /nearby gas stations`
        );
      }
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Error: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /post command — generate social media post ───────────────────────────────
  if (text.startsWith('/post ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const parts = text.slice(6).trim().split(' ');
    const platform = parts[0]?.toLowerCase();
    const topic = parts.slice(1).join(' ').trim();

    if (!platform || !topic) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `❌ Usage: /post [platform] [topic]\n\nExamples:\n/post twitter Bitcoin is hitting ATH today\n/post instagram My morning productivity routine\n/post linkedin Leadership lessons from remote work\n\nPlatforms: twitter, instagram, linkedin, tiktok, facebook, threads, youtube`
      );
      return ok({ ok: true });
    }

    if (!SOCIAL_PLATFORMS[platform]) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `❌ Unknown platform: "${platform}"\n\nSupported: ${Object.keys(SOCIAL_PLATFORMS).join(', ')}`
      );
      return ok({ ok: true });
    }

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `✍️ Generating ${SOCIAL_PLATFORMS[platform].name} post about *"${topic}"*...\n🌐 Searching for real-time data...`
    );

    try {
      // Get user context for personalized post
      const user = mapping ? await db.collection('users').findOne({ id: mapping.user_id }) : null;
      const profile = user ? await db.collection('profiles').findOne({ user_id: user.id }) : null;
      const userContext = profile ? `${profile.display_name || ''}, ${profile.descriptors?.join(', ') || ''}` : '';

      const { post, platform: platformName, maxChars } = await generateSocialPost({
        platform, topic, userContext,
        model: mapping.preferred_model || 'gpt-4o',
        includeSearch: true,
      });

      const charCount = post.length;
      const overLimit = charCount > maxChars;
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `📱 *${platformName} Post*\n${overLimit ? `⚠️ ${charCount}/${maxChars} chars — may need trimming\n` : `✅ ${charCount}/${maxChars} chars\n`}\n${post}`
      );
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Post generation failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /search command — force a web search ────────────────────────────────────
  if (text.startsWith('/search ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const query = text.slice(8).trim();
    const { buildSearchContext: doSearch } = await import('@/lib/llm/providers');
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
    const ctx = await doSearch(query);
    if (ctx) {
      const maxLen = 3800;
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `🔍 *Search results for: ${query}*\n\n${ctx.slice(0, maxLen)}${ctx.length > maxLen ? '...' : ''}`
      );
    } else {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ No results found for: ${query}`);
    }
    return ok({ ok: true });
  }

  // ── /help command ───────────────────────────────────────────────────────────
  if (text === '/help') {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `🤖 *SoulPrint Bot Commands*\n\n` +
      `*💬 Chat*\nJust send any message to chat with your AI!\n\n` +
      `*🎨 Image Generation*\n/image [prompt] — Generate with Kie.ai (GPT-4o Image)\nExample: /image neon city at night\n\n` +
      `*🎬 Video Generation*\n/video [prompt] — Generate with Kie.ai\nExample: /video ocean waves at sunset\n\n` +
      `*🔗 Web Reading*\n/read [URL] — Read and summarize any webpage\nOr just paste a URL in your message!\nExample: /read https://example.com/article\n\n` +
      `*📍 Location Search*\n/location — Share or update your location\n/nearby [type] in [location] — Find places\n/find [search] near [location]\nOr just ask: "restaurants near me"\n\n` +
      `*📱 Social Media Posts*\n/post [platform] [topic] — Write a platform-optimized post with real-time data\n` +
      `Platforms: twitter, instagram, linkedin, tiktok, facebook, threads, youtube\n` +
      `Example: /post twitter AI trends this week\n\n` +
      `*⏰ Scheduled Tasks*\n/schedule — Create or manage scheduled tasks\n/schedule list — View your schedules\n/schedule delete [id] — Remove a schedule\n\n` +
      `*🌐 Web Search*\n/search [query] — Force a real-time web search\nOr just ask about current events naturally!\n\n` +
      `*🤖 AI Models*\n/model — See & switch AI model\n/model sonar — Switch to Perplexity (online AI)\n\n` +
      `*🧬 About*\n/soulprint — Learn what a SoulPrint is\n\n` +
      `*Misc*\n/start — Link your account\n/help — This menu`
    );
    return ok({ ok: true });
  }

  // ── /soulprint command ─────────────────────────────────────────────────────
  if (text === '/soulprint') {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `🧬 *What Is A SoulPrint?*\n\n` +
      `A SoulPrint is your *persistent AI identity layer*.\n\n` +
      `❌ Not a chatbot\n❌ Not a prompt wrapper\n❌ Not a memory plugin\n\n` +
      `It's a mapped, structured imprint of how you *think*, *decide*, *react*, *prioritize*, *trust*, and *communicate* — embedded into an AI system so the interaction reflects _you_, not generic model behavior.\n\n` +
      `*It captures:*\n` +
      `• Decision style\n• Conflict response\n• Boundary thresholds\n• Communication cadence\n• Emotional weighting\n• Pattern recognition over time\n\n` +
      `🔄 Most AI resets every session.\n✨ *A SoulPrint doesn't.*\n\n` +
      `It builds continuity, reference, and resonance across conversations so the system responds with _your_ logic, _your_ tone, _your_ structure — consistently.\n\n` +
      `*In short:*\nA SoulPrint is the _operating system of you_ — running on AI.`
    );
    return ok({ ok: true });
  }

  // ── /schedule command — create and manage scheduled tasks ─────────────────
  if (text === '/schedule' || text.startsWith('/schedule ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const parts = text.split(' ');
    const subCommand = parts[1]?.toLowerCase();

    // /schedule list — show user's schedules
    if (subCommand === 'list') {
      const tasks = await db.collection('scheduled_tasks')
        .find({ user_id: mapping.user_id })
        .sort({ created_at: -1 })
        .toArray();
      
      if (tasks.length === 0) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `📋 *Your Schedules*\n\nNo scheduled tasks yet.\n\nUse /schedule to create one!`
        );
        return ok({ ok: true });
      }

      const taskList = tasks.map((t, i) => {
        const status = t.active ? '✅' : '⏸️';
        const timeStr = `${String(t.local_hour).padStart(2, '0')}:${String(t.minute || 0).padStart(2, '0')} ${t.timezone_label || 'UTC'}`;
        const typeEmoji = t.schedule_type === 'weekly' ? '📅' : t.schedule_type === 'weekdays' ? '💼' : '🔄';
        return `${status} *${i + 1}. ${t.name}*\n   ${typeEmoji} ${t.schedule_type} at ${timeStr}\n   ID: \`${t.id.slice(0, 8)}\``;
      }).join('\n\n');

      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `📋 *Your Schedules* (${tasks.length})\n\n${taskList}\n\n_Use /schedule delete [ID] to remove_`
      );
      return ok({ ok: true });
    }

    // /schedule delete [id] — delete a schedule
    if (subCommand === 'delete' && parts[2]) {
      const idPrefix = parts[2].toLowerCase();
      const task = await db.collection('scheduled_tasks').findOne({
        user_id: mapping.user_id,
        id: { $regex: `^${idPrefix}`, $options: 'i' }
      });
      
      if (!task) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ No schedule found with ID starting with "${idPrefix}"`);
        return ok({ ok: true });
      }

      await db.collection('scheduled_tasks').deleteOne({ id: task.id });
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `🗑️ Deleted schedule: *${task.name}*`);
      return ok({ ok: true });
    }

    // /schedule pause/resume [id]
    if ((subCommand === 'pause' || subCommand === 'resume') && parts[2]) {
      const idPrefix = parts[2].toLowerCase();
      const task = await db.collection('scheduled_tasks').findOne({
        user_id: mapping.user_id,
        id: { $regex: `^${idPrefix}`, $options: 'i' }
      });
      
      if (!task) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ No schedule found with ID starting with "${idPrefix}"`);
        return ok({ ok: true });
      }

      const newActive = subCommand === 'resume';
      const updates = { active: newActive };
      if (newActive) {
        updates.next_run_at = getNextRunAt(task.hour_utc, task.minute, task.schedule_type, task.day_of_week);
      }
      await db.collection('scheduled_tasks').updateOne({ id: task.id }, { $set: updates });
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `${newActive ? '▶️' : '⏸️'} Schedule *${task.name}* ${newActive ? 'resumed' : 'paused'}`
      );
      return ok({ ok: true });
    }

    // /schedule [template_id] — quick create from template
    const templateIds = SCHEDULE_TEMPLATES.map(t => t.id);
    if (templateIds.includes(subCommand)) {
      const template = SCHEDULE_TEMPLATES.find(t => t.id === subCommand);
      // Default to 8 AM in user's assumed timezone (UTC for now)
      const hourUTC = 8;
      const nextRun = getNextRunAt(hourUTC, 0, 'daily', null);
      
      const task = {
        id: uuidv4(),
        user_id: mapping.user_id,
        name: template.name,
        prompt: template.prompt,
        local_hour: 8,
        minute: 0,
        hour_utc: hourUTC,
        timezone_offset: 0,
        timezone_label: 'UTC',
        schedule_type: 'daily',
        day_of_week: null,
        active: true,
        delivery: 'telegram',
        last_run_at: null,
        next_run_at: nextRun,
        run_count: 0,
        created_at: new Date(),
      };
      await db.collection('scheduled_tasks').insertOne(task);
      
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `✅ *Schedule Created!*\n\n📋 *${template.name}*\n⏰ Daily at 08:00 UTC\n\nI'll send you this briefing every day!\n\n_Use /schedule list to see all schedules_`
      );
      return ok({ ok: true });
    }

    // /schedule (no args) — show menu with templates
    const templateList = SCHEDULE_TEMPLATES.filter(t => t.id !== 'custom').map(t =>
      `• \`/schedule ${t.id}\` — ${t.name}`
    ).join('\n');

    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `⏰ *Schedule a Recurring Task*\n\nQuick templates (daily at 8 AM UTC):\n${templateList}\n\n*Commands:*\n• /schedule list — View your schedules\n• /schedule delete [id] — Remove a schedule\n• /schedule pause [id] — Pause a schedule\n• /schedule resume [id] — Resume a schedule\n\n💡 _For custom schedules, use the web app Settings → Schedules tab._`
    );
    return ok({ ok: true });
  }

  if (!mapping?.linked || !mapping?.user_id) {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `⚠️ Your Telegram is not linked yet.\n\nSend /start to get your link code, then enter it in SoulPrint Settings → Telegram.`
    );
    return ok({ ok: true });
  }

  const userId = mapping.user_id;
  const user = await db.collection('users').findOne({ id: userId });
  if (!user || !user.accepted) {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Your SoulPrint account is not yet approved.');
    return ok({ ok: true });
  }

  // ── Best Practice: Rate Limiting for Telegram ─────────────────────────────
  if (checkChatRateLimit(userId, 60)) {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ You\'ve sent too many messages. Please wait a bit before sending more.');
    return ok({ ok: true });
  }

  // ── Best Practice: Input Sanitization ────────────────────────────────────
  const sanitizedText = sanitizeInput(text);

  // Send typing indicator
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });

  // Determine model for this user
  let preferredModel = mapping.preferred_model || 'gpt-4o';
  let preferredProvider = mapping.preferred_provider || 'openai';
  let smartModeInfo = null;

  // ── Dynamic Intelligence: Automatically select best model for the query ────────────
  if (preferredModel === 'smart') {
    smartModeInfo = await classifyQueryForSmartMode(sanitizedText);
    preferredModel = smartModeInfo.model;
    preferredProvider = smartModeInfo.provider;
    console.log(`[Telegram Dynamic Intelligence] Query classified -> Model: ${preferredModel}, Reason: ${smartModeInfo.reason}`);
  }

  // ── Auto-detect media & social post intents in plain messages ────────────
  const lowerText = sanitizedText.toLowerCase();

  // Auto-detect image generation intent
  const isImageRequest = /\b(generate|create|make|draw|show me|give me)\s+(an?\s+)?(image|picture|photo|illustration|painting|artwork)\b/i.test(sanitizedText)
    || /\b(dall-?e|stable diffusion)\b/i.test(sanitizedText);

  // Auto-detect video generation intent
  const isVideoRequest = /\b(generate|create|make|animate)\s+(a\s+)?(video|clip|animation|short film)\b/i.test(sanitizedText);

  // Auto-detect social media post intent
  const socialMatch = sanitizedText.match(/\b(write|create|generate|make|draft)\s+(me\s+)?(a\s+)?(tweet|twitter|instagram|linkedin|tiktok|facebook|threads|youtube)\s+(post|caption|content|about)\b/i)
    || sanitizedText.match(/\b(twitter|instagram|linkedin|tiktok|facebook|threads)\s+(post|caption|content)\s+(about|for|on)\b/i);

  // Auto-detect location/places search intent
  const isPlacesRequest = /\b(find|where|what|show me|looking for|recommend|suggest|any|are there|is there)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|hospitals?|gyms?|banks?|atms?|groceries?|stores?|malls?|parks?|museums?|movies?|theaters?|movie\s*theaters?|cinemas?|parking|airports?)\b/i.test(sanitizedText)
    || /\b(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|gyms?|banks?|parks?|stores?|movie\s*theaters?|theaters?|cinemas?)\s+(near|in|around|close to)\b/i.test(sanitizedText)
    || /\b(what('s| is)|where('s| is|are)|any).*(near me|nearby|around here|close by)\b/i.test(lowerText)
    || /\b(movie\s*theaters?|cinemas?|theaters?)\s*(near|around|close)/i.test(lowerText);

  if (isImageRequest || isVideoRequest || socialMatch || isPlacesRequest) {
    try {
      // Handle places/location request
      if (isPlacesRequest) {
        // Parse location from query
        let locationName = parseLocationQuery(sanitizedText);
        let coords = null;
        
        // Check if user has shared location
        if (!locationName || /near me|nearby|around here|close by/i.test(lowerText)) {
          const userLocation = await db.collection('user_locations').findOne({ user_id: userId });
          if (userLocation && userLocation.lat && userLocation.lng) {
            coords = { lat: userLocation.lat, lng: userLocation.lng };
            locationName = userLocation.address || 'your location';
            await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🔍 Searching for places...');
          } else {
            // Store pending search and request location
            const searchTerm = sanitizedText.replace(/\s+(near|in|around|at|close to)\s+.*/i, '')
              .replace(/^(find|where|what|show me|looking for|recommend|suggest)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?/i, '')
              .replace(/\?+$/, '')
              .trim();
            
            await db.collection('user_locations').updateOne(
              { user_id: userId },
              { $set: { pending_search: searchTerm || 'places', pending_search_at: new Date() } },
              { upsert: true }
            );
            
            await requestTelegramLocation(chatId, TELEGRAM_BOT_TOKEN,
              `📍 *Share your location to find ${searchTerm || 'places'} near you!*\n\nTap the button below to share your current location.`
            );
            return ok({ ok: true });
          }
        } else {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🔍 Searching for places...');
          coords = await geocodeAddress(locationName);
          if (!coords) {
            await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Could not find location: "${locationName}"`);
            return ok({ ok: true });
          }
          locationName = coords.formattedAddress || locationName;
        }
        
        // Extract what they're looking for
        const searchTerm = sanitizedText.replace(/\s+(near|in|around|at|close to)\s+.+$/i, '')
          .replace(/^(find|where|what|show me|looking for|recommend|suggest)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?/i, '')
          .replace(/\?+$/, '')
          .trim();
        const placeType = extractPlaceType(searchTerm);
        
        const places = await searchNearbyPlaces({
          lat: coords.lat,
          lng: coords.lng,
          query: placeType ? null : searchTerm,
          type: placeType,
          radius: 2000,
          maxResults: 5,
        });
        
        const response = formatPlacesForTelegram(places, locationName);
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, response);
        return ok({ ok: true });
      }

      if (isImageRequest) {
        const prompt = sanitizedText.replace(/\b(generate|create|make|draw|show me|give me)\s+(an?\s+)?(image|picture|photo|illustration|painting|artwork)\s+(of\s+)?/i, '').trim() || sanitizedText;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, action: 'upload_photo' }),
        });
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🎨 Generating your image with Kie.ai (GPT-4o Image)...\n_This may take 30-60 seconds_');
        try {
          const imageUrl = await generateImageWithKie(prompt, '1:1');
          await sendTelegramPhoto(chatId, TELEGRAM_BOT_TOKEN, imageUrl,
            `🎨 *Generated Image*\n_${prompt.substring(0, 200)}_`
          );
        } catch (imgErr) {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Image generation failed: ${imgErr.message}`);
        }
        return ok({ ok: true });

      } else if (isVideoRequest) {
        const prompt = sanitizedText.replace(/\b(generate|create|make|animate)\s+(a\s+)?(video|clip|animation)\s+(of\s+)?/i, '').trim() || sanitizedText;
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `🎬 *Starting video generation with Kling 3.0...*\n\nThis takes 1-3 minutes. I'll send it when ready!\n_"${prompt.substring(0, 150)}"_`
        );
        const kieKey = process.env.KIE_API_KEY;
        // Use Kling 3.0 via the unified Jobs API
        const vidRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify({ 
            model: 'kling-3.0/video',
            input: {
              prompt, 
              duration: '5',
              aspect_ratio: '16:9',
              mode: 'std',
              sound: false,
              multi_shots: false,
              multi_prompt: [],
              kling_elements: [],
            }
          }),
        });
        const vidData = await vidRes.json();
        console.log('Telegram video intent Kie.ai response:', JSON.stringify(vidData).substring(0, 500));
        if (vidData.code !== 200) throw new Error(vidData.msg || vidData.error || 'Video generation failed');
        const taskId = vidData.data?.taskId;
        // Poll for completion using the Jobs API status endpoint
        let attempts = 0;
        while (attempts < 30) {
          await new Promise(r => setTimeout(r, 10000));
          attempts++;
          const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${kieKey}` },
          });
          const pollData = await pollRes.json();
          const state = pollData.data?.status?.toLowerCase();
          const output = pollData.data?.output || {};
          const videoUrl = output.video_url || output.videoUrl;
          if (state === 'success' && videoUrl) {
            // Send the actual video file to Telegram
            await sendTelegramVideo(chatId, TELEGRAM_BOT_TOKEN, videoUrl,
              `🎬 *Your video is ready!*\n_"${prompt.substring(0, 150)}"_`
            );
            break;
          } else if (state === 'failed' || state === 'fail') {
            const errMsg = pollData.data?.error || 'Unknown error';
            await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Video generation failed: ${errMsg}`);
            break;
          }
          if (attempts % 6 === 0) await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `⏳ Still generating... (~${Math.round(attempts * 10 / 60)} min)`);
        }
        return ok({ ok: true });

      } else if (socialMatch) {
        // Detect platform from the message
        const platformMap = { tweet: 'twitter', twitter: 'twitter', instagram: 'instagram', linkedin: 'linkedin', tiktok: 'tiktok', facebook: 'facebook', threads: 'threads', youtube: 'youtube' };
        let detectedPlatform = 'twitter';
        for (const [key, val] of Object.entries(platformMap)) {
          if (lowerText.includes(key)) { detectedPlatform = val; break; }
        }
        // Extract topic
        const topic = sanitizedText.replace(/\b(write|create|generate|make|draft)\s+(me\s+)?a?\s*(tweet|twitter|instagram|linkedin|tiktok|facebook|threads|youtube)?\s*(post|caption|content)?\s*(about|for|on)?\s*/i, '').trim() || sanitizedText;
        const profile = await db.collection('profiles').findOne({ user_id: userId });
        const userContext = profile ? `${profile.display_name || ''}, ${profile.descriptors?.join(', ') || ''}` : '';

        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `✍️ Creating ${SOCIAL_PLATFORMS[detectedPlatform].name} post about *"${topic.substring(0, 100)}"*...\n🌐 Fetching real-time data...`
        );

        const { post, platform: platformName, maxChars } = await generateSocialPost({
          platform: detectedPlatform, topic, userContext, model: preferredModel, includeSearch: true,
        });
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `📱 *${platformName} Post* (${post.length}/${maxChars} chars)\n\n${post}`
        );
        return ok({ ok: true });
      }
    } catch (autoErr) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Generation failed: ${autoErr.message}`);
      return ok({ ok: true });
    }
  }

  try {
    // Get or create a Telegram conversation for this user
    let conv = await db.collection('conversations').findOne({ user_id: userId, source: 'telegram' });
    if (!conv) {
      const convId = uuidv4();
      conv = { id: convId, user_id: userId, title: 'Telegram Chat', source: 'telegram', created_at: new Date(), updated_at: new Date() };
      await db.collection('conversations').insertOne(conv);
    }

    // Save user message (store sanitized version for LLM, original for display)
    const userMsgId = uuidv4();
    await db.collection('messages').insertOne({
      id: userMsgId, conversation_id: conv.id, user_id: userId,
      role: 'user', content: text, created_at: new Date(), source: 'telegram',
    });

    // Get history (token-aware trimming — best practice)
    const recent = await db.collection('messages')
      .find({ conversation_id: conv.id, id: { $ne: userMsgId } })
      .sort({ created_at: -1 }).limit(30).toArray();
    recent.reverse();
    const rawHistory = recent.map(m => ({ role: m.role, content: m.content }));
    const trimmedHistory = trimHistory(rawHistory, 4000);
    let historyMessages = [...trimmedHistory, { role: 'user', content: sanitizedText }];

    // Use cached system prompt (best practice)
    const systemPrompt = await getSystemPrompt(db, userId);

    // ── URL Content Extraction ────────────────────────────────────────────────
    // Detect URLs in the message and extract their content
    const urls = extractUrls(text);
    let urlContext = '';
    if (urls.length > 0) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `🔗 Reading ${urls.length > 1 ? `${urls.length} links` : 'link'}...`);
      const urlContents = [];
      for (const url of urls.slice(0, 3)) { // Max 3 URLs
        const extracted = await extractUrlContent(url);
        if (extracted.success) {
          urlContents.push(`**[${extracted.title || url}](${url})**\n${extracted.description ? `_${extracted.description}_\n\n` : ''}${extracted.content}`);
        } else {
          urlContents.push(`**[${url}](${url})**\nCould not extract content: ${extracted.error}`);
        }
      }
      if (urlContents.length > 0) {
        urlContext = `\n\n---\n**WEBPAGE CONTENT FROM USER'S LINKS:**\n\n${urlContents.join('\n\n---\n\n')}\n---\n\n`;
      }
    }

    // ── Real-time web search ────────────────────────────────────────────────
    // Perplexity sonar models have built-in search — no need to inject
    const isPerplexity = preferredProvider === 'perplexity' || preferredModel.startsWith('sonar');
    let searchNote = '';
    if (!isPerplexity) {
      // For Telegram, always try web search for better real-time responses
      // Skip only for clearly personal/conversational queries
      const skipSearch = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|great|good|bye|goodbye|how are you)/i.test(text.trim());
      const needsSearch = !skipSearch && text.length > 10; // Search for anything substantive
      
      if (needsSearch) {
        try {
          const { buildSearchContext: doSearch } = await import('@/lib/llm/providers');
          const ctx = await doSearch(text);
          if (ctx) {
            searchNote = ' 🌐';
            historyMessages = [
              ...historyMessages.slice(0, -1),
              { role: 'user', content: `${ctx}\n\n---\n\nUser question: ${text}` },
            ];
          }
        } catch (searchErr) {
          console.log('Web search failed, continuing without:', searchErr.message);
        }
      }
    }

    // ── Inject URL content into the message ───────────────────────────────────
    if (urlContext) {
      historyMessages = [
        ...historyMessages.slice(0, -1),
        { role: 'user', content: `${urlContext}User message: ${historyMessages[historyMessages.length - 1].content}` },
      ];
    }

    // ── Sanitize message history for LLM providers ───────────────────────────
    // CRITICAL: Gemini requires first message to be 'user' and alternating roles
    // This prevents "First content should be with role 'user', got model" errors
    historyMessages = ensureAlternatingMessages(historyMessages);
    
    // Safety: ensure we always have at least one user message
    if (historyMessages.length === 0 || historyMessages[historyMessages.length - 1].role !== 'user') {
      historyMessages.push({ role: 'user', content: sanitizedText });
    }
    
    console.log(`[Telegram] Sending ${historyMessages.length} messages to ${preferredProvider}/${preferredModel}. First role: ${historyMessages[0]?.role}, Last role: ${historyMessages[historyMessages.length - 1]?.role}`);

    // ── Generate response ───────────────────────────────────────────────────
    const { getProvider: gp } = await import('@/lib/llm/providers');
    const provider = gp(preferredProvider, preferredModel);

    let aiResponse;
    let sources = [];
    try {
      // Use streaming and collect the full text (works with all providers)
      const { stream, searchMeta, didSearch } = await provider.generateStream({
        systemPrompt, messages: historyMessages, model: preferredModel,
        temperature: 0.7, enableWebSearch: true, // Enable web search for current events
      });
      
      // Extract sources from searchMeta
      if (didSearch && searchMeta && searchMeta.length > 0) {
        searchMeta.forEach(search => {
          if (search.results && Array.isArray(search.results)) {
            search.results.forEach(result => {
              if (result.url && !sources.find(s => s.url === result.url)) {
                sources.push({
                  title: result.title || 'Source',
                  url: result.url,
                });
              }
            });
          }
        });
      }
      
      let collected = '';
      for await (const chunk of stream) {
        // Handle both string and object chunks
        if (typeof chunk === 'string') {
          collected += chunk;
        } else if (chunk && chunk.delta) {
          collected += chunk.delta;
          // Extract Perplexity citations
          if (chunk.citations && chunk.citations.length > 0) {
            sources = chunk.citations;
          }
        }
        // Keep sending typing action for long responses
        if (collected.length % 1000 === 0) {
          fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
          }).catch(() => {});
        }
      }
      aiResponse = collected;
    } catch (streamErr) {
      // Fallback to non-streaming if generateStream fails
      aiResponse = await provider.generateChatCompletion({
        systemPrompt, messages: historyMessages, model: preferredModel, temperature: 0.7,
      });
    }

    // Save assistant message
    await db.collection('messages').insertOne({
      id: uuidv4(), conversation_id: conv.id, user_id: userId,
      role: 'assistant', content: aiResponse, created_at: new Date(), source: 'telegram',
      model_used: preferredModel, provider_used: preferredProvider,
      sources: sources.length > 0 ? sources : undefined,
    });
    await db.collection('conversations').updateOne({ id: conv.id }, { $set: { updated_at: new Date() } });

    // Build sources section for Telegram
    let sourcesText = '';
    if (sources.length > 0) {
      sourcesText = '\n\n📚 *Sources:*\n' + sources.slice(0, 4).map((s, i) => 
        `${i + 1}. [${s.title}](${s.url})`
      ).join('\n');
    }

    // Send reply (split if > 4096 chars) with model indicator
    const smartLabel = smartModeInfo ? ` 🧠 ${smartModeInfo.reason.substring(0, 50)}` : '';
    const modelLabel = `_[${preferredModel}${searchNote}${smartLabel}]_\n\n`;
    const fullReply = modelLabel + aiResponse + sourcesText;
    const chunks = fullReply.match(/[\s\S]{1,4000}/g) || [fullReply];
    for (const chunk of chunks) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, chunk);
    }
  } catch (e) {
    console.error('Telegram handler error:', e);
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Something went wrong. Please try again.');
  }

  return ok({ ok: true });
}

async function sendTelegramMessage(chatId, token, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

// Telegram setup — link a SoulPrint account to a Telegram chat
async function handleTelegramLink(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { link_code } = body;
  if (!link_code) return err('link_code required');

  const db = await getDb();

  // Find mapping by code
  const mapping = await db.collection('telegram_mappings').findOne({ link_code: link_code.toUpperCase() });
  if (!mapping) return err('Invalid link code. Send /start to the bot to get a new one.', 404);

  // Check expiry
  if (mapping.expires_at && new Date() > new Date(mapping.expires_at)) {
    return err('This link code has expired. Send /start to the bot to get a new one.', 410);
  }

  // Prevent one Telegram account from linking to multiple SoulPrint users
  const alreadyLinked = await db.collection('telegram_mappings').findOne({
    telegram_user_id: mapping.telegram_user_id,
    linked: true,
    user_id: { $exists: true },
  });
  if (alreadyLinked && alreadyLinked.user_id !== user.id) {
    return err('This Telegram account is already linked to a different SoulPrint account.', 409);
  }

  // Prevent one SoulPrint user from linking multiple Telegram accounts
  const userAlreadyLinked = await db.collection('telegram_mappings').findOne({
    user_id: user.id,
    linked: true,
  });
  if (userAlreadyLinked) {
    return err('Your account is already linked to a Telegram account.', 409);
  }

  await db.collection('telegram_mappings').updateOne(
    { link_code: link_code.toUpperCase() },
    { $set: { user_id: user.id, linked: true, linked_at: new Date(), expires_at: null } }
  );

  // Notify via Telegram
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (TELEGRAM_BOT_TOKEN && mapping.telegram_chat_id) {
    const profile = await db.collection('profiles').findOne({ user_id: user.id });
    const botName = profile?.assistant_name || 'SoulPrint';
    const displayName = profile?.display_name || 'there';
    await sendTelegramMessage(mapping.telegram_chat_id, TELEGRAM_BOT_TOKEN,
      `✅ Linked! Hey ${displayName}, ${botName} is ready.\n\nYour conversations here are private — only you can see them. Just send a message anytime.`
    );
  }

  return ok({ success: true, message: 'Telegram linked successfully! Check your bot for a confirmation.' });
}

// Telegram status + setup webhook
async function handleTelegramSetup(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) return ok({ configured: false, message: 'Add TELEGRAM_BOT_TOKEN to .env to enable Telegram.' });

  const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/connectors/telegram/webhook`;

  // Set the webhook with optional secret
  const payload = { url: webhookUrl, drop_pending_updates: true, allowed_updates: ['message', 'edited_message'] };
  if (TELEGRAM_WEBHOOK_SECRET) payload.secret_token = TELEGRAM_WEBHOOK_SECRET;

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  // Get bot info
  const infoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
  const info = await infoRes.json();

  // Count linked users
  const db = await getDb();
  const linkedCount = await db.collection('telegram_mappings').countDocuments({ linked: true });

  return ok({
    configured: true,
    webhook: data,
    bot: info.result,
    webhookUrl,
    secretProtected: !!TELEGRAM_WEBHOOK_SECRET,
    linkedUsers: linkedCount,
  });
}

async function handleTelegramStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const db = await getDb();
  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });

  return ok({
    configured: !!TELEGRAM_BOT_TOKEN,
    linked: !!mapping,
    telegram_user_id: mapping?.telegram_user_id || null,
    preferred_model: mapping?.preferred_model || 'gpt-4o',
    preferred_provider: mapping?.preferred_provider || 'openai',
  });
}

async function handleTelegramSetModel(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { model } = await request.json();
  if (!model) return err('model required');

  // Handle Dynamic Intelligence specially
  if (model === 'smart') {
    const db = await getDb();
    const result = await db.collection('telegram_mappings').updateOne(
      { user_id: user.id, linked: true },
      { $set: { preferred_model: 'smart', preferred_provider: 'smart' } }
    );
    if (result.matchedCount === 0) return err('No linked Telegram account found');
    return ok({ success: true, model: 'smart', label: '🧠 Dynamic Intelligence' });
  }

  const { AVAILABLE_MODELS } = await import('@/lib/llm/providers');
  const found = AVAILABLE_MODELS.find(m => m.value === model);
  if (!found) return err('Unknown model');

  const db = await getDb();
  const result = await db.collection('telegram_mappings').updateOne(
    { user_id: user.id, linked: true },
    { $set: { preferred_model: found.value, preferred_provider: found.provider } }
  );

  if (result.matchedCount === 0) return err('No linked Telegram account found');
  return ok({ success: true, model: found.value, label: found.label });
}

// CONNECTORS (stubs for others)
async function handleConnectorStub(platform) {
  return NextResponse.json({
    status: 'not_configured',
    message: `${platform} connector is not yet implemented. Telegram is available — configure TELEGRAM_BOT_TOKEN in .env.`,
  });
}

// ============================================================
// DATA IMPORT & ANALYSIS ENDPOINTS
// ============================================================

// Chunked upload: Initialize an upload session
async function handleChunkedUploadInit(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { filename, fileSize, source, totalChunks } = body;
  
  if (!filename || !fileSize || !totalChunks) {
    return err('filename, fileSize, and totalChunks required');
  }

  const db = await getDb();
  const uploadId = uuidv4();
  
  // Create upload session - chunks will be stored separately
  await db.collection('chunked_uploads').insertOne({
    id: uploadId,
    user_id: user.id,
    filename,
    file_size: fileSize,
    source: source || 'chatgpt',
    total_chunks: totalChunks,
    received_chunks: [],
    status: 'uploading',
    created_at: new Date(),
  });
  
  return ok({ uploadId, message: 'Upload session created' });
}

// Chunked upload: Receive a chunk and store it
async function handleChunkedUploadChunk(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const uploadId = formData.get('uploadId');
    const chunkIndex = parseInt(formData.get('chunkIndex'));
    const chunk = formData.get('chunk');
    
    if (!uploadId || chunkIndex === undefined || !chunk) {
      return err('uploadId, chunkIndex, and chunk required');
    }

    const db = await getDb();
    const upload = await db.collection('chunked_uploads').findOne({ id: uploadId, user_id: user.id });
    
    if (!upload) return err('Upload session not found', 404);
    if (upload.status !== 'uploading') return err('Upload already completed or failed');

    // Convert chunk to base64 and store as separate document
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkBase64 = chunkBuffer.toString('base64');
    
    // Store chunk as separate document to avoid 16MB limit
    await db.collection('upload_chunks').updateOne(
      { upload_id: uploadId, chunk_index: chunkIndex },
      { 
        $set: { 
          upload_id: uploadId,
          chunk_index: chunkIndex,
          data: chunkBase64,
          size: chunkBuffer.length,
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    
    // Update received chunks list
    await db.collection('chunked_uploads').updateOne(
      { id: uploadId },
      { $addToSet: { received_chunks: chunkIndex } }
    );
    
    return ok({ 
      received: chunkIndex, 
      message: `Chunk ${chunkIndex + 1} received` 
    });
  } catch (e) {
    console.error('Chunk upload error:', e);
    return err(`Chunk upload failed: ${e.message}`, 500);
  }
}

// Chunked upload: Complete - reassemble ZIP and extract messages properly
async function handleChunkedUploadComplete(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { uploadId } = body;
  
  if (!uploadId) return err('uploadId required');

  const db = await getDb();
  const upload = await db.collection('chunked_uploads').findOne({ id: uploadId, user_id: user.id });
  
  if (!upload) return err('Upload session not found', 404);
  if (upload.status !== 'uploading') return err('Upload already completed or failed');
  
  // Verify all chunks received
  if (upload.received_chunks.length !== upload.total_chunks) {
    return err(`Missing chunks: received ${upload.received_chunks.length} of ${upload.total_chunks}`);
  }

  const tempDir = `/tmp/upload_${uploadId}`;
  const tempZipPath = `${tempDir}/upload.zip`;

  try {
    // Update status
    await db.collection('chunked_uploads').updateOne(
      { id: uploadId },
      { $set: { status: 'processing' } }
    );

    // Create temp directory
    await mkdir(tempDir, { recursive: true });

    // Reassemble chunks into a ZIP file (process in batches to manage memory)
    console.log(`Reassembling ${upload.total_chunks} chunks into ZIP file...`);
    
    const writeStream = fs.createWriteStream(tempZipPath);
    const BATCH_SIZE = 50; // Process 50 chunks at a time
    
    for (let batchStart = 0; batchStart < upload.total_chunks; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, upload.total_chunks);
      
      // Fetch chunks for this batch
      const chunkDocs = await db.collection('upload_chunks')
        .find({ 
          upload_id: uploadId, 
          chunk_index: { $gte: batchStart, $lt: batchEnd } 
        })
        .sort({ chunk_index: 1 })
        .toArray();
      
      // Write chunks to file
      for (const doc of chunkDocs) {
        const buffer = Buffer.from(doc.data, 'base64');
        writeStream.write(buffer);
      }
      
      // Delete processed chunks to free memory
      await db.collection('upload_chunks').deleteMany({ 
        upload_id: uploadId, 
        chunk_index: { $gte: batchStart, $lt: batchEnd } 
      });
      
      console.log(`Processed chunks ${batchStart}-${batchEnd} of ${upload.total_chunks}`);
    }
    
    // Close the write stream and wait for it to finish
    await new Promise((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`ZIP file created at ${tempZipPath}`);

    // Extract messages from the ZIP file
    const messages = await extractMessagesFromZip(tempZipPath, upload.source);
    
    console.log(`Extracted ${messages.length} messages from ZIP`);

    // Check if we have enough data
    if (messages.length < 5) {
      // Clean up
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      await db.collection('chunked_uploads').deleteOne({ id: uploadId });
      return err('Could not extract enough messages from your export. The file may be empty, corrupted, or in an unsupported format. Please ensure you uploaded a ChatGPT or Facebook data export ZIP file.', 400);
    }

    // Prepare data for analysis
    const parsedData = { 
      source: upload.source || 'chatgpt', 
      sampleMessages: messages.slice(0, 200),
      userMessages: messages.slice(0, 200),
      conversationCount: Math.ceil(messages.length / 10),
      userMessageCount: messages.length,
    };

    // Create import record
    const importId = uuidv4();
    await db.collection('data_imports').insertOne({
      id: importId,
      user_id: user.id,
      filename: upload.filename,
      source: parsedData.source,
      status: 'analyzing',
      file_size: upload.file_size,
      parsed_stats: {
        source: parsedData.source,
        conversationCount: parsedData.conversationCount,
        messageCount: parsedData.userMessageCount,
      },
      created_at: new Date(),
    });

    // Analyze communication style
    const analysis = await analyzeCommmunicationStyle(parsedData);
    
    if (analysis.error) {
      await db.collection('data_imports').updateOne(
        { id: importId },
        { $set: { status: 'error', error: analysis.error } }
      );
      console.error('Analysis error:', analysis.error);
    } else {
      // Save analysis results
      await db.collection('data_imports').updateOne(
        { id: importId },
        { $set: { status: 'complete', analysis, completed_at: new Date() } }
      );

      // Update soul profile
      const existingProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
      const updatedInsights = mergeInsights(existingProfile?.insights || {}, analysis, parsedData.source);
      
      await db.collection('soul_profiles').updateOne(
        { user_id: user.id },
        { 
          $set: { insights: updatedInsights, updated_at: new Date() },
          $push: { import_history: { import_id: importId, source: parsedData.source, analyzed_at: new Date() } }
        },
        { upsert: true }
      );

      // Invalidate system prompt cache
      invalidateSystemPromptCache(user.id);
    }

    // Clean up temp files and database records
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await db.collection('chunked_uploads').deleteOne({ id: uploadId });

    return ok({
      success: true,
      importId,
      analysis: analysis.error ? { summary: 'Import completed but analysis had issues.' } : analysis,
      stats: {
        source: parsedData.source,
        messagesExtracted: messages.length,
        messagesAnalyzed: Math.min(messages.length, 200),
      }
    });

  } catch (e) {
    console.error('Upload complete error:', e);
    
    // Clean up on error
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await db.collection('upload_chunks').deleteMany({ upload_id: uploadId }).catch(() => {});
    await db.collection('chunked_uploads').updateOne(
      { id: uploadId },
      { $set: { status: 'error', error: e.message } }
    );
    
    return err(`Processing failed: ${e.message}`, 500);
  }
}

// Helper function to extract messages from ZIP file using yauzl (memory efficient)
async function extractMessagesFromZip(zipPath, source) {
  const messages = [];
  const MAX_FILES = 50; // Limit files to process
  const MAX_MESSAGES = 500; // Stop once we have enough messages
  
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('Failed to open ZIP:', err);
        return reject(new Error(`Failed to open ZIP: ${err.message}`));
      }
      
      let filesProcessed = 0;
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        const fileName = entry.fileName.toLowerCase();
        
        // Skip if we have enough data
        if (messages.length >= MAX_MESSAGES || filesProcessed >= MAX_FILES) {
          zipfile.close();
          return;
        }
        
        // Skip directories and non-JSON files
        if (/\/$/.test(entry.fileName) || !fileName.endsWith('.json')) {
          zipfile.readEntry();
          return;
        }
        
        // Skip obviously non-conversation files
        if (fileName.includes('model_comparisons') || 
            fileName.includes('shared_conversations') ||
            fileName.includes('user_info') ||
            fileName.includes('settings')) {
          zipfile.readEntry();
          return;
        }
        
        filesProcessed++;
        
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            console.log(`Error reading ${fileName}:`, err.message);
            zipfile.readEntry();
            return;
          }
          
          const chunks = [];
          let totalSize = 0;
          const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max per file
          
          readStream.on('data', (chunk) => {
            totalSize += chunk.length;
            if (totalSize <= MAX_FILE_SIZE) {
              chunks.push(chunk);
            }
          });
          
          readStream.on('end', () => {
            try {
              const content = Buffer.concat(chunks).toString('utf8');
              const data = JSON.parse(content);
              
              // Extract messages based on source type
              if (source === 'chatgpt' || fileName.includes('conversation')) {
                extractChatGPTMessages(data, messages);
              } else if (source === 'facebook' || fileName.includes('message') || fileName.includes('inbox')) {
                extractFacebookMessages(data, messages);
              } else {
                // Try both formats
                extractChatGPTMessages(data, messages);
                extractFacebookMessages(data, messages);
              }
              
              console.log(`Processed ${fileName}: now have ${messages.length} messages`);
            } catch (parseErr) {
              console.log(`Skipping ${fileName}: invalid JSON`);
            }
            
            zipfile.readEntry();
          });
          
          readStream.on('error', (err) => {
            console.log(`Stream error for ${fileName}:`, err.message);
            zipfile.readEntry();
          });
        });
      });
      
      zipfile.on('end', () => {
        console.log(`ZIP processing complete. Processed ${filesProcessed} files, extracted ${messages.length} messages`);
        
        // Remove duplicates and clean
        const uniqueMessages = [...new Set(messages)]
          .filter(m => m && m.length > 10 && m.length < 2000)
          .map(m => m.trim().substring(0, 500));
        
        resolve(uniqueMessages);
      });
      
      zipfile.on('error', (err) => {
        console.error('ZIP error:', err);
        reject(new Error(`ZIP processing error: ${err.message}`));
      });
    });
  });
}

// Extract messages from ChatGPT export format
function extractChatGPTMessages(data, messages) {
  // Handle array of conversations
  if (Array.isArray(data)) {
    for (const conv of data) {
      extractChatGPTMessages(conv, messages);
    }
    return;
  }
  
  // Handle single conversation object
  if (data.mapping) {
    // New ChatGPT export format with mapping
    for (const [, node] of Object.entries(data.mapping)) {
      if (node.message?.content?.parts) {
        for (const part of node.message.content.parts) {
          if (typeof part === 'string' && part.length > 10) {
            messages.push(part);
          }
        }
      }
      // Also check for text field
      if (node.message?.content?.text && typeof node.message.content.text === 'string') {
        messages.push(node.message.content.text);
      }
    }
  }
  
  // Handle older format with messages array
  if (data.messages && Array.isArray(data.messages)) {
    for (const msg of data.messages) {
      if (msg.content?.parts) {
        for (const part of msg.content.parts) {
          if (typeof part === 'string' && part.length > 10) {
            messages.push(part);
          }
        }
      }
      if (msg.text && typeof msg.text === 'string' && msg.text.length > 10) {
        messages.push(msg.text);
      }
    }
  }
  
  // Handle conversation_turns format
  if (data.conversation_turns && Array.isArray(data.conversation_turns)) {
    for (const turn of data.conversation_turns) {
      if (turn.content && typeof turn.content === 'string' && turn.content.length > 10) {
        messages.push(turn.content);
      }
    }
  }
}

// Extract messages from Facebook export format
function extractFacebookMessages(data, messages) {
  // Handle messages array
  if (data.messages && Array.isArray(data.messages)) {
    for (const msg of data.messages) {
      if (msg.content && typeof msg.content === 'string' && msg.content.length > 10) {
        messages.push(decodeUTF8(msg.content));
      }
    }
  }
  
  // Handle participants format
  if (data.participants && data.messages) {
    // This is likely a conversation export
    for (const msg of (data.messages || [])) {
      if (msg.content && typeof msg.content === 'string') {
        messages.push(decodeUTF8(msg.content));
      }
    }
  }
  
  // Handle nested structure
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.content && typeof item.content === 'string') {
        messages.push(decodeUTF8(item.content));
      }
      if (item.messages) {
        extractFacebookMessages(item, messages);
      }
    }
  }
}

// Decode Facebook's UTF-8 encoded strings
function decodeUTF8(str) {
  if (!str) return '';
  try {
    // Facebook encodes special characters as \u00XX sequences
    return str.replace(/\\u00([0-9a-fA-F]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  } catch {
    return str;
  }
}

// Handle data import (small files - direct upload, kept for backward compatibility)
async function handleDataImportUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const source = formData.get('source') || 'unknown'; // 'chatgpt' or 'facebook'
    
    if (!file) return err('No file provided');
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || 'upload.zip';
    
    // Validate it's a ZIP
    if (!filename.toLowerCase().endsWith('.zip')) {
      return err('Please upload a ZIP file');
    }
    
    const db = await getDb();
    const uploadId = uuidv4();
    
    // Create upload record
    await db.collection('data_imports').insertOne({
      id: uploadId,
      user_id: user.id,
      filename,
      source,
      status: 'processing',
      file_size: buffer.length,
      created_at: new Date(),
    });

    // Parse based on source
    let parsedData;
    if (source === 'chatgpt') {
      parsedData = await parseChatGPTExport(buffer);
    } else if (source === 'facebook') {
      parsedData = await parseFacebookExport(buffer);
    } else {
      // Try to auto-detect
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries().map(e => e.entryName.toLowerCase());
      
      if (entries.some(e => e.includes('conversations.json'))) {
        parsedData = await parseChatGPTExport(buffer);
      } else if (entries.some(e => e.includes('messages/') || e.includes('posts/'))) {
        parsedData = await parseFacebookExport(buffer);
      } else {
        await db.collection('data_imports').updateOne(
          { id: uploadId },
          { $set: { status: 'error', error: 'Could not detect data format' } }
        );
        return err('Could not detect data format. Please specify if this is ChatGPT or Facebook data.');
      }
    }

    // Update with parsed stats
    await db.collection('data_imports').updateOne(
      { id: uploadId },
      { $set: { 
        status: 'analyzing',
        parsed_stats: {
          source: parsedData.source,
          conversationCount: parsedData.conversationCount || 0,
          messageCount: parsedData.userMessageCount || parsedData.messageCount || 0,
          postCount: parsedData.postCount || 0,
        }
      } }
    );

    // Analyze communication style
    const analysis = await analyzeCommmunicationStyle(parsedData);
    
    if (analysis.error) {
      await db.collection('data_imports').updateOne(
        { id: uploadId },
        { $set: { status: 'error', error: analysis.error } }
      );
      return err(`Analysis failed: ${analysis.error}`);
    }

    // Save analysis results
    await db.collection('data_imports').updateOne(
      { id: uploadId },
      { $set: { 
        status: 'complete',
        analysis,
        completed_at: new Date(),
      } }
    );

    // Update user's soul profile with aggregated insights
    const existingProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
    const updatedInsights = mergeInsights(existingProfile?.insights || {}, analysis, parsedData.source);
    
    await db.collection('soul_profiles').updateOne(
      { user_id: user.id },
      { 
        $set: { 
          insights: updatedInsights,
          updated_at: new Date(),
        },
        $push: {
          import_history: {
            import_id: uploadId,
            source: parsedData.source,
            analyzed_at: new Date(),
          }
        }
      },
      { upsert: true }
    );

    // Invalidate system prompt cache so both web and Telegram get updated profile
    invalidateSystemPromptCache(user.id);

    // Raw data is NOT stored - only the analysis results
    // The ZIP buffer is already garbage collected after this function

    return ok({
      success: true,
      uploadId,
      analysis,
      stats: {
        source: parsedData.source,
        conversationsAnalyzed: parsedData.conversationCount || 0,
        messagesAnalyzed: parsedData.userMessageCount || parsedData.messageCount || 0,
        postsAnalyzed: parsedData.postCount || 0,
      }
    });

  } catch (e) {
    console.error('Data import error:', e);
    return err(`Import failed: ${e.message}`, 500);
  }
}

// Merge new insights with existing profile
function mergeInsights(existing, newAnalysis, source) {
  const updated = { ...existing };
  
  // Add or update communication style
  updated.communicationStyle = updated.communicationStyle || {};
  updated.communicationStyle[source] = newAnalysis.communicationStyle;
  
  // Merge interests (dedupe)
  const existingInterests = updated.interests || [];
  const newInterests = newAnalysis.interests || [];
  updated.interests = [...new Set([...existingInterests, ...newInterests])].slice(0, 20);
  
  // Add insights
  updated.insights = updated.insights || [];
  updated.insights = [...(newAnalysis.insights || []), ...updated.insights].slice(0, 15);
  
  // Vocabulary
  updated.vocabulary = updated.vocabulary || {};
  updated.vocabulary[source] = newAnalysis.vocabulary;
  
  // Question style
  updated.questionStyle = updated.questionStyle || {};
  updated.questionStyle[source] = newAnalysis.questionStyle;
  
  // Latest summary
  updated.latestSummary = newAnalysis.summary;
  updated.sources = [...new Set([...(updated.sources || []), source])];
  
  return updated;
}

// Get user's data imports and soul profile
async function handleGetDataImports(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get all imports for this user
  const imports = await db.collection('data_imports')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();
  
  // Get soul profile
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
  
  return ok({
    imports: imports.map(i => ({
      id: i.id,
      source: i.parsed_stats?.source || i.source,
      status: i.status,
      stats: i.parsed_stats,
      analysis: i.analysis,
      created_at: i.created_at,
      completed_at: i.completed_at,
    })),
    soulProfile: soulProfile?.insights || null,
  });
}

// Delete a specific import (keeps the analysis in soul profile)
async function handleDeleteDataImport(request, importId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const result = await db.collection('data_imports').deleteOne({ 
    id: importId, 
    user_id: user.id 
  });
  
  if (result.deletedCount === 0) return err('Import not found', 404);
  return ok({ success: true });
}

// ============================================================
// ASSESSMENT RESET ENDPOINT
// ============================================================

async function handleResetAssessment(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get current assessment answers for backup/history
  const currentAnswers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();
  
  if (currentAnswers.length > 0) {
    // Archive old answers
    await db.collection('assessment_history').insertOne({
      user_id: user.id,
      answers: currentAnswers,
      archived_at: new Date(),
    });
    
    // Delete current answers
    await db.collection('assessment_answers').deleteMany({ user_id: user.id });
  }
  
  // Reset assessment_complete flag
  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { assessment_complete: false } }
  );
  
  return ok({ 
    success: true, 
    message: 'Assessment reset. You can now retake the 36-question guide.',
    previousAnswers: currentAnswers.length
  });
}

// PLACES SEARCH API - for web app
async function handlePlacesSearch(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { query, location, lat, lng, radius = 2000, maxResults = 10 } = body;

  if (!query && !location && (!lat || !lng)) {
    return err('Either query with location, or lat/lng coordinates required');
  }

  try {
    let coords = { lat, lng };
    let locationName = location || 'selected location';

    // If no coordinates, geocode the location
    if (!lat || !lng) {
      if (location) {
        const geocoded = await geocodeAddress(location);
        if (!geocoded) return err(`Could not find location: ${location}`);
        coords = { lat: geocoded.lat, lng: geocoded.lng };
        locationName = geocoded.formattedAddress;
      } else {
        return err('Location or coordinates required');
      }
    }

    // Extract place type from query
    const placeType = query ? extractPlaceType(query) : null;

    const places = await searchNearbyPlaces({
      lat: coords.lat,
      lng: coords.lng,
      query: placeType ? null : query,
      type: placeType,
      radius,
      maxResults,
    });

    return ok({
      places,
      location: locationName,
      coordinates: coords,
      count: places.length,
    });
  } catch (e) {
    return err(`Search failed: ${e.message}`, 500);
  }
}

// GEOCODE API - convert address to coordinates
async function handleGeocode(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { address } = body;

  if (!address) return err('address required');

  try {
    const result = await geocodeAddress(address);
    if (!result) return err(`Could not find location: ${address}`);
    return ok(result);
  } catch (e) {
    return err(`Geocode failed: ${e.message}`, 500);
  }
}

// TRANSCRIBE - Whisper audio transcription (fallback for non-Chrome browsers)
async function handleTranscribe(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    if (!audioFile) return err('No audio file provided');

    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    return ok({ text: transcription.text });
  } catch (error) {
    return err(`Transcription failed: ${error.message}`, 500);
  }
}

// USER LOCATION - Save browser geolocation for web app
async function handleSaveUserLocation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { lat, lng } = body;

  if (!lat || !lng) return err('lat and lng required');

  try {
    const db = await getDb();
    
    // Reverse geocode to get address
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    let address = 'Your location';
    
    if (apiKey) {
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
      const geoData = await geoRes.json();
      address = geoData.results?.[0]?.formatted_address || 'Your location';
    }

    await db.collection('user_locations').updateOne(
      { user_id: user.id },
      { 
        $set: { 
          lat, 
          lng, 
          address,
          updated_at: new Date(),
          source: 'web'
        } 
      },
      { upsert: true }
    );

    return ok({ success: true, address, lat, lng });
  } catch (error) {
    return err(`Failed to save location: ${error.message}`, 500);
  }
}

// USER LOCATION - Get current saved location
async function handleGetUserLocation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const db = await getDb();
    const location = await db.collection('user_locations').findOne({ user_id: user.id });
    
    if (!location || !location.lat || !location.lng) {
      return ok({ hasLocation: false });
    }

    return ok({ 
      hasLocation: true, 
      lat: location.lat, 
      lng: location.lng, 
      address: location.address,
      updated_at: location.updated_at
    });
  } catch (error) {
    return err(`Failed to get location: ${error.message}`, 500);
  }
}

// MODELS - Get available
async function handleGetModels(request) {
  return ok(AVAILABLE_MODELS);
}

// ============================================================
// LAYERED ASSESSMENT API HANDLERS
// ============================================================

// Get layered assessment questions
async function handleGetLayeredQuestions(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Get user's existing layered assessment progress
  const progress = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
  
  // Determine which follow-up questions to show based on Layer 1 answers
  let followUpQuestions = [];
  if (progress?.layer1_answers) {
    for (const [questionId, answer] of Object.entries(progress.layer1_answers)) {
      const key = `${questionId}:${answer}`;
      if (LAYERED_ASSESSMENT_QUESTIONS.layer2[key]) {
        followUpQuestions.push(...LAYERED_ASSESSMENT_QUESTIONS.layer2[key]);
      }
    }
  }
  
  return ok({
    layer1: LAYERED_ASSESSMENT_QUESTIONS.layer1,
    layer2: followUpQuestions,
    progress: {
      layer1_complete: progress?.layer1_complete || false,
      layer2_complete: progress?.layer2_complete || false,
      answered: progress?.layer1_answers ? Object.keys(progress.layer1_answers) : []
    }
  });
}

// Submit layered assessment answers
async function handleSubmitLayeredAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { question_id, answer, layer } = body;
  
  if (!question_id || answer === undefined) return err('question_id and answer required');
  
  const db = await getDb();
  
  // Get or create assessment record
  let record = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
  
  if (!record) {
    record = {
      id: uuidv4(),
      user_id: user.id,
      layer1_answers: {},
      layer2_answers: {},
      layer1_complete: false,
      layer2_complete: false,
      created_at: new Date()
    };
  }
  
  // Update the appropriate layer
  const layerKey = layer === 2 ? 'layer2_answers' : 'layer1_answers';
  record[layerKey][question_id] = answer;
  record.updated_at = new Date();
  
  // Check if Layer 1 is complete (all 12 questions answered - 2 per pillar)
  const layer1Questions = LAYERED_ASSESSMENT_QUESTIONS.layer1.map(q => q.id);
  const layer1Answered = Object.keys(record.layer1_answers);
  record.layer1_complete = layer1Questions.every(qid => layer1Answered.includes(qid));
  
  // Determine follow-up questions
  let followUpQuestions = [];
  for (const [questionId, ans] of Object.entries(record.layer1_answers)) {
    const key = `${questionId}:${ans}`;
    if (LAYERED_ASSESSMENT_QUESTIONS.layer2[key]) {
      followUpQuestions.push(...LAYERED_ASSESSMENT_QUESTIONS.layer2[key]);
    }
  }
  
  // Check if Layer 2 is complete
  if (followUpQuestions.length > 0) {
    const layer2QuestionIds = followUpQuestions.map(q => q.id);
    const layer2Answered = Object.keys(record.layer2_answers);
    record.layer2_complete = layer2QuestionIds.every(qid => layer2Answered.includes(qid));
  } else {
    record.layer2_complete = true; // No follow-ups needed
  }
  
  await db.collection('layered_assessment_answers').updateOne(
    { user_id: user.id },
    { $set: record },
    { upsert: true }
  );
  
  return ok({
    success: true,
    layer1_complete: record.layer1_complete,
    layer2_complete: record.layer2_complete,
    follow_up_questions: record.layer1_complete ? followUpQuestions : []
  });
}

// Complete layered assessment
async function handleCompleteLayeredAssessment(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { assistant_name } = body;
  
  const db = await getDb();
  
  // Get assessment answers
  const answers = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
  if (!answers || !answers.layer1_complete) {
    return err('Please complete the core questions first', 400);
  }
  
  // Calculate communication profile
  const allAnswers = { ...answers.layer1_answers, ...answers.layer2_answers };
  const profile = calculateCommunicationProfile(allAnswers);
  
  // Save profile
  await db.collection('communication_profiles').updateOne(
    { user_id: user.id },
    { 
      $set: { 
        ...profile,
        user_id: user.id,
        updated_at: new Date()
      } 
    },
    { upsert: true }
  );
  
  // Mark assessment as complete
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { 
      $set: { 
        assistant_name: assistant_name || 'SoulPrint', 
        assessment_complete: true,
        assessment_type: 'layered', // Track which assessment type was used
        updated_at: new Date()
      } 
    }
  );
  
  // Clear the system prompt cache
  _systemPromptCache.delete(user.id);
  
  return ok({ 
    success: true,
    profile_summary: `Based on your responses:
• Communication style: ${profile.modality === 'write' ? 'You prefer written communication' : profile.modality === 'talk' ? 'You prefer talking things through' : 'You adapt your communication style'}
• Feedback preference: ${profile.directness > 60 ? 'Direct and to the point' : profile.directness < 40 ? 'Gentle and diplomatic' : 'Balanced approach'}
• Information density: ${profile.information_density > 60 ? 'You can handle complexity' : 'You prefer concise information'}
• Decision support: ${profile.decision_support === 'recommendation' ? "I'll lead with clear recommendations" : profile.decision_support === 'framework' ? "I'll help you build decision frameworks" : "I'll present curated options"}`
  });
}

// Get assessment mode setting
async function handleGetAssessmentSettings(request) {
  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });
  
  return ok({
    assessment_mode: settings?.assessment_mode || 'both', // 'full_only', 'quick_only', 'both'
    default_assessment: settings?.default_assessment || 'quick'
  });
}

// Submit Layer 3 validation answer (from chat)
async function handleLayer3Validation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { validation_id, answer, context } = body;
  
  if (!validation_id || !answer) return err('validation_id and answer required');
  
  const db = await getDb();
  
  // Get current profile
  const profile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  if (!profile) {
    return ok({ success: true, message: 'No profile to update' });
  }
  
  // Update profile based on validation response
  const updates = {};
  
  switch (validation_id) {
    case 'detail_check':
      if (answer === 'Too much') {
        updates.information_density = Math.max(0, (profile.information_density || 50) - 15);
      } else if (answer === 'Could use more') {
        updates.information_density = Math.min(100, (profile.information_density || 50) + 15);
      }
      break;
    case 'directness_check':
      if (answer === 'Too blunt') {
        updates.directness = Math.max(0, (profile.directness || 50) - 15);
      } else if (answer === 'Could be more direct') {
        updates.directness = Math.min(100, (profile.directness || 50) + 15);
      }
      break;
    case 'options_check':
      if (answer === 'Just recommend one') {
        updates.decision_support = 'recommendation';
      }
      break;
    case 'level_check':
      if (answer === 'Too simple') {
        updates.information_density = Math.min(100, (profile.information_density || 50) + 10);
      } else if (answer === 'Too complex') {
        updates.information_density = Math.max(0, (profile.information_density || 50) - 10);
      }
      break;
    case 'length_check':
      if (answer === 'Yes, shorter please') {
        updates.information_density = Math.max(0, (profile.information_density || 50) - 20);
      } else if (answer === 'Go even deeper') {
        updates.information_density = Math.min(100, (profile.information_density || 50) + 20);
      }
      break;
  }
  
  // Increase confidence since we're getting live feedback
  updates['confidence.behavioral'] = Math.min(1, (profile.confidence?.behavioral || 0.5) + 0.1);
  updates.updated_at = new Date();
  
  // Record the validation
  await db.collection('layer3_validations').insertOne({
    id: uuidv4(),
    user_id: user.id,
    validation_id,
    answer,
    context,
    created_at: new Date()
  });
  
  // Update profile
  await db.collection('communication_profiles').updateOne(
    { user_id: user.id },
    { $set: updates }
  );
  
  // Clear system prompt cache
  systemPromptCache.delete(user.id);
  
  return ok({ success: true, updates });
}

// Get next Layer 3 validation question (if needed)
async function handleGetNextValidation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Get profile
  const profile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  if (!profile) {
    return ok({ hasValidation: false });
  }
  
  // Get previous validations
  const validations = await db.collection('layer3_validations')
    .find({ user_id: user.id })
    .toArray();
  
  const answeredIds = validations.map(v => v.validation_id);
  
  // Get message count to determine if we should ask
  const messageCount = await db.collection('messages')
    .countDocuments({ user_id: user.id, role: 'assistant' });
  
  // Only ask validations after first 3-5 messages
  if (messageCount < 3) {
    return ok({ hasValidation: false });
  }
  
  // Find next unanswered validation
  const nextValidation = LAYERED_ASSESSMENT_QUESTIONS.layer3_validations
    .find(v => !answeredIds.includes(v.id));
  
  if (!nextValidation) {
    return ok({ hasValidation: false, allComplete: true });
  }
  
  // Only return validation with some probability (don't ask every time)
  // After 5+ messages, ask every 3rd message
  if (messageCount >= 5 && messageCount % 3 !== 0) {
    return ok({ hasValidation: false });
  }
  
  return ok({
    hasValidation: true,
    validation: nextValidation
  });
}

// ============================================================
// GRADUAL ASSESSMENT SYSTEM
// Asks remaining 36-question assessment questions over time
// ============================================================

// Get the next gradual assessment question for the user
async function handleGetGradualQuestion(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Get user's profile to check assessment type
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  // Get gradual progress record
  let gradualProgress = await db.collection('gradual_assessment_progress').findOne({ user_id: user.id });
  
  // If no progress record exists, initialize it
  if (!gradualProgress) {
    // Check what questions user has already answered
    const existingAnswers = await db.collection('assessment_answers')
      .find({ user_id: user.id })
      .toArray();
    const answeredQuestionIds = existingAnswers.map(a => a.question_id);
    
    gradualProgress = {
      id: uuidv4(),
      user_id: user.id,
      answered_question_ids: answeredQuestionIds,
      total_questions: 36,
      last_question_at: null,
      questions_since_last_prompt: 0,
      created_at: new Date(),
    };
    await db.collection('gradual_assessment_progress').insertOne(gradualProgress);
  }
  
  // Get all active questions
  const allQuestions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();
  
  // Find unanswered questions
  const answeredIds = new Set(gradualProgress.answered_question_ids || []);
  const unansweredQuestions = allQuestions.filter(q => !answeredIds.has(q.id));
  
  if (unansweredQuestions.length === 0) {
    return ok({ 
      hasQuestion: false, 
      complete: true,
      progress: {
        answered: gradualProgress.answered_question_ids?.length || 0,
        total: 36,
        percentage: 100
      }
    });
  }
  
  // Determine if we should ask a question now
  // Logic: Ask after every 5-10 chat messages, but not too frequently
  const messageCount = await db.collection('messages')
    .countDocuments({ 
      user_id: user.id, 
      role: 'user',
      created_at: { $gt: gradualProgress.last_question_at || new Date(0) }
    });
  
  // Don't ask if less than 5 messages since last question
  const MIN_MESSAGES_BETWEEN = 5;
  if (messageCount < MIN_MESSAGES_BETWEEN) {
    return ok({ 
      hasQuestion: false, 
      shouldWait: true,
      messagesUntilNext: MIN_MESSAGES_BETWEEN - messageCount,
      progress: {
        answered: answeredIds.size,
        total: 36,
        percentage: Math.round((answeredIds.size / 36) * 100)
      }
    });
  }
  
  // Get the next question (prioritize by pillar to ensure coverage)
  // Group unanswered by pillar and pick from least-answered pillar
  const pillarCounts = {};
  for (const q of unansweredQuestions) {
    pillarCounts[q.pillar] = (pillarCounts[q.pillar] || 0) + 1;
  }
  
  // Pick the pillar with most remaining questions
  const targetPillar = Object.entries(pillarCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  const nextQuestion = unansweredQuestions.find(q => q.pillar === targetPillar) || unansweredQuestions[0];
  
  return ok({
    hasQuestion: true,
    question: {
      id: nextQuestion.id,
      pillar: nextQuestion.pillar,
      question_text: nextQuestion.question_text,
      order_index: nextQuestion.order_index,
    },
    progress: {
      answered: answeredIds.size,
      total: 36,
      percentage: Math.round((answeredIds.size / 36) * 100),
      remaining: unansweredQuestions.length,
    },
    pillarProgress: Object.fromEntries(
      ['communication', 'emotional_intelligence', 'decision_making', 'social_dynamics', 'cognitive_style', 'assertiveness']
        .map(p => {
          const totalInPillar = allQuestions.filter(q => q.pillar === p).length;
          const answeredInPillar = allQuestions.filter(q => q.pillar === p && answeredIds.has(q.id)).length;
          return [p, { answered: answeredInPillar, total: totalInPillar }];
        })
    )
  });
}

// Submit a gradual assessment answer
async function handleSubmitGradualAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { question_id, answer } = body;
  
  if (!question_id || !answer) return err('question_id and answer required');
  
  const db = await getDb();
  
  // Save the answer
  await db.collection('assessment_answers').updateOne(
    { user_id: user.id, question_id },
    {
      $set: {
        id: uuidv4(),
        user_id: user.id,
        question_id,
        answer_text: answer,
        source: 'gradual', // Mark as coming from gradual system
        created_at: new Date(),
      }
    },
    { upsert: true }
  );
  
  // Update gradual progress
  await db.collection('gradual_assessment_progress').updateOne(
    { user_id: user.id },
    {
      $addToSet: { answered_question_ids: question_id },
      $set: { 
        last_question_at: new Date(),
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
  
  // Check if all 36 are now complete
  const progress = await db.collection('gradual_assessment_progress').findOne({ user_id: user.id });
  const isComplete = (progress?.answered_question_ids?.length || 0) >= 36;
  
  if (isComplete) {
    // Mark full assessment as complete
    await db.collection('profiles').updateOne(
      { user_id: user.id },
      { $set: { full_assessment_complete: true, updated_at: new Date() } }
    );
  }
  
  // Clear system prompt cache to reflect new profile data
  _systemPromptCache.delete(user.id);
  
  return ok({ 
    success: true,
    progress: {
      answered: progress?.answered_question_ids?.length || 0,
      total: 36,
      percentage: Math.round(((progress?.answered_question_ids?.length || 0) / 36) * 100),
      isComplete
    }
  });
}

// Skip a gradual assessment question (for now)
async function handleSkipGradualQuestion(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { question_id } = body;
  
  const db = await getDb();
  
  // Update last question time to delay next prompt
  await db.collection('gradual_assessment_progress').updateOne(
    { user_id: user.id },
    {
      $set: { 
        last_question_at: new Date(),
        updated_at: new Date()
      },
      $addToSet: { skipped_question_ids: question_id }
    },
    { upsert: true }
  );
  
  return ok({ success: true });
}

// Get full assessment progress summary
async function handleGetAssessmentProgress(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Get all data sources
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const gradualProgress = await db.collection('gradual_assessment_progress').findOne({ user_id: user.id });
  const allQuestions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();
  
  const answeredIds = new Set(gradualProgress?.answered_question_ids || []);
  
  // Calculate pillar-by-pillar progress
  const pillars = ['communication', 'emotional_intelligence', 'decision_making', 'social_dynamics', 'cognitive_style', 'assertiveness'];
  const pillarProgress = {};
  
  for (const pillar of pillars) {
    const pillarQuestions = allQuestions.filter(q => q.pillar === pillar);
    const answeredInPillar = pillarQuestions.filter(q => answeredIds.has(q.id));
    pillarProgress[pillar] = {
      answered: answeredInPillar.length,
      total: pillarQuestions.length,
      percentage: pillarQuestions.length > 0 ? Math.round((answeredInPillar.length / pillarQuestions.length) * 100) : 0,
      questions: pillarQuestions.map(q => ({
        id: q.id,
        text: q.question_text,
        answered: answeredIds.has(q.id)
      }))
    };
  }
  
  return ok({
    assessmentType: profile?.assessment_type || 'unknown',
    quickStartComplete: profile?.assessment_complete || false,
    fullAssessmentComplete: profile?.full_assessment_complete || false,
    overall: {
      answered: answeredIds.size,
      total: 36,
      percentage: Math.round((answeredIds.size / 36) * 100)
    },
    pillars: pillarProgress
  });
}

// Get user's communication profile
async function handleGetCommunicationProfile(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  const profile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  
  if (!profile) {
    return ok({ hasProfile: false });
  }
  
  // Generate human-readable summary
  const adaptations = generateAdaptivePrompt(profile);
  
  return ok({
    hasProfile: true,
    profile: {
      directness: profile.directness,
      emotional_warmth: profile.emotional_warmth,
      information_density: profile.information_density,
      proactivity: profile.proactivity,
      modality: profile.modality,
      feedback_style: profile.feedback_style,
      decision_support: profile.decision_support,
      stress_response: profile.stress_response,
      confidence: profile.confidence
    },
    adaptations,
    updated_at: profile.updated_at
  });
}

// Get user's complete SoulPrint (all profile data)
async function handleGetSoulPrint(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get all profile data
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const commProfile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
  
  // Get latest and previous SoulPrint snapshots
  const snapshots = await db.collection('soulprint_snapshots')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(2)
    .toArray();
  
  const latestSnapshot = snapshots[0] || null;
  const previousSnapshot = snapshots[1] || null;
  
  // Get assessment answers
  const assessmentAnswers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .sort({ created_at: 1 })
    .toArray();
  
  // Get question text for answers
  const questionIds = assessmentAnswers.map(a => a.question_id);
  const questions = await db.collection('assessment_questions')
    .find({ id: { $in: questionIds } })
    .toArray();
  const qMap = Object.fromEntries(questions.map(q => [q.id, q]));
  
  // Build communication traits from commProfile OR from layered assessment answers
  const communicationTraits = [];
  if (commProfile) {
    // Directness
    const directness = getTraitDescription('directness', commProfile.directness || 50);
    communicationTraits.push({
      name: 'Communication Style',
      value: commProfile.directness || 50,
      label: directness.label,
      description: directness.desc,
      icon: '🎯'
    });
    
    // Emotional Warmth
    const warmth = getTraitDescription('emotional_warmth', commProfile.emotional_warmth || 50);
    communicationTraits.push({
      name: 'Warmth Level',
      value: commProfile.emotional_warmth || 50,
      label: warmth.label,
      description: warmth.desc,
      icon: '💝'
    });
    
    // Information Density
    const density = getTraitDescription('information_density', commProfile.information_density || 50);
    communicationTraits.push({
      name: 'Detail Preference',
      value: commProfile.information_density || 50,
      label: density.label,
      description: density.desc,
      icon: '📊'
    });
    
    // Proactivity
    const proactive = getTraitDescription('proactivity', commProfile.proactivity || 50);
    communicationTraits.push({
      name: 'Support Style',
      value: commProfile.proactivity || 50,
      label: proactive.label,
      description: proactive.desc,
      icon: '🚀'
    });
  } else if (profile?.assessment_complete) {
    // Fallback: Generate basic traits if no communication_profile but assessment is complete
    // This handles users who completed the Full Assessment (not Quick)
    communicationTraits.push({
      name: 'Assessment Status',
      value: 100,
      label: 'Completed',
      description: 'You\'ve completed the full assessment. Your SoulPrint is being built from your responses.',
      icon: '✅'
    });
  }
  
  // Build adaptations list (how AI communicates with them)
  const adaptations = commProfile ? generateAdaptivePrompt(commProfile).split('\n').filter(Boolean) : [];
  
  // Get profile history/changes
  const profileHistory = await db.collection('soul_profile_history')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();
  
  // Format assessment answers by pillar
  const answersByPillar = {};
  assessmentAnswers.forEach(a => {
    const q = qMap[a.question_id];
    if (!q) return;
    if (!answersByPillar[q.pillar]) answersByPillar[q.pillar] = [];
    answersByPillar[q.pillar].push({
      question: q.question_text,
      answer: a.answer_text,
      answered_at: a.created_at
    });
  });
  
  // Build response
  return ok({
    // Basic info
    displayName: profile?.display_name || user.email?.split('@')[0],
    assistantName: profile?.assistant_name || 'SoulPrint',
    assessmentComplete: profile?.assessment_complete || false,
    
    // Communication profile (from Quick Assessment)
    communicationTraits,
    adaptations,
    decisionSupport: commProfile?.decision_support || null,
    feedbackStyle: commProfile?.feedback_style || null,
    stressResponse: commProfile?.stress_response || null,
    
    // Soul profile (from data imports)
    soulInsights: soulProfile?.insights || null,
    importedFrom: soulProfile?.sources || [],
    lastImportAt: soulProfile?.updated_at || null,
    
    // Assessment answers
    answersByPillar,
    totalAnswers: assessmentAnswers.length,
    
    // Profile summary
    profileSummary: profile?.soul_profile_summary || null,
    
    // History of changes
    profileHistory: profileHistory.map(h => ({
      date: h.created_at,
      changes: h.changes,
      source: h.source
    })),
    
    // Onboarding data
    descriptors: profile?.descriptors || [],
    field: profile?.field || '',
    helpWith: profile?.help_with || [],
    
    // Latest AI-generated SoulPrint snapshot
    latestSnapshot: latestSnapshot ? {
      id: latestSnapshot.id,
      generatedAt: latestSnapshot.created_at,
      insights: latestSnapshot.insights,
      communicationStyle: latestSnapshot.communication_style,
      interests: latestSnapshot.interests,
      personality: latestSnapshot.personality,
      growthAreas: latestSnapshot.growth_areas,
      dataSources: latestSnapshot.data_sources,
    } : null,
    
    // Previous snapshot for comparison
    previousSnapshot: previousSnapshot ? {
      id: previousSnapshot.id,
      generatedAt: previousSnapshot.created_at,
      communicationStyle: previousSnapshot.communication_style,
    } : null,
    
    // Assessment progress for gradual system
    assessmentProgress: await getAssessmentProgress(db, user.id, profile),
    
    // Timestamps
    createdAt: profile?.created_at,
    lastUpdated: commProfile?.updated_at || soulProfile?.updated_at || profile?.created_at
  });
}

// Helper to get assessment progress
async function getAssessmentProgress(db, userId, profile) {
  // Get gradual progress (for in-chat questions)
  const gradualProgress = await db.collection('gradual_assessment_progress').findOne({ user_id: userId });
  
  // Also get assessment_answers (from initial full/quick assessment)
  const assessmentAnswers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .toArray();
  
  const allQuestions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();
  
  // Combine answered question IDs from both sources
  const answeredIds = new Set([
    ...(gradualProgress?.answered_question_ids || []),
    ...assessmentAnswers.map(a => a.question_id)
  ]);
  
  const pillars = ['communication', 'emotional_intelligence', 'decision_making', 'social_dynamics', 'cognitive_style', 'assertiveness'];
  const pillarProgress = {};
  
  for (const pillar of pillars) {
    const pillarQuestions = allQuestions.filter(q => q.pillar === pillar);
    const answeredInPillar = pillarQuestions.filter(q => answeredIds.has(q.id)).length;
    pillarProgress[pillar] = {
      answered: answeredInPillar,
      total: pillarQuestions.length,
      percentage: pillarQuestions.length > 0 ? Math.round((answeredInPillar / pillarQuestions.length) * 100) : 0,
    };
  }
  
  const totalAnswered = answeredIds.size;
  const totalQuestions = Math.max(36, allQuestions.length); // At least 36 or however many exist
  
  return {
    quickStartComplete: profile?.assessment_complete || false,
    fullAssessmentComplete: profile?.full_assessment_complete || totalAnswered >= 36,
    overall: {
      answered: totalAnswered,
      total: totalQuestions,
      percentage: Math.round((totalAnswered / totalQuestions) * 100)
    },
    pillars: pillarProgress
  };
}

// Generate/Refresh SoulPrint Analysis using AI
async function handleGenerateSoulPrint(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Gather all data sources
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const commProfile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
  
  // Get assessment answers
  const assessmentAnswers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();
  
  // Get recent SoulPrint chat messages (last 100)
  const recentMessages = await db.collection('messages')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray();
  
  // Get imported messages sample (last 200)
  const importedMessages = await db.collection('imported_messages')
    .find({ user_id: user.id })
    .sort({ timestamp: -1 })
    .limit(200)
    .toArray();
  
  // Get memories from user_memories collection
  const memories = await db.collection('user_memories')
    .find({ user_id: user.id })
    .sort({ importance: 1, created_at: -1 })
    .toArray();
  
  console.log('[SoulPrint] Found', memories.length, 'memories for user', user.id);
  
  // Build context for AI analysis
  const dataSources = [];
  let contextParts = [];
  
  // Assessment data
  if (assessmentAnswers.length > 0) {
    dataSources.push('assessment');
    const questions = await db.collection('assessment_questions').find({}).toArray();
    const qMap = Object.fromEntries(questions.map(q => [q.id, q.question_text]));
    const assessmentText = assessmentAnswers.map(a => 
      `Q: ${qMap[a.question_id] || 'Unknown'}\nA: ${a.answer_text}`
    ).join('\n\n');
    contextParts.push(`## Assessment Responses\n${assessmentText}`);
  }
  
  // Communication profile
  if (commProfile) {
    dataSources.push('quick_assessment');
    contextParts.push(`## Communication Profile Scores
- Directness: ${commProfile.directness || 50}/100
- Emotional Warmth: ${commProfile.emotional_warmth || 50}/100
- Information Density: ${commProfile.information_density || 50}/100
- Proactivity: ${commProfile.proactivity || 50}/100
- Decision Support Preference: ${commProfile.decision_support || 'balanced'}
- Feedback Style: ${commProfile.feedback_style || 'balanced'}`);
  }
  
  // Recent SoulPrint conversations
  if (recentMessages.length > 0) {
    dataSources.push('soulprint_chats');
    const chatSample = recentMessages
      .slice(0, 50)
      .map(m => `${m.role}: ${m.content?.substring(0, 300)}`)
      .join('\n');
    contextParts.push(`## Recent SoulPrint Conversations (sample)\n${chatSample}`);
  }
  
  // Imported ChatGPT/Facebook messages
  if (importedMessages.length > 0) {
    dataSources.push('imported_history');
    const importedSample = importedMessages
      .slice(0, 100)
      .map(m => m.content?.substring(0, 200))
      .filter(Boolean)
      .join('\n---\n');
    contextParts.push(`## Imported Chat History (sample)\n${importedSample}`);
  }
  
  // Memories - THESE ARE THE MOST IMPORTANT as they represent verified, current facts
  if (memories.length > 0) {
    dataSources.push('memories');
    const memoriesText = memories.map(m => `- [${m.category || 'fact'}] ${m.content}`).join('\n');
    // Put memories FIRST as they are the most authoritative source
    contextParts.unshift(`## CURRENT STORED MEMORIES (MOST AUTHORITATIVE - prioritize these over older imported data)
These are verified facts that the user has confirmed or the system has learned recently. If there are any contradictions with imported chat history, ALWAYS prefer the information in these memories as they represent the user's CURRENT state.

${memoriesText}`);
  }
  
  // Soul profile insights
  if (soulProfile?.insights) {
    const insights = soulProfile.insights;
    if (insights.interests?.length) {
      contextParts.push(`## Previously Identified Interests\n${insights.interests.join(', ')}`);
    }
    if (insights.insights?.length) {
      contextParts.push(`## Previous Personality Insights\n${insights.insights.join('\n')}`);
    }
  }
  
  // If no data, return error
  if (contextParts.length === 0) {
    return err('Not enough data to generate SoulPrint. Complete an assessment or import some chat history first.', 400);
  }
  
  // Generate SoulPrint using AI
  const analysisPrompt = `You are analyzing a user's communication patterns and personality to create their "SoulPrint" - a comprehensive profile of who they are RIGHT NOW.

IMPORTANT RULES:
1. If "CURRENT STORED MEMORIES" are provided, ALWAYS prioritize them over imported chat history
2. Memories represent the user's CURRENT verified state - they override any contradicting info from older data
3. Imported chat history may contain OUTDATED information (e.g., past relationships, old jobs, etc.)
4. When in doubt, use present tense and reflect the most recent information

Based on the following data, generate a detailed SoulPrint analysis:

${contextParts.join('\n\n')}

---

Respond with a JSON object containing:
{
  "summary": "A 2-3 sentence overview of who this person is RIGHT NOW (current state, not historical)",
  "communication_style": {
    "overall": "Brief description of their overall communication style",
    "tone": "warm/professional/casual/formal/mixed",
    "directness": "direct/diplomatic/balanced",
    "detail_preference": "concise/detailed/balanced",
    "traits": ["list", "of", "key", "communication", "traits"]
  },
  "personality": {
    "overview": "Brief personality overview",
    "strengths": ["list", "of", "strengths"],
    "traits": ["list", "of", "personality", "traits"]
  },
  "interests": ["list", "of", "identified", "interests", "and", "topics"],
  "values": ["what", "they", "seem", "to", "value"],
  "growth_areas": ["potential", "areas", "for", "growth"],
  "insights": ["unique", "observations", "about", "this", "person"],
  "how_to_communicate": ["specific", "tips", "for", "communicating", "with", "them"]
}

Be specific and insightful. Base everything on the actual data provided.`;

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    
    const analysis = JSON.parse(completion.choices[0].message.content);
    
    // Create snapshot
    const snapshotId = uuidv4();
    const snapshot = {
      id: snapshotId,
      user_id: user.id,
      created_at: new Date(),
      data_sources: dataSources,
      insights: analysis.insights,
      summary: analysis.summary,
      communication_style: analysis.communication_style,
      personality: analysis.personality,
      interests: analysis.interests,
      values: analysis.values,
      growth_areas: analysis.growth_areas,
      how_to_communicate: analysis.how_to_communicate,
    };
    
    // Save snapshot
    await db.collection('soulprint_snapshots').insertOne(snapshot);
    
    // Return the new snapshot
    return ok({
      success: true,
      snapshot: {
        id: snapshotId,
        generatedAt: snapshot.created_at,
        dataSources,
        summary: analysis.summary,
        communicationStyle: analysis.communication_style,
        personality: analysis.personality,
        interests: analysis.interests,
        values: analysis.values,
        growthAreas: analysis.growth_areas,
        insights: analysis.insights,
        howToCommunicate: analysis.how_to_communicate,
      }
    });
    
  } catch (e) {
    console.error('SoulPrint generation failed:', e);
    return err('Failed to generate SoulPrint analysis', 500);
  }
}

// ============================================================
// EXTRACTED DATA IMPORT (Client-side processed)
// ============================================================

async function handleImportExtracted(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { type, messages, posts } = body;

  if (!messages || !Array.isArray(messages)) {
    return err('Messages array required');
  }

  const db = await getDb();
  const importId = uuidv4();

  // Create import job
  await db.collection('import_jobs').insertOne({
    id: importId,
    user_id: user.id,
    type: type || 'chatgpt',
    source: 'extracted',
    status: 'processing',
    progress: 10,
    message: 'Processing extracted data...',
    messages_count: 0,
    created_at: new Date(),
  });

  // Process in background
  processExtractedImport(db, user.id, importId, type, messages, posts || []).catch(err => {
    console.error('[ExtractedImport] Error:', err);
    db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status: 'failed', error: err.message } }
    );
  });

  return ok({ success: true, importId });
}

async function processExtractedImport(db, userId, importId, importType, messages, posts) {
  const updateStatus = async (status, message, progress, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    await updateStatus('processing', 'Deduplicating messages...', 20);

    // Hash messages for deduplication
    const hashMessage = (m) => {
      const str = `${m.content}|${m.role}|${m.timestamp || ''}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash.toString(16);
    };

    const messagesWithHash = messages.map(m => ({
      ...m,
      content_hash: hashMessage(m)
    }));

    // Check for existing messages
    const existingMsgs = await db.collection('imported_messages')
      .find({ user_id: userId })
      .project({ content_hash: 1 })
      .toArray();
    const existingHashes = new Set(existingMsgs.map(m => m.content_hash));

    // Filter new messages
    const newMessages = messagesWithHash.filter(m => !existingHashes.has(m.content_hash));

    await updateStatus('processing', `Importing ${newMessages.length} new messages...`, 40);

    // Insert new messages
    if (newMessages.length > 0) {
      const docs = newMessages.map(m => ({
        id: uuidv4(),
        user_id: userId,
        content: m.content,
        role: m.role,
        timestamp: m.timestamp,
        source: importType,
        content_hash: m.content_hash,
        conversation_id: m.conversation_id,
        conversation_title: m.conversation_title,
        sender: m.sender,
        imported_at: new Date(),
      }));

      const batchSize = 1000;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        await db.collection('imported_messages').insertMany(batch);
      }
    }

    // Import posts if any
    if (posts && posts.length > 0) {
      const postDocs = posts.map(p => ({
        id: uuidv4(),
        user_id: userId,
        content: p.content,
        timestamp: p.timestamp,
        source: importType,
        imported_at: new Date(),
      }));
      await db.collection('imported_posts').insertMany(postDocs);
    }

    await updateStatus('processing', 'Analyzing communication patterns...', 60);

    // Create data import record for analysis
    const dataImportId = uuidv4();
    await db.collection('data_imports').insertOne({
      id: dataImportId,
      user_id: userId,
      source: importType,
      status: 'processing',
      stats: {
        source: importType,
        conversationCount: new Set(messages.filter(m => m.conversation_id).map(m => m.conversation_id)).size,
        messageCount: newMessages.length,
        postCount: posts?.length || 0
      },
      created_at: new Date(),
    });

    // Analyze the data using AI
    let analysis = null;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_KEY && newMessages.length > 0) {
      try {
        const userMsgs = newMessages
          .filter(m => m.role === 'user' || m.role === 'human')
          .slice(0, 50)
          .map(m => m.content)
          .join('\n---\n');

        if (userMsgs.length > 100) {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Analyze this user's conversation history and create a personality/communication profile.
Return JSON with:
{
  "summary": "2-3 sentence summary of the person",
  "communicationStyle": {"formality": "formal/casual/mixed", "verbosity": "detailed/concise/balanced", "tone": "analytical/supportive/direct/friendly"},
  "interests": ["interest1", "interest2", ...],
  "vocabulary": {"complexity": "sophisticated/moderate/simple", "uniquePhrases": [], "emoji_usage": "frequent/occasional/none"},
  "questionStyle": "direct/context-heavy/exploratory",
  "insights": ["insight1", "insight2", "insight3"]
}`
                },
                {
                  role: 'user',
                  content: `Analyze these ${importType} messages:\n\n${userMsgs.substring(0, 15000)}`
                }
              ],
              temperature: 0.3,
              max_tokens: 1500,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              analysis = JSON.parse(jsonMatch[0]);
            }
          }
        }
      } catch (e) {
        console.error('[ExtractedImport] Analysis error:', e);
      }
    }

    // Update data import with analysis
    await db.collection('data_imports').updateOne(
      { id: dataImportId },
      { $set: { status: 'complete', analysis, completed_at: new Date() } }
    );

    await updateStatus('processing', 'Extracting memories...', 80);

    // Extract memories
    const memoriesAdded = await extractMemoriesFromImport(db, userId, newMessages, importType);

    // Update soul profile
    if (analysis) {
      await db.collection('soul_profiles').updateOne(
        { user_id: userId },
        {
          $set: {
            insights: {
              communicationStyle: analysis.communicationStyle,
              vocabulary: analysis.vocabulary
            },
            updated_at: new Date()
          },
          $addToSet: {
            interests: { $each: analysis.interests || [] }
          }
        },
        { upsert: true }
      );
    }

    // Clear system prompt cache
    _systemPromptCache.delete(userId);

    await updateStatus('completed', 
      `Successfully imported ${newMessages.length} messages${memoriesAdded > 0 ? ` and added ${memoriesAdded} memories` : ''}!`, 
      100, 
      { messages_count: newMessages.length, memories_added: memoriesAdded }
    );

  } catch (error) {
    console.error('[ExtractedImport] Processing error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

// ============================================================
// BLOG API HANDLERS
// ============================================================

// Helper to generate URL-friendly slug
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100);
}

// Get all published blog posts (public)
async function handleGetBlogPosts(request) {
  const db = await getDb();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const category = url.searchParams.get('category');
  const tag = url.searchParams.get('tag');
  
  const query = { status: 'published' };
  if (category) query.category = category;
  if (tag) query.tags = tag;
  
  const posts = await db.collection('blog_posts')
    .find(query)
    .sort({ published_at: -1 })
    .limit(limit)
    .toArray();
  
  // Get all unique categories and tags for filtering
  const allPosts = await db.collection('blog_posts')
    .find({ status: 'published' })
    .project({ category: 1, tags: 1 })
    .toArray();
  
  const categories = [...new Set(allPosts.map(p => p.category).filter(Boolean))];
  const tags = [...new Set(allPosts.flatMap(p => p.tags || []))];
  
  return ok({ posts, categories, tags });
}

// Get single blog post by slug (public)
async function handleGetBlogPost(request, slug) {
  const db = await getDb();
  
  const post = await db.collection('blog_posts').findOne({ 
    slug, 
    status: 'published' 
  });
  
  if (!post) return err('Post not found', 404);
  
  // Get related posts (same category)
  const relatedPosts = await db.collection('blog_posts')
    .find({ 
      status: 'published', 
      category: post.category, 
      id: { $ne: post.id } 
    })
    .sort({ published_at: -1 })
    .limit(3)
    .toArray();
  
  return ok({ post, relatedPosts });
}

// Admin: Get all blog posts (including drafts)
async function handleAdminGetBlogPosts(request) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Unauthorized', 401);
  
  const db = await getDb();
  const posts = await db.collection('blog_posts')
    .find({})
    .sort({ created_at: -1 })
    .toArray();
  
  return ok({ posts });
}

// Admin: Create blog post
async function handleAdminCreateBlogPost(request) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Unauthorized', 401);
  
  const body = await request.json();
  const { title, content, excerpt, featured_image, category, tags, author, status } = body;
  
  if (!title || !content) return err('Title and content are required');
  
  const db = await getDb();
  
  // Generate unique slug
  let slug = generateSlug(title);
  const existingSlug = await db.collection('blog_posts').findOne({ slug });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  
  const post = {
    id: uuidv4(),
    slug,
    title,
    content,
    excerpt: excerpt || content.substring(0, 160).replace(/[#*_`]/g, '') + '...',
    featured_image: featured_image || null,
    category: category || 'General',
    tags: tags || [],
    author: author || 'SoulPrint Team',
    status: status || 'draft',
    created_at: new Date(),
    updated_at: new Date(),
    published_at: status === 'published' ? new Date() : null,
    created_by: user.id,
  };
  
  await db.collection('blog_posts').insertOne(post);
  
  return ok({ success: true, post });
}

// Admin: Update blog post
async function handleAdminUpdateBlogPost(request, postId) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Unauthorized', 401);
  
  const body = await request.json();
  const { title, content, excerpt, featured_image, category, tags, author, status } = body;
  
  const db = await getDb();
  const existingPost = await db.collection('blog_posts').findOne({ id: postId });
  
  if (!existingPost) return err('Post not found', 404);
  
  const updates = {
    updated_at: new Date(),
  };
  
  if (title !== undefined) {
    updates.title = title;
    // Update slug if title changed
    if (title !== existingPost.title) {
      let newSlug = generateSlug(title);
      const existingSlug = await db.collection('blog_posts').findOne({ slug: newSlug, id: { $ne: postId } });
      if (existingSlug) {
        newSlug = `${newSlug}-${Date.now().toString(36)}`;
      }
      updates.slug = newSlug;
    }
  }
  if (content !== undefined) updates.content = content;
  if (excerpt !== undefined) updates.excerpt = excerpt;
  if (featured_image !== undefined) updates.featured_image = featured_image;
  if (category !== undefined) updates.category = category;
  if (tags !== undefined) updates.tags = tags;
  if (author !== undefined) updates.author = author;
  if (status !== undefined) {
    updates.status = status;
    // Set published_at when publishing
    if (status === 'published' && existingPost.status !== 'published') {
      updates.published_at = new Date();
    }
  }
  
  await db.collection('blog_posts').updateOne(
    { id: postId },
    { $set: updates }
  );
  
  const updatedPost = await db.collection('blog_posts').findOne({ id: postId });
  
  return ok({ success: true, post: updatedPost });
}

// Admin: Delete blog post
async function handleAdminDeleteBlogPost(request, postId) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Unauthorized', 401);
  
  const db = await getDb();
  const result = await db.collection('blog_posts').deleteOne({ id: postId });
  
  if (result.deletedCount === 0) return err('Post not found', 404);
  
  return ok({ success: true });
}

// ============================================================
// SLACK BOT INTEGRATION
// ============================================================

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_ESCALATION_USER_ID = process.env.SLACK_ESCALATION_USER_ID;

// Knowledge base for the bot - key issues and solutions
const SOULPRINT_KNOWLEDGE = {
  features: [
    'authentication', 'login', 'register', 'beta codes', 'firebase auth',
    'chat', 'conversations', 'messages', 'streaming', 'AI models',
    'projects', 'collaboration', 'sharing', 'folders',
    'assessment', 'questions', 'profile', 'soulprint',
    'media generation', 'images', 'videos', 'gallery',
    'data import', 'chatgpt', 'whatsapp', 'upload',
    'telegram', 'bot integration',
    'admin', 'users', 'metrics', 'feedback', 'announcements'
  ],
  commonIssues: {
    'login': {
      symptoms: ['invalid passcode', 'cant login', 'login failed', 'authentication error'],
      cause: 'Wrong passcode, user doesn\'t exist, or token expired',
      solution: 'Check if user exists in DB, verify passcode, or ask user to re-register',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleLogin'
    },
    'chat not working': {
      symptoms: ['ai not responding', 'no response', 'chat broken', 'streaming not working'],
      cause: 'Missing API key for selected model or streaming headers blocked',
      solution: 'Check env vars: OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. Verify next.config.js headers',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleChatStream'
    },
    'messages not loading': {
      symptoms: ['messages empty', 'conversation empty', 'no messages'],
      cause: 'Invalid conversation ID or conversation doesn\'t exist',
      solution: 'Verify conversationId in request, check conversations collection',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleGetMessages'
    },
    'assessment progress': {
      symptoms: ['progress 0%', 'progress wrong', 'completion not updating'],
      cause: 'Answers stored in multiple collections not being aggregated',
      solution: 'Check both assessment_answers AND gradual_assessment_progress collections',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleGetAssessmentProgress'
    },
    'projects': {
      symptoms: ['cant create project', 'project not showing', 'share not working'],
      cause: 'Auth token missing or project permissions issue',
      solution: 'Verify Authorization header, check project ownership in projects collection',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleGetProjects, handleCreateProject'
    },
    'media generation': {
      symptoms: ['image stuck', 'video not generating', 'generation failed'],
      cause: 'Kie.ai API issue or missing KIE_API_KEY',
      solution: 'Check KIE_API_KEY in env, verify API quota, check media_gallery collection',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleGenerateImage, handleGenerateVideo'
    },
    'import': {
      symptoms: ['upload failed', 'import stuck', 'file not processing'],
      cause: 'File too large or job stuck in queue',
      solution: 'Use chunked upload for files >5MB, check import_jobs collection for errors',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleChunkedUploadInit'
    },
    'telegram': {
      symptoms: ['telegram not connecting', 'bot not responding', 'link failed'],
      cause: 'Invalid bot token or webhook not set',
      solution: 'Verify TELEGRAM_BOT_TOKEN, check telegram_links collection',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleTelegramWebhook'
    },
    'ui styling': {
      symptoms: ['text not visible', 'dropdown broken', 'layout broken', 'css issue'],
      cause: 'Tailwind class issues or dark mode styling',
      solution: 'Check element classes, use bg-[#1a1a1a] for dark backgrounds, verify text-white',
      file: '/app/app/chat/page.js or /app/components/mobile/MobileChat.js',
      function: 'N/A - CSS fix'
    },
    'mobile': {
      symptoms: ['input hidden', 'keyboard covering', 'android issue', 'ios issue'],
      cause: 'Safe area or viewport issues on mobile',
      solution: 'Add safe-area-bottom class, check pb-safe padding',
      file: '/app/components/mobile/MobileChat.js',
      function: 'N/A - CSS fix'
    }
  }
};

// Analyze issue and find matching solution
function analyzeIssue(text) {
  const lowerText = text.toLowerCase();
  
  // Check if it's about a known feature
  const mentionedFeatures = SOULPRINT_KNOWLEDGE.features.filter(f => lowerText.includes(f));
  
  // Find matching issues
  const matchedIssues = [];
  for (const [issue, data] of Object.entries(SOULPRINT_KNOWLEDGE.commonIssues)) {
    const matchScore = data.symptoms.filter(s => lowerText.includes(s)).length;
    if (matchScore > 0 || lowerText.includes(issue)) {
      matchedIssues.push({ issue, ...data, score: matchScore + (lowerText.includes(issue) ? 2 : 0) });
    }
  }
  
  // Sort by match score
  matchedIssues.sort((a, b) => b.score - a.score);
  
  return {
    isKnownFeature: mentionedFeatures.length > 0,
    features: mentionedFeatures,
    matchedIssues,
    bestMatch: matchedIssues[0] || null
  };
}

// Send message to Slack
async function sendSlackMessage(channel, text, blocks = null) {
  if (!SLACK_BOT_TOKEN) return;
  
  const payload = { channel, text };
  if (blocks) payload.blocks = blocks;
  
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Slack send error:', err);
  }
}

// Send DM to escalation user
async function escalateToOwner(originalMessage, channel, reason) {
  if (!SLACK_ESCALATION_USER_ID) return;
  
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚨 Issue Escalated for Review', emoji: true }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Reason:* ${reason}` }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Original Message:*\n>${originalMessage}` }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Channel:* <#${channel}>` }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Channel', emoji: true },
          url: `slack://channel?team=&id=${channel}`
        }
      ]
    }
  ];
  
  await sendSlackMessage(SLACK_ESCALATION_USER_ID, `Issue escalated: ${reason}`, blocks);
}

// Generate fix suggestion using AI
async function generateFixSuggestion(issue, analysis) {
  // Use OpenAI to generate a detailed fix
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null;
  
  const systemPrompt = `You are a SoulPrint app support bot. Given an issue report and analysis, provide a concise fix suggestion.
The app is built with Next.js, React, MongoDB, and uses multiple AI providers (OpenAI, Anthropic, Google).
Keep responses short and actionable. If you suggest code changes, be specific about file and function.`;

  const userPrompt = `Issue: ${issue}

Analysis found this likely cause:
- Problem: ${analysis.bestMatch?.cause || 'Unknown'}
- Typical solution: ${analysis.bestMatch?.solution || 'Needs investigation'}
- Relevant file: ${analysis.bestMatch?.file || 'Unknown'}
- Function: ${analysis.bestMatch?.function || 'Unknown'}

Provide a brief, actionable fix suggestion (2-3 sentences max). If it needs code changes, specify what to change.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('AI suggestion error:', err);
    return null;
  }
}

// In-memory store for support conversations (for tracking multi-turn interactions)
// In production, you'd want this in MongoDB or Redis
const supportConversations = new Map();

// Conversation states
const CONV_STATE = {
  INITIAL: 'initial',
  TRIAGE: 'triage', // New state for determining user error vs technical
  HELPING_USER: 'helping_user', // State when providing user assistance
  GATHERING_DETAILS: 'gathering_details',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  ESCALATED: 'escalated'
};

// Common user errors and their solutions
const USER_ERROR_PATTERNS = {
  'not logged in': {
    keywords: ['logged out', 'sign in', 'login', 'session expired', 'unauthorized', 'access denied'],
    solution: "This sounds like a login/session issue. Here's how to fix it:\n\n1. *Clear your browser cache* or app data\n2. *Log out completely* (if possible) and log back in\n3. If using the PWA, try *removing and re-adding* the app to your home screen\n4. Make sure you're using the *correct email/password*\n\nDid this help resolve your issue?"
  },
  'location not working': {
    keywords: ['location denied', 'can\'t find location', 'gps', 'near me not working', 'location permission'],
    solution: "Location issues are usually permission-related. Try these steps:\n\n*On iPhone/iOS:*\n1. Go to Settings → Privacy & Security → Location Services\n2. Find Safari (or your browser) and set to \"While Using\"\n3. Return to the app and tap the location icon again\n\n*On Android:*\n1. Tap the lock icon in the browser address bar\n2. Enable Location permission\n3. Refresh the page\n\n*On Desktop:*\n1. Click the lock/info icon in your browser's address bar\n2. Set Location to \"Allow\"\n3. Refresh the page\n\nDid this help?"
  },
  'microphone not working': {
    keywords: ['mic', 'microphone', 'voice', 'speech', 'recording', 'can\'t speak', 'audio input'],
    solution: "Microphone issues are typically permission-related:\n\n1. *Check browser permissions:* Click the lock icon in your address bar and ensure Microphone is set to \"Allow\"\n2. *Check device settings:* Make sure your browser has microphone access in your device's privacy settings\n3. *Try a different browser:* Chrome typically has the best microphone support\n4. *Refresh the page* after granting permissions\n\nIf you're on iOS Safari, note that some voice features work better in Chrome.\n\nDid this resolve the issue?"
  },
  'app not loading': {
    keywords: ['blank page', 'white screen', 'not loading', 'spinning', 'stuck loading', 'won\'t open'],
    solution: "Try these troubleshooting steps:\n\n1. *Hard refresh:* Press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)\n2. *Clear cache:* Clear your browser cache and cookies for this site\n3. *Check internet:* Make sure you have a stable connection\n4. *Try incognito:* Open the app in a private/incognito window\n5. *Disable extensions:* Browser extensions can sometimes interfere\n\nIf using the PWA, try removing and re-adding it to your home screen.\n\nDid any of these help?"
  },
  'telegram not connecting': {
    keywords: ['telegram', 'link telegram', 'bot not responding', 'telegram setup'],
    solution: "To connect Telegram:\n\n1. Go to *Settings* in the SoulPrint app\n2. Find the *Telegram* section\n3. Click *Link Telegram*\n4. Open Telegram and search for *@YourBotName*\n5. Send `/start` to the bot\n6. Follow the linking instructions\n\nIf the bot isn't responding, make sure you're messaging the correct bot and that you've completed the linking process in the app.\n\nIs this helping?"
  },
  'import not working': {
    keywords: ['import', 'upload', 'chatgpt history', 'export', 'file upload'],
    solution: "For importing chat history:\n\n1. *Export from ChatGPT:* Go to ChatGPT → Settings → Data Controls → Export data\n2. *Wait for email:* You'll receive a download link via email\n3. *Download and extract:* Unzip the downloaded file\n4. *Find conversations.json:* This is the file you need to upload\n5. *Upload in SoulPrint:* Go to Settings → Import → Upload the conversations.json file\n\nMake sure you're uploading the correct file format (JSON).\n\nDoes this help?"
  },
  'notifications': {
    keywords: ['notification', 'alert', 'push notification', 'not getting notifications'],
    solution: "To enable notifications:\n\n1. *Browser settings:* Make sure notifications are allowed for this site\n2. *Device settings:* Check that your browser can send notifications in system settings\n3. *PWA:* If using as an app, you may need to enable notifications in your device's app settings\n\nNote: Some browsers (especially Safari) have limited notification support.\n\nDid this help?"
  }
};

// Determine if issue is user error or technical bug
async function triageIssue(text, analysis) {
  const lowerText = text.toLowerCase();
  
  // Check against user error patterns
  for (const [errorType, data] of Object.entries(USER_ERROR_PATTERNS)) {
    const matchCount = data.keywords.filter(k => lowerText.includes(k)).length;
    if (matchCount >= 1) {
      return {
        isUserError: true,
        errorType,
        solution: data.solution,
        confidence: matchCount >= 2 ? 'high' : 'medium'
      };
    }
  }
  
  // Check for clear technical indicators
  const technicalIndicators = [
    'bug', 'broken', 'crash', 'error message', 'doesn\'t work anymore',
    'used to work', 'suddenly stopped', 'after update', '500 error', '404',
    'api error', 'server error', 'database', 'code', 'console error'
  ];
  
  const technicalScore = technicalIndicators.filter(i => lowerText.includes(i)).length;
  
  // Use AI for ambiguous cases
  if (technicalScore === 0 && !analysis.bestMatch) {
    const aiTriage = await aiTriageIssue(text);
    if (aiTriage) return aiTriage;
  }
  
  // Default to technical if we have a known issue match
  if (analysis.bestMatch) {
    return {
      isUserError: false,
      isTechnical: true,
      matchedIssue: analysis.bestMatch
    };
  }
  
  // Ambiguous - need more info
  return {
    isUserError: false,
    isTechnical: technicalScore > 0,
    needsMoreInfo: true
  };
}

// Use AI to help triage ambiguous issues
async function aiTriageIssue(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null;
  
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a support triage bot for SoulPrint, a personal AI assistant app. 
Analyze the user's issue and determine if it's:
1. USER_ERROR - Something the user can fix themselves (permissions, settings, how-to questions)
2. TECHNICAL_BUG - An actual bug/defect that needs developer attention

Respond ONLY with a JSON object:
{
  "classification": "USER_ERROR" or "TECHNICAL_BUG",
  "confidence": "high", "medium", or "low",
  "reason": "brief explanation",
  "userSolution": "if USER_ERROR, provide step-by-step troubleshooting" 
}`
        },
        {
          role: 'user',
          content: `Triage this issue: "${text}"`
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isUserError: parsed.classification === 'USER_ERROR',
        isTechnical: parsed.classification === 'TECHNICAL_BUG',
        confidence: parsed.confidence,
        reason: parsed.reason,
        solution: parsed.userSolution
      };
    }
  } catch (err) {
    console.error('AI triage error:', err);
  }
  return null;
}

// Follow-up questions to gather more details
const FOLLOW_UP_QUESTIONS = {
  general: [
    "What were you trying to do when this happened?",
    "What device/browser are you using? (e.g., iPhone Safari, Chrome on Windows)",
    "Does this happen every time or only sometimes?",
    "Have you tried any workarounds?"
  ],
  error: [
    "Did you see any error message? If so, what did it say?",
    "What page/screen were you on when the error occurred?",
    "What steps led to this error?"
  ],
  performance: [
    "How long does the slow behavior last?",
    "Is your internet connection stable?",
    "Does it improve after refreshing the page?"
  ],
  feature: [
    "Can you describe the expected behavior vs what you're seeing?",
    "Is this a new issue or has it always been this way?",
    "Are other features working normally?"
  ]
};

// Get or create conversation state
function getConversationState(channelUserId) {
  return supportConversations.get(channelUserId) || null;
}

function setConversationState(channelUserId, state) {
  // Auto-expire after 30 minutes
  state.expiresAt = Date.now() + (30 * 60 * 1000);
  supportConversations.set(channelUserId, state);
  
  // Clean up expired conversations
  const now = Date.now();
  for (const [key, conv] of supportConversations) {
    if (conv.expiresAt < now) {
      supportConversations.delete(key);
    }
  }
}

function clearConversationState(channelUserId) {
  supportConversations.delete(channelUserId);
}

// Determine issue category for targeted questions
function categorizeIssue(text, analysis) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('error') || lowerText.includes('crash') || lowerText.includes('broken') || lowerText.includes('fail')) {
    return 'error';
  }
  if (lowerText.includes('slow') || lowerText.includes('loading') || lowerText.includes('stuck') || lowerText.includes('freeze')) {
    return 'performance';
  }
  if (lowerText.includes('feature') || lowerText.includes('button') || lowerText.includes('option') || lowerText.includes('setting')) {
    return 'feature';
  }
  return 'general';
}

// Generate a restated summary of the issue
function restateIssue(originalMessage, details = {}) {
  let restatement = `Let me make sure I understand correctly:\n\n`;
  restatement += `📝 *You reported:* "${originalMessage}"`;
  
  if (details.device) {
    restatement += `\n📱 *Device/Browser:* ${details.device}`;
  }
  if (details.steps) {
    restatement += `\n🔄 *Steps to reproduce:* ${details.steps}`;
  }
  if (details.errorMessage) {
    restatement += `\n⚠️ *Error message:* ${details.errorMessage}`;
  }
  if (details.frequency) {
    restatement += `\n🔁 *Frequency:* ${details.frequency}`;
  }
  
  return restatement;
}

// Handle incoming Slack messages
async function handleSlackWebhook(request) {
  try {
    const body = await request.json();
    
    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      return ok({ challenge: body.challenge });
    }
    
    // Handle events
    if (body.type === 'event_callback') {
      const event = body.event;
      
      // Ignore bot messages to prevent loops
      if (event.bot_id || event.subtype === 'bot_message') {
        return ok({ ok: true });
      }
      
      // Handle direct messages and mentions
      if (event.type === 'message' || event.type === 'app_mention') {
        const text = event.text || '';
        const channel = event.channel;
        const user = event.user;
        const channelUserId = `${channel}-${user}`;
        
        // Remove bot mention from text
        const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();
        
        // Handle empty messages
        if (!cleanText) {
          await sendSlackMessage(channel, "Hi! I'm the SoulPrint Support Bot. 👋\n\nDescribe any issue you're experiencing with the app and I'll help gather the details to get it resolved quickly.");
          return ok({ ok: true });
        }
        
        // Check for existing conversation
        let convState = getConversationState(channelUserId);
        
        // Handle special commands
        const lowerText = cleanText.toLowerCase();
        if (lowerText === 'reset' || lowerText === 'start over' || lowerText === 'cancel') {
          clearConversationState(channelUserId);
          await sendSlackMessage(channel, "No problem! Let's start fresh. 🔄\n\nWhat issue would you like to report?");
          return ok({ ok: true });
        }
        
        if (lowerText === 'done' || lowerText === 'submit' || lowerText === 'send' || lowerText === 'escalate') {
          if (convState && convState.originalMessage) {
            // User wants to submit what we have
            await handleEscalation(channel, user, convState);
            clearConversationState(channelUserId);
            return ok({ ok: true });
          }
        }
        
        // INITIAL STATE - First message
        if (!convState) {
          const analysis = analyzeIssue(cleanText);
          const category = categorizeIssue(cleanText, analysis);
          
          // First, triage the issue to determine if it's user error or technical
          const triage = await triageIssue(cleanText, analysis);
          
          // If it's clearly a user error, provide immediate assistance
          if (triage.isUserError && triage.solution) {
            // Create conversation state in case user needs follow-up
            convState = {
              state: CONV_STATE.HELPING_USER,
              originalMessage: cleanText,
              analysis,
              category,
              triage,
              details: {},
              messages: [cleanText],
              createdAt: Date.now()
            };
            setConversationState(channelUserId, convState);
            
            const helpResponse = `I think I can help with this! 🤔\n\n${triage.solution}\n\n---\n_If this doesn't solve your problem, reply *"still not working"* or *"need more help"* and I'll escalate to the dev team._`;
            
            await sendSlackMessage(channel, helpResponse);
            return ok({ ok: true });
          }
          
          // If it's technical or needs more info, start gathering details
          convState = {
            state: CONV_STATE.GATHERING_DETAILS,
            originalMessage: cleanText,
            analysis,
            category,
            triage,
            details: {},
            followUpIndex: 0,
            messages: [cleanText],
            createdAt: Date.now()
          };
          
          setConversationState(channelUserId, convState);
          
          // If clearly technical, acknowledge and start gathering info
          if (triage.isTechnical) {
            const restatement = restateIssue(cleanText);
            const questions = FOLLOW_UP_QUESTIONS[category] || FOLLOW_UP_QUESTIONS.general;
            const firstQuestion = questions[0];
            
            const response = `This looks like a technical issue that may need developer attention. 🔧\n\n${restatement}\n\n*To help the team fix this quickly, I need a few details:*\n\n❓ ${firstQuestion}\n\n_(Type "done" anytime to submit your report, or "reset" to start over)_`;
            
            await sendSlackMessage(channel, response);
          } else {
            // Ambiguous - ask clarifying question first
            const response = `Thanks for reaching out! 👋\n\nBefore I can help, I need to understand the issue better:\n\n❓ Is this something that *used to work* and stopped working, or are you *trying to do something for the first time*?\n\nThis helps me know if it's a setup issue I can help with, or a bug that needs the dev team.`;
            
            await sendSlackMessage(channel, response);
          }
          
          return ok({ ok: true });
        }
        
        // HELPING_USER STATE - User received troubleshooting help
        if (convState.state === CONV_STATE.HELPING_USER) {
          const stillNeedsHelp = lowerText.includes('not working') || 
                                 lowerText.includes('still') || 
                                 lowerText.includes('didn\'t help') ||
                                 lowerText.includes('need more help') ||
                                 lowerText.includes('doesn\'t work') ||
                                 lowerText.includes('nope') ||
                                 lowerText.includes('no luck');
          
          const resolved = lowerText.includes('thanks') ||
                          lowerText.includes('worked') ||
                          lowerText.includes('fixed') ||
                          lowerText.includes('solved') ||
                          lowerText.includes('that helped') ||
                          lowerText === 'yes' ||
                          lowerText.includes('perfect');
          
          if (resolved) {
            clearConversationState(channelUserId);
            await sendSlackMessage(channel, "Awesome, glad I could help! 🎉\n\nFeel free to reach out anytime if you have other questions.");
            return ok({ ok: true });
          }
          
          if (stillNeedsHelp) {
            // Escalate to technical flow
            convState.state = CONV_STATE.GATHERING_DETAILS;
            convState.followUpIndex = 0;
            convState.triage.escalatedFromUserHelp = true;
            setConversationState(channelUserId, convState);
            
            const questions = FOLLOW_UP_QUESTIONS[convState.category] || FOLLOW_UP_QUESTIONS.general;
            const firstQuestion = questions[0];
            
            await sendSlackMessage(channel, `No worries, let's get this escalated to the dev team. 🔧\n\n*I'll need a few more details to help them investigate:*\n\n❓ ${firstQuestion}\n\n_(Type "done" anytime to submit your report)_`);
            return ok({ ok: true });
          }
          
          // Ambiguous response - ask for clarification
          await sendSlackMessage(channel, "Did that solve your issue? Reply *\"yes\"* if it's working now, or *\"still not working\"* if you need more help.");
          return ok({ ok: true });
        }
        
        // GATHERING DETAILS STATE - Processing follow-up answers
        if (convState.state === CONV_STATE.GATHERING_DETAILS) {
          const category = convState.category;
          const questions = FOLLOW_UP_QUESTIONS[category] || FOLLOW_UP_QUESTIONS.general;
          
          // Store the answer based on question index
          const questionIndex = convState.followUpIndex;
          convState.messages.push(cleanText);
          
          // Map answers to detail fields
          if (questionIndex === 0) {
            convState.details.context = cleanText; // What they were doing
          } else if (questionIndex === 1) {
            convState.details.device = cleanText; // Device/browser
          } else if (questionIndex === 2) {
            convState.details.frequency = cleanText; // Frequency
          } else if (questionIndex === 3) {
            convState.details.workaround = cleanText; // Workarounds tried
          }
          
          // Move to next question
          convState.followUpIndex++;
          
          // Check if we have more questions
          if (convState.followUpIndex < questions.length) {
            const nextQuestion = questions[convState.followUpIndex];
            setConversationState(channelUserId, convState);
            
            await sendSlackMessage(channel, `Got it, thanks! 📝\n\n❓ ${nextQuestion}\n\n_(Type "done" to submit your report anytime)_`);
            return ok({ ok: true });
          }
          
          // All questions answered - move to confirmation
          convState.state = CONV_STATE.AWAITING_CONFIRMATION;
          setConversationState(channelUserId, convState);
          
          // Show summary and ask for confirmation
          const summary = generateIssueSummary(convState);
          
          const confirmationMsg = `Thanks for all the details! Here's a summary of your report:\n\n${summary}\n\n*Does this look correct?*\n\n• Reply *"yes"* or *"submit"* to send to the team\n• Reply *"no"* or add more details if something's missing\n• Reply *"reset"* to start over`;
          
          await sendSlackMessage(channel, confirmationMsg);
          return ok({ ok: true });
        }
        
        // AWAITING CONFIRMATION STATE
        if (convState.state === CONV_STATE.AWAITING_CONFIRMATION) {
          if (lowerText === 'yes' || lowerText === 'correct' || lowerText === 'looks good' || lowerText === 'submit' || lowerText === 'send') {
            // User confirmed - escalate
            await handleEscalation(channel, user, convState);
            clearConversationState(channelUserId);
            return ok({ ok: true });
          } else if (lowerText === 'no' || lowerText.startsWith('actually') || lowerText.startsWith('also')) {
            // User wants to add more info
            convState.messages.push(cleanText);
            convState.details.additionalInfo = (convState.details.additionalInfo || '') + '\n' + cleanText;
            setConversationState(channelUserId, convState);
            
            await sendSlackMessage(channel, `Got it, I've added that to your report. 📝\n\nAnything else to add? Reply *"submit"* when ready, or keep adding details.`);
            return ok({ ok: true });
          } else {
            // Treat as additional info
            convState.messages.push(cleanText);
            convState.details.additionalInfo = (convState.details.additionalInfo || '') + '\n' + cleanText;
            setConversationState(channelUserId, convState);
            
            await sendSlackMessage(channel, `Added to your report. 📝\n\nReply *"submit"* when ready to send to the team.`);
            return ok({ ok: true });
          }
        }
        
        return ok({ ok: true });
      }
    }
    
    return ok({ ok: true });
  } catch (error) {
    console.error('Slack webhook error:', error);
    return err('Webhook processing failed', 500);
  }
}

// Generate a formatted summary of the issue
function generateIssueSummary(convState) {
  let summary = `📋 *Issue Summary*\n\n`;
  summary += `*Problem:* ${convState.originalMessage}\n`;
  
  if (convState.details.context) {
    summary += `*Context:* ${convState.details.context}\n`;
  }
  if (convState.details.device) {
    summary += `*Device/Browser:* ${convState.details.device}\n`;
  }
  if (convState.details.frequency) {
    summary += `*Frequency:* ${convState.details.frequency}\n`;
  }
  if (convState.details.workaround) {
    summary += `*Workarounds tried:* ${convState.details.workaround}\n`;
  }
  if (convState.details.additionalInfo) {
    summary += `*Additional info:* ${convState.details.additionalInfo.trim()}\n`;
  }
  
  if (convState.analysis?.bestMatch) {
    summary += `\n🔍 *System identified this as:* ${convState.analysis.bestMatch.issue}`;
  }
  
  return summary;
}

// Handle escalation to owner with all gathered details
async function handleEscalation(channel, user, convState) {
  // Send confirmation to user
  await sendSlackMessage(channel, "✅ Your report has been submitted to the team!\n\nSomeone will look into this and you'll be notified when it's resolved. Thanks for helping make SoulPrint better! 🙏");
  
  // Generate AI suggestion with more context
  const aiSuggestion = await generateFixSuggestion(
    `${convState.originalMessage}\n\nContext: ${convState.details.context || 'Not provided'}\nDevice: ${convState.details.device || 'Not provided'}\nFrequency: ${convState.details.frequency || 'Not provided'}`,
    convState.analysis
  );
  
  // Send detailed report to owner
  await sendDetailedAnalysisToOwner(
    convState.originalMessage,
    channel,
    user,
    convState.analysis,
    aiSuggestion,
    convState.details,
    convState.messages
  );
}

// Send detailed analysis to owner with Emergent-ready prompt
async function sendDetailedAnalysisToOwner(originalMessage, channel, reporterUser, analysis, aiSuggestion, details = {}, allMessages = []) {
  if (!SLACK_ESCALATION_USER_ID) return;
  
  // Build the Emergent prompt - this is what gets pasted into Emergent
  let emergentPrompt = `Fix this issue reported by a team member:\n\n`;
  emergentPrompt += `"${originalMessage}"\n\n`;
  
  // Include gathered details
  if (details.context || details.device || details.frequency) {
    emergentPrompt += `Additional context from user:\n`;
    if (details.context) emergentPrompt += `- What they were doing: ${details.context}\n`;
    if (details.device) emergentPrompt += `- Device/Browser: ${details.device}\n`;
    if (details.frequency) emergentPrompt += `- Frequency: ${details.frequency}\n`;
    if (details.workaround) emergentPrompt += `- Workarounds tried: ${details.workaround}\n`;
    if (details.additionalInfo) emergentPrompt += `- Additional info: ${details.additionalInfo.trim()}\n`;
    emergentPrompt += `\n`;
  }
  
  if (analysis.bestMatch) {
    emergentPrompt += `Analysis:\n`;
    emergentPrompt += `- Issue type: ${analysis.bestMatch.issue}\n`;
    emergentPrompt += `- Likely cause: ${analysis.bestMatch.cause}\n`;
    emergentPrompt += `- Suggested fix: ${analysis.bestMatch.solution}\n`;
    emergentPrompt += `- Check file: ${analysis.bestMatch.file}\n`;
    emergentPrompt += `- Function: ${analysis.bestMatch.function}\n\n`;
  }
  
  if (aiSuggestion) {
    emergentPrompt += `AI Recommendation:\n${aiSuggestion}\n\n`;
  }
  
  emergentPrompt += `Please investigate and fix this issue.`;
  
  // Build detail summary for display
  let detailSummary = '';
  if (Object.keys(details).length > 0) {
    detailSummary = `*📋 Gathered Details:*\n`;
    if (details.context) detailSummary += `• *Context:* ${details.context}\n`;
    if (details.device) detailSummary += `• *Device:* ${details.device}\n`;
    if (details.frequency) detailSummary += `• *Frequency:* ${details.frequency}\n`;
    if (details.workaround) detailSummary += `• *Workarounds:* ${details.workaround}\n`;
    if (details.additionalInfo) detailSummary += `• *Extra:* ${details.additionalInfo.trim()}\n`;
  }
  
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎫 New Support Request', emoji: true }
    },
    {
      type: 'section',
      text: { 
        type: 'mrkdwn', 
        text: `*From:* <@${reporterUser}>\n*Channel:* <#${channel}>` 
      }
    },
    {
      type: 'section',
      text: { 
        type: 'mrkdwn', 
        text: `*Original Message:*\n>${originalMessage}` 
      }
    }
  ];
  
  // Add detail summary if we have details
  if (detailSummary) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: detailSummary }
    });
  }
  
  // Add full conversation if available
  if (allMessages.length > 1) {
    blocks.push({
      type: 'section',
      text: { 
        type: 'mrkdwn', 
        text: `*💬 Full Conversation (${allMessages.length} messages):*\n${allMessages.map((m, i) => `${i + 1}. ${m.substring(0, 100)}${m.length > 100 ? '...' : ''}`).join('\n')}` 
      }
    });
  }
  
  blocks.push(
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📋 Paste this into Emergent:*`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `\`\`\`${emergentPrompt}\`\`\``
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Mark Resolved', emoji: true },
          style: 'primary',
          action_id: 'owner_resolved',
          value: JSON.stringify({ channel, user: reporterUser })
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '💬 Reply to User', emoji: true },
          action_id: 'owner_reply',
          value: JSON.stringify({ channel, user: reporterUser })
        }
      ]
    }
  );
  
  await sendSlackMessage(SLACK_ESCALATION_USER_ID, `New support request from <@${reporterUser}>`, blocks);
}

// Handle Slack interactive actions (button clicks)
async function handleSlackInteractive(request) {
  try {
    const formData = await request.formData();
    const payload = JSON.parse(formData.get('payload'));
    
    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      const channel = payload.channel.id;
      const user = payload.user.id;
      
      if (action.action_id === 'owner_resolved') {
        const value = JSON.parse(action.value || '{}');
        // Notify the original reporter that the issue was resolved
        if (value.channel) {
          await sendSlackMessage(value.channel, "✅ Good news! The team has looked into your issue and it's been resolved. Let us know if you have any other questions!");
        }
        await sendSlackMessage(channel, "✅ Marked as resolved. User has been notified.");
      }
      
      if (action.action_id === 'owner_reply') {
        const value = JSON.parse(action.value || '{}');
        await sendSlackMessage(channel, `To reply, go to <#${value.channel}> and message <@${value.user}> directly.`);
      }
    }
    
    return ok({ ok: true });
  } catch (error) {
    console.error('Slack interactive error:', error);
    return ok({ ok: true }); // Always return 200 to Slack
  }
}

// ============================================================
// ROUTER
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'auth/me') return handleMe(request);
    if (pathStr === 'assessment/questions') return handleGetQuestions(request);
    if (pathStr === 'assessment/progress') return handleGetProgress(request);
    if (pathStr === 'assessment/layered/questions') return handleGetLayeredQuestions(request);
    if (pathStr === 'assessment/settings') return handleGetAssessmentSettings(request);
    if (pathStr === 'assessment/validation/next') return handleGetNextValidation(request);
    if (pathStr === 'assessment/gradual/next') return handleGetGradualQuestion(request);
    if (pathStr === 'assessment/gradual/progress') return handleGetAssessmentProgress(request);
    if (pathStr === 'profile/communication') return handleGetCommunicationProfile(request);
    if (pathStr === 'profile/soulprint') return handleGetSoulPrint(request);
    if (pathStr === 'privacy/settings') return handleGetPrivacySettings(request);
    if (pathStr === 'privacy/export') return handleExportUserData(request);
    if (pathStr === 'privacy/data-usage') return handleGetDataUsageSummary(request);
    if (pathStr === 'privacy/sessions') return handleGetSessions(request);
    if (pathStr === 'blog/posts') return handleGetBlogPosts(request);
    if (pathStr.startsWith('blog/posts/')) {
      const slug = pathArr[2];
      return handleGetBlogPost(request, slug);
    }
    if (pathStr === 'admin/blog/posts') return handleAdminGetBlogPosts(request);
    if (pathStr === 'conversations') return handleGetConversations(request);
    if (pathStr === 'messages') return handleGetMessages(request);
    
    // Projects & Tags routes
    if (pathStr === 'projects') return handleGetProjects(request);
    if (pathStr.startsWith('projects/') && pathArr[1] === 'conversations') {
      const projectId = pathArr[0].replace('projects/', '');
      return handleGetProjectConversations(request, pathArr[1]);
    }
    if (pathStr.match(/^projects\/[^\/]+\/conversations$/)) {
      const projectId = pathArr[1];
      return handleGetProjectConversations(request, projectId);
    }
    if (pathStr === 'tags') return handleGetTags(request);
    
    if (pathStr === 'imports') return handleGetImports(request);
    if (pathStr === 'models') return handleGetModels(request);
    if (pathStr.startsWith('generate/video/')) {
      const taskId = pathArr[2];
      return handleVideoStatus(request, taskId);
    }
    if (pathStr === 'telegram/status') return handleTelegramStatus(request);
    if (pathStr === 'telegram/setup') return handleTelegramSetup(request);
    if (pathStr === 'schedules') return handleGetSchedules(request);
    if (pathStr === 'schedules/templates') return ok(SCHEDULE_TEMPLATES);
    if (pathStr === 'memories') return handleGetMemories(request);

    // Admin routes
    if (pathStr === 'admin/users') return handleAdminGetUsers(request);
    if (pathStr === 'admin/users/export') return handleAdminExportUsers(request);
    if (pathStr === 'admin/users/export/filters') return handleAdminGetExportFilters(request);
    if (pathStr === 'admin/metrics') return handleAdminGetMetrics(request);
    if (pathStr === 'admin/questions') return handleAdminGetQuestions(request);
    if (pathStr === 'admin/conversations') return handleAdminGetConversations(request);
    if (pathStr === 'admin/imports') return handleAdminGetImports(request);
    if (pathStr === 'admin/settings') return handleAdminGetSettings(request);
    if (pathStr === 'admin/waitlist') return handleAdminGetWaitlist(request);
    if (pathStr === 'admin/feedback') return handleAdminGetFeedback(request);
    if (pathStr === 'admin/beta-code/stats') return handleAdminGetBetaCodeStats(request);
    if (pathStr === 'admin/beta-groups') return handleAdminGetBetaGroups(request);
    if (pathStr === 'admin/beta-codes') return handleAdminGetBetaCodes(request);
    if (pathStr === 'admin/beta-redemptions') return handleAdminGetBetaRedemptions(request);
    if (pathStr === 'user/location') return handleGetUserLocation(request);
    if (pathStr === 'data-imports') return handleGetDataImports(request);
    if (pathStr === 'profile/export') return handleProfileExport(request);
    if (pathStr === 'profile/soul') return handleGetSoulProfile(request);
    if (pathStr === 'announcements') return handleGetAnnouncements(request);
    if (pathStr === 'admin/announcements') return handleAdminGetAnnouncements(request);
    if (pathStr === 'media/gallery') return handleMediaGallery(request);
    if (pathStr === 'media/status') return handleMediaStatus(request);
    if (pathStr.startsWith('media/status/')) {
      // Support /api/media/status/:taskId format
      const taskId = pathStr.replace('media/status/', '');
      return handleMediaStatusByTaskId(request, taskId);
    }
    if (pathStr === 'media/recommend') return handleMediaRecommend(request);
    if (pathStr === 'imports/status') return handleImportStatus(request);
    if (pathStr === 'pwa/install-status') return handleGetInstallPromptStatus(request);
    
    // Viral invite routes
    if (pathStr === 'invites') return handleGetUserInvites(request);
    if (pathStr === 'admin/invites/stats') return handleAdminGetInviteStats(request);
    if (pathStr === 'admin/insights') return handleAdminGetBusinessInsights(request);
    if (pathStr === 'admin/pricing-features') return handleAdminGetPricingFeatures(request);
    if (pathStr === 'admin/pricing-features/calculate') return handleAdminCalculatePricing(request);

    return err('Not found', 404);
  } catch (error) {
    console.error('GET error:', error);
    return err(error.message, 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Slack webhook endpoints (no auth required)
    if (pathStr === 'slack/webhook') return handleSlackWebhook(request);
    if (pathStr === 'slack/interactive') return handleSlackInteractive(request);
    
    if (pathStr === 'auth/register') return handleRegister(request);
    if (pathStr === 'auth/login') return handleLogin(request);
    if (pathStr === 'auth/firebase') return handleFirebaseAuth(request);
    if (pathStr === 'auth/redeem-code') return handleRedeemBetaCode(request);
    if (pathStr === 'auth/validate-code') return handleValidateBetaCode(request);
    if (pathStr === 'auth/verify-captcha') return handleVerifyCaptcha(request);
    if (pathStr === 'auth/send-verification') return handleSendVerificationEmail(request);
    if (pathStr === 'auth/verify-email') return handleVerifyEmail(request);
    if (pathStr === 'assessment/answer') return handleSubmitAnswer(request);
    if (pathStr === 'assessment/complete') return handleAssessmentComplete(request);
    if (pathStr === 'assessment/layered/answer') return handleSubmitLayeredAnswer(request);
    if (pathStr === 'assessment/layered/complete') return handleCompleteLayeredAssessment(request);
    if (pathStr === 'assessment/validation/submit') return handleLayer3Validation(request);
    if (pathStr === 'conversations') return handleCreateConversation(request);
    
    // Projects & Tags POST routes
    if (pathStr === 'projects') return handleCreateProject(request);
    if (pathStr === 'projects/join') return handleJoinProject(request);
    if (pathStr.match(/^projects\/[^\/]+\/share$/)) {
      const projectId = pathArr[1];
      return handleShareProject(request, projectId);
    }
    if (pathStr.match(/^projects\/[^\/]+\/unshare$/)) {
      const projectId = pathArr[1];
      return handleUnshareProject(request, projectId);
    }
    if (pathStr.match(/^projects\/[^\/]+\/share-link$/)) {
      const projectId = pathArr[1];
      return handleProjectShareLink(request, projectId);
    }
    if (pathStr.match(/^conversations\/[^\/]+\/project$/)) {
      const conversationId = pathArr[1];
      return handleMoveConversationToProject(request, conversationId);
    }
    if (pathStr.match(/^conversations\/[^\/]+\/tags$/)) {
      const conversationId = pathArr[1];
      return handleUpdateConversationTags(request, conversationId);
    }
    if (pathStr === 'tags') return handleCreateTag(request);
    
    if (pathStr === 'chat/stream') return handleChatStream(request);
    if (pathStr === 'chat/compare') return handleChatCompare(request);
    if (pathStr === 'chat/compare/select') return handleCompareSelect(request);
    if (pathStr === 'feedback') return handleSubmitFeedback(request);
    if (pathStr === 'user-feedback') return handleSubmitUserFeedback(request);
    if (pathStr === 'generate/image') return handleGenerateImage(request);
    if (pathStr === 'generate/image-kie') return handleGenerateImageKie(request);
    if (pathStr === 'generate/video') return handleGenerateVideo(request);
    if (pathStr === 'media/generate') return handleMediaGenerate(request);
    if (pathStr === 'imports/upload') return handleImportUpload(request);
    if (pathStr === 'imports/cloud') return handleCloudImport(request);
    if (pathStr === 'imports/cloud-batch') return handleCloudBatchImport(request);
    if (pathStr === 'imports/direct') return handleDirectUpload(request);
    if (pathStr === 'imports/chunked/init') return handleChunkedInit(request);
    if (pathStr === 'imports/chunked/chunk') return handleChunkedChunk(request);
    if (pathStr === 'imports/chunked/process-batch') return handleChunkedProcessBatch(request);
    if (pathStr === 'imports/extracted') return handleImportExtracted(request);
    if (pathStr === 'transcribe') return handleTranscribe(request);
    if (pathStr === 'telegram/link') return handleTelegramLink(request);
    if (pathStr === 'telegram/setup') return handleTelegramSetup(request);
    if (pathStr === 'telegram/model') return handleTelegramSetModel(request);
    if (pathStr === 'connectors/telegram/webhook') return handleTelegramWebhook(request);
    if (pathStr === 'schedules') return handleCreateSchedule(request);
    if (pathStr === 'cron/run-schedules') return handleRunSchedules(request);
    if (pathStr === 'places/search') return handlePlacesSearch(request);
    if (pathStr === 'profile/soulprint/generate') return handleGenerateSoulPrint(request);
    if (pathStr === 'privacy/purge-chats') return handlePurgeChatHistory(request);
    if (pathStr === 'privacy/purge-imports') return handlePurgeImportedData(request);
    if (pathStr === 'privacy/settings') return handleUpdatePrivacySettings(request);
    if (pathStr === 'privacy/delete-account') return handleDeleteUserData(request);
    if (pathStr === 'privacy/revoke-session') return handleRevokeSession(request);
    if (pathStr === 'places/geocode') return handleGeocode(request);
    if (pathStr === 'user/location') return handleSaveUserLocation(request);
    if (pathStr === 'data-import/upload') return handleDataImportUpload(request);
    if (pathStr === 'data-import/chunked/init') return handleChunkedUploadInit(request);
    if (pathStr === 'data-import/chunked/chunk') return handleChunkedUploadChunk(request);
    if (pathStr === 'data-import/chunked/complete') return handleChunkedUploadComplete(request);
    if (pathStr === 'assessment/reset') return handleResetAssessment(request);
    if (pathStr === 'memories') return handleCreateMemory(request);
    if (pathStr === 'contact') return handleContactForm(request);

    // Admin routes
    if (pathStr === 'admin/questions/seed') return handleAdminSeedQuestions(request);
    if (pathStr === 'admin/invite') return handleAdminInviteAdmin(request);
    if (pathStr === 'admin/users') return handleAdminCreateUser(request);
    if (pathStr === 'admin/settings') return handleAdminUpdateSettings(request);
    if (pathStr === 'admin/waitlist/approve') return handleAdminApproveWaitlist(request);
    if (pathStr === 'admin/feedback/summarize') return handleAdminSummarizeFeedback(request);
    if (pathStr === 'admin/announcements') return handleAdminCreateAnnouncement(request);
    if (pathStr === 'admin/blog/posts') return handleAdminCreateBlogPost(request);
    if (pathStr === 'admin/beta-code') return handleAdminCreateBetaCode(request);
    if (pathStr === 'admin/beta-code/send') return handleAdminSendBetaCode(request);
    if (pathStr === 'admin/beta-groups') return handleAdminCreateBetaGroup(request);
    if (pathStr === 'admin/beta-codes') return handleAdminCreateBetaCodes(request);
    if (pathStr === 'beta-code/validate-v2') return handleValidateBetaCodeV2(request);
    if (pathStr === 'announcements/dismiss') return handleDismissAnnouncement(request);
    if (pathStr === 'announcements/click') return handleAnnouncementClick(request);
    if (pathStr === 'announcements/restore') return handleRestoreAnnouncement(request);
    if (pathStr === 'pwa/install-status') return handleUpdateInstallPromptStatus(request);
    if (pathStr === 'telegram/setup') return handleTelegramSetup(request);
    if (pathStr === 'assessment/gradual/answer') return handleSubmitGradualAnswer(request);
    if (pathStr === 'assessment/gradual/skip') return handleSkipGradualQuestion(request);
    
    // Viral invite routes
    if (pathStr === 'invites/validate') return handleValidateInviteCode(request);
    if (pathStr === 'invites/redeem') return handleRedeemInviteCode(request);
    if (pathStr === 'admin/invites/toggle') return handleAdminToggleViralInvites(request);
    if (pathStr === 'admin/invites/grant') return handleAdminGrantInvites(request);
    if (pathStr === 'admin/pricing-features') return handleAdminAddPricingFeature(request);
    if (pathStr === 'admin/pricing-features/update') return handleAdminUpdatePricingFeature(request);

    // Other connector stubs
    if (pathStr === 'connectors/discord/webhook') return handleConnectorStub('discord');
    if (pathStr === 'connectors/whatsapp/webhook') return handleConnectorStub('whatsapp');
    if (pathStr === 'connectors/sms/webhook') return handleConnectorStub('sms');

    return err('Not found', 404);
  } catch (error) {
    console.error('POST error:', error);
    return err(error.message, 500);
  }
}

export async function PUT(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'profile') return handleProfileUpdate(request);
    if (pathStr === 'telegram/model') return handleTelegramSetModel(request);
    
    // Conversation project move: conversations/:id/project
    if (pathStr.match(/^conversations\/[^\/]+\/project$/)) {
      const conversationId = pathArr[1];
      return handleMoveConversationToProject(request, conversationId);
    }
    
    // Conversation rename: conversations/:id
    if (pathStr.startsWith('conversations/') && pathArr.length === 2) {
      const conversationId = pathArr[1];
      return handleRenameConversation(request, conversationId);
    }
    if (pathStr.startsWith('schedules/') && pathArr.length === 2) {
      const taskId = pathArr[1];
      return handleUpdateSchedule(request, taskId);
    }
    if (pathStr.startsWith('memories/') && pathArr.length === 2) {
      const memoryId = pathArr[1];
      return handleUpdateMemory(request, memoryId);
    }

    // Admin user update: admin/users/:id
    if (pathStr.startsWith('admin/users/') && pathStr.endsWith('/accept')) {
      const userId = pathArr[2];
      return handleAdminUpdateUser(request, userId);
    }
    if (pathStr.startsWith('admin/users/') && pathStr.endsWith('/reset-passcode')) {
      const userId = pathArr[2];
      return handleAdminResetPasscode(request, userId);
    }
    if (pathStr.startsWith('admin/users/')) {
      const userId = pathArr[2];
      return handleAdminUpdateUser(request, userId);
    }
    if (pathStr.startsWith('admin/questions/')) {
      const questionId = pathArr[2];
      return handleAdminUpdateQuestion(request, questionId);
    }
    if (pathStr.startsWith('admin/feedback/') && pathArr.length === 3) {
      const feedbackId = pathArr[2];
      return handleAdminUpdateFeedback(request, feedbackId);
    }
    if (pathStr.startsWith('admin/announcements/') && pathArr.length === 3) {
      const announcementId = pathArr[2];
      return handleAdminUpdateAnnouncement(request, announcementId);
    }
    if (pathStr.startsWith('admin/blog/posts/') && pathArr.length === 4) {
      const postId = pathArr[3];
      return handleAdminUpdateBlogPost(request, postId);
    }
    if (pathStr === 'admin/beta-codes') return handleAdminUpdateBetaCode(request);
    
    // Project update: projects/:id
    if (pathStr.startsWith('projects/') && pathArr.length === 2) {
      const projectId = pathArr[1];
      return handleUpdateProject(request, projectId);
    }

    return err('Not found', 404);
  } catch (error) {
    console.error('PUT error:', error);
    return err(error.message, 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Conversation delete: conversations/:id
    if (pathStr.startsWith('conversations/') && pathArr.length === 2) {
      const conversationId = pathArr[1];
      return handleDeleteConversation(request, conversationId);
    }
    if (pathStr.startsWith('schedules/') && pathArr.length === 2) {
      const taskId = pathArr[1];
      return handleDeleteSchedule(request, taskId);
    }
    if (pathStr.startsWith('memories/') && pathArr.length === 2) {
      const memoryId = pathArr[1];
      return handleDeleteMemory(request, memoryId);
    }
    if (pathStr.startsWith('data-imports/') && pathArr.length === 2) {
      const importId = pathArr[1];
      return handleDeleteDataImport(request, importId);
    }
    if (pathStr.startsWith('admin/announcements/') && pathArr.length === 3) {
      const announcementId = pathArr[2];
      return handleAdminDeleteAnnouncement(request, announcementId);
    }
    if (pathStr.startsWith('admin/users/') && pathArr.length === 3) {
      const userId = pathArr[2];
      return handleAdminDeleteUser(request, userId);
    }
    if (pathStr.startsWith('admin/blog/posts/') && pathArr.length === 4) {
      const postId = pathArr[3];
      return handleAdminDeleteBlogPost(request, postId);
    }
    if (pathStr === 'admin/beta-code') return handleAdminDeleteBetaCode(request);
    if (pathStr === 'admin/beta-groups') return handleAdminDeleteBetaGroup(request);
    if (pathStr === 'admin/beta-codes') return handleAdminDeleteBetaCodeV2(request);
    if (pathStr === 'admin/pricing-features') return handleAdminDeletePricingFeature(request);
    
    // Projects & Tags delete routes
    if (pathStr.startsWith('projects/') && pathArr.length === 2) {
      const projectId = pathArr[1];
      return handleDeleteProject(request, projectId);
    }
    if (pathStr.startsWith('tags/') && pathArr.length === 2) {
      const tagId = pathArr[1];
      return handleDeleteTag(request, tagId);
    }
    
    // Media gallery delete: media/:id
    if (pathStr.startsWith('media/') && pathArr.length === 2) {
      const mediaId = pathArr[1];
      return handleDeleteMedia(request, mediaId);
    }
    return err('Not found', 404);
  } catch (error) {
    console.error('DELETE error:', error);
    return err(error.message, 500);
  }
}
