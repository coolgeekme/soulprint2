'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, User, Mail, Shield, Clock, MessageSquare, Brain, Upload,
  Image, Calendar, Loader2, Check, X, ChevronDown, ChevronRight, 
  Sparkles, Bot, Send as SendIcon, Globe, Mic, DollarSign, Zap,
  BarChart2, PieChart, Activity, ThumbsUp, ThumbsDown, Cpu, Folder,
  AlertCircle
} from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, color = 'orange' }) {
  const colors = {
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };
  return (
    <div className="bg-[#111] border border-white/8 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">{label}</p>
        {Icon && <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${colors[color]}`}><Icon className="w-3.5 h-3.5" /></div>}
      </div>
      <p className="text-2xl font-bold text-white font-condensed">{value ?? '—'}</p>
      {sub && <p className="text-gray-600 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <div className="bg-[#111] border border-white/8 rounded-xl overflow-hidden">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-4 h-4 text-orange-400" />}
          <span className="text-white font-medium text-sm">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded-full">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="border-t border-white/5 p-4">{children}</div>}
    </div>
  );
}

function ProgressBar({ label, value, total, color = 'orange' }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const colors = {
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('sp_token');
    if (!t) {
      router.push('/auth');
      return;
    }
    setToken(t);
    
    // Verify admin role
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        if (!['admin', 'superadmin'].includes(d.role)) {
          router.push('/chat');
        }
      })
      .catch(() => router.push('/auth'));
  }, []);

  useEffect(() => {
    if (!token || !userId) return;
    
    const fetchUserDetails = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed to fetch user details');
        }
        const d = await res.json();
        setData(d);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    };
    
    fetchUserDetails();
  }, [token, userId]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading user analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="text-orange-400 hover:text-orange-300 text-sm flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </button>
        </div>
      </div>
    );
  }

  const { user, profile, usage_stats, costs, llm_usage, conversation_topics, memory_breakdown, 
          assessment_status, media_usage, platform_usage, integrations, feedback_summary, imports, soul_profile } = data;

  // Calculate max for progress bars
  const maxModelUsage = Math.max(...(llm_usage?.models?.map(m => m.count) || [1]));
  const maxTopicCount = Math.max(...(conversation_topics?.topics?.map(t => t.count) || [1]));
  const maxMemoryCategory = Math.max(...(memory_breakdown?.categories?.map(c => c.count) || [1]));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin?tab=users')}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">{profile?.display_name || user.email}</h1>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
              user.role === 'superadmin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
              user.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              'bg-gray-500/20 text-gray-400 border border-gray-500/30'
            }`}>
              {user.role}
            </span>
            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full flex items-center gap-1 ${
              user.accepted 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {user.accepted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              {user.accepted ? 'Active' : 'Waitlisted'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Conversations" value={usage_stats?.total_conversations || 0} icon={MessageSquare} color="blue" />
          <StatCard label="Messages" value={usage_stats?.total_messages || 0} icon={SendIcon} color="green" />
          <StatCard label="Memories" value={usage_stats?.total_memories || 0} icon={Brain} color="purple" />
          <StatCard label="Media" value={usage_stats?.total_media_generated || 0} icon={Image} color="orange" />
          <StatCard label="Voice (min)" value={usage_stats?.total_voice_minutes || 0} icon={Mic} color="blue" />
          <StatCard 
            label="Total Cost" 
            value={`$${(costs?.total_cost || 0).toFixed(2)}`} 
            sub={`LLM: $${(costs?.llm_cost || 0).toFixed(2)} | Media: $${(costs?.media_cost || 0).toFixed(2)} | Voice: $${(costs?.voice_cost || 0).toFixed(2)}`}
            icon={DollarSign} 
            color="green" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - User Info & Integrations */}
          <div className="space-y-4">
            {/* Profile Info */}
            <Section title="Profile" icon={User} defaultOpen={true}>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Display Name</span>
                  <span className="text-white text-sm">{profile?.display_name || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Assistant Name</span>
                  <span className="text-white text-sm">{profile?.assistant_name || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Field/Industry</span>
                  <span className="text-white text-sm">{profile?.field || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Help With</span>
                  <span className="text-white text-sm truncate max-w-[180px]">{profile?.help_with || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Discovery Source</span>
                  <span className="text-white text-sm">{profile?.discovery_source || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Timezone</span>
                  <span className="text-white text-sm">{profile?.timezone || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Onboarding</span>
                  <span className={`text-xs font-medium ${profile?.onboarding_complete ? 'text-green-400' : 'text-gray-500'}`}>
                    {profile?.onboarding_complete ? '✓ Complete' : 'Incomplete'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Auth Provider</span>
                  <span className="text-white text-sm">{user.auth_provider || 'email'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Created</span>
                  <span className="text-white text-sm">{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500 text-xs">Last Active</span>
                  <span className="text-white text-sm">{user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </Section>

            {/* Integrations */}
            <Section title="Integrations" icon={Globe} defaultOpen={true}>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#229ED9]/20 flex items-center justify-center">
                      <SendIcon className="w-3 h-3 text-[#229ED9]" />
                    </div>
                    <span className="text-gray-400 text-xs">Telegram</span>
                  </div>
                  {integrations?.telegram?.linked ? (
                    <div className="text-right">
                      <span className="text-green-400 text-xs font-medium">Connected</span>
                      {integrations.telegram.username && (
                        <p className="text-gray-500 text-[10px]">@{integrations.telegram.username}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-xs">Not connected</span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Globe className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="text-gray-400 text-xs">Google</span>
                  </div>
                  {integrations?.google?.connected ? (
                    <span className="text-green-400 text-xs font-medium">{integrations.google.account_count} account(s)</span>
                  ) : (
                    <span className="text-gray-500 text-xs">Not connected</span>
                  )}
                </div>
              </div>
            </Section>

            {/* Assessment Status */}
            <Section title="Assessment Status" icon={Activity} defaultOpen={true}>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Status</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    assessment_status?.type === 'full' ? 'bg-green-500/20 text-green-400' :
                    assessment_status?.type === 'quick' ? 'bg-blue-500/20 text-blue-400' :
                    assessment_status?.type === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {assessment_status?.type || 'none'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Questions Answered</span>
                  <span className="text-white text-sm">{assessment_status?.questions_answered || 0}</span>
                </div>
                {assessment_status?.pillars_covered?.length > 0 && (
                  <div className="pt-2">
                    <p className="text-gray-500 text-[10px] uppercase mb-2">Pillars Covered</p>
                    <div className="flex flex-wrap gap-1">
                      {assessment_status.pillars_covered.map((pillar, i) => (
                        <span key={i} className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] rounded-full">
                          {pillar}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* Feedback Summary */}
            <Section title="Feedback Summary" icon={ThumbsUp} defaultOpen={true}>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Total Feedback</span>
                  <span className="text-white text-sm">{feedback_summary?.total || 0}</span>
                </div>
                <div className="flex items-center gap-4 py-2">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm font-medium">{feedback_summary?.thumbs_up || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-sm font-medium">{feedback_summary?.thumbs_down || 0}</span>
                  </div>
                  {feedback_summary?.satisfaction_rate !== null && (
                    <span className="text-gray-400 text-xs ml-auto">
                      {feedback_summary.satisfaction_rate}% satisfaction
                    </span>
                  )}
                </div>
              </div>
            </Section>
          </div>

          {/* Middle Column - LLM Usage & Topics */}
          <div className="space-y-4">
            {/* LLM Model Usage */}
            <Section title="LLM Model Usage" icon={Cpu} badge={llm_usage?.total_llm_messages} defaultOpen={true}>
              {llm_usage?.models?.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No LLM usage yet</p>
              ) : (
                <div className="space-y-3">
                  {llm_usage?.models?.slice(0, 10).map((m, i) => (
                    <ProgressBar 
                      key={i} 
                      label={m.model} 
                      value={m.count} 
                      total={maxModelUsage}
                      color={i === 0 ? 'orange' : i === 1 ? 'blue' : 'purple'}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Conversation Topics */}
            <Section title="Conversation Topics" icon={Folder} badge={conversation_topics?.topics?.length} defaultOpen={true}>
              {conversation_topics?.topics?.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No categorized topics</p>
              ) : (
                <div className="space-y-3">
                  {conversation_topics?.topics?.slice(0, 8).map((t, i) => (
                    <ProgressBar 
                      key={i} 
                      label={t.topic} 
                      value={t.count} 
                      total={maxTopicCount}
                      color={i === 0 ? 'green' : i === 1 ? 'blue' : 'orange'}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Recent Conversations */}
            <Section title="Recent Conversations" icon={MessageSquare} defaultOpen={true}>
              {conversation_topics?.recent_conversations?.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No conversations yet</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {conversation_topics?.recent_conversations?.map((conv, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">{conv.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                              conv.source === 'telegram' 
                                ? 'bg-[#229ED9]/20 text-[#229ED9]' 
                                : conv.source === 'voice'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-white/10 text-gray-400'
                            }`}>
                              {conv.source || 'web'}
                            </span>
                            {conv.topic && (
                              <span className="text-[10px] text-gray-500">{conv.topic}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-orange-400 text-xs font-medium">{conv.message_count}</span>
                          <p className="text-gray-600 text-[9px]">msgs</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Right Column - Memory, Media, Platform Usage */}
          <div className="space-y-4">
            {/* Memory Categories */}
            <Section title="Memory Categories" icon={Brain} badge={memory_breakdown?.total} defaultOpen={true}>
              {memory_breakdown?.categories?.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No memories saved</p>
              ) : (
                <div className="space-y-3">
                  {memory_breakdown?.categories?.slice(0, 8).map((c, i) => (
                    <ProgressBar 
                      key={i} 
                      label={c.category} 
                      value={c.count} 
                      total={maxMemoryCategory}
                      color={i === 0 ? 'purple' : i === 1 ? 'blue' : 'green'}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Platform Usage */}
            <Section title="Platform Usage" icon={BarChart2} defaultOpen={true}>
              {platform_usage?.by_source?.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No usage data</p>
              ) : (
                <div className="space-y-3">
                  {platform_usage?.by_source?.map((s, i) => {
                    const total = platform_usage.by_source.reduce((sum, x) => sum + x.count, 0);
                    const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            s.source === 'telegram' ? 'bg-[#229ED9]/20' :
                            s.source === 'voice' ? 'bg-purple-500/20' :
                            'bg-white/10'
                          }`}>
                            {s.source === 'telegram' ? <SendIcon className="w-3 h-3 text-[#229ED9]" /> :
                             s.source === 'voice' ? <Mic className="w-3 h-3 text-purple-400" /> :
                             <Globe className="w-3 h-3 text-gray-400" />}
                          </div>
                          <span className="text-gray-400 text-xs capitalize">{s.source}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white text-sm font-medium">{s.count}</span>
                          <span className="text-gray-500 text-[10px] ml-1">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Media Generation */}
            <Section title="Media Generation" icon={Image} badge={media_usage?.total} defaultOpen={true}>
              {media_usage?.total === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No media generated</p>
              ) : (
                <div className="space-y-4">
                  {media_usage?.by_type?.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase mb-2">By Type</p>
                      <div className="flex flex-wrap gap-2">
                        {media_usage.by_type.map((t, i) => (
                          <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs">
                            <span className="text-gray-400">{t.type}:</span>
                            <span className="text-white ml-1 font-medium">{t.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {media_usage?.by_model?.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase mb-2">By Model</p>
                      <div className="flex flex-wrap gap-2">
                        {media_usage.by_model.map((m, i) => (
                          <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs">
                            <span className="text-gray-400">{m.model}:</span>
                            <span className="text-white ml-1 font-medium">{m.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Data Imports */}
            <Section title="Data Imports" icon={Upload} badge={imports?.length} defaultOpen={true}>
              {imports?.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No imports</p>
              ) : (
                <div className="space-y-2">
                  {imports?.map((imp, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-white text-xs font-medium capitalize">{imp.type}</p>
                        <p className="text-gray-500 text-[10px]">
                          {imp.items_processed || 0} items • {new Date(imp.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] rounded ${
                        imp.status === 'completed' || imp.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                        imp.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {imp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Soul Profile Status */}
            <Section title="Soul Profile" icon={Sparkles} defaultOpen={true}>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-gray-500 text-xs">Profile Generated</span>
                  <span className={`text-xs font-medium ${soul_profile?.has_profile ? 'text-green-400' : 'text-gray-500'}`}>
                    {soul_profile?.has_profile ? '✓ Yes' : 'No'}
                  </span>
                </div>
                {soul_profile?.has_profile && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-500 text-xs">Interests Identified</span>
                      <span className="text-white text-sm">{soul_profile.interests_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-500 text-xs">Last Updated</span>
                      <span className="text-white text-sm">
                        {soul_profile.updated_at ? new Date(soul_profile.updated_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}
