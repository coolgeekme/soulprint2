import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';

// ============================================================
// IMAGE GENERATION - DALL-E 3
// ============================================================

async function handleGenerateImage(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { prompt, size = '1024x1024', quality = 'standard', style = 'vivid', conversationId } = body;
  if (!prompt) return err('prompt required');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return err('OpenAI key not configured', 500);

  try {
    console.log('[handleGenerateImage] Starting DALL-E 3 request:', { prompt: prompt.substring(0, 100), size, quality, style });
    
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality, style }),
    });
    const data = await res.json();
    
    if (!res.ok) {
      console.error('[handleGenerateImage] API Error:', res.status, JSON.stringify(data));
      return err(data.error?.message || `API returned status ${res.status}`, res.status);
    }
    
    if (data.error) {
      console.error('[handleGenerateImage] Response Error:', JSON.stringify(data.error));
      return err(data.error.message, 400);
    }

    const imageUrl = data.data?.[0]?.url;
    const revisedPrompt = data.data?.[0]?.revised_prompt || prompt;
    
    if (!imageUrl) {
      console.error('[handleGenerateImage] No URL in response:', JSON.stringify(data));
      return err('No image URL returned from API', 500);
    }
    
    console.log('[handleGenerateImage] Success! URL:', imageUrl.substring(0, 80) + '...');

    // Save to media gallery
    const db = await getDb();
    const mediaId = uuidv4();
    await db.collection('media_gallery').insertOne({
      id: mediaId,
      user_id: user.id,
      type: 'image',
      url: imageUrl,
      prompt,
      revised_prompt: revisedPrompt,
      model: 'dall-e-3',
      provider: 'openai',
      created_at: new Date(),
    });

    // Save as a message in DB if conversationId provided
    if (conversationId) {
      await db.collection('messages').insertOne({
        id: uuidv4(), conversation_id: conversationId, user_id: user.id,
        role: 'assistant',
        content: `![Generated Image](${imageUrl})\n\n*Prompt: ${revisedPrompt}*`,
        content_type: 'image',
        image_url: imageUrl,
        created_at: new Date(),
        model_used: 'dall-e-3',
        provider_used: 'openai',
        est_input_tokens: Math.round(prompt.length / 4),
        est_output_tokens: 0,
      });
    }

    return ok({ url: imageUrl, revised_prompt: revisedPrompt, mediaId });
  } catch (e) {
    console.error('Image generation error:', e);
    return err('Image generation failed: ' + e.message, 500);
  }
}

// ============================================================
// IMAGE GENERATION - Kie.ai (GPT-4o Image)
// ============================================================

async function handleGenerateImageKie(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { prompt, aspectRatio = '1:1', nVariants = 1, conversationId } = body;
  if (!prompt) return err('prompt required');

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  try {
    console.log('[handleGenerateImageKie] Starting Kie.ai request:', { prompt: prompt.substring(0, 100), aspectRatio, nVariants });
    
    const res = await fetch('https://api.kie.ai/api/v1/gpt4o-image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
      body: JSON.stringify({
        prompt,
        size: aspectRatio,
        nVariants: Math.min(nVariants, 4),
      }),
    });
    const data = await res.json();
    
    if (!res.ok || data.code !== 200) {
      console.error('[handleGenerateImageKie] API Error:', res.status, JSON.stringify(data));
      return err(data.msg || `API returned status ${res.status}`, 400);
    }

    const taskId = data.data?.taskId;
    if (!taskId) return err('No task ID returned', 500);

    // Poll for completion (max 2 minutes)
    let imageUrl = null;
    let attempts = 0;
    const maxAttempts = 40;
    
    while (!imageUrl && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 3000));
      attempts++;
      
      const statusRes = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${kieKey}` },
      });
      const statusData = await statusRes.json();
      
      if (statusData.code === 200 && statusData.data?.status === 'SUCCESS') {
        const response = statusData.data?.response;
        if (typeof response === 'string') {
          const parsed = JSON.parse(response);
          imageUrl = parsed?.resultUrls?.[0];
        } else if (response?.resultUrls) {
          imageUrl = response.resultUrls[0];
        }
        break;
      } else if (statusData.data?.status === 'FAILED') {
        return err(statusData.data?.errorMessage || 'Image generation failed', 500);
      }
    }

    if (!imageUrl) return err('Image generation timed out', 504);

    // Save to media gallery
    const db = await getDb();
    const mediaId = uuidv4();
    await db.collection('media_gallery').insertOne({
      id: mediaId,
      user_id: user.id,
      type: 'image',
      url: imageUrl,
      prompt,
      model: 'gpt-4o-image',
      provider: 'kie',
      created_at: new Date(),
    });

    // Save as a message if conversationId provided
    if (conversationId) {
      await db.collection('messages').insertOne({
        id: uuidv4(), conversation_id: conversationId, user_id: user.id,
        role: 'assistant',
        content: `![Generated Image](${imageUrl})\n\n*Prompt: ${prompt}*`,
        content_type: 'image',
        image_url: imageUrl,
        created_at: new Date(),
        model_used: 'gpt-4o-image',
        provider_used: 'kie',
      });
    }

    return ok({ url: imageUrl, prompt, provider: 'kie', mediaId });
  } catch (e) {
    console.error('Kie image generation error:', e);
    return err('Image generation failed: ' + e.message, 500);
  }
}

// Helper for internal image generation (used by other modules)
export async function generateImageWithKie(prompt, aspectRatio = '1:1') {
  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) throw new Error('Kie.ai key not configured');

  const res = await fetch('https://api.kie.ai/api/v1/gpt4o-image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
    body: JSON.stringify({ prompt, size: aspectRatio, nVariants: 1 }),
  });
  const data = await res.json();
  if (data.code !== 200) throw new Error(data.msg || 'Image generation failed');

  const taskId = data.data?.taskId;
  if (!taskId) throw new Error('No task ID returned');

  let imageUrl = null;
  let attempts = 0;
  const maxAttempts = 40;

  while (!imageUrl && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 3000));
    attempts++;
    
    const statusRes = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    const statusData = await statusRes.json();
    
    if (statusData.code === 200 && statusData.data?.status === 'SUCCESS') {
      const response = statusData.data?.response;
      if (typeof response === 'string') {
        const parsed = JSON.parse(response);
        imageUrl = parsed?.resultUrls?.[0];
      } else if (response?.resultUrls) {
        imageUrl = response.resultUrls[0];
      }
      break;
    } else if (statusData.data?.status === 'FAILED') {
      throw new Error(statusData.data?.errorMessage || 'Image generation failed');
    }
  }

  if (!imageUrl) throw new Error('Image generation timed out');
  return imageUrl;
}

// ============================================================
// IMAGE EDITING
// ============================================================

async function handleImageEdit(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const body = await request.json();
    const { image, prompt } = body;
    
    if (!image || !prompt) return err('Image and prompt are required', 400);
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) return err('OpenAI API key not configured', 500);
    
    // Use GPT-4o vision to understand the image and create an edit prompt
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an image editing assistant. Given an image and an edit instruction, create a detailed prompt for DALL-E 3 that describes the edited result.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Edit this image with the following instruction: "${prompt}". Create a detailed DALL-E prompt that describes the edited result. Output ONLY the prompt.` },
              { type: 'image_url', image_url: { url: image.base64 ? `data:${image.mimeType || 'image/png'};base64,${image.base64}` : image.url, detail: 'high' } }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });
    
    if (!analysisResponse.ok) {
      const errData = await analysisResponse.json().catch(() => ({}));
      return err(errData.error?.message || 'Failed to analyze image', 500);
    }
    
    const analysisData = await analysisResponse.json();
    const editPrompt = analysisData.choices?.[0]?.message?.content || prompt;
    
    // Generate the edited image
    const generateResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: editPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural',
      }),
    });
    
    if (!generateResponse.ok) {
      const errData = await generateResponse.json().catch(() => ({}));
      return err(errData.error?.message || 'Failed to generate edited image', 500);
    }
    
    const generateData = await generateResponse.json();
    const editedUrl = generateData.data?.[0]?.url;
    
    if (!editedUrl) return err('No edited image generated', 500);
    
    // Save to gallery
    const db = await getDb();
    const mediaId = uuidv4();
    await db.collection('media_gallery').insertOne({
      id: mediaId,
      user_id: user.id,
      type: 'image',
      url: editedUrl,
      prompt: editPrompt,
      original_prompt: prompt,
      model: 'dall-e-3',
      provider: 'openai',
      is_edit: true,
      created_at: new Date(),
    });
    
    return ok({ url: editedUrl, prompt: editPrompt, method: 'dall-e-regeneration', mediaId });
  } catch (e) {
    console.error('[ImageEdit] Error:', e);
    return err(e.message || 'Failed to edit image', 500);
  }
}

// ============================================================
// MOCKUP GENERATION
// ============================================================

async function handleMockupGenerate(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const body = await request.json();
    const { design, product } = body;
    
    if (!design?.base64 || !product) return err('Design and product are required', 400);
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) return err('OpenAI API key not configured', 500);
    
    console.log('[Mockup] Generating mockup for product:', product);
    
    const mimeType = design.mimeType || 'image/png';
    
    // Analyze the design to understand what it is
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at creating product mockup descriptions. Create detailed prompts for photorealistic product mockups.`
          },
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: `Analyze this design/logo and create a detailed prompt for a DALL-E image that shows this exact design placed on a ${product}.
Requirements:
1. Photorealistic and professional
2. Design clearly visible and prominently displayed
3. Appropriate lighting, shadows, and product context
4. Design's colors, shapes, and details preserved exactly
Output ONLY the prompt.` 
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${design.base64}`, detail: 'high' }
              }
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });
    
    if (!analysisResponse.ok) {
      const errData = await analysisResponse.json().catch(() => ({}));
      return err(errData.error?.message || 'Failed to analyze design', 500);
    }
    
    const analysisData = await analysisResponse.json();
    const mockupPrompt = analysisData.choices?.[0]?.message?.content || '';
    
    console.log('[Mockup] Generated prompt:', mockupPrompt.substring(0, 200));
    
    // Generate the mockup image
    const generateResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: mockupPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural',
      }),
    });
    
    if (!generateResponse.ok) {
      const errData = await generateResponse.json().catch(() => ({}));
      return err(errData.error?.message || 'Failed to generate mockup', 500);
    }
    
    const generateData = await generateResponse.json();
    const mockupUrl = generateData.data?.[0]?.url;
    
    if (!mockupUrl) return err('No mockup generated', 500);
    
    // Save to gallery
    const db = await getDb();
    const mediaId = uuidv4();
    await db.collection('media_gallery').insertOne({
      id: mediaId,
      user_id: user.id,
      type: 'mockup',
      url: mockupUrl,
      prompt: mockupPrompt,
      product,
      model: 'dall-e-3',
      provider: 'openai',
      created_at: new Date(),
    });
    
    console.log('[Mockup] Successfully generated mockup');
    
    return ok({ url: mockupUrl, product, prompt: mockupPrompt, mediaId });
  } catch (e) {
    console.error('[Mockup] Error:', e);
    return err(e.message || 'Failed to generate mockup', 500);
  }
}

// ============================================================
// VIDEO GENERATION - Kie.ai (Kling 3.0)
// ============================================================

async function handleGenerateVideo(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { prompt, duration = 5, quality = '720p', aspectRatio = '16:9', conversationId } = body;
  if (!prompt) return err('prompt required');

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  try {
    const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
      body: JSON.stringify({ 
        model: 'kling-3.0/video',
        input: {
          prompt, 
          duration: String(duration),
          mode: 'std',
          sound: false,
          multi_shots: false,
        }
      }),
    });
    const data = await res.json();
    console.log('handleGenerateVideo Kie.ai response:', JSON.stringify(data).substring(0, 500));
    if (data.code !== 200) return err(data.msg || data.error || 'Video generation failed', 400);

    const taskId = data.data?.taskId;
    if (!taskId) return err('No task ID returned', 500);

    // Store task in DB
    const db = await getDb();
    const mediaId = uuidv4();
    await db.collection('media_gallery').insertOne({
      id: mediaId,
      user_id: user.id,
      type: 'video',
      task_id: taskId,
      prompt,
      duration,
      quality,
      aspect_ratio: aspectRatio,
      status: 'generating',
      model: 'kling-3.0',
      provider: 'kie',
      conversation_id: conversationId || null,
      created_at: new Date(),
    });

    // Also store in video_jobs for backward compatibility
    await db.collection('video_jobs').insertOne({
      id: mediaId, task_id: taskId, user_id: user.id,
      prompt, duration, quality, aspect_ratio: aspectRatio,
      status: 'generating', model: 'kling-3.0',
      conversation_id: conversationId || null,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    return ok({ mediaId, taskId, status: 'generating' });
  } catch (e) {
    console.error('Video generation error:', e);
    return err('Video generation failed: ' + e.message, 500);
  }
}

async function handleVideoStatus(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Find job in media_gallery or video_jobs
  let job = await db.collection('media_gallery').findOne({ task_id: taskId, user_id: user.id });
  if (!job) job = await db.collection('video_jobs').findOne({ task_id: taskId, user_id: user.id });
  if (!job) job = await db.collection('media_gallery').findOne({ task_id: taskId });
  if (!job) job = await db.collection('video_jobs').findOne({ task_id: taskId });
  if (!job) return err('Job not found', 404);

  // If already complete, return cached result
  if (job.status === 'success' || job.status === 'completed') {
    return ok({ status: 'success', videoUrl: job.video_url || job.url, thumbnailUrl: job.thumbnail_url, prompt: job.prompt });
  }
  if (job.status === 'failed') {
    return ok({ status: 'failed', error: job.error });
  }

  // Poll Kie.ai
  const kieKey = process.env.KIE_API_KEY;
  try {
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    const data = await res.json();
    if (data.code !== 200) return err(data.msg || 'Status check failed', 400);

    const state = (data.data?.state || data.data?.status || '').toLowerCase();
    
    let videoUrl = null;
    let thumbnailUrl = null;
    
    if (data.data?.resultJson) {
      try {
        const resultJson = JSON.parse(data.data.resultJson);
        videoUrl = resultJson?.resultUrls?.[0] || resultJson?.videoUrl || resultJson?.video_url;
        thumbnailUrl = resultJson?.coverUrl || resultJson?.cover_url || resultJson?.thumbnail;
      } catch (e) {
        console.error('Failed to parse video resultJson:', e);
      }
    }
    
    if (!videoUrl) {
      const output = data.data?.output || {};
      videoUrl = output.video_url || output.videoUrl;
      thumbnailUrl = thumbnailUrl || output.cover_url || output.imageUrl;
    }

    if (state === 'success' && videoUrl) {
      // Update both collections
      await db.collection('media_gallery').updateOne({ task_id: taskId }, {
        $set: { status: 'completed', url: videoUrl, video_url: videoUrl, thumbnail_url: thumbnailUrl, completed_at: new Date() },
      });
      await db.collection('video_jobs').updateOne({ task_id: taskId }, {
        $set: { status: 'completed', video_url: videoUrl, thumbnail_url: thumbnailUrl, completed_at: new Date() },
      });
      
      return ok({ status: 'success', videoUrl, thumbnailUrl, prompt: job.prompt });
    } else if (state === 'failed') {
      const errorMsg = data.data?.error || 'Video generation failed';
      await db.collection('media_gallery').updateOne({ task_id: taskId }, { $set: { status: 'failed', error: errorMsg } });
      await db.collection('video_jobs').updateOne({ task_id: taskId }, { $set: { status: 'failed', error: errorMsg } });
      return ok({ status: 'failed', error: errorMsg });
    }

    // Still processing
    const progress = data.data?.progress || 0;
    return ok({ status: 'generating', progress, prompt: job.prompt });
  } catch (e) {
    console.error('Video status check error:', e);
    return err('Status check failed: ' + e.message, 500);
  }
}

// ============================================================
// MEDIA GALLERY
// ============================================================

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

async function handleDeleteMedia(request, mediaId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  if (!mediaId) return err('mediaId required');

  const db = await getDb();
  
  const item = await db.collection('media_gallery').findOne({ id: mediaId });
  if (!item) return err('Media not found', 404);
  if (item.user_id !== user.id) return err('Unauthorized', 403);

  await db.collection('media_gallery').deleteOne({ id: mediaId });

  if (item.type === 'video' && item.task_id) {
    await db.collection('video_jobs').deleteOne({ task_id: item.task_id });
  }

  return ok({ success: true, deletedId: mediaId });
}

// ============================================================
// SAVE TO GALLERY (manual save from chat)
// ============================================================

async function handleSaveToGallery(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { url, prompt, model, modelLabel, conversationId } = body;
  if (!url) return err('url required');

  try {
    const db = await getDb();
    const mediaId = uuidv4();
    
    await db.collection('media_gallery').insertOne({
      id: mediaId,
      user_id: user.id,
      type: 'image',
      model: model || 'unknown',
      model_label: modelLabel || model || 'AI Generated',
      prompt: prompt || '',
      url: url,
      aspect_ratio: '1:1',
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

// ============================================================
// ROUTE HANDLERS
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'gallery') return handleMediaGallery(request);
    
    if (pathStr.match(/^video\/status\/[^\/]+$/)) {
      return handleVideoStatus(request, pathArr[2]);
    }
    
    return err('Media endpoint not found', 404);
  } catch (error) {
    console.error('[Media API] GET Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'image/generate') return handleGenerateImage(request);
    if (pathStr === 'image/generate-kie') return handleGenerateImageKie(request);
    if (pathStr === 'image/edit') return handleImageEdit(request);
    if (pathStr === 'mockup/generate') return handleMockupGenerate(request);
    if (pathStr === 'video/generate') return handleGenerateVideo(request);
    if (pathStr === 'save-to-gallery') return handleSaveToGallery(request);
    
    return err('Media endpoint not found', 404);
  } catch (error) {
    console.error('[Media API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr.match(/^[^\/]+$/)) {
      return handleDeleteMedia(request, pathArr[0]);
    }
    
    return err('Media endpoint not found', 404);
  } catch (error) {
    console.error('[Media API] DELETE Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
