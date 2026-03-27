'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * AssessmentNudge — Persistent slider question overlay
 * Black & orange themed to match the app.
 * Cannot be dismissed — only minimized to a compact bar.
 * Stays visible until the user answers.
 */

export default function AssessmentNudge({ token, onAnswered, messageCount }) {
  const [nudgeData, setNudgeData] = useState(null);
  const [sliderValue, setSliderValue] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasQuestion, setHasQuestion] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const lastCheckRef = useRef(0);
  const lastMessageCountRef = useRef(0);
  const successTimeoutRef = useRef(null);
  const randomCheckIntervalRef = useRef(null);

  // Check for nudge question
  const checkForNudge = useCallback(async (force = false) => {
    if (!token || hasQuestion || showSuccess) return;

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
        setIsMinimized(false);
      } else if (data.complete) {
        if (randomCheckIntervalRef.current) clearInterval(randomCheckIntervalRef.current);
      }
    } catch (e) {
      // Silently fail
    }
  }, [token, hasQuestion, showSuccess]);

  // Increment message counter when user sends a message
  useEffect(() => {
    if (!token || messageCount === lastMessageCountRef.current) return;
    lastMessageCountRef.current = messageCount;

    const notifyAndCheck = async () => {
      try {
        await fetch('/api/assessment/nudge/message', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      } catch {}
      checkForNudge(true);
    };
    notifyAndCheck();
  }, [messageCount, token, checkForNudge]);

  // Periodic check
  useEffect(() => {
    if (!token) return;
    const initialTimeout = setTimeout(() => checkForNudge(false), 5000);
    randomCheckIntervalRef.current = setInterval(() => checkForNudge(false), 60000);
    return () => {
      clearTimeout(initialTimeout);
      if (randomCheckIntervalRef.current) clearInterval(randomCheckIntervalRef.current);
    };
  }, [token, checkForNudge]);

  useEffect(() => {
    return () => { if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current); };
  }, []);

  // Submit answer
  const handleSubmit = async () => {
    if (!nudgeData?.question?.id || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/assessment/nudge/answer', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: nudgeData.question.id, value: sliderValue }),
      });

      if (res.ok) {
        const result = await res.json();
        setShowSuccess(true);
        setHasQuestion(false);
        setIsMinimized(false);
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
        <div
          className="px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            color: 'white',
            animation: 'nudgeBounceIn 0.4s ease-out',
          }}
        >
          <span className="text-lg">✓</span>
          <span className="font-medium text-sm">Answer saved!</span>
          {nudgeData?.progress && (
            <span className="text-xs text-white/70 ml-1">
              ({nudgeData.progress.answered + 1}/{nudgeData.progress.total})
            </span>
          )}
        </div>
        <style jsx>{`
          @keyframes nudgeBounceIn {
            0% { opacity: 0; transform: scale(0.8); }
            60% { opacity: 1; transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  if (!nudgeData) return null;

  const { question, progress } = nudgeData;

  // ─── MINIMIZED VIEW ─── black/orange bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[9998]" style={{ animation: 'nudgeSlideIn 0.25s ease-out' }}>
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'rgba(17, 24, 32, 0.95)',
            border: '1px solid rgba(249, 115, 22, 0.35)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Emoji + pulse */}
          <div className="relative">
            <span className="text-xl">{question.emoji}</span>
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: '#f97316' }}
            />
          </div>

          <div className="text-left">
            <p className="text-white text-xs font-medium">Quick question waiting</p>
            <p className="text-[10px]" style={{ color: '#f97316' }}>
              {progress.answered}/{progress.total} done · Tap to answer
            </p>
          </div>

          <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

  // ─── EXPANDED VIEW ─── black/orange overlay
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)', animation: 'nudgeFadeIn 0.3s ease-out' }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, #141a21 0%, #0d1117 100%)',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          boxShadow: '0 0 40px rgba(249, 115, 22, 0.08), 0 25px 50px rgba(0, 0, 0, 0.5)',
          animation: 'nudgeSlideUp 0.35s ease-out',
        }}
      >
        {/* Progress bar — orange */}
        <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)' }}>
          <div
            style={{
              height: '100%',
              width: `${progress.percentage}%`,
              background: 'linear-gradient(90deg, #f97316, #ea580c)',
              transition: 'width 0.5s ease',
            }}
          />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{question.emoji}</span>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#f97316' }}>
                Quick Check-in
              </p>
              <p className="text-[11px] text-white/40">
                {progress.answered}/{progress.total} answered
              </p>
            </div>
          </div>

          {/* Minimize — NOT dismiss */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            onMouseOver={(e) => e.currentTarget.style.color = 'rgba(249,115,22,0.6)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
            title="Minimize — you'll need to answer this"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Pillar badge */}
        <div className="px-5 pb-1">
          <span
            className="text-[10px] px-2.5 py-0.5 rounded-full font-medium capitalize"
            style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#fb923c' }}
          >
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
            <span
              className="text-xs max-w-[40%] transition-all"
              style={{ color: sliderValue < 40 ? '#fff' : 'rgba(255,255,255,0.35)', fontWeight: sliderValue < 40 ? 600 : 400 }}
            >
              {question.leftLabel}
            </span>
            <span
              className="text-xs text-right max-w-[40%] transition-all"
              style={{ color: sliderValue > 60 ? '#fff' : 'rgba(255,255,255,0.35)', fontWeight: sliderValue > 60 ? 600 : 400 }}
            >
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
            {/* Track visual */}
            <div
              className="absolute top-1/2 left-0 right-0 h-2 rounded-full -translate-y-1/2 pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${sliderValue}%`,
                  background: 'linear-gradient(90deg, #f97316, #ea580c)',
                  transition: isDragging ? 'none' : 'width 0.15s',
                }}
              />
            </div>
          </div>

          {/* Hint */}
          {!hasInteracted && (
            <p className="text-center text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
              ← Drag the slider to answer →
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98]"
            style={{
              background: isSubmitting ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #f97316, #ea580c)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save & Continue Chatting'}
          </button>
        </div>

        {/* Subtle note */}
        <div className="px-5 pb-3">
          <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
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
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #f97316;
          box-shadow: 0 0 12px rgba(249, 115, 22, 0.4), 0 2px 6px rgba(0,0,0,0.3);
          cursor: grab;
          transition: transform 0.15s;
          border: 2px solid rgba(255,255,255,0.2);
        }
        .nudge-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.15);
          box-shadow: 0 0 20px rgba(249, 115, 22, 0.5), 0 2px 8px rgba(0,0,0,0.4);
        }
        .nudge-slider::-moz-range-thumb {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #f97316;
          box-shadow: 0 0 12px rgba(249, 115, 22, 0.4);
          border: 2px solid rgba(255,255,255,0.2);
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
