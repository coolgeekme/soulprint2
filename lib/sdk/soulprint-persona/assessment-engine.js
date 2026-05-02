/**
 * Assessment Engine — Converts assessment answers into persona axis scores.
 *
 * Pure function: takes assessment data in, returns axis scores out.
 * No database, no network, no side effects.
 *
 * Zero dependencies. Pure JavaScript.
 */

import { DEFAULT_AXES, PILLAR_TO_AXIS_MAP } from './persona-axes.js';

/**
 * Convert assessment pillar scores into persona axes.
 *
 * @param {Object<string, number[]>} pillarAnswers - Map of pillar name → array of numeric scores (0-100)
 *   Example: { communication: [65, 40, 80, 55, 70, 50], emotional_intelligence: [30, 70, ...], ... }
 *
 * @returns {{ axes: Object<string, number>, pillarAverages: Object<string, number>, source: string }}
 */
export function computeAxesFromPillarScores(pillarAnswers) {
  if (!pillarAnswers || typeof pillarAnswers !== 'object') {
    return { axes: { ...DEFAULT_AXES }, pillarAverages: {}, source: 'default' };
  }

  // 1. Calculate pillar averages
  const pillarAverages = {};
  let totalAnswered = 0;

  for (const [pillar, scores] of Object.entries(pillarAnswers)) {
    if (!Array.isArray(scores) || scores.length === 0) continue;
    const validScores = scores.filter(s => typeof s === 'number' && s >= 0 && s <= 100);
    if (validScores.length === 0) continue;

    pillarAverages[pillar] = Math.round(
      validScores.reduce((sum, v) => sum + v, 0) / validScores.length
    );
    totalAnswered += validScores.length;
  }

  if (totalAnswered === 0) {
    return { axes: { ...DEFAULT_AXES }, pillarAverages: {}, source: 'default' };
  }

  // 2. Convert pillar averages to persona axes via weighted mapping
  const axes = { ...DEFAULT_AXES };
  const axisContributions = {};

  for (const [pillar, avg] of Object.entries(pillarAverages)) {
    const mappings = PILLAR_TO_AXIS_MAP[pillar];
    if (!mappings) continue;

    for (const [axis, weight] of Object.entries(mappings)) {
      if (!axisContributions[axis]) {
        axisContributions[axis] = { total: 0, weight: 0 };
      }
      axisContributions[axis].total += avg * weight;
      axisContributions[axis].weight += weight;
    }
  }

  // Normalize
  for (const [axis, contrib] of Object.entries(axisContributions)) {
    if (contrib.weight > 0) {
      axes[axis] = Math.round(contrib.total / contrib.weight);
    }
  }

  return {
    axes,
    pillarAverages,
    answeredCount: totalAnswered,
    pillarsEvaluated: Object.keys(pillarAverages).length,
    source: 'assessment',
  };
}

/**
 * Blend two sets of axes together with configurable weights.
 * Useful for merging assessment results with behavioral analysis.
 *
 * @param {Object<string, number>} primary - Primary axis values (higher trust)
 * @param {Object<string, number>} secondary - Secondary axis values (lower trust)
 * @param {number} primaryWeight - Weight for primary (0-1), secondary gets remainder
 * @returns {Object<string, number>} Blended axes
 */
export function blendAxes(primary, secondary, primaryWeight = 0.7) {
  const blended = { ...DEFAULT_AXES };
  const secondaryWeight = 1 - primaryWeight;

  for (const axis of Object.keys(DEFAULT_AXES)) {
    const p = primary?.[axis] ?? DEFAULT_AXES[axis];
    const s = secondary?.[axis] ?? DEFAULT_AXES[axis];

    // Only blend if primary differs from default (i.e., has real data)
    if (p !== DEFAULT_AXES[axis]) {
      blended[axis] = Math.round(p * primaryWeight + s * secondaryWeight);
    } else {
      // Primary has no data — use secondary fully
      blended[axis] = s;
    }
  }

  return blended;
}

/**
 * Apply user manual overrides (4 simplified dials) to the 10 axes.
 *
 * @param {Object<string, number>} axes - Current axis values
 * @param {Object<string, number>} overrides - Manual overrides { directness?, warmth?, playfulness?, challenge? }
 * @returns {Object<string, number>} Modified axes
 */
export function applyOverrides(axes, overrides) {
  if (!overrides || typeof overrides !== 'object') return { ...axes };

  const result = { ...axes };

  if (typeof overrides.directness === 'number') {
    result.directness = Math.round(overrides.directness * 0.7 + axes.directness * 0.3);
    result.formality = Math.round((100 - overrides.directness) * 0.7 + axes.formality * 0.3);
  }
  if (typeof overrides.warmth === 'number') {
    result.warmth = Math.round(overrides.warmth * 0.6 + axes.warmth * 0.4);
    result.emotionalDepth = Math.round(overrides.warmth * 0.5 + axes.emotionalDepth * 0.5);
    result.expressiveness = Math.round(overrides.warmth * 0.5 + axes.expressiveness * 0.5);
  }
  if (typeof overrides.playfulness === 'number') {
    result.humor = Math.round(overrides.playfulness * 0.7 + axes.humor * 0.3);
    result.pace = Math.round(overrides.playfulness * 0.5 + axes.pace * 0.5);
  }
  if (typeof overrides.challenge === 'number') {
    result.challenge = Math.round(overrides.challenge * 0.7 + axes.challenge * 0.3);
    result.autonomy = Math.round(overrides.challenge * 0.5 + axes.autonomy * 0.5);
  }

  return result;
}
