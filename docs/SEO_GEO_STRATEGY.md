# SoulPrint (SPE) — SEO & GEO Strategy
*Prepared for Reggie · August 19, 2026 · aligned to the portability pivot (extension / MCP / SDK)*

---

## 1. The one decision that drives everything

**Commit to "portable AI identity & memory" — and stop selling "a multi-model AI platform."**

Right now the site is speaking with two voices:

| Framing | Message | Where it lives | Problem |
|---|---|---|---|
| **Old** | "All your AI in one place" — 15+ models, image/video gen, Google integration | `README.md`, `docs/MARKETING_COPY.md`, homepage "Why Choose SoulPrint?" matrix | Competes head-on with ChatGPT/Claude/Poe. Brutal keywords, losing battle, off-strategy. |
| **New** | "Stop re-explaining yourself to AI" / "Your Identity. Every AI." | H1, Chrome extension, MCP server, memory engine | This is the differentiated, patent-pending story — and it's the pivot. |

The pivot is correct. The problem is the website hasn't finished committing to it.

**Why it matters for SEO/GEO specifically:** you don't win search traffic by outranking "ChatGPT alternative." You win by *owning a new category* — **portable AI memory / AI identity layer** — which has low competition, high intent, and is exactly what your extension + MCP + SDKs deliver. You're not a ChatGPT competitor; you're a layer *on top of* ChatGPT, Claude, Cursor, and every agent. That's a story Google and AI models can both understand and cite.

---

## 2. What the product actually is (post-pivot)

Four surfaces, one identity:

| Surface | Audience | Job |
|---|---|---|
| **Web app** (soulprintengine.ai) | Consumer | Build the identity: assessment, memories, Imprints, profile |
| **Chrome extension** ("SoulPrint for Chrome") | Consumer/prosumer | Injects your memories + persona into ChatGPT, Claude, Gemini, Perplexity |
| **MCP server** (`soulprint-mcp`, PyPI v0.4.2) | Developer | Same identity in Claude Code, Cursor, Codex, Hermes, any MCP agent |
| **SDKs** (`soulprint-memory-sdk`, `soulprint-persona-sdk`) | Enterprise/integrator | Embed SoulPrint in your own product |

The through-line for all marketing and content: **one identity, every AI. Build it once, it follows you everywhere.**

---

## 3. Position — the category we own

**Category name:** *Portable AI memory / AI identity layer.*

**One-sentence pitch:**
> SoulPrint is your AI identity — your memory, tone, and preferences — that travels with you into every AI: ChatGPT, Claude, Gemini, Cursor, and any agent. Build it once; never re-explain yourself again.

**Who we compare against (the right competitive set):**
- **Mem0** — memory infra for developers, no consumer identity/persona layer
- **Letta / MemGPT** — agent memory, dev-focused, no consumer surface
- **Zep** — enterprise memory API, no persona/communication layer
- **Native ChatGPT/Gemini memory** — siloed, locked to one vendor, not portable
- *(Stop comparing to ChatGPT-the-chatbot, Claude, Poe. That's the old story.)*

**What only we do (defensible):**
1. **Portable across vendors** — one identity, works in ChatGPT *and* Claude *and* Cursor *and* any MCP agent. Native memory is walled in.
2. **Persona + memory, not just facts** — SoulPrint captures *how you communicate and decide* (directness, warmth, density, proactivity), not just a list of facts.
3. **Consumer + developer in one system** — the same profile powers a browser extension and an MCP server. Mem0/Letta are dev-only.

---

## 4. Keyword & prompt strategy (SEO + GEO together)

Build content around **the questions people actually ask**, not our internal vocabulary. (Adrian's exact point — endorsed.)

### A. Consumer — "make my AI remember me" (extension-led)
- `how to make ChatGPT remember me`
- `ChatGPT keeps forgetting me`
- `AI that remembers you between conversations`
- `give ChatGPT long-term memory`
- `ChatGPT memory alternative` / `best AI memory tool`
- `AI assistant that learns about you`
- `AI with persistent memory`
- `portable AI memory`
- `AI that knows my writing style`

### B. Developer — "memory for my AI agent" (MCP/SDK-led)
- `MCP memory server`
- `AI agent long-term memory`
- `Claude Code memory` / `Cursor memory`
- `MCP server for user memory`
- `LLM memory Python` / `AI memory SDK`
- `agent context injection`
- `persistent memory for coding agents`
- `soulprint-mcp`

### C. Category — "what is this thing?" (thought-leadership, GEO citations)
- `what is an AI identity layer`
- `what is portable AI memory`
- `AI memory vs AI context`
- `GEO / generative engine optimization`
- `AI that remembers you` (broad, top-of-funnel)

**Keyword hygiene:** drop `multi-model AI platform`, `ChatGPT alternative`, `all-in-one AI assistant` from any *new* content. They're expensive, off-pivot, and attract the wrong visitor.

**Start from problems, not keywords (Adrian, Aug 20).** Don't begin with a keyword list — begin with customer problems, then expand each into *Google searches* AND *AI prompts*. We optimize for discovery, not keywords. One problem — "I want an AI that actually remembers me" — fans out into a dozen searches ("AI that remembers you," "AI with long-term memory," "persistent memory AI") *and* a dozen AI prompts ("Which AI assistants have the best memory?"). Group everything under **5–8 topic clusters** so we build topical authority instead of scattered posts:

| Cluster | Covers |
|---|---|
| **AI Memory** | long-term memory · persistent memory · how AI memory works · ChatGPT memory · AI memory privacy |
| **Personal AI** | personalized AI assistants · AI that learns about you · AI that remembers preferences · personal AI vs general AI |
| **AI Assistants** | best AI assistants · ChatGPT/Claude/Gemini alternatives · AI assistant comparisons |
| **Proprietary / product** | our `/mcp`, `/extension`, `/what-is-ai-identity`, `/compare` pages (the category we own) |

---

## 5. Site architecture — pages to build

New public pages, each mapped to a keyword cluster and written answer-first (H2/H3 = the question, body = the answer in 2–3 sentences, then detail):

| Page | Targets | Purpose |
|---|---|---|
| `/` (rewrite hero/matrix) | portable AI memory | Lead with "one identity, every AI." Replace the ChatGPT/Claude matrix with a Mem0/Letta/native-memory matrix. |
| `/extension` | ChatGPT memory, extension cluster | Product page for the Chrome extension + install link |
| `/mcp` (new) | MCP memory server cluster | Developer product page + `pip install soulprint-mcp` + per-agent setup |
| `/sdks` (new) | AI memory SDK | Enterprise/integration page for the two SDKs |
| `/what-is-ai-identity` (new) | category definition | Definitional pillar page (high GEO value) |
| `/compare` (new) | "ChatGPT memory alternative", "Mem0 alternative" | Honest comparison vs Mem0, Letta, Zep, native memory |
| `/pricing` | — | Keep, but tier copy should speak "surfaces/identity," not "messages/day" |
| `/blog` | long-tail + GEO | Fix rendering (see §7), then run the content plan |

---

## 6. Content plan — 90 days (ties to Adrian's Aug/Sep/Oct)

**Phase 1 — establish the baseline (August, 8–12 pieces):**
1. "What is an AI identity layer?" (pillar — the definitional page)
2. "How to make ChatGPT remember you (in 2026)" — extension-led, question-led
3. "Why ChatGPT forgets you — and the fix" — pain-point post
4. "What is an MCP server? (and why your agent needs memory)" — dev-led
5. "Portable AI memory vs. native ChatGPT memory" — comparison
6. "SoulPrint MCP: memory for Claude Code, Cursor, and Codex" — walkthrough (reuse `docs/connect-your-ai.md`)
7. "Your AI identity should be portable" — thesis post (Adrian's framing)
8. One founder/announcement post on the pivot ("We're becoming the identity layer for AI")

**Phase 2 — build authority (September):** cluster the winners, add comparison pages, pursue third-party mentions (see §8 — this is where GEO is won).

**Phase 3 — optimize (October):** double down on what's getting impressions + AI citations.

Every post: answer the question in the first 100 words, use the question as an H2, end with a clear CTA to the extension/MCP/web app.

**First 30 days (Adrian's sprint — the front half of Phase 1):**
- **Week 1:** technical audit + Google Search Console / Bing Webmaster Tools / GA4 setup + IndexNow + indexing + baseline AI visibility.
- **Week 2:** build the keyword/question database + competitor universe + the 5–8 topic clusters.
- **Week 3:** deploy the Research / Strategy / Content agents → produce the first 5–8 pieces with human approval.
- **Week 4:** deploy the Performance/refresh agent + reporting → start the feedback loop.

**Output discipline:** 2–3 strong pieces/week to start — *not* a volume sprint. Let the system learn what Google indexes, what earns impressions, and what AI cites, then accelerate.

**The weekly refresh loop (where agents beat "writing blogs with ChatGPT"):** every week Performance flags — pages stuck at positions 6–20 → optimize; pages losing impressions → refresh; GSC queries with no dedicated coverage → new content; AI prompts where competitors appear but we don't → GEO gap; competitor pages gaining → investigate; stale product/comparison info → update. Closes the loop *data → opportunity → content → indexing → performance → learning → optimization*.

---

## 7. Technical SEO fixes (prioritized)

Found by reading the actual repo. Ordered by impact:

1. **Blog is client-side rendered — Google/AI see empty pages.** `app/blog/page.js` and `app/blog/[slug]/page.js` are `'use client'` and fetch posts via `/api/blog/posts`. Crawlers that don't run JS (including most AI search crawlers) get nothing. **Fix:** convert to server components with `generateStaticParams` + `generateMetadata`, or at minimum add per-page `generateMetadata`. This is the single biggest technical win.
2. **No `robots.txt`.** Add one (allow all, point to sitemap).
3. **No `sitemap.xml`.** Add `app/sitemap.ts` (Next.js) listing all public routes + blog slugs.
4. **No structured data / JSON-LD.** Add `Organization` + `SoftwareApplication` (for the extension and MCP server — helps Google + AI citation), `Article` for blog posts, `FAQPage` on `/what-is-ai-identity`.
5. **Site-wide title is generic.** `layout.js` metadata is `"SoulPrint — Your Personal AI"` and applies to every page. Fix to something on-pivot: `"SoulPrint — Portable AI Memory: One Identity, Every AI"`, and add per-page `title`/`description`.
6. **No Open Graph / Twitter card tags.** Add `openGraph` + `twitter` to metadata. Missing today = links shared to X/Slack/LinkedIn render blank.
7. **No canonical URLs / no `metadataBase`.** Add `metadataBase: 'https://soulprintengine.ai'`.
8. **Naming inconsistency.** "SoulPrint Engine" vs "SoulPrint" vs "SoulPrint Companion" vs "SPE." Consolidate to **SoulPrint** everywhere public (product), keep "SoulPrint MCP" / "SoulPrint for Chrome" as surface names.
9. **Not in Bing's ecosystem.** Set up **Bing Webmaster Tools** now — Microsoft's *AI Performance* (2026) shows when your pages are cited in Copilot and other Microsoft AI experiences. Enable **IndexNow** so new/updated content gets pushed into Bing + the AI ecosystem immediately instead of waiting for a crawl.
10. **No connected data foundation.** Wire the pipeline GSC → GA4 → Bing Webmaster Tools → CMS so the Performance agent has ground truth (Google itself recommends Search Console as the starting point for monitoring search performance).

---

## 8. GEO playbook — getting cited by AI

GEO ≠ SEO. AI models cite *third-party* content and *structured, definitional* pages. Concrete moves:

1. **Answer-first, structured pages** (§5–6). Models cite pages that define terms cleanly and answer the question directly. The `/what-is-ai-identity` and `/compare` pages are your citation magnets.
2. **Get listed where agents look:**
   - **Chrome Web Store** — verify "SoulPrint for Chrome" is published (repo is currently private on GitHub; confirm the store listing). The store page IS a GEO surface.
   - **PyPI** — already live (`soulprint-mcp` v0.4.2). Add a longer README with keywords; PyPI pages rank well and get cited.
   - **MCP registries / awesome lists** — `awesome-mcp-servers`, `mcp.so`, `smithery.ai`, `glama.ai/mcp`. Submit `soulprint-mcp`. High-intent, low-effort, dev-audience citations.
   - **GitHub** — make `soulprint-mcp` public and its README the canonical docs (already public per PyPI). Star/link hygiene.
   - **Launch surfaces** — Product Hunt, Hacker News "Show HN" for the MCP server ("Show HN: SoulPrint — your identity in every AI agent").
3. **Third-party mentions** (Adrian's 85% point — the highest-leverage GEO lever): get independent articles/tweets/lists to *name* SoulPrint. Targets: AI-tools newsletters, MCP-dev blogs, "best AI memory tools" listicles, YouTube reviews of the extension. Pitch the *category* ("portable AI memory"), not the features.
4. **Consistent entity signal** — same name, same one-line description, same logo/colors across the web app, extension, PyPI, GitHub, and social bios so Google's Knowledge Graph and AI models resolve one clean entity.

---

## 9. Measurement — three tiers, not "we published N articles"

Don't let the team celebrate "we published 47 articles" — that's almost meaningless. Track economic value across three tiers (Adrian's framework):

- **Search visibility:** indexed pages, organic impressions, top-20 and top-10 keywords, non-branded clicks, organic conversions. Ground truth = Google Search Console + Bing Webmaster Tools.
- **AI visibility:** tracked AI prompts, brand mention rate, citation rate, competitor share of voice, pages receiving AI citations. From the internal GEO tracker (cron + our own AI APIs).
- **Business:** organic signup rate, AI-referral signup rate, cost per organic signup, demo/trial/signup attribution.

**North-star:** how many of the ~50 tracked prompts surface SoulPrint in AI results — baseline in August, then monthly.

**Attribution (the portability loop):** extension installs, `pip install soulprint-mcp` downloads (PyPI stats), MCP `hermes mcp add soulprint` usage — these surfaces drive everything.

---

## 10. My recommendation (bottom line)

1. **Do the positioning flip first.** Rewrite the homepage hero + comparison matrix to "one identity, every AI" and the Mem0/Letta/native-memory competitive set. Everything else amplifies this.
2. **Fix the blog rendering** (server-side) + add robots.txt / sitemap / JSON-LD — a day or two of work, outsized return.
3. **Ship the two new pages that matter most:** `/mcp` and `/what-is-ai-identity`.
4. **Get listed** (Chrome Web Store confirm + MCP directories + awesome lists) — cheap GEO wins this week.
5. **Build the internal GEO prompt tracker** — see §11.

## 11. In-house execution: a 5-agent SEO department (no third-party SaaS)

Adrian's follow-up (Aug 20) lands on the same conclusion — and gives us the operating model: run this as a **virtual SEO department of five agents**, built on Hermes + cron + our own AI APIs (no AirOps, no Writesonic). Humans own strategy, proprietary insight, factual accuracy, and the publish gate; agents do the repetitive work.

| Agent | Job | In-house form | Cadence |
|---|---|---|---|
| **1. Research** | Keywords, questions, competitors, SERPs, AI prompts | Hermes research pass (web + AI) | Continuous |
| **2. Strategy** | Choose topics, build clusters | Hermes + Adrian sign-off | Weekly |
| **3. Content** | Briefs + first drafts | Hermes drafts → Adrian edits/approves | 2–4×/week |
| **4. Optimization** | On-page, schema, internal links, titles, FAQs | Build-time checks + Hermes review | Every page |
| **5. Performance** | GSC, Bing, AI citations, refresh opportunities | Weekly cron digest | Weekly |

**The publish pipeline (human gate is non-negotiable — Google & Bing both warn against scaled auto-content):**
Research → Strategy (score on demand + AI relevance + competition + product fit) → Content brief → draft → **add proprietary SoulPrint perspective** → Optimization → **human approval** → publish → Performance monitors.

**Why internal wins:** (1) the data stays ours — visibility scores, prompts, and citations are proprietary; (2) near-zero marginal cost vs $79–$2,000/mo SaaS; (3) Hermes already *is* the orchestrator — AirOps would re-create what we have. Writesonic declined to even demo (self-serve only, Enterprise $2k/mo), which settles it.

**The one real cost:** wiring up the 5 agents + the GEO tracker (~half a day up front), then they run themselves on cron.

The pivot is the right call. The SEO/GEO strategy is just the website *saying out loud* what the extension and MCP server already do.
