'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Brain, MessageCircle, Fingerprint, Sparkles, Shield, Mic, ChevronDown, Zap, VolumeX, Volume2, SkipBack, SkipForward, Pause, Play, Youtube, X, ChevronLeft, ChevronRight } from 'lucide-react';

// Brand colors
const ORANGE = '#E85D04';
const ORANGE_LIGHT = '#F48C06';
const ORANGE_DARK = '#DC2F02';

const YT_PLAYLIST_ID = 'PLC-ghIgOfdtCo63EqzQZ-fXkESrnEXkR1';

// ── Lazy YouTube Player ────────────────────────────────────────────────────
// Only initializes when the section scrolls into view
function LazyYouTubePlayer({ isMuted, onPlayerReady }) {
  const playerRef = useRef(null);
  const initRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);

  const initPlayer = useCallback(() => {
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
              const playlist = p.getPlaylist();
              if (playlist && playlist.length > 1) {
                const randIdx = Math.floor(Math.random() * playlist.length);
                p.setShuffle(true);
                p.setLoop(true);
                p.playVideoAt(randIdx);
              } else {
                p.setShuffle(true);
                p.setLoop(true);
              }
            } catch {
              p.setShuffle(true);
              p.setLoop(true);
            }
            if (onPlayerReady) onPlayerReady(p);
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setVideoReady(true);
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      create();
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      }
      const prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCb) prevCb();
        create();
      };
    }
  }, [onPlayerReady]);

  // Mute/unmute sync
  useEffect(() => {
    try {
      if (playerRef.current?.isMuted && playerRef.current?.getPlayerState) {
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
          playerRef.current.setVolume(40);
        }
      }
    } catch {}
  }, [isMuted]);

  return { initPlayer, videoReady };
}

// ── Video Popup Modal ──────────────────────────────────────────────────────
function VideoPopupModal({ videoId, heroPlayerRef, onClose }) {
  const popupPlayerRef = useRef(null);
  const [popupTitle, setPopupTitle] = useState('');
  const [currentVideoId, setCurrentVideoId] = useState(videoId);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!currentVideoId) return;
    const initPopup = () => {
      if (!window.YT?.Player) return;
      try { popupPlayerRef.current?.destroy(); } catch {}

      popupPlayerRef.current = new window.YT.Player('yt-social-popup-player', {
        width: '100%',
        height: '100%',
        videoId: currentVideoId,
        playerVars: { autoplay: 1, modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1, controls: 1, fs: 1 },
        events: {
          onReady: (e) => { try { const d = e.target.getVideoData(); if (d?.title) setPopupTitle(d.title); } catch {} },
          onStateChange: (e) => { if (e.data === window.YT.PlayerState.PLAYING) { try { const d = e.target.getVideoData(); if (d?.title) setPopupTitle(d.title); } catch {} } },
        },
      });
    };

    if (window.YT?.Player) initPopup();
    else {
      const check = setInterval(() => { if (window.YT?.Player) { clearInterval(check); initPopup(); } }, 200);
      return () => clearInterval(check);
    }
    return () => { try { popupPlayerRef.current?.destroy(); } catch {} };
  }, [currentVideoId]);

  const popupNav = useCallback((dir) => {
    try {
      if (!heroPlayerRef?.current) return;
      if (dir === 'next') heroPlayerRef.current.nextVideo();
      else heroPlayerRef.current.previousVideo();
      setTimeout(() => {
        try {
          const url = heroPlayerRef.current.getVideoUrl();
          const match = url?.match(/[?&]v=([^&]+)/);
          if (match?.[1] && match[1] !== currentVideoId) setCurrentVideoId(match[1]);
        } catch {}
      }, 600);
    } catch {}
  }, [heroPlayerRef, currentVideoId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={onClose}>
      <div className="relative w-full max-w-4xl mx-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors flex items-center gap-1 text-sm">
          <X className="w-4 h-4" /> Close
        </button>
        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          <div className="aspect-video">
            <div id="yt-social-popup-player" style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="px-4 py-3 flex items-center justify-between bg-black/80 border-t border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <Youtube className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-white/80 text-sm truncate">{popupTitle || 'Loading...'}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => popupNav('prev')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => popupNav('next')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
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
  const videoSectionRef = useRef(null);
  const featuresRef = useRef(null);
  const userUnmutedRef = useRef(false);
  const hasLazyLoaded = useRef(false);

  const handlePlayerReady = useCallback((player) => {
    ytPlayerRef.current = player;
  }, []);

  const { initPlayer, videoReady } = LazyYouTubePlayer({ isMuted, onPlayerReady: handlePlayerReady });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lazy-load: only init YouTube when video section is near viewport
  useEffect(() => {
    const el = videoSectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLazyLoaded.current) {
          hasLazyLoaded.current = true;
          initPlayer();
        }
      },
      { rootMargin: '200px 0px' } // Start loading 200px before it enters
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [initPlayer]);

  // Auto-mute when video section scrolls out of view
  useEffect(() => {
    const el = videoSectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && userUnmutedRef.current) {
          try { ytPlayerRef.current?.mute(); } catch {}
          setIsMuted(true);
          userUnmutedRef.current = false;
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      userUnmutedRef.current = !next;
      try {
        if (ytPlayerRef.current) {
          if (next) ytPlayerRef.current.mute();
          else { ytPlayerRef.current.unMute(); ytPlayerRef.current.setVolume(40); }
        }
      } catch {}
      return next;
    });
  }, []);

  const togglePlayPause = useCallback(() => {
    try {
      if (!ytPlayerRef.current) return;
      const state = ytPlayerRef.current.getPlayerState();
      if (state === 1) { ytPlayerRef.current.pauseVideo(); setIsPlaying(false); }
      else { ytPlayerRef.current.playVideo(); setIsPlaying(true); }
    } catch {}
  }, []);

  const skipNext = useCallback(() => { try { ytPlayerRef.current?.nextVideo(); setIsPlaying(true); } catch {} }, []);
  const skipPrev = useCallback(() => { try { ytPlayerRef.current?.previousVideo(); setIsPlaying(true); } catch {} }, []);

  const openVideoPopup = useCallback(() => {
    try {
      if (!ytPlayerRef.current) return;
      const url = ytPlayerRef.current.getVideoUrl();
      const match = url?.match(/[?&]v=([^&]+)/);
      if (match?.[1]) { ytPlayerRef.current.pauseVideo(); setIsPlaying(false); setPopupVideoId(match[1]); }
    } catch {}
  }, []);

  const closeVideoPopup = useCallback(() => {
    setPopupVideoId(null);
    try { if (ytPlayerRef.current) { ytPlayerRef.current.playVideo(); setIsPlaying(true); } } catch {}
  }, []);

  // Intersection observer for fade-in animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setIsVisible(prev => ({ ...prev, [entry.target.id]: true }));
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToFeatures = () => featuresRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ========== HERO SECTION — Clean text, no video ========== */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px]"
            style={{ background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)`, top: '10%', left: '50%', transform: `translate(-50%, ${scrollY * -0.1}px)` }}
          />
          <div 
            className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[100px]"
            style={{ background: `radial-gradient(circle, ${ORANGE_LIGHT} 0%, transparent 70%)`, bottom: '20%', right: '-5%', transform: `translateY(${scrollY * -0.05}px)` }}
          />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(${ORANGE}40 1px, transparent 1px), linear-gradient(90deg, ${ORANGE}40 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="mb-8 flex justify-center">
            <img 
              src="https://customer-assets.emergentagent.com/job_d84b7041-61f8-4f27-8460-1766fc06421c/artifacts/vwodyyp3_SoulPrintlogo-light.png"
              alt="SoulPrint Engine"
              className="h-14 sm:h-20 w-auto"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/5 mb-8">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-300/90 font-medium tracking-wide">AI That Actually Knows You</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-[1.05] mb-6 tracking-tight">
            <span className="text-white">Your AI Companion</span><br />
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

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            SoulPrint doesn&apos;t just answer questions — it <span className="text-gray-200 font-medium">learns your style</span>, 
            <span className="text-gray-200 font-medium"> remembers your world</span>, and becomes 
            <span className="text-gray-200 font-medium"> uniquely yours</span> over time.
          </p>

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

          <p className="text-sm text-gray-600">
            Free to start &middot; No credit card required &middot; Takes 2 minutes
          </p>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-40">
          <ChevronDown className="w-5 h-5 text-orange-400" />
        </div>
      </section>

      {/* ========== VIDEO SHOWCASE SECTION — Dedicated, lazy-loaded ========== */}
      <section ref={videoSectionRef} className="relative py-16 sm:py-24 px-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#080401] to-black" />

        <div className="relative max-w-4xl mx-auto">
          {/* Section header */}
          <div 
            id="video-header"
            data-animate
            className={`text-center mb-10 transition-all duration-1000 ${isVisible['video-header'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <p className="text-orange-500/80 font-semibold text-sm tracking-widest uppercase mb-3">See It In Action</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
              Watch How <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">SoulPrint</span> Works
            </h2>
          </div>

          {/* Video player container */}
          <div 
            id="video-player"
            data-animate
            className={`transition-all duration-1000 delay-200 ${isVisible['video-player'] ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.98]'}`}
          >
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-orange-500/5 group">
              {/* Orange glow behind the player */}
              <div className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"
                style={{ background: `linear-gradient(135deg, ${ORANGE}20, transparent, ${ORANGE_LIGHT}15)`, filter: 'blur(20px)' }}
              />
              
              {/* Video frame */}
              <div className="relative aspect-video bg-[#0a0a0a]">
                {/* Placeholder / loading state */}
                {!videoReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                    <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <Play className="w-7 h-7 text-orange-400 ml-1" />
                    </div>
                    <p className="text-gray-500 text-sm">Loading playlist...</p>
                  </div>
                )}
                
                {/* YouTube player target */}
                <div 
                  id="yt-social-player"
                  className="absolute inset-0"
                  style={{ 
                    opacity: videoReady ? 1 : 0,
                    transition: 'opacity 1s ease-in-out',
                  }}
                />
              </div>

              {/* Controls bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  {/* Watch full screen */}
                  <button
                    onClick={openVideoPopup}
                    className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 text-white/60 hover:text-white transition-all text-xs font-medium"
                  >
                    <Youtube className="w-3.5 h-3.5 text-red-400" /> Watch Full
                  </button>

                  <div className="w-px h-4 bg-white/10 mx-1" />

                  {/* Transport */}
                  <button onClick={skipPrev} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all" aria-label="Previous">
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={togglePlayPause} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all" aria-label={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>
                  <button onClick={skipNext} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all" aria-label="Next">
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Mute */}
                  <button onClick={toggleMute} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all" aria-label={isMuted ? 'Unmute' : 'Mute'}>
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Subtle CTA below video */}
            <p className="text-center text-gray-600 text-xs mt-4">
              ▶ From the <a href="https://www.youtube.com/@ArcheForgeHQ" target="_blank" rel="noopener noreferrer" className="text-orange-500/60 hover:text-orange-400 transition-colors">ArcheForge</a> playlist
            </p>
          </div>
        </div>
      </section>

      {/* Video Popup Modal */}
      {popupVideoId && <VideoPopupModal videoId={popupVideoId} heroPlayerRef={ytPlayerRef} onClose={closeVideoPopup} />}

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
              { icon: Fingerprint, title: 'Your SoulPrint', desc: 'A unique AI fingerprint built from your conversations, preferences, and personality. No two SoulPrints are alike.', color: 'from-orange-500 to-red-500', bg: 'bg-orange-500/5 border-orange-500/10' },
              { icon: Brain, title: 'Persistent Memory', desc: 'It remembers everything — your goals, relationships, preferences, and past conversations. Never repeat yourself again.', color: 'from-amber-400 to-orange-500', bg: 'bg-amber-500/5 border-amber-500/10' },
              { icon: MessageCircle, title: 'Learns Your Style', desc: 'SoulPrint adapts to how you communicate — your tone, vocabulary, humor, and the way you think.', color: 'from-orange-400 to-yellow-500', bg: 'bg-orange-400/5 border-orange-400/10' },
              { icon: Mic, title: 'Real-Time Voice', desc: 'Have natural voice conversations with your AI. It speaks in the voice you choose — with all the context it knows about you.', color: 'from-red-500 to-orange-500', bg: 'bg-red-500/5 border-red-500/10' },
              { icon: Sparkles, title: 'Creates For You', desc: 'Generate images, get personalized advice, and create content — all tailored to your unique style and needs.', color: 'from-yellow-400 to-orange-400', bg: 'bg-yellow-500/5 border-yellow-500/10' },
              { icon: Shield, title: 'Private & Secure', desc: 'Your SoulPrint is yours alone. End-to-end encryption ensures your personal AI stays personal.', color: 'from-orange-600 to-red-600', bg: 'bg-orange-600/5 border-orange-600/10' },
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
              { step: '01', title: 'Take the Assessment', desc: 'A quick personality & communication style quiz that seeds your SoulPrint.', icon: Fingerprint },
              { step: '02', title: 'Start Chatting', desc: 'Talk naturally. Your AI learns more about you with every conversation.', icon: MessageCircle },
              { step: '03', title: 'Watch It Evolve', desc: 'Your SoulPrint deepens over time. The AI becomes an extension of how you think.', icon: Zap },
            ].map((item, idx) => (
              <div 
                key={idx}
                id={`step-${idx}`}
                data-animate
                className={`relative text-center transition-all duration-700 ${isVisible[`step-${idx}`] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${idx * 200}ms` }}
              >
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
                  style={{ background: `linear-gradient(135deg, ${ORANGE}15, ${ORANGE}05)`, border: `1px solid ${ORANGE}20` }}>
                  <item.icon className="w-8 h-8 text-orange-400" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">{item.step}</span>
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
              <div className="space-y-3">
                <div className="text-center pb-4 border-b border-white/10">
                  <p className="text-gray-500 font-semibold text-sm">Other AI</p>
                </div>
                {['Forgets everything between sessions','Same generic responses for everyone','Robotic, impersonal tone','No context about your life','Starts from zero every time'].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-red-500/60 mt-0.5 flex-shrink-0">✗</span>
                    <span className="text-gray-500 text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="text-center pb-4 border-b border-orange-500/30">
                  <p className="text-orange-400 font-semibold text-sm">SoulPrint</p>
                </div>
                {['Remembers every conversation & detail','Uniquely personalized to your style','Adapts to your tone & personality','Knows your goals, preferences & world','Grows smarter with every interaction'].map((item, idx) => (
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
            style={{ background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)`, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          />
        </div>
        
        <div 
          id="final-cta" 
          data-animate 
          className={`relative max-w-2xl mx-auto text-center transition-all duration-1000 ${isVisible['final-cta'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="flex justify-center mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_d84b7041-61f8-4f27-8460-1766fc06421c/artifacts/fm7j6atc_soulprint_logo.png"
              alt="SoulPrint"
              className="w-20 h-20 sm:w-24 sm:h-24"
            />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 leading-tight">
            Ready to Meet an AI<br />
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 bg-clip-text text-transparent">That Knows You?</span>
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

          <p className="mt-6 text-sm text-gray-600">Free forever plan available &middot; No credit card needed</p>
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
