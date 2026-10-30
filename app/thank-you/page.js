'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Sparkles, Crown, Rocket, ArrowRight } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function ThankYouPage() {
  return <Suspense fallback={null}><ThankYouPageInner /></Suspense>;
}

const KNOWN_PLANS = ["base", "free", "plus", "power"];

function ThankYouPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState('base');
  const [loading, setLoading] = useState(true);
  // null = still checking, true = payment confirmed, false = nothing to confirm
  const [verified, setVerified] = useState(null);

  useEffect(() => {
    const planParam = (searchParams.get('plan') || '').toLowerCase();
    const sessionId = searchParams.get('session_id') || '';
    if (planParam) setPlan(planParam);
    else setPlan('base');

    // A free signup involves no payment, so there is nothing to confirm.
    if (planParam === 'free') {
      setVerified(true);
      setLoading(false);
      return;
    }

    // THE OLD BUG: this page rendered 'Thank You for Subscribing' from the `plan` query
    // param alone, so /thank-you?plan=power with no session claimed a purchase that never
    // happened. A confirmation page must be able to prove a charge before it makes one.
    if (!sessionId) {
      setVerified(false);
      setLoading(false);
      return;
    }

    // Same verifier the product site uses — one source of truth for 'did this person pay'.
    fetch(`/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const paid = Boolean(d && d.ok && d.paid);
        setVerified(paid);
        // Trust the server's plan over the query string when we have one.
        if (paid && d.plan && KNOWN_PLANS.includes(d.plan)) setPlan(d.plan);
      })
      .catch(() => setVerified(false))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const planConfig = {
    free: {
      name: 'Free',
      icon: <Sparkles className="w-16 h-16 text-gray-400" />,
      color: 'from-gray-500 to-gray-700',
      message: 'Welcome to SoulPrint!',
      subtitle: 'You\'re all set with the Free plan',
      features: [
        'Standard AI models (10 messages/day)',
        '10 AI images per month',
        'Basic file analysis',
        'Persona & Memory system',
      ],
    },
    base: {
      name: 'Base',
      icon: <Check className="w-16 h-16 text-orange-400" />,
      color: 'from-orange-500 to-orange-700',
      message: 'Thank You for Subscribing to the Base Plan!',
      subtitle: 'Your subscription is now active',
      features: [
        'Unlimited standard AI models',
        '50 premium messages per month',
        '50 AI images (no watermark)',
        'Voice chat (30 min/month)',
        'Advanced file analysis',
        'Conversation search',
      ],
    },
    plus: {
      name: 'Plus',
      icon: <Crown className="w-16 h-16 text-blue-400" />,
      color: 'from-blue-500 to-blue-700',
      message: 'Thank You for Subscribing to the Plus Plan!',
      subtitle: 'Your subscription is now active',
      features: [
        'Unlimited premium AI messages',
        '100 AI images per month',
        '5 AI videos per month (1080p)',
        'Unlimited voice chat',
        'Advanced file analysis',
        'Priority support',
      ],
    },
    power: {
      name: 'Power',
      icon: <Rocket className="w-16 h-16 text-purple-400" />,
      color: 'from-purple-500 to-purple-700',
      message: 'Thank You for Subscribing to the Power Plan!',
      subtitle: 'Your subscription is now active',
      features: [
        'Unlimited everything',
        'All premium AI models',
        'Unlimited images & videos',
        'Unlimited voice chat',
        'No watermarks',
        'Priority support',
      ],
    },
  };

  const config = planConfig[plan] || planConfig.base;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // NOTHING TO CONFIRM. Someone landed here without a completed checkout — a stale link,
  // a shared URL, or a hand-typed ?plan=. Previously this rendered a receipt-shaped page
  // claiming a subscription, which is a false statement to a customer and, if it ever
  // reached analytics, invented revenue.
  if (verified === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="flex justify-center mb-8">
            <SoulPrintLogo variant="reverse" size={96} />
          </div>
          <div className="bg-white/95 backdrop-blur-xl border border-orange-200 rounded-2xl p-8 md:p-10 text-center shadow-2xl">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              We couldn&apos;t confirm a payment
            </h1>
            <p className="text-gray-700 mb-8 leading-relaxed">
              This link doesn&apos;t have a completed checkout attached to it. If you just
              paid, a receipt will be in your email — check there before doing anything else.
              Nothing has been charged twice.
            </p>
            <button
              onClick={() => router.push('/pricing')}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3.5 px-8 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              See plans
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-gray-400 text-sm mt-6">
              Still stuck? Email{' '}
              <a href="mailto:support@soulprint.ai" className="text-orange-400 hover:text-orange-300 underline">
                support@soulprint.ai
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <SoulPrintLogo variant="reverse" size={96} />
        </div>

        {/* Main Card */}
        <div className="bg-white/95 backdrop-blur-xl border border-orange-200 rounded-2xl p-8 md:p-12 text-center shadow-2xl">
          {/* Success Icon */}
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${config.color} mb-6 shadow-lg`}>
            {config.icon}
          </div>

          {/* Message */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {config.message}
          </h1>
          <p className="text-gray-700 text-lg mb-8">{config.subtitle}</p>

          {/* Features */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8 text-left">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
              What's included:
            </h2>
            <div className="space-y-3">
              {config.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-800 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => router.push('/chat')}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            Start Chatting
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Help Text */}
          <p className="text-gray-400 text-sm mt-6">
            Questions? Email us at{' '}
            <a href="mailto:support@soulprint.ai" className="text-orange-400 hover:text-orange-300 underline">
              support@soulprint.ai
            </a>
          </p>
        </div>

        {/* Footer Note */}
        <p className="text-center text-gray-400 text-xs mt-6">
          Your receipt has been sent to your email. You can manage your subscription anytime from Settings.
        </p>
      </div>
    </div>
  );
}
