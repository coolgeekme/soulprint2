# SoulPrint Agent Platform — Product Specification
### Self-Serve AI Agent Builder (Wingman-Style)
**Version:** 1.0 Draft
**Date:** April 2026
**Status:** Pre-Development (Blocked on: Billing Phases 3-6)

---

## 1. Vision

Enable any user to create, customize, and deploy their own AI agents — each with unique personalities, tools, knowledge bases, and shareable endpoints. SoulPrint becomes the platform where AI agents are born, trained, and put to work.

---

## 2. User Personas

| Persona | Description | Goal |
|---|---|---|
| **Creator** | Non-technical user who wants a custom AI assistant | Build an agent without code |
| **Developer** | Technical user who wants API access + tool integrations | Build agents with custom tools and embed them |
| **Team Lead** | Manages a workspace with multiple agents and team members | Organize, monitor, and control agent access |
| **End User** | Person interacting with a deployed agent (via link or embed) | Get answers, complete tasks |

---

## 3. Core Concepts

### 3.1 Agent
A configured AI assistant with:
- **Identity**: Name, avatar, description
- **Instructions**: System prompt defining behavior, personality, boundaries
- **Model**: Which LLM powers it (GPT-4o, Gemini, Claude, etc.)
- **Tools**: What actions it can take (web search, API calls, code execution, etc.)
- **Knowledge**: Uploaded documents, URLs, or pasted context the agent can reference
- **Settings**: Temperature, max tokens, response style, greeting message

### 3.2 Workspace
A container for agents, team members, and billing:
- Each user gets a default workspace on signup
- Workspaces can have multiple agents
- Team members can be invited with role-based access (Owner, Editor, Viewer)

### 3.3 Tool
A capability an agent can invoke during a conversation:
- Built-in tools (provided by platform)
- Custom tools (user-defined API endpoints)
- Each tool has a name, description, input schema, and execution logic
- The LLM decides when to call a tool based on the conversation

### 3.4 Knowledge Base
Per-agent document store:
- Upload files (PDF, TXT, DOCX, CSV, MD)
- Paste URLs (scraped and indexed)
- Paste raw text
- Content is chunked, embedded, and stored for vector retrieval (RAG)

### 3.5 Deployment
Each agent gets:
- A unique chat URL (`/agent/{agent_slug}`)
- An embeddable widget (iframe or JS snippet)
- An API endpoint for programmatic access
- Optional: password protection, domain restriction

---

## 4. Feature Breakdown by Phase

### Phase 1: Agent CRUD + Basic Chat Runtime (MVP)
**Goal:** Users can create agents and chat with them.

**Features:**
- Agent creation form: name, description, avatar (emoji or upload), system instructions, model picker, temperature slider
- Agent list/dashboard: view all agents in workspace
- Agent edit/delete
- Agent chat interface: dedicated chat page per agent using existing NDJSON streaming
- Greeting message configuration
- Basic agent settings (max response length, creativity slider)
- Agent visibility toggle (private / anyone with link)

**Data Model:**
```
agents {
  id: UUID
  workspace_id: UUID
  name: String
  slug: String (unique, URL-safe)
  description: String
  avatar: String (emoji or URL)
  system_prompt: String
  model: String (e.g., "gpt-4o", "gemini-2.0-flash", "claude-sonnet")
  temperature: Float (0-2)
  max_tokens: Int
  greeting_message: String
  visibility: Enum ("private", "unlisted", "public")
  tools: Array<ToolReference>
  created_by: UUID (user_id)
  created_at: DateTime
  updated_at: DateTime
  is_active: Boolean
}
```

**API Endpoints:**
- `POST /api/agents` — Create agent
- `GET /api/agents` — List user's agents
- `GET /api/agents/:id` — Get agent details
- `PUT /api/agents/:id` — Update agent
- `DELETE /api/agents/:id` — Delete agent
- `POST /api/agents/:id/chat` — Stream chat with agent (NDJSON)
- `GET /agent/:slug` — Public chat page (frontend route)

**UI Pages:**
- `/agents` — Agent dashboard (list, create new)
- `/agents/:id/edit` — Agent builder/editor
- `/agents/:id/chat` — Agent chat (owner testing)
- `/agent/:slug` — Public/shared agent chat page

---

### Phase 2: Tool System
**Goal:** Agents can take actions beyond just generating text.

**Built-in Tools:**
| Tool | Description |
|---|---|
| `web_search` | Search the web and return summarized results |
| `url_reader` | Fetch and read content from a URL |
| `calculator` | Evaluate mathematical expressions |
| `code_runner` | Execute Python/JS code snippets (sandboxed) |
| `image_generator` | Generate images via existing Kie.ai/OpenAI integrations |
| `current_time` | Return current date/time/timezone |
| `json_api` | Make HTTP requests to external APIs |

**Custom Tools (User-Defined):**
- Name, description, input JSON schema
- Endpoint URL + method + headers
- Authentication (API key, Bearer token)
- Response mapping (what to extract and pass back to LLM)

**Data Model:**
```
tools {
  id: UUID
  workspace_id: UUID
  name: String
  description: String
  type: Enum ("builtin", "custom")
  builtin_key: String (for built-in tools)
  config: Object {
    url: String
    method: String
    headers: Object
    auth_type: String
    input_schema: JSON Schema
    response_path: String
  }
  created_by: UUID
  created_at: DateTime
}

agent_tools {
  agent_id: UUID
  tool_id: UUID
  enabled: Boolean
}
```

**Runtime Flow:**
1. User sends message → Agent runtime receives it
2. Build messages array: system prompt + conversation history + user message
3. Include tool definitions in LLM call (OpenAI function calling / tool_use format)
4. If LLM returns tool_call → execute tool → append result → call LLM again
5. Loop until LLM returns a final text response (max 5 tool calls per turn)
6. Stream final response to client

---

### Phase 3: Knowledge Base (RAG)
**Goal:** Agents can reference uploaded documents to answer questions accurately.

**Features:**
- Per-agent knowledge base management UI
- File upload: PDF, DOCX, TXT, CSV, MD (max 50MB per file)
- URL import: scrape and index web pages
- Text paste: direct input
- Processing pipeline: extract text → chunk (512 tokens, 50 token overlap) → embed → store
- At query time: embed user query → vector similarity search → inject top-K chunks into context
- Source citations in agent responses

**Data Model:**
```
knowledge_sources {
  id: UUID
  agent_id: UUID
  type: Enum ("file", "url", "text")
  name: String
  content_hash: String
  status: Enum ("processing", "ready", "error")
  metadata: Object { file_size, page_count, url, etc. }
  created_at: DateTime
}

knowledge_chunks {
  id: UUID
  source_id: UUID
  agent_id: UUID
  content: String
  embedding: Array<Float> (1536-dim for OpenAI, etc.)
  chunk_index: Int
  metadata: Object { page, section, etc. }
}
```

**Embedding Strategy:**
- Use OpenAI `text-embedding-3-small` (cheap, fast, 1536-dim)
- Store embeddings in MongoDB with vector search index (Atlas Vector Search)
- Fallback: in-memory cosine similarity for local dev

**Retrieval at Query Time:**
1. Embed user's message
2. Vector search → top 5 most relevant chunks
3. Prepend to system prompt as `[CONTEXT]` block
4. LLM generates response grounded in the retrieved context

---

### Phase 4: Shareable Deploy + Embed Widget
**Goal:** Anyone can interact with a deployed agent via link or embedded widget.

**Features:**
- Public agent page at `/agent/:slug` — standalone, brandable chat UI
- Customizable appearance: primary color, logo, welcome message, suggested questions
- Embed options:
  - **iframe**: `<iframe src="https://soulprintengine.ai/agent/:slug/embed" />`
  - **JS widget**: `<script src="https://soulprintengine.ai/widget.js" data-agent=":slug"></script>` (floating chat bubble)
- Optional access controls: password, allowed domains, rate limiting
- Share link with UTM tracking

**Data Model (extends agents):**
```
agent_deploy_config {
  agent_id: UUID
  custom_color: String (hex)
  custom_logo: String (URL)
  welcome_message: String
  suggested_questions: Array<String>
  password: String (optional, hashed)
  allowed_domains: Array<String>
  rate_limit: Int (messages per minute per IP)
  show_branding: Boolean (show "Powered by SoulPrint")
}
```

**Frontend Routes:**
- `/agent/:slug` — Full-page agent chat (public)
- `/agent/:slug/embed` — Minimal embed-friendly chat (no nav, compact)

---

### Phase 5: Usage Metering + Billing Integration
**Goal:** Track and bill for agent usage.

**Metrics Tracked:**
- Messages sent/received per agent
- Tokens consumed (input + output) per agent
- Tool invocations per agent
- Knowledge base storage (MB)
- Unique sessions per agent

**Billing Models (extend existing Stripe integration):**
| Plan | Agents | Messages/mo | Knowledge | Tools | Price |
|---|---|---|---|---|---|
| Free | 1 | 100 | 5MB | Built-in only | $0 |
| Pro | 10 | 5,000 | 500MB | All + custom | $29/mo |
| Business | 50 | 50,000 | 5GB | All + custom + priority | $99/mo |
| Enterprise | Unlimited | Unlimited | Unlimited | Everything + SLA | Custom |

**Data Model:**
```
agent_usage {
  id: UUID
  agent_id: UUID
  workspace_id: UUID
  period: String (e.g., "2026-04")
  messages_count: Int
  tokens_input: Int
  tokens_output: Int
  tool_calls: Int
  unique_sessions: Int
  updated_at: DateTime
}
```

**Enforcement:**
- Check usage before each agent chat request
- Soft limit: warning banner at 80% usage
- Hard limit: 402 response at 100% with upgrade CTA
- Grace period: 24h after hitting limit before hard cutoff

---

### Phase 6: Workspaces + Teams + Polish
**Goal:** Multi-user collaboration and production readiness.

**Features:**
- Workspace creation and management
- Invite team members via email
- Role-based access:
  - **Owner**: Full control, billing, delete workspace
  - **Admin**: Manage agents, tools, knowledge, members
  - **Editor**: Create/edit agents, cannot manage members or billing
  - **Viewer**: Can chat with agents, cannot edit
- Agent transfer between workspaces
- Activity log / audit trail
- Agent versioning (save snapshots, rollback)
- Agent duplication (clone an agent as a starting point)

**Data Model:**
```
workspaces {
  id: UUID
  name: String
  owner_id: UUID
  plan: String
  created_at: DateTime
}

workspace_members {
  workspace_id: UUID
  user_id: UUID
  role: Enum ("owner", "admin", "editor", "viewer")
  invited_at: DateTime
  accepted_at: DateTime
}
```

---

## 5. Technical Architecture

### Existing Infrastructure (Reused)
- Next.js full-stack framework
- MongoDB (Atlas in production, local in dev)
- Multi-LLM routing (OpenAI, Gemini, Anthropic, Perplexity)
- NDJSON streaming chat
- Stripe billing
- Auth (Firebase/Google OAuth + JWT)
- File upload pipeline

### New Infrastructure Required
- **Vector search**: MongoDB Atlas Vector Search (or Pinecone/Weaviate if needed)
- **Sandboxed code execution**: Isolated Docker containers or WebAssembly for code_runner tool
- **Background job queue**: For knowledge base processing (chunking + embedding) — can use MongoDB-based queue initially
- **CDN**: For serving embed widget JS (can use Vercel/Cloudflare)

### Key API Route Structure
```
/api/agents                    — CRUD
/api/agents/:id/chat           — Chat stream (owner)
/api/agents/:id/tools          — Manage agent tools
/api/agents/:id/knowledge      — Manage knowledge base
/api/agents/:id/deploy         — Deploy configuration
/api/agents/:id/usage          — Usage stats
/api/agent/:slug/chat          — Public chat stream
/api/workspaces                — Workspace CRUD
/api/workspaces/:id/members    — Team management
/api/tools                     — Custom tool CRUD
```

### Frontend Route Structure
```
/agents                        — Agent dashboard
/agents/new                    — Create agent wizard
/agents/:id                    — Agent detail/edit
/agents/:id/chat               — Test chat
/agents/:id/knowledge          — Knowledge base manager
/agents/:id/deploy             — Deploy settings + embed codes
/agents/:id/analytics          — Usage analytics
/agent/:slug                   — Public agent chat page
/agent/:slug/embed             — Embeddable chat widget
/workspaces                    — Workspace manager
```

---

## 6. Migration Strategy

The existing SoulPrint chat experience becomes the **flagship agent** — pre-configured with:
- SoulPrint persona/memory system as its unique tool
- All existing LLM routing as its model options
- All existing features (voice, image gen, GitHub) as its tools

New users see both:
1. **SoulPrint AI** (the flagship, always available)
2. **My Agents** (create your own)

This keeps the existing product intact while expanding into the platform.

---

## 7. Dependencies & Blockers

| Dependency | Status | Notes |
|---|---|---|
| Billing Phases 3-6 | **IN PROGRESS** | Must complete plan picker, usage limits, grace period before agent platform billing |
| MongoDB Atlas Vector Search | **AVAILABLE** | Already on Atlas, just need to create vector index |
| OpenAI Embeddings API | **AVAILABLE** | Already have API key |
| Sandboxed Code Execution | **NEEDS RESEARCH** | Options: isolated-vm, Docker containers, or external service |

---

## 8. Success Metrics

| Metric | Target (6 months post-launch) |
|---|---|
| Agents created | 1,000+ |
| Active agents (used in last 7d) | 300+ |
| Public agent sessions | 10,000+/mo |
| Paid conversions (Free → Pro) | 5%+ |
| Avg agents per paid workspace | 4+ |

---

## 9. Open Questions

1. **Branding**: Should deployed agents say "Powered by SoulPrint" or "Powered by ArcheForge"?
2. **Marketplace**: Should there be a public agent marketplace where creators can share/monetize agents? (Phase 7+)
3. **Voice**: Should deployed agents support voice chat? (Reuse existing WebRTC infrastructure?)
4. **Mobile**: PWA support for deployed agents? Agent builder on mobile?
5. **Agent-to-Agent**: Can agents call other agents as tools? (Multi-agent orchestration)

---

*This spec will be updated as billing phases are completed and development begins.*
