'use client';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { signInWithGoogle } from '@/lib/firebase';

export default function ExtensionAuthPage() {
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
  function sendTokenToExtension(token) {
    window.postMessage(
      {
        source: 'soulprint-engine',
        type: 'AUTH_TOKEN',
        token,
      },
      'https://soulprintengine.ai'
    );
    setSuccess(true);
  }

  // If token came from URL hash (redirect flow), use it directly
  async function handleTokenReceived(token) {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-token', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      if (data.connected) {
        sendTokenToExtension(token);
      } else {
        setError('Session expired. Please sign in again.');
      }
    } catch (e) {
      setError('Connection failed. Please try again.');
    }
    setLoading(false);
  }

  // Sync Firebase user with backend, get SoulPrint token
  async function syncWithBackend(firebaseUser, idToken) {
    const res = await fetch('/api/auth/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        uid: firebaseUser.uid,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to connect account');
    }

    return res.json();
  }

  // Handle Google Sign-In
  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError('');

    try {
      const { user, idToken, error: firebaseError } = await signInWithGoogle();

      if (firebaseError) {
        if (firebaseError.includes('popup-closed-by-user')) {
          setGoogleLoading(false);
          return;
        }
        if (firebaseError.includes('Firebase not configured')) {
          setError('Google sign-in is currently unavailable. Please use email/passcode.');
          setGoogleLoading(false);
          return;
        }
        throw new Error(firebaseError);
      }

      const data = await syncWithBackend(user, idToken);
      sendTokenToExtension(data.token);
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  // Handle email/passcode login
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
        sendTokenToExtension(data.token);
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
          <div className="bg-[#141a21] rounded-lg p-6 border border-[#202830]">
            {/* Google sign-in */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-800 font-medium rounded-md py-2.5 text-sm transition-colors flex items-center justify-center gap-2 mb-4"
            >
              {googleLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#202830]" />
              <span className="text-[#505056] text-xs">or</span>
              <div className="flex-1 h-px bg-[#202830]" />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
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
                disabled={loading || googleLoading}
                className="w-full bg-[#F64000] hover:bg-[#d63600] disabled:opacity-50 text-white font-medium rounded-md py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Sign in with Email'
                )}
              </button>

              <p className="text-[#505056] text-xs text-center mt-4">
                Enter the same email and passcode you use at soulprintengine.ai
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
