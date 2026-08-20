// MCP OAuth protected-resource metadata (RFC 9728).
//
// Advertises the authorization server for clients (Claude, others) that
// discover auth via the protected-resource well-known endpoint.

import { NextResponse } from 'next/server';
import { getOAuth } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const oauth = getOAuth(request);
  return NextResponse.json(
    {
      resource: `${oauth.issuer}/api/mcp`,
      // MUST be the authorization server's ISSUER URL (RFC 9728 / Anthropic docs),
      // not the well-known path — Claude resolves {issuer}/.well-known/oauth-authorization-server.
      authorization_servers: [oauth.issuer],
    },
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}
