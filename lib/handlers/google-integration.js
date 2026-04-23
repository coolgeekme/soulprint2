/**
 * Google OAuth & API handlers (Gmail, Calendar, Drive)
 * Extracted from the main catch-all route.js for maintainability.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate, getValidGoogleToken, getAllGoogleConnections } from '@/lib/api-utils';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { googleApiCall } from '@/lib/handlers/google-context';

// ============================================================
// GOOGLE OAUTH & APIS (Gmail, Calendar, Drive)
// ============================================================
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

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

// Generate Google OAuth URL
function getGoogleAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent select_account',
    state: state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange code for tokens
async function exchangeGoogleCode(code, redirectUri) {
  console.log('Token exchange - redirect_uri:', redirectUri);
  console.log('Token exchange - client_id:', GOOGLE_CLIENT_ID?.substring(0, 20) + '...');
  console.log('Token exchange - client_secret exists:', !!GOOGLE_CLIENT_SECRET);
  
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
  
  const data = await response.json();
  console.log('Token exchange response status:', response.status);
  if (data.error) {
    console.error('Token exchange failed:', JSON.stringify(data));
  }
  return data;
}

// Refresh access token
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

// Get valid token for a specific connection
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
// AUTH HANDLERS
// ============================================================

// Handler: Initiate Google OAuth
async function handleGoogleAuthStart(request) {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('Google Auth Start - Missing credentials:', {
        hasClientId: !!GOOGLE_CLIENT_ID,
        hasClientSecret: !!GOOGLE_CLIENT_SECRET
      });
      return NextResponse.json({ 
        error: 'Google OAuth not configured. Please check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' 
      }, { status: 500 });
    }
    
    console.log('Google Auth Start - Authenticating user...');
    const user = await authenticate(request);
    if (!user) {
      console.error('Google Auth Start - Authentication failed: No user returned');
      const token = getTokenFromRequest(request);
      console.error('Google Auth Start - Token present:', !!token);
      if (token) {
        const decoded = verifyToken(token);
        console.error('Google Auth Start - Token decoded:', !!decoded);
      }
      return NextResponse.json({ error: 'Unauthorized - Please log in again' }, { status: 401 });
    }
    
    console.log('Google Auth Start - User authenticated:', user.id);
    
    // Use request-based origin detection for cross-environment compatibility
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    console.log('Google Auth - Using base URL:', baseUrl);
    
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    console.log('Google Auth - Final redirect URI:', redirectUri);
    
    const state = Buffer.from(JSON.stringify({ 
      userId: user.id, 
      timestamp: Date.now() 
    })).toString('base64');
    
    const authUrl = getGoogleAuthUrl(redirectUri, state);
    console.log('Google Auth - Full auth URL generated');
    
    return NextResponse.json({ authUrl });
  } catch (err) {
    console.error('Google auth start error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Google OAuth Callback
async function handleGoogleAuthCallback(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
    console.log('Google Callback - Received params:', {
      hasCode: !!code,
      hasState: !!state,
      error: error || 'none',
      errorDescription: errorDescription || 'none'
    });
    
    // Use request-based origin detection for cross-environment compatibility
    const baseUrl = `${url.protocol}//${url.host}`;
    
    console.log('Google Callback - Using base URL:', baseUrl);
    
    if (error) {
      console.error('Google OAuth Error:', error, errorDescription);
      const errorMsg = errorDescription ? `${error}: ${errorDescription}` : error;
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent(errorMsg)}`);
    }
    
    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=missing_params`);
    }
    
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(`${baseUrl}/integrations?error=invalid_state`);
    }
    
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=state_expired`);
    }
    
    const userId = stateData.userId;
    
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    console.log('Google Callback - Exchanging code for tokens...');
    console.log('Google Callback - Using redirect_uri:', redirectUri);
    console.log('Google Callback - Client ID present:', !!GOOGLE_CLIENT_ID);
    console.log('Google Callback - Client Secret present:', !!GOOGLE_CLIENT_SECRET);
    
    const tokens = await exchangeGoogleCode(code, redirectUri);
    
    if (tokens.error) {
      console.error('Token exchange error - Full response:', JSON.stringify(tokens));
      const errorDetail = tokens.error_description || tokens.error || 'Unknown token error';
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent('Token exchange failed: ' + errorDetail)}`);
    }
    
    console.log('Google Callback - Token exchange successful, getting user info...');
    
    let userInfo;
    try {
      userInfo = await googleApiCall(tokens.access_token, '/oauth2/v2/userinfo');
      console.log('Google Callback - Got user info:', userInfo.email);
    } catch (userInfoErr) {
      console.error('Google Callback - Failed to get user info:', userInfoErr);
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent('Failed to get Google user info: ' + userInfoErr.message)}`);
    }
    
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      console.error('Google Callback - Database connection failed:', dbErr);
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent('Database connection failed')}`);
    }
    
    const connectionId = `${userId}_${userInfo.id}`;
    
    let calendars = [];
    try {
      const calendarList = await googleApiCall(tokens.access_token, '/calendar/v3/users/me/calendarList');
      calendars = (calendarList.items || []).map(cal => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary || false,
        backgroundColor: cal.backgroundColor,
        selected: cal.primary || false
      }));
    } catch (e) {
      console.error('Failed to fetch calendars:', e);
    }
    
    try {
      await db.collection('google_connections').updateOne(
        { connection_id: connectionId },
        {
          $set: {
            connection_id: connectionId,
            user_id: userId,
            google_id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            expires_at: new Date(Date.now() + tokens.expires_in * 1000),
            scopes: GOOGLE_SCOPES.split(' '),
            calendars: calendars,
            is_default: false,
            connected_at: new Date(),
            updated_at: new Date()
          }
        },
        { upsert: true }
      );
    } catch (dbWriteErr) {
      console.error('Google Callback - Failed to save connection:', dbWriteErr);
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent('Failed to save Google connection: ' + dbWriteErr.message)}`);
    }
    
    try {
      const accountCount = await db.collection('google_connections').countDocuments({ user_id: userId });
      if (accountCount === 1) {
        await db.collection('google_connections').updateOne(
          { connection_id: connectionId },
          { $set: { is_default: true } }
        );
        
        await db.collection('users').updateOne(
          { id: userId },
          { $set: { google_just_connected: true, google_connected_at: new Date() } }
        );
      }
      
      return NextResponse.redirect(`${baseUrl}/integrations?google=success&first=${accountCount === 1}`);
    } catch (dbUpdateErr) {
      console.error('Google Callback - Failed to update defaults:', dbUpdateErr);
      return NextResponse.redirect(`${baseUrl}/integrations?google=success&first=false`);
    }
  } catch (err) {
    console.error('Google callback error at final catch:', err);
    const errorBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://soulprintengine.ai';
    return NextResponse.redirect(`${errorBaseUrl}/integrations?error=${encodeURIComponent('Callback error: ' + err.message)}`);
  }
}

// Handler: Get Google connection status
async function handleGoogleStatus(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const db = await getDb();
    const connections = await db.collection('google_connections').find({ user_id: user.id }).toArray();
    
    if (!connections || connections.length === 0) {
      return NextResponse.json({ connected: false, accounts: [] });
    }
    
    const accounts = connections.map(conn => ({
      connectionId: conn.connection_id,
      googleId: conn.google_id,
      email: conn.email,
      name: conn.name,
      picture: conn.picture,
      connectedAt: conn.connected_at,
      isDefault: conn.is_default || false,
      calendars: conn.calendars || [],
      services: {
        gmail: conn.scopes?.some(s => s.includes('gmail')) || false,
        calendar: conn.scopes?.some(s => s.includes('calendar')) || false,
        drive: conn.scopes?.some(s => s.includes('drive')) || false
      }
    }));
    
    return NextResponse.json({
      connected: true,
      accounts,
      email: accounts.find(a => a.isDefault)?.email || accounts[0]?.email,
      name: accounts.find(a => a.isDefault)?.name || accounts[0]?.name,
      picture: accounts.find(a => a.isDefault)?.picture || accounts[0]?.picture
    });
  } catch (err) {
    console.error('Google status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Disconnect Google
async function handleGoogleDisconnect(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { connectionId } = await request.json().catch(() => ({}));
    const db = await getDb();
    
    if (connectionId) {
      const connection = await db.collection('google_connections').findOne({ 
        connection_id: connectionId, 
        user_id: user.id 
      });
      
      if (connection?.access_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${connection.access_token}`, {
          method: 'POST'
        }).catch(() => {});
      }
      
      await db.collection('google_connections').deleteOne({ connection_id: connectionId });
      
      if (connection?.is_default) {
        const remaining = await db.collection('google_connections').findOne({ user_id: user.id });
        if (remaining) {
          await db.collection('google_connections').updateOne(
            { connection_id: remaining.connection_id },
            { $set: { is_default: true } }
          );
        }
      }
    } else {
      const connections = await db.collection('google_connections').find({ user_id: user.id }).toArray();
      for (const conn of connections) {
        if (conn.access_token) {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${conn.access_token}`, {
            method: 'POST'
          }).catch(() => {});
        }
      }
      await db.collection('google_connections').deleteMany({ user_id: user.id });
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Google disconnect error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Set default Google account
async function handleGoogleSetDefault(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { connectionId } = await request.json();
    if (!connectionId) return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    
    const db = await getDb();
    
    await db.collection('google_connections').updateMany(
      { user_id: user.id },
      { $set: { is_default: false } }
    );
    
    await db.collection('google_connections').updateOne(
      { connection_id: connectionId, user_id: user.id },
      { $set: { is_default: true } }
    );
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Set default error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Update calendar selection
async function handleGoogleUpdateCalendars(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { connectionId, calendars } = await request.json();
    if (!connectionId || !calendars) {
      return NextResponse.json({ error: 'connectionId and calendars required' }, { status: 400 });
    }
    
    const db = await getDb();
    
    const connection = await db.collection('google_connections').findOne({
      connection_id: connectionId,
      user_id: user.id
    });
    
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }
    
    const updatedCalendars = connection.calendars.map(cal => ({
      ...cal,
      selected: calendars.find(c => c.id === cal.id)?.selected ?? cal.selected
    }));
    
    await db.collection('google_connections').updateOne(
      { connection_id: connectionId },
      { $set: { calendars: updatedCalendars, updated_at: new Date() } }
    );
    
    return NextResponse.json({ success: true, calendars: updatedCalendars });
  } catch (err) {
    console.error('Update calendars error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Refresh calendars list
async function handleGoogleRefreshCalendars(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { connectionId } = await request.json();
    if (!connectionId) return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    
    const db = await getDb();
    const connection = await db.collection('google_connections').findOne({
      connection_id: connectionId,
      user_id: user.id
    });
    
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }
    
    const accessToken = await getValidGoogleTokenForConnection(connection);
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to get valid token' }, { status: 401 });
    }
    
    const calendarList = await googleApiCall(accessToken, '/calendar/v3/users/me/calendarList');
    
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
    
    return NextResponse.json({ success: true, calendars });
  } catch (err) {
    console.error('Refresh calendars error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// GMAIL API HANDLERS
// ============================================================

async function handleGmailList(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const query = url.searchParams.get('q') || '';
    const maxResults = url.searchParams.get('maxResults') || '20';
    const pageToken = url.searchParams.get('pageToken') || '';
    
    const params = new URLSearchParams({ maxResults });
    if (query) params.append('q', query);
    if (pageToken) params.append('pageToken', pageToken);
    
    const data = await googleApiCall(accessToken, `/gmail/v1/users/me/messages?${params}`);
    
    if (data.messages) {
      const detailed = await Promise.all(
        data.messages.slice(0, 10).map(async (msg) => {
          const detail = await googleApiCall(accessToken, `/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
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
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('Gmail list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleGmailGet(request, messageId) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const data = await googleApiCall(accessToken, `/gmail/v1/users/me/messages/${messageId}?format=full`);
    
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
    
    return NextResponse.json({
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { to, subject, body, threadId, account } = await request.json();
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
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
    
    const data = await googleApiCall(accessToken, '/gmail/v1/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    return NextResponse.json({ success: true, messageId: data.id, threadId: data.threadId });
  } catch (err) {
    console.error('Gmail send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// GOOGLE CALENDAR API HANDLERS
// ============================================================

async function handleCalendarList(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const timeMin = url.searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = url.searchParams.get('timeMax') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = url.searchParams.get('maxResults') || '50';
    const calendarId = url.searchParams.get('calendarId');
    const accountName = url.searchParams.get('account');
    const allAccounts = url.searchParams.get('all') === 'true';
    
    const db = await getDb();
    
    let accountsToFetch = [];
    
    if (allAccounts) {
      accountsToFetch = await getAllGoogleConnections(user.id);
      console.log('[Calendar List] Fetching from ALL accounts:', accountsToFetch.map(a => a.email));
    } else {
      const tokenResult = await getValidGoogleToken(user.id, accountName);
      if (!tokenResult?.token) {
        return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
      }
      accountsToFetch = [{ ...tokenResult.connection, access_token: tokenResult.token }];
      console.log('[Calendar List] Fetching from account:', tokenResult.connection?.email);
    }
    
    if (accountsToFetch.length === 0) {
      return NextResponse.json({ error: 'No Google accounts connected' }, { status: 400 });
    }
    
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: Math.ceil(parseInt(maxResults) / Math.max(accountsToFetch.length, 1)).toString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });
    
    const allEvents = [];
    
    for (const account of accountsToFetch) {
      let calendarsToFetch = ['primary'];
      
      if (calendarId) {
        calendarsToFetch = [calendarId];
      } else if (account.calendars?.length > 0) {
        const selectedCalendars = account.calendars.filter(cal => cal.selected);
        if (selectedCalendars.length > 0) {
          calendarsToFetch = selectedCalendars.map(cal => cal.id);
        }
      }
      
      console.log(`[Calendar List] Account ${account.email}: fetching from calendars:`, calendarsToFetch);
      
      for (const calId of calendarsToFetch) {
        try {
          const encodedCalId = encodeURIComponent(calId);
          const data = await googleApiCall(account.access_token, `/calendar/v3/calendars/${encodedCalId}/events?${params}`);
          
          const calInfo = account.calendars?.find(c => c.id === calId);
          
          const events = (data.items || []).map(event => ({
            id: event.id,
            calendarId: calId,
            calendarName: calInfo?.name || (calId === 'primary' ? 'Primary' : calId),
            calendarColor: calInfo?.color || event.colorId || '#4285f4',
            accountEmail: account.email,
            accountName: account.name,
            summary: event.summary || '(No title)',
            description: event.description || '',
            location: event.location || '',
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            htmlLink: event.htmlLink,
            attendees: event.attendees?.map(a => ({ email: a.email, name: a.displayName })) || []
          }));
          
          allEvents.push(...events);
        } catch (calErr) {
          console.error(`[Calendar List] Error fetching calendar ${calId} from ${account.email}:`, calErr.message);
        }
      }
    }
    
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    const limitedEvents = allEvents.slice(0, parseInt(maxResults));
    
    return NextResponse.json({
      events: limitedEvents,
      accountsQueried: accountsToFetch.map(a => a.email),
      totalEvents: allEvents.length
    });
  } catch (err) {
    console.error('Calendar list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleCalendarCreate(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { summary, description, location, start, end, attendees, timeZone, calendarId, account } = await request.json();
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    }
    
    const accessToken = tokenResult.token;
    const connection = tokenResult.connection;
    
    if (!summary || !start || !end) {
      return NextResponse.json({ error: 'Missing required fields: summary, start, end' }, { status: 400 });
    }
    
    const db = await getDb();
    const userLocation = await db.collection('user_locations').findOne({ user_id: user.id });
    const eventTimezone = timeZone || userLocation?.timezone || 'UTC';
    
    const targetCalendar = calendarId || 'primary';
    const encodedCalendarId = encodeURIComponent(targetCalendar);
    
    const event = {
      summary,
      description: description || '',
      location: location || '',
      start: { dateTime: start, timeZone: eventTimezone },
      end: { dateTime: end, timeZone: eventTimezone },
      attendees: attendees?.map(email => ({ email })) || []
    };
    
    console.log('[Calendar Create] Creating event in calendar:', targetCalendar, 'on account:', connection?.email);
    
    const data = await googleApiCall(accessToken, `/calendar/v3/calendars/${encodedCalendarId}/events`, {
      method: 'POST',
      body: JSON.stringify(event)
    });
    
    return NextResponse.json({
      success: true,
      event: {
        id: data.id,
        summary: data.summary,
        htmlLink: data.htmlLink,
        start: data.start?.dateTime || data.start?.date,
        end: data.end?.dateTime || data.end?.date,
        timeZone: eventTimezone
      }
    });
  } catch (err) {
    console.error('Calendar create error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleCalendarUpdate(request, eventId) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const updates = await request.json();
    
    const tokenResult = await getValidGoogleToken(user.id, updates.account);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const calendarId = updates.calendarId || 'primary';
    const encodedCalendarId = encodeURIComponent(calendarId);
    
    const db = await getDb();
    const userLocation = await db.collection('user_locations').findOne({ user_id: user.id });
    const eventTimezone = updates.timeZone || userLocation?.timezone || 'UTC';
    
    const event = {};
    if (updates.summary) event.summary = updates.summary;
    if (updates.description !== undefined) event.description = updates.description;
    if (updates.location !== undefined) event.location = updates.location;
    if (updates.start) event.start = { dateTime: updates.start, timeZone: eventTimezone };
    if (updates.end) event.end = { dateTime: updates.end, timeZone: eventTimezone };
    
    const data = await googleApiCall(accessToken, `/calendar/v3/calendars/${encodedCalendarId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(event)
    });
    
    return NextResponse.json({ success: true, event: data });
  } catch (err) {
    console.error('Calendar update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleCalendarDelete(request, eventId) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const calendarId = url.searchParams.get('calendarId') || 'primary';
    const accountName = url.searchParams.get('account');
    
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const encodedCalendarId = encodeURIComponent(calendarId);
    
    await googleApiCall(accessToken, `/calendar/v3/calendars/${encodedCalendarId}/events/${eventId}`, {
      method: 'DELETE'
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Calendar delete error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// GOOGLE DRIVE API HANDLERS
// ============================================================

async function handleDriveList(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const query = url.searchParams.get('q') || '';
    const pageSize = url.searchParams.get('pageSize') || '20';
    const pageToken = url.searchParams.get('pageToken') || '';
    
    const params = new URLSearchParams({
      pageSize,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink)'
    });
    if (query) params.append('q', query);
    if (pageToken) params.append('pageToken', pageToken);
    
    const data = await googleApiCall(accessToken, `/drive/v3/files?${params}`);
    
    return NextResponse.json({
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const metadata = await googleApiCall(accessToken, `/drive/v3/files/${fileId}?fields=id,name,mimeType,size,webViewLink`);
    
    let content = null;
    if (metadata.mimeType === 'application/vnd.google-apps.document') {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      content = await response.text();
    } else if (metadata.mimeType === 'application/vnd.google-apps.spreadsheet') {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      content = await response.text();
    }
    
    return NextResponse.json({
      ...metadata,
      content: content?.slice(0, 50000)
    });
  } catch (err) {
    console.error('Drive get error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleDriveSearch(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { query, account } = await request.json();
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });
    
    const q = `fullText contains '${query.replace(/'/g, "\\'")}'`;
    const params = new URLSearchParams({
      q,
      pageSize: '20',
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime)'
    });
    
    const data = await googleApiCall(accessToken, `/drive/v3/files?${params}`);
    
    return NextResponse.json({ files: data.files || [] });
  } catch (err) {
    console.error('Drive search error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Test Google connections (debug endpoint)
async function handleTestGoogleConnections(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const db = await getDb();
    const connections = await db.collection('google_connections').find({ user_id: user.id }).toArray();
    
    return NextResponse.json({
      count: connections.length,
      connections: connections.map(c => ({
        connectionId: c.connection_id,
        email: c.email,
        name: c.name,
        isDefault: c.is_default,
        hasRefreshToken: !!c.refresh_token,
        expiresAt: c.expires_at,
      }))
    });
  } catch (err) {
    console.error('Test Google connections error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export {
  handleGoogleAuthStart,
  handleGoogleAuthCallback,
  handleGoogleStatus,
  handleGoogleDisconnect,
  handleGoogleSetDefault,
  handleGoogleUpdateCalendars,
  handleGoogleRefreshCalendars,
  handleGmailList,
  handleGmailGet,
  handleGmailSend,
  handleCalendarList,
  handleCalendarCreate,
  handleCalendarUpdate,
  handleCalendarDelete,
  handleDriveList,
  handleDriveGet,
  handleDriveSearch,
  handleTestGoogleConnections,
  getValidGoogleTokenForConnection,
  GOOGLE_SCOPES,
};
