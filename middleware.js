import { NextResponse } from 'next/server';

// Detects requests to the Brazilian Portuguese subdomain (pt-br.*)
// and internally rewrites them to the /pt-br/* path tree so the same
// Next.js deployment can serve both the main domain and the pt-br
// subdomain without any DNS-level routing changes.
//
// Examples (assuming DNS points pt-br.soulprintengine.ai at this app):
//   pt-br.soulprintengine.ai/          -> /pt-br
//   pt-br.soulprintengine.ai/waitlist  -> /pt-br/waitlist
//   pt-br.soulprintengine.ai/admin     -> /pt-br/admin
//
// API routes and Next.js internals are passed through untouched so
// client fetches to /api/* continue to work from the subdomain.
export function middleware(request) {
  const url = request.nextUrl;
  const hostname = (request.headers.get('host') || '').toLowerCase();
  const pathname = url.pathname;

  const isPtBrSubdomain = hostname.startsWith('pt-br.');
  const isAlreadyPtBrPath = pathname === '/pt-br' || pathname.startsWith('/pt-br/');
  const isApiRoute = pathname.startsWith('/api');
  const isNextInternal = pathname.startsWith('/_next') || pathname === '/favicon.ico';

  if (isPtBrSubdomain && !isAlreadyPtBrPath && !isApiRoute && !isNextInternal) {
    const rewritten = url.clone();
    rewritten.pathname = pathname === '/' ? '/pt-br' : `/pt-br${pathname}`;
    return NextResponse.rewrite(rewritten);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match every path except Next.js static assets and files with extensions
    // (images, fonts, etc. served from /public).
    '/((?!_next/static|_next/image|.*\\..*).*)',
  ],
};
