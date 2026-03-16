import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';

// ============================================================
// CONSTANTS
// ============================================================

const MEMORY_CATEGORIES = ['health', 'preferences', 'personal', 'work', 'family', 'travel', 'hobbies', 'goals', 'other'];

// System prompt cache invalidation
const _systemPromptCache = new Map();
function invalidateSystemPromptCache(userId) {
  _systemPromptCache.delete(userId);
}

// ============================================================
// PROFILE HANDLERS
// ============================================================

async function handleGetProfile(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const profile = await db.collection('profiles').findOne({ user_id: user.id });

  return ok({
    user_id: user.id,
    email: user.email,
    role: user.role,
    accepted: user.accepted,
    display_name: profile?.display_name || '',
    assistant_name: profile?.assistant_name || 'SoulPrint',
    descriptors: profile?.descriptors || [],
    field: profile?.field || '',
    help_with: profile?.help_with || [],
    discovery_source: profile?.discovery_source || '',
    custom_greeting: profile?.custom_greeting || '',
    soul_profile_summary: profile?.soul_profile_summary || '',
    onboarding_complete: profile?.onboarding_complete || false,
    assessment_complete: profile?.assessment_complete || false,
    created_at: user.created_at,
  });
}

async function handleUpdateProfile(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { display_name, descriptors, field, help_with, discovery_source, assistant_name, onboarding_complete, custom_greeting } = body;

  const db = await getDb();
  const update = { updated_at: new Date() };
  
  if (display_name !== undefined) update.display_name = display_name;
  if (descriptors !== undefined) update.descriptors = descriptors;
  if (field !== undefined) update.field = field;
  if (help_with !== undefined) update.help_with = help_with;
  if (discovery_source !== undefined) update.discovery_source = discovery_source;
  if (assistant_name !== undefined) update.assistant_name = assistant_name;
  if (onboarding_complete !== undefined) update.onboarding_complete = onboarding_complete;
  if (custom_greeting !== undefined) update.custom_greeting = custom_greeting;

  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: update },
    { upsert: true }
  );

  invalidateSystemPromptCache(user.id);
  return ok({ success: true });
}

async function handleGetSoulProfile(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
  const assessmentAnswers = await db.collection('assessment_answers').find({ user_id: user.id }).toArray();
  const memories = await db.collection('user_memories').find({ user_id: user.id }).limit(50).toArray();

  return ok({
    profile: {
      display_name: profile?.display_name,
      assistant_name: profile?.assistant_name,
      descriptors: profile?.descriptors || [],
      field: profile?.field,
      help_with: profile?.help_with || [],
      soul_profile_summary: profile?.soul_profile_summary,
    },
    soul_insights: soulProfile?.insights || null,
    assessment_answers: assessmentAnswers.length,
    memory_count: memories.length,
  });
}

async function handleProfileExport(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const memories = await db.collection('user_memories').find({ user_id: user.id }).toArray();
  const assessmentAnswers = await db.collection('assessment_answers').find({ user_id: user.id }).toArray();
  const conversations = await db.collection('conversations').find({ user_id: user.id }).toArray();

  return ok({
    export_date: new Date().toISOString(),
    profile: {
      email: user.email,
      display_name: profile?.display_name,
      assistant_name: profile?.assistant_name,
      descriptors: profile?.descriptors,
      field: profile?.field,
      help_with: profile?.help_with,
      created_at: user.created_at,
    },
    memories: memories.map(m => ({
      content: m.content,
      category: m.category,
      importance: m.importance,
      created_at: m.created_at,
    })),
    assessment_answers: assessmentAnswers.map(a => ({
      question_id: a.question_id,
      answer_text: a.answer_text,
      created_at: a.created_at,
    })),
    conversation_count: conversations.length,
  });
}

// ============================================================
// MEMORY HANDLERS
// ============================================================

async function handleGetMemories(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  const query = { user_id: user.id };
  if (category && MEMORY_CATEGORIES.includes(category)) {
    query.category = category;
  }

  const memories = await db.collection('user_memories')
    .find(query)
    .sort({ importance: 1, created_at: -1 })
    .toArray();

  return ok({
    memories: memories.map(m => ({
      id: m.id,
      content: m.content,
      category: m.category,
      importance: m.importance,
      source: m.source,
      created_at: m.created_at,
    })),
    categories: MEMORY_CATEGORIES,
  });
}

async function handleCreateMemory(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { content, category, importance } = body;

  if (!content || content.trim().length < 3) {
    return err('Memory content is required (at least 3 characters)', 400);
  }

  const db = await getDb();

  const memory = {
    id: uuidv4(),
    user_id: user.id,
    content: content.trim(),
    category: MEMORY_CATEGORIES.includes(category) ? category : 'other',
    importance: ['high', 'medium', 'low'].includes(importance) ? importance : 'medium',
    source: 'manual',
    source_conversation_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  await db.collection('user_memories').insertOne(memory);
  invalidateSystemPromptCache(user.id);

  return ok({ success: true, memory });
}

async function handleUpdateMemory(request, memoryId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { content, category, importance } = body;

  const db = await getDb();

  const memory = await db.collection('user_memories').findOne({ id: memoryId, user_id: user.id });
  if (!memory) return err('Memory not found', 404);

  const updates = { updated_at: new Date() };
  if (content !== undefined) updates.content = content.trim();
  if (category !== undefined && MEMORY_CATEGORIES.includes(category)) updates.category = category;
  if (importance !== undefined && ['high', 'medium', 'low'].includes(importance)) updates.importance = importance;

  await db.collection('user_memories').updateOne({ id: memoryId }, { $set: updates });
  invalidateSystemPromptCache(user.id);

  return ok({ success: true });
}

async function handleDeleteMemory(request, memoryId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  const memory = await db.collection('user_memories').findOne({ id: memoryId, user_id: user.id });
  if (!memory) return err('Memory not found', 404);

  await db.collection('user_memories').deleteOne({ id: memoryId });
  invalidateSystemPromptCache(user.id);

  return ok({ success: true });
}

// ============================================================
// ASSESSMENT HANDLERS
// ============================================================

async function handleGetQuestions(request) {
  const db = await getDb();
  let questions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();

  return ok(questions.map(q => ({
    id: q.id,
    pillar: q.pillar,
    order_index: q.order_index,
    question_text: q.question_text,
  })));
}

async function handleGetProgress(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  const answers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();

  const layeredAnswers = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });

  let totalAnswered = answers.length;
  let answeredIds = answers.map(a => a.question_id);
  let layer1Complete = false;
  let layer2Complete = false;

  if (layeredAnswers) {
    const layer1Count = Object.keys(layeredAnswers.layer1_answers || {}).length;
    const layer2Count = Object.keys(layeredAnswers.layer2_answers || {}).length;
    totalAnswered += layer1Count + layer2Count;
    answeredIds = [...answeredIds, ...Object.keys(layeredAnswers.layer1_answers || {}), ...Object.keys(layeredAnswers.layer2_answers || {})];
    layer1Complete = layeredAnswers.layer1_complete || false;
    layer2Complete = layeredAnswers.layer2_complete || false;
  }

  const hasCompletedAssessment = answers.length >= 36 || layer1Complete || totalAnswered >= 12;

  return ok({
    answered: answeredIds,
    count: totalAnswered,
    layer1_complete: layer1Complete,
    layer2_complete: layer2Complete,
    assessment_complete: hasCompletedAssessment
  });
}

async function handleSubmitAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { question_id, answer_text } = body;
  if (!question_id) return err('question_id required');

  const db = await getDb();

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

// ============================================================
// CONVERSATION HANDLERS
// ============================================================

async function handleGetConversations(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  const db = await getDb();

  let query = {};

  if (projectId === 'general' || projectId === 'uncategorized') {
    query = {
      user_id: user.id,
      $or: [{ project_id: { $exists: false } }, { project_id: null }, { project_id: 'general' }]
    };
  } else if (projectId) {
    const project = await db.collection('projects').findOne({
      id: projectId,
      $or: [{ owner_id: user.id }, { 'shared_with.user_id': user.id }]
    });
    if (!project) return err('Project not found', 404);
    query = { project_id: projectId };
  } else {
    const sharedProjects = await db.collection('projects')
      .find({ 'shared_with.user_id': user.id, 'shared_with.accepted': true })
      .toArray();
    const sharedProjectIds = sharedProjects.map(p => p.id);

    query = {
      $or: [
        { user_id: user.id },
        { project_id: { $in: sharedProjectIds } }
      ]
    };
  }

  const conversations = await db.collection('conversations')
    .find(query)
    .sort({ updated_at: -1 })
    .limit(100)
    .toArray();

  return ok(conversations.map(c => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    updated_at: c.updated_at,
    source: c.source || 'web',
    project_id: c.project_id || null,
    tags: c.tags || [],
    is_mine: c.user_id === user.id,
  })));
}

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

  if (body.project_id && body.project_id !== 'general') {
    conv.project_id = body.project_id;
  }

  await db.collection('conversations').insertOne(conv);
  return ok({ id: conv.id, title: conv.title, created_at: conv.created_at });
}

async function handleRenameConversation(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const { title } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return err('Title is required', 400);
  }

  const db = await getDb();

  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  await db.collection('conversations').updateOne(
    { id: conversationId },
    { $set: { title: title.trim(), updated_at: new Date() } }
  );

  return ok({ success: true, title: title.trim() });
}

async function handleDeleteConversation(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  await db.collection('conversations').deleteOne({ id: conversationId });
  await db.collection('messages').deleteMany({ conversation_id: conversationId });

  return ok({ success: true });
}

// ============================================================
// PROJECT HANDLERS
// ============================================================

function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function handleGetProjects(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  const ownedProjects = await db.collection('projects')
    .find({ owner_id: user.id })
    .sort({ created_at: -1 })
    .toArray();

  const sharedProjects = await db.collection('projects')
    .find({ 'shared_with.user_id': user.id, 'shared_with.accepted': true })
    .sort({ created_at: -1 })
    .toArray();

  const projectIds = [...ownedProjects, ...sharedProjects].map(p => p.id);
  const convCounts = await db.collection('conversations').aggregate([
    { $match: { project_id: { $in: projectIds } } },
    { $group: { _id: '$project_id', count: { $sum: 1 } } }
  ]).toArray();
  const countMap = Object.fromEntries(convCounts.map(c => [c._id, c.count]));

  return ok({
    owned: ownedProjects.map(p => ({
      ...p,
      is_owner: true,
      conversation_count: countMap[p.id] || 0,
    })),
    shared: sharedProjects.map(p => ({
      ...p,
      is_owner: false,
      conversation_count: countMap[p.id] || 0,
      my_role: p.shared_with?.find(s => s.user_id === user.id)?.role || 'viewer',
    })),
  });
}

async function handleCreateProject(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { name, description, color } = body;

  if (!name || name.trim().length === 0) {
    return err('Project name is required', 400);
  }

  const db = await getDb();
  const project = {
    id: uuidv4(),
    owner_id: user.id,
    name: name.trim(),
    description: description || '',
    color: color || '#6366f1',
    share_code: generateShareCode(),
    shared_with: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  await db.collection('projects').insertOne(project);
  return ok(project);
}

async function handleUpdateProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { name, description, color } = body;

  const db = await getDb();

  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not owner', 404);

  const updates = { updated_at: new Date() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (color !== undefined) updates.color = color;

  await db.collection('projects').updateOne({ id: projectId }, { $set: updates });
  return ok({ success: true });
}

async function handleDeleteProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not owner', 404);

  // Unlink conversations instead of deleting them
  await db.collection('conversations').updateMany(
    { project_id: projectId },
    { $unset: { project_id: '' } }
  );

  await db.collection('projects').deleteOne({ id: projectId });
  return ok({ success: true });
}

async function handleJoinProject(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { share_code } = body;

  if (!share_code) return err('Share code required', 400);

  const db = await getDb();

  const project = await db.collection('projects').findOne({ share_code: share_code.trim() });
  if (!project) return err('Invalid share code', 404);

  if (project.owner_id === user.id) {
    return err('You are already the owner of this project', 400);
  }

  const alreadyMember = project.shared_with?.some(s => s.user_id === user.id);
  if (alreadyMember) {
    return err('You are already a member of this project', 400);
  }

  await db.collection('projects').updateOne(
    { id: project.id },
    {
      $push: {
        shared_with: {
          user_id: user.id,
          email: user.email,
          role: 'editor',
          accepted: true,
          joined_at: new Date(),
        }
      }
    }
  );

  return ok({
    success: true,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
    }
  });
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Profile
    if (pathStr === 'profile') return handleGetProfile(request);
    if (pathStr === 'profile/soul') return handleGetSoulProfile(request);
    if (pathStr === 'profile/export') return handleProfileExport(request);

    // Memories
    if (pathStr === 'memories') return handleGetMemories(request);

    // Assessment
    if (pathStr === 'assessment/questions') return handleGetQuestions(request);
    if (pathStr === 'assessment/progress') return handleGetProgress(request);

    // Conversations
    if (pathStr === 'conversations') return handleGetConversations(request);

    // Projects
    if (pathStr === 'projects') return handleGetProjects(request);

    return err('User endpoint not found', 404);
  } catch (error) {
    console.error('[User API] GET Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Memories
    if (pathStr === 'memories') return handleCreateMemory(request);

    // Assessment
    if (pathStr === 'assessment/answer') return handleSubmitAnswer(request);
    if (pathStr === 'assessment/complete') return handleAssessmentComplete(request);

    // Conversations
    if (pathStr === 'conversations') return handleCreateConversation(request);

    // Projects
    if (pathStr === 'projects') return handleCreateProject(request);
    if (pathStr === 'projects/join') return handleJoinProject(request);

    return err('User endpoint not found', 404);
  } catch (error) {
    console.error('[User API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function PUT(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Profile
    if (pathStr === 'profile') return handleUpdateProfile(request);

    // Memories
    if (pathStr.match(/^memories\/[^\/]+$/)) {
      return handleUpdateMemory(request, pathArr[1]);
    }

    // Conversations
    if (pathStr.match(/^conversations\/[^\/]+$/)) {
      return handleRenameConversation(request, pathArr[1]);
    }

    // Projects
    if (pathStr.match(/^projects\/[^\/]+$/)) {
      return handleUpdateProject(request, pathArr[1]);
    }

    return err('User endpoint not found', 404);
  } catch (error) {
    console.error('[User API] PUT Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Memories
    if (pathStr.match(/^memories\/[^\/]+$/)) {
      return handleDeleteMemory(request, pathArr[1]);
    }

    // Conversations
    if (pathStr.match(/^conversations\/[^\/]+$/)) {
      return handleDeleteConversation(request, pathArr[1]);
    }

    // Projects
    if (pathStr.match(/^projects\/[^\/]+$/)) {
      return handleDeleteProject(request, pathArr[1]);
    }

    return err('User endpoint not found', 404);
  } catch (error) {
    console.error('[User API] DELETE Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
