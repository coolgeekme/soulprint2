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
