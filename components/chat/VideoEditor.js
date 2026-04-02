'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Sparkles, Scissors, Type, Download, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';

function VideoEditor({ videoUrl, videoId: initialVideoId, onClose, token }) {
  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const [videoId, setVideoId] = useState(initialVideoId || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('review'); // review | trim | text
  
  // Video state
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [metadata, setMetadata] = useState(null);
  
  // Trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(null); // 'start' | 'end' | null
  
  // Text overlay state
  const [textOverlays, setTextOverlays] = useState([]);
  const [activeOverlay, setActiveOverlay] = useState(null);
  
  // Current video URL (changes after edits)
  const [currentVideoUrl, setCurrentVideoUrl] = useState(videoUrl || '');
  const [processedVideoId, setProcessedVideoId] = useState(null);

  // Upload video if we have a URL but no videoId
  useEffect(() => {
    if (videoUrl && !initialVideoId) {
      uploadVideoFromUrl(videoUrl);
    }
  }, [videoUrl, initialVideoId]);

  const uploadVideoFromUrl = async (url) => {
    setIsUploading(true);
    setError(null);
    try {
      // Fetch the video as blob
      const resp = await fetch(url);
      const blob = await resp.blob();
      
      const formData = new FormData();
      formData.append('video', blob, 'video.mp4');
      
      const res = await fetch('/api/video/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      setVideoId(data.videoId);
      setMetadata(data.metadata);
      setTrimEnd(data.metadata.duration);
    } catch (e) {
      setError(e.message);
    }
    setIsUploading(false);
  };

  const uploadVideoFile = async (file) => {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('video', file);
      
      const res = await fetch('/api/video/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      setVideoId(data.videoId);
      setMetadata(data.metadata);
      setTrimEnd(data.metadata.duration);
      setCurrentVideoUrl(URL.createObjectURL(file));
    } catch (e) {
      setError(e.message);
    }
    setIsUploading(false);
  };

  // ── Video playback controls ──
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (!trimEnd || trimEnd === 0) setTrimEnd(dur);
      if (!metadata) {
        setMetadata({
          duration: dur,
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        });
      }
    }
  };

  const seekTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  // ── AI Review ──
  const handleAnalyze = async () => {
    if (!videoId) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/video/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e.message);
    }
    setIsAnalyzing(false);
  };

  // ── Trim ──
  const handleTrim = async () => {
    if (!videoId) return;
    if (trimStart >= trimEnd) {
      setError('Start time must be before end time');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/video/trim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId, startTime: trimStart, endTime: trimEnd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Trim failed');
      
      setVideoId(data.videoId);
      setProcessedVideoId(data.videoId);
      setMetadata(data.metadata);
      setCurrentVideoUrl(`/api/video/serve/${data.videoId}`);
      setDuration(data.metadata.duration);
      setTrimStart(0);
      setTrimEnd(data.metadata.duration);
      setCurrentTime(0);
    } catch (e) {
      setError(e.message);
    }
    setIsProcessing(false);
  };

  // ── Text Overlay ──
  const addTextOverlay = () => {
    const newOverlay = {
      id: Date.now(),
      text: 'Your text here',
      fontSize: 32,
      fontColor: 'white',
      bgColor: 'black@0.5',
      x: 'center',
      y: 'center',
      startTime: 0,
      endTime: duration,
    };
    setTextOverlays([...textOverlays, newOverlay]);
    setActiveOverlay(newOverlay.id);
  };

  const updateOverlay = (id, updates) => {
    setTextOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const removeOverlay = (id) => {
    setTextOverlays(prev => prev.filter(o => o.id !== id));
    if (activeOverlay === id) setActiveOverlay(null);
  };

  const handleApplyText = async () => {
    if (!videoId || textOverlays.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/video/text-overlay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId, textOverlays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Text overlay failed');
      
      setVideoId(data.videoId);
      setProcessedVideoId(data.videoId);
      setMetadata(data.metadata);
      setCurrentVideoUrl(`/api/video/serve/${data.videoId}`);
      setTextOverlays([]);
      setActiveOverlay(null);
    } catch (e) {
      setError(e.message);
    }
    setIsProcessing(false);
  };

  // ── Download ──
  const handleDownload = () => {
    const downloadId = processedVideoId || videoId;
    if (!downloadId) return;
    const a = document.createElement('a');
    a.href = `/api/video/download/${downloadId}`;
    a.download = 'edited_video.mp4';
    a.click();
  };

  // ── Timeline interaction ──
  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const time = x * duration;
    seekTo(Math.max(0, Math.min(time, duration)));
  };

  const handleTrimDrag = useCallback((e) => {
    if (!isDragging || !timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = Math.round(x * duration * 10) / 10;
    
    if (isDragging === 'start') {
      setTrimStart(Math.min(time, trimEnd - 0.5));
    } else if (isDragging === 'end') {
      setTrimEnd(Math.max(time, trimStart + 0.5));
    }
  }, [isDragging, duration, trimStart, trimEnd]);

  const handleTrimDragEnd = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleTrimDrag);
      window.addEventListener('mouseup', handleTrimDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleTrimDrag);
        window.removeEventListener('mouseup', handleTrimDragEnd);
      };
    }
  }, [isDragging, handleTrimDrag, handleTrimDragEnd]);

  const activeOv = textOverlays.find(o => o.id === activeOverlay);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-3 flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Play className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Video Editor</h3>
              {metadata && (
                <p className="text-xs text-gray-500">
                  {formatTime(metadata.duration)} · {metadata.width}×{metadata.height}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(processedVideoId || videoId) && (
              <button onClick={handleDownload} className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg hover:bg-green-500/30 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Upload state */}
        {isUploading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Uploading video...</p>
            </div>
          </div>
        )}

        {/* No video — file picker */}
        {!currentVideoUrl && !isUploading && (
          <div className="flex-1 flex items-center justify-center">
            <label className="cursor-pointer p-8 border-2 border-dashed border-white/20 rounded-2xl hover:border-blue-500/50 transition-colors text-center">
              <Play className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 text-sm mb-1">Drop a video or click to upload</p>
              <p className="text-gray-600 text-xs">MP4, MOV, WebM • Max 2 min • 100MB</p>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setCurrentVideoUrl(URL.createObjectURL(f));
                    uploadVideoFile(f);
                  }
                }}
              />
            </label>
          </div>
        )}

        {/* Main content */}
        {currentVideoUrl && !isUploading && (
          <>
            {/* Video Player */}
            <div className="relative flex-1 min-h-0 flex items-center justify-center bg-black p-2">
              <video
                ref={videoRef}
                src={currentVideoUrl}
                className="max-w-full max-h-full rounded-lg"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                muted={isMuted}
                playsInline
              />
              
              {/* Text overlay preview */}
              {activeTab === 'text' && textOverlays.map(ov => (
                <div
                  key={ov.id}
                  className={`absolute pointer-events-none px-3 py-1.5 rounded ${ov.id === activeOverlay ? 'ring-2 ring-blue-500' : ''}`}
                  style={{
                    left: ov.x === 'center' ? '50%' : `${ov.x}%`,
                    top: ov.y === 'center' ? '50%' : ov.y === 'top' ? '10%' : ov.y === 'bottom' ? '85%' : `${ov.y}%`,
                    transform: ov.x === 'center' ? 'translateX(-50%)' : undefined,
                    fontSize: `${Math.max(12, ov.fontSize * 0.6)}px`,
                    color: ov.fontColor,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                  }}
                >
                  {ov.text}
                </div>
              ))}

              {/* Processing overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
                    <p className="text-white text-sm">Processing video...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Playback Controls + Timeline */}
            <div className="px-4 py-2 border-t border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={togglePlay} className="p-1.5 text-white hover:bg-white/10 rounded-lg">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => seekTo(0)} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <span className="text-xs text-gray-400 font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Timeline */}
              <div
                ref={timelineRef}
                className="relative h-8 bg-white/5 rounded-lg cursor-pointer select-none"
                onClick={handleTimelineClick}
              >
                {/* Trim region highlight */}
                {activeTab === 'trim' && (
                  <div
                    className="absolute top-0 bottom-0 bg-blue-500/20 border-x-2 border-blue-500"
                    style={{
                      left: `${(trimStart / duration) * 100}%`,
                      width: `${((trimEnd - trimStart) / duration) * 100}%`,
                    }}
                  />
                )}

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                  style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />

                {/* Trim handles */}
                {activeTab === 'trim' && (
                  <>
                    <div
                      className="absolute top-0 bottom-0 w-3 bg-blue-500 rounded-l cursor-ew-resize z-20 flex items-center justify-center hover:bg-blue-400"
                      style={{ left: `calc(${(trimStart / duration) * 100}% - 6px)` }}
                      onMouseDown={(e) => { e.stopPropagation(); setIsDragging('start'); }}
                    >
                      <ChevronRight className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div
                      className="absolute top-0 bottom-0 w-3 bg-blue-500 rounded-r cursor-ew-resize z-20 flex items-center justify-center hover:bg-blue-400"
                      style={{ left: `calc(${(trimEnd / duration) * 100}% - 6px)` }}
                      onMouseDown={(e) => { e.stopPropagation(); setIsDragging('end'); }}
                    >
                      <ChevronLeft className="w-2.5 h-2.5 text-white" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 py-2 border-t border-white/10">
              <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg w-fit">
                {[
                  { id: 'review', icon: Sparkles, label: 'AI Review' },
                  { id: 'trim', icon: Scissors, label: 'Trim' },
                  { id: 'text', icon: Type, label: 'Add Text' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white/10 text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="px-4 py-3 border-t border-white/10 max-h-[30vh] overflow-y-auto">
              
              {/* AI Review Tab */}
              {activeTab === 'review' && (
                <div className="space-y-3">
                  {!analysis && !isAnalyzing && (
                    <button
                      onClick={handleAnalyze}
                      disabled={!videoId}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 text-purple-300 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      Analyze Video with AI
                    </button>
                  )}
                  {isAnalyzing && (
                    <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                      <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      <div>
                        <p className="text-purple-300 text-sm font-medium">Analyzing video...</p>
                        <p className="text-gray-500 text-xs">Extracting frames and reviewing content</p>
                      </div>
                    </div>
                  )}
                  {analysis && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-purple-300">AI Review</span>
                      </div>
                      <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                        {analysis}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trim Tab */}
              {activeTab === 'trim' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">Start</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={duration}
                          step={0.1}
                          value={trimStart}
                          onChange={e => { const v = parseFloat(e.target.value); setTrimStart(Math.min(v, trimEnd - 0.5)); seekTo(v); }}
                          className="flex-1 accent-blue-500"
                        />
                        <span className="text-xs text-white font-mono w-14 text-right">{formatTime(trimStart)}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">End</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={duration}
                          step={0.1}
                          value={trimEnd}
                          onChange={e => { const v = parseFloat(e.target.value); setTrimEnd(Math.max(v, trimStart + 0.5)); seekTo(v); }}
                          className="flex-1 accent-blue-500"
                        />
                        <span className="text-xs text-white font-mono w-14 text-right">{formatTime(trimEnd)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Selected: {formatTime(trimEnd - trimStart)} of {formatTime(duration)}
                    </p>
                    <button
                      onClick={handleTrim}
                      disabled={isProcessing || !videoId || (trimStart === 0 && trimEnd === duration)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                      Trim Video
                    </button>
                  </div>
                </div>
              )}

              {/* Text Overlay Tab */}
              {activeTab === 'text' && (
                <div className="space-y-3">
                  <button
                    onClick={addTextOverlay}
                    className="w-full px-3 py-2 bg-white/5 border border-dashed border-white/20 text-gray-400 text-sm rounded-lg hover:border-white/40 hover:text-white"
                  >
                    + Add Text Overlay
                  </button>

                  {textOverlays.map(ov => (
                    <div
                      key={ov.id}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        activeOverlay === ov.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10'
                      }`}
                      onClick={() => setActiveOverlay(ov.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Text {textOverlays.indexOf(ov) + 1}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeOverlay(ov.id); }}
                          className="text-gray-600 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={ov.text}
                        onChange={e => updateOverlay(ov.id, { text: e.target.value })}
                        className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:border-blue-500 outline-none mb-2"
                        placeholder="Enter text..."
                      />
                      
                      {activeOverlay === ov.id && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Position</label>
                            <select
                              value={typeof ov.y === 'string' ? ov.y : 'center'}
                              onChange={e => updateOverlay(ov.id, { x: 'center', y: e.target.value })}
                              className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-white text-xs focus:border-blue-500 outline-none"
                            >
                              <option value="top">Top</option>
                              <option value="center">Center</option>
                              <option value="bottom">Bottom</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Size</label>
                            <input
                              type="range"
                              min={16}
                              max={72}
                              value={ov.fontSize}
                              onChange={e => updateOverlay(ov.id, { fontSize: parseInt(e.target.value) })}
                              className="w-full accent-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Color</label>
                            <div className="flex gap-1">
                              {['white', 'yellow', '#00ff00', '#ff4444', '#4488ff'].map(c => (
                                <button
                                  key={c}
                                  onClick={() => updateOverlay(ov.id, { fontColor: c })}
                                  className={`w-6 h-6 rounded border-2 ${ov.fontColor === c ? 'border-white' : 'border-transparent'}`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Show during</label>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <input
                                type="number"
                                min={0}
                                max={duration}
                                step={0.1}
                                value={ov.startTime}
                                onChange={e => updateOverlay(ov.id, { startTime: parseFloat(e.target.value) })}
                                className="w-14 bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white text-xs"
                              />
                              <span>to</span>
                              <input
                                type="number"
                                min={0}
                                max={duration}
                                step={0.1}
                                value={ov.endTime}
                                onChange={e => updateOverlay(ov.id, { endTime: parseFloat(e.target.value) })}
                                className="w-14 bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white text-xs"
                              />
                              <span>s</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {textOverlays.length > 0 && (
                    <button
                      onClick={handleApplyText}
                      disabled={isProcessing || !videoId}
                      className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Type className="w-4 h-4" />}
                      Apply Text Overlay
                    </button>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                  {error}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default VideoEditor;
