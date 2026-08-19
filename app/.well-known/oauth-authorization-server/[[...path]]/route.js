// MCP OAuth authorization-server discovery.
//
// ChatGPT's connector fetches `/.well-known/oauth-authorization-server` (and
// the `/mcp` variant) to discover the authorization + token endpoints and the
// pre-registered client info (CIMD `mcp` extension).

import { NextResponse } from 'next/server';
import { OAUTH } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      issuer: OAUTH.issuer,
      authorization_endpoint: OAUTH.authorizeUrl,
      token_endpoint: OAUTH.tokenUrl,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      mcp: {
        client_id: OAUTH.clientId,
        redirect_uri: OAUTH.redirectUri,
      },
    },
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}
