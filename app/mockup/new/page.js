// MOCKUP — ChatGPT/Perplexity-style homepage concept. Route: /mockup/new
// Standalone page — does not affect the live homepage at /.

'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ArrowUp, Brain, Zap, Fingerprint, Sparkles, Globe,
  Shield, Check, X, Star, Quote, User, Loader2, MessageCircle,
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

// Must match the keys/names in lib/handlers/homepage-demo.js IMPRINTS
const DEMO_IMPRINTS = [
  { key: 'sarcastic-friend', name: 'Sarcastic Friend', icon: '😏' },
  { key: 'devils-advocate', name: "Devil's Advocate", icon: '😈' },
  { key: 'hype-man', name: 'Hype Man', icon: '🎉' },
  { key: 'zen-master', name: 'Zen Master', icon: '🧘' },
];

const FIVE_FEATURES = [
  {
    icon: Brain,
    title: 'Persistent Memory',
    desc: 'Remembers your history, preferences & projects — forever.',
    iconColor: 'text-orange-400',
  },
  {
    icon: Zap,
    title: 'Dynamic Intelligence',
    desc: 'Auto-picks the best AI model for each task.',
    iconColor: 'text-yellow-400',
  },
  {
    icon: Sparkles,
    title: 'Imprints',
    desc: 'Swap between dozens of AI personas — from a sarcastic friend to a zen guide — all layered on the same memory of you.',
    iconColor: 'text-pink-400',
  },
  {
    icon: Globe,
    title: 'Multi-Platform Memory',
    desc: 'One identity that follows you across Web, Telegram & Slack — not trapped in a single app.',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Fingerprint,
    title: 'Identity Alignment',
    desc: 'Learns your decision style & communication cadence.',
    iconColor: 'text-purple-400',
  },
];

const TESTIMONIALS = [
  {
    quote: "Let me start with the headline: it's better than ChatGPT. I came skeptical — another AI tool — but SoulPrint surprised me in ways I didn't expect.",
    author: 'Nick',
    role: 'Creator',
  },
  {
    quote: "I have been using SoulPrint for my health and well being. So far it has been spot on. I'll start using it for business consulting too.",
    author: 'Rob',
    role: 'Consultant',
  },
  {
    quote: 'It actually remembers me. It\'s the first AI that feels like a real partner — not a stranger every session.',
    author: 'Jason',
    role: 'Power User',
  },
];

const COMPARISON_ROWS = [
  { label: 'Long-term Memory', sp: 'Persistent', chatgpt: false, claude: false },
  { label: 'AI Models', sp: 'Multiple', chatgpt: 'GPT only', claude: 'Claude only' },
  { label: 'Image Generation', sp: '50/mo HD', chatgpt: 'Limited', claude: false },
  { label: 'Video Generation', sp: true, chatgpt: false, claude: false },
  { label: 'Custom Personas', sp: 'Unlimited', chatgpt: false, claude: false },
  { label: 'Voice Chat', sp: '30 min/mo', chatgpt: true, claude: false },
  { label: 'Private — doesn\'t train on your data', sp: true, chatgpt: false, claude: false },
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

function ComparisonCell({ value }) {
  if (value === true) return <Check className="w-5 h-5 text-green-500 mx-auto" />;
  if (value === false) return <X className="w-5 h-5 text-gray-600 mx-auto" />;
  return <span className="text-xs text-orange-300 font-semibold">{value}</span>;
}

export default function MockupNewPage() {
  const [demoInput, setDemoInput] = useState('');
  const [demoModel, setDemoModel] = useState('auto');
  const [demoImprint, setDemoImprint] = useState(DEMO_IMPRINTS[DEMO_IMPRINTS.length - 1].key); // stable SSR default
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [demoError, setDemoError] = useState('');
  const [demoHistory, setDemoHistory] = useState([]); // this-session-only taste of memory

  // Rotate the default imprint per page view — client-only, so it never
  // fights server-rendered markup (SSR always renders the same default).
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
      setDemoError(e.message || 'Demo is temporarily unavailable — please try again shortly');
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
    <div className="min-h-screen bg-black text-white font-sans">
      {/* ═══════════════════════════════════════════════════════════════════
          NAV
          ═══════════════════════════════════════════════════════════════════ */}
      <nav className="border-b border-white/10 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <SoulPrintLogo size={24} />
            <span className="font-condensed font-bold tracking-widest text-sm uppercase text-white">
              SoulPrint<span className="text-orange-500">™</span>
            </span>
          </Link>
          <Link href="/auth" className="btn-orange px-6 py-2 text-sm rounded-lg">
            Start Free
          </Link>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO + DEMO
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              Try before you sign up
            </p>
            <h1 className="font-condensed font-black text-white text-4xl md:text-6xl lg:text-7xl uppercase leading-tight mb-6">
              The AI that <span className="text-orange-500">Remembers</span> You
            </h1>
            <p className="text-gray-400 text-lg mb-8">
              Chat with an AI that adapts to every task, switches between personas, and never forgets your context.
            </p>
          </div>

          {/* Demo Side-by-Side */}
          <div className="max-w-6xl mx-auto">
            <form onSubmit={handleDemoSubmit} className="mb-8">
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <select
                    value={demoImprint}
                    onChange={(e) => setDemoImprint(e.target.value)}
                    className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
                  >
                    {DEMO_IMPRINTS.map(imp => (
                      <option key={imp.key} value={imp.key}>
                        {imp.icon} {imp.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={demoModel}
                    onChange={(e) => setDemoModel(e.target.value)}
                    className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
                  >
                    {DEMO_MODEL_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={demoInput}
                    onChange={(e) => setDemoInput(e.target.value)}
                    placeholder="Ask anything..."
                    className="w-full px-6 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 pr-14"
                  />
                  <button
                    type="submit"
                    disabled={demoLoading || !demoInput.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center disabled:opacity-50"
                  >
                    {demoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </form>

            {demoError && (
              <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {demoError}
              </div>
            )}

            {!demoResult && !demoLoading && (
              <div className="flex gap-3 mb-8">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {demoResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="dark-card rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageCircle className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-400 text-sm font-semibold">{demoResult.baseline.label}</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{demoResult.baseline.text}</p>
                </div>
                <div className="dark-card rounded-2xl p-6 border-orange-500/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-orange-500" />
                    <span className="text-orange-500 text-sm font-semibold">{demoResult.soulprint.label}</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-4">{demoResult.soulprint.text}</p>
                  <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
                    <div className="text-xs text-gray-500">
                      <span className="font-semibold">Persona:</span> {demoResult.soulprint.imprint.icon} {demoResult.soulprint.imprint.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      <span className="font-semibold">Model:</span> {demoResult.soulprint.model}
                      {demoResult.soulprint.autoRouted && <span className="ml-2">({demoResult.soulprint.reason})</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          5 FEATURES
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-8 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">What Makes It Different</p>
            <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase">Built For You, Not Just Built</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FIVE_FEATURES.map((f, i) => (
              <div key={i} className="dark-card rounded-2xl p-6">
                <f.icon className={`w-10 h-10 ${f.iconColor} mb-4`} />
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          COMPARISON TABLE
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-8 border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">How we stack up</p>
            <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase">SoulPrint vs Everyone Else</h2>
          </div>
          <div className="dark-card rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-left text-gray-400 text-xs font-semibold uppercase tracking-wider">Feature</th>
                  <th className="px-6 py-4 text-center text-orange-500 text-xs font-semibold uppercase tracking-wider">SoulPrint</th>
                  <th className="px-6 py-4 text-center text-gray-500 text-xs font-semibold uppercase tracking-wider">ChatGPT</th>
                  <th className="px-6 py-4 text-center text-gray-500 text-xs font-semibold uppercase tracking-wider">Claude</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-6 py-4 text-white text-sm">{row.label}</td>
                    <td className="px-6 py-4 text-center"><ComparisonCell value={row.sp} /></td>
                    <td className="px-6 py-4 text-center"><ComparisonCell value={row.chatgpt} /></td>
                    <td className="px-6 py-4 text-center"><ComparisonCell value={row.claude} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-8 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">Real users, real words</p>
            <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase">20,000+</h2>
            <p className="text-gray-500 text-sm mt-2">people have discovered what AI feels like when it actually knows you</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="dark-card rounded-2xl p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} className="w-4 h-4 text-orange-500 fill-orange-500" />)}
                </div>
                <Quote className="w-8 h-8 text-orange-500/20 mb-2" />
                <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{t.author[0]}</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{t.author}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-8 border-t border-white/10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl p-10 md:p-16 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(246,64,0,0.15), rgba(246,64,0,0.05))', border: '1px solid rgba(246,64,0,0.25)' }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(246,64,0,0.1)_0%,transparent_70%)]" />
            <div className="relative z-10">
              <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase leading-tight mb-4">
                Meet your <span className="text-orange-500">SoulPrint</span>.
              </h2>
              <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">
                Free to start. No credit card. No re-explaining yourself — ever again.
              </p>
              <Link href="/auth" className="btn-orange px-10 py-4 rounded-xl text-base inline-flex items-center gap-2">
                Open Chat — It&apos;s Free <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-gray-600 text-xs mt-4">No credit card required. Cancel anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/10 py-10 px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <SoulPrintLogo size={18} />
            <span className="font-condensed font-bold text-gray-400 tracking-widest text-xs uppercase">SoulPrint</span>
          </div>
          <p className="text-gray-600 text-xs">© 2026 SoulPrint™ by ArcheForge LLC. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-gray-500 text-xs hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="text-gray-500 text-xs hover:text-white transition-colors">Terms</Link>
            <Link href="/contact" className="text-gray-500 text-xs hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
