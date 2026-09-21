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

## 10. Recommendation

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
