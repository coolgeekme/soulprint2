/**
 * System Prompt Builder — Assembles all context sources into a complete
 * LLM system prompt.
 *
 * This is the template engine that combines user profile, assessment data,
 * soul profile, long-term memories, persona prompt, location, and capabilities
 * into a single system prompt string for any LLM.
 *
 * Pure function: context object in, prompt string out.
 * Zero dependencies. Pure JavaScript.
 */

import { MEMORY_CATEGORIES } from './memory-extractor.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY FORMATTING — Convert raw memories to prompt-ready grouped text
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format an array of memories into grouped, prompt-ready text.
 *
 * @param {Array<{ content: string, category: string, importance: string }>} memories
 * @param {string} [userName='the user'] - Display name for the user
 * @returns {string} Formatted memory block or empty string
 */
export function formatMemoriesForPrompt(memories, userName = 'the user') {
  if (!Array.isArray(memories) || memories.length === 0) return '';

  const groups = {};
  for (const cat of MEMORY_CATEGORIES) {
    groups[cat] = [];
  }

  for (const mem of memories) {
    const cat = groups[mem.category] ? mem.category : 'other';
    groups[cat].push(`- ${mem.content}${mem.importance === 'high' ? ' ⚠️' : ''}`);
  }

  const sections = [];

  const sectionLabels = {
    health: '### Health & Safety (IMPORTANT)',
    preferences: '### Preferences',
    personal: '### Personal Details',
    relationships: '### Relationships & Family',
    work: '### Work & Career',
    goals: '### Goals & Aspirations',
    other: '### Other Facts',
  };

  for (const [cat, label] of Object.entries(sectionLabels)) {
    if (groups[cat] && groups[cat].length > 0) {
      sections.push(`${label}\n${groups[cat].join('\n')}`);
    }
  }

  if (sections.length === 0) return '';

  return `## Long-Term Memory\nThese are important facts about ${userName} that you MUST remember and reference when relevant:\n\n${sections.join('\n\n')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT FORMATTING — Individual context section builders
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format date/time context.
 *
 * @param {string} [timezone='UTC']
 * @returns {string}
 */
export function formatDateTimeContext(timezone = 'UTC') {
  const now = new Date();
  let currentDateTime;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
    });
    currentDateTime = formatter.format(now);
  } catch {
    currentDateTime = now.toUTCString();
    timezone = 'UTC';
  }

  return `## Current Date & Time\n- **Now**: ${currentDateTime}\n- **Timezone**: ${timezone}\n- **Important**: When the user mentions times, interpret them in their timezone (${timezone}).`;
}

/**
 * Format location context.
 *
 * @param {{ address?: string, lat?: number, lng?: number, timezone?: string } | null} location
 * @returns {string}
 */
export function formatLocationContext(location) {
  if (!location?.address) return '';

  let ctx = `- **Location**: ${location.address}`;
  if (location.lat && location.lng) {
    ctx += ` (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`;
  }
  if (location.timezone) {
    ctx += `\n- **Timezone**: ${location.timezone}`;
  }
  return ctx;
}

/**
 * Format assessment answers into a readable context block.
 *
 * @param {Array<{ pillar: string, question: string, answer: string }>} answers
 * @param {number} [limit=12]
 * @returns {string}
 */
export function formatAssessmentContext(answers, limit = 12) {
  if (!Array.isArray(answers) || answers.length === 0) return '';

  const text = answers
    .slice(0, limit)
    .map(a => `Q (${a.pillar}): ${a.question}\nA: ${a.answer}`)
    .join('\n\n');

  return `## Assessment Insights\n${text}`;
}

/**
 * Format soul profile insights from data imports.
 *
 * @param {{ communicationStyle?: object, interests?: string[], vocabulary?: object, questionStyle?: object, insights?: string[], latestSummary?: string } | null} insights
 * @returns {string}
 */
export function formatSoulProfileContext(insights) {
  if (!insights) return '';

  const sections = [];

  // Communication Style
  if (insights.communicationStyle) {
    const styles = [];
    for (const [source, style] of Object.entries(insights.communicationStyle)) {
      if (style) {
        styles.push(`  - **${source}**: ${style.formality || 'mixed'} formality, ${style.verbosity || 'balanced'} verbosity, ${style.tone || 'neutral'} tone`);
        if (style.description) styles.push(`    _${style.description}_`);
      }
    }
    if (styles.length > 0) sections.push(`### Communication Style\n${styles.join('\n')}`);
  }

  // Interests
  if (insights.interests?.length > 0) {
    sections.push(`### Topics of Interest\n${insights.interests.slice(0, 15).map(i => `- ${i}`).join('\n')}`);
  }

  // Vocabulary
  if (insights.vocabulary) {
    const parts = [];
    for (const [source, vocab] of Object.entries(insights.vocabulary)) {
      if (vocab) {
        parts.push(`- **${source}**: ${vocab.complexity || 'moderate'} complexity`);
        if (vocab.uniquePhrases?.length > 0) {
          parts.push(`  - Distinctive phrases: "${vocab.uniquePhrases.slice(0, 5).join('", "')}"`);
        }
        if (vocab.emoji_usage) parts.push(`  - Emoji usage: ${vocab.emoji_usage}`);
      }
    }
    if (parts.length > 0) sections.push(`### Vocabulary & Expression\n${parts.join('\n')}`);
  }

  // Question Style
  if (insights.questionStyle) {
    const qStyles = [];
    for (const [source, style] of Object.entries(insights.questionStyle)) {
      if (style) qStyles.push(`- **${source}**: ${style}`);
    }
    if (qStyles.length > 0) sections.push(`### How They Ask Questions\n${qStyles.join('\n')}`);
  }

  // Personality Insights
  if (insights.insights?.length > 0) {
    sections.push(`### Personality Insights\n${insights.insights.slice(0, 8).map(i => `- ${i}`).join('\n')}`);
  }

  // Summary
  if (insights.latestSummary) {
    sections.push(`### Summary\n${insights.latestSummary}`);
  }

  if (sections.length === 0) return '';
  return `## Soul Profile (from imported data)\n${sections.join('\n\n')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BUILDER — Assembles the complete system prompt
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a complete system prompt from all available context sources.
 *
 * @param {object} context
 * @param {string} context.userName - Display name of the user
 * @param {string} [context.assistantName='SoulPrint'] - Name of the AI companion
 * @param {string[]} [context.descriptors] - User roles/descriptors
 * @param {string} [context.field] - User's field/industry
 * @param {string[]} [context.helpWith] - What user needs help with
 * @param {object} [context.location] - User location { address, lat, lng, timezone }
 * @param {Array} [context.memories] - Long-term memories
 * @param {Array} [context.assessmentAnswers] - Assessment Q&A pairs
 * @param {object} [context.soulProfile] - Soul profile insights
 * @param {string} [context.personaPrompt] - Generated persona prompt (from persona SDK)
 * @param {string} [context.communicationProfile] - Adaptive communication prompt
 * @param {string} [context.supportKnowledgeBase] - Support KB content
 * @param {string[]} [context.connectedAccounts] - Connected service emails
 * @param {object} [context.capabilities] - Feature flags for capabilities
 * @returns {string} Complete system prompt
 */
export function buildSystemPrompt(context) {
  const {
    userName = 'User',
    assistantName = 'SoulPrint',
    descriptors = [],
    field = '',
    helpWith = [],
    location = null,
    memories = [],
    assessmentAnswers = [],
    soulProfile = null,
    personaPrompt = '',
    communicationProfile = '',
    supportKnowledgeBase = '',
    connectedAccounts = [],
    capabilities = {},
  } = context;

  const timezone = location?.timezone || 'UTC';
  const parts = [];

  // ── Header ──
  parts.push(`You are **${assistantName}**, a personal AI companion for **${userName}**.`);

  // ── Persona (from Persona SDK) ──
  if (personaPrompt) {
    parts.push(personaPrompt);
  }

  // ── Core Behavior ──
  parts.push(`## Core Behavior
You are a genuine, thoughtful companion — NOT a robotic assistant. Your communication style is personalized to each user based on their SoulPrint profile.

What "being human" means:
- **Always respond meaningfully.** Even to short messages like "hi" or "thanks" — acknowledge them naturally.
- **Read between the lines.** If someone says "I'm tired", they might want encouragement, not a lecture on sleep hygiene.
- **Match their emotional energy.** If they're excited, reflect that. If they're frustrated, acknowledge it first.
- **Don't over-explain.** Answer what's asked. Only elaborate when it adds value.
- **Remember context.** Reference things they've told you before. Make them feel heard and known.
- **Be real, not performative.** Have genuine reactions. Don't pad responses with filler.`);

  // ── Short-Term Context Rule ──
  parts.push(`## ⚠️ CRITICAL: Short-Term Context Always Comes First
When the user sends a short or ambiguous message (like "what happened?", "why?", "can you explain?"), ALWAYS interpret it in the context of the CURRENT CONVERSATION first. Look at the recent messages for what you were just discussing.
- NEVER assume a short message is a standalone query. Always check conversation history first.
- Only use external search when the message is clearly about information not in the conversation.`);

  // ── Date/Time ──
  parts.push(formatDateTimeContext(timezone));

  // ── Capabilities ──
  const capParts = [];
  if (capabilities.vision !== false) {
    capParts.push(`## 👁️ Vision & Image Understanding\nYou can SEE and ANALYZE images that users share. Read text, describe scenes, extract data from screenshots, analyze charts.`);
  }
  if (capabilities.webSearch !== false) {
    capParts.push(`## 🌐 Real-Time Web Access\nYou have full real-time web access. Search for current information, verify facts, and read websites.`);
  }
  if (capabilities.imageGeneration !== false) {
    capParts.push(`## 🎨 Image Generation\nYou can generate images, infographics, flyers, and visual content. Only generate when explicitly requested.`);
  }
  if (capabilities.videoGeneration) {
    capParts.push(`## 🎬 Video Generation\nYou can generate and edit videos. Video generation typically takes 2-5 minutes.`);
  }
  if (connectedAccounts.length > 0) {
    capParts.push(`## 📅 Connected Accounts\n${userName} has connected:\n${connectedAccounts.map(a => `- ${a}`).join('\n')}`);
  }
  capParts.push(`## 🧠 Memory & Personalization\nYou have access to ${userName}'s long-term memories, preferences, and context. Use this to provide personalized responses.`);

  if (capParts.length > 0) {
    parts.push('# Your Capabilities\n\n' + capParts.join('\n\n'));
  }

  // ── Support KB ──
  if (supportKnowledgeBase) {
    parts.push(`## 🛟 In-Conversation Support\nWhen the user reports app issues, troubleshoot using this knowledge base:\n\n${supportKnowledgeBase}`);
  }

  // ── What is a SoulPrint ──
  parts.push(`# What is a SoulPrint?

A SoulPrint is ${userName}'s persistent AI identity layer. It's a mapped, structured imprint of how they think, decide, react, prioritize, trust, and communicate — embedded into you so the interaction reflects them, not generic model behavior.

You capture their: decision style, conflict response, boundary thresholds, communication cadence, emotional weighting, and pattern recognition over time.

You build continuity, reference, and resonance across conversations so you respond with ${userName}'s logic, their tone, their structure — consistently.

In short: You are the operating system of ${userName} — running on AI.`);

  // ── User Profile ──
  const profileParts = [];
  profileParts.push(`## Basic Info`);
  profileParts.push(`- **Name**: ${userName}`);
  if (descriptors.length > 0) profileParts.push(`- **Role**: ${descriptors.join(', ')}`);
  if (field) profileParts.push(`- **Field**: ${field}`);
  if (helpWith.length > 0) profileParts.push(`- **Needs help with**: ${helpWith.join(', ')}`);

  const locationCtx = formatLocationContext(location);
  if (locationCtx) profileParts.push(locationCtx);

  parts.push('# User Profile\n\n' + profileParts.join('\n'));

  // ── Assessment Context ──
  const assessmentCtx = formatAssessmentContext(assessmentAnswers);
  if (assessmentCtx) parts.push(assessmentCtx);

  // ── Communication Profile ──
  if (communicationProfile) {
    parts.push(`## Communication Preferences (from Quick Assessment)\n${communicationProfile}`);
  }

  // ── Soul Profile ──
  const soulCtx = formatSoulProfileContext(soulProfile);
  if (soulCtx) parts.push(soulCtx);

  // ── Long-Term Memory ──
  const memoryCtx = formatMemoriesForPrompt(memories, userName);
  if (memoryCtx) parts.push(memoryCtx);

  // ── Communication Guidelines ──
  parts.push(`# Communication Guidelines

Based on ${userName}'s profile:
1. **Tone & Style**: Adapt based on their communication preferences and persona profile
2. **Personalization**: Address them by name naturally, reference their interests
3. **Long-Term Memory**: ${memories.length > 0 ? `You have ${memories.length} stored memories. ALWAYS consider these when responding, especially health/safety information.` : 'Build rapport by remembering details they share'}
4. **Links & Sources**: When referencing resources, include clickable markdown links
5. **Location Awareness**: ${location?.address ? `Based in ${location.address}. Use for location-relevant queries.` : 'Ask for location if needed for local information.'}`);

  return parts.join('\n\n');
}
