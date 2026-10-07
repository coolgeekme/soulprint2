import Link from 'next/link';
import {
  Brain,
  ShieldCheck,
  Users,
  Rocket,
  Check,
  BookOpen,
  MessagesSquare,
  Sparkles,
} from 'lucide-react';

import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'KidSprint — a safe AI learning sidekick for kids',
  description:
    'KidSprint is a safe AI learning sidekick for kids: homework help, big questions and curiosity, with parents in the loop. In development — here is what we are building.',
  path: '/kidsprint',
});

/* ── what it does ───────────────────────────────────────────────────────── */

const pillars = [
  {
    icon: Brain,
    title: 'Learns How They Learn',
    body: 'Adapts to your child\u2019s style, interests and pace, so help lands the way they actually think.',
  },
  {
    icon: ShieldCheck,
    title: 'Safe & Kid-Friendly',
    body: 'Built with strong guardrails from the start, not bolted on afterwards.',
  },
  {
    icon: Users,
    title: 'Parents in the Loop',
    body: 'You get useful insight into what they\u2019re working on, without reading every conversation.',
  },
  {
    icon: Rocket,
    title: 'Encourages Curiosity',
    body: 'Sparks bigger questions and builds confidence, instead of handing over an answer to copy.',
  },
];

/* ── how it helps ───────────────────────────────────────────────────────── */

const help = [
  {
    icon: BookOpen,
    title: 'Homework help',
    body: 'Walks through the step they\u2019re stuck on, rather than doing the problem for them.',
  },
  {
    icon: MessagesSquare,
    title: 'Big questions',
    body: 'Answers the ones that come out of nowhere at bedtime, in language built for their age.',
  },
  {
    icon: Sparkles,
    title: 'Cool ideas',
    body: 'A place to chase projects and curiosity without the open internet in the way.',
  },
];

/* ── what it is not ─────────────────────────────────────────────────────── */

const notList = [
  'Not a chatbot left alone with your child',
  'Not a homework machine that hands over answers',
  'Not another screen you have to police yourself',
];

/* ── page ───────────────────────────────────────────────────────────────── */

export default function KidSprintPage() {
  return (
    <div className="bg-white">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A1C2D] text-[#ffffff]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[rgba(255,255,255,0.10)] text-[#ffffff] border border-[rgba(255,255,255,0.22)]">
                In development
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F5531A]">
                A SoulPrint Engine product
              </span>
            </div>
            <h1 className="font-condensed font-black uppercase text-4xl md:text-6xl lg:text-7xl leading-[1.02] mt-6">
              AI that helps kids think, not just gives them answers.
            </h1>
            <p className="text-lg md:text-xl text-[rgba(255,255,255,0.72)] mt-7 max-w-2xl leading-relaxed">
              KidSprint is a safe AI learning sidekick for kids. Homework help, big questions and
              cool ideas &mdash; personalized for the way they learn, and built with parents in the
              loop.
            </p>
            <p className="text-[15px] text-[rgba(255,255,255,0.55)] mt-8">
              KidSprint is still being built. This page is what we&rsquo;re working toward.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT IT DOES ─────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            What it does
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            Built for growing minds
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            Four things we designed around from the beginning. They are the reason KidSprint is a
            different kind of tool, not a chat window with a filter on it.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-14">
            {pillars.map((p) => (
              <div key={p.title} className="border border-gray-200 rounded-2xl p-7">
                <span className="w-10 h-10 rounded-lg bg-orange-50 grid place-items-center flex-none">
                  <p.icon className="w-5 h-5 text-orange-600" strokeWidth={2} />
                </span>
                <h3 className="font-condensed font-black uppercase text-lg text-gray-900 mt-5">
                  {p.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mt-3">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT HELPS ─────────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] py-20 md:py-28 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Day to day
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            What it helps with
          </h2>

          <div className="grid md:grid-cols-3 gap-6 mt-14">
            {help.map((h) => (
              <div
                key={h.title}
                className="bg-white border border-gray-200 rounded-2xl p-7 flex items-start gap-5"
              >
                <span className="w-10 h-10 rounded-lg bg-orange-50 grid place-items-center flex-none">
                  <h.icon className="w-5 h-5 text-orange-600" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="font-bold text-gray-900">{h.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mt-2">{h.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SAFETY ───────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
              Safety
            </p>
            <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
              A kids&rsquo; product has to earn it.
            </h2>
            <p className="text-lg text-gray-600 mt-5 leading-relaxed">
              Safety and privacy are not features we added later. They are the reason KidSprint
              looks the way it does &mdash; and why it is taking us longer than a chat app would.
            </p>

            <ul className="mt-9 space-y-4">
              {notList.map((n) => (
                <li key={n} className="flex items-start gap-3 text-gray-700">
                  <Check className="w-5 h-5 text-orange-600 flex-none mt-0.5" strokeWidth={3} />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#0A1C2D] text-[#ffffff] rounded-2xl px-8 py-12 md:px-12 md:py-14">
            <h3 className="font-condensed font-black uppercase text-2xl md:text-3xl">
              Still in development
            </h3>
            <p className="text-[rgba(255,255,255,0.72)] leading-relaxed mt-5">
              KidSprint is not available yet. We are building it carefully because it is for
              children, and we would rather take the time than ship something we would not put in
              front of our own kids.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center h-14 px-8 mt-9 rounded-xl bg-[#F5531A] hover:bg-[#E24A12] font-semibold text-[#ffffff] transition-colors"
            >
              Ask us about KidSprint
            </Link>
            <p className="text-sm text-[rgba(255,255,255,0.5)] mt-4">
              Questions, or want to be told when it opens?
            </p>
          </div>
        </div>
      </section>

      {/* ── BACK TO ENGINE ───────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] py-20 md:py-24 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-condensed font-black uppercase text-2xl md:text-4xl text-gray-900">
            Built on SoulPrint Engine
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            KidSprint runs on the same engine as everything else we build &mdash; the same memory,
            the same identity layer. It simply points it at a different job.
          </p>
          <div className="flex flex-wrap gap-4 mt-9">
            <Link
              href="/"
              className="inline-flex items-center justify-center h-14 px-8 rounded-xl border border-gray-300 hover:border-gray-400 font-semibold text-gray-900 transition-colors"
            >
              About SoulPrint Engine
            </Link>
            <Link
              href="/passport"
              className="inline-flex items-center justify-center h-14 px-8 rounded-xl border border-gray-300 hover:border-gray-400 font-semibold text-gray-900 transition-colors"
            >
              SoulPrint Passport
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
