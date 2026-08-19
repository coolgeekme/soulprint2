// MCP OAuth authorization-server discovery.
//
// ChatGPT's connector fetches `/.well-known/oauth-authorization-server` (and
// the `/mcp` variant) to discover the authorization + token endpoints and the
// pre-registered client info (CIMD `mcp` extension).

import { NextResponse } from 'next/server';
import { getOAuth } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const oauth = getOAuth(request);
  return NextResponse.json(
    {
      issuer: oauth.issuer,
      authorization_endpoint: oauth.authorizeUrl,
      token_endpoint: oauth.tokenUrl,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: true,
      mcp: {
        client_id: oauth.clientId,
        redirect_uri: oauth.redirectUri,
      },
    },
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}
