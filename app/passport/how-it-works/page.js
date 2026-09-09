import Link from 'next/link';

const steps = [
  {
    n: '01',
    title: 'Build your SoulPrint',
    body: 'Take a short assessment. SoulPrint captures who you are — personality, communication style, values — into a profile you own.',
  },
  {
    n: '02',
    title: 'Connect your AI tools',
    body: 'Bring your SoulPrint to ChatGPT and Claude today. Gemini and Perplexity are on the way, and agents connect through MCP.',
  },
  {
    n: '03',
    title: 'Chat like always',
    body: 'Relevant memories and context are injected into every message automatically. No new app, no commands, no setup per chat.',
  },
  {
    n: '04',
    title: 'It remembers for you',
    body: 'After each reply, SoulPrint extracts durable facts — preferences, projects, people — with provenance, so you can see and correct everything it knows.',
  },
];

const flow = ['Identity', 'Memory', 'Context', 'Intelligence'];

export default function HowItWorks() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm text-center mb-3">
        How It Works
      </p>
      <h1 className="font-condensed font-black uppercase text-center text-gray-900 text-4xl md:text-6xl mb-6">
        One layer. Four steps.
      </h1>
      <p className="text-gray-600 text-lg text-center max-w-2xl mx-auto mb-16">
        Your SoulPrint is the persistent layer between you and every AI — built once, used everywhere.
      </p>

      <div className="space-y-5">
        {steps.map((s) => (
          <div
            key={s.n}
            className="flex gap-6 bg-white border border-gray-200 hover:border-orange-400/60 rounded-2xl p-6 md:p-8 transition-colors shadow-sm"
          >
            <span className="font-condensed font-black text-5xl text-orange-500/25 leading-none select-none">
              {s.n}
            </span>
            <div>
              <h2 className="font-condensed font-black uppercase text-2xl text-gray-900 mb-2">
                {s.title}
              </h2>
              <p className="text-gray-600 leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 bg-[#f8fafc] border border-gray-200 rounded-2xl p-8 text-center">
        <p className="font-condensed font-bold uppercase tracking-[0.22em] text-gray-400 text-xs mb-5">
          Old AI ends the conversation. SoulPrint starts it.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap text-sm font-semibold">
          {flow.map((f, i) => (
            <span key={f} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300 font-normal">→</span>}
              <span className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-800">
                {f}
              </span>
            </span>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-6">
          Portability doesn&rsquo;t mean every AI gives you the same answer. It means every AI
          starts with the same understanding of you.
        </p>
      </div>

      <div className="text-center mt-12">
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
