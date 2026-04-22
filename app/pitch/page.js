'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

// ═══════════════════════════════════════════════════════════════════
// SOULPRINT ENGINE — INVESTOR PITCH DECK
// ═══════════════════════════════════════════════════════════════════

const TOTAL_SLIDES = 12;

// Animated counter hook
function useCounter(target, duration = 2000, startWhenVisible = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startWhenVisible);
  const ref = useRef(null);

  useEffect(() => {
    if (!startWhenVisible) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startWhenVisible]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  return { count, ref };
}

// ═══ SLIDE COMPONENTS ═══════════════════════════════════════════════

function Slide01Cover({ active }) {
  return (
    <div className="slide-content flex flex-col items-center justify-center text-center px-4 md:px-8">
      {/* Logo */}
      <div className={`transition-all duration-1000 ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <div className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 md:mb-8 flex items-center justify-center">
          <SoulPrintLogo size={typeof window !== 'undefined' && window.innerWidth < 768 ? 64 : 96} />
        </div>
      </div>

      <h1 className={`text-3xl sm:text-5xl md:text-8xl font-black tracking-[0.08em] sm:tracking-[0.15em] md:tracking-[0.2em] text-white mb-3 md:mb-4 transition-all duration-1000 delay-200 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        SOULPRINT ENGINE
      </h1>
      <p className={`text-base sm:text-lg md:text-2xl text-orange-400 font-medium tracking-widest mb-8 md:mb-12 transition-all duration-1000 delay-400 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        THE AI THAT KNOWS YOU
      </p>

      <div className={`flex items-center gap-3 md:gap-6 text-xs md:text-sm text-gray-500 transition-all duration-1000 delay-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <span className="px-3 md:px-4 py-1.5 md:py-2 border border-white/10 rounded-full">Investor Deck</span>
        <span className="px-3 md:px-4 py-1.5 md:py-2 border border-white/10 rounded-full">2026</span>
        <span className="px-3 md:px-4 py-1.5 md:py-2 border border-white/10 rounded-full">Confidential</span>
      </div>

      <p className={`mt-8 md:absolute md:bottom-12 text-gray-600 text-xs tracking-wider transition-all duration-1000 delay-1000 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <span className="hidden md:inline">USE ARROW KEYS OR CLICK TO NAVIGATE →</span>
        <span className="md:hidden">SWIPE OR TAP EDGES TO NAVIGATE →</span>
      </p>
    </div>
  );
}

function Slide02Problem({ active }) {
  const problems = [
    { icon: '🔄', title: 'You re-explain yourself every session', desc: 'ChatGPT, Claude, Gemini — none of them remember who you are, what you do, or how you think.' },
    { icon: '🧩', title: 'Your AI tools are fragmented', desc: 'Chat in one app. Images in another. Video in a third. Voice in a fourth. Code review in a fifth. No continuity.' },
    { icon: '🤖', title: 'AI feels generic, not personal', desc: 'Every user gets the same robotic experience. No tone matching. No personality. No soul.' },
  ];

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-xs md:text-sm font-bold tracking-[0.3em] uppercase mb-3 md:mb-4 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        THE PROBLEM
      </p>
      <h2 className={`text-2xl sm:text-3xl md:text-6xl font-black text-white mb-3 md:mb-4 leading-tight transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        AI doesn&apos;t know you.<br/>
        <span className="text-gray-500">And it never remembers.</span>
      </h2>
      <p className={`text-gray-400 text-sm md:text-lg mb-6 md:mb-12 max-w-2xl transition-all duration-700 delay-200 ${active ? 'opacity-100' : 'opacity-0'}`}>
        The average knowledge worker uses 4.7 different AI tools daily — and starts from zero every single time.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {problems.map((p, i) => (
          <div
            key={i}
            className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
            style={{ transitionDelay: `${400 + i * 150}ms` }}
          >
            <span className="text-3xl mb-4 block">{p.icon}</span>
            <h3 className="text-white font-bold text-lg mb-2">{p.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide03Solution({ active }) {
  const tools = [
    { name: 'ChatGPT / Claude', icon: '💬', replaced: 'AI Chat' },
    { name: 'Midjourney / DALL·E', icon: '🎨', replaced: 'Image Gen' },
    { name: 'Runway / Sora', icon: '🎬', replaced: 'Video Gen' },
    { name: 'ElevenLabs', icon: '🎙️', replaced: 'Voice Chat' },
    { name: 'GitHub Copilot', icon: '💻', replaced: 'Code Review' },
  ];

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-xs md:text-sm font-bold tracking-[0.3em] uppercase mb-3 md:mb-4 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        THE SOLUTION
      </p>
      <h2 className={`text-2xl sm:text-3xl md:text-6xl font-black text-white mb-3 md:mb-4 leading-tight transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        One AI. All modalities.<br/>
        <span className="text-orange-400">It remembers everything.</span>
      </h2>
      <p className={`text-gray-400 text-sm md:text-lg mb-6 md:mb-12 max-w-2xl transition-all duration-700 delay-200 ${active ? 'opacity-100' : 'opacity-0'}`}>
        SoulPrint Engine builds a persistent personality model of each user — then delivers that understanding across chat, voice, images, video, and code.
      </p>

      <div className={`transition-all duration-700 delay-300 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <p className="text-gray-600 text-xs font-bold tracking-[0.3em] uppercase mb-4">REPLACES 5+ SUBSCRIPTIONS</p>
        <div className="flex flex-wrap gap-3">
          {tools.map((t, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-3 transition-all duration-500 ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
              style={{ transitionDelay: `${500 + i * 100}ms` }}
            >
              <span className="text-xl">{t.icon}</span>
              <div>
                <p className="text-gray-500 text-xs line-through">{t.name}</p>
                <p className="text-white text-sm font-semibold">{t.replaced}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`mt-10 flex items-center gap-3 transition-all duration-700 delay-1000 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
        <p className="text-orange-400/60 text-xs tracking-widest">ONE SUBSCRIPTION. ZERO CONTEXT SWITCHING.</p>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
      </div>
    </div>
  );
}

function Slide04Product({ active }) {
  const features = [
    { title: 'Multi-Model Chat', desc: 'GPT-4o, Claude, Gemini, Perplexity — switch models mid-conversation with full context preserved.', icon: '💬', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/20' },
    { title: 'AI Image Studio', desc: 'Generate, edit, composite, and remix images inline. Supports DALL·E, Nano Banana, Seedream, and more.', icon: '🎨', color: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/20' },
    { title: 'AI Video Generation', desc: 'Text-to-video and image-to-video with Kling 3.0, Veo 3.1, and Runway. Real-time progress tracking.', icon: '🎬', color: 'from-red-500/20 to-orange-500/20', border: 'border-red-500/20' },
    { title: 'Real-Time Voice', desc: 'WebRTC-powered voice chat with GPT-4o Realtime and Gemini Live. Natural conversations, not dictation.', icon: '🎙️', color: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/20' },
    { title: 'GitHub Integration', desc: 'Read repos, review code, and auto-generate Pull Requests with fixes — all from the chat interface.', icon: '💻', color: 'from-gray-500/20 to-slate-500/20', border: 'border-gray-500/20' },
    { title: 'SoulPrint Memory', desc: 'Persistent personality model built from conversations and assessments. AI adapts tone, style, and depth.', icon: '🧠', color: 'from-orange-500/20 to-yellow-500/20', border: 'border-orange-500/20' },
  ];

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-sm font-bold tracking-[0.3em] uppercase mb-4 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        THE PRODUCT
      </p>
      <h2 className={`text-2xl sm:text-3xl md:text-5xl font-black text-white mb-6 md:mb-10 transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        Everything AI, in one place.
      </h2>

      <div className="grid md:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <div
            key={i}
            className={`bg-gradient-to-br ${f.color} border ${f.border} rounded-2xl p-5 transition-all duration-600 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: `${300 + i * 100}ms` }}
          >
            <span className="text-2xl mb-3 block">{f.icon}</span>
            <h3 className="text-white font-bold mb-1.5">{f.title}</h3>
            <p className="text-gray-400 text-xs leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide05DynamicIntelligence({ active }) {
  const chatModels = [
    { name: 'GPT-4o', strength: 'Reasoning & Analysis', color: 'text-green-400', bg: 'bg-green-500/10' },
    { name: 'Claude', strength: 'Writing & Nuance', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { name: 'Gemini', strength: 'Multimodal & Research', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { name: 'Perplexity', strength: 'Real-Time Web Search', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ];

  const mediaModels = [
    { name: 'DALL·E / gpt-image', strength: 'Photorealistic Images', color: 'text-emerald-400' },
    { name: 'Nano Banana', strength: 'Artistic & Stylized', color: 'text-pink-400' },
    { name: 'Seedream', strength: 'High-Detail Renders', color: 'text-amber-400' },
    { name: 'Kling 2.1', strength: 'Fast Video Gen', color: 'text-red-400' },
    { name: 'Veo 3.1', strength: 'Cinematic Video', color: 'text-indigo-400' },
    { name: 'Wan 2.1', strength: 'Character-Ref Video', color: 'text-yellow-400' },
  ];

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-xs md:text-sm font-bold tracking-[0.3em] uppercase mb-3 md:mb-4 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        DYNAMIC INTELLIGENCE
      </p>
      <h2 className={`text-2xl sm:text-3xl md:text-5xl font-black text-white mb-3 md:mb-4 leading-tight transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        The right model, every time.<br/>
        <span className="text-gray-500">Automatically.</span>
      </h2>
      <p className={`text-gray-400 text-sm md:text-base mb-6 md:mb-8 max-w-2xl transition-all duration-700 delay-200 ${active ? 'opacity-100' : 'opacity-0'}`}>
        Users never choose a model. Our routing engine analyzes every query — intent, complexity, modality — and selects the optimal AI model in real time.
      </p>

      {/* Flow diagram */}
      <div className={`grid md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-start transition-all duration-700 delay-300 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Left: User query */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 md:p-5">
          <p className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs">💬</span>
            User Sends a Message
          </p>
          <div className="space-y-2 text-xs">
            {[
              { query: '"Explain quantum computing simply"', route: 'Chat → GPT-4o', color: 'text-green-400' },
              { query: '"Write me a poem about the ocean"', route: 'Chat → Claude', color: 'text-purple-400' },
              { query: '"Generate a sunset over mountains"', route: 'Image → Nano Banana', color: 'text-pink-400' },
              { query: '"Create a 5s video of a cat playing"', route: 'Video → Kling 2.1', color: 'text-red-400' },
            ].map((ex, i) => (
              <div key={i} className={`flex items-center gap-2 transition-all duration-500 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: `${500 + i * 100}ms` }}>
                <span className="text-gray-500 flex-shrink-0">→</span>
                <span className="text-gray-400 truncate">{ex.query}</span>
                <span className={`${ex.color} font-bold whitespace-nowrap ml-auto`}>{ex.route}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Engine */}
        <div className={`hidden md:flex flex-col items-center justify-center transition-all duration-700 delay-500 ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center mb-2">
            <span className="text-2xl">⚡</span>
          </div>
          <p className="text-orange-400 text-[9px] font-bold tracking-widest text-center">ROUTING<br/>ENGINE</p>
          <div className="w-px h-6 bg-orange-500/20 mt-2" />
          <span className="text-orange-500/40 text-lg">↓</span>
        </div>

        {/* Right: Models */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 md:p-5">
          <p className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs">🧠</span>
            18+ AI Models
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {chatModels.map((m, i) => (
              <div key={i} className={`${m.bg} rounded-lg px-2.5 py-1.5 transition-all duration-500 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: `${600 + i * 80}ms` }}>
                <p className={`${m.color} text-[10px] font-bold`}>{m.name}</p>
                <p className="text-gray-500 text-[9px]">{m.strength}</p>
              </div>
            ))}
          </div>
          <div className="h-px bg-white/5 my-2" />
          <div className="grid grid-cols-2 gap-1.5">
            {mediaModels.map((m, i) => (
              <div key={i} className={`bg-white/[0.03] rounded-lg px-2.5 py-1.5 transition-all duration-500 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: `${800 + i * 60}ms` }}>
                <p className={`${m.color} text-[10px] font-bold`}>{m.name}</p>
                <p className="text-gray-500 text-[9px]">{m.strength}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom insight */}
      <div className={`mt-6 md:mt-8 bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4 md:p-5 text-center transition-all duration-700 delay-1000 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-orange-400 font-bold text-sm mb-1">Why This Matters</p>
        <p className="text-gray-400 text-xs">Competitors force users to pick models manually. SoulPrint Engine makes 18+ models feel like <span className="text-white font-semibold">one seamlessly intelligent AI</span> — reducing friction and increasing perceived quality for every interaction.</p>
      </div>
    </div>
  );
}

function Slide06HowItWorks({ active }) {
  const steps = [
    { num: '01', title: 'SoulPrint Assessment', desc: 'A multi-layered personality quiz captures communication style, interests, expertise, and preferences.', icon: '📋' },
    { num: '02', title: 'Memory Engine', desc: 'Every conversation enriches the user\'s SoulPrint. Memories are categorized, indexed, and recalled contextually.', icon: '🧠' },
    { num: '03', title: 'Adaptive AI', desc: 'The AI dynamically adjusts its tone, vocabulary, depth, and approach based on the user\'s unique SoulPrint profile.', icon: '⚡' },
    { num: '04', title: 'Multi-Modal Delivery', desc: 'The personalized experience carries across chat, voice, images, video, and code — seamlessly.', icon: '🌐' },
  ];

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-sm font-bold tracking-[0.3em] uppercase mb-4 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        HOW IT WORKS
      </p>
      <h2 className={`text-2xl sm:text-3xl md:text-5xl font-black text-white mb-4 md:mb-8 transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        The SoulPrint Engine Flywheel
      </h2>

      {/* Assessment Spotlight */}
      <div className={`bg-gradient-to-r from-orange-500/[0.08] to-red-500/[0.04] border border-orange-500/20 rounded-2xl p-5 mb-8 transition-all duration-700 delay-200 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-2xl flex-shrink-0">📋</div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-orange-400 font-bold text-base">The SoulPrint Assessment</h3>
              <span className="text-[9px] font-bold tracking-widest bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">KEY DIFFERENTIATOR</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-2">
              Before a single message is exchanged, users complete a guided personality quiz that teaches the AI <span className="text-white font-semibold">how they think, communicate, and prefer to receive information</span>. This isn&apos;t a generic chatbot — it&apos;s an AI that&apos;s been calibrated to you.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Communication style', 'Emotional tone', 'Technical depth', 'Interests & expertise', 'Decision-making patterns', 'Learning preferences'].map((tag, i) => (
                <span key={i} className="text-[10px] px-2.5 py-1 bg-orange-500/10 border border-orange-500/15 rounded-full text-orange-300/80">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="relative">
        <div className="absolute top-8 left-8 right-8 h-px bg-gradient-to-r from-orange-500/0 via-orange-500/30 to-orange-500/0 hidden md:block" />
        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`relative text-center transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
              style={{ transitionDelay: `${500 + i * 150}ms` }}
            >
              <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl ${i === 0 ? 'bg-orange-500/20 border-orange-500/30' : 'bg-orange-500/10 border-orange-500/20'} border flex items-center justify-center text-xl relative z-10`}>
                {s.icon}
              </div>
              <p className="text-orange-500/50 text-xs font-bold tracking-widest mb-1">{s.num}</p>
              <h3 className="text-white font-bold text-sm mb-1">{s.title}</h3>
              <p className="text-gray-500 text-[11px] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`mt-8 bg-orange-500/5 border border-orange-500/10 rounded-2xl p-5 text-center transition-all duration-700 delay-1200 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-orange-400 font-bold text-sm mb-1">The Moat</p>
        <p className="text-gray-400 text-xs">The Assessment + ongoing memory create a <span className="text-white font-semibold">compounding personalization effect</span>. Users who invest time building their SoulPrint have near-zero switching cost to competitors — their AI already knows them.</p>
      </div>
    </div>
  );
}

function Slide07Market({ active }) {
  const tam = useCounter(244, 2000, active);
  const sam = useCounter(48, 2000, active);
  const som = useCounter(2.4, 2000, active);

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-sm font-bold tracking-[0.3em] uppercase mb-4 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        MARKET OPPORTUNITY
      </p>
      <h2 className={`text-4xl md:text-5xl font-black text-white mb-12 transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        The AI assistant market is exploding.
      </h2>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {[
          { label: 'TAM', value: '$244B', sub: 'Global AI Software Market by 2028', color: 'text-white', bg: 'from-white/[0.04] to-white/[0.02]' },
          { label: 'SAM', value: '$48B', sub: 'AI Assistants & Creative Tools', color: 'text-orange-400', bg: 'from-orange-500/[0.08] to-orange-500/[0.02]' },
          { label: 'SOM', value: '$2.4B', sub: 'Premium Personalized AI Companions', color: 'text-yellow-400', bg: 'from-yellow-500/[0.08] to-yellow-500/[0.02]' },
        ].map((m, i) => (
          <div
            key={i}
            className={`bg-gradient-to-b ${m.bg} border border-white/[0.06] rounded-2xl p-8 text-center transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: `${400 + i * 200}ms` }}
          >
            <p className="text-gray-600 text-xs font-bold tracking-[0.3em] mb-3">{m.label}</p>
            <p className={`text-4xl md:text-5xl font-black ${m.color} mb-2`}>{m.value}</p>
            <p className="text-gray-500 text-xs">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className={`grid md:grid-cols-2 gap-6 transition-all duration-700 delay-1000 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <p className="text-white font-bold text-sm mb-2">📈 Why Now</p>
          <ul className="text-gray-400 text-xs space-y-1.5">
            <li>• Foundation model costs dropping 10x/year</li>
            <li>• Multi-modal AI (text + image + video + voice) just became viable</li>
            <li>• Consumer AI fatigue with generic chatbots is driving demand for personalization</li>
          </ul>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <p className="text-white font-bold text-sm mb-2">🎯 Our Wedge</p>
          <ul className="text-gray-400 text-xs space-y-1.5">
            <li>• Memory-first architecture creates switching costs</li>
            <li>• All-in-one replaces $100+/mo in separate AI subscriptions</li>
            <li>• Viral invite system drives organic growth at zero CAC</li>
            <li>• <span className="text-orange-400">Native language versions</span> unlock non-English markets (not translations — full native builds)</li>
            <li>• <span className="text-orange-400">B2B arm</span> brings enterprise ACV alongside consumer revenue</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Slide08Traction({ active }) {
  const metrics = [
    { value: '25K+', label: 'Views Since Apr 1', sub: 'Paid social across 5 DMAs', color: 'text-white' },
    { value: '1,300+', label: 'Messages Sent', sub: 'Active beta users', color: 'text-orange-400' },
    { value: '108', label: 'Avg Msgs / User', sub: 'Extremely high engagement', color: 'text-blue-400' },
    { value: '444', label: 'Conversations', sub: 'Organic usage depth', color: 'text-purple-400' },
    { value: '81', label: 'Videos Generated', sub: 'Multi-modal adoption', color: 'text-green-400' },
    { value: '18+', label: 'AI Models', sub: 'Multi-provider architecture', color: 'text-yellow-400' },
  ];

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-sm font-bold tracking-[0.3em] uppercase mb-4 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        TRACTION
      </p>
      <h2 className={`text-4xl md:text-5xl font-black text-white mb-4 transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        Early but engaged.
      </h2>
      <p className={`text-gray-400 text-lg mb-6 transition-all duration-700 delay-200 ${active ? 'opacity-100' : 'opacity-0'}`}>
        Pre-revenue. Launched private beta March 4, public beta April 7. Paid social ads since April 1 across 5 DMAs.
      </p>

      {/* Timeline */}
      <div className={`flex items-center gap-0 mb-8 transition-all duration-700 delay-250 ${active ? 'opacity-100' : 'opacity-0'}`}>
        {[
          { date: 'Mar 4', label: 'Private Beta', color: 'bg-orange-500' },
          { date: 'Apr 1', label: 'Paid Ads (5 DMAs)', color: 'bg-blue-500' },
          { date: 'Apr 7', label: 'Public Beta', color: 'bg-green-500' },
        ].map((t, i) => (
          <div key={i} className="flex-1 flex flex-col items-center relative">
            <div className={`w-3 h-3 rounded-full ${t.color} z-10`} />
            {i < 2 && <div className="absolute top-1.5 left-1/2 w-full h-px bg-white/10" />}
            <p className="text-white text-xs font-bold mt-2">{t.date}</p>
            <p className="text-gray-500 text-[10px]">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {metrics.map((m, i) => (
          <div
            key={i}
            className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: `${400 + i * 100}ms` }}
          >
            <p className={`text-3xl font-black ${m.color} mb-1`}>{m.value}</p>
            <p className="text-white text-sm font-medium">{m.label}</p>
            <p className="text-gray-600 text-xs mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className={`grid md:grid-cols-3 gap-4 transition-all duration-700 delay-1000 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4 text-center">
          <p className="text-orange-400 text-lg font-black">Pre-Revenue</p>
          <p className="text-gray-500 text-xs">Monetization begins May 2026</p>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-center">
          <p className="text-blue-400 text-lg font-black">5 DMAs</p>
          <p className="text-gray-500 text-xs">Paid social ads since Apr 1</p>
        </div>
        <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
          <p className="text-green-400 text-lg font-black">Viral Invites</p>
          <p className="text-gray-500 text-xs">Organic growth engine active</p>
        </div>
      </div>
    </div>
  );
}

function Slide09BusinessModel({ active }) {
  const plans = [
    { name: 'Free', price: '$0', period: '/mo', features: ['Basic AI chat', '20 images/mo (watermarked)', '1 video (lifetime)', 'Community support'], color: 'border-gray-500/20', badge: 'text-gray-400', highlight: false },
    { name: 'Base', price: '$20.01', period: '/mo', features: ['Premium models (GPT-4o, Claude)', '20 images/mo (no watermark)', '1 video/mo', 'Voice chat', 'File analysis', 'Email support'], color: 'border-orange-500/30', badge: 'text-orange-400', highlight: true },
    { name: 'Power', price: '$99', period: '/mo', features: ['Unlimited everything', 'All AI models', 'Unlimited images & video', 'API access', 'Priority support', 'GitHub integration'], color: 'border-yellow-500/30', badge: 'text-yellow-400', highlight: false },
  ];

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-sm font-bold tracking-[0.3em] uppercase mb-4 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        BUSINESS MODEL
      </p>
      <h2 className={`text-2xl sm:text-3xl md:text-5xl font-black text-white mb-6 md:mb-10 transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        Three tiers. Clear value.
      </h2>

      <div className="grid md:grid-cols-3 gap-5 mb-10">
        {plans.map((p, i) => (
          <div
            key={i}
            className={`relative bg-white/[0.02] border ${p.color} rounded-2xl p-6 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${p.highlight ? 'ring-1 ring-orange-500/30 bg-orange-500/[0.03]' : ''}`}
            style={{ transitionDelay: `${400 + i * 150}ms` }}
          >
            {p.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wider">
                MOST POPULAR
              </div>
            )}
            <p className={`${p.badge} font-bold text-sm tracking-wider mb-3`}>{p.name}</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-white text-4xl font-black">{p.price}</span>
              <span className="text-gray-500 text-sm">{p.period}</span>
            </div>
            <ul className="space-y-2">
              {p.features.map((f, fi) => (
                <li key={fi} className="text-gray-400 text-xs flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={`grid md:grid-cols-2 gap-5 transition-all duration-700 delay-900 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <p className="text-white font-bold text-sm mb-2">💰 Revenue Expansion</p>
          <ul className="text-gray-400 text-xs space-y-1">
            <li>• Video credit packs ($2.99 – $149.99) for pay-as-you-go</li>
            <li>• Annual billing at 20% discount locks in retention</li>
            <li>• Lifetime deals for early adopters drive urgency</li>
          </ul>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <p className="text-white font-bold text-sm mb-2">🔁 Growth Engine</p>
          <ul className="text-gray-400 text-xs space-y-1">
            <li>• Viral invite system — each user gets 5 invites</li>
            <li>• Auto-replenish: hit 0 invites → get 5 more</li>
            <li>• Free tier drives top-of-funnel → converts to paid</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Slide10Vision({ active }) {
  const languages = [
    { lang: 'Spanish', flag: '🇪🇸', market: '580M speakers', status: 'In Development' },
    { lang: 'Portuguese', flag: '🇧🇷', market: '260M speakers', status: 'Planned' },
    { lang: 'Arabic', flag: '🇸🇦', market: '420M speakers', status: 'Planned' },
    { lang: 'Hindi', flag: '🇮🇳', market: '600M speakers', status: 'Planned' },
    { lang: 'Mandarin', flag: '🇨🇳', market: '1.1B speakers', status: 'Planned' },
    { lang: 'French', flag: '🇫🇷', market: '320M speakers', status: 'Planned' },
  ];

  const b2bUseCases = [
    { icon: '🏥', title: 'Healthcare', desc: 'AI assistants trained on medical protocols, patient communication styles, HIPAA-compliant memory' },
    { icon: '⚖️', title: 'Legal', desc: 'Contract review, case research, and client communication with firm-specific tone and precedent' },
    { icon: '🏦', title: 'Financial Services', desc: 'Personalized wealth management AI, compliance-aware chat, portfolio reporting' },
    { icon: '🎓', title: 'Education', desc: 'Adaptive AI tutors that learn each student\'s pace, gaps, and learning style' },
  ];

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-sm font-bold tracking-[0.3em] uppercase mb-4 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        VISION & EXPANSION
      </p>
      <h2 className={`text-2xl sm:text-3xl md:text-5xl font-black text-white mb-6 md:mb-10 transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        Two massive growth vectors.
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Native Language Versions */}
        <div className={`bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 transition-all duration-700 delay-300 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg">🌍</div>
            <div>
              <h3 className="text-white font-bold text-base">Native Language Versions</h3>
              <p className="text-blue-400 text-[10px] font-bold tracking-widest">NOT TRANSLATIONS — FULL NATIVE BUILDS</p>
            </div>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed mb-4">
            Each language version is built from the ground up with native cultural context, idioms, and communication patterns — not simply run through a translation layer. The SoulPrint personality model adapts to culturally-specific emotional expression.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {languages.map((l, i) => (
              <div
                key={i}
                className={`bg-white/[0.03] rounded-lg px-2.5 py-2 text-center transition-all duration-500 ${active ? 'opacity-100' : 'opacity-0'}`}
                style={{ transitionDelay: `${600 + i * 80}ms` }}
              >
                <span className="text-lg">{l.flag}</span>
                <p className="text-white text-[10px] font-bold mt-0.5">{l.lang}</p>
                <p className="text-gray-600 text-[9px]">{l.market}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
            <p className="text-blue-400 text-[10px] font-bold">MARKET MULTIPLIER</p>
            <p className="text-gray-400 text-[10px]">English-only AI serves ~1.5B people. Native versions unlock <span className="text-white font-semibold">5B+ additional users</span> — a 3x TAM expansion.</p>
          </div>
        </div>

        {/* B2B Enterprise Arm */}
        <div className={`bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 transition-all duration-700 delay-500 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-lg">🏢</div>
            <div>
              <h3 className="text-white font-bold text-base">B2B Enterprise Solutions</h3>
              <p className="text-purple-400 text-[10px] font-bold tracking-widest">AI SOLUTIONS FOR BUSINESSES</p>
            </div>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed mb-4">
            The same personalization engine that powers consumer SoulPrint Engine becomes a white-label AI platform for enterprises — with custom knowledge bases, compliance controls, and team-wide memory.
          </p>
          <div className="space-y-2">
            {b2bUseCases.map((u, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 bg-white/[0.02] rounded-lg px-3 py-2 transition-all duration-500 ${active ? 'opacity-100' : 'opacity-0'}`}
                style={{ transitionDelay: `${700 + i * 100}ms` }}
              >
                <span className="text-base mt-0.5">{u.icon}</span>
                <div>
                  <p className="text-white text-xs font-bold">{u.title}</p>
                  <p className="text-gray-500 text-[10px] leading-relaxed">{u.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
            <p className="text-purple-400 text-[10px] font-bold">REVENUE IMPACT</p>
            <p className="text-gray-400 text-[10px]">Enterprise contracts bring <span className="text-white font-semibold">10-50x higher ACV</span> than consumer subscriptions with lower churn and longer commitments.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide11Team({ active }) {
  const team = [
    { name: '[Founder Name]', title: 'CEO & Co-Founder', bio: '[Background — e.g., 10+ years building consumer AI products. Previously at X.]', placeholder: true },
    { name: '[Co-Founder Name]', title: 'CTO & Co-Founder', bio: '[Background — e.g., Engineering lead at Y. ML/infrastructure expert.]', placeholder: true },
    { name: '[Team Member]', title: '[Role]', bio: '[Background and relevant experience]', placeholder: true },
  ];

  return (
    <div className="slide-content flex flex-col justify-center px-4 md:px-20 max-w-6xl mx-auto w-full">
      <p className={`text-orange-400 text-sm font-bold tracking-[0.3em] uppercase mb-4 transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
        THE TEAM
      </p>
      <h2 className={`text-4xl md:text-5xl font-black text-white mb-12 transition-all duration-700 delay-100 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        Built by operators who&apos;ve been here before.
      </h2>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {team.map((t, i) => (
          <div
            key={i}
            className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 text-center transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: `${400 + i * 150}ms` }}
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <h3 className={`font-bold text-lg mb-1 ${t.placeholder ? 'text-orange-400/60' : 'text-white'}`}>{t.name}</h3>
            <p className="text-orange-400 text-xs font-medium mb-3">{t.title}</p>
            <p className={`text-xs leading-relaxed ${t.placeholder ? 'text-gray-600 italic' : 'text-gray-400'}`}>{t.bio}</p>
          </div>
        ))}
      </div>

      <div className={`bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 text-center transition-all duration-700 delay-900 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-white font-bold text-sm mb-2">🏗️ What We&apos;ve Built So Far</p>
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          {['Full-stack Next.js app', 'Multi-provider LLM routing', 'Stripe billing integration', 'Real-time voice (WebRTC)', 'GitHub OAuth + PR automation', 'PWA with offline support', 'Admin dashboard with analytics', 'Viral invite system'].map((item, i) => (
            <span key={i} className="px-3 py-1.5 bg-orange-500/5 border border-orange-500/10 rounded-full text-gray-400">{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slide12Ask({ active }) {
  return (
    <div className="slide-content flex flex-col items-center justify-center text-center px-8 md:px-20 max-w-4xl mx-auto w-full">
      <div className={`w-20 h-20 mx-auto mb-8 flex items-center justify-center transition-all duration-1000 ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <SoulPrintLogo size={80} />
      </div>

      <h2 className={`text-3xl md:text-6xl font-black text-white mb-4 md:mb-6 transition-all duration-700 delay-200 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        The Ask
      </h2>

      <div className={`bg-orange-500/5 border border-orange-500/20 rounded-2xl p-8 mb-8 w-full transition-all duration-700 delay-400 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <p className="text-orange-400 text-sm font-bold tracking-widest mb-3">RAISING</p>
        <p className="text-4xl md:text-5xl font-black text-white mb-2">$1.5M</p>
        <p className="text-gray-500 text-sm">Pre-Revenue — Seed Round</p>
      </div>

      <div className={`grid md:grid-cols-3 gap-4 w-full mb-10 transition-all duration-700 delay-600 ${active ? 'opacity-100' : 'opacity-0'}`}>
        {[
          { pct: '49%', amount: '$42K', label: 'Payroll / Ops', desc: 'Team growth, operations, legal, compliance' },
          { pct: '45%', amount: '$38K', label: 'Marketing', desc: 'Paid social, creator partnerships, 5 DMA expansion' },
          { pct: '6%', amount: '$5K', label: 'Development', desc: 'Infrastructure, GPU compute, API costs' },
        ].map((u, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-orange-400 text-2xl font-black">{u.pct}</p>
            <p className="text-white text-sm font-bold">{u.label}</p>
            <p className="text-gray-400 text-xs font-mono mb-1">{u.amount}/mo</p>
            <p className="text-gray-500 text-xs mt-1">{u.desc}</p>
          </div>
        ))}
      </div>

      <div className={`transition-all duration-700 delay-800 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-gray-500 text-sm mb-6">
          We&apos;re building the AI that people don&apos;t just use — they <span className="text-white font-semibold">rely on</span>.
        </p>
        <div className="flex items-center justify-center gap-4">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-orange-500/30" />
          <p className="text-orange-400/60 text-xs tracking-[0.3em]">[CONTACT@EMAIL.COM]</p>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-orange-500/30" />
        </div>
      </div>

      <p className={`absolute bottom-12 text-gray-700 text-xs transition-all duration-700 delay-1000 ${active ? 'opacity-100' : 'opacity-0'}`}>
        This deck is confidential and intended for potential investors only.
      </p>
    </div>
  );
}

// ═══ MAIN DECK COMPONENT ════════════════════════════════════════════

const SLIDES = [
  Slide01Cover,
  Slide02Problem,
  Slide03Solution,
  Slide04Product,
  Slide05DynamicIntelligence,
  Slide06HowItWorks,
  Slide07Market,
  Slide08Traction,
  Slide09BusinessModel,
  Slide10Vision,
  Slide11Team,
  Slide12Ask,
];

const SLIDE_TITLES = [
  'Cover', 'Problem', 'Solution', 'Product', 'Dynamic Intelligence', 'How It Works',
  'Market', 'Traction', 'Business Model', 'Vision & Expansion', 'Team', 'The Ask'
];

export default function PitchDeck() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const containerRef = useRef(null);
  const navTimeout = useRef(null);

  // Add body class to allow landscape on pitch page + disable orientation lock
  useEffect(() => {
    document.body.classList.add('allow-landscape');
    // Also try to unlock orientation
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch (e) {}
    return () => { document.body.classList.remove('allow-landscape'); };
  }, []);

  const goTo = useCallback((idx) => {
    if (idx >= 0 && idx < TOTAL_SLIDES) setCurrentSlide(idx);
  }, []);

  const next = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);
  const prev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'Escape') exitFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  // Touch swipe navigation (horizontal only — allows vertical scroll)
  const touchStart = useRef(null);
  const touchStartY = useRef(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onTouchStart = (e) => { 
      touchStart.current = e.touches[0].clientX; 
      touchStartY.current = e.touches[0].clientY; 
    };
    const onTouchEnd = (e) => {
      if (touchStart.current === null) return;
      const diffX = touchStart.current - e.changedTouches[0].clientX;
      const diffY = touchStartY.current - e.changedTouches[0].clientY;
      // Only navigate if horizontal swipe is dominant and significant
      if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 2) { 
        diffX > 0 ? next() : prev(); 
      }
      touchStart.current = null;
      touchStartY.current = null;
    };
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => { container.removeEventListener('touchstart', onTouchStart); container.removeEventListener('touchend', onTouchEnd); };
  }, [next, prev]);

  // Auto-hide nav
  useEffect(() => {
    const handleMove = () => {
      setShowNav(true);
      clearTimeout(navTimeout.current);
      navTimeout.current = setTimeout(() => setShowNav(false), 3000);
    };
    window.addEventListener('mousemove', handleMove);
    return () => { window.removeEventListener('mousemove', handleMove); clearTimeout(navTimeout.current); };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-[#0a0a0a] select-none"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[300px] bg-red-500/[0.02] rounded-full blur-[100px]" />
      </div>

      {/* Slides */}
      <div className="relative w-full h-full">
        {SLIDES.map((SlideComponent, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 pitch-slide-scroll transition-all duration-700 ease-out ${
              idx === currentSlide ? 'opacity-100 translate-x-0 z-10' :
              idx < currentSlide ? 'opacity-0 -translate-x-16 z-0 pointer-events-none' :
              'opacity-0 translate-x-16 z-0 pointer-events-none'
            }`}
          >
            <div className="pitch-slide-inner">
              <SlideComponent active={idx === currentSlide} />
            </div>
          </div>
        ))}
      </div>

      {/* Click zones for navigation - hidden on mobile for scroll */}
      <div className="absolute inset-0 z-20 hidden md:flex pointer-events-none">
        <div className="w-1/3 h-full pointer-events-auto cursor-w-resize" onClick={prev} />
        <div className="w-1/3 h-full" />
        <div className="w-1/3 h-full pointer-events-auto cursor-e-resize" onClick={next} />
      </div>

      {/* Bottom nav bar */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-500 ${showNav ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 bg-gradient-to-t from-black/80 to-transparent">
          {/* Slide dots */}
          <div className="flex items-center gap-1.5 md:gap-2">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); goTo(idx); }}
                className={`transition-all duration-300 rounded-full pointer-events-auto ${
                  idx === currentSlide
                    ? 'w-6 md:w-8 h-1.5 md:h-2 bg-orange-500'
                    : 'w-1.5 md:w-2 h-1.5 md:h-2 bg-white/20 hover:bg-white/40'
                }`}
                title={SLIDE_TITLES[idx]}
              />
            ))}
          </div>

          {/* Slide counter */}
          <div className="flex items-center gap-2 md:gap-4 pointer-events-auto">
            <span className="text-gray-500 text-[10px] md:text-xs font-mono">
              {String(currentSlide + 1).padStart(2, '0')} / {String(TOTAL_SLIDES).padStart(2, '0')}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              className="hidden md:block text-gray-500 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              {isFullscreen ? '⊘ Exit' : '⛶ Fullscreen'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); window.print(); }}
              className="hidden md:block text-gray-500 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              🖨 Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Arrow buttons */}
      {currentSlide > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all pointer-events-auto ${showNav ? 'opacity-100' : 'opacity-0'}`}
        >
          ‹
        </button>
      )}
      {currentSlide < TOTAL_SLIDES - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all pointer-events-auto ${showNav ? 'opacity-100' : 'opacity-0'}`}
        >
          ›
        </button>
      )}

      {/* Print styles + landscape support */}
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .slide-content { page-break-after: always; page-break-inside: avoid; min-height: 100vh; }
          [class*="absolute"] { position: relative !important; }
          [class*="fixed"] { position: relative !important; }
          [class*="opacity-0"] { opacity: 1 !important; }
          [class*="translate"] { transform: none !important; }
        }
        /* Override global landscape lock for pitch deck — handled via body.allow-landscape class */
        /* Enable smooth touch scrolling within slides */
        .pitch-slide-scroll {
          -webkit-overflow-scrolling: touch;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        /* Inner wrapper: centers content on tall screens, scrolls on short ones */
        .pitch-slide-inner {
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4rem 0;
        }
        .pitch-slide-inner > * {
          flex-shrink: 0;
          width: 100%;
        }
        @media (orientation: landscape) and (max-height: 600px) {
          .pitch-slide-inner {
            display: block !important;
            min-height: auto !important;
            padding: 1rem 0 4rem !important;
            align-items: unset !important;
          }
        }
        /* Landscape mobile optimization */
        @media (orientation: landscape) and (max-height: 500px) {
          .slide-content { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
          .slide-content h1 { font-size: 1.5rem !important; margin-bottom: 0.25rem !important; }
          .slide-content h2 { font-size: 1.25rem !important; margin-bottom: 0.5rem !important; }
          .slide-content h3 { font-size: 0.8rem !important; }
          .slide-content p { font-size: 0.7rem !important; line-height: 1.3 !important; margin-bottom: 0.25rem !important; }
          .slide-content .grid { gap: 0.375rem !important; }
        }
        @media (orientation: landscape) and (min-height: 501px) and (max-height: 768px) {
          .slide-content h1 { font-size: 2.5rem !important; }
          .slide-content h2 { font-size: 1.75rem !important; }
        }
      `}</style>
    </div>
  );
}
