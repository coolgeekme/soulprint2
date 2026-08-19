// OAuth 2.1 authorization-server helpers for the hosted SoulPrint MCP.
//
// Standard authorization-code + PKCE (S256). The issued access token is the
// existing SoulPrint JWT (lib/auth.js generateToken), so the MCP endpoint
// validates it through the same authenticate() path as the rest of the app —
// no separate token store or introspection endpoint needed.

import crypto from 'crypto';
import { getDb } from '@/lib/mongodb';
import { generateToken } from '@/lib/auth';

const FALLBACK_BASE =
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

// Derive the base URL from the incoming request's Host header so every OAuth
// URL (issuer, redirect_uri, discovery) points back to the SAME domain the
// client called. NEXT_PUBLIC_BASE_URL carries the preview domain even on prod
// (same guard as lib/handlers/device-auth.js), which would send ChatGPT's
// redirect + discovery to the wrong host and break the connector flow.
export function getBaseUrl(request) {
  const host =
    request?.headers?.get?.('x-forwarded-host') ||
    request?.headers?.get?.('host');
  if (host) return `https://${host}`;
  return FALLBACK_BASE;
}

export function getOAuth(request) {
  const base = getBaseUrl(request);
  const baseHost = hostOf(base);
  return {
    issuer: base,
    clientId: process.env.MCP_OAUTH_CLIENT_ID || 'soulprint-mcp-client',
    // Redirect target used by the CIMD `mcp` extension in the discovery doc.
    redirectUri: `${base}/api/mcp/oauth/callback`,
    authorizeUrl: `${base}/api/mcp/oauth/authorize`,
    tokenUrl: `${base}/api/mcp/oauth/token`,
    // Dynamic Client Registration (Claude.ai registers itself — no app dashboard).
    registrationUrl: `${base}/api/mcp/oauth/register`,
    // Well-known discovery URLs (MCP OAuth / RFC 9728 + RFC 8414).
    resourceMetadataUrl: `${base}/.well-known/oauth-protected-resource`,
    authServerUrl: `${base}/.well-known/oauth-authorization-server`,
    // Hosts the authorize endpoint will accept for `redirect_uri`.
    allowedRedirectHosts: [
      baseHost,
      'chatgpt.com',
      'connector.chatgpt.com',
      'chat.openai.com',
      'openai.com',
      'claude.ai',
      'anthropic.com',
    ].filter(Boolean),
    // Hosts accepted for `client_id` under CIMD. ChatGPT presents its metadata
    // document URL (e.g. https://chatgpt.com/oauth/client.json) as the client_id,
    // NOT the predefined client. Note: baseHost is deliberately excluded — our own
    // domain is not a valid OAuth client.
    clientHosts: ['chatgpt.com', 'connector.chatgpt.com', 'chat.openai.com', 'openai.com'],
  };
}

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

export function isRedirectAllowed(redirectUri, request) {
  if (!redirectUri) return false;
  const h = hostOf(redirectUri);
  return h ? getOAuth(request).allowedRedirectHosts.includes(h) : false;
}

// CIMD client identification: ChatGPT sends its client metadata document URL
// (chatgpt.com/oauth/.../client.json) as `client_id`. We also keep the
// predefined client for backward compat. Client identity is ultimately bound
// by PKCE + the redirect_uri allowlist, so accepting a known-host client_id is
// safe here.
export function isKnownClient(clientId, request) {
  if (!clientId) return false;
  if (clientId === getOAuth(request).clientId) return true;
  const h = hostOf(clientId);
  return h ? getOAuth(request).clientHosts.includes(h) : false;
}

// ── Dynamic Client Registration (RFC 7591) — Claude.ai MCP connector ──────
//
// Claude has no "register an app" dashboard: it POSTs its redirect_uri + auth
// method to `registrationUrl` and we mint a client_id + client_secret it uses
// for the authorization-code flow. ChatGPT does NOT use this — it identifies
// itself via CIMD (client_id = its metadata-document URL) instead, so this path
// is additive and leaves the CIMD flow untouched.

export function generateClientId() {
  return 'soulprint-' + crypto.randomBytes(12).toString('base64url');
}

export function generateClientSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

export async function registerClient({
  redirect_uris = [],
  token_endpoint_auth_method = 'client_secret_post',
  client_name = 'Claude',
}) {
  const db = await getDb();
  const client_id = generateClientId();
  const client_secret = generateClientSecret();
  const now = Math.floor(Date.now() / 1000);
  await db.collection('oauth_clients').insertOne({
    client_id,
    client_secret,
    redirect_uris,
    token_endpoint_auth_method,
    // Only advertise grants we actually serve (no refresh_token yet).
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_name,
    created_at: new Date(),
  });
  return {
    client_id,
    client_secret,
    client_id_issued_at: now,
    client_secret_expires_at: 0, // never expires
    redirect_uris,
    token_endpoint_auth_method,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_name,
  };
}

export async function getRegisteredClient(clientId) {
  if (!clientId) return null;
  const db = await getDb();
  return db.collection('oauth_clients').findOne({ client_id: clientId });
}

// Constant-time client_secret comparison (client_secret_post).
export function verifyClientSecret(secret, expected) {
  if (!secret || !expected) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Refresh tokens — Claude advertises the refresh_token grant in its DCR request,
// so we support it. The 365d JWT makes refresh rare, but the grant must exist.
export async function storeRefreshToken({ user_id, client_id, scope }) {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString('base64url');
  await db.collection('oauth_refresh_tokens').insertOne({
    token,
    user_id,
    client_id,
    scope: scope || 'mcp:tools soulprint.mcp',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });
  return token;
}

export async function consumeRefreshToken(token) {
  if (!token) return null;
  const db = await getDb();
  const rec = await db.collection('oauth_refresh_tokens').findOne({ token });
  if (!rec) return null;
  if (new Date() > new Date(rec.expires_at)) return null;
  return rec;
}

export { generateToken as issueAccessToken };
