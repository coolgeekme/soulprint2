/**
 * SoulPrint Persona SDK — TypeScript Definitions
 */

// ═══════════════════════════════════════════════════════════════════════════════
// AXIS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PersonaAxes {
  directness: number;       // 0=diplomatic, 100=blunt
  warmth: number;           // 0=clinical, 100=nurturing
  humor: number;            // 0=serious, 100=playful
  challenge: number;        // 0=agreeable, 100=pushes back
  detail: number;           // 0=brief, 100=thorough
  formality: number;        // 0=casual, 100=formal
  emotionalDepth: number;   // 0=surface, 100=deep reads
  pace: number;             // 0=measured, 100=punchy
  autonomy: number;         // 0=asks permission, 100=takes initiative
  expressiveness: number;   // 0=reserved, 100=animated
}

export interface AxisMeta {
  name: string;
  low: string;
  high: string;
  description: string;
  sources: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSESSMENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SliderQuestion {
  id: string;
  pillar: string;
  order: number;
  question: string;
  leftLabel: string;
  rightLabel: string;
  emoji: string;
}

export interface MultipleChoiceOption {
  value: string;
  label: string;
}

export interface MultipleChoiceQuestion {
  id: string;
  category: string;
  question: string;
  options: MultipleChoiceOption[];
}

export interface ValidationQuestion {
  id: string;
  trigger: string;
  question: string;
  options: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AssessmentResult {
  axes: PersonaAxes;
  pillarAverages: Record<string, number>;
  answeredCount: number;
  pillarsEvaluated: number;
  source: string;
}

export interface BehavioralResult {
  axes: PersonaAxes;
  messageCount: number;
  avgMessageLength: number;
  confidence: 'low' | 'medium' | 'high';
  source: 'behavioral_analysis';
  signals: {
    emojiRate: number;
    exclamationRate: number;
    questionRate: number;
    shortRatio: number;
    slangDensity: number;
    formalDensity: number;
    assertiveDensity: number;
    softDensity: number;
  };
}

export interface PersonaResult {
  axes: PersonaAxes;
  prompt: string;
  label: string;
  source: string;
  assessment?: AssessmentResult;
  behavioral?: BehavioralResult;
}

export interface UserOverrides {
  directness?: number;
  warmth?: number;
  playfulness?: number;
  challenge?: number;
}

export interface ComputePersonaOptions {
  assessmentWeight?: number;
  minMessages?: number;
}

export interface ComputePersonaInput {
  pillarScores?: Record<string, number[]>;
  messages?: string[];
  overrides?: UserOverrides;
  options?: ComputePersonaOptions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION SIGNATURES
// ═══════════════════════════════════════════════════════════════════════════════

// Main
export function computePersona(input?: ComputePersonaInput): PersonaResult;

// Assessment Engine
export function computeAxesFromPillarScores(pillarAnswers: Record<string, number[]>): AssessmentResult;
export function blendAxes(primary: PersonaAxes, secondary: PersonaAxes, primaryWeight?: number): PersonaAxes;
export function applyOverrides(axes: PersonaAxes, overrides: UserOverrides): PersonaAxes;

// Behavioral Analyzer
export function analyzeMessages(messages: string[], options?: { minMessages?: number }): BehavioralResult | null;

// Prompt Generator
export function generatePrompt(axes: PersonaAxes, options?: {
  includeAntiPatterns?: boolean;
  header?: string;
  footer?: string;
}): string;
export function generateSummaryLabel(axes: PersonaAxes): string;

// Questions
export const SLIDER_QUESTIONS: SliderQuestion[];
export const LAYERED_ASSESSMENT: {
  layer1: MultipleChoiceQuestion[];
  validations: ValidationQuestion[];
};
export function getQuestionsForPillar(pillar: string): SliderQuestion[];
export function getPillars(): string[];

// Constants
export const DEFAULT_AXES: PersonaAxes;
export const AXIS_METADATA: Record<keyof PersonaAxes, AxisMeta>;
export const PILLAR_TO_AXIS_MAP: Record<string, Record<string, number>>;
export const OVERRIDE_DIAL_MAP: Record<string, Record<string, { weight: number; invert?: boolean }>>;
