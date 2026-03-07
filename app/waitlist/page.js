'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Loader2, CheckCircle2, XCircle, User, ClipboardList } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function WaitlistPage() {
  const router = useRouter();
  const [botName, setBotName] = useState('SoulPrint');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);
  const [hasCompletedAssessment, setHasCompletedAssessment] = useState(false);
  const [assessmentProgress, setAssessmentProgress] = useState(0);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (!token) { router.push('/auth'); return; }
    
    // Check user status and profile completion
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.accepted || d.role === 'admin' || d.role === 'superadmin') {
          router.push('/chat');
        }
        if (d.profile?.assistant_name) setBotName(d.profile.assistant_name);
        // Check if user has completed required profile questions
        const hasName = d.profile?.display_name;
        const hasDiscovery = d.profile?.discovery_source;
        setHasCompletedProfile(hasName && hasDiscovery);
      })
      .catch(() => {});
    
    // Check assessment progress
    fetch('/api/assessment/progress', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const answered = d.count || 0;
        setAssessmentProgress(answered);
        // Use the backend's assessment_complete flag which checks both assessment types
        setHasCompletedAssessment(d.assessment_complete || d.layer1_complete || answered >= 12);
        setCheckingProfile(false);
      })
      .catch(() => { setCheckingProfile(false); });
  }, []);

  async function handleAccessCode(e) {
    e.preventDefault();
    if (!accessCode.trim()) {
      setError('Please enter an access code');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('sp_token');
      const res = await fetch('/api/auth/redeem-code', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ code: accessCode.trim().toUpperCase() }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Invalid access code');
        setLoading(false);
        return;
      }

      // Success - show checkmark then redirect
      setSuccess(true);
      setTimeout(() => {
        router.push('/chat');
      }, 1500);
    } catch (err) {
      setError('Failed to verify code. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)]" />

      <div className="relative z-10 max-w-md w-full">
        <SoulPrintLogo size={64} />

        <h1 className="font-condensed font-black text-white text-4xl mt-6 mb-4 uppercase tracking-tight">
          YOU&apos;RE ON THE LIST
        </h1>

        <p className="text-gray-400 text-sm leading-relaxed mb-2">
          Your answers have been saved. Once you&apos;re accepted, log in and <span className="text-orange-400 font-medium">{botName}</span> will be ready and waiting — already knowing exactly who you are.
        </p>

        <div className="my-8 p-6 rounded-2xl" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <div className="w-3 h-3 rounded-full bg-orange-500 mx-auto mb-3 animate-pulse" />
          <p className="text-orange-300 text-sm font-medium mb-1">Position saved</p>
          <p className="text-gray-500 text-xs">We&apos;ll notify you when access is granted</p>
        </div>

        {/* Access Code Section */}
        <div className="mb-8 p-5 rounded-2xl bg-[#111] border border-white/10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-orange-500" />
            <p className="text-white text-sm font-medium">Have an Access Code?</p>
          </div>
          
          {checkingProfile ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            </div>
          ) : !hasCompletedProfile ? (
            // Step 1: User needs to complete profile questions first
            <div className="text-center py-2">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">1</div>
                <div className="w-16 h-0.5 bg-gray-700"></div>
                <div className="w-6 h-6 rounded-full bg-gray-700 text-gray-500 text-xs flex items-center justify-center font-bold">2</div>
              </div>
              <div className="w-10 h-10 mx-auto bg-orange-500/10 rounded-full flex items-center justify-center mb-3">
                <User className="w-5 h-5 text-orange-400" />
              </div>
              <p className="text-gray-400 text-xs mb-3">
                Step 1: Complete your profile questions
              </p>
              <Link 
                href="/onboarding" 
                className="inline-block w-full btn-orange py-3 rounded-lg text-sm tracking-widest"
              >
                COMPLETE PROFILE →
              </Link>
            </div>
          ) : !hasCompletedAssessment ? (
            // Step 2: User needs to complete assessment
            <div className="text-center py-2">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">✓</div>
                <div className="w-16 h-0.5 bg-orange-500"></div>
                <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">2</div>
              </div>
              <div className="w-10 h-10 mx-auto bg-orange-500/10 rounded-full flex items-center justify-center mb-3">
                <ClipboardList className="w-5 h-5 text-orange-400" />
              </div>
              <p className="text-gray-400 text-xs mb-2">
                Step 2: Complete the assessment questions
              </p>
              <p className="text-orange-400 text-xs mb-3">
                Progress: {assessmentProgress}/12 questions
              </p>
              <Link 
                href="/assessment/select" 
                className="inline-block w-full btn-orange py-3 rounded-lg text-sm tracking-widest"
              >
                {assessmentProgress > 0 ? 'CONTINUE ASSESSMENT →' : 'START ASSESSMENT →'}
              </Link>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="text-green-400 text-sm font-medium">Access Granted!</p>
              <p className="text-gray-500 text-xs">Redirecting to app...</p>
            </div>
          ) : (
            <>
              <p className="text-gray-500 text-xs mb-4">
                Enter your beta access code to skip the waitlist
              </p>
              <form onSubmit={handleAccessCode} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ENTER ACCESS CODE"
                  value={accessCode}
                  onChange={e => setAccessCode(e.target.value.toUpperCase())}
                  className="w-full bg-black border border-white/10 text-white placeholder-gray-600 text-center text-sm tracking-[0.3em] font-mono py-3 px-4 rounded-lg focus:border-orange-500/50 transition-colors uppercase"
                />
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg py-2">
                  <XCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !accessCode.trim()}
                className="w-full btn-orange py-3 rounded-lg text-sm tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    VERIFYING...
                  </>
                ) : (
                  'REDEEM CODE →'
                )}
              </button>
            </form>
            </>
          )}
        </div>

        <Link href="/" className="btn-orange inline-block px-8 py-4 rounded-xl text-sm bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300">
          GOT IT — BACK TO HOME
        </Link>

        <p className="mt-6 text-xs text-gray-600">
          Already accepted? Try <button onClick={() => window.location.reload()} className="text-orange-500 hover:text-orange-400 underline">refreshing</button>
        </p>
      </div>
    </div>
  );
}
