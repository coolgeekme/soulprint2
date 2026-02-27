'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, KeyRound, Loader2 } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from '@/lib/firebase';

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [latency] = useState(() => Math.floor(Math.random() * 30 + 10));
  const buildId = 'v2.5.0';
  const sessionId = () => Math.random().toString(36).slice(2, 10).toUpperCase();
  const [sid] = useState(sessionId);

  // Sync Firebase user with backend
  async function syncWithBackend(firebaseUser, idToken) {
    try {
      const res = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          uid: firebaseUser.uid,
          accessCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sync with backend');
      }

      const data = await res.json();
      localStorage.setItem('sp_token', data.token);
      localStorage.setItem('sp_user', JSON.stringify(data));
      return data;
    } catch (err) {
      throw err;
    }
  }

  // Handle Google Sign-In
  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError('');

    try {
      const { user, idToken, error } = await signInWithGoogle();
      
      if (error) {
        if (error.includes('popup-closed-by-user')) {
          setGoogleLoading(false);
          return;
        }
        throw new Error(error);
      }

      const data = await syncWithBackend(user, idToken);
      handlePostAuth(data);
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  // Handle Email/Password Sign-In or Sign-Up
  async function handleEmailAuth(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      
      if (mode === 'signup') {
        // For sign up, use Firebase
        result = await signUpWithEmail(email, password);
        
        if (result.error) {
          if (result.error.includes('email-already-in-use')) {
            throw new Error('Email already in use. Try signing in instead.');
          }
          if (result.error.includes('weak-password')) {
            throw new Error('Password must be at least 6 characters');
          }
          if (result.error.includes('invalid-email')) {
            throw new Error('Invalid email address');
          }
          throw new Error(result.error);
        }
        
        const data = await syncWithBackend(result.user, result.idToken);
        handlePostAuth(data);
      } else {
        // For sign in, try Firebase first, then fall back to legacy auth
        result = await signInWithEmail(email, password);
        
        if (result.error) {
          // Firebase auth failed - try legacy auth for existing users
          if (result.error.includes('user-not-found') || 
              result.error.includes('wrong-password') || 
              result.error.includes('invalid-credential') ||
              result.error.includes('invalid-login-credentials')) {
            
            // Try legacy authentication
            const legacyRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, passcode: password }),
            });
            
            if (legacyRes.ok) {
              const data = await legacyRes.json();
              localStorage.setItem('sp_token', data.token);
              localStorage.setItem('sp_user', JSON.stringify(data));
              handlePostAuth(data);
              return;
            }
            
            const legacyData = await legacyRes.json();
            if (legacyRes.status === 401) {
              throw new Error('Invalid email or password');
            }
            if (legacyRes.status === 404) {
              throw new Error('No account found with this email');
            }
            throw new Error(legacyData.error || 'Invalid email or password');
          }
          
          if (result.error.includes('invalid-email')) {
            throw new Error('Invalid email address');
          }
          throw new Error(result.error);
        }
        
        // Firebase auth succeeded
        const data = await syncWithBackend(result.user, result.idToken);
        handlePostAuth(data);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  // Handle Password Reset
  async function handlePasswordReset(e) {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const { error } = await resetPassword(email);
      if (error) {
        throw new Error(error);
      }
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
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

  // Forgot Password Modal
  if (showForgotPassword) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.2)_0%,transparent_70%)]" />
        
        <div className="relative z-10 w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <SoulPrintLogo size={64} />
            <h1 className="font-condensed font-black text-white text-2xl tracking-[0.2em] mt-4 uppercase">Reset Password</h1>
          </div>

          {resetSent ? (
            <div className="text-center space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 text-sm">Password reset email sent! Check your inbox.</p>
              </div>
              <button
                onClick={() => { setShowForgotPassword(false); setResetSent(false); }}
                className="text-orange-500 hover:text-orange-400 text-sm underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  placeholder="ENTER YOUR EMAIL"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 text-xs tracking-widest py-4 pl-11 pr-4 rounded-lg focus:border-orange-500/50 transition-colors"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg py-2.5 px-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-orange w-full py-4 rounded-xl text-sm tracking-widest disabled:opacity-50"
              >
                {loading ? 'SENDING...' : 'SEND RESET EMAIL'}
              </button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-gray-500 hover:text-gray-400 text-xs text-center"
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    );
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
            <span className="text-[10px] text-gray-500 tracking-widest uppercase">
              {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
            </span>
            <div className="h-px flex-1 bg-orange-500/30" />
          </div>
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-medium py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {googleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span>{googleLoading ? 'Signing in...' : 'Continue with Google'}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] text-gray-600 tracking-[0.2em] uppercase">or with email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3">
          {/* Access Code - only show for sign up */}
          {mode === 'signup' && (
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
          )}

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="email"
              placeholder="EMAIL ADDRESS"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 text-xs tracking-widest py-4 pl-11 pr-4 rounded-lg focus:border-orange-500/50 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="PASSWORD"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 text-xs tracking-widest py-4 pl-11 pr-12 rounded-lg focus:border-orange-500/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
            disabled={loading || googleLoading}
            className="btn-orange w-full py-4 rounded-xl text-sm tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === 'signin' ? 'SIGNING IN...' : 'CREATING ACCOUNT...'}
              </>
            ) : (
              mode === 'signin' ? 'SIGN IN →' : 'CREATE ACCOUNT →'
            )}
          </button>

          {/* Forgot Password / Toggle Mode */}
          <div className="flex items-center justify-between pt-2">
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-gray-600 hover:text-gray-400 underline transition-colors"
              >
                Forgot password?
              </button>
            )}
            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="text-xs text-orange-500 hover:text-orange-400 transition-colors ml-auto"
            >
              {mode === 'signin' ? 'Create an account' : 'Already have an account? Sign in'}
            </button>
          </div>
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
