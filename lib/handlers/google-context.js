/**
 * Google Context for Chat + Google Action Functions for AI Tool Calling
 * Extracted from the main catch-all route.js for maintainability.
 */

import { getDb } from '@/lib/mongodb';
import { getValidGoogleToken, getAllGoogleConnections } from '@/lib/api-utils';

// Google OAuth credentials from environment
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Refresh an expired Google token
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

// Get valid token for a specific connection (auto-refresh)
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

function detectGoogleIntent(query) {
  const lowerQuery = query.toLowerCase();
  
  const intents = {
    gmail: false,
    calendar: false,
    drive: false,
    searchTerms: []
  };
  
  // Gmail keywords
  const gmailKeywords = ['email', 'emails', 'mail', 'inbox', 'message', 'messages', 'sent', 'unread', 'from', 'gmail'];
  if (gmailKeywords.some(kw => lowerQuery.includes(kw))) {
    intents.gmail = true;
  }
  
  // Calendar keywords
  const calendarKeywords = ['calendar', 'event', 'events', 'meeting', 'meetings', 'schedule', 'appointment', 'appointments', 'agenda', 'busy', 'free', 'available', 'tomorrow', 'next week', 'this week'];
  if (calendarKeywords.some(kw => lowerQuery.includes(kw))) {
    intents.calendar = true;
  }
  
  // Drive keywords
  const driveKeywords = ['file', 'files', 'document', 'documents', 'drive', 'folder', 'spreadsheet', 'presentation', 'doc', 'docs', 'sheet', 'slides'];
  if (driveKeywords.some(kw => lowerQuery.includes(kw))) {
    intents.drive = true;
  }
  
  // Extract potential search terms (names, subjects, etc.)
  // Look for quoted strings or proper nouns
  const quotedMatches = query.match(/"([^"]+)"/g) || [];
  intents.searchTerms = quotedMatches.map(m => m.replace(/"/g, ''));
  
  // Also extract capitalized words that might be names/companies
  const words = query.split(/\s+/);
  words.forEach(word => {
    if (word.length > 2 && /^[A-Z]/.test(word) && !['I', 'The', 'What', 'When', 'Where', 'How', 'Can', 'Could', 'Would', 'Should', 'Please', 'Find', 'Show', 'Get', 'Check', 'My', 'Any', 'From', 'About'].includes(word)) {
      intents.searchTerms.push(word);
    }
  });
  
  return intents;
}

// Fetch Google data based on detected intents (handles multiple accounts)
async function fetchGoogleContextForChat(userId, query) {
  const db = await getDb();
  const connections = await db.collection('google_connections').find({ user_id: userId }).toArray();
  
  if (!connections || connections.length === 0) {
    return null; // User hasn't connected Google
  }
  
  const intents = detectGoogleIntent(query);
  const lowerQuery = query.toLowerCase();
  
  // Detect if user mentioned a specific account
  let targetAccount = null;
  for (const conn of connections) {
    const emailName = conn.email?.split('@')[0]?.toLowerCase() || '';
    const accountName = conn.name?.toLowerCase() || '';
    if (lowerQuery.includes(emailName) || lowerQuery.includes(accountName)) {
      targetAccount = conn;
      console.log('[GoogleContext] Detected specific account:', conn.email);
      break;
    }
  }
  
  const context = {
    hasGoogleConnected: true,
    accounts: connections.map(c => ({
      email: c.email,
      name: c.name,
      isDefault: c.is_default || false,
      calendars: (c.calendars || []).filter(cal => cal.selected).map(cal => ({
        id: cal.id,
        name: cal.summary || cal.name,
        primary: cal.primary
      }))
    })),
    gmail: null,
    calendar: null,
    drive: null
  };
  
  try {
    // Fetch Gmail if relevant
    if (intents.gmail) {
      // Use specific account if mentioned, otherwise default
      const gmailAccount = targetAccount || connections.find(c => c.is_default) || connections[0];
      const tokenResult = await getValidGoogleToken(userId, gmailAccount.connection_id);
      
      if (tokenResult?.token) {
        const accessToken = tokenResult.token;
        const searchQuery = intents.searchTerms.length > 0 
          ? intents.searchTerms.join(' OR ') 
          : '';
        
        const params = new URLSearchParams({ maxResults: '10' });
        if (searchQuery) params.append('q', searchQuery);
        
        const gmailData = await googleApiCall(accessToken, `/gmail/v1/users/me/messages?${params}`);
        
        if (gmailData.messages && gmailData.messages.length > 0) {
          const detailed = await Promise.all(
            gmailData.messages.slice(0, 8).map(async (msg) => {
              try {
                const detail = await googleApiCall(accessToken, `/gmail/v1/users/me/messages/${msg.id}?format=full`);
                const headers = detail.payload?.headers || [];
                
                let body = '';
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
                  }
                  return '';
                };
                body = getBody(detail.payload);
                
                return {
                  account: gmailAccount.email,
                  subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
                  from: headers.find(h => h.name === 'From')?.value || '',
                  date: headers.find(h => h.name === 'Date')?.value || '',
                  snippet: detail.snippet || '',
                  body: body.slice(0, 1000)
                };
              } catch (e) {
                return null;
              }
            })
          );
          
          context.gmail = detailed.filter(Boolean);
        }
      }
    }
    
    // Fetch Calendar if relevant - from ALL accounts and ALL selected calendars
    if (intents.calendar) {
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        maxResults: '20',
        singleEvents: 'true',
        orderBy: 'startTime'
      });
      
      const allEvents = [];
      
      // Determine which accounts to fetch from
      const accountsToFetch = targetAccount ? [targetAccount] : connections;
      
      for (const conn of accountsToFetch) {
        const tokenResult = await getValidGoogleToken(userId, conn.connection_id);
        if (!tokenResult?.token) continue;
        
        const accessToken = tokenResult.token;
        
        // Get selected calendars for this account
        const calendarsToFetch = (conn.calendars || [])
          .filter(cal => cal.selected)
          .map(cal => cal.id);
        
        // If no calendars selected, use primary
        if (calendarsToFetch.length === 0) {
          calendarsToFetch.push('primary');
        }
        
        console.log(`[GoogleContext] Fetching calendars from ${conn.email}:`, calendarsToFetch);
        
        for (const calId of calendarsToFetch) {
          try {
            const encodedCalId = encodeURIComponent(calId);
            const calData = await googleApiCall(accessToken, `/calendar/v3/calendars/${encodedCalId}/events?${params}`);
            
            const calInfo = conn.calendars?.find(c => c.id === calId);
            
            if (calData.items && calData.items.length > 0) {
              const events = calData.items.map(event => ({
                account: conn.email,
                calendarName: calInfo?.summary || calInfo?.name || (calId === 'primary' ? 'Primary' : calId),
                summary: event.summary || '(No title)',
                description: event.description || '',
                location: event.location || '',
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                attendees: event.attendees?.map(a => a.email).slice(0, 5) || []
              }));
              allEvents.push(...events);
            }
          } catch (calErr) {
            console.error(`[GoogleContext] Error fetching calendar ${calId} from ${conn.email}:`, calErr.message);
          }
        }
      }
      
      // Sort by start time
      allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      context.calendar = allEvents.slice(0, 25); // Limit to 25 events
    }
    
    // Fetch Drive files if relevant
    if (intents.drive) {
      const driveAccount = targetAccount || connections.find(c => c.is_default) || connections[0];
      const tokenResult = await getValidGoogleToken(userId, driveAccount.connection_id);
      
      if (tokenResult?.token) {
        const accessToken = tokenResult.token;
        const searchQuery = intents.searchTerms.length > 0 
          ? `name contains '${intents.searchTerms[0]}'`
          : '';
        
        const params = new URLSearchParams({
          pageSize: '10',
          fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
          orderBy: 'modifiedTime desc'
        });
        if (searchQuery) params.append('q', searchQuery);
        
        const driveData = await googleApiCall(accessToken, `/drive/v3/files?${params}`);
        
        if (driveData.files && driveData.files.length > 0) {
          context.drive = driveData.files.map(file => ({
            account: driveAccount.email,
            name: file.name,
            type: file.mimeType,
            modified: file.modifiedTime,
            link: file.webViewLink
          }));
        }
      }
    }
    
    return context;
  } catch (err) {
    console.error('Error fetching Google context:', err);
    return { hasGoogleConnected: true, error: err.message };
  }
}

// Format Google context for inclusion in AI prompt
function formatGoogleContextForPrompt(googleContext) {
  if (!googleContext || !googleContext.hasGoogleConnected) {
    return '';
  }
  
  let contextStr = '\n\n--- USER\'S GOOGLE DATA (Retrieved just now) ---\n';
  let hasData = false;
  
  // Always show connected accounts
  if (googleContext.accounts && googleContext.accounts.length > 0) {
    contextStr += '\n🔗 CONNECTED GOOGLE ACCOUNTS:\n';
    googleContext.accounts.forEach((acc, i) => {
      contextStr += `${i + 1}. ${acc.email}${acc.isDefault ? ' (DEFAULT)' : ''}\n`;
      if (acc.calendars && acc.calendars.length > 0) {
        contextStr += `   Calendars: ${acc.calendars.map(c => c.primary ? `${c.name} (Primary)` : c.name).join(', ')}\n`;
      }
    });
    contextStr += '\n';
  }
  
  if (googleContext.gmail && googleContext.gmail.length > 0) {
    hasData = true;
    contextStr += '\n📧 RECENT EMAILS:\n';
    googleContext.gmail.forEach((email, i) => {
      contextStr += `\n[Email ${i + 1}]\n`;
      contextStr += `From: ${email.from}\n`;
      contextStr += `Subject: ${email.subject}\n`;
      contextStr += `Date: ${email.date}\n`;
      contextStr += `Preview: ${email.snippet}\n`;
      if (email.body) {
        contextStr += `Content: ${email.body.slice(0, 500)}${email.body.length > 500 ? '...' : ''}\n`;
      }
    });
  }
  
  if (googleContext.calendar && googleContext.calendar.length > 0) {
    hasData = true;
    contextStr += '\n📅 UPCOMING CALENDAR EVENTS:\n';
    googleContext.calendar.forEach((event, i) => {
      contextStr += `\n[Event ${i + 1}]\n`;
      contextStr += `Title: ${event.summary}\n`;
      contextStr += `When: ${event.start} to ${event.end}\n`;
      if (event.location) contextStr += `Location: ${event.location}\n`;
      if (event.description) contextStr += `Description: ${event.description.slice(0, 200)}\n`;
      if (event.attendees?.length > 0) contextStr += `Attendees: ${event.attendees.join(', ')}\n`;
    });
  }
  
  if (googleContext.drive && googleContext.drive.length > 0) {
    hasData = true;
    contextStr += '\n📁 GOOGLE DRIVE FILES:\n';
    googleContext.drive.forEach((file, i) => {
      contextStr += `${i + 1}. ${file.name} (${file.type}) - Modified: ${file.modified}\n`;
      if (file.link) contextStr += `   Link: ${file.link}\n`;
    });
  }
  
  // Even if no data was fetched, we have account info
  if (!hasData && (!googleContext.accounts || googleContext.accounts.length === 0)) {
    return '';
  }
  
  contextStr += '\n--- END GOOGLE DATA ---\n';
  contextStr += 'Use the above Google data to answer the user\'s question. Reference specific emails, events, or files as needed.\n';
  contextStr += '\nIMPORTANT - GOOGLE ACTIONS:\n';
  contextStr += 'You can perform actions on the user\'s Google accounts:\n';
  contextStr += '- send_email: Send emails (requires account_email)\n';
  contextStr += '- create_calendar_event: Create calendar events (requires account_email AND calendar_id)\n';
  contextStr += '- update_calendar_event: Update existing events\n';
  contextStr += '- delete_calendar_event: Delete events\n';
  contextStr += '- create_document: Create a Google Doc (requires account_email)\n';
  contextStr += '- create_spreadsheet: Create a Google Sheet (requires account_email)\n';
  contextStr += '\n⚠️ CRITICAL: Before taking ANY Google action, you MUST:\n';
  contextStr += '1. Ask the user which Google account to use (if they have multiple connected)\n';
  contextStr += '2. For calendar events, ask which calendar to use (e.g., "Primary", "Work", "Personal")\n';
  contextStr += '3. Only proceed after the user specifies the account and calendar\n';
  contextStr += '\nBE PROACTIVE: When appropriate, offer to take action:\n';
  contextStr += '- If you draft content, ask: "Would you like me to save this as a Google Doc? Which account should I use?"\n';
  contextStr += '- If discussing a meeting, ask: "Would you like me to add this to your calendar? Which account and calendar?"\n';
  contextStr += '- If you create data/lists, ask: "Would you like me to create a spreadsheet? Which account?"\n';
  contextStr += '- If discussing communication, ask: "Would you like me to draft an email? Which account should send it?"\n';
  
  return contextStr;
}

// Google API call helper
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
  
  // Check for API errors - Google returns errors in various formats
  if (data.error) {
    const errorInfo = typeof data.error === 'object' ? data.error : { message: data.error };
    console.error(`[GoogleAPI] Error calling ${endpoint}:`, JSON.stringify(data));
    
    // Build a descriptive error message
    const errorMsg = errorInfo.message || errorInfo.status || errorInfo.code || JSON.stringify(data.error);
    throw new Error(`Google API (${endpoint}): ${errorMsg}`);
  }
  
  // Also check HTTP status
  if (!response.ok) {
    console.error(`[GoogleAPI] HTTP ${response.status} for ${endpoint}:`, JSON.stringify(data));
    throw new Error(`Google API HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  
  return data;
}


async function getConnectionByEmail(userId, accountEmail) {
  const db = await getDb();
  const connection = await db.collection('google_connections').findOne({
    user_id: userId,
    email: accountEmail
  });
  return connection;
}

// Helper: Get valid token for a specific account
async function getTokenForAccount(userId, accountEmail) {
  const connection = await getConnectionByEmail(userId, accountEmail);
  if (!connection) return null;
  return await getValidGoogleTokenForConnection(connection);
}

// Execute Google action based on tool call
async function executeGoogleAction(userId, toolName, args) {
  const { account_email } = args;
  
  // If no account email specified, try to get default or first account
  let accessToken;
  let connectionEmail;
  
  if (account_email) {
    accessToken = await getTokenForAccount(userId, account_email);
    connectionEmail = account_email;
    if (!accessToken) {
      return { success: false, error: `Google account ${account_email} not connected or token expired.` };
    }
  } else {
    // Fallback: get default or first account
    const db = await getDb();
    const connection = await db.collection('google_connections').findOne({ user_id: userId, is_default: true }) 
      || await db.collection('google_connections').findOne({ user_id: userId });
    if (!connection) {
      return { success: false, error: 'No Google account connected. Please connect your Google account in Settings > Integrations.' };
    }
    accessToken = await getValidGoogleTokenForConnection(connection);
    connectionEmail = connection.email;
  }

  try {
    switch (toolName) {
      case 'send_email': {
        const { to, subject, body } = args;
        
        // Create RFC 2822 formatted email
        const email = [
          `From: ${connectionEmail}`,
          `To: ${to}`,
          `Subject: ${subject}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          body
        ].join('\r\n');
        
        const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        
        const data = await googleApiCall(accessToken, '/gmail/v1/users/me/messages/send', {
          method: 'POST',
          body: JSON.stringify({ raw: encodedEmail })
        });
        
        if (data.error) {
          return { success: false, error: data.error.message || 'Failed to send email' };
        }
        
        return { 
          success: true, 
          message: `✅ Email sent successfully to ${to}`,
          details: { messageId: data.id, to, subject }
        };
      }

      case 'create_calendar_event': {
        const { calendar_id, summary, description, location, start, end, attendees } = args;
        
        // Use specified calendar or default to 'primary'
        const calendarId = calendar_id || 'primary';
        
        const event = {
          summary,
          description: description || '',
          location: location || '',
          start: { dateTime: start, timeZone: 'UTC' },
          end: { dateTime: end, timeZone: 'UTC' },
          attendees: attendees?.map(email => ({ email })) || []
        };
        
        const data = await googleApiCall(accessToken, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
          method: 'POST',
          body: JSON.stringify(event)
        });
        
        if (data.error) {
          return { success: false, error: data.error.message || 'Failed to create event' };
        }
        
        return { 
          success: true, 
          message: `✅ Calendar event "${summary}" created successfully on ${calendarId === 'primary' ? 'your primary calendar' : calendarId}`,
          details: { 
            eventId: data.id, 
            summary: data.summary,
            calendar: calendarId,
            start: data.start?.dateTime || data.start?.date,
            htmlLink: data.htmlLink 
          }
        };
      }

      case 'update_calendar_event': {
        const { calendar_id, event_id, summary, description, location, start, end } = args;
        
        const calendarId = calendar_id || 'primary';
        
        const updates = {};
        if (summary) updates.summary = summary;
        if (description !== undefined) updates.description = description;
        if (location !== undefined) updates.location = location;
        if (start) updates.start = { dateTime: start, timeZone: 'UTC' };
        if (end) updates.end = { dateTime: end, timeZone: 'UTC' };
        
        const data = await googleApiCall(accessToken, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${event_id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates)
        });
        
        if (data.error) {
          return { success: false, error: data.error.message || 'Failed to update event' };
        }
        
        return { 
          success: true, 
          message: `✅ Calendar event updated successfully`,
          details: { eventId: data.id, summary: data.summary }
        };
      }

      case 'delete_calendar_event': {
        const { calendar_id, event_id } = args;
        
        const calendarId = calendar_id || 'primary';
        
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${event_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok && response.status !== 204) {
          const errData = await response.json().catch(() => ({}));
          return { success: false, error: errData.error?.message || 'Failed to delete event' };
        }
        
        return { 
          success: true, 
          message: `✅ Calendar event deleted successfully`
        };
      }

      case 'create_document': {
        const { title, content, folder_name } = args;
        
        // Create a Google Doc using the Docs API
        // First, create an empty doc
        const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title })
        });
        
        const docData = await createResponse.json();
        
        if (docData.error) {
          return { success: false, error: docData.error.message || 'Failed to create document' };
        }
        
        const documentId = docData.documentId;
        
        // Now insert the content
        if (content) {
          const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              requests: [
                {
                  insertText: {
                    location: { index: 1 },
                    text: content
                  }
                }
              ]
            })
          });
          
          const updateData = await updateResponse.json();
          if (updateData.error) {
            console.error('Failed to insert content:', updateData.error);
            // Document was created but content failed - still return success
          }
        }
        
        const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
        
        return { 
          success: true, 
          message: `✅ Document "${title}" created successfully`,
          details: { 
            documentId,
            title,
            url: docUrl
          }
        };
      }

      case 'create_spreadsheet': {
        const { title, headers, data } = args;
        
        // Create spreadsheet using Sheets API
        const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: { title },
            sheets: [{
              properties: { title: 'Sheet1' }
            }]
          })
        });
        
        const sheetData = await createResponse.json();
        
        if (sheetData.error) {
          return { success: false, error: sheetData.error.message || 'Failed to create spreadsheet' };
        }
        
        const spreadsheetId = sheetData.spreadsheetId;
        
        // Add data if provided
        if (headers || data) {
          const values = [];
          if (headers) values.push(headers);
          if (data) values.push(...data);
          
          if (values.length > 0) {
            const updateResponse = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=RAW`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values })
              }
            );
            
            const updateData = await updateResponse.json();
            if (updateData.error) {
              console.error('Failed to insert data:', updateData.error);
            }
          }
        }
        
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
        
        return { 
          success: true, 
          message: `✅ Spreadsheet "${title}" created successfully`,
          details: { 
            spreadsheetId,
            title,
            url: sheetUrl
          }
        };
      }

      case 'search_emails': {
        const { query: searchQuery, max_results } = args;
        const maxRes = Math.min(max_results || 10, 20);
        
        const params = new URLSearchParams({ maxResults: String(maxRes) });
        if (searchQuery) params.append('q', searchQuery);
        
        const gmailData = await googleApiCall(accessToken, `/gmail/v1/users/me/messages?${params}`);
        
        if (gmailData.error) {
          return { success: false, error: gmailData.error.message || 'Failed to search emails' };
        }
        
        if (!gmailData.messages || gmailData.messages.length === 0) {
          return { 
            success: true, 
            message: `No emails found matching "${searchQuery}"`,
            emails: []
          };
        }
        
        const detailed = await Promise.all(
          gmailData.messages.slice(0, maxRes).map(async (msg) => {
            try {
              const detail = await googleApiCall(accessToken, `/gmail/v1/users/me/messages/${msg.id}?format=full`);
              const headers = detail.payload?.headers || [];
              
              let body = '';
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
                }
                return '';
              };
              body = getBody(detail.payload);
              
              return {
                message_id: msg.id,
                from: headers.find(h => h.name === 'From')?.value || '',
                to: headers.find(h => h.name === 'To')?.value || '',
                subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
                date: headers.find(h => h.name === 'Date')?.value || '',
                snippet: detail.snippet || '',
                body: body.slice(0, 2000),
                labels: detail.labelIds || [],
                has_attachments: detail.payload?.parts?.some(p => p.filename && p.filename.length > 0) || false
              };
            } catch (e) {
              return null;
            }
          })
        );
        
        const emails = detailed.filter(Boolean);
        return { 
          success: true, 
          message: `Found ${emails.length} email(s) matching "${searchQuery}"`,
          emails
        };
      }

      case 'read_email': {
        const { message_id } = args;
        
        const detail = await googleApiCall(accessToken, `/gmail/v1/users/me/messages/${message_id}?format=full`);
        
        if (detail.error) {
          return { success: false, error: detail.error.message || 'Failed to read email' };
        }
        
        const headers = detail.payload?.headers || [];
        
        let body = '';
        const getBody = (payload) => {
          if (payload.body?.data) {
            return Buffer.from(payload.body.data, 'base64').toString('utf-8');
          }
          if (payload.parts) {
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8');
              }
              if (part.mimeType === 'text/html' && part.body?.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8');
              }
            }
            // Check nested parts
            for (const part of payload.parts) {
              if (part.parts) {
                const nested = getBody(part);
                if (nested) return nested;
              }
            }
          }
          return '';
        };
        body = getBody(detail.payload);
        
        const attachments = [];
        const getAttachments = (payload) => {
          if (payload.parts) {
            for (const part of payload.parts) {
              if (part.filename && part.filename.length > 0) {
                attachments.push({
                  filename: part.filename,
                  mimeType: part.mimeType,
                  size: part.body?.size || 0
                });
              }
              if (part.parts) getAttachments(part);
            }
          }
        };
        getAttachments(detail.payload);
        
        return { 
          success: true, 
          email: {
            message_id: message_id,
            from: headers.find(h => h.name === 'From')?.value || '',
            to: headers.find(h => h.name === 'To')?.value || '',
            cc: headers.find(h => h.name === 'Cc')?.value || '',
            subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
            date: headers.find(h => h.name === 'Date')?.value || '',
            body: body.slice(0, 5000),
            labels: detail.labelIds || [],
            attachments
          }
        };
      }

      default:
        return { success: false, error: `Unknown action: ${toolName}` };
    }
  } catch (err) {
    console.error(`Google action error (${toolName}):`, err);
    return { success: false, error: err.message };
  }
}

// Check if user has Google connected (for deciding whether to include tools)
async function userHasGoogleConnected(userId) {
  const db = await getDb();
  const connection = await db.collection('google_connections').findOne({ user_id: userId });
  return !!connection;
}

export {
  detectGoogleIntent,
  fetchGoogleContextForChat,
  formatGoogleContextForPrompt,
  googleApiCall,
  executeGoogleAction,
  getConnectionByEmail,
  getTokenForAccount,
  userHasGoogleConnected,
};
