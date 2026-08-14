import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/infographic/serve?file=/tmp/infographic_1234.png
 * 
 * Serves locally-generated infographic images from /tmp/ as a fallback
 * when external storage (KIE) is unavailable or the uploaded URL has expired.
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
      return NextResponse.json({ error: 'File not found or expired' }, { status: 404 });
    }

    const buffer = await readFile(resolved);
    const fileName = path.basename(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400', // 24h cache
      },
    });
  } catch (error) {
    console.error('[Infographic Serve] Error:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
