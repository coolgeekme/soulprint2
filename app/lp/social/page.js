'use client';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Brain, MessageCircle, Fingerprint, Sparkles, Shield, Mic, ChevronDown, Star, Zap, Heart } from 'lucide-react';
import Image from 'next/image';

// Brand colors
const ORANGE = '#E85D04';
const ORANGE_LIGHT = '#F48C06';
const ORANGE_DARK = '#DC2F02';

export default function SocialLandingPage() {
  const [isVisible, setIsVisible] = useState({});
  const [email, setEmail] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const featuresRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection observer for fade-in animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(prev => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Gradient orbs */}
          <div 
            className="absolute w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px]"
            style={{ 
              background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)`,
              top: '10%', left: '50%', transform: `translate(-50%, ${scrollY * -0.1}px)` 
            }}
          />
          <div 
            className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[100px]"
            style={{ 
              background: `radial-gradient(circle, ${ORANGE_LIGHT} 0%, transparent 70%)`,
              bottom: '20%', right: '-5%', transform: `translateY(${scrollY * -0.05}px)` 
            }}
          />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(${ORANGE}40 1px, transparent 1px), linear-gradient(90deg, ${ORANGE}40 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
          {/* Radial fade */}
          <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img 
              src="https://customer-assets.emergentagent.com/job_d84b7041-61f8-4f27-8460-1766fc06421c/artifacts/vwodyyp3_SoulPrintlogo-light.png"
              alt="SoulPrint Engine"
              className="h-14 sm:h-20 w-auto"
            />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/5 mb-8">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-300/90 font-medium tracking-wide">AI That Actually Knows You</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-[1.05] mb-6 tracking-tight">
            <span className="text-white">Your AI Companion</span>
            <br />
            <span className="text-white">with </span>
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 bg-clip-text text-transparent">Memory</span>
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M0 4 Q50 0, 100 4 T200 4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
              </svg>
            </span>
            <span className="text-white"> & </span>
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Personality</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            SoulPrint doesn&apos;t just answer questions — it <span className="text-gray-200 font-medium">learns your style</span>, 
            <span className="text-gray-200 font-medium"> remembers your world</span>, and becomes 
            <span className="text-gray-200 font-medium"> uniquely yours</span> over time.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <a 
              href="/auth"
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/20"
              style={{ background: `linear-gradient(135deg, ${ORANGE_DARK}, ${ORANGE}, ${ORANGE_LIGHT})` }}
            >
              <span className="relative z-10">Get Started Free</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            <button 
              onClick={scrollToFeatures}
              className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl font-medium text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all hover:bg-white/5"
            >
              See How It Works
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Trust line */}
          <p className="text-sm text-gray-600">
            Free to start &middot; No credit card required &middot; Takes 2 minutes
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-40">
          <ChevronDown className="w-5 h-5 text-orange-400" />
        </div>
      </section>

      {/* ========== PROBLEM / HOOK SECTION ========== */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0502] to-black" />
        <div 
          id="hook" 
          data-animate 
          className={`relative max-w-3xl mx-auto text-center transition-all duration-1000 ${isVisible['hook'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <p className="text-orange-500/80 font-semibold text-sm tracking-widest uppercase mb-6">The Problem</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-8">
            Every other AI treats you like a <span className="text-gray-500 line-through">stranger</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
            You repeat yourself. It forgets your preferences. It doesn&apos;t know your style. 
            <span className="block mt-4 text-white font-semibold text-xl sm:text-2xl">SoulPrint changes that — forever.</span>
          </p>
        </div>
      </section>

      {/* ========== FEATURES SECTION ========== */}
      <section ref={featuresRef} className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div 
            id="features-header" 
            data-animate 
            className={`text-center mb-16 transition-all duration-1000 ${isVisible['features-header'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <p className="text-orange-500/80 font-semibold text-sm tracking-widest uppercase mb-4">What Makes Us Different</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              An AI Built Around <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">You</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Fingerprint,
                title: 'Your SoulPrint',
                desc: 'A unique AI fingerprint built from your conversations, preferences, and personality. No two SoulPrints are alike.',
                color: 'from-orange-500 to-red-500',
                bg: 'bg-orange-500/5 border-orange-500/10',
              },
              {
                icon: Brain,
                title: 'Persistent Memory',
                desc: 'It remembers everything — your goals, relationships, preferences, and past conversations. Never repeat yourself again.',
                color: 'from-amber-400 to-orange-500',
                bg: 'bg-amber-500/5 border-amber-500/10',
              },
              {
                icon: MessageCircle,
                title: 'Learns Your Style',
                desc: 'SoulPrint adapts to how you communicate — your tone, vocabulary, humor, and the way you think.',
                color: 'from-orange-400 to-yellow-500',
                bg: 'bg-orange-400/5 border-orange-400/10',
              },
              {
                icon: Mic,
                title: 'Real-Time Voice',
                desc: 'Have natural voice conversations with your AI. It speaks in the voice you choose — with all the context it knows about you.',
                color: 'from-red-500 to-orange-500',
                bg: 'bg-red-500/5 border-red-500/10',
              },
              {
                icon: Sparkles,
                title: 'Creates For You',
                desc: 'Generate images, get personalized advice, and create content — all tailored to your unique style and needs.',
                color: 'from-yellow-400 to-orange-400',
                bg: 'bg-yellow-500/5 border-yellow-500/10',
              },
              {
                icon: Shield,
                title: 'Private & Secure',
                desc: 'Your SoulPrint is yours alone. End-to-end encryption ensures your personal AI stays personal.',
                color: 'from-orange-600 to-red-600',
                bg: 'bg-orange-600/5 border-orange-600/10',
              },
            ].map((feature, idx) => (
              <div 
                key={idx}
                id={`feature-${idx}`}
                data-animate
                className={`group relative p-6 sm:p-7 rounded-2xl border ${feature.bg} backdrop-blur-sm transition-all duration-700 hover:border-orange-500/30 hover:bg-orange-500/[0.03] ${
                  isVisible[`feature-${idx}`] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0502] to-black" />
        <div className="relative max-w-4xl mx-auto">
          <div 
            id="how-header" 
            data-animate 
            className={`text-center mb-16 transition-all duration-1000 ${isVisible['how-header'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <p className="text-orange-500/80 font-semibold text-sm tracking-widest uppercase mb-4">How It Works</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Three Steps to <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Your AI</span>
            </h2>
          </div>

          <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-8">
            {[
              {
                step: '01',
                title: 'Take the Assessment',
                desc: 'A quick personality & communication style quiz that seeds your SoulPrint.',
                icon: Fingerprint,
              },
              {
                step: '02',
                title: 'Start Chatting',
                desc: 'Talk naturally. Your AI learns more about you with every conversation.',
                icon: MessageCircle,
              },
              {
                step: '03',
                title: 'Watch It Evolve',
                desc: 'Your SoulPrint deepens over time. The AI becomes an extension of how you think.',
                icon: Zap,
              },
            ].map((item, idx) => (
              <div 
                key={idx}
                id={`step-${idx}`}
                data-animate
                className={`relative text-center transition-all duration-700 ${
                  isVisible[`step-${idx}`] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${idx * 200}ms` }}
              >
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
                  style={{ background: `linear-gradient(135deg, ${ORANGE}15, ${ORANGE}05)`, border: `1px solid ${ORANGE}20` }}>
                  <item.icon className="w-8 h-8 text-orange-400" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== COMPARISON SECTION ========== */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div 
            id="compare" 
            data-animate 
            className={`transition-all duration-1000 ${isVisible['compare'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <p className="text-orange-500/80 font-semibold text-sm tracking-widest uppercase mb-4 text-center">The Difference</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
              Generic AI vs. <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">SoulPrint</span>
            </h2>

            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {/* Generic AI Column */}
              <div className="space-y-3">
                <div className="text-center pb-4 border-b border-white/10">
                  <p className="text-gray-500 font-semibold text-sm">Other AI</p>
                </div>
                {[
                  'Forgets everything between sessions',
                  'Same generic responses for everyone',
                  'Robotic, impersonal tone',
                  'No context about your life',
                  'Starts from zero every time',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-red-500/60 mt-0.5 flex-shrink-0">✗</span>
                    <span className="text-gray-500 text-sm">{item}</span>
                  </div>
                ))}
              </div>

              {/* SoulPrint Column */}
              <div className="space-y-3">
                <div className="text-center pb-4 border-b border-orange-500/30">
                  <p className="text-orange-400 font-semibold text-sm">SoulPrint</p>
                </div>
                {[
                  'Remembers every conversation & detail',
                  'Uniquely personalized to your style',
                  'Adapts to your tone & personality',
                  'Knows your goals, preferences & world',
                  'Grows smarter with every interaction',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-orange-500/[0.04] border border-orange-500/10">
                    <span className="text-orange-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute w-[800px] h-[800px] rounded-full opacity-[0.06] blur-[150px]"
            style={{ 
              background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)`,
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)'
            }}
          />
        </div>
        
        <div 
          id="final-cta" 
          data-animate 
          className={`relative max-w-2xl mx-auto text-center transition-all duration-1000 ${isVisible['final-cta'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Logo icon */}
          <div className="flex justify-center mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_d84b7041-61f8-4f27-8460-1766fc06421c/artifacts/fm7j6atc_soulprint_logo.png"
              alt="SoulPrint"
              className="w-20 h-20 sm:w-24 sm:h-24"
            />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 leading-tight">
            Ready to Meet an AI<br />
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 bg-clip-text text-transparent">
              That Knows You?
            </span>
          </h2>
          
          <p className="text-lg text-gray-400 mb-10 max-w-lg mx-auto">
            Join SoulPrint Engine and experience what AI should have been all along — personal, adaptive, and truly yours.
          </p>

          <a 
            href="/auth"
            className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-lg text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/25"
            style={{ background: `linear-gradient(135deg, ${ORANGE_DARK}, ${ORANGE}, ${ORANGE_LIGHT})` }}
          >
            <span className="relative z-10">Get Started Free</span>
            <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>

          <p className="mt-6 text-sm text-gray-600">
            Free forever plan available &middot; No credit card needed
          </p>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_d84b7041-61f8-4f27-8460-1766fc06421c/artifacts/fm7j6atc_soulprint_logo.png"
              alt="SoulPrint"
              className="w-7 h-7"
            />
            <span className="text-sm text-gray-600">© 2026 SoulPrint Engine. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <a href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-gray-400 transition-colors">Terms</a>
            <span className="text-gray-700">soulprintengine.ai</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
