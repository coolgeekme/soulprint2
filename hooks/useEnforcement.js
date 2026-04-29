'use client';
import { useState, useEffect, useCallback } from 'react';

/**
 * useEnforcement Hook
 * 
 * Fetches the user's enforcement status and usage summary from the backend.
 * All enforcement UI components consume this hook to determine what to show.
 * 
 * Before May 1st: enforcement_active = false → no enforcement UI visible
 * After May 1st: enforcement_active = true (for applicable users) → show enforcement UI
 */
export function useEnforcement(token) {
  const [status, setStatus] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchEnforcement = useCallback(async () => {
    if (!token) return;
    try {
      const [statusRes, usageRes] = await Promise.all([
        fetch('/api/pricing/enforcement', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/pricing/enforcement/usage', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }
    } catch (e) {
      console.warn('[useEnforcement] Failed to fetch:', e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEnforcement();
    // Refresh every 5 minutes
    const interval = setInterval(fetchEnforcement, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEnforcement]);

  return {
    status,
    usage,
    loading,
    refresh: fetchEnforcement,
    // Convenience getters
    isEnforcementActive: status?.enforcement_active === true,
    cohort: status?.cohort || 'unknown',
    effectivePlan: status?.effective_plan || 'free',
    daysRemaining: status?.days_remaining,
    showCountdown: status?.show_countdown === true,
    isTrial: status?.is_trial === true,
    trialLimitHit: status?.trial_limit_hit === true,
    choosePlanPrompt: status?.choose_plan_prompt === true,
  };
}
