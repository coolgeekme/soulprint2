'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Brain, MessageCircle, Fingerprint, Sparkles, Shield, Mic, ChevronDown, Star, Zap, Heart, VolumeX, Volume2, SkipBack, SkipForward, Pause, Play, Youtube, X, ChevronLeft, ChevronRight } from 'lucide-react';

// Brand colors
const ORANGE = '#E85D04';
const ORANGE_LIGHT = '#F48C06';
const ORANGE_DARK = '#DC2F02';

const YT_PLAYLIST_ID = 'PLC-ghIgOfdtCo63EqzQZ-fXkESrnEXkR1';

// ── YouTube Background Component ───────────────────────────────────────────
function YouTubeHeroBackground({ isMuted, onPlayerReady }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const apiLoadedRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (apiLoadedRef.current) return;
    apiLoadedRef.current = true;

    const initPlayer = () => {
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
      initPlayer();
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
        initPlayer();
      };
    }

    return () => {
      try { playerRef.current?.destroy(); } catch {}
    };
  }, [onPlayerReady]);

  // Mute/unmute sync
  useEffect(() => {
    try {
      if (playerRef.current?.isMuted && playerRef.current?.getPlayerState) {
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
          playerRef.current.setVolume(30);
        }
      }
    } catch {}
  }, [isMuted]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* YouTube iframe — scaled to cover viewport */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          width: 'max(177.78vh, 100vw)',
          height: 'max(56.25vw, 100vh)',
          transform: 'translate(-50%, -50%)',
          filter: 'brightness(0.45) saturate(0.5) contrast(1.1)',
          opacity: videoReady ? 1 : 0,
          transition: 'opacity 1.5s ease-in-out',
        }}
      >
        <div id="yt-social-player" style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Dark gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-black/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
      
      {/* Film-grain texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />
    </div>
  );
}

// ── Video Popup Modal ──────────────────────────────────────────────────────
function VideoPopupModal({ videoId, heroPlayerRef, onClose }) {
  const popupPlayerRef = useRef(null);
  const [popupPlaying, setPopupPlaying] = useState(true);
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
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
          controls: 1,
          fs: 1,
        },
        events: {
          onReady: (e) => {
            try {
              const data = e.target.getVideoData();
              if (data?.title) setPopupTitle(data.title);
            } catch {}
          },
          onStateChange: (e) => {
            setPopupPlaying(e.data === window.YT.PlayerState.PLAYING);
            if (e.data === window.YT.PlayerState.PLAYING) {
              try {
                const data = e.target.getVideoData();
                if (data?.title) setPopupTitle(data.title);
              } catch {}
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPopup();
    } else {
      const check = setInterval(() => {
        if (window.YT?.Player) { clearInterval(check); initPopup(); }
      }, 200);
      return () => clearInterval(check);
    }

    return () => { try { popupPlayerRef.current?.destroy(); } catch {} };
  }, [currentVideoId]);

  const popupNext = useCallback(() => {
    try {
      if (!heroPlayerRef?.current) return;
      heroPlayerRef.current.nextVideo();
      setTimeout(() => {
        try {
          const url = heroPlayerRef.current.getVideoUrl();
          const match = url?.match(/[?&]v=([^&]+)/);
          if (match?.[1] && match[1] !== currentVideoId) {
            setCurrentVideoId(match[1]);
          }
        } catch {}
      }, 600);
    } catch {}
  }, [heroPlayerRef, currentVideoId]);

  const popupPrev = useCallback(() => {
    try {
      if (!heroPlayerRef?.current) return;
      heroPlayerRef.current.previousVideo();
      setTimeout(() => {
        try {
          const url = heroPlayerRef.current.getVideoUrl();
          const match = url?.match(/[?&]v=([^&]+)/);
          if (match?.[1] && match[1] !== currentVideoId) {
            setCurrentVideoId(match[1]);
          }
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
              <button onClick={popupPrev} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={popupNext} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
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
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const userUnmutedRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-mute when hero scrolls out of view
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && userUnmutedRef.current) {
          try { ytPlayerRef.current?.mute(); } catch {}
          setIsMuted(true);
          userUnmutedRef.current = false;
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  const handlePlayerReady = useCallback((player) => {
    ytPlayerRef.current = player;
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      userUnmutedRef.current = !next;
      try {
        if (ytPlayerRef.current) {
          if (next) {
            ytPlayerRef.current.mute();
          } else {
            ytPlayerRef.current.unMute();
            ytPlayerRef.current.setVolume(30);
          }
        }
      } catch {}
      return next;
    });
  }, []);

  const togglePlayPause = useCallback(() => {
    try {
      if (!ytPlayerRef.current) return;
      const state = ytPlayerRef.current.getPlayerState();
      if (state === 1) {
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch {}
  }, []);

  const skipNext = useCallback(() => {
    try { ytPlayerRef.current?.nextVideo(); setIsPlaying(true); } catch {}
  }, []);

  const skipPrev = useCallback(() => {
    try { ytPlayerRef.current?.previousVideo(); setIsPlaying(true); } catch {}
  }, []);

  const openVideoPopup = useCallback(() => {
    try {
      if (!ytPlayerRef.current) return;
      const url = ytPlayerRef.current.getVideoUrl();
      const match = url?.match(/[?&]v=([^&]+)/);
      if (match?.[1]) {
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
        setPopupVideoId(match[1]);
      }
    } catch {}
  }, []);

  const closeVideoPopup = useCallback(() => {
    setPopupVideoId(null);
    try {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch {}
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
      {/* ========== HERO SECTION with YouTube Playlist Background ========== */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6">
        {/* YouTube Video Background */}
        <YouTubeHeroBackground isMuted={isMuted} onPlayerReady={handlePlayerReady} />

        {/* Fallback animated background (visible until video loads) */}
        <div className="absolute inset-0 overflow-hidden">
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
              style={{ filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.5))' }}
            />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-black/30 backdrop-blur-sm mb-8">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-300/90 font-medium tracking-wide">AI That Actually Knows You</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-[1.05] mb-6 tracking-tight" style={{ textShadow: '0 2px 30px rgba(0,0,0,0.5)' }}>
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
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
            SoulPrint doesn&apos;t just answer questions — it <span className="text-white font-medium">learns your style</span>, 
            <span className="text-white font-medium"> remembers your world</span>, and becomes 
            <span className="text-white font-medium"> uniquely yours</span> over time.
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
              className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl font-medium text-gray-300 hover:text-white border border-white/15 hover:border-white/30 transition-all hover:bg-white/5 backdrop-blur-sm"
            >
              See How It Works
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Trust line */}
          <p className="text-sm text-gray-400" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            Free to start &middot; No credit card required &middot; Takes 2 minutes
          </p>
        </div>

        {/* Player controls — bottom right */}
        <div className="absolute bottom-6 right-6 z-30 flex items-center gap-2">
          <button
            onClick={openVideoPopup}
            className="h-9 px-3.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/20 transition-all text-xs font-medium"
            aria-label="Watch this video"
          >
            <Youtube className="w-3.5 h-3.5" /> Watch
          </button>

          <div className="w-px h-5 bg-white/20" />

          <button onClick={skipPrev} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all" aria-label="Previous video">
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button onClick={togglePlayPause} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all" aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>
          <button onClick={skipNext} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all" aria-label="Next video">
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-5 bg-white/20" />

          <button onClick={toggleMute} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all" aria-label={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-40 z-20">
          <ChevronDown className="w-5 h-5 text-orange-400" />
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
