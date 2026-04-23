'use client';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Sparkles, RotateCcw, Check, Info } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// PERSONA DNA CARD — "Your AI Personality"
// Translates 10 technical axes into 4 intuitive dials
// ═══════════════════════════════════════════════════════════════════

const DIALS = [
  {
    id: 'directness',
    label: 'Communication',
    leftLabel: 'Direct',
    rightLabel: 'Diplomatic',
    leftEmoji: '🎯',
    rightEmoji: '🤝',
    description: 'How your AI delivers information and feedback',
    axes: ['directness', 'formality'],
    // directness(high=direct), formality(high=formal/diplomatic)
    // Combined: high = direct, low = diplomatic
    compute: (axes) => {
      const d = axes.directness ?? 50;
      const f = axes.formality ?? 50;
      return Math.round(d * 0.7 + (100 - f) * 0.3);
    },
  },
  {
    id: 'warmth',
    label: 'Tone',
    leftLabel: 'Warm',
    rightLabel: 'Neutral',
    leftEmoji: '☀️',
    rightEmoji: '🌙',
    description: 'Emotional warmth and expressiveness in responses',
    axes: ['warmth', 'emotionalDepth', 'expressiveness'],
    compute: (axes) => {
      const w = axes.warmth ?? 50;
      const e = axes.emotionalDepth ?? 50;
      const x = axes.expressiveness ?? 50;
      return Math.round(w * 0.5 + e * 0.25 + x * 0.25);
    },
  },
  {
    id: 'playfulness',
    label: 'Energy',
    leftLabel: 'Playful',
    rightLabel: 'Serious',
    leftEmoji: '✨',
    rightEmoji: '📐',
    description: 'Humor, wit, and lightness in conversation',
    axes: ['humor', 'pace'],
    compute: (axes) => {
      const h = axes.humor ?? 50;
      const p = axes.pace ?? 50;
      return Math.round(h * 0.7 + p * 0.3);
    },
  },
  {
    id: 'challenge',
    label: 'Approach',
    leftLabel: 'Challenging',
    rightLabel: 'Supportive',
    leftEmoji: '⚡',
    rightEmoji: '🛡️',
    description: 'Whether your AI pushes you or affirms you',
    axes: ['challenge', 'autonomy'],
    compute: (axes) => {
      const c = axes.challenge ?? 50;
      const a = axes.autonomy ?? 50;
      return Math.round(c * 0.6 + a * 0.4);
    },
  },
];

function getDialDescription(dial, value) {
  const pct = value;
  if (dial.id === 'directness') {
    if (pct >= 75) return 'Gets straight to the point. No fluff.';
    if (pct >= 55) return 'Clear and straightforward with context.';
    if (pct >= 45) return 'Balanced — direct when needed, tactful by default.';
    if (pct >= 25) return 'Thoughtful and measured in delivery.';
    return 'Careful, diplomatic framing of everything.';
  }
  if (dial.id === 'warmth') {
    if (pct >= 75) return 'Genuinely caring, expressive, encouraging.';
    if (pct >= 55) return 'Friendly and approachable, naturally warm.';
    if (pct >= 45) return 'Professional warmth — present but not effusive.';
    if (pct >= 25) return 'Calm, matter-of-fact, steady presence.';
    return 'Cool and objective. Just the information.';
  }
  if (dial.id === 'playfulness') {
    if (pct >= 75) return 'Loves wordplay, wit, and light humor.';
    if (pct >= 55) return 'Naturally upbeat with occasional humor.';
    if (pct >= 45) return 'Professional but not stiff. Relaxed.';
    if (pct >= 25) return 'Focused and composed. Minimal levity.';
    return 'All business, all the time.';
  }
  if (dial.id === 'challenge') {
    if (pct >= 75) return 'Actively pushes back, plays devil\'s advocate.';
    if (pct >= 55) return 'Will challenge assumptions constructively.';
    if (pct >= 45) return 'Balanced — challenges when warranted.';
    if (pct >= 25) return 'Mostly affirming, gently corrects.';
    return 'Primarily supportive and encouraging.';
  }
  return '';
}

function DialSlider({ dial, value, onChange, disabled, hasOverride }) {
  const description = getDialDescription(dial, value);
  
  // Map value (0-100) to position percentage
  const position = value;
  
  // Color based on position — left = orange, center = gray, right = blue
  const getTrackColor = (val) => {
    if (val >= 60) return 'from-orange-500 to-orange-400';
    if (val <= 40) return 'from-blue-400 to-blue-500';
    return 'from-gray-500 to-gray-400';
  };

  return (
    <div className="group">
      {/* Labels */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{dial.leftEmoji}</span>
          <span className={`text-xs font-medium ${value >= 55 ? 'text-orange-400' : 'text-gray-500'}`}>
            {dial.leftLabel}
          </span>
        </div>
        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">
          {dial.label}
          {hasOverride && (
            <span className="ml-1.5 text-orange-400" title="You've customized this">✎</span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${value <= 45 ? 'text-blue-400' : 'text-gray-500'}`}>
            {dial.rightLabel}
          </span>
          <span className="text-sm">{dial.rightEmoji}</span>
        </div>
      </div>

      {/* Slider Track */}
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${getTrackColor(value)} rounded-full transition-all duration-300`}
            style={{ width: `${value}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className="absolute inset-x-0 w-full h-8 opacity-0 cursor-pointer disabled:cursor-default z-10"
          aria-label={`${dial.label}: ${dial.leftLabel} to ${dial.rightLabel}`}
        />
        {/* Thumb indicator */}
        <div 
          className="absolute w-4 h-4 rounded-full bg-white shadow-lg shadow-black/30 border-2 border-orange-500/50 pointer-events-none transition-all duration-150"
          style={{ left: `calc(${value}% - 8px)` }}
        />
      </div>

      {/* Description */}
      <p className="text-[10px] text-gray-600 mt-0.5 transition-colors group-hover:text-gray-400">
        {description}
      </p>
    </div>
  );
}

// Accuracy Ring
function AccuracyRing({ percentage, answeredCount, totalQuestions = 36 }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  const getColor = (pct) => {
    if (pct >= 80) return '#f97316'; // orange-500
    if (pct >= 50) return '#eab308'; // yellow-500
    return '#6b7280'; // gray-500
  };
  
  const getLabel = (pct) => {
    if (pct >= 80) return 'Refined';
    if (pct >= 50) return 'Learning';
    if (pct >= 20) return 'Early';
    return 'New';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[72px] h-[72px]">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
          {/* Background ring */}
          <circle
            cx="32" cy="32" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="4"
          />
          {/* Progress ring */}
          <circle
            cx="32" cy="32" r={radius}
            fill="none"
            stroke={getColor(percentage)}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white text-sm font-bold">{Math.round(percentage)}%</span>
        </div>
      </div>
      <span className="text-[10px] text-gray-500 mt-1 font-medium">{getLabel(percentage)}</span>
      <span className="text-[9px] text-gray-700 mt-0.5">{answeredCount}/{totalQuestions} questions</span>
    </div>
  );
}

export default function PersonaDNACard({ token }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(null);
  const [dialValues, setDialValues] = useState({});
  const [overrides, setOverrides] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState('');

  // Load persona profile
  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/persona/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load personality profile');
      const data = await res.json();
      setProfile(data.profile);
      
      // Compute dial values from axes
      const axes = data.profile?.axes || {};
      const existingOverrides = data.profile?.overrides || {};
      const computedDials = {};
      
      DIALS.forEach(dial => {
        if (existingOverrides[dial.id] !== undefined) {
          computedDials[dial.id] = existingOverrides[dial.id];
        } else {
          computedDials[dial.id] = dial.compute(axes);
        }
      });
      
      setDialValues(computedDials);
      setOverrides(existingOverrides);
      setHasChanges(false);
    } catch (e) {
      console.error('PersonaDNA load error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Handle dial change
  const handleDialChange = (dialId, value) => {
    setDialValues(prev => ({ ...prev, [dialId]: value }));
    setOverrides(prev => ({ ...prev, [dialId]: value }));
    setHasChanges(true);
    setSaved(false);
  };

  // Reset a single dial to auto-computed value
  const resetDial = (dialId) => {
    const dial = DIALS.find(d => d.id === dialId);
    if (!dial || !profile?.axes) return;
    
    const autoValue = dial.compute(profile.axes);
    setDialValues(prev => ({ ...prev, [dialId]: autoValue }));
    
    const newOverrides = { ...overrides };
    delete newOverrides[dialId];
    setOverrides(newOverrides);
    setHasChanges(true);
    setSaved(false);
  };

  // Reset all dials to auto-computed
  const resetAll = () => {
    if (!profile?.axes) return;
    const computedDials = {};
    DIALS.forEach(dial => {
      computedDials[dial.id] = dial.compute(profile.axes);
    });
    setDialValues(computedDials);
    setOverrides({});
    setHasChanges(true);
    setSaved(false);
  };

  // Save overrides
  const saveOverrides = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/persona/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ overrides }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          <p className="text-gray-500 text-xs">Reading your personality data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm mb-2">Couldn't load your personality profile</p>
        <button onClick={loadProfile} className="text-orange-500 text-xs hover:text-orange-400">
          Try again
        </button>
      </div>
    );
  }

  const source = profile?.source || 'default';
  const answeredCount = profile?.answeredCount || 0;
  const messagesMined = profile?.messagesMined || 0;
  const accuracy = Math.min(100, Math.round((answeredCount / 36) * 70 + Math.min(messagesMined / 200, 1) * 30));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            Your AI Personality
          </h3>
          <p className="text-gray-500 text-[10px] mt-1">
            {source === 'assessment' 
              ? 'Based on your assessment answers' 
              : source === 'blended' 
                ? 'Based on your answers + chat patterns'
                : source === 'history_mining'
                  ? 'Learned from your chat patterns'
                  : 'Default — chat more or take the assessment to personalize'}
          </p>
        </div>
        <AccuracyRing 
          percentage={accuracy}
          answeredCount={answeredCount}
        />
      </div>

      {/* Nudge Banner */}
      {answeredCount < 12 && (
        <div className="p-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl">
          <p className="text-orange-300 text-xs">
            <Sparkles className="w-3 h-3 inline mr-1" />
            {answeredCount === 0
              ? 'Your AI is using default personality settings. Answer a few questions to make it yours.'
              : `${12 - answeredCount} more answers will significantly sharpen your AI's personality.`}
          </p>
          {answeredCount < 6 && (
            <button
              onClick={() => window.location.href = '/assessment/quick'}
              className="mt-2 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-[11px] font-medium rounded-lg transition-colors"
            >
              Quick Personality Quiz →
            </button>
          )}
        </div>
      )}

      {/* Dials */}
      <div className="space-y-5">
        {DIALS.map(dial => (
          <div key={dial.id} className="relative">
            <DialSlider
              dial={dial}
              value={dialValues[dial.id] ?? 50}
              onChange={(v) => handleDialChange(dial.id, v)}
              disabled={saving}
              hasOverride={overrides[dial.id] !== undefined}
            />
            {overrides[dial.id] !== undefined && (
              <button
                onClick={() => resetDial(dial.id)}
                className="absolute top-0 right-0 text-gray-600 hover:text-gray-400 transition-colors"
                title="Reset to auto-detected value"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          {Object.keys(overrides).length > 0 && (
            <button
              onClick={resetAll}
              disabled={saving}
              className="text-gray-500 hover:text-gray-300 text-[11px] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset all
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-green-400 text-[11px] flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          {hasChanges && (
            <button
              onClick={saveOverrides}
              disabled={saving}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* How It Works — Collapsible */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-400 transition-colors">
          <Info className="w-3 h-3" />
          <span className="text-[10px]">How does this work?</span>
        </summary>
        <div className="mt-2 p-3 bg-white/[0.02] rounded-lg border border-white/5 text-[10px] text-gray-500 space-y-2">
          <p>
            Your AI personality is automatically shaped by two sources:
          </p>
          <ul className="space-y-1 pl-3">
            <li className="flex items-start gap-1.5">
              <span className="text-orange-400 mt-0.5">•</span>
              <span><strong className="text-gray-400">Assessment answers</strong> — direct personality questions you've answered</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-blue-400 mt-0.5">•</span>
              <span><strong className="text-gray-400">Chat patterns</strong> — your writing style, emoji usage, message length, and tone</span>
            </li>
          </ul>
          <p>
            Drag any slider to manually override the auto-detected setting. Your AI's tone, humor, directness, and support style will adapt immediately on your next message.
          </p>
        </div>
      </details>
    </div>
  );
}
