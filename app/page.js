'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Twitter, Github, Linkedin, Youtube, Instagram } from 'lucide-react';

const HERO_IMAGE = "https://images.unsplash.com/photo-1453396450673-3fe83d2db2c4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwzfHxkYXJrJTIwcG9ydHJhaXR8ZW58MHx8fGJsYWNrX2FuZF93aGl0ZXwxNzcxOTcxNzQ3fDA&ixlib=rb-4.1.0&q=85";
const FEATURE_IMAGES = [
  "https://images.unsplash.com/photo-1618532507553-60610e5cf869?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwyfHxub3RlY2FyZCUyMHBhcGVyfGVufDB8fHxibGFja19hbmRfd2hpdGV8MTc3MTk3MTc1Mnww&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1506787497326-c2736dde1bef?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwxfHxwZW9wbGUlMjB3YWxraW5nfGVufDB8fHxibGFja19hbmRfd2hpdGV8MTc3MTk3MTc1N3ww&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1545732868-0d48f805c440?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBzcGVha2luZ3xlbnwwfHx8YmxhY2tfYW5kX3doaXRlfDE3NzE5NzE3NjF8MA&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1591280071859-a595098efa8a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxtaW5pbWFsJTIwc3BhY2V8ZW58MHx8fGJsYWNrX2FuZF93aGl0ZXwxNzcxOTcxNzY2fDA&ixlib=rb-4.1.0&q=85",
];

const FEATURES = [
  { tag: 'CHANNELS', title: 'Lives in Telegram & SMS', desc: 'No new apps to install. Just message your SoulPrint in Telegram or text via SMS — the same tools you already use every day.', img: FEATURE_IMAGES[0] },
  { tag: 'ACTIONS', title: 'It can actually do things', desc: 'Browse the web, generate images, manage your calendar, send emails, look things up — not just chat. It takes action for you.', img: FEATURE_IMAGES[1] },
  { tag: 'VOICE', title: 'Talks and listens', desc: 'Send voice messages or talk hands-free. Your SoulPrint can listen, understand photos you send, and even reply out loud on your phone.', img: FEATURE_IMAGES[2] },
  { tag: 'PRIVACY', title: 'Your data stays yours', desc: 'Your conversations are private and encrypted. We never use your data to train AI models. What you say stays between you and your SoulPrint.', img: FEATURE_IMAGES[3] },
];

const FAQS = [
  { q: 'What is SoulPrint?', a: 'SoulPrint is your personal AI companion that lives in your Telegram and SMS. It learns how you think, how you talk, and what matters to you — so every conversation feels like talking to someone who actually knows you.' },
  { q: 'What can it actually do?', a: 'SoulPrint can research topics, draft emails, manage your schedule, answer questions, help with creative projects, and take real actions on your behalf — all through a simple chat interface.' },
  { q: 'How is this different from ChatGPT?', a: 'ChatGPT is a general AI that forgets you after every conversation. SoulPrint builds a persistent profile of who you are, how you communicate, and what you need — so it gets smarter about you over time, not just about general knowledge.' },
  { q: 'Does it work with voice?', a: 'Yes. You can send voice messages and SoulPrint will understand and respond. On supported platforms, it can even reply back with audio.' },
  { q: 'Is my data private?', a: 'Absolutely. Your conversations are encrypted and never used to train AI models. Your data belongs to you, and you can delete it at any time.' },
  { q: 'How do I get started?', a: 'Click "Get your SoulPrint" above, complete a short onboarding and our 36-question assessment, and your personal AI will be ready. The whole process takes about 10 minutes.' },
];

function SoulPrintLogo({ size = 40, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" className={className}>
      <path d="M40 8 C55 8, 70 18, 70 35 C70 52, 55 62, 40 55 C25 48, 15 35, 22 22 C29 9, 42 12, 48 20 C54 28, 50 40, 42 44 C34 48, 28 42, 30 36 C32 30, 38 28, 42 32" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9"/>
      <path d="M40 14 C52 14, 64 22, 64 36 C64 50, 52 58, 40 52 C28 46, 20 34, 26 24 C32 14, 44 16, 49 23 C54 30, 51 40, 44 43 C37 46, 32 41, 34 36 C36 31, 40 30, 43 33" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M40 20 C49 20, 58 26, 58 37 C58 48, 49 54, 40 49 C31 44, 25 35, 30 27 C35 19, 45 21, 49 27 C53 33, 51 41, 45 43 C39 45, 35 41, 37 37 C39 33, 42 32, 44 34" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4"/>
    </svg>
  );
}

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
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden" style={{ minHeight: '100vh' }}>
        {/* Grid background */}
        <div className="absolute inset-0 grid-bg opacity-100" />
        {/* Orange glow from center top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)]" />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <SoulPrintLogo size={28} />
            <span className="font-condensed text-lg font-bold tracking-widest text-white uppercase">SoulPrint</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/auth" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
            <Link href="/auth" className="btn-orange px-5 py-2 rounded-lg text-sm">Get Started</Link>
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
                <Link href="/auth" className="btn-orange px-7 py-3 rounded-xl text-sm inline-flex items-center gap-2">
                  Get your SoulPrint
                </Link>
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
            SoulPrint lives in your Telegram and SMS — no new apps to download. Just message it like you'd message a friend.
          </p>

          <div className="grid grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex flex-col">
                <div className="h-48 rounded-lg overflow-hidden mb-3">
                  <img src={f.img} alt={f.tag} className="w-full h-full object-cover grayscale" />
                </div>
                <span className="text-xs font-bold text-orange-500 tracking-widest uppercase mb-1">{f.tag}</span>
                <h4 className="text-sm font-bold text-black mb-2">{f.title}</h4>
                <p className="text-xs text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="bg-[#0a0a0a] grid-bg py-24 px-8">
        <div className="max-w-2xl mx-auto">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="bg-[#0a0a0a] py-16 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl p-12 flex items-center justify-between gap-8"
               style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex-1">
              <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
                HELP SOULPRINT UNDERSTAND YOU FASTER
              </p>
              <h3 className="font-condensed font-black text-white text-2xl md:text-4xl leading-tight mb-6 uppercase">
                TAKE THE SOULPRINT ASSESSMENT TO PERSONALIZE YOUR AI FROM DAY ONE. ANSWER A FEW QUESTIONS ABOUT YOUR COMMUNICATION STYLE, PREFERENCES, AND GOALS — AND YOUR ASSISTANT ADAPTS TO YOU INSTANTLY.
              </h3>
              <Link href="/auth" className="btn-orange px-6 py-2.5 rounded-lg text-sm inline-flex items-center gap-2">
                Start SoulPrint Assessment →
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

      {/* FOOTER */}
      <footer className="bg-[#f0f0f0] py-12 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-4">
              <SoulPrintLogo size={20} />
              <span className="font-condensed font-bold text-gray-800 tracking-widest text-xs uppercase">SoulPrint</span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              {[Twitter, Github, Linkedin, Instagram, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="text-gray-500 hover:text-gray-800 transition-colors">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-gray-600 text-xs hover:text-gray-900 transition-colors">Home</a>
              <a href="#" className="text-gray-600 text-xs hover:text-gray-900 transition-colors">Contact Us</a>
              <a href="#" className="text-gray-600 text-xs hover:text-gray-900 transition-colors">FAQ</a>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-300 pt-6">
            <p className="text-gray-500 text-xs">Copyright 2025 © SoulPrint™. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-gray-500 text-xs hover:text-gray-800 transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-500 text-xs hover:text-gray-800 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
