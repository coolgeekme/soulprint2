# SECTION 2: Frontend Stream Handlers & Visual Indicators

## Instructions for Your Other Emergent App

Paste this message into your other Emergent app:

---

Please update `/app/app/chat/page.js` to handle image and video generation with visual indicators. Make these changes:

## 1. Add these state variables (near the top of the component, with other useState calls):

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

## 2. In the stream handler (where you process SSE data), add these cases:

```javascript
} else if (data.type === 'image') {
  // Image generated – store url for rendering
  setStreamingImageUrl(data.url);
  setStreamingRevPrompt(data.revised_prompt);
  // Reset visual generation state since image arrived
  setIsGeneratingVisual(false);
  setVisualGenerationType('');
} else if (data.type === 'video_task') {
  // Video job started – store taskId for polling
  setStreamingVideoTask({ taskId: data.taskId, status: 'generating', prompt: data.prompt });
} else if (data.type === 'delta') {
  setSearchingWeb(false);
  // Skip the markdown content if it's an image (we render the image directly)
  if (!streamingImageUrlRef.current) {
    fullContent += data.content;
    setStreamingContent(fullContent);
    
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
      // Determine what type of visual is being generated
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
}
```

## 3. When creating the final message (on data.type === 'done'), include image_url and video_task:

```javascript
const finalMsg = {
  id: `a-${Date.now()}`,
  role: 'assistant',
  content: fullContent,
  created_at: new Date().toISOString(),
  model_used: actualModelUsed || selectedModel,
  smart_mode: selectedModel === 'smart',
  smart_reason: dynamicIntelligenceReason,
  image_url: streamingImageUrlRef.current || undefined,
  video_task: streamingVideoTaskRef.current || undefined,
  sources: streamingSourcesRef.current?.length > 0 ? streamingSourcesRef.current : undefined,
};
setMessages(prev => [...prev, finalMsg]);
setStreamingContent('');
setStreamingImageUrl(null);
setStreamingVideoTask(null);
// ... rest of cleanup
```

## 4. Add the Visual Generation Indicator component (in the JSX where streaming content is rendered):

```jsx
{isGeneratingVisual && (
  <div className="mb-6 mx-4">
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 p-6">
      {/* Animated background shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      
      {/* Content */}
      <div className="relative flex items-center gap-4">
        {/* Animated icon */}
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-purple-400 animate-pulse" />
          </div>
          {/* Spinning ring */}
          <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
        </div>
        
        {/* Text */}
        <div className="flex-1">
          <p className="text-white font-semibold text-base mb-1">
            {visualGenerationType === 'infographic' ? '📊 Creating your infographic...' :
             visualGenerationType === 'flyer' ? '📄 Designing your flyer...' :
             visualGenerationType === 'poster' ? '🖼️ Creating your poster...' :
             visualGenerationType === 'edit' ? '✏️ Editing your image...' :
             visualGenerationType === 'video' ? '🎬 Generating your video...' :
             '✨ Generating your image...'}
          </p>
          <p className="text-gray-400 text-sm">
            {visualGenerationType === 'video' 
              ? 'This may take 1-3 minutes. Creating cinematic magic!' 
              : 'This may take 15-30 seconds. We\'re crafting something beautiful!'}
          </p>
        </div>
      </div>
      
      {/* Progress animation */}
      <div className="mt-4 relative h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full animate-progress" />
      </div>
      
      {/* Progress dots */}
      <div className="mt-3 flex justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
)}
```

## 5. Add CSS animations to globals.css (if not already present):

```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 2s infinite;
}
@keyframes progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
.animate-progress {
  animation: progress 1.5s ease-in-out infinite;
}
```

## 6. Make sure Sparkles icon is imported:

```javascript
import { Sparkles } from 'lucide-react';
```

---

