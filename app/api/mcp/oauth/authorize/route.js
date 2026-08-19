// SoulPrint MCP OAuth — authorization endpoint (browser flow).
//
// ChatGPT's connector opens this URL with a PKCE authorization request, the
// user signs in (session cookie) and is redirected back to the connector with
// a one-time authorization code.

import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-utils';
import { generateCode, storeAuthCode, isRedirectAllowed, isKnownClient, getOAuth } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';

function fail(request, redirect_uri, state, error) {
  if (redirect_uri && isRedirectAllowed(redirect_uri, request)) {
    const u = new URL(redirect_uri);
    u.searchParams.set('error', error);
    u.searchParams.set('iss', getOAuth(request).issuer);
    if (state) u.searchParams.set('state', state);
    return NextResponse.redirect(u.toString());
  }
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET(request) {
  const oauth = getOAuth(request);
  const { searchParams } = new URL(request.url);
  const response_type = searchParams.get('response_type');
  const client_id = searchParams.get('client_id');
  const redirect_uri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const code_challenge = searchParams.get('code_challenge');
  const code_challenge_method = searchParams.get('code_challenge_method') || 'S256';

  if (response_type !== 'code') return fail(request, redirect_uri, state, 'unsupported_response_type');
  if (!client_id || !isKnownClient(client_id, request)) return fail(request, redirect_uri, state, 'invalid_client');
  if (!redirect_uri || !isRedirectAllowed(redirect_uri, request)) return fail(request, redirect_uri, state, 'invalid_redirect_uri');
  if (!code_challenge || code_challenge_method !== 'S256') return fail(request, redirect_uri, state, 'invalid_request');

  const user = await authenticate(request);
  if (!user) {
    const loginUrl = new URL('/auth', oauth.issuer);
    // Rebuild `next` on the PUBLIC issuer, NOT request.url. On Emergent's prod,
    // request.url is the internal render URL (https://r-<uuid>:3000/...) while
    // the public domain lives only in the Host/x-forwarded-host header — using
    // it verbatim would bounce the user into the preview environment after login.
    const req = new URL(request.url);
    const nextUrl = new URL(req.pathname + req.search, oauth.issuer);
    loginUrl.searchParams.set('next', nextUrl.toString());
    return NextResponse.redirect(loginUrl.toString());
  }

  // User-initiated connection → auto-consent, issue a one-time code.
  const code = generateCode();
  await storeAuthCode({
    code,
    user_id: user.id,
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
  });

  const u = new URL(redirect_uri);
  u.searchParams.set('code', code);
  u.searchParams.set('iss', oauth.issuer);
  if (state) u.searchParams.set('state', state);
  return NextResponse.redirect(u.toString());
}
