'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error' | 'no-token'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('no-token');
      setMessage('No verification token provided.');
      return;
    }

    // Verify the token with backend
    verifyEmail(token);
  }, [searchParams]);

  async function verifyEmail(token) {
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Your email has been verified successfully!');
      } else {
        setStatus('error');
        setMessage(data.error || 'Verification failed. The link may be expired or invalid.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('An error occurred during verification. Please try again.');
    }
  }

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Orange glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(246,64,0,0.2)_0%,transparent_70%)]" />
      
      <div className="relative z-10 w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <SoulPrintLogo size={64} />
          <h1 className="font-condensed font-black text-white text-3xl tracking-[0.25em] mt-4 uppercase">SOULPRINT</h1>
        </div>

        {/* Status Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {status === 'loading' && (
            <>
              <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">Verifying Your Email</h2>
              <p className="text-gray-400 text-sm">Please wait while we verify your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">Email Verified!</h2>
              <p className="text-gray-400 text-sm mb-6">{message}</p>
              <Link 
                href="/auth"
                className="btn-orange inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm tracking-widest"
              >
                SIGN IN NOW
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">Verification Failed</h2>
              <p className="text-gray-400 text-sm mb-6">{message}</p>
              <div className="space-y-3">
                <Link 
                  href="/auth"
                  className="btn-orange inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm tracking-widest w-full"
                >
                  BACK TO SIGN IN
                </Link>
                <p className="text-gray-500 text-xs">
                  Need help? <a href="mailto:team@soulprintengine.ai" className="text-orange-500 hover:text-orange-400">Contact Support</a>
                </p>
              </div>
            </>
          )}

          {status === 'no-token' && (
            <>
              <div className="w-20 h-20 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-yellow-500" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">Invalid Link</h2>
              <p className="text-gray-400 text-sm mb-6">
                This verification link is invalid. Please check your email for the correct verification link or request a new one.
              </p>
              <Link 
                href="/auth"
                className="btn-orange inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm tracking-widest w-full"
              >
                BACK TO SIGN IN
              </Link>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-gray-600 text-xs mt-8">
          © {new Date().getFullYear()} SoulPrint by ArcheForge
        </p>
      </div>
    </div>
  );
}
