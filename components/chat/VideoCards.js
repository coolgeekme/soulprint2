'use client';
import { useState, useEffect, useRef } from 'react';
import { Film, Loader2, X, Square, Check, Download, RefreshCw, GalleryHorizontal, Sparkles } from 'lucide-react';

// ── VideoCard: polls for video status and renders player when ready ──────────
function VideoCard({ taskId, prompt, token, initialStatus = 'generating', modelLabel, messageId, onVideoReady, videoModelReason, onCancel, onRegenerateWith, sourceImageUrl }) {
  const [status, setStatus] = useState(initialStatus);
  const [videoUrl, setVideoUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [error, setError] = useState(null);
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const pollRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const onVideoReadyRef = useRef(onVideoReady);
  const cancelledRef = useRef(false);
  useEffect(() => { onVideoReadyRef.current = onVideoReady; }, [onVideoReady]);

  // Available video models for regeneration
  const VIDEO_MODELS_LIST = [
    { id: 'kling-3.0', label: 'Kling 3.0', description: 'Fast, general purpose' },
    { id: 'veo3', label: 'Veo 3.1', description: 'Cinematic, 1080p' },
    { id: 'runway-aleph', label: 'Runway Aleph', description: 'Creative, artistic' },
  ];

  const handleCancel = () => {
    cancelledRef.current = true;
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    setStatus('cancelled');
    if (onCancel) onCancel(taskId);
  };

  const handleRegenerateWith = (modelId) => {
    setShowModelPicker(false);
    if (onRegenerateWith) {
      // Pass media context for image-to-video regeneration
      onRegenerateWith(prompt, modelId, {
        type: 'video',
        sourceImageUrl: sourceImageUrl,
        videoUrl: videoUrl
      });
    }
  };

  useEffect(() => {
    if (status === 'success' || status === 'failed' || status === 'cancelled') return;
    const poll = async () => {
      if (cancelledRef.current) return;
      try {
        const res = await fetch(`/api/media/status/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (cancelledRef.current) return;
        if (d.status === 'success' || d.status === 'completed') {
          const vUrl = d.videoUrl || d.url;
          const tUrl = d.thumbnailUrl || d.thumbnail_url;
          setStatus('success');
          setVideoUrl(vUrl);
          setThumbnailUrl(tUrl);
          setProgress(100);
          clearInterval(pollRef.current);
          // Persist video_url to the message in DB so it survives navigation
          if (messageId && vUrl) {
            fetch(`/api/messages/${messageId}/video-complete`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ video_url: vUrl, thumbnail_url: tUrl }),
            }).catch(() => {});
          }
          if (onVideoReadyRef.current) onVideoReadyRef.current(vUrl);
        } else if (d.status === 'failed') {
          setStatus('failed');
          setError(d.error || 'Generation failed');
          clearInterval(pollRef.current);
        } else {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const estimatedProgress = Math.min(90, Math.round((elapsed / 120) * 90));
          setProgress(estimatedProgress);
        }
      } catch (e) {}
    };
    poll();
    pollRef.current = setInterval(poll, 6000);
    return () => clearInterval(pollRef.current);
  }, [taskId, status, token, messageId]);

  const saveToGallery = async () => {
    if (saving || savedToGallery || !videoUrl) return;
    setSaving(true);
    try {
      const res = await fetch('/api/media/save-to-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url: videoUrl,
          prompt: prompt || '',
          model: modelLabel || 'unknown',
          modelLabel: modelLabel || 'AI Generated',
          type: 'video',
        }),
      });
      if (res.ok) setSavedToGallery(true);
    } catch (e) {
      console.error('Failed to save video to gallery:', e);
    } finally {
      setSaving(false);
    }
  };

  if (status === 'success' && videoUrl) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#141a21]">
        <div className="relative group bg-black">
          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full max-h-96 object-contain"
            poster={thumbnailUrl || undefined}
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" /> Generated with {modelLabel || 'AI'}
              </p>
              {prompt && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{prompt}</p>}
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
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" download
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-lg hover:bg-orange-500/25 transition-colors whitespace-nowrap">
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          </div>
          {/* Try Different Model */}
          {onRegenerateWith && (
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-lg hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Different Model
              </button>
              {showModelPicker && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f26] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                  {VIDEO_MODELS_LIST.filter(m => m.label !== modelLabel).map(model => (
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
        </div>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="mt-3 rounded-xl border border-gray-500/20 bg-gray-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-500/15 flex items-center justify-center flex-shrink-0">
            <Square className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400">Video generation cancelled</p>
            <p className="text-[10px] text-gray-500 mt-0.5">You stopped this generation</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-red-400">Video generation failed</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Generating state — animated loading card matching image generation UX
  return (
    <div className="mt-3 rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-purple-500/5 p-4 overflow-hidden relative">
      {/* Animated background shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-pulse" />
      <div className="relative">
        {/* Video preview placeholder */}
        <div className="aspect-video rounded-lg bg-black/30 border border-white/5 mb-3 flex items-center justify-center overflow-hidden">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-2">
              <Film className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
            <p className="text-xs font-medium text-blue-400">Creating your video...</p>
            <p className="text-[10px] text-gray-600 mt-1">{modelLabel || 'AI'}</p>
          </div>
        </div>
        {/* Model selection reason badge */}
        {videoModelReason && (
          <div className="mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" />
            <p className="text-[10px] text-purple-300/80 truncate">
              <span className="font-medium text-purple-300">Dynamic Intelligence:</span> {videoModelReason}
            </p>
          </div>
        )}
        {/* Progress bar */}
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-2">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
            <p className="text-[11px] text-gray-400">
              {progress < 30 ? 'Queuing...' : progress < 60 ? 'Rendering frames...' : progress < 90 ? 'Almost done...' : 'Finalizing...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-gray-600">~1-3 min</p>
            <button
              onClick={handleCancel}
              className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-700 mt-2 truncate italic">"{prompt}"</p>
        {/* Leave notification hint */}
        <div className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
          <span className="text-[10px]">💡</span>
          <p className="text-[10px] text-cyan-400/70">You can leave this chat — we'll notify you when it's ready.</p>
        </div>
      </div>
    </div>
  );
}

// ── SavedVideoCard: renders a saved video with matching image card UX ────────
function SavedVideoCard({ videoUrl, modelLabel, prompt, token, onRegenerateWith, sourceImageUrl }) {
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Available video models for regeneration
  const VIDEO_MODELS_LIST = [
    { id: 'kling-3.0', label: 'Kling 3.0', description: 'Fast, general purpose' },
    { id: 'veo3', label: 'Veo 3.1', description: 'Cinematic, 1080p' },
    { id: 'runway-aleph', label: 'Runway Aleph', description: 'Creative, artistic' },
  ];

  const saveToGallery = async () => {
    if (saving || savedToGallery || !videoUrl) return;
    setSaving(true);
    try {
      const res = await fetch('/api/media/save-to-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url: videoUrl,
          prompt: prompt || '',
          model: modelLabel || 'unknown',
          modelLabel: modelLabel || 'AI Generated',
          type: 'video',
        }),
      });
      if (res.ok) setSavedToGallery(true);
    } catch (e) {
      console.error('Failed to save video to gallery:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateWith = (modelId) => {
    setShowModelPicker(false);
    const actualPrompt = prompt || 'Regenerate this video';
    if (onRegenerateWith) {
      // Pass media context for regeneration
      onRegenerateWith(actualPrompt, modelId, {
        type: 'video',
        sourceImageUrl: sourceImageUrl,
        videoUrl: videoUrl
      });
    }
  };

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-[#141a21]">
      <div className="relative group bg-black">
        <video
          src={videoUrl}
          controls
          playsInline
          className="w-full max-h-60 sm:max-h-96 object-contain"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" /> {modelLabel ? `Generated with ${modelLabel}` : 'Video'}
            </p>
            {prompt && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{prompt}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={saveToGallery}
              disabled={saving || savedToGallery}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 border text-[11px] sm:text-xs rounded-lg transition-colors whitespace-nowrap ${
                savedToGallery 
                  ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                  : saving
                    ? 'bg-white/5 border-white/10 text-gray-500 cursor-wait'
                    : 'bg-purple-500/15 border-purple-500/30 text-purple-400 hover:bg-purple-500/25'
              }`}
            >
              {savedToGallery ? <><Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Saved</> : saving ? <><Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" /> ...</> : <><GalleryHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Gallery</>}
            </button>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" download
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[11px] sm:text-xs rounded-lg hover:bg-orange-500/25 transition-colors whitespace-nowrap">
              <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Download
            </a>
          </div>
        </div>
        {/* Try Different Model */}
        {onRegenerateWith && prompt && (
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-lg hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Different Model
            </button>
            {showModelPicker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f26] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                {VIDEO_MODELS_LIST.filter(m => !modelLabel?.toLowerCase().includes(m.label.toLowerCase().split(' ')[0])).map(model => (
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
      </div>
    </div>
  );
}


export { VideoCard, SavedVideoCard };
