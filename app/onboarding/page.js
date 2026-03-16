'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Briefcase, Layout, HelpCircle, Globe } from 'lucide-react';

const DESCRIPTORS = ['Entrepreneur', 'Founder / CEO', 'Executive', 'Engineer', 'Creative', 'Consultant', 'Investor', 'Student'];
const FIELDS = ['Tech', 'Finance', 'Real Estate', 'Healthcare', 'Crypto / Web3', 'E-commerce', 'Media', 'Consulting', 'Legal', 'Education', 'Other'];
const HELP_WITH = ['Research & Analysis', 'Content Creation', 'Scheduling & Reminders', 'Networking & Intros', 'Personal Life', 'Travel Planning', 'Health & Wellness', 'Learning & Growth', 'Business Strategy', 'Creative Projects'];
const DISCOVERY = ['Friend / Referral', 'Social Media', 'AI / ChatGPT', 'Podcast', 'Google Search', 'Event / Conference', 'Ads', 'Other'];

function ChipGroup({ options, selected, onToggle, single = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => {
            if (single) {
              onToggle(selected === opt ? '' : opt);
            } else {
              const arr = Array.isArray(selected) ? selected : [];
              if (arr.includes(opt)) {
                onToggle(arr.filter(x => x !== opt));
              } else {
                onToggle([...arr, opt]);
              }
            }
          }}
          className={`chip ${
            single
              ? selected === opt ? 'selected' : ''
              : Array.isArray(selected) && selected.includes(opt) ? 'selected' : ''
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [descriptors, setDescriptors] = useState([]);
  const [field, setField] = useState('');
  const [helpWith, setHelpWith] = useState([]);
  const [discovery, setDiscovery] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('there');

  useEffect(() => {
    const userData = localStorage.getItem('sp_user');
    if (!userData) { router.push('/auth'); return; }
    const user = JSON.parse(userData);
    if (user.profile?.display_name) {
      setDisplayName(user.profile.display_name);
      setUserName(user.profile.display_name);
    } else {
      const emailName = user.email?.split('@')[0] || '';
      const formatted = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      setDisplayName(formatted);
      setUserName(formatted);
    }
  }, []);

  async function handleSubmit() {
    if (!displayName.trim()) return;
    setLoading(true);
    const token = localStorage.getItem('sp_token');
    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          display_name: displayName,
          descriptors,
          field,
          help_with: helpWith,
          discovery_source: discovery,
          onboarding_complete: true,
        }),
      });
      // Check if user is accepted or waitlisted
      const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      const meData = await meRes.json();
      if (meData.accepted) {
        router.push('/assessment/select');
      } else {
        // User is still waitlisted, redirect back to waitlist
        router.push('/waitlist');
      }
    } catch (err) {
      alert('Error saving profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid-bg py-8 px-4">
      <div className="max-w-xl mx-auto">
        <button onClick={() => router.back()} className="text-gray-500 text-sm hover:text-gray-300 transition-colors mb-6 flex items-center gap-1">
          ← Back
        </button>

        <h1 className="text-3xl font-bold text-white mb-1">Welcome aboard{userName ? `, ${userName}` : ''}!</h1>
        <p className="text-gray-500 text-sm mb-8">Quick intro so your SoulPrint knows who it&apos;s working with.</p>

        <div className="space-y-8">
          {/* Display Name */}
          <div>
            <label className="flex items-center gap-2 text-orange-500 text-xs font-bold tracking-widest uppercase mb-3">
              <User className="w-3.5 h-3.5" />
              What should your SoulPrint call you?
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-[#111] border border-white/10 text-white placeholder-gray-600 py-3 px-4 rounded-lg text-sm focus:border-orange-500/50 transition-colors"
            />
          </div>

          {/* What describes you */}
          <div>
            <label className="flex items-center gap-2 text-orange-500 text-xs font-bold tracking-widest uppercase mb-3">
              <Briefcase className="w-3.5 h-3.5" />
              What best describes you?
            </label>
            <ChipGroup options={DESCRIPTORS} selected={descriptors} onToggle={setDescriptors} />
          </div>

          {/* Field */}
          <div>
            <label className="flex items-center gap-2 text-orange-500 text-xs font-bold tracking-widest uppercase mb-3">
              <Globe className="w-3.5 h-3.5" />
              What&apos;s your field?
            </label>
            <ChipGroup options={FIELDS} selected={field} onToggle={setField} single />
          </div>

          {/* Help with */}
          <div>
            <label className="flex items-center gap-2 text-orange-500 text-xs font-bold tracking-widest uppercase mb-3">
              <Layout className="w-3.5 h-3.5" />
              What should your SoulPrint help with?
            </label>
            <p className="text-gray-600 text-xs mb-2">Select all that apply</p>
            <ChipGroup options={HELP_WITH} selected={helpWith} onToggle={setHelpWith} />
          </div>

          {/* Discovery */}
          <div>
            <label className="flex items-center gap-2 text-orange-500 text-xs font-bold tracking-widest uppercase mb-3">
              <HelpCircle className="w-3.5 h-3.5" />
              How did you find us?
            </label>
            <ChipGroup options={DISCOVERY} selected={discovery} onToggle={setDiscovery} single />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !displayName.trim()}
          className="btn-orange w-full py-4 rounded-xl mt-10 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'SAVING...' : 'CONTINUE →'}
        </button>
      </div>
    </div>
  );
}
