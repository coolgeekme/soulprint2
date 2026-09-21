# Decision: Keep Chat, or Focus on Passport Core?

**Date:** September 21, 2026
**Question:** Do we keep the chat feature, or focus strictly on Passport core — memory
portability, imprints, and SoulPrint?

**Recommendation: cut general chat. Keep memory-scoped Q&A.**

---

## The measurement that decides it

| | Lines | Share |
|---|---|---|
| `lib/handlers/chat-stream.js` (general chat) | **7,475** | **73%** |
| Passport core (memory-system, MCP, imprints, oauth) | 2,598 | 26% |

**Chat is 73% of the product surface.** It is also the only component with meaningful
variable cost. And `memory-system.js` and `lib/mcp/` do **not** import `chat-stream` — the
Passport core is already cleanly separable. This is a packaging decision, not a rewrite.

The MCP server already exposes the complete product without chat:

```
soulprint_add_memory      soulprint_get_memories     soulprint_list_imprints
soulprint_update_memory   soulprint_get_context      soulprint_set_imprint
soulprint_delete_memory   soulprint_get_profile      soulprint_suggest_memories
```

Nine tools. Portability, imprints, soulprint, context injection. **That is the product.**

---

## Marginal cost — the decisive number

At 600 messages/month (20/day, a "typical" engaged user):

| Configuration | Cost/mo | Margin @ $9 |
|---|---|---|
| Memory only (sync, MCP) | **$0.30** | 96.7% |
| Memory + memory-scoped Q&A | **$0.42** | **95.3%** |
| Memory + general chat | **$8.04** | **10.7%** |

**Break-even at $9/mo:**

| Configuration | Break-even |
|---|---|
| Memory only | 600 msgs/day |
| Memory + scoped Q&A | 429 msgs/day |
| **Memory + general chat** | **22 msgs/day** |

A general-chat user crosses break-even at **22 messages per day** — which is a normal day
for someone who likes the product.

**Price required for 80% margin:**

| Configuration | @20/day | @50/day | @100/day |
|---|---|---|---|
| Memory + scoped Q&A | $2.10 | $5.25 | $10.50 |
| Memory + general chat | **$40.20** | **$100.50** | **$201.00** |

---

## The strategic argument, which matters more

Section 4 of `PRICING_RESEARCH.md` established that free bundled memory is commoditizing
the category from below — Claude's $0 tier includes memory, ChatGPT bundles it, Microsoft
Recall is a free Windows feature. The research conclusion was:

> **"The only defensible wedge is portability + multi-tool reach."**

General chat **destroys that wedge.** It converts SoulPrint from a complement — the thing
that makes ChatGPT and Claude better — into a *substitute* for them. That is a fight
against OpenAI, Anthropic, and Google, on their turf, with a 10.7% margin.

Memory portability has **no direct competitor.** Nothing else makes one memory work across
ChatGPT, Claude, and agents. That is a category of one.

| With general chat | Without it |
|---|---|
| Competes with ChatGPT Plus, Claude Pro, Google AI Pro ($17–20) | Competes with nobody on portability |
| 10.7% margin at $9 | 95.3% margin at $9 |
| 7,475 lines to maintain, model routing, abuse handling | 2,598 lines |
| MCP is a secondary feature | MCP is the product |

---

## The honest counterargument

**Chat is the retention surface.** A memory layer has a genuine engagement problem: users
install the extension, and then have no reason to *return*. Chat gives a daily habit and a
place to see the product working. Churn is the #1 killer of consumer subscriptions, and
RevenueCat's data shows freemium conversion depends on getting users to a value moment
repeatedly.

**Why this doesn't change the answer:** the engagement already happens *inside ChatGPT and
Claude* — where the user already is, daily. Passport injects context into those tools
rather than asking the user to adopt a new one. You piggyback on an existing habit instead
of competing with it.

What the user *does* need is a place to **manage** memory — see what's stored, edit it,
delete it, build Imprints. That is a **memory console**, not a chatbot. It is cheap
(retrieval + mini), it is on-brand, and it reinforces the wedge rather than diluting it.

---

## The recommended resolution

| Surface | Decision |
|---|---|
| General chat (gpt-4o, Sonnet, Opus, Gemini) | **Cut.** 73% of code, 10.7% margin, wrong competitive frame. |
| Memory-scoped Q&A ("ask your SoulPrint") | **Keep.** ~$0.0007/msg on mini. Answers from stored memory, not open-ended generation. |
| Memory console (view / edit / delete / Imprints) | **Keep and invest.** This is the product surface. |
| MCP server (9 tools) | **Keep and lead with it.** The wedge. |
| Extension context injection | **Keep.** The daily-habit surface. |

**"Ask your SoulPrint" is not general chat.** It answers from *your* memory — retrieval plus
a mini-model synthesis. It preserves the conversational feel and the engagement loop at
**1/20th the cost**, and it cannot be mistaken for a ChatGPT competitor.

---

## Pricing consequence

With chat removed, the memory-only analysis returns to validity:

**$9/mo, $90/yr (17% off) — unlimited memory, unlimited memory-Q&A, 95%+ margin.**

No usage caps needed. No metering. No visible ceiling. No anxiety at the boundary. A single
clean promise: **"Your AI remembers you — everywhere."**

Section 11's capped-chat recommendation becomes moot, because the thing that required
capping is gone.

---

## What this costs

To be clear about the tradeoff: this means shelving substantial working code. Chat is
built, and parts of it are good. The argument is not that it doesn't work — it's that it
carries the entire variable cost, three-quarters of the maintenance surface, and the only
competition the product has.

The chat code does not need to be deleted. Gating it off and keeping the module in the repo
preserves the option to relaunch it later as a **separate, metered product** with its own
P&L — which is the only structure in which it makes economic sense.
