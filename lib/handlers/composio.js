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
  // Use REST API directly for consistent UUID-format IDs (needed for identity resolution & action execution)
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return [];

  const composioUserId = getComposioUserId(userId);
  try {
    const resp = await fetch(`${COMPOSIO_API_BASE}/api/v1/connectedAccounts?user_id=${composioUserId}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data.items || [];

    const mapped = items.map(acc => ({
      id: acc.id,                                             // Full UUID
      toolkit: (acc.appUniqueId || 'unknown').toUpperCase(),  // e.g. 'GMAIL'
      status: (acc.status || 'active').toUpperCase(),
      alias: acc.alias || null,
      createdAt: acc.createdAt,
    }));

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

// ── Identity resolution for connected accounts ────────────────────────────

// Map of app -> Composio action to resolve the account's identity
const IDENTITY_ACTIONS = {
  gmail: 'GMAIL_GET_PROFILE',
  googlecalendar: null, // Uses same Google account, resolved via Gmail or cached
  github: 'GITHUB_GET_THE_AUTHENTICATED_USER',
  slack: 'SLACK_AUTH_TEST',
};

/**
 * Resolve the actual username/email for a connected account via Composio actions.
 * Results are cached in MongoDB.
 */
async function resolveAccountIdentity(connectionId, appName) {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return null;

  // Check cache first
  try {
    const db = await getDb();
    const cached = await db.collection('composio_identity_cache').findOne({ connection_id: connectionId });
    if (cached && cached.resolved_at && (Date.now() - new Date(cached.resolved_at).getTime()) < 24 * 60 * 60 * 1000) {
      return cached.display_name;
    }
  } catch (_) { /* ignore cache failures */ }

  const appLower = appName.toLowerCase();
  let displayName = null;

  try {
    if (appLower === 'gmail') {
      const result = await executeComposioAction('GMAIL_GET_PROFILE', connectionId, {});
      const email = result?.data?.response_data?.emailAddress || result?.data?.emailAddress;
      if (email) displayName = email;
    } else if (appLower === 'github') {
      const result = await executeComposioAction('GITHUB_GET_THE_AUTHENTICATED_USER', connectionId, {});
      const login = result?.data?.login;
      const name = result?.data?.name;
      if (login) displayName = name ? `${name} (@${login})` : `@${login}`;
    } else if (appLower === 'slack') {
      try {
        const result = await executeComposioAction('SLACK_AUTH_TEST', connectionId, {});
        const user = result?.data?.user;
        const team = result?.data?.team;
        if (user) displayName = team ? `${user} (${team})` : user;
      } catch (_) { /* Slack action might not exist */ }
    } else if (appLower === 'googlecalendar') {
      // Get the primary calendar — its ID is the owner's email
      try {
        const result = await executeComposioAction('GOOGLECALENDAR_GET_CALENDAR', connectionId, { calendar_id: 'primary' });
        const calId = result?.data?.calendar_data?.id || result?.data?.id;
        if (calId && calId.includes('@')) {
          displayName = calId;
        }
      } catch (_) { /* ignore */ }
    }
  } catch (e) {
    console.error(`[Composio] Identity resolution failed for ${appName}:`, e.message);
  }

  // Cache the result
  if (displayName) {
    try {
      const db = await getDb();
      await db.collection('composio_identity_cache').updateOne(
        { connection_id: connectionId },
        { $set: { connection_id: connectionId, app: appLower, display_name: displayName, resolved_at: new Date() } },
        { upsert: true }
      );
    } catch (_) { /* ignore cache write failures */ }
  }

  return displayName;
}

/**
 * Enrich a list of connections with resolved identity (email/username).
 * Runs identity resolution in parallel for all connections.
 */
async function enrichConnectionsWithIdentity(connections) {
  const enriched = await Promise.all(
    connections.map(async (conn) => {
      // If already has a meaningful alias, use it
      if (conn.alias && !conn.alias.startsWith('ca_')) {
        return conn;
      }
      
      const displayName = await resolveAccountIdentity(conn.id, conn.toolkit);
      return { ...conn, displayName: displayName || null };
    })
  );
  return enriched;
}

// ── Composio tool definitions for the LLM ────────────────────────────────

/**
 * Builds OpenAI-format tool definitions based on which Composio apps the user
 * has actively connected.
 */

/**
 * Helper: Build a human-readable list of available accounts for an app.
 * Used in tool descriptions so the LLM knows which accounts are available.
 */
function describeAvailableAccounts(accounts) {
  if (!accounts || accounts.length <= 1) return '';
  return accounts.map((acc, i) => {
    const label = acc.alias || acc.displayName || acc.id.slice(0, 12);
    return `${i + 1}. "${label}"`;
  }).join(', ');
}

/**
 * Helper: Find the matching account from the LLM's selection.
 * Matches by alias/displayName (partial, case-insensitive) or by index (1-based).
 */
function resolveAccountSelection(accounts, selection) {
  if (!accounts || accounts.length === 0) return null;
  if (!selection || accounts.length === 1) return accounts[0];
  
  const sel = String(selection).trim().toLowerCase();
  
  // Try exact match on alias/displayName
  let match = accounts.find(a => 
    (a.alias && a.alias.toLowerCase() === sel) ||
    (a.displayName && a.displayName.toLowerCase() === sel)
  );
  if (match) return match;
  
  // Try partial match (e.g., "archeforge" matches "ben@archeforge.com")
  match = accounts.find(a => 
    (a.alias && a.alias.toLowerCase().includes(sel)) ||
    (a.displayName && a.displayName.toLowerCase().includes(sel)) ||
    (sel.includes('@') && a.alias && a.alias.toLowerCase().includes(sel))
  );
  if (match) return match;
  
  // Try numeric index (1-based)
  const idx = parseInt(sel, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= accounts.length) {
    return accounts[idx - 1];
  }
  
  // Default to first account
  console.log(`[Composio] Could not resolve account "${selection}", defaulting to first account`);
  return accounts[0];
}

function buildComposioToolDefs(activeAccounts) {
  const tools = [];

  // Helper to add account parameter when multiple accounts exist
  const addAccountParam = (appKey, properties) => {
    const accounts = activeAccounts[appKey];
    if (accounts && accounts.length > 1) {
      const accountList = describeAvailableAccounts(accounts);
      properties.account = { 
        type: 'string', 
        description: `Which account to use. Available accounts: ${accountList}. Specify by email/name. If the user doesn't specify, ask them which account they want to use.` 
      };
    }
    return properties;
  };
  
  if (activeAccounts.GMAIL) {
    const gmailAccounts = activeAccounts.GMAIL;
    const multiAccount = gmailAccounts.length > 1;
    const accountHint = multiAccount 
      ? ` The user has ${gmailAccounts.length} Gmail accounts connected: ${describeAvailableAccounts(gmailAccounts)}. When the user doesn't specify which account, ask them. Include the "account" parameter to specify which account to use.`
      : '';
    
    tools.push({
      type: 'function',
      function: {
        name: 'composio_get_emails',
        description: `Fetch recent emails from the user's connected Gmail account via Composio. Use when the user asks about their emails, inbox, or messages.${accountHint}`,
        parameters: {
          type: 'object',
          properties: addAccountParam('GMAIL', {
            query: { type: 'string', description: 'Gmail search query e.g. "from:john" or "is:unread" or "subject:meeting"' },
            max_results: { type: 'number', description: 'Max emails to return (default 5, max 10)' },
          }),
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'composio_send_email',
        description: `Send an email through the user's connected Gmail account via Composio.${accountHint}`,
        parameters: {
          type: 'object',
          properties: addAccountParam('GMAIL', {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body (can include HTML)' },
          }),
          required: ['to', 'subject', 'body'],
        },
      },
    });
  }
  
  if (activeAccounts.GOOGLECALENDAR) {
    const calAccounts = activeAccounts.GOOGLECALENDAR;
    const multiAccount = calAccounts.length > 1;
    const accountHint = multiAccount 
      ? ` The user has ${calAccounts.length} Google Calendar accounts connected: ${describeAvailableAccounts(calAccounts)}. Include the "account" parameter to specify which one.`
      : '';
    
    tools.push({
      type: 'function',
      function: {
        name: 'composio_get_calendar',
        description: `Fetch upcoming calendar events from the user's connected Google Calendar via Composio.${accountHint}`,
        parameters: {
          type: 'object',
          properties: addAccountParam('GOOGLECALENDAR', {
            time_min: { type: 'string', description: 'Start datetime in ISO format (defaults to now)' },
            time_max: { type: 'string', description: 'End datetime in ISO format (defaults to 7 days from now)' },
          }),
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'composio_create_event',
        description: `Create a new calendar event on the user's connected Google Calendar via Composio.${accountHint}`,
        parameters: {
          type: 'object',
          properties: addAccountParam('GOOGLECALENDAR', {
            summary: { type: 'string', description: 'Event title' },
            start_time: { type: 'string', description: 'Start datetime in ISO format' },
            end_time: { type: 'string', description: 'End datetime in ISO format' },
            description: { type: 'string', description: 'Event description' },
            location: { type: 'string', description: 'Event location' },
          }),
          required: ['summary', 'start_time', 'end_time'],
        },
      },
    });
  }
  
  if (activeAccounts.SLACK) {
    const slackAccounts = activeAccounts.SLACK;
    const multiAccount = slackAccounts.length > 1;
    const accountHint = multiAccount 
      ? ` The user has ${slackAccounts.length} Slack workspaces connected: ${describeAvailableAccounts(slackAccounts)}. Include the "account" parameter to specify which workspace.`
      : '';
    
    tools.push({
      type: 'function',
      function: {
        name: 'composio_slack_send',
        description: `Send a message to a Slack channel or user via the user's connected Slack account.${accountHint}`,
        parameters: {
          type: 'object',
          properties: addAccountParam('SLACK', {
            channel: { type: 'string', description: 'Slack channel name or ID (e.g. "#general" or user ID)' },
            text: { type: 'string', description: 'Message text' },
          }),
          required: ['channel', 'text'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'composio_slack_history',
        description: `Fetch recent messages from a Slack channel via the user's connected Slack account.${accountHint}`,
        parameters: {
          type: 'object',
          properties: addAccountParam('SLACK', {
            channel: { type: 'string', description: 'Slack channel name or ID' },
            limit: { type: 'number', description: 'Number of messages (default 10)' },
          }),
          required: ['channel'],
        },
      },
    });
  }

  if (activeAccounts.GITHUB) {
    const ghAccounts = activeAccounts.GITHUB;
    const multiAccount = ghAccounts.length > 1;
    const accountHint = multiAccount 
      ? ` The user has ${ghAccounts.length} GitHub accounts connected: ${describeAvailableAccounts(ghAccounts)}. Include the "account" parameter to specify which one.`
      : '';
    
    tools.push({
      type: 'function',
      function: {
        name: 'composio_github_issues',
        description: `List issues from a GitHub repository via the user's connected GitHub account.${accountHint}`,
        parameters: {
          type: 'object',
          properties: addAccountParam('GITHUB', {
            owner: { type: 'string', description: 'Repository owner (e.g. "octocat")' },
            repo: { type: 'string', description: 'Repository name' },
            state: { type: 'string', description: 'Filter: open, closed, or all (default: open)' },
          }),
          required: ['owner', 'repo'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'composio_github_create_issue',
        description: `Create a new issue on a GitHub repository via the user's connected GitHub account.${accountHint}`,
        parameters: {
          type: 'object',
          properties: addAccountParam('GITHUB', {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            title: { type: 'string', description: 'Issue title' },
            body: { type: 'string', description: 'Issue body/description' },
          }),
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
        const acc = resolveAccountSelection(activeAccounts.GMAIL, args.account);
        if (!acc) return { error: 'No Gmail account connected' };
        console.log(`[Composio] Using Gmail account: ${acc.alias || acc.id.slice(0, 12)}`);
        const result = await executeComposioAction('GMAIL_FETCH_EMAILS', acc.id, {
          max_results: Math.min(args.max_results || 5, 10),
          q: args.query || '',
        });
        // Format the response
        const messages = result?.data?.messages || [];
        return {
          account_used: acc.alias || acc.id.slice(0, 12),
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
        const acc = resolveAccountSelection(activeAccounts.GMAIL, args.account);
        if (!acc) return { error: 'No Gmail account connected' };
        console.log(`[Composio] Sending email via: ${acc.alias || acc.id.slice(0, 12)}`);
        const result = await executeComposioAction('GMAIL_SEND_EMAIL', acc.id, {
          recipient_email: args.to,
          subject: args.subject,
          body: args.body,
        });
        return { success: true, account_used: acc.alias || acc.id.slice(0, 12), result: result?.data || 'Email sent' };
      }

      case 'composio_get_calendar': {
        const acc = resolveAccountSelection(activeAccounts.GOOGLECALENDAR, args.account);
        if (!acc) return { error: 'No Google Calendar connected' };
        console.log(`[Composio] Using Calendar account: ${acc.alias || acc.id.slice(0, 12)}`);
        const now = new Date();
        const result = await executeComposioAction('GOOGLECALENDAR_FIND_EVENT', acc.id, {
          calendar_id: 'primary',
          time_min: args.time_min || now.toISOString(),
          time_max: args.time_max || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        const events = result?.data?.event_data?.event_data || result?.data?.events || [];
        return {
          account_used: acc.alias || acc.id.slice(0, 12),
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
        const acc = resolveAccountSelection(activeAccounts.GOOGLECALENDAR, args.account);
        if (!acc) return { error: 'No Google Calendar connected' };
        console.log(`[Composio] Creating event on: ${acc.alias || acc.id.slice(0, 12)}`);
        const result = await executeComposioAction('GOOGLECALENDAR_CREATE_EVENT', acc.id, {
          calendar_id: 'primary',
          summary: args.summary,
          start_datetime: args.start_time,
          end_datetime: args.end_time,
          description: args.description || '',
          location: args.location || '',
        });
        return { success: true, account_used: acc.alias || acc.id.slice(0, 12), event: result?.data || 'Event created' };
      }

      case 'composio_slack_send': {
        const acc = resolveAccountSelection(activeAccounts.SLACK, args.account);
        if (!acc) return { error: 'No Slack account connected' };
        console.log(`[Composio] Sending Slack message via: ${acc.alias || acc.id.slice(0, 12)}`);
        const result = await executeComposioAction('SLACK_CHAT_POST_MESSAGE', acc.id, {
          channel: args.channel,
          text: args.text,
        });
        return { success: true, account_used: acc.alias || acc.id.slice(0, 12), result: result?.data || 'Message sent' };
      }

      case 'composio_slack_history': {
        const acc = resolveAccountSelection(activeAccounts.SLACK, args.account);
        if (!acc) return { error: 'No Slack account connected' };
        console.log(`[Composio] Fetching Slack history via: ${acc.alias || acc.id.slice(0, 12)}`);
        const result = await executeComposioAction('SLACK_FETCH_CONVERSATION_HISTORY', acc.id, {
          channel: args.channel,
          limit: args.limit || 10,
        });
        return { account_used: acc.alias || acc.id.slice(0, 12), messages: result?.data?.messages || [], count: result?.data?.messages?.length || 0 };
      }

      case 'composio_github_issues': {
        const acc = resolveAccountSelection(activeAccounts.GITHUB, args.account);
        if (!acc) return { error: 'No GitHub account connected' };
        console.log(`[Composio] Fetching GitHub issues via: ${acc.alias || acc.id.slice(0, 12)}`);
        const result = await executeComposioAction('GITHUB_LIST_REPOSITORY_ISSUES', acc.id, {
          owner: args.owner,
          repo: args.repo,
          state: args.state || 'open',
        });
        return { account_used: acc.alias || acc.id.slice(0, 12), issues: result?.data || [] };
      }

      case 'composio_github_create_issue': {
        const acc = resolveAccountSelection(activeAccounts.GITHUB, args.account);
        if (!acc) return { error: 'No GitHub account connected' };
        console.log(`[Composio] Creating GitHub issue via: ${acc.alias || acc.id.slice(0, 12)}`);
        const result = await executeComposioAction('GITHUB_CREATE_AN_ISSUE', acc.id, {
          owner: args.owner,
          repo: args.repo,
          title: args.title,
          body: args.body || '',
        });
        return { success: true, account_used: acc.alias || acc.id.slice(0, 12), issue: result?.data || 'Issue created' };
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
  enrichConnectionsWithIdentity,
  resolveAccountIdentity,
  resolveAccountSelection,
  describeAvailableAccounts,
};
