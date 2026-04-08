/**
 * Video Model Registry — Dynamic Video Intelligence
 * Extracted from the main catch-all route.js for maintainability.
 */

// ══════════════════════════════════════════════════════════════════════════════

// Model-specific estimated times and progress stages for UX
const VIDEO_MODEL_UX = {
  'kling-3.0': {
    estimatedTimeLabel: '1-3 min',
    estimatedTimeMinSec: 60,
    estimatedTimeMaxSec: 180,
    pollTimeoutMs: 10 * 60 * 1000,     // 10 minutes max polling
    stuckWarningMs: 5 * 60 * 1000,     // 5 minutes stuck warning
    progressStages: [
      { threshold: 0, message: 'Queuing your video...' },
      { threshold: 20, message: 'Initializing Kling 3.0...' },
      { threshold: 40, message: 'Rendering frames at 720p...' },
      { threshold: 65, message: 'Processing motion & animation...' },
      { threshold: 85, message: 'Encoding final output...' },
      { threshold: 95, message: 'Finalizing...' },
    ],
  },
  'veo3': {
    estimatedTimeLabel: '3-8 min',
    estimatedTimeMinSec: 180,
    estimatedTimeMaxSec: 480,
    pollTimeoutMs: 12 * 60 * 1000,     // 12 minutes max polling (Veo takes longer)
    stuckWarningMs: 8 * 60 * 1000,     // 8 minutes stuck warning (not 5)
    progressStages: [
      { threshold: 0, message: 'Queuing your cinematic video...' },
      { threshold: 10, message: 'Veo 3.1 is warming up...' },
      { threshold: 25, message: 'Composing cinematic 1080p scene...' },
      { threshold: 40, message: 'Rendering high-quality frames...' },
      { threshold: 55, message: 'Processing audio & visual sync...' },
      { threshold: 70, message: 'Enhancing cinematic quality...' },
      { threshold: 85, message: 'Encoding 1080p output...' },
      { threshold: 95, message: 'Finalizing your masterpiece...' },
    ],
  },
  'runway-aleph': {
    estimatedTimeLabel: '2-5 min',
    estimatedTimeMinSec: 120,
    estimatedTimeMaxSec: 300,
    pollTimeoutMs: 10 * 60 * 1000,
    stuckWarningMs: 6 * 60 * 1000,
    progressStages: [
      { threshold: 0, message: 'Queuing your video...' },
      { threshold: 20, message: 'Initializing Runway Aleph...' },
      { threshold: 40, message: 'Applying creative transformations...' },
      { threshold: 65, message: 'Rendering at 1080p...' },
      { threshold: 85, message: 'Encoding final output...' },
      { threshold: 95, message: 'Finalizing...' },
    ],
  },
};

// Get progress message for a model based on current progress percentage
function getProgressMessage(modelId, progressPct) {
  const ux = VIDEO_MODEL_UX[modelId] || VIDEO_MODEL_UX['kling-3.0'];
  const stages = ux.progressStages;
  let msg = stages[0].message;
  for (const stage of stages) {
    if (progressPct >= stage.threshold) msg = stage.message;
  }
  return msg;
}

// Calculate estimated progress percentage based on elapsed time and model
function calculateModelProgress(modelId, elapsedMs) {
  const ux = VIDEO_MODEL_UX[modelId] || VIDEO_MODEL_UX['kling-3.0'];
  const elapsedSec = elapsedMs / 1000;
  const midpointSec = (ux.estimatedTimeMinSec + ux.estimatedTimeMaxSec) / 2;
  
  // Ramp to 80% over the midpoint time, then slow crawl to 95%
  if (elapsedSec < midpointSec) {
    return Math.min(80, Math.round((elapsedSec / midpointSec) * 80));
  } else {
    // Slow crawl from 80% to 95% over remaining estimated time
    const extraSec = elapsedSec - midpointSec;
    const remainingSec = ux.estimatedTimeMaxSec - midpointSec;
    return Math.min(95, 80 + Math.round((extraSec / Math.max(remainingSec, 60)) * 15));
  }
}

const VIDEO_MODELS = {
  'kling-3.0': {
    id: 'kling-3.0',
    label: 'Kling 3.0',
    provider: 'Kling',
    description: 'High-quality general-purpose video generation with motion control and character reference',
    capabilities: ['text-to-video', 'image-to-video', 'character-reference'],
    strengths: ['animation', 'motion control', 'character movement', 'general purpose', 'fast', 'face consistency', 'character reference'],
    maxDuration: 5,
    resolution: '720p',
    apiType: 'market', // Uses /api/v1/jobs/createTask
    generateEndpoint: 'https://api.kie.ai/api/v1/jobs/createTask',
    statusEndpoint: 'https://api.kie.ai/api/v1/jobs/recordInfo',
    buildPayload: (prompt, options = {}) => ({
      model: 'kling-3.0/video',
      input: {
        prompt,
        ...(options.imageUrls ? { image_urls: options.imageUrls } : {}),
        duration: String(options.duration || 5),
        aspect_ratio: options.aspectRatio || '16:9',
        mode: 'std',
        sound: false,
        multi_shots: false,
        multi_prompt: [],
        // Character/face reference via kling_elements
        kling_elements: options.characterElements || [],
      }
    }),
    parseCreateResponse: (data) => {
      if (data.code !== 200) throw new Error(data.msg || data.error || 'Kling generation failed');
      return data.data?.taskId;
    },
    parseStatusResponse: (data) => {
      // Check for API-level errors first
      if (data.code && data.code !== 200) {
        console.error('[Kling Parser] API error code:', data.code, data.msg);
        return { status: 'failed', error: data.msg || `Kling API error (code: ${data.code})` };
      }
      if (!data.data || (typeof data.data === 'object' && Object.keys(data.data).length === 0)) {
        return { status: 'failed', error: 'Task not found or expired on provider side.' };
      }
      
      const state = data.data?.status?.toLowerCase() || data.data?.state?.toLowerCase();
      let videoUrl = null, thumbnailUrl = null;
      if (data.data?.resultJson) {
        try {
          const resultJson = JSON.parse(data.data.resultJson);
          videoUrl = resultJson?.resultUrls?.[0] || resultJson?.videoUrl || resultJson?.video_url;
          thumbnailUrl = resultJson?.coverUrl || resultJson?.cover_url || resultJson?.thumbnail;
        } catch (e) {}
      }
      if (!videoUrl) {
        const output = data.data?.output || {};
        videoUrl = output.video_url || output.videoUrl;
        thumbnailUrl = thumbnailUrl || output.cover_url || output.coverUrl || output.imageUrl;
      }
      if ((state === 'success' || state === 'completed' || state === 'succeed') && videoUrl) {
        return { status: 'success', videoUrl, thumbnailUrl };
      } else if (state === 'failed' || state === 'fail' || state === 'error') {
        return { status: 'failed', error: data.data?.error || data.data?.message || 'Generation failed' };
      }
      return { status: 'generating', progress: state || 'processing...' };
    },
  },
  'veo3': {
    id: 'veo3',
    label: 'Veo 3.1',
    provider: 'Google',
    description: 'Cinematic 1080p video with synchronized audio, strong prompt adherence',
    capabilities: ['text-to-video', 'image-to-video'],
    strengths: ['cinematic', 'high quality', '1080p', 'audio', 'nature', 'landscape', 'realistic', 'dramatic', 'professional', 'film'],
    maxDuration: 8,
    resolution: '1080p',
    apiType: 'veo',
    generateEndpoint: 'https://api.kie.ai/api/v1/veo/generate',
    statusEndpoint: 'https://api.kie.ai/api/v1/veo/record-info',
    buildPayload: (prompt, options = {}) => ({
      prompt,
      model: options.fast ? 'veo3_fast' : 'veo3',
      aspect_ratio: options.aspectRatio || '16:9',
      ...(options.imageUrls ? { imageUrls: options.imageUrls } : {}),
    }),
    parseCreateResponse: (data) => {
      if (data.code !== 200) throw new Error(data.msg || data.error || 'Veo 3.1 generation failed');
      return data.data?.taskId;
    },
    parseStatusResponse: (data) => {
      // Veo responses have resultUrls inside data.data.response (NOT data.data.successFlag)
      // Structure: { code: 200, msg: "success", data: { response: { resultUrls: [...], resolution: "720p" } } }
      const response = data.data?.response || {};
      const resultUrls = response.resultUrls || data.data?.resultUrls;
      
      // Check if video is ready: has resultUrls with actual URLs
      if (resultUrls && Array.isArray(resultUrls) && resultUrls.length > 0 && resultUrls[0]) {
        const videoUrl = resultUrls[0];
        const thumbnailUrl = response.coverUrl || data.data?.coverUrl || data.data?.cover_url;
        console.log('[Veo3 Parser] SUCCESS — videoUrl:', videoUrl.substring(0, 80));
        return { status: 'success', videoUrl, thumbnailUrl };
      }
      
      // Also check for successFlag pattern (docs mention it)
      const successFlag = data.data?.successFlag;
      if (successFlag === 1) {
        let videoUrl = null;
        try {
          const urls = JSON.parse(data.data?.resultUrls || '[]');
          videoUrl = urls[0];
        } catch (e) {
          videoUrl = data.data?.resultUrls;
        }
        if (videoUrl) {
          return { status: 'success', videoUrl, thumbnailUrl: data.data?.coverUrl };
        }
      }
      
      // Check for failure — expanded error detection
      if (successFlag === 2 || successFlag === 3 || data.data?.status === 'failed' || data.data?.status === 'error') {
        return { status: 'failed', error: data.data?.errorMessage || data.data?.error || data.data?.message || 'Veo 3.1 generation failed' };
      }
      
      // Check for API-level errors (code !== 200)
      if (data.code && data.code !== 200) {
        console.error('[Veo3 Parser] API error code:', data.code, data.msg);
        return { status: 'failed', error: data.msg || `Veo API error (code: ${data.code})` };
      }
      
      // Check for empty/null data which indicates a stale or expired task
      if (!data.data || (typeof data.data === 'object' && Object.keys(data.data).length === 0)) {
        console.warn('[Veo3 Parser] Empty data response — task may have expired');
        return { status: 'failed', error: 'Video task expired or was not found by the provider.' };
      }
      
      // Still processing
      return { status: 'generating', progress: 'processing...' };
    },
  },
  'runway-aleph': {
    id: 'runway-aleph',
    label: 'Runway Aleph',
    provider: 'Runway',
    description: 'In-context video editing — add/remove objects, restyle, change angles via text',
    capabilities: ['video-to-video'],
    strengths: ['editing', 'style transfer', 'transformation', 'creative', 'artistic', 'relight', 'angle change'],
    maxDuration: 10,
    resolution: '1080p',
    apiType: 'aleph',
    generateEndpoint: 'https://api.kie.ai/api/v1/aleph/generate',
    statusEndpoint: 'https://api.kie.ai/api/v1/aleph/record-info',
    buildPayload: (prompt, options = {}) => ({
      prompt,
      ...(options.videoUrl ? { videoUrl: options.videoUrl } : {}),
      aspectRatio: options.aspectRatio || '16:9',
      waterMark: '',
      uploadCn: false,
    }),
    parseCreateResponse: (data) => {
      if (data.code !== 200) throw new Error(data.msg || data.error || 'Runway Aleph generation failed');
      return data.data?.taskId;
    },
    parseStatusResponse: (data) => {
      // Check for API-level errors first
      if (data.code && data.code !== 200) {
        console.error('[Runway Parser] API error code:', data.code, data.msg);
        return { status: 'failed', error: data.msg || `Runway API error (code: ${data.code})` };
      }
      if (!data.data || (typeof data.data === 'object' && Object.keys(data.data).length === 0)) {
        return { status: 'failed', error: 'Task not found or expired on provider side.' };
      }
      
      const successFlag = data.data?.successFlag;
      if (successFlag === 1 || (data.data?.status?.toLowerCase() === 'success')) {
        let videoUrl = null, thumbnailUrl = null;
        try {
          const urls = JSON.parse(data.data?.resultUrls || '[]');
          videoUrl = urls[0];
        } catch (e) {
          videoUrl = data.data?.resultUrls || data.data?.videoUrl;
        }
        thumbnailUrl = data.data?.coverUrl || data.data?.cover_url;
        return { status: 'success', videoUrl, thumbnailUrl };
      } else if (successFlag === 2 || successFlag === 3) {
        return { status: 'failed', error: data.data?.errorMessage || data.data?.error || 'Runway Aleph generation failed' };
      }
      return { status: 'generating', progress: 'processing...' };
    },
  },
};

// Parse explicit model request from prompt (e.g., "Use Runway Aleph to generate: ...")
function parseExplicitVideoModelFromPrompt(prompt) {
  if (!prompt) return null;
  
  const modelPatterns = [
    // "Use X to generate/create/make" patterns
    { pattern: /use\s+(kling|kling\s*3\.?0?)\s+to\s+(generate|create|make)/i, model: 'kling-3.0' },
    { pattern: /use\s+(veo|veo\s*3\.?1?|google\s*veo)\s+to\s+(generate|create|make)/i, model: 'veo3' },
    { pattern: /use\s+(runway|runway\s*aleph|aleph)\s+to\s+(generate|create|make)/i, model: 'runway-aleph' },
    // "with X" / "in X" patterns
    { pattern: /(?:with|in)\s+(kling|kling\s*3\.?0?)\b/i, model: 'kling-3.0' },
    { pattern: /(?:with|in)\s+(veo|veo\s*3\.?1?)\b/i, model: 'veo3' },
    { pattern: /(?:with|in)\s+(runway|runway\s*aleph|aleph)\b/i, model: 'runway-aleph' },
    // "using X" patterns (for natural language)
    { pattern: /using\s+(kling|kling\s*3\.?0?)\b/i, model: 'kling-3.0' },
    { pattern: /using\s+(veo|veo\s*3\.?1?)\b/i, model: 'veo3' },
    { pattern: /using\s+(runway|runway\s*aleph|aleph)\b/i, model: 'runway-aleph' },
    // Direct model mention patterns
    { pattern: /\b(kling\s*3\.?0?)\s+(video|generation)/i, model: 'kling-3.0' },
    { pattern: /\b(veo\s*3\.?1?)\s+(video|generation)/i, model: 'veo3' },
    { pattern: /\b(runway\s*aleph|aleph)\s+(video|generation)/i, model: 'runway-aleph' },
    // "generate with/using/in X" patterns
    { pattern: /generate\s+(?:with|using|in)\s+(kling|kling\s*3\.?0?)\b/i, model: 'kling-3.0' },
    { pattern: /generate\s+(?:with|using|in)\s+(veo|veo\s*3\.?1?)\b/i, model: 'veo3' },
    { pattern: /generate\s+(?:with|using|in)\s+(runway|runway\s*aleph|aleph)\b/i, model: 'runway-aleph' },
    // Standalone model name mention as last resort (e.g., "animation in Veo", "video via Kling")
    { pattern: /\b(?:via|on|through)\s+(kling|kling\s*3\.?0?)\b/i, model: 'kling-3.0' },
    { pattern: /\b(?:via|on|through)\s+(veo|veo\s*3\.?1?)\b/i, model: 'veo3' },
    { pattern: /\b(?:via|on|through)\s+(runway|runway\s*aleph|aleph)\b/i, model: 'runway-aleph' },
  ];
  
  for (const { pattern, model } of modelPatterns) {
    if (pattern.test(prompt)) {
      console.log(`[VideoModel] Explicit model requested in prompt: ${model} (matched: "${prompt.match(pattern)?.[0]}")`);
      return model;
    }
  }
  return null;
}

// Parse explicit image model request from prompt
function parseExplicitImageModelFromPrompt(prompt) {
  if (!prompt) return null;
  
  const modelPatterns = [
    // Nano Banana
    { pattern: /\b(?:use|with|using)\s+(?:nano\s*banana)\b/i, model: 'nano-banana' },
    // Gemini
    { pattern: /\b(?:use|with|using)\s+(?:gemini|gemini\s*image)\b/i, model: 'gemini-2.0-flash-exp-image-generation' },
    // GPT Image 1.5
    { pattern: /\b(?:use|with|using)\s+(?:gpt[\s-]?image[\s-]?1\.?5)\b/i, model: 'gpt-image-1-5' },
    // GPT Image / DALL-E (generic) → route to GPT Image 1.5
    { pattern: /\b(?:use|with|using)\s+(?:gpt[\s-]?image|gpt[\s-]?4o[\s-]?image|dall-?e)\b/i, model: 'gpt-image-1-5' },
    // Imagen 4 Ultra
    { pattern: /\b(?:use|with|using)\s+(?:imagen[\s-]?4|imagen[\s-]?ultra)\b/i, model: 'imagen-4-ultra' },
    // Midjourney → route to Imagen 4 Ultra (Midjourney unavailable)
    { pattern: /\b(?:use|with|using)\s+(?:midjourney|mid[\s-]?journey)(?:\s*v?7)?\b/i, model: 'imagen-4-ultra' },
    // Flux Pro → route to GPT Image 1.5 (Flux unavailable)
    { pattern: /\b(?:use|with|using)\s+(?:flux[\s-]?pro|flux)\b/i, model: 'gpt-image-1-5' },
    // Seedream
    { pattern: /\b(?:use|with|using)\s+(?:seedream|see[\s-]?dream)(?:\s*5)?(?:\s*lite)?\b/i, model: 'seedream-5-lite' },
  ];
  
  for (const { pattern, model } of modelPatterns) {
    if (pattern.test(prompt)) {
      console.log(`[ImageModel] Explicit model requested in prompt: ${model}`);
      return model;
    }
  }
  return null;
}

// Extract the actual prompt content after removing model instruction prefix
function extractPromptWithoutModelInstruction(prompt) {
  if (!prompt) return prompt;
  // Remove "Use [model] to generate: " prefix
  return prompt.replace(/^use\s+[\w\s.]+\s+to\s+(generate|create|make):\s*/i, '').trim();
}

// Detect aspect ratio from user's prompt
function detectAspectRatioFromPrompt(prompt) {
  if (!prompt) return null;
  const lower = prompt.toLowerCase();
  
  // Explicit ratio patterns
  if (/\b16\s*[:x×]\s*9\b/.test(lower)) return '16:9';
  if (/\b9\s*[:x×]\s*16\b/.test(lower)) return '9:16';
  if (/\b1\s*[:x×]\s*1\b/.test(lower)) return '1:1';
  if (/\b4\s*[:x×]\s*3\b/.test(lower)) return '4:3';
  if (/\b3\s*[:x×]\s*4\b/.test(lower)) return '3:4';
  if (/\b21\s*[:x×]\s*9\b/.test(lower)) return '21:9';
  
  // Keyword patterns
  if (/\b(portrait|vertical|tiktok|reels?|shorts?|instagram\s*stor(y|ies)|phone|mobile)\b/.test(lower)) return '9:16';
  if (/\b(widescreen|wide\s*screen|cinematic|cinema|landscape|horizontal|youtube|16.9)\b/.test(lower)) return '16:9';
  if (/\b(square|instagram\s*(post|feed)?)\b/.test(lower) && !/\b(stor(y|ies))\b/.test(lower)) return '1:1';
  
  return null; // Let caller decide default
}

// Detect if user's video prompt references a previously generated image in the conversation
function detectContextImageReference(prompt) {
  if (!prompt) return false;
  const lower = prompt.toLowerCase();
  
  // Pronouns and references to existing content
  const contextPatterns = [
    // Pronouns referencing the image
    /\b(this|that|the|it|its)\b.*\b(video|animate|animation|motion|drive|driving|move|moving|fly|flying|walk|walking|run|running|spin|spinning|rotate|rotating|zoom|pan)\b/i,
    /\b(video|animate|animation|motion)\b.*\b(this|that|the|it)\b/i,
    // "make/create a video of the [noun]" - referring to something already generated
    /\b(make|create|generate)\s+(a\s+)?video\s+(of|from|with)\s+(the|this|that|my|it)\b/i,
    // "animate the [noun]"
    /\b(animate|bring\s+to\s+life)\s+(the|this|that|my|it)\b/i,
    // "turn it/this into a video"
    /\bturn\s+(it|this|that)\s+into\s+(a\s+)?video\b/i,
    // "video of it/this driving/moving/etc"
    /\bvideo\s+(of|with)\s+(it|this|that)\b/i,
    // References to a car, logo, design etc that was just generated
    /\b(now|next|then)\s+(make|create|generate|animate)\b/i,
    // "make it drive/fly/move" — implying animation of existing subject
    /\bmake\s+(it|this|that|the\s+\w+)\s+(drive|fly|move|walk|run|spin|rotate|dance|swim|jump|bounce)\b/i,
  ];
  
  return contextPatterns.some(p => p.test(lower));
}

// Dynamic Video Intelligence — selects the best video model based on prompt analysis
async function selectVideoModel(prompt, { hasImage = false, hasVideo = false, userPreferredModel = null, hasCharacterRef = false } = {}) {
  // First, check if prompt contains explicit model request (e.g., "Use Runway Aleph to generate: ...")
  const explicitModel = parseExplicitVideoModelFromPrompt(prompt);
  if (explicitModel && VIDEO_MODELS[explicitModel]) {
    return { model: explicitModel, reason: `User explicitly requested ${VIDEO_MODELS[explicitModel].label}` };
  }
  
  // If user explicitly selected a model via UI, use it
  if (userPreferredModel && VIDEO_MODELS[userPreferredModel]) {
    return { model: userPreferredModel, reason: `User selected ${VIDEO_MODELS[userPreferredModel].label}` };
  }

  // If video attachment → Runway Aleph (video-to-video)
  if (hasVideo) {
    return { model: 'runway-aleph', reason: 'Runway Aleph excels at video-to-video transformation and editing' };
  }

  // Use LLM to pick the best model
  try {
    const selectionPrompt = `You are a video model selection expert. Given the user's video generation request, select the BEST model.

Available models:
1. "kling-3.0" — Kling 3.0: Fast general-purpose video. Good for: animations, character movement, image animation, quick previews. 720p, 5s max.
2. "veo3" — Google Veo 3.1: Premium cinematic quality. Good for: cinematic scenes, nature/landscapes, dramatic shots, synchronized audio, professional-grade content. 1080p, 8s max.

User request: "${prompt.substring(0, 300)}"
Has image attachment: ${hasImage ? 'yes' : 'no'}

Rules:
- Choose "veo3" for: cinematic, dramatic, nature, landscape, professional, high-quality, 1080p, film-like, audio sync requests
- Choose "kling-3.0" for: quick animations, character movements, image animation, general creative content, speed priority
- Default to "veo3" for ambiguous cinematic/quality requests, "kling-3.0" for simple animations

Respond ONLY with valid JSON: {"model": "kling-3.0" or "veo3", "reason": "one sentence explanation"}`;

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: selectionPrompt }],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    if (result.model && VIDEO_MODELS[result.model]) {
      console.log(`[VideoIntelligence] Selected: ${result.model} — ${result.reason}`);
      return { model: result.model, reason: result.reason };
    }
  } catch (e) {
    console.error('[VideoIntelligence] LLM selection failed, defaulting to kling-3.0:', e.message);
  }

  // Fallback: keyword-based selection
  const lowerPrompt = prompt.toLowerCase();
  const cinematicKeywords = ['cinematic', '1080p', 'hd', 'film', 'dramatic', 'professional', 'landscape', 'nature', 'aerial', 'sunset', 'sunrise', 'ocean', 'mountain', 'audio', 'sound'];
  const isCinematic = cinematicKeywords.some(kw => lowerPrompt.includes(kw));
  
  if (isCinematic) {
    return { model: 'veo3', reason: 'Veo 3.1 selected for cinematic/high-quality content' };
  }
  return { model: 'kling-3.0', reason: 'Kling 3.0 selected for general-purpose video generation' };
}

// Unified video generation function — dispatches to the correct API
async function generateVideoWithModel(modelId, prompt, kieApiKey, options = {}) {
  const model = VIDEO_MODELS[modelId];
  if (!model) throw new Error(`Unknown video model: ${modelId}`);

  const payload = model.buildPayload(prompt, options);
  console.log(`[VideoGen] Calling ${model.label} at ${model.generateEndpoint}`);
  console.log(`[VideoGen] Payload:`, JSON.stringify(payload).substring(0, 500));

  const res = await fetch(model.generateEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieApiKey}` },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`[VideoGen] ${model.label} response:`, JSON.stringify(data).substring(0, 500));

  const taskId = model.parseCreateResponse(data);
  if (!taskId) throw new Error(`No taskId returned from ${model.label}`);
  return taskId;
}

// Unified video status check — dispatches to the correct API and parses response
async function checkVideoStatus(modelId, taskId, kieApiKey) {
  const model = VIDEO_MODELS[modelId];
  if (!model) throw new Error(`Unknown video model: ${modelId}`);

  const res = await fetch(`${model.statusEndpoint}?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${kieApiKey}` },
  });

  // Check for HTTP errors before parsing JSON
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    console.error(`[VideoStatus] ${model.label} HTTP ${res.status} for task ${taskId}: ${errorText.substring(0, 200)}`);
    if (res.status === 401 || res.status === 403) {
      return { status: 'failed', error: 'API authentication failed. Please check your API key.' };
    }
    if (res.status === 429) {
      return { status: 'generating', progress: 'rate limited, retrying...', rateLimited: true };
    }
    if (res.status >= 500) {
      return { status: 'generating', progress: 'provider temporarily unavailable...', providerError: true };
    }
    return { status: 'failed', error: `Provider returned HTTP ${res.status}` };
  }

  const data = await res.json();
  console.log(`[VideoStatus] ${model.label} raw response for task ${taskId}:`, JSON.stringify(data).substring(0, 1500));

  return model.parseStatusResponse(data);
}



// ── Image-to-Video Generation ──────────────────────────────────────
// Creates a video from a seed image (e.g., last frame of an uploaded video)
// Uses Kie.ai's Wan 2.6 image-to-video model for visual continuity
async function generateVideoFromImage(imageUrl, prompt, kieApiKey, options = {}) {
  const ENDPOINT = 'https://api.kie.ai/api/v1/jobs/createTask';
  
  const payload = {
    model: 'wan/2-6-image-to-video',
    input: {
      prompt: prompt || 'Continue the scene naturally with smooth camera transitions',
      image_urls: [imageUrl],
      duration: options.duration || '5',
      resolution: options.resolution || '1080p',
      nsfw_checker: false,
    },
  };
  
  console.log(`[ImageToVideo] Generating from seed image: ${imageUrl?.substring(0, 80)}`);
  console.log(`[ImageToVideo] Prompt: "${prompt?.substring(0, 120)}"`);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieApiKey}` },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`[ImageToVideo] Response:`, JSON.stringify(data).substring(0, 500));

  if (data.code !== 200) {
    throw new Error(data.msg || data.error || `Image-to-video generation failed (code: ${data.code})`);
  }

  const taskId = data.data?.taskId;
  if (!taskId) throw new Error('No taskId returned from image-to-video API');
  return taskId;
}

// Check status for image-to-video jobs (uses the recordInfo endpoint)
async function checkImageToVideoStatus(taskId, kieApiKey) {
  const STATUS_ENDPOINT = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;
  
  const res = await fetch(STATUS_ENDPOINT, {
    headers: { Authorization: `Bearer ${kieApiKey}` },
  });

  if (!res.ok) {
    console.error(`[ImageToVideoStatus] HTTP ${res.status} for task ${taskId}`);
    return { status: 'generating', progress: 'provider temporarily unavailable...' };
  }

  const data = await res.json();
  console.log(`[ImageToVideoStatus] Raw response for task ${taskId}:`, JSON.stringify(data).substring(0, 1500));

  if (data.code && data.code !== 200) {
    return { status: 'failed', error: data.msg || `Status error (code: ${data.code})` };
  }
  
  // Parse the Wan/Jobs API response format
  const taskData = data.data || {};
  const state = taskData.state?.toLowerCase();
  
  if (state === 'success') {
    // Parse resultJson for the video URL
    let videoUrl = null;
    let thumbnailUrl = null;
    try {
      const resultJson = JSON.parse(taskData.resultJson || '{}');
      const urls = resultJson.resultUrls || resultJson.result_urls || [];
      videoUrl = urls[0] || null;
      // Check for thumbnail in results
      thumbnailUrl = resultJson.thumbnailUrl || resultJson.thumbnail_url || null;
    } catch (e) {
      console.log(`[ImageToVideoStatus] Failed to parse resultJson: ${e.message}`);
    }
    
    if (videoUrl) {
      return { status: 'success', videoUrl, thumbnailUrl };
    }
    return { status: 'generating', progress: 'processing results...' };
  }
  
  if (state === 'fail' || state === 'failed' || state === 'error') {
    return { status: 'failed', error: taskData.failMsg || taskData.error || 'Generation failed' };
  }
  
  // Still processing: waiting, queuing, generating
  return { status: 'generating', progress: state || 'generating video from image...' };
}

// ── Video Extension ─────────────────────────────────────────────────
// Extends an existing video via Kie.ai's Runway extend endpoint.
// Requires the original taskId from the video generation job.
async function extendVideo(taskId, prompt, kieApiKey, options = {}) {
  const EXTEND_ENDPOINT = 'https://api.kie.ai/api/v1/runway/extend';
  
  const payload = {
    taskId,
    prompt: prompt || 'Continue the video naturally with smooth transitions',
    expandPrompt: true,
    waterMark: '',
    ...(options.imageUrl ? { imageUrl: options.imageUrl } : {}),
  };
  
  console.log(`[VideoExtend] Extending video task ${taskId} with prompt: "${prompt?.substring(0, 120)}"`);
  console.log(`[VideoExtend] Payload:`, JSON.stringify(payload).substring(0, 500));

  const res = await fetch(EXTEND_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieApiKey}` },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`[VideoExtend] Response:`, JSON.stringify(data).substring(0, 500));

  if (data.code !== 200) {
    throw new Error(data.msg || data.error || `Video extend failed (code: ${data.code})`);
  }

  const newTaskId = data.data?.taskId;
  if (!newTaskId) throw new Error('No taskId returned from video extend API');
  return newTaskId;
}

// Check status for extended videos — uses the Runway status endpoint
async function checkExtendStatus(taskId, kieApiKey) {
  const STATUS_ENDPOINT = `https://api.kie.ai/api/v1/runway/get-ai-video-details?taskId=${taskId}`;
  
  const res = await fetch(STATUS_ENDPOINT, {
    headers: { Authorization: `Bearer ${kieApiKey}` },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    console.error(`[VideoExtendStatus] HTTP ${res.status} for task ${taskId}: ${errorText.substring(0, 200)}`);
    if (res.status >= 500) return { status: 'generating', progress: 'provider temporarily unavailable...' };
    return { status: 'failed', error: `Provider returned HTTP ${res.status}` };
  }

  const data = await res.json();
  console.log(`[VideoExtendStatus] Raw response for task ${taskId}:`, JSON.stringify(data).substring(0, 1500));

  // Parse response — Runway extend uses similar structure
  if (data.code && data.code !== 200) {
    return { status: 'failed', error: data.msg || `Extend status error (code: ${data.code})` };
  }
  
  const videoUrl = data.data?.video_url || data.data?.videoUrl;
  const imageUrl = data.data?.image_url || data.data?.imageUrl;
  const status = data.data?.status?.toLowerCase();
  
  if (videoUrl) {
    return { status: 'success', videoUrl, thumbnailUrl: imageUrl };
  }
  if (status === 'failed' || status === 'error') {
    return { status: 'failed', error: data.data?.error || data.data?.message || 'Extension failed' };
  }
  return { status: 'generating', progress: status || 'extending video...' };
}

// Detect if user wants to extend an existing video
function detectVideoExtendIntent(prompt, hasVideoAttachment = false) {
  if (!prompt) return false;
  const lower = prompt.toLowerCase();
  
  const extendPatterns = [
    /\b(extend|continue|lengthen|elongate|prolong|expand)\b.*\b(video|clip|animation|scene)\b/i,
    /\b(video|clip|animation|scene)\b.*\b(extend|continue|lengthen|longer|more)\b/i,
    /\b(make|get)\b.*\b(it|the video|the clip|this)\b.*\b(longer|extended|continue)\b/i,
    /\b(add|append)\b.*\b(more|extra|additional)\b.*\b(to the video|to the clip|to it|seconds|time|footage)\b/i,
    /\b(keep|keep it) going\b/i,
    /\b(more of|continue from|pick up where)\b/i,
    /\b(extend this|extend that|extend the)\b/i,
    /\b(longer version|extended version|full version|more of this)\b/i,
  ];
  
  // When a video IS attached, the user doesn't need to explicitly say "video"
  // They might just say "extend this", "continue this", "add more details", etc.
  if (hasVideoAttachment) {
    const attachmentAwarePatterns = [
      /\b(extend|continue|lengthen|expand|prolong)\b.*\b(this|that|it)\b/i,
      /\b(this|that|it)\b.*\b(extend|continue|lengthen|expand)\b/i,
      /\b(make|get)\b.*\b(this|that|it)\b.*\b(longer|extended)\b/i,
      /\b(add|append)\b.*\b(more|extra|additional)\b.*\b(detail|content|scene|part|section|to this|to that|to it)\b/i,
      /\b(extend|continue|expand)\b.*\b(with|by adding|and add|and include)\b/i,
      /\b(more of this|keep going|keep it going|don't stop)\b/i,
    ];
    if (attachmentAwarePatterns.some(p => p.test(lower))) return true;
  }
  
  return extendPatterns.some(p => p.test(lower));
}

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

// Document parsing utilities

export {
  VIDEO_MODELS,
  VIDEO_MODEL_UX,
  KIE_VIDEO_MODELS,
  parseExplicitVideoModelFromPrompt,
  parseExplicitImageModelFromPrompt,
  extractPromptWithoutModelInstruction,
  detectAspectRatioFromPrompt,
  detectContextImageReference,
  detectVideoExtendIntent,
  selectVideoModel,
  generateVideoWithModel,
  generateVideoFromImage,
  checkVideoStatus,
  checkImageToVideoStatus,
  extendVideo,
  checkExtendStatus,
  getProgressMessage,
  calculateModelProgress,
};
