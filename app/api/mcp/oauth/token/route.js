// SoulPrint MCP OAuth — token endpoint.
//
// Exchanges an authorization code (+ PKCE verifier) for a SoulPrint access
// token (the existing 365d JWT). Standard RFC 6749 / OAuth 2.1 grant.

import { NextResponse } from 'next/server';
import { consumeAuthCode, verifyPkce, issueAccessToken, getRegisteredClient, verifyClientSecret } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let params;
  try {
    const body = await request.text();
    params = new URLSearchParams(body);
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const grant_type = params.get('grant_type');
  const code = params.get('code');
  const client_id = params.get('client_id');
  const redirect_uri = params.get('redirect_uri');
  const code_verifier = params.get('code_verifier');

  if (grant_type !== 'authorization_code') {
    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Claude (DCR) authenticates with client_secret_post; ChatGPT uses 'none'.
  // getRegisteredClient() returns null for ChatGPT's CIMD client_id (a URL),
  // so the CIMD flow skips this check entirely.
  if (client_id) {
    const registered = await getRegisteredClient(client_id);
    if (registered && !verifyClientSecret(params.get('client_secret'), registered.client_secret)) {
      return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
    }
  }

  const rec = await consumeAuthCode(code);
  if (!rec) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }
  if (client_id && client_id !== rec.client_id) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
  }
  if (redirect_uri && redirect_uri !== rec.redirect_uri) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }
  if (!verifyPkce(code_verifier, rec.code_challenge, rec.code_challenge_method)) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  const access_token = issueAccessToken(rec.user_id);
  return NextResponse.json(
    {
      access_token,
      token_type: 'Bearer',
      expires_in: 31536000, // 365 days (matches the SoulPrint JWT lifetime)
      scope: 'soulprint.mcp',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
