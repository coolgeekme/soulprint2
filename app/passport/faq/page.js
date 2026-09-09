import Link from 'next/link';

const faqs = [
  {
    q: 'What is a SoulPrint?',
    a: 'A SoulPrint is the persistent layer of you that AI uses to understand you: your identity profile, memories, communication style, and context. It belongs to you and travels with you across every AI tool you use.',
  },
  {
    q: 'Is the product actually live?',
    a: 'Yes. The Chrome extension works with ChatGPT and Claude today, and the SoulPrint MCP server connects agents like Hermes, Claude Code, Codex, and Cursor. Gemini and Perplexity support are on the way.',
  },
  {
    q: 'What are Imprints?',
    a: 'Imprints are modes your AI takes on — a supportive friend, a brutally honest advisor, a career coach, a senior code reviewer. Your identity and memories stay the same; the way the AI shows up changes with the moment. Custom Imprints are a Pro feature.',
  },
  {
    q: 'How is this different from built-in memory features?',
    a: 'Built-in memory is trapped inside one tool. If you switch tools, you start over. SoulPrint is portable — one identity, one memory store, available everywhere. You own it, you can export it, and you can correct anything it knows.',
  },
  {
    q: 'Do I still get the chat?',
    a: 'Yes. The built-in chat is there for people who want to skip ChatGPT and Claude entirely — simple conversation powered by your SoulPrint. It is chat-only: for images, video, or audio generation, use The Foundry at foundryagents.ai.',
  },
  {
    q: 'What does it cost?',
    a: 'Free to start — assessment, core memories, and two connected surfaces. Pro is $14/month (or $12/month billed annually) and unlocks the full experience: more memories, auto-extraction, custom Imprints, history import, and MCP access.',
  },
  {
    q: 'Is my data private?',
    a: 'Your memories are yours. Nothing is sold. You can review, correct, or delete any memory and export your data anytime. Your prompts are read locally to match context; when you connect an account, extracted memories sync over HTTPS so they are available across your devices.',
  },
  {
    q: 'Which plan should I start with?',
    a: 'Free. Connect two tools, build a few memories, and feel the difference. Upgrade when you want auto-extraction and the full experience.',
  },
];

export default function Faq() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm text-center mb-3">
        FAQ
      </p>
      <h1 className="font-condensed font-black uppercase text-center text-gray-900 text-4xl md:text-6xl mb-6">
        Straight answers
      </h1>
      <p className="text-gray-600 text-lg text-center max-w-2xl mx-auto mb-14">
        Everything you want to know about your SoulPrint Passport.
      </p>

      <div className="space-y-3">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="group bg-white border border-gray-200 rounded-xl px-6 py-5 open:shadow-sm"
          >
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-semibold text-gray-900">
              {f.q}
              <span className="text-orange-500 text-xl leading-none group-open:rotate-45 transition-transform shrink-0">
                +
              </span>
            </summary>
            <p className="text-gray-600 text-sm leading-relaxed mt-4">{f.a}</p>
          </details>
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
