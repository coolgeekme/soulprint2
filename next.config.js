// Capture the commit at BUILD time. The running server cannot know its own git state (the
// container may have no .git, and a stale process keeps serving regardless), so the value is
// stamped here and reported by /api/health.
const { execSync } = require('child_process');
let BUILD_SHA = 'unknown';
let BUILD_REF = 'none';
let BUILD_TIME = new Date().toISOString();
// Try the REMOTE ref first. The deploy flow here does `git checkout <remote>/main -- .`,
// which updates the working tree WITHOUT moving HEAD — so `git rev-parse HEAD` reports the
// previous commit and the stamp would confidently lie. That is worse than no stamp at all.
try {
  const candidates = ['github/main', 'origin/main', 'HEAD'];
  for (const ref of candidates) {
    try {
      BUILD_SHA = execSync(`git rev-parse --short ${ref}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      BUILD_REF = ref;
      break;
    } catch { /* try the next ref */ }
  }
} catch { /* no git in the build image — 'unknown' is honest */ }

const nextConfig = {
  env: { BUILD_SHA, BUILD_TIME, BUILD_REF },
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    // Remove if not using Server Components
    serverComponentsExternalPackages: ['mongodb'],
  },
  webpack(config, { dev }) {
    if (dev) {
      // Disable persistent filesystem cache to prevent corruption 
      // with large API route files (26k+ lines)
      config.cache = false;
      
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  // /connect now lives on the product domain. The page describes how to connect
  // YOUR SoulPrint — that is product documentation, so it belongs on
  // soulprintpassport.ai, not on the engine's marketing site.
  //
  // statusCode 301 rather than `permanent: true` (which emits a 308): both are
  // permanent, and for a GET-only marketing page they behave identically, but
  // 301 is what was asked for and is unambiguous when checked.
  //
  // Redirects run BEFORE filesystem routes, so this shadows any /connect page
  // that exists under app/. The old page has been deleted rather than left in
  // place as unreachable dead code — re-adding it without removing this entry
  // would look correct in the route table and silently never render.
  async redirects() {
    return [
      {
        source: '/connect',
        destination: 'https://soulprintpassport.ai/connect',
        statusCode: 301,
      },
      // /pricing prices SoulPrint Passport only. It is a Passport surface, so it
      // belongs on the product domain next to /connect — not on the engine.
      {
        source: '/pricing',
        destination: 'https://soulprintpassport.ai/pricing',
        statusCode: 301,
      },
      // Phase 1 of the content move: the marketing surface belongs on the product
      // domain. /faq was ported to soulprintpassport.ai/faq and verified live (200,
      // canonical pointing at the passport host, 8 Q&As, FAQPage JSON-LD) BEFORE
      // this redirect was added. The route stays in app/(marketing)/faq/page.js so
      // removing this entry restores it instantly.
      // See /root/projects/soulprint-domain-migration/PHASE1-REDIRECT-MAP.md
      {
        source: '/faq',
        destination: 'https://soulprintpassport.ai/faq',
        statusCode: 301,
      },
      // Remaining phase-1 content routes. Each passport destination was ported,
      // validated and verified 200 before this block was written:
      // /how-it-works /features /integrations /security /contact
      // Contact stays a form — it posts to this domain's /api/contact, which does
      // NOT move; only the page shell lives on passport now.
      // Rollback: delete any entry below and that engine page serves again.
      {
        source: '/how-it-works',
        destination: 'https://soulprintpassport.ai/how-it-works',
        statusCode: 301,
      },
      {
        source: '/features',
        destination: 'https://soulprintpassport.ai/features',
        statusCode: 301,
      },
      {
        source: '/integrations',
        destination: 'https://soulprintpassport.ai/integrations',
        statusCode: 301,
      },
      {
        source: '/security',
        destination: 'https://soulprintpassport.ai/security',
        statusCode: 301,
      },
      {
        source: '/contact',
        destination: 'https://soulprintpassport.ai/contact',
        statusCode: 301,
      },
    ];
  },
  // NOTE: a /kidsprint -> kidsprint.ai redirect used to live here. It was removed
  // because KidSprint is in development and we want visitors to land on an
  // in-site explainer rather than being handed off to a product that isn't
  // ready. The path is now a real route: app/(marketing)/kidsprint/page.js.
  //
  // Redirects run BEFORE filesystem routes, so re-adding it would silently make
  // that page unreachable.
  //
  // `/passport` is likewise absent for the same class of reason: it has a real
  // route and, until soulprintpassport.ai answers, that page is the only working
  // Passport destination.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
          // Security headers to pass security scans
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=*, microphone=*, geolocation=(self), payment=()" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
