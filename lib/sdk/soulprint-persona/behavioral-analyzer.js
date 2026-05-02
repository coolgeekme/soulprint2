/**
 * Behavioral Analyzer — Derives personality axes from raw text messages.
 *
 * For users who haven't completed a formal assessment, this module
 * "mines" their communication style from message history to produce
 * approximate persona axes.
 *
 * Pure function: takes an array of strings, returns axis scores.
 * No database, no network, no side effects.
 *
 * Zero dependencies. Pure JavaScript.
 */

import { DEFAULT_AXES } from './persona-axes.js';

// ═══════════════════════════════════════════════════════════════════════════════
// WORD LISTS — Behavioral signal detectors
// ═══════════════════════════════════════════════════════════════════════════════

const SLANG_WORDS = [
  'lol', 'lmao', 'bruh', 'nah', 'yeah', 'gonna', 'wanna', 'gotta',
  'tbh', 'imo', 'smh', 'fr', 'bet', 'lowkey', 'highkey', 'vibe', 'flex',
];

const FORMAL_WORDS = [
  'however', 'furthermore', 'therefore', 'regarding', 'additionally',
  'consequently', 'nevertheless', 'accordingly', 'subsequently',
];

const ASSERTIVE_WORDS = [
  'need', 'must', 'should', 'require', 'expect',
  'demand', 'insist', 'definitely', 'absolutely',
];

const SOFT_WORDS = [
  'maybe', 'perhaps', 'might', 'could', 'possibly',
  'wondering', 'sorry', 'just', 'please',
];

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

/**
 * Analyze an array of user messages to derive persona axes.
 *
 * @param {string[]} messages - Array of raw message strings from the user
 * @param {object} [options]
 * @param {number} [options.minMessages=5] - Minimum messages needed for reliable analysis
 * @returns {{ axes: Object<string, number>, messageCount: number, confidence: string, source: string } | null}
 *   Returns null if not enough messages to analyze.
 */
export function analyzeMessages(messages, options = {}) {
  const minMessages = options.minMessages || 5;

  if (!Array.isArray(messages) || messages.length < minMessages) {
    return null; // Not enough data for reliable analysis
  }

  let totalLength = 0;
  let emojiCount = 0;
  let exclamationCount = 0;
  let questionCount = 0;
  let slangCount = 0;
  let formalCount = 0;
  let shortMessages = 0;
  let longMessages = 0;
  let assertiveCount = 0;
  let softCount = 0;

  for (const msg of messages) {
    if (typeof msg !== 'string') continue;
    const text = msg.toLowerCase();
    const len = text.length;
    totalLength += len;

    if (len < 30) shortMessages++;
    if (len > 200) longMessages++;

    emojiCount += (text.match(EMOJI_REGEX) || []).length;
    exclamationCount += (text.match(/!/g) || []).length;
    questionCount += (text.match(/\?/g) || []).length;

    for (const w of SLANG_WORDS) { if (text.includes(w)) slangCount++; }
    for (const w of FORMAL_WORDS) { if (text.includes(w)) formalCount++; }
    for (const w of ASSERTIVE_WORDS) { if (text.includes(w)) assertiveCount++; }
    for (const w of SOFT_WORDS) { if (text.includes(w)) softCount++; }
  }

  const n = messages.length;
  const avgLength = totalLength / n;
  const emojiRate = emojiCount / n;
  const exclamationRate = exclamationCount / n;
  const questionRate = questionCount / n;
  const shortRatio = shortMessages / n;

  // ── Derive axes from behavioral signals ──
  const axes = { ...DEFAULT_AXES };

  // Directness: Short messages + assertive words + low soft words
  axes.directness = clamp(50 + (shortRatio * 30) + (assertiveCount / n * 20) - (softCount / n * 15));

  // Warmth: Emojis + exclamations + soft language
  axes.warmth = clamp(50 + (emojiRate * 15) + (exclamationRate * 10) + (softCount / n * 10) - (formalCount / n * 10));

  // Humor: Slang + emojis + exclamations
  axes.humor = clamp(40 + (slangCount / n * 20) + (emojiRate * 10) + (exclamationRate * 8));

  // Challenge: Assertive words - soft words
  axes.challenge = clamp(40 + (assertiveCount / n * 20) - (softCount / n * 15) + (questionRate * 5));

  // Detail: Average message length
  axes.detail = clamp(avgLength > 150 ? 75 : avgLength > 80 ? 60 : avgLength > 40 ? 45 : 30);

  // Formality: Formal words - slang
  axes.formality = clamp(50 + (formalCount / n * 20) - (slangCount / n * 15) - (emojiRate * 10));

  // Emotional depth: Longer messages + questions
  axes.emotionalDepth = clamp(45 + (avgLength > 100 ? 15 : 0) + (questionRate * 10) + (softCount / n * 8));

  // Pace: Short messages = fast pace
  axes.pace = clamp(50 + (shortRatio * 25) - (longMessages / n * 15));

  // Expressiveness: Emojis + exclamations + slang
  axes.expressiveness = clamp(45 + (emojiRate * 15) + (exclamationRate * 10) + (slangCount / n * 10));

  // Autonomy: Assertive signals
  axes.autonomy = clamp(50 + (assertiveCount / n * 15) - (questionRate * 8));

  // Determine confidence level based on sample size
  let confidence = 'low';
  if (n >= 100) confidence = 'high';
  else if (n >= 30) confidence = 'medium';

  return {
    axes,
    messageCount: n,
    avgMessageLength: Math.round(avgLength),
    confidence,
    source: 'behavioral_analysis',
    signals: {
      emojiRate: Math.round(emojiRate * 100) / 100,
      exclamationRate: Math.round(exclamationRate * 100) / 100,
      questionRate: Math.round(questionRate * 100) / 100,
      shortRatio: Math.round(shortRatio * 100) / 100,
      slangDensity: Math.round(slangCount / n * 100) / 100,
      formalDensity: Math.round(formalCount / n * 100) / 100,
      assertiveDensity: Math.round(assertiveCount / n * 100) / 100,
      softDensity: Math.round(softCount / n * 100) / 100,
    },
  };
}

function clamp(val) {
  return Math.round(Math.min(100, Math.max(0, val)));
}
