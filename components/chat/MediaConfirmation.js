'use client';
import React, { useState } from 'react';
import { Image, Film, MessageCircle, Check, Pencil, Sparkles, Zap, ChevronRight, Loader2 } from 'lucide-react';

// ── Step 1: Media Type Confirmation ─────────────────────────────────
export function MediaConfirmCard({ onSelect, disabled }) {
  return (
    <div className="mt-3 mb-1">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect('image')}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 hover:border-purple-500/50 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Image className="w-4 h-4" />
          Generate Image
        </button>
        <button
          onClick={() => onSelect('video')}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 hover:border-blue-500/50 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Film className="w-4 h-4" />
          Generate Video
        </button>
        <button
          onClick={() => onSelect('chat')}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-gray-400 hover:bg-white/10 hover:border-white/25 hover:text-gray-300 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MessageCircle className="w-4 h-4" />
          Just Chat
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Prompt Review ─────────────────────────────────────────
export function PromptReviewCard({ refinedPrompt, mediaType, onApprove, onEdit, disabled }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(refinedPrompt);
  
  const handleSaveEdit = () => {
    if (editedPrompt.trim()) {
      onApprove(editedPrompt.trim());
    }
  };
  
  const typeLabel = mediaType === 'video' ? 'video' : 'image';
  const typeColor = mediaType === 'video' ? 'blue' : 'purple';
  
  return (
    <div className="mt-3 mb-1">
      <div className={`rounded-xl border ${typeColor === 'purple' ? 'border-purple-500/20 bg-purple-500/5' : 'border-blue-500/20 bg-blue-500/5'} p-3 sm:p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className={`w-4 h-4 ${typeColor === 'purple' ? 'text-purple-400' : 'text-blue-400'}`} />
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Enhanced {typeLabel} prompt</span>
        </div>
        
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/40 resize-none min-h-[80px]"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={!editedPrompt.trim() || disabled}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg ${typeColor === 'purple' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'} text-white text-sm font-medium transition-colors disabled:opacity-40`}
              >
                <Check className="w-3.5 h-3.5" />
                Use This Prompt
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditedPrompt(refinedPrompt); }}
                className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-300 leading-relaxed mb-3 italic">"{refinedPrompt}"</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onApprove(refinedPrompt)}
                disabled={disabled}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg ${typeColor === 'purple' ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30' : 'bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30'} text-sm font-medium transition-all disabled:opacity-40`}
              >
                <Check className="w-3.5 h-3.5" />
                Looks Good!
              </button>
              <button
                onClick={() => setIsEditing(true)}
                disabled={disabled}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 border border-white/15 text-gray-400 hover:text-white hover:bg-white/10 text-sm font-medium transition-all disabled:opacity-40"
              >
                <Pencil className="w-3.5 h-3.5" />
                Make Changes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Model Selection ─────────────────────────────────────────
export function ModelSelectionCard({ mediaType, models, recommended, onSelect, disabled }) {
  const [selectedModel, setSelectedModel] = useState(null);
  
  const handleSelect = (modelKey) => {
    if (disabled) return;
    setSelectedModel(modelKey);
    onSelect(modelKey);
  };
  
  const typeColor = mediaType === 'video' ? 'blue' : 'purple';
  
  return (
    <div className="mt-3 mb-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Dynamic Intelligence - always first */}
        <button
          onClick={() => handleSelect('smart')}
          disabled={disabled}
          className={`relative flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
            selectedModel === 'smart' 
              ? (typeColor === 'purple' ? 'border-purple-500/50 bg-purple-500/15' : 'border-blue-500/50 bg-blue-500/15')
              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {recommended === 'smart' && (
            <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold uppercase">Recommended</span>
          )}
          <div className={`w-8 h-8 rounded-lg ${typeColor === 'purple' ? 'bg-purple-500/20' : 'bg-blue-500/20'} flex items-center justify-center shrink-0 mt-0.5`}>
            <Zap className={`w-4 h-4 ${typeColor === 'purple' ? 'text-purple-400' : 'text-blue-400'}`} />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-white block">Dynamic Intelligence</span>
            <span className="text-[11px] text-gray-500 block">AI picks the best model for your prompt</span>
          </div>
          {selectedModel === 'smart' && <Loader2 className="w-4 h-4 text-purple-400 animate-spin absolute top-3 right-3" />}
        </button>
        
        {/* Other models */}
        {(models || []).map((m) => (
          <button
            key={m.key}
            onClick={() => handleSelect(m.key)}
            disabled={disabled || selectedModel !== null}
            className={`relative flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
              selectedModel === m.key 
                ? (typeColor === 'purple' ? 'border-purple-500/50 bg-purple-500/15' : 'border-blue-500/50 bg-blue-500/15')
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {recommended === m.key && (
              <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold uppercase">Recommended</span>
            )}
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5 text-lg">{m.emoji || '🎨'}</div>
            <div className="min-w-0">
              <span className="text-sm font-medium text-white block truncate">{m.label}</span>
              <span className="text-[11px] text-gray-500 block truncate">{m.description || ''}</span>
            </div>
            {selectedModel === m.key && <Loader2 className="w-4 h-4 text-purple-400 animate-spin absolute top-3 right-3" />}
          </button>
        ))}
      </div>
    </div>
  );
}
