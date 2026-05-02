/**
 * Profile Exporter — Generates human-readable markdown exports of a user's
 * complete SoulPrint profile.
 *
 * Pure function: structured profile data in, markdown string out.
 * Zero dependencies. Pure JavaScript.
 */

/**
 * Generate a complete profile markdown document.
 *
 * @param {object} data
 * @param {string} data.userName - Display name
 * @param {string} [data.email] - User email
 * @param {string} [data.assistantName='SoulPrint'] - AI companion name
 * @param {string[]} [data.descriptors] - Role descriptors
 * @param {string} [data.field] - Industry/field
 * @param {string[]} [data.helpWith] - Help topics
 * @param {object} [data.soulProfile] - Soul profile insights
 * @param {Array<{ pillar: string, question: string, answer: string }>} [data.assessmentAnswers] - Assessment Q&A
 * @param {Array<{ date: string, source: string, status: string }>} [data.imports] - Import history
 * @param {Array<{ content: string, category: string, importance: string }>} [data.memories] - User memories
 * @returns {string} Complete markdown document
 */
export function generateProfileMarkdown(data) {
  const {
    userName = 'User',
    email = 'N/A',
    assistantName = 'SoulPrint',
    descriptors = [],
    field = '',
    helpWith = [],
    soulProfile = null,
    assessmentAnswers = [],
    imports = [],
    memories = [],
  } = data;

  let md = `# ${userName}'s SoulPrint Profile\n\n`;
  md += `> Generated: ${new Date().toISOString().split('T')[0]}\n`;
  md += `> AI Companion: ${assistantName}\n\n`;

  // ── Basic Profile ──
  md += `## 👤 Basic Information\n\n`;
  md += `| Field | Value |\n|-------|-------|\n`;
  md += `| Name | ${userName} |\n`;
  md += `| Email | ${email} |\n`;
  md += `| Role | ${descriptors.join(', ') || 'Not specified'} |\n`;
  md += `| Field/Industry | ${field || 'Not specified'} |\n`;
  md += `| Needs Help With | ${helpWith.join(', ') || 'General assistance'} |\n\n`;

  // ── Soul Profile ──
  if (soulProfile) {
    md += `## 🧠 Soul Profile\n\n`;

    if (soulProfile.latestSummary) {
      md += `### Summary\n${soulProfile.latestSummary}\n\n`;
    }

    if (soulProfile.communicationStyle) {
      md += `### 💬 Communication Style\n\n`;
      for (const [source, style] of Object.entries(soulProfile.communicationStyle)) {
        if (style) {
          md += `**From ${source} data:**\n`;
          md += `- Formality: ${style.formality || 'mixed'}\n`;
          md += `- Verbosity: ${style.verbosity || 'balanced'}\n`;
          md += `- Tone: ${style.tone || 'neutral'}\n`;
          if (style.description) md += `- Description: _${style.description}_\n`;
          md += `\n`;
        }
      }
    }

    if (soulProfile.interests?.length > 0) {
      md += `### 🎯 Topics of Interest\n\n`;
      soulProfile.interests.forEach(i => { md += `- ${i}\n`; });
      md += `\n`;
    }

    if (soulProfile.vocabulary) {
      md += `### 📝 Vocabulary & Expression\n\n`;
      for (const [source, vocab] of Object.entries(soulProfile.vocabulary)) {
        if (vocab) {
          md += `**From ${source}:**\n`;
          md += `- Complexity: ${vocab.complexity || 'moderate'}\n`;
          if (vocab.uniquePhrases?.length > 0) {
            md += `- Distinctive phrases: "${vocab.uniquePhrases.slice(0, 5).join('", "')}"\n`;
          }
          if (vocab.emoji_usage) md += `- Emoji usage: ${vocab.emoji_usage}\n`;
          md += `\n`;
        }
      }
    }

    if (soulProfile.insights?.length > 0) {
      md += `### ✨ Personality Insights\n\n`;
      soulProfile.insights.forEach(i => { md += `- ${i}\n`; });
      md += `\n`;
    }

    if (soulProfile.sources?.length > 0) {
      md += `### 📊 Data Sources\n\nProfile built from: ${soulProfile.sources.join(', ')}\n\n`;
    }
  }

  // ── Assessment Answers ──
  if (assessmentAnswers.length > 0) {
    md += `## 📋 Assessment Responses\n\n`;
    md += `Completed ${assessmentAnswers.length} questions.\n\n`;

    const pillars = {};
    assessmentAnswers.forEach(a => {
      const pillar = a.pillar || 'other';
      if (!pillars[pillar]) pillars[pillar] = [];
      pillars[pillar].push(a);
    });

    for (const [pillar, qas] of Object.entries(pillars)) {
      md += `### ${pillar.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n\n`;
      qas.forEach(qa => {
        md += `**Q:** ${qa.question}\n`;
        md += `**A:** ${qa.answer}\n\n`;
      });
    }
  }

  // ── Memories ──
  if (memories.length > 0) {
    md += `## 🧠 Stored Memories\n\n`;
    md += `Total: ${memories.length} memories\n\n`;

    const grouped = {};
    memories.forEach(m => {
      const cat = m.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(m);
    });

    for (const [cat, mems] of Object.entries(grouped)) {
      md += `### ${cat.replace(/\b\w/g, c => c.toUpperCase())}\n\n`;
      mems.forEach(m => {
        md += `- ${m.content}${m.importance === 'high' ? ' ⚠️' : ''}\n`;
      });
      md += `\n`;
    }
  }

  // ── Import History ──
  if (imports.length > 0) {
    md += `## 📥 Import History\n\n`;
    md += `| Date | Source | Status |\n|------|--------|--------|\n`;
    imports.forEach(imp => {
      md += `| ${imp.date} | ${imp.source} | ${imp.status} |\n`;
    });
    md += `\n`;
  }

  md += `---\n*This profile is used to personalize your AI companion across all platforms.*\n`;

  return md;
}
