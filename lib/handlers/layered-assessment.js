/**
 * Layered Assessment API Handlers
 * Extracted from route.js for maintainability.
 */
import { getDb } from '@/lib/mongodb';
import { LAYERED_ASSESSMENT_QUESTIONS, calculateCommunicationProfile } from '@/lib/handlers/assessment-data';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';
import { _systemPromptCache } from '@/lib/handlers/chat-cache';

// LAYERED ASSESSMENT API HANDLERS
// ============================================================

// Get layered assessment questions
async function handleGetLayeredQuestions(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Get user's existing layered assessment progress
  const progress = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
  
  // Determine which follow-up questions to show based on Layer 1 answers
  let followUpQuestions = [];
  if (progress?.layer1_answers) {
    for (const [questionId, answer] of Object.entries(progress.layer1_answers)) {
      const key = `${questionId}:${answer}`;
      if (LAYERED_ASSESSMENT_QUESTIONS.layer2[key]) {
        followUpQuestions.push(...LAYERED_ASSESSMENT_QUESTIONS.layer2[key]);
      }
    }
  }
  
  return ok({
    layer1: LAYERED_ASSESSMENT_QUESTIONS.layer1,
    layer2: followUpQuestions,
    progress: {
      layer1_complete: progress?.layer1_complete || false,
      layer2_complete: progress?.layer2_complete || false,
      answered: progress?.layer1_answers ? Object.keys(progress.layer1_answers) : []
    }
  });
}

// Submit layered assessment answers
async function handleSubmitLayeredAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { question_id, answer, layer } = body;
  
  if (!question_id || answer === undefined) return err('question_id and answer required');
  
  const db = await getDb();
  
  // Get or create assessment record
  let record = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
  
  if (!record) {
    record = {
      id: uuidv4(),
      user_id: user.id,
      layer1_answers: {},
      layer2_answers: {},
      layer1_complete: false,
      layer2_complete: false,
      created_at: new Date()
    };
  }
  
  // Update the appropriate layer
  const layerKey = layer === 2 ? 'layer2_answers' : 'layer1_answers';
  record[layerKey][question_id] = answer;
  record.updated_at = new Date();
  
  // Check if Layer 1 is complete (all 12 questions answered - 2 per pillar)
  const layer1Questions = LAYERED_ASSESSMENT_QUESTIONS.layer1.map(q => q.id);
  const layer1Answered = Object.keys(record.layer1_answers);
  record.layer1_complete = layer1Questions.every(qid => layer1Answered.includes(qid));
  
  // Determine follow-up questions
  let followUpQuestions = [];
  for (const [questionId, ans] of Object.entries(record.layer1_answers)) {
    const key = `${questionId}:${ans}`;
    if (LAYERED_ASSESSMENT_QUESTIONS.layer2[key]) {
      followUpQuestions.push(...LAYERED_ASSESSMENT_QUESTIONS.layer2[key]);
    }
  }
  
  // Check if Layer 2 is complete
  if (followUpQuestions.length > 0) {
    const layer2QuestionIds = followUpQuestions.map(q => q.id);
    const layer2Answered = Object.keys(record.layer2_answers);
    record.layer2_complete = layer2QuestionIds.every(qid => layer2Answered.includes(qid));
  } else {
    record.layer2_complete = true; // No follow-ups needed
  }
  
  await db.collection('layered_assessment_answers').updateOne(
    { user_id: user.id },
    { $set: record },
    { upsert: true }
  );
  
  return ok({
    success: true,
    layer1_complete: record.layer1_complete,
    layer2_complete: record.layer2_complete,
    follow_up_questions: record.layer1_complete ? followUpQuestions : []
  });
}

// Complete layered assessment
async function handleCompleteLayeredAssessment(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { assistant_name } = body;
  
  const db = await getDb();
  
  // Get assessment answers
  const answers = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
  if (!answers || !answers.layer1_complete) {
    return err('Please complete the core questions first', 400);
  }
  
  // Calculate communication profile
  const allAnswers = { ...answers.layer1_answers, ...answers.layer2_answers };
  const profile = calculateCommunicationProfile(allAnswers);
  
  // Save profile
  await db.collection('communication_profiles').updateOne(
    { user_id: user.id },
    { 
      $set: { 
        ...profile,
        user_id: user.id,
        updated_at: new Date()
      } 
    },
    { upsert: true }
  );
  
  // Mark assessment as complete
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { 
      $set: { 
        assistant_name: assistant_name || 'SoulPrint', 
        assessment_complete: true,
        assessment_type: 'layered', // Track which assessment type was used
        updated_at: new Date()
      } 
    },
    { upsert: true }
  );
  
  // Clear the system prompt cache
  _systemPromptCache.delete(user.id);
  
  return ok({ 
    success: true,
    profile_summary: `Based on your responses:
• Communication style: ${profile.modality === 'write' ? 'You prefer written communication' : profile.modality === 'talk' ? 'You prefer talking things through' : 'You adapt your communication style'}
• Feedback preference: ${profile.directness > 60 ? 'Direct and to the point' : profile.directness < 40 ? 'Gentle and diplomatic' : 'Balanced approach'}
• Information density: ${profile.information_density > 60 ? 'You can handle complexity' : 'You prefer concise information'}
• Decision support: ${profile.decision_support === 'recommendation' ? "I'll lead with clear recommendations" : profile.decision_support === 'framework' ? "I'll help you build decision frameworks" : "I'll present curated options"}`
  });
}

// Get assessment mode setting
async function handleGetAssessmentSettings(request) {
  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });
  
  return ok({
    assessment_mode: settings?.assessment_mode || 'both', // 'full_only', 'quick_only', 'both'
    default_assessment: settings?.default_assessment || 'quick'
  });
}

// Submit Layer 3 validation answer (from chat)
async function handleLayer3Validation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const { validation_id, answer, context } = body;
  
  if (!validation_id || !answer) return err('validation_id and answer required');
  
  const db = await getDb();
  
  // Get current profile
  const profile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  if (!profile) {
    return ok({ success: true, message: 'No profile to update' });
  }
  
  // Update profile based on validation response
  const updates = {};
  
  switch (validation_id) {
    case 'detail_check':
      if (answer === 'Too much') {
        updates.information_density = Math.max(0, (profile.information_density || 50) - 15);
      } else if (answer === 'Could use more') {
        updates.information_density = Math.min(100, (profile.information_density || 50) + 15);
      }
      break;
    case 'directness_check':
      if (answer === 'Too blunt') {
        updates.directness = Math.max(0, (profile.directness || 50) - 15);
      } else if (answer === 'Could be more direct') {
        updates.directness = Math.min(100, (profile.directness || 50) + 15);
      }
      break;
    case 'options_check':
      if (answer === 'Just recommend one') {
        updates.decision_support = 'recommendation';
      }
      break;
    case 'level_check':
      if (answer === 'Too simple') {
        updates.information_density = Math.min(100, (profile.information_density || 50) + 10);
      } else if (answer === 'Too complex') {
        updates.information_density = Math.max(0, (profile.information_density || 50) - 10);
      }
      break;
    case 'length_check':
      if (answer === 'Yes, shorter please') {
        updates.information_density = Math.max(0, (profile.information_density || 50) - 20);
      } else if (answer === 'Go even deeper') {
        updates.information_density = Math.min(100, (profile.information_density || 50) + 20);
      }
      break;
  }
  
  // Increase confidence since we're getting live feedback
  updates['confidence.behavioral'] = Math.min(1, (profile.confidence?.behavioral || 0.5) + 0.1);
  updates.updated_at = new Date();
  
  // Record the validation
  await db.collection('layer3_validations').insertOne({
    id: uuidv4(),
    user_id: user.id,
    validation_id,
    answer,
    context,
    created_at: new Date()
  });
  
  // Update profile
  await db.collection('communication_profiles').updateOne(
    { user_id: user.id },
    { $set: updates }
  );
  
  // Clear system prompt cache
  systemPromptCache.delete(user.id);
  
  return ok({ success: true, updates });
}

// Get next Layer 3 validation question (if needed)
async function handleGetNextValidation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Get profile
  const profile = await db.collection('communication_profiles').findOne({ user_id: user.id });
  if (!profile) {
    return ok({ hasValidation: false });
  }
  
  // Get previous validations
  const validations = await db.collection('layer3_validations')
    .find({ user_id: user.id })
    .toArray();
  
  const answeredIds = validations.map(v => v.validation_id);
  
  // Get message count to determine if we should ask
  const messageCount = await db.collection('messages')
    .countDocuments({ user_id: user.id, role: 'assistant' });
  
  // Only ask validations after first 3-5 messages
  if (messageCount < 3) {
    return ok({ hasValidation: false });
  }
  
  // Find next unanswered validation
  const nextValidation = LAYERED_ASSESSMENT_QUESTIONS.layer3_validations
    .find(v => !answeredIds.includes(v.id));
  
  if (!nextValidation) {
    return ok({ hasValidation: false, allComplete: true });
  }
  
  // Only return validation with some probability (don't ask every time)
  // After 5+ messages, ask every 3rd message
  if (messageCount >= 5 && messageCount % 3 !== 0) {
    return ok({ hasValidation: false });
  }
  
  return ok({
    hasValidation: true,
    validation: nextValidation
  });
}

// ============================================================


export {
  handleGetLayeredQuestions,
  handleSubmitLayeredAnswer,
  handleCompleteLayeredAssessment,
  handleGetAssessmentSettings,
  handleLayer3Validation,
  handleGetNextValidation,
};
