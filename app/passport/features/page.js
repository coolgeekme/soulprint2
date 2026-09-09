import Link from 'next/link';

const features = [
  {
    icon: '✦',
    title: 'Knows who you are',
    body: 'A structured assessment builds your profile — personality, communication style, values. The layer that makes every AI finally feel like it gets you.',
  },
  {
    icon: '✧',
    title: 'Remembers what matters',
    body: 'Durable memories with provenance — see where a fact came from, correct it, keep it yours. Captured in ChatGPT, available in Claude.',
  },
  {
    icon: '↻',
    title: 'Learns as you talk',
    body: 'Auto-extraction captures new facts from your conversations. The memory builds itself while you just chat.',
  },
  {
    icon: '◈',
    title: 'Imprints',
    body: 'Switch personas — work mode, coaching mode, creative mode. Your AI takes on the role you set, with the voice and priorities to match.',
  },
  {
    icon: '⇄',
    title: 'Portable by design',
    body: 'Export, import, move freely between assistants. No lock-in, ever. Your memory goes where you go.',
  },
  {
    icon: '◆',
    title: 'Private by design',
    body: 'Your SoulPrint is yours, full stop. Provenance, correction, and control built into every memory — you decide what the AI knows.',
  },
  {
    icon: '◎',
    title: 'Chat with dynamic intelligence',
    body: 'Beyond the connectors: your SoulPrint also powers your own chat — an assistant that reasons with your live profile, memories, and Imprints in every reply.',
  },
];

export default function Features() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm text-center mb-3">
        Features
      </p>
      <h1 className="font-condensed font-black uppercase text-center text-gray-900 text-4xl md:text-6xl mb-6">
        More than memory. A model of you.
      </h1>
      <p className="text-gray-600 text-lg text-center max-w-2xl mx-auto mb-16">
        The engines that make one persistent you possible — everywhere you talk to AI.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f) => (
          <div
            key={f.title}
            className="bg-white border border-gray-200 hover:border-orange-400/60 rounded-2xl p-7 transition-colors shadow-sm"
          >
            <span className="text-orange-600 text-2xl leading-none select-none">{f.icon}</span>
            <h2 className="font-condensed font-black uppercase text-xl text-gray-900 mt-4 mb-2">
              {f.title}
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="text-center mt-14">
        <Link
          href="/auth"
          className="inline-block bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-md shadow-orange-500/20"
        >
          Get Started Free
        </Link>
      </div>
    </div>
  );
}
