import Link from 'next/link';
import {
  Fingerprint,
  MessagesSquare,
  Users,
  Building2,
  Target,
  Zap,
  Check,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  KeyRound,
  FileSearch,
  UserPlus,
} from 'lucide-react';

import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Foundry — a crew of AI specialists briefed on your company',
  description:
    'Foundry gives your team 169 specialist AI agents across 14 divisions, briefed once on your mission, tone and people. Work one-to-one or pull a group into the thread. Live now at foundryagents.ai.',
  path: '/foundry',
});

const SITE = 'https://foundryagents.ai';

/* ── what it is ─────────────────────────────────────────────────────────── */

const pillars = [
  {
    icon: Fingerprint,
    title: 'One brief, every agent',
    body: 'Define your mission, tone, audience and values once. Every agent on the team is briefed automatically.',
  },
  {
    icon: MessagesSquare,
    title: 'Group and direct',
    body: 'Work one-to-one with an agent, or pull several people and agents into a single thread and steer with an @mention.',
  },
  {
    icon: Users,
    title: '169 specialists',
    body: 'Engineering, marketing, sales, design, finance, legal, ops, product, testing and more — a full agency roster.',
  },
  {
    icon: Building2,
    title: 'Built org-first',
    body: 'Invite the company by link, then spin up a team per product, brand or squad. Contexts stay clean and conversations stay private.',
  },
  {
    icon: Target,
    title: 'Tuned, not templated',
    body: 'Your brief is woven into every system prompt, so answers read like they came from someone who works at your company.',
  },
  {
    icon: Zap,
    title: 'Working in minutes',
    body: 'No configuration theatre. Create an org, draft your brief, and you are in a working thread fast.',
  },
];

/* ── the crew — these counts are the real catalogue, and they sum to 169 ── */

const divisions = [
  { name: 'Specialized', n: 41 },
  { name: 'Marketing', n: 30 },
  { name: 'Engineering', n: 29 },
  { name: 'Sales', n: 8 },
  { name: 'Design', n: 8 },
  { name: 'Testing', n: 8 },
  { name: 'Paid Media', n: 7 },
  { name: 'Project Mgmt', n: 6 },
  { name: 'Support', n: 6 },
  { name: 'Spatial Computing', n: 6 },
  { name: 'Product', n: 5 },
  { name: 'Finance', n: 5 },
  { name: 'Academic', n: 5 },
  { name: 'Game Development', n: 5 },
];

/* ── how it works ───────────────────────────────────────────────────────── */

const steps = [
  {
    n: '01',
    title: 'Create your org',
    body: 'Foundry is invite-only. You come in with an access code and set up your workspace.',
  },
  {
    n: '02',
    title: 'Draft your brief',
    body: 'Mission, tone, audience, values. This one document briefs every agent you will ever work with.',
  },
  {
    n: '03',
    title: 'Invite your team',
    body: 'By link or by email, as admins or viewers. Teams can be split per product, brand or squad.',
  },
  {
    n: '04',
    title: 'Open a thread',
    body: 'Pick an agent, or pull a group into the room. Ask, steer, and keep the work in one place.',
  },
];

/* ── getting in ─────────────────────────────────────────────────────────── */

const access = [
  {
    icon: KeyRound,
    title: 'Invite-only',
    body: 'Signup needs an access code. It keeps the early rooms full of real companies rather than drive-by signups.',
  },
  {
    icon: FileSearch,
    title: 'Try it first',
    body: 'Request a Signal Audit and you get a free 24-hour trial, plus an audit of how your company shows up to AI.',
  },
  {
    icon: UserPlus,
    title: 'Bring the whole team',
    body: 'Invite by link or email. Roles are admin and viewer, so the right people get the right access.',
  },
];

/* ── page ───────────────────────────────────────────────────────────────── */

export default function FoundryPage() {
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
                A SoulPrint Engine product
              </span>
            </div>
            <h1 className="font-condensed font-black uppercase text-4xl md:text-6xl lg:text-7xl leading-[1.02] mt-6">
              A crew of AI specialists that already knows your company.
            </h1>
            <p className="text-lg md:text-xl text-[rgba(255,255,255,0.72)] mt-7 max-w-2xl leading-relaxed">
              Foundry gives your team 169 specialist agents across 14 divisions. Brief them once on
              your mission, your tone and your people &mdash; then work with them directly or pull a
              whole group into one thread.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-10">
              <a
                href={SITE}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-xl bg-[#F5531A] hover:bg-[#E24A12] font-semibold text-[#ffffff] transition-colors"
              >
                Open foundryagents.ai
                <ArrowUpRight className="w-4 h-4" strokeWidth={2.5} />
              </a>
              <a
                href="#crew"
                className="inline-flex items-center justify-center h-14 px-8 rounded-xl border border-[rgba(255,255,255,0.28)] hover:border-[rgba(255,255,255,0.55)] text-[#ffffff] font-semibold transition-colors"
              >
                Meet the crew
              </a>
            </div>
            <p className="text-sm text-[rgba(255,255,255,0.55)] mt-5">
              Invite-only. Free 24-hour trial available.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT IT IS ───────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            What it is
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            Not another chatbot. A crew.
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            A general assistant answers one question at a time. Foundry gives you a bench of
            specialists who all start from the same understanding of your company.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
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

      {/* ── THE CREW ─────────────────────────────────────────────────── */}
      <section
        id="crew"
        className="bg-[#f8fafc] py-20 md:py-28 border-y border-gray-100 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            The crew
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            169 specialists. 14 divisions.
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            Every one of them is briefed by the same document and grounded in your organization&rsquo;s
            own material. Here is the actual roster, division by division.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14">
            {divisions.map((d) => (
              <div key={d.name} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                <p className="font-condensed font-black uppercase text-lg text-gray-900 leading-tight">
                  {d.name}
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#F5531A] mt-1.5">
                  {d.n} agents
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-500 mt-8">
            That is the full catalogue &mdash; {divisions.length} divisions, 169 agents, no rounding.
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            How it works
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            Four steps to a working thread.
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-14">
            {steps.map((s) => (
              <div key={s.n} className="border border-gray-200 rounded-2xl p-7">
                <span className="font-condensed font-black text-sm tracking-widest text-gray-300">
                  {s.n}
                </span>
                <h3 className="font-condensed font-black uppercase text-lg text-gray-900 mt-4">
                  {s.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mt-3">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACCESS ───────────────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] py-20 md:py-28 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Getting in
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            It is live. It is invite-only.
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            Foundry is running today and real teams are in it. Signup takes an access code, so the
            way in is either an invite or the trial below.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-14">
            {access.map((a) => (
              <div
                key={a.title}
                className="bg-white border border-gray-200 rounded-2xl p-7 flex items-start gap-5"
              >
                <span className="w-10 h-10 rounded-lg bg-orange-50 grid place-items-center flex-none">
                  <a.icon className="w-5 h-5 text-orange-600" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="font-bold text-gray-900">{a.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mt-2">{a.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 mt-12">
            <a
              href={`${SITE}/auth?mode=register`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-xl bg-[#F5531A] hover:bg-[#E24A12] font-semibold text-[#ffffff] transition-colors"
            >
              Create your org
              <ArrowUpRight className="w-4 h-4" strokeWidth={2.5} />
            </a>
            <a
              href={`${SITE}/get-audit`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-xl border border-gray-300 hover:border-gray-400 font-semibold text-gray-900 transition-colors"
            >
              Try a Signal Audit
              <ArrowUpRight className="w-4 h-4" strokeWidth={2.5} />
            </a>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Need an access code first?{' '}
            <Link href="/contact" className="font-semibold text-[#F5531A] hover:text-[#E24A12]">
              Ask us
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── TRUST ────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
              Trust
            </p>
            <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
              Your company&rsquo;s material stays yours.
            </h2>
            <p className="text-lg text-gray-600 mt-5 leading-relaxed">
              What you brief Foundry on is what makes it useful, which is exactly why it needs to be
              handled carefully.
            </p>
            <ul className="mt-9 space-y-4">
              {[
                'Private workspaces, separated by organization',
                'Conversations stay inside the teams you set up',
                'Roles are admin and viewer, so access is deliberate',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-gray-700">
                  <Check className="w-5 h-5 text-orange-600 flex-none mt-0.5" strokeWidth={3} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#0A1C2D] text-[#ffffff] rounded-2xl px-8 py-12 md:px-12 md:py-14">
            <ShieldCheck className="w-9 h-9 text-[#F5531A]" strokeWidth={1.8} />
            <h3 className="font-condensed font-black uppercase text-2xl md:text-3xl mt-5">
              Read the detail
            </h3>
            <p className="text-[rgba(255,255,255,0.72)] leading-relaxed mt-5">
              Foundry publishes its own trust, security and sub-processor pages. If you are
              evaluating it for a team, start there rather than taking our word for it.
            </p>
            <a
              href={`${SITE}/trust`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 h-14 px-8 mt-9 rounded-xl bg-[#F5531A] hover:bg-[#E24A12] font-semibold text-[#ffffff] transition-colors"
            >
              Foundry Trust &amp; Security
              <ArrowUpRight className="w-4 h-4" strokeWidth={2.5} />
            </a>
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
            Foundry runs on the same engine as everything else we build. The difference is who it is
            pointed at: a company rather than one person, so the brief covers a team instead of a
            single user.
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
            <Link
              href="/kidsprint"
              className="inline-flex items-center justify-center h-14 px-8 rounded-xl border border-gray-300 hover:border-gray-400 font-semibold text-gray-900 transition-colors"
            >
              KidSprint
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#0A1C2D] text-[#ffffff] rounded-2xl px-8 py-12 md:px-14 md:py-16">
            <h3 className="font-condensed font-black uppercase text-3xl md:text-4xl max-w-2xl">
              Give your team a crew that already works there.
            </h3>
            <div className="flex flex-wrap gap-4 mt-9">
              <a
                href={SITE}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-xl bg-[#F5531A] hover:bg-[#E24A12] font-semibold text-[#ffffff] transition-colors"
              >
                Open foundryagents.ai
                <ArrowUpRight className="w-4 h-4" strokeWidth={2.5} />
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center h-14 px-8 rounded-xl border border-[rgba(255,255,255,0.28)] hover:border-[rgba(255,255,255,0.55)] text-[#ffffff] font-semibold transition-colors"
              >
                Talk to us
              </Link>
            </div>
            <p className="text-sm text-[rgba(255,255,255,0.55)] mt-5">
              foundryagents.ai &mdash; live now, invite-only, with a free 24-hour trial.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
