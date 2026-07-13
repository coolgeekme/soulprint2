import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { tavily } from '@tavily/core';

// ─── Environment ─────────────────────────────────────────────────────────────
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.EMERGENT_LLM_KEY;
const PERPLEXITY_API_KEY= process.env.PERPLEXITY_API_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const TAVILY_API_KEY    = process.env.TAVILY_API_KEY;
const KIMI_API_KEY      = process.env.KIMI_API_KEY;

// ─── Available models for UI ──────────────────────────────────────────────────
export const AVAILABLE_MODELS = [
  // OpenAI
  { value: 'gpt-5.2',      label: 'GPT-5.2 (Latest)',  provider: 'openai',      group: 'OpenAI',     tier: 'premium' },
  { value: 'gpt-5',        label: 'GPT-5',             provider: 'openai',      group: 'OpenAI',     tier: 'premium' },
  { value: 'o3',           label: 'o3 (Reasoning)',    provider: 'openai',      group: 'OpenAI',     tier: 'premium' },
  { value: 'o3-mini',      label: 'o3 Mini',           provider: 'openai',      group: 'OpenAI',     tier: 'standard' },
  { value: 'gpt-4.1',      label: 'GPT-4.1',           provider: 'openai',      group: 'OpenAI',     tier: 'premium' },
  { value: 'gpt-4o',       label: 'GPT-4o',            provider: 'openai',      group: 'OpenAI',     tier: 'premium' },
  { value: 'gpt-4o-mini',  label: 'GPT-4o Mini',       provider: 'openai',      group: 'OpenAI',     tier: 'standard' },
  // Anthropic
  { value: 'claude-opus-4-5-20251101',   label: 'Claude Opus 4.5',    provider: 'anthropic', group: 'Anthropic', tier: 'premium' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5',  provider: 'anthropic', group: 'Anthropic', tier: 'premium' },
  { value: 'claude-3-5-haiku-20241022',  label: 'Claude Haiku 3.5',   provider: 'anthropic', group: 'Anthropic', tier: 'standard' },
  // Google Gemini
  { value: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',  provider: 'gemini', group: 'Google',    tier: 'premium' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini', group: 'Google',    tier: 'standard' },
  // Perplexity (online — built-in web search)
  { value: 'sonar-pro',       label: 'Sonar Pro (Online)', provider: 'perplexity', group: 'Perplexity', tier: 'premium' },
  { value: 'sonar',           label: 'Sonar (Online)',     provider: 'perplexity', group: 'Perplexity', tier: 'standard' },
  { value: 'sonar-reasoning', label: 'Sonar Reasoning',    provider: 'perplexity', group: 'Perplexity', tier: 'premium' },
  // Kimi (MoonShot AI)
  { value: 'kimi-k2-0711-preview', label: 'Kimi K2 (Flagship)', provider: 'kimi', group: 'Kimi', tier: 'premium' },
  { value: 'moonshot-v1-32k',      label: 'Moonshot 32k',       provider: 'kimi', group: 'Kimi', tier: 'premium' },
  { value: 'moonshot-v1-8k',       label: 'Moonshot 8k (Fast)', provider: 'kimi', group: 'Kimi', tier: 'standard' },
];

export function getModelInfo(modelValue) {
  return AVAILABLE_MODELS.find(m => m.value === modelValue) || AVAILABLE_MODELS[0];
}

// ── Model Tier Helpers ──────────────────────────────────────────────────────
// Single source of truth for model classification.
// To add a new model: add it to AVAILABLE_MODELS above with tier: 'standard' or 'premium'.
// Standard models: fast, cheap — free for all users.
// Premium models: flagship, expensive — metered for Base users, unlimited for Power users.

export function getModelTier(modelValue) {
  const model = AVAILABLE_MODELS.find(m => m.value === modelValue);
  return model?.tier || 'premium'; // Default to premium (safe — prevents cost leaks)
}

export function isModelPremium(modelValue) {
  return getModelTier(modelValue) === 'premium';
}

export function getStandardModels() {
  return AVAILABLE_MODELS.filter(m => m.tier === 'standard');
}

export function getPremiumModels() {
  return AVAILABLE_MODELS.filter(m => m.tier === 'premium');
}

// ─── Web search (Brave primary, Tavily fallback) ──────────────────────────────
export async function executeWebSearch(query, searchDepth = 'basic') {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  const tavilyKey = TAVILY_API_KEY;
  
  // Enhance sports queries to get post-game results
  let enhancedQuery = query;
  const sportsTerms = /score|game|vs|versus|played|won|lost|beat|defeated/i;
  const teamPattern = /(suns|lakers|celtics|warriors|bulls|heat|nets|knicks|pacers|bucks|76ers|nuggets|clippers|mavericks|spurs|rockets|thunder|jazz|pelicans|grizzlies|timberwolves|kings|blazers|pistons|hornets|cavaliers|hawks|wizards|magic|raptors)/i;
  
  if (sportsTerms.test(query) && teamPattern.test(query)) {
    if (!query.toLowerCase().includes('final') && !query.toLowerCase().includes('beat')) {
      enhancedQuery = `${query} beat final score`;
    }
    console.log(`[WebSearch] Enhanced sports query: ${enhancedQuery}`);
  }

  // Smart freshness: only restrict to "past day" for truly time-sensitive queries
  // For general factual queries, use wider time range or no restriction
  const lowerQuery = query.toLowerCase();
  const isSportsOrLive = sportsTerms.test(query) && teamPattern.test(query);
  const isBreakingNews = /\b(today|tonight|right now|breaking|just happened|this morning|this evening)\b/i.test(lowerQuery);
  const isRecentQuery = /\b(latest|newest|most recent|recently|new|just released|just announced|this week|this month)\b/i.test(lowerQuery);
  const isWeatherOrStock = /\b(weather|forecast|temperature|stock price|trading|market)\b/i.test(lowerQuery);
  
  let freshness = '';  // No freshness restriction by default — get the BEST results
  if (isSportsOrLive || isBreakingNews || isWeatherOrStock) {
    freshness = '&freshness=pd';  // Past day — for truly live data
  } else if (isRecentQuery) {
    freshness = '&freshness=pm';  // Past month — for "latest/recent" queries
  }
  // For everything else: no freshness param = all-time results (best relevance)
  
  console.log(`[WebSearch] Query: "${enhancedQuery}", Freshness: ${freshness || 'all-time'}`);
  
  // Try Brave Search first (better for real-time sports/weather)
  if (braveKey) {
    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(enhancedQuery)}&count=10${freshness}`,
        {
          headers: {
            'X-Subscription-Token': braveKey,
            'Accept': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[WebSearch] Brave returned ${data.web?.results?.length || 0} results for: ${enhancedQuery}`);
        
        // Look for results with actual scores in title/description
        const scorePattern = /\d{2,3}[-–]\d{2,3}|\d{2,3}\s*to\s*\d{2,3}|beat\s+\w+\s+\d{2,3}[-–]\d{2,3}|defeated|won\s+\d{2,3}[-–]\d{2,3}/i;
        const resultsWithScores = data.web?.results?.filter(r => 
          scorePattern.test(r.title + ' ' + r.description)
        ) || [];
        
        console.log(`[WebSearch] Found ${resultsWithScores.length} results with scores`);
        
        // Prioritize results with scores, then all results
        const sortedResults = [
          ...resultsWithScores,
          ...(data.web?.results || []).filter(r => !resultsWithScores.includes(r))
        ].slice(0, 5);
        
        // Build answer from the best result (prefer ones with scores)
        const bestResult = sortedResults[0];
        const answer = bestResult ? `${bestResult.title}: ${bestResult.description?.replace(/<[^>]*>/g, '')}` : '';
        
        return {
          answer: answer,
          results: sortedResults.map(r => ({
            title: r.title,
            url: r.url,
            content: r.description?.replace(/<[^>]*>/g, '')?.slice(0, 500) || '',
          })),
        };
      } else {
        // Log non-OK responses for debugging
        const errorText = await response.text().catch(() => 'unable to read');
        console.error(`[WebSearch] Brave returned status ${response.status}: ${errorText.slice(0, 200)}`);
      }
    } catch (braveErr) {
      console.error('[WebSearch] Brave error:', braveErr.message);
    }
  }
  
  // Fallback to Tavily
  if (!tavilyKey) throw new Error('No search API keys configured');
  const client = tavily({ apiKey: tavilyKey });
  const result = await client.search(query, {
    search_depth: searchDepth,
    include_answer: true,
    max_results: 5,
  });
  return {
    answer: result.answer || '',
    results: (result.results || []).map(r => ({
      title: r.title, url: r.url,
      content: r.content?.slice(0, 500) || '',
    })),
  };
}

// OpenAI tool definition for function calling
export const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'search_web',
    description: `Search the internet for real-time, up-to-date information. YOU MUST USE THIS TOOL when:
- User asks about weather, news, current events, sports scores, stock prices
- User provides a URL or asks about a website/company
- User asks "what is X", "who is X", "tell me about X", "how big/much/many is X"
- User asks to research, analyze, or get information about anything
- User mentions a company name, product, or service
- User asks about specifications, measurements, dimensions, or technical details
- User asks ANY factual question where accuracy matters (science, technology, history, geography)
- User asks about recent events, advancements, developments, or discoveries
- Any question that benefits from current or real-time information
- User asks to generate a profile or summary of something
ALWAYS search when in doubt. It is better to search and confirm than to guess from training data.`,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Specific search query. If user provided a URL, include it. Be detailed and include relevant context.' },
        search_depth: { type: 'string', enum: ['basic', 'advanced'], description: 'Use advanced for complex research queries or when analyzing websites' },
      },
      required: ['query'],
    },
  },
};

// ─── Helper: build search context string for injection ───────────────────────
export async function buildSearchContext(userQuery) {
  try {
    const result = await executeWebSearch(userQuery, 'basic');
    if (!result.answer && result.results.length === 0) return null;
    const sources = result.results.slice(0, 3).map(r => `• ${r.title} (${r.url})\n  ${r.content}`).join('\n');
    // Return both the context string and the full results for source tracking
    return {
      context: `[IMPORTANT: A web search has ALREADY been completed for you. Use these results DIRECTLY in your response. Do NOT say "let me search", "give me a moment", or "I'll look it up" — the search is done.]\n\n[Web search results for: "${userQuery}"]\nSummary: ${result.answer}\n\nSources:\n${sources}\n[End of search results — incorporate these findings into your response now]`,
      results: result.results,
      answer: result.answer,
    };
  } catch (e) {
    console.error('Search failed:', e.message);
    return null;
  }
}

// ─── OPENAI PROVIDER ─────────────────────────────────────────────────────────
class ProviderOpenAI {
  constructor(model = 'gpt-4o') {
    this.model = model;
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
    this._lastFinishReason = null;
  }

  getLastFinishReason() { return this._lastFinishReason; }

  async generateChatCompletion({ systemPrompt, messages, model, temperature = 0.7 }) {
    const res = await this.client.chat.completions.create({
      model: model || this.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
    });
    return res.choices[0].message.content;
  }

  // Returns { stream: AsyncIterable<string>, searchMeta, didSearch }
  async generateStream({ systemPrompt, messages, model, temperature = 0.7, enableWebSearch = true, customTools = [], onToolCall = null }) {
    const openaiMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    
    // Combine web search tool with custom tools
    let tools = [];
    if (enableWebSearch) tools.push(WEB_SEARCH_TOOL);
    if (customTools.length > 0) tools = [...tools, ...customTools];
    tools = tools.length > 0 ? tools : undefined;

    // First pass: check for tool calls
    const first = await this.client.chat.completions.create({
      model: model || this.model,
      messages: openaiMessages,
      temperature,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      stream: false,
    });

    const choice = first.choices[0];
    let finalMessages = openaiMessages;
    let searchMeta = [];
    let didSearch = false;
    let toolResults = [];
    let customToolResults = [];

    if (choice.finish_reason === 'tool_calls') {
      const toolCalls = choice.message.tool_calls;
      for (const tc of toolCalls) {
        if (tc.function.name === 'search_web') {
          const args = JSON.parse(tc.function.arguments);
          try {
            const sr = await executeWebSearch(args.query, args.search_depth || 'basic');
            searchMeta.push({ query: args.query, ...sr });
            toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(sr) });
          } catch (e) {
            toolResults.push({ role: 'tool', tool_call_id: tc.id, content: 'Search error: ' + e.message });
          }
          didSearch = true;
        } else if (onToolCall) {
          // Handle custom tool calls via callback
          try {
            const args = JSON.parse(tc.function.arguments);
            const result = await onToolCall(tc.function.name, args);
            toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
            customToolResults.push({ tool: tc.function.name, args, result });
          } catch (e) {
            toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: e.message }) });
            customToolResults.push({ tool: tc.function.name, error: e.message });
          }
        }
      }
      finalMessages = [...openaiMessages, { role: 'assistant', content: null, tool_calls: toolCalls }, ...toolResults];
    }

    const aiStream = await this.client.chat.completions.create({
      model: model || this.model,
      messages: finalMessages,
      temperature,
      stream: true,
    });

    return { stream: this._openaiChunks(aiStream), searchMeta, didSearch, customToolResults };
  }

  // Simple streaming without tool checking - used for auto-continuation
  async streamContinuation({ systemPrompt, messages, model, temperature = 0.7 }) {
    this._lastFinishReason = null;
    const aiStream = await this.client.chat.completions.create({
      model: model || this.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
      stream: true,
    });
    return this._openaiChunks(aiStream);
  }

  async *_openaiChunks(aiStream) {
    this._lastFinishReason = null;
    for await (const chunk of aiStream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta?.content || '';
      if (delta) yield delta;
      if (choice?.finish_reason) {
        this._lastFinishReason = choice.finish_reason;
      }
    }
  }
}

// ─── ANTHROPIC PROVIDER ───────────────────────────────────────────────────────
class ProviderAnthropic {
  constructor(model = 'claude-sonnet-4-5-20250929') {
    this.model = model;
    this.client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    this._lastFinishReason = null;
  }

  getLastFinishReason() { return this._lastFinishReason; }

  // Convert OpenAI-style message content to Anthropic format
  _convertMessages(messages) {
    return messages.map(msg => {
      if (typeof msg.content === 'string') return msg;
      if (!Array.isArray(msg.content)) return msg;

      const parts = msg.content.map(part => {
        if (part.type === 'text') return { type: 'text', text: part.text };
        if (part.type === 'image_url') {
          // Extract base64 data from data URL
          const url = part.image_url?.url || '';
          const match = url.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
          if (match) {
            return {
              type: 'image',
              source: { type: 'base64', media_type: match[1], data: match[2] },
            };
          }
        }
        return { type: 'text', text: JSON.stringify(part) };
      });
      return { role: msg.role, content: parts };
    });
  }

  async generateChatCompletion({ systemPrompt, messages, model, temperature = 0.7 }) {
    const res = await this.client.messages.create({
      model: model || this.model,
      system: systemPrompt,
      messages: this._convertMessages(messages),
      max_tokens: 16384,
      temperature,
    });
    return res.content[0]?.text || '';
  }

  async generateStream({ systemPrompt, messages, model, temperature = 0.7, enableWebSearch = true }) {
    let finalMessages = this._convertMessages(messages);
    let searchMeta = [];
    let didSearch = false;

    // For Claude: pre-search and inject results into user message
    if (enableWebSearch && finalMessages.length > 0) {
      const lastMsg = finalMessages[finalMessages.length - 1];
      const userText = typeof lastMsg.content === 'string' ? lastMsg.content
        : (lastMsg.content?.find(p => p.type === 'text')?.text || '');
      if (userText && this._needsSearch(userText)) {
        const searchResult = await buildSearchContext(userText);
        if (searchResult) {
          searchMeta.push({ query: userText, results: searchResult.results, answer: searchResult.answer });
          didSearch = true;
          const lastContent = typeof lastMsg.content === 'string'
            ? `${searchResult.context}\n\n---\n\nUser question: ${lastMsg.content}`
            : [{ type: 'text', text: searchResult.context + '\n\n---\n\nUser question: ' + userText },
               ...lastMsg.content.filter(p => p.type !== 'text')];
          finalMessages = [
            ...finalMessages.slice(0, -1),
            { role: 'user', content: lastContent },
          ];
        }
      }
    }

    const stream = this.client.messages.stream({
      model: model || this.model,
      system: systemPrompt,
      messages: finalMessages,
      max_tokens: 16384,
      temperature,
    });

    return { stream: this._anthropicChunks(stream), searchMeta, didSearch };
  }

  // Simple streaming for auto-continuation - no search
  async streamContinuation({ systemPrompt, messages, model, temperature = 0.7 }) {
    this._lastFinishReason = null;
    const converted = this._convertMessages(messages);
    const stream = this.client.messages.stream({
      model: model || this.model,
      system: systemPrompt,
      messages: converted,
      max_tokens: 16384,
      temperature,
    });
    return this._anthropicChunks(stream);
  }

  async *_anthropicChunks(stream) {
    this._lastFinishReason = null;
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        yield event.delta.text;
      }
      // Capture stop reason from message_delta event
      if (event.type === 'message_delta' && event.delta?.stop_reason) {
        this._lastFinishReason = event.delta.stop_reason === 'max_tokens' ? 'length' : event.delta.stop_reason;
      }
    }
  }

  _needsSearch(text) {
    const keywords = ['today', 'current', 'latest', 'now', 'price', 'news', 'weather', 'stock', 'recent', '2024', '2025', '2026', 'who won', 'what happened'];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }
}

// ─── PERPLEXITY PROVIDER (OpenAI-compatible, built-in web search) ─────────────
class ProviderPerplexity {
  constructor(model = 'sonar-pro') {
    this.model = model;
    // Perplexity uses an OpenAI-compatible API
    this.client = new OpenAI({
      apiKey: PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    });
    this._lastFinishReason = null;
  }

  getLastFinishReason() { return this._lastFinishReason; }

  async generateChatCompletion({ systemPrompt, messages, model, temperature = 0.7 }) {
    const res = await this.client.chat.completions.create({
      model: model || this.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
    });
    return res.choices[0].message.content;
  }

  async generateStream({ systemPrompt, messages, model, temperature = 0.7 }) {
    // Perplexity sonar models have built-in internet search — no Tavily needed
    const aiStream = await this.client.chat.completions.create({
      model: model || this.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
      stream: true,
    });

    // Perplexity always searches, so we mark it as searched and extract citations
    return { 
      stream: this._perplexityChunks(aiStream), 
      searchMeta: [], // Citations will be extracted in _perplexityChunks
      didSearch: true,  // Perplexity always has web context
      extractCitations: true,
    };
  }

  // Perplexity continuation (no special search needed)
  async streamContinuation({ systemPrompt, messages, model, temperature = 0.7 }) {
    this._lastFinishReason = null;
    const aiStream = await this.client.chat.completions.create({
      model: model || this.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
      stream: true,
    });
    return this._perplexityChunks(aiStream);
  }

  async *_perplexityChunks(aiStream) {
    this._lastFinishReason = null;
    let citations = [];
    for await (const chunk of aiStream) {
      // Extract citations if available
      if (chunk.citations) {
        citations = chunk.citations.map((url, i) => ({
          title: `Source ${i + 1}`,
          url: url,
          snippet: '',
        }));
      }
      const choice = chunk.choices[0];
      const delta = choice?.delta?.content || '';
      if (delta) yield { delta, citations };
      if (choice?.finish_reason) {
        this._lastFinishReason = choice.finish_reason;
      }
    }
  }
}

// ─── GEMINI PROVIDER ──────────────────────────────────────────────────────────
class ProviderGemini {
  constructor(model = 'gemini-2.0-flash') {
    this.model = model;
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this._lastFinishReason = null;
  }

  getLastFinishReason() { return this._lastFinishReason; }

  _buildGeminiMessages(messages) {
    // Gemini uses 'user'/'model' roles and a specific content format
    return messages.map(m => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      let parts;
      if (typeof m.content === 'string') {
        parts = [{ text: m.content }];
      } else if (Array.isArray(m.content)) {
        parts = m.content.map(part => {
          if (part.type === 'text') return { text: part.text };
          if (part.type === 'image_url') {
            const url = part.image_url?.url || '';
            const match = url.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
            if (match) {
              return { inlineData: { mimeType: match[1], data: match[2] } };
            }
          }
          return { text: JSON.stringify(part) };
        });
      } else {
        parts = [{ text: JSON.stringify(m.content) }];
      }
      return { role, parts };
    });
  }

  async generateChatCompletion({ systemPrompt, messages, model, temperature = 0.7 }) {
    const geminiModel = this.genAI.getGenerativeModel({
      model: model || this.model,
      systemInstruction: systemPrompt,
    });
    const chat = geminiModel.startChat({ history: this._buildGeminiMessages(messages.slice(0, -1)) });
    const lastMsg = messages[messages.length - 1];
    // Handle multimodal content (text + images)
    let sendContent;
    if (typeof lastMsg.content === 'string') {
      sendContent = lastMsg.content;
    } else if (Array.isArray(lastMsg.content)) {
      sendContent = lastMsg.content.map(part => {
        if (part.type === 'text') return { text: part.text };
        if (part.type === 'image_url') {
          const url = part.image_url?.url || '';
          const match = url.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
          if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
        }
        return { text: JSON.stringify(part) };
      });
    } else {
      sendContent = JSON.stringify(lastMsg.content);
    }
    const result = await chat.sendMessage(sendContent);
    return result.response.text();
  }

  async generateStream({ systemPrompt, messages, model, temperature = 0.7, enableWebSearch = true }) {
    let finalMessages = [...messages];
    let searchMeta = [];
    let didSearch = false;

    // Pre-search injection for Gemini
    if (enableWebSearch && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const userText = typeof lastMsg.content === 'string' ? lastMsg.content
        : (Array.isArray(lastMsg.content) ? (lastMsg.content.find(p => p.type === 'text')?.text || '') : '');
      if (userText && this._needsSearch(userText)) {
        const searchResult = await buildSearchContext(userText);
        if (searchResult) {
          searchMeta.push({ query: userText, results: searchResult.results, answer: searchResult.answer });
          didSearch = true;
          finalMessages = [
            ...messages.slice(0, -1),
            { role: 'user', content: `${searchResult.context}\n\n---\n\nMy question: ${userText}` },
          ];
        }
      }
    }

    const geminiModel = this.genAI.getGenerativeModel({
      model: model || this.model,
      systemInstruction: systemPrompt,
      generationConfig: { temperature },
    });

    const history = this._buildGeminiMessages(finalMessages.slice(0, -1));
    const chat = geminiModel.startChat({ history });
    const lastMsg = finalMessages[finalMessages.length - 1];
    
    // Handle multimodal content (text + images) for Gemini
    let sendContent;
    if (typeof lastMsg.content === 'string') {
      sendContent = lastMsg.content;
    } else if (Array.isArray(lastMsg.content)) {
      sendContent = lastMsg.content.map(part => {
        if (part.type === 'text') return { text: part.text };
        if (part.type === 'image_url') {
          const url = part.image_url?.url || '';
          const match = url.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
          if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
        }
        return { text: JSON.stringify(part) };
      });
    } else {
      sendContent = JSON.stringify(lastMsg.content);
    }
    
    const result = await chat.sendMessageStream(sendContent);

    return { stream: this._geminiChunks(result.stream), searchMeta, didSearch };
  }

  // Gemini continuation - simple streaming without search
  async streamContinuation({ systemPrompt, messages, model, temperature = 0.7 }) {
    this._lastFinishReason = null;
    const geminiModel = this.genAI.getGenerativeModel({
      model: model || this.model,
      systemInstruction: systemPrompt,
      generationConfig: { temperature },
    });
    const history = this._buildGeminiMessages(messages.slice(0, -1));
    const chat = geminiModel.startChat({ history });
    const lastMsg = messages[messages.length - 1];
    const userText = typeof lastMsg.content === 'string' ? lastMsg.content : '';
    const result = await chat.sendMessageStream(userText);
    return this._geminiChunks(result.stream);
  }

  async *_geminiChunks(stream) {
    this._lastFinishReason = null;
    for await (const chunk of stream) {
      const text = chunk.text();
      if (text) yield text;
      // Capture finish reason from Gemini candidates
      const reason = chunk.candidates?.[0]?.finishReason;
      if (reason) {
        this._lastFinishReason = (reason === 'MAX_TOKENS') ? 'length' : 'stop';
      }
    }
  }

  _needsSearch(text) {
    const keywords = ['today', 'current', 'latest', 'now', 'price', 'news', 'weather', 'stock', 'recent', '2024', '2025', '2026'];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }
}

// ─── KIMI PROVIDER (MoonShot AI — OpenAI-compatible) ─────────────────────────
class ProviderKimi {
  constructor(model = 'kimi-k2-0711-preview') {
    this.model = model;
    this._lastFinishReason = null;
    // MoonShot AI uses an OpenAI-compatible API (international endpoint)
    if (!KIMI_API_KEY) {
      console.error('[Kimi] KIMI_API_KEY is not set!');
    } else {
      console.log('[Kimi] API key loaded, length:', KIMI_API_KEY.length);
    }
    this.client = new OpenAI({
      apiKey: KIMI_API_KEY,
      baseURL: 'https://api.moonshot.ai/v1',
    });
  }

  getLastFinishReason() { return this._lastFinishReason; }

  async generateChatCompletion({ systemPrompt, messages, model, temperature = 0.7 }) {
    try {
      const res = await this.client.chat.completions.create({
        model: model || this.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature,
        max_tokens: 8192,
      });
      return res.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('[Kimi] Chat completion error:', error.message);
      throw error;
    }
  }

  async generateStream({ systemPrompt, messages, model, temperature = 0.7, enableWebSearch = true }) {
    let finalMessages = messages;
    let searchMeta = [];
    let didSearch = false;

    // Inject web search context before calling (Kimi doesn't have native search)
    if (enableWebSearch && finalMessages.length > 0) {
      const lastMsg = finalMessages[finalMessages.length - 1];
      const userText = typeof lastMsg.content === 'string' ? lastMsg.content
        : (lastMsg.content?.find?.(p => p.type === 'text')?.text || '');
      if (userText && this._needsSearch(userText)) {
        const searchResult = await buildSearchContext(userText);
        if (searchResult) {
          searchMeta.push({ query: userText, results: searchResult.results, answer: searchResult.answer });
          didSearch = true;
          finalMessages = [
            ...finalMessages.slice(0, -1),
            { role: 'user', content: `${searchResult.context}\n\n---\n\nUser question: ${userText}` },
          ];
        }
      }
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: model || this.model,
        messages: [{ role: 'system', content: systemPrompt }, ...finalMessages],
        temperature,
        max_tokens: 8192,
        stream: true,
      });

      return { stream: this._kimiChunks(stream), searchMeta, didSearch };
    } catch (error) {
      console.error('[Kimi] Stream error:', error.message, error.status);
      throw error;
    }
  }

  // Kimi continuation - simple streaming without search
  async streamContinuation({ systemPrompt, messages, model, temperature = 0.7 }) {
    this._lastFinishReason = null;
    const stream = await this.client.chat.completions.create({
      model: model || this.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
      max_tokens: 8192,
      stream: true,
    });
    return this._kimiChunks(stream);
  }

  async *_kimiChunks(stream) {
    this._lastFinishReason = null;
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta?.content;
      if (delta) yield delta;
      if (choice?.finish_reason) {
        this._lastFinishReason = choice.finish_reason;
      }
    }
  }

  _needsSearch(text) {
    const keywords = ['today', 'current', 'latest', 'now', 'price', 'news', 'weather', 'stock', 'recent', '2024', '2025', '2026', 'who won', 'what happened'];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }
}

// ─── Provider factory ─────────────────────────────────────────────────────────
export function getProvider(providerName, model) {
  const info = model ? getModelInfo(model) : null;
  const resolvedProvider = providerName || info?.provider || 'openai';

  switch (resolvedProvider) {
    case 'anthropic':  return new ProviderAnthropic(model);
    case 'gemini':     return new ProviderGemini(model);
    case 'perplexity': return new ProviderPerplexity(model);
    case 'kimi':       return new ProviderKimi(model);
    case 'openai':
    default:           return new ProviderOpenAI(model);
  }
}

// Backward-compat: hosted = openai
export class ProviderHosted extends ProviderOpenAI {}
export class ProviderSelfHosted {
  async generateChatCompletion() { throw new Error('Self-hosted LLM not configured'); }
  async generateStream() { throw new Error('Self-hosted LLM not configured'); }
}
