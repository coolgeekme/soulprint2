/**
 * Memory Extractor — AI-powered extraction of persistent facts from conversations.
 *
 * Provides the prompt engineering and response parsing logic for identifying
 * memorable facts within conversation exchanges. The actual LLM call is
 * delegated to whatever provider you use — this module is provider-agnostic.
 *
 * Zero dependencies. Pure JavaScript.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const MEMORY_CATEGORIES = [
  'health',         // Allergies, conditions, medications, dietary needs
  'preferences',    // Favorite foods, colors, activities, dislikes
  'personal',       // Important dates, location, living situation
  'work',           // Job title, company, projects, career goals
  'relationships',  // Spouse, children, pets, family, friends
  'goals',          // Aspirations, plans, milestones
  'other',          // Anything that doesn't fit above
];

export const IMPORTANCE_LEVELS = ['high', 'medium', 'low'];

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTION PROMPT — The core prompt that powers memory extraction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the extraction prompt for a conversation exchange.
 *
 * @param {string} userMessage - What the user said
 * @param {string} assistantResponse - What the AI responded
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildExtractionPrompt(userMessage, assistantResponse) {
  const systemPrompt = 'You are a memory extraction system. Return only valid JSON arrays.';

  const userPrompt = `Analyze this conversation exchange and extract any important facts about the user that should be remembered for future conversations.

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
- "category": One of: ${MEMORY_CATEGORIES.join(', ')}
- "importance": "high" (health/safety), "medium" (useful context), or "low" (nice to know)

If no important facts are found, return an empty array: []

IMPORTANT:
- Only extract NEW facts, not general conversation
- Be specific: "allergic to peanuts" not "has food allergies"
- Don't extract opinions or temporary states
- Return ONLY valid JSON array, nothing else`;

  return { systemPrompt, userPrompt };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE PARSER — Extracts structured memories from LLM output
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse the LLM's response into structured memory objects.
 *
 * @param {string} llmResponse - Raw text response from the LLM
 * @returns {Array<{ content: string, category: string, importance: string }>}
 */
export function parseExtractionResponse(llmResponse) {
  if (!llmResponse || typeof llmResponse !== 'string') return [];

  try {
    // Find JSON array in the response (LLMs sometimes add extra text)
    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    // Validate and normalize each memory
    return parsed
      .filter(mem => mem && typeof mem.content === 'string' && mem.content.trim().length >= 5)
      .map(mem => ({
        content: mem.content.trim(),
        category: MEMORY_CATEGORIES.includes(mem.category) ? mem.category : 'other',
        importance: IMPORTANCE_LEVELS.includes(mem.importance) ? mem.importance : 'medium',
      }));
  } catch (e) {
    // JSON parsing failed — return empty
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEDUPLICATION — Check if a new memory is redundant
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a new memory is a duplicate of any existing memory.
 * Uses substring matching on the first 30 characters (case-insensitive).
 *
 * @param {string} newContent - The new memory's content
 * @param {Array<{ content: string }>} existingMemories - Array of existing memories
 * @returns {boolean} true if duplicate found
 */
export function isDuplicate(newContent, existingMemories) {
  if (!newContent || !Array.isArray(existingMemories)) return false;

  const prefix = newContent.substring(0, 30).toLowerCase();

  return existingMemories.some(existing => {
    if (!existing?.content) return false;
    return existing.content.toLowerCase().includes(prefix)
      || prefix.includes(existing.content.substring(0, 30).toLowerCase());
  });
}

/**
 * Filter out duplicate memories from an extraction result.
 *
 * @param {Array<{ content: string, category: string, importance: string }>} newMemories
 * @param {Array<{ content: string }>} existingMemories
 * @returns {Array<{ content: string, category: string, importance: string }>}
 */
export function deduplicateMemories(newMemories, existingMemories) {
  if (!Array.isArray(newMemories)) return [];
  if (!Array.isArray(existingMemories) || existingMemories.length === 0) return newMemories;

  return newMemories.filter(mem => !isDuplicate(mem.content, existingMemories));
}
