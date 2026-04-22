'use client';
import { useState, useEffect } from 'react';
import { Eye, Users, RefreshCw, Clock } from 'lucide-react';

export default function PitchAnalyticsTab({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pitch/analytics', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load pitch analytics');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
        <span className="ml-2 text-gray-400 text-sm">Loading pitch analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-sm mb-2">{error}</p>
        <button onClick={fetchData} className="text-orange-400 text-sm underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Pitch Deck Analytics</h2>
          <p className="text-gray-500 text-sm">Track who is viewing your investor deck</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-orange-400" />
            <span className="text-gray-500 text-xs">Total Views</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.total_views}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-gray-500 text-xs">Unique Viewers</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.unique_viewers}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-500 text-xs font-medium">Views by Access Code</span>
          </div>
          <div className="flex gap-4">
            {Object.entries(data.by_password).map(([name, count]) => (
              <div key={name} className="flex-1 text-center">
                <p className="text-lg font-bold text-white">{count}</p>
                <p className="text-xs text-gray-500">{name}&apos;s Code</p>
                <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{ width: data.total_views > 0 ? `${(count / data.total_views) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Viewers Table */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-white font-semibold text-sm">All Viewers</h3>
        </div>
        {data.viewers.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No views yet. Share your pitch deck link with potential investors.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {data.viewers.map((v, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div>
                  <p className="text-white text-sm font-medium">{v.email}</p>
                  <p className="text-gray-600 text-xs">
                    Used: {v.passwords.map(p => `${p}'s code`).join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-orange-400 text-sm font-bold">{v.count} view{v.count !== 1 ? 's' : ''}</p>
                  <p className="text-gray-600 text-xs flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" /> Last: {formatDate(v.last_access)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Access Log */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-white font-semibold text-sm">Recent Access Log</h3>
        </div>
        {data.recent.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-500 text-sm">No access logs yet.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {data.recent.map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${r.password_owner === 'Ben' ? 'bg-orange-500' : r.password_owner === 'Adrian' ? 'bg-blue-500' : 'bg-green-500'}`} />
                  <span className="text-gray-300">{r.email}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500">{r.password_owner}&apos;s code</span>
                  <span className="text-gray-600">{formatDate(r.accessed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
