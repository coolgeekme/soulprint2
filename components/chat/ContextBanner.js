'use client';
import React, { useState } from 'react';
import { Info, Sparkles, MessageSquarePlus, X, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ContextAwarenessBanner — Shown when a conversation gets long enough
 * that the AI's context window is trimming older messages.
 * 
 * Props:
 *  - contextInfo: { total_messages, context_messages, trimmed }
 *  - onSummarize: () => void — triggers a summarize action
 *  - onNewChat: () => void — creates a new conversation
 *  - dismissed: boolean
 *  - onDismiss: () => void
 */
export function ContextAwarenessBanner({ contextInfo, onSummarize, onNewChat, dismissed, onDismiss }) {
  const [expanded, setExpanded] = useState(false);

  if (!contextInfo || !contextInfo.trimmed || dismissed) return null;
  if (contextInfo.total_messages < 40) return null;

  const { total_messages, context_messages } = contextInfo;
  const pct = Math.round((context_messages / total_messages) * 100);

  return (
    <div className="mx-auto max-w-3xl px-4 mb-3 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="relative bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-purple-500/8 border border-blue-500/15 rounded-xl px-4 py-3 backdrop-blur-sm">
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-300"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Main content */}
        <div className="flex items-start gap-3 pr-6">
          <div className="mt-0.5 p-1.5 rounded-lg bg-blue-500/15">
            <Info className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-gray-300 leading-relaxed">
              This conversation has <span className="text-white font-medium">{total_messages} messages</span>. 
              The AI is focused on your <span className="text-blue-400 font-medium">most recent {context_messages} messages</span> for 
              best accuracy.{' '}
              <span className="text-gray-500">All messages are saved — nothing is lost.</span>
            </p>

            {/* Expandable details */}
            <button 
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1.5 text-[11px] text-gray-500 hover:text-gray-400 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Less info' : 'Why am I seeing this?'}
            </button>

            {expanded && (
              <div className="mt-2 text-[11px] text-gray-500 leading-relaxed bg-white/3 rounded-lg p-3">
                <p>AI models have a context window — a limit on how much text they can consider at once. 
                When conversations get long, older messages are gradually moved out of the AI&apos;s active focus 
                to keep responses fast and accurate.</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-blue-400 font-mono text-[10px]">{pct}% in context</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={onSummarize}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Summarize & Continue
              </button>
              <button
                onClick={onNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300 transition-colors"
              >
                <MessageSquarePlus className="w-3 h-3" />
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
