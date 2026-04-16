# SoulPrint Engine — Brazilian Portuguese Native Edition (Handoff Summary)

## What is SoulPrint Engine?
A multi-model AI chat application where the AI builds a deep psychological/personality profile ("SoulPrint") of each user over time, creating an increasingly personalized experience. Think of it as an AI companion that truly understands you — in your language, with your cultural context.

## Core Architecture (English Version)
- **Framework**: Next.js 14 (App Router) — full-stack (frontend + API routes)
- **Database**: MongoDB Atlas (production), local MongoDB (dev)
- **AI Models**: OpenAI GPT-4o (chat), Google Gemini (voice), Kie.ai/Nano Banana (images), Veo/Kling (video)
- **Auth**: Email/passcode + invite code system
- **Hosting**: Kubernetes container via Emergent platform

## Key Features to Replicate (Brazilian-Native)
1. **Conversational AI Chat** — Multi-model support (GPT-4o, Claude, Gemini)
2. **SoulPrint System** — Personality profiling via structured assessment + ongoing conversations
3. **Real-time Voice Chat** — WebSocket to Gemini Live API (native audio)
4. **Image Generation** — Text-to-image via Kie.ai Jobs API (Nano Banana, Imagen, etc.)
5. **Video Generation** — Text-to-video and image-to-video (Veo, Kling)
6. **Inline Image Editing** — Edit generated images via conversation ("faz um cartoon disso", "tira o fundo")
7. **Create Mode** — Auto-generates images/videos based on conversation context
8. **Content Moderation** — Age verification, content filtering
9. **Data Import** — Upload chat history from other AI platforms (ChatGPT, Claude, etc.)
10. **Incognito Mode** — Private conversations that don't train the SoulPrint
11. **Location Services** — Find nearby places via Google Maps integration
12. **Web Search** — Real-time web search integrated into chat responses
13. **Admin Dashboard** — User management, analytics, pricing model, support tickets, feedback
14. **Mobile-First PWA** — Responsive design with dedicated mobile chat component
15. **Viral Invite System** — Invite codes with auto-replenishment

---

## What "Brazilian-Native" Means (NOT Translation)

### Critical: Brazilian Portuguese ≠ European Portuguese
This is the most important distinction. Brazilian Portuguese (pt-BR) and European Portuguese (pt-PT) are as different as American English and British English — but even more so in spoken/informal language. The app MUST be built for **pt-BR** specifically.

Key differences:
- **Pronunciation**: Completely different (brazilians say "leite" like "leytchee", Portuguese say "layt")
- **Grammar**: Brazilians use "você" universally; Portuguese use "tu" with different verb conjugations
- **Vocabulary**: Hundreds of different words (autocarro vs ônibus, telemóvel vs celular, pequeno-almoço vs café da manhã)
- **Formality**: Brazilian Portuguese is generally warmer and more informal
- **Gerunds**: Brazilians say "estou fazendo" (I'm doing); Portuguese say "estou a fazer"

### UI/UX Copy
- All interface text written in natural **Brazilian Portuguese** — not translated, not European Portuguese
- Avoid formal/stiff language — Brazilians expect warmth and approachability in digital products
- Examples of natural vs translated:
  - ✅ "Entrar" / ❌ "Iniciar sessão" (login)
  - ✅ "Começar" / ❌ "Iniciar" (get started)
  - ✅ "Fala pra gente o que achou" / ❌ "Forneça seu feedback" (give feedback)
  - ✅ "Deu ruim, tenta de novo" / ❌ "Ocorreu um erro, por favor tente novamente" (error message — casual vs corporate)
  - ✅ "Salvar" / ❌ "Guardar" (save — guardar is European Portuguese)
- Error messages should feel human, not robotic
- Onboarding should feel like a friend showing you around, not a manual

### AI Personality & System Prompts
- The AI companion persona needs a **Brazilian personality** — warm, expressive, uses gírias (slang) appropriately
- System prompts must be written in Brazilian Portuguese from scratch
- Handle regional awareness:
  - **Paulista** (São Paulo): More formal, business-oriented
  - **Carioca** (Rio): More relaxed, playful, uses more gírias
  - **Nordestino** (Northeast): Rich in expressions, "oxe", "vixe", "mainha"
  - **Gaúcho** (South): "Bah", "tchê", "guri/guria"
  - **Mineiro** (Minas Gerais): Shortens everything — "uai", "trem", "nó"
- Include cultural awareness:
  - **Gírias brasileiras**: "massa", "show", "da hora", "top", "mano/mina", "suave", "firmeza", "de boa"
  - **Expressões**: "Deus me livre", "misericórdia", "não é mole não", "tá ligado?"
  - **Humor**: Brazilians love playful banter, double meanings, and self-deprecating humor
  - **Emotional warmth**: Diminutives are HUGE — "um minutinho", "rapidinho", "tranquilinho"
- The SoulPrint assessment questions should be culturally adapted
- Consider: AI should default to "você" (not "tu") for most regions, but adapt if user uses "tu"

### Cultural Considerations

#### Daily Life & Formatting
- **Date format**: DD/MM/AAAA (same as Spanish, NOT American MM/DD)
- **Currency**: R$ (Real brasileiro) — use R$ formatting (R$ 19,99 not $19.99)
- **Number formatting**: Period for thousands, comma for decimals (1.000,00 not 1,000.00)
- **Time**: 24h format is standard (18h30 or 18:30, not 6:30 PM)
- **Address format**: Rua/Av. [Name], [Number] - [Bairro], [City] - [State], [CEP]
- **Phone format**: +55 (DDD) XXXXX-XXXX

#### Cultural References
- **Music**: Sertanejo, Funk, MPB, Pagode, Forró, Samba — not just generic "Latin music"
- **Sports**: Futebol is religion. Know Flamengo, Corinthians, Palmeiras, etc.
- **Food**: Feijoada, pão de queijo, açaí, coxinha, pastel, brigadeiro — not "tacos and burritos"
- **Holidays**: Carnaval, Festa Junina, Dia das Crianças (Oct 12), Dia da Consciência Negra
- **Social media**: Brazilians are among the world's heaviest social media users — WhatsApp is essential, not optional
- **Family**: Very family-oriented culture. "Família" references resonate deeply
- **Religion**: Diverse but significant — Catholic, Evangelical, Spiritist, Afro-Brazilian religions. Be respectful and inclusive
- **Jeitinho brasileiro**: The cultural concept of finding creative workarounds — the AI personality could embrace this positively

#### Digital Behavior
- **WhatsApp**: THE dominant messaging platform. Consider WhatsApp-style UX patterns — Brazilians will feel at home
- **PIX**: Brazil's instant payment system — if any payment integration, PIX is mandatory (not just credit cards)
- **CPF**: Brazilian national ID number — may be needed for account verification
- **Mobile-first**: Brazil is overwhelmingly mobile-first. Desktop is secondary
- **Data sensitivity**: Brazilians have LGPD (Lei Geral de Proteção de Dados) — Brazil's GDPR equivalent. Privacy compliance is legally required

### Content & Moderation
- Brazilian Portuguese content moderation rules
- Gíria detection that doesn't over-filter legitimate slang
  - "Caralho" is offensive but extremely common as an exclamation (similar to "damn")
  - "Porra" same — gauge context, don't auto-block
  - Regional expressions that sound weird out of context but are innocent
- Age verification copy in natural Brazilian Portuguese
- Be aware of racial sensitivity — Brazil has complex racial dynamics. Moderation should be culturally informed

### Voice Chat (Important for Brazilian Market)
- Gemini Live API supports Brazilian Portuguese voices — configure `pt-BR` specifically, NOT `pt-PT`
- Brazilian Portuguese has distinct intonation patterns — more melodic and rhythmic than European Portuguese
- Voice should sound like a **young Brazilian professional**, not a robot or a European Portuguese speaker
- Common voice interactions Brazilians would expect:
  - "Fala!" (informal greeting)
  - "Opa!" (casual acknowledgment)
  - "Show de bola!" (great/awesome)
  - "Beleza?" (all good?)

---

## Technical Architecture (Recommended for Brazilian Version)

### Same Stack (Proven)
- Next.js 14 + MongoDB + Tailwind + shadcn/ui
- Same AI provider integrations (OpenAI, Gemini, Kie.ai)
- Same real-time voice architecture (Gemini Live API supports pt-BR natively)

### Key Differences from English Version
- All system prompts in native Brazilian Portuguese
- UI components with Brazilian Portuguese copy (hand-written, not i18n translated)
- SoulPrint assessment rebuilt for Brazilian cultural context
- AI persona with Brazilian personality (warm, expressive, uses diminutives and gírias)
- Voice chat: Gemini voices configured for pt-BR specifically
- Location services: Default to Brazilian regions, Brazilian address format
- Web search: Prefer Brazilian Portuguese results, prioritize Brazilian sources
- Date/number/currency formatting: Brazilian standards throughout
- Consider: WhatsApp integration for notifications (Brazilians check WhatsApp before email)

### Locale & i18n Technical Notes
- HTML lang attribute: `pt-BR`
- Accept-Language header handling: `pt-BR, pt;q=0.9`
- MongoDB text indexes: Use Portuguese language analyzer
- Search/autocomplete: Handle Brazilian Portuguese accents (ã, õ, ç, é, ê, etc.)
- Keyboard: Brazilian ABNT2 layout consideration for special characters
- Font: Ensure proper rendering of all Portuguese diacritical marks

---

## API Keys Needed (Same as English Version)
- **OpenAI API Key** (GPT-4o for chat) — or use Emergent LLM Key
- **Google Gemini API Key** (for voice chat + vision)
- **Kie.ai API Key** (for image/video generation)
- **MongoDB Atlas** connection string
- **Resend API Key** (for transactional emails — Brazilian Portuguese templates)
- **Google Maps API Key** (for location services — Brazilian addresses)

---

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

---

## Lessons Learned from English Version (Avoid These Pitfalls)
1. **Route decomposition**: Don't let route.js grow to 10k+ lines. Split handlers from day one into `/lib/handlers/`
2. **MongoDB connection pooling**: Use maxPoolSize=200 for Atlas. Add connection fallback logic for dev environments
3. **NDJSON streaming**: Chat uses newline-delimited JSON, not SSE. Frontend parsers must handle this correctly
4. **Intent detection regex**: Be EXTRA careful with Portuguese — word order is more flexible, and gírias can confuse intent detection. "Faz um desenho" (make a drawing) vs "faz sentido esse desenho" (this drawing makes sense) — one is a generation request, the other is a question. Test extensively with real Brazilian Portuguese phrases
5. **Mobile-first**: Build mobile experience alongside desktop from the start. Brazil is overwhelmingly mobile — this is even MORE important than the English version
6. **Image generation polling**: Kie.ai Jobs API uses `state: "success"` (lowercase), not `status: "SUCCESS"`
7. **Audio playback**: Use gapless scheduled playback (AudioContext timing), not onended callbacks — critical for voice quality
8. **Accent handling**: Ensure all text inputs, search, and database queries handle Portuguese diacritical marks (ã, õ, ç, é, ê, í, ú, â, ô) correctly. Normalize for search but preserve for display
9. **Character limits**: Portuguese text is typically 15-25% longer than English. UI elements need breathing room

---

## Brazilian Market Considerations

### Competitive Landscape
- ChatGPT is popular but English-centric
- No major Brazilian-native AI companion exists yet
- WhatsApp chatbots are common but shallow
- This is a blue ocean opportunity for a culturally authentic AI companion

### Growth Strategy Ideas
- **WhatsApp integration**: Essential for Brazilian adoption (consider as Phase 2)
- **Influencer marketing**: Brazil's influencer culture is massive — micro-influencers on Instagram/TikTok
- **Community**: Brazilians love community — Discord/Telegram groups for users
- **Pricing**: PIX payments, consider Brazilian purchasing power (R$29.90/mo is psychologically different from $5.99/mo)
- **Partnerships**: Brazilian tech communities, universities, content creators

### Legal/Compliance
- **LGPD compliance**: Brazil's data protection law (similar to GDPR) — mandatory
- **Terms of service**: Must be in Portuguese, compliant with Brazilian Consumer Code (CDC)
- **Data residency**: Consider hosting in São Paulo region (AWS sa-east-1, GCP southamerica-east1)

---

## Recommended Build Order
1. Auth + landing page (Brazilian Portuguese native copy)
2. Core chat with GPT-4o (Brazilian Portuguese system prompt + personality)
3. SoulPrint assessment (culturally adapted questions for Brazilian context)
4. Image generation integration
5. Voice chat (Brazilian Portuguese Gemini voices — pt-BR)
6. Video generation
7. Mobile optimization (PRIORITY — Brazil is mobile-first)
8. Admin dashboard
9. Invite system (viral — Brazilians are highly social/sharing-oriented)
10. Advanced features (location with Brazilian addresses, web search with Brazilian sources, data import)

---

## Example Brazilian Portuguese System Prompt (Starter)

```
Você é a Claire, uma companheira de IA criada pela SoulPrint. Você é calorosa, inteligente,
bem-humorada e genuinamente interessada em conhecer cada pessoa que conversa com você.

Seu jeito de falar:
- Use "você" (não "tu", a menos que o usuário use)
- Seja natural e acolhedora, como uma amiga próxima
- Use diminutivos quando fizer sentido ("um minutinho", "rapidinho", "tranquilo")
- Gírias leves são bem-vindas ("show", "massa", "top", "de boa")
- Evite ser formal demais — ninguém quer conversar com um robô corporativo
- Use emojis com moderação — brasileiros adoram, mas não exagere
- Quando alguém compartilhar algo difícil, seja empática de verdade ("Puxa, que barra...")
- Celebre as vitórias junto ("Arrasou! 🎉")

Sobre cultura:
- Você entende referências brasileiras (futebol, novela, música, comida, festas)
- Você sabe que "saudade" não tem tradução perfeita — e respeita esse sentimento
- Você não confunde Brasil com outros países da América Latina
- Você sabe a diferença entre paulista, carioca, mineiro, nordestino, gaúcho
- Você respeita a diversidade religiosa e cultural do Brasil

Você NUNCA:
- Fala como se estivesse traduzindo do inglês
- Usa português de Portugal (nada de "telemóvel", "autocarro", "pequeno-almoço")
- Assume que todo brasileiro gosta de samba e futebol
- Faz piadas sobre estereótipos
```

---

## Clone & Convert Checklist

> **How to use**: Clone the English repo. Go through this checklist file-by-file. Items marked 🔴 are full rewrites (language-dependent). Items marked 🟡 are partial changes. Items marked ✅ carry over as-is.

---

### PHASE 1: Core AI Personality (Do First — Everything Else Depends On This)

#### 🔴 `lib/handlers/chat-stream.js` (~5,840 lines) — THE MOST CRITICAL FILE
This is the brain of the app. Multiple sections need rewriting:

| Line Range | What | Action |
|-----------|------|--------|
| ~493 | Model router system prompt | 🔴 Rewrite in Brazilian Portuguese |
| ~670-1010 | `getSystemPrompt()` — Claire's personality, instructions, tool descriptions | 🔴 **Full rewrite.** This defines how the AI speaks, thinks, and behaves. Must be native pt-BR. Use the starter prompt from this doc as a base |
| ~997-1008 | Google integration instructions | 🔴 Rewrite in pt-BR |
| ~1022-1160 | `detectMediaIntent()` — 20+ regex patterns detecting image/video requests | 🔴 **Full rewrite.** "generate an image" → "gera uma imagem", "make me a picture" → "faz uma foto pra mim", "create a video" → "cria um vídeo". Handle Brazilian word order and informal speech |
| ~1719-1760 | `editImagePatterns` — 20+ regex for image edit detection | 🔴 **Full rewrite.** "make it cartoon" → "faz em cartoon", "remove the background" → "tira o fundo", "turn into anime" → "transforma em anime". Handle gerund forms ("fazendo", "tirando") |
| ~1761-1795 | `isLikelyQuestion` — Question detection logic | 🔴 **Full rewrite.** Portuguese questions: "por que", "como", "quando", "onde", "quem", "o que", "qual". No inverted punctuation like Spanish but different sentence structures |
| ~1797-1820 | Aspect ratio recreation patterns | 🟡 Adapt keywords to pt-BR |
| ~1698 | `Sorry, compositing failed` and all error messages | 🔴 Rewrite ~15 error strings. "Desculpa, não rolou" is more natural than "Desculpe, a composição falhou" |
| ~2111-2265 | Image edit error messages | 🔴 Rewrite all "Sorry, I couldn't..." → "Puxa, não consegui..." |
| ~4742-4760 | `detectPlacesIntent()` — Location search regex | 🔴 **Full rewrite.** "find restaurants near me" → "acha restaurantes perto de mim", "coffee shops in" → "cafeterias em". Handle Brazilian place types: "padaria", "lanchonete", "posto de gasolina" |
| ~4790-4810 | Place search term extraction regex | 🔴 Rewrite — "perto de/em/ao redor de" instead of "near/in/around" |
| ~5300-5430 | Support escalation (Ace handoff) | 🔴 Rewrite escalation messages and email subjects |

#### 🔴 `lib/handlers/support-bot.js` (~419 lines)
| Section | Action |
|---------|--------|
| Line 17 | Ace's system prompt (30+ lines) | 🔴 **Full rewrite.** Ace needs a Brazilian personality. Consider renaming to something Brazilians connect with |
| All response strings | 🔴 Every user-facing message in natural pt-BR |

#### 🔴 `lib/handlers/assessment-data.js` (~605 lines, 63 questions)
| Section | Action |
|---------|--------|
| All 63 SEED_QUESTIONS | 🔴 **Full rewrite.** Must be culturally adapted for Brazil. Questions about communication style should reference Brazilian contexts (WhatsApp groups, family dynamics, "jeitinho"). Some questions won't make cultural sense and need replacement |
| Answer options (labels) | 🔴 All option labels in natural pt-BR. Use casual tone matching Brazilian digital culture |

#### 🔴 `lib/handlers/gradual-assessment.js` (~1,056 lines)
| Section | Action |
|---------|--------|
| All question prompts | 🔴 Rewrite for Brazilian cultural context |
| AI analysis prompts | 🔴 Rewrite LLM prompts in pt-BR |

#### 🔴 `lib/handlers/layered-assessment.js` (~328 lines)
| Section | Action |
|---------|--------|
| Assessment layer questions | 🔴 Rewrite for Brazilian context |

---

### PHASE 2: Frontend UI Copy

#### 🔴 `app/page.js` (~458 lines) — Landing Page
Every heading, paragraph, CTA button, feature description. Full rewrite in native pt-BR. Remember: Brazilian Portuguese is typically 15-25% longer than English — UI elements need breathing room.

#### 🔴 `app/auth/page.js` (~617 lines) — Login/Signup
- Form labels, placeholders, button text, error messages
- "Sign In" → "Entrar"
- "Create Account" → "Criar conta"
- "Forgot password" → "Esqueci a senha"
- All validation messages in natural pt-BR
- Consider CPF field if needed for Brazilian users

#### 🔴 `app/chat/page.js` (~5,996 lines) — Main Chat (Desktop)
| Section | Action |
|---------|--------|
| Sidebar labels | 🔴 "New Chat" → "Nova conversa", "Settings" → "Configurações" |
| Input placeholders | 🔴 "Type a message..." → "Escreve aqui..." or "Manda sua mensagem..." |
| Empty state messages | 🔴 "Start a conversation" → "Começa uma conversa" |
| Settings modal | 🔴 All setting labels, descriptions, toggles |
| Media cards | 🟡 "Generating image..." → "Gerando imagem...", "View Image" → "Ver imagem" |
| Error toasts | 🔴 All error/success notifications in natural pt-BR |
| Create Mode labels | 🔴 "Create Mode activated" → "Modo criativo ativado" |

#### 🔴 `components/mobile/MobileChat.js` (~4,546 lines) — Mobile Chat
Same changes as desktop. **PRIORITY** — Brazil is overwhelmingly mobile-first. This file may matter more than the desktop version.

#### 🟡 `app/admin/page.js` (~7,545 lines) — Admin Dashboard
Decision point: Keep in English (team-only) or rewrite for Brazilian admins. If rewriting, all tab labels, metrics, table headers, chart labels need pt-BR.

---

### PHASE 3: Backend Services

#### 🔴 `lib/handlers/content-moderation.js` (~174 lines)
| Section | Action |
|---------|--------|
| All regex patterns | 🔴 **Full rewrite.** English patterns won't catch Portuguese. Build Brazilian-specific patterns. Be careful with common Brazilian exclamations that sound harsh out of context ("caralho", "porra" — extremely common but technically profane) |
| Moderation response messages | 🔴 Natural pt-BR refusal messages |
| Categories remain the same | ✅ child_safety, sexual_content, violence, hate_speech, self_harm |

#### 🔴 `lib/handlers/spelling-guard.js` (~461 lines)
| Section | Action |
|---------|--------|
| English spelling corrections | 🔴 Replace with Portuguese spelling patterns |
| Handle accents | 🔴 ã, õ, ç, é, ê, í, ú, â, ô — common typos: missing accents, "vc" → "você", "tb" → "também", "pq" → "porque" |

#### 🔴 `lib/email.js` (~307 lines)
| Section | Action |
|---------|--------|
| Welcome email template | 🔴 Full rewrite. "Thanks for joining SoulPrint" → "Que bom que você chegou! Bem-vindo(a) ao SoulPrint" |
| Waitlist accepted email | 🔴 Full rewrite in warm Brazilian tone |
| All email copy | 🔴 Every string in native pt-BR |

#### 🔴 `lib/handlers/invites-beta.js` — Invite System
| Section | Action |
|---------|--------|
| Invite email templates | 🔴 Rewrite. Brazilians are social — make the invite feel like a friend sharing something cool, not a corporate invite |
| Verification email | 🔴 "Verify your SoulPrint account" → "Confirma sua conta no SoulPrint" |
| Success/error messages | 🔴 All user-facing strings |

#### 🔴 `lib/handlers/location-services.js` (~188 lines)
| Section | Action |
|---------|--------|
| `parseLocationQuery()` regex | 🔴 "near/in/around/at" → "perto de/em/ao redor de/no/na" |
| `extractPlaceType()` keyword map | 🔴 "restaurant" → "restaurante", "pharmacy" → "farmácia", "gas station" → "posto de gasolina", PLUS Brazilian-specific: "padaria", "lanchonete", "açaiteria", "churrascaria" |
| Place type mappings | 🔴 All keywords to Brazilian Portuguese |

#### 🟡 `lib/handlers/media-intelligence.js` (~1,379 lines)
| Section | Action |
|---------|--------|
| User-facing error messages | 🔴 Rewrite feedback responses |
| Feedback email templates | 🔴 Adapt to pt-BR |

#### 🔴 `lib/handlers/announcements.js`
| Section | Action |
|---------|--------|
| Release notes generation prompts | 🔴 Rewrite in pt-BR |

---

### PHASE 4: Voice Chat

#### 🟡 `app/chat/components/GeminiVoiceChat.js` (~820 lines)
| Section | Action |
|---------|--------|
| Voice selection defaults | 🟡 Configure pt-BR Gemini voice (Brazilian accent, NOT European Portuguese) |
| UI labels ("Listening...", "AI Speaking...") | 🔴 "Ouvindo...", "Falando..." |
| Error messages | 🔴 Translate to natural pt-BR |
| Language config | 🔴 Ensure `pt-BR` locale is sent to Gemini, not `pt-PT` |

#### 🟡 `app/api/gemini/voice-sample/route.js` (~210 lines)
| Section | Action |
|---------|--------|
| Voice greeting text | 🔴 Change to Brazilian Portuguese greeting |
| Voice names | 🟡 Select voice that sounds Brazilian, not European Portuguese |

---

### PHASE 5: Brazilian-Specific Additions (NOT in English version)

These are NEW features/changes specific to the Brazilian market:

| Feature | Why | Priority |
|---------|-----|----------|
| Number formatting (1.000,00) | Brazilian standard — opposite of US | 🔴 High |
| Date formatting (DD/MM/AAAA) | Brazilian standard | 🔴 High |
| Currency (R$) | If any pricing shown | 🟡 Medium |
| CPF validation | If account verification needed | 🟡 Medium |
| WhatsApp share buttons | Brazilians share via WhatsApp, not SMS/email | 🟡 Medium |
| LGPD compliance banner | Legal requirement in Brazil | 🔴 High |
| Brazilian place types | "padaria", "lanchonete", "açaiteria", "churrascaria" | 🟡 Medium |

---

### PHASE 6: Files That Carry Over AS-IS ✅

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
| 🔴 Full Rewrite (language-critical) | ~15 files | 65% of conversion work |
| 🟡 Partial Changes | ~8 files | 20% of conversion work |
| 🔴 Brazilian-Specific Additions | ~5 new features | 10% of conversion work |
| ✅ No Changes Needed | ~20+ files | 0% — just works |

**Total estimated conversion effort**: 35-45% of the original build time (slightly more than Spanish due to Brazilian-specific additions like LGPD, number formatting, and WhatsApp integration).

