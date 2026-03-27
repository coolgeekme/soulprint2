/**
 * Projects & Collaboration + Tags
 * Extracted from route.js for maintainability.
 */
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';

// PROJECTS & COLLABORATION
// ============================================================

// Generate a unique share code
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all projects for user (owned + shared)
async function handleGetProjects(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get owned projects
  const ownedProjects = await db.collection('projects')
    .find({ owner_id: user.id })
    .sort({ created_at: -1 })
    .toArray();

  // Get projects shared with user
  const sharedProjects = await db.collection('projects')
    .find({ 'shared_with.user_id': user.id, 'shared_with.accepted': true })
    .sort({ created_at: -1 })
    .toArray();

  // Get conversation counts per project
  const projectIds = [...ownedProjects, ...sharedProjects].map(p => p.id);
  const convCounts = await db.collection('conversations').aggregate([
    { $match: { project_id: { $in: projectIds } } },
    { $group: { _id: '$project_id', count: { $sum: 1 } } }
  ]).toArray();
  const countMap = Object.fromEntries(convCounts.map(c => [c._id, c.count]));

  // Get owner info for shared projects
  const ownerIds = sharedProjects.map(p => p.owner_id);
  const owners = await db.collection('users').find({ id: { $in: ownerIds } }).toArray();
  const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.email]));

  // Count uncategorized conversations
  const uncategorizedCount = await db.collection('conversations').countDocuments({
    user_id: user.id,
    $or: [{ project_id: { $exists: false } }, { project_id: null }, { project_id: 'general' }]
  });

  return ok({
    owned: ownedProjects.map(p => ({
      ...p,
      conversation_count: countMap[p.id] || 0,
      is_owner: true,
    })),
    shared: sharedProjects.map(p => ({
      ...p,
      conversation_count: countMap[p.id] || 0,
      is_owner: false,
      owner_email: ownerMap[p.owner_id],
      my_role: p.shared_with.find(s => s.user_id === user.id)?.role || 'viewer',
    })),
    uncategorized_count: uncategorizedCount,
  });
}

// Create a new project
async function handleCreateProject(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { name, description, color, icon, instructions } = await request.json();
  if (!name) return err('Project name is required');

  const db = await getDb();
  const now = new Date();

  const project = {
    id: uuidv4(),
    name: name.trim(),
    description: description || '',
    instructions: instructions || '', // Custom AI instructions for this project
    color: color || '#6366f1', // Default indigo
    icon: icon || '📁',
    owner_id: user.id,
    shared_with: [],
    share_link: null,
    created_at: now,
    updated_at: now,
  };

  await db.collection('projects').insertOne(project);
  return ok(project);
}

// Update a project
async function handleUpdateProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { name, description, color, icon, instructions } = await request.json();
  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  const updates = { updated_at: new Date() };
  if (name) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (instructions !== undefined) updates.instructions = instructions;
  if (color) updates.color = color;
  if (icon) updates.icon = icon;

  await db.collection('projects').updateOne({ id: projectId }, { $set: updates });
  return ok({ success: true });
}

// Delete a project
async function handleDeleteProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  // Move all conversations in this project to uncategorized
  await db.collection('conversations').updateMany(
    { project_id: projectId },
    { $set: { project_id: null } }
  );

  await db.collection('projects').deleteOne({ id: projectId });
  return ok({ success: true });
}

// Share project with another user by email
async function handleShareProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { email, role } = await request.json();
  if (!email) return err('Email is required');

  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  // Find target user
  const targetUser = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!targetUser) return err('User not found with that email', 404);
  if (targetUser.id === user.id) return err('Cannot share with yourself', 400);

  // Check if already shared
  const alreadyShared = project.shared_with?.find(s => s.user_id === targetUser.id);
  if (alreadyShared) return err('Already shared with this user', 400);

  // Add to shared_with
  const shareEntry = {
    user_id: targetUser.id,
    email: targetUser.email,
    role: role || 'collaborator', // 'viewer' or 'collaborator'
    invited_at: new Date(),
    accepted: true, // Auto-accept for now
  };

  await db.collection('projects').updateOne(
    { id: projectId },
    { $push: { shared_with: shareEntry } }
  );

  return ok({ success: true, shared_with: shareEntry });
}

// Remove user from project
async function handleUnshareProject(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { user_id } = await request.json();
  if (!user_id) return err('User ID is required');

  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  await db.collection('projects').updateOne(
    { id: projectId },
    { $pull: { shared_with: { user_id } } }
  );

  return ok({ success: true });
}

// Generate/toggle share link for project
async function handleProjectShareLink(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { enabled, role, public_view } = await request.json();
  const db = await getDb();

  // Verify ownership
  const project = await db.collection('projects').findOne({ id: projectId, owner_id: user.id });
  if (!project) return err('Project not found or not authorized', 404);

  let shareLink = project.share_link;

  if (enabled) {
    // Generate or update share link
    shareLink = {
      code: shareLink?.code || generateShareCode(),
      enabled: true,
      role: role || shareLink?.role || 'collaborator',
      public_view: public_view !== undefined ? public_view : (shareLink?.public_view || false),
      created_at: shareLink?.created_at || new Date(),
    };
  } else {
    // Disable share link
    if (shareLink) {
      shareLink.enabled = false;
    }
  }

  await db.collection('projects').updateOne(
    { id: projectId },
    { $set: { share_link: shareLink } }
  );

  return ok({ share_link: shareLink });
}

// Join project via share link
async function handleJoinProject(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { code } = await request.json();
  if (!code) return err('Share code is required');

  const db = await getDb();

  // Find project with this share code
  const project = await db.collection('projects').findOne({
    'share_link.code': code,
    'share_link.enabled': true,
  });

  if (!project) return err('Invalid or expired share link', 404);
  if (project.owner_id === user.id) return err('You already own this project', 400);

  // Check if already a member
  const alreadyMember = project.shared_with?.find(s => s.user_id === user.id);
  if (alreadyMember) return err('You are already a member of this project', 400);

  // Add user to project
  const shareEntry = {
    user_id: user.id,
    email: user.email,
    role: project.share_link.role || 'collaborator',
    invited_at: new Date(),
    accepted: true,
    joined_via: 'link',
  };

  await db.collection('projects').updateOne(
    { id: project.id },
    { $push: { shared_with: shareEntry } }
  );

  return ok({ success: true, project: { id: project.id, name: project.name } });
}

// ── PUBLIC PROJECT VIEW (no auth required) ──────────────────────────────────
// Allows non-registered users to view a shared project if public_view is enabled
async function handlePublicProjectView(request, shareCode) {
  const db = await getDb();

  // Find project with this share code that has public_view enabled
  const project = await db.collection('projects').findOne({
    'share_link.code': shareCode,
    'share_link.enabled': true,
    'share_link.public_view': true,
  });

  if (!project) return err('Project not found or not publicly shared', 404);

  // Get owner info
  const owner = await db.collection('users').findOne({ id: project.owner_id });

  // Get conversations in this project
  const conversations = await db.collection('conversations')
    .find({ project_id: project.id })
    .sort({ updated_at: -1 })
    .toArray();

  // Get messages for each conversation (limited to most recent for preview)
  const conversationIds = conversations.map(c => c.id);
  const messageCounts = await db.collection('messages').aggregate([
    { $match: { conversation_id: { $in: conversationIds } } },
    { $group: { _id: '$conversation_id', count: { $sum: 1 } } }
  ]).toArray();
  const countMap = Object.fromEntries(messageCounts.map(c => [c._id, c.count]));

  return ok({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      icon: project.icon,
      color: project.color,
      created_at: project.created_at,
      owner_name: owner?.email?.split('@')[0] || 'Unknown',
    },
    conversations: conversations.map(c => ({
      id: c.id,
      title: c.title || 'Untitled',
      message_count: countMap[c.id] || 0,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })),
  });
}

// Get messages for a public project conversation (no auth required)
async function handlePublicConversationMessages(request, shareCode, conversationId) {
  const db = await getDb();

  // Verify the project is public
  const project = await db.collection('projects').findOne({
    'share_link.code': shareCode,
    'share_link.enabled': true,
    'share_link.public_view': true,
  });

  if (!project) return err('Project not found or not publicly shared', 404);

  // Verify the conversation belongs to this project
  const conversation = await db.collection('conversations').findOne({
    id: conversationId,
    project_id: project.id,
  });

  if (!conversation) return err('Conversation not found in this project', 404);

  // Get all messages
  const messages = await db.collection('messages')
    .find({ conversation_id: conversationId })
    .sort({ created_at: 1 })
    .toArray();

  return ok({
    conversation: {
      id: conversation.id,
      title: conversation.title || 'Untitled',
      created_at: conversation.created_at,
    },
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model_used: m.model_used,
      image_url: m.image_url,
      video_url: m.video_url,
      created_at: m.created_at,
    })),
  });
}



// Move conversation to project
async function handleMoveConversationToProject(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { project_id } = await request.json();
  const db = await getDb();

  // Verify conversation ownership or collaboration access
  const conv = await db.collection('conversations').findOne({ id: conversationId });
  if (!conv) return err('Conversation not found', 404);

  // Check if user owns the conversation or has collaborator access to its current project
  const hasAccess = conv.user_id === user.id || 
    (conv.project_id && await db.collection('projects').findOne({
      id: conv.project_id,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id, 'shared_with.role': 'collaborator' }
      ]
    }));

  if (!hasAccess) return err('Not authorized', 403);

  // If moving to a project, verify access to target project
  if (project_id && project_id !== 'general') {
    const targetProject = await db.collection('projects').findOne({
      id: project_id,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    if (!targetProject) return err('Target project not found or not accessible', 404);
  }

  await db.collection('conversations').updateOne(
    { id: conversationId },
    { $set: { project_id: project_id || null, updated_at: new Date() } }
  );

  console.log('[MOVE CONV] Moved conversation', conversationId, 'to project', project_id);

  return ok({ success: true });
}

// Get conversations for a project (with collaboration support)
async function handleGetProjectConversations(request, projectId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Verify access to project
  const project = await db.collection('projects').findOne({
    id: projectId,
    $or: [
      { owner_id: user.id },
      { 'shared_with.user_id': user.id }
    ]
  });

  if (!project) return err('Project not found or not accessible', 404);

  const conversations = await db.collection('conversations')
    .find({ project_id: projectId })
    .sort({ updated_at: -1 })
    .toArray();

  // Get owner info for each conversation
  const ownerIds = [...new Set(conversations.map(c => c.user_id))];
  const owners = await db.collection('users').find({ id: { $in: ownerIds } }).toArray();
  const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.email]));

  return ok(conversations.map(c => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    updated_at: c.updated_at,
    owner_email: ownerMap[c.user_id],
    is_mine: c.user_id === user.id,
  })));
}

// ============================================================
// TAGS
// ============================================================

// Get user's tags
async function handleGetTags(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const tags = await db.collection('tags')
    .find({ user_id: user.id })
    .sort({ name: 1 })
    .toArray();

  return ok(tags);
}

// Create a tag
async function handleCreateTag(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { name, color } = await request.json();
  if (!name) return err('Tag name is required');

  const db = await getDb();

  // Check for duplicate
  const existing = await db.collection('tags').findOne({ 
    user_id: user.id, 
    name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
  });
  if (existing) return err('Tag already exists', 400);

  const tag = {
    id: uuidv4(),
    user_id: user.id,
    name: name.trim(),
    color: color || '#6366f1',
    created_at: new Date(),
  };

  await db.collection('tags').insertOne(tag);
  return ok(tag);
}

// Delete a tag
async function handleDeleteTag(request, tagId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  // Verify ownership
  const tag = await db.collection('tags').findOne({ id: tagId, user_id: user.id });
  if (!tag) return err('Tag not found', 404);

  // Remove tag from all conversations
  await db.collection('conversations').updateMany(
    { user_id: user.id, tags: tagId },
    { $pull: { tags: tagId } }
  );

  await db.collection('tags').deleteOne({ id: tagId });
  return ok({ success: true });
}

// Update conversation tags
async function handleUpdateConversationTags(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { tags } = await request.json();
  const db = await getDb();

  // Verify conversation ownership
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  await db.collection('conversations').updateOne(
    { id: conversationId },
    { $set: { tags: tags || [], updated_at: new Date() } }
  );

  return ok({ success: true });
}

// MESSAGES - Get by conversationId (updated for collaboration)
async function handleGetMessages(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) return err('conversationId required');

  const db = await getDb();
  
  // Get conversation
  const conv = await db.collection('conversations').findOne({ id: conversationId });
  if (!conv) return err('Conversation not found', 404);

  // Check access: own conversation OR conversation is in a shared project
  let hasAccess = conv.user_id === user.id;
  
  if (!hasAccess && conv.project_id) {
    const project = await db.collection('projects').findOne({
      id: conv.project_id,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    hasAccess = !!project;
  }

  if (!hasAccess) return err('Conversation not found', 404);

  const messages = await db.collection('messages')
    .find({ conversation_id: conversationId })
    .sort({ created_at: 1 })
    .toArray();

  // Background: Check for any stuck video tasks and update them
  const kieKey = process.env.KIE_API_KEY;
  if (kieKey) {
    const pendingVideoMessages = messages.filter(m => 
      m.video_task && 
      m.video_task.taskId && 
      m.video_task.status !== 'success' && 
      !m.video_url
    );
    
    // Check up to 3 pending videos per request to avoid slowdown
    for (const msg of pendingVideoMessages.slice(0, 3)) {
      try {
        const taskId = msg.video_task.taskId;
        const jobModel = msg.video_task.model || msg.model_used || 'kling-3.0';
        
        // Map model names to VIDEO_MODELS keys
        let modelKey = jobModel;
        if (jobModel === 'veo3' || jobModel === 'veo-3.1' || jobModel === 'Veo 3.1') modelKey = 'veo3';
        else if (jobModel === 'kling-3.0' || jobModel === 'Kling 3.0') modelKey = 'kling-3.0';
        else if (jobModel === 'runway-aleph' || jobModel === 'Runway Aleph') modelKey = 'runway-aleph';
        
        const result = await checkVideoStatus(modelKey, taskId, kieKey);
        
        if (result.status === 'success' && result.videoUrl) {
          console.log('[Messages] Auto-fixing stuck video:', taskId, '→', result.videoUrl.substring(0, 60));
          // Update message in DB
          await db.collection('messages').updateOne(
            { id: msg.id },
            { $set: { video_url: result.videoUrl, thumbnail_url: result.thumbnailUrl, 'video_task.status': 'success' } }
          );
          // Update video_jobs too
          await db.collection('video_jobs').updateOne(
            { task_id: taskId },
            { $set: { status: 'success', video_url: result.videoUrl, thumbnail_url: result.thumbnailUrl, completed_at: new Date() } }
          );
          // Update in-memory message
          msg.video_url = result.videoUrl;
          msg.thumbnail_url = result.thumbnailUrl;
          msg.video_task.status = 'success';
        }
      } catch (e) {
        // Silently fail - don't block message loading
        console.log('[Messages] Video status check failed for', msg.video_task?.taskId, '-', e.message);
      }
    }
  }

  return ok(messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at,
    model_used: m.model_used,
    model_label: m.model_label,
    sender_id: m.sender_id, // For collaboration - who sent this message
    image_url: m.image_url,
    video_url: m.video_url,
    video_task: m.video_task,
    thumbnail_url: m.thumbnail_url,
    content_type: m.content_type,
    sources: m.sources,
    generation_params: m.generation_params,
    smart_mode: m.smart_mode,
    smart_reason: m.smart_reason,
    is_generating: m.is_generating,
    feedback: m.feedback,
  })));
}


export {
  generateShareCode,
  handleGetProjects,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
  handleShareProject,
  handleUnshareProject,
  handleProjectShareLink,
  handleJoinProject,
  handlePublicProjectView,
  handlePublicConversationMessages,
  handleMoveConversationToProject,
  handleGetProjectConversations,
  handleGetTags,
  handleCreateTag,
  handleDeleteTag,
  handleUpdateConversationTags,
  handleGetMessages,
};
