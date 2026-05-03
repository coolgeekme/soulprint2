# SoulPrint Support Knowledge Base
# Last Updated: 2026-05-02
# This file is read by the AI at runtime to provide accurate in-app support.
# Update this file whenever features are added, changed, or bugs are discovered.

---

## RECENT UPDATES (What's New)

### May 2026
- **Persona DNA System** — The AI now adapts its entire personality to each user via 10 behavioral axes (directness, warmth, humor, challenge, detail, formality, emotional depth, pace, autonomy, expressiveness). Powered by the assessment and behavioral analysis.
- **Auto-Replenish Invites** — When a user's invite balance hits 0, they automatically get 5 more invites.
- **Stripe is LIVE** — Real payments are active. Plans: Free ($0), Base ($20.01/mo), Power ($99.01/mo).
- **Post-Payment Success Pages** — Dedicated success pages at /subscription/success and /purchase/success.
- **Admin Dashboard: User Details** — Subscription tab now shows user names and emails.
- **Post-Assessment 7-Day Reward** — Users who complete the assessment within 7 days of signup get 7 more days of Base-tier access.
- **Dynamic Intelligence SDK** — The AI routing logic has been extracted into a standalone, reusable package.
- **SoulPrint Memory SDK** — The memory extraction and system prompt logic is available as a standalone package.

### April 2026
- **Veo Video Generation UX** — Detailed polling progress UI so the app doesn't look frozen during 3-10 min video generation.
- **Question vs Image Edit Detection** — The AI no longer accidentally triggers image generation when you ask questions about images.
- **Max Resolution Upgrade** — All image generation now defaults to HD/maximum resolution.
- **Short-Term Context Memory Fix** — "What happened?" and similar short messages now correctly reference the current conversation instead of triggering web searches.
- **Message Edit Regeneration** — "Save & Regenerate" on edited messages now works correctly on both desktop and mobile.
- **Production DB Stability** — MongoDB Atlas connection pool increased to 200 for high-concurrency support.
- **Invite Registration Fix** — 500 errors when registering with invite codes are resolved.

### March 2026
- **User Analytics Dashboard** — Admins can click any user to see detailed analytics
- **Smart Chat Deletion** — Deleting from "All Chats" only hides Project chats
- **What's New Section** — Sparkles icon (✨) in sidebar shows latest updates

---

## APP OVERVIEW
SoulPrint is a personal AI companion that learns your communication style, interests, and preferences over time. Unlike generic AI assistants, SoulPrint builds a persistent identity layer — your "SoulPrint" — that adapts the AI's personality, tone, and behavior to match each individual user.

It supports multi-model chat, image/video generation, voice chat, data imports, Google integration, a subscription billing system, and Telegram integration.

**URL**: https://soulprintengine.ai
**Support Email**: team@archeforge.com

---

## CORE SYSTEMS

### Persona DNA System (10-Axis Personality Engine)
This is SoulPrint's most important differentiator. The Persona DNA System creates a unique AI personality profile for every user based on **10 behavioral axes**:

| Axis | What It Controls |
|------|-----------------|
| **Directness** (0-100) | Diplomatic & gentle ↔ Blunt & no-filter |
| **Warmth** (0-100) | Clinical & detached ↔ Warm & nurturing |
| **Humor** (0-100) | Serious & professional ↔ Playful & witty |
| **Challenge** (0-100) | Always agrees ↔ Pushes back hard |
| **Detail** (0-100) | Brief & concise ↔ Thorough & in-depth |
| **Formality** (0-100) | Casual & slangy ↔ Formal & professional |
| **Emotional Depth** (0-100) | Surface-level ↔ Deep emotional reads |
| **Pace** (0-100) | Slow & measured ↔ Fast & punchy |
| **Autonomy** (0-100) | Asks permission ↔ Takes initiative |
| **Expressiveness** (0-100) | Reserved ↔ Animated & expressive |

**How the axes are calculated:**
1. **From the Assessment** — The 36-question assessment maps to 6 pillars (Communication, Emotional Intelligence, Decision Making, Social Dynamics, Cognitive Style, Assertiveness), which convert to the 10 axes via weighted mappings.
2. **From Chat Behavior** — The system analyzes the user's message history (emoji usage, slang density, message length, assertive/soft language, formality signals) to derive axes.
3. **Blended** — When both sources exist, assessment data gets 70% weight and behavioral data gets 30%.
4. **User Overrides** — Users can manually adjust 4 simplified dials (Directness, Warmth, Playfulness, Challenge) that map to the underlying 10 axes.

**Each axis produces specific prompt directives.** For example, if a user's warmth is 85, the AI is told: "Be genuinely warm and caring. Show you remember details about them. Use encouraging language. Celebrate their wins." If warmth is 20, it's told: "Keep it professional and focused. Don't add unnecessary emotional language."

The system also generates **anti-patterns** — things the AI must NOT do based on the user's profile (e.g., "Never say 'I hope that helps!' for a direct user — it sounds generic").

**Research basis:** The 10 axes are grounded in personality psychology — Big Five (Costa & McCrae), Interpersonal Circumplex (Leary/Wiggins), Emotional Intelligence (Goleman/Salovey-Mayer), Self-Determination Theory (Deci & Ryan), Communication Accommodation Theory (Giles), and more.

**Common questions users ask:**
- "Why does the AI talk differently to me than to others?" → Because of the Persona DNA. Each user gets a unique personality profile.
- "How can I change how the AI talks to me?" → Complete or retake the assessment in Settings, or adjust the personality dials.
- "The AI is too formal / too casual / too agreeable" → Suggest retaking the assessment or adjusting personality dials in Settings.

### Long-Term Memory System
SoulPrint automatically extracts and remembers important facts from your conversations. This is NOT just chat history — it extracts structured facts like "allergic to peanuts" or "spouse named Sarah" and stores them permanently.

**Memory Categories:**
- 🏥 **Health** — Allergies, conditions, medications (HIGHEST priority, always surfaced)
- ⭐ **Preferences** — Favorites, dislikes, taste
- 👤 **Personal** — Important dates, location, life events
- 💼 **Work** — Job, company, projects, career
- 💕 **Relationships** — Family, friends, pets
- 🎯 **Goals** — Aspirations, plans, milestones
- 📌 **Other** — Anything else

**How it works:**
1. After each conversation exchange, the AI analyzes what was said
2. Concrete, factual information is extracted (not opinions or temporary states)
3. Facts are categorized and assigned importance (high/medium/low)
4. Duplicates are automatically filtered out
5. Memories are injected into every future conversation

**Users can manage memories:**
- View all memories in Settings
- Filter by category
- Manually add memories
- Edit or delete existing memories

**Common issues:**
- "The AI forgot something I told it" → If it was a casual mention, it may not have been extracted. Suggest manually adding it as a memory.
- "The AI knows too much" → Memories can be deleted in Settings. Privacy controls allow opting out of AI memory extraction.

### Dynamic Intelligence (AI Routing)
When the user selects "Dynamic Intelligence" as their model, the system automatically:
1. Detects **intent** — Is this a chat message, image request, video request, or image edit?
2. Selects the **optimal model** — Based on the message content, it picks the best LLM (e.g., Claude Opus for creative writing, Sonar Pro for research, GPT-4o for general use)
3. Returns a **confidence score** and **reason** for the selection

This is the default mode and works transparently — users don't need to think about which AI model to use.

### System Prompt Architecture
Every message the AI receives includes a comprehensive system prompt built from:
1. Core behavior rules and persona directives
2. Persona DNA profile (the 10 axes)
3. User profile (name, role, field, needs)
4. Date/time/timezone context
5. Location awareness
6. Assessment insights
7. Communication preferences (from layered assessment)
8. Soul profile (from imported data like ChatGPT exports)
9. Long-term memories (grouped by category, health first)
10. Connected accounts info (Google)
11. Capability declarations
12. This support knowledge base

---

## FEATURES

### 1. Chat
- Real-time streaming chat with auto-saved conversations
- Last conversation loads automatically on return
- Sidebar shows history with search (searches titles AND message content)
- Markdown formatting, code blocks, and LaTeX support
- File attachments: images (including HEIC from iOS), PDFs, DOCX, TXT, MD, CSV, JSON
- Thumbs up/down feedback on assistant messages
- Message editing with "Save & Regenerate" functionality

**Common Issues:**
- "Connection error" — Network/CDN timeout. Refresh the page. If persistent → ESCALATE.
- Slow responses — Some models (Claude Opus, Gemini Pro) take longer. Dynamic Intelligence auto-selects the fastest appropriate model.
- Streaming cuts off — Proxy/CDN timeout. Refresh and retry. If repeated → ESCALATE.
- "Save & Regenerate" does nothing — This was fixed. If still broken → ESCALATE.

### 2. AI Model Selection
Users can choose from multiple LLM providers:

**Available Models:**
- **Dynamic Intelligence** (default) — AI auto-selects the best model per query
- **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4.1
- **Claude**: Opus 4.5, Sonnet 4.5, Haiku 3.5
- **Gemini**: 2.5 Pro, 2.0 Flash
- **Perplexity**: Sonar Pro (online search), Sonar, Sonar Reasoning
- **Kimi**: K2 Flagship, Moonshot 32k, Moonshot 8k

**Coming Soon**: GPT-5.2, GPT-5, o3, o3 Mini

**Default Model**: Users can set a default in the model picker (bottom-left of chat input).

### 3. Image Generation
Generate images by explicitly asking. A generation bar appears with "Generate Image" and "Just Chat" options.

**Available Image Models:**
- Seedream 5.0 Lite (~$0.03)
- Nano Banana / Gemini (~$0.05)
- GPT-4o Image (~$0.10)
- Flux Pro (~$0.13)
- Midjourney V7 (~$0.20)
- GPT Image 1.5 (~$0.25)

**All models now default to HD/maximum resolution.** Aspect ratios are preserved correctly for each model.

**The generation bar does NOT trigger on:**
- Questions about images ("why is Alex doing a science experiment?")
- Metaphorical use ("visualize your goals")
- Non-visual generation ("generate a list", "generate code")

**Common Issues:**
- Generation takes too long — 10-60 seconds is normal depending on model.
- "Generation failed" — Content policy violation or service issue. Try a different prompt.
- Generation triggered on a question — This was fixed. If it still happens → ESCALATE.

### 4. Image Editing
Users can edit images inline using mask-based editing:
1. Upload or generate an image
2. Use the brush tool to paint over the area to change
3. Describe the edit (e.g., "change the sky to sunset")
4. A new image is generated with the edit applied

### 5. Video Generation
Generate AI videos with detailed polling progress UI.

**Available Video Models:**
- Kling 3.0 Standard (~$0.10/s)
- Kling 3.0 Pro (~$0.14/s)
- Sora 2 (~$0.15/10s)
- Seedance 1.5 Pro (~$0.25/s)
- Kling 2.6 (~$0.27/s)
- Wan 2.6 (~$0.35/5s)
- Sora 2 Pro HD (~$0.50/10s)

**Video generation takes 1-10 minutes.** The UI shows detailed polling progress (model, status, elapsed time) so the app doesn't look frozen.

### 6. Voice Chat
Real-time voice conversation using OpenAI's Realtime API.

**How to use:**
1. Click microphone icon in chat input
2. Speak naturally — AI responds with voice
3. Click stop to end session

**Settings:** Default voice and web search toggle in Settings → Voice Chat.

### 7. Data Imports (Soul Profile)
Import chat history from other platforms to build a deep Soul Profile.

**Supported:** ChatGPT (ZIP export), manual uploads

**What happens after import:**
- Messages are analyzed for communication patterns
- A Soul Profile is generated with: communication style, interests, vocabulary, question patterns, personality insights
- This data feeds into the Persona DNA system and system prompt

### 8. Google Integration
Connected Google accounts provide:
- **Gmail** — Read and compose emails
- **Google Calendar** — Create, view, manage events
- **Google Drive** — Search and create documents

Link accounts in Settings or when prompted during chat. The AI asks which account to use if multiple are connected.

### 9. Telegram Integration
Chat with SoulPrint directly in Telegram via @soulprintbot.

**Link:** Settings → Telegram tab → Message bot → Enter code

### 10. Assessment System
A multi-layered assessment that calibrates the Persona DNA:

**Layer 1: Quick Assessment** — 12 multiple-choice questions (~2 minutes). Provides an initial personality estimate.

**Layer 2: Full Assessment** — 36 slider questions (0-100 spectrum) across 6 pillars:
1. Communication (6 questions)
2. Emotional Intelligence (6 questions)
3. Decision Making (6 questions)
4. Social Dynamics (6 questions)
5. Cognitive Style (6 questions)
6. Assertiveness (6 questions)

**Layer 3: In-Conversation Validation** — The AI occasionally asks calibration questions during chat ("Was that too much detail?", "Too blunt or just right?") to fine-tune the profile.

**Post-Assessment Reward:**
- If a user completes the assessment within 7 days of registering, they receive 7 additional days of Base-tier access for free.
- This reward window only applies if the assessment is completed within the first 7 days.

### 11. Projects & Organization
Organize conversations into Projects with custom AI instructions per project.

**Custom AI Instructions:** Each project can have its own AI persona, tone, and rules. A "Custom AI" badge shows when active.

**Smart Deletion:**
- From "All Chats": Project chats are hidden (still in Project)
- From Project view: Permanently deletes
- No-project chats: Permanently deletes

---

## SUBSCRIPTION & BILLING

### Plans
| Plan | Price | Key Features |
|------|-------|-------------|
| **Free** | $0/mo | Standard-tier models only, limited usage |
| **Base** | $20.01/mo | All models (standard + premium), enhanced limits |
| **Power** | $99.01/mo | All models unlimited, priority support, maximum limits |

Annual plans available at 20% discount.

### Add-On Credit Packs
- Pro Pack: 500 credits for $49.99
- Basic Pack: 100 credits for $14.99

### How Billing Works
- Powered by **Stripe** (live mode — real payments)
- Checkout creates a Stripe customer and subscription
- Access is granted via Stripe webhooks
- Users can manage their subscription at /pricing

### Common Billing Issues
- "Payment failed" → Check card details. If persistent, try a different card.
- "Subscription not active after payment" → Webhooks may have a delay. Wait 1 minute and refresh. If still not active after 5 minutes → ESCALATE.
- "Features locked after subscribing" → Force refresh the page. If still locked → ESCALATE.

---

## INVITE SYSTEM

### How Invites Work
- Every user gets a unique invite code and starts with 5 invites
- Share the code with friends — they can register using it
- When all 5 invites are used, the user **automatically receives 5 more invites** (auto-replenish)
- Invite codes never expire

### Common Issues
- "Invite code not working" → Check that the code is entered exactly (case-insensitive, spaces trimmed)
- "500 error when registering with invite" → This was fixed. If it recurs → ESCALATE.

---

## PRIVACY & DATA CONTROLS

### Settings (in Settings tab)
- **AI Training Opt-Out** — Prevents conversations from being used for model training
- **Analytics Opt-Out** — Disables usage analytics collection
- **Memory Management** — View, edit, and delete stored memories
- **Data Export** — Export full SoulPrint profile as markdown

---

## ACCOUNT & AUTH

### Login Methods
- Email/password registration
- Google OAuth
- Invite code registration

### Common Auth Issues
- Google login error → May be redirect URI mismatch. Try email/password. If persistent → ESCALATE.
- Session expired → Log in again (sessions last 30 days).
- Forgot password → Use "Forgot Password" on login page.

---

## ADMIN DASHBOARD (Admin Only)

### Tabs
- **Metrics**: Quick Stats, Costs (LLM + Voice + Media), Engagement
- **Insights**: Business analytics, pricing recommendations, revenue, churn indicators
- **Subscriptions**: User plans with names, emails, and subscription status
- **Waitlist/Users**: User management with detailed analytics per user
- **Conversations**: Search and view metadata (content is privacy-protected)
- **Blog/Announcements**: Content management
- **App Updates**: Manage "What's New" shown to users
- **Feedback**: User feedback review
- **Beta Codes**: Access code management
- **Assessments**: View user assessment data
- **Imports**: Track data imports
- **Settings**: App-wide configuration

### User Analytics (click any user)
- Usage stats, LLM model preferences, conversation topics
- Memory categories, platform usage (web/Telegram/voice)
- Media generation history, integration status
- Assessment status, feedback summary

---

## LOCATION AWARENESS

SoulPrint can use the user's location for:
- Weather queries
- Local recommendations
- Time zone interpretation ("3pm tomorrow" → their timezone)
- Distance and travel estimates

Location is set in Settings and stored securely.

---

## SUPPORT ESCALATION SYSTEM

When users report issues, the AI troubleshoots first using this knowledge base. If the issue is a genuine bug:
1. The AI tells the user engineering has been notified
2. A support ticket is automatically created via the `[SUPPORT_ESCALATION]` marker
3. The engineering team receives the ticket with full context

**ESCALATE when:**
- Server errors (500, 502, 520) persisting after refresh
- Features completely broken
- Data loss or corruption
- Auth system failures
- Payment/billing issues
- Security concerns

**DON'T escalate:**
- "How do I..." questions → Guide the user
- Slow performance → Normal for certain models
- File format issues → Point to supported formats

---

## KNOWN LIMITATIONS

1. **Video editing is NOT frame-by-frame** — The system extracts a key frame and generates a NEW video. It cannot modify individual frames of an existing video.
2. **Very long messages (>16,000 chars)** may be truncated to preserve context.
3. **Local MongoDB in dev** — The dev container can't reach MongoDB Atlas. Falls back to local MongoDB. This is expected and NOT a bug.
4. **Voice chat requires WebRTC** — Chrome/Safari recommended.
