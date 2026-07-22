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

// Include both file extensions AND explicit MIME types so Android PWA shows "Files/Browse" option
const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xlsx,.xls,.mp4,.mov,.webm,.avi,.mkv,.m4v,image/*,video/mp4,video/quicktime,video/webm,video/x-matroska,application/pdf,application/msword,text/plain,text/csv,text/markdown,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Text input limits — matches backend MAX_SINGLE_MSG_TOKENS (32000 tokens ≈ 128K chars)
const MAX_INPUT_CHARS = 128000;
const WARN_INPUT_CHARS = 100000; // Show yellow warning at this threshold
const SHOW_COUNTER_CHARS = 5000; // Show character counter above this

// Composer textarea: starts at 1 line, auto-grows up to 3 lines, then scrolls.
// 16px font * 1.5 line-height = 24px/line; +8px for the textarea's vertical padding.
const MAX_INPUT_HEIGHT_PX = 24 * 3 + 8;

const IMAGE_MODELS = [
  { value: 'smart', label: '🧠 Dynamic Intelligence', description: 'AI picks best model', isSmartMode: true },
  // Budget tier
  { value: 'seedream-5-lite', label: 'Seedream 5 Lite', description: 'Fast, text-heavy images' },
  { value: 'nano-banana', label: 'Nano Banana', description: 'Gemini-powered, versatile' },
  { value: 'qwen-image-2', label: 'Qwen Image 2.0', description: 'Text rendering, 2K output' },
  { value: 'nano-banana-2', label: 'Nano Banana 2', description: 'Improved consistency' },
  // Mid tier
  { value: 'flux-2-flex', label: 'Flux-2 Flex', description: 'Fast & versatile iteration' },
  { value: 'imagen-4-fast', label: 'Imagen 4 Fast', description: 'Google quality, fast' },
  { value: 'wan-2-7-image', label: 'Wan 2.7 Image', description: 'Multi-image, 2K output' },
  { value: 'gpt4o-image', label: '4o Image', description: 'GPT-4o powered' },
  { value: 'grok-imagine', label: 'Grok Imagine', description: 'xAI photorealistic' },
  // Premium tier
  { value: 'flux-2-pro', label: 'Flux-2 Pro', description: 'Professional photorealism' },
  { value: 'imagen-4-ultra', label: 'Imagen 4 Ultra', description: 'Google flagship, stunning' },
  { value: 'gpt-image-1-5', label: 'GPT Image 1.5', description: 'OpenAI text-to-image' },
  { value: 'gpt-image-2', label: 'GPT Image 2', description: 'OpenAI next-gen flagship' },
];

// Video Generation Models (matching desktop) - no pricing shown
const VIDEO_MODELS = [
  { value: 'smart', label: '🧠 Dynamic Intelligence', description: 'AI picks best model for your prompt', isSmartMode: true },
  { value: 'kling-3.0', label: 'Kling 3.0', description: 'Fast, general purpose, 720p' },
  { value: 'seedance-2-0-fast', label: 'Seedance 2.0 Fast', description: 'Fast Seedance with audio & motion' },
  { value: 'veo3', label: 'Veo 3.1', description: 'Cinematic 1080p, audio sync' },
  { value: 'seedance-2-0', label: 'Seedance 2.0', description: 'Native audio, lip-sync, dance' },
  { value: 'runway-aleph', label: 'Runway Aleph', description: 'Video-to-video editing & style' },
  { value: 'happyhorse-1-0', label: 'HappyHorse 1.0', description: 'Multilingual, audio support' },
  { value: 'wan-2-7', label: 'Wan 2.7', description: 'Multi-modality, 1080p, editing' },
  { value: 'grok-imagine-video', label: 'Grok Imagine Video', description: 'xAI photorealistic video' },
  { value: 'hailuo-2-3', label: 'Hailuo 2.3 Pro', description: 'High-quality cinematic Pro' },
];

// Aspect ratios for image generation
const ASPECT_RATIOS = [
  { value: '1:1', label: 'Square (1:1)' },
  { value: '16:9', label: 'Landscape (16:9)' },
  { value: '9:16', label: 'Portrait (9:16)' },
  { value: '4:3', label: 'Standard (4:3)' },
];


export { MODELS, ACCEPTED_FILE_TYPES, MAX_FILE_SIZE, MAX_INPUT_CHARS, WARN_INPUT_CHARS, SHOW_COUNTER_CHARS, MAX_INPUT_HEIGHT_PX, IMAGE_MODELS, VIDEO_MODELS, ASPECT_RATIOS };
