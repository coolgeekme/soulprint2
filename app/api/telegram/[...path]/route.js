import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import { ok, err, authenticate, getValidGoogleToken, getAllGoogleConnections, trimHistory, ensureAlternatingMessages } from '@/lib/api-utils';
import { sendTelegramMessage } from '@/lib/telegram-utils';
import { extractUrlContent, extractUrls } from '@/lib/handlers/url-extractor';
import { geocodeAddress, searchNearbyPlaces, parseLocationQuery, extractPlaceType } from '@/lib/handlers/location-services';
import { generateImageWithKie } from '@/lib/handlers/model-comparison';
import {
  checkChatRateLimit,
  sanitizeInput,
  getSystemPrompt,
  invalidateSystemPromptCache,
  classifyQueryForSmartMode,
  SOCIAL_PLATFORMS,
  generateSocialPost,
  SCHEDULE_TEMPLATES,
  getNextRunAt,
} from '@/lib/handlers/telegram-utils-shared';

async function requireAdmin(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) return null;
  return user;
}

// ============================================================
// TELEGRAM HELPER FUNCTIONS
// ============================================================

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
    // Fallback to document if video fails
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
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: '📍 Share My Location', request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }),
    });
  } catch (e) { console.error('requestTelegramLocation error:', e.message); }
}


async function removeTelegramKeyboard(chatId, token, message) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true },
      }),
    });
  } catch (e) { console.error('removeTelegramKeyboard error:', e.message); }
}


function formatPlacesForTelegram(places, locationName) {
  if (!places || places.length === 0) {
    return `😕 No places found near ${locationName}. Try a different search or location.`;
  }
  
  const header = `📍 *Found ${places.length} places near ${locationName}:*\n\n`;
  
  const placesList = places.map((p, i) => {
    const rating = p.rating ? `⭐ ${p.rating}` : '';
    const reviews = p.userRatingsTotal ? `(${p.userRatingsTotal})` : '';
    const price = p.priceLevel ? '💰'.repeat(p.priceLevel) : '';
    const status = p.isOpen === true ? '🟢 Open' : p.isOpen === false ? '🔴 Closed' : '';
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' ' + p.address)}&query_place_id=${p.placeId}`;
    
    return `*${i + 1}. ${p.name}*\n` +
      `${p.address}\n` +
      `${[rating, reviews, price, status].filter(Boolean).join(' ')}\n` +
      `[📍 Open in Maps](${mapsLink})`;
  }).join('\n\n');
  
  return header + placesList;
}



// ============================================================
// TELEGRAM HANDLER FUNCTIONS
// ============================================================

async function handleTelegramWebhook(request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ status: 'not_configured', message: 'TELEGRAM_BOT_TOKEN not set' });
  }

  // Verify webhook secret — prevents anyone who guesses the URL from spoofing messages
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
  if (!message?.text) return ok({ ok: true });

  const chatId = message.chat.id;
  const text = message.text.trim();
  const telegramUserId = message.from?.id?.toString();
  const fromName = message.from?.first_name || 'User';

  const db = await getDb();

  // Map telegram_user_id -> soulprint user
  let mapping = await db.collection('telegram_mappings').findOne({ telegram_user_id: telegramUserId });

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

  // ── /model command — list or switch AI model ────────────────────────────────
  if (text === '/model' || text.startsWith('/model ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const parts = text.split(' ');
    const currentModel = mapping.preferred_model || 'gpt-4o';

    if (parts.length === 1) {
      // Show current model and list options
      const modelList = [
        '🧠 *Dynamic Intelligence*: `smart` - Auto-selects best model for each query',
        '🟢 *OpenAI*: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`',
        '🟣 *Claude*: `claude-sonnet-4-5-20250929`, `claude-3-5-haiku-20241022`',
        '🔵 *Gemini*: `gemini-2.0-flash`, `gemini-2.5-pro`',
        '🌐 *Perplexity (online)*: `sonar`, `sonar-pro`',
        '🟡 *Kimi*: `kimi-k2-0711-preview`, `moonshot-v1-32k`',
      ].join('\n');
      const smartNote = currentModel === 'smart' ? ' _(Dynamic Intelligence auto-selects models)_' : '';
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `🤖 *Current AI model:* \`${currentModel}\`${smartNote}\n\nAvailable models:\n${modelList}\n\nTo switch: \`/model smart\` or \`/model gpt-4o\`\n\n💡 *Dynamic Intelligence* intelligently picks the best model for each query (coding → GPT-4o, search → Sonar, creative → Claude, etc.)`
      );
      return ok({ ok: true });
    }

    // Switch model
    const newModel = parts[1].trim().toLowerCase();
    
    // Handle Dynamic Intelligence selection
    if (newModel === 'smart') {
      await db.collection('telegram_mappings').updateOne(
        { telegram_user_id: telegramUserId },
        { $set: { preferred_model: 'smart', preferred_provider: 'smart' } }
      );
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `🧠 *Dynamic Intelligence activated!*\n\nI'll now automatically select the best AI model for each query:\n• 📰 News/search → Perplexity Sonar\n• 💻 Code → GPT-4o\n• ✍️ Creative → Claude\n• 🔢 Math → Gemini\n• 🔬 Analysis → Claude Opus\n\nYour messages will show which model was selected.`
      );
      return ok({ ok: true });
    }
    
    const { AVAILABLE_MODELS: models } = await import('@/lib/llm/providers');
    const found = models.find(m => m.value === newModel || m.label.toLowerCase().includes(newModel));
    if (!found) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `❌ Unknown model: \`${newModel}\`\n\nSend /model to see available options.`
      );
      return ok({ ok: true });
    }

    await db.collection('telegram_mappings').updateOne(
      { telegram_user_id: telegramUserId },
      { $set: { preferred_model: found.value, preferred_provider: found.provider } }
    );
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `✅ AI model switched to *${found.label}* (${found.group})\n\nAll future messages will use this model.`
    );
    return ok({ ok: true });
  }

  // ── /location command — share or update location ──────────────────────────────
  if (text === '/location' || text === '/loc') {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    
    // Check if user already has a location
    const existingLoc = await db.collection('user_locations').findOne({ user_id: userId });
    if (existingLoc && existingLoc.lat && existingLoc.lng) {
      await requestTelegramLocation(chatId, TELEGRAM_BOT_TOKEN,
        `📍 *Your current location:*\n${existingLoc.address || 'Saved location'}\n\n_Tap the button below to update your location._`
      );
    } else {
      await requestTelegramLocation(chatId, TELEGRAM_BOT_TOKEN,
        `📍 *Share your location*\n\nTap the button below to share your current location. This enables "near me" searches for restaurants, stores, and more!`
      );
    }
    return ok({ ok: true });
  }

  // ── /image command — generate image with Kie.ai GPT-4o Image ─────────────────
  if (text.startsWith('/image ') || text.startsWith('/img ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const prompt = text.replace(/^\/(image|img)\s+/, '').trim();
    if (!prompt) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '❌ Usage: /image [your prompt]\nExample: /image a futuristic city at sunset');
      return ok({ ok: true });
    }
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'upload_photo' }),
    });
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🎨 Generating your image with Kie.ai (GPT-4o Image)...\n_This may take 30-60 seconds_');
    try {
      const imageUrl = await generateImageWithKie(prompt, '1:1');
      await sendTelegramPhoto(chatId, TELEGRAM_BOT_TOKEN, imageUrl,
        `🎨 *Generated Image*\n\n_Prompt: ${prompt.substring(0, 200)}_`
      );
    } catch (e) {
      console.error('Telegram image generation error:', e);
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Image generation failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /video command — generate video with Kie.ai Kling 3.0 ───────────────────────
  if (text.startsWith('/video ') || text.startsWith('/vid ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const prompt = text.replace(/^\/(video|vid)\s+/, '').trim();
    if (!prompt) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '❌ Usage: /video [your prompt]\nExample: /video waves crashing on a beach at golden hour');
      return ok({ ok: true });
    }
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `🎬 *Starting video generation with Kling 3.0...*\n\n_"${prompt.substring(0, 150)}"_\n\nThis takes 1-3 minutes. I'll send the video when it's ready!`
    );
    try {
      const kieKey = process.env.KIE_API_KEY;
      // Use Kling 3.0 via the unified Jobs API
      const vidRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
        body: JSON.stringify({ 
          model: 'kling-3.0/video',
          input: {
            prompt, 
            duration: '5',
            aspect_ratio: '16:9',
            mode: 'std',
            sound: false,
            multi_shots: false,
            multi_prompt: [],
            kling_elements: [],
          }
        }),
      });
      const vidData = await vidRes.json();
      console.log('Telegram /video Kie.ai response:', JSON.stringify(vidData).substring(0, 500));
      if (vidData.code !== 200) throw new Error(vidData.msg || vidData.error || 'Video generation failed');
      const taskId = vidData.data?.taskId;

      // Poll for completion (up to 5 minutes) using the Jobs API status endpoint
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 10000)); // wait 10s
        attempts++;
        const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${kieKey}` },
        });
        const pollData = await pollRes.json();
        const state = pollData.data?.status?.toLowerCase();
        const output = pollData.data?.output || {};
        const videoUrl = output.video_url || output.videoUrl;
        const thumbnailUrl = output.cover_url || output.imageUrl;

        if (state === 'success' && videoUrl) {
          // Send the actual video file to Telegram (not just a link)
          await sendTelegramVideo(chatId, TELEGRAM_BOT_TOKEN, videoUrl,
            `🎬 *Your video is ready!*\n\n_"${prompt.substring(0, 200)}"_`
          );
          break;
        } else if (state === 'failed' || state === 'fail') {
          const errMsg = pollData.data?.error || 'Unknown error';
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Video generation failed: ${errMsg}`);
          break;
        }
        // Still generating — send progress update every ~60 seconds
        if (attempts % 6 === 0) {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `⏳ Still generating your video... (${Math.round(attempts * 10 / 60)} min elapsed)`);
        }
      }
      if (attempts >= maxAttempts) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `⏱️ Video is taking longer than expected. Check back in a few minutes.`);
      }
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Video generation failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /read command — extract and summarize URL content ─────────────────────
  if (text.startsWith('/read ') || text.startsWith('/url ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    if (!urlMatch) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '❌ Usage: /read [URL]\nExample: /read https://example.com/article');
      return ok({ ok: true });
    }
    const url = urlMatch[0];
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🔗 Reading and summarizing page...');
    try {
      const extracted = await extractUrlContent(url);
      if (!extracted.success) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Could not read page: ${extracted.error}`);
        return ok({ ok: true });
      }
      
      // Get AI to summarize
      const { getProvider: gp } = await import('@/lib/llm/providers');
      const provider = gp(preferredProvider, preferredModel);
      const summaryPrompt = `Summarize the following webpage content concisely. Include key points and main takeaways:\n\n**Title:** ${extracted.title}\n**URL:** ${url}\n\n${extracted.content}`;
      
      let summary;
      try {
        const { stream } = await provider.generateStream({
          systemPrompt: 'You are a helpful assistant that summarizes web content clearly and concisely.',
          messages: [{ role: 'user', content: summaryPrompt }],
          model: preferredModel, temperature: 0.5,
        });
        summary = '';
        for await (const chunk of stream) { summary += chunk; }
      } catch {
        summary = await provider.generateChatCompletion({
          systemPrompt: 'You are a helpful assistant that summarizes web content.',
          messages: [{ role: 'user', content: summaryPrompt }],
          model: preferredModel, temperature: 0.5,
        });
      }
      
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `📄 *${extracted.title || 'Page Summary'}*\n\n${summary}\n\n🔗 [Open original](${url})`
      );
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Error: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /nearby and /find commands — location-based place search ────────────────
  if (text.startsWith('/nearby ') || text.startsWith('/find ') || text.startsWith('/places ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    
    const query = text.replace(/^\/(nearby|find|places)\s+/i, '').trim();
    if (!query) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `📍 *Location Search*\n\n` +
        `Usage:\n` +
        `/nearby [type] in [location]\n` +
        `/find [search] near [location]\n\n` +
        `Examples:\n` +
        `• /nearby restaurants in Austin, TX\n` +
        `• /find coffee shops near Times Square\n` +
        `• /nearby gas stations in 90210\n` +
        `• /find Italian food near me (share location first)\n\n` +
        `Types: restaurants, cafes, bars, hotels, gas stations, pharmacies, gyms, banks, parks, museums, etc.`
      );
      return ok({ ok: true });
    }
    
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🔍 Searching for places...');
    
    try {
      // Parse location from query
      let locationName = parseLocationQuery(query);
      let coords = null;
      
      // Check if user has shared location recently (stored in DB)
      if (!locationName || locationName.toLowerCase() === 'me') {
        const userLocation = await db.collection('user_locations').findOne({ user_id: userId });
        if (userLocation && userLocation.lat && userLocation.lng) {
          coords = { lat: userLocation.lat, lng: userLocation.lng };
          locationName = userLocation.address || 'your location';
        } else {
          // Store the pending search query so we can use it after location is shared
          await db.collection('user_locations').updateOne(
            { user_id: userId },
            { $set: { pending_search: query, pending_search_at: new Date() } },
            { upsert: true }
          );
          // Request location via Telegram keyboard button
          await requestTelegramLocation(chatId, TELEGRAM_BOT_TOKEN,
            `📍 *Share your location to find places near you!*\n\nTap the button below to share your current location, then I'll find ${query} nearby.`
          );
          return ok({ ok: true });
        }
      } else {
        // Geocode the location
        coords = await geocodeAddress(locationName);
        if (!coords) {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Could not find location: "${locationName}"`);
          return ok({ ok: true });
        }
        locationName = coords.formattedAddress || locationName;
      }
      
      // Extract place type from query
      const searchTerm = query.replace(/\s+(near|in|around|at)\s+.+$/i, '').trim();
      const placeType = extractPlaceType(searchTerm);
      
      // Search for places
      const places = await searchNearbyPlaces({
        lat: coords.lat,
        lng: coords.lng,
        query: placeType ? null : searchTerm, // Use text search if no specific type
        type: placeType,
        radius: 2000,
        maxResults: 6,
      });
      
      const response = formatPlacesForTelegram(places, locationName);
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, response);
      
    } catch (e) {
      console.error('Places search error:', e);
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Search failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── Handle shared location from Telegram ────────────────────────────────────
  const location = message?.location;
  if (location && location.latitude && location.longitude) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    
    try {
      // Get any pending search query
      const existingLocation = await db.collection('user_locations').findOne({ user_id: userId });
      const pendingSearch = existingLocation?.pending_search;
      
      // Store user's location
      await db.collection('user_locations').updateOne(
        { user_id: userId },
        { 
          $set: { 
            lat: location.latitude, 
            lng: location.longitude, 
            updated_at: new Date(),
          },
          $unset: { pending_search: '', pending_search_at: '' }
        },
        { upsert: true }
      );
      
      // Reverse geocode to get address
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&key=${apiKey}`);
      const geoData = await geoRes.json();
      const address = geoData.results?.[0]?.formatted_address || 'your location';
      
      await db.collection('user_locations').updateOne(
        { user_id: userId },
        { $set: { address } }
      );
      
      // Invalidate system prompt cache so location is included in future queries
      invalidateSystemPromptCache(userId);
      
      // Remove the location keyboard
      await removeTelegramKeyboard(chatId, TELEGRAM_BOT_TOKEN, `📍 Got it! Location: *${address}*`);
      
      // If there was a pending search, execute it now
      if (pendingSearch) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `🔍 Now searching for ${pendingSearch}...`);
        
        // Extract search term from pending query
        const searchTerm = pendingSearch.replace(/\s+(near|in|around|at)\s+.+$/i, '').trim();
        const placeType = extractPlaceType(searchTerm);
        
        const places = await searchNearbyPlaces({
          lat: location.latitude,
          lng: location.longitude,
          query: placeType ? null : searchTerm,
          type: placeType,
          radius: 2000,
          maxResults: 6,
        });
        
        const response = formatPlacesForTelegram(places, address);
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, response);
      } else {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `Now you can ask:\n` +
          `• "Find restaurants near me"\n` +
          `• "Where are coffee shops nearby?"\n` +
          `• /nearby gas stations`
        );
      }
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Error: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /post command — generate social media post ───────────────────────────────
  if (text.startsWith('/post ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const parts = text.slice(6).trim().split(' ');
    const platform = parts[0]?.toLowerCase();
    const topic = parts.slice(1).join(' ').trim();

    if (!platform || !topic) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `❌ Usage: /post [platform] [topic]\n\nExamples:\n/post twitter Bitcoin is hitting ATH today\n/post instagram My morning productivity routine\n/post linkedin Leadership lessons from remote work\n\nPlatforms: twitter, instagram, linkedin, tiktok, facebook, threads, youtube`
      );
      return ok({ ok: true });
    }

    if (!SOCIAL_PLATFORMS[platform]) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `❌ Unknown platform: "${platform}"\n\nSupported: ${Object.keys(SOCIAL_PLATFORMS).join(', ')}`
      );
      return ok({ ok: true });
    }

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `✍️ Generating ${SOCIAL_PLATFORMS[platform].name} post about *"${topic}"*...\n🌐 Searching for real-time data...`
    );

    try {
      // Get user context for personalized post
      const user = mapping ? await db.collection('users').findOne({ id: mapping.user_id }) : null;
      const profile = user ? await db.collection('profiles').findOne({ user_id: user.id }) : null;
      const userContext = profile ? `${profile.display_name || ''}, ${profile.descriptors?.join(', ') || ''}` : '';

      const { post, platform: platformName, maxChars } = await generateSocialPost({
        platform, topic, userContext,
        model: mapping.preferred_model || 'gpt-4o',
        includeSearch: true,
      });

      const charCount = post.length;
      const overLimit = charCount > maxChars;
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `📱 *${platformName} Post*\n${overLimit ? `⚠️ ${charCount}/${maxChars} chars — may need trimming\n` : `✅ ${charCount}/${maxChars} chars\n`}\n${post}`
      );
    } catch (e) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Post generation failed: ${e.message}`);
    }
    return ok({ ok: true });
  }

  // ── /search command — force a web search ────────────────────────────────────
  if (text.startsWith('/search ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const query = text.slice(8).trim();
    const { buildSearchContext: doSearch } = await import('@/lib/llm/providers');
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
    const ctx = await doSearch(query);
    if (ctx) {
      const maxLen = 3800;
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `🔍 *Search results for: ${query}*\n\n${ctx.slice(0, maxLen)}${ctx.length > maxLen ? '...' : ''}`
      );
    } else {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ No results found for: ${query}`);
    }
    return ok({ ok: true });
  }

  // ── /help command ───────────────────────────────────────────────────────────
  if (text === '/help') {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `🤖 *SoulPrint Bot Commands*\n\n` +
      `*💬 Chat*\nJust send any message to chat with your AI!\n\n` +
      `*🎨 Image Generation*\n/image [prompt] — Generate with Kie.ai (GPT-4o Image)\nExample: /image neon city at night\n\n` +
      `*🎬 Video Generation*\n/video [prompt] — Generate with Kie.ai\nExample: /video ocean waves at sunset\n\n` +
      `*🔗 Web Reading*\n/read [URL] — Read and summarize any webpage\nOr just paste a URL in your message!\nExample: /read https://example.com/article\n\n` +
      `*📍 Location Search*\n/location — Share or update your location\n/nearby [type] in [location] — Find places\n/find [search] near [location]\nOr just ask: "restaurants near me"\n\n` +
      `*📱 Social Media Posts*\n/post [platform] [topic] — Write a platform-optimized post with real-time data\n` +
      `Platforms: twitter, instagram, linkedin, tiktok, facebook, threads, youtube\n` +
      `Example: /post twitter AI trends this week\n\n` +
      `*⏰ Scheduled Tasks*\n/schedule — Create or manage scheduled tasks\n/schedule list — View your schedules\n/schedule delete [id] — Remove a schedule\n\n` +
      `*🌐 Web Search*\n/search [query] — Force a real-time web search\nOr just ask about current events naturally!\n\n` +
      `*🤖 AI Models*\n/model — See & switch AI model\n/model sonar — Switch to Perplexity (online AI)\n\n` +
      `*🧬 About*\n/soulprint — Learn what a SoulPrint is\n\n` +
      `*Misc*\n/start — Link your account\n/help — This menu`
    );
    return ok({ ok: true });
  }

  // ── /soulprint command ─────────────────────────────────────────────────────
  if (text === '/soulprint') {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `🧬 *What Is A SoulPrint?*\n\n` +
      `A SoulPrint is your *persistent AI identity layer*.\n\n` +
      `❌ Not a chatbot\n❌ Not a prompt wrapper\n❌ Not a memory plugin\n\n` +
      `It's a mapped, structured imprint of how you *think*, *decide*, *react*, *prioritize*, *trust*, and *communicate* — embedded into an AI system so the interaction reflects _you_, not generic model behavior.\n\n` +
      `*It captures:*\n` +
      `• Decision style\n• Conflict response\n• Boundary thresholds\n• Communication cadence\n• Emotional weighting\n• Pattern recognition over time\n\n` +
      `🔄 Most AI resets every session.\n✨ *A SoulPrint doesn't.*\n\n` +
      `It builds continuity, reference, and resonance across conversations so the system responds with _your_ logic, _your_ tone, _your_ structure — consistently.\n\n` +
      `*In short:*\nA SoulPrint is the _operating system of you_ — running on AI.`
    );
    return ok({ ok: true });
  }

  // ── /schedule command — create and manage scheduled tasks ─────────────────
  if (text === '/schedule' || text.startsWith('/schedule ')) {
    if (!mapping?.linked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Link your account first with /start');
      return ok({ ok: true });
    }
    const parts = text.split(' ');
    const subCommand = parts[1]?.toLowerCase();

    // /schedule list — show user's schedules
    if (subCommand === 'list') {
      const tasks = await db.collection('scheduled_tasks')
        .find({ user_id: mapping.user_id })
        .sort({ created_at: -1 })
        .toArray();
      
      if (tasks.length === 0) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `📋 *Your Schedules*\n\nNo scheduled tasks yet.\n\nUse /schedule to create one!`
        );
        return ok({ ok: true });
      }

      const taskList = tasks.map((t, i) => {
        const status = t.active ? '✅' : '⏸️';
        const timeStr = `${String(t.local_hour).padStart(2, '0')}:${String(t.minute || 0).padStart(2, '0')} ${t.timezone_label || 'UTC'}`;
        const typeEmoji = t.schedule_type === 'weekly' ? '📅' : t.schedule_type === 'weekdays' ? '💼' : '🔄';
        return `${status} *${i + 1}. ${t.name}*\n   ${typeEmoji} ${t.schedule_type} at ${timeStr}\n   ID: \`${t.id.slice(0, 8)}\``;
      }).join('\n\n');

      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `📋 *Your Schedules* (${tasks.length})\n\n${taskList}\n\n_Use /schedule delete [ID] to remove_`
      );
      return ok({ ok: true });
    }

    // /schedule delete [id] — delete a schedule
    if (subCommand === 'delete' && parts[2]) {
      const idPrefix = parts[2].toLowerCase();
      const task = await db.collection('scheduled_tasks').findOne({
        user_id: mapping.user_id,
        id: { $regex: `^${idPrefix}`, $options: 'i' }
      });
      
      if (!task) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ No schedule found with ID starting with "${idPrefix}"`);
        return ok({ ok: true });
      }

      await db.collection('scheduled_tasks').deleteOne({ id: task.id });
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `🗑️ Deleted schedule: *${task.name}*`);
      return ok({ ok: true });
    }

    // /schedule pause/resume [id]
    if ((subCommand === 'pause' || subCommand === 'resume') && parts[2]) {
      const idPrefix = parts[2].toLowerCase();
      const task = await db.collection('scheduled_tasks').findOne({
        user_id: mapping.user_id,
        id: { $regex: `^${idPrefix}`, $options: 'i' }
      });
      
      if (!task) {
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ No schedule found with ID starting with "${idPrefix}"`);
        return ok({ ok: true });
      }

      const newActive = subCommand === 'resume';
      const updates = { active: newActive };
      if (newActive) {
        updates.next_run_at = getNextRunAt(task.hour_utc, task.minute, task.schedule_type, task.day_of_week);
      }
      await db.collection('scheduled_tasks').updateOne({ id: task.id }, { $set: updates });
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `${newActive ? '▶️' : '⏸️'} Schedule *${task.name}* ${newActive ? 'resumed' : 'paused'}`
      );
      return ok({ ok: true });
    }

    // /schedule [template_id] — quick create from template
    const templateIds = SCHEDULE_TEMPLATES.map(t => t.id);
    if (templateIds.includes(subCommand)) {
      const template = SCHEDULE_TEMPLATES.find(t => t.id === subCommand);
      // Default to 8 AM in user's assumed timezone (UTC for now)
      const hourUTC = 8;
      const nextRun = getNextRunAt(hourUTC, 0, 'daily', null);
      
      const task = {
        id: uuidv4(),
        user_id: mapping.user_id,
        name: template.name,
        prompt: template.prompt,
        local_hour: 8,
        minute: 0,
        hour_utc: hourUTC,
        timezone_offset: 0,
        timezone_label: 'UTC',
        schedule_type: 'daily',
        day_of_week: null,
        active: true,
        delivery: 'telegram',
        last_run_at: null,
        next_run_at: nextRun,
        run_count: 0,
        created_at: new Date(),
      };
      await db.collection('scheduled_tasks').insertOne(task);
      
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `✅ *Schedule Created!*\n\n📋 *${template.name}*\n⏰ Daily at 08:00 UTC\n\nI'll send you this briefing every day!\n\n_Use /schedule list to see all schedules_`
      );
      return ok({ ok: true });
    }

    // /schedule (no args) — show menu with templates
    const templateList = SCHEDULE_TEMPLATES.filter(t => t.id !== 'custom').map(t =>
      `• \`/schedule ${t.id}\` — ${t.name}`
    ).join('\n');

    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `⏰ *Schedule a Recurring Task*\n\nQuick templates (daily at 8 AM UTC):\n${templateList}\n\n*Commands:*\n• /schedule list — View your schedules\n• /schedule delete [id] — Remove a schedule\n• /schedule pause [id] — Pause a schedule\n• /schedule resume [id] — Resume a schedule\n\n💡 _For custom schedules, use the web app Settings → Schedules tab._`
    );
    return ok({ ok: true });
  }

  if (!mapping?.linked || !mapping?.user_id) {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `⚠️ Your Telegram is not linked yet.\n\nSend /start to get your link code, then enter it in SoulPrint Settings → Telegram.`
    );
    return ok({ ok: true });
  }

  const userId = mapping.user_id;
  const user = await db.collection('users').findOne({ id: userId });
  if (!user || !user.accepted) {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Your SoulPrint account is not yet approved.');
    return ok({ ok: true });
  }

  // ── Best Practice: Rate Limiting for Telegram ─────────────────────────────
  if (checkChatRateLimit(userId, 60)) {
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ You\'ve sent too many messages. Please wait a bit before sending more.');
    return ok({ ok: true });
  }

  // ── Best Practice: Input Sanitization ────────────────────────────────────
  const sanitizedText = sanitizeInput(text);

  // Send typing indicator
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });

  // Determine model for this user
  let preferredModel = mapping.preferred_model || 'gpt-4o';
  let preferredProvider = mapping.preferred_provider || 'openai';
  let smartModeInfo = null;

  // ── Dynamic Intelligence: Automatically select best model for the query ────────────
  if (preferredModel === 'smart') {
    smartModeInfo = await classifyQueryForSmartMode(sanitizedText);
    preferredModel = smartModeInfo.model;
    preferredProvider = smartModeInfo.provider;
    console.log(`[Telegram Dynamic Intelligence] Query classified -> Model: ${preferredModel}, Reason: ${smartModeInfo.reason}`);
  }

  // ── Auto-detect media & social post intents in plain messages ────────────
  const lowerText = sanitizedText.toLowerCase();

  // Auto-detect image generation intent
  const isImageRequest = /\b(generate|create|make|draw|show me|give me)\s+(an?\s+)?(image|picture|photo|illustration|painting|artwork)\b/i.test(sanitizedText)
    || /\b(dall-?e|stable diffusion)\b/i.test(sanitizedText);

  // Auto-detect video generation intent
  const isVideoRequest = /\b(generate|create|make|animate)\s+(a\s+)?(video|clip|animation|short film)\b/i.test(sanitizedText);

  // Auto-detect social media post intent
  const socialMatch = sanitizedText.match(/\b(write|create|generate|make|draft)\s+(me\s+)?(a\s+)?(tweet|twitter|instagram|linkedin|tiktok|facebook|threads|youtube)\s+(post|caption|content|about)\b/i)
    || sanitizedText.match(/\b(twitter|instagram|linkedin|tiktok|facebook|threads)\s+(post|caption|content)\s+(about|for|on)\b/i);

  // Auto-detect location/places search intent
  const isPlacesRequest = /\b(find|where|what|show me|looking for|recommend|suggest|any|are there|is there)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|hospitals?|gyms?|banks?|atms?|groceries?|stores?|malls?|parks?|museums?|movies?|theaters?|movie\s*theaters?|cinemas?|parking|airports?)\b/i.test(sanitizedText)
    || /\b(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|gyms?|banks?|parks?|stores?|movie\s*theaters?|theaters?|cinemas?)\s+(near|in|around|close to)\b/i.test(sanitizedText)
    || /\b(what('s| is)|where('s| is|are)|any).*(near me|nearby|around here|close by)\b/i.test(lowerText)
    || /\b(movie\s*theaters?|cinemas?|theaters?)\s*(near|around|close)/i.test(lowerText);

  if (isImageRequest || isVideoRequest || socialMatch || isPlacesRequest) {
    try {
      // Handle places/location request
      if (isPlacesRequest) {
        // Parse location from query
        let locationName = parseLocationQuery(sanitizedText);
        let coords = null;
        
        // Check if user has shared location
        if (!locationName || /near me|nearby|around here|close by/i.test(lowerText)) {
          const userLocation = await db.collection('user_locations').findOne({ user_id: userId });
          if (userLocation && userLocation.lat && userLocation.lng) {
            coords = { lat: userLocation.lat, lng: userLocation.lng };
            locationName = userLocation.address || 'your location';
            await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🔍 Searching for places...');
          } else {
            // Store pending search and request location
            const searchTerm = sanitizedText.replace(/\s+(near|in|around|at|close to)\s+.*/i, '')
              .replace(/^(find|where|what|show me|looking for|recommend|suggest)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?/i, '')
              .replace(/\?+$/, '')
              .trim();
            
            await db.collection('user_locations').updateOne(
              { user_id: userId },
              { $set: { pending_search: searchTerm || 'places', pending_search_at: new Date() } },
              { upsert: true }
            );
            
            await requestTelegramLocation(chatId, TELEGRAM_BOT_TOKEN,
              `📍 *Share your location to find ${searchTerm || 'places'} near you!*\n\nTap the button below to share your current location.`
            );
            return ok({ ok: true });
          }
        } else {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🔍 Searching for places...');
          coords = await geocodeAddress(locationName);
          if (!coords) {
            await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Could not find location: "${locationName}"`);
            return ok({ ok: true });
          }
          locationName = coords.formattedAddress || locationName;
        }
        
        // Extract what they're looking for
        const searchTerm = sanitizedText.replace(/\s+(near|in|around|at|close to)\s+.+$/i, '')
          .replace(/^(find|where|what|show me|looking for|recommend|suggest)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?/i, '')
          .replace(/\?+$/, '')
          .trim();
        const placeType = extractPlaceType(searchTerm);
        
        const places = await searchNearbyPlaces({
          lat: coords.lat,
          lng: coords.lng,
          query: placeType ? null : searchTerm,
          type: placeType,
          radius: 2000,
          maxResults: 5,
        });
        
        const response = formatPlacesForTelegram(places, locationName);
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, response);
        return ok({ ok: true });
      }

      if (isImageRequest) {
        const prompt = sanitizedText.replace(/\b(generate|create|make|draw|show me|give me)\s+(an?\s+)?(image|picture|photo|illustration|painting|artwork)\s+(of\s+)?/i, '').trim() || sanitizedText;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, action: 'upload_photo' }),
        });
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '🎨 Generating your image with Kie.ai (GPT-4o Image)...\n_This may take 30-60 seconds_');
        try {
          const imageUrl = await generateImageWithKie(prompt, '1:1');
          await sendTelegramPhoto(chatId, TELEGRAM_BOT_TOKEN, imageUrl,
            `🎨 *Generated Image*\n_${prompt.substring(0, 200)}_`
          );
        } catch (imgErr) {
          await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Image generation failed: ${imgErr.message}`);
        }
        return ok({ ok: true });

      } else if (isVideoRequest) {
        const prompt = sanitizedText.replace(/\b(generate|create|make|animate)\s+(a\s+)?(video|clip|animation)\s+(of\s+)?/i, '').trim() || sanitizedText;
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `🎬 *Starting video generation with Kling 3.0...*\n\nThis takes 1-3 minutes. I'll send it when ready!\n_"${prompt.substring(0, 150)}"_`
        );
        const kieKey = process.env.KIE_API_KEY;
        // Use Kling 3.0 via the unified Jobs API
        const vidRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
          body: JSON.stringify({ 
            model: 'kling-3.0/video',
            input: {
              prompt, 
              duration: '5',
              aspect_ratio: '16:9',
              mode: 'std',
              sound: false,
              multi_shots: false,
              multi_prompt: [],
              kling_elements: [],
            }
          }),
        });
        const vidData = await vidRes.json();
        console.log('Telegram video intent Kie.ai response:', JSON.stringify(vidData).substring(0, 500));
        if (vidData.code !== 200) throw new Error(vidData.msg || vidData.error || 'Video generation failed');
        const taskId = vidData.data?.taskId;
        // Poll for completion using the Jobs API status endpoint
        let attempts = 0;
        while (attempts < 30) {
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
            // Send the actual video file to Telegram
            await sendTelegramVideo(chatId, TELEGRAM_BOT_TOKEN, videoUrl,
              `🎬 *Your video is ready!*\n_"${prompt.substring(0, 150)}"_`
            );
            break;
          } else if (state === 'failed' || state === 'fail') {
            const errMsg = pollData.data?.error || 'Unknown error';
            await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Video generation failed: ${errMsg}`);
            break;
          }
          if (attempts % 6 === 0) await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `⏳ Still generating... (~${Math.round(attempts * 10 / 60)} min)`);
        }
        return ok({ ok: true });

      } else if (socialMatch) {
        // Detect platform from the message
        const platformMap = { tweet: 'twitter', twitter: 'twitter', instagram: 'instagram', linkedin: 'linkedin', tiktok: 'tiktok', facebook: 'facebook', threads: 'threads', youtube: 'youtube' };
        let detectedPlatform = 'twitter';
        for (const [key, val] of Object.entries(platformMap)) {
          if (lowerText.includes(key)) { detectedPlatform = val; break; }
        }
        // Extract topic
        const topic = sanitizedText.replace(/\b(write|create|generate|make|draft)\s+(me\s+)?a?\s*(tweet|twitter|instagram|linkedin|tiktok|facebook|threads|youtube)?\s*(post|caption|content)?\s*(about|for|on)?\s*/i, '').trim() || sanitizedText;
        const profile = await db.collection('profiles').findOne({ user_id: userId });
        const userContext = profile ? `${profile.display_name || ''}, ${profile.descriptors?.join(', ') || ''}` : '';

        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `✍️ Creating ${SOCIAL_PLATFORMS[detectedPlatform].name} post about *"${topic.substring(0, 100)}"*...\n🌐 Fetching real-time data...`
        );

        const { post, platform: platformName, maxChars } = await generateSocialPost({
          platform: detectedPlatform, topic, userContext, model: preferredModel, includeSearch: true,
        });
        await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
          `📱 *${platformName} Post* (${post.length}/${maxChars} chars)\n\n${post}`
        );
        return ok({ ok: true });
      }
    } catch (autoErr) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `❌ Generation failed: ${autoErr.message}`);
      return ok({ ok: true });
    }
  }

  try {
    // Get or create a Telegram conversation for this user
    let conv = await db.collection('conversations').findOne({ user_id: userId, source: 'telegram' });
    if (!conv) {
      const convId = uuidv4();
      conv = { id: convId, user_id: userId, title: 'Telegram Chat', source: 'telegram', created_at: new Date(), updated_at: new Date() };
      await db.collection('conversations').insertOne(conv);
    }

    // Save user message (store sanitized version for LLM, original for display)
    const userMsgId = uuidv4();
    await db.collection('messages').insertOne({
      id: userMsgId, conversation_id: conv.id, user_id: userId,
      role: 'user', content: text, created_at: new Date(), source: 'telegram',
    });

    // Get history (token-aware trimming — best practice)
    const recent = await db.collection('messages')
      .find({ conversation_id: conv.id, id: { $ne: userMsgId } })
      .sort({ created_at: -1 }).limit(30).toArray();
    recent.reverse();
    const rawHistory = recent.map(m => ({ role: m.role, content: m.content }));
    const trimmedHistory = trimHistory(rawHistory, 4000);
    let historyMessages = [...trimmedHistory, { role: 'user', content: sanitizedText }];

    // Use cached system prompt (best practice)
    const systemPrompt = await getSystemPrompt(db, userId);

    // ── URL Content Extraction ────────────────────────────────────────────────
    // Detect URLs in the message and extract their content
    const urls = extractUrls(text);
    let urlContext = '';
    if (urls.length > 0) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, `🔗 Reading ${urls.length > 1 ? `${urls.length} links` : 'link'}...`);
      const urlContents = [];
      for (const url of urls.slice(0, 3)) { // Max 3 URLs
        const extracted = await extractUrlContent(url);
        if (extracted.success) {
          urlContents.push(`**[${extracted.title || url}](${url})**\n${extracted.description ? `_${extracted.description}_\n\n` : ''}${extracted.content}`);
        } else {
          urlContents.push(`**[${url}](${url})**\nCould not extract content: ${extracted.error}`);
        }
      }
      if (urlContents.length > 0) {
        urlContext = `\n\n---\n**WEBPAGE CONTENT FROM USER'S LINKS:**\n\n${urlContents.join('\n\n---\n\n')}\n---\n\n`;
      }
    }

    // ── Real-time web search ────────────────────────────────────────────────
    // Perplexity sonar models have built-in search — no need to inject
    const isPerplexity = preferredProvider === 'perplexity' || preferredModel.startsWith('sonar');
    let searchNote = '';
    if (!isPerplexity) {
      // For Telegram, always try web search for better real-time responses
      // Skip only for clearly personal/conversational queries
      const skipSearch = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|great|good|bye|goodbye|how are you)/i.test(text.trim());
      const needsSearch = !skipSearch && text.length > 10; // Search for anything substantive
      
      if (needsSearch) {
        try {
          const { buildSearchContext: doSearch } = await import('@/lib/llm/providers');
          const ctx = await doSearch(text);
          if (ctx) {
            searchNote = ' 🌐';
            historyMessages = [
              ...historyMessages.slice(0, -1),
              { role: 'user', content: `${ctx}\n\n---\n\nUser question: ${text}` },
            ];
          }
        } catch (searchErr) {
          console.log('Web search failed, continuing without:', searchErr.message);
        }
      }
    }

    // ── Inject URL content into the message ───────────────────────────────────
    if (urlContext) {
      historyMessages = [
        ...historyMessages.slice(0, -1),
        { role: 'user', content: `${urlContext}User message: ${historyMessages[historyMessages.length - 1].content}` },
      ];
    }

    // ── Sanitize message history for LLM providers ───────────────────────────
    // CRITICAL: Gemini requires first message to be 'user' and alternating roles
    // This prevents "First content should be with role 'user', got model" errors
    historyMessages = ensureAlternatingMessages(historyMessages);
    
    // Safety: ensure we always have at least one user message
    if (historyMessages.length === 0 || historyMessages[historyMessages.length - 1].role !== 'user') {
      historyMessages.push({ role: 'user', content: sanitizedText });
    }
    
    console.log(`[Telegram] Sending ${historyMessages.length} messages to ${preferredProvider}/${preferredModel}. First role: ${historyMessages[0]?.role}, Last role: ${historyMessages[historyMessages.length - 1]?.role}`);

    // ── Generate response ───────────────────────────────────────────────────
    const { getProvider: gp } = await import('@/lib/llm/providers');
    const provider = gp(preferredProvider, preferredModel);

    // Define tools for Google access and memory
    const googleTools = [
      {
        type: 'function',
        function: {
          name: 'get_emails',
          description: 'Get emails from user\'s connected Gmail account',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query like "from:john" or "is:unread"' },
              limit: { type: 'number', description: 'Number of emails to return' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_calendar',
          description: 'Get calendar events from user\'s connected Google Calendar',
          parameters: {
            type: 'object',
            properties: {
              time_min: { type: 'string', description: 'Start date in ISO format' },
              time_max: { type: 'string', description: 'End date in ISO format' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_memories',
          description: 'Get stored memories and facts about the user',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_soulprint',
          description: 'Get user\'s SoulPrint profile including interests, communication style, personality',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];
    
    // Tool execution handler for Telegram
    const handleTelegramToolCall = async (toolName, args) => {
      console.log(`[Telegram Tool] Executing ${toolName}:`, args);
      
      switch (toolName) {
        case 'get_emails':
        case 'check_email': {
          console.log('[Telegram Tool] get_emails called for user:', userId);
          const tgGoogleConnections = await getAllGoogleConnections(userId);
          if (!tgGoogleConnections.length) return { error: 'No Google account connected. Connect one on the web app in Settings → Integrations.' };
          const account = tgGoogleConnections[0];
          try {
            const token = await getValidGoogleToken(userId, account.email);
            if (!token) return { error: 'Google token expired. Please reconnect in the web app.' };
            const q = encodeURIComponent(args.query || 'is:inbox');
            const listRes = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${args.limit || 5}&q=${q}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const listData = await listRes.json();
            const emails = [];
            for (const msg of (listData.messages || []).slice(0, 5)) {
              const detailRes = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const detail = await detailRes.json();
              const headers = detail.payload?.headers || [];
              emails.push({
                subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
                from: headers.find(h => h.name === 'From')?.value || 'Unknown',
                snippet: detail.snippet?.slice(0, 100),
              });
            }
            return { emails, account: account.email };
          } catch (e) {
            return { error: 'Failed to fetch emails: ' + e.message };
          }
        }
        
        case 'get_calendar':
        case 'check_calendar': {
          console.log('[Telegram Tool] get_calendar called for user:', userId);
          const tgCalGoogleConnections = await getAllGoogleConnections(userId);
          if (!tgCalGoogleConnections.length) return { error: 'No Google account connected. Connect one on the web app in Settings → Integrations.' };
          const calAccount = tgCalGoogleConnections[0];
          try {
            const token = await getValidGoogleToken(userId, calAccount.email);
            if (!token) return { error: 'Google token expired. Please reconnect in the web app.' };
            const now = new Date();
            const timeMin = encodeURIComponent(args.time_min || now.toISOString());
            const timeMax = encodeURIComponent(args.time_max || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
            const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=10&singleEvents=true&orderBy=startTime`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const calData = await calRes.json();
            const events = (calData.items || []).map(e => ({
              title: e.summary,
              start: e.start?.dateTime || e.start?.date,
              end: e.end?.dateTime || e.end?.date,
              location: e.location,
            }));
            return { events, account: calAccount.email };
          } catch (e) {
            return { error: 'Failed to fetch calendar: ' + e.message };
          }
        }
        
        case 'get_user_memories':
        case 'recall_memory': {
          const memories = await db.collection('user_memories').find({ user_id: userId }).sort({ created_at: -1 }).limit(15).toArray();
          if (!memories.length) return { message: 'No memories stored yet' };
          const grouped = {};
          for (const mem of memories) {
            const cat = mem.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(mem.content);
          }
          return { memories: grouped, total: memories.length };
        }
        
        case 'get_soulprint':
        case 'who_am_i': {
          const profile = await db.collection('profiles').findOne({ user_id: userId });
          const soulProfile = await db.collection('soul_profiles').findOne({ user_id: userId });
          return {
            name: profile?.display_name,
            descriptors: profile?.descriptors,
            interests: soulProfile?.insights?.interests,
            communication_style: soulProfile?.insights?.communicationStyle,
            summary: soulProfile?.insights?.latestSummary,
          };
        }
        
        default:
          return { error: 'Unknown tool' };
      }
    };

    let aiResponse;
    let sources = [];
    try {
      // Use streaming with custom tools for OpenAI (works best for tool calling)
      const { stream, searchMeta, didSearch, customToolResults } = await provider.generateStream({
        systemPrompt, messages: historyMessages, model: preferredModel,
        temperature: 0.7, enableWebSearch: true,
        customTools: preferredProvider === 'openai' ? googleTools : [],
        onToolCall: handleTelegramToolCall,
      });
      
      // Extract sources from searchMeta
      if (didSearch && searchMeta && searchMeta.length > 0) {
        searchMeta.forEach(search => {
          if (search.results && Array.isArray(search.results)) {
            search.results.forEach(result => {
              if (result.url && !sources.find(s => s.url === result.url)) {
                sources.push({
                  title: result.title || 'Source',
                  url: result.url,
                });
              }
            });
          }
        });
      }
      
      let collected = '';
      for await (const chunk of stream) {
        // Handle both string and object chunks
        if (typeof chunk === 'string') {
          collected += chunk;
        } else if (chunk && chunk.delta) {
          collected += chunk.delta;
          // Extract Perplexity citations
          if (chunk.citations && chunk.citations.length > 0) {
            sources = chunk.citations;
          }
        }
        // Keep sending typing action for long responses
        if (collected.length % 1000 === 0) {
          fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
          }).catch(() => {});
        }
      }
      aiResponse = collected;
    } catch (streamErr) {
      // Fallback to non-streaming if generateStream fails
      aiResponse = await provider.generateChatCompletion({
        systemPrompt, messages: historyMessages, model: preferredModel, temperature: 0.7,
      });
    }

    // Save assistant message
    await db.collection('messages').insertOne({
      id: uuidv4(), conversation_id: conv.id, user_id: userId,
      role: 'assistant', content: aiResponse, created_at: new Date(), source: 'telegram',
      model_used: preferredModel, provider_used: preferredProvider,
      sources: sources.length > 0 ? sources : undefined,
    });
    await db.collection('conversations').updateOne({ id: conv.id }, { $set: { updated_at: new Date() } });

    // Build sources section for Telegram
    let sourcesText = '';
    if (sources.length > 0) {
      sourcesText = '\n\n📚 *Sources:*\n' + sources.slice(0, 4).map((s, i) => 
        `${i + 1}. [${s.title}](${s.url})`
      ).join('\n');
    }

    // Send reply (split if > 4096 chars) with model indicator
    const smartLabel = smartModeInfo ? ` 🧠 ${smartModeInfo.reason.substring(0, 50)}` : '';
    const modelLabel = `_[${preferredModel}${searchNote}${smartLabel}]_\n\n`;
    const fullReply = modelLabel + aiResponse + sourcesText;
    const chunks = fullReply.match(/[\s\S]{1,4000}/g) || [fullReply];
    for (const chunk of chunks) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, chunk);
    }
  } catch (e) {
    console.error('Telegram handler error:', e);
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Something went wrong. Please try again.');
  }

  return ok({ ok: true });
}


async function handleTelegramLink(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { link_code } = body;
  if (!link_code) return err('link_code required');

  const db = await getDb();

  // Find mapping by code
  const mapping = await db.collection('telegram_mappings').findOne({ link_code: link_code.toUpperCase() });
  if (!mapping) return err('Invalid link code. Send /start to the bot to get a new one.', 404);

  // Check expiry
  if (mapping.expires_at && new Date() > new Date(mapping.expires_at)) {
    return err('This link code has expired. Send /start to the bot to get a new one.', 410);
  }

  // Prevent one Telegram account from linking to multiple SoulPrint users
  const alreadyLinked = await db.collection('telegram_mappings').findOne({
    telegram_user_id: mapping.telegram_user_id,
    linked: true,
    user_id: { $exists: true },
  });
  if (alreadyLinked && alreadyLinked.user_id !== user.id) {
    return err('This Telegram account is already linked to a different SoulPrint account.', 409);
  }

  // Prevent one SoulPrint user from linking multiple Telegram accounts
  const userAlreadyLinked = await db.collection('telegram_mappings').findOne({
    user_id: user.id,
    linked: true,
  });
  if (userAlreadyLinked) {
    return err('Your account is already linked to a Telegram account.', 409);
  }

  await db.collection('telegram_mappings').updateOne(
    { link_code: link_code.toUpperCase() },
    { $set: { user_id: user.id, linked: true, linked_at: new Date(), expires_at: null } }
  );

  // Notify via Telegram
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (TELEGRAM_BOT_TOKEN && mapping.telegram_chat_id) {
    const profile = await db.collection('profiles').findOne({ user_id: user.id });
    const botName = profile?.assistant_name || 'SoulPrint';
    const displayName = profile?.display_name || 'there';
    await sendTelegramMessage(mapping.telegram_chat_id, TELEGRAM_BOT_TOKEN,
      `✅ Linked! Hey ${displayName}, ${botName} is ready.\n\nYour conversations here are private — only you can see them. Just send a message anytime.`
    );
  }

  return ok({ success: true, message: 'Telegram linked successfully! Check your bot for a confirmation.' });
}


async function handleTelegramSetup(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) return ok({ configured: false, message: 'Add TELEGRAM_BOT_TOKEN to .env to enable Telegram.' });

  const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
  // Use permanent domain for webhook so it doesn't change between deployments
  const PERMANENT_DOMAIN = 'https://soulprintengine.ai';
  const webhookUrl = `${PERMANENT_DOMAIN}/api/telegram/webhook`;

  // Set the webhook with optional secret
  const payload = { url: webhookUrl, drop_pending_updates: true, allowed_updates: ['message', 'edited_message'] };
  if (TELEGRAM_WEBHOOK_SECRET) payload.secret_token = TELEGRAM_WEBHOOK_SECRET;

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  // Get bot info
  const infoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
  const info = await infoRes.json();

  // Count linked users
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


async function handleTelegramStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const db = await getDb();
  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });

  return ok({
    configured: !!TELEGRAM_BOT_TOKEN,
    linked: !!mapping,
    telegram_user_id: mapping?.telegram_user_id || null,
    preferred_model: mapping?.preferred_model || 'gpt-4o',
    preferred_provider: mapping?.preferred_provider || 'openai',
  });
}


async function handleTelegramSetModel(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { model } = await request.json();
  if (!model) return err('model required');

  // Handle Dynamic Intelligence specially
  if (model === 'smart') {
    const db = await getDb();
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

  const db = await getDb();
  const result = await db.collection('telegram_mappings').updateOne(
    { user_id: user.id, linked: true },
    { $set: { preferred_model: found.value, preferred_provider: found.provider } }
  );

  if (result.matchedCount === 0) return err('No linked Telegram account found');
  return ok({ success: true, model: found.value, label: found.label });
}



// ============================================================
// ROUTER
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');
  
  try {
    if (pathStr === 'status') return handleTelegramStatus(request);
    if (pathStr === 'setup') return handleTelegramSetup(request);
    
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
    if (pathStr === 'set-model' || pathStr === 'model') return handleTelegramSetModel(request);
    if (pathStr === 'unlink') {
      const user = await authenticate(request);
      if (!user) return err('Unauthorized', 401);
      const db = await getDb();
      await db.collection('telegram_mappings').updateMany(
        { user_id: user.id },
        { $set: { linked: false, user_id: null } }
      );
      return ok({ success: true });
    }
    
    return err('Telegram endpoint not found', 404);
  } catch (error) {
    console.error('[Telegram API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');
  
  try {
    if (pathStr === 'unlink') {
      const user = await authenticate(request);
      if (!user) return err('Unauthorized', 401);
      const db = await getDb();
      await db.collection('telegram_mappings').updateMany(
        { user_id: user.id },
        { $set: { linked: false, user_id: null } }
      );
      return ok({ success: true });
    }
    
    return err('Telegram endpoint not found', 404);
  } catch (error) {
    console.error('[Telegram API] DELETE Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function PUT(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');
  
  try {
    if (pathStr === 'set-model' || pathStr === 'model') return handleTelegramSetModel(request);
    
    return err('Telegram endpoint not found', 404);
  } catch (error) {
    console.error('[Telegram API] PUT Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
