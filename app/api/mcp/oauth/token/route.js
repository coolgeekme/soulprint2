// SoulPrint MCP OAuth — token endpoint.
//
// Exchanges an authorization code (+ PKCE verifier) for a SoulPrint access
// token (the existing 365d JWT), and supports the refresh_token grant Claude
// advertises in its DCR request. Standard RFC 6749 / OAuth 2.1.

import { NextResponse } from 'next/server';
import {
  consumeAuthCode,
  verifyPkce,
  issueAccessToken,
  getRegisteredClient,
  verifyClientSecret,
  storeRefreshToken,
  consumeRefreshToken,
} from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

// Claude requests `scope=mcp:tools`; ChatGPT is scope-agnostic. Serve both.
const MCP_SCOPE = 'mcp:tools soulprint.mcp';

export async function POST(request) {
  let params;
  try {
    const raw = await request.text();
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // Some clients (Claude) POST the token request as JSON rather than
      // form-urlencoded. Normalize to URLSearchParams so the rest is unchanged.
      const json = JSON.parse(raw);
      params = new URLSearchParams();
      for (const [k, v] of Object.entries(json || {})) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
    } else {
      params = new URLSearchParams(raw);
    }
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const grant_type = params.get('grant_type');
  const client_id = params.get('client_id');

  // Client secret comes from the body (client_secret_post) or HTTP Basic
  // (client_secret_basic). Public clients (token_endpoint_auth_method "none")
  // send no secret — they authenticate with PKCE only. ChatGPT's CIMD client_id
  // is a URL and resolves to null, so the CIMD flow skips this check entirely.
  let client_secret = params.get('client_secret');
  if (!client_secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth.startsWith('Basic ')) {
      client_secret = Buffer.from(auth.slice(6), 'base64').toString().split(':')[1] || '';
    }
  }
  if (client_id) {
    const registered = await getRegisteredClient(client_id);
    // Only confidential clients (client_secret_post / client_secret_basic) send a
    // secret. Claude web registers as a public client ("none") and relies on
    // PKCE, so requiring a secret here rejects its token exchange with
    // invalid_client → "Authorization with SoulPrint MCP failed".
    if (registered && registered.token_endpoint_auth_method !== 'none') {
      if (!verifyClientSecret(client_secret, registered.client_secret)) {
        console.error('[oauth:token] invalid_client (secret mismatch) for', client_id);
        return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
      }
    }
  }

  if (grant_type === 'refresh_token') {
    const rec = await consumeRefreshToken(params.get('refresh_token'));
    if (!rec) {
      console.error('[oauth:token] refresh_token invalid_grant');
      return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
    }
    const access_token = issueAccessToken(rec.user_id);
    return NextResponse.json(
      {
        access_token,
        token_type: 'Bearer',
        expires_in: 31536000,
        scope: MCP_SCOPE,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (grant_type !== 'authorization_code') {
    console.error('[oauth:token] unsupported_grant_type:', grant_type);
    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  const code = params.get('code');
  const redirect_uri = params.get('redirect_uri');
  const code_verifier = params.get('code_verifier');

  if (!code) {
    console.error('[oauth:token] missing code');
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const rec = await consumeAuthCode(code);
  if (!rec) {
    console.error('[oauth:token] invalid_grant (no/expired/used code)');
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }
  if (client_id && client_id !== rec.client_id) {
    console.error('[oauth:token] client_id mismatch:', client_id, 'vs', rec.client_id);
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
  }
  if (redirect_uri && redirect_uri !== rec.redirect_uri) {
    console.error('[oauth:token] redirect_uri mismatch:', redirect_uri, 'vs', rec.redirect_uri);
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }
  if (!verifyPkce(code_verifier, rec.code_challenge, rec.code_challenge_method)) {
    console.error('[oauth:token] PKCE verification failed');
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  const access_token = issueAccessToken(rec.user_id);
  const refresh_token = await storeRefreshToken({
    user_id: rec.user_id,
    client_id: rec.client_id,
    scope: MCP_SCOPE,
  });
  return NextResponse.json(
    {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: 31536000, // 365 days (matches the SoulPrint JWT lifetime)
      scope: MCP_SCOPE,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
