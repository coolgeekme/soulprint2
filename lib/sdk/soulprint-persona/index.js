/**
 * SoulPrint Persona SDK
 *
 * A framework-agnostic personality engine that converts user assessment data
 * and/or chat history into a unique AI persona — a set of 10 behavioral axes
 * that control how an AI communicates with each individual user.
 *
 * Drop this folder into any project and import from here.
 *
 * @example
 * import { computePersona, generatePrompt } from './index.js';
 *
 * // From assessment scores
 * const persona = computePersona({
 *   pillarScores: { communication: [65, 40, 80], emotional_intelligence: [30, 70, 55] }
 * });
 *
 * // From chat history
 * const persona2 = computePersona({
 *   messages: ['hey whats up', 'lol thats crazy', 'nah i think we should...', ...]
 * });
 *
 * // Generate the system prompt
 * const prompt = generatePrompt(persona.axes);
 * console.log(prompt);
 */

// Core exports
export { DEFAULT_AXES, AXIS_METADATA, PILLAR_TO_AXIS_MAP, OVERRIDE_DIAL_MAP } from './persona-axes.js';
export { computeAxesFromPillarScores, blendAxes, applyOverrides } from './assessment-engine.js';
export { analyzeMessages } from './behavioral-analyzer.js';
export { generatePrompt, generateSummaryLabel } from './prompt-generator.js';
export { SLIDER_QUESTIONS, LAYERED_ASSESSMENT, getQuestionsForPillar, getPillars } from './assessment-questions.js';

// Import for the convenience function
import { DEFAULT_AXES as DEFAULT_AXES_IMPORT } from './persona-axes.js';
import { computeAxesFromPillarScores, blendAxes, applyOverrides } from './assessment-engine.js';
import { analyzeMessages } from './behavioral-analyzer.js';
import { generatePrompt, generateSummaryLabel } from './prompt-generator.js';

/**
 * All-in-one persona computation.
 *
 * Accepts assessment data, chat messages, or both. When both are provided,
 * it blends them with assessment data taking priority.
 *
 * @param {object} input
 * @param {Object<string, number[]>} [input.pillarScores] - Assessment pillar scores
 * @param {string[]} [input.messages] - Array of user message strings
 * @param {Object<string, number>} [input.overrides] - Manual dial overrides
 * @param {object} [input.options]
 * @param {number} [input.options.assessmentWeight=0.7] - Weight for assessment vs behavioral data
 * @param {number} [input.options.minMessages=5] - Min messages for behavioral analysis
 * @returns {{ axes: Object<string, number>, prompt: string, label: string, source: string }}
 */
export function computePersona({ pillarScores, messages, overrides, options = {} } = {}) {
  const assessmentWeight = options.assessmentWeight || 0.7;

  let assessmentResult = null;
  let behavioralResult = null;

  // 1. Compute from assessment scores if available
  if (pillarScores && Object.keys(pillarScores).length > 0) {
    assessmentResult = computeAxesFromPillarScores(pillarScores);
  }

  // 2. Compute from message history if available
  if (messages && messages.length >= (options.minMessages || 5)) {
    behavioralResult = analyzeMessages(messages, { minMessages: options.minMessages || 5 });
  }

  // 3. Determine final axes
  let finalAxes;
  let source;

  if (assessmentResult && behavioralResult) {
    // Both sources available — blend them
    finalAxes = blendAxes(assessmentResult.axes, behavioralResult.axes, assessmentWeight);
    source = 'blended';
  } else if (assessmentResult) {
    finalAxes = assessmentResult.axes;
    source = 'assessment';
  } else if (behavioralResult) {
    finalAxes = behavioralResult.axes;
    source = 'behavioral_analysis';
  } else {
    // No data — return defaults
    finalAxes = { ...DEFAULT_AXES_IMPORT };
    source = 'default';
  }

  // 4. Apply manual overrides if provided
  if (overrides && Object.keys(overrides).length > 0) {
    finalAxes = applyOverrides(finalAxes, overrides);
    source += '+overrides';
  }

  return {
    axes: finalAxes,
    prompt: generatePrompt(finalAxes),
    label: generateSummaryLabel(finalAxes),
    source,
    assessment: assessmentResult || undefined,
    behavioral: behavioralResult || undefined,
  };
}
