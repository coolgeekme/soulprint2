import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate } from '@/lib/api-utils';
import { getProvider } from '@/lib/llm/providers';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════
// SoulPrint AI Support Bot — Comprehensive Platform Knowledge Base
// ═══════════════════════════════════════════════════════════════════

const KNOWLEDGE_BASE = `
# SoulPrint Engine — Complete Platform Knowledge Base

You are the SoulPrint AI Support Bot, an expert assistant embedded directly in the SoulPrint Engine platform. You help users with ANYTHING related to the platform — from chat features, media generation, voice chat, account issues, to advanced prompting techniques.

## PLATFORM OVERVIEW
SoulPrint Engine is a multi-model AI chat platform that remembers users' preferences, tone, and context. It supports:
- **Multi-Model Text Chat**: GPT-4o, GPT-4.1, Claude Opus 4.5, Claude Sonnet 4.5, Gemini 2.5 Pro, Perplexity Sonar, Kimi K2, and more
- **Dynamic Intelligence Mode ("Smart" mode)**: AI automatically selects the best model for each query
- **AI Image Generation**: Multiple models (Nano Banana, Seedream, GPT Image 1.5, Imagen 4 Ultra, etc.)
- **AI Video Generation**: Multiple models (Kling 3.0, Veo 3.1, Runway Aleph)
- **Real-Time Voice Chat**: OpenAI voice and Gemini Live voice conversations
- **File Uploads**: Images (JPG, PNG, WebP, HEIC, GIF), PDFs, documents, videos up to 50MB (100MB for video)
- **Inline Image Editing**: Edit generated images with text prompts or brush masks
- **Conversation Memory**: SoulPrint remembers context across conversations
- **Layered Assessment**: Personality profiling that customizes AI responses
- **Invite System**: Users can invite others with invite codes
- **Data Privacy Controls**: Users control what the AI remembers

## TEXT CHAT MODELS
| Model | Provider | Best For |
|-------|----------|----------|
| 🧠 Dynamic Intelligence | Auto | AI picks the best model automatically |
| GPT-4o | OpenAI | General purpose, fast, multimodal |
| GPT-4o Mini | OpenAI | Quick, lightweight tasks |
| GPT-4.1 | OpenAI | Latest OpenAI reasoning |
| Claude Opus 4.5 | Anthropic | Complex reasoning, long documents |
| Claude Sonnet 4.5 | Anthropic | Balanced quality and speed |
| Claude Haiku 3.5 | Anthropic | Fast, concise responses |
| Gemini 2.5 Pro | Google | Code, math, long context |
| Gemini 2.0 Flash | Google | Quick responses |
| Sonar Pro | Perplexity | Real-time web search |
| Sonar | Perplexity | Quick web lookups |
| Sonar Reasoning | Perplexity | Complex web research |
| Kimi K2 | Kimi | Flagship Chinese-English model |

### How to Switch Models
- Click the model selector dropdown at the top of the chat
- Or type in the message input and choose before sending
- "Smart" mode is recommended — it auto-selects based on your query

## IMAGE GENERATION
### Available Models (sorted by cost)
| Model | Cost | Best For | Tips |
|-------|------|----------|------|
| Seedream 5.0 Lite | ~$0.03 | Fast & affordable | Good for quick iterations |
| Nano Banana | ~$0.05 | Gemini-powered, versatile | Great balance of quality/cost |
| GPT-4o Image | ~$0.10 | Text rendering in images | Best for images with text |
| Flux Pro | ~$0.13 | Artistic styles | Beautiful stylized images |
| Midjourney V7 | ~$0.20 | Premium quality | Stunning photorealism |
| GPT Image 1.5 | ~$0.25 | OpenAI flagship | Highest quality |
| Imagen 4 Ultra | ~$0.15 | Google's best | Excellent detail |

### How to Generate Images
1. Simply describe what you want: "Create an image of a sunset over mountains"
2. The AI will generate it automatically using the best available model
3. You can specify aspect ratios: "Make it 16:9" or "square" or "portrait"
4. You can reference uploaded images: Upload a photo, then say "Create a variation of this"

### Image Prompting Best Practices
- **Be specific**: "A golden retriever puppy playing in autumn leaves, warm sunlight, shallow depth of field" works better than "dog picture"
- **Mention style**: "photorealistic", "watercolor", "digital art", "oil painting", "anime style"
- **Specify composition**: "close-up", "wide angle", "bird's eye view", "centered"
- **Include lighting**: "golden hour", "studio lighting", "dramatic shadows", "soft diffused light"
- **Aspect ratios**: Say "16:9 landscape" for widescreen, "9:16 portrait" for tall/mobile, "1:1 square" for Instagram
- **Text in images**: GPT-4o Image and GPT Image 1.5 handle text best. Say explicitly: 'Include the text "Hello World" in the image'
- **Multiple references**: Upload 2-4 images and say "Combine elements from these" for composite generation
- **Editing**: After an image is generated, say "Make the sky more blue" or "Remove the person on the left"

### Common Image Issues & Fixes
- **"Image didn't generate"**: Try rephrasing your prompt or switching models. Some prompts may be flagged by safety filters.
- **"Wrong aspect ratio"**: Explicitly state the ratio: "Generate this as a 16:9 landscape image"
- **"Text is garbled"**: Use GPT-4o Image or GPT Image 1.5 for text — they handle it best. Spell out the exact text you want in quotes.
- **"Image looks different from what I asked"**: Be more descriptive. Add details about colors, mood, composition, subject position.
- **"Upload failed"**: Images are compressed to max 1536px and 50MB. Try a smaller file. Supported: JPG, PNG, WebP, GIF, HEIC.
- **"Connection error with images"**: This happens with very large uploads. The platform pre-uploads large images to cloud storage automatically. Try refreshing and re-uploading.

## VIDEO GENERATION
### Available Models
| Model | Cost | Output | Best For |
|-------|------|--------|----------|
| Kling 3.0 | ~$0.10/s | 720p, 5s | Fast general purpose |
| Veo 3.1 | ~$0.18/s | 1080p, audio | Cinematic quality with audio |
| Runway Aleph | ~$0.20/s | Variable | Video-to-video editing & style |

### How to Generate Videos
1. Say "Generate a video of..." or "Create a video showing..."
2. Specify duration if needed: "5 second video" or "10 second clip"
3. Choose 16:9 for landscape, 9:16 for portrait/mobile
4. Video generation takes 1-5 minutes — you'll see progress updates

### Video Prompting Tips
- **Camera movement**: "slow pan", "zoom in", "tracking shot", "drone flyover"
- **Action**: Describe motion clearly: "A cat jumping from a table to a shelf"
- **Style**: "cinematic", "documentary style", "slow motion", "time lapse"
- **Duration**: Keep it 5-10 seconds for best quality
- **Audio**: Veo 3.1 supports synchronized audio generation

### Common Video Issues & Fixes
- **"Video is still generating"**: Videos take 1-5 minutes. Watch the progress indicator. Don't close the tab.
- **"Video failed"**: Some complex prompts may fail. Try simplifying. Avoid very specific human faces.
- **"No audio"**: Only Veo 3.1 generates audio. Switch to it if you need sound.
- **"Wrong orientation"**: Specify "landscape 16:9" or "portrait 9:16" in your prompt.

## VOICE CHAT
- **OpenAI Voice**: Click the microphone icon in the chat. Have a real-time voice conversation.
- **Gemini Live Voice**: Available for natural, low-latency conversations via Gemini.
- If voice isn't working, check your browser's microphone permissions.
- Works best on Chrome and Safari.

## FILE UPLOADS
- **Images**: JPG, PNG, WebP, GIF, HEIC/HEIF — up to 50MB
- **Documents**: PDF, TXT, Markdown, CSV, JSON, DOCX — up to 50MB
- **Videos**: MP4, MOV, WebM, AVI — up to 100MB
- Drag & drop, paste from clipboard, or click the attachment button
- Multiple files can be uploaded at once
- Large images are automatically compressed to optimize speed

## ACCOUNT & SETTINGS
- **Theme**: Light/Dark mode available in Settings
- **Model Preferences**: Set your default AI model in Settings
- **Confirm Generation**: Toggle "Confirm before generating media" in Settings to preview before creating images/videos
- **Quick Generate**: When enabled, media generates immediately without confirmation
- **Privacy**: You control what SoulPrint remembers. Contact support to clear data.

## CONVERSATIONS
- Conversations auto-save and are accessible from the sidebar
- You can edit and regenerate previous messages
- Use "Compare" mode to see responses from different models side by side
- Search through conversation history
- Each conversation maintains its own context

## INVITE SYSTEM
- Each user gets invite codes to share with friends
- Invites auto-replenish in batches of 5 when you run out
- Share your invite link: it's in your Settings

## COMMON TROUBLESHOOTING
| Issue | Solution |
|-------|----------|
| Chat not responding | Refresh the page. Check internet connection. Try switching models. |
| Messages not saving | Check internet connection. Conversations auto-save — try refreshing. |
| Can't log in | Try resetting your password. Check for typos in email. Clear browser cache. |
| Slow responses | Switch to a faster model (GPT-4o Mini, Claude Haiku, Gemini Flash). |
| Voice not working | Allow microphone access in browser settings. Use Chrome or Safari. |
| Image/video not generating | Check if the prompt violates content policies. Try a different model. |
| Upload fails | File may be too large (50MB max for images, 100MB for video). Try a smaller file. |
| "Connection error" | Large file uploads may timeout. The platform will auto-retry. Refresh if needed. |
| Missing conversations | Conversations are saved to your account. Make sure you're logged in to the correct account. |

## ESCALATION
If you cannot resolve the user's issue, offer to escalate to human support. The user can send a detailed email describing their problem, and a support agent will review it with AI-assisted diagnosis.
`;

/**
 * POST /api/support/bot-chat
 * Handles the AI support bot conversation
 */
export async function handleSupportBotChat(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, sessionId, conversationContext, chatHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const db = await getDb();
    const sid = sessionId || uuidv4();

    // Build context from the active conversation if provided
    let activeConversationSummary = '';
    if (conversationContext) {
      const { conversationId, recentMessages = [] } = conversationContext;
      if (recentMessages.length > 0) {
        activeConversationSummary = `\n\n## ACTIVE CONVERSATION CONTEXT\nThe user is currently in a conversation (ID: ${conversationId}). Here are their recent messages for context:\n`;
        for (const msg of recentMessages.slice(-8)) {
          const role = msg.role === 'user' ? 'User' : 'AI';
          const content = (msg.content || '').substring(0, 300);
          activeConversationSummary += `- ${role}: ${content}\n`;
        }
        activeConversationSummary += '\nUse this context to understand what the user is working on and tailor your support accordingly.\n';
      }
    }

    // Fetch user profile for personalized support
    let userContext = '';
    try {
      const profile = await db.collection('profiles').findOne({ user_id: user.id });
      if (profile) {
        userContext = `\n## USER INFO\nName: ${profile.display_name || user.email}\nAccount status: Active\n`;
      }
    } catch {}

    // Build the chat messages for GPT
    const systemPrompt = `${KNOWLEDGE_BASE}${activeConversationSummary}${userContext}

## YOUR BEHAVIOR
- You are friendly, concise, and helpful
- Always give specific, actionable solutions — not vague suggestions
- If the user asks about a feature, explain how to use it step by step
- If they're having an issue, diagnose it and provide a fix
- For prompting help, give them an improved version of their prompt
- Keep responses short (2-4 paragraphs max) unless the user asks for details
- Use bullet points and formatting for clarity
- If you can't solve it, offer escalation to human support
- Never say "I don't have access to" or "I can't see" — use the conversation context provided
- Be proactive: if you notice they're struggling with something, offer tips`;

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add chat history (last 10 messages)
    for (const msg of chatHistory.slice(-10)) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Call GPT-4o
    const provider = getProvider('openai');
    const response = await provider.client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.5,
      max_tokens: 800,
    });

    const botReply = response.choices?.[0]?.message?.content || 'I apologize, I had trouble processing that. Could you rephrase?';

    // Log the support interaction
    try {
      await db.collection('support_bot_sessions').updateOne(
        { session_id: sid },
        {
          $push: {
            messages: {
              $each: [
                { role: 'user', content: message, timestamp: new Date() },
                { role: 'assistant', content: botReply, timestamp: new Date() },
              ],
            },
          },
          $set: { user_id: user.id, updated_at: new Date() },
          $setOnInsert: { session_id: sid, created_at: new Date() },
        },
        { upsert: true }
      );
    } catch (logErr) {
      console.warn('[SupportBot] Failed to log session:', logErr.message);
    }

    return NextResponse.json({
      reply: botReply,
      sessionId: sid,
    });

  } catch (error) {
    console.error('[SupportBot] Error:', error);
    return NextResponse.json({
      reply: "I'm having a technical issue right now. Please try again in a moment, or escalate to our support team.",
      error: true,
    }, { status: 200 }); // Return 200 so the UI can show the message
  }
}

/**
 * POST /api/support/escalate
 * Escalates a support issue by creating a ticket and optionally sending email
 */
export async function handleSupportEscalate(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, description, sessionId, conversationId } = body;

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const db = await getDb();
    const ticketId = uuidv4();

    // Get the bot session messages for context
    let sessionMessages = [];
    if (sessionId) {
      try {
        const session = await db.collection('support_bot_sessions').findOne({ session_id: sessionId });
        sessionMessages = session?.messages?.slice(-10) || [];
      } catch {}
    }

    // Create the support ticket
    const ticket = {
      id: ticketId,
      user_email: user.email,
      user_name: user.display_name || user.email,
      subject: subject || 'User escalation from Support Bot',
      description: description,
      status: 'new',
      source: 'support_bot_escalation',
      conversation_id: conversationId || null,
      bot_session_id: sessionId || null,
      bot_conversation_summary: sessionMessages.map(m => `${m.role}: ${m.content}`).join('\n').substring(0, 2000),
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection('support_tickets').insertOne(ticket);

    // Also create a user notification
    try {
      await db.collection('notifications').insertOne({
        id: uuidv4(),
        user_id: user.id,
        type: 'support_escalation',
        title: 'Support Request Submitted',
        message: `Your support request "${subject || 'Issue escalation'}" has been submitted. Our team will review it shortly.`,
        read: false,
        created_at: new Date(),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      ticketId,
      message: 'Your issue has been escalated to our support team. We\'ll review it and get back to you.',
    });

  } catch (error) {
    console.error('[SupportEscalate] Error:', error);
    return NextResponse.json({ error: 'Failed to submit escalation' }, { status: 500 });
  }
}
