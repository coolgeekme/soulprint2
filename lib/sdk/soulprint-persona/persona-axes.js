/**
 * SoulPrint Persona Axes — The 10 tunable dimensions of AI personality.
 *
 * Each axis is a 0-100 spectrum that controls a specific behavioral dimension
 * of the AI's communication style. Together, they create a unique "personality
 * fingerprint" for each user.
 *
 * Zero dependencies. Pure JavaScript.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT AXIS VALUES (Neutral Baseline)
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_AXES = {
  directness: 50,        // 0=diplomatic/gentle, 100=blunt/no-filter
  warmth: 60,            // 0=clinical/detached, 100=warm/nurturing
  humor: 40,             // 0=serious/professional, 100=playful/witty
  challenge: 40,         // 0=always agrees, 100=pushes back hard
  detail: 50,            // 0=brief/concise, 100=thorough/in-depth
  formality: 40,         // 0=casual/slang, 100=formal/professional
  emotionalDepth: 50,    // 0=surface-level, 100=deep emotional reads
  pace: 50,              // 0=slow/measured, 100=fast/punchy
  autonomy: 50,          // 0=asks permission, 100=takes initiative
  expressiveness: 50,    // 0=reserved, 100=expressive/animated
};

// ═══════════════════════════════════════════════════════════════════════════════
// AXIS METADATA — Human-readable descriptions for each axis
// ═══════════════════════════════════════════════════════════════════════════════

export const AXIS_METADATA = {
  directness: {
    name: 'Directness',
    low: 'Diplomatic & gentle',
    high: 'Blunt & no-filter',
    description: 'How directly the AI communicates — easing into topics vs. cutting straight to the point.',
    sources: ['Interpersonal Circumplex (Leary, 1957)', 'High/Low Context Communication (Hall, 1976)', 'DISC Model — Dominance dimension'],
  },
  warmth: {
    name: 'Warmth',
    low: 'Clinical & detached',
    high: 'Warm & nurturing',
    description: 'The emotional temperature of the AI — professional distance vs. genuine personal care.',
    sources: ['Interpersonal Circumplex — Communion axis (Wiggins, 1979)', 'Stereotype Content Model (Fiske et al., 2002)', 'Big Five — Agreeableness'],
  },
  humor: {
    name: 'Humor',
    low: 'Serious & professional',
    high: 'Playful & witty',
    description: 'How much levity and wit the AI brings to conversations.',
    sources: ['Humor Styles Questionnaire (Martin et al., 2003)', 'Big Five — Extraversion facet (positive emotions)'],
  },
  challenge: {
    name: 'Challenge',
    low: 'Always agrees',
    high: 'Pushes back hard',
    description: 'Whether the AI validates or challenges the user\'s thinking.',
    sources: ['Socratic Method', 'Productive Conflict Theory (Lencioni, 2002)', 'Intellectual Humility research'],
  },
  detail: {
    name: 'Detail',
    low: 'Brief & concise',
    high: 'Thorough & in-depth',
    description: 'Response depth — quick answers vs. comprehensive explanations.',
    sources: ['Cognitive Load Theory (Sweller, 1988)', 'Big Five — Conscientiousness facet (thoroughness)'],
  },
  formality: {
    name: 'Formality',
    low: 'Casual & slangy',
    high: 'Formal & professional',
    description: 'The register of the AI\'s language — friend texting vs. business email.',
    sources: ['Register Theory (Joos, 1961)', 'Politeness Theory (Brown & Levinson, 1987)', 'Sociolinguistic code-switching'],
  },
  emotionalDepth: {
    name: 'Emotional Depth',
    low: 'Surface-level',
    high: 'Deep emotional reads',
    description: 'How much the AI reads between the lines and names emotional undercurrents.',
    sources: ['Emotional Intelligence (Salovey & Mayer, 1990; Goleman, 1995)', 'Alexithymia spectrum', 'Attachment Theory (Bowlby, 1969)'],
  },
  pace: {
    name: 'Pace',
    low: 'Slow & measured',
    high: 'Fast & punchy',
    description: 'The rhythm of responses — leisurely paragraphs vs. rapid-fire delivery.',
    sources: ['Communication Accommodation Theory (Giles, 1973)', 'Cognitive tempo research'],
  },
  autonomy: {
    name: 'Autonomy',
    low: 'Asks permission first',
    high: 'Takes initiative',
    description: 'Whether the AI waits for explicit instructions or proactively anticipates needs.',
    sources: ['Self-Determination Theory (Deci & Ryan, 1985)', 'Locus of Control (Rotter, 1966)', 'Interpersonal Circumplex — Agency axis'],
  },
  expressiveness: {
    name: 'Expressiveness',
    low: 'Reserved & understated',
    high: 'Expressive & animated',
    description: 'How emotionally expressive the AI\'s language is — understated vs. vivid.',
    sources: ['Big Five — Extraversion', 'Emotional Expressivity (Kring et al., 1994)', 'Social Penetration Theory (Altman & Taylor, 1973)'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PILLAR → AXIS MAPPINGS
// Maps assessment dimensions (pillars) to persona axes with weights.
// The 6 assessment pillars represent psychological domains that are measured
// via questions; these weights determine how each domain influences the AI.
// ═══════════════════════════════════════════════════════════════════════════════

export const PILLAR_TO_AXIS_MAP = {
  communication: {
    directness: 0.4,
    formality: 0.3,
    detail: 0.2,
    pace: 0.1,
  },
  emotional_intelligence: {
    warmth: 0.4,
    emotionalDepth: 0.4,
    expressiveness: 0.2,
  },
  decision_making: {
    autonomy: 0.3,
    challenge: 0.2,
    detail: 0.3,
    pace: 0.2,
  },
  social_dynamics: {
    warmth: 0.2,
    humor: 0.3,
    expressiveness: 0.3,
    formality: 0.2,
  },
  cognitive_style: {
    detail: 0.3,
    pace: 0.2,
    formality: 0.2,
    autonomy: 0.3,
  },
  assertiveness: {
    directness: 0.4,
    challenge: 0.4,
    autonomy: 0.2,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER OVERRIDE DIAL MAPPINGS
// Maps the 4 simplified user-facing dials back to the 10 internal axes.
// This allows users to "tune" their AI without understanding the full system.
// ═══════════════════════════════════════════════════════════════════════════════

export const OVERRIDE_DIAL_MAP = {
  directness: {
    directness: { weight: 0.7 },
    formality: { weight: 0.7, invert: true },  // Higher directness → lower formality
  },
  warmth: {
    warmth: { weight: 0.6 },
    emotionalDepth: { weight: 0.5 },
    expressiveness: { weight: 0.5 },
  },
  playfulness: {
    humor: { weight: 0.7 },
    pace: { weight: 0.5 },
  },
  challenge: {
    challenge: { weight: 0.7 },
    autonomy: { weight: 0.5 },
  },
};
