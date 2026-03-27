/**
 * Announcements, App Updates, PWA Install Status
 * Extracted from the main catch-all route.js for maintainability.
 */

import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';
import { getProvider } from '@/lib/llm/providers';
import { writeFile, mkdir } from 'fs/promises';

// ============================================================
// ANNOUNCEMENTS SYSTEM
// ============================================================

// ADMIN - Create announcement

// ADMIN - Get all announcements

// ADMIN - Update announcement

// ADMIN - Delete announcement

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

// ADMIN - Create app update

// ADMIN - Update app update

// ADMIN - Delete app update

// ── AUTO-GENERATE RELEASE NOTES ON DEPLOYMENT ──────────────────────────────
// This runs automatically on first request after a new deployment.
// It uses a timestamp-based approach that works in both dev and production (no git required).

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
async function handleGetInstallPromptStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const prefs = await db.collection('user_preferences').findOne({ user_id: user.id });
  
  // Check if user has installed the app
  const installed = prefs?.pwa_installed || false;
  // Check if user dismissed forever
  const dismissedForever = prefs?.pwa_dismissed_forever || false;
  // Check if user clicked "remind me later" - only hide for 24 hours
  const remindLaterAt = prefs?.pwa_remind_later_at;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const shouldRemind = !remindLaterAt || new Date(remindLaterAt) < twentyFourHoursAgo;
  
  // Show prompt if: not installed, not dismissed forever, and (never reminded OR reminded > 24h ago)
  const showPrompt = !installed && !dismissedForever && shouldRemind;

  return ok({ 
    showPrompt,
    installed,
    dismissedForever,
  });
}

// PWA Install Prompt - Update install prompt preference
async function handleUpdateInstallPromptStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { action } = body; // 'installed' | 'remind_later' | 'dismiss_forever'

  if (!['installed', 'remind_later', 'dismiss_forever'].includes(action)) {
    return err('Invalid action', 400);
  }

  const db = await getDb();
  const updates = {};

  if (action === 'installed') {
    updates.pwa_installed = true;
  } else if (action === 'remind_later') {
    updates.pwa_remind_later_at = new Date();
  } else if (action === 'dismiss_forever') {
    updates.pwa_dismissed_forever = true;
  }

  await db.collection('user_preferences').updateOne(
    { user_id: user.id },
    { $set: updates },
    { upsert: true }
  );

  return ok({ success: true });
}


export {
  handleGetAnnouncements,
  handleDismissAnnouncement,
  handleAnnouncementClick,
  handleRestoreAnnouncement,
  handleGetAppUpdates,
  handleMarkAppUpdatesViewed,
  handleGetInstallPromptStatus,
  handleUpdateInstallPromptStatus,
  checkAndGenerateReleaseNotes,
};
