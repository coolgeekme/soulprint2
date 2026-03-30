import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

// Auth helper (inline to avoid circular deps)
async function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'soulprint-secret-key-2024');
    const db = await getDb();
    const user = await db.collection('users').findOne({ id: decoded.userId });
    return user;
  } catch {
    return null;
  }
}

// POST /api/gemini/live-token — Provide credentials for Gemini Live API WebSocket
export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const model = body.model || 'gemini-2.5-flash-native-audio-latest';

    console.log('[Gemini Live] Providing credentials for user:', user.id, 'model:', model);

    // For Gemini Live WebSocket, the API key is passed in the URL directly.
    // Return the key to the client for WebSocket connection.
    return NextResponse.json({
      apiKey: apiKey,
      model,
      wsUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`,
    });
  } catch (err) {
    console.error('[Gemini Live] Token error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
