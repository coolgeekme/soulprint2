import Link from 'next/link';
import { Chrome, Zap, MessageSquare, Rocket } from 'lucide-react';

const perks = [
  {
    icon: Zap,
    title: 'Skip the store wait',
    body: 'The Chrome Web Store listing takes time. Early access gets you the current build now, with direct install.',
  },
  {
    icon: MessageSquare,
    title: 'Shape what ships',
    body: 'You are the first people using it in the wild. Your feedback goes straight to the team.',
  },
  {
    icon: Rocket,
    title: 'First in line',
    body: 'When the listing goes live, early members stay ahead of the queue with everything already set up.',
  },
];

const steps = [
  { n: '01', t: 'Create your free account', b: 'Takes about a minute. No credit card.' },
  { n: '02', t: 'We approve and notify you', b: 'Early access is limited so the signal stays clean. Most approvals land within a day.' },
  { n: '03', t: 'Install and connect', b: 'You get a direct install link plus the two-minute setup. Then your SoulPrint works in ChatGPT and Claude.' },
];

export default function EarlyAccess() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm text-center mb-3">
        Early Access
      </p>
      <h1 className="font-condensed font-black uppercase text-center text-gray-900 text-4xl md:text-6xl mb-5">
        The extension, before the store
      </h1>
      <p className="text-gray-600 text-lg text-center max-w-2xl mx-auto mb-14">
        SoulPrint for Chrome is finishing Chrome Web Store review prep. Early access gets you the
        working build now — and a direct line to the team while we harden it.
      </p>

      {/* Perks */}
      <div className="grid md:grid-cols-3 gap-5 mb-16">
        {perks.map((p) => (
          <div
            key={p.title}
            className="bg-[#f8fafc] border border-gray-200 rounded-2xl p-6 text-center"
          >
            <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <p.icon size={22} />
            </div>
            <h2 className="font-condensed font-black uppercase text-lg text-gray-900 mb-2">
              {p.title}
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="bg-white border border-gray-200 rounded-3xl p-8 md:p-10 shadow-sm mb-10">
        <h2 className="font-condensed font-black uppercase text-2xl text-gray-900 mb-6">
          How it works
        </h2>
        <div className="space-y-6">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-5">
              <span className="font-condensed font-black text-orange-500/40 text-3xl leading-none select-none">
                {s.n}
              </span>
              <div>
                <h3 className="font-condensed font-bold uppercase text-lg text-gray-900 mb-1">
                  {s.t}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{s.b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-md shadow-orange-500/20"
        >
          <Chrome size={18} /> Join Early Access
        </Link>
        <p className="text-gray-400 text-sm mt-3">
          Free account &middot; No credit card &middot; Works in ChatGPT and Claude
        </p>
        <p className="text-gray-500 text-sm mt-6">
          Already approved?{' '}
          <Link
            href="/passport/connect"
            className="text-orange-600 font-semibold hover:text-orange-700 transition-colors"
          >
            Jump to the setup steps &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
