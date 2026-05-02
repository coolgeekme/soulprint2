/**
 * SoulPrint Memory SDK
 *
 * A framework-agnostic long-term memory and context management system
 * for AI companions. Extracts, stores, and retrieves persistent facts
 * from conversations, then assembles them into rich system prompts.
 *
 * Drop this folder into any project and import from here.
 *
 * @example
 * import { MemoryStore, buildExtractionPrompt, parseExtractionResponse, buildSystemPrompt } from './index.js';
 *
 * // 1. Create a memory store
 * const store = new MemoryStore();
 *
 * // 2. Extract memories from a conversation
 * const { systemPrompt, userPrompt } = buildExtractionPrompt(userMsg, aiResponse);
 * const llmResult = await yourLLM.complete(systemPrompt, userPrompt);
 * const memories = parseExtractionResponse(llmResult);
 *
 * // 3. Store them
 * store.addBatch('user_123', memories, 'conv_456');
 *
 * // 4. Build a system prompt with memories included
 * const prompt = buildSystemPrompt({
 *   userName: 'Alex',
 *   memories: store.getForPrompt('user_123'),
 * });
 */

// Memory Extraction
export {
  MEMORY_CATEGORIES,
  IMPORTANCE_LEVELS,
  buildExtractionPrompt,
  parseExtractionResponse,
  isDuplicate,
  deduplicateMemories,
} from './memory-extractor.js';

// Memory Storage
export { MemoryStore } from './memory-store.js';

// System Prompt Building
export {
  formatMemoriesForPrompt,
  formatDateTimeContext,
  formatLocationContext,
  formatAssessmentContext,
  formatSoulProfileContext,
  buildSystemPrompt,
} from './system-prompt-builder.js';

// Profile Export
export { generateProfileMarkdown } from './profile-exporter.js';

// Prompt Caching
export { PromptCache } from './prompt-cache.js';
