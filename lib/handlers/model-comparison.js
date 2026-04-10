/**
 * Multi-Model Comparison — compare AI model outputs
 * Extracted from route.js for maintainability.
 */
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import { checkChatRateLimit, sanitizeInput, trimHistory, ensureAlternatingMessages, getSystemPrompt } from '@/lib/handlers/chat-stream';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';

// MULTI-MODEL COMPARISON
// ============================================================

async function handleChatCompare(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  if (!user.accepted && user.role === 'user') {
    return err('Account pending approval', 403);
  }

  const body = await request.json();
  const {
    conversationId,
    content,
    models = [], // Array of { model, provider } - max 3
    attachments = [],
    enableWebSearch = true,
    projectId = null,   // Optional project to associate new conversations with
  } = body;

  if (!content && attachments.length === 0) return err('content required');
  if (!models || models.length === 0) return err('models required (min 1, max 3)');
  if (models.length > 3) return err('Maximum 3 models allowed for comparison');

  const db = await getDb();

  // Rate limiting - compare mode uses 3x the rate
  if (checkChatRateLimit(user.id, models.length * 20)) {
    return err('Rate limit exceeded — comparison mode uses more quota', 429);
  }

  // Get or create conversation
  let convId = conversationId;
  let conv = conversationId
    ? await db.collection('conversations').findOne({ id: conversationId, user_id: user.id })
    : null;

  if (!conv) {
    convId = uuidv4();
    const now = new Date();
    const title = (content || 'File attachment').slice(0, 50) + ((content?.length > 50) ? '...' : '');
    
    // Build conversation object with optional project_id
    const newConv = {
      id: convId, user_id: user.id, title, created_at: now, updated_at: now,
    };
    
    // If projectId is provided and valid (not 'general' or null), add it
    if (projectId && projectId !== 'general') {
      // Verify user has access to this project
      const project = await db.collection('projects').findOne({
        id: projectId,
        $or: [
          { owner_id: user.id },
          { shared_with: user.id }
        ]
      });
      if (project) {
        newConv.project_id = projectId;
      }
    }
    
    await db.collection('conversations').insertOne(newConv);
  }

  // Save user message
  const userMsgId = uuidv4();
  const storedContent = content + (attachments.length > 0 ? ` [+${attachments.length} attachment(s)]` : '');
  await db.collection('messages').insertOne({
    id: userMsgId, conversation_id: convId, user_id: user.id,
    role: 'user', content: storedContent, created_at: new Date(),
    is_comparison: true,
  });

  // Get recent messages for context
  const recentMessages = await db.collection('messages')
    .find({ conversation_id: convId, id: { $ne: userMsgId }, is_comparison_response: { $ne: true } })
    .sort({ created_at: -1 }).limit(50).toArray();
  recentMessages.reverse();

  const rawHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));
  const historyMessages = trimHistory(rawHistory, 32000);

  // Build user message content
  let userMessageContent;
  if (attachments.length > 0) {
    userMessageContent = [];
    if (content) userMessageContent.push({ type: 'text', text: content });
    for (const att of attachments) {
      if (att.type === 'image' && att.base64) {
        userMessageContent.push({
          type: 'image_url',
          image_url: { url: `data:${att.mimeType || 'image/jpeg'};base64,${att.base64}`, detail: 'high' },
        });
      } else if (att.type === 'document' && att.text) {
        userMessageContent.push({
          type: 'text',
          text: `\n\n[Attached document: ${att.name}]\n${att.text}\n[End of document]`,
        });
      }
    }
  } else {
    userMessageContent = content;
  }

  const sanitizedContent = sanitizeInput(content);
  const systemPrompt = await getSystemPrompt(db, user.id);

  // Pre-fetch web search context once (shared across all models)
  let searchContext = null;
  if (enableWebSearch) {
    const { buildSearchContext } = await import('@/lib/llm/providers');
    // Comprehensive heuristic: trigger web search for questions, research queries, and current info
    const lowerContent = sanitizedContent.toLowerCase();
    const searchTriggers = [
      // Question words
      'what is', 'what are', 'what can', 'who is', 'who are', 'when', 'where', 'how to', 'how do', 'how does',
      // Research/info queries
      'tell me about', 'information about', 'info about', 'details about', 'learn about', 'find out',
      'look up', 'search for', 'research', 'explain',
      // Current/real-time info
      'latest', 'recent', 'news', 'today', 'current', 'price', 'weather', 'score', 'update',
      // Company/product/person research
      'company', 'founded', 'ceo', 'product', 'service', 'platform', 'startup', 'fund', 'investment'
    ];
    const shouldSearch = searchTriggers.some(t => lowerContent.includes(t));
    if (shouldSearch) {
      try {
        searchContext = await buildSearchContext(sanitizedContent);
      } catch (e) {
        console.log('Web search failed for comparison:', e.message);
      }
    }
  }

  // Generate responses from all models in parallel
  const generateResponse = async (modelConfig) => {
    const { model, provider } = modelConfig;
    const { getProvider: gp, getModelInfo } = await import('@/lib/llm/providers');
    
    const modelInfo = getModelInfo(model);
    const actualProvider = provider || modelInfo?.provider || 'openai';
    const llmProvider = gp(actualProvider, model);

    // Build messages with search context if available
    let messagesWithSearch = [...historyMessages, { role: 'user', content: userMessageContent }];
    
    // Inject search context for non-Perplexity models
    if (searchContext && !actualProvider.includes('perplexity') && !model.startsWith('sonar')) {
      messagesWithSearch = [
        ...historyMessages,
        { role: 'user', content: `${searchContext}\n\n---\n\nUser question: ${typeof userMessageContent === 'string' ? userMessageContent : content}` },
      ];
    }

    // Sanitize messages for provider compatibility
    messagesWithSearch = ensureAlternatingMessages(messagesWithSearch);
    if (messagesWithSearch.length === 0 || messagesWithSearch[messagesWithSearch.length - 1]?.role !== 'user') {
      messagesWithSearch.push({ role: 'user', content: typeof userMessageContent === 'string' ? userMessageContent : content });
    }

    try {
      const startTime = Date.now();
      let responseText = '';

      // Try streaming first, fallback to non-streaming
      try {
        const { stream } = await llmProvider.generateStream({
          systemPrompt,
          messages: messagesWithSearch,
          model,
          temperature: 0.7,
          enableWebSearch: actualProvider === 'perplexity',
        });
        for await (const chunk of stream) {
          // Some providers (Perplexity) yield { delta, citations } objects instead of strings
          if (typeof chunk === 'string') {
            responseText += chunk;
          } else if (chunk?.delta) {
            responseText += chunk.delta;
          } else if (typeof chunk === 'object') {
            responseText += JSON.stringify(chunk);
          }
        }
      } catch (streamErr) {
        // Fallback to non-streaming
        responseText = await llmProvider.generateChatCompletion({
          systemPrompt,
          messages: messagesWithSearch,
          model,
          temperature: 0.7,
        });
      }

      const duration = Date.now() - startTime;

      return {
        model,
        provider: actualProvider,
        label: modelInfo?.label || model,
        group: modelInfo?.group || actualProvider,
        content: responseText,
        duration,
        success: true,
        usedSearch: !!searchContext,
      };
    } catch (error) {
      console.error(`Compare error for ${model}:`, error.message);
      return {
        model,
        provider: actualProvider,
        label: modelInfo?.label || model,
        group: modelInfo?.group || actualProvider,
        content: null,
        error: error.message,
        success: false,
      };
    }
  };

  // Run all models in parallel
  const responses = await Promise.all(models.map(generateResponse));

  // Store the comparison event for analytics
  const comparisonId = uuidv4();
  await db.collection('comparisons').insertOne({
    id: comparisonId,
    user_id: user.id,
    conversation_id: convId,
    user_message_id: userMsgId,
    content: storedContent,
    models: models.map(m => m.model),
    responses: responses.map(r => ({
      model: r.model,
      provider: r.provider,
      success: r.success,
      duration: r.duration,
      content_length: r.content?.length || 0,
    })),
    created_at: new Date(),
    selected_model: null, // Will be updated when user selects
  });

  return NextResponse.json({
    success: true,
    conversationId: convId,
    comparisonId,
    userMessageId: userMsgId,
    responses,
    usedWebSearch: !!searchContext,
  });
}

// Handle selection of a comparison winner
async function handleCompareSelect(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { comparisonId, selectedModel, selectedContent } = body;

  if (!comparisonId || !selectedModel || !selectedContent) {
    return err('comparisonId, selectedModel, and selectedContent required');
  }

  const db = await getDb();

  // Verify the comparison belongs to this user
  const comparison = await db.collection('comparisons').findOne({
    id: comparisonId,
    user_id: user.id,
  });

  if (!comparison) {
    return err('Comparison not found', 404);
  }

  // Update comparison with selected model
  await db.collection('comparisons').updateOne(
    { id: comparisonId },
    { $set: { selected_model: selectedModel, selected_at: new Date() } }
  );

  // Save the selected response as the actual assistant message
  const assistantMsgId = uuidv4();
  await db.collection('messages').insertOne({
    id: assistantMsgId,
    conversation_id: comparison.conversation_id,
    user_id: user.id,
    role: 'assistant',
    content: selectedContent,
    created_at: new Date(),
    model_used: selectedModel,
    from_comparison: true,
    comparison_id: comparisonId,
  });

  // Update conversation timestamp
  await db.collection('conversations').updateOne(
    { id: comparison.conversation_id },
    { $set: { updated_at: new Date() } }
  );

  // Track user's model preferences for future recommendations
  await db.collection('user_preferences').updateOne(
    { user_id: user.id },
    {
      $inc: { [`model_selections.${selectedModel}`]: 1 },
      $set: { last_selected_model: selectedModel, updated_at: new Date() },
    },
    { upsert: true }
  );

  return NextResponse.json({
    success: true,
    messageId: assistantMsgId,
    conversationId: comparison.conversation_id,
    selectedModel,
  });
}

// IMAGE GENERATION - DALL-E 3
async function handleGenerateImage(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { prompt, size = '1024x1024', quality = 'standard', style = 'vivid' } = body;
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

    // Save as a message in DB if conversationId provided
    const { conversationId } = body;
    if (conversationId) {
      const db = await getDb();
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

    return ok({ url: imageUrl, revised_prompt: revisedPrompt });
  } catch (e) {
    console.error('Image generation error:', e);
    return err('Image generation failed: ' + e.message, 500);
  }
}

// IMAGE GENERATION - Kie.ai (GPT-4o Image / gpt4o-image)
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
    
    // Submit generation task (updated endpoint)
    const res = await fetch('https://api.kie.ai/api/v1/gpt4o-image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
      body: JSON.stringify({
        prompt,
        size: aspectRatio, // API uses 'size' not 'aspectRatio'
        nVariants: Math.min(nVariants, 4), // max 4 variants
      }),
    });
    const data = await res.json();
    
    console.log('[handleGenerateImageKie] Initial response:', { status: res.status, code: data.code, msg: data.msg });
    
    if (!res.ok || data.code !== 200) {
      console.error('[handleGenerateImageKie] API Error:', res.status, JSON.stringify(data));
      return err(data.msg || `API returned status ${res.status}`, 400);
    }

    const taskId = data.data?.taskId;
    if (!taskId) return err('No task ID returned', 500);

    // Poll for completion (max 2 minutes) - correct endpoint
    let imageUrl = null;
    let attempts = 0;
    const maxAttempts = 40;
    
    while (!imageUrl && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 3000)); // wait 3s between polls
      attempts++;
      
      const statusRes = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${kieKey}` },
      });
      const statusData = await statusRes.json();
      
      // Status: GENERATING, SUCCESS, FAILED
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

    // Save as a message in DB if conversationId provided
    if (conversationId) {
      const db = await getDb();
      await db.collection('messages').insertOne({
        id: uuidv4(), conversation_id: conversationId, user_id: user.id,
        role: 'assistant',
        content: `![Generated Image](${imageUrl})\n\n*Prompt: ${prompt}*`,
        content_type: 'image',
        image_url: imageUrl,
        created_at: new Date(),
        model_used: 'gpt-4o-image',
        provider_used: 'kie',
        est_input_tokens: Math.round(prompt.length / 4),
        est_output_tokens: 0,
      });
    }

    return ok({ url: imageUrl, prompt, provider: 'kie' });
  } catch (e) {
    console.error('Kie image generation error:', e);
    return err('Image generation failed: ' + e.message, 500);
  }
}

// Helper: Generate image with Kie.ai (for internal use, e.g., Telegram)
async function generateImageWithKie(prompt, aspectRatio = '1:1') {
  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) throw new Error('Kie.ai key not configured');

  // Submit task (updated endpoint: gpt4o-image)
  const res = await fetch('https://api.kie.ai/api/v1/gpt4o-image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
    body: JSON.stringify({
      prompt,
      size: aspectRatio, // API uses 'size' not 'aspectRatio'
      nVariants: 1,
    }),
  });
  const data = await res.json();
  if (data.code !== 200) throw new Error(data.msg || 'Image generation failed');

  const taskId = data.data?.taskId;
  if (!taskId) throw new Error('No task ID returned');

  // Poll for completion (correct endpoint: gpt4o-image/record-info)
  let imageUrl = null;
  let attempts = 0;
  const maxAttempts = 40; // ~2 minutes

  while (!imageUrl && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 3000));
    attempts++;
    
    const statusRes = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    const statusData = await statusRes.json();
    
    // Status: GENERATING, SUCCESS, FAILED
    if (statusData.code === 200 && statusData.data?.status === 'SUCCESS') {
      // Parse response JSON to get resultUrls
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

// VIDEO GENERATION - Kie.ai (using Kling 3.0)
async function handleGenerateVideo(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { prompt, duration = 5, quality = '720p', aspectRatio = '16:9', conversationId } = body;
  if (!prompt) return err('prompt required');

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) return err('Kie.ai key not configured', 500);

  try {
    // Use Kling 3.0 via the unified Jobs API
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
    const jobId = uuidv4();
    await db.collection('video_jobs').insertOne({
      id: jobId, task_id: taskId, user_id: user.id,
      prompt, duration, quality, aspect_ratio: aspectRatio,
      status: 'generating', model: 'kling-3.0',
      conversation_id: conversationId || null,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    return ok({ jobId, taskId, status: 'generating' });
  } catch (e) {
    console.error('Video generation error:', e);
    return err('Video generation failed: ' + e.message, 500);
  }
}

// VIDEO STATUS - Poll Kie.ai
async function handleVideoStatus(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  // Try finding in video_jobs first (legacy), then in media_gallery (new)
  let job = await db.collection('video_jobs').findOne({ task_id: taskId, user_id: user.id });
  if (!job) {
    job = await db.collection('video_jobs').findOne({ task_id: taskId });
  }
  if (!job) {
    // Try media_gallery collection (new flow)
    job = await db.collection('media_gallery').findOne({ task_id: taskId, user_id: user.id });
  }
  if (!job) {
    job = await db.collection('media_gallery').findOne({ task_id: taskId });
  }
  if (!job) return err('Job not found', 404);
  
  // Determine which collection this job is in
  const collection = job.type === 'video' ? 'media_gallery' : 'video_jobs';

  // If already complete, return cached result (handle both 'success' and 'completed' status)
  if (job.status === 'success' || job.status === 'completed') {
    return ok({ status: 'success', videoUrl: job.video_url || job.url, thumbnailUrl: job.thumbnail_url, prompt: job.prompt });
  }
  if (job.status === 'failed') {
    return ok({ status: 'failed', error: job.error });
  }

  // Poll Kie.ai using the Jobs API query endpoint
  const kieKey = process.env.KIE_API_KEY;
  try {
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });
    const data = await res.json();
    if (data.code !== 200) return err(data.msg || 'Status check failed', 400);

    // Kie.ai uses 'state' field, normalize to lowercase
    const state = (data.data?.state || data.data?.status || '').toLowerCase();
    
    // For successful videos, parse resultJson or get from output
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
    
    // Fallback to output object if available
    if (!videoUrl) {
      const output = data.data?.output || {};
      videoUrl = output.video_url || output.videoUrl;
      thumbnailUrl = thumbnailUrl || output.cover_url || output.imageUrl;
    }

    if (state === 'success' && videoUrl) {
      await db.collection(collection).updateOne({ task_id: taskId }, {
        $set: { status: 'completed', url: videoUrl, video_url: videoUrl, thumbnail_url: thumbnailUrl, completed_at: new Date() },
      });
      // UPDATE the original message with video_url instead of creating a new one
      if (job.message_id) {
        await db.collection('messages').updateOne(
          { id: job.message_id },
          { 
            $set: { 
              video_url: videoUrl, 
              thumbnail_url: thumbnailUrl,
              content: `🎬 **Video generated!**\n\n**Prompt:** ${job.prompt}`,
              'video_task.status': 'success'
            } 
          }
        );
      } else if (job.conversation_id) {
        // Fallback for old jobs without message_id - create new message
        await db.collection('messages').insertOne({
          id: uuidv4(), conversation_id: job.conversation_id, user_id: user.id,
          role: 'assistant',
          content: `🎬 **Video generated!**\n\n**Prompt:** ${job.prompt}\n\n[▶ Download / View Video](${videoUrl})${thumbnailUrl ? `\n\n![Thumbnail](${thumbnailUrl})` : ''}`,
          content_type: 'video',
          video_url: videoUrl,
          created_at: new Date(),
          model_used: job.model || 'kling-3.0',
          provider_used: 'kie.ai',
        });
      }
      return ok({ status: 'success', videoUrl, thumbnailUrl, prompt: job.prompt });
    } else if (state === 'failed' || state === 'fail') {
      const errMsg = data.data?.error || 'Generation failed';
      await db.collection(collection).updateOne({ task_id: taskId }, {
        $set: { status: 'failed', error: errMsg },
      });
      return ok({ status: 'failed', error: errMsg });
    }

    return ok({ status: 'generating', progress: null, state });
  } catch (e) {
    console.error('Video status error:', e);
    return err('Status check failed: ' + e.message, 500);
  }
}

// ============================================================


export {
  handleChatCompare,
  handleCompareSelect,
  handleGenerateImage,
  handleGenerateImageKie,
  generateImageWithKie,
  handleGenerateVideo,
  handleVideoStatus,
};
