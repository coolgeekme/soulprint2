import Link from 'next/link';
import SoulPrintLogo from '@/components/SoulPrintLogo';

// No metadata here on purpose. This layout sits directly under app/layout.js,
// so a title set at this level would be stamped onto every marketing page —
// which is exactly the duplicate-metadata problem we are fixing. Each page in
// this group exports its own title and description via lib/seo.js instead.

// SPE is the parent brand now, so the chrome leads with the PRODUCTS, not the
// app's own marketing pages. Passport and KidSprint live on their own domains.
const navLinks = [
  // Internal while soulprintpassport.ai has no DNS: sending visitors to a
  // parked domain produced a blank page. The in-site page covers the same
  // ground, so nobody leaves to find nothing.
  { href: '/passport', label: 'Passport' },
  // Internal: KidSprint is in development, so it has an explainer on this
  // site rather than handing visitors off to a product that is not ready.
  { href: '/kidsprint', label: 'KidSprint' },
  // Foundry is powered by SoulPrint Engine (its own site says so), so it is a
  // product built on the engine alongside Passport and KidSprint. Its own site
  // is live, but the nav stays on-site so all three products are reached the
  // same way; /foundry links out to foundryagents.ai in several places.
  { href: '/foundry', label: 'Foundry' },
  // No bare "Pricing" here. Pricing on this domain was Passport's, never the
  // engine's, and it now lives on the product's own site — as does /connect. A
  // generic Pricing entry in the PARENT nav would imply the parent is for sale,
  // which the FAQ flatly denies. Passport pricing stays in the footer instead,
  // labelled explicitly and pointed at soulprintpassport.ai.
  { href: '/faq', label: 'FAQ' },
  // The blog has always existed at /blog but was never linked from the
  // marketing site — reachable only by typing the URL, from the chat sidebar,
  // or via the sitemap. Surfacing it here is the whole fix.
  { href: '/blog', label: 'Blog' },
];

const footerLinks = [
  { href: '/auth', label: 'SoulPrint Passport sign in' },
  { href: 'https://soulprintpassport.ai/pricing', label: 'Passport pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
];

// The products live on their own domains. They belong in the footer as well as
// the nav — a visitor who scrolls to the bottom should still be able to leave
// for a product without hunting back up to the header.
const footerProducts = [
  { href: '/passport', label: 'SoulPrint Passport' },
  { href: '/kidsprint', label: 'KidSprint' },
  { href: '/foundry', label: 'Foundry' },
];

// Foundry's product site, kept separate so the footer can still offer a direct
// route to the live app rather than only the explainer.
// Both product sites, so the footer can reach the live apps directly as well
// as their explainers above.
const footerExternal = [
  { href: 'https://soulprintpassport.ai', label: 'soulprintpassport.ai' },
  { href: 'https://foundryagents.ai', label: 'foundryagents.ai' },
];

function Wordmark() {
  return (
    <span className="flex flex-col leading-none">
      {/* Brand guide: wordmark is Inter 800 at -0.025em tracking, with "Soul" in
          ink and "Print" in orange. Never set in a single colour. */}
      <span
        style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, letterSpacing: '-0.025em' }}
        className="text-[17px]"
      >
        <span style={{ color: '#0A1C2D' }}>Soul</span>
        <span style={{ color: '#F5531A' }}>Print</span>
      </span>
      {/* Subline is Inter 700 at 0.34em tracking and sits in ink, not orange. */}
      <span
        style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700, letterSpacing: '0.34em', color: '#0A1C2D' }}
        className="uppercase text-[9px] mt-[3px]"
      >
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
          <Link href="/" className="flex items-center gap-2.5">
            <SoulPrintLogo variant="ink" size={30} />
            <Wordmark />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((l) =>
              l.external ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener"
                  className="text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
                >
                  {l.label}
                </Link>
              )
            )}
          </div>

          {/* Discreet sign-in only. SPE is the parent brand, not a product, so the
              loud "Get Started" CTA belongs on the product sites. This stays so
              existing users landing on the engine domain are never stranded.

              Labelled "Passport Sign In", not "Sign In": /auth is Passport's door
              and nothing else's, so a generic label implied the engine had
              accounts of its own. "Passport" rather than the full product name
              because this sits in the nav beside a "Passport" link already. */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/auth"
              className="text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Passport Sign In
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
              {navLinks.map((l) =>
                l.external ? (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener"
                    className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    {l.label}
                  </Link>
                )
              )}
              <Link
                href="/auth"
                className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium border-t border-gray-100 mt-2 pt-3"
              >
                Passport Sign In
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
            <SoulPrintLogo variant="ink" size={24} />
            <Wordmark />
          </div>
          <nav className="flex items-center gap-6 flex-wrap justify-center text-sm text-gray-600">
            {footerProducts.map((l) =>
              /^https?:/.test(l.href) ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className="font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  {l.label}
                </Link>
              )
            )}
            <span className="hidden sm:block w-px h-4 bg-gray-300" aria-hidden="true" />
            {footerLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-gray-900 transition-colors">
                {l.label}
              </Link>
            ))}
            {footerExternal.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-900 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <p className="text-sm text-gray-500">&copy; 2026 ArcheForge LLC</p>
        </div>
      </footer>
    </div>
  );
}
