// LANDING PAGE - Route: /
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Twitter, Linkedin, Instagram, Calendar, User, ArrowRight, Facebook, Youtube, Brain, Zap, Fingerprint, Heart, Sparkles, Shield, Check, Star, Quote, MessageSquare, Volume2, VolumeX, Play, Pause, SkipBack, SkipForward, X, ExternalLink } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

// Blog Preview Component
function BlogPreview() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog/posts?limit=3')
      .then(r => r.json())
      .then(data => {
        setPosts(data.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!loading && posts.length === 0) return null;

  return (
    <section className="bg-white py-20 px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-2">
              LATEST NEWS
            </p>
            <h2 className="font-condensed font-black text-gray-900 text-3xl md:text-4xl uppercase">
              From the Blog
            </h2>
          </div>
          <Link 
            href="/blog" 
            className="hidden sm:inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-medium text-sm transition-colors"
          >
            View all posts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-100 rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {posts.map(post => (
              <Link 
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 hover:border-orange-500/50 hover:shadow-lg transition-all duration-300"
              >
                {post.featured_image ? (
                  <div className="aspect-video bg-gray-200 overflow-hidden">
                    <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-orange-100 to-pink-100 flex items-center justify-center">
                    <SoulPrintLogo size={40} />
                  </div>
                )}
                <div className="p-6">
                  {post.category && <span className="text-xs text-orange-500 font-bold uppercase tracking-wider">{post.category}</span>}
                  <h3 className="font-condensed font-bold text-gray-900 text-lg mt-2 mb-3 group-hover:text-orange-600 transition-colors line-clamp-2 uppercase">{post.title}</h3>
                  <p className="text-gray-600 text-sm line-clamp-2 mb-4">{post.excerpt}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(post.published_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link href="/blog" className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-medium text-sm transition-colors">
            View all posts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

const HERO_IMAGE = "/hero-headshot-nobg.png";
const YT_PLAYLIST_ID = 'PLC-ghIgOfdtCo63EqzQZ-fXkESrnEXkR1';
const YT_CHANNEL_URL = 'https://www.youtube.com/@ArcheForgeHQ';

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
      if (!window.YT?.Player || document.getElementById('yt-hero-player')?.tagName === 'IFRAME') return;
      playerRef.current = new window.YT.Player('yt-hero-player', {
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
            // Get the full playlist, pick a random starting video
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
      // API already loaded (e.g. from cache or preconnect)
      initPlayer();
    } else {
      // Inject the script dynamically and register the callback
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
      {/* YouTube iframe — scaled to cover viewport, visually subdued */}
      <div
        className="absolute pointer-events-none"
        style={{
          /* Use min(vw,vh) approach so both landscape & portrait videos fill the section */
          top: '50%',
          left: '50%',
          width: 'max(177.78vh, 100vw)',   /* 16:9 width = 177.78% of height */
          height: 'max(56.25vw, 100vh)',    /* 16:9 height = 56.25% of width */
          transform: 'translate(-50%, -50%)',
          filter: 'brightness(0.5) saturate(0.5) contrast(1.1)',
          opacity: videoReady ? 1 : 0,
          transition: 'opacity 1.5s ease-in-out',
        }}
      >
        <div id="yt-hero-player" style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Dark gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-black/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-black/40" />
      
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

  // Initialize popup player — loads the EXACT video by ID (not the playlist)
  useEffect(() => {
    if (!currentVideoId) return;
    const initPopup = () => {
      if (!window.YT?.Player) return;
      // Destroy previous instance if re-creating for a new video
      try { popupPlayerRef.current?.destroy(); } catch {}

      popupPlayerRef.current = new window.YT.Player('yt-popup-player', {
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

  const popupTogglePlay = useCallback(() => {
    try {
      if (!popupPlayerRef.current) return;
      const state = popupPlayerRef.current.getPlayerState();
      if (state === 1) popupPlayerRef.current.pauseVideo();
      else popupPlayerRef.current.playVideo();
    } catch {}
  }, []);

  // Navigate hero playlist and load that video into the popup
  const popupNext = useCallback(() => {
    try {
      if (!heroPlayerRef?.current) return;
      heroPlayerRef.current.nextVideo();
      // Small delay for the hero player to advance, then grab the new video ID
      setTimeout(() => {
        try {
          const url = heroPlayerRef.current.getVideoUrl();
          const match = url?.match(/[?&]v=([^&]+)/);
          if (match?.[1] && match[1] !== currentVideoId) {
            setCurrentVideoId(match[1]);
          }
        } catch {}
      }, 500);
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
      }, 500);
    } catch {}
  }, [heroPlayerRef, currentVideoId]);

  if (!videoId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Modal content */}
      <div className="relative z-10 w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm"
        >
          Close <X className="w-5 h-5" />
        </button>

        {/* YouTube player — proper aspect ratio container */}
        <div className="relative w-full rounded-xl overflow-hidden shadow-2xl bg-black" style={{ aspectRatio: '16/9' }}>
          <div id="yt-popup-player" className="absolute inset-0 w-full h-full" />
        </div>

        {/* Controls bar */}
        <div className="mt-3 flex items-center justify-between">
          {/* Left: channel + title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-red-600 flex-shrink-0 flex items-center justify-center">
              <Youtube className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{popupTitle || 'SoulPrint Engine'}</p>
              <p className="text-gray-400 text-xs">Watch more on YouTube</p>
            </div>
          </div>

          {/* Center: transport controls */}
          <div className="flex items-center gap-1.5 mx-4">
            <button onClick={popupPrev} className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all" aria-label="Previous video">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={popupTogglePlay} className="w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white hover:bg-white/25 transition-all" aria-label={popupPlaying ? 'Pause' : 'Play'}>
              {popupPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 ml-0.5" />}
            </button>
            <button onClick={popupNext} className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all" aria-label="Next video">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Right: visit channel */}
          <a
            href={YT_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Visit Channel <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

const FIVE_FEATURES = [
  {
    icon: Brain,
    title: 'Persistent Memory',
    desc: 'Remembers context across every interaction. No more repeating yourself — it knows your history, preferences, and ongoing projects.',
    color: 'from-orange-500/20 to-orange-600/5',
    border: 'border-orange-500/30',
    iconColor: 'text-orange-400',
  },
  {
    icon: Zap,
    title: 'Dynamic Intelligence',
    desc: 'Automatically selects the best AI model for each task. Whether it\'s creative writing, research, or analysis — it picks the right brain.',
    color: 'from-yellow-500/20 to-yellow-600/5',
    border: 'border-yellow-500/30',
    iconColor: 'text-yellow-400',
  },
  {
    icon: Fingerprint,
    title: 'Identity Alignment',
    desc: 'Not just personalization — it captures how you think and make decisions. Your decision style, communication cadence, and conflict response.',
    color: 'from-purple-500/20 to-purple-600/5',
    border: 'border-purple-500/30',
    iconColor: 'text-purple-400',
  },
  {
    icon: Heart,
    title: 'Relationship Layer',
    desc: 'Builds familiarity over time, like a real partner. The more you interact, the more it understands your nuances and patterns.',
    color: 'from-pink-500/20 to-pink-600/5',
    border: 'border-pink-500/30',
    iconColor: 'text-pink-400',
  },
  {
    icon: Sparkles,
    title: 'Taste Integration',
    desc: 'Matches your standard of "what good looks like." From writing style to creative output — it learns your taste and delivers accordingly.',
    color: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
];

const TESTIMONIALS = [
  {
    quote: "Let me start with the headline: it's better than ChatGPT. There, I said it. I came skeptical — another AI tool promising to be my creative co-pilot — but SoulPrint surprised me in ways I didn't expect.",
    author: 'Early Adopter',
    role: 'Creator',
  },
  {
    quote: "I have been using SoulPrint Engine for my health and well being. So far it has been spot on. I'll begin to use it for my business consulting to see how it answers my day to day questions.",
    author: 'Rob',
    role: 'Consultant',
  },
  {
    quote: "SoulPrint Engine is F@$%-ing Awesome!",
    author: 'Early Adopter',
    role: 'Power User',
  },
];

const FAQS = [
  { q: 'What is a SoulPrint?', a: 'A SoulPrint is your persistent AI identity layer — a structured imprint of how you think, decide, react, prioritize, trust, and communicate. It\'s embedded into an AI system so every interaction reflects you, not generic model behavior. Most AI resets every session. Your SoulPrint builds continuity forever.' },
  { q: 'What can it actually do?', a: 'Research topics, draft messages, generate images and videos, browse the web, answer deep questions, help with creative projects, manage your calendar and email — all through a simple chat. It takes action, not just responds.' },
  { q: 'How is this different from ChatGPT?', a: 'ChatGPT forgets you after every conversation. SoulPrint captures your decision style, conflict response, communication cadence, emotional weighting, and pattern recognition — so it gets smarter about you, not just about general knowledge.' },
  { q: 'Does it work with voice?', a: 'Yes. You can talk hands-free or send voice messages. Your SoulPrint listens, understands, and responds naturally.' },
  { q: 'Is my data private?', a: 'Absolutely. Your conversations are encrypted and never used to train AI models. Your data belongs to you, and you can delete it at any time.' },
  { q: 'How do I get started?', a: 'Click "Get Your SoulPrint" above, complete a short onboarding, and your personal AI adapts to you instantly. Takes about 5 minutes.' },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-4 cursor-pointer border-b border-white/10" onClick={() => setOpen(!open)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300 font-medium">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && <p className="mt-3 text-sm text-gray-500 leading-relaxed">{a}</p>}
    </div>
  );
}

// Inline CTA component
function InlineCTA({ text, subtext }) {
  return (
    <div className="text-center py-8">
      <Link href="/auth" className="btn-orange px-8 py-3.5 rounded-xl text-sm inline-flex items-center gap-2">
        {text || 'Get Your SoulPrint'} <ArrowRight className="w-4 h-4" />
      </Link>
      {subtext && <p className="text-gray-500 text-xs mt-3">{subtext}</p>}
    </div>
  );
}

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [popupVideoId, setPopupVideoId] = useState(null);
  const ytPlayerRef = useRef(null);
  const heroRef = useRef(null);
  const userUnmutedRef = useRef(false); // tracks if user explicitly unmuted

  // Auto-mute when hero scrolls out of view — stays muted until user manually unmutes again
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && userUnmutedRef.current) {
          // Hero left viewport — auto-mute and clear the user's unmuted intent
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
      userUnmutedRef.current = !next; // track: user explicitly unmuted
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
      if (state === 1) { // PLAYING
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch {}
  }, []);

  const skipNext = useCallback(() => {
    try {
      if (!ytPlayerRef.current) return;
      ytPlayerRef.current.nextVideo();
      setIsPlaying(true);
    } catch {}
  }, []);

  const skipPrev = useCallback(() => {
    try {
      if (!ytPlayerRef.current) return;
      ytPlayerRef.current.previousVideo();
      setIsPlaying(true);
    } catch {}
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

  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { if (r.ok) setIsLoggedIn(true); })
        .catch(() => {});
    }
  }, []);

  // Show sticky CTA bar after scrolling past hero
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyBar(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const ctaLink = isLoggedIn ? '/chat' : '/auth';
  const ctaText = isLoggedIn ? 'Open Chat' : 'Get Your SoulPrint';

  return (
    <div className="min-h-screen bg-sp-black">

      {/* ═══════════════════════════════════════════════════════════════════
          STICKY CTA BAR - appears on scroll
      ═══════════════════════════════════════════════════════════════════ */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${showStickyBar ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="bg-sp-black/95 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SoulPrintLogo size={22} />
              <span className="font-condensed text-sm font-bold tracking-widest text-white uppercase hidden sm:inline">SoulPrint</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs hidden md:inline">AI that actually knows you</span>
              <Link href={ctaLink} className="btn-orange px-5 py-2 rounded-lg text-xs">
                {ctaText} →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION — YouTube Playlist Background
      ═══════════════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative overflow-hidden" style={{ minHeight: '100vh' }}>
        {/* YouTube Video Background */}
        <YouTubeHeroBackground isMuted={isMuted} onPlayerReady={handlePlayerReady} />

        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <SoulPrintLogo size={28} />
            <span className="font-condensed text-lg font-bold tracking-widest text-white uppercase">SoulPrint</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-300 hover:text-white transition-colors hidden sm:inline">Features</a>
            <a href="#testimonials" className="text-sm text-gray-300 hover:text-white transition-colors hidden sm:inline">Reviews</a>
            {isLoggedIn ? (
              <Link href="/chat" className="btn-orange px-5 py-2 rounded-lg text-sm flex items-center gap-2">
                Open Chat <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link href="/auth" className="text-sm text-gray-300 hover:text-white transition-colors">Sign In</Link>
                <Link href="/auth" className="btn-orange px-5 py-2 rounded-lg text-sm">Get Started Free</Link>
              </>
            )}
          </div>
        </nav>

        {/* Hero content — centered over video */}
        <div className="relative z-20 max-w-7xl mx-auto px-8 flex items-center min-h-[calc(100vh-80px)]">
          <div className="max-w-2xl">
            <h1 className="font-condensed font-black text-white leading-none mb-6"
                style={{ fontSize: 'clamp(48px, 7.5vw, 100px)', letterSpacing: '-1px', textShadow: '0 2px 40px rgba(0,0,0,0.5)' }}>
              STOP RE-<br />EXPLAINING<br />YOURSELF<br />TO AI
            </h1>
            <p className="text-gray-200 text-base mb-4 max-w-md leading-relaxed" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
              Chat, organize, reflect, and plan with an AI that remembers your tone, your tempo, and your life.
            </p>
            {/* Trust indicators */}
            <div className="flex items-center gap-4 mb-8 flex-wrap">
              <span className="text-xs text-gray-300 flex items-center gap-1.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                <Shield className="w-3.5 h-3.5 text-green-400" /> Private & Encrypted
              </span>
              <span className="text-xs text-gray-300 flex items-center gap-1.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                <Zap className="w-3.5 h-3.5 text-yellow-400" /> GPT-4o, Gemini & Claude
              </span>
              <span className="text-xs text-gray-300 flex items-center gap-1.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                <Check className="w-3.5 h-3.5 text-orange-400" /> Free to Start
              </span>
            </div>
            <div className="flex items-center gap-4">
              {isLoggedIn ? (
                <Link href="/chat" className="btn-orange px-7 py-3.5 rounded-xl text-sm inline-flex items-center gap-2">
                  Go to Chat <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link href="/auth" className="btn-orange px-7 py-3.5 rounded-xl text-sm inline-flex items-center gap-2">
                  Get Your SoulPrint — It&apos;s Free
                </Link>
              )}
              <a href="#features" className="text-gray-300 hover:text-white text-sm flex items-center gap-1 transition-colors" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                See what it can do <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Player controls — bottom right */}
        <div className="absolute bottom-6 right-6 z-30 flex items-center gap-2">
          {/* Watch this video button */}
          <button
            onClick={openVideoPopup}
            className="h-9 px-3.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/20 transition-all text-xs font-medium"
            aria-label="Watch this video"
          >
            <Youtube className="w-3.5 h-3.5" /> Watch
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-white/20" />

          {/* Transport controls */}
          <button
            onClick={skipPrev}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
            aria-label="Previous video"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={togglePlayPause}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>
          <button
            onClick={skipNext}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
            aria-label="Next video"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-white/20" />

          {/* Mute */}
          <button
            onClick={toggleMute}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </section>

      {/* Video Popup Modal */}
      {popupVideoId && <VideoPopupModal videoId={popupVideoId} heroPlayerRef={ytPlayerRef} onClose={closeVideoPopup} />}

      {/* ═══════════════════════════════════════════════════════════════════
          SOCIAL PROOF BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-6 px-8 border-b border-gray-200">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-white flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              ))}
            </div>
            <div>
              <p className="text-gray-900 text-sm font-bold">20,000+</p>
              <p className="text-gray-500 text-[10px]">have discovered SoulPrint</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 text-orange-500 fill-orange-500" />)}
            <span className="text-gray-700 text-sm font-medium ml-1">Loved by early adopters</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-gray-700 text-sm font-medium">Your data stays yours</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          5 THINGS SOULPRINT CAN DO — from the ad
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="features" className="bg-sp-black grid-bg py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              WHAT MAKES IT DIFFERENT
            </p>
            <h2 className="font-condensed font-black text-white leading-tight mb-4"
                style={{ fontSize: 'clamp(28px, 4vw, 52px)' }}>
              5 THINGS SOULPRINT ENGINE CAN DO<br />
              <span className="text-orange-400">THAT OTHER AI CAN&apos;T</span>
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              This isn&apos;t another chatbot. SoulPrint Engine is a fundamentally different kind of AI — one that&apos;s built around you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FIVE_FEATURES.slice(0, 3).map((f, i) => (
              <div 
                key={i} 
                className={`rounded-2xl p-6 bg-gradient-to-br ${f.color} border ${f.border} hover:scale-[1.02] transition-transform duration-200`}
              >
                <div className={`w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4`}>
                  <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-[calc(66.666%+0.75rem)] md:mx-auto">
            {FIVE_FEATURES.slice(3, 5).map((f, i) => (
              <div 
                key={i + 3} 
                className={`rounded-2xl p-6 bg-gradient-to-br ${f.color} border ${f.border} hover:scale-[1.02] transition-transform duration-200`}
              >
                <div className={`w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4`}>
                  <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA after features */}
          <InlineCTA text={ctaText} subtext="Free to start. No credit card required." />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS — 3 steps
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-24 px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              GETTING STARTED
            </p>
            <h2 className="font-condensed font-black text-gray-900 text-3xl md:text-5xl uppercase">
              Your SoulPrint in 3 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '01', title: 'Sign Up', desc: 'Create your account in seconds. No credit card needed.', icon: User },
              { num: '02', title: 'Take the Assessment', desc: 'Answer a short set of questions so your AI understands how you think.', icon: Brain },
              { num: '03', title: 'Start Chatting', desc: 'Your AI adapts instantly. The more you use it, the smarter it gets about you.', icon: MessageSquare },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-7 h-7 text-orange-500" />
                </div>
                <span className="text-orange-500 font-condensed font-bold text-xs tracking-widest">{step.num}</span>
                <h3 className="font-condensed font-bold text-gray-900 text-xl uppercase mt-1 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA after steps */}
          <div className="text-center pt-10">
            <Link href={ctaLink} className="btn-orange px-8 py-3.5 rounded-xl text-sm inline-flex items-center gap-2">
              {ctaText} — Takes 5 Minutes <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          VS CHATGPT COMPARISON
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-sp-black grid-bg py-24 px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              THE DIFFERENCE
            </p>
            <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase tracking-wide">
              SoulPrint vs. Generic AI
            </h2>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 bg-white/5 p-4">
              <div className="text-xs text-gray-500 uppercase font-bold tracking-wider"></div>
              <div className="text-center text-xs text-gray-500 uppercase font-bold tracking-wider">ChatGPT / Others</div>
              <div className="text-center text-xs text-orange-400 uppercase font-bold tracking-wider">SoulPrint</div>
            </div>
            {[
              { label: 'Memory', generic: 'Resets every session', sp: 'Remembers everything' },
              { label: 'Personality', generic: 'Generic responses', sp: 'Adapts to YOUR style' },
              { label: 'Intelligence', generic: 'Single model', sp: 'Auto-picks best AI for the task' },
              { label: 'Relationship', generic: 'Stranger every time', sp: 'Builds familiarity over time' },
              { label: 'Actions', generic: 'Just text chat', sp: 'Images, video, web, code & more' },
              { label: 'Voice', generic: 'Limited', sp: 'Full voice conversations' },
              { label: 'Privacy', generic: 'Trains on your data', sp: 'Your data stays yours' },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-3 p-4 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''} border-t border-white/5`}>
                <div className="text-sm text-white font-medium">{row.label}</div>
                <div className="text-center text-sm text-gray-500">{row.generic}</div>
                <div className="text-center text-sm text-orange-300 font-medium flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" /> {row.sp}
                </div>
              </div>
            ))}
          </div>

          {/* CTA after comparison */}
          <InlineCTA text={ctaText} subtext="See the difference for yourself." />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="testimonials" className="bg-white py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              REAL USERS, REAL WORDS
            </p>
            <h2 className="font-condensed font-black text-gray-900 text-3xl md:text-5xl uppercase">
              What People Are Saying
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={`rounded-2xl p-6 border ${i === 0 ? 'bg-gradient-to-br from-orange-50 to-white border-orange-200 md:col-span-2 lg:col-span-1' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-1 mb-4">
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 text-orange-500 fill-orange-500" />)}
                </div>
                <Quote className="w-8 h-8 text-orange-500/20 mb-2" />
                <p className="text-gray-800 text-sm leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{t.author[0]}</span>
                  </div>
                  <div>
                    <p className="text-gray-900 text-sm font-bold">{t.author}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA after testimonials */}
          <div className="text-center pt-10">
            <Link href={ctaLink} className="btn-orange px-8 py-3.5 rounded-xl text-sm inline-flex items-center gap-2">
              Join Them — {ctaText} <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-gray-400 text-xs mt-3">Free to start. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          ALSO DOES — Quick capability highlights
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-sp-black py-16 px-8 border-y border-white/10">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-gray-500 text-xs uppercase tracking-widest mb-8 font-condensed font-bold">It also does</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🎨', label: 'Generate Images & Video' },
              { icon: '🌐', label: 'Browse the Web in Real-Time' },
              { icon: '🎙️', label: 'Voice Conversations' },
              { icon: '📄', label: 'Read & Analyze Documents' },
              { icon: '📧', label: 'Email & Calendar (Coming Soon)' },
              { icon: '🔍', label: 'Deep Research' },
              { icon: '💻', label: 'Help With Code (GitHub)' },
              { icon: '🔒', label: 'Encrypted & Private' },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center hover:border-orange-500/30 transition-colors">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-gray-300 text-xs mt-2 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FAQ SECTION
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-sp-black grid-bg py-24 px-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              GOT QUESTIONS?
            </p>
            <h2 className="font-condensed font-black text-white text-3xl md:text-4xl uppercase tracking-wide">
              Frequently Asked
            </h2>
          </div>
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FINAL CTA SECTION — strong close
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-sp-black py-20 px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl p-10 md:p-16 relative overflow-hidden"
               style={{ background: 'linear-gradient(135deg, rgba(246,64,0,0.15), rgba(246,64,0,0.05))', border: '1px solid rgba(246,64,0,0.25)' }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(246,64,0,0.1)_0%,transparent_70%)]" />
            <div className="relative z-10">
              <SoulPrintLogo size={60} className="mx-auto mb-6 opacity-90" />
              <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase leading-tight mb-4">
                Ready to Meet<br />Your SoulPrint?
              </h2>
              <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">
                Join 20,000+ people who&apos;ve discovered what AI feels like when it actually knows you.
              </p>
              <Link href={ctaLink} className="btn-orange px-10 py-4 rounded-xl text-base inline-flex items-center gap-2">
                {ctaText} — It&apos;s Free <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-gray-600 text-xs mt-4">No credit card. No commitment. Just a better AI.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOG SECTION */}
      <BlogPreview />

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#f0f0f0] py-12 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-4">
              <SoulPrintLogo size={20} />
              <span className="font-condensed font-bold text-gray-800 tracking-widest text-xs uppercase">SoulPrint</span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <a href="https://facebook.com/archeforgehq" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="Facebook"><Facebook className="w-4 h-4" /></a>
              <a href="https://instagram.com/archeforgehq" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="Instagram"><Instagram className="w-4 h-4" /></a>
              <a href="https://x.com/archeforgehq" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="X (Twitter)"><Twitter className="w-4 h-4" /></a>
              <a href="https://bsky.app/profile/archeforgehq.bsky.social" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="BlueSky">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"/>
                </svg>
              </a>
              <a href="https://www.youtube.com/@ArcheForgeHQ" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="YouTube"><Youtube className="w-4 h-4" /></a>
              <a href="https://www.linkedin.com/company/arche-forge/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="LinkedIn"><Linkedin className="w-4 h-4" /></a>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/" className="text-gray-600 text-xs hover:text-gray-900 transition-colors">Home</Link>
              <Link href="/contact" className="text-gray-600 text-xs hover:text-gray-900 transition-colors">Contact Us</Link>
              <a href="#faqs" className="text-gray-600 text-xs hover:text-gray-900 transition-colors">FAQ</a>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-300 pt-6">
            <p className="text-gray-500 text-xs">Copyright 2026 © SoulPrint™ by ArcheForge LLC. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/security" className="text-gray-500 text-xs hover:text-gray-800 transition-colors">Security</Link>
              <Link href="/privacy" className="text-gray-500 text-xs hover:text-gray-800 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-gray-500 text-xs hover:text-gray-800 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
