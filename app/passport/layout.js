import Link from 'next/link';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export const metadata = {
  title: 'Your SoulPrint Passport — SoulPrint Engine',
  description:
    'Your SoulPrint Passport: one persistent layer of you — identity, memory, context — that travels with you across every AI you use.',
};

const navLinks = [
  { href: '/passport/how-it-works', label: 'How It Works' },
  { href: '/passport/integrations', label: 'Integrations' },
  { href: '/passport/features', label: 'Features' },
  { href: '/passport/faq', label: 'FAQ' },
];

const footerLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
];

function Wordmark() {
  return (
    <span className="flex flex-col leading-none">
      <span className="font-condensed font-black uppercase tracking-[0.06em] text-gray-900 text-[17px]">
        SoulPrint
      </span>
      <span className="font-condensed font-semibold uppercase tracking-[0.42em] text-orange-600 text-[9px]">
        Engine
      </span>
    </span>
  );
}

export default function PassportLayout({ children }) {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* NAV */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/passport" className="flex items-center gap-2.5">
            <SoulPrintLogo size={30} />
            <Wordmark />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/auth"
              className="text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth"
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile menu (CSS-only via details) */}
          <details className="md:hidden relative">
            <summary className="list-none flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 cursor-pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" x2="20" y1="7" y2="7" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="17" y2="17" />
              </svg>
            </summary>
            <div className="absolute right-0 top-12 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-3 space-y-1">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/auth"
                className="block px-3 py-2 rounded-lg text-sm text-white font-semibold bg-gradient-to-r from-orange-500 to-red-500 mt-2 text-center"
              >
                Get Started Free
              </Link>
            </div>
          </details>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      {/* FOOTER */}
      <footer className="bg-[#f0f0f0] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <SoulPrintLogo size={24} />
            <Wordmark />
          </div>
          <nav className="flex items-center gap-6 text-sm text-gray-600">
            {footerLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-gray-900 transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-sm text-gray-500">&copy; 2026 ArcheForge LLC</p>
        </div>
      </footer>
    </div>
  );
}
