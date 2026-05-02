/**
 * Memory Store — In-memory storage for user memories.
 *
 * A simple, framework-agnostic store that manages memories with
 * categorization, importance scoring, retrieval, and CRUD operations.
 * Use this as-is for prototyping, or replace the storage backend
 * with your own database adapter.
 *
 * Zero dependencies. Pure JavaScript.
 */

import { MEMORY_CATEGORIES, IMPORTANCE_LEVELS, isDuplicate } from './memory-extractor.js';

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTANCE SORT ORDER
// ═══════════════════════════════════════════════════════════════════════════════

const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 };

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY STORE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class MemoryStore {
  /**
   * @param {object} [options]
   * @param {number} [options.maxMemories=200] - Maximum memories per user
   * @param {number} [options.promptLimit=50] - Maximum memories to include in prompts
   * @param {Function} [options.generateId] - Custom ID generator (default: timestamp + random)
   */
  constructor(options = {}) {
    this.maxMemories = options.maxMemories || 200;
    this.promptLimit = options.promptLimit || 50;
    this.generateId = options.generateId || (() => `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    
    // userId → Memory[]
    this._store = new Map();
  }

  // ── CRUD Operations ────────────────────────────────────────────────────────

  /**
   * Add a memory for a user.
   *
   * @param {string} userId
   * @param {{ content: string, category?: string, importance?: string, source?: string, conversationId?: string }} memory
   * @returns {{ id: string, content: string, category: string, importance: string, source: string, created_at: Date } | null}
   *   Returns null if duplicate or invalid.
   */
  add(userId, memory) {
    if (!userId || !memory?.content || memory.content.trim().length < 3) return null;

    const existing = this._getOrCreate(userId);

    // Deduplication check
    if (isDuplicate(memory.content, existing)) return null;

    const doc = {
      id: this.generateId(),
      content: memory.content.trim(),
      category: MEMORY_CATEGORIES.includes(memory.category) ? memory.category : 'other',
      importance: IMPORTANCE_LEVELS.includes(memory.importance) ? memory.importance : 'medium',
      source: memory.source || 'manual',
      conversationId: memory.conversationId || null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    existing.push(doc);

    // Enforce max limit — evict lowest importance, oldest first
    if (existing.length > this.maxMemories) {
      existing.sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] || b.created_at - a.created_at);
      existing.length = this.maxMemories;
    }

    return doc;
  }

  /**
   * Add multiple extracted memories at once.
   *
   * @param {string} userId
   * @param {Array<{ content: string, category?: string, importance?: string }>} memories
   * @param {string} [conversationId]
   * @returns {Array} Successfully added memories
   */
  addBatch(userId, memories, conversationId = null) {
    if (!Array.isArray(memories)) return [];
    return memories
      .map(m => this.add(userId, { ...m, source: 'auto', conversationId }))
      .filter(Boolean);
  }

  /**
   * Get all memories for a user, optionally filtered by category.
   *
   * @param {string} userId
   * @param {{ category?: string }} [filter]
   * @returns {Array}
   */
  getAll(userId, filter = {}) {
    const memories = this._store.get(userId) || [];
    let result = [...memories];

    if (filter.category && MEMORY_CATEGORIES.includes(filter.category)) {
      result = result.filter(m => m.category === filter.category);
    }

    // Sort: high importance first, then most recent
    result.sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] || b.created_at - a.created_at);

    return result;
  }

  /**
   * Get memories formatted for inclusion in an LLM system prompt.
   * Returns up to `promptLimit` memories, prioritized by importance.
   *
   * @param {string} userId
   * @returns {Array}
   */
  getForPrompt(userId) {
    return this.getAll(userId).slice(0, this.promptLimit);
  }

  /**
   * Update a specific memory.
   *
   * @param {string} userId
   * @param {string} memoryId
   * @param {{ content?: string, category?: string, importance?: string }} updates
   * @returns {boolean} true if found and updated
   */
  update(userId, memoryId, updates) {
    const memories = this._store.get(userId);
    if (!memories) return false;

    const mem = memories.find(m => m.id === memoryId);
    if (!mem) return false;

    if (updates.content !== undefined) mem.content = updates.content.trim();
    if (updates.category && MEMORY_CATEGORIES.includes(updates.category)) mem.category = updates.category;
    if (updates.importance && IMPORTANCE_LEVELS.includes(updates.importance)) mem.importance = updates.importance;
    mem.updated_at = new Date();

    return true;
  }

  /**
   * Delete a specific memory.
   *
   * @param {string} userId
   * @param {string} memoryId
   * @returns {boolean} true if found and deleted
   */
  delete(userId, memoryId) {
    const memories = this._store.get(userId);
    if (!memories) return false;

    const idx = memories.findIndex(m => m.id === memoryId);
    if (idx === -1) return false;

    memories.splice(idx, 1);
    return true;
  }

  /**
   * Delete all memories for a user.
   * @param {string} userId
   */
  clear(userId) {
    this._store.delete(userId);
  }

  /**
   * Get memory count for a user.
   * @param {string} userId
   * @returns {number}
   */
  count(userId) {
    return (this._store.get(userId) || []).length;
  }

  // ── Import/Export ─────────────────────────────────────────────────────────

  /**
   * Export all memories for a user as a plain array.
   * @param {string} userId
   * @returns {Array}
   */
  export(userId) {
    return this.getAll(userId).map(m => ({
      id: m.id,
      content: m.content,
      category: m.category,
      importance: m.importance,
      source: m.source,
      created_at: m.created_at,
    }));
  }

  /**
   * Import memories from an external source (e.g., database dump).
   * @param {string} userId
   * @param {Array} memories
   */
  import(userId, memories) {
    if (!Array.isArray(memories)) return;
    const store = this._getOrCreate(userId);
    for (const m of memories) {
      if (m.content && m.content.trim().length >= 3) {
        store.push({
          id: m.id || this.generateId(),
          content: m.content.trim(),
          category: MEMORY_CATEGORIES.includes(m.category) ? m.category : 'other',
          importance: IMPORTANCE_LEVELS.includes(m.importance) ? m.importance : 'medium',
          source: m.source || 'import',
          conversationId: m.conversationId || null,
          created_at: m.created_at ? new Date(m.created_at) : new Date(),
          updated_at: new Date(),
        });
      }
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _getOrCreate(userId) {
    if (!this._store.has(userId)) {
      this._store.set(userId, []);
    }
    return this._store.get(userId);
  }
}
