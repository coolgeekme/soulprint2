'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Pencil, X, Loader2, Sparkles, Upload, Paintbrush, Eraser, RotateCcw, Minus, Plus, Move, Eye, EyeOff } from 'lucide-react';

// ── ImageEditor: Canvas-based image editing with mask drawing ─────────────────
function ImageEditor({ image, onClose, onEdit, isEditing }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [overlayImage, setOverlayImage] = useState(null);
  const fileInputRef = useRef(null);
  
  // Mask drawing state
  const [maskMode, setMaskMode] = useState(false); // toggle mask/text mode
  const [tool, setTool] = useState('brush'); // 'brush' | 'eraser'
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [showMask, setShowMask] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const lastPoint = useRef(null);
  
  const imgSrc = image?.base64 ? `data:image/png;base64,${image.base64}` : image?.url;
  
  // Initialize canvas when image loads
  const handleImageLoad = useCallback((e) => {
    const img = e.target;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    
    // Compute display dimensions - fit within container
    const maxW = Math.min(500, window.innerWidth - 48);
    const maxH = window.innerHeight * 0.4;
    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
    const displayW = Math.round(naturalW * scale);
    const displayH = Math.round(naturalH * scale);
    
    setImageDimensions({ width: displayW, height: displayH, naturalWidth: naturalW, naturalHeight: naturalH, scale });
    
    // Setup canvas
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = displayW;
      canvas.height = displayH;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, displayW, displayH);
    }
  }, []);
  
  // Get pointer position relative to canvas
  const getPointerPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);
  
  // Draw on canvas
  const drawAt = useCallback((x, y, fromX, fromY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)'; // Purple mask color
    
    ctx.beginPath();
    if (fromX !== undefined && fromY !== undefined) {
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Also draw a circle at the point for smooth dots
    if (tool !== 'eraser') {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.55)';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalCompositeOperation = 'source-over';
    setHasMask(true);
  }, [tool, brushSize]);
  
  // Pointer events
  const handlePointerDown = useCallback((e) => {
    if (!maskMode) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    if (!pos) return;
    setIsDrawing(true);
    drawAt(pos.x, pos.y);
    lastPoint.current = pos;
  }, [maskMode, getPointerPos, drawAt]);
  
  const handlePointerMove = useCallback((e) => {
    if (!isDrawing || !maskMode) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    if (!pos) return;
    const lp = lastPoint.current;
    if (lp) {
      drawAt(pos.x, pos.y, lp.x, lp.y);
    } else {
      drawAt(pos.x, pos.y);
    }
    lastPoint.current = pos;
  }, [isDrawing, maskMode, getPointerPos, drawAt]);
  
  const handlePointerUp = useCallback(() => {
    setIsDrawing(false);
    lastPoint.current = null;
  }, []);
  
  // Clear mask
  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  }, []);
  
  // Get mask as dataURL (white = edit area, black = keep area)
  const getMaskDataUrl = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasMask) return null;
    
    // Create a new canvas for the actual mask (white on black)
    const maskCanvas = document.createElement('canvas');
    const dims = imageDimensions;
    maskCanvas.width = dims.naturalWidth || dims.width;
    maskCanvas.height = dims.naturalHeight || dims.height;
    const maskCtx = maskCanvas.getContext('2d');
    
    // Fill with black (keep these areas)
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    // Scale up the drawn mask to natural image dimensions
    const scaleX = maskCanvas.width / canvas.width;
    const scaleY = maskCanvas.height / canvas.height;
    
    // Get the drawn pixels from our display canvas
    const srcCtx = canvas.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Create mask image data at full resolution
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    
    // For each pixel in the mask, check if the corresponding display pixel has alpha
    for (let my = 0; my < maskCanvas.height; my++) {
      for (let mx = 0; mx < maskCanvas.width; mx++) {
        const sx = Math.floor(mx / scaleX);
        const sy = Math.floor(my / scaleY);
        
        if (sx >= 0 && sx < canvas.width && sy >= 0 && sy < canvas.height) {
          const srcIdx = (sy * canvas.width + sx) * 4;
          const alpha = srcData.data[srcIdx + 3];
          
          if (alpha > 10) {
            // This pixel was painted = area to edit = white in mask
            const maskIdx = (my * maskCanvas.width + mx) * 4;
            maskData.data[maskIdx] = 255;     // R
            maskData.data[maskIdx + 1] = 255; // G
            maskData.data[maskIdx + 2] = 255; // B
            maskData.data[maskIdx + 3] = 255; // A
          }
        }
      }
    }
    
    maskCtx.putImageData(maskData, 0, 0);
    return maskCanvas.toDataURL('image/png');
  }, [hasMask, imageDimensions]);
  
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      setOverlayImage({
        base64: reader.result,
        mimeType: file.type || 'image/png',
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };
  
  const handleEdit = () => {
    if (!editPrompt.trim()) return;
    const maskDataUrl = getMaskDataUrl();
    onEdit({
      prompt: editPrompt,
      overlayImage: overlayImage || null,
      hasMask: !!maskDataUrl,
      maskDataUrl: maskDataUrl,
    });
  };
  
  // Keyboard shortcut for brush size
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '[') setBrushSize(s => Math.max(5, s - 5));
      if (e.key === ']') setBrushSize(s => Math.min(100, s + 5));
      if (e.key === 'b') setTool('brush');
      if (e.key === 'e') setTool('eraser');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
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
              <p className="text-[10px] sm:text-xs text-gray-500">
                {maskMode ? 'Paint over the area you want to change' : 'Describe changes or add a logo/image'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Mask Toolbar */}
        <div className="px-3 sm:px-4 py-2 border-b border-white/5 flex items-center gap-2 flex-wrap shrink-0">
          {/* Mode toggle */}
          <button
            onClick={() => setMaskMode(!maskMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              maskMode 
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            {maskMode ? 'Mask Active' : 'Enable Mask'}
          </button>
          
          {maskMode && (
            <>
              {/* Divider */}
              <div className="w-px h-6 bg-white/10" />
              
              {/* Tool buttons */}
              <button
                onClick={() => setTool('brush')}
                className={`p-1.5 rounded-lg transition-all ${
                  tool === 'brush' ? 'bg-purple-500/30 text-purple-300' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Brush (B)"
              >
                <Paintbrush className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setTool('eraser')}
                className={`p-1.5 rounded-lg transition-all ${
                  tool === 'eraser' ? 'bg-purple-500/30 text-purple-300' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
                title="Eraser (E)"
              >
                <Eraser className="w-4 h-4" />
              </button>
              
              {/* Divider */}
              <div className="w-px h-6 bg-white/10" />
              
              {/* Brush size */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBrushSize(s => Math.max(5, s - 5))}
                  className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  title="Decrease brush size ([)"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 min-w-[60px] justify-center">
                  <div 
                    className="rounded-full bg-purple-400/60 border border-purple-400/40"
                    style={{ width: Math.max(6, brushSize * 0.4), height: Math.max(6, brushSize * 0.4) }}
                  />
                  <span className="text-[10px] text-gray-500 tabular-nums">{brushSize}px</span>
                </div>
                <button
                  onClick={() => setBrushSize(s => Math.min(100, s + 5))}
                  className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  title="Increase brush size (])"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {/* Divider */}
              <div className="w-px h-6 bg-white/10" />
              
              {/* Toggle mask visibility */}
              <button
                onClick={() => setShowMask(!showMask)}
                className={`p-1.5 rounded-lg transition-all ${
                  showMask ? 'text-purple-300' : 'text-gray-500 hover:text-gray-300'
                } hover:bg-white/5`}
                title={showMask ? 'Hide mask preview' : 'Show mask preview'}
              >
                {showMask ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              
              {/* Clear */}
              <button
                onClick={clearMask}
                disabled={!hasMask}
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Clear mask"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              
              {hasMask && (
                <span className="text-[10px] text-green-400/70 ml-auto hidden sm:inline">
                  ✓ Mask applied
                </span>
              )}
            </>
          )}
        </div>
        
        {/* Image Preview + Canvas */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4" ref={containerRef}>
          <div className="relative mx-auto rounded-xl overflow-hidden border border-white/20 bg-black/30 inline-block" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="relative" style={{ width: imageDimensions.width || 'auto', height: imageDimensions.height || 'auto' }}>
              {imgSrc && (
                <img 
                  ref={imageRef}
                  src={imgSrc} 
                  alt="Edit" 
                  className="block"
                  style={{ 
                    width: imageDimensions.width || 'auto', 
                    height: imageDimensions.height || 'auto',
                    maxHeight: '40vh',
                    objectFit: 'contain',
                  }}
                  crossOrigin="anonymous"
                  onLoad={handleImageLoad}
                />
              )}
              
              {/* Mask canvas overlay */}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0"
                style={{ 
                  width: imageDimensions.width, 
                  height: imageDimensions.height,
                  cursor: maskMode 
                    ? (tool === 'eraser' ? 'crosshair' : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${Math.max(8, brushSize * 0.4)}' height='${Math.max(8, brushSize * 0.4)}'%3E%3Ccircle cx='${Math.max(4, brushSize * 0.2)}' cy='${Math.max(4, brushSize * 0.2)}' r='${Math.max(3, brushSize * 0.2 - 1)}' fill='none' stroke='%23a855f7' stroke-width='1.5'/%3E%3C/svg%3E") ${Math.max(4, brushSize * 0.2)} ${Math.max(4, brushSize * 0.2)}, crosshair`)
                    : 'default',
                  opacity: showMask ? 1 : 0,
                  touchAction: maskMode ? 'none' : 'auto',
                  pointerEvents: maskMode ? 'auto' : 'none',
                }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
              />
              
              {/* Overlay image preview */}
              {overlayImage && (
                <div className="absolute bottom-2 right-2 bg-black/70 rounded-lg p-1 border border-white/20 z-10">
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
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                    <p className="text-white text-sm font-medium">
                      {overlayImage ? 'Creating mockup...' : hasMask ? 'Editing masked area...' : 'Editing image...'}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">This takes 10-20 seconds</p>
                  </div>
                </div>
              )}
            </div>
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
          
          {/* Mask hint when in mask mode */}
          {maskMode && !hasMask && (
            <p className="text-center text-purple-400/60 text-[10px] sm:text-xs mt-2 animate-pulse">
              Paint over the area you want to edit · Use [ ] to resize brush
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
              placeholder={
                hasMask 
                  ? "What should appear in the masked area?" 
                  : overlayImage 
                    ? "e.g., 'Place this logo on both t-shirts'" 
                    : "e.g., 'Remove the hat', 'Make the sky sunset'"
              }
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
            {hasMask 
              ? 'Mask applied — AI will only change the painted area' 
              : overlayImage 
                ? 'AI will blend the logo/image naturally into the photo' 
                : 'Powered by Gemini AI · Enable mask for precise area editing'
            }
          </p>
        </div>
      </div>
    </div>
  );
}


export default ImageEditor;
