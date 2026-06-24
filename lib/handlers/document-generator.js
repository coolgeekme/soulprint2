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
  // For now, use a simple approach that works across platforms
  // Generate HTML and let browser/system convert to DOCX
  // This is a temporary solution - ideally use docx library
  
  const {
    font = 'Garamond',
    fontSize = 12,
    lineSpacing = 1.5,
    margins = '1in',
    indent = '0.5in'
  } = styling;

  // Create HTML representation that can be saved as DOCX
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: ${margins};
    }
    body {
      font-family: '${font}', Georgia, serif;
      font-size: ${fontSize}pt;
      line-height: ${lineSpacing};
    }
    p {
      text-indent: ${indent};
      margin-bottom: 0;
    }
    h1, h2, h3 {
      text-indent: 0;
      page-break-after: avoid;
    }
    h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-top: 24pt;
      margin-bottom: 12pt;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 9pt;
    }
    .chapter-break {
      page-break-before: always;
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;

  const fileBuffer = Buffer.from(htmlContent, 'utf-8');
  // Use MIME type that triggers Word to open
  const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  
  return { fileBuffer, mimeType };
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
  // Basic PowerPoint generation - HTML-based for now
  // Future: use pptxgenjs library for true PPTX
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
    }
    .slide {
      page-break-after: always;
      padding: 40px;
      min-height: 500px;
    }
    h1 {
      font-size: 32pt;
      text-align: center;
      margin-bottom: 40px;
    }
    h2 {
      font-size: 24pt;
      margin-bottom: 20px;
    }
    ul {
      font-size: 18pt;
      line-height: 1.6;
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;

  const fileBuffer = Buffer.from(htmlContent, 'utf-8');
  const mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  return { fileBuffer, mimeType };
}

export { generateWordDocument, generateExcelSpreadsheet, generatePowerPointPresentation };
