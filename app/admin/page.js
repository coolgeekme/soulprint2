'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, User, BarChart2, MessageSquare, Upload, Settings, Shield,
  Search, ChevronLeft, Check, X, RefreshCw, TrendingUp,
  UserCheck, Clock, FileText, ThumbsUp, AlertCircle, Loader2, Database,
  DollarSign, Zap, ListChecks, MessageCircle, Sparkles, Megaphone, Plus, Link, Edit, Trash2,
  PenSquare, Eye, EyeOff, Image, Tag, Bold, Italic, Heading, List, ListOrdered, Quote, Code, Link2, ImagePlus, Calendar,
  KeyRound, Mail, Send, AlertTriangle, Cpu, Mic, Phone, LifeBuoy
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

const TABS = [
  { id: 'metrics', label: 'Metrics', icon: BarChart2 },
  { id: 'insights', label: 'Insights', icon: TrendingUp },
  { id: 'waitlist', label: 'Waitlist', icon: ListChecks },
  { id: 'users', label: 'All Users', icon: Users },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'blog', label: 'Blog', icon: PenSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'appupdates', label: 'App Updates', icon: Sparkles },
  { id: 'feedback', label: 'Feedback', icon: MessageCircle },
  { id: 'betacodes', label: 'Beta Codes', icon: KeyRound },
  { id: 'assessments', label: 'Assessments', icon: FileText },
  { id: 'imports', label: 'Imports', icon: Upload },
  { id: 'support', label: 'Support', icon: LifeBuoy },
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

// Date Range Filter Component
function DateRangeFilter({ value, onChange, label = 'Filter by date' }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const presets = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: '90d', label: 'Last 90 Days' },
    { id: 'custom', label: 'Custom Range' },
  ];
  
  const handlePresetChange = (preset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    
    const now = new Date();
    let startDate = null;
    let endDate = new Date();
    
    switch (preset) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = null;
        endDate = null;
    }
    
    onChange({ 
      preset, 
      startDate: startDate?.toISOString().split('T')[0] || null, 
      endDate: endDate?.toISOString().split('T')[0] || null 
    });
  };
  
  const applyCustomRange = () => {
    if (customStart && customEnd) {
      onChange({ 
        preset: 'custom', 
        startDate: customStart, 
        endDate: customEnd 
      });
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-500">{label}:</span>
        {presets.map(p => (
          <button
            key={p.id}
            onClick={() => handlePresetChange(p.id)}
            className={`text-[10px] px-2 py-1 rounded-lg transition-all ${
              value?.preset === p.id 
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' 
                : 'bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      
      {showCustom && (
        <div className="flex items-center gap-2 mt-2 bg-white/5 rounded-lg p-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
          />
          <span className="text-gray-500 text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
          />
          <button
            onClick={applyCustomRange}
            disabled={!customStart || !customEnd}
            className="px-2 py-1 bg-orange-500 text-white text-xs rounded disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
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
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [resetUserId, setResetUserId] = useState(null);
  const [newPasscode, setNewPasscode] = useState('');
  
  // Date filters
  const [registrationDateFilter, setRegistrationDateFilter] = useState({ preset: 'all' });
  const [onboardingFilter, setOnboardingFilter] = useState('all'); // all, complete, incomplete
  const [assessmentFilter, setAssessmentFilter] = useState('all'); // all, complete, incomplete
  
  // Add/Edit user state
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ email: '', passcode: '', display_name: '', role: 'user', accepted: true });
  const [saving, setSaving] = useState(false);
  
  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState(null);
  const [exportSettings, setExportSettings] = useState({
    filter: 'all',
    discovery: '',
    dateFrom: '',
    dateTo: '',
    hasMessages: '',
    onboardingComplete: '',
  });
  const [exporting, setExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/users?search=${search}&page=${page}`;
      
      // Add date filter params
      if (registrationDateFilter.startDate) {
        url += `&startDate=${registrationDateFilter.startDate}`;
      }
      if (registrationDateFilter.endDate) {
        url += `&endDate=${registrationDateFilter.endDate}`;
      }
      if (onboardingFilter !== 'all') {
        url += `&onboarding=${onboardingFilter}`;
      }
      if (assessmentFilter !== 'all') {
        url += `&assessment=${assessmentFilter}`;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setUsers(d.users || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, page, registrationDateFilter, onboardingFilter, assessmentFilter]);

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

  // Load export filter options
  async function loadExportFilters() {
    try {
      const res = await fetch('/api/admin/users/export/filters', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setExportFilters(data);
    } catch (e) {
      console.error('Failed to load export filters:', e);
    }
  }

  // Open export modal
  function openExportModal() {
    loadExportFilters();
    setShowExportModal(true);
    setExportPreview(null);
  }

  // Preview export
  async function previewExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('format', 'json');
      if (exportSettings.filter !== 'all') params.set('filter', exportSettings.filter);
      if (exportSettings.discovery) params.set('discovery', exportSettings.discovery);
      if (exportSettings.dateFrom) params.set('date_from', exportSettings.dateFrom);
      if (exportSettings.dateTo) params.set('date_to', exportSettings.dateTo);
      if (exportSettings.hasMessages) params.set('has_messages', exportSettings.hasMessages);
      if (exportSettings.onboardingComplete) params.set('onboarding_complete', exportSettings.onboardingComplete);
      
      const res = await fetch(`/api/admin/users/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setExportPreview(data);
    } catch (e) {
      console.error('Export preview failed:', e);
    }
    setExporting(false);
  }

  // Download CSV
  async function downloadCSV() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('format', 'csv');
      if (exportSettings.filter !== 'all') params.set('filter', exportSettings.filter);
      if (exportSettings.discovery) params.set('discovery', exportSettings.discovery);
      if (exportSettings.dateFrom) params.set('date_from', exportSettings.dateFrom);
      if (exportSettings.dateTo) params.set('date_to', exportSettings.dateTo);
      if (exportSettings.hasMessages) params.set('has_messages', exportSettings.hasMessages);
      if (exportSettings.onboardingComplete) params.set('onboarding_complete', exportSettings.onboardingComplete);
      
      const res = await fetch(`/api/admin/users/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soulprint_users_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
    setExporting(false);
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
          <button onClick={openExportModal} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 text-green-400 rounded-xl text-sm font-medium transition-colors">
            <Upload className="w-4 h-4 rotate-180" /> Export
          </button>
          {adminRole === 'superadmin' && (
            <button onClick={openCreateForm} className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141a21] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Upload className="w-5 h-5 text-green-400 rotate-180" />
                Export Users for Email Campaigns
              </h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Filter Options */}
              <div className="grid grid-cols-2 gap-4">
                {/* Acquisition Channel */}
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-2 block">Acquisition Channel</label>
                  <select
                    value={exportSettings.filter}
                    onChange={(e) => setExportSettings({ ...exportSettings, filter: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-green-500/40 outline-none"
                  >
                    <option value="all">All Users ({exportFilters?.channel_counts?.all || 0})</option>
                    <option value="beta">Beta Code Users ({exportFilters?.channel_counts?.beta || 0})</option>
                    <option value="invited">Invited Users ({exportFilters?.channel_counts?.invited || 0})</option>
                    <option value="google">Google Auth ({exportFilters?.channel_counts?.google || 0})</option>
                    <option value="organic">Organic ({exportFilters?.channel_counts?.organic || 0})</option>
                  </select>
                </div>
                
                {/* Discovery Source */}
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-2 block">Discovery Source</label>
                  <select
                    value={exportSettings.discovery}
                    onChange={(e) => setExportSettings({ ...exportSettings, discovery: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-green-500/40 outline-none"
                  >
                    <option value="">All Sources</option>
                    {exportFilters?.discovery_sources?.map((src) => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>
                
                {/* Date From */}
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-2 block">Registered After</label>
                  <input
                    type="date"
                    value={exportSettings.dateFrom}
                    onChange={(e) => setExportSettings({ ...exportSettings, dateFrom: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-green-500/40 outline-none"
                  />
                </div>
                
                {/* Date To */}
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-2 block">Registered Before</label>
                  <input
                    type="date"
                    value={exportSettings.dateTo}
                    onChange={(e) => setExportSettings({ ...exportSettings, dateTo: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-green-500/40 outline-none"
                  />
                </div>
                
                {/* Has Messages */}
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-2 block">Engagement</label>
                  <select
                    value={exportSettings.hasMessages}
                    onChange={(e) => setExportSettings({ ...exportSettings, hasMessages: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-green-500/40 outline-none"
                  >
                    <option value="">All</option>
                    <option value="true">Engaged (sent messages)</option>
                    <option value="false">Never engaged (0 messages)</option>
                  </select>
                </div>
                
                {/* Onboarding Complete */}
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-2 block">Onboarding Status</label>
                  <select
                    value={exportSettings.onboardingComplete}
                    onChange={(e) => setExportSettings({ ...exportSettings, onboardingComplete: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-green-500/40 outline-none"
                  >
                    <option value="">All</option>
                    <option value="true">Completed onboarding</option>
                    <option value="false">Did not complete onboarding</option>
                  </select>
                </div>
              </div>
              
              {/* Preview Button */}
              <button
                onClick={previewExport}
                disabled={exporting}
                className="w-full py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Preview Export
              </button>
              
              {/* Preview Results */}
              {exportPreview && (
                <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium">Preview: {exportPreview.stats?.total || 0} users</h4>
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-green-400 text-lg font-bold">{exportPreview.stats?.engaged || 0}</p>
                      <p className="text-gray-500 text-[10px]">Engaged</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-blue-400 text-lg font-bold">{exportPreview.stats?.onboarded || 0}</p>
                      <p className="text-gray-500 text-[10px]">Onboarded</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-purple-400 text-lg font-bold">{exportPreview.stats?.total - exportPreview.stats?.engaged || 0}</p>
                      <p className="text-gray-500 text-[10px]">Never Engaged</p>
                    </div>
                  </div>
                  
                  {/* By Channel */}
                  {exportPreview.stats?.by_channel && Object.keys(exportPreview.stats.by_channel).length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs mb-2">By Acquisition Channel:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(exportPreview.stats.by_channel).map(([channel, count]) => (
                          <span key={channel} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs">
                            <span className="text-gray-400 capitalize">{channel}:</span>
                            <span className="text-white ml-1 font-medium">{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Sample Users */}
                  <div>
                    <p className="text-gray-400 text-xs mb-2">Sample Users (first 5):</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {exportPreview.users?.slice(0, 5).map((user, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white/5 rounded px-2 py-1">
                          <span className="text-white">{user.email}</span>
                          <span className="text-gray-500">{user.acquisition_channel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* CSV Fields */}
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                    <p className="text-green-400 text-xs font-medium mb-1">CSV will include:</p>
                    <p className="text-gray-400 text-[10px]">
                      email, display_name, created_at, last_active_at, acquisition_channel, beta_code_used, 
                      invited_by, auth_provider, discovery_source, onboarding_complete, assessment_complete, 
                      message_count, field, assistant_name
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-2.5 bg-white/5 text-gray-400 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={downloadCSV}
                disabled={exporting || !exportPreview}
                className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 rotate-180" />}
                Download CSV ({exportPreview?.stats?.total || 0} users)
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Filters Section */}
      <div className="bg-[#111] border border-white/8 rounded-xl p-4 space-y-4">
        <p className="text-xs text-gray-500 font-bold tracking-widest uppercase">Filters</p>
        
        {/* Registration Date Filter */}
        <DateRangeFilter 
          value={registrationDateFilter} 
          onChange={setRegistrationDateFilter}
          label="Registration Date"
        />
        
        {/* Onboarding & Assessment Status Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Onboarding:</span>
            {['all', 'complete', 'incomplete'].map(status => (
              <button
                key={status}
                onClick={() => setOnboardingFilter(status)}
                className={`text-[10px] px-2 py-1 rounded-lg transition-all capitalize ${
                  onboardingFilter === status 
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' 
                    : 'bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Assessment:</span>
            {[
              { value: 'all', label: 'All' },
              { value: 'quick', label: 'Quick (12)' },
              { value: 'full', label: 'Full (36)' },
              { value: 'complete', label: 'Any Complete' },
              { value: 'incomplete', label: 'None' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setAssessmentFilter(opt.value)}
                className={`text-[10px] px-2 py-1 rounded-lg transition-all ${
                  assessmentFilter === opt.value 
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' 
                    : 'bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Clear Filters */}
        {(registrationDateFilter.preset !== 'all' || onboardingFilter !== 'all' || assessmentFilter !== 'all') && (
          <button
            onClick={() => {
              setRegistrationDateFilter({ preset: 'all' });
              setOnboardingFilter('all');
              setAssessmentFilter('all');
            }}
            className="text-[10px] text-orange-400 hover:text-orange-300"
          >
            ✕ Clear all filters
          </button>
        )}
      </div>

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
              <tr key={u.id} className="border-b border-white/3 hover:bg-white/5 transition-colors">
                <td className="py-3 pr-4">
                  <button
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    className="text-left hover:text-orange-400 transition-colors group"
                  >
                    <p className="text-white text-xs group-hover:text-orange-400">{u.email}</p>
                    {u.display_name && <p className="text-gray-600 text-[10px]">{u.display_name}</p>}
                  </button>
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
                  {u.assessment_type === 'full' ? (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded" title={`${u.assessment_answer_count} answers`}>
                      Full ({u.assessment_answer_count})
                    </span>
                  ) : u.assessment_type === 'quick' ? (
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded" title={`${u.assessment_answer_count} answers`}>
                      Quick ({u.assessment_answer_count})
                    </span>
                  ) : u.assessment_type === 'partial' ? (
                    <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded" title={`${u.assessment_answer_count} answers`}>
                      Partial ({u.assessment_answer_count})
                    </span>
                  ) : (
                    <span className="text-gray-600 text-[10px]">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span className="text-gray-600 text-[10px]">
                    {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : '—'}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button 
                      onClick={() => router.push(`/admin/users/${u.id}`)} 
                      className="p-1.5 text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                      title="View user details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchConversations = (p = page, s = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p });
    if (s) params.set('search', s);
    fetch(`/api/admin/conversations?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setConvs(d.conversations || []); setPages(d.pages || 1); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchConversations(page, search); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
    fetchConversations(1, searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
    fetchConversations(1, '');
  };

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-blue-400 text-xs">🔒 <strong>Privacy Mode:</strong> Conversation content is not visible to admins. Only general topic categories are shown.</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2" data-testid="conversation-search-form">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by email or topic..."
            className="w-full bg-[#111] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:border-orange-500/40 transition-colors"
            data-testid="conversation-search-input"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs font-bold rounded-lg border border-orange-500/20 transition-colors" data-testid="conversation-search-btn">
          Search
        </button>
        {search && (
          <button type="button" onClick={clearSearch} className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 text-xs rounded-lg border border-white/10 transition-colors" data-testid="conversation-clear-search-btn">
            Clear
          </button>
        )}
      </form>

      {search && (
        <p className="text-gray-500 text-xs mb-3">Showing results for "<span className="text-orange-400">{search}</span>" — {total} conversation{total !== 1 ? 's' : ''} found</p>
      )}

      {loading ? <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div> : (
        convs.length === 0 ? (
          <div className="text-center py-12 text-gray-600 text-sm">
            {search ? 'No conversations match your search.' : 'No conversations yet.'}
          </div>
        ) : (
        <table className="w-full admin-table">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'Topic Category', 'Source', 'Messages', 'Created', 'Last Active'].map(h => (
                <th key={h} className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {convs.map(c => (
              <tr key={c.id} className="border-b border-white/3">
                <td className="py-3 pr-4 text-gray-400 text-xs">{c.user_email}</td>
                <td className="py-3 pr-4 text-white text-xs">{c.topic || '💬 General Chat'}</td>
                <td className="py-3 pr-4 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.source === 'telegram' ? 'bg-[#229ED9]/20 text-[#229ED9]' : 'bg-white/10 text-gray-400'}`}>
                    {c.source || 'web'}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-500 text-xs">{c.message_count || '—'}</td>
                <td className="py-3 pr-4 text-gray-600 text-[10px]">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                <td className="py-3 pr-4 text-gray-600 text-[10px]">{c.updated_at ? new Date(c.updated_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )
      )}
      <div className="flex items-center justify-between mt-4">
        <span className="text-gray-600 text-xs">{total} total conversation{total !== 1 ? 's' : ''}</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="text-xs text-gray-500 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-[#111] border border-white/10 rounded-lg">Prev</button>
            <span className="text-xs text-gray-600">{page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="text-xs text-gray-500 hover:text-white disabled:opacity-30 px-3 py-1.5 bg-[#111] border border-white/10 rounded-lg">Next</button>
          </div>
        )}
      </div>
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

// App Updates Tab (What's New management)
function AppUpdatesTab({ token }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    version: '',
    type: 'feature',
    published: false,
    release_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/app-updates', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setUpdates(d.updates || []);
    } catch (e) {
      console.error('Failed to load app updates:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/app-updates/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.success) {
        load(); // Reload to show the new auto-generated update
      } else {
        alert(d.error || 'Failed to generate release notes');
      }
    } catch (e) {
      alert('Failed to generate release notes');
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Title and description are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/admin/app-updates/${editing}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch('/api/admin/app-updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData),
        });
      }
      setShowForm(false);
      setEditing(null);
      setFormData({
        title: '',
        description: '',
        version: '',
        type: 'feature',
        published: false,
        release_date: new Date().toISOString().split('T')[0],
      });
      load();
    } catch (e) {
      alert('Failed to save update');
    }
    setSaving(false);
  };

  const handleEdit = (upd) => {
    setEditing(upd.id);
    setFormData({
      title: upd.title,
      description: upd.description,
      version: upd.version || '',
      type: upd.type || 'feature',
      published: upd.published,
      release_date: upd.release_date ? new Date(upd.release_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this update?')) return;
    try {
      await fetch(`/api/admin/app-updates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (e) {
      alert('Failed to delete update');
    }
  };

  const togglePublish = async (upd) => {
    try {
      await fetch(`/api/admin/app-updates/${upd.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ published: !upd.published }),
      });
      load();
    } catch (e) {
      alert('Failed to update');
    }
  };

  const typeColors = {
    feature: 'bg-green-500/20 text-green-400 border-green-500/30',
    improvement: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    fix: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    announcement: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  const typeIcons = {
    feature: '✨',
    improvement: '🔧',
    fix: '🐛',
    announcement: '📢',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">App Updates (What's New)</h2>
          <p className="text-xs text-gray-500">Auto-generated on each deployment. Review, edit, and publish.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate Release Notes'}
          </button>
          <button
            onClick={() => { setShowForm(true); setEditing(null); setFormData({ title: '', description: '', version: '', type: 'feature', published: false, release_date: new Date().toISOString().split('T')[0] }); }}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm transition-all"
            title="Create a manual update"
          >
            <Plus className="w-4 h-4" /> Manual
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-[#111] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold">{editing ? 'Edit Update' : 'Create Update'}</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-gray-500 text-xs mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., New Voice Chat Feature"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
              />
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-gray-500 text-xs mb-1">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what's new..."
                rows={4}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none resize-none"
              />
            </div>
            
            <div>
              <label className="block text-gray-500 text-xs mb-1">Version (optional)</label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="e.g., v2.1.0"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-gray-500 text-xs mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
              >
                <option value="feature">✨ Feature</option>
                <option value="improvement">🔧 Improvement</option>
                <option value="fix">🐛 Bug Fix</option>
                <option value="announcement">📢 Announcement</option>
              </select>
            </div>
            
            <div>
              <label className="block text-gray-500 text-xs mb-1">Release Date</label>
              <input
                type="date"
                value={formData.release_date}
                onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/40 outline-none"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="updatePublished"
                checked={formData.published}
                onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-[#0a0a0a]"
              />
              <label htmlFor="updatePublished" className="ml-2 text-gray-400 text-sm">Publish immediately</label>
            </div>
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

      {/* Updates List */}
      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div>
      ) : updates.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No app updates yet</p>
          <p className="text-xs mt-1">Release notes are auto-generated on each deployment, or click "Generate Release Notes" above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map(upd => (
            <div key={upd.id} className={`bg-[#111] border rounded-xl p-4 ${upd.published ? 'border-green-500/30' : 'border-white/10'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${typeColors[upd.type] || typeColors.feature}`}>
                      {typeIcons[upd.type] || '✨'} {upd.type}
                    </span>
                    {upd.version && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                        {upd.version}
                      </span>
                    )}
                    {upd.published ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Published</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">Draft</span>
                    )}
                    {upd.auto_generated && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">🤖 Auto</span>
                    )}
                  </div>
                  <h4 className="text-white font-medium text-sm mb-1">{upd.title}</h4>
                  <p className="text-gray-400 text-xs line-clamp-2">{upd.description}</p>
                  <p className="text-gray-600 text-[10px] mt-2">
                    {upd.release_date ? new Date(upd.release_date).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => togglePublish(upd)}
                    className={`p-1.5 rounded-lg transition-colors ${upd.published ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:bg-white/10'}`}
                    title={upd.published ? 'Unpublish' : 'Publish'}
                  >
                    {upd.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(upd)}
                    className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(upd.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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


// Markdown Editor Toolbar Component
function MarkdownToolbar({ textareaRef, content, setContent }) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef(null);

  const insertText = (before, after = '', placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || placeholder;
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    setContent(newText);
    
    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleBold = () => insertText('**', '**', 'bold text');
  const handleItalic = () => insertText('*', '*', 'italic text');
  const handleHeading = () => insertText('\n## ', '\n', 'Heading');
  const handleBulletList = () => insertText('\n- ', '', 'list item');
  const handleNumberedList = () => insertText('\n1. ', '', 'list item');
  const handleQuote = () => insertText('\n> ', '\n', 'quote');
  const handleCode = () => insertText('`', '`', 'code');
  const handleCodeBlock = () => insertText('\n```\n', '\n```\n', 'code block');

  const handleLinkInsert = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    setLinkText(selectedText || '');
    setLinkUrl('');
    setShowLinkModal(true);
  };

  const insertLink = () => {
    if (!linkUrl.trim()) return;
    const text = linkText.trim() || linkUrl;
    insertText(`[${text}](${linkUrl})`, '', '');
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploading(true);
    
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image`);
        continue;
      }
      
      // Convert to base64 and create data URL (simple local storage approach)
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const altText = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        insertText(`\n![${altText}](${dataUrl})\n`, '', '');
      };
      reader.readAsDataURL(file);
    }
    
    setUploading(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const toolbarButtons = [
    { icon: Bold, action: handleBold, title: 'Bold (Ctrl+B)' },
    { icon: Italic, action: handleItalic, title: 'Italic (Ctrl+I)' },
    { icon: Heading, action: handleHeading, title: 'Heading' },
    { divider: true },
    { icon: List, action: handleBulletList, title: 'Bullet List' },
    { icon: ListOrdered, action: handleNumberedList, title: 'Numbered List' },
    { icon: Quote, action: handleQuote, title: 'Quote' },
    { divider: true },
    { icon: Code, action: handleCode, title: 'Inline Code' },
    { icon: Link2, action: handleLinkInsert, title: 'Insert Link' },
    { icon: ImagePlus, action: () => imageInputRef.current?.click(), title: 'Insert Image(s)', uploading },
  ];

  return (
    <>
      <div className="flex items-center gap-1 p-2 bg-[#0a0a0a] border border-white/10 border-b-0 rounded-t-xl">
        {toolbarButtons.map((btn, i) => 
          btn.divider ? (
            <div key={i} className="w-px h-5 bg-white/10 mx-1" />
          ) : (
            <button
              key={i}
              type="button"
              onClick={btn.action}
              disabled={btn.uploading}
              title={btn.title}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
            >
              {btn.uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <btn.icon className="w-4 h-4" />}
            </button>
          )
        )}
        <input 
          ref={imageInputRef} 
          type="file" 
          accept="image/*" 
          multiple 
          className="hidden" 
          onChange={handleImageUpload}
        />
      </div>
      
      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowLinkModal(false)}>
          <div className="bg-[#111] border border-white/10 rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">Insert Link</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-500 text-xs mb-1 block">Link Text</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={e => setLinkText(e.target.value)}
                  placeholder="Display text"
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs mb-1 block">URL *</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={insertLink}
                  disabled={!linkUrl.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Insert Link
                </button>
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Blog Tab
function BlogTab({ token }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    featured_image: '',
    category: '',
    tags: '',
    author: 'SoulPrint Team',
    status: 'draft'
  });
  const [saving, setSaving] = useState(false);
  const contentTextareaRef = useRef(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/blog/posts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (e) {
      console.error('Failed to load posts:', e);
    } finally {
      setLoading(false);
    }
  };

  const openNewPost = () => {
    setEditingPost(null);
    setForm({
      title: '',
      content: '',
      excerpt: '',
      featured_image: '',
      category: '',
      tags: '',
      author: 'SoulPrint Team',
      status: 'draft'
    });
    setShowEditor(true);
  };

  const openEditPost = (post) => {
    setEditingPost(post);
    setForm({
      title: post.title,
      content: post.content,
      excerpt: post.excerpt || '',
      featured_image: post.featured_image || '',
      category: post.category || '',
      tags: (post.tags || []).join(', '),
      author: post.author || 'SoulPrint Team',
      status: post.status
    });
    setShowEditor(true);
  };

  const handleSave = async (publishNow = false) => {
    if (!form.title.trim() || !form.content.trim()) {
      alert('Title and content are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        status: publishNow ? 'published' : form.status
      };

      const url = editingPost 
        ? `/api/admin/blog/posts/${editingPost.id}`
        : '/api/admin/blog/posts';
      
      const res = await fetch(url, {
        method: editingPost ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowEditor(false);
        loadPosts();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save');
      }
    } catch (e) {
      alert('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    
    try {
      const res = await fetch(`/api/admin/blog/posts/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        loadPosts();
      }
    } catch (e) {
      alert('Failed to delete');
    }
  };

  const togglePublish = async (post) => {
    try {
      const res = await fetch(`/api/admin/blog/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: post.status === 'published' ? 'draft' : 'published'
        })
      });
      if (res.ok) {
        loadPosts();
      }
    } catch (e) {
      alert('Failed to update');
    }
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Editor Modal
  if (showEditor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setShowEditor(false)}
            className="text-gray-400 hover:text-white flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to posts
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm text-white flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {editingPost?.status === 'published' ? 'Update' : 'Publish'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-4">
            <input
              type="text"
              placeholder="Post Title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-xl font-semibold placeholder-gray-600 focus:border-orange-500/50 outline-none"
            />
            <div>
              <MarkdownToolbar 
                textareaRef={contentTextareaRef}
                content={form.content}
                setContent={(newContent) => setForm(f => ({ ...f, content: newContent }))}
              />
              <textarea
                ref={contentTextareaRef}
                placeholder="Write your content here... (Markdown supported)"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={20}
                className="w-full bg-[#111] border border-white/10 rounded-b-xl px-4 py-3 text-white placeholder-gray-600 focus:border-orange-500/50 outline-none resize-none font-mono text-sm"
              />
            </div>
            <p className="text-gray-600 text-xs">
              💡 Tip: Use the toolbar above to format text. Images are embedded as base64 for simplicity.
            </p>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-4">
              <h3 className="text-white font-semibold text-sm">Post Settings</h3>
              
              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider mb-1 block">Author</label>
                <input
                  type="text"
                  value={form.author}
                  onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                />
              </div>

              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider mb-1 block">Category</label>
                <input
                  type="text"
                  placeholder="e.g., Product Updates"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                />
              </div>

              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider mb-1 block">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g., AI, Updates, Tips"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                />
              </div>

              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider mb-1 block">Featured Image URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={form.featured_image}
                  onChange={e => setForm(f => ({ ...f, featured_image: e.target.value }))}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                />
                {form.featured_image && (
                  <img src={form.featured_image} alt="Preview" className="mt-2 rounded-lg w-full aspect-video object-cover" />
                )}
              </div>

              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider mb-1 block">Excerpt (SEO)</label>
                <textarea
                  placeholder="Brief description for search results..."
                  value={form.excerpt}
                  onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                  rows={3}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none resize-none"
                />
                <p className="text-gray-600 text-xs mt-1">{form.excerpt.length}/160 characters</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Posts List
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-xl font-bold">Blog Posts</h2>
          <p className="text-gray-500 text-sm">{posts.length} total posts</p>
        </div>
        <button
          onClick={openNewPost}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Post
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-600" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 bg-[#111] border border-white/8 rounded-xl">
          <PenSquare className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No blog posts yet</p>
          <button
            onClick={openNewPost}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm text-white inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create your first post
          </button>
        </div>
      ) : (
        <div className="bg-[#111] border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8 text-left">
                <th className="px-4 py-3 text-gray-500 text-xs font-bold uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-gray-500 text-xs font-bold uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-gray-500 text-xs font-bold uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 text-gray-500 text-xs font-bold uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 text-gray-500 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-b border-white/5 hover:bg-white/3">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium text-sm truncate max-w-xs">{post.title}</p>
                      <p className="text-gray-600 text-xs">{post.author}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-gray-400 text-sm">{post.category || '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      post.status === 'published' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {post.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-gray-500 text-sm">{formatDate(post.published_at || post.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => togglePublish(post)}
                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                        title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                      >
                        {post.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openEditPost(post)}
                        className="p-1.5 text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      case 'positive': return '👍';
      case 'negative': return '👎';
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
                  <span className="text-white text-sm font-medium">{f.user_email || 'Unknown'}</span>
                  {f.source === 'message_feedback' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">Chat Feedback</span>
                  )}
                  {f.anonymous && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Anonymous</span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
                    f.category === 'bug' ? 'bg-red-500/20 text-red-400' :
                    f.category === 'feature' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{f.category}</span>
                  {f.rating && typeof f.rating === 'number' && (
                    <span className="text-orange-400 text-xs">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                  )}
                  {f.rating && (f.rating === 'up' || f.rating === 'down') && (
                    <span className={`text-lg ${f.rating === 'up' ? 'text-green-400' : 'text-red-400'}`}>{f.rating === 'up' ? '👍' : '👎'}</span>
                  )}
                  {f.attachment && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">📎 Has Screenshot</span>
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

// Beta Codes Tab - Full management of beta access codes with groups
function BetaCodesTab({ token }) {
  const [groups, setGroups] = useState([]);
  const [codes, setCodes] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('codes'); // 'codes', 'groups', 'redemptions'
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    group_id: '',
    count: 1,
    prefix: 'BETA',
    max_uses: '',
    is_single_use: false,
    expires_at: '',
    custom_code: '',
    label: '',
  });
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [groupsRes, codesRes, redemptionsRes] = await Promise.all([
        fetch('/api/admin/beta-groups', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/beta-codes', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/beta-redemptions', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const groupsData = await groupsRes.json();
      const codesData = await codesRes.json();
      const redemptionsData = await redemptionsRes.json();
      setGroups(groupsData.groups || []);
      setCodes(codesData.codes || []);
      setRedemptions(redemptionsData.redemptions || []);
    } catch (e) {
      console.error('Failed to load beta code data:', e);
    }
    setLoading(false);
  }

  async function createGroup() {
    if (!groupForm.name.trim()) return alert('Group name required');
    try {
      await fetch('/api/admin/beta-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(groupForm),
      });
      setShowGroupModal(false);
      setGroupForm({ name: '', description: '' });
      loadData();
    } catch (e) {
      alert('Failed to create group');
    }
  }

  async function deleteGroup(groupId) {
    if (!confirm('Delete this group? Codes will be unassigned.')) return;
    try {
      await fetch('/api/admin/beta-groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ group_id: groupId }),
      });
      loadData();
    } catch (e) {
      alert('Failed to delete group');
    }
  }

  async function createCodes() {
    const payload = {
      ...createForm,
      count: parseInt(createForm.count) || 1,
      max_uses: createForm.max_uses ? parseInt(createForm.max_uses) : null,
      group_id: createForm.group_id || null,
    };
    try {
      const res = await fetch('/api/admin/beta-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.codes) {
        alert(`Created ${data.codes.length} code(s)!`);
        setShowCreateModal(false);
        setCreateForm({
          group_id: '',
          count: 1,
          prefix: 'BETA',
          max_uses: '',
          is_single_use: false,
          expires_at: '',
          custom_code: '',
          label: '',
        });
        loadData();
      }
    } catch (e) {
      alert('Failed to create codes');
    }
  }

  async function toggleCodeActive(codeId, currentActive) {
    try {
      await fetch('/api/admin/beta-codes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code_id: codeId, active: !currentActive }),
      });
      loadData();
    } catch (e) {
      alert('Failed to update code');
    }
  }

  async function deleteCode(codeId) {
    if (!confirm('Delete this code permanently?')) return;
    try {
      await fetch('/api/admin/beta-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code_id: codeId }),
      });
      loadData();
    } catch (e) {
      alert('Failed to delete code');
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    alert('Copied to clipboard!');
  }

  if (loading) {
    return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-600" /></div>;
  }

  const filteredCodes = selectedGroup 
    ? codes.filter(c => c.group_id === selectedGroup)
    : codes;

  const totalRedemptions = codes.reduce((sum, c) => sum + (c.uses_count || 0), 0);
  const activeCodes = codes.filter(c => c.active && !c.is_expired && !c.is_exhausted).length;

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#111] border border-white/8 rounded-xl p-4">
          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Groups</p>
          <p className="text-2xl font-bold text-white mt-1">{groups.length}</p>
        </div>
        <div className="bg-[#111] border border-white/8 rounded-xl p-4">
          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Total Codes</p>
          <p className="text-2xl font-bold text-white mt-1">{codes.length}</p>
        </div>
        <div className="bg-[#111] border border-white/8 rounded-xl p-4">
          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Active Codes</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{activeCodes}</p>
        </div>
        <div className="bg-[#111] border border-white/8 rounded-xl p-4">
          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Redemptions</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{totalRedemptions}</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setActiveView('codes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeView === 'codes' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
            Codes ({codes.length})
          </button>
          <button onClick={() => setActiveView('groups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeView === 'groups' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
            Groups ({groups.length})
          </button>
          <button onClick={() => setActiveView('redemptions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeView === 'redemptions' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
            History ({redemptions.length})
          </button>
        </div>
        <div className="flex gap-2">
          {activeView === 'groups' && (
            <button onClick={() => setShowGroupModal(true)} className="btn-orange px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <Plus className="w-3 h-3" /> New Group
            </button>
          )}
          {activeView === 'codes' && (
            <button onClick={() => setShowCreateModal(true)} className="btn-orange px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <Plus className="w-3 h-3" /> Generate Codes
            </button>
          )}
        </div>
      </div>

      {/* Filter by Group (for codes view) */}
      {activeView === 'codes' && groups.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSelectedGroup(null)}
            className={`px-2 py-1 rounded text-xs ${!selectedGroup ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
            All
          </button>
          {groups.map(g => (
            <button key={g.id} onClick={() => setSelectedGroup(g.id)}
              className={`px-2 py-1 rounded text-xs ${selectedGroup === g.id ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Codes View */}
      {activeView === 'codes' && (
        <div className="space-y-2">
          {filteredCodes.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No codes yet. Click "Generate Codes" to create some.</p>
          ) : (
            filteredCodes.map(code => (
              <div key={code.id} className={`p-4 bg-[#111] border rounded-xl ${code.active && !code.is_expired && !code.is_exhausted ? 'border-white/8' : 'border-white/3 opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => copyCode(code.code)} className="font-mono text-lg text-white hover:text-orange-400 transition-colors">
                      {code.code}
                    </button>
                    {code.label && <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{code.label}</span>}
                    {code.group_name && code.group_name !== 'Ungrouped' && (
                      <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{code.group_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-500">
                      <span className="text-white font-medium">{code.uses_count || 0}</span>
                      {code.max_uses ? ` / ${code.max_uses}` : ''} uses
                    </span>
                    {code.expires_at && (
                      <span className={`${code.is_expired ? 'text-red-400' : 'text-gray-500'}`}>
                        {code.is_expired ? 'Expired' : `Expires ${new Date(code.expires_at).toLocaleDateString()}`}
                      </span>
                    )}
                    {code.is_single_use && <span className="text-yellow-400">Single-use</span>}
                    <button onClick={() => toggleCodeActive(code.id, code.active)}
                      className={`px-2 py-1 rounded ${code.active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {code.active ? 'Active' : 'Disabled'}
                    </button>
                    <button onClick={() => deleteCode(code.id)} className="text-gray-600 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Groups View */}
      {activeView === 'groups' && (
        <div className="space-y-2">
          {groups.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No groups yet. Create one to organize your codes.</p>
          ) : (
            groups.map(group => (
              <div key={group.id} className="p-4 bg-[#111] border border-white/8 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{group.name}</h3>
                    {group.description && <p className="text-gray-500 text-xs mt-1">{group.description}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <p className="text-white font-medium">{group.total_codes || 0}</p>
                      <p className="text-gray-600">codes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-orange-400 font-medium">{group.total_redemptions || 0}</p>
                      <p className="text-gray-600">used</p>
                    </div>
                    <div className="text-center">
                      <p className="text-green-400 font-medium">{group.conversion_rate || 0}%</p>
                      <p className="text-gray-600">rate</p>
                    </div>
                    <button onClick={() => deleteGroup(group.id)} className="text-gray-600 hover:text-red-400 ml-4">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Redemptions View */}
      {activeView === 'redemptions' && (
        <div className="space-y-2">
          {redemptions.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No redemptions yet.</p>
          ) : (
            redemptions.map(r => (
              <div key={r.id} className="p-3 bg-[#111] border border-white/8 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-orange-400 text-sm">{r.code}</span>
                  <span className="text-white text-sm">{r.user_email}</span>
                </div>
                <span className="text-gray-500 text-xs">{new Date(r.redeemed_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Codes Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-white font-semibold mb-4">Generate Beta Codes</h2>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Group (optional)</label>
                <select value={createForm.group_id} onChange={e => setCreateForm(f => ({ ...f, group_id: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm p-2 rounded-lg">
                  <option value="">No Group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Number of Codes</label>
                  <input type="number" min="1" max="100" value={createForm.count}
                    onChange={e => setCreateForm(f => ({ ...f, count: e.target.value }))}
                    className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm p-2 rounded-lg" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Prefix</label>
                  <input type="text" value={createForm.prefix}
                    onChange={e => setCreateForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                    className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm p-2 rounded-lg" />
                </div>
              </div>
              {createForm.count == 1 && (
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Custom Code (optional)</label>
                  <input type="text" value={createForm.custom_code}
                    onChange={e => setCreateForm(f => ({ ...f, custom_code: e.target.value.toUpperCase() }))}
                    placeholder="Leave empty for random"
                    className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm p-2 rounded-lg" />
                </div>
              )}
              <div>
                <label className="text-gray-400 text-xs block mb-1">Label (optional)</label>
                <input type="text" value={createForm.label}
                  onChange={e => setCreateForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g., Twitter Campaign"
                  className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm p-2 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Max Uses (empty = unlimited)</label>
                  <input type="number" min="1" value={createForm.max_uses}
                    onChange={e => setCreateForm(f => ({ ...f, max_uses: e.target.value }))}
                    className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm p-2 rounded-lg" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Expires</label>
                  <input type="date" value={createForm.expires_at}
                    onChange={e => setCreateForm(f => ({ ...f, expires_at: e.target.value }))}
                    className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm p-2 rounded-lg" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={createForm.is_single_use}
                  onChange={e => setCreateForm(f => ({ ...f, is_single_use: e.target.checked, max_uses: e.target.checked ? '' : f.max_uses }))}
                  className="rounded" />
                Single-use (one code per user)
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2 bg-white/5 text-gray-400 rounded-lg text-sm hover:bg-white/10">Cancel</button>
              <button onClick={createCodes} className="flex-1 btn-orange py-2 rounded-lg text-sm">Create {createForm.count} Code{createForm.count > 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-white font-semibold mb-4">Create Code Group</h2>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Group Name *</label>
                <input type="text" value={groupForm.name}
                  onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Influencers, VIP Beta, Press"
                  className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm p-2 rounded-lg" />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Description (optional)</label>
                <textarea value={groupForm.description}
                  onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Notes about this group..."
                  className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm p-2 rounded-lg resize-none" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowGroupModal(false)} className="flex-1 py-2 bg-white/5 text-gray-400 rounded-lg text-sm hover:bg-white/10">Cancel</button>
              <button onClick={createGroup} className="flex-1 btn-orange py-2 rounded-lg text-sm">Create Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Business Insights Tab
function InsightsTab({ token }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pricing Calculator State
  const [customPricing, setCustomPricing] = useState({
    free: { price: 0, msgLimit: 25 },
    basic: { price: 10, msgLimit: 100 },
    pro: { price: 20, msgLimit: 500 },
    enterprise: { price: 99, msgLimit: 'unlimited' },
  });
  
  // Feature Management State
  const [pricingFeatures, setPricingFeatures] = useState([]);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [featureForm, setFeatureForm] = useState({
    name: '',
    description: '',
    tier: 'basic',
    cost_type: 'per_user',
    cost_value: 0,
    status: 'planned',
    category: 'feature',
  });
  const [calculatedPricing, setCalculatedPricing] = useState(null);

  useEffect(() => {
    fetch('/api/admin/insights', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setInsights(data);
          // Initialize custom pricing with recommended values
          if (data.pricing_recommendations?.tiers) {
            setCustomPricing({
              free: { price: 0, msgLimit: data.pricing_recommendations.tiers.free?.message_limit || 25 },
              basic: { price: data.pricing_recommendations.tiers.basic?.recommended_price || 10, msgLimit: data.pricing_recommendations.tiers.basic?.message_limit || 100 },
              pro: { price: data.pricing_recommendations.tiers.pro?.recommended_price || 20, msgLimit: data.pricing_recommendations.tiers.pro?.message_limit || 500 },
              enterprise: { price: data.pricing_recommendations.tiers.enterprise?.recommended_price || 99, msgLimit: 'unlimited' },
            });
          }
        }
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
    
    // Load pricing features
    loadPricingFeatures();
  }, [token]);
  
  // Load pricing features
  const loadPricingFeatures = async () => {
    try {
      const res = await fetch('/api/admin/pricing-features', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Endpoint doesn't exist yet, that's okay
        console.log('Pricing features endpoint not available');
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setPricingFeatures(data);
      }
    } catch (e) {
      console.log('Pricing features not available:', e.message);
      // Non-critical error, continue without features
    }
  };
  
  // Calculate pricing with custom features
  const calculateWithFeatures = async () => {
    try {
      const res = await fetch('/api/admin/pricing-features/calculate', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Endpoint doesn't exist yet, that's okay
        console.log('Pricing calculation endpoint not available');
        return;
      }
      const data = await res.json();
      setCalculatedPricing(data);
    } catch (e) {
      console.log('Pricing calculation not available:', e.message);
      // Non-critical error, continue without calculated pricing
    }
  };
  
  // Add or update feature
  const saveFeature = async () => {
    try {
      const endpoint = editingFeature 
        ? '/api/admin/pricing-features/update'
        : '/api/admin/pricing-features';
      
      const body = editingFeature 
        ? { id: editingFeature.id, ...featureForm }
        : featureForm;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        alert('Feature management not available yet');
        return;
      }
      
      setShowFeatureModal(false);
      setEditingFeature(null);
      setFeatureForm({
        name: '',
        description: '',
        tier: 'basic',
        cost_type: 'per_user',
        cost_value: 0,
        status: 'planned',
        category: 'feature',
      });
      loadPricingFeatures();
      calculateWithFeatures();
    } catch (e) {
      console.log('Failed to save feature:', e.message);
      alert('Feature management not available yet');
    }
  };
  
  // Delete feature
  const deleteFeature = async (id) => {
    if (!confirm('Delete this feature?')) return;
    try {
      const res = await fetch(`/api/admin/pricing-features?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        alert('Feature management not available yet');
        return;
      }
      loadPricingFeatures();
      calculateWithFeatures();
    } catch (e) {
      console.log('Failed to delete feature:', e.message);
      alert('Feature management not available yet');
    }
  };
  
  // Open edit modal
  const openEditFeature = (feature) => {
    setEditingFeature(feature);
    setFeatureForm({
      name: feature.name,
      description: feature.description || '',
      tier: feature.tier,
      cost_type: feature.cost_type,
      cost_value: feature.cost_value,
      status: feature.status,
      category: feature.category,
    });
    setShowFeatureModal(true);
  };
  
  // Calculate margin for a given price and cost
  const calculateMargin = (price, cost) => {
    if (price <= 0) return 0;
    return ((price - cost) / price * 100).toFixed(1);
  };
  
  // Get cost for a tier based on message limit
  const getTierCost = (msgLimit) => {
    if (!insights?.pricing_recommendations) return 0;
    const costPerMsg = insights.pricing_recommendations.cost_per_message || 0;
    if (msgLimit === 'unlimited') {
      return insights.pricing_recommendations.tiers?.enterprise?.estimated_cost || 0;
    }
    return costPerMsg * msgLimit;
  };
  
  // Calculate estimated MRR based on current user segments
  const calculateEstimatedMRR = () => {
    if (!insights?.user_segments) return { mrr: 0, breakdown: {} };
    
    const segments = insights.user_segments;
    const pricing = customPricing;
    
    // Estimate which users would be on which tier
    // Free: inactive + light users
    // Basic: moderate users  
    // Pro: heavy users
    // Enterprise: power users
    
    const freeTierUsers = (segments.inactive?.count || 0) + (segments.light?.count || 0);
    const basicTierUsers = segments.moderate?.count || 0;
    const proTierUsers = segments.heavy?.count || 0;
    const enterpriseTierUsers = segments.power?.count || 0;
    
    const breakdown = {
      free: { users: freeTierUsers, revenue: 0 },
      basic: { users: basicTierUsers, revenue: basicTierUsers * pricing.basic.price },
      pro: { users: proTierUsers, revenue: proTierUsers * pricing.pro.price },
      enterprise: { users: enterpriseTierUsers, revenue: enterpriseTierUsers * pricing.enterprise.price },
    };
    
    const totalMRR = breakdown.basic.revenue + breakdown.pro.revenue + breakdown.enterprise.revenue;
    
    return { mrr: totalMRR, breakdown };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
        Error loading insights: {error}
      </div>
    );
  }

  if (!insights) return null;

  // Safety check: ensure insights has required structure
  if (!insights.pricing_recommendations || !insights.user_segments) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-400">
        <p className="font-medium">Incomplete insights data</p>
        <p className="text-xs mt-1 text-gray-400">The API returned partial data. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            Business Insights
          </h2>
          <p className="text-gray-500 text-xs mt-1">Data-driven insights to help determine pricing tiers</p>
        </div>
        <div className="text-[10px] text-gray-600 bg-white/5 px-2 py-1 rounded">
          Generated: {new Date(insights.generated_at).toLocaleString()}
        </div>
      </div>

      {/* Feature & Cost Management */}
      <div className="bg-gradient-to-r from-pink-500/5 to-transparent border border-pink-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-pink-400 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Feature & Cost Management
            </h3>
            <p className="text-gray-500 text-xs mt-1">Add current and future features with their costs to improve pricing recommendations</p>
          </div>
          <button
            onClick={() => {
              setEditingFeature(null);
              setFeatureForm({
                name: '',
                description: '',
                tier: 'basic',
                cost_type: 'per_user',
                cost_value: 0,
                status: 'planned',
                category: 'feature',
              });
              setShowFeatureModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Feature
          </button>
        </div>

        {/* Feature List */}
        {pricingFeatures.length > 0 ? (
          <div className="space-y-2 mb-4">
            <div className="grid grid-cols-7 gap-2 text-[10px] text-gray-500 px-2 font-medium uppercase">
              <span>Feature</span>
              <span>Tier</span>
              <span>Category</span>
              <span>Cost Type</span>
              <span className="text-right">Cost</span>
              <span className="text-center">Status</span>
              <span className="text-right">Actions</span>
            </div>
            {pricingFeatures.map((feature) => (
              <div key={feature.id} className="grid grid-cols-7 gap-2 items-center bg-black/20 border border-white/5 rounded-lg px-2 py-2 text-xs">
                <div>
                  <span className="text-white font-medium">{feature.name}</span>
                  {feature.description && (
                    <p className="text-gray-500 text-[10px] truncate">{feature.description}</p>
                  )}
                </div>
                <span className={`capitalize ${
                  feature.tier === 'enterprise' ? 'text-orange-400' :
                  feature.tier === 'pro' ? 'text-purple-400' :
                  feature.tier === 'basic' ? 'text-blue-400' :
                  feature.tier === 'addon' ? 'text-pink-400' :
                  'text-gray-400'
                }`}>
                  {feature.tier}
                </span>
                <span className="text-gray-400 capitalize">{feature.category}</span>
                <span className="text-gray-400 capitalize">{feature.cost_type.replace('_', ' ')}</span>
                <span className="text-green-400 text-right">${feature.cost_value}</span>
                <span className="text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] ${
                    feature.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    feature.status === 'planned' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {feature.status}
                  </span>
                </span>
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => openEditFeature(feature)}
                    className="p-1 text-gray-500 hover:text-white transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteFeature(feature.id)}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-black/20 rounded-lg mb-4">
            <p className="text-gray-500 text-sm mb-2">No features added yet</p>
            <p className="text-gray-600 text-xs">Add features like "WhatsApp Integration", "SMS", "Premium LLMs" with their costs</p>
          </div>
        )}

        {/* Quick Add Suggestions */}
        <div className="mb-4">
          <p className="text-gray-400 text-xs mb-2">Quick Add Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'WhatsApp Integration', cost: 5, tier: 'pro', category: 'integration' },
              { name: 'SMS Notifications', cost: 3, tier: 'pro', category: 'integration' },
              { name: 'GPT-4o Access', cost: 2, tier: 'basic', category: 'feature' },
              { name: 'Claude Sonnet', cost: 2.5, tier: 'pro', category: 'feature' },
              { name: 'Unlimited Media', cost: 10, tier: 'enterprise', category: 'limit' },
              { name: 'API Access', cost: 15, tier: 'enterprise', category: 'feature' },
              { name: 'Priority Support', cost: 5, tier: 'pro', category: 'support' },
              { name: 'Voice Mode', cost: 8, tier: 'pro', category: 'feature' },
            ].filter(s => !pricingFeatures.find(f => f.name === s.name)).map((suggestion) => (
              <button
                key={suggestion.name}
                onClick={() => {
                  setFeatureForm({
                    name: suggestion.name,
                    description: '',
                    tier: suggestion.tier,
                    cost_type: 'per_user',
                    cost_value: suggestion.cost,
                    status: 'planned',
                    category: suggestion.category,
                  });
                  setShowFeatureModal(true);
                }}
                className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-gray-400 hover:text-white transition-colors"
              >
                + {suggestion.name} (${suggestion.cost}/user)
              </button>
            ))}
          </div>
        </div>

        {/* Calculate with Features Button */}
        <button
          onClick={calculateWithFeatures}
          className="w-full py-2 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/30 text-pink-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Calculate Pricing with All Features
        </button>

        {/* Calculated Results */}
        {calculatedPricing && (
          <div className="mt-4 bg-black/30 border border-white/10 rounded-lg p-4">
            <h4 className="text-white text-sm font-medium mb-3">Pricing with Custom Features</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-white/10">
                    <th className="text-left py-2">Tier</th>
                    <th className="text-right py-2">Base Cost</th>
                    <th className="text-right py-2">Feature Cost</th>
                    <th className="text-right py-2">Total Cost</th>
                    <th className="text-right py-2">@ 70%</th>
                    <th className="text-right py-2">@ 80%</th>
                    <th className="text-right py-2">@ 90%</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(calculatedPricing.tier_costs || {}).map(([tier, data]) => (
                    <tr key={tier} className="border-b border-white/5">
                      <td className="py-2 text-white capitalize font-medium">{tier}</td>
                      <td className="py-2 text-right text-gray-400">${data.base_cost}</td>
                      <td className="py-2 text-right text-pink-400">${data.feature_cost}</td>
                      <td className="py-2 text-right text-red-400 font-medium">${data.total_cost}</td>
                      <td className="py-2 text-right text-gray-400">${data.prices?.at_70_margin}</td>
                      <td className="py-2 text-right text-green-400">${data.prices?.at_80_margin}</td>
                      <td className="py-2 text-right text-gray-400">${data.prices?.at_90_margin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {calculatedPricing.addons?.length > 0 && (
              <div className="mt-3">
                <p className="text-gray-400 text-xs mb-2">Add-ons:</p>
                <div className="flex flex-wrap gap-2">
                  {calculatedPricing.addons.map((addon) => (
                    <span key={addon.id} className="px-2 py-1 bg-pink-500/10 border border-pink-500/20 rounded text-[10px]">
                      <span className="text-white">{addon.name}:</span>
                      <span className="text-pink-400 ml-1">${addon.recommended_price}/mo</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feature Modal */}
      {showFeatureModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141a21] border border-white/10 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">
                {editingFeature ? 'Edit Feature' : 'Add Feature'}
              </h3>
              <button onClick={() => setShowFeatureModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Feature Name *</label>
                <input
                  type="text"
                  value={featureForm.name}
                  onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })}
                  placeholder="e.g., WhatsApp Integration"
                  className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-pink-500/40 outline-none"
                />
              </div>
              
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Description</label>
                <input
                  type="text"
                  value={featureForm.description}
                  onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-pink-500/40 outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Tier *</label>
                  <select
                    value={featureForm.tier}
                    onChange={(e) => setFeatureForm({ ...featureForm, tier: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-pink-500/40 outline-none"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="addon">Add-on</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Category</label>
                  <select
                    value={featureForm.category}
                    onChange={(e) => setFeatureForm({ ...featureForm, category: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-pink-500/40 outline-none"
                  >
                    <option value="feature">Feature</option>
                    <option value="integration">Integration</option>
                    <option value="limit">Limit/Quota</option>
                    <option value="support">Support</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Cost Type</label>
                  <select
                    value={featureForm.cost_type}
                    onChange={(e) => setFeatureForm({ ...featureForm, cost_type: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-pink-500/40 outline-none"
                  >
                    <option value="per_user">Per User/Month</option>
                    <option value="per_message">Per Message</option>
                    <option value="per_use">Per Use</option>
                    <option value="fixed">Fixed/Month</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={featureForm.cost_value}
                    onChange={(e) => setFeatureForm({ ...featureForm, cost_value: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-pink-500/40 outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Status</label>
                <select
                  value={featureForm.status}
                  onChange={(e) => setFeatureForm({ ...featureForm, status: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-pink-500/40 outline-none"
                >
                  <option value="active">Active (Live)</option>
                  <option value="planned">Planned</option>
                  <option value="considering">Considering</option>
                </select>
              </div>
            </div>
            
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setShowFeatureModal(false)}
                className="flex-1 py-2 bg-white/5 text-gray-400 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveFeature}
                disabled={!featureForm.name}
                className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {editingFeature ? 'Update' : 'Add'} Feature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Segmentation */}
      <div className="bg-gradient-to-r from-purple-500/5 to-transparent border border-purple-500/20 rounded-xl p-4">
        <h3 className="text-purple-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          User Segmentation by Usage
        </h3>
        <p className="text-gray-500 text-xs mb-4">Understanding how users consume your product helps set tier limits</p>
        
        <div className="grid grid-cols-5 gap-2">
          {insights.user_segments && Object.entries(insights.user_segments).map(([tier, data]) => (
            <div key={tier} className={`p-3 rounded-lg border ${
              tier === 'power' ? 'bg-orange-500/10 border-orange-500/30' :
              tier === 'heavy' ? 'bg-green-500/10 border-green-500/30' :
              tier === 'moderate' ? 'bg-blue-500/10 border-blue-500/30' :
              tier === 'light' ? 'bg-gray-500/10 border-gray-500/30' :
              'bg-red-500/10 border-red-500/30'
            }`}>
              <p className="text-white text-lg font-bold">{data.count}</p>
              <p className="text-gray-400 text-xs capitalize">{tier}</p>
              <p className="text-gray-600 text-[10px]">{data.percentage}%</p>
              {data.range && <p className="text-gray-600 text-[10px]">{data.range}</p>}
            </div>
          ))}
        </div>
        
        {/* Visual Bar */}
        <div className="mt-4 h-4 rounded-full overflow-hidden flex">
          <div style={{width: `${insights.user_segments.inactive?.percentage || 0}%`}} className="bg-red-500/50" title="Inactive" />
          <div style={{width: `${insights.user_segments.light?.percentage || 0}%`}} className="bg-gray-500/50" title="Light" />
          <div style={{width: `${insights.user_segments.moderate?.percentage || 0}%`}} className="bg-blue-500/50" title="Moderate" />
          <div style={{width: `${insights.user_segments.heavy?.percentage || 0}%`}} className="bg-green-500/50" title="Heavy" />
          <div style={{width: `${insights.user_segments.power?.percentage || 0}%`}} className="bg-orange-500/50" title="Power" />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>Inactive</span>
          <span>Light (1-20)</span>
          <span>Moderate (21-100)</span>
          <span>Heavy (101-500)</span>
          <span>Power (500+)</span>
        </div>
      </div>

      {/* Pricing Recommendations */}
      <div className="bg-gradient-to-r from-green-500/5 to-transparent border border-green-500/20 rounded-xl p-4">
        <h3 className="text-green-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Pricing Tier Recommendations (70-90% Gross Margin)
        </h3>
        <p className="text-gray-500 text-xs mb-4">Based on your actual costs and target margins. Market reference: ChatGPT Plus, Claude Pro, Perplexity Pro all charge $20/mo.</p>
        
        {/* Cost Analysis */}
        <div className="bg-black/30 border border-white/10 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">💰</span>
            <span className="text-white text-xs font-medium">Your Cost Structure</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            <div>
              <p className="text-gray-500 text-[10px]">Cost/Message</p>
              <p className="text-green-400 font-bold">${insights.pricing_recommendations.cost_per_message?.toFixed(4) || '0.00'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px]">Avg Cost/User</p>
              <p className="text-green-400 font-bold">${insights.pricing_recommendations.avg_cost_per_user?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px]">Total LLM Cost</p>
              <p className="text-blue-400 font-bold">${insights.pricing_recommendations.total_llm_cost?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px]">Total Voice Cost</p>
              <p className="text-orange-400 font-bold">${insights.pricing_recommendations.total_voice_cost?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px]">Total Media Cost</p>
              <p className="text-purple-400 font-bold">${insights.pricing_recommendations.total_media_cost?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px]">Total Platform Cost</p>
              <p className="text-white font-bold text-lg">${insights.pricing_recommendations.total_platform_cost?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
          <p className="text-gray-600 text-[10px]">Tier pricing below includes all costs (LLM + Voice + Media) for accurate margin calculations</p>
        </div>

        {/* Voice Chat Cost Analysis */}
        {insights.voice_costs && (
          <div className="bg-black/30 border border-orange-500/20 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">🎙️</span>
              <span className="text-orange-400 text-xs font-medium">Voice Chat Costs (For Pricing Voice Features)</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
              <div>
                <p className="text-gray-500 text-[10px]">Total Voice Cost</p>
                <p className="text-orange-400 font-bold">${insights.voice_costs.total_cost_usd?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px]">Cost/Session</p>
                <p className="text-orange-400 font-bold">${insights.voice_costs.cost_per_session?.toFixed(3) || '0.000'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px]">Cost/Minute</p>
                <p className="text-orange-400 font-bold">${insights.voice_costs.cost_per_minute?.toFixed(3) || '0.000'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px]">Cost/Voice User</p>
                <p className="text-orange-400 font-bold">${insights.voice_costs.cost_per_user?.toFixed(3) || '0.000'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px]">Voice Sessions</p>
                <p className="text-orange-400 font-bold">{insights.voice_costs.total_sessions || 0}</p>
              </div>
            </div>
            
            {/* Voice Usage Stats */}
            <div className="grid grid-cols-4 gap-2 mb-3 text-center">
              <div className="bg-black/30 rounded p-2">
                <p className="text-white font-bold">{insights.voice_costs.unique_users || 0}</p>
                <p className="text-gray-600 text-[10px]">Voice Users</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="text-white font-bold">{Math.round((insights.voice_costs.total_duration_seconds || 0) / 60)}m</p>
                <p className="text-gray-600 text-[10px]">Total Duration</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="text-white font-bold">{Math.round((insights.voice_costs.avg_duration_seconds || 0) / 60)}m</p>
                <p className="text-gray-600 text-[10px]">Avg Session</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="text-white font-bold">
                  {((insights.voice_costs.total_audio_input_tokens || 0) + (insights.voice_costs.total_audio_output_tokens || 0)).toLocaleString()}
                </p>
                <p className="text-gray-600 text-[10px]">Audio Tokens</p>
              </div>
            </div>

            {/* Voice Pricing Suggestions */}
            <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2">
              <p className="text-orange-400 text-[10px] font-bold mb-2">💡 Voice Pricing Suggestions</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Per minute (3x markup):</span>
                  <span className="text-white font-medium">${((insights.voice_costs.cost_per_minute || 0) * 3).toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Per session (5x markup):</span>
                  <span className="text-white font-medium">${((insights.voice_costs.cost_per_session || 0) * 5).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly voice add-on:</span>
                  <span className="text-orange-400 font-bold">${Math.max(5, Math.ceil((insights.voice_costs.cost_per_user || 0) * 5))}</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              Based on OpenAI gpt-4o-realtime: $40/1M input, $80/1M output audio tokens (~50 tokens/second)
            </p>
          </div>
        )}

        {/* Tier Pricing Table */}
        {insights.pricing_recommendations.tiers && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-white/10">
                  <th className="text-left py-2 px-2">Tier</th>
                  <th className="text-center py-2 px-2">Msg Limit</th>
                  <th className="text-right py-2 px-2">Est. Cost</th>
                  <th className="text-right py-2 px-2">@ 70% Margin</th>
                  <th className="text-right py-2 px-2">@ 80% Margin</th>
                  <th className="text-right py-2 px-2">@ 90% Margin</th>
                  <th className="text-right py-2 px-2 text-green-400">Recommended</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5 bg-gray-500/5">
                  <td className="py-2 px-2 text-gray-400 font-medium">🆓 Free</td>
                  <td className="py-2 px-2 text-center text-white">{insights.pricing_recommendations.tiers.free?.message_limit || 25}</td>
                  <td className="py-2 px-2 text-right text-red-400">${insights.pricing_recommendations.tiers.free?.estimated_cost || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-500">-</td>
                  <td className="py-2 px-2 text-right text-gray-500">-</td>
                  <td className="py-2 px-2 text-right text-gray-500">-</td>
                  <td className="py-2 px-2 text-right text-green-400 font-bold">$0</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2 text-blue-400 font-medium">⭐ Basic</td>
                  <td className="py-2 px-2 text-center text-white">{insights.pricing_recommendations.tiers.basic?.message_limit || 100}</td>
                  <td className="py-2 px-2 text-right text-red-400">${insights.pricing_recommendations.tiers.basic?.estimated_cost || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-400">${insights.pricing_recommendations.tiers.basic?.price_at_70_margin || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-400">${insights.pricing_recommendations.tiers.basic?.price_at_80_margin || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-400">${insights.pricing_recommendations.tiers.basic?.price_at_90_margin || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-green-400 font-bold">${insights.pricing_recommendations.tiers.basic?.recommended_price || 10}/mo</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-2 text-purple-400 font-medium">🚀 Pro</td>
                  <td className="py-2 px-2 text-center text-white">{insights.pricing_recommendations.tiers.pro?.message_limit || 500}</td>
                  <td className="py-2 px-2 text-right text-red-400">${insights.pricing_recommendations.tiers.pro?.estimated_cost || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-400">${insights.pricing_recommendations.tiers.pro?.price_at_70_margin || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-400">${insights.pricing_recommendations.tiers.pro?.price_at_80_margin || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-400">${insights.pricing_recommendations.tiers.pro?.price_at_90_margin || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-green-400 font-bold">${insights.pricing_recommendations.tiers.pro?.recommended_price || 20}/mo</td>
                </tr>
                <tr className="border-b border-white/5 bg-orange-500/5">
                  <td className="py-2 px-2 text-orange-400 font-medium">🏢 Enterprise</td>
                  <td className="py-2 px-2 text-center text-white">Unlimited</td>
                  <td className="py-2 px-2 text-right text-red-400">${insights.pricing_recommendations.tiers.enterprise?.estimated_cost || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-400">${insights.pricing_recommendations.tiers.enterprise?.price_at_70_margin || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-400">${insights.pricing_recommendations.tiers.enterprise?.price_at_80_margin || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-gray-400">${insights.pricing_recommendations.tiers.enterprise?.price_at_90_margin || '0.00'}</td>
                  <td className="py-2 px-2 text-right text-green-400 font-bold">${insights.pricing_recommendations.tiers.enterprise?.recommended_price || 99}/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Pricing Calculator */}
      <div className="bg-gradient-to-r from-cyan-500/5 to-transparent border border-cyan-500/20 rounded-xl p-4">
        <h3 className="text-cyan-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Pricing Calculator / Estimator
        </h3>
        <p className="text-gray-500 text-xs mb-4">Enter your desired prices to see real-time margin calculations based on your actual costs</p>
        
        {/* Calculator Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-white/10">
                <th className="text-left py-2 px-2">Tier</th>
                <th className="text-center py-2 px-2">Your Price</th>
                <th className="text-center py-2 px-2">Msg Limit</th>
                <th className="text-right py-2 px-2">Est. Cost</th>
                <th className="text-right py-2 px-2">Gross Margin</th>
                <th className="text-right py-2 px-2">Margin Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Free Tier */}
              <tr className="border-b border-white/5 bg-gray-500/5">
                <td className="py-3 px-2 text-gray-400 font-medium">🆓 Free</td>
                <td className="py-3 px-2 text-center">
                  <span className="text-gray-500">$0</span>
                </td>
                <td className="py-3 px-2 text-center">
                  <input
                    type="number"
                    value={customPricing.free.msgLimit}
                    onChange={(e) => setCustomPricing({...customPricing, free: {...customPricing.free, msgLimit: parseInt(e.target.value) || 0}})}
                    className="w-20 bg-black/30 border border-white/10 text-white text-center rounded px-2 py-1"
                  />
                </td>
                <td className="py-3 px-2 text-right text-red-400">
                  ${getTierCost(customPricing.free.msgLimit).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right text-gray-500">N/A</td>
                <td className="py-3 px-2 text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">Acquisition</span>
                </td>
              </tr>
              
              {/* Basic Tier */}
              <tr className="border-b border-white/5">
                <td className="py-3 px-2 text-blue-400 font-medium">⭐ Basic</td>
                <td className="py-3 px-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      value={customPricing.basic.price}
                      onChange={(e) => setCustomPricing({...customPricing, basic: {...customPricing.basic, price: parseFloat(e.target.value) || 0}})}
                      className="w-16 bg-black/30 border border-white/10 text-white text-center rounded px-2 py-1"
                      step="0.01"
                    />
                    <span className="text-gray-500">/mo</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <input
                    type="number"
                    value={customPricing.basic.msgLimit}
                    onChange={(e) => setCustomPricing({...customPricing, basic: {...customPricing.basic, msgLimit: parseInt(e.target.value) || 0}})}
                    className="w-20 bg-black/30 border border-white/10 text-white text-center rounded px-2 py-1"
                  />
                </td>
                <td className="py-3 px-2 text-right text-red-400">
                  ${getTierCost(customPricing.basic.msgLimit).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-bold">
                  <span className={calculateMargin(customPricing.basic.price, getTierCost(customPricing.basic.msgLimit)) >= 70 ? 'text-green-400' : calculateMargin(customPricing.basic.price, getTierCost(customPricing.basic.msgLimit)) >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                    {calculateMargin(customPricing.basic.price, getTierCost(customPricing.basic.msgLimit))}%
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  {calculateMargin(customPricing.basic.price, getTierCost(customPricing.basic.msgLimit)) >= 90 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400">Excellent</span>
                  ) : calculateMargin(customPricing.basic.price, getTierCost(customPricing.basic.msgLimit)) >= 70 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400">Good</span>
                  ) : calculateMargin(customPricing.basic.price, getTierCost(customPricing.basic.msgLimit)) >= 50 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Low</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">Too Low</span>
                  )}
                </td>
              </tr>
              
              {/* Pro Tier */}
              <tr className="border-b border-white/5">
                <td className="py-3 px-2 text-purple-400 font-medium">🚀 Pro</td>
                <td className="py-3 px-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      value={customPricing.pro.price}
                      onChange={(e) => setCustomPricing({...customPricing, pro: {...customPricing.pro, price: parseFloat(e.target.value) || 0}})}
                      className="w-16 bg-black/30 border border-white/10 text-white text-center rounded px-2 py-1"
                      step="0.01"
                    />
                    <span className="text-gray-500">/mo</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <input
                    type="number"
                    value={customPricing.pro.msgLimit}
                    onChange={(e) => setCustomPricing({...customPricing, pro: {...customPricing.pro, msgLimit: parseInt(e.target.value) || 0}})}
                    className="w-20 bg-black/30 border border-white/10 text-white text-center rounded px-2 py-1"
                  />
                </td>
                <td className="py-3 px-2 text-right text-red-400">
                  ${getTierCost(customPricing.pro.msgLimit).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-bold">
                  <span className={calculateMargin(customPricing.pro.price, getTierCost(customPricing.pro.msgLimit)) >= 70 ? 'text-green-400' : calculateMargin(customPricing.pro.price, getTierCost(customPricing.pro.msgLimit)) >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                    {calculateMargin(customPricing.pro.price, getTierCost(customPricing.pro.msgLimit))}%
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  {calculateMargin(customPricing.pro.price, getTierCost(customPricing.pro.msgLimit)) >= 90 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400">Excellent</span>
                  ) : calculateMargin(customPricing.pro.price, getTierCost(customPricing.pro.msgLimit)) >= 70 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400">Good</span>
                  ) : calculateMargin(customPricing.pro.price, getTierCost(customPricing.pro.msgLimit)) >= 50 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Low</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">Too Low</span>
                  )}
                </td>
              </tr>
              
              {/* Enterprise Tier */}
              <tr className="border-b border-white/5 bg-orange-500/5">
                <td className="py-3 px-2 text-orange-400 font-medium">🏢 Enterprise</td>
                <td className="py-3 px-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      value={customPricing.enterprise.price}
                      onChange={(e) => setCustomPricing({...customPricing, enterprise: {...customPricing.enterprise, price: parseFloat(e.target.value) || 0}})}
                      className="w-16 bg-black/30 border border-white/10 text-white text-center rounded px-2 py-1"
                      step="0.01"
                    />
                    <span className="text-gray-500">/mo</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center text-gray-500">Unlimited</td>
                <td className="py-3 px-2 text-right text-red-400">
                  ${getTierCost('unlimited').toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-bold">
                  <span className={calculateMargin(customPricing.enterprise.price, getTierCost('unlimited')) >= 70 ? 'text-green-400' : calculateMargin(customPricing.enterprise.price, getTierCost('unlimited')) >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                    {calculateMargin(customPricing.enterprise.price, getTierCost('unlimited'))}%
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  {calculateMargin(customPricing.enterprise.price, getTierCost('unlimited')) >= 90 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400">Excellent</span>
                  ) : calculateMargin(customPricing.enterprise.price, getTierCost('unlimited')) >= 70 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400">Good</span>
                  ) : calculateMargin(customPricing.enterprise.price, getTierCost('unlimited')) >= 50 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Low</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">Too Low</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* MRR Estimator */}
        <div className="mt-4 bg-black/30 border border-white/10 rounded-lg p-4">
          <h4 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Estimated Monthly Recurring Revenue (MRR)
          </h4>
          <p className="text-gray-500 text-xs mb-3">Based on your current user segments and custom pricing</p>
          
          {(() => {
            const mrr = calculateEstimatedMRR();
            return (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px] mb-1">Free Tier</p>
                    <p className="text-gray-400 text-lg font-bold">{mrr.breakdown.free?.users || 0}</p>
                    <p className="text-gray-600 text-xs">$0 MRR</p>
                  </div>
                  <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                    <p className="text-blue-400 text-[10px] mb-1">Basic @ ${customPricing.basic.price}</p>
                    <p className="text-blue-400 text-lg font-bold">{mrr.breakdown.basic?.users || 0}</p>
                    <p className="text-blue-300 text-xs">${mrr.breakdown.basic?.revenue || 0} MRR</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-lg p-3 text-center">
                    <p className="text-purple-400 text-[10px] mb-1">Pro @ ${customPricing.pro.price}</p>
                    <p className="text-purple-400 text-lg font-bold">{mrr.breakdown.pro?.users || 0}</p>
                    <p className="text-purple-300 text-xs">${mrr.breakdown.pro?.revenue || 0} MRR</p>
                  </div>
                  <div className="bg-orange-500/10 rounded-lg p-3 text-center">
                    <p className="text-orange-400 text-[10px] mb-1">Enterprise @ ${customPricing.enterprise.price}</p>
                    <p className="text-orange-400 text-lg font-bold">{mrr.breakdown.enterprise?.users || 0}</p>
                    <p className="text-orange-300 text-xs">${mrr.breakdown.enterprise?.revenue || 0} MRR</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between bg-gradient-to-r from-green-500/20 to-green-500/5 border border-green-500/30 rounded-lg p-4">
                  <div>
                    <p className="text-green-400 text-xs font-medium">Total Estimated MRR</p>
                    <p className="text-gray-500 text-[10px]">If all users convert at their expected tier</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 text-3xl font-bold">${mrr.mrr.toLocaleString()}</p>
                    <p className="text-green-300 text-xs">per month</p>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500">
                  <AlertCircle className="w-3 h-3" />
                  <span>ARR (Annual): ${(mrr.mrr * 12).toLocaleString()} | Assumes 100% conversion at tier levels</span>
                </div>
              </>
            );
          })()}
        </div>
        
        {/* Quick Presets */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-gray-500 text-xs py-1">Quick Presets:</span>
          <button
            onClick={() => setCustomPricing({
              free: { price: 0, msgLimit: 25 },
              basic: { price: 9.99, msgLimit: 100 },
              pro: { price: 19.99, msgLimit: 500 },
              enterprise: { price: 49.99, msgLimit: 'unlimited' },
            })}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-gray-400 hover:text-white transition-colors"
          >
            Budget ($10/$20/$50)
          </button>
          <button
            onClick={() => setCustomPricing({
              free: { price: 0, msgLimit: 50 },
              basic: { price: 14.99, msgLimit: 200 },
              pro: { price: 29.99, msgLimit: 1000 },
              enterprise: { price: 99.99, msgLimit: 'unlimited' },
            })}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-gray-400 hover:text-white transition-colors"
          >
            Competitive ($15/$30/$100)
          </button>
          <button
            onClick={() => setCustomPricing({
              free: { price: 0, msgLimit: 20 },
              basic: { price: 19.99, msgLimit: 150 },
              pro: { price: 39.99, msgLimit: 500 },
              enterprise: { price: 149.99, msgLimit: 'unlimited' },
            })}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-gray-400 hover:text-white transition-colors"
          >
            Premium ($20/$40/$150)
          </button>
          <button
            onClick={() => setCustomPricing({
              free: { price: 0, msgLimit: insights?.pricing_recommendations?.tiers?.free?.message_limit || 25 },
              basic: { price: insights?.pricing_recommendations?.tiers?.basic?.recommended_price || 10, msgLimit: insights?.pricing_recommendations?.tiers?.basic?.message_limit || 100 },
              pro: { price: insights?.pricing_recommendations?.tiers?.pro?.recommended_price || 20, msgLimit: insights?.pricing_recommendations?.tiers?.pro?.message_limit || 500 },
              enterprise: { price: insights?.pricing_recommendations?.tiers?.enterprise?.recommended_price || 99, msgLimit: 'unlimited' },
            })}
            className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Reset to Recommended
          </button>
        </div>
      </div>

      {/* Dynamic Tier Recommendations */}
      {insights.tier_recommendations && (
        <div className="bg-gradient-to-r from-yellow-500/5 to-transparent border border-yellow-500/20 rounded-xl p-4">
          <h3 className="text-yellow-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Dynamic Tier Feature Recommendations
          </h3>
          <p className="text-gray-500 text-xs mb-4">Based on actual feature usage patterns across your user segments. Features are recommended for tiers where they show high adoption.</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Free Tier */}
            <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🆓</span>
                <h4 className="text-gray-300 text-sm font-bold">Free Tier</h4>
              </div>
              <p className="text-gray-500 text-xs mb-3">{insights.tier_recommendations.free?.description}</p>
              
              <div className="space-y-2 mb-4">
                <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Included Features:</p>
                {insights.tier_recommendations.free?.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-black/20 rounded p-2">
                    <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-white text-xs">{feature.name}</span>
                      {feature.reason && <p className="text-gray-500 text-[10px]">{feature.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
              
              {insights.tier_recommendations.free?.limits?.length > 0 && (
                <div className="space-y-1 mb-3">
                  <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Suggested Limits:</p>
                  {insights.tier_recommendations.free.limits.map((limit, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-500 capitalize">{limit.type}:</span>
                      <span className="text-yellow-400">{limit.value} {limit.unit || ''}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {insights.tier_recommendations.free?.upsell_triggers?.length > 0 && (
                <div>
                  <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-1">Upsell Triggers:</p>
                  <div className="flex flex-wrap gap-1">
                    {insights.tier_recommendations.free.upsell_triggers.map((trigger, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] rounded">
                        {trigger}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Basic Tier */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⭐</span>
                <h4 className="text-blue-400 text-sm font-bold">Basic Tier</h4>
              </div>
              <p className="text-gray-500 text-xs mb-3">{insights.tier_recommendations.basic?.description}</p>
              
              <div className="space-y-2 mb-4">
                <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Recommended Features:</p>
                {insights.tier_recommendations.basic?.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-black/20 rounded p-2">
                    <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-white text-xs">{feature.name}</span>
                      {feature.reason && <p className="text-blue-400/70 text-[10px]">{feature.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
              
              {insights.tier_recommendations.basic?.limits?.length > 0 && (
                <div className="space-y-1 mb-3">
                  <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Suggested Limits:</p>
                  {insights.tier_recommendations.basic.limits.map((limit, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-500 capitalize">{limit.type}:</span>
                      <span className="text-blue-400">{limit.value} {limit.unit || ''}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {insights.tier_recommendations.basic?.upsell_triggers?.length > 0 && (
                <div>
                  <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-1">Upsell Triggers:</p>
                  <div className="flex flex-wrap gap-1">
                    {insights.tier_recommendations.basic.upsell_triggers.map((trigger, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] rounded">
                        {trigger}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Pro Tier */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🚀</span>
                <h4 className="text-purple-400 text-sm font-bold">Pro Tier</h4>
              </div>
              <p className="text-gray-500 text-xs mb-3">{insights.tier_recommendations.pro?.description}</p>
              
              <div className="space-y-2 mb-4">
                <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Recommended Features:</p>
                {insights.tier_recommendations.pro?.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-black/20 rounded p-2">
                    <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-white text-xs">{feature.name}</span>
                      {feature.reason && <p className="text-purple-400/70 text-[10px]">{feature.reason}</p>}
                      {feature.limit && <p className="text-yellow-400/70 text-[10px]">Limit: {feature.limit}</p>}
                    </div>
                  </div>
                ))}
              </div>
              
              {insights.tier_recommendations.pro?.limits?.length > 0 && (
                <div className="space-y-1 mb-3">
                  <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">Suggested Limits:</p>
                  {insights.tier_recommendations.pro.limits.map((limit, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-500 capitalize">{limit.type}:</span>
                      <span className="text-purple-400">{limit.value} {limit.unit || ''}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {insights.tier_recommendations.pro?.upsell_triggers?.length > 0 && (
                <div>
                  <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-1">Upsell Triggers:</p>
                  <div className="flex flex-wrap gap-1">
                    {insights.tier_recommendations.pro.upsell_triggers.map((trigger, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] rounded">
                        {trigger}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Enterprise Tier */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🏢</span>
                <h4 className="text-orange-400 text-sm font-bold">Enterprise Tier</h4>
              </div>
              <p className="text-gray-500 text-xs mb-3">{insights.tier_recommendations.enterprise?.description}</p>
              
              <div className="space-y-2 mb-4">
                <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">All Features Included:</p>
                {insights.tier_recommendations.enterprise?.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-black/20 rounded p-2">
                    <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-white text-xs">{feature.name}</span>
                      {feature.reason && <p className="text-orange-400/70 text-[10px]">{feature.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-gradient-to-r from-orange-500/20 to-transparent border border-orange-500/20 rounded p-2">
                <p className="text-orange-400 text-xs font-medium">💡 No limits - full platform access</p>
              </div>
            </div>
          </div>
          
          {/* Feature Usage by Segment */}
          {insights.features_by_segment && (
            <div className="mt-4 bg-black/30 border border-white/10 rounded-lg p-4">
              <h4 className="text-white text-sm font-medium mb-3">Feature Usage by User Segment</h4>
              <p className="text-gray-500 text-xs mb-3">Adoption rates that drive these recommendations</p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/10">
                      <th className="text-left py-2 px-2">Feature</th>
                      <th className="text-center py-2 px-2">Light (1-20)</th>
                      <th className="text-center py-2 px-2">Moderate (21-100)</th>
                      <th className="text-center py-2 px-2">Heavy (101-500)</th>
                      <th className="text-center py-2 px-2">Power (500+)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['has_soulprint', 'has_imports', 'has_media', 'has_memories', 'uses_web_search', 'uses_premium_models'].map((feature) => (
                      <tr key={feature} className="border-b border-white/5">
                        <td className="py-2 px-2 text-white capitalize">{feature.replace(/_/g, ' ')}</td>
                        {['light', 'moderate', 'heavy', 'power'].map((segment) => {
                          const rate = insights.features_by_segment[segment]?.features?.[feature]?.rate || 0;
                          return (
                            <td key={segment} className="py-2 px-2 text-center">
                              <span className={rate > 50 ? 'text-green-400 font-bold' : rate > 25 ? 'text-yellow-400' : 'text-gray-500'}>
                                {rate}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-3 flex items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span className="text-gray-500">&gt;50% = High adoption</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  <span className="text-gray-500">25-50% = Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                  <span className="text-gray-500">&lt;25% = Low</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revenue Potential */}
      <div className="bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/20 rounded-xl p-4">
        <h3 className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Revenue Potential Scenarios
        </h3>
        <p className="text-gray-500 text-xs mb-4">Estimated MRR based on different pricing strategies</p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Scenario 1: Free tier at 20 msgs */}
          <div className="bg-black/30 border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📊</span>
              <h4 className="text-white text-sm font-medium">If Free Tier = 20 messages/mo</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Paying Users (would exceed limit)</span>
                <span className="text-white font-medium">{insights.revenue_potential.if_free_tier_20_msgs.paying_users}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Est. MRR @ $10/mo</span>
                <span className="text-green-400 font-bold">${insights.revenue_potential.if_free_tier_20_msgs.at_10_per_month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Est. MRR @ $20/mo</span>
                <span className="text-green-400 font-bold">${insights.revenue_potential.if_free_tier_20_msgs.at_20_per_month}</span>
              </div>
            </div>
          </div>
          
          {/* Scenario 2: Free tier at 50 msgs */}
          <div className="bg-black/30 border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📈</span>
              <h4 className="text-white text-sm font-medium">If Free Tier = 50 messages/mo</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Paying Users (would exceed limit)</span>
                <span className="text-white font-medium">{insights.revenue_potential.if_free_tier_50_msgs.paying_users}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Est. MRR @ $10/mo</span>
                <span className="text-green-400 font-bold">${insights.revenue_potential.if_free_tier_50_msgs.at_10_per_month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Est. MRR @ $20/mo</span>
                <span className="text-green-400 font-bold">${insights.revenue_potential.if_free_tier_50_msgs.at_20_per_month}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏢</span>
            <span className="text-orange-400 font-medium">Enterprise Candidates: {insights.revenue_potential.enterprise_candidates}</span>
            <span className="text-gray-500 text-xs">(500+ messages)</span>
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-black/30 border border-white/10 rounded-xl p-4">
        <h3 className="text-white text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-orange-400" />
          Top 20 Power Users
        </h3>
        <p className="text-gray-500 text-xs mb-4">Your most engaged users - potential enterprise customers or advocates</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-white/10">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">User</th>
                <th className="text-right py-2 px-2">Messages</th>
                <th className="text-right py-2 px-2">Media</th>
                <th className="text-right py-2 px-2">Est. Cost</th>
                <th className="text-right py-2 px-2">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {insights.top_users?.slice(0, 10).map((user, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-2 text-gray-600">{idx + 1}</td>
                  <td className="py-2 px-2">
                    <span className="text-white">{user.name}</span>
                    <span className="text-gray-600 ml-2">{user.email?.substring(0, 20)}...</span>
                  </td>
                  <td className="py-2 px-2 text-right text-orange-400 font-medium">{user.messages}</td>
                  <td className="py-2 px-2 text-right text-purple-400">{user.media_generated}</td>
                  <td className="py-2 px-2 text-right text-green-400">${user.estimated_cost}</td>
                  <td className="py-2 px-2 text-right text-gray-500">
                    {user.last_active ? new Date(user.last_active).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Popularity */}
      <div className="bg-black/30 border border-white/10 rounded-xl p-4">
        <h3 className="text-white text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          Model Usage Distribution
        </h3>
        <p className="text-gray-500 text-xs mb-4">Which AI models are users preferring? Consider gating premium models behind paid tiers.</p>
        
        <div className="space-y-2">
          {insights.model_popularity?.slice(0, 8).map((model, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-gray-500 text-xs w-32 truncate">{model.model}</span>
              <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    idx === 0 ? 'bg-orange-500' :
                    idx === 1 ? 'bg-blue-500' :
                    idx === 2 ? 'bg-green-500' :
                    'bg-gray-500'
                  }`}
                  style={{width: `${model.percentage}%`}}
                />
              </div>
              <span className="text-gray-400 text-xs w-16 text-right">{model.percentage}%</span>
              <span className="text-gray-600 text-xs w-16 text-right">({model.count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Adoption */}
      <div className="bg-black/30 border border-white/10 rounded-xl p-4">
        <h3 className="text-white text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-green-400" />
          Feature Adoption Rates
        </h3>
        <p className="text-gray-500 text-xs mb-4">Features with low adoption might need better UX; high adoption features justify premium tiers.</p>
        
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(insights.feature_adoption).map(([feature, data]) => (
            <div key={feature} className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-gray-400 text-xs capitalize mb-1">{feature.replace(/_/g, ' ')}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-white text-lg font-bold">{data.rate}%</span>
                <span className="text-gray-600 text-xs">({data.users} users)</span>
              </div>
              <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    data.rate > 50 ? 'bg-green-500' :
                    data.rate > 25 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{width: `${data.rate}%`}}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Churn Indicators */}
      <div className="bg-gradient-to-r from-red-500/5 to-transparent border border-red-500/20 rounded-xl p-4">
        <h3 className="text-red-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Churn & Retention Indicators
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-black/30 border border-white/10 rounded-lg p-3">
            <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Inactive 30+ Days</p>
            <p className="text-red-400 text-2xl font-bold">{insights.churn_indicators.inactive_30d}</p>
            <p className="text-gray-600 text-xs">users</p>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-lg p-3">
            <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Churn Rate</p>
            <p className={`text-2xl font-bold ${insights.churn_indicators.churn_rate > 30 ? 'text-red-400' : 'text-yellow-400'}`}>
              {insights.churn_indicators.churn_rate}%
            </p>
            <p className="text-gray-600 text-xs">30-day inactive</p>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-lg p-3">
            <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Never Engaged</p>
            <p className="text-orange-400 text-2xl font-bold">{insights.churn_indicators.never_engaged}</p>
            <p className="text-gray-600 text-xs">0 messages</p>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-lg p-3">
            <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Drop-off Rate</p>
            <p className={`text-2xl font-bold ${insights.churn_indicators.drop_off_rate > 30 ? 'text-red-400' : 'text-yellow-400'}`}>
              {insights.churn_indicators.drop_off_rate}%
            </p>
            <p className="text-gray-600 text-xs">signed up, never used</p>
          </div>
        </div>
      </div>

      {/* Weekly Trends */}
      <div className="bg-black/30 border border-white/10 rounded-xl p-4">
        <h3 className="text-white text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-400" />
          Weekly Trends (Last 4 Weeks)
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-white/10">
                <th className="text-left py-2 px-3">Period</th>
                <th className="text-right py-2 px-3">Messages</th>
                <th className="text-right py-2 px-3">Active Users</th>
                <th className="text-right py-2 px-3">New Users</th>
              </tr>
            </thead>
            <tbody>
              {insights.weekly_trends?.map((week, idx) => (
                <tr key={idx} className="border-b border-white/5">
                  <td className="py-2 px-3 text-white">{week.week} <span className="text-gray-600">({week.start})</span></td>
                  <td className="py-2 px-3 text-right text-orange-400">{week.messages}</td>
                  <td className="py-2 px-3 text-right text-blue-400">{week.active_users}</td>
                  <td className="py-2 px-3 text-right text-green-400">{week.new_users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Media Insights */}
      <div className="bg-black/30 border border-white/10 rounded-xl p-4">
        <h3 className="text-white text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <Image className="w-4 h-4 text-purple-400" />
          Media Generation Insights
        </h3>
        <p className="text-gray-500 text-xs mb-4">Media generation is resource-intensive - consider as a premium feature.</p>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-gray-500 text-[10px] uppercase">Users Using Media</p>
            <p className="text-purple-400 text-xl font-bold">{insights.media_insights.users_using_media}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-gray-500 text-[10px] uppercase">Adoption Rate</p>
            <p className="text-purple-400 text-xl font-bold">{insights.media_insights.media_adoption_rate}%</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-gray-500 text-[10px] uppercase">Avg Media/User</p>
            <p className="text-purple-400 text-xl font-bold">{insights.media_insights.avg_media_per_user}</p>
          </div>
        </div>
        
        {insights.media_insights.by_type?.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-500 text-xs">By Type:</p>
            {insights.media_insights.by_type.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <span className="text-white capitalize">{item.type || 'Unknown'}</span>
                <div className="flex items-center gap-4">
                  <span className="text-gray-400">{item.count} items</span>
                  <span className="text-green-400">${item.total_cost}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Settings Tab
function SettingsTab({ token }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tgSetup, setTgSetup] = useState(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [betaStats, setBetaStats] = useState(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setSettings).catch(() => {});
    // Fetch beta code stats
    fetch('/api/admin/beta-code/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setBetaStats).catch(() => {});
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

  async function generateNewCode() {
    const newCode = prompt('Enter new beta access code (or leave empty for random):');
    if (newCode === null) return; // User cancelled
    
    setGeneratingCode(true);
    try {
      const res = await fetch('/api/admin/beta-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          code: newCode.trim() || undefined,
          expires_at: settings.beta_code_expires_at || null 
        }),
      });
      const data = await res.json();
      if (data.code) {
        setSettings(s => ({ ...s, beta_access_code: data.code }));
        setBetaStats(prev => ({ ...prev, code: data.code, uses: 0 }));
        alert(`Beta code set to: ${data.code}`);
      }
    } catch (e) {
      alert('Failed to generate code');
    }
    setGeneratingCode(false);
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

      {/* Voice Chat Feature Toggle */}
      <div className="p-4 bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/20 rounded-xl">
        <label className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-3 block flex items-center gap-2">
          <Cpu className="w-4 h-4" />
          Voice Chat Feature
        </label>
        <p className="text-gray-500 text-xs mb-4">
          Enable real-time voice conversations with AI. Uses OpenAI Realtime API. Toggle off to hide the voice chat button for all users.
        </p>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={async () => {
              const newEnabled = !settings.voice_chat_enabled;
              setSettings(s => ({ ...s, voice_chat_enabled: newEnabled }));
              try {
                await fetch('/api/admin/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ ...settings, voice_chat_enabled: newEnabled }),
                });
              } catch (e) {
                console.error('Failed to toggle voice chat:', e);
              }
            }}
            className={`w-12 h-6 rounded-full transition-all relative ${settings.voice_chat_enabled !== false ? 'bg-orange-500' : 'bg-white/10'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.voice_chat_enabled !== false ? 'right-1' : 'left-1'}`} />
          </button>
          <span className="text-gray-400 text-sm">
            {settings.voice_chat_enabled !== false ? 'Voice chat enabled for all users' : 'Voice chat disabled'}
          </span>
        </div>
      </div>

      {/* Viral Invite Program */}
      <div className="p-4 bg-gradient-to-r from-purple-500/5 to-transparent border border-purple-500/20 rounded-xl">
        <label className="text-purple-400 text-xs font-bold tracking-widest uppercase mb-3 block flex items-center gap-2">
          <Users className="w-4 h-4" />
          Viral Invite Program
        </label>
        <p className="text-gray-500 text-xs mb-4">
          Let beta users invite their friends. Each user gets 5 invites to share. New invited users also get 5 invites, creating a viral loop.
        </p>
        
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={async () => {
              const newEnabled = !settings.viral_invites_enabled;
              setSettings(s => ({ ...s, viral_invites_enabled: newEnabled }));
              try {
                await fetch('/api/admin/invites/toggle', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ enabled: newEnabled }),
                });
              } catch (e) {
                console.error('Failed to toggle viral invites:', e);
              }
            }}
            className={`w-12 h-6 rounded-full transition-all relative ${settings.viral_invites_enabled ? 'bg-purple-500' : 'bg-white/10'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.viral_invites_enabled ? 'right-1' : 'left-1'}`} />
          </button>
          <span className="text-gray-400 text-sm">
            {settings.viral_invites_enabled ? '✅ Invite program is ACTIVE' : '❌ Invite program is OFF'}
          </span>
        </div>

        {settings.viral_invites_enabled && (
          <div className="bg-black/30 border border-white/10 rounded-lg p-3 space-y-3">
            <p className="text-gray-400 text-xs">
              <span className="text-white font-medium">How it works:</span> Each user gets a unique invite link. When their friends sign up, both get access and the new user also gets 5 invites.
            </p>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-purple-400">🎟️</span>
                <span className="text-gray-400">5 invites per user</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-purple-400">🏆</span>
                <span className="text-gray-400">Badges for milestones</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Beta Access Code */}
      {settings.waitlist_enabled && (
        <div className="p-4 bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/20 rounded-xl">
          <label className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-3 block flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Beta Access Code
          </label>
          <p className="text-gray-500 text-xs mb-4">
            Share this code with beta users so they can bypass the waitlist during registration or from the waitlist page.
          </p>
          
          {/* Current Code Display */}
          <div className="bg-black/30 border border-white/10 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Current Code</p>
                {betaStats?.code ? (
                  <p className="text-white font-mono text-lg tracking-widest">{betaStats.code}</p>
                ) : (
                  <p className="text-gray-600 italic text-sm">No code set</p>
                )}
              </div>
              <button
                onClick={() => {
                  if (betaStats?.code) {
                    navigator.clipboard.writeText(betaStats.code);
                    alert('Code copied to clipboard!');
                  }
                }}
                disabled={!betaStats?.code}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs rounded-lg transition-colors disabled:opacity-30"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Code Stats */}
          {betaStats?.code && (
            <div className="flex items-center gap-4 mb-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-green-400" />
                <span className="text-gray-400"><span className="text-white font-medium">{betaStats.uses || 0}</span> uses</span>
              </div>
              {betaStats.expires_at && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-gray-400">Expires: <span className="text-white">{new Date(betaStats.expires_at).toLocaleDateString()}</span></span>
                </div>
              )}
            </div>
          )}

          {/* Generate/Change Code */}
          <div className="flex items-center gap-2">
            <button
              onClick={generateNewCode}
              disabled={generatingCode}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {betaStats?.code ? 'Change Code' : 'Generate Code'}
            </button>
            {betaStats?.code && (
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to disable the beta code?')) {
                    await fetch('/api/admin/beta-code', {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    setBetaStats(prev => ({ ...prev, code: null, uses: 0 }));
                  }
                }}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors"
              >
                Disable
              </button>
            )}
          </div>

          {/* Expiration Date */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 block">Code Expiration (Optional)</label>
            <input
              type="date"
              value={settings.beta_code_expires_at ? settings.beta_code_expires_at.split('T')[0] : ''}
              onChange={e => setSettings(s => ({ ...s, beta_code_expires_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
              className="bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 w-full focus:border-orange-500/40"
            />
            <p className="text-gray-600 text-[10px] mt-1">Leave empty for no expiration</p>
          </div>

          {/* Send Code via Email */}
          {betaStats?.code && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Send Code via Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="user@email.com"
                  id="betaEmailInput"
                  className="flex-1 bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:border-orange-500/40"
                />
                <button
                  onClick={async () => {
                    const emailInput = document.getElementById('betaEmailInput');
                    const email = emailInput?.value?.trim();
                    if (!email) { alert('Enter an email address'); return; }
                    
                    try {
                      const res = await fetch('/api/admin/beta-code/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ email }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        alert(`Beta code sent to ${email}!`);
                        emailInput.value = '';
                      } else {
                        alert(data.error || 'Failed to send');
                      }
                    } catch (e) {
                      alert('Failed to send email');
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
              <p className="text-gray-500 text-xs">12 questions (2 per pillar) + learns as they chat (~3 min)</p>
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

// Support Tab - Resolve Issues & Notify Users
function SupportTab({ token }) {
  const [userEmail, setUserEmail] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [message, setMessage] = useState('');
  const [subjectSuffix, setSubjectSuffix] = useState('Your reported issue has been resolved');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load resolution history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch('/api/admin/support-history', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHistory(data.resolutions || []);
        }
      } catch {}
      setLoadingHistory(false);
    };
    if (token) loadHistory();
  }, [token]);

  const handleResolve = async () => {
    if (!userEmail || !message) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/resolve-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_email: userEmail,
          conversation_id: conversationId || undefined,
          message,
          subject_suffix: subjectSuffix,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        // Add to history
        setHistory(prev => [{ user_email: userEmail, conversation_id: conversationId, message, created_at: new Date().toISOString(), results: data.results }, ...prev]);
        // Clear form
        setUserEmail('');
        setConversationId('');
        setMessage('');
      }
    } catch (e) {
      setResult({ success: false, message: e.message });
    }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      {/* Resolve Issue Form */}
      <div className="bg-[#111] border border-white/8 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Resolve Issue & Notify User</h3>
            <p className="text-gray-500 text-xs">Send resolution notice via email, in-app popup, and conversation message</p>
          </div>
        </div>
        
        <div className="space-y-4">
          {/* User Email */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">User Email *</label>
            <input
              type="email"
              value={userEmail}
              onChange={e => setUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Conversation ID */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Conversation ID <span className="text-gray-600">(optional — to inject message in chat)</span></label>
            <input
              value={conversationId}
              onChange={e => setConversationId(e.target.value)}
              placeholder="e.g. 495341f5-22d9-4931-9286-efee08199374"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-colors font-mono"
            />
          </div>

          {/* Email Subject */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Subject Line</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 whitespace-nowrap">[SoulPrint Engine Support]</span>
              <input
                value={subjectSuffix}
                onChange={e => setSubjectSuffix(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Resolution Message */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Resolution Message *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe what was fixed and any next steps for the user..."
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Notification Channels Preview */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">📧 Email</span>
            <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">🔔 In-App Popup</span>
            {conversationId && <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">💬 Conversation Message</span>}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleResolve}
            disabled={sending || !userEmail || !message}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending Notifications...' : 'Resolve & Notify User'}
          </button>

          {/* Result */}
          {result && (
            <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <p className={`text-sm font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? '✅ ' : '❌ '}{result.message}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Resolution History */}
      <div className="bg-[#111] border border-white/8 rounded-xl p-5">
        <h3 className="text-white font-bold text-base mb-4">Recent Resolutions</h3>
        {loadingHistory ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-gray-500 animate-spin" /></div>
        ) : history.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-6">No resolutions yet</p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 10).map((item, idx) => (
              <div key={idx} className="p-3 bg-black/30 rounded-lg border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{item.user_email}</span>
                  <span className="text-[10px] text-gray-600">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2">{item.message}</p>
                {item.results && (
                  <div className="flex gap-2 mt-1.5">
                    <span className={`text-[10px] ${item.results.email ? 'text-green-500' : 'text-red-500'}`}>Email {item.results.email ? '✓' : '✗'}</span>
                    <span className={`text-[10px] ${item.results.notification ? 'text-green-500' : 'text-red-500'}`}>In-app {item.results.notification ? '✓' : '✗'}</span>
                    <span className={`text-[10px] ${item.results.conversation_message ? 'text-green-500' : 'text-red-500'}`}>Chat {item.results.conversation_message ? '✓' : '✗'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('metrics');
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(null);
  const [token, setToken] = useState('');
  const [adminRole, setAdminRole] = useState('admin');
  const [loading, setLoading] = useState(true);
  const [waitlistCount, setWaitlistCount] = useState(0);
  
  // Dashboard sub-tabs and date range
  const [metricsSubTab, setMetricsSubTab] = useState('quick');
  const [dateRange, setDateRange] = useState('30d');
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const autoRefreshInterval = 30000; // 30 seconds

  const loadMetrics = async (t, start = null, end = null) => {
    setMetricsLoading(true);
    setMetricsError(null);
    
    let url = '/api/admin/metrics';
    if (start && end) {
      url += `?startDate=${start}&endDate=${end}`;
    } else if (dateRange !== 'all' && dateRange !== 'custom') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : null;
      if (days) {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
    }
    
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
      const d = await res.json();
      
      if (res.ok && d && !d.error) {
        setMetrics(d);
        setWaitlistCount(d.waitlist_count || 0);
        setLastRefreshed(new Date());
      } else {
        console.error('Metrics API error:', d);
        setMetricsError(d.error || 'Failed to load metrics');
      }
    } catch (err) {
      console.error('Metrics fetch error:', err);
      setMetricsError('Failed to connect to server');
    } finally {
      setMetricsLoading(false);
    }
  };
  
  const applyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      loadMetrics(token, customStartDate, customEndDate);
    }
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

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !token) return;
    const interval = setInterval(() => {
      if (activeTab === 'metrics') {
        loadMetrics(token);
      }
    }, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, token, activeTab, dateRange]);

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
            <div className="flex items-center gap-3">
              {/* Auto-refresh controls */}
              <div className="flex items-center gap-2" data-testid="auto-refresh-controls">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    autoRefresh 
                      ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' 
                      : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10 hover:text-gray-300'
                  }`}
                  data-testid="auto-refresh-toggle"
                >
                  <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} style={autoRefresh ? { animationDuration: '3s' } : {}} />
                  {autoRefresh ? 'Live' : 'Paused'}
                </button>
                {lastRefreshed && (
                  <span className="text-gray-600 text-[10px] hidden sm:inline" data-testid="last-refreshed">
                    Updated {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => loadMetrics(token)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white border border-white/10 transition-colors"
                  title="Refresh now"
                  data-testid="manual-refresh-btn"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          
          {activeTab === 'metrics' && (
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                    {[
                      { id: 'quick', label: 'Quick Stats' },
                      { id: 'users', label: 'User Metrics' },
                      { id: 'engagement', label: 'Engagement' },
                      { id: 'costs', label: 'Costs' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setMetricsSubTab(tab.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          metricsSubTab === tab.id 
                            ? 'bg-orange-500 text-white' 
                            : 'text-gray-500 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <select
                      value={dateRange}
                      onChange={e => {
                        setDateRange(e.target.value);
                        if (e.target.value === 'custom') {
                          setShowCustomDateRange(true);
                        } else {
                          setShowCustomDateRange(false);
                          loadMetrics(token);
                        }
                      }}
                      className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-orange-500/50 outline-none cursor-pointer [&>option]:bg-[#1a1a1a] [&>option]:text-white"
                    >
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="all">All time</option>
                      <option value="custom">Custom range</option>
                    </select>
                    <button onClick={() => loadMetrics(token)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors px-3 py-1.5 bg-white/3 border border-white/8 rounded-lg">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                {/* Custom Date Range Picker */}
                {showCustomDateRange && (
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3 w-fit">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white/10 border border-white/20 rounded px-2 py-1.5 text-xs text-white"
                    />
                    <span className="text-gray-500 text-xs">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white/10 border border-white/20 rounded px-2 py-1.5 text-xs text-white"
                    />
                    <button
                      onClick={applyCustomDateRange}
                      disabled={!customStartDate || !customEndDate}
                      className="px-3 py-1.5 bg-orange-500 text-white text-xs rounded disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            )}

          {activeTab === 'metrics' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Loading State */}
              {metricsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  <span className="ml-3 text-gray-400">Loading metrics...</span>
                </div>
              )}
              
              {/* Error State */}
              {metricsError && !metricsLoading && (
                <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                  <p className="text-red-400 mb-3">{metricsError}</p>
                  <button 
                    onClick={() => loadMetrics(token)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm"
                  >
                    Retry
                  </button>
                </div>
              )}
              
              {/* Metrics Content */}
              {metrics && !metricsLoading && !metricsError && (
                <>
              {/* Quick Stats Sub-tab */}
              {metricsSubTab === 'quick' && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <MetricCard label="Total Users" value={metrics.total_users} sub={`${metrics.accepted_users || 0} approved`} icon={Users} color="orange" />
                    <MetricCard label="WAU" value={metrics.wau} sub="Weekly Active" icon={TrendingUp} color="green" />
                    <MetricCard label="Day 7 Ret." value={metrics.day7_retention != null ? `${metrics.day7_retention}%` : '—'} icon={UserCheck} color="blue" />
                    <MetricCard label="CSAT" value={metrics.csat != null ? `${metrics.csat}%` : '—'} sub={`${metrics.thumbs_up || 0}↑ ${metrics.thumbs_down || 0}↓`} icon={ThumbsUp} color="purple" />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <MetricCard label="Total Msgs" value={metrics.total_messages} icon={MessageSquare} color="green" />
                    <MetricCard label="New (30d)" value={metrics.recent_signups_30d} icon={Users} color="blue" />
                    <MetricCard
                      label="Est. Monthly Total"
                      value={metrics.est_projected_monthly_cost != null ? `$${metrics.est_projected_monthly_cost.toFixed(3)}` : '—'}
                      sub="LLM costs"
                      icon={DollarSign}
                      color="orange"
                    />
                  </div>
                  
                  {/* Voice Chat Summary - Quick Overview */}
                  <p className="text-[10px] font-bold text-purple-400 tracking-widest uppercase mt-6 mb-3">🎙️ Voice Chat</p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <MetricCard 
                      label="Voice Sessions" 
                      value={metrics.voice_chat?.total_sessions ?? 0} 
                      sub={`${metrics.voice_chat?.sessions_30d ?? 0} last 30d`}
                      icon={MessageSquare} 
                      color="purple" 
                    />
                    <MetricCard 
                      label="Voice Users" 
                      value={metrics.voice_chat?.unique_users ?? 0} 
                      sub="Used voice chat"
                      icon={Users} 
                      color="blue" 
                    />
                    <MetricCard 
                      label="Avg Duration" 
                      value={metrics.voice_chat?.avg_duration_seconds ? `${Math.round(metrics.voice_chat.avg_duration_seconds / 60)}m ${Math.round(metrics.voice_chat.avg_duration_seconds % 60)}s` : '0s'} 
                      sub="Per session"
                      icon={Clock} 
                      color="green" 
                    />
                    <MetricCard 
                      label="Voice Cost" 
                      value={`$${(metrics.voice_chat?.cost?.total_cost_usd ?? 0).toFixed(2)}`}
                      sub={`$${(metrics.voice_chat?.cost?.cost_last_30d_usd ?? 0).toFixed(2)} last 30d`}
                      icon={DollarSign} 
                      color="orange" 
                    />
                  </div>
                </>
              )}

              {/* User Metrics Sub-tab */}
              {metricsSubTab === 'users' && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <MetricCard label="Total Users" value={metrics.total_users} sub={`${metrics.accepted_users || 0} approved`} icon={Users} color="orange" />
                    <MetricCard label="New (30d)" value={metrics.recent_signups_30d} icon={Users} color="blue" />
                    <MetricCard label="Day 7 Ret." value={metrics.day7_retention != null ? `${metrics.day7_retention}%` : '—'} icon={UserCheck} color="green" />
                    <MetricCard label="Multi-Session" value={`${metrics.multi_session_rate}%`} sub="2+ convos" icon={Database} color="purple" />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <MetricCard label="WAU" value={metrics.wau} sub="Weekly Active" icon={TrendingUp} color="orange" />
                    <MetricCard label="Assessment" value={`${metrics.assessment_completion_rate}%`} icon={FileText} color="blue" />
                    <MetricCard label="Import Rate" value={`${metrics.import_adoption_rate}%`} icon={Upload} color="green" />
                    <MetricCard label="CSAT" value={metrics.csat != null ? `${metrics.csat}%` : '—'} sub={`${metrics.thumbs_up || 0}↑ ${metrics.thumbs_down || 0}↓`} icon={ThumbsUp} color="purple" />
                  </div>
                </>
              )}

              {/* Engagement Sub-tab */}
              {metricsSubTab === 'engagement' && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <MetricCard label="Sess/User (7d)" value={metrics.avg_sessions_per_user_7d} icon={Clock} color="orange" />
                    <MetricCard label="Msgs/Session" value={metrics.avg_messages_per_session} icon={MessageSquare} color="green" />
                    <MetricCard label="Total Msgs" value={metrics.total_messages} icon={MessageSquare} color="blue" />
                    <MetricCard label="CSAT" value={metrics.csat != null ? `${metrics.csat}%` : '—'} sub={`${metrics.thumbs_up || 0}↑ ${metrics.thumbs_down || 0}↓`} icon={ThumbsUp} color="purple" />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <MetricCard label="Assessment" value={`${metrics.assessment_completion_rate}%`} sub="Completion rate" icon={FileText} color="orange" />
                    <MetricCard label="Import Rate" value={`${metrics.import_adoption_rate}%`} sub="Data imports" icon={Upload} color="green" />
                    <MetricCard label="Multi-Session" value={`${metrics.multi_session_rate}%`} sub="Users with 2+ convos" icon={Database} color="blue" />
                  </div>
                  
                  {/* Telegram Metrics */}
                  {metrics.telegram && (metrics.telegram.linked_users > 0 || metrics.telegram.messages_total > 0) && (
                    <>
                      <p className="text-[10px] font-bold text-blue-400 tracking-widest uppercase mt-6 mb-3">📱 Telegram</p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <MetricCard 
                          label="Linked Users" 
                          value={metrics.telegram.linked_users || 0} 
                          sub={`${metrics.telegram.adoption_rate || 0}% adoption`}
                          icon={MessageSquare} 
                          color="blue" 
                        />
                        <MetricCard 
                          label="TG Messages" 
                          value={metrics.telegram.messages_total || 0} 
                          sub={`${metrics.telegram.messages_30d || 0} last 30d`}
                          icon={MessageSquare} 
                          color="green" 
                        />
                        <MetricCard 
                          label="TG WAU" 
                          value={metrics.telegram.weekly_active_users || 0} 
                          sub="Weekly active"
                          icon={TrendingUp} 
                          color="purple" 
                        />
                        <MetricCard 
                          label="TG Convos" 
                          value={metrics.telegram.conversations || 0} 
                          sub="Total conversations"
                          icon={Database} 
                          color="orange" 
                        />
                      </div>
                      
                      {/* Platform Breakdown */}
                      <div className="mt-4 p-4 bg-white/3 border border-white/5 rounded-xl">
                        <p className="text-xs font-medium text-gray-400 mb-3">Platform Message Distribution</p>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">Web App</span>
                              <span className="text-white">{metrics.platform_breakdown?.web?.messages_total || 0}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-500 rounded-full" 
                                style={{ width: `${metrics.total_messages > 0 ? ((metrics.platform_breakdown?.web?.messages_total || 0) / metrics.total_messages * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">Telegram</span>
                              <span className="text-white">{metrics.platform_breakdown?.telegram?.messages_total || 0}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full" 
                                style={{ width: `${metrics.total_messages > 0 ? ((metrics.platform_breakdown?.telegram?.messages_total || 0) / metrics.total_messages * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Voice Chat Metrics - Always show (even with zeros) */}
                  <>
                    <p className="text-[10px] font-bold text-purple-400 tracking-widest uppercase mt-6 mb-3">🎙️ Voice Chat</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <MetricCard 
                        label="Total Sessions" 
                        value={metrics.voice_chat?.total_sessions || 0} 
                        sub={`${metrics.voice_chat?.sessions_30d || 0} last 30d`}
                        icon={MessageSquare} 
                        color="purple" 
                      />
                      <MetricCard 
                        label="Unique Users" 
                        value={metrics.voice_chat?.unique_users || 0} 
                        sub="Used voice chat"
                        icon={Users} 
                        color="blue" 
                      />
                      <MetricCard 
                        label="Avg Duration" 
                        value={metrics.voice_chat?.avg_duration_seconds ? `${Math.round(metrics.voice_chat.avg_duration_seconds / 60)}m ${metrics.voice_chat.avg_duration_seconds % 60}s` : '0s'} 
                        sub="Per session"
                        icon={Clock} 
                        color="green" 
                      />
                      <MetricCard 
                        label="Total Talk Time" 
                        value={metrics.voice_chat?.total_duration_seconds ? `${Math.round(metrics.voice_chat.total_duration_seconds / 60)}m` : '0m'} 
                        sub="All sessions"
                        icon={TrendingUp} 
                        color="orange" 
                      />
                    </div>
                    
                    {/* Voice Distribution */}
                    {metrics.voice_chat?.voice_distribution && Object.keys(metrics.voice_chat.voice_distribution).length > 0 && (
                      <div className="mt-4 p-4 bg-white/3 border border-white/5 rounded-xl">
                        <p className="text-xs font-medium text-gray-400 mb-3">Voice Popularity</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(metrics.voice_chat.voice_distribution)
                            .sort((a, b) => b[1] - a[1])
                            .map(([voice, count]) => (
                              <div key={voice} className="flex justify-between items-center bg-white/5 rounded-lg px-3 py-2">
                                <span className="text-xs text-gray-400 capitalize">{voice}</span>
                                <span className="text-xs font-bold text-white">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Voice Chat Stats Summary */}
                    <div className="mt-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                      <p className="text-xs font-medium text-purple-400 mb-2">Voice Chat Summary</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-500">Completed Sessions:</span>
                          <span className="text-white ml-2">{metrics.voice_chat?.completed_sessions || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Avg Messages/Session:</span>
                          <span className="text-white ml-2">{metrics.voice_chat?.avg_messages_per_session || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Sessions (7d):</span>
                          <span className="text-white ml-2">{metrics.voice_chat?.sessions_7d || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Voice Messages:</span>
                          <span className="text-white ml-2">{metrics.voice_chat?.total_voice_messages || 0}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Voice Chat Cost Metrics - For Pricing Decisions */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <p className="text-xs font-bold text-green-400">Voice Chat Costs (Pricing Data)</p>
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Cost</p>
                          <p className="text-lg font-bold text-green-400">${metrics.voice_chat?.cost?.total_cost_usd?.toFixed(2) || '0.00'}</p>
                          <p className="text-[10px] text-gray-500">All time</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cost (30d)</p>
                          <p className="text-lg font-bold text-blue-400">${metrics.voice_chat?.cost?.cost_last_30d_usd?.toFixed(2) || '0.00'}</p>
                          <p className="text-[10px] text-gray-500">Last 30 days</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cost/Minute</p>
                          <p className="text-lg font-bold text-orange-400">${metrics.voice_chat?.cost?.cost_per_minute_usd?.toFixed(3) || '0.000'}</p>
                          <p className="text-[10px] text-gray-500">Per minute of voice</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Cost/Session</p>
                          <p className="text-lg font-bold text-purple-400">${metrics.voice_chat?.cost?.avg_cost_per_session_usd?.toFixed(3) || '0.000'}</p>
                          <p className="text-[10px] text-gray-500">Per voice session</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cost/User</p>
                          <p className="text-lg font-bold text-cyan-400">${metrics.voice_chat?.cost?.cost_per_user_usd?.toFixed(3) || '0.000'}</p>
                          <p className="text-[10px] text-gray-500">Per voice user</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Audio Tokens</p>
                          <p className="text-sm font-bold text-white">
                            {((metrics.voice_chat?.cost?.total_audio_input_tokens || 0) + (metrics.voice_chat?.cost?.total_audio_output_tokens || 0)).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            In: {(metrics.voice_chat?.cost?.total_audio_input_tokens || 0).toLocaleString()} / Out: {(metrics.voice_chat?.cost?.total_audio_output_tokens || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <p className="text-[10px] text-gray-500 mt-3 text-center">
                        💡 {metrics.voice_chat?.cost?.pricing_note || 'Based on gpt-4o-realtime: $40/1M input, $80/1M output audio tokens'}
                      </p>
                    </div>
                  </>
                </>
              )}

              {/* Costs Sub-tab */}
              {metricsSubTab === 'costs' && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-orange-400" />
                    <h3 className="text-sm font-bold text-white tracking-wide">LLM Cost Estimates</h3>
                    <span className="text-[10px] text-gray-600 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">mid-2025 pricing</span>
                  </div>
                  
                  {/* Last 30 Days Section */}
                  <div className="mb-6">
                    <p className="text-[10px] font-bold text-green-400 tracking-widest uppercase mb-3">📅 Last 30 Days</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <MetricCard
                        label="Total Cost (30d)"
                        value={metrics.est_total_cost_30d != null ? `$${metrics.est_total_cost_30d.toFixed(2)}` : '—'}
                        sub={`${metrics.total_messages_30d || 0} messages`}
                        icon={DollarSign}
                        color="green"
                      />
                      <MetricCard
                        label="Cost / Active User"
                        value={metrics.est_cost_per_active_user_30d != null ? `$${metrics.est_cost_per_active_user_30d.toFixed(2)}` : '—'}
                        sub={`${metrics.active_users_30d || 0} active users`}
                        icon={User}
                        color="blue"
                      />
                      <MetricCard
                        label="Msgs / Active User"
                        value={metrics.messages_per_active_user_30d || '—'}
                        sub="Last 30 days"
                        icon={MessageSquare}
                        color="purple"
                      />
                      <MetricCard
                        label="Avg Cost / Message"
                        value={metrics.avg_cost_per_message_30d != null ? `$${metrics.avg_cost_per_message_30d.toFixed(4)}` : '—'}
                        sub="Last 30 days"
                        icon={TrendingUp}
                        color="orange"
                      />
                    </div>
                  </div>
                  
                  {/* All Time Section */}
                  <div className="mb-6">
                    <p className="text-[10px] font-bold text-purple-400 tracking-widest uppercase mb-3">⏳ All Time</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <MetricCard
                        label="Total Cost (All-time)"
                        value={metrics.est_total_cost != null ? `$${metrics.est_total_cost.toFixed(2)}` : '—'}
                        sub={`${metrics.total_messages || 0} total messages`}
                        icon={Zap}
                        color="purple"
                      />
                      <MetricCard
                        label="Cost / User (All-time)"
                        value={metrics.est_cost_per_user_all_time != null ? `$${metrics.est_cost_per_user_all_time.toFixed(2)}` : '—'}
                        sub={`${metrics.accepted_users || 0} total users`}
                        icon={Users}
                        color="blue"
                      />
                      <MetricCard
                        label="Msgs / User (All-time)"
                        value={metrics.messages_per_user_all_time || '—'}
                        sub="Average per user"
                        icon={MessageSquare}
                        color="green"
                      />
                      <MetricCard
                        label="Avg Cost / Message"
                        value={metrics.avg_cost_per_message != null ? `$${metrics.avg_cost_per_message.toFixed(4)}` : '—'}
                        sub="All time average"
                        icon={TrendingUp}
                        color="orange"
                      />
                    </div>
                  </div>

                  {/* Cost by model breakdown - Last 30 Days */}
                  {metrics.cost_by_model_30d && Object.keys(metrics.cost_by_model_30d).length > 0 && (
                    <div className="bg-[#111] border border-white/8 rounded-xl p-4 mb-4">
                      <p className="text-[10px] font-bold text-green-400 tracking-widest uppercase mb-3">Cost by Model (Last 30 Days)</p>
                      <div className="space-y-2">
                        {Object.entries(metrics.cost_by_model_30d)
                          .sort((a, b) => b[1].cost - a[1].cost)
                          .map(([modelName, data]) => {
                            const maxCost = Object.values(metrics.cost_by_model_30d).reduce((max, d) => Math.max(max, d.cost), 1);
                            const pct = Math.round((data.cost / maxCost) * 100);
                            return (
                              <div key={modelName} className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 w-48 truncate flex-shrink-0">{modelName || 'unknown'}</span>
                                <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                                  <div className="h-full bg-green-500/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-green-400 w-16 text-right flex-shrink-0">${data.cost.toFixed(4)}</span>
                                <span className="text-[10px] text-gray-600 w-16 text-right flex-shrink-0">{data.messages} msgs</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Cost by model breakdown - All Time */}
                  {costByModelEntries.length > 0 && (
                    <div className="bg-[#111] border border-white/8 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-purple-400 tracking-widest uppercase mb-3">Cost by Model (All Time)</p>
                      <div className="space-y-2">
                        {costByModelEntries.map(([modelName, data]) => {
                          const maxCost = costByModelEntries[0][1].cost || 1;
                          const pct = Math.round((data.cost / maxCost) * 100);
                          return (
                            <div key={modelName} className="flex items-center gap-3">
                              <span className="text-xs text-gray-400 w-48 truncate flex-shrink-0">{modelName || 'unknown'}</span>
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

                  {/* Media Generation Costs Section */}
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Image className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-bold text-white tracking-wide">Media Generation Costs (Kie.ai)</h3>
                    </div>

                    {/* Grand Total Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <MetricCard
                        label="Total Media Cost"
                        value={metrics.media_cost_total != null ? `$${metrics.media_cost_total.toFixed(2)}` : '—'}
                        sub={`${metrics.media_count_total || 0} generations`}
                        icon={DollarSign}
                        color="purple"
                      />
                      <MetricCard
                        label="Media Cost (30d)"
                        value={metrics.media_cost_30d != null ? `$${metrics.media_cost_30d.toFixed(2)}` : '—'}
                        sub={`${metrics.media_count_30d || 0} generations`}
                        icon={TrendingUp}
                        color="blue"
                      />
                      <MetricCard
                        label="Grand Total (LLM+Media)"
                        value={metrics.grand_total_cost != null ? `$${metrics.grand_total_cost.toFixed(2)}` : '—'}
                        sub="All-time combined"
                        icon={Zap}
                        color="orange"
                      />
                      <MetricCard
                        label="Grand Total (30d)"
                        value={metrics.grand_total_cost_30d != null ? `$${metrics.grand_total_cost_30d.toFixed(2)}` : '—'}
                        sub="Combined monthly"
                        icon={Sparkles}
                        color="green"
                      />
                    </div>

                    {/* Media cost breakdown by model */}
                    {metrics.media_cost_by_model && Object.keys(metrics.media_cost_by_model).length > 0 && (
                      <div className="bg-[#111] border border-white/8 rounded-xl p-4">
                        <p className="text-[10px] font-bold text-purple-400 tracking-widest uppercase mb-3">Media Cost by Model</p>
                        <div className="space-y-2">
                          {Object.entries(metrics.media_cost_by_model)
                            .sort((a, b) => b[1].cost - a[1].cost)
                            .map(([key, data]) => {
                              const maxCost = Object.values(metrics.media_cost_by_model).reduce((max, d) => Math.max(max, d.cost), 0.01);
                              const pct = Math.round((data.cost / maxCost) * 100);
                              const typeIcon = data.type === 'image' ? '🖼️' : '🎬';
                              return (
                                <div key={key} className="flex items-center gap-3">
                                  <span className="text-xs text-gray-400 w-48 truncate flex-shrink-0">
                                    {typeIcon} {data.model || 'unknown'}
                                  </span>
                                  <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <div className="h-full bg-purple-500/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-purple-400 w-16 text-right flex-shrink-0">${data.cost.toFixed(4)}</span>
                                  <span className="text-[10px] text-gray-600 w-20 text-right flex-shrink-0">{data.count} / {data.credits}cr</span>
                                </div>
                              );
                            })}
                        </div>
                        <p className="text-[10px] text-gray-700 mt-3 pt-3 border-t border-white/5">
                          Kie.ai: 1 credit ≈ $0.005. Images: 5-50 credits. Videos: 20-100 credits.
                        </p>
                      </div>
                    )}
                    {(!metrics.media_cost_by_model || Object.keys(metrics.media_cost_by_model).length === 0) && (
                      <div className="bg-[#111] border border-white/8 rounded-xl p-5 text-center text-gray-600 text-xs">
                        Media costs will appear here after users generate images/videos
                      </div>
                    )}
                  </div>

                  {/* Voice Chat Costs Section */}
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Mic className="w-4 h-4 text-orange-400" />
                      <h3 className="text-sm font-bold text-white tracking-wide">Voice Chat Costs (OpenAI Realtime)</h3>
                    </div>

                    {/* Voice Cost Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      <MetricCard
                        label="Total Voice Cost"
                        value={metrics.voice_chat?.cost?.total_cost_usd != null ? `$${metrics.voice_chat.cost.total_cost_usd.toFixed(2)}` : '—'}
                        sub={`${metrics.voice_chat?.completed_sessions || 0} sessions`}
                        icon={DollarSign}
                        color="orange"
                      />
                      <MetricCard
                        label="Voice Cost (30d)"
                        value={metrics.voice_chat?.cost?.cost_last_30d_usd != null ? `$${metrics.voice_chat.cost.cost_last_30d_usd.toFixed(2)}` : '—'}
                        sub={`${metrics.voice_chat?.sessions_30d || 0} sessions`}
                        icon={TrendingUp}
                        color="blue"
                      />
                      <MetricCard
                        label="Cost / Session"
                        value={metrics.voice_chat?.cost?.avg_cost_per_session_usd != null ? `$${metrics.voice_chat.cost.avg_cost_per_session_usd.toFixed(3)}` : '—'}
                        sub="Average per call"
                        icon={Phone}
                        color="purple"
                      />
                      <MetricCard
                        label="Cost / Minute"
                        value={metrics.voice_chat?.cost?.cost_per_minute_usd != null ? `$${metrics.voice_chat.cost.cost_per_minute_usd.toFixed(3)}` : '—'}
                        sub="Per minute of voice"
                        icon={Clock}
                        color="green"
                      />
                      <MetricCard
                        label="Cost / Voice User"
                        value={metrics.voice_chat?.cost?.cost_per_user_usd != null ? `$${metrics.voice_chat.cost.cost_per_user_usd.toFixed(3)}` : '—'}
                        sub={`${metrics.voice_chat?.unique_users || 0} users`}
                        icon={User}
                        color="cyan"
                      />
                      <MetricCard
                        label="Total Audio Tokens"
                        value={((metrics.voice_chat?.cost?.total_audio_input_tokens || 0) + (metrics.voice_chat?.cost?.total_audio_output_tokens || 0)).toLocaleString()}
                        sub={`In: ${(metrics.voice_chat?.cost?.total_audio_input_tokens || 0).toLocaleString()} / Out: ${(metrics.voice_chat?.cost?.total_audio_output_tokens || 0).toLocaleString()}`}
                        icon={Mic}
                        color="orange"
                      />
                    </div>

                    {/* Voice Usage Stats */}
                    <div className="bg-[#111] border border-white/8 rounded-xl p-4 mb-4">
                      <p className="text-[10px] font-bold text-orange-400 tracking-widest uppercase mb-3">Voice Usage Breakdown</p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-xl font-bold text-white">{metrics.voice_chat?.total_sessions || 0}</p>
                          <p className="text-[10px] text-gray-500">Total Sessions</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-xl font-bold text-white">{metrics.voice_chat?.unique_users || 0}</p>
                          <p className="text-[10px] text-gray-500">Unique Users</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-xl font-bold text-white">{Math.round((metrics.voice_chat?.total_duration_seconds || 0) / 60)}m</p>
                          <p className="text-[10px] text-gray-500">Total Duration</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-xl font-bold text-white">{Math.round((metrics.voice_chat?.avg_duration_seconds || 0) / 60)}m</p>
                          <p className="text-[10px] text-gray-500">Avg Duration</p>
                        </div>
                      </div>
                      
                      {/* Voice Distribution */}
                      {metrics.voice_chat?.voice_distribution && Object.keys(metrics.voice_chat.voice_distribution).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <p className="text-[10px] text-gray-500 mb-2">Voice Distribution</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(metrics.voice_chat.voice_distribution).map(([voice, count]) => (
                              <span key={voice} className="px-2 py-1 bg-orange-500/10 border border-orange-500/30 rounded text-xs text-orange-400">
                                {voice}: {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <p className="text-[10px] text-gray-700 mt-3 pt-3 border-t border-white/5">
                        💡 OpenAI gpt-4o-realtime: $40/1M input audio tokens, $80/1M output audio tokens. ~50 tokens/second of audio.
                      </p>
                    </div>

                    {/* Pricing Recommendations */}
                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/30 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-green-400 tracking-widest uppercase mb-3">💰 Pricing Insights for Voice</p>
                      <div className="space-y-2 text-xs text-gray-400">
                        <div className="flex justify-between">
                          <span>Cost per minute of voice:</span>
                          <span className="text-green-400 font-semibold">${metrics.voice_chat?.cost?.cost_per_minute_usd?.toFixed(3) || '0.000'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Suggested markup (3x):</span>
                          <span className="text-blue-400 font-semibold">${((metrics.voice_chat?.cost?.cost_per_minute_usd || 0) * 3).toFixed(3)}/min</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Suggested per-session price (5x avg):</span>
                          <span className="text-purple-400 font-semibold">${((metrics.voice_chat?.cost?.avg_cost_per_session_usd || 0) * 5).toFixed(2)}/session</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                          <span>Monthly voice package suggestion:</span>
                          <span className="text-orange-400 font-bold">${Math.max(5, Math.ceil((metrics.voice_chat?.cost?.cost_per_user_usd || 0) * 5)).toFixed(0)}/user/month</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Combined Cost Summary */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl">
                    <p className="text-[10px] font-bold text-purple-400 tracking-widest uppercase mb-3">📊 Combined Cost Summary</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-[10px] text-gray-500 mb-1">LLM (Text)</p>
                        <p className="text-lg font-bold text-blue-400">${metrics.est_total_cost?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-[10px] text-gray-500 mb-1">Voice Chat</p>
                        <p className="text-lg font-bold text-orange-400">${metrics.voice_chat?.cost?.total_cost_usd?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-[10px] text-gray-500 mb-1">Media (Images/Video)</p>
                        <p className="text-lg font-bold text-purple-400">${metrics.media_cost_total?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-[10px] text-gray-500 mb-1">TOTAL</p>
                        <p className="text-xl font-bold text-green-400">
                          ${((metrics.est_total_cost || 0) + (metrics.voice_chat?.cost?.total_cost_usd || 0) + (metrics.media_cost_total || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {activeTab === 'waitlist' && token && (
            <WaitlistTab
              token={token}
              onCountChange={(count) => setWaitlistCount(count)}
            />
          )}

          {activeTab === 'insights' && token && (
            <InsightsTab token={token} />
          )}

          {activeTab === 'users' && token && (
            <UsersTab token={token} adminRole={adminRole} />
          )}

          {activeTab === 'conversations' && token && (
            <ConversationsTab token={token} />
          )}

          {activeTab === 'blog' && token && (
            <BlogTab token={token} />
          )}

          {activeTab === 'announcements' && token && (
            <AnnouncementsTab token={token} />
          )}

          {activeTab === 'appupdates' && token && (
            <AppUpdatesTab token={token} />
          )}

          {activeTab === 'feedback' && token && (
            <FeedbackTab token={token} />
          )}

          {activeTab === 'betacodes' && token && (
            <BetaCodesTab token={token} />
          )}

          {activeTab === 'assessments' && token && (
            <AssessmentsTab token={token} />
          )}

          {activeTab === 'imports' && token && (
            <ImportsTab token={token} />
          )}

          {activeTab === 'support' && token && (
            <SupportTab token={token} />
          )}

          {activeTab === 'settings' && token && (
            <SettingsTab token={token} />
          )}
        </div>
      </div>
    </div>
  );
}
