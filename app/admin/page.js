'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, User, BarChart2, MessageSquare, Upload, Settings, Shield,
  Search, ChevronLeft, Check, X, RefreshCw, TrendingUp,
  UserCheck, Clock, FileText, ThumbsUp, AlertCircle, Loader2, Database,
  DollarSign, Zap, ListChecks, MessageCircle, Sparkles, Megaphone, Plus, Link, Edit, Trash2,
  PenSquare, Eye, EyeOff, Image, Tag, Bold, Italic, Heading, List, ListOrdered, Quote, Code, Link2, ImagePlus, Calendar,
  KeyRound, Mail, Send, AlertTriangle, Cpu, Mic, Phone, LifeBuoy, LogIn, Activity,
  CreditCard, Receipt, Ticket, Play, Pause, ArrowUp, ArrowDown
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import SubscriptionsTab from '@/components/admin/SubscriptionsTab';
import PitchAnalyticsTab from '@/components/admin/PitchAnalyticsTab';
import DiscountsTab from '@/components/admin/DiscountsTab';

const TABS = [
  { id: 'metrics', label: 'Metrics', icon: BarChart2 },
  { id: 'insights', label: 'Pricing Model', icon: DollarSign },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'discounts', label: 'Discounts', icon: Tag },
  { id: 'pitchdeck', label: 'Pitch Deck', icon: Eye },
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
  { id: 'featureflags', label: 'Feature Flags', icon: Zap },
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
  const [planChanging, setPlanChanging] = useState(null); // userId being changed
  
  // Sorting state
  const [sortField, setSortField] = useState('last_active'); // email, role, plan, cost, last_active
  const [sortDirection, setSortDirection] = useState('desc'); // asc, desc
  
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
      setUsers(d.users || []); // Store unsorted, sorting happens in render
      setTotal(d.total || 0);
      setPages(d.pages || 1);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, page, registrationDateFilter, onboardingFilter, assessmentFilter]);

  // Toggle sort direction or change field
  const handleSort = (field) => {
    console.log('[Admin Sort] Clicked field:', field, 'Current:', sortField, sortDirection);
    if (sortField === field) {
      // Toggle direction
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      console.log('[Admin Sort] Toggling direction to:', newDirection);
      setSortDirection(newDirection);
    } else {
      // New field, default to desc
      console.log('[Admin Sort] Changing field to:', field, 'desc');
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Memoized sorted users - recomputes when users, sortField, or sortDirection changes
  const sortedUsers = useMemo(() => {
    console.log('[Admin Sort] Computing sortedUsers. Field:', sortField, 'Direction:', sortDirection, 'Users count:', users.length);
    const sorted = [...users].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'email':
          aVal = (a.email || '').toLowerCase();
          bVal = (b.email || '').toLowerCase();
          break;
        case 'role':
          aVal = a.role || 'user';
          bVal = b.role || 'user';
          break;
        case 'plan':
          aVal = a.plan_id || a.identity_tier || a.plan || 'free';
          bVal = b.plan_id || b.identity_tier || b.plan || 'free';
          break;
        case 'cost':
          aVal = parseFloat(a.est_cost || a.customer_lifetime_value || 0);
          bVal = parseFloat(b.est_cost || b.customer_lifetime_value || 0);
          break;
        case 'memories':
          aVal = a.memory_breakdown?.total || 0;
          bVal = b.memory_breakdown?.total || 0;
          break;
        case 'last_active':
        default:
          aVal = new Date(a.last_active_at || 0).getTime();
          bVal = new Date(b.last_active_at || 0).getTime();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    console.log('[Admin Sort] Sorted. First user:', sorted[0]?.email, 'Last user:', sorted[sorted.length - 1]?.email);
    return sorted;
  }, [users, sortField, sortDirection]);

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

  async function changePlan(userId, planId) {
    setPlanChanging(userId);
    try {
      const res = await fetch('/api/pricing/admin/user-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, planId, reason: 'admin_dashboard_override' }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Error: ${data.error || 'Failed to change plan'}`);
      }
      load();
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setPlanChanging(null);
    }
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
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4 cursor-pointer hover:text-orange-400 transition-colors"
                  onClick={() => handleSort('email')}>
                <div className="flex items-center gap-1">
                  Email
                  {sortField === 'email' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4 cursor-pointer hover:text-orange-400 transition-colors"
                  onClick={() => handleSort('role')}>
                <div className="flex items-center gap-1">
                  Role
                  {sortField === 'role' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4 cursor-pointer hover:text-orange-400 transition-colors"
                  onClick={() => handleSort('plan')}>
                <div className="flex items-center gap-1">
                  Plan
                  {sortField === 'plan' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4 cursor-pointer hover:text-orange-400 transition-colors"
                  onClick={() => handleSort('cost')}>
                <div className="flex items-center gap-1">
                  Tokens / Cost
                  {sortField === 'cost' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">Daily Usage</th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">Accepted</th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">Onboarding</th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">Assessment</th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4 cursor-pointer hover:text-orange-400 transition-colors"
                  onClick={() => handleSort('memories')}>
                <div className="flex items-center gap-1">
                  Memories
                  {sortField === 'memories' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4 cursor-pointer hover:text-orange-400 transition-colors"
                  onClick={() => handleSort('last_active')}>
                <div className="flex items-center gap-1">
                  Last Active
                  {sortField === 'last_active' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="text-left text-[10px] font-bold text-gray-600 tracking-widest uppercase pb-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-600"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : sortedUsers.map(u => (
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
                  {(u.role === 'admin' || u.role === 'superadmin') ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-500/20 text-purple-400" title="Staff get unlimited access">
                      ∞ Staff
                    </span>
                  ) : adminRole === 'superadmin' ? (
                    <select
                      value={u.plan_id || 'free'}
                      onChange={e => changePlan(u.id, e.target.value)}
                      disabled={planChanging === u.id}
                      className={`text-[10px] font-bold rounded-full px-2 py-1 border-0 cursor-pointer transition-colors ${
                        u.plan_id === 'power' ? 'bg-yellow-500/20 text-yellow-400' :
                        u.plan_id === 'base' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-500/20 text-gray-400'
                      } ${planChanging === u.id ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      <option value="free">Free</option>
                      <option value="base">Base</option>
                      <option value="power">Power</option>
                    </select>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      u.plan_id === 'power' ? 'bg-yellow-500/20 text-yellow-400' :
                      u.plan_id === 'base' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {(u.plan_id || 'free').toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <div className="text-right">
                    <p className="text-[10px] text-green-400 font-mono">${u.est_cost?.toFixed(4) || '0.0000'}</p>
                    <p className="text-[9px] text-gray-600" title={`Input: ${(u.est_input_tokens || 0).toLocaleString()} | Output: ${(u.est_output_tokens || 0).toLocaleString()}`}>
                      {u.est_total_tokens > 1000000 ? `${(u.est_total_tokens / 1000000).toFixed(1)}M` : u.est_total_tokens > 1000 ? `${(u.est_total_tokens / 1000).toFixed(1)}K` : (u.est_total_tokens || 0)} tkns • {u.total_messages || 0} msgs
                    </p>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  {(u.plan_id === 'free' && u.role === 'user') ? (
                    <div className="text-center">
                      <p className={`text-[11px] font-bold ${(u.daily_messages || 0) >= 10 ? 'text-red-400' : (u.daily_messages || 0) >= 8 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {u.daily_messages || 0}/10
                      </p>
                      <p className="text-[9px] text-gray-600">today</p>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-600 text-center block">—</span>
                  )}
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
                  {u.memory_breakdown?.total > 0 ? (
                    <div className="group relative">
                      <div className="flex items-center gap-1 cursor-help">
                        <span className="text-white text-xs font-medium">{u.memory_breakdown.total}</span>
                        <Database className="w-3 h-3 text-gray-500" />
                      </div>
                      {/* Hover tooltip with breakdown */}
                      <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-[#1a1a1a] border border-white/20 rounded-lg p-2 shadow-xl min-w-[160px]">
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1.5">Memory Categories</p>
                        <div className="space-y-1">
                          {u.memory_breakdown.health > 0 && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] text-red-400">❤️ Health</span>
                              <span className="text-[10px] text-white font-medium">{u.memory_breakdown.health}</span>
                            </div>
                          )}
                          {u.memory_breakdown.work > 0 && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] text-blue-400">💼 Work</span>
                              <span className="text-[10px] text-white font-medium">{u.memory_breakdown.work}</span>
                            </div>
                          )}
                          {u.memory_breakdown.preferences > 0 && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] text-purple-400">⚙️ Preferences</span>
                              <span className="text-[10px] text-white font-medium">{u.memory_breakdown.preferences}</span>
                            </div>
                          )}
                          {u.memory_breakdown.relationships > 0 && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] text-pink-400">👥 Relationships</span>
                              <span className="text-[10px] text-white font-medium">{u.memory_breakdown.relationships}</span>
                            </div>
                          )}
                          {u.memory_breakdown.other > 0 && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] text-gray-400">📝 Other</span>
                              <span className="text-[10px] text-white font-medium">{u.memory_breakdown.other}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
        title: form.title,
        content: form.content,
        excerpt: form.excerpt,
        featured_image: form.featured_image || '',
        category: form.category,
        tags: typeof form.tags === 'string' 
          ? form.tags.split(',').map(t => t.trim()).filter(Boolean) 
          : (form.tags || []),
        author: form.author,
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
                <label className="text-gray-500 text-xs uppercase tracking-wider mb-1 block">Featured Image</label>
                
                {/* Image Prompt Field (auto-generated from content, editable) */}
                <div className="mb-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-gray-600 text-xs">Image prompt</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!form.title && !form.content) { alert('Write some content first'); return; }
                        setForm(f => ({ ...f, _promptGenerating: true }));
                        try {
                          const res = await fetch('/api/admin/blog/auto-generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ title: form.title, content: form.content, type: 'image_prompt' }),
                          });
                          const data = await res.json();
                          if (data.success && data.image_prompt) {
                            setForm(f => ({ ...f, _imagePrompt: data.image_prompt, _promptGenerating: false }));
                          } else {
                            setForm(f => ({ ...f, _promptGenerating: false }));
                          }
                        } catch { setForm(f => ({ ...f, _promptGenerating: false })); }
                      }}
                      disabled={form._promptGenerating}
                      className="text-purple-400 hover:text-purple-300 text-xs underline disabled:opacity-50"
                    >
                      {form._promptGenerating ? 'analyzing...' : 'auto-generate from content'}
                    </button>
                  </div>
                  <textarea
                    placeholder="Describe the featured image... (click 'auto-generate' to create from your content)"
                    value={form._imagePrompt || ''}
                    onChange={e => setForm(f => ({ ...f, _imagePrompt: e.target.value }))}
                    rows={2}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-purple-500/50 outline-none resize-none"
                  />
                </div>

                {/* Image Action Buttons */}
                <div className="flex gap-2 mb-2">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setForm(f => ({ ...f, _imageUploading: true, _imageError: '' }));
                        try {
                          const fd = new FormData();
                          fd.append('image', file);
                          const res = await fetch('/api/admin/blog/upload-image', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: fd,
                          });
                          const data = await res.json();
                          if (data.success) {
                            setForm(f => ({ ...f, featured_image: data.url, _imageUploading: false }));
                          } else {
                            setForm(f => ({ ...f, _imageError: data.error || 'Upload failed', _imageUploading: false }));
                          }
                        } catch (err) {
                          setForm(f => ({ ...f, _imageError: err.message, _imageUploading: false }));
                        }
                      }}
                    />
                    <div className="flex items-center justify-center gap-2 px-3 py-2 bg-black border border-white/10 rounded-lg text-sm text-gray-300 hover:border-orange-500/50 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      Upload
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      let prompt = form._imagePrompt;
                      if (!prompt) {
                        // Auto-generate prompt from content first
                        if (form.title || form.content) {
                          setForm(f => ({ ...f, _imageGenerating: true, _imageError: '' }));
                          try {
                            const autoRes = await fetch('/api/admin/blog/auto-generate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                              body: JSON.stringify({ title: form.title, content: form.content, type: 'image_prompt' }),
                            });
                            const autoData = await autoRes.json();
                            if (autoData.success && autoData.image_prompt) {
                              prompt = autoData.image_prompt;
                              setForm(f => ({ ...f, _imagePrompt: prompt }));
                            }
                          } catch {}
                        }
                        if (!prompt) {
                          prompt = window.prompt('Describe the image you want to generate:');
                        }
                      }
                      if (!prompt) { setForm(f => ({ ...f, _imageGenerating: false })); return; }
                      setForm(f => ({ ...f, _imageGenerating: true, _imageError: '' }));
                      try {
                        const res = await fetch('/api/admin/blog/generate-image', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ prompt }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setForm(f => ({ ...f, featured_image: data.url, _imageGenerating: false, _revisedPrompt: data.revised_prompt }));
                        } else {
                          setForm(f => ({ ...f, _imageError: data.error || 'Generation failed', _imageGenerating: false }));
                        }
                      } catch (err) {
                        setForm(f => ({ ...f, _imageError: err.message, _imageGenerating: false }));
                      }
                    }}
                    disabled={form._imageGenerating}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-black border border-white/10 rounded-lg text-sm text-gray-300 hover:border-purple-500/50 transition-colors disabled:opacity-50"
                  >
                    {form._imageGenerating ? (
                      <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating...</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> AI Generate</>
                    )}
                  </button>
                </div>

                {/* URL Input (manual) */}
                <input
                  type="text"
                  placeholder="Or paste image URL..."
                  value={form.featured_image}
                  onChange={e => setForm(f => ({ ...f, featured_image: e.target.value }))}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                />

                {/* Upload/Generate status */}
                {form._imageUploading && (
                  <p className="text-orange-400 text-xs mt-1 animate-pulse">Uploading...</p>
                )}
                {form._imageError && (
                  <p className="text-red-400 text-xs mt-1">{form._imageError}</p>
                )}
                {form._revisedPrompt && !form._imageError && (
                  <p className="text-purple-400 text-xs mt-1 italic">AI: {form._revisedPrompt}</p>
                )}

                {/* Image Preview */}
                {form.featured_image && (
                  <div className="mt-2 relative group">
                    <img src={form.featured_image} alt="Preview" className="rounded-lg w-full aspect-video object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, featured_image: '', _revisedPrompt: '' }))}
                      className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >✕</button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-500 text-xs uppercase tracking-wider">Excerpt (SEO)</label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!form.title && !form.content) { alert('Write some content first'); return; }
                      setForm(f => ({ ...f, _excerptGenerating: true }));
                      try {
                        const res = await fetch('/api/admin/blog/auto-generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ title: form.title, content: form.content, type: 'excerpt' }),
                        });
                        const data = await res.json();
                        if (data.success && data.excerpt) {
                          setForm(f => ({ ...f, excerpt: data.excerpt, _excerptGenerating: false }));
                        } else {
                          setForm(f => ({ ...f, _excerptGenerating: false }));
                        }
                      } catch { setForm(f => ({ ...f, _excerptGenerating: false })); }
                    }}
                    disabled={form._excerptGenerating}
                    className="text-purple-400 hover:text-purple-300 text-xs underline disabled:opacity-50"
                  >
                    {form._excerptGenerating ? 'generating...' : '✨ auto-generate'}
                  </button>
                </div>
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
// Grace Notification Actions component
function GraceNotifyActions({ token }) {
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [targetCohort, setTargetCohort] = useState('early');

  const dryRun = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/notify/grace-expired', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort: targetCohort, dry_run: true }),
      });
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      setResult({ error: err.message });
    }
    setSending(false);
  };

  const sendEmails = async () => {
    if (!confirm(`Send grace expiration emails to ${preview?.will_send || '?'} users? This cannot be undone.`)) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/notify/grace-expired', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort: targetCohort }),
      });
      const data = await res.json();
      setResult(data);
      setPreview(null);
    } catch (err) {
      setResult({ error: err.message });
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={targetCohort}
          onChange={e => { setTargetCohort(e.target.value); setPreview(null); setResult(null); }}
          className="bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-white"
        >
          <option value="early">Early Access (Apr 1-30) — expired May 14</option>
          <option value="og">Alpha (Mar 1-31) — expires May 31</option>
          <option value="all">All Grace Users (Both)</option>
        </select>
        <button
          onClick={dryRun}
          disabled={sending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs font-semibold rounded transition-colors"
        >
          {sending ? 'Checking...' : 'Preview (Dry Run)'}
        </button>
      </div>

      {preview && (
        <div className="bg-black/30 border border-blue-500/20 rounded-lg p-4 space-y-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-gray-500">In Cohort</p>
              <p className="text-white font-bold text-lg">{preview.total_in_cohort}</p>
            </div>
            <div>
              <p className="text-gray-500">Already Subscribed</p>
              <p className="text-green-400 font-bold text-lg">{preview.already_subscribed}</p>
            </div>
            <div>
              <p className="text-gray-500">Already Notified</p>
              <p className="text-yellow-400 font-bold text-lg">{preview.already_notified}</p>
            </div>
            <div>
              <p className="text-gray-500">Will Send</p>
              <p className="text-orange-400 font-bold text-lg">{preview.will_send}</p>
            </div>
          </div>
          {preview.users?.length > 0 && (
            <div className="mt-3">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Recipients:</p>
              <div className="flex flex-wrap gap-1">
                {preview.users.map((u, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 bg-white/5 rounded text-gray-300">{u.email}</span>
                ))}
              </div>
            </div>
          )}
          {preview.will_send > 0 && (
            <button
              onClick={sendEmails}
              disabled={sending}
              className="mt-3 px-6 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 text-white text-xs font-bold rounded transition-colors"
            >
              {sending ? 'Sending...' : `Send ${preview.will_send} Emails Now`}
            </button>
          )}
          {preview.will_send === 0 && (
            <p className="text-green-400 text-xs mt-2">✓ All eligible users have already been notified or subscribed.</p>
          )}
        </div>
      )}

      {result && !result.error && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-xs">
          <p className="text-green-400 font-bold">✓ Batch Complete</p>
          <p className="text-gray-300 mt-1">Sent: {result.sent} | Failed: {result.failed}</p>
          {result.errors?.length > 0 && (
            <div className="mt-2 text-red-400">
              {result.errors.map((e, i) => <p key={i}>{e.email}: {e.error}</p>)}
            </div>
          )}
        </div>
      )}

      {result?.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
          Error: {result.error}
        </div>
      )}
    </div>
  );
}

function BackfillSubscriptionsButton({ token }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  
  const runBackfill = async () => {
    if (!confirm('This will create Free tier subscription records for all users who are missing one. Continue?')) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/backfill/subscriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    }
    setRunning(false);
  };
  
  return (
    <div className="space-y-3">
      <button
        onClick={runBackfill}
        disabled={running}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs font-semibold rounded transition-colors"
      >
        {running ? 'Running...' : 'Run Backfill'}
      </button>
      {result && (
        <div className={`text-xs p-3 rounded ${result.error ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-green-500/10 border border-green-500/30 text-green-400'}`}>
          {result.error ? (
            <p>Error: {result.error}</p>
          ) : (
            <div className="space-y-1">
              <p className="font-semibold">{result.message}</p>
              <p>Total users: {result.total_users}</p>
              <p>Had subscription: {result.existing_subs}</p>
              <p>Backfilled: {result.backfilled}</p>
              <p className="font-bold text-white">Total after backfill: {result.total_after_backfill}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function InsightsTab({ token }) {
  const router = useRouter();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subTab, setSubTab] = useState('overview');
  const [excludeInternal, setExcludeInternal] = useState(true);

  // Hypothetical calculator state
  const [hypo, setHypo] = useState({
    totalUsers: 100,
    conversionRate: 30,
    basePrice: 19,
    addOnARPU: 5,
    videoARPU: 10,
    cogsPerUser: 11.25,
    fixedCosts: 25,
    annualDiscount: 20,
  });
  const updateHypo = (key, val) => setHypo(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));
  
  // Pricing Model v2 data from Google Sheets (April 2026)
  const PRICING_V2 = {
    costBasis: {
      providers: [
        { name: 'Perplexity (sonar-pro)', cost: 17.42, period: 'Last 30 days', notes: '468 requests, ~4M input tokens' },
        { name: 'OpenAI (Responses + Chat)', cost: 107.54, period: 'Mar 4 – Apr 3', notes: '8,282 requests, 46.3M tokens' },
        { name: 'Anthropic (Claude)', cost: 20.78, period: 'Mar 1 – Mar 31', notes: '$7.61 Opus + $13.17 Sonnet' },
        { name: 'Kie.ai (media gen)', cost: 324.50, period: 'Mar 9 – Apr 8', notes: '253 videos, 366 images' },
        { name: 'Hosting (infrastructure)', cost: 25.00, period: 'Flat monthly', notes: 'Fixed rate regardless of usage' },
      ],
      total: 495.24,
      categories: [
        { name: 'Chat (OpenAI + Claude + Perplexity)', cost: 145.74, pct: 29.4 },
        { name: 'Video + Image generation (Kie.ai)', cost: 324.50, pct: 65.5 },
        { name: 'Fixed infrastructure (Hosting)', cost: 25.00, pct: 5.1 },
      ],
      findings: [
        'Anthropic prompt caching NOT enabled — enabling could cut Claude cost by ~70-90%',
        'Claude April trending 6x March — investigate before it compounds',
        'Video generation is 60%+ of COGS — pricing must monetize video or it bleeds money',
        'Dashboard was over-estimating by ~1.8x — per-user attribution was fabricated',
      ],
    },
    assumptions: {
      basePrice: 19,
      targetMargin: 0.80,
      annualDiscount: 0.20,
      freeImageAllowance: 20,
      freeVideoLifetime: 1,
      hosting: 25,
      segments: [
        { name: 'Free (never converted)', count: 40, pct: 47.6, behavior: 'Inactive' },
        { name: 'Light (base only)', count: 33, pct: 39.3, behavior: '1-20 msgs' },
        { name: 'Moderate', count: 8, pct: 9.5, behavior: '21-100 msgs' },
        { name: 'Heavy', count: 2, pct: 2.4, behavior: '101-500 msgs' },
        { name: 'Power', count: 1, pct: 1.2, behavior: '500+ msgs' },
      ],
      totalUsers: 84,
      activePayingUsers: 44,
    },
    addOns: [
      { name: 'Premium Chat Models', unit: 'msg', cost: 0.03, price: 0.15, margin: 0.80, example: 'GPT-4o, Claude Opus/Sonnet w/ long memory' },
      { name: 'Image Generation (basic)', unit: 'image', cost: 0.04, price: 0.20, margin: 0.80, example: 'nano-banana, seedream basic' },
      { name: 'Image Generation (premium)', unit: 'image', cost: 0.12, price: 0.60, margin: 0.80, example: 'nano-banana-pro, seedream-v4-edit, imagen4-ultra' },
      { name: 'Voice Chat (live)', unit: 'minute', cost: 0.08, price: 0.40, margin: 0.80, example: 'OpenAI Realtime API, ElevenLabs' },
      { name: 'Advanced File Analysis', unit: 'file', cost: 0.03, price: 0.15, margin: 0.80, example: 'PDFs >10 pages, Excel, complex extraction' },
      { name: 'API / Integrations', unit: 'call', cost: 0.002, price: 0.01, margin: 0.80, example: 'Webhook triggers, 3rd-party integrations' },
    ],
    videoCredits: {
      costPerCredit: 0.02,
      models: [
        { name: 'Grok Imagine (i2v)', cost: 0.18, credits: 45, userPrice: 0.90, margin: 0.80 },
        { name: 'ByteDance Seedance', cost: 0.28, credits: 70, userPrice: 1.40, margin: 0.80 },
        { name: 'Kling 3.0 video', cost: 0.76, credits: 190, userPrice: 3.80, margin: 0.80 },
        { name: 'Wan 2-6 image-to-video', cost: 1.05, credits: 263, userPrice: 5.26, margin: 0.80 },
        { name: 'Veo3', cost: 2.10, credits: 525, userPrice: 10.50, margin: 0.80 },
      ],
      packs: [
        { name: 'Spark', credits: 30, price: 2.99, cogs: 0.60, margin: 0.80 },
        { name: 'Creator', credits: 150, price: 14.99, cogs: 3.00, margin: 0.80 },
        { name: 'Studio', credits: 500, price: 49.99, cogs: 10.00, margin: 0.80 },
        { name: 'Pro', credits: 1500, price: 149.99, cogs: 30.00, margin: 0.80 },
      ],
    },
    revenue: {
      segments: [
        { name: 'Light (base only)', users: 33, baseMRR: 627, premiumChat: 0, imageGen: 0, videoCredits: 0, arpu: 19, segmentMRR: 627 },
        { name: 'Moderate', users: 8, baseMRR: 160.08, premiumChat: 3, imageGen: 0, videoCredits: 0, arpu: 23.01, segmentMRR: 184.08 },
        { name: 'Heavy', users: 2, baseMRR: 40.02, premiumChat: 15, imageGen: 1, videoCredits: 15, arpu: 51.01, segmentMRR: 102.02 },
        { name: 'Power', users: 1, baseMRR: 19, premiumChat: 60, imageGen: 12, videoCredits: 50, arpu: 141, segmentMRR: 141 },
      ],
      totalMRR: 1088.44,
      arr: 13061.28,
      arrDiscounted: 10449.02,
    },
    pnl: {
      revenue: 1088.44,
      cogs: [
        { name: 'Chat APIs (OpenAI + Claude + Perplexity)', amount: 145.74, pctRev: 13.4 },
        { name: 'Media gen (Kie.ai)', amount: 324.50, pctRev: 29.8 },
        { name: 'Hosting (fixed)', amount: 25.00, pctRev: 2.3 },
        { name: 'Free tier creative allowance', amount: 3.20, pctRev: 0.3 },
        { name: 'Paid base image allowance', amount: 10.56, pctRev: 1.0 },
        { name: 'Paid monthly video allowance', amount: 16.72, pctRev: 1.5 },
        { name: 'Free video activation (amortized)', amount: 7.60, pctRev: 0.7 },
      ],
      totalCOGS: 533.32,
      grossProfit: 555.12,
      grossMargin: 0.51,
    },
    tiers: [
      {
        name: 'FREE', price: 0, color: 'gray', emoji: '🆓',
        description: 'Get started with AI that knows you.',
        features: {
          'Standard chat models': '50 msgs/day',
          'Premium chat models': '---',
          'Memory & SoulPrint': 'Full (persona + memory)',
          'Assessment': 'Included',
          'Image generation': '10/mo (watermarked, 5/hr limit)',
          'Image models': 'nano-banana, seedream, qwen-edit',
          'Video generation': 'None',
          'PDF generation': '5/mo',
          'Voice chat': '---',
          'File analysis': 'Basic (10 pages max)',
          'Conversation search': '---',
          'Platforms': 'Web + Telegram',
          'Support': 'Ace AI Agent 24/7 + Email',
        },
        bestFor: 'Trial & casual users',
        billing: 'Free forever',
        cogs: 0.156,
      },
      {
        name: 'BASE', price: 19, color: 'blue', emoji: '⭐',
        description: 'For daily users who want premium AI and clean media.',
        features: {
          'Standard chat models': 'Unlimited',
          'Premium chat models': '50 msgs/mo included ($0.15/msg overage)',
          'Memory & SoulPrint': 'Full (persona + memory)',
          'Assessment': 'Included',
          'Image generation': '50/mo (no watermark)',
          'Image models': 'All standard + pro, seedream-v4-edit, imagen4-ultra',
          'Video generation': '1/mo (5s, 720p, watermarked) + media credit packs',
          'PDF generation': '25/mo',
          'Voice chat': '30 min/mo ($0.40/min overage)',
          'File analysis': 'Advanced (unlimited pages)',
          'Conversation search': 'Included',
          'Platforms': 'Web + Telegram',
          'Support': 'Ace AI Agent 24/7 + Email',
        },
        bestFor: 'Typical paying customer',
        billing: '$19/mo or $182.40/yr (20% off)',
        cogs: 3.86,
        grossMargin: 0.807,
      },
      {
        name: 'POWER', price: 99, color: 'orange', emoji: '🚀',
        description: 'Unlimited everything. Predictable flat rate.',
        features: {
          'Standard chat models': 'Unlimited',
          'Premium chat models': 'Unlimited',
          'Memory & SoulPrint': 'Full (persona + memory)',
          'Assessment': 'Included',
          'Image generation': 'Unlimited (all models, no watermark)',
          'Image models': 'All models',
          'Video generation': 'Unlimited (all durations, all resolutions, no watermark)',
          'PDF generation': 'Unlimited',
          'Voice chat': 'Unlimited',
          'File analysis': 'Advanced (unlimited)',
          'Conversation search': 'Included',
          'Platforms': 'Web + Telegram',
          'Support': 'Ace AI Agent 24/7 + Priority Email',
        },
        bestFor: 'Power users / creators',
        billing: '$99/mo or $950.40/yr (20% off)',
        cogs: 15.18,
        grossMargin: 0.847,
      },
    ],
    growthScenarios: [
      { label: 'Current (84)', users: 84, paying: 27, mrr: 745.27, arr: 8943.24, cogs: 134.04, grossProfit: 611.23, grossMargin: 0.820 },
      { label: '200 Users', users: 200, paying: 87, mrr: 2987.87, arr: 35854.44, cogs: 472.04, grossProfit: 2515.83, grossMargin: 0.842 },
      { label: '500 Users', users: 500, paying: 269, mrr: 10279.69, arr: 123356.28, cogs: 1617.28, grossProfit: 8662.41, grossMargin: 0.843 },
      { label: '1,000 Users', users: 1000, paying: 600, mrr: 24341, arr: 292092, cogs: 3862.60, grossProfit: 20478.40, grossMargin: 0.841 },
      { label: '2,000 Users', users: 2000, paying: 1340, mrr: 56673.40, arr: 680080.80, cogs: 9044.40, grossProfit: 47629, grossMargin: 0.840 },
    ],
    conversionTriggers: [
      { condition: 'Messages sent', threshold: '50+ messages', weight: 'High' },
      { condition: 'Memory items stored', threshold: '5+ memories', weight: 'High' },
      { condition: 'Days active', threshold: '14 days (3 msgs/wk)', weight: 'Medium' },
      { condition: 'Assessment completed', threshold: '100% complete', weight: 'High' },
      { condition: 'Manual override', threshold: 'User requests early', weight: 'Low' },
      { condition: 'Hard cap fallback', threshold: '30 days OR 100 msgs', weight: '---' },
    ],
    conversionFunnel: [
      { segment: 'Inactive', freeUsers: 40, conversionPct: 0, converted: 0 },
      { segment: 'Light users', freeUsers: 33, conversionPct: 50, converted: 16.5 },
      { segment: 'Moderate users', freeUsers: 8, conversionPct: 90, converted: 7.2 },
      { segment: 'Heavy users', freeUsers: 2, conversionPct: 100, converted: 2 },
      { segment: 'Power users', freeUsers: 1, conversionPct: 100, converted: 1 },
    ],
  };

  useEffect(() => {
    fetch('/api/admin/insights', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setInsights(data);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
      Error loading data: {error}
    </div>
  );

  const PM = PRICING_V2;

  const SUB_TABS = [
    { id: 'overview', label: 'P&L Overview' },
    { id: 'calculator', label: '🧮 Calculator' },
    { id: 'liveusage', label: 'Live Usage' },
    { id: 'costs', label: 'Cost Basis' },
    { id: 'tiers', label: 'Pricing Tiers' },
    { id: 'addons', label: 'Add-Ons & Credits' },
    { id: 'revenue', label: 'Revenue Model' },
    { id: 'growth', label: 'Growth & Conversion' },
  ];

  return (
    <div className="space-y-5">
      {/* Header + Sub-tab Nav */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-orange-400" />
              Pricing Model v2
            </h2>
            <p className="text-gray-500 text-xs mt-1">Based on real invoice data | 80% true margin target | April 2026</p>
          </div>
          {insights?.generated_at && (
            <div className="text-[10px] text-gray-600 bg-white/5 px-2 py-1 rounded">
              Live data: {new Date(insights.generated_at).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 overflow-x-auto">
          {SUB_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                subTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ P&L OVERVIEW ═══ */}
      {subTab === 'overview' && (() => {
        // Compute live metrics from insights when available
        const liveUsers = insights?.user_segments;
        const liveExternal = insights?.user_segments_external;
        const liveCosts = insights?.external_costs;
        const actualTotalUsers = liveExternal?.total_external ?? PM.assumptions.totalUsers;
        const actualLLMCost = liveCosts?.total_llm_cost ?? 0;
        const actualMediaCost = liveCosts?.total_media_cost ?? 0;
        const actualTotalPlatformCost = actualLLMCost + actualMediaCost + PM.costBasis.providers[4].cost;
        const actualAvgCostPerUser = liveCosts?.avg_cost_per_user ?? 0;

        // Build actual segment data from live API
        const actualSegments = liveExternal ? [
          { name: 'Free (inactive)', count: liveExternal.inactive?.count ?? 0, pct: liveExternal.inactive?.percentage ?? 0, behavior: 'Inactive' },
          { name: 'Light (base only)', count: liveExternal.light?.count ?? 0, pct: liveExternal.light?.percentage ?? 0, behavior: '1-20 msgs' },
          { name: 'Moderate', count: liveExternal.moderate?.count ?? 0, pct: liveExternal.moderate?.percentage ?? 0, behavior: '21-100 msgs' },
          { name: 'Heavy', count: liveExternal.heavy?.count ?? 0, pct: liveExternal.heavy?.percentage ?? 0, behavior: '101-500 msgs' },
          { name: 'Power', count: liveExternal.power?.count ?? 0, pct: liveExternal.power?.percentage ?? 0, behavior: '500+ msgs' },
        ] : PM.assumptions.segments;
        const actualActiveUsers = liveExternal ? (actualSegments[1].count + actualSegments[2].count + actualSegments[3].count + actualSegments[4].count) : 0;

        return (
        <div className="space-y-5">
          {/* Actual vs Modeled Banner */}
          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/5 border border-cyan-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-cyan-400 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Actual Production Metrics (Pre-Revenue)
              </h3>
              {insights?.generated_at && (
                <span className="text-[10px] text-gray-500 bg-black/30 px-2 py-1 rounded">Live: {new Date(insights.generated_at).toLocaleString()}</span>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
              <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                <p className="text-gray-500 text-[10px] uppercase">Total Users</p>
                <p className="text-white text-xl font-bold">{actualTotalUsers}</p>
                <p className="text-gray-600 text-[10px]">all free / beta</p>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                <p className="text-gray-500 text-[10px] uppercase">Paying Customers</p>
                <p className="text-red-400 text-xl font-bold">0</p>
                <p className="text-gray-600 text-[10px]">pre-revenue stage</p>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                <p className="text-gray-500 text-[10px] uppercase">Actual Revenue</p>
                <p className="text-red-400 text-xl font-bold">$0.00</p>
                <p className="text-gray-600 text-[10px]">MRR today</p>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                <p className="text-gray-500 text-[10px] uppercase">Actual COGS Burn</p>
                <p className="text-red-400 text-xl font-bold">${actualTotalPlatformCost.toFixed(2)}</p>
                <p className="text-gray-600 text-[10px]">invoiced: ${PM.costBasis.total.toFixed(2)}</p>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                <p className="text-gray-500 text-[10px] uppercase">Avg Cost / User</p>
                <p className="text-orange-400 text-xl font-bold">${actualAvgCostPerUser.toFixed(2)}</p>
                <p className="text-gray-600 text-[10px]">burn rate per user</p>
              </div>
            </div>
          </div>

          {/* Hero KPI Cards — PROJECTED (from pricing model) */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-4">
            <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-yellow-400" />
              Projected (Pricing Model v2 — when monetized)
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-gradient-to-br from-green-500/15 to-green-500/5 border border-green-500/30 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Projected MRR</p>
                <p className="text-2xl font-bold text-green-400">${PM.revenue.totalMRR.toLocaleString()}</p>
                <p className="text-gray-600 text-[10px]">{PM.assumptions.activePayingUsers} paying users</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-500/30 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">ARR</p>
                <p className="text-2xl font-bold text-blue-400">${PM.revenue.arr.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-red-500/15 to-red-500/5 border border-red-500/30 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Total COGS</p>
                <p className="text-2xl font-bold text-red-400">${PM.pnl.totalCOGS.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Gross Profit</p>
                <p className="text-2xl font-bold text-emerald-400">${PM.pnl.grossProfit.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/15 to-purple-500/5 border border-purple-500/30 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Gross Margin</p>
                <p className="text-2xl font-bold text-purple-400">{(PM.pnl.grossMargin * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* P&L Waterfall */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-orange-400" />
              Monthly P&L (Steady State)
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-green-400 text-sm font-bold">REVENUE</span>
                <span className="text-green-400 text-sm font-bold">${PM.pnl.revenue.toLocaleString()}</span>
              </div>
              <div className="pl-4 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Total MRR (0 paying users today — projected: {PM.assumptions.activePayingUsers} @ ${PM.assumptions.basePrice}/mo)</span>
                  <span className="text-white font-medium">${PM.revenue.totalMRR.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10 mt-3">
                <span className="text-red-400 text-sm font-bold">COGS</span>
                <span className="text-red-400 text-sm font-bold">-${PM.pnl.totalCOGS.toFixed(2)}</span>
              </div>
              <div className="pl-4 space-y-1">
                {PM.pnl.cogs.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-400">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-600 text-[10px]">{item.pctRev}%</span>
                      <span className="text-red-300">-${item.amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between py-3 border-t-2 border-green-500/30 mt-3 bg-green-500/5 rounded-lg px-3">
                <span className="text-emerald-400 text-sm font-bold">GROSS PROFIT</span>
                <span className="text-emerald-400 text-lg font-bold">${PM.pnl.grossProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* User Segments - ACTUAL data from production */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              User Segments — Actual ({actualTotalUsers} external users, all free/beta)
              {liveExternal && <span className="ml-2 text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-normal">LIVE</span>}
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {actualSegments.map((seg, i) => {
                const borderCols = ['border-red-500/30', 'border-gray-500/30', 'border-blue-500/30', 'border-green-500/30', 'border-orange-500/30'];
                const bgCols = ['bg-red-500/10', 'bg-gray-500/10', 'bg-blue-500/10', 'bg-green-500/10', 'bg-orange-500/10'];
                return (
                  <div key={i} className={`p-3 rounded-lg border ${borderCols[i]} ${bgCols[i]}`}>
                    <p className="text-white text-lg font-bold">{seg.count}</p>
                    <p className="text-gray-400 text-xs">{seg.name.split('(')[0].trim()}</p>
                    <p className="text-gray-600 text-[10px]">{seg.pct}% | {seg.behavior}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 h-4 rounded-full overflow-hidden flex">
              {actualSegments.map((seg, i) => {
                const bgColors = ['bg-red-500/50', 'bg-gray-500/50', 'bg-blue-500/50', 'bg-green-500/50', 'bg-orange-500/50'];
                return <div key={i} style={{width: `${Math.max(seg.pct, 1)}%`}} className={bgColors[i]} title={seg.name} />;
              })}
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
              <span>Active Users (actual): <span className="text-white font-bold">{actualActiveUsers}</span> <span className="text-red-400 text-[9px]">(0 paying)</span></span>
              <span>Base Price: <span className="text-green-400 font-bold">${PM.assumptions.basePrice}/mo</span></span>
              <span>Target Margin: <span className="text-blue-400 font-bold">{(PM.assumptions.targetMargin * 100)}%</span></span>
            </div>
          </div>

          {/* Key Changes from v1 */}
          <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/30 rounded-xl p-4">
            <h3 className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Key Changes from v1
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {[
                'Real COGS basis from actual provider invoices, not dashboard estimates',
                '80% true margin on add-ons (price = cost / 0.20)',
                'Hosting added as $25/mo fixed cost — was missing from v1',
                'Free Creative Allowance: 10 watermarked images/mo for activation',
                'Free video REMOVED (Sora shutting down April 26, 2026)',
                'Video credits split into its own wallet — per-video cost varies 35x',
                'Chat cap REMOVED — real chat COGS per user is ~$3/mo',
                'Internal users excluded from customer projections',
                'Revenue Model is formula-driven end-to-end',
              ].map((change, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-orange-400 mt-0.5 font-bold">{i + 1}.</span>
                  <span className="text-gray-300">{change}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ DOGFOOD BURN (INTERNAL TEAM) ═══ */}
          <div className="bg-gradient-to-r from-red-500/5 to-amber-500/5 border border-red-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-red-400 text-sm font-bold flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Dogfood Burn (Internal Team)
                {insights?.dogfood_burn && <span className="ml-2 text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-normal">LIVE</span>}
              </h3>
              <span className="text-red-400 text-2xl font-bold">${insights?.dogfood_burn?.total_cost?.toFixed(2) || '0.00'}</span>
            </div>
            
            {/* Top-line Dogfood KPI Cards */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
              {[
                { label: 'LLM Cost', value: `$${insights?.dogfood_burn?.llm_cost?.toFixed(2) || '0.00'}`, color: 'text-blue-400', bg: 'border-blue-500/20' },
                { label: 'Media Cost', value: `$${insights?.dogfood_burn?.media_cost?.toFixed(2) || '0.00'}`, color: 'text-purple-400', bg: 'border-purple-500/20' },
                { label: 'Voice Cost', value: `$${insights?.dogfood_burn?.voice_cost?.toFixed(2) || '0.00'}`, color: 'text-orange-400', bg: 'border-orange-500/20' },
                { label: 'Messages', value: (insights?.dogfood_burn?.messages || 0).toLocaleString(), color: 'text-white', bg: 'border-white/10' },
                { label: 'Images Gen', value: insights?.dogfood_burn?.media_generated || 0, color: 'text-pink-400', bg: 'border-pink-500/20' },
                { label: 'Videos Gen', value: insights?.dogfood_burn?.videos_generated || 0, color: 'text-cyan-400', bg: 'border-cyan-500/20' },
              ].map((item, i) => (
                <div key={i} className={`bg-black/30 border ${item.bg} rounded-lg p-3 text-center`}>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide">{item.label}</p>
                  <p className={`${item.color} text-lg font-bold mt-1`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Internal users count */}
            {insights?.internal_users && (
              <div className="bg-black/20 border border-white/5 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-400">Internal Team Members</span>
                  <span className="text-white font-bold">{insights.internal_users.count}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {insights.internal_users.emails?.map((email, idx) => (
                    <span key={idx} className="text-[10px] bg-red-500/10 text-red-300 px-2 py-0.5 rounded border border-red-500/20">{email}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Per-user breakdown table */}
            {insights?.dogfood_burn?.by_user?.length > 0 && (
              <div className="bg-black/20 border border-white/5 rounded-lg p-3">
                <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-2">Burn by Team Member</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/10">
                      <th className="text-left py-1.5 px-2">Team Member</th>
                      <th className="text-right py-1.5 px-2">Messages</th>
                      <th className="text-right py-1.5 px-2">LLM $</th>
                      <th className="text-right py-1.5 px-2">Media $</th>
                      <th className="text-right py-1.5 px-2">Media #</th>
                      <th className="text-right py-1.5 px-2">Videos</th>
                      <th className="text-right py-1.5 px-2 text-red-400">Total $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.dogfood_burn.by_user.map((u, idx) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="py-1.5 px-2 text-white">{u.email}</td>
                        <td className="py-1.5 px-2 text-right text-gray-400">{(u.messages || 0).toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right text-blue-400">${u.llm_cost?.toFixed(2) || '0.00'}</td>
                        <td className="py-1.5 px-2 text-right text-purple-400">${u.media_cost?.toFixed(2) || '0.00'}</td>
                        <td className="py-1.5 px-2 text-right text-gray-400">{u.media_count || u.media || 0}</td>
                        <td className="py-1.5 px-2 text-right text-gray-400">{u.video_count || 0}</td>
                        <td className="py-1.5 px-2 text-right text-red-400 font-bold">${u.total_cost?.toFixed(2) || '0.00'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-red-500/30">
                      <td className="py-2 px-2 text-red-400 font-bold">TOTAL BURN</td>
                      <td className="py-2 px-2 text-right text-white font-bold">{(insights.dogfood_burn.messages || 0).toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-blue-400 font-bold">${insights.dogfood_burn.llm_cost?.toFixed(2) || '0.00'}</td>
                      <td className="py-2 px-2 text-right text-purple-400 font-bold">${insights.dogfood_burn.media_cost?.toFixed(2) || '0.00'}</td>
                      <td className="py-2 px-2 text-right text-white font-bold">{insights.dogfood_burn.media_generated || 0}</td>
                      <td className="py-2 px-2 text-right text-white font-bold">{insights.dogfood_burn.videos_generated || 0}</td>
                      <td className="py-2 px-2 text-right text-red-400 text-lg font-bold">${insights.dogfood_burn.total_cost?.toFixed(2) || '0.00'}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[10px] text-gray-600 mt-2 pt-2 border-t border-white/5">
                  ⚠️ Internal usage is excluded from customer ARPU/MRR calculations. This burn is pure product development cost.
                </p>
              </div>
            )}
          </div>
        </div>
      );
      })()}

      {/* ═══ LIVE USAGE (ACTUAL PRODUCTION METRICS) ═══ */}
      {subTab === 'liveusage' && (
        <div className="space-y-5">
          {/* Weekly Engagement Trends */}
          {insights?.weekly_trends?.length > 0 && (
            <div className="bg-[#111] border border-white/8 rounded-xl p-5">
              <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Weekly Engagement (Last 4 Weeks)
                <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-normal">LIVE</span>
              </h3>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {insights.weekly_trends.map((week, i) => (
                  <div key={i} className={`border rounded-xl p-4 ${i === 3 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/3 border-white/10'}`}>
                    <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-2">{week.week} <span className="text-gray-600">({week.start})</span></p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Messages</span>
                        <span className="text-white font-bold text-sm">{week.messages.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Active Users</span>
                        <span className="text-blue-400 font-bold text-sm">{week.active_users}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">New Users</span>
                        <span className="text-green-400 font-bold text-sm">{week.new_users}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Trend mini chart */}
              <div className="flex items-end gap-2 h-24">
                {insights.weekly_trends.map((week, i) => {
                  const maxMsgs = Math.max(...insights.weekly_trends.map(w => w.messages), 1);
                  const height = Math.max(5, (week.messages / maxMsgs) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end">
                      <span className="text-blue-400 text-[10px] font-bold mb-1">{week.messages}</span>
                      <div className="w-full bg-blue-500/40 rounded-t-lg" style={{ height: `${height}%` }} />
                      <span className="text-gray-600 text-[10px] mt-1">{week.week}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Model Popularity */}
          {insights?.model_popularity?.length > 0 && (
            <div className="bg-[#111] border border-white/8 rounded-xl p-5">
              <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                AI Model Usage Distribution
                <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-normal">LIVE</span>
              </h3>
              <div className="space-y-2">
                {insights.model_popularity.slice(0, 12).map((model, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-300 w-48 truncate font-mono">{model.model}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-purple-500/60 rounded-full transition-all" style={{ width: `${model.percentage}%` }} />
                    </div>
                    <span className="text-xs text-purple-400 w-20 text-right font-bold">{model.count.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-600 w-12 text-right">{model.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature Adoption Rates */}
          {insights?.feature_adoption && (
            <div className="bg-[#111] border border-white/8 rounded-xl p-5">
              <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                Feature Adoption Rates
                <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-normal">LIVE</span>
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(insights.feature_adoption).map(([feature, data]) => {
                  const names = {
                    assessment_complete: 'Assessment Complete',
                    has_imports: 'Data Imports',
                    has_media: 'Media Generation',
                    has_memories: 'Memory System',
                    has_soulprint: 'SoulPrint Generated',
                    web_search_users: 'Web Search Used',
                  };
                  const colors = data.rate > 50 ? 'text-green-400 bg-green-500/20' : data.rate > 25 ? 'text-yellow-400 bg-yellow-500/20' : 'text-orange-400 bg-orange-500/20';
                  return (
                    <div key={feature} className="bg-white/3 border border-white/10 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-xs">{names[feature] || feature}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colors}`}>{data.rate}%</span>
                      </div>
                      <p className="text-white text-lg font-bold">{data.users} <span className="text-gray-500 text-xs font-normal">users</span></p>
                      <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500/60 rounded-full" style={{ width: `${data.rate}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Media Generation Insights */}
          {insights?.media_insights && (
            <div className="bg-[#111] border border-white/8 rounded-xl p-5">
              <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                <Image className="w-4 h-4 text-pink-400" />
                Media Generation Insights
                <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-normal">LIVE</span>
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-[10px] uppercase">Users w/ Media</p>
                  <p className="text-pink-400 text-xl font-bold">{insights.media_insights.users_using_media}</p>
                  <p className="text-gray-600 text-[10px]">{insights.media_insights.media_adoption_rate}% adoption</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-[10px] uppercase">Avg / User</p>
                  <p className="text-purple-400 text-xl font-bold">{insights.media_insights.avg_media_per_user}</p>
                  <p className="text-gray-600 text-[10px]">media generated</p>
                </div>
                {insights.media_insights.by_type?.map((mt, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px] uppercase">{mt.type || 'Other'}</p>
                    <p className="text-white text-xl font-bold">{mt.count}</p>
                    <p className="text-red-400 text-[10px]">${mt.total_cost.toFixed(2)} cost</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voice Chat Metrics */}
          {insights?.voice_costs && (
            <div className="bg-[#111] border border-white/8 rounded-xl p-5">
              <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                <Mic className="w-4 h-4 text-cyan-400" />
                Voice Chat Cost Analysis
                <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-normal">LIVE</span>
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Sessions', value: insights.voice_costs.total_sessions, color: 'text-cyan-400' },
                  { label: 'Unique Users', value: insights.voice_costs.unique_users, color: 'text-blue-400' },
                  { label: 'Total Cost', value: `$${insights.voice_costs.total_cost_usd.toFixed(2)}`, color: 'text-red-400' },
                  { label: 'Cost / Minute', value: `$${insights.voice_costs.cost_per_minute.toFixed(4)}`, color: 'text-orange-400' },
                  { label: 'Cost / Session', value: `$${insights.voice_costs.cost_per_session.toFixed(4)}`, color: 'text-yellow-400' },
                  { label: 'Cost / User', value: `$${insights.voice_costs.cost_per_user.toFixed(4)}`, color: 'text-purple-400' },
                  { label: 'Avg Duration', value: `${insights.voice_costs.avg_duration_seconds}s`, color: 'text-white' },
                  { label: 'Total Duration', value: `${Math.round(insights.voice_costs.total_duration_seconds / 60)}m`, color: 'text-white' },
                ].map((item, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px] uppercase">{item.label}</p>
                    <p className={`${item.color} font-bold text-lg mt-1`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing Recommendations from live data */}
          {insights?.pricing_recommendations && (
            <div className="bg-[#111] border border-white/8 rounded-xl p-5">
              <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                Live Cost Metrics (for Pricing)
                <button
                  onClick={() => setExcludeInternal(!excludeInternal)}
                  className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                    excludeInternal ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/5 border-white/10 text-gray-500'
                  }`}
                >
                  {excludeInternal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {excludeInternal ? 'Internal Excluded' : 'Show All'}
                </button>
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Cost / Message</p>
                  <p className="text-green-400 text-lg font-bold">${insights.pricing_recommendations.cost_per_message?.toFixed(4) || '0.00'}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Avg Cost / User</p>
                  <p className="text-green-400 text-lg font-bold">${insights.pricing_recommendations.avg_cost_per_user?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Total LLM Cost</p>
                  <p className="text-blue-400 text-lg font-bold">${insights.pricing_recommendations.total_llm_cost?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Total Media Cost</p>
                  <p className="text-purple-400 text-lg font-bold">${insights.pricing_recommendations.total_media_cost?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Avg Messages / User</p>
                  <p className="text-white text-lg font-bold">{insights.pricing_recommendations.avg_messages_per_user || 0}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Median Messages</p>
                  <p className="text-white text-lg font-bold">{insights.pricing_recommendations.median_messages || 0}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Total Platform Cost</p>
                  <p className="text-red-400 text-lg font-bold">${((insights.pricing_recommendations.total_llm_cost || 0) + (insights.pricing_recommendations.total_media_cost || 0)).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Churn & Retention */}
          {insights?.churn_indicators && (
            <div className="bg-gradient-to-r from-red-500/5 to-transparent border border-red-500/20 rounded-xl p-5">
              <h3 className="text-red-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Churn & Retention Indicators
                <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-normal">LIVE</span>
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] uppercase">Inactive 30+ Days</p>
                  <p className="text-red-400 text-2xl font-bold">{insights.churn_indicators.inactive_30d}</p>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] uppercase">Churn Rate</p>
                  <p className={`text-2xl font-bold ${insights.churn_indicators.churn_rate > 30 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {insights.churn_indicators.churn_rate}%
                  </p>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] uppercase">Never Engaged</p>
                  <p className="text-orange-400 text-2xl font-bold">{insights.churn_indicators.never_engaged}</p>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] uppercase">Drop-off Rate</p>
                  <p className={`text-2xl font-bold ${insights.churn_indicators.drop_off_rate > 30 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {insights.churn_indicators.drop_off_rate}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top Power Users */}
          {insights?.top_users?.length > 0 && (
            <div className="bg-[#111] border border-white/8 rounded-xl p-5">
              <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-400" />
                Top Power Users
                <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-normal">LIVE</span>
              </h3>
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
                  {insights.top_users.slice(0, 15).map((user, idx) => (
                    <tr key={idx} className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${user.is_internal ? 'opacity-60' : ''}`}
                      onClick={() => user.user_id && router.push(`/admin/users/${user.user_id}`)}
                    >
                      <td className="py-2 px-2 text-gray-600">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <span className="text-white hover:text-orange-400 transition-colors">{user.name}</span>
                        <span className="ml-1 text-gray-600 text-[10px]">{user.email !== user.name ? user.email : ''}</span>
                        {user.is_internal && <span className="ml-2 text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">STAFF</span>}
                      </td>
                      <td className="py-2 px-2 text-right text-orange-400 font-medium">{user.messages?.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-purple-400">{user.media_generated}</td>
                      <td className="py-2 px-2 text-right text-green-400">${user.estimated_cost}</td>
                      <td className="py-2 px-2 text-right text-gray-500">{user.last_active ? new Date(user.last_active).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Revenue Potential from live data */}
          {insights?.revenue_potential && (
            <div className="bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/30 rounded-xl p-5">
              <h3 className="text-green-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Revenue Potential (from actual usage)
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-3">If free tier capped at 20 msgs/mo:</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Paying Users</span>
                      <span className="text-white font-bold">{insights.revenue_potential.if_free_tier_20_msgs.paying_users}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">@ $10/mo</span>
                      <span className="text-green-400 font-bold">${insights.revenue_potential.if_free_tier_20_msgs.at_10_per_month}/mo</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">@ $20/mo</span>
                      <span className="text-green-400 font-bold">${insights.revenue_potential.if_free_tier_20_msgs.at_20_per_month}/mo</span>
                    </div>
                  </div>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-3">If free tier capped at 50 msgs/mo:</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Paying Users</span>
                      <span className="text-white font-bold">{insights.revenue_potential.if_free_tier_50_msgs.paying_users}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">@ $10/mo</span>
                      <span className="text-green-400 font-bold">${insights.revenue_potential.if_free_tier_50_msgs.at_10_per_month}/mo</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">@ $20/mo</span>
                      <span className="text-green-400 font-bold">${insights.revenue_potential.if_free_tier_50_msgs.at_20_per_month}/mo</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <span className="text-gray-400">Enterprise Candidates (500+ msgs)</span>
                <span className="text-orange-400 font-bold">{insights.revenue_potential.enterprise_candidates} users</span>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ═══ HYPOTHETICAL CALCULATOR ═══ */}
      {subTab === 'calculator' && (() => {
        // Derived calculations from hypo state
        const hPayingUsers = Math.round(hypo.totalUsers * (hypo.conversionRate / 100));
        const hFreeUsers = hypo.totalUsers - hPayingUsers;
        const hSubRevenue = hPayingUsers * hypo.basePrice;
        const hAddOnRevenue = hPayingUsers * hypo.addOnARPU;
        const hVideoRevenue = Math.round(hPayingUsers * 0.4) * hypo.videoARPU;  // 40% buy video
        const hMRR = hSubRevenue + hAddOnRevenue + hVideoRevenue;
        const hARR = hMRR * 12;
        const hAnnualMRR = hMRR * (1 - hypo.annualDiscount / 100);
        const hVariableCOGS = hPayingUsers * hypo.cogsPerUser;
        const hFreeCOGS = hFreeUsers * 3.00;  // ~$3/mo for free users (chat only)
        const hTotalCOGS = hVariableCOGS + hFreeCOGS + hypo.fixedCosts;
        const hGrossProfit = hMRR - hTotalCOGS;
        const hGrossMargin = hMRR > 0 ? hGrossProfit / hMRR : 0;

        // Scenario presets
        const presets = [
          { label: 'Conservative', totalUsers: 50, conversionRate: 20, basePrice: 15.00, addOnARPU: 3, videoARPU: 5, cogsPerUser: 11.25, fixedCosts: 25, annualDiscount: 15 },
          { label: 'Base Case (v2)', totalUsers: 84, conversionRate: 52, basePrice: 19, addOnARPU: 4.77, videoARPU: 10, cogsPerUser: 11.25, fixedCosts: 25, annualDiscount: 20 },
          { label: 'Aggressive', totalUsers: 250, conversionRate: 35, basePrice: 25.00, addOnARPU: 8, videoARPU: 15, cogsPerUser: 9.50, fixedCosts: 50, annualDiscount: 20 },
          { label: 'Scale (1k)', totalUsers: 1000, conversionRate: 25, basePrice: 20.00, addOnARPU: 6, videoARPU: 12, cogsPerUser: 7.00, fixedCosts: 100, annualDiscount: 20 },
        ];

        const InputRow = ({ label, param, unit, min, max, step }) => (
          <div className="flex items-center gap-3">
            <label className="text-gray-400 text-xs w-40 shrink-0">{label}</label>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={hypo[param]}
              onChange={(e) => updateHypo(param, e.target.value)}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-orange-500"
              style={{ background: `linear-gradient(to right, rgb(249 115 22 / 0.6) ${((hypo[param] - min) / (max - min)) * 100}%, rgb(255 255 255 / 0.1) ${((hypo[param] - min) / (max - min)) * 100}%)` }}
            />
            <div className="flex items-center gap-1 w-28 shrink-0">
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={hypo[param]}
                onChange={(e) => updateHypo(param, e.target.value)}
                className="w-20 bg-black/50 border border-white/20 rounded-lg px-2 py-1 text-white text-xs text-right focus:border-orange-500/50 focus:outline-none"
              />
              <span className="text-gray-600 text-[10px]">{unit}</span>
            </div>
          </div>
        );

        return (
          <div className="space-y-5">
            {/* Calculator Header */}
            <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/5 border border-orange-500/30 rounded-xl p-4">
              <h3 className="text-orange-400 text-sm font-bold flex items-center gap-2">
                <Settings className="w-4 h-4" />
                What-If Scenario Calculator
              </h3>
              <p className="text-gray-400 text-xs mt-1">Adjust the sliders to model hypothetical pricing scenarios. All calculations are formula-driven from your inputs.</p>
              <p className="text-gray-500 text-[10px] mt-1">
                Current reality: <span className="text-red-400 font-bold">0 paying customers</span> • <span className="text-white font-bold">{insights?.user_segments_external?.total_external ?? '?'}</span> beta users • <span className="text-red-400 font-bold">-${PM.costBasis.total.toFixed(2)}/mo</span> burn
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2">
              {presets.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => setHypo(prev => ({ ...prev, ...preset }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-white/5 border-white/10 text-gray-400 hover:text-white"
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setHypo({
                  totalUsers: insights?.user_segments_external?.total_external ?? 10,
                  conversionRate: 30,
                  basePrice: 19,
                  addOnARPU: 5,
                  videoARPU: 10,
                  cogsPerUser: insights?.pricing_recommendations?.avg_cost_per_user ?? 11.25,
                  fixedCosts: 25,
                  annualDiscount: 20,
                })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
              >
                Use Actual Users
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Input Sliders */}
              <div className="bg-[#111] border border-white/8 rounded-xl p-5 space-y-4">
                <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Settings className="w-3 h-3 text-orange-400" />
                  Scenario Inputs
                </h4>
                <InputRow label="Total Users" param="totalUsers" unit="" min={10} max={5000} step={10} />
                <InputRow label="Conversion Rate" param="conversionRate" unit="%" min={5} max={80} step={1} />
                <InputRow label="Base Price" param="basePrice" unit="$/mo" min={5} max={100} step={0.5} />
                <InputRow label="Add-On ARPU" param="addOnARPU" unit="$/mo" min={0} max={50} step={0.5} />
                <InputRow label="Video Add-On" param="videoARPU" unit="$/mo" min={0} max={50} step={0.5} />
                <InputRow label="COGS / Paying User" param="cogsPerUser" unit="$/mo" min={1} max={50} step={0.25} />
                <InputRow label="Fixed Costs" param="fixedCosts" unit="$/mo" min={0} max={500} step={5} />
                <InputRow label="Annual Discount" param="annualDiscount" unit="%" min={0} max={50} step={1} />
                <div className="pt-3 border-t border-white/10 text-[10px] text-gray-600">
                  Assumptions: 40% of paying users buy video add-on • Free users cost ~$3/mo (chat-only COGS)
                </div>
              </div>

              {/* Live Results */}
              <div className="space-y-4">
                {/* Key Output Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-xl p-4 text-center border ${hGrossProfit >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <p className="text-gray-400 text-[10px] uppercase tracking-wide">MRR</p>
                    <p className={`text-3xl font-bold mt-1 ${hMRR > 0 ? 'text-green-400' : 'text-gray-600'}`}>${hMRR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className={`rounded-xl p-4 text-center border ${hGrossProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <p className="text-gray-400 text-[10px] uppercase tracking-wide">Gross Profit</p>
                    <p className={`text-3xl font-bold mt-1 ${hGrossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${hGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {/* P&L Breakdown */}
                <div className="bg-[#111] border border-white/8 rounded-xl p-4">
                  <h4 className="text-white text-xs font-bold mb-3">Projected P&L</h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-gray-500">Paying Users</span><span className="text-white font-bold">{hPayingUsers}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-500">Free Users</span><span className="text-gray-400">{hFreeUsers}</span></div>
                    <div className="border-t border-white/10 my-2" />
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Subscription Revenue</span><span className="text-green-400">${hSubRevenue.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Add-On Revenue</span><span className="text-green-400">${hAddOnRevenue.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Video Credits</span><span className="text-green-400">${hVideoRevenue.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs py-1 border-y border-green-500/20"><span className="text-green-400 font-bold">TOTAL MRR</span><span className="text-green-400 font-bold">${hMRR.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Paying User COGS ({hPayingUsers} × ${hypo.cogsPerUser})</span><span className="text-red-400">-${hVariableCOGS.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Free User COGS ({hFreeUsers} × $3.00)</span><span className="text-red-400">-${hFreeCOGS.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Fixed Costs</span><span className="text-red-400">-${hypo.fixedCosts.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs py-1 border-y border-red-500/20"><span className="text-red-400 font-bold">TOTAL COGS</span><span className="text-red-400 font-bold">-${hTotalCOGS.toFixed(2)}</span></div>
                    <div className={`flex justify-between text-sm py-2 rounded-lg px-2 mt-1 ${hGrossProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <span className={`font-bold ${hGrossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>GROSS PROFIT</span>
                      <span className={`font-bold ${hGrossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${hGrossProfit.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/3 border border-white/10 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px] uppercase">ARR</p>
                    <p className="text-blue-400 text-lg font-bold">${hARR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="bg-white/3 border border-white/10 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px] uppercase">Gross Margin</p>
                    <p className={`text-lg font-bold ${hGrossMargin >= 0.6 ? 'text-green-400' : hGrossMargin >= 0.3 ? 'text-yellow-400' : 'text-red-400'}`}>{(hGrossMargin * 100).toFixed(1)}%</p>
                  </div>
                  <div className="bg-white/3 border border-white/10 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-[10px] uppercase">Annual (discounted)</p>
                    <p className="text-purple-400 text-lg font-bold">${(hAnnualMRR * 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>

                {/* Break-even hint */}
                <div className={`rounded-lg p-3 text-xs ${hGrossProfit >= 0 ? 'bg-green-500/5 border border-green-500/20 text-green-400' : 'bg-red-500/5 border border-red-500/20 text-red-400'}`}>
                  {hGrossProfit >= 0 ? (
                    <p>✅ <strong>Profitable</strong> at this scenario. You need ≥{Math.ceil(hTotalCOGS / (hypo.basePrice + hypo.addOnARPU))} paying users to break even with current COGS.</p>
                  ) : (
                    <p>🚨 <strong>Unprofitable</strong> — need {Math.ceil((hTotalCOGS - hMRR) / (hypo.basePrice + hypo.addOnARPU - hypo.cogsPerUser))} more paying users OR reduce COGS by ${Math.abs(hGrossProfit).toFixed(2)}/mo to break even.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ COST BASIS ═══ */}
      {subTab === 'costs' && (
        <div className="space-y-5">
          {/* Provider Costs */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-1 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Real Monthly COGS — From Actual Invoices
            </h3>
            <p className="text-gray-500 text-[10px] mb-4">Source: billing screenshots & CSVs from all four providers</p>
            <div className="space-y-2">
              {PM.costBasis.providers.map((p, i) => {
                const pct = (p.cost / PM.costBasis.total * 100);
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className="text-xs text-gray-300 w-52 flex-shrink-0">{p.name}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-blue-500/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-blue-400 w-16 text-right font-bold">${p.cost.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-600 w-14 text-right">{pct.toFixed(1)}%</span>
                    <span className="text-[10px] text-gray-600 w-44 truncate hidden lg:block">{p.notes}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-3 border-t-2 border-orange-500/40">
                <span className="text-orange-400 text-sm font-bold">TOTAL Monthly Run Rate</span>
                <span className="text-orange-400 text-xl font-bold">${PM.costBasis.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* COGS by Category */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-4">COGS Breakdown by Category</h3>
            <div className="grid grid-cols-3 gap-3">
              {PM.costBasis.categories.map((cat, i) => {
                const colors = ['blue', 'purple', 'gray'];
                return (
                  <div key={i} className={`bg-${colors[i]}-500/10 border border-${colors[i]}-500/30 rounded-xl p-4`}>
                    <p className="text-gray-400 text-[10px] uppercase mb-2">{cat.name}</p>
                    <p className={`text-${colors[i]}-400 text-2xl font-bold`}>${cat.cost.toFixed(2)}</p>
                    <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full bg-${colors[i]}-500/60 rounded-full`} style={{ width: `${cat.pct}%` }} />
                    </div>
                    <p className="text-gray-500 text-[10px] mt-1">{cat.pct}% of total</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Findings */}
          <div className="bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/30 rounded-xl p-4">
            <h3 className="text-yellow-400 text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Key Findings
            </h3>
            <div className="space-y-2">
              {PM.costBasis.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-yellow-400 mt-0.5">&#x2022;</span>
                  <span className="text-gray-300">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Cost Data from API */}
          {insights?.pricing_recommendations && (
            <div className="bg-[#111] border border-white/8 rounded-xl p-5">
              <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Live Platform Cost Data
                {excludeInternal && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded ml-2 font-normal">External Only</span>}
              </h3>
              <button
                onClick={() => setExcludeInternal(!excludeInternal)}
                className={`mb-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  excludeInternal ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/5 border-white/10 text-gray-500'
                }`}
              >
                {excludeInternal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {excludeInternal ? 'Internal Excluded' : 'Show All Users'}
              </button>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Cost/Message</p>
                  <p className="text-green-400 font-bold">${insights.pricing_recommendations?.cost_per_message?.toFixed(4) || '0.00'}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Avg Cost/User</p>
                  <p className="text-green-400 font-bold">${insights.pricing_recommendations?.avg_cost_per_user?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Total LLM Cost</p>
                  <p className="text-blue-400 font-bold">${insights.pricing_recommendations?.total_llm_cost?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px]">Total Platform Cost</p>
                  <p className="text-white font-bold">${insights.pricing_recommendations?.total_platform_cost?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PRICING TIERS ═══ */}
      {subTab === 'tiers' && (
        <div className="space-y-5">
          {/* Tier Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PM.tiers.map((tier, i) => {
              const borderColors = ['border-gray-500/30', 'border-blue-500/30', 'border-orange-500/30'];
              const bgColors = ['from-gray-500/10', 'from-blue-500/10', 'from-orange-500/10'];
              const priceColors = ['text-gray-400', 'text-blue-400', 'text-orange-400'];
              return (
                <div key={i} className={`bg-gradient-to-br ${bgColors[i]} to-transparent border ${borderColors[i]} rounded-xl p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{tier.emoji}</span>
                      <h3 className="text-white text-lg font-bold">{tier.name}</h3>
                    </div>
                    <span className={`${priceColors[i]} text-xl font-bold`}>
                      {tier.price === 0 ? 'Free' : `$${tier.price}/mo`}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mb-4">{tier.description}</p>

                  <div className="space-y-1.5">
                    {Object.entries(tier.features).map(([feat, val]) => (
                      <div key={feat} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                        <span className="text-gray-400">{feat}</span>
                        <span className={val === '---' ? 'text-gray-700' : val.includes('Unlimited') || val === 'Included' ? 'text-green-400 font-medium' : val.includes('Metered') ? 'text-yellow-400' : 'text-white'}>
                          {val === '---' ? '—' : val}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Best for</span>
                      <span className="text-white">{tier.bestFor}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Billing</span>
                      <span className="text-white">{tier.billing}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Est. COGS/user</span>
                      <span className="text-red-400">${tier.cogs.toFixed(2)}</span>
                    </div>
                    {tier.grossMargin != null && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Gross margin</span>
                        <span className="text-green-400 font-bold">{(tier.grossMargin * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature Comparison Matrix */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5 overflow-x-auto">
            <h3 className="text-white text-sm font-bold mb-4">Feature Access Matrix</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 text-gray-500">Feature</th>
                  <th className="text-center py-2 px-2 text-gray-400">🆓 FREE</th>
                  <th className="text-center py-2 px-2 text-blue-400">⭐ BASE ($19)</th>
                  <th className="text-center py-2 px-2 text-orange-400">🚀 POWER ($99)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(PM.tiers[0].features).map((feat) => (
                  <tr key={feat} className="border-b border-white/5">
                    <td className="py-2 px-2 text-gray-300">{feat}</td>
                    {PM.tiers.map((tier, i) => {
                      const val = tier.features[feat];
                      return (
                        <td key={i} className="py-2 px-2 text-center">
                          {val === '---' ? (
                            <X className="w-3.5 h-3.5 text-gray-700 mx-auto" />
                          ) : val.includes('Unlimited') || val === 'Included' ? (
                            <span className="text-green-400">{val}</span>
                          ) : val.includes('Metered') ? (
                            <span className="text-yellow-400">{val}</span>
                          ) : (
                            <span className="text-white">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ ADD-ONS & CREDITS ═══ */}
      {subTab === 'addons' && (
        <div className="space-y-5">
          {/* Add-On Pricing */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-1 flex items-center gap-2">
              <Tag className="w-4 h-4 text-pink-400" />
              Add-On Pricing — 80% True Gross Margin
            </h3>
            <p className="text-gray-500 text-[10px] mb-4">Price = Cost / (1 - 0.80). Every add-on verified at 80% margin.</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="text-left py-2 px-2">Add-on</th>
                  <th className="text-center py-2 px-2">Unit</th>
                  <th className="text-right py-2 px-2">Real Cost</th>
                  <th className="text-right py-2 px-2">Price (80%)</th>
                  <th className="text-right py-2 px-2">Margin</th>
                  <th className="text-left py-2 px-2">Example</th>
                </tr>
              </thead>
              <tbody>
                {PM.addOns.map((a, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2.5 px-2 text-white font-medium">{a.name}</td>
                    <td className="py-2.5 px-2 text-center text-gray-400">/{a.unit}</td>
                    <td className="py-2.5 px-2 text-right text-red-400">${a.cost.toFixed(3)}</td>
                    <td className="py-2.5 px-2 text-right text-green-400 font-bold">${a.price.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-bold">{(a.margin * 100).toFixed(0)}%</span>
                    </td>
                    <td className="py-2.5 px-2 text-gray-500 text-[10px]">{a.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-600 mt-3 pt-3 border-t border-white/5">
              Note: Premium chat ($0.15/msg) is 2-3x ChatGPT Plus per-message equivalent. Differentiation is memory/personality, not raw model access.
            </p>
          </div>

          {/* Video Credit Wallet */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Video Credits Wallet — Per-Model Credit Cost
            </h3>
            <p className="text-gray-500 text-[10px] mb-4">Anchor: ${PM.videoCredits.costPerCredit}/credit | 80% margin built into packs</p>
            <table className="w-full text-xs mb-4">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="text-left py-2 px-2">Model</th>
                  <th className="text-right py-2 px-2">Real Cost</th>
                  <th className="text-right py-2 px-2"># Credits</th>
                  <th className="text-right py-2 px-2">User $</th>
                  <th className="text-right py-2 px-2">Margin</th>
                </tr>
              </thead>
              <tbody>
                {PM.videoCredits.models.map((m, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2.5 px-2 text-white">{m.name}</td>
                    <td className="py-2.5 px-2 text-right text-red-400">${m.cost.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-right text-purple-400 font-bold">{m.credits}</td>
                    <td className="py-2.5 px-2 text-right text-green-400 font-bold">${m.userPrice.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-right"><span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">{(m.margin * 100)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-red-400 mb-4">&#x26a0; SORA EXCLUDED: OpenAI shutting down Sora app 4/26/2026 and API 9/24/2026.</p>

            {/* Credit Packs */}
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-3">Credit Packs (Consumer Pricing)</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {PM.videoCredits.packs.map((pack, i) => {
                const packColors = ['from-gray-500/10 border-gray-500/30', 'from-blue-500/10 border-blue-500/30', 'from-purple-500/10 border-purple-500/30', 'from-orange-500/10 border-orange-500/30'];
                return (
                  <div key={i} className={`bg-gradient-to-br ${packColors[i]} border rounded-xl p-4 text-center`}>
                    <p className="text-white font-bold text-sm mb-1">{pack.name}</p>
                    <p className="text-green-400 text-2xl font-bold">${pack.price}</p>
                    <p className="text-gray-400 text-xs">{pack.credits} credits</p>
                    <p className="text-gray-600 text-[10px] mt-1">${(pack.price / pack.credits).toFixed(3)}/credit</p>
                    <div className="mt-2 text-[10px]">
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded">COGS: ${pack.cogs} | {(pack.margin * 100).toFixed(0)}% margin</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ REVENUE MODEL ═══ */}
      {subTab === 'revenue' && (
        <div className="space-y-5">
          {/* Revenue by Segment */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              Monthly Recurring Revenue by User Segment
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="text-left py-2 px-2">Segment</th>
                  <th className="text-right py-2 px-2"># Users</th>
                  <th className="text-right py-2 px-2">Base MRR</th>
                  <th className="text-right py-2 px-2">Premium Chat</th>
                  <th className="text-right py-2 px-2">Image Gen</th>
                  <th className="text-right py-2 px-2">Video Credits</th>
                  <th className="text-right py-2 px-2 text-green-400">ARPU</th>
                  <th className="text-right py-2 px-2 text-green-400">Segment MRR</th>
                </tr>
              </thead>
              <tbody>
                {PM.revenue.segments.map((seg, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2.5 px-2 text-white font-medium">{seg.name}</td>
                    <td className="py-2.5 px-2 text-right text-gray-400">{seg.users}</td>
                    <td className="py-2.5 px-2 text-right text-blue-400">${seg.baseMRR.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-right text-gray-400">{seg.premiumChat > 0 ? `$${seg.premiumChat}` : '—'}</td>
                    <td className="py-2.5 px-2 text-right text-gray-400">{seg.imageGen > 0 ? `$${seg.imageGen}` : '—'}</td>
                    <td className="py-2.5 px-2 text-right text-gray-400">{seg.videoCredits > 0 ? `$${seg.videoCredits}` : '—'}</td>
                    <td className="py-2.5 px-2 text-right text-green-400 font-bold">${seg.arpu.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-right text-green-400 font-bold">${seg.segmentMRR.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-green-500/40 bg-green-500/5">
                  <td className="py-3 px-2 text-green-400 font-bold">TOTALS</td>
                  <td className="py-3 px-2 text-right text-white font-bold">{PM.revenue.segments.reduce((s, r) => s + r.users, 0)}</td>
                  <td colSpan={4} className="py-3 px-2"></td>
                  <td className="py-3 px-2 text-right text-white"></td>
                  <td className="py-3 px-2 text-right text-green-400 text-lg font-bold">${PM.revenue.totalMRR.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ARR Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-500/15 to-green-500/5 border border-green-500/30 rounded-xl p-5 text-center">
              <p className="text-gray-400 text-xs mb-1">Monthly MRR</p>
              <p className="text-green-400 text-3xl font-bold">${PM.revenue.totalMRR.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-500/30 rounded-xl p-5 text-center">
              <p className="text-gray-400 text-xs mb-1">Annual Run Rate (ARR)</p>
              <p className="text-blue-400 text-3xl font-bold">${PM.revenue.arr.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/15 to-purple-500/5 border border-purple-500/30 rounded-xl p-5 text-center">
              <p className="text-gray-400 text-xs mb-1">ARR w/ 20% Annual Discount</p>
              <p className="text-purple-400 text-3xl font-bold">${PM.revenue.arrDiscounted.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-xs font-bold mb-2">How to read this</p>
            <div className="space-y-1 text-[10px] text-gray-400">
              <p>&#x2022; Image Gen column shows OVERAGE only — first 50 images/mo are bundled into base (clean, unwatermarked).</p>
              <p>&#x2022; Free segment (40 users) excluded — they get 10 watermarked images/mo + 0 videos. COGS booked on P&L.</p>
              <p>&#x2022; This model shows steady-state. Growth scenarios are on the Growth tab.</p>
            </div>
          </div>

          {/* Live data: Top Users, Model Popularity, Feature Adoption */}
          {insights?.top_users?.length > 0 && (
            <div className="bg-[#111] border border-white/8 rounded-xl p-5">
              <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-400" />
                Top Power Users (Live Data)
              </h3>
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
                  {insights.top_users.slice(0, 10).map((user, idx) => (
                    <tr key={idx} className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${user.is_internal ? 'opacity-60' : ''}`}
                      onClick={() => user.user_id && router.push(`/admin/users/${user.user_id}`)}
                    >
                      <td className="py-2 px-2 text-gray-600">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <span className="text-white hover:text-orange-400 transition-colors">{user.name}</span>
                        <span className="ml-1 text-gray-600 text-[10px]">{user.email !== user.name ? user.email : ''}</span>
                        {user.is_internal && <span className="ml-2 text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">STAFF</span>}
                      </td>
                      <td className="py-2 px-2 text-right text-orange-400 font-medium">{user.messages}</td>
                      <td className="py-2 px-2 text-right text-purple-400">{user.media_generated}</td>
                      <td className="py-2 px-2 text-right text-green-400">${user.estimated_cost}</td>
                      <td className="py-2 px-2 text-right text-gray-500">{user.last_active ? new Date(user.last_active).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ GROWTH & CONVERSION ═══ */}
      {subTab === 'growth' && (
        <div className="space-y-5">
          {/* Growth Scenarios */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Growth Scenarios — MRR at Scale
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="text-left py-2 px-2">Scenario</th>
                  <th className="text-right py-2 px-2">Total Users</th>
                  <th className="text-right py-2 px-2">Paying</th>
                  <th className="text-right py-2 px-2 text-green-400">MRR</th>
                  <th className="text-right py-2 px-2 text-blue-400">ARR</th>
                  <th className="text-right py-2 px-2 text-red-400">COGS</th>
                  <th className="text-right py-2 px-2 text-emerald-400">Gross Profit</th>
                  <th className="text-right py-2 px-2">Margin</th>
                </tr>
              </thead>
              <tbody>
                {PM.growthScenarios.map((s, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i === 0 ? 'bg-orange-500/5' : ''}`}>
                    <td className="py-2.5 px-2 text-white font-medium">{s.label} {i === 0 && <span className="text-[10px] text-orange-400 ml-1">(NOW)</span>}</td>
                    <td className="py-2.5 px-2 text-right text-gray-400">{s.users.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right text-gray-400">{s.paying.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right text-green-400 font-bold">${s.mrr.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right text-blue-400">${s.arr.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right text-red-400">${s.cogs.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right text-emerald-400 font-bold">${s.grossProfit.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">{(s.grossMargin * 100).toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Visual Growth Chart */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-4">MRR Growth Visualization</h3>
            <div className="flex items-end gap-4 h-48">
              {PM.growthScenarios.map((s, i) => {
                const maxMRR = PM.growthScenarios[PM.growthScenarios.length - 1].mrr;
                const height = Math.max(5, (s.mrr / maxMRR) * 100);
                const colors = ['bg-orange-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-emerald-500'];
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end">
                    <span className="text-green-400 text-[10px] font-bold mb-1">${(s.mrr / 1000).toFixed(1)}k</span>
                    <div className={`w-full ${colors[i]} rounded-t-lg transition-all`} style={{ height: `${height}%` }} />
                    <span className="text-gray-500 text-[10px] mt-2 text-center">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversion Triggers */}
          <div className="bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/30 rounded-xl p-5">
            <h3 className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              SoulPrint &ldquo;Ready&rdquo; Trigger — When Free Becomes Paid
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="text-left py-2 px-2">Trigger Condition</th>
                  <th className="text-left py-2 px-2">Threshold</th>
                  <th className="text-center py-2 px-2">Weight</th>
                </tr>
              </thead>
              <tbody>
                {PM.conversionTriggers.map((t, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 px-2 text-white">{t.condition}</td>
                    <td className="py-2 px-2 text-gray-300">{t.threshold}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        t.weight === 'High' ? 'bg-green-500/20 text-green-400' :
                        t.weight === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        t.weight === 'Low' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {t.weight}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Conversion Funnel */}
          <div className="bg-[#111] border border-white/8 rounded-xl p-5">
            <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Conversion Funnel — Free to Paid
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="text-left py-2 px-2">Segment</th>
                  <th className="text-right py-2 px-2">Free Users</th>
                  <th className="text-right py-2 px-2">Conversion %</th>
                  <th className="text-right py-2 px-2 text-green-400">Converted</th>
                </tr>
              </thead>
              <tbody>
                {PM.conversionFunnel.map((f, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 px-2 text-white">{f.segment}</td>
                    <td className="py-2 px-2 text-right text-gray-400">{f.freeUsers}</td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-green-500/60 rounded-full" style={{ width: `${f.conversionPct}%` }} />
                        </div>
                        <span className={f.conversionPct > 0 ? 'text-green-400' : 'text-gray-600'}>{f.conversionPct}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right text-green-400 font-bold">{f.converted}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-green-500/40">
                  <td className="py-3 px-2 text-green-400 font-bold">TOTAL</td>
                  <td className="py-3 px-2 text-right text-white font-bold">{PM.conversionFunnel.reduce((s, f) => s + f.freeUsers, 0)}</td>
                  <td className="py-3 px-2"></td>
                  <td className="py-3 px-2 text-right text-green-400 text-lg font-bold">{PM.conversionFunnel.reduce((s, f) => s + f.converted, 0).toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-gray-400 text-[10px] mb-1">Implied Paid Users</p>
                <p className="text-green-400 text-xl font-bold">{PM.conversionFunnel.reduce((s, f) => s + f.converted, 0).toFixed(1)}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-gray-400 text-[10px] mb-1">Projected MRR at This Funnel</p>
                <p className="text-blue-400 text-xl font-bold">${(PM.conversionFunnel.reduce((s, f) => s + f.converted, 0) * 24.74).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Live Churn Data */}
          {insights?.churn_indicators && (
            <div className="bg-gradient-to-r from-red-500/5 to-transparent border border-red-500/20 rounded-xl p-4">
              <h3 className="text-red-400 text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Churn & Retention (Live Data)
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] uppercase">Inactive 30+ Days</p>
                  <p className="text-red-400 text-2xl font-bold">{insights.churn_indicators.inactive_30d}</p>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] uppercase">Churn Rate</p>
                  <p className={`text-2xl font-bold ${insights.churn_indicators.churn_rate > 30 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {insights.churn_indicators.churn_rate}%
                  </p>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] uppercase">Never Engaged</p>
                  <p className="text-orange-400 text-2xl font-bold">{insights.churn_indicators.never_engaged}</p>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] uppercase">Drop-off Rate</p>
                  <p className={`text-2xl font-bold ${insights.churn_indicators.drop_off_rate > 30 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {insights.churn_indicators.drop_off_rate}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Grace Period Notification Actions */}
          <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/30 rounded-xl p-5">
            <h3 className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Grace Period Notifications
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Send "choose your plan" emails to users whose grace periods have expired. 
              Early access users (Apr 1-30) expired May 14. Alpha users (Mar 1-31) expire May 31.
            </p>
            <GraceNotifyActions token={token} />
          </div>
        </div>
      )}
    </div>
  );
}
function FeatureFlagsTab({ token }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newFlag, setNewFlag] = useState({ key: '', name: '', description: '', enabled: false });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const fetchFlags = () => {
    setLoading(true);
    fetch('/api/admin/feature-flags', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setFlags(data.flags || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchFlags(); }, [token]);

  const createFlag = async () => {
    if (!newFlag.key || !newFlag.name) return alert('Key and name are required');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newFlag),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setShowCreate(false);
      setNewFlag({ key: '', name: '', description: '', enabled: false });
      fetchFlags();
    } catch (e) { alert('Failed to create flag'); }
    finally { setSaving(false); }
  };

  const toggleFlag = async (flag) => {
    try {
      await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: flag.id, enabled: !flag.enabled }),
      });
      fetchFlags();
    } catch (e) { alert('Failed to toggle flag'); }
  };

  const updateFlag = async (flag) => {
    try {
      await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: flag.id, ...editData }),
      });
      setEditingId(null);
      setEditData({});
      fetchFlags();
    } catch (e) { alert('Failed to update flag'); }
  };

  const deleteFlag = async (flag) => {
    if (!confirm(`Delete "${flag.name}" (${flag.key})? This cannot be undone.`)) return;
    try {
      await fetch(`/api/admin/feature-flags?id=${flag.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchFlags();
    } catch (e) { alert('Failed to delete flag'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" /> Feature Flags
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Control feature rollouts without redeploying. Toggle features on/off instantly.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchFlags} className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Flag
          </button>
        </div>
      </div>

      {/* Create New Flag Form */}
      {showCreate && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
          <h3 className="text-white font-semibold">Create Feature Flag</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Key (lowercase, underscores)</label>
              <input
                type="text"
                placeholder="e.g., mask_editor"
                value={newFlag.key}
                onChange={e => setNewFlag({ ...newFlag, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                placeholder="e.g., Mask Image Editor"
                value={newFlag.name}
                onChange={e => setNewFlag({ ...newFlag, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
            <input
              type="text"
              placeholder="What does this feature flag control?"
              value={newFlag.description}
              onChange={e => setNewFlag({ ...newFlag, description: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newFlag.enabled}
                onChange={e => setNewFlag({ ...newFlag, enabled: e.target.checked })}
                className="rounded"
              />
              Enable immediately
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={createFlag} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Flag'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">How to use in code:</h3>
        <code className="text-xs text-green-400 bg-gray-900 rounded px-2 py-1 block">
          {`import { isFeatureEnabled } from '@/lib/handlers/feature-flags';`}<br/>
          {`if (await isFeatureEnabled('your_flag_key', userId)) { /* feature code */ }`}
        </code>
      </div>

      {/* Flags List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : flags.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No feature flags yet</p>
          <p className="text-sm mt-1">Create your first feature flag to start controlling rollouts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map(flag => (
            <div key={flag.id} className={`border rounded-xl p-4 transition-all ${
              flag.enabled 
                ? 'bg-green-900/10 border-green-700/40' 
                : 'bg-gray-800/50 border-gray-700/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Toggle Switch */}
                  <button
                    onClick={() => toggleFlag(flag)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      flag.enabled ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      flag.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{flag.name}</span>
                      <code className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded">{flag.key}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        flag.enabled 
                          ? 'bg-green-900/50 text-green-400' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {flag.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    {flag.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{flag.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {flag.targeted_users?.length > 0 && (
                        <span className="text-xs text-blue-400">
                          <Users className="w-3 h-3 inline mr-1" />{flag.targeted_users.length} targeted users
                        </span>
                      )}
                      {flag.rollout_percentage && (
                        <span className="text-xs text-purple-400">
                          {flag.rollout_percentage}% rollout
                        </span>
                      )}
                      {flag.environments?.length > 0 && (
                        <span className="text-xs text-orange-400">
                          {flag.environments.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingId(editingId === flag.id ? null : flag.id); setEditData({ targeted_users: flag.targeted_users || [], rollout_percentage: flag.rollout_percentage || '', environments: flag.environments || [] }); }}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteFlag(flag)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Edit Panel */}
              {editingId === flag.id && (
                <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Targeted User IDs (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="user-id-1, user-id-2"
                      value={(editData.targeted_users || []).join(', ')}
                      onChange={e => setEditData({ ...editData, targeted_users: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-xs"
                    />
                    <p className="text-xs text-gray-600 mt-1">Leave empty for all users. Add specific user IDs to limit access.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Rollout Percentage (0-100)</label>
                      <input
                        type="number"
                        min="0" max="100"
                        placeholder="100"
                        value={editData.rollout_percentage || ''}
                        onChange={e => setEditData({ ...editData, rollout_percentage: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Environments</label>
                      <div className="flex gap-2 mt-1">
                        {['development', 'production'].map(env => (
                          <label key={env} className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(editData.environments || []).includes(env)}
                              onChange={e => {
                                const envs = editData.environments || [];
                                setEditData({ ...editData, environments: e.target.checked ? [...envs, env] : envs.filter(x => x !== env) });
                              }}
                              className="rounded"
                            />
                            {env}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateFlag(flag)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs">
                      Save Changes
                    </button>
                    <button onClick={() => { setEditingId(null); setEditData({}); }} className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
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

// Support Tab — AI-Assisted Ticketing System
function SupportTab({ token, adminRole }) {
  const [subTab, setSubTab] = useState('tickets');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [diagnosing, setDiagnosing] = useState(null);
  const [approving, setApproving] = useState(null);

  // Create ticket form state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ user_email: '', user_name: '', subject: '', description: '' });
  const [creating, setCreating] = useState(false);

  // Support agent management (superadmin)
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: '', email: '', password: '' });
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Respond to user state
  const [showRespond, setShowRespond] = useState(false);
  const [respondMsg, setRespondMsg] = useState('');
  const [respondMarkResolved, setRespondMarkResolved] = useState(true);
  const [responding, setResponding] = useState(false);

  // Resolve & Notify (legacy functionality preserved)
  const [resolveEmail, setResolveEmail] = useState('');
  const [resolveConvId, setResolveConvId] = useState('');
  const [resolveMsg, setResolveMsg] = useState('');
  const [resolveSubject, setResolveSubject] = useState('Your reported issue has been resolved');
  const [resolveSending, setResolveSending] = useState(false);
  const [resolveResult, setResolveResult] = useState(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let url = '/api/support/tickets';
      if (statusFilter) url += `?status=${statusFilter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (e) { console.error('Failed to load tickets', e); }
    setLoading(false);
  };

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch('/api/admin/support-agents', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (e) { console.error('Failed to load agents', e); }
    setLoadingAgents(false);
  };

  useEffect(() => { fetchTickets(); }, [statusFilter]);
  useEffect(() => { if (subTab === 'agents') fetchAgents(); }, [subTab]);

  const handleCreateTicket = async () => {
    if (!createForm.description) return alert('Paste the email or describe the issue');
    setCreating(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); setCreating(false); return; }
      setShowCreate(false);
      setCreateForm({ user_email: '', user_name: '', subject: '', description: '' });
      fetchTickets();
    } catch (e) { alert('Failed to create ticket'); }
    setCreating(false);
  };

  const handleDiagnose = async (ticketId) => {
    setDiagnosing(ticketId);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/diagnose`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) { alert(data.error); } else {
        setSelectedTicket(data.ticket);
        fetchTickets();
      }
    } catch (e) { alert('Diagnosis failed'); }
    setDiagnosing(null);
  };

  const handleApproveFix = async (ticketId) => {
    if (!confirm('Apply this fix to the database? This action will modify user data.')) return;
    setApproving(ticketId);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/approve-fix`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) { alert(data.error); } else {
        setSelectedTicket(data.ticket);
        fetchTickets();
      }
    } catch (e) { alert('Fix approval failed'); }
    setApproving(null);
  };

  const handleUpdateStatus = async (ticketId, status) => {
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.ticket) { setSelectedTicket(data.ticket); fetchTickets(); }
    } catch (e) { alert('Failed to update'); }
  };

  const handleCreateAgent = async () => {
    if (!agentForm.name || !agentForm.email || !agentForm.password) return alert('All fields required');
    setCreatingAgent(true);
    try {
      const res = await fetch('/api/admin/support-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(agentForm),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); } else {
        setShowAgentForm(false);
        setAgentForm({ name: '', email: '', password: '' });
        fetchAgents();
      }
    } catch (e) { alert('Failed to create agent'); }
    setCreatingAgent(false);
  };

  const handleRespondToUser = async (ticketId) => {
    if (!respondMsg.trim()) return alert('Please write a response message');
    setResponding(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: respondMsg, markResolved: respondMarkResolved }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); } else {
        alert(data.message || 'Response sent!');
        setShowRespond(false);
        setRespondMsg('');
        setRespondMarkResolved(true);
        fetchTickets();
        // Refresh the selected ticket
        if (selectedTicket) {
          const tRes = await fetch(`/api/support/tickets/${ticketId}`, { headers: { Authorization: `Bearer ${token}` } });
          const tData = await tRes.json();
          if (tData.ticket) setSelectedTicket(tData.ticket);
          else if (tData.id) setSelectedTicket(tData);
        }
      }
    } catch (e) { alert('Failed to send response'); }
    setResponding(false);
  };

  const handleResolveNotify = async () => {
    if (!resolveEmail || !resolveMsg) return;
    setResolveSending(true);
    setResolveResult(null);
    try {
      const res = await fetch('/api/admin/resolve-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_email: resolveEmail, conversation_id: resolveConvId || undefined, message: resolveMsg, subject_suffix: resolveSubject }),
      });
      const data = await res.json();
      setResolveResult(data);
      if (data.success) { setResolveEmail(''); setResolveConvId(''); setResolveMsg(''); }
    } catch (e) { setResolveResult({ success: false, message: e.message }); }
    setResolveSending(false);
  };

  const statusColors = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    diagnosing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    diagnosed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    fix_pending: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    fix_approved: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    fix_applied: 'bg-green-500/20 text-green-400 border-green-500/30',
    needs_development: 'bg-red-500/20 text-red-400 border-red-500/30',
    resolved: 'bg-green-500/20 text-green-300 border-green-500/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const fixTypeLabels = {
    data_fix: { label: 'Data Fix', color: 'text-green-400 bg-green-500/10 border-green-500/30', icon: '🔧' },
    code_fix: { label: 'Needs Development', color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: '💻' },
    user_action: { label: 'User Action Required', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', icon: '👤' },
    no_fix: { label: 'No Fix Needed', color: 'text-gray-400 bg-gray-500/10 border-gray-500/30', icon: '✅' },
  };

  const subTabs = [
    { id: 'tickets', label: 'Tickets', icon: FileText },
    { id: 'resolve', label: 'Resolve & Notify', icon: Send },
    ...(adminRole === 'superadmin' ? [{ id: 'agents', label: 'Support Agents', icon: Users }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        {subTabs.map(st => {
          const Icon = st.icon;
          return (
            <button key={st.id} onClick={() => setSubTab(st.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === st.id ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
              <Icon className="w-4 h-4" /> {st.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TICKETS SUB-TAB ═══ */}
      {subTab === 'tickets' && (
        <>
          {/* Ticket Detail Modal */}
          {selectedTicket && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#141a21] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base">{selectedTicket.subject}</h3>
                      <p className="text-gray-500 text-xs font-mono">{selectedTicket.id?.slice(0, 8)}...</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedTicket(null)} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* Status & Meta */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full border font-bold ${statusColors[selectedTicket.status] || 'bg-gray-500/20 text-gray-400'}`}>
                      {selectedTicket.status?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    {selectedTicket.fix_type && fixTypeLabels[selectedTicket.fix_type] && (
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border font-bold ${fixTypeLabels[selectedTicket.fix_type].color}`}>
                        {fixTypeLabels[selectedTicket.fix_type].icon} {fixTypeLabels[selectedTicket.fix_type].label}
                      </span>
                    )}
                    {selectedTicket.category && (
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10">
                        {selectedTicket.category}
                      </span>
                    )}
                  </div>

                  {/* Original Issue */}
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <h4 className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">Original Issue</h4>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
                    <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-gray-600">
                      {selectedTicket.user_email && <span>📧 {selectedTicket.user_email}</span>}
                      {selectedTicket.user_name && <span>👤 {selectedTicket.user_name}</span>}
                      <span>📅 {new Date(selectedTicket.created_at).toLocaleString()}</span>
                      <span>📋 {selectedTicket.source}</span>
                    </div>
                  </div>

                  {/* User Data Found */}
                  {selectedTicket.user_data && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-blue-400 tracking-widest uppercase mb-2">User Found in System</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div><span className="text-gray-600">Email:</span> <span className="text-white">{selectedTicket.user_data.email}</span></div>
                        <div><span className="text-gray-600">Name:</span> <span className="text-white">{selectedTicket.user_data.name || '—'}</span></div>
                        <div><span className="text-gray-600">Role:</span> <span className="text-white">{selectedTicket.user_data.role}</span></div>
                        <div><span className="text-gray-600">Accepted:</span> <span className={selectedTicket.user_data.accepted ? 'text-green-400' : 'text-red-400'}>{selectedTicket.user_data.accepted ? 'Yes' : 'No'}</span></div>
                      </div>
                    </div>
                  )}

                  {/* AI Diagnosis */}
                  {selectedTicket.diagnosis && (
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-purple-400 tracking-widest uppercase mb-3">🤖 AI Diagnosis</h4>
                      <p className="text-sm text-gray-300 mb-3">{selectedTicket.diagnosis}</p>
                      {selectedTicket.suggested_fix && (
                        <div className="mt-3 bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mb-1">Suggested Fix</p>
                          <p className="text-sm text-green-300">{selectedTicket.suggested_fix}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DB Findings */}
                  {selectedTicket.db_findings && Object.keys(selectedTicket.db_findings).length > 0 && (
                    <div className="bg-white/3 border border-white/10 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">📊 Database Findings</h4>
                      <pre className="text-[11px] text-gray-400 overflow-x-auto max-h-48 overflow-y-auto bg-black/30 rounded-lg p-3 font-mono">
                        {JSON.stringify(selectedTicket.db_findings, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Emergent Prompt (for code fixes) */}
                  {selectedTicket.emergent_prompt && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-red-400 tracking-widest uppercase">💻 Emergent Fix Prompt</h4>
                        <button onClick={() => { navigator.clipboard.writeText(selectedTicket.emergent_prompt); alert('Copied to clipboard!'); }}
                          className="text-[11px] px-2.5 py-1 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/25 transition-colors font-medium">
                          📋 Copy Prompt
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-600 mb-2">Paste this directly into Emergent to fix the issue:</p>
                      <pre className="text-[11px] text-gray-300 overflow-x-auto max-h-48 overflow-y-auto bg-black/40 rounded-lg p-3 font-mono whitespace-pre-wrap border border-white/5">
                        {selectedTicket.emergent_prompt}
                      </pre>
                    </div>
                  )}

                  {/* Fix Actions (if data_fix) */}
                  {selectedTicket.fix_type === 'data_fix' && selectedTicket.fix_actions?.length > 0 && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-green-400 tracking-widest uppercase mb-3">🔧 Proposed Data Fix Actions</h4>
                      <div className="space-y-2">
                        {selectedTicket.fix_actions.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 bg-black/20 rounded-lg p-3">
                            <span className="text-green-400 text-xs font-bold mt-0.5">{i + 1}.</span>
                            <div className="flex-1">
                              <p className="text-sm text-green-300">{action.description}</p>
                              <p className="text-[10px] text-gray-600 mt-1 font-mono">{action.type}: {action.collection}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fix Results (if applied) */}
                  {selectedTicket.fix_results && (
                    <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-teal-400 tracking-widest uppercase mb-2">Fix Results</h4>
                      {selectedTicket.fix_results.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs mb-1">
                          <span className={r.success ? 'text-green-400' : 'text-red-400'}>{r.success ? '✅' : '❌'}</span>
                          <span className="text-gray-300">{r.action}</span>
                          {r.error && <span className="text-red-400">— {r.error}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Respond to User section */}
                  {selectedTicket.source === 'ace_escalation' && (
                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-orange-400 tracking-widest uppercase mb-2">🤖 Escalated from Ace</h4>
                      {selectedTicket.bot_conversation_summary && (
                        <details className="mb-2">
                          <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-300">View Ace conversation</summary>
                          <pre className="text-[11px] text-gray-400 mt-2 bg-black/30 rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                            {selectedTicket.bot_conversation_summary}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                  {selectedTicket.source === 'feedback_bug' && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-red-400 tracking-widest uppercase mb-2">🐛 Submitted via Bug Report Form</h4>
                      {selectedTicket.feedback_id && (
                        <p className="text-[11px] text-gray-500">Feedback ID: <span className="font-mono text-gray-400">{selectedTicket.feedback_id}</span></p>
                      )}
                      {selectedTicket.rating && (
                        <p className="text-[11px] text-gray-500 mt-1">User Rating: <span className="text-yellow-400">{'⭐'.repeat(selectedTicket.rating)}</span></p>
                      )}
                    </div>
                  )}

                  {/* Previous Responses */}
                  {selectedTicket.responses?.length > 0 && (
                    <div className="bg-white/3 border border-white/10 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-3">Previous Responses</h4>
                      <div className="space-y-2">
                        {selectedTicket.responses.map((resp, i) => (
                          <div key={i} className="bg-black/20 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-gray-400 font-medium">{resp.agent_name}</span>
                              <span className="text-[10px] text-gray-600">{resp.created_at ? new Date(resp.created_at).toLocaleString() : ''}</span>
                            </div>
                            <p className="text-sm text-gray-300">{resp.message}</p>
                            <div className="flex gap-2 mt-1.5">
                              {resp.channels?.notification && <span className="text-[10px] text-green-400">✓ In-app</span>}
                              {resp.channels?.conversation_message && <span className="text-[10px] text-green-400">✓ Chat</span>}
                              {resp.mark_resolved && <span className="text-[10px] text-blue-400">→ Marked resolved</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Respond Form */}
                  {showRespond && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-green-400 tracking-widest uppercase">📩 Respond to User</h4>
                      <p className="text-[10px] text-gray-500">This will send an in-app notification to <span className="text-white">{selectedTicket.user_email}</span>{selectedTicket.conversation_id ? ' and inject a message into their conversation' : ''}</p>
                      <textarea
                        value={respondMsg}
                        onChange={e => setRespondMsg(e.target.value)}
                        placeholder="Write your response to the user..."
                        rows={4}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-green-500/40 outline-none resize-none"
                      />
                      {selectedTicket.user_response && !respondMsg && (
                        <button onClick={() => setRespondMsg(selectedTicket.user_response)}
                          className="text-[11px] text-purple-400 hover:text-purple-300">
                          ✨ Use AI-suggested response
                        </button>
                      )}
                      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={respondMarkResolved} onChange={e => setRespondMarkResolved(e.target.checked)}
                          className="rounded border-gray-600 text-green-500 focus:ring-green-500" />
                        Mark ticket as resolved after sending
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => handleRespondToUser(selectedTicket.id)} disabled={responding || !respondMsg.trim()}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                          {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          {responding ? 'Sending...' : 'Send Response'}
                        </button>
                        <button onClick={() => { setShowRespond(false); setRespondMsg(''); }}
                          className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-sm hover:bg-white/10">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Suggested User Response from AI */}
                  {selectedTicket.user_response && !showRespond && (
                    <div className="bg-white/3 border border-white/10 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">📧 AI-Suggested User Response</h4>
                      <p className="text-sm text-gray-300 italic">{selectedTicket.user_response}</p>
                      <button onClick={() => { setRespondMsg(selectedTicket.user_response); setShowRespond(true); }}
                        className="mt-2 text-[11px] text-orange-400 hover:text-orange-300 font-medium">
                        Use this as response →
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-5 border-t border-white/10 flex flex-wrap gap-2">
                  {selectedTicket.status === 'new' && (
                    <button onClick={() => handleDiagnose(selectedTicket.id)} disabled={diagnosing === selectedTicket.id}
                      className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                      {diagnosing === selectedTicket.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                      {diagnosing === selectedTicket.id ? 'Diagnosing...' : 'Run AI Diagnosis'}
                    </button>
                  )}
                  {selectedTicket.fix_type === 'data_fix' && selectedTicket.status === 'diagnosed' && adminRole === 'superadmin' && (
                    <button onClick={() => handleApproveFix(selectedTicket.id)} disabled={approving === selectedTicket.id}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                      {approving === selectedTicket.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {approving === selectedTicket.id ? 'Applying...' : 'Approve & Apply Fix'}
                    </button>
                  )}
                  {selectedTicket.status === 'fix_applied' && (
                    <button onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium">
                      <Check className="w-4 h-4" /> Mark Resolved
                    </button>
                  )}
                  {!showRespond && !['closed'].includes(selectedTicket.status) && (
                    <button onClick={() => { setShowRespond(true); setRespondMsg(''); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all">
                      <Send className="w-4 h-4" /> Respond to User
                    </button>
                  )}
                  {!['closed', 'resolved'].includes(selectedTicket.status) && (
                    <button onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm font-medium border border-white/10">
                      <X className="w-4 h-4" /> Close Ticket
                    </button>
                  )}
                  <button onClick={() => setSelectedTicket(null)}
                    className="ml-auto px-4 py-2.5 text-gray-500 hover:text-white text-sm">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Header + Create Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-400" /> AI Support Tickets
              </h2>
              <p className="text-gray-500 text-xs mt-1">Paste user emails for AI-powered diagnosis and automated fixes</p>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchTickets} className="p-2.5 bg-[#111] border border-white/10 rounded-xl text-gray-500 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> New Ticket
              </button>
            </div>
          </div>

          {/* Create Ticket Form */}
          {showCreate && (
            <div className="bg-[#111] border border-orange-500/20 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-orange-400" />
                </div>
                <h3 className="text-white font-bold">Paste User Email / Issue</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">User Email</label>
                  <input type="email" value={createForm.user_email} onChange={e => setCreateForm({ ...createForm, user_email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">User Name (optional)</label>
                  <input value={createForm.user_name} onChange={e => setCreateForm({ ...createForm, user_name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500/40 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Subject (auto-generated if empty)</label>
                <input value={createForm.subject} onChange={e => setCreateForm({ ...createForm, subject: e.target.value })}
                  placeholder="Brief summary of the issue"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500/40 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Paste email or describe the issue *</label>
                <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Paste the full support email here, or describe the problem..."
                  rows={6}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500/40 outline-none resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateTicket} disabled={creating || !createForm.description}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? 'Creating...' : 'Create Ticket'}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 bg-white/5 text-gray-400 rounded-lg text-sm hover:bg-white/10">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2">
            {['', 'new', 'diagnosing', 'diagnosed', 'needs_development', 'fix_applied', 'resolved', 'closed'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all ${statusFilter === s ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10'}`}>
                {s === '' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>

          {/* Ticket List */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <LifeBuoy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No support tickets yet</p>
              <p className="text-xs mt-1">Click "New Ticket" to paste a user email for AI diagnosis</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(ticket => (
                <div key={ticket.id}
                  className="bg-[#111] border border-white/8 rounded-xl px-5 py-4 hover:border-white/15 transition-colors cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white text-sm font-medium truncate">{ticket.subject}</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusColors[ticket.status] || 'bg-gray-500/20 text-gray-400'}`}>
                          {ticket.status?.replace(/_/g, ' ')}
                        </span>
                        {ticket.fix_type && fixTypeLabels[ticket.fix_type] && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${fixTypeLabels[ticket.fix_type].color}`}>
                            {fixTypeLabels[ticket.fix_type].icon} {fixTypeLabels[ticket.fix_type].label}
                          </span>
                        )}
                        {ticket.category && (
                          <span className="text-[10px] text-gray-600">{ticket.category}</span>
                        )}
                        {ticket.source === 'ace_escalation' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">🤖 Ace</span>
                        )}
                        {ticket.source === 'feedback_bug' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">🐛 Bug Report</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">{ticket.user_email || 'No email'}</p>
                        <p className="text-[10px] text-gray-600">{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '—'}</p>
                      </div>
                      {ticket.status === 'new' && (
                        <button onClick={(e) => { e.stopPropagation(); handleDiagnose(ticket.id); }}
                          disabled={diagnosing === ticket.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs rounded-lg hover:bg-purple-500/25 transition-colors font-medium disabled:opacity-50">
                          {diagnosing === ticket.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cpu className="w-3 h-3" />}
                          Diagnose
                        </button>
                      )}
                      {ticket.fix_type === 'data_fix' && ticket.status === 'diagnosed' && adminRole === 'superadmin' && (
                        <button onClick={(e) => { e.stopPropagation(); handleApproveFix(ticket.id); }}
                          disabled={approving === ticket.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-500/15 border border-green-500/30 text-green-400 text-xs rounded-lg hover:bg-green-500/25 transition-colors font-medium disabled:opacity-50">
                          {approving === ticket.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ RESOLVE & NOTIFY SUB-TAB ═══ */}
      {subTab === 'resolve' && (
        <div className="space-y-6">
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
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">User Email *</label>
                <input type="email" value={resolveEmail} onChange={e => setResolveEmail(e.target.value)} placeholder="user@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Conversation ID <span className="text-gray-600">(optional)</span></label>
                <input value={resolveConvId} onChange={e => setResolveConvId(e.target.value)} placeholder="e.g. 495341f5-22d9-..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-colors font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Subject</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 whitespace-nowrap">[SoulPrint Engine Support]</span>
                  <input value={resolveSubject} onChange={e => setResolveSubject(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Resolution Message *</label>
                <textarea value={resolveMsg} onChange={e => setResolveMsg(e.target.value)} placeholder="Describe what was fixed..."
                  rows={4} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-colors resize-none" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">📧 Email</span>
                <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">🔔 In-App Popup</span>
                {resolveConvId && <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">💬 Chat Message</span>}
              </div>
              <button onClick={handleResolveNotify} disabled={resolveSending || !resolveEmail || !resolveMsg}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {resolveSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {resolveSending ? 'Sending...' : 'Resolve & Notify User'}
              </button>
              {resolveResult && (
                <div className={`p-4 rounded-lg border ${resolveResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <p className={`text-sm font-medium ${resolveResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {resolveResult.success ? '✅ ' : '❌ '}{resolveResult.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SUPPORT AGENTS SUB-TAB (Superadmin Only) ═══ */}
      {subTab === 'agents' && adminRole === 'superadmin' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" /> Support Agents
              </h2>
              <p className="text-gray-500 text-xs mt-1">Manage support team members who can triage tickets</p>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchAgents} className="p-2.5 bg-[#111] border border-white/10 rounded-xl text-gray-500 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setShowAgentForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> Add Agent
              </button>
            </div>
          </div>

          {showAgentForm && (
            <div className="bg-[#111] border border-blue-500/20 rounded-xl p-5 space-y-4">
              <h3 className="text-white font-bold">Create Support Agent</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name *</label>
                  <input value={agentForm.name} onChange={e => setAgentForm({ ...agentForm, name: e.target.value })} placeholder="Jane Smith"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email *</label>
                  <input type="email" value={agentForm.email} onChange={e => setAgentForm({ ...agentForm, email: e.target.value })} placeholder="support@example.com"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Password *</label>
                  <input type="password" value={agentForm.password} onChange={e => setAgentForm({ ...agentForm, password: e.target.value })} placeholder="••••••••"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500/40 outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateAgent} disabled={creatingAgent}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {creatingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creatingAgent ? 'Creating...' : 'Create Agent'}
                </button>
                <button onClick={() => setShowAgentForm(false)} className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-sm hover:bg-white/10">Cancel</button>
              </div>
            </div>
          )}

          {loadingAgents ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : agents.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No support agents yet</p>
              <p className="text-xs mt-1">Create agents who can log in to triage support tickets</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map(agent => (
                <div key={agent.id} className="bg-[#111] border border-white/8 rounded-xl px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                    {(agent.name || agent.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{agent.name}</p>
                    <p className="text-gray-500 text-xs truncate">{agent.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${agent.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {agent.active ? 'Active' : 'Inactive'}
                    </span>
                    {agent.last_login && <p className="text-[10px] text-gray-600 mt-1">Last: {new Date(agent.last_login).toLocaleDateString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-xs font-medium mb-1">ℹ️ Support Agent Login</p>
            <p className="text-gray-500 text-xs">
              Support agents log in via <code className="text-blue-300 bg-blue-500/10 px-1 py-0.5 rounded text-[11px]">POST /api/support/login</code> with their email and password.
              They can only access the Support tab — they cannot view Feature Flags, Settings, or other admin areas.
            </p>
          </div>
        </div>
      )}
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

  // Support login state
  const [showSupportLogin, setShowSupportLogin] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPassword, setSupportPassword] = useState('');
  const [supportLoginError, setSupportLoginError] = useState('');
  const [supportLoginLoading, setSupportLoginLoading] = useState(false);

  const handleSupportLogin = async () => {
    if (!supportEmail || !supportPassword) return;
    setSupportLoginLoading(true);
    setSupportLoginError('');
    try {
      const res = await fetch('/api/support/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: supportEmail, password: supportPassword }),
      });
      const data = await res.json();
      if (data.error) {
        setSupportLoginError(data.error);
      } else if (data.token) {
        localStorage.setItem('sp_token', data.token);
        setToken(data.token);
        setAdminRole('support');
        setActiveTab('support');
        setShowSupportLogin(false);
        setLoading(false);
      }
    } catch (e) {
      setSupportLoginError('Login failed. Please try again.');
    }
    setSupportLoginLoading(false);
  };

  useEffect(() => {
    // Check URL params for support login mode
    const params = new URLSearchParams(window.location.search);
    const isSupportMode = params.get('role') === 'support';

    const t = localStorage.getItem('sp_token');
    if (!t) {
      if (isSupportMode) {
        setShowSupportLogin(true);
        setLoading(false);
        return;
      }
      router.push('/auth');
      return;
    }
    setToken(t);

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        if (!['admin', 'superadmin', 'support'].includes(d.role)) {
          if (isSupportMode) {
            // Token is for a non-support user, show support login
            localStorage.removeItem('sp_token');
            setShowSupportLogin(true);
            setLoading(false);
            return;
          }
          router.push('/chat');
          return;
        }
        setAdminRole(d.role);
        // Support role defaults to the support tab
        if (d.role === 'support') setActiveTab('support');
        setLoading(false);
      })
      .catch(() => {
        if (isSupportMode) {
          setShowSupportLogin(true);
          setLoading(false);
        } else {
          router.push('/auth');
        }
      });

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

  // Support Login Screen
  if (showSupportLogin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-orange-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-4">
              <LifeBuoy className="w-8 h-8 text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Support Portal</h1>
            <p className="text-gray-500 text-sm">Sign in to triage and diagnose user issues</p>
          </div>
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Email</label>
              <input type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)}
                placeholder="support@example.com"
                onKeyDown={e => e.key === 'Enter' && handleSupportLogin()}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Password</label>
              <input type="password" value={supportPassword} onChange={e => setSupportPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleSupportLogin()}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 outline-none" />
            </div>
            {supportLoginError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {supportLoginError}
              </div>
            )}
            <button onClick={handleSupportLogin} disabled={supportLoginLoading || !supportEmail || !supportPassword}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {supportLoginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {supportLoginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
          <p className="text-center text-gray-600 text-xs mt-6">
            Not a support agent? <a href="/auth" className="text-orange-400 hover:text-orange-300">Sign in as admin</a>
          </p>
        </div>
      </div>
    );
  }

  // Filter tabs by role — support users only see the Support tab
  const visibleTabs = adminRole === 'support' 
    ? TABS.filter(t => t.id === 'support')
    : TABS;

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
            {visibleTabs.map(tab => (
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
          {visibleTabs.map(tab => {
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
                {visibleTabs.find(t => t.id === activeTab)?.label || TABS.find(t => t.id === activeTab)?.label}
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
                  {/* Token Volume Overview */}
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <h3 className="text-sm font-bold text-white tracking-wide">Token Volume Overview</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <MetricCard
                        label="Total Tokens (30d)"
                        value={insights?.token_totals?.last_30d?.total_tokens ? `${(insights.token_totals.last_30d.total_tokens / 1000000).toFixed(2)}M` : '0'}
                        sub={`${insights?.token_totals?.last_30d?.tracked_messages || 0} tracked msgs`}
                        icon={Zap}
                        color="green"
                      />
                      <MetricCard
                        label="Input Tokens (30d)"
                        value={insights?.token_totals?.last_30d?.input_tokens ? `${(insights.token_totals.last_30d.input_tokens / 1000000).toFixed(2)}M` : '0'}
                        sub="Prompts sent"
                        icon={ArrowUp}
                        color="blue"
                      />
                      <MetricCard
                        label="Output Tokens (30d)"
                        value={insights?.token_totals?.last_30d?.output_tokens ? `${(insights.token_totals.last_30d.output_tokens / 1000000).toFixed(2)}M` : '0'}
                        sub="Completions received"
                        icon={ArrowDown}
                        color="purple"
                      />
                      <MetricCard
                        label="Avg Tokens/Msg (30d)"
                        value={insights?.token_totals?.last_30d?.tracked_messages > 0 ? Math.round(insights.token_totals.last_30d.total_tokens / insights.token_totals.last_30d.tracked_messages).toLocaleString() : '—'}
                        sub="Per tracked message"
                        icon={BarChart2}
                        color="orange"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <MetricCard
                        label="Total Tokens (All-time)"
                        value={insights?.token_totals?.all_time?.total_tokens ? `${(insights.token_totals.all_time.total_tokens / 1000000).toFixed(2)}M` : '0'}
                        sub={`${insights?.token_totals?.all_time?.tracked_messages || 0} tracked msgs`}
                        icon={Zap}
                        color="purple"
                      />
                      <MetricCard
                        label="Input Tokens (All-time)"
                        value={insights?.token_totals?.all_time?.input_tokens ? `${(insights.token_totals.all_time.input_tokens / 1000000).toFixed(2)}M` : '0'}
                        sub="All prompts"
                        icon={ArrowUp}
                        color="blue"
                      />
                      <MetricCard
                        label="Output Tokens (All-time)"
                        value={insights?.token_totals?.all_time?.output_tokens ? `${(insights.token_totals.all_time.output_tokens / 1000000).toFixed(2)}M` : '0'}
                        sub="All completions"
                        icon={ArrowDown}
                        color="green"
                      />
                      <MetricCard
                        label="Avg Tokens/Msg (All-time)"
                        value={insights?.token_totals?.all_time?.tracked_messages > 0 ? Math.round(insights.token_totals.all_time.total_tokens / insights.token_totals.all_time.tracked_messages).toLocaleString() : '—'}
                        sub="Per tracked message"
                        icon={BarChart2}
                        color="orange"
                      />
                    </div>
                  </div>

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
            <SupportTab token={token} adminRole={adminRole} />
          )}

          {activeTab === 'featureflags' && token && (
            <FeatureFlagsTab token={token} />
          )}

          {activeTab === 'settings' && token && (
            <SettingsTab token={token} />
          )}

          {activeTab === 'subscriptions' && token && (
            <div className="space-y-6">
              <SubscriptionsTab token={token} />
              {/* Subscription Backfill Actions */}
              <div className="bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/30 rounded-xl p-5">
                <h3 className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Subscription Data Backfill
                </h3>
                <p className="text-gray-400 text-xs mb-4">
                  Create Free tier subscription records for all existing users who are missing one.
                  This ensures every registered user appears in subscription metrics. Safe to run multiple times.
                </p>
                <BackfillSubscriptionsButton token={token} />
              </div>
            </div>
          )}

          {activeTab === 'discounts' && token && (
            <DiscountsTab token={token} />
          )}

          {activeTab === 'pitchdeck' && token && (
            <PitchAnalyticsTab token={token} />
          )}
        </div>
      </div>
    </div>
  );
}
