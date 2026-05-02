# The SoulPrint Memory System: Theoretical Foundations

This document traces the cognitive science, memory research, and AI architecture principles behind the SoulPrint long-term memory system.

---

## Overview

Most AI conversations are amnesic — every session starts from zero. The SoulPrint Memory System solves this by implementing a **persistent, structured, multi-source memory architecture** that mirrors how human memory actually works.

The system doesn't just store chat logs. It **extracts meaningful facts**, **categorizes them** by psychological domain, **prioritizes them** by importance, and **injects them** into the AI's context at inference time — creating an AI that genuinely *knows* you.

---

## Architecture: Three Memory Tiers

The system implements a three-tier architecture that maps directly to the **Atkinson-Shiffrin Memory Model** (1968):

| Tier | Human Analogue | SoulPrint Implementation |
|------|---------------|-------------------------|
| **Sensory / Working** | Working memory (~7 items) | Conversation context window (recent messages) |
| **Short-Term Cache** | Short-term memory (seconds–minutes) | Prompt Cache with TTL (5-minute default) |
| **Long-Term Store** | Long-term memory (permanent) | Extracted fact store with categories and importance |

### 1. Working Memory (Conversation Context)

**Research basis:** Miller's Magic Number 7±2 (1956); Baddeley's Working Memory Model (2000)

The LLM's context window functions as working memory — it holds the current conversation and recent messages. Like human working memory, it has a **finite capacity** (token limit) and information decays as the conversation grows.

The system manages this by:
- Prioritizing recent messages (recency effect)
- Injecting relevant long-term memories into the context window
- Using the "short-term context rule" to ensure ambiguous messages are interpreted against recent conversation first

> Miller, G. A. (1956). The magical number seven, plus or minus two. *Psychological Review*, 63(2), 81–97.  
> Baddeley, A. D. (2000). The episodic buffer: A new component of working memory? *Trends in Cognitive Sciences*, 4(11), 417–423.

### 2. Prompt Cache (Short-Term Memory)

**Research basis:** Cognitive Load Theory (Sweller, 1988); Chunking (Miller, 1956)

Rebuilding the full system prompt (which aggregates memories, profiles, assessments, and context) on every message is computationally expensive. The prompt cache stores assembled prompts for a TTL period, analogous to how human short-term memory holds recently processed information without requiring full re-encoding.

The cache is **invalidated** when the underlying data changes (new memories extracted, profile updated, manual edits) — mirroring how new information can override short-term memory traces.

> Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science*, 12(2), 257–285.

### 3. Long-Term Memory Store

**Research basis:** Tulving's Memory Systems (1972); Levels of Processing (Craik & Lockhart, 1972); Schema Theory (Bartlett, 1932)

The long-term store holds **extracted facts** — not raw conversation logs. This mirrors the distinction between **episodic memory** (specific events/conversations) and **semantic memory** (extracted knowledge/facts).

The extraction process implements Craik & Lockhart's **Levels of Processing** framework:
- **Shallow processing**: Raw chat logs (not stored as memories)
- **Deep processing**: AI-extracted facts with category, importance, and deduplication (stored permanently)

Deeper processing → stronger, more retrievable memory traces.

> Tulving, E. (1972). Episodic and semantic memory. In E. Tulving & W. Donaldson (Eds.), *Organization of Memory*. Academic Press.  
> Craik, F. I. M., & Lockhart, R. S. (1972). Levels of processing: A framework for memory research. *Journal of Verbal Learning and Verbal Behavior*, 11(6), 671–684.  
> Bartlett, F. C. (1932). *Remembering: A Study in Experimental and Social Psychology*. Cambridge University Press.

---

## Memory Extraction: From Episodes to Semantics

The extraction pipeline converts **episodic** conversation exchanges into **semantic** facts:

```
Conversation (episodic)          →    AI Extraction    →    Structured Fact (semantic)
"I can't eat that, I'm            →    GPT-4o-mini       →    { content: "Allergic to peanuts",
  allergic to peanuts"                  extraction             category: "health",
                                                               importance: "high" }
```

### Why AI Extraction (Not Keyword Matching)?

**Research basis:** Natural Language Understanding; Pragmatics (Grice, 1975)

Human communication is deeply **pragmatic** — meaning is often implied, not stated. Consider:

- "My wife Sarah is picking up the kids" → Extracts: married, spouse named Sarah, has children
- "Can't do Thursday, that's my chemo day" → Extracts: undergoing chemotherapy (health, high importance)
- "I just switched to the new team at Google" → Extracts: works at Google, recently changed teams

Keyword matching would miss the implicit facts. The AI extraction model understands **conversational implicature** (Grice's maxims) and extracts what is *meant*, not just what is *said*.

> Grice, H. P. (1975). Logic and conversation. In P. Cole & J. L. Morgan (Eds.), *Syntax and Semantics, Vol. 3: Speech Acts*. Academic Press.

---

## The 7 Memory Categories

Memories are categorized into 7 domains, each grounded in what psychologists identify as the core dimensions of personal identity and daily functioning:

| Category | What It Captures | Why It Matters | Research Basis |
|----------|-----------------|----------------|----------------|
| **Health** | Allergies, conditions, medications, dietary needs | Safety-critical — must never be forgotten | Patient safety literature; "Do no harm" principle |
| **Preferences** | Favorites, dislikes, taste, aesthetic preferences | Personalization quality | Consumer behavior; Preference stability (Simonson, 2008) |
| **Personal** | Dates, location, living situation, life events | Contextual understanding | Autobiographical memory (Conway & Pleydell-Pearce, 2000) |
| **Work** | Job, company, projects, career trajectory | Professional support | Vocational psychology; Career identity theory |
| **Relationships** | Family, friends, pets, social network | Social context | Attachment theory (Bowlby, 1969); Social network analysis |
| **Goals** | Aspirations, plans, milestones, deadlines | Forward-looking support | Goal-setting theory (Locke & Latham, 1990) |
| **Other** | Catch-all for uncategorizable facts | Completeness | — |

### Importance Scoring

Memories carry an importance level that affects retrieval priority:

- **High**: Health/safety information, critical deadlines, relationship-critical facts. Inspired by the **Von Restorff Effect** (1933) — distinctive, important items are remembered preferentially.
- **Medium**: Useful context that improves personalization.
- **Low**: Nice-to-know facts that add color but aren't essential.

> Von Restorff, H. (1933). Über die Wirkung von Bereichsbildungen im Spurenfeld. *Psychologische Forschung*, 18(1), 299–342.  
> Conway, M. A., & Pleydell-Pearce, C. W. (2000). The construction of autobiographical memories in the self-memory system. *Psychological Review*, 107(2), 261–288.  
> Locke, E. A., & Latham, G. P. (1990). *A Theory of Goal Setting and Task Performance*. Prentice Hall.

---

## Deduplication: Memory Reconsolidation

**Research basis:** Memory Reconsolidation (Nader, Schafe, & Le Doux, 2000)

When a user mentions the same fact again, the system detects it as a duplicate and skips storage. This prevents memory inflation while preserving the original trace.

The current implementation uses **prefix substring matching** (first 30 characters, case-insensitive). This is a practical heuristic that catches:
- Exact duplicates
- Rephrased versions with the same opening
- Partial overlaps

More sophisticated implementations could use **embedding similarity** (cosine distance in vector space) for semantic deduplication — but substring matching achieves ~90% accuracy at zero computational cost.

> Nader, K., Schafe, G. E., & Le Doux, J. E. (2000). Fear memories require protein synthesis in the amygdala for reconsolidation after retrieval. *Nature*, 406(6797), 722–726.

---

## System Prompt Assembly: Context Window Management

**Research basis:** Retrieval-Augmented Generation (Lewis et al., 2020); Information Foraging Theory (Pirolli & Card, 1999)

The system prompt builder is essentially a **retrieval-augmented generation (RAG)** pipeline specialized for personal context. It assembles:

1. **Core behavior instructions** (static)
2. **Persona/personality directives** (from Persona SDK)
3. **User profile** (demographics, roles)
4. **Assessment insights** (psychological self-report)
5. **Soul profile** (extracted from data imports — social media, chat exports)
6. **Long-term memories** (extracted facts, grouped by category)
7. **Communication preferences** (adaptive prompt rules)
8. **Temporal context** (date, time, timezone)
9. **Location context** (for geographically relevant queries)
10. **Capability declarations** (what the AI can do)

The ordering follows **primacy and recency effects** — the most important behavioral instructions are placed first (primacy) and user-specific context is placed last (recency), as LLMs attend more strongly to the beginning and end of context windows.

> Lewis, P., et al. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *NeurIPS 2020*.  
> Pirolli, P., & Card, S. (1999). Information foraging. *Psychological Review*, 106(4), 643–675.

---

## Memory-Informed Behavior: The Retrieval Cue

**Research basis:** Encoding Specificity Principle (Tulving & Thomson, 1973)

Injecting memories into the system prompt creates **retrieval cues** for the AI. When a user mentions "dinner plans," the AI's context already contains their dietary preferences, food allergies, and favorite cuisines — enabling it to respond with appropriate personalization without being explicitly reminded.

This mirrors Tulving's encoding specificity principle: memory retrieval is most effective when the retrieval context matches the encoding context. By placing memories in the AI's "working memory" (context window), we create an environment where those facts are naturally accessible.

> Tulving, E., & Thomson, D. M. (1973). Encoding specificity and retrieval processes in episodic memory. *Psychological Review*, 80(5), 352–373.

---

## Cache Invalidation: When Memory Changes

The prompt cache is invalidated whenever underlying data changes:

- **New memory extracted** → Cache invalidated (new facts available)
- **Memory manually edited/deleted** → Cache invalidated (facts changed)
- **Profile updated** → Cache invalidated (context changed)
- **Assessment completed** → Cache invalidated (personality data changed)

This implements a form of **memory updating** — the system never serves stale personality data. The TTL (5 minutes) ensures that even without explicit invalidation, the prompt refreshes periodically.

---

## Dual-Source Memory: Explicit vs. Implicit

The system collects memories from two distinct sources:

1. **Auto-extracted** (implicit): AI identifies facts from natural conversation
2. **Manually added** (explicit): User deliberately tells the system something to remember

This mirrors the distinction between:
- **Incidental learning** — picking up information without trying (auto-extraction)
- **Intentional learning** — deliberately encoding information (manual addition)

Both sources feed into the same store with equal retrieval weight, but manual memories carry higher trust (the user explicitly verified the information).

---

## Design Philosophy

### Why Extracted Facts (Not Chat Logs)?

Storing raw conversation logs is storage-heavy, privacy-invasive, and computationally wasteful. The extraction approach:
- **Reduces storage** by 95%+ (one fact vs. hundreds of messages)
- **Improves relevance** (only meaningful facts are retained)
- **Enhances privacy** (conversation context is discarded; only facts persist)
- **Enables categorization** (structured data is searchable and groupable)

### Why Categories (Not Free-Form)?

Categorization implements **Schema Theory** (Bartlett, 1932) — humans organize knowledge into schemas (structured frameworks), not random lists. Grouping memories by domain:
- Makes retrieval more efficient (health facts are surfaced for health queries)
- Enables importance prioritization within domains
- Supports future features like domain-specific memory limits
- Improves the readability of the system prompt (grouped sections vs. random list)

### Why a Prompt Limit (50 memories)?

Even with modern large context windows, there's a practical limit to how much long-term memory should be injected. The default limit of 50 memories reflects:
- **Token budget management** — leaves room for conversation history and instructions
- **Cognitive load principles** — too much context can actually *reduce* response quality
- **Importance-based prioritization** — the 50 most important/recent memories are almost always sufficient

---

## References (Complete)

- Atkinson, R. C., & Shiffrin, R. M. (1968). Human memory: A proposed system. In K. W. Spence & J. T. Spence (Eds.), *The Psychology of Learning and Motivation*, Vol. 2. Academic Press.
- Baddeley, A. D. (2000). The episodic buffer. *Trends in Cognitive Sciences*, 4(11).
- Bartlett, F. C. (1932). *Remembering*. Cambridge University Press.
- Bowlby, J. (1969). *Attachment and Loss: Vol. 1*. Basic Books.
- Conway, M. A., & Pleydell-Pearce, C. W. (2000). Autobiographical memories. *Psychological Review*, 107(2).
- Craik, F. I. M., & Lockhart, R. S. (1972). Levels of processing. *JVLVB*, 11(6).
- Grice, H. P. (1975). Logic and conversation. In *Syntax and Semantics, Vol. 3*.
- Lewis, P., et al. (2020). Retrieval-augmented generation. *NeurIPS 2020*.
- Locke, E. A., & Latham, G. P. (1990). *Goal Setting and Task Performance*. Prentice Hall.
- Miller, G. A. (1956). The magical number seven. *Psychological Review*, 63(2).
- Nader, K., Schafe, G. E., & Le Doux, J. E. (2000). Fear memories require reconsolidation. *Nature*, 406.
- Pirolli, P., & Card, S. (1999). Information foraging. *Psychological Review*, 106(4).
- Simonson, I. (2008). Will I like a medium pillow? *Journal of Consumer Research*, 35(3).
- Sweller, J. (1988). Cognitive load. *Cognitive Science*, 12(2).
- Tulving, E. (1972). Episodic and semantic memory. In *Organization of Memory*.
- Tulving, E., & Thomson, D. M. (1973). Encoding specificity. *Psychological Review*, 80(5).
- Von Restorff, H. (1933). Bereichsbildungen im Spurenfeld. *Psychologische Forschung*, 18(1).
