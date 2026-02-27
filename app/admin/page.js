'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, BarChart2, MessageSquare, Upload, Settings, Shield,
  Search, ChevronLeft, Check, X, RefreshCw, TrendingUp,
  UserCheck, Clock, FileText, ThumbsUp, AlertCircle, Loader2, Database,
  DollarSign, Zap, ListChecks, MessageCircle, Sparkles, Megaphone, Plus, Link, Edit, Trash2,
  PenSquare, Eye, EyeOff, Image, Tag
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

const TABS = [
  { id: 'metrics', label: 'Metrics', icon: BarChart2 },
  { id: 'waitlist', label: 'Waitlist', icon: ListChecks },
  { id: 'users', label: 'All Users', icon: Users },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'blog', label: 'Blog', icon: PenSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'feedback', label: 'Feedback', icon: MessageCircle },
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
    <div className="bg-[#111] border border-white/8 rounded-xl p-3 sm:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <p className="text-gray-500 text-[10px] sm:text-xs font-bold tracking-widest uppercase truncate pr-2">{label}</p>
        {Icon && <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${colors[color]}`}><Icon className="w-3 h-3 sm:w-4 sm:h-4" /></div>}
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-white font-condensed">{value ?? '—'}</p>
      {sub && <p className="text-gray-600 text-[10px] sm:text-xs mt-1 truncate">{sub}</p>}
    </div>
  );
}

// Waitlist Tab
function WaitlistTab({ token, onCountChange }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/waitlist?search=${search}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setUsers(d.users || []);
      onCountChange?.(d.count || 0);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [search]);

  async function approveUser(userId) {
    setActionLoading(l => ({ ...l, [userId]: 'approve' }));
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accepted: true }),
    });
    setActionLoading(l => ({ ...l, [userId]: null }));
    load();
  }

  async function denyUser(userId) {
    setActionLoading(l => ({ ...l, [userId]: 'deny' }));
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accepted: false }),
    });
    setActionLoading(l => ({ ...l, [userId]: null }));
    load();
  }

  async function approveAll() {
    if (!confirm(`Approve all ${users.length} waitlisted users?`)) return;
    setLoading(true);
    await fetch('/api/admin/waitlist/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approve_all: true }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email..."
            className="w-full bg-[#111] border border-white/10 text-white text-sm pl-9 pr-4 py-2.5 rounded-xl focus:border-orange-500/40 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2.5 bg-[#111] border border-white/10 rounded-xl text-gray-500 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {users.length > 0 && (
            <button onClick={approveAll}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500/15 border border-green-500/30 text-green-400 text-sm rounded-xl hover:bg-green-500/25 transition-colors font-medium">
              <Check className="w-4 h-4" />
              <span className="hidden sm:inline">Approve All</span>
              <span className="sm:hidden">Approve</span>
              ({users.length})
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600">{users.length} user{users.length !== 1 ? 's' : ''} waiting</span>
        {users.length > 0 && (
          <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[9px] font-bold flex items-center justify-center">
            {users.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No users on the waitlist</p>
          <p className="text-xs mt-1">Everyone has been approved</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-[#111] border border-white/8 rounded-xl px-4 sm:px-5 py-4 hover:border-white/15 transition-colors">
              {/* User info row */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-sm flex-shrink-0">
                  {(u.name || u.email || '?').charAt(0).toUpperCase()}
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{u.email}</p>
                  {u.name && <p className="text-gray-500 text-xs truncate">{u.name}</p>}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                    <span className="text-[10px] text-gray-700">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </span>
                    {u.onboarding_complete && (
                      <span className="text-[10px] text-blue-400/80 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Onboarded
                      </span>
                    )}
                    {u.assessment_complete && (
                      <span className="text-[10px] text-purple-400/80 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Assessment
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-12 sm:ml-0">
                <button
                  onClick={() => approveUser(u.id)}
                  disabled={!!actionLoading[u.id]}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-green-500/15 border border-green-500/30 text-green-400 text-xs rounded-lg hover:bg-green-500/25 transition-colors font-medium disabled:opacity-50"
                >
                  {actionLoading[u.id] === 'approve'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Check className="w-3 h-3" />
                  }
                  Approve
                </button>
                <button
                  onClick={() => denyUser(u.id)}
                  disabled={!!actionLoading[u.id]}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/8 border border-red-500/20 text-red-500/70 text-xs rounded-lg hover:bg-red-500/15 hover:text-red-400 transition-colors font-medium disabled:opacity-50"
                >
                  {actionLoading[u.id] === 'deny'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <X className="w-3 h-3" />
                  }
                  <span className="hidden sm:inline">Deny</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
  
  // Add/Edit user state
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ email: '', passcode: '', display_name: '', role: 'user', accepted: true });
  const [saving, setSaving] = useState(false);

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

  // Create or Update user
  async function handleSaveUser() {
    if (!userFormData.email) {
      alert('Email is required');
      return;
    }
    if (!editingUser && !userFormData.passcode) {
      alert('Passcode is required for new users');
      return;
    }
    
    setSaving(true);
    try {
      if (editingUser) {
        // Update existing user
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: userFormData.email,
            display_name: userFormData.display_name,
            role: userFormData.role,
            accepted: userFormData.accepted,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update user');
      } else {
        // Create new user
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(userFormData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create user');
      }
      setShowUserForm(false);
      setEditingUser(null);
      setUserFormData({ email: '', passcode: '', display_name: '', role: 'user', accepted: true });
      load();
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  }

  // Delete user
  async function handleDeleteUser(user) {
    if (!confirm(`Are you sure you want to delete ${user.email}? This will also delete all their conversations, messages, and data. This cannot be undone.`)) return;
    
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  // Open edit form
  function openEditForm(user) {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      passcode: '',
      display_name: user.display_name || '',
      role: user.role || 'user',
      accepted: user.accepted ?? true,
    });
    setShowUserForm(true);
  }

  // Open create form
  function openCreateForm() {
    setEditingUser(null);
    setUserFormData({ email: '', passcode: '', display_name: '', role: 'user', accepted: true });
    setShowUserForm(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email..."
            className="w-full bg-[#111] border border-white/10 text-white text-sm pl-9 pr-4 py-2.5 rounded-xl focus:border-orange-500/40 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2.5 bg-[#111] border border-white/10 rounded-xl text-gray-500 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {adminRole === 'superadmin' && (
            <button onClick={openCreateForm} className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add User
            </button>
          )}
        </div>
      </div>

      {/* User Form Modal */}
      {showUserForm && (
        <div className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold">{editingUser ? 'Edit User' : 'Create New User'}</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-500 text-xs mb-1">Email *</label>
              <input
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                placeholder="user@example.com"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
              />
            </div>
            {!editingUser && (
              <div>
                <label className="block text-gray-500 text-xs mb-1">Passcode *</label>
                <input
                  type="text"
                  value={userFormData.passcode}
                  onChange={(e) => setUserFormData({ ...userFormData, passcode: e.target.value })}
                  placeholder="Initial passcode"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-gray-500 text-xs mb-1">Display Name</label>
              <input
                type="text"
                value={userFormData.display_name}
                onChange={(e) => setUserFormData({ ...userFormData, display_name: e.target.value })}
                placeholder="John Doe"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-500 text-xs mb-1">Role</label>
              <select
                value={userFormData.role}
                onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="userAccepted"
              checked={userFormData.accepted}
              onChange={(e) => setUserFormData({ ...userFormData, accepted: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-[#0a0a0a]"
            />
            <label htmlFor="userAccepted" className="text-gray-400 text-sm">Account accepted (can log in)</label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveUser}
              disabled={saving}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
            </button>
            <button
              onClick={() => { setShowUserForm(false); setEditingUser(null); }}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {adminRole === 'superadmin' && !showUserForm && (
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {adminRole === 'superadmin' && (
                      <>
                        <select
                          value={u.role}
                          onChange={e => changeRole(u.id, e.target.value)}
                          className="bg-[#1a1a1a] border border-white/10 text-xs text-gray-400 rounded px-2 py-1"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="superadmin">superadmin</option>
                        </select>
                        <button 
                          onClick={() => openEditForm(u)} 
                          className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {u.role !== 'superadmin' && (
                          <button 
                            onClick={() => handleDeleteUser(u)} 
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
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
      <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-blue-400 text-xs">🔒 <strong>Privacy Mode:</strong> Conversation content is not visible to admins. Only general topic categories are shown.</p>
      </div>
      {loading ? <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div> : (
        <table className="w-full admin-table">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'Topic Category', 'Messages', 'Created', 'Last Active'].map(h => (
                <th key={h} className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {convs.map(c => (
              <tr key={c.id} className="border-b border-white/3">
                <td className="py-3 pr-4 text-gray-400 text-xs">{c.user_email}</td>
                <td className="py-3 pr-4 text-white text-xs">{c.topic || '💬 General Chat'}</td>
                <td className="py-3 pr-4 text-gray-500 text-xs">{c.message_count || '—'}</td>
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

// Announcements Tab
function AnnouncementsTab({ token }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '', type: 'info', link: '', published: false });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/announcements', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setAnnouncements(d.announcements || []);
    } catch (e) {
      console.error('Failed to load announcements:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/admin/announcements/${editing}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch('/api/admin/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData),
        });
      }
      setShowForm(false);
      setEditing(null);
      setFormData({ title: '', content: '', type: 'info', link: '', published: false });
      load();
    } catch (e) {
      alert('Failed to save announcement');
    }
    setSaving(false);
  };

  const handleEdit = (ann) => {
    setEditing(ann.id);
    setFormData({
      title: ann.title,
      content: ann.content,
      type: ann.type || 'info',
      link: ann.link || '',
      published: ann.published,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await fetch(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (e) {
      alert('Failed to delete announcement');
    }
  };

  const togglePublish = async (ann) => {
    try {
      await fetch(`/api/admin/announcements/${ann.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ published: !ann.published }),
      });
      load();
    } catch (e) {
      alert('Failed to update announcement');
    }
  };

  const typeColors = {
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warning: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    update: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Announcements</h2>
          <p className="text-xs text-gray-500">Create and manage announcements for users</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setFormData({ title: '', content: '', type: 'info', link: '', published: false }); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold">{editing ? 'Edit Announcement' : 'Create Announcement'}</h3>
          
          <div>
            <label className="block text-gray-500 text-xs mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Announcement title..."
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-500 text-xs mb-1">Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Announcement message..."
              rows={3}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-500 text-xs mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
              >
                <option value="info">ℹ️ Info</option>
                <option value="update">🚀 Update</option>
                <option value="warning">⚠️ Warning</option>
                <option value="success">✅ Success</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-500 text-xs mb-1">Link (optional)</label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="https://..."
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="published"
              checked={formData.published}
              onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-[#0a0a0a]"
            />
            <label htmlFor="published" className="text-gray-400 text-sm">Publish immediately</label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditing(null); }}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Announcements List */}
      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(ann => (
            <div key={ann.id} className={`bg-[#111] border rounded-xl p-4 ${ann.published ? 'border-green-500/30' : 'border-white/10'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${typeColors[ann.type] || typeColors.info}`}>
                      {ann.type === 'info' ? 'ℹ️' : ann.type === 'update' ? '🚀' : ann.type === 'warning' ? '⚠️' : '✅'} {ann.type}
                    </span>
                    {ann.published ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Published</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">Draft</span>
                    )}
                    {ann.link && (
                      <a href={ann.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        <Link className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <h4 className="text-white font-medium mb-1">{ann.title}</h4>
                  <p className="text-gray-400 text-sm">{ann.content}</p>
                  <p className="text-gray-600 text-[10px] mt-2">{new Date(ann.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => togglePublish(ann)}
                    className={`p-2 rounded-lg text-xs transition-colors ${ann.published ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    title={ann.published ? 'Unpublish' : 'Publish'}
                  >
                    {ann.published ? <Check className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(ann)}
                    className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(ann.id)}
                    className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
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

// Feedback Tab
function FeedbackTab({ token }) {
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats] = useState({ total: 0, new: 0, reviewed: 0, resolved: 0 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/admin/feedback?status=${statusFilter}` : '/api/admin/feedback';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setFeedback(d.feedback || []);
      setStats(d.stats || { total: 0, new: 0, reviewed: 0, resolved: 0 });
    } catch (e) {
      console.error('Failed to load feedback:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const summarizeFeedback = async () => {
    setSummarizing(true);
    setSummary(null);
    try {
      const res = await fetch('/api/admin/feedback/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: statusFilter || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to summarize');
      setSummary(d);
    } catch (e) {
      alert('Failed to generate summary: ' + e.message);
    }
    setSummarizing(false);
  };

  const updateStatus = async (feedbackId, newStatus) => {
    setActionLoading(l => ({ ...l, [feedbackId]: true }));
    try {
      await fetch(`/api/admin/feedback/${feedbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      load();
    } catch (e) {}
    setActionLoading(l => ({ ...l, [feedbackId]: false }));
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'bug': return '🐛';
      case 'feature': return '💡';
      case 'other': return '📝';
      default: return '💬';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111] border border-white/8 rounded-xl p-4 text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setStatusFilter('')}>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">Total</p>
        </div>
        <div className="bg-[#111] border border-orange-500/30 rounded-xl p-4 text-center cursor-pointer hover:bg-orange-500/10 transition-colors" onClick={() => setStatusFilter('new')}>
          <p className="text-2xl font-bold text-orange-400">{stats.new}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">New</p>
        </div>
        <div className="bg-[#111] border border-blue-500/30 rounded-xl p-4 text-center cursor-pointer hover:bg-blue-500/10 transition-colors" onClick={() => setStatusFilter('reviewed')}>
          <p className="text-2xl font-bold text-blue-400">{stats.reviewed}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">Reviewed</p>
        </div>
        <div className="bg-[#111] border border-green-500/30 rounded-xl p-4 text-center cursor-pointer hover:bg-green-500/10 transition-colors" onClick={() => setStatusFilter('resolved')}>
          <p className="text-2xl font-bold text-green-400">{stats.resolved}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">Resolved</p>
        </div>
      </div>

      {/* Summarize button */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={summarizeFeedback}
          disabled={summarizing || feedback.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {summarizing ? 'Generating Summary...' : 'AI Summarize Feedback'}
        </button>
        {statusFilter && (
          <button onClick={() => setStatusFilter('')} className="text-gray-500 hover:text-white text-xs flex items-center gap-1">
            <X className="w-3 h-3" /> Clear filter
          </button>
        )}
        <button onClick={load} className="text-gray-500 hover:text-white text-xs flex items-center gap-1 ml-auto">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Summary display */}
      {summary && (
        <div className="bg-gradient-to-br from-purple-500/10 to-orange-500/10 border border-purple-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI Summary ({summary.feedbackCount} feedback items)
            </h4>
            <button onClick={() => setSummary(null)} className="text-gray-600 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{summary.summary}</div>
        </div>
      )}

      {/* Feedback list */}
      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No feedback {statusFilter ? `with status "${statusFilter}"` : 'yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map(f => (
            <div key={f.id} className="bg-[#111] border border-white/8 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{getCategoryIcon(f.category)}</span>
                  <span className="text-white text-sm font-medium">{f.user_email}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
                    f.category === 'bug' ? 'bg-red-500/20 text-red-400' :
                    f.category === 'feature' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{f.category}</span>
                  {f.rating && (
                    <span className="text-orange-400 text-xs">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                  )}
                </div>
                <span className="text-gray-600 text-[10px] whitespace-nowrap">{new Date(f.created_at).toLocaleString()}</span>
              </div>
              <p className="text-gray-300 text-sm mb-4 whitespace-pre-wrap">{f.message}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-gray-600 mr-2">Status:</span>
                {['new', 'reviewed', 'resolved'].map(status => (
                  <button
                    key={status}
                    onClick={() => updateStatus(f.id, status)}
                    disabled={actionLoading[f.id]}
                    className={`text-[10px] px-2 py-1 rounded-full capitalize transition-all ${
                      f.status === status
                        ? status === 'new' ? 'bg-orange-500/30 text-orange-400 border border-orange-500/50'
                        : status === 'reviewed' ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                        : 'bg-green-500/30 text-green-400 border border-green-500/50'
                        : 'bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {actionLoading[f.id] ? '...' : status}
                  </button>
                ))}
              </div>
            </div>
          ))}
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

      {/* Assessment Mode */}
      <div>
        <label className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2 block">Assessment Mode</label>
        <p className="text-gray-600 text-xs mb-3">Choose which assessment options users see during onboarding.</p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 bg-[#111] border border-white/8 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
            <input
              type="radio"
              name="assessment_mode"
              value="both"
              checked={(settings.assessment_mode || 'both') === 'both'}
              onChange={e => setSettings(s => ({ ...s, assessment_mode: e.target.value }))}
              className="accent-orange-500"
            />
            <div>
              <span className="text-white text-sm">Both Options</span>
              <p className="text-gray-500 text-xs">User chooses between Quick Start or Full Assessment</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 bg-[#111] border border-white/8 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
            <input
              type="radio"
              name="assessment_mode"
              value="quick_only"
              checked={settings.assessment_mode === 'quick_only'}
              onChange={e => setSettings(s => ({ ...s, assessment_mode: e.target.value }))}
              className="accent-orange-500"
            />
            <div>
              <span className="text-white text-sm">Quick Start Only</span>
              <p className="text-gray-500 text-xs">10 questions + learns as they chat (~2 min)</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 bg-[#111] border border-white/8 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
            <input
              type="radio"
              name="assessment_mode"
              value="full_only"
              checked={settings.assessment_mode === 'full_only'}
              onChange={e => setSettings(s => ({ ...s, assessment_mode: e.target.value }))}
              className="accent-orange-500"
            />
            <div>
              <span className="text-white text-sm">Full Assessment Only</span>
              <p className="text-gray-500 text-xs">36 questions across 6 pillars (~5-7 min)</p>
            </div>
          </label>
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
  const [waitlistCount, setWaitlistCount] = useState(0);

  const loadMetrics = (t) => {
    fetch('/api/admin/metrics', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        setMetrics(d);
        setWaitlistCount(d.waitlist_count || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    const t = localStorage.getItem('sp_token');
    if (!t) { router.push('/auth'); return; }
    setToken(t);

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        if (!['admin', 'superadmin'].includes(d.role)) {
          router.push('/chat');
          return;
        }
        setAdminRole(d.role);
        setLoading(false);
      })
      .catch(() => router.push('/auth'));

    loadMetrics(t);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Cost by model table helper
  const costByModelEntries = metrics?.cost_by_model
    ? Object.entries(metrics.cost_by_model).sort((a, b) => b[1].cost - a[1].cost)
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#0f0f0f] sticky top-0 z-20 safe-area-top">
        <div className="flex items-center gap-2">
          <SoulPrintLogo size={20} />
          <span className="font-condensed font-bold text-white text-sm tracking-widest uppercase">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <a 
            href="/chat" 
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white text-xs transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </a>
          <select 
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          >
            {TABS.map(tab => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-56 flex-shrink-0 bg-[#0f0f0f] border-r border-white/5 flex-col">
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
            const isWaitlist = tab.id === 'waitlist';
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all mb-1 ${activeTab === tab.id ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'}`}>
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{tab.label}</span>
                {isWaitlist && waitlistCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    {waitlistCount > 99 ? '99+' : waitlistCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-1">
          <button onClick={() => router.push('/chat')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors rounded-lg hover:bg-white/3">
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
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                {TABS.find(t => t.id === activeTab)?.label}
                {activeTab === 'waitlist' && waitlistCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                    {waitlistCount} pending
                  </span>
                )}
              </h1>
              <p className="text-gray-600 text-xs mt-0.5 capitalize">{adminRole} access</p>
            </div>
            {activeTab === 'metrics' && (
              <button onClick={() => loadMetrics(token)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors px-3 py-1.5 bg-white/3 border border-white/8 rounded-lg">
                <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>

          {activeTab === 'metrics' && metrics && (
            <div className="space-y-4 sm:space-y-6">
              {/* Row 1: Users & Activity */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard label="Total Users" value={metrics.total_users} sub={`${metrics.accepted_users || 0} approved`} icon={Users} color="orange" />
                <MetricCard label="WAU" value={metrics.wau} sub="Weekly Active" icon={TrendingUp} color="green" />
                <MetricCard label="Day 7 Ret." value={metrics.day7_retention != null ? `${metrics.day7_retention}%` : '—'} icon={UserCheck} color="blue" />
                <MetricCard label="CSAT" value={metrics.csat != null ? `${metrics.csat}%` : '—'} sub={`${metrics.thumbs_up || 0}↑ ${metrics.thumbs_down || 0}↓`} icon={ThumbsUp} color="purple" />
              </div>

              {/* Row 2: Engagement */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard label="Sess/User (7d)" value={metrics.avg_sessions_per_user_7d} icon={Clock} color="orange" />
                <MetricCard label="Msgs/Session" value={metrics.avg_messages_per_session} icon={MessageSquare} color="green" />
                <MetricCard label="Assessment" value={`${metrics.assessment_completion_rate}%`} icon={FileText} color="blue" />
                <MetricCard label="Import Rate" value={`${metrics.import_adoption_rate}%`} icon={Upload} color="purple" />
              </div>

              {/* Row 3: More stats */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <MetricCard label="Multi-Session" value={`${metrics.multi_session_rate}%`} sub="2+ convos" icon={Database} color="orange" />
                <MetricCard label="Total Msgs" value={metrics.total_messages} icon={MessageSquare} color="green" />
                <MetricCard label="New (30d)" value={metrics.recent_signups_30d} icon={Users} color="blue" />
              </div>

              {/* Cost Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-bold text-white tracking-wide">LLM Cost Estimates</h3>
                  <span className="text-[10px] text-gray-600 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">mid-2025 pricing</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <MetricCard
                    label="Est. Cost / User / Month"
                    value={metrics.est_cost_per_user_month != null ? `$${metrics.est_cost_per_user_month.toFixed(4)}` : '—'}
                    sub="Based on last 30d usage"
                    icon={DollarSign}
                    color="green"
                  />
                  <MetricCard
                    label="Est. Monthly Total"
                    value={metrics.est_projected_monthly_cost != null ? `$${metrics.est_projected_monthly_cost.toFixed(3)}` : '—'}
                    sub={`Across ${metrics.accepted_users || 0} active users`}
                    icon={TrendingUp}
                    color="orange"
                  />
                  <MetricCard
                    label="Total Est. Cost (All-time)"
                    value={metrics.est_total_cost != null ? `$${metrics.est_total_cost.toFixed(3)}` : '—'}
                    sub={`From ${metrics.total_messages || 0} total messages`}
                    icon={Zap}
                    color="purple"
                  />
                </div>

                {/* Cost by model breakdown */}
                {costByModelEntries.length > 0 && (
                  <div className="bg-[#111] border border-white/8 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-gray-600 tracking-widest uppercase mb-3">Cost Breakdown by Model</p>
                    <div className="space-y-2">
                      {costByModelEntries.map(([modelName, data]) => {
                        const maxCost = costByModelEntries[0][1].cost || 1;
                        const pct = Math.round((data.cost / maxCost) * 100);
                        return (
                          <div key={modelName} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-48 truncate flex-shrink-0">{modelName}</span>
                            <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full bg-orange-500/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-orange-400 w-16 text-right flex-shrink-0">${data.cost.toFixed(4)}</span>
                            <span className="text-[10px] text-gray-600 w-16 text-right flex-shrink-0">{data.messages} msgs</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-700 mt-3 pt-3 border-t border-white/5">
                      Prices based on: GPT-4o $5/$15, GPT-4o-mini $0.15/$0.60, Claude Sonnet $3/$15, Gemini Flash $0.075/$0.30, Sonar $1/$1 per 1M tokens (input/output)
                    </p>
                  </div>
                )}
                {costByModelEntries.length === 0 && (
                  <div className="bg-[#111] border border-white/8 rounded-xl p-5 text-center text-gray-600 text-xs">
                    Cost breakdown will appear here after users start chatting
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'waitlist' && token && (
            <WaitlistTab
              token={token}
              onCountChange={(count) => setWaitlistCount(count)}
            />
          )}

          {activeTab === 'users' && token && (
            <UsersTab token={token} adminRole={adminRole} />
          )}

          {activeTab === 'conversations' && token && (
            <ConversationsTab token={token} />
          )}

          {activeTab === 'announcements' && token && (
            <AnnouncementsTab token={token} />
          )}

          {activeTab === 'feedback' && token && (
            <FeedbackTab token={token} />
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
