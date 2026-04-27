# SoulPrint Engine — Internal Cost & Pricing Model Tiers

> **Last updated:** April 27, 2026  
> **Source of truth:** `lib/llm/providers.js` (text models), `components/chat/constants.js` (image/video models), `lib/handlers/pricing.js` (plans)  
> **Pricing gate:** Non-admin users see pricing **after May 1, 2026**. Admins see it now.

---

## 1. Text Chat Models

> **Pricing source**: Official provider API docs, April 2026. All costs per 1M tokens.  
> **Average conversation cost estimate**: ~500 input tokens + ~1,000 output tokens per message exchange.

### Standard Tier (Free plan access)
| Model | Provider | API Model ID | Input $/1M | Output $/1M | Est. $/msg | Context | Notes |
|-------|----------|-------------|-----------|------------|-----------|---------|-------|
| GPT-4o Mini | OpenAI | `gpt-4o-mini` | $0.15 | $0.60 | ~$0.0007 | 128K | Cheapest OpenAI, great value |
| o3 Mini | OpenAI | `o3-mini` | $1.10 | $4.40 | ~$0.005 | 200K | Budget reasoning |
| Claude Haiku 3.5 | Anthropic | `claude-3-5-haiku-20241022` | $1.00 | $5.00 | ~$0.006 | 200K | Fast, affordable |
| Gemini 2.0 Flash | Google | `gemini-2.0-flash` | $0.10 | $0.40 | ~$0.0005 | 1M | Cheapest overall (sunsetting Jun 2026) |
| Sonar (Online) | Perplexity | `sonar` | $1.00 | $1.00 | ~$0.002 | — | Built-in web search (+$5/1K requests) |
| Moonshot 8k (Fast) | Kimi | `moonshot-v1-8k` | $0.55 | $2.20 | ~$0.003 | 8K | Compact context, fast |

**Standard tier cost range: ~$0.0005–$0.006 per message**

### Premium Tier (Base plan: 50 msgs/mo, Power plan: unlimited)
| Model | Provider | API Model ID | Input $/1M | Output $/1M | Est. $/msg | Context | Notes |
|-------|----------|-------------|-----------|------------|-----------|---------|-------|
| GPT-5.2 (Latest) | OpenAI | `gpt-5.2` | $1.75 | $14.00 | ~$0.015 | 200K | Flagship, highest output cost |
| GPT-5 | OpenAI | `gpt-5` | $1.25 | $10.00 | ~$0.011 | 400K | Next-gen flagship |
| o3 (Reasoning) | OpenAI | `o3` | $2.00 | $8.00 | ~$0.009 | 200K | Deep reasoning |
| GPT-4.1 | OpenAI | `gpt-4.1` | $2.00 | $8.00 | ~$0.009 | 1M | Production workhorse, huge context |
| GPT-4o | OpenAI | `gpt-4o` | $2.50 | $10.00 | ~$0.011 | 128K | Multimodal flagship |
| Claude Opus 4.5 | Anthropic | `claude-opus-4-5-20251101` | $5.00 | $25.00 | ~$0.028 | 200K | **Most expensive** — most capable Claude |
| Claude Sonnet 4.5 | Anthropic | `claude-sonnet-4-5-20250929` | $3.00 | $15.00 | ~$0.017 | 200K | Best quality/speed balance |
| Gemini 2.5 Pro | Google | `gemini-2.5-pro` | $1.25 | $10.00 | ~$0.011 | 1M | Google flagship (>200K: $2.50/$15) |
| Sonar Pro (Online) | Perplexity | `sonar-pro` | $3.00 | $15.00 | ~$0.017 | — | Premium web search (+$6-14/1K req) |
| Sonar Reasoning | Perplexity | `sonar-reasoning` | $1.00 | $5.00 | ~$0.006 | — | Reasoning + web (+$6-14/1K req) |
| Kimi K2 (Flagship) | Kimi | `kimi-k2-0711-preview` | $0.55 | $2.20 | ~$0.003 | 131K | Cheapest premium — MoonShot flagship |
| Moonshot 32k | Kimi | `moonshot-v1-32k` | $0.55 | $2.20 | ~$0.003 | 32K | Extended context |

**Premium tier cost range: ~$0.003–$0.028 per message**

### Cost Ranking (cheapest → most expensive per message)
| Rank | Model | Est. $/msg | Tier |
|------|-------|-----------|------|
| 1 | Gemini 2.0 Flash | $0.0005 | Standard |
| 2 | GPT-4o Mini | $0.0007 | Standard |
| 3 | Sonar (Online) | $0.002 | Standard |
| 4 | Moonshot 8k | $0.003 | Standard |
| 5 | Kimi K2 / Moonshot 32k | $0.003 | Premium |
| 6 | o3 Mini | $0.005 | Standard |
| 7 | Claude Haiku 3.5 | $0.006 | Standard |
| 8 | Sonar Reasoning | $0.006 | Premium |
| 9 | o3 (Reasoning) | $0.009 | Premium |
| 10 | GPT-4.1 | $0.009 | Premium |
| 11 | GPT-5 / GPT-4o / Gemini 2.5 Pro | $0.011 | Premium |
| 12 | GPT-5.2 | $0.015 | Premium |
| 13 | Claude Sonnet 4.5 / Sonar Pro | $0.017 | Premium |
| 14 | **Claude Opus 4.5** | **$0.028** | Premium |

### Monthly Cost Projection (per active user)
| Usage Pattern | Standard Only | Mixed (50 premium) | Heavy Premium |
|---------------|--------------|--------------------|--------------| 
| 50 msgs/day | ~$0.75–$9/mo | ~$2–$25/mo | ~$4.5–$42/mo |
| 100 msgs/day | ~$1.50–$18/mo | ~$5–$50/mo | ~$9–$84/mo |
| 200 msgs/day | ~$3–$36/mo | ~$10–$100/mo | ~$18–$168/mo |

> ⚠️ **Margin note**: At Base plan ($20.01/mo) with 50 premium msgs + unlimited standard, our cost per user could range from $2–$25/mo depending on model mix. Claude Opus 4.5 heavy users are the most expensive at ~$0.028/msg.

**Default behavior:** Unknown models default to `premium` tier (safe — prevents unmetered usage of expensive models).

---

## 2. Image Generation Models

All image models are accessed via Kie.ai API. Sorted by internal cost (credits).

| Model | Provider | API Key | Est. Cost/Gen | Tier (Internal) | Plans |
|-------|----------|---------|--------------|-----------------|-------|
| Seedream 5.0 Lite | Kie (ByteDance) | `seedream-5-lite` | ~$0.03 | Budget | Free, Base, Power |
| Nano Banana | Kie (Gemini) | `nano-banana` | ~$0.05 | Standard | Free, Base, Power |
| GPT-4o Image | Kie (OpenAI) | `gpt4o-image` | ~$0.10 | Mid | Free, Base, Power |
| Flux Pro | Kie (BFL) | `flux-pro` | ~$0.13 | Mid | Free, Base, Power |
| Midjourney V7 | Kie (MJ) | `midjourney-v7` | ~$0.20 | Premium | Base, Power |
| GPT Image 1.5 | Kie (OpenAI) | `gpt-image-1-5` | ~$0.25 | Premium | Base, Power |

### Image Limits by Plan
| Plan | Images/Month | Watermark | Rate Limit | Available Models |
|------|-------------|-----------|------------|-----------------|
| **Free** | 20 | Yes | 5/hour | nano-banana, seedream, qwen-image-edit |
| **Base** | 50 | No | Unlimited | + nano-banana-pro, seedream-v4-edit, imagen4-ultra |
| **Power** | Unlimited | No | Unlimited | All models |

---

## 3. Video Generation Models

| Model | Provider | API Key | Est. Cost/sec | Credits/Gen | Plans |
|-------|----------|---------|--------------|-------------|-------|
| Kling 3.0 | Kie.ai | `kling-3.0` | ~$0.10/s | 38 credits | Free (1 lifetime), Base (1/mo), Power (unlimited) |
| Seedance 2.0 Fast | ByteDance via Kie | `seedance-2-0-fast` | ~$0.10/s | 10 credits | Base, Power |
| Seedance 2.0 | ByteDance via Kie | `seedance-2-0` | ~$0.18/s | 10 credits | Base, Power |
| Veo 3.1 | Google | `veo3` | ~$0.18/s | 105 credits | Power only |
| Runway Aleph | Runway | `runway-aleph` | ~$0.20/s | — | Power only |

### Video Limits by Plan
| Plan | Videos | Duration | Resolution | Watermark | Available Models |
|------|--------|----------|------------|-----------|-----------------|
| **Free** | 1 lifetime | 5s | 720p | Yes | Kling 3.0 only |
| **Base** | 1/month | 5s | 720p | Yes | Kling 3.0 |
| **Power** | Unlimited | All | All | No | All models |

### Video Credit Packs (Add-On)
| Pack | Credits | Price | Cost/Credit |
|------|---------|-------|-------------|
| Spark Creator Studio | 30 | $2.99 | $0.10 |
| Creator Pack | 150 | $14.99 | $0.10 |
| Pro Pack | 500 | $49.99 | $0.10 |
| Studio Pack | 1,500 | $149.99 | $0.10 |

---

## 4. Voice Chat

| Feature | Free | Base | Power |
|---------|------|------|-------|
| Voice Chat | No | Yes (30 min/mo) | Yes (unlimited) |
| Engine | — | OpenAI Realtime / Gemini Live | OpenAI Realtime / Gemini Live |

### Voice Add-On (Base plan): $0.40/min beyond 30 min

---

## 5. Plan Summary

| Feature | Free ($0) | Base ($20.01/mo) | Power ($99/mo) |
|---------|-----------|-----------------|----------------|
| **Text Models** | Standard only | Standard + Premium (50 msgs/mo) | All unlimited |
| **Images** | 20/mo, watermark, 5/hr | 50/mo, no watermark | Unlimited |
| **Videos** | 1 lifetime, 720p | 1/mo, 720p | Unlimited, all res |
| **Voice** | No | 30 min/mo | Unlimited |
| **File Analysis** | Basic (10 pages) | Advanced (unlimited) | Advanced (unlimited) |
| **Conversation Search** | No | Yes | Yes |
| **Annual Pricing** | $0 | $192.10/yr (20% off) | $950.40/yr (20% off) |

### Base Plan Add-On Rates
| Feature | Rate |
|---------|------|
| Premium chat messages | $0.15/msg beyond 50 |
| Image generations | $0.20/gen beyond 50 |
| Voice minutes | $0.40/min beyond 30 |
| Advanced file analysis | $0.15/file |

---

## 6. Code References

| Concept | File | Key Function/Constant |
|---------|------|-----------------------|
| Model tier definitions | `lib/llm/providers.js` | `AVAILABLE_MODELS` (tier field) |
| Tier helper functions | `lib/llm/providers.js` | `isModelPremium()`, `getStandardModels()`, `getPremiumModels()` |
| Plan definitions | `lib/handlers/pricing.js` | `DEFAULT_PLANS` |
| Video credit costs | `lib/handlers/pricing.js` | `VIDEO_MODEL_CREDITS` |
| Image/Video model lists | `components/chat/constants.js` | `IMAGE_MODELS`, `VIDEO_MODELS` |
| Access check (Phase 4) | `lib/handlers/access-check.js` | `checkUserAccess()` |
| Feature gate | `lib/feature-gates.js` | `isPricingVisible()` |
| Frontend hook | `hooks/useSubscription.js` | `useSubscription()` |
| UI components | `components/chat/UpgradeBanner.js` | `ChatUpgradeBanner`, `PremiumBadge`, `ModelUpgradeNudge` |

---

## 7. Tier Classification Rules

1. **Standard models** = fast, cheap, suitable for casual users. Available on Free plan.
2. **Premium models** = flagship, expensive, high-quality. Require Base ($20.01/mo) or Power ($99/mo).
3. **Unknown models** default to `premium` tier to prevent unmetered cost leaks.
4. To add a new model: add it to `AVAILABLE_MODELS` in `lib/llm/providers.js` with `tier: 'standard'` or `tier: 'premium'`.
