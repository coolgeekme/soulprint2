'use client';
import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Image, Video, FileText, Mic, CreditCard, TrendingUp, Zap } from 'lucide-react';

/**
 * UsageTab — Settings panel showing usage stats and credit balance.
 * 
 * Before May 1st (enforcement_active: false): Shows neutral stats ("X used")
 * After May 1st (enforcement_active: true): Shows "X / Y" with progress bars and limits
 */
export default function UsageTab({ token }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/pricing/enforcement/usage', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (e) {
      console.warn('[UsageTab] Failed to fetch usage:', e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        Unable to load usage data.
      </div>
    );
  }

  const enforcementActive = usage.enforcement_active;
  const u = usage.usage;

  // Plan display
  const planLabels = {
    'power_equivalent': 'Unlimited Access',
    'base_trial': 'Base Plan Trial',
    'power': 'Power Plan',
    'base': 'Base Plan',
    'free': 'Free Plan',
  };

  const cohortLabels = {
    'og': 'Early Adopter',
    'early': 'Early Access',
    'new_trial': 'Trial',
    'subscribed': 'Subscriber',
    'admin': 'Admin',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-white text-sm font-semibold mb-1">📊 Usage & Credits</h3>
        <p className="text-gray-500 text-xs">Your current usage this billing period.</p>
      </div>

      {/* Plan Status Card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Current Plan</p>
            <p className="text-white font-semibold text-sm mt-0.5">
              {planLabels[usage.plan] || usage.plan}
            </p>
            {usage.cohort && usage.cohort !== 'unknown' && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                {cohortLabels[usage.cohort] || usage.cohort}
              </span>
            )}
          </div>
          <div className="text-right">
            {usage.grace_expires_at && (
              <div>
                <p className="text-[10px] text-gray-600 uppercase">Grace Until</p>
                <p className="text-xs text-gray-400 font-mono">
                  {new Date(usage.grace_expires_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Media Credits Balance */}
      <div className="bg-gradient-to-r from-purple-950/40 to-purple-900/20 border border-purple-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <CreditCard className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Media Credits</p>
              <p className="text-white font-bold text-lg">{usage.media_credits_balance || 0}</p>
            </div>
          </div>
          <a href="/pricing#addons" className="px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 transition-colors border border-purple-500/20">
            Buy More
          </a>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="space-y-1">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">This Period</h4>
        
        {/* Standard Messages */}
        <UsageBar 
          icon={MessageSquare}
          label="Messages"
          used={u.standard_messages?.used || 0}
          limit={u.standard_messages?.limit}
          period={u.standard_messages?.period === 'daily' ? 'today' : 'this month'}
          enforcementActive={enforcementActive}
          color="blue"
        />

        {/* Premium Messages */}
        {(u.premium_messages?.limit !== 0 || u.premium_messages?.used > 0) && (
          <UsageBar 
            icon={Zap}
            label="Premium Messages"
            used={u.premium_messages?.used || 0}
            limit={u.premium_messages?.limit}
            period="this month"
            enforcementActive={enforcementActive}
            color="orange"
          />
        )}

        {/* Images */}
        <UsageBar 
          icon={Image}
          label="Images"
          used={u.images?.used || 0}
          limit={u.images?.limit}
          period="this month"
          enforcementActive={enforcementActive}
          color="green"
        />

        {/* Videos */}
        <UsageBar 
          icon={Video}
          label="Videos"
          used={u.videos?.used || 0}
          limit={u.videos?.limit}
          period="this month"
          enforcementActive={enforcementActive}
          color="purple"
        />

        {/* PDFs */}
        <UsageBar 
          icon={FileText}
          label="PDFs"
          used={u.pdfs?.used || 0}
          limit={u.pdfs?.limit}
          period="this month"
          enforcementActive={enforcementActive}
          color="teal"
        />

        {/* Voice */}
        {(u.voice_minutes?.limit !== 0 || u.voice_minutes?.used > 0) && (
          <UsageBar 
            icon={Mic}
            label="Voice Minutes"
            used={u.voice_minutes?.used || 0}
            limit={u.voice_minutes?.limit}
            period="this month"
            enforcementActive={enforcementActive}
            color="pink"
          />
        )}
      </div>

      {/* Upgrade CTA — only show when enforcement is active */}
      {enforcementActive && usage.plan === 'free' && (
        <div className="bg-gradient-to-r from-orange-950/40 to-orange-900/20 border border-orange-500/20 rounded-xl p-4 text-center">
          <p className="text-sm text-white font-semibold mb-1">Want more?</p>
          <p className="text-xs text-gray-400 mb-3">Upgrade for unlimited messages, more media, and voice chat.</p>
          <a href="/pricing" className="inline-block px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors">
            View Plans
          </a>
        </div>
      )}
    </div>
  );
}

/** Individual usage bar */
function UsageBar({ icon: Icon, label, used, limit, period, enforcementActive, color }) {
  const percentage = limit ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = limit && percentage >= 80;
  const isAtLimit = limit && used >= limit;

  const colorMap = {
    blue: { bar: 'bg-blue-500', nearLimit: 'bg-orange-500', atLimit: 'bg-red-500', icon: 'text-blue-400', bg: 'bg-blue-500/10' },
    orange: { bar: 'bg-orange-500', nearLimit: 'bg-orange-500', atLimit: 'bg-red-500', icon: 'text-orange-400', bg: 'bg-orange-500/10' },
    green: { bar: 'bg-green-500', nearLimit: 'bg-orange-500', atLimit: 'bg-red-500', icon: 'text-green-400', bg: 'bg-green-500/10' },
    purple: { bar: 'bg-purple-500', nearLimit: 'bg-orange-500', atLimit: 'bg-red-500', icon: 'text-purple-400', bg: 'bg-purple-500/10' },
    teal: { bar: 'bg-teal-500', nearLimit: 'bg-orange-500', atLimit: 'bg-red-500', icon: 'text-teal-400', bg: 'bg-teal-500/10' },
    pink: { bar: 'bg-pink-500', nearLimit: 'bg-orange-500', atLimit: 'bg-red-500', icon: 'text-pink-400', bg: 'bg-pink-500/10' },
  };

  const c = colorMap[color] || colorMap.blue;
  const barColor = isAtLimit ? c.atLimit : isNearLimit ? c.nearLimit : c.bar;

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors">
      <div className={`p-1.5 rounded-md ${c.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-300">{label}</span>
          <span className={`text-[11px] font-mono ${isAtLimit ? 'text-red-400' : 'text-gray-500'}`}>
            {enforcementActive && limit !== null && limit !== undefined
              ? `${used} / ${limit}`
              : `${used} used`
            }
            {period && <span className="text-gray-700 ml-1">({period})</span>}
          </span>
        </div>
        {enforcementActive && limit !== null && limit !== undefined && (
          <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
