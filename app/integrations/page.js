'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, Mail, Calendar, FolderOpen, Check, X, Loader2, 
  ExternalLink, Shield, RefreshCw, Unplug, ChevronRight,
  Inbox, CalendarDays, FileText, Send, Plus, Search
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(null);
  const [googleStatus, setGoogleStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Gmail state
  const [emails, setEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  
  // Calendar state
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // Drive state
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState('overview');

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
    
    if (googleParam === 'connected') {
      setNotification({ type: 'success', message: 'Google account connected successfully!' });
      // Clear URL params
      window.history.replaceState({}, '', '/integrations');
    } else if (errorParam) {
      setNotification({ type: 'error', message: `Connection failed: ${errorParam}` });
      window.history.replaceState({}, '', '/integrations');
    }
    
    fetchGoogleStatus(t);
  }, []);

  const fetchGoogleStatus = async (t) => {
    try {
      const res = await fetch('/api/google/status', {
        headers: { Authorization: `Bearer ${t}` }
      });
      const data = await res.json();
      setGoogleStatus(data);
    } catch (err) {
      console.error('Failed to fetch Google status:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectGoogle = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setNotification({ type: 'error', message: 'Failed to get auth URL' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setConnecting(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) return;
    
    setDisconnecting(true);
    try {
      await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setGoogleStatus({ connected: false });
      setEmails([]);
      setEvents([]);
      setFiles([]);
      setNotification({ type: 'success', message: 'Google account disconnected' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  const fetchEmails = async () => {
    setLoadingEmails(true);
    try {
      const res = await fetch('/api/google/gmail/messages?maxResults=10', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setEmails(data.messages || []);
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch('/api/google/calendar/events?maxResults=10', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/google/drive/files?pageSize=10', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (googleStatus?.connected && activeTab !== 'overview') {
      if (activeTab === 'gmail') fetchEmails();
      if (activeTab === 'calendar') fetchEvents();
      if (activeTab === 'drive') fetchFiles();
    }
  }, [activeTab, googleStatus?.connected]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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
        <div className={`max-w-6xl mx-auto px-4 pt-4`}>
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

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Google Integration Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {/* Google Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                  <GoogleIcon />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Google Workspace</h2>
                  <p className="text-sm text-gray-400">Gmail, Calendar, Drive</p>
                </div>
              </div>
              
              {googleStatus?.connected ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-full">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">Connected</span>
                  </div>
                  <button
                    onClick={disconnectGoogle}
                    disabled={disconnecting}
                    className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                    title="Disconnect"
                  >
                    {disconnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unplug className="w-5 h-5" />}
                  </button>
                </div>
              ) : (
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
                      Connect Google
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Connected Account Info */}
          {googleStatus?.connected && (
            <div className="p-4 bg-white/5 border-b border-white/10">
              <div className="flex items-center gap-3">
                {googleStatus.picture && (
                  <img src={googleStatus.picture} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div>
                  <p className="font-medium">{googleStatus.name}</p>
                  <p className="text-sm text-gray-400">{googleStatus.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Service Tabs */}
          {googleStatus?.connected && (
            <>
              <div className="flex border-b border-white/10">
                {[
                  { id: 'overview', label: 'Overview', icon: Shield },
                  { id: 'gmail', label: 'Gmail', icon: Mail },
                  { id: 'calendar', label: 'Calendar', icon: Calendar },
                  { id: 'drive', label: 'Drive', icon: FolderOpen },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 transition-colors ${
                      activeTab === tab.id
                        ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold mb-4">Connected Services</h3>
                    <div className="grid gap-3">
                      {[
                        { name: 'Gmail', desc: 'Read and send emails', icon: Mail, enabled: googleStatus.services?.gmail },
                        { name: 'Calendar', desc: 'View and create events', icon: Calendar, enabled: googleStatus.services?.calendar },
                        { name: 'Drive', desc: 'Access and search files', icon: FolderOpen, enabled: googleStatus.services?.drive },
                      ].map((service) => (
                        <div key={service.name} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${service.enabled ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                              <service.icon className={`w-5 h-5 ${service.enabled ? 'text-green-400' : 'text-gray-400'}`} />
                            </div>
                            <div>
                              <p className="font-medium">{service.name}</p>
                              <p className="text-sm text-gray-400">{service.desc}</p>
                            </div>
                          </div>
                          {service.enabled ? (
                            <Check className="w-5 h-5 text-green-400" />
                          ) : (
                            <X className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="text-sm text-blue-400">
                        <Shield className="w-4 h-4 inline mr-2" />
                        Your data is encrypted and never shared. You can disconnect at any time.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'gmail' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Recent Emails</h3>
                      <button
                        onClick={fetchEmails}
                        disabled={loadingEmails}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingEmails ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                    
                    {loadingEmails ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                      </div>
                    ) : emails.length > 0 ? (
                      <div className="space-y-2">
                        {emails.map((email) => (
                          <div key={email.id} className="p-4 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{email.subject}</p>
                                <p className="text-sm text-gray-400 truncate">{email.from}</p>
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{email.snippet}</p>
                              </div>
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {email.date ? new Date(email.date).toLocaleDateString() : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No emails found</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'calendar' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Upcoming Events</h3>
                      <button
                        onClick={fetchEvents}
                        disabled={loadingEvents}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingEvents ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                    
                    {loadingEvents ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                      </div>
                    ) : events.length > 0 ? (
                      <div className="space-y-2">
                        {events.map((event) => (
                          <div key={event.id} className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                            <div className="flex items-start gap-4">
                              <div className="p-2 bg-orange-500/20 rounded-lg">
                                <CalendarDays className="w-5 h-5 text-orange-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{event.summary}</p>
                                {event.location && (
                                  <p className="text-sm text-gray-400">{event.location}</p>
                                )}
                                <p className="text-sm text-gray-500 mt-1">
                                  {event.start ? new Date(event.start).toLocaleString() : 'All day'}
                                </p>
                              </div>
                              {event.htmlLink && (
                                <a
                                  href={event.htmlLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4 text-gray-400" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No upcoming events</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'drive' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Recent Files</h3>
                      <button
                        onClick={fetchFiles}
                        disabled={loadingFiles}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                    
                    {loadingFiles ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                      </div>
                    ) : files.length > 0 ? (
                      <div className="space-y-2">
                        {files.map((file) => (
                          <div key={file.id} className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-blue-500/20 rounded-lg">
                                <FileText className="w-5 h-5 text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{file.name}</p>
                                <p className="text-sm text-gray-500">
                                  {file.modifiedTime ? `Modified ${new Date(file.modifiedTime).toLocaleDateString()}` : ''}
                                  {file.size && ` • ${(file.size / 1024).toFixed(1)} KB`}
                                </p>
                              </div>
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4 text-gray-400" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No files found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Not Connected State */}
          {!googleStatus?.connected && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <GoogleIcon />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect your Google account</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Access your Gmail, Calendar, and Drive directly from SoulPrint. 
                Ask your AI assistant to check emails, schedule events, or find files.
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-6">
                {[
                  { icon: Mail, label: 'Read & send emails' },
                  { icon: Calendar, label: 'Manage calendar' },
                  { icon: FolderOpen, label: 'Search Drive files' },
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-sm">
                    <feature.icon className="w-4 h-4 text-orange-400" />
                    <span className="text-gray-300">{feature.label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={connectGoogle}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {connecting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <GoogleIcon />
                    Connect with Google
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Future Integrations */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Coming Soon</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Notion', desc: 'Sync notes and databases', color: 'bg-white' },
              { name: 'Slack', desc: 'Access messages and channels', color: 'bg-purple-500' },
              { name: 'Microsoft 365', desc: 'Outlook, OneDrive, Teams', color: 'bg-blue-500' },
            ].map((integration) => (
              <div key={integration.name} className="p-4 bg-white/5 border border-white/10 rounded-xl opacity-60">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${integration.color} rounded-lg`} />
                  <div>
                    <p className="font-medium">{integration.name}</p>
                    <p className="text-sm text-gray-400">{integration.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
