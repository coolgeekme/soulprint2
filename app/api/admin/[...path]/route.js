import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { generateToken, verifyToken, hashPassword, comparePassword, getTokenFromRequest } from '@/lib/auth';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import { sendWelcomeEmail, sendAcceptedEmail, sendBetaCodeEmail } from '@/lib/email';
import { ok, err, authenticate } from '@/lib/api-utils';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// ============================================================
// ADMIN AUTHENTICATION HELPER
// ============================================================

async function requireAdmin(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) return null;
  return user;
}

// ============================================================
// DEPLOYMENT CHECK & RELEASE NOTES
// ============================================================

let _deploymentCheckDone = false;

async function checkAndGenerateReleaseNotes() {
  if (_deploymentCheckDone) return;
  _deploymentCheckDone = true;

  try {
    const db = await getDb();
    
    // Check if we've already generated notes for this server startup
    const meta = await db.collection('deployment_meta').findOne({ key: 'last_release_notes_check' });
    const lastCheck = meta?.value ? new Date(meta.value) : null;
    const now = new Date();
    
    // Only auto-generate if more than 4 hours since last check (prevents spam on restarts)
    if (lastCheck && (now - lastCheck) < 4 * 60 * 60 * 1000) {
      console.log('[ReleaseNotes] Recent check exists, skipping auto-generation.');
      return;
    }

    // Update the check timestamp
    await db.collection('deployment_meta').updateOne(
      { key: 'last_release_notes_check' },
      { $set: { value: now.toISOString(), updated_at: now } },
      { upsert: true }
    );

    console.log('[ReleaseNotes] Checking for new deployment...');

    // Read support KB for context
    let kbContent = '';
    try {
      const possiblePaths = ['/app/support-kb.md', require('path').join(process.cwd(), 'support-kb.md')];
      for (const p of possiblePaths) {
        try { kbContent = fs.readFileSync(p, 'utf8'); break; } catch (e) { continue; }
      }
    } catch (e) { /* ignore */ }

    if (!kbContent) {
      console.log('[ReleaseNotes] No support-kb.md found, skipping auto-generation.');
      return;
    }

    // Check existing updates to avoid duplicates
    const existingUpdates = await db.collection('app_updates').find({}).sort({ created_at: -1 }).limit(5).toArray();
    const existingTitles = existingUpdates.map(u => u.title).join(', ');

    // Use LLM to generate
    const provider = getProvider('openai', 'gpt-4o-mini');
    const prompt = `You are a product manager writing release notes for "SoulPrint".
Based on the knowledge base, generate a "What's New" update.

RULES:
- Write 2-5 bullet points of impactful USER-FACING features
- Simple, non-technical language
- Do NOT repeat these already-published updates: ${existingTitles}
- If nothing new beyond existing updates, respond: NO_UPDATES

FORMAT:
TITLE: [3-6 word title]
TYPE: [feature|improvement|fix]
NOTES:
- [bullet 1]
- [bullet 2]

KNOWLEDGE BASE:
${kbContent.substring(0, 5000)}`;

    const response = await provider.generateChatCompletion({
      systemPrompt: 'Concise product copywriter. Output only the requested format.',
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4o-mini',
      temperature: 0.4,
    });

    if (!response || response.includes('NO_UPDATES')) {
      console.log('[ReleaseNotes] No new updates to announce.');
      return;
    }

    const titleMatch = response.match(/TITLE:\s*(.+)/i);
    const typeMatch = response.match(/TYPE:\s*(\w+)/i);
    const notesMatch = response.match(/NOTES:\s*([\s\S]+)/i);

    const title = titleMatch?.[1]?.trim() || 'Latest Updates';
    const type = ['feature', 'improvement', 'fix', 'announcement'].includes(typeMatch?.[1]?.trim().toLowerCase()) 
      ? typeMatch[1].trim().toLowerCase() : 'improvement';
    const notes = notesMatch?.[1]?.trim() || response;

    await db.collection('app_updates').insertOne({
      id: uuidv4(),
      title,
      description: notes,
      version: null,
      type,
      published: false,
      auto_generated: true,
      release_date: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'system',
    });

    console.log(`[ReleaseNotes] ✅ Auto-generated: "${title}" (${type}) — saved as draft`);
  } catch (error) {
    console.error('[ReleaseNotes] Auto-generation failed:', error.message);
  }
}

// Note: Admin manual trigger for release notes is handled in /api/admin/[...path]/route.js

// PWA Install Prompt - Get user's install prompt preference

async function sendFeedbackNotificationEmail(userEmail, feedbackMessage, category, rating, attachment) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log(`[FEEDBACK] Email not sent - no API key. From: ${userEmail} | Category: ${category}`);
    return;
  }

  const categoryEmoji = {
    'general': '💬',
    'bug': '🐛',
    'feature': '💡',
    'other': '📝'
  }[category] || '💬';

  const ratingDisplay = rating ? `${'⭐'.repeat(rating)} (${rating}/5)` : 'Not provided';
  
  // Build HTML email
  let htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 24px; color: white;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #f97316;">🔔 New SoulPrint Feedback</h1>
        <p style="margin: 0; color: #9ca3af; font-size: 14px;">A user has submitted feedback</p>
      </div>
      
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 16px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">From:</td>
            <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Category:</td>
            <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${categoryEmoji} ${category.charAt(0).toUpperCase() + category.slice(1)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Rating:</td>
            <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${ratingDisplay}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-top: 16px;">
        <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Feedback Message</h3>
        <p style="margin: 0; color: #1f2937; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${feedbackMessage}</p>
      </div>
      
      ${attachment ? `
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 12px; padding: 16px; margin-top: 16px;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">📎 <strong>Attachment included:</strong> ${attachment.name || 'screenshot'}</p>
        <p style="margin: 8px 0 0 0; color: #92400e; font-size: 12px;">The screenshot/image is attached to this email.</p>
      </div>
      ` : ''}
      
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
          SoulPrint Feedback System • ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
  `;

  // Prepare email payload
  const emailPayload = {
    from: 'SoulPrint Feedback <team@soulprintengine.ai>',
    to: ['reggie@archeforge.com'],
    subject: `${categoryEmoji} New Feedback: ${category.charAt(0).toUpperCase() + category.slice(1)} from ${userEmail}`,
    html: htmlContent,
  };

  // Add attachment if provided
  if (attachment && attachment.base64) {
    emailPayload.attachments = [{
      filename: attachment.name || 'screenshot.png',
      content: attachment.base64,
    }];
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Resend API error:', result);
      throw new Error(result.message || 'Failed to send email');
    }
    
    console.log(`[FEEDBACK] Email sent to reggie@archeforge.com - ID: ${result.id}`);
  } catch (error) {
    console.error('Failed to send feedback email:', error);
    throw error;
  }
}

// CONTACT FORM - Send email to team@archeforge.com

// ============================================================
// ADMIN FEEDBACK HANDLERS
// ============================================================

async function handleAdminGetFeedback(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // filter by status
  const limit = parseInt(searchParams.get('limit')) || 50;
  
  const query = {};
  if (status) query.status = status;

  // Fetch from both feedback collections
  const [userFeedback, messageFeedback] = await Promise.all([
    db.collection('user_feedback').find(query).sort({ created_at: -1 }).limit(limit).toArray(),
    db.collection('feedback').find(status ? {} : {}).sort({ created_at: -1 }).limit(limit).toArray()
  ]);

  // Normalize message feedback (thumbs up/down) to match the display format
  // Look up user emails for message feedback entries
  const userIds = [...new Set(messageFeedback.map(f => f.user_id).filter(Boolean))];
  const usersMap = {};
  if (userIds.length > 0) {
    const users = await db.collection('users').find({ id: { $in: userIds } }).toArray();
    users.forEach(u => { usersMap[u.id] = u.email || u.username || 'Unknown User'; });
  }

  const normalizedMessageFeedback = messageFeedback.map(f => ({
    id: f.id,
    user_email: usersMap[f.user_id] || 'Unknown User',
    message: f.note || `Message ${f.rating === 'up' ? '👍' : '👎'} feedback${f.conversation_id ? ` (conversation)` : ''}`,
    category: f.rating === 'up' ? 'positive' : f.rating === 'down' ? 'negative' : 'general',
    rating: f.rating,
    status: f.status || 'new',
    created_at: f.created_at,
    source: 'message_feedback',
    conversation_id: f.conversation_id,
    context: f.context,
  }));

  const normalizedUserFeedback = userFeedback.map(f => ({
    id: f.id,
    user_email: f.user_email || 'Anonymous',
    message: f.message || '',
    category: f.category || 'general',
    rating: f.rating,
    status: f.status || 'new',
    created_at: f.created_at,
    attachment: f.attachment ? true : false,
    source: 'user_feedback',
    anonymous: f.anonymous,
  }));

  // Combine and sort by date
  const allFeedback = [...normalizedUserFeedback, ...normalizedMessageFeedback]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);

  // Get combined stats
  const userFbTotal = await db.collection('user_feedback').countDocuments();
  const msgFbTotal = await db.collection('feedback').countDocuments();
  const userFbNew = await db.collection('user_feedback').countDocuments({ status: 'new' });
  const userFbReviewed = await db.collection('user_feedback').countDocuments({ status: 'reviewed' });
  const userFbResolved = await db.collection('user_feedback').countDocuments({ status: 'resolved' });

  // Message feedback without status counts as 'new'
  const msgFbWithoutStatus = await db.collection('feedback').countDocuments({ status: { $exists: false } });
  const msgFbNew = await db.collection('feedback').countDocuments({ status: 'new' });
  const msgFbReviewed = await db.collection('feedback').countDocuments({ status: 'reviewed' });
  const msgFbResolved = await db.collection('feedback').countDocuments({ status: 'resolved' });

  return ok({
    feedback: allFeedback,
    stats: {
      total: userFbTotal + msgFbTotal,
      new: userFbNew + msgFbNew + msgFbWithoutStatus,
      reviewed: userFbReviewed + msgFbReviewed,
      resolved: userFbResolved + msgFbResolved,
    }
  });
}

// ADMIN - Update feedback status
async function handleAdminUpdateFeedback(request, feedbackId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const body = await request.json();
  const { status, admin_note } = body;

  const db = await getDb();
  
  // Try user_feedback first, then feedback collection
  let feedback = await db.collection('user_feedback').findOne({ id: feedbackId });
  let collection = 'user_feedback';
  
  if (!feedback) {
    feedback = await db.collection('feedback').findOne({ id: feedbackId });
    collection = 'feedback';
  }
  
  if (!feedback) return err('Feedback not found', 404);

  await db.collection(collection).updateOne(
    { id: feedbackId },
    { 
      $set: { 
        status: status || feedback.status,
        admin_note: admin_note || feedback.admin_note,
        updated_at: new Date(),
        updated_by: user.id,
      }
    }
  );

  return ok({ success: true });
}

// ADMIN - Summarize feedback using LLM
async function handleAdminSummarizeFeedback(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const db = await getDb();
  const body = await request.json().catch(() => ({}));
  const { status, category, limit: limitParam } = body;
  
  // Get feedback to summarize
  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  
  const feedback = await db.collection('user_feedback')
    .find(query)
    .sort({ created_at: -1 })
    .limit(parseInt(limitParam) || 50)
    .toArray();

  if (feedback.length === 0) {
    return ok({ summary: 'No feedback to summarize.', feedbackCount: 0 });
  }

  // Prepare feedback text for LLM
  const feedbackText = feedback.map((f, i) => 
    `[${i + 1}] ${f.category.toUpperCase()} | ${f.rating ? `Rating: ${f.rating}/5` : 'No rating'}\n${f.message}`
  ).join('\n\n---\n\n');

  const provider = getProvider('openai', 'gpt-4o-mini');
  
  try {
    const response = await provider.generateChatCompletion({
      systemPrompt: 'You are an expert product analyst. Summarize user feedback concisely and extract actionable insights.',
      messages: [{
        role: 'user',
        content: `Please analyze and summarize the following ${feedback.length} user feedback submissions for our AI assistant product "SoulPrint". 

Provide:
1. A brief overall summary (2-3 sentences)
2. Top themes/topics mentioned (bullet points)
3. Key action items or suggestions (bullet points)
4. Overall sentiment (positive/negative/mixed)

FEEDBACK TO ANALYZE:
${feedbackText.substring(0, 15000)}`
      }],
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });

    return ok({ 
      summary: response,
      feedbackCount: feedback.length,
      dateRange: {
        oldest: feedback[feedback.length - 1]?.created_at,
        newest: feedback[0]?.created_at,
      }
    });
  } catch (e) {
    console.error('Feedback summarization error:', e);
    return err(`Failed to summarize: ${e.message}`, 500);
  }
}

// ============================================================

// ============================================================
// ADMIN ANNOUNCEMENTS
// ============================================================

async function handleAdminCreateAnnouncement(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const body = await request.json();
  const { title, content, type, link, published } = body;

  if (!title || !content) {
    return err('Title and content are required', 400);
  }

  const db = await getDb();
  const announcement = {
    id: uuidv4(),
    title: title.trim(),
    content: content.trim(),
    type: type || 'info', // info, warning, success, update
    link: link?.trim() || null,
    published: published ?? false,
    created_by: user.id,
    created_at: new Date(),
    updated_at: new Date(),
    // Analytics tracking
    view_count: 0,
    click_count: 0,
    dismiss_count: 0,
  };

  await db.collection('announcements').insertOne(announcement);

  return ok({ success: true, announcement });
}

// ADMIN - Get all announcements
async function handleAdminGetAnnouncements(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const db = await getDb();
  const announcements = await db.collection('announcements')
    .find({})
    .sort({ created_at: -1 })
    .toArray();

  return ok({ announcements });
}

// ADMIN - Update announcement
async function handleAdminUpdateAnnouncement(request, announcementId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const body = await request.json();
  const { title, content, type, link, published } = body;

  const db = await getDb();
  const announcement = await db.collection('announcements').findOne({ id: announcementId });
  if (!announcement) return err('Announcement not found', 404);

  const updates = { updated_at: new Date() };
  if (title !== undefined) updates.title = title.trim();
  if (content !== undefined) updates.content = content.trim();
  if (type !== undefined) updates.type = type;
  if (link !== undefined) updates.link = link?.trim() || null;
  if (published !== undefined) updates.published = published;

  await db.collection('announcements').updateOne(
    { id: announcementId },
    { $set: updates }
  );

  return ok({ success: true });
}

// ADMIN - Delete announcement
async function handleAdminDeleteAnnouncement(request, announcementId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  if (user.role !== 'superadmin' && user.role !== 'admin') return err('Forbidden', 403);

  const db = await getDb();
  const announcement = await db.collection('announcements').findOne({ id: announcementId });
  if (!announcement) return err('Announcement not found', 404);

  await db.collection('announcements').deleteOne({ id: announcementId });

  return ok({ success: true });
}

// USER - Get published announcements (with 24-hour dismiss support)
async function handleGetAnnouncements(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get published announcements
  const announcements = await db.collection('announcements')
    .find({ published: true })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();

  // Get user's dismissed announcements with timestamps
  const userDismissed = await db.collection('user_dismissed_announcements')
    .findOne({ user_id: user.id });
  
  // dismissed_announcements is now an array of {announcement_id, dismissed_at}
  const dismissedMap = new Map();
  if (userDismissed?.dismissed_announcements) {
    userDismissed.dismissed_announcements.forEach(d => {
      dismissedMap.set(d.announcement_id, new Date(d.dismissed_at));
    });
  }
  // Legacy support for old format
  if (userDismissed?.announcement_ids) {
    userDismissed.announcement_ids.forEach(id => {
      if (!dismissedMap.has(id)) {
        dismissedMap.set(id, new Date(0)); // Treat legacy as permanently dismissed
      }
    });
  }

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Filter out only recently dismissed ones (within 24 hours)
  const unread = announcements.filter(a => {
    // Check if permanently dismissed
    if (userDismissed?.permanently_dismissed?.includes(a.id)) return false;
    
    const dismissedAt = dismissedMap.get(a.id);
    if (!dismissedAt) return true; // Never dismissed
    return dismissedAt < twentyFourHoursAgo; // Dismissed more than 24h ago, show again
  });

  // Get dismissed status for each announcement
  const announcementsWithStatus = announcements.map(a => ({
    id: a.id,
    title: a.title,
    content: a.content,
    type: a.type,
    link: a.link,
    created_at: a.created_at,
    permanently_dismissed: userDismissed?.permanently_dismissed?.includes(a.id) || false,
    temporarily_dismissed: dismissedMap.has(a.id) && !userDismissed?.permanently_dismissed?.includes(a.id),
    dismissed_at: dismissedMap.get(a.id) || null,
  }));

  return ok({ 
    announcements: announcementsWithStatus,
    unread: unread.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      type: a.type,
      link: a.link,
      created_at: a.created_at,
    })),
  });
}

// USER - Dismiss announcement (with timestamp for 24-hour reset, or permanent)
async function handleDismissAnnouncement(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { announcementId, permanent } = body;

  if (!announcementId) return err('announcementId required', 400);

  const db = await getDb();
  
  // First, increment the dismiss count on the announcement
  await db.collection('announcements').updateOne(
    { id: announcementId },
    { $inc: { dismiss_count: 1 } }
  );

  if (permanent) {
    // Permanently dismiss - add to permanently_dismissed array
    await db.collection('user_dismissed_announcements').updateOne(
      { user_id: user.id },
      { 
        $addToSet: { permanently_dismissed: announcementId },
        $pull: { dismissed_announcements: { announcement_id: announcementId } }
      },
      { upsert: true }
    );
  } else {
    // Temporary dismiss with timestamp (24-hour reset)
    // Remove old entry first, then add new one with current timestamp
    await db.collection('user_dismissed_announcements').updateOne(
      { user_id: user.id },
      { 
        $pull: { dismissed_announcements: { announcement_id: announcementId } }
      }
    );
    
    await db.collection('user_dismissed_announcements').updateOne(
      { user_id: user.id },
      { 
        $push: { 
          dismissed_announcements: { 
            announcement_id: announcementId, 
            dismissed_at: new Date() 
          } 
        }
      },
      { upsert: true }
    );
  }

  return ok({ success: true });
}

// USER - Track announcement click
async function handleAnnouncementClick(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { announcementId } = body;

  if (!announcementId) return err('announcementId required', 400);

  const db = await getDb();
  
  // Increment click count
  await db.collection('announcements').updateOne(
    { id: announcementId },
    { $inc: { click_count: 1 } }
  );

  return ok({ success: true });
}

// USER - Restore (un-dismiss) an announcement
async function handleRestoreAnnouncement(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { announcementId } = body;

  if (!announcementId) return err('announcementId required', 400);

  const db = await getDb();
  
  // Remove from both permanently_dismissed and dismissed_announcements
  await db.collection('user_dismissed_announcements').updateOne(
    { user_id: user.id },
    { 
      $pull: { 
        permanently_dismissed: announcementId,
        dismissed_announcements: { announcement_id: announcementId }
      }
    }
  );

  return ok({ success: true });
}

// ============================================

// ============================================================
// ADMIN APP UPDATES
// ============================================================

// APP UPDATES (What's New) - For logged-in users
// ============================================

// GET /api/app-updates - Get all published app updates for users
async function handleGetAppUpdates(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  
  // Get published updates, sorted by date descending
  const updates = await db.collection('app_updates')
    .find({ published: true })
    .sort({ release_date: -1 })
    .limit(limit)
    .toArray();

  // Get user's last viewed timestamp
  const userPrefs = await db.collection('user_preferences').findOne({ user_id: user.id });
  const lastViewedAt = userPrefs?.app_updates_last_viewed || null;

  // Count unread updates
  const unreadCount = lastViewedAt 
    ? updates.filter(u => new Date(u.created_at) > new Date(lastViewedAt)).length
    : updates.length;

  return ok({
    updates: updates.map(u => ({
      id: u.id,
      title: u.title,
      description: u.description,
      version: u.version,
      type: u.type, // 'feature' | 'improvement' | 'fix' | 'announcement'
      release_date: u.release_date,
      created_at: u.created_at,
    })),
    unread_count: unreadCount,
    last_viewed_at: lastViewedAt,
  });
}

// POST /api/app-updates/mark-viewed - Mark updates as viewed
async function handleMarkAppUpdatesViewed(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  await db.collection('user_preferences').updateOne(
    { user_id: user.id },
    { $set: { app_updates_last_viewed: new Date() } },
    { upsert: true }
  );

  return ok({ success: true });
}

// ADMIN - Get all app updates (including unpublished)
async function handleAdminGetAppUpdates(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  const updates = await db.collection('app_updates')
    .find({})
    .sort({ created_at: -1 })
    .toArray();

  return ok({
    updates: updates.map(u => ({
      id: u.id,
      title: u.title,
      description: u.description,
      version: u.version,
      type: u.type,
      published: u.published,
      auto_generated: u.auto_generated || false,
      release_date: u.release_date,
      created_at: u.created_at,
      updated_at: u.updated_at,
      created_by: u.created_by,
    })),
  });
}

// ADMIN - Create app update
async function handleAdminCreateAppUpdate(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { title, description, version, type, published, release_date } = body;

  if (!title || !description) {
    return err('Title and description are required', 400);
  }

  const db = await getDb();
  
  const newUpdate = {
    id: uuidv4(),
    title,
    description,
    version: version || null,
    type: type || 'feature',
    published: published || false,
    release_date: release_date ? new Date(release_date) : new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    created_by: admin.id,
  };

  await db.collection('app_updates').insertOne(newUpdate);

  return ok({ success: true, update: newUpdate });
}

// ADMIN - Update app update
async function handleAdminUpdateAppUpdate(request, updateId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  const existing = await db.collection('app_updates').findOne({ id: updateId });
  if (!existing) return err('Update not found', 404);

  const updates = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.version !== undefined) updates.version = body.version;
  if (body.type !== undefined) updates.type = body.type;
  if (body.published !== undefined) updates.published = body.published;
  if (body.release_date !== undefined) updates.release_date = new Date(body.release_date);
  updates.updated_at = new Date();

  await db.collection('app_updates').updateOne(
    { id: updateId },
    { $set: updates }
  );

  return ok({ success: true });
}

// ADMIN - Delete app update
async function handleAdminDeleteAppUpdate(request, updateId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  const existing = await db.collection('app_updates').findOne({ id: updateId });
  if (!existing) return err('Update not found', 404);

  await db.collection('app_updates').deleteOne({ id: updateId });

  return ok({ success: true });
}

// ── AUTO-GENERATE RELEASE NOTES ON DEPLOYMENT ──────────────────────────────
// This runs automatically on first request after a new deployment.
// It uses a timestamp-based approach that works in both dev and production (no git required).


// handleAdminGenerateReleaseNotes
async function handleAdminGenerateReleaseNotes(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);
  await checkAndGenerateReleaseNotes();
  return ok({ success: true, message: 'Release notes generation triggered' });
}

// ============================================================
// ADMIN CORE HANDLERS
// ============================================================

async function handleAdminGetUsers(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  
  // Date filters
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const onboardingFilter = searchParams.get('onboarding'); // complete, incomplete
  const assessmentFilter = searchParams.get('assessment'); // complete, incomplete

  const db = await getDb();
  
  // Build query
  const query = {};
  
  if (search) {
    query.email = { $regex: search, $options: 'i' };
  }
  
  // Date range filter on registration (created_at)
  if (startDate || endDate) {
    query.created_at = {};
    if (startDate) {
      query.created_at.$gte = new Date(startDate);
    }
    if (endDate) {
      // Add 1 day to include the end date fully
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      query.created_at.$lt = endDatePlusOne;
    }
  }

  // First get all matching users
  let users = await db.collection('users')
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  // Get profiles for filtering by onboarding/assessment
  const profiles = await db.collection('profiles')
    .find({ user_id: { $in: users.map(u => u.id) } })
    .toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  // Get assessment answer counts per user to determine quick vs full
  const assessmentCounts = await db.collection('assessment_answers').aggregate([
    { $match: { user_id: { $in: users.map(u => u.id) } } },
    { $group: { _id: '$user_id', count: { $sum: 1 } } }
  ]).toArray();
  const assessmentCountMap = Object.fromEntries(assessmentCounts.map(a => [a._id, a.count]));

  // Helper to determine assessment type based on answer count
  const getAssessmentType = (userId) => {
    const count = assessmentCountMap[userId] || 0;
    if (count >= 30) return 'full';  // 30+ answers = full assessment (36 questions)
    if (count >= 10) return 'quick'; // 10-29 answers = quick assessment (12 questions)
    if (count > 0) return 'partial'; // Some but not complete
    return 'none';
  };

  // Apply onboarding/assessment filters
  if (onboardingFilter === 'complete') {
    users = users.filter(u => profileMap[u.id]?.onboarding_complete === true);
  } else if (onboardingFilter === 'incomplete') {
    users = users.filter(u => !profileMap[u.id]?.onboarding_complete);
  }
  
  if (assessmentFilter === 'complete') {
    users = users.filter(u => profileMap[u.id]?.assessment_complete === true);
  } else if (assessmentFilter === 'incomplete') {
    users = users.filter(u => !profileMap[u.id]?.assessment_complete);
  } else if (assessmentFilter === 'quick') {
    users = users.filter(u => getAssessmentType(u.id) === 'quick');
  } else if (assessmentFilter === 'full') {
    users = users.filter(u => getAssessmentType(u.id) === 'full');
  }

  const total = users.length;
  const paginatedUsers = users.slice((page - 1) * limit, page * limit);

  return ok({
    users: paginatedUsers.map(u => {
      const answerCount = assessmentCountMap[u.id] || 0;
      const assessmentType = getAssessmentType(u.id);
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        accepted: u.accepted,
        created_at: u.created_at,
        last_active_at: u.last_active_at,
        display_name: profileMap[u.id]?.display_name || '',
        assessment_complete: profileMap[u.id]?.assessment_complete || false,
        assessment_answer_count: answerCount,
        assessment_type: assessmentType,
        onboarding_complete: profileMap[u.id]?.onboarding_complete || false,
      };
    }),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

async function handleAdminUpdateUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  // Get current user
  const user = await db.collection('users').findOne({ id: userId });
  if (!user) return err('User not found', 404);

  const update = {};
  
  // Basic fields
  if (body.accepted !== undefined) update.accepted = body.accepted;
  if (body.display_name !== undefined) update.display_name = body.display_name;
  
  // Email change - check for duplicates
  if (body.email !== undefined && body.email !== user.email) {
    const existing = await db.collection('users').findOne({ email: body.email.toLowerCase() });
    if (existing) return err('A user with this email already exists', 400);
    update.email = body.email.toLowerCase();
  }
  
  // Role change - only superadmin
  if (body.role !== undefined) {
    if (admin.role !== 'superadmin') return err('Only superadmin can change roles', 403);
    update.role = body.role;
  }

  if (Object.keys(update).length === 0) {
    return ok({ success: true, message: 'No changes' });
  }

  update.updated_at = new Date();
  await db.collection('users').updateOne({ id: userId }, { $set: update });

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'update_user',
    target_user_id: userId,
    metadata: body,
    created_at: new Date(),
  });

  return ok({ success: true });
}

async function handleAdminResetPasscode(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { new_passcode } = body;
  if (!new_passcode) return err('new_passcode required');

  const db = await getDb();
  const hashed = await hashPassword(new_passcode);
  await db.collection('users').updateOne({ id: userId }, { $set: { passcode_hash: hashed } });

  return ok({ success: true });
}

// ADMIN - Create new user
async function handleAdminCreateUser(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { email, passcode, display_name, role, accepted } = body;

  if (!email || !passcode) {
    return err('Email and passcode are required', 400);
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err('Invalid email format', 400);
  }

  const db = await getDb();

  // Check if user already exists
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) {
    return err('A user with this email already exists', 400);
  }

  // Only superadmin can create admin/superadmin users
  if ((role === 'admin' || role === 'superadmin') && admin.role !== 'superadmin') {
    return err('Only superadmin can create admin users', 403);
  }

  const hashedPasscode = await hashPassword(passcode);
  const newUser = {
    id: uuidv4(),
    email: email.toLowerCase(),
    passcode_hash: hashedPasscode,
    display_name: display_name || '',
    role: role || 'user',
    accepted: accepted ?? true,
    onboarding_complete: false,
    assessment_complete: false,
    created_at: new Date(),
    created_by: admin.id,
  };

  await db.collection('users').insertOne(newUser);

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'create_user',
    target_user_id: newUser.id,
    metadata: { email: newUser.email, role: newUser.role },
    created_at: new Date(),
  });

  return ok({ 
    success: true, 
    user: { 
      id: newUser.id, 
      email: newUser.email, 
      display_name: newUser.display_name,
      role: newUser.role 
    } 
  });
}

// ADMIN - Delete user
async function handleAdminDeleteUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  // Only superadmin can delete users
  if (admin.role !== 'superadmin') {
    return err('Only superadmin can delete users', 403);
  }

  const db = await getDb();

  // Get user info before deletion
  const user = await db.collection('users').findOne({ id: userId });
  if (!user) {
    return err('User not found', 404);
  }

  // Prevent deleting yourself
  if (user.id === admin.id) {
    return err('You cannot delete your own account', 400);
  }

  // Prevent deleting other superadmins (safety)
  if (user.role === 'superadmin') {
    return err('Cannot delete superadmin users', 400);
  }

  // Delete user
  await db.collection('users').deleteOne({ id: userId });

  // Delete ALL related data from all collections
  await db.collection('conversations').deleteMany({ user_id: userId });
  await db.collection('messages').deleteMany({ user_id: userId });
  await db.collection('soul_profiles').deleteMany({ user_id: userId });
  await db.collection('assessment_responses').deleteMany({ user_id: userId });
  await db.collection('user_memories').deleteMany({ user_id: userId });
  await db.collection('media_gallery').deleteMany({ user_id: userId });
  await db.collection('imported_messages').deleteMany({ user_id: userId });
  await db.collection('imported_data').deleteMany({ user_id: userId });
  await db.collection('telegram_links').deleteMany({ user_id: userId });
  await db.collection('user_feedback').deleteMany({ user_id: userId });
  await db.collection('user_preferences').deleteMany({ user_id: userId });
  await db.collection('communication_profiles').deleteMany({ user_id: userId });
  await db.collection('video_jobs').deleteMany({ user_id: userId });
  await db.collection('scheduled_tasks').deleteMany({ user_id: userId });
  await db.collection('announcement_dismissals').deleteMany({ user_id: userId });
  await db.collection('announcement_clicks').deleteMany({ user_id: userId });
  
  console.log(`[Admin] Fully deleted user ${userId} (${user.email}) and all associated data`);

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'delete_user',
    target_user_id: userId,
    metadata: { email: user.email },
    created_at: new Date(),
  });

  return ok({ success: true });
}

// ADMIN - Get detailed user info
async function handleAdminGetUserDetails(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();

  // Get user
  const user = await db.collection('users').findOne({ id: userId });
  if (!user) {
    return err('User not found', 404);
  }

  // Get profile
  const profile = await db.collection('profiles').findOne({ user_id: userId });

  // Get conversations with message counts
  const conversations = await db.collection('conversations')
    .find({ user_id: userId })
    .sort({ updated_at: -1 })
    .toArray();
  
  // Get message counts per conversation
  const conversationIds = conversations.map(c => c.id);
  const messageCounts = await db.collection('messages').aggregate([
    { $match: { conversation_id: { $in: conversationIds } } },
    { $group: { _id: '$conversation_id', count: { $sum: 1 } } }
  ]).toArray();
  const messageCountMap = Object.fromEntries(messageCounts.map(m => [m._id, m.count]));

  // Get total messages
  const totalMessages = await db.collection('messages').countDocuments({ user_id: userId });

  // Get memories
  const memories = await db.collection('user_memories')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();

  // Get assessment answers
  const assessmentAnswers = await db.collection('assessment_answers')
    .find({ user_id: userId })
    .toArray();

  // Get questions to map answer IDs to actual questions
  const questionIds = assessmentAnswers.map(a => a.question_id);
  const questions = await db.collection('assessment_questions')
    .find({ id: { $in: questionIds } })
    .toArray();
  const questionMap = Object.fromEntries(questions.map(q => [q.id, q]));

  // Get imports
  const imports = await db.collection('data_imports')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();

  // Get media generated
  const mediaItems = await db.collection('media_gallery')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(20)
    .toArray();

  // Get telegram link
  const telegramLink = await db.collection('telegram_links')
    .findOne({ user_id: userId });

  // Get google connections
  const googleConnections = await db.collection('google_tokens')
    .find({ user_id: userId })
    .toArray();

  // Calculate cost estimate (rough estimate based on messages)
  const llmCostEstimate = totalMessages * 0.002; // ~$0.002 per message average
  const mediaCost = mediaItems.reduce((sum, m) => sum + (m.cost || 0), 0);

  // Get feedback given by this user
  const feedback = await db.collection('user_feedback')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(20)
    .toArray();

  // Get soul profile if exists
  const soulProfile = await db.collection('soul_profiles')
    .findOne({ user_id: userId });

  return ok({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      accepted: user.accepted,
      created_at: user.created_at,
      last_active_at: user.last_active_at,
      auth_provider: user.auth_provider,
      firebase_uid: user.firebase_uid ? true : false,
    },
    profile: profile ? {
      display_name: profile.display_name,
      assistant_name: profile.assistant_name,
      onboarding_complete: profile.onboarding_complete,
      assessment_complete: profile.assessment_complete,
      field: profile.field,
      help_with: profile.help_with,
      descriptors: profile.descriptors,
      discovery_source: profile.discovery_source,
      timezone: profile.timezone,
      location: profile.location,
    } : null,
    stats: {
      total_conversations: conversations.length,
      total_messages: totalMessages,
      total_memories: memories.length,
      total_imports: imports.length,
      total_media: mediaItems.length,
      estimated_llm_cost: parseFloat(llmCostEstimate.toFixed(4)),
      estimated_media_cost: parseFloat(mediaCost.toFixed(4)),
      estimated_total_cost: parseFloat((llmCostEstimate + mediaCost).toFixed(4)),
    },
    conversations: conversations.slice(0, 20).map(c => ({
      id: c.id,
      title: c.title || 'Untitled',
      topic: c.topic_category,
      source: c.source || 'web',
      message_count: messageCountMap[c.id] || 0,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })),
    memories: memories.map(m => ({
      id: m.id,
      content: m.content,
      category: m.category,
      importance: m.importance,
      source: m.source,
      created_at: m.created_at,
    })),
    assessment: {
      answer_count: assessmentAnswers.length,
      type: assessmentAnswers.length >= 30 ? 'full' : assessmentAnswers.length >= 10 ? 'quick' : assessmentAnswers.length > 0 ? 'partial' : 'none',
      answers: assessmentAnswers.map(a => ({
        question_id: a.question_id,
        question_text: questionMap[a.question_id]?.question || 'Unknown question',
        pillar: questionMap[a.question_id]?.pillar,
        answer: a.answer,
        answered_at: a.created_at || a.answered_at,
      })),
    },
    imports: imports.map(i => ({
      id: i.id,
      type: i.type || i.source,
      status: i.status,
      items_processed: i.items_processed || i.messages_count,
      created_at: i.created_at,
      completed_at: i.completed_at,
    })),
    media: mediaItems.map(m => ({
      id: m.id,
      type: m.type,
      model: m.model,
      prompt: m.prompt?.substring(0, 100),
      url: m.url,
      cost: m.cost,
      created_at: m.created_at,
    })),
    integrations: {
      telegram: telegramLink ? {
        linked: true,
        telegram_user_id: telegramLink.telegram_user_id,
        telegram_username: telegramLink.telegram_username,
        linked_at: telegramLink.created_at,
      } : { linked: false },
      google: googleConnections.length > 0 ? {
        connected: true,
        accounts: googleConnections.map(g => ({
          email: g.google_email,
          scopes: g.scopes,
          connected_at: g.created_at,
        })),
      } : { connected: false },
    },
    feedback: feedback.map(f => ({
      id: f.id,
      rating: f.rating,
      note: f.note,
      message_id: f.message_id,
      created_at: f.created_at,
    })),
    soul_profile: soulProfile ? {
      summary: soulProfile.summary || soulProfile.soul_profile_summary,
      communication_style: soulProfile.communication_style,
      interests: soulProfile.interests,
      updated_at: soulProfile.updated_at,
    } : null,
  });
}

async function handleAdminGetWaitlist(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  const query = { accepted: false };
  if (search) query.email = { $regex: search, $options: 'i' };

  const users = await db.collection('users')
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  const profiles = await db.collection('profiles')
    .find({ user_id: { $in: users.map(u => u.id) } })
    .toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  return ok({
    count: users.length,
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      name: profileMap[u.id]?.display_name || u.name || '',
      role: u.role,
      accepted: u.accepted,
      created_at: u.created_at,
      assessment_complete: profileMap[u.id]?.assessment_complete || false,
      onboarding_complete: profileMap[u.id]?.onboarding_complete || false,
    })),
  });
}

async function handleAdminApproveWaitlist(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { user_ids, approve_all } = body;
  const db = await getDb();

  if (approve_all) {
    // Get all waitlisted users first to send emails
    const waitlistedUsers = await db.collection('users').find({ accepted: false }).toArray();
    await db.collection('users').updateMany({ accepted: false }, { $set: { accepted: true } });
    
    // Send acceptance emails (non-blocking)
    for (const user of waitlistedUsers) {
      const profile = await db.collection('profiles').findOne({ user_id: user.id });
      sendAcceptedEmail(user.email, profile?.display_name || null).catch(e => 
        console.error(`Acceptance email failed for ${user.email}:`, e)
      );
    }
    
    return ok({ success: true, message: 'All waitlisted users approved' });
  }

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return err('user_ids array required');
  }

  // Get users before updating to send emails
  const usersToApprove = await db.collection('users').find({ id: { $in: user_ids } }).toArray();
  
  await db.collection('users').updateMany(
    { id: { $in: user_ids } },
    { $set: { accepted: true } }
  );

  // Send acceptance emails (non-blocking)
  for (const user of usersToApprove) {
    const profile = await db.collection('profiles').findOne({ user_id: user.id });
    sendAcceptedEmail(user.email, profile?.display_name || null).catch(e => 
      console.error(`Acceptance email failed for ${user.email}:`, e)
    );
  }

  // Log action
  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'bulk_approve_waitlist',
    metadata: { user_ids },
    created_at: new Date(),
  });

  return ok({ success: true, approved: user_ids.length });
}

async function handleAdminDenyUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  await db.collection('users').updateOne({ id: userId }, { $set: { accepted: false } });

  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'deny_user',
    target_user_id: userId,
    created_at: new Date(),
  });

  return ok({ success: true });
}

async function handleAdminGetMetrics(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const totalUsers = await db.collection('users').countDocuments();
  const wauUsers = await db.collection('users').countDocuments({ last_active_at: { $gte: sevenDaysAgo } });
  const waitlistCount = await db.collection('users').countDocuments({ accepted: false });

  // Multi-session rate
  const usersWithMultiConversations = await db.collection('conversations').aggregate([
    { $group: { _id: '$user_id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'total' },
  ]).toArray();
  const multiSessionCount = usersWithMultiConversations[0]?.total || 0;

  // Day 7 retention
  const usersCreated7DaysAgo = await db.collection('users').countDocuments({
    created_at: { $lte: sevenDaysAgo, $gte: new Date(now - 14 * 24 * 60 * 60 * 1000) },
  });
  const retainedUsers = await db.collection('users').countDocuments({
    created_at: { $lte: sevenDaysAgo },
    last_active_at: { $gte: sevenDaysAgo },
  });
  const day7Retention = usersCreated7DaysAgo > 0
    ? Math.round((retainedUsers / usersCreated7DaysAgo) * 100)
    : 0;

  // Avg sessions per user (7d)
  const conversationsIn7d = await db.collection('conversations').countDocuments({
    created_at: { $gte: sevenDaysAgo },
  });
  const avgSessionsPerUser = wauUsers > 0 ? (conversationsIn7d / wauUsers).toFixed(1) : 0;

  // Messages per session
  const msgAgg = await db.collection('messages').aggregate([
    { $group: { _id: '$conversation_id', count: { $sum: 1 } } },
    { $group: { _id: null, avg: { $avg: '$count' } } },
  ]).toArray();
  const avgMsgPerSession = msgAgg[0]?.avg?.toFixed(1) || 0;

  // Assessment completion rate
  const usersWithCompleteAssessment = await db.collection('profiles').countDocuments({ assessment_complete: true });
  const assessmentRate = totalUsers > 0 ? Math.round((usersWithCompleteAssessment / totalUsers) * 100) : 0;

  // Import adoption rate
  const usersWithImports = await db.collection('import_jobs').distinct('user_id');
  const importRate = totalUsers > 0 ? Math.round((usersWithImports.length / totalUsers) * 100) : 0;

  // ── Telegram Metrics ─────────────────────────────────────────────────────────
  const telegramLinkedUsers = await db.collection('telegram_mappings').countDocuments({ linked: true });
  const telegramConversations = await db.collection('conversations').countDocuments({ source: 'telegram' });
  const telegramMessages = await db.collection('messages').countDocuments({ source: 'telegram' });
  const telegramMessagesLast30d = await db.collection('messages').countDocuments({ 
    source: 'telegram', 
    created_at: { $gte: thirtyDaysAgo } 
  });
  
  // Telegram active users (sent message in last 7 days)
  const telegramActiveUsers7d = await db.collection('messages').aggregate([
    { $match: { source: 'telegram', role: 'user', created_at: { $gte: sevenDaysAgo } } },
    { $lookup: { from: 'conversations', localField: 'conversation_id', foreignField: 'id', as: 'conv' } },
    { $unwind: '$conv' },
    { $group: { _id: '$conv.user_id' } },
    { $count: 'total' }
  ]).toArray();
  const telegramWAU = telegramActiveUsers7d[0]?.total || 0;

  // Total messages (moved up so it's available for telegram breakdown)
  const totalMessages = await db.collection('messages').countDocuments();
  const totalMessagesLast30d = await db.collection('messages').countDocuments({
    created_at: { $gte: thirtyDaysAgo }
  });

  // Web vs Telegram breakdown
  const webMessages = totalMessages - telegramMessages;
  const webMessagesLast30d = totalMessagesLast30d - telegramMessagesLast30d;

  // CSAT
  const thumbsUp = await db.collection('feedback').countDocuments({ rating: 'up' });
  const thumbsDown = await db.collection('feedback').countDocuments({ rating: 'down' });
  const csat = (thumbsUp + thumbsDown) > 0
    ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100)
    : null;

  // Recent signups
  const recentSignups = await db.collection('users').countDocuments({ created_at: { $gte: thirtyDaysAgo } });

  // ── Cost Estimation ──────────────────────────────────────────────────────
  // Pricing per 1M tokens (USD) — approximate mid-2025 rates
  const MODEL_PRICING = {
    // OpenAI latest models
    'gpt-5.2':                       { input: 10.00, output: 30.00 },
    'gpt-5':                         { input: 8.00,  output: 24.00 },
    'o3':                            { input: 15.00, output: 60.00 },
    'o3-mini':                       { input: 1.10,  output: 4.40  },
    'gpt-4.1':                       { input: 2.00,  output: 8.00  },
    'gpt-4.1-mini':                  { input: 0.40,  output: 1.60  },
    'gpt-4o':                        { input: 5.00,  output: 15.00 },
    'gpt-4o-mini':                   { input: 0.15,  output: 0.60  },
    // Anthropic
    'claude-opus-4-5-20251101':      { input: 15.00, output: 75.00 },
    'claude-sonnet-4-5-20250929':    { input: 3.00,  output: 15.00 },
    'claude-3-5-haiku-20241022':     { input: 0.80,  output: 4.00  },
    // Google Gemini
    'gemini-2.5-pro':                { input: 1.25,  output: 10.00 },
    'gemini-2.0-flash':              { input: 0.075, output: 0.30  },
    // Perplexity
    'sonar-pro':                     { input: 3.00,  output: 15.00 },
    'sonar':                         { input: 1.00,  output: 1.00  },
    'sonar-reasoning':               { input: 1.00,  output: 5.00  },
    // Kimi / Moonshot AI pricing (per 1M tokens, converted from CNY to USD)
    'kimi-k2-0711-preview':          { input: 2.00,  output: 8.00  },
    'moonshot-v1-8k':                { input: 1.50,  output: 1.50  },
    'moonshot-v1-32k':               { input: 3.00,  output: 3.00  },
    'moonshot-v1-128k':              { input: 8.00,  output: 8.00  },
  };
  const DEFAULT_PRICING = { input: 5.00, output: 15.00 }; // fallback = gpt-4o rate

  // Aggregate tokens per model from assistant messages that have est_* fields
  const tokensByModel = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true } } },
    {
      $group: {
        _id: '$model_used',
        total_input: { $sum: '$est_input_tokens' },
        total_output: { $sum: '$est_output_tokens' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  // For messages without token tracking, fall back to content-length estimate
  const untrackedMsgs = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: false } } },
    {
      $group: {
        _id: '$model_used',
        total_content_len: { $sum: { $strLenCP: '$content' } },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  const costByModel = {};
  let totalEstCost = 0;

  for (const row of tokensByModel) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    const cost = (row.total_input / 1_000_000) * p.input + (row.total_output / 1_000_000) * p.output;
    costByModel[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    totalEstCost += cost;
  }
  for (const row of untrackedMsgs) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    // Estimate: avg 500 input tokens + output tokens from content
    const estInput = row.count * 500;
    const estOutput = Math.round(row.total_content_len / 4);
    const cost = (estInput / 1_000_000) * p.input + (estOutput / 1_000_000) * p.output;
    if (costByModel[row._id]) {
      costByModel[row._id].cost += parseFloat(cost.toFixed(4));
      costByModel[row._id].messages += row.count;
    } else {
      costByModel[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    }
    totalEstCost += cost;
  }

  // Monthly cost projection (extrapolate from 30d data)
  // totalMessagesLast30d already calculated above
  const acceptedUsers = await db.collection('users').countDocuments({ accepted: true });
  
  // Get active users in last 30 days (users who have sent messages)
  const activeUsersLast30d = await db.collection('users').countDocuments({
    accepted: true,
    last_active_at: { $gte: thirtyDaysAgo }
  });
  
  // Calculate cost for last 30 days only (more accurate monthly projection)
  const tokensLast30d = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true }, created_at: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: '$model_used',
        total_input: { $sum: '$est_input_tokens' },
        total_output: { $sum: '$est_output_tokens' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();
  
  const untrackedLast30d = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: false }, created_at: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: '$model_used',
        total_content_len: { $sum: { $strLenCP: '$content' } },
        count: { $sum: 1 },
      },
    },
  ]).toArray();
  
  // Calculate last 30d cost by model
  const costByModelLast30d = {};
  let totalCostLast30d = 0;
  
  for (const row of tokensLast30d) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    const cost = (row.total_input / 1_000_000) * p.input + (row.total_output / 1_000_000) * p.output;
    costByModelLast30d[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    totalCostLast30d += cost;
  }
  for (const row of untrackedLast30d) {
    const p = MODEL_PRICING[row._id] || DEFAULT_PRICING;
    const estInput = row.count * 500;
    const estOutput = Math.round(row.total_content_len / 4);
    const cost = (estInput / 1_000_000) * p.input + (estOutput / 1_000_000) * p.output;
    if (costByModelLast30d[row._id]) {
      costByModelLast30d[row._id].cost += parseFloat(cost.toFixed(4));
      costByModelLast30d[row._id].messages += row.count;
    } else {
      costByModelLast30d[row._id] = { cost: parseFloat(cost.toFixed(4)), messages: row.count };
    }
    totalCostLast30d += cost;
  }
  
  // Calculate various cost per user metrics
  const avgCostPerMsg = totalMessages > 0 ? totalEstCost / totalMessages : 0;
  const avgCostPerMsgLast30d = totalMessagesLast30d > 0 ? totalCostLast30d / totalMessagesLast30d : 0;
  
  // Cost per user calculations
  const costPerUserAllTime = acceptedUsers > 0 ? parseFloat((totalEstCost / acceptedUsers).toFixed(4)) : 0;
  const costPerActiveUserLast30d = activeUsersLast30d > 0 ? parseFloat((totalCostLast30d / activeUsersLast30d).toFixed(4)) : 0;
  const costPerAcceptedUserLast30d = acceptedUsers > 0 ? parseFloat((totalCostLast30d / acceptedUsers).toFixed(4)) : 0;
  
  // Messages per user
  const messagesPerUserAllTime = acceptedUsers > 0 ? parseFloat((totalMessages / acceptedUsers).toFixed(1)) : 0;
  const messagesPerActiveUserLast30d = activeUsersLast30d > 0 ? parseFloat((totalMessagesLast30d / activeUsersLast30d).toFixed(1)) : 0;

  // ── Media Generation Costs (Kie.ai) ─────────────────────────────────────────
  const mediaCostsByModel = await db.collection('media_gallery').aggregate([
    { $match: { cost_usd: { $exists: true } } },
    {
      $group: {
        _id: { type: '$type', model: '$model' },
        total_cost: { $sum: '$cost_usd' },
        total_credits: { $sum: '$credits_used' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  const mediaCostsLast30d = await db.collection('media_gallery').aggregate([
    { $match: { cost_usd: { $exists: true }, created_at: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { type: '$type', model: '$model' },
        total_cost: { $sum: '$cost_usd' },
        total_credits: { $sum: '$credits_used' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  // Aggregate media costs
  const mediaCostByModel = {};
  let totalMediaCost = 0;
  let totalMediaCount = 0;
  for (const row of mediaCostsByModel) {
    const key = `${row._id.type}:${row._id.model}`;
    mediaCostByModel[key] = {
      type: row._id.type,
      model: row._id.model,
      cost: parseFloat(row.total_cost.toFixed(4)),
      credits: row.total_credits,
      count: row.count,
    };
    totalMediaCost += row.total_cost;
    totalMediaCount += row.count;
  }

  const mediaCostByModelLast30d = {};
  let totalMediaCostLast30d = 0;
  let totalMediaCountLast30d = 0;
  for (const row of mediaCostsLast30d) {
    const key = `${row._id.type}:${row._id.model}`;
    mediaCostByModelLast30d[key] = {
      type: row._id.type,
      model: row._id.model,
      cost: parseFloat(row.total_cost.toFixed(4)),
      credits: row.total_credits,
      count: row.count,
    };
    totalMediaCostLast30d += row.total_cost;
    totalMediaCountLast30d += row.count;
  }

  // Combined totals (LLM + Media)
  const grandTotalCost = totalEstCost + totalMediaCost;
  const grandTotalCostLast30d = totalCostLast30d + totalMediaCostLast30d;

  // Get voice chat metrics (ensure we always have an object)
  let voiceChatMetrics;
  try {
    voiceChatMetrics = await getVoiceChatMetrics(db, sevenDaysAgo, thirtyDaysAgo);
  } catch (voiceErr) {
    console.error('[Admin Metrics] Voice chat metrics error:', voiceErr);
    voiceChatMetrics = {
      total_sessions: 0,
      sessions_7d: 0,
      sessions_30d: 0,
      completed_sessions: 0,
      unique_users: 0,
      total_duration_seconds: 0,
      avg_duration_seconds: 0,
      total_voice_messages: 0,
      avg_messages_per_session: 0,
      voice_distribution: {},
      cost: {
        total_cost_usd: 0,
        cost_last_30d_usd: 0,
        cost_per_minute_usd: 0,
        avg_cost_per_session_usd: 0,
        cost_per_user_usd: 0,
        total_audio_input_tokens: 0,
        total_audio_output_tokens: 0,
        pricing_note: 'Based on gpt-4o-realtime: $40/1M input, $80/1M output audio tokens',
      },
    };
  }

  return ok({
    wau: wauUsers,
    total_users: totalUsers,
    accepted_users: acceptedUsers,
    active_users_30d: activeUsersLast30d,
    waitlist_count: waitlistCount,
    multi_session_rate: totalUsers > 0 ? Math.round((multiSessionCount / totalUsers) * 100) : 0,
    day7_retention: day7Retention,
    avg_sessions_per_user_7d: avgSessionsPerUser,
    avg_messages_per_session: avgMsgPerSession,
    assessment_completion_rate: assessmentRate,
    import_adoption_rate: importRate,
    csat,
    recent_signups_30d: recentSignups,
    total_messages: totalMessages,
    total_messages_30d: totalMessagesLast30d,
    thumbs_up: thumbsUp,
    thumbs_down: thumbsDown,
    // Cost metrics - All Time
    est_total_cost: parseFloat(totalEstCost.toFixed(4)),
    est_cost_per_user_all_time: costPerUserAllTime,
    avg_cost_per_message: parseFloat(avgCostPerMsg.toFixed(6)),
    cost_by_model: costByModel,
    messages_per_user_all_time: messagesPerUserAllTime,
    // Cost metrics - Last 30 Days
    est_total_cost_30d: parseFloat(totalCostLast30d.toFixed(4)),
    est_cost_per_active_user_30d: costPerActiveUserLast30d,
    est_cost_per_user_30d: costPerAcceptedUserLast30d,
    avg_cost_per_message_30d: parseFloat(avgCostPerMsgLast30d.toFixed(6)),
    cost_by_model_30d: costByModelLast30d,
    messages_per_active_user_30d: messagesPerActiveUserLast30d,
    // Media generation costs (Kie.ai)
    media_cost_total: parseFloat(totalMediaCost.toFixed(4)),
    media_cost_30d: parseFloat(totalMediaCostLast30d.toFixed(4)),
    media_count_total: totalMediaCount,
    media_count_30d: totalMediaCountLast30d,
    media_cost_by_model: mediaCostByModel,
    media_cost_by_model_30d: mediaCostByModelLast30d,
    // Grand totals (LLM + Media)
    grand_total_cost: parseFloat(grandTotalCost.toFixed(4)),
    grand_total_cost_30d: parseFloat(grandTotalCostLast30d.toFixed(4)),
    // Telegram metrics
    telegram: {
      linked_users: telegramLinkedUsers,
      conversations: telegramConversations,
      messages_total: telegramMessages,
      messages_30d: telegramMessagesLast30d,
      weekly_active_users: telegramWAU,
      adoption_rate: totalUsers > 0 ? Math.round((telegramLinkedUsers / totalUsers) * 100) : 0,
    },
    // Platform breakdown
    platform_breakdown: {
      web: {
        messages_total: webMessages,
        messages_30d: webMessagesLast30d,
      },
      telegram: {
        messages_total: telegramMessages,
        messages_30d: telegramMessagesLast30d,
      },
    },
    // Voice chat metrics (from voice_sessions collection)
    voice_chat: voiceChatMetrics,
    // Legacy (for backwards compatibility)
    est_cost_per_user_month: costPerAcceptedUserLast30d,
    est_projected_monthly_cost: parseFloat(totalCostLast30d.toFixed(4)),
  });
}

// Helper function to get voice chat metrics for admin dashboard
async function getVoiceChatMetrics(db, sevenDaysAgo, thirtyDaysAgo) {
  try {
    const totalSessions = await db.collection('voice_sessions').countDocuments();
    const sessionsLast7d = await db.collection('voice_sessions').countDocuments({ 
      created_at: { $gte: sevenDaysAgo } 
    });
    const sessionsLast30d = await db.collection('voice_sessions').countDocuments({ 
      created_at: { $gte: thirtyDaysAgo } 
    });
    
    const completedSessions = await db.collection('voice_sessions').countDocuments({ 
      status: 'completed' 
    });
    
    // Unique users who have used voice chat
    const uniqueVoiceUsers = await db.collection('voice_sessions').distinct('user_id');
    
    // Aggregate duration, message, and cost stats
    const stats = await db.collection('voice_sessions').aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          total_duration: { $sum: '$duration_seconds' },
          avg_duration: { $avg: '$duration_seconds' },
          total_messages: { $sum: '$message_count' },
          avg_messages: { $avg: '$message_count' },
          total_input_tokens: { $sum: { $ifNull: ['$audio_input_tokens', 0] } },
          total_output_tokens: { $sum: { $ifNull: ['$audio_output_tokens', 0] } },
          total_cost: { $sum: { $ifNull: ['$estimated_cost_usd', 0] } },
        }
      }
    ]).toArray();
    
    const aggregateStats = stats[0] || {
      total_duration: 0,
      avg_duration: 0,
      total_messages: 0,
      avg_messages: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost: 0,
    };
    
    // Cost stats for last 30 days
    const costStats30d = await db.collection('voice_sessions').aggregate([
      { $match: { status: 'completed', created_at: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          total_cost: { $sum: { $ifNull: ['$estimated_cost_usd', 0] } },
          total_duration: { $sum: '$duration_seconds' },
        }
      }
    ]).toArray();
    
    const cost30d = costStats30d[0] || { total_cost: 0, total_duration: 0 };
    
    // Voice distribution
    const voiceDistribution = await db.collection('voice_sessions').aggregate([
      { $group: { _id: '$voice', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    // Calculate cost per minute
    const totalMinutes = aggregateStats.total_duration / 60;
    const costPerMinute = totalMinutes > 0 ? aggregateStats.total_cost / totalMinutes : 0;
    
    // Calculate average cost per session
    const avgCostPerSession = completedSessions > 0 ? aggregateStats.total_cost / completedSessions : 0;
    
    // Calculate cost per user
    const costPerUser = uniqueVoiceUsers.length > 0 ? aggregateStats.total_cost / uniqueVoiceUsers.length : 0;
    
    return {
      total_sessions: totalSessions,
      sessions_7d: sessionsLast7d,
      sessions_30d: sessionsLast30d,
      completed_sessions: completedSessions,
      unique_users: uniqueVoiceUsers.length,
      total_duration_seconds: aggregateStats.total_duration,
      avg_duration_seconds: Math.round(aggregateStats.avg_duration || 0),
      total_voice_messages: aggregateStats.total_messages,
      avg_messages_per_session: Math.round(aggregateStats.avg_messages || 0),
      voice_distribution: voiceDistribution.reduce((acc, v) => {
        acc[v._id || 'unknown'] = v.count;
        return acc;
      }, {}),
      // Cost metrics for pricing decisions
      cost: {
        total_cost_usd: parseFloat(aggregateStats.total_cost.toFixed(2)),
        cost_last_30d_usd: parseFloat(cost30d.total_cost.toFixed(2)),
        cost_per_minute_usd: parseFloat(costPerMinute.toFixed(4)),
        avg_cost_per_session_usd: parseFloat(avgCostPerSession.toFixed(4)),
        cost_per_user_usd: parseFloat(costPerUser.toFixed(4)),
        total_audio_input_tokens: aggregateStats.total_input_tokens,
        total_audio_output_tokens: aggregateStats.total_output_tokens,
        // Pricing reference
        pricing_note: 'Based on gpt-4o-realtime: $40/1M input, $80/1M output audio tokens',
      },
    };
  } catch (err) {
    console.error('Voice metrics error:', err);
    return {
      total_sessions: 0,
      sessions_7d: 0,
      sessions_30d: 0,
      completed_sessions: 0,
      unique_users: 0,
      total_duration_seconds: 0,
      avg_duration_seconds: 0,
      total_voice_messages: 0,
      avg_messages_per_session: 0,
      voice_distribution: {},
      cost: {
        total_cost_usd: 0,
        cost_last_30d_usd: 0,
        cost_per_minute_usd: 0,
        avg_cost_per_session_usd: 0,
        cost_per_user_usd: 0,
        total_audio_input_tokens: 0,
        total_audio_output_tokens: 0,
        pricing_note: 'Based on gpt-4o-realtime: $40/1M input, $80/1M output audio tokens',
      },
    };
  }
}

async function handleAdminGetQuestions(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const questions = await db.collection('assessment_questions')
    .find({})
    .sort({ order_index: 1 })
    .toArray();

  return ok(questions);
}

// Export users for email campaigns
async function handleAdminExportUsers(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'json'; // json or csv
  const filter = url.searchParams.get('filter') || 'all'; // all, beta, invited, organic, google
  const discovery = url.searchParams.get('discovery') || ''; // specific discovery source
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');
  const hasMessages = url.searchParams.get('has_messages'); // true/false
  const onboardingComplete = url.searchParams.get('onboarding_complete'); // true/false

  const db = await getDb();
  
  // Build query
  const query = { accepted: true };
  
  // Filter by user type
  if (filter === 'beta') {
    query.beta_code_used = { $exists: true, $ne: null };
  } else if (filter === 'invited') {
    query.invited_by = { $exists: true, $ne: null };
  } else if (filter === 'organic') {
    query.$and = [
      { $or: [{ beta_code_used: { $exists: false } }, { beta_code_used: null }] },
      { $or: [{ invited_by: { $exists: false } }, { invited_by: null }] }
    ];
  } else if (filter === 'google') {
    query.auth_provider = 'google';
  }
  
  // Filter by date range
  if (dateFrom || dateTo) {
    query.created_at = {};
    if (dateFrom) query.created_at.$gte = new Date(dateFrom);
    if (dateTo) query.created_at.$lte = new Date(dateTo + 'T23:59:59.999Z');
  }

  // Get users
  const users = await db.collection('users')
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  // Get profiles for discovery source and onboarding status
  const userIds = users.map(u => u.id);
  const profiles = await db.collection('profiles')
    .find({ user_id: { $in: userIds } })
    .toArray();
  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

  // Get message counts if filtering by engagement
  let messageCounts = {};
  if (hasMessages) {
    const msgAgg = await db.collection('messages').aggregate([
      { $match: { user_id: { $in: userIds }, role: 'user' } },
      { $group: { _id: '$user_id', count: { $sum: 1 } } }
    ]).toArray();
    messageCounts = Object.fromEntries(msgAgg.map(m => [m._id, m.count]));
  }

  // Build export data
  let exportData = users.map(u => {
    const profile = profileMap[u.id] || {};
    const msgCount = messageCounts[u.id] || 0;
    
    // Determine acquisition channel
    let acquisitionChannel = 'unknown';
    if (u.invited_by) {
      acquisitionChannel = 'invite';
    } else if (u.beta_code_used) {
      acquisitionChannel = 'beta_code';
    } else if (u.auth_provider === 'google') {
      acquisitionChannel = 'google_auth';
    } else if (profile.discovery_source) {
      acquisitionChannel = profile.discovery_source;
    } else {
      acquisitionChannel = 'organic';
    }

    return {
      email: u.email,
      display_name: profile.display_name || '',
      created_at: u.created_at,
      last_active_at: u.last_active_at,
      acquisition_channel: acquisitionChannel,
      beta_code_used: u.beta_code_used || '',
      invited_by: u.invited_by ? 'Yes' : 'No',
      auth_provider: u.auth_provider || 'legacy',
      discovery_source: profile.discovery_source || '',
      onboarding_complete: profile.onboarding_complete ? 'Yes' : 'No',
      assessment_complete: profile.assessment_complete ? 'Yes' : 'No',
      message_count: msgCount,
      field: profile.field || '',
      assistant_name: profile.assistant_name || 'SoulPrint',
    };
  });

  // Apply additional filters
  if (discovery) {
    exportData = exportData.filter(u => 
      u.discovery_source.toLowerCase().includes(discovery.toLowerCase()) ||
      u.acquisition_channel.toLowerCase().includes(discovery.toLowerCase())
    );
  }
  
  if (hasMessages === 'true') {
    exportData = exportData.filter(u => u.message_count > 0);
  } else if (hasMessages === 'false') {
    exportData = exportData.filter(u => u.message_count === 0);
  }
  
  if (onboardingComplete === 'true') {
    exportData = exportData.filter(u => u.onboarding_complete === 'Yes');
  } else if (onboardingComplete === 'false') {
    exportData = exportData.filter(u => u.onboarding_complete === 'No');
  }

  // Generate summary stats
  const stats = {
    total: exportData.length,
    by_channel: {},
    by_discovery: {},
    engaged: exportData.filter(u => u.message_count > 0).length,
    onboarded: exportData.filter(u => u.onboarding_complete === 'Yes').length,
  };
  
  exportData.forEach(u => {
    stats.by_channel[u.acquisition_channel] = (stats.by_channel[u.acquisition_channel] || 0) + 1;
    if (u.discovery_source) {
      stats.by_discovery[u.discovery_source] = (stats.by_discovery[u.discovery_source] || 0) + 1;
    }
  });

  // Return as CSV or JSON
  if (format === 'csv') {
    const headers = ['email', 'display_name', 'created_at', 'last_active_at', 'acquisition_channel', 
                     'beta_code_used', 'invited_by', 'auth_provider', 'discovery_source', 
                     'onboarding_complete', 'assessment_complete', 'message_count', 'field', 'assistant_name'];
    
    const csvRows = [headers.join(',')];
    exportData.forEach(row => {
      const values = headers.map(h => {
        let val = row[h] || '';
        if (val instanceof Date) val = val.toISOString();
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      });
      csvRows.push(values.join(','));
    });
    
    return new Response(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="soulprint_users_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return ok({
    stats,
    users: exportData,
  });
}

// Get available filter options for export
async function handleAdminGetExportFilters(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  // Get unique discovery sources
  const profiles = await db.collection('profiles').find({}).toArray();
  const discoverySources = [...new Set(profiles.map(p => p.discovery_source).filter(Boolean))];
  
  // Get unique auth providers
  const users = await db.collection('users').find({ accepted: true }).toArray();
  const authProviders = [...new Set(users.map(u => u.auth_provider).filter(Boolean))];
  
  // Get beta codes used
  const betaCodes = [...new Set(users.map(u => u.beta_code_used).filter(Boolean))];
  
  // Count by acquisition channel
  const channelCounts = {
    all: users.length,
    beta: users.filter(u => u.beta_code_used).length,
    invited: users.filter(u => u.invited_by).length,
    google: users.filter(u => u.auth_provider === 'google').length,
    organic: users.filter(u => !u.beta_code_used && !u.invited_by && u.auth_provider !== 'google').length,
  };

  return ok({
    discovery_sources: discoverySources,
    auth_providers: authProviders,
    beta_codes: betaCodes,
    channel_counts: channelCounts,
  });
}

async function handleAdminSeedQuestions(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  await db.collection('assessment_questions').deleteMany({});
  await seedQuestions(db);

  return ok({ success: true, count: SEED_QUESTIONS.length });
}

async function handleAdminUpdateQuestion(request, questionId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  const update = {};
  if (body.question_text !== undefined) update.question_text = body.question_text;
  if (body.active !== undefined) update.active = body.active;

  await db.collection('assessment_questions').updateOne({ id: questionId }, { $set: update });
  return ok({ success: true });
}

async function handleAdminGetConversations(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  const db = await getDb();
  const total = await db.collection('conversations').countDocuments();
  const conversations = await db.collection('conversations')
    .find({})
    .sort({ updated_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  const userIds = [...new Set(conversations.map(c => c.user_id))];
  const users = await db.collection('users').find({ id: { $in: userIds } }).toArray();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  // Privacy: Generate topic categories instead of showing actual titles
  const conversationsWithTopics = conversations.map(c => {
    // Use stored topic if available, otherwise generate from title
    const topic = c.topic || categorizeConversationTopic(c.title);
    return {
      id: c.id,
      topic: topic, // Privacy-safe topic category
      user_email: userMap[c.user_id]?.email || 'unknown',
      user_id: c.user_id,
      message_count: c.message_count || 0,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  });

  return ok({
    conversations: conversationsWithTopics,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

// Privacy helper: Categorize conversation into a general topic (doesn't expose actual content)
function categorizeConversationTopic(title) {
  if (!title) return 'General Chat';
  const lower = title.toLowerCase();
  
  // Coding & Tech
  if (/\b(code|coding|programming|javascript|python|react|api|debug|error|function|bug|deploy|database|sql|html|css|git)\b/.test(lower)) {
    return '💻 Coding & Development';
  }
  // Writing & Content
  if (/\b(write|writing|draft|email|blog|article|essay|content|copy|edit|proofread|story|poem)\b/.test(lower)) {
    return '✍️ Writing & Content';
  }
  // Business & Work
  if (/\b(business|work|meeting|project|strategy|marketing|sales|startup|pitch|investor|client|presentation)\b/.test(lower)) {
    return '💼 Business & Work';
  }
  // Research & Learning
  if (/\b(research|learn|study|explain|understand|how does|what is|why|teach|tutorial|course)\b/.test(lower)) {
    return '📚 Research & Learning';
  }
  // Creative & Design
  if (/\b(design|creative|art|image|logo|brand|color|style|ui|ux|graphic|video|animation)\b/.test(lower)) {
    return '🎨 Creative & Design';
  }
  // Travel & Places
  if (/\b(travel|trip|vacation|hotel|flight|restaurant|visit|tour|city|country|location|nearby)\b/.test(lower)) {
    return '✈️ Travel & Places';
  }
  // Health & Wellness
  if (/\b(health|fitness|workout|diet|medical|doctor|symptom|exercise|wellness|mental|therapy)\b/.test(lower)) {
    return '🏥 Health & Wellness';
  }
  // Finance & Money
  if (/\b(money|finance|invest|stock|crypto|budget|save|price|cost|salary|tax|bank)\b/.test(lower)) {
    return '💰 Finance & Money';
  }
  // Social Media
  if (/\b(twitter|instagram|linkedin|tiktok|facebook|post|caption|social media|viral|followers)\b/.test(lower)) {
    return '📱 Social Media';
  }
  // News & Current Events
  if (/\b(news|today|current|latest|2024|2025|2026|happened|event|update|trending)\b/.test(lower)) {
    return '📰 News & Current Events';
  }
  // Personal & Life
  if (/\b(personal|life|family|relationship|friend|advice|help me|feeling|emotion)\b/.test(lower)) {
    return '🌟 Personal & Life';
  }
  // Images & Media
  if (/\b(image|picture|photo|generate|create|draw|illustration|video|animation)\b/.test(lower)) {
    return '🖼️ Image & Media Generation';
  }
  
  return '💬 General Chat';
}

async function handleAdminGetImports(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const imports = await db.collection('import_jobs')
    .find({})
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();

  const userIds = [...new Set(imports.map(i => i.user_id))];
  const users = await db.collection('users').find({ id: { $in: userIds } }).toArray();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return ok(imports.map(i => ({
    id: i.id,
    type: i.type,
    status: i.status,
    file_name: i.file_name,
    error: i.error,
    user_email: userMap[i.user_id]?.email || 'unknown',
    created_at: i.created_at,
    updated_at: i.updated_at,
  })));
}

async function handleAdminGetSettings(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });

  return ok(settings || {
    default_model: 'gpt-4o',
    default_provider: 'hosted',
    available_models: AVAILABLE_MODELS,
    waitlist_enabled: true,
  });
}

async function handleAdminUpdateSettings(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const db = await getDb();

  await db.collection('settings').updateOne(
    { id: 'global' },
    { $set: { ...body, id: 'global', updated_at: new Date() } },
    { upsert: true }
  );

  return ok({ success: true });
}

// Public endpoint to check feature flags (no admin required, but requires auth)
async function handleGetFeatureFlags(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });

  // Only expose safe feature flags to users
  return ok({
    voice_chat_enabled: settings?.voice_chat_enabled !== false, // Default to true if not set
    viral_invites_enabled: settings?.viral_invites_enabled === true,
  });
}

// ============================================================

// ============================================================
// VIRAL INVITE SYSTEM
// ============================================================

// VIRAL INVITE SYSTEM
// ============================================================

// Generate a unique invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like O, 0, I, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if viral invites are enabled
async function isViralInvitesEnabled() {
  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });
  return settings?.viral_invites_enabled === true;
}

// Get user's invite info
async function handleGetUserInvites(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Check if viral invites are enabled
  const enabled = await isViralInvitesEnabled();
  if (!enabled) {
    return ok({ enabled: false });
  }

  // Get user's invite data
  const userData = await db.collection('users').findOne({ id: user.id });
  
  // Initialize invite code if user doesn't have one
  let inviteCode = userData?.invite_code;
  if (!inviteCode) {
    inviteCode = generateInviteCode();
    await db.collection('users').updateOne(
      { id: user.id },
      { 
        $set: { 
          invite_code: inviteCode,
          invites_remaining: userData?.invites_remaining ?? 5,
          invites_used: userData?.invites_used ?? 0,
        } 
      }
    );
  }

  // Get list of people this user has invited
  const invitedUsers = await db.collection('users')
    .find({ invited_by: user.id })
    .project({ id: 1, email: 1, created_at: 1 })
    .toArray();

  // Get inviter info if this user was invited
  let invitedBy = null;
  if (userData?.invited_by) {
    const inviter = await db.collection('users').findOne({ id: userData.invited_by });
    if (inviter) {
      const inviterProfile = await db.collection('profiles').findOne({ user_id: inviter.id });
      invitedBy = {
        id: inviter.id,
        name: inviterProfile?.display_name || inviter.email.split('@')[0],
      };
    }
  }

  // Check for invite badges
  const badges = userData?.badges || [];
  const inviteBadges = [
    { id: 'first_invite', name: 'First Invite', description: 'Invited your first friend', threshold: 1, icon: '🌟' },
    { id: 'social_butterfly', name: 'Social Butterfly', description: 'Invited 5 friends', threshold: 5, icon: '🦋' },
    { id: 'community_builder', name: 'Community Builder', description: 'Invited 10 friends', threshold: 10, icon: '🏗️' },
    { id: 'influencer', name: 'Influencer', description: 'Invited 25 friends', threshold: 25, icon: '⭐' },
  ];

  const earnedBadges = inviteBadges.filter(b => (userData?.invites_used || 0) >= b.threshold);

  return ok({
    enabled: true,
    invite_code: inviteCode,
    invites_remaining: userData?.invites_remaining ?? 5,
    invites_used: userData?.invites_used ?? 0,
    invited_users: invitedUsers.map(u => ({
      email: u.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Partially mask email
      joined_at: u.created_at,
    })),
    invited_by: invitedBy,
    badges: earnedBadges,
    all_badges: inviteBadges,
  });
}

// Validate an invite code (public endpoint - no auth required)
async function handleValidateInviteCode(request) {
  const { code } = await request.json();
  if (!code) return err('Invite code required');

  const db = await getDb();
  
  // Check if viral invites are enabled
  const enabled = await isViralInvitesEnabled();
  if (!enabled) {
    return err('Invite program is not currently active', 400);
  }

  // Find user with this invite code
  const inviter = await db.collection('users').findOne({ 
    invite_code: code.toUpperCase().trim() 
  });

  if (!inviter) {
    return err('Invalid invite code', 404);
  }

  // Check if inviter has remaining invites
  if ((inviter.invites_remaining ?? 0) <= 0) {
    return err('This invite code has no remaining uses', 400);
  }

  // Get inviter's profile for display
  const inviterProfile = await db.collection('profiles').findOne({ user_id: inviter.id });
  
  return ok({
    valid: true,
    inviter_name: inviterProfile?.display_name || inviter.email.split('@')[0],
    invites_remaining: inviter.invites_remaining,
  });
}

// Redeem an invite code during registration
async function handleRedeemInviteCode(request) {
  const { code, email, passcode } = await request.json();
  if (!code || !email || !passcode) return err('Code, email and passcode required');

  const db = await getDb();
  
  // Check if viral invites are enabled
  const enabled = await isViralInvitesEnabled();
  if (!enabled) {
    return err('Invite program is not currently active', 400);
  }

  // Check if email already exists
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already registered');

  // Find inviter
  const inviter = await db.collection('users').findOne({ 
    invite_code: code.toUpperCase().trim() 
  });

  if (!inviter) {
    return err('Invalid invite code', 404);
  }

  if ((inviter.invites_remaining ?? 0) <= 0) {
    return err('This invite code has no remaining uses', 400);
  }

  // Create new user
  const userId = uuidv4();
  const hashed = await hashPassword(passcode);
  const now = new Date();
  const newInviteCode = generateInviteCode();

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role: 'user',
    accepted: true, // Auto-accept invited users
    created_at: now,
    last_active_at: now,
    invited_by: inviter.id,
    invite_code: newInviteCode,
    invites_remaining: 5, // New users also get 5 invites
    invites_used: 0,
    badges: [],
    auth_provider: 'invite',
  });

  // Decrement inviter's remaining invites and increment used count
  const newInvitesUsed = (inviter.invites_used || 0) + 1;
  
  // Check and award badges
  const badgesToAward = [];
  if (newInvitesUsed === 1) badgesToAward.push({ id: 'first_invite', awarded_at: now });
  if (newInvitesUsed === 5) badgesToAward.push({ id: 'social_butterfly', awarded_at: now });
  if (newInvitesUsed === 10) badgesToAward.push({ id: 'community_builder', awarded_at: now });
  if (newInvitesUsed === 25) badgesToAward.push({ id: 'influencer', awarded_at: now });

  const updateOps = {
    $inc: { invites_remaining: -1, invites_used: 1 },
  };
  
  if (badgesToAward.length > 0) {
    updateOps.$push = { badges: { $each: badgesToAward } };
  }

  await db.collection('users').updateOne(
    { id: inviter.id },
    updateOps
  );

  // Record the invite redemption
  await db.collection('invite_redemptions').insertOne({
    id: uuidv4(),
    inviter_id: inviter.id,
    invitee_id: userId,
    invitee_email: email.toLowerCase(),
    invite_code: code.toUpperCase().trim(),
    redeemed_at: now,
  });

  // Create empty profile for new user
  await db.collection('profiles').insertOne({
    user_id: userId,
    display_name: '',
    assistant_name: 'SoulPrint',
    descriptors: [],
    field: '',
    help_with: [],
    discovery_source: 'invite',
    soul_profile_summary: '',
    onboarding_complete: false,
    assessment_complete: false,
    created_at: now,
  });

  const token = generateToken(userId);

  // Send welcome email (non-blocking)
  sendWelcomeEmail(email, null).catch(e => console.error('Welcome email failed:', e));

  return ok({
    token,
    userId,
    role: 'user',
    accepted: true,
    onboarding_complete: false,
    assessment_complete: false,
    invite_code: newInviteCode, // Their own invite code
  });
}

// Admin: Get viral invite stats
async function handleAdminGetInviteStats(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  const settings = await db.collection('settings').findOne({ id: 'global' });
  const enabled = settings?.viral_invites_enabled === true;

  // Get aggregate stats
  const totalInvitesSent = await db.collection('invite_redemptions').countDocuments();
  const usersWithInvites = await db.collection('users').countDocuments({ invites_remaining: { $gt: 0 } });
  const totalInvitesAvailable = await db.collection('users').aggregate([
    { $group: { _id: null, total: { $sum: '$invites_remaining' } } }
  ]).toArray();

  // Top inviters
  const topInviters = await db.collection('users')
    .find({ invites_used: { $gt: 0 } })
    .sort({ invites_used: -1 })
    .limit(10)
    .project({ id: 1, email: 1, invites_used: 1, badges: 1 })
    .toArray();

  // Recent invite activity
  const recentInvites = await db.collection('invite_redemptions')
    .find()
    .sort({ redeemed_at: -1 })
    .limit(20)
    .toArray();

  return ok({
    enabled,
    stats: {
      total_invites_sent: totalInvitesSent,
      users_with_invites: usersWithInvites,
      total_invites_available: totalInvitesAvailable[0]?.total || 0,
    },
    top_inviters: topInviters.map(u => ({
      email: u.email,
      invites_used: u.invites_used,
      badges: u.badges?.length || 0,
    })),
    recent_invites: recentInvites.map(r => ({
      invitee_email: r.invitee_email?.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      redeemed_at: r.redeemed_at,
    })),
  });
}

// Admin: Toggle viral invites on/off
async function handleAdminToggleViralInvites(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { enabled } = await request.json();
  const db = await getDb();

  await db.collection('settings').updateOne(
    { id: 'global' },
    { $set: { viral_invites_enabled: enabled === true, updated_at: new Date() } },
    { upsert: true }
  );

  // If enabling for the first time, give all existing users their invite codes
  if (enabled) {
    const usersWithoutCodes = await db.collection('users')
      .find({ invite_code: { $exists: false } })
      .toArray();
    
    for (const user of usersWithoutCodes) {
      await db.collection('users').updateOne(
        { id: user.id },
        { 
          $set: { 
            invite_code: generateInviteCode(),
            invites_remaining: 5,
            invites_used: 0,
          } 
        }
      );
    }
  }

  return ok({ success: true, enabled: enabled === true });
}

// Admin: Grant more invites to a user
async function handleAdminGrantInvites(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const { user_id, amount } = await request.json();
  if (!user_id || !amount) return err('User ID and amount required');

  const db = await getDb();
  
  await db.collection('users').updateOne(
    { id: user_id },
    { $inc: { invites_remaining: parseInt(amount) } }
  );

  return ok({ success: true });
}

// ============================================================

// ============================================================
// PRICING FEATURES
// ============================================================

// PRICING FEATURES MANAGEMENT
// ============================================================

// Get all pricing features (current and future)
async function handleAdminGetPricingFeatures(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const features = await db.collection('pricing_features')
    .find({})
    .sort({ tier: 1, order: 1 })
    .toArray();

  return ok(features);
}

// Add a new pricing feature
async function handleAdminAddPricingFeature(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const data = await request.json();
  const { name, description, tier, cost_type, cost_value, status, category } = data;

  if (!name || !tier) {
    return err('Name and tier are required');
  }

  const db = await getDb();
  const id = uuidv4();

  const feature = {
    id,
    name,
    description: description || '',
    tier, // 'free', 'basic', 'pro', 'enterprise', 'addon'
    cost_type: cost_type || 'per_user', // 'per_user', 'per_message', 'per_use', 'fixed', 'percentage'
    cost_value: parseFloat(cost_value) || 0, // cost in dollars
    status: status || 'planned', // 'active', 'planned', 'considering'
    category: category || 'feature', // 'feature', 'integration', 'limit', 'support'
    created_at: new Date(),
    updated_at: new Date(),
  };

  await db.collection('pricing_features').insertOne(feature);

  return ok(feature);
}

// Update a pricing feature
async function handleAdminUpdatePricingFeature(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const data = await request.json();
  const { id, ...updates } = data;

  if (!id) return err('Feature ID required');

  const db = await getDb();
  
  await db.collection('pricing_features').updateOne(
    { id },
    { 
      $set: { 
        ...updates,
        updated_at: new Date() 
      } 
    }
  );

  return ok({ success: true });
}

// Delete a pricing feature
async function handleAdminDeletePricingFeature(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) return err('Feature ID required');

  const db = await getDb();
  await db.collection('pricing_features').deleteOne({ id });

  return ok({ success: true });
}

// Calculate pricing with custom features
async function handleAdminCalculatePricing(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  
  // Get all features
  const features = await db.collection('pricing_features')
    .find({})
    .toArray();

  // Get base costs from actual usage
  const totalCostAgg = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true } } },
    { $group: { _id: null, input: { $sum: '$est_input_tokens' }, output: { $sum: '$est_output_tokens' } } },
  ]).toArray();
  
  const userCount = await db.collection('users').countDocuments({ accepted: true }) || 1;
  const totalLLMCost = totalCostAgg.length > 0
    ? (totalCostAgg[0].input / 1_000_000) * 5 + (totalCostAgg[0].output / 1_000_000) * 15
    : 0;
  const baseCostPerUser = totalLLMCost / userCount;

  // Calculate tier costs including custom features
  const tierCosts = {
    free: { base: baseCostPerUser * 0.3, features: [], total: 0 },
    basic: { base: baseCostPerUser * 0.7, features: [], total: 0 },
    pro: { base: baseCostPerUser * 1.2, features: [], total: 0 },
    enterprise: { base: baseCostPerUser * 3, features: [], total: 0 },
  };

  // Add feature costs to each tier
  features.forEach(f => {
    if (f.tier === 'addon') return; // Skip addons for tier calculation
    
    const featureCost = f.cost_type === 'per_user' ? f.cost_value : 
                        f.cost_type === 'fixed' ? f.cost_value / userCount :
                        f.cost_value * 0.1; // Estimate for per_message/per_use

    if (tierCosts[f.tier]) {
      tierCosts[f.tier].features.push({
        name: f.name,
        cost: featureCost,
        status: f.status,
      });
    }
    
    // Features accumulate up the tiers (basic includes free features, etc.)
    if (f.tier === 'free') {
      ['basic', 'pro', 'enterprise'].forEach(t => {
        tierCosts[t].features.push({ name: f.name, cost: featureCost, status: f.status, inherited: true });
      });
    } else if (f.tier === 'basic') {
      ['pro', 'enterprise'].forEach(t => {
        tierCosts[t].features.push({ name: f.name, cost: featureCost, status: f.status, inherited: true });
      });
    } else if (f.tier === 'pro') {
      tierCosts.enterprise.features.push({ name: f.name, cost: featureCost, status: f.status, inherited: true });
    }
  });

  // Calculate totals
  Object.keys(tierCosts).forEach(tier => {
    const featureCostSum = tierCosts[tier].features.reduce((sum, f) => sum + f.cost, 0);
    tierCosts[tier].total = tierCosts[tier].base + featureCostSum;
  });

  // Calculate recommended prices at different margins
  const calculatePrice = (cost, margin) => cost / (1 - margin);

  const pricingTable = {};
  Object.entries(tierCosts).forEach(([tier, data]) => {
    pricingTable[tier] = {
      base_cost: parseFloat(data.base.toFixed(2)),
      feature_cost: parseFloat(data.features.reduce((sum, f) => sum + f.cost, 0).toFixed(2)),
      total_cost: parseFloat(data.total.toFixed(2)),
      features: data.features,
      prices: {
        at_70_margin: parseFloat(calculatePrice(data.total, 0.70).toFixed(2)),
        at_80_margin: parseFloat(calculatePrice(data.total, 0.80).toFixed(2)),
        at_90_margin: parseFloat(calculatePrice(data.total, 0.90).toFixed(2)),
      },
    };
  });

  // Addon pricing
  const addons = features.filter(f => f.tier === 'addon').map(f => ({
    ...f,
    recommended_price: parseFloat((f.cost_value / 0.2).toFixed(2)), // 80% margin on addons
  }));

  return ok({
    tier_costs: pricingTable,
    addons,
    base_cost_per_user: parseFloat(baseCostPerUser.toFixed(2)),
    total_users: userCount,
  });
}

// ============================================================

// ============================================================
// BUSINESS INSIGHTS
// ============================================================

// BUSINESS INSIGHTS & PRICING ANALYTICS
// ============================================================

// Get detailed business insights for pricing decisions
async function handleAdminGetBusinessInsights(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

  // ── USER SEGMENTATION BY USAGE ─────────────────────────────────────────────
  // Get message counts per user for segmentation
  const userMessageCounts = await db.collection('messages').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$user_id', message_count: { $sum: 1 } } },
  ]).toArray();

  const userCountMap = {};
  userMessageCounts.forEach(u => { userCountMap[u._id] = u.message_count; });

  // Define usage tiers
  const usageSegments = {
    inactive: { min: 0, max: 0, count: 0, users: [] },      // 0 messages
    light: { min: 1, max: 20, count: 0, users: [] },        // 1-20 messages
    moderate: { min: 21, max: 100, count: 0, users: [] },   // 21-100 messages
    heavy: { min: 101, max: 500, count: 0, users: [] },     // 101-500 messages
    power: { min: 501, max: Infinity, count: 0, users: [] } // 500+ messages
  };

  // Get all accepted users
  const allUsers = await db.collection('users')
    .find({ accepted: true })
    .project({ id: 1, email: 1, created_at: 1, last_active_at: 1 })
    .toArray();

  allUsers.forEach(user => {
    const msgCount = userCountMap[user.id] || 0;
    for (const [tier, config] of Object.entries(usageSegments)) {
      if (msgCount >= config.min && msgCount <= config.max) {
        config.count++;
        if (config.users.length < 5) { // Keep top 5 examples per tier
          config.users.push({ email: user.email, messages: msgCount });
        }
        break;
      }
    }
  });

  // Sort users in each segment by message count
  Object.values(usageSegments).forEach(seg => {
    seg.users.sort((a, b) => b.messages - a.messages);
  });

  // ── TOP USERS (POTENTIAL ENTERPRISE) ───────────────────────────────────────
  const topUsers = await db.collection('messages').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$user_id', message_count: { $sum: 1 } } },
    { $sort: { message_count: -1 } },
    { $limit: 20 },
  ]).toArray();

  // Enrich with user data and costs
  const enrichedTopUsers = [];
  for (const u of topUsers) {
    const user = await db.collection('users').findOne({ id: u._id });
    const profile = await db.collection('profiles').findOne({ user_id: u._id });
    
    // Calculate user's cost
    const userCostAgg = await db.collection('messages').aggregate([
      { $match: { user_id: u._id, role: 'assistant', est_input_tokens: { $exists: true } } },
      { $group: { _id: null, input: { $sum: '$est_input_tokens' }, output: { $sum: '$est_output_tokens' } } },
    ]).toArray();
    
    // Estimate cost at $5/1M input, $15/1M output (avg rate)
    const userCost = userCostAgg.length > 0 
      ? (userCostAgg[0].input / 1_000_000) * 5 + (userCostAgg[0].output / 1_000_000) * 15
      : 0;

    // Get media generation count
    const mediaCount = await db.collection('media_gallery').countDocuments({ user_id: u._id });

    enrichedTopUsers.push({
      email: user?.email || 'Unknown',
      name: profile?.display_name || user?.email?.split('@')[0] || 'Unknown',
      messages: u.message_count,
      media_generated: mediaCount,
      estimated_cost: parseFloat(userCost.toFixed(2)),
      joined: user?.created_at,
      last_active: user?.last_active_at,
    });
  }

  // ── MODEL POPULARITY & COST BREAKDOWN ──────────────────────────────────────
  const modelUsage = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', model_used: { $exists: true } } },
    { $group: { _id: '$model_used', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  const totalModelMessages = modelUsage.reduce((sum, m) => sum + m.count, 0);
  const modelPopularity = modelUsage.map(m => ({
    model: m._id || 'unknown',
    count: m.count,
    percentage: totalModelMessages > 0 ? parseFloat(((m.count / totalModelMessages) * 100).toFixed(1)) : 0,
  }));

  // ── FEATURE ADOPTION RATES ─────────────────────────────────────────────────
  const totalAccepted = await db.collection('users').countDocuments({ accepted: true });
  
  const featureAdoption = {
    assessment_complete: await db.collection('profiles').countDocuments({ assessment_complete: true }),
    has_imports: (await db.collection('import_jobs').distinct('user_id')).length,
    has_media: (await db.collection('media_gallery').distinct('user_id')).length,
    has_memories: (await db.collection('user_memories').distinct('user_id')).length,
    has_soulprint: await db.collection('profiles').countDocuments({ soul_profile_summary: { $exists: true, $ne: '' } }),
    web_search_users: (await db.collection('messages').distinct('user_id', { web_sources: { $exists: true, $ne: [] } })).length,
  };

  const featureAdoptionRates = {};
  for (const [feature, count] of Object.entries(featureAdoption)) {
    featureAdoptionRates[feature] = {
      users: count,
      rate: totalAccepted > 0 ? parseFloat(((count / totalAccepted) * 100).toFixed(1)) : 0,
    };
  }

  // ── FEATURE USAGE BY USER SEGMENT ─────────────────────────────────────────────
  // Analyze which features are used by different user segments to make tier recommendations
  
  // Get user IDs by segment
  const lightUserIds = [];
  const moderateUserIds = [];
  const heavyUserIds = [];
  const powerUserIds = [];
  
  userMessageCounts.forEach(u => {
    if (u.message_count <= 20) lightUserIds.push(u._id);
    else if (u.message_count <= 100) moderateUserIds.push(u._id);
    else if (u.message_count <= 500) heavyUserIds.push(u._id);
    else powerUserIds.push(u._id);
  });

  // Analyze feature usage per segment
  const analyzeSegmentFeatures = async (userIds, segmentName) => {
    if (userIds.length === 0) return { segment: segmentName, count: 0, features: {} };
    
    const segmentProfiles = await db.collection('profiles')
      .find({ user_id: { $in: userIds } })
      .toArray();
    
    const hasImports = await db.collection('import_jobs')
      .distinct('user_id', { user_id: { $in: userIds } });
    
    const hasMedia = await db.collection('media_gallery')
      .distinct('user_id', { user_id: { $in: userIds } });
    
    const hasMemories = await db.collection('user_memories')
      .distinct('user_id', { user_id: { $in: userIds } });
    
    const usesWebSearch = await db.collection('messages')
      .distinct('user_id', { user_id: { $in: userIds }, web_sources: { $exists: true, $ne: [] } });
    
    // Model usage in segment
    const modelUsageInSegment = await db.collection('messages').aggregate([
      { $match: { user_id: { $in: userIds }, role: 'assistant', model_used: { $exists: true } } },
      { $group: { _id: '$model_used', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).toArray();
    
    // Premium model usage (GPT-4, Claude, etc)
    const premiumModels = ['gpt-4', 'gpt-4o', 'claude-3', 'claude-sonnet', 'o1', 'o3'];
    const usesPremiumModels = await db.collection('messages')
      .distinct('user_id', { 
        user_id: { $in: userIds }, 
        model_used: { $regex: premiumModels.join('|'), $options: 'i' } 
      });
    
    const total = userIds.length;
    
    return {
      segment: segmentName,
      count: total,
      features: {
        assessment_complete: {
          count: segmentProfiles.filter(p => p.assessment_complete).length,
          rate: parseFloat(((segmentProfiles.filter(p => p.assessment_complete).length / total) * 100).toFixed(1)),
        },
        has_soulprint: {
          count: segmentProfiles.filter(p => p.soul_profile_summary).length,
          rate: parseFloat(((segmentProfiles.filter(p => p.soul_profile_summary).length / total) * 100).toFixed(1)),
        },
        has_imports: {
          count: hasImports.length,
          rate: parseFloat(((hasImports.length / total) * 100).toFixed(1)),
        },
        has_media: {
          count: hasMedia.length,
          rate: parseFloat(((hasMedia.length / total) * 100).toFixed(1)),
        },
        has_memories: {
          count: hasMemories.length,
          rate: parseFloat(((hasMemories.length / total) * 100).toFixed(1)),
        },
        uses_web_search: {
          count: usesWebSearch.length,
          rate: parseFloat(((usesWebSearch.length / total) * 100).toFixed(1)),
        },
        uses_premium_models: {
          count: usesPremiumModels.length,
          rate: parseFloat(((usesPremiumModels.length / total) * 100).toFixed(1)),
        },
      },
      top_models: modelUsageInSegment.map(m => m._id),
    };
  };

  const featuresBySegment = {
    light: await analyzeSegmentFeatures(lightUserIds, 'light'),
    moderate: await analyzeSegmentFeatures(moderateUserIds, 'moderate'),
    heavy: await analyzeSegmentFeatures(heavyUserIds, 'heavy'),
    power: await analyzeSegmentFeatures(powerUserIds, 'power'),
  };

  // Generate dynamic tier recommendations based on actual usage
  const generateTierRecommendations = () => {
    const recommendations = {
      free: {
        name: 'Free',
        description: 'For casual users exploring the platform',
        features: [
          { name: 'Basic Chat', included: true, reason: 'Core feature for all users' },
          { name: 'Standard AI Models', included: true, reason: 'GPT-3.5 or equivalent' },
          { name: 'Quick Assessment', included: true, reason: 'Helps onboard users' },
        ],
        limits: [],
        upsell_triggers: [],
      },
      basic: {
        name: 'Basic',
        description: 'For regular users who want more features',
        features: [],
        limits: [],
        upsell_triggers: [],
      },
      pro: {
        name: 'Pro',
        description: 'For power users who rely on SoulPrint daily',
        features: [],
        limits: [],
        upsell_triggers: [],
      },
      enterprise: {
        name: 'Enterprise',
        description: 'For businesses and super users',
        features: [],
        limits: [],
        upsell_triggers: [],
      },
    };

    // Analyze which features to include in each tier based on adoption rates
    const lightFeatures = featuresBySegment.light?.features || {};
    const moderateFeatures = featuresBySegment.moderate?.features || {};
    const heavyFeatures = featuresBySegment.heavy?.features || {};
    const powerFeatures = featuresBySegment.power?.features || {};

    // BASIC TIER: Features used by moderate users (21-100 messages)
    if (moderateFeatures.has_soulprint?.rate > 30) {
      recommendations.basic.features.push({
        name: 'SoulPrint Analysis',
        included: true,
        reason: `${moderateFeatures.has_soulprint.rate}% of moderate users generate SoulPrints`,
      });
    }
    if (moderateFeatures.assessment_complete?.rate > 40) {
      recommendations.basic.features.push({
        name: 'Full Assessment',
        included: true,
        reason: `${moderateFeatures.assessment_complete.rate}% completion rate in this segment`,
      });
    }
    if (moderateFeatures.has_memories?.rate > 20) {
      recommendations.basic.features.push({
        name: 'Memory System',
        included: true,
        reason: `${moderateFeatures.has_memories.rate}% use memories feature`,
      });
    }
    recommendations.basic.features.push({
      name: 'Chat History Export',
      included: true,
      reason: 'Standard feature for engaged users',
    });

    // PRO TIER: Features heavily used by heavy users (101-500 messages)
    if (heavyFeatures.has_imports?.rate > 15) {
      recommendations.pro.features.push({
        name: 'Data Import (ChatGPT, etc)',
        included: true,
        reason: `${heavyFeatures.has_imports.rate}% of heavy users import data`,
      });
    }
    if (heavyFeatures.has_media?.rate > 20) {
      recommendations.pro.features.push({
        name: 'Media Generation',
        included: true,
        reason: `${heavyFeatures.has_media.rate}% generate images/videos`,
        limit: '50 generations/month suggested',
      });
    }
    if (heavyFeatures.uses_web_search?.rate > 25) {
      recommendations.pro.features.push({
        name: 'Web Search Integration',
        included: true,
        reason: `${heavyFeatures.uses_web_search.rate}% use web search`,
      });
    }
    if (heavyFeatures.uses_premium_models?.rate > 30) {
      recommendations.pro.features.push({
        name: 'Premium AI Models',
        included: true,
        reason: `${heavyFeatures.uses_premium_models.rate}% use GPT-4/Claude`,
      });
    }
    recommendations.pro.features.push({
      name: 'Priority Support',
      included: true,
      reason: 'High-value users expect faster responses',
    });

    // ENTERPRISE TIER: Everything + exclusive features for power users
    recommendations.enterprise.features.push({
      name: 'Unlimited Messages',
      included: true,
      reason: 'Power users average 500+ messages',
    });
    recommendations.enterprise.features.push({
      name: 'Unlimited Media Generation',
      included: true,
      reason: `${powerFeatures.has_media?.rate || 0}% of power users generate media`,
    });
    recommendations.enterprise.features.push({
      name: 'All Premium Models',
      included: true,
      reason: `${powerFeatures.uses_premium_models?.rate || 0}% use premium models`,
    });
    recommendations.enterprise.features.push({
      name: 'API Access',
      included: true,
      reason: 'For integrations and automation',
    });
    recommendations.enterprise.features.push({
      name: 'Dedicated Support',
      included: true,
      reason: 'White-glove service for top customers',
    });
    recommendations.enterprise.features.push({
      name: 'Custom Integrations',
      included: true,
      reason: 'Telegram, webhooks, etc.',
    });

    // Add limits based on usage patterns
    const avgLightMsgs = lightUserIds.length > 0 ? 
      userMessageCounts.filter(u => lightUserIds.includes(u._id)).reduce((sum, u) => sum + u.message_count, 0) / lightUserIds.length : 10;
    const avgModerateMsgs = moderateUserIds.length > 0 ?
      userMessageCounts.filter(u => moderateUserIds.includes(u._id)).reduce((sum, u) => sum + u.message_count, 0) / moderateUserIds.length : 50;
    const avgHeavyMsgs = heavyUserIds.length > 0 ?
      userMessageCounts.filter(u => heavyUserIds.includes(u._id)).reduce((sum, u) => sum + u.message_count, 0) / heavyUserIds.length : 250;

    recommendations.free.limits = [
      { type: 'messages', value: Math.round(avgLightMsgs * 1.5), unit: 'per month', reason: `Avg light user: ${Math.round(avgLightMsgs)} msgs` },
      { type: 'models', value: 'Standard only', reason: 'Reserve premium for paid tiers' },
    ];
    
    recommendations.basic.limits = [
      { type: 'messages', value: Math.round(avgModerateMsgs * 1.2), unit: 'per month', reason: `Avg moderate user: ${Math.round(avgModerateMsgs)} msgs` },
      { type: 'media', value: 10, unit: 'per month', reason: 'Limited media to encourage Pro upgrade' },
    ];
    
    recommendations.pro.limits = [
      { type: 'messages', value: Math.round(avgHeavyMsgs * 1.5), unit: 'per month', reason: `Avg heavy user: ${Math.round(avgHeavyMsgs)} msgs` },
      { type: 'media', value: 50, unit: 'per month', reason: 'Generous but not unlimited' },
    ];

    // Upsell triggers
    recommendations.free.upsell_triggers = [
      'Message limit reached',
      'Tries to use premium model',
      'Tries to generate media',
    ];
    recommendations.basic.upsell_triggers = [
      'Media limit reached',
      'Wants to import data',
      'Needs priority support',
    ];
    recommendations.pro.upsell_triggers = [
      'Needs unlimited usage',
      'Wants API access',
      'Requires dedicated support',
    ];

    return recommendations;
  };

  const tierRecommendations = generateTierRecommendations();

  // ── MEDIA GENERATION INSIGHTS ──────────────────────────────────────────────
  const mediaByType = await db.collection('media_gallery').aggregate([
    { $group: { _id: '$type', count: { $sum: 1 }, total_cost: { $sum: '$cost_usd' } } },
  ]).toArray();

  const mediaUsersCount = (await db.collection('media_gallery').distinct('user_id')).length;
  const avgMediaPerUser = mediaUsersCount > 0 
    ? (await db.collection('media_gallery').countDocuments()) / mediaUsersCount 
    : 0;

  // ── ENGAGEMENT TRENDS (Last 30 days by week) ───────────────────────────────
  const weeklyTrends = [];
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
    
    const weekMessages = await db.collection('messages').countDocuments({
      created_at: { $gte: weekStart, $lt: weekEnd }
    });
    const weekActiveUsers = await db.collection('users').countDocuments({
      last_active_at: { $gte: weekStart, $lt: weekEnd }
    });
    const weekNewUsers = await db.collection('users').countDocuments({
      created_at: { $gte: weekStart, $lt: weekEnd }
    });

    weeklyTrends.unshift({
      week: `Week ${4 - i}`,
      start: weekStart.toISOString().split('T')[0],
      messages: weekMessages,
      active_users: weekActiveUsers,
      new_users: weekNewUsers,
    });
  }

  // ── PRICING RECOMMENDATIONS ────────────────────────────────────────────────
  // Calculate suggested tier limits based on actual usage
  const messagePercentiles = await db.collection('messages').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$user_id', count: { $sum: 1 } } },
    { $sort: { count: 1 } },
  ]).toArray();

  const msgCounts = messagePercentiles.map(u => u.count);
  const getPercentile = (arr, p) => {
    const idx = Math.floor(arr.length * p);
    return arr[idx] || 0;
  };

  // Calculate actual costs
  const totalCostAgg = await db.collection('messages').aggregate([
    { $match: { role: 'assistant', est_input_tokens: { $exists: true } } },
    { $group: { _id: null, input: { $sum: '$est_input_tokens' }, output: { $sum: '$est_output_tokens' } } },
  ]).toArray();
  
  const totalLLMCost = totalCostAgg.length > 0
    ? (totalCostAgg[0].input / 1_000_000) * 5 + (totalCostAgg[0].output / 1_000_000) * 15
    : 0;
  
  // Get media costs
  const mediaCostAgg = await db.collection('media_gallery').aggregate([
    { $group: { _id: null, total_cost: { $sum: '$cost_usd' } } },
  ]).toArray();
  const totalMediaCost = mediaCostAgg[0]?.total_cost || 0;
  
  // Calculate per-user costs by tier
  const activeUserCount = userMessageCounts.length || 1;
  const avgCostPerActiveUser = (totalLLMCost + totalMediaCost) / activeUserCount;
  
  // Cost per message (for tier calculation)
  const totalMessages = msgCounts.reduce((a, b) => a + b, 0) || 1;
  const costPerMessage = totalLLMCost / totalMessages;
  
  // Market comparison data (2025 pricing)
  const marketComparison = {
    chatgpt_plus: { price: 20, name: 'ChatGPT Plus' },
    claude_pro: { price: 20, name: 'Claude Pro' },
    perplexity_pro: { price: 20, name: 'Perplexity Pro' },
    chatgpt_pro: { price: 200, name: 'ChatGPT Pro' },
    perplexity_max: { price: 200, name: 'Perplexity Max' },
    chatgpt_team: { price: 30, name: 'ChatGPT Team (per user)' },
  };
  
  // Calculate tier pricing based on 70-90% gross margin targets
  const tierLimits = {
    free: getPercentile(msgCounts, 0.5) || 25,
    basic: getPercentile(msgCounts, 0.8) || 100,
    pro: getPercentile(msgCounts, 0.95) || 500,
  };
  
  // Estimate cost for each tier based on message limits
  const tierCosts = {
    free: tierLimits.free * costPerMessage,
    basic: tierLimits.basic * costPerMessage,
    pro: tierLimits.pro * costPerMessage,
    unlimited: avgCostPerActiveUser * 3, // Power users typically 3x average
  };
  
  // Calculate prices for target margins (70%, 80%, 90%)
  const calculatePrice = (cost, margin) => {
    return cost / (1 - margin);
  };
  
  // Generate pricing tiers
  const pricingTiers = {
    free: {
      name: 'Free',
      message_limit: tierLimits.free,
      estimated_cost: parseFloat(tierCosts.free.toFixed(2)),
      price: 0,
      margin: 'N/A (acquisition)',
      features: ['Basic chat', 'Limited messages', 'Standard models'],
    },
    basic: {
      name: 'Basic',
      message_limit: tierLimits.basic,
      estimated_cost: parseFloat(tierCosts.basic.toFixed(2)),
      price_at_70_margin: parseFloat(calculatePrice(tierCosts.basic, 0.70).toFixed(2)),
      price_at_80_margin: parseFloat(calculatePrice(tierCosts.basic, 0.80).toFixed(2)),
      price_at_90_margin: parseFloat(calculatePrice(tierCosts.basic, 0.90).toFixed(2)),
      recommended_price: parseFloat(Math.ceil(calculatePrice(tierCosts.basic, 0.80))),
      features: ['More messages', 'All standard models', 'Import data', 'SoulPrint analysis'],
    },
    pro: {
      name: 'Pro',
      message_limit: tierLimits.pro,
      estimated_cost: parseFloat(tierCosts.pro.toFixed(2)),
      price_at_70_margin: parseFloat(calculatePrice(tierCosts.pro, 0.70).toFixed(2)),
      price_at_80_margin: parseFloat(calculatePrice(tierCosts.pro, 0.80).toFixed(2)),
      price_at_90_margin: parseFloat(calculatePrice(tierCosts.pro, 0.90).toFixed(2)),
      recommended_price: parseFloat(Math.ceil(calculatePrice(tierCosts.pro, 0.80))),
      features: ['High message limit', 'Premium models', 'Media generation', 'Priority support', 'Advanced analytics'],
    },
    enterprise: {
      name: 'Enterprise',
      message_limit: 'Unlimited',
      estimated_cost: parseFloat(tierCosts.unlimited.toFixed(2)),
      price_at_70_margin: parseFloat(calculatePrice(tierCosts.unlimited, 0.70).toFixed(2)),
      price_at_80_margin: parseFloat(calculatePrice(tierCosts.unlimited, 0.80).toFixed(2)),
      price_at_90_margin: parseFloat(calculatePrice(tierCosts.unlimited, 0.90).toFixed(2)),
      recommended_price: parseFloat(Math.ceil(calculatePrice(tierCosts.unlimited, 0.80))),
      features: ['Unlimited messages', 'All premium models', 'Unlimited media', 'API access', 'Dedicated support', 'Custom integrations'],
    },
  };
  
  // Market positioning recommendations
  const marketPositioning = {
    budget_option: {
      basic: Math.min(10, pricingTiers.basic.recommended_price),
      pro: Math.min(20, pricingTiers.pro.recommended_price),
      enterprise: Math.min(50, pricingTiers.enterprise.recommended_price),
      strategy: 'Undercut market leaders to gain market share',
    },
    competitive: {
      basic: Math.min(15, Math.max(pricingTiers.basic.recommended_price, 10)),
      pro: 20, // Match ChatGPT/Claude
      enterprise: Math.min(99, Math.max(pricingTiers.enterprise.recommended_price, 50)),
      strategy: 'Match major competitors while offering differentiated value',
    },
    premium: {
      basic: Math.max(15, pricingTiers.basic.recommended_price),
      pro: Math.max(25, pricingTiers.pro.recommended_price),
      enterprise: Math.max(99, pricingTiers.enterprise.recommended_price),
      strategy: 'Position as premium offering with superior personalization',
    },
  };

  const pricingRecommendations = {
    // Usage-based limits
    free_tier_limit: tierLimits.free,
    basic_tier_limit: tierLimits.basic,
    pro_tier_limit: tierLimits.pro,
    power_users_above: getPercentile(msgCounts, 0.95),
    avg_messages_per_user: msgCounts.length > 0 ? Math.round(msgCounts.reduce((a, b) => a + b, 0) / msgCounts.length) : 0,
    median_messages: getPercentile(msgCounts, 0.5),
    
    // Cost analysis
    cost_per_message: parseFloat(costPerMessage.toFixed(4)),
    avg_cost_per_user: parseFloat(avgCostPerActiveUser.toFixed(2)),
    total_llm_cost: parseFloat(totalLLMCost.toFixed(2)),
    total_media_cost: parseFloat(totalMediaCost.toFixed(2)),
    
    // Detailed tier pricing
    tiers: pricingTiers,
    
    // Market comparison
    market_comparison: marketComparison,
    
    // Positioning strategies
    market_positioning: marketPositioning,
  };

  // ── CHURN INDICATORS ───────────────────────────────────────────────────────
  const inactiveUsers = await db.collection('users').countDocuments({
    accepted: true,
    last_active_at: { $lt: thirtyDaysAgo }
  });
  const churnRate = totalAccepted > 0 ? parseFloat(((inactiveUsers / totalAccepted) * 100).toFixed(1)) : 0;

  // Users who signed up but never sent a message
  const usersWithNoMessages = totalAccepted - userMessageCounts.length;
  const dropOffRate = totalAccepted > 0 ? parseFloat(((usersWithNoMessages / totalAccepted) * 100).toFixed(1)) : 0;

  // ── REVENUE POTENTIAL ESTIMATES ────────────────────────────────────────────
  // Based on typical SaaS pricing
  const revenuePotential = {
    if_free_tier_20_msgs: {
      paying_users: usageSegments.moderate.count + usageSegments.heavy.count + usageSegments.power.count,
      at_10_per_month: (usageSegments.moderate.count + usageSegments.heavy.count + usageSegments.power.count) * 10,
      at_20_per_month: (usageSegments.moderate.count + usageSegments.heavy.count + usageSegments.power.count) * 20,
    },
    if_free_tier_50_msgs: {
      paying_users: usageSegments.heavy.count + usageSegments.power.count,
      at_10_per_month: (usageSegments.heavy.count + usageSegments.power.count) * 10,
      at_20_per_month: (usageSegments.heavy.count + usageSegments.power.count) * 20,
    },
    enterprise_candidates: usageSegments.power.count,
  };

  // ── VOICE CHAT COSTS FOR PRICING ─────────────────────────────────────────────
  // Get voice session costs for pricing voice features
  const voiceCostAgg = await db.collection('voice_sessions').aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: null,
        total_sessions: { $sum: 1 },
        total_duration: { $sum: { $ifNull: ['$duration_seconds', 0] } },
        total_cost: { $sum: { $ifNull: ['$estimated_cost_usd', 0] } },
        total_input_tokens: { $sum: { $ifNull: ['$audio_input_tokens', 0] } },
        total_output_tokens: { $sum: { $ifNull: ['$audio_output_tokens', 0] } },
        avg_duration: { $avg: { $ifNull: ['$duration_seconds', 0] } },
      }
    }
  ]).toArray();

  const uniqueVoiceUsers = await db.collection('voice_sessions').distinct('user_id');
  
  const voiceData = voiceCostAgg[0] || {
    total_sessions: 0,
    total_duration: 0,
    total_cost: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    avg_duration: 0,
  };

  // Calculate voice cost metrics
  const voiceCostPerMinute = voiceData.total_duration > 0 
    ? voiceData.total_cost / (voiceData.total_duration / 60) 
    : 0;
  const voiceCostPerSession = voiceData.total_sessions > 0 
    ? voiceData.total_cost / voiceData.total_sessions 
    : 0;
  const voiceCostPerUser = uniqueVoiceUsers.length > 0 
    ? voiceData.total_cost / uniqueVoiceUsers.length 
    : 0;

  const voiceCosts = {
    total_cost_usd: parseFloat(voiceData.total_cost.toFixed(2)),
    total_sessions: voiceData.total_sessions,
    unique_users: uniqueVoiceUsers.length,
    total_duration_seconds: voiceData.total_duration,
    avg_duration_seconds: Math.round(voiceData.avg_duration || 0),
    total_audio_input_tokens: voiceData.total_input_tokens,
    total_audio_output_tokens: voiceData.total_output_tokens,
    cost_per_minute: parseFloat(voiceCostPerMinute.toFixed(4)),
    cost_per_session: parseFloat(voiceCostPerSession.toFixed(4)),
    cost_per_user: parseFloat(voiceCostPerUser.toFixed(4)),
  };

  return ok({
    generated_at: now.toISOString(),
    
    // User Segmentation
    user_segments: {
      inactive: { count: usageSegments.inactive.count, percentage: parseFloat(((usageSegments.inactive.count / totalAccepted) * 100).toFixed(1)) },
      light: { count: usageSegments.light.count, percentage: parseFloat(((usageSegments.light.count / totalAccepted) * 100).toFixed(1)), range: '1-20 msgs' },
      moderate: { count: usageSegments.moderate.count, percentage: parseFloat(((usageSegments.moderate.count / totalAccepted) * 100).toFixed(1)), range: '21-100 msgs' },
      heavy: { count: usageSegments.heavy.count, percentage: parseFloat(((usageSegments.heavy.count / totalAccepted) * 100).toFixed(1)), range: '101-500 msgs' },
      power: { count: usageSegments.power.count, percentage: parseFloat(((usageSegments.power.count / totalAccepted) * 100).toFixed(1)), range: '500+ msgs' },
    },
    
    // Top Users
    top_users: enrichedTopUsers,
    
    // Model Popularity
    model_popularity: modelPopularity,
    
    // Feature Adoption
    feature_adoption: featureAdoptionRates,
    
    // Feature usage by segment (for tier recommendations)
    features_by_segment: featuresBySegment,
    
    // Dynamic tier recommendations
    tier_recommendations: tierRecommendations,
    
    // Media Insights
    media_insights: {
      by_type: mediaByType.map(m => ({ type: m._id, count: m.count, total_cost: parseFloat((m.total_cost || 0).toFixed(2)) })),
      users_using_media: mediaUsersCount,
      avg_media_per_user: parseFloat(avgMediaPerUser.toFixed(1)),
      media_adoption_rate: totalAccepted > 0 ? parseFloat(((mediaUsersCount / totalAccepted) * 100).toFixed(1)) : 0,
    },
    
    // Weekly Trends
    weekly_trends: weeklyTrends,
    
    // Pricing Recommendations
    pricing_recommendations: pricingRecommendations,
    
    // Churn & Retention
    churn_indicators: {
      inactive_30d: inactiveUsers,
      churn_rate: churnRate,
      never_engaged: usersWithNoMessages,
      drop_off_rate: dropOffRate,
    },
    
    // Revenue Potential
    revenue_potential: revenuePotential,
    
    // Voice Chat Costs (for pricing voice features)
    voice_costs: voiceCosts,
  });
}

// ============================================================

// ============================================================
// BETA ACCESS CODES
// ============================================================

// BETA ACCESS CODE MANAGEMENT
// ============================================================

// Get beta code stats
async function handleAdminGetBetaCodeStats(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
  
  if (!betaCode) {
    return ok({ code: null, uses: 0, expires_at: null });
  }

  return ok({
    code: betaCode.code,
    uses: betaCode.uses || 0,
    expires_at: betaCode.expires_at,
    created_at: betaCode.created_at,
  });
}

// Create/Update beta code
async function handleAdminCreateBetaCode(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  let { code, expires_at } = body;

  // Generate random code if not provided
  if (!code) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code = 'BETA-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } else {
    code = code.toUpperCase().trim();
  }

  const db = await getDb();
  await db.collection('beta_codes').updateOne(
    { id: 'current' },
    { 
      $set: { 
        id: 'current',
        code,
        expires_at: expires_at ? new Date(expires_at) : null,
        created_at: new Date(),
        uses: 0,
      } 
    },
    { upsert: true }
  );

  return ok({ code, success: true });
}

// Delete/Disable beta code
async function handleAdminDeleteBetaCode(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  await db.collection('beta_codes').deleteOne({ id: 'current' });

  return ok({ success: true });
}

// Redeem beta code (for waitlisted users)
async function handleRedeemBetaCode(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { code } = body;
  
  if (!code) return err('Access code required');

  const db = await getDb();
  
  // Check if user is already accepted
  if (user.accepted) {
    return ok({ success: true, message: 'Already accepted' });
  }

  // Check if user has completed required onboarding questions
  // Required fields: display_name, discovery_source (how did you find us)
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  const hasDisplayName = profile?.display_name || user.profile?.display_name;
  const hasDiscoverySource = profile?.discovery_source || user.profile?.discovery_source;
  
  if (!hasDisplayName || !hasDiscoverySource) {
    return err('Please complete the onboarding questions before redeeming your access code. Go to the profile setup to answer required questions.', 400);
  }

  // Check if user has completed assessment (Quick Start = 12 questions, Full = 36 questions)
  const assessmentAnswerCount = await db.collection('assessment_answers').countDocuments({ user_id: user.id });
  const gradualAnswerCount = await db.collection('gradual_assessment_progress').countDocuments({ user_id: user.id });
  const totalAnswers = assessmentAnswerCount + gradualAnswerCount;
  
  // Require at least 12 answers (Quick Start minimum)
  if (totalAnswers < 12) {
    return err(`Please complete the assessment questions before redeeming your access code. You have answered ${totalAnswers}/12 required questions.`, 400);
  }

  const codeToCheck = code.toUpperCase().trim();
  let validCode = false;
  let usedCodeSource = null;

  // First check beta_codes_v2 (admin-created codes)
  const v2Code = await db.collection('beta_codes_v2').findOne({ 
    code: codeToCheck,
    active: true,
  });
  
  if (v2Code) {
    // Check expiration
    const isExpired = v2Code.expires_at && new Date(v2Code.expires_at) < new Date();
    if (isExpired) {
      return err('This access code has expired', 400);
    }
    
    // Check usage limits
    const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
    const isExhausted = v2Code.max_uses && currentUses >= v2Code.max_uses;
    if (isExhausted) {
      return err('This access code has reached its usage limit', 400);
    }
    
    validCode = true;
    usedCodeSource = 'v2';
    
    // Increment usage count
    await db.collection('beta_codes_v2').updateOne(
      { code: codeToCheck },
      { $inc: { uses: 1, uses_count: 1 } }
    );
  } else {
    // Fallback: check legacy beta_codes collection
    const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
    
    if (legacyCode && legacyCode.code && legacyCode.code.toUpperCase() === codeToCheck) {
      // Check if expired
      if (legacyCode.expires_at && new Date(legacyCode.expires_at) < new Date()) {
        return err('This access code has expired', 400);
      }
      
      validCode = true;
      usedCodeSource = 'legacy';
      
      // Increment usage count
      await db.collection('beta_codes').updateOne(
        { id: 'current' },
        { $inc: { uses: 1 } }
      );
    }
  }

  if (!validCode) {
    console.log('[Redeem Code] Invalid code attempted:', code, 'by user:', user.email);
    return err('Invalid access code', 400);
  }

  // Accept the user
  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { accepted: true, beta_code_used: code, accepted_at: new Date() } }
  );

  console.log('[Redeem Code] Code accepted:', code, 'for user:', user.email, 'source:', usedCodeSource);
  return ok({ success: true, message: 'Access granted!' });
}

// Validate beta code during registration (without requiring auth)
async function handleValidateBetaCode(request) {
  const body = await request.json();
  const { code } = body;
  
  if (!code) return ok({ valid: false });

  const db = await getDb();
  const codeToCheck = code.toUpperCase().trim();

  // First check beta_codes_v2 (admin-created codes)
  const v2Code = await db.collection('beta_codes_v2').findOne({ 
    code: codeToCheck,
    active: true,
  });
  
  if (v2Code) {
    // Check expiration
    if (v2Code.expires_at && new Date(v2Code.expires_at) < new Date()) {
      return ok({ valid: false, expired: true });
    }
    
    // Check usage limits
    const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
    if (v2Code.max_uses && currentUses >= v2Code.max_uses) {
      return ok({ valid: false, exhausted: true });
    }
    
    return ok({ valid: true });
  }

  // Fallback: check legacy beta_codes collection
  const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
  
  if (legacyCode && legacyCode.code && legacyCode.code.toUpperCase() === codeToCheck) {
    // Check if expired
    if (legacyCode.expires_at && new Date(legacyCode.expires_at) < new Date()) {
      return ok({ valid: false, expired: true });
    }
    
    return ok({ valid: true });
  }

  return ok({ valid: false });
}

// Send beta code via email
async function handleAdminSendBetaCode(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { email, name } = body;
  
  if (!email) return err('Email required');

  const db = await getDb();
  const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
  
  if (!betaCode || !betaCode.code) {
    return err('No beta code configured. Create one first in Settings.');
  }

  // Check if expired
  if (betaCode.expires_at && new Date(betaCode.expires_at) < new Date()) {
    return err('Beta code has expired. Please create a new one.');
  }

  // Send the email
  const result = await sendBetaCodeEmail(email, betaCode.code, name);
  
  if (!result.success) {
    return err(`Failed to send email: ${result.error}`);
  }

  // Log the send
  await db.collection('beta_code_sends').insertOne({
    id: uuidv4(),
    email,
    name: name || null,
    code: betaCode.code,
    sent_by: admin.id,
    sent_at: new Date(),
  });

  return ok({ success: true, message: `Beta code sent to ${email}` });
}

// ============================================================

// ============================================================
// ADVANCED BETA CODE MANAGEMENT
// ============================================================

// ADVANCED BETA CODE MANAGEMENT (Groups, Multiple Codes, Analytics)
// ============================================================

// Generate a random code with prefix
function generateBetaCode(prefix = 'BETA') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix + '-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all beta groups with metrics
async function handleAdminGetBetaGroups(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const groups = await db.collection('beta_groups').find({}).sort({ created_at: -1 }).toArray();
  
  // Calculate metrics for each group
  const groupsWithMetrics = await Promise.all(groups.map(async (group) => {
    const codes = await db.collection('beta_codes_v2').find({ group_id: group.id }).toArray();
    const totalCodes = codes.length;
    const activeCodes = codes.filter(c => c.active && (!c.expires_at || new Date(c.expires_at) >= new Date())).length;
    const totalRedemptions = codes.reduce((sum, c) => sum + (c.uses_count || 0), 0);
    
    // Get unique users who used codes from this group
    const redemptions = await db.collection('beta_code_redemptions').find({ 
      code_id: { $in: codes.map(c => c.id) } 
    }).toArray();
    const uniqueUsers = new Set(redemptions.map(r => r.user_id)).size;
    
    return {
      ...group,
      total_codes: totalCodes,
      active_codes: activeCodes,
      total_redemptions: totalRedemptions,
      unique_users: uniqueUsers,
      conversion_rate: totalCodes > 0 ? Math.round((totalRedemptions / totalCodes) * 100) : 0,
    };
  }));

  return ok({ groups: groupsWithMetrics });
}

// Create a new beta group
async function handleAdminCreateBetaGroup(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { name, description } = body;
  
  if (!name) return err('Group name required');

  const db = await getDb();
  const groupId = uuidv4();
  
  await db.collection('beta_groups').insertOne({
    id: groupId,
    name: name.trim(),
    description: description || '',
    created_at: new Date(),
    created_by: admin.id,
  });

  return ok({ id: groupId, name: name.trim(), success: true });
}

// Delete a beta group (and optionally its codes)
async function handleAdminDeleteBetaGroup(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { group_id, delete_codes = false } = body;
  
  if (!group_id) return err('Group ID required');

  const db = await getDb();
  
  // Delete or deactivate codes in this group
  if (delete_codes) {
    await db.collection('beta_codes_v2').deleteMany({ group_id });
  } else {
    await db.collection('beta_codes_v2').updateMany(
      { group_id },
      { $set: { active: false, group_id: null } }
    );
  }
  
  await db.collection('beta_groups').deleteOne({ id: group_id });

  return ok({ success: true });
}

// Get all beta codes with full details
async function handleAdminGetBetaCodes(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id');
  
  const query = groupId ? { group_id: groupId } : {};
  const codes = await db.collection('beta_codes_v2').find(query).sort({ created_at: -1 }).toArray();
  
  // Get group names
  const groups = await db.collection('beta_groups').find({}).toArray();
  const groupMap = new Map(groups.map(g => [g.id, g.name]));
  
  const codesWithDetails = codes.map(code => ({
    ...code,
    group_name: code.group_id ? groupMap.get(code.group_id) : 'Ungrouped',
    is_expired: code.expires_at && new Date(code.expires_at) < new Date(),
    is_exhausted: code.max_uses && (code.uses_count ?? code.uses ?? 0) >= code.max_uses,
    total_uses: code.uses_count ?? code.uses ?? 0,
  }));

  return ok({ codes: codesWithDetails });
}

// Create beta codes (single or bulk)
async function handleAdminCreateBetaCodes(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { 
    group_id, 
    count = 1, 
    prefix = 'BETA',
    max_uses = null,  // null = unlimited
    is_single_use = false,
    expires_at = null,
    custom_code = null,  // For single code creation
    label = '',
  } = body;

  if (count < 1 || count > 100) {
    return err('Count must be between 1 and 100');
  }

  const db = await getDb();
  const createdCodes = [];
  
  for (let i = 0; i < count; i++) {
    const code = custom_code && count === 1 
      ? custom_code.toUpperCase().trim() 
      : generateBetaCode(prefix);
    
    const codeDoc = {
      id: uuidv4(),
      code,
      group_id: group_id || null,
      label: label || '',
      max_uses: is_single_use ? 1 : (max_uses || null),
      uses_count: 0,
      is_single_use,
      expires_at: expires_at ? new Date(expires_at) : null,
      active: true,
      created_at: new Date(),
      created_by: admin.id,
    };
    
    await db.collection('beta_codes_v2').insertOne(codeDoc);
    createdCodes.push(codeDoc);
  }

  return ok({ codes: createdCodes, success: true });
}

// Update a beta code
async function handleAdminUpdateBetaCode(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { code_id, active, max_uses, expires_at, label, group_id } = body;
  
  if (!code_id) return err('Code ID required');

  const db = await getDb();
  const updates = {};
  
  if (typeof active === 'boolean') updates.active = active;
  if (max_uses !== undefined) updates.max_uses = max_uses;
  if (expires_at !== undefined) updates.expires_at = expires_at ? new Date(expires_at) : null;
  if (label !== undefined) updates.label = label;
  if (group_id !== undefined) updates.group_id = group_id;
  
  updates.updated_at = new Date();

  await db.collection('beta_codes_v2').updateOne(
    { id: code_id },
    { $set: updates }
  );

  return ok({ success: true });
}

// Delete a beta code
async function handleAdminDeleteBetaCodeV2(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const body = await request.json();
  const { code_id } = body;
  
  if (!code_id) return err('Code ID required');

  const db = await getDb();
  await db.collection('beta_codes_v2').deleteOne({ id: code_id });

  return ok({ success: true });
}

// Get redemption history for a code or all codes
async function handleAdminGetBetaRedemptions(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  const url = new URL(request.url);
  const codeId = url.searchParams.get('code_id');
  const groupId = url.searchParams.get('group_id');
  
  let query = {};
  
  if (codeId) {
    query.code_id = codeId;
  } else if (groupId) {
    const codes = await db.collection('beta_codes_v2').find({ group_id: groupId }).toArray();
    query.code_id = { $in: codes.map(c => c.id) };
  }
  
  const redemptions = await db.collection('beta_code_redemptions')
    .find(query)
    .sort({ redeemed_at: -1 })
    .limit(100)
    .toArray();
  
  // Get code details
  const codeIds = [...new Set(redemptions.map(r => r.code_id))];
  const codes = await db.collection('beta_codes_v2').find({ id: { $in: codeIds } }).toArray();
  const codeMap = new Map(codes.map(c => [c.id, c.code]));
  
  const redemptionsWithDetails = redemptions.map(r => ({
    ...r,
    code: codeMap.get(r.code_id) || 'Unknown',
  }));

  return ok({ redemptions: redemptionsWithDetails });
}

// Validate and redeem a beta code (V2 - supports multiple codes)
async function handleValidateBetaCodeV2(request) {
  const body = await request.json();
  const { code, user_id, user_email } = body;
  
  if (!code) return ok({ valid: false });

  const db = await getDb();
  
  // First check v2 codes
  const betaCode = await db.collection('beta_codes_v2').findOne({ 
    code: code.toUpperCase().trim(),
    active: true,
  });
  
  if (!betaCode) {
    // Fall back to legacy single code
    const legacyCode = await db.collection('beta_codes').findOne({ id: 'current' });
    if (legacyCode && legacyCode.code && 
        legacyCode.code.toUpperCase() === code.toUpperCase().trim() &&
        (!legacyCode.expires_at || new Date(legacyCode.expires_at) >= new Date())) {
      return ok({ valid: true, legacy: true });
    }
    return ok({ valid: false });
  }

  // Check if expired
  if (betaCode.expires_at && new Date(betaCode.expires_at) < new Date()) {
    return ok({ valid: false, expired: true });
  }

  // Check if exhausted
  if (betaCode.max_uses && betaCode.uses_count >= betaCode.max_uses) {
    return ok({ valid: false, exhausted: true });
  }

  // If user info provided, record the redemption
  if (user_id && user_email) {
    // Check if user already used this code
    const existingRedemption = await db.collection('beta_code_redemptions').findOne({
      code_id: betaCode.id,
      user_id,
    });
    
    if (existingRedemption) {
      return ok({ valid: true, already_used: true });
    }
    
    // Record redemption
    await db.collection('beta_code_redemptions').insertOne({
      id: uuidv4(),
      code_id: betaCode.id,
      code: betaCode.code,
      user_id,
      user_email,
      redeemed_at: new Date(),
    });
    
    // Increment usage count
    await db.collection('beta_codes_v2').updateOne(
      { id: betaCode.id },
      { $inc: { uses_count: 1 } }
    );
  }

  return ok({ 
    valid: true, 
    code_id: betaCode.id,
    group_id: betaCode.group_id,
  });
}

// Send notification email when a new user registers
async function sendNewUserNotificationEmail(user) {
  const ADMIN_EMAIL = 'reggie@archeforge.com';
  
  try {
    // Use the email service instead of inline Resend call
    const { sendNewUserNotification } = await import('@/lib/email.js');
    const result = await sendNewUserNotification(ADMIN_EMAIL, user);
    
    if (result.success) {
      console.log('[Email] New user notification sent to', ADMIN_EMAIL);
    } else {
      console.error('[Email] Failed to send new user notification:', result.error);
    }
  } catch (e) {
    console.error('[Email] Failed to send new user notification:', e.message);
  }
}

// ============================================================

// ============================================================
// BLOG ADMIN
// ============================================================

async function handleAdminGetBlogPosts(request) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Unauthorized', 401);
  
  const db = await getDb();
  const posts = await db.collection('blog_posts')
    .find({})
    .sort({ created_at: -1 })
    .toArray();
  
  return ok({ posts });
}

// Admin: Create blog post
async function handleAdminCreateBlogPost(request) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Unauthorized', 401);
  
  const body = await request.json();
  const { title, content, excerpt, featured_image, category, tags, author, status } = body;
  
  if (!title || !content) return err('Title and content are required');
  
  const db = await getDb();
  
  // Generate unique slug
  let slug = generateSlug(title);
  const existingSlug = await db.collection('blog_posts').findOne({ slug });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  
  const post = {
    id: uuidv4(),
    slug,
    title,
    content,
    excerpt: excerpt || content.substring(0, 160).replace(/[#*_`]/g, '') + '...',
    featured_image: featured_image || null,
    category: category || 'General',
    tags: tags || [],
    author: author || 'SoulPrint Team',
    status: status || 'draft',
    created_at: new Date(),
    updated_at: new Date(),
    published_at: status === 'published' ? new Date() : null,
    created_by: user.id,
  };
  
  await db.collection('blog_posts').insertOne(post);
  
  return ok({ success: true, post });
}

// Admin: Update blog post
async function handleAdminUpdateBlogPost(request, postId) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Unauthorized', 401);
  
  const body = await request.json();
  const { title, content, excerpt, featured_image, category, tags, author, status } = body;
  
  const db = await getDb();
  const existingPost = await db.collection('blog_posts').findOne({ id: postId });
  
  if (!existingPost) return err('Post not found', 404);
  
  const updates = {
    updated_at: new Date(),
  };
  
  if (title !== undefined) {
    updates.title = title;
    // Update slug if title changed
    if (title !== existingPost.title) {
      let newSlug = generateSlug(title);
      const existingSlug = await db.collection('blog_posts').findOne({ slug: newSlug, id: { $ne: postId } });
      if (existingSlug) {
        newSlug = `${newSlug}-${Date.now().toString(36)}`;
      }
      updates.slug = newSlug;
    }
  }
  if (content !== undefined) updates.content = content;
  if (excerpt !== undefined) updates.excerpt = excerpt;
  if (featured_image !== undefined) updates.featured_image = featured_image;
  if (category !== undefined) updates.category = category;
  if (tags !== undefined) updates.tags = tags;
  if (author !== undefined) updates.author = author;
  if (status !== undefined) {
    updates.status = status;
    // Set published_at when publishing
    if (status === 'published' && existingPost.status !== 'published') {
      updates.published_at = new Date();
    }
  }
  
  await db.collection('blog_posts').updateOne(
    { id: postId },
    { $set: updates }
  );
  
  const updatedPost = await db.collection('blog_posts').findOne({ id: postId });
  
  return ok({ success: true, post: updatedPost });
}

// Admin: Delete blog post
async function handleAdminDeleteBlogPost(request, postId) {
  const user = await authenticate(request);
  if (!user || user.role !== 'superadmin') return err('Unauthorized', 401);
  
  const db = await getDb();
  const result = await db.collection('blog_posts').deleteOne({ id: postId });
  
  if (result.deletedCount === 0) return err('Post not found', 404);
  
  return ok({ success: true });
}

// ============================================================

// ============================================================
// SEED QUESTIONS
// ============================================================

async function seedQuestions(db) {
  const existing = await db.collection('assessment_questions').countDocuments();
  if (existing > 0) return;
  const now = new Date();
  await db.collection('assessment_questions').insertMany(
    SEED_QUESTIONS.map(q => ({
      id: uuidv4(),
      ...q,
      active: true,
      created_at: now,
    }))
  );
}

// ASSESSMENT - Get Progress (answers for user)
async function handleGetProgress(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Check traditional assessment answers
  const answers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();
  
  // Also check layered assessment answers (Quick Start)
  const layeredAnswers = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
  
  let totalAnswered = answers.length;
  let answeredIds = answers.map(a => a.question_id);
  let layer1Complete = false;
  let layer2Complete = false;
  
  // Add layered answers to count
  if (layeredAnswers) {
    const layer1Count = Object.keys(layeredAnswers.layer1_answers || {}).length;
    const layer2Count = Object.keys(layeredAnswers.layer2_answers || {}).length;
    totalAnswered += layer1Count + layer2Count;
    answeredIds = [...answeredIds, ...Object.keys(layeredAnswers.layer1_answers || {}), ...Object.keys(layeredAnswers.layer2_answers || {})];
    layer1Complete = layeredAnswers.layer1_complete || false;
    layer2Complete = layeredAnswers.layer2_complete || false;
  }
  
  // Check if user has completed ANY assessment type
  const hasCompletedAssessment = answers.length >= 36 || // Full assessment
                                  (layer1Complete) || // Quick Start (layer 1 = 12 questions minimum)
                                  totalAnswered >= 12; // At least 12 questions answered

  return ok({ 
    answered: answeredIds, 
    count: totalAnswered,
    layer1_complete: layer1Complete,
    layer2_complete: layer2Complete,
    assessment_complete: hasCompletedAssessment
  });
}

// ASSESSMENT - Submit Answer
async function handleSubmitAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { question_id, answer_text } = body;
  if (!question_id) return err('question_id required');

  const db = await getDb();

  // Upsert answer
  const existing = await db.collection('assessment_answers').findOne({
    user_id: user.id,
    question_id,
  });

  if (existing) {
    await db.collection('assessment_answers').updateOne(
      { user_id: user.id, question_id },
      { $set: { answer_text, updated_at: new Date() } }
    );
  } else {
    await db.collection('assessment_answers').insertOne({
      id: uuidv4(),
      user_id: user.id,
      question_id,
      answer_text: answer_text || '',
      created_at: new Date(),
    });
  }

  return ok({ success: true });
}

// ASSESSMENT - Complete (save bot name)
async function handleAssessmentComplete(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { assistant_name } = body;

  const db = await getDb();
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: { assistant_name: assistant_name || 'SoulPrint', assessment_complete: true } }
  );

  return ok({ success: true });
}

// CONVERSATIONS - Get all for user
async function handleGetConversations(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  const db = await getDb();
  
  let query = {};
  
  if (projectId === 'general' || projectId === 'uncategorized') {
    // Get uncategorized conversations
    query = { 
      user_id: user.id,
      $or: [{ project_id: { $exists: false } }, { project_id: null }, { project_id: 'general' }]
    };
  } else if (projectId) {
    // Get conversations for a specific project (need to verify access)
    const project = await db.collection('projects').findOne({
      id: projectId,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    if (!project) return err('Project not found', 404);
    query = { project_id: projectId };
  } else {
    // Get all user's conversations + conversations in shared projects
    // Exclude conversations hidden from "All Chats" view
    const sharedProjects = await db.collection('projects')
      .find({ 'shared_with.user_id': user.id, 'shared_with.accepted': true })
      .toArray();
    const sharedProjectIds = sharedProjects.map(p => p.id);
    
    query = {
      $and: [
        {
          $or: [
            { user_id: user.id },
            { project_id: { $in: sharedProjectIds } }
          ]
        },
        // Exclude conversations that are hidden from All Chats
        { $or: [{ hidden_from_all_chats: { $exists: false } }, { hidden_from_all_chats: false }] }
      ]
    };
  }

  const conversations = await db.collection('conversations')
    .find(query)
    .sort({ updated_at: -1 })
    .limit(100)
    .toArray();

  return ok(conversations.map(c => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    updated_at: c.updated_at,
    source: c.source || 'web',
    project_id: c.project_id || null,
    tags: c.tags || [],
    is_mine: c.user_id === user.id,
  })));
}

// CONVERSATIONS - Create
async function handleCreateConversation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const { project_id } = body;
  const db = await getDb();
  const now = new Date();

  const conv = {
    id: uuidv4(),
    user_id: user.id,
    title: body.title || 'New Conversation',
    created_at: now,
    updated_at: now,
  };

  // If project_id is provided and valid (not 'general' or null), add it
  if (project_id && project_id !== 'general') {
    // Verify user has access to this project
    const project = await db.collection('projects').findOne({
      id: project_id,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    if (project) {
      conv.project_id = project_id;
    }
  }

  await db.collection('conversations').insertOne(conv);
  return ok({ id: conv.id, title: conv.title, created_at: conv.created_at });
}

// CONVERSATIONS - Rename
async function handleRenameConversation(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const { title } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return err('Title is required', 400);
  }

  const db = await getDb();
  
  // Verify conversation belongs to user
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  // Update the title
  await db.collection('conversations').updateOne(
    { id: conversationId },
    { $set: { title: title.trim(), updated_at: new Date() } }
  );

  return ok({ success: true, title: title.trim() });
}

// CONVERSATIONS - Delete
async function handleDeleteConversation(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get context from query params (from_project=true means deleting from project view)
  const { searchParams } = new URL(request.url);
  const fromProject = searchParams.get('from_project') === 'true';
  
  // Verify conversation belongs to user
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  // Debug logging
  console.log('[DELETE CONV] ID:', conversationId, '| project_id:', conv.project_id, '| fromProject:', fromProject);

  // If deleting from "All Chats" view and the conversation belongs to a project,
  // just hide it from All Chats instead of permanently deleting
  if (!fromProject && conv.project_id && conv.project_id !== 'general') {
    console.log('[DELETE CONV] Hiding from All Chats (keeping in project)');
    await db.collection('conversations').updateOne(
      { id: conversationId },
      { $set: { hidden_from_all_chats: true, updated_at: new Date() } }
    );
    return ok({ success: true, hidden: true });
  }

  // Otherwise, permanently delete the conversation
  console.log('[DELETE CONV] Permanently deleting');
  await db.collection('conversations').deleteOne({ id: conversationId });
  
  // Delete all messages in the conversation
  await db.collection('messages').deleteMany({ conversation_id: conversationId });

  return ok({ success: true, deleted: true });
}


// ============================================================
// VOICE SESSIONS (Admin view)
// ============================================================

async function handleGetVoiceSessions(request) {
  try {
    const user = await authenticate(request);
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const page = parseInt(url.searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    const sessions = await db.collection('voice_sessions')
      .find({})
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('voice_sessions').countDocuments();

    // Calculate aggregate stats
    const stats = await db.collection('voice_sessions').aggregate([
      {
        $group: {
          _id: null,
          total_sessions: { $sum: 1 },
          total_duration: { $sum: '$duration_seconds' },
          avg_duration: { $avg: '$duration_seconds' },
          total_messages: { $sum: '$message_count' },
          completed_count: { 
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
          },
        }
      }
    ]).toArray();

    const aggregateStats = stats[0] || {
      total_sessions: 0,
      total_duration: 0,
      avg_duration: 0,
      total_messages: 0,
      completed_count: 0,
    };

    return NextResponse.json({
      sessions,
      total,
      page,
      limit,
      stats: aggregateStats,
    });
  } catch (err) {
    console.error('[Voice] Get sessions error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// ============================================================
// RESOLVE ISSUE - Notify user via email, in-app, and conversation
// ============================================================

async function handleAdminResolveIssue(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Unauthorized', 401);

  const body = await request.json();
  const { user_email, conversation_id, message, subject_suffix } = body;

  if (!user_email || !message) {
    return err('user_email and message are required', 400);
  }

  const db = await getDb();
  const results = { email: false, notification: false, conversation_message: false };

  // 1. Find the user
  const user = await db.collection('users').findOne({ email: user_email.toLowerCase().trim() });

  // 2. Create in-app notification
  try {
    const notification = {
      id: uuidv4(),
      user_id: user?.id || null,
      user_email: user_email.toLowerCase().trim(),
      conversation_id: conversation_id || null,
      type: 'issue_resolved',
      title: 'Issue Resolved',
      message: message,
      read: false,
      resolved_by: admin.email,
      created_at: new Date(),
    };
    await db.collection('notifications').insertOne(notification);
    results.notification = true;
    console.log('[ResolveIssue] Created notification for', user_email);
  } catch (e) {
    console.error('[ResolveIssue] Notification error:', e);
  }

  // 3. Inject message into original conversation (if conversation_id provided)
  if (conversation_id) {
    try {
      const systemMessage = {
        id: uuidv4(),
        role: 'system',
        content: `🔧 **Issue Resolved**\n\n${message}\n\n— *SoulPrint Support Team*`,
        timestamp: new Date().toISOString(),
        type: 'support_resolution',
      };
      
      const updateResult = await db.collection('conversations').updateOne(
        { id: conversation_id },
        { $push: { messages: systemMessage } }
      );
      results.conversation_message = updateResult.modifiedCount > 0;
      console.log('[ResolveIssue] Conversation message injected:', results.conversation_message);
    } catch (e) {
      console.error('[ResolveIssue] Conversation message error:', e);
    }
  }

  // 4. Send email via Resend
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const subjectLine = subject_suffix 
      ? `[SoulPrint Engine Support] ${subject_suffix}`
      : `[SoulPrint Engine Support] Your reported issue has been resolved`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0a0a0a;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#111111;border-radius:16px;border:1px solid #222;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 16px;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">SoulPrint Engine</h1>
          <p style="margin:8px 0 0;font-size:13px;color:#666;">Support Notification</p>
        </td></tr>
        <!-- Divider -->
        <tr><td style="padding:0 32px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#333,transparent);"></div></td></tr>
        <!-- Content -->
        <tr><td style="padding:24px 32px;">
          <div style="background-color:#0d2818;border:1px solid #1a4d2e;border-radius:12px;padding:20px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">✅ Issue Resolved</p>
            <p style="margin:12px 0 0;font-size:15px;color:#e0e0e0;line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          ${conversation_id ? `
          <p style="margin:20px 0 0;font-size:13px;color:#888;">
            This relates to conversation <code style="background:#1a1a1a;padding:2px 6px;border-radius:4px;color:#aaa;font-size:12px;">${conversation_id}</code>
          </p>` : ''}
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding:8px 32px 32px;text-align:center;">
          <a href="https://soulprintengine.ai/chat${conversation_id ? `?c=${conversation_id}` : ''}" 
             style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
            Open SoulPrint
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #222;">
          <p style="margin:0;font-size:12px;color:#555;">This is an automated message from SoulPrint Engine Support.</p>
          <p style="margin:4px 0 0;font-size:12px;color:#444;">If you have further questions, please reach out to us.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SoulPrint Engine <team@archeforge.com>',
        to: [user_email],
        subject: subjectLine,
        html: htmlContent,
      }),
    });

    if (emailRes.ok) {
      const emailData = await emailRes.json();
      results.email = true;
      console.log('[ResolveIssue] Email sent:', emailData.id);
    } else {
      const emailErr = await emailRes.json().catch(() => ({}));
      console.error('[ResolveIssue] Email error:', emailErr);
    }
  } catch (e) {
    console.error('[ResolveIssue] Email error:', e);
  }

  return ok({
    success: true,
    results,
    message: `Notification sent — Email: ${results.email ? '✅' : '❌'}, In-app: ${results.notification ? '✅' : '❌'}, Conversation: ${results.conversation_message ? '✅' : '❌'}`,
  });
}


async function handleAdminGetSupportHistory(request) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Unauthorized', 401);

  const db = await getDb();
  const resolutions = await db.collection('notifications')
    .find({ type: 'issue_resolved' })
    .sort({ created_at: -1 })
    .limit(50)
    .project({ user_email: 1, conversation_id: 1, message: 1, created_at: 1, resolved_by: 1, _id: 0 })
    .toArray();

  return ok({ resolutions });
}



// Handler: Get User Voice Stats - Get voice chat statistics for a specific user

// ============================================================
// ROUTER
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'users') return handleAdminGetUsers(request);
    if (pathStr === 'users/export') return handleAdminExportUsers(request);
    if (pathStr === 'users/export/filters') return handleAdminGetExportFilters(request);
    if (pathStr.startsWith('users/') && pathArr.length === 2 && !pathStr.includes('export')) {
      return handleAdminGetUserDetails(request, pathArr[1]);
    }
    if (pathStr === 'metrics') return handleAdminGetMetrics(request);
    if (pathStr === 'questions') return handleAdminGetQuestions(request);
    if (pathStr === 'conversations') return handleAdminGetConversations(request);
    if (pathStr === 'imports') return handleAdminGetImports(request);
    if (pathStr === 'settings') return handleAdminGetSettings(request);
    if (pathStr === 'waitlist') return handleAdminGetWaitlist(request);
    if (pathStr === 'feedback') return handleAdminGetFeedback(request);
    if (pathStr === 'beta-code/stats') return handleAdminGetBetaCodeStats(request);
    if (pathStr === 'beta-groups') return handleAdminGetBetaGroups(request);
    if (pathStr === 'beta-codes') return handleAdminGetBetaCodes(request);
    if (pathStr === 'beta-redemptions') return handleAdminGetBetaRedemptions(request);
    if (pathStr === 'announcements') return handleAdminGetAnnouncements(request);
    if (pathStr === 'app-updates') return handleAdminGetAppUpdates(request);
    if (pathStr === 'invites/stats') return handleAdminGetInviteStats(request);
    if (pathStr === 'insights') return handleAdminGetBusinessInsights(request);
    if (pathStr === 'pricing-features') return handleAdminGetPricingFeatures(request);
    if (pathStr === 'pricing-features/calculate') return handleAdminCalculatePricing(request);
    if (pathStr === 'voice-sessions') return handleGetVoiceSessions(request);
    if (pathStr === 'support-history') return handleAdminGetSupportHistory(request);
    if (pathStr === 'blog/posts') return handleAdminGetBlogPosts(request);

    return err('Admin endpoint not found', 404);
  } catch (error) {
    console.error('[Admin API] GET Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'questions/seed') return handleAdminSeedQuestions(request);
    if (pathStr === 'invite') return handleAdminInviteAdmin(request);
    if (pathStr === 'users') return handleAdminCreateUser(request);
    if (pathStr === 'settings') return handleAdminUpdateSettings(request);
    if (pathStr === 'waitlist/approve') return handleAdminApproveWaitlist(request);
    if (pathStr === 'feedback/summarize') return handleAdminSummarizeFeedback(request);
    if (pathStr === 'announcements') return handleAdminCreateAnnouncement(request);
    if (pathStr === 'app-updates') return handleAdminCreateAppUpdate(request);
    if (pathStr === 'app-updates/generate') return handleAdminGenerateReleaseNotes(request);
    if (pathStr === 'blog/posts') return handleAdminCreateBlogPost(request);
    if (pathStr === 'beta-code') return handleAdminCreateBetaCode(request);
    if (pathStr === 'beta-code/send') return handleAdminSendBetaCode(request);
    if (pathStr === 'beta-groups') return handleAdminCreateBetaGroup(request);
    if (pathStr === 'beta-codes') return handleAdminCreateBetaCodes(request);
    if (pathStr === 'invites/toggle') return handleAdminToggleViralInvites(request);
    if (pathStr === 'invites/grant') return handleAdminGrantInvites(request);
    if (pathStr === 'pricing-features') return handleAdminAddPricingFeature(request);
    if (pathStr === 'pricing-features/update') return handleAdminUpdatePricingFeature(request);
    if (pathStr === 'resolve-issue') return handleAdminResolveIssue(request);

    return err('Admin endpoint not found', 404);
  } catch (error) {
    console.error('[Admin API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function PUT(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr.startsWith('users/') && pathStr.endsWith('/accept')) {
      return handleAdminUpdateUser(request, pathArr[1]);
    }
    if (pathStr.startsWith('users/') && pathStr.endsWith('/reset-passcode')) {
      return handleAdminResetPasscode(request, pathArr[1]);
    }
    if (pathStr.startsWith('users/') && pathArr.length === 2) {
      return handleAdminUpdateUser(request, pathArr[1]);
    }
    if (pathStr.startsWith('questions/') && pathArr.length === 2) {
      return handleAdminUpdateQuestion(request, pathArr[1]);
    }
    if (pathStr.startsWith('feedback/') && pathArr.length === 2) {
      return handleAdminUpdateFeedback(request, pathArr[1]);
    }
    if (pathStr.startsWith('announcements/') && pathArr.length === 2) {
      return handleAdminUpdateAnnouncement(request, pathArr[1]);
    }
    if (pathStr.startsWith('app-updates/') && pathArr.length === 2) {
      return handleAdminUpdateAppUpdate(request, pathArr[1]);
    }
    if (pathStr.startsWith('blog/posts/') && pathArr.length === 3) {
      return handleAdminUpdateBlogPost(request, pathArr[2]);
    }
    if (pathStr === 'beta-codes') return handleAdminUpdateBetaCode(request);

    return err('Admin endpoint not found', 404);
  } catch (error) {
    console.error('[Admin API] PUT Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr.startsWith('announcements/') && pathArr.length === 2) {
      return handleAdminDeleteAnnouncement(request, pathArr[1]);
    }
    if (pathStr.startsWith('app-updates/') && pathArr.length === 2) {
      return handleAdminDeleteAppUpdate(request, pathArr[1]);
    }
    if (pathStr.startsWith('users/') && pathArr.length === 2) {
      return handleAdminDeleteUser(request, pathArr[1]);
    }
    if (pathStr.startsWith('blog/posts/') && pathArr.length === 3) {
      return handleAdminDeleteBlogPost(request, pathArr[2]);
    }
    if (pathStr === 'beta-code') return handleAdminDeleteBetaCode(request);
    if (pathStr === 'beta-groups') return handleAdminDeleteBetaGroup(request);
    if (pathStr === 'beta-codes') return handleAdminDeleteBetaCodeV2(request);
    if (pathStr === 'pricing-features') return handleAdminDeletePricingFeature(request);

    return err('Admin endpoint not found', 404);
  } catch (error) {
    console.error('[Admin API] DELETE Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
