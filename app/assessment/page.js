'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Heart, Target, Users, Brain, Shield } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

const PILLARS = [
  { key: 'communication', label: 'COMMUNICATION', desc: 'How you express and connect.', icon: MessageSquare },
  { key: 'emotional_intelligence', label: 'EMOTIONAL INTEL.', desc: 'How you feel and process.', icon: Heart },
  { key: 'decision_making', label: 'DECISION MAKING', desc: 'How you choose and commit.', icon: Target },
  { key: 'social_dynamics', label: 'SOCIAL DYNAMICS', desc: 'How you navigate people.', icon: Users },
  { key: 'cognitive_style', label: 'COGNITIVE STYLE', desc: 'How you think and learn.', icon: Brain },
  { key: 'assertiveness', label: 'ASSERTIVENESS', desc: 'How you hold your ground.', icon: Shield },
];

export default function AssessmentPage() {
  const router = useRouter();
  const [progress, setProgress] = useState({ answered: [], count: 0 });

  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (!token) { router.push('/auth'); return; }
    fetch('/api/assessment/progress', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setProgress(d))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center py-8 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-xl">
        <button onClick={() => router.back()} className="text-gray-500 text-sm hover:text-gray-300 transition-colors mb-8 flex items-center gap-1">
          ← Back
        </button>

        <div className="flex flex-col items-center mb-8">
          <SoulPrintLogo size={72} />
          <p className="text-orange-500 text-xs font-bold tracking-[0.3em] uppercase mt-4 mb-2">SOULPRINT ASSESSMENT</p>
          <h1 className="font-bold text-3xl text-white text-center mb-4">Discover Your Blueprint</h1>
          <p className="text-gray-500 text-sm text-center max-w-xs leading-relaxed">
            A short series of questions across six pillars of who you are. No right or wrong answers — just be real.
          </p>
          {progress.count > 0 && (
            <div className="mt-3 text-xs text-orange-400">{progress.count}/36 questions answered</div>
          )}
        </div>

        {/* Pillars grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {PILLARS.map(p => {
            const Icon = p.icon;
            return (
              <div key={p.key} className="pillar-card">
                <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-3">{p.label}</p>
                <Icon className="w-5 h-5 text-orange-500 mb-2" />
                <p className="text-gray-500 text-xs">{p.desc}</p>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => {
            const nextQ = progress.count > 0 ? progress.count + 1 : 1;
            const q = Math.min(nextQ, 36);
            router.push(`/assessment/${q}`);
          }}
          className="btn-orange w-full py-4 rounded-xl text-sm"
        >
          {progress.count > 0 ? `RESUME ASSESSMENT (${progress.count}/36) →` : 'BEGIN ASSESSMENT →'}
        </button>
      </div>
    </div>
  );
}
