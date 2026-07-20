/**
 * Conversation CRUD handlers
 * Extracted from the main catch-all route.js for maintainability.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err } from '@/lib/api-utils';

/**
 * GET /api/assistant-name?conversation_id=...&project_id=...
 * Returns the dynamic assistant name based on active imprint and project
 */
async function handleGetAssistantName(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversation_id');
  const projectId = searchParams.get('project_id');
  
  const db = await getDb();
  const { getAssistantDisplayName } = await import('@/lib/handlers/imprints');
  
  const assistantName = await getAssistantDisplayName(user.id, conversationId, projectId);
  
  return ok({ assistant_name: assistantName });
}

// CONVERSATIONS - Get all for user
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
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    if (!project) return err('Project not found', 404);
    query = { project_id: projectId };
  } else {
    const sharedProjects = await db.collection('projects')
      .find({ 'shared_with.user_id': user.id, 'shared_with.accepted': true })
      .toArray();
    const sharedProjectIds = sharedProjects.map(p => p.id);
    
    query = {
      $and: [
        {
          $or: [
            { user_id: user.id },
            { project_id: { $in: sharedProjectIds } }
          ]
        },
        { $or: [{ hidden_from_all_chats: { $exists: false } }, { hidden_from_all_chats: false }] }
      ]
    };
  }

  const conversations = await db.collection('conversations')
    .find(query)
    .sort({ updated_at: -1 })
    .limit(100)
    .toArray();

  // Resolve project_id -> project name so the client doesn't have to display raw IDs
  const projectIds = [...new Set(conversations.map(c => c.project_id).filter(Boolean))];
  let projectNamesById = {};
  if (projectIds.length > 0) {
    const projects = await db.collection('projects')
      .find({ id: { $in: projectIds } })
      .project({ id: 1, name: 1 })
      .toArray();
    projectNamesById = Object.fromEntries(projects.map(p => [p.id, p.name]));
  }

  return ok(conversations.map(c => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    updated_at: c.updated_at,
    source: c.source || 'web',
    project_id: c.project_id || null,
    project_name: c.project_id ? (projectNamesById[c.project_id] || null) : null,
    tags: c.tags || [],
    is_mine: c.user_id === user.id,
  })));
}

// CONVERSATIONS - Create
async function handleCreateConversation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const { project_id } = body;
  const db = await getDb();
  const now = new Date();

  const conv = {
    id: uuidv4(),
    user_id: user.id,
    title: body.title || 'New Conversation',
    created_at: now,
    updated_at: now,
  };

  if (project_id && project_id !== 'general') {
    const project = await db.collection('projects').findOne({
      id: project_id,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    if (project) {
      conv.project_id = project_id;
    }
  }

  await db.collection('conversations').insertOne(conv);
  return ok({ id: conv.id, title: conv.title, created_at: conv.created_at });
}

// CONVERSATIONS - Rename
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

// CONVERSATIONS - Delete
async function handleDeleteConversation(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  const { searchParams } = new URL(request.url);
  const fromProject = searchParams.get('from_project') === 'true';
  
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  console.log('[DELETE CONV] ID:', conversationId, '| project_id:', conv.project_id, '| fromProject:', fromProject);

  if (!fromProject && conv.project_id && conv.project_id !== 'general') {
    console.log('[DELETE CONV] Hiding from All Chats (keeping in project)');
    await db.collection('conversations').updateOne(
      { id: conversationId },
      { $set: { hidden_from_all_chats: true, updated_at: new Date() } }
    );
    return ok({ success: true, hidden: true });
  }

  console.log('[DELETE CONV] Permanently deleting');
  await db.collection('conversations').deleteOne({ id: conversationId });
  await db.collection('messages').deleteMany({ conversation_id: conversationId });

  return ok({ success: true, deleted: true });
}

export {
  handleGetConversations,
  handleCreateConversation,
  handleRenameConversation,
  handleDeleteConversation,
  handleGetAssistantName,
};
