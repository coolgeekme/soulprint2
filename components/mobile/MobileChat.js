'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, User, ChevronDown, 
  Plus, Settings, X, Check, Loader2, Globe, Sparkles,
  Image as ImageIcon, MoreHorizontal, ArrowLeft,
  Copy, Edit3, ThumbsUp, ThumbsDown, Trash2, MoreVertical,
  Video, Search, ChevronRight, Square, Download, Home, ExternalLink, FileText, RefreshCw,
  Folder, FolderPlus, Share2, Users, Link2, UserPlus, Upload, Sun, Moon, MapPin, AudioWaveform,
  Film, GalleryHorizontal, CheckCircle
} from 'lucide-react';
import SafeMarkdown from '@/components/SafeMarkdown';
import MessageErrorBoundary from '@/components/MessageErrorBoundary';
import SafeSection from '@/components/SafeSection';
import SoulPrintLogo from '@/components/SoulPrintLogo';
import { MicrophoneIcon, SendIcon, SparklesIcon, AttachIcon, CloudUploadIcon } from '@/components/icons/SoulPrintIcons';
import { useTheme } from '@/lib/providers/ThemeProvider';
import { useToast } from '@/hooks/use-toast';

// Extracted components
import { MODELS, ACCEPTED_FILE_TYPES, MAX_FILE_SIZE, IMAGE_MODELS, VIDEO_MODELS, ASPECT_RATIOS } from './mobileConstants';
import useSpeechRecognition from '@/components/chat/useSpeechRecognition';
import { MobileImageCard, MobileVideoCard, MobileSavedVideoCard } from './MobileMediaCards';
import { TabBar, ChatHeader } from './MobileNavigation';
import MessageBubble from './MobileMessageBubble';
import { ConversationItem, ThemeToggle, AttachmentPreview, RenameModal } from './MobileSmallComponents';
import { ProfileView, AnnouncementsView, GalleryView } from './MobileViews';
import { MoreOptionsSheet, CreateOptionsSheet, ImageGenSheet, VideoGenSheet, FlyerGenSheet, CompareModeSheet, CompareResultsView, ImportSheet } from './MobileSheets';
import SupportBubble from '@/components/chat/SupportBubble';


export default function MobileChat({ 
  token, 
  user, 
  assistantName = 'SoulPrint',
  onOpenSettings,
  onOpenVoiceChat,
  initialConversationId = null 
}) {
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingImageUrl, setStreamingImageUrl] = useState(null);
  const [streamingVideoTask, setStreamingVideoTask] = useState(null);
  const [streamingSources, setStreamingSources] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [selectedModel, setSelectedModel] = useState('smart'); // Default to Dynamic Intelligence
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [defaultModelSaved, setDefaultModelSaved] = useState(null); // persisted default
  const [defaultVideoModelSaved, setDefaultVideoModelSaved] = useState('smart');
  const [defaultImageModelSaved, setDefaultImageModelSaved] = useState('smart');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showFlyerGenSheet, setShowFlyerGenSheet] = useState(false);
  const [profile, setProfile] = useState(null);
  const [soulPrint, setSoulPrint] = useState(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [pendingMediaAttachment, setPendingMediaAttachment] = useState(null); // For regeneration with source image
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [lastSmartSelection, setLastSmartSelection] = useState(null); // Track which model Dynamic Intelligence selected
  const [supportNotifications, setSupportNotifications] = useState([]);
  
  // AbortController for stopping requests
  const abortControllerRef = useRef(null);
  const sendingRef = useRef(false); // Synchronous guard against double-sends on mobile
  
  // New state for additional features
  const [showImageGenSheet, setShowImageGenSheet] = useState(false);
  const [showVideoGenSheet, setShowVideoGenSheet] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState('smart');
  const [selectedVideoModel, setSelectedVideoModel] = useState('smart');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('1:1');
  const [mediaPrompt, setMediaPrompt] = useState('');
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  // Visual content generation state (flyers, infographics, images)
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [visualGenerationType, setVisualGenerationType] = useState(''); // 'flyer', 'infographic', 'image'
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingConversation, setRenamingConversation] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [showCompareMode, setShowCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState(['gpt-4o', 'claude-sonnet-4-5-20250929']);
  const [compareResponses, setCompareResponses] = useState(null);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [conversationSearch, setConversationSearch] = useState(''); // For searching conversations
  // PWA Install prompt state
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  // Edit display name state
  const [showEditNameSheet, setShowEditNameSheet] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState('');
  // Onboarding modal state
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Viral invite state
  const [inviteData, setInviteData] = useState(null);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  
  // Projects state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null); // null = show all, 'general' = uncategorized
  const [showProjectSheet, setShowProjectSheet] = useState(false);
  const [projectSheetMode, setProjectSheetMode] = useState('create'); // 'create' | 'edit' | 'share'
  const [editingProject, setEditingProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('collaborator');
  const [projectShareLink, setProjectShareLink] = useState(null);
  const [showMoveToProjectSheet, setShowMoveToProjectSheet] = useState(false);
  const [movingConversation, setMovingConversation] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  
  // Media intent detection state
  const [detectedMediaIntent, setDetectedMediaIntent] = useState(null); // 'image' | 'video' | null
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [mediaOptionsExpanded, setMediaOptionsExpanded] = useState(false); // Advanced options
  const [quickAspectRatio, setQuickAspectRatio] = useState('1:1');
  const [quickVideoLength, setQuickVideoLength] = useState('5');
  
  // iOS Keyboard handling
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Location state
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [locationError, setLocationError] = useState(null);
  
  // Read aloud state
  const [readingAloudId, setReadingAloudId] = useState(null);
  const readAloudAudioRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputContainerRef = useRef(null);

  // ── Global Media Notification System ──
  const { toast } = useToast();
  const notifiedTasksRef = useRef(new Set());
  const mediaPollIntervalRef = useRef(null);
  const conversationIdRef = useRef(conversationId);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  const isStreamingRef = useRef(false); // Track streaming state synchronously for useEffect guards

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
            
            // Show toast notification
            toast({
              title: `🎬 ${task.type === 'image' ? 'Image' : 'Video'} Ready!`,
              description: isInSameConv 
                ? `Your ${task.modelLabel || 'AI'} ${task.type || 'video'} is ready.`
                : `${task.modelLabel || 'AI'} ${task.type || 'video'} ready in "${task.conversationTitle}". Tap to view.`,
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
    
    pollPendingMedia();
    mediaPollIntervalRef.current = setInterval(pollPendingMedia, 8000);
    
    return () => {
      if (mediaPollIntervalRef.current) clearInterval(mediaPollIntervalRef.current);
    };
  }, [token, toast]);

  // Speech recognition
  const speech = useSpeechRecognition({
    token,
    onTranscript: (text) => {
      setInput(prev => (prev ? prev + ' ' + text : text));
      setInterimText('');
    },
    onInterim: (text) => setInterimText(text),
  });

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // iOS/Android Keyboard handling - keep input visible above keyboard
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateInputPosition = () => {
      if (!inputContainerRef.current) return;
      
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        const offsetFromBottom = window.innerHeight - viewport.height - viewport.offsetTop;
        
        if (offsetFromBottom > 100) {
          // Keyboard is open
          setKeyboardVisible(true);
          setKeyboardHeight(offsetFromBottom);
          // Position input at the top of keyboard
          inputContainerRef.current.style.bottom = `${offsetFromBottom}px`;
          inputContainerRef.current.style.zIndex = '9999';
        } else {
          // Keyboard is closed
          setKeyboardVisible(false);
          setKeyboardHeight(0);
          inputContainerRef.current.style.bottom = 'calc(4.5rem + env(safe-area-inset-bottom, 0px))';
          inputContainerRef.current.style.zIndex = '60';
        }
      }
    };
    
    const handleFocus = () => {
      // Small delay to let keyboard animation start
      setTimeout(updateInputPosition, 100);
      setTimeout(updateInputPosition, 300);
    };
    
    const handleBlur = () => {
      setTimeout(() => {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setKeyboardVisible(false);
          setKeyboardHeight(0);
          if (inputContainerRef.current) {
            inputContainerRef.current.style.bottom = 'calc(4.5rem + env(safe-area-inset-bottom, 0px))';
            inputContainerRef.current.style.zIndex = '60';
          }
        }
      }, 100);
    };
    
    const input = inputRef.current;
    if (input) {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
    }
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateInputPosition);
      window.visualViewport.addEventListener('scroll', updateInputPosition);
    }
    
    // Fallback resize handler
    window.addEventListener('resize', updateInputPosition);
    
    return () => {
      if (input) {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateInputPosition);
        window.visualViewport.removeEventListener('scroll', updateInputPosition);
      }
      window.removeEventListener('resize', updateInputPosition);
    };
  }, []);

  // Media intent detection function
  const detectMediaIntent = useCallback((text) => {
    if (!text || text.length > 500) return null;
    const lower = text.toLowerCase().trim();
    
    // Video patterns - check first (more specific)
    const videoPatterns = [
      /\b(generate|create|make|animate)\s+(a\s+)?(video|clip|animation|short film)\b/i,
      /\bvideo\s+of\b/i,
      /\banimate\s+(a|an|the|my|this)?\s*\w/i,
    ];
    if (videoPatterns.some(p => p.test(lower))) return 'video';
    
    // Image patterns
    const imagePatterns = [
      /\b(generate|create|make|draw|paint)\s+(an?\s+)?(image|picture|photo|illustration|artwork|painting)\b/i,
      /\b(show|give)\s+me\s+(an?\s+)?(picture|image|photo)\b/i,
      /\b(picture|photo|image|illustration)\s+of\b/i,
      /\bvisualize\b/i,
      /\bdraw\s+(me\s+)?(a|an|the)?\s*\w/i,
    ];
    if (imagePatterns.some(p => p.test(lower))) return 'image';
    
    return null;
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
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported. Please enter your location manually.');
      setShowLocationSheet(true);
      return;
    }
    
    const isPwaIOS = isIOSPwa();
    setLocationLoading(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          const res = await fetch('/api/user/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
          const data = await res.json();
          if (res.ok) {
            setUserLocation({ lat: latitude, lng: longitude, address: data.address, accuracy });
            setLocationError(null);
            setShowLocationSheet(false);
            // Show confirmation in chat
            setMessages(prev => [...prev, {
              id: `loc-${Date.now()}`, role: 'assistant',
              content: `📍 **Location saved!**\n\n${data.address}\n\nYou can now ask me things like:\n- "Find restaurants near me"\n- "What coffee shops are nearby?"`,
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
        
        // Detect platform for better instructions
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        
        let errorMsg = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            if (isIOS && isPWA) {
              errorMsg = 'Location denied.\n\nFor iOS PWA:\n1. Settings → Privacy → Location Services\n2. Find Safari Websites\n3. Enable "While Using"\n\nOr enter location manually.';
            } else if (isIOS) {
              errorMsg = 'Location denied.\n\nOn iOS:\n1. Settings → Safari → Location\n2. Set to "Ask" or "Allow"\n3. Refresh and retry\n\nOr enter manually.';
            } else if (isAndroid) {
              errorMsg = 'Location denied.\n\nOn Android:\n1. Tap lock icon in address bar\n2. Enable Location permission\n3. Refresh and retry\n\nOr enter manually.';
            } else {
              errorMsg = 'Location denied.\n\nEnable in browser settings or enter manually.';
            }
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Could not detect location.\n\nPoor GPS signal or location services disabled.\n\nEnter location manually.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Location request timed out.\n\nTry again or enter manually.';
            break;
          default:
            errorMsg = 'Could not get location.\n\nEnter manually.';
        }
        
        setLocationError(errorMsg);
        setShowLocationSheet(true);
      },
      { 
        enableHighAccuracy: true, 
        timeout: isPwaIOS ? 15000 : 10000,
        maximumAge: 300000
      }
    );
  }, [token, isIOSPwa]);

  // Save manually entered location
  const saveManualLocation = useCallback(async () => {
    if (!manualLocationInput.trim()) {
      setLocationError('Please enter a location');
      return;
    }
    
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      // Geocode the address
      const res = await fetch('/api/places/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: manualLocationInput.trim() }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.lat && data.lng) {
        // Save the location
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
          setShowLocationSheet(false);
          setManualLocationInput('');
          
          setMessages(prev => [...prev, {
            id: `loc-${Date.now()}`, role: 'assistant',
            content: `📍 **Location saved!**\n\n${data.formattedAddress || manualLocationInput}\n\nYou can now ask for nearby places!`,
            created_at: new Date().toISOString(),
          }]);
        } else {
          setLocationError(saveData.error || 'Failed to save location');
        }
      } else {
        setLocationError('Could not find that location. Please try a different address.');
      }
    } catch (err) {
      console.error('Failed to geocode:', err);
      setLocationError('Failed to look up location. Please try again.');
    }
    
    setLocationLoading(false);
  }, [token, manualLocationInput]);

  // Fetch saved location on mount
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

  // Watch input for media intent
  useEffect(() => {
    const intent = detectMediaIntent(input);
    if (intent !== detectedMediaIntent) {
      setDetectedMediaIntent(intent);
      if (intent) {
        setShowMediaOptions(true);
      }
    }
  }, [input, detectMediaIntent, detectedMediaIntent]);

  // Capture the beforeinstallprompt event for PWA install
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

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

  // Ref to track if initial conversation was auto-selected
  const autoSelectedRef = useRef(false);

  // Load conversations
  useEffect(() => {
    if (!token) return;
    const projectQuery = selectedProject ? `?project_id=${selectedProject}` : '';
    fetch(`/api/conversations${projectQuery}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const convList = Array.isArray(data) ? data : [];
        setConversations(convList);
        
        // Auto-select latest conversation ONLY on first load and if none selected
        if (!autoSelectedRef.current && !conversationId && !initialConversationId && convList.length > 0) {
          const latestConv = convList[0];
          if (latestConv?.id) {
            setConversationId(latestConv.id);
            autoSelectedRef.current = true;
          }
        }
      })
      .catch(console.error);
  }, [token, selectedProject]);
  
  // Load projects
  useEffect(() => {
    if (!token) return;
    setProjectsLoading(true);
    fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        // API returns { owned: [], shared: [], uncategorized_count: n }
        const allProjects = [
          ...(data.owned || []),
          ...(data.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
      })
      .catch(console.error)
      .finally(() => setProjectsLoading(false));
  }, [token]);

  // Load profile
  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.profile) setProfile(data.profile);
        // Load saved default model
        if (data.profile?.default_model) {
          const validModel = MODELS.find(m => m.value === data.profile.default_model && !m.comingSoon);
          if (validModel) {
            setSelectedModel(data.profile.default_model);
            setDefaultModelSaved(data.profile.default_model);
          }
        }
        // Load default video model
        if (data.profile?.default_video_model) {
          const validVideo = VIDEO_MODELS.find(m => m.value === data.profile.default_video_model);
          if (validVideo) {
            setSelectedVideoModel(data.profile.default_video_model);
            setDefaultVideoModelSaved(data.profile.default_video_model);
          }
        }
        // Load default image model
        if (data.profile?.default_image_model) {
          const validImage = IMAGE_MODELS.find(m => m.value === data.profile.default_image_model);
          if (validImage) {
            setSelectedImageModel(data.profile.default_image_model);
            setDefaultImageModelSaved(data.profile.default_image_model);
          }
        }
        // Check if new user (show onboarding if they haven't seen it)
        const hasSeenOnboarding = localStorage.getItem('sp_onboarding_seen');
        if (!hasSeenOnboarding && !data.profile?.onboarding_completed) {
          setShowOnboarding(true);
        }
      })
      .catch(console.error);
  }, [token]);

  // Load announcements (unread list which respects 24h dismiss)
  useEffect(() => {
    if (!token) return;
    fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        // API returns { announcements: [...], unread: [...] }
        // Use unread for display (respects 24h dismiss)
        const unreadList = Array.isArray(data.unread) ? data.unread : [];
        setAnnouncements(unreadList);
      })
      .catch(console.error);
  }, [token]);

  // Fetch support notifications
  useEffect(() => {
    if (!token) return;
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setSupportNotifications(d.notifications || [])).catch(() => {});
  }, [token]);



  // Auto-request location when app loads (if not already set)
  useEffect(() => {
    if (!token) return;
    
    // Check if we already asked this session
    const hasAskedLocation = sessionStorage.getItem('sp_location_asked_mobile');
    if (hasAskedLocation) return;
    
    // Mark that we've asked this session
    sessionStorage.setItem('sp_location_asked_mobile', 'true');
    
    // Check if user already has location saved
    fetch('/api/user/location', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.hasLocation) {
          // User already has location, just set it
          setUserLocation({ lat: data.lat, lng: data.lng, address: data.address });
        } else {
          // Request location automatically (silently - no error messages)
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                  const res = await fetch('/api/user/location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ lat: latitude, lng: longitude }),
                  });
                  const locData = await res.json();
                  if (res.ok) {
                    setUserLocation({ lat: latitude, lng: longitude, address: locData.address });
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
  }, [token]);

  // Load invite data (if viral invites are enabled)
  useEffect(() => {
    if (!token) return;
    fetch('/api/invites', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.enabled) {
          setInviteData(data);
        }
      })
      .catch(console.error);
  }, [token]);

  // Load conversation messages
  // CRITICAL: Skip this effect when `loading` is true to prevent wiping out
  // streaming state. During streaming, the backend creates a new conversation
  // and sends back a new conversationId via SSE meta event. If we reload
  // messages from DB at that point, we'd lose the streaming content because
  // the assistant response hasn't been saved to DB yet.
  useEffect(() => {
    // CRITICAL: Don't reload messages while streaming!
    // When the backend creates a new conversation during streaming, it sends
    // a new conversationId via SSE meta event. This triggers this effect.
    // But the assistant response hasn't been saved to DB yet, so fetching
    // from DB would return only the user message, wiping out streaming state.
    if (loading || isStreamingRef.current) return;
    
    if (!token || !conversationId) {
      const greet = profile?.display_name || user?.profile?.display_name || 'there';
      const customGreeting = profile?.custom_greeting || user?.profile?.custom_greeting;
      
      // Use custom greeting if set, otherwise use default
      const greetingContent = customGreeting 
        ? customGreeting.replace('{name}', greet).replace('{assistant}', assistantName)
        : `Hey ${greet}! I'm ${assistantName}. What's on your mind?`;
      
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: greetingContent,
      }]);
      return;
    }
    
    // Use the same endpoint as desktop: /api/messages?conversationId=
    fetch(`/api/messages?conversationId=${conversationId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        // Process messages to display active variant content
        const msgs = (Array.isArray(data) ? data : []).map(m => {
          if (m.variants && m.variants.length > 1 && m.activeVariant !== undefined) {
            const activeContent = m.variants[m.activeVariant]?.content;
            if (activeContent) return { ...m, content: activeContent };
          }
          return m;
        });
        setMessages(msgs);
      })
      .catch(console.error);
  }, [token, conversationId, assistantName, profile, user]);

  // Process file for attachment
  const processFile = async (file) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|avi|mkv|m4v)$/i);
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDOCX = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   file.name.toLowerCase().endsWith('.docx');
    
    if (isImage) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const originalBase64 = e.target.result;
          
          // Compress images to reduce request payload size
          const img = new window.Image();
          img.onload = () => {
            const MAX_DIM = 1536;
            let { width, height } = img;
            const originalSize = originalBase64.length;
            const needsResize = width > MAX_DIM || height > MAX_DIM;
            const needsCompress = originalSize > 500_000 || needsResize;
            
            if (!needsCompress) {
              const base64 = originalBase64.split(',')[1];
              resolve({ type: 'image', base64, mimeType: file.type, name: file.name });
              return;
            }
            
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
            
            const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const quality = outputType === 'image/jpeg' ? 0.75 : undefined;
            const compressedDataUrl = canvas.toDataURL(outputType, quality);
            const compressedBase64 = compressedDataUrl.split(',')[1];
            
            console.log(`[Mobile:Attach] Compressed ${file.name}: ${Math.round(originalSize/1024)}KB → ${Math.round(compressedBase64.length/1024)}KB (${width}x${height})`);
            resolve({ type: 'image', base64: compressedBase64, mimeType: outputType, name: file.name });
          };
          img.onerror = () => {
            const base64 = originalBase64.split(',')[1];
            resolve({ type: 'image', base64, mimeType: file.type, name: file.name });
          };
          img.src = originalBase64;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else if (isVideo) {
      // Handle video files — convert to base64 so backend can process for frame extraction
      const localUrl = URL.createObjectURL(file);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1]; // Strip data URL prefix
          console.log(`[Mobile:Attach] Video ${file.name}: ${Math.round(file.size/1024)}KB → base64 ${Math.round(base64.length/1024)}KB`);
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
          console.warn(`[Mobile:Attach] Failed to read video ${file.name}, keeping file reference only`);
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
    } else if (isPDF || isDOCX) {
      // Parse PDF/DOCX on the server
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
          resolve({ type: 'document', text: e.target.result?.slice(0, 20000) || '', name: file.name, mimeType: file.type });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setIsProcessingFile(true);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File ${file.name} is too large. Max size is 50MB.`);
        continue;
      }
      try {
        const processed = await processFile(file);
        setAttachments(prev => [...prev, processed]);
      } catch (err) {
        console.error('Error processing file:', err);
        alert(`Failed to process ${file.name}. Please try again.`);
      }
    }
    setIsProcessingFile(false);
    e.target.value = '';
  };

  // Generate media (image or video) with options
  const generateMediaWithOptions = async () => {
    if (!input.trim() || loading) return;
    
    setShowMediaOptions(false);
    setLoading(true);
    
    const content = input.trim();
    const userMessage = { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      content: content,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    // Reset textarea height after sending
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setDetectedMediaIntent(null);
    
    try {
      if (detectedMediaIntent === 'image') {
        // Generate image using selected model
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
            conversationId,
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
        // Generate video using selected model
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
            conversationId,
          }),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Video generation failed');
        
        const modelLabel = VIDEO_MODELS.find(m => m.value === modelToUse)?.label || modelToUse;
        const assistantMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `🎬 Video generation started with ${modelLabel}!\n\n**Prompt:** ${content}\n\nYour video is being generated (1-3 min)...`,
          video_task: { taskId: data.taskId, status: 'generating', prompt: content },
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      const errorMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, ${detectedMediaIntent} generation failed: ${error.message}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Send as regular chat (bypass media detection)
  const sendAsChat = () => {
    setShowMediaOptions(false);
    setDetectedMediaIntent(null);
    sendMessage();
  };

  // Send message
  const sendMessage = async () => {
    if ((!input.trim() && !attachments.length && !pendingMediaAttachment) || loading) return;
    // Synchronous guard to prevent double-sends on mobile (rapid tap / Enter + tap)
    if (sendingRef.current) return;
    sendingRef.current = true;
    
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    
    const content = input.trim();
    
    // Handle pending media attachment for regeneration
    let finalAttachments = [...attachments];
    if (pendingMediaAttachment && pendingMediaAttachment.url) {
      // Convert URL to attachment format for regeneration
      finalAttachments.push({
        type: 'image',
        base64: pendingMediaAttachment.url, // Backend will handle URL vs base64
        mimeType: 'image/jpeg',
        name: 'regeneration-source.jpg',
        isUrlReference: true, // Flag to indicate this is a URL not base64
      });
    }
    
    // Pre-upload large image attachments to reduce chat payload size
    const imageAtts = finalAttachments.filter(a => a.type === 'image' && a.base64 && !a.isUrlReference);
    const totalSize = imageAtts.reduce((sum, a) => sum + (a.base64?.length || 0), 0);
    if (totalSize > 800_000 || imageAtts.length >= 2) {
      console.log(`[Mobile:PreUpload] ${imageAtts.length} images, total ${Math.round(totalSize/1024)}KB — pre-uploading...`);
      try {
        finalAttachments = await Promise.all(finalAttachments.map(async (att) => {
          if (att.type !== 'image' || !att.base64 || att.isUrlReference) return att;
          try {
            const res = await fetch('/api/attachments/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ base64: att.base64, mimeType: att.mimeType, name: att.name }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.url) {
                console.log(`[Mobile:PreUpload] ${att.name} → ${data.url.substring(0, 60)}...`);
                return { ...att, base64: data.url, isUrlReference: true };
              }
            }
            return att;
          } catch (e) { return att; }
        }));
      } catch (e) { console.warn('[Mobile:PreUpload] Failed, sending inline:', e.message); }
    }
    
    const userMessage = { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      content: content || '[Attachment]',
      attachments: finalAttachments.length > 0 ? finalAttachments : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setAttachments([]);
    setPendingMediaAttachment(null); // Clear pending attachment
    setStreamingContent('');
    setStreamingImageUrl(null);
    setStreamingVideoTask(null);
    setStreamingSources([]);
    setLoading(true);
    isStreamingRef.current = true; // Synchronous flag to prevent message reload during streaming
    
    try {
      // Get current model provider
      const currentModel = MODELS.find(m => m.value === selectedModel) || { provider: 'openai' };
      
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: conversationId,
          content: content,
          model: selectedModel,
          provider: currentModel.provider,
          attachments: userMessage.attachments,
          enableWebSearch: webSearchEnabled,
          projectId: selectedProject && selectedProject !== 'general' ? selectedProject : null,
          videoModel: selectedVideoModel !== 'smart' ? selectedVideoModel : null,
          imageModel: selectedImageModel !== 'smart' ? selectedImageModel : null,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send message');
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection error: Unable to read response stream. Please try again.', created_at: new Date().toISOString() }]);
        setLoading(false);
        return;
      }
      const decoder = new TextDecoder();
      let fullContent = '';
      let newConvId = conversationId;
      let buffer = '';
      let actualModelUsed = selectedModel;
      let dynamicIntelligenceReason = null;
      let localStreamingImageUrl = null;
      let localStreamingVideoTask = null;
      let doneMessageId = null;

      while (reader) {
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
              // Capture Dynamic Intelligence selection info
              if (data.smartMode) {
                actualModelUsed = data.selectedModel;
                dynamicIntelligenceReason = data.modelReason;
                setLastSmartSelection({ model: data.selectedModel, reason: data.modelReason });
              }
            } else if (data.type === 'delta') {
              fullContent += data.content;
              setStreamingContent(fullContent);
              
              // Detect if AI is about to generate visual content
              const lowerContent = fullContent.toLowerCase();
              const generatingPhrases = [
                'generating the infographic', 'generate the infographic', 'create the infographic', 'creating the infographic',
                'generating the flyer', 'generate the flyer', 'create the flyer', 'creating the flyer',
                'generating the poster', 'generate the poster', 'create the poster', 'creating the poster',
                'generating this image', 'generate this image', 'creating this image',
                'i\'ll generate', 'i will generate', 'let me generate', 'let me create',
                'hold on for a moment', 'please hold', 'one moment while i',
                'working on your', 'designing your', 'crafting your'
              ];
              const isGeneratingVisualContent = generatingPhrases.some(phrase => lowerContent.includes(phrase));
              
              if (isGeneratingVisualContent && !isGeneratingVisual) {
                let type = 'image';
                if (lowerContent.includes('infographic')) type = 'infographic';
                else if (lowerContent.includes('flyer')) type = 'flyer';
                else if (lowerContent.includes('poster')) type = 'poster';
                setIsGeneratingVisual(true);
                setVisualGenerationType(type);
              }
            } else if (data.type === 'generating_visual') {
              // Backend is generating an image/video - show indicator immediately
              setIsGeneratingVisual(true);
              setVisualGenerationType(data.visualType || 'image');
            } else if (data.type === 'image') {
              // Image generated - store for rendering and update state immediately
              localStreamingImageUrl = data.url;
              setStreamingImageUrl(data.url);
              // Reset visual generation state since image arrived
              setIsGeneratingVisual(false);
              setVisualGenerationType('');
            } else if (data.type === 'image_action') {
              // Tool-based image edit/mockup result – extract URL and show
              const actionResult = data.result;
              if (actionResult?.imageUrl || actionResult?.url) {
                const imgUrl = actionResult.imageUrl || actionResult.url;
                localStreamingImageUrl = imgUrl;
                setStreamingImageUrl(imgUrl);
                setIsGeneratingVisual(false);
                setVisualGenerationType('');
              }
            } else if (data.type === 'video_task') {
              // Video job started — save to state for rendering MobileVideoCard during streaming
              localStreamingVideoTask = { 
                taskId: data.taskId, status: 'generating', prompt: data.prompt, 
                messageId: data.messageId,
                videoModel: data.videoModel, videoModelLabel: data.videoModelLabel, 
                videoModelReason: data.videoModelReason,
                sourceImage: data.sourceImage || undefined,
              };
              setStreamingVideoTask(localStreamingVideoTask);
              // Dismiss the generating_visual animation — MobileVideoCard takes over
              setIsGeneratingVisual(false);
              setVisualGenerationType('');
            } else if (data.type === 'sources') {
              // Received sources from web search
              setStreamingSources(data.sources || []);
            } else if (data.type === 'continuation') {
              // Backend is auto-continuing a truncated response — keep streaming
              console.log(`[Chat] Auto-continuation ${data.count}/${data.max}`);
            } else if (data.type === 'done') {
              // Message complete — capture messageId if present
              if (data.messageId) {
                doneMessageId = data.messageId;
              }
            }
          } catch {}
        }
      }

      if (fullContent) {
        // Clear streaming states FIRST to prevent double rendering
        setStreamingImageUrl(null);
        setStreamingVideoTask(null);
        
        // Use real messageId from backend if available (critical for video PATCH calls)
        const realMsgId = doneMessageId || localStreamingVideoTask?.messageId;
        setMessages(prev => [...prev, {
          id: realMsgId || `a-${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          model_used: actualModelUsed,
          smart_mode: selectedModel === 'smart',
          smart_reason: dynamicIntelligenceReason,
          image_url: localStreamingImageUrl || undefined,
          video_task: localStreamingVideoTask || undefined,
          model_label: localStreamingVideoTask ? (localStreamingVideoTask.videoModelLabel || 'AI Video') : undefined,
          video_model_reason: localStreamingVideoTask?.videoModelReason || undefined,
          sources: streamingSources.length > 0 ? [...streamingSources] : undefined,
        }]);
      }

      setStreamingContent('');
      setStreamingImageUrl(null);
      setStreamingSources([]);
      setStreamingVideoTask(null);
      setIsGeneratingVisual(false);
      setVisualGenerationType('');
      if (newConvId && newConvId !== conversationId) {
        setConversationId(newConvId);
        // Refresh conversations list
        fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => setConversations(Array.isArray(data) ? data : []))
          .catch(console.error);
      }

    } catch (err) {
      // Handle abort gracefully
      if (err.name === 'AbortError') {
        // If there's streaming content, save it as partial response
        if (streamingContent) {
          setMessages(prev => [...prev, {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: streamingContent + '\n\n*(Response stopped)*',
            model_used: selectedModel,
          }]);
          setStreamingContent('');
        }
      } else {
        setMessages(prev => [...prev, {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        }]);
      }
    } finally {
      setLoading(false);
      isStreamingRef.current = false; // Clear streaming flag
      sendingRef.current = false; // Reset double-send guard so next message can be sent
      abortControllerRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Stop ongoing request
  const stopRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      sendingRef.current = false; // Reset double-send guard
      // If there's streaming content, save it
      if (streamingContent) {
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: streamingContent + '\n\n*(Response stopped)*',
          model_used: selectedModel,
        }]);
        setStreamingContent('');
      }
    }
  };


  // Dismiss a support notification
  const dismissSupportNotification = async (notificationId) => {
    setSupportNotifications(prev => prev.filter(n => n.id !== notificationId));
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });
    } catch {}
  };


  // Handle message feedback
  const handleFeedback = async (messageId, feedbackType) => {
    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: messageId, feedback: feedbackType }),
      });
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  // Read message aloud using TTS
  const handleReadAloud = async (content, messageId) => {
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
      
      if (!res.ok) throw new Error('TTS request failed');
      
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
  };

  // Delete conversation
  const deleteConversation = async (id) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) {
        setConversationId(null);
        const greet = profile?.display_name || user?.profile?.display_name || 'there';
        const customGreeting = profile?.custom_greeting || user?.profile?.custom_greeting;
        const greetingContent = customGreeting 
          ? customGreeting.replace('{name}', greet).replace('{assistant}', assistantName)
          : `Hey ${greet}! I'm ${assistantName}. What's on your mind?`;
        
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: greetingContent,
        }]);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // New conversation
  const newConversation = () => {
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
    
    setConversationId(null);
    const greet = profile?.display_name || user?.profile?.display_name || 'there';
    const customGreeting = profile?.custom_greeting || user?.profile?.custom_greeting;
    const greetingContent = customGreeting 
      ? customGreeting.replace('{name}', greet).replace('{assistant}', assistantName)
      : `Hey ${greet}! I'm ${assistantName}. What's on your mind?`;
    
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: greetingContent,
    }]);
    setActiveTab('chat');
  };

  // Load conversation
  const loadConversation = (id) => {
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
    
    setConversationId(id);
    setActiveTab('chat');
  };

  // Rename conversation
  const renameConversation = async () => {
    if (!renamingConversation || !renameTitle.trim()) return;
    try {
      await fetch(`/api/conversations/${renamingConversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: renameTitle.trim() }),
      });
      setConversations(prev => prev.map(c => 
        c.id === renamingConversation.id ? { ...c, title: renameTitle.trim() } : c
      ));
    } catch (err) {
      console.error('Rename error:', err);
    }
    setShowRenameModal(false);
    setRenamingConversation(null);
    setRenameTitle('');
  };

  // Open rename modal
  const openRenameModal = (conv) => {
    setRenamingConversation(conv);
    setRenameTitle(conv.title || '');
    setShowRenameModal(true);
  };

  // Regenerate media with a different model
  // mediaContext can include: { type: 'image'|'video', sourceImageUrl, videoUrl, imageUrl }
  const handleRegenerateWithModel = async (originalPrompt, modelId, mediaContext = {}) => {
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

  // Extend an existing video — send a message that triggers the extend flow
  const handleExtendVideo = ({ videoUrl, videoTaskId, prompt }) => {
    const extendPrompt = prompt || 'Extend this video: continue the scene naturally';
    // Send the extend request directly through the chat stream with mediaFlow
    const sendExtend = async () => {
      try {
        const ctrl = new AbortController();
        setLoading(true);
        setStreamingContent('');
        
        const userMsg = {
          id: `u-${Date.now()}`,
          role: 'user',
          content: `🎬 Extend Video: ${extendPrompt}`,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg]);
        
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            content: extendPrompt,
            conversationId: conversationId,
            model: selectedModel,
            mediaFlow: {
              step: 'confirmed',
              type: 'video_extend',
              finalPrompt: extendPrompt,
              sourceVideoUrl: videoUrl || null,
              sourceVideoTaskId: videoTaskId || null,
            },
          }),
          signal: ctrl.signal,
        });
        
        if (!res.ok) {
          setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Error extending video. Please try again.', created_at: new Date().toISOString() }]);
          setLoading(false);
          return;
        }
        
        const reader = res.body?.getReader();
        if (!reader) { setLoading(false); return; }
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        
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
              if (data.type === 'delta' && data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === 'video_task') {
                setStreamingVideoTask(data);
                setMessages(prev => [...prev.filter(m => m.id !== `e-${Date.now()}`), {
                  id: data.messageId || `v-${Date.now()}`,
                  role: 'assistant',
                  content: fullContent,
                  video_task: { taskId: data.taskId, status: 'generating', prompt: extendPrompt, videoModel: data.videoModel, videoModelLabel: data.videoModelLabel },
                  created_at: new Date().toISOString(),
                }]);
              } else if (data.type === 'done') {
                if (data.conversationId) setConversationId(data.conversationId);
              }
            } catch (e) { /* skip unparseable lines */ }
          }
        }
        
        setStreamingContent('');
        setStreamingVideoTask(null);
        setLoading(false);
      } catch (err) {
        console.error('[MobileExtendVideo] Error:', err.message);
        setLoading(false);
      }
    };
    sendExtend();
  };


  // ─────────────────────────────────────────────────────────────────
  // PROJECT MANAGEMENT FUNCTIONS
  // ─────────────────────────────────────────────────────────────────
  
  // Create a new project
  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: newProjectName.trim(), 
          description: newProjectDescription.trim() 
        }),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects(prev => [{ ...project, is_owner: true, conversation_count: 0 }, ...prev]);
        setShowProjectSheet(false);
        setNewProjectName('');
        setNewProjectDescription('');
      }
    } catch (err) {
      console.error('Create project error:', err);
    }
  };
  
  // Update project
  const updateProject = async () => {
    if (!editingProject || !newProjectName.trim()) return;
    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: newProjectName.trim(), 
          description: newProjectDescription.trim() 
        }),
      });
      if (res.ok) {
        setProjects(prev => prev.map(p => 
          p.id === editingProject.id 
            ? { ...p, name: newProjectName.trim(), description: newProjectDescription.trim() } 
            : p
        ));
        setShowProjectSheet(false);
        setEditingProject(null);
        setNewProjectName('');
        setNewProjectDescription('');
      }
    } catch (err) {
      console.error('Update project error:', err);
    }
  };
  
  // Delete project
  const deleteProject = async (projectId) => {
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
        }
        // Reload conversations since they've been uncategorized
        fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => setConversations(Array.isArray(data) ? data : []));
      }
    } catch (err) {
      console.error('Delete project error:', err);
    }
  };
  
  // Open project edit sheet
  const openEditProjectSheet = (project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectDescription(project.description || '');
    setProjectSheetMode('edit');
    setShowProjectSheet(true);
  };
  
  // Open project share sheet
  const openShareProjectSheet = async (project) => {
    setEditingProject(project);
    setProjectSheetMode('share');
    setShareEmail('');
    setShareRole('collaborator');
    // Fetch share link if exists
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
    setShowProjectSheet(true);
  };
  
  // Share project with user by email
  const shareProjectWithUser = async () => {
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
        // Refresh projects to get updated shared_with
        const projRes = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
        const projData = await projRes.json();
        const allProjects = [
          ...(projData.owned || []),
          ...(projData.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
        // Update editing project too
        const updatedProject = allProjects.find(p => p.id === editingProject.id);
        if (updatedProject) setEditingProject(updatedProject);
      } else {
        alert(data.error || 'Failed to share project');
      }
    } catch (err) {
      console.error('Share project error:', err);
      alert('Failed to share project');
    }
  };
  
  // Copy share link
  const copyShareLink = () => {
    if (!projectShareLink?.code) return;
    const link = `${window.location.origin}/join/${projectShareLink.code}`;
    navigator.clipboard.writeText(link);
    alert('Share link copied!');
  };
  
  // Move conversation to project
  const moveConversationToProject = async (convId, projectId) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/project`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (res.ok) {
        // Refresh conversations
        const projectQuery = selectedProject ? `?project_id=${selectedProject}` : '';
        const convRes = await fetch(`/api/conversations${projectQuery}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await convRes.json();
        setConversations(Array.isArray(data) ? data : []);
        // Also refresh projects to update conversation counts
        const projRes = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
        const projData = await projRes.json();
        const allProjects = [
          ...(projData.owned || []),
          ...(projData.shared || []).map(p => ({ ...p, is_shared: true }))
        ];
        setProjects(allProjects);
      }
    } catch (err) {
      console.error('Move conversation error:', err);
    }
    setShowMoveToProjectSheet(false);
    setMovingConversation(null);
  };
  
  // Open move to project sheet
  const openMoveToProjectSheet = (conv) => {
    setMovingConversation(conv);
    setShowMoveToProjectSheet(true);
  };

  // Handle media generation (image/video)
  const handleMediaGenerate = async (type) => {
    if (!mediaPrompt.trim()) return;
    setIsGeneratingMedia(true);
    
    const model = type === 'image' ? selectedImageModel : selectedVideoModel;
    const placeholderMsg = {
      id: `gen-${Date.now()}`,
      role: 'assistant',
      content: `🎨 Generating ${type}...\n\n**Prompt:** ${mediaPrompt}\n**Model:** ${model}${type === 'image' ? `\n**Aspect:** ${selectedAspectRatio}` : ''}`,
      created_at: new Date().toISOString(),
      is_generating: true,
    };
    setMessages(prev => [...prev, placeholderMsg]);
    setShowImageGenSheet(false);
    setShowVideoGenSheet(false);
    setActiveTab('chat');

    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          type, 
          model, 
          prompt: mediaPrompt, 
          aspectRatio: selectedAspectRatio, 
          conversationId 
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? { ...m, content: `❌ Generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
            : m
        ));
      } else if (data.taskId && !data.url) {
        // Video task - poll for completion
        pollMediaTask(data.taskId, placeholderMsg.id, type, mediaPrompt, model);
      } else if (data.url) {
        // Immediate result (image)
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? {
                ...m,
                content: `✨ ${type === 'image' ? 'Image' : 'Video'} generated!\n\n**Prompt:** ${mediaPrompt}`,
                is_generating: false,
                image_url: type === 'image' ? data.url : undefined,
                video_url: type === 'video' ? data.url : undefined,
                model_used: model,
              }
            : m
        ));
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
      setMediaPrompt('');
    }
  };

  // Handle flyer generation
  const handleFlyerGenerate = async (prompt, aspectRatio, outputFormat) => {
    if (!prompt.trim()) return;
    setIsGeneratingMedia(true);
    
    const placeholderMsg = {
      id: `flyer-${Date.now()}`,
      role: 'assistant',
      content: `📄 Generating flyer...\n\n**Details:** ${prompt.slice(0, 200)}...\n**Format:** ${outputFormat.toUpperCase()}\n**Size:** ${aspectRatio}`,
      created_at: new Date().toISOString(),
      is_generating: true,
    };
    setMessages(prev => [...prev, placeholderMsg]);
    setShowFlyerGenSheet(false);
    setActiveTab('chat');

    try {
      // Use the image generation endpoint with flyer-optimized settings
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          type: 'image', 
          model: 'gpt-image-1', // Use DALL-E 3 / gpt-image-1 for flyers
          prompt: prompt, 
          aspectRatio: aspectRatio === '8.5:11' ? '2:3' : aspectRatio === '11:17' ? '2:3' : aspectRatio === '9:16' ? '9:16' : '1:1',
          conversationId,
          isFlyer: true,
          outputFormat: outputFormat,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? { ...m, content: `❌ Flyer generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
            : m
        ));
      } else if (data.url) {
        // Generate PDF if requested
        let pdfUrl = null;
        if (outputFormat === 'pdf') {
          try {
            const pdfRes = await fetch('/api/media/convert-to-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ imageUrl: data.url, aspectRatio }),
            });
            const pdfData = await pdfRes.json();
            if (pdfRes.ok && pdfData.pdfUrl) {
              pdfUrl = pdfData.pdfUrl;
            }
          } catch (pdfErr) {
            console.error('PDF conversion failed:', pdfErr);
          }
        }

        setMessages(prev => prev.map(m => 
          m.id === placeholderMsg.id 
            ? {
                ...m,
                content: `✨ Flyer generated!\n\n**Details:** ${prompt.slice(0, 150)}...${pdfUrl ? '\n\n📥 PDF version available!' : ''}`,
                is_generating: false,
                image_url: data.url,
                pdf_url: pdfUrl,
                model_used: 'gpt-image-1',
                is_flyer: true,
              }
            : m
        ));
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
  };

  // Poll for video task completion
  const pollMediaTask = async (taskId, msgId, type, prompt, model) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/media/status/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        
        if (data.status === 'completed' && data.url) {
          clearInterval(pollInterval);
          setMessages(prev => prev.map(m => 
            m.id === msgId 
              ? {
                  ...m,
                  content: `✨ ${type === 'image' ? 'Image' : 'Video'} generated!\n\n**Prompt:** ${prompt}`,
                  is_generating: false,
                  video_url: data.url,
                  model_used: model,
                }
              : m
          ));
          loadGallery();
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          setMessages(prev => prev.map(m => 
            m.id === msgId 
              ? { ...m, content: `❌ Generation failed: ${data.error || 'Unknown error'}`, is_generating: false }
              : m
          ));
        }
      } catch (err) {
        clearInterval(pollInterval);
      }
    }, 3000);
    
    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  // Load gallery items
  const loadGallery = async () => {
    try {
      const res = await fetch('/api/media/gallery', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGalleryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Gallery load error:', err);
    }
  };

  // Handle compare mode
  const handleCompare = async () => {
    if (!input.trim() || compareModels.length < 2) return;
    setLoading(true);
    setShowCompareMode(false);
    
    const userMessage = { id: `u-${Date.now()}`, role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    const prompt = input.trim();
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    
    try {
      const responses = await Promise.all(
        compareModels.map(async (model) => {
          const modelInfo = MODELS.find(m => m.value === model) || { provider: 'openai' };
          const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              conversationId,
              content: prompt,
              model,
              provider: modelInfo.provider,
              enableWebSearch: webSearchEnabled,
              projectId: selectedProject && selectedProject !== 'general' ? selectedProject : null,
            }),
          });
          
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';
          let buffer = '';
          
          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.type === 'delta') fullContent += data.content;
              } catch {}
            }
          }
          return { model, content: fullContent };
        })
      );
      
      setCompareResponses(responses);
    } catch (err) {
      console.error('Compare error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Select compare response
  const selectCompareResponse = (response) => {
    setMessages(prev => [...prev, {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: response.content,
      model_used: response.model,
    }]);
    setCompareResponses(null);
  };

  // Handle cloud import with chunked upload for large files
  const handleImport = async (file) => {
    if (!file) return;
    
    setIsImporting(true);
    const fileSizeMB = file.size / (1024 * 1024);
    
    // Warn about very large files
    if (fileSizeMB > 500) {
      const proceed = window.confirm(
        `Your file is ${fileSizeMB.toFixed(0)}MB which will take a while to upload.\n\n` +
        `For faster imports, re-export with ONLY messages selected (no photos/videos).\n\n` +
        `Continue anyway?`
      );
      if (!proceed) {
        setIsImporting(false);
        return;
      }
    }
    
    try {
      // For large files (>10MB), use chunked upload
      if (fileSizeMB > 10) {
        setImportProgress(`Preparing ${fileSizeMB.toFixed(0)}MB file...`);
        
        // Adaptive chunk size based on file size
        // Smaller files: 1MB chunks, Larger files: 2MB chunks
        const CHUNK_SIZE = fileSizeMB > 200 ? 2 * 1024 * 1024 : 1 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const MAX_RETRIES = 5; // More retries for mobile
        
        // Initialize chunked upload
        const initRes = await fetch('/api/data-import/chunked/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            filename: file.name,
            fileSize: file.size,
            totalChunks,
            source: 'auto-detect'
          }),
        });
        
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to initialize upload');
        }
        
        const { uploadId } = await initRes.json();
        
        // Upload chunks with retry logic
        let successfulChunks = 0;
        const startTime = Date.now();
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const progress = Math.round(((i + 1) / totalChunks) * 80);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = successfulChunks > 0 ? (successfulChunks * CHUNK_SIZE) / elapsed / 1024 : 0;
          const remaining = rate > 0 ? Math.round((totalChunks - i) * CHUNK_SIZE / 1024 / rate) : 0;
          
          setImportProgress(
            `Uploading ${progress}%\n` +
            `${remaining > 60 ? Math.round(remaining/60) + ' min' : remaining + 's'} remaining`
          );
          
          let retries = 0;
          let chunkSuccess = false;
          
          while (retries < MAX_RETRIES && !chunkSuccess) {
            try {
              const formData = new FormData();
              formData.append('chunk', chunk);
              formData.append('uploadId', uploadId);
              formData.append('chunkIndex', i.toString());
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
              
              const chunkRes = await fetch('/api/data-import/chunked/chunk', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              
              if (chunkRes.ok) {
                chunkSuccess = true;
                successfulChunks++;
              } else {
                const err = await chunkRes.json().catch(() => ({}));
                throw new Error(err.error || 'Chunk failed');
              }
            } catch (chunkErr) {
              retries++;
              if (chunkErr.name === 'AbortError') {
                setImportProgress(`Slow connection, retrying... (${retries}/${MAX_RETRIES})`);
              } else {
                setImportProgress(`Retry ${retries}/${MAX_RETRIES}...`);
              }
              
              if (retries < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 2000 * retries)); // Longer backoff
              } else {
                throw new Error(
                  `Upload failed at ${progress}%.\n\n` +
                  `Try again on WiFi or with a smaller export file.`
                );
              }
            }
          }
        }
        
        // Complete and process
        setImportProgress('Processing your data...\nThis may take a few minutes');
        const completeRes = await fetch('/api/data-import/chunked/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ uploadId }),
        });
        
        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({}));
          throw new Error(err.error || 'Processing failed');
        }
        
        const result = await completeRes.json();
        
        if (result.success) {
          setImportProgress('Import complete! ✓');
          // Refresh conversations
          const projectQuery = selectedProject ? `?project_id=${selectedProject}` : '';
          fetch(`/api/conversations${projectQuery}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => setConversations(Array.isArray(data) ? data : []));
          
          setTimeout(() => {
            setShowImportSheet(false);
            setIsImporting(false);
            setImportProgress('');
          }, 2000);
        } else {
          throw new Error(result.error || 'Import failed');
        }
        
      } else {
        // Small files: direct upload
        setImportProgress('Uploading file...');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'auto');
        
        const res = await fetch('/api/imports/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed');
        }
        
        if (data.jobId) {
          // Async processing - poll for status
          setImportProgress('Processing your data...');
          
          let attempts = 0;
          const maxAttempts = 60;
          
          const checkStatus = async () => {
            try {
              const statusRes = await fetch(`/api/imports/status?jobId=${data.jobId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const statusData = await statusRes.json();
              
              if (statusData.status === 'completed') {
                setImportProgress('Import complete! ✓');
                const projectQuery = selectedProject ? `?project_id=${selectedProject}` : '';
                fetch(`/api/conversations${projectQuery}`, { headers: { Authorization: `Bearer ${token}` } })
                  .then(r => r.json())
                  .then(data => setConversations(Array.isArray(data) ? data : []));
                
                setTimeout(() => {
                  setShowImportSheet(false);
                  setIsImporting(false);
                  setImportProgress('');
                }, 2000);
                return;
              } else if (statusData.status === 'failed') {
                throw new Error(statusData.error || 'Import processing failed');
              } else if (attempts < maxAttempts) {
                attempts++;
                setImportProgress(`Processing... ${Math.round((attempts/maxAttempts)*100)}%`);
                setTimeout(checkStatus, 2000);
              } else {
                setImportProgress('Processing in background. Check back later!');
                setTimeout(() => {
                  setShowImportSheet(false);
                  setIsImporting(false);
                  setImportProgress('');
                }, 3000);
              }
            } catch (e) {
              setImportProgress('Processing in background!');
              setTimeout(() => {
                setShowImportSheet(false);
                setIsImporting(false);
                setImportProgress('');
              }, 2000);
            }
          };
          
          setTimeout(checkStatus, 2000);
        } else {
          setImportProgress('Upload complete!');
          setTimeout(() => {
            setShowImportSheet(false);
            setIsImporting(false);
            setImportProgress('');
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportProgress('Error: ' + err.message);
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress('');
      }, 3000);
    }
  };

  // Edit message
  const handleEditMessage = async (message, newContent) => {
    if (!newContent.trim()) return;
    
    const editedContent = newContent.trim();
    const editedMsgIndex = messages.findIndex(m => m.id === message.id);
    if (editedMsgIndex === -1) return;
    
    const originalAssistantMsg = messages[editedMsgIndex + 1]?.role === 'assistant' ? messages[editedMsgIndex + 1] : null;
    
    // Initialize variants for user message
    const userVariants = message.variants || [{ content: message.content, created_at: message.created_at }];
    userVariants.push({ content: editedContent, created_at: new Date().toISOString() });
    
    // Initialize variants for assistant message
    let assistantVariants = [];
    if (originalAssistantMsg) {
      assistantVariants = originalAssistantMsg.variants || [{ content: originalAssistantMsg.content, created_at: originalAssistantMsg.created_at, model_used: originalAssistantMsg.model_used }];
    }
    
    // Update messages with variants
    setMessages(prev => prev.map(m => {
      if (m.id === message.id) {
        return { ...m, content: editedContent, variants: userVariants, activeVariant: userVariants.length - 1, pairedMessageId: originalAssistantMsg?.id };
      }
      if (originalAssistantMsg && m.id === originalAssistantMsg.id) {
        return { ...m, variants: assistantVariants, activeVariant: assistantVariants.length - 1, pairedMessageId: message.id, content: '⏳ Generating new response...' };
      }
      return m;
    }));
    setEditingMessage(null);
    setIsLoading(true);
    
    // Save user message variants to DB
    try {
      await fetch(`/api/messages/${message.id}/variants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variants: userVariants, activeVariant: userVariants.length - 1 }),
      });
    } catch (variantErr) {
      console.warn('Failed to save user variants:', variantErr);
    }
    
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
                if (originalAssistantMsg) {
                  setMessages(prev => prev.map(m => 
                    m.id === originalAssistantMsg.id ? { ...m, content: fullContent } : m
                  ));
                }
              } else if (parsed.type === 'image' && parsed.url) {
                imageUrl = parsed.url;
                fullContent += `\n\n![Generated Image](${parsed.url})`;
                if (originalAssistantMsg) {
                  setMessages(prev => prev.map(m => 
                    m.id === originalAssistantMsg.id ? { ...m, content: fullContent, image_url: parsed.url } : m
                  ));
                }
              }
            } catch {}
          }
        }
        
        if (fullContent && originalAssistantMsg) {
          const newVariant = { content: fullContent, created_at: new Date().toISOString(), model_used: selectedModel };
          const updatedVariants = [...assistantVariants, newVariant];
          setMessages(prev => prev.map(m => {
            if (m.id === originalAssistantMsg.id) {
              return { ...m, content: fullContent, variants: updatedVariants, activeVariant: updatedVariants.length - 1, pairedMessageId: message.id, image_url: imageUrl || undefined };
            }
            return m;
          }));
          
          // Persist assistant variants to DB
          fetch(`/api/messages/${originalAssistantMsg.id}/variants`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ variants: updatedVariants, activeVariant: updatedVariants.length - 1 }),
          }).catch(() => {});
        } else if (originalAssistantMsg) {
          // Restore on empty response
          setMessages(prev => prev.map(m => 
            m.id === originalAssistantMsg.id ? { ...m, content: assistantVariants[assistantVariants.length - 1]?.content || originalAssistantMsg.content } : m
          ));
        }
      }
    } catch (err) {
      console.error('Edit error:', err);
      // Restore originals on error
      if (originalAssistantMsg) {
        setMessages(prev => prev.map(m => {
          if (m.id === originalAssistantMsg.id) return { ...m, content: assistantVariants[0]?.content || m.content, activeVariant: 0 };
          if (m.id === message.id) return { ...m, content: userVariants[0]?.content || m.content, activeVariant: 0 };
          return m;
        }));
      }
    }
    setIsLoading(false);
  };

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
      
      return prev.map(m => {
        if (m.id === messageId) {
          return { ...m, content: m.variants[newIndex].content, activeVariant: newIndex, model_used: m.variants[newIndex].model_used || m.model_used };
        }
        if (m.id === msg.pairedMessageId && m.variants?.length > newIndex) {
          return { ...m, content: m.variants[newIndex].content, activeVariant: newIndex, model_used: m.variants[newIndex].model_used || m.model_used };
        }
        return m;
      });
    });
  }

  // Dismiss announcement (24-hour dismiss or permanent)
  const dismissAnnouncement = async (announcementId, permanent = false) => {
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
  };

  // Track announcement click
  const trackAnnouncementClick = (announcementId) => {
    fetch('/api/announcements/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ announcementId }),
    }).catch(() => {});
  };

  // Save display name
  const saveDisplayName = async () => {
    if (!editingDisplayName.trim()) return;
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: editingDisplayName.trim() }),
      });
      setProfile(p => ({ ...p, display_name: editingDisplayName.trim() }));
      setShowEditNameSheet(false);
      setEditingDisplayName('');
    } catch (e) {
      console.error('Failed to update name:', e);
    }
  };

  // Open edit name sheet
  const openEditNameSheet = () => {
    setEditingDisplayName(profile?.display_name || user?.profile?.display_name || '');
    setShowEditNameSheet(true);
  };

  // Group models by provider
  const groupedModels = MODELS.reduce((acc, model) => {
    if (!acc[model.group]) acc[model.group] = [];
    acc[model.group].push(model);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-sp-black text-white">
      {/* Support Notifications Popup */}
      {supportNotifications.length > 0 && (
        <div className="fixed left-2 right-2 z-[60] space-y-2"
          style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
          {supportNotifications.map(notif => (
            <div key={notif.id} className="bg-[#0d1f15] border border-green-500/30 rounded-xl p-3.5 shadow-2xl shadow-green-500/10">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-green-400 font-semibold text-xs mb-1">Issue Resolved</p>
                  <p className="text-gray-300 text-xs leading-relaxed">{notif.message}</p>
                </div>
                <button onClick={() => dismissSupportNotification(notif.id)} className="text-gray-400 hover:text-white active:text-white p-2 -mr-1 -mt-1 min-w-[36px] min-h-[36px] flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={ACCEPTED_FILE_TYPES}
        multiple
        className="hidden"
      />

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div 
          className="flex flex-col bg-sp-black"
          style={{ 
            height: 'calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))',
            minHeight: 'calc(100vh - 4rem - env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* Header takes its natural height */}
          <ChatHeader 
            assistantName={assistantName}
            model={
              selectedModel === 'smart' && selectedVideoModel === 'smart' && selectedImageModel === 'smart'
                ? '🧠 Dynamic Intelligence'
                : [
                    selectedModel !== 'smart' ? (MODELS.find(m => m.value === selectedModel)?.label || selectedModel) : null,
                    selectedImageModel !== 'smart' ? (IMAGE_MODELS.find(m => m.value === selectedImageModel)?.label) : null,
                    selectedVideoModel !== 'smart' ? (VIDEO_MODELS.find(m => m.value === selectedVideoModel)?.label) : null,
                  ].filter(Boolean).join(' · ') + (selectedModel === 'smart' || selectedVideoModel === 'smart' || selectedImageModel === 'smart' ? ' + Auto' : '')
            }
            onModelClick={() => setShowModelPicker(true)}
            isOnline={true}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
            onMoreClick={() => setShowMoreOptions(true)}
            inviteData={inviteData}
            onInviteClick={() => setShowInviteSheet(true)}
          />
          
          {/* Scrollable Messages Area - takes remaining space */}
          <div 
            className="flex-1 overflow-y-auto"
            style={{ 
              paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))',
              paddingBottom: '6rem'  /* Space for fixed input bar */
            }}
          >
            {/* Announcements Banner */}
            {announcements.length > 0 && (
              <div className="px-3 pt-2 pb-1">
              {announcements.slice(0, 2).map(ann => (
                <div 
                  key={ann.id}
                  className={`mb-2 p-3 rounded-xl border ${
                    ann.type === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
                    ann.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                    ann.type === 'update' ? 'bg-blue-500/10 border-blue-500/30' :
                    'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ann.type === 'warning' ? 'bg-orange-500/20' :
                      ann.type === 'success' ? 'bg-green-500/20' :
                      ann.type === 'update' ? 'bg-blue-500/20' :
                      'bg-blue-500/20'
                    }`}>
                      <SparklesIcon className={`w-4 h-4 ${
                        ann.type === 'warning' ? 'text-orange-400' :
                        ann.type === 'success' ? 'text-green-400' :
                        ann.type === 'update' ? 'text-blue-400' :
                        'text-blue-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{ann.title}</p>
                      <p className="text-gray-400 text-xs mt-1">{ann.content}</p>
                      {ann.link && (
                        <a 
                          href={ann.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={() => trackAnnouncementClick(ann.id)}
                          className="text-xs text-blue-400 flex items-center gap-1 mt-2"
                        >
                          Learn more <ChevronRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-white/5">
                    <button 
                      onClick={() => dismissAnnouncement(ann.id, false)} 
                      className="px-3 py-1.5 bg-white/5 text-gray-300 text-xs rounded-lg"
                    >
                      Remind Later
                    </button>
                    <button 
                      onClick={() => dismissAnnouncement(ann.id, true)} 
                      className="px-3 py-1.5 text-gray-500 text-xs rounded-lg"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
            {/* PWA Install Prompt Banner - Mobile */}
            {showInstallPrompt && (
              <div className="px-3 py-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Download className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium">Add to Home Screen</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    Quick access! <span className="text-green-400">Safe shortcut</span>, no download needed.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => handleInstallAction('install')}
                      className="px-2.5 py-1 bg-green-500 text-white text-[10px] font-medium rounded-lg"
                    >
                      Install
                    </button>
                    <button 
                      onClick={() => handleInstallAction('remind_later')}
                      className="px-2.5 py-1 bg-white/5 text-gray-300 text-[10px] rounded-lg"
                    >
                      Later
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => handleInstallAction('dismiss_forever')}
                  className="text-gray-500 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            )}
          
            {/* Messages */}
            <SafeSection name="MobileMessages" fallback={(retry) => (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-3">
                  <p className="text-gray-400 text-sm">Something went wrong.</p>
                  <button onClick={retry} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg">Retry</button>
                </div>
              </div>
            )}>
            <div className="px-2 pb-4">
              {(messages || []).map((msg, idx) => {
                if (!msg) return null;
                return (
                <MessageErrorBoundary key={`eb-${msg.id || idx}`}>
                <MessageBubble 
                  key={msg.id || idx} 
                  message={msg} 
                  isUser={msg.role === 'user'}
                  assistantName={assistantName}
                  onFeedback={handleFeedback}
                  token={token}
                  onRegenerateWith={handleRegenerateWithModel}
                  onExtendVideo={handleExtendVideo}
                  onReadAloud={handleReadAloud}
                  readingAloudId={readingAloudId}
                  onEdit={msg.role === 'user' ? (m) => { setEditingMessage(m); } : undefined}
                  onToggleVariant={toggleVariant}
                  onVideoReady={(messageId, videoUrl) => {
                    setMessages(prev => prev.map(m => 
                      m.id === messageId ? { ...m, video_url: videoUrl } : m
                    ));
                  }}
                />
                </MessageErrorBoundary>
                );
              })}
              
              {/* Streaming message — hide when video is generating (show animation instead) */}
              <MessageErrorBoundary key="mobile-streaming-boundary">
              {streamingContent && !streamingVideoTask && !(isGeneratingVisual && visualGenerationType === 'video') && (
                <MessageBubble 
                  message={{ content: streamingContent }}
                  isUser={false}
                  assistantName={assistantName}
                />
              )}
              
              {/* Live streaming image — shows image immediately when received, hide when done */}
              {streamingImageUrl && loading && (
                <div className="px-4 mb-4">
                  <MobileImageCard url={streamingImageUrl} modelLabel="AI Generated" token={token} />
                </div>
              )}
              
              {/* Live video generation card — shows animation during streaming */}
              {/* ONLY show if no message in the list already has this same taskId (prevents duplicates) */}
              {streamingVideoTask && !messages.some(m => m.video_task?.taskId === streamingVideoTask?.taskId) && (
                <div className="px-4 mb-4">
                  <MobileVideoCard
                    taskId={streamingVideoTask.taskId}
                    prompt={streamingVideoTask.prompt}
                    token={token}
                    initialStatus="generating"
                    modelLabel={streamingVideoTask.videoModelLabel || 'Kling 3.0'}
                    messageId={streamingVideoTask.messageId}
                    sourceImageUrl={streamingVideoTask.sourceImage}
                    onVideoReady={(videoUrl) => {
                      if (streamingVideoTask.messageId) {
                        setMessages(prev => prev.map(m => 
                          m.id === streamingVideoTask.messageId 
                            ? { ...m, video_url: videoUrl, video_task: { ...m.video_task, status: 'success' } } 
                            : m
                        ));
                      }
                      setStreamingVideoTask(null);
                    }}
                    onRegenerateWith={handleRegenerateWithModel}
                  />
                </div>
              )}
              </MessageErrorBoundary>
              
              {/* Loading indicator — hide when video card is showing */}
              {loading && !streamingContent && !streamingVideoTask && (
                <div className="flex justify-start mb-4 px-4">
                  <div className="bg-white/5 rounded-3xl px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Visual Content Generating Indicator — only before video_task arrives */}
              {isGeneratingVisual && !streamingVideoTask && (
                <div className="py-3">
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 p-4">
                    {/* Animated background shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                    
                    {/* Content */}
                    <div className="relative flex items-center gap-3">
                      {/* Animated icon */}
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                        </div>
                        {/* Spinning ring */}
                        <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-purple-500/50 animate-spin" style={{ animationDuration: '2s' }} />
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
                            ? 'This may take 1-3 minutes. Creating cinematic magic!' 
                            : 'This may take 15-30 seconds. We\'re crafting something beautiful!'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress animation */}
                    <div className="mt-3 relative h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full animate-progress" />
                    </div>
                    
                    {/* Progress dots */}
                    <div className="flex justify-center gap-1.5 mt-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>

                    {/* Leave notification hint */}
                    {visualGenerationType === 'video' && (
                      <div className="mt-3 flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                        <span className="text-[10px]">💡</span>
                        <p className="text-[10px] text-cyan-400/70">You can leave this chat — we'll notify you when it's ready.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            </SafeSection>
          </div>
        </div>
      )}
      
      {/* Input Area - FIXED above tab bar (only shown on chat tab) */}
      {activeTab === 'chat' && (
        <div 
          ref={inputContainerRef}
          className="fixed left-0 right-0 bg-sp-black border-t border-white/10 px-3 py-3"
          style={{ 
            bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
            zIndex: 60,
          }}
        >
            {/* Attachment Preview - show uploaded files */}
            {(attachments.length > 0 || isProcessingFile) && (
              <div className="mb-3 px-1 animate-in slide-in-from-bottom-2 duration-200">
                <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center">
                      {isProcessingFile ? (
                        <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-orange-400" />
                      )}
                    </div>
                    <span className="text-orange-400 text-xs font-medium">
                      {isProcessingFile 
                        ? 'Processing file...' 
                        : `${attachments.length} file${attachments.length > 1 ? 's' : ''} attached`}
                    </span>
                  </div>
                  
                  {attachments.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {attachments.map((att, idx) => (
                        <div key={idx} className="relative flex-shrink-0 group">
                          {att.type === 'image' ? (
                            <div className="relative">
                              <img 
                                src={`data:${att.mimeType};base64,${att.base64}`} 
                                alt={att.name} 
                                className="w-20 h-20 object-cover rounded-xl border-2 border-orange-500/40 shadow-lg" 
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl px-1.5 py-1">
                                <span className="text-[9px] text-white truncate block font-medium">{att.name}</span>
                              </div>
                            </div>
                          ) : att.type === 'video' ? (
                            <div className="relative">
                              {att.localUrl ? (
                                <video src={att.localUrl} className="w-20 h-20 object-cover rounded-xl border-2 border-purple-500/40 shadow-lg" muted />
                              ) : (
                                <div className="w-20 h-20 bg-purple-500/10 border-2 border-purple-500/40 rounded-xl flex items-center justify-center">
                                  <Film className="w-6 h-6 text-purple-400" />
                                </div>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl px-1.5 py-1">
                                <span className="text-[9px] text-white truncate block font-medium">🎬 {att.name}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-20 h-20 bg-white/10 border-2 border-orange-500/40 rounded-xl flex flex-col items-center justify-center p-2 shadow-lg">
                              <FileText className="w-6 h-6 text-orange-400" />
                              <span className="text-[9px] text-gray-300 truncate w-full text-center mt-1 font-medium">{att.name}</span>
                            </div>
                          )}
                          <button 
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-[10px] text-orange-300/70 mt-2">
                    Ready to send with your message • Tap × to remove
                  </p>
                </div>
              </div>
            )}

            {/* Media generation handled dynamically through chat - no manual controls needed */}
            
            {/* Interim speech text */}
            {interimText && (
              <div className="text-gray-500 text-sm mb-2 px-2 italic">{interimText}</div>
            )}
            <div className="flex items-end gap-2">
              <button 
                onClick={() => setShowAttachmentSheet(true)}
                className="p-3 text-gray-500 hover:text-orange-400 transition-colors flex-shrink-0"
              >
                <Plus className="w-6 h-6" />
              </button>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl px-4 py-2.5 flex items-end gap-2 min-w-0">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-grow: reset height then expand to content, capped at 40% viewport
                    e.target.style.height = 'auto';
                    const maxH = Math.min(window.innerHeight * 0.4, 320);
                    e.target.style.height = Math.min(e.target.scrollHeight, maxH) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  onFocus={() => {
                    // Scroll into view on focus for iOS
                    setTimeout(() => {
                      inputContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }, 300);
                  }}
                  placeholder="Message..."
                  className="flex-1 bg-transparent text-white text-[16px] placeholder-gray-600 focus:outline-none resize-none min-h-[28px] min-w-0 leading-normal"
                  rows={1}
                  disabled={loading}
                  style={{ fontSize: '16px', lineHeight: '1.4', color: '#ffffff', caretColor: '#ffffff', backgroundColor: 'transparent', WebkitTextFillColor: '#ffffff', maxHeight: '40vh', overflowY: 'auto' }}
                />
                {/* Voice input button */}
                <button 
                  onClick={speech.toggle}
                  title={speech.error || (speech.isListening ? 'Stop recording' : 'Voice input')}
                  className={`p-2 rounded-full transition-all flex-shrink-0 ${
                    speech.isListening 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : speech.error 
                        ? 'text-red-400 hover:text-red-300'
                        : 'text-gray-500 hover:text-orange-400'
                  }`}
                >
                  <MicrophoneIcon className="w-5 h-5" />
                </button>
                {/* Voice conversation button */}
                {onOpenVoiceChat && (
                  <button 
                    onClick={onOpenVoiceChat}
                    title="Voice conversation"
                    className="p-2 rounded-full transition-all flex-shrink-0 text-gray-500 hover:text-green-400"
                  >
                    <AudioWaveform className="w-5 h-5" />
                  </button>
                )}
                {/* Show Stop button when loading, otherwise show Send button */}
                {loading ? (
                  <button 
                    onClick={stopRequest}
                    className="p-2 rounded-full bg-red-500 text-white transition-all animate-pulse flex-shrink-0"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      // If speech is listening, stop it and include interim text
                      if (speech.isListening) {
                        if (interimText) {
                          setInput(prev => (prev ? prev + ' ' + interimText : interimText));
                          setInterimText('');
                        }
                        speech.toggle(); // Stop recording
                        setTimeout(() => sendMessage(), 150);
                        return;
                      }
                      sendMessage();
                    }}
                    disabled={!input.trim() && !attachments.length && !speech.isListening}
                    className={`p-2 rounded-full transition-all flex-shrink-0 ${
                      input.trim() || attachments.length
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/5 text-gray-600'
                    }`}
                  >
                    <SendIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="pt-4 pb-24">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedProject && (
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h1 className="text-xl font-semibold text-white">
                {selectedProject 
                  ? (selectedProject === 'general' 
                      ? 'Uncategorized' 
                      : projects.find(p => p.id === selectedProject)?.name || 'Project')
                  : 'Projects & Chats'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {!selectedProject && (
                <button 
                  onClick={() => {
                    setProjectSheetMode('create');
                    setNewProjectName('');
                    setNewProjectDescription('');
                    setEditingProject(null);
                    setShowProjectSheet(true);
                  }}
                  className="p-2 rounded-full bg-white/5 text-gray-400 hover:bg-white/10"
                  title="New Project"
                >
                  <FolderPlus className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={newConversation}
                className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> New Chat
              </button>
            </div>
          </div>
          
          {/* Search bar */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                placeholder={selectedProject ? "Search conversations..." : "Search projects & chats..."}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500/40 outline-none"
              />
              {conversationSearch && (
                <button
                  onClick={() => setConversationSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="mt-2">
            {!selectedProject ? (
              // Show Projects List
              <>
                {/* Projects */}
                {projects.length > 0 && (
                  <div className="mb-4">
                    <p className="px-4 text-xs text-gray-500 uppercase tracking-wider mb-2">Projects</p>
                    {projects
                      .filter(p => !conversationSearch || p.name.toLowerCase().includes(conversationSearch.toLowerCase()))
                      .map(project => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setSelectedProject(project.id);
                            // Auto-start a new conversation in this project
                            newConversation();
                          }}
                          className="w-full text-left p-4 border-b border-white/5 hover:bg-white/5 active:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <Folder className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm text-white truncate">{project.name}</h3>
                                {project.is_shared && (
                                  <Users className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-gray-500 text-xs truncate mt-0.5">
                                {project.conversation_count || 0} conversations
                                {project.description && ` · ${project.description}`}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          </div>
                        </button>
                      ))}
                  </div>
                )}
                
                {/* Uncategorized */}
                <button
                  onClick={() => setSelectedProject('general')}
                  className="w-full text-left p-4 border-b border-white/5 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-white">Uncategorized</h3>
                      <p className="text-gray-500 text-xs mt-0.5">
                        Chats not in any project
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </div>
                </button>
                
                {/* Recent Conversations (when no search) */}
                {!conversationSearch && conversations.length > 0 && (
                  <div className="mt-4">
                    <p className="px-4 text-xs text-gray-500 uppercase tracking-wider mb-2">Recent Chats</p>
                    {conversations.slice(0, 5).map(conv => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === conversationId}
                        onClick={() => loadConversation(conv.id)}
                        onDelete={deleteConversation}
                        onRename={openRenameModal}
                        onMove={openMoveToProjectSheet}
                      />
                    ))}
                    {conversations.length > 5 && (
                      <button 
                        onClick={() => setSelectedProject('general')}
                        className="w-full p-3 text-center text-orange-400 text-sm hover:bg-white/5"
                      >
                        View all {conversations.length} conversations →
                      </button>
                    )}
                  </div>
                )}
                
                {/* Empty state */}
                {projects.length === 0 && conversations.length === 0 && (
                  <div className="text-center py-12 px-4">
                    <Folder className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No projects or chats yet</p>
                    <button 
                      onClick={newConversation}
                      className="mt-4 text-orange-400 text-sm font-medium"
                    >
                      Start your first chat →
                    </button>
                  </div>
                )}
              </>
            ) : (
              // Show Conversations in Selected Project
              <>
                {/* Project actions (if viewing a specific project, not general) */}
                {selectedProject !== 'general' && (
                  <div className="px-4 pb-3 flex items-center gap-2">
                    <button
                      onClick={() => openEditProjectSheet(projects.find(p => p.id === selectedProject))}
                      className="flex-1 py-2 px-3 rounded-lg bg-white/5 text-gray-300 text-sm flex items-center justify-center gap-2 hover:bg-white/10"
                    >
                      <Edit3 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => openShareProjectSheet(projects.find(p => p.id === selectedProject))}
                      className="flex-1 py-2 px-3 rounded-lg bg-purple-500/20 text-purple-400 text-sm flex items-center justify-center gap-2 hover:bg-purple-500/30"
                    >
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                    <button
                      onClick={() => deleteProject(selectedProject)}
                      className="py-2 px-3 rounded-lg bg-red-500/10 text-red-400 text-sm flex items-center justify-center gap-2 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {/* Conversations list */}
                {conversations.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                      {selectedProject === 'general' ? 'No uncategorized chats' : 'No conversations in this project'}
                    </p>
                    <button 
                      onClick={newConversation}
                      className="mt-4 text-orange-400 text-sm font-medium"
                    >
                      Start a new chat →
                    </button>
                  </div>
                ) : (
                  (() => {
                    const filteredConversations = conversationSearch.trim()
                      ? conversations.filter(c => 
                          (c.title || 'Conversation').toLowerCase().includes(conversationSearch.toLowerCase())
                        )
                      : conversations;
                    
                    return filteredConversations.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <Search className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No matching conversations</p>
                        <button 
                          onClick={() => setConversationSearch('')}
                          className="mt-4 text-orange-400 text-sm font-medium"
                        >
                          Clear search
                        </button>
                      </div>
                    ) : (
                      filteredConversations.map(conv => (
                        <ConversationItem
                          key={conv.id}
                          conversation={conv}
                          isActive={conv.id === conversationId}
                          onClick={() => loadConversation(conv.id)}
                          onDelete={deleteConversation}
                          onRename={openRenameModal}
                          onMove={openMoveToProjectSheet}
                        />
                      ))
                    );
                  })()
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <SafeSection name="MobileProfileView">
        <ProfileView 
          profile={{ 
            ...profile, 
            display_name: profile?.display_name || user?.profile?.display_name || user?.email?.split('@')[0],
            email: user?.email 
          }}
          soulPrint={{
            messageCount: (conversations || []).reduce((sum, c) => sum + (c?.message_count || 0), 0),
            conversationCount: (conversations || []).length,
            daysActive: (conversations || []).length > 0 ? Math.ceil((Date.now() - new Date(conversations[conversations.length - 1]?.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) : 0,
            ...soulPrint
          }}
          onSettingsClick={onOpenSettings}
          isAdmin={user?.role === 'admin' || user?.role === 'superadmin'}
          onAdminClick={() => window.location.href = '/admin'}
          announcements={announcements || []}
          onAnnouncementsClick={() => setShowAnnouncements(true)}
          onEditName={openEditNameSheet}
          inviteData={inviteData}
          onInviteClick={() => setShowInviteSheet(true)}
          onImportClick={() => setShowImportSheet(true)}
        />
        </SafeSection>
      )}

      {/* Edit Display Name Sheet */}
      {showEditNameSheet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowEditNameSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="text-white font-semibold text-lg mb-2">Edit Your Name</h3>
            <p className="text-gray-500 text-sm mb-4">This is how the AI will address you</p>
            <input
              type="text"
              value={editingDisplayName}
              onChange={(e) => setEditingDisplayName(e.target.value)}
              placeholder="Enter your preferred name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white mb-4 focus:border-orange-500/50 outline-none"
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowEditNameSheet(false)}
                className="flex-1 py-3 bg-white/5 text-gray-300 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={saveDisplayName}
                disabled={!editingDisplayName.trim()}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends Sheet */}
      {showInviteSheet && inviteData?.enabled && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowInviteSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">🎟️</span>
              </div>
              <h3 className="text-white font-semibold text-xl mb-1">Invite Friends</h3>
              <p className="text-gray-500 text-sm">Share SoulPrint with people you care about</p>
            </div>
            
            {/* Invites Remaining */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Invites Remaining</span>
                <span className="text-purple-400 font-bold text-2xl">{inviteData.invites_remaining}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${(inviteData.invites_remaining / 5) * 100}%` }}
                />
              </div>
            </div>
            
            {/* Invite Link */}
            <div className="mb-6">
              <label className="text-gray-400 text-xs font-medium mb-2 block">Your Invite Link</label>
              <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inviteData.invite_code}`}
                  className="flex-1 bg-transparent text-white text-sm truncate outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteData.invite_code}`);
                    setInviteCopied(true);
                    setTimeout(() => setInviteCopied(false), 2000);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    inviteCopied 
                      ? 'bg-green-500 text-white' 
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  {inviteCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            
            {/* Invite Code */}
            <div className="mb-6">
              <label className="text-gray-400 text-xs font-medium mb-2 block">Or Share Your Code</label>
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-white font-mono text-2xl tracking-widest">{inviteData.invite_code}</p>
              </div>
            </div>
            
            {/* Share Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                onClick={() => {
                  const text = `Join me on SoulPrint - your personal AI companion! Use my invite link: ${window.location.origin}/invite/${inviteData.invite_code}`;
                  if (navigator.share) {
                    navigator.share({ text });
                  } else {
                    navigator.clipboard.writeText(text);
                    alert('Link copied to clipboard!');
                  }
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
              >
                <span className="text-2xl">📤</span>
                <span className="text-gray-400 text-xs">Share</span>
              </button>
              <button
                onClick={() => {
                  const text = encodeURIComponent(`Join me on SoulPrint! ${window.location.origin}/invite/${inviteData.invite_code}`);
                  window.open(`https://wa.me/?text=${text}`, '_blank');
                }}
                className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
              >
                <span className="text-2xl">💬</span>
                <span className="text-green-400 text-xs">WhatsApp</span>
              </button>
              <button
                onClick={() => {
                  const text = encodeURIComponent(`Join me on SoulPrint - your personal AI companion! ${window.location.origin}/invite/${inviteData.invite_code}`);
                  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
                }}
                className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
              >
                <span className="text-2xl">𝕏</span>
                <span className="text-blue-400 text-xs">Twitter/X</span>
              </button>
            </div>
            
            {/* Badges Section */}
            {inviteData.all_badges?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-gray-400 text-xs font-medium mb-3">Invite Badges</h4>
                <div className="grid grid-cols-2 gap-2">
                  {inviteData.all_badges.map((badge) => {
                    const earned = inviteData.badges?.some(b => b.id === badge.id);
                    return (
                      <div 
                        key={badge.id}
                        className={`p-3 rounded-xl border transition-colors ${
                          earned 
                            ? 'bg-purple-500/10 border-purple-500/30' 
                            : 'bg-white/5 border-white/10 opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{badge.icon}</span>
                          <span className={`text-sm font-medium ${earned ? 'text-purple-400' : 'text-gray-500'}`}>
                            {badge.name}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs">{badge.description}</p>
                        {!earned && (
                          <p className="text-gray-600 text-[10px] mt-1">Invite {badge.threshold} friend{badge.threshold > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* People You've Invited */}
            {inviteData.invited_users?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-gray-400 text-xs font-medium mb-3">People You've Invited ({inviteData.invites_used})</h4>
                <div className="space-y-2">
                  {inviteData.invited_users.map((user, idx) => (
                    <div key={idx} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-400" />
                        </div>
                        <span className="text-white text-sm">{user.email}</span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(user.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Invited By */}
            {inviteData.invited_by && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-xs mb-1">You were invited by</p>
                <p className="text-white font-medium">{inviteData.invited_by.name}</p>
              </div>
            )}
            
            <button 
              onClick={() => setShowInviteSheet(false)}
              className="w-full mt-6 py-3 bg-white/5 text-gray-400 rounded-xl text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Announcements View */}
      <AnnouncementsView
        isOpen={showAnnouncements}
        onClose={() => setShowAnnouncements(false)}
        announcements={announcements}
      />

      {/* Tab Bar */}
      <TabBar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        assistantName={assistantName}
      />

      {/* Model Picker Modal */}
      {showModelPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowModelPicker(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="text-white font-semibold text-lg mb-4">Select Model</h3>
            
            {/* Dynamic Intelligence - Featured at top */}
            <div className="mb-4">
              <button
                onClick={() => { 
                  setSelectedModel('smart'); 
                  setSelectedVideoModel('smart');
                  setSelectedImageModel('smart');
                }}
                className={`w-full p-4 rounded-xl text-left transition-colors ${
                  selectedModel === 'smart'
                    ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/50'
                    : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-semibold text-sm flex items-center gap-2 ${selectedModel === 'smart' ? 'text-purple-400' : 'text-white'}`}>
                      🧠 Dynamic Intelligence
                      {selectedModel === 'smart' && <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full">Active</span>}
                      {defaultModelSaved === 'smart' && <span className="text-[10px] text-green-400">★ default</span>}
                    </span>
                    <p className="text-gray-400 text-xs mt-1">AI automatically picks the best model for your query</p>
                  </div>
                  {selectedModel === 'smart' && defaultModelSaved !== 'smart' && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        fetch('/api/user/profile', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ default_model: 'smart' }),
                        }).then(r => { if (r.ok) { setDefaultModelSaved('smart'); setShowModelPicker(false); } });
                      }}
                      className="text-xs text-gray-500 hover:text-green-400 cursor-pointer transition-colors bg-white/10 px-3 py-1.5 rounded-lg shrink-0"
                    >set default</span>
                  )}
                </div>
                {lastSmartSelection && selectedModel === 'smart' && (
                  <div className="mt-2 text-[10px] text-gray-500">
                    Last used: {lastSmartSelection.model}
                  </div>
                )}
              </button>
            </div>
            
            <div className="border-t border-white/10 my-4"></div>
            
            {Object.entries(groupedModels).filter(([group]) => group !== 'Smart').map(([group, models]) => (
              <div key={group} className="mb-4">
                <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2 px-2">{group}</h4>
                <div className="space-y-1">
                  {models.map(model => (
                    <button
                      key={model.value}
                      onClick={() => { 
                        if (!model.comingSoon) {
                          setSelectedModel(model.value); 
                        }
                      }}
                      disabled={model.comingSoon}
                      className={`w-full p-3 rounded-xl text-left transition-colors flex items-center justify-between ${
                        model.comingSoon 
                          ? 'bg-white/5 opacity-50 cursor-not-allowed'
                          : selectedModel === model.value
                            ? 'bg-orange-500/15 border border-orange-500/30'
                            : 'bg-white/5 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      <span className={`font-medium text-sm ${selectedModel === model.value ? 'text-orange-400' : 'text-white'}`}>
                        {model.label}
                        {defaultModelSaved === model.value && <span className="ml-1.5 text-[10px] text-green-400">★ default</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        {model.comingSoon && (
                          <span className="text-[10px] text-gray-500 bg-white/10 px-2 py-0.5 rounded-full">Soon</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* ── Image Models Section ── */}
            <div className="border-t border-white/10 my-4"></div>
            <div className="mb-4">
              <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2 px-2 flex items-center gap-1.5">
                🎨 Image Generation
                {selectedImageModel === 'smart' && <span className="text-cyan-400/60 normal-case font-normal">Auto</span>}
              </h4>
              <div className="space-y-1">
                {IMAGE_MODELS.filter(m => !m.isSmartMode).map(model => (
                  <button
                    key={model.value}
                    onClick={() => setSelectedImageModel(model.value)}
                    className={`w-full p-3 rounded-xl text-left transition-colors flex items-center justify-between ${
                      selectedImageModel === model.value
                        ? 'bg-pink-500/15 border border-pink-500/30'
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <span className={`font-medium text-sm ${selectedImageModel === model.value ? 'text-pink-400' : 'text-white'}`}>
                        {model.label}
                      </span>
                      <span className="ml-2 text-[10px] text-gray-600">{model.description}</span>
                      {defaultImageModelSaved === model.value && <span className="ml-1.5 text-[10px] text-green-400">★ default</span>}
                    </div>
                    {selectedImageModel === model.value && (
                      <span className="text-pink-400 text-xs">✓</span>
                    )}
                  </button>
                ))}
                <div className="flex items-center gap-2 px-1">
                  {selectedImageModel !== 'smart' && (
                    <button onClick={() => setSelectedImageModel('smart')} className="flex-1 p-2 text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors">
                      Reset to Auto
                    </button>
                  )}
                  {selectedImageModel !== 'smart' && selectedImageModel !== defaultImageModelSaved && (
                    <button onClick={async () => {
                      await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ default_image_model: selectedImageModel }) });
                      setDefaultImageModelSaved(selectedImageModel);
                      toast({ title: '✅ Image Default Saved', description: `${IMAGE_MODELS.find(m => m.value === selectedImageModel)?.label} set as default.`, duration: 2500, className: 'bg-[#1a1f2e] border-green-500/30 text-white' });
                    }} className="flex-1 p-2 text-xs text-pink-400/60 hover:text-pink-400 transition-colors text-right">
                      Set as default
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Video Models Section ── */}
            <div className="mb-4">
              <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2 px-2 flex items-center gap-1.5">
                🎬 Video Generation
                {selectedVideoModel === 'smart' && <span className="text-cyan-400/60 normal-case font-normal">Auto</span>}
              </h4>
              <div className="space-y-1">
                {VIDEO_MODELS.filter(m => !m.isSmartMode).map(model => (
                  <button
                    key={model.value}
                    onClick={() => setSelectedVideoModel(model.value)}
                    className={`w-full p-3 rounded-xl text-left transition-colors flex items-center justify-between ${
                      selectedVideoModel === model.value
                        ? 'bg-blue-500/15 border border-blue-500/30'
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <span className={`font-medium text-sm ${selectedVideoModel === model.value ? 'text-blue-400' : 'text-white'}`}>
                        {model.label}
                      </span>
                      <span className="ml-2 text-[10px] text-gray-600">{model.description}</span>
                      {defaultVideoModelSaved === model.value && <span className="ml-1.5 text-[10px] text-green-400">★ default</span>}
                    </div>
                    {selectedVideoModel === model.value && (
                      <span className="text-blue-400 text-xs">✓</span>
                    )}
                  </button>
                ))}
                <div className="flex items-center gap-2 px-1">
                  {selectedVideoModel !== 'smart' && (
                    <button onClick={() => setSelectedVideoModel('smart')} className="flex-1 p-2 text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors">
                      Reset to Auto
                    </button>
                  )}
                  {selectedVideoModel !== 'smart' && selectedVideoModel !== defaultVideoModelSaved && (
                    <button onClick={async () => {
                      await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ default_video_model: selectedVideoModel }) });
                      setDefaultVideoModelSaved(selectedVideoModel);
                      toast({ title: '✅ Video Default Saved', description: `${VIDEO_MODELS.find(m => m.value === selectedVideoModel)?.label} set as default.`, duration: 2500, className: 'bg-[#1a1f2e] border-green-500/30 text-white' });
                    }} className="flex-1 p-2 text-xs text-blue-400/60 hover:text-blue-400 transition-colors text-right">
                      Set as default
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Save all defaults */}
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
                    description: 'Text, Image, and Video defaults updated.',
                    duration: 3000,
                    className: 'bg-[#1a1f2e] border-green-500/30 text-white',
                  });
                  setShowModelPicker(false);
                } catch (e) {
                  console.error('Failed to save defaults:', e);
                }
              }}
              className="w-full p-3 text-center text-sm font-medium text-gray-500 hover:text-white bg-white/5 rounded-xl transition-colors mb-2"
            >
              💾 Save All as Defaults
            </button>
            <button 
              onClick={() => setShowModelPicker(false)}
              className="w-full mt-2 p-4 text-gray-500 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* More Options Sheet */}
      <MoreOptionsSheet 
        isOpen={showMoreOptions}
        onClose={() => setShowMoreOptions(false)}
        onSettings={onOpenSettings}
      />

      {/* Create Options Sheet (+ button) */}
      <CreateOptionsSheet 
        isOpen={showAttachmentSheet}
        onClose={() => setShowAttachmentSheet(false)}
        onFileSelect={() => fileInputRef.current?.click()}
        onCameraSelect={() => {
          // Create a camera-specific file input
          const cameraInput = document.createElement('input');
          cameraInput.type = 'file';
          cameraInput.accept = 'image/*';
          cameraInput.capture = 'environment';
          cameraInput.onchange = handleFileSelect;
          cameraInput.click();
        }}
        onImageGen={() => setShowImageGenSheet(true)}
        onVideoGen={() => setShowVideoGenSheet(true)}
        onCompare={() => setShowCompareMode(true)}
        onGallery={() => { loadGallery(); setShowGallery(true); }}
        onNewConversation={newConversation}
      />

      {/* Image Generation Sheet */}
      <ImageGenSheet
        isOpen={showImageGenSheet}
        onClose={() => setShowImageGenSheet(false)}
        models={IMAGE_MODELS}
        selectedModel={selectedImageModel}
        onModelChange={setSelectedImageModel}
        aspectRatios={ASPECT_RATIOS}
        selectedAspect={selectedAspectRatio}
        onAspectChange={setSelectedAspectRatio}
        prompt={mediaPrompt}
        onPromptChange={setMediaPrompt}
        onGenerate={handleMediaGenerate}
        isGenerating={isGeneratingMedia}
      />

      {/* Video Generation Sheet */}
      <VideoGenSheet
        isOpen={showVideoGenSheet}
        onClose={() => setShowVideoGenSheet(false)}
        models={VIDEO_MODELS}
        selectedModel={selectedVideoModel}
        onModelChange={setSelectedVideoModel}
        prompt={mediaPrompt}
        onPromptChange={setMediaPrompt}
        onGenerate={handleMediaGenerate}
        isGenerating={isGeneratingMedia}
      />

      {/* Flyer Generation Sheet */}
      <FlyerGenSheet
        isOpen={showFlyerGenSheet}
        onClose={() => setShowFlyerGenSheet(false)}
        onGenerate={handleFlyerGenerate}
        isGenerating={isGeneratingMedia}
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={showRenameModal}
        onClose={() => { setShowRenameModal(false); setRenamingConversation(null); }}
        title={renameTitle}
        onTitleChange={setRenameTitle}
        onSave={renameConversation}
      />

      {/* Gallery View */}
      <GalleryView
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        items={galleryItems}
        token={token}
        onDeleteItem={(deletedId) => {
          setGalleryItems(prev => prev.filter(item => item.id !== deletedId));
        }}
        onRegenerate={() => {
          // Refresh gallery after regeneration
          setTimeout(() => loadGallery(), 2000);
        }}
      />

      {/* Compare Mode Sheet */}
      <CompareModeSheet
        isOpen={showCompareMode}
        onClose={() => setShowCompareMode(false)}
        models={MODELS}
        selectedModels={compareModels}
        onToggleModel={(model) => {
          setCompareModels(prev => 
            prev.includes(model) 
              ? prev.filter(m => m !== model)
              : [...prev, model]
          );
        }}
        onCompare={handleCompare}
      />

      {/* Compare Results View */}
      <CompareResultsView
        responses={compareResponses}
        onSelect={selectCompareResponse}
        onClose={() => setCompareResponses(null)}
      />

      {/* Import Sheet */}
      <ImportSheet
        isOpen={showImportSheet}
        onClose={() => { setShowImportSheet(false); setIsImporting(false); setImportProgress(''); }}
        onImport={handleImport}
        isUploading={isImporting}
        uploadProgress={importProgress}
      />

      {/* Location Sheet - Manual Input */}
      {showLocationSheet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowLocationSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            
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
            <div className="space-y-3">
              <input
                type="text"
                value={manualLocationInput}
                onChange={(e) => setManualLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveManualLocation()}
                placeholder="City, address, or zip code..."
                className="w-full bg-sp-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40"
                autoFocus
              />
              <p className="text-gray-500 text-xs">Example: "San Francisco, CA" or "90210"</p>
              
              {/* Try Again Button */}
              <button
                onClick={() => {
                  setLocationError(null);
                  requestLocation();
                }}
                disabled={locationLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:border-white/20 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${locationLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm">Try automatic location</span>
              </button>
            </div>
            
            {/* Current Location Display */}
            {userLocation && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-gray-400 text-xs mb-1">Current saved location:</p>
                <p className="text-green-400 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {userLocation.address}
                </p>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLocationSheet(false);
                  setManualLocationInput('');
                  setLocationError(null);
                }}
                className="flex-1 py-3 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveManualLocation}
                disabled={locationLoading || !manualLocationInput.trim()}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          </div>
        </div>
      )}

      {/* Project Sheet (Create/Edit/Share) */}
      {showProjectSheet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowProjectSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            
            {projectSheetMode === 'create' && (
              <>
                <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-purple-400" /> New Project
                </h3>
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none resize-none mb-4"
                />
                <button
                  onClick={createProject}
                  disabled={!newProjectName.trim()}
                  className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Create Project
                </button>
              </>
            )}
            
            {projectSheetMode === 'edit' && (
              <>
                <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-orange-400" /> Edit Project
                </h3>
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500/40 outline-none resize-none mb-4"
                />
                <button
                  onClick={updateProject}
                  disabled={!newProjectName.trim()}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Save Changes
                </button>
              </>
            )}
            
            {projectSheetMode === 'share' && (
              <>
                <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-purple-400" /> Share "{editingProject?.name}"
                </h3>
                
                {/* Share link */}
                {projectShareLink?.code && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-purple-400 text-sm mb-2">
                      <Link2 className="w-4 h-4" /> Share Link
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-gray-400 truncate">
                        {window.location.origin}/join/{projectShareLink.code}
                      </code>
                      <button
                        onClick={copyShareLink}
                        className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-400 text-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Invite by email */}
                <p className="text-gray-400 text-sm mb-2">Invite by email</p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="Enter email"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500/40 outline-none"
                  />
                  <select
                    value={shareRole}
                    onChange={(e) => setShareRole(e.target.value)}
                    className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-3 text-white text-sm cursor-pointer"
                  >
                    <option value="viewer" className="bg-[#1a1a1a] text-white">Viewer</option>
                    <option value="collaborator" className="bg-[#1a1a1a] text-white">Collaborator</option>
                  </select>
                </div>
                <button
                  onClick={shareProjectWithUser}
                  disabled={!shareEmail.trim()}
                  className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Send Invite
                </button>
                
                {/* Current members */}
                {editingProject?.shared_with?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-gray-400 text-sm mb-2">Shared with</p>
                    {editingProject.shared_with.map((member, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm">{member.email || member.user_id}</p>
                          <p className="text-gray-500 text-xs capitalize">{member.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Move to Project Sheet */}
      {showMoveToProjectSheet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end" onClick={() => setShowMoveToProjectSheet(false)}>
          <div className="w-full bg-[#141a21] rounded-t-3xl p-6 pb-10 safe-area-bottom animate-slide-up max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
              <Folder className="w-5 h-5 text-purple-400" /> Move to Project
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Moving: "{movingConversation?.title || 'Conversation'}"
            </p>
            
            {/* Project options */}
            <button
              onClick={() => moveConversationToProject(movingConversation.id, null)}
              className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors mb-2 flex items-center gap-3"
            >
              <MessageSquare className="w-5 h-5 text-gray-400" />
              <span className="text-white">Uncategorized</span>
            </button>
            
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => moveConversationToProject(movingConversation.id, project.id)}
                className={`w-full text-left p-4 rounded-xl transition-colors mb-2 flex items-center gap-3 ${
                  movingConversation?.project_id === project.id 
                    ? 'bg-purple-500/20 border border-purple-500/30' 
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <Folder className="w-5 h-5 text-purple-400" />
                <div className="flex-1">
                  <span className="text-white">{project.name}</span>
                  {project.description && (
                    <p className="text-gray-500 text-xs mt-0.5">{project.description}</p>
                  )}
                </div>
                {movingConversation?.project_id === project.id && (
                  <Check className="w-4 h-4 text-purple-400" />
                )}
              </button>
            ))}
            
            {projects.length === 0 && (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm mb-3">No projects yet</p>
                <button
                  onClick={() => {
                    setShowMoveToProjectSheet(false);
                    setProjectSheetMode('create');
                    setShowProjectSheet(true);
                  }}
                  className="text-purple-400 text-sm font-medium"
                >
                  Create your first project →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Onboarding Modal - What is a SoulPrint? */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#111820] border border-white/10 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-[#111820] border-b border-white/10 p-5 text-center">
              <div className="w-14 h-14 mx-auto bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-xl flex items-center justify-center mb-3 border border-orange-500/30">
                <span className="text-2xl">🧬</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Welcome to SoulPrint</h2>
              <p className="text-gray-500 text-xs">Your persistent AI identity layer</p>
            </div>
            
            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-300 leading-relaxed text-center">
                A SoulPrint is your <span className="text-orange-400 font-semibold">persistent AI identity layer</span>.
              </p>
              
              <div className="flex gap-2 justify-center">
                {['Not a chatbot', 'Not a wrapper', 'Not a plugin'].map((text, i) => (
                  <span key={i} className="bg-white/5 rounded-lg px-2 py-1 text-[10px] text-gray-500 line-through border border-white/5">
                    {text}
                  </span>
                ))}
              </div>
              
              <p className="text-gray-400 text-xs leading-relaxed">
                It's a mapped imprint of how you <span className="text-white">think</span>, <span className="text-white">decide</span>, <span className="text-white">react</span>, and <span className="text-white">communicate</span> — embedded into AI so it reflects <em>you</em>.
              </p>
              
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <p className="text-orange-300 font-medium mb-2 text-xs">Your SoulPrint captures:</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Decision style', 'Conflict response', 'Communication cadence', 'Pattern recognition'].map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-orange-500 rounded-full"></span>
                      <span className="text-gray-300 text-[10px]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-sp-black rounded-xl text-xs">
                <span className="text-gray-500">🔄 Most AI resets</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span className="text-orange-400">✨ SoulPrint builds forever</span>
              </div>
              
              <p className="text-center text-xs text-gray-400 pt-2 border-t border-white/10">
                <span className="text-orange-400">In short:</span> The{' '}
                <span className="text-white font-medium">operating system of you</span> — running on AI.
              </p>
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-[#111820] border-t border-white/10 p-4">
              <button
                onClick={() => {
                  localStorage.setItem('sp_onboarding_seen', 'true');
                  setShowOnboarding(false);
                }}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all text-sm"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .safe-area-bottom {
          padding-bottom: max(env(safe-area-inset-bottom, 16px), 16px);
        }
        .safe-area-top {
          padding-top: env(safe-area-inset-top, 0);
        }
        .input-area-bottom {
          bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
        }
        .tab-bar-height {
          height: calc(4rem + env(safe-area-inset-bottom, 0px));
        }
        
        /* Mobile input area base styles */
        .mobile-input-area {
          padding: 12px 16px;
          transition: all 0.2s ease-out;
        }
        
        /* Ensure textarea text is always visible */
        .mobile-input-area textarea {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          overflow-y: auto;
          overflow-x: hidden;
          color: #ffffff !important;
          caret-color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          background-color: transparent !important;
        }
        
        /* When keyboard is visible - ensure input stays above keyboard */
        @supports (height: 100dvh) {
          .mobile-input-area {
            /* Use dynamic viewport units when available */
          }
        }
        
        /* iOS specific: handle visual viewport */
        @supports (-webkit-touch-callout: none) {
          .mobile-input-area {
            /* iOS Safari specific adjustments */
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
        }
        
        /* Universal fix for textarea text visibility on all browsers */
        textarea, input[type="text"], input[type="email"], input[type="password"] {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
          -moz-appearance: none !important;
        }
        textarea::placeholder, input::placeholder {
          color: #4b5563 !important;
          -webkit-text-fill-color: #4b5563 !important;
          opacity: 1 !important;
        }
      `}</style>
      
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
