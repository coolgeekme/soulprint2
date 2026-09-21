import Link from 'next/link';
import { Check } from 'lucide-react';

const passportFeatures = [
  'SoulPrint across ChatGPT, Claude, and agents via MCP',
  'Unlimited platform connections',
  'Cloud memory with auto-extraction',
  'Custom Imprints',
  'History import & advanced search',
  'Everything syncs across every AI you use',
];

const extensionFeatures = [
  'Context injection into ChatGPT and Claude',
  'Local memories, stored on your device',
  'No account or credit card required',
  'Free forever',
];

export default function Pricing() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm text-center mb-3">
        Pricing
      </p>
      <h1 className="font-condensed font-black uppercase text-center text-gray-900 text-4xl md:text-6xl mb-5">
        Free while we&apos;re in beta.
      </h1>
      <p className="text-gray-600 text-lg text-center max-w-2xl mx-auto mb-14">
        SoulPrint Passport is in beta, so everything is free right now — no credit card, no
        tiers, no upsells. When beta ends, we&apos;ll tell you well before anything changes.
      </p>

      <div className="grid md:grid-cols-2 gap-5 items-stretch">
        {/* Free extension */}
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm flex flex-col">
          <h2 className="font-condensed font-black uppercase text-xl text-gray-900">
            SoulPrint Extension
          </h2>
          <p className="text-gray-500 text-sm mt-1 mb-5">Works on its own</p>
          <p className="text-5xl font-black text-gray-900 mb-1">Free</p>
          <p className="text-gray-600 text-sm mb-7">forever — no account needed</p>
          <ul className="space-y-3 mb-8 flex-1">
            {extensionFeatures.map((f) => (
              <li key={f} className="flex items-start gap-3 text-gray-700 text-sm">
                <Check size={17} className="text-green-600 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href="https://soulprintengine.ai"
            className="text-center border-2 border-gray-200 hover:border-orange-400 hover:text-orange-600 text-gray-800 font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
          >
            Get the free extension
          </a>
        </div>

        {/* Passport */}
        <div className="bg-white border-2 border-orange-500/50 rounded-3xl p-8 shadow-md flex flex-col relative overflow-hidden">
          <span className="absolute top-5 right-5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
            Beta — everything included
          </span>
          <h2 className="font-condensed font-black uppercase text-xl text-gray-900">
            SoulPrint Passport
          </h2>
          <p className="text-gray-500 text-sm mt-1 mb-5">Everything, while it&apos;s in beta</p>
          <p className="text-5xl font-black text-gray-900 mb-1">
            Free
          </p>
          <p className="text-gray-600 text-sm mb-7">
            during beta — no card, no commitment
          </p>
          <ul className="space-y-3 mb-8 flex-1">
            {passportFeatures.map((f) => (
              <li key={f} className="flex items-start gap-3 text-gray-700 text-sm">
                <Check size={17} className="text-orange-500 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/auth"
            className="text-center bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-all shadow-md shadow-orange-500/20"
          >
            Start free
          </Link>
        </div>
      </div>

      <div className="mt-10 max-w-2xl mx-auto">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <h3 className="font-condensed font-black uppercase text-sm text-gray-900 mb-3 tracking-wide">
            What happens when beta ends?
          </h3>
          <p className="text-gray-600 text-sm">
            We&apos;ll decide on pricing once beta tells us what&apos;s actually worth paying
            for. Beta users will hear from us first, and well before anything changes — nobody
            gets surprised by a bill. The extension stays free forever either way.
          </p>
        </div>
      </div>

      <div className="mt-10 text-center">
        <p className="text-gray-500 text-sm">
          The free extension stays free forever. Want to try first? Install the extension, feel
          the difference, and add Passport when you want your SoulPrint everywhere.
        </p>
        <p className="text-gray-400 text-sm mt-4">
          Looking for images, video, files, or PDFs? That is{' '}
          <a
            href="https://foundryagents.ai"
            target="_blank"
            rel="noreferrer"
            className="text-orange-600 font-semibold hover:text-orange-700 transition-colors"
          >
            The Foundry
          </a>
          .
        </p>
        <p className="text-gray-400 text-sm mt-8">
          Questions? Check the{' '}
          <Link
            href="/faq"
            className="text-orange-600 font-semibold hover:text-orange-700 transition-colors"
          >
            FAQ
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
