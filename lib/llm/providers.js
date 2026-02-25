import OpenAI from 'openai';
import { tavily } from '@tavily/core';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// Available models for the UI dropdown
export const AVAILABLE_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)', provider: 'openai' },
  { value: 'gpt-4.1', label: 'GPT-4.1 (Advanced)', provider: 'openai' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (Balanced)', provider: 'openai' },
];

// Web search tool definition for OpenAI function calling
export const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'search_web',
    description: 'Search the internet for real-time information, current events, news, prices, weather, or any up-to-date data. Use this whenever the user asks about something that may have changed recently or requires live data.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query. Be specific and concise.',
        },
        search_depth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          description: 'Use "advanced" for complex research, "basic" for quick lookups.',
        },
      },
      required: ['query'],
    },
  },
};

// Execute a Tavily web search
export async function executeWebSearch(query, searchDepth = 'basic') {
  if (!TAVILY_API_KEY) throw new Error('TAVILY_API_KEY not configured');
  const client = tavily({ apiKey: TAVILY_API_KEY });
  const result = await client.search(query, {
    search_depth: searchDepth,
    include_answer: true,
    max_results: 5,
    include_raw_content: false,
  });
  return {
    answer: result.answer || '',
    results: (result.results || []).map(r => ({
      title: r.title,
      url: r.url,
      content: r.content?.slice(0, 500) || '',
      score: r.score,
    })),
  };
}

export class ProviderHosted {
  constructor(model = 'gpt-4o') {
    this.model = model;
    if (!OPENAI_API_KEY) console.warn('OPENAI_API_KEY is not set');
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  async generateChatCompletion({ systemPrompt, messages, model, temperature = 0.7 }) {
    const openaiMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const response = await this.client.chat.completions.create({
      model: model || this.model,
      messages: openaiMessages,
      temperature,
    });
    return response.choices[0].message.content;
  }

  // Streaming with tool calling support (web search + vision)
  async generateChatCompletionStream({ systemPrompt, messages, model, temperature = 0.7, enableWebSearch = true }) {
    const openaiMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const tools = enableWebSearch ? [WEB_SEARCH_TOOL] : undefined;

    // First pass: non-streaming to check for tool calls
    const firstResponse = await this.client.chat.completions.create({
      model: model || this.model,
      messages: openaiMessages,
      temperature,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      stream: false,
    });

    const firstChoice = firstResponse.choices[0];

    // If tool call needed, handle it and stream final response
    if (firstChoice.finish_reason === 'tool_calls') {
      const toolCalls = firstChoice.message.tool_calls;
      const toolResults = [];
      const searchMeta = [];

      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'search_web') {
          const args = JSON.parse(toolCall.function.arguments);
          try {
            const searchResult = await executeWebSearch(args.query, args.search_depth || 'basic');
            searchMeta.push({ query: args.query, ...searchResult });
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(searchResult),
            });
          } catch (e) {
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Search error: ${e.message}`,
            });
          }
        }
      }

      const updatedMessages = [
        ...openaiMessages,
        { role: 'assistant', content: null, tool_calls: toolCalls },
        ...toolResults,
      ];

      // Stream final answer after search
      const stream = await this.client.chat.completions.create({
        model: model || this.model,
        messages: updatedMessages,
        temperature,
        stream: true,
      });

      return { stream, searchMeta, didSearch: true };
    }

    // No tool call — stream the direct response
    const stream = await this.client.chat.completions.create({
      model: model || this.model,
      messages: openaiMessages,
      temperature,
      stream: true,
    });

    return { stream, searchMeta: [], didSearch: false };
  }
}

export class ProviderSelfHosted {
  constructor() {
    this.baseUrl = process.env.SELF_HOSTED_LLM_URL || '';
    this.model = process.env.SELF_HOSTED_LLM_MODEL || 'local-model';
  }

  async generateChatCompletion({ systemPrompt, messages, model, temperature = 0.7 }) {
    if (!this.baseUrl) throw new Error('SELF_HOSTED_LLM_URL not configured');
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || this.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature,
      }),
    });
    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generateChatCompletionStream() {
    throw new Error('Streaming not implemented for self-hosted provider yet');
  }
}

export function getProvider(providerName = 'hosted', model = 'gpt-4o') {
  switch (providerName) {
    case 'self-hosted': return new ProviderSelfHosted();
    default: return new ProviderHosted(model);
  }
}
