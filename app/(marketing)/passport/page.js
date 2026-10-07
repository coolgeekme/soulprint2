import Link from 'next/link';
import {
  Fingerprint,
  Network,
  Clock3,
  Lock,
  Check,
  ArrowRight,
  Download,
  Link2,
  Play,
} from 'lucide-react';

import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SoulPrint Passport — one memory across every AI you use',
  description:
    'SoulPrint Passport remembers your preferences, context and personality across the AI tools you use, so you pick up right where you left off. Free during beta.',
  path: '/passport',
});

/* ── integrations ───────────────────────────────────────────────────────── */

const live = [
  { name: 'ChatGPT', note: 'Import your memory and custom instructions in one click.' },
  { name: 'Claude', note: 'Your projects, tone and working style carry straight over.' },
];

const viaMcp = ['Hermes', 'Claude Code', 'Codex', 'Cursor'];

const comingSoon = [
  { name: 'Gemini', note: 'Bring your Passport into Gemini.' },
  { name: 'Perplexity', note: 'Keep your research context across searches.' },
];

/* ── value props ────────────────────────────────────────────────────────── */

const values = [
  { icon: Fingerprint, title: 'One You', body: 'Your personality, preferences and context — captured and remembered.' },
  { icon: Network, title: 'Every AI', body: 'Connect once. Your SoulPrint works across the tools you already use.' },
  { icon: Clock3, title: 'Always Relevant', body: 'Real-time context that stays consistent, up to date and uniquely you.' },
  { icon: Lock, title: "You're in Control", body: 'You decide what stays, what is shared and where your data lives.' },
];

/* ── why it matters ─────────────────────────────────────────────────────── */

const problems = [
  {
    n: '01',
    title: 'The re-explaining tax',
    body: 'Every new tool starts you at zero. You re-explain your job, your voice and your constraints — then do it again next week somewhere else.',
  },
  {
    n: '02',
    title: 'Locked-in memory',
    body: 'What your AI knows about you lives inside that one product. Change tools and you start from nothing.',
  },
  {
    n: '03',
    title: 'Inconsistent output',
    body: 'Same request, different tool, completely different voice. Your work stops sounding like you.',
  },
];

/* ── how it works ───────────────────────────────────────────────────────── */

const steps = [
  { icon: Fingerprint, title: 'Capture', body: 'Answer a short set of prompts about how you work, write and decide.' },
  { icon: Download, title: 'Import', body: 'Pull existing memory out of ChatGPT or Claude — no retyping.' },
  { icon: Link2, title: 'Connect', body: 'Link the tools you already use. Your Passport travels with you.' },
  { icon: Play, title: 'Start using', body: 'Open any supported tool. It already knows you.' },
];

/* ── security ───────────────────────────────────────────────────────────── */

const security = [
  { title: 'Stored locally, not on our servers', body: 'Your Passport lives in your browser\u2019s encrypted store on your device.' },
  { title: 'We never train on your data', body: 'Nothing you import is used to train models — ours or anyone else\u2019s.' },
  { title: 'Export or delete in one click', body: 'Full portability. Portable JSON out, and a real delete that actually deletes.' },
];

const passportRows = [
  ['Memory entries', '1,284'],
  ['Writing samples', '37'],
  ['Tone profile', 'Direct, concise'],
  ['Connected tools', '2 of 4'],
  ['Last synced', 'Just now'],
  ['Stored on', 'This device'],
];

/* ── page ───────────────────────────────────────────────────────────────── */

export default function PassportPage() {
  return (
    <div className="bg-white">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A1C2D] text-[#ffffff]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-200">
                Live in beta
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F5531A]">
                Different AI. Same you.
              </span>
            </div>
            <h1 className="font-condensed font-black uppercase text-4xl md:text-6xl lg:text-7xl leading-[1.02] mt-6">
              Your memories. Your work. Your thinking. Everywhere.
            </h1>
            <p className="text-lg md:text-xl text-[rgba(255,255,255,0.72)] mt-7 max-w-2xl leading-relaxed">
              SoulPrint Passport remembers your preferences, context and personality across the AI
              tools you use &mdash; so you pick up right where you left off.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-10">
              <Link
                href="/auth"
                className="inline-flex items-center justify-center h-14 px-8 rounded-xl bg-[#F5531A] hover:bg-[#E24A12] font-semibold text-[#ffffff] transition-colors"
              >
                Get started free
              </Link>
              <Link
                href="/connect"
                className="inline-flex items-center justify-center h-14 px-8 rounded-xl border border-[rgba(255,255,255,0.28)] hover:border-[rgba(255,255,255,0.55)] text-[#ffffff] font-semibold transition-colors"
              >
                See how to connect
              </Link>
            </div>
            <p className="text-sm text-[rgba(255,255,255,0.55)] mt-5">
              Free during beta. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
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

      {/* ── INTEGRATIONS ─────────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] py-20 md:py-28 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm text-center">
            Supported AI
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4 text-center">
            Works with the AI tools you already use
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl mx-auto text-center leading-relaxed">
            Keep the tools you like. SoulPrint Passport sits underneath them as a continuity layer,
            so your context travels with you.
          </p>

          <p className="font-condensed font-bold uppercase tracking-[0.22em] text-gray-400 text-xs mt-14 mb-4">
            Live now
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {live.map((i) => (
              <div key={i.name} className="bg-white border border-gray-200 rounded-2xl p-7">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-condensed font-black uppercase text-xl text-gray-900">
                    {i.name}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-green-50 text-green-600 border border-green-200">
                    Connected
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mt-4">{i.note}</p>
                <Link
                  href="/connect"
                  className="inline-flex items-center gap-2 mt-5 font-semibold text-[#F5531A] hover:text-[#E24A12]"
                >
                  Connect
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </Link>
              </div>
            ))}
          </div>

          <p className="font-condensed font-bold uppercase tracking-[0.22em] text-gray-400 text-xs mt-12 mb-4">
            Agents &amp; dev tools &mdash; via MCP
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {viaMcp.map((name) => (
              <div
                key={name}
                className="bg-white border border-gray-200 rounded-xl px-6 py-5 flex items-center justify-between gap-3"
              >
                <span className="font-semibold text-gray-900">{name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap bg-green-50 text-green-600 border border-green-200">
                  Live
                </span>
              </div>
            ))}
          </div>

          <p className="font-condensed font-bold uppercase tracking-[0.22em] text-gray-400 text-xs mt-12 mb-4">
            Coming soon
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {comingSoon.map((i) => (
              <div key={i.name} className="bg-white border border-gray-200 rounded-2xl p-7">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-condensed font-black uppercase text-xl text-gray-900">
                    {i.name}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                    Coming soon
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mt-4">{i.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY IT MATTERS ───────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Why it matters
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4 max-w-3xl">
            You shouldn&rsquo;t have to be a stranger to your own AI.
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            Three things happen every time you switch tools. Passport exists to stop all three.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-14">
            {problems.map((p) => (
              <div key={p.n} className="border border-gray-200 rounded-2xl p-7">
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#F5531A]">
                  {p.n}
                </div>
                <h3 className="font-condensed font-black uppercase text-xl text-gray-900 mt-4">
                  {p.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mt-3">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] py-20 md:py-28 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            How it works
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            Four steps. About ninety seconds.
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-14">
            {steps.map((s, idx) => (
              <div key={s.title} className="bg-white border border-gray-200 rounded-2xl p-7">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-orange-50 grid place-items-center flex-none">
                    <s.icon className="w-5 h-5 text-orange-600" strokeWidth={2} />
                  </span>
                  <span className="font-condensed font-black text-sm tracking-widest text-gray-300">
                    {idx + 1}
                  </span>
                </div>
                <h3 className="font-condensed font-black uppercase text-lg text-gray-900 mt-5">
                  {s.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mt-3">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ─────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
              Security
            </p>
            <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
              Your data stays yours. That&rsquo;s the whole point.
            </h2>
            <ul className="mt-10 space-y-6">
              {security.map((s) => (
                <li key={s.title} className="flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full bg-orange-50 grid place-items-center flex-none mt-0.5">
                    <Check className="w-3.5 h-3.5 text-orange-600" strokeWidth={3.2} />
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">{s.title}</p>
                    <p className="text-sm text-gray-600 leading-relaxed mt-1">{s.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border border-gray-200 rounded-2xl p-9 bg-white shadow-sm">
            <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="font-bold text-gray-900">Your Passport</span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-orange-50 text-orange-600">
                Local only
              </span>
            </div>
            {passportRows.map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between py-3.5 border-b border-dashed border-gray-100 last:border-b-0"
              >
                <span className="text-sm text-gray-500">{k}</span>
                <span className="text-sm font-semibold text-gray-900">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] py-20 md:py-28 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Pricing
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            Free while we&rsquo;re in beta.
          </h2>

          <div className="grid md:grid-cols-2 gap-7 mt-14">
            <div className="bg-white border border-gray-200 rounded-2xl p-9 flex flex-col">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#F5531A]">
                Beta
              </div>
              <h3 className="font-condensed font-black uppercase text-2xl text-gray-900 mt-4">
                Passport
              </h3>
              <div className="flex items-baseline gap-2 mt-5">
                <span className="text-5xl font-black text-gray-900 tracking-tight">$0</span>
                <span className="text-gray-500">during beta</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mt-5 flex-1">
                Everything is free right now. No card, no limits.
              </p>
              <Link
                href="/auth"
                className="inline-flex items-center justify-center h-14 mt-8 rounded-xl bg-[#0A1C2D] font-semibold text-[#ffffff] hover:bg-[#132c45] transition-colors"
              >
                Get started
              </Link>
            </div>

            <div className="bg-white border-2 border-[#F5531A] rounded-2xl p-9 flex flex-col shadow-lg">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#F5531A]">
                After beta
              </div>
              <h3 className="font-condensed font-black uppercase text-2xl text-gray-900 mt-4">
                Passport
              </h3>
              <div className="flex items-baseline gap-2 mt-5">
                <span className="text-5xl font-black text-gray-900 tracking-tight">$9</span>
                <span className="text-gray-500">/ month &middot; $90 / year</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mt-5">
                Nothing changes until beta ends &mdash; and beta users hear from us first.
              </p>
              <ul className="mt-6 space-y-3 flex-1">
                {[
                  'Unlimited connected tools',
                  'Encrypted multi-device sync',
                  'The first 50 founding members keep lifetime access',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-[#F5531A] flex-none mt-0.5" strokeWidth={3} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth"
                className="inline-flex items-center justify-center h-14 mt-8 rounded-xl bg-[#F5531A] hover:bg-[#E24A12] font-semibold text-[#ffffff] transition-colors"
              >
                Start free in beta
              </Link>
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-8">
            Full plan detail sits on the{' '}
            <Link href="/pricing" className="font-semibold text-[#F5531A] hover:text-[#E24A12]">
              pricing page
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── ABOUT + CTA ──────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            About
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4 max-w-3xl">
            Built for people who use more than one AI.
          </h2>
          <p className="text-lg text-gray-600 mt-6 max-w-3xl leading-relaxed">
            We kept watching the same thing happen: someone gets a tool tuned perfectly, tries a
            different one, and loses all of it. So we built the layer that should have existed from
            the start.
          </p>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            SoulPrint Passport isn&rsquo;t another chatbot. It&rsquo;s the continuity layer
            underneath the ones you already use.
          </p>

          <div className="mt-16 bg-[#0A1C2D] text-[#ffffff] rounded-2xl px-8 py-12 md:px-14 md:py-16">
            <h3 className="font-condensed font-black uppercase text-3xl md:text-4xl max-w-2xl">
              Stop re-teaching AI who you are.
            </h3>
            <div className="flex flex-wrap gap-4 mt-9">
              <Link
                href="/auth"
                className="inline-flex items-center justify-center h-14 px-8 rounded-xl bg-[#F5531A] hover:bg-[#E24A12] font-semibold text-[#ffffff] transition-colors"
              >
                Get started free
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center h-14 px-8 rounded-xl border border-[rgba(255,255,255,0.28)] hover:border-[rgba(255,255,255,0.55)] text-[#ffffff] font-semibold transition-colors"
              >
                About SoulPrint Engine
              </Link>
            </div>
            <p className="text-sm text-[rgba(255,255,255,0.55)] mt-5">
              Free during beta. No credit card required.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
