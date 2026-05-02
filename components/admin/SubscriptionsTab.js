'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, DollarSign, Users, Search, Plus, Edit, Trash2, Check, X,
  RefreshCw, Loader2, AlertTriangle, Receipt, Ticket, Shield, Zap,
  ChevronDown, ChevronRight, Play, Pause, Clock, Tag
} from 'lucide-react';

export default function SubscriptionsTab({ token }) {
  const [subTab, setSubTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [plans, setPlans] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Discount form state
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    code: '', type: 'percent_off', value: '', max_uses: '', expires_at: '',
    plan_ids: ['base', 'power'], description: '',
    is_lifetime_deal: false, lifetime_plan_id: 'power', lifetime_price: '',
  });
  const [discountSaving, setDiscountSaving] = useState(false);

  // Override plan state
  const [overrideUserId, setOverrideUserId] = useState('');
  const [overridePlanId, setOverridePlanId] = useState('base');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Grace period state
  const [graceDays, setGraceDays] = useState(14);
  const [graceLoading, setGraceLoading] = useState(false);
  const [graceResult, setGraceResult] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, plansRes, discountsRes, subsRes] = await Promise.all([
        fetch('/api/pricing/admin/overview', { headers }).then(r => r.json()),
        fetch('/api/pricing/admin/plans', { headers }).then(r => r.json()),
        fetch('/api/pricing/admin/discounts', { headers }).then(r => r.json()),
        fetch('/api/pricing/admin/subscriptions', { headers }).then(r => r.json()),
      ]);
      setOverview(overviewRes);
      setPlans(plansRes.plans || []);
      setDiscounts(discountsRes.discounts || []);
      setSubscriptions(subsRes.subscriptions || []);
    } catch (e) {
      console.error('Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Sync plans to Stripe
  const syncStripe = async () => {
    try {
      const res = await fetch('/api/pricing/admin/sync-stripe', { method: 'POST', headers });
      const data = await res.json();
      alert(data.success ? 'Plans synced to Stripe!' : `Error: ${data.error}`);
      fetchAll();
    } catch (e) {
      alert('Sync failed: ' + e.message);
    }
  };

  // Create discount code
  const handleCreateDiscount = async (e) => {
    e.preventDefault();
    setDiscountSaving(true);
    try {
      const body = {
        ...discountForm,
        value: parseFloat(discountForm.value),
        max_uses: discountForm.max_uses ? parseInt(discountForm.max_uses) : null,
        expires_at: discountForm.expires_at || null,
        lifetime_price: discountForm.lifetime_price ? parseFloat(discountForm.lifetime_price) : null,
      };
      const res = await fetch('/api/pricing/admin/discounts', { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setShowDiscountForm(false);
        setDiscountForm({ code: '', type: 'percent_off', value: '', max_uses: '', expires_at: '', plan_ids: ['base', 'power'], description: '', is_lifetime_deal: false, lifetime_plan_id: 'power', lifetime_price: '' });
        fetchAll();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setDiscountSaving(false);
    }
  };

  // Delete discount
  const handleDeleteDiscount = async (id) => {
    if (!confirm('Deactivate this discount code?')) return;
    await fetch(`/api/pricing/admin/discounts/${id}/delete`, { method: 'POST', headers });
    fetchAll();
  };

  // Override user plan
  const handleOverridePlan = async (e) => {
    e.preventDefault();
    if (!overrideUserId) return alert('User ID is required');
    setOverrideSaving(true);
    try {
      const res = await fetch('/api/pricing/admin/user-plan', {
        method: 'POST', headers,
        body: JSON.stringify({ userId: overrideUserId, planId: overridePlanId, reason: overrideReason || 'admin_override' }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Plan set to ${overridePlanId} for user ${overrideUserId}`);
        setOverrideUserId(''); setOverrideReason('');
        fetchAll();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setOverrideSaving(false);
    }
  };

  // Start grace period
  const handleGracePeriod = async () => {
    if (!confirm(`Start ${graceDays}-day grace period for ALL free users? This cannot be undone.`)) return;
    setGraceLoading(true);
    try {
      const res = await fetch('/api/pricing/admin/grace-period', {
        method: 'POST', headers, body: JSON.stringify({ days: graceDays }),
      });
      const data = await res.json();
      setGraceResult(data);
      fetchAll();
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setGraceLoading(false);
    }
  };

  const filteredSubs = subscriptions.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.user_id?.toLowerCase().includes(q) || s.plan_id?.toLowerCase().includes(q) || s.status?.toLowerCase().includes(q) || s.user_name?.toLowerCase().includes(q) || s.user_email?.toLowerCase().includes(q);
  });

  const SUB_TABS = [
    { id: 'overview', label: 'Overview', icon: CreditCard },
    { id: 'plans', label: 'Plans', icon: DollarSign },
    { id: 'discounts', label: 'Discount Codes', icon: Ticket },
    { id: 'users', label: 'User Plans', icon: Users },
    { id: 'grace', label: 'Grace Period', icon: Clock },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              subTab === t.id ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={fetchAll} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total', value: overview?.total || 0, color: 'text-white' },
              { label: 'Free', value: overview?.free || 0, color: 'text-gray-400' },
              { label: 'Base', value: overview?.base || 0, color: 'text-orange-400' },
              { label: 'Power', value: overview?.power || 0, color: 'text-yellow-400' },
              { label: 'Grace Period', value: overview?.grace_period || 0, color: 'text-red-400' },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-500 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Revenue summary */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" /> Monthly Revenue Estimate
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 text-xs">Base ({overview?.base || 0} users)</p>
                <p className="text-green-400 font-bold">${((overview?.base || 0) * 20.01).toFixed(2)}/mo</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Power ({overview?.power || 0} users)</p>
                <p className="text-green-400 font-bold">${((overview?.power || 0) * 99.01).toFixed(2)}/mo</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Total MRR</p>
                <p className="text-white font-bold text-lg">${(((overview?.base || 0) * 20.01) + ((overview?.power || 0) * 99.01)).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Active discount codes summary */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-purple-400" /> Active Discount Codes
            </h3>
            {discounts.filter(d => d.is_active).length === 0 ? (
              <p className="text-gray-500 text-xs">No active discount codes</p>
            ) : (
              <div className="space-y-2">
                {discounts.filter(d => d.is_active).map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <code className="text-orange-400 text-xs font-mono bg-orange-500/10 px-2 py-0.5 rounded">{d.code}</code>
                      <span className="text-gray-400 text-xs">
                        {d.type === 'percent_off' ? `${d.value}% off` : `$${d.value} off`}
                        {d.is_lifetime_deal && ' (Lifetime)'}
                      </span>
                    </div>
                    <span className="text-gray-500 text-xs">{d.current_uses}/{d.max_uses || '∞'} used</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ PLANS ═══ */}
      {subTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-bold">Subscription Plans</h3>
            <button onClick={syncStripe} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs hover:bg-purple-500/20 transition-colors">
              <Zap className="w-3 h-3" /> Sync to Stripe
            </button>
          </div>
          
          {plans.map(plan => (
            <div key={plan.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="text-white font-bold">{plan.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded ${plan.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-orange-400 font-bold">${plan.price_monthly}/mo</p>
                  <p className="text-gray-500 text-xs">${plan.price_annual}/yr (20% off)</p>
                </div>
              </div>
              
              {/* Stripe IDs */}
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="bg-black/20 rounded-lg px-3 py-2">
                  <span className="text-gray-500">Monthly Price ID: </span>
                  <code className="text-gray-300">{plan.stripe_price_id_monthly || '—'}</code>
                </div>
                <div className="bg-black/20 rounded-lg px-3 py-2">
                  <span className="text-gray-500">Annual Price ID: </span>
                  <code className="text-gray-300">{plan.stripe_price_id_annual || '—'}</code>
                </div>
              </div>

              {/* Features summary */}
              <div className="mt-3 flex flex-wrap gap-2">
                {plan.features?.premium_chat && <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">Premium Chat</span>}
                {plan.features?.voice_chat && <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">Voice</span>}
                {plan.features?.images_per_month === null ? (
                  <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">Unlimited Images</span>
                ) : (
                  <span className="text-xs bg-gray-500/10 text-gray-400 px-2 py-0.5 rounded">{plan.features?.images_per_month} imgs/mo</span>
                )}
                {plan.features?.image_watermark && <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded">Watermark</span>}
                {plan.features?.api_access && <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">API Access</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ DISCOUNTS ═══ */}
      {subTab === 'discounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-bold">Discount Codes & Lifetime Deals</h3>
            <button onClick={() => setShowDiscountForm(!showDiscountForm)} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs hover:bg-orange-500/20 transition-colors">
              <Plus className="w-3 h-3" /> New Code
            </button>
          </div>

          {/* Create form */}
          {showDiscountForm && (
            <form onSubmit={handleCreateDiscount} className="bg-white/5 border border-orange-500/20 rounded-xl p-5 space-y-4">
              <h4 className="text-orange-400 text-xs font-bold uppercase tracking-wider">Create Discount Code</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Code</label>
                  <input value={discountForm.code} onChange={e => setDiscountForm({...discountForm, code: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm uppercase" placeholder="LAUNCH20" required />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Type</label>
                  <select value={discountForm.type} onChange={e => setDiscountForm({...discountForm, type: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="percent_off">Percent Off</option>
                    <option value="amount_off">Amount Off ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Value</label>
                  <input type="number" value={discountForm.value} onChange={e => setDiscountForm({...discountForm, value: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="20" required />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Max Uses (blank = unlimited)</label>
                  <input type="number" value={discountForm.max_uses} onChange={e => setDiscountForm({...discountForm, max_uses: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="100" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Expires At (optional)</label>
                  <input type="date" value={discountForm.expires_at} onChange={e => setDiscountForm({...discountForm, expires_at: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Description</label>
                  <input value={discountForm.description} onChange={e => setDiscountForm({...discountForm, description: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Launch promo" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={discountForm.is_lifetime_deal} onChange={e => setDiscountForm({...discountForm, is_lifetime_deal: e.target.checked})}
                    className="rounded border-white/20" />
                  <span className="text-gray-300 text-xs">Lifetime Deal</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={discountSaving} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors">
                  {discountSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create Code'}
                </button>
                <button type="button" onClick={() => setShowDiscountForm(false)} className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs hover:bg-white/10 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Discount list */}
          {discounts.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No discount codes created yet</p>
          ) : (
            <div className="space-y-2">
              {discounts.map(d => (
                <div key={d.id} className={`bg-white/5 border rounded-xl p-4 ${d.is_active ? 'border-white/10' : 'border-red-500/20 opacity-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <code className="text-orange-400 font-mono font-bold bg-orange-500/10 px-3 py-1 rounded-lg">{d.code}</code>
                      <div>
                        <span className="text-white text-sm font-medium">
                          {d.type === 'percent_off' ? `${d.value}% off` : `$${d.value} off`}
                        </span>
                        {d.is_lifetime_deal && (
                          <span className="ml-2 text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">Lifetime Deal</span>
                        )}
                        <p className="text-gray-500 text-xs mt-0.5">{d.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-gray-300 text-xs font-medium">{d.current_uses}/{d.max_uses || '∞'} used</p>
                        {d.expires_at && <p className="text-gray-500 text-[10px]">Expires: {new Date(d.expires_at).toLocaleDateString()}</p>}
                        {d.stripe_coupon_id && <p className="text-gray-600 text-[10px]">Stripe: {d.stripe_coupon_id}</p>}
                      </div>
                      {d.is_active && (
                        <button onClick={() => handleDeleteDiscount(d.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ USER PLANS ═══ */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm"
                placeholder="Search by name, email, user ID, plan, or status..."
              />
            </div>
          </div>

          {/* Override form */}
          <form onSubmit={handleOverridePlan} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-3">Override User Plan</h4>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-gray-400 text-xs mb-1 block">User ID</label>
                <input value={overrideUserId} onChange={e => setOverrideUserId(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="uuid..." required />
              </div>
              <div className="w-32">
                <label className="text-gray-400 text-xs mb-1 block">Plan</label>
                <select value={overridePlanId} onChange={e => setOverridePlanId(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="free">Free</option>
                  <option value="base">Base</option>
                  <option value="power">Power</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-gray-400 text-xs mb-1 block">Reason</label>
                <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="VIP, comp, etc." />
              </div>
              <button type="submit" disabled={overrideSaving} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 whitespace-nowrap">
                {overrideSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Plan'}
              </button>
            </div>
          </form>

          {/* Subscriptions table */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 bg-white/5 px-4 py-2 text-xs text-gray-500 font-bold uppercase tracking-wider">
              <span>Name</span>
              <span>Email</span>
              <span>User ID</span>
              <span>Plan</span>
              <span>Status</span>
              <span>Billing</span>
              <span>Updated</span>
            </div>
            {filteredSubs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No subscriptions found</p>
            ) : (
              filteredSubs.slice(0, 50).map(s => (
                <div key={s.id || s.user_id} className="grid grid-cols-7 px-4 py-3 border-t border-white/5 text-sm items-center hover:bg-white/[0.02]">
                  <span className="text-white text-xs font-medium truncate pr-2" title={s.user_name}>{s.user_name || '—'}</span>
                  <span className="text-gray-300 text-xs truncate pr-2" title={s.user_email}>{s.user_email || '—'}</span>
                  <span className="text-gray-500 font-mono text-[10px] truncate pr-2" title={s.user_id}>{s.user_id?.substring(0, 10)}...</span>
                  <span className={`text-xs font-bold ${s.plan_id === 'power' ? 'text-yellow-400' : s.plan_id === 'base' ? 'text-orange-400' : 'text-gray-400'}`}>
                    {s.plan_id?.toUpperCase()}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit ${
                    s.status === 'active' ? 'bg-green-500/10 text-green-400' :
                    s.status === 'grace_period' ? 'bg-yellow-500/10 text-yellow-400' :
                    s.status === 'canceled' ? 'bg-red-500/10 text-red-400' :
                    'bg-gray-500/10 text-gray-400'
                  }`}>
                    {s.status}
                  </span>
                  <span className="text-gray-500 text-xs">{s.billing_period || '—'}</span>
                  <span className="text-gray-500 text-xs">{s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—'}</span>
                </div>
              ))
            )}
          </div>
          {filteredSubs.length > 50 && (
            <p className="text-gray-500 text-xs text-center">Showing 50 of {filteredSubs.length} subscriptions</p>
          )}
        </div>
      )}

      {/* ═══ GRACE PERIOD ═══ */}
      {subTab === 'grace' && (
        <div className="space-y-6">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
            <h3 className="text-yellow-400 text-sm font-bold flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" /> Grace Period Controls
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Starting a grace period will give all current free-tier users a countdown before they must choose a plan. 
              This is the &quot;May 1st countdown&quot; action. Users in grace period keep full access until it expires.
            </p>
            
            <div className="flex items-end gap-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Grace Period (days)</label>
                <input type="number" value={graceDays} onChange={e => setGraceDays(parseInt(e.target.value) || 14)}
                  className="w-32 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <button
                onClick={handleGracePeriod} disabled={graceLoading}
                className="px-4 py-2 bg-yellow-500 text-black rounded-lg text-xs font-bold hover:bg-yellow-400 transition-colors flex items-center gap-2"
              >
                {graceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Start Grace Period for All Users
              </button>
            </div>

            {graceResult && (
              <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-green-400 text-xs">
                  <Check className="w-3 h-3 inline mr-1" />
                  Grace period started! <strong>{graceResult.users_affected}</strong> users affected. 
                  Ends: {new Date(graceResult.grace_period_end).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Grace period users */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h4 className="text-white text-sm font-bold mb-3">Users in Grace Period</h4>
            {subscriptions.filter(s => s.status === 'grace_period').length === 0 ? (
              <p className="text-gray-500 text-xs">No users currently in grace period</p>
            ) : (
              <div className="space-y-2">
                {subscriptions.filter(s => s.status === 'grace_period').map(s => (
                  <div key={s.user_id} className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2">
                    <span className="text-gray-300 font-mono text-xs">{s.user_id}</span>
                    <span className="text-yellow-400 text-xs">
                      Expires: {s.grace_period_end ? new Date(s.grace_period_end).toLocaleDateString() : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
