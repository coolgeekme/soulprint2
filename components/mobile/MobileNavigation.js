'use client';
import { MessageSquare, User, Globe, ChevronDown, Home, AudioWaveform, GalleryHorizontal, MoreHorizontal, ExternalLink } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

const TabBar = ({ activeTab, onTabChange, assistantName, unreadCount = 0 }) => {
  const tabs = [
    { id: 'chat', icon: null, useLogo: true, label: assistantName || 'Chat' },
    { id: 'history', icon: MessageSquare, label: 'History', badge: unreadCount },
    { id: 'home', icon: Home, label: 'Website', isExternal: true },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  const handleTabClick = (tab) => {
    if (tab.isExternal) {
      window.location.href = '/';
    } else {
      onTabChange(tab.id);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-sp-black/95 backdrop-blur-xl border-t border-white/10 safe-area-bottom z-50">
      <div className="flex items-center justify-around py-2 px-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={`flex flex-col items-center py-2 px-4 rounded-2xl transition-all duration-300 ${
                isActive ? 'bg-orange-500/15' : 'hover:bg-white/5'
              }`}
            >
              <div className="relative">
                {tab.useLogo ? (
                  <SoulPrintLogo size={24} className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-50'}`} />
                ) : (
                  <Icon className={`w-6 h-6 transition-colors ${isActive ? 'text-orange-400' : 'text-gray-500'}`} />
                )}
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
                {tab.isExternal && (
                  <ExternalLink className="absolute -top-1 -right-1 w-3 h-3 text-gray-500" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium transition-colors ${isActive ? 'text-orange-400' : 'text-gray-600'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Chat Header with web search toggle
const ChatHeader = ({ assistantName, model, onModelClick, isOnline, webSearchEnabled, onToggleWebSearch, onMoreClick, inviteData, onInviteClick }) => (
  <div className="fixed top-0 left-0 right-0 z-40 safe-area-top">
    <div className="bg-gradient-to-b from-background via-background/95 to-transparent pb-8 pt-2">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <SoulPrintLogo size={36} />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
          </div>
          <div className="min-w-0">
            <h1 className="text-foreground font-semibold text-lg truncate max-w-[58vw]">{assistantName}</h1>
            <button 
              onClick={onModelClick}
              className="text-muted-foreground text-xs flex items-center gap-1 hover:text-orange-400 transition-colors"
            >
              {model} <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Invite Button - Only shown if viral invites enabled */}
          {inviteData?.enabled && inviteData?.invites_remaining > 0 && (
            <button 
              onClick={onInviteClick}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
            >
              <span className="text-sm">🎟️</span>
              <span>{inviteData.invites_remaining}</span>
            </button>
          )}
          {/* Web Search Toggle - REMOVED (always on) */}
          <button onClick={onMoreClick} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Message Bubble with actions

export { TabBar, ChatHeader };
