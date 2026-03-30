// Shared utilities for Telegram handler
// Extracted from route.js to avoid circular dependencies

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
function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/ignore\s+(previous|all|above|prior)\s+instructions?/gi, '[input filtered]')
    .replace(/\bDAN\b/g, '[filtered]')
    .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>/g, '')
    .replace(/```\s*(system|instructions?|prompt)\b/gi, '```')
    .substring(0, 8000);
}

// ── Cached System Prompt (5-min TTL) ─────────────────────────────────────────
async function getSystemPrompt(db, userId) {
  const cached = _systemPromptCache.get(userId);
  if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) return cached.prompt;
  const { buildSystemPrompt } = await import('@/lib/handlers/memory-system');
  const prompt = await buildSystemPrompt(db, userId);
  _systemPromptCache.set(userId, { prompt, ts: Date.now() });
  return prompt;
}

function invalidateSystemPromptCache(userId) {
  _systemPromptCache.delete(userId);
}

// ── Smart Mode Models ─────────────────────────────────────────────────────────
const SMART_MODE_MODELS = {
  'sonar-pro': { 
    triggers: ['news', 'today', 'current', 'latest', 'price', 'weather', 'stock', 'live', 'happening now', 'right now', 'tell me about', 'what is', 'who is', 'what can you tell', 'find out about', 'search for', 'look up', 'information about', 'info about', 'details about', 'learn about'],
    capabilities: ['real-time', 'web-search', 'current-events', 'research'],
    provider: 'perplexity'
  },
  'claude-sonnet-4-5-20250929': {
    triggers: ['write', 'story', 'poem', 'creative', 'essay', 'blog', 'article', 'content', 'script', 'novel'],
    capabilities: ['creative-writing', 'long-form', 'nuanced'],
    provider: 'anthropic'
  },
  'gpt-4o': {
    triggers: ['code', 'debug', 'programming', 'function', 'api', 'bug', 'error', 'implement', 'build', 'develop'],
    capabilities: ['coding', 'technical', 'problem-solving'],
    provider: 'openai'
  },
  'claude-opus-4-5-20251101': {
    triggers: ['analyze', 'explain in detail', 'comprehensive', 'research', 'deep dive', 'thorough', 'complex'],
    capabilities: ['deep-reasoning', 'analysis', 'research'],
    provider: 'anthropic'
  },
  'gpt-4o-mini': {
    triggers: ['simple', 'quick', 'basic', 'short', 'brief'],
    capabilities: ['fast', 'cheap', 'simple-queries'],
    provider: 'openai'
  },
  'gemini-2.5-pro': {
    triggers: ['math', 'calculate', 'equation', 'formula', 'logic', 'proof', 'solve'],
    capabilities: ['math', 'logic', 'reasoning'],
    provider: 'gemini'
  },
};

async function classifyQueryForSmartMode(content, conversationHistory = []) {
  const lowerContent = content.toLowerCase();
  
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
  
  if (lowerContent.includes('look at this') || lowerContent.includes('in this image') || lowerContent.includes('analyze this')) {
    return { model: 'gpt-4o', provider: 'openai', reason: 'Vision capabilities needed', confidence: 'high' };
  }
  
  if (content.length > 100) {
    try {
      const { getProvider } = await import('@/lib/llm/providers');
      const classifier = getProvider('openai', 'gpt-4o-mini');
      const classificationPrompt = `Classify this user query and determine the best AI model to use.

Query: "${content.slice(0, 500)}"

Choose the BEST model:
1. sonar-pro (Perplexity) - BEST FOR: Research queries, "what is X", "who is X", current events, news, prices, weather
2. claude-sonnet-4-5-20250929 (Anthropic) - Creative writing, stories, essays
3. gpt-4o (OpenAI) - Code, debugging, technical implementation
4. claude-opus-4-5-20251101 (Anthropic) - Deep analysis, complex reasoning
5. gpt-4o-mini (OpenAI) - Quick simple queries
6. gemini-2.5-pro (Google) - Math, calculations, logical reasoning

IMPORTANT: If the query asks about a company, product, person, or anything needing factual lookup - ALWAYS choose sonar-pro.

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
  
  return { 
    model: 'gpt-4o', 
    provider: 'openai', 
    reason: 'General query - using GPT-4o',
    confidence: 'default'
  };
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

// ── Schedule Templates ────────────────────────────────────────────────────────
const SCHEDULE_TEMPLATES = [
  { id: 'ai_news',    name: '🤖 AI News Digest',     prompt: 'Summarize the top 5 most important AI and machine learning stories from the last 24 hours.' },
  { id: 'world_news', name: '🌍 World News Brief',    prompt: 'What are the top 5 most important world news stories from the last 24 hours?' },
  { id: 'market',     name: '📈 Market Summary',      prompt: 'Give me a summary of today\'s financial markets.' },
  { id: 'tech_news',  name: '💻 Tech News',           prompt: 'What are the most significant technology news stories from the last 24 hours?' },
  { id: 'crypto',     name: '₿ Crypto Brief',         prompt: 'Summarize the cryptocurrency market over the last 24 hours.' },
  { id: 'custom',     name: '✏️ Custom',              prompt: '' },
];

function getNextRunAt(hourUTC, minute, scheduleType, dayOfWeek = null) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hourUTC, minute, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  if (scheduleType === 'weekly' && dayOfWeek !== null) {
    while (next.getUTCDay() !== dayOfWeek) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (scheduleType === 'weekdays') {
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  }
  return next;
}

export {
  checkChatRateLimit,
  sanitizeInput,
  getSystemPrompt,
  invalidateSystemPromptCache,
  classifyQueryForSmartMode,
  SOCIAL_PLATFORMS,
  generateSocialPost,
  SCHEDULE_TEMPLATES,
  getNextRunAt,
};
