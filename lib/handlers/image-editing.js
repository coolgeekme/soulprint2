/**
 * Image editing, compositing, and mockup generation handlers
 * Extracted from the main catch-all route.js for maintainability.
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err } from '@/lib/api-utils';
import { KIE_IMAGE_MODELS, KIE_CREDIT_TO_USD } from '@/lib/handlers/image-models';
import { generateImageWithKie } from '@/lib/handlers/model-comparison';

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

// ═══════════════════════════════════════════════════════════════════════════
// Image editing internals
// ═══════════════════════════════════════════════════════════════════════════

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
        size: '1536x1024',
        quality: 'high',
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
              size: '1792x1024',
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
        size: '1792x1024',
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


export {
  handleImageEdit,
  handleCompositeTest,
  handleMockupGenerate,
  handleRealtimeSession,
  reformulateForSafety,
  pollKieTaskResult,
  handleImageEditInternal,
  handleMockupGenerateInternal,
  handleGeminiComposite,
  handleSmartComposite,
  removeLogoBackground,
  compositeLogoAtPlacement,
};
