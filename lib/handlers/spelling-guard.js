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


// ── Exports ───────────────────────────────────────────────────────────────

export {
  extractIntendedText,
  enhancePromptWithSpelling,
  validateImageText,
  buildRetryPrompt,
};
