// SoulPrint hosted MCP endpoint (streamable HTTP, stateless).
//
// ChatGPT and other remote-only MCP clients connect to this endpoint as a
// "Connector". Every request carries an OAuth-issued (or pasted) SoulPrint JWT
// as a Bearer token; we resolve the user, enforce Pro/Team access, and answer
// the JSON-RPC messages (initialize / tools/list / tools/call).

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate } from '@/lib/api-utils';
import { getMcpAccess } from '@/lib/handlers/mcp-access';
import { TOOLS } from '@/lib/mcp/tools';
import { handleMcpTool } from '@/lib/mcp/handlers';
import { getOAuth } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SERVER_INFO = { name: 'soulprint-mcp', version: '0.4.2' };
const PROTOCOL_VERSION = '2024-11-05';

function wwwAuthenticate(request) {
  const oauth = getOAuth(request);
  return `Bearer resource_metadata="${oauth.resourceMetadataUrl}", authorization_server="${oauth.authServerUrl}"`;
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleMessage(db, user, msg) {
  const { id, method, params } = msg || {};

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        capabilities: { experimental: {}, tools: { listChanged: false } },
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
      });
    case 'notifications/initialized':
      return null; // notification — no response
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      const { name, arguments: args } = params || {};
      try {
        const result = await handleMcpTool(db, user, name, args || {});
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false,
        });
      } catch (e) {
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify({ error: e.message || String(e) }) }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function POST(request) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json(
      rpcError(null, -32001, 'Unauthorized — connect via SoulPrint OAuth or supply a Bearer token'),
      { status: 401, headers: { 'WWW-Authenticate': wwwAuthenticate(request) } },
    );
  }

  const mcpAccess = await getMcpAccess(user);
  if (!mcpAccess) {
    return NextResponse.json(
      rpcError(null, -32003, 'SoulPrint MCP requires a Pro or Team plan. Upgrade at soulprintengine.ai/pricing.'),
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  const db = await getDb();
  const isBatch = Array.isArray(body);
  const messages = isBatch ? body : [body];

  const responses = [];
  for (const msg of messages) {
    const r = await handleMessage(db, user, msg);
    if (r !== null) responses.push(r);
  }

  return NextResponse.json(
    isBatch ? responses : (responses[0] ?? {}),
    { headers: { 'Content-Type': 'application/json' } },
  );
}

export async function GET(request) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json(
      rpcError(null, -32001, 'Unauthorized — SoulPrint MCP uses OAuth'),
      { status: 401, headers: { 'WWW-Authenticate': wwwAuthenticate(request) } },
    );
  }
  return NextResponse.json({
    name: 'soulprint-mcp',
    description: 'SoulPrint MCP server (streamable HTTP). Connect via ChatGPT → Apps & Connectors as a remote MCP connector.',
    transport: 'streamable-http',
    tools: TOOLS.map((t) => t.name),
  });
}
