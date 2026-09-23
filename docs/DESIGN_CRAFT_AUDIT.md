# SoulPrint Engine — Design-Engineering Craft Audit

**Site:** soulprintengine.ai (Next.js, repo `/root/soulprint2`)
**Reviewed against:** the `design-engineering` pack (Emil Kowalski) — `emil-design-eng`,
`animate`, `review-animations`, `mobile-native`
**Date:** Sep 2026
**Scope:** `app/**`, `components/**`, `app/globals.css`, `app/layout.js`

> Audit only — nothing in this document has been changed in the repo. Findings are
> measured, not inferred. Where a first pass produced a false positive it is recorded
> in "Corrections" rather than quietly dropped.

---

## Verdict

**Block** — two accessibility defects ship on every page, and the mobile viewport is
locked. The motion system itself is in better shape than a first pass suggested.

| Area | State |
|---|---|
| Accessibility (zoom, reduced-motion, hover gating) | **Failing** |
| Mobile viewport / chrome-height | **Failing** |
| Transition specificity | **Failing, at scale** |
| Easing curves | **Passing** (see Corrections) |
| Transform origins / scale(0) entrances | **Passing** |
| Brand token consistency | **Failing** (two different oranges) |

---

## Findings

| Before | After | Why |
|---|---|---|
| `app/layout.js:21` — `userScalable: false, maximumScale: 1` | Remove both. Fix the real cause: `input, textarea, select { font-size: 16px }` | Disables pinch-zoom on every page — an accessibility failure. iOS zooms on focus only because input text is under 16px; locking the viewport treats the symptom and blocks the user's own remedy |
| `app/layout.js:23` — `themeColor: '#f97316'` | `#F64000` (brand), plus one `<meta>` per `prefers-color-scheme` | Tailwind orange-500, not the brand orange. A single value also means light mode gets a dark status bar and vice-versa |
| Missing entirely | `<meta name="color-scheme" content="light dark">` | The site has a light/dark theme toggle; the browser needs telling, or form controls and scrollbars render in the wrong scheme |
| `app/globals.css` — no `prefers-reduced-motion` block anywhere (17.5KB) | A gentler variant: keep opacity/colour transitions, drop movement | Motion-sensitivity trigger. Ships zero accommodation today |
| `app/globals.css:193,219,240` — `.btn-orange:hover`, `.chip:hover`, `.pillar-card:hover` ungated | Wrap in `@media (hover: hover) and (pointer: fine)` | Touch devices fake a hover on tap and leave it stuck until the user taps elsewhere — buttons stay visually "pressed" |
| `app/globals.css:124` — `min-height: 100vh` (with `-webkit-fill-available` fallback) | `min-height: 100dvh` | `100vh` is the *largest* viewport — the height with browser chrome collapsed. On load the URL bar is visible, so the layout overflows by its height. The webkit fallback is the legacy iOS patch; `dvh` is the modern answer |
| 10 further `100vh` uses — `app/memories/page.js:108`, `app/shared/[code]/page.js:172`, `components/mobile/MobileChat.js:3161`, `components/mobile/MobileViews.js:202`, `components/chat/CreateMenu.js:112`, `components/chat/SupportBubble.js:287`, `components/chat/SupportChat.js:165`, `app/pitch/page.js:1577,1597`, `app/og-pages/page.js:209` | `100dvh` for shells and bottom-pinned UI; `100svh` for heroes | Same bug. Worst offenders are the fixed chat surfaces and bottom-anchored menus, where content ends up under the browser chrome |
| `app/globals.css:189,215,236` — `transition: all 0.2s ease` | `transition: transform 160ms var(--ease-out), border-color 160ms var(--ease-out)` | `all` animates every changed property, including off-GPU ones, and silently picks up future properties nobody intended to animate |
| `components/mobile/MobileChat.js:5209` — `transition: all 0.2s ease-out` | Name the properties | Same; on mobile it is the most expensive place to get this wrong |
| **359** uses of Tailwind's `transition-all` class across `app/` and `components/` | Replace with `transition-colors`, `transition-transform`, or an explicit property list | Same violation as above, at scale. Tailwind's default easing is a weak built-in and the default duration is 150ms with no intent behind it. Most sit in chat components that the pending chat slim-down removes — fix the survivors, not the corpses |

---

## Corrections

**A first pass reported 12 `ease-in` violations. That was wrong.** The grep matched
`ease-in` as a substring of `ease-in-out`, which is the *correct* curve for on-screen
movement and is used appropriately (pulse/breathe/shimmer keyframes, gradient shifts).
A precise pattern — `ease-in` not followed by `-out` — returns **0 occurrences**.

Easing is a strength of this codebase, not a defect. No `ease-in` finding stands.

---

## Also passing (measured, not assumed)

- `scale(0)` entrances: **0**
- `transform: scale()` press feedback: present (e.g. `active:scale-95`)
- `env(safe-area-inset-*)`: correctly used with `viewportFit: 'cover'` already set
- `-webkit-tap-highlight-color`: handled via the mobile chat styles
- Staggered entrances: present in several components
- Keyframes: 8 defined (`fadeInUp`, `pulse-dot`, `slideUp`, `expandIn`, `badge-glow`, `badge-shimmer`, `shimmer`, `progress`) — used for loop/decorative motion, which is the correct tool for that job

---

## Brand drift — two different oranges in production

The design system defines `--sp-orange: #F64000`. A second, unrelated orange
`#f97316` (Tailwind orange-500) is hardcoded across user-facing surfaces:

| File | Use |
|---|---|
| `components/AssessmentNudge.js:132,178,184,225,236,318,340,382,397` | gradient, text, borders |
| `components/mobile/MobileChat.js:3860,5220,5245` | caret colour |
| `components/chat/PersonaDNACard.js:206` | ≥80% threshold indicator |
| `lib/email.js:36,41` | transactional email header + code box |
| `lib/handlers/media-intelligence.js:1341,1416` | internal notification emails |
| `lib/handlers/support-bot.js:374,385,399` | support ticket emails |
| `app/layout.js:23` | browser theme colour |

`#F64000` and `#f97316` are visibly different side by side. Anything user-facing should
consume the token; internal notification emails are lower priority but should follow.

---

## Remedial order

Per the `review-animations` preference hierarchy — cheapest, highest-impact first.

1. **Delete / unlock** — remove `userScalable: false` and `maximumScale: 1`; set inputs to 16px. One commit, fixes an accessibility failure on every page.
2. **Fix the tokens** — `themeColor` → `#F64000`, add the per-scheme pair and `color-scheme`.
3. **Add accommodation** — a `prefers-reduced-motion` block in `globals.css`, plus hover gating around the three ungated hover rules.
4. **Fix the viewport height** — `100vh` → `100dvh` / `100svh` in the eleven places above, shells first.
5. **Narrow the transitions** — the four raw `transition: all`, then the `transition-all` survivors after the chat slim-down lands.
6. **Unify the orange** — sweep `#f97316` to the brand token.

Steps 1–3 are small and independently revertable. Step 6 touches the most files and is
worth doing as its own commit so it can be dropped on its own.

---

## Method

Findings were produced by reading `app/globals.css` and `app/layout.js` directly and
grepping `app/` and `components/` — not by inspecting the live page in a browser. Counts
are exact for the patterns listed. Nothing here was verified on physical hardware: the
mobile items (chrome-height, tap highlight, overscroll) need a real device to confirm,
and that check has not been run.
