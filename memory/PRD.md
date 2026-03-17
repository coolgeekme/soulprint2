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
- InsightsTab crash fixes (removed non-existent data references)
- Firebase auth error handling restored

### Session 2 (2026-03-17)
- **Admin Metrics API** (`/api/admin/metrics`) — Added 15+ missing computed fields:
  - `est_projected_monthly_cost`, `est_cost_per_active_user_30d`, `messages_per_active_user_30d`, `avg_cost_per_message_30d`
  - `est_cost_per_user_all_time`, `messages_per_user_all_time`, `avg_cost_per_message`
  - `media_count_total`, `media_count_30d`, `grand_total_cost`, `grand_total_cost_30d`
  - `telegram` object (linked_users, adoption_rate, messages_total, messages_30d, weekly_active_users, conversations)
  - `platform_breakdown` (web/telegram message counts)
  - Enhanced `media_cost_by_model` with model/count/credits/type fields
- **Admin Insights API** (`/api/admin/insights`) — Added 7 new data sections:
  - `revenue_potential` (free tier scenarios + enterprise candidates)
  - `top_users` (top 20 by messages with name, email, cost, media, last_active)
  - `model_popularity` (model distribution with percentages)
  - `feature_adoption` (assessment, onboarding, import, media, memories, telegram, voice)
  - `churn_indicators` (inactive_30d, churn_rate, never_engaged, drop_off_rate)
  - `weekly_trends` (last 4 weeks: messages, active users, new users)
  - `media_insights` (users_using_media, adoption_rate, avg_media_per_user, by_type)

## Prioritized Backlog

### P0 (Critical)
- ~~Fix admin dashboard missing metrics~~ ✅ DONE

### P1 (Important)
- Production DB export (blocked on Atlas firewall - user needs to contact Emergent support)
- Platform DNS/routing misconfiguration causing 520 errors (needs Emergent support)

### P2 (Nice to Have)
- Refactor monolithic `/app/api/[[...path]]/route.js` into smaller modules
- Add `tier_recommendations` and `features_by_segment` to insights API
- Admin dashboard data-testid attributes

## Key Files
- `/app/app/api/admin/[...path]/route.js` — Admin API endpoints
- `/app/app/admin/page.js` — Admin dashboard frontend (5749 lines)
- `/app/lib/mongo.js` — MongoDB connection (lazy loading)
- `/app/api/[[...path]]/route.js` — Main API router
