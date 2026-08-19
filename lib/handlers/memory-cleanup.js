// Memory Cleanup — AI-assisted dedupe + contradiction/outdated detection.
//
// Free for ALL users (no tier gate): memory hygiene is a trust feature, not a
// premium perk. Two detection layers:
//   1. Heuristic duplicate grouping — fast, deterministic (token Jaccard within
//      category), catches exact / near-exact repeats for free.
//   2. LLM pass (gpt-4o-mini) — catches semantic duplicates the heuristic misses,
//      plus contradictions and clearly outdated/wrong memories, chunked by category.
//
// Returns structured "suggestions" the UI renders for one-click approve/dismiss.

import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { getProvider } from '@/lib/llm/providers';

const MEMORY_CATEGORIES = ['health', 'preferences', 'personal', 'work', 'family', 'travel', 'hobbies', 'goals', 'other'];
const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 };

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was',
  'our', 'out', 'has', 'had', 'have', 'his', 'how', 'its', 'may', 'off', 'one', 'she',
  'who', 'why', 'with', 'from', 'this', 'that', 'they', 'them', 'then', 'than', 'into',
  'about', 'been', 'being', 'does', 'did', 'doing', 'will', 'would', 'could', 'should',
  'their', 'there', 'what', 'when', 'where', 'which', 'while', 'very', 'just', 'also',
  'really', 'some', 'such', 'only', 'over', 'under', 'after', 'before', 'because',
  'i', 'me', 'my', 'we', 'us', 'am', 'is', 'it', 'a', 'an', 'to', 'of', 'in', 'on',
  'at', 'by', 'as', 'or', 'if', 'so', 'be', 'do',
]);

// ── Text helpers ──────────────────────────────────────────────────────────────
function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s) {
  return new Set(normalize(s).split(' ').filter((t) => t.length > 2 && !STOPWORDS.has(t)));
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ── Heuristic duplicate grouping (union-find) ─────────────────────────────────
function findDuplicateGroups(memories) {
  const byCategory = new Map();
  for (const m of memories) {
    const cat = MEMORY_CATEGORIES.includes(m.category) ? m.category : 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(m);
  }

  const parent = new Map(memories.map((m) => [m.id, m.id]));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (x, y) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  for (const list of byCategory.values()) {
    const toks = list.map((m) => tokenize(m.content));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = normalize(list[i].content);
        const b = normalize(list[j].content);
        const isSubstring = (a.length > 8 && (a.includes(b) || b.includes(a)));
        const sim = jaccard(toks[i], toks[j]);
        if (sim >= 0.7 || isSubstring) union(list[i].id, list[j].id);
      }
    }
  }

  const groups = new Map();
  for (const m of memories) {
    const root = find(m.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(m);
  }

  return [...groups.values()].filter((g) => g.length > 1);
}

function pickKeep(memories) {
  // Keep highest importance, then longest content, then oldest.
  return [...memories].sort((a, b) => {
    const ia = IMPORTANCE_ORDER[a.importance] ?? 1;
    const ib = IMPORTANCE_ORDER[b.importance] ?? 1;
    if (ia !== ib) return ia - ib;
    if ((b.content?.length || 0) !== (a.content?.length || 0)) return (b.content?.length || 0) - (a.content?.length || 0);
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  })[0];
}

// ── LLM pass: semantic duplicates + contradictions + outdated ────────────────
const SCAN_SYSTEM = 'You are a memory-hygiene assistant. You review a user\'s saved facts and flag only genuine problems. Return ONLY valid JSON — no prose, no markdown fences.';

function buildScanPrompt(rows) {
  const listing = rows.map((r) => `${r.id} | ${r.content}`).join('\n');
  return `Review these saved memories and flag problems.

Find:
1. DUPLICATES — 2+ memories that state the same fact (same or different wording).
2. CONTRADICTIONS — 2+ memories that conflict (e.g. one says "lives in Phoenix", another says "moved to Chicago").
3. OUTDATED — a memory clearly stale or superseded by another (e.g. "currently works at X" when a later one says "left X").

Return ONLY a JSON array of objects, each shaped:
{"type":"duplicate"|"contradiction"|"outdated","ids":["id1","id2"],"keep":"id1","reason":"short explanation"}

Rules:
- "keep" = the id that should be kept (for duplicate/contradiction); OMIT it for "outdated".
- Only flag REAL problems. When unsure, skip.
- If nothing to flag, return [].

MEMORIES (id | content):
${listing}`;
}

function parseJsonArray(text) {
  if (!text || typeof text !== 'string') return [];
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function llmScan(memories) {
  const provider = getProvider('openai', 'gpt-4o-mini');

  // Chunk by category (contradictions/duplicates almost always live in the same
  // category), then further split very large categories.
  const byCategory = new Map();
  for (const m of memories) {
    const cat = MEMORY_CATEGORIES.includes(m.category) ? m.category : 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(m);
  }

  const chunks = [];
  for (const list of byCategory.values()) {
    for (let i = 0; i < list.length; i += 220) {
      chunks.push(list.slice(i, i + 220));
    }
  }

  const flags = [];
  const results = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const rows = chunk.map((m) => ({ id: m.id, content: m.content }));
      const raw = await provider.generateChatCompletion({
        systemPrompt: SCAN_SYSTEM,
        messages: [{ role: 'user', content: buildScanPrompt(rows) }],
        temperature: 0,
      });
      return parseJsonArray(raw);
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') flags.push(...r.value);
  }
  return flags;
}

// ── Build suggestions ─────────────────────────────────────────────────────────
function memoryMap(memories) {
  const map = new Map(memories.map((m) => [m.id, m]));
  return map;
}

function toSuggestion(type, ids, reason, keepId, byId) {
  const memories = ids.map((id) => byId.get(id)).filter(Boolean);
  if (memories.length === 0) return null;
  const keep = keepId && byId.has(keepId) ? keepId : (type === 'stale' ? null : pickKeep(memories).id);
  const titles = {
    duplicate: `${memories.length} memories say the same thing`,
    contradiction: 'These memories contradict each other',
    stale: 'This memory may be outdated or wrong',
  };
  return {
    id: `${type}_${ids.slice().sort().join('_').slice(0, 48)}`,
    type,
    title: titles[type] || 'Review these memories',
    reason: reason || '',
    keep_id: keep,
    memories: memories.map((m) => ({
      id: m.id,
      content: m.content,
      category: m.category,
      importance: m.importance,
      created_at: m.created_at,
    })),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function handleMemoryCleanupScan(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const memories = await db.collection('user_memories').find({ user_id: user.id }).toArray();

  if (memories.length === 0) {
    return ok({ total: 0, suggestions: [] });
  }

  // 1) Heuristic duplicates (fast baseline)
  const dupGroups = findDuplicateGroups(memories);
  const suggestions = dupGroups.map((g) =>
    toSuggestion('duplicate', g.map((m) => m.id), 'These memories say the same thing.', pickKeep(g).id, memoryMap(memories))
  ).filter(Boolean);

  // 2) LLM pass (semantic dups + contradictions + outdated)
  let llmFlags = [];
  try {
    llmFlags = await llmScan(memories);
  } catch (e) {
    console.error('[MemoryCleanup] LLM scan failed:', e.message);
  }

  const seenIds = new Set(suggestions.map((s) => s.memories.map((m) => m.id).sort().join(',')));
  const byId = memoryMap(memories);
  for (const flag of llmFlags) {
    const type = flag.type === 'outdated' ? 'stale' : (flag.type === 'contradiction' ? 'contradiction' : 'duplicate');
    const ids = Array.isArray(flag.ids) ? flag.ids.filter((id) => byId.has(id)) : [];
    if (ids.length === 0) continue;
    const key = ids.slice().sort().join(',');
    if (seenIds.has(key)) continue; // already flagged heuristically
    const sug = toSuggestion(type, ids, flag.reason || '', flag.keep || null, byId);
    if (sug) {
      seenIds.add(key);
      suggestions.push(sug);
    }
  }

  // Order: duplicates first, then contradictions, then stale
  const order = { duplicate: 0, contradiction: 1, stale: 2 };
  suggestions.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));

  return ok({
    total: memories.length,
    scanned: memories.length,
    suggestions,
    scanned_with_ai: llmFlags.length > 0,
  });
}
