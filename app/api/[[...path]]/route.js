import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { generateToken, verifyToken, hashPassword, comparePassword, getTokenFromRequest } from '@/lib/auth';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import path from 'path';
import fs from 'fs';
import { writeFile, mkdir } from 'fs/promises';

// ============================================================
// HELPERS
// ============================================================

async function authenticate(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  const db = await getDb();
  const user = await db.collection('users').findOne({ id: decoded.userId });
  if (user) {
    await db.collection('users').updateOne(
      { id: decoded.userId },
      { $set: { last_active_at: new Date() } }
    );
  }
  return user;
}

async function requireAdmin(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) return null;
  return user;
}

function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}
function err(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// Build system prompt for chat
async function buildSystemPrompt(db, userId) {
  const user = await db.collection('users').findOne({ id: userId });
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  const answers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .sort({ created_at: 1 })
    .toArray();

  const assistantName = profile?.assistant_name || 'SoulPrint';
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const descriptors = profile?.descriptors || [];
  const field = profile?.field || '';
  const helpWith = profile?.help_with || [];
  const soulSummary = profile?.soul_profile_summary || '';

  let assessmentContext = '';
  if (answers.length > 0) {
    const questionIds = answers.map(a => a.question_id);
    const questions = await db.collection('assessment_questions')
      .find({ id: { $in: questionIds } })
      .toArray();
    const qMap = Object.fromEntries(questions.map(q => [q.id, q]));
    const answersText = answers.map(a => {
      const q = qMap[a.question_id];
      return q ? `Q (${q.pillar}): ${q.question_text}\nA: ${a.answer_text}` : '';
    }).filter(Boolean).slice(0, 10).join('\n\n');
    assessmentContext = `\n\nASSESSMENT INSIGHTS:\n${answersText}`;
  }

  return `You are ${assistantName}, a personal AI companion for ${displayName}.

USER PROFILE:
- Name: ${displayName}
- Role: ${descriptors.join(', ') || 'Not specified'}
- Field: ${field || 'Not specified'}
- Needs help with: ${helpWith.join(', ') || 'General assistance'}
${assessmentContext}
${soulSummary ? `\nSOUL PROFILE (from personal data):\n${soulSummary}` : ''}

INSTRUCTIONS:
- You are ${displayName}'s personal AI — think of yourself as their intelligent best friend
- Address them by name occasionally and naturally
- Adapt your tone to match their professional background and communication style
- Be direct, insightful, and genuinely helpful
- Remember the context of our conversation
- Keep responses concise unless depth is needed
- Never mention you are an AI unless explicitly asked`;
}

// Ensure uploads directory exists
const UPLOADS_DIR = '/tmp/soulprint_uploads';
async function ensureUploadsDir() {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
  } catch {}
}

// ============================================================
// SEED DATA - 36 QUESTIONS
// ============================================================
const SEED_QUESTIONS = [
  // COMMUNICATION (6)
  { pillar: 'communication', order_index: 1, question_text: 'When you need to share something important with someone, do you prefer to write it out or talk face-to-face?' },
  { pillar: 'communication', order_index: 2, question_text: 'How do you typically respond when someone misunderstands you?' },
  { pillar: 'communication', order_index: 3, question_text: 'Describe how you usually explain a complex idea to someone who is hearing it for the first time.' },
  { pillar: 'communication', order_index: 4, question_text: 'When giving feedback, how direct are you — and why?' },
  { pillar: 'communication', order_index: 5, question_text: 'How do you prefer to receive important news or updates from people you work with?' },
  { pillar: 'communication', order_index: 6, question_text: 'In a group discussion, how do you tend to contribute — and how do you feel when others dominate the conversation?' },
  // EMOTIONAL INTELLIGENCE (6)
  { pillar: 'emotional_intelligence', order_index: 7, question_text: 'When you feel overwhelmed, what is your first instinct — and does it actually help?' },
  { pillar: 'emotional_intelligence', order_index: 8, question_text: 'How do you typically process a major disappointment or setback?' },
  { pillar: 'emotional_intelligence', order_index: 9, question_text: 'Describe a time you had to manage your emotions in a high-stakes professional setting.' },
  { pillar: 'emotional_intelligence', order_index: 10, question_text: 'How do you generally respond when someone else is going through something difficult emotionally?' },
  { pillar: 'emotional_intelligence', order_index: 11, question_text: 'What does self-care actually look like for you — not what it should look like, but what you actually do?' },
  { pillar: 'emotional_intelligence', order_index: 12, question_text: 'How do you handle situations where you feel misunderstood or underestimated?' },
  // DECISION MAKING (6)
  { pillar: 'decision_making', order_index: 13, question_text: 'When faced with a major decision, walk me through your actual process — from the moment you realize a choice needs to be made.' },
  { pillar: 'decision_making', order_index: 14, question_text: 'How do you balance logic and gut feeling when making important choices?' },
  { pillar: 'decision_making', order_index: 15, question_text: 'Describe how you handle situations where there is no clearly right answer.' },
  { pillar: 'decision_making', order_index: 16, question_text: 'How do you respond internally and externally when you realize you made the wrong decision?' },
  { pillar: 'decision_making', order_index: 17, question_text: 'How much information do you need before you feel comfortable committing to a decision?' },
  { pillar: 'decision_making', order_index: 18, question_text: 'How do you approach decisions that significantly affect other people?' },
  // SOCIAL DYNAMICS (6)
  { pillar: 'social_dynamics', order_index: 19, question_text: 'How do you navigate a room full of people you do not know — what is your actual strategy?' },
  { pillar: 'social_dynamics', order_index: 20, question_text: 'What does trust mean to you in a relationship, and how do you know when you have it?' },
  { pillar: 'social_dynamics', order_index: 21, question_text: 'How do you handle conflict with someone you are close to?' },
  { pillar: 'social_dynamics', order_index: 22, question_text: 'What role do you typically play in a team — and is that the role you want to play?' },
  { pillar: 'social_dynamics', order_index: 23, question_text: 'How do you maintain long-term relationships when life gets busy?' },
  { pillar: 'social_dynamics', order_index: 24, question_text: 'How do you react — internally and externally — when someone breaks your trust?' },
  // COGNITIVE STYLE (6)
  { pillar: 'cognitive_style', order_index: 25, question_text: 'How do you organize your thoughts when facing a brand new challenge you have never dealt with before?' },
  { pillar: 'cognitive_style', order_index: 26, question_text: 'Do you prefer working with abstract concepts and big ideas, or concrete details and execution — and why?' },
  { pillar: 'cognitive_style', order_index: 27, question_text: 'How do you approach learning something entirely new and unfamiliar?' },
  { pillar: 'cognitive_style', order_index: 28, question_text: 'Describe your ideal environment for deep, focused work.' },
  { pillar: 'cognitive_style', order_index: 29, question_text: 'How do you know when you have truly understood something — not just memorized it?' },
  { pillar: 'cognitive_style', order_index: 30, question_text: 'How do you handle information overload when everything feels equally urgent?' },
  // ASSERTIVENESS (6)
  { pillar: 'assertiveness', order_index: 31, question_text: 'How comfortable are you with saying no — and what makes it easier or harder for you?' },
  { pillar: 'assertiveness', order_index: 32, question_text: 'Describe a situation where you had to stand your ground against strong opposition.' },
  { pillar: 'assertiveness', order_index: 33, question_text: 'How do you react when someone dismisses or minimizes your ideas?' },
  { pillar: 'assertiveness', order_index: 34, question_text: 'How do you ask for what you need — in relationships, at work, or in life generally?' },
  { pillar: 'assertiveness', order_index: 35, question_text: 'How do you handle situations where you know you are right but others strongly disagree?' },
  { pillar: 'assertiveness', order_index: 36, question_text: 'What does setting boundaries mean to you — and where do you struggle with it most?' },
];

// ============================================================
// ROUTE HANDLERS
// ============================================================

// AUTH - Register
async function handleRegister(request) {
  const body = await request.json();
  const { email, passcode, access_code } = body;
  if (!email || !passcode) return err('Email and passcode required');

  const db = await getDb();
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already registered');

  const userId = uuidv4();
  const hashed = await hashPassword(passcode);
  const now = new Date();

  // Check if this is first user -> make superadmin
  const count = await db.collection('users').countDocuments();
  const role = count === 0 ? 'superadmin' : 'user';

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role,
    accepted: role === 'superadmin',
    created_at: now,
    last_active_at: now,
    access_code_used: access_code || null,
  });

  // Create empty profile
  await db.collection('profiles').insertOne({
    user_id: userId,
    display_name: '',
    assistant_name: 'SoulPrint',
    descriptors: [],
    field: '',
    help_with: [],
    discovery_source: '',
    soul_profile_summary: '',
    onboarding_complete: false,
    assessment_complete: false,
    created_at: now,
  });

  const token = generateToken(userId);
  return ok({ token, userId, role, accepted: role === 'superadmin' });
}

// AUTH - Login
async function handleLogin(request) {
  const body = await request.json();
  const { email, passcode } = body;
  if (!email || !passcode) return err('Email and passcode required');

  const db = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return err('User not found', 404);  // distinct from wrong password

  const valid = await comparePassword(passcode, user.passcode_hash);
  if (!valid) return err('Invalid credentials', 401);

  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { last_active_at: new Date() } }
  );

  const token = generateToken(user.id);
  const profile = await db.collection('profiles').findOne({ user_id: user.id });

  return ok({
    token,
    userId: user.id,
    role: user.role,
    accepted: user.accepted,
    onboarding_complete: profile?.onboarding_complete || false,
    assessment_complete: profile?.assessment_complete || false,
  });
}

// AUTH - Me
async function handleMe(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const profile = await db.collection('profiles').findOne({ user_id: user.id });

  return ok({
    id: user.id,
    email: user.email,
    role: user.role,
    accepted: user.accepted,
    created_at: user.created_at,
    profile: profile ? {
      display_name: profile.display_name,
      assistant_name: profile.assistant_name,
      descriptors: profile.descriptors,
      field: profile.field,
      help_with: profile.help_with,
      discovery_source: profile.discovery_source,
      soul_profile_summary: profile.soul_profile_summary,
      onboarding_complete: profile.onboarding_complete,
      assessment_complete: profile.assessment_complete,
    } : null,
  });
}

// PROFILE - Update
async function handleProfileUpdate(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { display_name, descriptors, field, help_with, discovery_source, assistant_name, onboarding_complete } = body;

  const db = await getDb();
  const update = {};
  if (display_name !== undefined) update.display_name = display_name;
  if (descriptors !== undefined) update.descriptors = descriptors;
  if (field !== undefined) update.field = field;
  if (help_with !== undefined) update.help_with = help_with;
  if (discovery_source !== undefined) update.discovery_source = discovery_source;
  if (assistant_name !== undefined) update.assistant_name = assistant_name;
  if (onboarding_complete !== undefined) update.onboarding_complete = onboarding_complete;

  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: update },
    { upsert: true }
  );

  return ok({ success: true });
}

// ASSESSMENT - Get Questions
async function handleGetQuestions(request) {
  const db = await getDb();
  let questions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();

  if (questions.length === 0) {
    // Auto-seed questions
    await seedQuestions(db);
    questions = await db.collection('assessment_questions')
      .find({ active: true })
      .sort({ order_index: 1 })
      .toArray();
  }

  return ok(questions.map(q => ({
    id: q.id,
    pillar: q.pillar,
    order_index: q.order_index,
    question_text: q.question_text,
  })));
}

async function seedQuestions(db) {
  const existing = await db.collection('assessment_questions').countDocuments();
  if (existing > 0) return;
  const now = new Date();
  await db.collection('assessment_questions').insertMany(
    SEED_QUESTIONS.map(q => ({
      id: uuidv4(),
      ...q,
      active: true,
      created_at: now,
    }))
  );
}

// ASSESSMENT - Get Progress (answers for user)
async function handleGetProgress(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const answers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();

  return ok({ answered: answers.map(a => a.question_id), count: answers.length });
}

// ASSESSMENT - Submit Answer
async function handleSubmitAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { question_id, answer_text } = body;
  if (!question_id) return err('question_id required');

  const db = await getDb();

  // Upsert answer
  const existing = await db.collection('assessment_answers').findOne({
    user_id: user.id,
    question_id,
  });

  if (existing) {
    await db.collection('assessment_answers').updateOne(
      { user_id: user.id, question_id },
      { $set: { answer_text, updated_at: new Date() } }
    );
  } else {
    await db.collection('assessment_answers').insertOne({
      id: uuidv4(),
      user_id: user.id,
      question_id,
      answer_text: answer_text || '',
      created_at: new Date(),
    });
  }

  return ok({ success: true });
}

// ASSESSMENT - Complete (save bot name)
async function handleAssessmentComplete(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { assistant_name } = body;

  const db = await getDb();
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: { assistant_name: assistant_name || 'SoulPrint', assessment_complete: true } }
  );

  return ok({ success: true });
}

// CONVERSATIONS - Get all for user
async function handleGetConversations(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const conversations = await db.collection('conversations')
    .find({ user_id: user.id })
    .sort({ updated_at: -1 })
    .limit(50)
    .toArray();

  return ok(conversations.map(c => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    updated_at: c.updated_at,
  })));
}

// CONVERSATIONS - Create
async function handleCreateConversation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const db = await getDb();
  const now = new Date();

  const conv = {
    id: uuidv4(),
    user_id: user.id,
    title: body.title || 'New Conversation',
    created_at: now,
    updated_at: now,
  };

  await db.collection('conversations').insertOne(conv);
  return ok({ id: conv.id, title: conv.title, created_at: conv.created_at });
}

// MESSAGES - Get by conversationId
async function handleGetMessages(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) return err('conversationId required');

  const db = await getDb();
  // Verify conversation belongs to user
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

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
  })));
}

// CHAT STREAM - Streaming chat with web search + file vision
async function handleChatStream(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  if (!user.accepted && user.role === 'user') {
    return err('Account pending approval', 403);
  }

  const body = await request.json();
  const {
    conversationId, content, model = 'gpt-4o',
    provider: providerNameRaw = null,
    attachments = [],   // [{ type: 'image'|'document', base64: '...', mimeType: '...', name: '...', text: '...' }]
    enableWebSearch = true,
  } = body;
  // Derive provider from model info; fall back to openai
  const { getModelInfo } = await import('@/lib/llm/providers');
  const modelInfo = getModelInfo(model);
  const providerName = (providerNameRaw && providerNameRaw !== 'hosted') ? providerNameRaw : (modelInfo?.provider || 'openai');
  if (!content && attachments.length === 0) return err('content required');

  const db = await getDb();

  // Get or create conversation
  let convId = conversationId;
  let conv = conversationId
    ? await db.collection('conversations').findOne({ id: conversationId, user_id: user.id })
    : null;

  if (!conv) {
    convId = uuidv4();
    const now = new Date();
    const title = (content || 'File attachment').slice(0, 50) + ((content?.length > 50) ? '...' : '');
    await db.collection('conversations').insertOne({
      id: convId, user_id: user.id, title, created_at: now, updated_at: now,
    });
  }

  // Save user message (text only for storage)
  const userMsgId = uuidv4();
  const storedContent = content + (attachments.length > 0 ? ` [+${attachments.length} attachment(s)]` : '');
  await db.collection('messages').insertOne({
    id: userMsgId, conversation_id: convId, user_id: user.id,
    role: 'user', content: storedContent, created_at: new Date(), model_used: model,
  });

  // Get recent messages for context
  const recentMessages = await db.collection('messages')
    .find({ conversation_id: convId, id: { $ne: userMsgId } })
    .sort({ created_at: -1 }).limit(20).toArray();
  recentMessages.reverse();

  const historyMessages = recentMessages.map(m => ({ role: m.role, content: m.content }));

  // Build the current user message — support images (vision) + documents
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

  historyMessages.push({ role: 'user', content: userMessageContent });

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(db, user.id);
  const provider = getProvider(providerName, model);
  const assistantMsgId = uuidv4();
  let fullContent = '';

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'));

      try {
        // Send meta first
        send({ type: 'meta', conversationId: convId, messageId: assistantMsgId });

        const { stream: aiStream, searchMeta, didSearch } = await provider.generateStream({
          systemPrompt,
          messages: historyMessages,
          model,
          temperature: 0.7,
          enableWebSearch: enableWebSearch && attachments.length === 0, // disable search when analyzing files
        });

        // If search was done, notify client
        if (didSearch && searchMeta.length > 0) {
          send({ type: 'search', queries: searchMeta.map(s => s.query) });
        }

        for await (const chunk of aiStream) {
          // Providers yield plain strings
          if (chunk) {
            fullContent += chunk;
            send({ type: 'delta', content: chunk });
          }
        }

        // Estimate token usage (chars / 4 is a reasonable approximation)
        const inputText = systemPrompt + historyMessages.map(m =>
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        ).join(' ');
        const estInputTokens = Math.round(inputText.length / 4);
        const estOutputTokens = Math.round(fullContent.length / 4);

        // Save assistant message
        await db.collection('messages').insertOne({
          id: assistantMsgId, conversation_id: convId, user_id: user.id,
          role: 'assistant', content: fullContent, created_at: new Date(),
          model_used: model, provider_used: providerName,
          web_search_used: didSearch,
          est_input_tokens: estInputTokens,
          est_output_tokens: estOutputTokens,
        });

        await db.collection('conversations').updateOne(
          { id: convId }, { $set: { updated_at: new Date() } }
        );

        send({ type: 'done' });
        controller.close();
      } catch (error) {
        send({ type: 'error', error: error.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// FEEDBACK - Submit
async function handleSubmitFeedback(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { conversation_id, message_id, rating, note } = body;

  const db = await getDb();
  await db.collection('feedback').insertOne({
    id: uuidv4(),
    user_id: user.id,
    conversation_id,
    message_id,
    rating,
    note: note || '',
    created_at: new Date(),
  });

  return ok({ success: true });
}

// IMPORTS - Upload
async function handleImportUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  await ensureUploadsDir();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const importType = formData.get('type') || 'chatgpt';

    if (!file) return err('No file provided');

    const fileName = `${user.id}_${Date.now()}_${file.name}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const db = await getDb();
    const jobId = uuidv4();
    await db.collection('import_jobs').insertOne({
      id: jobId,
      user_id: user.id,
      type: importType,
      status: 'processing',
      file_path: filePath,
      file_name: file.name,
      error: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Process in background (non-blocking)
    processImportJob(jobId, user.id, importType, filePath, buffer).catch(console.error);

    return ok({ jobId, status: 'processing' });
  } catch (error) {
    return err(`Upload failed: ${error.message}`, 500);
  }
}

async function processImportJob(jobId, userId, importType, filePath, buffer) {
  const db = await getDb();
  try {
    let extractedText = '';
    const fileName = filePath.toLowerCase();

    if (fileName.endsWith('.zip')) {
      try {
        const AdmZip = (await import('adm-zip')).default;
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        for (const entry of entries) {
          if (!entry.isDirectory) {
            const name = entry.entryName.toLowerCase();
            if (name.endsWith('.json') || name.endsWith('.html') || name.endsWith('.txt')) {
              const content = entry.getData().toString('utf8');
              if (name.endsWith('.json')) {
                try {
                  const parsed = JSON.parse(content);
                  extractedText += extractTextFromJson(parsed, importType) + '\n\n';
                } catch { extractedText += content.slice(0, 5000) + '\n\n'; }
              } else {
                extractedText += content.replace(/<[^>]+>/g, ' ').slice(0, 5000) + '\n\n';
              }
              if (extractedText.length > 50000) break;
            }
          }
        }
      } catch (e) {
        extractedText = 'Could not extract zip: ' + e.message;
      }
    } else if (fileName.endsWith('.json')) {
      try {
        const parsed = JSON.parse(buffer.toString('utf8'));
        extractedText = extractTextFromJson(parsed, importType);
      } catch {
        extractedText = buffer.toString('utf8').slice(0, 50000);
      }
    } else {
      extractedText = buffer.toString('utf8').slice(0, 50000);
    }

    // Chunk text
    const chunkSize = 2000;
    const chunks = [];
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      chunks.push(extractedText.slice(i, i + chunkSize));
    }

    // Store chunks
    for (const chunkText of chunks.slice(0, 25)) {
      await db.collection('source_corpus_chunks').insertOne({
        id: uuidv4(),
        user_id: userId,
        import_job_id: jobId,
        chunk_text: chunkText,
        metadata: { type: importType },
        created_at: new Date(),
      });
    }

    // Generate soul profile summary using LLM
    let soulSummary = '';
    if (extractedText.length > 100) {
      try {
        const provider = getProvider('hosted', 'gpt-4o-mini');
        soulSummary = await provider.generateChatCompletion({
          systemPrompt: `You are analyzing personal data exports to understand someone's communication style, personality, and preferences. Be concise and insightful.`,
          messages: [{
            role: 'user',
            content: `Based on this data export (type: ${importType}), create a brief soul profile summary (200-300 words) covering:
1. Communication style and tone
2. Main interests and recurring topics
3. Work/life patterns and goals
4. Personality traits visible from their messages
5. What they seem to value most

Data sample:
${extractedText.slice(0, 8000)}`,
          }],
          model: 'gpt-4o-mini',
          temperature: 0.5,
        });
      } catch (e) {
        soulSummary = 'Could not generate summary: ' + e.message;
      }
    }

    // Update profile with soul summary
    if (soulSummary) {
      await db.collection('profiles').updateOne(
        { user_id: userId },
        { $set: { soul_profile_summary: soulSummary, soul_profile_updated_at: new Date() } }
      );
    }

    // Mark job complete
    await db.collection('import_jobs').updateOne(
      { id: jobId },
      { $set: { status: 'complete', chunk_count: chunks.length, updated_at: new Date() } }
    );
  } catch (error) {
    await db.collection('import_jobs').updateOne(
      { id: jobId },
      { $set: { status: 'error', error: error.message, updated_at: new Date() } }
    );
  }
}

function extractTextFromJson(parsed, type) {
  let text = '';
  if (type === 'chatgpt') {
    if (Array.isArray(parsed)) {
      for (const conv of parsed.slice(0, 20)) {
        if (conv.mapping) {
          for (const node of Object.values(conv.mapping)) {
            const msg = node?.message;
            if (msg?.content?.parts) {
              const role = msg.author?.role || 'unknown';
              const content = msg.content.parts.filter(p => typeof p === 'string').join(' ');
              if (content.trim()) text += `[${role}]: ${content.slice(0, 500)}\n`;
            }
          }
        }
      }
    }
  } else {
    text = JSON.stringify(parsed).slice(0, 50000);
  }
  return text || JSON.stringify(parsed).slice(0, 50000);
}

// IMPORTS - Get user imports
async function handleGetImports(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const imports = await db.collection('import_jobs')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();

  return ok(imports.map(i => ({
    id: i.id,
    type: i.type,
    status: i.status,
    file_name: i.file_name,
    error: i.error,
    chunk_count: i.chunk_count,
    created_at: i.created_at,
    updated_at: i.updated_at,
  })));
}

// ============================================================
// ADMIN HANDLERS
// ============================================================

async function handleAdminGetUsers(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  const db = await getDb();
  const query = search
    ? { email: { $regex: search, $options: 'i' } }
    : {};

  const total = await db.collection('users').countDocuments(query);
  const users = await db.collection('users')
    .find(query)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  const profiles = await db.collection('profiles')
    .find({ user_id: { $in: users.map(u => u.id) } })
    .toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  return ok({
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      accepted: u.accepted,
      created_at: u.created_at,
      last_active_at: u.last_active_at,
      display_name: profileMap[u.id]?.display_name || '',
      assessment_complete: profileMap[u.id]?.assessment_complete || false,
      onboarding_complete: profileMap[u.id]?.onboarding_complete || false,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

async function handleAdminUpdateUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  const update = {};
  if (body.accepted !== undefined) update.accepted = body.accepted;
  if (body.role !== undefined) {
    // Only superadmin can change roles
    if (admin.role !== 'superadmin') return err('Only superadmin can change roles', 403);
    update.role = body.role;
  }

  await db.collection('users').updateOne({ id: userId }, { $set: update });

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: body.accepted !== undefined ? (body.accepted ? 'accept_user' : 'reject_user') : 'update_role',
    target_user_id: userId,
    metadata: body,
    created_at: new Date(),
  });

  return ok({ success: true });
}

async function handleAdminResetPasscode(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { new_passcode } = body;
  if (!new_passcode) return err('new_passcode required');

  const db = await getDb();
  const hashed = await hashPassword(new_passcode);
  await db.collection('users').updateOne({ id: userId }, { $set: { passcode_hash: hashed } });

  return ok({ success: true });
}

async function handleAdminGetMetrics(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const totalUsers = await db.collection('users').countDocuments();
  const wauUsers = await db.collection('users').countDocuments({ last_active_at: { $gte: sevenDaysAgo } });

  // Multi-session rate
  const usersWithMultiConversations = await db.collection('conversations').aggregate([
    { $group: { _id: '$user_id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'total' },
  ]).toArray();
  const multiSessionCount = usersWithMultiConversations[0]?.total || 0;

  // Day 7 retention
  const usersCreated7DaysAgo = await db.collection('users').countDocuments({
    created_at: { $lte: sevenDaysAgo, $gte: new Date(now - 14 * 24 * 60 * 60 * 1000) },
  });
  const retainedUsers = await db.collection('users').countDocuments({
    created_at: { $lte: sevenDaysAgo },
    last_active_at: { $gte: sevenDaysAgo },
  });
  const day7Retention = usersCreated7DaysAgo > 0
    ? Math.round((retainedUsers / usersCreated7DaysAgo) * 100)
    : 0;

  // Avg sessions per user (7d)
  const conversationsIn7d = await db.collection('conversations').countDocuments({
    created_at: { $gte: sevenDaysAgo },
  });
  const avgSessionsPerUser = wauUsers > 0 ? (conversationsIn7d / wauUsers).toFixed(1) : 0;

  // Messages per session
  const msgAgg = await db.collection('messages').aggregate([
    { $group: { _id: '$conversation_id', count: { $sum: 1 } } },
    { $group: { _id: null, avg: { $avg: '$count' } } },
  ]).toArray();
  const avgMsgPerSession = msgAgg[0]?.avg?.toFixed(1) || 0;

  // Assessment completion rate
  const usersWithCompleteAssessment = await db.collection('profiles').countDocuments({ assessment_complete: true });
  const assessmentRate = totalUsers > 0 ? Math.round((usersWithCompleteAssessment / totalUsers) * 100) : 0;

  // Import adoption rate
  const usersWithImports = await db.collection('import_jobs').distinct('user_id');
  const importRate = totalUsers > 0 ? Math.round((usersWithImports.length / totalUsers) * 100) : 0;

  // CSAT
  const thumbsUp = await db.collection('feedback').countDocuments({ rating: 'up' });
  const thumbsDown = await db.collection('feedback').countDocuments({ rating: 'down' });
  const csat = (thumbsUp + thumbsDown) > 0
    ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100)
    : null;

  // Recent signups
  const recentSignups = await db.collection('users').countDocuments({ created_at: { $gte: thirtyDaysAgo } });

  // Total messages
  const totalMessages = await db.collection('messages').countDocuments();

  return ok({
    wau: wauUsers,
    total_users: totalUsers,
    multi_session_rate: totalUsers > 0 ? Math.round((multiSessionCount / totalUsers) * 100) : 0,
    day7_retention: day7Retention,
    avg_sessions_per_user_7d: avgSessionsPerUser,
    avg_messages_per_session: avgMsgPerSession,
    assessment_completion_rate: assessmentRate,
    import_adoption_rate: importRate,
    csat,
    recent_signups_30d: recentSignups,
    total_messages: totalMessages,
    thumbs_up: thumbsUp,
    thumbs_down: thumbsDown,
  });
}

async function handleAdminGetQuestions(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const questions = await db.collection('assessment_questions')
    .find({})
    .sort({ order_index: 1 })
    .toArray();

  return ok(questions);
}

async function handleAdminSeedQuestions(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  await db.collection('assessment_questions').deleteMany({});
  await seedQuestions(db);

  return ok({ success: true, count: SEED_QUESTIONS.length });
}

async function handleAdminUpdateQuestion(request, questionId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  const update = {};
  if (body.question_text !== undefined) update.question_text = body.question_text;
  if (body.active !== undefined) update.active = body.active;

  await db.collection('assessment_questions').updateOne({ id: questionId }, { $set: update });
  return ok({ success: true });
}

async function handleAdminGetConversations(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  const db = await getDb();
  const total = await db.collection('conversations').countDocuments();
  const conversations = await db.collection('conversations')
    .find({})
    .sort({ updated_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  const userIds = [...new Set(conversations.map(c => c.user_id))];
  const users = await db.collection('users').find({ id: { $in: userIds } }).toArray();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return ok({
    conversations: conversations.map(c => ({
      id: c.id,
      title: c.title,
      user_email: userMap[c.user_id]?.email || 'unknown',
      user_id: c.user_id,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

async function handleAdminGetImports(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const imports = await db.collection('import_jobs')
    .find({})
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();

  const userIds = [...new Set(imports.map(i => i.user_id))];
  const users = await db.collection('users').find({ id: { $in: userIds } }).toArray();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return ok(imports.map(i => ({
    id: i.id,
    type: i.type,
    status: i.status,
    file_name: i.file_name,
    error: i.error,
    user_email: userMap[i.user_id]?.email || 'unknown',
    created_at: i.created_at,
    updated_at: i.updated_at,
  })));
}

async function handleAdminGetSettings(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });

  return ok(settings || {
    default_model: 'gpt-4o',
    default_provider: 'hosted',
    available_models: AVAILABLE_MODELS,
    waitlist_enabled: true,
  });
}

async function handleAdminUpdateSettings(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  await db.collection('settings').updateOne(
    { id: 'global' },
    { $set: { ...body, id: 'global', updated_at: new Date() } },
    { upsert: true }
  );

  return ok({ success: true });
}

async function handleAdminInviteAdmin(request) {
  const admin = await requireAdmin(request);
  if (!admin || admin.role !== 'superadmin') return err('Only superadmin can invite admins', 403);

  const body = await request.json();
  const { email } = body;
  if (!email) return err('email required');

  const db = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return err('User not found');

  await db.collection('users').updateOne(
    { email: email.toLowerCase() },
    { $set: { role: 'admin', accepted: true } }
  );

  return ok({ success: true });
}

// ============================================================
// TELEGRAM CONNECTOR
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

  // Handle /start command
  if (text === '/start') {
    // Check if already linked to a SoulPrint account
    const existingLinked = await db.collection('telegram_mappings').findOne({ telegram_user_id: telegramUserId, linked: true });
    if (existingLinked) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `✅ Your Telegram is already linked to SoulPrint!\n\nJust send me a message to chat with your personal AI.`
      );
      return ok({ ok: true });
    }

    // Generate a fresh link code (expires in 24 hours)
    const linkCode = uuidv4().slice(0, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.collection('telegram_mappings').updateOne(
      { telegram_user_id: telegramUserId },
      { $set: { telegram_user_id: telegramUserId, telegram_chat_id: chatId.toString(), link_code: linkCode, linked: false, expires_at: expiresAt, created_at: new Date() } },
      { upsert: true }
    );
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
      `👋 Welcome to SoulPrint, ${fromName}!\n\nTo link your account:\n1️⃣ Go to: ${process.env.NEXT_PUBLIC_BASE_URL}/app\n2️⃣ Open Settings (⚙️) → Telegram tab\n3️⃣ Enter your link code:\n\n\`${linkCode}\`\n\n⏳ This code expires in 24 hours.\n\nOnce linked, I'll be your personal AI — right here in Telegram.`
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

  // Send typing indicator
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });

  try {
    // Get or create a Telegram conversation for this user
    let conv = await db.collection('conversations').findOne({ user_id: userId, source: 'telegram' });
    if (!conv) {
      const convId = uuidv4();
      conv = { id: convId, user_id: userId, title: 'Telegram Chat', source: 'telegram', created_at: new Date(), updated_at: new Date() };
      await db.collection('conversations').insertOne(conv);
    }

    // Save user message
    const userMsgId = uuidv4();
    await db.collection('messages').insertOne({
      id: userMsgId, conversation_id: conv.id, user_id: userId,
      role: 'user', content: text, created_at: new Date(), source: 'telegram',
    });

    // Get history
    const recent = await db.collection('messages')
      .find({ conversation_id: conv.id, id: { $ne: userMsgId } })
      .sort({ created_at: -1 }).limit(10).toArray();
    recent.reverse();

    const historyMessages = [...recent.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }];
    const systemPrompt = await buildSystemPrompt(db, userId);
    const provider = getProvider('hosted', 'gpt-4o');

    const aiResponse = await provider.generateChatCompletion({
      systemPrompt, messages: historyMessages, model: 'gpt-4o', temperature: 0.7,
    });

    // Save assistant message
    await db.collection('messages').insertOne({
      id: uuidv4(), conversation_id: conv.id, user_id: userId,
      role: 'assistant', content: aiResponse, created_at: new Date(), source: 'telegram',
    });
    await db.collection('conversations').updateOne({ id: conv.id }, { $set: { updated_at: new Date() } });

    // Send reply (split if > 4096 chars)
    const chunks = aiResponse.match(/[\s\S]{1,4000}/g) || [aiResponse];
    for (const chunk of chunks) {
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, chunk);
    }
  } catch (e) {
    console.error('Telegram handler error:', e);
    await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, '⚠️ Something went wrong. Please try again.');
  }

  return ok({ ok: true });
}

async function sendTelegramMessage(chatId, token, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

// Telegram setup — link a SoulPrint account to a Telegram chat
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

// Telegram status + setup webhook
async function handleTelegramSetup(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) return ok({ configured: false, message: 'Add TELEGRAM_BOT_TOKEN to .env to enable Telegram.' });

  const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/connectors/telegram/webhook`;

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
  });
}

// CONNECTORS (stubs for others)
async function handleConnectorStub(platform) {
  return NextResponse.json({
    status: 'not_configured',
    message: `${platform} connector is not yet implemented. Telegram is available — configure TELEGRAM_BOT_TOKEN in .env.`,
  });
}

// TRANSCRIBE - Whisper audio transcription (fallback for non-Chrome browsers)
async function handleTranscribe(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    if (!audioFile) return err('No audio file provided');

    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    return ok({ text: transcription.text });
  } catch (error) {
    return err(`Transcription failed: ${error.message}`, 500);
  }
}

// MODELS - Get available
async function handleGetModels(request) {
  return ok(AVAILABLE_MODELS);
}

// ============================================================
// ROUTER
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'auth/me') return handleMe(request);
    if (pathStr === 'assessment/questions') return handleGetQuestions(request);
    if (pathStr === 'assessment/progress') return handleGetProgress(request);
    if (pathStr === 'conversations') return handleGetConversations(request);
    if (pathStr === 'messages') return handleGetMessages(request);
    if (pathStr === 'imports') return handleGetImports(request);
    if (pathStr === 'models') return handleGetModels(request);
    if (pathStr === 'telegram/status') return handleTelegramStatus(request);
    if (pathStr === 'telegram/setup') return handleTelegramSetup(request);

    // Admin routes
    if (pathStr === 'admin/users') return handleAdminGetUsers(request);
    if (pathStr === 'admin/metrics') return handleAdminGetMetrics(request);
    if (pathStr === 'admin/questions') return handleAdminGetQuestions(request);
    if (pathStr === 'admin/conversations') return handleAdminGetConversations(request);
    if (pathStr === 'admin/imports') return handleAdminGetImports(request);
    if (pathStr === 'admin/settings') return handleAdminGetSettings(request);

    return err('Not found', 404);
  } catch (error) {
    console.error('GET error:', error);
    return err(error.message, 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'auth/register') return handleRegister(request);
    if (pathStr === 'auth/login') return handleLogin(request);
    if (pathStr === 'assessment/answer') return handleSubmitAnswer(request);
    if (pathStr === 'assessment/complete') return handleAssessmentComplete(request);
    if (pathStr === 'conversations') return handleCreateConversation(request);
    if (pathStr === 'chat/stream') return handleChatStream(request);
    if (pathStr === 'feedback') return handleSubmitFeedback(request);
    if (pathStr === 'imports/upload') return handleImportUpload(request);
    if (pathStr === 'transcribe') return handleTranscribe(request);
    if (pathStr === 'telegram/link') return handleTelegramLink(request);
    if (pathStr === 'telegram/setup') return handleTelegramSetup(request);
    if (pathStr === 'connectors/telegram/webhook') return handleTelegramWebhook(request);

    // Admin routes
    if (pathStr === 'admin/questions/seed') return handleAdminSeedQuestions(request);
    if (pathStr === 'admin/invite') return handleAdminInviteAdmin(request);
    if (pathStr === 'admin/settings') return handleAdminUpdateSettings(request);
    if (pathStr === 'telegram/setup') return handleTelegramSetup(request);

    // Other connector stubs
    if (pathStr === 'connectors/discord/webhook') return handleConnectorStub('discord');
    if (pathStr === 'connectors/whatsapp/webhook') return handleConnectorStub('whatsapp');
    if (pathStr === 'connectors/sms/webhook') return handleConnectorStub('sms');

    return err('Not found', 404);
  } catch (error) {
    console.error('POST error:', error);
    return err(error.message, 500);
  }
}

export async function PUT(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'profile') return handleProfileUpdate(request);

    // Admin user update: admin/users/:id
    if (pathStr.startsWith('admin/users/') && pathStr.endsWith('/accept')) {
      const userId = pathArr[2];
      return handleAdminUpdateUser(request, userId);
    }
    if (pathStr.startsWith('admin/users/') && pathStr.endsWith('/reset-passcode')) {
      const userId = pathArr[2];
      return handleAdminResetPasscode(request, userId);
    }
    if (pathStr.startsWith('admin/users/')) {
      const userId = pathArr[2];
      return handleAdminUpdateUser(request, userId);
    }
    if (pathStr.startsWith('admin/questions/')) {
      const questionId = pathArr[2];
      return handleAdminUpdateQuestion(request, questionId);
    }

    return err('Not found', 404);
  } catch (error) {
    console.error('PUT error:', error);
    return err(error.message, 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');
  return err('Not implemented', 404);
}
