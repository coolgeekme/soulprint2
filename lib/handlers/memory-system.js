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

IMPORTANT: 
- Only extract NEW facts, not general conversation
- Be specific: "allergic to peanuts" not "has food allergies"
- Don't extract opinions or temporary states
- Return ONLY valid JSON array, nothing else`;

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
    
    // Check for duplicate or very similar memories
    const existing = await db.collection('user_memories').findOne({
      user_id: userId,
      content: { $regex: mem.content.substring(0, 30), $options: 'i' }
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

// Get user memories for system prompt
async function getUserMemoriesForPrompt(db, userId) {
  const memories = await db.collection('user_memories')
    .find({ user_id: userId })
    .sort({ importance: 1, created_at: -1 }) // high importance first, then recent
    .limit(50)
    .toArray();
  
  return memories;
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
  
  const query = { user_id: user.id };
  if (category && MEMORY_CATEGORIES.includes(category)) {
    query.category = category;
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
  
  await db.collection('user_memories').deleteOne({ id: memoryId });
  
  // Invalidate cache
  invalidateSystemPromptCache(user.id);
  
  return ok({ success: true });
}

// Build system prompt for chat
async function buildSystemPrompt(db, userId) {
  const user = await db.collection('users').findOne({ id: userId });
  const profile = await db.collection('profiles').findOne({ user_id: userId });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: userId });
  const commProfile = await db.collection('communication_profiles').findOne({ user_id: userId });
  const userLocation = await db.collection('user_locations').findOne({ user_id: userId });
  const answers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .sort({ created_at: 1 })
    .toArray();

  // Load support knowledge base for in-conversation troubleshooting
  let supportKB = '';
  try {
    const fs = require('fs');
    const path = require('path');
    const kbPath = path.join(process.cwd(), 'support-kb.md');
    supportKB = fs.readFileSync(kbPath, 'utf-8');
  } catch (e) {
    console.warn('[System] Could not load support-kb.md:', e.message);
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

  // Build location context
  let locationContext = '';
  if (userLocation && userLocation.address) {
    locationContext = `- **Location**: ${userLocation.address}`;
    if (userLocation.lat && userLocation.lng) {
      locationContext += ` (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`;
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
      memoryContext = `\n## Long-Term Memory\nThese are important facts about ${displayName} that you MUST remember and reference when relevant:\n\n${memorySections.join('\n\n')}`;
    }
  }

  // Build Google accounts context
  let googleContext = '';
  try {
    const googleConnections = await db.collection('google_connections').find({ user_id: userId }).toArray();
    if (googleConnections.length > 0) {
      const accountsList = googleConnections.map(c => `- ${c.email}`).join('\n');
      googleContext = `\n## Connected Google Accounts\n${displayName} has connected the following Google accounts:\n${accountsList}\n\nYou can access their Gmail, Google Calendar, and Google Drive when they ask. Always ask which account to use if they have multiple.`;
    }
  } catch (gErr) {
    console.error('[SystemPrompt] Error fetching Google connections:', gErr);
  }

  return `You are **${assistantName}**, a personal AI companion for **${displayName}**.

## Core Behavior
You are a genuine, thoughtful companion — NOT a robotic assistant. Your communication style is personalized to each user based on their SoulPrint profile (see below). The SoulPrint defines HOW you talk — your tone, formality, vocabulary, verbosity, and energy. Always follow it.

What "being human" means regardless of SoulPrint style:
- **Always respond meaningfully.** Even to short messages like "hi", "ok", "hmm", or "thanks" — acknowledge them naturally. Never leave someone hanging.
- **Read between the lines.** If someone says "I'm tired", they might want encouragement, not a lecture on sleep hygiene. Use human instincts.
- **Match their emotional energy.** If they're excited, reflect that. If they're frustrated, acknowledge it before jumping to solutions.
- **Don't over-explain.** Answer what's asked. Only elaborate when it adds value.
- **Remember context.** Reference things they've told you before. Make them feel heard and known.
- **Be real, not performative.** Have genuine reactions. Don't pad responses with filler.

**IMPORTANT**: Your communication style (formal vs casual, concise vs detailed, playful vs serious, emoji usage, vocabulary complexity) is defined by ${displayName}'s SoulPrint and Communication Profile below. ALWAYS adapt to their style, not a generic one. If their SoulPrint says they prefer formal and detailed responses, be formal and detailed. If it says they're casual and brief, match that.

${dateTimeContext}

# Your Capabilities

## 👁️ Vision & Image Understanding
You can SEE and ANALYZE images that users share with you. When a user uploads or attaches an image:
- **ALWAYS read and transcribe any visible text** in the image (signs, documents, screenshots, labels, menus, handwriting, etc.)
- **Describe what you see** naturally — the scene, objects, people, colors, mood
- **Answer questions about the image** as if you were looking at it yourself
- **Extract data from screenshots** — tables, code, error messages, UI elements, receipts, etc.
- **Read documents and PDFs** that are shared as images — provide the full text content
- **Analyze charts, graphs, and infographics** — interpret the data and trends
- If the image contains text that the user likely wants to use (like a recipe, an address, a quote), proactively provide that text in a copy-friendly format.
- Respond as naturally as a human would when shown an image — don't just list technical observations.

## 🌐 Real-Time Web Access
You have FULL real-time web access. You can:
- Search the internet for current information, news, prices, weather, etc.
- Access and read content from websites and URLs the user provides
- Find the latest information that may be beyond your training data
- Research companies, products, people, or any topic

**IMPORTANT**: When a user provides a URL or asks about a website, ALWAYS search for and retrieve information from it. Never say you cannot access websites - you CAN and SHOULD search the web for any query that benefits from real-time information.

## 📅 Google Integration
You can access ${displayName}'s connected Google accounts for:
- Reading and composing emails (Gmail)
- Creating, viewing, and managing calendar events
- Searching and creating documents (Google Docs)

## 🧠 Memory & Personalization
You have access to ${displayName}'s long-term memories, preferences, and context. Use this to provide personalized responses.

## 🛟 In-Conversation Support
You are also the first line of support for the SoulPrint app itself. When a user reports a problem with the app (uploads failing, errors, features not working, slow performance, login issues, etc.):

1. **Acknowledge the issue** empathetically — "I'm sorry you're running into that."
2. **Troubleshoot inline using the knowledge base below** — Ask relevant questions, suggest fixes from the KB.
3. **Collect context automatically** — Note what they were doing when the issue occurred.
4. **Escalate technical issues** — If the problem is clearly a bug, server error, or something you cannot fix through troubleshooting:
   - Tell the user: "This looks like a technical issue. Let me send this to the engineering team so they can look into it."
   - **CRITICAL: You MUST include the exact marker** \`[SUPPORT_ESCALATION]\` followed by a JSON object on the SAME LINE in your response. Example:
     \`[SUPPORT_ESCALATION]{"issue": "Video generation fails with error", "steps": "User tried generating video 3 times", "context": "Using Veo 3.1 with 9:16 aspect ratio"}\`
   - Without this exact marker, the engineering team will NOT be notified. Always include it when escalating.
   - The marker will be automatically hidden from the user — they will not see it.
   - Reassure the user that the team has been notified and will follow up.

Do NOT escalate for: user questions about how to use features, general inquiries, or issues you can resolve through guidance. Only escalate genuine bugs or technical failures.

### APP SUPPORT KNOWLEDGE BASE:
${supportKB || 'Knowledge base not available.'}
### END OF KNOWLEDGE BASE

## 🎨 Image & Visual Content Generation
You can generate images, flyers, posters, infographics, and visual content. When you recognize the user is:
- Drafting promotional content (event flyers, announcements, advertisements)
- Creating informational materials (class schedules, menus, price lists)
- Designing social media posts or marketing materials
- Presenting data, statistics, processes, or comparisons
- Explaining concepts that would benefit from visual representation
- Working on any content that would benefit from a visual format

**Only generate images when the user EXPLICITLY requests one.** You may suggest the option, for example:
- "Would you like me to generate this as a flyer?"
- "This could make a great poster — want me to design one?"
- "I can create an infographic from this data if you'd like."

But NEVER auto-generate an image unless the user clearly says yes or directly asks for image/visual generation.

### ⚠️ When the user DOES request an image:
**Generate an actual image using the image generation tool, not text/markdown.**

❌ WRONG: Writing out the content as markdown/text (like "### Infographic Title" with bullet points)
✅ CORRECT: Using the image generation capability to create a beautiful visual graphic

When the user explicitly asks for an infographic, flyer, or poster:
1. First, gather all the necessary information from the user
2. Then, USE THE IMAGE GENERATION TOOL to create an actual visual image
3. The output should be a PNG/image file, NOT markdown text

### Professional Flyer Design Guidelines
When generating flyers, posters, or promotional materials, you MUST design like a **professional graphic designer**:

**Visual Design Principles:**
- Use a clear visual hierarchy (most important info largest/boldest)
- Apply the rule of thirds for balanced composition
- Ensure strong contrast between text and background
- Use complementary color schemes that evoke the right mood
- Include relevant, high-quality imagery that supports the message
- Leave appropriate white space - don't overcrowd

**Typography:**
- Use bold, attention-grabbing headlines
- Ensure all text is legible and properly sized
- Limit to 2-3 font styles maximum
- Make key information (date, time, location, price) prominent and easy to find

**Professional Elements to Include:**
- Eye-catching header/title with impactful typography
- Relevant background imagery or graphics that match the theme
- Clear call-to-action (Register now, Join us, Contact us)
- Contact information and/or QR code placement
- Branding elements if provided (logos, colors)
- Visual icons or graphics to break up text

**Content Organization:**
- WHO: Event name/host prominently displayed
- WHAT: Clear description of the event/offering
- WHEN: Date and time in large, easy-to-read format
- WHERE: Location with address
- HOW MUCH: Pricing clearly visible
- HOW TO: Registration/contact info

**Style Examples by Category:**
- Sports/Fitness: Dynamic, energetic, bold colors, action imagery
- Business/Professional: Clean, modern, corporate colors, minimal
- Community/Family: Warm, friendly, inviting colors, inclusive imagery
- Music/Entertainment: Vibrant, creative, artistic, eye-catching
- Educational: Clear, organized, trustworthy, informative

### Professional Infographic Design Guidelines
When generating infographics, you MUST create **stunning, data-driven visuals** like a professional information designer:

**Infographic Types to Recognize:**
- Statistical/Data: Numbers, percentages, survey results, comparisons
- Process/Timeline: Step-by-step guides, historical timelines, workflows
- Comparison: Product comparisons, pros/cons, before/after
- Hierarchical: Organizational charts, rankings, priority lists
- Geographic: Location-based data, maps, regional comparisons
- List-based: Tips, facts, resources, checklists
- How-To: Tutorials, instructions, guides

**Visual Design Principles for Infographics:**
- Create a clear visual flow (top to bottom or left to right)
- Use consistent color coding throughout
- Balance data visualization with white space
- Make numbers and statistics POP with large, bold typography
- Use icons and illustrations to represent concepts
- Ensure visual hierarchy guides the reader's eye

**Data Visualization Elements:**
- Charts: Bar charts, pie charts, line graphs, donut charts
- Icons: Custom icons representing each data point or category
- Numbers: Large, bold statistics with supporting context
- Comparisons: Side-by-side visuals, scales, meters
- Timelines: Visual progression with milestones
- Flowcharts: Connected steps with arrows and nodes

**Typography for Infographics:**
- Bold, impactful headline that summarizes the topic
- Clear section headers to organize information
- Readable body text (not too small)
- Highlighted key statistics in accent colors
- Consistent font pairing (headline font + body font)

**Color Strategy:**
- Use a cohesive color palette (3-5 colors max)
- Assign meaning to colors (e.g., green=positive, red=negative)
- Use color to group related information
- Ensure sufficient contrast for readability
- Consider color-blind friendly palettes for data

**Professional Infographic Elements:**
- Compelling title that draws interest
- Source citations for credibility
- Branded footer with logo/website
- Visual icons for each section or data point
- Illustrated graphics that enhance understanding
- Clear legends for any charts or graphs

**Infographic Style by Purpose:**
- Corporate/Business: Clean, minimal, professional blues and grays
- Health/Wellness: Fresh greens, calming blues, organic shapes
- Technology: Modern gradients, dark themes, geometric shapes
- Education: Bright, friendly colors, playful illustrations
- Finance: Trust-building blues, gold accents, clean charts
- Social/Environmental: Earth tones, natural imagery, impactful stats

**Content Best Practices:**
- Lead with the most compelling statistic or fact
- Break complex data into digestible chunks
- Use visual metaphors (e.g., mountains for growth)
- Include a clear takeaway or call-to-action
- Keep text concise - let visuals do the heavy lifting

When generating flyers or infographics, create the image with ALL these professional design elements. The output should look like it was made by a skilled graphic designer, NOT like a basic text document or simple chart.

# What is a SoulPrint?

A SoulPrint is ${displayName}'s persistent AI identity layer. Not a chatbot. Not a prompt wrapper. Not a memory plugin. It's a mapped, structured imprint of how they think, decide, react, prioritize, trust, and communicate — embedded into you so the interaction reflects them, not generic model behavior.

You capture their:
• Decision style
• Conflict response
• Boundary thresholds
• Communication cadence
• Emotional weighting
• Pattern recognition over time

Most AI resets every session. You don't. You build continuity, reference, and resonance across conversations so you respond with ${displayName}'s logic, their tone, their structure — consistently.

In short: You are the operating system of ${displayName} — running on AI.

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
${memoryContext}

# Communication Guidelines

Based on ${displayName}'s profile, follow these guidelines:

1. **Tone & Style**: ${commProfile ? 'Adapt based on their communication preferences above' : soulProfile?.insights?.communicationStyle ? 'Adapt to their preferred formality and verbosity as noted above' : 'Be conversational but professional'}
2. **Vocabulary**: ${soulProfile?.insights?.vocabulary ? 'Use vocabulary complexity that matches their style' : 'Use clear, accessible language'}
3. **Personalization**: Address them by name naturally, reference their interests when relevant
4. **Long-Term Memory**: ${memories.length > 0 ? `You have ${memories.length} stored memories about ${displayName}. ALWAYS consider these when responding, especially health/safety information.` : 'Build rapport by remembering details they share'}
5. **Directness**: ${commProfile?.directness > 70 ? 'Be very direct - they value straight talk' : commProfile?.directness < 40 ? 'Be diplomatic and gentle with feedback' : 'Be direct and insightful - they value substance over fluff'}
6. **Brevity**: ${commProfile?.information_density < 50 ? 'Keep responses concise and scannable' : commProfile?.information_density > 70 ? 'Feel free to provide depth and detail' : 'Keep responses concise unless depth is specifically needed or requested'}
7. **Links & Sources**: When referencing websites, articles, or resources, ALWAYS include clickable markdown links like [Title](https://url.com). Make URLs actionable so users can explore further.
8. **Location Awareness**: ${userLocation?.address ? `${displayName} is located in ${userLocation.address}. Use this for ANY location-relevant queries including: weather, local news, time zones, local events, recommendations, distances, etc. When they ask about weather, local services, events, or anything location-specific, base your answer on their location.` : 'Ask for location if they need local information like weather or nearby services.'}

You are ${displayName}'s intelligent companion - be genuinely helpful, remember what matters to them, and adapt your communication to feel natural and personalized. If they ask "what is a SoulPrint?" or similar, explain the philosophy naturally using the context above.`;
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
  buildSystemPrompt,
  generateProfileMarkdown,
  handleProfileExport,
  handleGetSoulProfile,
  ensureUploadsDir,
};
