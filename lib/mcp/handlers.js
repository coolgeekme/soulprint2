// SoulPrint MCP tool handlers — run against the resolved user (not a raw request).
// Each handler mirrors the corresponding REST handler in lib/handlers/* so the
// hosted MCP returns the SAME data the API and the stdio soulprint-mcp server do.
// Keep the DB logic here in sync with those handlers.

import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { invalidateSystemPromptCache } from '@/lib/handlers/chat-cache';
import { getActiveImprint, seedImprints, getImprintAccess } from '@/lib/handlers/imprints';
import { resolveActiveImprintContext } from '@/lib/handlers/imprint-context';
import {
  matchMemories,
  cleanMatches,
  buildContext,
  claudeFrame,
  MAX_MEMORIES,
  MAX_CONTEXT_CHARS,
} from './memory-engine';

const MEMORY_CATEGORIES = ['health', 'preferences', 'personal', 'work', 'relationships', 'goals', 'other'];

// ── Profile ─────────────────────────────────────────────────────────────
// Mirrors handleGetSoulProfile (app/api/user/[...path]/route.js) + the Python
// get_profile mapping (camelCase, extension-shaped).
export async function getProfile(db, user) {
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
  const assessmentAnswers = await db.collection('assessment_answers').find({ user_id: user.id }).toArray();
  const memoryCount = await db.collection('user_memories').countDocuments({ user_id: user.id });
  const latestSnapshot = await db.collection('soulprint_snapshots').findOne(
    { user_id: user.id },
    { sort: { created_at: -1 } },
  );
  const commProfile = await db.collection('communication_profiles').findOne({ user_id: user.id });

  // Values/interests live in soulprint_snapshots, not soul_profiles.insights.
  const insights = soulProfile?.insights ? { ...soulProfile.insights } : {};
  if (latestSnapshot?.values != null) insights.values = latestSnapshot.values;
  if (latestSnapshot?.interests != null) insights.interests = latestSnapshot.interests;
  const hasInsights = Object.keys(insights).length > 0;

  return {
    basicProfile: {
      displayName: profile?.display_name,
      assistantName: profile?.assistant_name,
      descriptors: profile?.descriptors || [],
      field: profile?.field,
      helpWith: profile?.help_with || [],
      soulProfileSummary: profile?.soul_profile_summary,
      defaultModel: profile?.default_model || null,
    },
    soulProfile: hasInsights ? insights : null,
    communicationProfile: commProfile
      ? {
          directness: commProfile.directness,
          emotional_warmth: commProfile.emotional_warmth,
          information_density: commProfile.information_density,
          proactivity: commProfile.proactivity,
        }
      : null,
    soulprintSnapshot: latestSnapshot
      ? {
          summary: latestSnapshot.summary,
          communication_style: latestSnapshot.communication_style,
          interests: latestSnapshot.interests,
        }
      : null,
    memory_count: memoryCount,
    assessment_answers: assessmentAnswers.length,
  };
}

// ── Memories ────────────────────────────────────────────────────────────
export async function getMemories(db, user, query = '', limit = MAX_MEMORIES) {
  const all = await db.collection('user_memories').find({ user_id: user.id }).sort({ created_at: -1 }).toArray();
  if (!all.length) return { memories: [], count: 0, total: 0 };
  const matches = matchMemories(query, all, limit);
  return { memories: cleanMatches(matches), count: matches.length, total: all.length };
}

export async function getContext(db, user, query = '') {
  const profile = await getProfile(db, user);
  const all = await db.collection('user_memories').find({ user_id: user.id }).sort({ created_at: -1 }).toArray();
  const matches = matchMemories(query, all, MAX_MEMORIES);
  const raw = buildContext(matches, profile, MAX_CONTEXT_CHARS);
  const framed = raw ? claudeFrame(raw) : null;

  let activeImprint = null;
  try {
    activeImprint = await getActiveImprint(user.id);
  } catch {
    activeImprint = null;
  }

  return {
    context: framed,
    profile,
    memories: cleanMatches(matches),
    active_imprint: activeImprint,
  };
}

export async function addMemory(db, user, { content, category, importance }) {
  if (!content || content.trim().length < 3) {
    throw new Error('Memory content is required (at least 3 characters)');
  }
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
  return { success: true, memory };
}

export async function updateMemory(db, user, { memory_id, content, category, importance }) {
  const memory = await db.collection('user_memories').findOne({ id: memory_id, user_id: user.id });
  if (!memory) throw new Error('Memory not found');

  const updates = { updated_at: new Date() };
  if (content !== undefined) updates.content = content.trim();
  if (category !== undefined && MEMORY_CATEGORIES.includes(category)) updates.category = category;
  if (importance !== undefined && ['high', 'medium', 'low'].includes(importance)) updates.importance = importance;

  await db.collection('user_memories').updateOne({ id: memory_id }, { $set: updates });
  invalidateSystemPromptCache(user.id);
  return { success: true };
}

export async function deleteMemory(db, user, { memory_id }) {
  const memory = await db.collection('user_memories').findOne({ id: memory_id, user_id: user.id });
  if (!memory) throw new Error('Memory not found');

  // Location memories also clear user_locations so stale location data doesn't persist.
  const locationKeywords = /\b(location|located in|lives in|based in|currently in|moved to|residing|city|state|country|address|zip code)\b/i;
  if (locationKeywords.test(memory.content)) {
    await db.collection('user_locations').deleteMany({ user_id: user.id });
  }

  await db.collection('user_memories').deleteOne({ id: memory_id });
  invalidateSystemPromptCache(user.id);
  return { success: true };
}

// ── Imprints ────────────────────────────────────────────────────────────
export async function listImprints(db, user) {
  await seedImprints();

  // Installed imprints (active) + their full imprint docs.
  const installations = await db.collection('user_imprints').find({ user_id: user.id, is_active: true }).toArray();
  const imprintIds = installations.map((i) => i.imprint_id);
  const imprints = await db.collection('imprints').find({ id: { $in: imprintIds } }).toArray();
  const imprintMap = {};
  imprints.forEach((imp) => { imprintMap[imp.id] = imp; });

  const result = installations.map((inst) => ({ ...inst, imprint: imprintMap[inst.imprint_id] || null }));
  const defaultImprint = result.find((r) => r.usage_type === 'default');
  let projectImprints = result.filter((r) => r.usage_type === 'project');

  const projectIds = [...new Set(projectImprints.map((p) => p.project_id).filter(Boolean))];
  if (projectIds.length) {
    const projectDocs = await db.collection('projects').find({ id: { $in: projectIds } }).project({ id: 1, name: 1 }).toArray();
    const names = Object.fromEntries(projectDocs.map((p) => [p.id, p.name]));
    projectImprints = projectImprints.map((p) => ({
      ...p,
      project_name: p.project_id ? (names[p.project_id] || null) : null,
    }));
  }

  const activeImprint = resolveActiveImprintContext({ defaultImprint, projectImprints, projectId: null });

  const createdImprints = await db.collection('imprints').find({ creator_id: user.id }).sort({ created_at: -1 }).toArray();
  const activeImprintIds = new Set(imprintIds);
  const createdWithStatus = createdImprints.map((imp) => ({
    ...imp,
    is_currently_active: activeImprintIds.has(imp.id),
    active_as: installations.find((inst) => inst.imprint_id === imp.id)?.usage_type || null,
  }));

  // Marketplace catalog (system_prompt stripped from list view).
  const catalog = await db.collection('imprints')
    .find({ is_public: true })
    .sort({ install_count: -1 })
    .limit(50)
    .project({ 'instructions.system_prompt': 0 })
    .toArray();

  return {
    active_imprint: activeImprint,
    default_imprint: defaultImprint || null,
    project_imprints: projectImprints,
    created_imprints: createdWithStatus,
    catalog,
  };
}

export async function setImprint(db, user, { imprint_id, usage_type = 'default', project_id = null }) {
  if (!imprint_id || !usage_type) throw new Error('imprint_id and usage_type are required');
  if (!['default', 'project'].includes(usage_type)) throw new Error('usage_type must be "default" or "project"');
  if (usage_type === 'project' && !project_id) throw new Error('project_id is required for project imprints');

  const imprint = await db.collection('imprints').findOne({ id: imprint_id });
  if (!imprint) throw new Error('Imprint not found');

  const access = await getImprintAccess(user);
  if (!access.access) {
    throw new Error('Imprint installation requires a Pro or Team subscription');
  }
  if (imprint.is_official !== true && !access.custom) {
    throw new Error('Custom imprint installation requires a Pro or Team subscription');
  }

  if (usage_type === 'default') {
    await db.collection('user_imprints').updateMany(
      { user_id: user.id, usage_type: 'default' },
      { $set: { is_active: false, deactivated_at: new Date() } },
    );
  }

  if (usage_type === 'project' && project_id) {
    const project = await db.collection('projects').findOne({
      $or: [
        { id: project_id, owner_id: user.id },
        { id: project_id, 'shared_with.user_id': user.id },
      ],
    });
    if (!project) throw new Error('Project not found or access denied');
    await db.collection('user_imprints').updateMany(
      { user_id: user.id, usage_type: 'project', project_id },
      { $set: { is_active: false, deactivated_at: new Date() } },
    );
  }

  const installId = uuidv4();
  await db.collection('user_imprints').insertOne({
    id: installId,
    user_id: user.id,
    imprint_id,
    usage_type,
    project_id: project_id || null,
    is_active: true,
    installed_at: new Date(),
  });
  await db.collection('imprints').updateOne({ id: imprint_id }, { $inc: { install_count: 1 } });

  return {
    success: true,
    installation_id: installId,
    imprint_id,
    imprint_name: imprint.name,
    usage_type,
    project_id: project_id || null,
  };
}

// ── Dispatch ────────────────────────────────────────────────────────────
export async function handleMcpTool(db, user, name, args = {}) {
  switch (name) {
    case 'soulprint_get_profile':
      return getProfile(db, user);
    case 'soulprint_get_memories':
      return getMemories(db, user, args.query || '', args.limit || MAX_MEMORIES);
    case 'soulprint_get_context':
      return getContext(db, user, args.query || '');
    case 'soulprint_list_imprints':
      return listImprints(db, user);
    case 'soulprint_set_imprint':
      return setImprint(db, user, args);
    case 'soulprint_add_memory':
      return addMemory(db, user, args);
    case 'soulprint_update_memory':
      return updateMemory(db, user, args);
    case 'soulprint_delete_memory':
      return deleteMemory(db, user, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
