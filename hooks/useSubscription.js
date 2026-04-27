'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useSubscription — Phase 4: Grace Period Enforcement
 * 
 * Fetches user's plan limits + usage from /api/pricing/access-check.
 * Provides helpers to determine if features require upgrade nudges.
 * Returns null when pricing gate is inactive (pre-launch).
 */
export function useSubscription(token) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef({ data: null, fetchedAt: 0 });

  const fetchAccess = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    
    // Cache for 5 minutes
    const now = Date.now();
    if (cacheRef.current.data && now - cacheRef.current.fetchedAt < 5 * 60 * 1000) {
      setData(cacheRef.current.data);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/pricing/access-check', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      
      // If pricing is gated (not yet active), don't show banners
      if (json.gated) {
        setData(null);
        setLoading(false);
        return;
      }

      cacheRef.current = { data: json, fetchedAt: now };
      setData(json);
    } catch {
      // Silently fail — no banners is better than broken UI
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  // Invalidate cache (call after usage changes, e.g., after image generation)
  const refresh = useCallback(() => {
    cacheRef.current = { data: null, fetchedAt: 0 };
    fetchAccess();
  }, [fetchAccess]);

  // Check if a specific model is premium
  const isModelPremium = useCallback((modelId) => {
    if (!data?.premium_model_ids) return false;
    return data.premium_model_ids.includes(modelId);
  }, [data]);

  // Check if user's plan allows premium models
  const canUsePremiumModels = useCallback(() => {
    if (!data) return true; // If no data, don't restrict
    return data.features?.chat_model_tier === 'all';
  }, [data]);

  // Get warnings for a specific feature
  const getWarning = useCallback((feature) => {
    if (!data?.warnings) return null;
    return data.warnings.find(w => w.feature === feature) || null;
  }, [data]);

  return {
    plan: data,
    loading,
    refresh,
    isModelPremium,
    canUsePremiumModels,
    getWarning,
    isPremiumModel: isModelPremium,
    warnings: data?.warnings || [],
  };
}
