import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/attachments/upload
 * Pre-uploads a single image attachment to persistent storage.
 * Returns a URL that can be referenced in chat messages instead of inline base64.
 * This prevents large payloads when multiple images are attached.
 */
export async function handleAttachmentUpload(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { base64, mimeType, name } = body;

    if (!base64) {
      return NextResponse.json({ error: 'base64 image data is required' }, { status: 400 });
    }

    // Clean base64 if it has data URL prefix
    let cleanBase64 = base64;
    if (cleanBase64.startsWith('data:')) {
      const parts = cleanBase64.split(',');
      cleanBase64 = parts[1] || cleanBase64;
    }

    const fileName = name || `attachment_${Date.now()}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;

    // Try Kie.ai persistent upload first
    const kieKey = process.env.KIE_API_KEY;
    if (kieKey) {
      try {
        const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${cleanBase64}`;
        const upRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kieKey}` },
          body: JSON.stringify({
            base64Data: dataUrl,
            uploadPath: 'soulprint/attachments',
            fileName: `att_${uuidv4().slice(0, 8)}_${fileName}`,
          }),
        });

        if (upRes.ok) {
          const data = await upRes.json();
          if (data.success && data.data?.downloadUrl) {
            console.log(`[AttachmentUpload] Persisted ${fileName} (${Math.round(cleanBase64.length / 1024)}KB) → ${data.data.downloadUrl}`);
            return NextResponse.json({
              success: true,
              url: data.data.downloadUrl,
              name: fileName,
              size: cleanBase64.length,
            });
          }
        }
        console.warn('[AttachmentUpload] Kie.ai upload failed, falling back to DB storage');
      } catch (err) {
        console.warn('[AttachmentUpload] Kie.ai upload error:', err.message);
      }
    }

    // Fallback: Store in MongoDB as a temporary attachment document
    try {
      const db = await getDb();
      const attachmentId = uuidv4();
      
      // Ensure TTL index exists (idempotent - only creates once)
      try {
        await db.collection('temp_attachments').createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0, background: true }
        );
      } catch (indexErr) { /* ignore if index already exists */ }
      
      // Store with a TTL (auto-delete after 24 hours)
      await db.collection('temp_attachments').insertOne({
        id: attachmentId,
        userId: user.id,
        base64: cleanBase64,
        mimeType: mimeType || 'image/jpeg',
        name: fileName,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
      });

      // Create a URL that the backend can resolve
      const attachmentUrl = `attachment://${attachmentId}`;
      console.log(`[AttachmentUpload] Stored ${fileName} in DB as ${attachmentId} (${Math.round(cleanBase64.length / 1024)}KB)`);

      return NextResponse.json({
        success: true,
        url: attachmentUrl,
        name: fileName,
        size: cleanBase64.length,
        storage: 'db',
      });
    } catch (dbErr) {
      console.error('[AttachmentUpload] DB fallback failed:', dbErr.message);
    }

    // Last resort: return a data URL (won't reduce payload for chat, but at least the upload endpoint works)
    return NextResponse.json({
      success: false,
      error: 'All upload methods failed. Attachment will be sent inline.',
    }, { status: 500 });

  } catch (error) {
    console.error('[AttachmentUpload] Error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

/**
 * Resolves an attachment URL to actual image data.
 * Handles:
 *  - Regular HTTP(S) URLs → fetched directly
 *  - attachment:// protocol → resolved from MongoDB temp_attachments
 *  - data: URLs → used as-is
 */
export async function resolveAttachmentUrl(url) {
  if (!url) return null;

  // Regular HTTP URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { type: 'url', url };
  }

  // MongoDB temp attachment
  if (url.startsWith('attachment://')) {
    const attachmentId = url.replace('attachment://', '');
    try {
      const db = await getDb();
      const doc = await db.collection('temp_attachments').findOne({ id: attachmentId });
      if (doc) {
        return {
          type: 'base64',
          base64: doc.base64,
          mimeType: doc.mimeType,
          dataUrl: `data:${doc.mimeType};base64,${doc.base64}`,
        };
      }
    } catch (err) {
      console.warn('[resolveAttachmentUrl] DB lookup failed:', err.message);
    }
    return null;
  }

  // Data URL
  if (url.startsWith('data:')) {
    return { type: 'dataUrl', url };
  }

  return null;
}
