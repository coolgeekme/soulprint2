import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const WATERMARK_PATH = path.join(process.cwd(), 'public', 'watermark.png');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const OUTPUT_PATH = path.join(UPLOADS_DIR, 'watermark_example.png');

async function generateExample() {
  // Create a sample 1024x1024 gradient image (simulating a generated image)
  const width = 1024;
  const height = 1024;
  
  // Create a pleasant gradient background
  const sampleImage = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 55, b: 100 },
    }
  })
  .composite([
    {
      // Add a gradient overlay effect
      input: {
        create: {
          width,
          height: Math.round(height / 2),
          channels: 4,
          background: { r: 200, g: 130, b: 60, alpha: 80 },
        }
      },
      gravity: 'south',
      blend: 'over',
    }
  ])
  .png()
  .toBuffer();

  // Read watermark
  const watermarkBuf = await fs.promises.readFile(WATERMARK_PATH);
  
  // Scale watermark to ~12% of image width
  const wmTargetWidth = Math.round(width * 0.12);
  const resizedWatermark = await sharp(watermarkBuf)
    .resize(wmTargetWidth, null, { fit: 'inside' })
    .png()
    .toBuffer();

  const wmMeta = await sharp(resizedWatermark).metadata();
  const padding = Math.round(width * 0.02);
  const left = width - (wmMeta.width || wmTargetWidth) - padding;
  const top = height - (wmMeta.height || wmTargetWidth) - padding;

  // Composite watermark onto sample image
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  
  await sharp(sampleImage)
    .composite([{
      input: resizedWatermark,
      left: Math.max(0, left),
      top: Math.max(0, top),
      blend: 'over',
    }])
    .png()
    .toFile(OUTPUT_PATH);

  console.log('Example watermarked image saved:', OUTPUT_PATH);
  console.log('View at: /uploads/watermark_example.png');
}

generateExample().catch(console.error);
