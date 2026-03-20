'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, User, Mail, Shield, Clock, MessageSquare, Brain, Upload,
  Image, Video, Calendar, MapPin, Loader2, ExternalLink, Check, X,
  ChevronDown, ChevronRight, Sparkles, Bot, Send as SendIcon, Heart, ThumbsUp, ThumbsDown,
  Globe, Smartphone, Settings, FileText, AlertCircle, DollarSign, Zap
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

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

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) {
      router.push('/auth');
      return;
    }
    setToken(t);
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
          <p className="text-gray-500 text-sm">Loading user details...</p>
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

  const { user, profile, stats, conversations, memories, assessment, imports, media, integrations, feedback, soul_profile } = data;

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
          <StatCard label="Conversations" value={stats.total_conversations} icon={MessageSquare} color="blue" />
          <StatCard label="Messages" value={stats.total_messages} icon={SendIcon} color="green" />
          <StatCard label="Memories" value={stats.total_memories} icon={Brain} color="purple" />
          <StatCard label="Imports" value={stats.total_imports} icon={Upload} color="orange" />
          <StatCard label="Media" value={stats.total_media} icon={Image} color="blue" />
          <StatCard 
            label="Est. Cost" 
            value={`$${stats.estimated_total_cost.toFixed(2)}`} 
            sub={`LLM: $${stats.estimated_llm_cost.toFixed(2)} | Media: $${stats.estimated_media_cost.toFixed(2)}`}
            icon={DollarSign} 
            color="green" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - User Info */}
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
                  <span className="text-gray-500 text-xs">Location</span>
                  <span className="text-white text-sm">{profile?.location?.city ? `${profile.location.city}, ${profile.location.country}` : '—'}</span>
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
                  <span className="text-gray-500 text-xs">Firebase</span>
                  <span className={`text-xs ${user.firebase_uid ? 'text-green-400' : 'text-gray-500'}`}>
                    {user.firebase_uid ? '✓ Linked' : 'Not linked'}
                  </span>
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
                {/* Telegram */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#229ED9]/20 flex items-center justify-center">
                      <SendIcon className="w-3 h-3 text-[#229ED9]" />
                    </div>
                    <span className="text-gray-400 text-xs">Telegram</span>
                  </div>
                  {integrations.telegram.linked ? (
                    <div className="text-right">
                      <span className="text-green-400 text-xs font-medium">Connected</span>
                      {integrations.telegram.telegram_username && (
                        <p className="text-gray-500 text-[10px]">@{integrations.telegram.telegram_username}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-xs">Not connected</span>
                  )}
                </div>

                {/* Google */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Globe className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="text-gray-400 text-xs">Google</span>
                  </div>
                  {integrations.google.connected ? (
                    <div className="text-right">
                      <span className="text-green-400 text-xs font-medium">{integrations.google.accounts.length} account(s)</span>
                      {integrations.google.accounts[0]?.email && (
                        <p className="text-gray-500 text-[10px]">{integrations.google.accounts[0].email}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-xs">Not connected</span>
                  )}
                </div>
              </div>
            </Section>

            {/* Soul Profile Summary */}
            {soul_profile && (
              <Section title="Soul Profile" icon={Sparkles} defaultOpen={true}>
                <div className="space-y-3">
                  {soul_profile.summary && (
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Summary</p>
                      <p className="text-gray-300 text-xs leading-relaxed">{soul_profile.summary}</p>
                    </div>
                  )}
                  {soul_profile.communication_style && (
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Communication Style</p>
                      <p className="text-gray-300 text-xs">{soul_profile.communication_style}</p>
                    </div>
                  )}
                  {soul_profile.interests && soul_profile.interests.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Interests</p>
                      <div className="flex flex-wrap gap-1">
                        {soul_profile.interests.slice(0, 10).map((interest, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] rounded-full">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </div>

          {/* Middle Column - Conversations & Memories */}
          <div className="space-y-4">
            {/* Conversations */}
            <Section title="Conversations" icon={MessageSquare} badge={stats.total_conversations} defaultOpen={true}>
              {conversations.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No conversations yet</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {conversations.map(conv => (
                    <div key={conv.id} className="bg-white/5 rounded-lg p-3 hover:bg-white/8 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">{conv.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                              conv.source === 'telegram' 
                                ? 'bg-[#229ED9]/20 text-[#229ED9]' 
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
                      <p className="text-gray-600 text-[9px] mt-2">
                        {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Memories */}
            <Section title="Memories" icon={Brain} badge={stats.total_memories} defaultOpen={true}>
              {memories.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No memories saved</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {memories.map(mem => (
                    <div key={mem.id} className="bg-white/5 rounded-lg p-3">
                      <p className="text-gray-300 text-xs">{mem.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                          mem.importance === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          mem.importance === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {mem.importance || 'normal'}
                        </span>
                        <span className="text-[9px] text-gray-600">{mem.category}</span>
                        <span className="text-[9px] text-gray-600">{mem.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Feedback */}
            <Section title="Feedback Given" icon={Heart} badge={feedback.length} defaultOpen={false}>
              {feedback.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No feedback given</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {feedback.map(f => (
                    <div key={f.id} className="bg-white/5 rounded-lg p-3 flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        f.rating === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {f.rating === 'up' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                      </div>
                      <div className="flex-1">
                        {f.note && <p className="text-gray-300 text-xs">{f.note}</p>}
                        <p className="text-gray-600 text-[9px] mt-1">
                          {f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Right Column - Assessment, Imports, Media */}
          <div className="space-y-4">
            {/* Assessment */}
            <Section 
              title="Assessment" 
              icon={FileText} 
              badge={assessment.type !== 'none' ? `${assessment.type} (${assessment.answer_count})` : null}
              defaultOpen={true}
            >
              {assessment.answer_count === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">Assessment not completed</p>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {assessment.answers.map((a, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <p className="text-gray-400 text-[10px] mb-1">{a.pillar}</p>
                      <p className="text-white text-xs font-medium mb-2">{a.question_text}</p>
                      <p className="text-orange-400 text-xs">{a.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Imports */}
            <Section title="Data Imports" icon={Upload} badge={stats.total_imports} defaultOpen={true}>
              {imports.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No imports</p>
              ) : (
                <div className="space-y-2">
                  {imports.map(imp => (
                    <div key={imp.id} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-white text-xs font-medium capitalize">{imp.type}</p>
                        <p className="text-gray-500 text-[10px]">
                          {imp.items_processed || 0} items • {imp.status}
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

            {/* Media Gallery */}
            <Section title="Generated Media" icon={Image} badge={stats.total_media} defaultOpen={true}>
              {media.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No media generated</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {media.slice(0, 8).map(m => (
                    <div key={m.id} className="relative group">
                      {m.type === 'video' ? (
                        <div className="aspect-video bg-white/5 rounded-lg flex items-center justify-center">
                          <Video className="w-6 h-6 text-gray-500" />
                        </div>
                      ) : m.url ? (
                        <img 
                          src={m.url} 
                          alt={m.prompt || 'Generated image'} 
                          className="aspect-square object-cover rounded-lg"
                        />
                      ) : (
                        <div className="aspect-square bg-white/5 rounded-lg flex items-center justify-center">
                          <Image className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center p-2">
                        <span className="text-white text-[9px] text-center line-clamp-2">{m.prompt}</span>
                        {m.cost && (
                          <span className="text-green-400 text-[9px] mt-1">${m.cost.toFixed(3)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}
