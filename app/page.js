// LANDING PAGE - Route: /
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Twitter, Linkedin, Instagram, Calendar, User, ArrowRight, Facebook, Youtube } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { ChatIcon, LightbulbIcon, RobotIcon, LockIcon, PersonHeartIcon, NetworkIntelligenceIcon } from '@/components/icons/SoulPrintIcons';

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

  // Don't show section if no posts
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
                {/* Image */}
                {post.featured_image ? (
                  <div className="aspect-video bg-gray-200 overflow-hidden">
                    <img 
                      src={post.featured_image} 
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-orange-100 to-pink-100 flex items-center justify-center">
                    <SoulPrintLogo size={40} />
                  </div>
                )}
                
                {/* Content */}
                <div className="p-6">
                  {post.category && (
                    <span className="text-xs text-orange-500 font-bold uppercase tracking-wider">
                      {post.category}
                    </span>
                  )}
                  <h3 className="font-condensed font-bold text-gray-900 text-lg mt-2 mb-3 group-hover:text-orange-600 transition-colors line-clamp-2 uppercase">
                    {post.title}
                  </h3>
                  <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {post.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(post.published_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link 
            href="/blog" 
            className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-medium text-sm transition-colors"
          >
            View all posts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

const HERO_IMAGE = "https://images.unsplash.com/photo-1453396450673-3fe83d2db2c4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwzfHxkYXJrJTIwcG9ydHJhaXR8ZW58MHx8fGJsYWNrX2FuZF93aGl0ZXwxNzcxOTcxNzQ3fDA&ixlib=rb-4.1.0&q=85";
const FEATURE_IMAGES = [
  "https://images.unsplash.com/photo-1610715945878-f567a10e6bb4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwzfHxzbWFydHBob25lJTIwbWVzc2FnaW5nfGVufDB8fHxibGFja19hbmRfd2hpdGV8MTc3MjU0NTM2NHww&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1604525241109-c3b7eecf4add?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwzfHx3b3JraW5nJTIwbGFwdG9wfGVufDB8fHxibGFja19hbmRfd2hpdGV8MTc3MjU0NTM3MHww&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1615821430614-3d7d2685e2f2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTF8MHwxfHNlYXJjaHwzfHx2b2ljZSUyMHNwZWFraW5nfGVufDB8fHxibGFja19hbmRfd2hpdGV8MTc3MjU0NTM3NHww&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1503792243040-7ce7f5f06085?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHw0fHxsb2NrJTIwc2VjdXJpdHl8ZW58MHx8fGJsYWNrX2FuZF93aGl0ZXwxNzcyNTQ1MzgyfDA&ixlib=rb-4.1.0&q=85",
];

const FEATURES = [
  { tag: 'CHANNELS', title: 'Lives in Telegram & SMS (coming soon)', desc: 'No new apps to install. Just message your SoulPrint in Telegram or text via SMS — the same tools you already use every day.', img: FEATURE_IMAGES[0], Icon: ChatIcon },
  { tag: 'ACTIONS', title: 'It can actually do things', desc: 'Browse the web, generate images, look things up — not just chat. It takes action for you. Calendar and email integration coming soon.', img: FEATURE_IMAGES[1], Icon: LightbulbIcon },
  { tag: 'VOICE', title: 'Talks and listens', desc: 'Send voice messages or talk hands-free. Your SoulPrint can listen and understand photos you send. Voice replies coming soon.', img: FEATURE_IMAGES[2], Icon: RobotIcon },
  { tag: 'PRIVACY', title: 'Your data stays yours', desc: 'Your conversations are private and encrypted. We never use your data to train AI models. What you say stays between you and your SoulPrint.', img: FEATURE_IMAGES[3], Icon: LockIcon },
];

const FAQS = [
  { q: 'What is a SoulPrint?', a: 'A SoulPrint is your persistent AI identity layer. Not a chatbot. Not a prompt wrapper. Not a memory plugin. It\'s a mapped, structured imprint of how you think, decide, react, prioritize, trust, and communicate — embedded into an AI system so the interaction reflects you, not generic model behavior. Most AI resets every session. A SoulPrint doesn\'t. It builds continuity, reference, and resonance across conversations so the system responds with your logic, your tone, your structure — consistently. In short: A SoulPrint is the operating system of you — running on AI.' },
  { q: 'What can it actually do?', a: 'SoulPrint can research topics, draft messages, answer questions, help with creative projects, and take real actions on your behalf — all through a simple chat interface. Calendar and email integration coming soon.' },
  { q: 'How is this different from ChatGPT?', a: 'ChatGPT is a general AI that forgets you after every conversation. SoulPrint captures your decision style, conflict response, boundary thresholds, communication cadence, emotional weighting, and pattern recognition over time — so it gets smarter about you, not just about general knowledge.' },
  { q: 'Does it work with voice?', a: 'Yes. You can send voice messages and SoulPrint will understand and respond. Voice replies are coming soon.' },
  { q: 'Is my data private?', a: 'Absolutely. Your conversations are encrypted and never used to train AI models. Your data belongs to you, and you can delete it at any time.' },
  { q: 'How do I get started?', a: 'Click "Get your SoulPrint" above, complete a short onboarding and our 36-question assessment, and your personal AI will be ready. The whole process takes about 10 minutes.' },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item py-4 cursor-pointer" onClick={() => setOpen(!open)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300 font-medium">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <p className="mt-3 text-sm text-gray-500 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (token) {
      // Verify token is still valid
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          if (r.ok) setIsLoggedIn(true);
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-sp-black">
      {/* Back to Chat Banner - shown when logged in */}
      {isLoggedIn && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-sp-orange to-orange-600 py-2.5 px-4 safe-area-top">
          <div className="max-w-7xl mx-auto flex items-center justify-between pt-[env(safe-area-inset-top)]">
            <div className="flex items-center gap-3">
              <SoulPrintLogo size={20} className="opacity-80" />
              <span className="text-white text-sm font-medium">Welcome back!</span>
            </div>
            <Link 
              href="/chat" 
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Back to Chat
            </Link>
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <section className={`relative overflow-hidden ${isLoggedIn ? 'pt-12' : ''}`} style={{ minHeight: '100vh' }}>
        {/* Grid background */}
        <div className="absolute inset-0 grid-bg opacity-100" />
        {/* Orange glow from center top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(246,64,0,0.15)_0%,transparent_70%)]" />
        
        {/* Large muted SoulPrint logo in background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="absolute right-[-5%] top-1/2 -translate-y-1/2 opacity-[0.06]">
            <SoulPrintLogo size={900} />
          </div>
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <SoulPrintLogo size={28} />
            <span className="font-condensed text-lg font-bold tracking-widest text-white uppercase">SoulPrint</span>
          </div>
          <div className="flex items-center gap-6">
            {isLoggedIn ? (
              <Link href="/chat" className="btn-orange px-5 py-2 rounded-lg text-sm flex items-center gap-2">
                Open Chat <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link href="/auth" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
                <Link href="/auth" className="btn-orange px-5 py-2 rounded-lg text-sm">Get Started</Link>
              </>
            )}
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-8 flex items-center min-h-[calc(100vh-80px)]">
          <div className="flex items-center gap-0 w-full">
            {/* Left: text */}
            <div className="flex-1 pr-8">
              <h1 className="font-condensed font-black text-white leading-none mb-6"
                  style={{ fontSize: 'clamp(52px, 8vw, 110px)', letterSpacing: '-1px' }}>
                STOP RE-<br />EXPLAINING<br />YOURSELF<br />TO AI
              </h1>
              <p className="text-gray-400 text-base mb-8 max-w-sm leading-relaxed">
                Chat, organize, reflect, and plan with an AI that remembers your tone, your tempo, and your life.
              </p>
              <div className="flex items-center gap-4">
                {isLoggedIn ? (
                  <Link href="/chat" className="btn-orange px-7 py-3 rounded-xl text-sm inline-flex items-center gap-2">
                    Go to Chat <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link href="/auth" className="btn-orange px-7 py-3 rounded-xl text-sm inline-flex items-center gap-2">
                    Get your SoulPrint
                  </Link>
                )}
                <Link href="#features" className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
                  Explore <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: portrait */}
            <div className="flex-shrink-0 w-[380px] h-[520px] relative overflow-hidden rounded-2xl">
              <img src={HERO_IMAGE} alt="SoulPrint" className="w-full h-full object-cover grayscale contrast-110" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#0a0a0a] opacity-50" />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="bg-white py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-condensed font-black text-black text-center mb-4 leading-tight"
              style={{ fontSize: 'clamp(32px, 5vw, 64px)', letterSpacing: '-0.5px' }}>
            YOUR AI BEST FRIEND, RIGHT IN YOUR CHAT.
          </h2>
          <p className="text-gray-600 text-center mb-16 text-sm max-w-lg mx-auto">
            SoulPrint lives in your Telegram (SMS coming soon) — no new apps to download. Just message it like you'd message a friend.
          </p>

          <div className="grid md:grid-cols-4 grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex flex-col bg-gray-50 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-4">
                  <f.Icon className="w-6 h-6" color="#F64000" />
                </div>
                <span className="text-xs font-bold text-orange-500 tracking-widest uppercase mb-2">{f.tag}</span>
                <h4 className="text-sm font-bold text-black mb-2">{f.title}</h4>
                <p className="text-xs text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT IS A SOULPRINT SECTION */}
      <section className="bg-sp-black grid-bg py-24 px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              THE PHILOSOPHY
            </p>
            <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase tracking-wide mb-6">
              What Is A SoulPrint?
            </h2>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12">
            <p className="text-xl md:text-2xl text-white font-light leading-relaxed mb-8">
              A SoulPrint is your <span className="text-orange-400 font-medium">persistent AI identity layer</span>.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-gray-500 line-through text-sm">Not a chatbot</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-gray-500 line-through text-sm">Not a prompt wrapper</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-gray-500 line-through text-sm">Not a memory plugin</p>
              </div>
            </div>
            
            <p className="text-gray-300 leading-relaxed mb-8">
              It's a mapped, structured imprint of how you <span className="text-white">think</span>, <span className="text-white">decide</span>, <span className="text-white">react</span>, <span className="text-white">prioritize</span>, <span className="text-white">trust</span>, and <span className="text-white">communicate</span> — embedded into an AI system so the interaction reflects <em>you</em>, not generic model behavior.
            </p>
            
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6 mb-8">
              <p className="text-orange-300 font-medium mb-3">It captures:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['Decision style', 'Conflict response', 'Boundary thresholds', 'Communication cadence', 'Emotional weighting', 'Pattern recognition'].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                    <span className="text-gray-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-start gap-4 mb-8">
              <div className="flex-1 bg-white/5 rounded-xl p-4">
                <p className="text-gray-500 text-sm mb-1">Most AI</p>
                <p className="text-gray-400">Resets every session</p>
              </div>
              <div className="text-gray-600 text-2xl pt-4">→</div>
              <div className="flex-1 bg-orange-500/10 rounded-xl p-4 border border-orange-500/20">
                <p className="text-orange-400 text-sm mb-1">Your SoulPrint</p>
                <p className="text-white">Builds continuity forever</p>
              </div>
            </div>
            
            <p className="text-gray-300 leading-relaxed mb-8">
              It builds <span className="text-white">continuity</span>, <span className="text-white">reference</span>, and <span className="text-white">resonance</span> across conversations so the system responds with <em>your</em> logic, <em>your</em> tone, <em>your</em> structure — consistently.
            </p>
            
            <div className="text-center pt-4 border-t border-white/10">
              <p className="text-xl md:text-2xl text-white font-light">
                <span className="text-orange-400">In short:</span> A SoulPrint is the <span className="font-bold">operating system of you</span> — running on AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ARE YOU BUILT FOR THIS SECTION */}
      <section className="bg-sp-black grid-bg pt-24 pb-8 px-8">
        <div className="max-w-2xl mx-auto text-center mb-8">
          <h2 className="font-condensed font-black text-white text-3xl md:text-4xl uppercase tracking-wide">
            Are You Built For This?
          </h2>
          <p className="text-gray-500 text-sm mt-3">
            Common questions about SoulPrint
          </p>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="bg-sp-black grid-bg pb-24 px-8">
        <div className="max-w-2xl mx-auto">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="bg-sp-black py-16 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl p-12 flex items-center justify-between gap-8"
               style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex-1">
              <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
                GET STARTED
              </p>
              <h3 className="font-condensed font-black text-white text-2xl md:text-4xl leading-tight mb-4 uppercase">
                TAKE THE SOULPRINT ASSESSMENT
              </h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md">
                Answer a few quick questions and your AI adapts to you instantly.
              </p>
              <Link href="/auth" className="btn-orange px-6 py-2.5 rounded-lg text-sm inline-flex items-center gap-2">
                Start Assessment →
              </Link>
              <div className="mt-3">
                <Link href="/auth" className="text-orange-500 text-xs hover:text-orange-400 transition-colors">
                  Already have an access code?
                </Link>
              </div>
            </div>
            <div className="flex-shrink-0">
              <SoulPrintLogo size={140} className="opacity-80" />
            </div>
          </div>
        </div>
      </section>

      {/* BLOG SECTION */}
      <BlogPreview />

      {/* FOOTER */}
      <footer className="bg-[#f0f0f0] py-12 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-4">
              <SoulPrintLogo size={20} />
              <span className="font-condensed font-bold text-gray-800 tracking-widest text-xs uppercase">SoulPrint</span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <a href="https://facebook.com/archeforgehq" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="Facebook">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="https://instagram.com/archeforgehq" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="Instagram">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="https://x.com/archeforgehq" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="X (Twitter)">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="https://bsky.app/profile/archeforgehq.bsky.social" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="BlueSky">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"/>
                </svg>
              </a>
              <a href="https://www.youtube.com/@ArcheForgeHQ" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="YouTube">
                <Youtube className="w-4 h-4" />
              </a>
              <a href="https://www.linkedin.com/company/arche-forge/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition-colors" title="LinkedIn">
                <Linkedin className="w-4 h-4" />
              </a>
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
              <Link href="/privacy" className="text-gray-500 text-xs hover:text-gray-800 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-gray-500 text-xs hover:text-gray-800 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
