import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate, checkRateLimit, trimHistory, ensureAlternatingMessages } from '@/lib/api-utils';

// ============================================================
// RATE LIMITING & SANITIZATION
// ============================================================

const _chatRateLimitCache = new Map();

function checkChatRateLimit(userId, maxPerHour = 80) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = _chatRateLimitCache.get(userId) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count++;
  }
  _chatRateLimitCache.set(userId, entry);
  return entry.count > maxPerHour;
}

function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/ignore\s+(previous|all|above|prior)\s+instructions?/gi, '[input filtered]')
    .replace(/\bDAN\b/g, '[filtered]')
    .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>/g, '')
    .replace(/```\s*(system|instructions?|prompt)\b/gi, '```')
    .substring(0, 8000);
}

// ============================================================
// SYSTEM PROMPT CACHE
// ============================================================

const _systemPromptCache = new Map();

async function getSystemPrompt(db, userId) {
  const cached = _systemPromptCache.get(userId);
  if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) return cached.prompt;
  
  // Import buildSystemPrompt from main route (temporary until full extraction)
  // For now, return a basic prompt
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  const user = await db.collection('users').findOne({ id: userId });
  const memories = await db.collection('memories').find({ user_id: userId }).limit(20).toArray();
  
  const assistantName = profile?.assistant_name || 'SoulPrint';
  const displayName = profile?.display_name || user?.display_name || 'there';
  const memoryContext = memories.length > 0 
    ? `\n\nUser memories:\n${memories.map(m => `- ${m.category}: ${m.content}`).join('\n')}`
    : '';
  
  const prompt = `You are ${assistantName}, a helpful and personalized AI assistant for ${displayName}. 
Be conversational, helpful, and remember the user's preferences and past interactions.
${memoryContext}`;

  _systemPromptCache.set(userId, { prompt, ts: Date.now() });
  return prompt;
}

// ============================================================
// GET MESSAGES
// ============================================================

async function handleGetMessages(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) return err('conversationId required');

  const db = await getDb();
  
  const conv = await db.collection('conversations').findOne({ id: conversationId });
  if (!conv) return err('Conversation not found', 404);

  let hasAccess = conv.user_id === user.id;
  
  if (!hasAccess && conv.project_id) {
    const project = await db.collection('projects').findOne({
      id: conv.project_id,
      $or: [{ owner_id: user.id }, { 'shared_with.user_id': user.id }]
    });
    hasAccess = !!project;
  }

  if (!hasAccess) return err('Conversation not found', 404);

  const messages = await db.collection('messages')
    .find({ conversation_id: conversationId })
    .sort({ created_at: 1 })
    .toArray();

  return ok(messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at,
    model_used: m.model_used,
    sender_id: m.sender_id,
  })));
}

// ============================================================
// COMPARE MODE
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
    models = [],
    attachments = [],
    enableWebSearch = true,
    projectId = null,
  } = body;

  if (!content && attachments.length === 0) return err('content required');
  if (!models || models.length === 0) return err('models required (min 1, max 3)');
  if (models.length > 3) return err('Maximum 3 models allowed for comparison');

  const db = await getDb();

  if (checkChatRateLimit(user.id, models.length * 20)) {
    return err('Rate limit exceeded — comparison mode uses more quota', 429);
  }

  let convId = conversationId;
  let conv = conversationId
    ? await db.collection('conversations').findOne({ id: conversationId, user_id: user.id })
    : null;

  if (!conv) {
    convId = uuidv4();
    const now = new Date();
    const title = (content || 'File attachment').slice(0, 50) + ((content?.length > 50) ? '...' : '');
    
    const newConv = { id: convId, user_id: user.id, title, created_at: now, updated_at: now };
    
    if (projectId && projectId !== 'general') {
      const project = await db.collection('projects').findOne({
        id: projectId,
        $or: [{ owner_id: user.id }, { shared_with: user.id }]
      });
      if (project) newConv.project_id = projectId;
    }
    
    await db.collection('conversations').insertOne(newConv);
  }

  const userMsgId = uuidv4();
  const storedContent = content + (attachments.length > 0 ? ` [+${attachments.length} attachment(s)]` : '');
  await db.collection('messages').insertOne({
    id: userMsgId, conversation_id: convId, user_id: user.id,
    role: 'user', content: storedContent, created_at: new Date(),
    is_comparison: true,
  });

  const recentMessages = await db.collection('messages')
    .find({ conversation_id: convId, id: { $ne: userMsgId }, is_comparison_response: { $ne: true } })
    .sort({ created_at: -1 }).limit(20).toArray();
  recentMessages.reverse();

  const rawHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));
  const historyMessages = trimHistory(rawHistory, 4000);

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

  // Pre-fetch web search context
  let searchContext = null;
  if (enableWebSearch) {
    const { buildSearchContext } = await import('@/lib/llm/providers');
    const lowerContent = sanitizedContent.toLowerCase();
    const searchTriggers = [
      'what is', 'what are', 'who is', 'when', 'where', 'how to', 'how do',
      'tell me about', 'latest', 'news', 'today', 'current', 'price', 'weather'
    ];
    if (searchTriggers.some(t => lowerContent.includes(t))) {
      try {
        searchContext = await buildSearchContext(sanitizedContent);
      } catch (e) {
        console.log('Web search failed for comparison:', e.message);
      }
    }
  }

  const generateResponse = async (modelConfig) => {
    const { model, provider } = modelConfig;
    const { getProvider: gp, getModelInfo } = await import('@/lib/llm/providers');
    
    const modelInfo = getModelInfo(model);
    const actualProvider = provider || modelInfo?.provider || 'openai';
    const llmProvider = gp(actualProvider, model);

    let messagesWithSearch = [...historyMessages, { role: 'user', content: userMessageContent }];
    
    if (searchContext && !actualProvider.includes('perplexity') && !model.startsWith('sonar')) {
      messagesWithSearch = [
        ...historyMessages,
        { role: 'user', content: `${searchContext}\n\n---\n\nUser question: ${typeof userMessageContent === 'string' ? userMessageContent : content}` },
      ];
    }

    messagesWithSearch = ensureAlternatingMessages(messagesWithSearch);
    if (messagesWithSearch.length === 0 || messagesWithSearch[messagesWithSearch.length - 1]?.role !== 'user') {
      messagesWithSearch.push({ role: 'user', content: typeof userMessageContent === 'string' ? userMessageContent : content });
    }

    try {
      const startTime = Date.now();
      let responseText = '';

      try {
        const { stream } = await llmProvider.generateStream({
          systemPrompt,
          messages: messagesWithSearch,
          model,
          temperature: 0.7,
          enableWebSearch: actualProvider === 'perplexity',
        });
        for await (const chunk of stream) {
          responseText += chunk;
        }
      } catch (streamErr) {
        responseText = await llmProvider.generateChatCompletion({
          systemPrompt,
          messages: messagesWithSearch,
          model,
          temperature: 0.7,
        });
      }

      return {
        model,
        provider: actualProvider,
        label: modelInfo?.label || model,
        group: modelInfo?.group || actualProvider,
        content: responseText,
        duration: Date.now() - startTime,
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

  const responses = await Promise.all(models.map(generateResponse));

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
    selected_model: null,
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

// ============================================================
// COMPARE SELECT
// ============================================================

async function handleCompareSelect(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { comparisonId, selectedModel, selectedContent } = body;

  if (!comparisonId || !selectedModel || !selectedContent) {
    return err('comparisonId, selectedModel, and selectedContent required');
  }

  const db = await getDb();

  const comparison = await db.collection('comparisons').findOne({
    id: comparisonId,
    user_id: user.id,
  });

  if (!comparison) return err('Comparison not found', 404);

  await db.collection('comparisons').updateOne(
    { id: comparisonId },
    { $set: { selected_model: selectedModel, selected_at: new Date() } }
  );

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

  await db.collection('conversations').updateOne(
    { id: comparison.conversation_id },
    { $set: { updated_at: new Date() } }
  );

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

// ============================================================
// ROUTE HANDLERS
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'messages') return handleGetMessages(request);
    
    return err('Chat endpoint not found', 404);
  } catch (error) {
    console.error('[Chat API] GET Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Note: /api/chat/stream is still handled by the main catch-all route
    // due to its complexity and dependencies. It will be extracted in a future phase.
    if (pathStr === 'compare') return handleChatCompare(request);
    if (pathStr === 'compare/select') return handleCompareSelect(request);
    
    return err('Chat endpoint not found', 404);
  } catch (error) {
    console.error('[Chat API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
