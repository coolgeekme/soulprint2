'use client';

// Brazilian Portuguese waitlist admin dashboard.
// UI text is in English (admin-only surface for the SoulPrint team).
// Uses the existing admin auth (sp_token in localStorage + /api/auth/me role
// check). If the current user is not admin/superadmin, a lightweight login
// form is shown. Admin endpoints and response shape are designed to plug
// into a future Master multi-country admin dashboard via HTTP aggregation.

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Loader2,
  LogIn,
  Users,
  TrendingUp,
  MapPin,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import SoulPrintLogo from '@/components/SoulPrintLogo';

const REGION_LABELS = {
  'sao-paulo': 'São Paulo',
  'rio-de-janeiro': 'Rio de Janeiro',
  'minas-gerais': 'Minas Gerais',
  nordeste: 'Nordeste',
  sul: 'Sul',
  'centro-oeste': 'Centro-Oeste',
  norte: 'Norte',
  'prefer-not-to-say': 'Prefer not to say',
  unspecified: 'Not provided',
};

function regionLabel(key) {
  return REGION_LABELS[key] || key || 'Not provided';
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PtBrAdminPage() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Boot: check existing token -> verify admin role
  useEffect(() => {
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('sp_token') : null;
        if (!token) {
          setBooting(false);
          return;
        }
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setBooting(false);
          return;
        }
        const me = await res.json();
        if (me && ['admin', 'superadmin'].includes(me.role)) {
          setUser(me);
        }
      } catch (_) {
        // ignore
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Load waitlist data when authenticated
  useEffect(() => {
    if (user) loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData(nextPage = 1) {
    setLoadingData(true);
    setError('');
    try {
      const token = localStorage.getItem('sp_token');
      const res = await fetch(`/api/admin/waitlist/pt-br?page=${nextPage}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || 'Failed to load waitlist data');
        setLoadingData(false);
        return;
      }
      const payload = await res.json();
      setData(payload);
      setPage(nextPage);
    } catch (e) {
      setError(e?.message || 'Network error');
    }
    setLoadingData(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginErr('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPw }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.token) {
        setLoginErr(d?.error || 'Invalid credentials');
        setLoginLoading(false);
        return;
      }
      localStorage.setItem('sp_token', d.token);
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${d.token}` },
      });
      const me = await meRes.json();
      if (!['admin', 'superadmin'].includes(me?.role)) {
        setLoginErr('This account is not an admin.');
        localStorage.removeItem('sp_token');
        setLoginLoading(false);
        return;
      }
      setUser(me);
    } catch (err) {
      setLoginErr(err?.message || 'Login failed');
    }
    setLoginLoading(false);
  }

  function handleLogout() {
    localStorage.removeItem('sp_token');
    setUser(null);
    setData(null);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const token = localStorage.getItem('sp_token');
      const res = await fetch('/api/admin/waitlist/pt-br/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        alert('Export failed.');
        setExporting(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brazilian-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed.');
    }
    setExporting(false);
  }

  const chartData = useMemo(() => data?.stats?.by_day || [], [data]);
  const regionData = useMemo(() => {
    const total = data?.total || 0;
    return (data?.stats?.by_region || []).map((r) => ({
      region: regionLabel(r.region),
      count: r.count,
      pct: total ? ((r.count / total) * 100).toFixed(1) : '0.0',
    }));
  }, [data]);

  /* --------------------------- BOOT / LOGIN UI --------------------------- */
  if (booting) {
    return (
      <div className="min-h-screen bg-[#0D1217] text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#F64000] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0D1217] text-white flex flex-col">
        <nav className="border-b border-white/5">
          <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
            <Link href="/pt-br" className="flex items-center gap-2.5">
              <SoulPrintLogo size={26} />
              <span className="font-condensed font-bold text-lg tracking-wide uppercase">
                SoulPrint · Admin
              </span>
            </Link>
            <span className="text-xs text-gray-500">pt-BR metrics</span>
          </div>
        </nav>

        <main className="flex-1 flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#F64000]/15 flex items-center justify-center mb-4">
                <LogIn className="w-5 h-5 text-[#F64000]" />
              </div>
              <h1 className="font-condensed font-black text-2xl uppercase tracking-tight">
                Admin sign in
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                Admin or superadmin role required.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 text-white placeholder-gray-600 text-base py-3 px-4 rounded-xl focus:border-[#F64000]/60 focus:outline-none focus:ring-2 focus:ring-[#F64000]/20 transition-all"
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)}
                className="w-full bg-black/40 border border-white/10 text-white placeholder-gray-600 text-base py-3 px-4 rounded-xl focus:border-[#F64000]/60 focus:outline-none focus:ring-2 focus:ring-[#F64000]/20 transition-all"
              />
              {loginErr && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{loginErr}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#F64000] hover:bg-[#ff5a1f] text-white font-semibold text-sm uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  /* ----------------------------- DASHBOARD ----------------------------- */
  const total = data?.total ?? 0;
  const last24h = data?.stats?.last_24h ?? 0;
  const last7d = data?.stats?.last_7d ?? 0;
  const last30d = data?.stats?.last_30d ?? 0;
  const items = data?.items || [];
  const totalPages = data?.pagination?.total_pages || 1;

  return (
    <div className="min-h-screen bg-[#0D1217] text-white">
      <nav className="sticky top-0 z-30 bg-[#0D1217]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link href="/pt-br" className="flex items-center gap-2.5">
            <SoulPrintLogo size={26} />
            <span className="font-condensed font-bold text-lg tracking-wide uppercase">
              SoulPrint · Admin
            </span>
            <span className="ml-3 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#F64000]/15 text-[#ff7a3d] border border-[#F64000]/30">
              pt-BR
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-gray-500 mr-2">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => loadData(page)}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-gray-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {error && (
          <div className="mb-6 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Headline + export */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[#F64000] mb-1">
              Brazilian waitlist
            </div>
            <h1 className="font-condensed font-black text-3xl md:text-4xl uppercase tracking-tight">
              pt-BR signups overview
            </h1>
            {data?.generated_at && (
              <p className="text-xs text-gray-500 mt-1">
                Last updated {formatDate(data.generated_at)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-sm text-gray-200 font-medium transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <StatCard icon={Users} label="Total signups" value={total} accent />
          <StatCard icon={TrendingUp} label="Last 24h" value={last24h} />
          <StatCard icon={TrendingUp} label="Last 7d" value={last7d} />
          <StatCard icon={TrendingUp} label="Last 30d" value={last30d} />
        </div>

        {/* Chart + region breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2 p-5 md:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                30-day signup trend
              </h3>
              <span className="text-xs text-gray-500">Daily count</span>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orangeLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#F64000" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#ff7a3d" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={10}
                    tickFormatter={(v) => (v ? v.slice(5) : '')}
                  />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#111820',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="url(#orangeLine)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: '#F64000' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5 md:p-6 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-[#F64000]" />
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                By region
              </h3>
            </div>
            {regionData.length === 0 ? (
              <p className="text-sm text-gray-500">No data yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {regionData.map((r) => (
                  <li key={r.region}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-300">{r.region}</span>
                      <span className="text-gray-500">
                        {r.count} · {r.pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#F64000] rounded-full"
                        style={{ width: `${Math.min(100, parseFloat(r.pct))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent signups table */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Recent signups
            </h3>
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
          </div>

          {loadingData ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              No signups yet. Share the link!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-white/5">
                    <th className="text-left font-medium px-5 md:px-6 py-3">Email</th>
                    <th className="text-left font-medium px-4 py-3">Region</th>
                    <th className="text-left font-medium px-4 py-3">Source</th>
                    <th className="text-left font-medium px-5 md:px-6 py-3">Signed up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 md:px-6 py-3 font-mono text-xs md:text-sm text-gray-200">
                        {it.email}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {regionLabel(it.region)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {it.source || '—'}
                      </td>
                      <td className="px-5 md:px-6 py-3 text-gray-400 text-xs md:text-sm whitespace-nowrap">
                        {formatDate(it.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 md:px-6 py-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => loadData(Math.max(1, page - 1))}
                disabled={page <= 1 || loadingData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <span className="text-xs text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => loadData(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || loadingData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div
      className={`p-4 md:p-5 rounded-2xl border ${
        accent ? 'bg-[#F64000]/10 border-[#F64000]/30' : 'bg-white/[0.03] border-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-gray-400">
          {label}
        </span>
        <Icon className={`w-4 h-4 ${accent ? 'text-[#F64000]' : 'text-gray-500'}`} />
      </div>
      <div className="font-condensed font-black text-3xl md:text-4xl">
        {(value || 0).toLocaleString('en-US')}
      </div>
    </div>
  );
}
