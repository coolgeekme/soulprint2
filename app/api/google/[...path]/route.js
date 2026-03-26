import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// ============================================================
// GOOGLE OAUTH CONFIGURATION
// ============================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
  'openid',
  'email',
  'profile'
].join(' ');

// ============================================================
// OAUTH HELPER FUNCTIONS
// ============================================================

function getGoogleAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGoogleCode(code, redirectUri) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  });
  return response.json();
}

async function refreshGoogleToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  return response.json();
}

export async function getValidGoogleToken(userId, accountIdentifier = null) {
  const db = await getDb();
  
  let connection;
  
  if (accountIdentifier) {
    const searchTerm = accountIdentifier.toLowerCase();
    connection = await db.collection('google_connections').findOne({ 
      user_id: userId,
      $or: [
        { email: { $regex: searchTerm, $options: 'i' } },
        { name: { $regex: searchTerm, $options: 'i' } }
      ]
    });
    
    if (!connection) {
      connection = await db.collection('google_connections').findOne({ 
        user_id: userId,
        connection_id: accountIdentifier
      });
    }
  }
  
  if (!connection) {
    connection = await db.collection('google_connections').findOne({ 
      user_id: userId, 
      is_default: true 
    });
  }
  
  if (!connection) {
    connection = await db.collection('google_connections').findOne({ user_id: userId });
  }
  
  if (!connection) return null;
  
  const isExpired = new Date(connection.expires_at) < new Date(Date.now() + 5 * 60 * 1000);
  
  if (isExpired && connection.refresh_token) {
    try {
      const tokens = await refreshGoogleToken(connection.refresh_token);
      if (tokens.access_token) {
        await db.collection('google_connections').updateOne(
          { connection_id: connection.connection_id },
          { 
            $set: { 
              access_token: tokens.access_token,
              expires_at: new Date(Date.now() + tokens.expires_in * 1000),
              updated_at: new Date()
            }
          }
        );
        return { token: tokens.access_token, connection };
      }
    } catch (err) {
      console.error('[Google Token] Refresh failed:', err.message);
      return null;
    }
  }
  
  return { token: connection.access_token, connection };
}

export async function getAllGoogleConnections(userId) {
  const db = await getDb();
  const connections = await db.collection('google_connections').find({ user_id: userId }).toArray();
  
  const validConnections = [];
  for (const conn of connections) {
    const result = await getValidGoogleToken(userId, conn.connection_id);
    if (result?.token) {
      validConnections.push({ ...conn, access_token: result.token });
    }
  }
  
  return validConnections;
}

async function googleApiCall(accessToken, endpoint, options = {}) {
  const response = await fetch(`https://www.googleapis.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  const data = await response.json();
  
  if (data.error) {
    const errorInfo = typeof data.error === 'object' ? data.error : { message: data.error };
    const errorMsg = errorInfo.message || errorInfo.status || JSON.stringify(data.error);
    throw new Error(`Google API (${endpoint}): ${errorMsg}`);
  }
  
  if (!response.ok) {
    throw new Error(`Google API HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  
  return data;
}

// Get valid token for a specific connection (handles refresh)
async function getValidGoogleTokenForConnection(connection) {
  const isExpired = new Date(connection.expires_at) < new Date(Date.now() + 5 * 60 * 1000);
  
  if (isExpired && connection.refresh_token) {
    try {
      const tokens = await refreshGoogleToken(connection.refresh_token);
      if (tokens.access_token) {
        const db = await getDb();
        await db.collection('google_connections').updateOne(
          { connection_id: connection.connection_id },
          { 
            $set: { 
              access_token: tokens.access_token,
              expires_at: new Date(Date.now() + tokens.expires_in * 1000),
              updated_at: new Date()
            }
          }
        );
        return tokens.access_token;
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      return null;
    }
  }
  
  return connection.access_token;
}


// ============================================================
// OAUTH HANDLERS
// ============================================================

async function handleGoogleAuthStart(request) {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return err('Google OAuth not configured', 500);
    }
    
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    // Use the production domain for OAuth redirect (must match Google Cloud Console registration)
    const origin = 'https://soulprintengine.ai';
    const redirectUri = `${origin}/api/google/auth/callback`;
    const state = Buffer.from(JSON.stringify({ userId: user.id, timestamp: Date.now() })).toString('base64');
    const authUrl = getGoogleAuthUrl(redirectUri, state);
    
    return ok({ authUrl });
  } catch (err) {
    console.error('Google auth start error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleGoogleAuthCallback(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    // Use the production domain for OAuth redirect (must match Google Cloud Console registration)
    const origin = 'https://soulprintengine.ai';
    
    if (error) {
      return NextResponse.redirect(new URL('/integrations?google=error&message=' + encodeURIComponent(error), origin));
    }
    
    if (!code || !state) {
      return NextResponse.redirect(new URL('/integrations?google=error&message=missing_params', origin));
    }
    
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(new URL('/integrations?google=error&message=invalid_state', origin));
    }
    
    // Use the same origin for the redirect URI (must match what was sent to Google in handleGoogleAuthStart)
    const redirectUri = `${origin}/api/google/auth/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);
    
    if (tokens.error) {
      return NextResponse.redirect(new URL('/integrations?google=error&message=' + encodeURIComponent(tokens.error), origin));
    }
    
    // Get user info
    const userInfo = await googleApiCall(tokens.access_token, '/oauth2/v2/userinfo');
    
    const db = await getDb();
    const connectionId = uuidv4();
    
    // Check for existing connection
    const existing = await db.collection('google_connections').findOne({
      user_id: stateData.userId,
      email: userInfo.email
    });
    
    const isDefault = !existing && (await db.collection('google_connections').countDocuments({ user_id: stateData.userId })) === 0;
    
    if (existing) {
      await db.collection('google_connections').updateOne(
        { connection_id: existing.connection_id },
        {
          $set: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || existing.refresh_token,
            expires_at: new Date(Date.now() + tokens.expires_in * 1000),
            name: userInfo.name,
            picture: userInfo.picture,
            updated_at: new Date()
          }
        }
      );
    } else {
      await db.collection('google_connections').insertOne({
        connection_id: connectionId,
        user_id: stateData.userId,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: GOOGLE_SCOPES.split(' '),
        is_default: isDefault,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    return NextResponse.redirect(new URL('/integrations?google=success', origin));
  } catch (err) {
    console.error('Google callback error:', err);
    const fallbackOrigin = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    return NextResponse.redirect(new URL('/integrations?google=error&message=' + encodeURIComponent(err.message), fallbackOrigin));
  }
}

async function handleGoogleStatus(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const db = await getDb();
    const connections = await db.collection('google_connections').find({ user_id: user.id }).toArray();
    
    if (connections.length === 0) {
      return ok({ connected: false, accounts: [] });
    }
    
    const accounts = connections.map(c => ({
      connectionId: c.connection_id,
      email: c.email,
      name: c.name,
      picture: c.picture,
      isDefault: c.is_default || false,
      connected_at: c.created_at,
      scopes: c.scopes || [],
      calendars: c.calendars || [],
      services: {
        gmail: (c.scopes || []).some(s => s.includes('mail.google.com')),
        calendar: (c.scopes || []).some(s => s.includes('calendar')),
        drive: (c.scopes || []).some(s => s.includes('drive'))
      }
    }));
    
    return ok({ connected: true, accounts });
  } catch (err) {
    console.error('Google status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleGoogleDisconnect(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const body = await request.json();
    const { connectionId } = body;
    
    const db = await getDb();
    
    if (connectionId) {
      const connection = await db.collection('google_connections').findOne({
        connection_id: connectionId,
        user_id: user.id
      });
      
      if (!connection) return err('Connection not found', 404);
      
      await db.collection('google_connections').deleteOne({ connection_id: connectionId });
      
      if (connection.is_default) {
        const remaining = await db.collection('google_connections').findOne({ user_id: user.id });
        if (remaining) {
          await db.collection('google_connections').updateOne(
            { connection_id: remaining.connection_id },
            { $set: { is_default: true } }
          );
        }
      }
    } else {
      await db.collection('google_connections').deleteMany({ user_id: user.id });
    }
    
    return ok({ success: true });
  } catch (err) {
    console.error('Google disconnect error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleGoogleSetDefault(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const body = await request.json();
    const { connectionId } = body;
    
    if (!connectionId) return err('connectionId required');
    
    const db = await getDb();
    
    await db.collection('google_connections').updateMany(
      { user_id: user.id },
      { $set: { is_default: false } }
    );
    
    await db.collection('google_connections').updateOne(
      { connection_id: connectionId, user_id: user.id },
      { $set: { is_default: true } }
    );
    
    return ok({ success: true });
  } catch (err) {
    console.error('Google set default error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// GMAIL HANDLERS
// ============================================================

async function handleGmailList(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    const query = url.searchParams.get('q') || '';
    const maxResults = url.searchParams.get('maxResults') || '20';
    const pageToken = url.searchParams.get('pageToken') || '';
    
    const params = new URLSearchParams({ maxResults });
    if (query) params.append('q', query);
    if (pageToken) params.append('pageToken', pageToken);
    
    const data = await googleApiCall(tokenResult.token, `/gmail/v1/users/me/messages?${params}`);
    
    if (data.messages) {
      const detailed = await Promise.all(
        data.messages.slice(0, 10).map(async (msg) => {
          const detail = await googleApiCall(tokenResult.token, `/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
          const headers = detail.payload?.headers || [];
          return {
            id: msg.id,
            threadId: msg.threadId,
            subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
            from: headers.find(h => h.name === 'From')?.value || '',
            date: headers.find(h => h.name === 'Date')?.value || '',
            snippet: detail.snippet || ''
          };
        })
      );
      data.messages = detailed;
    }
    
    return ok(data);
  } catch (err) {
    console.error('Gmail list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleGmailGet(request, messageId) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    const data = await googleApiCall(tokenResult.token, `/gmail/v1/users/me/messages/${messageId}?format=full`);
    
    let body = '';
    if (data.payload) {
      const getBody = (payload) => {
        if (payload.body?.data) {
          return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
          }
          for (const part of payload.parts) {
            const nested = getBody(part);
            if (nested) return nested;
          }
        }
        return '';
      };
      body = getBody(data.payload);
    }
    
    const headers = data.payload?.headers || [];
    
    return ok({
      id: data.id,
      threadId: data.threadId,
      subject: headers.find(h => h.name === 'Subject')?.value || '',
      from: headers.find(h => h.name === 'From')?.value || '',
      to: headers.find(h => h.name === 'To')?.value || '',
      date: headers.find(h => h.name === 'Date')?.value || '',
      body: body,
      snippet: data.snippet,
      labelIds: data.labelIds
    });
  } catch (err) {
    console.error('Gmail get error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleGmailSend(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const { to, subject, body, threadId, account } = await request.json();
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    if (!to || !subject || !body) {
      return err('Missing required fields: to, subject, body');
    }
    
    const db = await getDb();
    const connection = await db.collection('google_connections').findOne({ user_id: user.id });
    const from = connection?.email || '';
    
    const email = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\r\n');
    
    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const payload = { raw: encodedEmail };
    if (threadId) payload.threadId = threadId;
    
    const data = await googleApiCall(tokenResult.token, '/gmail/v1/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    return ok({ success: true, messageId: data.id, threadId: data.threadId });
  } catch (err) {
    console.error('Gmail send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// CALENDAR HANDLERS
// ============================================================

async function handleCalendarList(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const url = new URL(request.url);
    const timeMin = url.searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = url.searchParams.get('timeMax') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = url.searchParams.get('maxResults') || '50';
    const calendarId = url.searchParams.get('calendarId');
    const accountName = url.searchParams.get('account');
    
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    const calendarsToFetch = calendarId ? [calendarId] : ['primary'];
    const allEvents = [];
    
    for (const calId of calendarsToFetch) {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        maxResults,
        singleEvents: 'true',
        orderBy: 'startTime'
      });
      
      try {
        const data = await googleApiCall(tokenResult.token, `/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`);
        if (data.items) {
          allEvents.push(...data.items.map(e => ({
            ...e,
            calendarId: calId,
            accountEmail: tokenResult.connection?.email
          })));
        }
      } catch (e) {
        console.error(`Calendar ${calId} error:`, e.message);
      }
    }
    
    allEvents.sort((a, b) => {
      const aTime = a.start?.dateTime || a.start?.date;
      const bTime = b.start?.dateTime || b.start?.date;
      return new Date(aTime) - new Date(bTime);
    });
    
    return ok({ events: allEvents });
  } catch (err) {
    console.error('Calendar list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleCalendarCreate(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const body = await request.json();
    const { summary, description, start, end, location, attendees, calendarId = 'primary', account } = body;
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    if (!summary || !start || !end) {
      return err('Missing required fields: summary, start, end');
    }
    
    const event = {
      summary,
      description: description || '',
      location: location || '',
      start: typeof start === 'string' ? { dateTime: start, timeZone: 'UTC' } : start,
      end: typeof end === 'string' ? { dateTime: end, timeZone: 'UTC' } : end,
    };
    
    if (attendees?.length) {
      event.attendees = attendees.map(email => ({ email }));
    }
    
    const data = await googleApiCall(tokenResult.token, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      body: JSON.stringify(event)
    });
    
    return ok({ success: true, event: data });
  } catch (err) {
    console.error('Calendar create error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleCalendarUpdate(request, eventId) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const body = await request.json();
    const { summary, description, start, end, location, attendees, calendarId = 'primary', account } = body;
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    const updates = {};
    if (summary) updates.summary = summary;
    if (description !== undefined) updates.description = description;
    if (location !== undefined) updates.location = location;
    if (start) updates.start = typeof start === 'string' ? { dateTime: start, timeZone: 'UTC' } : start;
    if (end) updates.end = typeof end === 'string' ? { dateTime: end, timeZone: 'UTC' } : end;
    if (attendees) updates.attendees = attendees.map(email => ({ email }));
    
    const data = await googleApiCall(tokenResult.token, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    
    return ok({ success: true, event: data });
  } catch (err) {
    console.error('Calendar update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleCalendarDelete(request, eventId) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const url = new URL(request.url);
    const calendarId = url.searchParams.get('calendarId') || 'primary';
    const account = url.searchParams.get('account');
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenResult.token}` }
    });
    
    return ok({ success: true });
  } catch (err) {
    console.error('Calendar delete error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// CALENDAR MANAGEMENT HANDLERS
// ============================================================

async function handleGoogleUpdateCalendars(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const { connectionId, calendars } = await request.json();
    if (!connectionId || !calendars) {
      return err('connectionId and calendars required', 400);
    }
    
    const db = await getDb();
    
    const connection = await db.collection('google_connections').findOne({
      connection_id: connectionId,
      user_id: user.id
    });
    
    if (!connection) {
      return err('Connection not found', 404);
    }
    
    const updatedCalendars = (connection.calendars || []).map(cal => ({
      ...cal,
      selected: calendars.find(c => c.id === cal.id)?.selected ?? cal.selected
    }));
    
    await db.collection('google_connections').updateOne(
      { connection_id: connectionId },
      { $set: { calendars: updatedCalendars, updated_at: new Date() } }
    );
    
    return ok({ success: true, calendars: updatedCalendars });
  } catch (error) {
    console.error('Update calendars error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGoogleRefreshCalendars(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const { connectionId } = await request.json();
    if (!connectionId) return err('connectionId required', 400);
    
    const db = await getDb();
    const connection = await db.collection('google_connections').findOne({
      connection_id: connectionId,
      user_id: user.id
    });
    
    if (!connection) {
      return err('Connection not found', 404);
    }
    
    const accessToken = await getValidGoogleTokenForConnection(connection);
    if (!accessToken) {
      return err('Failed to get valid token', 401);
    }
    
    const calendarList = await googleApiCall(accessToken, '/calendar/v3/users/me/calendarList');
    
    // Preserve existing selection state
    const existingSelections = {};
    (connection.calendars || []).forEach(cal => {
      existingSelections[cal.id] = cal.selected;
    });
    
    const calendars = (calendarList.items || []).map(cal => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
      selected: existingSelections[cal.id] ?? cal.primary ?? false
    }));
    
    await db.collection('google_connections').updateOne(
      { connection_id: connectionId },
      { $set: { calendars, updated_at: new Date() } }
    );
    
    return ok({ success: true, calendars });
  } catch (error) {
    console.error('Refresh calendars error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



// ============================================================
// DRIVE HANDLERS
// ============================================================

async function handleDriveList(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    const query = url.searchParams.get('q') || '';
    const pageSize = url.searchParams.get('pageSize') || '20';
    const pageToken = url.searchParams.get('pageToken') || '';
    
    const params = new URLSearchParams({
      pageSize,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink)'
    });
    if (query) params.append('q', query);
    if (pageToken) params.append('pageToken', pageToken);
    
    const data = await googleApiCall(tokenResult.token, `/drive/v3/files?${params}`);
    
    return ok({
      files: (data.files || []).map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        iconLink: file.iconLink,
        thumbnailLink: file.thumbnailLink
      })),
      nextPageToken: data.nextPageToken
    });
  } catch (err) {
    console.error('Drive list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleDriveGet(request, fileId) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    const metadata = await googleApiCall(tokenResult.token, `/drive/v3/files/${fileId}?fields=id,name,mimeType,size,webViewLink`);
    
    let content = null;
    if (metadata.mimeType === 'application/vnd.google-apps.document') {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`, {
        headers: { 'Authorization': `Bearer ${tokenResult.token}` }
      });
      content = await response.text();
    } else if (metadata.mimeType === 'application/vnd.google-apps.spreadsheet') {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`, {
        headers: { 'Authorization': `Bearer ${tokenResult.token}` }
      });
      content = await response.text();
    }
    
    return ok({ ...metadata, content: content?.slice(0, 50000) });
  } catch (err) {
    console.error('Drive get error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleDriveSearch(request) {
  try {
    const user = await authenticate(request);
    if (!user) return err('Unauthorized', 401);
    
    const { query, account } = await request.json();
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) return err('Google not connected', 400);
    
    if (!query) return err('Query required');
    
    const q = `fullText contains '${query.replace(/'/g, "\\'")}'`;
    const params = new URLSearchParams({
      q,
      pageSize: '20',
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime)'
    });
    
    const data = await googleApiCall(tokenResult.token, `/drive/v3/files?${params}`);
    
    return ok({ files: data.files || [] });
  } catch (err) {
    console.error('Drive search error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // OAuth
    if (pathStr === 'auth/start') return handleGoogleAuthStart(request);
    if (pathStr === 'auth/callback') return handleGoogleAuthCallback(request);
    if (pathStr === 'status') return handleGoogleStatus(request);
    
    // Gmail
    if (pathStr === 'gmail/messages') return handleGmailList(request);
    if (pathStr.match(/^gmail\/messages\/[^\/]+$/)) {
      return handleGmailGet(request, pathArr[2]);
    }
    
    // Calendar
    if (pathStr === 'calendar/events') return handleCalendarList(request);
    
    // Drive
    if (pathStr === 'drive/files') return handleDriveList(request);
    if (pathStr.match(/^drive\/files\/[^\/]+$/)) {
      return handleDriveGet(request, pathArr[2]);
    }
    
    return err('Google endpoint not found', 404);
  } catch (error) {
    console.error('[Google API] GET Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // OAuth
    if (pathStr === 'disconnect') return handleGoogleDisconnect(request);
    if (pathStr === 'set-default') return handleGoogleSetDefault(request);
    
    // Calendar Management
    if (pathStr === 'update-calendars') return handleGoogleUpdateCalendars(request);
    if (pathStr === 'refresh-calendars') return handleGoogleRefreshCalendars(request);
    
    // Gmail
    if (pathStr === 'gmail/send') return handleGmailSend(request);
    
    // Calendar
    if (pathStr === 'calendar/events') return handleCalendarCreate(request);
    
    // Drive
    if (pathStr === 'drive/search') return handleDriveSearch(request);
    
    return err('Google endpoint not found', 404);
  } catch (error) {
    console.error('[Google API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function PUT(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr.match(/^calendar\/events\/[^\/]+$/)) {
      return handleCalendarUpdate(request, pathArr[2]);
    }
    
    return err('Google endpoint not found', 404);
  } catch (error) {
    console.error('[Google API] PUT Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr.match(/^calendar\/events\/[^\/]+$/)) {
      return handleCalendarDelete(request, pathArr[2]);
    }
    
    return err('Google endpoint not found', 404);
  } catch (error) {
    console.error('[Google API] DELETE Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
