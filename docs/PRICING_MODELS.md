# SoulPrint Passport — Pricing Models

**With and without the chat feature**
September 21, 2026 · ArcheForce LLC

> Readable version: https://soulprint-pricing-models.vercel.app

---

## The short version

| | Without chat | With chat |
|---|---|---|
| **Margin @ $9/mo** | **95%** | **7%** |
| **Break-even** | 429 msgs/day | **22 msgs/day** |
| **Annual revenue at 2.1% conversion** | ~$454 | — |
| **Competes with** | nobody | ChatGPT, Claude, Gemini |
| **Code surface** | 2,598 lines | 7,475 lines (+288%) |
| **Recommended price** | **$9/mo, $90/yr** | **$12/mo, $120/yr + cap** |

**The entire difference is one number: chat costs 27× more per message than memory.**
Memory extraction runs on `gpt-4o-mini` ($0.0005/msg). Chat defaults to `gpt-4o` with
Sonnet/Opus fallbacks ($0.0134/msg blended).

---

## Why cost decides this

Every price below is judged on **gross margin at four real usage profiles**. A "typical"
engaged user sends 20 messages/day.

| Profile | Msgs/month |
|---|---|
| Light | 150 |
| Typical | 600 |
| Heavy | 1,500 |
| Power | 3,000 |

### Cost per user per month

| Configuration | Light | Typical | Heavy | Power |
|---|---|---|---|---|
| **Without chat** (memory + Q&A) | $0.12 | **$0.44** | $1.07 | $2.12 |
| **With chat, unlimited** | $2.11 | **$8.36** | $20.87 | $41.72 |
| **With chat, capped at 300** | $2.11 | $4.34 | $4.79 | $5.54 |

Read the middle column. **A typical user costs 19× more with chat than without it.**

---

# SCENARIO A — WITHOUT CHAT

**What's included:** memory portability across ChatGPT/Claude/agents via MCP, Imprints,
SoulPrint profile, automatic memory extraction, cloud sync, "ask your SoulPrint"
(memory-scoped Q&A on a mini model), the Chrome extension, and the memory console.

**Model characteristics:** effectively zero marginal cost. No caps needed. No metering.
No abuse surface.

### A1 — $7/mo, $70/yr · *(aggressive)*

| Light | Typical | Heavy | Power |
|---|---|---|---|
| 98.2% | 93.7% | 84.7% | 69.7% |

The lowest credible price. Sits under every comparable in the category (Mem $9, Reflect
$10, Pieces $18.99). Use only if the goal is maximum top-of-funnel.

**Risk:** undercuts the value of the product itself. At this price you signal "small tool,"
not "your AI remembers you everywhere."

### A2 — $9/mo, $90/yr · *(recommended)* ★

| Light | Typical | Heavy | Power |
|---|---|---|---|
| 98.6% | **95.1%** | 88.1% | 76.4% |

- Sits exactly at the modal consumer memory price (Mem is $9/mo)
- Under the $10 psychological line
- Annual discount is **17%** — inside the verified 15–17% industry norm
  (Claude ~15%, Google One 16%)
- 95% margin at typical usage; still 76% for a power user
- Break-even: **429 messages/day** — nobody reaches it

**One clean promise: "Your AI remembers you — everywhere," unlimited.**

### A3 — $12/mo, $120/yr · *(premium)*

| Light | Typical | Heavy | Power |
|---|---|---|---|
| 99.0% | 96.3% | 91.1% | 82.3% |

Defensible, and still 96%+ margin. The argument for it: passkey-free portability across
every AI tool has no competitor, and you're leaving money on the table at $9.

**Risk:** at $12 the product sits in the *assistant* price band ($9.99–$20) while offering
no assistant. Buyers will ask "why not just pay $20 for ChatGPT Plus?" — and there's no
good answer without chat.

### Scenario A summary

| Model | Typical margin | Verdict |
|---|---|---|
| $7 / $70 | 93.7% | Too cheap; devalues the product |
| **$9 / $90** | **95.1%** | **Recommended — clean, defensible, modal** |
| $12 / $120 | 96.3% | Defensible but invites assistant comparisons |

---

# SCENARIO B — WITH CHAT

**What's added:** the general chat interface using `gpt-4o`, Claude Sonnet, Claude Opus,
Gemini 2.5 Pro, and Perplexity Sonar.

**Model characteristics:** real variable cost, metering required, abuse surface, and direct
competition with the major assistants.

### B1 — $9/mo with unlimited chat · *(not viable)*

| Light | Typical | Heavy | Power |
|---|---|---|---|
| 76.6% | **7.1%** | **−131.9%** | **−363.6%** |

Break-even at **22 messages/day**. This is a normal day for someone who likes the product.

**Do not ship this.** A typical user nets you 64 cents. A heavy user costs you $11.87/mo.
This is the single most important number in this document.

### B2 — $12/mo + 300-message cap · *(recommended if chat stays)*

| Light | Typical | Heavy | Power |
|---|---|---|---|
| 82.5% | 63.8% | 60.1% | 53.8% |

- Cost stabilizes at ~$4.79–5.54 regardless of usage — the cap *is* the business model
- 60%+ margin holds from typical through power users
- Adds a visible ceiling users can hit and resent

**Variant — meter the overage** at $0.02/msg: same margin floor, but converts heavy users
into revenue instead of a cutoff. $0.02 is above the $0.0134 cost, so overage is profitable.

### B3 — $19/mo + 1,000-message cap · *(higher-end)*

| Light | Typical | Heavy | Power |
|---|---|---|---|
| 88.9% | 56.0% | 25.4% | 21.5% |

A larger cap raises cost faster than the price covers it. Margin collapses to 21% at power
usage. **A 1,000-message cap needs a higher price than $19 to work.**

### B4 — Tiered: Free / $12 Plus / $19 Pro

| Tier | What it gives | Marginal cost |
|---|---|---|
| **Free** | 10 msgs/day, mini model only | $0.12–0.23/mo |
| **Plus $12** | Unlimited chat on cheap models | $0.12–2.12/mo · **82–99% margin** |
| **Pro $19** | Premium models (Opus/Sonnet) | $0.70–13.55/mo · **29–96% margin** |

The tiering works *because* it separates cheap models from expensive ones. Pro holds 86%
margin at typical usage — but drops to **29% for a power user**, because they gravitate to
Opus. Premium-model access needs its own cap or credit system above what a flat $19 covers.

### B5 — Unbundled: $9 memory + $5 chat add-on

| Add-on cap | Cost | Margin on the add-on |
|---|---|---|
| 150 msgs | $2.01 | 59.8% |
| 300 msgs | $4.02 | **19.6%** |

Combined $14 total holds **96.9% margin at typical usage** — because most users won't buy
the add-on. The add-on itself is thin at 300 messages; **150 is the workable cap at $5.**

### Scenario B summary

| Model | Typical margin | Power margin | Verdict |
|---|---|---|---|
| $9 unlimited | **7.1%** | −363.6% | Never ship |
| **$12 + 300 cap** | 63.8% | 53.8% | **Recommended if chat stays** |
| $19 + 1,000 cap | 56.0% | 21.5% | Cap too generous for the price |
| Tiered Free/$12/$19 | 82–99% | 29% (Pro) | Works; premium needs its own cap |
| $9 + $5 add-on (150) | 96.9% | 84.9% | Viable; add-on margin thin |

---

# SIDE BY SIDE

| | A2 · $9 no chat ★ | B2 · $12 + 300 cap |
|---|---|---|
| Typical margin | **95.1%** | 63.8% |
| Power-user margin | 76.4% | 53.8% |
| Price | $9/mo · $90/yr | $12/mo · $120/yr |
| Annual discount | 17% | 17% |
| Break-even | 429 msgs/day | n/a (capped) |
| Caps / metering | None | 300 msgs/mo |
| Abuse surface | Minimal | Real |
| Code to maintain | 2,598 lines | 7,475 lines |
| Competitive frame | Category of one | vs. ChatGPT/Claude/Gemini |
| Value proposition | "Your AI remembers you — everywhere" | "Another AI assistant, but cheaper" |

### Revenue reality check

At RevenueCat's freemium median of **2.1% conversion**, 200 registered users ≈ **4 paying
subscribers**.

| Price | Monthly revenue | Annual |
|---|---|---|
| $7 | $29.40 | $352.80 |
| $9 | $37.80 | $453.60 |
| $12 | $50.40 | $604.80 |
| $19 | $79.80 | $957.60 |

**At this scale, price is not the bottleneck — conversion is.** Every option above is a
rounding error against the cost of the work required to maintain it. The decision that
matters is which *product* you're selling, not which of these numbers you pick.

---

# RECOMMENDATION

## If chat is cut → **$9/mo, $90/yr (17% off)**

Unlimited memory. No caps. No metering. No ceiling to resent. **95% margin at typical
usage.** One clean promise that no competitor can make.

General chat should be **gated off, not deleted** — keep the module in the repo so it can
relaunch later as a separate, metered product with its own P&L. That is the only structure
in which chat's economics work.

## If chat stays → **$12/mo, $120/yr + 300-message cap**

And you must also:
1. **Route aggressively to cheap models.** Defaulting every query to `gpt-4o` is the reason
   the margin is 7% instead of 25%. `chat-stream.js` already routes "simple/quick/basic" to
   `gpt-4o-mini` — tune that classifier. This cuts cost ~4× with no pricing change.
2. **Meter premium models separately.** Opus and Sonnet cannot be unlimited at any
   consumer price. The original design's "premium message packs" were correct.
3. **Accept the competitive frame.** You are now competing with ChatGPT Plus and Claude Pro,
   at a lower price, with less capability. That is a difficult place to defend.

## The deciding question

Not "which price." It's this:

> **Is SoulPrint the thing that makes ChatGPT and Claude better — or another place to chat?**

If the first, cut chat, charge $9, and own a category of one.
If the second, keep chat, charge $12, cap it, and fight OpenAI.

The numbers support the first. So does the research: free bundled memory is commoditizing
this space from below, and **portability across tools is the only defensible wedge.**

---

## Appendix — assumptions

| Input | Value | Source |
|---|---|---|
| Memory extraction | $0.0005/msg | `gpt-4o-mini`, $0.15/$0.60 per 1M tokens |
| Memory-scoped Q&A | $0.0007/msg | mini + retrieval overhead |
| Chat, blended | $0.0134/msg | 55% gpt-4o, 20% Sonnet, 10% Opus, 10% Gemini Pro, 5% mini |
| Storage | $0.02/user/mo | ~500KB text memories |
| Chat default model | `gpt-4o` | `lib/handlers/chat-stream.js:826` |
| Model routing | keyword triggers | `lib/handlers/chat-stream.js:490-532` |
| Provider rates | Apr 2026 provider docs | `memory/PRICING_MODEL_TIERS.md` |
| Freemium conversion | 2.1% median | RevenueCat *State of Subscription Apps 2026* |
| Annual discount norm | 15–17% | Claude ~15%, Google One 16% (live pages, Sept 2026) |

Margins are gross (revenue − variable cost). They exclude fixed costs: infrastructure,
development, payment processing, support.
