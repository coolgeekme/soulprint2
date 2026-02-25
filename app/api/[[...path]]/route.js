import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { generateToken, verifyToken, hashPassword, comparePassword, getTokenFromRequest } from '@/lib/auth';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import path from 'path';
import fs from 'fs';
import { writeFile, mkdir, rm } from 'fs/promises';

// Configure route for large file uploads (App Router style)
export const maxDuration = 60; // 60 seconds max for this route
export const dynamic = 'force-dynamic';

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
  if (parsedData.source === 'chatgpt') {
    sampleText = parsedData.sampleMessages.slice(0, 50).join('\n---\n');
  } else if (parsedData.source === 'facebook') {
    const msgTexts = parsedData.sampleMessages.slice(0, 30).map(m => m.text).join('\n---\n');
    const postTexts = parsedData.samplePosts.slice(0, 20).join('\n---\n');
    sampleText = `MESSAGES:\n${msgTexts}\n\nPOSTS:\n${postTexts}`;
  }
  
  if (!sampleText || sampleText.length < 100) {
    return { error: 'Not enough data to analyze' };
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
  cinema: 'movie_theater',
  theater: 'movie_theater',
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
    const mapsLink = `https://www.google.com/maps/place/?q=place_id:${p.placeId}`;
    
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

// Build system prompt for chat
async function buildSystemPrompt(db, userId) {
  const user = await db.collection('users').findOne({ id: userId });
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: userId });
  const answers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .sort({ created_at: 1 })
    .toArray();

  const assistantName = profile?.assistant_name || 'SoulPrint';
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const descriptors = profile?.descriptors || [];
  const field = profile?.field || '';
  const helpWith = profile?.help_with || [];

  // Build assessment context from answers
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

  return `You are **${assistantName}**, a personal AI companion for **${displayName}**.

# User Profile

## Basic Info
- **Name**: ${displayName}
- **Role**: ${descriptors.join(', ') || 'Not specified'}
- **Field**: ${field || 'Not specified'}
- **Needs help with**: ${helpWith.join(', ') || 'General assistance'}
${assessmentContext}
${soulProfileContext}

# Communication Guidelines

Based on ${displayName}'s profile, follow these guidelines:

1. **Tone & Style**: Match their communication style - ${soulProfile?.insights?.communicationStyle ? 'adapt to their preferred formality and verbosity as noted above' : 'be conversational but professional'}
2. **Vocabulary**: ${soulProfile?.insights?.vocabulary ? 'Use vocabulary complexity that matches their style' : 'Use clear, accessible language'}
3. **Personalization**: Address them by name naturally, reference their interests when relevant
4. **Directness**: Be direct and insightful - they value substance over fluff
5. **Context**: Remember conversation history and build on previous discussions
6. **Brevity**: Keep responses concise unless depth is specifically needed or requested

You are ${displayName}'s intelligent companion - be genuinely helpful, remember what matters to them, and adapt your communication to feel natural and personalized.`;
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
  { pillar: 'decision_making', order_index: 15, question_text: 'Describe how you handle situations where there is no clearly right answer.' },
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

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role,
    accepted: role === 'superadmin',
    created_at: now,
    last_active_at: now,
    access_code_used: access_code || null,
  });

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
  return ok({ token, userId, role, accepted: role === 'superadmin' });
}

// AUTH - Login
async function handleLogin(request) {
  const body = await request.json();
  const { email, passcode } = body;
  if (!email || !passcode) return err('Email and passcode required');

  const db = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return err('User not found', 404);  // distinct from wrong password

  const valid = await comparePassword(passcode, user.passcode_hash);
  if (!valid) return err('Invalid credentials', 401);

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
    } : null,
  });
}

// PROFILE - Update
async function handleProfileUpdate(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { display_name, descriptors, field, help_with, discovery_source, assistant_name, onboarding_complete } = body;

  const db = await getDb();
  const update = {};
  if (display_name !== undefined) update.display_name = display_name;
  if (descriptors !== undefined) update.descriptors = descriptors;
  if (field !== undefined) update.field = field;
  if (help_with !== undefined) update.help_with = help_with;
  if (discovery_source !== undefined) update.discovery_source = discovery_source;
  if (assistant_name !== undefined) update.assistant_name = assistant_name;
  if (onboarding_complete !== undefined) update.onboarding_complete = onboarding_complete;

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

  const db = await getDb();
  const conversations = await db.collection('conversations')
    .find({ user_id: user.id })
    .sort({ updated_at: -1 })
    .limit(50)
    .toArray();

  return ok(conversations.map(c => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    updated_at: c.updated_at,
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

// MESSAGES - Get by conversationId
async function handleGetMessages(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) return err('conversationId required');

  const db = await getDb();
  // Verify conversation belongs to user
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

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
  })));
}

// ── In-memory caches (per process) ───────────────────────────────────────────
const _systemPromptCache = new Map(); // userId → { prompt, ts }
const _rateLimitCache    = new Map(); // userId → { count, windowStart }

// ── Rate Limiter ──────────────────────────────────────────────────────────────
function checkRateLimit(userId, maxPerHour = 80) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = _rateLimitCache.get(userId) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count++;
  }
  _rateLimitCache.set(userId, entry);
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

  if (!user.accepted && user.role === 'user') {
    return err('Account pending approval', 403);
  }

  const body = await request.json();
  const {
    conversationId, content, model = 'gpt-4o',
    provider: providerNameRaw = null,
    attachments = [],   // [{ type: 'image'|'document', base64: '...', mimeType: '...', name: '...', text: '...' }]
    enableWebSearch = true,
  } = body;
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
  if (checkRateLimit(user.id)) {
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
    const lower = text.toLowerCase();
    // Video detection (check first — more specific)
    const videoPatterns = [
      /\bgenerate\s+(?:a\s+)?video\b/i, /\bcreate\s+(?:a\s+)?video\b/i,
      /\bmake\s+(?:a\s+)?video\b/i, /\bvideo\s+of\b/i,
      /\banimate\b/i, /\banimation\s+of\b/i, /\bshort\s+(?:film|clip)\b/i,
      /\bgenerate\s+(?:a\s+)?clip\b/i,
    ];
    if (videoPatterns.some(p => p.test(lower))) return 'video';
    // Image detection
    const imagePatterns = [
      /\bgenerate\s+(?:an?\s+)?image\b/i, /\bcreate\s+(?:an?\s+)?image\b/i,
      /\bmake\s+(?:an?\s+)?image\b/i, /\bdraw\s+(?:an?\s+|me\s+)?/i,
      /\bpicture\s+of\b/i, /\bphoto\s+of\b/i, /\billustration\s+of\b/i,
      /\bgenerate\s+(?:an?\s+)?illustration\b/i, /\bcreate\s+(?:an?\s+)?picture\b/i,
      /\bgenerate\s+art\b/i, /\bcreate\s+art\b/i, /\bshow\s+me\s+(?:an?\s+)?image\b/i,
      /\bpaint\s+(?:me\s+)?(?:an?\s+)?/i, /\bvisualize\b/i,
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
        // Send meta first
        send({ type: 'meta', conversationId: convId, messageId: assistantMsgId });

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
          send({ type: 'delta', content: '🎬 Starting video generation with Runway (via Kie.ai)...\n\n' });
          try {
            const kieKey = process.env.KIE_API_KEY;
            const vidRes = await fetch('https://api.kie.ai/api/v1/runway/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
              body: JSON.stringify({ prompt: content, duration: 5, quality: '720p', aspectRatio: '16:9', waterMark: '' }),
            });
            const vidData = await vidRes.json();
            if (vidData.code !== 200) throw new Error(vidData.msg || 'Video generation failed');
            const taskId = vidData.data?.taskId;

            // Save job to DB
            await db.collection('video_jobs').insertOne({
              id: uuidv4(), task_id: taskId, user_id: user.id,
              prompt: content, duration: 5, quality: '720p', aspect_ratio: '16:9',
              status: 'generating', conversation_id: convId,
              created_at: new Date(), expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            });

            fullContent = `🎬 **Video generation started!**\n\nYour video is being generated by Runway AI. This usually takes 1-3 minutes.\n\n**Task ID:** \`${taskId}\`\n\n*I'll let you know when it's ready, or you can check the status in the video player below.*`;
            send({ type: 'video_task', taskId, status: 'generating', prompt: content });
            send({ type: 'delta', content: fullContent });
          } catch (vidErr) {
            fullContent = `Sorry, video generation failed: ${vidErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          await db.collection('messages').insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'runway', provider_used: 'kie.ai', content_type: 'video',
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
          return /\b(find|where|what|show me|looking for|recommend|suggest)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|hospitals?|gyms?|banks?|atms?|groceries?|stores?|malls?|parks?|museums?|movies?|theaters?|parking|airports?)\b/i.test(text)
            || /\b(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|gyms?|banks?|parks?|stores?)\s+(near|in|around|close to)\b/i.test(text)
            || /\b(what('s| is)|where('s| is|are)).*(near me|nearby|around here|close by)\b/i.test(lower)
            || /\bnearby\s+(restaurants?|cafes?|bars?|hotels?|stores?|places?)/i.test(lower);
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
                const mapsLink = `https://www.google.com/maps/place/?q=place_id:${p.placeId}`;
                
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

        // If search was done, notify client
        if (didSearch && searchMeta.length > 0) {
          send({ type: 'search', queries: searchMeta.map(s => s.query) });
        }

        for await (const chunk of aiStream) {
          // Providers yield plain strings
          if (chunk) {
            fullContent += chunk;
            send({ type: 'delta', content: chunk });
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
          est_input_tokens: estInputTokens,
          est_output_tokens: estOutputTokens,
        });

        await db.collection('conversations').updateOne(
          { id: convId }, { $set: { updated_at: new Date() } }
        );

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

// VIDEO GENERATION - Kie.ai Runway
async function handleGenerateVideo(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { prompt, duration = 5, quality = '720p', aspectRatio = '16:9', conversationId } = body;
  if (!prompt) return err('prompt required');

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  try {
    const res = await fetch('https://api.kie.ai/api/v1/runway/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
      body: JSON.stringify({ prompt, duration, quality, aspectRatio, waterMark: '' }),
    });
    const data = await res.json();
    if (data.code !== 200) return err(data.msg || 'Video generation failed', 400);

    const taskId = data.data?.taskId;
    if (!taskId) return err('No task ID returned', 500);

    // Store task in DB
    const db = await getDb();
    const jobId = uuidv4();
    await db.collection('video_jobs').insertOne({
      id: jobId, task_id: taskId, user_id: user.id,
      prompt, duration, quality, aspect_ratio: aspectRatio,
      status: 'generating',
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
  const job = await db.collection('video_jobs').findOne({ task_id: taskId, user_id: user.id });
  if (!job) return err('Job not found', 404);

  // If already complete, return cached result
  if (job.status === 'success') {
    return ok({ status: 'success', videoUrl: job.video_url, thumbnailUrl: job.thumbnail_url, prompt: job.prompt });
  }
  if (job.status === 'failed') {
    return ok({ status: 'failed', error: job.error });
  }

  // Poll Kie.ai using the correct runway/record-detail endpoint
  const kieKey = process.env.KIE_API_KEY;
  try {
    const res = await fetch(`https://api.kie.ai/api/v1/runway/record-detail?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    const data = await res.json();
    if (data.code !== 200) return err(data.msg || 'Status check failed', 400);

    const state = data.data?.state;
    const videoInfo = data.data?.videoInfo || {};
    const videoUrl = videoInfo.videoUrl || null;
    const thumbnailUrl = videoInfo.imageUrl || null;

    if (state === 'success' && videoUrl) {
      await db.collection('video_jobs').updateOne({ task_id: taskId }, {
        $set: { status: 'success', video_url: videoUrl, thumbnail_url: thumbnailUrl, completed_at: new Date() },
      });
      // If linked to conversation, save as message
      if (job.conversation_id) {
        await db.collection('messages').insertOne({
          id: uuidv4(), conversation_id: job.conversation_id, user_id: user.id,
          role: 'assistant',
          content: `🎬 **Video generated!**\n\n**Prompt:** ${job.prompt}\n\n[▶ Download / View Video](${videoUrl})${thumbnailUrl ? `\n\n![Thumbnail](${thumbnailUrl})` : ''}`,
          content_type: 'video',
          video_url: videoUrl,
          created_at: new Date(),
          model_used: 'runway',
          provider_used: 'kie.ai',
        });
      }
      return ok({ status: 'success', videoUrl, thumbnailUrl, prompt: job.prompt });
    } else if (state === 'fail') {
      const errMsg = data.data?.failMsg || 'Generation failed';
      await db.collection('video_jobs').updateOne({ task_id: taskId }, {
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

// FEEDBACK - Submit
async function handleSubmitFeedback(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { conversation_id, message_id, rating, note } = body;

  const db = await getDb();
  await db.collection('feedback').insertOne({
    id: uuidv4(),
    user_id: user.id,
    conversation_id,
    message_id,
    rating,
    note: note || '',
    created_at: new Date(),
  });

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

  const db = await getDb();
  const query = search
    ? { email: { $regex: search, $options: 'i' } }
    : {};

  const total = await db.collection('users').countDocuments(query);
  const users = await db.collection('users')
    .find(query)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  const profiles = await db.collection('profiles')
    .find({ user_id: { $in: users.map(u => u.id) } })
    .toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  return ok({
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      accepted: u.accepted,
      created_at: u.created_at,
      last_active_at: u.last_active_at,
      display_name: profileMap[u.id]?.display_name || '',
      assessment_complete: profileMap[u.id]?.assessment_complete || false,
      onboarding_complete: profileMap[u.id]?.onboarding_complete || false,
    })),
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

  const update = {};
  if (body.accepted !== undefined) update.accepted = body.accepted;
  if (body.role !== undefined) {
    // Only superadmin can change roles
    if (admin.role !== 'superadmin') return err('Only superadmin can change roles', 403);
    update.role = body.role;
  }

  await db.collection('users').updateOne({ id: userId }, { $set: update });

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: body.accepted !== undefined ? (body.accepted ? 'accept_user' : 'reject_user') : 'update_role',
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
    await db.collection('users').updateMany({ accepted: false }, { $set: { accepted: true } });
    return ok({ success: true, message: 'All waitlisted users approved' });
  }

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return err('user_ids array required');
  }

  await db.collection('users').updateMany(
    { id: { $in: user_ids } },
    { $set: { accepted: true } }
  );

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
    'gpt-4o':                        { input: 5.00,  output: 15.00 },
    'gpt-4o-mini':                   { input: 0.15,  output: 0.60  },
    'gpt-4.1':                       { input: 2.00,  output: 8.00  },
    'gpt-4.1-mini':                  { input: 0.40,  output: 1.60  },
    'claude-opus-4-5-20251101':      { input: 15.00, output: 75.00 },
    'claude-sonnet-4-5-20250929':    { input: 3.00,  output: 15.00 },
    'claude-3-5-haiku-20241022':     { input: 0.80,  output: 4.00  },
    'gemini-2.5-pro':                { input: 1.25,  output: 10.00 },
    'gemini-2.0-flash':              { input: 0.075, output: 0.30  },
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
  const avgCostPerMsg = totalMessages > 0 ? totalEstCost / totalMessages : 0;
  const projectedMonthlyCost = totalMessagesLast30d * avgCostPerMsg;
  const costPerUserPerMonth = acceptedUsers > 0
    ? parseFloat((projectedMonthlyCost / acceptedUsers).toFixed(4))
    : 0;

  return ok({
    wau: wauUsers,
    total_users: totalUsers,
    accepted_users: acceptedUsers,
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
    thumbs_up: thumbsUp,
    thumbs_down: thumbsDown,
    // Cost metrics
    est_total_cost: parseFloat(totalEstCost.toFixed(4)),
    est_cost_per_user_month: costPerUserPerMonth,
    est_projected_monthly_cost: parseFloat(projectedMonthlyCost.toFixed(4)),
    cost_by_model: costByModel,
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
        '🟢 *OpenAI*: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`',
        '🟣 *Claude*: `claude-sonnet-4-5-20250929`, `claude-3-5-haiku-20241022`',
        '🔵 *Gemini*: `gemini-2.0-flash`, `gemini-2.5-pro`',
        '🌐 *Perplexity (online)*: `sonar`, `sonar-pro`',
        '🟡 *Kimi*: `kimi-k2-0711-preview`, `moonshot-v1-32k`',
      ].join('\n');
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `🤖 *Current AI model:* \`${currentModel}\`\n\nAvailable models:\n${modelList}\n\nTo switch: \`/model gpt-4o\` or \`/model sonar\`\n\n💡 Perplexity sonar models have *built-in real-time search*!`
      );
      return ok({ ok: true });
    }

    // Switch model
    const newModel = parts[1].trim().toLowerCase();
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

  // ── /video command — generate video with Kie.ai Runway ───────────────────────
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
      `🎬 *Starting video generation...*\n\n_"${prompt.substring(0, 150)}"_\n\nThis takes 1-3 minutes. I'll send the video when it's ready!`
    );
    try {
      const kieKey = process.env.KIE_API_KEY;
      const vidRes = await fetch('https://api.kie.ai/api/v1/runway/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
        body: JSON.stringify({ prompt, duration: 5, quality: '720p', aspectRatio: '16:9', waterMark: '' }),
      });
      const vidData = await vidRes.json();
      if (vidData.code !== 200) throw new Error(vidData.msg || 'Video generation failed');
      const taskId = vidData.data?.taskId;

      // Poll for completion (up to 5 minutes) using correct endpoint
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 10000)); // wait 10s
        attempts++;
        const pollRes = await fetch(`https://api.kie.ai/api/v1/runway/record-detail?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${kieKey}` },
        });
        const pollData = await pollRes.json();
        const state = pollData.data?.state;
        const videoInfo = pollData.data?.videoInfo || {};
        const videoUrl = videoInfo.videoUrl;
        const thumbnailUrl = videoInfo.imageUrl;

        if (state === 'success' && videoUrl) {
          // Send the actual video file to Telegram (not just a link)
          await sendTelegramVideo(chatId, TELEGRAM_BOT_TOKEN, videoUrl,
            `🎬 *Your video is ready!*\n\n_"${prompt.substring(0, 200)}"_`
          );
          break;
        } else if (state === 'fail') {
          const errMsg = pollData.data?.failMsg || 'Unknown error';
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
      `*Misc*\n/start — Link your account\n/help — This menu`
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
  if (checkRateLimit(userId, 60)) {
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
  const preferredModel = mapping.preferred_model || 'gpt-4o';
  const preferredProvider = mapping.preferred_provider || 'openai';

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
  const isPlacesRequest = /\b(find|where|what|show me|looking for|recommend|suggest)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|hospitals?|gyms?|banks?|atms?|groceries?|stores?|malls?|parks?|museums?|movies?|theaters?|parking|airports?)\b/i.test(sanitizedText)
    || /\b(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|gyms?|banks?|parks?|stores?)\s+(near|in|around|close to)\b/i.test(sanitizedText)
    || /\b(what('s| is)|where('s| is|are)).*(near me|nearby|around here|close by)\b/i.test(lowerText);

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
          `🎬 *Starting video generation...*\n\nThis takes 1-3 minutes. I'll send it when ready!\n_"${prompt.substring(0, 150)}"_`
        );
        const kieKey = process.env.KIE_API_KEY;
        const vidRes = await fetch('https://api.kie.ai/api/v1/runway/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify({ prompt, duration: 5, quality: '720p', aspectRatio: '16:9', waterMark: '' }),
        });
        const vidData = await vidRes.json();
        if (vidData.code !== 200) throw new Error(vidData.msg || 'Video generation failed');
        const taskId = vidData.data?.taskId;
        // Poll for completion using correct endpoint
        let attempts = 0;
        while (attempts < 30) {
          await new Promise(r => setTimeout(r, 10000));
          attempts++;
          const pollRes = await fetch(`https://api.kie.ai/api/v1/runway/record-detail?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${kieKey}` },
          });
          const pollData = await pollRes.json();
          const state = pollData.data?.state;
          const videoInfo = pollData.data?.videoInfo || {};
          const videoUrl = videoInfo.videoUrl;
          const thumbnailUrl = videoInfo.imageUrl;
          if (state === 'success' && videoUrl) {
            if (thumbnailUrl) await sendTelegramPhoto(chatId, TELEGRAM_BOT_TOKEN, thumbnailUrl, '🎬 *Video ready!*');
            await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
              `🎬 *Your video is ready!*\n[▶️ Watch / Download](${videoUrl})\n_"${prompt.substring(0, 150)}"_`
            );
            break;
          } else if (state === 'fail') {
            const errMsg = pollData.data?.failMsg || 'Unknown error';
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
      // Auto-detect if search is needed and inject context
      const needsSearch = /today|current|latest|news|price|weather|stock|recent|2025|2026|who won|what happened/i.test(text);
      if (needsSearch) {
        const { buildSearchContext: doSearch } = await import('@/lib/llm/providers');
        const ctx = await doSearch(text);
        if (ctx) {
          searchNote = ' 🌐';
          historyMessages = [
            ...historyMessages.slice(0, -1),
            { role: 'user', content: `${ctx}\n\n---\n\nUser question: ${text}` },
          ];
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

    // ── Generate response ───────────────────────────────────────────────────
    const { getProvider: gp } = await import('@/lib/llm/providers');
    const provider = gp(preferredProvider, preferredModel);

    let aiResponse;
    try {
      // Use streaming and collect the full text (works with all providers)
      const { stream } = await provider.generateStream({
        systemPrompt, messages: historyMessages, model: preferredModel,
        temperature: 0.7, enableWebSearch: isPerplexity, // perplexity uses its own search
      });
      let collected = '';
      for await (const chunk of stream) {
        collected += chunk;
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
    });
    await db.collection('conversations').updateOne({ id: conv.id }, { $set: { updated_at: new Date() } });

    // Send reply (split if > 4096 chars) with model indicator
    const modelLabel = `_[${preferredModel}${searchNote}]_\n\n`;
    const fullReply = modelLabel + aiResponse;
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
  
  // Create upload session (chunks stored as separate documents)
  await db.collection('chunked_uploads').insertOne({
    id: uploadId,
    user_id: user.id,
    filename,
    file_size: fileSize,
    source: source || 'unknown',
    total_chunks: totalChunks,
    received_chunks: [],
    status: 'uploading',
    created_at: new Date(),
  });
  
  return ok({ uploadId, message: 'Upload session created' });
}

// Chunked upload: Receive a chunk (store as separate document in MongoDB)
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

    // Store chunk as base64 in a separate document (avoids 16MB limit)
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkBase64 = chunkBuffer.toString('base64');
    
    // Store chunk as separate document
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

// Chunked upload: Complete and process
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

  try {
    // Update status
    await db.collection('chunked_uploads').updateOne(
      { id: uploadId },
      { $set: { status: 'assembling' } }
    );

    // Retrieve and reassemble chunks from MongoDB
    const chunkDocs = await db.collection('upload_chunks')
      .find({ upload_id: uploadId })
      .sort({ chunk_index: 1 })
      .toArray();
    
    if (chunkDocs.length !== upload.total_chunks) {
      throw new Error(`Missing chunks in database: found ${chunkDocs.length} of ${upload.total_chunks}`);
    }
    
    const chunks = chunkDocs.map(doc => Buffer.from(doc.data, 'base64'));
    const completeBuffer = Buffer.concat(chunks);
    
    // Delete chunk documents immediately to free memory
    await db.collection('upload_chunks').deleteMany({ upload_id: uploadId });
    
    // Update status
    await db.collection('chunked_uploads').updateOne(
      { id: uploadId },
      { $set: { status: 'analyzing' } }
    );

    // Parse based on source
    let parsedData;
    if (upload.source === 'chatgpt') {
      parsedData = await parseChatGPTExport(completeBuffer);
    } else if (upload.source === 'facebook') {
      parsedData = await parseFacebookExport(completeBuffer);
    } else {
      // Auto-detect
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(completeBuffer);
      const entries = zip.getEntries().map(e => e.entryName.toLowerCase());
      
      if (entries.some(e => e.includes('conversations.json'))) {
        parsedData = await parseChatGPTExport(completeBuffer);
      } else if (entries.some(e => e.includes('messages/') || e.includes('posts/'))) {
        parsedData = await parseFacebookExport(completeBuffer);
      } else {
        throw new Error('Could not detect data format');
      }
    }

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
        conversationCount: parsedData.conversationCount || 0,
        messageCount: parsedData.userMessageCount || parsedData.messageCount || 0,
        postCount: parsedData.postCount || 0,
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
      throw new Error(analysis.error);
    }

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

    // Invalidate system prompt cache so both web and Telegram get updated profile
    invalidateSystemPromptCache(user.id);

    // Delete chunked upload record
    await db.collection('chunked_uploads').deleteOne({ id: uploadId });

    return ok({
      success: true,
      importId,
      analysis,
      stats: {
        source: parsedData.source,
        conversationsAnalyzed: parsedData.conversationCount || 0,
        messagesAnalyzed: parsedData.userMessageCount || parsedData.messageCount || 0,
        postsAnalyzed: parsedData.postCount || 0,
      }
    });

  } catch (e) {
    console.error('Upload complete error:', e);
    
    // Clean up on error
    await db.collection('upload_chunks').deleteMany({ upload_id: uploadId }).catch(() => {});
    await db.collection('chunked_uploads').updateOne(
      { id: uploadId },
      { $set: { status: 'error', error: e.message } }
    );
    
    return err(`Processing failed: ${e.message}`, 500);
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
// ROUTER
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'auth/me') return handleMe(request);
    if (pathStr === 'assessment/questions') return handleGetQuestions(request);
    if (pathStr === 'assessment/progress') return handleGetProgress(request);
    if (pathStr === 'conversations') return handleGetConversations(request);
    if (pathStr === 'messages') return handleGetMessages(request);
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

    // Admin routes
    if (pathStr === 'admin/users') return handleAdminGetUsers(request);
    if (pathStr === 'admin/metrics') return handleAdminGetMetrics(request);
    if (pathStr === 'admin/questions') return handleAdminGetQuestions(request);
    if (pathStr === 'admin/conversations') return handleAdminGetConversations(request);
    if (pathStr === 'admin/imports') return handleAdminGetImports(request);
    if (pathStr === 'admin/settings') return handleAdminGetSettings(request);
    if (pathStr === 'admin/waitlist') return handleAdminGetWaitlist(request);
    if (pathStr === 'user/location') return handleGetUserLocation(request);
    if (pathStr === 'data-imports') return handleGetDataImports(request);
    if (pathStr === 'profile/export') return handleProfileExport(request);
    if (pathStr === 'profile/soul') return handleGetSoulProfile(request);

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
    if (pathStr === 'auth/register') return handleRegister(request);
    if (pathStr === 'auth/login') return handleLogin(request);
    if (pathStr === 'assessment/answer') return handleSubmitAnswer(request);
    if (pathStr === 'assessment/complete') return handleAssessmentComplete(request);
    if (pathStr === 'conversations') return handleCreateConversation(request);
    if (pathStr === 'chat/stream') return handleChatStream(request);
    if (pathStr === 'feedback') return handleSubmitFeedback(request);
    if (pathStr === 'generate/image') return handleGenerateImage(request);
    if (pathStr === 'generate/image-kie') return handleGenerateImageKie(request);
    if (pathStr === 'generate/video') return handleGenerateVideo(request);
    if (pathStr === 'imports/upload') return handleImportUpload(request);
    if (pathStr === 'transcribe') return handleTranscribe(request);
    if (pathStr === 'telegram/link') return handleTelegramLink(request);
    if (pathStr === 'telegram/setup') return handleTelegramSetup(request);
    if (pathStr === 'telegram/model') return handleTelegramSetModel(request);
    if (pathStr === 'connectors/telegram/webhook') return handleTelegramWebhook(request);
    if (pathStr === 'schedules') return handleCreateSchedule(request);
    if (pathStr === 'cron/run-schedules') return handleRunSchedules(request);
    if (pathStr === 'places/search') return handlePlacesSearch(request);
    if (pathStr === 'places/geocode') return handleGeocode(request);
    if (pathStr === 'user/location') return handleSaveUserLocation(request);
    if (pathStr === 'data-import/upload') return handleDataImportUpload(request);
    if (pathStr === 'data-import/chunked/init') return handleChunkedUploadInit(request);
    if (pathStr === 'data-import/chunked/chunk') return handleChunkedUploadChunk(request);
    if (pathStr === 'data-import/chunked/complete') return handleChunkedUploadComplete(request);
    if (pathStr === 'assessment/reset') return handleResetAssessment(request);

    // Admin routes
    if (pathStr === 'admin/questions/seed') return handleAdminSeedQuestions(request);
    if (pathStr === 'admin/invite') return handleAdminInviteAdmin(request);
    if (pathStr === 'admin/settings') return handleAdminUpdateSettings(request);
    if (pathStr === 'admin/waitlist/approve') return handleAdminApproveWaitlist(request);
    if (pathStr === 'telegram/setup') return handleTelegramSetup(request);

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
    if (pathStr.startsWith('schedules/') && pathArr.length === 2) {
      const taskId = pathArr[1];
      return handleUpdateSchedule(request, taskId);
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
    if (pathStr.startsWith('schedules/') && pathArr.length === 2) {
      const taskId = pathArr[1];
      return handleDeleteSchedule(request, taskId);
    }
    if (pathStr.startsWith('data-imports/') && pathArr.length === 2) {
      const importId = pathArr[1];
      return handleDeleteDataImport(request, importId);
    }
    return err('Not found', 404);
  } catch (error) {
    console.error('DELETE error:', error);
    return err(error.message, 500);
  }
}
