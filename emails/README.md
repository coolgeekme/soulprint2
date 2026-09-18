# SPE email template — usage guide

The house email template for SoulPrint Engine / SoulPrint Passport sends.
Source: `templates/soulprint-email-template.html` (provided by Reggie, Sep 18 2026).

**Copy the template, don't hand-build a new email.** Filling the placeholders keeps every
send visually consistent and avoids the deliverability problems that come with improvised
HTML.

---

## Before you send — the non-negotiables

1. **Inline CSS only.** Gmail strips `<style>` blocks. Every style in this template is inline
   on purpose — do not refactor it into a stylesheet.
2. **Table-based layout.** The header logo uses a table-width approach because Gmail does not
   respect flexbox/grid/`max-width` on divs. Don't replace tables with divs.
3. **All placeholders must be replaced.** An email that ships with a literal `{{HEADLINE}}`
   is worse than plain text. Grep before sending:
   ```bash
   grep -o '{{[A-Z_]*}}' out.html | sort -u   # must return nothing
   ```
4. **Test in a real client** — Gmail web, Gmail iOS, and Outlook — before any list send.

---

## The 33 placeholders

### Header
| Placeholder | What goes in |
|---|---|
| `{{EMAIL_TITLE}}` | `<title>` — shows in some clients/tabs (not the subject line) |
| `{{LOGO_SRC}}` | Absolute HTTPS URL to the logo. **Must be a full URL**, not a relative path |
| `{{BADGE_TEXT}}` | Small badge next to the wordmark (e.g. `PASSPORT`) |
| `{{HEADER_EYEBROW}}` | Small uppercase label above the headline |
| `{{HEADER_TAGLINE}}` | One-line tagline under the wordmark |

### Body
| Placeholder | What goes in |
|---|---|
| `{{HEADLINE}}` | The main headline |
| `{{PARAGRAPH_TEXT}}` | Body copy. Repeatable — duplicate the block for multiple paragraphs |
| `{{QUOTE_TEXT}}` | Pull-quote / highlight block |
| `{{CENTER_BLOCK_EYEBROW}}` | Small label above the centre feature block |
| `{{CENTER_BLOCK_MAIN}}` | The centre block's main text (offer, code, teaser) |
| `{{CENTER_BLOCK_SUB}}` | Supporting line under the centre block |
| `{{SECTION_LABEL}}` | Section heading label |
| `{{FEATURE_TAG}}` | Small tag on a feature item |
| `{{FEATURE_TITLE}}` | Feature item title |
| `{{FEATURE_DESC}}` | Feature item description |
| `{{PANEL_LABEL}}` | Label for the panel block |
| `{{PANEL_CONTENT}}` | Panel block content |
| `{{CALLOUT_LABEL}}` | Callout label |
| `{{CALLOUT_TEXT}}` | Callout text |
| `{{CTA_LABEL}}` | Button text |
| `{{CTA_URL}}` | Button destination — **absolute URL** |
| `{{SIGNOFF_TEXT}}` | Sign-off line |
| `{{SENDER_NAME}}` | Sender's name |
| `{{SENDER_TITLE}}` | Sender's title |
| `{{FOOTER_NOTE}}` | Footer fine print |

### Links
| Placeholder | What goes in |
|---|---|
| `{{SOULPRINT_URL}}` | https://soulprintengine.ai |
| `{{ARCHEFORGE_URL}}` | ArcheForge site |
| `{{LINKEDIN_URL}}` `{{X_URL}}` `{{YOUTUBE_URL}}` `{{INSTAGRAM_URL}}` `{{FACEBOOK_URL}}` `{{BLUESKY_URL}}` | Social profiles |

---

## Brand tokens in the template

The template ships with a **dark navy + gold** palette. Note this differs from the marketing
site's near-black + `#F64000` orange — **use the template's palette for email** and don't
"correct" it to match the website; the client-provided asset is the source of truth.

| Role | Hex |
|---|---|
| Page background | `#000000` |
| Card / panel background | `#0a0a0a`, `#0d0d0d` |
| Deep accent panel | `#1a2540`, `#05080f` |
| **Primary accent (gold)** | `#d4a574` |
| Warm secondary accent | `#e8834f` |
| Heading text | `#eef0f6` |
| Body text | `#b8c5d6` |
| Muted text | `#8a9bbf`, `#5c7099`, `#4a5e80` |
| Success / error tints | `#1a4a2a`, `#3a1a1a` |

Typography: **Georgia / Times New Roman serif** stack.

---

## Sending from the app

The app has **no broadcast capability.** `soulprint2/lib/email.js` exposes:
- `sendEmail({ to, subject, html, replyTo })` — single send
- `sendAnnouncementEmail(email, title, content, ctaText, ctaUrl)` — templated announcement

To email the full user list you need a loop over users in an admin route. That is **not built
yet** — it must exist before any list send. Plan ~20 lines plus a test-mode dry run.

**Always dry-run to a small internal list first**, then send.
