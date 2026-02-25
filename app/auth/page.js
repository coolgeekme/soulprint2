'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, KeyRound } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [latency] = useState(() => Math.floor(Math.random() * 30 + 10));
  const buildId = 'v2.4.1';
  const sessionId = () => Math.random().toString(36).slice(2, 10).toUpperCase();
  const [sid] = useState(sessionId);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Try login first
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, passcode }),
      });

      if (loginRes.ok) {
        const data = await loginRes.json();
        localStorage.setItem('sp_token', data.token);
        localStorage.setItem('sp_user', JSON.stringify(data));
        handlePostAuth(data);
        return;
      }

      const loginData = await loginRes.json();

      // Wrong password — show error, don't try to register
      if (loginRes.status === 401) {
        setError('Incorrect passcode. Please try again.');
        setLoading(false);
        return;
      }

      // User not found (404) → auto-register
      if (loginRes.status !== 404) {
        setError(loginData.error || 'Something went wrong');
        setLoading(false);
        return;
      }

      // Register new user
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, passcode, access_code: accessCode }),
      });

      if (!regRes.ok) {
        const d = await regRes.json();
        setError(d.error || 'Registration failed');
        setLoading(false);
        return;
      }

      const data = await regRes.json();
      localStorage.setItem('sp_token', data.token);
      localStorage.setItem('sp_user', JSON.stringify(data));
      handlePostAuth({ ...data, onboarding_complete: false });
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handlePostAuth(data) {
    if (!data.onboarding_complete) {
      router.push('/onboarding');
    } else if (!data.assessment_complete) {
      router.push('/assessment');
    } else if (!data.accepted && data.role === 'user') {
      router.push('/waitlist');
    } else if (data.role === 'admin' || data.role === 'superadmin') {
      router.push('/admin');
    } else {
      router.push('/chat');
    }
  }

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Orange glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.2)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <SoulPrintLogo size={64} />
          <h1 className="font-condensed font-black text-white text-3xl tracking-[0.25em] mt-4 uppercase">SOULPRINT</h1>
          <div className="flex items-center gap-3 mt-2">
            <div className="h-px flex-1 bg-orange-500/30" />
            <span className="text-[10px] text-gray-500 tracking-widest uppercase">Sign in or create account</span>
            <div className="h-px flex-1 bg-orange-500/30" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Access Code */}
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="ACCESS CODE (IF YOU HAVE ONE)"
              value={accessCode}
              onChange={e => setAccessCode(e.target.value)}
              className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 text-xs tracking-widest py-4 pl-11 pr-4 rounded-lg focus:border-orange-500/50 transition-colors"
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-[10px] text-gray-600 tracking-[0.2em] uppercase">Sign In</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="email"
              placeholder="ENTER EMAIL ID"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 text-xs tracking-widest py-4 pl-11 pr-4 rounded-lg focus:border-orange-500/50 transition-colors"
            />
          </div>

          {/* Passcode */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type={showPasscode ? 'text' : 'password'}
              placeholder="ENTER PASSCODE"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              required
              className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 text-xs tracking-widest py-4 pl-11 pr-12 rounded-lg focus:border-orange-500/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPasscode(!showPasscode)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg py-2.5 px-3">{error}</p>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-[10px] text-gray-600 tracking-[0.2em] uppercase">OR</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          {/* Google Button */}
          <button
            type="button"
            className="w-full bg-white text-gray-800 font-medium text-sm py-3.5 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-orange w-full py-4 rounded-xl text-sm tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'INITIALIZING...' : 'INITIALIZE SESSION →'}
          </button>

          <p className="text-center text-xs text-gray-600">
            <a href="#" className="underline hover:text-gray-400 transition-colors">Forgot your password?</a>
          </p>

          <p className="text-center text-xs text-gray-600">
            New here? Just enter your details above to create an account.
          </p>
        </form>

        {/* Status bar */}
        <div className="mt-8 flex items-center justify-between text-[10px] text-gray-700 font-mono">
          <div>
            <div>SECURE SERVER: <span className="text-green-600">ON</span></div>
            <div>LATENCY: <span className="text-gray-600">{latency}ms</span></div>
          </div>
          <div className="text-right">
            <div>BUILD: <span className="text-gray-600">{buildId}</span></div>
            <div>ID: <span className="text-gray-600">{sid}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
