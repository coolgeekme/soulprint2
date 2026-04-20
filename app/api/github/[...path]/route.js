import { NextResponse } from 'next/server';
import {
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
} from '@/lib/handlers/github-integration';

export const dynamic = 'force-dynamic';

function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}
function err(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // GET /api/github/connect?user_id=xxx — Initiate OAuth flow
    if (pathStr === 'connect') {
      return handleGitHubConnect(request);
    }

    // GET /api/github/callback?code=xxx&state=xxx — OAuth callback from GitHub
    if (pathStr === 'callback') {
      return handleGitHubCallback(request);
    }

    // GET /api/github/status?user_id=xxx — Check connection status
    if (pathStr === 'status') {
      return handleGitHubStatus(request);
    }

    // GET /api/github/repos?user_id=xxx — List user's repositories
    if (pathStr === 'repos') {
      return handleGitHubRepos(request);
    }

    // GET /api/github/repo/contents?user_id=xxx&owner=xxx&repo=xxx&path=xxx
    if (pathStr === 'repo/contents') {
      return handleGitHubContents(request);
    }

    // GET /api/github/repo/pulls?user_id=xxx&owner=xxx&repo=xxx
    if (pathStr === 'repo/pulls') {
      return handleGitHubPulls(request);
    }

    // GET /api/github/repo/issues?user_id=xxx&owner=xxx&repo=xxx
    if (pathStr === 'repo/issues') {
      return handleGitHubIssues(request);
    }

    // GET /api/github/repo/commits?user_id=xxx&owner=xxx&repo=xxx
    if (pathStr === 'repo/commits') {
      return handleGitHubCommits(request);
    }

    return err('Not found', 404);
  } catch (error) {
    console.error('[GitHub GET] Error:', error);
    return err(error.message, 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // POST /api/github/disconnect — Disconnect GitHub
    if (pathStr === 'disconnect') {
      return handleGitHubDisconnect(request);
    }

    // POST /api/github/repo/file — Create or update a file
    if (pathStr === 'repo/file') {
      return handleGitHubFileWrite(request);
    }

    // POST /api/github/repo/pulls — Create a pull request
    if (pathStr === 'repo/pulls') {
      return handleGitHubCreatePR(request);
    }

    // POST /api/github/repo/issues — Create an issue
    if (pathStr === 'repo/issues') {
      return handleGitHubCreateIssue(request);
    }

    return err('Not found', 404);
  } catch (error) {
    console.error('[GitHub POST] Error:', error);
    return err(error.message, 500);
  }
}
