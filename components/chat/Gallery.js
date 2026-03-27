'use client';
import { useState } from 'react';
import { X, Download, Trash2, RefreshCw, Film, Image as ImageIcon, Loader2 } from 'lucide-react';

// ── GalleryItem: Single item in the media gallery ────────────────────────────
function GalleryItem({ item, onClick }) {
  const isVideo = item.type === 'video';
  
  return (
    <div 
      onClick={() => onClick(item)}
      className="relative group cursor-pointer rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all"
    >
      {isVideo ? (
        <div className="aspect-video bg-gradient-to-br from-blue-500/10 to-pink-500/10 flex items-center justify-center">
          {item.thumbnail_url ? (
            <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Film className="w-8 h-8 text-blue-400" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-10 h-10 text-white" />
          </div>
        </div>
      ) : (
        <div className="aspect-square">
          <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
        </div>
      )}
      
      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-[10px] text-white truncate">{item.prompt}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${isVideo ? 'bg-blue-500/30 text-purple-300' : 'bg-pink-500/30 text-pink-300'}`}>
            {item.model_label || item.model}
          </span>
          <span className="text-[9px] text-gray-500">
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── GalleryModal: Full-screen view of a gallery item ─────────────────────────
function GalleryModal({ item, onClose, onDelete, onRegenerate, token }) {
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  
  useEffect(() => {
    if (item) setEditedPrompt(item.prompt || '');
  }, [item]);
  
  if (!item) return null;
  
  const isVideo = item.type === 'video';
  const promptIsTruncated = item.prompt && item.prompt.length > 150;
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this from your gallery?')) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        onDelete?.(item.id);
        onClose();
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
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
          type: item.type,
          model: item.model || 'smart',
          prompt: editedPrompt,
          aspectRatio: item.aspect_ratio || '1:1',
          duration: item.duration || '5',
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert('Regeneration failed: ' + data.error);
      } else {
        onRegenerate?.(data);
        onClose();
        alert(isVideo ? 'Video generation started! Check the gallery in a few minutes.' : 'New image generated! Check the gallery.');
      }
    } catch (e) {
      alert('Regeneration failed: ' + e.message);
    }
    setRegenerating(false);
  };
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${isVideo ? 'bg-blue-500/30 text-purple-300' : 'bg-pink-500/30 text-pink-300'}`}>
              {isVideo ? 'Video' : 'Image'} • {item.model_label || item.model}
            </span>
            {item.duration && isVideo && (
              <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-400">
                {item.duration}s
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center overflow-hidden rounded-xl bg-black">
          {isVideo ? (
            <video 
              src={item.url} 
              controls 
              autoPlay 
              className="max-w-full max-h-[60vh] rounded-lg"
            />
          ) : (
            <img 
              src={item.url} 
              alt={item.prompt} 
              className="max-w-full max-h-[60vh] object-contain rounded-lg"
            />
          )}
        </div>
        
        {/* Prompt Section */}
        <div className="mt-4 p-4 bg-white/5 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">ORIGINAL PROMPT</span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              {isEditing ? 'Cancel Edit' : 'Edit & Regenerate'}
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
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating || !editedPrompt.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate {isVideo ? 'Video' : 'Image'}
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className={`text-sm text-gray-300 ${!showFullPrompt && promptIsTruncated ? 'line-clamp-2' : ''}`}>
                {item.prompt || 'No prompt available'}
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
          
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
            <span className="text-xs text-gray-500">
              {new Date(item.created_at).toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
              <a 
                href={item.url} 
                download 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-white hover:bg-white/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export { GalleryItem, GalleryModal };
