# ✅ MCP OAuth Host Fix Successfully Applied

## 📦 Commit Applied

**HEAD:** `5e146ae` - MCP OAuth: derive base URL from request Host (fix preview-domain URLs in discovery)  
**Total Changes:** 5 files changed, 68 insertions(+), 46 deletions(-)

---

## 🐛 Problem Fixed

**Issue:** OAuth/MCP discovery URLs were using `NEXT_PUBLIC_BASE_URL` environment variable, which contains the preview domain even when running in production.

**Impact:** 
- Production OAuth discovery returned preview URLs
- ChatGPT connectors would be redirected to wrong domain
- MCP OAuth flow would fail in production

**Example of the bug:**
```bash
# Production request
curl https://voice-chat-enhanced.emergent.host/.well-known/oauth-authorization-server

# Would return preview URLs (WRONG):
{
  "issuer": "https://soulprint-engine.preview.emergentagent.com",
  "authorization_endpoint": "https://soulprint-engine.preview.emergentagent.com/api/mcp/oauth/authorize",
  ...
}
```

---

## 🔧 Solution Implemented

**Changed OAuth configuration from static to dynamic:**

### Before (Static Configuration)
```javascript
// lib/mcp/oauth.js
export const OAUTH = {
  issuer: process.env.NEXT_PUBLIC_BASE_URL,
  authorizeUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/mcp/oauth/authorize`,
  // ... all URLs hardcoded from env var
};
```

### After (Dynamic Configuration)
```javascript
// lib/mcp/oauth.js
export function getBaseUrl(request) {
  const host = request?.headers?.get?.('x-forwarded-host') || 
               request?.headers?.get?.('host');
  if (host) return `https://${host}`;
  return FALLBACK_BASE;
}

export function getOAuth(request) {
  const base = getBaseUrl(request);
  return {
    issuer: base,
    authorizeUrl: `${base}/api/mcp/oauth/authorize`,
    tokenUrl: `${base}/api/mcp/oauth/token`,
    redirectUri: `${base}/api/mcp/oauth/callback`,
    resourceMetadataUrl: `${base}/.well-known/oauth-protected-resource`,
    authServerUrl: `${base}/.well-known/oauth-authorization-server`,
    // ...
  };
}
```

---

## 📋 Files Modified

### 1. **`lib/mcp/oauth.js`** (Core OAuth configuration)
- Changed static `OAUTH` constant to `getOAuth(request)` function
- Added `getBaseUrl(request)` helper to extract host from request headers
- All OAuth URLs now derive from request host
- Fallback to `NEXT_PUBLIC_BASE_URL` if host header missing

### 2. **`app/api/mcp/route.js`** (MCP endpoint)
- Updated `wwwAuthenticate(request)` to call `getOAuth(request)`
- WWW-Authenticate header now uses correct domain

**Before:**
```javascript
const WWW_AUTHENTICATE = `Bearer resource_metadata="${OAUTH.resourceMetadataUrl}", authorization_server="${OAUTH.authServerUrl}"`;
```

**After:**
```javascript
function wwwAuthenticate(request) {
  const oauth = getOAuth(request);
  return `Bearer resource_metadata="${oauth.resourceMetadataUrl}", authorization_server="${oauth.authServerUrl}"`;
}
```

### 3. **`app/api/mcp/oauth/authorize/route.js`** (Authorization endpoint)
- Threads `request` through `getOAuth(request)`
- Updated `fail()` function to accept request parameter
- Updated `isRedirectAllowed()` calls to pass request

**Changes:**
```javascript
export async function GET(request) {
  const oauth = getOAuth(request);  // NEW: Get dynamic config
  // ... rest of authorization flow
  if (!isRedirectAllowed(redirect_uri, request)) {  // NEW: Pass request
    return fail(request, redirect_uri, state, 'invalid_redirect_uri');
  }
}
```

### 4. **`app/.well-known/oauth-authorization-server/[[...path]]/route.js`** (Discovery)
- Added `request` parameter to `GET(request)` handler
- Calls `getOAuth(request)` to get dynamic URLs

**Before:**
```javascript
export async function GET() {
  return NextResponse.json({
    issuer: OAUTH.issuer,
    authorization_endpoint: OAUTH.authorizeUrl,
    // ... static URLs
  });
}
```

**After:**
```javascript
export async function GET(request) {
  const oauth = getOAuth(request);
  return NextResponse.json({
    issuer: oauth.issuer,
    authorization_endpoint: oauth.authorizeUrl,
    token_endpoint: oauth.tokenUrl,
    // ... all URLs from request host
  });
}
```

### 5. **`app/.well-known/oauth-protected-resource/route.js`** (Protected resource metadata)
- Added `request` parameter to `GET(request)` handler
- Calls `getOAuth(request)` for dynamic resource URL

**Before:**
```javascript
export async function GET() {
  return NextResponse.json({
    resource: `${OAUTH.issuer}/api/mcp`,
    authorization_servers: [OAUTH.authServerUrl],
  });
}
```

**After:**
```javascript
export async function GET(request) {
  const oauth = getOAuth(request);
  return NextResponse.json({
    resource: `${oauth.issuer}/api/mcp`,
    authorization_servers: [`${oauth.issuer}/.well-known/oauth-authorization-server`],
  });
}
```

---

## 🧪 Testing Results

### Test 1: Localhost (no custom host)
```bash
curl http://localhost:3000/.well-known/oauth-authorization-server | jq .issuer
# "https://localhost:3000" ✅
```

### Test 2: With x-forwarded-host (production simulation)
```bash
curl -H "x-forwarded-host: voice-chat-enhanced.emergent.host" \
     http://localhost:3000/.well-known/oauth-authorization-server | jq .issuer
# "https://voice-chat-enhanced.emergent.host" ✅
```

### Test 3: Protected resource metadata
```bash
curl -H "x-forwarded-host: voice-chat-enhanced.emergent.host" \
     http://localhost:3000/.well-known/oauth-protected-resource | jq .
# {
#   "resource": "https://voice-chat-enhanced.emergent.host/api/mcp",
#   "authorization_servers": [
#     "https://voice-chat-enhanced.emergent.host/.well-known/oauth-authorization-server"
#   ]
# } ✅
```

### Test 4: WWW-Authenticate header
```bash
curl -i -X POST -H "x-forwarded-host: voice-chat-enhanced.emergent.host" \
     http://localhost:3000/api/mcp | grep www-authenticate
# www-authenticate: Bearer resource_metadata="https://voice-chat-enhanced.emergent.host/.well-known/oauth-protected-resource", authorization_server="https://voice-chat-enhanced.emergent.host/.well-known/oauth-authorization-server" ✅
```

---

## ✅ Benefits

1. **Production URLs in Production:** OAuth discovery now returns production domain URLs when accessed from production
2. **Preview URLs in Preview:** Discovery returns preview URLs when accessed from preview environment
3. **ChatGPT Compatibility:** Connectors will be redirected to the correct domain
4. **Localhost Testing:** Works correctly in local development
5. **No Environment Drift:** No longer dependent on static environment variables

---

## 🎯 How It Works

**Request Flow:**
1. Client requests `https://voice-chat-enhanced.emergent.host/.well-known/oauth-authorization-server`
2. Next.js receives request with `x-forwarded-host: voice-chat-enhanced.emergent.host` header
3. `getBaseUrl(request)` extracts host: `voice-chat-enhanced.emergent.host`
4. `getOAuth(request)` builds URLs: `https://voice-chat-enhanced.emergent.host/...`
5. Response contains correct production URLs

**Kubernetes Ingress Headers:**
- Kubernetes automatically adds `x-forwarded-host` header with the actual domain
- This header takes precedence over the standard `host` header
- Fallback to `NEXT_PUBLIC_BASE_URL` if no headers present

---

## 🚀 Deployment Status

✅ **Preview Environment:** Changes applied and tested  
✅ **Dynamic Host Resolution:** Working correctly  
✅ **OAuth Discovery:** Returns correct domain URLs  
✅ **MCP Endpoint:** WWW-Authenticate uses correct URLs  
✅ **Fallback Logic:** Gracefully handles missing headers  

**Next Step:** Deploy to production (https://voice-chat-enhanced.emergent.host)

---

## 🔄 Post-Deployment Verification

After deploying to production, verify with real production domain:

1. **OAuth Discovery:**
   ```bash
   curl https://voice-chat-enhanced.emergent.host/.well-known/oauth-authorization-server
   # Should return https://voice-chat-enhanced.emergent.host URLs
   ```

2. **Protected Resource:**
   ```bash
   curl https://voice-chat-enhanced.emergent.host/.well-known/oauth-protected-resource
   # Should reference https://voice-chat-enhanced.emergent.host
   ```

3. **MCP Unauthorized Response:**
   ```bash
   curl -i https://voice-chat-enhanced.emergent.host/api/mcp
   # WWW-Authenticate header should contain production URLs
   ```

**Expected:** All URLs should point to `voice-chat-enhanced.emergent.host`  
**NOT:** `soulprint-engine.preview.emergentagent.com` (the old bug)

---

## 📚 Related Commits

This fix mirrors the same pattern used in device authorization flow:
- Commit `1e2f3ed` - Fixed device-auth verification_uri to derive from request host
- Same issue: environment variable drift between preview and production
- Same solution: Extract host from request headers

---

## ✅ Summary

**Status:** ✅ Complete  
**Commit Applied:** 5e146ae  
**Files Changed:** 5  
**Lines Changed:** +68, -46  
**Testing:** ✅ All scenarios verified  
**Ready for Production:** ✅ Yes

The MCP OAuth infrastructure now correctly derives all URLs from the incoming request's Host header, ensuring ChatGPT and other MCP clients are always redirected to the correct domain in both preview and production environments.
