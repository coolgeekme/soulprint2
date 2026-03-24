# IMAGE & VIDEO GENERATION CODE TRANSFER

## Instructions for Your Other Emergent App

Copy each section below and paste it into your other Emergent app. The existing code will be UPDATED, not deleted.

---

# SECTION 1: Backend Image Edit Function

**Paste this message into your other Emergent app:**

---

Please replace or add the `handleImageEditInternal` function in `/app/app/api/[[...path]]/route.js`. This is the core image editing function that handles GPT-image-1, SeeDream v4, and Flux Kontext with spatial enhancement.

Here is the complete function - replace any existing version:

```javascript
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
  // METHOD 0: GPT Image (gpt-image-1) - For complex edits requiring understanding
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
```

Make sure the `reformulateForSafety` function exists. If not, add this simple version:

```javascript
function reformulateForSafety(instruction) {
  // Basic safety reformulation
  return instruction.replace(/\b(nsfw|nude|naked|explicit)\b/gi, '[filtered]');
}
```

---

