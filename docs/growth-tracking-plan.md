# SoulPrint Growth Tracking Plan

Last updated: July 14, 2026

## Objective

Measure which zero-budget acquisition activities produce registered and activated users. Do not send email addresses, names, or other personal data to analytics.

## Primary funnel

1. Qualified landing-page visit
2. `signup_completed`
3. `assessment_completed`
4. First meaningful chat activity (next implementation phase)
5. Referral share and `invite_redeemed`

An activated user is a user who completes an assessment and sends at least three messages within seven days of registration.

## Implemented events

| Event | Trigger | Properties |
|---|---|---|
| `signup_completed` | Successful new email, Google, or invite registration | `signup_method` plus first-touch attribution |
| `assessment_completed` | Successful standard or quick assessment | `assessment_type` plus first-touch attribution |
| `invite_redeemed` | Successful registration through an invite | `invite_code` plus first-touch attribution |

## First-touch attribution

The first landing visit is stored in the browser and attached to funnel events:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `landing_page`
- `referrer`
- `captured_at`

Use lowercase UTM values with underscores. Example:

`?utm_source=tiktok&utm_medium=organic_social&utm_campaign=stop_reexplaining&utm_content=memory_demo_01`

## GA4 delivery

Events are sent directly to GA4 property `G-JW09QN4TG1`. The direct integration is intentional because Google security-paused container `GTM-WCCXR92H` at the container level. Mark `signup_completed` and `assessment_completed` as key events in GA4.

## Next implementation phase

- Track CTA clicks by page location and creative ID.
- Track referral link copying and native sharing.
- Track the first and third successfully sent chat messages server-side.
- Add a registration-to-activation report to the admin dashboard.
- Persist attribution server-side at registration.
