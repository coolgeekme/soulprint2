/**
 * SoulPrint Memory SDK — TypeScript Definitions
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type MemoryCategory = 'health' | 'preferences' | 'personal' | 'work' | 'relationships' | 'goals' | 'other';
export type ImportanceLevel = 'high' | 'medium' | 'low';

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: ImportanceLevel;
  source: 'auto' | 'manual' | 'import';
  conversationId: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExtractedMemory {
  content: string;
  category: string;
  importance: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractionPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export function buildExtractionPrompt(userMessage: string, assistantResponse: string): ExtractionPrompt;
export function parseExtractionResponse(llmResponse: string): ExtractedMemory[];
export function isDuplicate(newContent: string, existingMemories: { content: string }[]): boolean;
export function deduplicateMemories(newMemories: ExtractedMemory[], existingMemories: { content: string }[]): ExtractedMemory[];

export const MEMORY_CATEGORIES: MemoryCategory[];
export const IMPORTANCE_LEVELS: ImportanceLevel[];

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY STORE
// ═══════════════════════════════════════════════════════════════════════════════

export interface MemoryStoreOptions {
  maxMemories?: number;
  promptLimit?: number;
  generateId?: () => string;
}

export class MemoryStore {
  constructor(options?: MemoryStoreOptions);
  add(userId: string, memory: { content: string; category?: string; importance?: string; source?: string; conversationId?: string }): Memory | null;
  addBatch(userId: string, memories: ExtractedMemory[], conversationId?: string): Memory[];
  getAll(userId: string, filter?: { category?: string }): Memory[];
  getForPrompt(userId: string): Memory[];
  update(userId: string, memoryId: string, updates: { content?: string; category?: string; importance?: string }): boolean;
  delete(userId: string, memoryId: string): boolean;
  clear(userId: string): void;
  count(userId: string): number;
  export(userId: string): Omit<Memory, 'updated_at'>[];
  import(userId: string, memories: Partial<Memory>[]): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

export interface Location {
  address?: string;
  lat?: number;
  lng?: number;
  timezone?: string;
}

export interface SoulProfileInsights {
  communicationStyle?: Record<string, { formality?: string; verbosity?: string; tone?: string; description?: string }>;
  interests?: string[];
  vocabulary?: Record<string, { complexity?: string; uniquePhrases?: string[]; emoji_usage?: string }>;
  questionStyle?: Record<string, string>;
  insights?: string[];
  latestSummary?: string;
  sources?: string[];
}

export interface AssessmentAnswer {
  pillar: string;
  question: string;
  answer: string;
}

export interface Capabilities {
  vision?: boolean;
  webSearch?: boolean;
  imageGeneration?: boolean;
  videoGeneration?: boolean;
}

export interface SystemPromptContext {
  userName: string;
  assistantName?: string;
  descriptors?: string[];
  field?: string;
  helpWith?: string[];
  location?: Location;
  memories?: Memory[];
  assessmentAnswers?: AssessmentAnswer[];
  soulProfile?: SoulProfileInsights;
  personaPrompt?: string;
  communicationProfile?: string;
  supportKnowledgeBase?: string;
  connectedAccounts?: string[];
  capabilities?: Capabilities;
}

export function formatMemoriesForPrompt(memories: Memory[], userName?: string): string;
export function formatDateTimeContext(timezone?: string): string;
export function formatLocationContext(location: Location | null): string;
export function formatAssessmentContext(answers: AssessmentAnswer[], limit?: number): string;
export function formatSoulProfileContext(insights: SoulProfileInsights | null): string;
export function buildSystemPrompt(context: SystemPromptContext): string;

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProfileExportData {
  userName?: string;
  email?: string;
  assistantName?: string;
  descriptors?: string[];
  field?: string;
  helpWith?: string[];
  soulProfile?: SoulProfileInsights;
  assessmentAnswers?: AssessmentAnswer[];
  imports?: { date: string; source: string; status: string }[];
  memories?: Memory[];
}

export function generateProfileMarkdown(data: ProfileExportData): string;

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT CACHE
// ═══════════════════════════════════════════════════════════════════════════════

export interface PromptCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

export class PromptCache {
  constructor(options?: PromptCacheOptions);
  get(key: string): string | null;
  set(key: string, value: string): void;
  invalidate(key?: string): void;
  has(key: string): boolean;
  readonly size: number;
}
