'use client';
import { useState } from 'react';
import SafeMarkdown from '@/components/SafeMarkdown';
import MessageErrorBoundary from '@/components/MessageErrorBoundary';
import { Copy, Edit3, ThumbsUp, ThumbsDown, MoreVertical, Loader2, Globe, Sparkles, Film, Check, Volume2, VolumeX } from 'lucide-react';
import { MobileVideoCard, MobileSavedVideoCard, MobileImageCard } from './MobileMediaCards';

const MessageBubble = ({ message, isUser, assistantName, onCopy, onEdit, onFeedback, token, onRegenerateWith, onVideoReady, onReadAloud, readingAloudId }) => {
  const [showActions, setShowActions] = useState(false);
  const [feedback, setFeedback] = useState(message.feedback || null);

  const handleCopy = () => {
    try {
      navigator.clipboard?.writeText(String(message?.content || ''));
    } catch (e) {
      console.error('Copy failed:', e);
    }
    setShowActions(false);
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
          onClick={() => setShowActions(!showActions)}
        >
          <p className="text-white text-base leading-7">{String(message?.content || '')}</p>
          {showActions && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-orange-500/20">
              <button onClick={handleCopy} className="text-orange-300 text-xs flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy
              </button>
              {onEdit && (
                <button onClick={() => { onEdit(message); setShowActions(false); }} className="text-orange-300 text-xs flex items-center gap-1">
                  <Edit3 className="w-3 h-3" /> Edit
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
          onClick={() => setShowActions(!showActions)}
        >
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
          <div className="text-gray-200 text-base leading-7 prose prose-invert prose-base max-w-none">
            {(message.video_task && !message.video_url) || message.image_url ? null : (
            <>
            <SafeMarkdown content={typeof message.content === 'string' ? message.content : String(message.content || '')} />
            
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
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/10">
              <button onClick={handleCopy} className="text-gray-400 text-xs flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button 
                onClick={() => {
                  if (onReadAloud) onReadAloud(message.content, message.id);
                }}
                className={`text-xs flex items-center gap-1 ${readingAloudId === message.id ? 'text-orange-400' : 'text-gray-400'}`}
              >
                {readingAloudId === message.id ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                <span>{readingAloudId === message.id ? 'Stop' : 'Read'}</span>
              </button>
              <button 
                onClick={() => handleFeedback('up')} 
                className={`text-xs flex items-center gap-1 ${feedback === 'up' ? 'text-green-400' : 'text-gray-400'}`}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button 
                onClick={() => handleFeedback('down')} 
                className={`text-xs flex items-center gap-1 ${feedback === 'down' ? 'text-red-400' : 'text-gray-400'}`}
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
          </div>
        )}
      </div>
    </div>
  );
};

// Conversation List Item with actions

export default MessageBubble;
