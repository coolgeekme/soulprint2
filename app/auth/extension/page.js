'use client';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function ExtensionAuthPage() {
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Check if already logged in (token in URL hash from redirect)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      const token = hash.split('token=')[1]?.split('&')[0];
      if (token) {
        handleTokenReceived(token);
      }
    }
  }, []);

  // Send token back to the extension via postMessage
  function sendTokenToExtension(token, email) {
    window.postMessage(
      {
        source: 'soulprint-engine',
        type: 'AUTH_TOKEN',
        token,
      },
      'https://soulprintengine.ai'
    );

    console.log('[Extension Auth] ✅ Token sent to extension:', email);
    setSuccess(true);
  }

  // If token came from URL hash (redirect flow), use it directly
  async function handleTokenReceived(token) {
    setLoading(true);
    // Verify the token is valid
    try {
      const res = await fetch('/api/auth/verify-token', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.connected) {
        sendTokenToExtension(token, data.user?.email);
      } else {
        setError('Session expired. Please sign in again.');
      }
    } catch (e) {
      setError('Connection failed. Please try again.');
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, passcode }),
      });

      const data = await res.json();

      if (data.token) {
        sendTokenToExtension(data.token, email);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (e) {
      setError('Connection failed. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0D1217] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-[#F64000]" />
            <span className="text-white text-lg font-semibold tracking-tight">SoulPrint</span>
          </div>
          <p className="text-[#707176] text-sm">Connect your account to the extension</p>
        </div>

        {/* Success state */}
        {success && (
          <div className="bg-[#141a21] border border-[#1e2a1e] rounded-lg p-6 text-center">
            <div className="text-green-400 text-5xl mb-3">✓</div>
            <h2 className="text-white text-lg font-semibold mb-1">Connected!</h2>
            <p className="text-[#707176] text-sm">
              Your SoulPrint account is now linked to the extension.
              You can close this tab and return to the extension.
            </p>
          </div>
        )}

        {/* Login form */}
        {!success && (
          <form onSubmit={handleSubmit} className="bg-[#141a21] rounded-lg p-6 border border-[#202830]">
            {error && (
              <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-[#D2D3D7] text-sm mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full bg-[#0D1217] border border-[#202830] rounded-md px-3 py-2.5 text-white text-sm placeholder:text-[#505056] focus:outline-none focus:border-[#F64000] transition-colors"
              />
            </div>

            <div className="mb-6">
              <label className="block text-[#D2D3D7] text-sm mb-1.5">Passcode</label>
              <input
                type="password"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder="Your passcode"
                required
                className="w-full bg-[#0D1217] border border-[#202830] rounded-md px-3 py-2.5 text-white text-sm placeholder:text-[#505056] focus:outline-none focus:border-[#F64000] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F64000] hover:bg-[#d63600] disabled:opacity-50 text-white font-medium rounded-md py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Extension'
              )}
            </button>

            <p className="text-[#505056] text-xs text-center mt-4">
              Enter the same email and passcode you use at soulprintengine.ai
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
