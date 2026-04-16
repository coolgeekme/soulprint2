# SoulPrint Engine — Spanish Native Edition (Handoff Summary)

## What is SoulPrint Engine?
A multi-model AI chat application where the AI builds a deep psychological/personality profile ("SoulPrint") of each user over time, creating an increasingly personalized experience. Think of it as an AI companion that truly understands you.

## Core Architecture (English Version)
- **Framework**: Next.js 14 (App Router) — full-stack (frontend + API routes)
- **Database**: MongoDB Atlas (production), local MongoDB (dev)
- **AI Models**: OpenAI GPT-4o (chat), Google Gemini (voice), Kie.ai/Nano Banana (images), Veo/Kling (video)
- **Auth**: Email/passcode + invite code system
- **Hosting**: Kubernetes container via Emergent platform

## Key Features to Replicate (Spanish-Native)
1. **Conversational AI Chat** — Multi-model support (GPT-4o, Claude, Gemini)
2. **SoulPrint System** — Personality profiling via structured assessment + ongoing conversations
3. **Real-time Voice Chat** — WebSocket to Gemini Live API (native audio)
4. **Image Generation** — Text-to-image via Kie.ai Jobs API (Nano Banana, Imagen, etc.)
5. **Video Generation** — Text-to-video and image-to-video (Veo, Kling)
6. **Inline Image Editing** — Edit generated images via conversation ("make it cartoon", "remove background")
7. **Create Mode** — Auto-generates images/videos based on conversation context
8. **Content Moderation** — Age verification, content filtering
9. **Data Import** — Upload chat history from other AI platforms (ChatGPT, Claude, etc.)
10. **Incognito Mode** — Private conversations that don't train the SoulPrint
11. **Location Services** — Find nearby places via Google Maps integration
12. **Web Search** — Real-time web search integrated into chat responses
13. **Admin Dashboard** — User management, analytics, pricing model, support tickets, feedback
14. **Mobile-First PWA** — Responsive design with dedicated mobile chat component
15. **Viral Invite System** — Invite codes with auto-replenishment

## What "Spanish-Native" Means (NOT Translation)

### UI/UX Copy
- All interface text, buttons, labels, error messages, onboarding flows written BY a native Spanish speaker or reviewed for naturalness
- Consider regional variants: "Iniciar sesión" vs colloquial alternatives
- Formal (usted) vs informal (tú) — decide on the app's personality voice
- Avoid "translated English" phrasing (e.g., don't say "Toma una captura" when "Haz una captura" is natural)

### AI Personality & System Prompts
- The AI companion persona (currently "Claire" in English) needs a Spanish-native personality
- System prompts must be written in Spanish, not translated
- Include cultural awareness: dichos (sayings), refranes (proverbs), humor styles
- Handle regional slang awareness (Mexican Spanish, Rioplatense, Caribbean, Castilian, etc.)
- The SoulPrint assessment questions should be culturally appropriate
- Tú/vos/usted handling based on user preference or region detection

### Cultural Considerations
- Date formats: DD/MM/YYYY (not MM/DD/YYYY)
- Currency awareness: Multiple currencies across Spanish-speaking countries
- Cultural references: Music, food, sports, holidays should feel authentic
- Humor and tone: Spanish humor has different rhythms than English
- Privacy attitudes may differ by region
- Family/community-oriented framing may resonate more than individualistic

### Content & Moderation
- Spanish-language content moderation rules
- Slang detection that doesn't over-filter legitimate regional expressions
- Age verification copy in natural Spanish

## Technical Architecture (Recommended for Spanish Version)

### Same Stack (Proven)
- Next.js 14 + MongoDB + Tailwind + shadcn/ui
- Same AI provider integrations (OpenAI, Gemini, Kie.ai)
- Same real-time voice architecture (Gemini Live API supports Spanish natively)

### Key Differences
- All system prompts in native Spanish
- UI components with Spanish copy (not i18n translated — hand-written)
- SoulPrint assessment rebuilt for Spanish cultural context
- AI persona with Spanish-native personality
- Consider: Should the AI default to tú or usted? (Suggest: let user choose during onboarding)
- Voice chat: Gemini Live supports Spanish voices — configure appropriately
- Location services: Default to Spanish-speaking regions
- Web search: Prefer Spanish-language results

## API Keys Needed (Same as English Version)
- **OpenAI API Key** (GPT-4o for chat) — or use Emergent LLM Key
- **Google Gemini API Key** (for voice chat + vision)
- **Kie.ai API Key** (for image/video generation)
- **MongoDB Atlas** connection string
- **Resend API Key** (for transactional emails — Spanish templates)
- **Google Maps API Key** (for location services)

## File Structure Reference (English App)
```
/app
├── app/
│   ├── page.js                    # Landing page
│   ├── auth/page.js               # Login/signup
│   ├── chat/page.js               # Main chat (desktop) — ~6k lines
│   │   └── components/
│   │       ├── GeminiVoiceChat.js  # Voice chat component
│   │       └── RealtimeVoiceChat.js
│   ├── admin/page.js              # Admin dashboard — ~7.5k lines
│   ├── api/
│   │   ├── [[...path]]/route.js   # Main API router — ~10k lines (needs decomposition)
│   │   ├── admin/[...path]/route.js
│   │   └── voice/[...path]/route.js
├── components/
│   ├── chat/                      # Chat UI components
│   ├── mobile/MobileChat.js       # Mobile chat — ~4.5k lines
│   └── ui/                        # shadcn components
├── lib/
│   ├── mongodb.js                 # DB connection with fallback
│   └── handlers/
│       ├── chat-stream.js         # Chat logic — ~5.8k lines (core)
│       ├── media-intelligence.js  # Image/video routing
│       ├── image-models.js        # Image model configs
│       ├── video-models.js        # Video model configs
│       ├── support-bot.js         # In-app support (Ace)
│       ├── location-services.js   # Google Maps integration
│       └── invites-beta.js        # Invite system
```

## Lessons Learned from English Version (Avoid These Pitfalls)
1. **Route decomposition**: Don't let route.js grow to 10k+ lines. Split handlers from day one.
2. **MongoDB connection pooling**: Use maxPoolSize=200 for Atlas. Add connection fallback logic.
3. **NDJSON streaming**: Chat uses newline-delimited JSON, not SSE. Frontend parsers must handle this.
4. **Intent detection regex**: Be careful with media/location/question detection — too aggressive causes false triggers, too loose misses requests. Test extensively with Spanish phrases.
5. **Mobile-first**: Build mobile experience alongside desktop from the start, not as an afterthought.
6. **Image generation polling**: Kie.ai Jobs API uses `state: "success"` (lowercase), not `status: "SUCCESS"`.
7. **Audio playback**: Use gapless scheduled playback (AudioContext timing), not onended callbacks.

## Recommended Build Order
1. Auth + landing page (Spanish-native copy)
2. Core chat with GPT-4o (Spanish system prompt + personality)
3. SoulPrint assessment (culturally adapted questions)
4. Image generation integration
5. Voice chat (Spanish Gemini voices)
6. Video generation
7. Mobile optimization
8. Admin dashboard
9. Invite system
10. Advanced features (location, web search, data import)

---

## Clone & Convert Checklist

> **How to use**: Clone the English repo. Go through this checklist file-by-file. Items marked 🔴 are full rewrites (language-dependent). Items marked 🟡 are partial changes. Items marked ✅ carry over as-is.

---

### PHASE 1: Core AI Personality (Do First — Everything Else Depends On This)

#### 🔴 `lib/handlers/chat-stream.js` (~5,840 lines) — THE MOST CRITICAL FILE
This is the brain of the app. Multiple sections need rewriting:

| Line Range | What | Action |
|-----------|------|--------|
| ~493 | Model router system prompt | 🔴 Rewrite in Spanish |
| ~670-1010 | `getSystemPrompt()` — Claire's personality, instructions, tool descriptions | 🔴 **Full rewrite.** This defines how the AI speaks, thinks, and behaves. Must be native Spanish, not translated |
| ~997-1008 | Google integration instructions | 🔴 Rewrite in Spanish |
| ~1022-1160 | `detectMediaIntent()` — 20+ regex patterns detecting image/video requests | 🔴 **Full rewrite.** "generate an image" → "genera una imagen", "make me a picture" → "hazme una foto", etc. Every pattern must be rebuilt for Spanish grammar and word order |
| ~1719-1760 | `editImagePatterns` — 20+ regex patterns for image edit detection | 🔴 **Full rewrite.** "make it cartoon" → "hazlo caricatura", "remove the background" → "quita el fondo", "turn into anime" → "conviértelo en anime" |
| ~1761-1795 | `isLikelyQuestion` — Question detection logic | 🔴 **Full rewrite.** Spanish questions start differently: "¿por qué", "¿cómo", "¿cuándo", "¿dónde", "¿quién". Also handle inverted question marks |
| ~1797-1820 | Aspect ratio recreation patterns | 🟡 Mostly regex — adapt keywords to Spanish |
| ~1698 | `Sorry, compositing failed` and all error messages | 🔴 Rewrite ~15 user-facing error strings to natural Spanish |
| ~2111-2265 | Image edit error messages | 🔴 Rewrite all "Sorry, I couldn't..." messages |
| ~3478-3500 | Video moderation messages | 🟡 Adapt moderation responses |
| ~4742-4760 | `detectPlacesIntent()` — Location search regex | 🔴 **Full rewrite.** "find restaurants near me" → "encuentra restaurantes cerca de mí", "coffee shops in" → "cafeterías en" |
| ~4790-4810 | Place search term extraction regex | 🔴 Rewrite — Spanish word order differs |
| ~5300-5430 | Support escalation system (Ace handoff) | 🔴 Rewrite escalation messages and email subjects |

#### 🔴 `lib/handlers/support-bot.js` (~419 lines)
| Section | Action |
|---------|--------|
| Line 17 | Ace's system prompt (30+ lines) | 🔴 **Full rewrite.** Ace needs a Spanish personality. Consider renaming from "Ace" to something culturally appropriate |
| All response strings | 🔴 Every user-facing message needs native Spanish |

#### 🔴 `lib/handlers/assessment-data.js` (~605 lines, 63 questions)
| Section | Action |
|---------|--------|
| All 63 SEED_QUESTIONS | 🔴 **Full rewrite.** These are the SoulPrint personality assessment. Must be culturally adapted, not just translated. Some questions about communication style, humor, etc. will need completely different framings for Spanish culture |
| Answer options (labels) | 🔴 All option labels must be natural Spanish |

#### 🔴 `lib/handlers/gradual-assessment.js` (~1,056 lines)
| Section | Action |
|---------|--------|
| All question prompts | 🔴 Rewrite gradual/layered assessment in Spanish |
| AI analysis prompts | 🔴 Rewrite LLM prompts that analyze user responses |

#### 🔴 `lib/handlers/layered-assessment.js` (~328 lines)
| Section | Action |
|---------|--------|
| Assessment layer questions | 🔴 Rewrite for Spanish cultural context |

---

### PHASE 2: Frontend UI Copy

#### 🔴 `app/page.js` (~458 lines) — Landing Page
Every heading, paragraph, CTA button, feature description. Full rewrite in native Spanish.

#### 🔴 `app/auth/page.js` (~617 lines) — Login/Signup
- Form labels, placeholders, button text, error messages, terms of service
- "Sign In" → "Entrar" / "Iniciar sesión"
- "Create Account" → "Crear cuenta"  
- All validation messages

#### 🔴 `app/chat/page.js` (~5,996 lines) — Main Chat (Desktop)
| Section | Action |
|---------|--------|
| Sidebar labels | 🔴 "New Chat", "Settings", "Projects", etc. |
| Input placeholders | 🔴 "Type a message..." → "Escribe un mensaje..." |
| Empty state messages | 🔴 "Start a conversation" → "Comienza una conversación" |
| Settings modal | 🔴 All setting labels, descriptions, toggles |
| Media cards | 🟡 "Generating image...", "View Image", etc. |
| Error toasts | 🔴 All error/success notification text |
| Create Mode labels | 🔴 "Create Mode activated" → "Modo creativo activado" |

#### 🔴 `components/mobile/MobileChat.js` (~4,546 lines) — Mobile Chat
Same changes as desktop `page.js` but in the mobile layout. Nearly every string needs rewriting.

#### 🟡 `app/admin/page.js` (~7,545 lines) — Admin Dashboard
The admin dashboard can stay in English if only the team uses it, OR rewrite if admins are Spanish-speaking. Decision point for the team.

---

### PHASE 3: Backend Services

#### 🔴 `lib/handlers/content-moderation.js` (~174 lines)
| Section | Action |
|---------|--------|
| All regex patterns | 🔴 **Full rewrite.** English profanity/harmful content patterns don't detect Spanish equivalents. Must build Spanish-specific patterns |
| Moderation response messages | 🔴 "I can't help with that" → natural Spanish refusal |
| Categories remain the same | ✅ child_safety, sexual_content, violence, hate_speech, self_harm |

#### 🔴 `lib/handlers/spelling-guard.js` (~461 lines)
| Section | Action |
|---------|--------|
| English spelling corrections | 🔴 Replace with Spanish spelling/grammar patterns |
| Common misspellings dictionary | 🔴 Build Spanish equivalent |

#### 🔴 `lib/email.js` (~307 lines)
| Section | Action |
|---------|--------|
| Welcome email template | 🔴 Full rewrite in Spanish |
| Waitlist accepted email | 🔴 Full rewrite |
| Feedback notification email | 🟡 Adapt subject lines and body |
| All email copy | 🔴 "Thanks for joining SoulPrint" → native Spanish equivalent |

#### 🔴 `lib/handlers/invites-beta.js` — Invite System
| Section | Action |
|---------|--------|
| Invite email templates | 🔴 Rewrite invitation copy |
| Verification email | 🔴 "Verify your SoulPrint account" → Spanish |
| Success/error messages | 🔴 All user-facing strings |

#### 🔴 `lib/handlers/location-services.js` (~188 lines)
| Section | Action |
|---------|--------|
| `parseLocationQuery()` regex | 🔴 "near/in/around/at" → "cerca de/en/alrededor de" |
| `extractPlaceType()` keyword map | 🔴 "restaurant" → "restaurante", "pharmacy" → "farmacia", etc. |
| Place type mappings | 🔴 All keywords to Spanish |

#### 🟡 `lib/handlers/media-intelligence.js` (~1,379 lines)
| Section | Action |
|---------|--------|
| User-facing error messages | 🔴 Rewrite feedback responses |
| Feedback email templates | 🔴 Adapt to Spanish |
| Model descriptions (if shown to users) | 🟡 Translate model capability descriptions |

#### 🔴 `lib/handlers/announcements.js`
| Section | Action |
|---------|--------|
| Release notes generation prompts | 🔴 Rewrite in Spanish |
| User-facing announcement copy | 🔴 Rewrite |

#### 🔴 `lib/handlers/blog-notifications.js`
| Section | Action |
|---------|--------|
| Blog notification templates | 🔴 Rewrite in Spanish |

---

### PHASE 4: Voice Chat

#### 🟡 `app/chat/components/GeminiVoiceChat.js` (~820 lines)
| Section | Action |
|---------|--------|
| Voice selection defaults | 🟡 Configure Spanish-appropriate Gemini voice |
| UI labels ("Listening...", "AI Speaking...") | 🔴 Translate status indicators |
| Error messages | 🔴 Translate |

#### 🟡 `app/api/gemini/voice-sample/route.js` (~210 lines)
| Section | Action |
|---------|--------|
| Voice greeting text | 🔴 Change greeting from English to Spanish |
| Voice names | 🟡 May need different default voice for Spanish |

---

### PHASE 5: Files That Carry Over AS-IS ✅

These need NO language changes:

| File | Why It's Safe |
|------|--------------|
| `lib/mongodb.js` | Database connection — language-independent |
| `lib/handlers/image-models.js` | Model configs — API parameters only |
| `lib/handlers/video-models.js` | Model configs — API parameters only |
| `lib/handlers/image-editing.js` | Image processing — no user-facing text |
| `lib/handlers/attachment-upload.js` | File upload — no user-facing text |
| `lib/handlers/chat-cache.js` | Caching logic — no text |
| `lib/handlers/cloud-import.js` | Import logic — minimal text |
| `lib/handlers/conversations-crud.js` | CRUD operations — minimal text |
| `lib/handlers/data-import.js` | Data import — minimal text |
| `lib/handlers/document-parsing.js` | Document parsing — no text |
| `lib/handlers/feature-flags.js` | Feature flags — no text |
| `lib/handlers/memory-system.js` | Memory logic — no user-facing text |
| `lib/handlers/model-comparison.js` | Model routing — API only |
| `lib/handlers/privacy.js` | Privacy logic — minimal text |
| `lib/handlers/projects-tags.js` | Project management — minimal text |
| `lib/handlers/video-editor.js` | Video processing — no text |
| `lib/handlers/voice-misc.js` | Voice utilities — no text |
| `components/ui/*` | shadcn components — no text |
| All CSS/Tailwind | Styling — language-independent |
| `package.json` | Dependencies — same |
| `.env` | Environment variables — same |

---

### Summary: Effort Estimate

| Category | Files | Effort |
|----------|-------|--------|
| 🔴 Full Rewrite (language-critical) | ~15 files | 70% of conversion work |
| 🟡 Partial Changes | ~8 files | 20% of conversion work |
| ✅ No Changes Needed | ~20+ files | 0% — just works |

**Total estimated conversion effort**: 30-40% of the original build time (infrastructure is free, language layer is the work).

