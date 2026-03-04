'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Zap, CheckCircle, ChevronRight } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function AssessmentSelectPage() {
  const router = useRouter();
  const [settings, setSettings] = useState({ assessment_mode: 'both' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (!token) { router.push('/auth'); return; }
    
    // Get assessment settings
    fetch('/api/assessment/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
        
        // If only one mode is available, redirect directly
        if (data.assessment_mode === 'full_only') {
          router.push('/assessment');
        } else if (data.assessment_mode === 'quick_only') {
          router.push('/assessment/quick');
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center py-8 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-2xl">
        <button onClick={() => router.back()} className="text-gray-500 text-sm hover:text-gray-300 transition-colors mb-8 flex items-center gap-1">
          ← Back
        </button>

        <div className="flex flex-col items-center mb-10">
          <SoulPrintLogo size={72} />
          <p className="text-orange-500 text-xs font-bold tracking-[0.3em] uppercase mt-4 mb-2">PERSONALIZATION</p>
          <h1 className="font-bold text-3xl text-white text-center mb-4">How Should We Get to Know You?</h1>
          <p className="text-gray-400 text-sm text-center max-w-md leading-relaxed">
            Choose how you'd like to help us understand your communication style. The more we know, the better we can adapt.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          {/* Quick Start Option */}
          <button
            onClick={() => router.push('/assessment/quick')}
            className="w-full group relative bg-[#1a1a1a] border border-gray-800 hover:border-orange-500/50 rounded-2xl p-6 text-left transition-all duration-300"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-500/10 rounded-xl group-hover:bg-orange-500/20 transition-colors">
                <Zap className="w-6 h-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-semibold text-lg">Quick Start</h3>
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">RECOMMENDED</span>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  Answer 12 essential questions (2 per pillar) now, and I'll learn more as we chat.
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> ~2 minutes
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Learns as you use
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-orange-500 transition-colors" />
            </div>
          </button>

          {/* Full Assessment Option */}
          <button
            onClick={() => router.push('/assessment')}
            className="w-full group relative bg-[#1a1a1a] border border-gray-800 hover:border-gray-600 rounded-2xl p-6 text-left transition-all duration-300"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gray-800 rounded-xl group-hover:bg-gray-700 transition-colors">
                <CheckCircle className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-semibold text-lg">Full Assessment</h3>
                  <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">COMPREHENSIVE</span>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  36 questions across 6 pillars for the most thorough understanding of your style.
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> ~5-7 minutes
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Most comprehensive
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
            </div>
          </button>
        </div>

        {/* Skip option */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/chat')}
            className="text-gray-500 text-sm hover:text-gray-400 transition-colors"
          >
            Skip for now — I'll learn as we chat
          </button>
        </div>
      </div>
    </div>
  );
}
