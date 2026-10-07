import Link from 'next/link';
import {
  Database,
  Compass,
  ArrowLeftRight,
  Fingerprint,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react';

import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SoulPrint Engine — One engine. Every product that remembers.',
  absoluteTitle: true,
  description:
    'SoulPrint Engine is the identity, memory and portability layer underneath every SoulPrint product. SoulPrint Passport, KidSprint and Foundry are built on it. Free during beta.',
  path: '/',
});

/* ── the family ─────────────────────────────────────────────────────────── */

const family = [
  {
    name: 'SoulPrint Passport',
    domain: 'soulprintpassport.ai',
    href: 'https://soulprintpassport.ai',
    status: 'Live in beta',
    body: 'Your AI, remembering you. One memory that follows you across ChatGPT, Claude and every agent tool you use, so switching tools never resets the thread.',
    cta: 'Open soulprintpassport.ai',
  },
  {
    name: 'KidSprint',
    domain: 'kidsprint.ai',
    href: '/kidsprint',
    internal: true,
    status: 'In development',
    body: 'A safe AI learning sidekick for kids. Homework help, big questions and curiosity, with parents in the loop. Still being built.',
    cta: 'What is KidSprint?',
  },
  {
    // Foundry's own site carries "Powered by SoulPrint Engine", so it belongs in
    // this family rather than in a separate "also from us" band.
    name: 'Foundry',
    domain: 'foundryagents.ai',
    href: 'https://foundryagents.ai',
    status: 'Beta',
    body: 'A working crew of specialized AI agents for your team. Brief them once on your mission, tone and people, then work in direct or group chat.',
    cta: 'Open foundryagents.ai',
  },
];

/* ── what the engine does ───────────────────────────────────────────────── */

const systems = [
  {
    n: '01',
    icon: Database,
    name: 'Memory engine',
    body: 'Holds what matters, with provenance. Every memory keeps where it came from and what changed when you corrected it.',
  },
  {
    n: '02',
    icon: Compass,
    name: 'Assessment engine',
    body: 'Builds the first real picture of you, so a product is useful on day one instead of week three.',
    tag: 'Patent pending',
  },
  {
    n: '03',
    icon: ArrowLeftRight,
    name: 'Portability layer',
    body: 'Moves that memory between tools. A browser extension for chat, an MCP server for agents and dev tools. Same memory, either door.',
  },
  {
    n: '04',
    icon: Fingerprint,
    name: 'Identity layer',
    body: 'Tone, format and depth follow the person, not a settings menu. The product adapts to you, not the other way around.',
  },
  {
    n: '05',
    icon: Layers,
    name: 'Imprint system',
    body: 'Portable personas that change how the AI shows up — voice, tone, priorities. Your profile stays constant underneath.',
  },
  {
    n: '06',
    icon: Sparkles,
    name: 'Dynamic Intelligence',
    body: 'Reads the question and picks the model. Different tasks go to the AI that handles them best, and it tells you which one it chose.',
  },
];

/* ── imprints ───────────────────────────────────────────────────────────── */

const imprints = [
  { cat: 'Professional', name: 'Business Coach', body: 'Leads with questions before answers. Challenges the idea, not the person.' },
  { cat: 'Professional', name: 'Career Advisor', body: 'Maps the path, names the tradeoffs, tells you what the move actually costs.' },
  { cat: 'Creative', name: 'Creative Writer', body: "Finds the voice already in the draft and cuts everything that isn't it." },
  { cat: 'Creative', name: 'Storyteller', body: 'Turns a flat account of events into something with a shape and a turn.' },
  { cat: 'Education', name: 'Study Buddy', body: 'Goes at your pace and checks you understood before moving on.' },
  { cat: 'Education', name: 'Math Tutor', body: 'Shows you the step you missed instead of doing the problem for you.' },
  { cat: 'Personality', name: 'Tough Love Coach', body: 'Says the thing your friends are too polite to say.' },
  { cat: 'Personality', name: 'Zen Master', body: 'Slows the question down until the answer is obvious.' },
];

const precedence = [
  { label: 'Project imprint', note: 'Scoped to one project. Applies only inside it.', role: 'Most specific' },
  { label: 'Default imprint', note: 'Applies everywhere, unless a project overrides it.', role: 'Wins over' },
  { label: 'Your SoulPrint', note: 'Who you are. Never replaced, never flattened.', role: 'Always underneath' },
];

/* ── dynamic intelligence ───────────────────────────────────────────────── */

const routing = [
  { ask: 'Explain quantum physics to me', to: 'GPT-5.2', why: 'Reasoning-heavy question' },
  { ask: 'Write me a love poem', to: 'Claude Opus', why: 'Writing and voice' },
  { ask: "What's the weather today?", to: 'Sonar Pro', why: 'Needs live web search' },
  { ask: 'Design a logo for my brand', to: 'Seedream', why: 'Accurate text rendering' },
  { ask: 'A photorealistic sunset over water', to: 'Nano Banana', why: 'Photoreal image generation' },
  { ask: 'A person talking to camera', to: 'Wan 2.6', why: 'Lip sync' },
  { ask: 'Cinematic drone shot over a coastline', to: 'Sora 2', why: 'Cinematic video quality' },
];

/* ── coverage ───────────────────────────────────────────────────────────── */

const coverage = [
  { name: 'ChatGPT', status: 'Connected', live: true },
  { name: 'Claude', status: 'Connected', live: true },
  { name: 'Gemini', status: 'Coming soon', live: false },
  { name: 'Perplexity', status: 'Coming soon', live: false },
  { name: 'Hermes', status: 'Live · MCP', live: true },
  { name: 'Claude Code', status: 'Live · MCP', live: true },
  { name: 'Codex', status: 'Live · MCP', live: true },
  { name: 'Cursor', status: 'Live · MCP', live: true },
];

/* ── faq ────────────────────────────────────────────────────────────────── */

const faq = [
  {
    q: 'Is SoulPrint Engine something I can buy?',
    a: 'No. The engine is the platform, not a product. SoulPrint Passport, KidSprint and Foundry are the products built on it — those are what you sign up for.',
  },
  {
    q: 'What is SoulPrint Passport?',
    a: 'Your AI, remembering you. It carries one memory across ChatGPT, Claude and every agent tool you use, so you stop re-explaining yourself. It lives at soulprintpassport.ai.',
  },
  {
    q: 'What is KidSprint?',
    a: 'A safe AI learning sidekick for kids, currently in development. It helps children work through homework and big questions while parents stay in the loop. There is a page about it here on this site.',
  },
  {
    q: 'Do I need both?',
    a: 'No. They are built for different people and run independently. They simply share the same engine underneath.',
  },
  {
    q: 'Which AI tools does it work with?',
    a: 'ChatGPT and Claude are connected today. Gemini and Perplexity are coming. Hermes, Claude Code, Codex and Cursor connect through MCP right now.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'No, and there does not need to be. MCP covers mobile through the apps you already have installed.',
  },
];

/* ── page ───────────────────────────────────────────────────────────────── */

export default function SoulPrintEngineHome() {
  return (
    <div className="bg-white">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A1C2D] text-[#ffffff]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
              Identity &middot; Memory &middot; Portability
            </p>
            <h1 className="font-condensed font-black uppercase text-4xl md:text-6xl lg:text-7xl leading-[1.02] mt-5">
              One engine. Every product that remembers.
            </h1>
            <p className="text-lg md:text-xl text-[rgba(255,255,255,0.72)] mt-7 max-w-2xl leading-relaxed">
              SoulPrint Engine is the platform underneath every product we build. Same identity,
              same memory, same portability &mdash; each product just points it at a different job.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-10">
              <a
                href="#family"
                className="inline-flex items-center justify-center h-14 px-8 rounded-xl bg-[#F5531A] hover:bg-[#E24A12] font-semibold text-[#ffffff] transition-colors"
              >
                See the products
              </a>
              <a
                href="#engine"
                className="inline-flex items-center justify-center h-14 px-8 rounded-xl border border-[rgba(255,255,255,0.28)] hover:border-[rgba(255,255,255,0.55)] text-[#ffffff] font-semibold transition-colors"
              >
                How it works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE FAMILY ───────────────────────────────────────────────── */}
      <section id="family" className="py-20 md:py-28 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            The family
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            Built on one engine
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            Every product starts from the same place: a memory that belongs to the person using it.
            Different audiences, different jobs, one thing underneath.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-14">
            {family.map((p) => (
              <div
                key={p.name}
                className="border border-gray-200 rounded-2xl p-8 flex flex-col hover:border-gray-300 hover:shadow-lg transition-all"
              >
                {p.status ? (
                  <span className="inline-flex self-start items-center text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-200">
                    {p.status}
                  </span>
                ) : null}
                <h3 className="font-condensed font-black uppercase text-2xl md:text-3xl text-gray-900 mt-6">
                  {p.name}
                </h3>
                <p className="text-sm font-medium text-gray-400 mt-1">{p.domain}</p>
                <p className="text-base text-gray-600 leading-relaxed mt-5 flex-1">{p.body}</p>
                {/* An internal href is a page on this site, so open it in the same
                    tab. Only genuinely external product sites get a new tab. */}
                {p.internal ? (
                  <Link
                    href={p.href}
                    className="inline-flex items-center gap-2 mt-7 font-semibold text-[#F5531A] hover:text-[#E24A12]"
                  >
                    {p.cta}
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                ) : (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 mt-7 font-semibold text-[#F5531A] hover:text-[#E24A12]"
                  >
                    {p.cta}
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UNDERNEATH ───────────────────────────────────────────────── */}
      <section
        id="engine"
        className="bg-[#f8fafc] py-20 md:py-28 border-y border-gray-100 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Underneath
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            What the engine actually does
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            Six systems, shared by every product. Build them once and each new product starts with
            the hard part already done.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
            {systems.map((s) => (
              <div key={s.name} className="bg-white border border-gray-200 rounded-2xl p-7">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-orange-50 grid place-items-center flex-none">
                    <s.icon className="w-5 h-5 text-orange-600" strokeWidth={2} />
                  </span>
                  <span className="font-condensed font-black text-sm tracking-widest text-gray-300">
                    {s.n}
                  </span>
                </div>
                <h3 className="font-condensed font-black uppercase text-xl text-gray-900 mt-6">
                  {s.name}
                </h3>
                {s.tag ? (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0A1C2D] text-[#ffffff] mt-3">
                    {s.tag}
                  </span>
                ) : null}
                <p className="text-sm text-gray-600 leading-relaxed mt-4">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IMPRINTS ─────────────────────────────────────────────────── */}
      <section id="imprints" className="py-20 md:py-28 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Imprints
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            One you. Every mode you need.
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            Your profile is the constant. An imprint changes how the AI shows up for the moment
            &mdash; the voice, the tone, the priorities, how hard it pushes back. Swap it per
            conversation, or set one for a whole project.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
            {imprints.map((i) => (
              <div key={i.name} className="border border-gray-200 rounded-2xl p-6">
                <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                  {i.cat}
                </p>
                <h3 className="font-bold text-gray-900 mt-3">{i.name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mt-2">{i.body}</p>
              </div>
            ))}
          </div>

          {/* precedence */}
          <div className="mt-12 border border-gray-200 rounded-2xl overflow-hidden">
            {precedence.map((r) => (
              <div
                key={r.label}
                className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-5 px-7 py-6 border-b border-gray-100 last:border-b-0"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 sm:w-32 flex-none sm:pt-1">
                  {r.role}
                </span>
                <div>
                  <p className="font-bold text-gray-900">{r.label}</p>
                  <p className="text-sm text-gray-600 mt-1">{r.note}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Fifty imprints ship with the engine, across five categories. Anything you don&rsquo;t
            see, you describe in a sentence and build.
          </p>
        </div>
      </section>

      {/* ── DYNAMIC INTELLIGENCE ─────────────────────────────────────── */}
      <section
        id="intelligence"
        className="bg-[#f8fafc] py-20 md:py-28 border-y border-gray-100 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Dynamic Intelligence
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            You don&rsquo;t pick the model. The engine does.
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            Every question gets read before it gets answered. The engine works out what you&rsquo;re
            actually asking for and routes it to whichever AI handles it best &mdash; then tells you
            which one answered, and why.
          </p>

          <div className="mt-14 overflow-x-auto">
            <table className="w-full min-w-[640px] bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    You ask
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Routes to
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Because
                  </th>
                </tr>
              </thead>
              <tbody>
                {routing.map((r) => (
                  <tr key={r.ask} className="border-t border-gray-100">
                    <td className="px-6 py-4 text-gray-900">{r.ask}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap">
                      <span className="text-orange-600 mr-2" aria-hidden="true">
                        &rarr;
                      </span>
                      {r.to}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{r.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-gray-500 mt-6 max-w-3xl">
            The confidence score and the reason come back with every routed question. Routing stays
            visible on purpose &mdash; you can always see where an answer came from.
          </p>
        </div>
      </section>

      {/* ── COVERAGE ─────────────────────────────────────────────────── */}
      <section id="platform" className="py-20 md:py-28 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Coverage
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            Runs across the tools you already use
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl leading-relaxed">
            We sit across the AI tools, not above them. Keep the ones you like and carry your memory
            between them.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mt-14">
            {coverage.map((c) => (
              <div
                key={c.name}
                className="border border-gray-200 rounded-xl px-6 py-5 flex items-center justify-between gap-3"
              >
                <span className="font-semibold text-gray-900">{c.name}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap border ${
                    c.live
                      ? 'bg-green-50 text-green-600 border-green-200'
                      : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-500 mt-8 max-w-3xl">
            Anything that speaks MCP can connect. There is no SoulPrint mobile app &mdash; the
            platforms you already have on your phone are the mobile experience.
          </p>

          {/* ownership */}
          <div className="mt-16 bg-[#0A1C2D] text-[#ffffff] rounded-2xl px-8 py-12 md:px-14 md:py-16">
            <h3 className="font-condensed font-black uppercase text-3xl md:text-4xl">
              The engine is ours. The memory is yours.
            </h3>
            <div className="flex flex-wrap gap-x-10 gap-y-4 mt-8">
              {['Yours', 'Exportable', 'Under your control'].map((v) => (
                <span key={v} className="inline-flex items-center gap-2 font-semibold">
                  <Check className="w-5 h-5 text-[#F5531A]" strokeWidth={3} />
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section
        id="faq"
        className="bg-[#f8fafc] py-20 md:py-28 border-y border-gray-100 scroll-mt-24"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Straight answers
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4">
            Questions people actually ask
          </h2>

          <div className="mt-12 divide-y divide-gray-200 border-t border-gray-200">
            {faq.map((f) => (
              <details key={f.q} className="group py-6">
                <summary className="flex items-center justify-between gap-6 cursor-pointer list-none">
                  <span className="font-semibold text-lg text-gray-900">{f.q}</span>
                  <span
                    className="text-orange-600 text-2xl leading-none flex-none transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="text-gray-600 leading-relaxed mt-4 pr-10">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── START HERE ───────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-condensed font-bold uppercase tracking-[0.2em] text-[#F5531A] text-sm">
            Start here
          </p>
          <h2 className="font-condensed font-black uppercase text-3xl md:text-5xl text-gray-900 mt-4 max-w-3xl">
            Pick the product. The engine is already running.
          </h2>
          <p className="text-lg text-gray-600 mt-5 max-w-3xl">
            Both products run on the same platform, so neither is a bet on the other.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-14">
            {family.map((p) => (
              <Link
                key={p.name}
                href={p.href}
                {...(p.internal ? {} : { target: '_blank', rel: 'noopener' })}
                className="border border-gray-200 rounded-2xl p-8 hover:border-orange-400/60 hover:shadow-lg transition-all block"
              >
                <h3 className="font-condensed font-black uppercase text-2xl text-gray-900">
                  {p.name}
                </h3>
                <p className="text-sm font-medium text-gray-400 mt-2">{p.domain}</p>
                <span className="inline-flex items-center gap-2 mt-6 font-semibold text-[#F5531A]">
                  {p.internal ? 'Read more' : 'Visit'}
                  <span aria-hidden="true">&rarr;</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
