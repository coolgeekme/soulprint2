import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

/**
 * GET /api/blog/image/[fileName]
 * Serves blog images from the upload directory.
 */
export async function GET(request, { params }) {
  try {
    const fileName = params?.fileName;
    if (!fileName) {
      return NextResponse.json({ error: 'Missing file name' }, { status: 400 });
    }

    // Security: sanitize filename (no path traversal)
    const sanitized = path.basename(fileName);
    const filePath = `/tmp/soulprint_uploads/blog/${sanitized}`;

    // Verify it stays in the allowed directory
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith('/tmp/soulprint_uploads/blog/')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check file exists
    try {
      await stat(resolved);
    } catch {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const buffer = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };
    const contentType = contentTypes[ext] || 'image/png';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${sanitized}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=604800', // 7 day cache
      },
    });
  } catch (error) {
    console.error('[Blog Image Serve] Error:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}
