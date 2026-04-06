/**
 * Telegram bot connector handlers
 * Extracted from the main catch-all route.js for maintainability.
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err } from '@/lib/api-utils';

async function sendTelegramMessage(chatId, token, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function handleTelegramStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return ok({ configured: false, linked: false, message: 'Telegram bot not configured' });
  }

  const db = await getDb();
  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });

  return ok({
    configured: true,
    linked: !!mapping,
    telegram_chat_id: mapping?.telegram_chat_id || null,
    telegram_username: mapping?.telegram_username || null,
    preferred_model: mapping?.preferred_model || 'gpt-4o',
    linked_at: mapping?.linked_at || null,
  });
}

async function handleTelegramLink(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { link_code } = body;
  if (!link_code) return err('Link code required');

  const db = await getDb();

  const pending = await db.collection('telegram_links').findOne({
    code: link_code.trim(),
    used: { $ne: true },
  });

  if (!pending) {
    return err('Invalid or expired link code. Please generate a new one in Telegram by sending /start.', 400);
  }

  const codeAge = Date.now() - new Date(pending.created_at).getTime();
  if (codeAge > 15 * 60 * 1000) {
    return err('Link code expired. Please generate a new one in Telegram by sending /start.', 400);
  }

  await db.collection('telegram_links').updateOne(
    { _id: pending._id },
    { $set: { used: true, used_at: new Date(), user_id: user.id } }
  );

  await db.collection('telegram_mappings').updateOne(
    { user_id: user.id },
    {
      $set: {
        user_id: user.id,
        telegram_chat_id: pending.chat_id,
        telegram_username: pending.username || null,
        linked: true,
        linked_at: new Date(),
        preferred_model: 'gpt-4o',
      }
    },
    { upsert: true }
  );

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && pending.chat_id) {
    try {
      await sendTelegramMessage(pending.chat_id, botToken, '✅ *Successfully linked to SoulPrint!*\n\nYou can now chat with me here. Send any message to get started.\n\nUse /model to change the AI model.');
    } catch (e) {
      console.error('Failed to send Telegram confirmation:', e);
    }
  }

  return ok({ message: 'Telegram linked successfully!' });
}

async function handleTelegramUnlink(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });

  if (!mapping) {
    return err('No linked Telegram account found', 404);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && mapping.telegram_chat_id) {
    try {
      await sendTelegramMessage(mapping.telegram_chat_id, botToken, '👋 *Disconnected from SoulPrint.*\n\nYour Telegram has been unlinked. Send /start to re-link.');
    } catch (e) {
      console.error('Failed to send Telegram disconnect msg:', e);
    }
  }

  await db.collection('telegram_mappings').updateOne(
    { user_id: user.id },
    { $set: { linked: false, unlinked_at: new Date() } }
  );

  return ok({ message: 'Telegram disconnected' });
}

async function handleTelegramModel(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { model } = body;
  if (!model) return err('Model required');

  const db = await getDb();
  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });

  if (!mapping) {
    return err('No linked Telegram account. Please link Telegram first.', 400);
  }

  await db.collection('telegram_mappings').updateOne(
    { user_id: user.id, linked: true },
    { $set: { preferred_model: model, model_updated_at: new Date() } }
  );

  return ok({ message: `Model set to ${model}`, model });
}

async function handleTelegramWebhook(request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return err('Bot not configured', 500);

  const body = await request.json();
  const message = body?.message;
  if (!message?.text || !message?.chat?.id) return ok({ ok: true });

  const chatId = message.chat.id;
  const text = message.text.trim();
  const username = message.from?.username || null;

  const db = await getDb();

  // Handle /start command
  if (text === '/start' || text.startsWith('/start')) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await db.collection('telegram_links').insertOne({
      code,
      chat_id: chatId,
      username,
      created_at: new Date(),
      used: false,
    });
    await sendTelegramMessage(chatId, botToken,
      `🔗 *Link to SoulPrint*\n\nYour link code is: \`${code}\`\n\nGo to SoulPrint → Settings → Telegram and enter this code to connect.\n\n_Code expires in 15 minutes._`
    );
    return ok({ ok: true });
  }

  // Handle /model command
  if (text.startsWith('/model')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendTelegramMessage(chatId, botToken,
        '🤖 *Current models:*\n`smart` - Dynamic Intelligence (auto)\n`gpt-4o` - GPT-4o\n`gpt-4o-mini` - GPT-4o Mini\n`gpt-4.1` - GPT-4.1\n`claude-sonnet-4-20250514` - Claude Sonnet 4\n`gemini-2.5-pro` - Gemini 2.5 Pro\n`sonar-pro` - Perplexity Sonar Pro\n\nUsage: `/model gpt-4o`'
      );
      return ok({ ok: true });
    }
    const modelName = parts.slice(1).join(' ');
    const mapping = await db.collection('telegram_mappings').findOne({ telegram_chat_id: chatId, linked: true });
    if (mapping) {
      await db.collection('telegram_mappings').updateOne(
        { telegram_chat_id: chatId, linked: true },
        { $set: { preferred_model: modelName, model_updated_at: new Date() } }
      );
      await sendTelegramMessage(chatId, botToken, `✅ Model set to \`${modelName}\``);
    } else {
      await sendTelegramMessage(chatId, botToken, '❌ Please link your account first. Send /start to get a link code.');
    }
    return ok({ ok: true });
  }

  // Regular message — find mapping and route to AI
  const mapping = await db.collection('telegram_mappings').findOne({ telegram_chat_id: chatId, linked: true });
  if (!mapping) {
    await sendTelegramMessage(chatId, botToken, '❌ Your account is not linked. Send /start to link.');
    return ok({ ok: true });
  }

  let conv = await db.collection('conversations').findOne({ user_id: mapping.user_id, source: 'telegram' });
  if (!conv) {
    const convId = uuidv4();
    conv = {
      id: convId,
      user_id: mapping.user_id,
      title: 'Telegram Chat',
      source: 'telegram',
      created_at: new Date(),
      updated_at: new Date(),
    };
    await db.collection('conversations').insertOne(conv);
  }

  const userMsgId = uuidv4();
  await db.collection('messages').insertOne({
    id: userMsgId,
    conversation_id: conv.id,
    user_id: mapping.user_id,
    role: 'user',
    content: text,
    source: 'telegram',
    created_at: new Date(),
  });

  await db.collection('conversations').updateOne(
    { id: conv.id },
    { $set: { updated_at: new Date() } }
  );

  const recentMessages = await db.collection('messages')
    .find({ conversation_id: conv.id })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();
  recentMessages.reverse();

  const model = mapping.preferred_model || 'gpt-4o';

  const profile = await db.collection('profiles').findOne({ user_id: mapping.user_id });
  const displayName = profile?.display_name || username || 'there';

  try {
    const messages = [
      { role: 'system', content: `You are SoulPrint, a helpful AI assistant. You are chatting with ${displayName} via Telegram. Be concise and helpful. Keep responses short and mobile-friendly.` },
      ...recentMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model, messages, max_tokens: 1000 }),
    });

    const aiData = await aiRes.json();
    const reply = aiData.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response. Please try again.';

    const assistantMsgId = uuidv4();
    await db.collection('messages').insertOne({
      id: assistantMsgId,
      conversation_id: conv.id,
      user_id: mapping.user_id,
      role: 'assistant',
      content: reply,
      model_used: model,
      source: 'telegram',
      created_at: new Date(),
    });

    await sendTelegramMessage(chatId, botToken, reply);
  } catch (aiErr) {
    console.error('Telegram AI error:', aiErr);
    await sendTelegramMessage(chatId, botToken, '⚠️ Sorry, I encountered an error. Please try again.');
  }

  return ok({ ok: true });
}

async function handleConnectorStub(platform) {
  return NextResponse.json({
    status: 'not_configured',
    message: `${platform} connector is not yet implemented. Telegram is available — configure TELEGRAM_BOT_TOKEN in .env.`,
  });
}

export {
  sendTelegramMessage,
  handleTelegramStatus,
  handleTelegramLink,
  handleTelegramUnlink,
  handleTelegramModel,
  handleTelegramWebhook,
  handleConnectorStub,
};
