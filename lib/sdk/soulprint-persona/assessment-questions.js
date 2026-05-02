/**
 * Assessment Questions — The complete question set for measuring personality dimensions.
 *
 * Includes:
 * - 36 slider questions (0-100 spectrum) across 6 pillars
 * - 12 quick-start multiple-choice questions (layered assessment)
 * - Layer 2 adaptive follow-ups based on Layer 1 answers
 * - Layer 3 behavioral validation questions for in-conversation calibration
 *
 * Zero dependencies. Pure JavaScript.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 36 SLIDER QUESTIONS — Each maps to a 0-100 spectrum
// Organized by 6 pillars, 6 questions each
// ═══════════════════════════════════════════════════════════════════════════════

export const SLIDER_QUESTIONS = [
  // ── Communication (6) ──
  { id: 'comm_1', pillar: 'communication', order: 1,
    question: 'When sharing something important, I prefer to...',
    leftLabel: 'Write it out', rightLabel: 'Talk it through', emoji: '💬' },
  { id: 'comm_2', pillar: 'communication', order: 2,
    question: 'When someone misunderstands me, I tend to...',
    leftLabel: 'Patiently re-explain', rightLabel: 'Get frustrated', emoji: '🔄' },
  { id: 'comm_3', pillar: 'communication', order: 3,
    question: 'When explaining complex ideas, I lean toward...',
    leftLabel: 'Simple analogies', rightLabel: 'Detailed breakdowns', emoji: '🧩' },
  { id: 'comm_4', pillar: 'communication', order: 4,
    question: 'My style of giving feedback is usually...',
    leftLabel: 'Very diplomatic', rightLabel: 'Very direct', emoji: '🎯' },
  { id: 'comm_5', pillar: 'communication', order: 5,
    question: 'I prefer receiving updates and information...',
    leftLabel: 'In writing / async', rightLabel: 'Verbally / in-person', emoji: '📨' },
  { id: 'comm_6', pillar: 'communication', order: 6,
    question: 'In group discussions, I usually...',
    leftLabel: 'Listen first, then speak', rightLabel: 'Speak up right away', emoji: '👥' },

  // ── Emotional Intelligence (6) ──
  { id: 'emo_1', pillar: 'emotional_intelligence', order: 7,
    question: 'When feeling overwhelmed, I tend to...',
    leftLabel: 'Withdraw & recharge alone', rightLabel: 'Seek out support', emoji: '🔋' },
  { id: 'emo_2', pillar: 'emotional_intelligence', order: 8,
    question: 'After a disappointment, I usually...',
    leftLabel: 'Move on quickly', rightLabel: 'Reflect deeply on it', emoji: '💭' },
  { id: 'emo_3', pillar: 'emotional_intelligence', order: 9,
    question: 'At work, I manage my emotions by...',
    leftLabel: 'Compartmentalizing', rightLabel: 'Expressing authentically', emoji: '🎭' },
  { id: 'emo_4', pillar: 'emotional_intelligence', order: 10,
    question: 'When others are going through difficulty, I...',
    leftLabel: 'Give them space', rightLabel: 'Actively reach out', emoji: '🤝' },
  { id: 'emo_5', pillar: 'emotional_intelligence', order: 11,
    question: 'My preferred way to recharge is...',
    leftLabel: 'Physical / solo activity', rightLabel: 'Social connection', emoji: '⚡' },
  { id: 'emo_6', pillar: 'emotional_intelligence', order: 12,
    question: 'When I feel misunderstood by others, I...',
    leftLabel: 'Work to prove myself', rightLabel: 'Accept it & move on', emoji: '🪞' },

  // ── Decision Making (6) ──
  { id: 'dec_1', pillar: 'decision_making', order: 13,
    question: 'When facing major decisions, I am...',
    leftLabel: 'Quick & decisive', rightLabel: 'Thorough & deliberate', emoji: '⚖️' },
  { id: 'dec_2', pillar: 'decision_making', order: 14,
    question: 'I rely more on...',
    leftLabel: 'Logic & data', rightLabel: 'Gut feeling & intuition', emoji: '🧠' },
  { id: 'dec_3', pillar: 'decision_making', order: 15,
    question: 'When there\'s no clear right answer, I...',
    leftLabel: 'Choose fast & adapt', rightLabel: 'Gather more information', emoji: '🔍' },
  { id: 'dec_4', pillar: 'decision_making', order: 16,
    question: 'After making a wrong decision, I...',
    leftLabel: 'Am hard on myself', rightLabel: 'Learn and move on', emoji: '📈' },
  { id: 'dec_5', pillar: 'decision_making', order: 17,
    question: 'The amount of info I need before deciding is...',
    leftLabel: 'Just enough to act', rightLabel: 'As much as possible', emoji: '📊' },
  { id: 'dec_6', pillar: 'decision_making', order: 18,
    question: 'For decisions that affect others, I prefer...',
    leftLabel: 'My own judgment', rightLabel: 'Collective input', emoji: '🗳️' },

  // ── Social Dynamics (6) ──
  { id: 'soc_1', pillar: 'social_dynamics', order: 19,
    question: 'In a room full of strangers, I tend to...',
    leftLabel: 'Observe from the edges', rightLabel: 'Dive right in', emoji: '🚪' },
  { id: 'soc_2', pillar: 'social_dynamics', order: 20,
    question: 'When it comes to building trust, I...',
    leftLabel: 'Trust slowly over time', rightLabel: 'Trust freely upfront', emoji: '🔐' },
  { id: 'soc_3', pillar: 'social_dynamics', order: 21,
    question: 'When there\'s conflict with someone close, I...',
    leftLabel: 'Avoid confrontation', rightLabel: 'Address it directly', emoji: '⚔️' },
  { id: 'soc_4', pillar: 'social_dynamics', order: 22,
    question: 'In a team setting, I naturally...',
    leftLabel: 'Support & follow', rightLabel: 'Lead & direct', emoji: '🏁' },
  { id: 'soc_5', pillar: 'social_dynamics', order: 23,
    question: 'My approach to relationships is...',
    leftLabel: 'Few deep connections', rightLabel: 'Many broad connections', emoji: '🌐' },
  { id: 'soc_6', pillar: 'social_dynamics', order: 24,
    question: 'When someone breaks my trust, I...',
    leftLabel: 'Find it hard to forgive', rightLabel: 'Can forgive easily', emoji: '💔' },

  // ── Cognitive Style (6) ──
  { id: 'cog_1', pillar: 'cognitive_style', order: 25,
    question: 'When tackling new challenges, I prefer a...',
    leftLabel: 'Structured plan', rightLabel: 'Flexible improvisation', emoji: '🗺️' },
  { id: 'cog_2', pillar: 'cognitive_style', order: 26,
    question: 'I naturally gravitate toward...',
    leftLabel: 'Big-picture thinking', rightLabel: 'Details & execution', emoji: '🔭' },
  { id: 'cog_3', pillar: 'cognitive_style', order: 27,
    question: 'When learning something new, I prefer to...',
    leftLabel: 'Jump in and try it', rightLabel: 'Study the theory first', emoji: '📚' },
  { id: 'cog_4', pillar: 'cognitive_style', order: 28,
    question: 'My ideal work environment is...',
    leftLabel: 'Quiet & independent', rightLabel: 'Dynamic & collaborative', emoji: '🏢' },
  { id: 'cog_5', pillar: 'cognitive_style', order: 29,
    question: 'I know I truly understand something when I can...',
    leftLabel: 'Explain it to others', rightLabel: 'Apply it practically', emoji: '✅' },
  { id: 'cog_6', pillar: 'cognitive_style', order: 30,
    question: 'When facing information overload, I...',
    leftLabel: 'Prioritize ruthlessly', rightLabel: 'Process systematically', emoji: '🗂️' },

  // ── Assertiveness (6) ──
  { id: 'assert_1', pillar: 'assertiveness', order: 31,
    question: 'Saying "no" to others is...',
    leftLabel: 'Easy for me', rightLabel: 'Difficult for me', emoji: '🚫' },
  { id: 'assert_2', pillar: 'assertiveness', order: 32,
    question: 'When I believe in something, I am...',
    leftLabel: 'Firm & unyielding', rightLabel: 'Flexible & adaptive', emoji: '⛰️' },
  { id: 'assert_3', pillar: 'assertiveness', order: 33,
    question: 'When my ideas are dismissed, I...',
    leftLabel: 'Push harder for them', rightLabel: 'Let it go gracefully', emoji: '💡' },
  { id: 'assert_4', pillar: 'assertiveness', order: 34,
    question: 'When asking for what I need, I am...',
    leftLabel: 'Direct & upfront', rightLabel: 'Subtle & indirect', emoji: '🎤' },
  { id: 'assert_5', pillar: 'assertiveness', order: 35,
    question: 'When I\'m right but others disagree, I...',
    leftLabel: 'Stand my ground alone', rightLabel: 'Seek consensus first', emoji: '🧭' },
  { id: 'assert_6', pillar: 'assertiveness', order: 36,
    question: 'My approach to personal boundaries is...',
    leftLabel: 'Strict & clear', rightLabel: 'Flexible & situational', emoji: '🛡️' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK-START LAYERED ASSESSMENT — 12 multiple-choice questions
// Designed for rapid onboarding (< 2 minutes)
// ═══════════════════════════════════════════════════════════════════════════════

export const LAYERED_ASSESSMENT = {
  layer1: [
    { id: 'comm_explain', category: 'communication',
      question: 'When you need to explain something important, you naturally:',
      options: [
        { value: 'write', label: 'Write it out first' },
        { value: 'talk', label: 'Talk it through' },
        { value: 'visual', label: 'Use visuals/examples' },
        { value: 'mix', label: 'Mix of all three' },
      ] },
    { id: 'comm_feedback', category: 'communication',
      question: 'When giving feedback to someone, you tend to be:',
      options: [
        { value: 'direct', label: 'Direct and to the point' },
        { value: 'diplomatic', label: 'Diplomatic and gentle' },
        { value: 'sandwich', label: 'Start with positives first' },
        { value: 'depends', label: 'Depends on the person' },
      ] },
    { id: 'emotion_stress', category: 'emotional_intelligence',
      question: "When you're stressed, you tend to:",
      options: [
        { value: 'space', label: 'Want space to think' },
        { value: 'talk', label: 'Talk it out' },
        { value: 'distraction', label: 'Dive into work/distraction' },
        { value: 'reassurance', label: 'Need reassurance' },
      ] },
    { id: 'emotion_disappointment', category: 'emotional_intelligence',
      question: 'How do you typically handle disappointment?',
      options: [
        { value: 'process_quick', label: 'Process internally, move on quickly' },
        { value: 'sit_with', label: 'Need time to sit with it' },
        { value: 'analyze', label: 'Analyze what went wrong' },
        { value: 'talk_through', label: 'Talk through it with someone' },
      ] },
    { id: 'decision_approach', category: 'decision_making',
      question: 'When facing a big decision, you:',
      options: [
        { value: 'gut', label: 'Trust your gut immediately' },
        { value: 'research', label: 'Research extensively first' },
        { value: 'opinions', label: 'Seek multiple opinions' },
        { value: 'blend', label: 'Blend intuition + data' },
      ] },
    { id: 'decision_options', category: 'decision_making',
      question: "You'd rather have:",
      options: [
        { value: 'three_clear', label: '3 great options with clear pros/cons' },
        { value: 'all_options', label: 'All possible options to evaluate' },
        { value: 'one_recommended', label: 'One recommended option with reasoning' },
        { value: 'framework', label: 'Framework to decide myself' },
      ] },
    { id: 'work_feedback', category: 'work_style',
      question: 'Your ideal feedback is:',
      options: [
        { value: 'direct', label: 'Direct and immediate' },
        { value: 'thoughtful', label: 'Thoughtful and detailed' },
        { value: 'sandwich', label: 'Sandwich approach (positive/negative/positive)' },
        { value: 'data_driven', label: 'Data-driven with examples' },
      ] },
    { id: 'work_productivity', category: 'work_style',
      question: "You're most productive when:",
      options: [
        { value: 'solo', label: 'Working independently' },
        { value: 'collaborative', label: 'Collaborating with others' },
        { value: 'mix', label: 'Alternating between both' },
        { value: 'depends', label: 'Depends on the task' },
      ] },
    { id: 'values_priority', category: 'values',
      question: 'In your work, what matters most to you?',
      options: [
        { value: 'impact', label: 'Making a meaningful impact' },
        { value: 'growth', label: 'Personal growth and learning' },
        { value: 'stability', label: 'Stability and security' },
        { value: 'freedom', label: 'Freedom and autonomy' },
      ] },
    { id: 'values_success', category: 'values',
      question: 'How do you define success?',
      options: [
        { value: 'achievement', label: 'Achieving specific goals' },
        { value: 'fulfillment', label: 'Feeling fulfilled daily' },
        { value: 'recognition', label: 'Being recognized for my work' },
        { value: 'balance', label: 'Having work-life balance' },
      ] },
    { id: 'relationship_support', category: 'relationships',
      question: 'When someone you care about is struggling, you:',
      options: [
        { value: 'listen', label: 'Listen and let them vent' },
        { value: 'solve', label: 'Try to help solve the problem' },
        { value: 'comfort', label: 'Offer comfort and reassurance' },
        { value: 'ask', label: 'Ask what they need from you' },
      ] },
    { id: 'relationship_conflict', category: 'relationships',
      question: 'In conflicts, you typically:',
      options: [
        { value: 'address', label: 'Address it directly and quickly' },
        { value: 'avoid', label: 'Avoid until things cool down' },
        { value: 'compromise', label: 'Look for a compromise' },
        { value: 'reflect', label: 'Reflect before responding' },
      ] },
  ],

  // Layer 3: In-conversation behavioral validation
  validations: [
    { id: 'detail_check', trigger: 'after_detailed_response',
      question: 'Was that too much detail or about right?',
      options: ['Too much', 'About right', 'Could use more'] },
    { id: 'directness_check', trigger: 'after_direct_response',
      question: 'Too blunt or just right?',
      options: ['Too blunt', 'Just right', 'Could be more direct'] },
    { id: 'options_check', trigger: 'after_options',
      question: 'Helpful to see options, or would you rather I just recommend one?',
      options: ['Options are helpful', 'Just recommend one'] },
    { id: 'level_check', trigger: 'after_technical',
      question: 'Am I pitching this at the right level?',
      options: ['Too simple', 'Just right', 'Too complex'] },
    { id: 'length_check', trigger: 'after_long_response',
      question: 'Should I keep responses shorter?',
      options: ['Yes, shorter please', 'This length is good', 'Go even deeper'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Get questions for a specific pillar
// ═══════════════════════════════════════════════════════════════════════════════

export function getQuestionsForPillar(pillar) {
  return SLIDER_QUESTIONS.filter(q => q.pillar === pillar);
}

export function getPillars() {
  return [...new Set(SLIDER_QUESTIONS.map(q => q.pillar))];
}
