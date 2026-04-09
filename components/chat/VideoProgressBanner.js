'use client';
import { useState, useEffect, useRef } from 'react';
import { Film, Loader2, CheckCircle, XCircle, Clock, Sparkles } from 'lucide-react';

/**
 * VideoProgressBanner — Persistent, conversation-level indicator showing active video generation jobs.
 * Polls /api/video/active/:conversationId on mount, and /api/media/video/status/:taskId periodically.
 * Shows a prominent animated banner at the top of the messages area whenever there's a video being generated.
 * This ensures users ALWAYS see progress, even after page refresh or if the SSE video_task event was missed.
 */
export default function VideoProgressBanner({ conversationId, token, onVideoReady }) {
  const [activeJobs, setActiveJobs] = useState([]);
  const [jobStatuses, setJobStatuses] = useState({}); // taskId -> { status, progress, videoUrl, ... }
  const pollRef = useRef(null);
  const startTimesRef = useRef({}); // taskId -> startTime
  const onVideoReadyRef = useRef(onVideoReady);
  useEffect(() => { onVideoReadyRef.current = onVideoReady; }, [onVideoReady]);

  // Fetch active video jobs for this conversation on mount and periodically
  useEffect(() => {
    if (!conversationId) return;

    const fetchActiveJobs = async () => {
      try {
        const res = await fetch(`/api/video/active/${conversationId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.jobs && data.jobs.length > 0) {
            setActiveJobs(data.jobs);
            // Initialize start times
            data.jobs.forEach(job => {
              if (!startTimesRef.current[job.taskId]) {
                startTimesRef.current[job.taskId] = job.createdAt ? new Date(job.createdAt).getTime() : Date.now();
              }
            });
          }
        }
      } catch (e) {
        // Silently fail
      }
    };

    fetchActiveJobs();
    const interval = setInterval(fetchActiveJobs, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [conversationId, token]);

  // Poll individual job statuses
  useEffect(() => {
    if (activeJobs.length === 0) return;

    const pollStatuses = async () => {
      for (const job of activeJobs) {
        try {
          const res = await fetch(`/api/media/video/status/${job.taskId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const d = await res.json();
            setJobStatuses(prev => ({ ...prev, [job.taskId]: d }));

            if (d.status === 'success' && d.video_url) {
              // Video is ready — notify parent
              if (onVideoReadyRef.current) {
                onVideoReadyRef.current(job.taskId, d.video_url, d.thumbnail_url);
              }
              // Remove from active jobs
              setActiveJobs(prev => prev.filter(j => j.taskId !== job.taskId));
            } else if (d.status === 'failed') {
              // Remove after a delay so user sees the failure
              setTimeout(() => {
                setActiveJobs(prev => prev.filter(j => j.taskId !== job.taskId));
              }, 10000);
            }
          }
        } catch (e) {
          // Continue polling
        }
      }
    };

    pollStatuses();
    pollRef.current = setInterval(pollStatuses, 6000);
    return () => clearInterval(pollRef.current);
  }, [activeJobs, token]);

  // Also allow parent to inject active jobs from SSE video_task events
  // This is handled by the parent passing conversationId and the banner auto-discovering jobs

  if (activeJobs.length === 0) return null;

  return (
    <div className="px-2 sm:px-4 pt-2 space-y-2">
      {activeJobs.map(job => {
        const status = jobStatuses[job.taskId];
        const startTime = startTimesRef.current[job.taskId] || Date.now();
        const elapsed = Date.now() - startTime;
        const mins = Math.floor(elapsed / 60000);
        const secs = Math.floor((elapsed % 60000) / 1000);
        const elapsedStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        
        const isVeo = job.model?.includes('veo');
        const isRunway = job.model?.includes('runway');
        const modelLabel = isVeo ? 'Veo 3.1' : isRunway ? 'Runway Aleph' : 'Kling 3.0';
        const estTime = isVeo ? '3-8 min' : isRunway ? '2-5 min' : '1-3 min';
        
        // Estimate progress
        const midpoint = isVeo ? 330 : isRunway ? 210 : 120;
        const elapsedSec = elapsed / 1000;
        let progress = status?.progressPct;
        if (progress === undefined) {
          if (elapsedSec < midpoint) {
            progress = Math.min(80, Math.round((elapsedSec / midpoint) * 80));
          } else {
            progress = Math.min(95, 80 + Math.round(((elapsedSec - midpoint) / (midpoint * 0.8)) * 15));
          }
        }

        const isFailed = status?.status === 'failed';

        return (
          <div key={job.taskId} className="max-w-3xl mx-auto">
            <div className={`relative overflow-hidden rounded-2xl border p-4 ${
              isFailed 
                ? 'bg-red-500/5 border-red-500/20'
                : 'bg-gradient-to-r from-blue-500/8 via-purple-500/8 to-cyan-500/8 border-blue-500/25'
            }`}>
              {/* Animated shimmer for generating state */}
              {!isFailed && (
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" 
                       style={{ animation: 'shimmer 2.5s ease-in-out infinite' }} />
                </div>
              )}
              
              <div className="relative flex items-center gap-3">
                {/* Animated icon */}
                <div className="relative flex-shrink-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    isFailed ? 'bg-red-500/15' : 'bg-blue-500/15'
                  }`}>
                    {isFailed ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Film className="w-5 h-5 text-blue-400 animate-pulse" />
                    )}
                  </div>
                  {!isFailed && (
                    <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-blue-500/40 animate-spin" 
                         style={{ animationDuration: '2.5s' }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm font-semibold ${isFailed ? 'text-red-400' : 'text-white'}`}>
                      {isFailed ? 'Video generation failed' : '🎬 Video Generating...'}
                    </p>
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-gray-400 font-medium">
                      {modelLabel}
                    </span>
                  </div>
                  
                  {!isFailed && (
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                        {status?.statusMessage || 'Processing your video...'}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Clock className="w-3 h-3" />
                        {elapsedStr}
                      </span>
                      <span className="text-gray-600">~{estTime}</span>
                    </div>
                  )}
                  
                  {isFailed && (
                    <p className="text-xs text-gray-500">{status?.error || 'An error occurred during generation'}</p>
                  )}
                </div>

                {/* Progress percentage */}
                {!isFailed && (
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-blue-400">{Math.round(progress)}%</p>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {!isFailed && (
                <div className="mt-3 w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* Hint */}
              {!isFailed && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-400/50" />
                  <p className="text-[10px] text-gray-600">You can keep chatting — the video will appear when ready</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      {/* Keyframe animation for shimmer */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
