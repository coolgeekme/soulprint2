/**
 * Core assessment handlers (Questions, Progress, Submit, Complete, Reset)
 * Extracted from the main catch-all route.js for maintainability.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err } from '@/lib/api-utils';
import { SEED_QUESTIONS } from '@/lib/handlers/assessment-data';

// ASSESSMENT - Get Questions
async function handleGetQuestions(request) {
  const db = await getDb();
  let questions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();

  if (questions.length === 0) {
    await seedQuestions(db);
    questions = await db.collection('assessment_questions')
      .find({ active: true })
      .sort({ order_index: 1 })
      .toArray();
  }

  return ok(questions.map(q => ({
    id: q.id,
    pillar: q.pillar,
    order_index: q.order_index,
    question_text: q.question_text,
  })));
}

async function seedQuestions(db) {
  const existing = await db.collection('assessment_questions').countDocuments();
  if (existing > 0) return;
  const now = new Date();
  await db.collection('assessment_questions').insertMany(
    SEED_QUESTIONS.map(q => ({
      id: uuidv4(),
      ...q,
      active: true,
      created_at: now,
    }))
  );
}

// ASSESSMENT - Get Progress
async function handleGetProgress(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  const answers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();
  
  const layeredAnswers = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
  
  let totalAnswered = answers.length;
  let answeredIds = answers.map(a => a.question_id);
  let layer1Complete = false;
  let layer2Complete = false;
  
  if (layeredAnswers) {
    const layer1Count = Object.keys(layeredAnswers.layer1_answers || {}).length;
    const layer2Count = Object.keys(layeredAnswers.layer2_answers || {}).length;
    totalAnswered += layer1Count + layer2Count;
    answeredIds = [...answeredIds, ...Object.keys(layeredAnswers.layer1_answers || {}), ...Object.keys(layeredAnswers.layer2_answers || {})];
    layer1Complete = layeredAnswers.layer1_complete || false;
    layer2Complete = layeredAnswers.layer2_complete || false;
  }
  
  const hasCompletedAssessment = answers.length >= 36 ||
                                  (layer1Complete) ||
                                  totalAnswered >= 12;

  return ok({ 
    answered: answeredIds, 
    count: totalAnswered,
    layer1_complete: layer1Complete,
    layer2_complete: layer2Complete,
    assessment_complete: hasCompletedAssessment
  });
}

// ASSESSMENT - Submit Answer
async function handleSubmitAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { question_id, answer_text } = body;
  if (!question_id) return err('question_id required');

  const db = await getDb();

  const existing = await db.collection('assessment_answers').findOne({
    user_id: user.id,
    question_id,
  });

  if (existing) {
    await db.collection('assessment_answers').updateOne(
      { user_id: user.id, question_id },
      { $set: { answer_text, updated_at: new Date() } }
    );
  } else {
    await db.collection('assessment_answers').insertOne({
      id: uuidv4(),
      user_id: user.id,
      question_id,
      answer_text: answer_text || '',
      created_at: new Date(),
    });
  }

  return ok({ success: true });
}

// ASSESSMENT - Complete
async function handleAssessmentComplete(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { assistant_name } = body;

  const db = await getDb();
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: { assistant_name: assistant_name || 'SoulPrint', assessment_complete: true } }
  );

  return ok({ success: true });
}

// ASSESSMENT - Reset
async function handleResetAssessment(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  const currentAnswers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();
  
  if (currentAnswers.length > 0) {
    await db.collection('assessment_history').insertOne({
      user_id: user.id,
      answers: currentAnswers,
      archived_at: new Date(),
    });
    
    await db.collection('assessment_answers').deleteMany({ user_id: user.id });
  }
  
  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { assessment_complete: false } }
  );
  
  return ok({ 
    success: true, 
    message: 'Assessment reset. You can now retake the 36-question guide.',
    previousAnswers: currentAnswers.length
  });
}

export {
  handleGetQuestions,
  handleGetProgress,
  handleSubmitAnswer,
  handleAssessmentComplete,
  handleResetAssessment,
};
