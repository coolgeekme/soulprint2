/**
 * Composio API Routes
 * Handles connected apps management, OAuth flows, and tool execution
 */
import { ok, err, authenticate } from '@/lib/api-utils';
import {
  getStatus,
  getUserConnections,
  getAuthLink,
  disconnectAccount,
  getToolsForUser,
  SUPPORTED_TOOLKITS,
} from '@/lib/handlers/composio';

// ── GET routes ─────────────────────────────────────────────────────────
export async function GET(request, { params }) {
  const pathArr = (await params).path || [];
  const pathStr = pathArr.join('/');

  // GET /api/composio/status — Health check (no auth required)
  if (pathStr === 'status') {
    try {
      const status = await getStatus();
      return ok(status);
    } catch (e) {
      return err(e.message, 500);
    }
  }

  // All other routes require auth
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  // GET /api/composio/toolkits — List supported toolkits
  if (pathStr === 'toolkits') {
    return ok({
      toolkits: Object.entries(SUPPORTED_TOOLKITS).map(([key, val]) => ({
        key,
        ...val,
      })),
    });
  }

  // GET /api/composio/connections — List user's connected accounts
  if (pathStr === 'connections') {
    try {
      const filterSupported = request.nextUrl.searchParams.get('supported') === 'true';
      const connections = await getUserConnections(user.id, { filterSupported });
      return ok({ connections });
    } catch (e) {
      return err(e.message, 500);
    }
  }

  // GET /api/composio/tools — List available tools for user's connected apps
  if (pathStr === 'tools') {
    try {
      const toolkit = request.nextUrl.searchParams.get('toolkit');
      const toolkitNames = toolkit ? [toolkit] : [];
      const { tools } = await getToolsForUser(user.id, toolkitNames);
      return ok({
        tools: tools.map(t => ({
          name: t.function?.name,
          description: t.function?.description?.slice(0, 200),
        })),
        count: tools.length,
      });
    } catch (e) {
      return err(e.message, 500);
    }
  }

  return err('Not found', 404);
}

// ── POST routes ────────────────────────────────────────────────────────
export async function POST(request, { params }) {
  const pathArr = (await params).path || [];
  const pathStr = pathArr.join('/');

  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  // POST /api/composio/connect — Get OAuth link for a toolkit
  if (pathStr === 'connect') {
    try {
      const { toolkit } = await request.json();
      if (!toolkit || !SUPPORTED_TOOLKITS[toolkit]) {
        return err(`Invalid toolkit. Supported: ${Object.keys(SUPPORTED_TOOLKITS).join(', ')}`);
      }
      const result = await getAuthLink(user.id, toolkit);
      return ok(result);
    } catch (e) {
      return err(e.message, 500);
    }
  }

  // POST /api/composio/disconnect — Remove a connected account
  if (pathStr === 'disconnect') {
    try {
      const { connectionId } = await request.json();
      if (!connectionId) return err('connectionId is required');
      const result = await disconnectAccount(user.id, connectionId);
      return ok(result);
    } catch (e) {
      return err(e.message, 500);
    }
  }

  return err('Not found', 404);
}
