'use client';
import { useState } from 'react';
import SafeMarkdown from '@/components/SafeMarkdown';
import { Loader2, X, Globe, Clock, Zap, CheckCircle2, ChevronDown, Check, GitCompare } from 'lucide-react';
import { MODELS } from './constants';

// ── CompareResponseCard: Displays a single model's response in comparison mode ──
function CompareResponseCard({ response, onSelect, isLoading, selected, totalModels = 2 }) {
  const { model, provider, label, group, content, duration, success, error, usedSearch } = response || {};
  
  // Color coding by provider
  const getProviderColor = (prov) => {
    switch (prov) {
      case 'openai': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'anthropic': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'gemini': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'perplexity': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
      case 'kimi': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };
  
  const providerColorClass = getProviderColor(provider);
  
  // Dynamic height based on number of models - more height when fewer models
  const contentMaxHeight = totalModels <= 2 ? 'max-h-[400px]' : 'max-h-[300px]';
  
  if (isLoading) {
    return (
      <div className={`rounded-xl border ${providerColorClass.split(' ')[1]} ${providerColorClass.split(' ')[2]} p-5 flex-1 min-w-0`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${providerColorClass.split(' ')[0]}`}>{group}</span>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400">{label}</span>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-4/5" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-3/5" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-2/3" />
        </div>
      </div>
    );
  }
  
  if (!success) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-red-400">{group}</span>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400">{label}</span>
          </div>
          <X className="w-5 h-5 text-red-400" />
        </div>
        <p className="text-sm text-red-400">Failed: {error || 'Unknown error'}</p>
      </div>
    );
  }
  
  return (
    <div className={`rounded-xl border ${selected ? 'border-orange-500 ring-2 ring-orange-500/30' : providerColorClass.split(' ')[1]} ${providerColorClass.split(' ')[2]} p-5 flex-1 min-w-0 flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${providerColorClass.split(' ')[0]}`}>{group}</span>
          <span className="text-gray-600">/</span>
          <span className="text-sm text-gray-400">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {usedSearch && (
            <span className="flex items-center gap-1 text-xs text-cyan-400" title="Web search was used">
              <Globe className="w-3.5 h-3.5" /> Search
            </span>
          )}
          {duration && (
            <span className="flex items-center gap-1 text-xs text-gray-500" title={`Response time: ${(duration / 1000).toFixed(1)}s`}>
              <Clock className="w-3.5 h-3.5" />
              {(duration / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
      
      {/* Content - larger text and more height */}
      <div className={`flex-1 overflow-y-auto ${contentMaxHeight} mb-4 text-base text-gray-200 leading-7 prose prose-invert prose-base prose-p:my-3 prose-headings:my-4 prose-ul:my-3 prose-li:my-1.5 prose-code:text-orange-300`}>
        <SafeMarkdown content={content || ''} />
      </div>
      
      {/* Select Button */}
      <button
        onClick={() => onSelect(response)}
        disabled={selected}
        className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 flex-shrink-0 ${
          selected 
            ? 'bg-orange-500 text-white cursor-default' 
            : 'bg-white/5 border border-white/10 text-white hover:bg-orange-500/20 hover:border-orange-500/50'
        }`}
      >
        {selected ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Selected
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Use this response
          </>
        )}
      </button>
    </div>
  );
}

// ── CompareModePicker: Multi-select model picker for comparison mode ──────────
function CompareModePicker({ selectedModels, setSelectedModels, maxModels = 3 }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleModel = (model) => {
    const modelConfig = { model: model.value, provider: model.provider };
    const isSelected = selectedModels.some(m => m.model === model.value);
    
    if (isSelected) {
      setSelectedModels(prev => prev.filter(m => m.model !== model.value));
    } else if (selectedModels.length < maxModels) {
      setSelectedModels(prev => [...prev, modelConfig]);
    }
  };
  
  const getProviderBadgeColor = (provider) => {
    switch (provider) {
      case 'openai': return 'bg-green-500/20 text-green-400';
      case 'anthropic': return 'bg-blue-500/20 text-blue-400';
      case 'gemini': return 'bg-blue-500/20 text-blue-400';
      case 'perplexity': return 'bg-cyan-500/20 text-cyan-400';
      case 'kimi': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <GitCompare className="w-4 h-4 text-orange-400" />
        <span className="text-gray-300">
          {selectedModels.length === 0 
            ? 'Select models to compare' 
            : `${selectedModels.length} model${selectedModels.length > 1 ? 's' : ''} selected`}
        </span>
        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Selected model badges */}
      {selectedModels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedModels.map(sm => {
            const modelInfo = MODELS.find(m => m.value === sm.model);
            return (
              <span 
                key={sm.model}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${getProviderBadgeColor(sm.provider)}`}
              >
                {modelInfo?.label || sm.model}
                <button 
                  onClick={() => toggleModel({ value: sm.model, provider: sm.provider })}
                  className="hover:bg-white/10 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 bg-[#141a21] border border-white/10 rounded-xl p-2 shadow-2xl min-w-[280px] z-20 max-h-80 overflow-y-auto">
          <p className="text-[10px] text-gray-600 px-2 mb-2">
            Select up to {maxModels} models to compare • {maxModels - selectedModels.length} remaining
          </p>
          {['OpenAI', 'Claude', 'Gemini', 'Perplexity', 'Kimi'].map(group => {
            const groupModels = MODELS.filter(m => m.group === group);
            if (!groupModels.length) return null;
            return (
              <div key={group}>
                <div className="px-2 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider mt-1">{group}</div>
                {groupModels.map(m => {
                  const isSelected = selectedModels.some(sm => sm.model === m.value);
                  const isDisabled = !isSelected && selectedModels.length >= maxModels;
                  return (
                    <button 
                      key={m.value} 
                      onClick={() => toggleModel(m)}
                      disabled={isDisabled}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                        isSelected 
                          ? 'bg-orange-500/15 text-orange-400' 
                          : isDisabled 
                            ? 'text-gray-700 cursor-not-allowed' 
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{m.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export { CompareResponseCard, CompareModePicker };
