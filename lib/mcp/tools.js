// SoulPrint MCP tool definitions — mirror soulprint-mcp/src/soulprint_mcp/server.py TOOLS.
// The wire format for tools/list uses camelCase `inputSchema` (MCP spec).

export const TOOLS = [
  {
    name: 'soulprint_get_profile',
    description:
      'Return your full SoulPrint identity profile: name, descriptors, SoulPrint summary, communication style, values, interests, and the 4 communication trait axes (directness/warmth/detail/proactivity). Use this to understand HOW to communicate with the user.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'soulprint_get_memories',
    description:
      'Search your SoulPrint memories for facts relevant to a query. Uses the same context-based ranking as the SoulPrint browser extension (keyword/synonym/entity overlap + importance + recency).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "What you want to find (e.g., 'pizza preferences')" },
        limit: { type: 'integer', description: 'Max memories to return (default 8)' },
      },
      required: ['query'],
    },
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
  },
  {
    name: 'soulprint_list_imprints',
    description:
      'List your Imprints: the currently active one, your installed and custom-created imprints, and the marketplace catalog available to install.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'soulprint_set_imprint',
    description:
      "Select (activate) an Imprint so the AI takes on that role, tone and style. Set usage_type 'default' for your global imprint, or 'project' with a project_id to scope it to one project.",
    inputSchema: {
      type: 'object',
      properties: {
        imprint_id: { type: 'string', description: 'Imprint id (from soulprint_list_imprints)' },
        usage_type: { type: 'string', enum: ['default', 'project'], description: "Scope: 'default' (global) or 'project'" },
        project_id: { type: 'string', description: "Required when usage_type is 'project'" },
      },
      required: ['imprint_id'],
    },
  },
  {
    name: 'soulprint_add_memory',
    description: 'Save a new memory about the user.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The memory text (at least 3 characters)' },
        category: { type: 'string', description: 'health, preferences, personal, work, relationships, goals, or other' },
        importance: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Memory importance (default medium)' },
      },
      required: ['content'],
    },
  },
  {
    name: 'soulprint_update_memory',
    description: "Edit an existing memory's content, category, or importance.",
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
  },
  {
    name: 'soulprint_delete_memory',
    description: 'Delete a memory by id.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'Memory id to delete' },
      },
      required: ['memory_id'],
    },
  },
];
