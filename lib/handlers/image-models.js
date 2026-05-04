// Shared KIE Image Model configs - used by both route.js and media-intelligence.js
// Kie.ai credit to USD conversion (1 credit = $0.005)
export const KIE_CREDIT_TO_USD = 0.005;

export const KIE_IMAGE_MODELS = {
  // ── Active Models ─────────────────────────────────────────────────────

  'seedream-5-lite': { 
    model: 'bytedance/seedream', 
    useJobsApi: true, 
    credits: 5.5,
    available: true,
    label: 'Seedream 5 Lite',
    provider: 'ByteDance',
    description: 'Fast & affordable text-heavy images with good text clarity',
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
    available: true,
    label: 'Nano Banana',
    provider: 'Google',
    description: 'Versatile style-rich images with creative accuracy',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      image_size: aspectRatio || '1:1',
      output_format: 'png',
    })
  },
  'nano-banana-2': { 
    model: 'google/nano-banana-2', 
    useJobsApi: true, 
    credits: 12,
    available: true,
    label: 'Nano Banana 2',
    provider: 'Google',
    description: 'Next-gen Nano Banana with improved quality and consistency',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      image_size: aspectRatio || '1:1',
      output_format: 'png',
    })
  },
  'imagen-4-ultra': { 
    model: 'google/imagen4-ultra', 
    useJobsApi: true, 
    credits: 30,
    available: true,
    label: 'Imagen 4 Ultra',
    provider: 'Google',
    description: 'Google\'s highest quality image generation — stunning artistic output',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      image_size: aspectRatio || '1:1',
    })
  },
  'imagen-4-fast': { 
    model: 'google/imagen4-fast', 
    useJobsApi: true, 
    credits: 15,
    available: true,
    label: 'Imagen 4 Fast',
    provider: 'Google',
    description: 'Fast Imagen 4 — good quality at lower cost',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      image_size: aspectRatio || '1:1',
    })
  },
  'gpt-image-1-5': { 
    model: 'gpt-image/1.5-text-to-image', 
    useJobsApi: true, 
    credits: 50,
    available: true,
    label: 'GPT Image 1.5',
    provider: 'OpenAI',
    description: 'OpenAI\'s text-to-image with high fidelity and style control',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
      quality: 'high',
    })
  },
  'gpt-image-2': { 
    model: 'gpt-image-2-text-to-image', 
    useJobsApi: true, 
    credits: 55,
    available: true,
    label: 'GPT Image 2',
    provider: 'OpenAI',
    description: 'OpenAI\'s next-gen — stronger photorealism, sharper text, polished product photography',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || 'auto',
      resolution: '2K',
    })
  },
  'gpt4o-image': { 
    model: 'openai/gpt-4o-image', 
    useJobsApi: true, 
    credits: 20,
    available: true,
    label: '4o Image',
    provider: 'OpenAI',
    description: 'GPT-4o powered image generation with accurate text and flexible style',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      size: { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792' }[aspectRatio] || '1024x1024',
    })
  },
  'flux-2-pro': { 
    model: 'flux-2/pro-text-to-image', 
    useJobsApi: true, 
    credits: 25,
    available: true,
    label: 'Flux-2 Pro',
    provider: 'Black Forest Labs',
    description: 'Professional photorealistic images with excellent detail and composition',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
      resolution: '2K',
      nsfw_checker: false,
    })
  },
  'flux-2-flex': { 
    model: 'flux-2/flex-text-to-image', 
    useJobsApi: true, 
    credits: 15,
    available: true,
    label: 'Flux-2 Flex',
    provider: 'Black Forest Labs',
    description: 'Flexible image generation — fast, versatile, great for iteration',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
      resolution: '1K',
      nsfw_checker: false,
    })
  },
  'grok-imagine': { 
    model: 'grok-imagine/text-to-image', 
    useJobsApi: true, 
    credits: 20,
    available: true,
    label: 'Grok Imagine',
    provider: 'xAI',
    description: 'High-quality photorealistic images from xAI with minimal filtering',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
    })
  },
  'wan-2-7-image': { 
    model: 'wan/2-7-image', 
    useJobsApi: true, 
    credits: 15,
    available: true,
    label: 'Wan 2.7 Image',
    provider: 'Alibaba',
    description: 'Unified image model — text rendering, 2K output, multi-image workflows',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
      resolution: '2K',
    })
  },
  'qwen-image-2': { 
    model: 'qwen2/text-to-image', 
    useJobsApi: true, 
    credits: 12,
    available: true,
    label: 'Qwen Image 2.0',
    provider: 'Alibaba',
    description: 'Realistic generation with structured text rendering and native 2K output',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
    })
  },

  // ── Unavailable / Legacy Models ───────────────────────────────────────

  'flux-pro': { 
    model: 'black-forest-labs/flux-1.1-pro', 
    useJobsApi: true, 
    credits: 25,
    available: false,
    label: 'Flux 1.1 Pro (Legacy)',
    provider: 'Black Forest Labs',
    description: 'Superseded by Flux-2 Pro',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      image_size: { '1:1': 'square_hd', '16:9': 'landscape_16_9', '9:16': 'portrait_9_16' }[aspectRatio] || 'square_hd',
    })
  },
  'midjourney-v7': { 
    model: 'midjourney/v7-imagine', 
    useJobsApi: true, 
    credits: 40,
    available: false,
    label: 'Midjourney V7',
    provider: 'Midjourney',
    description: 'Currently unavailable via Kie.ai',
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
    })
  },
};
