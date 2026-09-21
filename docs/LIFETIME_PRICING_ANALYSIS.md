# Founding Member Pricing — Analysis

**Proposal evaluated:** First 25 at $99 lifetime · Next 25 at $199 lifetime · Everyone else $9/mo or $90/yr

**Verdict: the structure is right, the numbers are wrong, and chat makes it impossible.**

September 21, 2026 · ArcheForce LLC

---

## The proposal, scored

| Test | Result |
|---|---|
| Creates urgency and scarcity | ✔ Pass |
| Generates upfront cash | ✔ Pass — $7,450 |
| Validates willingness to pay early | ✔ Pass |
| Cannibalizes the annual plan | ✘ **Fail** |
| Survives with chat enabled | ✘ **Fail** |
| Bounds long-term liability | ✘ **Fail** |
| Preserves MRR | ✘ **Fail** |

Three of seven. The structure is sound — the numbers need work.

---

## Problem 1 — $99 lifetime destroys the $90 annual plan

| | |
|---|---|
| $99 lifetime = | **11 months** of $9/mo |
| $99 lifetime = | **1.10× the $90 annual price** |
| Difference | **$9 more, for forever** |

Any rational buyer takes lifetime over annual. **The annual plan becomes dead weight** for those 50 people — and annual is where your best-margin, lowest-churn customers come from.

**The industry benchmark for lifetime deals is 3–4× the annual price.** On a $90 annual that is **$270–$360**. Your ladder sits at:

| Tier | Price | Multiple of annual | Benchmark |
|---|---|---|---|
| First 25 | $99 | **1.1×** | 3–4× |
| Next 25 | $199 | **2.2×** | 3–4× |

Both tiers are **below** standard LTD pricing. That may be deliberate — founding members *should* get a real deal. But at 1.1× you're not discounting, you're giving the product away relative to annual.

---

## Problem 2 — with chat, this is catastrophic

How long $99 and $199 actually last, based on real per-message cost:

| Profile | With chat $/mo | $99 lasts | $199 lasts | $349 lasts |
|---|---|---|---|---|
| Light | $2.03 | 48.8 mo | 98.0 mo | 172 mo |
| **Typical** | **$8.06** | **12.3 mo** | **24.7 mo** | 43.3 mo |
| Heavy | $20.12 | 4.9 mo | 9.9 mo | 17.4 mo |
| **Power** | **$40.22** | **2.5 mo** | **4.9 mo** | 8.7 mo |

**A $99 lifetime user at typical usage costs you $96.72/year — every year, forever.** You sell it once for $99 and then pay for them indefinitely. A power user exhausts their $99 in **two and a half months**.

Same table **without chat**:

| Profile | No chat $/mo | $99 lasts | $199 lasts |
|---|---|---|---|
| Light | $0.12 | 792 mo | 1,592 mo |
| **Typical** | **$0.44** | **225 mo (18.8 yr)** | **452 mo (37.7 yr)** |
| Heavy | $1.07 | 92.5 mo | 186 mo |
| Power | $2.12 | 46.7 mo | 93.9 mo |

**Without chat, lifetime pricing is safe.** The cost is so low that any price covers the liability for decades. **This structure only works if chat is cut.**

---

## Problem 3 — 50 lifetime seats is a big fraction of a small base

| Total users | Lifetime seats | % never paying again |
|---|---|---|
| **200** | 50 | **25.0%** |
| 500 | 50 | 10.0% |
| 1,000 | 50 | 5.0% |
| 5,000 | 50 | 1.0% |
| 10,000 | 50 | 0.5% |

Lifetime deals are safest when you're confident of scale. At 200 users — where you are now — **a quarter of your entire customer base would never generate recurring revenue again.**

The counterargument is real: those 50 are your *founding* cohort, your testimonials, your case studies, your feedback loop. That has genuine value. But it should be **paid for out of marketing budget, not priced as revenue.**

### The cash reality

| | |
|---|---|
| Upfront cash | **$7,450** |
| MRR forgone (50 × $9) | $450/mo = $5,400/yr |
| Cash = | **1.38 years** of the recurring revenue it replaces |

You are selling 1.4 years of revenue up front, then paying their costs forever.

---

## Problem 4 — "lifetime" is undefined liability

Before selling a single seat, define it. Unbounded answers to any of these are real risk:

- **Lifetime of what?** The user, or the product?
- **What happens if ArcheForce is acquired or shut down?** Refunds?
- **Is usage capped?** An MCP power user costs $2.12/mo forever, no chat. Five such users erode the cohort.
- **Are premium models included?** Opus and Sonnet at $0.028/msg cannot be part of any lifetime promise.

---

## The fix — corrected ladder

Keep the structure exactly as designed. Raise the numbers to clear the benchmark:

| Tier | Seats | Price | × annual | = months of $9 | Covers (no chat) |
|---|---|---|---|---|---|
| **Founding** | 25 | **$199** | 2.2× | 22.1 | 452 mo — 37.7 yr |
| **Early** | 25 | **$349** | 3.9× | 38.8 | 793 mo — 66.1 yr |
| **Standard** | ∞ | **$9/mo or $90/yr** | — | — | recurring |

**What this fixes:**

- **Cannibalization** — annual is no longer dead. $199 lifetime is 2.2× annual, so the annual plan stays rational.
- **Liability** — 452+ months of coverage at typical usage. Safe by an order of magnitude.
- **Cash** — $13,700 instead of $7,450. **+84%.**
- **MRR replacement** — 2.54 years of forgone recurring revenue instead of 1.38.

**What it costs you:** $199 is a harder sell than $99. Expect a lower conversion rate on the tier — but a *higher-quality* cohort, because people who pay $199 are more committed than people who pay $99.

---

## Two alternatives worth considering

### Option B — Term-limited founding offer

Bounded liability, same psychology, no forever-promise:

| Offer | Effective | Liability |
|---|---|---|
| **$199 for 3 years** | $5.53/mo | Bounded at 3 yr · $4,975 cash |
| **$299 for 5 years** | $4.98/mo | Bounded at 5 yr · $7,475 cash |

Clean, honest, and easy to explain: *"Founding members get three years for the price of one."* When the term ends, they convert to $9/mo — and if the product is good, most will.

### Option C — Rate lock (preserves MRR) ★

> **"Founding member: $90/year, locked forever. Never increases."**

| | |
|---|---|
| Immediate | 25 × $90 = **$2,250/yr recurring** |
| After 2 years | $4,500 recurring |
| After 3 years | **$6,750 recurring** (vs $4,975 one-time) |
| After 5 years | **$11,250 recurring** (vs $4,975 one-time) |

**This beats the lifetime deal by year three and never stops compounding.** It keeps MRR, keeps every user on a live relationship, avoids unbounded liability, and still feels genuinely exclusive — a price that never rises is a real benefit.

Given that recurring revenue is the thing you actually care about, **this is the strongest option on the table.**

---

## Recommendation

| Priority | Choice |
|---|---|
| **Best economics** | **Option C — $90/yr locked forever** |
| Best cash up front | Corrected ladder ($199 / $349) |
| Safest liability | Option B — term-limited |
| What to avoid | $99 lifetime, especially with chat |

### Non-negotiable conditions

1. **Cut chat, or none of this works.** With chat, every lifetime seat is a growing loss. Without it, the liability is negligible.
2. **Define "lifetime" in writing** before selling a seat. Product lifetime, fair-use cap, no premium models, acquisition clause.
3. **Never put premium models (Opus/Sonnet) in a lifetime promise** at any price.
4. **Give your existing paying subscriber a founding seat — free.** He is currently paying far more than anyone else, and a lifetime seat is the cleanest possible resolution of that. It turns a looming fairness problem into your best testimonial.

### One more consideration

At 200 registered users and 2.1% conversion you have ~4 paying customers. **A founding round of 50 seats assumes a pipeline you may not have yet.** If the seats don't fill, the scarcity story dies and the price looks arbitrary.

Consider staging it: **open 10 founding seats first.** If they sell, open 15 more at the higher tier. Scarcity you can actually deliver beats a number you miss.

---

## Appendix — assumptions

| Input | Value | Source |
|---|---|---|
| Memory-scoped Q&A | $0.0007/msg | `gpt-4o-mini` + retrieval |
| Chat, blended | $0.0134/msg | 55% gpt-4o, 20% Sonnet, 10% Opus, 10% Gemini Pro, 5% mini |
| Storage | $0.02/user/mo | ~500KB text memories |
| Typical user | 20 msgs/day = 600/mo | usage profile assumption |
| LTD benchmark | 3–4× annual | industry norm |
| Freemium conversion | 2.1% | RevenueCat, *State of Subscription Apps 2026* |

Margins are **gross** (revenue − variable cost); fixed costs excluded.
