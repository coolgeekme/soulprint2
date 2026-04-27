/**
 * Infographic Chat Handler
 * 
 * Integrates programmatic infographic generation into the chat stream.
 * Pipeline: User prompt → AI structures data as JSON → HTML/CSS render → PNG → Upload → Display
 */

import { generateInfographic } from '@/lib/infographic-generator';
import OpenAI from 'openai';

const INFOGRAPHIC_SYSTEM_PROMPT = `You are a data visualization expert. Your job is to structure user requests into JSON data for infographic generation.

You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences.

Available templates:
1. "comparison" — Side-by-side comparison (2 entities with stats). Use for "X vs Y" requests.
2. "stats" — Single entity with metric cards. Use for breakdowns of one topic.
3. "ranking" — Ordered list with values. Use for "top 10", "best of", ranked lists.
4. "timeline" — Chronological events. Use for history, milestones.

JSON schema for each template:

COMPARISON:
{
  "template": "comparison",
  "title": "string",
  "subtitle": "string (optional)",
  "leftEntity": { "name": "string", "emoji": "single emoji", "description": "short text" },
  "rightEntity": { "name": "string", "emoji": "single emoji", "description": "short text" },
  "stats": [{ "label": "string", "icon": "single emoji", "leftValue": "string/number", "rightValue": "string/number", "leftWins": boolean, "rightWins": boolean }],
  "theme": "dark",
  "accentColor": "#hex color"
}

STATS:
{
  "template": "stats",
  "title": "string",
  "subtitle": "string (optional)",
  "entity": { "name": "string (optional)", "emoji": "single emoji (optional)" },
  "metrics": [{ "icon": "single emoji", "value": "string/number", "label": "string", "sublabel": "string (optional)" }],
  "theme": "dark",
  "accentColor": "#hex color"
}

RANKING:
{
  "template": "ranking",
  "title": "string",
  "subtitle": "string (optional)",
  "items": [{ "name": "string", "description": "string (optional)", "value": "string/number (optional)" }],
  "theme": "dark",
  "accentColor": "#hex color"
}

TIMELINE:
{
  "template": "timeline",
  "title": "string",
  "events": [{ "year": "string", "title": "string", "description": "string (optional)" }],
  "theme": "dark",
  "accentColor": "#hex color"
}

RULES:
- Use VERIFIED, ACCURATE data. Do NOT make up statistics.
- For sports stats, use well-known career totals.
- For comparisons, include 4-8 stat rows.
- For rankings, include 5-10 items.
- Choose the most appropriate template based on the request.
- Pick a thematic accent color (gold for sports, blue for tech, green for nature, etc.)
- Keep labels SHORT (1-3 words max).
- Use format-friendly values: "32,292" not "32292", "$4.2B" not "4200000000".
- Respond with ONLY the JSON object. Nothing else.`;

/**
 * Detect if a user message is requesting a data-driven infographic
 */
export function isInfographicRequest(content) {
  const lower = content.toLowerCase();
  
  // Must explicitly mention infographic/chart/comparison visualization
  const infographicKeywords = [
    'infographic',
    'comparison chart',
    'stats comparison',
    'data visualization',
    'create a chart comparing',
    'make a chart',
    'side by side comparison',
    'head to head',
  ];
  
  const hasKeyword = infographicKeywords.some(kw => lower.includes(kw));
  if (!hasKeyword) return false;
  
  // Must also imply data/stats (not just artistic imagery)
  const dataKeywords = ['stats', 'statistics', 'numbers', 'data', 'compare', 'comparing', 'vs', 'versus', 'ranking', 'top', 'timeline', 'history', 'milestones', 'championships', 'awards'];
  const hasData = dataKeywords.some(kw => lower.includes(kw));
  
  return hasData;
}

/**
 * Generate a programmatic infographic from a user's chat message.
 * Returns { url, template, title } on success, null on failure.
 */
export async function handleInfographicChat(userPrompt, send) {
  try {
    send({ type: 'delta', content: '📊 Creating data-accurate infographic...\n\n' });
    send({ type: 'generating_visual', visualType: 'infographic' });
    
    // Step 1: Use AI to structure the data
    send({ type: 'delta', content: '🧠 Structuring data with AI...\n' });
    
    const openai = new OpenAI({ apiKey: process.env.LLM_KEY || process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: INFOGRAPHIC_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const jsonStr = completion.choices[0]?.message?.content?.trim();
    if (!jsonStr) throw new Error('AI returned empty response');

    // Parse the JSON (handle potential markdown fences)
    let data;
    try {
      const cleaned = jsonStr.replace(/^```(?:json)?\n?/g, '').replace(/\n?```$/g, '').trim();
      data = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Failed to parse AI data: ${e.message}. Raw: ${jsonStr.slice(0, 200)}`);
    }

    const template = data.template || 'comparison';
    send({ type: 'delta', content: `📐 Rendering ${template} infographic...\n` });

    // Step 2: Generate the image programmatically
    const imageBuffer = await generateInfographic(data, template);
    
    if (!imageBuffer || imageBuffer.length < 1000) {
      throw new Error('Generated image too small or empty');
    }

    send({ type: 'delta', content: '☁️ Uploading to storage...\n' });

    // Step 3: Upload to persistent storage
    const kieKey = process.env.KIE_API_KEY;
    let imageUrl = null;

    if (kieKey) {
      const base64Data = `data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}`;
      const fileName = `infographic_${template}_${Date.now()}.png`;
      
      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
        body: JSON.stringify({
          base64Data,
          uploadPath: 'soulprint/infographics',
          fileName,
        }),
      });

      if (upRes.ok) {
        const d = await upRes.json();
        if (d.success && d.data?.downloadUrl) {
          imageUrl = d.data.downloadUrl;
        }
      }
    }

    // Fallback: serve from local API if upload fails
    if (!imageUrl) {
      // Write to /tmp and serve via static path (not ideal but works as fallback)
      const fs = await import('fs/promises');
      const localPath = `/tmp/infographic_${Date.now()}.png`;
      await fs.writeFile(localPath, imageBuffer);
      imageUrl = `/api/infographic/serve?file=${encodeURIComponent(localPath)}`;
    }

    console.log(`[Infographic] ✅ Generated ${template} infographic: ${imageUrl} (${Math.round(imageBuffer.length / 1024)}KB)`);

    return {
      url: imageUrl,
      template,
      title: data.title || 'Infographic',
      data, // Return structured data for potential re-rendering
    };

  } catch (error) {
    console.error('[Infographic] Generation failed:', error);
    send({ type: 'delta', content: `\n⚠️ Programmatic infographic failed: ${error.message}. Falling back to AI image generation...\n` });
    return null; // Caller should fall back to AI image generation
  }
}
