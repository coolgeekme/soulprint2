# SoulPrint Engine — Internal Cost & Pricing Model Tiers

> **Last updated:** April 27, 2026  
> **Source of truth:** `lib/llm/providers.js` (text models), `components/chat/constants.js` (image/video models), `lib/handlers/pricing.js` (plans)  
> **Pricing gate:** Non-admin users see pricing **after May 1, 2026**. Admins see it now.

---

## 1. Text Chat Models

### Standard Tier (Free plan access)
| Model | Provider | API Model ID | Notes |
|-------|----------|-------------|-------|
| GPT-4o Mini | OpenAI | `gpt-4o-mini` | Fast, cheap general purpose |
| o3 Mini | OpenAI | `o3-mini` | Lightweight reasoning |
| Claude Haiku 3.5 | Anthropic | `claude-3-5-haiku-20241022` | Fast, affordable |
| Gemini 2.0 Flash | Google | `gemini-2.0-flash` | Low latency |
| Sonar (Online) | Perplexity | `sonar` | Built-in web search |
| Moonshot 8k (Fast) | Kimi | `moonshot-v1-8k` | Compact context |

### Premium Tier (Base plan: 50 msgs/mo, Power plan: unlimited)
| Model | Provider | API Model ID | Notes |
|-------|----------|-------------|-------|
| GPT-5.2 (Latest) | OpenAI | `gpt-5.2` | Flagship, coming soon |
| GPT-5 | OpenAI | `gpt-5` | Next-gen, coming soon |
| o3 (Reasoning) | OpenAI | `o3` | Deep reasoning, coming soon |
| GPT-4.1 | OpenAI | `gpt-4.1` | Strong general purpose |
| GPT-4o | OpenAI | `gpt-4o` | Multimodal flagship |
| Claude Opus 4.5 | Anthropic | `claude-opus-4-5-20251101` | Most capable Claude |
| Claude Sonnet 4.5 | Anthropic | `claude-sonnet-4-5-20250929` | Best quality/speed balance |
| Gemini 2.5 Pro | Google | `gemini-2.5-pro` | Google flagship |
| Sonar Pro (Online) | Perplexity | `sonar-pro` | Premium web search |
| Sonar Reasoning | Perplexity | `sonar-reasoning` | Reasoning + web search |
| Kimi K2 (Flagship) | Kimi | `kimi-k2-0711-preview` | MoonShot flagship |
| Moonshot 32k | Kimi | `moonshot-v1-32k` | Extended context |

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
