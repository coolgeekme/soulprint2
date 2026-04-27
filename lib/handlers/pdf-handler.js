/**
 * PDF Chat Handler
 * 
 * Integrates PDF generation into the chat stream.
 * Pipeline: User prompt → AI structures content as JSON → HTML/CSS render → PDF → Upload → Download link
 */

import { generatePDF } from '@/lib/pdf-generator';
import OpenAI from 'openai';

const PDF_SYSTEM_PROMPT = `You are a professional document designer. Your job is to structure user requests into JSON data for PDF generation.

You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences.

Available templates:
1. "report" — Multi-page document with sections, headings, tables. Use for research, analysis, proposals.
2. "summary" — One-page executive summary with key metrics and recommendations.
3. "resume" — Professional CV/resume layout.
4. "invoice" — Financial document (invoice, quote, proposal with line items).

Choose the BEST template based on the user's request.

JSON schemas:

REPORT:
{
  "template": "report",
  "title": "string",
  "subtitle": "string (optional)",
  "author": "string (optional)",
  "date": "string (e.g. 'April 27, 2026')",
  "executive_summary": "string (optional, 2-3 sentences)",
  "accentColor": "#hex",
  "sections": [
    {
      "title": "Section Title",
      "content": "Paragraph text. Use \\n for line breaks.",
      "bullets": ["bullet 1", "bullet 2"],
      "table": { "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]] },
      "subsections": [{ "title": "Sub", "content": "text", "bullets": [] }]
    }
  ]
}

SUMMARY:
{
  "template": "summary",
  "title": "string",
  "subtitle": "string (optional)",
  "date": "string",
  "overview": "string (2-3 sentences)",
  "accentColor": "#hex",
  "metrics": [{ "value": "string", "label": "string" }],
  "key_points": [{ "title": "string", "detail": "string" }],
  "recommendations": ["string"],
  "conclusion": "string"
}

RESUME:
{
  "template": "resume",
  "name": "Full Name",
  "title": "Job Title / Headline",
  "accentColor": "#hex",
  "contact": { "email": "", "phone": "", "location": "", "linkedin": "" },
  "summary": "Professional summary paragraph",
  "experience": [{ "role": "Job Title", "company": "Company", "dates": "2020-2024", "bullets": ["Achievement 1"] }],
  "education": [{ "degree": "BS Computer Science", "school": "MIT", "dates": "2016-2020", "details": "GPA: 3.9" }],
  "skills": ["Skill 1", "Skill 2"],
  "certifications": ["Cert 1"]
}

INVOICE:
{
  "template": "invoice",
  "type": "Invoice or Proposal or Quote",
  "number": "INV-001",
  "date": "string",
  "due_date": "string (optional)",
  "accentColor": "#hex",
  "from": { "name": "", "address": "", "email": "", "phone": "" },
  "to": { "name": "", "address": "", "email": "", "phone": "" },
  "items": [{ "description": "Service/Product", "quantity": 1, "rate": "$100", "amount": "$100" }],
  "subtotal": "$X",
  "tax": "$X (optional)",
  "total": "$X",
  "notes": "string (optional)"
}

RULES:
- Choose the best template based on the request
- Use ACCURATE, well-researched content
- For reports: include 3-8 sections with meaningful content
- For resumes: if the user doesn't specify details, create a realistic professional example
- Pick appropriate accent colors (blue for corporate, green for finance, purple for creative, teal for tech)
- Keep content professional and well-structured
- Respond with ONLY the JSON object. Nothing else.`;

/**
 * Detect if a user message is requesting PDF/document generation
 */
export function isPdfRequest(content) {
  const lower = content.toLowerCase();
  
  const pdfKeywords = [
    'create a pdf',
    'generate a pdf',
    'make a pdf',
    'create a document',
    'generate a document',
    'make a document',
    'create a report',
    'generate a report',
    'write a report',
    'create a resume',
    'generate a resume',
    'make a resume',
    'create my resume',
    'create a cv',
    'generate an invoice',
    'create an invoice',
    'make an invoice',
    'create a proposal',
    'generate a proposal',
    'write a proposal',
    'export as pdf',
    'save as pdf',
    'executive summary pdf',
    'create a summary document',
    'write up a document',
  ];
  
  return pdfKeywords.some(kw => lower.includes(kw));
}

/**
 * Detect if user wants to export the current conversation as PDF
 */
export function isConversationExportRequest(content) {
  const lower = content.toLowerCase();
  const exportKeywords = [
    'export this conversation',
    'export this chat',
    'save this conversation',
    'download this chat',
    'export our conversation',
    'conversation as pdf',
    'chat as pdf',
    'export as pdf',
    'save as pdf',
    'download as pdf',
  ];
  return exportKeywords.some(kw => lower.includes(kw));
}

/**
 * Generate a PDF from a user's chat message.
 * Returns { url, template, title, fileName } on success, null on failure.
 */
export async function handlePdfChat(userPrompt, send) {
  try {
    send({ type: 'delta', content: '📄 Creating PDF document...\n\n' });
    send({ type: 'generating_visual', visualType: 'pdf' });
    
    // Step 1: Use AI to structure the content
    send({ type: 'delta', content: '🧠 Structuring content...\n' });
    
    const openai = new OpenAI({ apiKey: process.env.LLM_KEY || process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PDF_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const jsonStr = completion.choices[0]?.message?.content?.trim();
    if (!jsonStr) throw new Error('AI returned empty response');

    let data;
    try {
      const cleaned = jsonStr.replace(/^```(?:json)?\n?/g, '').replace(/\n?```$/g, '').trim();
      data = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    const template = data.template || 'report';
    send({ type: 'delta', content: `📐 Rendering ${template} PDF...\n` });

    // Step 2: Generate the PDF
    const pdfBuffer = await generatePDF(data, template);
    
    if (!pdfBuffer || pdfBuffer.length < 500) {
      throw new Error('Generated PDF too small or empty');
    }

    send({ type: 'delta', content: '☁️ Uploading document...\n' });

    // Step 3: Upload to persistent storage
    const kieKey = process.env.KIE_API_KEY;
    let pdfUrl = null;
    const fileName = `${template}_${Date.now()}.pdf`;

    if (kieKey) {
      const base64Data = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      
      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
        body: JSON.stringify({
          base64Data,
          uploadPath: 'soulprint/documents',
          fileName,
        }),
      });

      if (upRes.ok) {
        const d = await upRes.json();
        if (d.success && d.data?.downloadUrl) {
          pdfUrl = d.data.downloadUrl;
        }
      }
    }

    if (!pdfUrl) {
      // Fallback: serve via local temp file
      const fs = await import('fs/promises');
      const localPath = `/tmp/${fileName}`;
      await fs.writeFile(localPath, pdfBuffer);
      pdfUrl = `/api/pdf/serve?file=${encodeURIComponent(localPath)}`;
    }

    const title = data.title || data.name || 'Document';
    console.log(`[PDF] ✅ Generated ${template}: "${title}" (${Math.round(pdfBuffer.length / 1024)}KB) → ${pdfUrl}`);

    return {
      url: pdfUrl,
      template,
      title,
      fileName,
      size: pdfBuffer.length,
    };

  } catch (error) {
    console.error('[PDF] Generation failed:', error);
    send({ type: 'delta', content: `\n⚠️ PDF generation failed: ${error.message}\n` });
    return null;
  }
}

/**
 * Export a conversation as PDF
 */
export async function handleConversationExport(messages, conversationTitle, send) {
  try {
    send({ type: 'delta', content: '📄 Exporting conversation as PDF...\n' });

    const data = {
      title: conversationTitle || 'Conversation Export',
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content?.substring(0, 5000) || '', // Truncate very long messages
        time: m.created_at ? new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
      })),
      accentColor: '#6366f1',
    };

    const pdfBuffer = await generatePDF(data, 'conversation');
    
    // Upload
    const kieKey = process.env.KIE_API_KEY;
    let pdfUrl = null;
    const fileName = `conversation_export_${Date.now()}.pdf`;

    if (kieKey) {
      const base64Data = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
        body: JSON.stringify({ base64Data, uploadPath: 'soulprint/documents', fileName }),
      });
      if (upRes.ok) {
        const d = await upRes.json();
        if (d.success && d.data?.downloadUrl) pdfUrl = d.data.downloadUrl;
      }
    }

    if (!pdfUrl) {
      const fs = await import('fs/promises');
      await fs.writeFile(`/tmp/${fileName}`, pdfBuffer);
      pdfUrl = `/api/pdf/serve?file=${encodeURIComponent(`/tmp/${fileName}`)}`;
    }

    console.log(`[PDF] ✅ Conversation exported: ${messages.length} messages → ${pdfUrl}`);
    return { url: pdfUrl, title: data.title, fileName };
  } catch (error) {
    console.error('[PDF] Conversation export failed:', error);
    send({ type: 'delta', content: `\n⚠️ Export failed: ${error.message}\n` });
    return null;
  }
}
