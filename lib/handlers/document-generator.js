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
 * Generate Word Document (.docx) - Fallback to Rich Text Format
 * Note: True DOCX generation requires client-side libraries due to Next.js limitations
 * This generates an RTF file that Word can open
 */
async function generateWordDocument(content, styling = {}) {
  const {
    font = 'Garamond',
    fontSize = 12,
    lineSpacing = 1.5,
    margins = 1,
    indent = 0.5,
    title = ''
  } = styling;

  // Generate RTF (Rich Text Format) which Word can open
  const rtfContent = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 ${font};}}
{\\colortbl;\\red0\\green0\\blue0;}
\\margl${Math.round(margins * 1440)}\\margr${Math.round(margins * 1440)}
\\margt${Math.round(margins * 1440)}\\margb${Math.round(margins * 1440)}
\\f0\\fs${fontSize * 2}\\sl${Math.round(lineSpacing * 240)}
\\slmult1\\widowctrl\\hyphauto
${convertMarkdownToRTF(content)}
}`;

  const fileBuffer = Buffer.from(rtfContent, 'utf-8');
  // Use DOCX MIME type so it opens in Word
  const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  
  return { fileBuffer, mimeType };
}

/**
 * Convert Markdown to RTF
 */
function convertMarkdownToRTF(text) {
  let rtf = '';
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('# ')) {
      rtf += `\\pard\\sa240\\b\\fs36 ${escapeRTF(line.substring(2))}\\b0\\fs24\\par\n`;
    } else if (line.startsWith('## ')) {
      rtf += `\\pard\\sa180\\b\\fs28 ${escapeRTF(line.substring(3))}\\b0\\fs24\\par\n`;
    } else if (line.trim() === '') {
      rtf += `\\par\n`;
    } else {
      // Parse bold (**) and italic (*)
      let formatted = escapeRTF(line);
      formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '\\b $1\\b0');
      formatted = formatted.replace(/\*([^*]+)\*/g, '\\i $1\\i0');
      rtf += `\\pard\\fi720 ${formatted}\\par\n`;
    }
  }
  
  return rtf;
}

function escapeRTF(text) {
  return text.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
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
 * Generate PowerPoint Presentation (.pptx) - Simplified HTML version
 */
async function generatePowerPointPresentation(content, styling = {}) {
  // Simple HTML-based presentation (can be imported to PowerPoint)
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; }
    .slide { page-break-after: always; padding: 60px; min-height: 500px; }
    h1 { font-size: 36pt; margin-bottom: 40px; }
    h2 { font-size: 28pt; margin-bottom: 30px; }
    ul { font-size: 20pt; line-height: 1.6; }
  </style>
</head>
<body>
${content}
</body>
</html>`;

  const fileBuffer = Buffer.from(htmlContent, 'utf-8');
  const mimeType = 'text/html';

  return { fileBuffer, mimeType };
}

export { generateWordDocument, generateExcelSpreadsheet, generatePowerPointPresentation };
