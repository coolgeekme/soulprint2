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
async function getUserConnections(userId) {
  const composio = getComposioClient();
  const composioUserId = getComposioUserId(userId);
  
  try {
    const accounts = await composio.connectedAccounts.list({ 
      user_id: composioUserId 
    });
    
    const items = accounts.items || accounts || [];
    
    return items.map(acc => ({
      id: acc.id,
      toolkit: acc.authConfig?.appId || acc.appId || acc.toolkit || 'unknown',
      status: acc.status || 'active',
      alias: acc.alias || null,
      createdAt: acc.createdAt,
    }));
  } catch (e) {
    console.error('[Composio] Error listing connections:', e.message);
    return [];
  }
}

// ── Disconnect/remove a connected account ──────────────────────────────
async function disconnectAccount(userId, connectionId) {
  const composio = getComposioClient();
  
  try {
    await composio.connectedAccounts.delete({ id: connectionId });
    
    // Clean up local DB record
    const db = await getDb();
    await db.collection('composio_connections').deleteOne({
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
};
