import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate } from '@/lib/api-utils';

// ── Helper functions for consistent API responses ──
function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}
function err(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ── Extracted handler modules ──────────────────────────────────────────────────
import {
  handleVideoUpload,
  handleVideoAnalyze,
  handleVideoTrim,
  handleVideoTextOverlay,
  handleVideoServe,
  handleVideoDownload,
} from '@/lib/handlers/video-editor';
import {
  VIDEO_MODELS,
  KIE_VIDEO_MODELS,
  parseExplicitVideoModelFromPrompt,
  parseExplicitImageModelFromPrompt,
  extractPromptWithoutModelInstruction,
  detectAspectRatioFromPrompt,
  detectContextImageReference,
  selectVideoModel,
  generateVideoWithModel,
  checkVideoStatus,
} from '@/lib/handlers/video-models';

import {
  SEED_QUESTIONS,
  LAYERED_ASSESSMENT_QUESTIONS,
  calculateCommunicationProfile,
  generateAdaptivePrompt,
  getTraitDescription,
} from '@/lib/handlers/assessment-data';

import {
  extractUrlContent,
  extractUrls,
} from '@/lib/handlers/url-extractor';

import {
  geocodeAddress,
  searchNearbyPlaces,
  getPlaceDetails,
  parseLocationQuery,
  extractPlaceType,
} from '@/lib/handlers/location-services';

import {
  detectGoogleIntent,
  fetchGoogleContextForChat,
  formatGoogleContextForPrompt,
  googleApiCall,
  executeGoogleAction,
  getConnectionByEmail,
  getTokenForAccount,
  userHasGoogleConnected,
} from '@/lib/handlers/google-context';

import {
  handleGetAnnouncements,
  handleDismissAnnouncement,
  handleAnnouncementClick,
  handleRestoreAnnouncement,
  handleGetAppUpdates,
  handleMarkAppUpdatesViewed,
  handleGetInstallPromptStatus,
  handleUpdateInstallPromptStatus,
  checkAndGenerateReleaseNotes,
} from '@/lib/handlers/announcements';

import {
  handleExportUserData,
  handleDeleteUserData,
  handleGetPrivacySettings,
  handleUpdatePrivacySettings,
  handlePurgeChatHistory,
  handlePurgeImportedData,
  handleGetDataUsageSummary,
  handleGetSessions,
  handleRevokeSession,
  handlePurgeMemories,
  handlePurgeAll,
} from '@/lib/handlers/privacy';

import {
  handleGetGradualQuestion,
  handleSubmitGradualAnswer,
  handleSkipGradualQuestion,
  handleGetAssessmentProgress,
  handleGetCommunicationProfile,
  handleGetSoulPrint,
  getAssessmentProgress,
  handleGenerateSoulPrint,
  handleGetAssessmentNudge,
  handleSubmitNudgeAnswer,
  handleNudgeMessageCount,
} from '@/lib/handlers/gradual-assessment';

import {
  handleGetLayeredQuestions,
  handleSubmitLayeredAnswer,
  handleCompleteLayeredAssessment,
  handleGetAssessmentSettings,
  handleLayer3Validation,
  handleGetNextValidation,
} from '@/lib/handlers/layered-assessment';

import {
  handleChunkedUploadInit,
  handleChunkedUploadChunk,
  handleChunkedUploadComplete,
  extractMessagesFromZip,
  extractChatGPTMessages,
  extractFacebookMessages,
  decodeUTF8,
  handleDataImportUpload,
  mergeInsights,
  handleGetDataImports,
  handleDeleteDataImport,
} from '@/lib/handlers/data-import';

import {
  handleChunkedInit,
  handleChunkedChunk,
  extractMemoriesFromImport,
  handleChunkedProcessBatch,
  processChunkedBatch,
  extractChatGPTMessagesFromFile,
  extractFacebookMessagesFromFile,
  handleDirectUpload,
  processDirectUpload,
  handleCloudImport,
  handleCloudBatchImport,
  processCloudBatchImport,
  processCloudImport,
  extractChatGPTMessagesFromBuffer,
  extractFacebookMessagesFromBuffer,
  handleImportStatus,
} from '@/lib/handlers/cloud-import';

import {
  generateInviteCode,
  handleGetUserInvites,
  handleValidateInviteCode,
  handleRedeemInviteCode,
  handleRedeemBetaCode,
  handleValidateBetaCode,
  handleVerifyCaptcha,
  handleSendVerificationEmail,
  handleVerifyEmail,
  generateBetaCode,
  handleValidateBetaCodeV2,
  sendNewUserNotificationEmail,
} from '@/lib/handlers/invites-beta';

import {
  selectBestImageModel,
  selectBestVideoModel,
  selectBestMediaModel,
  handleMediaRecommend,
  handleMediaGenerate,
  handleMediaStatusByTaskId,
  handleMediaStatus,
  processVideoStatus,
  handleMediaPending,
  handleMediaGallery,
  handleDeleteMedia,
  handleSaveToGallery,
  handleSubmitFeedback,
  handleSubmitUserFeedback,
  handleContactForm,
} from '@/lib/handlers/media-intelligence';

import { KIE_IMAGE_MODELS, KIE_CREDIT_TO_USD } from '@/lib/handlers/image-models';

import {
  handleChatCompare,
  handleCompareSelect,
  handleGenerateImage,
  handleGenerateImageKie,
  generateImageWithKie,
  handleGenerateVideo,
  handleVideoStatus,
} from '@/lib/handlers/model-comparison';

import {
  generateShareCode,
  handleGetProjects,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
  handleShareProject,
  handleUnshareProject,
  handleProjectShareLink,
  handleJoinProject,
  handlePublicProjectView,
  handlePublicConversationMessages,
  handleMoveConversationToProject,
  handleGetProjectConversations,
  handleGetTags,
  handleCreateTag,
  handleDeleteTag,
  handleUpdateConversationTags,
  handleGetMessages,
} from '@/lib/handlers/projects-tags';

import {
  extractMemoriesFromMessage,
  saveExtractedMemories,
  getUserMemoriesForPrompt,
  handleGetMemories,
  handleCreateMemory,
  handleUpdateMemory,
  handleDeleteMemory,
  buildSystemPrompt,
  generateProfileMarkdown,
  handleProfileExport,
  handleGetSoulProfile,
  ensureUploadsDir,
} from '@/lib/handlers/memory-system';

// ── Auth handlers (extracted) ──
import {
  handleRegister,
  handleLogin,
  handleFirebaseAuth,
  handleMe,
  handleProfileUpdate,
} from '@/lib/handlers/auth-handlers';

// ── Assessment core (extracted) ──
import {
  handleGetQuestions,
  handleGetProgress,
  handleSubmitAnswer,
  handleAssessmentComplete,
  handleResetAssessment,
} from '@/lib/handlers/assessment-core';

// ── Conversations CRUD (extracted) ──
import {
  handleGetConversations,
  handleCreateConversation,
  handleRenameConversation,
  handleDeleteConversation,
} from '@/lib/handlers/conversations-crud';

// ── Scheduling (extracted) ──
import {
  SOCIAL_PLATFORMS,
  generateSocialPost,
  TIMEZONE_OPTIONS,
  SCHEDULE_TEMPLATES,
  getNextRunAt,
  handleGetSchedules,
  handleCreateSchedule,
  handleUpdateSchedule,
  handleDeleteSchedule,
  handleRunSchedules,
} from '@/lib/handlers/scheduling';

// ── Telegram (extracted) ──
import {
  sendTelegramMessage,
  handleTelegramStatus,
  handleTelegramLink,
  handleTelegramUnlink,
  handleTelegramModel,
  handleTelegramWebhook,
  handleConnectorStub,
} from '@/lib/handlers/telegram-handlers';

// ── Voice, Feature Flags, Misc (extracted) ──
import {
  handleAdminDenyUser,
  categorizeConversationTopic,
  handleGetFeatureFlags,
  handleGetVoiceSettings,
  handleUpdateVoiceSettings,
  handleGetVoiceStats,
  handleTranscribe,
  handleGetModels,
} from '@/lib/handlers/voice-misc';

// ── Blog & Notifications (extracted) ──
import {
  generateSlug,
  handleGetBlogPosts,
  handleGetBlogPost,
  handleGetNotifications,
  handleMarkNotificationsRead,
} from '@/lib/handlers/blog-notifications';

// ── Location handlers (extracted) ──
import {
  handlePlacesSearch,
  handleGeocode,
  handleSaveUserLocation,
  handleGetUserLocation,
  handleSaveUserTimezone,
  handleGetUserTimezone,
} from '@/lib/handlers/location-handlers';

// ── Import extracted (extracted) ──
import {
  handleImportExtracted,
  processExtractedImport,
} from '@/lib/handlers/import-extracted';

// ── Chat cache (shared state) ──
import {
  _systemPromptCache,
  _chatRateLimitCache,
  invalidateSystemPromptCache,
} from '@/lib/handlers/chat-cache';

// ── Document parsing (extracted) ──
import {
  parseDocumentContent,
  handleConvertToPdf,
  handleParseDocument,
  handleImageToJson,
} from '@/lib/handlers/document-parsing';

// ── Image editing (extracted) ──
import {
  handleImageEdit,
  handleCompositeTest,
  handleMockupGenerate,
  handleRealtimeSession,
  handleImageEditInternal,
  handleMockupGenerateInternal,
  handleGeminiComposite,
  handleSmartComposite,
  removeLogoBackground,
  compositeLogoAtPlacement,
} from '@/lib/handlers/image-editing';

// ── Chat stream (extracted) ──
import {
  GOOGLE_TOOLS,
  IMAGE_TOOLS,
  handleChatStream,
} from '@/lib/handlers/chat-stream';

// ── Persona DNA (extracted) ──
import {
  handleGetPersonaProfile,
  handleSavePersonaOverride,
} from '@/lib/handlers/persona-dna';

// ── Import upload (extracted) ──
import {
  handleImportUpload,
  handleGetImports,
} from '@/lib/handlers/import-upload';

import {
  handleAttachmentUpload,
  resolveAttachmentUrl,
} from '@/lib/handlers/attachment-upload';

import {
  handleSupportLogin,
  handleGetTickets,
  handleGetTicket,
  handleCreateTicket,
  handleDiagnoseTicket,
  handleApproveTicketFix,
  handleUpdateTicket,
  handleRespondToTicketUser,
  handleCreateSupportAgent,
  handleGetSupportAgents,
} from '@/lib/handlers/support-tickets';
import {
  handleSupportBotChat,
  handleSupportEscalate,
} from '@/lib/handlers/support-bot';

// ── GitHub Integration (routes handled by /api/github/[...path]/route.js) ──
// GitHub chat command integration for chat-stream
import { processGitHubChatCommand } from '@/lib/handlers/github-integration';

// ══════════════════════════════════════════════════════════════════════════════


export const maxDuration = 300; // 5 minutes max for this route (large file processing)
export const dynamic = 'force-dynamic';

// Allow up to 50MB request body for image uploads
export const fetchCache = 'force-no-store';
export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  // Health check endpoint for deployment/monitoring
  if (pathStr === 'health') {
    // Trigger release notes generation check on health checks (non-blocking)
    checkAndGenerateReleaseNotes().catch(() => {});
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { status: 200 });
  }

  try {
    // Trigger auto-release-notes check on first request (non-blocking)
    checkAndGenerateReleaseNotes().catch(() => {});

    // ── PUBLIC ROUTES (no auth required) ──────────────────────────────────
    // Public project view: GET /api/public/project/:shareCode
    if (pathStr.match(/^public\/project\/[^\/]+$/) && pathArr.length === 3) {
      return handlePublicProjectView(request, pathArr[2]);
    }
    // Public conversation messages: GET /api/public/project/:shareCode/conversation/:convId
    if (pathStr.match(/^public\/project\/[^\/]+\/conversation\/[^\/]+$/) && pathArr.length === 5) {
      return handlePublicConversationMessages(request, pathArr[2], pathArr[4]);
    }

    if (pathStr === 'auth/me') return handleMe(request);
    
    // Support ticket GET routes
    if (pathStr === 'support/tickets') return handleGetTickets(request);
    if (pathStr.match(/^support\/tickets\/[a-f0-9-]+$/)) {
      const ticketId = pathStr.split('/')[2];
      return handleGetTicket(request, ticketId);
    }
    if (pathStr === 'assessment/questions') return handleGetQuestions(request);
    if (pathStr === 'assessment/progress') return handleGetProgress(request);
    if (pathStr === 'assessment/layered/questions') return handleGetLayeredQuestions(request);
    if (pathStr === 'assessment/settings') return handleGetAssessmentSettings(request);
    if (pathStr === 'assessment/validation/next') return handleGetNextValidation(request);
    if (pathStr === 'assessment/gradual/next') return handleGetGradualQuestion(request);
    if (pathStr === 'assessment/gradual/progress') return handleGetAssessmentProgress(request);
    if (pathStr === 'assessment/nudge') return handleGetAssessmentNudge(request);
    if (pathStr === 'profile/communication') return handleGetCommunicationProfile(request);
    if (pathStr === 'profile/soulprint') return handleGetSoulPrint(request);
    if (pathStr === 'persona/profile') {
      const result = await handleGetPersonaProfile(request);
      if (result.error) return err(result.error, result.status || 400);
      return ok(result);
    }
    if (pathStr === 'privacy/settings') return handleGetPrivacySettings(request);
    if (pathStr === 'privacy/export') return handleExportUserData(request);
    if (pathStr === 'privacy/data-usage') return handleGetDataUsageSummary(request);
    if (pathStr === 'privacy/sessions') return handleGetSessions(request);
    if (pathStr === 'blog/posts') return handleGetBlogPosts(request);
    if (pathStr.startsWith('blog/posts/')) {
      const slug = pathArr[2];
      return handleGetBlogPost(request, slug);
    }
    if (pathStr === 'conversations') return handleGetConversations(request);
    if (pathStr === 'messages') return handleGetMessages(request);
    if (pathStr === 'notifications') return handleGetNotifications(request);
    
    // Projects & Tags routes
    if (pathStr === 'projects') return handleGetProjects(request);
    if (pathStr.startsWith('projects/') && pathArr[1] === 'conversations') {
      const projectId = pathArr[0].replace('projects/', '');
      return handleGetProjectConversations(request, pathArr[1]);
    }
    if (pathStr.match(/^projects\/[^\/]+\/conversations$/)) {
      const projectId = pathArr[1];
      return handleGetProjectConversations(request, projectId);
    }
    if (pathStr === 'tags') return handleGetTags(request);
    
    if (pathStr === 'imports') return handleGetImports(request);
    if (pathStr === 'import/data') return handleGetImports(request);
    if (pathStr === 'models') return handleGetModels(request);
    if (pathStr.startsWith('generate/video/')) {
      const taskId = pathArr[2];
      return handleVideoStatus(request, taskId);
    }
    if (pathStr === 'schedules') return handleGetSchedules(request);
    if (pathStr === 'schedules/templates') return ok(SCHEDULE_TEMPLATES);
    if (pathStr === 'memories') return handleGetMemories(request);
    
    // Aliases for user/* prefixed routes (frontend compatibility)
    if (pathStr === 'user/memories') return handleGetMemories(request);
    if (pathStr === 'user/profile') return handleMe(request);
    if (pathStr === 'user/profile/soul') return handleGetSoulProfile(request);
    if (pathStr === 'user/profile/export') return handleProfileExport(request);
    if (pathStr === 'user/voice-settings') return handleGetVoiceSettings(request);
    if (pathStr === 'user/voice-stats') return handleGetVoiceStats(request);

    // ── Video Editor GET Routes ──
    if (pathStr.match(/^video\/serve\/[^\/]+$/)) {
      return handleVideoServe(request, pathArr[2]);
    }
    if (pathStr.match(/^video\/download\/[^\/]+$/)) {
      return handleVideoDownload(request, pathArr[2]);
    }

    // Admin routes
    // Admin user details: admin/users/:userId
    if (pathStr === 'user/location') return handleGetUserLocation(request);
    if (pathStr === 'user/timezone') return handleGetUserTimezone(request);
    if (pathStr === 'feature-flags') return handleGetFeatureFlags(request);
    if (pathStr === 'data-imports') return handleGetDataImports(request);
    if (pathStr === 'profile/export') return handleProfileExport(request);
    if (pathStr === 'profile/soul') return handleGetSoulProfile(request);
    if (pathStr === 'announcements') return handleGetAnnouncements(request);
    if (pathStr === 'app-updates') return handleGetAppUpdates(request);
    if (pathStr === 'media/gallery') return handleMediaGallery(request);
    if (pathStr === 'media/pending') return handleMediaPending(request);
    if (pathStr === 'media/status') return handleMediaStatus(request);
    if (pathStr.startsWith('media/status/')) {
      // Support /api/media/status/:taskId format
      const taskId = pathStr.replace('media/status/', '');
      return handleMediaStatusByTaskId(request, taskId);
    }
    if (pathStr.startsWith('media/video/status/')) {
      // Support /api/media/video/status/:taskId format (desktop VideoCard)
      const taskId = pathStr.replace('media/video/status/', '');
      return handleMediaStatusByTaskId(request, taskId);
    }
    // ── Media Download Proxy — serves files with Content-Disposition: attachment ──
    // Needed because mobile browsers ignore <a download> for cross-origin URLs.
    if (pathStr === 'media/download') {
      const { searchParams } = new URL(request.url);
      const fileUrl = searchParams.get('url');
      if (!fileUrl) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
      try {
        const upstream = await fetch(fileUrl, { headers: { 'User-Agent': 'SoulPrint/1.0' } });
        if (!upstream.ok) return NextResponse.json({ error: 'Failed to fetch file' }, { status: 502 });
        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        const isVideo = contentType.includes('video') || fileUrl.match(/\.(mp4|mov|webm|avi)(\?|$)/i);
        const isImage = contentType.includes('image') || fileUrl.match(/\.(png|jpg|jpeg|webp|gif)(\?|$)/i);
        const ext = isVideo ? 'mp4' : isImage ? (fileUrl.match(/\.(png|jpg|jpeg|webp|gif)/i)?.[1] || 'png') : 'bin';
        const filename = `soulprint-${isVideo ? 'video' : 'image'}-${Date.now()}.${ext}`;
        const body = await upstream.arrayBuffer();
        return new Response(body, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': body.byteLength.toString(),
            'Cache-Control': 'no-cache',
          },
        });
      } catch (e) {
        return NextResponse.json({ error: 'Download failed: ' + e.message }, { status: 500 });
      }
    }
    // Active video jobs for a conversation (for persistent progress indicators)
    if (pathStr.startsWith('video/active/')) {
      const convId = pathStr.replace('video/active/', '');
      try {
        const db = await getDb();
        const activeJobs = await db.collection('video_jobs').find({
          conversation_id: convId,
          status: { $in: ['generating', 'processing', 'queued'] },
          created_at: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Last 15 minutes
        }).sort({ created_at: -1 }).limit(5).toArray();
        return NextResponse.json({ jobs: activeJobs.map(j => ({
          taskId: j.task_id, status: j.status, prompt: j.prompt,
          model: j.model, messageId: j.message_id, sourceImage: j.source_image,
          type: j.type, createdAt: j.created_at,
        })) });
      } catch (e) {
        return NextResponse.json({ jobs: [] });
      }
    }
    if (pathStr === 'media/recommend') return handleMediaRecommend(request);
    if (pathStr === 'imports/status') return handleImportStatus(request);
    if (pathStr === 'pwa/install-status') return handleGetInstallPromptStatus(request);
    
    // Viral invite routes
    if (pathStr === 'invites') return handleGetUserInvites(request);
    
    // Voice sessions (admin)

    // Google OAuth & API routes
    if (pathStr === 'auth/google/callback') return handleGoogleAuthCallback(request);
    if (pathStr === 'google/status') return handleGoogleStatus(request);
    
    // Telegram routes
    if (pathStr === 'telegram/status') return handleTelegramStatus(request);
    
    if (pathStr === 'google/gmail/messages') return handleGmailList(request);
    if (pathStr.match(/^google\/gmail\/messages\/[^\/]+$/)) {
      const messageId = pathArr[3];
      return handleGmailGet(request, messageId);
    }
    if (pathStr === 'google/calendar/events') return handleCalendarList(request);
    if (pathStr === 'google/drive/files') return handleDriveList(request);
    if (pathStr.match(/^google\/drive\/files\/[^\/]+$/)) {
      const fileId = pathArr[3];
      return handleDriveGet(request, fileId);
    }

    return err('Not found', 404);
  } catch (error) {
    console.error('GET error:', error);
    return err(error.message, 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Slack webhook endpoints (no auth required)
    
    if (pathStr === 'auth/register') return handleRegister(request);
    if (pathStr === 'auth/login') return handleLogin(request);
    if (pathStr === 'auth/firebase') return handleFirebaseAuth(request);
    if (pathStr === 'auth/redeem-code') return handleRedeemBetaCode(request);
    if (pathStr === 'auth/validate-code') return handleValidateBetaCode(request);
    if (pathStr === 'auth/verify-captcha') return handleVerifyCaptcha(request);
    if (pathStr === 'auth/send-verification') return handleSendVerificationEmail(request);
    if (pathStr === 'auth/verify-email') return handleVerifyEmail(request);
    if (pathStr === 'assessment/answer') return handleSubmitAnswer(request);
    if (pathStr === 'assessment/complete') return handleAssessmentComplete(request);
    if (pathStr === 'assessment/layered/answer') return handleSubmitLayeredAnswer(request);
    if (pathStr === 'assessment/layered/complete') return handleCompleteLayeredAssessment(request);
    if (pathStr === 'assessment/validation/submit') return handleLayer3Validation(request);
    if (pathStr === 'conversations') return handleCreateConversation(request);
    
    // Projects & Tags POST routes
    if (pathStr === 'projects') return handleCreateProject(request);
    if (pathStr === 'projects/join') return handleJoinProject(request);
    if (pathStr.match(/^projects\/[^\/]+\/share$/)) {
      const projectId = pathArr[1];
      return handleShareProject(request, projectId);
    }
    if (pathStr.match(/^projects\/[^\/]+\/unshare$/)) {
      const projectId = pathArr[1];
      return handleUnshareProject(request, projectId);
    }
    if (pathStr.match(/^projects\/[^\/]+\/share-link$/)) {
      const projectId = pathArr[1];
      return handleProjectShareLink(request, projectId);
    }
    if (pathStr.match(/^conversations\/[^\/]+\/project$/)) {
      const conversationId = pathArr[1];
      return handleMoveConversationToProject(request, conversationId);
    }
    if (pathStr.match(/^conversations\/[^\/]+\/tags$/)) {
      const conversationId = pathArr[1];
      return handleUpdateConversationTags(request, conversationId);
    }
    if (pathStr === 'tags') return handleCreateTag(request);
    if (pathStr === 'notifications/mark-read') return handleMarkNotificationsRead(request);
    
    if (pathStr === 'attachments/upload') return handleAttachmentUpload(request);
    
    // Support ticket routes
    if (pathStr === 'support/login') return handleSupportLogin(request);
    if (pathStr === 'support/bot-chat') return handleSupportBotChat(request);
    if (pathStr === 'support/escalate') return handleSupportEscalate(request);
    if (pathStr === 'support/tickets') return handleCreateTicket(request);
    if (pathStr.match(/^support\/tickets\/[^/]+\/diagnose$/)) {
      const ticketId = pathStr.split('/')[2];
      return handleDiagnoseTicket(request, ticketId);
    }
    if (pathStr.match(/^support\/tickets\/[^/]+\/approve-fix$/)) {
      const ticketId = pathStr.split('/')[2];
      return handleApproveTicketFix(request, ticketId);
    }
    if (pathStr.match(/^support\/tickets\/[^/]+\/respond$/)) {
      const ticketId = pathStr.split('/')[2];
      return handleRespondToTicketUser(request, ticketId);
    }
    
    if (pathStr === 'chat/stream') return handleChatStream(request);
    if (pathStr === 'chat/compare') return handleChatCompare(request);
    if (pathStr === 'chat/compare/select') return handleCompareSelect(request);
    if (pathStr === 'feedback') return handleSubmitFeedback(request);
    if (pathStr === 'user-feedback') return handleSubmitUserFeedback(request);
    if (pathStr === 'generate/image') return handleGenerateImage(request);
    if (pathStr === 'generate/image-kie') return handleGenerateImageKie(request);
    if (pathStr === 'generate/video') return handleGenerateVideo(request);
    if (pathStr === 'media/generate') return handleMediaGenerate(request);
    if (pathStr === 'media/save-to-gallery') return handleSaveToGallery(request);
    if (pathStr === 'media/convert-to-pdf') return handleConvertToPdf(request);
    if (pathStr === 'parse/document') return handleParseDocument(request);
    if (pathStr === 'analyze/image-to-json') return handleImageToJson(request);
    if (pathStr === 'image/edit') return handleImageEdit(request);
    if (pathStr === 'imports/upload') return handleImportUpload(request);
    if (pathStr === 'import/data') return handleImportUpload(request);
    if (pathStr === 'import/chatgpt') return handleImportUpload(request); // Alias for mobile compatibility
    if (pathStr === 'imports/cloud') return handleCloudImport(request);
    if (pathStr === 'imports/cloud-batch') return handleCloudBatchImport(request);
    if (pathStr === 'imports/direct') return handleDirectUpload(request);
    if (pathStr === 'imports/chunked/init') return handleChunkedInit(request);
    if (pathStr === 'imports/chunked/chunk') return handleChunkedChunk(request);
    if (pathStr === 'imports/chunked/process-batch') return handleChunkedProcessBatch(request);
    if (pathStr === 'imports/extracted') return handleImportExtracted(request);
    if (pathStr === 'transcribe') return handleTranscribe(request);
    if (pathStr === 'realtime/session') return handleRealtimeSession(request);
    
    // Voice Chat APIs
    if (pathStr === 'test/google-connections') return handleTestGoogleConnections(request);
    
    if (pathStr === 'schedules') return handleCreateSchedule(request);
    if (pathStr === 'cron/run-schedules') return handleRunSchedules(request);
    if (pathStr === 'places/search') return handlePlacesSearch(request);
    if (pathStr === 'profile/soulprint/generate') return handleGenerateSoulPrint(request);
    if (pathStr === 'privacy/purge-chats') return handlePurgeChatHistory(request);
    if (pathStr === 'privacy/purge-imports') return handlePurgeImportedData(request);
    if (pathStr === 'privacy/purge-memories') return handlePurgeMemories(request);
    if (pathStr === 'privacy/purge-all') return handlePurgeAll(request);
    
    // ── Video Editor Routes ──
    if (pathStr === 'video/upload') return handleVideoUpload(request);
    if (pathStr === 'video/analyze') return handleVideoAnalyze(request);
    if (pathStr === 'video/trim') return handleVideoTrim(request);
    if (pathStr === 'video/text-overlay') return handleVideoTextOverlay(request);
    if (pathStr === 'privacy/settings') return handleUpdatePrivacySettings(request);
    if (pathStr === 'privacy/delete-account') return handleDeleteUserData(request);
    if (pathStr === 'privacy/revoke-session') return handleRevokeSession(request);
    if (pathStr === 'places/geocode') return handleGeocode(request);
    if (pathStr === 'user/location') return handleSaveUserLocation(request);
    if (pathStr === 'user/timezone') return handleSaveUserTimezone(request);
    if (pathStr === 'data-import/upload') return handleDataImportUpload(request);
    if (pathStr === 'data-import/chunked/init') return handleChunkedUploadInit(request);
    if (pathStr === 'data-import/chunked/chunk') return handleChunkedUploadChunk(request);
    if (pathStr === 'data-import/chunked/complete') return handleChunkedUploadComplete(request);
    if (pathStr === 'assessment/reset') return handleResetAssessment(request);
    if (pathStr === 'memories') return handleCreateMemory(request);
    if (pathStr === 'user/memories') return handleCreateMemory(request);
    if (pathStr === 'contact') return handleContactForm(request);
    
    // Error reporting endpoint
    if (pathStr === 'error-report') {
      try {
        const body = await request.json();
        console.error('[FRONTEND CRASH REPORT]', JSON.stringify(body));
        return ok({ received: true });
      } catch (e) {
        return ok({ received: true });
      }
    }

    // Admin routes
    if (pathStr === 'app-updates/mark-viewed') return handleMarkAppUpdatesViewed(request);
    if (pathStr === 'beta-code/validate-v2') return handleValidateBetaCodeV2(request);
    if (pathStr === 'announcements/dismiss') return handleDismissAnnouncement(request);
    if (pathStr === 'announcements/click') return handleAnnouncementClick(request);
    if (pathStr === 'announcements/restore') return handleRestoreAnnouncement(request);
    if (pathStr === 'pwa/install-status') return handleUpdateInstallPromptStatus(request);
    if (pathStr === 'assessment/gradual/answer') return handleSubmitGradualAnswer(request);
    if (pathStr === 'assessment/gradual/skip') return handleSkipGradualQuestion(request);
    if (pathStr === 'assessment/nudge/answer') return handleSubmitNudgeAnswer(request);
    if (pathStr === 'assessment/nudge/message') return handleNudgeMessageCount(request);
    
    // Viral invite routes
    if (pathStr === 'invites/validate') return handleValidateInviteCode(request);
    if (pathStr === 'invites/redeem') return handleRedeemInviteCode(request);

    // Persona DNA
    if (pathStr === 'persona/override') {
      const result = await handleSavePersonaOverride(request);
      if (result.error) return err(result.error, result.status || 400);
      return ok(result);
    }

    // Other connector stubs
    if (pathStr === 'connectors/discord/webhook') return handleConnectorStub('discord');
    if (pathStr === 'connectors/whatsapp/webhook') return handleConnectorStub('whatsapp');
    if (pathStr === 'connectors/sms/webhook') return handleConnectorStub('sms');
    
    // Telegram routes
    if (pathStr === 'telegram/link') return handleTelegramLink(request);
    if (pathStr === 'telegram/unlink') return handleTelegramUnlink(request);
    if (pathStr === 'telegram/webhook') return handleTelegramWebhook(request);

    // Google OAuth & API routes
    if (pathStr === 'auth/google') return handleGoogleAuthStart(request);
    if (pathStr === 'google/disconnect') return handleGoogleDisconnect(request);
    if (pathStr === 'google/set-default') return handleGoogleSetDefault(request);
    if (pathStr === 'google/update-calendars') return handleGoogleUpdateCalendars(request);
    if (pathStr === 'google/refresh-calendars') return handleGoogleRefreshCalendars(request);
    if (pathStr === 'google/gmail/send') return handleGmailSend(request);
    if (pathStr === 'google/calendar/events') return handleCalendarCreate(request);
    if (pathStr === 'google/drive/search') return handleDriveSearch(request);
    
    // Mockup generation
    if (pathStr === 'mockup/generate') return handleMockupGenerate(request);
    
    // Smart Composite test endpoint
    if (pathStr === 'composite/test') return handleCompositeTest(request);

    return err('Not found', 404);
  } catch (error) {
    console.error('POST error:', error);
    return err(error.message, 500);
  }
}

export async function PUT(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'profile') return handleProfileUpdate(request);
    if (pathStr === 'user/profile') return handleProfileUpdate(request);
    
    // Conversation project move: conversations/:id/project
    if (pathStr.match(/^conversations\/[^\/]+\/project$/)) {
      const conversationId = pathArr[1];
      return handleMoveConversationToProject(request, conversationId);
    }
    
    // Conversation rename: conversations/:id
    if (pathStr.startsWith('conversations/') && pathArr.length === 2) {
      const conversationId = pathArr[1];
      return handleRenameConversation(request, conversationId);
    }
    if (pathStr.startsWith('schedules/') && pathArr.length === 2) {
      const taskId = pathArr[1];
      return handleUpdateSchedule(request, taskId);
    }
    if (pathStr.startsWith('memories/') && pathArr.length === 2) {
      const memoryId = pathArr[1];
      return handleUpdateMemory(request, memoryId);
    }
    // user/memories/:id alias
    if (pathStr.startsWith('user/memories/') && pathArr.length === 3) {
      const memoryId = pathArr[2];
      return handleUpdateMemory(request, memoryId);
    }

    // Admin user update: admin/users/:id
    
    // Project update: projects/:id
    if (pathStr.startsWith('projects/') && pathArr.length === 2) {
      const projectId = pathArr[1];
      return handleUpdateProject(request, projectId);
    }

    // Google Calendar event update
    if (pathStr.match(/^google\/calendar\/events\/[^\/]+$/)) {
      const eventId = pathArr[3];
      return handleCalendarUpdate(request, eventId);
    }

    // Telegram model update
    if (pathStr === 'telegram/model') return handleTelegramModel(request);
    
    // Voice settings update
    if (pathStr === 'user/voice-settings') return handleUpdateVoiceSettings(request);

    return err('Not found', 404);
  } catch (error) {
    console.error('PUT error:', error);
    return err(error.message, 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Conversation delete: conversations/:id
    if (pathStr.startsWith('conversations/') && pathArr.length === 2) {
      const conversationId = pathArr[1];
      return handleDeleteConversation(request, conversationId);
    }
    if (pathStr.startsWith('schedules/') && pathArr.length === 2) {
      const taskId = pathArr[1];
      return handleDeleteSchedule(request, taskId);
    }
    if (pathStr.startsWith('memories/') && pathArr.length === 2) {
      const memoryId = pathArr[1];
      return handleDeleteMemory(request, memoryId);
    }
    // user/memories/:id alias
    if (pathStr.startsWith('user/memories/') && pathArr.length === 3) {
      const memoryId = pathArr[2];
      return handleDeleteMemory(request, memoryId);
    }
    if (pathStr.startsWith('data-imports/') && pathArr.length === 2) {
      const importId = pathArr[1];
      return handleDeleteDataImport(request, importId);
    }
    
    // Projects & Tags delete routes
    if (pathStr.startsWith('projects/') && pathArr.length === 2) {
      const projectId = pathArr[1];
      return handleDeleteProject(request, projectId);
    }
    if (pathStr.startsWith('tags/') && pathArr.length === 2) {
      const tagId = pathArr[1];
      return handleDeleteTag(request, tagId);
    }
    
    // Media gallery delete: media/:id
    if (pathStr.startsWith('media/') && pathArr.length === 2) {
      const mediaId = pathArr[1];
      return handleDeleteMedia(request, mediaId);
    }
    
    // Google Calendar event delete
    if (pathStr.match(/^google\/calendar\/events\/[^\/]+$/)) {
      const eventId = pathArr[3];
      return handleCalendarDelete(request, eventId);
    }
    
    return err('Not found', 404);
  } catch (error) {
    console.error('DELETE error:', error);
    return err(error.message, 500);
  }
}

export async function PATCH(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Voice session update: voice-sessions/:id
    if (pathStr.startsWith('voice-sessions/') && pathArr.length === 2) {
      const sessionId = pathArr[1];
    }

    // Support ticket update: support/tickets/:id
    if (pathStr.match(/^support\/tickets\/[a-f0-9-]+$/)) {
      const ticketId = pathStr.split('/')[2];
      return handleUpdateTicket(request, ticketId);
    }

    // Update message video_url when video generation completes
    // PATCH /api/messages/:id/video-complete
    if (pathStr.startsWith('messages/') && pathStr.endsWith('/video-complete')) {
      const user = await authenticate(request);
      if (!user) return err('Unauthorized', 401);
      const messageId = pathArr[1];
      const body = await request.json();
      const { video_url, thumbnail_url } = body;
      if (!video_url) return err('video_url required', 400);
      const db = await getDb();
      
      // Update message with video URL
      await db.collection('messages').updateOne(
        { id: messageId, user_id: user.id },
        { $set: { video_url, thumbnail_url: thumbnail_url || null, 'video_task.status': 'success' } }
      );
      
      // Also ensure video_jobs is updated for consistency (so global polling stops re-checking this job)
      const message = await db.collection('messages').findOne({ id: messageId });
      if (message?.video_task?.taskId) {
        await db.collection('video_jobs').updateOne(
          { task_id: message.video_task.taskId },
          { $set: { status: 'success', video_url, thumbnail_url: thumbnail_url || null, completed_at: new Date() } }
        ).catch(() => {}); // Non-critical
      }
      
      return ok({ success: true });
    }

    // Save message variants (for edit-regeneration feature)
    // PATCH /api/messages/:id/variants
    if (pathStr.startsWith('messages/') && pathStr.endsWith('/variants')) {
      const user = await authenticate(request);
      if (!user) return err('Unauthorized', 401);
      const messageId = pathArr[1];
      const body = await request.json();
      const { variants, activeVariant } = body;
      if (!variants || !Array.isArray(variants)) return err('variants array required', 400);
      const db = await getDb();
      await db.collection('messages').updateOne(
        { id: messageId },
        { $set: { variants, activeVariant: activeVariant ?? variants.length - 1 } }
      );
      return ok({ success: true });
    }

    return err('Not found', 404);
  } catch (error) {
    console.error('PATCH error:', error);
    return err(error.message, 500);
  }
}
