# SECTION 3: Mobile Frontend Updates

## Instructions for Your Other Emergent App

Paste this message into your other Emergent app:

---

Please update `/app/components/mobile/MobileChat.js` to handle image and video generation exactly like the desktop version. Make these changes:

## 1. Add these state variables (with other useState calls):

```javascript
const [streamingImageUrl, setStreamingImageUrl] = useState(null);
const [streamingVideoTask, setStreamingVideoTask] = useState(null);
const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
const [visualGenerationType, setVisualGenerationType] = useState('');
const streamingImageUrlRef = useRef(null);
const streamingVideoTaskRef = useRef(null);

// Add useEffect to sync refs
useEffect(() => { streamingImageUrlRef.current = streamingImageUrl; }, [streamingImageUrl]);
useEffect(() => { streamingVideoTaskRef.current = streamingVideoTask; }, [streamingVideoTask]);
```

## 2. REMOVE any popup/modal for media type selection

If there's a `detectedMediaIntent` state and useEffect that shows a popup when image/video intent is detected, COMMENT IT OUT or REMOVE it:

```javascript
// DISABLED - Let everything go through normal chat stream
// useEffect(() => {
//   const intent = detectMediaIntent(input);
//   if (intent !== detectedMediaIntent) {
//     setDetectedMediaIntent(intent);
//     if (intent) {
//       setShowMediaOptions(true);
//     }
//   }
// }, [input, detectMediaIntent, detectedMediaIntent]);
```

## 3. In the stream handler (where SSE data is processed), add these cases:

```javascript
} else if (data.type === 'image') {
  // Image generated – store url for rendering
  setStreamingImageUrl(data.url);
  streamingImageUrlRef.current = data.url;
  // Reset visual generation state since image arrived
  setIsGeneratingVisual(false);
  setVisualGenerationType('');
} else if (data.type === 'video_task') {
  // Video job started – store taskId for polling
  const videoTask = { taskId: data.taskId, status: 'generating', prompt: data.prompt };
  setStreamingVideoTask(videoTask);
  streamingVideoTaskRef.current = videoTask;
} else if (data.type === 'delta') {
  // Skip the markdown content if it's an image (we render the image directly)
  if (!streamingImageUrlRef.current) {
    fullContent += data.content;
    setStreamingContent(fullContent);
  } else {
    fullContent += data.content;
  }
  
  // Detect if AI is about to generate visual content
  const lowerContent = fullContent.toLowerCase();
  const generatingPhrases = [
    // Infographic/Flyer/Poster generation
    'generating the infographic', 'generate the infographic', 'create the infographic', 'creating the infographic',
    'generating the flyer', 'generate the flyer', 'create the flyer', 'creating the flyer',
    'generating the poster', 'generate the poster', 'create the poster', 'creating the poster',
    // Image generation - common phrases
    'generating this image', 'generate this image', 'creating this image',
    'generating your image', 'creating your image',
    'generating an image', 'creating an image',
    // Video generation - common phrases
    'generating your video', 'creating your video',
    'generating a video', 'creating a video',
    'generating the video', 'creating the video',
    'video generation started', 'video is being generated',
    'working on your video', 'crafting your video',
    // Intent phrases
    'i\'ll generate', 'i will generate', 'let me generate', 'let me create',
    'hold on for a moment', 'please hold', 'one moment while i',
    'working on your', 'designing your', 'crafting your',
    // Design phrases
    'i\'ll create a design', 'let me create a design', 'creating a design',
    'i\'ll update', 'let me update', 'updating the',
    'i\'ll edit', 'let me edit', 'editing the',
    'generating a new', 'creating a new', 'making a new',
    'give me a moment', 'moment while i work', 'while i generate',
    'working on this', 'work on this', 'creating this for you',
    'hold on while', 'wait while', 'please wait',
    'incorporating', 'applying the changes', 'making the changes',
    // Edit-specific phrases
    'editing your image', 'editing the image', 'applying the edit',
    'adding your logo', 'adding the logo', 'composite',
    // Model names indicate image generation in progress
    'nano banana', 'dall-e', 'seedream', 'gpt-image',
    // Video model names
    'kling', 'minimax', 'luma', 'runway',
    // Emoji prefixed messages from backend
    '🎨 generating', '✨ generating', '🖼️ generating',
    '🎨 creating', '✨ creating', '🖼️ creating',
    '🎬 generating', '🎬 creating', '🎬 video',
  ];
  const isGeneratingVisualContent = generatingPhrases.some(phrase => lowerContent.includes(phrase));
  
  if (isGeneratingVisualContent && !isGeneratingVisual) {
    let type = 'image';
    if (lowerContent.includes('infographic')) type = 'infographic';
    else if (lowerContent.includes('flyer')) type = 'flyer';
    else if (lowerContent.includes('poster')) type = 'poster';
    else if (lowerContent.includes('edit')) type = 'edit';
    else if (lowerContent.includes('video') || lowerContent.includes('🎬')) type = 'video';
    setIsGeneratingVisual(true);
    setVisualGenerationType(type);
  }
}
```

## 4. When creating the final message, include image_url and video_task:

```javascript
if (fullContent) {
  setMessages(prev => [...prev, {
    id: `a-${Date.now()}`,
    role: 'assistant',
    content: fullContent,
    model_used: actualModelUsed,
    smart_mode: selectedModel === 'smart',
    smart_reason: dynamicIntelligenceReason,
    sources: streamingSources.length > 0 ? [...streamingSources] : undefined,
    image_url: streamingImageUrlRef.current || undefined,
    video_task: streamingVideoTaskRef.current || undefined,
  }]);
}

setStreamingContent('');
setStreamingSources([]);
setStreamingImageUrl(null);
setStreamingVideoTask(null);
streamingImageUrlRef.current = null;
streamingVideoTaskRef.current = null;
setIsGeneratingVisual(false);
setVisualGenerationType('');
```

## 5. Add the Visual Generation Indicator (mobile-optimized version):

```jsx
{isGeneratingVisual && (
  <div className="mb-4 mx-2">
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 p-4">
      {/* Animated background shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      
      {/* Content */}
      <div className="relative flex items-center gap-3">
        {/* Animated icon */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-lg border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
        </div>
        
        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm mb-0.5">
            {visualGenerationType === 'infographic' ? '📊 Creating your infographic...' :
             visualGenerationType === 'flyer' ? '📄 Designing your flyer...' :
             visualGenerationType === 'poster' ? '🖼️ Creating your poster...' :
             visualGenerationType === 'edit' ? '✏️ Editing your image...' :
             visualGenerationType === 'video' ? '🎬 Generating your video...' :
             '✨ Generating your image...'}
          </p>
          <p className="text-gray-400 text-xs">
            {visualGenerationType === 'video' 
              ? 'This may take 1-3 minutes' 
              : 'This may take 15-30 seconds'}
          </p>
        </div>
      </div>
      
      {/* Progress animation */}
      <div className="mt-3 relative h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full animate-progress" />
      </div>
      
      {/* Progress dots */}
      <div className="mt-2 flex justify-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
)}
```

## 6. Make sure Sparkles icon is imported:

```javascript
import { Sparkles } from 'lucide-react';
```

---

