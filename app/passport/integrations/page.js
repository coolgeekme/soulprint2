import Link from 'next/link';
import { TerminalSquare } from 'lucide-react';

const groups = [
  {
    label: 'Chat AI',
    sub: 'Works in the tools you already use — context injected on every message.',
    items: [
      { name: 'ChatGPT', logo: '/logos/chatgpt.svg', status: 'Connected' },
      { name: 'Claude', logo: '/logos/claude.svg', status: 'Connected' },
    ],
  },
  {
    label: 'Agents & Dev Tools',
    sub: 'Connect through the SoulPrint MCP server — your identity becomes a native tool.',
    items: [
      { name: 'Hermes', logo: '/logos/hermes.png', status: 'Live · MCP' },
      { name: 'Claude Code', logo: '/logos/claude.svg', status: 'Live · MCP' },
      { name: 'Codex', logo: '/logos/codex.png', status: 'Live · MCP' },
      { name: 'Cursor', logo: '/logos/cursor.svg', status: 'Live · MCP' },
    ],
  },
  {
    label: 'Coming Soon',
    sub: 'Native chat support is in active development.',
    items: [
      { name: 'Gemini', logo: '/logos/gemini.svg', status: 'Soon' },
      { name: 'Perplexity', logo: '/logos/perplexity.svg', status: 'Soon' },
    ],
  },
];

export default function Integrations() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm text-center mb-3">
        Integrations
      </p>
      <h1 className="font-condensed font-black uppercase text-center text-gray-900 text-4xl md:text-6xl mb-6">
        Every AI. One you.
      </h1>
      <p className="text-gray-600 text-lg text-center max-w-2xl mx-auto mb-16">
        Bring your SoulPrint to the tools you already use — no new apps, no migration, no lock-in.
      </p>

      {groups.map((g) => (
        <div key={g.label} className="mb-14">
          <h2 className="font-condensed font-black uppercase text-2xl text-gray-900 mb-1">
            {g.label}
          </h2>
          <p className="text-gray-500 text-sm mb-6">{g.sub}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {g.items.map((it) => (
              <div
                key={it.name}
                className="bg-white border border-gray-200 hover:border-orange-400/60 rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors shadow-sm"
              >
                <div className="h-11 flex items-center justify-center">
                  {it.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.logo} alt={`${it.name} logo`} className="h-9 w-9 object-contain" />
                  ) : (
                    <span className="h-9 w-9 rounded-lg bg-gray-100 border border-gray-200" />
                  )}
                </div>
                <span className="font-semibold text-gray-900 text-sm">{it.name}</span>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
                    it.status === 'Soon'
                      ? 'bg-amber-50 text-amber-600 border-amber-200'
                      : 'bg-green-50 text-green-600 border-green-200'
                  }`}
                >
                  {it.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-[#f8fafc] border border-gray-200 rounded-2xl p-8">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
            <TerminalSquare size={20} />
          </div>
          <div>
            <h3 className="font-condensed font-black uppercase text-xl text-gray-900 mb-1">
              Using an MCP-compatible agent?
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Hermes, Claude Code, Codex, Cursor, and every MCP-compatible agent can call your
              SoulPrint directly — profile, memories, and Imprints as native tools. The SoulPrint
              MCP server runs locally and connects in minutes.
            </p>
            <Link
              href="/passport/connect"
              className="inline-flex items-center gap-2 mt-4 text-orange-600 font-semibold text-sm hover:text-orange-700 transition-colors"
            >
              Full setup guide <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
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
