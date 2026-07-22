'use client';
import { useState } from 'react';
import SafeMarkdown from '@/components/SafeMarkdown';
import MessageErrorBoundary from '@/components/MessageErrorBoundary';
import { Copy, Edit3, ThumbsUp, ThumbsDown, MoreVertical, Loader2, Globe, Sparkles, Film, Check, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';
import { MobileVideoCard, MobileSavedVideoCard, MobileImageCard } from './MobileMediaCards';
import { PdfCard } from '@/components/chat/PdfCard';
import MusicCard from '@/components/chat/MusicCard';

const MessageBubble = ({ message, isUser, assistantName, onCopy, onEdit, onFeedback, token, onRegenerateWith, onVideoReady, onReadAloud, readingAloudId, onToggleVariant, onExtendVideo, onRetryGeneration }) => {
  const [showActions, setShowActions] = useState(false);
  const [feedback, setFeedback] = useState(message.feedback || null);
  const [copyStatus, setCopyStatus] = useState(null); // 'success' | 'error' | null

  const handleCopy = async () => {
    const textToCopy = String(message?.content || '');
    if (!textToCopy) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus(null), 2000);
      return;
    }
    
    // Method 1: Try modern clipboard API first (best for iOS 13.4+, PWA-compatible)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopyStatus('success');
        setTimeout(() => {
          setCopyStatus(null);
        }, 1500);
        return;
      } catch (err) {
        console.log('Clipboard API failed, trying fallback:', err.message);
      }
    }
    
    // Method 2: Textarea fallback for older browsers/restrictive PWA contexts
    try {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      
      // iOS PWA-specific: Must be visible and focused
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.fontSize = '16px'; // iOS: prevent zoom
      
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      // iOS: Explicitly set selection range
      textarea.setSelectionRange(0, textToCopy.length);
      
      // Execute copy command
      const successful = document.execCommand('copy');
      
      document.body.removeChild(textarea);
      
      if (successful) {
        setCopyStatus('success');
        setTimeout(() => {
          setCopyStatus(null);
        }, 1500);
        return;
      }
    } catch (err) {
      console.error('Textarea copy failed:', err);
    }
    
    // If both methods failed
    setCopyStatus('error');
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleFeedback = async (type) => {
    setFeedback(type);
    setShowActions(false);
    if (onFeedback) {
      onFeedback(message.id, type);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 px-4">
        <div 
          className="max-w-[85%] bg-orange-500/20 border border-orange-500/30 rounded-3xl rounded-br-lg px-4 py-3"
          onTouchStart={(e) => {
            // Allow text selection - don't immediately show actions
            e.currentTarget._touchStartTime = Date.now();
          }}
          onTouchEnd={(e) => {
            // Only toggle actions on quick tap (< 200ms), not on long press for selection
            const touchDuration = Date.now() - (e.currentTarget._touchStartTime || 0);
            if (touchDuration < 200 && !window.getSelection()?.toString()) {
              setShowActions(!showActions);
            }
          }}
        >
          <p className="text-white text-base leading-7 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{String(message?.content || '')}</p>
          {/* Variant toggle for user messages */}
          {message.variants && message.variants.length > 1 && !showActions && (
            <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-orange-500/10" onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => onToggleVariant?.(message.id, 'prev')}
                disabled={(message.activeVariant || 0) === 0}
                className="p-0.5 rounded text-orange-400/60 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-[10px] text-orange-400/60 font-mono">
                {(message.activeVariant || 0) + 1}/{message.variants.length}
              </span>
              <button 
                onClick={() => onToggleVariant?.(message.id, 'next')}
                disabled={(message.activeVariant || 0) >= message.variants.length - 1}
                className="p-0.5 rounded text-orange-400/60 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <span className="text-[9px] text-orange-400/40 ml-1">
                {(message.activeVariant || 0) === 0 ? 'original' : 'edited'}
              </span>
            </div>
          )}
          {showActions && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-orange-500/20">
              <button onClick={handleCopy} className="text-orange-300 text-sm flex items-center gap-1.5 px-3 py-2 -mx-2 rounded-lg active:bg-orange-500/10">
                {copyStatus === 'success' ? (
                  <>
                    <Check className="w-4 h-4" /> Copied!
                  </>
                ) : copyStatus === 'error' ? (
                  <>
                    <Copy className="w-4 h-4" /> Failed
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy
                  </>
                )}
              </button>
              {onEdit && (
                <button onClick={() => { onEdit(message); setShowActions(false); }} className="text-orange-300 text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg active:bg-orange-500/10">
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4 px-4">
      <div className="max-w-[90%]">
        <div 
          className="bg-white/5 rounded-3xl rounded-bl-lg px-4 py-3"
          onTouchStart={(e) => {
            // Allow text selection - don't immediately show actions
            e.currentTarget._touchStartTime = Date.now();
          }}
          onTouchEnd={(e) => {
            // Only toggle actions on quick tap (< 200ms), not on long press for selection
            const touchDuration = Date.now() - (e.currentTarget._touchStartTime || 0);
            if (touchDuration < 200 && !window.getSelection()?.toString()) {
              setShowActions(!showActions);
            }
          }}
        >
          {/* Imprint Attribution Badge */}
          {message.activeImprint && (
            <div className="flex items-center gap-1.5 mb-1.5 -mt-0.5">
              <span className="text-sm leading-none">{message.activeImprint.icon}</span>
              <span className="text-[10px] font-medium text-white/40">{message.activeImprint.name}</span>
            </div>
          )}
          {/* Show generated image */}
          {message.image_url && (
            <MobileImageCard 
              url={message.image_url} 
              modelLabel={message.model_label} 
              token={token}
              prompt={message.generation_params?.prompt || message.content?.match(/generate.*?image.*?of\s+(.+)/i)?.[1] || ''}
              onRegenerateWith={onRegenerateWith}
            />
          )}
          
          {/* Show generated video */}
          {message.video_url && (
            <MobileSavedVideoCard 
              videoUrl={message.video_url} 
              modelLabel={message.model_label} 
              prompt={message.video_task?.prompt || message.generation_params?.prompt || ''} 
              token={token}
              onRegenerateWith={onRegenerateWith}
              onExtendVideo={onExtendVideo}
              videoTaskId={message.video_task?.taskId}
              sourceImageUrl={message.source_image || message.video_task?.sourceImage}
            />
          )}
          
          {/* Show video task with polling */}
          {message.video_task && !message.video_url && (
            <MobileVideoCard
              taskId={message.video_task.taskId}
              prompt={message.video_task.prompt || 'Video generation'}
              token={token}
              initialStatus={message.video_task.status === 'success' ? 'success' : 'generating'}
              modelLabel={message.model_label || 'Kling 3.0'}
              messageId={message.id}
              onVideoReady={(videoUrl) => {
                if (onVideoReady) onVideoReady(message.id, videoUrl);
              }}
              onRegenerateWith={onRegenerateWith}
              sourceImageUrl={message.source_image || message.video_task?.sourceImage}
            />
          )}
          
          {/* Show generated PDF document */}
          {message.file_url && (
            <PdfCard
              url={message.file_url}
              fileName={message.file_name}
              title={message.content?.match(/\[(.+?)\]/)?.[1] || message.file_name || 'Document'}
            />
          )}
          
          {/* Music card — inline audio player with polling */}
          {message.music_task && (
            <MusicCard
              jobId={message.music_task.jobId}
              initialData={{
                status: message.music_task.status || 'generating',
                title: message.music_task.title,
                style: message.music_task.style,
                instrumental: message.music_task.instrumental,
                tracks: message.music_task.tracks || [],
              }}
              token={token}
            />
          )}
          
          {/* Show animated generating state for media/flyers/infographics */}
          {message.is_generating && (
            <div className="mb-4">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-white/10 p-4">
                {/* Animated background shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                
                {/* Content */}
                <div className="relative flex items-center gap-3">
                  {/* Animated icon */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                    </div>
                    {/* Spinning ring */}
                    <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
                  </div>
                  
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm mb-0.5">Creating your design...</p>
                    <p className="text-gray-400 text-xs">Crafting something beautiful!</p>
                  </div>
                </div>
                
                {/* Progress dots */}
                <div className="flex justify-center gap-1.5 mt-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          {/* Message content — show empty when video_task is present (VideoCard handles display) or when image_url (image card handles display) */}
          <div className="text-gray-200 text-base leading-7 prose prose-invert prose-base max-w-none select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
            {(message.video_task && !message.video_url) || message.image_url ? null : (
            <>
            <SafeMarkdown content={typeof message.content === 'string' ? message.content : String(message.content || '')} />
            
            {/* Retry button for failed/timed-out generations */}
            {message.generation_failed && onRetryGeneration && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetryGeneration(); }}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry Generation
              </button>
            )}
            
            {/* Sources Section */}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Sources
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {message.sources.slice(0, 4).map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1"
                    >
                      <span className="w-4 h-4 rounded bg-orange-500/20 text-orange-400 text-[9px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-[10px] text-gray-400 truncate max-w-[100px]">
                        {source.title}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            </>
            )}
          </div>
          {showActions && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
              {/* Variant toggle for assistant messages */}
              {message.variants && message.variants.length > 1 && (
                <div className="flex items-center gap-1 mr-1 pr-2 border-r border-white/10" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => onToggleVariant?.(message.id, 'prev')}
                    disabled={(message.activeVariant || 0) === 0}
                    className="p-1.5 text-gray-400 disabled:opacity-30 rounded active:bg-white/5"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {(message.activeVariant || 0) + 1}/{message.variants.length}
                  </span>
                  <button 
                    onClick={() => onToggleVariant?.(message.id, 'next')}
                    disabled={(message.activeVariant || 0) >= message.variants.length - 1}
                    className="p-1.5 text-gray-400 disabled:opacity-30 rounded active:bg-white/5"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
              <button onClick={handleCopy} className="text-gray-400 text-sm flex items-center gap-1.5 px-3 py-2 -mx-2 rounded-lg active:bg-white/5">
                {copyStatus === 'success' ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" /> Copied!
                  </>
                ) : copyStatus === 'error' ? (
                  <>
                    <Copy className="w-4 h-4 text-red-400" /> Failed
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  if (onReadAloud) onReadAloud(message.content, message.id);
                }}
                className={`text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg active:bg-white/5 ${readingAloudId === message.id ? 'text-orange-400' : 'text-gray-400'}`}
              >
                {readingAloudId === message.id ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{readingAloudId === message.id ? 'Stop' : 'Read'}</span>
              </button>
              <button 
                onClick={() => handleFeedback('up')} 
                className={`text-sm flex items-center gap-1.5 p-2 rounded-lg active:bg-white/5 ${feedback === 'up' ? 'text-green-400' : 'text-gray-400'}`}
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleFeedback('down')} 
                className={`text-sm flex items-center gap-1.5 p-2 rounded-lg active:bg-white/5 ${feedback === 'down' ? 'text-red-400' : 'text-gray-400'}`}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {/* Model info - show Dynamic Intelligence badge if applicable */}
        {message.model_used && (
          <div className="ml-2 mt-1 flex items-center gap-2">
            {message.smart_mode && (
              <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">
                🧠 Smart
              </span>
            )}
            <span className="text-[10px] text-gray-600">{message.model_used}</span>
            {message.created_at && <span className="text-[9px] text-gray-700/60 ml-auto">{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        )}
        {!message.model_used && message.created_at && (
          <div className={`mt-1 ${isUser ? 'mr-2 text-right' : 'ml-2'}`}>
            <span className="text-[9px] text-gray-700/60">{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Conversation List Item with actions

export default MessageBubble;
