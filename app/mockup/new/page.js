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

  const selectedImprint = DEMO_IMPRINTS.find(i => i.key === demoImprint) || DEMO_IMPRINTS[0];

  return (
    <div className="min-h-screen bg-sp-black grid-bg text-white">

      {/* ═══════════════════════════════════════════════════════════════════
          TOP ANNOUNCEMENT TICKER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-40 bg-black/50 border-b border-white/10 py-2 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-4 sm:gap-6 text-xs flex-wrap">
          <a href="https://foundryagents.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors group">
            <span className="text-sm">🏢</span>
            <span className="font-semibold text-white">The Foundry</span>
            <span className="text-gray-400">(for Business)</span>
            <span className="px-1.5 py-0.5 bg-green-500/15 border border-green-500/30 rounded text-green-400 text-[9px] font-bold uppercase tracking-wider">Live</span>
          </a>
          <div className="w-px h-3.5 bg-white/15 hidden sm:block" />
          <a href="https://esp.soulprintengine.ai/lista-espera" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors group">
            <span className="text-sm">🇪🇸</span>
            <span className="font-medium">Versión en Español</span>
            <span className="px-1.5 py-0.5 bg-green-500/15 border border-green-500/30 rounded text-green-400 text-[9px] font-bold uppercase tracking-wider">Waitlist Open</span>
          </a>
          <div className="w-px h-3.5 bg-white/15 hidden sm:block" />
          <a href="https://br.soulprintengine.ai/lista-espera" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors group">
            <span className="text-sm">🇧🇷</span>
            <span className="font-medium">Versão em Português</span>
            <span className="px-1.5 py-0.5 bg-green-500/15 border border-green-500/30 rounded text-green-400 text-[9px] font-bold uppercase tracking-wider">Waitlist Open</span>
          </a>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          NAV
      ═══════════════════════════════════════════════════════════════════ */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <SoulPrintLogo size={28} />
          <span className="font-condensed text-lg font-bold tracking-widest text-white uppercase">SoulPrint</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm text-gray-300 hover:text-white transition-colors hidden sm:inline">Features</a>
          <a href="#testimonials" className="text-sm text-gray-300 hover:text-white transition-colors hidden sm:inline">Reviews</a>
          <Link href="/pricing" className="text-sm text-gray-300 hover:text-white transition-colors hidden sm:inline">Pricing</Link>
          <Link href="/auth" className="text-sm text-gray-300 hover:text-white transition-colors">Sign In</Link>
          <Link href="/auth" className="btn-orange px-5 py-2 rounded-lg text-sm">Open Chat</Link>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO — chat-first live demo
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden orange-glow-top">
        <div className="relative z-20 max-w-3xl mx-auto px-8 pt-6 pb-20 text-center">
          <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-6">
            Real memory. Real personas. Try it — no signup.
          </p>

          <h1 className="font-condensed font-black leading-[0.95] mb-6"
              style={{ fontSize: 'clamp(36px, 6vw, 64px)', letterSpacing: '-1px' }}>
            Stop re-explaining yourself to <span className="text-orange-500">AI</span>.
          </h1>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed max-w-xl mx-auto">
            Chat, organize, reflect, and plan with an AI that remembers your tone, your tempo, and your life.
          </p>

          {/* Live demo input */}
          <form onSubmit={handleDemoSubmit} className="dark-card rounded-2xl p-4 text-left">
            <textarea
              value={demoInput}
              onChange={(e) => setDemoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  runDemo();
                }
              }}
              placeholder="Ask me anything — see how SoulPrint responds differently..."
              rows={3}
              maxLength={600}
              className="chat-input-text w-full bg-transparent resize-none outline-none placeholder:text-gray-500 text-base mb-3"
            />
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {DEMO_MODEL_OPTIONS.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setDemoModel(m.key)}
                    className={`chip ${demoModel === m.key ? 'selected' : ''}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={demoLoading || !demoInput.trim()}
                className="w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Send"
              >
                {demoLoading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <ArrowUp className="w-4 h-4 text-white" />}
              </button>
            </div>
          </form>

          {/* Imprint picker — pick who SoulPrint is being right now */}
          <div className="mt-4">
            <p className="text-gray-600 text-[11px] uppercase tracking-widest font-bold mb-2">Try it as a different Imprint</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {DEMO_IMPRINTS.map(imp => (
                <button
                  key={imp.key}
                  type="button"
                  onClick={() => setDemoImprint(imp.key)}
                  className={`chip ${demoImprint === imp.key ? 'selected' : ''}`}
                >
                  <span className="mr-1">{imp.icon}</span>{imp.name}
                </button>
              ))}
            </div>
          </div>

          {/* Suggestion chips */}
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {SUGGESTIONS.map(s => (
              <button key={s} type="button" onClick={() => handleSuggestionClick(s)} className="chip">
                {s}
              </button>
            ))}
          </div>

          {/* Live demo result */}
          {demoError && (
            <p className="mt-6 text-sm text-red-400">{demoError}</p>
          )}
          {demoResult && (
            <div className="mt-8 text-left">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="dark-card rounded-xl p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{demoResult.baseline?.label || 'Generic AI'}</p>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{demoResult.baseline?.text}</p>
                </div>
                <div className="dark-card rounded-xl p-5" style={{ borderColor: 'rgba(246, 64, 0, 0.35)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-2 flex items-center gap-1.5">
                    {demoResult.soulprint?.imprint?.icon || selectedImprint.icon} {demoResult.soulprint?.imprint?.name || selectedImprint.name}
                  </p>
                  <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{demoResult.soulprint?.text}</p>
                  {demoResult.soulprint?.model && (
                    <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-white/10 flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      {demoResult.soulprint.autoRouted
                        ? <>Auto-picked <strong className="text-gray-300">{demoResult.soulprint.model}</strong> — {demoResult.soulprint.reason}.</>
                        : <>Using <strong className="text-gray-300">{demoResult.soulprint.model}</strong> — {demoResult.soulprint.reason}.</>}
                    </p>
                  )}
                </div>
              </div>

              {/* Multi-platform continuity — illustrative, not interactive in this demo */}
              <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-gray-600">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>A real SoulPrint continues this — with full memory — on Web, Telegram &amp; Slack.</span>
              </div>

              <div className="text-center pt-6">
                <Link href="/auth" className="btn-orange px-6 py-3 rounded-xl text-sm inline-flex items-center gap-2">
                  Like what you see? Get Your SoulPrint <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-gray-500 text-xs mt-2">Free to start. This demo remembers within this session only — a real account remembers forever.</p>
              </div>
            </div>
          )}

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-4 mt-8 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-green-500" /> Private & Encrypted</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-500" /> GPT-4o, Gemini & Claude</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-orange-500" /> Free to Start</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SOCIAL PROOF BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-y border-white/10 py-6 px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-sp-black flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              ))}
            </div>
            <div>
              <p className="text-white text-sm font-bold">20,000+</p>
              <p className="text-gray-500 text-[10px]">have discovered SoulPrint</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-white/10" />
          <div className="flex items-center gap-1.5">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 text-orange-500 fill-orange-500" />)}
            <span className="text-gray-300 text-sm font-medium ml-1">Loved by early adopters</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-white/10" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-500" />
            <span className="text-gray-300 text-sm font-medium">Your data stays yours</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          WHAT ONLY SOULPRINT CAN DO
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-10">
            What only SoulPrint can do
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {FIVE_FEATURES.map((f, i) => (
              <div key={i} className="pillar-card text-center">
                <f.icon className={`w-6 h-6 mx-auto mb-3 ${f.iconColor}`} />
                <h3 className="text-white font-bold text-sm mb-1.5">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          WHY SOULPRINT? — comparison table
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-8 border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-4">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">Why SoulPrint?</p>
            <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase tracking-wide mb-2">
              More features. Better price.
            </h2>
            <p className="text-gray-500 text-sm">See exactly how SoulPrint stacks up against the alternatives.</p>
          </div>

          <div className="dark-card rounded-2xl overflow-hidden mt-10">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase">Feature</th>
                    <th className="py-4 px-4 text-center bg-orange-500/10">
                      <div className="flex flex-col items-center gap-1">
                        <SoulPrintLogo size={16} />
                        <span className="text-xs font-bold text-white">SoulPrint</span>
                        <span className="text-xs text-orange-400 font-semibold">$19/mo <span className="text-green-400">Save $1</span></span>
                      </div>
                    </th>
                    <th className="py-4 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm">🤖</span>
                        <span className="text-xs font-bold text-gray-400">ChatGPT</span>
                        <span className="text-xs text-gray-600">$20/mo</span>
                      </div>
                    </th>
                    <th className="py-4 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm">🧠</span>
                        <span className="text-xs font-bold text-gray-400">Claude</span>
                        <span className="text-xs text-gray-600">$20/mo</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-3 px-4 text-gray-300 font-medium">{row.label}</td>
                      <td className="py-3 px-4 text-center bg-orange-500/5"><ComparisonCell value={row.sp} /></td>
                      <td className="py-3 px-4 text-center"><ComparisonCell value={row.chatgpt} /></td>
                      <td className="py-3 px-4 text-center"><ComparisonCell value={row.claude} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center pt-10">
            <Link href="/auth" className="btn-orange px-8 py-3.5 rounded-xl text-sm inline-flex items-center gap-2">
              Get Your SoulPrint — See the Difference <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="testimonials" className="py-24 px-8 border-t border-white/10">
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
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 text-orange-500 fill-orange-500" />)}
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
