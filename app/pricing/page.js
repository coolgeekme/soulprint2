'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Zap, Crown, Rocket, ArrowLeft, Sparkles, Film, Shield, Loader2, Tag, CreditCard, MessageSquare } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

// ── Plan Feature Comparison Data ──
const PLAN_FEATURES = [
  { category: 'Chat', features: [
    { name: 'Standard AI Models', free: '10 msgs/day', base: 'Unlimited', power: 'Unlimited' },
    { name: 'Premium AI Models', free: false, base: '50 messages/mo included', power: 'Unlimited' },
    { name: 'Premium Overage', free: '—', base: '$0.15/message (add-on packs)', power: 'N/A' },
    { name: 'Persona & Memory', free: true, base: true, power: true },
    { name: 'Conversation Search', free: false, base: true, power: true },
  ]},
  { category: 'Media', features: [
    { name: 'Images / Month', free: '10 (watermarked)', base: '50 (no watermark)', power: 'Unlimited' },
    { name: 'Image Rate Limit', free: '5/hour', base: 'None', power: 'None' },
    { name: 'Premium Image Models', free: false, base: true, power: true },
    { name: 'Video Generation', free: 'None', base: '1/mo + media credit packs', power: 'Unlimited' },
    { name: 'Media Credits (Add-on)', free: 'Available', base: 'Available', power: 'Available' },
  ]},
  { category: 'Documents', features: [
    { name: 'PDF Generation', free: '5/mo', base: '25/mo', power: 'Unlimited' },
    { name: 'File Analysis', free: 'Basic (10 pages)', base: 'Advanced (unlimited)', power: 'Advanced (unlimited)' },
  ]},
  { category: 'Voice & Platform', features: [
    { name: 'Voice Chat', free: false, base: '30 min/mo included', power: 'Unlimited' },
    { name: 'Voice Overage', free: '—', base: '$0.40/min', power: 'N/A' },
    { name: 'Web + Telegram', free: true, base: true, power: true },
    { name: 'Support', free: 'Ace AI Agent 24/7 + Email', base: 'Ace AI Agent 24/7 + Email', power: 'Ace AI Agent 24/7 + Priority Email' },
  ]},
];

const MEDIA_CREDIT_PACKS = [
  { id: 'spark', name: 'Spark', credits: 30, price: 2.99, popular: false },
  { id: 'creator', name: 'Creator', credits: 150, price: 14.99, popular: true },
  { id: 'pro', name: 'Pro', credits: 500, price: 49.99, popular: false },
  { id: 'studio', name: 'Studio', credits: 1500, price: 149.99, popular: false },
];

export default function PricingPage() {
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gateVisible, setGateVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    
    // Check gate status
    fetch('/api/pricing/gate', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        setGateVisible(data.visible);
        if (!data.visible) {
          router.push('/chat');
          return;
        }
      })
      .catch(() => router.push('/chat'));

    // Get user info
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(u => { if (u?.id || u?.user_id) setUser(u); })
        .catch(() => {});

      fetch('/api/pricing/subscription', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(sub => { if (sub?.plan_id) setCurrentPlan(sub); })
        .catch(() => {});
    }

    setLoading(false);
  }, [router]);

  const handleCheckout = async (planId) => {
    const token = localStorage.getItem('sp_token');
    if (!token) {
      router.push('/chat');
      return;
    }
    setCheckoutLoading(planId);
    try {
      const origin = window.location.origin;
      const res = await fetch('/api/pricing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          planId: planId, 
          billingPeriod: annual ? 'annual' : 'monthly',
          originUrl: origin,
          discountCode: discountResult?.valid ? discountCode : null,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch (e) {
      alert('Failed to start checkout: ' + e.message);
    }
    setCheckoutLoading(null);
  };

  const handleCreditPack = async (packId) => {
    const token = localStorage.getItem('sp_token');
    if (!token) { router.push('/chat'); return; }
    setCheckoutLoading(packId);
    try {
      const origin = window.location.origin;
      const res = await fetch('/api/pricing/checkout/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packId, originUrl: origin }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Failed to create checkout');
    } catch (e) { alert('Error: ' + e.message); }
    setCheckoutLoading(null);
  };

  const handleMessagePack = async (packId) => {
    const token = localStorage.getItem('sp_token');
    if (!token) { router.push('/chat'); return; }
    setCheckoutLoading(packId);
    try {
      const origin = window.location.origin;
      const res = await fetch('/api/pricing/checkout/message-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packId, originUrl: origin }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Failed to create checkout');
    } catch (e) { alert('Error: ' + e.message); }
    setCheckoutLoading(null);
  };

  const handleValidateDiscount = async () => {
    if (!discountCode.trim()) return;
    try {
      const res = await fetch('/api/pricing/discounts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode }),
      });
      const data = await res.json();
      setDiscountResult(data);
    } catch {
      setDiscountResult({ valid: false, error: 'Failed to validate' });
    }
  };

  if (loading || !gateVisible) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const isCurrentPlan = (planId) => currentPlan?.plan_id === planId;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/chat')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Chat</span>
          </button>
          <div className="flex items-center gap-2">
            <SoulPrintLogo size={24} />
            <span className="text-sm font-semibold text-white">SoulPrint Engine</span>
          </div>
          <div className="w-24" /> {/* Spacer */}
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-medium text-orange-400">Choose your plan</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4">
          AI that knows you.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">Priced to fit.</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto mb-8">
          Start free. Upgrade when you need premium models, unlimited media, and priority support.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm ${!annual ? 'text-white font-semibold' : 'text-gray-500'}`}>Monthly</span>
          <button 
            onClick={() => setAnnual(!annual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-orange-500' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${annual ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm ${annual ? 'text-white font-semibold' : 'text-gray-500'}`}>
            Annual <span className="text-orange-400 text-xs font-bold">Save 20%</span>
          </span>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {/* Free */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 flex flex-col">
            <div className="mb-6">
              <div className="w-10 h-10 rounded-xl bg-gray-500/10 flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Free</h3>
              <p className="text-gray-500 text-xs mt-1">Get started with AI that knows you.</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-black text-white">$0</span>
              <span className="text-gray-500 text-sm">/forever</span>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {['Standard AI models — 50 msgs/day', '10 images/mo (watermarked)', 'No video generation', '5 PDFs/mo', 'SoulPrint memory & persona', 'Web + Telegram', '10-page file analysis', 'Ace AI Support Agent 24/7'].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
              {['Premium AI models', 'Voice chat'].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <X className="w-4 h-4 text-gray-700 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button 
              disabled={isCurrentPlan('free')}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${isCurrentPlan('free') ? 'bg-white/5 text-gray-600 cursor-default' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
            >
              {isCurrentPlan('free') ? 'Current Plan' : 'Get Started'}
            </button>
          </div>

          {/* Base — Most Popular */}
          <div className="relative bg-gradient-to-b from-orange-500/[0.06] to-transparent border border-orange-500/20 rounded-2xl p-6 flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold tracking-wider px-3 py-1 rounded-full uppercase">Most Popular</span>
            </div>
            <div className="mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3">
                <Crown className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Base</h3>
              <p className="text-gray-500 text-xs mt-1">For daily users who want premium AI.</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-black text-white">${annual ? '16.01' : '20.01'}</span>
              <span className="text-gray-500 text-sm">/{annual ? 'mo (billed yearly)' : 'mo'}</span>
              {annual && <p className="text-orange-400 text-xs mt-1">${(192.10).toFixed(2)}/year — save $48</p>}
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {[
                'Everything in Free',
                'Premium AI models — 50 msgs/mo',
                '50 images/mo (no watermark)',
                'Premium image models',
                '1 video/mo + media credit packs',
                '25 PDFs/mo',
                'Voice chat — 30 min/mo',
                'Advanced file analysis',
                'Conversation search',
                'Pay-as-you-go overages',
                'Ace AI Agent + Email support',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => handleCheckout('base')}
              disabled={isCurrentPlan('base') || checkoutLoading === 'base'}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${isCurrentPlan('base') ? 'bg-orange-500/20 text-orange-400/60 cursor-default' : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/20'}`}
            >
              {checkoutLoading === 'base' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isCurrentPlan('base') ? 'Current Plan' : 'Subscribe'}
            </button>
            {!isCurrentPlan('base') && (
              <p className="text-[10px] text-gray-600 mt-2 text-center leading-relaxed">
                {annual 
                  ? 'Billed annually at $192.10/year. Auto-renews yearly until canceled.'
                  : 'Billed monthly at $20.01/mo. Auto-renews monthly until canceled.'
                }
              </p>
            )}
          </div>

          {/* Power */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 flex flex-col">
            <div className="mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
                <Rocket className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Power</h3>
              <p className="text-gray-500 text-xs mt-1">Unlimited everything. Flat rate.</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-black text-white">${annual ? '79.21' : '99.01'}</span>
              <span className="text-gray-500 text-sm">/{annual ? 'mo (billed yearly)' : 'mo'}</span>
              {annual && <p className="text-purple-400 text-xs mt-1">${(950.50).toFixed(2)}/year — save $238</p>}
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {[
                'Everything in Base',
                'Unlimited premium AI models',
                'Unlimited images (all models)',
                'Unlimited video generation',
                'No watermarks anywhere',
                'Unlimited voice chat',
                'Ace AI Agent + Priority Email',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => handleCheckout('power')}
              disabled={isCurrentPlan('power') || checkoutLoading === 'power'}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${isCurrentPlan('power') ? 'bg-purple-500/20 text-purple-400/60 cursor-default' : 'bg-white/5 hover:bg-white/10 text-white border border-purple-500/30 hover:border-purple-500/50'}`}
            >
              {checkoutLoading === 'power' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isCurrentPlan('power') ? 'Current Plan' : 'Subscribe'}
            </button>
            {!isCurrentPlan('power') && (
              <p className="text-[10px] text-gray-600 mt-2 text-center leading-relaxed">
                {annual 
                  ? 'Billed annually at $950.50/year. Auto-renews yearly until canceled.'
                  : 'Billed monthly at $99.01/mo. Auto-renews monthly until canceled.'
                }
              </p>
            )}
          </div>
        </div>

        {/* Discount Code */}
        <div className="max-w-md mx-auto mt-8">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={discountCode}
                onChange={e => { setDiscountCode(e.target.value); setDiscountResult(null); }}
                placeholder="Discount code"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/30"
              />
            </div>
            <button
              onClick={handleValidateDiscount}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white transition-colors"
            >
              Apply
            </button>
          </div>
          {discountResult && (
            <p className={`text-xs mt-2 ${discountResult.valid ? 'text-green-400' : 'text-red-400'}`}>
              {discountResult.valid 
                ? `${discountResult.type === 'percent_off' ? `${discountResult.value}% off` : `$${discountResult.value} off`} applied!`
                : discountResult.error
              }
            </p>
          )}
        </div>
      </div>

      {/* Media Credit Packs */}
      <div id="addons" className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-4">
            <Film className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-medium text-purple-400">Media Credits</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Need more media generation?</h2>
          <p className="text-gray-500 text-sm">Buy credit packs — use for images and video with any model.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {MEDIA_CREDIT_PACKS.map(pack => (
            <button
              key={pack.id}
              onClick={() => handleCreditPack(pack.id)}
              disabled={checkoutLoading === pack.id}
              className={`relative bg-white/[0.02] border rounded-xl p-4 text-center transition-all hover:bg-white/[0.04] ${pack.popular ? 'border-purple-500/30' : 'border-white/[0.06]'}`}
            >
              {pack.popular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">BEST VALUE</span>
              )}
              <p className="text-white font-bold text-lg">{pack.credits}</p>
              <p className="text-gray-500 text-[10px]">credits</p>
              <p className="text-purple-400 font-bold text-sm mt-2">${pack.price}</p>
              <p className="text-gray-600 text-[10px]">${(pack.price / pack.credits).toFixed(2)}/credit</p>
              {checkoutLoading === pack.id && <Loader2 className="w-4 h-4 animate-spin mx-auto mt-2 text-purple-400" />}
            </button>
          ))}
        </div>
        <p className="text-center text-gray-600 text-[10px] mt-4">Images: 2–13 credits per generation · Videos: 10–105 credits per generation</p>
      </div>

      {/* Premium Message Packs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
            <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-medium text-orange-400">Message Packs</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Need more premium messages?</h2>
          <p className="text-gray-500 text-sm">Continue using GPT-5.2, Claude Opus, and other premium models beyond your monthly limit.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          {[
            { id: 'msg-25', messages: 25, price: 3.75, perMsg: '$0.15' },
            { id: 'msg-50', messages: 50, price: 7.50, perMsg: '$0.15', popular: true },
            { id: 'msg-100', messages: 100, price: 14.00, perMsg: '$0.14' },
          ].map(pack => (
            <button
              key={pack.id}
              onClick={() => handleMessagePack(pack.id)}
              disabled={checkoutLoading === pack.id}
              className={`relative bg-white/[0.02] border rounded-xl p-4 text-center transition-all hover:bg-white/[0.04] ${pack.popular ? 'border-orange-500/30' : 'border-white/[0.06]'}`}
            >
              {pack.popular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">POPULAR</span>
              )}
              <p className="text-white font-bold text-lg">{pack.messages}</p>
              <p className="text-gray-500 text-[10px]">messages</p>
              <p className="text-orange-400 font-bold text-sm mt-2">${pack.price.toFixed(2)}</p>
              <p className="text-gray-600 text-[10px]">{pack.perMsg}/msg</p>
              {checkoutLoading === pack.id && <Loader2 className="w-4 h-4 animate-spin mx-auto mt-2 text-orange-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Feature Comparison Toggle */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <button 
          onClick={() => setShowComparison(!showComparison)}
          className="mx-auto flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <Shield className="w-4 h-4" />
          {showComparison ? 'Hide' : 'Show'} full feature comparison
        </button>
        
        {showComparison && (
          <div className="mt-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left p-4 text-gray-500 font-normal w-1/3">Feature</th>
                  <th className="text-center p-4 text-gray-400 font-semibold">Free</th>
                  <th className="text-center p-4 text-orange-400 font-semibold">Base</th>
                  <th className="text-center p-4 text-purple-400 font-semibold">Power</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((cat, ci) => (
                  <React.Fragment key={ci}>
                    <tr className="border-t border-white/[0.04]">
                      <td colSpan={4} className="p-3 text-xs font-bold text-orange-400/60 tracking-wider uppercase bg-white/[0.01]">{cat.category}</td>
                    </tr>
                    {cat.features.map((f, fi) => (
                      <tr key={fi} className="border-t border-white/[0.03]">
                        <td className="p-3 text-gray-400 text-xs">{f.name}</td>
                        {['free', 'base', 'power'].map(plan => (
                          <td key={plan} className="p-3 text-center text-xs">
                            {f[plan] === true ? <Check className="w-4 h-4 text-green-500 mx-auto" /> :
                             f[plan] === false ? <X className="w-4 h-4 text-gray-700 mx-auto" /> :
                             <span className="text-gray-400">{f[plan]}</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legal Disclosures */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 text-center space-y-3">
        <p className="text-gray-600 text-xs">
          All plans include SoulPrint persona, memory, and assessment features. Prices in USD.
        </p>
        <div className="text-gray-600 text-[10px] leading-relaxed max-w-2xl mx-auto space-y-1.5">
          <p>
            <strong className="text-gray-500">Auto-Renewal:</strong> Paid subscriptions automatically renew at the end of each billing cycle (monthly or annually) at the then-current rate until you cancel.
            You will be charged on the same date each billing period. You can cancel anytime from Settings → Billing — your access continues through the end of your paid period.
          </p>
          <p>
            <strong className="text-gray-500">Cancellation:</strong> Cancel your subscription at any time through your account settings. No cancellation fees apply.
            After cancellation, you retain access to paid features until the end of your current billing period, then revert to the Free plan.
          </p>
        </div>
        <p className="text-gray-700 text-[10px] mt-2">
          Payments processed securely by Stripe. By subscribing, you agree to our <a href="/terms" className="text-orange-400 hover:underline">Terms of Service</a> and <a href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</a>. Questions? <a href="mailto:support@archeforge.com" className="text-orange-400 hover:underline">support@archeforge.com</a>
        </p>
      </div>
    </div>
  );
}
