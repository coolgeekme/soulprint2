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
