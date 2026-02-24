import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Available models for the UI dropdown
export const AVAILABLE_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)', provider: 'openai' },
  { value: 'gpt-4.1', label: 'GPT-4.1 (Advanced)', provider: 'openai' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (Balanced)', provider: 'openai' },
];

/**
 * Provider interface:
 * generateChatCompletion({ systemPrompt, messages, model, temperature })
 * generateChatCompletionStream({ systemPrompt, messages, model, temperature })
 */

export class ProviderHosted {
  constructor(model = 'gpt-4o') {
    this.model = model;
    if (!OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY is not set');
    }
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  async generateChatCompletion({ systemPrompt, messages, model, temperature = 0.7 }) {
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await this.client.chat.completions.create({
      model: model || this.model,
      messages: openaiMessages,
      temperature,
    });

    return response.choices[0].message.content;
  }

  async generateChatCompletionStream({ systemPrompt, messages, model, temperature = 0.7 }) {
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    return await this.client.chat.completions.create({
      model: model || this.model,
      messages: openaiMessages,
      temperature,
      stream: true,
    });
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

  async generateChatCompletionStream({ systemPrompt, messages, model, temperature = 0.7 }) {
    throw new Error('Streaming not implemented for self-hosted provider yet');
  }
}

export function getProvider(providerName = 'hosted', model = 'gpt-4o') {
  switch (providerName) {
    case 'self-hosted':
      return new ProviderSelfHosted();
    case 'hosted':
    default:
      return new ProviderHosted(model);
  }
}
