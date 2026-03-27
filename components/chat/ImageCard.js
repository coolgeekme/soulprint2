'use client';
import { useState } from 'react';
import { Loader2, Check, Download, RefreshCw, GalleryHorizontal, Pencil, Copy, Code, Image as ImageIcon } from 'lucide-react';

// ── ImageCard: renders a generated image with download option ─────────────────
function ImageCard({ url, revisedPrompt, modelLabel, generationParams, onEdit, onRegenerateWith }) {
  const [loaded, setLoaded] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Available image models for regeneration
  const IMAGE_MODELS_LIST = [
    { id: 'nano-banana', label: 'Nano Banana', description: 'Fast, versatile' },
    { id: 'gemini-2.0-flash-exp-image-generation', label: 'Gemini Image', description: 'High quality' },
    { id: 'gpt-image-1', label: 'GPT Image', description: 'Creative, detailed' },
  ];
  
  // Build the JSON object for this generation
  const jsonData = {
    type: 'image',
    model: generationParams?.model || modelLabel || 'unknown',
    prompt: generationParams?.prompt || revisedPrompt || '',
    revisedPrompt: revisedPrompt || '',
    aspectRatio: generationParams?.aspectRatio || '1:1',
    generatedAt: generationParams?.generatedAt || new Date().toISOString(),
    imageUrl: url,
  };
  
  const jsonString = JSON.stringify(jsonData, null, 2);
  
  const copyJson = () => {
    try { navigator.clipboard?.writeText(jsonString); } catch(e) {}
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };
  
  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `soulprint-image-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };
  
  const saveToGallery = async () => {
    if (saving || savedToGallery) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/media/save-to-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url,
          prompt: revisedPrompt || '',
          model: generationParams?.model || modelLabel || 'unknown',
          modelLabel: modelLabel || 'AI Generated',
        }),
      });
      if (res.ok) {
        setSavedToGallery(true);
      }
    } catch (e) {
      console.error('Failed to save to gallery:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateWith = (modelId) => {
    setShowModelPicker(false);
    const originalPrompt = generationParams?.prompt || revisedPrompt || 'Regenerate this image';
    if (onRegenerateWith) {
      // Pass image URL for regeneration context
      onRegenerateWith(originalPrompt, modelId, {
        type: 'image',
        imageUrl: url
      });
    }
  };
  
  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#141a21]">
      <div className="relative group">
        {!loaded && (
          <div className="w-full h-48 flex items-center justify-center bg-white/3">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500/50" />
          </div>
        )}
        <img
          src={url}
          alt={revisedPrompt || 'Generated image'}
          className={`w-full max-h-96 object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
          onLoad={() => setLoaded(true)}
        />
        {/* Edit button - visible on mobile, hover on desktop */}
        {onEdit && loaded && (
          <button
            onClick={() => onEdit({ url, source: 'generated' })}
            className="absolute top-2 right-2 px-3 py-1.5 bg-purple-500/90 hover:bg-purple-600 text-white text-xs rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all flex items-center gap-1.5 shadow-lg backdrop-blur-sm"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Generated with {modelLabel || 'AI'}
            </p>
            {revisedPrompt && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{revisedPrompt}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={saveToGallery}
              disabled={saving || savedToGallery}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs rounded-lg transition-colors whitespace-nowrap ${
                savedToGallery 
                  ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                  : saving
                    ? 'bg-white/5 border-white/10 text-gray-500 cursor-wait'
                    : 'bg-purple-500/15 border-purple-500/30 text-purple-400 hover:bg-purple-500/25'
              }`}
            >
              {savedToGallery ? <><Check className="w-3.5 h-3.5" /> Saved</> : saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><GalleryHorizontal className="w-3.5 h-3.5" /> Gallery</>}
            </button>
            <button
              onClick={() => setShowJson(!showJson)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs rounded-lg transition-colors whitespace-nowrap ${
                showJson 
                  ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Code className="w-3.5 h-3.5" /> JSON
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-lg hover:bg-orange-500/25 transition-colors whitespace-nowrap">
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          </div>
        </div>
        
        {/* Try Different Model */}
        {onRegenerateWith && (generationParams?.prompt || revisedPrompt) && (
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-lg hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Different Model
            </button>
            {showModelPicker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f26] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                {IMAGE_MODELS_LIST.filter(m => !modelLabel?.toLowerCase().includes(m.label.toLowerCase().split(' ')[0])).map(model => (
                  <button
                    key={model.id}
                    onClick={() => handleRegenerateWith(model.id)}
                    className="w-full px-3 py-2.5 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                  >
                    <p className="text-xs font-medium text-white">{model.label}</p>
                    <p className="text-[10px] text-gray-500">{model.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* JSON Panel */}
        {showJson && (
          <div className="bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/3">
              <span className="text-[10px] text-gray-500 font-mono">Generation Parameters</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyJson}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                    jsonCopied 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {jsonCopied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
                <button
                  onClick={downloadJson}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] bg-white/5 text-gray-400 hover:bg-white/10 rounded transition-colors"
                >
                  <Download className="w-3 h-3" /> Download
                </button>
              </div>
            </div>
            <pre className="p-3 text-[10px] text-gray-400 font-mono overflow-x-auto max-h-48 overflow-y-auto">
              {jsonString}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}


export default ImageCard;
