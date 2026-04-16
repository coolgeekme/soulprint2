'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import RealtimeVoiceChat to avoid SSR issues with WebRTC
const RealtimeVoiceChat = dynamic(
  () => import('@/app/chat/components/RealtimeVoiceChat'),
  { 
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="text-white">Loading voice chat...</div>
      </div>
    )
  }
);

import SupportBubble from '@/components/chat/SupportBubble';

// Dynamically import GeminiVoiceChat for Gemini Live WebSocket voice
const GeminiVoiceChat = dynamic(
  () => import('@/app/chat/components/GeminiVoiceChat'),
  { 
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="text-white">Loading Gemini voice chat...</div>
      </div>
    )
  }
);
import Link from 'next/link';
import SafeMarkdown from '@/components/SafeMarkdown';
import MessageErrorBoundary from '@/components/MessageErrorBoundary';
import SafeSection from '@/components/SafeSection';
import {
  Plus, Mic, Send, Settings, ChevronLeft, ThumbsUp, ThumbsDown,
  MessageSquare, X, ChevronDown, Loader2, FileText, Globe,
  Image as ImageIcon, Paperclip, Search, Video, Download, RefreshCw, Play,
  MapPin, Upload, MoreVertical, Pencil, Trash2, Check, MessageCircle, Megaphone, ExternalLink, Shield, Brain, AudioWaveform, EyeOff, Paintbrush,
  GitCompare, CheckCircle2, Clock, Zap, Sparkles, Film, ImagePlus, Palette, GalleryHorizontal,
  Cloud, Link2, HardDrive, AlertCircle, FileArchive, Newspaper, ChevronRight, LogOut, Copy, Edit3, Square, ArrowRight,
  Folder, FolderPlus, Share2, Users, UserPlus, ArrowLeft, Sun, Moon, Code, Bot, Volume2, VolumeX
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { CloudUploadIcon, RobotIcon, FeedbackIcon, MicrophoneIcon, SendIcon, SparklesIcon, ImagePlusIcon, VideoIcon, LocationIcon, StopIcon, AttachIcon, PlusIcon } from '@/components/icons/SoulPrintIcons';
import InstallPrompt from '@/app/components/InstallPrompt';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileChat from '@/components/mobile/MobileChat';
import { useTheme } from '@/lib/providers/ThemeProvider';
import { useToast } from '@/hooks/use-toast';

// Extracted components
import useSpeechRecognition from '@/components/chat/useSpeechRecognition';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { VideoCard, SavedVideoCard } from '@/components/chat/VideoCards';
import VideoProgressBanner from '@/components/chat/VideoProgressBanner';
import ImageEditor from '@/components/chat/ImageEditor';
import VideoEditor from '@/components/chat/VideoEditor';
import { MockupGenerator } from '@/components/chat/MockupGenerator';
import ImageCard from '@/components/chat/ImageCard';
import { CompareResponseCard, CompareModePicker } from '@/components/chat/CompareMode';
import CreateMenu from '@/components/chat/CreateMenu';
import { GalleryItem, GalleryModal } from '@/components/chat/Gallery';
import CloudImportModal from '@/components/chat/CloudImportModal';
import { SettingsModal, FeedbackModal } from '@/components/chat/SettingsModal';
import AttachmentPill from '@/components/chat/AttachmentPill';
import { MediaConfirmCard, PromptReviewCard, ModelSelectionCard, VideoExtendConfirmCard, SourceMediaBanner } from '@/components/chat/MediaConfirmation';
import { IMAGE_MODELS, VIDEO_MODELS, MODELS, TELEGRAM_MODELS, ACCEPTED_FILE_TYPES, MAX_FILE_SIZE, MAX_INPUT_CHARS, WARN_INPUT_CHARS, SHOW_COUNTER_CHARS } from '@/components/chat/constants';
import AssessmentNudge from '@/components/AssessmentNudge';


export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { isDark } = useTheme(); // Get theme state for input styling
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [streamingStalled, setStreamingStalled] = useState(false); // Track if streaming seems stalled
  const [lastChunkTime, setLastChunkTime] = useState(null); // Track last chunk received time
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [searchQueries, setSearchQueries] = useState([]);
  const [streamingSources, setStreamingSources] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isIncognito, setIsIncognito] = useState(false); // Incognito mode — no messages saved
  const [mediaGenMode, setMediaGenMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sp_create_mode') === 'true';
    }
    return false;
  }); // Media creation mode — when ON, auto-generates
  const [selectedModel, setSelectedModel] = useState('smart');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showVideoModelPicker, setShowVideoModelPicker] = useState(false);
  const [defaultModelSaved, setDefaultModelSaved] = useState(null); // persisted default
  const [defaultVideoModelSaved, setDefaultVideoModelSaved] = useState('smart');
  const [defaultImageModelSaved, setDefaultImageModelSaved] = useState('smart');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState(null); // For opening settings to specific tab
  const [showVoiceChat, setShowVoiceChat] = useState(false); // For voice conversations
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(true); // Feature flag from admin
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop sidebar collapse state
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [user, setUser] = useState(null);
  const [assistantName, setAssistantName] = useState('SoulPrint');
  const [token, setToken] = useState('');
  const [attachments, setAttachments] = useState([]); // [{type, base64/text, name, mimeType}]
  const [pendingMediaAttachment, setPendingMediaAttachment] = useState(null); // For regeneration with source image
  const [lastSmartSelection, setLastSmartSelection] = useState(null); // Track which model Dynamic Intelligence selected
  const [fileError, setFileError] = useState('');
  // Location state
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [locationError, setLocationError] = useState(null);
  // Conversation management state
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [convMenuId, setConvMenuId] = useState(null); // which conversation's menu is open
  const [searchQuery, setSearchQuery] = useState(''); // conversation search
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const searchTimeoutRef = useRef(null);
  // Projects state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null); // null = all, 'general' = uncategorized, or project id
  const [projectConversations, setProjectConversations] = useState(null); // Conversations for selected project (fetched on demand)
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState('create'); // 'create' | 'edit' | 'share'
  const [editingProject, setEditingProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectInstructions, setNewProjectInstructions] = useState(''); // Custom AI instructions for project
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('collaborator');
  const [projectShareLink, setProjectShareLink] = useState(null);
  const [showMoveToProject, setShowMoveToProject] = useState(false);
  const [movingConversation, setMovingConversation] = useState(null);
  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [supportNotifications, setSupportNotifications] = useState([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState([]);
  // Media generation state
  const [streamingImageUrl, setStreamingImageUrl] = useState(null);
  const [streamingRevPrompt, setStreamingRevPrompt] = useState('');
  const [streamingVideoTask, setStreamingVideoTask] = useState(null); // { taskId, status, prompt }
  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState([]); // [{ model, provider }]
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResponses, setCompareResponses] = useState(null); // { responses: [], comparisonId, userMessageId }
  const [selectedCompareResponse, setSelectedCompareResponse] = useState(null);
  // Gallery & Media generation state
  const [showGallery, setShowGallery] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [selectedGalleryItem, setSelectedGalleryItem] = useState(null);
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  // Cloud import state
  const [showCloudImport, setShowCloudImport] = useState(false);
  // Latest news state
  const [latestNews, setLatestNews] = useState([]);
  const [showNewsExpanded, setShowNewsExpanded] = useState(false);
  // What's New (App Updates) state
  const [appUpdates, setAppUpdates] = useState([]);
  const [appUpdatesUnread, setAppUpdatesUnread] = useState(0);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  // Gradual assessment state (legacy — replaced by AssessmentNudge slider component)
  // PWA Install prompt state
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  // Onboarding modal state
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Media intent detection state (for natural language generation requests)
  const [detectedMediaIntent, setDetectedMediaIntent] = useState(null); // 'image' | 'video' | null
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [mediaOptionsExpanded, setMediaOptionsExpanded] = useState(false);
  const [quickAspectRatio, setQuickAspectRatio] = useState('1:1');
  const [quickVideoLength, setQuickVideoLength] = useState('5');
  const [selectedImageModel, setSelectedImageModel] = useState('smart');
  const [selectedVideoModel, setSelectedVideoModel] = useState('smart');
  // Visual content generation state (flyers, infographics, images)
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [visualGenerationType, setVisualGenerationType] = useState(''); // 'flyer', 'infographic', 'image'
  // Invite count state
  const [invitesRemaining, setInvitesRemaining] = useState(null);
  const [mediaConfirmation, setMediaConfirmation] = useState(null); // { detectedType, originalPrompt, refinedPrompt, availableModels, recommendedModel }
  const [mediaConfirmStep, setMediaConfirmStep] = useState(0); // 0=intent, 1=prompt review, 2=model selection
  const [mediaConfirmType, setMediaConfirmType] = useState(null); // 'image' | 'video' | null (chosen by user)
  const [quickGenerateEnabled, setQuickGenerateEnabled] = useState(false); // Skip confirmation flow
  const mediaConfirmRef = useRef(null); // Ref for current confirmation data to avoid stale closures
  const pendingMediaFlowRef = useRef(null); // Ref for pending mediaFlow to send with next message
  // Image-to-JSON generation state
  const [generatingImageJson, setGeneratingImageJson] = useState(false);
  const [imageJsonResult, setImageJsonResult] = useState(null);
  const [showImageJsonModal, setShowImageJsonModal] = useState(false);
  // Image editing state
  const [editableImage, setEditableImage] = useState(null); // { url, base64, source: 'upload'|'generated', messageId }
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [editableVideo, setEditableVideo] = useState(null); // { url, videoId }
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  // Mockup generator state
  const [showMockupGenerator, setShowMockupGenerator] = useState(false);
  const [mockupDesign, setMockupDesign] = useState(null);
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
  const streamingImageUrlRef = useRef(null);
  const streamingVideoTaskRef = useRef(null);
  const streamingSourcesRef = useRef([]);
  const messagesEndRef = useRef(null);
  const streamingBubbleRef = useRef(null);  // Ref for the top of the assistant's streaming reply
  const hasScrolledToReply = useRef(false); // Track if we've already scrolled to the reply start
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null); // For stopping requests
  const modelPickerRef = useRef(null); // For click-outside detection on model dropdown
  const videoModelPickerRef = useRef(null); // For click-outside detection on video model dropdown
  const [interimText, setInterimText] = useState('');

  // Keep refs in sync with state
  useEffect(() => { streamingImageUrlRef.current = streamingImageUrl; }, [streamingImageUrl]);
  useEffect(() => { streamingVideoTaskRef.current = streamingVideoTask; }, [streamingVideoTask]);
  useEffect(() => { streamingSourcesRef.current = streamingSources; }, [streamingSources]);

  // ── Global Media Notification System ──
  // Polls /api/media/pending for completed tasks across ALL conversations
  // Shows toast notifications when media finishes generating
  const { toast } = useToast();
  const notifiedTasksRef = useRef(new Set());
  const mediaPollIntervalRef = useRef(null);
  const conversationIdRef = useRef(conversationId);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  const isStreamingRef = useRef(false); // Synchronous flag to prevent state wipe during active streaming

  useEffect(() => {
    if (!token) return;
    
    const pollPendingMedia = async () => {
      try {
        const res = await fetch('/api/media/pending', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const tasks = await res.json();
        
        for (const task of tasks) {
          // Handle completed videos
          if (task.status === 'success' && !notifiedTasksRef.current.has(task.taskId)) {
            notifiedTasksRef.current.add(task.taskId);
            
            // Only show notification if user is NOT in the same conversation
            const isInSameConv = conversationIdRef.current === task.conversationId;
            
            // Update messages if in the same conversation
            if (isInSameConv) {
              setMessages(prev => prev.map(m => {
                if (m.video_task?.taskId === task.taskId) {
                  return { ...m, video_url: task.videoUrl, thumbnail_url: task.thumbnailUrl, video_task: { ...m.video_task, status: 'success' } };
                }
                return m;
              }));
            }
            
            // Show toast notification so user knows even after modal closes
            toast({
              title: `🎬 ${task.type === 'image' ? 'Image' : 'Video'} Ready!`,
              description: isInSameConv 
                ? `Your ${task.modelLabel || 'AI'} ${task.type || 'video'} is ready.`
                : `${task.modelLabel || 'AI'} ${task.type || 'video'} ready in "${task.conversationTitle}". Click to view.`,
              duration: 6000,
              className: 'bg-[#1a1f2e] border-orange-500/30 text-white cursor-pointer',
            });
          }
          
          // Handle failed videos — notify user so they're not left wondering
          if (task.status === 'failed' && !notifiedTasksRef.current.has(`fail-${task.taskId}`)) {
            notifiedTasksRef.current.add(`fail-${task.taskId}`);
            
            const isInSameConv = conversationIdRef.current === task.conversationId;
            if (isInSameConv) {
              setMessages(prev => prev.map(m => {
                if (m.video_task?.taskId === task.taskId) {
                  return { ...m, video_task: { ...m.video_task, status: 'failed', error: task.error } };
                }
                return m;
              }));
            }
            
            toast({
              title: `⚠️ ${task.type === 'image' ? 'Image' : 'Video'} Failed`,
              description: task.error || 'Generation failed. You can try again.',
              duration: 8000,
              variant: 'destructive',
            });
          }
        }
      } catch (e) {
        // Silently fail
      }
    };
    
    // Poll every 8 seconds for faster notification
    pollPendingMedia();
    mediaPollIntervalRef.current = setInterval(pollPendingMedia, 8000);
    
    return () => {
      if (mediaPollIntervalRef.current) clearInterval(mediaPollIntervalRef.current);
    };
  }, [token, toast]);

  // Handle URL params to open settings with specific tab (e.g., /chat?settings=telegram)
  useEffect(() => {
    const settingsTab = searchParams.get('settings');
    if (settingsTab && token) {
      setSettingsInitialTab(settingsTab);
      setShowSettings(true);
      // Clean up URL
      router.replace('/chat', { scroll: false });
    }
  }, [searchParams, token, router]);

  // Capture the beforeinstallprompt event for PWA install
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Media intent detection function
  const detectMediaIntent = useCallback((text) => {
    if (!text || text.length > 500) return null;
    const lower = text.toLowerCase().trim();
    
    // Negative patterns - don't trigger on these common false positives
    const negativePatterns = [
      /\b(how|can|could|would|should|do|does|did|will|what|why|is|are|was|were)\b.*\b(generate|create|make)\b/i,
      /\b(generate|create|make)\b.*\b(idea|list|plan|report|summary|code|text|content|response|email|message)\b/i,
      /\b(generate|create|make)\b.*\b(money|revenue|income|profit|leads|sales|results)\b/i,
      /\bdraw\s+(a\s+)?(conclusion|comparison|parallel|line|boundary|distinction|connection)\b/i,
      /\bpicture\s+(this|that|yourself)\b/i,
      /\bvisualize\s+(your|the\s+future|success|yourself|data|the\s+data)\b/i,
    ];
    if (negativePatterns.some(p => p.test(lower))) return null;
    
    // Video patterns - check first (more specific)
    const videoPatterns = [
      /\b(generate|create|make)\s+(a\s+|me\s+a\s+)?(video|clip|animation|short film)\b/i,
      /\banimate\s+(a|an|the|my|this)\s+\w/i,
      /\b(video|animation)\s+(of|for|about|showing)\b/i,
    ];
    if (videoPatterns.some(p => p.test(lower))) return 'video';
    
    // Image patterns - require clear generation intent
    const imagePatterns = [
      /\b(generate|create|make|draw|paint|design)\s+(me\s+)?(a|an)\s+(image|picture|photo|illustration|artwork|painting|poster|flyer|infographic|logo|banner|thumbnail|meme|wallpaper|portrait|headshot)\b/i,
      /\b(show|give)\s+me\s+(a|an)\s+(picture|image|photo|illustration)\s+(of|with|showing)\b/i,
      /\b(draw|paint|sketch|illustrate)\s+(me\s+)?(a|an|my|the)\s+\w/i,
      /\b(image|picture|photo|illustration)\s+(of|for|about|showing|with)\b.*\b(please|style|realistic|cartoon|anime)\b/i,
    ];
    if (imagePatterns.some(p => p.test(lower))) return 'image';
    
    return null;
  }, []);

  // Watch input for media intent changes
  useEffect(() => {
    const intent = detectMediaIntent(input);
    if (intent !== detectedMediaIntent) {
      setDetectedMediaIntent(intent);
      if (intent) {
        setShowMediaOptions(true);
      }
    }
  }, [input, detectMediaIntent, detectedMediaIntent]);

  // Check if we should show the install prompt
  useEffect(() => {
    if (!token) return;
    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;
    if (isStandalone) return; // Already installed
    
    // Check user preference from API
    fetch('/api/pwa/install-status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.showPrompt) {
          setShowInstallPrompt(true);
        }
      })
      .catch(() => {});
  }, [token]);

  // Handle PWA install prompt actions
  const handleInstallAction = async (action) => {
    if (action === 'install' && deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      if (result.outcome === 'accepted') {
        action = 'installed';
      } else {
        action = 'remind_later';
      }
      setDeferredInstallPrompt(null);
    }
    
    // Save preference to API
    try {
      await fetch('/api/pwa/install-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
    } catch (e) {
      console.error('Failed to save install preference:', e);
    }
    
    setShowInstallPrompt(false);
  };

  // Speech-to-text hook — needs token so init after token is set
  const speech = useSpeechRecognition({
    token,
    onTranscript: (text) => {
      setInput(prev => (prev ? prev + ' ' + text : text));
      setInterimText('');
    },
    onInterim: (text) => setInterimText(text),
  });

  useEffect(() => {
    const t = localStorage.getItem('sp_token');
    if (!t) { router.push('/auth'); return; }
    setToken(t);
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.accepted && d.role === 'user') { router.push('/waitlist'); return; }
        setUser(d);
        setAssistantName(d.profile?.assistant_name || 'SoulPrint');
        // Load user settings (quick_generate, etc.)
        fetch('/api/user/settings', { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.ok ? r.json() : null)
          .then(settings => { if (settings) setQuickGenerateEnabled(settings.quick_generate || false); })
          .catch(() => {});
        // Load invite count
        fetch('/api/invites', { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => { 
            if (data && data.enabled !== false) {
              setInvitesRemaining(data.invites_remaining ?? 0); 
            }
          })
          .catch(() => {});
        const greet = d.profile?.display_name || 'there';
        const botName = d.profile?.assistant_name || 'SoulPrint';
        const customGreeting = d.profile?.custom_greeting;
        
        // Check if new user (show onboarding if they haven't seen it)
        const hasSeenOnboarding = localStorage.getItem('sp_onboarding_seen');
        if (!hasSeenOnboarding && !d.profile?.onboarding_completed) {
          setShowOnboarding(true);
        }
        
        // Use custom greeting if set, otherwise use default
        const greetingEnabled = d.profile?.ai_greeting_enabled !== false;
        if (greetingEnabled) {
          const greetingContent = customGreeting 
            ? customGreeting.replace('{name}', greet).replace('{assistant}', botName)
            : `Hey ${greet} 👋 I'm **${botName}**, your personal AI.\n\nI can help with research, analysis, planning, and more. I also have **real-time web search** — just ask me anything current.\n\nWhat's on your mind?`;
          
          setMessages([{
            id: 'greeting', role: 'assistant',
            content: greetingContent,
            created_at: new Date().toISOString(),
          }]);
        } else {
          setMessages([]);
        }
      })
      .catch(() => router.push('/auth'));
    // Fetch feature flags
    fetch('/api/feature-flags', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(flags => {
        if (flags.voice_chat_enabled !== undefined) {
          setVoiceChatEnabled(flags.voice_chat_enabled);
        }
      })
      .catch(() => {}); // Silent fail, default to enabled
    fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => {
        const convList = Array.isArray(d) ? d : [];
        setConversations(convList);
        // Resume the most recent conversation if one exists
        if (convList.length > 0) {
          const lastConv = convList[0]; // Already sorted by updated_at desc
          setConversationId(lastConv.id);
          fetch(`/api/messages?conversationId=${lastConv.id}`, { headers: { Authorization: `Bearer ${t}` } })
            .then(r => r.json())
            .then(msgs => {
              if (Array.isArray(msgs) && msgs.length > 0) {
                setMessages(msgs);
              }
            })
            .catch(() => {});
        }
      }).catch(() => {});
    // Fetch projects
    fetch('/api/projects', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => {
        const allProjects = [
          ...(d.owned || []),
          ...(d.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
      }).catch(() => {});
    // Fetch announcements
    fetch('/api/announcements', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => setAnnouncements(d.unread || [])).catch(() => {});
    // Fetch support notifications (issue resolutions)
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => setSupportNotifications(d.notifications || [])).catch(() => {});
    // Fetch app updates (What's New)
    fetch('/api/app-updates', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => {
        setAppUpdates(d.updates || []);
        setAppUpdatesUnread(d.unread_count || 0);
      }).catch(() => {});
    // Fetch latest news/blog posts
    fetch('/api/blog/posts?limit=3')
      .then(r => r.json()).then(d => setLatestNews(d.posts || [])).catch(() => {});
  }, []);

  // Auto-request location when user loads the app (if not already set)
  useEffect(() => {
    if (!token || !user) return;
    
    // Check if we already have location or have asked before this session
    const hasAskedLocation = sessionStorage.getItem('sp_location_asked');
    if (hasAskedLocation) return;
    
    // Mark that we've asked this session
    sessionStorage.setItem('sp_location_asked', 'true');
    
    // Check if user already has location saved
    fetch('/api/user/location', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.hasLocation) {
          // User already has location, just set it
          setUserLocation({ lat: data.lat, lng: data.lng, address: data.address, timezone: data.timezone });
        } else {
          // Request location automatically (silently - no error messages shown)
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                  const res = await fetch('/api/user/location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ 
                      lat: latitude, 
                      lng: longitude,
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    }),
                  });
                  const locData = await res.json();
                  if (res.ok) {
                    setUserLocation({ lat: latitude, lng: longitude, address: locData.address, timezone: locData.timezone });
                  }
                } catch (err) {
                  console.log('Auto location save failed:', err);
                }
              },
              (error) => {
                // Silently fail - user can manually set location later
                console.log('Auto location request denied or failed:', error.message);
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
            );
          }
        }
      })
      .catch(() => {});
  }, [token, user]);

  // Auto-scroll: scroll to the TOP of the assistant's reply bubble once when streaming starts
  useEffect(() => {
    if (loading && streamingContent && !hasScrolledToReply.current) {
      // Streaming just started — scroll the reply bubble top into view
      hasScrolledToReply.current = true;
      setTimeout(() => {
        streamingBubbleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    if (!loading) {
      // Streaming ended — reset for next reply
      hasScrolledToReply.current = false;
    }
  }, [loading, streamingContent]);

  // When user sends a message (new message added), scroll to bottom so they see their message
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'user') {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
      // For completed assistant messages (e.g., after streaming ends), scroll to top of that message
      if (lastMsg?.role === 'assistant' && !loading) {
        // Find the message element and scroll to its top
        const msgEl = document.getElementById(`msg-${lastMsg.id}`);
        if (msgEl) {
          setTimeout(() => {
            msgEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
      }
    }
  }, [messages.length, loading]);

  // Detect stalled streaming - if no chunk received for 8 seconds while loading
  useEffect(() => {
    if (!loading || !lastChunkTime) return;
    
    const checkStall = setInterval(() => {
      const timeSinceLastChunk = Date.now() - lastChunkTime;
      if (timeSinceLastChunk > 8000 && streamingContent) {
        setStreamingStalled(true);
      }
    }, 2000);
    
    return () => clearInterval(checkStall);
  }, [loading, lastChunkTime, streamingContent]);

  // Close conversation menu when clicking outside
  useEffect(() => {
    if (!convMenuId) return;
    const handleClickOutside = () => setConvMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [convMenuId]);

  // Close model picker when clicking outside
  useEffect(() => {
    if (!showModelPicker) return;
    const handleClickOutside = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
        setShowModelPicker(false);
      }
    };
    // Use timeout so the current click event that opened the picker doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModelPicker]);

  // Close video model picker when clicking outside
  useEffect(() => {
    if (!showVideoModelPicker) return;
    const handleClickOutside = (e) => {
      if (videoModelPickerRef.current && !videoModelPickerRef.current.contains(e.target)) {
        setShowVideoModelPicker(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVideoModelPicker]);


  // Dismiss announcement
  async function dismissAnnouncement(announcementId, permanent = false) {
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
    try {
      await fetch('/api/announcements/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ announcementId, permanent }),
      });
    } catch (e) {
      console.error('Failed to dismiss announcement:', e);
    }
  }

  // Process a file into an attachment object (image, document, or text)
  async function processFile(file) {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|avi)$/i);
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDOCX = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   file.name.toLowerCase().endsWith('.docx');
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.type === 'application/vnd.ms-excel' ||
                    file.name.toLowerCase().endsWith('.xlsx') ||
                    file.name.toLowerCase().endsWith('.xls');
    
    if (isImage) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const originalBase64 = e.target.result;
          
          // Compress large images to reduce request payload size
          // Max 1536px on longest side, quality 0.80
          const img = new Image();
          img.onload = () => {
            const MAX_DIM = 1536;
            let { width, height } = img;
            
            // Always compress for safety — even "small" images benefit from consistent handling
            const originalSize = originalBase64.length;
            const needsResize = width > MAX_DIM || height > MAX_DIM;
            const needsCompress = originalSize > 500_000 || needsResize;
            
            if (!needsCompress) {
              const base64 = originalBase64.split(',')[1];
              resolve({ type: 'image', base64, mimeType: file.type, name: file.name, originalSize: base64.length });
              return;
            }
            
            // Scale down proportionally
            if (needsResize) {
              const scale = MAX_DIM / Math.max(width, height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Always compress to JPEG for photos (much smaller), keep PNG for transparent
            const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const quality = outputType === 'image/jpeg' ? 0.75 : undefined;
            const compressedDataUrl = canvas.toDataURL(outputType, quality);
            const compressedBase64 = compressedDataUrl.split(',')[1];
            
            console.log(`[Attach] Compressed ${file.name}: ${Math.round(originalSize/1024)}KB → ${Math.round(compressedBase64.length/1024)}KB (${width}x${height})`);
            resolve({ type: 'image', base64: compressedBase64, mimeType: outputType, name: file.name, originalSize: compressedBase64.length });
          };
          img.onerror = () => {
            // Fallback: use original if Image() fails
            const base64 = originalBase64.split(',')[1];
            resolve({ type: 'image', base64, mimeType: file.type, name: file.name, originalSize: base64.length });
          };
          img.src = originalBase64;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else if (isVideo) {
      // Handle video files — convert to base64 so backend can process the video data
      const localUrl = URL.createObjectURL(file);
      
      // Convert video to base64 for backend frame extraction
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1]; // Strip data URL prefix
          console.log(`[Attach] Video ${file.name}: ${Math.round(file.size/1024)}KB → base64 ${Math.round(base64.length/1024)}KB`);
          resolve({
            type: 'video',
            name: file.name,
            mimeType: file.type || 'video/mp4',
            size: file.size,
            base64,
            localUrl,
          });
        };
        reader.onerror = () => {
          console.warn(`[Attach] Failed to read video ${file.name}, keeping file reference only`);
          resolve({
            type: 'video',
            name: file.name,
            mimeType: file.type || 'video/mp4',
            size: file.size,
            localUrl,
          });
        };
        reader.readAsDataURL(file);
      });
    } else if (isPDF || isDOCX || isExcel) {
      // Parse PDF/DOCX/Excel on the server
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/parse/document', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to parse document');
        }
        
        const data = await res.json();
        return { 
          type: 'document', 
          text: data.text || '', 
          name: file.name, 
          mimeType: file.type,
          metadata: data.metadata 
        };
      } catch (err) {
        console.error('Document parse error:', err);
        return { 
          type: 'document', 
          text: `[Error reading ${file.name}: ${err.message}]`, 
          name: file.name, 
          mimeType: file.type 
        };
      }
    } else {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({ type: 'document', text: e.target.result?.slice(0, 128000) || '', name: file.name, mimeType: file.type });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    setFileError('');
    for (const file of files) {
      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|avi|mkv|m4v)$/i);
      const maxSize = isVideo ? 100 * 1024 * 1024 : MAX_FILE_SIZE; // 100MB for video, 50MB for others
      if (file.size > maxSize) { 
        setFileError(`${file.name} is too large (max ${isVideo ? '100MB' : '50MB'})`); 
        continue; 
      }
      try {
        const processed = await processFile(file);
        setAttachments(prev => [...prev, processed]);
      } catch (err) {
        setFileError(`Could not process ${file.name}`);
      }
    }
    e.target.value = '';
  }

  // Handle paste events for images
  async function handlePaste(e) {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;
    
    const imageItems = Array.from(clipboardItems).filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return; // Let default paste behavior handle text
    
    e.preventDefault(); // Prevent default only if we have images
    setFileError('');
    
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`Pasted image is too large (max 50MB)`);
        continue;
      }
      
      try {
        const processed = await processFile(file);
        setAttachments(prev => [...prev, processed]);
      } catch (err) {
        setFileError(`Could not process pasted image`);
      }
    }
  }

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Handle drag and drop for files/images
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.items?.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    
    setFileError('');
    
    for (const file of files) {
      // Check if it's an accepted file type
      const isHeicFile = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
      const isImage = file.type.startsWith('image/') || isHeicFile;
      const isAccepted = ACCEPTED_FILE_TYPES.split(',').some(type => {
        const cleanType = type.trim();
        if (cleanType.startsWith('.')) {
          return file.name.toLowerCase().endsWith(cleanType);
        }
        return file.type === cleanType || file.type.startsWith(cleanType.replace('/*', '/'));
      });
      
      if (!isImage && !isAccepted) {
        setFileError(`${file.name} is not a supported file type`);
        continue;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`${file.name} is too large (max 50MB)`);
        continue;
      }
      
      try {
        const processed = await processFile(file);
        setAttachments(prev => [...prev, processed]);
      } catch (err) {
        setFileError(`Could not process ${file.name}`);
      }
    }
  }, []);

  // Check if running as iOS PWA
  const isIOSPwa = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true;
    return isIOS && isStandalone;
  }, []);

  // Request and save user's browser location
  const requestLocation = useCallback(async () => {
    // Clear previous errors
    setLocationError(null);
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please enter your location manually.');
      setShowLocationModal(true);
      return;
    }
    
    // Check if running as PWA on iOS - may need special handling
    const isPwaIOS = isIOSPwa();
    
    setLocationLoading(true);
    
    // Attempt to get location with a shorter timeout for better UX
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          const res = await fetch('/api/user/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ 
              lat: latitude, 
              lng: longitude,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setUserLocation({ lat: latitude, lng: longitude, address: data.address, timezone: data.timezone, accuracy });
            setLocationError(null);
            // Show confirmation in chat
            setMessages(prev => [...prev, {
              id: `loc-${Date.now()}`, role: 'assistant',
              content: `📍 **Location saved!**\n\n${data.address}${data.timezone ? `\n🕐 Timezone: ${data.timezone}` : ''}\n\nYou can now ask me things like:\n- "Find restaurants near me"\n- "What's on my calendar today?"\n- "Schedule a meeting for tomorrow at 3pm"`,
              created_at: new Date().toISOString(),
            }]);
          } else {
            setLocationError(data.error || 'Failed to save location');
          }
        } catch (err) {
          console.error('Failed to save location:', err);
          setLocationError('Failed to save location. Please try again.');
        }
        setLocationLoading(false);
      },
      (error) => {
        setLocationLoading(false);
        
        // Build helpful error message based on error type and platform
        let errorMsg = '';
        
        // Detect platform for better instructions
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            if (isIOS && isPWA) {
              errorMsg = '**Location access denied**\n\nFor iOS PWA:\n1. Open Settings → Privacy & Security → Location Services\n2. Find Safari Websites\n3. Enable "While Using"\n4. Return and try again\n\nOr enter your location manually below.';
            } else if (isIOS) {
              errorMsg = '**Location access denied**\n\nOn iOS Safari:\n1. Open Settings → Safari → Location\n2. Set to "Ask" or "Allow"\n3. Refresh this page and try again\n\nOr enter your location manually below.';
            } else if (isAndroid && isChrome) {
              errorMsg = '**Location access denied**\n\nOn Android Chrome:\n1. Tap the lock icon in the address bar\n2. Tap "Permissions"\n3. Enable "Location"\n4. Refresh and try again\n\nOr enter your location manually below.';
            } else if (isChrome) {
              errorMsg = '**Location access denied**\n\nIn Chrome:\n1. Click the lock/info icon in the address bar\n2. Find "Location" and set to "Allow"\n3. Refresh the page\n\nOr enter your location manually below.';
            } else if (isFirefox) {
              errorMsg = '**Location access denied**\n\nIn Firefox:\n1. Click the lock icon in the address bar\n2. Click "Connection secure" → "More Information"\n3. Go to Permissions tab and allow Location\n\nOr enter your location manually below.';
            } else if (isSafari) {
              errorMsg = '**Location access denied**\n\nIn Safari:\n1. Go to Safari → Settings for This Website\n2. Set Location to "Allow"\n3. Refresh the page\n\nOr enter your location manually below.';
            } else {
              errorMsg = '**Location access denied**\n\nPlease enable location access:\n1. Click the lock/site icon in your browser\'s address bar\n2. Find Location permissions and set to "Allow"\n3. Refresh the page and try again\n\nOr enter your location manually below.';
            }
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = '**Could not determine your location**\n\nThis may be due to:\n- Poor GPS/network signal\n- Location services disabled on your device\n- VPN or network restrictions\n\nPlease enter your location manually below.';
            break;
          case error.TIMEOUT:
            errorMsg = '**Location request timed out**\n\nThis can happen with poor signal. Please try again or enter your location manually below.';
            break;
          default:
            errorMsg = '**Could not get your location**\n\nPlease enter it manually below.';
        }
        
        setLocationError(errorMsg);
        setShowLocationModal(true);
      },
      { 
        enableHighAccuracy: true, 
        timeout: (isIOSPwa() || /iPad|iPhone|iPod/.test(navigator.userAgent)) ? 15000 : 10000,
        maximumAge: 300000 // 5 minutes cache
      }
    );
  }, [token, isIOSPwa]);

  // Save manually entered location
  const saveManualLocation = useCallback(async () => {
    if (!manualLocationInput.trim()) {
      setLocationError('Please enter a location (city, address, or zip code)');
      return;
    }
    
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      // Use geocode API to convert address to coordinates
      const res = await fetch('/api/places/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: manualLocationInput.trim() }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.lat && data.lng) {
        // Save the geocoded location
        const saveRes = await fetch('/api/user/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat: data.lat, lng: data.lng }),
        });
        
        const saveData = await saveRes.json();
        
        if (saveRes.ok) {
          setUserLocation({ 
            lat: data.lat, 
            lng: data.lng, 
            address: data.formattedAddress || saveData.address || manualLocationInput,
            manual: true 
          });
          setShowLocationModal(false);
          setManualLocationInput('');
          
          // Show confirmation in chat
          setMessages(prev => [...prev, {
            id: `loc-${Date.now()}`, role: 'assistant',
            content: `📍 **Location saved!**\n\n${data.formattedAddress || manualLocationInput}\n\nYou can now ask me things like:\n- "Find restaurants near me"\n- "What coffee shops are nearby?"\n- "Show me gas stations close by"`,
            created_at: new Date().toISOString(),
          }]);
        } else {
          setLocationError(saveData.error || 'Failed to save location');
        }
      } else {
        setLocationError(data.error || 'Could not find that location. Please try a different address.');
      }
    } catch (err) {
      console.error('Failed to geocode location:', err);
      setLocationError('Failed to look up location. Please check your internet connection and try again.');
    }
    
    setLocationLoading(false);
  }, [token, manualLocationInput]);

  // Fetch saved location on load
  useEffect(() => {
    if (!token) return;
    fetch('/api/user/location', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.hasLocation) {
          setUserLocation({ lat: d.lat, lng: d.lng, address: d.address });
        }
      })
      .catch(() => {});
  }, [token]);

  // Save voice conversation transcript to chat history
  const saveVoiceTranscript = async (transcriptItems) => {
    if (!transcriptItems || transcriptItems.length === 0) return;
    
    try {
      // Create a new conversation for the voice chat if needed
      let voiceConvId = conversationId;
      if (!voiceConvId) {
        const convRes = await fetch('/api/user/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ 
            title: `Voice Conversation - ${new Date().toLocaleDateString()}`,
            model: 'gpt-realtime-1.5'
          }),
        });
        const convData = await convRes.json();
        voiceConvId = convData.id;
        setConversationId(voiceConvId);
      }
      
      // Save each transcript item as a message
      for (const item of transcriptItems) {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            conversation_id: voiceConvId,
            role: item.role,
            content: `🎤 *Voice*: ${item.text}`,
          }),
        });
        
        // Add to local messages too
        setMessages(prev => [...prev, {
          id: `voice-${Date.now()}-${Math.random()}`,
          role: item.role,
          content: `🎤 *Voice*: ${item.text}`,
          created_at: new Date().toISOString(),
        }]);
      }
      
      // Refresh conversations list
      loadConversations();
    } catch (e) {
      console.error('Failed to save voice transcript:', e);
    }
  };

  // Generate media (image or video) with quick options
  const generateMediaWithOptions = useCallback(async () => {
    if (!input.trim() || loading || isGeneratingMedia) return;
    
    setShowMediaOptions(false);
    setLoading(true);
    setIsGeneratingMedia(true);
    
    const content = input.trim();
    const userMessage = { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      content: content,
    };
    setMessages(prev => [...prev, userMessage]);
    setUserMessageCount(prev => prev + 1);
    setInput('');
    setDetectedMediaIntent(null);
    
    try {
      if (detectedMediaIntent === 'image') {
        // Generate image using selected model (or default to first in list)
        const modelToUse = selectedImageModel || IMAGE_MODELS[0].value;
        const res = await fetch('/api/media/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: 'image',
            model: modelToUse,
            prompt: content,
            aspectRatio: quickAspectRatio,
            quality: 'standard',
            style: 'vivid',
            conversationId: currentConversationId,
          }),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Image generation failed');
        
        const modelLabel = IMAGE_MODELS.find(m => m.value === modelToUse)?.label || modelToUse;
        const assistantMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `🎨 Image generated with ${modelLabel}!\n\n**Prompt:** ${content}`,
          image_url: data.url,
          model_label: modelLabel,
        };
        setMessages(prev => [...prev, assistantMsg]);
        
      } else if (detectedMediaIntent === 'video') {
        // Generate video using selected model (or default to first in list)
        const modelToUse = selectedVideoModel || VIDEO_MODELS[0].value;
        const res = await fetch('/api/media/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: 'video',
            model: modelToUse,
            prompt: content,
            aspectRatio: quickAspectRatio === '1:1' ? '16:9' : quickAspectRatio,
            duration: parseInt(quickVideoLength) || 5,
            conversationId: currentConversationId,
          }),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Video generation failed');
        
        const modelLabel = VIDEO_MODELS.find(m => m.value === modelToUse)?.label || modelToUse;
        const assistantMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `🎬 Video generation started with ${modelLabel}!\n\n**Prompt:** ${content}\n\nYour video is being generated and will appear when ready (1-3 min)...`,
          video_task: { taskId: data.taskId, status: 'generating', prompt: content },
          model_label: modelLabel,
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      console.error('Media generation error:', error);
      const errorMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, ${detectedMediaIntent} generation failed: ${error.message}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setIsGeneratingMedia(false);
    }
  }, [input, loading, isGeneratingMedia, detectedMediaIntent, token, mediaOptionsExpanded, quickAspectRatio, quickVideoLength]);

  // Send as regular chat (bypass media detection)
  const sendAsChat = useCallback(() => {
    setShowMediaOptions(false);
    setDetectedMediaIntent(null);
    // Trigger the sendMessage function directly after resetting states
    setTimeout(() => {
      if (inputRef.current) {
        // This will be called when user clicks "Just Chat"
      }
    }, 0);
  }, []);

  // Pre-upload image attachments individually to avoid large payload in chat request
  const preUploadAttachments = useCallback(async (atts) => {
    if (!atts || atts.length === 0) return atts;
    
    // Calculate total base64 size of image attachments
    const imageAtts = atts.filter(a => a.type === 'image' && a.base64 && !a.isUrlReference);
    const totalBase64Size = imageAtts.reduce((sum, a) => sum + (a.base64?.length || 0), 0);
    
    // Only pre-upload if total payload is large (>800KB of base64 data) or 2+ images
    const UPLOAD_THRESHOLD = 800_000; // ~800KB base64 = ~600KB raw
    if (totalBase64Size < UPLOAD_THRESHOLD && imageAtts.length < 2) {
      return atts; // Small enough to send inline
    }
    
    console.log(`[PreUpload] ${imageAtts.length} images, total ${Math.round(totalBase64Size/1024)}KB — pre-uploading...`);
    
    const uploaded = await Promise.all(atts.map(async (att) => {
      if (att.type !== 'image' || !att.base64 || att.isUrlReference) return att;
      
      try {
        const res = await fetch('/api/attachments/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            base64: att.base64,
            mimeType: att.mimeType,
            name: att.name,
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.url) {
            console.log(`[PreUpload] ${att.name} → ${data.url.substring(0, 60)}...`);
            return {
              ...att,
              base64: data.url, // Replace base64 with URL
              isUrlReference: true,
            };
          }
        }
        console.warn(`[PreUpload] Upload failed for ${att.name}, sending inline`);
        return att; // Fallback: send inline
      } catch (err) {
        console.warn(`[PreUpload] Error uploading ${att.name}:`, err.message);
        return att; // Fallback: send inline
      }
    }));
    
    return uploaded;
  }, [token]);

  // Convert large pasted text into a .txt file attachment to bypass per-message token limits
  const convertInputToFile = useCallback(() => {
    if (!input.trim()) return;
    const text = input.trim();
    const lines = text.split('\n').length;
    const fileName = `pasted_content_${lines}_lines.txt`;
    setAttachments(prev => [...prev, { type: 'document', text: text.slice(0, 128000), name: fileName, mimeType: 'text/plain' }]);
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input]);

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0 && !pendingMediaAttachment) || loading || compareLoading) return;
    const content = input.trim();
    
    // Handle pending media attachment for regeneration
    let currentAttachments = [...attachments];
    if (pendingMediaAttachment && pendingMediaAttachment.url) {
      // Add URL reference attachment for regeneration
      currentAttachments.push({
        type: 'image',
        base64: pendingMediaAttachment.url, // Backend will handle URL vs base64
        mimeType: 'image/jpeg',
        name: 'regeneration-source.jpg',
        isUrlReference: true, // Flag to indicate this is a URL not base64
      });
    }
    
    // Pre-upload large image attachments to reduce chat payload size
    // This prevents "Connection error" when sending multiple images
    try {
      currentAttachments = await preUploadAttachments(currentAttachments);
    } catch (uploadErr) {
      console.warn('[PreUpload] Failed, sending inline:', uploadErr.message);
    }
    
    setInput('');
    setAttachments([]);
    setPendingMediaAttachment(null); // Clear pending attachment
    pendingMediaFlowRef.current = null; // Clear pending mediaFlow after sending
    setStreamingContent('');
    setStreamingImageUrl(null);
    setStreamingVideoTask(null);
    // CRITICAL: Also clear refs directly to prevent stale data leaking into next message
    streamingImageUrlRef.current = null;
    streamingVideoTaskRef.current = null;
    streamingSourcesRef.current = [];
    setSearchingWeb(false);
    setSearchQueries([]);

    // Build display content for user bubble
    const displayContent = content + (currentAttachments.length > 0
      ? '\n' + currentAttachments.map(a => `📎 ${a.name}`).join('\n') : '');

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: displayContent, created_at: new Date().toISOString(), attachments: currentAttachments };
    setMessages(prev => [...prev.filter(m => m.id !== 'greeting' || prev.length === 1), userMsg]);
    setUserMessageCount(prev => prev + 1);

    // Clear any previous comparison
    setCompareResponses(null);
    setSelectedCompareResponse(null);

    let newConvId = conversationId;
    let fullContent = '';

    // ── Compare Mode: Send to multiple models ──
    if (compareMode && compareModels.length > 0) {
      setCompareLoading(true);
      try {
        const res = await fetch('/api/chat/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            conversationId: newConvId,
            content,
            models: compareModels,
            attachments: currentAttachments,
            enableWebSearch: webSearchEnabled,
            projectId: selectedProject && selectedProject !== 'general' ? selectedProject : null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${errData.error || 'Comparison failed'}`, created_at: new Date().toISOString() }]);
          setCompareLoading(false);
          return;
        }

        const data = await res.json();
        setConversationId(data.conversationId);
        setCompareResponses({
          responses: data.responses,
          comparisonId: data.comparisonId,
          userMessageId: data.userMessageId,
          usedWebSearch: data.usedWebSearch,
        });

        // Refresh conversations list
        fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []));
      } catch (err) {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error during comparison. Please try again.', created_at: new Date().toISOString() }]);
      } finally {
        setCompareLoading(false);
        // Restore focus to input after compare mode completes
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      return;
    }

    // ── Single Model Mode: Stream response ──
    setLoading(true);
    isStreamingRef.current = true; // Set synchronous flag BEFORE any async work
    
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: newConvId, content, model: selectedModel,
          provider: currentModel.provider, attachments: currentAttachments, enableWebSearch: webSearchEnabled,
          projectId: selectedProject && selectedProject !== 'general' ? selectedProject : null,
          videoModel: selectedVideoModel !== 'smart' ? selectedVideoModel : null, // Pass user's video model preference
          imageModel: selectedImageModel !== 'smart' ? selectedImageModel : null, // Pass user's image model preference
          mediaFlow: pendingMediaFlowRef.current || null, // Media confirmation flow payload
          incognito: isIncognito, // Incognito mode — no messages saved to DB
          mediaGenMode: mediaGenMode, // Media creation mode — auto-generate when ON
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Something went wrong' }));
        
        // Handle auth errors gracefully — prompt re-login
        if (res.status === 401 || res.status === 403) {
          setMessages(prev => [...prev, { 
            id: `e-${Date.now()}`, role: 'assistant', 
            content: '⚠️ Your session has expired. Please refresh the page or log in again to continue.', 
            created_at: new Date().toISOString() 
          }]);
          localStorage.removeItem('token');
          setLoading(false);
          return;
        }
        
        // Handle server overload / DB issues
        if (res.status === 503) {
          setMessages(prev => [...prev, { 
            id: `e-${Date.now()}`, role: 'assistant', 
            content: '⏳ The server is temporarily busy. Please wait a moment and try again.', 
            created_at: new Date().toISOString() 
          }]);
          setLoading(false);
          return;
        }
        
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${errData.error || 'Something went wrong'}`, created_at: new Date().toISOString() }]);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error: Unable to read response stream. Please try again.', created_at: new Date().toISOString() }]);
        setLoading(false);
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      let actualModelUsed = selectedModel;
      let dynamicIntelligenceReason = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'meta') {
              newConvId = data.conversationId;
              setConversationId(data.conversationId);
              // In incognito mode, don't set the conversation ID that would trigger history loading
              if (isIncognito) {
                // Use a temporary ID that won't be fetched from DB
                newConvId = `incognito-${Date.now()}`;
              } else {
                newConvId = data.conversationId;
              }
              // Capture Dynamic Intelligence selection info
              if (data.smartMode) {
                actualModelUsed = data.selectedModel;
                dynamicIntelligenceReason = data.modelReason;
                setLastSmartSelection({ model: data.selectedModel, reason: data.modelReason });
              }
            } else if (data.type === 'search') {
              setSearchingWeb(true);
              setSearchQueries(data.queries || []);
            } else if (data.type === 'sources') {
              // Received sources from web search
              setStreamingSources(data.sources || []);
              streamingSourcesRef.current = data.sources || [];
            } else if (data.type === 'media_confirmation') {
              // Media confirmation flow — store the confirmation data
              const confirmData = {
                detectedType: data.detectedType,
                originalPrompt: data.originalPrompt,
                refinedPrompt: data.refinedPrompt,
                availableModels: data.availableModels || [],
                recommendedModel: data.recommendedModel || 'smart',
                messageId: data.messageId,
                sourceImageUrl: data.sourceImageUrl || null,
                hasAttachedImage: data.hasAttachedImage || false,
                referenceImageUrls: data.referenceImageUrls || null,
                // Video/image context from conversation
                conversationImageUrl: data.conversationImageUrl || null,
                conversationVideoUrl: data.conversationVideoUrl || null,
                conversationVideoTaskId: data.conversationVideoTaskId || null,
                sourceVideoUrl: data.sourceVideoUrl || null,
                sourceVideoTaskId: data.sourceVideoTaskId || null,
                // Extracted seed image for video extension
                seedImageUrl: data.seedImageUrl || null,
              };
              setMediaConfirmation(confirmData);
              mediaConfirmRef.current = confirmData;
              // For video_extend, skip directly to the extend confirmation UI
              if (data.detectedType === 'video_extend') {
                setMediaConfirmStep(10); // Special step for video extension
              } else {
                setMediaConfirmStep(0); // Start at intent confirmation
              }
              setMediaConfirmType(null);
            } else if (data.type === 'generating_visual') {
              // Backend is generating an image/video - show indicator immediately
              setIsGeneratingVisual(true);
              setVisualGenerationType(data.visualType || 'image');
            } else if (data.type === 'image') {
              // Image generated – store url for rendering
              setStreamingImageUrl(data.url);
              streamingImageUrlRef.current = data.url; // Direct ref update for same-batch done handler
              setStreamingRevPrompt(data.revised_prompt);
              // Reset visual generation state since image arrived
              setIsGeneratingVisual(false);
              setVisualGenerationType('');
            } else if (data.type === 'image_action') {
              // Tool-based image edit/mockup result – extract URL and show
              const actionResult = data.result;
              if (actionResult?.imageUrl || actionResult?.url) {
                const imgUrl = actionResult.imageUrl || actionResult.url;
                setStreamingImageUrl(imgUrl);
                streamingImageUrlRef.current = imgUrl;
                setStreamingRevPrompt(actionResult.revisedPrompt || actionResult.prompt || '');
                setIsGeneratingVisual(false);
                setVisualGenerationType('');
              }
            } else if (data.type === 'video_task') {
              // Video job started – store taskId for polling (include messageId & model info for DB persistence)
              const videoTaskData = { 
                taskId: data.taskId, status: 'generating', prompt: data.prompt, 
                messageId: data.messageId,
                videoModel: data.videoModel, videoModelLabel: data.videoModelLabel, 
                videoModelReason: data.videoModelReason,
                sourceImage: data.sourceImage || undefined,
              };
              setStreamingVideoTask(videoTaskData);
              // CRITICAL: Also update ref directly so it's available synchronously
              // when 'done' event fires in the same batch (useEffect runs AFTER render)
              streamingVideoTaskRef.current = videoTaskData;
              // Dismiss the generating_visual animation — the VideoCard takes over
              setIsGeneratingVisual(false);
              setVisualGenerationType('');
            } else if (data.type === 'delta') {
              setSearchingWeb(false);
              setLastChunkTime(Date.now()); // Track when we last received content
              setStreamingStalled(false); // Reset stall indicator
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
            } else if (data.type === 'continuation') {
              // Backend is auto-continuing a truncated response
              console.log(`[Chat] Auto-continuation ${data.count}/${data.max}`);
              setStreamingStalled(false);
              setLastChunkTime(Date.now());
            } else if (data.type === 'done') {
              setStreamingStalled(false);
              setLastChunkTime(null);
              // Use real messageId from backend if available (critical for video PATCH calls)
              const realMessageId = data.messageId || streamingVideoTaskRef.current?.messageId;
              const finalMsg = {
                id: realMessageId || `a-${Date.now()}`,
                role: 'assistant',
                content: fullContent,
                created_at: new Date().toISOString(),
                model_used: actualModelUsed || selectedModel,
                smart_mode: selectedModel === 'smart',
                smart_reason: dynamicIntelligenceReason,
                image_url: streamingImageUrlRef.current || undefined,
                video_task: streamingVideoTaskRef.current || undefined,
                model_label: streamingVideoTaskRef.current ? (streamingVideoTaskRef.current.videoModelLabel || 'AI Video') : undefined,
                video_model_reason: streamingVideoTaskRef.current?.videoModelReason || undefined,
                sources: streamingSourcesRef.current?.length > 0 ? streamingSourcesRef.current : undefined,
                media_confirmation: mediaConfirmRef.current || undefined,
              };
              setMessages(prev => [...prev, finalMsg]);
              setStreamingContent('');
              setStreamingImageUrl(null);
              // Clear streaming video task immediately — the message list now has the VideoCard
              // Using a synchronous ref clear + state clear to prevent any overlap window
              streamingVideoTaskRef.current = null;
              setStreamingVideoTask(null);
              setSearchQueries([]);
              setStreamingSources([]);
              streamingSourcesRef.current = [];
              fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []));
            } else if (data.type === 'error') {
              setStreamingStalled(false);
              setLastChunkTime(null);
              setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${data.error}`, created_at: new Date().toISOString() }]);
              setStreamingContent('');
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }

      // SAFETY NET: If stream ended without a 'done' event (connection drop, proxy timeout),
      // preserve any accumulated content as a message so it's not silently lost.
      if (fullContent && fullContent.trim()) {
        // Use a functional update to check if streaming content was cleared by 'done' handler
        setStreamingContent(prev => {
          if (prev && prev.length > 0) {
            // Streaming content still exists = 'done' event never arrived
            console.warn('[Chat] Stream ended without done event. Preserving partial response.');
            const partialMsg = {
              id: `partial-${Date.now()}`,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              model_used: actualModelUsed || selectedModel,
              partial: true,
            };
            setMessages(prevMsgs => [...prevMsgs, partialMsg]);
            fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []))
              .catch(() => {});
          }
          return ''; // Clear streaming content either way
        });
      }

    } catch (err) {
      // Handle aborted requests gracefully - don't show error
      if (err.name === 'AbortError') {
        // Request was cancelled by user, handled by stopRequest
        return;
      }
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error. Please try again.', created_at: new Date().toISOString() }]);
      setStreamingContent('');
    } finally {
      setLoading(false);
      setSearchingWeb(false);
      setIsGeneratingVisual(false);
      setVisualGenerationType('');
      isStreamingRef.current = false; // Clear streaming flag
      abortControllerRef.current = null;
      // Use setTimeout to ensure focus after all React state updates complete
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, compareLoading, token, selectedModel, conversationId, attachments, webSearchEnabled, compareMode, compareModels, isIncognito, mediaGenMode]);

  // Stop ongoing request
  const stopRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setSearchingWeb(false);
      // If there's streaming content, save it as a partial response
      if (streamingContent) {
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: streamingContent + '\n\n*(Response stopped)*',
          created_at: new Date().toISOString(),
          model_used: selectedModel,
        }]);
        setStreamingContent('');
      }
      abortControllerRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [streamingContent, selectedModel]);

  // ── Media Confirmation Flow Handlers ─────────────────────────────────
  // Submit a confirmed media generation flow directly to the chat stream API
  const isSubmittingMediaRef = useRef(false);
  const submitMediaConfirmation = useCallback(async (flow) => {
    if (!token || loading || isSubmittingMediaRef.current) return;
    isSubmittingMediaRef.current = true;
    
    setMediaConfirmStep(-1);
    setMediaConfirmation(null);
    setMediaConfirmType(null);
    mediaConfirmRef.current = null;
    
    if (flow.type === 'chat') {
      // Just chat — re-send the original prompt without media intent
      setInput(flow.originalPrompt || '');
      // Don't auto-send, let user press Enter manually for chat fallback
      return;
    }
    
    // Build user message for display
    const confirmLabel = flow.type === 'image' ? '🎨 Generate Image' : flow.type === 'video_extend' ? '🎬 Extend Video' : '🎬 Generate Video';
    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: `${confirmLabel}: ${flow.finalPrompt}`,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setInput('');
    
    try {
      const ctrl = new AbortController();
      abortControllerRef.current = ctrl;
      isStreamingRef.current = true;
      
      const mediaFlowPayload = { 
        step: 'confirmed', 
        type: flow.type, 
        finalPrompt: flow.finalPrompt, 
        selectedModel: flow.selectedModel, 
        sourceImageUrl: flow.sourceImageUrl || null, 
        referenceImageUrls: flow.referenceImageUrls || null,
        sourceVideoUrl: flow.sourceVideoUrl || null,
        sourceVideoTaskId: flow.sourceVideoTaskId || null,
        seedImageUrl: flow.seedImageUrl || null,
      };
      
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: flow.finalPrompt,
          conversationId: conversationId || undefined,
          model: selectedModel,
          webSearch: false,
          videoModel: selectedVideoModel !== 'smart' ? selectedVideoModel : null,
          imageModel: selectedImageModel !== 'smart' ? selectedImageModel : null,
          mediaFlow: mediaFlowPayload,
        }),
        signal: ctrl.signal,
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Your session has expired. Please refresh the page or log in again.');
        }
        throw new Error(`Generation failed (HTTP ${response.status}). Please try again.`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let realMessageId = null;
      let hasVideoTask = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'meta') {
              if (data.conversationId && !conversationId) setConversationId(data.conversationId);
              if (data.messageId) realMessageId = data.messageId;
            } else if (data.type === 'delta') {
              fullContent += data.content;
              setStreamingContent(fullContent);
            } else if (data.type === 'image_result' || data.type === 'image') {
              streamingImageUrlRef.current = data.url;
              fullContent += data.content || '';
              setStreamingContent(fullContent);
            } else if (data.type === 'video_task') {
              // Video job started — build proper video task data with status for VideoCard
              const videoTaskData = {
                taskId: data.taskId,
                status: 'generating',
                prompt: data.prompt || flow.finalPrompt,
                messageId: data.messageId || realMessageId,
                videoModel: data.videoModel,
                videoModelLabel: data.videoModelLabel,
                videoModelReason: data.videoModelReason,
                sourceImage: data.sourceImage || undefined,
              };
              setStreamingVideoTask(videoTaskData);
              streamingVideoTaskRef.current = videoTaskData;
              hasVideoTask = true;
              // Dismiss the generating_visual animation — VideoCard takes over
              setIsGeneratingVisual(false);
              setVisualGenerationType('');
            } else if (data.type === 'generating_visual') {
              setIsGeneratingVisual(true);
              setVisualGenerationType(data.visualType || 'image');
            } else if (data.type === 'done') {
              const finalMsg = {
                id: realMessageId || `a-${Date.now()}`,
                role: 'assistant',
                content: fullContent,
                created_at: new Date().toISOString(),
                model_used: data.model_used || selectedModel,
                image_url: streamingImageUrlRef.current || undefined,
                video_task: streamingVideoTaskRef.current || undefined,
                model_label: streamingVideoTaskRef.current?.videoModelLabel || undefined,
                video_model_reason: streamingVideoTaskRef.current?.videoModelReason || undefined,
              };
              setMessages(prev => [...prev, finalMsg]);
              setStreamingContent('');
              streamingImageUrlRef.current = null;
              // Clear streaming video task immediately — the message list now owns the VideoCard
              streamingVideoTaskRef.current = null;
              setStreamingVideoTask(null);
            }
          } catch (e) { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error during media generation. Please try again.', created_at: new Date().toISOString() }]);
      }
    } finally {
      setStreamingContent('');
      setLoading(false);
      // Don't clear visual generation states if video task is active (VideoCard handles animation)
      if (!streamingVideoTaskRef.current) {
        setIsGeneratingVisual(false);
        setVisualGenerationType('');
      }
      isStreamingRef.current = false;
      abortControllerRef.current = null;
      isSubmittingMediaRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [token, loading, conversationId, selectedModel, selectedVideoModel, selectedImageModel]);
  
  // Step 1: User selects intent type (Image / Video / Just Chat)
  const handleMediaConfirmType = useCallback((type) => {
    const confirm = mediaConfirmRef.current;
    if (!confirm) return;
    
    if (type === 'chat') {
      // User chose "Just Chat" — clear UI and put prompt back in input
      submitMediaConfirmation({ type: 'chat', originalPrompt: confirm.originalPrompt });
      return;
    }
    
    // User chose image or video — advance to step 1 (prompt review)
    setMediaConfirmType(type);
    setMediaConfirmStep(1);
  }, [submitMediaConfirmation]);
  
  // Step 2: User approves prompt (possibly edited)
  const handleMediaConfirmPrompt = useCallback((finalPrompt) => {
    const confirm = mediaConfirmRef.current;
    if (!confirm) return;
    mediaConfirmRef.current = { ...confirm, finalPrompt };
    setMediaConfirmStep(2);
  }, []);
  
  // Step 3: User selects a model — triggers generation
  const handleMediaConfirmModel = useCallback((selectedModelKey) => {
    const confirm = mediaConfirmRef.current;
    if (!confirm || !mediaConfirmType) return;
    
    submitMediaConfirmation({
      type: mediaConfirmType,
      originalPrompt: confirm.originalPrompt,
      finalPrompt: confirm.finalPrompt || confirm.refinedPrompt,
      selectedModel: selectedModelKey,
      sourceImageUrl: confirm.sourceImageUrl || null,
      referenceImageUrls: confirm.referenceImageUrls || null,
    });
  }, [mediaConfirmType, submitMediaConfirmation]);
  
  // Video Extension: User confirmed extension from the VideoExtendConfirmCard
  const handleVideoExtendConfirm = useCallback((finalPrompt) => {
    const confirm = mediaConfirmRef.current;
    if (!confirm) return;
    
    submitMediaConfirmation({
      type: 'video_extend',
      originalPrompt: confirm.originalPrompt,
      finalPrompt: finalPrompt,
      sourceVideoUrl: confirm.sourceVideoUrl || confirm.conversationVideoUrl || null,
      sourceVideoTaskId: confirm.sourceVideoTaskId || confirm.conversationVideoTaskId || null,
      seedImageUrl: confirm.seedImageUrl || null,
    });
  }, [submitMediaConfirmation]);
  
  // Extend Video button from SavedVideoCard — directly submit extend request
  const handleExtendVideo = useCallback(({ videoUrl, videoTaskId, prompt }) => {
    submitMediaConfirmation({
      type: 'video_extend',
      originalPrompt: prompt || 'Extend this video: continue the scene naturally',
      finalPrompt: prompt || 'Continue the video naturally with smooth transitions',
      sourceVideoUrl: videoUrl || null,
      sourceVideoTaskId: videoTaskId || null,
    });
  }, [submitMediaConfirmation]);
  
  // Toggle quick generate on/off and persist to backend
  const toggleQuickGenerate = useCallback(async () => {
    const newValue = !quickGenerateEnabled;
    setQuickGenerateEnabled(newValue);
    if (token) {
      try {
        await fetch('/api/user/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ quick_generate: newValue }),
        });
      } catch (e) { /* best effort */ }
    }
  }, [quickGenerateEnabled, token]);

  // Generate JSON config from an uploaded image
  const generateImageJson = useCallback(async (attachment) => {
    if (!attachment || attachment.type !== 'image' || !token) return;
    
    setGeneratingImageJson(true);
    setShowImageJsonModal(true);
    setImageJsonResult(null);
    
    try {
      const response = await fetch('/api/analyze/image-to-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: {
            base64: attachment.base64,
            mimeType: attachment.mimeType,
          },
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }
      
      setImageJsonResult(data);
    } catch (err) {
      setImageJsonResult({ error: err.message });
    } finally {
      setGeneratingImageJson(false);
    }
  }, [token]);

  // Set an image as editable (from message or attachment)
  const setImageForEditing = useCallback((imageData) => {
    setEditableImage(imageData);
  }, []);

  // Handle image edit submission
  const handleImageEdit = useCallback(async ({ prompt, overlayImage: overlayImg, maskDataUrl, hasMask }) => {
    if (!editableImage || !prompt || !token) return;
    
    setIsEditingImage(true);
    
    try {
      const requestBody = {
        image: {
          url: editableImage.url,
          base64: editableImage.base64,
          mimeType: editableImage.mimeType || 'image/png',
        },
        mask: hasMask ? maskDataUrl : null,
        prompt,
        conversationId,
      };
      
      // If overlay image is provided, add it to the request
      if (overlayImg) {
        requestBody.overlayImage = {
          base64: overlayImg.base64,
          mimeType: overlayImg.mimeType || 'image/png',
        };
      }
      
      const response = await fetch('/api/image/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to edit image');
      }
      
      // Add the edited image as a new message
      const editMsg = {
        id: `edit-${Date.now()}`,
        role: 'assistant',
        content: `✏️ Image edited!\n\n**Edit:** ${prompt}`,
        created_at: new Date().toISOString(),
        image_url: data.url,
        is_edit: true,
        original_image: editableImage.url || `data:image/png;base64,${editableImage.base64}`,
      };
      
      setMessages(prev => [...prev, editMsg]);
      
      // Set the new image as the editable one for chaining edits
      setEditableImage({
        url: data.url,
        source: 'edited',
        messageId: editMsg.id,
      });
      
      setShowImageEditor(false);
      setEditPrompt('');
    } catch (err) {
      alert('Edit failed: ' + err.message);
    } finally {
      setIsEditingImage(false);
    }
  }, [editableImage, token, conversationId]);

  // Handle mockup generation
  const handleGenerateMockup = useCallback(async ({ template, productName, isCustom, position, size }) => {
    if (!mockupDesign || !productName || !token) return;
    
    setIsGeneratingMockup(true);
    
    try {
      const response = await fetch('/api/mockup/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          design: {
            base64: mockupDesign.base64,
            mimeType: mockupDesign.mimeType,
          },
          product: productName,
          isCustom,
          position,
          size,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate mockup');
      }
      
      // Add the mockup as a message
      const mockupMsg = {
        id: `mockup-${Date.now()}`,
        role: 'assistant',
        content: `🎨 **Mockup Generated!**\n\n**Product:** ${productName}`,
        created_at: new Date().toISOString(),
        image_url: data.url,
        is_mockup: true,
      };
      
      setMessages(prev => [...prev, mockupMsg]);
      setShowMockupGenerator(false);
    } catch (err) {
      alert('Mockup generation failed: ' + err.message);
    } finally {
      setIsGeneratingMockup(false);
    }
  }, [mockupDesign, token]);

  // Handle selecting a response from comparison
  const handleSelectCompareResponse = useCallback(async (response) => {
    if (!compareResponses || selectedCompareResponse) return;
    
    setSelectedCompareResponse(response.model);
    
    try {
      const res = await fetch('/api/chat/compare/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          comparisonId: compareResponses.comparisonId,
          selectedModel: response.model,
          selectedContent: response.content,
        }),
      });

      if (!res.ok) {
        console.error('Failed to save comparison selection');
        return;
      }

      const data = await res.json();
      
      // Add the selected response as a message and switch to that model
      const finalMsg = {
        id: data.messageId || `a-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        created_at: new Date().toISOString(),
        model_used: response.model,
        from_comparison: true,
      };
      setMessages(prev => [...prev, finalMsg]);
      
      // Switch to the selected model for future messages
      setSelectedModel(response.model);
      
      // Exit compare mode and revert to single model mode
      setCompareMode(false);
      
      // Clear comparison state after a short delay (to show the selection)
      setTimeout(() => {
        setCompareResponses(null);
        setSelectedCompareResponse(null);
      }, 1500);
      
      // Refresh conversations
      fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []));
        
    } catch (err) {
      console.error('Error saving comparison selection:', err);
    }
  }, [compareResponses, selectedCompareResponse, token]);

  // ── Media Generation Handler ──────────────────────────────────────────────
  const handleMediaGenerate = useCallback(async ({ type, model, prompt, aspectRatio }) => {
    setIsGeneratingMedia(true);
    
    // Add a placeholder message showing what's being generated
    const placeholderMsg = {
      id: `gen-${Date.now()}`,
      role: 'assistant',
      content: `🎨 Generating ${type}...\n\n**Prompt:** ${prompt}\n**Model:** ${model}${type === 'image' ? `\n**Aspect:** ${aspectRatio}` : ''}`,
      created_at: new Date().toISOString(),
      is_generating: true,
    };
    setMessages(prev => [...prev, placeholderMsg]);

    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, model, prompt, aspectRatio, conversationId }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? { ...m, content: `❌ Generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
            : m
        ));
        setIsGeneratingMedia(false);
        return;
      }

      // For async tasks (video), we need to poll
      if (data.taskId && !data.url) {
        // Start polling for video completion
        pollMediaTask(data.taskId, placeholderMsg.id, type, prompt, model);
      } else if (data.url) {
        // Immediate result (image)
        const modelInfo = IMAGE_MODELS.find(m => m.value === model) || { label: model };
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? {
                ...m,
                content: `✨ ${type === 'image' ? 'Image' : 'Video'} generated!\n\n**Prompt:** ${prompt}`,
                is_generating: false,
                image_url: type === 'image' ? data.url : undefined,
                video_url: type === 'video' ? data.url : undefined,
                model_used: model,
                model_label: modelInfo.label || model,
                generation_params: {
                  type,
                  model,
                  modelLabel: modelInfo.label || model,
                  prompt,
                  aspectRatio,
                  generatedAt: new Date().toISOString(),
                },
              }
            : m
        ));
        // Refresh gallery
        loadGallery();
      }
    } catch (err) {
      setMessages(prev => prev.map(m => 
        m.id === placeholderMsg.id 
          ? { ...m, content: `❌ Connection error: ${err.message}`, is_generating: false }
          : m
      ));
    } finally {
      setIsGeneratingMedia(false);
    }
  }, [token, conversationId]);

  // Poll for async media tasks (videos)
  const pollMediaTask = useCallback(async (taskId, messageId, type, prompt, model) => {
    const maxPolls = 60; // 5 minutes max
    let polls = 0;
    
    const poll = async () => {
      if (polls >= maxPolls) {
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { ...m, content: `⏱️ Generation timed out. Please try again.`, is_generating: false }
            : m
        ));
        return;
      }
      
      try {
        const res = await fetch(`/api/media/status?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        
        if (data.status === 'completed' && data.url) {
          setMessages(prev => prev.map(m => 
            m.id === messageId 
              ? {
                  ...m,
                  content: `✨ Video generated!\n\n**Prompt:** ${prompt}`,
                  is_generating: false,
                  video_url: data.url,
                  thumbnail_url: data.thumbnail_url,
                  model_used: model,
                }
              : m
          ));
          loadGallery();
          return;
        } else if (data.status === 'failed') {
          setMessages(prev => prev.map(m => 
            m.id === messageId 
              ? { ...m, content: `❌ Generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
              : m
          ));
          return;
        }
        
        // Still processing, update status and continue polling
        setMessages(prev => prev.map(m => 
          m.id === messageId && m.is_generating
            ? { ...m, content: `🎬 Generating video... (${data.progress || 'processing'})\n\n**Prompt:** ${prompt}` }
            : m
        ));
        
        polls++;
        setTimeout(poll, 5000); // Poll every 5 seconds
      } catch (err) {
        polls++;
        setTimeout(poll, 5000);
      }
    };
    
    poll();
  }, [token]);

  // ── Gallery Loader ────────────────────────────────────────────────────────
  const loadGallery = useCallback(async () => {
    if (!token) return;
    setGalleryLoading(true);
    try {
      const res = await fetch('/api/media/gallery', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGalleryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading gallery:', err);
    } finally {
      setGalleryLoading(false);
    }
  }, [token]);

  // Load gallery when showing it
  useEffect(() => {
    if (showGallery && token) {
      loadGallery();
    }
  }, [showGallery, token, loadGallery]);

  // Listen for cloud import modal open event
  useEffect(() => {
    const handleOpenCloudImport = () => setShowCloudImport(true);
    window.addEventListener('openCloudImport', handleOpenCloudImport);
    return () => window.removeEventListener('openCloudImport', handleOpenCloudImport);
  }, []);

  // Auto-save user's timezone on page load (doesn't require location permission)
  useEffect(() => {
    if (!token) return;
    
    const saveTimezone = async () => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await fetch('/api/user/timezone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ timezone }),
        });
      } catch (err) {
        console.error('Failed to save timezone:', err);
      }
    };
    
    saveTimezone();
  }, [token]);

  async function loadConversation(convId) {
    // GUARD: Don't load a different conversation during active streaming
    if (isStreamingRef.current) {
      console.warn('[loadConversation] Blocked: streaming is active');
      return;
    }
    // Abort any active SSE stream so user can interact with new chat
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Reset all generating/loading states
    setLoading(false);
    setIsGeneratingVisual(false);
    setVisualGenerationType('');
    setStreamingImageUrl(null);
    setStreamingVideoTask(null);
    setStreamingContent('');
    setStreamingSources([]);
    
    setConversationId(convId);
    setMessages([]);
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`, { headers: { Authorization: `Bearer ${token}` } });
      const msgs = await res.json();
      // Process messages to display active variant content
      const processedMsgs = (Array.isArray(msgs) ? msgs : []).map(m => {
        if (m.variants && m.variants.length > 1 && m.activeVariant !== undefined) {
          const activeContent = m.variants[m.activeVariant]?.content;
          if (activeContent) return { ...m, content: activeContent };
        }
        return m;
      });
      setMessages(processedMsgs);
    } catch (e) {}
    setShowSidebar(false);
  }

  function newConversation() {
    // GUARD: Don't reset during active streaming
    if (isStreamingRef.current) {
      console.warn('[newConversation] Blocked: streaming is active');
      return;
    }
    // Abort any active SSE stream so user can interact with new chat
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Reset all generating/loading states
    setLoading(false);
    setIsGeneratingVisual(false);
    setVisualGenerationType('');
    setStreamingImageUrl(null);
    setStreamingVideoTask(null);
    setStreamingContent('');
    setStreamingSources([]);
    
    // Exit incognito mode when starting a new conversation
    setIsIncognito(false);
    
    setConversationId(null);
    const greet = user?.profile?.display_name || 'there';
    const botName = user?.profile?.assistant_name || 'SoulPrint';
    const customGreeting = user?.profile?.custom_greeting;
    const greetingEnabled = user?.profile?.ai_greeting_enabled !== false;
    
    if (greetingEnabled) {
      // Use custom greeting if set, otherwise use default for new conversation
      const greetingContent = customGreeting 
        ? customGreeting.replace('{name}', greet).replace('{assistant}', botName)
        : `Hey ${greet} 👋 Starting fresh! What's on your mind?`;
      
      setMessages([{ id: 'greeting', role: 'assistant', content: greetingContent, created_at: new Date().toISOString() }]);
    } else {
      setMessages([]);
    }
    setAttachments([]);
    setShowSidebar(false);
  }

  // Check for Google just connected flag and show welcome message
  const [showGoogleWelcome, setShowGoogleWelcome] = useState(false);
  
  useEffect(() => {
    const googleJustConnected = localStorage.getItem('google_just_connected');
    if (googleJustConnected === 'true' && token) {
      // Remove the localStorage flag
      localStorage.removeItem('google_just_connected');
      // Show the welcome banner
      setShowGoogleWelcome(true);
    }
  }, [token]);
  
  // Function to dismiss Google welcome
  const dismissGoogleWelcome = () => {
    setShowGoogleWelcome(false);
  };

  // Rename a conversation
  async function renameConversation(convId, newTitle) {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: newTitle.trim() } : c));
      }
    } catch (e) {
      console.error('Error renaming conversation:', e);
    }
    setEditingConvId(null);
    setEditingTitle('');
  }

  // Regenerate media with a different model
  // Regenerate media with a different model
  // mediaContext can include: { type: 'image'|'video', sourceImageUrl, videoUrl, imageUrl }
  const handleRegenerateWithModel = (originalPrompt, modelId, mediaContext = {}) => {
    if (!modelId) return;
    
    const actualPrompt = originalPrompt || 'Regenerate this';
    
    // Construct a prompt that requests the specific model
    let newPrompt = actualPrompt;
    
    // For videos, prepend with model instruction
    if (['kling-3.0', 'veo3', 'runway-aleph'].includes(modelId)) {
      const modelNames = {
        'kling-3.0': 'Kling 3.0',
        'veo3': 'Veo 3.1',
        'runway-aleph': 'Runway Aleph'
      };
      newPrompt = `Use ${modelNames[modelId]} to generate: ${actualPrompt}`;
    } else {
      // For images
      const modelNames = {
        'nano-banana': 'Nano Banana',
        'gemini-2.0-flash-exp-image-generation': 'Gemini',
        'gpt-image-1': 'GPT Image'
      };
      newPrompt = `Use ${modelNames[modelId] || modelId} to generate: ${actualPrompt}`;
    }
    
    // If there's a source image, we need to attach it for image-to-video regeneration
    if (mediaContext.sourceImageUrl || mediaContext.imageUrl) {
      const imageUrl = mediaContext.sourceImageUrl || mediaContext.imageUrl;
      // Store the image URL to be attached when sending
      setPendingMediaAttachment({
        type: 'image',
        url: imageUrl,
        forRegeneration: true,
      });
    }
    
    // Set the input
    setInput(newPrompt);
  };

  // Delete a conversation
  async function deleteConversation(convId) {
    // Find the conversation to check if it's in a project
    const conv = conversations.find(c => c.id === convId);
    const isInProject = conv?.project_id && conv.project_id !== 'general';
    const isViewingProject = selectedProject && selectedProject !== 'general';
    
    // Different confirmation messages based on context
    let confirmMsg = 'Are you sure you want to delete this conversation? This cannot be undone.';
    if (!isViewingProject && isInProject) {
      confirmMsg = 'This will remove the chat from "All Chats" but it will still be available in its Project. Continue?';
    }
    
    if (!confirm(confirmMsg)) return;
    
    try {
      // Pass from_project=true when deleting from within a project view
      const url = isViewingProject 
        ? `/api/conversations/${convId}?from_project=true`
        : `/api/conversations/${convId}`;
        
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (projectConversations) {
          setProjectConversations(prev => prev ? prev.filter(c => c.id !== convId) : null);
        }
        if (convId === conversationId) {
          newConversation();
        }
      }
    } catch (e) {
      console.error('Error deleting conversation:', e);
    }
    setConvMenuId(null);
  }

  // Start editing a conversation title
  function startEditing(conv) {
    setEditingConvId(conv.id);
    setEditingTitle(conv.title || 'Conversation');
    setConvMenuId(null);
  }

  // ─────────────────────────────────────────────────────────────────
  // PROJECT MANAGEMENT FUNCTIONS
  // ─────────────────────────────────────────────────────────────────
  
  // Create a new project
  async function createProject() {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: newProjectName.trim(), 
          description: newProjectDescription.trim(),
          instructions: newProjectInstructions.trim()
        }),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects(prev => [{ ...project, is_owner: true, conversation_count: 0 }, ...prev]);
        setShowProjectModal(false);
        setNewProjectName('');
        setNewProjectDescription('');
        setNewProjectInstructions('');
      }
    } catch (err) {
      console.error('Create project error:', err);
    }
  }
  
  // Update project
  async function updateProject() {
    if (!editingProject || !newProjectName.trim()) return;
    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: newProjectName.trim(), 
          description: newProjectDescription.trim(),
          instructions: newProjectInstructions.trim()
        }),
      });
      if (res.ok) {
        setProjects(prev => prev.map(p => 
          p.id === editingProject.id 
            ? { ...p, name: newProjectName.trim(), description: newProjectDescription.trim(), instructions: newProjectInstructions.trim() } 
            : p
        ));
        setShowProjectModal(false);
        setEditingProject(null);
        setNewProjectName('');
        setNewProjectDescription('');
        setNewProjectInstructions('');
      }
    } catch (err) {
      console.error('Update project error:', err);
    }
  }
  
  // Delete project
  async function deleteProject(projectId) {
    if (!confirm('Delete this project? Conversations will be moved to uncategorized.')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (selectedProject === projectId) {
          setSelectedProject(null);
          setProjectConversations(null);
        }
        // Reload conversations
        const convRes = await fetch('/api/user/conversations', { headers: { Authorization: `Bearer ${token}` } });
        const convData = await convRes.json();
        setConversations(Array.isArray(convData) ? convData : []);
      }
    } catch (err) {
      console.error('Delete project error:', err);
    }
  }
  
  // Open project edit modal
  function openEditProject(project) {
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectDescription(project.description || '');
    setNewProjectInstructions(project.instructions || '');
    setProjectModalMode('edit');
    setShowProjectModal(true);
  }
  
  // Open project share modal
  async function openShareProject(project) {
    setEditingProject(project);
    setProjectModalMode('share');
    setShareEmail('');
    setShareRole('collaborator');
    // Fetch/create share link
    try {
      const res = await fetch(`/api/projects/${project.id}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: true, role: 'viewer' }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjectShareLink(data.share_link);
      }
    } catch (err) {
      console.error('Error fetching share link:', err);
    }
    setShowProjectModal(true);
  }
  
  // Share project with user by email
  async function shareProjectWithUser() {
    if (!editingProject || !shareEmail.trim()) return;
    try {
      const res = await fetch(`/api/projects/${editingProject.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: shareEmail.trim(), role: shareRole }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Project shared successfully!');
        setShareEmail('');
        // Refresh projects
        const projRes = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
        const projData = await projRes.json();
        const allProjects = [
          ...(projData.owned || []),
          ...(projData.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
        const updatedProject = allProjects.find(p => p.id === editingProject.id);
        if (updatedProject) setEditingProject(updatedProject);
      } else {
        alert(data.error || 'Failed to share project');
      }
    } catch (err) {
      console.error('Share project error:', err);
      alert('Failed to share project');
    }
  }
  
  // Copy share link
  function copyShareLink() {
    if (!projectShareLink?.code) return;
    // Use /shared/ for public links, /join/ for registered-only links
    const prefix = projectShareLink?.public_view ? '/shared/' : '/join/';
    const link = `${window.location.origin}${prefix}${projectShareLink.code}`;
    navigator.clipboard.writeText(link);
    alert('Share link copied!');
  }
  
  // Move conversation to project
  async function moveConversationToProject(convId, projectId) {
    console.log('[UI] Moving conversation', convId, 'to project', projectId);
    try {
      const res = await fetch(`/api/conversations/${convId}/project`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId }),
      });
      console.log('[UI] Move response status:', res.status);
      if (res.ok) {
        // Update the local conversation's project_id immediately
        setConversations(prev => prev.map(c => 
          c.id === convId ? { ...c, project_id: projectId } : c
        ));
        // Invalidate project-specific conversations to force refresh
        setProjectConversations(null);
        // Also refresh conversations from server to ensure sync
        const convRes = await fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } });
        if (convRes.ok) {
          const convData = await convRes.json();
          setConversations(Array.isArray(convData) ? convData : []);
        }
        // Refresh projects
        const projRes = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
        const projData = await projRes.json();
        const allProjects = [
          ...(projData.owned || []),
          ...(projData.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('[UI] Move failed:', errData);
        alert('Failed to move conversation: ' + (errData.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Move conversation error:', err);
      alert('Failed to move conversation');
    }
    setShowMoveToProject(false);
    setMovingConversation(null);
    setConvMenuId(null);
  }
  
  // Open move to project dialog
  function openMoveToProject(conv) {
    setMovingConversation(conv);
    setShowMoveToProject(true);
    setConvMenuId(null);
  }

  // State for message feedback and editing
  const [messageFeedback, setMessageFeedback] = useState({}); // { messageId: 'up' | 'down' }
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [readingAloudId, setReadingAloudId] = useState(null); // messageId currently being read aloud
  const readAloudAudioRef = useRef(null);

  async function submitFeedback(messageId, rating) {
    // Update local state immediately for visual feedback
    setMessageFeedback(prev => ({ ...prev, [messageId]: rating }));
    
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          conversation_id: conversationId, 
          message_id: messageId, 
          rating,
          context: {
            model: messages.find(m => m.id === messageId)?.model_used,
            timestamp: new Date().toISOString(),
          }
        }),
      });
    } catch (e) {
      console.error('Feedback submission failed:', e);
    }
  }

  // Copy message to clipboard
  async function copyMessage(content, messageId) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }

  // Read message aloud using TTS
  async function readAloud(content, messageId) {
    if (!content) return; // No content to read
    // If already reading this message, stop it
    if (readingAloudId === messageId) {
      if (readAloudAudioRef.current) {
        readAloudAudioRef.current.pause();
        readAloudAudioRef.current = null;
      }
      setReadingAloudId(null);
      return;
    }
    
    // Stop any currently playing audio
    if (readAloudAudioRef.current) {
      readAloudAudioRef.current.pause();
      readAloudAudioRef.current = null;
    }

    setReadingAloudId(messageId);
    try {
      const res = await fetch('/api/voice/tts/read-aloud', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ text: content }),
      });
      
      if (!res.ok) {
        throw new Error('TTS request failed');
      }
      
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      readAloudAudioRef.current = audio;
      
      audio.onended = () => {
        setReadingAloudId(null);
        readAloudAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setReadingAloudId(null);
        readAloudAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (e) {
      console.error('Read aloud failed:', e);
      setReadingAloudId(null);
    }
  }


  // Dismiss a support notification
  async function dismissSupportNotification(notificationId) {
    setSupportNotifications(prev => prev.filter(n => n.id !== notificationId));
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });
    } catch {}
  }


  // Start editing a user message
  function startEditMessage(msg) {
    setEditingMessageId(msg?.id);
    setEditingContent(String(msg?.content || ''));
  }

  // Cancel editing
  function cancelEdit() {
    setEditingMessageId(null);
    setEditingContent('');
  }

  // Submit edited message - stores variants and generates new response (Claude-style)
  async function submitEditedMessage() {
    if (!editingContent.trim() || !editingMessageId) return;
    
    const editedMsgIndex = messages.findIndex(m => m.id === editingMessageId);
    if (editedMsgIndex === -1) return;
    
    const originalUserMsg = messages[editedMsgIndex];
    const originalAssistantMsg = messages[editedMsgIndex + 1]?.role === 'assistant' ? messages[editedMsgIndex + 1] : null;
    const editedContent = editingContent.trim();
    
    // Initialize variants on user message if first edit
    const userVariants = originalUserMsg.variants || [{ content: originalUserMsg.content, created_at: originalUserMsg.created_at }];
    userVariants.push({ content: editedContent, created_at: new Date().toISOString() });
    
    // Initialize variants on assistant message if it exists
    let assistantVariants = [];
    if (originalAssistantMsg) {
      assistantVariants = originalAssistantMsg.variants || [{ content: originalAssistantMsg.content, created_at: originalAssistantMsg.created_at, model_used: originalAssistantMsg.model_used }];
    }
    
    // Update the user message in the messages array with new variant active
    setMessages(prev => prev.map(m => {
      if (m.id === editingMessageId) {
        return { ...m, content: editedContent, variants: userVariants, activeVariant: userVariants.length - 1, pairedMessageId: originalAssistantMsg?.id };
      }
      if (originalAssistantMsg && m.id === originalAssistantMsg.id) {
        return { ...m, variants: assistantVariants, activeVariant: assistantVariants.length - 1, pairedMessageId: editingMessageId, content: '⏳ Generating new response...' };
      }
      return m;
    }));
    
    setEditingMessageId(null);
    setEditingContent('');
    setLoading(true);
    
    // Save user message variants to DB
    try {
      await fetch(`/api/messages/${editingMessageId}/variants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variants: userVariants, activeVariant: userVariants.length - 1 }),
      });
    } catch (variantErr) {
      console.warn('Failed to save user variants:', variantErr);
    }
    
    // Send the edited message via the chat stream endpoint to get a new response
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: editedContent,
          conversationId: conversationId,
          model: selectedModel,
          enableWebSearch: webSearchEnabled,
        }),
      });
      
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let newAssistantId = null;
        let imageUrl = null;
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              
              if (parsed.type === 'delta' && parsed.content) {
                fullContent += parsed.content;
                // Update the assistant message content while streaming
                if (originalAssistantMsg) {
                  setMessages(prev => prev.map(m => 
                    m.id === originalAssistantMsg.id ? { ...m, content: fullContent } : m
                  ));
                }
              } else if (parsed.type === 'meta' && parsed.messageId) {
                newAssistantId = parsed.messageId;
              } else if (parsed.type === 'image' && parsed.url) {
                imageUrl = parsed.url;
                fullContent += `\n\n![Generated Image](${parsed.url})`;
                if (originalAssistantMsg) {
                  setMessages(prev => prev.map(m => 
                    m.id === originalAssistantMsg.id ? { ...m, content: fullContent, image_url: parsed.url } : m
                  ));
                }
              } else if (parsed.type === 'done') {
                if (parsed.messageId) newAssistantId = parsed.messageId;
              }
            } catch {}
          }
        }
        
        if (fullContent) {
          const newVariant = { content: fullContent, created_at: new Date().toISOString(), model_used: selectedModel };
          
          if (originalAssistantMsg) {
            // Add new response as a variant to the existing assistant message
            const updatedVariants = [...assistantVariants, newVariant];
            setMessages(prev => prev.map(m => {
              if (m.id === originalAssistantMsg.id) {
                return { ...m, content: fullContent, variants: updatedVariants, activeVariant: updatedVariants.length - 1, pairedMessageId: editingMessageId, model_used: selectedModel, image_url: imageUrl || undefined };
              }
              return m;
            }));
            
            // Save assistant variants to DB
            try {
              await fetch(`/api/messages/${originalAssistantMsg.id}/variants`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ variants: updatedVariants, activeVariant: updatedVariants.length - 1 }),
              });
            } catch (variantErr) {
              console.warn('Failed to save assistant variants:', variantErr);
            }
          }
        } else {
          // No content generated - revert
          if (originalAssistantMsg) {
            setMessages(prev => prev.map(m => 
              m.id === originalAssistantMsg.id ? { ...m, content: assistantVariants[assistantVariants.length - 1]?.content || originalAssistantMsg.content } : m
            ));
          }
        }
      } else {
        console.error('Edit regeneration failed:', res.status);
        // Revert assistant message
        if (originalAssistantMsg) {
          setMessages(prev => prev.map(m => 
            m.id === originalAssistantMsg.id ? { ...m, content: assistantVariants[assistantVariants.length - 1]?.content || originalAssistantMsg.content } : m
          ));
        }
      }
    } catch (err) {
      console.error('Edit regeneration error:', err);
      if (originalAssistantMsg) {
        setMessages(prev => prev.map(m => 
          m.id === originalAssistantMsg.id ? { ...m, content: assistantVariants[assistantVariants.length - 1]?.content || originalAssistantMsg.content } : m
        ));
      }
    } finally {
      setLoading(false);
    }
  }

  // Toggle message variant (Claude-style ◀ 1/2 ▶)
  function toggleVariant(messageId, direction) {
    setMessages(prev => {
      const msgIndex = prev.findIndex(m => m.id === messageId);
      if (msgIndex === -1) return prev;
      const msg = prev[msgIndex];
      if (!msg.variants || msg.variants.length <= 1) return prev;
      
      const currentIndex = msg.activeVariant || 0;
      const newIndex = direction === 'next'
        ? Math.min(currentIndex + 1, msg.variants.length - 1)
        : Math.max(currentIndex - 1, 0);
      
      if (newIndex === currentIndex) return prev;
      
      const updated = prev.map(m => {
        if (m.id === messageId) {
          return { ...m, content: m.variants[newIndex].content, activeVariant: newIndex, model_used: m.variants[newIndex].model_used || m.model_used };
        }
        // Also toggle the paired message
        if (m.id === msg.pairedMessageId && m.variants?.length > newIndex) {
          return { ...m, content: m.variants[newIndex].content, activeVariant: newIndex, model_used: m.variants[newIndex].model_used || m.model_used };
        }
        return m;
      });
      
      return updated;
    });
  }

  const currentModel = MODELS.find(m => m.value === selectedModel) || MODELS[0];

  // Filter conversations based on search query and pin Telegram chats to top
  // CRITICAL: Use spread to avoid mutating state array during render
  let filteredConversations = [];
  try {
    const baseConversations = searchResults !== null ? (Array.isArray(searchResults) ? searchResults : []) : (Array.isArray(conversations) ? conversations : []);
    filteredConversations = [...baseConversations].sort((a, b) => {
      // Pin Telegram conversations to the top
      if (a?.source === 'telegram' && b?.source !== 'telegram') return -1;
      if (a?.source !== 'telegram' && b?.source === 'telegram') return 1;
      return 0;
    });
  } catch (e) {
    console.error('[ChatPage] filteredConversations computation failed:', e);
    filteredConversations = Array.isArray(conversations) ? conversations : [];
  }

  // Render mobile interface on mobile devices
  if (isMobile && token && user) {
    return (
      <>
        <MobileChat
          token={token}
          user={user}
          assistantName={assistantName}
          onOpenSettings={() => setShowSettings(true)}
          onOpenVoiceChat={voiceChatEnabled ? () => setShowVoiceChat(true) : null}
          initialConversationId={conversationId}
        />
        <AssessmentNudge token={token} messageCount={userMessageCount} />
        {showSettings && <SafeSection name="MobileSettingsModal"><SettingsModal onClose={() => { setShowSettings(false); setSettingsInitialTab(null); }} token={token} initialTab={settingsInitialTab} onModelChange={(type, value) => {
          if (type === 'text') { setSelectedModel(value); setDefaultModelSaved(value); }
          else if (type === 'video') { setSelectedVideoModel(value); setDefaultVideoModelSaved(value); }
          else if (type === 'image') { setSelectedImageModel(value); setDefaultImageModelSaved(value); }
        }} onAssistantNameChange={setAssistantName} onAnnouncementsChange={setAnnouncements} onVoiceSettingsChange={(vs) => {
          setUser(prev => prev ? { ...prev, profile: { ...prev.profile, voice_settings: vs } } : prev);
        }} /></SafeSection>}
        
        {/* Voice Conversation Modal */}
        {showVoiceChat && voiceChatEnabled && (
          <SafeSection name="VoiceChat">
          {(user?.profile?.voice_settings?.voice_engine === 'gemini') ? (
            <GeminiVoiceChat 
              token={token} 
              onClose={() => setShowVoiceChat(false)}
              onSaveTranscript={saveVoiceTranscript}
              systemPrompt={`You are ${assistantName || 'a helpful AI assistant'} having a voice conversation with ${user?.displayName || user?.email || 'the user'}. Be conversational, natural, and concise. Respond as if you're having a real phone call - be warm and engaging.`}
              userName={user?.displayName || user?.email?.split('@')[0]}
              defaultVoice={user?.profile?.voice_settings?.default_gemini_voice}
            />
          ) : (
            <RealtimeVoiceChat 
              token={token} 
              onClose={() => setShowVoiceChat(false)}
              onSaveTranscript={saveVoiceTranscript}
              systemPrompt={`You are ${assistantName || 'a helpful AI assistant'} having a voice conversation with ${user?.displayName || user?.email || 'the user'}. Be conversational, natural, and concise. Respond as if you're having a real phone call - be warm and engaging.`}
              userName={user?.displayName || user?.email?.split('@')[0]}
              defaultVoice={user?.profile?.voice_settings?.default_voice}
            />
          )}
          </SafeSection>
        )}
      </>
    );
  }

  return (
    <div className="flex h-screen bg-sp-black overflow-hidden safe-area-all">
      <AssessmentNudge token={token} messageCount={userMessageCount} />
      {showSidebar && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setShowSidebar(false)} />}

      {/* Sidebar */}
      <SafeSection name="Sidebar">
      <div className={`fixed lg:relative z-50 h-full bg-[#111820] border-r border-white/5 flex flex-col transform transition-all duration-300 ${
        sidebarCollapsed 
          ? 'w-16 lg:w-16' 
          : 'w-64'
      } ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`p-4 border-b border-white/5 pwa-header ${sidebarCollapsed ? 'px-2' : ''}`}>
          {/* Header with collapse toggle */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-3`}>
            <div className={`flex items-center ${sidebarCollapsed ? '' : 'gap-2'}`}>
              <SoulPrintLogo size={22} />
              {!sidebarCollapsed && <span className="font-condensed font-bold text-white text-sm tracking-widest uppercase">{assistantName}</span>}
            </div>
            {/* Collapse toggle button - desktop only */}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex items-center justify-center p-1.5 text-gray-600 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {sidebarCollapsed ? (
            <button onClick={newConversation} className="w-full btn-orange py-2.5 rounded-lg flex items-center justify-center" title="New Chat">
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={newConversation} className="w-full btn-orange py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> New Chat
            </button>
          )}
        </div>
        
        {/* Search conversations - hidden when collapsed */}
        {!sidebarCollapsed && conversations.length > 0 && (
          <div className="px-3 py-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                  if (!val.trim()) {
                    setSearchResults(null);
                    return;
                  }
                  searchTimeoutRef.current = setTimeout(() => {
                    fetch(`/api/user/conversations?search=${encodeURIComponent(val)}`, { headers: { Authorization: `Bearer ${token}` } })
                      .then(r => r.json())
                      .then(d => setSearchResults(Array.isArray(d) ? d : []))
                      .catch(() => {});
                  }, 300);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:border-orange-500/40 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
        
        <div className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'p-1' : 'p-2'}`}>
          {!sidebarCollapsed && (
            <>
              {/* Projects Section */}
              <div className="mb-3">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Projects</span>
                  <button
                    onClick={() => {
                      setProjectModalMode('create');
                      setNewProjectName('');
                      setNewProjectDescription('');
                      setEditingProject(null);
                      setShowProjectModal(true);
                    }}
                    className="p-1 text-gray-600 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors"
                    title="New Project"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {projects.length === 0 ? (
                  <p className="text-gray-700 text-[10px] text-center py-2">No projects yet</p>
                ) : (
                  <div className="space-y-0.5">
                    {projects.map(project => (
                      <div key={project.id} className="group relative">
                        <button
                          onClick={() => {
                            if (selectedProject === project.id) {
                              setSelectedProject(null);
                              setProjectConversations(null);
                            } else {
                              setSelectedProject(project.id);
                              // Fetch conversations specifically for this project
                              fetch(`/api/user/conversations?project_id=${project.id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                              })
                                .then(r => r.json())
                                .then(d => {
                                  if (Array.isArray(d)) {
                                    setProjectConversations(d);
                                  }
                                })
                                .catch(() => {});
                              // Auto-start a new conversation in this project
                              newConversation();
                            }
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all ${
                            selectedProject === project.id 
                              ? 'bg-purple-500/20 text-purple-300' 
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="flex-1 text-left truncate">{project.name}</span>
                          {project.is_shared && <Users className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                          <span className="text-[10px] text-gray-600">{project.conversation_count || 0}</span>
                        </button>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditProject(project); }}
                            className="p-1 text-gray-600 hover:text-white hover:bg-white/10 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openShareProject(project); }}
                            className="p-1 text-gray-600 hover:text-purple-400 hover:bg-purple-500/10 rounded"
                            title="Share"
                          >
                            <Share2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Divider */}
              <div className="border-t border-white/5 my-2" />
              
              {/* Conversations label */}
              <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {selectedProject ? (selectedProject === 'general' ? 'Uncategorized' : projects.find(p => p.id === selectedProject)?.name || 'Project') : 'All Chats'}
                </span>
                {selectedProject && (
                  <button
                    onClick={() => { setSelectedProject(null); setProjectConversations(null); }}
                    className="text-[10px] text-orange-400 hover:text-orange-300"
                  >
                    Show all
                  </button>
                )}
              </div>
            </>
          )}
          
          {conversations.length === 0 && !projectConversations ? (
            !sidebarCollapsed && <p className="text-gray-700 text-xs text-center mt-6">No conversations yet</p>
          ) : (() => {
            // When a project is selected and we have project-specific conversations, use those
            const displayConversations = selectedProject && projectConversations 
              ? projectConversations 
              : filteredConversations.filter(conv => {
                  if (!selectedProject) return true;
                  if (selectedProject === 'general') return !conv.project_id;
                  return conv.project_id === selectedProject;
                });
            
            if (displayConversations.length === 0) {
              return !sidebarCollapsed && <p className="text-gray-600 text-xs text-center mt-6">No conversations in this project</p>;
            }
            
            return displayConversations.map(conv => (
            <div key={conv.id} className="relative group mb-1">
              {sidebarCollapsed ? (
                // Collapsed view - icon only
                <button 
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-all ${conv.id === conversationId ? 'bg-white/10 text-orange-400' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
                  title={conv.title || 'Conversation'}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              ) : editingConvId === conv.id ? (
                // Editing mode - inline rename
                <div className="flex items-center gap-1 px-2 py-1.5 bg-white/5 rounded-lg">
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameConversation(conv.id, editingTitle);
                      if (e.key === 'Escape') { setEditingConvId(null); setEditingTitle(''); }
                    }}
                    className="flex-1 bg-transparent text-white text-xs outline-none border-none"
                    autoFocus
                  />
                  <button
                    onClick={() => renameConversation(conv.id, editingTitle)}
                    className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setEditingConvId(null); setEditingTitle(''); }}
                    className="p-1 text-gray-500 hover:bg-white/10 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                // Normal display mode
                <div className="flex items-center">
                  <button 
                    onClick={() => loadConversation(conv.id)}
                    className={`flex-1 text-left px-3 py-2.5 rounded-lg text-xs text-gray-400 hover:bg-white/5 hover:text-white transition-all truncate ${conv.id === conversationId ? 'bg-white/5 text-white' : ''}`}
                  >
                    <MessageSquare className="w-3 h-3 inline mr-2 opacity-50" />
                    {conv.title || 'Conversation'}
                    {conv.source === 'telegram' && <span className="ml-1 text-[#229ED9] text-[9px]">TG</span>}
                  </button>
                  {/* Menu trigger - shows on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setConvMenuId(convMenuId === conv.id ? null : conv.id); }}
                    className="p-1.5 text-gray-600 hover:text-white hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              
              {/* Dropdown menu */}
              {convMenuId === conv.id && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                  <button
                    onClick={() => startEditing(conv)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Rename
                  </button>
                  <button
                    onClick={() => openMoveToProject(conv)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-400 hover:bg-purple-500/10 transition-colors"
                  >
                    <Folder className="w-3 h-3" /> Move to Project
                  </button>
                  <button
                    onClick={() => deleteConversation(conv.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          ));
          })()}
        </div>
        
        {/* Latest News Widget - hidden when collapsed */}
        {!sidebarCollapsed && latestNews.length > 0 && (
          <div className="px-3 py-2 border-t border-white/5">
            <button 
              onClick={() => setShowNewsExpanded(!showNewsExpanded)}
              className="flex items-center justify-between w-full text-left mb-2"
            >
              <div className="flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Latest News</span>
              </div>
              <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${showNewsExpanded ? 'rotate-180' : ''}`} />
            </button>
            <div className={`space-y-1.5 overflow-hidden transition-all ${showNewsExpanded ? 'max-h-40' : 'max-h-16'}`}>
              {latestNews.slice(0, showNewsExpanded ? 3 : 1).map(post => (
                <a 
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-blue-500/30 rounded-lg transition-colors group"
                >
                  <p className="text-[11px] text-gray-300 group-hover:text-white line-clamp-2 leading-tight">{post.title}</p>
                  <p className="text-[9px] text-gray-600 mt-0.5">{new Date(post.published_at || post.created_at).toLocaleDateString()}</p>
                </a>
              ))}
            </div>
            {latestNews.length > 1 && (
              <a 
                href="/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mt-2 py-1"
              >
                View all posts <ChevronRight className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
        
        <div className={`p-3 border-t border-white/5 space-y-2 safe-area-bottom ${sidebarCollapsed ? 'px-2' : ''}`} style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)' }}>
          {/* Gallery button */}
          <button 
            onClick={() => setShowGallery(true)}
            className={`flex items-center justify-center ${sidebarCollapsed ? '' : 'gap-1.5'} w-full py-2 px-3 bg-gradient-to-r from-pink-500/10 to-blue-500/10 hover:from-pink-500/20 hover:to-blue-500/20 border border-pink-500/30 rounded-lg text-pink-400 hover:text-pink-300 text-xs transition-colors`}
            title="Media Gallery"
          >
            <GalleryHorizontal className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'Media Gallery'}
          </button>
          {/* Invite count */}
          {invitesRemaining !== null && (
            <div 
              className={`flex items-center justify-center ${sidebarCollapsed ? '' : 'gap-1.5'} w-full py-2 px-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs`}
              title={`You have ${invitesRemaining} invite${invitesRemaining !== 1 ? 's' : ''} remaining`}
            >
              <UserPlus className="w-3.5 h-3.5 flex-shrink-0" /> 
              {!sidebarCollapsed && (
                <span className="truncate">
                  <span className="font-semibold">{invitesRemaining}</span> Invite{invitesRemaining !== 1 ? 's' : ''} Left
                </span>
              )}
            </div>
          )}
          {/* Admin Dashboard link - only for admins */}
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <a 
              href="/admin"
              className={`flex items-center justify-center ${sidebarCollapsed ? '' : 'gap-1.5'} w-full py-2 px-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:text-orange-300 text-xs transition-colors`}
              title="Admin Dashboard"
            >
              <Shield className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'Admin Dashboard'}
            </a>
          )}
          <button 
            onClick={() => setShowFeedbackModal(true)}
            className={`flex items-center justify-center ${sidebarCollapsed ? '' : 'gap-1.5'} w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white text-xs transition-colors`}
            title="Send Feedback"
          >
            <MessageCircle className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'Send Feedback'}
          </button>
          {!sidebarCollapsed && <p className="text-gray-700 text-[10px] text-center truncate">{user?.email}</p>}
          
          {/* View Home Page link */}
          <a 
            href="/"
            className={`flex items-center justify-center ${sidebarCollapsed ? '' : 'gap-1.5'} w-full py-2 px-3 text-gray-600 hover:text-white hover:bg-white/5 rounded-lg text-xs transition-colors`}
            title="View Home Page"
          >
            <ExternalLink className="w-3.5 h-3.5" /> {!sidebarCollapsed && 'View Home Page'}
          </a>
        </div>
      </div>
      </SafeSection>

      {/* Main */}
      <SafeSection name="MainContent" fallback={(retry) => (
        <div className="flex-1 flex items-center justify-center bg-sp-black">
          <div className="text-center space-y-4">
            <p className="text-gray-400">Something went wrong in the chat area.</p>
            <button onClick={retry} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">Retry</button>
          </div>
        </div>
      )}>
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar - with safe area padding for PWA */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0 pwa-header bg-sp-black">
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button onClick={() => setShowSidebar(!showSidebar)} className="text-gray-500 hover:text-white transition-colors lg:hidden">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <SoulPrintLogo size={20} />
              <span className="text-white font-medium text-sm">{assistantName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 🎨 Create — Media Generation Toggle */}
            <button
              onClick={() => {
                const goingCreate = !mediaGenMode;
                setMediaGenMode(goingCreate);
                localStorage.setItem('sp_create_mode', goingCreate ? 'true' : 'false');
                // Inject a status message into the current conversation (no reset)
                const statusMsg = goingCreate
                  ? { id: `create-on-${Date.now()}`, role: 'assistant', content: '🎨 **Create Mode activated** — I\'ll automatically generate images and videos when I detect creative intent in your messages. Toggle off anytime to go back to confirmation mode.', created_at: new Date().toISOString(), isSystemNotice: true }
                  : { id: `create-off-${Date.now()}`, role: 'assistant', content: '🎨 **Create Mode deactivated** — I\'ll ask for your confirmation before generating any media.', created_at: new Date().toISOString(), isSystemNotice: true };
                setMessages(prev => [...prev, statusMsg]);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                mediaGenMode
                  ? 'bg-pink-500/20 border-pink-500/50 text-pink-400'
                  : 'bg-white/5 border-white/15 text-gray-500 hover:text-gray-300 hover:border-white/25'
              }`}
            >
              <Paintbrush className="w-3 h-3" />
              {mediaGenMode ? '🎨 Create' : 'Create'}
            </button>
            {/* Incognito Toggle */}
            <button
              onClick={() => {
                const goingIncognito = !isIncognito;
                setIsIncognito(goingIncognito);
                if (goingIncognito) {
                  setConversationId(null);
                  setMessages([{ id: 'incognito-greeting', role: 'assistant', content: '🕶️ **Incognito Mode** — This conversation is completely private. No messages, memories, or history will be saved. Everything disappears when you leave or start a new chat.', created_at: new Date().toISOString() }]);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                isIncognito
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-white/5 border-white/15 text-gray-500 hover:text-gray-300 hover:border-white/25'
              }`}
            >
              <EyeOff className="w-3 h-3" />
              {isIncognito ? '🔒 Incognito' : 'Incognito'}
            </button>
            {/* Feedback button */}
            <button
              onClick={() => setShowFeedbackModal(true)}
              title="Send Feedback"
              className="text-gray-500 hover:text-orange-400 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            {/* Admin Dashboard button - only for admins */}
            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <a
                href="/admin"
                title="Admin Dashboard"
                className="text-gray-500 hover:text-orange-400 transition-colors"
              >
                <Shield className="w-5 h-5" />
              </a>
            )}
            {/* What's New button with badge */}
            <button 
              onClick={() => setShowWhatsNew(true)} 
              className="text-gray-500 hover:text-orange-400 transition-colors relative"
              title="What's New"
            >
              <Sparkles className="w-5 h-5" />
              {appUpdatesUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {appUpdatesUnread > 9 ? '9+' : appUpdatesUnread}
                </span>
              )}
            </button>
            <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Project Breadcrumb Bar - shows when viewing a project */}
        {selectedProject && selectedProject !== 'general' && (
          <div className="flex items-center justify-between px-4 py-2 bg-purple-500/5 border-b border-purple-500/20 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <button 
                onClick={() => { setSelectedProject(null); setProjectConversations(null); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                All Chats
              </button>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <div className="flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 font-medium">
                  {projects.find(p => p.id === selectedProject)?.name || 'Project'}
                </span>
                {projects.find(p => p.id === selectedProject)?.instructions && (
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[9px] rounded">
                    Custom AI
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                // Start a new conversation in this project
                setConversationId(null);
                setMessages([]);
                setInput('');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>
        )}

        {/* Announcements Banner */}
        {announcements.length > 0 && (
          <div className="px-4 pt-4 space-y-2">
            {announcements.slice(0, 3).map(ann => (
              <div 
                key={ann.id} 
                className={`relative flex items-start gap-3 p-3 rounded-xl border backdrop-blur-sm ${
                  ann.type === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
                  ann.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                  ann.type === 'update' ? 'bg-blue-500/10 border-blue-500/30' :
                  'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  ann.type === 'warning' ? 'bg-orange-500/20' :
                  ann.type === 'success' ? 'bg-green-500/20' :
                  ann.type === 'update' ? 'bg-blue-500/20' :
                  'bg-blue-500/20'
                }`}>
                  <Megaphone className={`w-4 h-4 ${
                    ann.type === 'warning' ? 'text-orange-400' :
                    ann.type === 'success' ? 'text-green-400' :
                    ann.type === 'update' ? 'text-blue-400' :
                    'text-blue-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-sm font-medium">{ann.title}</h4>
                  <p className="text-gray-400 text-xs mt-0.5">{ann.content}</p>
                  {ann.link && (
                    <a 
                      href={ann.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      onClick={() => {
                        // Track click
                        fetch('/api/announcements/click', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ announcementId: ann.id }),
                        }).catch(() => {});
                      }}
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1.5 transition-colors"
                    >
                      Learn more <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {/* Dismiss buttons - always visible */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => dismissAnnouncement(ann.id, false)}
                    className="px-2.5 py-1 text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                    title="Hide for 24 hours, then show again"
                  >
                    Remind Later
                  </button>
                  <button
                    onClick={() => dismissAnnouncement(ann.id, true)}
                    className="px-2.5 py-1 text-[10px] text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                    title="Don't show this announcement again"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PWA Install Prompt Banner */}
        {showInstallPrompt && (
          <div className="px-4 pt-3">
            <div className="relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white text-sm font-medium">Install SoulPrint App</h4>
                <p className="text-gray-400 text-xs mt-1">
                  Get quick access from your home screen! This is <span className="text-green-400 font-medium">not a download</span> — it's just a shortcut. 
                  No storage used, no malware, completely safe.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button 
                    onClick={() => handleInstallAction('install')}
                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Install App
                  </button>
                  <button 
                    onClick={() => handleInstallAction('remind_later')}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    Remind Me Later
                  </button>
                  <button 
                    onClick={() => handleInstallAction('dismiss_forever')}
                    className="px-3 py-1.5 text-gray-500 hover:text-gray-300 text-xs transition-colors"
                  >
                    Don't show again
                  </button>
                </div>
              </div>
              <button 
                onClick={() => handleInstallAction('remind_later')}
                className="absolute top-2 right-2 text-gray-600 hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <SafeSection name="ChatMessages" fallback={(retry) => (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <p className="text-gray-400 text-sm">Something went wrong rendering messages.</p>
                <button onClick={retry} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors">
                  Retry
                </button>
              </div>
            </div>
          )}>
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {/* Google Welcome Banner */}
            {showGoogleWelcome && (
              <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-xl p-4 relative animate-fade-in">
                <button
                  onClick={dismissGoogleWelcome}
                  className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-sm mb-2">🎉 Google Account Connected!</h3>
                    <p className="text-gray-300 text-xs leading-relaxed mb-3">
                      I can now help you with Gmail, Calendar, and Drive. Try asking:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-black/20 rounded-lg p-2">
                        <span className="text-blue-400 font-medium">📧 Gmail</span>
                        <p className="text-gray-400 mt-1">"Show my unread emails"</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-2">
                        <span className="text-green-400 font-medium">📅 Calendar</span>
                        <p className="text-gray-400 mt-1">"What's on my calendar?"</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-2">
                        <span className="text-yellow-400 font-medium">📁 Drive</span>
                        <p className="text-gray-400 mt-1">"Find my recent docs"</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Persistent Video Progress Banner — shows active video jobs for this conversation */}
            {conversationId && token && (
              <VideoProgressBanner 
                conversationId={conversationId} 
                token={token}
                onVideoReady={(taskId, videoUrl, thumbnailUrl) => {
                  // Update the message that has this video_task
                  setMessages(prev => prev.map(m => {
                    if (m.video_task?.taskId === taskId) {
                      return { ...m, video_url: videoUrl, thumbnail_url: thumbnailUrl, video_task: { ...m.video_task, status: 'success' } };
                    }
                    return m;
                  }));
                }}
              />
            )}

            {/* Incognito Mode Banner */}
            {isIncognito && (
              <div className="flex items-center gap-2 px-4 py-2 mb-3 rounded-lg bg-gray-800/60 border border-gray-600/30 text-gray-400 text-xs">
                <EyeOff className="w-4 h-4 flex-shrink-0" />
                <span>Incognito Mode — No messages, memories, or history will be saved. Everything disappears when you leave.</span>
              </div>
            )}

            {(messages || []).map((msg, idx) => {
              if (!msg) return null;
              return (
              <MessageErrorBoundary key={`eb-${msg.id || idx}`}>
              <div key={msg.id || idx} id={`msg-${msg.id || idx}`} className={`msg-appear group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0 mt-0.5">
                    <SoulPrintLogo size={12} className="sm:hidden" />
                    <SoulPrintLogo size={14} className="hidden sm:block" />
                  </div>
                )}
                <div className={`min-w-0 ${msg.role === 'user' ? 'max-w-[90%] sm:max-w-[85%] lg:max-w-[80%]' : 'max-w-[95%] sm:max-w-[90%] lg:max-w-[85%]'}`}>
                  {/* User message edit controls */}
                  {msg.role === 'user' && !loading && (
                    <div className="flex justify-end mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEditMessage(msg)}
                        className="text-gray-600 hover:text-orange-400 transition-colors p-1 rounded"
                        title="Edit message"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {/* Show image preview in user message */}
                  {msg.role === 'user' && msg.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                      {msg.attachments.map((att, i) => (
                        att.type === 'image' ? (
                          <img key={i} src={`data:${att.mimeType};base64,${att.base64}`} alt={att.name}
                            className="h-16 sm:h-24 rounded-lg object-cover border border-white/10" />
                        ) : (
                          <div key={i} className="flex items-center gap-1.5 bg-white/8 border border-white/15 rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs text-white">
                            <FileText className="w-3 h-3 text-orange-400" /><span className="truncate max-w-[100px] sm:max-w-none">{att.name}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  <div className={`rounded-2xl px-3 py-2.5 sm:px-5 sm:py-3.5 text-[15px] sm:text-base leading-7 break-words ${msg.role === 'user' ? 'bg-orange-500/15 border border-orange-500/20 text-white' : 'bg-white/4 border border-white/8 text-gray-200'}`}>
                    {msg.role === 'assistant' ? (
                      <>
                        {/* Generating Animation - show when creating flyers/infographics/images */}
                        {msg.is_generating && (
                          <div className="mb-4">
                            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-white/10 p-4">
                              {/* Animated background shimmer */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                              
                              {/* Content */}
                              <div className="relative flex items-center gap-4">
                                {/* Animated icon */}
                                <div className="relative">
                                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                                    <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                                  </div>
                                  {/* Spinning ring */}
                                  <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
                                </div>
                                
                                {/* Text */}
                                <div className="flex-1">
                                  <p className="text-white font-medium text-sm mb-1">Creating your design...</p>
                                  <p className="text-gray-400 text-xs">This may take a moment. We're crafting something beautiful!</p>
                                </div>
                              </div>
                              
                              {/* Progress dots */}
                              <div className="flex justify-center gap-1.5 mt-4">
                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Image card */}
                        {msg.image_url && (
                          <ImageCard 
                            url={msg.image_url} 
                            revisedPrompt={msg.content?.match(/\*Prompt used: (.+)\*/)?.[1] || msg.generation_params?.prompt || ''} 
                            modelLabel={msg.model_label || msg.generation_params?.modelLabel} 
                            generationParams={msg.generation_params}
                            onEdit={(imageData) => {
                              setEditableImage({ ...imageData, messageId: msg.id });
                              setShowImageEditor(true);
                            }}
                            onRegenerateWith={handleRegenerateWithModel}
                          />
                        )}
                        {/* Video card - for polling state (only if no video_url yet) */}
                        {msg.video_task && !msg.video_url && (
                          <VideoCard
                            taskId={msg.video_task.taskId}
                            prompt={msg.video_task.prompt}
                            token={token}
                            initialStatus={msg.video_task.status === 'success' ? 'success' : 'generating'}
                            modelLabel={msg.model_label || 'Kling 3.0'}
                            messageId={msg.id}
                            videoModelReason={msg.video_model_reason || msg.video_task?.videoModelReason}
                            sourceImageUrl={msg.source_image || msg.video_task?.sourceImage}
                            onVideoReady={(videoUrl) => {
                              // Update the message in state so SavedVideoCard takes over
                              setMessages(prev => prev.map(m => 
                                m.id === msg.id ? { ...m, video_url: videoUrl } : m
                              ));
                            }}
                            onRegenerateWith={handleRegenerateWithModel}
                          />
                        )}
                        {/* Saved video - direct URL from database */}
                        {msg.video_url && (
                          <div className="relative group">
                            <SavedVideoCard 
                              videoUrl={msg.video_url} 
                              modelLabel={msg.model_label} 
                              prompt={msg.video_task?.prompt || msg.generation_params?.prompt || ''} 
                              token={token}
                              sourceImageUrl={msg.source_image || msg.video_task?.sourceImage}
                              onRegenerateWith={handleRegenerateWithModel}
                              onExtendVideo={handleExtendVideo}
                              videoTaskId={msg.video_task?.taskId}
                            />
                            <button
                              onClick={() => {
                                setEditableVideo({ url: msg.video_url });
                                setShowVideoEditor(true);
                              }}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 bg-black/70 hover:bg-black/90 text-white text-xs rounded-lg flex items-center gap-1 border border-white/20 backdrop-blur-sm"
                            >
                              ✂️ Edit Video
                            </button>
                          </div>
                        )}
                        {/* Regular text (skip for pure image/video messages and active video tasks) */}
                        {!msg.image_url && !msg.video_url && !(msg.video_task && !msg.video_url) && (
                          <SafeMarkdown content={typeof msg.content === 'string' ? msg.content : String(msg.content || '')} />
                        )}
                        
                        {/* Media Confirmation Flow — inline cards */}
                        {msg.media_confirmation && (
                          <div className="mt-3 space-y-3">
                            {/* Source Media Context Banner — shows user their referenced media */}
                            {(msg.media_confirmation.conversationVideoUrl || msg.media_confirmation.conversationImageUrl || msg.media_confirmation.sourceImageUrl) && msg.media_confirmation.detectedType !== 'video_extend' && (
                              <SourceMediaBanner 
                                imageUrl={msg.media_confirmation.sourceImageUrl || msg.media_confirmation.conversationImageUrl}
                                videoUrl={msg.media_confirmation.conversationVideoUrl}
                              />
                            )}
                            
                            {/* Video Extension Confirmation (Step 10) */}
                            {(mediaConfirmation && mediaConfirmStep === 10 && msg.id === messages[messages.length - 1]?.id) && (
                              <VideoExtendConfirmCard
                                refinedPrompt={msg.media_confirmation.refinedPrompt}
                                sourceVideoUrl={msg.media_confirmation.sourceVideoUrl || msg.media_confirmation.conversationVideoUrl}
                                seedImageUrl={msg.media_confirmation.seedImageUrl}
                                onConfirm={handleVideoExtendConfirm}
                                onCancel={() => {
                                  setMediaConfirmStep(-1);
                                  setMediaConfirmation(null);
                                  mediaConfirmRef.current = null;
                                }}
                                disabled={loading}
                              />
                            )}
                            
                            {/* Step 0: Intent Selection */}
                            {(mediaConfirmation && mediaConfirmStep === 0 && msg.id === messages[messages.length - 1]?.id) ? (
                              <MediaConfirmCard
                                detectedType={msg.media_confirmation.detectedType}
                                onSelect={handleMediaConfirmType}
                              />
                            ) : msg.media_confirmation?.selectedType ? null : null}
                            
                            {/* Step 1: Prompt Review */}
                            {(mediaConfirmation && mediaConfirmStep === 1 && msg.id === messages[messages.length - 1]?.id) && (
                              <PromptReviewCard
                                refinedPrompt={msg.media_confirmation.refinedPrompt}
                                mediaType={mediaConfirmType}
                                onApprove={handleMediaConfirmPrompt}
                                disabled={loading}
                              />
                            )}
                            
                            {/* Step 2: Model Selection */}
                            {(mediaConfirmation && mediaConfirmStep === 2 && msg.id === messages[messages.length - 1]?.id) && (
                              <ModelSelectionCard
                                models={msg.media_confirmation.availableModels}
                                mediaType={mediaConfirmType}
                                recommended={msg.media_confirmation.recommendedModel || 'smart'}
                                onSelect={handleMediaConfirmModel}
                                disabled={loading}
                              />
                            )}
                          </div>
                        )}
                        
                        {/* Sources Section - Like Perplexity */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                              <Globe className="w-3 h-3" /> Sources
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.sources.map((source, idx) => (
                                <a
                                  key={idx}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30 rounded-lg px-2.5 py-1.5 transition-all"
                                  title={source.snippet || source.title}
                                >
                                  <span className="w-4 h-4 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="text-[11px] text-gray-400 group-hover:text-white truncate max-w-[150px] transition-colors">
                                    {source.title}
                                  </span>
                                  <ExternalLink className="w-2.5 h-2.5 text-gray-600 group-hover:text-orange-400 flex-shrink-0 transition-colors" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // User message - support editing
                      editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full bg-sp-black border border-orange-500/30 rounded-lg p-2 text-white text-[13px] sm:text-sm focus:outline-none focus:border-orange-500/50 resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={cancelEdit} className="px-3 py-1 text-gray-500 hover:text-white text-xs transition-colors">
                              Cancel
                            </button>
                            <button 
                              onClick={submitEditedMessage}
                              disabled={!editingContent.trim()}
                              className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg disabled:opacity-50 transition-colors"
                            >
                              Save & Regenerate
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{typeof msg.content === 'string' ? msg.content : String(msg.content || '')}</p>
                      )
                    )}
                    {/* Variant toggle for user messages */}
                    {msg.role === 'user' && msg.variants && msg.variants.length > 1 && editingMessageId !== msg.id && (
                      <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/5">
                        <button 
                          onClick={() => toggleVariant(msg.id, 'prev')}
                          disabled={(msg.activeVariant || 0) === 0}
                          className="p-0.5 rounded text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-gray-500 font-mono min-w-[28px] text-center">
                          {(msg.activeVariant || 0) + 1}/{msg.variants.length}
                        </span>
                        <button 
                          onClick={() => toggleVariant(msg.id, 'next')}
                          disabled={(msg.activeVariant || 0) >= msg.variants.length - 1}
                          className="p-0.5 rounded text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-gray-600 ml-1">
                          {(msg.activeVariant || 0) === 0 ? 'original' : 'edited'}
                        </span>
                      </div>
                    )}
                  </div>
                  {msg.role === 'assistant' && msg.id !== 'greeting' && (
                    <div className="flex items-center gap-2 mt-1.5 ml-1">
                      {/* Variant toggle for assistant messages */}
                      {msg.variants && msg.variants.length > 1 && (
                        <div className="flex items-center gap-1 mr-2 pr-2 border-r border-white/10">
                          <button 
                            onClick={() => toggleVariant(msg.id, 'prev')}
                            disabled={(msg.activeVariant || 0) === 0}
                            className="p-0.5 rounded text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <span className="text-[10px] text-gray-500 font-mono min-w-[28px] text-center">
                            {(msg.activeVariant || 0) + 1}/{msg.variants.length}
                          </span>
                          <button 
                            onClick={() => toggleVariant(msg.id, 'next')}
                            disabled={(msg.activeVariant || 0) >= msg.variants.length - 1}
                            className="p-0.5 rounded text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <button 
                        onClick={() => submitFeedback(msg.id, 'up')} 
                        className={`transition-colors p-1 rounded ${messageFeedback[msg.id] === 'up' ? 'text-green-400 bg-green-400/10' : 'text-gray-700 hover:text-green-400'}`}
                        title="Good response"
                      >
                        <ThumbsUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                      {/* Thumbs Down */}
                      <button 
                        onClick={() => submitFeedback(msg.id, 'down')} 
                        className={`transition-colors p-1 rounded ${messageFeedback[msg.id] === 'down' ? 'text-red-400 bg-red-400/10' : 'text-gray-700 hover:text-red-400'}`}
                        title="Poor response"
                      >
                        <ThumbsDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                      {/* Copy Button */}
                      <button 
                        onClick={() => copyMessage(msg.content, msg.id)} 
                        className={`transition-colors p-1 rounded ${copiedMessageId === msg.id ? 'text-green-400' : 'text-gray-700 hover:text-white'}`}
                        title={copiedMessageId === msg.id ? 'Copied!' : 'Copy message'}
                      >
                        {copiedMessageId === msg.id ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                      </button>
                      {/* Read Aloud Button */}
                      <button 
                        onClick={() => readAloud(msg.content, msg.id)} 
                        className={`transition-colors p-1 rounded ${readingAloudId === msg.id ? 'text-orange-400 bg-orange-400/10' : 'text-gray-700 hover:text-orange-400'}`}
                        title={readingAloudId === msg.id ? 'Stop reading' : 'Read aloud'}
                      >
                        {readingAloudId === msg.id ? <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                      </button>
                      {/* Continue Button - show for last assistant message if it might be truncated */}
                      {idx === messages.length - 1 && msg.content && msg.content.length > 500 && !loading && (
                        <button
                          onClick={() => {
                            setInput('Please continue from where you left off.');
                            setTimeout(() => sendMessage(), 100);
                          }}
                          className="transition-colors p-1 rounded text-gray-700 hover:text-orange-400 flex items-center gap-1"
                          title="Continue response"
                        >
                          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="text-[9px] sm:text-[10px]">Continue</span>
                        </button>
                      )}
                      {msg.model_used && <span className="text-[9px] sm:text-[10px] text-gray-700 truncate max-w-[80px] sm:max-w-none">{msg.model_used}</span>}
                    </div>
                  )}
                </div>
              </div>
              </MessageErrorBoundary>
            );
            })}

            {/* Web searching indicator */}
            {searchingWeb && (
              <div className="flex justify-start msg-appear">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                  <SoulPrintLogo size={12} className="sm:hidden" />
                  <SoulPrintLogo size={14} className="hidden sm:block" />
                </div>
                <div className="bg-white/4 border border-white/8 rounded-2xl px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2">
                  <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 animate-pulse" />
                  <span className="text-gray-400 text-[13px] sm:text-sm">
                    Searching: <span className="text-orange-400 truncate max-w-[120px] sm:max-w-none inline-block align-bottom">{searchQueries[0] || 'the web'}...</span>
                  </span>
                </div>
              </div>
            )}

            {/* Streaming */}
            {(streamingContent || (streamingImageUrl && loading) || streamingVideoTask) && (
              <MessageErrorBoundary key="streaming-boundary">
              <div ref={streamingBubbleRef} className="msg-appear flex justify-start">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0 mt-0.5">
                  <SoulPrintLogo size={12} className="sm:hidden" />
                  <SoulPrintLogo size={14} className="hidden sm:block" />
                </div>
                <div className="min-w-0 max-w-[95%] sm:max-w-[90%] lg:max-w-[85%] rounded-2xl px-3 py-2.5 sm:px-5 sm:py-3.5 bg-white/4 border border-white/8 text-[15px] sm:text-base text-gray-200 leading-7 break-words">
                  {/* Live image preview - only show while loading */}
                  {streamingImageUrl && loading && (
                    <ImageCard url={streamingImageUrl} revisedPrompt={streamingRevPrompt} onRegenerateWith={handleRegenerateWithModel} />
                  )}
                  {/* Live video card — ONLY show if no message in the list already has this taskId */}
                  {streamingVideoTask && !streamingImageUrl && !messages.some(m => m.video_task?.taskId === streamingVideoTask?.taskId) && (
                    <VideoCard
                      taskId={streamingVideoTask.taskId}
                      prompt={streamingVideoTask.prompt}
                      token={token}
                      initialStatus={streamingVideoTask.status}
                      modelLabel={streamingVideoTask.videoModelLabel || 'AI Video'}
                      messageId={streamingVideoTask.messageId}
                      videoModelReason={streamingVideoTask.videoModelReason}
                      sourceImageUrl={streamingVideoTask.sourceImage}
                      onVideoReady={(videoUrl) => {
                        // Video completed during streaming - update message state
                        if (streamingVideoTask.messageId) {
                          setMessages(prev => prev.map(m => 
                            m.id === streamingVideoTask.messageId 
                              ? { ...m, video_url: videoUrl, video_task: { ...m.video_task, status: 'success' } } 
                              : m
                          ));
                        }
                        // Clear streaming state
                        setStreamingVideoTask(null);
                      }}
                      onRegenerateWith={handleRegenerateWithModel}
                    />
                  )}
                  {/* Regular text (only if not a pure image/video message) */}
                  {streamingContent && !streamingImageUrl && !streamingVideoTask && !(isGeneratingVisual && visualGenerationType === 'video') && (
                    <>
                      <SafeMarkdown content={typeof streamingContent === 'string' ? streamingContent : String(streamingContent || '')} />
                      <span className="inline-block w-0.5 h-4 bg-orange-500 ml-0.5 animate-pulse" />
                      
                      {/* Show "still generating" indicator if stalled */}
                      {streamingStalled && (
                        <div className="mt-3 flex items-center gap-2 text-gray-400 text-xs">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span>Still generating, please wait...</span>
                        </div>
                      )}
                      
                      {/* Sources during streaming */}
                      {streamingSources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                            <Globe className="w-3 h-3" /> Sources
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {streamingSources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30 rounded-lg px-2.5 py-1.5 transition-all"
                                title={source.snippet || source.title}
                              >
                                <span className="w-4 h-4 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-[11px] text-gray-400 group-hover:text-white truncate max-w-[150px] transition-colors">
                                  {source.title}
                                </span>
                                <ExternalLink className="w-2.5 h-2.5 text-gray-600 group-hover:text-orange-400 flex-shrink-0 transition-colors" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              </MessageErrorBoundary>
            )}

            {loading && !streamingContent && !searchingWeb && (
              <div className="flex justify-start">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                  <SoulPrintLogo size={12} className="sm:hidden" />
                  <SoulPrintLogo size={14} className="hidden sm:block" />
                </div>
                <TypingIndicator />
              </div>
            )}

            {/* Compare Mode Loading */}
            {compareLoading && (
              <div className="msg-appear -mx-4 md:-mx-8 lg:-mx-16 px-4 md:px-8 lg:px-16">
                <div className="bg-gradient-to-br from-orange-500/5 to-blue-500/5 border border-white/10 rounded-2xl p-5 mb-4">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <GitCompare className="w-5 h-5 text-orange-400 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-white">Comparing {compareModels.length} models...</p>
                      <p className="text-sm text-gray-500">This may take a moment</p>
                    </div>
                  </div>
                  <div className={`grid gap-4 ${compareModels.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                    {compareModels.map(m => {
                      const modelInfo = MODELS.find(mod => mod.value === m.model);
                      return (
                        <CompareResponseCard 
                          key={m.model} 
                          response={{ model: m.model, provider: m.provider, label: modelInfo?.label, group: modelInfo?.group }}
                          isLoading={true}
                          totalModels={compareModels.length}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Compare Mode Responses */}
            {compareResponses && !compareLoading && (
              <SafeSection name="CompareMode">
              <div className="msg-appear -mx-4 md:-mx-8 lg:-mx-16 px-4 md:px-8 lg:px-16">
                <div className="bg-gradient-to-br from-orange-500/5 to-blue-500/5 border border-white/10 rounded-2xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <GitCompare className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-white">Compare Responses</p>
                        <p className="text-sm text-gray-500">
                          {compareResponses?.usedWebSearch && <span className="text-cyan-400 mr-2">🌐 Web search used</span>}
                          Select your preferred response to continue
                        </p>
                      </div>
                    </div>
                    {selectedCompareResponse && (
                      <span className="text-sm text-green-400 flex items-center gap-1.5 bg-green-500/10 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" /> Response selected
                      </span>
                    )}
                  </div>
                  <div className={`grid gap-4 ${(compareResponses?.responses?.length || 0) === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                    {(compareResponses?.responses || []).map(response => (
                      <CompareResponseCard 
                        key={response.model} 
                        response={response}
                        onSelect={handleSelectCompareResponse}
                        selected={selectedCompareResponse === response.model}
                        totalModels={compareResponses?.responses?.length || 0}
                      />
                    ))}
                  </div>
                </div>
              </div>
              </SafeSection>
            )}

            {/* Visual Content Generating Indicator — only before VideoCard takes over */}
            {isGeneratingVisual && !streamingVideoTask && (
              <div className="px-2 sm:px-4 py-3">
                <div className="max-w-3xl mx-auto">
                  {visualGenerationType === 'video' ? (
                    /* Enhanced Video Generation Trigger — larger, more prominent */
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-cyan-600/10 border-2 border-blue-500/30 p-6 shadow-lg shadow-blue-500/5">
                      {/* Animated background shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                      
                      {/* Pulsing border glow */}
                      <div className="absolute inset-0 rounded-2xl border-2 border-blue-400/20 animate-pulse" />
                      
                      <div className="relative flex items-center gap-5">
                        {/* Large animated video icon */}
                        <div className="relative flex-shrink-0">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                            <Film className="w-8 h-8 text-blue-400 animate-pulse" />
                          </div>
                          <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-blue-500/60 animate-spin" style={{ animationDuration: '2s' }} />
                          {/* Outer glow ring */}
                          <div className="absolute -inset-1 rounded-2xl border border-blue-500/10 animate-ping" style={{ animationDuration: '3s' }} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-lg mb-1">🎬 Video Generation Started!</p>
                          <p className="text-blue-300/80 text-sm">Your video is being created. This typically takes 1-5 minutes.</p>
                        </div>
                      </div>
                      
                      {/* Animated progress bar */}
                      <div className="mt-5 relative h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-full animate-progress" />
                      </div>
                      
                      {/* Bouncing dots */}
                      <div className="flex justify-center gap-2.5 mt-4">
                        <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-3 h-3 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>

                      {/* Hint */}
                      <div className="mt-4 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                        <span className="text-xs">💡</span>
                        <p className="text-[11px] text-cyan-400/70">You can keep chatting — the video will appear when it's ready.</p>
                      </div>
                    </div>
                  ) : (
                    /* Original animation for images/infographics/etc. */
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 p-5">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                      <div className="relative flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                            <Sparkles className="w-7 h-7 text-purple-400 animate-pulse" />
                          </div>
                          <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-base mb-1">
                            {visualGenerationType === 'infographic' ? '📊 Creating your infographic...' :
                             visualGenerationType === 'flyer' ? '📄 Designing your flyer...' :
                             visualGenerationType === 'poster' ? '🖼️ Creating your poster...' :
                             visualGenerationType === 'edit' ? '✏️ Editing your image...' :
                             visualGenerationType === 'composite' ? '🎨 Creating realistic mockup...' :
                             '✨ Generating your image...'}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {visualGenerationType === 'composite'
                              ? 'AI is blending your design into the image naturally. ~15-20 seconds.'
                              : 'This may take 15-30 seconds. We\'re crafting something beautiful!'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full animate-progress" />
                      </div>
                      <div className="flex justify-center gap-2 mt-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
          </SafeSection>
        </div>

        {/* Composer - with safe area padding at bottom for PWA */}
        <div 
          className={`flex-shrink-0 px-4 pb-6 safe-area-bottom relative transition-all ${isDragging ? 'ring-2 ring-orange-500 ring-inset' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-orange-500/10 border-2 border-dashed border-orange-500 rounded-2xl flex items-center justify-center z-50 pointer-events-none">
              <div className="text-center">
                <Upload className="w-10 h-10 text-orange-400 mx-auto mb-2" />
                <p className="text-orange-400 font-medium">Drop files here</p>
                <p className="text-orange-400/60 text-sm">Images, PDFs, documents</p>
              </div>
            </div>
          )}
          <div className="max-w-4xl mx-auto">
            {/* Mode Toggle & Model selector — inline row */}
            <div className="flex items-center justify-center gap-3 mb-3">
              {/* Compare Mode Toggle — inline with Dynamic Intelligence */}
              <button
                onClick={() => {
                  setCompareMode(!compareMode);
                  if (!compareMode && compareModels.length === 0) {
                    setCompareModels([
                      { model: 'gpt-4o', provider: 'openai' },
                      { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
                    ]);
                  }
                }}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all ${
                  compareMode 
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' 
                    : 'bg-white/4 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>{compareMode ? 'Compare Mode' : 'Single Model'}</span>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${compareMode ? 'bg-orange-500' : 'bg-white/10'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${compareMode ? 'left-4' : 'left-0.5'}`} />
                </div>
              </button>

              {/* ── Unified Model Selector (Dynamic Intelligence) ── */}
              {!compareMode && (
                <div className="relative" ref={modelPickerRef}>
                  <button onClick={() => { setShowModelPicker(!showModelPicker); setShowVideoModelPicker(false); }}
                    className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors bg-white/4 border border-white/8 px-3 py-1.5 rounded-full">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    {selectedModel === 'smart' && selectedVideoModel === 'smart' && selectedImageModel === 'smart' ? (
                      <span className="text-cyan-400/90">Dynamic Intelligence</span>
                    ) : (
                      <span className="flex items-center gap-1 flex-wrap">
                        {selectedModel !== 'smart' && <span className="text-orange-400/80">{currentModel.label}</span>}
                        {selectedVideoModel !== 'smart' && (
                          <>
                            {selectedModel !== 'smart' && <span className="text-gray-600">·</span>}
                            <span className="text-blue-400/80">{VIDEO_MODELS.find(m => m.value === selectedVideoModel)?.label}</span>
                          </>
                        )}
                        {selectedImageModel !== 'smart' && (
                          <>
                            {(selectedModel !== 'smart' || selectedVideoModel !== 'smart') && <span className="text-gray-600">·</span>}
                            <span className="text-pink-400/80">{IMAGE_MODELS.find(m => m.value === selectedImageModel)?.label}</span>
                          </>
                        )}
                        {(selectedModel === 'smart' || selectedVideoModel === 'smart' || selectedImageModel === 'smart') && <span className="text-cyan-400/60 ml-0.5">+ Auto</span>}
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showModelPicker && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#141a21] border border-white/10 rounded-xl shadow-2xl min-w-[280px] z-10 max-h-[400px] overflow-y-auto">
                      {/* Dynamic Intelligence - Auto for all */}
                      <div className="p-1.5 border-b border-white/5">
                        <button
                          onClick={() => { setSelectedModel('smart'); setSelectedVideoModel('smart'); setSelectedImageModel('smart'); setShowModelPicker(false); }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                            selectedModel === 'smart' && selectedVideoModel === 'smart' && selectedImageModel === 'smart'
                              ? 'bg-cyan-500/15 text-cyan-400'
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}>
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          <div>
                            <span className="font-medium">Dynamic Intelligence</span>
                            <span className="ml-1.5 text-[9px] text-cyan-400/70">Auto</span>
                            <p className="text-[9px] text-gray-600 mt-0.5">AI picks the best model for text, images & video</p>
                          </div>
                          {selectedModel === 'smart' && selectedVideoModel === 'smart' && selectedImageModel === 'smart' && <Check className="w-3.5 h-3.5 text-cyan-400 ml-auto" />}
                        </button>
                      </div>

                      {/* Text Models */}
                      <div className="p-1.5">
                        <div className="px-3 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Text
                          {selectedModel === 'smart' && <span className="text-cyan-400/60 ml-1 normal-case font-normal">Auto</span>}
                        </div>
                        {MODELS.filter(m => !m.isSmartMode).map(m => (
                          <button 
                            key={m.value} 
                            onClick={() => { if (!m.comingSoon) setSelectedModel(m.value); }}
                            disabled={m.comingSoon}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-between ${
                              m.comingSoon ? 'text-gray-700 cursor-not-allowed' 
                                : selectedModel === m.value ? 'bg-orange-500/15 text-orange-400' 
                                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}>
                            <span>
                              {m.label}
                              {m.comingSoon && <span className="ml-1 text-[8px] text-orange-500/50">soon</span>}
                              {defaultModelSaved === m.value && <span className="ml-1.5 text-[8px] text-green-400/80">★ default</span>}
                            </span>
                            {selectedModel === m.value && !m.comingSoon && <Check className="w-3 h-3 text-orange-400" />}
                          </button>
                        ))}
                        {selectedModel !== 'smart' && selectedModel !== defaultModelSaved && (
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ default_model: selectedModel }) });
                            setDefaultModelSaved(selectedModel);
                            toast({ title: '✅ Text Default Saved', description: `${MODELS.find(m => m.value === selectedModel)?.label} is now your default text model.`, duration: 2500, className: 'bg-[#1a1f2e] border-green-500/30 text-white' });
                          }} className="w-full text-center mt-0.5 px-3 py-1 text-[9px] text-gray-600 hover:text-green-400 transition-colors">
                            Set as text default
                          </button>
                        )}
                      </div>

                      {/* Image Models */}
                      <div className="p-1.5 border-t border-white/5">
                        <div className="px-3 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                          <ImagePlus className="w-3 h-3" /> Image
                          {selectedImageModel === 'smart' && <span className="text-cyan-400/60 ml-1 normal-case font-normal">Auto</span>}
                        </div>
                        {IMAGE_MODELS.filter(m => !m.isSmartMode).map(m => (
                          <button 
                            key={m.value}
                            onClick={() => setSelectedImageModel(m.value)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-between ${
                              selectedImageModel === m.value
                                ? 'bg-pink-500/15 text-pink-400'
                                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}>
                            <div>
                              <span>{m.label}</span>
                              <span className="ml-1.5 text-[8px] text-gray-700">{m.description}</span>
                              {defaultImageModelSaved === m.value && <span className="ml-1.5 text-[8px] text-green-400/80">★ default</span>}
                            </div>
                            {selectedImageModel === m.value && <Check className="w-3 h-3 text-pink-400" />}
                          </button>
                        ))}
                        {selectedImageModel !== 'smart' && selectedImageModel !== defaultImageModelSaved && (
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ default_image_model: selectedImageModel }) });
                            setDefaultImageModelSaved(selectedImageModel);
                            toast({ title: '✅ Image Default Saved', description: `${IMAGE_MODELS.find(m => m.value === selectedImageModel)?.label} is now your default image model.`, duration: 2500, className: 'bg-[#1a1f2e] border-green-500/30 text-white' });
                          }} className="w-full text-center mt-0.5 px-3 py-1 text-[9px] text-gray-600 hover:text-pink-400 transition-colors">
                            Set as image default
                          </button>
                        )}
                      </div>

                      {/* Video Models */}
                      <div className="p-1.5 border-t border-white/5">
                        <div className="px-3 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                          <Film className="w-3 h-3" /> Video
                          {selectedVideoModel === 'smart' && <span className="text-cyan-400/60 ml-1 normal-case font-normal">Auto</span>}
                        </div>
                        {VIDEO_MODELS.filter(m => !m.isSmartMode).map(m => (
                          <button 
                            key={m.value}
                            onClick={() => setSelectedVideoModel(m.value)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-between ${
                              selectedVideoModel === m.value
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            }`}>
                            <div>
                              <span>{m.label}</span>
                              <span className="ml-1.5 text-[8px] text-gray-700">{m.description}</span>
                              {defaultVideoModelSaved === m.value && <span className="ml-1.5 text-[8px] text-green-400/80">★ default</span>}
                            </div>
                            {selectedVideoModel === m.value && <Check className="w-3 h-3 text-blue-400" />}
                          </button>
                        ))}
                        {selectedVideoModel !== 'smart' && selectedVideoModel !== defaultVideoModelSaved && (
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ default_video_model: selectedVideoModel }) });
                            setDefaultVideoModelSaved(selectedVideoModel);
                            toast({ title: '✅ Video Default Saved', description: `${VIDEO_MODELS.find(m => m.value === selectedVideoModel)?.label} is now your default video model.`, duration: 2500, className: 'bg-[#1a1f2e] border-green-500/30 text-white' });
                          }} className="w-full text-center mt-0.5 px-3 py-1 text-[9px] text-gray-600 hover:text-blue-400 transition-colors">
                            Set as video default
                          </button>
                        )}
                      </div>

                      {/* Save all defaults button */}
                      <div className="p-1.5 border-t border-white/10">
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/profile', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  default_model: selectedModel,
                                  default_video_model: selectedVideoModel,
                                  default_image_model: selectedImageModel,
                                }),
                              });
                              setDefaultModelSaved(selectedModel);
                              setDefaultVideoModelSaved(selectedVideoModel);
                              setDefaultImageModelSaved(selectedImageModel);
                              toast({
                                title: '✅ All Defaults Saved',
                                description: 'Text, Image, and Video model defaults updated.',
                                duration: 3000,
                                className: 'bg-[#1a1f2e] border-green-500/30 text-white',
                              });
                              setShowModelPicker(false);
                            } catch (e) {
                              console.error('Failed to save defaults:', e);
                            }
                          }}
                          className="w-full text-center px-3 py-2 rounded-lg text-[10px] font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          💾 Save All as Defaults
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Compare Mode Model Picker */}
              {compareMode && (
                <CompareModePicker 
                  selectedModels={compareModels} 
                  setSelectedModels={setCompareModels} 
                  maxModels={3} 
                />
              )}
            </div>

            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="mb-3 px-1 animate-in slide-in-from-bottom-2 duration-200">
                <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <span className="text-orange-400 text-xs font-medium">
                      {attachments.length} file{attachments.length > 1 ? 's' : ''} attached — ready to send
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {attachments.map((att, i) => (
                      <AttachmentPill 
                        key={i} 
                        att={att} 
                        onRemove={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        onGenerateJson={att.type === 'image' ? generateImageJson : null}
                        onEditVideo={att.type === 'video' ? (videoAtt) => {
                          setEditableVideo({ url: videoAtt.localUrl });
                          setShowVideoEditor(true);
                        } : null}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {fileError && <p className="text-red-400 text-xs mb-1 px-1">{fileError}</p>}

            {/* Large text warning banner */}
            {input.length > SHOW_COUNTER_CHARS && (
              <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl mb-1 text-xs ${
                input.length > MAX_INPUT_CHARS 
                  ? 'bg-red-500/15 border border-red-500/30 text-red-400' 
                  : input.length > WARN_INPUT_CHARS 
                    ? 'bg-yellow-500/15 border border-yellow-500/30 text-yellow-400' 
                    : 'bg-white/5 border border-white/10 text-gray-500'
              }`}>
                <span>
                  {input.length > MAX_INPUT_CHARS 
                    ? `Text too long — will be truncated. Attach as file instead.`
                    : input.length > WARN_INPUT_CHARS 
                      ? `Approaching limit — consider attaching as a file`
                      : `${(input.length / 1000).toFixed(1)}K chars`
                  }
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono ${input.length > MAX_INPUT_CHARS ? 'text-red-400' : input.length > WARN_INPUT_CHARS ? 'text-yellow-400' : 'text-gray-600'}`}>
                    {(input.length / 1000).toFixed(1)}K / {(MAX_INPUT_CHARS / 1000)}K
                  </span>
                  {input.length > WARN_INPUT_CHARS && (
                    <button
                      onClick={convertInputToFile}
                      className="px-2 py-0.5 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30 transition-colors text-[10px] font-medium whitespace-nowrap"
                    >
                      Send as file
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Media generation handled dynamically through chat - no manual controls needed */}

            {/* Input bar */}
            <div className={`flex items-center gap-1.5 sm:gap-2 bg-[#141a21] border rounded-2xl px-2 sm:px-3 py-2 transition-colors ${speech.isListening ? 'border-orange-500/60 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'border-white/10 focus-within:border-orange-500/30'}`}>
              {/* File attach button */}
              <button onClick={() => fileInputRef.current?.click()}
                className="text-gray-600 hover:text-orange-400 transition-colors flex-shrink-0" title="Attach file or image">
                <CloudUploadIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={handleFileSelect} />

              {/* Location button - hide on very small screens */}
              <button
                onClick={() => {
                  if (userLocation) {
                    // If location already set, show modal to update
                    setShowLocationModal(true);
                  } else {
                    requestLocation();
                  }
                }}
                disabled={locationLoading}
                title={userLocation ? `📍 ${userLocation.address} (click to update)` : 'Share your location for "near me" searches'}
                className={`flex-shrink-0 transition-colors hidden xs:block ${userLocation ? 'text-green-500 hover:text-green-400' : locationError ? 'text-red-400 hover:text-red-300' : 'text-gray-600 hover:text-orange-400'} ${locationLoading ? 'animate-pulse' : ''}`}
              >
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Mic button */}
              <button
                onClick={speech.toggle}
                title={speech.error || (speech.isListening ? 'Stop recording' : 'Start voice input')}
                className={`flex-shrink-0 transition-all relative ${speech.isListening ? 'text-orange-500' : speech.error ? 'text-red-400' : 'text-gray-600 hover:text-orange-400'}`}
              >
                <MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                {speech.isListening && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                )}
              </button>

              {/* Voice Conversation button - Real-time voice chat */}
              {voiceChatEnabled && (
                <button
                  onClick={() => setShowVoiceChat(true)}
                  title="Voice conversation"
                  className="flex-shrink-0 text-gray-600 hover:text-green-400 transition-all p-1 -m-1"
                >
                  <AudioWaveform className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {/* Image/Video generation removed - handled dynamically through chat */}

              {/* Edit Image button - shows when there's an image attachment or editable image */}
              {(attachments.some(a => a.type === 'image') || editableImage) && (
                <button
                  onClick={() => {
                    // If there's an attached image, use that; otherwise use the editable image from conversation
                    const imageAtt = attachments.find(a => a.type === 'image');
                    if (imageAtt) {
                      setEditableImage({ base64: imageAtt.base64, mimeType: imageAtt.mimeType, source: 'upload' });
                    }
                    setShowImageEditor(true);
                  }}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all flex-shrink-0"
                  title="Edit image with AI"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              {/* Mockup button - shows when there's an image attachment */}
              {attachments.some(a => a.type === 'image') && (
                <button
                  onClick={() => {
                    const imageAtt = attachments.find(a => a.type === 'image');
                    if (imageAtt) {
                      setMockupDesign({ base64: imageAtt.base64, mimeType: imageAtt.mimeType });
                      setShowMockupGenerator(true);
                    }
                  }}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-orange-400 hover:from-orange-500/30 hover:to-pink-500/30 transition-all flex-shrink-0"
                  title="Create product mockup"
                >
                  <span className="text-sm">🎨</span>
                </button>
              )}

              <div className="flex-1 relative min-w-0">
                <textarea
                  ref={inputRef}
                  value={speech.isListening && interimText ? input + (input ? ' ' : '') + interimText : input}
                  onChange={e => { 
                    if (!speech.isListening) {
                      setInput(e.target.value);
                      // Auto-resize
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                    }
                  }}
                  onPaste={handlePaste}
                  onKeyDown={e => { 
                    if (e.key === 'Enter' && !e.shiftKey) { 
                      e.preventDefault(); 
                      sendMessage();
                      // Reset height after sending
                      e.target.style.height = 'auto';
                      // Ensure focus stays on input
                      setTimeout(() => e.target.focus(), 50);
                    }
                    // Shift+Enter creates new line (default textarea behavior)
                  }}
                  placeholder={speech.isListening ? (speech.mode === 'whisper' ? 'Recording…' : 'Listening…') : attachments.length > 0 ? 'Add message…' : 'Message…'}
                  className={`w-full bg-transparent text-[13px] sm:text-sm placeholder-gray-600 focus:outline-none py-1 sm:py-1.5 resize-none overflow-hidden ${speech.isListening ? 'text-orange-300' : isDark ? 'text-white' : 'text-black'}`}
                  disabled={loading}
                  readOnly={speech.isListening}
                  rows={1}
                  style={{ 
                    minHeight: '24px', 
                    maxHeight: '150px',
                    color: speech.isListening ? '#fdba74' : isDark ? '#ffffff' : '#000000',
                    caretColor: speech.isListening ? '#fdba74' : isDark ? '#ffffff' : '#000000',
                    WebkitTextFillColor: speech.isListening ? '#fdba74' : isDark ? '#ffffff' : '#000000',
                    backgroundColor: 'transparent',
                  }}
                />
              </div>

              {/* Show Stop button when loading (not in compare mode), otherwise show Send button */}
              {loading && !compareLoading ? (
                <button 
                  onClick={stopRequest}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors flex-shrink-0 animate-pulse"
                  title="Stop generating"
                >
                  <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </button>
              ) : (
                <button onClick={() => {
                  // If speech is listening, stop it and include interim text before sending
                  if (speech.isListening) {
                    if (interimText) {
                      setInput(prev => (prev ? prev + ' ' + interimText : interimText));
                      setInterimText('');
                    }
                    speech.toggle(); // Stop recording
                    // Delay send slightly to allow state to settle after stopping speech
                    setTimeout(() => {
                      sendMessage();
                      if (inputRef.current) {
                        inputRef.current.style.height = 'auto';
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }
                    }, 150);
                    return;
                  }
                  sendMessage();
                  // Reset textarea height and refocus after sending
                  if (inputRef.current) {
                    inputRef.current.style.height = 'auto';
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }
                }}
                  disabled={(!input.trim() && attachments.length === 0 && !speech.isListening) || loading || compareLoading || (compareMode && compareModels.length === 0)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                    compareMode ? 'bg-gradient-to-r from-orange-500 to-blue-500 hover:from-orange-600 hover:to-purple-600' : 'bg-orange-500 hover:bg-orange-600'
                  }`}>
                  {compareLoading ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-spin" /> : compareMode ? <GitCompare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" /> : <SendIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />}
                </button>
              )}
            </div>
            <p className="text-center text-[9px] sm:text-[10px] text-gray-700 mt-1.5 sm:mt-2 px-2">
              {speech.isListening
                ? <span className="text-orange-500/70 animate-pulse">🎙 {speech.mode === 'live' ? 'Listening — tap mic to stop' : 'Recording — tap to stop'}</span>
                : compareMode
                  ? <span className="text-blue-400/70">Compare: {compareModels.length} model{compareModels.length !== 1 ? 's' : ''}</span>
                  : <span className="hidden sm:inline">Supports JPG, PNG, PDF, TXT, CSV · Paste images with Ctrl+V · Max 50MB</span>}
              {!speech.isListening && !compareMode && <span className="sm:hidden">Tap 🎙 for voice · Paste or attach files</span>}
            </p>
          </div>
        </div>
      </div>
      </SafeSection>

      {showSettings && <SafeSection name="SettingsModal"><SettingsModal onClose={() => setShowSettings(false)} token={token} onModelChange={(type, value) => {
        if (type === 'text') { setSelectedModel(value); setDefaultModelSaved(value); }
        else if (type === 'video') { setSelectedVideoModel(value); setDefaultVideoModelSaved(value); }
        else if (type === 'image') { setSelectedImageModel(value); setDefaultImageModelSaved(value); }
      }} onAssistantNameChange={setAssistantName} onAnnouncementsChange={setAnnouncements} onVoiceSettingsChange={(vs) => {
        setUser(prev => prev ? { ...prev, profile: { ...prev.profile, voice_settings: vs } } : prev);
      }} /></SafeSection>}
      
      {/* Feedback Modal */}
      {showFeedbackModal && <SafeSection name="FeedbackModal"><FeedbackModal onClose={() => setShowFeedbackModal(false)} token={token} /></SafeSection>}
      
      {/* What's New Modal */}
      {showWhatsNew && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWhatsNew(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">What's New</h3>
                    <p className="text-xs text-gray-500">Latest updates and features</p>
                  </div>
                </div>
                <button onClick={() => setShowWhatsNew(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {appUpdates.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No updates yet</p>
                  <p className="text-gray-600 text-xs mt-1">Check back soon for new features!</p>
                </div>
              ) : (
                appUpdates.map(upd => (
                  <div key={upd.id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        upd.type === 'feature' ? 'bg-green-500/20' :
                        upd.type === 'improvement' ? 'bg-blue-500/20' :
                        upd.type === 'fix' ? 'bg-orange-500/20' :
                        'bg-purple-500/20'
                      }`}>
                        <span className="text-sm">
                          {upd.type === 'feature' ? '✨' :
                           upd.type === 'improvement' ? '🔧' :
                           upd.type === 'fix' ? '🐛' : '📢'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-white font-medium text-sm">{upd.title}</h4>
                          {upd.version && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-gray-400 rounded">
                              {upd.version}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs leading-relaxed">{upd.description}</p>
                        <p className="text-gray-600 text-[10px] mt-2">
                          {upd.release_date ? new Date(upd.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {appUpdates.length > 0 && (
              <div className="p-4 border-t border-white/10">
                <button 
                  onClick={async () => {
                    await fetch('/api/app-updates/mark-viewed', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    setAppUpdatesUnread(0);
                    setShowWhatsNew(false);
                  }}
                  className="w-full py-2.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-xl text-sm font-medium transition-colors"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Image JSON Generation Modal */}
      {showImageJsonModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowImageJsonModal(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Code className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Image Generation Config</h3>
                    <p className="text-xs text-gray-500">AI-generated parameters to recreate this image</p>
                  </div>
                </div>
                <button onClick={() => setShowImageJsonModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {generatingImageJson ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Analyzing image...</p>
                  <p className="text-gray-600 text-sm mt-1">Detecting style, composition, colors, and subjects</p>
                </div>
              ) : imageJsonResult?.error ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <X className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-red-400">{imageJsonResult.error}</p>
                </div>
              ) : imageJsonResult ? (
                <div className="space-y-4">
                  {/* Suggested Prompt */}
                  <div>
                    <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2 block">Suggested Prompt</label>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="text-white text-sm leading-relaxed">{imageJsonResult.prompt}</p>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(imageJsonResult.prompt);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10 transition-colors text-sm"
                    >
                      <Copy className="w-4 h-4" /> Copy Prompt
                    </button>
                    <button
                      onClick={() => {
                        setInput(imageJsonResult.prompt);
                        setShowImageJsonModal(false);
                        setDetectedMediaIntent('image');
                        setShowMediaOptions(true);
                        setTimeout(() => inputRef.current?.focus(), 100);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors text-sm"
                    >
                      <Sparkles className="w-4 h-4" /> Generate Similar
                    </button>
                  </div>
                  
                  {/* Full JSON */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">Full JSON Config</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(JSON.stringify(imageJsonResult, null, 2))}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-white/5 text-gray-400 hover:bg-white/10 rounded transition-colors"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(imageJsonResult, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `image-config-${Date.now()}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-white/5 text-gray-400 hover:bg-white/10 rounded transition-colors"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                      </div>
                    </div>
                    <pre className="bg-[#0d1117] border border-white/10 rounded-xl p-4 text-[11px] text-gray-400 font-mono overflow-x-auto">
                      {JSON.stringify(imageJsonResult, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      
      {/* Image Editor Modal */}
      {showImageEditor && editableImage && (
        <SafeSection name="ImageEditor">
        <ImageEditor
          image={editableImage}
          onClose={() => {
            setShowImageEditor(false);
          }}
          onEdit={handleImageEdit}
          isEditing={isEditingImage}
        />
        </SafeSection>
      )}
      
      {/* Mockup Generator Modal */}
      {showMockupGenerator && mockupDesign && (
        <SafeSection name="MockupGenerator">
        <MockupGenerator
          design={mockupDesign}
          onClose={() => setShowMockupGenerator(false)}
          onGenerate={handleGenerateMockup}
          isGenerating={isGeneratingMockup}
          token={token}
        />
        </SafeSection>
      )}

      {/* Video Editor Modal */}
      {showVideoEditor && (
        <SafeSection name="VideoEditor">
          <VideoEditor
            videoUrl={editableVideo?.url}
            videoId={editableVideo?.videoId}
            onClose={() => { setShowVideoEditor(false); setEditableVideo(null); }}
            token={token}
          />
        </SafeSection>
      )}
      
      {/* Location Modal - Manual Input Fallback */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLocationModal(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Set Your Location</h3>
                  <p className="text-xs text-gray-500">For "near me" searches</p>
                </div>
              </div>
              
              {/* Error Message */}
              {locationError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm whitespace-pre-line">{locationError}</p>
                </div>
              )}
              
              {/* Manual Input */}
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-2">Enter your location</label>
                  <input
                    type="text"
                    value={manualLocationInput}
                    onChange={(e) => setManualLocationInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveManualLocation()}
                    placeholder="City, address, or zip code..."
                    className="w-full bg-sp-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40"
                    autoFocus
                  />
                  <p className="text-gray-500 text-xs mt-1.5">Example: "San Francisco, CA" or "90210"</p>
                </div>
                
                {/* Try Again Button (for permission retry) */}
                <button
                  onClick={() => {
                    setShowLocationModal(false);
                    setLocationError(null);
                    requestLocation();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm">Try automatic location again</span>
                </button>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowLocationModal(false);
                    setManualLocationInput('');
                    setLocationError(null);
                  }}
                  className="flex-1 py-2.5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveManualLocation}
                  disabled={locationLoading || !manualLocationInput.trim()}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {locationLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Location</span>
                  )}
                </button>
              </div>
              
              {/* Current Location Display */}
              {userLocation && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-gray-500 text-xs mb-1">Current saved location:</p>
                  <p className="text-green-400 text-sm">{userLocation.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Project Modal (Create/Edit/Share) */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowProjectModal(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              {projectModalMode === 'create' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <FolderPlus className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">New Project</h3>
                  </div>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none mb-3"
                    autoFocus
                  />
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none resize-none mb-3"
                  />
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      Custom AI Instructions (optional)
                    </label>
                    <textarea
                      value={newProjectInstructions}
                      onChange={(e) => setNewProjectInstructions(e.target.value)}
                      placeholder="Enter custom instructions for AI in this project... (e.g., persona, tone, specific knowledge, rules)"
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none resize-none text-sm"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">These instructions will be applied to all chats in this project.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowProjectModal(false)}
                      className="flex-1 py-2.5 px-4 border border-white/10 rounded-xl text-gray-400 hover:bg-white/5 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createProject}
                      disabled={!newProjectName.trim()}
                      className="flex-1 py-2.5 px-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:opacity-50 rounded-xl text-white transition-colors text-sm font-medium"
                    >
                      Create Project
                    </button>
                  </div>
                </>
              )}
              
              {projectModalMode === 'edit' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                      <Pencil className="w-5 h-5 text-orange-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Edit Project</h3>
                  </div>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500/40 outline-none mb-3"
                    autoFocus
                  />
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500/40 outline-none resize-none mb-3"
                  />
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      Custom AI Instructions
                    </label>
                    <textarea
                      value={newProjectInstructions}
                      onChange={(e) => setNewProjectInstructions(e.target.value)}
                      placeholder="Enter custom instructions for AI in this project... (e.g., persona, tone, specific knowledge, rules)"
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500/40 outline-none resize-none text-sm"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">These instructions will be applied to all chats in this project.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => deleteProject(editingProject?.id)}
                      className="py-2.5 px-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowProjectModal(false)}
                      className="flex-1 py-2.5 px-4 border border-white/10 rounded-xl text-gray-400 hover:bg-white/5 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updateProject}
                      disabled={!newProjectName.trim()}
                      className="flex-1 py-2.5 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:opacity-50 rounded-xl text-white transition-colors text-sm font-medium"
                    >
                      Save
                    </button>
                  </div>
                </>
              )}
              
              {projectModalMode === 'share' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Share Project</h3>
                      <p className="text-gray-500 text-xs">{editingProject?.name}</p>
                    </div>
                  </div>
                  
                  {/* Share link */}
                  {projectShareLink?.code && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-4">
                      <div className="flex items-center gap-2 text-purple-400 text-xs mb-2">
                        <Link2 className="w-3.5 h-3.5" /> Share Link
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <code className="flex-1 text-[10px] text-gray-400 truncate bg-black/20 rounded px-2 py-1">
                          {window.location.origin}/{projectShareLink.public_view ? 'shared' : 'join'}/{projectShareLink.code}
                        </code>
                        <button
                          onClick={copyShareLink}
                          className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-400 text-xs"
                        >
                          Copy
                        </button>
                      </div>
                      
                      {/* Public access toggle */}
                      <div className="flex items-center justify-between bg-black/20 rounded-lg p-2.5">
                        <div>
                          <p className="text-white text-xs font-medium">Public access</p>
                          <p className="text-gray-500 text-[10px]">Anyone with the link can view (read-only)</p>
                        </div>
                        <button
                          onClick={async () => {
                            const newPublicView = !projectShareLink.public_view;
                            try {
                              const res = await fetch(`/api/projects/${editingProject.id}/share-link`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ enabled: true, public_view: newPublicView }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setProjectShareLink(data.share_link);
                              }
                            } catch (err) {
                              console.error('Error toggling public view:', err);
                            }
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            projectShareLink.public_view ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            projectShareLink.public_view ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Invite by email */}
                  <p className="text-gray-400 text-xs mb-2">Invite by email</p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="email"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="Enter email"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/40 outline-none"
                    />
                    <select
                      value={shareRole}
                      onChange={(e) => setShareRole(e.target.value)}
                      className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white cursor-pointer"
                    >
                      <option value="viewer" className="bg-[#1a1a1a] text-white">Viewer</option>
                      <option value="collaborator" className="bg-[#1a1a1a] text-white">Collaborator</option>
                    </select>
                  </div>
                  <button
                    onClick={shareProjectWithUser}
                    disabled={!shareEmail.trim()}
                    className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:opacity-50 rounded-xl text-white transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" /> Send Invite
                  </button>
                  
                  {/* Current members */}
                  {editingProject?.shared_with?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-gray-400 text-xs mb-2">Shared with</p>
                      {editingProject.shared_with.map((member, idx) => (
                        <div key={idx} className="flex items-center gap-3 py-2">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white text-sm">{member.email || member.user_id}</p>
                            <p className="text-gray-500 text-xs capitalize">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowProjectModal(false)}
                    className="w-full mt-4 py-2 text-gray-500 hover:text-white text-sm"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Move to Project Modal */}
      {showMoveToProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowMoveToProject(false)}>
          <div className="bg-[#111820] border border-white/10 rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Folder className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Move to Project</h3>
                  <p className="text-gray-500 text-xs truncate max-w-[200px]">{movingConversation?.title || 'Conversation'}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
              {/* Uncategorized option */}
              <button
                onClick={() => moveConversationToProject(movingConversation.id, null)}
                className={`w-full text-left p-3 rounded-xl transition-colors flex items-center gap-3 ${
                  !movingConversation?.project_id ? 'bg-gray-500/20 border border-gray-500/30' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <MessageSquare className="w-5 h-5 text-gray-400" />
                <span className="text-white text-sm">Uncategorized</span>
                {!movingConversation?.project_id && <Check className="w-4 h-4 text-gray-400 ml-auto" />}
              </button>
              
              {/* Projects */}
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={async () => {
                    console.log('Clicked project:', project.id, project.name);
                    await moveConversationToProject(movingConversation.id, project.id);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-colors flex items-center gap-3 ${
                    movingConversation?.project_id === project.id 
                      ? 'bg-purple-500/20 border border-purple-500/30' 
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <Folder className="w-5 h-5 text-purple-400" />
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm block truncate">{project.name}</span>
                    {project.description && (
                      <span className="text-gray-500 text-xs truncate block">{project.description}</span>
                    )}
                  </div>
                  {movingConversation?.project_id === project.id && (
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  )}
                </button>
              ))}
              
              {projects.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm mb-3">No projects yet</p>
                  <button
                    onClick={() => {
                      setShowMoveToProject(false);
                      setProjectModalMode('create');
                      setShowProjectModal(true);
                    }}
                    className="text-purple-400 text-sm font-medium hover:text-purple-300"
                  >
                    Create your first project →
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => setShowMoveToProject(false)}
                className="w-full py-2 text-gray-500 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Onboarding Modal - What is a SoulPrint? */}

      {/* Support Notifications Popup */}
      {supportNotifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm w-full" style={{ pointerEvents: 'none' }}>
          {supportNotifications.map(notif => (
            <div key={notif.id} className="bg-[#0d1f15] border border-green-500/30 rounded-xl p-4 shadow-2xl shadow-green-500/10 animate-in slide-in-from-right" style={{ pointerEvents: 'auto' }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-green-400 font-semibold text-sm mb-1">✅ Issue Resolved</p>
                  <p className="text-gray-300 text-sm leading-relaxed">{notif.message}</p>
                  {notif.conversation_id && (
                    <button
                      onClick={() => {
                        setConversationId(notif.conversation_id);
                        fetch(`/api/messages?conversationId=${notif.conversation_id}`, { headers: { Authorization: `Bearer ${token}` } })
                          .then(r => r.json()).then(msgs => { if (Array.isArray(msgs)) setMessages(msgs); }).catch(() => {});
                        dismissSupportNotification(notif.id);
                      }}
                      className="mt-2 text-xs text-green-400/70 hover:text-green-400 underline"
                    >
                      View conversation →
                    </button>
                  )}
                </div>
                <button
                  onClick={() => dismissSupportNotification(notif.id)}
                  className="text-gray-600 hover:text-white transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}


      {showOnboarding && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#111820] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-[#111820] border-b border-white/10 p-6 text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-4 border border-orange-500/30">
                <SoulPrintLogo size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to SoulPrint</h2>
              <p className="text-gray-500 text-sm">Your persistent AI identity layer</p>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-lg text-gray-300 leading-relaxed">
                  A SoulPrint is your <span className="text-orange-400 font-semibold">persistent AI identity layer</span>.
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                  <p className="text-gray-500 line-through text-xs">Not a chatbot</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                  <p className="text-gray-500 line-through text-xs">Not a prompt wrapper</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                  <p className="text-gray-500 line-through text-xs">Not a memory plugin</p>
                </div>
              </div>
              
              <p className="text-gray-400 text-sm leading-relaxed">
                It's a mapped, structured imprint of how you <span className="text-white">think</span>, <span className="text-white">decide</span>, <span className="text-white">react</span>, <span className="text-white">prioritize</span>, <span className="text-white">trust</span>, and <span className="text-white">communicate</span> — embedded into an AI system so the interaction reflects <em>you</em>, not generic model behavior.
              </p>
              
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                <p className="text-orange-300 font-medium mb-3 text-sm">Your SoulPrint captures:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {['Decision style', 'Conflict response', 'Boundary thresholds', 'Communication cadence', 'Emotional weighting', 'Pattern recognition'].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      <span className="text-gray-300 text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-sp-black rounded-xl">
                <div className="flex-1">
                  <p className="text-gray-500 text-xs mb-1">🔄 Most AI</p>
                  <p className="text-gray-400 text-sm">Resets every session</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-600" />
                <div className="flex-1">
                  <p className="text-orange-400 text-xs mb-1">✨ Your SoulPrint</p>
                  <p className="text-white text-sm">Builds continuity forever</p>
                </div>
              </div>
              
              <div className="text-center pt-4 border-t border-white/10">
                <p className="text-lg text-gray-300">
                  <span className="text-orange-400">In short:</span> A SoulPrint is the{' '}
                  <span className="text-white font-semibold">operating system of you</span> — running on AI.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-[#111820] border-t border-white/10 p-6">
              <button
                onClick={() => {
                  localStorage.setItem('sp_onboarding_seen', 'true');
                  setShowOnboarding(false);
                }}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all"
              >
                Get Started with My SoulPrint
              </button>
              <p className="text-center text-gray-600 text-xs mt-3">
                You can always revisit this in Settings → SoulPrint tab
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col" onClick={() => setShowGallery(false)}>
          <div className="flex-1 max-w-6xl w-full mx-auto p-6 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-blue-500 flex items-center justify-center">
                  <GalleryHorizontal className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Media Gallery</h2>
                  <p className="text-xs text-gray-500">{galleryItems.length} items generated</p>
                </div>
              </div>
              <button onClick={() => setShowGallery(false)} className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto">
              {galleryLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
                </div>
              ) : galleryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Sparkles className="w-12 h-12 text-gray-700 mb-4" />
                  <p className="text-gray-500 text-sm mb-2">No media generated yet</p>
                  <p className="text-gray-700 text-xs">Use the ✨ button in the chat to create images and videos</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {galleryItems.map(item => (
                    <GalleryItem key={item.id} item={item} onClick={setSelectedGalleryItem} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Gallery Item Detail Modal */}
      {selectedGalleryItem && (
        <GalleryModal 
          item={selectedGalleryItem} 
          onClose={() => setSelectedGalleryItem(null)} 
          token={token}
          onDelete={(deletedId) => {
            setGalleryItems(prev => prev.filter(item => item.id !== deletedId));
          }}
          onRegenerate={() => {
            // Refresh gallery after regeneration
            setTimeout(() => loadGallery(), 2000);
          }}
        />
      )}
      
      {/* Cloud Import Modal */}
      {showCloudImport && (
        <SafeSection name="CloudImport">
        <CloudImportModal 
          onClose={() => setShowCloudImport(false)} 
          token={token}
          onImportComplete={(data) => {
            console.log('Import completed:', data);
            // Show toast notification so user knows even after modal closes
            if (data?.memoriesAdded > 0) {
              toast({
                title: '✅ Import Complete!',
                description: `${data.memoriesAdded} new memories extracted from your chat history. Your AI is now more personalized.`,
                duration: 8000,
                className: 'bg-[#1a1f2e] border-green-500/30 text-white',
              });
            } else if (data?.messagesCount > 0) {
              toast({
                title: '✅ Import Complete!',
                description: `${data.messagesCount} messages analyzed from your chat history.`,
                duration: 5000,
                className: 'bg-[#1a1f2e] border-green-500/30 text-white',
              });
            } else if (data?.background) {
              toast({
                title: '⏳ Import Processing',
                description: 'Your data is still being processed in the background. Check Settings for results.',
                duration: 6000,
                className: 'bg-[#1a1f2e] border-cyan-500/30 text-white',
              });
            }
          }}
        />
        </SafeSection>
      )}
      
      
      {/* Voice Conversation Modal - Desktop */}
      {showVoiceChat && voiceChatEnabled && (
        <SafeSection name="DesktopVoiceChat">
        {(user?.profile?.voice_settings?.voice_engine === 'gemini') ? (
          <GeminiVoiceChat 
            token={token} 
            onClose={() => setShowVoiceChat(false)}
            onSaveTranscript={saveVoiceTranscript}
            systemPrompt={`You are ${assistantName || 'a helpful AI assistant'} having a voice conversation with ${user?.displayName || user?.email || 'the user'}. Be conversational, natural, and concise. Respond as if you're having a real phone call - be warm and engaging.`}
            userName={user?.displayName || user?.email?.split('@')[0]}
            defaultVoice={user?.profile?.voice_settings?.default_gemini_voice}
          />
        ) : (
          <RealtimeVoiceChat 
            token={token} 
            onClose={() => setShowVoiceChat(false)}
            onSaveTranscript={saveVoiceTranscript}
            systemPrompt={`You are ${assistantName || 'a helpful AI assistant'} having a voice conversation with ${user?.displayName || user?.email || 'the user'}. Be conversational, natural, and concise. Respond as if you're having a real phone call - be warm and engaging.`}
            userName={user?.displayName || user?.email?.split('@')[0]}
            defaultVoice={user?.profile?.voice_settings?.default_voice}
          />
        )}
        </SafeSection>
      )}

      {/* AI Support Bot Bubble */}
      {token && (
        <SupportBubble 
          token={token}
          conversationId={conversationId}
          recentMessages={messages.slice(-6)}
        />
      )}
    </div>
  );
}
