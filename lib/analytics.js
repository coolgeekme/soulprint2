'use client';

const ATTRIBUTION_KEY = 'sp_first_touch_attribution';
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

export function captureFirstTouchAttribution() {
  if (typeof window === 'undefined') return {};
  try {
    const existing = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || 'null');
    if (existing) return existing;
    const params = new URLSearchParams(window.location.search);
    const campaign = Object.fromEntries(
      CAMPAIGN_KEYS.map((key) => [key, params.get(key)]).filter(([, value]) => value)
    );
    const attribution = {
      ...campaign,
      landing_page: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || '',
      captured_at: new Date().toISOString(),
    };
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return {};
  }
}

export function getFirstTouchAttribution() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || '{}');
  } catch {
    return {};
  }
}

export function trackEvent(event, properties = {}) {
  if (typeof window === 'undefined') return;
  const payload = { ...getFirstTouchAttribution(), ...properties };
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, payload);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...payload });
}
