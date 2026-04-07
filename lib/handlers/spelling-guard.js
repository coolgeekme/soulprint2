/**
 * Spelling Guard — Ensures AI-generated images contain correctly spelled text.
 * 
 * Two-layer defense:
 *   Layer 1 (Pre-generation): Detects intended text in prompts and adds
 *           character-by-character spelling instructions.
 *   Layer 2 (Post-generation): OCR-validates rendered text via GPT-4o Vision
 *           and auto-retries with stronger instructions if misspelled.
 */

// ── Layer 1: Smart Prompt Enhancement ─────────────────────────────────────

/**
 * Extracts text strings that should appear in the generated image.
 * Looks for quoted strings, explicit "text: ..." patterns, and brand names.
 */
function extractIntendedText(prompt) {
  const textPieces = [];

  // 1. Quoted strings — "Hello World", 'SoulPrint Engine'
  const quotedMatches = prompt.match(/["'""''«»]([^"'""''«»]{2,80})["'""''«»]/g);
  if (quotedMatches) {
    for (const q of quotedMatches) {
      const inner = q.slice(1, -1).trim();
      if (inner.length >= 2 && !/^(a|an|the|it|is|in|on|at|to|of|for|and|or|but|with|this|that|my|your)$/i.test(inner)) {
        textPieces.push(inner);
      }
    }
  }

  // 2. Explicit "text: ..." / "saying ..." / "reads ..." / "with the text ..." patterns
  const textPatterns = [
    /\b(?:text|texts|word|words|title|headline|heading|slogan|tagline|caption|label|name)\s*(?::|saying|that\s+(?:says|reads))\s*["'"]?([^"'"\n.]{2,80})["'"]?/gi,
    /\b(?:says?|reads?|reading|displaying|showing)\s+["'"]?([^"'"\n.]{2,80})["'"]?/gi,
    /\bwith\s+(?:the\s+)?(?:text|words?|title|heading)\s+["'"]?([^"'"\n.]{2,80})["'"]?/gi,
    /\b(?:write|spell|print|display|show)\s+["'"]?([^"'"\n.]{2,80})["'"]?/gi,
  ];

  for (const pattern of textPatterns) {
    let match;
    while ((match = pattern.exec(prompt)) !== null) {
      const extracted = match[1].trim();
      if (extracted.length >= 2 && !textPieces.includes(extracted)) {
        textPieces.push(extracted);
      }
    }
  }

  return [...new Set(textPieces)]; // Deduplicate
}

/**
 * Enhances a prompt with character-by-character spelling instructions
 * for any detected text strings.
 */
function enhancePromptWithSpelling(prompt) {
  const intendedTexts = extractIntendedText(prompt);

  if (intendedTexts.length === 0) {
    return { enhancedPrompt: prompt, intendedTexts: [] };
  }

  // Build spelling instructions
  const spellingInstructions = intendedTexts.map(text => {
    const spelled = text.split('').map(c => c === ' ' ? '(space)' : c).join('-');
    return `Text "${text}" must be spelled EXACTLY letter-by-letter: ${spelled}. Double-check every character.`;
  }).join('\n');

  const enhancedPrompt = `${prompt}\n\nCRITICAL TEXT RENDERING INSTRUCTIONS:\n${spellingInstructions}\nAll text in this image MUST be perfectly spelled with no missing, swapped, or extra letters. Verify spelling before finalizing.`;

  console.log(`[SpellingGuard] Enhanced prompt with ${intendedTexts.length} text piece(s):`, intendedTexts.join(', '));

  return { enhancedPrompt, intendedTexts };
}


// ── Layer 2: Post-Generation OCR Validation ───────────────────────────────

/**
 * Uses GPT-4o Vision to OCR-read all text in a generated image and compare
 * it against the intended text strings.
 * 
 * @param {string} imageUrl - URL or data URI of the generated image
 * @param {string[]} intendedTexts - Array of text strings that should appear correctly
 * @param {string} openaiApiKey - OpenAI API key
 * @returns {{ valid: boolean, ocrTexts: string[], errors: string[] }}
 */
async function validateImageText(imageUrl, intendedTexts, openaiApiKey) {
  if (!intendedTexts || intendedTexts.length === 0) {
    return { valid: true, ocrTexts: [], errors: [] };
  }

  if (!openaiApiKey) {
    console.log('[SpellingGuard] No OpenAI key — skipping OCR validation');
    return { valid: true, ocrTexts: [], errors: [] };
  }

  try {
    console.log(`[SpellingGuard] Validating ${intendedTexts.length} text piece(s) in generated image...`);

    const imageContent = imageUrl.startsWith('data:')
      ? { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
      : { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a precise OCR validator. Read ALL text visible in the image and compare it against the intended text. Report any spelling errors, missing characters, swapped letters, or extra characters.

Respond in this EXACT JSON format:
{
  "ocr_texts": ["exact text as seen in image", ...],
  "checks": [
    { "intended": "intended text", "found": "what was actually found", "match": true/false, "error": "description of error or null" }
  ],
  "all_correct": true/false
}

Be extremely precise — even a single wrong letter means match=false.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Read ALL text in this image and verify it matches these intended texts:\n${intendedTexts.map((t, i) => `${i + 1}. "${t}"`).join('\n')}\n\nRespond with JSON only.` },
              imageContent
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      console.log(`[SpellingGuard] OCR validation API failed: ${res.status}`);
      return { valid: true, ocrTexts: [], errors: [] }; // Fail open
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { valid: true, ocrTexts: [], errors: [] };
    }

    const result = JSON.parse(content);
    const errors = (result.checks || [])
      .filter(c => !c.match)
      .map(c => `Expected "${c.intended}" but found "${c.found}"${c.error ? ` — ${c.error}` : ''}`);

    console.log(`[SpellingGuard] OCR result: ${result.all_correct ? '✅ ALL CORRECT' : `❌ ${errors.length} error(s)`}`);
    if (errors.length > 0) {
      console.log('[SpellingGuard] Errors:', errors.join('; '));
    }

    return {
      valid: result.all_correct === true && errors.length === 0,
      ocrTexts: result.ocr_texts || [],
      errors,
    };
  } catch (err) {
    console.log('[SpellingGuard] OCR validation error:', err.message);
    return { valid: true, ocrTexts: [], errors: [] }; // Fail open
  }
}

/**
 * Builds a stronger retry prompt after OCR validation found spelling errors.
 */
function buildRetryPrompt(originalPrompt, intendedTexts, ocrErrors) {
  const errorDetails = ocrErrors.map(e => `  - ${e}`).join('\n');
  const spellingInstructions = intendedTexts.map(text => {
    const spelled = text.split('').map(c => c === ' ' ? '(space)' : c).join('-');
    return `  "${text}" → letter-by-letter: ${spelled}`;
  }).join('\n');

  return `${originalPrompt}

⚠️ CRITICAL: The previous generation had SPELLING ERRORS:
${errorDetails}

You MUST fix these errors. The correct text spellings are:
${spellingInstructions}

RULES:
- Render EACH letter individually and verify the sequence
- Do NOT skip, swap, duplicate, or add any letters
- The text must be PERFECTLY readable and correctly spelled
- This is attempt #2 — accuracy is mandatory`;
}


// ── Layer 3: Video Text Overlay Pipeline ──────────────────────────────────

/**
 * Uses GPT-4o Vision to extract all text elements from an image,
 * including their content, approximate position, color, and style.
 * Returns structured data for ffmpeg text overlay.
 */
async function extractTextFromImage(imageUrl, openaiApiKey) {
  if (!openaiApiKey) return { hasText: false, textElements: [] };
  
  try {
    console.log('[SpellingGuard:Video] Extracting text from source image...');
    
    const imageContent = imageUrl.startsWith('data:')
      ? { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
      : { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } };
    
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a precise text extraction tool. Extract ALL text visible in this image with position and style information.

Respond in this EXACT JSON format:
{
  "has_text": true/false,
  "image_description": "brief description of the image without text",
  "text_elements": [
    {
      "text": "exact text content",
      "position": "top-left|top-center|top-right|center-left|center|center-right|bottom-left|bottom-center|bottom-right",
      "y_percent": 0-100,
      "x_percent": 0-100,
      "size": "small|medium|large|xlarge",
      "color_hex": "#FFFFFF",
      "bg_color_hex": "#000000 or transparent",
      "font_style": "bold|regular|italic|bold-italic",
      "is_brand_name": true/false,
      "is_title": true/false
    }
  ]
}

Rules:
- Extract EVERY piece of text, even small text
- Be precise about position (y_percent: 0=top, 100=bottom; x_percent: 0=left, 100=right)
- Identify hex colors as accurately as possible
- Mark brand names and titles appropriately`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all text from this image with position and style data. Respond with JSON only.' },
              imageContent
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    
    if (!res.ok) {
      console.log(`[SpellingGuard:Video] Text extraction API failed: ${res.status}`);
      return { hasText: false, textElements: [] };
    }
    
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { hasText: false, textElements: [] };
    
    const result = JSON.parse(content);
    console.log(`[SpellingGuard:Video] Found ${result.text_elements?.length || 0} text elements`);
    
    return {
      hasText: result.has_text || false,
      imageDescription: result.image_description || '',
      textElements: result.text_elements || [],
    };
  } catch (err) {
    console.log('[SpellingGuard:Video] Text extraction error:', err.message);
    return { hasText: false, textElements: [] };
  }
}

/**
 * Creates a "text-free" version of the source image by removing/inpainting text areas.
 * Uses gpt-image-1 to intelligently remove text while preserving the background.
 */
async function removeTextFromImage(imageUrl, textElements, openaiApiKey) {
  if (!openaiApiKey || !textElements || textElements.length === 0) return null;
  
  try {
    console.log('[SpellingGuard:Video] Removing text from source image for clean animation...');
    
    // Fetch original image
    const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!imgResp.ok) return null;
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    
    const OpenAI = (await import('openai')).default;
    const { toFile } = await import('openai/uploads');
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const imgFile = await toFile(imgBuffer, 'source.png', { type: 'image/png' });
    
    const textDescriptions = textElements.map(t => `"${t.text}" at ${t.position}`).join(', ');
    
    const result = await openai.images.edit({
      model: 'gpt-image-1',
      image: imgFile,
      prompt: `Remove ALL text from this image and fill the areas with appropriate background content that matches the surrounding area. The text to remove: ${textDescriptions}. Make the result look natural as if text was never there. Keep everything else exactly the same — colors, shapes, logos (just the icon/symbol parts), and background elements.`,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });
    
    if (result.data?.[0]) {
      if (result.data[0].b64_json) {
        console.log('[SpellingGuard:Video] Text-free image generated (b64)');
        return { base64: result.data[0].b64_json, format: 'png' };
      } else if (result.data[0].url) {
        // Download the URL
        const dlResp = await fetch(result.data[0].url, { signal: AbortSignal.timeout(30000) });
        if (dlResp.ok) {
          const dlBuf = Buffer.from(await dlResp.arrayBuffer());
          console.log('[SpellingGuard:Video] Text-free image generated (url->b64)');
          return { base64: dlBuf.toString('base64'), format: 'png' };
        }
      }
    }
    
    return null;
  } catch (err) {
    console.log('[SpellingGuard:Video] Text removal failed:', err.message);
    return null;
  }
}

/**
 * Generates an ffmpeg drawtext filter string from extracted text elements.
 * This overlay command can be applied to a video to add text back.
 */
function buildFfmpegTextOverlay(textElements, videoWidth, videoHeight) {
  if (!textElements || textElements.length === 0) return null;
  
  const filters = textElements.map((elem, idx) => {
    const text = elem.text.replace(/'/g, "'\\''").replace(/:/g, '\\:').replace(/\\/g, '\\\\');
    const x = Math.round((elem.x_percent / 100) * videoWidth);
    const y = Math.round((elem.y_percent / 100) * videoHeight);
    
    // Map size to font size
    const fontSizeMap = { small: 18, medium: 28, large: 42, xlarge: 56 };
    const fontSize = fontSizeMap[elem.size] || 28;
    
    // Font color
    const fontColor = elem.color_hex || '#FFFFFF';
    
    // Background box if not transparent
    const hasBg = elem.bg_color_hex && elem.bg_color_hex !== 'transparent';
    const boxParams = hasBg ? `:box=1:boxcolor=${elem.bg_color_hex}@0.7:boxborderw=5` : '';
    
    return `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}${boxParams}`;
  });
  
  return filters.join(',');
}

/**
 * Downloads a video, overlays text using ffmpeg, and returns the result buffer.
 * @param {string} videoUrl - URL of the generated video
 * @param {Array} textElements - Text elements to overlay
 * @param {number} width - Video width (default 1080)
 * @param {number} height - Video height (default 1920)
 * @returns {Buffer|null} - Buffer of the processed video or null on failure
 */
async function overlayTextOnVideo(videoUrl, textElements, width = 1080, height = 1920) {
  if (!textElements || textElements.length === 0) return null;
  
  const { execSync } = await import('child_process');
  const { writeFileSync, readFileSync, unlinkSync, existsSync } = await import('fs');
  const path = await import('path');
  
  const tmpDir = '/tmp';
  const inputPath = path.join(tmpDir, `vid_input_${Date.now()}.mp4`);
  const outputPath = path.join(tmpDir, `vid_output_${Date.now()}.mp4`);
  
  try {
    console.log('[SpellingGuard:Video] Downloading video for text overlay...');
    
    // Download the video
    const vidResp = await fetch(videoUrl, { signal: AbortSignal.timeout(60000) });
    if (!vidResp.ok) throw new Error(`Failed to download video: ${vidResp.status}`);
    const vidBuffer = Buffer.from(await vidResp.arrayBuffer());
    writeFileSync(inputPath, vidBuffer);
    console.log(`[SpellingGuard:Video] Downloaded video: ${vidBuffer.length} bytes`);
    
    // Get actual video dimensions
    let actualWidth = width;
    let actualHeight = height;
    try {
      const probeOutput = execSync(`ffprobe -v quiet -print_format json -show_streams ${inputPath}`, { timeout: 10000 }).toString();
      const probeData = JSON.parse(probeOutput);
      const videoStream = probeData.streams?.find(s => s.codec_type === 'video');
      if (videoStream) {
        actualWidth = videoStream.width || width;
        actualHeight = videoStream.height || height;
        console.log(`[SpellingGuard:Video] Video dimensions: ${actualWidth}x${actualHeight}`);
      }
    } catch (probeErr) {
      console.log('[SpellingGuard:Video] ffprobe failed, using defaults:', probeErr.message);
    }
    
    // Build ffmpeg text overlay filter
    const filterStr = buildFfmpegTextOverlay(textElements, actualWidth, actualHeight);
    if (!filterStr) {
      unlinkSync(inputPath);
      return null;
    }
    
    // Apply text overlay with ffmpeg
    console.log('[SpellingGuard:Video] Applying text overlay with ffmpeg...');
    const cmd = `ffmpeg -y -i "${inputPath}" -vf "${filterStr}" -codec:a copy -codec:v libx264 -preset fast -crf 23 "${outputPath}"`;
    execSync(cmd, { timeout: 120000, stdio: 'pipe' });
    
    if (!existsSync(outputPath)) {
      throw new Error('ffmpeg output file not created');
    }
    
    const outputBuffer = readFileSync(outputPath);
    console.log(`[SpellingGuard:Video] Text overlay complete: ${outputBuffer.length} bytes`);
    
    // Cleanup
    unlinkSync(inputPath);
    unlinkSync(outputPath);
    
    return outputBuffer;
  } catch (err) {
    console.log('[SpellingGuard:Video] Text overlay failed:', err.message);
    // Cleanup on error
    try { if (existsSync(inputPath)) unlinkSync(inputPath); } catch (e) { /* ignore */ }
    try { if (existsSync(outputPath)) unlinkSync(outputPath); } catch (e) { /* ignore */ }
    return null;
  }
}


// ── Exports ───────────────────────────────────────────────────────────────

export {
  extractIntendedText,
  enhancePromptWithSpelling,
  validateImageText,
  buildRetryPrompt,
  extractTextFromImage,
  removeTextFromImage,
  overlayTextOnVideo,
  buildFfmpegTextOverlay,
};
