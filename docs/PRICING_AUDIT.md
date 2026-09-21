# Pricing audit — SoulPrint (Sept 21 2026)

Audit of every pricing surface, ahead of the Oct 1 feature changes.
Ground truth pulled from the **live production API** (`soulprintengine.ai/api/pricing/plans`),
the marketing pages, and `lib/handlers/pricing.js`.

## The headline

Three surfaces disagree with each other, and the one that matters — the
**production catalog that Stripe bills from** — is currently selling the exact
features we are retiring on October 1.

| Surface | What it says | Reality |
|---|---|---|
| Marketing `/pricing` + FAQ | **One plan.** Passport $14/mo, $12/mo annual ($144/yr). "No tiers." | Not in the backend |
| Production API + Stripe | **Four tiers:** Free, Base $19, Plus $39, Power $97 | Live, with real Stripe price IDs |
| Codebase | 70 references to `'base' \| 'plus' \| 'power'` | Baked in |

There is **no `passport` plan anywhere** in the backend. The thing the site
advertises is not a product that exists.

## 1. The catalog sells retiring features

Every paid tier's feature list is dominated by image generation, video generation,
voice, and file/PDF analysis — the four capabilities the Oct 1 email retires.

| Tier | Price | Feature keys | Retired Oct 1 | Remaining |
|---|---|---|---|---|
| Base | $19/mo | 20 | **12** (60%) | 8 |
| Plus | $39/mo | 20 | **12** (60%) | 8 |
| Power | $97/mo | 15 | **7** (47%) | 8 |

Base$19 and Plus $39 both list `images_per_month`, `image_models`, `videos_per_month`,
`video_models`, `video_duration_sec`, `video_resolution`, `video_watermark`,
`voice_chat`, `voice_minutes_per_month`, `pdfs_per_month`, `file_analysis_basic`,
`file_analysis_advanced`.

Power $97 lists `image_models: all`, `video_models: all`, `video_resolution: all`,
`voice_unlimited`, plus both file-analysis keys.

**Selling a subscription and then removing 60% of what it promised is a refund and
chargeback problem**, not a messaging problem. This is the reason to fix the catalog
before any change email goes out — the email tells users features are leaving; the
billing system would still be promising them.

## 2. Nobody can actually buy

`app/(marketing)/pricing/page.js` CTA:

```jsx
<Link href="/auth">Get Passport</Link>
```

It sends the buyer to **login**, not to checkout. There is no checkout, subscribe,
upgrade, or billing page anywhere in the app (`app/api/billing` exists; no UI route).
So no web purchase path exists today.

This is load-bearing for the transition: it means there are likely **no web-acquired
subscribers to migrate** — but that must be confirmed from the Stripe dashboard, since
subscriptions could exist from manual creation or an older UI.

## 3. Stripe state

The live catalog carries real price IDs:

| Plan | Monthly price ID | Annual price ID |
|---|---|---|
| Base | `price_1U1X6CPK7jhQlR2aXNrTVM5N` | `price_1U1X6PPK7jhQlR2abRfNjGCX` |
| Plus | `price_1TmEuYPK7jhQlR2aV6VU6QzT` | `price_1TmEvEPK7jhQlR2akqKO6YnF` |
| Power | `price_1TSK0xPK7jhQlR2aT2nWMZoS` | `price_1TSK0xPK7jhQlR2a9E9lti8B` |

`createCheckoutSession` is implemented and correct (customer create/reuse, mode switch
handling, discount-code support). **The billing engine works — it is only the product
definition and the CTA that are wrong.** That is a small fix, not a rebuild.

## 4. Discount infrastructure already exists

`createDiscountCode` provisions real Stripe coupons:
`percent_off` | `amount_off` | `lifetime_deal`, duration `once` | `forever` | `repeating`
(+ `duration_in_months`), with `max_uses`, `expires_at`, and `plan_ids` scoping.

This is directly reusable for the Foundry offer and for any founding-member rate.
**No new billing code is needed for the discount** — only a decision on terms.

## Recommended shape

1. **Create a single `passport` plan** at $14/mo, $144/yr — the numbers already on the
   marketing page and FAQ. Price is unchanged; this is alignment, not a repricing.
2. **Retire Base / Plus / Power** by setting `is_active: false` (never delete — existing
   subscriptions must resolve).
3. **Point the CTA at real checkout** for the passport plan.
4. **Migrate any existing paid subscriber** to Passport at no increase, with a discount
   code, rather than downgrading them.
5. **Confirm the subscriber count** from Stripe before sending anything.

The tier ladder was priced for heavy image/video users — an audience that now belongs to
The Foundry. Collapsing to one plan does not sacrifice surviving revenue; it stops
selling a product we have decided not to build.

---

# Migrating the existing subscriber — safety analysis

One paying subscriber, confirmed. Verified below that catalog changes **cannot** alter his
billing, and identified the single operation that **would** break him.

## Why his payment is structurally safe

**1. Stripe Prices are immutable.** The amount on an existing `price_xxx` object cannot be
edited — Stripe requires creating a new Price. His subscription references the old price
ID, so no catalog edit can change what he is charged. This is not a coding convention;
it is enforced by Stripe's API.

**2. Nothing in this codebase modifies a subscription's price.** The only
`stripe.subscriptions.update` call is in `cancelSubscription` (pricing.js:783) and it sets
`cancel_at_period_end: true` only — no price, no line-item change. No code path performs a
plan swap with proration.

**3. The webhook never re-maps `plan_id` from a price.** All four relevant handlers were
read in full:

| Event | What it writes | Touches `plan_id`? |
|---|---|---|
| `invoice.paid` | `status: 'active'` | No |
| `invoice.payment_failed` | `status: 'past_due'` + email | No |
| `customer.subscription.updated` | status + period dates | No |
| `customer.subscription.deleted` | `plan_id: 'free'` | Only on real cancellation |

So even if we archive or null price IDs, no inbound event can silently move him to a
different plan.

`startGracePeriodForAllUsers` is also safe — it only writes to users with no subscription
or `plan_id === 'free'`, so it cannot reach a paid subscriber.

## The one operation that WOULD break him

`lib/handlers/access-check.js:71`:

```js
const plan = await plansCol.findOne({ id: sub.plan_id }) || {
  id: 'free', name: 'Free', features: { chat_model_tier: 'standard' }
};
```

This query has **no `is_active` filter** — it matches on `id` alone. Two consequences:

| Action | Effect on him |
|---|---|
| `is_active: false` | **Safe.** He still resolves his plan. Deactivation only hides the plan from the public listing, since `getPlans()` filters on `is_active`. |
| **Delete the plan doc / rename its `id`** | **BREAKS HIM.** He silently falls back to Free features while Stripe keeps charging. Paying-but-locked-out, with no error raised. |

### Rule

> **Deactivate plans. Never delete them.** Retire Base / Plus / Power with
> `is_active: false`. Their documents must outlive every subscription that references
> `plan_id`.

Add a regression test asserting that a user whose `plan_id` points at an inactive plan
still resolves that plan's features.

## Recommended treatment of the subscriber

Grandfathering preserves revenue but leaves him paying tier prices for a product that no
longer includes roughly 60% of what the tier promised. Since N=1, revenue is a rounding
error and goodwill is worth more than the delta:

1. **Keep his existing Stripe subscription untouched** — no price change, no cancellation.
2. **Grant Passport access explicitly** via `adminSetUserPlan` (sets `admin_override: true`
   with a reason), which writes only to `user_subscriptions` and never calls Stripe.
3. **Offer a founding-member rate** — a decrease or a credit, never an increase.
4. **Contact him personally**, not by broadcast. He is the only migration test case.
