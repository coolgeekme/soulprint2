import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { generateToken, verifyToken, hashPassword, comparePassword, getTokenFromRequest } from '@/lib/auth';
import { getProvider, AVAILABLE_MODELS } from '@/lib/llm/providers';
import { sendWelcomeEmail, sendAcceptedEmail, sendBetaCodeEmail } from '@/lib/email';
import path from 'path';
import fs from 'fs';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import yauzl from 'yauzl';

// ── Extracted handler modules ──────────────────────────────────────────────────
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



// ══════════════════════════════════════════════════════════════════════════════

// Document parsing utilities
async function parseDocumentContent(buffer, mimeType, fileName) {
  try {
    // PDF parsing
    if (mimeType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf')) {
      try {
        // Try pdf-parse-new first
        const pdfParseNew = require('pdf-parse-new');
        const pdfData = await pdfParseNew(buffer);
        
        // Check if we got meaningful text (more than just whitespace)
        const extractedText = pdfData.text?.trim() || '';
        
        if (extractedText.length > 20) {
          // Good text extraction
          return {
            success: true,
            text: extractedText.slice(0, 50000),
            metadata: {
              pages: pdfData.numpages,
              info: pdfData.info
            }
          };
        } else {
          // PDF is likely image-based (flyer, poster, scanned document)
          // Convert to PNG using pdftoppm for vision processing
          console.log('[PDF] No extractable text found - converting to image for OCR...');
          
          try {
            const { execSync } = require('child_process');
            const fs = require('fs');
            const path = require('path');
            const crypto = require('crypto');
            
            // Create temp files
            const tempId = crypto.randomBytes(8).toString('hex');
            const tempPdf = `/tmp/pdf_${tempId}.pdf`;
            const tempPng = `/tmp/pdf_${tempId}`;
            
            // Write PDF to temp file
            fs.writeFileSync(tempPdf, buffer);
            
            // Convert first page to PNG using pdftoppm (high quality)
            execSync(`pdftoppm -png -f 1 -l 1 -r 200 "${tempPdf}" "${tempPng}"`, { 
              timeout: 30000,
              stdio: ['pipe', 'pipe', 'pipe']
            });
            
            // Read the PNG file (pdftoppm adds page number suffix)
            const pngPath = `${tempPng}-1.png`;
            let pngBuffer;
            
            if (fs.existsSync(pngPath)) {
              pngBuffer = fs.readFileSync(pngPath);
              // Cleanup temp files
              try {
                fs.unlinkSync(tempPdf);
                fs.unlinkSync(pngPath);
              } catch (e) {}
            } else {
              // Try without suffix (single page PDFs)
              const altPngPath = `${tempPng}.png`;
              if (fs.existsSync(altPngPath)) {
                pngBuffer = fs.readFileSync(altPngPath);
                try {
                  fs.unlinkSync(tempPdf);
                  fs.unlinkSync(altPngPath);
                } catch (e) {}
              }
            }
            
            if (pngBuffer) {
              const base64Png = pngBuffer.toString('base64');
              console.log('[PDF] Converted to PNG, size:', pngBuffer.length, 'bytes');
              return {
                success: true,
                text: `[Image-based PDF: "${fileName || 'document.pdf'}" - Converted to image for visual analysis]`,
                metadata: {
                  pages: pdfData.numpages,
                  info: pdfData.info,
                  imageBasedPdf: true,
                  base64: base64Png,
                  convertedMimeType: 'image/png'
                }
              };
            }
          } catch (convertError) {
            console.error('[PDF] Conversion error:', convertError.message);
          }
          
          // If conversion failed, return message asking user to share as image
          return {
            success: true,
            text: `[This PDF "${fileName || 'document.pdf'}" appears to be image-based (flyer/poster/scanned). For best results, please take a screenshot of the PDF and upload it as an image instead.]`,
            metadata: {
              pages: pdfData.numpages,
              info: pdfData.info,
              imageBasedPdf: true,
              conversionFailed: true
            }
          };
        }
      } catch (newError) {
        console.error('PDF parse new error:', newError);
        try {
          // Fallback to original pdf-parse
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(buffer);
          return {
            success: true,
            text: pdfData.text?.slice(0, 50000) || '',
            metadata: {
              pages: pdfData.numpages,
              info: pdfData.info
            }
          };
        } catch (originalError) {
          console.error('PDF parse original error:', originalError);
          return {
            success: false,
            error: 'PDF parsing failed: ' + originalError.message
          };
        }
      }
    }
    
    // DOCX parsing
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileName?.toLowerCase().endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return {
        success: true,
        text: result.value?.slice(0, 50000) || '',
        metadata: {}
      };
    }
    
    // Plain text files
    if (mimeType?.startsWith('text/') || 
        ['.txt', '.md', '.csv', '.json', '.js', '.py', '.html', '.css'].some(ext => fileName?.toLowerCase().endsWith(ext))) {
      return {
        success: true,
        text: buffer.toString('utf-8').slice(0, 50000),
        metadata: {}
      };
    }
    
    return {
      success: false,
      error: `Unsupported file type: ${mimeType || fileName}`
    };
  } catch (err) {
    console.error('Document parsing error:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

// Handler for document parsing endpoint
// Convert image to PDF for flyer downloads
async function handleConvertToPdf(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const { imageUrl, aspectRatio = '8.5:11' } = await request.json();
    
    if (!imageUrl) return err('imageUrl required');

    // Download the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return err('Failed to fetch image');
    
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    
    // Convert to PDF using sharp and PDFKit
    const PDFDocument = require('pdfkit');
    const sharp = require('sharp');
    
    // Get image dimensions
    const imgMeta = await sharp(imgBuffer).metadata();
    
    // Calculate PDF page size (in points, 72 points = 1 inch)
    let pageWidth, pageHeight;
    if (aspectRatio === '8.5:11' || aspectRatio === '2:3') {
      pageWidth = 612; // 8.5 inches
      pageHeight = 792; // 11 inches
    } else if (aspectRatio === '11:17') {
      pageWidth = 792; // 11 inches
      pageHeight = 1224; // 17 inches
    } else if (aspectRatio === '1:1') {
      pageWidth = 612;
      pageHeight = 612;
    } else if (aspectRatio === '9:16') {
      pageWidth = 405; // ~5.6 inches
      pageHeight = 720; // 10 inches
    } else {
      pageWidth = 612;
      pageHeight = 792;
    }

    // Create PDF
    const doc = new PDFDocument({
      size: [pageWidth, pageHeight],
      margin: 0,
    });

    // Collect PDF data
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    const pdfPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Resize image to fit page while maintaining aspect ratio
    const resizedImg = await sharp(imgBuffer)
      .resize(Math.round(pageWidth * 2), Math.round(pageHeight * 2), {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();

    // Add image to PDF
    doc.image(resizedImg, 0, 0, {
      width: pageWidth,
      height: pageHeight,
    });
    doc.end();

    const pdfBuffer = await pdfPromise;

    // Upload PDF to storage (using the same method as media)
    const crypto = require('crypto');
    const pdfId = crypto.randomBytes(16).toString('hex');
    const pdfFileName = `flyer_${pdfId}.pdf`;
    
    // For now, return as base64 data URL (could be uploaded to cloud storage)
    const pdfBase64 = pdfBuffer.toString('base64');
    const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

    return NextResponse.json({
      success: true,
      pdfUrl: pdfDataUrl,
      fileName: pdfFileName,
      size: pdfBuffer.length,
    });

  } catch (err) {
    console.error('[PDF Convert] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleParseDocument(request) {
  try {
    // Require authentication
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let formData;
    try {
      formData = await request.formData();
    } catch (formError) {
      console.error('FormData parsing error:', formError);
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseDocumentContent(buffer, file.type, file.name);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      text: result.text,
      metadata: result.metadata,
      fileName: file.name,
      fileType: file.type
    });
  } catch (err) {
    console.error('Parse document error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Analyze an image and generate JSON config for recreating it
async function handleImageToJson(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { image } = body;
    
    if (!image?.base64 || !image?.mimeType) {
      return NextResponse.json({ error: 'Image data required' }, { status: 400 });
    }
    
    // Use GPT-4o to analyze the image and generate a prompt
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }
    
    const analysisPrompt = `Analyze this image and generate a detailed JSON configuration that could be used to recreate a similar image using an AI image generator.

Return ONLY valid JSON with the following structure:
{
  "prompt": "A detailed, comprehensive prompt that would recreate this image. Include specific details about: subjects, actions, composition, lighting, colors, style, mood, camera angle, and any notable elements.",
  "negativePrompt": "Elements to avoid in generation",
  "style": "The artistic style (e.g., photorealistic, illustration, anime, oil painting, digital art, etc.)",
  "aspectRatio": "Estimated aspect ratio (1:1, 16:9, 9:16, or 4:3)",
  "colorPalette": ["array", "of", "dominant", "colors"],
  "mood": "The overall mood/atmosphere",
  "subjects": ["array", "of", "main", "subjects"],
  "composition": "Description of the composition (e.g., centered, rule of thirds, close-up, wide shot)",
  "lighting": "Description of the lighting (e.g., natural, studio, dramatic, soft)",
  "suggestedModel": "Recommended AI model for best results (gpt-image-1, nano-banana, or kling-image)"
}

Be extremely detailed in the prompt - the goal is to be able to recreate this exact image.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${image.mimeType};base64,${image.base64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('OpenAI image analysis error:', err);
      return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from the response
    let jsonResult;
    try {
      // Try to parse the entire response as JSON
      jsonResult = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonResult = JSON.parse(jsonMatch[1]);
      } else {
        // Try to find JSON object in the text
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonResult = JSON.parse(objectMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      }
    }
    
    // Add metadata
    jsonResult.generatedAt = new Date().toISOString();
    jsonResult.type = 'image';
    jsonResult.version = '1.0';
    
    return NextResponse.json(jsonResult);
  } catch (err) {
    console.error('Image-to-JSON error:', err);
    return NextResponse.json({ error: err.message || 'Failed to analyze image' }, { status: 500 });
  }
}

// Edit an image using OpenAI's Responses API with gpt-image-1 for true in-place editing
async function handleImageEdit(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { image, prompt, overlayImage } = body;
    
    if (!image || !prompt) {
      return NextResponse.json({ error: 'Image and prompt are required' }, { status: 400 });
    }
    
    // If an overlay image is provided, use the composite pipeline (Gemini first)
    if (overlayImage) {
      console.log('[ImageEdit] Overlay image provided — using composite pipeline');
      
      // Get base image as buffer
      let baseBuffer;
      if (image.base64) {
        const raw = image.base64.startsWith('data:') 
          ? image.base64.split(',')[1] 
          : image.base64;
        baseBuffer = Buffer.from(raw, 'base64');
      } else if (image.url) {
        const resp = await fetch(image.url);
        if (!resp.ok) throw new Error('Failed to fetch base image');
        baseBuffer = Buffer.from(await resp.arrayBuffer());
      }
      
      // Get overlay image as buffer
      let overlayBuffer;
      const overlayRaw = overlayImage.base64?.startsWith('data:') 
        ? overlayImage.base64.split(',')[1] 
        : overlayImage.base64;
      overlayBuffer = Buffer.from(overlayRaw, 'base64');
      
      if (!baseBuffer || !overlayBuffer) {
        return NextResponse.json({ error: 'Failed to process images' }, { status: 400 });
      }
      
      const result = await handleSmartComposite(
        baseBuffer, overlayBuffer, overlayImage.mimeType || 'image/png', prompt
      );
      
      if (result.success) {
        return NextResponse.json({
          url: result.url,
          method: result.method,
          originalPrompt: prompt,
        });
      } else {
        return NextResponse.json({ error: 'Composite failed' }, { status: 500 });
      }
    }
    
    // Standard text-based edit (no overlay)
    const result = await handleImageEditInternal(user.id, image, prompt);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    return NextResponse.json({
      url: result.url,
      base64: result.base64,
      method: result.method,
      originalPrompt: prompt,
      note: result.note
    });
  } catch (err) {
    console.error('[ImageEdit] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to edit image' }, { status: 500 });
  }
}

// Test endpoint for Smart Composite — allows testing with base64 images
async function handleCompositeTest(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { baseImage, overlayImage, instruction } = body;
    
    // baseImage and overlayImage can be base64 strings or URLs
    if (!baseImage || !overlayImage) {
      return NextResponse.json({ error: 'baseImage and overlayImage are required (base64 or URL)' }, { status: 400 });
    }
    
    let baseBuffer, overlayBuffer;
    let overlayMime = 'image/png';
    
    // Get base image
    if (baseImage.startsWith('http')) {
      const resp = await fetch(baseImage);
      baseBuffer = Buffer.from(await resp.arrayBuffer());
    } else {
      let b64 = baseImage;
      if (b64.startsWith('data:')) {
        const m = b64.match(/^data:([^;]+);base64,(.+)$/);
        if (m) b64 = m[2];
      }
      baseBuffer = Buffer.from(b64, 'base64');
    }
    
    // Get overlay image
    if (overlayImage.startsWith('http')) {
      const resp = await fetch(overlayImage);
      overlayBuffer = Buffer.from(await resp.arrayBuffer());
      overlayMime = resp.headers.get('content-type') || 'image/png';
    } else {
      let b64 = overlayImage;
      if (b64.startsWith('data:')) {
        const m = b64.match(/^data:([^;]+);base64,(.+)$/);
        if (m) { overlayMime = m[1]; b64 = m[2]; }
      }
      overlayBuffer = Buffer.from(b64, 'base64');
    }
    
    const result = await handleSmartComposite(
      baseBuffer,
      overlayBuffer,
      overlayMime,
      instruction || 'Place the logo/design onto the image naturally'
    );
    
    return NextResponse.json(result);
  } catch (err) {
    console.error('[CompositeTest] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}



// Generate product mockup with user's design
async function handleMockupGenerate(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { design, product, isCustom, position, size } = body;
    
    if (!design?.base64 || !product) {
      return NextResponse.json({ error: 'Design and product are required' }, { status: 400 });
    }
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }
    
    console.log('[Mockup] Generating mockup for product:', product);
    
    // Use the Smart Composite approach: generate clean product → composite design
    const result = await handleMockupGenerateInternal(user.id, design, product);
    
    if (result.success) {
      console.log('[Mockup] Successfully generated mockup');
      return NextResponse.json({
        url: result.url,
        product,
        method: result.method || 'smart-composite',
      });
    } else {
      return NextResponse.json({ error: result.error || 'Failed to generate mockup' }, { status: 500 });
    }
  } catch (err) {
    console.error('[Mockup] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate mockup' }, { status: 500 });
  }
}


// ============================================================
// OPENAI REALTIME API - Voice Conversations (Updated to /v1/realtime/calls endpoint)
// ============================================================

// Handler: Proxy WebRTC SDP offer to OpenAI Realtime API via /v1/realtime/calls
// New architecture: Frontend sends SDP offer → Backend proxies to OpenAI → Returns SDP answer
async function handleRealtimeSession(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sdp, voice, instructions, model } = body;

    if (!sdp) {
      return NextResponse.json({ error: 'SDP offer is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Build session config for OpenAI Realtime Calls endpoint
    // Note: Only basic config here. Detailed settings (turn_detection, transcription, tools)
    // are configured via the data channel's session.update event after connection
    const sessionConfig = {
      type: 'realtime',
      model: model || 'gpt-realtime-1.5',
      audio: {
        output: {
          voice: voice || 'alloy',
        },
      },
    };

    // Add instructions if provided
    if (instructions) {
      sessionConfig.instructions = instructions;
    }

    console.log('[Realtime] Creating call for user:', user.id, 'model:', sessionConfig.model, 'voice:', sessionConfig.audio.output.voice);

    // Create multipart form data with SDP offer and session config
    const formData = new FormData();
    formData.set('sdp', sdp);
    formData.set('session', JSON.stringify(sessionConfig));

    // POST to OpenAI's /v1/realtime/calls endpoint
    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let errObj = {};
      try { errObj = JSON.parse(errText); } catch(e) {}
      console.error('[Realtime] Call creation failed:', response.status, errText);
      return NextResponse.json({ 
        error: errObj?.error?.message || `Failed to create realtime call (${response.status})` 
      }, { status: response.status });
    }

    // Return the SDP answer from OpenAI
    const sdpAnswer = await response.text();
    console.log('[Realtime] Call created successfully for user:', user.id);

    return new Response(sdpAnswer, {
      status: 200,
      headers: {
        'Content-Type': 'application/sdp',
      },
    });
  } catch (err) {
    console.error('[Realtime] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// ============================================================
// GOOGLE OAUTH & APIS (Gmail, Calendar, Drive)
// ============================================================
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_SCOPES = [
  // Gmail - using full access scope as configured in consent screen
  'https://mail.google.com/',
  // Calendar
  'https://www.googleapis.com/auth/calendar',
  // Drive
  'https://www.googleapis.com/auth/drive',
  // Google Docs
  'https://www.googleapis.com/auth/documents',
  // Google Sheets
  'https://www.googleapis.com/auth/spreadsheets',
  // Google Slides
  'https://www.googleapis.com/auth/presentations',
  // Basic profile
  'openid',
  'email',
  'profile'
].join(' ');

// Generate Google OAuth URL
function getGoogleAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent select_account', // Force account picker AND consent screen
    state: state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange code for tokens
async function exchangeGoogleCode(code, redirectUri) {
  console.log('Token exchange - redirect_uri:', redirectUri);
  console.log('Token exchange - client_id:', GOOGLE_CLIENT_ID?.substring(0, 20) + '...');
  console.log('Token exchange - client_secret exists:', !!GOOGLE_CLIENT_SECRET);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  });
  
  const data = await response.json();
  console.log('Token exchange response status:', response.status);
  if (data.error) {
    console.error('Token exchange failed:', JSON.stringify(data));
  }
  return data;
}

// Refresh access token
async function refreshGoogleToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  return response.json();
}

// Get valid access token (auto-refresh if needed)
async function getValidGoogleToken(userId, accountIdentifier = null) {
  const db = await getDb();
  
  let connection;
  
  if (accountIdentifier) {
    // Try to find by email or name (case-insensitive partial match)
    const searchTerm = accountIdentifier.toLowerCase();
    connection = await db.collection('google_connections').findOne({ 
      user_id: userId,
      $or: [
        { email: { $regex: searchTerm, $options: 'i' } },
        { name: { $regex: searchTerm, $options: 'i' } }
      ]
    });
    
    // If not found by name/email, try connection_id
    if (!connection) {
      connection = await db.collection('google_connections').findOne({ 
        user_id: userId,
        connection_id: accountIdentifier
      });
    }
    
    console.log('[GoogleToken] Searching for account:', accountIdentifier, '- Found:', connection?.email || 'none');
  }
  
  // Fall back to default account
  if (!connection) {
    connection = await db.collection('google_connections').findOne({ 
      user_id: userId, 
      is_default: true 
    });
  }
  
  // If still no connection, try any connection
  if (!connection) {
    connection = await db.collection('google_connections').findOne({ user_id: userId });
  }
  
  if (!connection) {
    console.log('[Google Token] No connection found for:', connectionId);
    return null;
  }
  
  // Check if token is expired (with 5 min buffer)
  const isExpired = new Date(connection.expires_at) < new Date(Date.now() + 5 * 60 * 1000);
  console.log('[Google Token] Token expired:', isExpired, 'expires_at:', connection.expires_at);
  
  if (isExpired && connection.refresh_token) {
    try {
      console.log('[Google Token] Attempting refresh for:', connection.email);
      const tokens = await refreshGoogleToken(connection.refresh_token);
      if (tokens.access_token) {
        await db.collection('google_connections').updateOne(
          { connection_id: connection.connection_id },
          { 
            $set: { 
              access_token: tokens.access_token,
              expires_at: new Date(Date.now() + tokens.expires_in * 1000),
              updated_at: new Date()
            }
          }
        );
        console.log('[Google Token] Refresh successful for:', connection.email);
        return { token: tokens.access_token, connection };
      }
    } catch (err) {
      console.error('[Google Token] Refresh failed for', connection.email, ':', err.message);
      return null;
    }
  }
  
  return { token: connection.access_token, connection };
}

// Get all Google connections for a user with valid tokens
async function getAllGoogleConnections(userId) {
  console.log('[Google] Getting connections for user:', userId);
  const db = await getDb();
  const connections = await db.collection('google_connections').find({ user_id: userId }).toArray();
  console.log('[Google] Found', connections.length, 'connections in database');
  
  const validConnections = [];
  for (const conn of connections) {
    console.log('[Google] Checking connection:', conn.email, 'expires_at:', conn.expires_at);
    const result = await getValidGoogleToken(userId, conn.connection_id);
    if (result?.token) {
      console.log('[Google] Valid token for:', conn.email);
      validConnections.push({ ...conn, access_token: result.token });
    } else {
      console.log('[Google] Token invalid/refresh failed for:', conn.email);
    }
  }
  
  console.log('[Google] Returning', validConnections.length, 'valid connections');
  return validConnections;
}

// Handler: Initiate Google OAuth
async function handleGoogleAuthStart(request) {
  try {
    // First check if Google credentials are configured
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('Google Auth Start - Missing credentials:', {
        hasClientId: !!GOOGLE_CLIENT_ID,
        hasClientSecret: !!GOOGLE_CLIENT_SECRET
      });
      return NextResponse.json({ 
        error: 'Google OAuth not configured. Please check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' 
      }, { status: 500 });
    }
    
    console.log('Google Auth Start - Authenticating user...');
    const user = await authenticate(request);
    if (!user) {
      console.error('Google Auth Start - Authentication failed: No user returned');
      // Try to get more info about why auth failed
      const token = getTokenFromRequest(request);
      console.error('Google Auth Start - Token present:', !!token);
      if (token) {
        const decoded = verifyToken(token);
        console.error('Google Auth Start - Token decoded:', !!decoded);
      }
      return NextResponse.json({ error: 'Unauthorized - Please log in again' }, { status: 401 });
    }
    
    console.log('Google Auth Start - User authenticated:', user.id);
    
    // IMPORTANT: Always use the production domain for Google OAuth
    // This ensures OAuth works correctly - redirect URI must match Google Cloud Console registration
    const PRODUCTION_DOMAIN = 'https://soulprintengine.ai';
    const baseUrl = PRODUCTION_DOMAIN;
    
    console.log('Google Auth - Using base URL:', baseUrl);
    
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    console.log('Google Auth - Final redirect URI:', redirectUri);
    
    // Create state with user ID for security
    const state = Buffer.from(JSON.stringify({ 
      userId: user.id, 
      timestamp: Date.now() 
    })).toString('base64');
    
    const authUrl = getGoogleAuthUrl(redirectUri, state);
    console.log('Google Auth - Full auth URL generated');
    
    return NextResponse.json({ authUrl });
  } catch (err) {
    console.error('Google auth start error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Google OAuth Callback
async function handleGoogleAuthCallback(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
    console.log('Google Callback - Received params:', {
      hasCode: !!code,
      hasState: !!state,
      error: error || 'none',
      errorDescription: errorDescription || 'none'
    });
    
    // IMPORTANT: Always use the production domain for Google OAuth
    const PRODUCTION_DOMAIN = 'https://soulprintengine.ai';
    const baseUrl = PRODUCTION_DOMAIN;
    
    console.log('Google Callback - Using base URL:', baseUrl);
    
    if (error) {
      console.error('Google OAuth Error:', error, errorDescription);
      const errorMsg = errorDescription ? `${error}: ${errorDescription}` : error;
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent(errorMsg)}`);
    }
    
    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=missing_params`);
    }
    
    // Decode and verify state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(`${baseUrl}/integrations?error=invalid_state`);
    }
    
    // Check state is not too old (10 min max)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=state_expired`);
    }
    
    const userId = stateData.userId;
    
    // Exchange code for tokens - use same baseUrl for redirect URI
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    console.log('Google Callback - Exchanging code for tokens...');
    console.log('Google Callback - Using redirect_uri:', redirectUri);
    console.log('Google Callback - Client ID present:', !!GOOGLE_CLIENT_ID);
    console.log('Google Callback - Client Secret present:', !!GOOGLE_CLIENT_SECRET);
    
    const tokens = await exchangeGoogleCode(code, redirectUri);
    
    if (tokens.error) {
      console.error('Token exchange error - Full response:', JSON.stringify(tokens));
      const errorDetail = tokens.error_description || tokens.error || 'Unknown token error';
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent('Token exchange failed: ' + errorDetail)}`);
    }
    
    console.log('Google Callback - Token exchange successful, getting user info...');
    
    // Get user info from Google
    let userInfo;
    try {
      userInfo = await googleApiCall(tokens.access_token, '/oauth2/v2/userinfo');
      console.log('Google Callback - Got user info:', userInfo.email);
    } catch (userInfoErr) {
      console.error('Google Callback - Failed to get user info:', userInfoErr);
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent('Failed to get Google user info: ' + userInfoErr.message)}`);
    }
    
    // Store connection in database - use composite key of user_id + google_id to allow multiple accounts
    let db;
    try {
      db = await getDb();
    } catch (dbErr) {
      console.error('Google Callback - Database connection failed:', dbErr);
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent('Database connection failed')}`);
    }
    
    const connectionId = `${userId}_${userInfo.id}`;
    
    // Fetch available calendars for this account
    let calendars = [];
    try {
      const calendarList = await googleApiCall(tokens.access_token, '/calendar/v3/users/me/calendarList');
      calendars = (calendarList.items || []).map(cal => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary || false,
        backgroundColor: cal.backgroundColor,
        selected: cal.primary || false // Default: only primary calendar selected
      }));
    } catch (e) {
      console.error('Failed to fetch calendars:', e);
      // Continue without calendars - not fatal
    }
    
    // Store the connection in database
    try {
      await db.collection('google_connections').updateOne(
        { connection_id: connectionId },
        {
          $set: {
            connection_id: connectionId,
            user_id: userId,
            google_id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            expires_at: new Date(Date.now() + tokens.expires_in * 1000),
            scopes: GOOGLE_SCOPES.split(' '),
            calendars: calendars,
            is_default: false,
            connected_at: new Date(),
            updated_at: new Date()
          }
        },
        { upsert: true }
      );
    } catch (dbWriteErr) {
      console.error('Google Callback - Failed to save connection:', dbWriteErr);
      return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent('Failed to save Google connection: ' + dbWriteErr.message)}`);
    }
    
    // If this is the first account, make it the default
    try {
      const accountCount = await db.collection('google_connections').countDocuments({ user_id: userId });
      if (accountCount === 1) {
        await db.collection('google_connections').updateOne(
          { connection_id: connectionId },
          { $set: { is_default: true } }
        );
        
        // Mark this as the user's first Google connection for welcome message
        await db.collection('users').updateOne(
          { id: userId },
          { $set: { google_just_connected: true, google_connected_at: new Date() } }
        );
      }
      
      return NextResponse.redirect(`${baseUrl}/integrations?google=success&first=${accountCount === 1}`);
    } catch (dbUpdateErr) {
      console.error('Google Callback - Failed to update defaults:', dbUpdateErr);
      // Connection was saved, just couldn't set defaults - still success
      return NextResponse.redirect(`${baseUrl}/integrations?google=success&first=false`);
    }
  } catch (err) {
    console.error('Google callback error at final catch:', err);
    const errorBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://soulprintengine.ai';
    return NextResponse.redirect(`${errorBaseUrl}/integrations?error=${encodeURIComponent('Callback error: ' + err.message)}`);
  }
}

// Handler: Get Google connection status (returns all connected accounts)
async function handleGoogleStatus(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const db = await getDb();
    const connections = await db.collection('google_connections').find({ user_id: user.id }).toArray();
    
    if (!connections || connections.length === 0) {
      return NextResponse.json({ connected: false, accounts: [] });
    }
    
    const accounts = connections.map(conn => ({
      connectionId: conn.connection_id,
      googleId: conn.google_id,
      email: conn.email,
      name: conn.name,
      picture: conn.picture,
      connectedAt: conn.connected_at,
      isDefault: conn.is_default || false,
      calendars: conn.calendars || [],
      services: {
        gmail: conn.scopes?.some(s => s.includes('gmail')) || false,
        calendar: conn.scopes?.some(s => s.includes('calendar')) || false,
        drive: conn.scopes?.some(s => s.includes('drive')) || false
      }
    }));
    
    return NextResponse.json({
      connected: true,
      accounts,
      // Keep backward compatibility
      email: accounts.find(a => a.isDefault)?.email || accounts[0]?.email,
      name: accounts.find(a => a.isDefault)?.name || accounts[0]?.name,
      picture: accounts.find(a => a.isDefault)?.picture || accounts[0]?.picture
    });
  } catch (err) {
    console.error('Google status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Disconnect Google (specific account or all)
async function handleGoogleDisconnect(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { connectionId } = await request.json().catch(() => ({}));
    const db = await getDb();
    
    if (connectionId) {
      // Disconnect specific account
      const connection = await db.collection('google_connections').findOne({ 
        connection_id: connectionId, 
        user_id: user.id 
      });
      
      if (connection?.access_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${connection.access_token}`, {
          method: 'POST'
        }).catch(() => {});
      }
      
      await db.collection('google_connections').deleteOne({ connection_id: connectionId });
      
      // If this was the default, make another account the default
      if (connection?.is_default) {
        const remaining = await db.collection('google_connections').findOne({ user_id: user.id });
        if (remaining) {
          await db.collection('google_connections').updateOne(
            { connection_id: remaining.connection_id },
            { $set: { is_default: true } }
          );
        }
      }
    } else {
      // Disconnect all accounts
      const connections = await db.collection('google_connections').find({ user_id: user.id }).toArray();
      for (const conn of connections) {
        if (conn.access_token) {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${conn.access_token}`, {
            method: 'POST'
          }).catch(() => {});
        }
      }
      await db.collection('google_connections').deleteMany({ user_id: user.id });
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Google disconnect error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Set default Google account
async function handleGoogleSetDefault(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { connectionId } = await request.json();
    if (!connectionId) return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    
    const db = await getDb();
    
    // Remove default from all accounts
    await db.collection('google_connections').updateMany(
      { user_id: user.id },
      { $set: { is_default: false } }
    );
    
    // Set new default
    await db.collection('google_connections').updateOne(
      { connection_id: connectionId, user_id: user.id },
      { $set: { is_default: true } }
    );
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Set default error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Update calendar selection for an account
async function handleGoogleUpdateCalendars(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { connectionId, calendars } = await request.json();
    if (!connectionId || !calendars) {
      return NextResponse.json({ error: 'connectionId and calendars required' }, { status: 400 });
    }
    
    const db = await getDb();
    
    // Get current connection
    const connection = await db.collection('google_connections').findOne({
      connection_id: connectionId,
      user_id: user.id
    });
    
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }
    
    // Update the selected status for each calendar
    const updatedCalendars = connection.calendars.map(cal => ({
      ...cal,
      selected: calendars.find(c => c.id === cal.id)?.selected ?? cal.selected
    }));
    
    await db.collection('google_connections').updateOne(
      { connection_id: connectionId },
      { $set: { calendars: updatedCalendars, updated_at: new Date() } }
    );
    
    return NextResponse.json({ success: true, calendars: updatedCalendars });
  } catch (err) {
    console.error('Update calendars error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Refresh calendars list for an account
async function handleGoogleRefreshCalendars(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { connectionId } = await request.json();
    if (!connectionId) return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    
    const db = await getDb();
    const connection = await db.collection('google_connections').findOne({
      connection_id: connectionId,
      user_id: user.id
    });
    
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }
    
    const accessToken = await getValidGoogleTokenForConnection(connection);
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to get valid token' }, { status: 401 });
    }
    
    const calendarList = await googleApiCall(accessToken, '/calendar/v3/users/me/calendarList');
    
    // Preserve existing selection state
    const existingSelections = {};
    (connection.calendars || []).forEach(cal => {
      existingSelections[cal.id] = cal.selected;
    });
    
    const calendars = (calendarList.items || []).map(cal => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
      selected: existingSelections[cal.id] ?? cal.primary ?? false
    }));
    
    await db.collection('google_connections').updateOne(
      { connection_id: connectionId },
      { $set: { calendars, updated_at: new Date() } }
    );
    
    return NextResponse.json({ success: true, calendars });
  } catch (err) {
    console.error('Refresh calendars error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Get valid token for a specific connection
async function getValidGoogleTokenForConnection(connection) {
  const isExpired = new Date(connection.expires_at) < new Date(Date.now() + 5 * 60 * 1000);
  
  if (isExpired && connection.refresh_token) {
    try {
      const tokens = await refreshGoogleToken(connection.refresh_token);
      if (tokens.access_token) {
        const db = await getDb();
        await db.collection('google_connections').updateOne(
          { connection_id: connection.connection_id },
          { 
            $set: { 
              access_token: tokens.access_token,
              expires_at: new Date(Date.now() + tokens.expires_in * 1000),
              updated_at: new Date()
            }
          }
        );
        return tokens.access_token;
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      return null;
    }
  }
  
  return connection.access_token;
}

// ============================================================
// GMAIL API HANDLERS
// ============================================================

// Handler: List Gmail messages
async function handleGmailList(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const query = url.searchParams.get('q') || '';
    const maxResults = url.searchParams.get('maxResults') || '20';
    const pageToken = url.searchParams.get('pageToken') || '';
    
    const params = new URLSearchParams({ maxResults });
    if (query) params.append('q', query);
    if (pageToken) params.append('pageToken', pageToken);
    
    const data = await googleApiCall(accessToken, `/gmail/v1/users/me/messages?${params}`);
    
    // Fetch message details for each message
    if (data.messages) {
      const detailed = await Promise.all(
        data.messages.slice(0, 10).map(async (msg) => {
          const detail = await googleApiCall(accessToken, `/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
          const headers = detail.payload?.headers || [];
          return {
            id: msg.id,
            threadId: msg.threadId,
            subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
            from: headers.find(h => h.name === 'From')?.value || '',
            date: headers.find(h => h.name === 'Date')?.value || '',
            snippet: detail.snippet || ''
          };
        })
      );
      data.messages = detailed;
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('Gmail list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Get Gmail message
async function handleGmailGet(request, messageId) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const data = await googleApiCall(accessToken, `/gmail/v1/users/me/messages/${messageId}?format=full`);
    
    // Parse email body
    let body = '';
    if (data.payload) {
      const getBody = (payload) => {
        if (payload.body?.data) {
          return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
          }
          for (const part of payload.parts) {
            const nested = getBody(part);
            if (nested) return nested;
          }
        }
        return '';
      };
      body = getBody(data.payload);
    }
    
    const headers = data.payload?.headers || [];
    
    return NextResponse.json({
      id: data.id,
      threadId: data.threadId,
      subject: headers.find(h => h.name === 'Subject')?.value || '',
      from: headers.find(h => h.name === 'From')?.value || '',
      to: headers.find(h => h.name === 'To')?.value || '',
      date: headers.find(h => h.name === 'Date')?.value || '',
      body: body,
      snippet: data.snippet,
      labelIds: data.labelIds
    });
  } catch (err) {
    console.error('Gmail get error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Send Gmail message
async function handleGmailSend(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { to, subject, body, threadId, account } = await request.json();
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }
    
    // Get sender email
    const db = await getDb();
    const connection = await db.collection('google_connections').findOne({ user_id: user.id });
    const from = connection?.email || '';
    
    // Create RFC 2822 formatted email
    const email = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\r\n');
    
    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const payload = { raw: encodedEmail };
    if (threadId) payload.threadId = threadId;
    
    const data = await googleApiCall(accessToken, '/gmail/v1/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    return NextResponse.json({ success: true, messageId: data.id, threadId: data.threadId });
  } catch (err) {
    console.error('Gmail send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// GOOGLE CALENDAR API HANDLERS
// ============================================================

// Handler: List Calendar events
async function handleCalendarList(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const timeMin = url.searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = url.searchParams.get('timeMax') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = url.searchParams.get('maxResults') || '50';
    const calendarId = url.searchParams.get('calendarId'); // Optional: specific calendar
    const accountName = url.searchParams.get('account'); // Optional: specific Google account
    const allAccounts = url.searchParams.get('all') === 'true'; // Fetch from all accounts
    
    const db = await connectDB();
    
    // Determine which accounts to fetch from
    let accountsToFetch = [];
    
    if (allAccounts) {
      // Fetch from ALL connected Google accounts
      accountsToFetch = await getAllGoogleConnections(user.id);
      console.log('[Calendar List] Fetching from ALL accounts:', accountsToFetch.map(a => a.email));
    } else {
      // Fetch from specific or default account
      const tokenResult = await getValidGoogleToken(user.id, accountName);
      if (!tokenResult?.token) {
        return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
      }
      accountsToFetch = [{ ...tokenResult.connection, access_token: tokenResult.token }];
      console.log('[Calendar List] Fetching from account:', tokenResult.connection?.email);
    }
    
    if (accountsToFetch.length === 0) {
      return NextResponse.json({ error: 'No Google accounts connected' }, { status: 400 });
    }
    
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: Math.ceil(parseInt(maxResults) / Math.max(accountsToFetch.length, 1)).toString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });
    
    // Fetch events from all accounts and their selected calendars
    const allEvents = [];
    
    for (const account of accountsToFetch) {
      // Determine which calendars to fetch from this account
      let calendarsToFetch = ['primary'];
      
      if (calendarId) {
        calendarsToFetch = [calendarId];
      } else if (account.calendars?.length > 0) {
        const selectedCalendars = account.calendars.filter(cal => cal.selected);
        if (selectedCalendars.length > 0) {
          calendarsToFetch = selectedCalendars.map(cal => cal.id);
        }
      }
      
      console.log(`[Calendar List] Account ${account.email}: fetching from calendars:`, calendarsToFetch);
      
      // Fetch events from each calendar
      for (const calId of calendarsToFetch) {
        try {
          const encodedCalId = encodeURIComponent(calId);
          const data = await googleApiCall(account.access_token, `/calendar/v3/calendars/${encodedCalId}/events?${params}`);
          
          const calInfo = account.calendars?.find(c => c.id === calId);
          
          const events = (data.items || []).map(event => ({
            id: event.id,
            calendarId: calId,
            calendarName: calInfo?.name || (calId === 'primary' ? 'Primary' : calId),
            calendarColor: calInfo?.color || event.colorId || '#4285f4',
            accountEmail: account.email,
            accountName: account.name,
            summary: event.summary || '(No title)',
            description: event.description || '',
            location: event.location || '',
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            htmlLink: event.htmlLink,
            attendees: event.attendees?.map(a => ({ email: a.email, name: a.displayName })) || []
          }));
          
          allEvents.push(...events);
        } catch (calErr) {
          console.error(`[Calendar List] Error fetching calendar ${calId} from ${account.email}:`, calErr.message);
        }
      }
    }
    
    // Sort all events by start time
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    // Limit to maxResults
    const limitedEvents = allEvents.slice(0, parseInt(maxResults));
    
    return NextResponse.json({
      events: limitedEvents,
      accountsQueried: accountsToFetch.map(a => a.email),
      totalEvents: allEvents.length
    });
  } catch (err) {
    console.error('Calendar list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Create Calendar event
async function handleCalendarCreate(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { summary, description, location, start, end, attendees, timeZone, calendarId, account } = await request.json();
    
    // Get token for specific or default account
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    }
    
    const accessToken = tokenResult.token;
    const connection = tokenResult.connection;
    
    if (!summary || !start || !end) {
      return NextResponse.json({ error: 'Missing required fields: summary, start, end' }, { status: 400 });
    }
    
    // Get user's timezone from their saved location, or use provided timezone, or default to UTC
    const db = await getDb();
    const userLocation = await db.collection('user_locations').findOne({ user_id: user.id });
    const eventTimezone = timeZone || userLocation?.timezone || 'UTC';
    
    // Use specified calendar or default to primary
    const targetCalendar = calendarId || 'primary';
    const encodedCalendarId = encodeURIComponent(targetCalendar);
    
    const event = {
      summary,
      description: description || '',
      location: location || '',
      start: { dateTime: start, timeZone: eventTimezone },
      end: { dateTime: end, timeZone: eventTimezone },
      attendees: attendees?.map(email => ({ email })) || []
    };
    
    console.log('[Calendar Create] Creating event in calendar:', targetCalendar, 'on account:', connection?.email);
    
    const data = await googleApiCall(accessToken, `/calendar/v3/calendars/${encodedCalendarId}/events`, {
      method: 'POST',
      body: JSON.stringify(event)
    });
    
    return NextResponse.json({
      success: true,
      event: {
        id: data.id,
        summary: data.summary,
        htmlLink: data.htmlLink,
        start: data.start?.dateTime || data.start?.date,
        end: data.end?.dateTime || data.end?.date,
        timeZone: eventTimezone
      }
    });
  } catch (err) {
    console.error('Calendar create error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Update Calendar event
async function handleCalendarUpdate(request, eventId) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const updates = await request.json();
    
    const tokenResult = await getValidGoogleToken(user.id, updates.account);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const calendarId = updates.calendarId || 'primary';
    const encodedCalendarId = encodeURIComponent(calendarId);
    
    // Get user's timezone
    const db = await getDb();
    const userLocation = await db.collection('user_locations').findOne({ user_id: user.id });
    const eventTimezone = updates.timeZone || userLocation?.timezone || 'UTC';
    
    const event = {};
    if (updates.summary) event.summary = updates.summary;
    if (updates.description !== undefined) event.description = updates.description;
    if (updates.location !== undefined) event.location = updates.location;
    if (updates.start) event.start = { dateTime: updates.start, timeZone: eventTimezone };
    if (updates.end) event.end = { dateTime: updates.end, timeZone: eventTimezone };
    
    const data = await googleApiCall(accessToken, `/calendar/v3/calendars/${encodedCalendarId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(event)
    });
    
    return NextResponse.json({ success: true, event: data });
  } catch (err) {
    console.error('Calendar update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Delete Calendar event
async function handleCalendarDelete(request, eventId) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    // Get calendarId and account from query params
    const url = new URL(request.url);
    const calendarId = url.searchParams.get('calendarId') || 'primary';
    const accountName = url.searchParams.get('account');
    
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const encodedCalendarId = encodeURIComponent(calendarId);
    
    await googleApiCall(accessToken, `/calendar/v3/calendars/${encodedCalendarId}/events/${eventId}`, {
      method: 'DELETE'
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Calendar delete error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// GOOGLE DRIVE API HANDLERS
// ============================================================

// Handler: List Drive files
async function handleDriveList(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    const query = url.searchParams.get('q') || '';
    const pageSize = url.searchParams.get('pageSize') || '20';
    const pageToken = url.searchParams.get('pageToken') || '';
    
    const params = new URLSearchParams({
      pageSize,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink)'
    });
    if (query) params.append('q', query);
    if (pageToken) params.append('pageToken', pageToken);
    
    const data = await googleApiCall(accessToken, `/drive/v3/files?${params}`);
    
    return NextResponse.json({
      files: (data.files || []).map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        iconLink: file.iconLink,
        thumbnailLink: file.thumbnailLink
      })),
      nextPageToken: data.nextPageToken
    });
  } catch (err) {
    console.error('Drive list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Get Drive file content
async function handleDriveGet(request, fileId) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const url = new URL(request.url);
    const accountName = url.searchParams.get('account');
    const tokenResult = await getValidGoogleToken(user.id, accountName);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    // Get file metadata
    const metadata = await googleApiCall(accessToken, `/drive/v3/files/${fileId}?fields=id,name,mimeType,size,webViewLink`);
    
    // For Google Docs, export as text
    let content = null;
    if (metadata.mimeType === 'application/vnd.google-apps.document') {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      content = await response.text();
    } else if (metadata.mimeType === 'application/vnd.google-apps.spreadsheet') {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      content = await response.text();
    }
    
    return NextResponse.json({
      ...metadata,
      content: content?.slice(0, 50000) // Limit content size
    });
  } catch (err) {
    console.error('Drive get error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handler: Search Drive files
async function handleDriveSearch(request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { query, account } = await request.json();
    
    const tokenResult = await getValidGoogleToken(user.id, account);
    if (!tokenResult?.token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    const accessToken = tokenResult.token;
    
    if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });
    
    // Build search query
    const q = `fullText contains '${query.replace(/'/g, "\\'")}'`;
    const params = new URLSearchParams({
      q,
      pageSize: '20',
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime)'
    });
    
    const data = await googleApiCall(accessToken, `/drive/v3/files?${params}`);
    
    return NextResponse.json({ files: data.files || [] });
  } catch (err) {
    console.error('Drive search error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================

// ============================================================
// GOOGLE ACTION FUNCTIONS FOR AI TOOL CALLING
// ============================================================

// Define tools for OpenAI function calling
const GOOGLE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_emails',
      description: 'Search the user\'s Gmail inbox for emails matching a query. Use this when the user asks to find, look up, or check emails. Returns matching emails with subject, sender, date, and content preview.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to search (ask user if multiple accounts connected)'
          },
          query: {
            type: 'string',
            description: 'Gmail search query. Can use Gmail search operators like "from:sam", "subject:invoice", "after:2025/01/01", "has:attachment", or plain text search terms.'
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of emails to return (default 10, max 20)'
          }
        },
        required: ['account_email', 'query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_email',
      description: 'Read the full content of a specific email by its message ID. Use this after search_emails to get the complete email body when the user needs full details.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account'
          },
          message_id: {
            type: 'string',
            description: 'The Gmail message ID (obtained from search_emails results)'
          }
        },
        required: ['account_email', 'message_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email using the user\'s connected Gmail account. ALWAYS ask the user which Google account to use before calling this function.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to send from (user must specify which account)'
          },
          to: {
            type: 'string',
            description: 'Email address of the recipient'
          },
          subject: {
            type: 'string',
            description: 'Subject line of the email'
          },
          body: {
            type: 'string',
            description: 'The body/content of the email'
          }
        },
        required: ['account_email', 'to', 'subject', 'body']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create a new event on the user\'s Google Calendar. ALWAYS ask the user which Google account AND which calendar to use before calling this function.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to use (user must specify which account)'
          },
          calendar_id: {
            type: 'string',
            description: 'The calendar ID to create the event on (user must specify which calendar, e.g., "primary" or a specific calendar name/ID)'
          },
          summary: {
            type: 'string',
            description: 'Title/name of the event'
          },
          description: {
            type: 'string',
            description: 'Description or notes for the event'
          },
          location: {
            type: 'string',
            description: 'Location of the event'
          },
          start: {
            type: 'string',
            description: 'Start date and time in ISO 8601 format (e.g., 2024-03-15T14:00:00)'
          },
          end: {
            type: 'string',
            description: 'End date and time in ISO 8601 format (e.g., 2024-03-15T15:00:00)'
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of email addresses to invite'
          }
        },
        required: ['account_email', 'calendar_id', 'summary', 'start', 'end']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_calendar_event',
      description: 'Update/edit an existing calendar event. Use this when the user wants to change, reschedule, or modify an existing event.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account where the event exists'
          },
          calendar_id: {
            type: 'string',
            description: 'The calendar ID where the event exists'
          },
          event_id: {
            type: 'string',
            description: 'The ID of the event to update'
          },
          summary: {
            type: 'string',
            description: 'New title/name of the event (optional)'
          },
          description: {
            type: 'string',
            description: 'New description (optional)'
          },
          location: {
            type: 'string',
            description: 'New location (optional)'
          },
          start: {
            type: 'string',
            description: 'New start date/time in ISO 8601 format (optional)'
          },
          end: {
            type: 'string',
            description: 'New end date/time in ISO 8601 format (optional)'
          }
        },
        required: ['account_email', 'event_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_calendar_event',
      description: 'Delete/cancel a calendar event. Use this when the user wants to remove or cancel an existing event.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account where the event exists'
          },
          calendar_id: {
            type: 'string',
            description: 'The calendar ID where the event exists'
          },
          event_id: {
            type: 'string',
            description: 'The ID of the event to delete'
          }
        },
        required: ['account_email', 'event_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_document',
      description: 'Create a new Google Doc in the user\'s Google Drive. ALWAYS ask the user which Google account to use before calling this function.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to create the document in'
          },
          title: {
            type: 'string',
            description: 'Title/name of the document'
          },
          content: {
            type: 'string',
            description: 'The text content to put in the document. Can include formatting with line breaks.'
          },
          folder_name: {
            type: 'string',
            description: 'Optional folder name to save the document in. If not specified, saves to root of Drive.'
          }
        },
        required: ['account_email', 'title', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_spreadsheet',
      description: 'Create a new Google Sheets spreadsheet. ALWAYS ask the user which Google account to use before calling this function.',
      parameters: {
        type: 'object',
        properties: {
          account_email: {
            type: 'string',
            description: 'The email address of the Google account to create the spreadsheet in'
          },
          title: {
            type: 'string',
            description: 'Title/name of the spreadsheet'
          },
          headers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Column headers for the spreadsheet'
          },
          data: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'string' }
            },
            description: 'Rows of data (array of arrays, each inner array is a row)'
          }
        },
        required: ['account_email', 'title']
      }
    }
  }
];

// IMAGE EDITING TOOLS - General AI tools (not Google-specific)
const IMAGE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'edit_image',
      description: 'Edit an image that the user has uploaded or that was previously generated in the conversation. Use this when the user asks to modify, change, remove, or add something to an existing image. Examples: "remove the hat", "change the shirt color to blue", "add sunglasses", "remove the background text".',
      parameters: {
        type: 'object',
        properties: {
          image_reference: {
            type: 'string',
            description: 'Reference to which image to edit: "attached" for the currently attached image, "last_generated" for the most recently generated image in the conversation, or "message_id:xxx" for a specific message\'s image'
          },
          edit_instruction: {
            type: 'string',
            description: 'Clear, specific description of what to change in the image. Be precise: "remove the red headband", "change the white t-shirt to a blue hoodie", "remove the text from the shirt"'
          }
        },
        required: ['image_reference', 'edit_instruction']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_mockup',
      description: 'Place a design/logo onto a product to create a mockup. Use when the user wants to see their design on a t-shirt, mug, book cover, etc.',
      parameters: {
        type: 'object',
        properties: {
          product: {
            type: 'string',
            description: 'The product to put the design on (e.g., "white t-shirt", "coffee mug", "book cover", "phone case", "tote bag")'
          },
          design_reference: {
            type: 'string',
            description: 'Reference to the design image: "attached" for attached image, or "last_generated" for most recent generated image'
          }
        },
        required: ['product', 'design_reference']
      }
    }
  }
];

// Helper function to reformulate edit instructions to avoid OpenAI safety triggers
// Words like "remove" combined with body parts or accessories can trigger false positives
function reformulateForSafety(instruction) {
  let safe = instruction;
  
  // Common patterns that trigger safety systems - reformulate them
  const replacements = [
    // "remove X" -> "show without X" or "replace X with nothing"
    { pattern: /\bremove\s+(the\s+)?/gi, replacement: 'show the image without ' },
    // "delete X" -> "show without X"
    { pattern: /\bdelete\s+(the\s+)?/gi, replacement: 'show the image without ' },
    // "erase X" -> "show without X"
    { pattern: /\berase\s+(the\s+)?/gi, replacement: 'show the image without ' },
    // "cut X" -> "show without X"
    { pattern: /\bcut\s+(out\s+)?(the\s+)?/gi, replacement: 'show the image without ' },
    // "get rid of X" -> "show without X"
    { pattern: /\bget\s+rid\s+of\s+(the\s+)?/gi, replacement: 'show the image without ' },
    // "take off X" -> "show without X"  
    { pattern: /\btake\s+off\s+(the\s+)?/gi, replacement: 'show the image without ' },
    // "strip X" -> potentially problematic
    { pattern: /\bstrip\s+(the\s+)?/gi, replacement: 'modify the image to not show ' },
  ];
  
  for (const { pattern, replacement } of replacements) {
    safe = safe.replace(pattern, replacement);
  }
  
  // Add a safety prefix for general image editing
  if (!safe.toLowerCase().includes('show') && !safe.toLowerCase().includes('change') && !safe.toLowerCase().includes('modify')) {
    safe = `Modify the image: ${safe}`;
  }
  
  return safe;
}

// Helper function to poll Kie.ai task result
async function pollKieTaskResult(apiKey, taskId, timeoutMs = 60000) {
  const startTime = Date.now();
  const pollInterval = 3000; // Poll every 3 seconds
  
  console.log('[Kie.ai Poll] Starting poll for task:', taskId);
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Use the correct Kie.ai endpoint
      const statusResponse = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('[Kie.ai Poll] Response:', JSON.stringify(statusData).substring(0, 300));
        
        if (statusData.code === 200 && statusData.data) {
          const state = statusData.data.state;
          console.log('[Kie.ai Poll] State:', state);
          
          // Check for completion
          if (state === 'success') {
            // Parse resultJson to get the URL
            try {
              const resultJson = JSON.parse(statusData.data.resultJson || '{}');
              const resultUrl = resultJson.resultUrls?.[0] || resultJson.url || resultJson.image_url;
              
              if (resultUrl) {
                console.log('[Kie.ai Poll] Got result URL:', resultUrl.substring(0, 100));
                return { success: true, url: resultUrl };
              }
              return { success: false, error: 'No image URL in result' };
            } catch (parseErr) {
              console.error('[Kie.ai Poll] Failed to parse resultJson:', parseErr);
              return { success: false, error: 'Failed to parse result' };
            }
          }
          
          // Check for failure
          if (state === 'fail') {
            return { success: false, error: statusData.data.failMsg || 'Task failed' };
          }
          
          // Still processing (waiting, queuing, generating)
          console.log('[Kie.ai Poll] Still processing, state:', state);
        }
      } else {
        console.log('[Kie.ai Poll] HTTP error:', statusResponse.status);
      }
    } catch (pollErr) {
      console.log('[Kie.ai Poll] Error:', pollErr.message);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return { success: false, error: 'Polling timeout' };
}

// Internal function for image editing (called from tool handler)
// Hybrid routing: GPT-image-1 for complex edits, SeeDream v4 for style edits, 
// Flux Kontext as fallback, GPT-4o+DALL-E 3 as final fallback
// Includes spatial enhancement via GPT-4o Vision for location-aware edits
async function handleImageEditInternal(userId, image, editInstruction, onProgress = null) {
  console.log('[ImageEdit] Starting edit:', editInstruction.substring(0, 100));
  
  // Get image as base64 or URL
  let mimeType = image.mimeType || 'image/png';
  let imageBase64 = image.base64;
  let imageUrl = image.url;
  
  // Handle case where base64 includes data URL prefix
  if (imageBase64 && imageBase64.startsWith('data:')) {
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      imageBase64 = match[2];
    }
  }
  
  console.log('[ImageEdit] Image info - base64 length:', imageBase64?.length || 0, 'url:', imageUrl?.substring(0, 80) || 'none');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HYBRID ROUTING: Determine the best method based on edit type
  // ═══════════════════════════════════════════════════════════════════════════
  const editLower = editInstruction.toLowerCase();
  
  // Simple style/color edits → SeeDream (cheaper ~$0.025)
  const isSimpleStyleEdit = /\b(make it|change to|turn it|more)\s*(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|colorful|vibrant|muted|darker|lighter|brighter|warmer|cooler)\b/i.test(editInstruction) ||
    /\b(more|less)\s*(realistic|cartoon|artistic|vintage|modern|dramatic|subtle|saturated|contrast)/i.test(editInstruction) ||
    /\b(add|more)\s*(sunset|sunrise|golden|warm|cool|neon|pastel)\s*(color|tone|light|glow)/i.test(editInstruction);
  
  // Complex edits requiring understanding → GPT Image (more accurate ~$0.04-0.17)
  const isComplexEdit = /\b(add|put|place|insert|remove|delete|erase|change the|replace the|move the)\b/i.test(editInstruction) ||
    /\b(specific|exactly|precise|logo|text|sign|symbol|element|object)\b/i.test(editInstruction) ||
    /\b(door|hood|roof|window|wheel|side|front|back|top|bottom|left|right|corner)\b/i.test(editInstruction);
  
  console.log('[ImageEdit] Routing decision - isSimpleStyleEdit:', isSimpleStyleEdit, 'isComplexEdit:', isComplexEdit);
  
  // We need a URL for Kie.ai APIs - if we only have base64, upload it first
  const kieKey = process.env.KIE_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!imageUrl && imageBase64 && kieKey) {
    console.log('[ImageEdit] Uploading base64 image to get URL...');
    try {
      const uploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kieKey}`
        },
        body: JSON.stringify({
          base64Data: `data:${mimeType};base64,${imageBase64}`,
          uploadPath: 'soulprint/source',
          fileName: `source_${Date.now()}.png`
        }),
      });
      
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.data?.downloadUrl) {
          imageUrl = uploadData.data.downloadUrl;
          console.log('[ImageEdit] Uploaded source image to:', imageUrl);
        }
      }
    } catch (uploadErr) {
      console.log('[ImageEdit] Source upload failed:', uploadErr.message);
    }
  }
  
  // Fetch image from URL to get base64 if needed (for GPT Image method)
  if (!imageBase64 && imageUrl) {
    console.log('[ImageEdit] Fetching image from URL:', imageUrl);
    try {
      const imgResponse = await fetch(imageUrl);
      console.log('[ImageEdit] Fetch response status:', imgResponse.status);
      if (!imgResponse.ok) throw new Error(`Failed to fetch image: ${imgResponse.status}`);
      const imgBuffer = await imgResponse.arrayBuffer();
      console.log('[ImageEdit] Fetched image buffer size:', imgBuffer.byteLength);
      imageBase64 = Buffer.from(imgBuffer).toString('base64');
      const contentType = imgResponse.headers.get('content-type');
      if (contentType) mimeType = contentType;
      console.log('[ImageEdit] Converted to base64, length:', imageBase64.length, 'mimeType:', mimeType);
    } catch (err) {
      console.error('[ImageEdit] Failed to fetch image:', err.message);
      return { success: false, error: 'Failed to fetch original image: ' + err.message };
    }
  }
  
  if (!imageBase64 && !imageUrl) {
    return { success: false, error: 'No image data provided' };
  }
  
  // Reformulate instruction for better results
  let safeEditInstruction = reformulateForSafety(editInstruction);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SPATIAL ENHANCEMENT: Use GPT-4o Vision to understand spatial instructions
  // For requests like "add flames to the back of the minivan", we need to 
  // analyze the image to understand what "back" means in this specific angle
  // ═══════════════════════════════════════════════════════════════════════════
  const hasSpatialInstruction = /\b(back|front|side|left|right|top|bottom|rear|hood|door|roof|trunk|half|part|portion|area|section)\b/i.test(editInstruction);
  
  if (hasSpatialInstruction && openaiApiKey && (imageUrl || imageBase64)) {
    try {
      console.log('[ImageEdit] Detected spatial instruction, using GPT-4o Vision for enhancement...');
      
      const visionImageUrl = imageUrl || `data:${mimeType};base64,${imageBase64}`;
      
      const spatialAnalysisRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert at translating user image editing instructions into precise, unambiguous prompts for AI image editors.

When a user says things like "back of the car" or "left side", you need to analyze the image and translate this into specific visual terms that an AI image editor can understand.

For example:
- "add flames to the back of the minivan" → You look at the image, see the minivan from a 3/4 angle, and specify: "Add flames starting from the rear wheel area extending to the back bumper, visible on the right portion of the vehicle as shown in this angle"
- "put logo on the front door" → "Add the logo to the door panel closest to the front wheel, on the visible side of the vehicle"

Your job is to create a CLEAR, DETAILED prompt that specifies EXACTLY where in the visible image the edit should occur, using visual references from the current camera angle.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `User's edit request: "${editInstruction}"

Analyze this image and create a PRECISE, DETAILED edit prompt that an AI image editor can understand without confusion.

Your response should:
1. Describe exactly which part of the image to modify based on the current viewing angle
2. Use clear visual references (e.g., "the area from the middle of the vehicle to the rear bumper")
3. Maintain the original intent but remove ambiguity about "front/back/left/right"
4. Include any specific details about HOW to apply the edit (style, coverage, etc.)

Respond with ONLY the enhanced prompt, nothing else.`
                },
                {
                  type: 'image_url',
                  image_url: { url: visionImageUrl, detail: 'high' }
                }
              ]
            }
          ],
          max_tokens: 300,
          temperature: 0.3
        })
      });
      
      if (spatialAnalysisRes.ok) {
        const spatialData = await spatialAnalysisRes.json();
        const enhancedPrompt = spatialData.choices?.[0]?.message?.content;
        
        if (enhancedPrompt && enhancedPrompt.length > 20) {
          console.log('[ImageEdit] Original instruction:', editInstruction);
          console.log('[ImageEdit] Enhanced spatial prompt:', enhancedPrompt);
          safeEditInstruction = enhancedPrompt;
        }
      }
    } catch (spatialErr) {
      console.log('[ImageEdit] Spatial enhancement failed, using original instruction:', spatialErr.message);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // METHOD 0: Gemini Image Edit (Primary — best quality for most edits)
  // ═══════════════════════════════════════════════════════════════════════════
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey && imageBase64) {
    try {
      console.log('[ImageEdit] METHOD 0: Using Gemini Image for edit');
      const sharp = (await import('sharp')).default;
      
      const imgBuffer = Buffer.from(imageBase64, 'base64');
      const resizedImg = await sharp(imgBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      
      const geminiPrompt = `Edit this image as follows: ${safeEditInstruction}

Requirements:
- Make ONLY the requested changes
- Keep everything else in the image IDENTICAL
- The result should look like a natural photograph, not a digital manipulation
- Preserve the original image's lighting, style, and atmosphere`;

      const modelsToTry = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];
      
      for (const model of modelsToTry) {
        try {
          const gemRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: geminiPrompt },
                    { inline_data: { mime_type: 'image/jpeg', data: resizedImg.toString('base64') } }
                  ]
                }],
                generationConfig: {
                  responseModalities: ['TEXT', 'IMAGE'],
                  temperature: 0.2,
                }
              })
            }
          );
          
          if (!gemRes.ok) {
            console.log('[ImageEdit] Gemini', model, 'failed:', gemRes.status);
            continue;
          }
          
          const gemData = await gemRes.json();
          const parts = gemData.candidates?.[0]?.content?.parts || [];
          let generatedImage = null;
          
          for (const part of parts) {
            if (part.inlineData?.data) {
              generatedImage = Buffer.from(part.inlineData.data, 'base64');
            }
          }
          
          if (generatedImage) {
            let resultUrl = null;
            if (kieKey) {
              try {
                const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                  body: JSON.stringify({
                    base64Data: `data:image/png;base64,${generatedImage.toString('base64')}`,
                    uploadPath: 'soulprint/edits',
                    fileName: `gemini_edit_${Date.now()}.png`
                  }),
                });
                if (upRes.ok) {
                  const d = await upRes.json();
                  if (d.success && d.data?.downloadUrl) resultUrl = d.data.downloadUrl;
                }
              } catch (e) {}
            }
            
            if (resultUrl) {
              console.log('[ImageEdit] SUCCESS with Gemini', model, '! URL:', resultUrl);
              return { success: true, url: resultUrl, edit: editInstruction, method: `gemini-${model}` };
            }
          }
        } catch (modelErr) {
          console.log('[ImageEdit] Gemini', model, 'error:', modelErr.message);
        }
      }
    } catch (gemErr) {
      console.log('[ImageEdit] Gemini edit error:', gemErr.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // METHOD 1: GPT Image (gpt-image-1) - Fallback for complex edits
  // ═══════════════════════════════════════════════════════════════════════════
  if (openaiApiKey && imageBase64 && isComplexEdit) {
    try {
      console.log('[ImageEdit] METHOD 0: Using GPT Image (gpt-image-1) for complex edit');
      
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      
      const OpenAI = (await import('openai')).default;
      const { toFile } = await import('openai/uploads');
      const openai = new OpenAI({ apiKey: openaiApiKey });
      
      const imageFile = await toFile(imageBuffer, 'image.png', { type: mimeType || 'image/png' });
      
      console.log('[ImageEdit] GPT Image - calling images.edit...');
      const editResult = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFile,
        prompt: `Edit this image: ${safeEditInstruction}. Preserve the overall composition, subject identity, and style while making the requested change.`,
        n: 1,
        size: '1024x1024',
      });
      
      console.log('[ImageEdit] GPT Image edit completed');
      
      if (editResult.data?.[0]?.url || editResult.data?.[0]?.b64_json) {
        let resultUrl = editResult.data[0].url;
        
        if (!resultUrl && editResult.data[0].b64_json && kieKey) {
          const resultBase64 = `data:image/png;base64,${editResult.data[0].b64_json}`;
          const uploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${kieKey}`
            },
            body: JSON.stringify({
              base64Data: resultBase64,
              uploadPath: 'soulprint/edits',
              fileName: `gpt_edit_${Date.now()}.png`
            }),
          });
          
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.success && uploadData.data?.downloadUrl) {
              resultUrl = uploadData.data.downloadUrl;
            }
          }
        }
        
        if (resultUrl) {
          console.log('[ImageEdit] SUCCESS with GPT Image (gpt-image-1)! URL:', resultUrl);
          return {
            success: true,
            url: resultUrl,
            edit: editInstruction,
            method: 'gpt-image-1'
          };
        }
      }
    } catch (gptImageErr) {
      console.log('[ImageEdit] GPT Image error:', gptImageErr.message);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // METHOD 1: SeeDream v4 Edit (Primary for style edits - Cheapest ~$0.025)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ImageEdit] Checking METHOD 1 conditions - kieKey:', !!kieKey, 'imageUrl:', !!imageUrl);
  if (kieKey && imageUrl) {
    try {
      console.log('[ImageEdit] METHOD 1: Attempting SeeDream v4 Edit via Kie.ai');
      
      const requestBody = {
        model: 'bytedance/seedream-v4-edit',
        input: {
          prompt: safeEditInstruction,
          image_urls: [imageUrl],
          image_size: 'square_hd',
          image_resolution: '2K',
          max_images: 1
        }
      };
      
      const createTaskRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kieKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      const createTaskData = await createTaskRes.json();
      
      if (createTaskData.code === 200 && createTaskData.data?.taskId) {
        const taskId = createTaskData.data.taskId;
        console.log('[ImageEdit] SeeDream task created:', taskId);
        
        const startTime = Date.now();
        const maxWaitTime = 60000;
        let pollCount = 0;
        
        while (Date.now() - startTime < maxWaitTime) {
          await new Promise(r => setTimeout(r, 3000));
          pollCount++;
          
          if (onProgress && pollCount % 2 === 0) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            onProgress({ type: 'progress', message: `Still processing... (${elapsed}s)`, elapsed });
          }
          
          const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
            headers: { 'Authorization': `Bearer ${kieKey}` }
          });
          
          const statusData = await statusRes.json();
          
          if (statusData.code === 200) {
            const state = statusData.data?.state;
            
            if (state === 'success') {
              let resultUrl = null;
              try {
                const resultJson = JSON.parse(statusData.data?.resultJson || '{}');
                resultUrl = resultJson?.resultUrls?.[0] || resultJson?.url || resultJson?.image_url || resultJson?.images?.[0];
              } catch (e) {}
              
              if (resultUrl) {
                console.log('[ImageEdit] SUCCESS with SeeDream v4 Edit! URL:', resultUrl);
                return {
                  success: true,
                  url: resultUrl,
                  edit: editInstruction,
                  method: 'seedream-v4-edit'
                };
              }
            } else if (state === 'fail') {
              console.log('[ImageEdit] SeeDream task failed');
              break;
            }
          }
        }
      }
    } catch (seedreamErr) {
      console.log('[ImageEdit] SeeDream error:', seedreamErr.message);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // METHOD 2: Flux Kontext (Fallback)
  // ═══════════════════════════════════════════════════════════════════════════
  if (kieKey && imageUrl) {
    try {
      console.log('[ImageEdit] METHOD 2: Attempting Flux Kontext');
      
      const requestBody = {
        model: 'flux-kontext-pro',
        input: {
          prompt: safeEditInstruction,
          image_url: imageUrl,
          aspect_ratio: '1:1'
        }
      };
      
      const createTaskRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kieKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      const createTaskData = await createTaskRes.json();
      
      if (createTaskData.code === 200 && createTaskData.data?.taskId) {
        const taskId = createTaskData.data.taskId;
        
        const startTime = Date.now();
        const maxWaitTime = 60000;
        let pollCount = 0;
        
        while (Date.now() - startTime < maxWaitTime) {
          await new Promise(r => setTimeout(r, 3000));
          pollCount++;
          
          if (onProgress && pollCount % 2 === 0) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            onProgress({ type: 'progress', message: `Still processing... (${elapsed}s)`, elapsed });
          }
          
          const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
            headers: { 'Authorization': `Bearer ${kieKey}` }
          });
          
          const statusData = await statusRes.json();
          
          if (statusData.code === 200) {
            const state = statusData.data?.state;
            
            if (state === 'success') {
              let resultUrl = null;
              try {
                const resultJson = JSON.parse(statusData.data?.resultJson || '{}');
                resultUrl = resultJson?.resultUrls?.[0] || resultJson?.url || resultJson?.image_url || resultJson?.images?.[0];
              } catch (e) {}
              
              if (resultUrl) {
                console.log('[ImageEdit] SUCCESS with Flux Kontext! URL:', resultUrl);
                return {
                  success: true,
                  url: resultUrl,
                  edit: editInstruction,
                  method: 'flux-kontext-pro'
                };
              }
            } else if (state === 'fail') {
              break;
            }
          }
        }
      }
    } catch (fluxErr) {
      console.log('[ImageEdit] Flux Kontext error:', fluxErr.message);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // METHOD 3: GPT-4o Vision + DALL-E 3 (Final Fallback)
  // ═══════════════════════════════════════════════════════════════════════════
  if (openaiApiKey && imageBase64) {
    try {
      console.log('[ImageEdit] METHOD 3: Falling back to GPT-4o Vision + DALL-E 3');
      
      const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;
      
      const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
              { type: 'text', text: `You must recreate this EXACT image with ONE modification: "${safeEditInstruction}"

CRITICAL: The output must be the SAME image with only that one change. Preserve EVERYTHING else:
1. EXACT COMPOSITION - Same camera angle, position, framing
2. EXACT SUBJECT - Same object/person, pose, shape, proportions  
3. EXACT BACKGROUND - Same environment, lighting, shadows
4. EXACT STYLE - Same artistic style, realism level, color temperature
5. ONLY CHANGE - Apply ONLY: "${safeEditInstruction}"

Output ONLY the DALL-E prompt to recreate this IDENTICAL scene with the modification.` }
            ]
          }],
          max_tokens: 1000,
          temperature: 0.2,
        }),
      });
      
      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        const editPrompt = analysisData.choices?.[0]?.message?.content;
        
        if (editPrompt) {
          const generateResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: editPrompt,
              n: 1,
              size: '1024x1024',
              quality: 'hd',
              style: 'natural',
            }),
          });
          
          if (generateResponse.ok) {
            const generateData = await generateResponse.json();
            const resultUrl = generateData.data?.[0]?.url;
            if (resultUrl) {
              console.log('[ImageEdit] SUCCESS with GPT-4o + DALL-E 3!');
              return {
                success: true,
                url: resultUrl,
                edit: editInstruction,
                method: 'gpt4o-dalle3'
              };
            }
          }
        }
      }
    } catch (fallbackErr) {
      console.log('[ImageEdit] GPT-4o + DALL-E 3 error:', fallbackErr.message);
    }
  }
  
  return { success: false, error: 'Image editing failed with all methods' };
}

// Internal function for mockup generation (called from tool handler)
// Strategy: Generate a CLEAN product image, then composite the exact logo onto it
async function handleMockupGenerateInternal(userId, design, product) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return { success: false, error: 'OpenAI API key not configured' };
  }
  
  console.log('[Mockup Internal] Generating mockup for:', product);
  
  // Get design as base64 and buffer
  const mimeType = design.mimeType || 'image/png';
  let designBase64 = design.base64;
  
  if (!designBase64 && design.url) {
    try {
      const imgResponse = await fetch(design.url);
      if (!imgResponse.ok) throw new Error('Failed to fetch design');
      const imgBuffer = await imgResponse.arrayBuffer();
      designBase64 = Buffer.from(imgBuffer).toString('base64');
    } catch (err) {
      return { success: false, error: 'Failed to fetch design image' };
    }
  }
  
  if (!designBase64) {
    return { success: false, error: 'No design image available' };
  }
  
  const designBuffer = Buffer.from(designBase64, 'base64');
  
  // Step 1: Generate a CLEAN product image (WITHOUT the logo)
  // This gives us a base surface to composite onto
  const cleanProductPrompt = `A photorealistic ${product}, plain and clean with NO logos, NO text, NO designs, NO graphics on it. Professional product photography, studio lighting, front-facing view on a clean background. The ${product} should have a smooth, clean surface perfect for design placement.`;
  
  console.log('[Mockup Internal] Generating clean product base...');
  
  let baseBuffer = null;
  try {
    const generateResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: cleanProductPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural',
      }),
    });
    
    if (!generateResponse.ok) {
      const err = await generateResponse.json().catch(() => ({}));
      return { success: false, error: err.error?.message || 'Failed to generate base product image' };
    }
    
    const generateData = await generateResponse.json();
    const baseUrl = generateData.data?.[0]?.url;
    
    if (!baseUrl) {
      return { success: false, error: 'No base product image generated' };
    }
    
    console.log('[Mockup Internal] Clean product base generated, fetching buffer...');
    const baseResp = await fetch(baseUrl);
    baseBuffer = Buffer.from(await baseResp.arrayBuffer());
  } catch (err) {
    return { success: false, error: 'Failed to generate product base: ' + err.message };
  }
  
  // Step 2: Use Smart Composite to place the exact logo onto the product
  console.log('[Mockup Internal] Compositing design onto product...');
  try {
    const compositeResult = await handleSmartComposite(
      baseBuffer,
      designBuffer,
      mimeType,
      `Place this logo/design centered on the ${product}. Make it look like a professional product mockup.`
    );
    
    if (compositeResult.success) {
      console.log('[Mockup Internal] Smart composite succeeded!');
      return {
        success: true,
        url: compositeResult.url,
        product,
        method: 'smart-composite'
      };
    } else {
      return { success: false, error: compositeResult.error || 'Compositing failed' };
    }
  } catch (compErr) {
    return { success: false, error: 'Compositing failed: ' + compErr.message };
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// GEMINI NATIVE COMPOSITE: Uses Gemini's image generation to create
// photorealistic composites. The AI handles placement, blending, lighting,
// fabric texture, and perspective naturally — far superior to programmatic.
// ═══════════════════════════════════════════════════════════════════════════
async function handleGeminiComposite(sharp, basePng, overlayPng, userInstruction, geminiApiKey, kieKey) {
  // Prepare images for Gemini — optimize size for API limits
  const baseForGemini = await sharp(basePng)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  
  const logoForGemini = await sharp(overlayPng)
    .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  
  console.log('[GeminiComposite] Base:', baseForGemini.length, 'bytes | Logo:', logoForGemini.length, 'bytes');
  
  // Build a descriptive prompt based on user instruction
  const isReplace = /\b(swap|replace|change|switch)\b/i.test(userInstruction);
  const isFabric = /\b(t-?shirt|shirt|hoodie|jacket|jersey|sweater|clothing|apparel|fabric|garment)\b/i.test(userInstruction);
  const isVehicle = /\b(van|car|truck|vehicle|bus|minivan|suv|door)\b/i.test(userInstruction);
  
  let geminiPrompt;
  
  if (isReplace && isFabric) {
    geminiPrompt = `Edit the first image (the photo) by replacing the existing designs/logos/graphics on the clothing with the logo from the second image.

User's request: "${userInstruction}"

Requirements:
- Replace ALL existing printed designs, logos, or graphics on the clothing with the provided logo
- The logo must look naturally screen-printed on the fabric — follow wrinkles, folds, and contours
- Match the original photo's lighting, colors, shadows, and atmosphere EXACTLY  
- On light/white fabric: use the dark version of the logo
- On dark fabric: use a lighter/inverted version of the logo for visibility
- Size each logo to match approximately the size of the original design it replaces
- Keep EVERYTHING else in the photo identical (people, environment, objects, background)
- The result should look like a real photograph, not a digital edit`;
  } else if (isFabric) {
    geminiPrompt = `Edit the first image (the photo) by adding the logo from the second image onto the clothing.

User's request: "${userInstruction}"

Requirements:
- Place the logo naturally on the clothing as specified by the user
- The logo must look naturally screen-printed on the fabric — follow wrinkles, folds, and contours
- Match the photo's lighting, colors, and atmosphere
- On light fabric: use the dark version of the logo
- On dark fabric: use a lighter version for visibility
- Keep everything else in the photo identical
- The result should look like a real photograph`;
  } else if (isVehicle) {
    geminiPrompt = `Edit the first image (the photo) by adding/placing the logo from the second image onto the vehicle.

User's request: "${userInstruction}"

Requirements:
- Place the logo on the vehicle surface as specified
- Match the vehicle's surface angle, perspective, and lighting
- The logo should look like a real vinyl decal or paint job
- Preserve everything else in the photo
- The result should look photorealistic`;
  } else {
    geminiPrompt = `Edit the first image by compositing the logo/design from the second image onto it.

User's request: "${userInstruction}"

Requirements:
- Place the logo as specified by the user
- Make it look naturally integrated — match lighting, perspective, and surface texture
- Keep everything else in the image identical
- The result should look photorealistic, not like a digital paste`;
  }
  
  // Try multiple Gemini image models in order of quality
  const modelsToTry = [
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
  ];
  
  for (const model of modelsToTry) {
    console.log('[GeminiComposite] Trying model:', model);
    
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: geminiPrompt },
                { inline_data: { mime_type: 'image/jpeg', data: baseForGemini.toString('base64') } },
                { inline_data: { mime_type: 'image/png', data: logoForGemini.toString('base64') } }
              ]
            }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              temperature: 0.2,
            }
          })
        }
      );
      
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.log('[GeminiComposite]', model, 'failed:', res.status, errBody.substring(0, 200));
        continue;
      }
      
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      
      let generatedImage = null;
      let textResponse = '';
      
      for (const part of parts) {
        if (part.text) textResponse = part.text;
        if (part.inlineData && part.inlineData.data) {
          generatedImage = Buffer.from(part.inlineData.data, 'base64');
        }
      }
      
      if (!generatedImage) {
        console.log('[GeminiComposite]', model, '- no image in response. Text:', textResponse.substring(0, 200));
        continue;
      }
      
      console.log('[GeminiComposite]', model, 'generated image:', generatedImage.length, 'bytes');
      
      // Upload to storage
      let resultUrl = null;
      if (kieKey) {
        try {
          const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
            body: JSON.stringify({
              base64Data: `data:image/png;base64,${generatedImage.toString('base64')}`,
              uploadPath: 'soulprint/composites',
              fileName: `gemini_composite_${Date.now()}.png`
            }),
          });
          if (upRes.ok) {
            const d = await upRes.json();
            if (d.success && d.data?.downloadUrl) {
              resultUrl = d.data.downloadUrl;
              console.log('[GeminiComposite] Uploaded to:', resultUrl);
            }
          }
        } catch (e) {
          console.log('[GeminiComposite] Upload failed:', e.message);
        }
      }
      
      if (!resultUrl) {
        resultUrl = `data:image/png;base64,${generatedImage.toString('base64')}`;
      }
      
      return {
        success: true,
        url: resultUrl,
        placement: [{ target_description: 'Gemini AI composite', surface_type: 'auto' }],
        method: 'gemini-native-composite',
        model: model,
      };
      
    } catch (modelErr) {
      console.log('[GeminiComposite]', model, 'error:', modelErr.message);
      continue;
    }
  }
  
  // All models failed
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART COMPOSITE: AI-guided placement + programmatic pixel-perfect overlay
// The AI NEVER touches logo pixels — it only provides placement intelligence
// ═══════════════════════════════════════════════════════════════════════════
async function handleSmartComposite(baseBuffer, overlayBuffer, overlayMime, userInstruction) {
  const sharp = (await import('sharp')).default;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const kieKey = process.env.KIE_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  // Normalize both images to PNG
  const basePng = await sharp(baseBuffer).png().toBuffer();
  const overlayPng = await sharp(overlayBuffer).ensureAlpha().png().toBuffer();
  
  const baseMeta = await sharp(basePng).metadata();
  const overlayMeta = await sharp(overlayPng).metadata();
  
  console.log('[SmartComposite] Base:', baseMeta.width, 'x', baseMeta.height);
  console.log('[SmartComposite] Logo:', overlayMeta.width, 'x', overlayMeta.height);
  
  // ═══════════════════════════════════════════════════════════════════
  // PRIMARY: Gemini Native Image Compositing
  // Gemini generates the entire composite — handles placement, blending,
  // lighting, fabric texture, and perspective naturally
  // ═══════════════════════════════════════════════════════════════════
  if (geminiApiKey) {
    console.log('[SmartComposite] Attempting Gemini native compositing...');
    try {
      const geminiResult = await handleGeminiComposite(sharp, basePng, overlayPng, userInstruction, geminiApiKey, kieKey);
      if (geminiResult && geminiResult.success) {
        console.log('[SmartComposite] Gemini compositing SUCCESS');
        return geminiResult;
      }
      console.log('[SmartComposite] Gemini compositing returned no result, falling back to programmatic...');
    } catch (gemErr) {
      console.log('[SmartComposite] Gemini compositing failed:', gemErr.message, '- falling back to programmatic...');
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // FALLBACK: Programmatic Sharp-based compositing
  // Used when Gemini is unavailable or fails
  // ═══════════════════════════════════════════════════════════════════
  console.log('[SmartComposite] Using programmatic (sharp) compositing pipeline...');
  
  if (!openaiApiKey) throw new Error('OpenAI API key required for compositing');
  
  // Create analysis versions — use 1024px for better detail detection
  const analysisMaxDim = 1024;
  let baseForAnalysis = await sharp(basePng)
    .resize(analysisMaxDim, analysisMaxDim, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  
  // ── Draw a visual grid overlay on the analysis image ──
  // This gives GPT-4o Vision precise reference points for coordinate estimation
  try {
    const analysisMeta = await sharp(baseForAnalysis).metadata();
    const aw = analysisMeta.width;
    const ah = analysisMeta.height;
    
    // Create grid overlay SVG with 10% interval lines and labels
    const gridLines = [];
    const gridLabels = [];
    
    // Vertical lines at 10%, 20%, ..., 90%
    for (let pct = 10; pct <= 90; pct += 10) {
      const x = Math.round(aw * pct / 100);
      gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${ah}" stroke="rgba(255,255,0,0.4)" stroke-width="1"/>`);
      gridLabels.push(`<text x="${x + 2}" y="14" fill="rgba(255,255,0,0.8)" font-size="11" font-family="monospace">${pct}%</text>`);
    }
    // Horizontal lines at 10%, 20%, ..., 90%
    for (let pct = 10; pct <= 90; pct += 10) {
      const y = Math.round(ah * pct / 100);
      gridLines.push(`<line x1="0" y1="${y}" x2="${aw}" y2="${y}" stroke="rgba(255,255,0,0.4)" stroke-width="1"/>`);
      gridLabels.push(`<text x="2" y="${y - 2}" fill="rgba(255,255,0,0.8)" font-size="11" font-family="monospace">${pct}%</text>`);
    }
    
    const gridSvg = Buffer.from(
      `<svg width="${aw}" height="${ah}" xmlns="http://www.w3.org/2000/svg">
        ${gridLines.join('\n')}
        ${gridLabels.join('\n')}
      </svg>`
    );
    
    baseForAnalysis = await sharp(baseForAnalysis)
      .composite([{ input: gridSvg, left: 0, top: 0, blend: 'over' }])
      .jpeg({ quality: 85 })
      .toBuffer();
    
    console.log('[SmartComposite] Grid overlay added to analysis image (' + aw + 'x' + ah + ')');
  } catch (gridErr) {
    console.log('[SmartComposite] Grid overlay failed:', gridErr.message, '- using plain image');
    baseForAnalysis = await sharp(baseForAnalysis).jpeg({ quality: 85 }).toBuffer();
  }
  
  const overlayForAnalysis = await sharp(overlayPng)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  
  console.log('[SmartComposite] Analysis images:', baseForAnalysis.length, 'bytes,', overlayForAnalysis.length, 'bytes');
  
  // Detect if this is a replace/swap instruction (needs to find existing graphics)
  const isReplaceRequest = /\b(swap|replace|change|switch)\b/i.test(userInstruction);
  const wantsMultiple = /\b(both|all|each|every|t-?shirts|shirts|items|products|logos|doors|sides)\b/i.test(userInstruction);
  
  // ── Step 1: AI Vision — Analyze base image and get placement JSON ──
  const analysisPrompt = `You are an expert image compositor. Given a BASE IMAGE and a LOGO/DESIGN image, analyze the base image carefully and determine EXACTLY where to place the logo.

THE BASE IMAGE HAS A YELLOW GRID OVERLAY with percentage labels (10%, 20%, ... 90%) on both axes. USE THIS GRID to give precise coordinates. The grid lines show exact percentage positions — reference them when determining x_percent and y_percent.

CRITICAL: Look at the BASE IMAGE very carefully. Identify what objects/surfaces are in it, and WHERE specifically the logo should go based on the user's instructions.

${isReplaceRequest ? `REPLACE/SWAP MODE: The user wants to REPLACE existing graphics/logos/designs with the new logo. You MUST:
1. Look at the base image and identify ALL visible logos, graphics, text designs, or printed artwork
2. Return the EXACT position and size of EACH existing graphic that should be replaced
3. Each placement should match the size and position of the existing graphic it replaces
4. If there are multiple items (e.g., two t-shirts), return a placement for EACH one` : ''}

${wantsMultiple ? `MULTIPLE TARGETS: The user specifically wants the logo placed on MULTIPLE items/surfaces. Return ALL placement positions as separate entries in the placements array.` : ''}

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "scene_description": "<brief 1-line description of what you see in the base image>",
  "placements": [
    {
      "target_description": "<what surface/object this placement is on, e.g. 'left person t-shirt back graphic'>",
      "x_percent": <number 0-100, left edge of placement as % of image width>,
      "y_percent": <number 0-100, top edge of placement as % of image height>,
      "width_percent": <number 3-60, logo width as % of image width>,
      "height_percent": <number 3-60, logo height as % of image height>,
      "rotation_degrees": <number -45 to 45, tilt of the surface baseline vs horizontal. Positive=clockwise, Negative=counter-clockwise. For angled surfaces, measure the visual slope of the edges>,
      "surface_type": <"flat"|"fabric"|"curved"|"vehicle"|"paper"|"metal"|"glass"|"plastic">,
      "surface_angle": <number 0-60, how angled the surface is from the camera. 0=facing directly, 30=moderate angle>,
      "perspective_direction": <"left"|"right"|"none", which side is closer to camera>,
      "opacity": <number 0.7-1.0>,
      "brightness_adjust": <number 0.5-1.5, adjust logo brightness to match the surface lighting. 1.0=no change, <1=darken for dark surfaces, >1=brighten for bright surfaces>
    }
  ],
  "remove_background": <true|false, whether the logo has a background that should be removed>
}

${isReplaceRequest ? `REPLACE/SWAP RULES (CRITICAL):
- Carefully examine the base image and identify EVERY existing graphic, logo, printed design, text, or artwork
- For EACH existing graphic found: return a placement that EXACTLY matches its position, size, and angle
- The x_percent/y_percent should be the TOP-LEFT corner of the existing graphic's bounding box
- The width_percent/height_percent should match the existing graphic's size
- Look pixel-by-pixel at the image: where do you see printed/applied designs?
- For two people wearing shirts: there should be TWO placements (one per shirt)
- For t-shirt backs: the design is typically centered vertically on the upper back between shoulder blades` : ''}

PLACEMENT ACCURACY (THIS IS THE MOST IMPORTANT PART):
- x_percent and y_percent define the TOP-LEFT corner of where the logo goes
- Look at the ACTUAL pixels in the base image to determine positions — do NOT guess
- For "replace" requests: MATCH the exact position of the existing design you see
- For t-shirt backs: the print area is usually between the shoulder blades, spanning 20-35% of the torso width
- For two people side by side: left person is ~10-45% of image width, right person is ~55-90%
- The design center on a t-shirt back is typically at 25-40% from the top of the image (upper back area, NOT lower back)
- SIZE must be proportional — a back print on a t-shirt is typically 12-20% of total image width and 10-18% of image height
- Do NOT make the logo too large — it should look like a natural garment print, NOT a billboard

SURFACE MATCHING:
- For dark surfaces (dark t-shirts, black items): set brightness_adjust = 0.85-0.95 (slightly darken logo)
- For light/white surfaces: set brightness_adjust = 1.0 (no change — keep logo colors vivid)
- For medium surfaces: set brightness_adjust = 0.95
- For fabric: surface_type must be "fabric" — this triggers screen-print blending
- Rotation should match any visible tilt of the surface

IMPORTANT: Return 1 placement if there's 1 target, or MULTIPLE placements if the user wants the logo on multiple items. Look at the image carefully!`;

  let placementData = null;
  let placements = [];
  
  // Try GPT-4o Vision analysis first, then Gemini as fallback
  // (geminiApiKey already defined at function top level)
  
  // Attempt 1: GPT-4o Vision with high detail for better scene understanding
  try {
    const analysisRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `User request: "${userInstruction}"\n\nImage 1 = BASE IMAGE (where logo goes).\nImage 2 = LOGO/DESIGN (to be placed on the base).\n\n${analysisPrompt}` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${baseForAnalysis.toString('base64')}`, detail: 'high' } },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${overlayForAnalysis.toString('base64')}`, detail: 'low' } }
          ]
        }],
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    
    const rawBody = await analysisRes.text();
    if (analysisRes.ok) {
      try {
        const d = JSON.parse(rawBody);
        const rawText = d.choices?.[0]?.message?.content || '';
        if (rawText) {
          placementData = JSON.parse(rawText);
          console.log('[SmartComposite] GPT-4o response:', JSON.stringify(placementData).substring(0, 500));
        }
      } catch (parseErr) {
        console.log('[SmartComposite] GPT-4o parse error:', parseErr.message, '| Raw:', rawBody.substring(0, 300));
      }
    } else {
      try {
        const errData = JSON.parse(rawBody);
        console.log('[SmartComposite] GPT-4o failed:', errData.error?.message || analysisRes.status);
      } catch (e) {
        console.log('[SmartComposite] GPT-4o failed:', analysisRes.status, rawBody.substring(0, 200));
      }
    }
  } catch (e) {
    console.log('[SmartComposite] GPT-4o error:', e.message);
  }
  
  // Attempt 2: Gemini Vision fallback
  if (!placementData && geminiApiKey) {
    console.log('[SmartComposite] Trying Gemini Vision fallback...');
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `User request: "${userInstruction}"\n\nImage 1 = BASE IMAGE (where the logo should be placed).\nImage 2 = LOGO/DESIGN (to be placed on the base image).\n\n${analysisPrompt}` },
                { inline_data: { mime_type: 'image/jpeg', data: baseForAnalysis.toString('base64') } },
                { inline_data: { mime_type: 'image/jpeg', data: overlayForAnalysis.toString('base64') } }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1500,
              responseMimeType: 'application/json'
            }
          })
        }
      );
      
      if (geminiRes.ok) {
        const geminiRawBody = await geminiRes.text();
        try {
          const geminiData = JSON.parse(geminiRawBody);
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText) {
            placementData = JSON.parse(rawText);
            console.log('[SmartComposite] Gemini response:', JSON.stringify(placementData).substring(0, 500));
          }
        } catch (parseErr) {
          console.log('[SmartComposite] Gemini parse error:', parseErr.message);
        }
      } else {
        const errBody = await geminiRes.text().catch(() => '');
        console.log('[SmartComposite] Gemini failed:', geminiRes.status, errBody.substring(0, 200));
      }
    } catch (e) {
      console.log('[SmartComposite] Gemini error:', e.message);
    }
  }
  
  // ── Parse placements from AI response ──
  // Support both new format (placements array) and old format (single object)
  if (placementData) {
    if (Array.isArray(placementData.placements) && placementData.placements.length > 0) {
      placements = placementData.placements;
    } else if (typeof placementData.x_percent === 'number') {
      // Old format: single placement object
      placements = [placementData];
    }
  }
  
  // Fallback: Smart defaults when AI fails
  if (placements.length === 0) {
    console.log('[SmartComposite] Using keyword-based placement defaults');
    const instr = userInstruction.toLowerCase();
    
    let surfaceType = 'flat';
    let xp = 30, yp = 25, wp = 30, hp = 25, rot = 0, opacity = 1.0, brightness = 1.0;
    
    if (/t-?shirt|hoodie|sweater|jacket|jersey|clothing|apparel|garment|dress|shirt/i.test(instr)) {
      surfaceType = 'fabric';
      xp = 30; yp = 30; wp = 30; hp = 22;
      brightness = /dark|black/i.test(instr) ? 0.75 : 1.0;
      // Check if multiple items mentioned
      if (wantsMultiple) {
        placements = [
          { target_description: 'left item', x_percent: 15, y_percent: 30, width_percent: 22, height_percent: 20, rotation_degrees: 0, surface_type: 'fabric', surface_angle: 5, perspective_direction: 'none', opacity: 1.0, brightness_adjust: brightness },
          { target_description: 'right item', x_percent: 55, y_percent: 30, width_percent: 22, height_percent: 20, rotation_degrees: 0, surface_type: 'fabric', surface_angle: 5, perspective_direction: 'none', opacity: 1.0, brightness_adjust: brightness },
        ];
      }
    } else if (/mug|cup|glass|bottle|can|tumbler/i.test(instr)) {
      surfaceType = 'curved'; xp = 25; yp = 25; wp = 40; hp = 35;
    } else if (/van|car|truck|vehicle|bus|minivan|suv|door\s*panel|fender|hood|bumper|windshield/i.test(instr)) {
      surfaceType = 'vehicle'; xp = 15; yp = 30; wp = 25; hp = 20; rot = -4;
    } else if (/box|package|card|paper|poster|sign|banner|billboard/i.test(instr)) {
      surfaceType = 'flat'; xp = 20; yp = 15; wp = 50; hp = 40;
    } else if (/phone|case|cover|laptop|tablet/i.test(instr)) {
      surfaceType = 'flat'; xp = 20; yp = 20; wp = 50; hp = 40;
    }
    
    if (placements.length === 0) {
      placements = [{
        target_description: 'main surface',
        x_percent: xp, y_percent: yp,
        width_percent: wp, height_percent: hp,
        rotation_degrees: rot,
        surface_type: surfaceType,
        surface_angle: surfaceType === 'vehicle' ? 25 : 0,
        perspective_direction: surfaceType === 'vehicle' ? 'left' : 'none',
        opacity: opacity,
        brightness_adjust: brightness,
      }];
    }
  }
  
  // Determine if background should be removed
  const shouldRemoveBg = placementData?.remove_background !== false;
  
  console.log('[SmartComposite] Processing', placements.length, 'placement(s)');
  
  // ── Step 2: Process the logo — remove background if needed ──
  let processedLogo = overlayPng;
  
  if (shouldRemoveBg) {
    try {
      processedLogo = await removeLogoBackground(sharp, overlayPng);
    } catch (bgErr) {
      console.log('[SmartComposite] Background removal failed:', bgErr.message, '- using original');
      processedLogo = await sharp(overlayPng).ensureAlpha().png().toBuffer();
    }
  } else {
    processedLogo = await sharp(overlayPng).ensureAlpha().png().toBuffer();
  }
  
  // ── Step 3: Composite the logo at EACH placement position ──
  let currentBase = basePng;
  
  for (let i = 0; i < placements.length; i++) {
    const pl = placements[i];
    console.log('[SmartComposite] Placement', (i+1) + '/' + placements.length + ':', pl.target_description || 'unknown',
      'at', pl.x_percent + '%,' + pl.y_percent + '%', 'size', pl.width_percent + '%x' + pl.height_percent + '%',
      'rot', pl.rotation_degrees || 0, 'surface', pl.surface_type);
    
    // Clamp values
    pl.x_percent = Math.max(0, Math.min(95, pl.x_percent || 30));
    pl.y_percent = Math.max(0, Math.min(95, pl.y_percent || 30));
    pl.width_percent = Math.max(5, Math.min(70, pl.width_percent || 25));
    pl.height_percent = Math.max(5, Math.min(70, pl.height_percent || 20));
    pl.rotation_degrees = Math.max(-45, Math.min(45, pl.rotation_degrees || 0));
    pl.brightness_adjust = Math.max(0.3, Math.min(1.8, pl.brightness_adjust || 1.0));
    
    try {
      currentBase = await compositeLogoAtPlacement(sharp, currentBase, processedLogo, baseMeta, pl);
    } catch (compErr) {
      console.log('[SmartComposite] Placement', (i+1), 'failed:', compErr.message);
    }
  }
  
  console.log('[SmartComposite] All placements done');
  
  // ── Step 4: Upload result to storage ──
  const result = currentBase;
  let resultUrl = null;
  if (kieKey) {
    try {
      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
        body: JSON.stringify({
          base64Data: `data:image/png;base64,${result.toString('base64')}`,
          uploadPath: 'soulprint/composites',
          fileName: `composite_${Date.now()}.png`
        }),
      });
      if (upRes.ok) {
        const d = await upRes.json();
        if (d.success && d.data?.downloadUrl) {
          resultUrl = d.data.downloadUrl;
          console.log('[SmartComposite] Uploaded to:', resultUrl);
        }
      }
    } catch (e) { 
      console.log('[SmartComposite] Upload failed:', e.message); 
    }
  }
  
  if (!resultUrl) {
    resultUrl = `data:image/png;base64,${result.toString('base64')}`;
  }
  
  return {
    success: true,
    url: resultUrl,
    placement: placements,
    scene_description: placementData?.scene_description || 'Scene analysis completed',
    remove_background: shouldRemoveBg,
    method: 'smart-composite-programmatic'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Remove logo background using flood-fill from edges
// ═══════════════════════════════════════════════════════════════════════════
async function removeLogoBackground(sharp, logoPng) {
  const { data, info } = await sharp(logoPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const pixels = new Uint8Array(data);
  const w = info.width;
  const h = info.height;
  
  // Sample edge pixels to detect background color
  const edgeSamples = [];
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 20))) {
    edgeSamples.push((0 * w + x) * 4);
    edgeSamples.push(((h - 1) * w + x) * 4);
  }
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 20))) {
    edgeSamples.push((y * w + 0) * 4);
    edgeSamples.push((y * w + (w - 1)) * 4);
  }
  
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (const idx of edgeSamples) {
    if (idx + 3 < pixels.length) {
      sumR += pixels[idx]; sumG += pixels[idx + 1]; sumB += pixels[idx + 2];
      count++;
    }
  }
  const bgR = count > 0 ? Math.round(sumR / count) : 0;
  const bgG = count > 0 ? Math.round(sumG / count) : 0;
  const bgB = count > 0 ? Math.round(sumB / count) : 0;
  
  const threshold = 50;
  const colorDist = (i) => Math.sqrt(
    Math.pow(pixels[i] - bgR, 2) + Math.pow(pixels[i + 1] - bgG, 2) + Math.pow(pixels[i + 2] - bgB, 2)
  );
  
  // BFS flood fill from edges
  const visited = new Uint8Array(w * h);
  const queue = [];
  for (let x = 0; x < w; x++) { queue.push(x); queue.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { queue.push(y * w); queue.push(y * w + (w - 1)); }
  
  for (const pixelIdx of queue) {
    if (pixelIdx >= 0 && pixelIdx < w * h) {
      const rgba = pixelIdx * 4;
      if (rgba + 3 < pixels.length && colorDist(rgba) < threshold) visited[pixelIdx] = 1;
    }
  }
  
  const floodQueue = queue.filter(idx => visited[idx] === 1);
  let fqi = 0;
  while (fqi < floodQueue.length) {
    const pos = floodQueue[fqi++];
    const x = pos % w, y = Math.floor(pos / w);
    const neighbors = [];
    if (x > 0) neighbors.push(pos - 1);
    if (x < w - 1) neighbors.push(pos + 1);
    if (y > 0) neighbors.push(pos - w);
    if (y < h - 1) neighbors.push(pos + w);
    for (const n of neighbors) {
      if (n >= 0 && n < w * h && visited[n] === 0) {
        const rgba = n * 4;
        if (rgba + 3 < pixels.length && colorDist(rgba) < threshold) {
          visited[n] = 1;
          floodQueue.push(n);
        }
      }
    }
  }
  
  let bgPixelCount = 0;
  for (let i = 0; i < w * h; i++) {
    const rgba = i * 4;
    if (visited[i] === 1) {
      pixels[rgba + 3] = 0;
      bgPixelCount++;
    } else {
      const dist = colorDist(rgba);
      if (dist < threshold * 0.5) { pixels[rgba + 3] = 0; bgPixelCount++; }
      else if (dist < threshold) { pixels[rgba + 3] = Math.min(pixels[rgba + 3], Math.round((dist / threshold) * 255)); }
    }
  }
  
  const result = await sharp(Buffer.from(pixels), { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  console.log('[SmartComposite] Background removed:', ((bgPixelCount / (w * h)) * 100).toFixed(1) + '% pixels (bg:', bgR + ',' + bgG + ',' + bgB + ')');
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Composite logo at a single placement position with full blending
// ═══════════════════════════════════════════════════════════════════════════
async function compositeLogoAtPlacement(sharp, baseBuffer, processedLogo, baseMeta, pl) {
  const targetW = Math.round(baseMeta.width * pl.width_percent / 100);
  const targetH = Math.round(baseMeta.height * pl.height_percent / 100);
  let targetX = Math.round(baseMeta.width * pl.x_percent / 100);
  let targetY = Math.round(baseMeta.height * pl.y_percent / 100);
  
  // Resize logo to target dimensions (maintain aspect ratio)
  let resizedLogo = await sharp(processedLogo)
    .resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  const resizedMeta = await sharp(resizedLogo).metadata();
  if (resizedMeta.width < targetW) targetX += Math.round((targetW - resizedMeta.width) / 2);
  if (resizedMeta.height < targetH) targetY += Math.round((targetH - resizedMeta.height) / 2);
  
  // Apply brightness adjustment to match surface lighting
  if (pl.brightness_adjust && Math.abs(pl.brightness_adjust - 1.0) > 0.05) {
    resizedLogo = await sharp(resizedLogo)
      .modulate({ brightness: pl.brightness_adjust })
      .png()
      .toBuffer();
  }
  
  // Apply rotation if needed
  if (pl.rotation_degrees && Math.abs(pl.rotation_degrees) > 0.5) {
    const preRotMeta = await sharp(resizedLogo).metadata();
    const centerX = targetX + Math.round(preRotMeta.width / 2);
    const centerY = targetY + Math.round(preRotMeta.height / 2);
    
    resizedLogo = await sharp(resizedLogo)
      .rotate(pl.rotation_degrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    const postRotMeta = await sharp(resizedLogo).metadata();
    targetX = centerX - Math.round(postRotMeta.width / 2);
    targetY = centerY - Math.round(postRotMeta.height / 2);
  }
  
  // Apply perspective transform for angled surfaces
  const surfaceAngle = pl.surface_angle || 0;
  const perspDir = pl.perspective_direction || 'none';
  
  if (surfaceAngle > 3 && perspDir !== 'none') {
    try {
      const logoMeta = await sharp(resizedLogo).metadata();
      const logoW = logoMeta.width;
      const logoH = logoMeta.height;
      const angleRad = (surfaceAngle * Math.PI) / 180;
      const perspFactor = Math.cos(angleRad);
      const nearScale = 1.0, farScale = perspFactor;
      const horzScale = (nearScale + farScale) / 2;
      const newW = Math.round(logoW * horzScale);
      
      const { data: srcData, info: srcInfo } = await sharp(resizedLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const src = new Uint8Array(srcData);
      const srcW = srcInfo.width, srcH = srcInfo.height;
      const dstW = newW, dstH = srcH;
      const dst = new Uint8Array(dstW * dstH * 4);
      
      for (let x = 0; x < dstW; x++) {
        const srcX = Math.min(srcW - 1, Math.round((x / dstW) * srcW));
        let t = x / dstW;
        let colScale = perspDir === 'left' ? nearScale - (nearScale - farScale) * t : farScale + (nearScale - farScale) * t;
        const colH = Math.round(srcH * colScale);
        const yOffset = Math.round((srcH - colH) / 2);
        for (let y = 0; y < dstH; y++) {
          const dstIdx = (y * dstW + x) * 4;
          const localY = y - yOffset;
          if (localY < 0 || localY >= colH) {
            dst[dstIdx] = 0; dst[dstIdx+1] = 0; dst[dstIdx+2] = 0; dst[dstIdx+3] = 0;
          } else {
            const srcY = Math.min(srcH - 1, Math.round((localY / colH) * srcH));
            const srcIdx = (srcY * srcW + srcX) * 4;
            dst[dstIdx] = src[srcIdx]; dst[dstIdx+1] = src[srcIdx+1]; dst[dstIdx+2] = src[srcIdx+2]; dst[dstIdx+3] = src[srcIdx+3];
          }
        }
      }
      
      resizedLogo = await sharp(Buffer.from(dst), { raw: { width: dstW, height: dstH, channels: 4 } }).png().toBuffer();
      console.log('[SmartComposite] Perspective: angle=' + surfaceAngle + '° dir=' + perspDir);
    } catch (perspErr) {
      console.log('[SmartComposite] Perspective failed:', perspErr.message);
    }
  }
  
  // Get final logo dimensions
  const finalLogoMeta = await sharp(resizedLogo).metadata();
  const logoW = finalLogoMeta.width;
  const logoH = finalLogoMeta.height;
  
  // Clamp position to stay within image bounds
  targetX = Math.max(0, Math.min(baseMeta.width - logoW, targetX));
  targetY = Math.max(0, Math.min(baseMeta.height - logoH, targetY));
  
  // ═══════════════════════════════════════════════════════════════
  // SCREEN PRINT SIMULATION — makes logo look PRINTED on the surface
  // The key: fabric texture modulates the logo's brightness pixel-by-pixel
  // ═══════════════════════════════════════════════════════════════
  
  const isFabric = (pl.surface_type === 'fabric');
  
  // Extract the surface patch where logo will go
  let surfacePatch = null;
  try {
    const extractLeft = Math.max(0, targetX);
    const extractTop = Math.max(0, targetY);
    const extractW = Math.min(logoW, baseMeta.width - extractLeft);
    const extractH = Math.min(logoH, baseMeta.height - extractTop);
    if (extractW > 0 && extractH > 0) {
      surfacePatch = await sharp(baseBuffer)
        .extract({ left: extractLeft, top: extractTop, width: extractW, height: extractH })
        .resize(logoW, logoH, { fit: 'fill' })
        .raw()
        .toBuffer();
    }
  } catch (e) {
    console.log('[SmartComposite] Surface patch extraction failed:', e.message);
  }
  
  // Get logo raw pixels
  const { data: logoRaw, info: logoInfo } = await sharp(resizedLogo)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const logoPx = new Uint8Array(logoRaw);
  const lw = logoInfo.width, lh = logoInfo.height;
  
  if (surfacePatch && isFabric) {
    // ── FABRIC SCREEN PRINT MODE ──
    // Real screen printing: opaque ink sits ON the fabric. The fabric's texture
    // (wrinkles, folds) subtly affects the print brightness but the ink is mostly solid.
    
    const surfPx = new Uint8Array(surfacePatch);
    
    // Calculate surface luminance stats for normalization
    let minLum = 255, maxLum = 0, sumLum = 0, lumCount = 0;
    for (let i = 0; i < lw * lh; i++) {
      const si = i * 3; // surface is RGB (no alpha from raw)
      if (si + 2 < surfPx.length) {
        const lum = 0.299 * surfPx[si] + 0.587 * surfPx[si + 1] + 0.114 * surfPx[si + 2];
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
        sumLum += lum;
        lumCount++;
      }
    }
    const avgLum = lumCount > 0 ? sumLum / lumCount : 128;
    const lumRange = Math.max(1, maxLum - minLum);
    
    console.log('[SmartComposite] Surface luminance: min=' + minLum.toFixed(0) + ' max=' + maxLum.toFixed(0) + ' avg=' + avgLum.toFixed(0));
    
    // Create texture-modulated logo
    const outputPx = new Uint8Array(logoPx.length);
    
    for (let i = 0; i < lw * lh; i++) {
      const li = i * 4; // logo RGBA
      const si = i * 3; // surface RGB
      
      if (li + 3 >= logoPx.length || logoPx[li + 3] === 0) {
        outputPx[li] = 0; outputPx[li+1] = 0; outputPx[li+2] = 0; outputPx[li+3] = 0;
        continue;
      }
      
      // Get surface luminance at this pixel (normalized 0-1)
      let surfLum = 0.5;
      if (si + 2 < surfPx.length) {
        const rawLum = 0.299 * surfPx[si] + 0.587 * surfPx[si + 1] + 0.114 * surfPx[si + 2];
        surfLum = (rawLum - minLum) / lumRange; // 0 to 1
      }
      
      // SUBTLE texture modulation — ink is mostly solid, wrinkles only slightly affect it
      // Range: 0.85 (deep wrinkle/shadow) to 1.0 (normal/highlight)
      // This is intentionally subtle — real screen prints are opaque
      const textureFactor = 0.85 + surfLum * 0.15;
      
      // Apply texture modulation to logo RGB
      outputPx[li] = Math.min(255, Math.round(logoPx[li] * textureFactor));
      outputPx[li+1] = Math.min(255, Math.round(logoPx[li+1] * textureFactor));
      outputPx[li+2] = Math.min(255, Math.round(logoPx[li+2] * textureFactor));
      
      // Edge feathering: reduce alpha near transparent neighbors (2px radius)
      let nearestTransDist = 999;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (i % lw) + dx, ny = Math.floor(i / lw) + dy;
          if (nx >= 0 && nx < lw && ny >= 0 && ny < lh) {
            const ni = (ny * lw + nx) * 4;
            if (ni + 3 < logoPx.length && logoPx[ni + 3] === 0) {
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist < nearestTransDist) nearestTransDist = dist;
            }
          }
        }
      }
      
      if (nearestTransDist <= 2) {
        // Edge pixel — smooth alpha falloff for soft edges
        const edgeFactor = nearestTransDist / 2.5;
        outputPx[li+3] = Math.round(logoPx[li+3] * edgeFactor * 0.9);
      } else {
        // Interior pixel — nearly full opacity (screen print ink is opaque)
        outputPx[li+3] = logoPx[li+3];
      }
    }
    
    const texturedLogo = await sharp(Buffer.from(outputPx), { raw: { width: lw, height: lh, channels: 4 } }).png().toBuffer();
    
    // Composite using clean layering for fabric — texture is already baked into the logo
    const compositeOps = [];
    
    // Layer 1: Very subtle shadow for depth (keeps it grounded on the surface)
    try {
      const shadowLogo = await sharp(texturedLogo).blur(2).modulate({ brightness: 0.2 }).png().toBuffer();
      const { data: shRaw, info: shInfo } = await sharp(shadowLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const shPx = new Uint8Array(shRaw);
      for (let i = 3; i < shPx.length; i += 4) { shPx[i] = Math.round(shPx[i] * 0.25); }
      const shadowLayer = await sharp(Buffer.from(shPx), { raw: { width: shInfo.width, height: shInfo.height, channels: 4 } }).png().toBuffer();
      compositeOps.push({
        input: shadowLayer,
        left: Math.min(baseMeta.width - 1, targetX + 1),
        top: Math.min(baseMeta.height - 1, targetY + 1),
        blend: 'multiply',
      });
    } catch (e) { /* optional */ }
    
    // Layer 2: Main textured logo — this IS the screen print (full opacity, texture already applied)
    compositeOps.push({
      input: texturedLogo,
      left: targetX,
      top: targetY,
      blend: 'over',
    });
    
    console.log('[SmartComposite] Fabric screen-print compositing with', compositeOps.length, 'layers at', targetX + ',' + targetY);
    
    return await sharp(baseBuffer).composite(compositeOps).png().toBuffer();
    
  } else {
    // ── STANDARD MODE (non-fabric: vehicle, flat, etc.) ──
    
    // Edge softening
    for (let y = 1; y < lh - 1; y++) {
      for (let x = 1; x < lw - 1; x++) {
        const idx = (y * lw + x) * 4;
        if (logoPx[idx + 3] > 0) {
          const neighbors = [((y-1)*lw+x)*4, ((y+1)*lw+x)*4, (y*lw+(x-1))*4, (y*lw+(x+1))*4];
          let hasTransparent = false;
          for (const ni of neighbors) {
            if (ni >= 0 && ni + 3 < logoPx.length && logoPx[ni + 3] === 0) { hasTransparent = true; break; }
          }
          if (hasTransparent) logoPx[idx + 3] = Math.round(logoPx[idx + 3] * 0.65);
        }
      }
    }
    const softLogo = await sharp(Buffer.from(logoPx), { raw: { width: lw, height: lh, channels: 4 } }).png().toBuffer();
    
    const compositeOps = [];
    
    // Shadow
    try {
      const shadowLogo = await sharp(softLogo).blur(3).modulate({ brightness: 0.3 }).png().toBuffer();
      compositeOps.push({
        input: shadowLogo,
        left: Math.min(baseMeta.width - 1, targetX + 2),
        top: Math.min(baseMeta.height - 1, targetY + 2),
        blend: 'multiply',
      });
    } catch (e) { /* optional */ }
    
    // Multiply blend
    try {
      const { data: mulRaw, info: mulInfo } = await sharp(softLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const mp = new Uint8Array(mulRaw);
      for (let i = 3; i < mp.length; i += 4) { mp[i] = Math.round(mp[i] * 0.35); }
      const multiplyLayer = await sharp(Buffer.from(mp), { raw: { width: mulInfo.width, height: mulInfo.height, channels: 4 } }).png().toBuffer();
      compositeOps.push({ input: multiplyLayer, left: targetX, top: targetY, blend: 'multiply' });
    } catch (e) {}
    
    // Main logo
    try {
      const { data: mainRaw, info: mainInfo } = await sharp(softLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const mainPx = new Uint8Array(mainRaw);
      for (let i = 3; i < mainPx.length; i += 4) { mainPx[i] = Math.round(mainPx[i] * 0.78); }
      const mainLayer = await sharp(Buffer.from(mainPx), { raw: { width: mainInfo.width, height: mainInfo.height, channels: 4 } }).png().toBuffer();
      compositeOps.push({ input: mainLayer, left: targetX, top: targetY, blend: 'over' });
    } catch (e) {
      compositeOps.push({ input: softLogo, left: targetX, top: targetY, blend: 'over' });
    }
    
    // Soft-light
    try {
      const { data: hlRaw, info: hlInfo } = await sharp(softLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const hp = new Uint8Array(hlRaw);
      for (let i = 3; i < hp.length; i += 4) { hp[i] = Math.round(hp[i] * 0.15); }
      const highlightLayer = await sharp(Buffer.from(hp), { raw: { width: hlInfo.width, height: hlInfo.height, channels: 4 } }).png().toBuffer();
      compositeOps.push({ input: highlightLayer, left: targetX, top: targetY, blend: 'soft-light' });
    } catch (e) { /* optional */ }
    
    console.log('[SmartComposite] Standard compositing with', compositeOps.length, 'layers at', targetX + ',' + targetY);
    
    return await sharp(baseBuffer).composite(compositeOps).png().toBuffer();
  }
}


// Helper: Get connection by account email

export const maxDuration = 300; // 5 minutes max for this route (large file processing)
export const dynamic = 'force-dynamic';

// ============================================================
// RATE LIMITING
// ============================================================
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMITS = {
  chat: 30, // 30 requests per minute
  auth: 10, // 10 login attempts per minute
  export: 5, // 5 exports per minute
  default: 60, // 60 requests per minute for other endpoints
};

function checkRateLimit(identifier, type = 'default') {
  const key = `${identifier}:${type}`;
  const now = Date.now();
  const limit = RATE_LIMITS[type] || RATE_LIMITS.default;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: limit - 1 };
  }
  
  const record = rateLimitStore.get(key);
  
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
    return { allowed: true, remaining: limit - 1 };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  
  record.count++;
  return { allowed: true, remaining: limit - record.count };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

// ============================================================
// DATA IMPORT ANALYSIS (ChatGPT / Facebook)
// ============================================================

// Parse ChatGPT export ZIP and extract conversations
async function parseChatGPTExport(zipBuffer) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  
  let conversations = [];
  let userMessages = [];
  
  for (const entry of entries) {
    if (entry.entryName.endsWith('conversations.json') || entry.entryName === 'conversations.json') {
      try {
        const content = entry.getData().toString('utf8');
        const data = JSON.parse(content);
        
        if (Array.isArray(data)) {
          for (const conv of data) {
            const title = conv.title || 'Untitled';
            const mapping = conv.mapping || {};
            
            for (const [, node] of Object.entries(mapping)) {
              if (node?.message?.author?.role === 'user' && node?.message?.content?.parts) {
                const text = node.message.content.parts.join(' ').trim();
                if (text && text.length > 10) {
                  userMessages.push(text);
                }
              }
            }
            conversations.push({ title, messageCount: Object.keys(mapping).length });
          }
        }
      } catch (e) {
        console.error('Error parsing conversations.json:', e.message);
      }
    }
  }
  
  return { 
    source: 'chatgpt', 
    conversationCount: conversations.length, 
    userMessageCount: userMessages.length,
    sampleMessages: userMessages.slice(0, 100), // Limit for analysis
    conversations: conversations.slice(0, 50)
  };
}

// Parse Facebook export ZIP and extract messages/posts
async function parseFacebookExport(zipBuffer) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  
  let messages = [];
  let posts = [];
  
  for (const entry of entries) {
    const name = entry.entryName.toLowerCase();
    
    // Parse messages
    if (name.includes('messages/') && name.endsWith('.json')) {
      try {
        const content = entry.getData().toString('utf8');
        const data = JSON.parse(content);
        
        if (data.messages && Array.isArray(data.messages)) {
          for (const msg of data.messages) {
            if (msg.content && msg.sender_name) {
              // Decode Facebook's encoding
              const text = decodeURIComponent(escape(msg.content));
              if (text.length > 10) {
                messages.push({ text, sender: msg.sender_name });
              }
            }
          }
        }
      } catch (e) { /* skip invalid files */ }
    }
    
    // Parse posts
    if ((name.includes('posts/') || name.includes('your_posts')) && name.endsWith('.json')) {
      try {
        const content = entry.getData().toString('utf8');
        const data = JSON.parse(content);
        
        const postArray = Array.isArray(data) ? data : (data.posts || data.status_updates || []);
        for (const post of postArray) {
          const text = post.data?.[0]?.post || post.post || post.title || '';
          if (text && text.length > 10) {
            posts.push(decodeURIComponent(escape(text)));
          }
        }
      } catch (e) { /* skip invalid files */ }
    }
  }
  
  return {
    source: 'facebook',
    messageCount: messages.length,
    postCount: posts.length,
    sampleMessages: messages.slice(0, 100),
    samplePosts: posts.slice(0, 50)
  };
}

// Analyze communication style using LLM
async function analyzeCommmunicationStyle(parsedData, existingProfile = null) {
  const provider = getProvider('openai', 'gpt-4o-mini');
  
  let sampleText = '';
  // Handle both sampleMessages (from full parsing) and userMessages (from batch processing)
  const messages = parsedData.sampleMessages || parsedData.userMessages || [];
  const posts = parsedData.samplePosts || [];
  
  if (parsedData.source === 'chatgpt' || parsedData.source === 'unknown') {
    sampleText = messages.slice(0, 50).join('\n---\n');
  } else if (parsedData.source === 'facebook') {
    const msgTexts = messages.slice(0, 30).map(m => typeof m === 'string' ? m : m.text).filter(Boolean).join('\n---\n');
    const postTexts = posts.slice(0, 20).join('\n---\n');
    sampleText = `MESSAGES:\n${msgTexts}\n\nPOSTS:\n${postTexts}`;
  }
  
  if (!sampleText || sampleText.length < 50) {
    return { error: 'Not enough data to analyze. Please ensure your export contains conversation history.' };
  }
  
  const analysisPrompt = `Analyze the following user-written content and extract insights about their communication style and personality. This is from their ${parsedData.source === 'chatgpt' ? 'ChatGPT conversation history' : 'Facebook messages and posts'}.

CONTENT TO ANALYZE:
${sampleText.substring(0, 12000)}

Provide a JSON response with the following structure:
{
  "summary": "A 2-3 sentence friendly summary of what you learned about this person",
  "communicationStyle": {
    "formality": "formal/casual/mixed",
    "verbosity": "concise/detailed/balanced",
    "tone": "analytical/emotional/supportive/humorous/direct/mixed",
    "description": "Brief description of their communication style"
  },
  "interests": ["list", "of", "topics", "they", "discuss", "often"],
  "vocabulary": {
    "complexity": "simple/moderate/sophisticated",
    "uniquePhrases": ["any", "distinctive", "phrases", "they", "use"],
    "emoji_usage": "frequent/occasional/rare/none"
  },
  "questionStyle": "How they tend to ask questions (direct, context-heavy, etc)",
  "insights": [
    "Specific insight 1 about their personality or preferences",
    "Specific insight 2",
    "Specific insight 3"
  ]
}

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await provider.generateChatCompletion({
      systemPrompt: 'You are an expert at analyzing communication patterns and personality from text. Return only valid JSON.',
      messages: [{ role: 'user', content: analysisPrompt }],
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });
    
    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { error: 'Could not parse analysis' };
  } catch (e) {
    console.error('Analysis error:', e);
    return { error: e.message };
  }
}

// ============================================================
// Detect URLs in text
// ============================================================
// GOOGLE PLACES API
// ============================================================

const PLACE_TYPES = {
  restaurant: 'restaurant',
  restaurants: 'restaurant',
  food: 'restaurant',
  cafe: 'cafe',
  coffee: 'cafe',
  bar: 'bar',
  bars: 'bar',
  pub: 'bar',
  hotel: 'lodging',
  hotels: 'lodging',
  lodging: 'lodging',
  gas: 'gas_station',
  gasstation: 'gas_station',
  fuel: 'gas_station',
  pharmacy: 'pharmacy',
  hospital: 'hospital',
  doctor: 'doctor',
  dentist: 'dentist',
  gym: 'gym',
  fitness: 'gym',
  bank: 'bank',
  atm: 'atm',
  grocery: 'supermarket',
  supermarket: 'supermarket',
  store: 'store',
  shopping: 'shopping_mall',
  mall: 'shopping_mall',
  park: 'park',
  museum: 'museum',
  library: 'library',
  movie: 'movie_theater',
  movies: 'movie_theater',
  cinema: 'movie_theater',
  cinemas: 'movie_theater',
  theater: 'movie_theater',
  theaters: 'movie_theater',
  'movie theater': 'movie_theater',
  'movie theaters': 'movie_theater',
  parking: 'parking',
  airport: 'airport',
  trainstation: 'train_station',
  busstation: 'bus_station',
  subway: 'subway_station',
  church: 'church',
  mosque: 'mosque',
  temple: 'hindu_temple',
  synagogue: 'synagogue',
  school: 'school',
  university: 'university',
  spa: 'spa',
  salon: 'beauty_salon',
  haircut: 'hair_care',
  laundry: 'laundry',
  carwash: 'car_wash',
  mechanic: 'car_repair',
};

// Geocode an address to coordinates
// Get location from IP address (automatic, no user action required)
async function getLocationFromIP(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null; // Skip local/private IPs
  }
  
  try {
    // Use ip-api.com (free, no API key required, 45 requests/minute)
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,timezone`);
    const data = await res.json();
    
    if (data.status === 'success' && data.lat && data.lon) {
      return {
        lat: data.lat,
        lng: data.lon,
        city: data.city,
        region: data.regionName,
        country: data.country,
        timezone: data.timezone,
        address: [data.city, data.regionName, data.country].filter(Boolean).join(', '),
        source: 'ip_auto'
      };
    }
  } catch (e) {
    console.error('IP geolocation error:', e.message);
  }
  return null;
}

// Get client IP from request headers
function getClientIP(request) {
  // Check various headers that might contain the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first (client) one
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  
  const cfIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfIP) return cfIP;
  
  return null;
}

// Search for nearby places
// Get place details
// Format places for Telegram message

// Parse location query from text
// Extract search type from query
// ============================================================
// HELPERS
// ============================================================

async function authenticate(request) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return null;
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }
    const db = await getDb();
    const user = await db.collection('users').findOne({ id: decoded.userId });
    if (user) {
      await db.collection('users').updateOne(
        { id: decoded.userId },
        { $set: { last_active_at: new Date() } }
      );
    }
    return user;
  } catch (err) {
    console.error('[Auth] Authentication error:', err.message);
    return null;
  }
}

async function requireAdmin(request) {
  const user = await authenticate(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) return null;
  return user;
}

function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}
function err(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ============================================================
// SMART MODE - AI MODEL ROUTER
// ============================================================

// Model capabilities and use cases
const SMART_MODE_MODELS = {
  // Real-time information and research queries
  'sonar-pro': { 
    triggers: ['news', 'today', 'current', 'latest', 'price', 'weather', 'stock', 'live', 'happening now', 'right now', 'tell me about', 'what is', 'who is', 'what can you tell', 'find out about', 'search for', 'look up', 'information about', 'info about', 'details about', 'learn about'],
    capabilities: ['real-time', 'web-search', 'current-events', 'research'],
    provider: 'perplexity'
  },
  // Creative writing
  'claude-sonnet-4-5-20250929': {
    triggers: ['write', 'story', 'poem', 'creative', 'essay', 'blog', 'article', 'content', 'script', 'novel'],
    capabilities: ['creative-writing', 'long-form', 'nuanced'],
    provider: 'anthropic'
  },
  // Code and technical
  'gpt-4o': {
    triggers: ['code', 'debug', 'programming', 'function', 'api', 'bug', 'error', 'implement', 'build', 'develop'],
    capabilities: ['coding', 'technical', 'problem-solving'],
    provider: 'openai'
  },
  // Deep reasoning and analysis
  'claude-opus-4-5-20251101': {
    triggers: ['analyze', 'explain in detail', 'comprehensive', 'research', 'deep dive', 'thorough', 'complex'],
    capabilities: ['deep-reasoning', 'analysis', 'research'],
    provider: 'anthropic'
  },
  // Quick simple queries (cost-effective)
  'gpt-4o-mini': {
    triggers: ['simple', 'quick', 'basic', 'short', 'brief'],
    capabilities: ['fast', 'cheap', 'simple-queries'],
    provider: 'openai'
  },
  // Math and logic
  'gemini-2.5-pro': {
    triggers: ['math', 'calculate', 'equation', 'formula', 'logic', 'proof', 'solve'],
    capabilities: ['math', 'logic', 'reasoning'],
    provider: 'gemini'
  },
};

// Classify query and determine best model
async function classifyQueryForSmartMode(content, conversationHistory = []) {
  const lowerContent = content.toLowerCase();
  
  // First, check for explicit triggers (fast path)
  for (const [model, config] of Object.entries(SMART_MODE_MODELS)) {
    for (const trigger of config.triggers) {
      if (lowerContent.includes(trigger)) {
        return { 
          model, 
          provider: config.provider, 
          reason: `Detected "${trigger}" - using ${model} for ${config.capabilities[0]}`,
          confidence: 'high'
        };
      }
    }
  }
  
  // Check for image/vision content (only if there seems to be an attachment reference)
  if (lowerContent.includes('look at this') || lowerContent.includes('in this image') || lowerContent.includes('analyze this')) {
    return { model: 'gpt-4o', provider: 'openai', reason: 'Vision capabilities needed', confidence: 'high' };
  }
  
  // Skip simple keyword detection for image/video generation - let the main detector handle it
  // This prevents false positives when users are discussing features or making lists
  
  // For longer queries, use AI classification (slower but more accurate)
  if (content.length > 100) {
    try {
      const { getProvider } = await import('@/lib/llm/providers');
      const classifier = getProvider('openai', 'gpt-4o-mini');
      
      const classificationPrompt = `Classify this user query and determine the best AI model to use.

Query: "${content.slice(0, 500)}"

Choose the BEST model:
1. sonar-pro (Perplexity) - BEST FOR: Research queries, "what is X", "who is X", "tell me about X", company/product/person info, current events, news, prices, weather, anything needing web search or factual lookup
2. claude-sonnet-4-5-20250929 (Anthropic) - Creative writing, stories, essays, blog posts, nuanced content
3. gpt-4o (OpenAI) - Code, debugging, technical implementation, programming help
4. claude-opus-4-5-20251101 (Anthropic) - Deep analysis, complex reasoning, thorough explanations
5. gpt-4o-mini (OpenAI) - Quick simple queries, basic conversational tasks
6. gemini-2.5-pro (Google) - Math, calculations, equations, logical reasoning

IMPORTANT: If the query asks about a company, product, service, person, concept, or anything that requires factual lookup - ALWAYS choose sonar-pro.

Respond with ONLY a JSON object:
{"model": "model-name", "reason": "brief reason"}`;

      const result = await classifier.generateChatCompletion({
        systemPrompt: 'You are a model router. Respond only with valid JSON.',
        messages: [{ role: 'user', content: classificationPrompt }],
        model: 'gpt-4o-mini',
        temperature: 0.1,
      });
      
      const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
      const modelConfig = SMART_MODE_MODELS[parsed.model];
      
      if (modelConfig) {
        return { 
          model: parsed.model, 
          provider: modelConfig.provider, 
          reason: parsed.reason,
          confidence: 'ai-classified'
        };
      }
    } catch (e) {
      console.log('Smart mode AI classification failed, using default:', e.message);
    }
  }
  
  // Default to GPT-4o for general queries
  return { 
    model: 'gpt-4o', 
    provider: 'openai', 
    reason: 'General query - using GPT-4o',
    confidence: 'default'
  };
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

// AUTH - Register
async function handleRegister(request) {
  const body = await request.json();
  const { email, passcode, access_code } = body;
  if (!email || !passcode) return err('Email and passcode required');

  const db = await getDb();
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return err('Email already registered');

  const userId = uuidv4();
  const hashed = await hashPassword(passcode);
  const now = new Date();

  // Check if this is first user -> make superadmin
  const count = await db.collection('users').countDocuments();
  const role = count === 0 ? 'superadmin' : 'user';

  // Check if valid beta code was provided (v2 codes first, then legacy)
  let acceptedViaBetaCode = false;
  let usedCodeId = null;
  if (access_code && role !== 'superadmin') {
    // Try v2 codes first
    const v2Code = await db.collection('beta_codes_v2').findOne({ 
      code: access_code.toUpperCase().trim(),
      active: true,
    });
    
    console.log('[Beta Code] Checking code:', access_code, 'Found:', v2Code ? 'yes' : 'no');
    
    if (v2Code) {
      // Check expiration
      const isExpired = v2Code.expires_at && new Date(v2Code.expires_at) < new Date();
      // Check usage - support both 'uses' and 'uses_count' field names
      const currentUses = v2Code.uses_count ?? v2Code.uses ?? 0;
      const isExhausted = v2Code.max_uses && currentUses >= v2Code.max_uses;
      
      console.log('[Beta Code] Code details - expired:', isExpired, 'uses:', currentUses, '/', v2Code.max_uses, 'exhausted:', isExhausted);
      
      if (!isExpired && !isExhausted) {
        acceptedViaBetaCode = true;
        usedCodeId = v2Code._id || v2Code.id;
        // Increment usage count - update both field names for compatibility
        await db.collection('beta_codes_v2').updateOne(
          { code: access_code.toUpperCase().trim() },
          { $inc: { uses: 1, uses_count: 1 } }
        );
        console.log('[Beta Code] Accepted code:', access_code, 'for user:', email);
      } else {
        console.log('[Beta Code] Code rejected - expired:', isExpired, 'exhausted:', isExhausted);
      }
    } else {
      // Fallback to legacy code
      const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
      if (betaCode && betaCode.code && 
          betaCode.code.toUpperCase() === access_code.toUpperCase().trim() &&
          (!betaCode.expires_at || new Date(betaCode.expires_at) >= new Date())) {
        acceptedViaBetaCode = true;
        // Increment usage count
        await db.collection('beta_codes').updateOne(
          { id: 'current' },
          { $inc: { uses: 1 } }
        );
        console.log('[Beta Code] Accepted legacy code:', access_code, 'for user:', email);
      } else {
        console.log('[Beta Code] Invalid code:', access_code, 'for user:', email);
      }
    }
  }

  await db.collection('users').insertOne({
    id: userId,
    email: email.toLowerCase(),
    passcode_hash: hashed,
    role,
    accepted: true,
    created_at: now,
    last_active_at: now,
    access_code_used: access_code || null,
    beta_code_used: acceptedViaBetaCode ? access_code : null,
    beta_code_id: usedCodeId,
    auth_provider: 'legacy',
  });

  // Record beta code redemption if v2 code was used
  if (usedCodeId) {
    await db.collection('beta_code_redemptions').insertOne({
      id: uuidv4(),
      code_id: usedCodeId,
      code: access_code.toUpperCase().trim(),
      user_id: userId,
      user_email: email.toLowerCase(),
      redeemed_at: now,
    });
  }

  // Create empty profile
  await db.collection('profiles').insertOne({
    user_id: userId,
    display_name: '',
    assistant_name: 'SoulPrint',
    descriptors: [],
    field: '',
    help_with: [],
    discovery_source: '',
    soul_profile_summary: '',
    onboarding_complete: false,
    assessment_complete: false,
    created_at: now,
  });

  const token = generateToken(userId);
  
  // Send welcome email (non-blocking)
  sendWelcomeEmail(email, null).catch(e => console.error('Welcome email failed:', e));
  
  // Send new user notification email to admin (non-blocking)
  sendNewUserNotificationEmail({
    email: email.toLowerCase(),
    beta_code_used: acceptedViaBetaCode ? access_code : null,
    accepted: true,
  }).catch(e => console.error('Admin notification email failed:', e));
  
  return ok({ 
    token, 
    userId, 
    role, 
    accepted: true,
    onboarding_complete: false,
    assessment_complete: false,
  });
}

// AUTH - Login
async function handleLogin(request) {
  const body = await request.json();
  const { email, passcode } = body;
  if (!email || !passcode) return err('Email and passcode required');

  // Rate limit by email to prevent brute force
  const rateCheck = checkRateLimit(email.toLowerCase(), 'auth');
  if (!rateCheck.allowed) {
    return err(`Too many login attempts. Try again in ${rateCheck.retryAfter} seconds.`, 429);
  }

  const db = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return err('User not found', 404);  // distinct from wrong password

  const valid = await comparePassword(passcode, user.passcode_hash);
  if (!valid) return err('Invalid credentials', 401);

  // Check email verification (skip for admins and existing verified users)
  // Also skip for users created before email verification was implemented
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const isLegacyUser = !user.hasOwnProperty('email_verified'); // Users created before this feature
  if (!isAdmin && !isLegacyUser && user.email_verified === false) {
    return err('Please verify your email before signing in. Check your inbox for the verification link.', 403);
  }

  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { last_active_at: new Date() } }
  );

  const token = generateToken(user.id);
  const profile = await db.collection('profiles').findOne({ user_id: user.id });

  return ok({
    token,
    userId: user.id,
    role: user.role,
    accepted: user.accepted,
    onboarding_complete: profile?.onboarding_complete || false,
    assessment_complete: profile?.assessment_complete || false,
  });
}

// AUTH - Firebase Authentication (Google + Email/Password)
async function handleFirebaseAuth(request) {
  const body = await request.json();
  const { idToken, email, displayName, photoURL, uid, accessCode } = body;
  
  if (!idToken || !email || !uid) {
    return err('Missing required Firebase authentication data');
  }

  // Verify Firebase ID token by checking its structure
  // In production, you'd use Firebase Admin SDK, but for client-side we trust the token
  // The token was already verified by Firebase on the client
  let payload;
  let isGoogleAuth = false;
  let firebaseEmailVerified = false;
  
  try {
    // Decode JWT to verify it's valid (basic check)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return err('Invalid token format', 401);
    }
    
    payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Verify token claims
    if (payload.email !== email) {
      return err('Token email mismatch', 401);
    }
    
    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return err('Token expired', 401);
    }
    
    // Check if this is Google OAuth (sign_in_provider in firebase.identities)
    isGoogleAuth = payload.firebase?.sign_in_provider === 'google.com';
    firebaseEmailVerified = payload.email_verified === true;
  } catch (e) {
    console.error('Token verification failed:', e);
    return err('Invalid authentication token', 401);
  }

  const db = await getDb();
  const now = new Date();
  
  // Check if user exists by email (seamless migration for existing users)
  let user = await db.collection('users').findOne({ email: email.toLowerCase() });
  
  if (user) {
    // Existing user - update Firebase UID and last active
    // Also update email_verified status if verified via Firebase/Google
    const updateFields = { 
      firebase_uid: uid,
      firebase_photo_url: photoURL || user.firebase_photo_url,
      last_active_at: now,
      // Update display name if provided and user doesn't have one
      ...(displayName && !user.display_name ? { display_name: displayName } : {}),
      // Mark email as verified if verified via Firebase/Google
      ...(firebaseEmailVerified || isGoogleAuth ? { email_verified: true } : {})
    };
    
    await db.collection('users').updateOne(
      { id: user.id },
      { $set: updateFields }
    );
    
    // Refresh user data to get latest email_verified status
    user = await db.collection('users').findOne({ id: user.id });
    
    // Update profile display name if not set
    if (displayName) {
      await db.collection('profiles').updateOne(
        { user_id: user.id, display_name: { $in: ['', null] } },
        { $set: { display_name: displayName } }
      );
    }
  } else {
    // New user - create account
    const userId = uuidv4();
    
    // Check if this is first user -> make superadmin
    const count = await db.collection('users').countDocuments();
    const role = count === 0 ? 'superadmin' : 'user';
    
    // Check if valid beta code was provided (v2 system with fallback to legacy)
    let acceptedViaBetaCode = false;
    let usedCodeId = null;
    if (accessCode && role !== 'superadmin') {
      // Try v2 codes first
      const v2Code = await db.collection('beta_codes_v2').findOne({ 
        code: accessCode.toUpperCase().trim(),
        active: true,
      });
      
      if (v2Code && 
          (!v2Code.expires_at || new Date(v2Code.expires_at) >= new Date()) &&
          (!v2Code.max_uses || v2Code.uses_count < v2Code.max_uses)) {
        acceptedViaBetaCode = true;
        usedCodeId = v2Code.id;
        // Increment usage count
        await db.collection('beta_codes_v2').updateOne(
          { id: v2Code.id },
          { $inc: { uses_count: 1 } }
        );
      } else {
        // Fallback to legacy code
        const betaCode = await db.collection('beta_codes').findOne({ id: 'current' });
        if (betaCode && betaCode.code && 
            betaCode.code.toUpperCase() === accessCode.toUpperCase().trim() &&
            (!betaCode.expires_at || new Date(betaCode.expires_at) >= new Date())) {
          acceptedViaBetaCode = true;
          // Increment usage count
          await db.collection('beta_codes').updateOne(
            { id: 'current' },
            { $inc: { uses: 1 } }
          );
        }
      }
    }
    
    await db.collection('users').insertOne({
      id: userId,
      email: email.toLowerCase(),
      firebase_uid: uid,
      firebase_photo_url: photoURL || null,
      display_name: displayName || null,
      role,
      accepted: true,
      created_at: now,
      last_active_at: now,
      access_code_used: accessCode || null,
      beta_code_used: acceptedViaBetaCode ? accessCode : null,
      beta_code_id: usedCodeId,
      auth_provider: isGoogleAuth ? 'google' : 'firebase',
      email_verified: firebaseEmailVerified || isGoogleAuth, // Google users are auto-verified
    });
    
    // Record beta code redemption if v2 code was used
    if (usedCodeId) {
      await db.collection('beta_code_redemptions').insertOne({
        id: uuidv4(),
        code_id: usedCodeId,
        code: accessCode.toUpperCase().trim(),
        user_id: userId,
        user_email: email.toLowerCase(),
        redeemed_at: now,
      });
    }
    
    // Create empty profile
    await db.collection('profiles').insertOne({
      user_id: userId,
      display_name: displayName || '',
      assistant_name: 'SoulPrint',
      descriptors: [],
      field: '',
      help_with: [],
      discovery_source: '',
      soul_profile_summary: '',
      onboarding_complete: false,
      assessment_complete: false,
      created_at: now,
    });
    
    // Send welcome email for new Firebase users (non-blocking)
    sendWelcomeEmail(email, displayName).catch(e => console.error('Welcome email failed:', e));
    
    // Send new user notification email to admin (non-blocking)
    sendNewUserNotificationEmail({
      email: email.toLowerCase(),
      beta_code_used: acceptedViaBetaCode ? accessCode : null,
      accepted: true,
    }).catch(e => console.error('Admin notification email failed:', e));
    
    user = { id: userId, role, accepted: true };
  }
  
  // Generate our own JWT token for subsequent API calls
  const token = generateToken(user.id);
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  return ok({
    token,
    userId: user.id,
    role: user.role,
    accepted: user.accepted,
    onboarding_complete: profile?.onboarding_complete || false,
    assessment_complete: profile?.assessment_complete || false,
    firebase_linked: true,
  });
}

// AUTH - Me
async function handleMe(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const profile = await db.collection('profiles').findOne({ user_id: user.id });
  
  // Fall back to voice_settings collection if not in profile
  let voiceSettings = profile?.voice_settings;
  if (!voiceSettings) {
    const vs = await db.collection('voice_settings').findOne({ user_id: user.id });
    if (vs) {
      voiceSettings = { default_voice: vs.default_voice, default_gemini_voice: vs.default_gemini_voice, voice_engine: vs.voice_engine, web_search_enabled: vs.web_search_enabled };
    }
  }

  return ok({
    id: user.id,
    email: user.email,
    role: user.role,
    accepted: user.accepted,
    created_at: user.created_at,
    profile: profile ? {
      display_name: profile.display_name,
      assistant_name: profile.assistant_name,
      descriptors: profile.descriptors,
      field: profile.field,
      help_with: profile.help_with,
      discovery_source: profile.discovery_source,
      soul_profile_summary: profile.soul_profile_summary,
      onboarding_complete: profile.onboarding_complete,
      assessment_complete: profile.assessment_complete,
      custom_greeting: profile.custom_greeting,
      default_model: profile.default_model,
      default_video_model: profile.default_video_model || 'smart',
      default_image_model: profile.default_image_model || 'smart',
      ai_greeting_enabled: profile.ai_greeting_enabled,
      voice_settings: voiceSettings,
    } : null,
  });
}

// PROFILE - Update
async function handleProfileUpdate(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { display_name, descriptors, field, help_with, discovery_source, assistant_name, onboarding_complete, custom_greeting, default_model, default_video_model, default_image_model, show_greeting, ai_greeting_enabled } = body;

  const db = await getDb();
  const update = {};
  if (display_name !== undefined) update.display_name = display_name;
  if (descriptors !== undefined) update.descriptors = descriptors;
  if (field !== undefined) update.field = field;
  if (help_with !== undefined) update.help_with = help_with;
  if (discovery_source !== undefined) update.discovery_source = discovery_source;
  if (assistant_name !== undefined) update.assistant_name = assistant_name;
  if (onboarding_complete !== undefined) update.onboarding_complete = onboarding_complete;
  if (custom_greeting !== undefined) update.custom_greeting = custom_greeting;
  if (default_model !== undefined) update.default_model = default_model;
  if (default_video_model !== undefined) update.default_video_model = default_video_model;
  if (default_image_model !== undefined) update.default_image_model = default_image_model;
  if (show_greeting !== undefined) update.ai_greeting_enabled = show_greeting;
  if (ai_greeting_enabled !== undefined) update.ai_greeting_enabled = ai_greeting_enabled;

  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: update },
    { upsert: true }
  );

  return ok({ success: true });
}

// ASSESSMENT - Get Questions
async function handleGetQuestions(request) {
  const db = await getDb();
  let questions = await db.collection('assessment_questions')
    .find({ active: true })
    .sort({ order_index: 1 })
    .toArray();

  if (questions.length === 0) {
    // Auto-seed questions
    await seedQuestions(db);
    questions = await db.collection('assessment_questions')
      .find({ active: true })
      .sort({ order_index: 1 })
      .toArray();
  }

  return ok(questions.map(q => ({
    id: q.id,
    pillar: q.pillar,
    order_index: q.order_index,
    question_text: q.question_text,
  })));
}

async function seedQuestions(db) {
  const existing = await db.collection('assessment_questions').countDocuments();
  if (existing > 0) return;
  const now = new Date();
  await db.collection('assessment_questions').insertMany(
    SEED_QUESTIONS.map(q => ({
      id: uuidv4(),
      ...q,
      active: true,
      created_at: now,
    }))
  );
}

// ASSESSMENT - Get Progress (answers for user)
async function handleGetProgress(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Check traditional assessment answers
  const answers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();
  
  // Also check layered assessment answers (Quick Start)
  const layeredAnswers = await db.collection('layered_assessment_answers').findOne({ user_id: user.id });
  
  let totalAnswered = answers.length;
  let answeredIds = answers.map(a => a.question_id);
  let layer1Complete = false;
  let layer2Complete = false;
  
  // Add layered answers to count
  if (layeredAnswers) {
    const layer1Count = Object.keys(layeredAnswers.layer1_answers || {}).length;
    const layer2Count = Object.keys(layeredAnswers.layer2_answers || {}).length;
    totalAnswered += layer1Count + layer2Count;
    answeredIds = [...answeredIds, ...Object.keys(layeredAnswers.layer1_answers || {}), ...Object.keys(layeredAnswers.layer2_answers || {})];
    layer1Complete = layeredAnswers.layer1_complete || false;
    layer2Complete = layeredAnswers.layer2_complete || false;
  }
  
  // Check if user has completed ANY assessment type
  const hasCompletedAssessment = answers.length >= 36 || // Full assessment
                                  (layer1Complete) || // Quick Start (layer 1 = 12 questions minimum)
                                  totalAnswered >= 12; // At least 12 questions answered

  return ok({ 
    answered: answeredIds, 
    count: totalAnswered,
    layer1_complete: layer1Complete,
    layer2_complete: layer2Complete,
    assessment_complete: hasCompletedAssessment
  });
}

// ASSESSMENT - Submit Answer
async function handleSubmitAnswer(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { question_id, answer_text } = body;
  if (!question_id) return err('question_id required');

  const db = await getDb();

  // Upsert answer
  const existing = await db.collection('assessment_answers').findOne({
    user_id: user.id,
    question_id,
  });

  if (existing) {
    await db.collection('assessment_answers').updateOne(
      { user_id: user.id, question_id },
      { $set: { answer_text, updated_at: new Date() } }
    );
  } else {
    await db.collection('assessment_answers').insertOne({
      id: uuidv4(),
      user_id: user.id,
      question_id,
      answer_text: answer_text || '',
      created_at: new Date(),
    });
  }

  return ok({ success: true });
}

// ASSESSMENT - Complete (save bot name)
async function handleAssessmentComplete(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { assistant_name } = body;

  const db = await getDb();
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: { assistant_name: assistant_name || 'SoulPrint', assessment_complete: true } }
  );

  return ok({ success: true });
}

// CONVERSATIONS - Get all for user
async function handleGetConversations(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  const db = await getDb();
  
  let query = {};
  
  if (projectId === 'general' || projectId === 'uncategorized') {
    // Get uncategorized conversations
    query = { 
      user_id: user.id,
      $or: [{ project_id: { $exists: false } }, { project_id: null }, { project_id: 'general' }]
    };
  } else if (projectId) {
    // Get conversations for a specific project (need to verify access)
    const project = await db.collection('projects').findOne({
      id: projectId,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    if (!project) return err('Project not found', 404);
    query = { project_id: projectId };
  } else {
    // Get all user's conversations + conversations in shared projects
    // Exclude conversations hidden from "All Chats" view
    const sharedProjects = await db.collection('projects')
      .find({ 'shared_with.user_id': user.id, 'shared_with.accepted': true })
      .toArray();
    const sharedProjectIds = sharedProjects.map(p => p.id);
    
    query = {
      $and: [
        {
          $or: [
            { user_id: user.id },
            { project_id: { $in: sharedProjectIds } }
          ]
        },
        // Exclude conversations that are hidden from All Chats
        { $or: [{ hidden_from_all_chats: { $exists: false } }, { hidden_from_all_chats: false }] }
      ]
    };
  }

  const conversations = await db.collection('conversations')
    .find(query)
    .sort({ updated_at: -1 })
    .limit(100)
    .toArray();

  return ok(conversations.map(c => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    updated_at: c.updated_at,
    source: c.source || 'web',
    project_id: c.project_id || null,
    tags: c.tags || [],
    is_mine: c.user_id === user.id,
  })));
}

// CONVERSATIONS - Create
async function handleCreateConversation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const { project_id } = body;
  const db = await getDb();
  const now = new Date();

  const conv = {
    id: uuidv4(),
    user_id: user.id,
    title: body.title || 'New Conversation',
    created_at: now,
    updated_at: now,
  };

  // If project_id is provided and valid (not 'general' or null), add it
  if (project_id && project_id !== 'general') {
    // Verify user has access to this project
    const project = await db.collection('projects').findOne({
      id: project_id,
      $or: [
        { owner_id: user.id },
        { 'shared_with.user_id': user.id }
      ]
    });
    if (project) {
      conv.project_id = project_id;
    }
  }

  await db.collection('conversations').insertOne(conv);
  return ok({ id: conv.id, title: conv.title, created_at: conv.created_at });
}

// CONVERSATIONS - Rename
async function handleRenameConversation(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const { title } = body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return err('Title is required', 400);
  }

  const db = await getDb();
  
  // Verify conversation belongs to user
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  // Update the title
  await db.collection('conversations').updateOne(
    { id: conversationId },
    { $set: { title: title.trim(), updated_at: new Date() } }
  );

  return ok({ success: true, title: title.trim() });
}

// CONVERSATIONS - Delete
async function handleDeleteConversation(request, conversationId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get context from query params (from_project=true means deleting from project view)
  const { searchParams } = new URL(request.url);
  const fromProject = searchParams.get('from_project') === 'true';
  
  // Verify conversation belongs to user
  const conv = await db.collection('conversations').findOne({ id: conversationId, user_id: user.id });
  if (!conv) return err('Conversation not found', 404);

  // Debug logging
  console.log('[DELETE CONV] ID:', conversationId, '| project_id:', conv.project_id, '| fromProject:', fromProject);

  // If deleting from "All Chats" view and the conversation belongs to a project,
  // just hide it from All Chats instead of permanently deleting
  if (!fromProject && conv.project_id && conv.project_id !== 'general') {
    console.log('[DELETE CONV] Hiding from All Chats (keeping in project)');
    await db.collection('conversations').updateOne(
      { id: conversationId },
      { $set: { hidden_from_all_chats: true, updated_at: new Date() } }
    );
    return ok({ success: true, hidden: true });
  }

  // Otherwise, permanently delete the conversation
  console.log('[DELETE CONV] Permanently deleting');
  await db.collection('conversations').deleteOne({ id: conversationId });
  
  // Delete all messages in the conversation
  await db.collection('messages').deleteMany({ conversation_id: conversationId });

  return ok({ success: true, deleted: true });
}

// ============================================================

// ── In-memory caches (per process) ───────────────────────────────────────────
const _systemPromptCache = new Map(); // userId → { prompt, ts }
const _chatRateLimitCache = new Map(); // userId → { count, windowStart }

// ── Chat Rate Limiter (per hour) ──────────────────────────────────────────────
function checkChatRateLimit(userId, maxPerHour = 80) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = _chatRateLimitCache.get(userId) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count++;
  }
  _chatRateLimitCache.set(userId, entry);
  return entry.count > maxPerHour;
}

// ── Input Sanitizer ───────────────────────────────────────────────────────────
// Strips common prompt-injection patterns before sending to any LLM
function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/ignore\s+(previous|all|above|prior)\s+instructions?/gi, '[input filtered]')
    .replace(/\bDAN\b/g, '[filtered]')
    .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>/g, '')
    .replace(/```\s*(system|instructions?|prompt)\b/gi, '```')
    .substring(0, 8000); // hard cap per message
}

// ── Smart History Trimmer (token-aware) ───────────────────────────────────────
// Keeps the most recent messages that fit within a token budget
// This is a best practice to avoid context window overflow and unnecessary token costs
function trimHistory(messages, maxContextTokens = 128000) {
  if (!messages || messages.length === 0) return [];
  
  const MIN_RECENT_MESSAGES = 6; // Always keep at least the last 6 messages
  const MAX_SINGLE_MSG_TOKENS = 4000; // Truncate individual messages beyond this
  
  // First pass: truncate overly long individual messages (e.g. pasted transcripts)
  const processed = messages.map(msg => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const est = Math.ceil(content.length / 4);
    if (est > MAX_SINGLE_MSG_TOKENS && typeof msg.content === 'string') {
      const maxChars = MAX_SINGLE_MSG_TOKENS * 4;
      return {
        ...msg,
        content: msg.content.slice(0, maxChars) + `\n\n...[message truncated — original was ~${est} tokens]`,
      };
    }
    return msg;
  });
  
  let total = 0;
  const trimmed = [];
  
  // Work backwards (most-recent first), keep messages that fit
  for (let i = processed.length - 1; i >= 0; i--) {
    const msg = processed[i];
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const est = Math.ceil(content.length / 4) + 4;
    
    // Always include the minimum recent messages
    const isRecent = (processed.length - i) <= MIN_RECENT_MESSAGES;
    
    if (!isRecent && total + est > maxContextTokens) break;
    total += est;
    trimmed.unshift(msg);
  }
  
  return ensureAlternatingMessages(trimmed);
}

// Ensure messages alternate between user and assistant roles
// OpenAI API requires: system -> user -> assistant -> user -> assistant...
// Gemini API requires: First message must be 'user' role, then alternate user/model
function ensureAlternatingMessages(messages) {
  if (!messages || messages.length === 0) return [];
  
  const result = [];
  let lastRole = null;
  
  for (const msg of messages) {
    // Skip messages with empty content
    if (!msg.content || (typeof msg.content === 'string' && !msg.content.trim())) {
      continue;
    }
    
    // Handle consecutive messages of the same role by merging content
    if (msg.role === lastRole && result.length > 0) {
      const lastMsg = result[result.length - 1];
      
      // Merge content based on type
      if (typeof lastMsg.content === 'string' && typeof msg.content === 'string') {
        // Both are strings - concatenate with separator
        lastMsg.content = `${lastMsg.content}\n\n${msg.content}`;
      } else if (Array.isArray(lastMsg.content) && Array.isArray(msg.content)) {
        // Both are arrays (multimodal) - concatenate
        lastMsg.content = [...lastMsg.content, ...msg.content];
      } else if (Array.isArray(lastMsg.content) && typeof msg.content === 'string') {
        // Last is array, new is string - add as text element
        lastMsg.content.push({ type: 'text', text: msg.content });
      } else if (typeof lastMsg.content === 'string' && Array.isArray(msg.content)) {
        // Last is string, new is array - convert and merge
        lastMsg.content = [{ type: 'text', text: lastMsg.content }, ...msg.content];
      } else {
        // Fallback: replace with newer message
        result[result.length - 1] = msg;
      }
      continue;
    }
    
    result.push({ ...msg }); // Clone to avoid mutation
    lastRole = msg.role;
  }
  
  // CRITICAL: Gemini requires the first message to be from 'user' role
  // If history starts with assistant/model message, remove it
  while (result.length > 0 && result[0].role === 'assistant') {
    result.shift();
  }
  
  // CRITICAL: Ensure the last message is from 'user' role for the LLM to respond
  // If history ends with assistant message, add a placeholder user message
  if (result.length > 0 && result[result.length - 1].role === 'assistant') {
    console.log('[ensureAlternatingMessages] Warning: Last message was assistant, history may be incomplete');
  }
  
  // Log for debugging
  if (result.length > 0) {
    const roleSequence = result.map(m => m.role[0]).join(''); // e.g., "uauau"
    if (roleSequence.includes('uu') || roleSequence.includes('aa')) {
      console.error('[ensureAlternatingMessages] ERROR: Still have consecutive roles:', roleSequence);
    }
  }
  
  return result;
}

// ── Cached System Prompt (5-min TTL) ─────────────────────────────────────────
// Best practice: avoid rebuilding + re-querying profile on every message
async function getSystemPrompt(db, userId) {
  const cached = _systemPromptCache.get(userId);
  if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) return cached.prompt;
  const prompt = await buildSystemPrompt(db, userId);
  _systemPromptCache.set(userId, { prompt, ts: Date.now() });
  return prompt;
}

// Invalidate cache when profile changes
function invalidateSystemPromptCache(userId) {
  _systemPromptCache.delete(userId);
}

// ── Data Retention Cleanup (async, best-effort) ───────────────────────────────
// Called opportunistically — deletes messages older than the retention window
async function enforceDataRetention(db, userId) {
  try {
    const settings = await db.collection('app_settings').findOne({ key: 'global' });
    const retentionDays = settings?.message_retention_days || 365; // default 1 year
    if (retentionDays <= 0) return; // 0 = keep forever
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    // Only run cleanup 1% of requests to avoid overhead
    if (Math.random() < 0.01) {
      await db.collection('messages').deleteMany({ user_id: userId, created_at: { $lt: cutoff } });
    }
  } catch { /* non-blocking */ }
}

// ── Social Media Platform Formats ─────────────────────────────────────────────
const SOCIAL_PLATFORMS = {
  twitter:   { name: 'Twitter/X',  maxChars: 280,  hashtags: 3,  emoji: true },
  instagram: { name: 'Instagram',  maxChars: 2200, hashtags: 10, emoji: true  },
  linkedin:  { name: 'LinkedIn',   maxChars: 1300, hashtags: 5,  emoji: false },
  tiktok:    { name: 'TikTok',     maxChars: 300,  hashtags: 8,  emoji: true  },
  facebook:  { name: 'Facebook',   maxChars: 500,  hashtags: 3,  emoji: true  },
  threads:   { name: 'Threads',    maxChars: 500,  hashtags: 5,  emoji: true  },
  youtube:   { name: 'YouTube',    maxChars: 5000, hashtags: 5,  emoji: false },
};

async function generateSocialPost({ platform, topic, userContext, model = 'gpt-4o', includeSearch = true }) {
  const fmt = SOCIAL_PLATFORMS[platform.toLowerCase()] || SOCIAL_PLATFORMS.twitter;
  let searchContext = '';

  if (includeSearch) {
    const { buildSearchContext } = await import('@/lib/llm/providers');
    const ctx = await buildSearchContext(topic);
    if (ctx) searchContext = `\n\nReal-time context:\n${ctx}`;
  }

  const systemMsg = `You are a professional social media copywriter. Create viral, engaging content that drives engagement. Follow platform best practices exactly.`;
  const userMsg = `Create a ${fmt.name} post about: "${topic}"
${searchContext}
Platform rules:
- Max ${fmt.maxChars} characters (STRICT — trim if needed)
- Include ${fmt.hashtags} relevant hashtags
- ${fmt.emoji ? 'Use appropriate emojis' : 'No emojis (LinkedIn professional)'}
- ${platform === 'twitter' ? 'Make it punchy with a strong hook in first 5 words' : ''}
- ${platform === 'instagram' ? 'Start with a visual hook, tell a story, end with a question or CTA' : ''}
- ${platform === 'linkedin' ? 'Professional insight-driven post. Start with a bold statement. Include a clear business value and CTA' : ''}
- ${platform === 'tiktok' ? 'Viral hook in first line. Include trending hashtags and suggest a sound or trend' : ''}
${userContext ? `\nUser persona/voice: ${userContext}` : ''}
Output ONLY the post text, no explanations. Include hashtags at the end.`;

  const { getProvider } = await import('@/lib/llm/providers');
  const provider = getProvider('openai', model);
  const text = await provider.generateChatCompletion({
    systemPrompt: systemMsg,
    messages: [{ role: 'user', content: userMsg }],
    model,
    temperature: 0.8,
  });

  return { post: text, platform: fmt.name, maxChars: fmt.maxChars };
}

// ── Schedule helpers ──────────────────────────────────────────────────────────

// Common timezone offsets for display
const TIMEZONE_OPTIONS = [
  { label: 'UTC',                   offset: 0   },
  { label: 'EST (UTC-5)',           offset: -5  },
  { label: 'CST (UTC-6)',           offset: -6  },
  { label: 'MST (UTC-7)',           offset: -7  },
  { label: 'PST (UTC-8)',           offset: -8  },
  { label: 'Brazil (UTC-3)',        offset: -3  },
  { label: 'London (UTC+0/+1)',     offset: 0   },
  { label: 'Paris/Berlin (UTC+1)',  offset: 1   },
  { label: 'Moscow (UTC+3)',        offset: 3   },
  { label: 'Dubai (UTC+4)',         offset: 4   },
  { label: 'India (UTC+5:30)',      offset: 5.5 },
  { label: 'Singapore (UTC+8)',     offset: 8   },
  { label: 'Tokyo (UTC+9)',         offset: 9   },
  { label: 'Sydney (UTC+10)',       offset: 10  },
];
export { TIMEZONE_OPTIONS };

// Schedule templates
const SCHEDULE_TEMPLATES = [
  { id: 'ai_news',    name: '🤖 AI News Digest',     prompt: 'Summarize the top 5 most important AI and machine learning stories from the last 24 hours. For each story include: what happened, why it matters, and a source if available. Format it clearly.' },
  { id: 'world_news', name: '🌍 World News Brief',    prompt: 'What are the top 5 most important world news stories from the last 24 hours? Give a clear, concise summary of each.' },
  { id: 'market',     name: '📈 Market Summary',      prompt: 'Give me a summary of today\'s financial markets: major indices performance, top gainers/losers, notable news, and key economic events from the last 24 hours.' },
  { id: 'tech_news',  name: '💻 Tech News',           prompt: 'What are the most significant technology news stories from the last 24 hours? Focus on product launches, funding, acquisitions, and industry trends.' },
  { id: 'crypto',     name: '₿ Crypto Brief',         prompt: 'Summarize the cryptocurrency market over the last 24 hours: Bitcoin and Ethereum prices, major movers, key news and developments.' },
  { id: 'custom',     name: '✏️ Custom',              prompt: '' },
];

function getNextRunAt(hourUTC, minute, scheduleType, dayOfWeek = null) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hourUTC, minute, 0, 0);

  // If the time has already passed today, move to next day
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  if (scheduleType === 'weekly' && dayOfWeek !== null) {
    while (next.getUTCDay() !== dayOfWeek) next.setUTCDate(next.getUTCDate() + 1);
  } else if (scheduleType === 'weekdays') {
    while ([0, 6].includes(next.getUTCDay())) next.setUTCDate(next.getUTCDate() + 1);
  } else if (scheduleType === 'weekends') {
    while (![0, 6].includes(next.getUTCDay())) next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

// ── Schedule API handlers ──────────────────────────────────────────────────────

async function handleGetSchedules(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  const db = await getDb();
  const tasks = await db.collection('scheduled_tasks')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();
  return ok(tasks);
}

async function handleCreateSchedule(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { name, prompt, local_hour, minute = 0, timezone_offset = 0, schedule_type = 'daily', day_of_week = null, timezone_label = 'UTC' } = body;

  if (!name || !prompt) return err('name and prompt required');
  if (local_hour == null || local_hour < 0 || local_hour > 23) return err('valid local_hour (0-23) required');

  const db = await getDb();

  // Check user limit (max 10 schedules per user)
  const count = await db.collection('scheduled_tasks').countDocuments({ user_id: user.id });
  if (count >= 10) return err('Maximum 10 schedules per user');

  // Convert local hour to UTC
  const hourUTC = Math.round(((local_hour - timezone_offset) % 24 + 24) % 24);
  const nextRun = getNextRunAt(hourUTC, minute, schedule_type, day_of_week);

  const task = {
    id: uuidv4(),
    user_id: user.id,
    name,
    prompt,
    local_hour,
    minute,
    hour_utc: hourUTC,
    timezone_offset,
    timezone_label,
    schedule_type,
    day_of_week,
    active: true,
    delivery: 'telegram',
    last_run_at: null,
    next_run_at: nextRun,
    run_count: 0,
    created_at: new Date(),
  };

  await db.collection('scheduled_tasks').insertOne(task);
  return ok(task);
}

async function handleUpdateSchedule(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const db = await getDb();

  const task = await db.collection('scheduled_tasks').findOne({ id: taskId, user_id: user.id });
  if (!task) return err('Schedule not found', 404);

  const updates = {};
  if (body.active !== undefined) updates.active = body.active;
  if (body.name) updates.name = body.name;
  if (body.prompt) updates.prompt = body.prompt;

  // If toggling active back on, recompute next_run_at
  if (body.active === true) {
    updates.next_run_at = getNextRunAt(task.hour_utc, task.minute, task.schedule_type, task.day_of_week);
  }

  await db.collection('scheduled_tasks').updateOne({ id: taskId }, { $set: updates });
  return ok({ success: true });
}

async function handleDeleteSchedule(request, taskId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  const db = await getDb();
  await db.collection('scheduled_tasks').deleteOne({ id: taskId, user_id: user.id });
  return ok({ success: true });
}

// ── Cron runner — executes due schedules ──────────────────────────────────────
async function handleRunSchedules(request) {
  // Protect with CRON_SECRET
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = await getDb();
  const now = new Date();

  // Find all due tasks
  const dueTasks = await db.collection('scheduled_tasks').find({
    active: true,
    next_run_at: { $lte: now },
  }).toArray();

  if (dueTasks.length === 0) return ok({ ran: 0 });

  let ran = 0;
  for (const task of dueTasks) {
    try {
      // Mark as running (prevent double-execution)
      const nextRun = getNextRunAt(task.hour_utc, task.minute, task.schedule_type, task.day_of_week);
      await db.collection('scheduled_tasks').updateOne(
        { id: task.id },
        { $set: { next_run_at: nextRun, last_run_at: now, run_count: (task.run_count || 0) + 1 } }
      );

      // Get user's Telegram mapping
      const mapping = await db.collection('telegram_mappings').findOne({ user_id: task.user_id, linked: true });
      if (!mapping) continue;

      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (!TELEGRAM_BOT_TOKEN) continue;

      const chatId = mapping.telegram_chat_id;
      const preferredModel = mapping.preferred_model || 'gpt-4o';
      const preferredProvider = mapping.preferred_provider || 'openai';

      // Send a preview message
      await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN,
        `⏰ *Scheduled: ${task.name}*\n_Running your scheduled task..._`
      );

      // Build the enriched prompt with real-time search
      const { buildSearchContext, getProvider: gp } = await import('@/lib/llm/providers');
      const searchCtx = await buildSearchContext(task.prompt);
      const systemMsg = `You are a helpful AI assistant delivering a scheduled briefing. Be concise, informative, and well-formatted for reading in Telegram (use markdown *bold* and bullet points).`;
      const fullPrompt = searchCtx
        ? `${searchCtx}\n\n---\n\nBased on the above real-time data, please: ${task.prompt}`
        : task.prompt;

      const provider = gp(preferredProvider, preferredModel);
      let response = '';
      try {
        const { stream } = await provider.generateStream({
          systemPrompt: systemMsg,
          messages: [{ role: 'user', content: fullPrompt }],
          model: preferredModel,
          temperature: 0.7,
          enableWebSearch: false, // already searched above
        });
        for await (const chunk of stream) response += chunk;
      } catch {
        response = await provider.generateChatCompletion({
          systemPrompt: systemMsg,
          messages: [{ role: 'user', content: fullPrompt }],
          model: preferredModel,
          temperature: 0.7,
        });
      }

      // Format and send the result
      const formattedTime = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      const header = `📋 *${task.name}*\n_${formattedTime} UTC · ${preferredModel}_\n\n`;
      const fullMsg = header + response;

      // Split if too long
      const chunks = [];
      const MAX = 3800;
      for (let i = 0; i < fullMsg.length; i += MAX) chunks.push(fullMsg.slice(i, i + MAX));
      for (const chunk of chunks) await sendTelegramMessage(chatId, TELEGRAM_BOT_TOKEN, chunk);

      // Save to conversation history
      const conv = await db.collection('conversations').findOne({ user_id: task.user_id, source: 'telegram' })
        || { id: null };
      if (conv.id) {
        await db.collection('messages').insertOne({
          id: uuidv4(), conversation_id: conv.id, user_id: task.user_id,
          role: 'assistant', content: response, created_at: now,
          source: 'scheduled', schedule_id: task.id, model_used: preferredModel,
          est_input_tokens: Math.round(fullPrompt.length / 4),
          est_output_tokens: Math.round(response.length / 4),
        });
      }

      ran++;
    } catch (e) {
      console.error(`Scheduler: error running task ${task.id}:`, e.message);
    }
  }

  return ok({ ran, total: dueTasks.length });
}



// Request location from user via Telegram keyboard button

// Remove the location keyboard after use

// CHAT STREAM - Streaming chat with web search + file vision
async function handleChatStream(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  // Rate limit check
  const rateCheck = checkRateLimit(user.id, 'chat');
  if (!rateCheck.allowed) {
    return err(`Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.`, 429);
  }

  if (!user.accepted && user.role === 'user') {
    return err('Account pending approval', 403);
  }

  const body = await request.json();
  let {
    conversationId, content, model = 'gpt-4o',
    provider: providerNameRaw = null,
    attachments = [],   // [{ type: 'image'|'document', base64: '...', mimeType: '...', name: '...', text: '...' }]
    enableWebSearch = true,
    projectId = null,   // Optional project to associate new conversations with
    videoModel: userPreferredVideoModel = null,   // User's video model preference (null = Dynamic Intelligence)
    imageModel: userPreferredImageModel = null,   // User's image model preference (null = Dynamic Intelligence)
  } = body;
  
  // Dynamic Intelligence - automatically select best model
  let smartModeInfo = null;
  if (model === 'smart') {
    smartModeInfo = await classifyQueryForSmartMode(content || '');
    model = smartModeInfo.model;
    providerNameRaw = smartModeInfo.provider;
  }
  
  // Derive provider from model info; fall back to openai
  const { getModelInfo } = await import('@/lib/llm/providers');
  const modelInfo = getModelInfo(model);
  const providerName = (providerNameRaw && providerNameRaw !== 'hosted') ? providerNameRaw : (modelInfo?.provider || 'openai');
  if (!content && attachments.length === 0) return err('content required');

  const db = await getDb();

  // Auto-detect location from IP if user doesn't have one saved
  const existingLocation = await db.collection('user_locations').findOne({ user_id: user.id });
  if (!existingLocation || !existingLocation.lat) {
    const clientIP = getClientIP(request);
    if (clientIP) {
      const ipLocation = await getLocationFromIP(clientIP);
      if (ipLocation) {
        await db.collection('user_locations').updateOne(
          { user_id: user.id },
          { 
            $set: { 
              ...ipLocation,
              updated_at: new Date()
            } 
          },
          { upsert: true }
        );
        // Invalidate cache so the new location is included in the system prompt
        invalidateSystemPromptCache(user.id);
      }
    }
  }

  // Get or create conversation
  let convId = conversationId;
  let conv = conversationId
    ? await db.collection('conversations').findOne({ id: conversationId, user_id: user.id })
    : null;

  if (!conv) {
    convId = uuidv4();
    const now = new Date();
    const title = (content || 'File attachment').slice(0, 50) + ((content?.length > 50) ? '...' : '');
    
    // Build conversation object with optional project_id
    const newConv = {
      id: convId, user_id: user.id, title, created_at: now, updated_at: now,
    };
    
    // If projectId is provided and valid (not 'general' or null), add it
    if (projectId && projectId !== 'general') {
      // Verify user has access to this project
      const project = await db.collection('projects').findOne({
        id: projectId,
        $or: [
          { owner_id: user.id },
          { shared_with: user.id }
        ]
      });
      if (project) {
        newConv.project_id = projectId;
      }
    }
    
    await db.collection('conversations').insertOne(newConv);
  }

  // Save user message (text only for storage)
  const userMsgId = uuidv4();
  const storedContent = content + (attachments.length > 0 ? ` [+${attachments.length} attachment(s)]` : '');
  await db.collection('messages').insertOne({
    id: userMsgId, conversation_id: convId, user_id: user.id,
    role: 'user', content: storedContent, created_at: new Date(), model_used: model,
  });

  // Check if user is explicitly asking to remember something
  let memoryToSave = null;
  if (content) {
    const contentLower = content.toLowerCase();
    const rememberPatterns = [
      /^(?:please\s+)?remember\s+(?:that\s+)?(.+)/i,
      /^(?:please\s+)?don'?t\s+forget\s+(?:that\s+)?(.+)/i,
      /^(?:please\s+)?save\s+(?:this\s+)?(?:to\s+)?(?:my\s+)?(?:memory|memories)[:\s]*(.+)/i,
      /^(?:please\s+)?keep\s+(?:this\s+)?in\s+mind[:\s]*(.+)/i,
      /^(?:please\s+)?note\s+(?:that\s+)?(.+)/i,
      /^(?:please\s+)?add\s+(?:this\s+)?(?:to\s+)?(?:my\s+)?(?:memory|memories)[:\s]*(.+)/i,
      /^(?:please\s+)?memorize\s+(?:that\s+)?(.+)/i,
    ];
    
    for (const pattern of rememberPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        memoryToSave = match[1].trim();
        break;
      }
    }
    
    // Save the memory immediately if detected
    if (memoryToSave && memoryToSave.length > 10) {  // Increased from 3 to 10 for more meaningful memories
      const memoryId = uuidv4();
      await db.collection('user_memories').insertOne({
        id: memoryId,
        user_id: user.id,
        content: memoryToSave,
        category: 'other',
        source: 'user_explicit',
        importance: 'high',
        created_at: new Date(),
        updated_at: new Date(),
      });
      
      // Invalidate system prompt cache since memories changed
      invalidateSystemPromptCache(user.id);
    }
  }

  // Get recent messages for context (best practice: use smart token-aware trimming)
  const recentMessages = await db.collection('messages')
    .find({ conversation_id: convId, id: { $ne: userMsgId } })
    .sort({ created_at: -1 }).limit(50).toArray();
  recentMessages.reverse();

  // Apply smart token-aware trimming (keeps last 6 messages always + fits within 32k tokens)
  const rawHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));
  let historyMessages = trimHistory(rawHistory, 128000);

  // Build the current user message — support images (vision) + documents
  let userMessageContent;
  if (attachments.length > 0) {
    userMessageContent = [];
    if (content) userMessageContent.push({ type: 'text', text: content });

    for (const att of attachments) {
      if (att.type === 'image' && att.base64) {
        userMessageContent.push({
          type: 'image_url',
          image_url: { url: `data:${att.mimeType || 'image/jpeg'};base64,${att.base64}`, detail: 'high' },
        });
      } else if (att.type === 'document' && att.text) {
        userMessageContent.push({
          type: 'text',
          text: `\n\n[Attached document: ${att.name}]\n${att.text}\n[End of document]`,
        });
      }
    }
  } else {
    userMessageContent = content;
  }

  historyMessages.push({ role: 'user', content: userMessageContent });

  // ── Best Practice: Rate Limiting ────────────────────────────────────────────
  if (checkChatRateLimit(user.id)) {
    return err('Rate limit exceeded — please slow down (max 80 messages/hour)', 429);
  }

  // ── Best Practice: Input Sanitization ───────────────────────────────────────
  const sanitizedContent = sanitizeInput(content);

  // ── Best Practice: Data Retention (async, best-effort) ───────────────────────
  enforceDataRetention(db, user.id).catch(() => {});

  // ── Best Practice: Cached System Prompt ──────────────────────────────────────
  let systemPrompt = await getSystemPrompt(db, user.id);
  
  // ── Project-Specific Instructions ───────────────────────────────────────────
  // If the conversation belongs to a project with custom instructions, prepend them
  const actualConv = conv || await db.collection('conversations').findOne({ id: convId });
  if (actualConv?.project_id) {
    const project = await db.collection('projects').findOne({ id: actualConv.project_id });
    if (project?.instructions && project.instructions.trim()) {
      systemPrompt = `[PROJECT INSTRUCTIONS - "${project.name}"]\n${project.instructions.trim()}\n\n[END PROJECT INSTRUCTIONS]\n\n${systemPrompt}`;
      console.log(`Applied project instructions from "${project.name}" (${project.instructions.length} chars)`);
    }
  }
  
  // ── Fetch Google Context if user has connected Google ──────────────────────────
  const googleContext = await fetchGoogleContextForChat(user.id, content || '');
  if (googleContext) {
    const googleContextStr = formatGoogleContextForPrompt(googleContext);
    if (googleContextStr) {
      systemPrompt += googleContextStr;
      console.log('Added Google context to chat - Gmail:', !!googleContext.gmail, 'Calendar:', !!googleContext.calendar, 'Drive:', !!googleContext.drive);
    } else if (googleContext.hasGoogleConnected) {
      // User has Google connected but query didn't trigger data fetch
      // Still inform AI it has action capabilities
      systemPrompt += '\n\n--- GOOGLE INTEGRATION ACTIVE ---\n';
      systemPrompt += 'The user has connected their Google account. You have the ability to:\n';
      systemPrompt += '- search_emails: Search and find emails in their Gmail inbox\n';
      systemPrompt += '- read_email: Read the full content of a specific email\n';
      systemPrompt += '- send_email: Send emails from their Gmail\n';
      systemPrompt += '- create_calendar_event: Create new calendar events\n';
      systemPrompt += '- update_calendar_event: Update existing events\n';
      systemPrompt += '- delete_calendar_event: Delete events\n';
      systemPrompt += '- create_document: Create a Google Doc with text content\n';
      systemPrompt += '- create_spreadsheet: Create a Google Sheets spreadsheet with data\n';
      systemPrompt += '\nIMPORTANT: When the user asks about their emails, ALWAYS use search_emails to look up real data. NEVER make up or hallucinate email content.\n';
      systemPrompt += 'BE PROACTIVE: When appropriate, offer to take action:\n';
      systemPrompt += '- If you draft/write content, ask: "Would you like me to save this as a Google Doc?"\n';
      systemPrompt += '- If discussing meetings/appointments, ask: "Would you like me to add this to your calendar?"\n';
      systemPrompt += '- If you create lists/tables/data, ask: "Would you like me to create a spreadsheet with this?"\n';
      systemPrompt += '- If discussing communication, ask: "Would you like me to draft an email?"\n';
      systemPrompt += 'When the user confirms, USE THE TOOLS to perform the action.\n';
    }
  }
  
  const provider = getProvider(providerName, model);
  const assistantMsgId = uuidv4();
  let fullContent = '';

  // ── Media intent detection ──────────────────────────────────────────────
  // Detect if user is asking to generate an image or video
  const detectMediaIntent = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase().trim();
    
    // Don't detect media intent for long texts (likely task lists, documents, etc.)
    // Real image/video generation requests are typically short and direct
    // Increased limit to 800 for infographic requests which include more details
    if (text.length > 800) return null;
    
    // Don't detect if the text contains multiple line breaks (likely a list or document)
    const lineBreaks = (text.match(/\n/g) || []).length;
    if (lineBreaks > 5) return null; // Increased to allow bullet points in infographic descriptions
    
    // Don't detect if the text seems to be asking about features, discussing, or listing tasks
    const taskListIndicators = [
      /\b(task|todo|to-do|list|prioritize|organize|help me|create.*list|feature|ability to|fix|integration|review)\b/i,
      /\b(should|could|would|can we|let's|need to|want to)\b.*\b(add|implement|build|create|fix)\b/i,
    ];
    if (taskListIndicators.some(p => p.test(lower))) return null;
    
    // Video detection (check first — more specific)
    // Must be a clear, direct request at the start of the message
    const videoPatterns = [
      /^(?:please\s+)?(?:can you\s+)?generate\s+(?:a\s+)?(?:\w+\s+)?video\b/i, 
      /^(?:please\s+)?(?:can you\s+)?create\s+(?:a\s+)?(?:\w+\s+)?video\b/i,
      /^(?:please\s+)?(?:can you\s+)?make\s+(?:a\s+)?(?:\w+\s+)?video\b/i, 
      /^(?:please\s+)?(?:can you\s+)?video\s+of\b/i,
      /^(?:please\s+)?(?:can you\s+)?animate\b/i,
      // Additional patterns for image-to-video with attachments
      /\bturn\s+(?:this|it)\s+into\s+(?:a\s+)?video\b/i,
      /\bmake\s+(?:this|it)\s+(?:a\s+|into\s+(?:a\s+)?)?video\b/i,
      /\bconvert\s+(?:this|it)?\s*(?:to|into)\s+(?:a\s+)?video\b/i,
      /\bi\s+want\s+(?:a\s+)?(?:\w+\s+)?video\b/i,
      /\b(?:create|make|generate)\s+(?:a\s+)?(?:\w+\s+)?video\s+(?:from|of|with|using|about|showing)\b/i,
      /\b(?:animate|bring\s+to\s+life)\s+(?:this|it|the|my|that)\s*(?:image|picture|photo|png|jpg)?\b/i,
      /\bvideo\s+(?:from|of)\s+(?:this|the|my|that)\s*(?:image|picture|photo|png)?\b/i,
      /\b(?:generate|create|make)\s+(?:me\s+)?(?:a\s+)?(?:short|quick|brief|cool|nice|fun|cinematic|slow.?mo)?\s*video\b/i,
      // Context-aware: "now make/create a video of the [noun] [doing something]"
      /^(?:now\s+)?(?:please\s+)?(?:can you\s+)?(?:make|create|generate)\s+(?:a\s+)?video\b/i,
      // "video of it/this/that [verb]ing" patterns
      /\bvideo\s+of\s+(?:it|this|that|the\s+\w+)\s+\w+ing\b/i,
      // "make it move/drive/fly" patterns (implied video from animation)
      /\b(?:make|let)\s+(?:it|this|that|the\s+\w+)\s+(?:move|drive|fly|walk|run|spin|dance|swim|jump|bounce|rotate|float)\b/i,
    ];
    if (videoPatterns.some(p => p.test(lower))) return 'video';
    
    // INFOGRAPHIC/FLYER detection - these MUST generate actual images, not text!
    // Check BEFORE general image patterns since these are more specific
    const infographicPatterns = [
      // Direct requests for infographics
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:an?\s+)?(?:beautiful\s+)?infographic/i,
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:a\s+)?(?:beautiful\s+)?flyer/i,
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:a\s+)?(?:beautiful\s+)?poster/i,
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:a\s+)?(?:beautiful\s+)?banner/i,
      /(?:please\s+)?(?:can you\s+)?(?:generate|create|make|design|build)\s+(?:a\s+)?(?:beautiful\s+)?brochure/i,
      // User confirmation patterns (when AI offered and user said yes)
      // These must be SHORT confirmation responses that EXPLICITLY mention what to generate
      // Bare "ok" or "yes" should NOT trigger - they could be confirming anything
      /^(?:yes|yeah|sure|ok|okay|go ahead|do it|create it|make it|generate it)[,!\s.]*(?:generate|create|make)\s+(?:the|that|this|it\s+)?(?:infographic|flyer|poster|image)[,!\s.]*$/i,
      /^please\s+(?:generate|create|make|design)\s+(?:(?:the|an?)\s+)?(?:infographic|flyer|poster|image|banner|brochure)/i,
      // Direct keyword triggers - only if short message (under 200 chars)
      ...(lower.length < 200 ? [
        /\binfographic\b.*\b(?:about|for|showing|with|on)\b/i,
        /\bflyer\b.*\b(?:about|for|showing|with|on)\b/i,
      ] : []),
      // "turn this into" patterns
      /(?:turn|convert)\s+(?:this|it)\s+into\s+(?:an?\s+)?(?:infographic|flyer|poster)/i,
      // "I want/need" patterns
      /(?:i\s+)?(?:want|need|would like)\s+(?:an?\s+)?(?:infographic|flyer|poster)/i,
    ];
    if (infographicPatterns.some(p => p.test(lower))) {
      console.log('[detectMediaIntent] Detected infographic/flyer request - will generate image');
      return 'image';
    }
    
    // Image detection - clear requests for image/picture/art generation
    const imagePatterns = [
      // Direct "generate/create/make [an/the] image/picture/photo" patterns
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?generate\s+(?:me\s+)?(?:an?|the)\s+(?:image|picture|photo|illustration|art|artwork|graphic|visual)\b/i, 
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?create\s+(?:me\s+)?(?:an?|the)\s+(?:image|picture|photo|illustration|art|artwork|graphic|visual|logo|icon|banner|design)\b/i,
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?make\s+(?:me\s+)?(?:an?|the)\s+(?:image|picture|photo|illustration|art|artwork|graphic|visual|logo|icon|banner|design)\b/i, 
      // "create/make a picture OF" patterns
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?(?:create|make|generate)\s+(?:me\s+)?(?:an?|the)\s+(?:picture|photo|portrait|sketch|illustration|painting|cartoon|drawing|rendering)\s+(?:of|for|with|showing)\b/i,
      // "draw/paint me a [subject]" patterns
      /^(?:please\s+)?(?:can you\s+)?draw\s+(?:me\s+)?(?:a|an)\s+/i,
      /^(?:please\s+)?(?:can you\s+)?paint\s+(?:me\s+)?(?:a|an)\s+/i, 
      /^(?:please\s+)?(?:can you\s+)?sketch\s+(?:me\s+)?(?:a|an)\s+/i,
      /^(?:please\s+)?(?:can you\s+)?illustrate\s+/i,
      // "show/give me a picture/image" patterns
      /^(?:please\s+)?(?:can you\s+)?(?:show|give)\s+me\s+(?:an?\s+)?(?:picture|image|photo|illustration)\b/i,
      // "picture/photo/illustration of" at start
      /^(?:please\s+)?(?:can you\s+)?(?:picture|photo|illustration|portrait)\s+of\b/i, 
      // "design a [thing]" patterns (logos, graphics, etc.)
      /^(?:please\s+)?(?:can you\s+)?(?:i\s+(?:want|need|would like)\s+(?:you\s+to\s+)?)?design\s+(?:me\s+)?(?:a|an|the|my)\s+(?:logo|icon|banner|header|thumbnail|cover|graphic|badge|emblem|mascot|avatar|wallpaper|background|mockup)\b/i,
      // "design a [adjective] [subject]" pattern (e.g., "design a beautiful landscape")
      /^(?:please\s+)?(?:can you\s+)?design\s+(?:me\s+)?(?:a|an)\s+(?:\w+\s+){0,2}(?:landscape|scene|portrait|character|creature|animal|building|city|room|car|house)\b/i,
      // "visualize" patterns
      /^(?:please\s+)?(?:can you\s+)?visualize\s+/i,
      // "I want/need" patterns with image keywords
      /(?:i\s+)?(?:want|need|would like)\s+(?:an?\s+)?(?:image|picture|photo|illustration|logo|icon|graphic|drawing|sketch|portrait|painting|render|rendering)\s+(?:of|for|with|showing)\b/i,
      /(?:i\s+)?(?:want|need|would like)\s+(?:you\s+to\s+)?(?:generate|create|make|draw|design)\s+(?:me\s+)?(?:an?|the)\s+(?:picture|image|photo|logo|visual|graphic)\b/i,
      // "make me a logo/design for" patterns
      /^(?:please\s+)?(?:can you\s+)?(?:make|create|design|generate)\s+(?:me\s+)?(?:an?\s+)?(?:logo|icon|badge|emblem)\s+(?:for|of|with)\b/i,
      // Tool/platform references
      /\bdall-?e\b/i, /\bstable\s+diffusion\b/i, /\bmidjourney\b/i,
      // Short confirmation/request patterns for image generation (after discussing a design)
      /^image[!.\s]*$/i,  // Just "Image" or "Image!"
      // "generate/create/make the image [for X]" - RELAXED: allows text after "image"
      /^(?:generate|create|make)\s+(?:the\s+)?(?:image|picture|logo|design|visual|graphic)\b/i,
      /^(?:yes|yeah|please|sure|ok|okay|go ahead|do it)[,!\s]*(?:generate|create|make)\s+(?:the\s+)?(?:image|picture|logo|design|visual|graphic)\b/i,
      // "generate it / create it / make it" (after discussing the visual)
      /^(?:please\s+)?(?:generate|create|make)\s+it[!.\s]*$/i,
      // "now generate/create/make" patterns
      /^(?:now\s+)?(?:please\s+)?(?:go ahead and\s+)?(?:generate|create|make|build)\s+(?:the\s+|that\s+)?(?:image|picture|photo|visual|graphic|infographic|flyer|poster|banner)\b/i,
    ];
    if (imagePatterns.some(p => p.test(lower))) return 'image';
    return null;
  };

  let mediaIntent = detectMediaIntent(sanitizedContent);
  
  // Force video intent if user has image attachment AND mentions video/animate keywords
  // This prevents the LLM tool call system from intercepting with generate_mockup
  if (!mediaIntent && attachments.length > 0 && attachments.some(a => a.type === 'image' || a.type?.startsWith('image/') || a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/'))) {
    const videoKeywords = /\b(video|animate|animation|motion|bring\s+to\s+life|turn\s+into\s+video|make\s+.*video|clip)\b/i;
    if (videoKeywords.test(sanitizedContent)) {
      console.log('[MediaIntent] Forcing video intent — image attachment + video keyword detected');
      mediaIntent = 'video';
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'));

      // Add keepalive mechanism to prevent connection timeouts during GC pauses
      let keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(enc.encode(': keepalive\n\n'));
        } catch (e) {
          clearInterval(keepaliveInterval);
        }
      }, 15000); // Send ping every 15 seconds

      try {
        // Send meta first (include Dynamic Intelligence info if applicable)
        send({ 
          type: 'meta', 
          conversationId: convId, 
          messageId: assistantMsgId,
          ...(smartModeInfo && { 
            smartMode: true,  // Keep for backward compatibility
            dynamicIntelligence: true,  // New field name
            dynamicLabel: 'Dynamic',  // Display label for UI
            selectedModel: model,
            modelReason: smartModeInfo.reason,
            confidence: smartModeInfo.confidence
          }),
          ...(memoryToSave && { memorySaved: true, memoryContent: memoryToSave })
        });

        // Send memory confirmation if we saved one
        if (memoryToSave) {
          send({ type: 'delta', content: '✅ **Saved to your memories:** "' + memoryToSave + '"\n\n---\n\n' });
        }

        // ── Handle image COMPOSITE requests (logo/overlay onto base image) ──
        // Uses PROGRAMMATIC compositing (Sharp) for exact logo preservation
        // AI (GPT-4o Vision) handles intelligent placement analysis only
        
        // Check if there's a recently generated image in the conversation
        let lastImageUrlInConversation = null;
        
        if (convId) {
          const recentMsgs = await db.collection('messages')
            .find({ conversation_id: convId })
            .sort({ created_at: -1 })
            .limit(15)
            .toArray();
          
          for (const msg of recentMsgs) {
            if (msg.image_url) {
              lastImageUrlInConversation = msg.image_url;
              break;
            }
            if (msg.content && typeof msg.content === 'string') {
              const imgMatch = msg.content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
              if (imgMatch) {
                lastImageUrlInConversation = imgMatch[1];
                break;
              }
            }
          }
        }
        
        // Composite detection: user has attachment(s) + base image exists + compositing intent
        const hasImageAttachment = attachments.length > 0 && attachments.some(a => 
          a.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(a.name || '')
        );
        
        const compositePatterns = [
          /\b(add|put|place|stick|overlay|apply|attach|composite|swap|replace)\b.*\b(to|on|onto|over|into|with)\b/i,
          /\b(add|put|place|swap|replace)\b.*\b(logo|image|icon|badge|sticker|decal|watermark|label|brand|emblem)\b/i,
          /\b(logo|image|icon|badge|sticker|decal|this)\b.*\b(to|on|onto|over|with)\b.*\b(the|that|this|my|it)\b/i,
          /\b(side|front|back|top|bottom|center|corner|left|right)\b.*\b(of the|of that|of this)\b/i,
          /\b(mockup|mock-up|mock up|composite|merge|combine|blend)\b/i,
          /\b(swap|replace|change)\b.*\b(logo|image|graphic|design|text)\b.*\b(with|to)\b/i,
          /\b(attached|uploaded)\b.*\b(logo|image)\b/i,
        ];
        
        // Also detect composite when user uploads TWO images (base + logo, no conversation image needed)
        const imageAttachments = attachments.filter(a => 
          a.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(a.name || '')
        );
        const hasTwoImageAttachments = imageAttachments.length >= 2;
        
        // NEW: Detect "generate + composite" — user uploads logo AND asks to generate a product with it
        // e.g., "generate a blue minivan with my logo on the door"
        const hasGenerateIntent = /\b(generate|create|make|design|produce|render)\b.*\b(image|picture|photo|mockup)\b/i.test(sanitizedContent) ||
          /\b(generate|create|make)\b.*\b(with|using|featuring)\b.*\b(logo|design|attached|uploaded)\b/i.test(sanitizedContent) ||
          /\b(generate|create|make)\b.*\b(of|a)\b.*\b(with the|with my|with attached|with uploaded)\b/i.test(sanitizedContent);
        const isGenerateAndComposite = hasImageAttachment && !lastImageUrlInConversation && !hasTwoImageAttachments &&
          hasGenerateIntent && compositePatterns.some(p => p.test(sanitizedContent));
        
        const isCompositeRequest = (hasImageAttachment && lastImageUrlInConversation && 
          compositePatterns.some(p => p.test(sanitizedContent))) ||
          (hasTwoImageAttachments && compositePatterns.some(p => p.test(sanitizedContent))) ||
          isGenerateAndComposite;
        
        if (isCompositeRequest) {
          console.log('[Composite] Detected composite request');
          console.log('[Composite] Has two attachments:', hasTwoImageAttachments);
          console.log('[Composite] Generate+Composite:', isGenerateAndComposite);
          console.log('[Composite] Conversation image:', lastImageUrlInConversation?.substring(0, 80) || 'none');
          console.log('[Composite] Instruction:', sanitizedContent.substring(0, 100));
          
          send({ type: 'generating_visual', visualType: 'edit' });
          
          try {
            // Determine base and overlay sources
            let baseBuffer = null;
            let overlayBuffer = null;
            let overlayMime = 'image/png';
            
            if (isGenerateAndComposite) {
              // ── GENERATE + COMPOSITE: User uploads logo + asks to generate a product ──
              // Step 1: Extract the product description from the user's message
              // Step 2: Generate a CLEAN product image (no logo)
              // Step 3: Composite the uploaded logo onto it
              
              send({ type: 'delta', content: '🎨 Generating your product image first, then compositing your exact logo onto it...\n\n' });
              
              const overlayAttachment = imageAttachments[0];
              let ovB64 = overlayAttachment.base64 || overlayAttachment.data;
              overlayMime = overlayAttachment.type || 'image/png';
              if (ovB64 && ovB64.startsWith('data:')) {
                const m = ovB64.match(/^data:([^;]+);base64,(.+)$/);
                if (m) { overlayMime = m[1]; ovB64 = m[2]; }
              }
              if (!ovB64 && overlayAttachment.url) {
                const r = await fetch(overlayAttachment.url);
                ovB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                overlayMime = r.headers.get('content-type') || 'image/png';
              }
              overlayBuffer = Buffer.from(ovB64, 'base64');
              
              // Generate clean product base using Flux Pro via Kie.ai (more reliable than DALL-E for specific subjects)
              // Strip logo-related parts from prompt to get a clean product description
              const cleanPrompt = sanitizedContent
                .replace(/\b(with|using|featuring)\b.*\b(logo|design|attached|uploaded|sticker|decal)\b.*/gi, '')
                .replace(/\b(place|put|add|attach|stick)\b.*\b(logo|design|attached|uploaded)\b.*/gi, '')
                .replace(/\b(attached|uploaded)\b.*$/gi, '')
                .replace(/\[\+?\d+\s*attachment.*\]/gi, '')
                .replace(/generate\s+(an?\s+)?image\s+(of\s+)?/i, '')
                .trim();
              
              const baseGenPrompt = `A photorealistic image of ${cleanPrompt || 'a product'}. No logos, no text, no graphics, no designs on the product. Clean and plain surfaces. Professional photography, good lighting. Front or 3/4 angle view.`;
              
              console.log('[Composite] Generating clean base:', baseGenPrompt.substring(0, 150));
              
              const genKieKey = process.env.KIE_API_KEY;
              let baseImageUrl = null;
              
              // Try Nano Banana first (via Kie.ai) — excellent for photorealistic subjects
              if (genKieKey) {
                try {
                  const genRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${genKieKey}` },
                    body: JSON.stringify({
                      model: 'google/nano-banana',
                      input: {
                        prompt: baseGenPrompt,
                        image_size: '1:1',
                        output_format: 'png',
                      }
                    }),
                  });
                  
                  const genTaskData = await genRes.json();
                  console.log('[Composite] Nano Banana task:', genTaskData.data?.taskId || 'unknown');
                  
                  if (genTaskData.code === 200 && genTaskData.data?.taskId) {
                    const taskId = genTaskData.data.taskId;
                    const startTime = Date.now();
                    while (Date.now() - startTime < 60000) {
                      await new Promise(r => setTimeout(r, 3000));
                      const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                        headers: { 'Authorization': `Bearer ${genKieKey}` }
                      });
                      const statusData = await statusRes.json();
                      if (statusData.code === 200 && statusData.data) {
                        if (statusData.data.state === 'success') {
                          const rj = JSON.parse(statusData.data.resultJson || '{}');
                          baseImageUrl = rj?.resultUrls?.[0] || rj?.images?.[0]?.url || rj?.url;
                          console.log('[Composite] Nano Banana success:', baseImageUrl?.substring(0, 80));
                          break;
                        } else if (statusData.data.state === 'fail') {
                          console.log('[Composite] Nano Banana failed');
                          break;
                        }
                      }
                    }
                  }
                } catch (genModelErr) {
                  console.log('[Composite] Nano Banana error:', genModelErr.message);
                }
              }
              
              // Fallback to DALL-E 3 if Flux failed
              if (!baseImageUrl) {
                console.log('[Composite] Trying DALL-E 3 fallback...');
                const genOpenaiKey = process.env.OPENAI_API_KEY;
                const genResponse = await fetch('https://api.openai.com/v1/images/generations', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${genOpenaiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'dall-e-3',
                    prompt: baseGenPrompt,
                    n: 1,
                    size: '1024x1024',
                    quality: 'hd',
                    style: 'natural',
                  }),
                });
                
                if (genResponse.ok) {
                  const genData = await genResponse.json();
                  baseImageUrl = genData.data?.[0]?.url;
                } else {
                  const err = await genResponse.json().catch(() => ({}));
                  console.log('[Composite] DALL-E 3 failed:', err.error?.message);
                }
              }
              
              if (!baseImageUrl) throw new Error('Failed to generate base product image with any model');
              
              // Download the generated base image
              const baseResp = await fetch(baseImageUrl);
              if (!baseResp.ok) throw new Error('Failed to download generated base image');
              baseBuffer = Buffer.from(await baseResp.arrayBuffer());
              
              const kieKey = process.env.KIE_API_KEY;
              if (kieKey) {
                try {
                  const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                    body: JSON.stringify({
                      base64Data: `data:image/png;base64,${baseBuffer.toString('base64')}`,
                      uploadPath: 'soulprint/generated',
                      fileName: `base_${Date.now()}.png`
                    }),
                  });
                  if (upRes.ok) {
                    const d = await upRes.json();
                    if (d.success && d.data?.downloadUrl) {
                      console.log('[Composite] Base image persisted to:', d.data.downloadUrl);
                    }
                  }
                } catch (e) { /* persistence is best-effort */ }
              }
              
              console.log('[Composite] Clean base generated, compositing logo...');
              send({ type: 'delta', content: '✅ Product image generated. Now placing your logo...\n\n' });
              
            } else if (hasTwoImageAttachments) {
              // Two attachments: first = base, second = logo/overlay
              const baseAttachment = imageAttachments[0];
              const overlayAttachment = imageAttachments[1];
              
              // Get base buffer
              let baseB64 = baseAttachment.base64 || baseAttachment.data;
              if (baseB64 && baseB64.startsWith('data:')) {
                const m = baseB64.match(/^data:([^;]+);base64,(.+)$/);
                if (m) baseB64 = m[2];
              }
              if (!baseB64 && baseAttachment.url) {
                const r = await fetch(baseAttachment.url);
                baseB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
              }
              baseBuffer = Buffer.from(baseB64, 'base64');
              
              // Get overlay buffer
              let ovB64 = overlayAttachment.base64 || overlayAttachment.data;
              overlayMime = overlayAttachment.type || 'image/png';
              if (ovB64 && ovB64.startsWith('data:')) {
                const m = ovB64.match(/^data:([^;]+);base64,(.+)$/);
                if (m) { overlayMime = m[1]; ovB64 = m[2]; }
              }
              if (!ovB64 && overlayAttachment.url) {
                const r = await fetch(overlayAttachment.url);
                ovB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                overlayMime = r.headers.get('content-type') || 'image/png';
              }
              overlayBuffer = Buffer.from(ovB64, 'base64');
            } else {
              // One attachment (overlay/logo) + conversation image (base)
              const overlayAttachment = imageAttachments[0];
              
              let ovB64 = overlayAttachment.base64 || overlayAttachment.data;
              overlayMime = overlayAttachment.type || 'image/png';
              if (ovB64 && ovB64.startsWith('data:')) {
                const m = ovB64.match(/^data:([^;]+);base64,(.+)$/);
                if (m) { overlayMime = m[1]; ovB64 = m[2]; }
              }
              if (!ovB64 && overlayAttachment.url) {
                const r = await fetch(overlayAttachment.url);
                ovB64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                overlayMime = r.headers.get('content-type') || 'image/png';
              }
              overlayBuffer = Buffer.from(ovB64, 'base64');
              
              // Fetch base from conversation (handle expired URLs gracefully)
              const baseResp = await fetch(lastImageUrlInConversation);
              if (!baseResp.ok) {
                throw new Error(`Base image is no longer accessible (HTTP ${baseResp.status}). The original image URL may have expired. Please generate a new image first.`);
              }
              baseBuffer = Buffer.from(await baseResp.arrayBuffer());
              
              send({ type: 'delta', content: '🎨 Preparing to composite your design onto the image...\n\n' });
            }
            
            if (!baseBuffer || !overlayBuffer) {
              throw new Error('Could not load base and overlay images');
            }
            
            // ── Detect if this is a SWAP/REPLACE operation ──
            // Only swap on EXISTING images (not freshly generated ones which are already clean)
            const isSwapRequest = !isGenerateAndComposite && (
              /\b(swap|replace|change|switch)\b.*\b(logo|image|graphic|design|text|brand)\b/i.test(sanitizedContent) ||
              /\b(logo|image|graphic|design|text|brand)\b.*\b(swap|replace|change|switch|with)\b/i.test(sanitizedContent)
            );
            
            // Skip GPT-image-1 cleanup when Gemini is available — Gemini handles replacement natively
            const hasGemini = !!process.env.GEMINI_API_KEY;
            
            if (isSwapRequest && !hasGemini) {
              console.log('[Composite] Swap detected — cleaning base image of existing logos first (no Gemini)');
              send({ type: 'delta', content: '🧹 Removing existing logos from the image first...\n\n' });
              
              try {
                const swapOpenaiKey = process.env.OPENAI_API_KEY;
                if (!swapOpenaiKey) throw new Error('OpenAI API key required for logo removal');
                
                // Use GPT-image-1 to erase existing logos/text from the base image
                const OpenAI = (await import('openai')).default;
                const { toFile } = await import('openai/uploads');
                const openai = new OpenAI({ apiKey: swapOpenaiKey });
                
                const baseFile = await toFile(baseBuffer, 'base.png', { type: 'image/png' });
                
                const cleanResult = await openai.images.edit({
                  model: 'gpt-image-1',
                  image: baseFile,
                  prompt: `Remove ALL logos, text, graphics, designs, and branding from the clothing/products in this image. Make all surfaces clean and plain. Keep the rest of the scene EXACTLY the same — same people, same poses, same lighting, same background. Only erase printed designs and logos.`,
                  n: 1,
                  size: '1024x1024',
                });
                
                if (cleanResult.data?.[0]?.b64_json) {
                  baseBuffer = Buffer.from(cleanResult.data[0].b64_json, 'base64');
                  console.log('[Composite] Base image cleaned successfully');
                  send({ type: 'delta', content: '✅ Existing logos removed. Now placing your design...\n\n' });
                } else if (cleanResult.data?.[0]?.url) {
                  const cleanResp = await fetch(cleanResult.data[0].url);
                  baseBuffer = Buffer.from(await cleanResp.arrayBuffer());
                  console.log('[Composite] Base image cleaned (from URL)');
                }
              } catch (cleanErr) {
                console.log('[Composite] Logo removal failed:', cleanErr.message, '— proceeding with original base');
                // Continue with original base — the composite will just overlay on top
              }
            }
            
            // ── Call the Smart Composite function ──
            // Gemini handles the compositing natively when available (much better results)
            // Falls back to GPT-4o Vision analysis + Sharp programmatic compositing
            send({ type: 'generating_visual', visualType: 'composite' });
            send({ type: 'delta', content: '⏳ *Generating realistic mockup with AI — this takes 10-20 seconds...*\n\n' });
            
            // Send visible progress updates to keep user informed
            let compositeProgressCount = 0;
            const compositeProgressMessages = [
              '🔄 Analyzing image composition...',
              '🎨 Blending logo into the scene...',
              '✨ Matching lighting and texture...',
              '🖼️ Finalizing mockup...',
            ];
            const compositeProgressInterval = setInterval(() => {
              try { 
                const msg = compositeProgressMessages[compositeProgressCount % compositeProgressMessages.length];
                send({ type: 'delta', content: msg + '\n' }); 
                compositeProgressCount++;
              } catch(e) {}
            }, 4000);
            
            let compositeResult;
            try {
              compositeResult = await handleSmartComposite(
                baseBuffer, overlayBuffer, overlayMime, sanitizedContent
              );
            } finally {
              clearInterval(compositeProgressInterval);
              // Clear the progress dots by sending a newline
              try { send({ type: 'delta', content: '\n\n' }); } catch(e) {}
            }
            
            if (compositeResult.success && compositeResult.url) {
              const placementInfo = compositeResult.placement;
              const placementCount = Array.isArray(placementInfo) ? placementInfo.length : 1;
              const surfaceType = Array.isArray(placementInfo) ? (placementInfo[0]?.surface_type || 'auto') : (placementInfo?.surface_type || 'auto');
              const methodLabel = compositeResult.method === 'gemini-native-composite' ? 'AI-native blend' : 'pixel-perfect overlay';
              fullContent = `![Composited Image](${compositeResult.url})\n\n🎨 *Your design has been composited onto the image!*\n*${placementCount > 1 ? placementCount + ' placements' : 'Surface: ' + surfaceType} | Method: ${methodLabel}*`;
              send({ type: 'image', url: compositeResult.url, revised_prompt: sanitizedContent, contentType: 'composite' });
              send({ type: 'delta', content: fullContent });
            } else {
              throw new Error(compositeResult.error || 'Compositing failed');
            }
          } catch (compErr) {
            console.error('[Composite] Error:', compErr.message, compErr.stack);
            fullContent = `Sorry, compositing failed: ${compErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          
          // Save message
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          await db.collection('messages').insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'smart-composite', provider_used: 'gpt4o-vision+sharp', content_type: 'composite',
            image_url: fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined,
            est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
          });
          await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          clearInterval(keepaliveInterval);
          controller.close();
          return;
        }
        
        // Broad edit detection - if there's a recent image AND user asks to modify something
        const editImagePatterns = [
          // Direct edit verbs
          /\b(add|put|place|insert|overlay|stick|apply|remove|delete|erase|crop|rotate)\b/i,
          /\b(add|put|place|insert|overlay|stick|apply|remove|delete|erase|crop|rotate)\b/i,
          // Swap/replace/change
          /\b(swap|replace|change|switch|modify|alter|update|edit|transform|convert|adjust)\b/i,
          // Make/turn + adjective (e.g., "make it red", "turn it into a cartoon")
          /\b(make|turn|have)\b.*\b(it|the|that|this|him|her|them)\b/i,
          // "Have the X do Y" (e.g., "have the otter hold a cupcake")
          /\b(have|make|let)\b.*\b(hold|wear|carry|sit|stand|fly|jump|run|dance|swim|eat|drink)\b/i,
          // Style changes
          /\b(more|less)\b.*\b(realistic|cartoon|artistic|vibrant|dark|light|bright|colorful)\b/i,
          // Background changes
          /\b(change|different|new|another)\b.*\b(background|setting|scene|environment)\b/i,
          // Color changes
          /\b(make|change|turn|paint)\b.*\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|gold|silver)\b/i,
          // Wearing/holding/doing
          /\b(wearing|holding|carrying|riding|sitting|standing|eating|drinking)\b/i,
          // Explicit edit request
          /\b(edit|modify|change|update|alter|tweak|fix|improve|enhance)\b.*\b(the|that|this|my|it|image|picture|photo|previous|last)\b/i,
        ];
        
        const isEditRequest = lastImageUrlInConversation && editImagePatterns.some(p => p.test(sanitizedContent));
        
        // Also detect if user is explicitly asking to edit without patterns (AI-assisted detection)
        const couldBeEditRequest = lastImageUrlInConversation && !mediaIntent && 
          sanitizedContent.length < 200 && // Short messages are likely edit requests if there's a recent image
          !/\b(generate|create|new image|new picture|new photo|from scratch)\b/i.test(sanitizedContent) && // Not asking for new image
          /\b(the|it|that|this|image|picture|photo|otter|minivan|car|person|dog|cat|background)\b/i.test(sanitizedContent);
        
        if ((isEditRequest || couldBeEditRequest) && attachments.length === 0) {
          console.log('[Image Edit] Detected edit request for existing image:', lastImageUrlInConversation.substring(0, 80));
          console.log('[Image Edit] Edit instruction:', sanitizedContent.substring(0, 100));
          console.log('[Image Edit] Detection method:', isEditRequest ? 'pattern match' : 'contextual (short msg + recent image)');
          
          // Send visual generation event to frontend
          send({ type: 'generating_visual', visualType: 'edit' });
          send({ type: 'delta', content: '✏️ Editing your image...\n\n' });
          
          try {
            const editResult = await handleImageEditInternal(
              user.id,
              { url: lastImageUrlInConversation },
              sanitizedContent,
              (progress) => {
                send({ type: 'delta', content: '' }); // keepalive
              }
            );
            
            if (editResult.success && editResult.url) {
              console.log(`[Image Edit] Success with ${editResult.method}! URL:`, editResult.url.substring(0, 80));
              
              fullContent = `![Edited Image](${editResult.url})\n\n✏️ *Image edited using ${editResult.method}!*`;
              send({ type: 'image', url: editResult.url, revised_prompt: sanitizedContent, contentType: 'edit' });
              send({ type: 'delta', content: fullContent });
            } else {
              console.error('[Image Edit] Failed:', editResult.error);
              fullContent = `Sorry, I couldn't edit the image: ${editResult.error}`;
              send({ type: 'delta', content: fullContent });
            }
          } catch (editErr) {
            console.error('[Image Edit] Exception:', editErr.message);
            fullContent = `Sorry, image editing failed: ${editErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          
          // Save message with image_url for future edit detection
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          await db.collection('messages').insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'image-edit', provider_used: 'multi', content_type: 'image-edit',
            image_url: fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined,
            est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
          });
          await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          clearInterval(keepaliveInterval);
          controller.close();
          return;
        }

        // ── Handle image generation ───────────────────────────────────────
        if (mediaIntent === 'image') {
          // Check if user has image attachments (reference photos)
          const imageAttachments = attachments.filter(a => 
            a.type === 'image' || a.type?.startsWith('image/') || 
            a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/')
          );
          const hasReferenceImages = imageAttachments.length > 0;
          
          // Detect if this is an infographic/flyer request and enhance the prompt
          const lowerContent = content.toLowerCase();
          const isInfographic = /\binfographic\b/i.test(lowerContent);
          const isFlyer = /\b(flyer|poster|banner|brochure)\b/i.test(lowerContent);
          
          // Dynamic model selection based on prompt content
          const modelSelection = selectBestImageModel(content, userPreferredImageModel);
          let selectedModelKey = modelSelection.model;
          let modelConfig = KIE_IMAGE_MODELS[selectedModelKey];
          
          // If selected model is unavailable, fall back to nano-banana
          if (!modelConfig || modelConfig.available === false) {
            console.log(`[Image Generation] Model ${selectedModelKey} unavailable, falling back to nano-banana`);
            selectedModelKey = 'nano-banana';
            modelConfig = KIE_IMAGE_MODELS['nano-banana'];
          }
          
          const modelDisplayName = selectedModelKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          
          console.log(`[Image Generation] Dynamic Intelligence selected: ${selectedModelKey} - ${modelSelection.reason}`);
          
          // Send visual generation event to frontend for immediate indicator
          const contentTypeForIndicator = isInfographic ? 'infographic' : (isFlyer ? 'flyer' : 'image');
          send({ type: 'generating_visual', visualType: contentTypeForIndicator });
          
          let displayMessage = `🎨 Generating your image with ${modelDisplayName}...\n\n`;
          let enhancedPrompt = content;
          
          // If the request is very short (e.g., just "Image" or "generate the image"),
          // extract context from recent conversation to understand what to generate
          const isShortRequest = content.trim().split(/\s+/).length <= 5;
          if (isShortRequest && historyMessages.length > 0) {
            // Get recent assistant messages that might contain design descriptions
            const recentContext = historyMessages
              .filter(m => m.role === 'assistant')
              .slice(-3)
              .map(m => typeof m.content === 'string' ? m.content : '')
              .join('\n')
              .substring(0, 2000);
            
            if (recentContext) {
              console.log('[Image Generation] Short request detected, using conversation context');
              enhancedPrompt = `Based on our conversation, generate an image of what was discussed. Here's the context from our conversation:\n\n${recentContext}\n\nUser's request: ${content}\n\nCreate a high-quality, visually appealing image based on what was discussed.`;
            }
          }
          
          if (isInfographic) {
            displayMessage = `📊 Creating your professional infographic with ${modelDisplayName}...\n\n`;
            enhancedPrompt = `Create a stunning, professional infographic design. The infographic should have:
- A cohesive, modern color palette (3-5 colors maximum)
- Clear visual hierarchy with bold, impactful headlines
- Beautiful data visualization elements (icons, charts, statistics displayed prominently)
- Clean, organized sections with proper white space
- Professional typography with readable fonts
- Visual icons and illustrations representing key concepts
- A polished, designer-quality finish that looks like it was created by a professional graphic designer

CONTENT TO VISUALIZE:
${content}

Style: Modern, clean, professional infographic design. Make it visually stunning and engaging.`;
          } else if (isFlyer) {
            displayMessage = `🎨 Designing your professional flyer with ${modelDisplayName}...\n\n`;
            enhancedPrompt = `Create a stunning, professional promotional flyer/poster design. The design should have:
- Eye-catching visual composition using the rule of thirds
- Bold, attention-grabbing headline typography
- Strong visual hierarchy (most important info largest/boldest)
- Relevant, high-quality imagery that supports the message
- Professional color scheme that evokes the right mood
- Clear call-to-action that stands out
- Proper white space - not overcrowded
- All key information clearly visible (date, time, location if applicable)
- A polished, designer-quality finish

CONTENT TO DESIGN:
${content}

Style: Professional graphic design quality. Make it look like a skilled designer created it, NOT like a simple text document.`;
          }
          
          send({ type: 'delta', content: displayMessage });
          
          let imageUrl = null;
          let revisedPrompt = content;
          let usedModel = selectedModelKey;
          
          try {
            const kieKey = process.env.KIE_API_KEY;
            const openaiApiKey = process.env.OPENAI_API_KEY;
            
            // ── REFERENCE IMAGE PATH: Use gpt-image-1 when user has reference images ──
            if (hasReferenceImages && openaiApiKey) {
              console.log(`[Image Generation] User has ${imageAttachments.length} reference image(s), using gpt-image-1 for reference-aware generation`);
              usedModel = 'gpt-image-1';
              
              try {
                const OpenAI = (await import('openai')).default;
                const { toFile } = await import('openai/uploads');
                const openai = new OpenAI({ apiKey: openaiApiKey });
                
                // Prepare reference images
                const imageFiles = [];
                for (let i = 0; i < Math.min(imageAttachments.length, 3); i++) {
                  const att = imageAttachments[i];
                  let imageBuffer;
                  
                  if (att.base64) {
                    const base64Data = att.base64.replace(/^data:[^;]+;base64,/, '');
                    imageBuffer = Buffer.from(base64Data, 'base64');
                  } else if (att.url) {
                    const resp = await fetch(att.url, { signal: AbortSignal.timeout(15000) });
                    imageBuffer = Buffer.from(await resp.arrayBuffer());
                  }
                  
                  if (imageBuffer) {
                    const mimeType = att.mimeType || att.mime_type || 'image/png';
                    const file = await toFile(imageBuffer, `ref_${i}.png`, { type: mimeType });
                    imageFiles.push(file);
                  }
                }
                
                if (imageFiles.length > 0) {
                  console.log(`[Image Generation] Prepared ${imageFiles.length} reference image(s), calling gpt-image-1 edit...`);
                  
                  const editResult = await openai.images.edit({
                    model: 'gpt-image-1',
                    image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
                    prompt: `Using the attached reference image(s) as visual context, create a new image: ${enhancedPrompt}`,
                    n: 1,
                    size: '1024x1024',
                  });
                  
                  if (editResult.data?.[0]) {
                    if (editResult.data[0].url) {
                      imageUrl = editResult.data[0].url;
                    } else if (editResult.data[0].b64_json) {
                      // Upload base64 to persistent storage
                      if (kieKey) {
                        const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
                          body: JSON.stringify({
                            base64Data: `data:image/png;base64,${editResult.data[0].b64_json}`,
                            uploadPath: 'soulprint/generated',
                            fileName: `gen_ref_${Date.now()}.png`
                          }),
                        });
                        const upData = await upRes.json();
                        if (upData.success && upData.data?.downloadUrl) {
                          imageUrl = upData.data.downloadUrl;
                        }
                      }
                      // Fallback: use data URL
                      if (!imageUrl) {
                        imageUrl = `data:image/png;base64,${editResult.data[0].b64_json}`;
                      }
                    }
                    
                    if (imageUrl) {
                      console.log(`[Image Generation] gpt-image-1 reference generation success!`);
                      revisedPrompt = editResult.data[0].revised_prompt || content;
                    }
                  }
                }
              } catch (refErr) {
                console.log('[Image Generation] gpt-image-1 reference path failed:', refErr.message, '- falling back to text-only generation');
              }
            }
            
            // ── PRIMARY: Use Kie.ai with dynamically selected model (text-only) ──
            if (!imageUrl && kieKey && modelConfig) {
              console.log(`[Image Generation] Using Kie.ai model: ${modelConfig.model} for prompt:`, enhancedPrompt.substring(0, 150));
              
              const inputParams = modelConfig.formatInput 
                ? modelConfig.formatInput(enhancedPrompt, '1:1') 
                : { prompt: enhancedPrompt, image_size: 'square_hd' };
              
              const requestBody = {
                model: modelConfig.model,
                input: inputParams,
              };
              
              const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': `Bearer ${kieKey}` 
                },
                body: JSON.stringify(requestBody),
              });
              
              const createData = await createRes.json();
              
              if (createData.code === 200 && createData.data?.taskId) {
                const taskId = createData.data.taskId;
                console.log(`[Image Generation] Kie.ai task created: ${taskId}, polling...`);
                
                // Poll for result
                const startTime = Date.now();
                const maxWaitTime = 90000; // 90s timeout
                let attempts = 0;
                
                while (Date.now() - startTime < maxWaitTime) {
                  await new Promise(r => setTimeout(r, 3000));
                  attempts++;
                  
                  const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                    headers: { 'Authorization': `Bearer ${kieKey}` },
                  });
                  const statusData = await statusRes.json();
                  
                  if (statusData.code === 200) {
                    const state = statusData.data?.state;
                    
                    if (state === 'success') {
                      try {
                        const resultJson = JSON.parse(statusData.data?.resultJson || '{}');
                        imageUrl = resultJson?.resultUrls?.[0] || resultJson?.url || resultJson?.image_url || resultJson?.images?.[0];
                      } catch (e) {
                        console.error('[Image Generation] Failed to parse resultJson:', e);
                      }
                      break;
                    } else if (state === 'fail') {
                      console.log('[Image Generation] Kie.ai task failed:', statusData.data?.failMsg);
                      break;
                    }
                    // Still processing - continue polling
                  }
                }
                
                if (imageUrl) {
                  console.log(`[Image Generation] Success with ${selectedModelKey}! URL:`, imageUrl.substring(0, 80));
                }
              } else {
                console.log('[Image Generation] Kie.ai createTask failed:', createData.msg || createData.code);
              }
            }
            
            // ── FALLBACK: Use DALL-E 3 if Kie.ai failed or unavailable ──
            if (!imageUrl && openaiApiKey) {
              console.log('[Image Generation] Falling back to DALL-E 3');
              usedModel = 'dall-e-3';
              
              const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiApiKey}` },
                body: JSON.stringify({ model: 'dall-e-3', prompt: enhancedPrompt, n: 1, size: '1024x1024', quality: 'hd', style: 'vivid' }),
              });
              
              const imgData = await imgRes.json();
              
              if (!imgRes.ok) {
                throw new Error(imgData.error?.message || `DALL-E 3 API returned status ${imgRes.status}`);
              }
              
              imageUrl = imgData.data?.[0]?.url;
              revisedPrompt = imgData.data?.[0]?.revised_prompt || content;
            }
            
            if (!imageUrl) {
              throw new Error('No image generation API available or all methods failed');
            }
            
            console.log(`[Image Generation] Final success with ${usedModel}! URL:`, imageUrl.substring(0, 80) + '...');
            
            // ── Persist image to permanent storage ──
            // DALL-E URLs expire in ~2 hours, and tempfile.aiquickdraw.com URLs may also expire.
            // Re-upload ALL externally-hosted images to our own storage for durability.
            const needsPersistence = 
              imageUrl.includes('oaidalleapiprodscus') || 
              imageUrl.includes('openai.com') || 
              imageUrl.includes('blob.core.windows.net') ||
              imageUrl.includes('tempfile.aiquickdraw.com');
              
            if (needsPersistence) {
              const persistKieKey = process.env.KIE_API_KEY;
              if (persistKieKey) {
                try {
                  console.log('[Image Persistence] Fetching image for re-upload:', imageUrl.substring(0, 80));
                  const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
                  if (imgResp.ok) {
                    const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                    const fileSizeMB = (imgBuf.length / (1024 * 1024)).toFixed(2);
                    console.log(`[Image Persistence] Image fetched: ${fileSizeMB}MB`);
                    
                    // Skip re-upload for very large images (>10MB base64 would be ~13MB+ JSON body)
                    if (imgBuf.length > 10 * 1024 * 1024) {
                      console.log('[Image Persistence] Image too large for re-upload, using original URL');
                    } else {
                      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${persistKieKey}` },
                        body: JSON.stringify({
                          base64Data: `data:image/png;base64,${imgBuf.toString('base64')}`,
                          uploadPath: 'soulprint/generated',
                          fileName: `gen_${Date.now()}.png`
                        }),
                      });
                      if (upRes.ok) {
                        const upData = await upRes.json();
                        if (upData.success && upData.data?.downloadUrl) {
                          console.log('[Image Persistence] Persisted to:', upData.data.downloadUrl);
                          imageUrl = upData.data.downloadUrl; // Use persistent URL
                        } else {
                          console.warn('[Image Persistence] Upload response not successful:', JSON.stringify(upData).substring(0, 200));
                        }
                      } else {
                        console.warn('[Image Persistence] Upload HTTP error:', upRes.status, await upRes.text().catch(() => ''));
                      }
                    }
                  } else {
                    console.warn('[Image Persistence] Could not fetch image:', imgResp.status);
                  }
                } catch (persistErr) {
                  console.warn('[Image Persistence] Failed:', persistErr.message, '— using original URL');
                }
              }
            }

            // Customize the output message based on content type
            const contentTypeLabel = isInfographic ? 'infographic' : (isFlyer ? 'flyer' : 'image');
            const successEmoji = isInfographic ? '📊' : (isFlyer ? '🎨' : '🖼️');
            
            fullContent = `![Generated ${contentTypeLabel.charAt(0).toUpperCase() + contentTypeLabel.slice(1)}](${imageUrl})\n\n${successEmoji} *Your ${contentTypeLabel} has been created!*`;
            send({ type: 'image', url: imageUrl, revised_prompt: revisedPrompt, contentType: contentTypeLabel });
            send({ type: 'delta', content: fullContent });
          } catch (imgErr) {
            console.error('[Image Generation] Exception:', imgErr.message, imgErr.stack);
            fullContent = `Sorry, image generation failed: ${imgErr.message}`;
            send({ type: 'delta', content: fullContent });
            imageUrl = null; // Ensure we don't save a broken URL
          }
          // Save message - use 'text' content_type if generation failed (no image URL)
          const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          const desiredContentType = isInfographic ? 'infographic' : (isFlyer ? 'flyer' : 'image');
          const storedContentType = imageUrl ? desiredContentType : 'text'; // Don't save as 'image' if no URL
          const extractedImageUrl = fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined;
          await db.collection('messages').insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: usedModel, provider_used: usedModel === 'dall-e-3' ? 'openai' : 'kie-ai', content_type: storedContentType,
            image_url: extractedImageUrl,
            est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
          });
          await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          controller.close();
          return;
        }

        // ── Handle video generation (text-to-video OR image-to-video with optional character reference) ───────────────────────────────────────
        if (mediaIntent === 'video') {
          // Send visual generation indicator immediately so frontend shows animation
          send({ type: 'generating_visual', visualType: 'video' });
          
          // Detect aspect ratio from prompt (e.g., "portrait", "9:16", "vertical")
          const detectedAspectRatio = detectAspectRatioFromPrompt(content) || '16:9';
          console.log(`[Video] Detected aspect ratio: ${detectedAspectRatio} from prompt`);
          
          // Check for image attachments - could be scene image AND/OR character reference images
          const allImageAttachments = attachments.filter(a => a.type === 'image' || a.mime_type?.startsWith('image/') || a.mimeType?.startsWith('image/'));
          let imageAttachment = allImageAttachments[0]; // First image is for scene/animation
          
          // AUTO-CONTEXT: If no image attached but conversation has a recent image, 
          // and user's prompt references it (e.g., "make a video of the car driving"),
          // automatically use the conversation's last image as source
          if (!imageAttachment && lastImageUrlInConversation && detectContextImageReference(content)) {
            console.log('[Video] Auto-context: Using last conversation image as source:', lastImageUrlInConversation.substring(0, 80));
            send({ type: 'delta', content: '🎬 Using your recently generated image as the source...\n\n' });
            imageAttachment = {
              type: 'image',
              base64: lastImageUrlInConversation,
              isUrlReference: true,
              name: 'context-image.jpg',
              mimeType: 'image/jpeg',
            };
          }
          
          // Detect if user wants to add themselves or a person to the video
          const wantsCharacterReference = /\b(me|myself|my face|my photo|person|character|subject|face|with me|of me|add me|put me|include me|myself driving|me driving|me in|myself in)\b/i.test(content);
          
          // If user mentions character reference but only provided one image, use it as character reference for text-to-video
          const useAsCharacterRef = wantsCharacterReference && allImageAttachments.length === 1 && !imageAttachment?.isUrlReference;
          
          if (imageAttachment && (imageAttachment.base64 || imageAttachment.isUrlReference) && !useAsCharacterRef) {
            // IMAGE-TO-VIDEO: Animate the uploaded image (with optional character reference)
            send({ type: 'delta', content: '🎬 Preparing your image for animation...\n\n' });
            try {
              const kieKey = process.env.KIE_API_KEY;
              if (!kieKey) throw new Error('Video API not configured');
              
              let imageUrl = null;
              
              // Check if this is a URL reference (from regeneration) or needs upload
              if (imageAttachment.isUrlReference && imageAttachment.base64?.startsWith('http')) {
                // Already a URL - use directly (from "Try Different Model" regeneration)
                imageUrl = imageAttachment.base64;
                console.log('[Image-to-Video] Using existing URL for regeneration:', imageUrl.substring(0, 80));
              } else {
                console.log('[Image-to-Video] Starting - uploading image first...');
                
                // Step 1: Try to upload the base64 image to Kie.ai to get a URL
                // If upload fails, we'll try using the data URL directly (some providers accept it)
                const mType = imageAttachment.mimeType || imageAttachment.mime_type || 'image/jpeg';
                const fileName = imageAttachment.name || `image-${Date.now()}.${mType.split('/')[1] || 'jpg'}`;
                const dataUrl = imageAttachment.base64.startsWith('data:') 
                  ? imageAttachment.base64 
                  : `data:${mType};base64,${imageAttachment.base64}`;
                
                // Try uploading to Kie.ai file upload service
                try {
                  const uploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                    body: JSON.stringify({
                      base64Data: dataUrl, // Correct parameter name per Kie.ai docs
                      uploadPath: 'soulprint/image-to-video',
                      fileName: fileName,
                    }),
                  });
                  
                  if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    console.log('[Image-to-Video] Upload response:', JSON.stringify(uploadData).substring(0, 500));
                    const downloadUrl = uploadData.data?.downloadUrl || uploadData.downloadUrl;
                    if ((uploadData.success || uploadData.code === 200) && downloadUrl) {
                      imageUrl = downloadUrl;
                      console.log('[Image-to-Video] Got uploaded image URL:', imageUrl.substring(0, 80));
                    } else {
                      console.log('[Image-to-Video] Upload response missing downloadUrl');
                    }
                  } else {
                    const errText = await uploadRes.text().catch(() => 'unknown');
                    console.log('[Image-to-Video] Upload HTTP error:', uploadRes.status, errText.substring(0, 200));
                  }
                } catch (uploadErr) {
                  console.log('[Image-to-Video] Upload failed:', uploadErr.message);
                }
              } // End of else block for base64 upload
              
              // If upload failed, throw an error — Kie.ai video API requires an HTTP URL
              if (!imageUrl) {
                throw new Error('Failed to upload image for video generation. Please try again.');
              }
              
              console.log('[Image-to-Video] Final image URL type:', imageUrl.startsWith('data:') ? 'data URL' : 'http URL');
              
              // ── Dynamic Video Intelligence: select the best model ──
              // Clean the prompt of model instruction prefix
              const cleanedPrompt = extractPromptWithoutModelInstruction(content) || 'Animate this image';
              const videoSelection = await selectVideoModel(content || 'Animate this image', { hasImage: true, userPreferredModel: userPreferredVideoModel });
              const selectedVideoModel = videoSelection.model;
              const videoModelLabel = VIDEO_MODELS[selectedVideoModel].label;
              send({ type: 'delta', content: `🎬 Animating your image with ${videoModelLabel}...\n\n` });
              console.log(`[Image-to-Video] Dynamic Intelligence selected: ${selectedVideoModel} — ${videoSelection.reason}`);
              
              // Step 2: Create video generation task via unified handler
              const taskId = await generateVideoWithModel(selectedVideoModel, cleanedPrompt || 'Animate this image with natural, smooth motion', kieKey, {
                imageUrls: [imageUrl],
                aspectRatio: detectedAspectRatio,
                duration: 5,
              });

              // Save job to DB
              await db.collection('video_jobs').insertOne({
                id: uuidv4(), task_id: taskId, user_id: user.id,
                prompt: content, source_image: imageUrl,
                duration: 5, quality: VIDEO_MODELS[selectedVideoModel].resolution, aspect_ratio: detectedAspectRatio,
                status: 'generating', conversation_id: convId, model: selectedVideoModel,
                message_id: assistantMsgId, type: 'image-to-video',
                created_at: new Date(), expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              });

              fullContent = `🎬 **Animating your image!**\n\n![Source Image](${imageUrl})\n\n${videoModelLabel} is bringing your image to life. This usually takes 1-3 minutes.\n\n*Instructions: ${content || 'Natural animation'}*`;
              send({ type: 'video_task', taskId, status: 'generating', prompt: content, sourceImage: imageUrl, messageId: assistantMsgId, videoModel: selectedVideoModel, videoModelLabel, videoModelReason: videoSelection.reason });
              send({ type: 'delta', content: fullContent });
              
              // Save message
              const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
              const videoTaskData = { taskId, status: 'generating', prompt: content, sourceImage: imageUrl, model: selectedVideoModel };
              await db.collection('messages').insertOne({
                id: assistantMsgId, conversation_id: convId, user_id: user.id,
                role: 'assistant', content: fullContent, created_at: new Date(),
                model_used: selectedVideoModel, provider_used: 'kie.ai', content_type: 'video',
                video_task: videoTaskData, source_image: imageUrl,
                model_label: videoModelLabel, video_model_reason: videoSelection.reason,
                est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
              });
              await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
              
              send({ type: 'done', messageId: assistantMsgId });
              controller.close();
              return;
            } catch (vidErr) {
              console.error('[Image-to-Video] Error:', vidErr);
              fullContent = `Sorry, I couldn't animate your image: ${vidErr.message}`;
              send({ type: 'delta', content: fullContent });
            }
          } else if (imageAttachment && !imageAttachment.base64) {
            // Image attachment exists but no base64 data - maybe it has a URL?
            send({ type: 'delta', content: '🎬 Starting video generation with your image...\n\n' });
            try {
              const kieKey = process.env.KIE_API_KEY;
              if (!kieKey) throw new Error('Video API not configured');
              
              const imageUrl = imageAttachment.url;
              if (!imageUrl) throw new Error('Image URL not found');
              
              console.log('[Image-to-Video] Using existing image URL:', imageUrl.substring(0, 80));
              
              // ── Dynamic Video Intelligence ──
              const videoSelection2 = await selectVideoModel(content || 'Animate this image', { hasImage: true, userPreferredModel: userPreferredVideoModel });
              const selectedVideoModel2 = videoSelection2.model;
              const videoModelLabel2 = VIDEO_MODELS[selectedVideoModel2].label;
              console.log(`[Image-to-Video] Dynamic Intelligence selected: ${selectedVideoModel2} — ${videoSelection2.reason}`);

              const taskId = await generateVideoWithModel(selectedVideoModel2, content || 'Animate this image with natural, smooth motion', kieKey, {
                imageUrls: [imageUrl],
                aspectRatio: detectedAspectRatio,
                duration: 5,
              });
              
              await db.collection('video_jobs').insertOne({
                id: uuidv4(), task_id: taskId, user_id: user.id,
                prompt: content, source_image: imageUrl,
                duration: 5, quality: VIDEO_MODELS[selectedVideoModel2].resolution, aspect_ratio: detectedAspectRatio,
                status: 'generating', conversation_id: convId, model: selectedVideoModel2,
                message_id: assistantMsgId, type: 'image-to-video',
                created_at: new Date(), expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              });

              fullContent = `🎬 **Animating your image!**\n\n![Source Image](${imageUrl})\n\n${videoModelLabel2} is bringing your image to life. This usually takes 1-3 minutes.`;
              send({ type: 'video_task', taskId, status: 'generating', prompt: content, sourceImage: imageUrl, messageId: assistantMsgId, videoModel: selectedVideoModel2, videoModelLabel: videoModelLabel2, videoModelReason: videoSelection2.reason });
              send({ type: 'delta', content: fullContent });
              
              const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
              await db.collection('messages').insertOne({
                id: assistantMsgId, conversation_id: convId, user_id: user.id,
                role: 'assistant', content: fullContent, created_at: new Date(),
                model_used: selectedVideoModel2, provider_used: 'kie.ai', content_type: 'video',
                video_task: { taskId, status: 'generating', prompt: content, sourceImage: imageUrl, model: selectedVideoModel2 },
                source_image: imageUrl,
                model_label: videoModelLabel2, video_model_reason: videoSelection2.reason,
                est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
              });
              await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
              
              send({ type: 'done', messageId: assistantMsgId });
              controller.close();
              return;
            } catch (vidErr) {
              console.error('[Image-to-Video] Error:', vidErr);
              fullContent = `Sorry, I couldn't animate your image: ${vidErr.message}`;
              send({ type: 'delta', content: fullContent });
            }
          } else {
            // TEXT-TO-VIDEO: Generate video from text prompt (with optional character reference)
            try {
              const kieKey = process.env.KIE_API_KEY;
              if (!kieKey) throw new Error('Video API not configured');
              
              // Check if user uploaded a character reference image (e.g., "make a video of me driving")
              let characterElements = [];
              let characterImageUrl = null;
              
              if (useAsCharacterRef && imageAttachment && imageAttachment.base64) {
                send({ type: 'delta', content: '🎬 Preparing your character reference...\n\n' });
                console.log('[Text-to-Video] User wants character reference - uploading face image...');
                
                // Upload the character reference image
                const mType = imageAttachment.mimeType || imageAttachment.mime_type || 'image/jpeg';
                const fileName = `character-${Date.now()}.${mType.split('/')[1] || 'jpg'}`;
                const dataUrl = imageAttachment.base64.startsWith('data:') 
                  ? imageAttachment.base64 
                  : `data:${mType};base64,${imageAttachment.base64}`;
                
                try {
                  const uploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kieKey}` },
                    body: JSON.stringify({
                      base64Data: dataUrl,
                      uploadPath: 'soulprint/character-reference',
                      fileName: fileName,
                    }),
                  });
                  
                  if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    const downloadUrl = uploadData.data?.downloadUrl || uploadData.downloadUrl;
                    if ((uploadData.success || uploadData.code === 200) && downloadUrl) {
                      characterImageUrl = downloadUrl;
                      console.log('[Text-to-Video] Character reference uploaded:', characterImageUrl.substring(0, 80));
                      
                      // Build Kling Elements array for character reference
                      // Kling API requires 2-4 images per element — duplicate the single image to meet minimum
                      const elementName = 'character';
                      characterElements = [{
                        name: elementName,
                        description: 'The person/character to include in the video',
                        element_input_urls: [characterImageUrl, characterImageUrl],
                      }];
                      
                      send({ type: 'delta', content: `✅ Character reference ready! Creating video with your likeness...\n\n` });
                    }
                  }
                } catch (uploadErr) {
                  console.log('[Text-to-Video] Character reference upload failed:', uploadErr.message);
                  send({ type: 'delta', content: `⚠️ Couldn't process character reference, generating without it...\n\n` });
                }
              }
              
              // ── Dynamic Video Intelligence ──
              // If using character reference, prefer Kling 3.0 (has Elements support)
              const videoSelection3 = await selectVideoModel(content, { 
                hasImage: false, 
                hasCharacterRef: characterElements.length > 0,
                userPreferredModel: characterElements.length > 0 ? 'kling-3.0' : userPreferredVideoModel 
              });
              const selectedVideoModel3 = characterElements.length > 0 ? 'kling-3.0' : videoSelection3.model;
              const videoModelLabel3 = VIDEO_MODELS[selectedVideoModel3].label;
              console.log(`[Text-to-Video] ${characterElements.length > 0 ? 'Using Kling 3.0 for character reference' : `Dynamic Intelligence selected: ${selectedVideoModel3}`} — ${videoSelection3.reason}`);
              send({ type: 'delta', content: `🎬 Starting video generation with ${videoModelLabel3}${characterElements.length > 0 ? ' (with character reference)' : ''}...\n\n` });
              
              // Modify prompt to reference the character element if using character reference
              let finalPrompt = extractPromptWithoutModelInstruction(content);
              if (characterElements.length > 0) {
                const elementRef = `@${characterElements[0].name}`;
                // Check if prompt already references the element
                if (!finalPrompt.includes(elementRef)) {
                  // Add element reference to prompt - replace "me", "myself", etc. with @element_name
                  finalPrompt = finalPrompt
                    .replace(/\b(me|myself)\b/gi, elementRef)
                    .replace(/\bmy face\b/gi, `${elementRef}'s face`);
                }
                console.log('[Text-to-Video] Modified prompt with element reference:', finalPrompt);
              }
              
              const taskId = await generateVideoWithModel(selectedVideoModel3, finalPrompt, kieKey, {
                aspectRatio: detectedAspectRatio,
                duration: 5,
                characterElements: characterElements,
                // Kling API requires image_urls when using role references in prompt
                imageUrls: characterImageUrl ? [characterImageUrl] : undefined,
              });

              // Save job to DB with message_id reference
              await db.collection('video_jobs').insertOne({
                id: uuidv4(), task_id: taskId, user_id: user.id,
                prompt: content, duration: 5, quality: VIDEO_MODELS[selectedVideoModel3].resolution, aspect_ratio: detectedAspectRatio,
                status: 'generating', conversation_id: convId, model: selectedVideoModel3,
                message_id: assistantMsgId, type: characterElements.length > 0 ? 'text-to-video-with-character' : 'text-to-video',
                character_reference: characterImageUrl || null,
                created_at: new Date(), expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              });

              const charRefNote = characterElements.length > 0 ? '\n\n*Using your character reference for consistent appearance.*' : '';
              fullContent = `🎬 **Video generation started!**\n\nYour video is being generated by ${videoModelLabel3}. This usually takes 1-3 minutes.${charRefNote}\n\n*The video will appear here when it's ready.*`;
              send({ type: 'video_task', taskId, status: 'generating', prompt: content, messageId: assistantMsgId, videoModel: selectedVideoModel3, videoModelLabel: videoModelLabel3, videoModelReason: videoSelection3.reason });
              send({ type: 'delta', content: fullContent });
              
              // Save message WITH video_task so it persists on refresh
              const inputText = systemPrompt + historyMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
              const videoTaskData = { taskId, status: 'generating', prompt: content, model: selectedVideoModel3, characterRef: !!characterImageUrl };
              await db.collection('messages').insertOne({
                id: assistantMsgId, conversation_id: convId, user_id: user.id,
                role: 'assistant', content: fullContent, created_at: new Date(),
                model_used: selectedVideoModel3, provider_used: 'kie.ai', content_type: 'video',
                model_label: videoModelLabel3, video_model_reason: videoSelection3.reason,
                video_task: videoTaskData,
                est_input_tokens: Math.round(inputText.length / 4), est_output_tokens: 0,
              });
              await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
              
              send({ type: 'done', messageId: assistantMsgId });
              controller.close();
              return;
            } catch (vidErr) {
              console.error('[Text-to-Video] Error:', vidErr);
              fullContent = `Sorry, video generation failed: ${vidErr.message}`;
              send({ type: 'delta', content: fullContent });
            }
          }
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          controller.close();
          return;
        }

        // ── Handle location/places search ─────────────────────────────────────
        const detectPlacesIntent = (text) => {
          if (!text) return false;
          const lower = text.toLowerCase();
          return /\b(find|where|what|show me|looking for|recommend|suggest|any|are there|is there)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|hospitals?|gyms?|banks?|atms?|groceries?|stores?|malls?|parks?|museums?|movies?|theaters?|movie\s*theaters?|cinemas?|parking|airports?)\b/i.test(text)
            || /\b(restaurants?|cafes?|coffee shops?|bars?|hotels?|gas stations?|pharmacies?|gyms?|banks?|parks?|stores?|movie\s*theaters?|theaters?|cinemas?)\s+(near|in|around|close to)\b/i.test(text)
            || /\b(what('s| is)|where('s| is|are)|any).*(near me|nearby|around here|close by)\b/i.test(lower)
            || /\bnearby\s+(restaurants?|cafes?|bars?|hotels?|stores?|places?|theaters?|cinemas?|movie\s*theaters?)/i.test(lower)
            || /\b(movie\s*theaters?|cinemas?|theaters?)\s*(near|around|close)/i.test(lower);
        };

        if (detectPlacesIntent(sanitizedContent) && attachments.length === 0) {
          send({ type: 'delta', content: '📍 Searching for places...\n\n' });
          try {
            // Parse location from query
            let locationName = parseLocationQuery(sanitizedContent);
            let coords = null;
            
            // Check if user has shared location (stored in DB)
            const userLocation = await db.collection('user_locations').findOne({ user_id: user.id });
            
            if (!locationName || /near me|nearby|around here|close by/i.test(sanitizedContent.toLowerCase())) {
              if (userLocation && userLocation.lat && userLocation.lng) {
                coords = { lat: userLocation.lat, lng: userLocation.lng };
                locationName = userLocation.address || 'your location';
              } else {
                fullContent = `📍 I don't have your location yet.\n\nTo search for places near you, please either:\n1. **Specify a location**: "Find restaurants near Times Square"\n2. **Share your location** through the Telegram bot first\n\nOr try: "Find Italian restaurants in [your city]"`;
                send({ type: 'delta', content: fullContent });
                await db.collection('messages').insertOne({
                  id: assistantMsgId, conversation_id: convId, user_id: user.id,
                  role: 'assistant', content: fullContent, created_at: new Date(),
                  model_used: model, provider_used: providerName,
                });
                await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
                send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                controller.close();
                return;
              }
            } else {
              // Geocode the location
              const geocoded = await geocodeAddress(locationName);
              if (!geocoded) {
                fullContent = `❌ Sorry, I couldn't find the location "${locationName}". Please try a more specific address or city name.`;
                send({ type: 'delta', content: fullContent });
                await db.collection('messages').insertOne({
                  id: assistantMsgId, conversation_id: convId, user_id: user.id,
                  role: 'assistant', content: fullContent, created_at: new Date(),
                  model_used: model, provider_used: providerName,
                });
                await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
                send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
                controller.close();
                return;
              }
              coords = { lat: geocoded.lat, lng: geocoded.lng };
              locationName = geocoded.formattedAddress || locationName;
            }
            
            // Extract what they're looking for
            const searchTerm = sanitizedContent.replace(/\s+(near|in|around|at|close to)\s+.+$/i, '')
              .replace(/^(find|where|what|show me|looking for|recommend|suggest)\s+(me\s+)?(a\s+|some\s+)?(good\s+|best\s+|closest\s+|nearest\s+)?/i, '')
              .replace(/\?+$/, '')
              .trim();
            const placeType = extractPlaceType(searchTerm);
            
            const places = await searchNearbyPlaces({
              lat: coords.lat,
              lng: coords.lng,
              query: placeType ? null : searchTerm,
              type: placeType,
              radius: 2000,
              maxResults: 6,
            });
            
            if (places.length === 0) {
              fullContent = `😕 No ${searchTerm || 'places'} found near ${locationName}. Try a different search or location.`;
            } else {
              const placesList = places.map((p, i) => {
                const rating = p.rating ? `⭐ ${p.rating}` : '';
                const reviews = p.userRatingsTotal ? `(${p.userRatingsTotal} reviews)` : '';
                const price = p.priceLevel ? '💰'.repeat(p.priceLevel) : '';
                const status = p.isOpen === true ? '🟢 Open now' : p.isOpen === false ? '🔴 Closed' : '';
                const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.placeId}`;
                
                return `### ${i + 1}. ${p.name}\n📍 ${p.address}\n${[rating, reviews, price, status].filter(Boolean).join(' • ')}\n[Open in Google Maps](${mapsLink})`;
              }).join('\n\n');
              
              fullContent = `📍 **Found ${places.length} places near ${locationName}:**\n\n${placesList}`;
            }
            
            send({ type: 'delta', content: fullContent });
            send({ type: 'places', places, location: locationName, coordinates: coords });
          } catch (placesErr) {
            fullContent = `❌ Sorry, place search failed: ${placesErr.message}`;
            send({ type: 'delta', content: fullContent });
          }
          
          await db.collection('messages').insertOne({
            id: assistantMsgId, conversation_id: convId, user_id: user.id,
            role: 'assistant', content: fullContent, created_at: new Date(),
            model_used: 'google-places', provider_used: 'google', content_type: 'places',
          });
          await db.collection('conversations').updateOne({ id: convId }, { $set: { updated_at: new Date() } });
          send({ type: 'done', conversationId: convId, messageId: assistantMsgId });
          controller.close();
          return;
        }

        // Check if user has Google connected for tool calling
        const hasGoogle = await userHasGoogleConnected(user.id);
        const googleTools = hasGoogle ? GOOGLE_TOOLS : [];
        
        // Check if there are images in context (attached or recent)
        const hasImageInContext = attachments.some(a => a.type === 'image') || 
          historyMessages.some(m => m.image_url);
        const imageTools = hasImageInContext ? IMAGE_TOOLS : [];
        
        // Combine all tools
        const allTools = [...googleTools, ...imageTools];
        
        // Tool call handler for Google actions
        const handleGoogleToolCall = async (toolName, args) => {
          console.log(`[Tool Call] Executing ${toolName} with args:`, JSON.stringify(args).substring(0, 200));
          
          // Handle Google actions
          if (['search_emails', 'read_email', 'send_email', 'create_calendar_event', 'update_calendar_event', 'delete_calendar_event', 'create_document', 'create_spreadsheet'].includes(toolName)) {
            const result = await executeGoogleAction(user.id, toolName, args);
            console.log(`[Google Tool] Result:`, result);
            return result;
          }
          
          // Handle image editing
          if (toolName === 'edit_image') {
            console.log('[Image Edit Tool] Processing edit request');
            // Send generating_visual indicator so frontend shows loading animation
            send({ type: 'generating_visual', visualType: 'edit' });
            const { image_reference, edit_instruction } = args;
            
            // Find the image to edit
            let imageToEdit = null;
            
            if (image_reference === 'attached') {
              // Use attached image
              const imageAtt = attachments.find(a => a.type === 'image');
              if (imageAtt) {
                imageToEdit = { base64: imageAtt.base64, mimeType: imageAtt.mimeType };
              }
            } else if (image_reference === 'last_generated') {
              // Find last generated image in conversation
              const recentMsgs = [...historyMessages].reverse();
              for (const msg of recentMsgs) {
                if (msg.image_url) {
                  imageToEdit = { url: msg.image_url };
                  break;
                }
              }
            } else if (image_reference?.startsWith('message_id:')) {
              // Find specific message
              const msgId = image_reference.replace('message_id:', '');
              const msg = historyMessages.find(m => m.id === msgId);
              if (msg?.image_url) {
                imageToEdit = { url: msg.image_url };
              }
            }
            
            if (!imageToEdit) {
              return { success: false, error: 'Could not find the image to edit. Please attach an image or specify which image to edit.' };
            }
            
            // Call the image edit API
            try {
              const editRes = await handleImageEditInternal(user.id, imageToEdit, edit_instruction);
              return editRes;
            } catch (err) {
              return { success: false, error: `Image edit failed: ${err.message}` };
            }
          }
          
          // Handle mockup generation
          if (toolName === 'generate_mockup') {
            console.log('[Mockup Tool] Processing mockup request');
            // Send generating_visual indicator so frontend shows loading animation
            send({ type: 'generating_visual', visualType: 'composite' });
            const { product, design_reference } = args;
            
            // Find the design image
            let designImage = null;
            
            if (design_reference === 'attached') {
              const imageAtt = attachments.find(a => a.type === 'image');
              if (imageAtt) {
                designImage = { base64: imageAtt.base64, mimeType: imageAtt.mimeType };
              }
            } else if (design_reference === 'last_generated') {
              const recentMsgs = [...historyMessages].reverse();
              for (const msg of recentMsgs) {
                if (msg.image_url) {
                  designImage = { url: msg.image_url };
                  break;
                }
              }
            }
            
            if (!designImage) {
              return { success: false, error: 'Could not find the design image. Please attach an image.' };
            }
            
            try {
              const mockupRes = await handleMockupGenerateInternal(user.id, designImage, product);
              return mockupRes;
            } catch (err) {
              return { success: false, error: `Mockup generation failed: ${err.message}` };
            }
          }
          
          return { success: false, error: `Unknown tool: ${toolName}` };
        };

        // PROACTIVE WEB SEARCH: Pre-search and inject context for better real-time answers
        // This ensures search happens even if the model doesn't call the tool
        let preSearchSources = [];
        let preSearchDidSearch = false;
        if (enableWebSearch && attachments.length === 0 && providerName === 'openai') {
          const lastUserMsg = historyMessages[historyMessages.length - 1];
          const userText = typeof lastUserMsg?.content === 'string' 
            ? lastUserMsg.content 
            : (Array.isArray(lastUserMsg?.content) ? lastUserMsg.content.find(p => p.type === 'text')?.text : null);
          
          if (userText) {
            const lowerText = userText.toLowerCase();
            
            // Check if query contains a URL - always search for URLs
            const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|\.[a-z]{2,}\/[^\s]*/i;
            const hasUrl = urlPattern.test(userText);
            
            // More aggressive search triggers - search whenever user asks about something
            const searchKeywords = [
              // Time-sensitive queries
              'weather', 'news', 'price', 'stock', 'score', 'latest', 'current', 'today', 'recent', 'now',
              // Question patterns
              'what is', 'what are', 'who is', 'who are', 'tell me about', 'explain', 'how to', 'how do',
              'when did', 'where is', 'why did', 'why is', 'find', 'search', 'look up', 'lookup',
              // Website/URL related
              'website', 'site', 'page', 'url', 'link', 'from their', 'using their', 'on their',
              'visit', 'check out', 'go to', 'browse', 'open',
              // Research/information gathering
              'research', 'information', 'info', 'details', 'about', 'profile', 'overview', 'summary',
              'learn about', 'read about', 'know about',
              // Company/product queries
              'company', 'product', 'service', 'platform', 'app', 'tool', 'startup', 'business',
              // Years
              '2024', '2025', '2026',
              // Action words that often need real-time data
              'compare', 'review', 'analyze', 'generate', 'create'
            ];
            const needsSearch = hasUrl || searchKeywords.some(kw => lowerText.includes(kw));
            
            if (needsSearch) {
              console.log('[Chat] Proactive search triggered for:', userText.slice(0, 100), hasUrl ? '(contains URL)' : '');
              try {
                const { buildSearchContext } = await import('@/lib/llm/providers');
                const searchResult = await buildSearchContext(userText);
                
                if (searchResult && searchResult.results?.length > 0) {
                  preSearchDidSearch = true;
                  preSearchSources = searchResult.results.map(r => ({
                    title: r.title || 'Untitled',
                    url: r.url,
                    snippet: r.content?.substring(0, 150) || '',
                  }));
                  
                  // Inject search context into the last user message
                  historyMessages = [
                    ...historyMessages.slice(0, -1),
                    { 
                      role: 'user', 
                      content: `${searchResult.context}\n\n---\n\nUser question: ${userText}` 
                    }
                  ];
                  console.log('[Chat] Pre-search injected:', preSearchSources.length, 'sources');
                  
                  // Send sources to client immediately
                  if (preSearchSources.length > 0) {
                    send({ type: 'sources', sources: preSearchSources.slice(0, 6) });
                  }
                }
              } catch (searchErr) {
                console.log('[Chat] Proactive search failed:', searchErr.message);
              }
            }
          }
        }

        // CRITICAL: Ensure messages alternate before sending to LLM
        // This prevents "user or tool message(s) should alternate with assistant message(s)" errors
        const sanitizedMessages = ensureAlternatingMessages(historyMessages);
        
        // Debug log to catch message format issues
        if (sanitizedMessages.length > 0) {
          const roles = sanitizedMessages.map(m => m.role).join(' → ');
          console.log(`[Chat] Message roles before LLM call: ${roles}`);
        }
        
        const { stream: aiStream, searchMeta, didSearch, customToolResults } = await provider.generateStream({
          systemPrompt,
          messages: sanitizedMessages,
          model,
          temperature: 0.7,
          enableWebSearch: enableWebSearch && attachments.length === 0 && !preSearchDidSearch, // disable tool search if we already pre-searched
          customTools: allTools.length > 0 ? allTools : undefined,
          onToolCall: allTools.length > 0 ? handleGoogleToolCall : undefined,
        });

        // Send Google action results to the client
        if (customToolResults && customToolResults.length > 0) {
          for (const toolResult of customToolResults) {
            if (toolResult.result?.success) {
              const actionType = ['edit_image', 'generate_mockup'].includes(toolResult.tool) 
                ? 'image_action' 
                : 'google_action';
              send({ type: actionType, action: toolResult.tool, result: toolResult.result });
              
              // For image edits/mockups, also send the standard 'image' event 
              // so the frontend reliably renders the image (consistent with direct edit path)
              if (['edit_image', 'generate_mockup'].includes(toolResult.tool) && toolResult.result?.url) {
                send({ type: 'image', url: toolResult.result.url, revised_prompt: toolResult.result.revisedPrompt || '' });
                console.log('[Image Tool] Sent image event for tool result:', toolResult.result.url?.substring(0, 80));
              }
            }
          }
        }

        // Extract and format sources from search
        let sources = [...preSearchSources]; // Start with pre-search sources
        if (didSearch && searchMeta.length > 0) {
          console.log('[Sources Debug] searchMeta:', JSON.stringify(searchMeta, null, 2));
          // Collect all unique sources from search results
          searchMeta.forEach(search => {
            if (search.results && Array.isArray(search.results)) {
              search.results.forEach(result => {
                if (result.url && !sources.find(s => s.url === result.url)) {
                  sources.push({
                    title: result.title || 'Untitled',
                    url: result.url,
                    snippet: result.content?.substring(0, 150) || '',
                  });
                }
              });
            }
          });
          console.log('[Sources Debug] Extracted sources:', sources.length);
          // Send sources to client (only if we didn't already send them from pre-search)
          if (sources.length > 0 && !preSearchDidSearch) {
            send({ type: 'sources', sources: sources.slice(0, 6) }); // Limit to 6 sources
          }
        }

        let escalationBuffer = '';
        let inEscalation = false;
        
        for await (const chunk of aiStream) {
          if (chunk) {
            let text = typeof chunk === 'string' ? chunk : (chunk.delta || '');
            fullContent += text;
            
            // Filter out [SUPPORT_ESCALATION] marker and its JSON from streamed output
            if (inEscalation) {
              escalationBuffer += text;
              // Check if JSON object is complete (balanced braces)
              const opens = (escalationBuffer.match(/{/g) || []).length;
              const closes = (escalationBuffer.match(/}/g) || []).length;
              if (opens > 0 && opens === closes) {
                inEscalation = false;
                escalationBuffer = '';
              }
              text = ''; // Don't send this chunk to the user
            } else if (text.includes('[SUPPORT_ESCALATION]')) {
              inEscalation = true;
              const parts = text.split('[SUPPORT_ESCALATION]');
              text = parts[0]; // Send everything before the marker
              escalationBuffer = parts[1] || '';
              const opens = (escalationBuffer.match(/{/g) || []).length;
              const closes = (escalationBuffer.match(/}/g) || []).length;
              if (opens > 0 && opens === closes) {
                inEscalation = false;
                escalationBuffer = '';
              }
            }
            
            if (text) {
              send({ type: 'delta', content: text });
            }
            
            // Extract Perplexity citations if available
            if (typeof chunk === 'object' && chunk.citations && chunk.citations.length > 0 && sources.length === 0) {
              sources = chunk.citations;
              send({ type: 'sources', sources: sources.slice(0, 6) });
            }
          }
        }

        // ── Auto-continuation for truncated responses ──────────────────────────
        // If the LLM hit its output token limit, automatically continue generating
        const MAX_CONTINUATIONS = 3;
        let continuationCount = 0;
        
        while (
          provider.getLastFinishReason?.() === 'length' &&
          continuationCount < MAX_CONTINUATIONS &&
          fullContent.length > 100 // Only continue if there's substantial content
        ) {
          continuationCount++;
          console.log(`[Chat] Auto-continuation ${continuationCount}/${MAX_CONTINUATIONS} — response was truncated (finish_reason=length)`);
          
          // Notify the client that we're auto-continuing
          send({ type: 'continuation', count: continuationCount, max: MAX_CONTINUATIONS });
          
          try {
            // Build continuation messages: include the partial response and ask to continue
            const continuationMessages = [
              ...historyMessages,
              { role: 'assistant', content: fullContent },
              { role: 'user', content: 'Your previous response was cut off due to length limits. Continue EXACTLY from where you stopped. Do NOT repeat any text that was already written. Do NOT add any preamble like "Continuing from..." — just seamlessly pick up from the exact point the text was cut off.' },
            ];
            
            // Use streamContinuation (lightweight, no tools/search)
            const contStream = await provider.streamContinuation({
              systemPrompt,
              messages: continuationMessages,
              model,
              temperature: 0.7,
            });
            
            for await (const chunk of contStream) {
              if (chunk) {
                let text = typeof chunk === 'string' ? chunk : (chunk.delta || '');
                fullContent += text;
                
                // Filter escalation markers from continuations too
                if (inEscalation) {
                  escalationBuffer += text;
                  const opens = (escalationBuffer.match(/{/g) || []).length;
                  const closes = (escalationBuffer.match(/}/g) || []).length;
                  if (opens > 0 && opens === closes) { inEscalation = false; escalationBuffer = ''; }
                  text = '';
                } else if (text.includes('[SUPPORT_ESCALATION]')) {
                  inEscalation = true;
                  const parts = text.split('[SUPPORT_ESCALATION]');
                  text = parts[0];
                  escalationBuffer = parts[1] || '';
                  const opens = (escalationBuffer.match(/{/g) || []).length;
                  const closes = (escalationBuffer.match(/}/g) || []).length;
                  if (opens > 0 && opens === closes) { inEscalation = false; escalationBuffer = ''; }
                }
                
                if (text) {
                  send({ type: 'delta', content: text });
                }
              }
            }
            
            console.log(`[Chat] Continuation ${continuationCount} complete — total length: ${fullContent.length} chars`);
          } catch (contErr) {
            console.error(`[Chat] Auto-continuation ${continuationCount} failed:`, contErr.message);
            break; // Stop trying to continue on error
          }
        }
        
        if (continuationCount > 0) {
          console.log(`[Chat] Completed ${continuationCount} auto-continuation(s). Final response: ${fullContent.length} chars (~${Math.round(fullContent.length / 4)} tokens)`);
        }

        // Estimate token usage (chars / 4 is a reasonable approximation)
        const inputText = systemPrompt + historyMessages.map(m =>
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        ).join(' ');
        const estInputTokens = Math.round(inputText.length / 4);
        const estOutputTokens = Math.round(fullContent.length / 4);

        // Extract image URL from tool results (for edit_image/generate_mockup tool calls)
        let toolImageUrl = null;
        if (customToolResults && customToolResults.length > 0) {
          for (const tr of customToolResults) {
            if (['edit_image', 'generate_mockup'].includes(tr.tool) && tr.result?.success && tr.result?.url) {
              toolImageUrl = tr.result.url;
              break;
            }
          }
        }

        // Save assistant message
        await db.collection('messages').insertOne({
          id: assistantMsgId, conversation_id: convId, user_id: user.id,
          role: 'assistant', content: fullContent, created_at: new Date(),
          model_used: model, provider_used: providerName,
          web_search_used: didSearch || preSearchDidSearch,
          sources: sources.length > 0 ? sources : undefined,
          image_url: toolImageUrl || fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)?.[1] || undefined,
          est_input_tokens: estInputTokens,
          est_output_tokens: estOutputTokens,
        });

        await db.collection('conversations').updateOne(
          { id: convId }, { $set: { updated_at: new Date() } }
        );

        // ── Support Escalation Detection ──────────────────────────────
        // If the AI flagged a technical issue for escalation, send email to engineering
        if (fullContent.includes('[SUPPORT_ESCALATION]')) {
          (async () => {
            try {
              // Use balanced-brace matching to extract JSON (handles nested braces & multi-line)
              let escalationData = { issue: 'Unknown issue flagged by AI' };
              let rawEscalationText = '';
              const markerIdx = fullContent.indexOf('[SUPPORT_ESCALATION]');
              if (markerIdx !== -1) {
                const afterMarker = fullContent.slice(markerIdx + '[SUPPORT_ESCALATION]'.length).trim();
                rawEscalationText = afterMarker.substring(0, 500); // Capture raw text for debugging
                const braceStart = afterMarker.indexOf('{');
                if (braceStart !== -1) {
                  let depth = 0;
                  let braceEnd = -1;
                  for (let i = braceStart; i < afterMarker.length; i++) {
                    if (afterMarker[i] === '{') depth++;
                    else if (afterMarker[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
                  }
                  if (braceEnd !== -1) {
                    try {
                      escalationData = JSON.parse(afterMarker.slice(braceStart, braceEnd + 1));
                    } catch (parseErr) {
                      console.error('[Support] Failed to parse escalation JSON:', parseErr.message, 'Raw:', afterMarker.slice(braceStart, braceEnd + 1).substring(0, 300));
                      const rawText = afterMarker.slice(braceStart, braceEnd + 1);
                      escalationData = { issue: rawText.substring(0, 200), parse_error: true };
                    }
                  } else {
                    console.warn('[Support] No closing brace found. Raw after marker:', rawEscalationText);
                  }
                } else {
                  console.warn('[Support] No opening brace found. Raw after marker:', rawEscalationText);
                }
              }
              
              // Also capture the last user message for context
              const lastUserMsg = (await db.collection('messages').find({ conversation_id: convId, role: 'user' }).sort({ timestamp: -1 }).limit(1).toArray())?.[0];
              const lastUserContent = lastUserMsg?.content ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)).substring(0, 300) : 'N/A';
              
              const userEmail = user.email || 'unknown';
              const userName = user.display_name || user.email || 'Unknown user';
              
              console.log(`[Support] Escalation detected: user=${userEmail}, conv=${convId}, issue=${escalationData.issue?.substring(0, 100)}`);
              
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: process.env.SENDER_EMAIL || 'support@soulprintengine.ai',
                  to: 'team@archeforge.com',
                  subject: `[SoulPrint Support] ${escalationData.issue?.slice(0, 80) || 'User reported issue'}`,
                  html: `
                    <h2>Support Escalation from SoulPrint</h2>
                    <p><strong>User:</strong> ${userName} (${userEmail})</p>
                    <p><strong>Issue:</strong> ${escalationData.issue || 'N/A'}</p>
                    <p><strong>Steps/Context:</strong> ${escalationData.steps || escalationData.context || 'N/A'}</p>
                    <p><strong>Last User Message:</strong> ${lastUserContent}</p>
                    <p><strong>Conversation ID:</strong> ${convId}</p>
                    <p><strong>Model:</strong> ${model}</p>
                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                    ${rawEscalationText && escalationData.issue === 'Unknown issue flagged by AI' ? `<p><strong>Raw AI Escalation Output:</strong> <code>${rawEscalationText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></p>` : ''}
                    <hr>
                    <p style="color:#888;font-size:12px;">This was auto-escalated by SoulPrint's in-conversation support system.</p>
                  `,
                }),
              });
              console.log(`[Support] Escalation email sent for user ${userEmail}, conv ${convId}`);
            } catch (escErr) {
              console.error('[Support] Failed to send escalation email:', escErr);
            }
          })();
          
          // Clean the marker from the stored message so users don't see raw JSON
          // Use balanced-brace matching for cleanup too
          let cleanContent = fullContent;
          const escIdx = cleanContent.indexOf('[SUPPORT_ESCALATION]');
          if (escIdx !== -1) {
            const beforeMarker = cleanContent.slice(0, escIdx);
            const afterEsc = cleanContent.slice(escIdx + '[SUPPORT_ESCALATION]'.length).trim();
            const braceStart = afterEsc.indexOf('{');
            if (braceStart !== -1) {
              let depth = 0, braceEnd = -1;
              for (let i = braceStart; i < afterEsc.length; i++) {
                if (afterEsc[i] === '{') depth++;
                else if (afterEsc[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
              }
              if (braceEnd !== -1) {
                cleanContent = (beforeMarker + afterEsc.slice(braceEnd + 1)).trim();
              } else {
                cleanContent = beforeMarker.trim();
              }
            } else {
              cleanContent = beforeMarker.trim();
            }
          }
          if (cleanContent !== fullContent) {
            await db.collection('messages').updateOne(
              { id: assistantMsgId },
              { $set: { content: cleanContent, support_escalated: true } }
            );
          }
        }

        // ── Fallback Escalation Detection (NLP) ──────────────────────────────
        // If the AI mentioned escalating but forgot the [SUPPORT_ESCALATION] marker,
        // detect it from natural language and send the email anyway
        if (!fullContent.includes('[SUPPORT_ESCALATION]')) {
          const escalationPhrases = [
            /\b(?:team has been notified|engineering team.*notified|notified.*engineering|escalat(?:ed|ing).*(?:team|engineering|support)|sent? (?:this|it) to (?:the )?(?:engineering|support|tech) team)\b/i,
            /\b(?:I['']ll (?:escalate|send|report|flag) this|reported (?:this|it) to|flagging (?:this|it) for)\b/i,
          ];
          const looksLikeEscalation = escalationPhrases.some(p => p.test(fullContent));
          
          if (looksLikeEscalation) {
            console.log('[Support] NLP fallback: AI mentioned escalation without marker. Sending email...');
            (async () => {
              try {
                const userEmail = user.email || 'unknown';
                const userName = user.display_name || user.email || 'Unknown user';
                
                // Try to find the user's recent messages for context
                const recentUserMsgs = await db.collection('messages')
                  .find({ conversation_id: convId, role: 'user' })
                  .sort({ created_at: -1 }).limit(3).toArray();
                const contextMessages = recentUserMsgs.map(m => {
                  const c = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.find(p => p.type === 'text')?.text : '') || '';
                  return c.substring(0, 200);
                }).filter(Boolean).join(' | ');
                
                // Extract issue from AI response (first sentence that mentions the problem)
                const issueMatch = fullContent.match(/(?:issue|problem|error|bug|fail(?:ing|ed|ure)|not working|broken)[^.]*\./i);
                const issueDescription = issueMatch ? issueMatch[0].trim() : 'Technical issue reported by user (see context)';
                
                const emailRes = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    from: process.env.SENDER_EMAIL || 'support@soulprintengine.ai',
                    to: 'team@archeforge.com',
                    subject: `[SoulPrint Support] ${issueDescription.slice(0, 80)}`,
                    html: `
                      <h2>Support Escalation from SoulPrint</h2>
                      <p><em style="color:#e67e22;">⚠️ NLP fallback — AI mentioned escalation without formal marker</em></p>
                      <p><strong>User:</strong> ${userName} (${userEmail})</p>
                      <p><strong>Detected Issue:</strong> ${issueDescription}</p>
                      <p><strong>User's Recent Messages:</strong> ${contextMessages || 'N/A'}</p>
                      <p><strong>AI Response (excerpt):</strong> ${fullContent.substring(0, 500).replace(/</g, '&lt;')}</p>
                      <p><strong>Conversation ID:</strong> ${convId}</p>
                      <p><strong>Model:</strong> ${model}</p>
                      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                      <hr>
                      <p style="color:#888;font-size:12px;">Auto-detected escalation via NLP fallback. The AI mentioned notifying the team but did not include the [SUPPORT_ESCALATION] marker.</p>
                    `,
                  }),
                });
                if (!emailRes.ok) {
                  const errText = await emailRes.text().catch(() => '');
                  console.error('[Support] NLP fallback email failed:', emailRes.status, errText);
                } else {
                  console.log(`[Support] NLP fallback escalation email sent for user ${userEmail}, conv ${convId}`);
                }
                
                // Mark the message as escalated
                await db.collection('messages').updateOne(
                  { id: assistantMsgId },
                  { $set: { support_escalated: true, escalation_method: 'nlp_fallback' } }
                );
              } catch (escErr) {
                console.error('[Support] NLP fallback email error:', escErr);
              }
            })();
          }
        }

        // ── Long-Term Memory Extraction (async, non-blocking) ──────────────────
        // Extract and save important facts from this conversation exchange
        (async () => {
          try {
            const userContent = typeof userMessageContent === 'string' 
              ? userMessageContent 
              : userMessageContent.find(c => c.type === 'text')?.text || '';
            
            // Only extract memories from substantial exchanges
            if (userContent.length > 20 && fullContent.length > 50) {
              const extractedMemories = await extractMemoriesFromMessage(userContent, fullContent, user.id);
              if (extractedMemories.length > 0) {
                await saveExtractedMemories(db, user.id, extractedMemories, convId);
                console.log(`Extracted ${extractedMemories.length} memories for user ${user.id}`);
              }
            }
          } catch (memErr) {
            console.error('Memory extraction background error:', memErr);
          }
        })();

        // ── Auto-Image Generation Detection ──────────────────────────────
        // If the AI's text response indicates it wants to generate an image but 
        // the pre-LLM intent detection didn't trigger image generation, 
        // auto-trigger it now so the user doesn't have to send another message.
        if (!toolImageUrl && fullContent.length > 0) {
          const autoGenPatterns = [
            /(?:let me|I['']ll|I will|I am going to|going to)\s+(?:generate|create|make|design|produce)\s+(?:the|an?|that|this|your)\s+(?:image|visual|picture|graphic|infographic|illustration|design|mockup|photo|poster|banner|flyer)/i,
            /(?:generating|creating|making|designing|producing)\s+(?:the|an?|that|this|your)\s+(?:image|visual|picture|graphic|infographic|illustration|design|mockup|photo|poster|banner|flyer)\s+(?:now|for you|right now)/i,
            /(?:hold on|please wait|one moment)\s+(?:while|as)\s+I\s+(?:generate|create|make|design)\s+/i,
            /(?:I['']ll|let me)\s+(?:now|go ahead and)\s+(?:generate|create|make)/i,
          ];
          
          const shouldAutoGenerate = autoGenPatterns.some(p => p.test(fullContent));
          
          if (shouldAutoGenerate) {
            console.log('[Auto-Image-Gen] AI response indicates image generation intent — auto-triggering');
            try {
              // Extract a prompt from the AI's response or use the user's original message
              const userContent = typeof userMessageContent === 'string' 
                ? userMessageContent 
                : userMessageContent.find(c => c.type === 'text')?.text || '';
              
              // Try to get context from the conversation for a better prompt
              const recentMsgs = await db.collection('messages')
                .find({ conversation_id: convId })
                .sort({ created_at: -1 })
                .limit(6)
                .toArray();
              
              const contextSummary = recentMsgs
                .reverse()
                .map(m => `${m.role}: ${(m.content || '').substring(0, 200)}`)
                .join('\n');
              
              // Ask the LLM to create an image generation prompt from the context
              let imagePrompt = userContent;
              try {
                const promptRes = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LLM_API_KEY || process.env.OPENAI_API_KEY}` },
                  body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                      { role: 'system', content: 'You are an image prompt engineer. Given a conversation context, create a single detailed image generation prompt. Output ONLY the prompt text, nothing else. Make it vivid and specific.' },
                      { role: 'user', content: `Based on this conversation, create an image generation prompt:\n\n${contextSummary}` }
                    ],
                    max_tokens: 300,
                    temperature: 0.7,
                  }),
                });
                if (promptRes.ok) {
                  const promptData = await promptRes.json();
                  const extracted = promptData.choices?.[0]?.message?.content?.trim();
                  if (extracted && extracted.length > 10) {
                    imagePrompt = extracted;
                    console.log('[Auto-Image-Gen] Extracted prompt:', imagePrompt.substring(0, 100));
                  }
                }
              } catch (promptErr) {
                console.log('[Auto-Image-Gen] Prompt extraction failed, using user message:', promptErr.message);
              }
              
              // Notify the frontend that image generation is starting
              send({ type: 'generating_visual', visualType: 'image', model: 'auto' });
              
              // Use the same image generation logic
              const { selectBestImageModel } = await import('@/lib/handlers/media-intelligence.js');
              const modelSelection = selectBestImageModel(imagePrompt, null);
              let selectedModelKey = modelSelection.model;
              let modelConfig = KIE_IMAGE_MODELS[selectedModelKey];
              
              if (!modelConfig || modelConfig.available === false) {
                selectedModelKey = 'nano-banana';
                modelConfig = KIE_IMAGE_MODELS['nano-banana'];
              }
              
              console.log(`[Auto-Image-Gen] Selected model: ${selectedModelKey}`);
              
              const kieApiKey = process.env.KIE_API_KEY;
              let autoImageUrl = null;
              
              if (kieApiKey && modelConfig) {
                const inputPayload = modelConfig.formatInput(imagePrompt, '1:1');
                const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieApiKey}` },
                  body: JSON.stringify({ model: modelConfig.model, input: inputPayload }),
                });
                
                if (createRes.ok) {
                  const createData = await createRes.json();
                  const taskId = createData.data?.taskId;
                  
                  if (taskId) {
                    // Poll for completion
                    for (let poll = 0; poll < 60; poll++) {
                      await new Promise(r => setTimeout(r, 2000));
                      const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                        headers: { 'Authorization': `Bearer ${kieApiKey}` },
                      });
                      if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        const status = statusData.data?.status;
                        if (status === 'SUCCESS') {
                          const resultJson = typeof statusData.data?.resultJson === 'string'
                            ? JSON.parse(statusData.data.resultJson)
                            : statusData.data?.resultJson;
                          autoImageUrl = resultJson?.images?.[0]?.url || resultJson?.url || resultJson?.image_url || resultJson?.output;
                          
                          if (!autoImageUrl && statusData.data?.resultJson) {
                            const rawJson = typeof statusData.data.resultJson === 'string' ? statusData.data.resultJson : JSON.stringify(statusData.data.resultJson);
                            const urlMatch = rawJson.match(/https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp)/);
                            if (urlMatch) autoImageUrl = urlMatch[0];
                          }
                          break;
                        } else if (status === 'FAILED') {
                          console.log('[Auto-Image-Gen] Kie.ai task failed');
                          break;
                        }
                      }
                    }
                  }
                }
              }
              
              // Persist the image URL if we got one
              if (autoImageUrl) {
                // Persist to permanent storage
                if (autoImageUrl.includes('tempfile.aiquickdraw.com') || autoImageUrl.includes('oaidalleapiprodscus')) {
                  try {
                    const imgResp = await fetch(autoImageUrl, { signal: AbortSignal.timeout(30000) });
                    if (imgResp.ok) {
                      const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                      if (imgBuf.length <= 10 * 1024 * 1024) {
                        const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieApiKey}` },
                          body: JSON.stringify({
                            base64Data: `data:image/png;base64,${imgBuf.toString('base64')}`,
                            uploadPath: 'soulprint/generated',
                            fileName: `auto_gen_${Date.now()}.png`
                          }),
                        });
                        if (upRes.ok) {
                          const upData = await upRes.json();
                          if (upData.success && upData.data?.downloadUrl) {
                            autoImageUrl = upData.data.downloadUrl;
                          }
                        }
                      }
                    }
                  } catch (persistErr) {
                    console.warn('[Auto-Image-Gen] Persistence failed:', persistErr.message);
                  }
                }
                
                // Send image event
                send({ type: 'image', url: autoImageUrl, revised_prompt: imagePrompt, model: selectedModelKey });
                
                // Append the image markdown to the message content
                const imageMarkdown = `\n\n![Generated Image](${autoImageUrl})`;
                const updatedContent = fullContent + imageMarkdown;
                
                await db.collection('messages').updateOne(
                  { id: assistantMsgId },
                  { $set: { 
                    content: updatedContent, 
                    image_url: autoImageUrl,
                    auto_generated_image: true,
                    content_type: 'image'
                  }}
                );
                
                console.log('[Auto-Image-Gen] Successfully generated and appended image');
              } else {
                console.log('[Auto-Image-Gen] No image URL obtained — generation may have failed');
              }
            } catch (autoGenErr) {
              console.error('[Auto-Image-Gen] Error:', autoGenErr.message);
            }
          }
        }

        send({ type: 'done' });
        controller.close();
      } catch (error) {
        send({ type: 'error', error: error.message });
        controller.close();
      } finally {
        // Clean up keepalive interval
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ============================================================
// UNIFIED MEDIA GENERATION API
// ============================================================

// Model endpoint mappings for Kie.ai (using unified jobs API)
// Model names follow the format: provider/model-name 
// Costs are in Kie.ai credits (1 credit = $0.005)
// Each model has its own input parameter format
// KIE_IMAGE_MODELS and KIE_CREDIT_TO_USD are imported from '@/lib/handlers/image-models'

// Video costs - base credits per video (duration affects some models)

// ============================================================

// IMPORTS - Upload
async function handleImportUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  await ensureUploadsDir();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const importType = formData.get('type') || 'chatgpt';

    if (!file) return err('No file provided');

    const fileName = `${user.id}_${Date.now()}_${file.name}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const db = await getDb();
    const jobId = uuidv4();
    await db.collection('import_jobs').insertOne({
      id: jobId,
      user_id: user.id,
      type: importType,
      status: 'processing',
      file_path: filePath,
      file_name: file.name,
      error: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Process in background (non-blocking)
    processImportJob(jobId, user.id, importType, filePath, buffer).catch(console.error);

    return ok({ jobId, status: 'processing' });
  } catch (error) {
    return err(`Upload failed: ${error.message}`, 500);
  }
}

async function processImportJob(jobId, userId, importType, filePath, buffer) {
  const db = await getDb();
  try {
    let extractedText = '';
    const fileName = filePath.toLowerCase();
    let detectedType = importType;

    if (fileName.endsWith('.zip')) {
      try {
        const AdmZip = (await import('adm-zip')).default;
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        const entryNames = entries.map(e => e.entryName.toLowerCase());
        
        // Auto-detect format from file structure
        if (importType === 'auto' || !importType) {
          if (entryNames.some(n => n.includes('conversations.json') || n.includes('model_comparisons'))) {
            detectedType = 'chatgpt';
          } else if (entryNames.some(n => n.includes('messages/inbox/') || n.includes('your_posts') || n.includes('message_1.json'))) {
            detectedType = 'facebook';
          } else if (entryNames.some(n => n.includes('claude') && n.endsWith('.json'))) {
            detectedType = 'claude';
          } else if (entryNames.some(n => n.includes('takeout') || n.includes('my activity') || n.includes('gemini'))) {
            detectedType = 'google';
          } else {
            detectedType = 'auto'; // Will try all formats
          }
        }
        
        console.log(`[Import] Processing ${jobId}, detected type: ${detectedType}, entries: ${entries.length}`);
        
        for (const entry of entries) {
          if (!entry.isDirectory) {
            const name = entry.entryName.toLowerCase();
            if (name.endsWith('.json') || name.endsWith('.html') || name.endsWith('.txt')) {
              const content = entry.getData().toString('utf8');
              if (name.endsWith('.json')) {
                try {
                  const parsed = JSON.parse(content);
                  extractedText += extractTextFromJson(parsed, detectedType) + '\n\n';
                } catch { extractedText += content.slice(0, 5000) + '\n\n'; }
              } else {
                extractedText += content.replace(/<[^>]+>/g, ' ').slice(0, 5000) + '\n\n';
              }
              if (extractedText.length > 50000) break;
            }
          }
        }
      } catch (e) {
        extractedText = 'Could not extract zip: ' + e.message;
      }
    } else if (fileName.endsWith('.json')) {
      try {
        const parsed = JSON.parse(buffer.toString('utf8'));
        extractedText = extractTextFromJson(parsed, importType);
      } catch {
        extractedText = buffer.toString('utf8').slice(0, 50000);
      }
    } else {
      extractedText = buffer.toString('utf8').slice(0, 50000);
    }

    // Chunk text
    const chunkSize = 2000;
    const chunks = [];
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      chunks.push(extractedText.slice(i, i + chunkSize));
    }

    // Store chunks
    for (const chunkText of chunks.slice(0, 25)) {
      await db.collection('source_corpus_chunks').insertOne({
        id: uuidv4(),
        user_id: userId,
        import_job_id: jobId,
        chunk_text: chunkText,
        metadata: { type: importType },
        created_at: new Date(),
      });
    }

    // Generate soul profile summary using LLM
    let soulSummary = '';
    if (extractedText.length > 100) {
      try {
        const provider = getProvider('hosted', 'gpt-4o-mini');
        soulSummary = await provider.generateChatCompletion({
          systemPrompt: `You are analyzing personal data exports to understand someone's communication style, personality, and preferences. Be concise and insightful.`,
          messages: [{
            role: 'user',
            content: `Based on this data export (type: ${importType}), create a brief soul profile summary (200-300 words) covering:
1. Communication style and tone
2. Main interests and recurring topics
3. Work/life patterns and goals
4. Personality traits visible from their messages
5. What they seem to value most

Data sample:
${extractedText.slice(0, 8000)}`,
          }],
          model: 'gpt-4o-mini',
          temperature: 0.5,
        });
      } catch (e) {
        soulSummary = 'Could not generate summary: ' + e.message;
      }
    }

    // Update profile with soul summary
    if (soulSummary) {
      await db.collection('profiles').updateOne(
        { user_id: userId },
        { $set: { soul_profile_summary: soulSummary, soul_profile_updated_at: new Date() } }
      );
    }

    // PRIVACY: Delete the raw imported data - we only keep the insights
    // Delete chunks (which contain raw message text)
    await db.collection('import_chunks').deleteMany({ import_id: jobId });
    
    // Delete any imported messages from this import
    await db.collection('imported_messages').deleteMany({ 
      user_id: userId,
      import_id: jobId 
    });
    
    console.log(`[Import] Deleted raw data for import ${jobId} after processing - only insights retained`);

    // Mark job complete
    await db.collection('import_jobs').updateOne(
      { id: jobId },
      { $set: { 
        status: 'complete', 
        chunk_count: chunks.length, 
        updated_at: new Date(),
        raw_data_deleted: true,
        message: 'Import complete. Raw messages deleted - only insights retained for your SoulPrint.'
      } }
    );
  } catch (error) {
    await db.collection('import_jobs').updateOne(
      { id: jobId },
      { $set: { status: 'error', error: error.message, updated_at: new Date() } }
    );
  }
}

function extractTextFromJson(parsed, type) {
  let text = '';
  
  // ChatGPT format
  if (type === 'chatgpt' || type === 'auto') {
    if (Array.isArray(parsed)) {
      for (const conv of parsed.slice(0, 20)) {
        if (conv.mapping) {
          for (const node of Object.values(conv.mapping)) {
            const msg = node?.message;
            if (msg?.content?.parts) {
              const role = msg.author?.role || 'unknown';
              const content = msg.content.parts.filter(p => typeof p === 'string').join(' ');
              if (content.trim()) text += `[${role}]: ${content.slice(0, 500)}\n`;
            }
          }
        }
      }
    }
  }
  
  // Facebook Messenger format
  if ((type === 'facebook' || type === 'auto') && !text) {
    // Facebook messages are usually in format: { participants: [], messages: [] }
    if (parsed.messages && Array.isArray(parsed.messages)) {
      for (const msg of parsed.messages.slice(0, 100)) {
        const sender = msg.sender_name || 'Unknown';
        const content = msg.content || '';
        if (content.trim()) {
          text += `[${sender}]: ${content.slice(0, 500)}\n`;
        }
      }
    }
    // Or it could be an array of message objects
    if (Array.isArray(parsed) && parsed[0]?.content) {
      for (const msg of parsed.slice(0, 100)) {
        const sender = msg.sender_name || msg.sender || 'Unknown';
        const content = msg.content || msg.text || '';
        if (content.trim()) {
          text += `[${sender}]: ${content.slice(0, 500)}\n`;
        }
      }
    }
  }
  
  // Claude format
  if ((type === 'claude' || type === 'auto') && !text) {
    if (parsed.chat_messages && Array.isArray(parsed.chat_messages)) {
      for (const msg of parsed.chat_messages.slice(0, 100)) {
        const role = msg.sender === 'human' ? 'user' : 'assistant';
        const content = msg.text || '';
        if (content.trim()) {
          text += `[${role}]: ${content.slice(0, 500)}\n`;
        }
      }
    }
  }
  
  // Generic extraction for unknown formats
  if (!text) {
    // Try to find any messages array
    const findMessages = (obj, depth = 0) => {
      if (depth > 5 || text.length > 30000) return;
      if (Array.isArray(obj)) {
        for (const item of obj.slice(0, 50)) {
          if (item.content || item.text || item.message) {
            const content = item.content || item.text || item.message;
            const role = item.role || item.sender || item.sender_name || 'unknown';
            if (typeof content === 'string' && content.trim()) {
              text += `[${role}]: ${content.slice(0, 500)}\n`;
            }
          }
          if (typeof item === 'object') findMessages(item, depth + 1);
        }
      } else if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (key === 'messages' || key === 'chat_messages' || key === 'mapping') {
            findMessages(obj[key], depth + 1);
          }
        }
      }
    };
    findMessages(parsed);
  }
  
  return text || JSON.stringify(parsed).slice(0, 50000);
}

// IMPORTS - Get user imports
async function handleGetImports(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const imports = await db.collection('import_jobs')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();

  return ok(imports.map(i => ({
    id: i.id,
    type: i.type,
    status: i.status,
    file_name: i.file_name,
    error: i.error,
    chunk_count: i.chunk_count,
    created_at: i.created_at,
    updated_at: i.updated_at,
  })));
}

// ============================================================
// ADMIN HANDLERS
// ============================================================




// ADMIN - Create new user

// ADMIN - Delete user

// ADMIN - Get detailed user info



async function handleAdminDenyUser(request, userId) {
  const admin = await requireAdmin(request);
  if (!admin) return err('Forbidden', 403);

  const db = await getDb();
  await db.collection('users').updateOne({ id: userId }, { $set: { accepted: false } });

  await db.collection('admin_audit_log').insertOne({
    id: uuidv4(),
    admin_user_id: admin.id,
    action: 'deny_user',
    target_user_id: userId,
    created_at: new Date(),
  });

  return ok({ success: true });
}


// Helper function to get voice chat metrics for admin dashboard


// Export users for email campaigns

// Get available filter options for export




// Privacy helper: Categorize conversation into a general topic (doesn't expose actual content)
function categorizeConversationTopic(title) {
  if (!title) return 'General Chat';
  const lower = title.toLowerCase();
  
  // Coding & Tech
  if (/\b(code|coding|programming|javascript|python|react|api|debug|error|function|bug|deploy|database|sql|html|css|git)\b/.test(lower)) {
    return '💻 Coding & Development';
  }
  // Writing & Content
  if (/\b(write|writing|draft|email|blog|article|essay|content|copy|edit|proofread|story|poem)\b/.test(lower)) {
    return '✍️ Writing & Content';
  }
  // Business & Work
  if (/\b(business|work|meeting|project|strategy|marketing|sales|startup|pitch|investor|client|presentation)\b/.test(lower)) {
    return '💼 Business & Work';
  }
  // Research & Learning
  if (/\b(research|learn|study|explain|understand|how does|what is|why|teach|tutorial|course)\b/.test(lower)) {
    return '📚 Research & Learning';
  }
  // Creative & Design
  if (/\b(design|creative|art|image|logo|brand|color|style|ui|ux|graphic|video|animation)\b/.test(lower)) {
    return '🎨 Creative & Design';
  }
  // Travel & Places
  if (/\b(travel|trip|vacation|hotel|flight|restaurant|visit|tour|city|country|location|nearby)\b/.test(lower)) {
    return '✈️ Travel & Places';
  }
  // Health & Wellness
  if (/\b(health|fitness|workout|diet|medical|doctor|symptom|exercise|wellness|mental|therapy)\b/.test(lower)) {
    return '🏥 Health & Wellness';
  }
  // Finance & Money
  if (/\b(money|finance|invest|stock|crypto|budget|save|price|cost|salary|tax|bank)\b/.test(lower)) {
    return '💰 Finance & Money';
  }
  // Social Media
  if (/\b(twitter|instagram|linkedin|tiktok|facebook|post|caption|social media|viral|followers)\b/.test(lower)) {
    return '📱 Social Media';
  }
  // News & Current Events
  if (/\b(news|today|current|latest|2024|2025|2026|happened|event|update|trending)\b/.test(lower)) {
    return '📰 News & Current Events';
  }
  // Personal & Life
  if (/\b(personal|life|family|relationship|friend|advice|help me|feeling|emotion)\b/.test(lower)) {
    return '🌟 Personal & Life';
  }
  // Images & Media
  if (/\b(image|picture|photo|generate|create|draw|illustration|video|animation)\b/.test(lower)) {
    return '🖼️ Image & Media Generation';
  }
  
  return '💬 General Chat';
}




// Public endpoint to check feature flags (no admin required, but requires auth)
async function handleGetFeatureFlags(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'global' });

  // Only expose safe feature flags to users
  return ok({
    voice_chat_enabled: settings?.voice_chat_enabled !== false, // Default to true if not set
    viral_invites_enabled: settings?.viral_invites_enabled === true,
  });
}

// ============================================================
// VOICE SETTINGS & STATS
// ============================================================

async function handleGetVoiceSettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  const settings = await db.collection('voice_settings').findOne({ user_id: user.id });
  
  return ok(settings || {
    voice: 'alloy',
    default_voice: 'alloy',
    default_gemini_voice: 'Puck',
    voice_engine: 'openai',
    speed: 1.0,
    autoPlay: true,
    saveTranscripts: true,
    web_search_enabled: true,
  });
}

async function handleUpdateVoiceSettings(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const body = await request.json();
  const db = await getDb();
  
  await db.collection('voice_settings').updateOne(
    { user_id: user.id },
    { $set: { ...body, user_id: user.id, updated_at: new Date() } },
    { upsert: true }
  );
  
  // Also update voice_settings in the user profile so /api/auth/me returns latest
  await db.collection('profiles').updateOne(
    { user_id: user.id },
    { $set: { voice_settings: body, updated_at: new Date() } }
  );
  
  return ok({ message: 'Voice settings saved' });
}

async function handleGetVoiceStats(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);
  
  const db = await getDb();
  
  // Count voice sessions and total duration
  const sessions = await db.collection('voice_sessions')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
  
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const lastSession = sessions[0] || null;
  
  return ok({
    totalSessions,
    totalDuration,
    averageDuration: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0,
    lastSessionAt: lastSession?.created_at || null,
    recentSessions: sessions.slice(0, 10).map(s => ({
      id: s.id,
      duration: s.duration || 0,
      created_at: s.created_at,
      transcript_length: s.transcript?.length || 0,
    })),
  });
}

// ============================================================
// TELEGRAM CONNECTOR
// ============================================================


async function sendTelegramMessage(chatId, token, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

// GET /api/telegram/status — check if user's Telegram is linked
async function handleTelegramStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return ok({ configured: false, linked: false, message: 'Telegram bot not configured' });
  }

  const db = await getDb();
  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });

  return ok({
    configured: true,
    linked: !!mapping,
    telegram_chat_id: mapping?.telegram_chat_id || null,
    telegram_username: mapping?.telegram_username || null,
    preferred_model: mapping?.preferred_model || 'gpt-4o',
    linked_at: mapping?.linked_at || null,
  });
}

// POST /api/telegram/link — link a Telegram account with a link code
async function handleTelegramLink(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { link_code } = body;
  if (!link_code) return err('Link code required');

  const db = await getDb();

  // Find the pending link code
  const pending = await db.collection('telegram_links').findOne({
    code: link_code.trim(),
    used: { $ne: true },
  });

  if (!pending) {
    return err('Invalid or expired link code. Please generate a new one in Telegram by sending /start.', 400);
  }

  // Check if code is expired (15 min window)
  const codeAge = Date.now() - new Date(pending.created_at).getTime();
  if (codeAge > 15 * 60 * 1000) {
    return err('Link code expired. Please generate a new one in Telegram by sending /start.', 400);
  }

  // Mark the link code as used
  await db.collection('telegram_links').updateOne(
    { _id: pending._id },
    { $set: { used: true, used_at: new Date(), user_id: user.id } }
  );

  // Create or update the telegram mapping
  await db.collection('telegram_mappings').updateOne(
    { user_id: user.id },
    {
      $set: {
        user_id: user.id,
        telegram_chat_id: pending.chat_id,
        telegram_username: pending.username || null,
        linked: true,
        linked_at: new Date(),
        preferred_model: 'gpt-4o',
      }
    },
    { upsert: true }
  );

  // Send confirmation message to user on Telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && pending.chat_id) {
    try {
      await sendTelegramMessage(pending.chat_id, botToken, '✅ *Successfully linked to SoulPrint!*\n\nYou can now chat with me here. Send any message to get started.\n\nUse /model to change the AI model.');
    } catch (e) {
      console.error('Failed to send Telegram confirmation:', e);
    }
  }

  return ok({ message: 'Telegram linked successfully!' });
}

// POST /api/telegram/unlink — disconnect Telegram
async function handleTelegramUnlink(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();

  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });

  if (!mapping) {
    return err('No linked Telegram account found', 404);
  }

  // Send goodbye message
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && mapping.telegram_chat_id) {
    try {
      await sendTelegramMessage(mapping.telegram_chat_id, botToken, '👋 *Disconnected from SoulPrint.*\n\nYour Telegram has been unlinked. Send /start to re-link.');
    } catch (e) {
      console.error('Failed to send Telegram disconnect msg:', e);
    }
  }

  // Mark as unlinked
  await db.collection('telegram_mappings').updateOne(
    { user_id: user.id },
    { $set: { linked: false, unlinked_at: new Date() } }
  );

  return ok({ message: 'Telegram disconnected' });
}

// PUT /api/telegram/model — set preferred AI model for Telegram
async function handleTelegramModel(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { model } = body;
  if (!model) return err('Model required');

  const db = await getDb();
  const mapping = await db.collection('telegram_mappings').findOne({ user_id: user.id, linked: true });

  if (!mapping) {
    return err('No linked Telegram account. Please link Telegram first.', 400);
  }

  await db.collection('telegram_mappings').updateOne(
    { user_id: user.id, linked: true },
    { $set: { preferred_model: model, model_updated_at: new Date() } }
  );

  return ok({ message: `Model set to ${model}`, model });
}

// POST /api/telegram/webhook — handle incoming Telegram messages
async function handleTelegramWebhook(request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return err('Bot not configured', 500);

  const body = await request.json();
  const message = body?.message;
  if (!message?.text || !message?.chat?.id) return ok({ ok: true });

  const chatId = message.chat.id;
  const text = message.text.trim();
  const username = message.from?.username || null;

  const db = await getDb();

  // Handle /start command — generate a link code
  if (text === '/start' || text.startsWith('/start')) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await db.collection('telegram_links').insertOne({
      code,
      chat_id: chatId,
      username,
      created_at: new Date(),
      used: false,
    });
    await sendTelegramMessage(chatId, botToken,
      `🔗 *Link to SoulPrint*\n\nYour link code is: \`${code}\`\n\nGo to SoulPrint → Settings → Telegram and enter this code to connect.\n\n_Code expires in 15 minutes._`
    );
    return ok({ ok: true });
  }

  // Handle /model command
  if (text.startsWith('/model')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendTelegramMessage(chatId, botToken,
        '🤖 *Current models:*\n`smart` - Dynamic Intelligence (auto)\n`gpt-4o` - GPT-4o\n`gpt-4o-mini` - GPT-4o Mini\n`gpt-4.1` - GPT-4.1\n`claude-sonnet-4-20250514` - Claude Sonnet 4\n`gemini-2.5-pro` - Gemini 2.5 Pro\n`sonar-pro` - Perplexity Sonar Pro\n\nUsage: `/model gpt-4o`'
      );
      return ok({ ok: true });
    }
    const modelName = parts.slice(1).join(' ');
    const mapping = await db.collection('telegram_mappings').findOne({ telegram_chat_id: chatId, linked: true });
    if (mapping) {
      await db.collection('telegram_mappings').updateOne(
        { telegram_chat_id: chatId, linked: true },
        { $set: { preferred_model: modelName, model_updated_at: new Date() } }
      );
      await sendTelegramMessage(chatId, botToken, `✅ Model set to \`${modelName}\``);
    } else {
      await sendTelegramMessage(chatId, botToken, '❌ Please link your account first. Send /start to get a link code.');
    }
    return ok({ ok: true });
  }

  // Regular message — find mapping and route to AI
  const mapping = await db.collection('telegram_mappings').findOne({ telegram_chat_id: chatId, linked: true });
  if (!mapping) {
    await sendTelegramMessage(chatId, botToken, '❌ Your account is not linked. Send /start to link.');
    return ok({ ok: true });
  }

  // Find or create a telegram conversation
  let conv = await db.collection('conversations').findOne({ user_id: mapping.user_id, source: 'telegram' });
  if (!conv) {
    const convId = uuidv4();
    conv = {
      id: convId,
      user_id: mapping.user_id,
      title: 'Telegram Chat',
      source: 'telegram',
      created_at: new Date(),
      updated_at: new Date(),
    };
    await db.collection('conversations').insertOne(conv);
  }

  // Save user message
  const userMsgId = uuidv4();
  await db.collection('messages').insertOne({
    id: userMsgId,
    conversation_id: conv.id,
    user_id: mapping.user_id,
    role: 'user',
    content: text,
    source: 'telegram',
    created_at: new Date(),
  });

  // Update conversation timestamp
  await db.collection('conversations').updateOne(
    { id: conv.id },
    { $set: { updated_at: new Date() } }
  );

  // Get recent messages for context
  const recentMessages = await db.collection('messages')
    .find({ conversation_id: conv.id })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();
  recentMessages.reverse();

  const model = mapping.preferred_model || 'gpt-4o';

  // Get user profile for system prompt
  const profile = await db.collection('profiles').findOne({ user_id: mapping.user_id });
  const displayName = profile?.display_name || username || 'there';

  try {
    // Call the AI
    const messages = [
      { role: 'system', content: `You are SoulPrint, a helpful AI assistant. You are chatting with ${displayName} via Telegram. Be concise and helpful. Keep responses short and mobile-friendly.` },
      ...recentMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model, messages, max_tokens: 1000 }),
    });

    const aiData = await aiRes.json();
    const reply = aiData.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response. Please try again.';

    // Save assistant message
    const assistantMsgId = uuidv4();
    await db.collection('messages').insertOne({
      id: assistantMsgId,
      conversation_id: conv.id,
      user_id: mapping.user_id,
      role: 'assistant',
      content: reply,
      model_used: model,
      source: 'telegram',
      created_at: new Date(),
    });

    // Send to Telegram
    await sendTelegramMessage(chatId, botToken, reply);
  } catch (aiErr) {
    console.error('Telegram AI error:', aiErr);
    await sendTelegramMessage(chatId, botToken, '⚠️ Sorry, I encountered an error. Please try again.');
  }

  return ok({ ok: true });
}



// CONNECTORS (stubs for others)
async function handleConnectorStub(platform) {
  return NextResponse.json({
    status: 'not_configured',
    message: `${platform} connector is not yet implemented. Telegram is available — configure TELEGRAM_BOT_TOKEN in .env.`,
  });
}

// ============================================================
// ASSESSMENT RESET ENDPOINT
// ============================================================

async function handleResetAssessment(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get current assessment answers for backup/history
  const currentAnswers = await db.collection('assessment_answers')
    .find({ user_id: user.id })
    .toArray();
  
  if (currentAnswers.length > 0) {
    // Archive old answers
    await db.collection('assessment_history').insertOne({
      user_id: user.id,
      answers: currentAnswers,
      archived_at: new Date(),
    });
    
    // Delete current answers
    await db.collection('assessment_answers').deleteMany({ user_id: user.id });
  }
  
  // Reset assessment_complete flag
  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { assessment_complete: false } }
  );
  
  return ok({ 
    success: true, 
    message: 'Assessment reset. You can now retake the 36-question guide.',
    previousAnswers: currentAnswers.length
  });
}

// PLACES SEARCH API - for web app
async function handlePlacesSearch(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { query, location, lat, lng, radius = 2000, maxResults = 10 } = body;

  if (!query && !location && (!lat || !lng)) {
    return err('Either query with location, or lat/lng coordinates required');
  }

  try {
    let coords = { lat, lng };
    let locationName = location || 'selected location';

    // If no coordinates, geocode the location
    if (!lat || !lng) {
      if (location) {
        const geocoded = await geocodeAddress(location);
        if (!geocoded) return err(`Could not find location: ${location}`);
        coords = { lat: geocoded.lat, lng: geocoded.lng };
        locationName = geocoded.formattedAddress;
      } else {
        return err('Location or coordinates required');
      }
    }

    // Extract place type from query
    const placeType = query ? extractPlaceType(query) : null;

    const places = await searchNearbyPlaces({
      lat: coords.lat,
      lng: coords.lng,
      query: placeType ? null : query,
      type: placeType,
      radius,
      maxResults,
    });

    return ok({
      places,
      location: locationName,
      coordinates: coords,
      count: places.length,
    });
  } catch (e) {
    return err(`Search failed: ${e.message}`, 500);
  }
}

// GEOCODE API - convert address to coordinates
async function handleGeocode(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { address } = body;

  if (!address) return err('address required');

  try {
    const result = await geocodeAddress(address);
    if (!result) return err(`Could not find location: ${address}`);
    return ok(result);
  } catch (e) {
    return err(`Geocode failed: ${e.message}`, 500);
  }
}

// TRANSCRIBE - Whisper audio transcription (fallback for non-Chrome browsers)
async function handleTranscribe(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    if (!audioFile) return err('No audio file provided');

    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    return ok({ text: transcription.text });
  } catch (error) {
    return err(`Transcription failed: ${error.message}`, 500);
  }
}

// USER LOCATION - Save browser geolocation for web app
async function handleSaveUserLocation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { lat, lng, timezone } = body;

  if (!lat || !lng) return err('lat and lng required');

  try {
    const db = await getDb();
    
    // Reverse geocode to get address
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    let address = 'Your location';
    
    if (apiKey) {
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
      const geoData = await geoRes.json();
      address = geoData.results?.[0]?.formatted_address || 'Your location';
    }

    // Use provided timezone or try to detect from coordinates
    let userTimezone = timezone;
    if (!userTimezone && apiKey) {
      // Use Google Timezone API
      const timestamp = Math.floor(Date.now() / 1000);
      const tzRes = await fetch(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`);
      const tzData = await tzRes.json();
      if (tzData.timeZoneId) {
        userTimezone = tzData.timeZoneId;
      }
    }

    await db.collection('user_locations').updateOne(
      { user_id: user.id },
      { 
        $set: { 
          lat, 
          lng, 
          address,
          timezone: userTimezone || 'UTC',
          updated_at: new Date(),
          source: 'web'
        } 
      },
      { upsert: true }
    );

    // Invalidate system prompt cache so location is included in future queries
    invalidateSystemPromptCache(user.id);

    return ok({ success: true, address, lat, lng, timezone: userTimezone || 'UTC' });
  } catch (error) {
    return err(`Failed to save location: ${error.message}`, 500);
  }
}

// USER LOCATION - Get current saved location
async function handleGetUserLocation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const db = await getDb();
    let location = await db.collection('user_locations').findOne({ user_id: user.id });
    
    // If no location saved, try to auto-detect from IP
    if (!location || !location.lat || !location.lng) {
      const clientIP = getClientIP(request);
      if (clientIP) {
        const ipLocation = await getLocationFromIP(clientIP);
        if (ipLocation) {
          await db.collection('user_locations').updateOne(
            { user_id: user.id },
            { 
              $set: { 
                ...ipLocation,
                updated_at: new Date()
              } 
            },
            { upsert: true }
          );
          location = ipLocation;
          // Invalidate cache so the new location is included in the system prompt
          invalidateSystemPromptCache(user.id);
        }
      }
    }
    
    if (!location || !location.lat || !location.lng) {
      return ok({ hasLocation: false });
    }

    return ok({ 
      hasLocation: true, 
      lat: location.lat, 
      lng: location.lng, 
      address: location.address,
      source: location.source || 'manual', // 'ip_auto', 'web', 'telegram'
      city: location.city,
      region: location.region,
      country: location.country,
      timezone: location.timezone,
      updated_at: location.updated_at
    });
  } catch (error) {
    return err(`Failed to get location: ${error.message}`, 500);
  }
}

// USER TIMEZONE - Save timezone (auto-detected from browser)
async function handleSaveUserTimezone(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const body = await request.json();
    const { timezone } = body;
    
    if (!timezone) return err('timezone required');

    const db = await getDb();
    
    await db.collection('user_locations').updateOne(
      { user_id: user.id },
      { 
        $set: { 
          timezone,
          timezone_updated_at: new Date(),
        },
        $setOnInsert: {
          user_id: user.id,
          source: 'auto'
        }
      },
      { upsert: true }
    );

    // Invalidate system prompt cache
    invalidateSystemPromptCache(user.id);

    return ok({ success: true, timezone });
  } catch (error) {
    return err(`Failed to save timezone: ${error.message}`, 500);
  }
}

// USER TIMEZONE - Get timezone
async function handleGetUserTimezone(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const db = await getDb();
    const location = await db.collection('user_locations').findOne({ user_id: user.id });
    
    return ok({ 
      timezone: location?.timezone || 'UTC',
      hasTimezone: !!location?.timezone
    });
  } catch (error) {
    return err(`Failed to get timezone: ${error.message}`, 500);
  }
}

// MODELS - Get available
async function handleGetModels(request) {
  return ok(AVAILABLE_MODELS);
}

// ============================================================
// EXTRACTED DATA IMPORT (Client-side processed)
// ============================================================

async function handleImportExtracted(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { type, messages, posts } = body;

  if (!messages || !Array.isArray(messages)) {
    return err('Messages array required');
  }

  const db = await getDb();
  const importId = uuidv4();

  // Create import job
  await db.collection('import_jobs').insertOne({
    id: importId,
    user_id: user.id,
    type: type || 'chatgpt',
    source: 'extracted',
    status: 'processing',
    progress: 10,
    message: 'Processing extracted data...',
    messages_count: 0,
    created_at: new Date(),
  });

  // Process in background
  processExtractedImport(db, user.id, importId, type, messages, posts || []).catch(err => {
    console.error('[ExtractedImport] Error:', err);
    db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status: 'failed', error: err.message } }
    );
  });

  return ok({ success: true, importId });
}

async function processExtractedImport(db, userId, importId, importType, messages, posts) {
  const updateStatus = async (status, message, progress, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    await updateStatus('processing', 'Deduplicating messages...', 20);

    // Hash messages for deduplication
    const hashMessage = (m) => {
      const str = `${m.content}|${m.role}|${m.timestamp || ''}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash.toString(16);
    };

    const messagesWithHash = messages.map(m => ({
      ...m,
      content_hash: hashMessage(m)
    }));

    // Check for existing messages
    const existingMsgs = await db.collection('imported_messages')
      .find({ user_id: userId })
      .project({ content_hash: 1 })
      .toArray();
    const existingHashes = new Set(existingMsgs.map(m => m.content_hash));

    // Filter new messages
    const newMessages = messagesWithHash.filter(m => !existingHashes.has(m.content_hash));

    await updateStatus('processing', `Importing ${newMessages.length} new messages...`, 40);

    // Insert new messages
    if (newMessages.length > 0) {
      const docs = newMessages.map(m => ({
        id: uuidv4(),
        user_id: userId,
        content: m.content,
        role: m.role,
        timestamp: m.timestamp,
        source: importType,
        content_hash: m.content_hash,
        conversation_id: m.conversation_id,
        conversation_title: m.conversation_title,
        sender: m.sender,
        imported_at: new Date(),
      }));

      const batchSize = 1000;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        await db.collection('imported_messages').insertMany(batch);
      }
    }

    // Import posts if any
    if (posts && posts.length > 0) {
      const postDocs = posts.map(p => ({
        id: uuidv4(),
        user_id: userId,
        content: p.content,
        timestamp: p.timestamp,
        source: importType,
        imported_at: new Date(),
      }));
      await db.collection('imported_posts').insertMany(postDocs);
    }

    await updateStatus('processing', 'Analyzing communication patterns...', 60);

    // Create data import record for analysis
    const dataImportId = uuidv4();
    await db.collection('data_imports').insertOne({
      id: dataImportId,
      user_id: userId,
      source: importType,
      status: 'processing',
      stats: {
        source: importType,
        conversationCount: new Set(messages.filter(m => m.conversation_id).map(m => m.conversation_id)).size,
        messageCount: newMessages.length,
        postCount: posts?.length || 0
      },
      created_at: new Date(),
    });

    // Analyze the data using AI
    let analysis = null;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_KEY && newMessages.length > 0) {
      try {
        const userMsgs = newMessages
          .filter(m => m.role === 'user' || m.role === 'human')
          .slice(0, 50)
          .map(m => m.content)
          .join('\n---\n');

        if (userMsgs.length > 100) {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Analyze this user's conversation history and create a personality/communication profile.
Return JSON with:
{
  "summary": "2-3 sentence summary of the person",
  "communicationStyle": {"formality": "formal/casual/mixed", "verbosity": "detailed/concise/balanced", "tone": "analytical/supportive/direct/friendly"},
  "interests": ["interest1", "interest2", ...],
  "vocabulary": {"complexity": "sophisticated/moderate/simple", "uniquePhrases": [], "emoji_usage": "frequent/occasional/none"},
  "questionStyle": "direct/context-heavy/exploratory",
  "insights": ["insight1", "insight2", "insight3"]
}`
                },
                {
                  role: 'user',
                  content: `Analyze these ${importType} messages:\n\n${userMsgs.substring(0, 15000)}`
                }
              ],
              temperature: 0.3,
              max_tokens: 1500,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              analysis = JSON.parse(jsonMatch[0]);
            }
          }
        }
      } catch (e) {
        console.error('[ExtractedImport] Analysis error:', e);
      }
    }

    // Update data import with analysis
    await db.collection('data_imports').updateOne(
      { id: dataImportId },
      { $set: { status: 'complete', analysis, completed_at: new Date() } }
    );

    await updateStatus('processing', 'Extracting memories...', 80);

    // Extract memories
    const memoriesAdded = await extractMemoriesFromImport(db, userId, newMessages, importType);

    // Update soul profile
    if (analysis) {
      await db.collection('soul_profiles').updateOne(
        { user_id: userId },
        {
          $set: {
            insights: {
              communicationStyle: analysis.communicationStyle,
              vocabulary: analysis.vocabulary
            },
            updated_at: new Date()
          },
          $addToSet: {
            interests: { $each: analysis.interests || [] }
          }
        },
        { upsert: true }
      );
    }

    // Clear system prompt cache
    _systemPromptCache.delete(userId);

    await updateStatus('completed', 
      `Successfully imported ${newMessages.length} messages${memoriesAdded > 0 ? ` and added ${memoriesAdded} memories` : ''}!`, 
      100, 
      { messages_count: newMessages.length, memories_added: memoriesAdded }
    );

  } catch (error) {
    console.error('[ExtractedImport] Processing error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

// ============================================================
// BLOG API HANDLERS
// ============================================================

// Helper to generate URL-friendly slug
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100);
}

// Get all published blog posts (public)
async function handleGetBlogPosts(request) {
  const db = await getDb();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const category = url.searchParams.get('category');
  const tag = url.searchParams.get('tag');
  
  const query = { status: 'published' };
  if (category) query.category = category;
  if (tag) query.tags = tag;
  
  const posts = await db.collection('blog_posts')
    .find(query)
    .sort({ published_at: -1 })
    .limit(limit)
    .toArray();
  
  // Get all unique categories and tags for filtering
  const allPosts = await db.collection('blog_posts')
    .find({ status: 'published' })
    .project({ category: 1, tags: 1 })
    .toArray();
  
  const categories = [...new Set(allPosts.map(p => p.category).filter(Boolean))];
  const tags = [...new Set(allPosts.flatMap(p => p.tags || []))];
  
  return ok({ posts, categories, tags });
}

// Get single blog post by slug (public)
async function handleGetBlogPost(request, slug) {
  const db = await getDb();
  
  const post = await db.collection('blog_posts').findOne({ 
    slug, 
    status: 'published' 
  });
  
  if (!post) return err('Post not found', 404);
  
  // Get related posts (same category)
  const relatedPosts = await db.collection('blog_posts')
    .find({ 
      status: 'published', 
      category: post.category, 
      id: { $ne: post.id } 
    })
    .sort({ published_at: -1 })
    .limit(3)
    .toArray();
  
  return ok({ post, relatedPosts });
}

// Admin: Get all blog posts (including drafts)

// Admin: Create blog post

// Admin: Update blog post

// Admin: Delete blog post

// ============================================================
// SLACK BOT INTEGRATION
// ============================================================


// Knowledge base for the bot - key issues and solutions
// Analyze issue and find matching solution

// Send message to Slack

// Send DM to escalation user

// Generate fix suggestion using AI

// In-memory store for support conversations (for tracking multi-turn interactions)
// In production, you'd want this in MongoDB or Redis

// Conversation states

// Common user errors and their solutions (simple, friendly language)

// Determine if issue is user error or technical bug

// Use AI to help triage ambiguous issues


// ============================================================
// NOTIFICATIONS HANDLERS
// ============================================================

async function handleGetNotifications(request) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  
  // Find unread notifications for this user (by user_id or email)
  const notifications = await db.collection('notifications').find({
    $or: [
      { user_id: user.id },
      { user_email: user.email?.toLowerCase() }
    ],
    read: false,
  }).sort({ created_at: -1 }).limit(20).toArray();

  // Clean up MongoDB _id
  const cleaned = notifications.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    conversation_id: n.conversation_id,
    created_at: n.created_at,
  }));

  return NextResponse.json({ notifications: cleaned });
}

async function handleMarkNotificationsRead(request) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { notification_ids } = body; // Array of notification IDs to mark read, or 'all'

  const db = await getDb();

  if (notification_ids === 'all') {
    await db.collection('notifications').updateMany(
      { $or: [{ user_id: user.id }, { user_email: user.email?.toLowerCase() }] },
      { $set: { read: true } }
    );
  } else if (Array.isArray(notification_ids)) {
    await db.collection('notifications').updateMany(
      { id: { $in: notification_ids } },
      { $set: { read: true } }
    );
  }

  return NextResponse.json({ success: true });
}


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
      await db.collection('messages').updateOne(
        { id: messageId, user_id: user.id },
        { $set: { video_url, thumbnail_url: thumbnail_url || null, 'video_task.status': 'success' } }
      );
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
