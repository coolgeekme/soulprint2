/**
 * GitHub OAuth + API Integration for SoulPrint Engine
 * 
 * Handles:
 * - OAuth flow (connect, callback, disconnect)
 * - Repository browsing
 * - File read/write
 * - Pull request management
 * - Issue management
 * - Commit history
 * - Chat-integrated GitHub commands
 */

import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ── Encryption helpers ──────────────────────────────────────────────────
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  // Use a stable key derived from the GitHub client secret
  const secret = process.env.GITHUB_CLIENT_SECRET || 'fallback-key-for-dev';
  return crypto.scryptSync(secret, 'soulprint-github-salt', 32);
}

function encryptToken(token) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptToken(encryptedData) {
  try {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[GitHub] Token decryption failed:', err.message);
    return null;
  }
}

// ── Helper: Get user's GitHub token ─────────────────────────────────────
async function getUserGitHubToken(userId) {
  const db = await getDb();
  const connection = await db.collection('github_connections').findOne({ user_id: userId });
  if (!connection || !connection.encrypted_access_token) return null;
  const token = decryptToken(connection.encrypted_access_token);
  return token;
}

async function getUserGitHubConnection(userId) {
  const db = await getDb();
  return db.collection('github_connections').findOne({ user_id: userId });
}

// ── Helper: GitHub API fetch ────────────────────────────────────────────
async function githubApiFetch(token, path, options = {}) {
  const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, ok: res.ok };
}

// ── OAuth Handlers ──────────────────────────────────────────────────────

/**
 * GET /api/github/connect — Initiates OAuth flow
 */
async function handleGitHubConnect(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const callbackUrl = process.env.GITHUB_OAUTH_CALLBACK_URL;
  const scopes = 'repo user:email read:user';
  
  // Generate state parameter for CSRF protection (store in DB)
  const state = uuidv4();
  const db = await getDb();
  await db.collection('github_oauth_states').insertOne({
    state,
    user_id: userId,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 min expiry
  });

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${state}`;
  
  return new Response(JSON.stringify({ authUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/github/callback — OAuth callback from GitHub
 */
async function handleGitHubCallback(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Derive base URL from the actual request (so it works on any domain)
  const baseUrl = `${url.protocol}//${url.host}`;

  if (error) {
    return Response.redirect(`${baseUrl}/chat?github_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return Response.redirect(`${baseUrl}/chat?github_error=missing_params`);
  }

  // Verify state
  const db = await getDb();
  const stateDoc = await db.collection('github_oauth_states').findOne({ state });
  if (!stateDoc) {
    return Response.redirect(`${baseUrl}/chat?github_error=invalid_state`);
  }
  
  // Clean up state
  await db.collection('github_oauth_states').deleteOne({ state });

  if (new Date() > stateDoc.expires_at) {
    return Response.redirect(`${baseUrl}/chat?github_error=state_expired`);
  }

  const userId = stateDoc.user_id;

  // Exchange code for access token
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('[GitHub] Token exchange failed:', tokenData);
      return Response.redirect(`${baseUrl}/chat?github_error=token_exchange_failed`);
    }

    const accessToken = tokenData.access_token;
    const scopes = tokenData.scope || '';

    // Fetch GitHub user profile
    const { data: userInfo } = await githubApiFetch(accessToken, '/user');
    if (!userInfo || !userInfo.login) {
      return Response.redirect(`${baseUrl}/chat?github_error=user_fetch_failed`);
    }

    // Store encrypted token + connection info
    const encrypted = encryptToken(accessToken);
    await db.collection('github_connections').updateOne(
      { user_id: userId },
      {
        $set: {
          user_id: userId,
          github_id: userInfo.id,
          github_username: userInfo.login,
          github_name: userInfo.name || userInfo.login,
          github_avatar: userInfo.avatar_url,
          github_email: userInfo.email,
          encrypted_access_token: encrypted,
          scopes,
          connected_at: new Date(),
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );

    console.log(`[GitHub] User ${userId} connected as @${userInfo.login}`);
    return Response.redirect(`${baseUrl}/chat?github_connected=true&github_user=${userInfo.login}`);
  } catch (err) {
    console.error('[GitHub] OAuth callback error:', err);
    return Response.redirect(`${baseUrl}/chat?github_error=server_error`);
  }
}

/**
 * POST /api/github/disconnect — Disconnect GitHub
 */
async function handleGitHubDisconnect(request) {
  try {
    const { userId } = await request.json();
    if (!userId) return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });

    const db = await getDb();
    await db.collection('github_connections').deleteOne({ user_id: userId });
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * GET /api/github/status — Check connection status
 */
async function handleGitHubStatus(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  if (!userId) return new Response(JSON.stringify({ connected: false }), { status: 200 });

  const connection = await getUserGitHubConnection(userId);
  if (!connection) return new Response(JSON.stringify({ connected: false }), { status: 200 });

  return new Response(JSON.stringify({
    connected: true,
    github_username: connection.github_username,
    github_name: connection.github_name,
    github_avatar: connection.github_avatar,
    connected_at: connection.connected_at,
  }), { status: 200 });
}

// ── GitHub API Handlers ─────────────────────────────────────────────────

/**
 * GET /api/github/repos — List user's repositories
 */
async function handleGitHubRepos(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const sort = url.searchParams.get('sort') || 'updated';
  const page = url.searchParams.get('page') || '1';
  
  const token = await getUserGitHubToken(userId);
  if (!token) return new Response(JSON.stringify({ error: 'GitHub not connected' }), { status: 401 });

  const { data, ok, status } = await githubApiFetch(token, `/user/repos?sort=${sort}&per_page=30&page=${page}&type=all`);
  if (!ok) return new Response(JSON.stringify({ error: 'Failed to fetch repos', details: data }), { status });

  // Return simplified repo list
  const repos = (data || []).map(r => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    description: r.description,
    language: r.language,
    private: r.private,
    default_branch: r.default_branch,
    html_url: r.html_url,
    updated_at: r.updated_at,
    stargazers_count: r.stargazers_count,
    open_issues_count: r.open_issues_count,
  }));

  return new Response(JSON.stringify({ repos }), { status: 200 });
}

/**
 * GET /api/github/repo/contents — Browse files in a repo
 */
async function handleGitHubContents(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const owner = url.searchParams.get('owner');
  const repo = url.searchParams.get('repo');
  const path = url.searchParams.get('path') || '';
  const ref = url.searchParams.get('ref') || '';

  const token = await getUserGitHubToken(userId);
  if (!token) return new Response(JSON.stringify({ error: 'GitHub not connected' }), { status: 401 });

  let apiPath = `/repos/${owner}/${repo}/contents/${path}`;
  if (ref) apiPath += `?ref=${ref}`;

  const { data, ok, status } = await githubApiFetch(token, apiPath);
  if (!ok) return new Response(JSON.stringify({ error: 'Failed to fetch contents', details: data }), { status });

  // If it's a file (not array), decode content
  if (data && !Array.isArray(data) && data.content) {
    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
    return new Response(JSON.stringify({ 
      type: 'file',
      name: data.name,
      path: data.path,
      size: data.size,
      sha: data.sha,
      content: decoded,
      encoding: 'utf-8',
    }), { status: 200 });
  }

  // Directory listing
  const items = (Array.isArray(data) ? data : []).map(item => ({
    name: item.name,
    path: item.path,
    type: item.type, // "file" or "dir"
    size: item.size,
    sha: item.sha,
  }));

  return new Response(JSON.stringify({ type: 'directory', items }), { status: 200 });
}

/**
 * POST /api/github/repo/file — Create or update a file
 */
async function handleGitHubFileWrite(request) {
  try {
    const { userId, owner, repo, path, content, message, branch, sha } = await request.json();
    
    const token = await getUserGitHubToken(userId);
    if (!token) return new Response(JSON.stringify({ error: 'GitHub not connected' }), { status: 401 });

    const encodedContent = Buffer.from(content).toString('base64');
    const body = {
      message: message || `Update ${path} via SoulPrint`,
      content: encodedContent,
    };
    if (sha) body.sha = sha; // Required for updates
    if (branch) body.branch = branch;

    const { data, ok, status } = await githubApiFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (!ok) return new Response(JSON.stringify({ error: 'Failed to write file', details: data }), { status });
    return new Response(JSON.stringify({ success: true, commit: data.commit }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * GET /api/github/repo/pulls — List pull requests
 */
async function handleGitHubPulls(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const owner = url.searchParams.get('owner');
  const repo = url.searchParams.get('repo');
  const state = url.searchParams.get('state') || 'open';

  const token = await getUserGitHubToken(userId);
  if (!token) return new Response(JSON.stringify({ error: 'GitHub not connected' }), { status: 401 });

  const { data, ok, status } = await githubApiFetch(token, `/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`);
  if (!ok) return new Response(JSON.stringify({ error: 'Failed to fetch PRs', details: data }), { status });

  const pulls = (data || []).map(pr => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    user: pr.user?.login,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    html_url: pr.html_url,
    head: pr.head?.ref,
    base: pr.base?.ref,
    body: pr.body?.substring(0, 500),
  }));

  return new Response(JSON.stringify({ pulls }), { status: 200 });
}

/**
 * POST /api/github/repo/pulls — Create a pull request
 */
async function handleGitHubCreatePR(request) {
  try {
    const { userId, owner, repo, title, body, head, base } = await request.json();

    const token = await getUserGitHubToken(userId);
    if (!token) return new Response(JSON.stringify({ error: 'GitHub not connected' }), { status: 401 });

    const { data, ok, status } = await githubApiFetch(token, `/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({ title, body: body || '', head, base: base || 'main' }),
    });

    if (!ok) return new Response(JSON.stringify({ error: 'Failed to create PR', details: data }), { status });
    return new Response(JSON.stringify({ success: true, pr: { number: data.number, html_url: data.html_url, title: data.title } }), { status: 201 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * GET /api/github/repo/issues — List issues
 */
async function handleGitHubIssues(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const owner = url.searchParams.get('owner');
  const repo = url.searchParams.get('repo');
  const state = url.searchParams.get('state') || 'open';

  const token = await getUserGitHubToken(userId);
  if (!token) return new Response(JSON.stringify({ error: 'GitHub not connected' }), { status: 401 });

  const { data, ok, status } = await githubApiFetch(token, `/repos/${owner}/${repo}/issues?state=${state}&per_page=30`);
  if (!ok) return new Response(JSON.stringify({ error: 'Failed to fetch issues', details: data }), { status });

  const issues = (data || []).filter(i => !i.pull_request).map(issue => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    user: issue.user?.login,
    labels: issue.labels?.map(l => l.name),
    created_at: issue.created_at,
    html_url: issue.html_url,
    body: issue.body?.substring(0, 500),
  }));

  return new Response(JSON.stringify({ issues }), { status: 200 });
}

/**
 * POST /api/github/repo/issues — Create an issue
 */
async function handleGitHubCreateIssue(request) {
  try {
    const { userId, owner, repo, title, body, labels } = await request.json();

    const token = await getUserGitHubToken(userId);
    if (!token) return new Response(JSON.stringify({ error: 'GitHub not connected' }), { status: 401 });

    const { data, ok, status } = await githubApiFetch(token, `/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body: body || '', labels: labels || [] }),
    });

    if (!ok) return new Response(JSON.stringify({ error: 'Failed to create issue', details: data }), { status });
    return new Response(JSON.stringify({ success: true, issue: { number: data.number, html_url: data.html_url, title: data.title } }), { status: 201 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * GET /api/github/repo/commits — List commits
 */
async function handleGitHubCommits(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const owner = url.searchParams.get('owner');
  const repo = url.searchParams.get('repo');
  const branch = url.searchParams.get('branch') || 'main';

  const token = await getUserGitHubToken(userId);
  if (!token) return new Response(JSON.stringify({ error: 'GitHub not connected' }), { status: 401 });

  const { data, ok, status } = await githubApiFetch(token, `/repos/${owner}/${repo}/commits?sha=${branch}&per_page=20`);
  if (!ok) return new Response(JSON.stringify({ error: 'Failed to fetch commits', details: data }), { status });

  const commits = (data || []).map(c => ({
    sha: c.sha?.substring(0, 7),
    full_sha: c.sha,
    message: c.commit?.message,
    author: c.commit?.author?.name,
    date: c.commit?.author?.date,
    html_url: c.html_url,
  }));

  return new Response(JSON.stringify({ commits }), { status: 200 });
}

// ── Chat Integration Helper ─────────────────────────────────────────────

/**
 * Process a GitHub command from chat
 * Returns context string to inject into the AI prompt, or null
 */
async function processGitHubChatCommand(userId, content) {
  const token = await getUserGitHubToken(userId);
  
  // Check for explicit /github commands
  const lower = content.toLowerCase().trim();
  
  if (lower === '/github' || lower === '/github help') {
    const connected = !!token;
    return {
      type: 'system_response',
      content: connected
        ? `✅ **GitHub Connected**\n\nAvailable commands:\n- \`/github repos\` — List your repositories\n- \`/github repo owner/name\` — Set active repo\n- \`/github files [path]\` — Browse files\n- \`/github issues\` — List open issues\n- \`/github pulls\` — List pull requests\n- \`/github commits\` — Recent commits\n- \`/github disconnect\` — Disconnect GitHub\n\nOr just ask naturally: "Show me the files in my project" or "What are the open issues in my-repo?"`
        : `🔗 **GitHub Not Connected**\n\nConnect your GitHub account to:\n- Browse repos & code\n- Get AI help with your codebase\n- Create PRs and manage issues\n\nClick the **GitHub icon** in settings or use the connection button.`,
    };
  }

  if (!token) {
    // Only trigger for EXPLICIT GitHub mentions — must contain the word "github" or exact slash commands
    if (/\bgithub\b/i.test(content) || /^\/github\b/i.test(content.trim())) {
      return {
        type: 'system_response',
        content: '🔗 You need to connect your GitHub account first. Go to **Settings → Integrations → Connect GitHub** to get started.',
      };
    }
    return null;
  }

  // /github repos
  if (lower.startsWith('/github repos')) {
    const { data } = await githubApiFetch(token, '/user/repos?sort=updated&per_page=15&type=all');
    if (!data || !Array.isArray(data)) return { type: 'system_response', content: '❌ Failed to fetch repositories.' };
    
    const repoList = data.map((r, i) => 
      `${i + 1}. **${r.full_name}** ${r.private ? '🔒' : '🌐'} — ${r.description || 'No description'} *(${r.language || 'unknown'})*`
    ).join('\n');
    
    return { type: 'system_response', content: `📂 **Your Repositories**\n\n${repoList}` };
  }

  // /github files owner/repo [path]
  const filesMatch = lower.match(/^\/github\s+files?\s+(\S+\/\S+)\s*(.*)?$/);
  if (filesMatch) {
    const [, repoFullName, filePath] = filesMatch;
    const [owner, repo] = repoFullName.split('/');
    const path = filePath?.trim() || '';
    
    const { data } = await githubApiFetch(token, `/repos/${owner}/${repo}/contents/${path}`);
    if (!data) return { type: 'system_response', content: `❌ Failed to browse \`${repoFullName}/${path}\`.` };
    
    if (Array.isArray(data)) {
      const listing = data.map(item => 
        `${item.type === 'dir' ? '📁' : '📄'} ${item.name}${item.type === 'file' ? ` (${(item.size / 1024).toFixed(1)}KB)` : ''}`
      ).join('\n');
      return { type: 'system_response', content: `📂 **${repoFullName}/${path || ''}**\n\n${listing}` };
    } else if (data.content) {
      const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
      return {
        type: 'context',
        content: `Here is the file \`${data.path}\` from \`${repoFullName}\`:\n\n\`\`\`\n${decoded.slice(0, 50000)}\n\`\`\``,
        file_name: data.name,
        file_path: data.path,
        repo: repoFullName,
      };
    }
  }

  // /github issues owner/repo
  const issuesMatch = lower.match(/^\/github\s+issues?\s+(\S+\/\S+)/);
  if (issuesMatch) {
    const [owner, repo] = issuesMatch[1].split('/');
    const { data } = await githubApiFetch(token, `/repos/${owner}/${repo}/issues?state=open&per_page=15`);
    if (!data) return { type: 'system_response', content: '❌ Failed to fetch issues.' };
    
    const issueList = data.filter(i => !i.pull_request).map(i => 
      `- **#${i.number}** ${i.title} *(${i.user?.login})*`
    ).join('\n');
    
    return { type: 'system_response', content: `🐛 **Open Issues in ${issuesMatch[1]}**\n\n${issueList || 'No open issues! 🎉'}` };
  }

  // /github pulls owner/repo
  const pullsMatch = lower.match(/^\/github\s+pulls?\s+(\S+\/\S+)/);
  if (pullsMatch) {
    const [owner, repo] = pullsMatch[1].split('/');
    const { data } = await githubApiFetch(token, `/repos/${owner}/${repo}/pulls?state=open&per_page=15`);
    if (!data) return { type: 'system_response', content: '❌ Failed to fetch pull requests.' };
    
    const prList = data.map(pr => 
      `- **#${pr.number}** ${pr.title} *(${pr.head?.ref} → ${pr.base?.ref})*`
    ).join('\n');
    
    return { type: 'system_response', content: `🔀 **Open PRs in ${pullsMatch[1]}**\n\n${prList || 'No open PRs.'}` };
  }

  // /github commits owner/repo
  const commitsMatch = lower.match(/^\/github\s+commits?\s+(\S+\/\S+)/);
  if (commitsMatch) {
    const [owner, repo] = commitsMatch[1].split('/');
    const { data } = await githubApiFetch(token, `/repos/${owner}/${repo}/commits?per_page=10`);
    if (!data) return { type: 'system_response', content: '❌ Failed to fetch commits.' };
    
    const commitList = data.map(c => 
      `- \`${c.sha?.substring(0, 7)}\` ${c.commit?.message?.split('\n')[0]} *(${c.commit?.author?.name})*`
    ).join('\n');
    
    return { type: 'system_response', content: `📝 **Recent Commits in ${commitsMatch[1]}**\n\n${commitList}` };
  }

  // /github disconnect
  if (lower === '/github disconnect') {
    const db = await getDb();
    const connection = await db.collection('github_connections').findOne({ user_id: userId });
    if (connection) {
      await db.collection('github_connections').deleteOne({ user_id: userId });
      return { type: 'system_response', content: '✅ GitHub account disconnected successfully.' };
    }
    return { type: 'system_response', content: 'You don\'t have a GitHub account connected.' };
  }

  // Natural language GitHub detection — ONLY trigger when "github" is explicitly mentioned
  // This prevents false positives on general words like "project", "file", "commit", etc.
  const githubNLPatterns = [
    /\b(?:look at|check|browse|show|open|read|view)\b.*\b(?:github)\b/i,
    /\bgithub\b.*\b(?:repo|repository|codebase|issues?|pull requests?|PRs|commits?)\b/i,
    /\b(?:my|the)\s+github\b/i,
    /\b(?:help me|assist|debug|fix|review)\b.*\bgithub\b/i,
  ];

  const isGitHubNL = githubNLPatterns.some(p => p.test(content));
  if (isGitHubNL) {
    // Fetch user's repos to give the AI context
    const { data } = await githubApiFetch(token, '/user/repos?sort=updated&per_page=5&type=all');
    const repoContext = data ? data.map(r => `${r.full_name} (${r.language || 'unknown'})`).join(', ') : 'unable to fetch';
    
    return {
      type: 'context',
      content: `[GITHUB CONTEXT] User has GitHub connected as @${(await getUserGitHubConnection(userId))?.github_username}. Their recent repos: ${repoContext}. You can help them with their code, repos, issues, and PRs. Ask which repo they want to work with if unclear. You can read files, create issues, create PRs, and browse commit history.`,
    };
  }

  return null;
}

export {
  handleGitHubConnect,
  handleGitHubCallback,
  handleGitHubDisconnect,
  handleGitHubStatus,
  handleGitHubRepos,
  handleGitHubContents,
  handleGitHubFileWrite,
  handleGitHubPulls,
  handleGitHubCreatePR,
  handleGitHubIssues,
  handleGitHubCreateIssue,
  handleGitHubCommits,
  processGitHubChatCommand,
  getUserGitHubToken,
  getUserGitHubConnection,
  githubApiFetch,
};
