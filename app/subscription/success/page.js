'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION SUCCESS PAGE
// This page is shown after a new paid subscription checkout.
// Conversion tracking scripts can be added in the <Script> section below.
// ═══════════════════════════════════════════════════════════════

export default function SubscriptionSuccessPage() {
  return <Suspense fallback={null}><SubscriptionSuccessPageInner /></Suspense>;
}

function SubscriptionSuccessPageInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [purchase, setPurchase] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) { setLoading(false); return }
    fetch(`/api/pricing/checkout/verify?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setPurchase(data.purchase)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  const tierName = purchase?.plan_id === 'power' ? 'Power' : purchase?.plan_id === 'base' ? 'Base' : 'Pro'
  const billingLabel = purchase?.billing_period === 'annual' ? '/year' : '/month'

  const tierFeatures = {
    base: [
      'Unlimited AI chat messages',
      'Image generation (50 credits/mo)',
      'Voice conversations',
      'SoulPrint Memory & Persona',
      'Priority model routing',
    ],
    power: [
      'Everything in Base, plus:',
      'Unlimited image generation',
      'Video generation (100 credits/mo)',
      'Advanced voice modes',
      'API access & integrations',
      'Priority support',
    ],
  }

  const features = tierFeatures[purchase?.plan_id] || tierFeatures.base

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      {/* ══════════════════════════════════════════════════════════
          CONVERSION TRACKING SCRIPTS — Add your tracking pixels here
          This section only fires on subscription success pages.
          ══════════════════════════════════════════════════════════ */}
      {sessionId && purchase && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // ═══ CONVERSION TRACKING PLACEHOLDER ═══
              // Subscription conversion data:
              // window.__spSubscription = {
              //   session_id: "${sessionId}",
              //   plan: "${purchase?.plan_id || ''}",
              //   billing: "${purchase?.billing_period || ''}",
              //   amount: ${purchase?.amount || 0},
              //   currency: "usd"
              // };
              // Add your tracking scripts below (Google Ads, Meta Pixel, etc.)
            `
          }}
        />
      )}

      <div className="max-w-lg w-full text-center">
        {loading ? (
          <div className="animate-pulse">
            <div className="w-20 h-20 rounded-full bg-white/5 mx-auto mb-6" />
            <div className="h-8 bg-white/5 rounded-lg w-3/4 mx-auto mb-4" />
            <div className="h-4 bg-white/5 rounded w-1/2 mx-auto" />
          </div>
        ) : (
          <>
            {/* Celebration icon */}
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center mx-auto animate-bounce">
                <span className="text-5xl">🎉</span>
              </div>
              {/* Sparkle accents */}
              <div className="absolute top-0 left-1/2 -translate-x-12 -translate-y-2 text-orange-400 animate-pulse">✦</div>
              <div className="absolute top-2 right-1/2 translate-x-14 text-yellow-400 animate-pulse delay-300">✦</div>
              <div className="absolute bottom-0 left-1/2 -translate-x-8 translate-y-2 text-orange-300 animate-pulse delay-500">✦</div>
            </div>

            {/* Welcome message */}
            <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
              Welcome to <span className="text-orange-400">{tierName}</span>
            </h1>
            <p className="text-gray-400 text-base mb-8">
              Your subscription is active. You now have access to the full power of SoulPrint Engine.
            </p>

            {/* What's unlocked */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-8 text-left">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs">🔓</span>
                What You Unlocked
              </h2>
              <ul className="space-y-2.5">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-orange-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Purchase summary */}
            {purchase && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-8 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Plan</span>
                  <span className="text-white font-medium">{tierName} ({purchase.billing_period})</span>
                </div>
                <div className="flex justify-between mt-1.5">
                  <span>Amount</span>
                  <span className="text-white font-medium">${purchase.amount}{billingLabel}</span>
                </div>
                {purchase.discount_code && (
                  <div className="flex justify-between mt-1.5">
                    <span>Discount</span>
                    <span className="text-green-400 font-medium">{purchase.discount_code} applied ✓</span>
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-[1.02]"
            >
              Start Chatting
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>

            <p className="text-gray-600 text-xs mt-6">
              Your AI is ready and remembers everything. Pick up right where you left off.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
