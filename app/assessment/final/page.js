'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

export default function AssessmentFinalPage() {
  const router = useRouter();
  const [botName, setBotName] = useState('SoulPrint');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('there');

  useEffect(() => {
    const userData = localStorage.getItem('sp_user');
    if (!userData) { router.push('/auth'); return; }
    const user = JSON.parse(userData);
    setUserName(user.profile?.display_name || user.email?.split('@')[0] || 'there');
  }, []);

  async function handleCreate() {
    setLoading(true);
    const token = localStorage.getItem('sp_token');
    try {
      await fetch('/api/assessment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assistant_name: botName }),
      });

      // Update local user data
      const userData = JSON.parse(localStorage.getItem('sp_user') || '{}');
      userData.assessment_complete = true;
      localStorage.setItem('sp_user', JSON.stringify(userData));
      trackEvent('assessment_completed', { assessment_type: 'standard' });

      // Check if user is accepted
      const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      const me = await meRes.json();

      if (me.accepted || me.role === 'admin' || me.role === 'superadmin') {
        router.push('/chat');
      } else {
        router.push('/waitlist');
      }
    } catch (e) {
      alert('Error saving. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-md text-center">
        <p className="text-orange-500 text-xs font-bold tracking-[0.3em] uppercase mb-4">ONE LAST THING</p>
        <h1 className="text-4xl font-black text-white mb-6 font-condensed uppercase leading-tight">
          ONE LAST THING
        </h1>
        <p className="text-gray-400 text-base mb-10 leading-relaxed">
          I&apos;ve learned a lot about you, <span className="text-white font-semibold">{userName}</span>. Now I need a name. What should your bot be called?
        </p>

        <div className="mb-8">
          <input
            type="text"
            value={botName}
            onChange={e => setBotName(e.target.value)}
            placeholder="e.g. Alex, Max, Aria..."
            className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 py-4 px-5 rounded-xl text-base text-center focus:border-orange-500/50 transition-colors"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !botName.trim()}
          className="btn-orange w-full py-4 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'CREATING...' : 'CREATE MY SOULPRINT →'}
        </button>
      </div>
    </div>
  );
}
