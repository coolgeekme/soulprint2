# SoulPrint Knowledge Base
## Internal Documentation for Support Bot

*Last Updated: March 2025*

---

## Table of Contents
1. [Application Overview](#application-overview)
2. [User-Facing Features](#user-facing-features)
3. [Admin Features](#admin-features)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Database Schema](#database-schema)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Integration Points](#integration-points)
8. [File Structure](#file-structure)

---

## Application Overview

**SoulPrint** is an AI-powered personal companion app that creates a deep psychological profile of users through assessments, conversations, and data imports. It provides personalized AI interactions across multiple LLM providers.

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (monolithic at `/app/api/[[...path]]/route.js`)
- **Database**: MongoDB
- **Authentication**: Firebase Auth + Custom JWT
- **AI Providers**: OpenAI, Anthropic Claude, Google Gemini, Perplexity, Kimi
- **Media Generation**: Kie.ai (images/videos)
- **Email**: Resend
- **Bot Integration**: Telegram

### Key URLs
- **Production**: https://voice-analytics-hub-1.preview.emergentagent.com
- **API Base**: `/api/*`
- **Admin Dashboard**: `/admin`

---

## User-Facing Features

### 1. Authentication & Onboarding
**Files**: `/app/auth/page.js`, `/app/onboarding/page.js`

| Feature | Description | Common Issues |
|---------|-------------|---------------|
| Email/Password Login | Users login with email and 6-digit passcode | "Invalid passcode" - check if user exists |
| Firebase Auth (Google) | OAuth via Firebase | Token refresh issues - check Firebase config |
| Beta Code System | Users need valid beta code to register | Code already used, expired, or invalid |
| Email Verification | Optional email verification via Resend | Email not sending - check RESEND_API_KEY |
| Waitlist | Users without beta code join waitlist | N/A |

**API Endpoints**:
- `POST /api/auth/login` - Login with email/passcode
- `POST /api/auth/register` - Register new user
- `POST /api/auth/firebase` - Firebase OAuth login
- `GET /api/auth/me` - Get current user
- `POST /api/beta-code/validate` - Validate beta code

### 2. Assessment System
**Files**: `/app/assessment/*`

Three-tiered assessment to build user's psychological profile:

| Tier | Name | Questions | Purpose |
|------|------|-----------|---------|
| Quick Start | 12 questions | Basic personality snapshot | Fast onboarding |
| Full Assessment | 36 questions | Comprehensive profile | Deep understanding |
| Gradual Assessment | Ongoing | Presented during chats | Continuous refinement |

**API Endpoints**:
- `GET /api/assessment/questions` - Get assessment questions
- `POST /api/assessment/submit` - Submit answer
- `GET /api/assessment/progress` - Get completion progress
- `POST /api/assessment/complete` - Mark assessment complete
- `GET /api/gradual/question` - Get next gradual question
- `POST /api/gradual/answer` - Submit gradual answer

**Common Issues**:
- "Progress showing 0%" - Check `assessment_answers` AND `gradual_assessment_progress` collections
- Questions not loading - Verify `assessment_questions` collection has data

### 3. Chat / Conversations
**Files**: `/app/chat/page.js`, `/components/mobile/MobileChat.js`

| Feature | Description |
|---------|-------------|
| Multi-model support | GPT-4o, Claude Sonnet, Gemini, Perplexity, Kimi |
| Model comparison | Compare responses from 2 models side-by-side |
| Streaming responses | Real-time token streaming |
| Context-aware | Uses SoulPrint profile for personalized responses |
| Voice input | Speech-to-text via Whisper API |
| File attachments | Upload images/documents for context |

**API Endpoints**:
- `GET /api/conversations` - List user's conversations
- `POST /api/conversations` - Create new conversation
- `PUT /api/conversations/:id` - Rename conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `GET /api/messages?conversationId=X` - Get messages in conversation
- `POST /api/chat/stream` - Send message (streaming)
- `POST /api/chat/compare` - Compare models
- `POST /api/transcribe` - Voice transcription

**Common Issues**:
- "Messages not loading" - Check `conversationId` parameter
- "AI not responding" - Check API keys for selected model (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
- "Voice not working" - Check browser permissions + Whisper API key
- "Streaming broken" - Check if response headers allow streaming

### 4. Projects & Collaboration (NEW)
**Files**: `/app/chat/page.js`, `/components/mobile/MobileChat.js`

| Feature | Description |
|---------|-------------|
| Create projects | Organize conversations into folders |
| Move conversations | Assign chats to projects |
| Share projects | Invite others by email or share link |
| Collaboration | Shared users can view/contribute |

**API Endpoints**:
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/share` - Share with user by email
- `POST /api/projects/:id/share-link` - Generate share link
- `POST /api/projects/join` - Join via share code
- `PUT /api/conversations/:id/project` - Move conversation to project

### 5. Media Generation
**Files**: `/app/chat/page.js`

| Feature | Provider | Description |
|---------|----------|-------------|
| Image generation | Kie.ai | Generate images from prompts |
| Video generation | Kie.ai | Generate videos from prompts |
| Gallery | N/A | View/download generated media |

**API Endpoints**:
- `POST /api/media/generate` - Generate image/video
- `GET /api/media/status/:taskId` - Check generation status
- `GET /api/media/gallery` - Get user's media
- `DELETE /api/media/:id` - Delete media

**Common Issues**:
- "Generation stuck" - Check KIE_API_KEY
- "Video not completing" - Kie.ai has processing queue, may take time

### 6. Data Import
**Files**: `/app/chat/page.js`

Users can import data from:
- ChatGPT exports (JSON)
- WhatsApp exports
- iMessage exports
- Social media exports
- Direct file uploads

**API Endpoints**:
- `POST /api/import/upload` - Upload file
- `POST /api/import/chunked/init` - Start chunked upload
- `POST /api/import/chunked/chunk` - Upload chunk
- `POST /api/import/chunked/complete` - Complete upload
- `GET /api/import/status` - Get import status

**Common Issues**:
- "Upload failing" - Check file size limits, use chunked upload for large files
- "Import not processing" - Check `import_jobs` collection for errors

### 7. SoulPrint Profile
**Files**: `/app/chat/page.js` (Profile tab)

| Feature | Description |
|---------|-------------|
| View SoulPrint | Visual representation of personality |
| Communication style | How user prefers to communicate |
| Export profile | Download as JSON/PDF |
| Regenerate | Rebuild profile from all data |

**API Endpoints**:
- `GET /api/soulprint` - Get user's SoulPrint
- `POST /api/soulprint/generate` - Regenerate SoulPrint
- `GET /api/profile/export` - Export profile data

### 8. Telegram Integration
**Files**: `/app/api/[[...path]]/route.js`

| Feature | Description |
|---------|-------------|
| Link account | Connect Telegram to SoulPrint |
| Chat via Telegram | Message AI through Telegram bot |
| Model selection | Choose AI model for Telegram |

**API Endpoints**:
- `POST /api/telegram/link` - Generate link code
- `POST /api/telegram/webhook` - Receive Telegram messages
- `GET /api/telegram/status` - Check connection status
- `POST /api/telegram/model` - Set preferred model

### 9. Viral Invite System
**Files**: `/components/mobile/MobileChat.js`, `/app/invite/[code]/page.js`

| Feature | Description |
|---------|-------------|
| Generate invites | Beta users get 5 invite codes |
| Track usage | See who used your codes |
| Share links | Copy invite link to share |

**API Endpoints**:
- `POST /api/admin/invites/generate` - Generate user's invites
- `GET /api/invites/my` - Get user's invite codes
- `GET /api/invites/validate/:code` - Validate invite code

---

## Admin Features

**File**: `/app/admin/page.js`

### Admin Tabs

| Tab | Features |
|-----|----------|
| **Users** | View all users, search, filter by beta status, edit roles, reset passcodes, export user list |
| **Metrics** | User counts, active users, message counts, model usage, growth charts |
| **Beta Codes** | Create/manage beta codes, view redemptions, send codes via email |
| **Feedback** | View user feedback, AI-summarize feedback, mark as reviewed |
| **Insights** | Business metrics, pricing recommendations, cost analysis, margin calculator |
| **Settings** | Toggle viral invites, system-wide settings |

### Admin API Endpoints
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/users/export` - Export user list
- `GET /api/admin/metrics` - Get metrics
- `GET /api/admin/feedback` - Get feedback
- `POST /api/admin/feedback/summarize` - AI summarize feedback
- `GET /api/admin/beta-codes` - List beta codes
- `POST /api/admin/beta-codes` - Create beta codes
- `GET /api/admin/insights/business` - Business insights
- `GET /api/admin/settings` - Get settings
- `POST /api/admin/settings` - Update settings

---

## API Endpoints Reference

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login | No |
| POST | `/api/auth/firebase` | Firebase OAuth | No |
| GET | `/api/auth/me` | Get current user | Yes |
| PUT | `/api/profile` | Update profile | Yes |

### Conversations
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/conversations` | List conversations | Yes |
| POST | `/api/conversations` | Create conversation | Yes |
| PUT | `/api/conversations/:id` | Rename | Yes |
| DELETE | `/api/conversations/:id` | Delete | Yes |
| GET | `/api/messages` | Get messages | Yes |
| POST | `/api/chat/stream` | Send message | Yes |
| POST | `/api/chat/compare` | Compare models | Yes |

### Projects
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/projects` | List projects | Yes |
| POST | `/api/projects` | Create project | Yes |
| PUT | `/api/projects/:id` | Update | Yes |
| DELETE | `/api/projects/:id` | Delete | Yes |
| POST | `/api/projects/:id/share` | Share by email | Yes |
| POST | `/api/projects/:id/share-link` | Generate link | Yes |
| POST | `/api/projects/join` | Join via code | Yes |

### Assessment
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/assessment/questions` | Get questions | Yes |
| POST | `/api/assessment/submit` | Submit answer | Yes |
| GET | `/api/assessment/progress` | Get progress | Yes |
| POST | `/api/assessment/complete` | Complete | Yes |

### Media
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/media/generate` | Generate media | Yes |
| GET | `/api/media/status/:taskId` | Check status | Yes |
| GET | `/api/media/gallery` | Get gallery | Yes |
| DELETE | `/api/media/:id` | Delete | Yes |

---

## Database Schema

### Core Collections

#### `users`
```javascript
{
  id: "uuid",
  email: "user@example.com",
  passcode: "hashed",
  display_name: "John",
  role: "user" | "admin" | "superadmin",
  is_beta_user: true,
  beta_code_used: "CODE123",
  onboarding_complete: true,
  assessment_complete: true,
  discovery_source: "friend" | "social" | "search",
  created_at: Date,
  last_login: Date
}
```

#### `conversations`
```javascript
{
  id: "uuid",
  user_id: "uuid",
  title: "Chat about...",
  project_id: "uuid" | null,
  source: "web" | "telegram",
  created_at: Date,
  updated_at: Date
}
```

#### `messages`
```javascript
{
  id: "uuid",
  conversation_id: "uuid",
  user_id: "uuid",
  role: "user" | "assistant",
  content: "Message text",
  model: "gpt-4o",
  created_at: Date
}
```

#### `projects`
```javascript
{
  id: "uuid",
  name: "Project Name",
  description: "Description",
  owner_id: "uuid",
  shared_with: [{ user_id: "uuid", role: "viewer" | "collaborator" }],
  share_link: { code: "abc123", enabled: true, role: "viewer" },
  created_at: Date
}
```

#### `profiles`
```javascript
{
  user_id: "uuid",
  display_name: "John",
  bio: "About me...",
  avatar_url: "https://...",
  preferences: {},
  created_at: Date
}
```

#### `soul_profiles`
```javascript
{
  user_id: "uuid",
  personality_traits: [...],
  communication_style: {...},
  interests: [...],
  values: [...],
  generated_at: Date
}
```

#### `assessment_answers`
```javascript
{
  user_id: "uuid",
  question_id: "uuid",
  answer: "Selected option or text",
  answered_at: Date
}
```

---

## Common Issues & Solutions

### 1. Authentication Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid passcode" | Wrong passcode or user doesn't exist | Check email spelling, verify user in DB |
| "Token expired" | JWT expired (30 days) | User needs to re-login |
| "Firebase auth failed" | Invalid Firebase token | Check Firebase config, token freshness |
| "Beta code invalid" | Code doesn't exist or already used | Check `beta_codes_v2` collection |

### 2. Chat Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "AI not responding" | Missing API key for model | Check env: OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. |
| "Streaming not working" | Response headers blocked | Check next.config.js headers |
| "Messages not loading" | Invalid conversation ID | Verify conversation exists in DB |
| "Model comparison fails" | One model's API key missing | Check both models have valid keys |

### 3. Media Generation Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Image generation stuck" | Kie.ai API issue | Check KIE_API_KEY, verify quota |
| "Video not completing" | Long processing time | Videos take 2-5 minutes, check status endpoint |
| "Gallery empty" | Media not linked to user | Check `media_gallery` collection |

### 4. Import Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Upload failing" | File too large | Use chunked upload for files >5MB |
| "Import not processing" | Job stuck | Check `import_jobs` for error status |
| "Data not appearing" | Wrong format | Verify file format matches expected schema |

### 5. Assessment Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Progress shows 0%" | Answers in wrong collection | Check both `assessment_answers` AND `gradual_assessment_progress` |
| "Questions not loading" | Empty questions collection | Seed `assessment_questions` |
| "Can't complete assessment" | Missing required answers | Check minimum answer count |

### 6. Project Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Can't create project" | Missing auth token | Re-login, check token in headers |
| "Share link not working" | Link disabled or expired | Regenerate share link |
| "Can't see shared project" | User not in shared_with | Check project's shared_with array |

### 7. Mobile/UI Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Input hidden on Android" | Keyboard covering input | Already fixed - ensure safe-area-bottom class |
| "Sidebar not showing projects" | State not loading | Refresh page, check /api/projects response |
| "Dropdown text invisible" | CSS issue with select | Fixed - bg-[#1a1a1a] on select elements |

---

## Integration Points

### Environment Variables Required

```bash
# Database
MONGO_URL=mongodb://...

# Authentication
JWT_SECRET=your-secret
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
PERPLEXITY_API_KEY=pplx-...
KIMI_API_KEY=...

# Media Generation
KIE_API_KEY=...

# Email
RESEND_API_KEY=re_...

# Telegram
TELEGRAM_BOT_TOKEN=...

# Other
RECAPTCHA_SECRET_KEY=...
NEXT_PUBLIC_BASE_URL=https://...
```

### Third-Party Services

| Service | Purpose | Dashboard |
|---------|---------|-----------|
| MongoDB | Database | MongoDB Atlas |
| Firebase | OAuth | Firebase Console |
| OpenAI | GPT models | platform.openai.com |
| Anthropic | Claude models | console.anthropic.com |
| Google AI | Gemini models | makersuite.google.com |
| Perplexity | Search-enhanced AI | perplexity.ai |
| Kie.ai | Media generation | kie.ai |
| Resend | Email delivery | resend.com |
| Telegram | Bot integration | t.me/BotFather |

---

## File Structure

```
/app
├── app/
│   ├── admin/page.js          # Admin dashboard (7000+ lines)
│   ├── api/[[...path]]/route.js  # All API routes (15000+ lines)
│   ├── assessment/            # Assessment pages
│   ├── auth/page.js           # Login/register
│   ├── blog/                  # Blog pages
│   ├── chat/page.js           # Desktop chat (7000+ lines)
│   ├── contact/page.js        # Contact form
│   ├── feedback/page.js       # Feedback form
│   ├── invite/[code]/page.js  # Invite landing
│   ├── onboarding/page.js     # New user onboarding
│   ├── privacy/page.js        # Privacy policy
│   ├── terms/page.js          # Terms of service
│   ├── layout.js              # Root layout
│   └── page.js                # Landing page
├── components/
│   └── mobile/
│       └── MobileChat.js      # Mobile chat UI (4000+ lines)
├── public/                    # Static assets
├── .env                       # Environment variables
└── package.json               # Dependencies
```

---

## Escalation Criteria

### Auto-Fixable Issues (Bot Can Suggest Code Fix)
- CSS/styling issues
- Missing null checks
- API response format issues
- Database query fixes
- Environment variable issues (if known)

### Requires Human Review
- New feature requests
- Security-related issues
- Database schema changes
- Third-party API changes
- Performance optimization
- Architecture decisions

### Immediate Escalation
- Data loss/corruption
- Security vulnerabilities
- Payment/billing issues
- User account issues
- Production outages

---

## Contact & Escalation

- **Primary Contact**: [Your Name]
- **Escalation Channel**: Slack DM or #soulprint-alerts
- **Emergency**: Direct message to owner

---

*This document is the source of truth for the SoulPrint Support Bot. Update this document when features change.*
