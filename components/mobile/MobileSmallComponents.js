'use client';
import { useState } from 'react';
import { MoreVertical, Trash2, Edit3, Folder, Check, X, Sun, Moon, FileText, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/lib/providers/ThemeProvider';

const ConversationItem = ({ conversation, isActive, onClick, onDelete, onRename, onMove }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`w-full text-left p-4 border-b border-white/5 transition-colors ${
          isActive ? 'bg-orange-500/10' : 'hover:bg-white/5 active:bg-white/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isActive ? 'bg-orange-500/20' : 'bg-white/5'
          }`}>
            <MessageSquare className={`w-5 h-5 ${isActive ? 'text-orange-400' : 'text-gray-500'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium text-sm truncate ${isActive ? 'text-orange-400' : 'text-white'}`}>
              {conversation.title || 'New Conversation'}
            </h3>
            <p className="text-gray-500 text-xs truncate mt-0.5">
              {conversation.preview || ''}
            </p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-2 text-gray-500"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </button>
      {showMenu && (
        <div className="absolute right-4 top-12 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden">
          <button 
            onClick={(e) => { e.stopPropagation(); onRename?.(conversation); setShowMenu(false); }}
            className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" /> Rename
          </button>
          {onMove && (
            <button 
              onClick={(e) => { e.stopPropagation(); onMove?.(conversation); setShowMenu(false); }}
              className="w-full px-4 py-3 text-left text-sm text-purple-400 hover:bg-purple-500/10 flex items-center gap-2"
            >
              <Folder className="w-4 h-4" /> Move to Project
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(conversation.id); setShowMenu(false); }}
            className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

// Theme Toggle Component for Profile
const ThemeToggle = () => {
  const { theme, toggleTheme, isDark } = useTheme();
  
  return (
    <button 
      onClick={toggleTheme}
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors mb-3"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-indigo-500/20' : 'bg-yellow-500/20'}`}>
          {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-yellow-500" />}
        </div>
        <div className="text-left">
          <span className="text-white text-sm block">Appearance</span>
          <span className="text-gray-500 text-xs">{isDark ? 'Dark mode' : 'Light mode'}</span>
        </div>
      </div>
      <div className={`w-12 h-6 rounded-full relative transition-colors ${isDark ? 'bg-indigo-500/30' : 'bg-yellow-500/30'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
          isDark 
            ? 'left-0.5 bg-indigo-500' 
            : 'right-0.5 bg-yellow-500'
        }`} />
      </div>
    </button>
  );
};

// Profile View

const AttachmentPreview = ({ attachments, onRemove }) => {
  if (!attachments.length) return null;
  
  return (
    <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
      {attachments.map((att, idx) => (
        <div key={idx} className="relative flex-shrink-0">
          {att.type === 'image' ? (
            <img src={`data:${att.mimeType};base64,${att.base64}`} alt={att.name} className="w-16 h-16 object-cover rounded-xl" />
          ) : (
            <div className="w-16 h-16 bg-white/5 rounded-xl flex flex-col items-center justify-center p-1">
              <AttachIcon className="w-4 h-4 text-gray-400" />
              <span className="text-[8px] text-gray-500 truncate w-full text-center mt-1">{att.name}</span>
            </div>
          )}
          <button 
            onClick={() => onRemove(idx)}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ))}
    </div>
  );
};

// More Options Menu (bottom sheet) - Website and Settings

const RenameModal = ({ isOpen, onClose, title, onTitleChange, onSave }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#141a21] rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-semibold text-lg mb-4">Rename Conversation</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Enter new title..."
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 mb-4"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 p-3 rounded-xl bg-white/5 text-gray-400">
            Cancel
          </button>
          <button onClick={onSave} className="flex-1 p-3 rounded-xl bg-orange-500 text-white font-medium">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Media Gallery View

export { ConversationItem, ThemeToggle, AttachmentPreview, RenameModal };
