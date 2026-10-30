/**
 * Personal access token management endpoints.
 *
 * These are the only places a token's plaintext ever exists: createToken() returns it once,
 * in the response body, and nothing in this file or the storage layer can reproduce it
 * afterwards. A user who loses a token generates a new one and revokes the old.
 *
 * All three routes require a normal signed-in session. A personal access token cannot mint
 * or revoke tokens — a leaked 'sweep' credential must not be able to widen its own access.
 */

import { authenticate } from '@/lib/api-utils';
import { getDb } from '@/lib/mongodb';
import {
  createToken,
  listTokens,
  revokeToken,
  SCOPE_SWEEP,
  ALLOWED_SCOPES,
} from '@/lib/api-tokens';

function ok(data, status = 200) {
  return Response.json(data, { status });
}

function err(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function handleListTokens(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const tokens = await listTokens(db, user.id);
  return ok({ tokens, available_scopes: ALLOWED_SCOPES });
}

export async function handleCreateToken(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const db = await getDb();
  try {
    const created = await createToken(db, user.id, {
      name: body?.name,
      scopes: body?.scopes || [SCOPE_SWEEP],
    });

    return ok({
      // createToken() already spreads the public shape; `token` is the only secret and it
      // is present exactly once, in this response.
      note: 'Copy this now — it cannot be shown again.',
      ...created,
    }, 201);
  } catch (error) {
    return err(error?.message || 'Could not create token', 400);
  }
}

export async function handleRevokeToken(request, tokenId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const revoked = await revokeToken(db, user.id, tokenId);
  if (!revoked) return err('Token not found or already revoked', 404);
  return ok({ success: true, id: tokenId });
}
