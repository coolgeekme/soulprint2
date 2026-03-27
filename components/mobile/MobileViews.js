'use client';
import { useState, useRef, useEffect } from 'react';
import { 
  Settings, ChevronRight, ExternalLink, Share2, Users, Link2, UserPlus, Upload,
  X, Loader2, Film, Download, Trash2, RefreshCw, Image as ImageIcon, Search,
  Edit3, Home, MessageSquare, Video
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

const GalleryView = ({ isOpen, onClose, items, onItemClick, token, onDeleteItem, onRegenerate }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  
  // Update edited prompt when selected item changes
  useEffect(() => {
    if (selectedItem) {
      setEditedPrompt(selectedItem.prompt || '');
      setIsEditing(false);
      setShowFullPrompt(false);
    }
  }, [selectedItem]);
  
  if (!isOpen) return null;
  
  const handleDelete = async (item) => {
    if (!confirm('Delete this from your gallery?')) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        onDeleteItem?.(item.id);
        setSelectedItem(null);
      } else {
        alert('Failed to delete');
      }
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
    setDeleting(false);
  };
  
  const handleRegenerate = async () => {
    if (!editedPrompt.trim()) {
      alert('Please enter a prompt');
      return;
    }
    
    setRegenerating(true);
    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: selectedItem.type,
          model: selectedItem.model || 'smart',
          prompt: editedPrompt,
          aspectRatio: selectedItem.aspect_ratio || '1:1',
          duration: selectedItem.duration || '5',
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert('Regeneration failed: ' + data.error);
      } else {
        onRegenerate?.(data);
        setSelectedItem(null);
        onClose();
        alert(selectedItem.type === 'video' ? 'Video generation started! Check the gallery in a few minutes.' : 'New image generated! Check the gallery.');
      }
    } catch (e) {
      alert('Regeneration failed: ' + e.message);
    }
    setRegenerating(false);
  };
  
  const promptIsTruncated = selectedItem?.prompt && selectedItem.prompt.length > 100;
  
  return (
    <div className="fixed inset-0 bg-sp-black z-[60]">
      <div className="safe-area-top bg-sp-black p-4 flex items-center gap-3 border-b border-white/10">
        <button onClick={onClose} className="p-2 text-gray-400">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-white font-semibold text-lg">Media Gallery</h3>
      </div>
      
      <div className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 60px)' }}>
        {items.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No generated media yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedItem(item)}
                className="aspect-square rounded-xl overflow-hidden bg-white/5 relative"
              >
                {item.type === 'image' ? (
                  <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                ) : (
                  <div className="relative w-full h-full">
                    <video src={item.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Video className="w-8 h-8 text-white/80" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Item Detail Modal with Edit & Regenerate */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col" onClick={() => !isEditing && setSelectedItem(null)}>
          {/* Header with safe area for notch */}
          <div className="bg-black border-b border-white/10" style={{ paddingTop: 'env(safe-area-inset-top, 12px)' }}>
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${selectedItem.type === 'video' ? 'bg-blue-500/30 text-purple-300' : 'bg-pink-500/30 text-pink-300'}`}>
                  {selectedItem.type === 'video' ? 'Video' : 'Image'} • {selectedItem.model_label || selectedItem.model}
                </span>
                {selectedItem.duration && selectedItem.type === 'video' && (
                  <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-400">
                    {selectedItem.duration}s
                  </span>
                )}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedItem(null); }} 
                className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {selectedItem.type === 'video' ? (
              <video src={selectedItem.url} controls autoPlay playsInline className="max-w-full max-h-[45vh] rounded-xl" />
            ) : (
              <img src={selectedItem.url} alt={selectedItem.prompt} className="max-w-full max-h-[45vh] object-contain rounded-xl" />
            )}
          </div>
          
          {/* Prompt & Actions Section */}
          <div className="p-4 bg-white/5 safe-area-bottom max-h-[45vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Prompt Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">ORIGINAL PROMPT</span>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  {isEditing ? 'Cancel' : 'Edit & Regenerate'}
                </button>
              </div>
              
              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none"
                    rows={4}
                    placeholder="Enter your prompt..."
                    autoFocus
                  />
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating || !editedPrompt.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Regenerate {selectedItem.type === 'video' ? 'Video' : 'Image'}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <p className={`text-sm text-gray-300 ${!showFullPrompt && promptIsTruncated ? 'line-clamp-2' : ''}`}>
                    {selectedItem.prompt || 'No prompt available'}
                  </p>
                  {promptIsTruncated && (
                    <button
                      onClick={() => setShowFullPrompt(!showFullPrompt)}
                      className="text-xs text-orange-400 hover:text-orange-300 mt-1"
                    >
                      {showFullPrompt ? 'Show less' : 'Show full prompt'}
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Date and Action Buttons */}
            {!isEditing && (
              <>
                <div className="text-xs text-gray-500 mb-3">
                  {new Date(selectedItem.created_at).toLocaleString()}
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleDelete(selectedItem)}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete
                  </button>
                  <a 
                    href={selectedItem.url} 
                    download 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500/15 border border-orange-500/30 rounded-xl text-orange-400 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Compare Mode Sheet

export { ProfileView, AnnouncementsView, GalleryView };
