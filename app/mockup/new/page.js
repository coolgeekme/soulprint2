// MOCKUP — Light-theme homepage matching the exact design spec
// Route: /mockup/new

'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowUp, Loader2, Shield, Zap, Check } from 'lucide-react';
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

export default function MockupNewPage() {
  const [demoInput, setDemoInput] = useState('');
  const [demoModel, setDemoModel] = useState('auto');
  const [demoImprint, setDemoImprint] = useState('zen-master');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [demoError, setDemoError] = useState('');
  const [demoHistory, setDemoHistory] = useState([]);

  // Rotate default imprint on mount
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
      {/* ═══════════════════════════════════════════════════════════════════
          TOP BAR
          ═══════════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════════
          NAV
          ═══════════════════════════════════════════════════════════════════ */}
      <nav className="border-b border-gray-200 bg-white/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <SoulPrintLogo size={28} />
            <span className="font-black text-lg tracking-tight text-gray-900">
              SOULPRINT
            </span>
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

      {/* ═══════════════════════════════════════════════════════════════════
          HERO + DEMO
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Eyebrow */}
          <p className="text-center text-sm font-bold uppercase tracking-widest text-orange-600 mb-6">
            Real Memory. Real Personas. Try it — No Signup.
          </p>

          {/* Headline */}
          <h1 className="text-center font-black text-5xl md:text-6xl lg:text-7xl leading-[1.1] mb-6">
            <span className="text-gray-900">Stop re-explaining yourself to </span>
            <span className="text-orange-600">AI</span>
            <span className="text-gray-900">.</span>
          </h1>

          {/* Subhead */}
          <p className="text-center text-gray-600 text-lg md:text-xl max-w-2xl mx-auto mb-12">
            Chat, organize, reflect, and plan with an AI that remembers your tone, your tempo, and your life.
          </p>

          {/* Demo Input */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6">
            <form onSubmit={handleDemoSubmit} className="space-y-4">
              {/* Input Field */}
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

              {/* Model & Imprint Selector Row */}
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

            {/* Error State */}
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
                  {demoResult.soulprint.autoRouted && (
                    <div className="text-gray-500 italic">{demoResult.soulprint.reason}</div>
                  )}
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

      {/* ═══════════════════════════════════════════════════════════════════
          SOCIAL PROOF
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 px-6 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center md:text-left">
          {/* Avatar Stack */}
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

          {/* Stars */}
          <div className="flex flex-col items-center">
            <div className="flex gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className="text-orange-500 text-xl">★</span>
              ))}
            </div>
            <p className="text-lg font-bold text-gray-900">Loved by early adopters</p>
          </div>

          {/* Privacy */}
          <div className="flex flex-col items-center md:items-end">
            <Shield className="w-10 h-10 text-green-600 mb-2" />
            <p className="text-lg font-bold text-gray-900">Your data stays yours</p>
          </div>
        </div>
      </section>
    </div>
  );
}
