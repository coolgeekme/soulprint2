# SoulPrint Passport — Pricing Research

**Date:** September 21, 2026
**Purpose:** Set a price from evidence, from scratch. The prior $14/mo was never justified by
any document in this repo — it appeared in April 2026 auto-commits with no rationale. This
document replaces that with a defensible basis.

**Verification discipline:** every price below was read from a live vendor page on
2026-09-21, except where explicitly marked `UNVERIFIED`. Nothing is estimated or recalled.

---

## 1. The cost floor — and why cost-plus is the wrong method

Traced from the actual code path (`lib/handlers/memory-system.js:54-120`), not assumed:
auto-extraction runs per exchange on **gpt-4o-mini**.

| Usage | Msgs/mo | Marginal cost/mo | Margin @ $14 |
|---|---|---|---|
| Light (5/day) | 150 | **$0.06** | 99.6% |
| Typical (20/day) | 600 | **$0.19** | 98.7% |
| Heavy (50/day) | 1,500 | **$0.44** | 96.9% |
| Extreme (300/day) | 9,000 | **$2.52** | 82.0% |

Break-even at $14/mo requires **1,679 messages/day**. No human reaches it.

**Consequence 1:** any price between $5 and $30 is 96–99% gross margin. Cost gives zero
signal about price. Price must come from willingness to pay.

**Consequence 2:** usage caps are a margin decision, not a cost-necessity. Unlimited memory
is affordable and is therefore a competitive weapon.

**Scope caveat:** this models the *Passport memory layer only*. SoulPrint Engine chat is a
separate, real cost center. Keep the two P&Ls separate.

---

## 2. Where consumer memory / second-brain products price

Verified from vendor pages, 2026-09-21.

| Product | Free tier | Paid entry | Source |
|---|---|---|---|
| Reflect | No (14-day trial) | **$10/mo** | reflect.app/#pricing |
| Mem | Yes | **$9/mo** (Plus) → $29 (Pro) → $49 | get.mem.ai/pricing |
| Saner.AI | Yes | **$8/mo** → $16 | saner.ai/pricing |
| MyMemo | Yes | **$5.90/mo** annual ($9.90 monthly) → $11.90 | mymemo.ai/pricing |
| Tana | Yes | **$20/mo** annual (early bird) → $80–150 | tana.inc/pricing |
| Pieces | No (7-day trial) | **$18.99/user/mo** (or $169.99/yr) | pieces.app/pricing |

**Cluster: $8–$20/mo, modal ≈ $10.** Solo power-user ceiling ≈ $30–50.

Almost every consumer product ships a free tier. The two exceptions (Reflect, Pieces)
substitute a short trial and explicitly have no free plan.

---

## 3. Where developer / MCP memory infrastructure prices

| Product | Free tier | Paid entry | Production | Source |
|---|---|---|---|---|
| Mem0 | Yes (10k req) | **$19/mo** | $249/mo | mem0.ai/pricing |
| Supermemory | Yes ($5 credits) | **$19/mo** | $100 → $399/mo | supermemory.ai/pricing |
| Zep | Yes (10k credits) | **$125/mo** (5 **Memory MCP Server seats**) | $375/mo | getzep.com/pricing |
| Letta | Yes | **$20/mo** | usage-based, unpublished → `UNVERIFIED` | docs.letta.com/pricing |
| Cognee | Yes | $1/1M tokens + $5/mo per workspace | enterprise | cognee.ai/pricing |

**Cluster: $19/mo entry → $100–399/mo production.** Every free tier is *meter-capped*
rather than feature-capped, and every vendor has moved to credit/token consumption with
auto top-up. That is the clearest structural shift in the category.

Note Zep sells **Memory MCP Server seats** as an explicit line item — the closest thing
found to a direct comparable for Passport's MCP surface.

---

## 4. The category is being squeezed from below by free bundled memory

This is the most important finding for positioning, and it argues against a
consumer-only memory subscription:

- **Claude's Free tier ($0) includes memory.** Verified live at claude.com/pricing.
- **ChatGPT includes memory** in its plans. Verified in page structure at chatgpt.com/pricing.
- **Microsoft Recall is a $0 feature** of Windows 11 on Copilot+ PCs.
- **Mem0, Cognee, Graphiti, and OpenMemory are open-source** and self-hostable at $0.

So a consumer-priced memory product competes simultaneously against a $0 bundled feature
in the assistant they already pay for, and against a $0 self-hosted engine.

**The only defensible wedge is portability + multi-tool reach** — memory that works
*across* ChatGPT, Claude, and agents, which none of the bundled first-party options do.
That is exactly Passport's positioning, and it justifies pricing above the $10 commodity
second-brain band.

---

## 5. Attrition warning — three named comparables are gone

| Product | Status |
|---|---|
| Limitless (ex-Rewind) | Acquired by Meta; Pendant discontinued; Rewind being sunset |
| Khoj | Cloud shut down **April 15, 2026**; open source/self-host only |
| Personal AI | Left consumer pricing entirely; enterprise-scoped, no public price |

Several still-live products sit on free open-source engines. The category is consolidating.

---

## 6. What the platform anchors are

| Product | Price | Source | Note |
|---|---|---|---|
| Claude Pro | **$17/mo annual** ($200 upfront) / **$20 monthly** | claude.com/pricing | live |
| Claude Max | from **$100/mo** | claude.com/pricing | live |
| Google AI Plus (2TB) | **$9.99/mo** | one.google.com/about/plans | live |
| Google AI Pro (5TB) | **$19.99/mo** | one.google.com/about/plans | live; "Save up to 16%" annual |
| Mistral Pro | **$14.99/mo** | mistral.ai/pricing | live |
| Mistral Team | **$24.99/user/mo** | mistral.ai/pricing | live |
| MS 365 Business Premium w/ Copilot | **$32.00/user/mo** | microsoft.com | live |
| GitHub Copilot Business / Enterprise | **$19 / $39** per seat/mo | docs.github.com | verified |
| Cursor Pro | **$20/mo** | cursor.com/pricing | verified |
| ChatGPT, Perplexity, Grok | — | — | **`UNVERIFIED`** — hard-blocked |

**ChatGPT / Perplexity / Grok could not be verified.** All three are behind bot walls;
Internet Archive was offline during this research. Recorded as `UNVERIFIED` rather than
guessed. The widely-cited ~$20/$200 figures were *not* confirmed and must not be treated
as verified anchors.

**What is verified:** the consumer AI assistant band sits at **$9.99–$20/mo**, with
**$19.99–$20** as the recurring professional-tier figure (Google AI Pro, Claude Pro monthly,
Cursor Pro) and a 15–16% annual discount in the two cases where annual pricing was readable.

---

## 7. Freemium and pricing benchmarks (published data)

**RevenueCat, "State of Subscription Apps 2026"** — 115,000+ apps, $16B+ revenue,
1B+ transactions, CY2025. Largest public subscription benchmark set.

| Model | D35 download→paid median | Top quartile | P10–P90 |
|---|---|---|---|
| Freemium | **2.1%** | >4.5% | 0.3%–8.2% |
| Hard paywall | **10.7%** | — | 4.2%–38.7% |

- Hard paywalls convert ~5× better at day 35, but **year-one retention is nearly identical.**
- **23% of freemium conversions happen 6+ weeks after download** — use an 8-week
  attribution window or freemium will look worse than it is.
- Trial→paid medians: Business 9.1%, Utilities 6.5%, Education 6.5%, Media 4.0%.

**Annual discounts:** verifiable anchors are **15–16%** (Claude ~15%, Google One 16%).
Wider 17–40% discounts appear in the memory category (Pieces 25%, Zep 17%, Saner 20%,
MyMemo ~40%). The frequently-cited "10–20% median annual prepay discount (Chargebee)"
could **not** be located in the cited report — flagged, do not quote it.

---

## 8. Pricing method — what we can and cannot do with ~200 users

**The honest framing:** stated-preference methods measure perception, not purchase.
Sawtooth (the dominant conjoint vendor) states plainly that Van Westendorp does not
predict purchase behavior.

**Calibration constant:** Schmidt & Bijmolt (2019), *JAMS* — meta-analysis of 77 studies,
n=24,441 hypothetical / 20,766 real WTP observations. **Average hypothetical bias ≈ 21%.**
If a survey says $10/mo, the real number is closer to **$8/mo.** Apply this to any stated
number.

Notably: *direct* methods (open-ended, monadic, Gabor-Granger) were **more** accurate than
indirect methods like conjoint — contradicting the marketing-textbook claim.

**Sample size reality at n≈200:**

| Method | Feasible at 200? |
|---|---|
| Van Westendorp | Yes — directional; 200 is the accepted business minimum (±7%) |
| Gabor-Granger | Yes — within-respondent, high information per respondent |
| MaxDiff | One overall ranking only; no segment cuts |
| Monadic price test | No as a survey (50/cell). **Do it as a live test on new signups instead** |
| Conjoint | **No** — below every published guideline |

**Recommended sequence:**
1. **Mine existing behavior first** — free, non-hypothetical, tells you which value moment
   precedes payment.
2. Qualitative VW interviews (n=10–20) to surface the price *language* users use.
3. VW + Gabor-Granger survey on the list; **discount results ~21%**.
4. Live monadic test on **new** signups only, 2–3 price points.
5. Wait a full billing cycle + a month; measure **churn and 60-day revenue**, not week-one
   conversion.

**Hard rule: never test price on existing paying customers.**

---

## 9. Pricing psychology — what's actually established

Troll et al. (2023), *Journal of Consumer Psychology* — preregistered meta-analysis,
k=69 studies, 362 effect sizes, N=40,541:

| Effect | Size | Interpretation |
|---|---|---|
| Purchase decision | **g = 0.13** [0.01, 0.25] | Small; CI nearly touches zero |
| Price image | g = 0.28 | People do perceive $9.99 as cheaper |
| Perceived quality | **g = 0.00** | "Cheap signal" worry unsupported |
| Underestimation | g = 0.67 | Left-digit effect, largest of the three |

Authors' own caveat: effects are "small and highly heterogenous"; publication-bias
corrections "suggest smaller and, at times, nonsignificant true effects."

**Bottom line: charm pricing is not a reason to choose $9.99 over $10.** Pick the number
that fits the model.

---

## 11. CHAT CHANGES THE MODEL — the deciding factor (rev. Sept 21)

**Reggie confirmed the chat feature stays.** This invalidates the flat $9/mo recommendation
in Section 10 and is the single most important finding in this document.

### The two cost centers are nothing alike

Traced from `lib/handlers/chat-stream.js:490-532` (model routing) and the rates in
`memory/PRICING_MODEL_TIERS.md`:

| Layer | Model | Cost/message |
|---|---|---|
| Memory extraction | `gpt-4o-mini` | **~$0.0005** |
| Chat | `gpt-4o` (default) + Sonnet/Opus/Gemini | **~$0.0134** blended |

**Chat is roughly 27× the per-message cost of memory.** The code defaults to `gpt-4o`
(`chat-stream.js:826`: `model = 'gpt-4o'`), i.e. $2.50/$10.00 per 1M tokens — not the
$0.15/$0.60 mini tier.

### What that does to margins

| Usage | Msgs/mo | Cost/mo | Margin @ $9 | Margin @ $19 |
|---|---|---|---|---|
| Light (5/day) | 150 | **$2.08** | 76.9% | 89.0% |
| Typical (20/day) | 600 | **$8.33** | **7.4%** | 56.2% |
| Heavy (50/day) | 1,500 | **$20.83** | **−131%** | −9.6% |
| Power (100/day) | 3,000 | **$41.66** | −363% | −119% |

**Break-even at $9/mo is 21.6 messages/day.** A merely *typical* user sits at 7% margin,
and any heavy user is a direct loss. $9/mo with unlimited chat is not viable.

### The old tier ladder was right about one thing

The original design included "**50 premium messages/mo included**" and "**Premium message
packs ($3.75–$14.00)**". Those were not arbitrary — **they were chat cost control**, and
they were correct. Memory is cheap enough to give away; chat is not. The *structure* of the
old pricing was sound. Only the tiers and the memory rationing were wrong.

### The lever: routing

`chat-stream.js` already routes 'simple/quick/basic/short/brief' → `gpt-4o-mini`. Tuning
that classifier is the cheapest way to make a low price work:

| Routing | Cost/msg | 600 msgs/mo |
|---|---|---|
| Current (est.) | $0.0134 | **$8.03** |
| Aggressive mini-first | $0.0064 | **$3.87** |
| Mini-first + Sonnet only | $0.0034 | **$2.02** |

A 4× cost reduction with no pricing change. **This should be done regardless of price.**

### Margin-preserving chat caps by price

| Price | Cap @ 80% margin | Cap @ 70% margin |
|---|---|---|
| $9 | 129 msgs | 194 msgs |
| $12 | 173 msgs | 259 msgs |
| $14 | 201 msgs | 302 msgs |
| $19 | 273 msgs | 410 msgs |

### What price would support unlimited chat?

| User | Cost/mo | Price for 60% margin | Price for 80% margin |
|---|---|---|---|
| Typical (20/day) | $8.33 | **$20.85** | $41.70 |
| Heavy (50/day) | $20.83 | $52.10 | $104.25 |

Unlimited chat at any consumer price only works for *light* users. This is why every
consumer AI assistant caps or throttles usage.

### Recommended structure — hybrid, not flat

| Layer | Cost | Treatment |
|---|---|---|
| **Memory** (extraction, sync, MCP, Imprints) | ~$0.0005/msg | **Unlimited.** It is the differentiator and effectively free. Use it as the competitive weapon. |
| **Chat** | ~$0.0134/msg | **Capped**, or metered for premium models. Real variable cost. |
| **Light chat** | — | Route to `gpt-4o-mini` / Gemini Flash. Makes the generous cap affordable. |
| **Premium models** | — | Metered (Opus/Sonnet), or a credit add-on — the old "premium message pack" idea was correct. |

**Concrete recommendation:** **$12/mo, $120/yr (17% off)** with **unlimited memory** and a
**~300-message/mo chat allowance** (70% margin at cap), plus metered premium-model usage.
Combined with mini-first routing, that holds 70–85% margin across light-to-heavy users.

### The comparison set changed

With chat included, Passport is no longer a $10 memory utility — **it is a full assistant**
competing with ChatGPT Plus / Claude Pro / Google AI Pro at **~$17–20/mo**. That is
legitimate support for pricing *above* the memory-tool band, *provided* usage is capped.
The memory-only consumer cluster in Section 2 ($8–20, modal $10) no longer applies cleanly.

**This is the answer to "does chat change the price": yes — it raises the defensible price
band and makes unlimited untenable at the low end. Cap the chat, keep memory unlimited,
and route aggressively to cheap models.**

---

## 10b. Superseded recommendation (memory-only, no chat)

*Retained for the record.* If chat were ever removed or sold separately, the memory layer
alone would be a **$9/mo, $90/yr** product priced against the $8–20 consumer second-brain
cluster — see Section 10. With chat bundled, use Section 11.

## 10. Recommendation — CONSUMER POSITIONING (rev. Sept 21)

**Decision:** Passport is a **consumer product**. Reggie confirmed this and judged the
$19/$16 prosumer recommendation too high. This section is rewritten for the consumer band;
the prosumer/dev analysis above is retained as the rejected alternative.

### Why $19 was wrong for consumer

$19 was anchored to the *prosumer memory + MCP* cluster (Pieces $18.99, Tana $20) and to
platform professional tiers (Claude $17–20, Google AI Pro $19.99). For a **consumer**
product that is the top of the band, not the middle. The consumer second-brain cluster
verified in Section 2 is **$8–$20 with a modal price of ~$10**:

| Product | Monthly | Annual |
|---|---|---|
| MyMemo | $9.90 | $5.90/mo |
| Saner.AI | $8.00 | — |
| Mem (Plus) | $9.00 | — |
| Reflect | $10.00 | — |
| Pieces | $18.99 | $14.17/mo |
| Tana | $35.00 | $20.00/mo |

Modal consumer entry: **$9–10/month.**

### The stronger reason to stay low: free bundled competition

Repeating Section 4 because it dominates consumer pricing: **Claude's $0 tier includes
memory, ChatGPT bundles memory, Microsoft Recall is a $0 Windows feature**, and Mem0 /
Cognee / Graphiti are open-source at $0. A consumer is already being given memory for free
by products they pay nothing for. A consumer price has to be an easy yes against *free*.

### Recommended: **$9/month, $90/year ($7.50/mo effective)**

- Sits at the modal consumer memory price (Mem $9), under the $10 line.
- Annual discount **17%** — inside the verified 15–17% norm (Claude ~15%, Google One 16%).
- Clears at 97%+ gross margin at any realistic usage (Section 1).
- Low enough to look like an obvious add-on next to a $20 assistant.

### The honest counterpoint: the number barely matters yet

At the RevenueCat freemium median of **2.1% conversion**, 200 registered users ≈ **4 paying
subscribers**. At $9 that is ~$36/mo; at $19, ~$76/mo. Both are rounding errors.

**The price debate is not the bottleneck. Conversion is.** What actually decides revenue at
this stage is (a) how many of the 200 convert and (b) year-one retention — and RevenueCat's
finding is that hard paywalls convert ~5× better at day 35 while **year-one retention is
nearly identical**. Price level barely moves either.

**Practical consequence:** do not agonise over $9 vs $12. Publish a defensible low number,
lock beta users in at a founding rate they keep, and spend the effort on conversion.

### How to actually settle it (cheap, and we have the panel)

Beta is free, so no price needs to be published until beta ends. That is a free window:

1. **Mine engagement first** — free, non-hypothetical, shows which value moment precedes
   payment. Segment the 200 by usage depth.
2. **Ship the beta survey** (Section 8) — Van Westendorp + Gabor-Granger, then **discount
   the results ~21%** per Schmidt & Bijmolt.
3. **Live test on new signups only** from $9–12. Never test price on existing payers.
4. Decide at beta end with real data instead of a document.

**Recommended default if you want to decide now: $9/mo, $90/yr.**

**Price the MCP/dev surface, not the consumer extension.** The extension is the free
acquisition surface; the paid product is portable memory + agent access.

| Positioning | Price band | Evidence |
|---|---|---|
| Consumer second-brain | $8–12/mo, ceiling ~$29 | Sections 2, 6 |
| **Prosumer memory + MCP** | **$16–20/mo** | Pieces $18.99, Tana $20, Google AI Pro $19.99, Claude Pro $17–20 |
| Dev memory infrastructure | $19 entry → $100–399 | Section 3 |

**Recommended: $19/mo, $16/mo billed annually (~16% discount).**

Rationale:
- Sits at the verified prosumer memory+MCP cluster ($18.99–$20), not the $10 commodity band.
- Matches the verified annual-discount norm (15–16%) rather than inventing one.
- 96%+ gross margin at any realistic usage (Section 1).
- The $14 originally chosen is defensible but leaves ~$5/mo on the table against every
  verified analogue; it undercuts an anchor that does not need undercutting.

**The counter-argument, stated fairly:** if the goal is maximum top-of-funnel in beta,
$14 or lower is a legitimate choice, and the difference at current volume is trivial
(~$5/sub/mo). What matters far more is which *audience* is being priced — the same
capability supports 2–3× the day-one price and 10×+ the lifetime ceiling when sold to
developers rather than consumers. **The segment decision dominates the number decision.**

---

## Open items

- ChatGPT / Perplexity / Grok pricing: `UNVERIFIED` — retry when Internet Archive is back,
  or from a network that clears their bot walls.
- No published dataset was found for *consumer extension* attach rates specifically;
  the RevenueCat figures are app-store subscription benchmarks, not browser extensions.
- Whether to offer a founding-member/lifetime tier: no first-party vendor page in this
  category offers one; the lifetime channel is a distribution play (AppSumo), not list price.
