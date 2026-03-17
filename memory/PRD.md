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

## Key Files
- `/app/app/api/admin/[...path]/route.js` — Admin API (metrics, insights, conversations)
- `/app/app/admin/page.js` — Admin dashboard frontend
- `/app/app/chat/page.js` — Chat page with Telegram disconnect
- `/app/lib/mongo.js` — MongoDB connection (lazy loading)
- `/app/api/[[...path]]/route.js` — Main API router
