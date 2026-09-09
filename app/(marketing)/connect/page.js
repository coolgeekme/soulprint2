import Link from 'next/link';
import { Chrome, TerminalSquare, ArrowRight, CheckCircle2, Sparkles, MessageSquare } from 'lucide-react';

const extSteps = [
  {
    t: 'Install the extension',
    b: 'Add SoulPrint for Chrome from the Chrome Web Store — one click, no code.',
  },
  {
    t: 'Sign in',
    b: 'Connect your SoulPrint account inside the extension. Your profile and memories sync.',
  },
  {
    t: 'Chat normally',
    b: 'Open ChatGPT or Claude and just talk. Context is injected automatically — no commands.',
  },
];

const mcpHarnesses = [
  {
    name: 'Claude Code',
    cmd: 'claude mcp add soulprint -- uvx soulprint-mcp',
  },
  {
    name: 'Codex',
    cmd: '# ~/.codex/config.toml\n[mcp_servers.soulprint]\ncommand = "uvx"\nargs = ["soulprint-mcp"]',
  },
  {
    name: 'Cursor',
    cmd: '// .cursor/mcp.json\n{ "mcpServers": { "soulprint": {\n  "command": "uvx", "args": ["soulprint-mcp"] } } }',
  },
  {
    name: 'Hermes',
    cmd: 'hermes mcp add soulprint --command "soulprint-mcp"',
  },
];

const mcpTools = [
  'soulprint_get_profile',
  'soulprint_get_memories',
  'soulprint_get_context',
  'soulprint_set_imprint',
  'soulprint_add_memory',
];

function CodeBlock({ code }) {
  return (
    <pre className="bg-[#f8fafc] border border-gray-200 text-gray-800 text-[13px] leading-relaxed rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono">
      <code>{code}</code>
    </pre>
  );
}

export default function Connect() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <p className="font-condensed font-bold uppercase tracking-[0.3em] text-orange-600 text-sm text-center mb-3">
        Connect
      </p>
      <h1 className="font-condensed font-black uppercase text-center text-gray-900 text-4xl md:text-6xl mb-5">
        Bring your SoulPrint to life
      </h1>
      <p className="text-gray-600 text-lg text-center max-w-2xl mx-auto mb-16">
        One passport, two doors. Your SoulPrint — identity, memory, and context — lives in your
        account. These are just the ways in, so pick the one that matches how you use AI. You
        don&rsquo;t need both, and everything you teach it through one door is already waiting
        through the other.
      </p>

      {/* ── OPTION 1: EXTENSION ── */}
      <div className="bg-white border border-gray-200 rounded-3xl p-8 md:p-10 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Chrome size={24} />
            </div>
            <div>
              <h2 className="font-condensed font-black uppercase text-2xl text-gray-900">
                Chat in the browser
              </h2>
              <p className="text-gray-500 text-sm">Easiest path — no terminal required.</p>
            </div>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border bg-amber-50 text-amber-600 border-amber-200 self-center">
            Chrome Web Store · Coming Soon
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-6">
          {extSteps.map((s, i) => (
            <div key={s.t} className="bg-[#f8fafc] rounded-2xl p-5">
              <span className="font-condensed font-black text-orange-500/40 text-3xl leading-none">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-condensed font-bold uppercase text-lg text-gray-900 mt-2 mb-1">
                {s.t}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">{s.b}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            Works in ChatGPT and Claude today. Gemini and Perplexity on the way.
          </p>
          <Link
            href="/early-access"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
          >
            Get early access <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* ── OPTION 2: MCP ── */}
      <div className="bg-white border border-gray-200 rounded-3xl p-8 md:p-10 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <TerminalSquare size={24} />
            </div>
            <div>
              <h2 className="font-condensed font-black uppercase text-2xl text-gray-900">
                Code with AI agents
              </h2>
              <p className="text-gray-500 text-sm">
                Hermes, Claude Code, Codex, Cursor — live today via the SoulPrint MCP server.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border bg-green-50 text-green-600 border-green-200 self-center">
            Live now
          </span>
        </div>

        <ol className="space-y-5 mt-6 mb-8">
          <li className="flex gap-4">
            <span className="font-condensed font-black text-orange-500/50 text-2xl leading-none pt-0.5 shrink-0">
              01
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-condensed font-bold uppercase text-lg text-gray-900 mb-2">
                Install the server
              </h3>
              <CodeBlock code={'pip install soulprint-mcp\n# or\nuvx soulprint-mcp'} />
            </div>
          </li>
          <li className="flex gap-4">
            <span className="font-condensed font-black text-orange-500/50 text-2xl leading-none pt-0.5 shrink-0">
              02
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-condensed font-bold uppercase text-lg text-gray-900 mb-2">
                Sign in once
              </h3>
              <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                Run the one-time login — approve in your browser and the token is cached locally.
                Nothing leaves your machine except calls to your SoulPrint.
              </p>
              <CodeBlock code={'soulprint-mcp login'} />
            </div>
          </li>
          <li className="flex gap-4">
            <span className="font-condensed font-black text-orange-500/50 text-2xl leading-none pt-0.5 shrink-0">
              03
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-condensed font-bold uppercase text-lg text-gray-900 mb-2">
                Add it to your agent
              </h3>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                {mcpHarnesses.map((h) => (
                  <div key={h.name} className="bg-[#f8fafc] border border-gray-200 rounded-xl p-4">
                    <p className="font-semibold text-sm text-gray-800 mb-2">{h.name}</p>
                    <CodeBlock code={h.cmd} />
                  </div>
                ))}
              </div>
            </div>
          </li>
        </ol>

        <div className="bg-[#f8fafc] border border-gray-200 rounded-2xl p-5 mb-6">
          <p className="font-condensed font-bold uppercase tracking-[0.18em] text-orange-600 text-xs mb-3">
            What your agent can do
          </p>
          <div className="flex flex-wrap gap-2">
            {mcpTools.map((t) => (
              <code key={t} className="text-[12px] px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-700 font-mono">
                {t}
              </code>
            ))}
            <code className="text-[12px] px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-500 font-mono">
              and more
            </code>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-gray-600 text-sm flex items-center gap-2 leading-relaxed">
            <Sparkles size={15} className="text-orange-500 shrink-0" />
            MCP-over-HTTP clients (like the ChatGPT app): point them at{' '}
            <code className="text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded text-[12px] font-mono">
              https://soulprintengine.ai/api/mcp
            </code>
          </p>
          <Link
            href="https://github.com/coolgeekme/soulprint-mcp"
            className="inline-flex items-center gap-2 text-gray-800 border border-gray-300 hover:border-orange-400 hover:text-orange-600 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Read the docs <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* ── OPTION 3: ChatGPT & Claude app connectors ── */}
      <div className="bg-white border border-gray-200 rounded-3xl p-8 md:p-10 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <MessageSquare size={24} />
            </div>
            <div>
              <h2 className="font-condensed font-black uppercase text-2xl text-gray-900">
                Inside the ChatGPT &amp; Claude apps
              </h2>
              <p className="text-gray-500 text-sm">
                Prefer working in the apps themselves? Connect the same SoulPrint tools there.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border bg-green-50 text-green-600 border-green-200 self-center">
            Live now
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* ChatGPT card */}
          <div className="bg-[#f8fafc] border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/chatgpt.svg" alt="ChatGPT logo" className="h-7 w-7 object-contain" />
              <h3 className="font-condensed font-bold uppercase text-lg text-gray-900">ChatGPT.com</h3>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">1</span>
                <span>
                  <strong>One-time prerequisite:</strong> enable Developer Mode &mdash; Settings
                  &rarr; Security and login &rarr; Developer mode <em>on</em>. Without it, ChatGPT
                  shows &ldquo;Developer mode is required&rdquo; when you add the server.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">2</span>
                <span>
                  Open <strong>chatgpt.com</strong> and click <strong>Plugins</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">3</span>
                <span>
                  Click <strong>Create app</strong>, then <strong>New Plugin&hellip;</strong>
                  (lands in Settings &rarr; Connectors).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">4</span>
                <span>
                  Paste the server URL:{' '}
                  <code className="font-mono text-[12px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-800">
                    https://soulprintengine.ai/api/mcp
                  </code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">5</span>
                <span>
                  Check <strong>&ldquo;I understand and want to continue&hellip;&rdquo;</strong>{' '}
                  &rarr; click <strong>Create</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">6</span>
                <span>
                  Sign in with <strong>SoulPrint MCP</strong> when it prompts.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">7</span>
                <span>
                  Open the app&rsquo;s <strong>Permissions</strong> &rarr;{' '}
                  <strong>Allow all actions</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">8</span>
                <span>
                  Start a <strong>new chat</strong> &mdash; your SoulPrint tools are ready.
                </span>
              </li>
            </ol>
          </div>

          {/* Claude card */}
          <div className="bg-[#f8fafc] border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/claude.svg" alt="Claude logo" className="h-7 w-7 object-contain" />
              <h3 className="font-condensed font-bold uppercase text-lg text-gray-900">Claude.ai</h3>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">1</span>
                <span>
                  Open <strong>claude.ai</strong> (a new chat is fine) and click your{' '}
                  <strong>profile icon</strong> in the bottom-left.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">2</span>
                <span>
                  Click <strong>Settings</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">3</span>
                <span>
                  Click <strong>Connectors</strong> &rarr; <strong>Add</strong> &rarr;{' '}
                  <strong>Add custom connector</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">4</span>
                <span>
                  Paste the server URL:{' '}
                  <code className="font-mono text-[12px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-800">
                    https://soulprintengine.ai/api/mcp
                  </code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">5</span>
                <span>
                  Click <strong>Continue</strong>, then <strong>Connect</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">6</span>
                <span>
                  Authorize with <strong>SoulPrint MCP</strong> when it prompts.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-condensed font-black text-orange-500/60 shrink-0">7</span>
                <span>
                  Start a <strong>new chat</strong> &mdash; your SoulPrint tools are ready.
                </span>
              </li>
            </ol>
          </div>
        </div>

        <p className="text-gray-500 text-sm mt-5 flex items-center gap-2 leading-relaxed">
          <CheckCircle2 size={15} className="text-green-600 shrink-0" />
          Running the extension and the app connector together is fine &mdash; the extension
          detects when SoulPrint MCP is connected and stays in the background, so context is
          never injected twice.
        </p>
      </div>

      {/* CHAT + FOUNDRY BAND */}
      <div className="bg-[#f8fafc] border border-gray-200 rounded-3xl p-8 md:p-10 mb-10">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="font-condensed font-black uppercase text-2xl text-gray-900 mb-2">
              Prefer to skip ChatGPT and Claude?
            </h2>
            <p className="text-gray-600 text-base leading-relaxed">
              A simple built-in chat is included with your account at{' '}
              <Link href="/chat" className="text-orange-600 font-semibold hover:text-orange-700 transition-colors">
                soulprintengine.ai/chat
              </Link>{' '}
              &mdash; no other AI tools needed.
            </p>
          </div>
          <div>
            <h2 className="font-condensed font-black uppercase text-2xl text-gray-900 mb-2">
              Want images, video, files, or PDFs?
            </h2>
            <p className="text-gray-600 text-base leading-relaxed">
              That is The Foundry&rsquo;s job — file and PDF generation too.{' '}
              <a
                href="https://foundryagents.ai"
                target="_blank"
                rel="noreferrer"
                className="text-orange-600 font-semibold hover:text-orange-700 transition-colors"
              >
                foundryagents.ai
              </a>{' '}
              handles media generation and creative production.
            </p>
          </div>
        </div>
      </div>

      {/* ── BOTTOM CTA ── */}
      <div className="text-center mt-12">
        <h2 className="font-condensed font-black uppercase text-3xl md:text-4xl text-gray-900 mb-6">
          Start with one. It follows you everywhere.
        </h2>
        <Link
          href="/auth"
          className="inline-block bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-md shadow-orange-500/20"
        >
          Get Started Free
        </Link>
        <p className="text-gray-400 text-sm mt-3">No credit card required.</p>
      </div>
    </div>
  );
}
