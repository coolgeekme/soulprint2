#!/usr/bin/env python3
"""
Build a SoulPrint email as BOTH html and plain-text from a single content spec.

Why: a plain-text fallback written by hand drifts from the HTML the moment anyone
edits one and not the other. Rendering both from one spec keeps them in lockstep.

Usage:
    python3 build_email.py content.json out/            # writes out/<slug>.html + .txt
    python3 build_email.py --check out/                 # assert no {{PLACEHOLDER}} survived

Rules baked in:
  - Plain text is wrapped at 72 chars (safe for every client).
  - URLs go on their own line so they stay clickable and unbroken.
  - No markdown in the text part (it renders literally in most clients).
  - Both parts end with the same footer note + postal address slot (CAN-SPAM).
"""
import json
import re
import sys
import textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
HTML_TEMPLATE = HERE / "templates" / "soulprint-email-template.html"

WRAP = 72
DIVIDER = "-" * WRAP
RULE = "=" * 34


# ── helpers ──────────────────────────────────────────────────────────────────

def wrap(text: str, width: int = WRAP) -> str:
    """Wrap a block of copy, preserving intentional single newlines."""
    out = []
    for para in str(text).split("\n"):
        para = para.strip()
        if not para:
            out.append("")
            continue
        out.append(textwrap.fill(para, width=width, break_long_words=False,
                                 break_on_hyphens=False))
    return "\n".join(out)


def find_block(html: str, start_re: str, tag: str = "table") -> tuple[int, int]:
    """Return (start,end) of the element that starts at start_re, counting <tag> nesting."""
    m = re.search(start_re, html)
    if not m:
        raise ValueError(f"block start not found: {start_re[:60]}")
    start = m.start()
    open_re = re.compile(rf"<{tag}\b", re.I)
    close_re = re.compile(rf"</{tag}>", re.I)
    depth = 0
    i = start
    while i < len(html):
        o = open_re.search(html, i)
        c = close_re.search(html, i)
        if c is None:
            raise ValueError("unbalanced tag")
        if o and o.start() < c.start():
            depth += 1
            i = o.end()
        else:
            depth -= 1
            i = c.end()
            if depth == 0:
                return start, i
    raise ValueError("no closing tag")


def duplicate(html: str, start_re: str, placeholder: str, values: list, tag: str = "table") -> str:
    """Replace a single block containing `placeholder` with one copy per value."""
    if not values:
        s, e = find_block(html, start_re, tag)
        return html[:s] + html[e:]
    s, e = find_block(html, start_re, tag)
    block = html[s:e]
    copies = [block.replace(placeholder, str(v)) for v in values]
    return html[:s] + "".join(copies) + html[e:]


# ── HTML rendering ───────────────────────────────────────────────────────────

def render_html(spec: dict) -> str:
    if not HTML_TEMPLATE.exists():
        raise SystemExit(f"missing template: {HTML_TEMPLATE}")
    html = HTML_TEMPLATE.read_text(encoding="utf-8")

    # repeatable: body paragraphs
    html = duplicate(
        html,
        r'<p class="p" style="margin:0 0 18px 0;[^"]*">\s*\{\{PARAGRAPH_TEXT\}\}\s*</p>',
        "{{PARAGRAPH_TEXT}}", spec.get("PARAGRAPHS", []), tag="p")

    # repeatable: feature rows — render one block per feature item
    feats = spec.get("FEATURES", [])
    feat_re = r'<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;">'
    s, e = find_block(html, feat_re)
    if feats:
        block = html[s:e]
        rendered = []
        for f in feats:
            b = block
            b = b.replace("{{FEATURE_TITLE}}", str(f.get("title", "")))
            b = b.replace("{{FEATURE_DESC}}", str(f.get("desc", "")))
            tag = str(f.get("tag", "")).strip()
            if tag:
                b = b.replace("{{FEATURE_TAG}}", tag)
            else:
                # no tag -> remove the whole right-hand tag cell so it doesn't render empty
                b = re.sub(r'<td align="right" style="white-space:nowrap;padding-left:10px;">.*?</td>',
                           "", b, flags=re.S)
            rendered.append(b)
        html = html[:s] + "".join(rendered) + html[e:]
    else:
        html = html[:s] + html[e:]

    # simple scalar replacements
    scalars = {
        "EMAIL_TITLE": spec.get("EMAIL_TITLE", spec.get("SUBJECT", "")),
        "LOGO_SRC": spec.get("LOGO_SRC", ""),
        "BADGE_TEXT": spec.get("BADGE_TEXT", ""),
        "HEADER_EYEBROW": spec.get("HEADER_EYEBROW", ""),
        "HEADER_TAGLINE": spec.get("HEADER_TAGLINE", ""),
        "HEADLINE": spec.get("HEADLINE", ""),
        "SECTION_LABEL": spec.get("SECTION_LABEL", ""),
        "QUOTE_TEXT": spec.get("QUOTE_TEXT", ""),
        "PANEL_LABEL": spec.get("PANEL_LABEL", ""),
        "PANEL_CONTENT": spec.get("PANEL_CONTENT", ""),
        "CALLOUT_LABEL": spec.get("CALLOUT_LABEL", ""),
        "CALLOUT_TEXT": spec.get("CALLOUT_TEXT", ""),
        "CENTER_BLOCK_EYEBROW": spec.get("CENTER_BLOCK_EYEBROW", ""),
        "CENTER_BLOCK_MAIN": spec.get("CENTER_BLOCK_MAIN", ""),
        "CENTER_BLOCK_SUB": spec.get("CENTER_BLOCK_SUB", ""),
        "CTA_LABEL": spec.get("CTA_LABEL", ""),
        "CTA_URL": spec.get("CTA_URL", ""),
        "SIGNOFF_TEXT": spec.get("SIGNOFF_TEXT", ""),
        "SENDER_NAME": spec.get("SENDER_NAME", ""),
        "SENDER_TITLE": spec.get("SENDER_TITLE", ""),
        "FOOTER_NOTE": spec.get("FOOTER_NOTE", ""),
        "SOULPRINT_URL": spec.get("SOULPRINT_URL", ""),
        "ARCHEFORGE_URL": spec.get("ARCHEFORGE_URL", ""),
        "LINKEDIN_URL": spec.get("LINKEDIN_URL", ""),
        "INSTAGRAM_URL": spec.get("INSTAGRAM_URL", ""),
        "X_URL": spec.get("X_URL", ""),
        "BLUESKY_URL": spec.get("BLUESKY_URL", ""),
        "FACEBOOK_URL": spec.get("FACEBOOK_URL", ""),
        "YOUTUBE_URL": spec.get("YOUTUBE_URL", ""),
    }
    for k, v in scalars.items():
        html = html.replace("{{%s}}" % k, str(v))

    return html


# ── plain-text rendering ─────────────────────────────────────────────────────

def render_text(spec: dict) -> str:
    L = []

    eyebrow = spec.get("HEADER_EYEBROW", "").strip()
    tagline = spec.get("HEADER_TAGLINE", "").strip()
    if eyebrow:
        L.append(eyebrow.upper())
    if tagline:
        L.append(tagline)
    L.append("")
    L.append("-" * WRAP)
    L.append("")

    badge = spec.get("BADGE_TEXT", "").strip()
    if badge:
        L.append(f"[ {badge.upper()} ]")
        L.append("")

    if spec.get("HEADLINE"):
        L.append(wrap(spec["HEADLINE"]))
        L.append("")

    for p in spec.get("PARAGRAPHS", []):
        L.append(wrap(p))
        L.append("")

    feats = spec.get("FEATURES", [])
    if spec.get("SECTION_LABEL") or feats:
        if spec.get("SECTION_LABEL"):
            L.append(spec["SECTION_LABEL"].upper())
            L.append("")
        for f in feats:
            title = f.get("title", "").strip()
            tag = f.get("tag", "").strip()
            L.append(f"  * {title}" + (f"  [{tag}]" if tag else ""))
            if f.get("desc"):
                L.append(textwrap.fill(f["desc"], width=WRAP, initial_indent="    ",
                                       subsequent_indent="    "))
            L.append("")

    if spec.get("QUOTE_TEXT"):
        L.append(wrap(spec["QUOTE_TEXT"]))
        L.append("")

    if spec.get("PANEL_CONTENT"):
        if spec.get("PANEL_LABEL"):
            L.append(spec["PANEL_LABEL"].upper())
        L.append(wrap(spec["PANEL_CONTENT"]))
        L.append("")

    if spec.get("CALLOUT_TEXT"):
        if spec.get("CALLOUT_LABEL"):
            L.append(spec["CALLOUT_LABEL"].upper())
        L.append(wrap(spec["CALLOUT_TEXT"]))
        L.append("")

    if spec.get("CENTER_BLOCK_MAIN"):
        L.append(RULE)
        if spec.get("CENTER_BLOCK_EYEBROW"):
            L.append(spec["CENTER_BLOCK_EYEBROW"].upper().center(34).rstrip())
        L.append(spec["CENTER_BLOCK_MAIN"].center(34).rstrip())
        if spec.get("CENTER_BLOCK_SUB"):
            sub = spec["CENTER_BLOCK_SUB"].strip()
            # never uppercase something that looks like a domain or URL
            if not re.match(r"^(https?://|www\.)|\.[a-z]{2,}$", sub, re.I):
                sub = sub.upper()
            L.append(sub.center(34).rstrip())
        L.append(RULE)
        L.append("")

    if spec.get("CTA_LABEL") and spec.get("CTA_URL"):
        L.append(spec["CTA_LABEL"].upper())
        L.append(spec["CTA_URL"])
        L.append("")

    if spec.get("SIGNOFF_TEXT"):
        L.append(wrap(spec["SIGNOFF_TEXT"]))
        L.append("")
    if spec.get("SENDER_NAME"):
        L.append(spec["SENDER_NAME"])
    if spec.get("SENDER_TITLE"):
        L.append(spec["SENDER_TITLE"].upper())

    L.append("")
    L.append("-" * WRAP)
    L.append("")
    L.append("SOULPRINT ENGINE  |  ARCHEFORGE")

    socials = [("LinkedIn", spec.get("LINKEDIN_URL")), ("Instagram", spec.get("INSTAGRAM_URL")),
               ("X", spec.get("X_URL")), ("Bluesky", spec.get("BLUESKY_URL")),
               ("Facebook", spec.get("FACEBOOK_URL")), ("YouTube", spec.get("YOUTUBE_URL"))]
    for name, url in socials:
        if url:
            L.append(f"{name}: {url}")

    if spec.get("FOOTER_NOTE"):
        L.append("")
        L.append(wrap(spec["FOOTER_NOTE"]))

    text = "\n".join(L).rstrip() + "\n"
    # collapse 3+ blank lines
    return re.sub(r"\n{3,}", "\n\n", text)


# ── CLI ──────────────────────────────────────────────────────────────────────

def check_dir(d: Path) -> int:
    bad = 0
    for f in sorted(d.glob("*")):
        if f.suffix not in (".html", ".txt"):
            continue
        s = f.read_text(encoding="utf-8")
        left = sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", s)))
        if left:
            print(f"  FAIL {f.name}: unreplaced {left}")
            bad += 1
        else:
            print(f"  OK   {f.name}")
    return bad


def main(argv):
    if len(argv) >= 3 and argv[1] == "--check":
        return 1 if check_dir(Path(argv[2])) else 0

    if len(argv) < 3:
        print(__doc__)
        return 2

    spec = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    outdir = Path(argv[2])
    outdir.mkdir(parents=True, exist_ok=True)
    slug = spec.get("slug", "email")

    html = render_html(spec)
    text = render_text(spec)

    (outdir / f"{slug}.html").write_text(html, encoding="utf-8")
    (outdir / f"{slug}.txt").write_text(text, encoding="utf-8")

    left = sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", html)))
    print(f"wrote {outdir/slug}.html  ({len(html)} bytes)")
    print(f"wrote {outdir/slug}.txt   ({len(text)} bytes)")
    if left:
        print(f"  WARNING unreplaced placeholders: {left}")
        return 1
    print("  no unreplaced placeholders")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
