'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, KeyRound, Loader2, CheckCircle } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from '@/lib/firebase';
import Script from 'next/script';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6Le_c34sAAAAAAEM4XN1qxw3Ropv6KJpjmaynfxT';

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
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  const [latency, setLatency] = useState(0);
  const buildId = 'v2.5.0';
  const [sid, setSid] = useState('');

  // Initialize random values on client-side only to avoid hydration mismatch
  useEffect(() => {
    setLatency(Math.floor(Math.random() * 30 + 10));
    setSid(Math.random().toString(36).slice(2, 10).toUpperCase());
    
    // Check for session expiry redirect
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'session_expired') {
        setError('Your session has expired. Please sign in again to continue.');
      }
    } catch (e) {}
  }, []);

  // Get reCAPTCHA token
  const getRecaptchaToken = useCallback(async (action) => {
    if (!recaptchaLoaded || !window.grecaptcha) {
      console.warn('reCAPTCHA not loaded yet');
      return null;
    }
    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
      return token;
    } catch (err) {
      console.error('reCAPTCHA error:', err);
      return null;
    }
  }, [recaptchaLoaded]);

  // Sync Firebase user with backend
  async function syncWithBackend(firebaseUser, idToken) {
    console.log('[Auth] Syncing with backend...', { email: firebaseUser.email });
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

      console.log('[Auth] Backend response status:', res.status);
      console.log('[Auth] Backend response content-type:', res.headers.get('content-type'));
      
      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('[Auth] Non-JSON response:', text.substring(0, 500));
        throw new Error('Server returned an invalid response. Please try again or contact support.');
      }
      
      if (!res.ok) {
        const data = await res.json();
        console.error('[Auth] Backend error:', data);
        throw new Error(data.error || 'Failed to sync with backend');
      }

      const data = await res.json();
      console.log('[Auth] Backend success:', { token: !!data.token, accepted: data.accepted });
      localStorage.setItem('sp_token', data.token);
      localStorage.setItem('sp_user', JSON.stringify(data));
      return data;
    } catch (err) {
      console.error('[Auth] Sync error:', err);
      throw err;
    }
  }

  // Handle Google Sign-In
  async function handleGoogleSignIn() {
    console.log('[Auth] Starting Google sign-in...');
    setGoogleLoading(true);
    setError('');

    try {
      const { user, idToken, error } = await signInWithGoogle();
      console.log('[Auth] Google sign-in result:', { user: !!user, idToken: !!idToken, error });
      
      if (error) {
        if (error.includes('popup-closed-by-user')) {
          console.log('[Auth] User closed popup');
          setGoogleLoading(false);
          return;
        }
        // Handle Firebase not configured more gracefully
        if (error.includes('Firebase not configured')) {
          console.warn('[Auth] Firebase not configured - Google sign-in unavailable');
          setError('Google sign-in is currently unavailable. Please use email/password instead.');
          setGoogleLoading(false);
          return;
        }
        throw new Error(error);
      }

      const data = await syncWithBackend(user, idToken);
      console.log('[Auth] Calling handlePostAuth with:', data);
      handlePostAuth(data);
    } catch (err) {
      console.error('[Auth] Google sign-in error:', err);
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
        // Get reCAPTCHA token for signup
        const recaptchaToken = await getRecaptchaToken('signup');
        if (!recaptchaToken) {
          throw new Error('Security verification failed. Please refresh and try again.');
        }

        // Verify reCAPTCHA on backend first
        const captchaRes = await fetch('/api/auth/verify-captcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: recaptchaToken, action: 'signup' }),
        });
        
        if (!captchaRes.ok) {
          const captchaData = await captchaRes.json();
          throw new Error(captchaData.error || 'Security verification failed');
        }

        // For sign up, use Firebase if configured, otherwise use legacy
        result = await signUpWithEmail(email, password);
        
        if (result.error) {
          // Handle Firebase not configured - fall back to legacy auth
          if (result.error.includes('Firebase not configured')) {
            console.log('[Auth] Firebase not configured, using legacy registration');
            const legacyRes = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                email, 
                passcode: password,
                recaptcha_token: recaptchaToken
              }),
            });
            
            if (!legacyRes.ok) {
              const legacyData = await legacyRes.json();
              throw new Error(legacyData.error || 'Registration failed');
            }
            
            const data = await legacyRes.json();
            localStorage.setItem('sp_token', data.token);
            localStorage.setItem('sp_user', JSON.stringify(data));
            handlePostAuth(data);
            setLoading(false);
            return;
          }
          
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
        
        // Sync with backend and send verification email
        const data = await syncWithBackend(result.user, result.idToken);
        
        // Send verification email
        await fetch('/api/auth/send-verification', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`
          },
          body: JSON.stringify({ email }),
        });
        
        // Show verification message
        setVerificationSent(true);
        setLoading(false);
        return;
      } else {
        // For sign in, try Firebase first, then fall back to legacy auth
        result = await signInWithEmail(email, password);
        
        if (result.error) {
          // Firebase auth failed - try legacy auth for existing users
          if (result.error.includes('Firebase not configured') ||
              result.error.includes('user-not-found') || 
              result.error.includes('wrong-password') || 
              result.error.includes('invalid-credential') ||
              result.error.includes('invalid-login-credentials')) {
            
            console.log('[Auth] Attempting legacy authentication');
            
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

  // Email Verification Sent Screen
  if (verificationSent) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(246,64,0,0.2)_0%,transparent_70%)]" />
        
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="font-condensed font-black text-white text-2xl tracking-wide uppercase mb-2">
              Verify Your Email
            </h1>
            <p className="text-gray-400 text-sm">
              We've sent a verification link to
            </p>
            <p className="text-orange-400 font-medium mt-1">{email}</p>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              Click the link in your email to verify your account. Once verified, you can sign in and start using SoulPrint.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Check your spam folder if you don't see it
            </div>
          </div>
          
          <button
            onClick={() => {
              setVerificationSent(false);
              setMode('signin');
            }}
            className="text-orange-500 hover:text-orange-400 text-sm font-medium transition-colors"
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Google reCAPTCHA v3 Script */}
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        onLoad={() => setRecaptchaLoaded(true)}
      />
      
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

        {/* Age & Terms Confirmation - Show at top for signup mode */}
        {mode === 'signup' && (
          <label className="flex items-start gap-3 cursor-pointer group mb-4 p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 border-2 border-gray-600 rounded-md peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-colors flex items-center justify-center">
                {ageConfirmed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
              I confirm I am <span className="text-orange-400 font-medium">13 years of age or older</span> and agree to the{' '}
              <Link href="/terms" className="text-orange-500 hover:text-orange-400 underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-orange-500 hover:text-orange-400 underline">Privacy Policy</Link>
            </span>
          </label>
        )}

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading || (mode === 'signup' && !ageConfirmed)}
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

          {/* Terms notice for sign in */}
          {mode === 'signin' && (
            <p className="text-center text-[10px] text-gray-500 px-2">
              By signing in, you agree to our{' '}
              <Link href="/terms" className="text-orange-500 hover:text-orange-400 underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-orange-500 hover:text-orange-400 underline">Privacy Policy</Link>.
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || googleLoading || (mode === 'signup' && !ageConfirmed)}
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
    </>
  );
}
