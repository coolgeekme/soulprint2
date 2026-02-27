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

          {/* Terms Agreement */}
          <p className="text-center text-[10px] text-gray-500 px-2">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-orange-500 hover:text-orange-400 underline">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-orange-500 hover:text-orange-400 underline">Privacy Policy</Link>.
          </p>

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
