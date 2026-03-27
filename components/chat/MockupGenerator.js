'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';

// ── MockupGenerator: Create product mockups with uploaded designs ─────────────
const MOCKUP_TEMPLATES = [
  // Apparel
  { id: 'tshirt-front', name: 'T-Shirt (Front)', category: 'Apparel', emoji: '👕', 
    placement: { x: 0.3, y: 0.25, width: 0.4, height: 0.35 } },
  { id: 'tshirt-back', name: 'T-Shirt (Back)', category: 'Apparel', emoji: '👕',
    placement: { x: 0.3, y: 0.2, width: 0.4, height: 0.4 } },
  { id: 'hoodie-front', name: 'Hoodie (Front)', category: 'Apparel', emoji: '🧥',
    placement: { x: 0.32, y: 0.35, width: 0.36, height: 0.3 } },
  { id: 'hat-front', name: 'Baseball Cap', category: 'Apparel', emoji: '🧢',
    placement: { x: 0.25, y: 0.3, width: 0.5, height: 0.35 } },
  // Drinkware  
  { id: 'mug-center', name: 'Coffee Mug', category: 'Drinkware', emoji: '☕',
    placement: { x: 0.15, y: 0.25, width: 0.7, height: 0.5 } },
  { id: 'tumbler', name: 'Tumbler', category: 'Drinkware', emoji: '🥤',
    placement: { x: 0.2, y: 0.15, width: 0.6, height: 0.7 } },
  { id: 'water-bottle', name: 'Water Bottle', category: 'Drinkware', emoji: '🍶',
    placement: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 } },
  // Print
  { id: 'book-cover', name: 'Book Cover', category: 'Print', emoji: '📕',
    placement: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } },
  { id: 'poster', name: 'Poster/Print', category: 'Print', emoji: '🖼️',
    placement: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 } },
  { id: 'business-card', name: 'Business Card', category: 'Print', emoji: '💳',
    placement: { x: 0.1, y: 0.15, width: 0.8, height: 0.7 } },
  // Tech
  { id: 'phone-case', name: 'Phone Case', category: 'Tech', emoji: '📱',
    placement: { x: 0.1, y: 0.15, width: 0.8, height: 0.7 } },
  { id: 'laptop-sleeve', name: 'Laptop Sleeve', category: 'Tech', emoji: '💻',
    placement: { x: 0.15, y: 0.2, width: 0.7, height: 0.6 } },
  { id: 'tote-bag', name: 'Tote Bag', category: 'Other', emoji: '👜',
    placement: { x: 0.2, y: 0.25, width: 0.6, height: 0.5 } },
];

function MockupGenerator({ design, onClose, onGenerate, isGenerating, token }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Apparel');
  const [customProduct, setCustomProduct] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  
  // Design placement state
  const [designPosition, setDesignPosition] = useState({ x: 0.3, y: 0.25 });
  const [designSize, setDesignSize] = useState({ width: 0.4, height: 0.4 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const previewRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });
  
  // Categories for filtering
  const categories = ['Apparel', 'Drinkware', 'Print', 'Tech', 'Other'];
  
  // Update position when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setDesignPosition({ x: selectedTemplate.placement.x, y: selectedTemplate.placement.y });
      setDesignSize({ width: selectedTemplate.placement.width, height: selectedTemplate.placement.height });
    }
  }, [selectedTemplate]);
  
  const handleMouseDown = (e, type) => {
    e.preventDefault();
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    if (type === 'drag') {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - (designPosition.x * rect.width),
        y: e.clientY - (designPosition.y * rect.height)
      };
    } else if (type === 'resize') {
      setIsResizing(true);
      dragStart.current = { x: e.clientX, y: e.clientY, ...designSize };
    }
  };
  
  const handleMouseMove = (e) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    if (isDragging) {
      const newX = Math.max(0, Math.min(1 - designSize.width, (e.clientX - dragStart.current.x) / rect.width));
      const newY = Math.max(0, Math.min(1 - designSize.height, (e.clientY - dragStart.current.y) / rect.height));
      setDesignPosition({ x: newX, y: newY });
    } else if (isResizing) {
      const deltaX = (e.clientX - dragStart.current.x) / rect.width;
      const deltaY = (e.clientY - dragStart.current.y) / rect.height;
      const newWidth = Math.max(0.1, Math.min(1 - designPosition.x, dragStart.current.width + deltaX));
      const newHeight = Math.max(0.1, Math.min(1 - designPosition.y, dragStart.current.height + deltaY));
      setDesignSize({ width: newWidth, height: newHeight });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };
  
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing]);
  
  const handleGenerate = () => {
    const productName = useCustom ? customProduct : selectedTemplate?.name;
    if (!productName) return;
    
    onGenerate({
      template: selectedTemplate,
      productName,
      isCustom: useCustom,
      position: designPosition,
      size: designSize,
    });
  };
  
  const designSrc = design?.base64 
    ? `data:${design.mimeType || 'image/png'};base64,${design.base64}` 
    : design?.url;
  
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">🎨</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Mockup Generator</h3>
              <p className="text-xs text-gray-500">Place your design on products</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Product Selection */}
          <div className="w-72 border-r border-white/10 flex flex-col overflow-hidden">
            {/* Category tabs */}
            <div className="p-3 border-b border-white/10 flex flex-wrap gap-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setUseCustom(false); }}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                    activeCategory === cat && !useCustom
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                onClick={() => setUseCustom(true)}
                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                  useCustom
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Custom
              </button>
            </div>
            
            {/* Product list or custom input */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {useCustom ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">Describe any product and AI will generate a mockup:</p>
                  <textarea
                    value={customProduct}
                    onChange={e => setCustomProduct(e.target.value)}
                    placeholder="e.g., white ceramic plate, canvas shopping bag, throw pillow..."
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 resize-none"
                  />
                </div>
              ) : (
                MOCKUP_TEMPLATES
                  .filter(t => t.category === activeCategory)
                  .map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'bg-orange-500/20 border-orange-500/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{template.emoji}</span>
                        <span className="text-sm text-white">{template.name}</span>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
          
          {/* Right: Preview & Controls */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Preview area */}
            <div className="flex-1 p-6 flex items-center justify-center bg-[#0a0e12] overflow-hidden">
              <div 
                ref={previewRef}
                className="relative bg-gray-800 rounded-xl overflow-hidden"
                style={{ width: '400px', height: '400px' }}
              >
                {/* Product background placeholder */}
                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                  {selectedTemplate ? (
                    <span className="text-8xl opacity-20">{selectedTemplate.emoji}</span>
                  ) : useCustom && customProduct ? (
                    <span className="text-6xl opacity-20">🎨</span>
                  ) : (
                    <span className="text-sm">Select a product</span>
                  )}
                </div>
                
                {/* Design overlay - draggable */}
                {designSrc && (selectedTemplate || (useCustom && customProduct)) && (
                  <div
                    className={`absolute cursor-move border-2 ${isDragging || isResizing ? 'border-orange-500' : 'border-dashed border-orange-500/50'} rounded-lg overflow-hidden`}
                    style={{
                      left: `${designPosition.x * 100}%`,
                      top: `${designPosition.y * 100}%`,
                      width: `${designSize.width * 100}%`,
                      height: `${designSize.height * 100}%`,
                    }}
                    onMouseDown={e => handleMouseDown(e, 'drag')}
                  >
                    <img 
                      src={designSrc} 
                      alt="Design" 
                      className="w-full h-full object-contain pointer-events-none"
                      draggable={false}
                    />
                    {/* Resize handle */}
                    <div
                      className="absolute bottom-0 right-0 w-4 h-4 bg-orange-500 cursor-se-resize rounded-tl-lg"
                      onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, 'resize'); }}
                    />
                  </div>
                )}
                
                {/* Generating overlay */}
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-2" />
                      <p className="text-white text-sm">Generating mockup...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Controls */}
            <div className="p-4 border-t border-white/10 bg-black/20">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-gray-500">
                  {selectedTemplate || (useCustom && customProduct)
                    ? 'Drag to position • Corner to resize'
                    : 'Select a product to preview'}
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={(!selectedTemplate && !customProduct) || isGenerating}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center gap-2 transition-all"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate Mockup</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export { MOCKUP_TEMPLATES, MockupGenerator };
