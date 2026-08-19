// OAuth 2.1 authorization-server helpers for the hosted SoulPrint MCP.
//
// Standard authorization-code + PKCE (S256). The issued access token is the
// existing SoulPrint JWT (lib/auth.js generateToken), so the MCP endpoint
// validates it through the same authenticate() path as the rest of the app —
// no separate token store or introspection endpoint needed.

import crypto from 'crypto';
import { getDb } from '@/lib/mongodb';
import { generateToken } from '@/lib/auth';

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://soulprintengine.ai';

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const baseHost = hostOf(BASE_URL);

export const OAUTH = {
  issuer: BASE_URL,
  clientId: process.env.MCP_OAUTH_CLIENT_ID || 'soulprint-mcp-client',
  // Redirect target used by the CIMD `mcp` extension in the discovery doc.
  redirectUri: `${BASE_URL}/api/mcp/oauth/callback`,
  authorizeUrl: `${BASE_URL}/api/mcp/oauth/authorize`,
  tokenUrl: `${BASE_URL}/api/mcp/oauth/token`,
  // Well-known discovery URLs (MCP OAuth / RFC 9728 + RFC 8414).
  resourceMetadataUrl: `${BASE_URL}/.well-known/oauth-protected-resource`,
  authServerUrl: `${BASE_URL}/.well-known/oauth-authorization-server`,
  // Hosts the authorize endpoint will accept for `redirect_uri`.
  allowedRedirectHosts: [
    baseHost,
    'chatgpt.com',
    'connector.chatgpt.com',
    'chat.openai.com',
    'openai.com',
  ].filter(Boolean),
};

export function generateCode() {
  return crypto.randomBytes(32).toString('base64url');
}

export async function storeAuthCode({
  code,
  user_id,
  client_id,
  redirect_uri,
  code_challenge,
  code_challenge_method,
}) {
  const db = await getDb();
  await db.collection('oauth_codes').insertOne({
    code,
    user_id,
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method: code_challenge_method || 'S256',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    used: false,
  });
  return code;
}

export async function consumeAuthCode(code) {
  const db = await getDb();
  const rec = await db.collection('oauth_codes').findOne({ code });
  if (!rec) return null;
  if (rec.used) return null;
  if (new Date() > new Date(rec.expires_at)) return null;
  await db.collection('oauth_codes').updateOne({ code }, { $set: { used: true } });
  return rec;
}

// PKCE S256 verification (constant-time compare).
export function verifyPkce(codeVerifier, codeChallenge, method = 'S256') {
  if (!codeVerifier || !codeChallenge) return false;
  if (method === 'S256') {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const a = Buffer.from(hash);
    const b = Buffer.from(codeChallenge);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  return codeVerifier === codeChallenge; // 'plain' fallback
}

export function isRedirectAllowed(redirectUri) {
  if (!redirectUri) return false;
  const h = hostOf(redirectUri);
  return h ? OAUTH.allowedRedirectHosts.includes(h) : false;
}

export { generateToken as issueAccessToken };
