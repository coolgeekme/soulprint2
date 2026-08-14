'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Brain, MessageCircle, Fingerprint, Sparkles, Shield, Mic, ChevronDown, Zap, VolumeX, Volume2, SkipBack, SkipForward, Pause, Play, Youtube, X, ChevronLeft, ChevronRight } from 'lucide-react';

const ORANGE = '#E85D04';
const ORANGE_LIGHT = '#F48C06';
const ORANGE_DARK = '#DC2F02';
const YT_PLAYLIST_ID = 'PLC-ghIgOfdtCo63EqzQZ-fXkESrnEXkR1';

// ── YouTube Contained Player Hook ──────────────────────────────────────────
function useYouTubePlayer({ isMuted, onPlayerReady }) {
  const playerRef = useRef(null);
  const initRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const create = () => {
      if (!window.YT?.Player || document.getElementById('yt-social-player')?.tagName === 'IFRAME') return;
      playerRef.current = new window.YT.Player('yt-social-player', {
        width: '100%',
        height: '100%',
        playerVars: {
          listType: 'playlist',
          list: YT_PLAYLIST_ID,
          autoplay: 1,
          mute: 1,
          controls: 0,
          showinfo: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: (e) => {
            const p = e.target;
            try {
              const pl = p.getPlaylist();
              if (pl && pl.length > 1) { const r = Math.floor(Math.random() * pl.length); p.setShuffle(true); p.setLoop(true); p.playVideoAt(r); }
              else { p.setShuffle(true); p.setLoop(true); }
            } catch { p.setShuffle(true); p.setLoop(true); }
            if (onPlayerReady) onPlayerReady(p);
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            }
          },
        },
      });
    };

    if (window.YT?.Player) create();
    else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); create(); };
    }
  }, []); // empty deps — only run once

  useEffect(() => {
    try {
      if (playerRef.current?.getPlayerState) {
        if (isMuted) playerRef.current.mute();
        else { playerRef.current.unMute(); playerRef.current.setVolume(40); }
      }
    } catch {}
  }, [isMuted]);

  return isPlaying;
}

// ── Video Popup Modal ──────────────────────────────────────────────────────
function VideoPopupModal({ videoId, heroPlayerRef, onClose }) {
  const popupRef = useRef(null);
  const [title, setTitle] = useState('');
  const [curId, setCurId] = useState(videoId);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!curId) return;
    const init = () => {
      if (!window.YT?.Player) return;
      try { popupRef.current?.destroy(); } catch {}
      popupRef.current = new window.YT.Player('yt-social-popup', {
        width: '100%', height: '100%', videoId: curId,
        playerVars: { autoplay: 1, modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1, controls: 1, fs: 1 },
        events: {
          onReady: (e) => { try { const d = e.target.getVideoData(); if (d?.title) setTitle(d.title); } catch {} },
          onStateChange: (e) => { if (e.data === window.YT.PlayerState.PLAYING) { try { const d = e.target.getVideoData(); if (d?.title) setTitle(d.title); } catch {} } },
        },
      });
    };
    if (window.YT?.Player) init();
    else { const c = setInterval(() => { if (window.YT?.Player) { clearInterval(c); init(); } }, 200); return () => clearInterval(c); }
    return () => { try { popupRef.current?.destroy(); } catch {} };
  }, [curId]);

  const nav = useCallback((dir) => {
    try {
      if (!heroPlayerRef?.current) return;
      if (dir === 'next') heroPlayerRef.current.nextVideo(); else heroPlayerRef.current.previousVideo();
      setTimeout(() => { try { const u = heroPlayerRef.current.getVideoUrl(); const m = u?.match(/[?&]v=([^&]+)/); if (m?.[1] && m[1] !== curId) setCurId(m[1]); } catch {} }, 600);
    } catch {}
  }, [heroPlayerRef, curId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={onClose}>
      <div className="relative w-full max-w-4xl mx-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors flex items-center gap-1 text-sm"><X className="w-4 h-4" /> Close</button>
        <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          <div className="aspect-video"><div id="yt-social-popup" style={{ width: '100%', height: '100%' }} /></div>
          <div className="px-4 py-3 flex items-center justify-between bg-black/80 border-t border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <Youtube className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-white/80 text-sm truncate">{title || 'Loading...'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => nav('prev')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => nav('next')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function SocialLandingPage() {
  const [isVisible, setIsVisible] = useState({});
  const [scrollY, setScrollY] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [popupVideoId, setPopupVideoId] = useState(null);
  const ytPlayerRef = useRef(null);
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const userUnmutedRef = useRef(false);

  const handlePlayerReady = useCallback((player) => { ytPlayerRef.current = player; }, []);
  const videoReady = useYouTubePlayer({ isMuted, onPlayerReady: handlePlayerReady });

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  // Auto-mute when hero scrolls out
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting && userUnmutedRef.current) {
        try { ytPlayerRef.current?.mute(); } catch {}
        setIsMuted(true);
        userUnmutedRef.current = false;
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      userUnmutedRef.current = !next;
      try { if (ytPlayerRef.current) { if (next) ytPlayerRef.current.mute(); else { ytPlayerRef.current.unMute(); ytPlayerRef.current.setVolume(40); } } } catch {}
      return next;
    });
  }, []);

  const togglePlayPause = useCallback(() => {
    try { if (!ytPlayerRef.current) return; const s = ytPlayerRef.current.getPlayerState(); if (s === 1) { ytPlayerRef.current.pauseVideo(); setIsPlaying(false); } else { ytPlayerRef.current.playVideo(); setIsPlaying(true); } } catch {}
  }, []);

  const skipNext = useCallback(() => { try { ytPlayerRef.current?.nextVideo(); setIsPlaying(true); } catch {} }, []);
  const skipPrev = useCallback(() => { try { ytPlayerRef.current?.previousVideo(); setIsPlaying(true); } catch {} }, []);

  const openPopup = useCallback(() => {
    try { if (!ytPlayerRef.current) return; const u = ytPlayerRef.current.getVideoUrl(); const m = u?.match(/[?&]v=([^&]+)/); if (m?.[1]) { ytPlayerRef.current.pauseVideo(); setIsPlaying(false); setPopupVideoId(m[1]); } } catch {}
  }, []);
  const closePopup = useCallback(() => { setPopupVideoId(null); try { if (ytPlayerRef.current) { ytPlayerRef.current.playVideo(); setIsPlaying(true); } } catch {} }, []);

  // Fade-in observer
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => { entries.forEach(e => { if (e.isIntersecting) setIsVisible(prev => ({ ...prev, [e.target.id]: true })); }); }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('[data-animate]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollToFeatures = () => featuresRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ════════════ LANGUAGE EXPANSION TICKER ════════════ */}
      <div className="relative z-40 bg-[#0a0a0a] border-b border-white/5 py-2 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-4 sm:gap-6 text-xs flex-wrap">
          <a href="https://foundryagents.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-200 hover:text-white transition-colors group">
            <span className="text-sm">🏢</span>
            <span className="font-semibold text-white group-hover:text-white">The Foundry</span>
            <span className="text-gray-400 group-hover:text-gray-300">(for Business)</span>
            <span className="px-1.5 py-0.5 bg-green-500/15 border border-green-500/30 rounded text-green-400 text-[9px] font-bold uppercase tracking-wider">Live</span>
          </a>
          <div className="w-px h-3.5 bg-white/10 hidden sm:block" />
          <a href="https://esp.soulprintengine.ai/lista-espera" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors group">
            <span className="text-sm">🇪🇸</span>
            <span className="font-medium">Versión en Español</span>
            <span className="px-1.5 py-0.5 bg-green-500/15 border border-green-500/30 rounded text-green-400 text-[9px] font-bold uppercase tracking-wider group-hover:bg-green-500/25 transition-colors">Waitlist Open</span>
          </a>
          <div className="w-px h-3.5 bg-white/10 hidden sm:block" />
          <a href="https://br.soulprintengine.ai/lista-espera" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors group">
            <span className="text-sm">🇧🇷</span>
            <span className="font-medium">Versão em Português</span>
            <span className="px-1.5 py-0.5 bg-green-500/15 border border-green-500/30 rounded text-green-400 text-[9px] font-bold uppercase tracking-wider group-hover:bg-green-500/25 transition-colors">Waitlist Open</span>
          </a>
        </div>
      </div>

      {/* ════════════ HERO — Split Layout ════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center px-4 sm:px-6 lg:px-12 xl:px-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-[700px] h-[700px] rounded-full opacity-[0.06] blur-[130px]"
            style={{ background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)`, top: '5%', left: '20%', transform: `translateY(${scrollY * -0.08}px)` }} />
          <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.04] blur-[100px]"
            style={{ background: `radial-gradient(circle, ${ORANGE_LIGHT} 0%, transparent 70%)`, bottom: '10%', right: '5%', transform: `translateY(${scrollY * -0.04}px)` }} />
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `linear-gradient(${ORANGE}30 1px, transparent 1px), linear-gradient(90deg, ${ORANGE}30 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
        </div>

        {/* Split content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center py-20 lg:py-0">

          {/* ── LEFT: Text Content ── */}
          <div className="max-w-xl">
            {/* Logo */}
            <div className="mb-8">
              <img 
                src="https://customer-assets.emergentagent.com/job_d84b7041-61f8-4f27-8460-1766fc06421c/artifacts/vwodyyp3_SoulPrintlogo-light.png"
                alt="SoulPrint Engine" className="h-12 sm:h-16 w-auto"
              />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/5 mb-7">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-300/90 font-medium tracking-wide">AI That Actually Knows You</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] mb-5 tracking-tight">
              <span className="text-white">Your AI</span><br />
              <span className="text-white">Companion with</span><br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 bg-clip-text text-transparent">Memory</span>
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                  <path d="M0 4 Q50 0, 100 4 T200 4" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                </svg>
              </span>
              <span className="text-white"> & </span>
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Personality</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-gray-400 mb-8 leading-relaxed max-w-md">
              SoulPrint doesn&apos;t just answer questions — it <span className="text-gray-200 font-medium">learns your style</span>, 
              <span className="text-gray-200 font-medium"> remembers your world</span>, and becomes 
              <span className="text-gray-200 font-medium"> uniquely yours</span>.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start gap-3 mb-6">
              <a 
                href="/auth"
                className="group relative inline-flex items-center gap-3 px-7 py-3.5 rounded-xl font-bold text-base text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-orange-500/20"
                style={{ background: `linear-gradient(135deg, ${ORANGE_DARK}, ${ORANGE}, ${ORANGE_LIGHT})` }}
              >
                <span className="relative z-10">Get Started Free</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <button 
                onClick={scrollToFeatures}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-medium text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all hover:bg-white/5 text-sm"
              >
                See How It Works <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">Free to start · No credit card · Takes 2 minutes</p>
          </div>

          {/* ── RIGHT: Video Player Card ── */}
          <div className="relative w-full">
            {/* Ambient glow */}
            <div className="absolute -inset-4 rounded-3xl opacity-40 -z-10"
              style={{ background: `radial-gradient(ellipse at center, ${ORANGE}12, transparent 70%)`, filter: 'blur(40px)' }} />

            {/* Video card */}
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/50 bg-[#0a0a0a]">
              {/* Video frame */}
              <div className="relative aspect-video bg-[#0a0a0a]">
                {/* YouTube player — always visible */}
                <div id="yt-social-player" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

                {/* Loading overlay — sits on top, fades out when playing */}
                <div 
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a] transition-opacity duration-1000 pointer-events-none"
                  style={{ opacity: videoReady ? 0 : 1, zIndex: videoReady ? -1 : 10 }}
                >
                  <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center animate-pulse">
                    <Play className="w-6 h-6 text-orange-400 ml-0.5" />
                  </div>
                  <p className="text-gray-600 text-xs">Loading playlist...</p>
                </div>
              </div>

              {/* Controls bar */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-[#080808] border-t border-white/5">
                <div className="flex items-center gap-1">
                  <button onClick={openPopup}
                    className="h-7 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/[0.06] flex items-center gap-1.5 text-white/50 hover:text-white transition-all text-[11px] font-medium">
                    <Youtube className="w-3 h-3 text-red-400" /> Watch Full
                  </button>
                  <div className="w-px h-3.5 bg-white/[0.06] mx-0.5" />
                  <button onClick={skipPrev} className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-all"><SkipBack className="w-3 h-3" /></button>
                  <button onClick={togglePlayPause} className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-all">
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-px" />}
                  </button>
                  <button onClick={skipNext} className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-all"><SkipForward className="w-3 h-3" /></button>
                </div>
                <button onClick={toggleMute} className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-all">
                  {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Attribution — glowing badge */}
            <div className="flex justify-center mt-4">
              <div className="attribution-badge-glow h-9 px-4 rounded-full bg-black/60 backdrop-blur-md border border-orange-500/40 flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                <span className="attribution-shimmer-text text-xs font-semibold">Clips generated with SoulPrint Engine</span>
                <span className="text-white/30 text-xs">·</span>
                <a href="https://www.youtube.com/@ArcheForgeHQ" target="_blank" rel="noopener noreferrer" className="text-orange-500/60 hover:text-orange-400 transition-colors text-xs">ArcheForge</a>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce opacity-30">
          <ChevronDown className="w-5 h-5 text-orange-400" />
        </div>
      </section>

      {/* Popup */}
      {popupVideoId && <VideoPopupModal videoId={popupVideoId} heroPlayerRef={ytPlayerRef} onClose={closePopup} />}

      {/* ════════════ ATTRIBUTION BANNER ════════════ */}
      <section className="relative bg-gradient-to-r from-orange-950 via-orange-900 to-orange-950 border-y border-orange-500/30 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent animate-pulse" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <p className="text-white font-bold text-sm sm:text-base">
              All clips generated using SoulPrint Engine
            </p>
          </div>
          <div className="hidden sm:block w-px h-5 bg-orange-500/40" />
          <p className="text-orange-200/80 text-xs sm:text-sm">
            No stock footage. All clips AI-generated.
          </p>
        </div>
      </section>

      {/* ════════════ PROBLEM / HOOK ════════════ */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0502] to-black" />
        <div id="hook" data-animate className={`relative max-w-3xl mx-auto text-center transition-all duration-1000 ${isVisible['hook'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
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

      {/* ════════════ FEATURES ════════════ */}
      <section ref={featuresRef} className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div id="features-header" data-animate className={`text-center mb-16 transition-all duration-1000 ${isVisible['features-header'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-orange-500/80 font-semibold text-sm tracking-widest uppercase mb-4">What Makes Us Different</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">An AI Built Around <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">You</span></h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Fingerprint, title: 'Your SoulPrint', desc: 'A unique AI fingerprint built from your conversations, preferences, and personality. No two SoulPrints are alike.', color: 'from-orange-500 to-red-500', bg: 'bg-orange-500/5 border-orange-500/10' },
              { icon: Brain, title: 'Persistent Memory', desc: 'It remembers everything — your goals, relationships, preferences, and past conversations. Never repeat yourself again.', color: 'from-amber-400 to-orange-500', bg: 'bg-amber-500/5 border-amber-500/10' },
              { icon: MessageCircle, title: 'Learns Your Style', desc: 'SoulPrint adapts to how you communicate — your tone, vocabulary, humor, and the way you think.', color: 'from-orange-400 to-yellow-500', bg: 'bg-orange-400/5 border-orange-400/10' },
              { icon: Mic, title: 'Real-Time Voice', desc: 'Have natural voice conversations with your AI. It speaks in the voice you choose — with all the context it knows about you.', color: 'from-red-500 to-orange-500', bg: 'bg-red-500/5 border-red-500/10' },
              { icon: Sparkles, title: 'Creates For You', desc: 'Generate images, get personalized advice, and create content — all tailored to your unique style and needs.', color: 'from-yellow-400 to-orange-400', bg: 'bg-yellow-500/5 border-yellow-500/10' },
              { icon: Shield, title: 'Private & Secure', desc: 'Your SoulPrint is yours alone. End-to-end encryption ensures your personal AI stays personal.', color: 'from-orange-600 to-red-600', bg: 'bg-orange-600/5 border-orange-600/10' },
            ].map((f, i) => (
              <div key={i} id={`feature-${i}`} data-animate
                className={`group relative p-6 sm:p-7 rounded-2xl border ${f.bg} backdrop-blur-sm transition-all duration-700 hover:border-orange-500/30 hover:bg-orange-500/[0.03] ${isVisible[`feature-${i}`] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 100}ms` }}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ HOW IT WORKS ════════════ */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0502] to-black" />
        <div className="relative max-w-4xl mx-auto">
          <div id="how-header" data-animate className={`text-center mb-16 transition-all duration-1000 ${isVisible['how-header'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-orange-500/80 font-semibold text-sm tracking-widest uppercase mb-4">How It Works</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Three Steps to <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Your AI</span></h2>
          </div>
          <div className="sm:grid sm:grid-cols-3 sm:gap-8 space-y-6 sm:space-y-0">
            {[
              { step: '01', title: 'Take the Assessment', desc: 'A quick personality & communication style quiz that seeds your SoulPrint.', icon: Fingerprint },
              { step: '02', title: 'Start Chatting', desc: 'Talk naturally. Your AI learns more about you with every conversation.', icon: MessageCircle },
              { step: '03', title: 'Watch It Evolve', desc: 'Your SoulPrint deepens over time. The AI becomes an extension of how you think.', icon: Zap },
            ].map((item, i) => (
              <div key={i} id={`step-${i}`} data-animate
                className={`relative text-center transition-all duration-700 ${isVisible[`step-${i}`] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 200}ms` }}>
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
                  style={{ background: `linear-gradient(135deg, ${ORANGE}15, ${ORANGE}05)`, border: `1px solid ${ORANGE}20` }}>
                  <item.icon className="w-8 h-8 text-orange-400" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ COMPARISON ════════════ */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div id="compare" data-animate className={`transition-all duration-1000 ${isVisible['compare'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-orange-500/80 font-semibold text-sm tracking-widest uppercase mb-4 text-center">The Difference</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">Generic AI vs. <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">SoulPrint</span></h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <div className="text-center pb-4 border-b border-white/10"><p className="text-gray-400 font-semibold text-sm">Other AI</p></div>
                {['Forgets everything between sessions','Same generic responses for everyone','Robotic, impersonal tone','No context about your life','Starts from zero every time'].map((t, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5"><span className="text-red-500/70 mt-0.5 flex-shrink-0">✗</span><span className="text-gray-400 text-sm">{t}</span></div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="text-center pb-4 border-b border-orange-500/30"><p className="text-orange-400 font-semibold text-sm">SoulPrint</p></div>
                {['Remembers every conversation & detail','Uniquely personalized to your style','Adapts to your tone & personality','Knows your goals, preferences & world','Grows smarter with every interaction'].map((t, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-orange-500/[0.04] border border-orange-500/10"><span className="text-orange-400 mt-0.5 flex-shrink-0">✓</span><span className="text-gray-200 text-sm">{t}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ FINAL CTA ════════════ */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-[800px] h-[800px] rounded-full opacity-[0.06] blur-[150px]"
            style={{ background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)`, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
        </div>
        <div id="final-cta" data-animate className={`relative max-w-2xl mx-auto text-center transition-all duration-1000 ${isVisible['final-cta'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex justify-center mb-8">
            <img src="https://customer-assets.emergentagent.com/job_d84b7041-61f8-4f27-8460-1766fc06421c/artifacts/fm7j6atc_soulprint_logo.png" alt="SoulPrint" className="w-20 h-20 sm:w-24 sm:h-24" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 leading-tight">
            Ready to Meet an AI<br />
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 bg-clip-text text-transparent">That Knows You?</span>
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-lg mx-auto">Join SoulPrint Engine and experience what AI should have been all along — personal, adaptive, and truly yours.</p>
          <a href="/auth"
            className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-lg text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/25"
            style={{ background: `linear-gradient(135deg, ${ORANGE_DARK}, ${ORANGE}, ${ORANGE_LIGHT})` }}>
            <span className="relative z-10">Get Started Free</span>
            <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <p className="mt-6 text-sm text-gray-600">Free forever plan available · No credit card needed</p>
        </div>
      </section>

      {/* ════════════ FOOTER ════════════ */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="https://customer-assets.emergentagent.com/job_d84b7041-61f8-4f27-8460-1766fc06421c/artifacts/fm7j6atc_soulprint_logo.png" alt="SoulPrint" className="w-7 h-7" />
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
