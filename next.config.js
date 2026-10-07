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
