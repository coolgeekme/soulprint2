/**
 * Dynamic Intelligence for Media Generation — model selection & routing
 * Extracted from route.js for maintainability.
 */
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { VIDEO_MODELS, VIDEO_MODEL_UX, KIE_VIDEO_MODELS, parseExplicitImageModelFromPrompt, detectAspectRatioFromPrompt, generateVideoWithModel, checkVideoStatus, checkExtendStatus, checkImageToVideoStatus, getProgressMessage, calculateModelProgress } from '@/lib/handlers/video-models';
import { KIE_IMAGE_MODELS, KIE_CREDIT_TO_USD } from '@/lib/handlers/image-models';

// DYNAMIC INTELLIGENCE FOR MEDIA GENERATION
// ============================================================

// Analyze prompt and recommend the best image model
function selectBestImageModel(prompt, userPreferredModel = null) {
  // If user explicitly selected a model (not 'smart'), use it
  if (userPreferredModel && userPreferredModel !== 'smart' && KIE_IMAGE_MODELS[userPreferredModel]) {
    return {
      model: userPreferredModel,
      reason: `🎯 User selected ${userPreferredModel}`,
      confidence: 'user-selected'
    };
  }
  
  // First check for explicit model request in prompt
  const explicitModel = parseExplicitImageModelFromPrompt(prompt);
  if (explicitModel) {
    return {
      model: explicitModel,
      reason: `🎯 User explicitly requested ${explicitModel}`,
      confidence: 'high'
    };
  }
  
  const lowerPrompt = prompt.toLowerCase();
  
  // Keywords and patterns for different use cases
  const patterns = {
    // Photorealistic - Nano Banana or Flux
    photorealistic: /\b(photo|photograph|realistic|real|hd|4k|portrait|headshot|professional|corporate|stock photo|documentary)\b/i,
    // Text-heavy - Ideogram or Seedream
    textHeavy: /\b(logo|text|typography|sign|poster|banner|flyer|advertisement|brand|label|t-shirt design|title|headline|letters|words|writing)\b/i,
    // Artistic/Creative - Midjourney
    artistic: /\b(art|artistic|fantasy|surreal|dream|magical|ethereal|abstract|painting|illustration|anime|manga|concept art|cinematic|epic|dramatic|vibrant|colorful)\b/i,
    // Product/Commercial - Flux Pro or GPT Image
    product: /\b(product|ecommerce|catalog|mockup|packaging|commercial|marketing|advertisement|studio shot|white background)\b/i,
    // Quick/Simple - Seedream Lite
    simple: /\b(simple|basic|quick|icon|emoji|avatar|thumbnail|sketch|draft)\b/i,
  };
  
  // Check patterns and return recommendation
  if (patterns.textHeavy.test(lowerPrompt)) {
    return {
      model: 'seedream-5-lite',
      reason: '📝 Text rendering - Seedream excels at text clarity',
      confidence: 'high'
    };
  }
  
  if (patterns.artistic.test(lowerPrompt)) {
    return {
      model: 'imagen-4-ultra',
      reason: '🎨 Artistic/creative style - Imagen 4 Ultra creates stunning high-quality art',
      confidence: 'high'
    };
  }
  
  if (patterns.photorealistic.test(lowerPrompt)) {
    return {
      model: 'gpt-image-2',
      reason: '📷 Photorealistic - GPT Image 2 for strongest photorealism and product photography',
      confidence: 'high'
    };
  }
  
  if (patterns.product.test(lowerPrompt)) {
    return {
      model: 'gpt-image-2',
      reason: '🛍️ Product/commercial - GPT Image 2 for polished commercial shots',
      confidence: 'high'
    };
  }
  
  if (patterns.simple.test(lowerPrompt)) {
    return {
      model: 'seedream-5-lite',
      reason: '⚡ Quick generation - Seedream Lite is fast and affordable',
      confidence: 'medium'
    };
  }
  
  // Default to Flux-2 Pro for general requests (excellent all-around quality)
  return {
    model: 'flux-2-pro',
    reason: '🖼️ General image - Flux-2 Pro for excellent all-around quality',
    confidence: 'default'
  };
}

// Analyze prompt and recommend the best video model
function selectBestVideoModel(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  const patterns = {
    // Cinematic/Storytelling - Sora 2 Pro or Kling 3 Pro
    cinematic: /\b(cinematic|film|movie|story|narrative|scene|dramatic|epic|professional|high quality|4k|hd|hollywood|blockbuster)\b/i,
    // Talking/Speech - Wan 2.6
    talking: /\b(talking|speaking|dialogue|conversation|interview|presentation|lip sync|speech|voice|saying|tell|narrator|podcast|vlog)\b/i,
    // Dance/Motion - Seedance
    dance: /\b(dance|dancing|choreography|movement|motion|action|dynamic|animated|energetic|music video)\b/i,
    // OpenAI style - realistic, detailed
    realistic: /\b(realistic|real|photorealistic|natural|documentary|news|authentic)\b/i,
    // Quick/Simple - Kling 3 Std
    simple: /\b(simple|quick|short|basic|demo|test|preview|draft|fast)\b/i,
  };
  
  if (patterns.talking.test(lowerPrompt)) {
    return {
      model: 'wan-2-7',
      reason: '🎙️ Speech/dialogue - Wan 2.7 has excellent multi-modality and lip sync',
      confidence: 'high'
    };
  }
  
  if (patterns.dance.test(lowerPrompt)) {
    return {
      model: 'seedance-2-0',
      reason: '💃 Motion/dance - Seedance 2.0 specializes in dance and audio-synced movement',
      confidence: 'high'
    };
  }
  
  if (patterns.cinematic.test(lowerPrompt)) {
    return {
      model: 'veo3',
      reason: '🎬 Cinematic quality - Veo 3.1 for premium 1080p film-quality video',
      confidence: 'high'
    };
  }
  
  if (patterns.realistic.test(lowerPrompt)) {
    return {
      model: 'hailuo-2-3',
      reason: '📽️ Realistic video - Hailuo 2.3 Pro excels at polished professional content',
      confidence: 'high'
    };
  }
  
  if (patterns.simple.test(lowerPrompt)) {
    return {
      model: 'kling-3',
      reason: '⚡ Quick generation - Kling 3 Std is fast and affordable',
      confidence: 'medium'
    };
  }
  
  // Default to Kling 3 Standard for general requests
  return {
    model: 'kling-3',
    reason: '🎥 General video - Kling 3.0 for versatile quality',
    confidence: 'default'
  };
}

// Unified function to get best media model
function selectBestMediaModel(type, prompt) {
  if (type === 'image') {
    return selectBestImageModel(prompt);
  } else if (type === 'video') {
    return selectBestVideoModel(prompt);
  }
  return null;
}

/**
 * Get a prioritized fallback chain for image models based on the initial selection.
 * When the primary model fails, we try the next best alternative based on the use case.
 * 
 * @param {string} primaryModel - The initially selected model that failed
 * @param {string} prompt - The user's prompt (for context)
 * @returns {string[]} Array of fallback model keys to try in order
 */
function getImageModelFallbackChain(primaryModel, prompt = '') {
  const lowerPrompt = prompt.toLowerCase();
  
  // Define fallback strategies based on use case
  const fallbackStrategies = {
    // Text-heavy models: Seedream → Qwen → Nano Banana 2 → Flux
    'seedream-5-lite': ['qwen-image-2', 'nano-banana-2', 'flux-2-flex'],
    'qwen-image-2': ['seedream-5-lite', 'nano-banana-2', 'flux-2-flex'],
    
    // Artistic models: Imagen Ultra → Flux Pro → GPT Image 2 → Nano Banana 2
    'imagen-4-ultra': ['flux-2-pro', 'gpt-image-2', 'nano-banana-2'],
    
    // Photorealistic models: GPT Image 2 → Flux Pro → Imagen Ultra → Grok
    'gpt-image-2': ['flux-2-pro', 'imagen-4-ultra', 'grok-imagine'],
    'gpt-image-1-5': ['gpt-image-2', 'flux-2-pro', 'imagen-4-ultra'],
    
    // Product/Commercial: GPT Image 2 → Flux Pro → Imagen Fast
    'flux-2-pro': ['gpt-image-2', 'imagen-4-fast', 'grok-imagine'],
    'flux-2-flex': ['flux-2-pro', 'imagen-4-fast', 'nano-banana-2'],
    
    // Budget models: Nano Banana → Nano Banana 2 → Seedream → Imagen Fast
    'nano-banana': ['nano-banana-2', 'seedream-5-lite', 'imagen-4-fast'],
    'nano-banana-2': ['nano-banana', 'imagen-4-fast', 'flux-2-flex'],
    
    // Fast models: Imagen Fast → Flux Flex → Nano Banana 2
    'imagen-4-fast': ['flux-2-flex', 'nano-banana-2', 'seedream-5-lite'],
    
    // Specialty models
    'wan-2-7-image': ['gpt-image-2', 'flux-2-pro', 'nano-banana-2'],
    'grok-imagine': ['flux-2-pro', 'gpt-image-2', 'imagen-4-ultra'],
    'gpt4o-image': ['gpt-image-2', 'flux-2-pro', 'nano-banana-2'],
  };
  
  // Get the predefined fallback chain for this model
  let fallbacks = fallbackStrategies[primaryModel] || [];
  
  // If no predefined fallbacks, build a generic chain based on prompt characteristics
  if (fallbacks.length === 0) {
    const isTextHeavy = /\b(logo|text|typography|sign|poster|banner|flyer)\b/i.test(lowerPrompt);
    const isArtistic = /\b(art|artistic|fantasy|surreal|dream|magical|abstract|painting|illustration)\b/i.test(lowerPrompt);
    const isPhotorealistic = /\b(photo|photograph|realistic|real|portrait|professional)\b/i.test(lowerPrompt);
    
    if (isTextHeavy) {
      fallbacks = ['seedream-5-lite', 'qwen-image-2', 'nano-banana-2'];
    } else if (isArtistic) {
      fallbacks = ['imagen-4-ultra', 'flux-2-pro', 'nano-banana-2'];
    } else if (isPhotorealistic) {
      fallbacks = ['gpt-image-2', 'flux-2-pro', 'grok-imagine'];
    } else {
      // Generic fallback chain
      fallbacks = ['flux-2-pro', 'nano-banana-2', 'imagen-4-fast'];
    }
  }
  
  // Filter out the primary model from fallbacks (don't retry the same model)
  fallbacks = fallbacks.filter(m => m !== primaryModel);
  
  // Ensure all fallback models exist and are available
  fallbacks = fallbacks.filter(m => KIE_IMAGE_MODELS[m] && KIE_IMAGE_MODELS[m].available !== false);
  
  // Always end with nano-banana as ultimate fallback (most reliable)
  if (!fallbacks.includes('nano-banana') && KIE_IMAGE_MODELS['nano-banana']?.available !== false) {
    fallbacks.push('nano-banana');
  }
  
  return fallbacks;
}

// Export the fallback chain function
export { getImageModelFallbackChain };

// API endpoint to get smart model recommendation
async function handleMediaRecommend(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'image' or 'video'
  const prompt = searchParams.get('prompt');

  if (!type || !['image', 'video'].includes(type)) {
    return err('type must be "image" or "video"');
  }
  if (!prompt) {
    return err('prompt required');
  }

  const recommendation = selectBestMediaModel(type, prompt);
  
  // Get model details
  const modelConfig = type === 'image' 
    ? KIE_IMAGE_MODELS[recommendation.model]
    : KIE_VIDEO_MODELS[recommendation.model];
  
  return ok({
    type,
    model: recommendation.model,
    reason: recommendation.reason,
    confidence: recommendation.confidence,
    credits: modelConfig?.credits || null,
    estimatedCost: modelConfig ? `$${(modelConfig.credits * KIE_CREDIT_TO_USD).toFixed(2)}` : null,
  });
}

// Generate image or video using the unified Kie.ai API
async function handleMediaGenerate(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  let { type, model, prompt, aspectRatio = '1:1', duration = '5', conversationId } = body;

  // Ensure duration is a string
  duration = String(duration);

  if (!type || !['image', 'video'].includes(type)) return err('type must be "image" or "video"');
  if (!prompt) return err('prompt required');

  // Support "smart" mode - auto-select best model based on prompt
  let smartSelection = null;
  if (!model || model === 'smart') {
    smartSelection = selectBestMediaModel(type, prompt);
    model = smartSelection.model;
    console.log(`[Dynamic Intelligence] ${type} generation: Selected ${model} - ${smartSelection.reason}`);
  }

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  const db = await getDb();

  // Map aspect ratios to Kie.ai formats
  const imageSizeMap = {
    '1:1': 'square_hd',
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_9_16',
    '4:3': 'landscape_4_3',
  };

  try {
    if (type === 'image') {
      const modelConfig = KIE_IMAGE_MODELS[model];
      if (!modelConfig) return err(`Unknown image model: ${model}`, 400);

      let taskId, imageUrl;

      if (modelConfig.useJobsApi) {
        // Use unified Jobs API with model-specific input format
        const inputParams = modelConfig.formatInput ? 
          modelConfig.formatInput(prompt, aspectRatio) : 
          { prompt, image_size: imageSizeMap[aspectRatio] || 'square_hd' };
        
        const requestBody = {
          model: modelConfig.model,
          input: inputParams,
        };
        console.log('Kie.ai request:', JSON.stringify(requestBody, null, 2));
        
        const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify(requestBody),
        });
        const data = await res.json();
        console.log('Kie.ai response:', JSON.stringify(data, null, 2));
        
        if (data.code !== 200) {
          console.error('Kie.ai Jobs API error:', data);
          return err(data.msg || data.error || 'Image generation failed', 400);
        }

        taskId = data.data?.taskId;
        if (!taskId) return err('No task ID returned', 500);

        // Poll for completion using Jobs API
        let attempts = 0;
        const maxAttempts = 60;

        while (!imageUrl && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 3000));
          attempts++;

          const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${kieKey}` },
          });
          const statusData = await statusRes.json();

          if (statusData.code === 200) {
            const status = statusData.data?.state;
            if (status === 'success') {
              // Parse resultJson to get image URL
              try {
                const resultJson = JSON.parse(statusData.data?.resultJson || '{}');
                imageUrl = resultJson?.resultUrls?.[0] || resultJson?.url || resultJson?.image_url;
              } catch (e) {
                console.error('Failed to parse resultJson:', e);
              }
              if (imageUrl) break;
            } else if (status === 'fail') {
              return err(statusData.data?.failMsg || 'Image generation failed', 500);
            }
            // Still waiting/queuing/generating - continue polling
          }
        }
      } else {
        // Use legacy endpoint
        const res = await fetch(`https://api.kie.ai/api/v1/${modelConfig.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify({
            prompt,
            size: aspectRatio,
            nVariants: 1,
            aspectRatio: aspectRatio,
          }),
        });
        const data = await res.json();
        
        if (data.code !== 200) {
          console.error('Kie.ai image error:', data);
          return err(data.msg || 'Image generation failed', 400);
        }

        taskId = data.data?.taskId;
        if (!taskId) return err('No task ID returned', 500);

        // Poll for completion using legacy endpoint
        let attempts = 0;
        const maxAttempts = 60;

        while (!imageUrl && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 3000));
          attempts++;

          const statusRes = await fetch(`https://api.kie.ai/api/v1/${modelConfig.statusEndpoint}?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${kieKey}` },
          });
          const statusData = await statusRes.json();

          if (statusData.code === 200) {
            const status = statusData.data?.status || statusData.data?.state;
            if (status === 'SUCCESS' || status === 'success') {
              const response = statusData.data?.response;
              if (typeof response === 'string') {
                try {
                  const parsed = JSON.parse(response);
                  imageUrl = parsed?.resultUrls?.[0] || parsed?.url || parsed?.imageUrl;
                } catch (e) {
                  imageUrl = response;
                }
              } else if (response?.resultUrls) {
                imageUrl = response.resultUrls[0];
              } else if (statusData.data?.resultUrls) {
                imageUrl = statusData.data.resultUrls[0];
              } else if (statusData.data?.url) {
                imageUrl = statusData.data.url;
              } else if (statusData.data?.imageUrl) {
                imageUrl = statusData.data.imageUrl;
              }
              break;
            } else if (status === 'FAILED' || status === 'fail') {
              return err(statusData.data?.errorMessage || statusData.data?.failMsg || 'Image generation failed', 500);
            }
          }
        }
      }

      if (!imageUrl) return err('Image generation timed out', 500);

      // Save to gallery with cost tracking
      const mediaId = uuidv4();
      const modelLabels = {
        'seedream-5-lite': 'Seedream 5.0 Lite',
        'nano-banana': 'Nano Banana',
        'gpt4o-image': 'GPT-4o Image',
        'flux-pro': 'Flux Pro',
        'midjourney-v7': 'Midjourney V7',
        'gpt-image-1-5': 'GPT Image 1.5',
      };

      const credits = modelConfig.credits || 10;
      const costUsd = parseFloat((credits * KIE_CREDIT_TO_USD).toFixed(4));

      await db.collection('media_gallery').insertOne({
        id: mediaId,
        user_id: user.id,
        type: 'image',
        model,
        model_label: modelLabels[model] || model,
        prompt,
        url: imageUrl,
        aspect_ratio: aspectRatio,
        conversation_id: conversationId || null,
        credits_used: credits,
        cost_usd: costUsd,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      return ok({ success: true, url: imageUrl, mediaId, type: 'image' });

    } else if (type === 'video') {
      const modelConfig = KIE_VIDEO_MODELS[model];
      if (!modelConfig) return err(`Unknown video model: ${model}`, 400);

      let taskId;
      const aspectRatioForVideo = aspectRatio === '1:1' ? '16:9' : aspectRatio;

      if (modelConfig.useJobsApi) {
        // Use unified Jobs API for video generation
        const safeAspectRatio = aspectRatioForVideo || '16:9';
        const safeDuration = duration || '5';
        const inputData = modelConfig.formatInput 
          ? modelConfig.formatInput(prompt, safeAspectRatio, safeDuration)
          : { prompt, duration: safeDuration, aspect_ratio: '16:9' };
        
        const requestBody = {
          model: modelConfig.model,
          input: inputData,
        };
        
        console.log('Kie.ai video request body:', JSON.stringify(requestBody, null, 2));
        console.log('Video generation params - duration:', safeDuration, 'aspectRatio:', safeAspectRatio);
        
        const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify(requestBody),
        });
        const data = await res.json();
        
        console.log('Kie.ai Jobs API video response:', JSON.stringify(data).substring(0, 500));

        if (data.code !== 200) {
          console.error('Kie.ai Jobs API video error:', data);
          return err(data.msg || data.error || 'Video generation failed', 400);
        }

        taskId = data.data?.taskId;
      } else {
        // Use legacy endpoint
        const videoParams = {
          prompt,
          ...modelConfig.params,
          aspectRatio: aspectRatioForVideo,
        };

        const res = await fetch(`https://api.kie.ai/api/v1/${modelConfig.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify(videoParams),
        });
        const data = await res.json();

        console.log('Kie.ai legacy video response:', JSON.stringify(data).substring(0, 500));

        if (data.code !== 200) {
          console.error('Kie.ai video error:', data);
          return err(data.msg || 'Video generation failed', 400);
        }

        taskId = data.data?.taskId;
      }

      if (!taskId) return err('No task ID returned', 500);

      // Store video job for async polling
      const mediaId = uuidv4();
      const modelLabels = {
        'kling-3': 'Kling 3.0 (Std)',
        'kling-3-pro': 'Kling 3.0 (Pro)',
        'sora-2': 'Sora 2',
        'sora-2-pro': 'Sora 2 Pro (HD)',
        'kling-2-6': 'Kling 2.6',
        'wan-2-6': 'Wan 2.6',
        'seedance-1-5': 'Seedance 1.5 Pro',
        'seedance-2-0': 'Seedance 2.0',
        'seedance-2-0-fast': 'Seedance 2.0 Fast',
        'veo3': 'Veo 3.1',
      };

      // Estimated generation times by model (in seconds)
      const estimatedTimes = {
        'kling-3': '2-4 min',
        'kling-3-pro': '3-5 min',
        'sora-2': '3-5 min',
        'sora-2-pro': '5-8 min',
        'veo3': '3-8 min',
        'seedance-1-5': '2-4 min',
        'seedance-2-0': '2-5 min',
        'seedance-2-0-fast': '1-3 min',
      };

      const credits = modelConfig.credits || 50;
      const costUsd = parseFloat((credits * KIE_CREDIT_TO_USD).toFixed(4));

      await db.collection('media_gallery').insertOne({
        id: mediaId,
        user_id: user.id,
        type: 'video',
        model,
        model_label: modelLabels[model] || model,
        prompt,
        url: null, // Will be updated when complete
        task_id: taskId,
        status: 'generating',
        aspect_ratio: aspectRatioForVideo,
        conversation_id: conversationId || null,
        credits_used: credits,
        cost_usd: costUsd,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        use_jobs_api: modelConfig.useJobsApi || false, // Track which API to use for status
      });

      return ok({ 
        success: true, taskId, mediaId, type: 'video', status: 'generating',
        estimatedTime: estimatedTimes[model] || '2-5 min',
        modelLabel: modelLabels[model] || model,
        modelId: model,
      });
    }
  } catch (e) {
    console.error('Media generation error:', e);
    return err('Media generation failed: ' + e.message, 500);
  }
}

// Poll video/image status by taskId path param (for /api/media/status/:taskId)
async function handleMediaStatusByTaskId(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  if (!taskId) return err('taskId required');
  
  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);
  
  const db = await getDb();
  
  // Find the media item by task_id
  const media = await db.collection('media_gallery').findOne({ task_id: taskId, user_id: user.id });
  
  // Also check video_jobs collection
  if (!media) {
    // First try with user_id, then fallback to task_id only (handles user_id format mismatches)
    let videoJob = await db.collection('video_jobs').findOne({ task_id: taskId, user_id: user.id });
    if (!videoJob) {
      videoJob = await db.collection('video_jobs').findOne({ task_id: taskId });
      if (videoJob) {
        console.warn(`[VideoStatus] Task ${taskId} found without user_id match: job.user_id=${videoJob.user_id}, request.user_id=${user.id}`);
      }
    }
    if (!videoJob) {
      console.error(`[VideoStatus] Task ${taskId} not found in video_jobs at all. user_id=${user.id}`);
      return err('Media not found', 404);
    }
    
    // If job is already complete/failed
    if ((videoJob.status === 'success' || videoJob.status === 'completed') && videoJob.video_url) {
      return ok({ status: 'success', url: videoJob.video_url, videoUrl: videoJob.video_url, thumbnail_url: videoJob.thumbnail_url, thumbnailUrl: videoJob.thumbnail_url });
    }
    if (videoJob.status === 'failed') {
      return ok({ status: 'failed', error: videoJob.error });
    }
    
    // Poll Kie.ai using model-specific status endpoint via unified handler
    try {
      const jobModel = videoJob.model || videoJob.model_id || 'kling-3.0';
      
      // Check if job is too old (>15 minutes) — likely stuck/failed on provider side
      const jobAge = videoJob.created_at ? (Date.now() - new Date(videoJob.created_at).getTime()) : 0;
      if (jobAge > 15 * 60 * 1000) {
        console.warn(`[VideoStatus] Job ${taskId} is ${Math.round(jobAge/60000)} minutes old — marking as timed out`);
        await db.collection('video_jobs').updateOne(
          { task_id: taskId },
          { $set: { status: 'failed', error: 'Video generation timed out on provider side', timed_out_at: new Date() } }
        );
        return ok({ status: 'failed', error: 'Video generation timed out. The provider may be experiencing delays with this format. Try a different model or aspect ratio.' });
      }
      
      // Use appropriate status checker based on model type
      const result = jobModel === 'runway-extend' 
        ? await checkExtendStatus(taskId, kieKey)
        : jobModel === 'wan-i2v'
        ? await checkImageToVideoStatus(taskId, kieKey)
        : await checkVideoStatus(jobModel, taskId, kieKey);
      
      // Track consecutive errors for stuck detection
      if (result.providerError || result.rateLimited) {
        const errorCount = (videoJob.consecutive_errors || 0) + 1;
        await db.collection('video_jobs').updateOne(
          { task_id: taskId },
          { $set: { consecutive_errors: errorCount, last_error_at: new Date() } }
        );
        // After 10 consecutive provider errors (~60s of failures), mark as failed
        if (errorCount >= 10) {
          await db.collection('video_jobs').updateOne(
            { task_id: taskId },
            { $set: { status: 'failed', error: 'Video provider is experiencing persistent issues. Please try again later.' } }
          );
          return ok({ status: 'failed', error: 'Video provider is temporarily unavailable. Please try again in a few minutes.' });
        }
      } else if (result.status === 'generating') {
        // Reset error count on successful polling
        if (videoJob.consecutive_errors > 0) {
          await db.collection('video_jobs').updateOne(
            { task_id: taskId },
            { $set: { consecutive_errors: 0 } }
          );
        }
      }
      
      if (result.status === 'success' && result.videoUrl) {
        await db.collection('video_jobs').updateOne(
          { task_id: taskId },
          { $set: { status: 'success', video_url: result.videoUrl, thumbnail_url: result.thumbnailUrl, completed_at: new Date() } }
        );
        if (videoJob.message_id) {
          await db.collection('messages').updateOne(
            { id: videoJob.message_id },
            { $set: { video_url: result.videoUrl, thumbnail_url: result.thumbnailUrl, 'video_task.status': 'success' } }
          );
          console.log('[VideoStatus] Updated message', videoJob.message_id, 'with video_url from', jobModel);
        }
        return ok({ status: 'success', url: result.videoUrl, videoUrl: result.videoUrl, thumbnail_url: result.thumbnailUrl, thumbnailUrl: result.thumbnailUrl });
      } else if (result.status === 'failed') {
        await db.collection('video_jobs').updateOne(
          { task_id: taskId },
          { $set: { status: 'failed', error: result.error, completed_at: new Date() } }
        );
        return ok({ status: 'failed', error: result.error });
      }
      
      // Enhanced generating response with model-specific UX data
      const elapsedMs = videoJob.created_at ? (Date.now() - new Date(videoJob.created_at).getTime()) : 0;
      const elapsedSeconds = Math.round(elapsedMs / 1000);
      const modelUx = VIDEO_MODEL_UX[jobModel] || VIDEO_MODEL_UX['kling-3.0'];
      const modelConfig = VIDEO_MODELS[jobModel];
      const progressPct = calculateModelProgress(jobModel, elapsedMs);
      const statusMessage = getProgressMessage(jobModel, progressPct);
      
      return ok({ 
        status: 'generating', 
        progress: result.progress || 'processing...', 
        statusMessage,
        estimatedTime: modelUx.estimatedTimeLabel,
        modelLabel: modelConfig?.label || jobModel,
        modelId: jobModel,
        elapsedSeconds,
        progressPct,
        pollTimeoutMs: modelUx.pollTimeoutMs,
        stuckWarningMs: modelUx.stuckWarningMs,
      });
    } catch (e) {
      console.error('[VideoStatus] Poll error for task', taskId, ':', e.message);
      // Track catch-block errors too
      const errorCount = (videoJob.consecutive_errors || 0) + 1;
      await db.collection('video_jobs').updateOne(
        { task_id: taskId },
        { $set: { consecutive_errors: errorCount, last_error: e.message, last_error_at: new Date() } }
      ).catch(() => {});
      // After many errors, fail the job instead of returning "generating" forever
      if (errorCount >= 15) {
        await db.collection('video_jobs').updateOne(
          { task_id: taskId },
          { $set: { status: 'failed', error: 'Video status check failed repeatedly: ' + e.message } }
        ).catch(() => {});
        return ok({ status: 'failed', error: 'Unable to check video status. The provider may be unreachable.' });
      }
      return ok({ status: 'generating', progress: 'checking...', modelId: jobModel, modelLabel: VIDEO_MODELS[jobModel]?.label || jobModel, estimatedTime: (VIDEO_MODEL_UX[jobModel] || VIDEO_MODEL_UX['kling-3.0']).estimatedTimeLabel });
    }
  }
  
  // If found in media_gallery, handle as before
  if (media.status === 'completed' && media.url) {
    return ok({ status: 'completed', url: media.url, thumbnail_url: media.thumbnail_url });
  }
  if (media.status === 'failed') {
    return ok({ status: 'failed', error: media.error });
  }
  
  // Poll Kie.ai
  try {
    const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    const data = await statusRes.json();
    const result = await processVideoStatus(db, media, data);
    
    // Extract the JSON data from the NextResponse object
    const resultData = await result.json();
    
    // If still generating, add enhanced UX fields for media_gallery items
    if (resultData.status === 'generating') {
      const jobModel = media.model || 'kling-3';
      const elapsedMs = media.created_at ? (Date.now() - new Date(media.created_at).getTime()) : 0;
      const elapsedSeconds = Math.round(elapsedMs / 1000);
      const modelUx = VIDEO_MODEL_UX[jobModel] || VIDEO_MODEL_UX['kling-3.0'];
      const modelConfig = VIDEO_MODELS[jobModel];
      const progressPct = calculateModelProgress(jobModel, elapsedMs);
      const statusMessage = getProgressMessage(jobModel, progressPct);
      
      return ok({ 
        status: 'generating', 
        progress: resultData.progress || 'processing...', 
        statusMessage,
        estimatedTime: modelUx.estimatedTimeLabel,
        modelLabel: modelConfig?.label || media.model_label || jobModel,
        modelId: jobModel,
        elapsedSeconds,
        progressPct,
        pollTimeoutMs: modelUx.pollTimeoutMs,
        stuckWarningMs: modelUx.stuckWarningMs,
      });
    }
    
    return result;
  } catch (e) {
    console.error('Media status error:', e);
    return ok({ status: 'generating', progress: 'checking...' });
  }
}

// Check status of async media generation (videos)
async function handleMediaStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const taskId = url.searchParams.get('taskId');
  if (!taskId) return err('taskId required');

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  const db = await getDb();
  
  // Find the media item
  const media = await db.collection('media_gallery').findOne({ task_id: taskId, user_id: user.id });
  if (!media) return err('Media not found', 404);

  // If already completed, return cached result
  if (media.status === 'completed' && media.url) {
    return ok({ status: 'completed', url: media.url, thumbnail_url: media.thumbnail_url });
  }
  if (media.status === 'failed') {
    return ok({ status: 'failed', error: media.error });
  }

  try {
    // Determine which endpoint to use based on model
    const modelConfig = KIE_VIDEO_MODELS[media.model];
    let statusRes;
    
    // Use the unified Jobs API query endpoint for all models
    statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    
    const data = await statusRes.json();
    console.log('Video status response for model', media.model, ':', JSON.stringify(data).substring(0, 500));
    return processVideoStatus(db, media, data);
  } catch (e) {
    console.error('Media status error:', e);
    return ok({ status: 'generating', progress: 'checking...' });
  }
}

// Helper to process video status response
async function processVideoStatus(db, media, data) {
  if (data.code !== 200) {
    return ok({ status: 'generating', progress: 'processing...' });
  }

  const state = data.data?.status?.toLowerCase() || data.data?.state?.toLowerCase();
  
  // Handle all success-equivalent states from Kie.ai (different models return different states)
  if (state === 'success' || state === 'completed' || state === 'succeed') {
    // Video ready - check the output object (Jobs API format)
    let videoUrl = null;
    let thumbnailUrl = null;
    const output = data.data?.output || {};
    
    // Jobs API format - output object
    videoUrl = output.video_url || output.videoUrl || output.url;
    thumbnailUrl = output.cover_url || output.coverUrl || output.imageUrl;
    
    // Try parsing resultJson if output didn't have the URL
    if (!videoUrl && data.data?.resultJson) {
      try {
        const resultJson = JSON.parse(data.data.resultJson);
        videoUrl = resultJson?.resultUrls?.[0] || 
                   resultJson?.videoUrl || 
                   resultJson?.url ||
                   resultJson?.video_url;
        thumbnailUrl = thumbnailUrl || resultJson?.thumbnail || 
                       resultJson?.coverUrl ||
                       resultJson?.cover_url;
        console.log('Parsed resultJson for video:', { videoUrl, thumbnailUrl });
      } catch (e) {
        console.error('Failed to parse video resultJson:', e);
      }
    }
    
    // Fall back to direct fields (legacy API format)
    if (!videoUrl) {
      videoUrl = data.data?.works?.[0]?.resource || 
                 data.data?.resultUrls?.[0] || 
                 data.data?.videoUrl ||
                 data.data?.url;
      thumbnailUrl = thumbnailUrl || 
                     data.data?.works?.[0]?.coverImage || 
                     data.data?.thumbnail ||
                     data.data?.coverUrl;
    }

    if (videoUrl) {
      // Update media_gallery record
      await db.collection('media_gallery').updateOne(
        { id: media.id },
        { $set: { status: 'completed', url: videoUrl, thumbnail_url: thumbnailUrl, completed_at: new Date() } }
      );
      
      // Also update the video_jobs collection if there's a matching task
      if (media.task_id) {
        await db.collection('video_jobs').updateOne(
          { task_id: media.task_id },
          { $set: { status: 'success', video_url: videoUrl, thumbnail_url: thumbnailUrl, completed_at: new Date() } }
        ).catch(e => console.log('[processVideoStatus] video_jobs update skipped:', e.message));
      }
      
      // Also update the messages collection so the video URL persists in chat history
      // This is critical — without this, users who navigate away won't see the video on return
      if (media.task_id) {
        const videoJob = await db.collection('video_jobs').findOne({ task_id: media.task_id });
        if (videoJob?.message_id) {
          await db.collection('messages').updateOne(
            { id: videoJob.message_id },
            { $set: { video_url: videoUrl, thumbnail_url: thumbnailUrl, 'video_task.status': 'success' } }
          ).catch(e => console.log('[processVideoStatus] message update skipped:', e.message));
          console.log('[processVideoStatus] Updated message', videoJob.message_id, 'with video_url');
        }
      }
      
      return ok({ status: 'completed', url: videoUrl, thumbnail_url: thumbnailUrl, videoUrl, thumbnailUrl, completed_at: new Date().toISOString() });
    } else {
      console.log('Video status success but no URL found in:', JSON.stringify(data.data).substring(0, 500));
    }
  } else if (state === 'fail' || state === 'failed' || state === 'error') {
    const error = data.data?.error || data.data?.failMsg || data.data?.errorMessage || 'Generation failed';
    await db.collection('media_gallery').updateOne(
      { id: media.id },
      { $set: { status: 'failed', error } }
    );
    return ok({ status: 'failed', error });
  }

  return ok({ status: 'generating', progress: state || 'processing...' });
}

// Get user's media gallery
// Get all pending/generating media tasks for the user (for global background polling)
// Also includes recently-completed tasks (within last 30 seconds) to ensure the frontend
// doesn't miss completions that happen between two polling intervals
async function handleMediaPending(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const kieKey = process.env.KIE_API_KEY;
  
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const recentCompletionWindow = new Date(Date.now() - 30 * 1000); // 30 second window
  
  // Find all video jobs that are still generating (last 4 hours)
  // ALSO include recently-completed jobs so the frontend can catch transitions it may have missed
  const pendingJobs = await db.collection('video_jobs')
    .find({ 
      user_id: user.id, 
      $or: [
        { status: 'generating', created_at: { $gte: fourHoursAgo } },
        { status: 'success', completed_at: { $gte: recentCompletionWindow } },
        { status: 'failed', completed_at: { $gte: recentCompletionWindow } },
      ]
    })
    .sort({ created_at: -1 })
    .limit(20)
    .toArray();
  
  // Also look up conversation titles for notifications
  const convIds = [...new Set(pendingJobs.map(j => j.conversation_id).filter(Boolean))];
  const conversations = convIds.length > 0 
    ? await db.collection('conversations').find({ id: { $in: convIds } }).toArray()
    : [];
  const convMap = {};
  conversations.forEach(c => { convMap[c.id] = c.title || 'Untitled Chat'; });
  
  // Check status of each pending job and update if completed
  const results = [];
  for (const job of pendingJobs) {
    let status = job.status || 'generating';
    let videoUrl = job.video_url || null;
    let thumbnailUrl = job.thumbnail_url || null;
    
    // If job is already completed/failed (from recently-completed query), just return it directly
    if (job.status === 'success' && job.video_url) {
      results.push({
        taskId: job.task_id, status: 'success', videoUrl: job.video_url, thumbnailUrl: job.thumbnail_url,
        prompt: job.prompt, model: job.model,
        modelLabel: VIDEO_MODELS[job.model]?.label || job.model,
        conversationId: job.conversation_id,
        conversationTitle: convMap[job.conversation_id] || 'Chat',
        messageId: job.message_id, type: job.type || 'video',
        createdAt: job.created_at, completedAt: job.completed_at,
      });
      continue;
    }
    if (job.status === 'failed') {
      results.push({
        taskId: job.task_id, status: 'failed', videoUrl: null, thumbnailUrl: null,
        prompt: job.prompt, model: job.model, error: job.error,
        modelLabel: VIDEO_MODELS[job.model]?.label || job.model,
        conversationId: job.conversation_id,
        conversationTitle: convMap[job.conversation_id] || 'Chat',
        messageId: job.message_id, type: job.type || 'video',
        createdAt: job.created_at, completedAt: job.completed_at,
      });
      continue;
    }
    
    // Auto-fail jobs older than 4 hours (they're certainly not still processing)
    const jobAge = Date.now() - new Date(job.created_at).getTime();
    if (jobAge > 4 * 60 * 60 * 1000) {
      status = 'failed';
      await db.collection('video_jobs').updateOne(
        { task_id: job.task_id },
        { $set: { status: 'failed', error: 'Generation timed out after 4 hours' } }
      );
      if (job.message_id) {
        await db.collection('messages').updateOne(
          { id: job.message_id },
          { $set: { 'video_task.status': 'failed', 'video_task.error': 'Generation timed out' } }
        );
      }
      results.push({
        taskId: job.task_id, status, videoUrl, thumbnailUrl,
        prompt: job.prompt, model: job.model,
        modelLabel: VIDEO_MODELS[job.model]?.label || job.model,
        conversationId: job.conversation_id,
        conversationTitle: convMap[job.conversation_id] || 'Chat',
        messageId: job.message_id, type: job.type || 'video',
        createdAt: job.created_at,
      });
      continue;
    }
    
    // Try to check actual status from Kie.ai
    if (kieKey && job.task_id && job.model) {
      try {
        // Use appropriate status checker based on model type
        const jobModel = job.model || job.model_id || 'kling-3.0';
        const result = jobModel === 'runway-extend' 
          ? await checkExtendStatus(job.task_id, kieKey)
          : jobModel === 'wan-i2v'
          ? await checkImageToVideoStatus(job.task_id, kieKey)
          : await checkVideoStatus(jobModel, job.task_id, kieKey);
        if (result.status === 'success') {
          status = 'success';
          videoUrl = result.videoUrl;
          thumbnailUrl = result.thumbnailUrl;
          
          // ── SPELLING GUARD: Text Overlay for Videos ──
          // If the source image had text that was removed before animation,
          // overlay the correct text back onto the completed video
          if (videoUrl && job.text_overlay_elements && job.text_overlay_elements.length > 0) {
            console.log(`[SpellingGuard:Video] Applying text overlay to completed video (${job.text_overlay_elements.length} elements)...`);
            try {
              const { overlayTextOnVideo } = await import('@/lib/handlers/spelling-guard');
              const overlayBuffer = await overlayTextOnVideo(videoUrl, job.text_overlay_elements);
              
              if (overlayBuffer) {
                // Upload the text-overlaid video to permanent storage
                const overlayBase64 = overlayBuffer.toString('base64');
                const uploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                  body: JSON.stringify({
                    base64Data: `data:video/mp4;base64,${overlayBase64}`,
                    uploadPath: 'soulprint/videos-overlay',
                    fileName: `overlay_${Date.now()}.mp4`,
                  }),
                });
                
                if (uploadRes.ok) {
                  const uploadData = await uploadRes.json();
                  const overlayUrl = uploadData.data?.downloadUrl || uploadData.downloadUrl;
                  if ((uploadData.success || uploadData.code === 200) && overlayUrl) {
                    console.log('[SpellingGuard:Video] ✅ Text overlay applied! New URL:', overlayUrl.substring(0, 80));
                    videoUrl = overlayUrl;
                  }
                }
              }
            } catch (overlayErr) {
              console.log('[SpellingGuard:Video] Text overlay failed (using original):', overlayErr.message);
            }
          }
          
          // Update DB with completed_at timestamp
          await db.collection('video_jobs').updateOne(
            { task_id: job.task_id },
            { $set: { status: 'success', video_url: videoUrl, thumbnail_url: thumbnailUrl, completed_at: new Date() } }
          );
          // Also update the message
          if (job.message_id) {
            await db.collection('messages').updateOne(
              { id: job.message_id },
              { $set: { video_url: videoUrl, thumbnail_url: thumbnailUrl, 'video_task.status': 'success' } }
            );
          }
        } else if (result.status === 'failed') {
          status = 'failed';
          await db.collection('video_jobs').updateOne(
            { task_id: job.task_id },
            { $set: { status: 'failed', error: result.error, completed_at: new Date() } }
          );
          if (job.message_id) {
            await db.collection('messages').updateOne(
              { id: job.message_id },
              { $set: { 'video_task.status': 'failed', 'video_task.error': result.error || 'Generation failed' } }
            );
          }
        }
      } catch (e) {
        console.log('[MediaPending] Status check failed for', job.task_id, '-', e.message);
      }
    }
    
    results.push({
      taskId: job.task_id,
      status,
      videoUrl,
      thumbnailUrl,
      error: status === 'failed' ? (job.error || 'Generation failed') : undefined,
      prompt: job.prompt,
      model: job.model,
      modelLabel: VIDEO_MODELS[job.model]?.label || job.model,
      conversationId: job.conversation_id,
      conversationTitle: convMap[job.conversation_id] || 'Chat',
      messageId: job.message_id,
      type: job.type || 'video',
      createdAt: job.created_at,
      completedAt: job.completed_at,
    });
  }
  
  return NextResponse.json(results);
}

async function handleMediaGallery(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  const items = await db.collection('media_gallery')
    .find({ 
      user_id: user.id,
      $or: [
        { status: { $ne: 'failed' } },
        { status: { $exists: false } }
      ]
    })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray();

  return NextResponse.json(items);
}

// Delete media item from gallery
async function handleDeleteMedia(request, mediaId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  if (!mediaId) return err('mediaId required');

  const db = await getDb();
  
  // Find and verify ownership
  const item = await db.collection('media_gallery').findOne({ id: mediaId });
  if (!item) return err('Media not found', 404);
  if (item.user_id !== user.id) return err('Unauthorized', 403);

  // Delete from media_gallery
  await db.collection('media_gallery').deleteOne({ id: mediaId });

  // Also delete from video_jobs if it's a video
  if (item.type === 'video' && item.task_id) {
    await db.collection('video_jobs').deleteOne({ task_id: item.task_id });
  }

  return ok({ success: true, deletedId: mediaId });
}

// Save media item to gallery (from chat card)
async function handleSaveToGallery(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { url, prompt, model, modelLabel, type, conversationId } = body;
  if (!url) return err('url required');

  try {
    const db = await getDb();
    const mediaId = uuidv4();
    
    await db.collection('media_gallery').insertOne({
      id: mediaId,
      user_id: user.id,
      type: type || 'image',
      model: model || 'unknown',
      model_label: modelLabel || model || 'AI Generated',
      prompt: prompt || '',
      url: url,
      conversation_id: conversationId || null,
      credits_used: 0,
      cost_usd: 0,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    return ok({ success: true, mediaId });
  } catch (error) {
    console.error('[SaveToGallery] Error:', error);
    return err(error.message || 'Failed to save to gallery', 500);
  }
}


// FEEDBACK - Submit
async function handleSubmitFeedback(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { conversation_id, message_id, rating, note, context } = body;

  const db = await getDb();
  await db.collection('feedback').insertOne({
    id: uuidv4(),
    user_id: user.id,
    conversation_id,
    message_id,
    rating, // 'up' or 'down'
    note: note || '',
    context: context || {}, // Store model info and timestamp
    created_at: new Date(),
  });

  // Update message with feedback for analytics
  if (conversation_id && message_id) {
    await db.collection('conversations').updateOne(
      { id: conversation_id, 'messages.id': message_id },
      { $set: { 'messages.$.user_feedback': rating } }
    );
  }

  return ok({ success: true });
}

// USER FEEDBACK - Submit general feedback (not message-specific)
// Allows both authenticated and anonymous feedback
async function handleSubmitUserFeedback(request) {
  const user = await authenticate(request);
  // Note: user can be null for anonymous feedback

  const body = await request.json();
  const { message, category, rating, attachment } = body;

  if (!message || message.trim().length < 5) {
    return err('Please provide feedback message (at least 5 characters)', 400);
  }

  const feedbackId = uuidv4();
  const db = await getDb();
  
  // Prepare feedback document
  const feedbackDoc = {
    id: feedbackId,
    user_id: user?.id || null,
    user_email: user?.email || 'anonymous',
    anonymous: !user,
    message: message.trim(),
    category: category || 'general', // general, bug, feature, other
    rating: rating || null, // 1-5 optional rating
    status: 'new', // new, reviewed, resolved
    created_at: new Date(),
  };
  
  // Handle attachment if provided (base64 image)
  if (attachment && attachment.base64 && attachment.mimeType) {
    feedbackDoc.attachment = {
      name: attachment.name || 'screenshot.png',
      mimeType: attachment.mimeType,
      base64: attachment.base64,
    };
  }
  
  await db.collection('user_feedback').insertOne(feedbackDoc);

  // If category is "bug", also create a support ticket so it appears in the admin Support tab
  if (category === 'bug') {
    const ticketId = uuidv4();
    const supportTicket = {
      id: ticketId,
      user_id: user?.id || null,
      user_email: user?.email || 'anonymous',
      user_name: user?.display_name || user?.name || user?.email || 'Anonymous',
      subject: `Bug Report: ${message.trim().substring(0, 80)}${message.length > 80 ? '...' : ''}`,
      description: message.trim(),
      status: 'new',
      source: 'feedback_bug',
      feedback_id: feedbackId,
      rating: rating || null,
      attachment: feedbackDoc.attachment || null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await db.collection('support_tickets').insertOne(supportTicket);
    console.log(`[Feedback→Support] Bug feedback ${feedbackId} also created support ticket ${ticketId}`);
  }

  // Send notification email to team@archforge.com
  const emailSource = user?.email || 'Anonymous User';
  _sendFeedbackNotificationEmail(emailSource, message.trim(), category, rating, attachment).catch(err => {
    console.error('Failed to send feedback notification email:', err);
  });

  return ok({ success: true, message: 'Thank you for your feedback!' });
}

// Helper to send feedback notification via email
async function _sendFeedbackNotificationEmail(userEmail, feedbackMessage, category, rating, attachment) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log(`[FEEDBACK] Email not sent - no RESEND_API_KEY. From: ${userEmail} | Category: ${category}`);
    return;
  }

  const categoryEmoji = { 'general': '💬', 'bug': '🐛', 'feature': '💡', 'other': '📝' }[category] || '💬';
  const ratingDisplay = rating ? `${'⭐'.repeat(rating)} (${rating}/5)` : 'Not provided';

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 24px; color: white;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #f97316;">🔔 New SoulPrint Feedback</h1>
        <p style="margin: 0; color: #9ca3af; font-size: 14px;">A user has submitted feedback</p>
      </div>
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 16px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">From:</td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${userEmail}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Category:</td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${categoryEmoji} ${(category || 'general').charAt(0).toUpperCase() + (category || 'general').slice(1)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Rating:</td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${ratingDisplay}</td></tr>
        </table>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-top: 16px;">
        <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Feedback Message</h3>
        <p style="margin: 0; color: #1f2937; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${feedbackMessage}</p>
      </div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">SoulPrint Feedback System • ${new Date().toLocaleString()}</p>
      </div>
    </div>`;

  const emailPayload = {
    from: 'SoulPrint Feedback <team@soulprintengine.ai>',
    to: ['team@archforge.com'],
    subject: `${categoryEmoji} New Feedback: ${(category || 'general').charAt(0).toUpperCase() + (category || 'general').slice(1)} from ${userEmail}`,
    html: htmlContent,
  };
  if (attachment && attachment.base64) {
    emailPayload.attachments = [{ filename: attachment.name || 'screenshot.png', content: attachment.base64 }];
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emailPayload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to send email');
  console.log(`[FEEDBACK] Email sent to team@archforge.com - ID: ${result.id}`);
}

// CONTACT FORM - Send email to team@archforge.com
async function handleContactForm(request) {
  try {
    const { name, email, subject, message } = await request.json();

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return err('All fields are required', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return err('Invalid email address', 400);
    }

    // Send email using Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return err('Email service not configured', 500);
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SoulPrint Contact <team@soulprintengine.ai>',
        to: ['team@archforge.com'],
        reply_to: email,
        subject: `[Contact Form] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f97316;">New Contact Form Submission</h2>
            <hr style="border: 1px solid #eee;" />
            <p><strong>From:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr style="border: 1px solid #eee;" />
            <h3>Message:</h3>
            <p style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 8px;">${message}</p>
            <hr style="border: 1px solid #eee;" />
            <p style="color: #888; font-size: 12px;">
              This message was sent via the SoulPrint contact form.<br/>
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Resend error:', errorData);
      return err('Failed to send email. Please try again.', 500);
    }

    // Store in database for records
    const db = await getDb();
    await db.collection('contact_submissions').insertOne({
      id: uuidv4(),
      name,
      email,
      subject,
      message,
      created_at: new Date(),
    });

    return ok({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Contact form error:', error);
    return err('Something went wrong. Please try again.', 500);
  }
}

// ADMIN - Get all user feedback

// ADMIN - Update feedback status

// ADMIN - Summarize feedback using LLM

// ============================================================


export {
  selectBestImageModel,
  selectBestVideoModel,
  selectBestMediaModel,
  handleMediaRecommend,
  handleMediaGenerate,
  handleMediaStatusByTaskId,
  handleMediaStatus,
  processVideoStatus,
  handleMediaPending,
  handleMediaGallery,
  handleDeleteMedia,
  handleSaveToGallery,
  handleSubmitFeedback,
  handleSubmitUserFeedback,
  handleContactForm,
};
