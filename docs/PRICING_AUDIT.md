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
