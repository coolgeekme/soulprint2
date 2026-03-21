'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Paintbrush, Eraser, RotateCcw, Check, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * MaskEditor Component
 * Allows users to draw a mask on an image for selective editing
 * 
 * Props:
 * - imageUrl: The image to edit
 * - onSave: Callback with (imageBase64, maskBase64, editPrompt)
 * - onClose: Callback to close the editor
 */
export default function MaskEditor({ imageUrl, onSave, onClose }) {
  const canvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [tool, setTool] = useState('brush'); // 'brush' or 'eraser'
  const [editPrompt, setEditPrompt] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imageData, setImageData] = useState(null);
  
  // Load the image
  useEffect(() => {
    if (!imageUrl) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageData(img);
      setImageLoaded(true);
      
      // Set canvas dimensions
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (canvas && maskCanvas) {
        // Scale down large images
        const maxSize = 800;
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
        
        canvas.width = width;
        canvas.height = height;
        maskCanvas.width = width;
        maskCanvas.height = height;
        
        // Draw image on main canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Initialize mask canvas (transparent)
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.clearRect(0, 0, width, height);
      }
    };
    img.onerror = (e) => {
      console.error('Failed to load image:', e);
    };
    img.src = imageUrl;
  }, [imageUrl]);
  
  // Get mouse/touch position relative to canvas
  const getPosition = useCallback((e) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches) {
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
      // Draw mask (red semi-transparent)
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fill();
    } else {
      // Eraser - clear the area
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [isDrawing, brushSize, tool, getPosition]);
  
  // Mouse/Touch event handlers
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
  
  // Clear mask
  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext('2d');
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, []);
  
  // Save and apply edit
  const handleSave = useCallback(async () => {
    if (!editPrompt.trim()) {
      alert('Please enter what you want to change in the selected area');
      return;
    }
    
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;
    
    // Convert mask to black & white (white = edit area, black = keep)
    const maskCtx = maskCanvas.getContext('2d');
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    
    // Create a new canvas for the final mask (black/white)
    const finalMaskCanvas = document.createElement('canvas');
    finalMaskCanvas.width = maskCanvas.width;
    finalMaskCanvas.height = maskCanvas.height;
    const finalMaskCtx = finalMaskCanvas.getContext('2d');
    
    // Fill with black (keep areas)
    finalMaskCtx.fillStyle = 'black';
    finalMaskCtx.fillRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
    
    // Draw white where there's red mask
    const finalMaskData = finalMaskCtx.getImageData(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
    for (let i = 0; i < maskData.data.length; i += 4) {
      // If there's any red in the mask (alpha > 0)
      if (maskData.data[i + 3] > 0) {
        finalMaskData.data[i] = 255;     // R - white
        finalMaskData.data[i + 1] = 255; // G
        finalMaskData.data[i + 2] = 255; // B
        finalMaskData.data[i + 3] = 255; // A
      }
    }
    finalMaskCtx.putImageData(finalMaskData, 0, 0);
    
    // Get base64 data
    const imageBase64 = canvas.toDataURL('image/png');
    const maskBase64 = finalMaskCanvas.toDataURL('image/png');
    
    // Call save callback
    onSave(imageBase64, maskBase64, editPrompt);
  }, [editPrompt, onSave]);
  
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-white text-lg font-semibold">
          🎨 Mask Editor - Select area to edit
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-700 flex-wrap">
        {/* Tool selection */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTool('brush')}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'brush' 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Brush - Paint area to edit"
          >
            <Paintbrush size={20} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'eraser' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Eraser - Remove from selection"
          >
            <Eraser size={20} />
          </button>
        </div>
        
        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Size:</span>
          <input
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-24 accent-red-500"
          />
          <span className="text-gray-300 text-sm w-8">{brushSize}</span>
        </div>
        
        {/* Clear button */}
        <button
          onClick={clearMask}
          className="flex items-center gap-1 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
        >
          <RotateCcw size={16} />
          Clear
        </button>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-gray-300 text-sm">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.25))}
            className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
      
      {/* Canvas area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4"
      >
        {!imageLoaded ? (
          <div className="text-gray-400">Loading image...</div>
        ) : (
          <div 
            className="relative"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          >
            {/* Base image canvas */}
            <canvas
              ref={canvasRef}
              className="border border-gray-600 rounded-lg"
            />
            
            {/* Mask overlay canvas */}
            <canvas
              ref={maskCanvasRef}
              className="absolute top-0 left-0 cursor-crosshair"
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
      
      {/* Footer - Edit prompt and apply */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <input
            type="text"
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder="Describe what you want to change in the selected area..."
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
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
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check size={20} />
            Apply Edit
          </button>
        </div>
        <p className="text-gray-500 text-sm text-center mt-2">
          Paint the area you want to edit (shown in red), then describe the change
        </p>
      </div>
    </div>
  );
}
