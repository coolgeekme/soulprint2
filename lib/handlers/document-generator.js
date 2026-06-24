/**
 * DOCUMENT GENERATION HANDLER
 * Creates Word, Excel, and PowerPoint documents
 */

import { NextResponse } from 'next/server';

/**
 * POST /api/documents/generate
 * Generate Word/Excel/PowerPoint documents
 */
export async function handleDocumentGeneration(request) {
  try {
    const { format, content, fileName, styling } = await request.json();
    
    if (!format || !content) {
      return NextResponse.json({ error: 'Missing required fields: format, content' }, { status: 400 });
    }

    const supportedFormats = ['docx', 'xlsx', 'pptx', 'txt', 'md'];
    if (!supportedFormats.includes(format.toLowerCase())) {
      return NextResponse.json({ 
        error: `Unsupported format: ${format}. Supported: ${supportedFormats.join(', ')}` 
      }, { status: 400 });
    }

    let fileBuffer;
    let mimeType;

    switch (format.toLowerCase()) {
      case 'docx':
        ({ fileBuffer, mimeType } = await generateWordDocument(content, styling));
        break;
      case 'xlsx':
        ({ fileBuffer, mimeType } = await generateExcelSpreadsheet(content, styling));
        break;
      case 'pptx':
        ({ fileBuffer, mimeType } = await generatePowerPointPresentation(content, styling));
        break;
      case 'txt':
        fileBuffer = Buffer.from(content, 'utf-8');
        mimeType = 'text/plain';
        break;
      case 'md':
        fileBuffer = Buffer.from(content, 'utf-8');
        mimeType = 'text/markdown';
        break;
      default:
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    const finalFileName = fileName || `document_${Date.now()}.${format}`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${finalFileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('[DocumentGenerator] Error:', error);
    return NextResponse.json({ 
      error: 'Document generation failed', 
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * Generate Word Document (.docx)
 */
async function generateWordDocument(content, styling = {}) {
  const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } = require('docx');
  
  const {
    font = 'Garamond',
    fontSize = 12,
    lineSpacing = 1.5,
    margins = 1, // inches
    indent = 0.5, // inches
    title = ''
  } = styling;

  // Parse content into paragraphs and headings
  const lines = content.split('\n');
  const docParagraphs = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) {
      // Empty line
      docParagraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    // Detect headings
    if (trimmed.startsWith('# ')) {
      // H1
      docParagraphs.push(
        new Paragraph({
          text: trimmed.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 480, after: 240 },
        })
      );
    } else if (trimmed.startsWith('## ')) {
      // H2
      docParagraphs.push(
        new Paragraph({
          text: trimmed.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 180 },
        })
      );
    } else if (trimmed.startsWith('### ')) {
      // H3
      docParagraphs.push(
        new Paragraph({
          text: trimmed.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        })
      );
    } else {
      // Regular paragraph - parse for bold/italic
      const runs = parseTextFormatting(trimmed);
      
      docParagraphs.push(
        new Paragraph({
          children: runs.map(run => 
            new TextRun({
              text: run.text,
              bold: run.bold,
              italics: run.italic,
              font: font,
              size: fontSize * 2, // Half-points
            })
          ),
          indent: {
            firstLine: convertInchesToTwip(indent),
          },
          spacing: {
            line: Math.round(lineSpacing * 240), // 240 = single spacing
            lineRule: 'auto',
          },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(margins),
            right: convertInchesToTwip(margins),
            bottom: convertInchesToTwip(margins),
            left: convertInchesToTwip(margins),
          },
        },
      },
      children: docParagraphs,
    }],
  });

  const { Packer } = require('docx');
  const fileBuffer = await Packer.toBuffer(doc);
  const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  
  return { fileBuffer, mimeType };
}

/**
 * Parse text for bold (*text*) and italic (_text_)
 */
function parseTextFormatting(text) {
  const runs = [];
  let current = '';
  let bold = false;
  let italic = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '*' && text[i + 1] === '*') {
      // Bold toggle
      if (current) {
        runs.push({ text: current, bold, italic });
        current = '';
      }
      bold = !bold;
      i++; // Skip next *
    } else if (char === '*') {
      // Italic toggle
      if (current) {
        runs.push({ text: current, bold, italic });
        current = '';
      }
      italic = !italic;
    } else {
      current += char;
    }
  }
  
  if (current) {
    runs.push({ text: current, bold, italic });
  }
  
  return runs.length > 0 ? runs : [{ text: text, bold: false, italic: false }];
}

/**
 * Generate Excel Spreadsheet (.xlsx)
 */
async function generateExcelSpreadsheet(content, styling = {}) {
  const XLSX = require('xlsx');
  
  // Parse content - expect JSON array or CSV-like string
  let data;
  try {
    data = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (e) {
    // If not JSON, treat as CSV
    const rows = content.split('\n').map(row => row.split(/[,\t]/));
    data = rows;
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, styling.sheetName || 'Sheet1');

  const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return { fileBuffer, mimeType };
}

/**
 * Generate PowerPoint Presentation (.pptx)
 */
async function generatePowerPointPresentation(content, styling = {}) {
  const pptxgen = require('pptxgenjs');
  const pres = new pptxgen();
  
  const {
    title = 'Presentation',
    theme = 'light'
  } = styling;

  // Parse content into slides
  const slides = content.split('\n---\n');
  
  for (const slideContent of slides) {
    const lines = slideContent.trim().split('\n');
    if (lines.length === 0) continue;
    
    const slide = pres.addSlide();
    
    // First line is title
    const slideTitle = lines[0].replace(/^#+ /, '');
    slide.addText(slideTitle, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 1,
      fontSize: 32,
      bold: true,
      color: theme === 'dark' ? 'FFFFFF' : '000000',
    });
    
    // Rest is content (bullet points or paragraphs)
    const bulletPoints = lines.slice(1)
      .filter(l => l.trim())
      .map(l => ({ text: l.replace(/^[*-] /, ''), options: { bullet: true } }));
    
    if (bulletPoints.length > 0) {
      slide.addText(bulletPoints, {
        x: 0.5,
        y: 2,
        w: 9,
        h: 4,
        fontSize: 18,
        color: theme === 'dark' ? 'FFFFFF' : '000000',
      });
    }
  }

  const fileBuffer = await pres.write({ outputType: 'nodebuffer' });
  const mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  return { fileBuffer, mimeType };
}

export { generateWordDocument, generateExcelSpreadsheet, generatePowerPointPresentation };
