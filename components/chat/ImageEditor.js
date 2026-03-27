'use client';
import { useState, useRef } from 'react';
import { Pencil, X, Loader2, Sparkles, Upload } from 'lucide-react';

// ── ImageEditor: Canvas-based image editing with mask drawing ─────────────────
function ImageEditor({ image, onClose, onEdit, isEditing }) {
  const containerRef = useRef(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [overlayImage, setOverlayImage] = useState(null); // { base64, mimeType, name }
  const fileInputRef = useRef(null);
  
  const imgSrc = image?.base64 ? `data:image/png;base64,${image.base64}` : image?.url;
  
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      setOverlayImage({
        base64,
        mimeType: file.type || 'image/png',
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };
  
  const handleEdit = () => {
    if (!editPrompt.trim()) return;
    onEdit({
      prompt: editPrompt,
      overlayImage: overlayImage || null,
      hasMask: false,
      maskDataUrl: null,
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-[#111820] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-white">Edit Image</h3>
              <p className="text-[10px] sm:text-xs text-gray-500">Describe changes or add a logo/image</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Image Preview */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="relative mx-auto rounded-xl overflow-hidden border border-white/20 bg-black/30 max-w-md">
            {imgSrc && (
              <img 
                src={imgSrc} 
                alt="Edit" 
                className="w-full h-auto max-h-[40vh] sm:max-h-[45vh] object-contain"
                crossOrigin="anonymous"
              />
            )}
            
            {/* Overlay image preview */}
            {overlayImage && (
              <div className="absolute bottom-2 right-2 bg-black/70 rounded-lg p-1 border border-white/20">
                <img 
                  src={overlayImage.base64} 
                  alt="Overlay" 
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded"
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); setOverlayImage(null); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            )}
            
            {/* Loading overlay */}
            {isEditing && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                  <p className="text-white text-sm font-medium">
                    {overlayImage ? 'Creating mockup...' : 'Editing image...'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">This takes 10-20 seconds</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Upload overlay image button */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isEditing}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/5 border border-white/10 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {overlayImage ? 'Change Logo/Image' : 'Add Logo/Image'}
            </button>
            {overlayImage && (
              <span className="text-xs text-purple-400 truncate max-w-[120px] sm:max-w-[200px]">
                {overlayImage.name}
              </span>
            )}
          </div>
          
          {overlayImage && (
            <p className="text-center text-green-400/70 text-[10px] sm:text-xs mt-1.5">
              ✓ Logo/image attached — describe where to place it below
            </p>
          )}
        </div>
        
        {/* Edit Prompt & Actions */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-black/20 shrink-0">
          <div className="flex gap-2 sm:gap-3">
            <input
              type="text"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleEdit()}
              placeholder={overlayImage 
                ? "e.g., 'Place this logo on both t-shirts'" 
                : "e.g., 'Remove the hat', 'Make the sky sunset'"}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              disabled={isEditing}
            />
            <button
              onClick={handleEdit}
              disabled={!editPrompt.trim() || isEditing}
              className="px-4 py-2.5 sm:px-6 sm:py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center gap-1.5 sm:gap-2 transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              {isEditing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> <span className="hidden sm:inline">Editing...</span></>
              ) : (
                <><Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">Apply</span></>
              )}
            </button>
          </div>
          <p className="text-gray-600 text-[10px] sm:text-xs mt-1.5 text-center">
            {overlayImage ? 'AI will blend the logo/image naturally into the photo' : 'Powered by Gemini AI — describe any edit you want'}
          </p>
        </div>
      </div>
    </div>
  );
}


export default ImageEditor;
