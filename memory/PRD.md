# SoulPrint - Product Requirements Document

## Original Problem Statement
Full-stack Next.js 14 app ("SoulPrint") with multiple issues: 520 errors, Firebase auth issues, admin dashboard missing metrics, Google OAuth failures, and deployment failures.

## Tech Stack
- **Backend**: Next.js 14 (App Router), Node.js, MongoDB
- **Frontend**: React, Tailwind CSS, shadcn/ui
- **Database**: MongoDB (local + Atlas)
- **Auth**: Firebase, Google OAuth, JWT
- **Real-time**: SSE for chat streaming
- **Deployment**: Emergent platform (K8s)
- **LLMs**: OpenAI, Anthropic, Perplexity, Gemini, Kimi

## What's Been Implemented

### Session 1 (Previous)
- Lazy MongoDB connection to fix deployment timeouts
- Dynamic Google OAuth redirect URIs
- X-Accel-Buffering headers for streaming
- Keep-alive mechanism for chat streams
- Admin metrics & insights API endpoints created
- InsightsTab crash fixes
- Firebase auth error handling restored

### Session 2 (2026-03-17) — Admin Dashboard Metrics
- Added 15+ missing computed fields to `/api/admin/metrics`
- Added 7 new data sections to `/api/admin/insights` (revenue potential, top users, model popularity, feature adoption, churn, trends, media)
- All Metrics sub-tabs and Insights tab now render without crashes

### Session 3 (2026-03-17) — Three New Features
1. **Real-time Auto-Refresh Dashboard**
   - 30-second polling interval on Metrics tab
   - Live/Paused toggle button with spinning indicator
   - "Updated at" timestamp display
   - Manual refresh button
2. **Conversation Search**
   - Created `GET /api/admin/conversations` endpoint with search, pagination
   - Search by user email or topic
   - Source column (web/telegram), total count
   - Clear button resets search
3. **Telegram Disconnect**
   - Added "Disconnect" button in chat settings > Telegram tab
   - Calls `POST /api/telegram/unlink` with confirmation dialog
   - Updates UI state on successful unlink

## Prioritized Backlog

### P1 (Important)
- Production DB export (blocked on Atlas firewall)
- Platform DNS/routing 520 errors (needs Emergent support)

### P2 (Nice to Have)
- Refactor monolithic `/app/api/[[...path]]/route.js`
- Add `tier_recommendations` and `features_by_segment` to insights API
- Admin dashboard data-testid coverage

### Recent Additions (Current Session)
- **Gemini 3.1 Flash Live Voice Chat**: Added as an alternative to OpenAI Realtime for voice conversations
  - New component: `/app/app/chat/components/GeminiVoiceChat.js` (WebSocket-based)
  - Backend: `/app/app/api/gemini/live-token/route.js` provides API key for WebSocket connection
  - Backend: `/app/app/api/gemini/voice-sample/route.js` generates voice previews using native audio SDK (cached 24h)
  - Voice Engine selector in Settings → Voice (OpenAI vs Gemini)
  - Gemini native voices: Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr
  - Voice preview: Users can tap speaker icon on each voice card to hear it before selecting
  - Uses `gemini-2.5-flash-native-audio-latest` for both voice chat AND voice previews (consistent sound)
  - Audio resampling: Properly downsamples from browser native rate to 16kHz for Gemini
  - AI speaks first with greeting when session starts
  - Dynamic component loading: chat page switches between OpenAI (WebRTC) and Gemini (WebSocket)
  - Voice settings persist: `voice_engine`, `default_voice`, `default_gemini_voice` saved to DB

- **Read Aloud Feature**: Play button on every assistant message to read it aloud
  - Backend: `POST /api/voice/tts/read-aloud` - uses the user's selected voice engine and voice
  - If voice engine is Gemini: uses Gemini TTS REST API with user's default Gemini voice
  - If voice engine is OpenAI: uses OpenAI TTS API with user's default OpenAI voice
  - Markdown stripping for clean audio output
  - Desktop: Volume2 icon in message actions (thumbs up, thumbs down, copy, **read aloud**, continue)
  - Mobile: Volume2 icon with "Read" label in message action tray
  - Stop/cancel support: clicking again stops playback

- **Social Media Landing Page**: Ad destination page at `/lp/social`
  - File: `/app/app/lp/social/page.js`
  - Dark theme with orange/amber gradients matching SoulPrint branding
  - Sections: Hero, Problem/Hook, Features (6 cards), How It Works (3 steps), Comparison table, Final CTA, Footer
  - Fully responsive (desktop + mobile)
  - Scroll animations via IntersectionObserver
  - CTA links to `/auth` for signup
  - Uses SoulPrint logo assets (light + icon variants)

- **Admin Support Notification System**: Notify users when issues are resolved
  - Backend: `POST /api/admin/resolve-issue` sends email via Resend + stores in-app notification
  - Email from `support@soulprintengine.ai` with `[SoulPrint Engine Support]` subject prefix
  - In-app toast notification on next chat page visit
  - Admin UI: Support tab in admin dashboard with form

- **Clickable Bare URLs**: All URLs in chat replies are now clickable links
  - Updated `SafeMarkdown.js` with regex-based URL linkification

## Key Files
- `/app/app/api/admin/[...path]/route.js` — Admin API (metrics, insights, conversations, support)
- `/app/app/admin/page.js` — Admin dashboard frontend (with Support tab)
- `/app/app/chat/page.js` — Chat page with Telegram disconnect, notification toast
- `/app/app/lp/social/page.js` — Social media landing page
- `/app/lib/mongo.js` — MongoDB connection (lazy loading)
- `/app/api/[[...path]]/route.js` — Main API router
- `/app/components/SafeMarkdown.js` — Markdown renderer with bare URL linking

### Route.js Decomposition Session
- **MAJOR REFACTORING**: Reduced `app/api/[[...path]]/route.js` from 10,473 lines to 835 lines (92% reduction)
- Created 15 NEW extracted handler modules in `lib/handlers/`:
  - `google-integration.js` (1,066 lines) - Google OAuth, Gmail, Calendar, Drive handlers
  - `auth-handlers.js` (434 lines) - Register, Login, Firebase Auth, Me, Profile
  - `assessment-core.js` (179 lines) - Questions, Progress, Submit, Complete, Reset
  - `conversations-crud.js` (169 lines) - CRUD operations for conversations
  - `scheduling.js` (294 lines) - Social media post generation, scheduled tasks
  - `telegram-handlers.js` (302 lines) - Telegram bot connector
  - `voice-misc.js` (202 lines) - Voice settings, feature flags, transcription, models
  - `blog-notifications.js` (129 lines) - Blog posts and notifications
  - `location-handlers.js` (246 lines) - Places search, geocoding, user location/timezone
  - `import-extracted.js` (239 lines) - Client-side data import processing
  - `document-parsing.js` (425 lines) - PDF conversion, document parsing, image-to-JSON
  - `image-editing.js` (2,065 lines) - Image editing, compositing, mockup generation
  - `chat-stream.js` (3,247 lines) - Chat streaming with web search, tool calling
  - `chat-cache.js` (18 lines) - Shared in-memory caches
  - `import-upload.js` (582 lines) - Upload processing for ChatGPT/Facebook imports
- **Mask Editing UI Polish**: Enhanced `components/chat/ImageEditor.js` with canvas-based mask drawing:
  - Brush/eraser tools with adjustable size
  - Real-time mask preview with purple overlay
  - Touch support for mobile
  - Keyboard shortcuts (B for brush, E for eraser, [ ] for size)
  - Mask-to-dataURL conversion for API submission
  - Clear/undo mask functionality
  - Mask visibility toggle
- All 17+ backend endpoints verified working after refactoring

- **Smart Aspect Ratio Recreation (P0)**: When a user requests to change an existing image's aspect ratio (e.g., "recreate this as 1:1", "make this square", "convert to portrait"), the system now:
  - Detects the intent via `aspectRatioRecreationPatterns` BEFORE standard edit detection
  - Fetches the original image and analyzes it with GPT-4o Vision for detailed description
  - Generates a BRAND NEW image at the target aspect ratio (not a crop/shrink)
  - Uses gpt-image-1 (primary), Kie.ai Nano Banana (fallback 1), DALL-E 3 (fallback 2)
  - Both `isEditRequest` and `couldBeEditRequest` exclude aspect ratio recreation requests

- **Multi-Image Upload Pre-Upload System (P0)**: Fixed "Connection error" when users attach 2+ images:
  - Created `POST /api/attachments/upload` endpoint for pre-uploading individual images
  - Primary storage: Kie.ai persistent cloud storage (returns https:// URLs)
  - Fallback: MongoDB `temp_attachments` collection with 24h TTL auto-cleanup
  - Frontend auto-pre-uploads when payload exceeds 800KB or 2+ images attached
  - Backend `chat-stream.js` updated to handle URL references, `attachment://` protocol, and standard base64
  - Client-side compression: MAX_DIM 1536px, JPEG quality 0.75 for all images

- **Media Confirmation Flow Fix (P0)**: Fixed bypass of confirmation when Confirm Gen mode was active:
  - Root cause: Two paths — (1) `detectMediaIntent` regex patterns were too narrow, missing natural phrases like "need a video of", "give me an image of", and (2) post-LLM auto-generation blocks were not gated by `quickGenerate` setting
  - Expanded video detection patterns: "need a video", "give me a video", "can I get a video", "video prompt for"
  - Expanded image detection patterns: "need an image/picture", "give me an image", "can I get a picture", "image prompt for"
  - Moved `quickGenerate` preference fetch earlier in the flow so it's accessible to all downstream checks
  - Gated Auto-Image and Auto-Video generation detection blocks with `quickGenerate` — when false (Confirm Gen mode), auto-generation is suppressed
  - Tested: 21/21 tests pass — confirmation triggers correctly for both image and video, quick gen bypasses correctly, non-media messages unaffected
  - Applied to both desktop (`page.js`) and mobile (`MobileChat.js`)
  - File: `lib/handlers/chat-stream.js`

- **Multi-Image Composite Fix — Double Generation & Missing Reference (P0)**:
  - Fixed double image generation when confirmed mediaFlow triggers alongside auto-generation
  - Added image generation dedup guard (like video already had) — checks if image already exists for assistantMsgId before generating
  - Made `send()` function safe against closed ReadableStream controllers (prevents crashes)
  - Fixed Vision analysis limit: expanded from 2 to 4 reference images analyzed by GPT-4o
  - Strengthened composite prompt: explicitly requires ALL reference images to appear, with individual element descriptions
  - Fixed URL reference handling through entire pipeline: Vision refinement, Kie.ai pre-upload, and gpt-image-1 reference download all properly handle `http://`, `attachment://`, `data:`, and raw base64