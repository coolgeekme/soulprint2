# Email — SPE feature changes (draft for approval)

> **Template:** build the final send from `emails/templates/soulprint-email-template.html`
> (see `emails/README.md` for the placeholder map and palette). This draft is copy only —
> do not hand-build new HTML.

**Audience:** current registered SoulPrint Engine users (~200)
**Send date:** [TBD — recommend ~2 weeks before Oct 1]
**Timeline announced:** changes take effect **October 1, 2026**
**Status:** DRAFT — do not send without approval

---

## Subject line options

1. `A change to SoulPrint Engine — starting October 1`
2. `What's changing at SoulPrint, and what you keep`
3. `SoulPrint is focusing. Here's what that means for you.`

**Recommended:** #1 — states the date and implies importance without alarm.

---

## Body

Hi [First name],

You were one of the first people to sign up for SoulPrint Engine, so you're owed a straight
answer about where it's going — and plenty of notice before anything changes.

**On October 1, we're simplifying SoulPrint Engine.**

Here's the short version: we're going all-in on the thing we're actually different at — an
AI that knows you, remembers you, and follows you from one assistant to the next. Everything
that doesn't serve that is moving out.

### What's leaving SoulPrint Engine

- **Image and video generation** — moving to The Foundry
- **Voice calls** — retired
- **Uploading files and PDFs into chat** — retired; chat is for talking
- **Credit packs and add-on plans** — gone. One plan, no tiers, no upsells
- **Old banners and half-used settings** — cleaned up

Most of this was never the point. Chat should be a clean, personal place to talk to an AI
that already knows you — not a toolbar full of extras.

### What you keep — unchanged

- **Chat itself**, exactly as it works today
- **Your memories** — everything you've saved stays, and stays yours
- **Conversation history** — every past chat, intact
- **Read-out-loud** — chat still speaks replies
- **Settings** — kept, just simplified
- **Export and delete** — always available, always free

Nothing about your account is being taken away. If you want a copy of your data, you can
export it any time.

### Still want to create images, video, or run business work?

That all still exists — it just lives in **The Foundry** now:
**https://foundryagents.ai**

The Foundry is built for exactly what we're retiring from chat: creating images and video,
producing files and documents, and running real business work with AI.

**Because you were here early, we're giving you a discount on The Foundry.**
[OFFER TO BE DECIDED — see note below]

### Why we're doing this

We'd rather build one thing exceptionally well than five things adequately.

An all-in-one chat app competes with ChatGPT and Claude. It's a crowded fight, and we don't
win it. What nobody else does well is memory that isn't trapped inside one company — an AI
that knows you wherever you already work. That's what we're building, and it's what your
account becomes.

If you've been using SoulPrint Engine for something specific that this affects, **reply to
this email.** It comes straight to us, and we'll help you find the right home for it.

Thanks for being here early. You'll hear from us again before October 1, and once more when
the changes go live.

— Reggie
SoulPrint Engine

---

## ⚠️ NOT READY — decisions needed before this sends

### 1. The Foundry discount (blocking)
The line above is a placeholder. Need concrete terms before sending. Options:
- X% off the first N months for existing SPE users
- A free tier/migration credit
- A named "founding member" rate

**Also need:** how they claim it (promo code, link, email match) and whether it's Foundry's
billing system or ours. Ben's rule applies here — *"have the solution before we yank
features."* A vague "discount" is worse than a specific number.

### 2. What happens to content they already made? (blocking)
Users who generated images or videos in SPE will want to know if their existing files survive.
Right now the email says nothing — because I don't know the answer. If those files go away,
that MUST be disclosed, and ideally exported/migrated first. **This is the single most likely
source of angry replies.**

### 3. Is there a paying subscriber? (blocking)
Ben referenced "one paid sub" in Slack. If anyone is on a paid plan, a broadcast is not
enough — they need a personal email with a clear answer about what happens to their money,
and ideally a credit or refund. **Do not let a paying customer learn this from a mass email.**

### 4. Exact send date
Recommend 2+ weeks before Oct 1 so nobody feels ambushed. Also worth considering Adrian's
point: land the removals *alongside* a new release so it reads as progress, not loss.

### 5. No broadcast capability (technical blocker)
`soulprint2/lib/email.js` has `sendEmail` and `sendAnnouncementEmail`, but **no way to email
the full user list** — there's no loop over users. This is a ~20-line admin route. It must be
built before this email can be sent at all.

---

## Sequencing note

This is **email #1 of a series** (per your Slack message — several emails as changes roll out):
1. **This email** — what's changing, when, what they keep, Foundry path (~2 weeks before)
2. **Reminder** — short, ~2 days before Oct 1
3. **Live confirmation** — the day it ships, with the Foundry link again

**Keep this email focused on the changes.** Do NOT pitch SoulPrint Passport here — mixing
"we're removing features" with "here's our new product" reads as bait-and-switch. The
Passport/beta invitation is a separate, segmented send (see `gtm-slack-post.md`).
