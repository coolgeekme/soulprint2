# SoulPrint Product Requirements Document

## Overview
SoulPrint is an AI-powered personal assistant that learns and adapts to each user's unique personality, communication style, and preferences through deep personalization.

---

## Current Features (Implemented)
- ✅ AI Chat with multiple models (GPT-4o, Claude, Perplexity, Gemini, etc.)
- ✅ Voice Chat (OpenAI Realtime API)
- ✅ SoulPrint personality profiling
- ✅ Memory system (long-term context)
- ✅ Google integrations (Calendar, Gmail, Docs, Sheets)
- ✅ Telegram bot integration
- ✅ ChatGPT history import
- ✅ Image/Media generation
- ✅ Web search (Brave/Tavily)
- ✅ Admin dashboard with business insights
- ✅ Dynamic Intelligence (smart model routing)

---

## Planned Features

### 🎯 FEATURE: Skills & Marketplace System
**Status:** Planned (Starting next week)
**Priority:** High
**Similar to:** Custom GPTs (ChatGPT), Projects (Claude)

#### Concept
User-created "skills" - markdown-based instruction templates that can be saved, shared, and reused. Skills allow users to replicate specific tasks/instructions with customizable parameters.

#### Example Skill
```markdown
Name: Morning AI News Briefing
Category: Research / News
Schedule: Daily at 7am
Variables: {topic}, {count}, {timeframe}

Instructions:
"Search for {topic} news published in the last {timeframe}. 
Provide at least {count} stories with:
- Overall summary of the day's news
- Individual story summaries  
- Links to original articles"

Default Values:
- topic: "Artificial Intelligence"
- count: 5
- timeframe: "24 hours"
```

#### Implementation Phases

**Phase 1: Personal Skills (Core)**
- [ ] Database schema for skills (title, description, instructions, variables, category)
- [ ] CRUD API endpoints for skills
- [ ] UI for creating/editing skills (markdown editor)
- [ ] Skill execution from chat ("Run my Morning News skill")
- [ ] Variable substitution system (`{topic}` → user input)
- [ ] Skill categories (Productivity, Research, Writing, Creative, etc.)
- [ ] Personal skills library

**Phase 2: Scheduling & Automation**
- [ ] Time-based triggers ("Every day at 7am")
- [ ] Recurring schedules (daily, weekly, monthly, custom cron)
- [ ] Background job system for scheduled execution
- [ ] Notification delivery options:
  - In-app notifications
  - Email delivery
  - Telegram delivery
- [ ] Execution history/logs

**Phase 3: Marketplace**
- [ ] Public skills marketplace
- [ ] Browse/search/filter skills
- [ ] Categories and tags
- [ ] Skill ratings and reviews
- [ ] Usage statistics (how many users use a skill)
- [ ] Fork/clone skills to customize
- [ ] Featured/trending skills
- [ ] Creator profiles

**Phase 4: Security & Monetization**
- [ ] Automated security scanning before publishing:
  - Malicious pattern detection
  - Prompt injection prevention
  - Data exfiltration checks
  - Content moderation (inappropriate content)
- [ ] Skill approval workflow
- [ ] Future monetization:
  - Free vs premium skills
  - Creator pricing (set your own price)
  - Revenue sharing model
  - Subscription bundles

#### Technical Considerations
- Skills stored as structured JSON with markdown instructions
- Variable system using `{variable_name}` syntax
- Scheduling via node-cron or similar
- Security scanner using regex patterns + AI-based content analysis
- Marketplace search using MongoDB text indexes

#### UI/UX Decisions (To Be Made)
1. **Access Point:** Sidebar section in chat vs separate /skills page vs both
2. **Skill Editor:** Simple textarea vs rich markdown editor
3. **Variable Input:** Inline prompts vs form-based input
4. **Marketplace Discovery:** Grid view vs list view, filtering options

#### Database Schema (Draft)
```javascript
// skills collection
{
  id: "uuid",
  creator_id: "user_id",
  title: "Morning AI News Briefing",
  description: "Get daily AI news summary",
  instructions: "Search for {topic} news...",
  variables: [
    { name: "topic", default: "Artificial Intelligence", type: "text" },
    { name: "count", default: 5, type: "number" },
  ],
  category: "research",
  tags: ["news", "ai", "daily"],
  icon: "📰",
  is_public: false,
  is_approved: false,
  schedule: {
    enabled: true,
    cron: "0 7 * * *", // 7am daily
    timezone: "America/New_York"
  },
  stats: {
    uses: 0,
    forks: 0,
    rating: 0,
    reviews: 0
  },
  created_at: Date,
  updated_at: Date
}

// skill_executions collection
{
  id: "uuid",
  skill_id: "skill_id",
  user_id: "user_id",
  variables_used: { topic: "Machine Learning", count: 10 },
  result: "...",
  triggered_by: "schedule" | "manual",
  created_at: Date
}
```

---

## Backlog / Future Ideas
- Autonomous AI Agents
- Badge System for Invites
- Slack Bot improvements
- Desktop app (Electron)
- Mobile app (React Native)
- API access for developers
- Team/workspace features

---

## Known Issues
- Slack Bot usability needs improvement
- Desktop microphone verification pending

---

*Last Updated: March 14, 2026*
