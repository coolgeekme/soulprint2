// Shared KIE Image Model configs - used by both route.js and media-intelligence.js
// Kie.ai credit to USD conversion (1 credit = $0.005)
export const KIE_CREDIT_TO_USD = 0.005;

export const KIE_IMAGE_MODELS = {
  'seedream-5-lite': { 
    model: 'bytedance/seedream', 
    useJobsApi: true, 
    credits: 5.5,
    available: true,
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
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
      quality: 'high',
    })
  },
  // Unavailable models kept for reference but marked as unavailable
  'gpt4o-image': { 
    model: 'openai/gpt-4o-image', 
    useJobsApi: true, 
    credits: 20,
    available: false,
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      size: { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792' }[aspectRatio] || '1024x1024',
    })
  },
  'flux-pro': { 
    model: 'black-forest-labs/flux-1.1-pro', 
    useJobsApi: true, 
    credits: 25,
    available: false,
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
    formatInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
    })
  },
};
