import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate, requireAdmin, trimHistory, ensureAlternatingMessages } from '@/lib/api-utils';
import { generateImageWithKie } from '@/app/api/media/[...path]/route';

// ============================================================
// TELEGRAM HELPER FUNCTIONS
// ============================================================

async function sendTelegramMessage(chatId, token, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function sendTelegramPhoto(chatId, token, photoUrl, caption = '') {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption.substring(0, 1024), parse_mode: 'Markdown' }),
    });
  } catch (e) { console.error('sendTelegramPhoto error:', e.message); }
}

async function sendTelegramVideo(chatId, token, videoUrl, caption = '') {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, video: videoUrl, caption: caption.substring(0, 1024), parse_mode: 'Markdown', supports_streaming: true }),
    });
    if (!res.ok) {
      await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, document: videoUrl, caption: caption.substring(0, 1024) }),
      });
    }
  } catch (e) { console.error('sendTelegramVideo error:', e.message); }
}

async function requestTelegramLocation(chatId, token, message) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text: message, parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: '📍 Share My Location', request_location: true }]],
          resize_keyboard: true, one_time_keyboard: true,
        },
      }),
    });
  } catch (e) { console.error('requestTelegramLocation error:', e.message); }
}

async function removeTelegramKeyboard(chatId, token, message) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }),
    });
  } catch (e) { console.error('removeTelegramKeyboard error:', e.message); }
}

// ============================================================
// WEBHOOK HANDLER
// ============================================================

async function handleTelegramWebhook(request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!TELEGRAM_BOT_TOKEN) {
    return ok({ status: 'not_configured', message: 'TELEGRAM_BOT_TOKEN not set' });
  }

  // Verify webhook secret
  if (TELEGRAM_WEBHOOK_SECRET) {
    const incoming = request.headers.get('x-telegram-bot-api-secret-token');
    if (!incoming || incoming !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn('Telegram webhook: rejected request with invalid secret');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let update;
  try { update = await request.json(); } catch { return ok({ ok: true }); }

  const message = update?.message || update?.edited_message;
  if (!message) return ok({ ok: true });

  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const telegramUserId = message.from?.id?.toString();
  const fromName = message.from?.first_name || 'User';

  const db = await getDb();
  let mapping = await db.collection('telegram_mappings').findOne({ telegram_user_id: telegramUserId });

  // Handle location sharing
  if (message.location) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const { latitude, longitude } = message.location;
    await db.collection('user_locations').updateOne(
      { user_id: mapping.user_id },
      { $set: { lat: latitude, lng: longitude, source: 'telegram', updated_at: new Date() } },
      { upsert: true }
    );
    await removeTelegramKeyboard(chatId, TELEGRAM_BOT_TOKEN, `📍 Location saved! (${latitude.toFixed(4)}, ${longitude.toFixed(4)})\n\nYou can now use /nearby or /find commands.`);
    return ok({ ok: true });
  }

  if (!text) return ok({ ok: true });

  // ── /start command ──────────────────────────────────────────────────────────
  if (text === '/start') {
    const existingLinked = await db.collection('telegram_mappings').findOne({ telegram_user_id: telegramUserId, linked: true });
    if (existingLinked) {
      const currentModel = existingLinked.preferred_model || 'gpt-4o';
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `✅ Your Telegram is already linked to SoulPrint!\n\nCurrent AI model: *${currentModel}*\n\nJust send me a message to chat. Use /model to switch AI.`
      );
      return ok({ ok: true });
    }
    const linkCode = uuidv4().slice(0, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.collection('telegram_mappings').updateOne(
      { telegram_user_id: telegramUserId },
      { $set: { telegram_user_id: telegramUserId, telegram_chat_id: chatId.toString(), link_code: linkCode, linked: false, expires_at: expiresAt, created_at: new Date() } },
      { upsert: true }
    );
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `👋 Welcome to SoulPrint, ${fromName}!\n\nTo link your account:\n1️⃣ Go to: https://soulprintengine.ai\n2️⃣ Open Settings (⚙️) → Telegram tab\n3️⃣ Enter your link code:\n\n\`${linkCode}\`\n\n⏳ This code expires in 24 hours.\n\nOnce linked, I'll be your personal AI — right here in Telegram.`
    );
    return ok({ ok: true });
  }

  // ── /model command ────────────────────────────────────────────────────────
  if (text === '/model' || text.startsWith('/model ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const parts = text.split(' ');
    const currentModel = mapping.preferred_model || 'gpt-4o';

    if (parts.length === 1) {
      const modelList = [
        '🧠 *Dynamic Intelligence*: `smart` - Auto-selects best model',
        '🟢 *OpenAI*: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`',
        '🟣 *Claude*: `claude-sonnet-4-5-20250929`, `claude-3-5-haiku-20241022`',
        '🔵 *Gemini*: `gemini-2.0-flash`, `gemini-2.5-pro`',
        '🌐 *Perplexity*: `sonar`, `sonar-pro`',
      ].join('\n');
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `🤖 *Current model:* \`${currentModel}\`\n\nAvailable:\n${modelList}\n\nSwitch: \`/model smart\` or \`/model gpt-4o\``
      );
      return ok({ ok: true });
    }

    const newModel = parts[1].trim().toLowerCase();
    
    if (newModel === 'smart') {
      await db.collection('telegram_mappings').updateOne(
        { telegram_user_id: telegramUserId },
        { $set: { preferred_model: 'smart', preferred_provider: 'smart' } }
      );
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `🧠 *Dynamic Intelligence activated!*\n\nI'll auto-select the best model for each query.`
      );
      return ok({ ok: true });
    }
    
    const { AVAILABLE_MODELS: models } = await import('@/lib/llm/providers');
    const found = models.find(m => m.value === newModel || m.label.toLowerCase().includes(newModel));
    if (!found) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Unknown model: \`${newModel}\`\n\nSend /model to see options.`);
      return ok({ ok: true });
    }

    await db.collection('telegram_mappings').updateOne(
      { telegram_user_id: telegramUserId },
      { $set: { preferred_model: found.value, preferred_provider: found.provider } }
    );
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `✅ Switched to *${found.label}*`);
    return ok({ ok: true });
  }

  // ── /location command ──────────────────────────────────────────────────────
  if (text === '/location' || text === '/loc') {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    await requestTelegramLocation(chatId, TELEGRAM_BOT_TOKEN,
      `📍 *Share your location*\n\nTap below to enable "near me" searches!`
    );
    return ok({ ok: true });
  }

  // ── /image command ─────────────────────────────────────────────────────────
  if (text.startsWith('/image ') || text.startsWith('/img ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const prompt = text.replace(/^\/(image|img)\s+/, '').trim();
    if (!prompt) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '❌ Usage: /image [prompt]\nExample: /image a futuristic city');
      return ok({ ok: true });
    }
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'upload_photo' }),
    });
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🎨 Generating image... (30-60 seconds)');
    try {
      const imageUrl = await generateImageWithKie(prompt, '1:1');
      await sendTelegramPhoto(chatId, TELEGRAM_BOT_TOKEN, imageUrl, `🎨 *Generated*\n_${prompt.substring(0, 200)}_`);
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /video command ─────────────────────────────────────────────────────────
  if (text.startsWith('/video ') || text.startsWith('/vid ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const prompt = text.replace(/^\/(video|vid)\s+/, '').trim();
    if (!prompt) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '❌ Usage: /video [prompt]');
      return ok({ ok: true });
    }
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `🎬 Generating video... (1-3 minutes)`);
    try {
      const kieKey = process.env.KIE_API_KEY;
      const vidRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
        body: JSON.stringify({ 
          model: 'kling-3.0/video',
          input: { prompt, duration: '5', mode: 'std', sound: false, multi_shots: false }
        }),
      });
      const vidData = await vidRes.json();
      if (vidData.code !== 200) throw new Error(vidData.msg || 'Failed');
      const taskId = vidData.data?.taskId;

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 10000));
        attempts++;
        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${kieKey}` },
        });
        const pollData = await pollRes.json();
        const state = pollData.data?.status?.toLowerCase();
        const output = pollData.data?.output || {};
        const videoUrl = output.video_url || output.videoUrl;

        if (state === 'success' && videoUrl) {
          await sendTelegramVideo(chatId, TELEGRAM_BOT_TOKEN, videoUrl, `🎬 *Done!*\n_${prompt.substring(0, 200)}_`);
          break;
        } else if (state === 'failed') {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Video failed`);
          break;
        }
        if (attempts % 6 === 0) {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `⏳ Still generating...`);
        }
      }
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /help command ──────────────────────────────────────────────────────────
  if (text === '/help') {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `🤖 *SoulPrint Bot Commands*\n\n` +
      `/start - Link your account\n` +
      `/model - View/change AI model\n` +
      `/image [prompt] - Generate image\n` +
      `/video [prompt] - Generate video\n` +
      `/location - Share location\n` +
      `/help - Show this message\n\n` +
      `Or just send any message to chat!`
    );
    return ok({ ok: true });
  }

  // ── Regular chat message ───────────────────────────────────────────────────
  if (!mapping?.linked) {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `👋 Hi ${fromName}! To start chatting, link your SoulPrint account.\n\nSend /start to get your link code.`
    );
    return ok({ ok: true });
  }

  const userId = mapping.user_id;
  let preferredModel = mapping.preferred_model || 'gpt-4o';
  let preferredProvider = mapping.preferred_provider || 'openai';

  // Show typing indicator
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });

  // Get or create conversation
  let conv = await db.collection('telegram_conversations').findOne({ user_id: userId });
  if (!conv) {
    const convId = uuidv4();
    await db.collection('telegram_conversations').insertOne({
      id: convId, user_id: userId, telegram_chat_id: chatId.toString(), created_at: new Date(),
    });
    conv = { id: convId };
  }

  // Save user message
  const userMsgId = uuidv4();
  await db.collection('messages').insertOne({
    id: userMsgId, conversation_id: conv.id, user_id: userId,
    role: 'user', content: text, source: 'telegram', created_at: new Date(),
  });

  // Handle Dynamic Intelligence
  if (preferredModel === 'smart') {
    const { classifyQueryForSmartMode } = await import('@/lib/llm/providers');
    try {
      const smartInfo = await classifyQueryForSmartMode(text);
      if (smartInfo) {
        preferredModel = smartInfo.model;
        preferredProvider = smartInfo.provider;
      }
    } catch (e) {
      console.error('Smart mode classification failed:', e.message);
      preferredModel = 'gpt-4o';
      preferredProvider = 'openai';
    }
  }

  // Build system prompt
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  const memories = await db.collection('memories').find({ user_id: userId }).limit(15).toArray();
  const assistantName = profile?.assistant_name || 'SoulPrint';
  const displayName = profile?.display_name || fromName;
  
  let systemPrompt = `You are ${assistantName}, a helpful AI assistant for ${displayName}. Keep responses concise for Telegram. Use markdown formatting.`;
  if (memories.length > 0) {
    systemPrompt += `\n\nUser memories:\n${memories.map(m => `- ${m.content}`).join('\n')}`;
  }

  // Get conversation history
  const recentMessages = await db.collection('messages')
    .find({ conversation_id: conv.id })
    .sort({ created_at: -1 }).limit(20).toArray();
  recentMessages.reverse();

  const historyMessages = ensureAlternatingMessages(
    trimHistory(recentMessages.map(m => ({ role: m.role, content: m.content })), 4000)
  );

  // Generate response
  try {
    const { getProvider } = await import('@/lib/llm/providers');
    const provider = getProvider(preferredProvider, preferredModel);

    let responseText = '';
    try {
      const { stream } = await provider.generateStream({
        systemPrompt,
        messages: historyMessages,
        model: preferredModel,
        temperature: 0.7,
        enableWebSearch: preferredProvider === 'perplexity',
      });
      for await (const chunk of stream) { responseText += chunk; }
    } catch {
      responseText = await provider.generateChatCompletion({
        systemPrompt,
        messages: historyMessages,
        model: preferredModel,
        temperature: 0.7,
      });
    }

    // Save assistant message
    await db.collection('messages').insertOne({
      id: uuidv4(), conversation_id: conv.id, user_id: userId,
      role: 'assistant', content: responseText, source: 'telegram',
      model_used: preferredModel, provider_used: preferredProvider,
      created_at: new Date(),
    });

    // Update conversation
    await db.collection('telegram_conversations').updateOne(
      { id: conv.id },
      { $set: { updated_at: new Date() } }
    );

    // Send response (split if too long)
    const maxLen = 4000;
    if (responseText.length <= maxLen) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, responseText);
    } else {
      const chunks = responseText.match(/.{1,4000}/gs) || [];
      for (const chunk of chunks) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, chunk);
      }
    }
  } catch (e) {
    console.error('Telegram chat error:', e);
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Error: ${e.message}`);
  }

  return ok({ ok: true });
}

// ============================================================
// LINK HANDLER
// ============================================================

async function handleTelegramLink(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { link_code } = body;
  if (!link_code) return err('link_code required');

  const db = await getDb();
  const mapping = await db.collection('telegram_mappings').findOne({ link_code: link_code.toUpperCase() });
  if (!mapping) return err('Invalid link code. Send /start to the bot to get a new one.', 404);

  if (mapping.expires_at && new Date() > new Date(mapping.expires_at)) {
    return err('This link code has expired. Send /start to the bot to get a new one.', 410);
  }

  const alreadyLinked = await db.collection('telegram_mappings').findOne({
    telegram_user_id: mapping.telegram_user_id, linked: true, user_id: { $exists: true },
  });
  if (alreadyLinked && alreadyLinked.user_id !== user.id) {
    return err('This Telegram account is already linked to a different SoulPrint account.', 409);
  }

  const userAlreadyLinked = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });
  if (userAlreadyLinked) {
    return err('Your account is already linked to a Telegram account.', 409);
  }

  await db.collection('telegram_mappings').updateOne(
    { link_code: link_code.toUpperCase() },
    { $set: { user_id: user.id, linked: true, linked_at: new Date(), expires_at: null } }
  );

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (TELEGRAM_BOT_TOKEN && mapping.telegram_chat_id) {
    const profile = await db.collection('profiles').findOne({ user_id: user.id });
    const botName = profile?.assistant_name || 'SoulPrint';
    const displayName = profile?.display_name || 'there';
    await sendTelegramMessage(mapping.telegram_chat_id, TELEGRAM_BOT_TOKEN,
      `✅ Linked! Hey ${displayName}, ${botName} is ready.\n\nJust send a message anytime.`
    );
  }

  return ok({ success: true, message: 'Telegram linked successfully!' });
}

// ============================================================
// STATUS HANDLER
// ============================================================

async function handleTelegramStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });

  return ok({
    configured: !!process.env.TELEGRAM_BOT_TOKEN,
    linked: !!mapping,
    telegram_user_id: mapping?.telegram_user_id || null,
    preferred_model: mapping?.preferred_model || 'gpt-4o',
    preferred_provider: mapping?.preferred_provider || 'openai',
  });
}

// ============================================================
// SET MODEL HANDLER
// ============================================================

async function handleTelegramSetModel(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { model } = await request.json();
  if (!model) return err('model required');

  const db = await getDb();

  if (model === 'smart') {
    const result = await db.collection('telegram_mappings').updateOne(
      { user_id: user.id, linked: true },
      { $set: { preferred_model: 'smart', preferred_provider: 'smart' } }
    );
    if (result.matchedCount === 0) return err('No linked Telegram account found');
    return ok({ success: true, model: 'smart', label: '🧠 Dynamic Intelligence' });
  }

  const { AVAILABLE_MODELS } = await import('@/lib/llm/providers');
  const found = AVAILABLE_MODELS.find(m => m.value === model);
  if (!found) return err('Unknown model');

  const result = await db.collection('telegram_mappings').updateOne(
    { user_id: user.id, linked: true },
    { $set: { preferred_model: found.value, preferred_provider: found.provider } }
  );

  if (result.matchedCount === 0) return err('No linked Telegram account found');
  return ok({ success: true, model: found.value, label: found.label });
}

// ============================================================
// UNLINK HANDLER
// ============================================================

async function handleTelegramUnlink(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });
  
  if (!mapping) return err('No linked Telegram account found', 404);

  await db.collection('telegram_mappings').deleteOne({ user_id: user.id, linked: true });
  await db.collection('telegram_conversations').deleteMany({ user_id: user.id });

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (TELEGRAM_BOT_TOKEN && mapping.telegram_chat_id) {
    await sendTelegramMessage(mapping.telegram_chat_id, TELEGRAM_BOT_TOKEN,
      `👋 Your SoulPrint account has been unlinked.\n\nSend /start to link again.`
    );
  }

  return ok({ success: true, message: 'Telegram unlinked successfully' });
}

// ============================================================
// ADMIN SETUP HANDLER
// ============================================================

async function handleTelegramSetup(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) return ok({ configured: false, message: 'Add TELEGRAM_BOT_TOKEN to enable Telegram.' });

  const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/webhook`;

  const payload = { url: webhookUrl, drop_pending_updates: true, allowed_updates: ['message', 'edited_message'] };
  if (TELEGRAM_WEBHOOK_SECRET) payload.secret_token = TELEGRAM_WEBHOOK_SECRET;

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  const infoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
  const info = await infoRes.json();

  const db = await getDb();
  const linkedCount = await db.collection('telegram_mappings').countDocuments({ linked: true });

  return ok({
    configured: true,
    webhook: data,
    bot: info.result,
    webhookUrl,
    secretProtected: !!TELEGRAM_WEBHOOK_SECRET,
    linkedUsers: linkedCount,
  });
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'status') return handleTelegramStatus(request);
    
    return err('Telegram endpoint not found', 404);
  } catch (error) {
    console.error('[Telegram API] GET Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'webhook') return handleTelegramWebhook(request);
    if (pathStr === 'link') return handleTelegramLink(request);
    if (pathStr === 'unlink') return handleTelegramUnlink(request);
    if (pathStr === 'set-model') return handleTelegramSetModel(request);
    if (pathStr === 'setup') return handleTelegramSetup(request);
    
    return err('Telegram endpoint not found', 404);
  } catch (error) {
    console.error('[Telegram API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
