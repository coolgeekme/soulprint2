'use client';
import { useState, useRef, useEffect } from 'react';
import { 
  Settings, X, Loader2, Plus, Sparkles, Shield, Home,
  Video, Image as ImageIcon,
  Film, GalleryHorizontal, Upload, MapPin, ChevronDown, Check, Globe, Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SparklesIcon, AttachIcon } from '@/components/icons/SoulPrintIcons';

const MoreOptionsSheet = ({ isOpen, onClose, onSettings }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">Options</h3>
        <div className="space-y-2">
          <button 
            onClick={() => { window.location.href = '/'; onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Home className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <span className="text-white font-medium">Visit Website</span>
              <p className="text-gray-500 text-xs">Check out new features and updates</p>
            </div>
          </button>
          <button 
            onClick={() => { onSettings?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <span className="text-white font-medium">Settings</span>
              <p className="text-gray-500 text-xs">Customize your experience</p>
            </div>
          </button>
        </div>
        <button onClick={onClose} className="w-full mt-4 p-4 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Attachment/Create Options Sheet (+ button menu)
const CreateOptionsSheet = ({ isOpen, onClose, onFileSelect, onCameraSelect, onImageGen, onVideoGen, onCompare, onGallery, onNewConversation }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">Create</h3>
        <div className="space-y-2">
          {/* New Conversation - First Option */}
          <button 
            onClick={() => { onNewConversation?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-orange-500/30 flex items-center justify-center">
              <Plus className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <span className="text-white font-medium">New Conversation</span>
              <p className="text-gray-500 text-xs">Start a fresh chat</p>
            </div>
          </button>

          {/* Image/Video generation removed - handled dynamically through chat */}
          
          {/* Compare Models */}
          <button 
            onClick={() => { onCompare?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-white font-medium">Compare Models</span>
              <p className="text-gray-500 text-xs">Compare responses from multiple AI models</p>
            </div>
          </button>
          
          {/* Media Gallery */}
          <button 
            onClick={() => { onGallery?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-white font-medium">Media Gallery</span>
              <p className="text-gray-500 text-xs">View your generated images and videos</p>
            </div>
          </button>
          
          {/* Divider */}
          <div className="border-t border-white/10 my-3"></div>
          
          {/* Attach File */}
          <button 
            onClick={() => { onFileSelect?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <AttachIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-white font-medium">Attach File</span>
              <p className="text-gray-500 text-xs">Upload documents and files</p>
            </div>
          </button>
          
          {/* Take Photo */}
          <button 
            onClick={() => { onCameraSelect?.(); onClose(); }}
            className="w-full p-4 rounded-2xl bg-white/5 text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <span className="text-white font-medium">Take Photo</span>
              <p className="text-gray-500 text-xs">Capture with camera</p>
            </div>
          </button>
        </div>
        <button onClick={onClose} className="w-full mt-4 p-4 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Image Generation Sheet
const ImageGenSheet = ({ 
  isOpen, onClose, models, selectedModel, onModelChange, 
  aspectRatios, selectedAspect, onAspectChange,
  prompt, onPromptChange, onGenerate, isGenerating 
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">🎨 Generate Image</h3>
        
        {/* Prompt */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Describe your image</label>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="A serene mountain landscape at sunset..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 resize-none h-24 focus:outline-none focus:border-orange-500/50"
          />
        </div>

        {/* Model Selection */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Model</label>
          <div className="grid grid-cols-2 gap-2">
            {models.map(model => (
              <button
                key={model.value}
                onClick={() => onModelChange(model.value)}
                className={`p-3 rounded-xl text-left transition-colors ${
                  selectedModel === model.value
                    ? 'bg-purple-500/20 border border-purple-500/50'
                    : 'bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-white text-sm font-medium block">{model.label}</span>
                <span className="text-gray-500 text-xs">{model.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className="mb-6">
          <label className="text-gray-400 text-xs mb-2 block">Aspect Ratio</label>
          <div className="flex gap-2">
            {aspectRatios.map(ar => (
              <button
                key={ar.value}
                onClick={() => onAspectChange(ar.value)}
                className={`flex-1 p-2 rounded-xl text-center text-sm transition-colors ${
                  selectedAspect === ar.value
                    ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400'
                    : 'bg-white/5 border border-transparent text-gray-400'
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={() => onGenerate('image')}
          disabled={!prompt.trim() || isGenerating}
          className={`w-full p-4 rounded-xl font-medium transition-all ${
            prompt.trim() && !isGenerating
              ? 'bg-purple-500 text-white'
              : 'bg-white/10 text-gray-500'
          }`}
        >
          {isGenerating ? 'Generating...' : '✨ Generate Image'}
        </button>
        
        <button onClick={onClose} className="w-full mt-3 p-3 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Video Generation Sheet
const VideoGenSheet = ({ 
  isOpen, onClose, models, selectedModel, onModelChange, 
  prompt, onPromptChange, onGenerate, isGenerating 
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-4">🎬 Generate Video</h3>
        
        {/* Prompt */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Describe your video</label>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="A butterfly landing on a flower in slow motion..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 resize-none h-24 focus:outline-none focus:border-pink-500/50"
          />
        </div>

        {/* Model Selection */}
        <div className="mb-6">
          <label className="text-gray-400 text-xs mb-2 block">Model</label>
          <div className="space-y-2">
            {models.map(model => (
              <button
                key={model.value}
                onClick={() => onModelChange(model.value)}
                className={`w-full p-3 rounded-xl text-left transition-colors ${
                  selectedModel === model.value
                    ? 'bg-pink-500/20 border border-pink-500/50'
                    : 'bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-white text-sm font-medium">{model.label}</span>
                <span className="text-gray-500 text-xs ml-2">{model.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={() => onGenerate('video')}
          disabled={!prompt.trim() || isGenerating}
          className={`w-full p-4 rounded-xl font-medium transition-all ${
            prompt.trim() && !isGenerating
              ? 'bg-pink-500 text-white'
              : 'bg-white/10 text-gray-500'
          }`}
        >
          {isGenerating ? 'Generating...' : '🎬 Generate Video'}
        </button>
        
        <button onClick={onClose} className="w-full mt-3 p-3 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Flyer Generation Sheet
const FlyerGenSheet = ({ 
  isOpen, onClose, onGenerate, isGenerating 
}) => {
  const [flyerPrompt, setFlyerPrompt] = useState('');
  const [flyerType, setFlyerType] = useState('promotional');
  const [flyerSize, setFlyerSize] = useState('8.5x11');
  const [outputFormat, setOutputFormat] = useState('png');
  
  const flyerTypes = [
    { value: 'promotional', label: '🎉 Promotional', desc: 'Events, sales, announcements' },
    { value: 'informational', label: '📋 Informational', desc: 'Classes, services, programs' },
    { value: 'social', label: '📱 Social Media', desc: 'Instagram, Facebook posts' },
    { value: 'poster', label: '🖼️ Poster', desc: 'Large format displays' },
  ];
  
  const flyerSizes = [
    { value: '8.5x11', label: 'Letter (8.5×11")', aspect: '8.5:11' },
    { value: '11x17', label: 'Tabloid (11×17")', aspect: '11:17' },
    { value: '1080x1080', label: 'Square (1080×1080)', aspect: '1:1' },
    { value: '1080x1920', label: 'Story (1080×1920)', aspect: '9:16' },
  ];
  
  if (!isOpen) return null;
  
  const handleGenerate = () => {
    const sizeInfo = flyerSizes.find(s => s.value === flyerSize);
    const fullPrompt = `Create a professional ${flyerType} flyer with the following details: ${flyerPrompt}. 
    
Design requirements:
- Size: ${sizeInfo?.label}
- Style: Modern, professional, eye-catching
- Include all text clearly and legibly
- Use appropriate colors and imagery
- Make it print-ready with proper margins`;
    
    onGenerate(fullPrompt, sizeInfo?.aspect || '8.5:11', outputFormat);
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-1">📄 Generate Flyer</h3>
        <p className="text-gray-500 text-xs mb-4">Create professional flyers, posters & promotional materials</p>
        
        {/* Flyer Description */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">What's the flyer about?</label>
          <textarea
            value={flyerPrompt}
            onChange={(e) => setFlyerPrompt(e.target.value)}
            placeholder="Pickleball clinic on March 22nd at Johnson Park. $25 per person. Beginners welcome. Contact coach@example.com..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 resize-none h-28 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Flyer Type */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Flyer Type</label>
          <div className="grid grid-cols-2 gap-2">
            {flyerTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setFlyerType(type.value)}
                className={`p-3 rounded-xl text-left transition-colors ${
                  flyerType === type.value
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-white text-sm font-medium">{type.label}</span>
                <p className="text-gray-500 text-[10px]">{type.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Size Selection */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Size</label>
          <div className="grid grid-cols-2 gap-2">
            {flyerSizes.map(size => (
              <button
                key={size.value}
                onClick={() => setFlyerSize(size.value)}
                className={`p-3 rounded-xl text-center transition-colors ${
                  flyerSize === size.value
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-white text-sm">{size.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Output Format */}
        <div className="mb-6">
          <label className="text-gray-400 text-xs mb-2 block">Output Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setOutputFormat('png')}
              className={`flex-1 p-3 rounded-xl transition-colors ${
                outputFormat === 'png'
                  ? 'bg-cyan-500/20 border border-cyan-500/50'
                  : 'bg-white/5 border border-transparent'
              }`}
            >
              <span className="text-white text-sm font-medium">PNG</span>
              <p className="text-gray-500 text-[10px]">Best for digital</p>
            </button>
            <button
              onClick={() => setOutputFormat('pdf')}
              className={`flex-1 p-3 rounded-xl transition-colors ${
                outputFormat === 'pdf'
                  ? 'bg-cyan-500/20 border border-cyan-500/50'
                  : 'bg-white/5 border border-transparent'
              }`}
            >
              <span className="text-white text-sm font-medium">PDF</span>
              <p className="text-gray-500 text-[10px]">Best for printing</p>
            </button>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!flyerPrompt.trim() || isGenerating}
          className={`w-full p-4 rounded-xl font-medium transition-all ${
            flyerPrompt.trim() && !isGenerating
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
              : 'bg-white/10 text-gray-500'
          }`}
        >
          {isGenerating ? 'Generating...' : '✨ Generate Flyer'}
        </button>
        
        <p className="text-gray-600 text-[10px] text-center mt-3">
          Tip: Be specific! Include dates, times, locations, pricing, and contact info.
        </p>
        
        <button onClick={onClose} className="w-full mt-3 p-3 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Rename Conversation Modal

const CompareModeSheet = ({ 
  isOpen, onClose, models, selectedModels, onToggleModel, onCompare 
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        <h3 className="text-white font-semibold text-lg mb-2">Compare Models</h3>
        <p className="text-gray-500 text-sm mb-4">Select 2+ models to compare their responses</p>
        
        <div className="space-y-2 mb-6">
          {models.filter(m => !m.comingSoon).map(model => (
            <button
              key={model.value}
              onClick={() => onToggleModel(model.value)}
              className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition-colors ${
                selectedModels.includes(model.value)
                  ? 'bg-blue-500/20 border border-blue-500/50'
                  : 'bg-white/5 border border-transparent'
              }`}
            >
              <div>
                <span className="text-white text-sm font-medium">{model.label}</span>
                <span className="text-gray-500 text-xs ml-2">{model.group}</span>
              </div>
              {selectedModels.includes(model.value) && (
                <Check className="w-5 h-5 text-blue-400" />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onCompare}
          disabled={selectedModels.length < 2}
          className={`w-full p-4 rounded-xl font-medium transition-all ${
            selectedModels.length >= 2
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-gray-500'
          }`}
        >
          Compare {selectedModels.length} Models
        </button>
        
        <button onClick={onClose} className="w-full mt-3 p-3 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Compare Results View
const CompareResultsView = ({ responses, onSelect, onClose }) => {
  if (!responses) return null;
  
  return (
    <div className="fixed inset-0 bg-sp-black z-[60] overflow-y-auto">
      <div className="safe-area-top bg-sp-black p-4 flex items-center gap-3 border-b border-white/10 sticky top-0">
        <button onClick={onClose} className="p-2 text-gray-400">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-white font-semibold text-lg">Compare Results</h3>
      </div>
      
      <div className="p-4 space-y-4 pb-20">
        {responses.map((resp, idx) => (
          <div key={idx} className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-orange-400 font-medium text-sm">{resp.model}</span>
              <button
                onClick={() => onSelect(resp)}
                className="px-3 py-1 bg-orange-500 text-white text-xs rounded-full"
              >
                Use This
              </button>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">{resp.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Chat History Import Sheet - Unified import for all platforms
const ImportSheet = ({ isOpen, onClose, onImport, isUploading, uploadProgress }) => {
  const fileRef = useRef(null);
  const wakeLockRef = useRef(null);
  
  // Request wake lock to prevent screen from turning off during upload
  useEffect(() => {
    const requestWakeLock = async () => {
      if (isUploading && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Wake lock acquired for upload');
        } catch (err) {
          console.log('Wake lock failed:', err);
        }
      }
    };
    
    const releaseWakeLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake lock released');
      }
    };
    
    if (isUploading) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    
    // Re-acquire wake lock if page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isUploading) {
        requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUploading]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={isUploading ? undefined : onClose}>
      <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Import History</h3>
          <p className="text-gray-500 text-sm">Currently supports ChatGPT • More platforms coming soon</p>
        </div>
        
        <input
          type="file"
          ref={fileRef}
          accept=".zip"
          onChange={(e) => onImport(e.target.files?.[0])}
          className="hidden"
        />
        
        {isUploading ? (
          <div className="text-center py-6">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-3" />
            <p className="text-white text-sm font-medium">{uploadProgress || 'Processing...'}</p>
            <p className="text-gray-500 text-xs mt-2">Keep this screen open</p>
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-xs">
                💡 Screen will stay on during upload
              </p>
            </div>
          </div>
        ) : (
          <>
            <button 
              onClick={() => fileRef.current?.click()}
              className="w-full p-4 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-center mb-4 hover:bg-orange-500/30 transition-colors"
            >
              <Upload className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <span className="text-white font-medium block">Choose ZIP File</span>
              <p className="text-orange-400/70 text-xs mt-1">We auto-detect the format</p>
            </button>
            
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs rounded-full">ChatGPT</span>
              <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">Facebook</span>
              <span className="px-2.5 py-1 bg-orange-500/10 text-orange-300 text-xs rounded-full">Claude</span>
              <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">Google</span>
            </div>
            
            <p className="text-gray-600 text-[10px] text-center mb-4 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3 text-green-500" />
              <span className="text-green-500/80">Messages analyzed then deleted — only insights kept for your SoulPrint</span>
            </p>
          </>
        )}
        
        <button 
          onClick={onClose} 
          disabled={isUploading}
          className={`w-full p-3 text-sm ${isUploading ? 'text-gray-700 cursor-not-allowed' : 'text-gray-500'}`}
        >
          {isUploading ? 'Please wait...' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};

// Main Mobile Chat Component

export { MoreOptionsSheet, CreateOptionsSheet, ImageGenSheet, VideoGenSheet, FlyerGenSheet, CompareModeSheet, CompareResultsView, ImportSheet };
