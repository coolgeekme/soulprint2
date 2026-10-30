// SoulPrint MCP tool definitions — mirror soulprint-mcp/src/soulprint_mcp/server.py TOOLS.
// The wire format for tools/list uses camelCase `inputSchema` (MCP spec).
//
// `annotations.readOnlyHint` is REQUIRED for the write tools: without it, Claude's
// connector treats every tool as read-only and refuses to add/update/delete memories.
// readOnlyHint:true = safe read, false = mutates state. destructiveHint:true on delete
// makes Claude confirm before deleting. idempotentHint:true = safe to retry.

export const TOOLS = [
  {
    name: 'soulprint_get_profile',
    description:
      'Return your full SoulPrint identity profile: name, descriptors, SoulPrint summary, communication style, values, interests, and the 4 communication trait axes (directness/warmth/detail/proactivity). Use this to understand HOW to communicate with the user.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'soulprint_get_memories',
    description:
      'Search your SoulPrint memories for facts relevant to a query, using the same ranking as the SoulPrint browser extension (keyword/synonym/entity overlap + importance + recency). OMIT `query` to browse instead of search — that lists memories newest-first and is the only way to enumerate the whole store. Every entry carries `created_at`, `updated_at` and `last_verified_at` (ISO 8601), so questions like "was anything saved today?" are answerable directly; the response also carries `newest_at`, the most recent save in the whole store. It carries `total`, `returned` and `has_more` as well: when `total` exceeds `returned` you have a PAGE, not the whole store — page with `offset: next_offset` until `has_more` is false before describing an audit as complete.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "What you want to find (e.g., 'pizza preferences'). Omit entirely to browse all memories newest-first." },
        limit: { type: 'integer', description: 'Max memories to return per call (default 8, max 500)' },
          offset: { type: 'integer', description: 'Skip this many results. Use next_offset from the previous response to page through everything.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'soulprint_get_context',
    description:
      'Return the exact framed context the SoulPrint browser extension injects — identity profile + relevant memories, wrapped in [Authoritative context about the user: ...]. Use this at the start of a task so you personalize to the user the same way the extension does.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the user is asking about — used to find relevant memories' },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'soulprint_list_imprints',
    description:
      'List your Imprints: the currently active one, your installed and custom-created imprints, and the marketplace catalog available to install.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'soulprint_set_imprint',
    description:
      "Select (activate) an Imprint so the AI takes on that role, tone and style. Set usage_type 'default' for your global imprint, or 'project' with a project_id to scope it to one project. Ask the user which Imprint before calling this — switching roles is a visible change to how you respond, so confirm first.",
    inputSchema: {
      type: 'object',
      properties: {
        imprint_id: { type: 'string', description: 'Imprint id (from soulprint_list_imprints)' },
        usage_type: { type: 'string', enum: ['default', 'project'], description: "Scope: 'default' (global) or 'project'" },
        project_id: { type: 'string', description: "Required when usage_type is 'project'" },
      },
      required: ['imprint_id'],
    },
    annotations: { readOnlyHint: false, idempotentHint: true },
  },
  {
    name: 'soulprint_add_memory',
    description:
      'Save a new memory about the user. Be proactive: when you learn a durable fact about them — a preference, personal detail, goal, relationship, or piece of work context — save it without waiting to be asked, so future conversations are personalized. Skip ephemeral details and anything the user clearly wants kept private. If unsure what is already saved, call soulprint_suggest_memories first to get deduplicated candidates.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The memory text (at least 3 characters)' },
        category: { type: 'string', description: 'health, preferences, personal, work, relationships, goals, or other' },
        importance: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Memory importance (default medium)' },
      },
      required: ['content'],
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'soulprint_sweep',
    description:
      'Save MANY memories in one call — use this at the end of a session to capture what you learned, '
      + 'or when the user asks you to sweep the conversation into SoulPrint. Pass every durable fact worth keeping '
      + 'as an array; the server runs each one through the same deduplication gate as soulprint_add_memory, so '
      + 'you do NOT need to check for duplicates first and should not try. Repeated facts reinforce the existing '
      + 'record instead of creating a copy, and ambiguous near-matches are flagged for the user to review rather '
      + 'than merged. Returns per-item outcomes plus a summary. Prefer this over many soulprint_add_memory calls. '
      + 'Skip ephemeral details and anything the user wants kept private.',
    inputSchema: {
      type: 'object',
      properties: {
        memories: {
          type: 'array',
          maxItems: 100,
          description: 'Facts to save. Each item is a plain string, or an object with content/category/importance.',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'The memory text (at least 3 characters)' },
              category: { type: 'string', description: 'health, preferences, personal, work, relationships, goals, or other' },
              importance: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Default medium' },
            },
            required: ['content'],
          },
        },
      },
      required: ['memories'],
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'soulprint_suggest_memories',
    description:
      'Mine a recent user/assistant exchange for durable facts about the user worth saving to SoulPrint. Runs the same extraction engine as the browser extension and returns DEDUPLICATED candidates (facts already saved are excluded). Nothing is saved by this call — save the durable, relevant candidates with soulprint_add_memory.',
    inputSchema: {
      type: 'object',
      properties: {
        user_message: { type: 'string', description: "The user's message(s) to mine for durable facts" },
        assistant_message: { type: 'string', description: 'The assistant reply (optional context for extraction)' },
      },
      required: ['user_message'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'soulprint_update_memory',
    description: "Edit an existing memory's content, category, or importance. Ask the user before calling this — read back the memory and the proposed change, and only proceed once they approve.",
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'Memory id (from soulprint_get_memories)' },
        content: { type: 'string', description: 'New memory text' },
        category: { type: 'string', description: 'health, preferences, personal, work, relationships, goals, or other' },
        importance: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['memory_id'],
    },
    annotations: { readOnlyHint: false, idempotentHint: true },
  },
  {
    name: 'soulprint_delete_memory',
    description: 'Delete a memory by id. This is destructive and cannot be undone — always confirm with the user first, naming the memory you are about to delete.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'Memory id to delete' },
      },
      required: ['memory_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
];
