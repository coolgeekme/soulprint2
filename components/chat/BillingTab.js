'use client';
import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Receipt, ExternalLink, Loader2, CheckCircle, Clock, XCircle, Zap, Crown, ArrowUpRight } from 'lucide-react';

/**
 * BillingTab — User-facing billing & subscription management in Settings modal.
 * Shows: current subscription, payment history, and Stripe Customer Portal link.
 */
export default function BillingTab({ token }) {
  const [subscription, setSubscription] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [subRes, histRes] = await Promise.all([
        fetch('/api/pricing/subscription', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/pricing/history', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
      }
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.transactions || []);
      }
    } catch (e) {
      console.warn('[BillingTab] Failed to fetch data:', e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const returnUrl = window.location.origin + '/chat';
      const res = await fetch(`/api/pricing/portal?return_url=${encodeURIComponent(returnUrl)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Unable to open billing portal. You may not have an active subscription.');
      }
    } catch (e) {
      alert('Error opening billing portal: ' + e.message);
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sub = subscription?.subscription;
  const plan = subscription?.plan;
  const planName = plan?.name || 'Free';
  const isPaid = sub?.plan_id && sub.plan_id !== 'free';

  const statusColors = {
    active: 'text-green-400 bg-green-500/10 border-green-500/20',
    grace_period: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    canceled: 'text-red-400 bg-red-500/10 border-red-500/20',
    past_due: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  };

  const statusLabels = {
    active: 'Active',
    grace_period: 'Grace Period',
    canceled: 'Canceled',
    past_due: 'Past Due',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-white text-sm font-semibold mb-1">💳 Billing & Subscription</h3>
        <p className="text-gray-500 text-xs">Manage your plan, payment methods, and view purchase history.</p>
      </div>

      {/* Current Subscription Card */}
      <div className="bg-gradient-to-r from-orange-950/30 to-orange-900/10 border border-orange-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              {isPaid ? <Crown className="w-4 h-4 text-orange-400" /> : <Zap className="w-4 h-4 text-orange-400" />}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Current Plan</p>
              <p className="text-white font-bold text-sm">{planName}</p>
              {sub?.billing_period && (
                <p className="text-gray-500 text-[10px] capitalize">{sub.billing_period} billing</p>
              )}
            </div>
          </div>
          <div className="text-right">
            {sub?.status && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[sub.status] || 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
                {statusLabels[sub.status] || sub.status}
              </span>
            )}
            {sub?.current_period_start && (
              <p className="text-[10px] text-gray-600 mt-1">
                Since {new Date(sub.current_period_start).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <a href="/pricing" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-orange-600/30 hover:bg-orange-600/50 text-orange-300 transition-colors border border-orange-500/20">
            <ArrowUpRight className="w-3 h-3" />
            {isPaid ? 'Change Plan' : 'Upgrade'}
          </a>
          {isPaid && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border border-white/10"
            >
              {portalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
              Manage Billing
            </button>
          )}
        </div>
      </div>

      {/* Manage Payment Methods via Stripe Portal */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <h4 className="text-white text-xs font-semibold">Payment Methods</h4>
        </div>
        <p className="text-gray-500 text-xs mb-3">
          {isPaid
            ? 'View and update your payment methods, download invoices, and manage your subscription through the secure Stripe portal.'
            : 'Payment methods are managed through Stripe when you subscribe to a plan. Upgrade to manage billing.'}
        </p>
        {isPaid && (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 transition-colors border border-blue-500/20"
          >
            {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            Open Stripe Billing Portal
          </button>
        )}
      </div>

      {/* Purchase History */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <Receipt className="w-4 h-4 text-gray-400" />
          <h4 className="text-white text-xs font-semibold">Purchase History</h4>
        </div>

        {history.length === 0 ? (
          <p className="text-gray-600 text-xs py-4 text-center">No purchases yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((txn) => {
              const typeLabels = {
                subscription: 'Subscription',
                credit_pack: 'Media Credits',
                message_pack: 'Message Pack',
              };
              const statusIcon = txn.payment_status === 'paid' || txn.status === 'completed'
                ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                : txn.payment_status === 'pending' || txn.status === 'pending'
                ? <Clock className="w-3.5 h-3.5 text-yellow-400" />
                : <XCircle className="w-3.5 h-3.5 text-red-400" />;

              return (
                <div key={txn.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    {statusIcon}
                    <div>
                      <p className="text-gray-200 text-xs font-medium">
                        {typeLabels[txn.type] || txn.type}
                        {txn.plan_id && ` — ${txn.plan_id}`}
                        {txn.credits && ` — ${txn.credits} credits`}
                        {txn.messages && ` — ${txn.messages} messages`}
                      </p>
                      <p className="text-gray-600 text-[10px]">
                        {new Date(txn.created_at).toLocaleDateString()} · {new Date(txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-xs font-medium">${txn.amount?.toFixed(2)}</p>
                    <p className={`text-[10px] ${txn.payment_status === 'paid' || txn.status === 'completed' ? 'text-green-400' : txn.status === 'pending' ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {txn.payment_status || txn.status}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
