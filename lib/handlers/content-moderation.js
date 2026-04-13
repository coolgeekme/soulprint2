// ═══════════════════════════════════════════════════════════════════════════
// Content Moderation Engine — SoulPrint Safety Guardrails
// Blocks pornographic, violent, vulgar, NC-17 content across text, image, and video
// ═══════════════════════════════════════════════════════════════════════════

// Severity levels
const SEVERITY = {
  BLOCK: 'block',       // Immediate block, no generation
  WARN: 'warn',         // Allow but flag for review
  CLEAN: 'clean',       // Content is safe
};

// ── Category: Sexual / Pornographic ──────────────────────────────────────
const SEXUAL_PATTERNS = [
  // Explicit sexual acts
  /\b(?:porn(?:ograph(?:y|ic))?|xxx|hentai|erotic(?:a|ism)?|smut)\b/i,
  /\b(?:sex(?:ual)?\s+(?:act|scene|position|intercourse)|orgasm|climax|ejaculat)/i,
  /\b(?:blow\s*job|hand\s*job|rim\s*job|gang\s*bang|threesome|orgy|bukk?ake)\b/i,
  /\b(?:masturbat|fellatio|cunnilingus|sodomy|fornication)\b/i,
  /\b(?:strip(?:tease|per|ping)|lap\s*dance|pole\s*danc)/i,
  // Explicit body parts in sexual context
  /\b(?:genital|penis|vagina|vulva|clitoris|scrotum|testicle|phallus|erect(?:ion)?)\b/i,
  /\bnude(?:s|ity)?\b(?!\s+(?:color|palette|shade|tone|lip|makeup|beach))/i,
  /\bnaked\b(?!\s+(?:eye|truth|reality|fact|ambition))/i,
  // Sexual modifiers
  /\b(?:topless|bottomless|lingerie|see[\s-]?through|provocative|seduct(?:ive|ress|ion))\b/i,
  /\b(?:bondage|bdsm|fetish|dominatrix|submissive\s+(?:girl|woman|man|boy))\b/i,
  /\b(?:sex\s*(?:toy|doll|slave|worker|trafficking))\b/i,
  // Suggestive generation prompts
  /\b(?:barely\s+(?:dressed|clothed|covered)|scantily\s+clad|revealing\s+(?:outfit|clothing|dress))\b/i,
  /\b(?:spread\s+(?:legs|eagle)|bent\s+over|on\s+(?:all\s+fours|hands\s+and\s+knees))\b/i,
  /\b(?:moaning|groaning|pleasur(?:ing|ed))\b(?!.*(?:food|taste|flavor|music|song))/i,
];

// ── Category: Violence / Gore ────────────────────────────────────────────
const VIOLENCE_PATTERNS = [
  // Extreme violence
  /\b(?:dismember|decapitat|mutilat|disembowel|eviscerat|behead(?:ing)?)\b/i,
  /\b(?:torture\s+(?:scene|porn|chamber|device)|waterboard|electrocute)\b/i,
  /\b(?:mass\s+(?:murder|shooting|killing|execution)|genocide|ethnic\s+cleansing)\b/i,
  /\b(?:gore|gory|blood(?:bath|shed|y\s+(?:murder|death|kill|massacre)))\b/i,
  /\b(?:snuff\s+film|death\s+video|execution\s+video|murder\s+video)\b/i,
  // Graphic wound descriptions for image generation
  /\b(?:severed\s+(?:head|limb|arm|leg|finger)|exposed\s+(?:bone|organ|intestine|brain))\b/i,
  /\b(?:stab(?:bing|bed)\s+(?:repeatedly|multiple|victim)|slitting?\s+(?:throat|wrist))\b/i,
  /\b(?:school\s+shoot|mass\s+shoot|shoot(?:ing)?\s+(?:up|spree))\b/i,
];

// ── Category: Child Safety (CSAM) ────────────────────────────────────────
const CHILD_SAFETY_PATTERNS = [
  /\b(?:child|kid|minor|underage|teen(?:age)?|preteen|juvenile|infant|toddler|baby)\b.*\b(?:nude|naked|sex(?:ual)?|erotic|porn|provocative|seductive|lingerie)\b/i,
  /\b(?:nude|naked|sex(?:ual)?|erotic|porn|provocative|seductive)\b.*\b(?:child|kid|minor|underage|teen(?:age)?|preteen|juvenile)\b/i,
  /\b(?:pedo(?:phile|philia)?|cp\b|jailbait|loli(?:ta|con)?|shota(?:con)?)\b/i,
  /\b(?:child\s+(?:abuse|exploitation|trafficking|molest))\b/i,
];

// ── Category: Hate Speech ────────────────────────────────────────────────
const HATE_SPEECH_PATTERNS = [
  /\b(?:white\s+(?:supremac|power|nationalist)|aryan\s+(?:race|nation|brotherhood))\b/i,
  /\b(?:nazi|fascist|neo[\s-]?nazi|swastika|ss\s+officer|third\s+reich|heil\s+hitler)\b/i,
  /\b(?:racial\s+(?:slur|epithet)|lynch(?:ing)?|ethnic\s+(?:slur|hatred))\b/i,
  /\b(?:kill\s+all\s+(?:\w+)|death\s+to\s+(?:all\s+)?\w+|exterminate\s+(?:all\s+)?\w+)\b/i,
  // Known slurs — abbreviated patterns to catch variations
  /\bn[\s_-]*[i1][\s_-]*g[\s_-]*g[\s_-]*[e3][\s_-]*r/i,
  /\bf[\s_-]*[a@][\s_-]*g[\s_-]*g?[\s_-]*[o0][\s_-]*t/i,
  /\bk[\s_-]*[i1][\s_-]*k[\s_-]*[e3]/i,
];

// ── Category: Self-Harm / Suicide ────────────────────────────────────────
const SELF_HARM_PATTERNS = [
  /\b(?:how\s+to\s+(?:kill\s+(?:myself|yourself)|commit\s+suicide|hang\s+(?:myself|yourself)))\b/i,
  /\b(?:suicide\s+(?:method|technique|instruction|guide|note|pact))\b/i,
  /\b(?:self[\s-]?harm(?:ing)?|cut(?:ting)?\s+(?:myself|yourself|wrists?))\b/i,
  /\b(?:encourage|promote|glorif(?:y|ying))\s+(?:suicide|self[\s-]?harm)\b/i,
];

// ── Category: Illegal Activities ─────────────────────────────────────────
const ILLEGAL_PATTERNS = [
  /\b(?:how\s+to\s+(?:make|build|create|construct)\s+(?:a\s+)?(?:bomb|explosive|weapon|meth|cocaine|heroin|fentanyl))\b/i,
  /\b(?:terrorist\s+(?:attack|bomb|plot|manual)|bioweapon|chemical\s+weapon)\b/i,
  /\b(?:drug\s+(?:recipe|synthesis|manufacturing|cook(?:ing)?))\b/i,
  /\b(?:ricin|anthrax|sarin|vx\s+gas|nerve\s+agent)\s+(?:recipe|synthesis|how\s+to)\b/i,
];

// ── Combined moderation function ─────────────────────────────────────────

/**
 * Moderate content for prohibited material
 * @param {string} text - The text to check
 * @param {string} context - 'chat' | 'image' | 'video' — stricter for media generation
 * @returns {{ severity: string, category: string|null, message: string|null }}
 */
export function moderateContent(text, context = 'chat') {
  if (!text || typeof text !== 'string') return { severity: SEVERITY.CLEAN, category: null, message: null };
  
  const normalizedText = text.toLowerCase().trim();
  
  // Skip very short texts that can't realistically contain violations
  if (normalizedText.length < 3) return { severity: SEVERITY.CLEAN, category: null, message: null };

  // ── CSAM is always an immediate block (highest priority) ──
  if (CHILD_SAFETY_PATTERNS.some(p => p.test(normalizedText))) {
    return {
      severity: SEVERITY.BLOCK,
      category: 'child_safety',
      message: '🚫 This request has been blocked. Content involving minors in sexual or exploitative contexts is strictly prohibited and illegal. This incident may be reported.',
    };
  }

  // ── Sexual / Pornographic ──
  if (SEXUAL_PATTERNS.some(p => p.test(normalizedText))) {
    return {
      severity: SEVERITY.BLOCK,
      category: 'sexual_content',
      message: '🚫 This request has been blocked. SoulPrint does not generate sexually explicit, pornographic, or NSFW content. Please rephrase your request.',
    };
  }

  // ── Extreme Violence / Gore ──
  if (VIOLENCE_PATTERNS.some(p => p.test(normalizedText))) {
    return {
      severity: SEVERITY.BLOCK,
      category: 'violence',
      message: '🚫 This request has been blocked. SoulPrint does not generate content depicting extreme violence, gore, or graphic harm. Please rephrase your request.',
    };
  }

  // ── Hate Speech ──
  if (HATE_SPEECH_PATTERNS.some(p => p.test(normalizedText))) {
    return {
      severity: SEVERITY.BLOCK,
      category: 'hate_speech',
      message: '🚫 This request has been blocked. SoulPrint does not generate content containing hate speech, slurs, or content promoting discrimination. Please rephrase your request.',
    };
  }

  // ── Self-Harm / Suicide ──
  if (SELF_HARM_PATTERNS.some(p => p.test(normalizedText))) {
    return {
      severity: SEVERITY.BLOCK,
      category: 'self_harm',
      message: '🚫 This request has been blocked. If you or someone you know is struggling, please reach out to the 988 Suicide & Crisis Lifeline (call or text 988) or visit https://988lifeline.org for help.',
    };
  }

  // ── Illegal Activities ──
  if (ILLEGAL_PATTERNS.some(p => p.test(normalizedText))) {
    return {
      severity: SEVERITY.BLOCK,
      category: 'illegal_activity',
      message: '🚫 This request has been blocked. SoulPrint does not provide instructions for illegal activities, weapons manufacturing, or drug synthesis.',
    };
  }

  return { severity: SEVERITY.CLEAN, category: null, message: null };
}

/**
 * Quick check — returns true if content is safe, false if blocked
 */
export function isContentSafe(text, context = 'chat') {
  const result = moderateContent(text, context);
  return result.severity === SEVERITY.CLEAN;
}

/**
 * Moderate specifically for image/video prompts — stricter context
 * Also checks enhanced prompts that might have been generated by LLM refinement
 */
export function moderateMediaPrompt(prompt) {
  return moderateContent(prompt, 'image');
}

export { SEVERITY };
