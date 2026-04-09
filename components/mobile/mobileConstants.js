// Mobile-specific constants

const MODELS = [
  // Dynamic Intelligence - AI auto-selects best model
  { value: 'smart', label: '🧠 Dynamic Intelligence', provider: 'auto', group: 'Smart', isSmartMode: true, description: 'AI picks the best model for your query' },
  // OpenAI
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai', group: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', group: 'OpenAI' },
  { value: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai', group: 'OpenAI' },
  { value: 'gpt-5.2', label: 'GPT-5.2 (Coming Soon)', provider: 'openai', group: 'OpenAI', comingSoon: true },
  { value: 'gpt-5', label: 'GPT-5 (Coming Soon)', provider: 'openai', group: 'OpenAI', comingSoon: true },
  { value: 'o3', label: 'o3 (Coming Soon)', provider: 'openai', group: 'OpenAI', comingSoon: true },
  { value: 'o3-mini', label: 'o3 Mini (Coming Soon)', provider: 'openai', group: 'OpenAI', comingSoon: true },
  // Anthropic
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5', provider: 'anthropic', group: 'Claude' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', provider: 'anthropic', group: 'Claude' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5', provider: 'anthropic', group: 'Claude' },
  // Google Gemini
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini', group: 'Gemini' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini', group: 'Gemini' },
  // Perplexity
  { value: 'sonar-pro', label: 'Sonar Pro (Online)', provider: 'perplexity', group: 'Perplexity' },
  { value: 'sonar', label: 'Sonar (Online)', provider: 'perplexity', group: 'Perplexity' },
  { value: 'sonar-reasoning', label: 'Sonar Reasoning', provider: 'perplexity', group: 'Perplexity' },
  // Kimi
  { value: 'kimi-k2-0711-preview', label: 'Kimi K2 (Flagship)', provider: 'kimi', group: 'Kimi' },
  { value: 'moonshot-v1-32k', label: 'Moonshot 32k', provider: 'kimi', group: 'Kimi' },
  { value: 'moonshot-v1-8k', label: 'Moonshot 8k (Fast)', provider: 'kimi', group: 'Kimi' },
];

const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.txt,.md,.csv,.json,.docx,.mp4,.mov,.webm,.avi,.mkv,.m4v,video/mp4,video/quicktime,video/webm';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const IMAGE_MODELS = [
  { value: 'smart', label: '🧠 Dynamic Intelligence', description: 'AI picks best model', isSmartMode: true },
  { value: 'seedream-5-lite', label: 'Seedream 5.0 Lite', description: 'Fast & affordable' },
  { value: 'nano-banana', label: 'Nano Banana', description: 'Gemini-powered' },
  { value: 'gpt4o-image', label: 'GPT-4o Image', description: 'High quality text' },
  { value: 'flux-pro', label: 'Flux Pro', description: 'Artistic styles' },
  { value: 'midjourney-v7', label: 'Midjourney V7', description: 'Premium quality' },
  { value: 'gpt-image-1-5', label: 'GPT Image 1.5', description: 'OpenAI flagship' },
];

// Video Generation Models (matching desktop) - no pricing shown
const VIDEO_MODELS = [
  { value: 'smart', label: '🧠 Dynamic Intelligence', description: 'AI picks best model for your prompt', isSmartMode: true },
  { value: 'kling-3.0', label: 'Kling 3.0', description: 'Fast, general purpose, 720p 5s' },
  { value: 'veo3', label: 'Veo 3.1', description: 'Cinematic 1080p, audio sync' },
  { value: 'runway-aleph', label: 'Runway Aleph', description: 'Video-to-video editing & style' },
];

// Aspect ratios for image generation
const ASPECT_RATIOS = [
  { value: '1:1', label: 'Square (1:1)' },
  { value: '16:9', label: 'Landscape (16:9)' },
  { value: '9:16', label: 'Portrait (9:16)' },
  { value: '4:3', label: 'Standard (4:3)' },
];


export { MODELS, ACCEPTED_FILE_TYPES, MAX_FILE_SIZE, IMAGE_MODELS, VIDEO_MODELS, ASPECT_RATIOS };
