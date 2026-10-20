'use client';

/**
 * /claim — finish a founder purchase.
 *
 * A buyer arrives here from the claim email with a one-time token. They set a
 * password and land signed in with lifetime access already attached. Nothing here
 * creates the account; the server does that on submit, keyed to the email that paid.
 *
 * If the link is expired or already used we say so plainly and give them a way back
 * — a dead end here means someone who already paid cannot get in.
 */

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ClaimContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState(token ? 'idle' : 'invalid'); // idle|loading|done|error|invalid
  const [message, setMessage] = useState(
    token ? '' : 'This link is missing its token. Check the email we sent you.'
  );

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = state === 'idle' && password.length >= 8 && password === confirm;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setState('loading');
    setMessage('');

    try {
      const res = await fetch('/api/auth/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setMessage(data.error || 'We could not finish setting up your account.');
        setState('error');
        return;
      }

      if (data.token) {
        try { localStorage.setItem('sp_token', data.token); } catch {}
      }
      setState('done');
      // Give the confirmation a beat to register, then drop them into the app.
      setTimeout(() => { window.location.href = '/'; }, 1400);
    } catch (err) {
      setMessage('Network error. Please try again.');
      setState('error');
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-5 py-14">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5531A" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <p className="text-[11px] tracking-[0.18em] uppercase text-orange-500 font-bold mb-2">
          Founding member
        </p>

        {state === 'done' ? (
          <>
            <h1 className="text-2xl font-semibold text-white mb-3">You&rsquo;re all set.</h1>
            <p className="text-white/60 leading-relaxed">
              Lifetime Passport access is on your account. Taking you in&hellip;
            </p>
          </>
        ) : state === 'invalid' ? (
          <>
            <h1 className="text-2xl font-semibold text-white mb-3">This link isn&rsquo;t complete</h1>
            <p className="text-white/60 leading-relaxed mb-7">{message}</p>
            <a href="/auth" className="text-orange-500 hover:text-orange-400 text-sm font-medium">
              Go to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-white mb-3">Set your password</h1>
            <p className="text-white/60 leading-relaxed mb-7">
              One step left. Pick a password and your founder access is ready.
            </p>

            <form onSubmit={submit} className="space-y-3 text-left">
              <input
                type="password"
                placeholder="NEW PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 text-xs tracking-widest py-4 px-4 rounded-lg focus:border-orange-500/50 outline-none transition-colors"
              />
              <input
                type="password"
                placeholder="CONFIRM PASSWORD"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 text-xs tracking-widest py-4 px-4 rounded-lg focus:border-orange-500/50 outline-none transition-colors"
              />

              <p className="text-[11px] text-white/40 pl-1">
                {tooShort
                  ? 'At least 8 characters.'
                  : mismatch
                    ? 'Passwords do not match.'
                    : 'At least 8 characters.'}
              </p>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors"
              >
                {state === 'loading' ? 'Setting up…' : 'Claim my founder access'}
              </button>

              {message && (
                <p className="text-red-400 text-sm pt-1">{message}</p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// useSearchParams() forces this route to be dynamic, and Next requires a Suspense
// boundary around it or the prerender pass fails at build time.
export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <p className="text-white/40 text-sm">Loading…</p>
        </div>
      }
    >
      <ClaimContent />
    </Suspense>
  );
}
