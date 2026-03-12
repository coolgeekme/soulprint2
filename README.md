# SoulPrint Engine

> **Your Identity. Every AI.** — A multi-model AI platform with persistent identity layer.

[![Next.js](https://img.shields.io/badge/Next.js-14.2.3-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green)](https://mongodb.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## 🎯 What is SoulPrint Engine?

SoulPrint Engine is a **multi-model AI platform** that provides a persistent identity layer across all AI interactions. Unlike traditional AI tools that reset every session, SoulPrint remembers how you think, communicate, and make decisions — permanently.

### Key Differentiators
- **Persistent Identity Layer** (Patent Pending) — Your preferences persist across ALL AI models
- **Dynamic Intelligence™** (Patent Pending) — Auto-selects the best model for each task
- **15+ AI Models** — Access GPT, Claude, Gemini, and more in one conversation
- **Compare 3 Responses** — Get answers from multiple models and choose the best
- **Multi-Account Google Integration** — Gmail, Calendar, Docs, Sheets, Drive (Coming Soon)
- **Telegram Bot** — Access your AI anywhere via @SoulPrintAIBot

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2.3 | React framework (App Router) |
| React | 18.x | UI library |
| Tailwind CSS | 3.4.1 | Utility-first CSS |
| shadcn/ui | Latest | Component library |
| Lucide React | Latest | Icon library |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API Routes | 14.2.3 | RESTful API |
| MongoDB | 6.x | Document database |
| JWT | - | Authentication |

### AI/LLM Providers
| Provider | Models Available |
|----------|------------------|
| **OpenAI** | GPT-5.2, GPT-5, GPT-4.1, GPT-4o, o3, o3-mini |
| **Anthropic** | Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 3.5 |
| **Google** | Gemini 2.5 Pro, Gemini 2.0 Flash |
| **Perplexity** | Sonar Pro, Sonar, Sonar Reasoning |
| **Kimi/Moonshot** | Kimi K2, Moonshot 32k, Moonshot 8k |

### Image Generation
| Provider | Models/Capabilities |
|----------|---------------------|
| **OpenAI** | DALL-E 3, gpt-image-1 |
| **Kie.ai** | Qwen Image Edit, Nano Banana, Seedream 5 |

### Video Generation
| Provider | Models |
|----------|--------|
| **Kie.ai** | Kling 3.0, Hailuo, Wan |
| **OpenAI** | Sora 2 (Coming Soon) |

### Third-Party Integrations
| Service | Purpose | Status |
|---------|---------|--------|
| Google APIs | Gmail, Calendar, Docs, Sheets, Drive | 🔜 Coming Soon |
| Telegram Bot API | Mobile AI access | ✅ Active |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Kubernetes | Container orchestration |
| Supervisor | Process management |
| Node.js 20.x | JavaScript runtime |

---

## 📁 Project Structure

```
/app
├── app/                      # Next.js App Router
│   ├── (chat)/              # Chat interface (protected)
│   │   ├── page.js          # Main chat page
│   │   └── components/      # Chat components
│   ├── api/                 # API routes
│   │   └── [[...path]]/     # Catch-all API handler
│   │       └── route.js     # Monolithic API (20k+ lines)
│   ├── admin/               # Admin dashboard
│   ├── auth/                # Authentication pages
│   ├── features/            # Features page
│   ├── integrations/        # Google integrations page
│   └── page.js              # Landing page
├── components/              # Shared components
│   └── ui/                  # shadcn/ui components
├── lib/                     # Utilities
│   └── llm/                 # LLM provider abstraction
│       └── providers.js     # Multi-model support
├── docs/                    # Documentation
│   └── MARKETING_COPY.md    # Marketing materials
└── .env                     # Environment variables
```

---

## 🔑 Environment Variables

```env
# Database
MONGO_URL=mongodb://localhost:27017

# Application
NEXT_PUBLIC_BASE_URL=https://soulprintengine.ai

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google (Gemini)
GOOGLE_API_KEY=...

# Perplexity
PERPLEXITY_API_KEY=pplx-...

# Kie.ai (Image/Video)
KIE_API_KEY=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Telegram Bot
TELEGRAM_BOT_TOKEN=...

# JWT
JWT_SECRET=...
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20.x
- MongoDB 6.x
- Yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/soulprint-engine.git
cd soulprint-engine

# Install dependencies
yarn install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
yarn dev
```

### Production Build

```bash
yarn build
yarn start
```

---

## 📚 API Overview

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new account |
| `/api/auth/login` | POST | Login with email/password |
| `/api/auth/me` | GET | Get current user |

### Chat
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/stream` | POST | Stream chat response |
| `/api/chat/sessions` | GET | List chat sessions |
| `/api/chat/sessions/:id` | GET | Get session messages |

### Image Generation
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/image/generate` | POST | Generate image from prompt |
| `/api/image/edit` | POST | Edit existing image |
| `/api/image-to-json` | POST | Generate prompt from image |

### Video Generation
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/video/generate` | POST | Generate video from prompt |
| `/api/video/status/:taskId` | GET | Check generation status |

### Google Integration
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/google/start` | GET | Initiate OAuth flow |
| `/api/gmail/list` | GET | List emails |
| `/api/calendar/list` | GET | List calendar events |
| `/api/calendar/create` | POST | Create calendar event |

---

## 🔐 Authentication Flow

1. User registers with email/password
2. Verification code sent to email
3. User verifies and receives JWT token
4. Token included in `Authorization: Bearer <token>` header
5. Protected routes validate token via `authenticate()` middleware

---

## 🤖 Multi-Model Architecture

SoulPrint uses a provider abstraction layer (`/lib/llm/providers.js`) to support multiple AI models:

```javascript
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';

// Get provider for specific model
const provider = getProvider('gpt-5.2');
const response = await provider.chat(messages, options);
```

### Dynamic Intelligence™
The system can automatically route requests to the optimal model:
- **Code tasks** → GPT-5.2
- **Creative writing** → Claude Opus
- **Math/reasoning** → Gemini Pro
- **Real-time search** → Perplexity Sonar

---

## 📱 Telegram Bot

Access SoulPrint via Telegram: **@SoulPrintAIBot**

### Commands
- `/start` — Connect your SoulPrint account
- `/image [prompt]` — Generate an image
- `/video [prompt]` — Generate a video
- Regular messages — Chat with your AI

---

## 🎨 Design System

### Colors (Tailwind)
```css
--sp-black: #0D0D0D
--sp-orange: #F64000
--theme-text-primary: #1A1A1A
--theme-text-secondary: #4B5057
```

### Typography
- **Font**: Inter (300-700 weights)
- **Headings**: Font Condensed, uppercase, tracking-widest

### Components
All UI components use shadcn/ui imported from `@/components/ui/`:
- Button, Card, Input, Dialog, Tabs, etc.

---

## 📄 License

Proprietary — All rights reserved © 2025 SoulPrint Engine

---

## 🔗 Links

- **Production**: https://soulprintengine.ai
- **Features**: https://soulprintengine.ai/features
- **Telegram**: https://t.me/SoulPrintAIBot
