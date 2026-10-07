const nextConfig = {
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
  // The two products each live on their own domain. These paths exist only so a
  // URL-guesser (or an old link) lands somewhere real instead of a 404.
  //
  // `/passport` is deliberately ABSENT: it has a real route
  // (app/(marketing)/passport/page.js) and, until soulprintpassport.ai is live,
  // that page is the only working Passport destination. Redirecting it now would
  // send visitors to a domain that does not answer. Add it once the domain is
  // verified — and remember redirects() runs BEFORE filesystem routes, so adding
  // it while the page still exists would silently make the page unreachable.
  async redirects() {
    return [
      { source: '/kidsprint', destination: 'https://kidsprint.ai', permanent: true },
      { source: '/kidsprint/:path*', destination: 'https://kidsprint.ai/:path*', permanent: true },
    ];
  },
  // NOTE: the `/passport` -> `/` redirects that used to live here were removed when the
  // real /passport route was added (app/(marketing)/passport/page.js). Next.js resolves
  // redirects() BEFORE filesystem routes, so leaving them in would have made the new page
  // permanently unreachable — it would 308 to `/` with no error anywhere.
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
