import Link from 'next/link';
import {
  ShieldCheck,
  RefreshCw,
  Fingerprint,
  Network,
  Clock3,
  Lock,
} from 'lucide-react';

const chatAi = [
  {
    name: 'ChatGPT',
    logo: '/logos/chatgpt.svg',
    status: 'Connected',
    tone: 'green',
  },
  {
    name: 'Claude',
    logo: '/logos/claude.svg',
    status: 'Connected',
    tone: 'green',
  },
];

const agents = [
  { name: 'Hermes', logo: '/logos/hermes.png', status: 'Live', note: 'MCP' },
  { name: 'Claude Code', logo: '/logos/claude.svg', status: 'Live', note: 'MCP' },
  { name: 'Codex', logo: '/logos/codex.png', status: 'Live', note: 'MCP' },
  { name: 'Cursor', logo: '/logos/cursor.svg', status: 'Live', note: 'MCP' },
];

const comingSoon = [
  { name: 'Gemini', logo: '/logos/gemini.svg' },
  { name: 'Perplexity', logo: '/logos/perplexity.svg' },
];

const values = [
  {
    icon: Fingerprint,
    title: 'One You',
    body: 'Your personality, preferences, and context — captured and remembered.',
  },
  {
    icon: Network,
    title: 'Every AI',
    body: 'Connect once. Your SoulPrint works across all the tools you already use.',
  },
  {
    icon: Clock3,
    title: 'Always Relevant',
    body: 'Real-time context that stays consistent, up to date, and uniquely you.',
  },
  {
    icon: Lock,
    title: "You're in Control",
    body: 'You decide what stays, what is shared, and where your data lives.',
  },
];

const statusChip = {
  green: 'bg-green-50 text-green-600 border-green-200',
  live: 'bg-orange-50 text-orange-600 border-orange-200',
  soon: 'bg-amber-50 text-amber-600 border-amber-200',
};

function PlatformCard({ name, logo, status, tone = 'soon', note }) {
  return (
    <div className="bg-white border border-gray-200 hover:border-orange-400/60 rounded-2xl p-5 flex flex-col items-center gap-3 transition-colors shadow-sm">
      <div className="h-11 flex items-center justify-center">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={`${name} logo`} className="h-9 w-9 object-contain" />
        ) : (
          <span className="h-9 w-9 rounded-lg bg-gray-100 border border-gray-200" />
        )}
      </div>
      <span className="font-semibold text-gray-900 text-sm">{name}</span>
      <span
        className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${statusChip[tone]}`}
      >
        {status}
        {note ? ` · ${note}` : ''}
      </span>
    </div>
  );
}

function GroupLabel({ children }) {
  return (
    <p className="font-condensed font-bold uppercase tracking-[0.22em] text-gray-400 text-xs mt-8 mb-4 first:mt-0">
      {children}
    </p>
  );
}

export default function PassportHome() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-orange-50/80 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center relative">
          <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm mb-5">
            Identity &middot; Memory &middot; Context
          </p>
          <h1 className="font-condensed font-black uppercase tracking-tight text-gray-900 leading-[0.95] mb-6 text-[clamp(44px,7vw,84px)]">
            Your SoulPrint <span className="text-orange-600">Passport</span>
          </h1>
          <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto mb-9">
            One persistent layer of you that travels with you across every AI you use.
          </p>
          <div className="flex items-center justify-center gap-8 flex-wrap mb-4">
            <span className="flex items-center gap-2 text-gray-700 text-sm font-medium">
              <ShieldCheck className="text-green-600" size={18} /> Private by design
            </span>
            <span className="flex items-center gap-2 text-gray-700 text-sm font-medium">
              <RefreshCw className="text-orange-600" size={18} /> Always in sync
            </span>
          </div>
          <div className="mt-8">
            <Link
              href="/auth"
              className="inline-block bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-md shadow-orange-500/20"
            >
              Get Started Free
            </Link>
            <p className="text-gray-400 text-sm mt-3">No credit card required.</p>
          </div>
        </div>
      </section>

      {/* CONNECT YOUR AI */}
      <section className="bg-[#f8fafc] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm text-center mb-3">
            Connect Your AI to You
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 text-center mb-14">
            Bring your SoulPrint to the tools you already use
          </h2>

          <GroupLabel>Chat AI</GroupLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
            {chatAi.map((p) => (
              <PlatformCard key={p.name} {...p} />
            ))}
          </div>

          <GroupLabel>Agents &amp; Dev Tools — via MCP</GroupLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {agents.map((p) => (
              <PlatformCard key={p.name} {...p} />
            ))}
          </div>

          <GroupLabel>Coming Soon</GroupLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
            {comingSoon.map((p) => (
              <PlatformCard key={p.name} {...p} status="Soon" />
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/connect"
              className="inline-flex items-center gap-2 text-orange-600 font-semibold text-sm hover:text-orange-700 transition-colors"
            >
              See how to connect your AI <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((v) => (
              <div key={v.title} className="text-center">
                <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <v.icon size={26} strokeWidth={1.8} />
                </div>
                <h3 className="font-condensed font-black uppercase text-xl text-gray-900 mb-2">
                  {v.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IMPRINTS */}
      <section className="bg-[#f8fafc] py-20 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm mb-3">
            Imprints
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mb-4">
            One you. Every mode you need.
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-9">
            Your SoulPrint stays constant. Imprints change how your AI shows up for the
            moment &mdash; the voice, the tone, the priorities.
          </p>
          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {[
              'Supportive Friend',
              'Brutally Honest Advisor',
              'Career Coach',
              'Study Buddy',
              'Thoughtful Editor',
              'Senior Code Reviewer',
              'Calm Decision Maker',
              'Creative Director',
            ].map((c) => (
              <span
                key={c}
                className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="text-gray-500 text-sm mt-6">
            Pick one per conversation, or build your own.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mb-6">
            Stop re-teaching AI who you are
          </h2>
          <Link
            href="/auth"
            className="inline-block bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-md shadow-orange-500/20"
          >
            Get Started Free
          </Link>
          <p className="text-gray-400 text-sm mt-3">No credit card required.</p>
        </div>
      </section>
    </div>
  );
}
