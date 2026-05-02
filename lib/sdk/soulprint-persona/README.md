# SoulPrint Persona SDK

A framework-agnostic personality engine that converts user assessment data and/or chat history into a unique AI persona — a set of 10 behavioral axes that control how an AI communicates with each individual user.

Drop these files into any JavaScript/TypeScript project. Zero dependencies.

## Files

| File | Purpose |
|------|---------|
| `index.js` | Main entry point — single `computePersona()` call does everything |
| `persona-axes.js` | The 10 axis definitions, defaults, pillar mappings, and axis metadata |
| `assessment-engine.js` | Converts assessment scores into persona axes (pure math) |
| `behavioral-analyzer.js` | Derives personality from raw message text (statistical analysis) |
| `prompt-generator.js` | Converts axes into natural language system prompts for any LLM |
| `assessment-questions.js` | Complete question sets (36 slider + 12 quick-start + validations) |
| `types.d.ts` | TypeScript definitions |
| `THEORY.md` | Research foundations — academic sources for each axis |

## Quick Start

```javascript
import { computePersona } from './index.js';

// From assessment scores (6 pillars, each with an array of 0-100 values)
const persona = computePersona({
  pillarScores: {
    communication: [65, 40, 80, 55, 70, 50],
    emotional_intelligence: [30, 70, 55, 85, 40, 60],
    decision_making: [75, 20, 80, 50, 30, 65],
    social_dynamics: [45, 55, 70, 80, 35, 40],
    cognitive_style: [60, 40, 70, 30, 55, 80],
    assertiveness: [80, 30, 65, 75, 40, 50],
  }
});

console.log(persona.axes);   // { directness: 72, warmth: 55, humor: 48, ... }
console.log(persona.label);  // "Direct · Supportive · Detail-Oriented"
console.log(persona.prompt); // Full system prompt block for any LLM
```

## From Chat History (No Assessment Needed)

```javascript
import { computePersona } from './index.js';

// Pass an array of the user's raw message strings
const persona = computePersona({
  messages: [
    'hey whats up',
    'lol thats crazy!! 🔥',
    'nah i think we should go with option B tbh',
    'can you look up the latest stats on this?',
    'bruh just give me the short version',
    // ... (minimum 5 messages, 30+ recommended)
  ]
});

console.log(persona.axes);      // Derived from behavioral signals
console.log(persona.behavioral); // Detailed signal breakdown
```

## Blended (Assessment + Chat History)

```javascript
const persona = computePersona({
  pillarScores: { communication: [65, 40], emotional_intelligence: [30, 70] },
  messages: userChatHistory,
  options: { assessmentWeight: 0.7 }  // Assessment gets 70% weight
});
```

## Manual Overrides (4 User-Facing Dials)

```javascript
const persona = computePersona({
  pillarScores: { ... },
  overrides: {
    directness: 85,    // User wants more directness
    warmth: 70,        // User wants more warmth
    playfulness: 30,   // User wants less humor
    challenge: 60,     // User wants moderate pushback
  }
});
```

## Individual Module Usage

### Intent Detection from Assessment

```javascript
import { computeAxesFromPillarScores } from './assessment-engine.js';

const result = computeAxesFromPillarScores({
  communication: [65, 40, 80, 55, 70, 50],
  assertiveness: [80, 30, 65, 75, 40, 50],
});
// result.axes → { directness: 68, warmth: 60, ... }
// result.pillarAverages → { communication: 60, assertiveness: 57 }
```

### Behavioral Analysis

```javascript
import { analyzeMessages } from './behavioral-analyzer.js';

const analysis = analyzeMessages(userMessages);
// analysis.axes → { directness: 72, warmth: 45, humor: 68, ... }
// analysis.signals → { emojiRate: 0.3, slangDensity: 0.15, ... }
// analysis.confidence → 'medium'
```

### Prompt Generation

```javascript
import { generatePrompt, generateSummaryLabel } from './prompt-generator.js';

const prompt = generatePrompt({ directness: 85, warmth: 70, humor: 60, ... });
// Returns a multi-paragraph system prompt block

const label = generateSummaryLabel({ directness: 85, warmth: 70, humor: 60 });
// "Direct · Warm · Witty"
```

### Assessment Questions

```javascript
import { SLIDER_QUESTIONS, LAYERED_ASSESSMENT, getQuestionsForPillar } from './assessment-questions.js';

// Get all 36 slider questions
console.log(SLIDER_QUESTIONS.length); // 36

// Get questions for a specific pillar
const commQuestions = getQuestionsForPillar('communication'); // 6 questions

// Quick-start assessment (12 multiple-choice)
console.log(LAYERED_ASSESSMENT.layer1.length); // 12
```

## The 10 Axes

| Axis | Low (0) | High (100) | Controls |
|------|---------|------------|----------|
| **Directness** | Diplomatic & gentle | Blunt & no-filter | How directly the AI communicates |
| **Warmth** | Clinical & detached | Warm & nurturing | Emotional temperature |
| **Humor** | Serious & professional | Playful & witty | Levity and wit level |
| **Challenge** | Always agrees | Pushes back hard | Intellectual challenge level |
| **Detail** | Brief & concise | Thorough & in-depth | Response depth |
| **Formality** | Casual & slangy | Formal & professional | Linguistic register |
| **Emotional Depth** | Surface-level | Deep emotional reads | Emotional perception |
| **Pace** | Slow & measured | Fast & punchy | Response rhythm |
| **Autonomy** | Asks permission first | Takes initiative | Proactivity level |
| **Expressiveness** | Reserved & understated | Expressive & animated | Emotional vividness |

See `THEORY.md` for the full academic research behind each axis.

## Zero Dependencies

No npm packages required. Pure JavaScript with optional TypeScript definitions.
Works in Node.js, Deno, Bun, browsers, or any JS runtime.
