/**
 * Document parsing and conversion handlers
 * Extracted from the main catch-all route.js for maintainability.
 */

import { NextResponse } from 'next/server';
import { authenticate, ok, err } from '@/lib/api-utils';

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
        mimeType === 'application/msword' ||
        fileName?.toLowerCase().endsWith('.docx') ||
        fileName?.toLowerCase().endsWith('.doc')) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return {
          success: true,
          text: result.value?.slice(0, 128000) || '',
          metadata: { format: fileName?.toLowerCase().endsWith('.doc') ? 'doc' : 'docx' }
        };
      } catch (docErr) {
        console.error('DOCX/DOC parse error:', docErr);
        return { success: false, error: `Failed to parse Word document: ${docErr.message}` };
      }
    }
    
    // Excel parsing (.xlsx, .xls)
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel' ||
        fileName?.toLowerCase().endsWith('.xlsx') ||
        fileName?.toLowerCase().endsWith('.xls')) {
      try {
        const XLSX = require('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        let fullText = '';
        const sheetNames = workbook.SheetNames;
        
        for (const sheetName of sheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          
          fullText += `\n--- Sheet: ${sheetName} ---\n`;
          
          // Convert to CSV for readable text representation
          const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
          fullText += csv + '\n';
        }
        
        return {
          success: true,
          text: fullText.trim().slice(0, 50000),
          metadata: {
            sheets: sheetNames,
            sheetCount: sheetNames.length,
          }
        };
      } catch (xlsErr) {
        console.error('Excel parsing error:', xlsErr);
        return { success: false, error: `Failed to parse Excel file: ${xlsErr.message}` };
      }
    }
    
    // Plain text files
    if (mimeType?.startsWith('text/') || 
        ['.txt', '.md', '.csv', '.json', '.js', '.py', '.html', '.css'].some(ext => fileName?.toLowerCase().endsWith(ext))) {
      return {
        success: true,
        text: buffer.toString('utf-8').slice(0, 128000),
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


export {
  parseDocumentContent,
  handleConvertToPdf,
  handleParseDocument,
  handleImageToJson,
};
