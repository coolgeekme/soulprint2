// Faithful JS port of the SoulPrint memory-matching engine.
//
// This mirrors the Chrome extension's local engine
// (soulprint-extension/src/shared/memory-engine.js) and the Python MCP port
// (soulprint-mcp/src/soulprint_mcp/server.py) so the hosted MCP recalls the
// SAME memories and injects the SAME framed context both other surfaces do.
//
// Change one, port the change to the others — they've diverged before and only
// the extension broke.

export const MAX_MEMORIES = 8;        // extension matchMemories default maxMemories
export const MAX_CONTEXT_CHARS = 600; // extension buildContext maxChars

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'where', 'when', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'about',
  'also', 'but', 'and', 'or', 'if', 'because', 'as', 'until',
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below',
  'to', 'from', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there',
]);

const IMPORTANCE_WEIGHT = { high: 12, medium: 6, low: 2 };

const SYNONYMS = {
  boss: ['manager', 'director', 'supervisor', 'vp', 'ceo', 'lead', 'head', 'chief', 'president', 'owner', 'executive'],
  manager: ['boss', 'director', 'supervisor', 'vp', 'lead', 'head', 'executive'],
  vp: ['boss', 'manager', 'director', 'executive', 'head', 'lead', 'chief'],
  colleague: ['coworker', 'teammate', 'peer', 'partner'],
  team: ['group', 'department', 'division', 'staff', 'crew'],
  client: ['customer', 'account', 'partner', 'stakeholder'],
  email: ['message', 'note', 'memo', 'draft', 'compose', 'write', 'send', 'mail'],
  meeting: ['call', 'session', 'appointment', 'sync', 'discussion', 'chat', 'conference'],
  schedule: ['book', 'arrange', 'plan', 'set', 'calendar', 'meeting', 'appointment'],
  report: ['analysis', 'review', 'summary', 'brief', 'update', 'document'],
  project: ['initiative', 'effort', 'work', 'task', 'assignment'],
  deadline: ['due', 'timeline', 'date', 'target', 'milestone'],
  budget: ['cost', 'spend', 'expense', 'price', 'funding'],
  formal: ['professional', 'business', 'official', 'proper', 'polished'],
  casual: ['informal', 'relaxed', 'friendly', 'conversational', 'chatty'],
  brief: ['short', 'concise', 'quick', 'compact', 'summary'],
};

const TOKEN_RE = /[\s.,!?;:'"()[\]{}]+/;
const NAME_RE = /\b([A-Z][a-z]+)\s([A-Z][a-z]+)\b/g;
const SINGLE_NAME_RE = /\b([A-Z][a-z]{2,})\b/g;
const URL_RE = /\b([a-zA-Z0-9-]+\.(?:com|ai|io|co|app|dev|me|org))\b/g;
const DATE_RE = /\b(Q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

function tokenize(text) {
  return text.toLowerCase().split(TOKEN_RE).filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function extractEntities(text) {
  const entities = [];
  for (const m of text.matchAll(NAME_RE)) entities.push(m[0].toLowerCase());
  for (const m of text.matchAll(SINGLE_NAME_RE)) entities.push(m[1].toLowerCase());
  for (const m of text.matchAll(URL_RE)) entities.push(m[1].toLowerCase());
  for (const m of text.matchAll(DATE_RE)) entities.push(m[0].toLowerCase());
  return [...new Set(entities)];
}

function expandSynonyms(words) {
  const expanded = new Set(words);
  for (const w of words) {
    for (const s of SYNONYMS[w] || []) expanded.add(s);
  }
  return [...expanded];
}

function daysAgo(created) {
  try {
    if (created instanceof Date) return (Date.now() - created.getTime()) / 86400000;
    if (typeof created === 'number') {
      let ts = created;
      if (ts > 1e12) ts /= 1000; // milliseconds epoch
      return (Date.now() - ts * 1000) / 86400000;
    }
    const s = String(created).trim();
    if (!s) return Infinity;
    const iso = s.endsWith('Z') ? s.slice(0, -1) + '+00:00' : s;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return Infinity;
    return (Date.now() - dt.getTime()) / 86400000;
  } catch {
    return Infinity;
  }
}

export function matchMemories(prompt, memories, maxMemories = MAX_MEMORIES) {
  if (!prompt || !memories || !memories.length) return [];

  const promptLower = prompt.toLowerCase();
  const promptWords = tokenize(promptLower);
  const promptEntities = extractEntities(prompt); // original case — name regexes match [A-Z]

  const scored = [];
  for (const memory of memories) {
    const content = memory.content || '';
    const memoryText = content.toLowerCase();
    const memoryWords = tokenize(memoryText);
    const memoryEntities = extractEntities(content); // original case

    const expandedPrompt = expandSynonyms(promptWords);
    const expandedMemory = expandSynonyms(memoryWords);
    const expandedMemorySet = new Set(expandedMemory);
    const intersection = expandedPrompt.filter((w) => expandedMemorySet.has(w));
    const union = new Set([...expandedPrompt, ...expandedMemory]);
    const wordScore = union.size ? intersection.length / union.size : 0;

    const entitySet = new Set(memoryEntities);
    const entityOverlap = promptEntities.filter((e) => entitySet.has(e)).length;
    const entityBonus = entityOverlap * 0.25;

    const substringBonus = memoryText.includes(promptLower) || promptLower.includes(memoryText) ? 0.35 : 0;

    const importance = (memory.importance || 'medium').toLowerCase();
    const importanceBoost = (IMPORTANCE_WEIGHT[importance] ?? 6) / 100;

    const created = memory.created_at || memory.createdAt;
    const days = created ? daysAgo(created) : Infinity;
    const recencyBoost = days < 30 ? 0.15 : days < 90 ? 0.07 : 0;

    const score = wordScore + entityBonus + substringBonus + importanceBoost + recencyBoost;
    scored.push({ memory, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxMemories);
}

export function cleanMatches(matches) {
  return matches.map((m) => ({
    content: (m.memory || {}).content,
    id: (m.memory || {}).id,
    category: (m.memory || {}).category,
    importance: (m.memory || {}).importance,
    score: Math.round(m.score * 1000) / 1000,
  }));
}

export function buildProfileLine(profile) {
  if (!profile) return null;
  const basic = profile.basicProfile || {};
  const soul = profile.soulProfile || {};
  const comm = profile.communicationProfile;
  const snapshot = profile.soulprintSnapshot;

  const parts = [];

  const displayName = basic.displayName;
  if (displayName && displayName !== 'User') {
    parts.push(`You are speaking with ${displayName}.`);
  }

  const descriptors = basic.descriptors || [];
  if (descriptors.length) {
    parts.push(`They describe themselves as: ${descriptors.join(', ')}.`);
  }

  const soulSummary = basic.soulProfileSummary;
  if (soulSummary && typeof soulSummary === 'string' && soulSummary.trim()) {
    parts.push(`Their SoulPrint: ${soulSummary.trim()}`);
  }

  if (snapshot) {
    const snapSummary = snapshot.summary;
    if (snapSummary && typeof snapSummary === 'string' && snapSummary.trim()) {
      parts.push(`SoulPrint snapshot: ${snapSummary.trim()}`);
    }
    const cs = snapshot.communication_style;
    if (cs && typeof cs === 'string' && cs.trim()) {
      parts.push(`Communication style: ${cs.trim()}`);
    }
    if (snapshot.interests) {
      parts.push(`Interests: ${snapshot.interests.join(', ')}.`);
    }
  }

  if (comm) {
    const traits = [];
    if (comm.directness != null) traits.push(`directness ${comm.directness}/100`);
    if (comm.emotional_warmth != null) traits.push(`warmth ${comm.emotional_warmth}/100`);
    if (comm.information_density != null) traits.push(`detail ${comm.information_density}/100`);
    if (comm.proactivity != null) traits.push(`proactivity ${comm.proactivity}/100`);
    if (traits.length) parts.push(`Communication traits: ${traits.join(', ')}.`);
  }

  if (soul && typeof soul === 'object') {
    const commStyle = soul.communicationStyle || soul.communication_style;
    if (commStyle && typeof commStyle === 'object') {
      const styles = [];
      for (const [source, style] of Object.entries(commStyle)) {
        if (!style || typeof style !== 'object') continue;
        const bits = [style.formality, style.verbosity, style.tone].filter(Boolean);
        if (bits.length) styles.push(`${source}: ${bits.join(', ')}`);
      }
      if (styles.length) parts.push(`Communication style: ${styles.join('; ')}.`);
    }
    if (soul.interests) parts.push(`Interests: ${soul.interests.join(', ')}.`);
    if (soul.values) parts.push(`Values: ${soul.values.join(', ')}.`);
  }

  return parts.length ? parts.join(' ') : null;
}

export function buildContext(matches, profile, maxChars = MAX_CONTEXT_CHARS) {
  const parts = [];
  if (profile) {
    const line = buildProfileLine(profile);
    if (line) parts.push(line);
  }
  if (matches && matches.length) {
    const facts = matches
      .map((m) => (m.memory || {}).content)
      .filter(Boolean)
      .join('. ');
    if (facts.trim()) parts.push(`Use these facts about me when answering: ${facts}.`);
  }
  if (!parts.length) return null;

  const context = parts.join('\n');
  if (context.length <= maxChars) return context;
  return context.slice(0, maxChars - 3) + '...';
}

const LEADING_FACTS_RE = /^Use these facts about me when answering:\s*/;

export function claudeFrame(context) {
  return `[Authoritative context about the user: ${context.replace(LEADING_FACTS_RE, '')}]`;
}
