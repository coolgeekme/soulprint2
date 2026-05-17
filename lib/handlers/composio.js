/**
 * Composio Integration Layer
 * Manages Composio sessions, connected accounts, and tool execution
 * for the SoulPrint Engine proactive agent system.
 */
import { Composio } from '@composio/core';
import { OpenAIProvider } from '@composio/openai';
import { getDb } from '@/lib/mongodb';

// ── Singleton Composio client ──────────────────────────────────────────
let _composioClient = null;

function getComposioClient() {
  if (!_composioClient) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) throw new Error('COMPOSIO_API_KEY is not configured');
    _composioClient = new Composio({ 
      apiKey, 
      provider: new OpenAIProvider() 
    });
  }
  return _composioClient;
}

// ── Supported toolkits ─────────────────────────────────────────────────
const SUPPORTED_TOOLKITS = {
  GMAIL: {
    name: 'Gmail',
    icon: '📧',
    description: 'Read, send, and manage emails',
    category: 'communication',
  },
  GOOGLECALENDAR: {
    name: 'Google Calendar',
    icon: '📅',
    description: 'View and manage calendar events',
    category: 'productivity',
  },
  GITHUB: {
    name: 'GitHub',
    icon: '🐙',
    description: 'Access repositories, issues, and commits',
    category: 'development',
  },
  SLACK: {
    name: 'Slack',
    icon: '💬',
    description: 'Send and read Slack messages',
    category: 'communication',
  },
  GOOGLEDRIVE: {
    name: 'Google Drive',
    icon: '📁',
    description: 'Access and manage files',
    category: 'productivity',
  },
  NOTION: {
    name: 'Notion',
    icon: '📝',
    description: 'Access pages and databases',
    category: 'productivity',
  },
  TRELLO: {
    name: 'Trello',
    icon: '📋',
    description: 'Manage boards and cards',
    category: 'productivity',
  },
  ZOOM: {
    name: 'Zoom',
    icon: '🎥',
    description: 'Schedule and manage meetings',
    category: 'communication',
  },
};

// ── Get or create Composio entity for a user ───────────────────────────
function getComposioUserId(userId) {
  // Map SoulPrint user IDs to Composio entity IDs
  return `sp_${userId}`;
}

// ── Create a session with tools for a user ─────────────────────────────
async function createUserSession(userId, toolkitNames = []) {
  const composio = getComposioClient();
  const composioUserId = getComposioUserId(userId);
  
  // If no specific toolkits requested, use all connected ones
  const toolkits = toolkitNames.length > 0 
    ? toolkitNames 
    : Object.keys(SUPPORTED_TOOLKITS);
  
  const session = await composio.create(composioUserId, { toolkits });
  return session;
}

// ── Get OAuth authorization link for a toolkit ─────────────────────────
async function getAuthLink(userId, toolkit) {
  const composio = getComposioClient();
  const composioUserId = getComposioUserId(userId);
  
  const session = await composio.create(composioUserId, { toolkits: [toolkit] });
  const authResult = await session.authorize(toolkit);
  
  // Store the connection attempt in DB
  const db = await getDb();
  await db.collection('composio_connections').updateOne(
    { user_id: userId, toolkit },
    { 
      $set: { 
        connection_id: authResult.id,
        status: authResult.status,
        redirect_url: authResult.redirectUrl,
        updated_at: new Date(),
      },
      $setOnInsert: { created_at: new Date() }
    },
    { upsert: true }
  );
  
  return {
    connectionId: authResult.id,
    status: authResult.status,
    redirectUrl: authResult.redirectUrl,
  };
}

// ── Get connected accounts for a user ──────────────────────────────────
async function getUserConnections(userId, { filterSupported = false } = {}) {
  const composio = getComposioClient();
  const composioUserId = getComposioUserId(userId);
  
  try {
    const accounts = await composio.connectedAccounts.list({ 
      user_id: composioUserId 
    });
    
    const items = accounts.items || accounts || [];
    
    const mapped = items.map(acc => {
      // Extract toolkit identifier from various possible shapes
      let toolkitId = 'unknown';
      if (typeof acc.toolkit === 'object' && acc.toolkit?.slug) {
        toolkitId = acc.toolkit.slug;
      } else if (typeof acc.toolkit === 'string') {
        toolkitId = acc.toolkit;
      } else if (acc.authConfig?.appId) {
        toolkitId = acc.authConfig.appId;
      } else if (acc.appId) {
        toolkitId = acc.appId;
      }
      return {
        id: acc.id,
        toolkit: toolkitId.toUpperCase(),
        status: (acc.status || 'active').toUpperCase(),
        alias: acc.alias || null,
        createdAt: acc.createdAt,
      };
    });

    // Optionally filter to only our SUPPORTED_TOOLKITS
    if (filterSupported) {
      const supportedKeys = new Set(Object.keys(SUPPORTED_TOOLKITS));
      return mapped.filter(c => supportedKeys.has(c.toolkit));
    }

    return mapped;
  } catch (e) {
    console.error('[Composio] Error listing connections:', e.message);
    return [];
  }
}

// ── Disconnect/remove a connected account ──────────────────────────────
async function disconnectAccount(userId, connectionId) {
  const composio = getComposioClient();
  
  try {
    // Pass the connection ID as a plain string (not an object)
    await composio.connectedAccounts.delete(connectionId);
    
    // Clean up local DB record
    const db = await getDb();
    await db.collection('composio_connections').deleteMany({
      user_id: userId,
      connection_id: connectionId,
    });
    
    return { success: true };
  } catch (e) {
    console.error('[Composio] Error disconnecting:', e.message);
    return { success: false, error: e.message };
  }
}

// ── Get OpenAI-formatted tools for a user's connected apps ─────────────
async function getToolsForUser(userId, toolkitNames = []) {
  try {
    const session = await createUserSession(userId, toolkitNames);
    const tools = await session.tools();
    return { tools, session };
  } catch (e) {
    console.error('[Composio] Error getting tools:', e.message);
    return { tools: [], session: null };
  }
}

// ── Execute a tool call from OpenAI response ───────────────────────────
async function executeToolCall(session, toolCallResult) {
  try {
    const result = await session.execute(toolCallResult);
    return result;
  } catch (e) {
    console.error('[Composio] Tool execution error:', e.message);
    return { error: e.message };
  }
}

// ── Health check / status ──────────────────────────────────────────────
async function getStatus() {
  try {
    const composio = getComposioClient();
    const accounts = await composio.connectedAccounts.list({});
    return {
      connected: true,
      totalAccounts: accounts.items?.length || 0,
      supportedToolkits: Object.keys(SUPPORTED_TOOLKITS).length,
    };
  } catch (e) {
    return {
      connected: false,
      error: e.message,
    };
  }
}

// ── Composio REST API execution (reliable, bypasses SDK bugs) ───────────

const COMPOSIO_API_BASE = 'https://backend.composio.dev';

/**
 * Execute a Composio action via REST API.
 * @param {string} actionSlug - e.g. 'GMAIL_FETCH_EMAILS'
 * @param {string} connectedAccountId - UUID of the connected account
 * @param {object} input - action-specific parameters
 * @returns {object} execution result
 */
async function executeComposioAction(actionSlug, connectedAccountId, input = {}) {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error('COMPOSIO_API_KEY not configured');

  const resp = await fetch(`${COMPOSIO_API_BASE}/api/v2/actions/${actionSlug}/execute`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ connectedAccountId, input }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => 'Unknown error');
    throw new Error(`Composio action ${actionSlug} failed (${resp.status}): ${errBody}`);
  }

  return resp.json();
}

/**
 * Get active Composio connected accounts for a user via REST API.
 * Returns { appName -> connectedAccountId } mapping.
 */
async function getActiveComposioAccounts(userId) {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return {};

  const composioUserId = getComposioUserId(userId);
  try {
    const resp = await fetch(`${COMPOSIO_API_BASE}/api/v1/connectedAccounts?user_id=${composioUserId}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    const accounts = {};
    for (const acc of (data.items || [])) {
      if (acc.status?.toLowerCase() === 'active' && acc.appUniqueId) {
        const key = acc.appUniqueId.toUpperCase();
        if (!accounts[key]) accounts[key] = [];
        accounts[key].push({
          id: acc.id,
          app: acc.appUniqueId,
          alias: acc.memberData?.name || acc.memberData?.email || null,
        });
      }
    }
    return accounts;
  } catch (e) {
    console.error('[Composio] getActiveComposioAccounts error:', e.message);
    return {};
  }
}

// ── Composio tool definitions for the LLM ────────────────────────────────

/**
 * Builds OpenAI-format tool definitions based on which Composio apps the user
 * has actively connected.
 */
function buildComposioToolDefs(activeAccounts) {
  const tools = [];
  
  if (activeAccounts.GMAIL) {
    tools.push({
      type: 'function',
      function: {
        name: 'composio_get_emails',
        description: 'Fetch recent emails from the user\'s connected Gmail account via Composio. Use when the user asks about their emails, inbox, or messages.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Gmail search query e.g. "from:john" or "is:unread" or "subject:meeting"' },
            max_results: { type: 'number', description: 'Max emails to return (default 5, max 10)' },
          },
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'composio_send_email',
        description: 'Send an email through the user\'s connected Gmail account via Composio.',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body (can include HTML)' },
          },
          required: ['to', 'subject', 'body'],
        },
      },
    });
  }
  
  if (activeAccounts.GOOGLECALENDAR) {
    tools.push({
      type: 'function',
      function: {
        name: 'composio_get_calendar',
        description: 'Fetch upcoming calendar events from the user\'s connected Google Calendar via Composio.',
        parameters: {
          type: 'object',
          properties: {
            time_min: { type: 'string', description: 'Start datetime in ISO format (defaults to now)' },
            time_max: { type: 'string', description: 'End datetime in ISO format (defaults to 7 days from now)' },
          },
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'composio_create_event',
        description: 'Create a new calendar event on the user\'s connected Google Calendar via Composio.',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Event title' },
            start_time: { type: 'string', description: 'Start datetime in ISO format' },
            end_time: { type: 'string', description: 'End datetime in ISO format' },
            description: { type: 'string', description: 'Event description' },
            location: { type: 'string', description: 'Event location' },
          },
          required: ['summary', 'start_time', 'end_time'],
        },
      },
    });
  }
  
  if (activeAccounts.SLACK) {
    tools.push({
      type: 'function',
      function: {
        name: 'composio_slack_send',
        description: 'Send a message to a Slack channel or user via the user\'s connected Slack account.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Slack channel name or ID (e.g. "#general" or user ID)' },
            text: { type: 'string', description: 'Message text' },
          },
          required: ['channel', 'text'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'composio_slack_history',
        description: 'Fetch recent messages from a Slack channel via the user\'s connected Slack account.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Slack channel name or ID' },
            limit: { type: 'number', description: 'Number of messages (default 10)' },
          },
          required: ['channel'],
        },
      },
    });
  }

  if (activeAccounts.GITHUB) {
    tools.push({
      type: 'function',
      function: {
        name: 'composio_github_issues',
        description: 'List issues from a GitHub repository via the user\'s connected GitHub account.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner (e.g. "octocat")' },
            repo: { type: 'string', description: 'Repository name' },
            state: { type: 'string', description: 'Filter: open, closed, or all (default: open)' },
          },
          required: ['owner', 'repo'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'composio_github_create_issue',
        description: 'Create a new issue on a GitHub repository via the user\'s connected GitHub account.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            title: { type: 'string', description: 'Issue title' },
            body: { type: 'string', description: 'Issue body/description' },
          },
          required: ['owner', 'repo', 'title'],
        },
      },
    });
  }

  return tools;
}

/**
 * Execute a Composio tool call. Maps our friendly tool names to Composio action slugs.
 * @param {string} toolName - e.g. 'composio_get_emails'
 * @param {object} args - tool arguments from the LLM
 * @param {object} activeAccounts - { GMAIL: [{id, app}], ... }
 * @returns {object} tool result
 */
async function handleComposioToolCall(toolName, args, activeAccounts) {
  try {
    switch (toolName) {
      case 'composio_get_emails': {
        const acc = activeAccounts.GMAIL?.[0];
        if (!acc) return { error: 'No Gmail account connected' };
        const result = await executeComposioAction('GMAIL_FETCH_EMAILS', acc.id, {
          max_results: Math.min(args.max_results || 5, 10),
          q: args.query || '',
        });
        // Format the response
        const messages = result?.data?.messages || [];
        return {
          emails: messages.slice(0, 10).map(m => ({
            id: m.messageId,
            subject: m.subject || '(no subject)',
            from: m.sender || m.from || 'Unknown',
            snippet: (m.messageText || m.snippet || '').substring(0, 200),
            labels: m.labelIds || [],
          })),
          count: messages.length,
        };
      }

      case 'composio_send_email': {
        const acc = activeAccounts.GMAIL?.[0];
        if (!acc) return { error: 'No Gmail account connected' };
        const result = await executeComposioAction('GMAIL_SEND_EMAIL', acc.id, {
          recipient_email: args.to,
          subject: args.subject,
          body: args.body,
        });
        return { success: true, result: result?.data || 'Email sent' };
      }

      case 'composio_get_calendar': {
        const acc = activeAccounts.GOOGLECALENDAR?.[0];
        if (!acc) return { error: 'No Google Calendar connected' };
        const now = new Date();
        const result = await executeComposioAction('GOOGLECALENDAR_FIND_EVENT', acc.id, {
          calendar_id: 'primary',
          time_min: args.time_min || now.toISOString(),
          time_max: args.time_max || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        const events = result?.data?.event_data?.event_data || result?.data?.events || [];
        return {
          events: events.slice(0, 15).map(e => ({
            title: e.summary || e.title,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            location: e.location,
            description: (e.description || '').substring(0, 100),
          })),
          count: events.length,
        };
      }

      case 'composio_create_event': {
        const acc = activeAccounts.GOOGLECALENDAR?.[0];
        if (!acc) return { error: 'No Google Calendar connected' };
        const result = await executeComposioAction('GOOGLECALENDAR_CREATE_EVENT', acc.id, {
          calendar_id: 'primary',
          summary: args.summary,
          start_datetime: args.start_time,
          end_datetime: args.end_time,
          description: args.description || '',
          location: args.location || '',
        });
        return { success: true, event: result?.data || 'Event created' };
      }

      case 'composio_slack_send': {
        const acc = activeAccounts.SLACK?.[0];
        if (!acc) return { error: 'No Slack account connected' };
        const result = await executeComposioAction('SLACK_CHAT_POST_MESSAGE', acc.id, {
          channel: args.channel,
          text: args.text,
        });
        return { success: true, result: result?.data || 'Message sent' };
      }

      case 'composio_slack_history': {
        const acc = activeAccounts.SLACK?.[0];
        if (!acc) return { error: 'No Slack account connected' };
        const result = await executeComposioAction('SLACK_FETCH_CONVERSATION_HISTORY', acc.id, {
          channel: args.channel,
          limit: args.limit || 10,
        });
        return { messages: result?.data?.messages || [], count: result?.data?.messages?.length || 0 };
      }

      case 'composio_github_issues': {
        const acc = activeAccounts.GITHUB?.[0];
        if (!acc) return { error: 'No GitHub account connected' };
        const result = await executeComposioAction('GITHUB_LIST_REPOSITORY_ISSUES', acc.id, {
          owner: args.owner,
          repo: args.repo,
          state: args.state || 'open',
        });
        return { issues: result?.data || [] };
      }

      case 'composio_github_create_issue': {
        const acc = activeAccounts.GITHUB?.[0];
        if (!acc) return { error: 'No GitHub account connected' };
        const result = await executeComposioAction('GITHUB_CREATE_AN_ISSUE', acc.id, {
          owner: args.owner,
          repo: args.repo,
          title: args.title,
          body: args.body || '',
        });
        return { success: true, issue: result?.data || 'Issue created' };
      }

      default:
        return { error: `Unknown Composio tool: ${toolName}` };
    }
  } catch (e) {
    console.error(`[Composio] Tool ${toolName} error:`, e.message);
    return { error: `Failed to execute ${toolName}: ${e.message}` };
  }
}

export {
  getComposioClient,
  getComposioUserId,
  createUserSession,
  getAuthLink,
  getUserConnections,
  disconnectAccount,
  getToolsForUser,
  executeToolCall,
  getStatus,
  SUPPORTED_TOOLKITS,
  // New exports for Telegram/chat integration
  getActiveComposioAccounts,
  buildComposioToolDefs,
  handleComposioToolCall,
  executeComposioAction,
};
