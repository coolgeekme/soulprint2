'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, BarChart2, MessageSquare, Upload, Settings, Shield,
  Search, ChevronLeft, Check, X, RefreshCw, TrendingUp,
  UserCheck, Clock, FileText, ThumbsUp, AlertCircle, Loader2, Database
} from 'lucide-react';

function SoulPrintLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <path d="M40 8 C55 8, 70 18, 70 35 C70 52, 55 62, 40 55 C25 48, 15 35, 22 22 C29 9, 42 12, 48 20 C54 28, 50 40, 42 44 C34 48, 28 42, 30 36 C32 30, 38 28, 42 32" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9"/>
      <path d="M40 14 C52 14, 64 22, 64 36 C64 50, 52 58, 40 52 C28 46, 20 34, 26 24 C32 14, 44 16, 49 23 C54 30, 51 40, 44 43 C37 46, 32 41, 34 36 C36 31, 40 30, 43 33" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6"/>
    </svg>
  );
}

const TABS = [
  { id: 'metrics', label: 'Metrics', icon: BarChart2 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'assessments', label: 'Assessments', icon: FileText },
  { id: 'imports', label: 'Imports', icon: Upload },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function MetricCard({ label, value, sub, icon: Icon, color = 'orange' }) {
  const colors = {
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };
  return (
    <div className="bg-[#111] border border-white/8 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-500 text-xs font-bold tracking-widest uppercase">{label}</p>
        {Icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colors[color]}`}><Icon className="w-4 h-4" /></div>}
      </div>
      <p className="text-3xl font-bold text-white font-condensed">{value ?? '—'}</p>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// Users Tab
function UsersTab({ token, adminRole }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [resetUserId, setResetUserId] = useState(null);
  const [newPasscode, setNewPasscode] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?search=${search}&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setUsers(d.users || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, page]);

  async function toggleAccepted(userId, current) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accepted: !current }),
    });
    load();
  }

  async function changeRole(userId, role) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function resetPasscode(userId) {
    if (!newPasscode) return;
    await fetch(`/api/admin/users/${userId}/reset-passcode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ new_passcode: newPasscode }),
    });
    setResetUserId(null);
    setNewPasscode('');
    alert('Passcode reset successfully');
  }

  async function inviteAdmin() {
    if (!inviteEmail) return;
    await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: inviteEmail }),
    });
    setInviteEmail('');
    load();
    alert(`${inviteEmail} promoted to admin`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email..."
            className="w-full bg-[#111] border border-white/10 text-white text-sm pl-9 pr-4 py-2.5 rounded-xl focus:border-orange-500/40 transition-colors"
          />
        </div>
        <button onClick={load} className="p-2.5 bg-[#111] border border-white/10 rounded-xl text-gray-500 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {adminRole === 'superadmin' && (
        <div className="flex gap-2 p-4 bg-[#111] border border-white/8 rounded-xl">
          <input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="Email to promote to admin..."
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none"
          />
          <button onClick={inviteAdmin} className="btn-orange px-4 py-1.5 rounded-lg text-xs">
            Promote to Admin
          </button>
        </div>
      )}

      <div className="text-xs text-gray-600">{total} total users</div>

      <div className="overflow-x-auto">
        <table className="w-full admin-table">
          <thead>
            <tr className="border-b border-white/5">
              {['Email', 'Role', 'Accepted', 'Onboarding', 'Assessment', 'Last Active', 'Actions'].map(h => (
                <th key={h} className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-600"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-white/3">
                <td className="py-3 pr-4">
                  <div>
                    <p className="text-white text-xs">{u.email}</p>
                    {u.display_name && <p className="text-gray-600 text-[10px]">{u.display_name}</p>}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    u.role === 'superadmin' ? 'bg-purple-500/20 text-purple-400' :
                    u.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <button onClick={() => toggleAccepted(u.id, u.accepted)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${u.accepted ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {u.accepted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </button>
                </td>
                <td className="py-3 pr-4">
                  <span className={`text-[10px] ${u.onboarding_complete ? 'text-green-400' : 'text-gray-600'}`}>
                    {u.onboarding_complete ? '✓' : '—'}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`text-[10px] ${u.assessment_complete ? 'text-green-400' : 'text-gray-600'}`}>
                    {u.assessment_complete ? '✓' : '—'}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-gray-600 text-[10px]">
                    {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : '—'}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {adminRole === 'superadmin' && (
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value)}
                        className="bg-[#1a1a1a] border border-white/10 text-xs text-gray-400 rounded px-2 py-1"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="superadmin">superadmin</option>
                      </select>
                    )}
                    {resetUserId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input value={newPasscode} onChange={e => setNewPasscode(e.target.value)}
                          placeholder="new passcode" className="bg-[#1a1a1a] border border-white/10 text-xs text-white rounded px-2 py-1 w-28" />
                        <button onClick={() => resetPasscode(u.id)} className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-1 rounded">Set</button>
                        <button onClick={() => setResetUserId(null)} className="text-gray-600 hover:text-white"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setResetUserId(u.id)} className="text-[10px] text-gray-600 hover:text-orange-400 transition-colors">Reset</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2 justify-center mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-xs text-gray-500 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-[#111] border border-white/10 rounded-lg">Prev</button>
          <span className="text-xs text-gray-600">{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="text-xs text-gray-500 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-[#111] border border-white/10 rounded-lg">Next</button>
        </div>
      )}
    </div>
  );
}

// Conversations Tab
function ConversationsTab({ token }) {
  const [convs, setConvs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/conversations?page=${page}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setConvs(d.conversations || []); setPages(d.pages || 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      {loading ? <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div> : (
        <table className="w-full admin-table">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'Title', 'Created', 'Last Active'].map(h => (
                <th key={h} className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {convs.map(c => (
              <tr key={c.id} className="border-b border-white/3">
                <td className="py-3 pr-4 text-gray-400 text-xs">{c.user_email}</td>
                <td className="py-3 pr-4 text-white text-xs truncate max-w-[200px]">{c.title}</td>
                <td className="py-3 pr-4 text-gray-600 text-[10px]">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="py-3 pr-4 text-gray-600 text-[10px]">{new Date(c.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-2 justify-center mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-xs text-gray-500 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-[#111] border border-white/10 rounded-lg">Prev</button>
          <span className="text-xs text-gray-600">{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="text-xs text-gray-500 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-[#111] border border-white/10 rounded-lg">Next</button>
        </div>
      )}
    </div>
  );
}

// Imports Tab
function ImportsTab({ token }) {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/imports', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setImports(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {loading ? <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div> : (
        <table className="w-full admin-table">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'File', 'Type', 'Status', 'Date', 'Error'].map(h => (
                <th key={h} className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {imports.map(i => (
              <tr key={i.id} className="border-b border-white/3">
                <td className="py-3 pr-4 text-gray-400 text-xs">{i.user_email}</td>
                <td className="py-3 pr-4 text-white text-xs truncate max-w-[150px]">{i.file_name}</td>
                <td className="py-3 pr-4">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{i.type}</span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    i.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                    i.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    'bg-orange-500/20 text-orange-400'
                  }`}>{i.status}</span>
                </td>
                <td className="py-3 pr-4 text-gray-600 text-[10px]">{new Date(i.created_at).toLocaleDateString()}</td>
                <td className="py-3 pr-4 text-red-400 text-[10px] max-w-[150px] truncate">{i.error || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Assessments Tab
function AssessmentsTab({ token }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/questions', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setQuestions(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function seedQuestions() {
    await fetch('/api/admin/questions/seed', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    window.location.reload();
  }

  async function saveEdit(qId) {
    await fetch(`/api/admin/questions/${qId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question_text: editText }),
    });
    setQuestions(qs => qs.map(q => q.id === qId ? { ...q, question_text: editText } : q));
    setEditing(null);
  }

  async function toggleActive(qId, current) {
    await fetch(`/api/admin/questions/${qId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active: !current }),
    });
    setQuestions(qs => qs.map(q => q.id === qId ? { ...q, active: !current } : q));
  }

  const PILLAR_COLORS = {
    communication: 'text-blue-400',
    emotional_intelligence: 'text-pink-400',
    decision_making: 'text-yellow-400',
    social_dynamics: 'text-green-400',
    cognitive_style: 'text-purple-400',
    assertiveness: 'text-orange-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-xs">{questions.length} questions total</p>
        <button onClick={seedQuestions} className="btn-orange px-4 py-2 rounded-lg text-xs">
          Re-seed 36 Questions
        </button>
      </div>
      {loading ? <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div> : (
        <div className="space-y-2">
          {questions.map(q => (
            <div key={q.id} className={`p-4 bg-[#111] border rounded-xl transition-all ${q.active ? 'border-white/8' : 'border-white/3 opacity-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-gray-600">#{q.order_index}</span>
                    <span className={`text-[10px] font-bold tracking-widest uppercase ${PILLAR_COLORS[q.pillar] || 'text-gray-400'}`}>{q.pillar?.replace('_', ' ')}</span>
                  </div>
                  {editing === q.id ? (
                    <div className="flex gap-2">
                      <textarea value={editText} onChange={e => setEditText(e.target.value)}
                        className="flex-1 bg-[#0a0a0a] border border-orange-500/30 text-white text-sm p-2 rounded-lg resize-none" rows={2} />
                      <div className="flex flex-col gap-1">
                        <button onClick={() => saveEdit(q.id)} className="text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(null)} className="text-gray-600 hover:text-gray-400"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-300 text-sm">{q.question_text}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => { setEditing(q.id); setEditText(q.question_text); }}
                    className="text-gray-600 hover:text-orange-400 transition-colors text-xs">Edit</button>
                  <button onClick={() => toggleActive(q.id, q.active)}
                    className={`text-xs transition-colors ${q.active ? 'text-green-400 hover:text-red-400' : 'text-gray-600 hover:text-green-400'}`}>
                    {q.active ? 'Active' : 'Off'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Settings Tab
function SettingsTab({ token }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tgSetup, setTgSetup] = useState(null);
  const [tgLoading, setTgLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setSettings).catch(() => {});
  }, []);

  async function save() {
    setLoading(true);
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings),
    });
    setLoading(false);
    alert('Settings saved');
  }

  async function setupTelegram() {
    setTgLoading(true);
    try {
      const res = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setTgSetup(d);
    } catch (e) { setTgSetup({ error: e.message }); }
    setTgLoading(false);
  }

  if (!settings) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <label className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2 block">Default Model</label>
        <select value={settings.default_model || 'gpt-4o'} onChange={e => setSettings(s => ({ ...s, default_model: e.target.value }))}
          className="bg-[#111] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 w-full focus:border-orange-500/40 transition-colors">
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
          <option value="gpt-4.1">GPT-4.1</option>
          <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
        </select>
      </div>
      <div>
        <label className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2 block">Waitlist Enabled</label>
        <div className="flex items-center gap-3">
          <button onClick={() => setSettings(s => ({ ...s, waitlist_enabled: !s.waitlist_enabled }))}
            className={`w-12 h-6 rounded-full transition-all relative ${settings.waitlist_enabled ? 'bg-orange-500' : 'bg-white/10'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.waitlist_enabled ? 'right-1' : 'left-1'}`} />
          </button>
          <span className="text-gray-400 text-sm">{settings.waitlist_enabled ? 'New users go to waitlist' : 'Auto-accept all users'}</span>
        </div>
      </div>

      {/* Telegram Setup */}
      <div>
        <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-3">Telegram Bot</p>
        <div className="p-4 bg-[#111] border border-white/8 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#229ED9"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.012 9.483c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.496.969z"/></svg>
              <span className="text-white text-sm">Telegram Connector</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${tgSetup?.configured ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-500'}`}>
              {tgSetup?.configured ? `LIVE · ${tgSetup.linkedUsers || 0} users linked` : 'NOT SET UP'}
            </span>
          </div>
          <p className="text-gray-600 text-xs">Register the webhook so Telegram can deliver messages to SoulPrint. Requires <code className="bg-white/10 px-1 rounded">TELEGRAM_BOT_TOKEN</code> in .env.</p>
          <button onClick={setupTelegram} disabled={tgLoading}
            className="btn-orange px-4 py-2 rounded-lg text-xs disabled:opacity-50 flex items-center gap-2">
            {tgLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Setting up...</> : '🔗 Register Webhook'}
          </button>
          {tgSetup && (
            <div className={`text-xs p-3 rounded-lg ${tgSetup.webhook?.ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {tgSetup.webhook?.ok
                ? `✅ Webhook set! Bot: @${tgSetup.bot?.username} · Secret: ${tgSetup.secretProtected ? '🔒 Protected' : '⚠️ Unprotected (add TELEGRAM_WEBHOOK_SECRET)'}`
                : `❌ ${JSON.stringify(tgSetup)}`}
            </div>
          )}
          {!tgSetup && (
            <div className="text-xs text-gray-600 p-3 rounded-lg bg-white/3 border border-white/5 space-y-1">
              <p className="font-semibold text-gray-500">To activate Telegram:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open Telegram → search @BotFather → /newbot</li>
                <li>Copy the token it gives you</li>
                <li>Add <code className="bg-white/10 px-1 rounded">TELEGRAM_BOT_TOKEN=your_token</code> to .env</li>
                <li>Optional: add <code className="bg-white/10 px-1 rounded">TELEGRAM_WEBHOOK_SECRET=random_string</code></li>
                <li>Restart the server, then click Register Webhook above</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Other Connectors</p>
        <div className="space-y-2">
          {['discord', 'whatsapp', 'sms'].map(c => (
            <div key={c} className="flex items-center justify-between p-3 bg-[#111] border border-white/8 rounded-xl">
              <span className="text-gray-400 text-sm capitalize">{c}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-500 font-bold">COMING SOON</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={loading} className="btn-orange px-6 py-2.5 rounded-xl text-sm disabled:opacity-50">
        {loading ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('metrics');
  const [metrics, setMetrics] = useState(null);
  const [token, setToken] = useState('');
  const [adminRole, setAdminRole] = useState('admin');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('sp_token');
    if (!t) { router.push('/auth'); return; }
    setToken(t);

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        if (!['admin', 'superadmin'].includes(d.role)) {
          router.push('/app');
          return;
        }
        setAdminRole(d.role);
        setLoading(false);
      })
      .catch(() => router.push('/auth'));

    fetch('/api/admin/metrics', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(setMetrics)
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-[#0f0f0f] border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <SoulPrintLogo size={22} />
            <span className="font-condensed font-bold text-white text-sm tracking-widest uppercase">SoulPrint</span>
          </div>
          <span className="text-[10px] text-orange-500/70 font-bold tracking-widest uppercase flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> Admin Panel
          </span>
        </div>
        <nav className="flex-1 p-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all mb-1 ${activeTab === tab.id ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'}`}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-1">
          <button onClick={() => router.push('/app')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors rounded-lg hover:bg-white/3">
            <MessageSquare className="w-3.5 h-3.5" /> Go to Chat
          </button>
          <button onClick={() => { localStorage.clear(); router.push('/auth'); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-white/3">
            <ChevronLeft className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-white">
                {TABS.find(t => t.id === activeTab)?.label}
              </h1>
              <p className="text-gray-600 text-xs mt-0.5 capitalize">{adminRole} access</p>
            </div>
          </div>

          {activeTab === 'metrics' && metrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Users" value={metrics.total_users} icon={Users} color="orange" />
                <MetricCard label="WAU" value={metrics.wau} sub="Weekly Active Users" icon={TrendingUp} color="green" />
                <MetricCard label="Day 7 Retention" value={metrics.day7_retention != null ? `${metrics.day7_retention}%` : '—'} icon={UserCheck} color="blue" />
                <MetricCard label="CSAT" value={metrics.csat != null ? `${metrics.csat}%` : '—'} sub={`${metrics.thumbs_up || 0}↑ ${metrics.thumbs_down || 0}↓`} icon={ThumbsUp} color="purple" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Avg Sessions/User (7d)" value={metrics.avg_sessions_per_user_7d} icon={Clock} color="orange" />
                <MetricCard label="Msgs/Session" value={metrics.avg_messages_per_session} icon={MessageSquare} color="green" />
                <MetricCard label="Assessment Rate" value={`${metrics.assessment_completion_rate}%`} icon={FileText} color="blue" />
                <MetricCard label="Import Rate" value={`${metrics.import_adoption_rate}%`} icon={Upload} color="purple" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard label="Multi-Session Rate" value={`${metrics.multi_session_rate}%`} sub="Users with 2+ conversations" icon={Database} color="orange" />
                <MetricCard label="Total Messages" value={metrics.total_messages} icon={MessageSquare} color="green" />
                <MetricCard label="New Users (30d)" value={metrics.recent_signups_30d} icon={Users} color="blue" />
              </div>
            </div>
          )}

          {activeTab === 'users' && token && (
            <UsersTab token={token} adminRole={adminRole} />
          )}

          {activeTab === 'conversations' && token && (
            <ConversationsTab token={token} />
          )}

          {activeTab === 'assessments' && token && (
            <AssessmentsTab token={token} />
          )}

          {activeTab === 'imports' && token && (
            <ImportsTab token={token} />
          )}

          {activeTab === 'settings' && token && (
            <SettingsTab token={token} />
          )}
        </div>
      </div>
    </div>
  );
}
