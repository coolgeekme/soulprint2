'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Paintbrush, Eraser, RotateCcw, Check } from 'lucide-react';

/**
 * MaskEditor Component
 * Allows users to draw a mask on an image for selective editing
 * Mobile-responsive design
 */
export default function MaskEditor({ imageUrl, onSave, onClose }) {
  const canvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [tool, setTool] = useState('brush');
  const [editPrompt, setEditPrompt] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });
  
  // Load the image
  useEffect(() => {
    if (!imageUrl) return;
    
    const img = new Image();
    // Don't set crossOrigin for external URLs - it causes CORS issues
    
    img.onload = () => {
      // Calculate canvas size based on screen size (mobile responsive)
      const isMobile = window.innerWidth < 768;
      const maxSize = isMobile ? Math.min(window.innerWidth - 32, 400) : 600;
      
      let width = img.width;
      let height = img.height;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }
      
      setCanvasSize({ width: Math.round(width), height: Math.round(height) });
      setImageLoaded(true);
      
      // Draw image on main canvas after state update
      setTimeout(() => {
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (canvas && maskCanvas) {
          canvas.width = width;
          canvas.height = height;
          maskCanvas.width = width;
          maskCanvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const maskCtx = maskCanvas.getContext('2d');
          maskCtx.clearRect(0, 0, width, height);
        }
      }, 50);
    };
    
    img.onerror = () => {
      console.log('[MaskEditor] Image load failed');
      setImageError(true);
      setImageLoaded(true);
    };
    
    img.src = imageUrl;
  }, [imageUrl]);
  
  // Get mouse/touch position
  const getPosition = useCallback((e) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, []);
  
  // Draw on mask canvas
  const draw = useCallback((e) => {
    if (!isDrawing) return;
    
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext('2d');
    const pos = getPosition(e);
    
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    
    if (tool === 'brush') {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [isDrawing, brushSize, tool, getPosition]);
  
  const handleStart = useCallback((e) => {
    e.preventDefault();
    setIsDrawing(true);
    draw(e);
  }, [draw]);
  
  const handleMove = useCallback((e) => {
    e.preventDefault();
    draw(e);
  }, [draw]);
  
  const handleEnd = useCallback(() => {
    setIsDrawing(false);
  }, []);
  
  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, []);
  
  const handleSave = useCallback(async () => {
    if (!editPrompt.trim()) {
      alert('Please describe what you want to change');
      return;
    }
    
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;
    
    // Convert mask to black & white
    const maskCtx = maskCanvas.getContext('2d');
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    
    const finalMaskCanvas = document.createElement('canvas');
    finalMaskCanvas.width = maskCanvas.width;
    finalMaskCanvas.height = maskCanvas.height;
    const finalMaskCtx = finalMaskCanvas.getContext('2d');
    
    finalMaskCtx.fillStyle = 'black';
    finalMaskCtx.fillRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
    
    const finalMaskData = finalMaskCtx.getImageData(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
    for (let i = 0; i < maskData.data.length; i += 4) {
      if (maskData.data[i + 3] > 0) {
        finalMaskData.data[i] = 255;
        finalMaskData.data[i + 1] = 255;
        finalMaskData.data[i + 2] = 255;
        finalMaskData.data[i + 3] = 255;
      }
    }
    finalMaskCtx.putImageData(finalMaskData, 0, 0);
    
    const imageBase64 = canvas.toDataURL('image/png');
    const maskBase64 = finalMaskCanvas.toDataURL('image/png');
    
    onSave(imageBase64, maskBase64, editPrompt);
  }, [editPrompt, onSave]);
  
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-800">
        <h2 className="text-white text-base md:text-lg font-semibold flex items-center gap-2">
          <span className="text-xl">🎨</span>
          <span className="hidden sm:inline">Mask Editor - </span>Select area to edit
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center gap-2 md:gap-4 p-3 md:p-4 border-b border-gray-800 flex-wrap">
        {/* Tool selection */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTool('brush')}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'brush' 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            title="Brush"
          >
            <Paintbrush size={18} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'eraser' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            title="Eraser"
          >
            <Eraser size={18} />
          </button>
        </div>
        
        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs hidden sm:inline">Size:</span>
          <input
            type="range"
            min="10"
            max="80"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-16 md:w-24 accent-red-500"
          />
          <span className="text-gray-300 text-xs w-6">{brushSize}</span>
        </div>
        
        {/* Clear button */}
        <button
          onClick={clearMask}
          className="flex items-center gap-1 px-2 md:px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-xs md:text-sm"
        >
          <RotateCcw size={14} />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>
      
      {/* Canvas area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-2 md:p-4"
      >
        {!imageLoaded ? (
          <div className="text-gray-400 flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <span>Loading image...</span>
          </div>
        ) : imageError ? (
          <div className="text-gray-400 text-center p-4">
            <p>Could not load image</p>
            <p className="text-sm mt-1">The image may not be accessible</p>
          </div>
        ) : (
          <div 
            className="relative rounded-lg overflow-hidden border border-gray-700"
            style={{ width: canvasSize.width, height: canvasSize.height }}
          >
            {/* Base image canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ width: canvasSize.width, height: canvasSize.height }}
            />
            
            {/* Mask overlay canvas */}
            <canvas
              ref={maskCanvasRef}
              className="absolute inset-0 cursor-crosshair touch-none"
              style={{ width: canvasSize.width, height: canvasSize.height }}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          </div>
        )}
      </div>
      
      {/* Footer - Edit prompt */}
      <div className="p-3 md:p-4 border-t border-gray-800 bg-gray-900/50">
        <div className="flex gap-2 md:gap-3 max-w-2xl mx-auto">
          <input
            type="text"
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder="What do you want to change?"
            className="flex-1 px-3 md:px-4 py-2.5 md:py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          <button
            onClick={handleSave}
            disabled={!editPrompt.trim()}
            className="flex items-center gap-1.5 px-4 md:px-6 py-2.5 md:py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <Check size={16} />
            <span className="hidden sm:inline">Apply</span>
          </button>
        </div>
        <p className="text-gray-500 text-xs text-center mt-2">
          Paint the area (red), then describe the change
        </p>
      </div>
    </div>
  );
}
