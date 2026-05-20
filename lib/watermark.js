/**
 * Watermark utility for Free Tier image generation.
 * Applies the SoulPrint Engine watermark to generated images
 * for users on the Free plan.
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const WATERMARK_PATH = path.join(process.cwd(), 'public', 'watermark.png');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Cache the watermark buffer
let watermarkBuffer = null;

async function getWatermarkBuffer() {
  if (!watermarkBuffer) {
    try {
      watermarkBuffer = await fs.promises.readFile(WATERMARK_PATH);
    } catch (err) {
      console.error('[Watermark] Failed to load watermark:', err.message);
      return null;
    }
  }
  return watermarkBuffer;
}

/**
 * Apply watermark to an image.
 * 
 * @param {string|Buffer} imageSource - URL, base64 data URI, or Buffer of the image
 * @returns {Promise<{url: string, buffer: Buffer}|null>} - Local URL of the watermarked image, or null on failure
 */
export async function applyWatermark(imageSource) {
  try {
    const wmBuf = await getWatermarkBuffer();
    if (!wmBuf) {
      console.warn('[Watermark] No watermark file available, skipping');
      return null;
    }

    // Ensure uploads directory exists
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

    // Get the image buffer
    let imageBuffer;
    if (Buffer.isBuffer(imageSource)) {
      imageBuffer = imageSource;
    } else if (typeof imageSource === 'string') {
      if (imageSource.startsWith('data:')) {
        // Base64 data URI
        const base64Data = imageSource.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (imageSource.startsWith('http')) {
        // URL — download the image
        const response = await fetch(imageSource, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        // Assume it's a base64 string without the data URI prefix
        imageBuffer = Buffer.from(imageSource, 'base64');
      }
    } else {
      console.warn('[Watermark] Invalid image source type');
      return null;
    }

    // Get image dimensions
    const imageMeta = await sharp(imageBuffer).metadata();
    const { width, height } = imageMeta;
    
    if (!width || !height) {
      console.warn('[Watermark] Could not determine image dimensions');
      return null;
    }

    // Scale watermark to ~12% of image width (minimum 80px, maximum 250px)
    const wmTargetWidth = Math.min(250, Math.max(80, Math.round(width * 0.12)));
    
    // Resize watermark to target size
    const resizedWatermark = await sharp(wmBuf)
      .resize(wmTargetWidth, null, { fit: 'inside' })
      .png()
      .toBuffer();

    // Calculate position: bottom-right with padding
    const padding = Math.round(width * 0.02); // 2% padding from edges
    const wmMeta = await sharp(resizedWatermark).metadata();
    const left = width - (wmMeta.width || wmTargetWidth) - padding;
    const top = height - (wmMeta.height || wmTargetWidth) - padding;

    // Composite watermark onto image
    const watermarkedBuffer = await sharp(imageBuffer)
      .composite([{
        input: resizedWatermark,
        left: Math.max(0, left),
        top: Math.max(0, top),
        blend: 'over',
      }])
      .png()
      .toBuffer();

    // Save to uploads directory
    const filename = `wm_${uuidv4()}.png`;
    const outputPath = path.join(UPLOADS_DIR, filename);
    await fs.promises.writeFile(outputPath, watermarkedBuffer);

    const localUrl = `/uploads/${filename}`;
    console.log(`[Watermark] Applied watermark to image (${width}x${height}), saved as ${filename}`);

    return { url: localUrl, buffer: watermarkedBuffer };
  } catch (err) {
    console.error('[Watermark] Failed to apply watermark:', err.message);
    return null;
  }
}

/**
 * Check if a user should get watermarked images.
 * Returns true only for Free Tier users.
 */
export function shouldWatermark(enforcementStatus) {
  if (!enforcementStatus) return false;
  // No watermark for: admins, team members, paid subscribers, users in active grace period
  if (enforcementStatus.cohort === 'admin') return false;
  if (enforcementStatus.cohort === 'team') return false;
  if (enforcementStatus.cohort === 'subscribed') return false;
  // Grace period users and OG/Early users with active grace — no watermark
  if (!enforcementStatus.enforcement_active) return false;
  // Only watermark if on the free plan with enforcement active
  if (enforcementStatus.effective_plan === 'free' && enforcementStatus.enforcement_active) return true;
  // Check the features flag directly
  if (enforcementStatus.effective_features?.image_watermark === true) return true;
  return false;
}
