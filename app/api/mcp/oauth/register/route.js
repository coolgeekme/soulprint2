// SoulPrint MCP OAuth — Dynamic Client Registration (RFC 7591).
//
// Claude.ai's MCP connector registers itself here on first connect (it has no
// "register an app" dashboard). It POSTs its redirect_uri + auth method and we
// mint a client_id + client_secret it then uses for the authorization-code
// flow. ChatGPT does NOT hit this endpoint — it identifies via CIMD.

import { NextResponse } from 'next/server';
import { registerClient, getOAuth } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_client_metadata' }, { status: 400 });
  }

  const redirect_uris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  const token_endpoint_auth_method = body.token_endpoint_auth_method || 'client_secret_post';

  // Only accept auth methods we actually implement.
  if (!['client_secret_post', 'none'].includes(token_endpoint_auth_method)) {
    return NextResponse.json({ error: 'invalid_client_metadata' }, { status: 400 });
  }

  // Every redirect_uri must be HTTPS and on an allowlisted host (claude.ai etc.).
  const oauth = getOAuth(request);
  const valid = redirect_uris.length > 0 && redirect_uris.every((uri) => {
    try {
      const u = new URL(uri);
      return u.protocol === 'https:' && oauth.allowedRedirectHosts.includes(u.host);
    } catch {
      return false;
    }
  });
  if (!valid) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  const client = await registerClient({
    redirect_uris,
    token_endpoint_auth_method,
    client_name: body.client_name,
  });

  return NextResponse.json(client, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  });
}
