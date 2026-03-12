// FEATURES PAGE - Route: /features
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, Check, Zap, Brain, Palette, Video, Mail, Calendar, 
  FileText, Search, Mic, Upload, Sparkles, Shield, Users, Clock,
  MessageSquare, Image, Film, Globe, ChevronRight, Star
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

// Model data
const LLM_MODELS = [
  { provider: 'OpenAI', models: ['GPT-5.2', 'GPT-5', 'o3', 'o3-mini', 'GPT-4.1', 'GPT-4o'], color: 'from-green-500 to-emerald-600', icon: '🤖' },
  { provider: 'Anthropic', models: ['Claude Opus 4.5', 'Claude Sonnet 4.5', 'Claude Haiku 3.5'], color: 'from-orange-500 to-amber-600', icon: '🧠' },
  { provider: 'Google', models: ['Gemini 2.5 Pro', 'Gemini 2.0 Flash'], color: 'from-blue-500 to-cyan-600', icon: '💎' },
  { provider: 'Perplexity', models: ['Sonar Pro', 'Sonar', 'Sonar Reasoning'], color: 'from-purple-500 to-violet-600', icon: '🔍' },
  { provider: 'Kimi', models: ['Kimi K2', 'Moonshot 32k', 'Moonshot 8k'], color: 'from-pink-500 to-rose-600', icon: '🌙' },
];

const IMAGE_MODELS = [
  { name: 'DALL-E 3', provider: 'OpenAI', desc: 'Photorealistic, artistic, highly detailed' },
  { name: 'Nano Banana', provider: 'Google', desc: 'Fast, creative, great for iterations' },
  { name: 'Seedream 5', provider: 'ByteDance', desc: 'Anime, illustration styles' },
  { name: 'Qwen Image', provider: 'Alibaba', desc: 'In-place editing, object removal' },
];

const VIDEO_MODELS = [
  { name: 'Kling 3.0', provider: 'Kuaishou', desc: 'Industry-leading quality, smooth motion' },
  { name: 'Sora 2', provider: 'OpenAI', desc: 'Coming soon', badge: 'Soon' },
  { name: 'Hailuo', provider: 'MiniMax', desc: 'Fast generation, social content' },
  { name: 'Wan', provider: 'Alibaba', desc: 'Anime and stylized video' },
];

const GOOGLE_FEATURES = [
  { icon: Mail, title: 'Gmail', desc: 'Send, read, and manage emails through chat' },
  { icon: Calendar, title: 'Calendar', desc: 'Create, update, delete events with timezone awareness' },
  { icon: FileText, title: 'Docs', desc: 'Create documents with AI-generated content' },
  { icon: Globe, title: 'Sheets', desc: 'Create spreadsheets with data and headers' },
];

const UNIQUE_FEATURES = [
  { 
    icon: Sparkles, 
    title: 'Conversational Image Editing', 
    desc: 'Type "remove the hat" or "change shirt to blue" and watch the AI edit your image in place.',
    tag: 'EXCLUSIVE'
  },
  { 
    icon: Brain, 
    title: 'Smart Model Routing', 
    desc: 'Let AI automatically pick the best model for each task — coding goes to GPT, creative writing to Claude.',
    tag: 'AI-POWERED'
  },
  { 
    icon: Upload, 
    title: 'ChatGPT History Import', 
    desc: 'Import your entire ChatGPT history (even 1GB+ files) and your AI learns from your conversations.',
    tag: 'UNIQUE'
  },
  { 
    icon: Users, 
    title: '36-Question Assessment', 
    desc: 'Build your SoulPrint profile so AI responses match your communication style and preferences.',
    tag: 'PERSONALIZED'
  },
];

const COMPARISON = [
  { feature: 'Multiple LLMs', soulprint: true, chatgpt: false, claude: false, gemini: false },
  { feature: 'Image Generation', soulprint: true, chatgpt: true, claude: false, gemini: true },
  { feature: 'In-Place Image Editing', soulprint: true, chatgpt: 'limited', claude: false, gemini: false },
  { feature: 'Video Generation', soulprint: true, chatgpt: false, claude: false, gemini: false },
  { feature: 'Full Google Suite', soulprint: true, chatgpt: false, claude: false, gemini: 'limited' },
  { feature: 'Personality Assessment', soulprint: true, chatgpt: false, claude: false, gemini: false },
  { feature: 'History Import', soulprint: true, chatgpt: 'n/a', claude: false, gemini: false },
  { feature: 'Multi-Account Google', soulprint: true, chatgpt: false, claude: false, gemini: false },
  { feature: 'Smart Model Router', soulprint: true, chatgpt: false, claude: false, gemini: false },
];

function FeatureCard({ icon: Icon, title, desc, tag }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-orange-500/50 hover:shadow-lg transition-all duration-300 group">
      {tag && (
        <span className="inline-block px-2 py-1 text-[10px] font-bold bg-orange-100 text-orange-600 rounded-full mb-3 uppercase tracking-wider">
          {tag}
        </span>
      )}
      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function ModelPill({ name, highlight }) {
  return (
    <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-medium ${
      highlight 
        ? 'bg-orange-100 text-orange-700 border border-orange-200' 
        : 'bg-gray-100 text-gray-700 border border-gray-200'
    }`}>
      {name}
    </span>
  );
}

function ComparisonCell({ value }) {
  if (value === true) {
    return <Check className="w-5 h-5 text-green-500 mx-auto" />;
  } else if (value === false) {
    return <span className="text-gray-300">—</span>;
  } else if (value === 'limited') {
    return <span className="text-xs text-yellow-600 font-medium">Limited</span>;
  } else {
    return <span className="text-xs text-gray-400">{value}</span>;
  }
}

export default function FeaturesPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { if (r.ok) setIsLoggedIn(true); })
        .catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-sp-black">
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <SoulPrintLogo size={28} />
          <span className="font-condensed text-lg font-bold tracking-widest text-white uppercase">SoulPrint</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Home</Link>
          <Link href="/features" className="text-sm text-white font-medium">Features</Link>
          {isLoggedIn ? (
            <Link href="/chat" className="btn-orange px-5 py-2 rounded-lg text-sm flex items-center gap-2">
              Open Chat <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link href="/auth" className="btn-orange px-5 py-2 rounded-lg text-sm">Get Started</Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-8 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(246,64,0,0.15)_0%,transparent_70%)]" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-sm font-medium mb-6">
            15+ AI Models • Image & Video Gen • Google Integration
          </span>
          <h1 className="font-condensed font-black text-white leading-none mb-6"
              style={{ fontSize: 'clamp(40px, 6vw, 72px)', letterSpacing: '-1px' }}>
            ONE PLATFORM.<br />EVERY AI MODEL.<br />
            <span className="text-orange-500">UNLIMITED CREATION.</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            Stop switching between ChatGPT, Claude, Midjourney, and a dozen other tools. 
            SoulPrint Engine brings them all together — personalized to you.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/auth" className="btn-orange px-8 py-3 rounded-xl text-sm inline-flex items-center gap-2">
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#comparison" className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
              See Comparison <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Multi-Model LLM Section */}
      <section className="bg-white py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3 block">
              LANGUAGE MODELS
            </span>
            <h2 className="font-condensed font-black text-gray-900 mb-4"
                style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>
              CHOOSE YOUR INTELLIGENCE
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Why limit yourself to one AI? Access the world's most powerful language models, 
              all in one conversation. Switch models mid-chat or let Smart Mode pick for you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {LLM_MODELS.map((provider, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{provider.icon}</span>
                  <h3 className="font-bold text-gray-900">{provider.provider}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {provider.models.map((model, j) => (
                    <ModelPill key={j} name={model} highlight={j === 0} />
                  ))}
                </div>
              </div>
            ))}
            
            {/* Smart Mode Card */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-bold">Smart Mode</h3>
              </div>
              <p className="text-white/80 text-sm mb-4">
                Can't decide? Let our AI Router automatically pick the best model for each message.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" /> Code → GPT-5.2
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" /> Creative → Claude
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" /> Math → Gemini
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Image Generation Section */}
      <section className="bg-gray-900 py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3 block">
                IMAGE CREATION
              </span>
              <h2 className="font-condensed font-black text-white mb-6"
                  style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>
                CREATE ANY IMAGE.<br />EDIT ANY IMAGE.
              </h2>
              <p className="text-gray-400 mb-8">
                Generate stunning images from text, or edit existing images with simple commands 
                like "remove the background" or "change the shirt to blue."
              </p>
              
              <div className="space-y-4">
                {IMAGE_MODELS.map((model, i) => (
                  <div key={i} className="flex items-center gap-4 bg-gray-800/50 rounded-xl p-4">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Image className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">{model.name}</h4>
                        <span className="text-xs text-gray-500">{model.provider}</span>
                      </div>
                      <p className="text-sm text-gray-400">{model.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-2xl p-8">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-400" />
                Unique Image Features
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Conversational Editing</h4>
                    <p className="text-sm text-gray-400">Type "remove the hat" and watch it disappear</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Paste & Drop</h4>
                    <p className="text-sm text-gray-400">Paste images directly from clipboard or drag & drop</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Image-to-Prompt</h4>
                    <p className="text-sm text-gray-400">Upload any image, get the prompt to recreate it</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Mockup Generator</h4>
                    <p className="text-sm text-gray-400">See your designs on t-shirts, mugs, books instantly</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Video Generation Section */}
      <section className="bg-white py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3 block">
              VIDEO GENERATION
            </span>
            <h2 className="font-condensed font-black text-gray-900 mb-4"
                style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>
              TEXT TO VIDEO IN SECONDS
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Describe what you want to see, and watch it come to life. 
              SoulPrint integrates with the most advanced video AI models.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VIDEO_MODELS.map((model, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-200 hover:border-orange-500/50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <Film className="w-8 h-8 text-orange-500" />
                  {model.badge && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-medium rounded-full">
                      {model.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{model.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{model.provider}</p>
                <p className="text-sm text-gray-600">{model.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-xl mb-2">Text to Video • Image to Video</h3>
              <p className="text-gray-400">Generate videos from descriptions or animate your images</p>
            </div>
            <Link href="/auth" className="btn-orange px-6 py-3 rounded-xl text-sm flex items-center gap-2 flex-shrink-0">
              Try It Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Google Integration Section */}
      <section className="bg-gray-50 py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3 block">
                GOOGLE INTEGRATION
              </span>
              <h2 className="font-condensed font-black text-gray-900 mb-6"
                  style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>
                YOUR WORKSPACE,<br />SUPERCHARGED
              </h2>
              <p className="text-gray-600 mb-8">
                Connect your Google accounts and let AI handle the busy work. 
                Send emails, schedule meetings, create documents — all through natural conversation.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {GOOGLE_FEATURES.map((feature, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                    <feature.icon className="w-6 h-6 text-orange-500 mb-2" />
                    <h4 className="font-semibold text-gray-900 mb-1">{feature.title}</h4>
                    <p className="text-xs text-gray-500">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
              <h3 className="font-bold text-gray-900 mb-6">Example Commands</h3>
              <div className="space-y-4">
                {[
                  '"Send an email to John about the meeting tomorrow"',
                  '"Schedule a call with Sarah for 3pm Friday"',
                  '"Create a document with meeting notes from today"',
                  '"Make a spreadsheet tracking my expenses"',
                ].map((cmd, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-600 text-sm italic">{cmd}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  Multi-account support — connect multiple Google accounts
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Unique Features Section */}
      <section className="bg-sp-black py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3 block">
              WHAT MAKES US DIFFERENT
            </span>
            <h2 className="font-condensed font-black text-white mb-4"
                style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>
              FEATURES YOU WON'T<br />FIND ANYWHERE ELSE
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {UNIQUE_FEATURES.map((feature, i) => (
              <FeatureCard key={i} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section id="comparison" className="bg-white py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3 block">
              COMPARISON
            </span>
            <h2 className="font-condensed font-black text-gray-900 mb-4"
                style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>
              HOW WE STACK UP
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-4 font-medium text-gray-500">Feature</th>
                  <th className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <SoulPrintLogo size={20} />
                      <span className="font-bold text-orange-500">SoulPrint</span>
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center font-medium text-gray-700">ChatGPT</th>
                  <th className="py-4 px-4 text-center font-medium text-gray-700">Claude</th>
                  <th className="py-4 px-4 text-center font-medium text-gray-700">Gemini</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium text-gray-900">{row.feature}</td>
                    <td className="py-4 px-4 text-center bg-orange-50/50">
                      <ComparisonCell value={row.soulprint} />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <ComparisonCell value={row.chatgpt} />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <ComparisonCell value={row.claude} />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <ComparisonCell value={row.gemini} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-orange-500 to-orange-600 py-20 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-condensed font-black text-white mb-4"
              style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
            READY TO TRY IT?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Join thousands of users who've switched to SoulPrint Engine. 
            Start with our free tier — no credit card required.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/auth" className="bg-white text-orange-600 px-8 py-3 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors inline-flex items-center gap-2">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/" className="text-white/80 hover:text-white text-sm flex items-center gap-1 transition-colors">
              Back to Home <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-sp-black py-12 px-8 border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SoulPrintLogo size={24} />
            <span className="font-condensed text-sm font-bold tracking-widest text-white uppercase">SoulPrint</span>
          </div>
          <p className="text-gray-500 text-sm">© 2025 SoulPrint Engine. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
