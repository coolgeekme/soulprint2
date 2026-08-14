'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, Mail, Calendar, FolderOpen, Check, X, Loader2, 
  ExternalLink, Shield, RefreshCw, Unplug, ChevronRight, ChevronDown,
  Inbox, CalendarDays, FileText, Send, Plus, Search, Star, Settings
} from 'lucide-react';
import Link from 'next/link';

// Google Icon SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function IntegrationsPage() {
  return <Suspense fallback={null}><IntegrationsPageInner /></Suspense>;
}

function IntegrationsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(null);
  const [googleStatus, setGoogleStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const [notification, setNotification] = useState(null);
  const [expandedAccount, setExpandedAccount] = useState(null);
  const [savingCalendars, setSavingCalendars] = useState(false);
  // Composio state
  const [composioToolkits, setComposioToolkits] = useState([]);
  const [composioConnections, setComposioConnections] = useState([]);
  const [composioLoading, setComposioLoading] = useState(true);
  const [connectingToolkit, setConnectingToolkit] = useState(null);
  const [disconnectingConn, setDisconnectingConn] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('sp_token');
    if (!t) {
      router.push('/auth');
      return;
    }
    setToken(t);
    
    // Check for callback params
    const googleParam = searchParams.get('google');
    const errorParam = searchParams.get('error');
    const isFirstConnection = searchParams.get('first') === 'true';
    
    if (googleParam === 'success') {
      if (isFirstConnection) {
        // First time connection - set flag for welcome message in chat
        localStorage.setItem('google_just_connected', 'true');
        setNotification({ type: 'success', message: '🎉 Google account connected! See below for what you can do.' });
      } else {
        setNotification({ type: 'success', message: 'Google account connected successfully!' });
      }
      window.history.replaceState({}, '', '/integrations');
    } else if (googleParam === 'connected') {
      setNotification({ type: 'success', message: 'Google account connected successfully!' });
      window.history.replaceState({}, '', '/integrations');
    } else if (errorParam) {
      setNotification({ type: 'error', message: `Connection failed: ${errorParam}` });
      window.history.replaceState({}, '', '/integrations');
    }
    
    fetchGoogleStatus(t);
    fetchComposioData(t);
  }, []);

  // ── Composio data fetching ──────────────────────────────────────────
  const fetchComposioData = async (t) => {
    try {
      const [tkRes, connRes] = await Promise.all([
        fetch('/api/composio/toolkits', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/composio/connections?supported=true&identity=true', { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      const tkData = await tkRes.json();
      const connData = await connRes.json();
      setComposioToolkits(tkData.toolkits || []);
      setComposioConnections(connData.connections || []);
    } catch (e) {
      console.error('Failed to fetch Composio data:', e);
    } finally {
      setComposioLoading(false);
    }
  };

  const handleConnectApp = async (toolkit) => {
    setConnectingToolkit(toolkit);
    try {
      const res = await fetch('/api/composio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toolkit }),
      });
      const data = await res.json();
      if (data.redirectUrl) {
        // Open OAuth flow in new window
        const authWindow = window.open(data.redirectUrl, '_blank', 'width=600,height=700');
        // Poll for completion
        const pollInterval = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(pollInterval);
            // Refresh connections after OAuth window closes
            fetchComposioData(token);
          }
        }, 1000);
        // Also set a timeout to stop polling after 5 min
        setTimeout(() => clearInterval(pollInterval), 300000);
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to get connection link' });
      }
    } catch (e) {
      setNotification({ type: 'error', message: 'Connection failed. Please try again.' });
    } finally {
      setConnectingToolkit(null);
    }
  };

  const handleDisconnectApp = async (connectionId) => {
    setDisconnectingConn(connectionId);
    try {
      const res = await fetch('/api/composio/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json();
      if (data.success) {
        setComposioConnections(prev => prev.filter(c => c.id !== connectionId));
        setNotification({ type: 'success', message: 'App disconnected successfully' });
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to disconnect' });
      }
    } catch (e) {
      setNotification({ type: 'error', message: 'Disconnect failed. Please try again.' });
    } finally {
      setDisconnectingConn(null);
    }
  };

  // Helper: get ALL connections for a toolkit (supports multiple accounts)
  const getConnectionsForToolkit = (toolkitKey) => {
    return composioConnections.filter(c => 
      c.toolkit?.toUpperCase() === toolkitKey?.toUpperCase()
    );
  };

  const fetchGoogleStatus = async (t) => {
    try {
      const res = await fetch('/api/google/status', {
        headers: { Authorization: `Bearer ${t}` }
      });
      const data = await res.json();
      setGoogleStatus(data);
      // Auto-expand first account if there's only one
      if (data.accounts?.length === 1) {
        setExpandedAccount(data.accounts[0].connectionId);
      }
    } catch (err) {
      console.error('Failed to fetch Google status:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectGoogle = async () => {
    setConnecting(true);
    try {
      console.log('[Google Connect] Starting connection with token:', token?.substring(0, 20) + '...');
      const res = await fetch('/api/google/auth/start', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('[Google Connect] Response status:', res.status);
      const data = await res.json();
      console.log('[Google Connect] Response data:', data);
      
      if (res.status === 401) {
        // Token expired or invalid - redirect to login
        setNotification({ type: 'error', message: 'Session expired. Please log in again.' });
        localStorage.removeItem('sp_token');
        setTimeout(() => router.push('/auth'), 1500);
        return;
      }
      
      if (data.authUrl) {
        console.log('[Google Connect] Redirecting to Google...');
        window.location.href = data.authUrl;
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to get auth URL' });
      }
    } catch (err) {
      console.error('[Google Connect] Error:', err);
      setNotification({ type: 'error', message: err.message });
    } finally {
      setConnecting(false);
    }
  };

  const disconnectGoogle = async (connectionId = null) => {
    const confirmMsg = connectionId 
      ? 'Are you sure you want to disconnect this Google account?'
      : 'Are you sure you want to disconnect all Google accounts?';
    if (!confirm(confirmMsg)) return;
    
    setDisconnecting(connectionId || 'all');
    try {
      await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ connectionId })
      });
      await fetchGoogleStatus(token);
      setNotification({ type: 'success', message: 'Google account disconnected' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setDisconnecting(null);
    }
  };

  const setDefaultAccount = async (connectionId) => {
    try {
      await fetch('/api/google/set-default', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ connectionId })
      });
      await fetchGoogleStatus(token);
      setNotification({ type: 'success', message: 'Default account updated' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const toggleCalendar = async (connectionId, calendarId, currentSelected) => {
    const account = googleStatus.accounts.find(a => a.connectionId === connectionId);
    if (!account) return;
    
    const updatedCalendars = account.calendars.map(cal => ({
      id: cal.id,
      selected: cal.id === calendarId ? !currentSelected : cal.selected
    }));
    
    setSavingCalendars(true);
    try {
      await fetch('/api/google/update-calendars', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ connectionId, calendars: updatedCalendars })
      });
      await fetchGoogleStatus(token);
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setSavingCalendars(false);
    }
  };

  const refreshCalendars = async (connectionId) => {
    try {
      await fetch('/api/google/refresh-calendars', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ connectionId })
      });
      await fetchGoogleStatus(token);
      setNotification({ type: 'success', message: 'Calendars refreshed' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const accounts = googleStatus?.accounts || [];
  const hasAccounts = accounts.length > 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/chat" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Integrations</h1>
          </div>
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-lg flex items-center justify-between ${
            notification.type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
          }`}>
            <span className={notification.type === 'success' ? 'text-green-400' : 'text-red-400'}>
              {notification.message}
            </span>
            <button onClick={() => setNotification(null)}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Google Integration Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                  <GoogleIcon />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Google Workspace</h2>
                  <p className="text-sm text-gray-400">
                    {hasAccounts ? `${accounts.length} account${accounts.length > 1 ? 's' : ''} connected` : 'Gmail, Calendar, Drive'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={connectGoogle}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {hasAccounts ? 'Add Account' : 'Connect Google'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Connected Accounts */}
          {hasAccounts && (
            <div className="divide-y divide-white/10">
              {accounts.map((account) => (
                <div key={account.connectionId} className="bg-white/[0.02]">
                  {/* Account Header */}
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedAccount(expandedAccount === account.connectionId ? null : account.connectionId)}
                  >
                    <div className="flex items-center gap-3">
                      {account.picture ? (
                        <img src={account.picture} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                          <Mail className="w-5 h-5 text-orange-400" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{account.name || account.email}</p>
                          {account.isDefault && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">Default</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{account.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!account.isDefault && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDefaultAccount(account.connectionId); }}
                          className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-orange-400 transition-colors"
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); disconnectGoogle(account.connectionId); }}
                        disabled={disconnecting === account.connectionId}
                        className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                        title="Disconnect"
                      >
                        {disconnecting === account.connectionId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Unplug className="w-4 h-4" />
                        )}
                      </button>
                      {expandedAccount === account.connectionId ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Content - Calendar Selection */}
                  {expandedAccount === account.connectionId && (
                    <div className="px-4 pb-4 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-300">Calendars</h4>
                        <button
                          onClick={() => refreshCalendars(account.connectionId)}
                          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Refresh
                        </button>
                      </div>
                      
                      {account.calendars && account.calendars.length > 0 ? (
                        <div className="space-y-2">
                          {account.calendars.map((calendar) => (
                            <label
                              key={calendar.id}
                              className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={calendar.selected}
                                onChange={() => toggleCalendar(account.connectionId, calendar.id, calendar.selected)}
                                disabled={savingCalendars}
                                className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500 bg-transparent"
                              />
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: calendar.backgroundColor || '#4285f4' }}
                              />
                              <span className="flex-1 text-sm">
                                {calendar.summary}
                                {calendar.primary && <span className="text-gray-500 ml-2">(Primary)</span>}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No calendars found. Click refresh to load.</p>
                      )}
                      
                      {/* Services summary */}
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Connected Services</h4>
                        <div className="flex gap-2">
                          {account.services?.gmail && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Gmail</span>
                          )}
                          {account.services?.calendar && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Calendar</span>
                          )}
                          {account.services?.drive && (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">Drive</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* No Accounts State */}
          {!hasAccounts && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <GoogleIcon />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect your Google account</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Access your Gmail, Calendar, and Drive directly from SoulPrint. 
                You can connect multiple accounts (personal, work, etc.)
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-6">
                {[
                  { icon: Mail, label: 'Read & send emails' },
                  { icon: Calendar, label: 'Manage calendars' },
                  { icon: FolderOpen, label: 'Access Drive files' },
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-sm">
                    <feature.icon className="w-4 h-4 text-orange-400" />
                    <span className="text-gray-300">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-sm text-blue-400">
            <Shield className="w-4 h-4 inline mr-2" />
            <strong>Multiple Accounts:</strong> Connect as many Google accounts as you need. The AI will always ask which account to use before taking any action.
          </p>
        </div>

        {/* What You Can Do Section - Show when connected */}
        {hasAccounts && (
          <div className="mt-8 bg-gradient-to-br from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">✨</span> What You Can Do Now
              </h2>
              <p className="text-gray-400 text-sm mt-1">Just ask your AI assistant in natural language</p>
            </div>
            
            <div className="p-6 grid gap-6 md:grid-cols-2">
              {/* Gmail */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <Mail className="w-5 h-5" />
                  <h3 className="font-semibold">Gmail</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Search className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Show me my unread emails"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Search className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Find emails from John about the project"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Send className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Send an email to sarah@example.com saying I'll be late"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Send className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Draft a follow-up email to my last conversation with Mike"</span>
                  </li>
                </ul>
              </div>
              
              {/* Calendar */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-400">
                  <CalendarDays className="w-5 h-5" />
                  <h3 className="font-semibold">Calendar</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Search className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"What's on my calendar today?"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Search className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Am I free tomorrow at 3pm?"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Plus className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Schedule a meeting with the team for Friday at 2pm"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Plus className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Add a reminder for Mom's birthday on March 15th"</span>
                  </li>
                </ul>
              </div>
              
              {/* Drive */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-yellow-400">
                  <FolderOpen className="w-5 h-5" />
                  <h3 className="font-semibold">Google Drive</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Search className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Find my recent documents"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Search className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Search for files named 'budget'"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Create a new Google Doc called 'Meeting Notes'"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <span>"Make a spreadsheet to track my expenses"</span>
                  </li>
                </ul>
              </div>
              
              {/* Pro Tips */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-purple-400">
                  <Star className="w-5 h-5" />
                  <h3 className="font-semibold">Pro Tips</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>AI will always ask for confirmation before sending emails or creating events</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Use natural language - no special commands needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Ask "What can you do with Google?" anytime for a reminder</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="p-4 bg-black/20 border-t border-white/10">
              <Link 
                href="/chat" 
                className="flex items-center justify-center gap-2 w-full py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-medium transition-colors"
              >
                Go to Chat & Try It Out
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Composio App Integrations ──────────────────────────────── */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">App Integrations</h2>
              <p className="text-sm text-gray-400 mt-0.5">Connect your favorite apps to enhance your AI experience</p>
            </div>
            <button
              onClick={() => fetchComposioData(token)}
              className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
            >
              ↻ Refresh
            </button>
          </div>
          
          {composioLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/10 rounded-xl" />
                    <div className="flex-1">
                      <div className="h-4 w-24 bg-white/10 rounded mb-2" />
                      <div className="h-3 w-40 bg-white/5 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {composioToolkits.map((toolkit) => {
                const connections = getConnectionsForToolkit(toolkit.key);
                const activeConns = connections.filter(c => c.status === 'ACTIVE');
                const isConnecting = connectingToolkit === toolkit.key;
                
                return (
                  <div
                    key={toolkit.key}
                    className={`p-4 border rounded-xl transition-all duration-200 ${
                      activeConns.length > 0
                        ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl">
                          {toolkit.icon}
                        </div>
                        <div>
                          <p className="font-medium text-white">{toolkit.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{toolkit.description}</p>
                        </div>
                      </div>
                      {activeConns.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                          {activeConns.length} active
                        </span>
                      )}
                    </div>

                    {/* List each connected account */}
                    {connections.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {connections.map((conn) => {
                          const isActive = conn.status === 'ACTIVE';
                          const isDisconnecting = disconnectingConn === conn.id;
                          const accountEmail = conn.displayName || conn.alias;
                          const accountLabel = accountEmail || `Account ${conn.id.slice(0, 8)}`;
                          
                          return (
                            <div
                              key={conn.id}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                                isActive ? 'bg-green-500/10' : 'bg-yellow-500/10'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-green-400' : 'bg-yellow-400'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className={`truncate font-medium ${isActive ? 'text-green-300' : 'text-yellow-300'}`}>
                                    {accountLabel}
                                  </div>
                                  {isActive && (
                                    <div className="text-[10px] text-gray-500 truncate">
                                      Connected • Last used: Recently
                                    </div>
                                  )}
                                  {!isActive && (
                                    <span className="text-yellow-500/80 text-[10px]">Token expired - reconnect needed</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDisconnectApp(conn.id)}
                                disabled={isDisconnecting}
                                className="text-[11px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50 flex-shrink-0 ml-2"
                              >
                                {isDisconnecting ? '...' : 'Remove'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Connect / Add Another Account button */}
                    <div className="mt-3">
                      <button
                        onClick={() => handleConnectApp(toolkit.key)}
                        disabled={isConnecting}
                        className={`w-full text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-50 font-medium ${
                          activeConns.length > 0
                            ? 'text-purple-300 bg-white/5 hover:bg-white/10 border border-white/10'
                            : 'text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500'
                        }`}
                      >
                        {isConnecting ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Connecting...
                          </span>
                        ) : activeConns.length > 0 ? (
                          '+ Add Another Account'
                        ) : (
                          `Connect ${toolkit.name}`
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <p className="text-[11px] text-gray-500 mt-4 text-center">
            Powered by Composio • Your data stays secure with OAuth 2.0 • You can disconnect any time
          </p>
        </div>
      </main>
    </div>
  );
}
