'use client';
import { useState, useRef, useEffect } from 'react';
import { 
  Settings, ChevronRight, ExternalLink, Share2, Users, Link2, UserPlus, Upload,
  X, Loader2, Film, Download, Trash2, RefreshCw, Image as ImageIcon, Search,
  Edit3, Home, MessageSquare, Video, CreditCard
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { CloudUploadIcon } from '@/components/icons/SoulPrintIcons';
import { ThemeToggle } from './MobileSmallComponents';

const ProfileView = ({ profile, soulPrint, onSettingsClick, isAdmin, onAdminClick, announcements, onAnnouncementsClick, onEditName, inviteData, onInviteClick, onImportClick }) => (
  <div className="min-h-screen bg-sp-black pt-16 pb-24 px-4">
    <div className="text-center mb-8">
      <div className="w-24 h-24 mx-auto bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-full flex items-center justify-center mb-4">
        <SoulPrintLogo size={48} />
      </div>
      <h1 className="text-white text-xl font-semibold">{profile?.display_name || 'Your Profile'}</h1>
      <button 
        onClick={onEditName}
        className="text-orange-400 text-xs mt-1 hover:underline"
      >
        ✏️ Edit name
      </button>
      <p className="text-gray-500 text-sm mt-1">{profile?.email}</p>
      {isAdmin && (
        <span className="inline-block mt-2 px-3 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
          Admin
        </span>
      )}
    </div>

    {/* Import Chat History - Prominent placement */}
    <button 
      onClick={onImportClick}
      className="w-full bg-gradient-to-r from-emerald-500/10 to-green-500/10 hover:from-emerald-500/20 hover:to-green-500/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between transition-colors mb-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Upload className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="text-left">
          <span className="text-white text-sm font-medium block">Import Chat History</span>
          <span className="text-emerald-400/70 text-xs">ChatGPT, WhatsApp, iMessage & more</span>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-emerald-400" />
    </button>

    {/* Viral Invite Section - Only shown if enabled */}
    {inviteData?.enabled && (
      <button 
        onClick={onInviteClick}
        className="w-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between transition-colors mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
            <span className="text-lg">🎟️</span>
          </div>
          <div className="text-left">
            <span className="text-white text-sm font-medium block">Invite Friends</span>
            <span className="text-purple-400 text-xs">{inviteData.invites_remaining} invites remaining</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inviteData.badges?.length > 0 && (
            <div className="flex -space-x-1">
              {inviteData.badges.slice(0, 3).map((badge, i) => (
                <span key={i} className="text-sm" title={badge.name}>{badge.icon || '🏆'}</span>
              ))}
            </div>
          )}
          <ChevronRight className="w-5 h-5 text-purple-400" />
        </div>
      </button>
    )}

    {/* Quick Stats */}
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-white/5 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-orange-400">{soulPrint?.messageCount || 0}</p>
        <p className="text-gray-500 text-xs mt-1">Messages</p>
      </div>
      <div className="bg-white/5 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-orange-400">{soulPrint?.conversationCount || 0}</p>
        <p className="text-gray-500 text-xs mt-1">Conversations</p>
      </div>
      <div className="bg-white/5 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-orange-400">{soulPrint?.daysActive || 0}</p>
        <p className="text-gray-500 text-xs mt-1">Days Active</p>
      </div>
    </div>

    {/* Communication Style */}
    {soulPrint?.communicationStyle && (
      <div className="bg-white/5 rounded-2xl p-5 mb-4">
        <h3 className="text-orange-400 text-sm font-semibold mb-3 flex items-center gap-2">
          <SparklesIcon className="w-4 h-4" /> Your Communication Style
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">{soulPrint.communicationStyle}</p>
      </div>
    )}

    {/* Visit Website Button */}
    <button 
      onClick={() => window.location.href = '/'}
      className="w-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/20 hover:to-amber-500/20 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between transition-colors mb-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
          <Home className="w-4 h-4 text-orange-400" />
        </div>
        <div className="text-left">
          <span className="text-white text-sm block">Visit Website</span>
          <span className="text-gray-500 text-xs">Updates, features & more</span>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-orange-400" />
    </button>

    {/* Announcements Section */}
    <button 
      onClick={onAnnouncementsClick}
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors mb-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-left">
          <span className="text-white text-sm block">Announcements</span>
          {announcements?.length > 0 && (
            <span className="text-gray-500 text-xs">{announcements.length} announcement{announcements.length > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-500" />
    </button>

    {/* Theme Toggle */}
    <ThemeToggle />

    {/* Settings Button */}
    <button 
      onClick={onSettingsClick}
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors mb-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
          <Settings className="w-4 h-4 text-gray-400" />
        </div>
        <span className="text-white text-sm">Settings & Privacy</span>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-500" />
    </button>

    {/* Admin Dashboard Button - only shown to admins */}
    {isAdmin && (
      <>
      <button 
        onClick={() => window.location.href = '/pricing'}
        className="w-full bg-gradient-to-r from-orange-500/10 to-purple-500/10 hover:from-orange-500/20 hover:to-purple-500/20 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between transition-colors mb-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-orange-400 text-sm font-medium">Plans & Pricing</span>
        </div>
        <ChevronRight className="w-5 h-5 text-orange-400" />
      </button>
      <button 
        onClick={onAdminClick}
        className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Settings className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-orange-400 text-sm font-medium">Admin Dashboard</span>
        </div>
        <ChevronRight className="w-5 h-5 text-orange-400" />
      </button>
      </>
    )}
  </div>
);

// Announcements View
const AnnouncementsView = ({ isOpen, onClose, announcements }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-sp-black z-[60]">
      <div className="safe-area-top bg-sp-black p-4 flex items-center gap-3 border-b border-white/10">
        <button onClick={onClose} className="p-2 text-gray-400">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-white font-semibold text-lg">Announcements</h3>
      </div>
      
      <div className="p-4 overflow-y-auto pb-20" style={{ height: 'calc(100vh - 60px)' }}>
        {announcements?.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements?.map((announcement, idx) => (
              <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-white font-medium text-sm">{announcement.title}</h4>
                  {announcement.type && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      announcement.type === 'update' ? 'bg-blue-500/20 text-blue-400' :
                      announcement.type === 'feature' ? 'bg-green-500/20 text-green-400' :
                      announcement.type === 'alert' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {announcement.type}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{announcement.content}</p>
                {announcement.created_at && (
                  <p className="text-gray-600 text-xs mt-3">
                    {new Date(announcement.created_at).toLocaleDateString('en-US', { 
                      month: 'short', day: 'numeric', year: 'numeric' 
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Attachment Preview

// Compare Mode Sheet

export { ProfileView, AnnouncementsView };
