/**
 * Scheduling handlers (social media post generation, scheduled tasks)
 * Extracted from the main catch-all route.js for maintainability.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err } from '@/lib/api-utils';
import { sendTelegramMessage } from '@/lib/handlers/telegram-handlers';

// ── Social Media Platform Formats
const SOCIAL_PLATFORMS = {
  twitter:   { name: 'Twitter/X',  maxChars: 280,  hashtags: 3,  emoji: true },
  instagram: { name: 'Instagram',  maxChars: 2200, hashtags: 10, emoji: true  },
  linkedin:  { name: 'LinkedIn',   maxChars: 1300, hashtags: 5,  emoji: false },
  tiktok:    { name: 'TikTok',     maxChars: 300,  hashtags: 8,  emoji: true  },
  facebook:  { name: 'Facebook',   maxChars: 500,  hashtags: 3,  emoji: true  },
  threads:   { name: 'Threads',    maxChars: 500,  hashtags: 5,  emoji: true  },
  youtube:   { name: 'YouTube',    maxChars: 5000, hashtags: 5,  emoji: false },
};

async function generateSocialPost({ platform, topic, userContext, model = 'gpt-4o', includeSearch = true }) {
  const fmt = SOCIAL_PLATFORMS[platform.toLowerCase()] || SOCIAL_PLATFORMS.twitter;
  let searchContext = '';

  if (includeSearch) {
    const { buildSearchContext } = await import('@/lib/llm/providers');
    const ctx = await buildSearchContext(topic);
    if (ctx) searchContext = `\n\nReal-time context:\n${ctx}`;
  }

  const systemMsg = `You are a professional social media copywriter. Create viral, engaging content that drives engagement. Follow platform best practices exactly.`;
  const userMsg = `Create a ${fmt.name} post about: "${topic}"
${searchContext}
Platform rules:
- Max ${fmt.maxChars} characters (STRICT — trim if needed)
- Include ${fmt.hashtags} relevant hashtags
- ${fmt.emoji ? 'Use appropriate emojis' : 'No emojis (LinkedIn professional)'}
- ${platform === 'twitter' ? 'Make it punchy with a strong hook in first 5 words' : ''}
- ${platform === 'instagram' ? 'Start with a visual hook, tell a story, end with a question or CTA' : ''}
- ${platform === 'linkedin' ? 'Professional insight-driven post. Start with a bold statement. Include a clear business value and CTA' : ''}
- ${platform === 'tiktok' ? 'Viral hook in first line. Include trending hashtags and suggest a sound or trend' : ''}
${userContext ? `\nUser persona/voice: ${userContext}` : ''}
Output ONLY the post text, no explanations. Include hashtags at the end.`;

  const { getProvider } = await import('@/lib/llm/providers');
  const provider = getProvider('openai', model);
  const text = await provider.generateChatCompletion({
    systemPrompt: systemMsg,
    messages: [{ role: 'user', content: userMsg }],
    model,
    temperature: 0.8,
  });

  return { post: text, platform: fmt.name, maxChars: fmt.maxChars };
}

// Common timezone offsets
const TIMEZONE_OPTIONS = [
  { label: 'UTC',                   offset: 0   },
  { label: 'EST (UTC-5)',           offset: -5  },
  { label: 'CST (UTC-6)',           offset: -6  },
  { label: 'MST (UTC-7)',           offset: -7  },
  { label: 'PST (UTC-8)',           offset: -8  },
  { label: 'Brazil (UTC-3)',        offset: -3  },
  { label: 'London (UTC+0/+1)',     offset: 0   },
  { label: 'Paris/Berlin (UTC+1)',  offset: 1   },
  { label: 'Moscow (UTC+3)',        offset: 3   },
  { label: 'Dubai (UTC+4)',         offset: 4   },
  { label: 'India (UTC+5:30)',      offset: 5.5 },
  { label: 'Singapore (UTC+8)',     offset: 8   },
  { label: 'Tokyo (UTC+9)',         offset: 9   },
  { label: 'Sydney (UTC+10)',       offset: 10  },
];

const SCHEDULE_TEMPLATES = [
  { id: 'ai_news',    name: '🤖 AI News Digest',     prompt: 'Summarize the top 5 most important AI and machine learning stories from the last 24 hours. For each story include: what happened, why it matters, and a source if available. Format it clearly.' },
  { id: 'world_news', name: '🌍 World News Brief',    prompt: 'What are the top 5 most important world news stories from the last 24 hours? Give a clear, concise summary of each.' },
  { id: 'market',     name: '📈 Market Summary',      prompt: 'Give me a summary of today\'s financial markets: major indices performance, top gainers/losers, notable news, and key economic events from the last 24 hours.' },
  { id: 'tech_news',  name: '💻 Tech News',           prompt: 'What are the most significant technology news stories from the last 24 hours? Focus on product launches, funding, acquisitions, and industry trends.' },
  { id: 'crypto',     name: '₿ Crypto Brief',         prompt: 'Summarize the cryptocurrency market over the last 24 hours: Bitcoin and Ethereum prices, major movers, key news and developments.' },
  { id: 'custom',     name: '✏️ Custom',              prompt: '' },
];

function getNextRunAt(hourUTC, minute, scheduleType, dayOfWeek = null) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hourUTC, minute, 0, 0);

  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  if (scheduleType === 'weekly' && dayOfWeek !== null) {
    while (next.getUTCDay() !== dayOfWeek) next.setUTCDate(next.getUTCDate() + 1);
  } else if (scheduleType === 'weekdays') {
    while ([0, 6].includes(next.getUTCDay())) next.setUTCDate(next.getUTCDate() + 1);
  } else if (scheduleType === 'weekends') {
    while (![0, 6].includes(next.getUTCDay())) next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

async function handleGetSchedules(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  const db = await getDb();
  const tasks = await db.collection('scheduled_tasks')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();
  return ok(tasks);
}

async function handleCreateSchedule(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { name, prompt, local_hour, minute = 0, timezone_offset = 0, schedule_type = 'daily', day_of_week = null, timezone_label = 'UTC' } = body;

  if (!name || !prompt) return err('name and prompt required');
  if (local_hour == null || local_hour < 0 || local_hour > 23) return err('valid local_hour (0-23) required');

  const db = await getDb();

  const count = await db.collection('scheduled_tasks').countDocuments({ user_id: user.id });
  if (count >= 10) return err('Maximum 10 schedules per user');

  const hourUTC = Math.round(((local_hour - timezone_offset) % 24 + 24) % 24);
  const nextRun = getNextRunAt(hourUTC, minute, schedule_type, day_of_week);

  const task = {
    id: uuidv4(),
    user_id: user.id,
    name,
    prompt,
    local_hour,
    minute,
    hour_utc: hourUTC,
    timezone_offset,
    timezone_label,
    schedule_type,
    day_of_week,
    active: true,
    delivery: 'telegram',
    last_run_at: null,
    next_run_at: nextRun,
    run_count: 0,
    created_at: new Date(),
  };

  await db.collection('scheduled_tasks').insertOne(task);
  return ok(task);
}

async function handleUpdateSchedule(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const db = await getDb();

  const task = await db.collection('scheduled_tasks').findOne({ id: taskId, user_id: user.id });
  if (!task) return err('Schedule not found', 404);

  const updates = {};
  if (body.active !== undefined) updates.active = body.active;
  if (body.name) updates.name = body.name;
  if (body.prompt) updates.prompt = body.prompt;

  if (body.active === true) {
    updates.next_run_at = getNextRunAt(task.hour_utc, task.minute, task.schedule_type, task.day_of_week);
  }

  await db.collection('scheduled_tasks').updateOne({ id: taskId }, { $set: updates });
  return ok({ success: true });
}

async function handleDeleteSchedule(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  const db = await getDb();
  await db.collection('scheduled_tasks').deleteOne({ id: taskId, user_id: user.id });
  return ok({ success: true });
}

async function handleRunSchedules(request) {
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = await getDb();
  const now = new Date();

  const dueTasks = await db.collection('scheduled_tasks').find({
    active: true,
    next_run_at: { $lte: now },
  }).toArray();

  if (dueTasks.length === 0) return ok({ ran: 0 });

  let ran = 0;
  for (const task of dueTasks) {
    try {
      const nextRun = getNextRunAt(task.hour_utc, task.minute, task.schedule_type, task.day_of_week);
      await db.collection('scheduled_tasks').updateOne(
        { id: task.id },
        { $set: { next_run_at: nextRun, last_run_at: now, run_count: (task.run_count || 0) + 1 } }
      );

      const mapping = await db.collection('telegram_mappings').findOne({ user_id: task.user_id, linked: true });
      if (!mapping) continue;

      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (!TELEGRAM_BOT_TOKEN) continue;

      const chatId = mapping.telegram_chat_id;
      const preferredModel = mapping.preferred_model || 'gpt-4o';
      const preferredProvider = mapping.preferred_provider || 'openai';

      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `⏰ *Scheduled: ${task.name}*\n_Running your scheduled task..._`
      );

      const { buildSearchContext, getProvider: gp } = await import('@/lib/llm/providers');
      const searchCtx = await buildSearchContext(task.prompt);
      const systemMsg = `You are a helpful AI assistant delivering a scheduled briefing. Be concise, informative, and well-formatted for reading in Telegram (use markdown *bold* and bullet points).`;
      const fullPrompt = searchCtx
        ? `${searchCtx}\n\n---\n\nBased on the above real-time data, please: ${task.prompt}`
        : task.prompt;

      const provider = gp(preferredProvider, preferredModel);
      let response = '';
      try {
        const { stream } = await provider.generateStream({
          systemPrompt: systemMsg,
          messages: [{ role: 'user', content: fullPrompt }],
          model: preferredModel,
          temperature: 0.7,
          enableWebSearch: false,
        });
        for await (const chunk of stream) response += chunk;
      } catch {
        response = await provider.generateChatCompletion({
          systemPrompt: systemMsg,
          messages: [{ role: 'user', content: fullPrompt }],
          model: preferredModel,
          temperature: 0.7,
        });
      }

      const formattedTime = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      const header = `📋 *${task.name}*\n_${formattedTime} UTC · ${preferredModel}_\n\n`;
      const fullMsg = header + response;

      const chunks = [];
      const MAX = 3800;
      for (let i = 0; i < fullMsg.length; i += MAX) chunks.push(fullMsg.slice(i, i + MAX));
      for (const chunk of chunks) await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, chunk);

      const conv = await db.collection('conversations').findOne({ user_id: task.user_id, source: 'telegram' })
        || { id: null };
      if (conv.id) {
        await db.collection('messages').insertOne({
          id: uuidv4(), conversation_id: conv.id, user_id: task.user_id,
          role: 'assistant', content: response, created_at: now,
          source: 'scheduled', schedule_id: task.id, model_used: preferredModel,
          est_input_tokens: Math.round(fullPrompt.length / 4),
          est_output_tokens: Math.round(response.length / 4),
        });
      }

      ran++;
    } catch (e) {
      console.error(`Scheduler: error running task ${task.id}:`, e.message);
    }
  }

  return ok({ ran, total: dueTasks.length });
}

export {
  SOCIAL_PLATFORMS,
  generateSocialPost,
  TIMEZONE_OPTIONS,
  SCHEDULE_TEMPLATES,
  getNextRunAt,
  handleGetSchedules,
  handleCreateSchedule,
  handleUpdateSchedule,
  handleDeleteSchedule,
  handleRunSchedules,
};
