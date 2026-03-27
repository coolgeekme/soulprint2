/**
 * Gradual Assessment System — progressive user profiling
 * Extracted from route.js for maintainability.
 */
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';
import { generateAdaptivePrompt, getTraitDescription, calculateCommunicationProfile, SLIDER_QUESTIONS, SEED_QUESTIONS } from '@/lib/handlers/assessment-data';

// GRADUAL ASSESSMENT SYSTEM
// Asks remaining 36-question assessment questions over time
// Steady cadence — no deadline pressure
// ============================================================

// Build a static mapping from SEED_QUESTIONS order_index → SLIDER_QUESTIONS id.
// Both arrays cover the same 36 assessment dimensions in the same order.
const ORDER_INDEX_TO_SLIDER_ID = {};
SLIDER_QUESTIONS.forEach((sq, i) => {
  // SEED_QUESTIONS[i].order_index == i + 1
  ORDER_INDEX_TO_SLIDER_ID[i + 1] = sq.id;
});

// Mapping from layered-assessment pillar → slider question IDs that overlap.
// If a user completed BOTH layered questions for a pillar, credit the first
// slider question for that pillar as "effectively answered".
const LAYERED_PILLAR_TO_FIRST_SLIDER = {
  communication: 'comm_1',
  emotional_intelligence: 'emo_1',
  decision_making: 'dec_1',
};

/**
 * Resolve all previously-answered slider-question IDs from every assessment source:
 *  1. assessment_slider_answers  (direct slider/nudge answers)
 *  2. assessment_answers          (full 36-question onboarding — UUID keys)
 *  3. layered_assessment_answers  (Quick Start — pillar-level credit)
 */
async function resolveAllAnsweredSliderIds(db, userId) {
  // 1. Direct slider answers — IDs already match SLIDER_QUESTIONS
  const sliderAnswers = await db.collection('assessment_slider_answers')
    .find({ user_id: userId }).toArray();
  const answeredIds = new Set(sliderAnswers.map(a => a.question_id));

  // 2. Full assessment answers — need UUID→order_index→slider_id mapping
  const fullAnswers = await db.collection('assessment_answers')
    .find({ user_id: userId }).toArray();

  if (fullAnswers.length > 0) {
    // Fetch the seeded questions from DB to get the UUID→order_index map
    const seededQuestions = await db.collection('assessment_questions').find({}).toArray();
    const uuidToOrder = {};
    for (const sq of seededQuestions) {
      uuidToOrder[sq.id] = sq.order_index;
    }

    for (const ans of fullAnswers) {
      const orderIndex = uuidToOrder[ans.question_id];
      if (orderIndex && ORDER_INDEX_TO_SLIDER_ID[orderIndex]) {
        answeredIds.add(ORDER_INDEX_TO_SLIDER_ID[orderIndex]);
      }
    }
  }

  // 3. Layered (Quick Start) assessment — pillar-level credit
  const layeredDoc = await db.collection('layered_assessment_answers')
    .findOne({ user_id: userId });

  if (layeredDoc) {
    const l1 = layeredDoc.layer1_answers || {};
    // Group answered layered questions by category
    const pillarCounts = {};
    // The layered question IDs encode their category: comm_, emotion_, decision_, etc.
    // We also have the raw answers keyed by question id
    for (const qId of Object.keys(l1)) {
      // Determine pillar from the question ID prefix
      let pillar = null;
      if (qId.startsWith('comm_')) pillar = 'communication';
      else if (qId.startsWith('emotion_')) pillar = 'emotional_intelligence';
      else if (qId.startsWith('decision_')) pillar = 'decision_making';
      if (pillar) {
        pillarCounts[pillar] = (pillarCounts[pillar] || 0) + 1;
      }
    }

    // If BOTH layered questions for an overlapping pillar were answered,
    // credit the first slider question of that pillar
    for (const [pillar, count] of Object.entries(pillarCounts)) {
      if (count >= 2 && LAYERED_PILLAR_TO_FIRST_SLIDER[pillar]) {
        answeredIds.add(LAYERED_PILLAR_TO_FIRST_SLIDER[pillar]);
      }
    }
  }

  return answeredIds;
}

/**
 * GET /api/assessment/nudge
 * Returns the next slider question for the nudge system.
 * Steady cadence: show after every ~8 user messages.
 * No deadline pressure — gentle, ongoing profiling.
 */
async function handleGetAssessmentNudge(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Get or create nudge progress
  let nudgeProgress = await db.collection('assessment_nudge_progress').findOne({ user_id: user.id });
  
  // Always resolve the full set of answered IDs across ALL assessment sources
  const resolvedAnsweredIds = await resolveAllAnsweredSliderIds(db, user.id);
  
  if (!nudgeProgress) {
    nudgeProgress = {
      id: uuidv4(),
      user_id: user.id,
      answered_question_ids: [...resolvedAnsweredIds],
      last_nudge_at: null,
      nudge_count: 0,
      messages_since_last_nudge: 0,
      created_at: new Date(),
    };
    await db.collection('assessment_nudge_progress').insertOne(nudgeProgress);
  } else {
    // Sync: merge any newly-discovered answered IDs from other sources
    const existingSet = new Set(nudgeProgress.answered_question_ids || []);
    let needsUpdate = false;
    for (const id of resolvedAnsweredIds) {
      if (!existingSet.has(id)) {
        existingSet.add(id);
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      await db.collection('assessment_nudge_progress').updateOne(
        { user_id: user.id },
        { $set: { answered_question_ids: [...existingSet], updated_at: new Date() } }
      );
      nudgeProgress.answered_question_ids = [...existingSet];
    }
  }
  
  const answeredIds = new Set(nudgeProgress.answered_question_ids || []);
  
  // Find unanswered slider questions
  const unanswered = SLIDER_QUESTIONS.filter(q => !answeredIds.has(q.id));
  
  if (unanswered.length === 0) {
    return ok({
      hasQuestion: false,
      complete: true,
      progress: { answered: 36, total: 36, percentage: 100 },
    });
  }
  
  // Steady cadence: show after every 8 messages
  const MESSAGE_THRESHOLD = 8;
  const messagesSince = nudgeProgress.messages_since_last_nudge || 0;
  
  // Minimum 30 seconds between nudges
  const timeSinceLastNudge = nudgeProgress.last_nudge_at 
    ? Date.now() - new Date(nudgeProgress.last_nudge_at).getTime() 
    : Infinity;
  
  const shouldNudge = messagesSince >= MESSAGE_THRESHOLD && timeSinceLastNudge > 30000;
  
  if (!shouldNudge) {
    return ok({
      hasQuestion: false,
      shouldWait: true,
      messagesUntilNext: Math.max(0, MESSAGE_THRESHOLD - messagesSince),
      progress: {
        answered: answeredIds.size,
        total: 36,
        percentage: Math.round((answeredIds.size / 36) * 100),
        remaining: unanswered.length,
      },
    });
  }
  
  // Pick next question — rotate through pillars for variety
  const pillarCounts = {};
  for (const q of unanswered) {
    pillarCounts[q.pillar] = (pillarCounts[q.pillar] || 0) + 1;
  }
  
  // Pick from the pillar with most remaining, but add randomness
  const sortedPillars = Object.entries(pillarCounts).sort((a, b) => b[1] - a[1]);
  const targetPillar = sortedPillars[Math.floor(Math.random() * Math.min(3, sortedPillars.length))]?.[0];
  const candidates = unanswered.filter(q => q.pillar === targetPillar);
  const nextQuestion = candidates[Math.floor(Math.random() * candidates.length)] || unanswered[0];
  
  // Mark nudge as shown
  await db.collection('assessment_nudge_progress').updateOne(
    { user_id: user.id },
    { $set: { last_nudge_at: new Date(), messages_since_last_nudge: 0 }, $inc: { nudge_count: 1 } }
  );
  
  return ok({
    hasQuestion: true,
    question: {
      id: nextQuestion.id,
      pillar: nextQuestion.pillar,
      question: nextQuestion.question,
      leftLabel: nextQuestion.leftLabel,
      rightLabel: nextQuestion.rightLabel,
      emoji: nextQuestion.emoji,
      order: nextQuestion.order,
    },
    progress: {
      answered: answeredIds.size,
      total: 36,
      percentage: Math.round((answeredIds.size / 36) * 100),
      remaining: unanswered.length,
    },
  });
}

/**
 * POST /api/assessment/nudge/answer
 * Submit a slider answer (0-100).
 */
async function handleSubmitNudgeAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { question_id, value } = body;
  
  if (!question_id || value === undefined || value === null) {
    return err('question_id and value required');
  }
  
  const numValue = Math.round(Math.max(0, Math.min(100, Number(value))));
  
  const db = await getDb();
  
  // Find the question to get the pillar
  const question = SLIDER_QUESTIONS.find(q => q.id === question_id);
  if (!question) return err('Invalid question_id');
  
  // Save slider answer
  await db.collection('assessment_slider_answers').updateOne(
    { user_id: user.id, question_id },
    {
      $set: {
        id: uuidv4(),
        user_id: user.id,
        question_id,
        value: numValue,
        pillar: question.pillar,
        source: 'nudge',
        created_at: new Date(),
      }
    },
    { upsert: true }
  );
  
  // Update nudge progress
  await db.collection('assessment_nudge_progress').updateOne(
    { user_id: user.id },
    {
      $addToSet: { answered_question_ids: question_id },
      $set: { last_nudge_at: new Date(), updated_at: new Date() }
    },
    { upsert: true }
  );
  
  // Check if all 36 are now complete
  const progress = await db.collection('assessment_nudge_progress').findOne({ user_id: user.id });
  const answeredCount = progress?.answered_question_ids?.length || 0;
  const isComplete = answeredCount >= 36;
  
  if (isComplete) {
    await db.collection('profiles').updateOne(
      { user_id: user.id },
      { $set: { full_assessment_complete: true, slider_assessment_complete: true, updated_at: new Date() } }
    );
  }
  
  return ok({
    success: true,
    progress: {
      answered: answeredCount,
      total: 36,
      percentage: Math.round((answeredCount / 36) * 100),
      isComplete,
    },
  });
}

/**
 * POST /api/assessment/nudge/message
 * Called by the frontend after each user message to increment the counter.
 */
async function handleNudgeMessageCount(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  await db.collection('assessment_nudge_progress').updateOne(
    { user_id: user.id },
    { $inc: { messages_since_last_nudge: 1 } },
    { upsert: true }
  );
  
  return ok({ success: true });
}

// Get the next gradual assessment question for the user
async function handleGetGradualQuestion(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Get user's profile to check assessment type
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  // Get gradual progress record
  let gradualProgress = await db.collection('gradual_assessment_progress').findOne({ user_id: user.id });
  
  // If no progress record exists, initialize it
  if (!gradualProgress) {
    // Check what questions user has already answered
    const existingAnswers = await db.collection('assessment_answers')
      .find({ user_id: user.id })
      .toArray();
    const answeredQuestionIds = existingAnswers.map(a => a.question_id);
    
    gradualProgress = {
      id: uuidv4(),
      user_id: user.id,
      answered_question_ids: answeredQuestionIds,
      total_questions: 36,
      last_question_at: null,
      questions_since_last_prompt: 0,
      created_at: new Date(),
    };
    await db.collection('gradual_assessment_progress').insertOne(gradualProgress);
  }
  
  // Get all active questions
  const allQuestions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();
  
  // Find unanswered questions
  const answeredIds = new Set(gradualProgress.answered_question_ids || []);
  const unansweredQuestions = allQuestions.filter(q => !answeredIds.has(q.id));
  
  if (unansweredQuestions.length === 0) {
    return ok({ 
      hasQuestion: false, 
      complete: true,
      progress: {
        answered: gradualProgress.answered_question_ids?.length || 0,
        total: 36,
        percentage: 100
      }
    });
  }
  
  // Determine if we should ask a question now
  // Logic: Ask after every 5-10 chat messages, but not too frequently
  const messageCount = await db.collection('messages')
    .countDocuments({ 
      user_id: user.id, 
      role: 'user',
      created_at: { $gt: gradualProgress.last_question_at || new Date(0) }
    });
  
  // Don't ask if less than 5 messages since last question
  const MIN_MESSAGES_BETWEEN = 5;
  if (messageCount < MIN_MESSAGES_BETWEEN) {
    return ok({ 
      hasQuestion: false, 
      shouldWait: true,
      messagesUntilNext: MIN_MESSAGES_BETWEEN - messageCount,
      progress: {
        answered: answeredIds.size,
        total: 36,
        percentage: Math.round((answeredIds.size / 36) * 100)
      }
    });
  }
  
  // Get the next question (prioritize by pillar to ensure coverage)
  // Group unanswered by pillar and pick from least-answered pillar
  const pillarCounts = {};
  for (const q of unansweredQuestions) {
    pillarCounts[q.pillar] = (pillarCounts[q.pillar] || 0) + 1;
  }
  
  // Pick the pillar with most remaining questions
  const targetPillar = Object.entries(pillarCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  const nextQuestion = unansweredQuestions.find(q => q.pillar === targetPillar) || unansweredQuestions[0];
  
  return ok({
    hasQuestion: true,
    question: {
      id: nextQuestion.id,
      pillar: nextQuestion.pillar,
      question_text: nextQuestion.question_text,
      order_index: nextQuestion.order_index,
    },
    progress: {
      answered: answeredIds.size,
      total: 36,
      percentage: Math.round((answeredIds.size / 36) * 100),
      remaining: unansweredQuestions.length,
    },
    pillarProgress: Object.fromEntries(
      ['communication', 'emotional_intelligence', 'decision_making', 'social_dynamics', 'cognitive_style', 'assertiveness']
        .map(p => {
          const totalInPillar = allQuestions.filter(q => q.pillar === p).length;
          const answeredInPillar = allQuestions.filter(q => q.pillar === p && answeredIds.has(q.id)).length;
          return [p, { answered: answeredInPillar, total: totalInPillar }];
        })
    )
  });
}

// Submit a gradual assessment answer
async function handleSubmitGradualAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { question_id, answer } = body;
  
  if (!question_id || !answer) return err('question_id and answer required');
  
  const db = await getDb();
  
  // Save the answer
  await db.collection('assessment_answers').updateOne(
    { user_id: user.id, question_id },
    {
      $set: {
        id: uuidv4(),
        user_id: user.id,
        question_id,
        answer_text: answer,
        source: 'gradual', // Mark as coming from gradual system
        created_at: new Date(),
      }
    },
    { upsert: true }
  );
  
  // Update gradual progress
  await db.collection('gradual_assessment_progress').updateOne(
    { user_id: user.id },
    {
      $addToSet: { answered_question_ids: question_id },
      $set: { 
        last_question_at: new Date(),
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
  
  // Check if all 36 are now complete
  const progress = await db.collection('gradual_assessment_progress').findOne({ user_id: user.id });
  const isComplete = (progress?.answered_question_ids?.length || 0) >= 36;
  
  if (isComplete) {
    // Mark full assessment as complete
    await db.collection('profiles').updateOne(
      { user_id: user.id },
      { $set: { full_assessment_complete: true, updated_at: new Date() } }
    );
  }
  
  // Clear system prompt cache to reflect new profile data
  _systemPromptCache.delete(user.id);
  
  return ok({ 
    success: true,
    progress: {
      answered: progress?.answered_question_ids?.length || 0,
      total: 36,
      percentage: Math.round(((progress?.answered_question_ids?.length || 0) / 36) * 100),
      isComplete
    }
  });
}

// Skip a gradual assessment question (for now)
async function handleSkipGradualQuestion(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { question_id } = body;
  
  const db = await getDb();
  
  // Update last question time to delay next prompt
  await db.collection('gradual_assessment_progress').updateOne(
    { user_id: user.id },
    {
      $set: { 
        last_question_at: new Date(),
        updated_at: new Date()
      },
      $addToSet: { skipped_question_ids: question_id }
    },
    { upsert: true }
  );
  
  return ok({ success: true });
}

// Get full assessment progress summary
async function handleGetAssessmentProgress(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Get all data sources
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const gradualProgress = await db.collection('gradual_assessment_progress').findOne({ user_id: user.id });
  const allQuestions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();
  
  const answeredIds = new Set(gradualProgress?.answered_question_ids || []);
  
  // Calculate pillar-by-pillar progress
  const pillars = ['communication', 'emotional_intelligence', 'decision_making', 'social_dynamics', 'cognitive_style', 'assertiveness'];
  const pillarProgress = {};
  
  for (const pillar of pillars) {
    const pillarQuestions = allQuestions.filter(q => q.pillar === pillar);
    const answeredInPillar = pillarQuestions.filter(q => answeredIds.has(q.id));
    pillarProgress[pillar] = {
      answered: answeredInPillar.length,
      total: pillarQuestions.length,
      percentage: pillarQuestions.length > 0 ? Math.round((answeredInPillar.length / pillarQuestions.length) * 100) : 0,
      questions: pillarQuestions.map(q => ({
        id: q.id,
        text: q.question_text,
        answered: answeredIds.has(q.id)
      }))
    };
  }
  
  return ok({
    assessmentType: profile?.assessment_type || 'unknown',
    quickStartComplete: profile?.assessment_complete || false,
    fullAssessmentComplete: profile?.full_assessment_complete || false,
    overall: {
      answered: answeredIds.size,
      total: 36,
      percentage: Math.round((answeredIds.size / 36) * 100)
    },
    pillars: pillarProgress
  });
}

// Get user's communication profile
async function handleGetCommunicationProfile(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  const profile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  
  if (!profile) {
    return ok({ hasProfile: false });
  }
  
  // Generate human-readable summary
  const adaptations = generateAdaptivePrompt(profile);
  
  return ok({
    hasProfile: true,
    profile: {
      directness: profile.directness,
      emotional_warmth: profile.emotional_warmth,
      information_density: profile.information_density,
      proactivity: profile.proactivity,
      modality: profile.modality,
      feedback_style: profile.feedback_style,
      decision_support: profile.decision_support,
      stress_response: profile.stress_response,
      confidence: profile.confidence
    },
    adaptations,
    updated_at: profile.updated_at
  });
}

// Get user's complete SoulPrint (all profile data)
async function handleGetSoulPrint(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get all profile data
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const commProfile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
  
  // Get latest and previous SoulPrint snapshots
  const snapshots = await db.collection('soulprint_snapshots')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(2)
    .toArray();
  
  const latestSnapshot = snapshots[0] || null;
  const previousSnapshot = snapshots[1] || null;
  
  // Get assessment answers
  const assessmentAnswers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .sort({ created_at: 1 })
    .toArray();
  
  // Get question text for answers
  const questionIds = assessmentAnswers.map(a => a.question_id);
  const questions = await db.collection('assessment_questions')
    .find({ id: { $in: questionIds } })
    .toArray();
  const qMap = Object.fromEntries(questions.map(q => [q.id, q]));
  
  // Build communication traits from commProfile OR from layered assessment answers
  const communicationTraits = [];
  if (commProfile) {
    // Directness
    const directness = getTraitDescription('directness', commProfile.directness || 50);
    communicationTraits.push({
      name: 'Communication Style',
      value: commProfile.directness || 50,
      label: directness.label,
      description: directness.desc,
      icon: '🎯'
    });
    
    // Emotional Warmth
    const warmth = getTraitDescription('emotional_warmth', commProfile.emotional_warmth || 50);
    communicationTraits.push({
      name: 'Warmth Level',
      value: commProfile.emotional_warmth || 50,
      label: warmth.label,
      description: warmth.desc,
      icon: '💝'
    });
    
    // Information Density
    const density = getTraitDescription('information_density', commProfile.information_density || 50);
    communicationTraits.push({
      name: 'Detail Preference',
      value: commProfile.information_density || 50,
      label: density.label,
      description: density.desc,
      icon: '📊'
    });
    
    // Proactivity
    const proactive = getTraitDescription('proactivity', commProfile.proactivity || 50);
    communicationTraits.push({
      name: 'Support Style',
      value: commProfile.proactivity || 50,
      label: proactive.label,
      description: proactive.desc,
      icon: '🚀'
    });
  } else if (profile?.assessment_complete) {
    // Fallback: Generate basic traits if no communication_profile but assessment is complete
    // This handles users who completed the Full Assessment (not Quick)
    communicationTraits.push({
      name: 'Assessment Status',
      value: 100,
      label: 'Completed',
      description: 'You\'ve completed the full assessment. Your SoulPrint is being built from your responses.',
      icon: '✅'
    });
  }
  
  // Build adaptations list (how AI communicates with them)
  const adaptations = commProfile ? generateAdaptivePrompt(commProfile).split('\n').filter(Boolean) : [];
  
  // Get profile history/changes
  const profileHistory = await db.collection('soul_profile_history')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();
  
  // Format assessment answers by pillar
  const answersByPillar = {};
  assessmentAnswers.forEach(a => {
    const q = qMap[a.question_id];
    if (!q) return;
    if (!answersByPillar[q.pillar]) answersByPillar[q.pillar] = [];
    answersByPillar[q.pillar].push({
      question: q.question_text,
      answer: a.answer_text,
      answered_at: a.created_at
    });
  });
  
  // Build response
  return ok({
    // Basic info
    displayName: profile?.display_name || user.email?.split('@')[0],
    assistantName: profile?.assistant_name || 'SoulPrint',
    assessmentComplete: profile?.assessment_complete || false,
    
    // Communication profile (from Quick Assessment)
    communicationTraits,
    adaptations,
    decisionSupport: commProfile?.decision_support || null,
    feedbackStyle: commProfile?.feedback_style || null,
    stressResponse: commProfile?.stress_response || null,
    
    // Soul profile (from data imports)
    soulInsights: soulProfile?.insights || null,
    importedFrom: soulProfile?.sources || [],
    lastImportAt: soulProfile?.updated_at || null,
    
    // Assessment answers
    answersByPillar,
    totalAnswers: assessmentAnswers.length,
    
    // Profile summary
    profileSummary: profile?.soul_profile_summary || null,
    
    // History of changes
    profileHistory: profileHistory.map(h => ({
      date: h.created_at,
      changes: h.changes,
      source: h.source
    })),
    
    // Onboarding data
    descriptors: profile?.descriptors || [],
    field: profile?.field || '',
    helpWith: profile?.help_with || [],
    
    // Latest AI-generated SoulPrint snapshot
    latestSnapshot: latestSnapshot ? {
      id: latestSnapshot.id,
      generatedAt: latestSnapshot.created_at,
      insights: latestSnapshot.insights,
      communicationStyle: latestSnapshot.communication_style,
      interests: latestSnapshot.interests,
      personality: latestSnapshot.personality,
      growthAreas: latestSnapshot.growth_areas,
      dataSources: latestSnapshot.data_sources,
    } : null,
    
    // Previous snapshot for comparison
    previousSnapshot: previousSnapshot ? {
      id: previousSnapshot.id,
      generatedAt: previousSnapshot.created_at,
      communicationStyle: previousSnapshot.communication_style,
    } : null,
    
    // Assessment progress for gradual system
    assessmentProgress: await getAssessmentProgress(db, user.id, profile),
    
    // Timestamps
    createdAt: profile?.created_at,
    lastUpdated: commProfile?.updated_at || soulProfile?.updated_at || profile?.created_at
  });
}

// Helper to get assessment progress
async function getAssessmentProgress(db, userId, profile) {
  // Get gradual progress (for in-chat questions)
  const gradualProgress = await db.collection('gradual_assessment_progress').findOne({ user_id: userId });
  
  // Also get assessment_answers (from initial full/quick assessment)
  const assessmentAnswers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .toArray();
  
  const allQuestions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();
  
  // Combine answered question IDs from both sources
  const answeredIds = new Set([
    ...(gradualProgress?.answered_question_ids || []),
    ...assessmentAnswers.map(a => a.question_id)
  ]);
  
  const pillars = ['communication', 'emotional_intelligence', 'decision_making', 'social_dynamics', 'cognitive_style', 'assertiveness'];
  const pillarProgress = {};
  
  for (const pillar of pillars) {
    const pillarQuestions = allQuestions.filter(q => q.pillar === pillar);
    const answeredInPillar = pillarQuestions.filter(q => answeredIds.has(q.id)).length;
    pillarProgress[pillar] = {
      answered: answeredInPillar,
      total: pillarQuestions.length,
      percentage: pillarQuestions.length > 0 ? Math.round((answeredInPillar / pillarQuestions.length) * 100) : 0,
    };
  }
  
  const totalAnswered = answeredIds.size;
  const totalQuestions = Math.max(36, allQuestions.length); // At least 36 or however many exist
  
  return {
    quickStartComplete: profile?.assessment_complete || false,
    fullAssessmentComplete: profile?.full_assessment_complete || totalAnswered >= 36,
    overall: {
      answered: totalAnswered,
      total: totalQuestions,
      percentage: Math.round((totalAnswered / totalQuestions) * 100)
    },
    pillars: pillarProgress
  };
}

// Generate/Refresh SoulPrint Analysis using AI
async function handleGenerateSoulPrint(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Gather all data sources
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  const commProfile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
  
  // Get assessment answers
  const assessmentAnswers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();
  
  // Get recent SoulPrint chat messages (last 100)
  const recentMessages = await db.collection('messages')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray();
  
  // Get imported messages sample (last 200)
  const importedMessages = await db.collection('imported_messages')
    .find({ user_id: user.id })
    .sort({ timestamp: -1 })
    .limit(200)
    .toArray();
  
  // Get memories from user_memories collection
  const memories = await db.collection('user_memories')
    .find({ user_id: user.id })
    .sort({ importance: 1, created_at: -1 })
    .toArray();
  
  console.log('[SoulPrint] Found', memories.length, 'memories for user', user.id);
  
  // Build context for AI analysis
  const dataSources = [];
  let contextParts = [];
  
  // Assessment data
  if (assessmentAnswers.length > 0) {
    dataSources.push('assessment');
    const questions = await db.collection('assessment_questions').find({}).toArray();
    const qMap = Object.fromEntries(questions.map(q => [q.id, q.question_text]));
    const assessmentText = assessmentAnswers.map(a => 
      `Q: ${qMap[a.question_id] || 'Unknown'}\nA: ${a.answer_text}`
    ).join('\n\n');
    contextParts.push(`## Assessment Responses\n${assessmentText}`);
  }
  
  // Communication profile
  if (commProfile) {
    dataSources.push('quick_assessment');
    contextParts.push(`## Communication Profile Scores
- Directness: ${commProfile.directness || 50}/100
- Emotional Warmth: ${commProfile.emotional_warmth || 50}/100
- Information Density: ${commProfile.information_density || 50}/100
- Proactivity: ${commProfile.proactivity || 50}/100
- Decision Support Preference: ${commProfile.decision_support || 'balanced'}
- Feedback Style: ${commProfile.feedback_style || 'balanced'}`);
  }
  
  // Recent SoulPrint conversations
  if (recentMessages.length > 0) {
    dataSources.push('soulprint_chats');
    const chatSample = recentMessages
      .slice(0, 50)
      .map(m => `${m.role}: ${m.content?.substring(0, 300)}`)
      .join('\n');
    contextParts.push(`## Recent SoulPrint Conversations (sample)\n${chatSample}`);
  }
  
  // Imported ChatGPT/Facebook messages
  if (importedMessages.length > 0) {
    dataSources.push('imported_history');
    const importedSample = importedMessages
      .slice(0, 100)
      .map(m => m.content?.substring(0, 200))
      .filter(Boolean)
      .join('\n---\n');
    contextParts.push(`## Imported Chat History (sample)\n${importedSample}`);
  }
  
  // Memories - THESE ARE THE MOST IMPORTANT as they represent verified, current facts
  if (memories.length > 0) {
    dataSources.push('memories');
    const memoriesText = memories.map(m => `- [${m.category || 'fact'}] ${m.content}`).join('\n');
    // Put memories FIRST as they are the most authoritative source
    contextParts.unshift(`## CURRENT STORED MEMORIES (MOST AUTHORITATIVE - prioritize these over older imported data)
These are verified facts that the user has confirmed or the system has learned recently. If there are any contradictions with imported chat history, ALWAYS prefer the information in these memories as they represent the user's CURRENT state.

${memoriesText}`);
  }
  
  // Soul profile insights
  if (soulProfile?.insights) {
    const insights = soulProfile.insights;
    if (insights.interests?.length) {
      contextParts.push(`## Previously Identified Interests\n${insights.interests.join(', ')}`);
    }
    if (insights.insights?.length) {
      contextParts.push(`## Previous Personality Insights\n${insights.insights.join('\n')}`);
    }
  }
  
  // If no data, return error
  if (contextParts.length === 0) {
    return err('Not enough data to generate SoulPrint. Complete an assessment or import some chat history first.', 400);
  }
  
  // Generate SoulPrint using AI
  const analysisPrompt = `You are analyzing a user's communication patterns and personality to create their "SoulPrint" - a comprehensive profile of who they are RIGHT NOW.

IMPORTANT RULES:
1. If "CURRENT STORED MEMORIES" are provided, ALWAYS prioritize them over imported chat history
2. Memories represent the user's CURRENT verified state - they override any contradicting info from older data
3. Imported chat history may contain OUTDATED information (e.g., past relationships, old jobs, etc.)
4. When in doubt, use present tense and reflect the most recent information

Based on the following data, generate a detailed SoulPrint analysis:

${contextParts.join('\n\n')}

---

Respond with a JSON object containing:
{
  "summary": "A 2-3 sentence overview of who this person is RIGHT NOW (current state, not historical)",
  "communication_style": {
    "overall": "Brief description of their overall communication style",
    "tone": "warm/professional/casual/formal/mixed",
    "directness": "direct/diplomatic/balanced",
    "detail_preference": "concise/detailed/balanced",
    "traits": ["list", "of", "key", "communication", "traits"]
  },
  "personality": {
    "overview": "Brief personality overview",
    "strengths": ["list", "of", "strengths"],
    "traits": ["list", "of", "personality", "traits"]
  },
  "interests": ["list", "of", "identified", "interests", "and", "topics"],
  "values": ["what", "they", "seem", "to", "value"],
  "growth_areas": ["potential", "areas", "for", "growth"],
  "insights": ["unique", "observations", "about", "this", "person"],
  "how_to_communicate": ["specific", "tips", "for", "communicating", "with", "them"]
}

Be specific and insightful. Base everything on the actual data provided.`;

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    
    const analysis = JSON.parse(completion.choices[0].message.content);
    
    // Create snapshot
    const snapshotId = uuidv4();
    const snapshot = {
      id: snapshotId,
      user_id: user.id,
      created_at: new Date(),
      data_sources: dataSources,
      insights: analysis.insights,
      summary: analysis.summary,
      communication_style: analysis.communication_style,
      personality: analysis.personality,
      interests: analysis.interests,
      values: analysis.values,
      growth_areas: analysis.growth_areas,
      how_to_communicate: analysis.how_to_communicate,
    };
    
    // Save snapshot
    await db.collection('soulprint_snapshots').insertOne(snapshot);
    
    // Return the new snapshot
    return ok({
      success: true,
      snapshot: {
        id: snapshotId,
        generatedAt: snapshot.created_at,
        dataSources,
        summary: analysis.summary,
        communicationStyle: analysis.communication_style,
        personality: analysis.personality,
        interests: analysis.interests,
        values: analysis.values,
        growthAreas: analysis.growth_areas,
        insights: analysis.insights,
        howToCommunicate: analysis.how_to_communicate,
      }
    });
    
  } catch (e) {
    console.error('SoulPrint generation failed:', e);
    return err('Failed to generate SoulPrint analysis', 500);
  }
}

// ============================================================


export {
  handleGetGradualQuestion,
  handleSubmitGradualAnswer,
  handleSkipGradualQuestion,
  handleGetAssessmentProgress,
  handleGetCommunicationProfile,
  handleGetSoulPrint,
  getAssessmentProgress,
  handleGenerateSoulPrint,
  handleGetAssessmentNudge,
  handleSubmitNudgeAnswer,
  handleNudgeMessageCount,
};
