'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function formatDisplay(code) {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export default function ActivatePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (!token) router.push('/auth?reason=login_required');
  }, [router]);

  const handleCode = (v) => {
    const cleaned = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(cleaned);
  };

  const submit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('sp_token');
    if (!token) { router.push('/auth'); return; }

    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/oauth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_code: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'approved') {
        setStatus('success');
        setMessage('Device authorized. You can close this tab and return to your terminal.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Check the code and try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Try again.');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-2xl font-semibold text-white">Authorize SoulPrint</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enter the 8-character code shown in your terminal to connect this device
          to your SoulPrint account.
        </p>

        {status === 'success' ? (
          <div className="mt-6 rounded-lg border border-emerald-700 bg-emerald-900/30 p-4 text-sm text-emerald-300">
            ✓ {message}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <input
              value={formatDisplay(code)}
              onChange={(e) => handleCode(e.target.value)}
              placeholder="ABCD-1234"
              autoFocus
              maxLength={9}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-center font-mono text-xl tracking-widest text-white placeholder-zinc-500 outline-none focus:border-teal-500"
            />
            {status === 'error' && (
              <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={code.length !== 8 || status === 'loading'}
              className="w-full rounded-lg bg-teal-500 px-4 py-3 font-medium text-zinc-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === 'loading' ? 'Authorizing…' : 'Authorize device'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
