'use client';

import React from 'react';
import Link from 'next/link';
import { Archive, ArrowRight } from 'lucide-react';

// ── Archived: former pricing page ────────────────────────────────────────────
//
// This route held a full copy of the Engine pricing page (Free / Base $19 / Plus
// $39 / Power $97) with working Subscribe buttons that posted straight to
// /api/pricing/checkout.
//
// Two things made that unsafe once those tiers were retired:
//
//   1. The prices were wrong. Pricing moved to soulprintpassport.ai/pricing, and
//      this page went on advertising the retired tiers.
//   2. The Subscribe buttons were live. is_active: false hides a plan from
//      getPlans(), but checkout resolved plans through getPlan(), which does not
//      filter on the flag — so this page could still have sold a retired plan.
//      That hole is now closed in createCheckoutSession, which refuses an
//      inactive plan outright. This page was the surface; the API was the bug.
//
// The route is kept rather than deleted because /og-pages is referenced in
// robots.js and linked from /og-pages itself, but it no longer carries prices or
// any purchase path — everything routes to the product site.
//
// The sibling /og-pages/features and /og-pages/integrations archives have not
// been audited for the same problem. Check them before beta ends.

export default function ArchivedPricingPage() {
  return (
    <div className="min-h-screen bg-[#0B0F14] text-white flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Archive className="w-5 h-5 text-white/50" />
        </div>

        <h1 className="text-2xl font-semibold mb-3">This pricing page has moved</h1>

        <p className="text-white/60 leading-relaxed mb-8">
          This was an internal archived copy of the old SoulPrint Engine pricing.
          Passport pricing now lives on its own site, and the tiers shown here are
          no longer offered.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://soulprintpassport.ai/pricing"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition"
          >
            See current pricing
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-white/15 text-white/80 hover:bg-white/5 transition"
          >
            Back to chat
          </Link>
        </div>

        <p className="mt-8 text-sm text-white/35">
          Nothing here is purchasable. Current plans are on the Passport site.
        </p>
      </div>
    </div>
  );
}
