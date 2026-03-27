'use client';
import { useState, useRef, useEffect } from 'react';
import { ImagePlus, Film, Palette, Sparkles, ChevronDown, Loader2, Check, Upload } from 'lucide-react';
import { IMAGE_MODELS, VIDEO_MODELS } from './constants';

// ── CreateMenu: Dropdown for Image/Video generation ──────────────────────────
function CreateMenu({ onGenerate, isGenerating }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('image'); // 'image' or 'video'
  const [selectedImageModel, setSelectedImageModel] = useState(IMAGE_MODELS[0].value);
  const [selectedVideoModel, setSelectedVideoModel] = useState(VIDEO_MODELS[0].value);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [loadedFromJson, setLoadedFromJson] = useState(false);
  const jsonInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const model = activeTab === 'image' ? selectedImageModel : selectedVideoModel;
    onGenerate({
      type: activeTab,
      model,
      prompt: prompt.trim(),
      aspectRatio,
    });
    setPrompt('');
    setLoadedFromJson(false);
    setIsOpen(false);
  };

  // Handle JSON file upload to pre-fill generation params
  const handleJsonUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        
        // Validate it's an image generation JSON
        if (json.type === 'image' || json.prompt) {
          setActiveTab('image');
          
          // Set prompt
          if (json.prompt) setPrompt(json.prompt);
          
          // Set model if it matches available models
          if (json.model && IMAGE_MODELS.some(m => m.value === json.model)) {
            setSelectedImageModel(json.model);
          }
          
          // Set aspect ratio
          if (json.aspectRatio && ['1:1', '16:9', '9:16', '4:3'].includes(json.aspectRatio)) {
            setAspectRatio(json.aspectRatio);
          }
          
          setLoadedFromJson(true);
        } else if (json.type === 'video') {
          setActiveTab('video');
          if (json.prompt) setPrompt(json.prompt);
          if (json.model && VIDEO_MODELS.some(m => m.value === json.model)) {
            setSelectedVideoModel(json.model);
          }
          setLoadedFromJson(true);
        } else {
          alert('Invalid JSON format. Expected an image/video generation config.');
        }
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const currentImageModel = IMAGE_MODELS.find(m => m.value === selectedImageModel) || IMAGE_MODELS[0];
  const currentVideoModel = VIDEO_MODELS.find(m => m.value === selectedVideoModel) || VIDEO_MODELS[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isGenerating}
        className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
          isOpen 
            ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white' 
            : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
        } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Create Image or Video"
      >
        {isGenerating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <SparklesIcon className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-[#141a21] border border-white/10 rounded-2xl shadow-2xl w-[calc(100vw-2rem)] sm:w-80 max-w-80 overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
             style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {/* Tabs */}
          <div className="flex border-b border-white/10 sticky top-0 bg-[#141a21] z-10">
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                activeTab === 'image' ? 'text-pink-400 bg-pink-500/10 border-b-2 border-pink-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <ImagePlusIcon className="w-4 h-4" />
              Image
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                activeTab === 'video' ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <VideoIcon className="w-4 h-4" />
              Video
            </button>
          </div>

          {/* Load from JSON option */}
          <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-0">
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleJsonUpload}
              className="hidden"
            />
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 border border-dashed border-white/20 rounded-lg text-xs text-gray-400 hover:text-white hover:border-white/40 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Load from JSON
            </button>
            {loadedFromJson && (
              <p className="text-[10px] text-green-400 text-center mt-1.5 flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> Loaded from JSON — tweak and regenerate
              </p>
            )}
          </div>

          <div className="p-3 sm:p-4 space-y-3">
            {/* Model Selector */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 block">
                {activeTab === 'image' ? 'Image Model' : 'Video Model'}
              </label>
              <div className="space-y-1 max-h-28 sm:max-h-32 overflow-y-auto">
                {(activeTab === 'image' ? IMAGE_MODELS : VIDEO_MODELS).map(model => (
                  <button
                    key={model.value}
                    onClick={() => activeTab === 'image' ? setSelectedImageModel(model.value) : setSelectedVideoModel(model.value)}
                    className={`w-full flex items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      (activeTab === 'image' ? selectedImageModel : selectedVideoModel) === model.value
                        ? 'bg-gradient-to-r from-pink-500/20 to-blue-500/20 border border-pink-500/30 text-white'
                        : 'bg-white/3 border border-white/5 text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-[11px]">{model.label}</span>
                      <span className="text-[9px] text-gray-600">{model.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio for Images */}
            {activeTab === 'image' && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 block">Aspect Ratio</label>
                <div className="flex gap-1.5">
                  {['1:1', '16:9', '9:16', '4:3'].map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${
                        aspectRatio === ratio
                          ? 'bg-pink-500/20 border border-pink-500/40 text-pink-400'
                          : 'bg-white/5 border border-white/10 text-gray-500 hover:text-white'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt Input */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 block">
                Describe what you want
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTab === 'image' 
                  ? "A serene mountain landscape at sunset..."
                  : "A cinematic drone shot flying through a city..."
                }
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-pink-500/50"
                rows={2}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className={`w-full py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                prompt.trim()
                  ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white hover:from-pink-600 hover:to-purple-600'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              <SparklesIcon className="w-4 h-4" />
              Generate {activeTab === 'image' ? 'Image' : 'Video'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export default CreateMenu;
