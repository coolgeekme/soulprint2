/**
 * Long-Term Memory System — extraction, storage, retrieval
 * Extracted from route.js for maintainability.
 */
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';
import { getProvider } from '@/lib/llm/providers';
import { writeFile, mkdir } from 'fs/promises';
import { generateAdaptivePrompt } from '@/lib/handlers/assessment-data';
import { buildConversionContext } from '@/lib/handlers/conversion-intelligence';
import { buildSMBProContext } from '@/lib/handlers/smb-detection';

// LONG-TERM MEMORY SYSTEM
// ============================================================

// Memory categories
const MEMORY_CATEGORIES = ['health', 'preferences', 'personal', 'work', 'relationships', 'goals', 'other'];

// Extract memories from a conversation message using AI
async function extractMemoriesFromMessage(userMessage, assistantResponse, userId) {
  try {
    const provider = getProvider('openai', 'gpt-4o-mini');
    
    const extractionPrompt = `Analyze this conversation exchange and extract any important facts about the user that should be remembered for future conversations.

USER MESSAGE:
${userMessage}

ASSISTANT RESPONSE:
${assistantResponse}

Extract ONLY concrete, factual information that would be valuable to remember, such as:
- Health information (allergies, conditions, medications)
- Personal preferences (favorite foods, colors, activities)
- Important dates (birthdays, anniversaries)
- Family/relationship info (spouse name, children, pets)
- Work/career details (job title, company, projects)
- Goals and aspirations
- Dislikes and things to avoid
- Location/living situation

Return a JSON array of memories. Each memory should have:
- "content": The fact to remember (be specific and concise)
- "category": One of: health, preferences, personal, work, relationships, goals, other
- "importance": "high" (health/safety), "medium" (useful context), or "low" (nice to know)

If no important facts are found, return an empty array: []

CRITICAL RULES: 
- Only extract NEW facts, not general conversation
- Be specific: "allergic to peanuts" not "has food allergies"
- Don't extract opinions or temporary states
- **LIST EACH PERSON/ITEM SEPARATELY** — if user mentions 4 children, create 4 separate memory entries (one per child with their name), PLUS one summary entry like "Has 4 children"
- **PRESERVE EXACT COUNTS** — if user says "I have 4 kids", extract "User has 4 children" as a fact
- **NEVER merge distinct facts** into one vague entry
- Return ONLY valid JSON array, nothing else

🚨 **CRITICAL: DO NOT EXTRACT THESE AS MEMORIES** 🚨
- ❌ NEVER extract statements about what is NOT known: "X's birthday is not stored", "I don't have information about Y", "Z is not in memory"
- ❌ NEVER extract the assistant's own statements about missing information
- ❌ NEVER extract negative statements: "doesn't have", "is not stored", "not in memory", "I don't know"
- ❌ NEVER extract the assistant's acknowledgments of limitations
- ✅ ONLY extract POSITIVE FACTS stated by the USER: "My son Diego was born on September 22, 2013"

**Examples of what NOT to extract:**
- ❌ "Diego's birthday is not stored in memory" (This is a statement about missing info, NOT a fact)
- ❌ "The user didn't mention their job" (This is about what's missing, NOT a fact)
- ❌ "I don't have information about their spouse" (This is a limitation, NOT a fact)

**Examples of what TO extract:**
- ✅ "Son Diego born September 22, 2013" (This is a concrete fact from the user)
- ✅ "Works as CTO at TechCorp" (This is a concrete fact from the user)
- ✅ "Allergic to peanuts" (This is a concrete fact from the user)`;

    const response = await provider.generateChatCompletion({
      systemPrompt: 'You are a memory extraction system. Return only valid JSON arrays.',
      messages: [{ role: 'user', content: extractionPrompt }],
      model: 'gpt-4o-mini',
      temperature: 0.1,
    });

    // Parse the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    const memories = JSON.parse(jsonMatch[0]);
    return Array.isArray(memories) ? memories : [];
  } catch (e) {
    console.error('Memory extraction error:', e);
    return [];
  }
}

// Save extracted memories to database
async function saveExtractedMemories(db, userId, memories, conversationId = null) {
  if (!memories || memories.length === 0) return [];
  
  const savedMemories = [];
  
  for (const mem of memories) {
    if (!mem.content || mem.content.length < 5) continue;
    
    // 🚨 CRITICAL: Block negative/missing-info statements
    const content = mem.content.toLowerCase();
    const negativePatterns = [
      /\bis not stored\b/i,
      /\bnot in memory\b/i,
      /\bdon'?t have (?:information|data|details|memory)\b/i,
      /\bis not (?:known|available|recorded)\b/i,
      /\bno (?:information|data|details|memory)\b/i,
      /\bdidn'?t mention\b/i,
      /\bunknown\b.*\b(?:birthday|name|date)\b/i,
    ];
    
    const isNegativeStatement = negativePatterns.some(pattern => pattern.test(content));
    if (isNegativeStatement) {
      console.log(`❌ [Memory] Blocked negative statement: "${mem.content}"`);
      continue; // Skip this memory
    }
    
    // Check for duplicate or very similar memories
    // Use a more targeted check — match full content (case-insensitive) to avoid
    // incorrectly skipping distinct entries like different children's names
    const existing = await db.collection('user_memories').findOne({
      user_id: userId,
      content: { $regex: `^${mem.content.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });
    
    if (existing) {
      console.log(`Skipping duplicate memory: ${mem.content}`);
      continue;
    }
    
    const memory = {
      id: uuidv4(),
      user_id: userId,
      content: mem.content.trim(),
      category: MEMORY_CATEGORIES.includes(mem.category) ? mem.category : 'other',
      importance: ['high', 'medium', 'low'].includes(mem.importance) ? mem.importance : 'medium',
      source: 'auto',
      source_conversation_id: conversationId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    await db.collection('user_memories').insertOne(memory);
    savedMemories.push(memory);
    console.log(`Saved memory: ${memory.content}`);
  }
  
  // Invalidate system prompt cache since memories changed
  if (savedMemories.length > 0) {
    invalidateSystemPromptCache(userId);
  }
  
  return savedMemories;
}

// Get user memories for system prompt with semantic relevance
async function getUserMemoriesForPrompt(db, userId, currentContext = '') {
  const allMemories = await db.collection('user_memories')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
  
  if (allMemories.length === 0) return [];
  
  // If no context provided, return top 100 by importance + recency (fallback)
  if (!currentContext || currentContext.trim().length < 10) {
    const topMemories = allMemories.slice(0, 100);
    const importanceOrder = { high: 0, medium: 1, low: 2 };
    topMemories.sort((a, b) => (importanceOrder[a.importance] || 2) - (importanceOrder[b.importance] || 2));
    return topMemories;
  }
  
  // Smart Retrieval: Score memories by relevance to current context
  const contextLower = currentContext.toLowerCase();
  const contextWords = new Set(
    contextLower
      .split(/\W+/)
      .filter(w => w.length > 3) // Ignore short words
      .filter(w => !['that', 'this', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'have', 'with', 'from', 'they', 'there', 'their'].includes(w)) // Common words
  );
  
  // Score each memory
  const scoredMemories = allMemories.map(mem => {
    const memLower = mem.content.toLowerCase();
    const memWords = memLower.split(/\W+/).filter(w => w.length > 3);
    
    let score = 0;
    
    // 1. Keyword overlap scoring
    let matchCount = 0;
    for (const word of contextWords) {
      if (memLower.includes(word)) {
        matchCount++;
        score += 3; // Keyword match
      }
    }
    
    // 2. Category relevance bonus
    // If context mentions health/medical terms, boost health memories
    const healthKeywords = ['health', 'allergy', 'allergic', 'medical', 'doctor', 'medicine', 'condition', 'sick', 'pain'];
    const familyKeywords = ['family', 'child', 'children', 'kid', 'kids', 'son', 'daughter', 'wife', 'husband', 'spouse', 'parent'];
    const workKeywords = ['work', 'job', 'career', 'project', 'meeting', 'office', 'colleague', 'boss', 'client'];
    const preferenceKeywords = ['prefer', 'like', 'love', 'hate', 'favorite', 'favourite', 'enjoy'];
    
    if (mem.category === 'health' && healthKeywords.some(k => contextLower.includes(k))) score += 5;
    if (mem.category === 'relationships' && familyKeywords.some(k => contextLower.includes(k))) score += 5;
    if (mem.category === 'work' && workKeywords.some(k => contextLower.includes(k))) score += 5;
    if (mem.category === 'preferences' && preferenceKeywords.some(k => contextLower.includes(k))) score += 5;
    
    // 3. Importance weighting
    const importanceBoost = { high: 10, medium: 5, low: 2 };
    score += importanceBoost[mem.importance] || 0;
    
    // 4. Recency bonus (memories from last 30 days get a small boost)
    const daysSinceCreated = (Date.now() - new Date(mem.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 30) score += 3;
    else if (daysSinceCreated < 90) score += 1;
    
    // 5. Direct name/entity matching (high value)
    // Extract potential names (capitalized words)
    const contextNames = contextLower.match(/\b[A-Z][a-z]+\b/g) || [];
    for (const name of contextNames) {
      if (memLower.includes(name.toLowerCase())) {
        score += 8; // Strong match for names
      }
    }
    
    return { ...mem, relevanceScore: score, matchCount };
  });
  
  // Sort by relevance score (desc)
  scoredMemories.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Return top 100 most relevant
  // Include all memories with score > 0 (some relevance), up to 100
  const relevant = scoredMemories.filter(m => m.relevanceScore > 0).slice(0, 100);
  
  // If we have fewer than 20 relevant memories, pad with high-importance memories
  if (relevant.length < 20) {
    const highImportance = scoredMemories
      .filter(m => m.importance === 'high' && !relevant.find(r => r.id === m.id))
      .slice(0, 20 - relevant.length);
    relevant.push(...highImportance);
  }
  
  console.log(`[Memory] Smart retrieval: ${relevant.length} relevant memories (from ${allMemories.length} total)`);
  
  return relevant;
}

// API Handlers for Memory Management

// GET /api/memories - Get all user memories
async function handleGetMemories(request) {
  console.log('[API] handleGetMemories called');
  const user = await authenticate(request);
  console.log('[API] handleGetMemories auth result:', user ? `user=${user.id} email=${user.email}` : 'null');
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  
  const query = { user_id: user.id };
  if (category && MEMORY_CATEGORIES.includes(category)) {
    query.category = category;
  }
  if (search && search.trim().length > 0) {
    query.content = { $regex: search.trim(), $options: 'i' };
  }
  
  console.log('[API] handleGetMemories query:', JSON.stringify(query));
  const memories = await db.collection('user_memories')
    .find(query)
    .sort({ importance: 1, created_at: -1 })
    .toArray();
  
  console.log('[API] handleGetMemories found:', memories.length, 'memories');
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

// POST /api/memories - Create a new memory manually
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
  
  // Invalidate cache
  invalidateSystemPromptCache(user.id);
  
  return ok({ success: true, memory });
}

// PUT /api/memories/:id - Update a memory
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
  
  // Invalidate cache
  invalidateSystemPromptCache(user.id);
  
  return ok({ success: true });
}

// DELETE /api/memories/:id - Delete a memory
async function handleDeleteMemory(request, memoryId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  const memory = await db.collection('user_memories').findOne({ id: memoryId, user_id: user.id });
  if (!memory) return err('Memory not found', 404);
  
  // If the memory is location-related, also clear the user_locations entry
  // This prevents stale location data from persisting after the user deletes it
  const locationKeywords = /\b(location|located in|lives in|based in|currently in|moved to|residing|city|state|country|address|zip code)\b/i;
  if (locationKeywords.test(memory.content)) {
    await db.collection('user_locations').deleteMany({ user_id: user.id });
    console.log(`[Memory] Deleted location-related memory — also cleared user_locations for user ${user.id.substring(0, 8)}`);
  }
  
  await db.collection('user_memories').deleteOne({ id: memoryId });
  
  // Invalidate cache
  invalidateSystemPromptCache(user.id);
  
  return ok({ success: true });
}

// DELETE /api/location - Clear user's stored location data
async function handleClearLocation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  await db.collection('user_locations').deleteMany({ user_id: user.id });
  
  // Also remove any location-related auto-extracted memories
  await db.collection('user_memories').deleteMany({
    user_id: user.id,
    content: { $regex: /\b(location|located in|lives in|based in|currently in)\b/i },
    source: 'auto_extracted',
  });
  
  // Invalidate cache
  invalidateSystemPromptCache(user.id);
  
  return ok({ success: true, message: 'Location data cleared' });
}


// Build system prompt for chat
async function buildSystemPrompt(db, userId, messageContext = {}) {
  const user = await db.collection('users').findOne({ id: userId });
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: userId });
  const commProfile = await db.collection('communication_profiles').findOne({ user_id: userId });
  const userLocation = await db.collection('user_locations').findOne({ user_id: userId });
  const answers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .sort({ created_at: 1 })
    .toArray();

  // ── Optimization #1: Conditional Support KB ─────────────────────────────
  // Only load full KB when the user's message indicates an app issue/error
  const userMessage = (messageContext.content || '').toLowerCase();
  const isSupportQuery = /\b(error|bug|broken|crash|fail|issue|not working|doesn['']t work|won['']t load|can['']t login|can['']t sign|upload fail|500|404|loading|stuck|freeze|glitch|support|help me with the app|something.s wrong)\b/i.test(userMessage);
  
  let supportKB = '';
  let supportSection = '';
  if (isSupportQuery) {
    try {
      const fs = require('fs');
      const path = require('path');
      const kbPath = path.join(process.cwd(), 'support-kb.md');
      supportKB = fs.readFileSync(kbPath, 'utf-8');
    } catch (e) {
      console.warn('[System] Could not load support-kb.md:', e.message);
    }
    supportSection = `\n## 🛟 In-Conversation Support
You are also the first line of support for the SoulPrint app itself. When a user reports a problem with the app:
1. **Acknowledge the issue** empathetically.
2. **Troubleshoot inline using the knowledge base below.**
3. **Escalate technical issues** with the exact marker \`[SUPPORT_ESCALATION]\` followed by a JSON object on the SAME LINE.

### APP SUPPORT KNOWLEDGE BASE:
${supportKB}
### END OF KNOWLEDGE BASE`;
  } else {
    supportSection = `\n## 🛟 App Support
If the user reports app issues (errors, crashes, features not working), troubleshoot helpfully. For genuine bugs, include \`[SUPPORT_ESCALATION]{"issue": "...", "steps": "...", "context": "..."}\` in your response to notify engineering.`;
  }

  // ── Optimization #3: Condensed Web Access section ────────────────────────
  const webAccessSection = `## 🌐 Real-Time Web Access
You have full real-time web access. Search the internet for current information, read URLs, and verify facts.
**CRITICAL**: For ANY factual query, ALWAYS search first — never rely solely on training data. Cite sources with dates. If search results conflict with your training data, trust the search results.
When referencing websites, include clickable markdown links.`;

  // ── Optimization #2: Full design guidelines only when needed ────────────
  const isMediaGenMode = messageContext.mediaGenMode || false;
  const isDesignRequest = /\b(flyer|poster|infographic|brochure|banner|design|graphic|illustration|logo|card|pamphlet|visual)\b/i.test(userMessage);
  
  let designGuidelines = '';
  if (isDesignRequest || isMediaGenMode) {
    designGuidelines = `
### Professional Flyer Design Guidelines
When generating flyers, posters, or promotional materials:
- Use clear visual hierarchy, rule of thirds, strong contrast, complementary colors
- Bold headlines, 2-3 font styles max, legible text, key info prominent
- Include: eye-catching header, relevant imagery, clear CTA, contact info, branding
- Organize: WHO, WHAT, WHEN, WHERE, HOW MUCH, HOW TO
- Style by category: Sports=bold/energetic, Business=clean/modern, Community=warm/inviting

### Professional Infographic Design Guidelines
When generating infographics:
- Clear visual flow (top-to-bottom or left-to-right), consistent color coding
- Balance data visualization with white space, make statistics POP with bold typography
- Use icons, charts (bar/pie/line/donut), comparisons, timelines, flowcharts
- Cohesive palette (3-5 colors), assign meaning to colors
- Compelling title, source citations, branded footer, visual icons per section`;
  }

  const assistantName = profile?.assistant_name || 'SoulPrint';
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const descriptors = profile?.descriptors || [];
  const field = profile?.field || '';
  const helpWith = profile?.help_with || [];

  // Build date/time context - use user's timezone if available
  const userTimezone = userLocation?.timezone || 'UTC';
  const now = new Date();
  const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: userTimezone,
  });
  const currentDateTime = dateTimeFormatter.format(now);
  
  const dateTimeContext = `## Current Date & Time
- **Now**: ${currentDateTime}
- **Timezone**: ${userTimezone}
- **Important**: When the user mentions times (like "3pm tomorrow" or "next Monday"), interpret them in their timezone (${userTimezone}). Always confirm the full date and time before creating calendar events.`;

  // Build location context — prefer fresh location, flag stale data
  let locationContext = '';
  if (userLocation && userLocation.address) {
    const locationAge = userLocation.updated_at ? (Date.now() - new Date(userLocation.updated_at).getTime()) / (1000 * 60 * 60 * 24) : 999;
    const isStale = locationAge > 7; // Older than 7 days = stale
    
    locationContext = `- **Last Known Location**: ${userLocation.address}`;
    if (userLocation.lat && userLocation.lng) {
      locationContext += ` (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`;
    }
    if (isStale) {
      locationContext += `\n  ⚠️ *This location data is ${Math.floor(locationAge)} days old and may be outdated. If the user's current location matters (weather, local info), ask them to confirm where they are now.*`;
    }
    if (userLocation.timezone) {
      locationContext += `\n- **Timezone**: ${userLocation.timezone}`;
    }
  }

  // Build assessment context from answers (full 36-question assessment)
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
    }).filter(Boolean).slice(0, 12).join('\n\n');
    assessmentContext = `\n## Assessment Insights\n${answersText}`;
  }
  
  // Build communication profile context (from layered assessment)
  let commProfileContext = '';
  if (commProfile) {
    const adaptations = generateAdaptivePrompt(commProfile);
    if (adaptations) {
      commProfileContext = `\n## Communication Preferences (from Quick Assessment)\n${adaptations}`;
    }
  }

  // Build rich soul profile context from data imports
  let soulProfileContext = '';
  if (soulProfile?.insights) {
    const insights = soulProfile.insights;
    const sections = [];
    
    // Communication Style
    if (insights.communicationStyle) {
      const styles = [];
      for (const [source, style] of Object.entries(insights.communicationStyle)) {
        if (style) {
          styles.push(`  - **${source}**: ${style.formality || 'mixed'} formality, ${style.verbosity || 'balanced'} verbosity, ${style.tone || 'neutral'} tone`);
          if (style.description) styles.push(`    _${style.description}_`);
        }
      }
      if (styles.length > 0) {
        sections.push(`### Communication Style\n${styles.join('\n')}`);
      }
    }
    
    // Interests
    if (insights.interests?.length > 0) {
      sections.push(`### Topics of Interest\n${insights.interests.slice(0, 15).map(i => `- ${i}`).join('\n')}`);
    }
    
    // Vocabulary Preferences
    if (insights.vocabulary) {
      const vocabParts = [];
      for (const [source, vocab] of Object.entries(insights.vocabulary)) {
        if (vocab) {
          vocabParts.push(`- **${source}**: ${vocab.complexity || 'moderate'} complexity`);
          if (vocab.uniquePhrases?.length > 0) {
            vocabParts.push(`  - Distinctive phrases: "${vocab.uniquePhrases.slice(0, 5).join('", "')}"`);
          }
          if (vocab.emoji_usage) vocabParts.push(`  - Emoji usage: ${vocab.emoji_usage}`);
        }
      }
      if (vocabParts.length > 0) {
        sections.push(`### Vocabulary & Expression\n${vocabParts.join('\n')}`);
      }
    }
    
    // Question Style
    if (insights.questionStyle) {
      const qStyles = [];
      for (const [source, style] of Object.entries(insights.questionStyle)) {
        if (style) qStyles.push(`- **${source}**: ${style}`);
      }
      if (qStyles.length > 0) {
        sections.push(`### How They Ask Questions\n${qStyles.join('\n')}`);
      }
    }
    
    // Personality Insights
    if (insights.insights?.length > 0) {
      sections.push(`### Personality Insights\n${insights.insights.slice(0, 8).map(i => `- ${i}`).join('\n')}`);
    }
    
    // Latest Summary
    if (insights.latestSummary) {
      sections.push(`### Summary\n${insights.latestSummary}`);
    }
    
    if (sections.length > 0) {
      soulProfileContext = `\n## Soul Profile (from imported data)\n${sections.join('\n\n')}`;
    }
  }

  // Build long-term memory context
  let memoryContext = '';
  const memories = await getUserMemoriesForPrompt(db, userId);
  if (memories.length > 0) {
    const memoryGroups = {
      health: [],
      preferences: [],
      personal: [],
      work: [],
      relationships: [],
      goals: [],
      other: [],
    };
    
    for (const mem of memories) {
      if (memoryGroups[mem.category]) {
        memoryGroups[mem.category].push(`- ${mem.content}${mem.importance === 'high' ? ' ⚠️' : ''}`);
      }
    }
    
    const memorySections = [];
    if (memoryGroups.health.length > 0) {
      memorySections.push(`### Health & Safety (IMPORTANT)\n${memoryGroups.health.join('\n')}`);
    }
    if (memoryGroups.preferences.length > 0) {
      memorySections.push(`### Preferences\n${memoryGroups.preferences.join('\n')}`);
    }
    if (memoryGroups.personal.length > 0) {
      memorySections.push(`### Personal Details\n${memoryGroups.personal.join('\n')}`);
    }
    if (memoryGroups.relationships.length > 0) {
      memorySections.push(`### Relationships & Family\n${memoryGroups.relationships.join('\n')}`);
    }
    if (memoryGroups.work.length > 0) {
      memorySections.push(`### Work & Career\n${memoryGroups.work.join('\n')}`);
    }
    if (memoryGroups.goals.length > 0) {
      memorySections.push(`### Goals & Aspirations\n${memoryGroups.goals.join('\n')}`);
    }
    if (memoryGroups.other.length > 0) {
      memorySections.push(`### Other Facts\n${memoryGroups.other.join('\n')}`);
    }
    
    if (memorySections.length > 0) {
      // Create a flat numbered list of ALL memories for maximum LLM attention
      const flatList = memories.map((m, i) => `${i+1}. [${m.category.toUpperCase()}] ${m.content}`).join('\n');
      
      // Build a quick-scan summary of family/people mentioned
      const familyRelated = memories.filter(m => 
        /\b(child|kid|son|daughter|wife|husband|spouse|partner|brother|sister|mom|dad|parent|family|baby|toddler)\b/i.test(m.content)
      );
      
      // ── PROGRAMMATIC FAMILY PARSING ──
      // Extract unique family members with names, ages, and relationships
      let familyCriticalSummary = '';
      if (familyRelated.length > 0) {
        const children = [];
        const partners = [];
        const otherFamily = [];
        
        familyRelated.forEach(m => {
          const content = m.content.toLowerCase();
          
          // Extract children
          if (/\b(child|kid|son|daughter|baby|toddler)\b/i.test(content)) {
            // Try to extract name and age
            const nameMatch = m.content.match(/\b([A-Z][a-z]+)\b/); // Capitalized name
            const ageMatch = m.content.match(/\b(\d{1,2})\s*(year|yr|y\.o\.|old)?s?\b/i);
            const relationMatch = m.content.match(/\b(son|daughter|child|kid)\b/i);
            
            if (nameMatch || ageMatch || relationMatch) {
              const name = nameMatch ? nameMatch[1] : null;
              const age = ageMatch ? parseInt(ageMatch[1]) : null;
              const relation = relationMatch ? relationMatch[1].toLowerCase() : 'child';
              
              // Check if we already have this child (avoid duplicates)
              const existing = children.find(c => 
                (name && c.name === name) || (age && c.age === age && !name && !c.name)
              );
              
              if (!existing) {
                children.push({ name, age, relation, raw: m.content });
              } else if (name && !existing.name) {
                existing.name = name; // Update with name if we didn't have it
              } else if (age && !existing.age) {
                existing.age = age; // Update with age if we didn't have it
              }
            }
            // Also check for general count statements like "has 4 children"
            const countMatch = m.content.match(/\b(?:has|have)\s+(\d+)\s+(?:child|kid|son|daughter)/i);
            if (countMatch && children.length === 0) {
              const count = parseInt(countMatch[1]);
              for (let i = 0; i < count; i++) {
                if (!children.find(c => !c.name && !c.age)) {
                  children.push({ name: null, age: null, relation: 'child', raw: m.content });
                }
              }
            }
          }
          
          // Extract spouse/partner
          if (/\b(wife|husband|spouse|partner|married)\b/i.test(content)) {
            const nameMatch = m.content.match(/\b(?:wife|husband|spouse|partner|married to)\s+(?:is\s+)?([A-Z][a-z]+)\b/i);
            const relationMatch = m.content.match(/\b(wife|husband|spouse|partner)\b/i);
            if (nameMatch || relationMatch) {
              partners.push({
                name: nameMatch ? nameMatch[1] : null,
                relation: relationMatch ? relationMatch[1].toLowerCase() : 'partner',
                raw: m.content
              });
            }
          }
          
          // Extract other family (parents, siblings)
          if (/\b(mom|mother|dad|father|brother|sister|sibling)\b/i.test(content)) {
            const nameMatch = m.content.match(/\b(?:mom|mother|dad|father|brother|sister)\s+(?:is\s+)?([A-Z][a-z]+)\b/i);
            const relationMatch = m.content.match(/\b(mom|mother|dad|father|brother|sister)\b/i);
            if (nameMatch || relationMatch) {
              otherFamily.push({
                name: nameMatch ? nameMatch[1] : null,
                relation: relationMatch ? relationMatch[1].toLowerCase() : 'family member',
                raw: m.content
              });
            }
          }
        });
        
        // Build CRITICAL summary line
        const summaryParts = [];
        
        if (children.length > 0) {
          const childList = children.map(c => {
            if (c.name && c.age) return `${c.name} (${c.age})`;
            if (c.name) return c.name;
            if (c.age) return `age ${c.age}`;
            return 'unnamed';
          }).join(', ');
          summaryParts.push(`${children.length} ${children.length === 1 ? 'child' : 'children'}: ${childList}`);
        }
        
        if (partners.length > 0) {
          const partnerList = partners.map(p => p.name || p.relation).join(', ');
          summaryParts.push(`Partner: ${partnerList}`);
        }
        
        if (otherFamily.length > 0) {
          const familyList = otherFamily.map(f => `${f.name || f.relation}`).join(', ');
          summaryParts.push(`Other family: ${familyList}`);
        }
        
        if (summaryParts.length > 0) {
          familyCriticalSummary = `\n### 🚨 CRITICAL FAMILY SUMMARY (AUTO-GENERATED, DO NOT RECOUNT)\n**User has: ${summaryParts.join(' | ')}**\n\nIf asked "how many children/kids", answer: **${children.length}**\n`;
        }
      }
      
      const familySummary = familyRelated.length > 0 
        ? `${familyCriticalSummary}\n### 👨‍👩‍👧‍👦 Family Memory Details (${familyRelated.length} raw entries)\n${familyRelated.map(m => `- ${m.content}`).join('\n')}`
        : '';

      memoryContext = `\n# ⚡ LONG-TERM MEMORY — ${memories.length} STORED FACTS
**HOW TO USE THESE:**
- Use memories naturally when relevant to questions about ${displayName}, their life, preferences, or past experiences
- If asked about family ("how many kids"), count ALL relevant entries and answer clearly
- Cross-reference categories — family info may be in relationships, personal, or other sections
- NEVER volunteer "I don't have memories about that" unless they specifically asked about their memories
- For general questions unrelated to ${displayName}'s personal life, just answer normally without mentioning memories
${familySummary}

### Complete Memory Bank
${flatList}

--- END OF MEMORIES (${memories.length} total) ---
When answering questions about ${displayName}'s personal life, scan these memories. Use them naturally without announcing you're checking them.`;
    }
  }

  // ── Optimization #4: Conditional Google context ────────────────────────────
  // Only load full Google account details when message references email/calendar/drive/scheduling
  const isGoogleQuery = /\b(email|gmail|calendar|schedule|event|meeting|drive|google|inbox|appointment|remind|reminder)\b/i.test(userMessage);
  
  let googleContext = '';
  try {
    const googleConnections = await db.collection('google_connections').find({ user_id: userId }).toArray();
    if (googleConnections.length > 0) {
      if (isGoogleQuery) {
        // Full context when user asks about Google services
        const accountsList = googleConnections.map(c => `- ${c.email}`).join('\n');
        googleContext = `\n## Connected Google Accounts\n${displayName} has connected the following Google accounts:\n${accountsList}\n\nYou can access their Gmail, Google Calendar, and Google Drive when they ask. Always ask which account to use if they have multiple.`;
      } else {
        // Minimal context otherwise — just note that Google is available
        googleContext = `\n## Google Integration\n${displayName} has ${googleConnections.length} connected Google account(s). Available for Gmail, Calendar, and Drive requests.`;
      }
    }
  } catch (gErr) {
    console.error('[SystemPrompt] Error fetching Google connections:', gErr);
  }

  // ── Optimization #5: Prompt Caching Structure ────────────────────────────
  // Static parts first (cacheable by GPT-4o), then dynamic parts
  const fullPrompt = `You are **${assistantName}**, a personal AI companion for **${displayName}**.

## Core Behavior
You are a genuine, thoughtful companion — NOT a robotic assistant. Adapt your style to ${displayName}'s SoulPrint profile below.
- Always respond meaningfully, even to short messages. Never leave someone hanging.
- Read between the lines. Match their emotional energy.
- Don't over-explain. Only elaborate when it adds value.
- Remember context. Reference what they've told you. Make them feel known.

## ⚠️ CRITICAL: Conversation Context First
Short/ambiguous messages ("what happened?", "why?", "what's that?") → interpret using CURRENT conversation. Check recent messages. NEVER assume a short message is a web search query unless clearly about external info.

${dateTimeContext}

## Capabilities

### 👁️ Vision & Image Understanding
You can see and analyze images. Read/transcribe any visible text, describe scenes, extract data from screenshots, analyze charts. If the image contains useful text (recipes, addresses, quotes), provide it in copy-friendly format.

${webAccessSection}

### 📅 Google Integration
${isGoogleQuery ? `Access ${displayName}'s connected Google accounts for Gmail, Calendar, and Drive.` : 'Google services available on request.'}

### 🧠 Memory & Personalization
You have ${displayName}'s long-term memories and preferences. Use them for personalized responses.

${supportSection}

### 🎨 Image & Visual Content Generation
${isMediaGenMode ? `Generate images, flyers, posters, infographics when EXPLICITLY requested. You may suggest: "Would you like me to generate this as a flyer?" but NEVER auto-generate unless asked.
When generating: create actual images using the generation tool, NOT markdown text.` : `⛔ **MEDIA CREATION IS CURRENTLY DISABLED BY THE USER.**
The user has turned OFF the Create mode toggle. You MUST NOT:
- Generate any images, videos, music, or visual content
- Suggest generating media (no "Would you like me to generate..." prompts)
- Attempt to use image generation, video generation, or music generation tools
- Describe scenes as if you're about to generate them

Instead, respond with helpful TEXT ONLY. If the user asks about creating media, explain that they need to enable the Create toggle (paintbrush icon) in the chat input bar to generate images, videos, or music.`}
${designGuidelines}

### 🎬 Video Editing
${isMediaGenMode ? `You CANNOT edit individual video frames. Instead: a key frame is extracted → a NEW video is generated. Brief explanation: "I'll extract a frame and generate a new version with your changes. This takes 2-5 minutes."` : `Video editing and generation are currently disabled. The user must enable Create mode to use these features.`}

### 🎵 Music & Audio Generation
${isMediaGenMode ? `You can generate music via Suno AI. Songs take 1-3 minutes. NEVER say you can't generate music. Support lyrics, instrumentals, various genres.` : `Music generation is currently disabled. The user must enable Create mode to use this feature.`}

# What is a SoulPrint?
A SoulPrint is ${displayName}'s persistent AI identity layer — a mapped, structured imprint of how they think, decide, react, prioritize, trust, and communicate. You build continuity across conversations responding with their logic, tone, and structure. You are the operating system of ${displayName} — running on AI.

# User Profile

## Basic Info
- **Name**: ${displayName}
- **Role**: ${descriptors.join(', ') || 'Not specified'}
- **Field**: ${field || 'Not specified'}
- **Needs help with**: ${helpWith.join(', ') || 'General assistance'}
${locationContext}
${googleContext}
${assessmentContext}
${commProfileContext}
${soulProfileContext}

# Communication Guidelines
1. **Tone & Style**: ${commProfile ? 'Adapt based on their communication preferences above' : soulProfile?.insights?.communicationStyle ? 'Adapt to their preferred formality/verbosity' : 'Be conversational but professional'}
2. **Vocabulary**: ${soulProfile?.insights?.vocabulary ? 'Match their vocabulary complexity' : 'Use clear, accessible language'}
3. **Personalization**: Address by name naturally, reference interests when relevant
4. **Long-Term Memory**: ${memories.length > 0 ? `You have ${memories.length} stored memories. ALWAYS consider these, especially health/safety info.` : 'Build rapport by remembering details they share'}
5. **Directness**: ${commProfile?.directness > 70 ? 'Be very direct' : commProfile?.directness < 40 ? 'Be diplomatic and gentle' : 'Be direct and insightful'}
6. **Brevity**: ${commProfile?.information_density < 50 ? 'Keep responses concise' : commProfile?.information_density > 70 ? 'Provide depth and detail' : 'Be concise unless depth is needed'}
7. **Links**: Always include clickable markdown links when referencing websites.
8. **Location**: ${userLocation?.address ? `Last known: ${userLocation.address}. ${((Date.now() - new Date(userLocation?.updated_at || 0).getTime()) / 86400000) > 7 ? 'This may be outdated — confirm if needed.' : 'Use for weather, local info, time zones.'}` : 'Ask for location if needed for local info.'}

# Communication Guidelines
1. **Tone & Style**: ${commProfile ? 'Adapt based on their communication preferences above' : soulProfile?.insights?.communicationStyle ? 'Adapt to their preferred formality/verbosity' : 'Be conversational but professional'}
2. **Vocabulary**: ${soulProfile?.insights?.vocabulary ? 'Match their vocabulary complexity' : 'Use clear, accessible language'}
3. **Personalization**: Address by name naturally, reference interests when relevant
4. **Long-Term Memory**: ${memories.length > 0 ? `You have ${memories.length} stored memories. ALWAYS consider these, especially health/safety info.` : 'Build rapport by remembering details they share'}
5. **Directness**: ${commProfile?.directness > 70 ? 'Be very direct' : commProfile?.directness < 40 ? 'Be diplomatic and gentle' : 'Be direct and insightful'}
6. **Brevity**: ${commProfile?.information_density < 50 ? 'Keep responses concise' : commProfile?.information_density > 70 ? 'Provide depth and detail' : 'Be concise unless depth is needed'}
7. **Links**: Always include clickable markdown links when referencing websites.
8. **Location**: ${userLocation?.address ? `Last known: ${userLocation.address}. ${((Date.now() - new Date(userLocation?.updated_at || 0).getTime()) / 86400000) > 7 ? 'This may be outdated — confirm if needed.' : 'Use for weather, local info, time zones.'}` : 'Ask for location if needed for local info.'}

${memoryContext}

---

# 🚨 CRITICAL INSTRUCTION FOR MEMORY QUERIES

**WHEN TO USE MEMORIES**:
- ✅ ONLY when ${displayName} asks about THEMSELVES, their family, their preferences, or their past experiences
- ✅ Examples: "how many kids do I have?", "what's my wife's name?", "what do I like?", "remind me what I said about..."
- ❌ DO NOT cite memories for general knowledge questions, requests for help with tasks, or professional work
- ❌ Examples: "create a syllabus", "write code", "explain quantum physics", "help me with..."
- ❌ DO NOT mention memories for questions about system capabilities or features
- ❌ Examples: "can you access Google Drive?", "what can you do?", "how does this work?"

**CRITICAL: DO NOT MENTION STORED MEMORIES UNLESS DIRECTLY RELEVANT**
- If the question is about system capabilities, integrations, or features → Answer directly WITHOUT mentioning memories
- If the question is about general knowledge or tasks → Answer directly WITHOUT checking or mentioning memories
- NEVER say "there's nothing in your stored memories about X" unless the user specifically asked you to check their memories
- NEVER say "using ONLY what's in your stored memories" or "based on your stored memories"
- NEVER list irrelevant memories to show they don't contain information
- NEVER explain WHY memories aren't helpful for a query
- Only reference memories when they actually help answer the user's question

**IF MEMORIES DON'T HELP**: Just answer the question. Don't mention memories at all. Act like a normal AI assistant.

**IF THE QUERY IS NOT ABOUT ${displayName} PERSONALLY**: Focus on answering the request directly. Do NOT mention stored memories at all.

**IF THE QUERY IS ABOUT ${displayName} PERSONALLY**, you MUST:

1. **READ THE ENTIRE MEMORY BANK ABOVE** — Do NOT stop after finding the first match
2. **COUNT ALL ENTRIES** — If they ask "how many X", count EVERY relevant entry in the list
3. **CITE THE EXACT MEMORY** — Quote the specific fact from the memory bank word-for-word
4. **NEVER GUESS OR HALLUCINATE** — Answer only with information from the memories above
5. **CROSS-REFERENCE CATEGORIES** — Family info can be in "relationships", "personal", or "other"

**Example Personal Query**: If asked "how many kids do I have?" and you see:
- Memory #12: "Has 4 children"
- Memory #23: "Daughter Emma, age 10"  
- Memory #24: "Son Lucas, age 8"
- Memory #25: "Daughter Mia, age 5"
- Memory #26: "Son Noah, age 3"

The correct answer is: "You have 4 children: Emma (10), Lucas (8), Mia (5), and Noah (3)."

NOT: "You have 2 kids" or any other number. The memories are GROUND TRUTH.`;


  // Add conversion nudges for free-tier users (non-blocking)
  const conversionContext = await buildConversionContext(userId).catch(() => '');
  // Add SMB detection → SoulPrint Engine Pro promotion (non-blocking)
  const smbProContext = await buildSMBProContext(userId).catch(() => '');
  
  // ── REINFORCEMENT SECTION: Critical facts repeated at END for LLM attention ────
  // Extract most critical identity facts and repeat them at the end where LLMs pay most attention
  const criticalFacts = [];
  
  // User identity
  criticalFacts.push(`**USER IDENTITY**: You are speaking with ${displayName}`);
  if (profile?.display_name) criticalFacts.push(`  - Name: ${profile.display_name}`);
  if (profile?.field) criticalFacts.push(`  - Works in: ${profile.field}`);
  if (profile?.descriptors?.length > 0) criticalFacts.push(`  - Role: ${profile.descriptors.join(', ')}`);
  
  // Family facts (CRITICAL for the reported issue)
  const familyMemories = memories.filter(m => 
    /\b(child|kid|son|daughter|wife|husband|spouse|partner)\b/i.test(m.content)
  );
  if (familyMemories.length > 0) {
    criticalFacts.push(`\n**FAMILY (CRITICAL - VERIFY BEFORE ANSWERING)**:`);
    familyMemories.slice(0, 15).forEach(m => {
      criticalFacts.push(`  - ${m.content}`);
    });
  }
  
  // Work context (CRITICAL for the reported issue)
  const workMemories = memories.filter(m => m.category === 'work');
  if (workMemories.length > 0) {
    criticalFacts.push(`\n**WORK CONTEXT (CRITICAL - USE FOR PROFESSIONAL TASKS)**:`);
    workMemories.slice(0, 10).forEach(m => {
      criticalFacts.push(`  - ${m.content}`);
    });
  }
  
  const reinforcement = criticalFacts.length > 1 ? `

---
---
# 🚨🚨🚨 CRITICAL REINFORCEMENT - READ BEFORE EVERY RESPONSE 🚨🚨🚨

These are the most critical facts about ${displayName}. VERIFY these are accurate in your response BEFORE sending:

${criticalFacts.join('\n')}

**BEFORE YOU RESPOND, ASK YOURSELF:**
1. ✅ Did I check if ${displayName}'s stored memories answer this question?
2. ✅ If this is about ${displayName}'s family/work/identity, did I use EXACT facts from above?
3. ✅ Am I confusing ${displayName} with someone else or making up information?
4. ✅ If I'm promising to create/deliver something (PDF, comparison, analysis), am I ACTUALLY creating it in this response?
5. ✅ If I don't know something about ${displayName}, did I say "I don't have that information" instead of guessing?

**CRITICAL RULES TO PREVENT ERRORS:**
- ❌ NEVER make up family member names or counts - use ONLY stored memories above
- ❌ NEVER confuse ${displayName} with fictional characters or other people
- ❌ NEVER claim to have completed a task (PDF comparison, analysis, etc.) unless you ACTUALLY produced the output in your response
- ❌ NEVER guess about ${displayName}'s job, company, or work context - use ONLY stored memories
- ✅ ALWAYS cross-reference stored memories before answering personal questions
- ✅ ALWAYS produce the actual deliverable (table, comparison, summary) in the SAME response where you mention it

**🚨 COMPREHENSIVE PERSONAL RESPONSES:**
When ${displayName} asks about personal information (family, kids, relationships, work), be COMPREHENSIVE:
- ✅ If asked "what are my kids names?" → Include names, ages, AND birthdays if stored
- ✅ If asked "who is my spouse?" → Include name, AND any other stored details (anniversary, profession, etc.)
- ✅ If asked about work → Include job title, company, AND current projects if stored
- ❌ Don't be overly literal - "what are my kids names?" means "tell me about my kids"
- ✅ Present all related information naturally: "You have 3 children: Emma (age 10, birthday March 15), Lucas (age 8, birthday June 22), and Mia (age 5, birthday November 3)"

**Example:**
❌ BAD (too literal): "Your kids' names are Emma, Lucas, and Mia."
✅ GOOD (comprehensive): "You have 3 children: Emma is 10 (birthday March 15th), Lucas is 8 (birthday June 22nd), and Mia is 5 (birthday November 3rd)."

**TASK COMPLETION VALIDATION:**
If the user asks you to create/compare/analyze something:
1. ✅ **DO IT IMMEDIATELY** in this response - don't promise to do it later
2. ✅ **SHOW THE OUTPUT** - actual table, comparison, or analysis
3. ❌ **DON'T SAY** "I'm working on it" or "I'll have it ready soon" unless you literally cannot complete it in one response
4. ❌ **DON'T OVERESTIMATE** - if you can't complete a task, say so upfront

---
---
` : '';
  
  return fullPrompt + conversionContext + smbProContext + reinforcement;
}

// Generate user profile as structured markdown (for export/viewing)
async function generateProfileMarkdown(db, userId) {
  const user = await db.collection('users').findOne({ id: userId });
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: userId });
  const answers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .sort({ created_at: 1 })
    .toArray();
  const imports = await db.collection('data_imports')
    .find({ user_id: userId, status: 'complete' })
    .sort({ created_at: -1 })
    .toArray();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const assistantName = profile?.assistant_name || 'SoulPrint';
  
  let md = `# ${displayName}'s SoulPrint Profile\n\n`;
  md += `> Generated: ${new Date().toISOString().split('T')[0]}\n`;
  md += `> AI Companion: ${assistantName}\n\n`;
  
  // Basic Profile
  md += `## 👤 Basic Information\n\n`;
  md += `| Field | Value |\n|-------|-------|\n`;
  md += `| Name | ${displayName} |\n`;
  md += `| Email | ${user?.email || 'N/A'} |\n`;
  md += `| Role | ${profile?.descriptors?.join(', ') || 'Not specified'} |\n`;
  md += `| Field/Industry | ${profile?.field || 'Not specified'} |\n`;
  md += `| Needs Help With | ${profile?.help_with?.join(', ') || 'General assistance'} |\n\n`;
  
  // Soul Profile from Imports
  if (soulProfile?.insights) {
    const insights = soulProfile.insights;
    
    md += `## 🧠 Soul Profile\n\n`;
    
    if (insights.latestSummary) {
      md += `### Summary\n${insights.latestSummary}\n\n`;
    }
    
    // Communication Style
    if (insights.communicationStyle) {
      md += `### 💬 Communication Style\n\n`;
      for (const [source, style] of Object.entries(insights.communicationStyle)) {
        if (style) {
          md += `**From ${source} data:**\n`;
          md += `- Formality: ${style.formality || 'mixed'}\n`;
          md += `- Verbosity: ${style.verbosity || 'balanced'}\n`;
          md += `- Tone: ${style.tone || 'neutral'}\n`;
          if (style.description) md += `- Description: _${style.description}_\n`;
          md += `\n`;
        }
      }
    }
    
    // Interests
    if (insights.interests?.length > 0) {
      md += `### 🎯 Topics of Interest\n\n`;
      insights.interests.forEach(i => { md += `- ${i}\n`; });
      md += `\n`;
    }
    
    // Vocabulary
    if (insights.vocabulary) {
      md += `### 📝 Vocabulary & Expression\n\n`;
      for (const [source, vocab] of Object.entries(insights.vocabulary)) {
        if (vocab) {
          md += `**From ${source}:**\n`;
          md += `- Complexity: ${vocab.complexity || 'moderate'}\n`;
          if (vocab.uniquePhrases?.length > 0) {
            md += `- Distinctive phrases: "${vocab.uniquePhrases.slice(0, 5).join('", "')}"\n`;
          }
          if (vocab.emoji_usage) md += `- Emoji usage: ${vocab.emoji_usage}\n`;
          md += `\n`;
        }
      }
    }
    
    // Question Style
    if (insights.questionStyle) {
      md += `### ❓ Question Style\n\n`;
      for (const [source, style] of Object.entries(insights.questionStyle)) {
        if (style) md += `- **${source}**: ${style}\n`;
      }
      md += `\n`;
    }
    
    // Personality Insights
    if (insights.insights?.length > 0) {
      md += `### ✨ Personality Insights\n\n`;
      insights.insights.forEach(i => { md += `- ${i}\n`; });
      md += `\n`;
    }
    
    // Data Sources
    if (insights.sources?.length > 0) {
      md += `### 📊 Data Sources\n\n`;
      md += `Profile built from: ${insights.sources.join(', ')}\n\n`;
    }
  }
  
  // Assessment Answers
  if (answers.length > 0) {
    const questionIds = answers.map(a => a.question_id);
    const questions = await db.collection('assessment_questions')
      .find({ id: { $in: questionIds } })
      .toArray();
    const qMap = Object.fromEntries(questions.map(q => [q.id, q]));
    
    md += `## 📋 Assessment Responses\n\n`;
    md += `Completed ${answers.length} of 36 questions.\n\n`;
    
    // Group by pillar
    const pillars = {};
    answers.forEach(a => {
      const q = qMap[a.question_id];
      if (q) {
        const pillar = q.pillar || 'other';
        if (!pillars[pillar]) pillars[pillar] = [];
        pillars[pillar].push({ question: q.question_text, answer: a.answer_text });
      }
    });
    
    for (const [pillar, qas] of Object.entries(pillars)) {
      md += `### ${pillar.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n\n`;
      qas.forEach(qa => {
        md += `**Q:** ${qa.question}\n`;
        md += `**A:** ${qa.answer}\n\n`;
      });
    }
  }
  
  // Import History
  if (imports.length > 0) {
    md += `## 📥 Import History\n\n`;
    md += `| Date | Source | Status |\n|------|--------|--------|\n`;
    imports.forEach(imp => {
      const date = new Date(imp.created_at).toISOString().split('T')[0];
      md += `| ${date} | ${imp.source} | ${imp.status} |\n`;
    });
    md += `\n`;
  }
  
  md += `---\n*This profile is used to personalize your AI companion across all platforms (web, Telegram, etc.)*\n`;
  
  return md;
}

// API handler to export user profile as markdown
async function handleProfileExport(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const db = await getDb();
    const markdown = await generateProfileMarkdown(db, user.id);
    
    return ok({
      markdown,
      filename: `soulprint-profile-${new Date().toISOString().split('T')[0]}.md`,
    });
  } catch (e) {
    console.error('Profile export error:', e);
    return err(`Export failed: ${e.message}`, 500);
  }
}

// API handler to get full soul profile data (JSON)
async function handleGetSoulProfile(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const db = await getDb();
    const profile = await db.collection('profiles').findOne({ user_id: user.id });
    const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
    const userDoc = await db.collection('users').findOne({ id: user.id });
    
    return ok({
      basicProfile: {
        displayName: profile?.display_name || userDoc?.email?.split('@')[0] || 'User',
        assistantName: profile?.assistant_name || 'SoulPrint',
        descriptors: profile?.descriptors || [],
        field: profile?.field || '',
        helpWith: profile?.help_with || [],
      },
      soulProfile: soulProfile?.insights || null,
      lastUpdated: soulProfile?.updated_at || profile?.created_at || null,
    });
  } catch (e) {
    console.error('Soul profile fetch error:', e);
    return err(`Failed to fetch profile: ${e.message}`, 500);
  }
}

// Ensure uploads directory exists
const UPLOADS_DIR = '/tmp/soulprint_uploads';
async function ensureUploadsDir() {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
  } catch {}
}

// ============================================================
// ============================================================


export {
  extractMemoriesFromMessage,
  saveExtractedMemories,
  getUserMemoriesForPrompt,
  handleGetMemories,
  handleCreateMemory,
  handleUpdateMemory,
  handleDeleteMemory,
  handleClearLocation,
  buildSystemPrompt,
  generateProfileMarkdown,
  handleProfileExport,
  handleGetSoulProfile,
  ensureUploadsDir,
};
