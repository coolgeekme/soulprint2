'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Loader2, Check, Settings, Globe, Shield, Brain, AudioWaveform,
  Megaphone, ExternalLink, ChevronRight, LogOut, Sun, Moon, Bot,
  Trash2, Clock, MessageCircle, Copy, Sparkles, MessageSquare,
  ChevronDown, Upload, Download, FileText, GitCompare, Link, Plus,
  RefreshCw, Send, ThumbsUp, Zap, CheckCircle2, Volume2, VolumeX
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { FeedbackIcon, RobotIcon } from '@/components/icons/SoulPrintIcons';
import { MODELS, TELEGRAM_MODELS, VIDEO_MODELS, IMAGE_MODELS } from './constants';
import { useTheme } from '@/lib/providers/ThemeProvider';

const SCHEDULE_TEMPLATES = [
  { id: 'ai_news',    name: '🤖 AI News Digest',     prompt: 'Summarize the top 5 most important AI and machine learning stories from the last 24 hours. For each story include: what happened, why it matters, and a source if available. Format it clearly.' },
  { id: 'world_news', name: '🌍 World News Brief',    prompt: 'What are the top 5 most important world news stories from the last 24 hours? Give a clear, concise summary of each.' },
  { id: 'market',     name: '📈 Market Summary',      prompt: 'Give me a summary of today\'s financial markets: major indices performance, top gainers/losers, notable news, and key economic events from the last 24 hours.' },
  { id: 'tech_news',  name: '💻 Tech News',           prompt: 'What are the most significant technology news stories from the last 24 hours? Focus on product launches, funding, acquisitions, and industry trends.' },
  { id: 'crypto',     name: '₿ Crypto Brief',         prompt: 'Summarize the cryptocurrency market over the last 24 hours: Bitcoin and Ethereum prices, major movers, key news and developments.' },
  { id: 'custom',     name: '✏️ Custom',              prompt: '' },
];

const TIMEZONES = [
  { label: 'UTC', offset: 0 },
  { label: 'EST (UTC-5)', offset: -5 },
  { label: 'CST (UTC-6)', offset: -6 },
  { label: 'MST (UTC-7)', offset: -7 },
  { label: 'PST (UTC-8)', offset: -8 },
  { label: 'London (UTC+0)', offset: 0 },
  { label: 'Paris (UTC+1)', offset: 1 },
  { label: 'Dubai (UTC+4)', offset: 4 },
  { label: 'India (UTC+5:30)', offset: 5.5 },
  { label: 'Singapore (UTC+8)', offset: 8 },
  { label: 'Tokyo (UTC+9)', offset: 9 },
  { label: 'Sydney (UTC+10)', offset: 10 },
];

// Feedback Modal Component
function FeedbackModal({ onClose, token }) {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);

  const handleAttachmentSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Only allow images up to 5MB
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      setAttachment({
        name: file.name,
        mimeType: file.type,
        base64,
        preview: ev.target.result,
      });
      setError('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 5) {
      setError('Please enter at least 5 characters');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      const payload = {
        message: message.trim(),
        category,
        rating: rating > 0 ? rating : null,
      };
      
      // Include attachment if present
      if (attachment) {
        payload.attachment = {
          name: attachment.name,
          mimeType: attachment.mimeType,
          base64: attachment.base64,
        };
      }
      
      const res = await fetch('/api/user-feedback', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      
      setSubmitted(true);
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h3 className="text-xl font-semibold text-white mb-2">Thank You!</h3>
          <p className="text-gray-400">Your feedback has been submitted. We truly appreciate it!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-orange-500" />
            Send Feedback
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {['general', 'bug', 'feature', 'other'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-all ${
                    category === cat 
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 border' 
                      : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {cat === 'bug' ? '🐛 Bug' : cat === 'feature' ? '💡 Feature Request' : cat === 'other' ? '📝 Other' : '💬 General'}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Your Feedback</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind... What's working well? What could be better? Any ideas?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-orange-500/50 outline-none transition-colors min-h-[120px] resize-none"
              required
            />
          </div>

          {/* Attachment */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Screenshot (optional)</label>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAttachmentSelect} 
              accept="image/*" 
              className="hidden" 
            />
            
            {attachment ? (
              <div className="relative inline-block">
                <img 
                  src={attachment.preview} 
                  alt="Screenshot preview" 
                  className="w-32 h-24 object-cover rounded-xl border-2 border-orange-500/40"
                />
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"
                >
                  <X className="w-4 h-4" />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-[128px]">{attachment.name}</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-gray-400 hover:bg-white/10 hover:border-white/30 transition-all w-full"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm">Click to attach a screenshot</span>
              </button>
            )}
            <p className="text-xs text-gray-600 mt-1">Max 5MB • PNG, JPG, GIF</p>
          </div>

          {/* Rating (optional) */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Rating (optional)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(rating === star ? 0 : star)}
                  className={`text-2xl transition-transform hover:scale-110 ${star <= rating ? 'text-orange-400' : 'text-gray-700'}`}
                >
                  ★
                </button>
              ))}
              {rating > 0 && <span className="text-sm text-gray-500 ml-2 self-center">{rating}/5</span>}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="w-full btn-orange py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Feedback
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-600 text-center">
            Your feedback helps us improve SoulPrint for everyone.
          </p>
        </form>
      </div>
    </div>
  );
}

// Appearance Tab Component - Theme toggle
function AppearanceTab() {
  const { theme, setTheme, isDark } = useTheme();
  
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white text-sm font-semibold mb-1">🎨 Appearance</h3>
        <p className="text-gray-500 text-xs mb-4">Customize how SoulPrint looks</p>
      </div>

      {/* Theme Selection */}
      <div className="space-y-3">
        <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Theme</p>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Dark Mode */}
          <button
            onClick={() => setTheme('dark')}
            className={`relative p-4 rounded-xl border-2 transition-all ${
              isDark
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#0D1217]' : 'bg-[#1a1a1a]'}`}>
                <Moon className="w-6 h-6 text-orange-400" />
              </div>
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-400'}`}>
                Dark
              </span>
              {isDark && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-orange-500" />
                </div>
              )}
            </div>
            {/* Preview */}
            <div className="mt-3 p-2 rounded-lg bg-[#0D1217] border border-white/10">
              <div className="h-1.5 w-8 bg-orange-500 rounded mb-1.5"></div>
              <div className="h-1 w-full bg-white/20 rounded mb-1"></div>
              <div className="h-1 w-3/4 bg-white/10 rounded"></div>
            </div>
          </button>

          {/* Light Mode */}
          <button
            onClick={() => setTheme('light')}
            className={`relative p-4 rounded-xl border-2 transition-all ${
              !isDark
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${!isDark ? 'bg-white shadow-md' : 'bg-gray-200'}`}>
                <Sun className="w-6 h-6 text-orange-500" />
              </div>
              <span className={`text-sm font-medium ${!isDark ? 'text-white' : 'text-gray-400'}`}>
                Light
              </span>
              {!isDark && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-orange-500" />
                </div>
              )}
            </div>
            {/* Preview */}
            <div className="mt-3 p-2 rounded-lg bg-white border border-gray-200">
              <div className="h-1.5 w-8 bg-orange-500 rounded mb-1.5"></div>
              <div className="h-1 w-full bg-gray-300 rounded mb-1"></div>
              <div className="h-1 w-3/4 bg-gray-200 rounded"></div>
            </div>
          </button>
        </div>
      </div>

      {/* Info Note */}
      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">Your preference is saved</p>
            <p className="text-gray-400 text-xs mt-1">
              SoulPrint will remember your theme choice across sessions. 
              The orange brand colors work beautifully in both themes!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Privacy & Data Management Tab Component
function PrivacyTab({ token }) {
  const [dataUsage, setDataUsage] = useState(null);
  const [privacySettings, setPrivacySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usageRes, settingsRes] = await Promise.all([
        fetch('/api/privacy/data-usage', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/privacy/settings', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setDataUsage(await usageRes.json());
      setPrivacySettings(await settingsRes.json());
    } catch (e) {
      console.error('Failed to load privacy data:', e);
    }
    setLoading(false);
  };

  const updateSetting = async (key, value) => {
    try {
      await fetch('/api/privacy/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: value })
      });
      setPrivacySettings(prev => ({ ...prev, [key]: value }));
    } catch (e) {
      alert('Failed to update setting');
    }
  };

  const exportData = async () => {
    setActionLoading('export');
    try {
      const res = await fetch('/api/privacy/export', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soulprint-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export data');
    }
    setActionLoading(null);
  };

  const purgeChatHistory = async () => {
    if (!confirm('Are you sure you want to delete ALL your chat history? This cannot be undone.')) return;
    setActionLoading('purge-chats');
    try {
      const res = await fetch('/api/privacy/purge-chats', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      alert(`Deleted ${data.messages_deleted} messages and ${data.conversations_deleted} conversations.`);
      loadData();
    } catch (e) {
      alert('Failed to purge chat history');
    }
    setActionLoading(null);
  };

  const purgeImportedData = async () => {
    if (!confirm('Are you sure you want to delete all imported data (ChatGPT, Facebook, etc.)? This will also remove your soul profile and communication analysis. This cannot be undone.')) return;
    setActionLoading('purge-imports');
    try {
      const res = await fetch('/api/privacy/purge-imports', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      alert(`Deleted ${data.total_deleted || 0} imported data records.`);
      loadData();
    } catch (e) {
      alert('Failed to purge imported data');
    }
    setActionLoading(null);
  };

  const purgeMemories = async () => {
    if (!confirm('Are you sure you want to delete ALL your memories? This will remove all learned preferences, facts, and context the AI has about you. This cannot be undone.')) return;
    setActionLoading('purge-memories');
    try {
      const res = await fetch('/api/privacy/purge-memories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      alert(`Deleted ${data.memories_deleted || 0} memories.`);
      loadData();
    } catch (e) {
      alert('Failed to purge memories');
    }
    setActionLoading(null);
  };

  const purgeAllData = async () => {
    if (!confirm('⚠️ DANGER: Are you sure you want to delete ALL your data? This includes:\n\n• All chat conversations & messages\n• All imported data & analysis\n• All memories & preferences\n• Soul profile & personalization\n\nThis action is PERMANENT and cannot be undone.')) return;
    if (!confirm('This is your final confirmation. ALL data will be permanently deleted. Continue?')) return;
    setActionLoading('purge-all');
    try {
      const res = await fetch('/api/privacy/purge-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      alert(`All data cleared:\n• ${data.messages_deleted || 0} messages deleted\n• ${data.conversations_deleted || 0} conversations deleted\n• ${data.memories_deleted || 0} memories deleted`);
      loadData();
    } catch (e) {
      alert('Failed to purge all data');
    }
    setActionLoading(null);
  };

  const deleteAccount = async () => {
    setActionLoading('delete');
    try {
      const res = await fetch('/api/privacy/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm_email: deleteEmail })
      });
      if (res.ok) {
        alert('Your account has been deleted. You will be logged out.');
        localStorage.removeItem('sp_token');
        localStorage.removeItem('sp_user');
        window.location.href = '/';
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete account');
      }
    } catch (e) {
      alert('Failed to delete account');
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b border-white/10">
        <div className="w-12 h-12 mx-auto bg-green-500/10 rounded-xl flex items-center justify-center mb-3 border border-green-500/20">
          <Shield className="w-6 h-6 text-green-400" />
        </div>
        <h3 className="text-white font-semibold">Privacy & Security</h3>
        <p className="text-gray-500 text-xs mt-1">Manage your data and privacy settings</p>
      </div>

      {/* Data Usage Summary */}
      {dataUsage && (
        <div>
          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
            <span>📊</span> Your Data
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(dataUsage.data_stored || {}).map(([key, val]) => (
              <div key={key} className="p-2 bg-[#1a1a1a] rounded-lg border border-white/5">
                <p className="text-gray-500 text-[10px] uppercase">{key.replace(/_/g, ' ')}</p>
                <p className="text-white text-lg font-semibold">{val.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Training Opt-Out */}
      <div>
        <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
          <span>🤖</span> AI Privacy
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-xl border border-white/5">
            <div>
              <p className="text-white text-sm">Opt out of AI training</p>
              <p className="text-gray-500 text-[10px]">Your data won't be used to improve our models</p>
            </div>
            <button
              onClick={() => updateSetting('ai_training_opt_out', !privacySettings?.ai_training_opt_out)}
              className={`w-10 h-5 rounded-full transition-all relative ${privacySettings?.ai_training_opt_out ? 'bg-green-500' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${privacySettings?.ai_training_opt_out ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-xl border border-white/5">
            <div>
              <p className="text-white text-sm">Analytics opt-out</p>
              <p className="text-gray-500 text-[10px]">Disable anonymous usage tracking</p>
            </div>
            <button
              onClick={() => updateSetting('analytics_opt_out', !privacySettings?.analytics_opt_out)}
              className={`w-10 h-5 rounded-full transition-all relative ${privacySettings?.analytics_opt_out ? 'bg-green-500' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${privacySettings?.analytics_opt_out ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div>
        <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
          <span>📥</span> Export Your Data
        </h4>
        <p className="text-gray-500 text-xs mb-3">Download a copy of all your data in JSON format.</p>
        <button
          onClick={exportData}
          disabled={actionLoading === 'export'}
          className="w-full px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {actionLoading === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download My Data
        </button>
      </div>

      {/* Data Deletion */}
      <div>
        <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
          <span>🗑️</span> Delete Data
        </h4>
        <div className="space-y-2">
          <button
            onClick={purgeChatHistory}
            disabled={!!actionLoading}
            className="w-full px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading === 'purge-chats' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Delete All Chat History
          </button>
          <button
            onClick={purgeImportedData}
            disabled={!!actionLoading}
            className="w-full px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading === 'purge-imports' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Delete All Imported Data
          </button>
          <button
            onClick={purgeMemories}
            disabled={!!actionLoading}
            className="w-full px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading === 'purge-memories' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Delete All Memories
          </button>
        </div>

        {/* Clear Everything */}
        <div className="mt-3 pt-3 border-t border-white/5">
          <button
            onClick={purgeAllData}
            disabled={!!actionLoading}
            className="w-full px-4 py-2.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading === 'purge-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            🔄 Clear Everything (Start Fresh)
          </button>
          <p className="text-gray-600 text-xs mt-1.5 text-center">Deletes all chats, imports, memories, and personalization data</p>
        </div>
      </div>

      {/* Delete Account */}
      <div className="pt-4 border-t border-white/10">
        <h4 className="text-red-400 text-sm font-semibold mb-3 flex items-center gap-2">
          <span>⚠️</span> Danger Zone
        </h4>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-xl transition-colors"
          >
            Delete My Account
          </button>
        ) : (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
            <p className="text-red-400 text-xs">This will permanently delete your account and ALL associated data. This action cannot be undone.</p>
            <input
              type="email"
              placeholder="Type your email to confirm"
              value={deleteEmail}
              onChange={e => setDeleteEmail(e.target.value)}
              className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-white text-sm focus:border-red-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteEmail(''); }}
                className="flex-1 px-3 py-2 bg-white/5 text-gray-400 text-sm rounded-lg hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={!deleteEmail || actionLoading === 'delete'}
                className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Delete Forever
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Disclosure */}
      <div className="pt-4 border-t border-white/5">
        <p className="text-gray-600 text-[10px] text-center">
          🤖 SoulPrint uses AI to generate responses. All conversations are with an AI assistant, not a human.
        </p>
      </div>
    </div>
  );
}

// Settings / Telegram / Imports Modal
function SettingsModal({ onClose, token, onAssessmentReset, initialTab, onModelChange, onAssistantNameChange, onAnnouncementsChange, onVoiceSettingsChange }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'imports');
  const [imports, setImports] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [profile, setProfile] = useState(null);
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [linkCode, setLinkCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const fileRef = useRef();
  const fbFileRef = useRef();
  
  // Data imports state
  const [dataImports, setDataImports] = useState([]);
  const [soulProfile, setSoulProfile] = useState(null);
  const [showInsights, setShowInsights] = useState(false);

  // Schedules state
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '', prompt: '', local_hour: 8, minute: 0, timezone_offset: 0, timezone_label: 'UTC', schedule_type: 'daily',
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Feedback state
  const [feedbackType, setFeedbackType] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackAttachment, setFeedbackAttachment] = useState(null);
  const feedbackFileRef = useRef(null);

  // GitHub state
  const [githubStatus, setGithubStatus] = useState(null);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubDisconnecting, setGithubDisconnecting] = useState(false);

  useEffect(() => {
    fetch('/api/imports', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setImports(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        setProfile(d.profile);
        if (d.profile?.default_model) {
          const validModel = MODELS.find(m => m.value === d.profile.default_model && !m.comingSoon);
          if (validModel) {
            onModelChange?.('text', d.profile.default_model);
          }
        }
        // Load default video model
        if (d.profile?.default_video_model) {
          const validVideo = VIDEO_MODELS.find(m => m.value === d.profile.default_video_model);
          if (validVideo) {
            onModelChange?.('video', d.profile.default_video_model);
          }
        }
        // Load default image model
        if (d.profile?.default_image_model) {
          const validImage = IMAGE_MODELS.find(m => m.value === d.profile.default_image_model);
          if (validImage) {
            onModelChange?.('image', d.profile.default_image_model);
          }
        }
      }).catch(() => {});
    fetch('/api/telegram/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setTelegramStatus).catch(() => {});
    fetch('/api/data-imports', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        setDataImports(d.imports || []);
        setSoulProfile(d.soulProfile || null);
      }).catch(() => {});
    fetchSchedules();
  }, [token]);

  // Fetch GitHub connection status
  const fetchGithubStatus = useCallback(async () => {
    if (!profile?.user_id) return;
    try {
      const res = await fetch(`/api/github/status?user_id=${profile.user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGithubStatus(data);
    } catch (e) {
      console.error('Failed to fetch GitHub status:', e);
    }
  }, [token, profile?.user_id]);

  // Auto-load GitHub status when integrations tab is opened
  useEffect(() => {
    if (activeTab === 'integrations' && profile?.user_id) {
      fetchGithubStatus();
    }
  }, [activeTab, profile?.user_id, fetchGithubStatus]);

  // GitHub connect handler
  const handleGitHubConnect = async () => {
    if (!profile?.user_id) return;
    setGithubLoading(true);
    try {
      const res = await fetch(`/api/github/connect?user_id=${profile.user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.authUrl) {
        // Use direct navigation instead of window.open to avoid popup blockers
        window.location.href = data.authUrl;
      } else {
        setGithubLoading(false);
      }
    } catch (e) {
      console.error('GitHub connect error:', e);
      setGithubLoading(false);
    }
  };

  // GitHub disconnect handler
  const handleGitHubDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your GitHub account?')) return;
    setGithubDisconnecting(true);
    try {
      await fetch('/api/github/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile?.user_id }),
      });
      setGithubStatus({ connected: false });
    } catch (e) {
      console.error('GitHub disconnect error:', e);
    } finally {
      setGithubDisconnecting(false);
    }
  };

  // Handle data import ZIP upload - supports multiple files
  async function handleDataImportUpload(files, source) {
    const fileList = Array.isArray(files) ? files : (files instanceof FileList ? Array.from(files) : [files]);
    if (!fileList.length || !fileList[0]) return;
    
    // 3GB max per file
    const MAX_IMPORT_SIZE = 3 * 1024 * 1024 * 1024;
    for (const file of fileList) {
      if (file.size > MAX_IMPORT_SIZE) {
        setUploadProgress(`Error: ${file.name} is too large (${(file.size / (1024 * 1024 * 1024)).toFixed(1)}GB). Maximum is 3GB per file.`);
        setTimeout(() => setUploadProgress(''), 8000);
        return;
      }
    }
    
    setUploading(true);
    
    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks
    const MAX_RETRIES = 5;
    const FETCH_TIMEOUT = 45000; // 45 second timeout per chunk
    
    // Helper function to fetch with timeout
    async function fetchWithTimeout(url, options, timeout = FETCH_TIMEOUT) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Request timed out - please try again');
        }
        throw err;
      }
    }
    
    // Helper function to upload a single chunk with retries
    async function uploadChunkWithRetry(uploadId, chunkIndex, chunkBlob, retries = 0) {
      const chunkFormData = new FormData();
      chunkFormData.append('uploadId', uploadId);
      chunkFormData.append('chunkIndex', chunkIndex.toString());
      chunkFormData.append('chunk', chunkBlob);
      
      try {
        const chunkRes = await fetchWithTimeout('/api/data-import/chunked/chunk', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: chunkFormData,
        });
        
        if (!chunkRes.ok) {
          const chunkErr = await chunkRes.json().catch(() => ({}));
          throw new Error(chunkErr.error || `HTTP ${chunkRes.status}`);
        }
        return true;
      } catch (err) {
        if (retries < MAX_RETRIES) {
          const waitTime = 1000 * Math.pow(2, retries);
          setUploadProgress(`Retry ${retries + 1}/${MAX_RETRIES}... (waiting ${waitTime/1000}s)`);
          await new Promise(r => setTimeout(r, waitTime));
          return uploadChunkWithRetry(uploadId, chunkIndex, chunkBlob, retries + 1);
        }
        throw err;
      }
    }
    
    // Upload a single file
    async function uploadSingleFile(file, fileIndex, totalFiles) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const filePrefix = totalFiles > 1 ? `[${fileIndex + 1}/${totalFiles}] ` : '';
      
      try {
        // For small files (< 10MB), use direct upload
        if (file.size < 10 * 1024 * 1024) {
          setUploadProgress(`${filePrefix}Uploading ${file.name} (${fileSizeMB}MB)...`);
          
          const formData = new FormData();
          formData.append('file', file);
          formData.append('source', source);
          
          setUploadProgress(`${filePrefix}Analyzing ${file.name}...`);
          
          const res = await fetchWithTimeout('/api/data-import/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          }, 120000); // 2 min timeout for processing
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload failed');
          return true;
        } else {
          // Large file: use chunked upload with PARALLEL uploads
          setUploadProgress(`${filePrefix}Preparing ${file.name} (${fileSizeMB}MB)...`);
          
          // 1. Initialize upload session
          const initRes = await fetchWithTimeout('/api/data-import/chunked/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ filename: file.name, fileSize: file.size, source, totalChunks }),
          });
          
          const initData = await initRes.json();
          if (!initRes.ok) throw new Error(initData.error || 'Failed to initialize upload');
          
          const { uploadId } = initData;
          
          // 2. Upload chunks in PARALLEL batches
          const PARALLEL_UPLOADS = 6; // 6 parallel uploads
          let completedChunks = 0;
          
          for (let batchStart = 0; batchStart < totalChunks; batchStart += PARALLEL_UPLOADS) {
            const batchEnd = Math.min(batchStart + PARALLEL_UPLOADS, totalChunks);
            const batchPromises = [];
            
            for (let i = batchStart; i < batchEnd; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const chunk = file.slice(start, end);
              batchPromises.push(uploadChunkWithRetry(uploadId, i, chunk));
            }
            
            await Promise.all(batchPromises);
            completedChunks = batchEnd;
            
            const progress = Math.round((completedChunks / totalChunks) * 100);
            const uploadedMB = ((completedChunks * CHUNK_SIZE) / (1024 * 1024)).toFixed(1);
            setUploadProgress(`${filePrefix}Uploading: ${progress}% (${Math.min(parseFloat(uploadedMB), parseFloat(fileSizeMB))}/${fileSizeMB}MB)`);
          }
          
          // 3. Complete upload and process
          setUploadProgress(`${filePrefix}✅ Upload complete! Analyzing...`);
          
          const completeRes = await fetchWithTimeout('/api/data-import/chunked/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ uploadId }),
          }, 180000); // 3 min timeout for processing
          
          const completeData = await completeRes.json();
          if (!completeRes.ok) throw new Error(completeData.error || 'Processing failed');
          return true;
        }
      } catch (err) {
        throw new Error(`${file.name}: ${err.message}`);
      }
    }
    
    try {
      // Process all files
      for (let i = 0; i < fileList.length; i++) {
        await uploadSingleFile(fileList[i], i, fileList.length);
      }
      
      // Refresh data after all uploads complete
      setUploadProgress('');
      const refreshRes = await fetch('/api/data-imports', { headers: { Authorization: `Bearer ${token}` } });
      const refreshData = await refreshRes.json();
      setDataImports(refreshData.imports || []);
      setSoulProfile(refreshData.soulProfile || null);
      setShowInsights(true);
    } catch (e) {
      setUploadProgress(`Error: ${e.message}`);
      setTimeout(() => setUploadProgress(''), 10000);
    }
    setUploading(false);
  }

  // Handle assessment reset - show choice modal
  const [showAssessmentChoice, setShowAssessmentChoice] = useState(false);
  
  async function handleResetAssessment(type = 'full') {
    try {
      const res = await fetch('/api/assessment/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        onAssessmentReset?.();
        onClose();
        // Navigate to the appropriate assessment type
        if (type === 'quick') {
          window.location.href = '/assessment/quick';
        } else {
          window.location.href = '/assessment';
        }
      } else {
        alert('Failed to reset assessment');
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  async function fetchSchedules() {
    setLoadingSchedules(true);
    try {
      const res = await fetch('/api/schedules', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setSchedules(Array.isArray(d) ? d : []);
    } catch { setSchedules([]); }
    setLoadingSchedules(false);
  }

  async function createSchedule() {
    if (!newSchedule.name || !newSchedule.prompt) {
      setScheduleError('Name and prompt are required');
      return;
    }
    setCreatingSchedule(true);
    setScheduleError('');
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newSchedule),
      });
      const d = await res.json();
      if (res.ok) {
        setSchedules(prev => [d, ...prev]);
        setShowCreateForm(false);
        setNewSchedule({ name: '', prompt: '', local_hour: 8, minute: 0, timezone_offset: 0, timezone_label: 'UTC', schedule_type: 'daily' });
        setSelectedTemplate(null);
      } else {
        setScheduleError(d.error || 'Failed to create schedule');
      }
    } catch { setScheduleError('Connection error'); }
    setCreatingSchedule(false);
  }

  async function toggleSchedule(taskId, active) {
    try {
      await fetch(`/api/schedules/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active }),
      });
      setSchedules(prev => prev.map(s => s.id === taskId ? { ...s, active } : s));
    } catch {}
  }

  async function deleteSchedule(taskId) {
    if (!confirm('Delete this schedule?')) return;
    try {
      await fetch(`/api/schedules/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchedules(prev => prev.filter(s => s.id !== taskId));
    } catch {}
  }

  function selectTemplate(template) {
    setSelectedTemplate(template.id);
    setNewSchedule(prev => ({
      ...prev,
      name: template.name.replace(/^[^\w]+/, '').trim(),
      prompt: template.prompt,
    }));
  }

  async function handleUpload(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    try {
      await fetch('/api/import/data', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      setTimeout(() => {
        fetch('/api/import/data', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(d => setImports(Array.isArray(d) ? d : []));
      }, 1000);
    } catch (e) { console.error(e); }
    setUploading(false);
    e.target.value = '';
  }

  const [telegramModel, setTelegramModel] = useState('gpt-4o');
  const [savingModel, setSavingModel] = useState(false);
  const [modelSaveMsg, setModelSaveMsg] = useState('');

  async function saveTelegramModel(model) {
    setSavingModel(true);
    setModelSaveMsg('');
    try {
      const res = await fetch('/api/telegram/model', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model }),
      });
      const d = await res.json();
      if (res.ok) {
        setTelegramModel(model);
        setModelSaveMsg('✅ Model updated!');
        setTimeout(() => setModelSaveMsg(''), 2000);
      } else {
        setModelSaveMsg('❌ ' + (d.error || 'Failed'));
      }
    } catch { setModelSaveMsg('❌ Error'); }
    setSavingModel(false);
  }

  // Sync model from status
  useEffect(() => {
    if (telegramStatus?.preferred_model) setTelegramModel(telegramStatus.preferred_model);
  }, [telegramStatus]);

  const linkTelegramFn = async () => {
    if (!linkCode.trim()) return;
    setLinking(true);
    setLinkMsg('');
    try {
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ link_code: linkCode.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setLinkMsg('✅ ' + d.message);
        setTelegramStatus(s => ({ ...s, linked: true }));
      } else {
        setLinkMsg('❌ ' + d.error);
      }
    } catch { setLinkMsg('❌ Connection error'); }
    setLinking(false);
  }

  // Memories state
  const [memories, setMemories] = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  const [newMemory, setNewMemory] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('other');
  const memoryCategories = ['health', 'preferences', 'personal', 'work', 'relationships', 'goals', 'other'];

  const loadMemories = async () => {
    console.log('[Memories] Starting load, token exists:', !!token);
    setMemoriesLoading(true);
    try {
      const res = await fetch('/api/user/memories', { headers: { Authorization: `Bearer ${token}` } });
      console.log('[Memories] API response status:', res.status);
      const d = await res.json();
      console.log('[Memories] Loaded:', d.memories?.length || 0, 'memories', d.error ? `Error: ${d.error}` : '');
      if (d.error) {
        console.error('[Memories] API Error:', d.error);
      }
      setMemories(d.memories || []);
      setMemoriesLoaded(true);
    } catch (e) {
      console.error('[Memories] Failed to load:', e);
    }
    setMemoriesLoading(false);
  };

  // Auto-load memories when memories tab is opened
  useEffect(() => {
    if (activeTab === 'memories' && token && !memoriesLoaded && !memoriesLoading) {
      loadMemories();
    }
  }, [activeTab, token, memoriesLoaded, memoriesLoading]);

  const addMemory = async () => {
    if (!newMemory.trim()) return;
    try {
      await fetch('/api/user/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newMemory, category: newMemoryCategory, importance: 'medium' }),
      });
      setNewMemory('');
      loadMemories();
    } catch (e) {}
  };

  const deleteMemory = async (id) => {
    if (!confirm('Delete this memory?')) return;
    try {
      await fetch(`/api/memories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadMemories();
    } catch (e) {}
  };

  const tabs = ['soulprint', 'imports', 'integrations', 'telegram', 'voice', 'schedules', 'memories', 'invites', 'announcements', 'profile', 'privacy', 'appearance', 'feedback'];

  // Voice Chat Settings
  const [voiceSettings, setVoiceSettings] = useState({ default_voice: 'alloy', default_gemini_voice: 'Puck', voice_engine: 'openai', web_search_enabled: true });
  const [voiceSettingsLoading, setVoiceSettingsLoading] = useState(false);
  const [voiceSettingsSaving, setVoiceSettingsSaving] = useState(false);
  const [playingSampleVoice, setPlayingSampleVoice] = useState(null); // voice name being previewed
  const [sampleLoading, setSampleLoading] = useState(null); // voice name currently loading
  const sampleAudioRef = useRef(null);

  // Load voice settings
  const loadVoiceSettings = async () => {
    setVoiceSettingsLoading(true);
    try {
      const res = await fetch('/api/user/voice-settings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const settings = data.voice_settings || data;
        setVoiceSettings({ 
          default_voice: settings.default_voice || 'alloy', 
          default_gemini_voice: settings.default_gemini_voice || 'Puck',
          voice_engine: settings.voice_engine || 'openai',
          web_search_enabled: settings.web_search_enabled !== false 
        });
      }
    } catch (e) {
      console.error('Failed to load voice settings:', e);
    }
    setVoiceSettingsLoading(false);
  };

  // Save voice settings
  const saveVoiceSetting = async (key, value) => {
    setVoiceSettingsSaving(true);
    try {
      const newSettings = { ...voiceSettings, [key]: value };
      setVoiceSettings(newSettings);
      
      await fetch('/api/user/voice-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newSettings),
      });
      
      // Notify parent so the voice chat component picks up the change
      if (onVoiceSettingsChange) onVoiceSettingsChange(newSettings);
    } catch (e) {
      console.error('Failed to save voice settings:', e);
    }
    setVoiceSettingsSaving(false);
  };

  // Play voice sample preview
  const playVoiceSample = async (voiceName, engine) => {
    // If already playing this voice, stop it
    if (playingSampleVoice === voiceName) {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        sampleAudioRef.current = null;
      }
      setPlayingSampleVoice(null);
      return;
    }

    // Stop any currently playing sample
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current = null;
    }

    setSampleLoading(voiceName);
    setPlayingSampleVoice(null);

    try {
      if (engine === 'gemini') {
        // Use Gemini voice sample endpoint (native audio model)
        const res = await fetch('/api/gemini/voice-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ voice: voiceName }),
        });
        if (!res.ok) throw new Error('Failed to generate sample');
        const data = await res.json();
        
        // Convert PCM16 base64 to playable audio
        const pcmBytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        // Create WAV header for PCM16 24kHz mono
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const dataSize = pcmBytes.length;
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
        view.setUint16(32, numChannels * (bitsPerSample / 8), true);
        view.setUint16(34, bitsPerSample, true);
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);
        
        const wavBlob = new Blob([wavHeader, pcmBytes], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(wavBlob);
        const audio = new Audio(audioUrl);
        sampleAudioRef.current = audio;
        
        audio.onended = () => { setPlayingSampleVoice(null); sampleAudioRef.current = null; URL.revokeObjectURL(audioUrl); };
        audio.onerror = () => { setPlayingSampleVoice(null); sampleAudioRef.current = null; URL.revokeObjectURL(audioUrl); };
        
        setSampleLoading(null);
        setPlayingSampleVoice(voiceName);
        await audio.play();
      } else {
        // OpenAI TTS preview
        const res = await fetch('/api/voice/tts/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ voice: voiceName, text: `Hi, I'm ${voiceName}. This is how I sound!` }),
        });
        if (!res.ok) throw new Error('TTS preview failed');
        
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        sampleAudioRef.current = audio;
        
        audio.onended = () => { setPlayingSampleVoice(null); sampleAudioRef.current = null; URL.revokeObjectURL(audioUrl); };
        audio.onerror = () => { setPlayingSampleVoice(null); sampleAudioRef.current = null; URL.revokeObjectURL(audioUrl); };
        
        setSampleLoading(null);
        setPlayingSampleVoice(voiceName);
        await audio.play();
      }
    } catch (e) {
      console.error('Voice sample error:', e);
      setSampleLoading(null);
      setPlayingSampleVoice(null);
    }
  };

  // Auto-load voice settings when voice tab is opened
  useEffect(() => {
    if (activeTab === 'voice' && token && !voiceSettingsLoading) {
      loadVoiceSettings();
      loadVoiceStats();
    }
  }, [activeTab, token]);

  // Voice Stats
  const [voiceStats, setVoiceStats] = useState(null);
  const [voiceStatsLoading, setVoiceStatsLoading] = useState(false);

  // Load voice stats
  const loadVoiceStats = async () => {
    if (voiceStatsLoading) return;
    setVoiceStatsLoading(true);
    try {
      const res = await fetch('/api/user/voice-stats', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setVoiceStats(data);
      }
    } catch (e) {
      console.error('Failed to load voice stats:', e);
    }
    setVoiceStatsLoading(false);
  };

  // SoulPrint data
  const [soulPrintData, setSoulPrintData] = useState(null);
  const [soulPrintLoading, setSoulPrintLoading] = useState(false);
  const [generatingSnapshot, setGeneratingSnapshot] = useState(false);
  const [editingAssistantName, setEditingAssistantName] = useState(null);
  const [editingDisplayName, setEditingDisplayName] = useState(null);
  const [editingCustomGreeting, setEditingCustomGreeting] = useState(null);
  // All announcements state (for viewing in settings)
  const [allAnnouncements, setAllAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  // Invites state
  const [invitesData, setInvitesData] = useState(null);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  const loadInvitesData = async () => {
    setInvitesLoading(true);
    try {
      const res = await fetch('/api/invites', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setInvitesData(data);
    } catch (e) {
      console.error('Failed to load invites:', e);
    }
    setInvitesLoading(false);
  };

  const copyInviteLink = () => {
    if (!invitesData?.invite_code) return;
    const link = `${window.location.origin}/invite/${invitesData.invite_code}`;
    navigator.clipboard.writeText(link);
    setInviteLinkCopied(true);
    setTimeout(() => setInviteLinkCopied(false), 2000);
  };

  // Auto-load invites when invites tab is opened
  useEffect(() => {
    if (activeTab === 'invites' && token && !invitesData && !invitesLoading) {
      loadInvitesData();
    }
  }, [activeTab, token, invitesData, invitesLoading]);

  const loadAllAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAllAnnouncements(data.announcements || []);
    } catch (e) {
      console.error('Failed to load announcements:', e);
    }
    setAnnouncementsLoading(false);
  };

  const restoreAnnouncement = async (announcementId) => {
    try {
      await fetch('/api/announcements/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ announcementId }),
      });
      // Refresh the list
      loadAllAnnouncements();
      // Also refresh the main announcements display
      fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => onAnnouncementsChange?.(d.unread || [])).catch(() => {});
    } catch (e) {
      console.error('Failed to restore announcement:', e);
    }
  };

  const loadSoulPrint = async () => {
    setSoulPrintLoading(true);
    try {
      const res = await fetch('/api/user/profile/soul', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        console.error('SoulPrint API error:', res.status);
        setSoulPrintData(null);
        return;
      }
      const data = await res.json();
      console.log('SoulPrint data loaded:', data);
      setSoulPrintData(data);
    } catch (e) {
      console.error('Failed to load SoulPrint:', e);
      setSoulPrintData(null);
    }
    setSoulPrintLoading(false);
  };

  const generateSoulPrint = async () => {
    setGeneratingSnapshot(true);
    try {
      const res = await fetch('/api/profile/soulprint/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.snapshot) {
        // Update the soulPrintData with the new snapshot
        setSoulPrintData(prev => ({
          ...prev,
          previousSnapshot: prev?.latestSnapshot || null,
          latestSnapshot: data.snapshot
        }));
      } else {
        alert(data.error || 'Failed to generate SoulPrint');
      }
    } catch (e) {
      console.error('Failed to generate SoulPrint:', e);
      alert('Failed to generate SoulPrint');
    }
    setGeneratingSnapshot(false);
  };

  useEffect(() => {
    if (activeTab === 'soulprint' && !soulPrintData) {
      loadSoulPrint();
    }
  }, [activeTab]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 safe-area-all">
      <div className="bg-[#141a21] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm sm:text-base">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="border-b border-white/10 px-2 py-2">
          <div className="grid grid-cols-4 gap-1">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-2 py-2 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase transition-colors rounded-lg text-center ${activeTab === tab ? 'text-orange-500 bg-orange-500/10 border border-orange-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'}`}>
                <span className="block text-sm mb-0.5">{tab === 'soulprint' ? '🪪' : tab === 'imports' ? '📥' : tab === 'integrations' ? '🔗' : tab === 'telegram' ? '💬' : tab === 'voice' ? '🎙️' : tab === 'schedules' ? '📅' : tab === 'memories' ? '🧠' : tab === 'invites' ? '🎁' : tab === 'announcements' ? '📢' : tab === 'profile' ? '👤' : tab === 'privacy' ? '🔒' : tab === 'appearance' ? '🎨' : '📝'}</span>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* SOULPRINT TAB */}
          {activeTab === 'soulprint' && (
            <div className="space-y-5">
              {/* What is a SoulPrint? - Collapsible Section */}
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer p-4 bg-gradient-to-r from-orange-500/5 to-purple-500/5 border border-orange-500/20 rounded-xl hover:border-orange-500/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🧬</span>
                    <div>
                      <p className="text-white text-sm font-semibold">What is a SoulPrint?</p>
                      <p className="text-gray-500 text-[10px]">The philosophy behind your AI identity</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-3 p-4 bg-sp-black rounded-xl border border-white/5 space-y-4">
                  <p className="text-gray-300 text-sm leading-relaxed">
                    A SoulPrint is your <span className="text-orange-400 font-medium">persistent AI identity layer</span>. Not a chatbot. Not a prompt wrapper. Not a memory plugin.
                  </p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    It's a mapped, structured imprint of how you <span className="text-white">think</span>, <span className="text-white">decide</span>, <span className="text-white">react</span>, <span className="text-white">prioritize</span>, <span className="text-white">trust</span>, and <span className="text-white">communicate</span> — embedded into an AI system so the interaction reflects <em>you</em>, not generic model behavior.
                  </p>
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <p className="text-orange-300 text-xs font-medium mb-2">It captures:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Decision style', 'Conflict response', 'Boundary thresholds', 'Communication cadence', 'Emotional weighting', 'Pattern recognition'].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-1 h-1 bg-orange-500 rounded-full"></span>
                          <span className="text-gray-400 text-[10px]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">🔄 Most AI resets every session.</span>
                    <span className="text-orange-400 font-medium">✨ Your SoulPrint doesn't.</span>
                  </div>
                  <p className="text-gray-400 text-xs italic border-t border-white/5 pt-3">
                    In short: A SoulPrint is the <span className="text-white font-medium">operating system of you</span> — running on AI.
                  </p>
                </div>
              </details>

              {soulPrintLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : soulPrintData ? (
                <>
                  {/* Profile Completion Progress */}
                  {soulPrintData.assessmentProgress && !soulPrintData.assessmentProgress.fullAssessmentComplete && (
                    <div className="p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-orange-400 text-xs font-medium">Profile Completion</span>
                        <span className="text-white text-sm font-semibold">{soulPrintData.assessmentProgress?.overall?.percentage || 0}%</span>
                      </div>
                      <div className="h-2 bg-black/30 rounded-full overflow-hidden mb-2">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${soulPrintData.assessmentProgress?.overall?.percentage || 0}%` }}
                        />
                      </div>
                      <p className="text-gray-500 text-[10px]">
                        {soulPrintData.assessmentProgress?.overall?.answered || 0} of 36 questions answered across 6 pillars.
                        {soulPrintData.assessmentProgress?.overall?.percentage < 100 && " I'll ask more as we chat."}
                      </p>
                    </div>
                  )}

                  {/* Header with Generate Button */}
                  <div className="text-center pb-4 border-b border-white/10">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-3 border border-orange-500/30">
                      <SoulPrintLogo size={40} />
                    </div>
                    <h3 className="text-white font-semibold">{soulPrintData.displayName}'s SoulPrint</h3>
                    <p className="text-gray-500 text-xs mt-1">Your dynamic communication identity</p>
                    
                    {/* Generate/Refresh Button */}
                    <button
                      onClick={generateSoulPrint}
                      disabled={generatingSnapshot}
                      className="mt-4 px-4 py-2 bg-gradient-to-r from-orange-500 to-purple-500 hover:from-orange-600 hover:to-purple-600 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
                    >
                      {generatingSnapshot ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Analyzing your data...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {soulPrintData.latestSnapshot ? 'Refresh SoulPrint' : 'Generate SoulPrint'}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Latest AI-Generated Snapshot */}
                  {soulPrintData.latestSnapshot && (
                    <>
                      {/* Data Sources Badge */}
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {soulPrintData.latestSnapshot.dataSources?.map((src, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white/5 text-gray-500 text-[9px] rounded-full border border-white/10 uppercase tracking-wider">
                            {src.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>

                      {/* Summary */}
                      {soulPrintData.latestSnapshot.summary && (
                        <div className="p-4 bg-gradient-to-br from-orange-500/10 to-purple-500/10 rounded-xl border border-orange-500/20">
                          <p className="text-gray-300 text-sm leading-relaxed">{soulPrintData.latestSnapshot.summary}</p>
                        </div>
                      )}

                      {/* Communication Style */}
                      {soulPrintData.latestSnapshot.communicationStyle && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🎨</span> Communication Style
                          </h4>
                          <div className="p-4 bg-[#1a1a1a] rounded-xl border border-white/5 space-y-3">
                            <p className="text-gray-300 text-sm">{soulPrintData.latestSnapshot.communicationStyle.overall}</p>
                            <div className="flex flex-wrap gap-2">
                              <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] rounded-full border border-blue-500/20">
                                {soulPrintData.latestSnapshot.communicationStyle.tone}
                              </span>
                              <span className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] rounded-full border border-green-500/20">
                                {soulPrintData.latestSnapshot.communicationStyle.directness}
                              </span>
                              <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] rounded-full border border-purple-500/20">
                                {soulPrintData.latestSnapshot.communicationStyle.detail_preference}
                              </span>
                            </div>
                            {soulPrintData.latestSnapshot.communicationStyle.traits?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-2">
                                {soulPrintData.latestSnapshot.communicationStyle.traits.map((trait, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-white/5 text-gray-400 text-[10px] rounded-full">
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Show Changes from Previous */}
                          {soulPrintData.previousSnapshot?.communicationStyle && (
                            <div className="mt-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                              <p className="text-yellow-400 text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                                <GitCompare className="w-3 h-3" /> Changes from previous
                              </p>
                              <p className="text-gray-500 text-[11px]">
                                Previous: {soulPrintData.previousSnapshot.communicationStyle.tone} / {soulPrintData.previousSnapshot.communicationStyle.directness}
                                {soulPrintData.previousSnapshot.communicationStyle.tone !== soulPrintData.latestSnapshot.communicationStyle.tone && (
                                  <span className="text-yellow-400"> → Now more {soulPrintData.latestSnapshot.communicationStyle.tone}</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Personality */}
                      {soulPrintData.latestSnapshot.personality && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🧠</span> Personality Profile
                          </h4>
                          <div className="p-4 bg-[#1a1a1a] rounded-xl border border-white/5 space-y-3">
                            <p className="text-gray-300 text-sm">{soulPrintData.latestSnapshot.personality.overview}</p>
                            {soulPrintData.latestSnapshot.personality.strengths?.length > 0 && (
                              <div>
                                <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1.5">Strengths</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {soulPrintData.latestSnapshot.personality.strengths.map((s, i) => (
                                    <span key={i} className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] rounded-full border border-green-500/20">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Interests */}
                      {soulPrintData.latestSnapshot.interests?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>💡</span> Interests & Topics
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {soulPrintData.latestSnapshot.interests.map((interest, i) => (
                              <span key={i} className="px-2 py-1 bg-orange-500/10 text-orange-400 text-[11px] rounded-full border border-orange-500/20">
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Values */}
                      {soulPrintData.latestSnapshot.values?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>❤️</span> What You Value
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {soulPrintData.latestSnapshot.values.map((value, i) => (
                              <span key={i} className="px-2 py-1 bg-pink-500/10 text-pink-400 text-[11px] rounded-full border border-pink-500/20">
                                {value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* How to Communicate */}
                      {soulPrintData.latestSnapshot.howToCommunicate?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🤖</span> How {soulPrintData.assistantName || 'SoulPrint'} Adapts to You
                          </h4>
                          <div className="p-4 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl border border-blue-500/20">
                            <ul className="space-y-2">
                              {soulPrintData.latestSnapshot.howToCommunicate.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-gray-400 text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Unique Insights */}
                      {soulPrintData.latestSnapshot.insights?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>✨</span> Unique Insights
                          </h4>
                          <div className="space-y-2">
                            {soulPrintData.latestSnapshot.insights.map((insight, i) => (
                              <div key={i} className="p-3 bg-[#1a1a1a] rounded-lg border border-white/5">
                                <p className="text-gray-400 text-xs">{insight}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Growth Areas */}
                      {soulPrintData.latestSnapshot.growthAreas?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🌱</span> Growth Opportunities
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {soulPrintData.latestSnapshot.growthAreas.map((area, i) => (
                              <span key={i} className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-[11px] rounded-full border border-cyan-500/20">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Generated timestamp */}
                      <div className="pt-3 border-t border-white/5 text-center">
                        <p className="text-gray-600 text-[10px]">
                          Generated {new Date(soulPrintData.latestSnapshot.generatedAt).toLocaleDateString()} at {new Date(soulPrintData.latestSnapshot.generatedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Show basic data if no snapshot yet */}
                  {!soulPrintData.latestSnapshot && (
                    <>
                      {/* Communication Traits from Assessment */}
                      {soulPrintData.communicationTraits?.length > 0 && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>🎨</span> Communication Style (from Assessment)
                          </h4>
                          <div className="space-y-3">
                            {soulPrintData.communicationTraits.map((trait, i) => (
                              <div key={i} className="p-3 bg-[#1a1a1a] rounded-xl border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{trait.icon}</span>
                                    <span className="text-white text-sm font-medium">{trait.name}</span>
                                  </div>
                                  <span className="text-orange-400 text-xs font-semibold">{trait.label}</span>
                                </div>
                                {trait.value && typeof trait.value === 'number' && (
                                  <div className="h-1.5 bg-black/30 rounded-full overflow-hidden mb-2">
                                    <div className="h-full bg-gradient-to-r from-orange-500 to-purple-500 rounded-full" style={{ width: `${trait.value}%` }} />
                                  </div>
                                )}
                                <p className="text-gray-500 text-[11px]">{trait.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Soul Insights from Imports */}
                      {soulPrintData.soulInsights && (
                        <div>
                          <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <span>💡</span> From Your Imported Data
                          </h4>
                          {soulPrintData.soulInsights.interests?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Interests</p>
                              <div className="flex flex-wrap gap-1.5">
                                {soulPrintData.soulInsights.interests.slice(0, 10).map((interest, i) => (
                                  <span key={i} className="px-2 py-1 bg-orange-500/10 text-orange-400 text-[11px] rounded-full border border-orange-500/20">
                                    {interest}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Prompt to generate */}
                      <div className="text-center py-6 border border-dashed border-white/10 rounded-xl">
                        <Sparkles className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm mb-2">Ready to see your full SoulPrint?</p>
                        <p className="text-gray-600 text-xs mb-4">Click "Generate SoulPrint" above to analyze all your data</p>
                      </div>
                    </>
                  )}

                  {/* No data at all */}
                  {!soulPrintData.latestSnapshot && 
                   !soulPrintData.communicationTraits?.length && 
                   !soulPrintData.soulInsights &&
                   !soulPrintData.assessmentComplete && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-gray-600" />
                      </div>
                      <p className="text-gray-500 text-sm mb-2">Build your SoulPrint</p>
                      <p className="text-gray-600 text-xs mb-4">Complete an assessment or import chat history to get started.</p>
                      <button
                        onClick={() => window.location.href = '/assessment'}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
                      >
                        Take Assessment
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">Unable to load your SoulPrint</p>
                  <button onClick={loadSoulPrint} className="mt-2 text-orange-500 text-xs hover:text-orange-400">
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* IMPORTS TAB */}
          {activeTab === 'imports' && (
            <div className="space-y-5 sm:space-y-6">
              <div>
                <h3 className="text-white text-sm font-semibold mb-1">📥 Import Your History</h3>
                <p className="text-gray-500 text-xs mb-4">Upload your ChatGPT conversation history. Support for Facebook, Claude, and other platforms coming soon!</p>
                
                {uploadProgress && (
                  <div className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <p className="text-orange-400 text-xs flex items-center gap-2 break-words">
                      <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" /> {uploadProgress}
                    </p>
                    {uploadProgress.includes('%') && (
                      <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 transition-all duration-300"
                          style={{ width: (uploadProgress.match(/(\d+)%/)?.[1] || '0') + '%' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Single Import Option */}
                <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-base font-medium">Import History</p>
                      <p className="text-gray-500 text-xs sm:text-sm mt-1 mb-3">Currently supports ChatGPT exports. Facebook, Claude, Google coming soon!</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] rounded-full">ChatGPT</span>
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded-full">Facebook</span>
                        <span className="px-2 py-0.5 bg-orange-500/10 text-orange-300 text-[10px] rounded-full">Claude</span>
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] rounded-full">Google</span>
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          window.dispatchEvent(new CustomEvent('openCloudImport'));
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors text-sm"
                      >
                        <Upload className="w-4 h-4" /> 
                        <span>Upload ZIP File</span>
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 text-[10px] mt-3 text-center">
                  🔒 Your data is processed locally. Only insights are saved, not your raw conversations.
                </p>
              </div>

              {/* Soul Profile Insights */}
              {soulProfile && (
                <div className="border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white text-sm font-semibold">✨ What I've Learned</h3>
                    <button onClick={() => setShowInsights(!showInsights)} className="text-gray-500 hover:text-white text-xs">
                      {showInsights ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  
                  {soulProfile.latestSummary && (
                    <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-blue-500/10 border border-orange-500/20 mb-3">
                      <p className="text-gray-300 text-xs leading-relaxed">{soulProfile.latestSummary}</p>
                    </div>
                  )}

                  {showInsights && (
                    <div className="space-y-3">
                      {/* Interests */}
                      {soulProfile.interests?.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">Topics You Discuss</p>
                          <div className="flex flex-wrap gap-1.5">
                            {soulProfile.interests.slice(0, 10).map((interest, i) => (
                              <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-gray-400">{interest}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Communication Style */}
                      {soulProfile.communicationStyle && Object.keys(soulProfile.communicationStyle).map(source => (
                        <div key={source}>
                          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">Style ({source})</p>
                          <div className="p-2.5 rounded-lg bg-white/3 border border-white/5">
                            <p className="text-gray-400 text-xs">{soulProfile.communicationStyle[source].description || 'Analyzed'}</p>
                            <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                              <span className="text-gray-600">Tone: <span className="text-gray-400">{soulProfile.communicationStyle[source].tone}</span></span>
                              <span className="text-gray-600">Style: <span className="text-gray-400">{soulProfile.communicationStyle[source].formality}</span></span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Insights */}
                      {soulProfile.insights?.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">Key Insights</p>
                          <ul className="space-y-1.5">
                            {soulProfile.insights.slice(0, 5).map((insight, i) => (
                              <li key={i} className="text-gray-400 text-xs flex items-start gap-2">
                                <span className="text-orange-500">•</span> {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Import History */}
              {dataImports.length > 0 && (
                <div className="border-t border-white/10 pt-5">
                  <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-3">Import History ({dataImports.length})</p>
                  <div className="space-y-2">
                    {dataImports.map(imp => (
                      <div key={imp.id} className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/5">
                        <div>
                          <p className="text-white text-xs flex items-center gap-2">
                            {imp.source === 'chatgpt' ? '💬' : '👤'} {imp.source} import
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${imp.status === 'complete' ? 'bg-green-500/20 text-green-400' : imp.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                              {imp.status}
                            </span>
                          </p>
                          <p className="text-gray-600 text-[10px]">
                            {imp.stats?.messageCount || imp.stats?.userMessageCount || imp.stats?.conversationCount
                              ? `${imp.stats.messageCount || imp.stats.userMessageCount || imp.stats.conversationCount} items analyzed`
                              : imp.stats?.analyzed ? 'Analysis complete' : '0 items analyzed'} · {new Date(imp.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INTEGRATIONS TAB */}
          {activeTab === 'integrations' && (
            <div className="space-y-5">
              {/* Google Workspace */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-semibold">Google Workspace</p>
                  <p className="text-gray-400 text-xs">Gmail, Calendar, Drive</p>
                </div>
              </div>
              
              <a
                href="/integrations"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Manage Google Integration
              </a>

              {/* Divider */}
              <div className="border-t border-white/10 my-2" />

              {/* GitHub Integration */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 bg-[#24292e] rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-semibold">GitHub</p>
                  <p className="text-gray-400 text-xs">Repos, Code, Issues, PRs</p>
                </div>
                {githubStatus?.connected && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-400 text-xs font-medium">Connected</span>
                  </div>
                )}
              </div>

              {githubStatus?.connected ? (
                <div className="space-y-3">
                  {/* Connected status card */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    {githubStatus.github_avatar && (
                      <img src={githubStatus.github_avatar} alt="" className="w-8 h-8 rounded-full" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">@{githubStatus.github_username}</p>
                      <p className="text-gray-400 text-[10px]">Connected {githubStatus.connected_at ? new Date(githubStatus.connected_at).toLocaleDateString() : ''}</p>
                    </div>
                    <button
                      onClick={handleGitHubDisconnect}
                      disabled={githubDisconnecting}
                      className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                    >
                      {githubDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Disconnect'}
                    </button>
                  </div>
                  
                  {/* Usage tips */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-gray-300 text-xs font-medium mb-2">💡 How to use GitHub in chat:</p>
                    <ul className="text-gray-400 text-[11px] space-y-1.5">
                      <li><code className="bg-white/10 px-1 py-0.5 rounded text-orange-300">/github repos</code> — List your repositories</li>
                      <li><code className="bg-white/10 px-1 py-0.5 rounded text-orange-300">/github files owner/repo</code> — Browse files</li>
                      <li><code className="bg-white/10 px-1 py-0.5 rounded text-orange-300">/github issues owner/repo</code> — View open issues</li>
                      <li><code className="bg-white/10 px-1 py-0.5 rounded text-orange-300">/github pulls owner/repo</code> — View pull requests</li>
                      <li><code className="bg-white/10 px-1 py-0.5 rounded text-orange-300">/github commits owner/repo</code> — Recent commits</li>
                      <li className="pt-1 text-gray-500">Or just ask naturally: &quot;Show me the files in my project&quot;</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm">
                    Connect your GitHub account to get AI help with your code, repos, issues, and pull requests.
                  </p>
                  <button
                    onClick={handleGitHubConnect}
                    disabled={githubLoading}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#24292e] hover:bg-[#2c3137] text-white rounded-xl font-medium transition-colors"
                  >
                    {githubLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        Connect GitHub
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-white/10 my-2" />
              
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-blue-400 text-xs">
                  <span className="font-semibold">🔒 Privacy First:</span> Your connected accounts are encrypted and you can disconnect at any time.
                </p>
              </div>
            </div>
          )}

          {/* TELEGRAM TAB */}
          {activeTab === 'telegram' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#229ED9]/10 border border-[#229ED9]/20">
                <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="#229ED9"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.012 9.483c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.496.969z"/></svg>
                <div>
                  <p className="text-white text-sm font-semibold">Telegram Bot</p>
                  <p className="text-gray-400 text-xs">Chat with your SoulPrint via Telegram</p>
                </div>
                {telegramStatus?.linked && (
                  <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full font-bold">LINKED</span>
                )}
              </div>

              {!telegramStatus?.configured ? (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Telegram not configured</p>
                  <p className="text-gray-500 text-xs">An admin needs to add <code className="bg-white/10 px-1 rounded">TELEGRAM_BOT_TOKEN</code> to the server environment and run setup from the Admin panel.</p>
                </div>
              ) : telegramStatus?.linked ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <p className="text-green-400 text-xs font-semibold mb-1">✅ Telegram is linked!</p>
                    <p className="text-gray-400 text-xs">You can chat with your SoulPrint directly in Telegram. Type <code className="bg-white/10 px-1 rounded">/help</code> in the bot for commands.</p>
                  </div>

                  {/* Disconnect Telegram */}
                  <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-xs font-semibold">Disconnect Telegram</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">Unlink your Telegram account from SoulPrint</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('Are you sure you want to disconnect Telegram? You can re-link later.')) return;
                          try {
                            const res = await fetch('/api/telegram/unlink', {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            if (res.ok) {
                              setTelegramStatus(s => ({ ...s, linked: false }));
                            } else {
                              const d = await res.json().catch(() => ({}));
                              alert(d.error || 'Failed to disconnect');
                            }
                          } catch {
                            alert('Connection error. Please try again.');
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-colors"
                        data-testid="telegram-disconnect-btn"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  {/* AI Model selector for Telegram */}
                  <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-xs font-semibold">AI Model for Telegram</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">Choose which AI responds to your Telegram messages</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {['Dynamic', 'OpenAI', 'Claude', 'Gemini', 'Perplexity', 'Kimi'].map(group => {
                        const groupModels = TELEGRAM_MODELS.filter(m => m.group === group && !m.comingSoon);
                        if (!groupModels.length) return null;
                        return (
                          <div key={group}>
                            <p className="text-[9px] font-bold text-gray-600 tracking-widest uppercase px-1 mt-2 mb-1">{group === 'Dynamic' ? '🧠 Dynamic' : group}</p>
                            {groupModels.map(m => (
                              <button key={m.value}
                                onClick={() => saveTelegramModel(m.value)}
                                disabled={savingModel}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${telegramModel === m.value ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
                                <span>{m.label}</span>
                                {telegramModel === m.value && <span className="text-[9px] font-bold text-orange-500/70">ACTIVE</span>}
                                {m.group === 'Perplexity' && <span className="text-[9px] text-blue-400/70 ml-1">🌐 online</span>}
                                {m.isSmartMode && <span className="text-[9px] text-purple-400/70 ml-1">auto</span>}
                              </button>
                            ))}
                            {group === 'Dynamic' && (
                              <p className="text-[9px] text-gray-600 px-1 mt-1 mb-2">Auto-selects best model: code → GPT-4o, search → Sonar, creative → Claude</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {modelSaveMsg && <p className={`text-xs ${modelSaveMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{modelSaveMsg}</p>}
                    <p className="text-[10px] text-gray-700 border-t border-white/5 pt-2">
                      You can also switch models directly in Telegram with <code className="bg-white/10 px-1 rounded">/model [name]</code>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-2">
                    <p className="text-white text-xs font-semibold">How to connect:</p>
                    <ol className="text-gray-400 text-xs space-y-1.5 list-decimal list-inside">
                      <li>Open Telegram and search for <code className="bg-white/10 px-1 rounded text-orange-400">@soulprintengine_bot</code></li>
                      <li>Send <code className="bg-white/10 px-1 rounded">/start</code> to the bot</li>
                      <li>The bot will reply with a link code</li>
                      <li>Enter that code below</li>
                    </ol>
                    <a href="https://t.me/soulprintengine_bot" target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 text-xs text-[#0088cc] hover:underline mt-2">
                      💬 Open @soulprintengine_bot in Telegram
                    </a>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2 block">Enter Link Code</label>
                    <div className="flex gap-2">
                      <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())}
                        placeholder="e.g. A1B2C3D4" maxLength={8}
                        className="flex-1 bg-sp-black border border-white/10 text-white text-sm px-4 py-2.5 rounded-xl font-mono tracking-widest focus:border-orange-500/40 transition-colors" />
                      <button onClick={linkTelegramFn} disabled={linking || !linkCode.trim()}
                        className="btn-orange px-4 rounded-xl text-sm disabled:opacity-50">
                        {linking ? '...' : 'Link'}
                      </button>
                    </div>
                    {linkMsg && <p className={`text-xs mt-2 ${linkMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{linkMsg}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VOICE SETTINGS TAB */}
          {activeTab === 'voice' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-white text-sm font-semibold">🎙️ Voice Chat Settings</h3>
                <p className="text-gray-500 text-xs mt-0.5">Configure your voice engine, default voice, and preferences</p>
              </div>

              {voiceSettingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : (
                <>
                  {/* Voice Engine Selection */}
                  <div className="p-4 bg-white/3 border border-white/8 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-semibold">Voice Engine</p>
                        <p className="text-gray-500 text-xs">Choose which AI engine powers your voice conversations</p>
                      </div>
                      {voiceSettingsSaving && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => saveVoiceSetting('voice_engine', 'openai')}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          voiceSettings.voice_engine === 'openai'
                            ? 'bg-orange-500/20 border-orange-500/50 ring-1 ring-orange-500/30'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${voiceSettings.voice_engine === 'openai' ? 'bg-orange-500/30 text-orange-300' : 'bg-white/10 text-gray-400'}`}>⚡</div>
                          <p className={`font-semibold text-sm ${voiceSettings.voice_engine === 'openai' ? 'text-orange-400' : 'text-white'}`}>OpenAI</p>
                        </div>
                        <p className="text-xs text-gray-500">GPT Realtime 1.5 · WebRTC</p>
                        <p className="text-[10px] text-gray-600 mt-1">8 voices · Tools · Memory</p>
                      </button>

                      <button
                        onClick={() => saveVoiceSetting('voice_engine', 'gemini')}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          voiceSettings.voice_engine === 'gemini'
                            ? 'bg-blue-500/20 border-blue-500/50 ring-1 ring-blue-500/30'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${voiceSettings.voice_engine === 'gemini' ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-gray-400'}`}>✨</div>
                          <p className={`font-semibold text-sm ${voiceSettings.voice_engine === 'gemini' ? 'text-blue-400' : 'text-white'}`}>Gemini</p>
                        </div>
                        <p className="text-xs text-gray-500">3.1 Flash Live · WebSocket</p>
                        <p className="text-[10px] text-gray-600 mt-1">8 voices · Low latency · Native audio</p>
                      </button>
                    </div>
                  </div>

                  {/* Default Voice Selection - OpenAI */}
                  {voiceSettings.voice_engine === 'openai' && (
                    <div className="p-4 bg-white/3 border border-white/8 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-semibold">OpenAI Voice</p>
                          <p className="text-gray-500 text-xs">Choose the default voice for OpenAI voice chats</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'alloy', name: 'Alloy', desc: 'Neutral & balanced' },
                          { id: 'ash', name: 'Ash', desc: 'Soft & thoughtful' },
                          { id: 'ballad', name: 'Ballad', desc: 'Warm & expressive' },
                          { id: 'coral', name: 'Coral', desc: 'Clear & friendly' },
                          { id: 'echo', name: 'Echo', desc: 'Smooth & calm' },
                          { id: 'sage', name: 'Sage', desc: 'Wise & measured' },
                          { id: 'shimmer', name: 'Shimmer', desc: 'Bright & energetic' },
                          { id: 'verse', name: 'Verse', desc: 'Dynamic & engaging' },
                        ].map(voice => (
                          <div
                            key={voice.id}
                            className={`p-3 rounded-xl border transition-all ${
                              voiceSettings.default_voice === voice.id 
                                ? 'bg-orange-500/20 border-orange-500/50' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => saveVoiceSetting('default_voice', voice.id)}
                                className="flex-1 text-left"
                              >
                                <p className={`font-medium text-sm ${voiceSettings.default_voice === voice.id ? 'text-orange-400' : 'text-white'}`}>
                                  {voice.name}
                                </p>
                                <p className="text-xs text-gray-500">{voice.desc}</p>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); playVoiceSample(voice.id, 'openai'); }}
                                className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                                  playingSampleVoice === voice.id 
                                    ? 'bg-orange-500/30 text-orange-300' 
                                    : sampleLoading === voice.id
                                    ? 'bg-white/10 text-gray-400'
                                    : 'hover:bg-white/10 text-gray-500 hover:text-orange-400'
                                }`}
                                title={playingSampleVoice === voice.id ? 'Stop preview' : 'Preview voice'}
                              >
                                {sampleLoading === voice.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : playingSampleVoice === voice.id ? (
                                  <VolumeX className="w-4 h-4" />
                                ) : (
                                  <Volume2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Default Voice Selection - Gemini */}
                  {voiceSettings.voice_engine === 'gemini' && (
                    <div className="p-4 bg-white/3 border border-white/8 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-semibold">Gemini Voice</p>
                          <p className="text-gray-500 text-xs">Choose the default voice for Gemini voice chats</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'Puck', name: 'Puck', desc: 'Playful & bright' },
                          { id: 'Charon', name: 'Charon', desc: 'Deep & resonant' },
                          { id: 'Kore', name: 'Kore', desc: 'Clear & warm' },
                          { id: 'Fenrir', name: 'Fenrir', desc: 'Bold & strong' },
                          { id: 'Aoede', name: 'Aoede', desc: 'Melodic & smooth' },
                          { id: 'Leda', name: 'Leda', desc: 'Gentle & calm' },
                          { id: 'Orus', name: 'Orus', desc: 'Rich & steady' },
                          { id: 'Zephyr', name: 'Zephyr', desc: 'Light & airy' },
                        ].map(voice => (
                          <div
                            key={voice.id}
                            className={`p-3 rounded-xl border transition-all ${
                              voiceSettings.default_gemini_voice === voice.id 
                                ? 'bg-blue-500/20 border-blue-500/50' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveVoiceSetting('default_gemini_voice', voice.id)}
                                className="flex items-center gap-2 flex-1 text-left"
                              >
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                  voiceSettings.default_gemini_voice === voice.id ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-gray-400'
                                }`}>
                                  {voice.name[0]}
                                </div>
                                <div>
                                  <p className={`font-medium text-sm ${voiceSettings.default_gemini_voice === voice.id ? 'text-blue-400' : 'text-white'}`}>
                                    {voice.name}
                                  </p>
                                  <p className="text-xs text-gray-500">{voice.desc}</p>
                                </div>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); playVoiceSample(voice.id, 'gemini'); }}
                                className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                                  playingSampleVoice === voice.id 
                                    ? 'bg-blue-500/30 text-blue-300' 
                                    : sampleLoading === voice.id
                                    ? 'bg-white/10 text-gray-400'
                                    : 'hover:bg-white/10 text-gray-500 hover:text-blue-400'
                                }`}
                                title={playingSampleVoice === voice.id ? 'Stop preview' : 'Preview voice'}
                              >
                                {sampleLoading === voice.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : playingSampleVoice === voice.id ? (
                                  <VolumeX className="w-4 h-4" />
                                ) : (
                                  <Volume2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Web Search Toggle */}
                  <div className="p-4 bg-white/3 border border-white/8 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${voiceSettings.web_search_enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-500'}`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">Real-time Web Search</p>
                          <p className="text-gray-500 text-xs">AI can search for current news, weather, stocks, etc. during voice calls</p>
                        </div>
                      </div>
                      <button
                        onClick={() => saveVoiceSetting('web_search_enabled', !voiceSettings.web_search_enabled)}
                        className={`w-12 h-6 rounded-full transition-colors ${voiceSettings.web_search_enabled ? 'bg-blue-500' : 'bg-gray-600'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-0.5 ${voiceSettings.web_search_enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Voice Chat Statistics */}
                  <div className="p-4 bg-gradient-to-br from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-orange-400 text-xs font-semibold">📊 Your Voice Chat Stats</p>
                      {voiceStatsLoading && <Loader2 className="w-3 h-3 animate-spin text-orange-500" />}
                    </div>
                    
                    {voiceStats?.stats ? (
                      <div className="space-y-4">
                        {/* Main Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold text-white">{voiceStats.stats.total_sessions || 0}</p>
                            <p className="text-gray-500 text-xs">Total Sessions</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold text-white">{voiceStats.stats.total_duration_formatted || '0m'}</p>
                            <p className="text-gray-500 text-xs">Total Time</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold text-white">{voiceStats.stats.avg_duration_formatted || '0m'}</p>
                            <p className="text-gray-500 text-xs">Avg Duration</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold text-white">{voiceStats.stats.total_messages || 0}</p>
                            <p className="text-gray-500 text-xs">Messages</p>
                          </div>
                        </div>

                        {/* Voice Distribution */}
                        {voiceStats.voice_distribution?.length > 0 && (
                          <div>
                            <p className="text-gray-500 text-xs mb-2">🎤 Voices Used</p>
                            <div className="flex flex-wrap gap-2">
                              {voiceStats.voice_distribution.map((v, i) => (
                                <span 
                                  key={i} 
                                  className="px-2 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400"
                                >
                                  {v.voice} <span className="text-orange-400">({v.count})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent Sessions */}
                        {voiceStats.recent_sessions?.length > 0 && (
                          <div>
                            <p className="text-gray-500 text-xs mb-2">🕐 Recent Sessions</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {voiceStats.recent_sessions.slice(0, 5).map((session, i) => (
                                <div key={i} className="flex items-center justify-between p-2 bg-white/3 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${session.status === 'completed' ? 'bg-green-500' : session.status === 'active' ? 'bg-orange-500' : 'bg-gray-500'}`} />
                                    <span className="text-white text-xs">{session.voice || 'Default'}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-gray-500 text-xs">
                                    <span>{session.message_count || 0} msgs</span>
                                    <span>{session.duration_seconds ? `${Math.round(session.duration_seconds / 60)}m` : '-'}</span>
                                    <span>{new Date(session.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* First/Last Session */}
                        {voiceStats.stats.first_session && (
                          <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-white/5">
                            <span>First: {new Date(voiceStats.stats.first_session).toLocaleDateString()}</span>
                            <span>Last: {new Date(voiceStats.stats.last_session).toLocaleDateString()}</span>
                          </div>
                        )}

                        {/* Cost Breakdown Section */}
                        {voiceStats.costs && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-green-400 text-xs font-semibold mb-3">💰 Cost Breakdown (Your Usage)</p>
                            
                            {/* Grand Total */}
                            <div className="p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg mb-3">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400 text-xs">Total Cost (All Services)</span>
                                <span className="text-xl font-bold text-green-400">${voiceStats.costs.grand_total_usd?.toFixed(2) || '0.00'}</span>
                              </div>
                            </div>

                            {/* Cost by Service */}
                            <div className="space-y-2">
                              {/* Voice Chat Costs */}
                              <div className="p-3 bg-white/3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-white text-xs font-medium">🎙️ Voice Chat</span>
                                  <span className="text-orange-400 text-sm font-semibold">${voiceStats.costs.voice.total_cost_usd?.toFixed(4) || '0.00'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                  <div>
                                    <span className="block text-gray-600">Input Tokens</span>
                                    <span className="text-gray-400">{(voiceStats.costs.voice.audio_input_tokens || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Output Tokens</span>
                                    <span className="text-gray-400">{(voiceStats.costs.voice.audio_output_tokens || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Cost/Session</span>
                                    <span className="text-gray-400">${voiceStats.costs.voice.cost_per_session?.toFixed(4) || '0.00'}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Cost/Minute</span>
                                    <span className="text-gray-400">${voiceStats.costs.voice.cost_per_minute?.toFixed(4) || '0.00'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Text Chat Costs */}
                              <div className="p-3 bg-white/3 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-white text-xs font-medium">💬 Text Chat</span>
                                  <span className="text-blue-400 text-sm font-semibold">${voiceStats.costs.text.estimated_cost_usd?.toFixed(4) || '0.00'}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                                  <div>
                                    <span className="block text-gray-600">Messages</span>
                                    <span className="text-gray-400">{(voiceStats.costs.text.total_messages || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Input Tokens</span>
                                    <span className="text-gray-400">{(voiceStats.costs.text.input_tokens || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-600">Output Tokens</span>
                                    <span className="text-gray-400">{(voiceStats.costs.text.output_tokens || 0).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Media Generation Costs */}
                              {voiceStats.costs.media.total_cost_usd > 0 && (
                                <div className="p-3 bg-white/3 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-white text-xs font-medium">🖼️ Media Generation</span>
                                    <span className="text-purple-400 text-sm font-semibold">${voiceStats.costs.media.total_cost_usd?.toFixed(4) || '0.00'}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {Object.entries(voiceStats.costs.media.by_type || {}).map(([type, data]) => (
                                      <span key={type} className="px-2 py-1 bg-white/5 rounded text-gray-400">
                                        {type}: {data.count} (${data.cost?.toFixed(2)})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Pricing Note */}
                            <p className="text-gray-600 text-[10px] mt-3 italic">
                              * Costs are estimates based on OpenAI API pricing. Voice: $40/1M input, $80/1M output tokens. Text: ~$2.50/1M input, ~$10/1M output.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 text-xs">No voice chat history yet</p>
                        <p className="text-gray-600 text-xs mt-1">Start a voice conversation to see your stats!</p>
                      </div>
                    )}
                  </div>

                  {/* Voice Chat Tips */}
                  <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                    <p className="text-purple-400 text-xs font-semibold mb-2">💡 Tips for Voice Chat</p>
                    <ul className="space-y-1.5 text-gray-400 text-xs">
                      <li>• Click the waveform icon 🎙️ in the chat input area to start a voice conversation</li>
                      <li>• You can preview any voice before starting by clicking the play button</li>
                      <li>• Say "search for..." or ask about current events to trigger web search</li>
                      <li>• Your conversation transcript is saved when you end the call</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SCHEDULES TAB */}
          {activeTab === 'schedules' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-sm font-semibold">⏰ Scheduled Tasks</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Receive recurring briefings via Telegram</p>
                </div>
                <button
                  onClick={() => { setShowCreateForm(true); setScheduleError(''); }}
                  className="btn-orange px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" /> New Schedule
                </button>
              </div>

              {!telegramStatus?.linked && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Link Telegram first</p>
                  <p className="text-gray-500 text-xs">You need to link your Telegram account to receive scheduled briefings. Go to the Telegram tab above to set it up.</p>
                </div>
              )}

              {/* Create form */}
              {showCreateForm && (
                <div className="p-4 rounded-xl bg-white/3 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-white text-sm font-semibold">Create New Schedule</p>
                    <button onClick={() => setShowCreateForm(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>

                  {/* Templates */}
                  <div>
                    <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">Quick Templates</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SCHEDULE_TEMPLATES.filter(t => t.id !== 'custom').map(t => (
                        <button
                          key={t.id}
                          onClick={() => selectTemplate(t)}
                          className={`p-2.5 rounded-lg text-left text-xs border transition-colors ${selectedTemplate === t.id ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-white/3 border-white/5 text-gray-400 hover:text-white'}`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Name</label>
                    <input
                      value={newSchedule.name}
                      onChange={e => setNewSchedule(p => ({ ...p, name: e.target.value }))}
                      placeholder="AI News Digest"
                      className="w-full bg-sp-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:border-orange-500/40 transition-colors"
                    />
                  </div>

                  {/* Prompt */}
                  <div>
                    <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Prompt</label>
                    <textarea
                      value={newSchedule.prompt}
                      onChange={e => setNewSchedule(p => ({ ...p, prompt: e.target.value }))}
                      placeholder="Summarize the top 5 AI news stories..."
                      rows={3}
                      className="w-full bg-sp-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:border-orange-500/40 transition-colors resize-none"
                    />
                  </div>

                  {/* Time settings */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Hour</label>
                      <select
                        value={newSchedule.local_hour}
                        onChange={e => setNewSchedule(p => ({ ...p, local_hour: parseInt(e.target.value) }))}
                        className="w-full bg-sp-black border border-white/10 text-white text-sm px-2 py-2 rounded-lg"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Timezone</label>
                      <select
                        value={newSchedule.timezone_label}
                        onChange={e => {
                          const tz = TIMEZONES.find(t => t.label === e.target.value);
                          setNewSchedule(p => ({ ...p, timezone_label: e.target.value, timezone_offset: tz?.offset || 0 }));
                        }}
                        className="w-full bg-sp-black border border-white/10 text-white text-sm px-2 py-2 rounded-lg"
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz.label} value={tz.label}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-1 block">Frequency</label>
                      <select
                        value={newSchedule.schedule_type}
                        onChange={e => setNewSchedule(p => ({ ...p, schedule_type: e.target.value }))}
                        className="w-full bg-sp-black border border-white/10 text-white text-sm px-2 py-2 rounded-lg"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="weekends">Weekends</option>
                      </select>
                    </div>
                  </div>

                  {scheduleError && <p className="text-xs text-red-400">{scheduleError}</p>}

                  <button
                    onClick={createSchedule}
                    disabled={creatingSchedule || !newSchedule.name || !newSchedule.prompt}
                    className="w-full btn-orange py-2.5 rounded-lg text-sm disabled:opacity-50"
                  >
                    {creatingSchedule ? 'Creating...' : 'Create Schedule'}
                  </button>
                </div>
              )}

              {/* Schedules list */}
              {loadingSchedules ? (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-3">
                    <RefreshCw className="w-5 h-5 text-orange-500/50" />
                  </div>
                  <p className="text-gray-500 text-xs">No scheduled tasks yet</p>
                  <p className="text-gray-700 text-[10px] mt-1">Create one to get recurring briefings via Telegram!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map(task => (
                    <div key={task.id} className="p-3 rounded-xl bg-white/3 border border-white/8">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium truncate">{task.name}</p>
                            {task.active ? (
                              <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">ACTIVE</span>
                            ) : (
                              <span className="text-[9px] bg-gray-500/20 text-gray-500 px-1.5 py-0.5 rounded font-bold">PAUSED</span>
                            )}
                          </div>
                          <p className="text-gray-600 text-[10px] mt-0.5 flex items-center gap-2">
                            <span>{task.schedule_type} at {String(task.local_hour).padStart(2, '0')}:{String(task.minute || 0).padStart(2, '0')} {task.timezone_label}</span>
                            {task.run_count > 0 && <span>· {task.run_count} runs</span>}
                          </p>
                          <p className="text-gray-700 text-[10px] mt-1 truncate">{task.prompt}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleSchedule(task.id, !task.active)}
                            className={`px-2 py-1 text-[10px] rounded border transition-colors ${task.active ? 'text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10' : 'text-green-400 border-green-500/30 hover:bg-green-500/10'}`}
                          >
                            {task.active ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => deleteSchedule(task.id)}
                            className="px-2 py-1 text-[10px] text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-white/5">
                <p className="text-[10px] text-gray-700">
                  💡 You can also manage schedules via Telegram: <code className="bg-white/10 px-1 rounded">/schedule</code> to create, <code className="bg-white/10 px-1 rounded">/schedule list</code> to view all.
                </p>
              </div>
            </div>
          )}

          {/* MEMORIES TAB */}
          {activeTab === 'memories' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-500/10 to-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <h4 className="text-white text-sm font-medium mb-1">🧠 Long-Term Memory</h4>
                <p className="text-gray-500 text-xs">
                  Important facts about you that the AI remembers across ALL conversations. Memories are auto-extracted from chats and can also be added manually.
                </p>
                <p className="text-gray-500 text-[10px] mt-2">
                  💡 <span className="text-blue-400">Tip:</span> Say "Remember that..." in chat to instantly save to memory
                </p>
              </div>

              {/* How Memories Work - Expandable Info Panel */}
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/8 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">ℹ️</span>
                    <span className="text-white text-sm font-medium">How do memories work?</span>
                  </div>
                  <span className="text-gray-500 text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-2 p-4 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-white/10 rounded-lg space-y-4">
                  
                  {/* Where Stored */}
                  <div>
                    <h5 className="text-white text-xs font-semibold mb-2">🔒 Where Are Memories Stored?</h5>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Your memories are stored securely in our cloud database, associated only with your account. They are:
                    </p>
                    <ul className="text-gray-500 text-xs mt-2 space-y-1">
                      <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Private - Only accessible to you</li>
                      <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Cloud-synced - Available across all devices</li>
                      <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Deletable - Remove any memory anytime</li>
                      <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Exportable - Download your data (GDPR)</li>
                    </ul>
                  </div>

                  {/* What Gets Saved */}
                  <div>
                    <h5 className="text-white text-xs font-semibold mb-2">📝 What Gets Saved?</h5>
                    <p className="text-gray-400 text-xs mb-2">SoulPrint automatically detects important info you share:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-white/5 rounded">
                        <span className="text-pink-400">Personal</span>
                        <p className="text-gray-600 text-[10px]">Name, birthday, preferences</p>
                      </div>
                      <div className="p-2 bg-white/5 rounded">
                        <span className="text-red-400">Health</span>
                        <p className="text-gray-600 text-[10px]">Allergies, medications</p>
                      </div>
                      <div className="p-2 bg-white/5 rounded">
                        <span className="text-purple-400">Relationships</span>
                        <p className="text-gray-600 text-[10px]">Family, pets, friends</p>
                      </div>
                      <div className="p-2 bg-white/5 rounded">
                        <span className="text-green-400">Work</span>
                        <p className="text-gray-600 text-[10px]">Job, company, projects</p>
                      </div>
                    </div>
                  </div>

                  {/* How Used */}
                  <div>
                    <h5 className="text-white text-xs font-semibold mb-2">✨ How Are Memories Used?</h5>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Your memories personalize every conversation. The AI naturally references them 
                      (e.g., "How's your dog Max?"), prioritizes health/safety info, and adapts to your preferences.
                    </p>
                  </div>

                  {/* Security Note */}
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-blue-400 text-[10px]">
                      🔐 <strong>Security:</strong> Memories are encrypted in transit and at rest. We never sell or share your personal data. 
                      You can delete all memories or your entire account at any time from Privacy settings.
                    </p>
                  </div>
                </div>
              </details>

              {/* Add Memory Form */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="Add a fact about yourself... (e.g., 'I am allergic to peanuts')"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500/40 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                  />
                  <button onClick={addMemory} disabled={!newMemory.trim()} className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors disabled:opacity-50">
                    Add
                  </button>
                </div>
                <select
                  value={newMemoryCategory}
                  onChange={(e) => setNewMemoryCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-400 text-xs"
                >
                  {memoryCategories.map(cat => (
                    <option key={cat} value={cat}>Category: {cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Memory Status & Refresh */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {memoriesLoading ? (
                    <div className="flex items-center gap-2 text-blue-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading memories...
                    </div>
                  ) : memoriesLoaded ? (
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${memories.length > 0 ? 'bg-green-500' : 'bg-orange-500'}`} />
                      <span className="text-gray-400 text-xs">
                        {memories.length > 0 
                          ? `${memories.length} memories stored` 
                          : 'No memories yet'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-600 text-xs">Click to load memories</span>
                  )}
                </div>
                <button 
                  onClick={loadMemories} 
                  disabled={memoriesLoading}
                  className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-500 hover:text-white text-xs transition-colors disabled:opacity-50"
                >
                  {memoriesLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh
                </button>
              </div>

              {/* Memories List */}
              {memoriesLoaded && memories.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {memories.map(mem => (
                    <div key={mem.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                      mem.category === 'health' ? 'bg-red-500/5 border-red-500/20' :
                      mem.category === 'preferences' ? 'bg-blue-500/5 border-blue-500/20' :
                      mem.category === 'relationships' ? 'bg-pink-500/5 border-pink-500/20' :
                      mem.category === 'work' ? 'bg-green-500/5 border-green-500/20' :
                      'bg-white/5 border-white/10'
                    }`}>
                      <div className="flex-1">
                        <p className="text-white text-sm">{mem.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            mem.category === 'health' ? 'bg-red-500/20 text-red-400' :
                            mem.category === 'preferences' ? 'bg-blue-500/20 text-blue-400' :
                            mem.category === 'relationships' ? 'bg-pink-500/20 text-pink-400' :
                            mem.category === 'work' ? 'bg-green-500/20 text-green-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {mem.category}
                          </span>
                          <span className="text-gray-600 text-[10px]">{mem.source === 'auto' ? '🤖 Auto' : '✍️ Manual'}</span>
                          {mem.importance === 'high' && <span className="text-orange-400 text-[10px]">⚠️ Important</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteMemory(mem.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : memoriesLoaded ? (
                <div className="text-center py-6 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                  <div className="text-3xl mb-2">🧠</div>
                  <p className="text-gray-400 text-sm mb-1">No memories stored yet</p>
                  <p className="text-gray-600 text-xs">Chat with the AI and important facts will be automatically remembered, or add them manually above.</p>
                </div>
              ) : (
                <div className="text-center py-6 bg-white/5 border border-white/10 rounded-xl">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Loading your memories...</p>
                </div>
              )}
            </div>
          )}

          {/* INVITES TAB */}
          {activeTab === 'invites' && (
            <div className="space-y-5">
              {invitesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 text-orange-400 animate-spin mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Loading your invites...</p>
                </div>
              ) : !invitesData?.enabled ? (
                <div className="text-center py-8 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-3xl mb-3 block">🔒</span>
                  <h4 className="text-white text-sm font-medium mb-2">Invites Coming Soon</h4>
                  <p className="text-gray-500 text-xs">The invite system is not currently active.</p>
                </div>
              ) : (
                <>
                  {/* Invite Stats */}
                  <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white text-sm font-medium">🎁 Invite Friends to SoulPrint</h4>
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/20 rounded-lg">
                        <span className="text-orange-400 text-xs font-bold">{invitesData?.invites_remaining ?? 0}</span>
                        <span className="text-orange-400/70 text-[10px]">left</span>
                      </div>
                    </div>
                    <p className="text-gray-400 text-xs">
                      Share your unique invite link with friends. They'll get instant access, and you'll earn badges!
                    </p>
                  </div>

                  {/* Invite Code & Link */}
                  <div className="bg-[#0d1117] border border-white/10 rounded-xl p-4 space-y-3">
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Your Invite Code</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-orange-400 font-mono text-lg tracking-wider text-center">
                          {invitesData?.invite_code || '--------'}
                        </code>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Shareable Link</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={invitesData?.invite_code && typeof window !== 'undefined' ? `${window.location.origin}/invite/${invitesData.invite_code}` : ''}
                          className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm truncate"
                        />
                        <button
                          onClick={copyInviteLink}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                            inviteLinkCopied 
                              ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
                              : 'bg-orange-500 hover:bg-orange-600 text-white'
                          }`}
                        >
                          {inviteLinkCopied ? (
                            <><Check className="w-4 h-4" /> Copied!</>
                          ) : (
                            <><Copy className="w-4 h-4" /> Copy</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  {invitesData?.all_badges?.length > 0 && (
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-3 block">Invite Badges</label>
                      <div className="grid grid-cols-2 gap-2">
                        {invitesData.all_badges.map(badge => {
                          const earned = invitesData.badges?.some(b => b.id === badge.id);
                          return (
                            <div 
                              key={badge.id}
                              className={`p-3 rounded-xl border ${
                                earned 
                                  ? 'bg-orange-500/10 border-orange-500/30' 
                                  : 'bg-white/3 border-white/10 opacity-50'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{badge.icon}</span>
                                <span className={`text-xs font-medium ${earned ? 'text-orange-400' : 'text-gray-500'}`}>
                                  {badge.name}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-500">{badge.description}</p>
                              {!earned && (
                                <p className="text-[9px] text-gray-600 mt-1">Invite {badge.threshold} friend{badge.threshold > 1 ? 's' : ''} to unlock</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Invited Users */}
                  {invitesData?.invited_users?.length > 0 && (
                    <div>
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-3 block">
                        Friends You've Invited ({invitesData.invites_used || 0})
                      </label>
                      <div className="space-y-2">
                        {invitesData.invited_users.map((user, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{user.email}</p>
                              <p className="text-gray-500 text-[10px]">
                                Joined {new Date(user.joined_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Who invited you */}
                  {invitesData?.invited_by && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                      <p className="text-purple-400 text-xs">
                        <span className="text-purple-300 font-medium">{invitesData.invited_by.name}</span> invited you to SoulPrint ✨
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ANNOUNCEMENTS TAB */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4">
                <h4 className="text-white text-sm font-medium mb-1">📢 Announcements</h4>
                <p className="text-gray-500 text-xs">
                  View all announcements, including ones you've dismissed. Restore any announcement to see it again.
                </p>
              </div>

              <button 
                onClick={loadAllAnnouncements}
                className="w-full py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-2"
              >
                {announcementsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Load Announcements
                  </>
                )}
              </button>

              {allAnnouncements.length > 0 ? (
                <div className="space-y-3">
                  {allAnnouncements.map(ann => (
                    <div 
                      key={ann.id}
                      className={`p-4 rounded-xl border ${
                        ann.permanently_dismissed 
                          ? 'bg-red-500/5 border-red-500/20 opacity-60' 
                          : ann.temporarily_dismissed 
                            ? 'bg-yellow-500/5 border-yellow-500/20 opacity-80'
                            : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-white text-sm font-medium">{ann.title}</h4>
                            {ann.permanently_dismissed && (
                              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] rounded">Dismissed Forever</span>
                            )}
                            {ann.temporarily_dismissed && !ann.permanently_dismissed && (
                              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[9px] rounded">Hidden 24h</span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs">{ann.content}</p>
                          {ann.link && (
                            <a href={ann.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline mt-1 inline-flex items-center gap-1">
                              View link <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <p className="text-gray-600 text-[10px] mt-2">
                            Posted: {new Date(ann.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {(ann.permanently_dismissed || ann.temporarily_dismissed) && (
                          <button
                            onClick={() => restoreAnnouncement(ann.id)}
                            className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg hover:bg-green-500/30 transition-colors flex-shrink-0"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-xs text-center py-4">
                  {announcementsLoading ? 'Loading...' : 'Click "Load Announcements" to view all announcements.'}
                </p>
              )}
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {profile && (
                <>
                  {/* Assistant Name - Editable */}
                  <div>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">Assistant Name</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingAssistantName ?? (profile.assistant_name || 'SoulPrint')}
                        onChange={e => setEditingAssistantName(e.target.value)}
                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                        placeholder="Name your AI assistant"
                      />
                      {editingAssistantName !== null && editingAssistantName !== profile.assistant_name && (
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/user/profile', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ assistant_name: editingAssistantName })
                              });
                              setProfile(p => ({ ...p, assistant_name: editingAssistantName }));
                              onAssistantNameChange?.(editingAssistantName);
                              setEditingAssistantName(null);
                              alert('Assistant name updated!');
                            } catch (e) {
                              alert('Failed to update');
                            }
                          }}
                          className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Save
                        </button>
                      )}
                    </div>
                    <p className="text-gray-600 text-[10px] mt-1">This is what you'll call your AI companion</p>
                  </div>

                  {/* Display Name (Your Name) - Editable */}
                  <div>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">Your Name</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingDisplayName ?? (profile.display_name || '')}
                        onChange={e => setEditingDisplayName(e.target.value)}
                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
                        placeholder="What should the AI call you?"
                      />
                      {editingDisplayName !== null && editingDisplayName !== profile.display_name && (
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/user/profile', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ display_name: editingDisplayName })
                              });
                              setProfile(p => ({ ...p, display_name: editingDisplayName }));
                              setEditingDisplayName(null);
                              alert('Your name has been updated! The AI will now call you ' + editingDisplayName);
                            } catch (e) {
                              alert('Failed to update');
                            }
                          }}
                          className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Save
                        </button>
                      )}
                    </div>
                    <p className="text-gray-600 text-[10px] mt-1">The AI will address you by this name</p>
                  </div>

                  {/* Custom Greeting - Editable */}
                  <div>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">AI Greeting</p>
                    
                    {/* Toggle for AI Greeting */}
                    <div className="flex items-center justify-between p-3 bg-white/3 border border-white/8 rounded-xl mb-3">
                      <div>
                        <p className="text-white text-sm font-medium">Show AI Greeting</p>
                        <p className="text-gray-500 text-[10px]">Display a welcome message when starting a new conversation</p>
                      </div>
                      <button
                        onClick={async () => {
                          const newVal = !(profile.ai_greeting_enabled !== false);
                          try {
                            await fetch('/api/user/profile', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ ai_greeting_enabled: newVal })
                            });
                            setProfile(p => ({ ...p, ai_greeting_enabled: newVal }));
                          } catch (e) {
                            console.error('Failed to toggle greeting:', e);
                          }
                        }}
                        className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${(profile.ai_greeting_enabled !== false) ? 'bg-orange-500' : 'bg-gray-600'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-0.5 ${(profile.ai_greeting_enabled !== false) ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Custom Greeting Text */}
                    {(profile.ai_greeting_enabled !== false) && (
                      <div className="space-y-2">
                        <p className="text-gray-500 text-[10px] font-semibold uppercase">Custom Greeting Message</p>
                        <textarea
                          value={editingCustomGreeting ?? (profile.custom_greeting || '')}
                          onChange={e => setEditingCustomGreeting(e.target.value)}
                          className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none resize-none"
                          placeholder="Hey {name} 👋 I'm {assistant}! Ready to help you today."
                          rows={3}
                        />
                        {editingCustomGreeting !== null && editingCustomGreeting !== (profile.custom_greeting || '') && (
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await fetch('/api/user/profile', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ custom_greeting: editingCustomGreeting })
                                  });
                                  setProfile(p => ({ ...p, custom_greeting: editingCustomGreeting }));
                                  setEditingCustomGreeting(null);
                                  alert('Greeting saved! Start a new conversation to see it.');
                                } catch (e) {
                                  alert('Failed to update');
                                }
                              }}
                              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              Save Greeting
                            </button>
                            <button
                              onClick={() => setEditingCustomGreeting(null)}
                              className="px-3 py-1.5 bg-white/5 text-gray-400 text-xs rounded-lg hover:bg-white/10"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        <p className="text-gray-600 text-[10px] mt-1">
                          Use <code className="bg-white/10 px-1 rounded">{'{name}'}</code> for your name and <code className="bg-white/10 px-1 rounded">{'{assistant}'}</code> for the AI name. Leave blank for default.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Other profile fields (read-only) */}
                  {[
                    ['Field', profile.field],
                    ['Role', profile.descriptors?.join(', ')],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">{label}</p>
                      <p className="text-white text-sm">{val || '—'}</p>
                    </div>
                  ))}
                  {profile.help_with?.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Help With</p>
                      <div className="flex flex-wrap gap-1">
                        {profile.help_with.map(h => (
                          <span key={h} className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Soul Profile Section */}
              {soulProfile && (
                <div className="pt-5 border-t border-white/10">
                  <h3 className="text-white text-sm font-semibold mb-3">🧠 Soul Profile</h3>
                  
                  {soulProfile.latestSummary && (
                    <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-blue-500/10 border border-blue-500/20 mb-4">
                      <p className="text-gray-300 text-xs leading-relaxed">{soulProfile.latestSummary}</p>
                    </div>
                  )}
                  
                  {/* Communication Style */}
                  {soulProfile.communicationStyle && Object.keys(soulProfile.communicationStyle).length > 0 && (
                    <div className="mb-4">
                      <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">💬 Communication Style</p>
                      {Object.entries(soulProfile.communicationStyle).map(([source, style]) => style && (
                        <div key={source} className="text-xs text-gray-400 mb-2">
                          <span className="text-white capitalize">{source}:</span> {style.formality || 'mixed'} formality, {style.verbosity || 'balanced'} verbosity, {style.tone || 'neutral'} tone
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Interests */}
                  {soulProfile.interests?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">🎯 Topics of Interest</p>
                      <div className="flex flex-wrap gap-1">
                        {soulProfile.interests.slice(0, 10).map(i => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">{i}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Insights */}
                  {soulProfile.insights?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">✨ Personality Insights</p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        {soulProfile.insights.slice(0, 5).map((ins, i) => (
                          <li key={i}>• {ins}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Export Profile Section */}
              <div className="pt-5 border-t border-white/10">
                <h3 className="text-white text-sm font-semibold mb-2">📤 Export Profile</h3>
                <p className="text-gray-500 text-xs mb-4">
                  Download your complete SoulPrint profile as a markdown file. This includes your assessment answers, communication style, and personality insights.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/user/profile/export', { headers: { Authorization: `Bearer ${token}` } });
                      const data = await res.json();
                      if (data.markdown) {
                        const blob = new Blob([data.markdown], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = data.filename || 'soulprint-profile.md';
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    } catch (e) {
                      console.error('Export error:', e);
                    }
                  }}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-500/20 to-blue-500/20 border border-blue-500/30 rounded-lg text-white text-sm hover:from-blue-500/30 hover:to-blue-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Profile (Markdown)
                </button>
                <p className="text-gray-700 text-[10px] mt-2 text-center">Same profile powers both web & Telegram</p>
              </div>

              {/* Retake Assessment Section */}
              <div className="pt-5 border-t border-white/10">
                <h3 className="text-white text-sm font-semibold mb-2">📋 Retake Assessment</h3>
                <p className="text-gray-500 text-xs mb-4">
                  Your SoulPrint personality assessment helps me understand your communication style, preferences, and goals. 
                  You can retake it anytime to update your profile.
                </p>
                <button
                  onClick={() => setShowAssessmentChoice(true)}
                  className="w-full py-2.5 px-4 bg-white/5 border border-white/10 rounded-lg text-white text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake Assessment
                </button>
                <p className="text-gray-700 text-[10px] mt-2 text-center">Your previous answers will be archived</p>
              </div>

              {/* Assessment Choice Modal */}
              {showAssessmentChoice && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                  <div className="bg-[#141a21] border border-white/10 rounded-2xl p-6 max-w-md w-full">
                    <h2 className="text-white font-semibold text-lg mb-2">Choose Assessment Type</h2>
                    <p className="text-gray-500 text-sm mb-6">Your previous answers will be archived. Select which assessment you'd like to take:</p>
                    
                    <div className="space-y-3">
                      {/* Quick Start Option */}
                      <button
                        onClick={() => handleResetAssessment('quick')}
                        className="w-full p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl text-left hover:border-green-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-green-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-medium group-hover:text-green-300 transition-colors">Quick Start</h3>
                            <p className="text-gray-500 text-xs mt-0.5">6 questions now • Full profile over time</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs mt-3">Start chatting quickly. I'll ask the remaining questions naturally during our conversations to build your complete 6-pillar profile.</p>
                      </button>
                      
                      {/* Full Assessment Option */}
                      <button
                        onClick={() => handleResetAssessment('full')}
                        className="w-full p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl text-left hover:border-orange-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-orange-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-medium group-hover:text-orange-300 transition-colors">Full Assessment</h3>
                            <p className="text-gray-500 text-xs mt-0.5">36 questions • ~10 minutes</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs mt-3">Complete all 6 pillars now for the most accurate profile from the start.</p>
                      </button>
                    </div>
                    
                    <button
                      onClick={() => setShowAssessmentChoice(false)}
                      className="w-full mt-4 py-2 text-gray-500 hover:text-white text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Install App Section */}
              <div className="pt-5 border-t border-white/10">
                <h3 className="text-white text-sm font-semibold mb-2">📱 Install App</h3>
                <p className="text-gray-500 text-xs mb-4">
                  Install SoulPrint on your device for quick access and a full-screen experience without browser UI.
                </p>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <p className="text-xs text-orange-300 font-medium mb-2">🖥️ Desktop (Chrome/Edge)</p>
                    <p className="text-[10px] text-orange-200/70">
                      Look for the install icon (⊕) in your browser's address bar, or use the browser menu → "Install SoulPrint"
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs text-blue-300 font-medium mb-2">📱 iOS (Safari)</p>
                    <p className="text-[10px] text-blue-200/70">
                      Tap Share → "Add to Home Screen" → "Add"
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-300 font-medium mb-2">📱 Android (Chrome)</p>
                    <p className="text-[10px] text-green-200/70">
                      Tap the menu (⋮) → "Install app" or "Add to Home screen"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRIVACY TAB */}
          {activeTab === 'privacy' && (
            <PrivacyTab token={token} />
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <AppearanceTab />
          )}

          {/* FEEDBACK TAB */}
          {activeTab === 'feedback' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-white text-sm font-semibold mb-1">💬 Share Your Feedback</h3>
                <p className="text-gray-500 text-xs mb-4">Help us improve SoulPrint! Your feedback is invaluable.</p>
              </div>

              {/* Quick feedback buttons */}
              <div className="space-y-3">
                <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">How's your experience?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFeedbackType('love')}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${feedbackType === 'love' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/5'}`}
                  >
                    <span className="text-lg">😍</span>
                    <p className="text-[10px] mt-1">Love it!</p>
                  </button>
                  <button 
                    onClick={() => setFeedbackType('good')}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${feedbackType === 'good' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/5'}`}
                  >
                    <span className="text-lg">👍</span>
                    <p className="text-[10px] mt-1">It's good</p>
                  </button>
                  <button 
                    onClick={() => setFeedbackType('issue')}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${feedbackType === 'issue' ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/5'}`}
                  >
                    <span className="text-lg">🐛</span>
                    <p className="text-[10px] mt-1">Found issue</p>
                  </button>
                  <button 
                    onClick={() => setFeedbackType('idea')}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${feedbackType === 'idea' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/5'}`}
                  >
                    <span className="text-lg">💡</span>
                    <p className="text-[10px] mt-1">Have idea</p>
                  </button>
                </div>
              </div>

              {/* Feedback text area */}
              <div>
                <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Your feedback</label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={feedbackType === 'issue' ? "Describe the issue you encountered..." : feedbackType === 'idea' ? "Tell us your idea..." : "Share your thoughts..."}
                  className="w-full h-28 bg-sp-black border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-600 resize-none focus:border-orange-500/40 focus:outline-none"
                />
              </div>

              {/* Screenshot attachment */}
              <div>
                <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Screenshot (optional)</label>
                <input 
                  type="file" 
                  ref={feedbackFileRef} 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      alert('Only image files are allowed');
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      alert('File size must be less than 5MB');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const base64 = ev.target.result.split(',')[1];
                      setFeedbackAttachment({
                        name: file.name,
                        mimeType: file.type,
                        base64,
                        preview: ev.target.result,
                      });
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                {feedbackAttachment ? (
                  <div className="relative inline-block">
                    <img 
                      src={feedbackAttachment.preview} 
                      alt="Screenshot" 
                      className="w-24 h-20 object-cover rounded-xl border-2 border-orange-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setFeedbackAttachment(null)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <p className="text-[10px] text-gray-500 mt-1 truncate max-w-[96px]">{feedbackAttachment.name}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => feedbackFileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-dashed border-white/20 rounded-xl text-gray-400 hover:bg-white/10 hover:border-white/30 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-xs">Attach screenshot</span>
                  </button>
                )}
              </div>

              {/* Submit button */}
              <button
                onClick={async () => {
                  if (!feedbackText.trim()) return;
                  setFeedbackSubmitting(true);
                  try {
                    const payload = { 
                      category: feedbackType === 'issue' ? 'bug' : feedbackType === 'idea' ? 'feature' : 'general',
                      message: feedbackText,
                      rating: feedbackType === 'love' ? 5 : feedbackType === 'good' ? 4 : null
                    };
                    
                    // Include attachment if present
                    if (feedbackAttachment) {
                      payload.attachment = {
                        name: feedbackAttachment.name,
                        mimeType: feedbackAttachment.mimeType,
                        base64: feedbackAttachment.base64,
                      };
                    }
                    
                    await fetch('/api/user-feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify(payload),
                    });
                    setFeedbackText('');
                    setFeedbackType('');
                    setFeedbackAttachment(null);
                    setFeedbackSubmitted(true);
                    setTimeout(() => setFeedbackSubmitted(false), 3000);
                  } catch (e) {
                    console.error('Feedback error:', e);
                  }
                  setFeedbackSubmitting(false);
                }}
                disabled={!feedbackText.trim() || feedbackSubmitting}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {feedbackSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : feedbackSubmitted ? (
                  <><ThumbsUp className="w-4 h-4" /> Thank you!</>
                ) : (
                  <><Send className="w-4 h-4" /> Send Feedback</>
                )}
              </button>

              {/* Contact options */}
              <div className="pt-4 border-t border-white/10">
                <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-3">Other ways to reach us</p>
                <div className="space-y-2">
                  <a href="mailto:team@archeforge.com" className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <span className="text-sm">📧</span>
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">Email</p>
                      <p className="text-gray-600 text-[10px]">team@archeforge.com</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Legal Links Footer */}
          <div className="mt-6 pt-4 border-t border-white/10">
            {/* Logout Button */}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to log out?')) {
                  localStorage.removeItem('sp_token');
                  localStorage.removeItem('sp_user');
                  window.location.href = '/auth';
                }
              }}
              className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
            
            <div className="flex items-center justify-center gap-4">
              <Link href="/terms" className="text-gray-500 text-xs hover:text-orange-500 transition-colors">
                Terms of Service
              </Link>
              <span className="text-gray-700">•</span>
              <Link href="/privacy" className="text-gray-500 text-xs hover:text-orange-500 transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Attachment preview pill

export { SettingsModal, FeedbackModal };
