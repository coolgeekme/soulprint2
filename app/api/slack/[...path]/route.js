import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import { ok, err, authenticate } from '@/lib/api-utils';
import crypto from 'crypto';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_ESCALATION_USER_ID = process.env.SLACK_ESCALATION_USER_ID;

const SOULPRINT_KNOWLEDGE = {
  features: [
    'authentication', 'login', 'register', 'beta codes', 'firebase auth',
    'chat', 'conversations', 'messages', 'streaming', 'AI models',
    'projects', 'collaboration', 'sharing', 'folders',
    'assessment', 'questions', 'profile', 'soulprint',
    'media generation', 'images', 'videos', 'gallery',
    'data import', 'chatgpt', 'whatsapp', 'upload',
    'telegram', 'bot integration',
    'admin', 'users', 'metrics', 'feedback', 'announcements'
  ],
  commonIssues: {
    'login': {
      symptoms: ['invalid passcode', 'cant login', 'login failed', 'authentication error'],
      cause: 'Wrong passcode, user doesn\'t exist, or token expired',
      solution: 'Check if user exists in DB, verify passcode, or ask user to re-register',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleLogin'
    },
    'chat not working': {
      symptoms: ['ai not responding', 'no response', 'chat broken', 'streaming not working'],
      cause: 'Missing API key for selected model or streaming headers blocked',
      solution: 'Check env vars: OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. Verify next.config.js headers',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleChatStream'
    },
    'messages not loading': {
      symptoms: ['messages empty', 'conversation empty', 'no messages'],
      cause: 'Invalid conversation ID or conversation doesn\'t exist',
      solution: 'Verify conversationId in request, check conversations collection',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleGetMessages'
    },
    'assessment progress': {
      symptoms: ['progress 0%', 'progress wrong', 'completion not updating'],
      cause: 'Answers stored in multiple collections not being aggregated',
      solution: 'Check both assessment_answers AND gradual_assessment_progress collections',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleGetAssessmentProgress'
    },
    'projects': {
      symptoms: ['cant create project', 'project not showing', 'share not working'],
      cause: 'Auth token missing or project permissions issue',
      solution: 'Verify Authorization header, check project ownership in projects collection',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleGetProjects, handleCreateProject'
    },
    'media generation': {
      symptoms: ['image stuck', 'video not generating', 'generation failed'],
      cause: 'Kie.ai API issue or missing KIE_API_KEY',
      solution: 'Check KIE_API_KEY in env, verify API quota, check media_gallery collection',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleGenerateImage, handleGenerateVideo'
    },
    'import': {
      symptoms: ['upload failed', 'import stuck', 'file not processing'],
      cause: 'File too large or job stuck in queue',
      solution: 'Use chunked upload for files >5MB, check import_jobs collection for errors',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleChunkedUploadInit'
    },
    'telegram': {
      symptoms: ['telegram not connecting', 'bot not responding', 'link failed'],
      cause: 'Invalid bot token or webhook not set',
      solution: 'Verify TELEGRAM_BOT_TOKEN, check telegram_links collection',
      file: '/app/app/api/[[...path]]/route.js',
      function: 'handleTelegramWebhook'
    },
    'ui styling': {
      symptoms: ['text not visible', 'dropdown broken', 'layout broken', 'css issue'],
      cause: 'Tailwind class issues or dark mode styling',
      solution: 'Check element classes, use bg-[#1a1a1a] for dark backgrounds, verify text-white',
      file: '/app/app/chat/page.js or /app/components/mobile/MobileChat.js',
      function: 'N/A - CSS fix'
    },
    'mobile': {
      symptoms: ['input hidden', 'keyboard covering', 'android issue', 'ios issue'],
      cause: 'Safe area or viewport issues on mobile',
      solution: 'Add safe-area-bottom class, check pb-safe padding',
      file: '/app/components/mobile/MobileChat.js',
      function: 'N/A - CSS fix'
    }
  }
};


function analyzeIssue(text) {
  const lowerText = text.toLowerCase();
  
  // Check if it's about a known feature
  const mentionedFeatures = SOULPRINT_KNOWLEDGE.features.filter(f => lowerText.includes(f));
  
  // Find matching issues
  const matchedIssues = [];
  for (const [issue, data] of Object.entries(SOULPRINT_KNOWLEDGE.commonIssues)) {
    const matchScore = data.symptoms.filter(s => lowerText.includes(s)).length;
    if (matchScore > 0 || lowerText.includes(issue)) {
      matchedIssues.push({ issue, ...data, score: matchScore + (lowerText.includes(issue) ? 2 : 0) });
    }
  }
  
  // Sort by match score
  matchedIssues.sort((a, b) => b.score - a.score);
  
  return {
    isKnownFeature: mentionedFeatures.length > 0,
    features: mentionedFeatures,
    matchedIssues,
    bestMatch: matchedIssues[0] || null
  };
}


async function sendSlackMessage(channel, text, blocks = null) {
  if (!SLACK_BOT_TOKEN) return;
  
  const payload = { channel, text };
  if (blocks) payload.blocks = blocks;
  
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Slack send error:', err);
  }
}


async function escalateToOwner(originalMessage, channel, reason) {
  if (!SLACK_ESCALATION_USER_ID) return;
  
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚨 Issue Escalated for Review', emoji: true }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Reason:* ${reason}` }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Original Message:*\n>${originalMessage}` }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Channel:* <#${channel}>` }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Channel', emoji: true },
          url: `slack://channel?team=&id=${channel}`
        }
      ]
    }
  ];
  
  await sendSlackMessage(SLACK_ESCALATION_USER_ID, `Issue escalated: ${reason}`, blocks);
}


async function generateFixSuggestion(issue, analysis) {
  // Use OpenAI to generate a detailed fix
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null;
  
  const systemPrompt = `You are a SoulPrint app support bot. Given an issue report and analysis, provide a concise fix suggestion.
The app is built with Next.js, React, MongoDB, and uses multiple AI providers (OpenAI, Anthropic, Google).
Keep responses short and actionable. If you suggest code changes, be specific about file and function.`;

  const userPrompt = `Issue: ${issue}

Analysis found this likely cause:
- Problem: ${analysis.bestMatch?.cause || 'Unknown'}
- Typical solution: ${analysis.bestMatch?.solution || 'Needs investigation'}
- Relevant file: ${analysis.bestMatch?.file || 'Unknown'}
- Function: ${analysis.bestMatch?.function || 'Unknown'}

Provide a brief, actionable fix suggestion (2-3 sentences max). If it needs code changes, specify what to change.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.3
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('AI suggestion error:', err);
    return null;
  }
}


async function triageIssue(text, analysis) {
  const lowerText = text.toLowerCase();
  
  // Check against user error patterns
  for (const [errorType, data] of Object.entries(USER_ERROR_PATTERNS)) {
    const matchCount = data.keywords.filter(k => lowerText.includes(k)).length;
    if (matchCount >= 1) {
      return {
        isUserError: true,
        errorType,
        solution: data.solution,
        confidence: matchCount >= 2 ? 'high' : 'medium'
      };
    }
  }
  
  // Check for clear technical indicators
  const technicalIndicators = [
    'bug', 'broken', 'crash', 'error message', 'doesn\'t work anymore',
    'used to work', 'suddenly stopped', 'after update', '500 error', '404',
    'api error', 'server error', 'database', 'code', 'console error'
  ];
  
  const technicalScore = technicalIndicators.filter(i => lowerText.includes(i)).length;
  
  // Use AI for ambiguous cases
  if (technicalScore === 0 && !analysis.bestMatch) {
    const aiTriage = await aiTriageIssue(text);
    if (aiTriage) return aiTriage;
  }
  
  // Default to technical if we have a known issue match
  if (analysis.bestMatch) {
    return {
      isUserError: false,
      isTechnical: true,
      matchedIssue: analysis.bestMatch
    };
  }
  
  // Ambiguous - need more info
  return {
    isUserError: false,
    isTechnical: technicalScore > 0,
    needsMoreInfo: true
  };
}


async function aiTriageIssue(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null;
  
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a friendly support bot for SoulPrint, a personal AI assistant app. 
Analyze the user's issue and determine if it's:
1. USER_ERROR - Something the user can fix themselves (permissions, settings, how-to questions)
2. TECHNICAL_BUG - An actual bug/defect that needs developer attention

IMPORTANT: Write solutions in simple, friendly language that a non-technical person can follow. 
- Avoid technical jargon (don't say "cache", "JSON", "API", "debug", etc.)
- Use everyday words and numbered steps
- Add friendly emojis to make it feel approachable
- Be encouraging and supportive

Respond ONLY with a JSON object:
{
  "classification": "USER_ERROR" or "TECHNICAL_BUG",
  "confidence": "high", "medium", or "low",
  "reason": "brief explanation",
  "userSolution": "if USER_ERROR, provide simple step-by-step help written for someone who isn't good with technology" 
}`
        },
        {
          role: 'user',
          content: `Triage this issue: "${text}"`
        }
      ],
      max_tokens: 600,
      temperature: 0.3
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isUserError: parsed.classification === 'USER_ERROR',
        isTechnical: parsed.classification === 'TECHNICAL_BUG',
        confidence: parsed.confidence,
        reason: parsed.reason,
        solution: parsed.userSolution
      };
    }
  } catch (err) {
    console.error('AI triage error:', err);
  }
  return null;
}


function getConversationState(channelUserId) {
  return supportConversations.get(channelUserId) || null;
}


function setConversationState(channelUserId, state) {
  // Auto-expire after 30 minutes
  state.expiresAt = Date.now() + (30 * 60 * 1000);
  supportConversations.set(channelUserId, state);
  
  // Clean up expired conversations
  const now = Date.now();
  for (const [key, conv] of supportConversations) {
    if (conv.expiresAt < now) {
      supportConversations.delete(key);
    }
  }
}


function clearConversationState(channelUserId) {
  supportConversations.delete(channelUserId);
}


function categorizeIssue(text, analysis) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('error') || lowerText.includes('crash') || lowerText.includes('broken') || lowerText.includes('fail')) {
    return 'error';
  }
  if (lowerText.includes('slow') || lowerText.includes('loading') || lowerText.includes('stuck') || lowerText.includes('freeze')) {
    return 'performance';
  }
  if (lowerText.includes('feature') || lowerText.includes('button') || lowerText.includes('option') || lowerText.includes('setting')) {
    return 'feature';
  }
  return 'general';
}


function restateIssue(originalMessage, details = {}) {
  let restatement = `Let me make sure I understand correctly:\n\n`;
  restatement += `📝 *You reported:* "${originalMessage}"`;
  
  if (details.device) {
    restatement += `\n📱 *Device/Browser:* ${details.device}`;
  }
  if (details.steps) {
    restatement += `\n🔄 *Steps to reproduce:* ${details.steps}`;
  }
  if (details.errorMessage) {
    restatement += `\n⚠️ *Error message:* ${details.errorMessage}`;
  }
  if (details.frequency) {
    restatement += `\n🔁 *Frequency:* ${details.frequency}`;
  }
  
  return restatement;
}


const supportConversations = new Map();

const CONV_STATE = {
  INITIAL: 'initial',
  TRIAGE: 'triage', // New state for determining user error vs technical
  HELPING_USER: 'helping_user', // State when providing user assistance
  GATHERING_DETAILS: 'gathering_details',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  ESCALATED: 'escalated'
};



// ============================================================
// SLACK HANDLER FUNCTIONS
// ============================================================

async function handleSlackWebhook(request) {
  try {
    const body = await request.json();
    
    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      return ok({ challenge: body.challenge });
    }
    
    // Handle events
    if (body.type === 'event_callback') {
      const event = body.event;
      
      // Ignore bot messages to prevent loops
      if (event.bot_id || event.subtype === 'bot_message') {
        return ok({ ok: true });
      }
      
      // Handle direct messages and mentions
      if (event.type === 'message' || event.type === 'app_mention') {
        const text = event.text || '';
        const channel = event.channel;
        const user = event.user;
        const channelUserId = `${channel}-${user}`;
        
        // Remove bot mention from text
        const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();
        
        // Handle empty messages
        if (!cleanText) {
          await sendSlackMessage(channel, "Hi! I'm the SoulPrint Support Bot. 👋\n\nDescribe any issue you're experiencing with the app and I'll help gather the details to get it resolved quickly.");
          return ok({ ok: true });
        }
        
        // Check for existing conversation
        let convState = getConversationState(channelUserId);
        
        // Handle special commands
        const lowerText = cleanText.toLowerCase();
        if (lowerText === 'reset' || lowerText === 'start over' || lowerText === 'cancel') {
          clearConversationState(channelUserId);
          await sendSlackMessage(channel, "No problem! Let's start fresh. 🔄\n\nWhat issue would you like to report?");
          return ok({ ok: true });
        }
        
        if (lowerText === 'done' || lowerText === 'submit' || lowerText === 'send' || lowerText === 'escalate') {
          if (convState && convState.originalMessage) {
            // User wants to submit what we have
            await handleEscalation(channel, user, convState);
            clearConversationState(channelUserId);
            return ok({ ok: true });
          }
        }
        
        // INITIAL STATE - First message
        if (!convState) {
          const analysis = analyzeIssue(cleanText);
          const category = categorizeIssue(cleanText, analysis);
          
          // First, triage the issue to determine if it's user error or technical
          const triage = await triageIssue(cleanText, analysis);
          
          // If it's clearly a user error, provide immediate assistance
          if (triage.isUserError && triage.solution) {
            // Create conversation state in case user needs follow-up
            convState = {
              state: CONV_STATE.HELPING_USER,
              originalMessage: cleanText,
              analysis,
              category,
              triage,
              details: {},
              messages: [cleanText],
              createdAt: Date.now()
            };
            setConversationState(channelUserId, convState);
            
            const helpResponse = `I think I can help with this! 🤔\n\n${triage.solution}\n\n---\n_If this doesn't solve your problem, reply *"still not working"* or *"need more help"* and I'll escalate to the dev team._`;
            
            await sendSlackMessage(channel, helpResponse);
            return ok({ ok: true });
          }
          
          // If it's technical or needs more info, start gathering details
          convState = {
            state: CONV_STATE.GATHERING_DETAILS,
            originalMessage: cleanText,
            analysis,
            category,
            triage,
            details: {},
            followUpIndex: 0,
            messages: [cleanText],
            createdAt: Date.now()
          };
          
          setConversationState(channelUserId, convState);
          
          // If clearly technical, acknowledge and start gathering info
          if (triage.isTechnical) {
            const restatement = restateIssue(cleanText);
            const questions = FOLLOW_UP_QUESTIONS[category] || FOLLOW_UP_QUESTIONS.general;
            const firstQuestion = questions[0];
            
            const response = `This looks like a technical issue that may need developer attention. 🔧\n\n${restatement}\n\n*To help the team fix this quickly, I need a few details:*\n\n❓ ${firstQuestion}\n\n_(Type "done" anytime to submit your report, or "reset" to start over)_`;
            
            await sendSlackMessage(channel, response);
          } else {
            // Ambiguous - ask clarifying question first
            const response = `Thanks for reaching out! 👋\n\nBefore I can help, I need to understand the issue better:\n\n❓ Is this something that *used to work* and stopped working, or are you *trying to do something for the first time*?\n\nThis helps me know if it's a setup issue I can help with, or a bug that needs the dev team.`;
            
            await sendSlackMessage(channel, response);
          }
          
          return ok({ ok: true });
        }
        
        // HELPING_USER STATE - User received troubleshooting help
        if (convState.state === CONV_STATE.HELPING_USER) {
          const stillNeedsHelp = lowerText.includes('not working') || 
                                 lowerText.includes('still') || 
                                 lowerText.includes('didn\'t help') ||
                                 lowerText.includes('need more help') ||
                                 lowerText.includes('doesn\'t work') ||
                                 lowerText.includes('nope') ||
                                 lowerText.includes('no luck');
          
          const resolved = lowerText.includes('thanks') ||
                          lowerText.includes('worked') ||
                          lowerText.includes('fixed') ||
                          lowerText.includes('solved') ||
                          lowerText.includes('that helped') ||
                          lowerText === 'yes' ||
                          lowerText.includes('perfect');
          
          if (resolved) {
            clearConversationState(channelUserId);
            await sendSlackMessage(channel, "Awesome, glad I could help! 🎉\n\nFeel free to reach out anytime if you have other questions.");
            return ok({ ok: true });
          }
          
          if (stillNeedsHelp) {
            // Escalate to technical flow
            convState.state = CONV_STATE.GATHERING_DETAILS;
            convState.followUpIndex = 0;
            convState.triage.escalatedFromUserHelp = true;
            setConversationState(channelUserId, convState);
            
            const questions = FOLLOW_UP_QUESTIONS[convState.category] || FOLLOW_UP_QUESTIONS.general;
            const firstQuestion = questions[0];
            
            await sendSlackMessage(channel, `No worries, let's get this escalated to the dev team. 🔧\n\n*I'll need a few more details to help them investigate:*\n\n❓ ${firstQuestion}\n\n_(Type "done" anytime to submit your report)_`);
            return ok({ ok: true });
          }
          
          // Ambiguous response - ask for clarification
          await sendSlackMessage(channel, "Did that solve your issue? Reply *\"yes\"* if it's working now, or *\"still not working\"* if you need more help.");
          return ok({ ok: true });
        }
        
        // GATHERING DETAILS STATE - Processing follow-up answers
        if (convState.state === CONV_STATE.GATHERING_DETAILS) {
          const category = convState.category;
          const questions = FOLLOW_UP_QUESTIONS[category] || FOLLOW_UP_QUESTIONS.general;
          
          // Store the answer based on question index
          const questionIndex = convState.followUpIndex;
          convState.messages.push(cleanText);
          
          // Map answers to detail fields
          if (questionIndex === 0) {
            convState.details.context = cleanText; // What they were doing
          } else if (questionIndex === 1) {
            convState.details.device = cleanText; // Device/browser
          } else if (questionIndex === 2) {
            convState.details.frequency = cleanText; // Frequency
          } else if (questionIndex === 3) {
            convState.details.workaround = cleanText; // Workarounds tried
          }
          
          // Move to next question
          convState.followUpIndex++;
          
          // Check if we have more questions
          if (convState.followUpIndex < questions.length) {
            const nextQuestion = questions[convState.followUpIndex];
            setConversationState(channelUserId, convState);
            
            await sendSlackMessage(channel, `Got it, thanks! 📝\n\n❓ ${nextQuestion}\n\n_(Type "done" to submit your report anytime)_`);
            return ok({ ok: true });
          }
          
          // All questions answered - move to confirmation
          convState.state = CONV_STATE.AWAITING_CONFIRMATION;
          setConversationState(channelUserId, convState);
          
          // Show summary and ask for confirmation
          const summary = generateIssueSummary(convState);
          
          const confirmationMsg = `Thanks for all the details! Here's a summary of your report:\n\n${summary}\n\n*Does this look correct?*\n\n• Reply *"yes"* or *"submit"* to send to the team\n• Reply *"no"* or add more details if something's missing\n• Reply *"reset"* to start over`;
          
          await sendSlackMessage(channel, confirmationMsg);
          return ok({ ok: true });
        }
        
        // AWAITING CONFIRMATION STATE
        if (convState.state === CONV_STATE.AWAITING_CONFIRMATION) {
          if (lowerText === 'yes' || lowerText === 'correct' || lowerText === 'looks good' || lowerText === 'submit' || lowerText === 'send') {
            // User confirmed - escalate
            await handleEscalation(channel, user, convState);
            clearConversationState(channelUserId);
            return ok({ ok: true });
          } else if (lowerText === 'no' || lowerText.startsWith('actually') || lowerText.startsWith('also')) {
            // User wants to add more info
            convState.messages.push(cleanText);
            convState.details.additionalInfo = (convState.details.additionalInfo || '') + '\n' + cleanText;
            setConversationState(channelUserId, convState);
            
            await sendSlackMessage(channel, `Got it, I've added that to your report. 📝\n\nAnything else to add? Reply *"submit"* when ready, or keep adding details.`);
            return ok({ ok: true });
          } else {
            // Treat as additional info
            convState.messages.push(cleanText);
            convState.details.additionalInfo = (convState.details.additionalInfo || '') + '\n' + cleanText;
            setConversationState(channelUserId, convState);
            
            await sendSlackMessage(channel, `Added to your report. 📝\n\nReply *"submit"* when ready to send to the team.`);
            return ok({ ok: true });
          }
        }
        
        return ok({ ok: true });
      }
    }
    
    return ok({ ok: true });
  } catch (error) {
    console.error('Slack webhook error:', error);
    return err('Webhook processing failed', 500);
  }
}


async function handleSlackInteractive(request) {
  try {
    const formData = await request.formData();
    const payload = JSON.parse(formData.get('payload'));
    
    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      const channel = payload.channel.id;
      const user = payload.user.id;
      
      if (action.action_id === 'owner_resolved') {
        const value = JSON.parse(action.value || '{}');
        // Notify the original reporter that the issue was resolved
        if (value.channel) {
          await sendSlackMessage(value.channel, "✅ Good news! The team has looked into your issue and it's been resolved. Let us know if you have any other questions!");
        }
        await sendSlackMessage(channel, "✅ Marked as resolved. User has been notified.");
      }
      
      if (action.action_id === 'owner_reply') {
        const value = JSON.parse(action.value || '{}');
        await sendSlackMessage(channel, `To reply, go to <#${value.channel}> and message <@${value.user}> directly.`);
      }
    }
    
    return ok({ ok: true });
  } catch (error) {
    console.error('Slack interactive error:', error);
    return ok({ ok: true }); // Always return 200 to Slack
  }
}



// ============================================================
// ROUTER
// ============================================================

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');
  
  try {
    if (pathStr === 'webhook') return handleSlackWebhook(request);
    if (pathStr === 'interactive') return handleSlackInteractive(request);
    
    return err('Slack endpoint not found', 404);
  } catch (error) {
    console.error('[Slack API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function GET(request, { params }) {
  return err('Slack endpoint not found', 404);
}
