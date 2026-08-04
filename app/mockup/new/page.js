// MOCKUP — Complete light-theme homepage matching the full design spec
// Route: /mockup/new

'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowUp, Loader2, Shield, Zap, Check, Brain, Sparkles, Globe, Fingerprint, ArrowRight, X } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

const DEMO_IMPRINTS = [
  { key: 'sarcastic-friend', label: '😏 Sarcastic Friend' },
  { key: 'devils-advocate', label: '😈 Devil\'s Advocate' },
  { key: 'hype-man', label: '🎉 Hype Man' },
  { key: 'zen-master', label: '🧘 Zen Master' },
];

const DEMO_MODEL_OPTIONS = [
  { key: 'auto', label: '⚡ Auto (Best for task)' },
  { key: 'gpt-4o', label: 'GPT-4o' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'claude', label: 'Claude' },
];

const SUGGESTIONS = [
  'Help me draft an email in my voice',
  'Plan my week around my priorities',
  'Reflect on my journal entries',
];

const TRUST_BADGES = [
  { icon: Shield, label: 'Private & Encrypted' },
  { icon: Zap, label: 'GPT-4o, Gemini & Claude' },
  { icon: Check, label: 'Free to Start' },
];

const FIVE_FEATURES = [
  {
    icon: Brain,
    title: 'Persistent Memory',
    desc: 'Remembers your history, preferences & projects — forever.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
  },
  {
    icon: Zap,
    title: 'Dynamic Intelligence',
    desc: 'Auto-picks the best AI model for each task.',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
  },
  {
    icon: Sparkles,
    title: 'Imprints',
    desc: 'AI personas, from a sarcastic friend to a zen guide — all layered on your SoulPrint.',
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
  },
  {
    icon: Globe,
    title: 'Multi-Platform Memory',
    desc: 'One identity across Web, Telegram & Slack — not trapped in one app.',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
  },
  {
    icon: Fingerprint,
    title: 'Identity Alignment',
    desc: 'Learns your decision style & communication cadence.',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
  },
];

const COMPARISON_ROWS = [
  { label: 'Long-term Memory', sp: 'Persistent', chatgpt: false, claude: false },
  { label: 'AI Models', sp: 'Multiple', chatgpt: 'GPT only', claude: 'Claude only' },
  { label: 'Image Generation', sp: '50/mo HD', chatgpt: 'Limited', claude: false },
  { label: 'Video Generation', sp: true, chatgpt: false, claude: false },
  { label: 'Custom Personas', sp: 'Unlimited', chatgpt: false, claude: false },
  { label: 'Voice Chat', sp: true, chatgpt: true, claude: false },
  { label: 'Private — doesn\'t train on your data', sp: true, chatgpt: false, claude: false },
];

const TESTIMONIALS = [
  {
    quote: "Let me start with the headline: it's better than ChatGPT. I came skeptical — another AI tool — but SoulPrint surprised me in ways I didn't expect.",
    author: 'Nick',
    role: 'Creator',
    avatar: 'N',
  },
  {
    quote: "I have been using SoulPrint for my health and well being. So far it has been spot on. I'll start using it for business consulting too.",
    author: 'Rob',
    role: 'Consultant',
    avatar: 'R',
  },
  {
    quote: 'It actually remembers me. It\'s the first AI that feels like a real partner — not a stranger every session.',
    author: 'Jason',
    role: 'Power User',
    avatar: 'J',
  },
];

function ComparisonCell({ value }) {
  if (value === true) return <Check className="w-5 h-5 text-green-500 mx-auto" />;
  if (value === false) return <X className="w-5 h-5 text-gray-400 mx-auto" />;
  return <span className="text-xs text-orange-600 font-semibold">{value}</span>;
}

export default function MockupNewPage() {
  const [demoInput, setDemoInput] = useState('');
  const [demoModel, setDemoModel] = useState('auto');
  const [demoImprint, setDemoImprint] = useState('zen-master');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [demoError, setDemoError] = useState('');
  const [demoHistory, setDemoHistory] = useState([]);

  useEffect(() => {
    const random = DEMO_IMPRINTS[Math.floor(Math.random() * DEMO_IMPRINTS.length)];
    setDemoImprint(random.key);
  }, []);

  const runDemo = useCallback(async (messageOverride) => {
    const message = (messageOverride ?? demoInput).trim();
    if (!message || demoLoading) return;

    setDemoLoading(true);
    setDemoError('');
    setDemoResult(null);

    try {
      const res = await fetch('/api/chat/demo-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, model: demoModel, imprint: demoImprint, history: demoHistory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Something went wrong');

      setDemoResult(data);
      setDemoHistory(prev => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: data?.soulprint?.text || '' },
      ]);
    } catch (e) {
      setDemoError(e.message || 'Demo is temporarily unavailable');
    } finally {
      setDemoLoading(false);
    }
  }, [demoInput, demoModel, demoImprint, demoHistory, demoLoading]);

  const handleDemoSubmit = useCallback((e) => {
    e.preventDefault();
    runDemo();
  }, [runDemo]);

  const handleSuggestionClick = useCallback((prompt) => {
    setDemoInput(prompt);
    runDemo(prompt);
  }, [runDemo]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-gray-900 font-sans">
      {/* TOP BAR */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
              <span className="text-base">🏢</span>
              <span className="font-semibold">The Foundry</span>
              <span className="text-gray-400">(for Business)</span>
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-green-100 text-green-700 rounded">Live</span>
            </Link>
          </div>
          <div className="flex items-center gap-3 text-gray-500">
            <Link href="/es" className="hover:text-gray-900">ES Versión en Español</Link>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-green-50 text-green-600 rounded border border-green-200">Waitlist Open</span>
            <Link href="/pt" className="hover:text-gray-900">BR Versão em Português</Link>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-green-50 text-green-600 rounded border border-green-200">Waitlist Open</span>
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav className="border-b border-gray-200 bg-white/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <SoulPrintLogo size={28} />
            <span className="font-black text-lg tracking-tight text-gray-900">SOULPRINT</span>
          </Link>
          <div className="flex items-center gap-8">
            <Link href="/features" className="text-sm font-medium text-gray-700 hover:text-gray-900">Features</Link>
            <Link href="/reviews" className="text-sm font-medium text-gray-700 hover:text-gray-900">Reviews</Link>
            <Link href="/pricing" className="text-sm font-medium text-gray-700 hover:text-gray-900">Pricing</Link>
            <Link href="/auth" className="text-sm font-medium text-gray-700 hover:text-gray-900">Sign In</Link>
            <Link href="/auth" className="px-5 py-2.5 text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 shadow-sm">
              Open Chat
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO + DEMO */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-orange-600 mb-6">
            Real Memory. Real Personas. Try it — No Signup.
          </p>

          <h1 className="text-center font-black text-5xl md:text-6xl lg:text-7xl leading-[1.1] mb-6">
            <span className="text-gray-900">Stop re-explaining yourself to </span>
            <span className="text-orange-600">AI</span>
            <span className="text-gray-900">.</span>
          </h1>

          <p className="text-center text-gray-600 text-lg md:text-xl max-w-2xl mx-auto mb-12">
            Chat, organize, reflect, and plan with an AI that remembers your tone, your tempo, and your life.
          </p>

          {/* Demo Input */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6">
            <form onSubmit={handleDemoSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={demoInput}
                  onChange={(e) => setDemoInput(e.target.value)}
                  placeholder="Ask me anything — see how SoulPrint responds differently..."
                  className="w-full px-5 py-4 pr-14 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                />
                <button
                  type="submit"
                  disabled={demoLoading || !demoInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:from-orange-500 hover:to-orange-600 transition-all shadow-sm"
                >
                  {demoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {DEMO_MODEL_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDemoModel(opt.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                      demoModel === opt.key
                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </form>

            {demoError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {demoError}
              </div>
            )}
          </div>

          {/* Imprint Pills */}
          {!demoResult && (
            <div className="text-center mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Try It As A Different Imprint
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {DEMO_IMPRINTS.map(imp => (
                  <button
                    key={imp.key}
                    onClick={() => setDemoImprint(imp.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                      demoImprint === imp.key
                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {imp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {!demoResult && !demoLoading && (
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-sm hover:border-orange-300 hover:text-orange-700 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          {demoResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  {demoResult.baseline.label}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {demoResult.baseline.text}
                </p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl p-5 border border-orange-200 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-3">
                  {demoResult.soulprint.label}
                </div>
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap mb-4">
                  {demoResult.soulprint.text}
                </p>
                <div className="pt-3 border-t border-orange-200/50 text-xs text-gray-600 space-y-1">
                  <div><span className="font-semibold">Persona:</span> {demoResult.soulprint.imprint.icon} {demoResult.soulprint.imprint.name}</div>
                  <div><span className="font-semibold">Model:</span> {demoResult.soulprint.model}</div>
                </div>
              </div>
            </div>
          )}

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-600">
            {TRUST_BADGES.map((badge, i) => (
              <div key={i} className="flex items-center gap-2">
                <badge.icon className="w-4 h-4 text-green-600" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-12 px-6 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center md:text-left">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex -space-x-3 mb-3">
              {['#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e'].map((color, i) => (
                <div
                  key={i}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <p className="text-2xl font-black text-gray-900">20,000+</p>
            <p className="text-sm text-gray-500">have discovered SoulPrint</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className="text-orange-500 text-xl">★</span>
              ))}
            </div>
            <p className="text-lg font-bold text-gray-900">Loved by early adopters</p>
          </div>

          <div className="flex flex-col items-center md:items-end">
            <Shield className="w-10 h-10 text-green-600 mb-2" />
            <p className="text-lg font-bold text-gray-900">Your data stays yours</p>
          </div>
        </div>
      </section>

      {/* 5 FEATURES */}
      <section className="py-20 px-6 bg-[#FAF8F5]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest text-orange-600 mb-3">
              What Only SoulPrint Can Do
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {FIVE_FEATURES.map((f, i) => (
              <div key={i} className={`${f.bgColor} rounded-2xl p-6 text-center`}>
                <f.icon className={`w-12 h-12 ${f.color} mx-auto mb-4`} />
                <h3 className="text-gray-900 font-bold text-base mb-2">{f.title}</h3>
                <p className="text-gray-600 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-20 px-6 bg-white border-y border-gray-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest text-orange-600 mb-3">Why SoulPrint</p>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 uppercase">More Features. Better Price.</h2>
            <p className="text-gray-600 text-sm mt-3">Side-by-side with OpenAI's ChatGPT and Anthropic's Claude.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-4 text-left text-gray-900 text-sm font-bold uppercase tracking-wider">Feature</th>
                  <th className="px-6 py-4 text-center bg-orange-50 border-x border-orange-200">
                    <div className="text-orange-600 text-sm font-bold uppercase tracking-wider mb-1">SoulPrint</div>
                    <div className="text-orange-700 text-xs font-semibold">$20/mo Base</div>
                  </th>
                  <th className="px-6 py-4 text-center text-gray-500 text-xs font-semibold uppercase tracking-wider">
                    <div className="mb-1">ChatGPT</div>
                    <div className="text-gray-600">$20/mo</div>
                  </th>
                  <th className="px-6 py-4 text-center text-gray-500 text-xs font-semibold uppercase tracking-wider">
                    <div className="mb-1">Claude</div>
                    <div className="text-gray-600">$20/mo</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 text-sm font-medium">{row.label}</td>
                    <td className="px-6 py-4 text-center bg-orange-50/30 border-x border-orange-100"><ComparisonCell value={row.sp} /></td>
                    <td className="px-6 py-4 text-center"><ComparisonCell value={row.chatgpt} /></td>
                    <td className="px-6 py-4 text-center"><ComparisonCell value={row.claude} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 px-6 bg-[#FAF8F5]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest text-orange-600 mb-3">Real Words. Real Works</p>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900">20,000+</h2>
            <p className="text-gray-600 text-sm mt-2">people have discovered what AI feels like when it actually knows you.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map(s => <span key={s} className="text-orange-500 text-sm">★</span>)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="text-gray-900 text-sm font-bold">{t.author}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 px-6 bg-white border-t border-gray-200">
        <div className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl p-12 md:p-16 relative overflow-hidden bg-gradient-to-br from-orange-50 via-orange-100/50 to-orange-50 border border-orange-200">
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4">
              Meet your <span className="text-orange-600">SOULPRINT</span>.
            </h2>
            <p className="text-gray-600 text-base mb-8 max-w-md mx-auto">
              Free to start. No credit card. No re-explaining yourself — ever again.
            </p>
            <Link href="/auth" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-base rounded-xl hover:from-orange-600 hover:to-orange-700 shadow-lg transition-all">
              Open Chat — It's Free <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-gray-500 text-xs mt-4">No credit card required. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 py-8 px-6 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <SoulPrintLogo size={20} />
            <span className="font-bold tracking-tight">SOULPRINT</span>
          </div>
          <p className="text-xs text-gray-500">© 2026 SoulPrint™ by ArcheForge LLC. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs hover:text-gray-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs hover:text-gray-900 transition-colors">Terms</Link>
            <Link href="/contact" className="text-xs hover:text-gray-900 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
