'use client';
import React from 'react';
import { Clock, Sparkles, TrendingUp, Lock, AlertTriangle } from 'lucide-react';

/**
 * GraceCountdownBanner
 * 
 * Shows a dismissible banner warning users their unlimited access is ending.
 * Only renders when:
 *   - enforcement status shows show_countdown: true (7 days or less remaining)
 *   - AND we're past May 1st (enforcement_active will be true soon)
 * 
 * Before May 1st: This component renders NOTHING.
 */
export function GraceCountdownBanner({ status, onDismiss }) {
  // Guard: Don't show anything if enforcement isn't relevant
  if (!status) return null;
  if (!status.show_countdown) return null;
  if (status.enforcement_active === false && status.days_remaining > 7) return null;

  const days = status.days_remaining || 0;
  const isUrgent = days <= 3;
  const isExpired = days <= 0;

  if (isExpired) return null; // Don't show countdown at 0 — enforcement handles it

  return (
    <div className={`relative overflow-hidden rounded-lg border px-4 py-3 mx-4 mt-3 ${
      isUrgent 
        ? 'bg-red-950/50 border-red-500/40 text-red-200' 
        : 'bg-orange-950/50 border-orange-500/30 text-orange-200'
    }`}>
      {/* Subtle animated background */}
      <div className="absolute inset-0 opacity-10">
        <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${
          isUrgent ? 'via-red-500/20' : 'via-orange-500/20'
        } to-transparent animate-pulse`} />
      </div>
      
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-full ${isUrgent ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
            <Clock className={`w-4 h-4 ${isUrgent ? 'text-red-400' : 'text-orange-400'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {isUrgent 
                ? `⚠️ Your unlimited access ends in ${days} day${days > 1 ? 's' : ''}` 
                : `Your unlimited access ends in ${days} days`
              }
            </p>
            <p className="text-xs opacity-70 mt-0.5">
              Upgrade to keep premium models, unlimited images & voice chat
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a 
            href="/pricing" 
            className={`px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-colors ${
              isUrgent ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-600 hover:bg-orange-500'
            }`}
          >
            Upgrade
          </a>
          {onDismiss && (
            <button 
              onClick={onDismiss} 
              className="text-white/40 hover:text-white/70 transition-colors text-lg leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ModelLockBadge
 * 
 * Small badge shown on premium model options in the model selector.
 * Only visible when enforcement is active and user can't access premium models.
 */
export function ModelLockBadge({ isLocked }) {
  if (!isLocked) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-700/60 text-gray-400 border border-gray-600/40">
      <Lock className="w-2.5 h-2.5" /> Upgrade
    </span>
  );
}

/**
 * EnforcementBlockMessage
 * 
 * Inline component rendered in the chat when a user hits a limit.
 * Enhanced with rich contextual upgrade nudges and premium preview option.
 */
export function EnforcementBlockMessage({ data, onUsePreview }) {
  if (!data) return null;
  
  const { action, reason, upgrade_url, add_on_available, add_on_type, upgrade_nudge, preview_available, preview_remaining } = data;
  
  const actionLabels = {
    premium_model: 'Premium Model',
    standard_message: 'Daily Messages',
    image_generation: 'Image Generation',
    video_generation: 'Video Generation',
    voice_chat: 'Voice Chat',
    pdf_generation: 'PDF Generation',
  };

  const hasNudge = upgrade_nudge && upgrade_nudge.title;

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-orange-500/20">
      {/* Rich upgrade nudge header */}
      {hasNudge && (
        <div className="bg-gradient-to-r from-orange-600/90 to-amber-600/90 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{upgrade_nudge.emoji || '✨'}</span>
            <p className="text-sm font-bold text-white">{upgrade_nudge.title}</p>
          </div>
          {upgrade_nudge.value_props && (
            <ul className="mt-2 space-y-1">
              {upgrade_nudge.value_props.map((prop, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-orange-50">
                  <span className="text-orange-200">✓</span> {prop}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {/* Limit info + CTAs */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10 flex-shrink-0">
            <Lock className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              {actionLabels[action] || 'Feature'} limit reached
            </p>
            <p className="text-xs text-gray-400 mt-1">{reason}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <a 
                href={upgrade_url || '/pricing'} 
                className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white transition-all shadow-lg shadow-orange-500/20"
              >
                {hasNudge ? (upgrade_nudge.cta || 'Upgrade Plan') : 'Upgrade Plan'}
              </a>
              {add_on_available && (
                <a 
                  href="/pricing#addons" 
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                >
                  Buy {add_on_type === 'media_credits' ? 'Media Credits' : 'Message Pack'}
                </a>
              )}
              {preview_available && onUsePreview && (
                <button
                  onClick={() => onUsePreview(action)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600/80 hover:bg-purple-500 text-white transition-colors"
                >
                  ✨ Try it free ({preview_remaining} left)
                </button>
              )}
            </div>
            {hasNudge && upgrade_nudge.price_hint && (
              <p className="text-[10px] text-gray-500 mt-2">{upgrade_nudge.price_hint}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * UsageWarningBanner
 * 
 * Dismissible in-chat banner shown when user approaches 80% of their usage limits.
 * Gentle but effective conversion driver — shows before the hard wall.
 */
export function UsageWarningBanner({ warning, onDismiss }) {
  if (!warning || !warning.approaching_limit) return null;
  
  const percentage = warning.percentage || 0;
  const isUrgent = percentage >= 95 || warning.remaining <= 1;
  
  return (
    <div className={`relative mx-2 my-2 px-4 py-2.5 rounded-lg border backdrop-blur-sm transition-all ${
      isUrgent
        ? 'bg-red-950/40 border-red-500/30 text-red-200'
        : 'bg-amber-950/30 border-amber-500/20 text-amber-200'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            isUrgent ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/15 text-amber-300'
          }`}>
            {percentage}%
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{warning.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a 
            href="/pricing" 
            className={`px-3 py-1 rounded-md text-[11px] font-semibold text-white transition-colors ${
              isUrgent ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            Upgrade
          </a>
          {onDismiss && (
            <button 
              onClick={onDismiss} 
              className="text-white/30 hover:text-white/60 text-sm"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {/* Mini progress bar */}
      <div className="mt-2 h-1 rounded-full bg-gray-800/50 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-700 ${
            isUrgent ? 'bg-red-500' : 'bg-amber-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * PremiumPreviewBadge
 * 
 * Badge shown on media generated via a free premium preview.
 * "✨ This was created with Premium — upgrade to keep creating."
 */
export function PremiumPreviewBadge({ action, remaining, total }) {
  const actionNames = {
    image_generation: 'image',
    video_generation: 'video',
    voice_chat: 'voice session',
  };
  const name = actionNames[action] || 'creation';
  
  return (
    <div className="mt-2 p-3 rounded-lg bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-purple-200">
              ✨ Premium Preview — this {name} was on us!
            </p>
            <p className="text-[10px] text-purple-400 mt-0.5">
              {remaining > 0 
                ? `${remaining} free preview${remaining > 1 ? 's' : ''} remaining`
                : "That was your last free preview"
              }
            </p>
          </div>
        </div>
        <a 
          href="/pricing" 
          className="flex-shrink-0 px-3 py-1.5 rounded-md text-[11px] font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
        >
          Keep Creating →
        </a>
      </div>
    </div>
  );
}

/**
 * ModelFallbackNotice
 * 
 * One-time notice shown when a user opens an old conversation that used a premium model
 * but they no longer have access to it.
 */
export function ModelFallbackNotice({ originalModel, fallbackModel, onDismiss }) {
  if (!originalModel || !fallbackModel) return null;
  
  return (
    <div className="mx-4 my-2 p-3 rounded-lg bg-blue-950/40 border border-blue-500/20 text-blue-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-xs">
            This conversation used <span className="font-semibold text-blue-100">{originalModel}</span>. 
            Continuing with <span className="font-semibold text-blue-100">{fallbackModel}</span>.
          </p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-blue-400/50 hover:text-blue-300 text-sm">×</button>
        )}
      </div>
    </div>
  );
}

/**
 * UsageStatsBar
 * 
 * A single usage stat bar for the dashboard.
 * Before enforcement: Shows neutral stat only (no limit)
 * After enforcement: Shows used/limit with progress bar
 */
export function UsageStatsBar({ label, used, limit, period, icon: Icon, enforcementActive }) {
  const percentage = limit ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = limit && percentage >= 80;
  const isAtLimit = limit && used >= limit;

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-gray-500" />}
          <span className="text-xs font-medium text-gray-300">{label}</span>
        </div>
        <span className={`text-xs font-mono ${
          isAtLimit ? 'text-red-400' : isNearLimit ? 'text-orange-400' : 'text-gray-500'
        }`}>
          {enforcementActive && limit !== null 
            ? `${used} / ${limit}` 
            : `${used} used`
          }
          {period && <span className="text-gray-600 ml-1">({period})</span>}
        </span>
      </div>
      {enforcementActive && limit !== null && (
        <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-orange-500' : 'bg-green-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * TrialEndPrompt
 * 
 * Full-screen modal/prompt shown when a user must choose a plan:
 *  - New trial users (assessment complete or limit hit)
 *  - Grace-expired OG/Early users (post grace period)
 */
export function TrialEndPrompt({ reason, graceMessage }) {
  const isGraceExpired = reason === 'grace_expired';
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-orange-500/30 shadow-2xl">
        <div className="text-center">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            isGraceExpired ? 'bg-red-500/20' : 'bg-orange-500/20'
          }`}>
            {isGraceExpired 
              ? <TrendingUp className="w-6 h-6 text-red-400" />
              : <Sparkles className="w-6 h-6 text-orange-400" />
            }
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {isGraceExpired 
              ? 'Your Grace Period Has Ended'
              : 'Your SoulPrint is ready!'
            }
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {isGraceExpired 
              ? (graceMessage || 'Your early access grace period has ended. Choose a plan to keep your premium features — or continue with the free tier.')
              : reason === 'assessment_complete' 
                ? "Your AI personality profile has been built. Choose a plan to continue your journey."
                : "You've explored the core features. Choose a plan to unlock unlimited access."
            }
          </p>
          <div className="space-y-3">
            <a 
              href="/pricing" 
              className={`block w-full px-6 py-3 rounded-lg text-white font-semibold text-sm transition-colors ${
                isGraceExpired ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-600 hover:bg-orange-500'
              }`}
            >
              View Plans & Subscribe
            </a>
            <p className="text-[10px] text-gray-600 mt-1 text-center">
              Paid plans auto-renew until canceled. Cancel anytime from Settings → Billing.
            </p>
            <a 
              href="/pricing#free" 
              className="block w-full px-6 py-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 font-medium text-sm transition-colors"
            >
              Continue with Free (limited)
            </a>
          </div>
          {isGraceExpired && (
            <p className="text-[10px] text-gray-600 mt-4">
              Free tier: 50 messages/day • 10 images/month • No video or voice
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
