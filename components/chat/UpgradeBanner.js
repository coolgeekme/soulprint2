'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { X, Sparkles, Crown, ArrowRight, ImageIcon, Mic, Zap } from 'lucide-react';

/**
 * UpgradeBanner — Phase 4: Grace Period Enforcement
 * 
 * Contextual, dismissible upgrade nudges.
 * Never blocks anything — just informs.
 */

// Slim inline banner for the chat input area
export function ChatUpgradeBanner({ type, message, planName, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const icons = {
    premium_model: <Crown className="w-3.5 h-3.5 text-amber-400" />,
    images: <ImageIcon className="w-3.5 h-3.5 text-pink-400" />,
    voice: <Mic className="w-3.5 h-3.5 text-purple-400" />,
    premium_chat: <Zap className="w-3.5 h-3.5 text-cyan-400" />,
    default: <Sparkles className="w-3.5 h-3.5 text-orange-400" />,
  };

  const bgColors = {
    premium_model: 'bg-amber-500/8 border-amber-500/20',
    limit_reached: 'bg-red-500/8 border-red-500/20',
    limit_approaching: 'bg-orange-500/8 border-orange-500/20',
    feature_unavailable: 'bg-purple-500/8 border-purple-500/20',
    default: 'bg-orange-500/8 border-orange-500/20',
  };

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs ${bgColors[type] || bgColors.default}`}>
      <div className="flex items-center gap-2 min-w-0">
        {icons[type] || icons.default}
        <span className="text-gray-300 truncate">{message}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link 
          href="/pricing" 
          className="text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1 whitespace-nowrap"
        >
          Upgrade <ArrowRight className="w-3 h-3" />
        </Link>
        <button onClick={handleDismiss} className="text-gray-600 hover:text-gray-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Premium badge for model picker
export function PremiumBadge({ small }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${small ? 'text-[7px] px-1 py-0' : 'text-[8px] px-1.5 py-0.5'} rounded bg-amber-500/15 text-amber-400 font-semibold uppercase tracking-wider`}>
      <Crown className={small ? 'w-2 h-2' : 'w-2.5 h-2.5'} /> Pro
    </span>
  );
}

// Model picker upgrade nudge (shows below model list when Free user selects premium)
export function ModelUpgradeNudge({ modelLabel, planName }) {
  return (
    <div className="px-3 py-2 border-t border-white/5 bg-amber-500/5">
      <p className="text-[10px] text-amber-400/90">
        <Crown className="w-3 h-3 inline mr-1" />
        <strong>{modelLabel}</strong> is a premium model.
        {planName === 'Free' ? (
          <> Upgrade to Base for 50 premium messages/month.</>  
        ) : (
          <> Included in your plan.</>  
        )}
      </p>
      {planName === 'Free' && (
        <Link href="/pricing" className="text-[10px] text-orange-400 hover:text-orange-300 mt-1 inline-flex items-center gap-1">
          View Plans <ArrowRight className="w-2.5 h-2.5" />
        </Link>
      )}
    </div>
  );
}
