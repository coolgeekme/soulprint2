'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Users, Gift, ArrowRight, Check, X, Eye, EyeOff } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { trackEvent } from '@/lib/analytics';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code;
  
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);
  
  // Registration form
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validate the invite code on load
  useEffect(() => {
    async function validateCode() {
      try {
        const res = await fetch('/api/invites/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        
        if (res.ok && data.valid) {
          setInviteData(data);
        } else {
          setError(data.error || 'Invalid invite code');
        }
      } catch (e) {
        setError('Failed to validate invite code');
      }
      setLoading(false);
    }
    
    if (code) {
      validateCode();
    }
  }, [code]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    
    if (!email || !passcode) {
      setRegError('Please fill in all fields');
      return;
    }
    
    if (passcode !== confirmPasscode) {
      setRegError('Passwords do not match');
      return;
    }
    
    if (passcode.length < 6) {
      setRegError('Password must be at least 6 characters');
      return;
    }
    
    setRegistering(true);
    
    try {
      const res = await fetch('/api/invites/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email, passcode }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.token) {
        // Save token and redirect
        localStorage.setItem('soulprint_token', data.token);
        trackEvent('invite_redeemed', { invite_code: code });
        trackEvent('signup_completed', { signup_method: 'invite' });
        setSuccess(true);
        
        // Redirect to onboarding after a short delay
        setTimeout(() => {
          router.push('/onboarding');
        }, 2000);
      } else {
        setRegError(data.error || 'Registration failed');
      }
    } catch (e) {
      setRegError('Something went wrong. Please try again.');
    }
    
    setRegistering(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Validating invite...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Invite</h1>
          <p className="text-gray-400 mb-8">{error}</p>
          <button
            onClick={() => router.push('/auth')}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to SoulPrint! 🎉</h1>
          <p className="text-gray-400 mb-4">Your account has been created successfully.</p>
          <p className="text-purple-400 text-sm mb-8">
            You now have 5 invites to share with your friends!
          </p>
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting to onboarding...</span>
          </div>
        </div>
      </div>
    );
  }

  // Valid invite - show registration form
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <SoulPrintLogo size={64} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">You're Invited!</h1>
          <div className="flex items-center justify-center gap-2 text-purple-400 mb-4">
            <Gift className="w-5 h-5" />
            <span className="font-medium">{inviteData?.inviter_name} invited you to join SoulPrint</span>
          </div>
          <p className="text-gray-400 text-sm">
            Create your account and start your personalized AI journey
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-medium mb-2 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-4 py-3 focus:border-purple-500/50 focus:outline-none transition-colors"
                required
              />
            </div>
            
            <div>
              <label className="text-gray-400 text-xs font-medium mb-2 block">Password</label>
              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Create a password"
                  className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-4 py-3 pr-12 focus:border-purple-500/50 focus:outline-none transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="text-gray-400 text-xs font-medium mb-2 block">Confirm Password</label>
              <input
                type={showPasscode ? 'text' : 'password'}
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Confirm your password"
                className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-4 py-3 focus:border-purple-500/50 focus:outline-none transition-colors"
                required
              />
            </div>

            {regError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                {regError}
              </div>
            )}

            <button
              type="submit"
              disabled={registering}
              className="w-full bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {registering ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Join SoulPrint
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
          
          {/* Benefits */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-gray-500 text-xs text-center mb-3">What you'll get:</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Check className="w-4 h-4 text-green-400" />
                <span>Personalized AI assistant</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Check className="w-4 h-4 text-green-400" />
                <span>5 invites to share</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Check className="w-4 h-4 text-green-400" />
                <span>SoulPrint reflection</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Check className="w-4 h-4 text-green-400" />
                <span>Early beta access</span>
              </div>
            </div>
          </div>
        </div>

        {/* Already have account */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{' '}
          <button onClick={() => router.push('/auth')} className="text-purple-400 hover:text-purple-300 transition-colors">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
