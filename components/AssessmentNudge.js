'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * AssessmentNudge — Persistent slider question overlay
 * Pops up during chat to collect assessment answers.
 * Cannot be dismissed — only minimized to a compact bar.
 * Stays visible until the user answers.
 */

const URGENCY_COLORS = {
  low: { bg: 'from-indigo-500/20 to-purple-500/20', border: 'border-indigo-500/30', accent: 'bg-indigo-500', text: 'text-indigo-400', barBg: 'bg-indigo-500/15' },
  medium: { bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30', accent: 'bg-amber-500', text: 'text-amber-400', barBg: 'bg-amber-500/15' },
  high: { bg: 'from-red-500/20 to-orange-500/20', border: 'border-red-500/30', accent: 'bg-red-500', text: 'text-red-400', barBg: 'bg-red-500/15' },
  overdue: { bg: 'from-red-600/25 to-pink-600/25', border: 'border-red-500/40', accent: 'bg-red-600', text: 'text-red-400', barBg: 'bg-red-600/15' },
};

export default function AssessmentNudge({ token, onAnswered, messageCount }) {
  const [nudgeData, setNudgeData] = useState(null);
  const [sliderValue, setSliderValue] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasQuestion, setHasQuestion] = useState(false);     // true when a question is ready
  const [isMinimized, setIsMinimized] = useState(false);      // minimize vs expanded
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);  // track if user moved slider
  const lastCheckRef = useRef(0);
  const lastMessageCountRef = useRef(0);
  const successTimeoutRef = useRef(null);
  const randomCheckIntervalRef = useRef(null);

  // Check for nudge question
  const checkForNudge = useCallback(async (force = false) => {
    if (!token || hasQuestion || showSuccess) return;

    // Throttle: at most once per 10 seconds (unless forced)
    const now = Date.now();
    if (!force && now - lastCheckRef.current < 10000) return;
    lastCheckRef.current = now;

    try {
      const res = await fetch('/api/assessment/nudge', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.hasQuestion && data.question) {
        setNudgeData(data);
        setSliderValue(50);
        setHasInteracted(false);
        setHasQuestion(true);
        setIsMinimized(false); // Always expand for new question
      } else if (data.complete) {
        // All done! Stop checking
        if (randomCheckIntervalRef.current) {
          clearInterval(randomCheckIntervalRef.current);
        }
      }
    } catch (e) {
      // Silently fail — don't disrupt chat
    }
  }, [token, hasQuestion, showSuccess]);

  // Increment message counter when user sends a message
  useEffect(() => {
    if (!token || messageCount === lastMessageCountRef.current) return;
    lastMessageCountRef.current = messageCount;

    // Notify backend about the message, then check for nudge
    const notifyAndCheck = async () => {
      try {
        await fetch('/api/assessment/nudge/message', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      } catch {}
      // Only check after the counter has been committed on the backend
      checkForNudge(true);
    };
    notifyAndCheck();
  }, [messageCount, token, checkForNudge]);

  // Random interval check for popup-between-responses (escalating near deadline)
  useEffect(() => {
    if (!token) return;

    // Initial check after 5 seconds
    const initialTimeout = setTimeout(() => checkForNudge(false), 5000);

    // Periodic check every 60 seconds for random triggers
    randomCheckIntervalRef.current = setInterval(() => {
      checkForNudge(false);
    }, 60000);

    return () => {
      clearTimeout(initialTimeout);
      if (randomCheckIntervalRef.current) clearInterval(randomCheckIntervalRef.current);
    };
  }, [token, checkForNudge]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Submit answer
  const handleSubmit = async () => {
    if (!nudgeData?.question?.id || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/assessment/nudge/answer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: nudgeData.question.id,
          value: sliderValue,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setShowSuccess(true);
        setHasQuestion(false);
        setIsMinimized(false);

        // Auto-hide success after 1.5s
        successTimeoutRef.current = setTimeout(() => {
          setShowSuccess(false);
          setNudgeData(null);
        }, 1500);

        if (onAnswered) onAnswered(result);
      }
    } catch (e) {
      console.error('[Nudge] Submit failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle slider change
  const handleSliderChange = (e) => {
    setSliderValue(Number(e.target.value));
    if (!hasInteracted) setHasInteracted(true);
  };

  // Nothing to render
  if (!hasQuestion && !showSuccess) return null;

  // Success toast
  if (showSuccess) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none">
        <div className="bg-green-500/90 text-white px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2" style={{ animation: 'nudgeBounceIn 0.4s ease-out' }}>
          <span className="text-lg">✓</span>
          <span className="font-medium text-sm">Answer saved!</span>
          {nudgeData?.progress && (
            <span className="text-xs text-white/70 ml-1">
              ({nudgeData.progress.answered + 1}/{nudgeData.progress.total})
            </span>
          )}
        </div>
      </div>
    );
  }

  if (!nudgeData) return null;

  const { question, urgency, progress } = nudgeData;
  const colors = URGENCY_COLORS[urgency] || URGENCY_COLORS.low;

  // ─── MINIMIZED VIEW ───
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[9998]" style={{ animation: 'nudgeSlideIn 0.25s ease-out' }}>
        <button
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${colors.border} ${colors.barBg} bg-[#1a1a2e]/95 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm`}
        >
          {/* Emoji + pulse indicator */}
          <div className="relative">
            <span className="text-xl">{question.emoji}</span>
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${colors.accent} animate-pulse`} />
          </div>

          {/* Text */}
          <div className="text-left">
            <p className="text-white text-xs font-medium">Quick question waiting</p>
            <p className={`text-[10px] ${colors.text}`}>
              {progress.answered}/{progress.total} done · Tap to answer
            </p>
          </div>

          {/* Expand arrow */}
          <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>

        <style jsx>{`
          @keyframes nudgeSlideIn {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // ─── EXPANDED VIEW ───
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm"
      style={{ animation: 'nudgeFadeIn 0.3s ease-out' }}
    >
      <div
        className={`w-full max-w-md rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} bg-[#1a1a2e]/95 shadow-2xl overflow-hidden`}
        style={{ animation: 'nudgeSlideUp 0.35s ease-out' }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <div
            className={`h-full ${colors.accent} transition-all duration-500`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{question.emoji}</span>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider font-medium">
                Quick Check-in
              </p>
              <p className={`text-xs ${colors.text}`}>
                {progress.answered}/{progress.total} answered
                {progress.daysRemaining > 0 && ` · ${progress.daysRemaining}d left`}
                {progress.pastDeadline && ' · Overdue'}
              </p>
            </div>
          </div>

          {/* Minimize button (NOT dismiss) */}
          <button
            onClick={() => setIsMinimized(true)}
            className="text-white/30 hover:text-white/60 transition-colors p-1.5 rounded-lg hover:bg-white/5"
            title="Minimize — you'll need to answer this"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Pillar badge */}
        <div className="px-5 pb-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.accent}/20 ${colors.text} font-medium capitalize`}>
            {question.pillar?.replace('_', ' ')}
          </span>
        </div>

        {/* Question */}
        <div className="px-5 py-3">
          <p className="text-white text-[15px] leading-relaxed font-medium">
            {question.question}
          </p>
        </div>

        {/* Slider */}
        <div className="px-5 pb-2">
          {/* Labels */}
          <div className="flex justify-between mb-2">
            <span className={`text-xs ${sliderValue < 40 ? 'text-white font-semibold' : 'text-white/50'} transition-all max-w-[40%]`}>
              {question.leftLabel}
            </span>
            <span className={`text-xs text-right ${sliderValue > 60 ? 'text-white font-semibold' : 'text-white/50'} transition-all max-w-[40%]`}>
              {question.rightLabel}
            </span>
          </div>

          {/* Custom Slider */}
          <div className="relative py-3">
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={handleSliderChange}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              className="nudge-slider w-full"
            />
            {/* Slider track visual */}
            <div className="absolute top-1/2 left-0 right-0 h-2 rounded-full bg-white/10 -translate-y-1/2 pointer-events-none">
              <div
                className={`h-full rounded-full ${colors.accent} transition-all ${isDragging ? '' : 'duration-150'}`}
                style={{ width: `${sliderValue}%` }}
              />
            </div>
          </div>

          {/* Hint text */}
          {!hasInteracted && (
            <p className="text-center text-white/25 text-[11px] mt-1">
              ← Drag the slider to answer →
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-all ${
              isSubmitting
                ? 'bg-white/10 cursor-not-allowed'
                : `${colors.accent} hover:brightness-110 active:scale-[0.98]`
            }`}
          >
            {isSubmitting ? 'Saving...' : 'Save & Continue Chatting'}
          </button>
        </div>

        {/* Subtle note */}
        <div className="px-5 pb-3">
          <p className="text-center text-white/20 text-[10px]">
            This helps Cosmo understand you better · Takes 2 seconds
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes nudgeFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes nudgeSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes nudgeBounceIn {
          0% { opacity: 0; transform: scale(0.8); }
          60% { opacity: 1; transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .nudge-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 32px;
          background: transparent;
          cursor: pointer;
          position: relative;
          z-index: 2;
        }
        .nudge-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.1);
          cursor: grab;
          transition: transform 0.15s;
        }
        .nudge-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.15);
        }
        .nudge-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: none;
          cursor: grab;
        }
        .nudge-slider::-webkit-slider-runnable-track {
          height: 8px;
          background: transparent;
          border-radius: 4px;
        }
        .nudge-slider::-moz-range-track {
          height: 8px;
          background: transparent;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
