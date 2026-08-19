// SoulPrint MCP OAuth — callback landing.
//
// Served as the CIMD `mcp.redirect_uri` in the discovery doc. In the normal
// flow ChatGPT redirects to its own redirect_uri and this is only a fallback;
// if MCP_OAUTH_FINAL_REDIRECT is set, any incoming `code` is relayed there.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const finalRedirect = process.env.MCP_OAUTH_FINAL_REDIRECT;
  if (finalRedirect && code) {
    const u = new URL(finalRedirect);
    u.searchParams.set('code', code);
    if (state) u.searchParams.set('state', state);
    return NextResponse.redirect(u.toString());
  }

  return NextResponse.json({
    ok: true,
    note: 'SoulPrint MCP OAuth callback. You can close this tab.',
  });
}
