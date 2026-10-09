'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Check, AlertCircle, ArrowLeft } from 'lucide-react';

// ── /upgrade ─────────────────────────────────────────────────────────────────
//
// The destination for every "Subscribe" button that starts on the product site.
//
// WHY THIS PAGE EXISTS
// --------------------
// soulprintpassport.ai/pricing linked to `soulprintengine.ai/auth?plan=passport`,
// and /auth never read the `plan` parameter. So a visitor clicked Subscribe, created
// an account, and arrived nowhere — no checkout, no explanation. The intent was
// dropped at the sign-in boundary.
//
// This page is the other end of that handoff. The product site now sends people to
// `/auth?next=/upgrade?plan=passport`, which /auth already understands (it validates
// `next` as a same-origin path), so the plan survives sign-in and lands here.
//
// TWO STATES, ONE PAGE
// --------------------
// While we are in beta nothing is purchasable — the site promises "free, no card, no
// commitment". Rather than hide the button or dead-end the user, this page says so
// plainly and points at what they can do right now.
//
// Once beta ends and the plans go active, the same page starts a real checkout with
// no further changes, because it asks the API which plans are purchasable instead of
// assuming.

// Plans that are one-time purchases rather than subscriptions. The founding lifetime
// tiers are not modelled in the billing backend yet (createCheckoutSession only does
// recurring subscriptions), so they get an honest message instead of a broken button.
const ONE_TIME_PLANS = new Set(['founder', 'founding']);

const PLAN_LABELS = {
  passport: 'Passport',
  founder: 'Founding Lifetime',
  founding: 'Founding Lifetime',
};

// useSearchParams() forces this route to be dynamic, and Next.js requires a
// Suspense boundary around it or the prerender pass fails at build time. The fallback
// mirrors the 'checking' state so there is no flash before the client takes over.
function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = (searchParams.get('plan') || 'passport').toLowerCase();

  const [state, setState] = useState('checking');  // checking | beta | ready | redirecting | error | signedout
  const [message, setMessage] = useState('');

  const goToAuth = useCallback(() => {
    // Preserve the intent across sign-in. /auth validates `next` as same-origin.
    const next = encodeURIComponent(`/upgrade?plan=${encodeURIComponent(planId)}`);
    router.replace(`/auth?next=${next}`);
  }, [router, planId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('sp_token') : null;
      if (!token) {
        if (!cancelled) setState('signedout');
        goToAuth();
        return;
      }

      try {
        const res = await fetch('/api/pricing/plans');
        const data = await res.json();
        const plans = data.plans || [];

        const plan = plans.find(p => p.id === planId);
        if (!cancelled && !plan) {
          // Not in the purchasable list. During beta that is every paid plan.
          setState('beta');
          return;
        }
        if (!cancelled) setState('ready');
      } catch (e) {
        if (!cancelled) {
          setState('error');
          setMessage('We could not load the plans. Please try again.');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [planId, goToAuth]);

  const startCheckout = async () => {
    setState('redirecting');
    const token = localStorage.getItem('sp_token');
    try {
      const res = await fetch('/api/pricing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        // originUrl is no longer trusted or required — the server resolves the
        // post-checkout origin itself. Sent only so older server builds still work.
        body: JSON.stringify({ planId, billingPeriod: 'monthly', originUrl: window.location.origin }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      if (data.redirect) { window.location.href = data.redirect; return; }
      setState('error');
      setMessage(data.error || 'Unable to start checkout.');
    } catch (e) {
      setState('error');
      setMessage(e.message || 'Unable to start checkout.');
    }
  };

  const label = PLAN_LABELS[planId] || 'Passport';

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0B0F14] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">

        {state === 'checking' && (
          <>
            <Loader2 className="w-6 h-6 mx-auto mb-4 animate-spin text-white/60" />
            <p className="text-white/60">Checking your account…</p>
          </>
        )}

        {state === 'signedout' && (
          <>
            <Loader2 className="w-6 h-6 mx-auto mb-4 animate-spin text-white/60" />
            <p className="text-white/60">Taking you to sign in…</p>
          </>
        )}

        {state === 'beta' && (
          <>
            <div className="mx-auto mb-6 w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">You&rsquo;re already in</h1>
            <p className="text-white/60 leading-relaxed mb-8">
              {ONE_TIME_PLANS.has(planId)
                ? `${label} isn't on sale yet. Passport is free while we're in beta — no card, no commitment.`
                : `Passport is free while we're in beta. Everything is included, so there's nothing to buy today.`}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/chat"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition"
              >
                Start using Passport
              </Link>
              <a
                href="https://soulprintpassport.ai/pricing"
                className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-white/15 text-white/80 hover:bg-white/5 transition"
              >
                See what&rsquo;s coming
              </a>
            </div>
          </>
        )}

        {state === 'ready' && (
          <>
            <div className="mx-auto mb-6 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Check className="w-5 h-5 text-white/60" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">{label}</h1>
            <p className="text-white/60 leading-relaxed mb-8">
              You&rsquo;ll be taken to secure checkout. Nothing is charged until you confirm.
            </p>
            <button
              onClick={startCheckout}
              className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition"
            >
              Continue to checkout
            </button>
          </>
        )}

        {state === 'redirecting' && (
          <>
            <div className="mx-auto mb-6 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">Taking you to checkout</h1>
            <p className="text-white/60 leading-relaxed">
              If nothing happens in a few seconds, reload this page.
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="mx-auto mb-6 w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">Something went wrong</h1>
            <p className="text-white/60 leading-relaxed mb-8">{message}</p>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-white/15 text-white/80 hover:bg-white/5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to chat
            </Link>
          </>
        )}

      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0F14] text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <Loader2 className="w-6 h-6 mx-auto mb-4 animate-spin text-white/60" />
          <p className="text-white/60">Loading…</p>
        </div>
      </div>
    }>
      <UpgradeContent />
    </Suspense>
  );
}
