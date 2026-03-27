/**
 * Assessment Data — Seed Questions, Layered Assessment, Profile Calculations
 * Extracted from the main catch-all route.js for maintainability.
 */

// ============================================================
// SEED DATA - 36 QUESTIONS
// ============================================================
const SEED_QUESTIONS = [
  // COMMUNICATION (6)
  { pillar: 'communication', order_index: 1, question_text: 'When you need to share something important with someone, do you prefer to write it out or talk face-to-face?' },
  { pillar: 'communication', order_index: 2, question_text: 'How do you typically respond when someone misunderstands you?' },
  { pillar: 'communication', order_index: 3, question_text: 'Describe how you usually explain a complex idea to someone who is hearing it for the first time.' },
  { pillar: 'communication', order_index: 4, question_text: 'When giving feedback, how direct are you — and why?' },
  { pillar: 'communication', order_index: 5, question_text: 'How do you prefer to receive important news or updates from people you work with?' },
  { pillar: 'communication', order_index: 6, question_text: 'In a group discussion, how do you tend to contribute — and how do you feel when others dominate the conversation?' },
  // EMOTIONAL INTELLIGENCE (6)
  { pillar: 'emotional_intelligence', order_index: 7, question_text: 'When you feel overwhelmed, what is your first instinct — and does it actually help?' },
  { pillar: 'emotional_intelligence', order_index: 8, question_text: 'How do you typically process a major disappointment or setback?' },
  { pillar: 'emotional_intelligence', order_index: 9, question_text: 'Describe a time you had to manage your emotions in a high-stakes professional setting.' },
  { pillar: 'emotional_intelligence', order_index: 10, question_text: 'How do you generally respond when someone else is going through something difficult emotionally?' },
  { pillar: 'emotional_intelligence', order_index: 11, question_text: 'What does self-care actually look like for you — not what it should look like, but what you actually do?' },
  { pillar: 'emotional_intelligence', order_index: 12, question_text: 'How do you handle situations where you feel misunderstood or underestimated?' },
  // DECISION MAKING (6)
  { pillar: 'decision_making', order_index: 13, question_text: 'When faced with a major decision, walk me through your actual process — from the moment you realize a choice needs to be made.' },
  { pillar: 'decision_making', order_index: 14, question_text: 'How do you balance logic and gut feeling when making important choices?' },
  { pillar: 'decision_making', order_index: 15, question_text: 'Describe how you handle situations where there is no clear right answer.' },
  { pillar: 'decision_making', order_index: 16, question_text: 'How do you respond internally and externally when you realize you made the wrong decision?' },
  { pillar: 'decision_making', order_index: 17, question_text: 'How much information do you need before you feel comfortable committing to a decision?' },
  { pillar: 'decision_making', order_index: 18, question_text: 'How do you approach decisions that significantly affect other people?' },
  // SOCIAL DYNAMICS (6)
  { pillar: 'social_dynamics', order_index: 19, question_text: 'How do you navigate a room full of people you do not know — what is your actual strategy?' },
  { pillar: 'social_dynamics', order_index: 20, question_text: 'What does trust mean to you in a relationship, and how do you know when you have it?' },
  { pillar: 'social_dynamics', order_index: 21, question_text: 'How do you handle conflict with someone you are close to?' },
  { pillar: 'social_dynamics', order_index: 22, question_text: 'What role do you typically play in a team — and is that the role you want to play?' },
  { pillar: 'social_dynamics', order_index: 23, question_text: 'How do you maintain long-term relationships when life gets busy?' },
  { pillar: 'social_dynamics', order_index: 24, question_text: 'How do you react — internally and externally — when someone breaks your trust?' },
  // COGNITIVE STYLE (6)
  { pillar: 'cognitive_style', order_index: 25, question_text: 'How do you organize your thoughts when facing a brand new challenge you have never dealt with before?' },
  { pillar: 'cognitive_style', order_index: 26, question_text: 'Do you prefer working with abstract concepts and big ideas, or concrete details and execution — and why?' },
  { pillar: 'cognitive_style', order_index: 27, question_text: 'How do you approach learning something entirely new and unfamiliar?' },
  { pillar: 'cognitive_style', order_index: 28, question_text: 'Describe your ideal environment for deep, focused work.' },
  { pillar: 'cognitive_style', order_index: 29, question_text: 'How do you know when you have truly understood something — not just memorized it?' },
  { pillar: 'cognitive_style', order_index: 30, question_text: 'How do you handle information overload when everything feels equally urgent?' },
  // ASSERTIVENESS (6)
  { pillar: 'assertiveness', order_index: 31, question_text: 'How comfortable are you with saying no — and what makes it easier or harder for you?' },
  { pillar: 'assertiveness', order_index: 32, question_text: 'Describe a situation where you had to stand your ground against strong opposition.' },
  { pillar: 'assertiveness', order_index: 33, question_text: 'How do you react when someone dismisses or minimizes your ideas?' },
  { pillar: 'assertiveness', order_index: 34, question_text: 'How do you ask for what you need — in relationships, at work, or in life generally?' },
  { pillar: 'assertiveness', order_index: 35, question_text: 'How do you handle situations where you know you are right but others strongly disagree?' },
  { pillar: 'assertiveness', order_index: 36, question_text: 'What does setting boundaries mean to you — and where do you struggle with it most?' },
];

// ============================================================
// LAYERED ASSESSMENT (Quick Start) - Layer 1 Core Questions
// ============================================================
const LAYERED_ASSESSMENT_QUESTIONS = {
  layer1: [
    // Communication (2 questions)
    {
      id: 'comm_explain',
      category: 'communication',
      question: 'When you need to explain something important, you naturally:',
      options: [
        { value: 'write', label: 'Write it out first' },
        { value: 'talk', label: 'Talk it through' },
        { value: 'visual', label: 'Use visuals/examples' },
        { value: 'mix', label: 'Mix of all three' }
      ]
    },
    {
      id: 'comm_feedback',
      category: 'communication',
      question: 'When giving feedback to someone, you tend to be:',
      options: [
        { value: 'direct', label: 'Direct and to the point' },
        { value: 'diplomatic', label: 'Diplomatic and gentle' },
        { value: 'sandwich', label: 'Start with positives first' },
        { value: 'depends', label: 'Depends on the person' }
      ]
    },
    // Emotional Intelligence (2 questions)
    {
      id: 'emotion_stress',
      category: 'emotional_intelligence',
      question: 'When you\'re stressed, you tend to:',
      options: [
        { value: 'space', label: 'Want space to think' },
        { value: 'talk', label: 'Talk it out' },
        { value: 'distraction', label: 'Dive into work/distraction' },
        { value: 'reassurance', label: 'Need reassurance' }
      ]
    },
    {
      id: 'emotion_disappointment',
      category: 'emotional_intelligence',
      question: 'How do you typically handle disappointment?',
      options: [
        { value: 'process_quick', label: 'Process internally, move on quickly' },
        { value: 'sit_with', label: 'Need time to sit with it' },
        { value: 'analyze', label: 'Analyze what went wrong' },
        { value: 'talk_through', label: 'Talk through it with someone' }
      ]
    },
    // Decision Making (2 questions)
    {
      id: 'decision_approach',
      category: 'decision_making',
      question: 'When facing a big decision, you:',
      options: [
        { value: 'gut', label: 'Trust your gut immediately' },
        { value: 'research', label: 'Research extensively first' },
        { value: 'opinions', label: 'Seek multiple opinions' },
        { value: 'blend', label: 'Blend intuition + data' }
      ]
    },
    {
      id: 'decision_options',
      category: 'decision_making',
      question: 'You\'d rather have:',
      options: [
        { value: 'three_clear', label: '3 great options with clear pros/cons' },
        { value: 'all_options', label: 'All possible options to evaluate' },
        { value: 'one_recommended', label: 'One recommended option with reasoning' },
        { value: 'framework', label: 'Framework to decide myself' }
      ]
    },
    // Work Style (2 questions)
    {
      id: 'work_feedback',
      category: 'work_style',
      question: 'Your ideal feedback is:',
      options: [
        { value: 'direct', label: 'Direct and immediate' },
        { value: 'thoughtful', label: 'Thoughtful and detailed' },
        { value: 'sandwich', label: 'Sandwich approach (positive/negative/positive)' },
        { value: 'data_driven', label: 'Data-driven with examples' }
      ]
    },
    {
      id: 'work_productivity',
      category: 'work_style',
      question: 'You\'re most productive when:',
      options: [
        { value: 'solo', label: 'Working independently' },
        { value: 'collaborative', label: 'Collaborating with others' },
        { value: 'mix', label: 'Alternating between both' },
        { value: 'depends', label: 'Depends on the task' }
      ]
    },
    // Values (2 questions)
    {
      id: 'values_priority',
      category: 'values',
      question: 'In your work, what matters most to you?',
      options: [
        { value: 'impact', label: 'Making a meaningful impact' },
        { value: 'growth', label: 'Personal growth and learning' },
        { value: 'stability', label: 'Stability and security' },
        { value: 'freedom', label: 'Freedom and autonomy' }
      ]
    },
    {
      id: 'values_success',
      category: 'values',
      question: 'How do you define success?',
      options: [
        { value: 'achievement', label: 'Achieving specific goals' },
        { value: 'fulfillment', label: 'Feeling fulfilled daily' },
        { value: 'recognition', label: 'Being recognized for my work' },
        { value: 'balance', label: 'Having work-life balance' }
      ]
    },
    // Relationships (2 questions)
    {
      id: 'relationship_support',
      category: 'relationships',
      question: 'When someone you care about is struggling, you:',
      options: [
        { value: 'listen', label: 'Listen and let them vent' },
        { value: 'solve', label: 'Try to help solve the problem' },
        { value: 'comfort', label: 'Offer comfort and reassurance' },
        { value: 'ask', label: 'Ask what they need from you' }
      ]
    },
    {
      id: 'relationship_conflict',
      category: 'relationships',
      question: 'In conflicts, you typically:',
      options: [
        { value: 'address', label: 'Address it directly and quickly' },
        { value: 'avoid', label: 'Avoid until things cool down' },
        { value: 'compromise', label: 'Look for a compromise' },
        { value: 'reflect', label: 'Reflect before responding' }
      ]
    }
  ],
  // Layer 2: Smart Follow-ups based on Layer 1 answers
  layer2: {
    // Follow-ups for "Write it out first"
    'comm_explain:write': [
      {
        id: 'write_style',
        question: 'When you write, do you prefer to draft everything at once or build it piece by piece?',
        options: [
          { value: 'all_at_once', label: 'Draft everything at once' },
          { value: 'piece_by_piece', label: 'Build it piece by piece' }
        ]
      },
      {
        id: 'edit_style',
        question: 'Do you edit as you go or dump it all out first?',
        options: [
          { value: 'edit_as_go', label: 'Edit as I go' },
          { value: 'dump_first', label: 'Dump it all out first, then edit' }
        ]
      }
    ],
    // Follow-ups for stress response "Want space to think"
    'emotion_stress:space': [
      {
        id: 'space_duration',
        question: 'When you need space, how long before you\'re ready to engage again?',
        options: [
          { value: 'minutes', label: 'Minutes' },
          { value: 'hours', label: 'Hours' },
          { value: 'days', label: 'Days' }
        ]
      },
      {
        id: 'check_in',
        question: 'Should I check in on you or wait for you to come back?',
        options: [
          { value: 'check_in', label: 'Check in on me' },
          { value: 'wait', label: 'Wait for me to come back' }
        ]
      }
    ],
    // Follow-ups for "Research extensively first"
    'decision_approach:research': [
      {
        id: 'research_depth',
        question: 'How many sources do you typically want before feeling confident?',
        options: [
          { value: 'few', label: '2-3 solid sources' },
          { value: 'moderate', label: '5-7 sources' },
          { value: 'comprehensive', label: 'As many as possible' }
        ]
      },
      {
        id: 'research_style',
        question: 'Do you prefer curated research or broad exploration?',
        options: [
          { value: 'curated', label: 'Curated - give me the best' },
          { value: 'broad', label: 'Broad - let me explore' }
        ]
      }
    ],
    // Follow-ups for "Direct and immediate" feedback
    'feedback_style:direct': [
      {
        id: 'feedback_timing',
        question: 'Should I call out issues as I see them, or wait until you ask?',
        options: [
          { value: 'proactive', label: 'Call them out immediately' },
          { value: 'wait', label: 'Wait until I ask' }
        ]
      },
      {
        id: 'feedback_context',
        question: 'How much context do you want with criticism?',
        options: [
          { value: 'just_fix', label: 'Just the fix' },
          { value: 'with_why', label: 'The fix plus the why' }
        ]
      }
    ],
    // Follow-ups for "Talk it out" stress response
    'emotion_stress:talk': [
      {
        id: 'talk_preference',
        question: 'When you need to talk it out, do you want advice or just to vent?',
        options: [
          { value: 'advice', label: 'Give me advice' },
          { value: 'vent', label: 'Just let me vent' },
          { value: 'both', label: 'Ask me first' }
        ]
      }
    ],
    // Follow-ups for "Thoughtful and detailed" feedback
    'feedback_style:thoughtful': [
      {
        id: 'detail_level',
        question: 'How much detail do you actually want?',
        options: [
          { value: 'comprehensive', label: 'Everything - I want the full picture' },
          { value: 'moderate', label: 'Key points with supporting details' },
          { value: 'summary_plus', label: 'Summary with option to dive deeper' }
        ]
      }
    ]
  },
  // Layer 3: Behavioral Validation Questions (shown in chat)
  layer3_validations: [
    { id: 'detail_check', trigger: 'after_detailed_response', question: 'Was that too much detail or about right?', options: ['Too much', 'About right', 'Could use more'] },
    { id: 'directness_check', trigger: 'after_direct_response', question: 'Too blunt or just right?', options: ['Too blunt', 'Just right', 'Could be more direct'] },
    { id: 'options_check', trigger: 'after_options', question: 'Helpful to see options, or would you rather I just recommend one?', options: ['Options are helpful', 'Just recommend one'] },
    { id: 'level_check', trigger: 'after_technical', question: 'Am I pitching this at the right level?', options: ['Too simple', 'Just right', 'Too complex'] },
    { id: 'length_check', trigger: 'after_long_response', question: 'Should I keep responses shorter?', options: ['Yes, shorter please', 'This length is good', 'Go even deeper'] }
  ]
};

// Calculate communication profile from layered assessment
function calculateCommunicationProfile(responses) {
  const profile = {
    // Core dimensions (0-100 scale)
    directness: 50,
    emotional_warmth: 50,
    information_density: 50,
    proactivity: 50,
    
    // Specific preferences
    modality: 'mixed',
    feedback_style: 'balanced',
    decision_support: 'options',
    stress_response: 'space',
    
    // Confidence scores
    confidence: {
      communication: 0.5,
      emotional: 0.5,
      work_style: 0.5
    },
    
    // Raw answers for reference
    raw_answers: responses
  };
  
  // Calculate directness
  if (responses.feedback_style === 'direct') profile.directness = 85;
  else if (responses.feedback_style === 'data_driven') profile.directness = 70;
  else if (responses.feedback_style === 'thoughtful') profile.directness = 50;
  else if (responses.feedback_style === 'sandwich') profile.directness = 30;
  
  // Calculate emotional warmth based on AI personality slider
  if (responses.ai_personality !== undefined) {
    profile.emotional_warmth = responses.ai_personality;
  }
  
  // Calculate information density
  if (responses.comm_detail === 'read_all') profile.information_density = 90;
  else if (responses.comm_detail === 'skim') profile.information_density = 40;
  else if (responses.comm_detail === 'summarize') profile.information_density = 30;
  else if (responses.comm_detail === 'frustrated') profile.information_density = 20;
  
  // Calculate proactivity preference
  if (responses.feedback_timing === 'proactive') profile.proactivity = 80;
  else if (responses.feedback_timing === 'wait') profile.proactivity = 30;
  if (responses.check_in === 'check_in') profile.proactivity = Math.min(100, profile.proactivity + 20);
  else if (responses.check_in === 'wait') profile.proactivity = Math.max(0, profile.proactivity - 20);
  
  // Set modality preference
  profile.modality = responses.comm_explain || 'mix';
  
  // Set feedback style
  profile.feedback_style = responses.feedback_style || 'balanced';
  
  // Set decision support preference
  if (responses.decision_options === 'one_recommended') profile.decision_support = 'recommendation';
  else if (responses.decision_options === 'three_clear') profile.decision_support = 'curated_options';
  else if (responses.decision_options === 'all_options') profile.decision_support = 'comprehensive';
  else if (responses.decision_options === 'framework') profile.decision_support = 'framework';
  
  // Set stress response
  profile.stress_response = responses.emotion_stress || 'space';
  
  // Update confidence based on completion
  const layer1Count = Object.keys(responses).filter(k => 
    LAYERED_ASSESSMENT_QUESTIONS.layer1.some(q => q.id === k)
  ).length;
  profile.confidence.communication = Math.min(1, layer1Count / 10 * 0.8);
  profile.confidence.emotional = responses.emotion_stress && responses.emotion_disappointment ? 0.7 : 0.5;
  profile.confidence.work_style = responses.feedback_style ? 0.7 : 0.5;
  
  return profile;
}

// Generate adaptive system prompt based on profile
function generateAdaptivePrompt(profile) {
  let adaptations = [];
  
  // Adjust based on directness score
  if (profile.directness > 70) {
    adaptations.push('Be direct and concise. Cut fluff. Lead with conclusions, support if needed.');
  } else if (profile.directness < 40) {
    adaptations.push('Use a gentle, diplomatic approach. Build up to main points gradually.');
  }
  
  // Adjust based on emotional warmth
  if (profile.emotional_warmth > 70) {
    adaptations.push('Be warm and friendly. Use conversational language. Show personality.');
  } else if (profile.emotional_warmth < 30) {
    adaptations.push('Keep tone professional, not overly friendly. Focus on substance over relationship building.');
  }
  
  // Adjust based on information density
  if (profile.information_density > 70) {
    adaptations.push('User can handle complexity - don\'t oversimplify. Provide depth and nuance.');
  } else if (profile.information_density < 40) {
    adaptations.push('Keep responses concise and scannable. Use bullet points. Avoid information overload.');
  }
  
  // Adjust based on decision support preference
  if (profile.decision_support === 'recommendation') {
    adaptations.push('Lead with a single clear recommendation, then explain reasoning.');
  } else if (profile.decision_support === 'curated_options') {
    adaptations.push('Present 2-3 options with clear pros/cons for each.');
  } else if (profile.decision_support === 'framework') {
    adaptations.push('Provide frameworks and criteria to help them decide themselves.');
  }
  
  // Adjust based on proactivity
  if (profile.proactivity > 70) {
    adaptations.push('Be proactive - anticipate needs, offer suggestions, call out issues.');
  } else if (profile.proactivity < 40) {
    adaptations.push('Be responsive rather than proactive. Wait for them to ask for input.');
  }
  
  // Adjust based on feedback style
  if (profile.feedback_style === 'direct') {
    adaptations.push('Give feedback immediately and directly. Don\'t sugar coat.');
  } else if (profile.feedback_style === 'sandwich') {
    adaptations.push('Use sandwich feedback: positive observation, constructive point, positive close.');
  } else if (profile.feedback_style === 'data_driven') {
    adaptations.push('Support feedback with data and examples. Show the reasoning.');
  }
  
  return adaptations.join('\n');
}

// Generate human-readable trait descriptions
function getTraitDescription(trait, value) {
  const descriptions = {
    directness: {
      high: { label: 'Direct Communicator', desc: 'You prefer getting straight to the point without unnecessary preamble.' },
      medium: { label: 'Balanced', desc: 'You adapt your directness based on the situation.' },
      low: { label: 'Diplomatic', desc: 'You prefer a gentler, more nuanced approach to communication.' }
    },
    emotional_warmth: {
      high: { label: 'Warm & Personable', desc: 'You value friendly, conversational interactions.' },
      medium: { label: 'Balanced Warmth', desc: 'You blend professional and friendly communication.' },
      low: { label: 'Professional', desc: 'You prefer focused, task-oriented communication.' }
    },
    information_density: {
      high: { label: 'Detail-Oriented', desc: 'You appreciate comprehensive, nuanced information.' },
      medium: { label: 'Balanced Detail', desc: 'You like a mix of overview and detail.' },
      low: { label: 'Concise', desc: 'You prefer brief, scannable information.' }
    },
    proactivity: {
      high: { label: 'Proactive Partner', desc: 'You like suggestions and anticipation of your needs.' },
      medium: { label: 'Balanced Support', desc: 'You appreciate proactive help when relevant.' },
      low: { label: 'On-Demand', desc: 'You prefer to ask for help when you need it.' }
    }
  };
  
  const level = value > 70 ? 'high' : value < 40 ? 'low' : 'medium';
  return descriptions[trait]?.[level] || { label: 'Unknown', desc: '' };
}


export {
  SEED_QUESTIONS,
  LAYERED_ASSESSMENT_QUESTIONS,
  calculateCommunicationProfile,
  generateAdaptivePrompt,
  getTraitDescription,
};
