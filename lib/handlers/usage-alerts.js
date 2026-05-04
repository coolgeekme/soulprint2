/**
 * Usage Alert Service
 * 
 * Checks user's current usage against their plan limits and sends
 * email alerts when they cross the 80% and 95% thresholds.
 * 
 * Deduplicates alerts using a `usage_alerts_sent` collection so
 * users only get one email per threshold per billing period.
 */
import { getDb } from '@/lib/mongodb';
import { sendUsageAlertEmail } from '@/lib/email';

const ALERT_THRESHOLDS = [80, 95, 100]; // Percent thresholds to alert at

/**
 * Check and send usage alerts for a user after a generation/message.
 * Should be called AFTER incrementing usage counters.
 * 
 * @param {string} userId 
 * @param {string} usageType - 'messages' | 'images' | 'videos' | 'pdfs'
 * @param {number} currentUsage - Current usage count
 * @param {number} limit - Plan limit for this usage type
 */
export async function checkAndSendUsageAlert(userId, usageType, currentUsage, limit) {
  // Don't alert if limit is 0 (feature blocked) or unlimited (-1 or very high)
  if (!limit || limit <= 0 || limit >= 999999) return;
  
  const percentUsed = Math.round((currentUsage / limit) * 100);
  
  // Check if we've crossed any threshold
  const crossedThreshold = ALERT_THRESHOLDS.find(t => percentUsed >= t);
  if (!crossedThreshold) return;
  
  try {
    const db = await getDb();
    const alertsCol = db.collection('usage_alerts_sent');
    
    // Determine the billing period key (daily for messages, monthly for others)
    const now = new Date();
    const periodKey = usageType === 'messages' 
      ? `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`  // Daily
      : `${now.getFullYear()}-${now.getMonth() + 1}`;  // Monthly
    
    // Check if we already sent this alert for this threshold in this period
    const alertKey = `${userId}:${usageType}:${crossedThreshold}:${periodKey}`;
    const existingAlert = await alertsCol.findOne({ alert_key: alertKey });
    
    if (existingAlert) return; // Already sent for this threshold & period
    
    // Get user email
    const usersCol = db.collection('users');
    const user = await usersCol.findOne({ id: userId }) || await usersCol.findOne({ user_id: userId });
    
    if (!user?.email) return;
    
    // Send the alert email
    await sendUsageAlertEmail(
      user.email,
      user.name || user.display_name,
      usageType,
      currentUsage,
      limit,
      percentUsed
    );
    
    // Record that we sent this alert
    await alertsCol.insertOne({
      alert_key: alertKey,
      user_id: userId,
      usage_type: usageType,
      threshold: crossedThreshold,
      percent_used: percentUsed,
      current_usage: currentUsage,
      limit,
      period_key: periodKey,
      sent_at: new Date(),
    });
    
    console.log(`[UsageAlert] Sent ${crossedThreshold}% alert to ${user.email} for ${usageType} (${currentUsage}/${limit})`);
  } catch (err) {
    // Non-critical — don't crash the main flow
    console.error('[UsageAlert] Failed to check/send alert:', err.message);
  }
}

/**
 * Clean up old alert records (call periodically or on a cron).
 * Removes alerts older than 35 days to keep the collection small.
 */
export async function cleanupOldAlerts() {
  try {
    const db = await getDb();
    const cutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const result = await db.collection('usage_alerts_sent').deleteMany({ sent_at: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      console.log(`[UsageAlert] Cleaned up ${result.deletedCount} old alert records`);
    }
  } catch (err) {
    console.error('[UsageAlert] Cleanup failed:', err.message);
  }
}
