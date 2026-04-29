'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, X, Check, Loader2, Tag, Copy, Calendar, Users, Percent, DollarSign } from 'lucide-react';

export default function DiscountsTab({ token }) {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const emptyForm = {
    code: '',
    type: 'percent_off',
    value: 20,
    plan_ids: ['base', 'power'],
    max_uses: '',
    expires_at: '',
    description: '',
    is_lifetime_deal: false,
    lifetime_plan_id: '',
    lifetime_price: '',
  };
  const [form, setForm] = useState(emptyForm);

  const fetchDiscounts = async () => {
    try {
      const res = await fetch('/api/pricing/admin/discounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDiscounts(data.discounts || []);
      }
    } catch (e) {
      console.error('Failed to fetch discounts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDiscounts(); }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const body = {
        code: form.code.toUpperCase().trim(),
        type: form.type,
        value: parseFloat(form.value),
        plan_ids: form.plan_ids,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        expires_at: form.expires_at || null,
        description: form.description,
        is_lifetime_deal: form.is_lifetime_deal,
        lifetime_plan_id: form.is_lifetime_deal ? form.lifetime_plan_id : null,
        lifetime_price: form.is_lifetime_deal && form.lifetime_price ? parseFloat(form.lifetime_price) : null,
      };

      if (!body.code) { setError('Code is required'); setSaving(false); return; }
      if (!body.value || body.value <= 0) { setError('Value must be greater than 0'); setSaving(false); return; }

      let res;
      if (editingId) {
        res = await fetch(`/api/pricing/admin/discounts/${editingId}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/pricing/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save discount');
      } else {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        fetchDiscounts();
      }
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this discount code?')) return;
    try {
      await fetch(`/api/pricing/admin/discounts/${id}/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchDiscounts();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleEdit = (discount) => {
    setForm({
      code: discount.code,
      type: discount.type,
      value: discount.value,
      plan_ids: discount.plan_ids || ['base', 'power'],
      max_uses: discount.max_uses || '',
      expires_at: discount.expires_at ? new Date(discount.expires_at).toISOString().slice(0, 10) : '',
      description: discount.description || '',
      is_lifetime_deal: discount.is_lifetime_deal || false,
      lifetime_plan_id: discount.lifetime_plan_id || '',
      lifetime_price: discount.lifetime_price || '',
    });
    setEditingId(discount.id);
    setShowForm(true);
    setError('');
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-bold">Discount Codes</h2>
          <p className="text-gray-500 text-xs mt-0.5">{discounts.length} code{discounts.length !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError(''); }}
          className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Code
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white text-sm font-semibold">{editingId ? 'Edit Discount Code' : 'Create Discount Code'}</h3>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="LAUNCH20"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                disabled={!!editingId}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 focus:outline-none"
              >
                <option value="percent_off">Percentage Off</option>
                <option value="amount_off">Fixed Amount Off</option>
                <option value="lifetime_deal">Lifetime Deal</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">
                {form.type === 'percent_off' ? 'Percentage (%)' : form.type === 'amount_off' ? 'Amount ($)' : 'Value'}
              </label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                min="0"
                step={form.type === 'percent_off' ? '1' : '0.01'}
                max={form.type === 'percent_off' ? '100' : undefined}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 focus:outline-none"
              />
            </div>

            {/* Max Uses */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Max Uses (blank = unlimited)</label>
              <input
                type="number"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="∞"
                min="1"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 focus:outline-none"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Expires At (optional)</label>
              <input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 focus:outline-none"
              />
            </div>

            {/* Applicable Plans */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Applies To Plans</label>
              <div className="flex gap-2 mt-1">
                {['base', 'power'].map(plan => (
                  <label key={plan} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.plan_ids.includes(plan)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, plan_ids: [...form.plan_ids, plan] });
                        } else {
                          setForm({ ...form, plan_ids: form.plan_ids.filter(p => p !== plan) });
                        }
                      }}
                      className="accent-orange-500"
                    />
                    <span className="text-gray-300 text-xs capitalize">{plan}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-gray-400 text-xs block mb-1">Description (internal note)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Launch promotion for early adopters"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 focus:outline-none"
            />
          </div>

          {/* Lifetime Deal Options */}
          <div className="border-t border-white/5 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_lifetime_deal}
                onChange={(e) => setForm({ ...form, is_lifetime_deal: e.target.checked })}
                className="accent-orange-500"
              />
              <span className="text-gray-300 text-xs font-medium">This is a Lifetime Deal</span>
            </label>
            {form.is_lifetime_deal && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Lifetime Plan</label>
                  <select
                    value={form.lifetime_plan_id}
                    onChange={(e) => setForm({ ...form, lifetime_plan_id: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                  >
                    <option value="">Select plan</option>
                    <option value="base">Base</option>
                    <option value="power">Power</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">One-time Price ($)</label>
                  <input
                    type="number"
                    value={form.lifetime_price}
                    onChange={(e) => setForm({ ...form, lifetime_price: e.target.value })}
                    step="0.01"
                    min="0"
                    placeholder="99.99"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-2 text-gray-400 text-xs hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {/* Discount List */}
      {discounts.length === 0 ? (
        <div className="text-center py-12 bg-[#111] border border-white/5 rounded-xl">
          <Tag className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No discount codes yet.</p>
          <p className="text-gray-600 text-xs mt-1">Create your first promo code above.</p>
        </div>
      ) : (
        <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-3 text-gray-500 text-xs font-medium uppercase">Code</th>
                <th className="text-left p-3 text-gray-500 text-xs font-medium uppercase">Type</th>
                <th className="text-left p-3 text-gray-500 text-xs font-medium uppercase">Value</th>
                <th className="text-left p-3 text-gray-500 text-xs font-medium uppercase">Uses</th>
                <th className="text-left p-3 text-gray-500 text-xs font-medium uppercase">Expires</th>
                <th className="text-left p-3 text-gray-500 text-xs font-medium uppercase">Status</th>
                <th className="text-right p-3 text-gray-500 text-xs font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map(d => {
                const isExpired = d.expires_at && new Date(d.expires_at) < new Date();
                const isMaxed = d.max_uses && d.current_uses >= d.max_uses;
                const status = !d.is_active ? 'Inactive' : isExpired ? 'Expired' : isMaxed ? 'Maxed' : 'Active';
                const statusColor = status === 'Active' ? 'text-green-400 bg-green-500/10' : status === 'Inactive' ? 'text-gray-400 bg-gray-500/10' : 'text-red-400 bg-red-500/10';

                return (
                  <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <code className="text-orange-400 font-mono text-xs bg-orange-500/10 px-2 py-0.5 rounded">{d.code}</code>
                        <button onClick={() => copyCode(d.code)} className="text-gray-600 hover:text-gray-300 transition-colors">
                          {copied === d.code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      {d.description && <p className="text-gray-600 text-[10px] mt-0.5">{d.description}</p>}
                    </td>
                    <td className="p-3 text-gray-300 text-xs">
                      {d.type === 'percent_off' && <span className="flex items-center gap-1"><Percent className="w-3 h-3" /> Percentage</span>}
                      {d.type === 'amount_off' && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Fixed</span>}
                      {d.type === 'lifetime_deal' && <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Lifetime</span>}
                    </td>
                    <td className="p-3 text-white text-xs font-medium">
                      {d.type === 'percent_off' ? `${d.value}%` : `$${d.value}`}
                    </td>
                    <td className="p-3 text-gray-300 text-xs">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-gray-500" />
                        {d.current_uses || 0}{d.max_uses ? ` / ${d.max_uses}` : ' / ∞'}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400 text-xs">
                      {d.expires_at ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-500" />
                          {new Date(d.expires_at).toLocaleDateString()}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor}`}>{status}</span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(d)} className="p-1.5 rounded-md hover:bg-white/5 text-gray-500 hover:text-blue-400 transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-md hover:bg-white/5 text-gray-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
