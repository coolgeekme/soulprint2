'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * MusicCard — Inline audio player for AI-generated music in chat.
 * Shows generation progress during polling, then an audio player with download.
 */
export default function MusicCard({ jobId, initialData, token }) {
  const [status, setStatus] = useState(initialData?.status || 'pending');
  const [tracks, setTracks] = useState(initialData?.tracks || []);
  const [title, setTitle] = useState(initialData?.title || 'Generating...');
  const [style, setStyle] = useState(initialData?.style || '');
  const [error, setError] = useState(initialData?.error || null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('🎵 Queuing your song...');
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const pollRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  const progressStages = [
    { threshold: 0, message: '🎵 Queuing your song...' },
    { threshold: 15, message: '✍️ Composing lyrics & melody...' },
    { threshold: 30, message: '🎹 Arranging instruments...' },
    { threshold: 50, message: '🎤 Generating vocals...' },
    { threshold: 70, message: '🎛️ Mixing & mastering...' },
    { threshold: 85, message: '🎶 Encoding final audio...' },
    { threshold: 95, message: '✨ Almost ready...' },
  ];

  // Poll for status
  const pollStatus = useCallback(async () => {
    if (!jobId || status === 'completed' || status === 'failed') return;
    try {
      const res = await fetch(`/api/music/status/${jobId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.status === 'completed' && data.tracks?.length > 0) {
        setStatus('completed');
        setTracks(data.tracks);
        setTitle(data.title || title);
        setStyle(data.style || style);
        setProgress(100);
        setProgressMessage('✅ Song ready!');
      } else if (data.status === 'failed') {
        setStatus('failed');
        setError(data.error || 'Generation failed');
        setProgress(0);
      } else if (data.status === 'partial' && data.tracks?.length > 0) {
        setStatus('partial');
        setTracks(data.tracks);
        setTitle(data.title || title);
        setProgress(80);
        setProgressMessage('🎶 First track ready! Generating more...');
      } else {
        // Update progress based on time elapsed
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const estimatedMax = 180; // 3 minutes
        const pct = Math.min(90, Math.floor((elapsed / estimatedMax) * 100));
        setProgress(pct);
        const stage = [...progressStages].reverse().find(s => pct >= s.threshold);
        if (stage) setProgressMessage(stage.message);
      }
    } catch {}
  }, [jobId, status, token, title, style]);

  useEffect(() => {
    if (status === 'completed' || status === 'failed') return;
    pollRef.current = setInterval(pollStatus, 5000);
    pollStatus(); // Initial poll
    return () => clearInterval(pollRef.current);
  }, [pollStatus, status]);

  // Audio controls
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const seekTo = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentTrack = tracks[currentTrackIndex];

  // ── Generating/Pending state ──────────────────────────────────────────
  if (status === 'pending' || status === 'generating' || status === 'lyrics_ready') {
    return (
      <div className="my-3 rounded-xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 p-4 max-w-md">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center animate-pulse">
            <span className="text-xl">🎵</span>
          </div>
          <div>
            <p className="text-sm font-medium text-purple-200">{title}</p>
            <p className="text-xs text-purple-400">{style}</p>
          </div>
        </div>
        <div className="mb-2">
          <div className="w-full bg-purple-900/40 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-purple-300">{progressMessage}</p>
        <p className="text-xs text-purple-500 mt-1">Usually takes 1-3 minutes</p>
      </div>
    );
  }

  // ── Failed state ──────────────────────────────────────────────────────
  if (status === 'failed') {
    return (
      <div className="my-3 rounded-xl bg-red-900/20 border border-red-500/30 p-4 max-w-md">
        <div className="flex items-center gap-3">
          <span className="text-xl">❌</span>
          <div>
            <p className="text-sm font-medium text-red-300">Music Generation Failed</p>
            <p className="text-xs text-red-400">{error || 'An error occurred'}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Completed state — Audio Player ────────────────────────────────────
  if (!currentTrack) {
    return (
      <div className="my-3 rounded-xl bg-purple-900/20 border border-purple-500/30 p-4 max-w-md">
        <p className="text-sm text-purple-300">No tracks available yet.</p>
      </div>
    );
  }

  return (
    <div className="my-3 rounded-xl bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/20 overflow-hidden max-w-md">
      {/* Album art + title */}
      <div className="flex items-center gap-3 p-4 pb-2">
        {currentTrack.imageUrl ? (
          <img 
            src={currentTrack.imageUrl} 
            alt={currentTrack.title} 
            className="w-14 h-14 rounded-lg object-cover shadow-lg"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <span className="text-2xl">🎵</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{currentTrack.title || title}</p>
          <p className="text-xs text-purple-300 truncate">{currentTrack.tags || style}</p>
          {currentTrack.duration > 0 && (
            <p className="text-xs text-purple-400">{formatTime(currentTrack.duration)}</p>
          )}
        </div>
      </div>

      {/* Audio element (hidden) */}
      <audio
        ref={audioRef}
        src={currentTrack.audioUrl || currentTrack.streamUrl}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="metadata"
      />

      {/* Player controls */}
      <div className="px-4 pb-2">
        {/* Progress bar */}
        <div
          className="w-full h-1.5 bg-purple-900/40 rounded-full cursor-pointer group"
          onClick={seekTo}
        >
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full relative transition-all"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-purple-400 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || currentTrack.duration)}</span>
        </div>
      </div>

      {/* Buttons row */}
      <div className="flex items-center justify-between px-4 pb-3">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-purple-500 hover:bg-purple-400 flex items-center justify-center transition-colors shadow-lg"
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
              <path d="M4 2.5v11l9-5.5L4 2.5z" />
            </svg>
          )}
        </button>

        {/* Track selector (if multiple tracks) */}
        {tracks.length > 1 && (
          <div className="flex items-center gap-1">
            {tracks.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentTrackIndex(i);
                  setIsPlaying(false);
                  setCurrentTime(0);
                }}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentTrackIndex ? 'bg-purple-400' : 'bg-purple-700 hover:bg-purple-500'
                }`}
              />
            ))}
          </div>
        )}

        {/* Download button */}
        <a
          href={currentTrack.audioUrl}
          download={`${(currentTrack.title || title || 'song').replace(/[^a-zA-Z0-9 ]/g, '')}.mp3`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </a>
      </div>

      {/* Lyrics preview (collapsible) */}
      {currentTrack.lyrics && (
        <LyricsPreview lyrics={currentTrack.lyrics} />
      )}
    </div>
  );
}

function LyricsPreview({ lyrics }) {
  const [expanded, setExpanded] = useState(false);
  if (!lyrics) return null;

  return (
    <div className="border-t border-purple-500/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-2 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
      >
        <span>{expanded ? '▼' : '▶'}</span> Lyrics
      </button>
      {expanded && (
        <div className="px-4 pb-3 text-xs text-purple-300/80 whitespace-pre-wrap max-h-40 overflow-y-auto">
          {lyrics}
        </div>
      )}
    </div>
  );
}
