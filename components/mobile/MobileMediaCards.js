'use client';
import { useState, useEffect, useRef } from 'react';
import { Film, Loader2, X, Square, Check, Download, RefreshCw, GalleryHorizontal, Sparkles, Image as ImageIcon, FastForward } from 'lucide-react';

// ── Mobile download helper — uses backend proxy for reliable cross-origin downloads ──
function useMobileDownload() {
  const [downloading, setDownloading] = useState(false);
  
  const handleDownload = async (url) => {
    if (downloading || !url) return;
    setDownloading(true);
    try {
      // Fetch through same-origin proxy — this avoids CORS issues and
      // lets us use <a download> reliably on ALL browsers (including iOS Safari)
      const proxyUrl = `/api/media/download?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cd = res.headers.get('content-disposition');
      const filenameMatch = cd?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || `soulprint-${Date.now()}.${blob.type.includes('video') ? 'mp4' : 'png'}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      // Cleanup after a delay
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 2000);
    } catch (e) {
      console.error('Download error:', e);
      // Last resort fallback: open the proxy URL directly (triggers browser download)
      const proxyUrl = `/api/media/download?url=${encodeURIComponent(url)}`;
      window.location.href = proxyUrl;
    } finally {
      setTimeout(() => setDownloading(false), 3000);
    }
  };
  
  return { downloading, handleDownload };
}

// ── MobileImageCard: image display with Save to Gallery button ─────────────
function MobileImageCard({ url, modelLabel, token, prompt, onRegenerateWith }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgSrc, setImgSrc] = useState(url);
  const [retryCount, setRetryCount] = useState(0);
  const { downloading, handleDownload } = useMobileDownload();
  
  // Available image models for regeneration
  const IMAGE_MODELS = [
    { id: 'nano-banana', label: 'Nano Banana', description: 'Fast, versatile' },
    { id: 'gemini-2.0-flash-exp-image-generation', label: 'Gemini Image', description: 'High quality' },
    { id: 'gpt-image-1', label: 'GPT Image', description: 'Creative, detailed' },
  ];
  
  const saveToGallery = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const res = await fetch('/api/media/save-to-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url, model: modelLabel || 'unknown', modelLabel: modelLabel || 'AI Generated' }),
      });
      if (res.ok) setSaved(true);
    } catch (e) {
      console.error('Failed to save to gallery:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateWith = (modelId) => {
    setShowModelPicker(false);
    const actualPrompt = prompt || 'Regenerate this image';
    if (onRegenerateWith) {
      // Pass image URL for regeneration context
      onRegenerateWith(actualPrompt, modelId, {
        type: 'image',
        imageUrl: url
      });
    }
  };
  
  return (
    <div className="mb-3 rounded-2xl overflow-hidden border border-white/10 bg-[#141a21]">
      {imgError ? (
        <div className="w-full h-48 flex flex-col items-center justify-center bg-white/3 gap-2">
          <ImageIcon className="w-8 h-8 text-gray-500" />
          <p className="text-gray-500 text-xs">Image unavailable or link expired</p>
          <div className="flex items-center gap-3">
            {retryCount < 3 && (
              <button 
                onClick={() => {
                  const sep = url.includes('?') ? '&' : '?';
                  setImgSrc(`${url}${sep}_t=${Date.now()}`);
                  setRetryCount(prev => prev + 1);
                  setImgError(false);
                }}
                className="text-orange-400 hover:text-orange-300 text-xs underline"
              >
                Try again
              </button>
            )}
            {onRegenerateWith && prompt && (
              <button 
                onClick={() => onRegenerateWith(prompt, 'nano-banana', { type: 'image', imageUrl: url })}
                className="text-blue-400 hover:text-blue-300 text-xs underline"
              >
                Regenerate
              </button>
            )}
          </div>
        </div>
      ) : (
        <img src={imgSrc} alt="Generated" className="w-full h-auto max-h-80 object-contain bg-black/20" onError={() => setImgError(true)} />
      )}
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-orange-400 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> {modelLabel ? `Generated with ${modelLabel}` : 'AI Generated'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveToGallery}
              disabled={saving || saved}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg transition-colors ${
                saved ? 'bg-green-500/20 text-green-400' : saving ? 'text-gray-500' : 'bg-purple-500/15 text-purple-400 active:bg-purple-500/25'
              }`}
            >
              {saved ? '✓ Saved' : saving ? '...' : '📁 Gallery'}
            </button>
            <button onClick={() => handleDownload(url)} disabled={downloading}
              className="flex items-center gap-1 px-2.5 py-1 bg-orange-500/15 text-orange-400 text-[11px] rounded-lg active:bg-orange-500/25 disabled:opacity-50">
              {downloading ? '⏳ Saving...' : '↓ Save'}
            </button>
          </div>
        </div>
        {/* Try Different Model - always show if callback is provided */}
        {onRegenerateWith && (
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-[11px] rounded-lg active:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Try Different Model
            </button>
            {showModelPicker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f26] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                {IMAGE_MODELS.filter(m => !modelLabel?.toLowerCase().includes(m.label.toLowerCase().split(' ')[0])).map(model => (
                  <button
                    key={model.id}
                    onClick={() => handleRegenerateWith(model.id)}
                    className="w-full px-3 py-2 text-left hover:bg-white/5 active:bg-white/10 border-b border-white/5 last:border-0"
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

// ── MobileVideoCard: handles video generation with polling ─────────────────
function MobileVideoCard({ taskId, prompt, token, initialStatus = 'generating', modelLabel, messageId, onVideoReady, onCancel, onRegenerateWith, sourceImageUrl }) {
  const { downloading, handleDownload } = useMobileDownload();
  const [status, setStatus] = useState(initialStatus);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Queuing your video...');
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [elapsedDisplay, setElapsedDisplay] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const pollRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const cancelledRef = useRef(false);

  // Determine model-specific timeouts from modelLabel
  const isVeo = modelLabel?.toLowerCase().includes('veo');
  const isRunway = modelLabel?.toLowerCase().includes('runway');

  // Available video models for regeneration
  const VIDEO_MODELS = [
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

  // Ref to hold the latest onVideoReady callback to avoid stale closures
  const onVideoReadyRef = useRef(onVideoReady);
  useEffect(() => { onVideoReadyRef.current = onVideoReady; }, [onVideoReady]);

  const [stuckWarning, setStuckWarning] = useState(false);
  // Model-aware timeouts: Veo gets 12 min, Runway 10 min, Kling 10 min
  const MAX_POLL_TIME = isVeo ? 12 * 60 * 1000 : 10 * 60 * 1000;
  const STUCK_WARNING_TIME = isVeo ? 8 * 60 * 1000 : isRunway ? 6 * 60 * 1000 : 5 * 60 * 1000;
  const consecutiveErrorsRef = useRef(0);

  // Default estimated time based on model
  const defaultEstimatedTime = isVeo ? '3-8 min' : isRunway ? '2-5 min' : '1-3 min';

  useEffect(() => {
    if (status === 'success' || status === 'failed' || status === 'cancelled') return;
    if (!token) return; // Don't poll without valid token
    
    const poll = async () => {
      if (cancelledRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      
      // Update elapsed display
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      setElapsedDisplay(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
      
      // Show warning after model-specific threshold
      if (elapsed > STUCK_WARNING_TIME && !stuckWarning) {
        setStuckWarning(true);
      }
      
      // Auto-fail after model-specific max poll time
      if (elapsed > MAX_POLL_TIME) {
        setStatus('failed');
        setError(`Video generation timed out after ${Math.round(elapsed/60000)} minutes. The provider may be experiencing delays. You can try again or use a different model.`);
        clearInterval(pollRef.current);
        return;
      }
      
      try {
        const res = await fetch(`/api/media/status/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          console.error(`[MobileVideoCard] Poll error: HTTP ${res.status} — ${errBody.substring(0, 200)}`);
          consecutiveErrorsRef.current++;
          if (consecutiveErrorsRef.current >= 5) {
            setStatus('failed');
            let errorMsg = 'Lost connection to video service. Please try again.';
            try {
              const parsed = JSON.parse(errBody);
              if (parsed.error) errorMsg = parsed.error;
            } catch {}
            setError(errorMsg);
            clearInterval(pollRef.current);
          }
          return;
        }
        consecutiveErrorsRef.current = 0;
        const d = await res.json();
        if (cancelledRef.current) return;
        if ((d.status === 'completed' || d.status === 'success') && (d.url || d.videoUrl)) {
          const vUrl = d.url || d.videoUrl;
          setStatus('success');
          setVideoUrl(vUrl);
          setProgress(100);
          setStatusMessage('Done!');
          clearInterval(pollRef.current);
          // Persist video_url to message DB so it survives navigation
          // Retry up to 3 times with exponential backoff for reliability
          if (messageId && vUrl) {
            const persistVideoUrl = async (attempt = 0) => {
              try {
                const patchRes = await fetch(`/api/messages/${messageId}/video-complete`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ video_url: vUrl, thumbnail_url: d.thumbnailUrl || d.thumbnail_url }),
                });
                if (!patchRes.ok && attempt < 2) {
                  await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                  return persistVideoUrl(attempt + 1);
                }
              } catch (e) {
                if (attempt < 2) {
                  await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                  return persistVideoUrl(attempt + 1);
                }
                console.error('[MobileVideoCard] Failed to persist video_url after 3 attempts:', e.message);
              }
            };
            persistVideoUrl();
          }
          // Use ref to get latest callback
          if (onVideoReadyRef.current) onVideoReadyRef.current(vUrl);
        } else if (d.status === 'failed') {
          setStatus('failed');
          setError(d.error || 'Generation failed');
          clearInterval(pollRef.current);
        } else {
          // Use backend-provided progress data if available
          if (d.progressPct !== undefined) {
            setProgress(d.progressPct);
          } else {
            const elapsedSec = elapsed / 1000;
            // Model-aware progress curve
            const midpoint = isVeo ? 330 : isRunway ? 210 : 120;
            let estimatedProgress;
            if (elapsedSec < midpoint) {
              estimatedProgress = Math.min(80, Math.round((elapsedSec / midpoint) * 80));
            } else {
              estimatedProgress = Math.min(95, 80 + Math.round(((elapsedSec - midpoint) / (midpoint * 0.8)) * 15));
            }
            setProgress(estimatedProgress);
          }
          // Use backend status message or generate locally
          if (d.statusMessage) {
            setStatusMessage(d.statusMessage);
          }
          if (d.estimatedTime) {
            setEstimatedTime(d.estimatedTime);
          }
        }
      } catch (e) {
        console.log('[MobileVideoCard] Poll error:', e.message);
        consecutiveErrorsRef.current++;
        if (consecutiveErrorsRef.current >= 5) {
          setStatus('failed');
          setError('Lost connection to video service. Please try again.');
          clearInterval(pollRef.current);
        }
      }
    };
    poll();
    pollRef.current = setInterval(poll, 5000); // Poll every 5 seconds
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
    } catch (e) {}
    finally { setSaving(false); }
  };

  if (status === 'success' && videoUrl) {
    return (
      <div className="mb-3 rounded-2xl overflow-hidden border border-white/10 bg-[#141a21]">
        <div className="bg-black">
          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full max-h-80 object-contain"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" /> Generated with {modelLabel || 'AI'}
              </p>
              {prompt && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{prompt}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveToGallery}
              disabled={saving || savedToGallery}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border text-xs rounded-xl transition-colors ${
                savedToGallery 
                  ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                  : saving
                    ? 'bg-white/5 border-white/10 text-gray-500'
                    : 'bg-purple-500/15 border-purple-500/30 text-purple-400 active:bg-purple-500/25'
              }`}
            >
              {savedToGallery ? <><Check className="w-3.5 h-3.5" /> Saved</> : saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><GalleryHorizontal className="w-3.5 h-3.5" /> Save to Gallery</>}
            </button>
            <button onClick={() => handleDownload(videoUrl)} disabled={downloading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-xl active:bg-orange-500/25 transition-colors disabled:opacity-50">
              {downloading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Download className="w-3.5 h-3.5" /> Download</>}
            </button>
          </div>
          {/* Try Different Model */}
          {onRegenerateWith && (
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-xl active:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Different Model
              </button>
              {showModelPicker && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f26] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                  {VIDEO_MODELS.filter(m => m.label !== modelLabel).map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleRegenerateWith(model.id)}
                      className="w-full px-3 py-2.5 text-left hover:bg-white/5 active:bg-white/10 border-b border-white/5 last:border-0"
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
      <div className="mb-3 rounded-2xl border border-gray-500/20 bg-gray-500/5 p-4">
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
      <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
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

  // Generating state — animated loading
  return (
    <div className="mb-3 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-purple-500/5 p-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-pulse" />
      <div className="relative">
        {/* Video preview placeholder */}
        <div className="aspect-video rounded-xl bg-black/30 border border-white/5 mb-3 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-2">
              <Film className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <p className="text-xs font-medium text-blue-400">Creating your video...</p>
            <p className="text-[10px] text-gray-600 mt-1">{modelLabel || 'AI'}</p>
            {isVeo && (
              <p className="text-[10px] text-purple-400/70 mt-1">Premium cinematic quality — please allow extra time</p>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-2">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Loader2 className="w-3 h-3 animate-spin text-blue-400 flex-shrink-0" />
            <p className="text-[11px] text-gray-400 truncate">
              {statusMessage}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {elapsedDisplay && <p className="text-[10px] text-gray-600">{elapsedDisplay}</p>}
            <p className="text-[10px] text-gray-500 font-medium">~{estimatedTime || defaultEstimatedTime}</p>
            <button
              onClick={handleCancel}
              className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-medium active:bg-red-500/20 transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-700 mt-2 truncate italic">"{prompt}"</p>
        {/* Stuck warning — model-aware messaging */}
        {stuckWarning && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px]">⚠️</span>
            <p className="text-[10px] text-amber-400/80">
              {isVeo 
                ? 'Veo 3.1 cinematic videos can take up to 10 minutes for 1080p quality. Still processing — you can wait or cancel and try Kling 3.0 for faster results.'
                : 'Taking longer than expected. The video provider may be busy. You can wait or cancel and try a different model.'
              }
            </p>
          </div>
        )}
        {/* Leave notification hint */}
        {!stuckWarning && (
          <div className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
            <span className="text-[10px]">💡</span>
            <p className="text-[10px] text-cyan-400/70">You can leave this chat — we'll notify you when it's ready.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MobileSavedVideoCard: displays a saved video from database with matching UX ─
function MobileSavedVideoCard({ videoUrl, modelLabel, prompt, token, onRegenerateWith, sourceImageUrl, onExtendVideo, videoTaskId }) {
  const { downloading, handleDownload } = useMobileDownload();
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Available video models for regeneration
  const REGEN_VIDEO_MODELS = [
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
    } catch (e) {}
    finally { setSaving(false); }
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
    <div className="mb-3 rounded-2xl overflow-hidden border border-white/10 bg-[#141a21]">
      <div className="bg-black">
        <video
          src={videoUrl}
          controls
          playsInline
          className="w-full max-h-80 object-contain"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5" /> {modelLabel ? `Generated with ${modelLabel}` : 'Video'}
          </p>
          {prompt && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{prompt}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveToGallery}
            disabled={saving || savedToGallery}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border text-xs rounded-xl transition-colors ${
              savedToGallery 
                ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                : saving
                  ? 'bg-white/5 border-white/10 text-gray-500'
                  : 'bg-purple-500/15 border-purple-500/30 text-purple-400 active:bg-purple-500/25'
            }`}
          >
            {savedToGallery ? <><Check className="w-3.5 h-3.5" /> Saved</> : saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><GalleryHorizontal className="w-3.5 h-3.5" /> Save to Gallery</>}
          </button>
          <button onClick={() => handleDownload(videoUrl)} disabled={downloading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs rounded-xl active:bg-orange-500/25 transition-colors disabled:opacity-50">
            {downloading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Download className="w-3.5 h-3.5" /> Download</>}
          </button>
        </div>
        {/* Try Different Model - always show */}
        {onRegenerateWith && (
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-xl active:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Different Model
            </button>
            {showModelPicker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1f26] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                {REGEN_VIDEO_MODELS.filter(m => !modelLabel?.toLowerCase().includes(m.label.toLowerCase().split(' ')[0])).map(model => (
                  <button
                    key={model.id}
                    onClick={() => handleRegenerateWith(model.id)}
                    className="w-full px-3 py-2.5 text-left hover:bg-white/5 active:bg-white/10 border-b border-white/5 last:border-0"
                  >
                    <p className="text-xs font-medium text-white">{model.label}</p>
                    <p className="text-[10px] text-gray-500">{model.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Extend Video */}
        {onExtendVideo && (
          <button
            onClick={() => onExtendVideo({ videoUrl, videoTaskId, prompt })}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs rounded-xl active:bg-blue-500/25 transition-colors"
          >
            <FastForward className="w-3.5 h-3.5" /> Extend Video
          </button>
        )}
      </div>
    </div>
  );
}



// Image Generation Models (matching desktop) - no pricing shown

export { MobileImageCard, MobileVideoCard, MobileSavedVideoCard };
