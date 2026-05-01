'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
// ADD-ON PURCHASE SUCCESS PAGE
// Shown after purchasing media credits or premium message packs.
// ═══════════════════════════════════════════════════════════════

export default function PurchaseSuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const purchaseType = searchParams.get('type') // 'credits' or 'messages'
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

  const isCredits = purchaseType === 'credits' || purchase?.type === 'credit_pack'
  const isMessages = purchaseType === 'messages' || purchase?.type === 'message_pack'

  const icon = isCredits ? '🎨' : '💬'
  const title = isCredits ? 'Media Credits Added' : 'Premium Messages Added'
  const subtitle = isCredits
    ? `${purchase?.credits || ''} media credits have been added to your account.`
    : `${purchase?.messages || ''} premium messages have been added to your account.`
  const description = isCredits
    ? 'Use these credits for AI image generation, video creation, and other media features.'
    : 'These premium messages give you access to advanced AI models for deeper, more nuanced conversations.'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        {loading ? (
          <div className="animate-pulse">
            <div className="w-20 h-20 rounded-full bg-white/5 mx-auto mb-6" />
            <div className="h-8 bg-white/5 rounded-lg w-3/4 mx-auto mb-4" />
            <div className="h-4 bg-white/5 rounded w-1/2 mx-auto" />
          </div>
        ) : (
          <>
            {/* Success icon */}
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                <span className="text-4xl">{icon}</span>
              </div>
            </div>

            {/* Confirmation */}
            <h1 className="text-2xl md:text-3xl font-black text-white mb-2">
              {title}
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              {subtitle}
            </p>

            {/* Details card */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-8 text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <span className="text-green-400 text-lg">✓</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Purchase Confirmed</p>
                  <p className="text-gray-500 text-xs">Credits are available immediately</p>
                </div>
              </div>
              <div className="h-px bg-white/5 my-3" />
              <p className="text-gray-400 text-xs leading-relaxed">
                {description}
              </p>
              {purchase && (
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Amount paid</span>
                    <span className="text-white font-medium">${purchase.amount}</span>
                  </div>
                  {(purchase.credits || purchase.messages) && (
                    <div className="flex justify-between mt-1">
                      <span>{isCredits ? 'Credits' : 'Messages'} added</span>
                      <span className="text-white font-medium">{purchase.credits || purchase.messages}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CTA */}
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/20 hover:shadow-green-500/30 hover:scale-[1.02]"
            >
              Back to Chat
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>

            <p className="text-gray-600 text-xs mt-6">
              Your balance has been updated. Start creating right away.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
