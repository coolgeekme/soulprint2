# SoulPrint Memory SDK

A framework-agnostic long-term memory and context management system for AI companions. Extracts, stores, and retrieves persistent facts from conversations, then assembles them into rich system prompts.

Drop these files into any JavaScript/TypeScript project. Zero dependencies.

## Files

| File | Purpose |
|------|---------|
| `index.js` | Main entry point — re-exports everything |
| `memory-extractor.js` | AI extraction prompts, response parsing, deduplication |
| `memory-store.js` | In-memory store with CRUD, categorization, importance sorting |
| `system-prompt-builder.js` | Assembles all context sources into a complete LLM system prompt |
| `profile-exporter.js` | Generates markdown exports of the full user profile |
| `prompt-cache.js` | TTL cache for expensive system prompt builds |
| `types.d.ts` | TypeScript definitions |
| `THEORY.md` | Research foundations — cognitive science behind the architecture |

## Quick Start

```javascript
import { MemoryStore, buildExtractionPrompt, parseExtractionResponse, buildSystemPrompt } from './index.js';

// 1. Create a store
const store = new MemoryStore();

// 2. After each conversation exchange, extract memories
const { systemPrompt, userPrompt } = buildExtractionPrompt(
  'My wife Sarah and I just moved to Austin',
  'That sounds exciting! Austin is a great city.'
);

// 3. Send to any LLM for extraction
const llmResult = await yourLLM.complete({ system: systemPrompt, user: userPrompt });
const memories = parseExtractionResponse(llmResult);
// → [{ content: 'Married, spouse named Sarah', category: 'relationships', importance: 'medium' },
//    { content: 'Lives in Austin, TX', category: 'personal', importance: 'medium' }]

// 4. Store (auto-deduplicates)
store.addBatch('user_123', memories, 'conv_456');

// 5. Build system prompt with memories included
const prompt = buildSystemPrompt({
  userName: 'Alex',
  memories: store.getForPrompt('user_123'),
  location: { address: 'Austin, TX', timezone: 'America/Chicago' },
});
```

## Memory Store

```javascript
import { MemoryStore } from './memory-store.js';

const store = new MemoryStore({
  maxMemories: 200,    // Per user
  promptLimit: 50,     // Max memories in system prompt
});

// Add manually
store.add('user_123', {
  content: 'Allergic to peanuts',
  category: 'health',
  importance: 'high',
});

// Add from extraction
store.addBatch('user_123', extractedMemories, 'conversation_id');

// Retrieve
store.getAll('user_123');                          // All memories, sorted by importance
store.getAll('user_123', { category: 'health' });  // Just health memories
store.getForPrompt('user_123');                    // Top 50 for system prompt

// CRUD
store.update('user_123', 'mem_id', { importance: 'high' });
store.delete('user_123', 'mem_id');
store.clear('user_123');

// Import/Export (for database sync)
const data = store.export('user_123');
store.import('user_123', data);
```

## System Prompt Builder

```javascript
import { buildSystemPrompt } from './system-prompt-builder.js';

const prompt = buildSystemPrompt({
  userName: 'Alex',
  assistantName: 'Nova',
  descriptors: ['Founder', 'Designer'],
  field: 'Technology',
  helpWith: ['Product strategy', 'Writing'],
  location: { address: 'Austin, TX', timezone: 'America/Chicago' },
  memories: store.getForPrompt('user_123'),
  assessmentAnswers: [
    { pillar: 'communication', question: 'How direct are you?', answer: 'Very direct' },
  ],
  soulProfile: {
    interests: ['AI', 'Design', 'Music'],
    latestSummary: 'Creative technologist with a focus on user experience.',
  },
  personaPrompt: '=== YOUR PERSONA... ===',   // From the Persona SDK
  capabilities: {
    vision: true,
    webSearch: true,
    imageGeneration: true,
    videoGeneration: false,
  },
  connectedAccounts: ['alex@gmail.com'],
});
```

## Memory Extraction

```javascript
import { buildExtractionPrompt, parseExtractionResponse, deduplicateMemories } from './memory-extractor.js';

// Build the prompt
const { systemPrompt, userPrompt } = buildExtractionPrompt(userMessage, aiResponse);

// Send to your LLM (provider-agnostic)
const result = await anyLLM({ system: systemPrompt, user: userPrompt });

// Parse the response
const extracted = parseExtractionResponse(result);

// Filter out duplicates against existing memories
const existingMemories = store.getAll('user_123');
const newMemories = deduplicateMemories(extracted, existingMemories);
```

## Prompt Cache

```javascript
import { PromptCache } from './prompt-cache.js';

const cache = new PromptCache({
  ttlMs: 5 * 60 * 1000,  // 5 minutes
  maxEntries: 1000,
});

// Check cache before building
let prompt = cache.get('user_123');
if (!prompt) {
  prompt = buildSystemPrompt({ ... });
  cache.set('user_123', prompt);
}

// Invalidate when data changes
cache.invalidate('user_123');  // Single user
cache.invalidate();            // All users
```

## Profile Export

```javascript
import { generateProfileMarkdown } from './profile-exporter.js';

const markdown = generateProfileMarkdown({
  userName: 'Alex',
  email: 'alex@example.com',
  memories: store.export('user_123'),
  soulProfile: { interests: ['AI', 'Music'] },
});
// Returns a complete markdown document
```

## The 7 Memory Categories

| Category | What It Stores | Priority |
|----------|---------------|----------|
| **Health** | Allergies, conditions, medications | ⚠️ Always surfaced first |
| **Preferences** | Favorites, dislikes, taste | Personalization |
| **Personal** | Dates, location, life events | Context |
| **Work** | Job, company, career | Professional |
| **Relationships** | Family, friends, pets | Social context |
| **Goals** | Aspirations, plans | Forward-looking |
| **Other** | Everything else | Catch-all |

See `THEORY.md` for the full cognitive science behind the memory architecture.

## Zero Dependencies

No npm packages required. Pure JavaScript with optional TypeScript definitions.
Works in Node.js, Deno, Bun, browsers, or any JS runtime.

The `MemoryStore` is in-memory by default — swap it out with your own database adapter for persistence.
