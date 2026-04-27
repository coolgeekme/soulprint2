import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

/**
 * GET /api/pdf/serve?file=/tmp/report_1234.pdf
 * 
 * Serves locally-generated PDF files from /tmp/ as a fallback
 * when external storage (KIE) is unavailable.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('file');

    if (!filePath) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
    }

    // Security: only allow serving from /tmp/
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith('/tmp/')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check file exists
    try {
      await stat(resolved);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const buffer = await readFile(resolved);
    const fileName = path.basename(resolved);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[PDF Serve] Error:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
