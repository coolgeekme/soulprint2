import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const INPUT = path.join(process.cwd(), 'public', 'watermark_raw.png');
const OUTPUT = path.join(process.cwd(), 'public', 'watermark.png');

async function processWatermark() {
  const meta = await sharp(INPUT).metadata();
  console.log('Input:', meta.width, 'x', meta.height, 'channels:', meta.channels, 'format:', meta.format);
  
  // The input is 1024x1024 with 3 channels (no alpha). 
  // The logo is an orange swirl on a white/light background.
  // We need to:
  // 1. Make the light/white background transparent
  // 2. Keep only the orange swirl
  // 3. Resize to 200px for watermark
  // 4. Apply semi-transparency

  // Extract raw pixels
  const { data, info } = await sharp(INPUT)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create alpha channel: make light pixels transparent
  const pixels = new Uint8Array(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    
    // Calculate "whiteness" — higher = more white/light
    const brightness = (r + g + b) / 3;
    
    // If pixel is very bright (white/light background), make it transparent
    // If pixel is colorful (the orange logo), keep it
    // Use a graduated transparency based on brightness
    let alpha;
    if (brightness > 240) {
      alpha = 0; // Fully transparent (white areas)
    } else if (brightness > 200) {
      // Gradual transition
      alpha = Math.round(((240 - brightness) / 40) * 255);
    } else {
      alpha = 255; // Fully opaque (logo)
    }
    
    // Apply 40% maximum opacity for watermark subtlety
    alpha = Math.round(alpha * 0.45);
    
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = alpha;
  }
  
  // Create the transparent watermark
  await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .resize(200, null, { fit: 'inside' })
    .png()
    .toFile(OUTPUT);
    
  const outMeta = await sharp(OUTPUT).metadata();
  console.log('Output:', outMeta.width, 'x', outMeta.height, 'channels:', outMeta.channels);
  console.log('Saved:', OUTPUT);
  
  // Also generate example
  const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  
  // Create a sample dark image to show the watermark on
  const sampleDark = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 30, g: 30, b: 40 } }
  })
    .composite([{
      input: {
        create: { width: 1024, height: 400, channels: 4, background: { r: 100, g: 60, b: 180, alpha: 120 } }
      },
      gravity: 'south', blend: 'over'
    }])
    .png().toBuffer();
  
  const watermarkBuf = await fs.promises.readFile(OUTPUT);
  const wmTargetWidth = Math.round(1024 * 0.12);
  const resizedWm = await sharp(watermarkBuf).resize(wmTargetWidth, null, { fit: 'inside' }).png().toBuffer();
  const wmMeta = await sharp(resizedWm).metadata();
  const padding = Math.round(1024 * 0.02);
  
  // Example on dark background
  await sharp(sampleDark)
    .composite([{
      input: resizedWm,
      left: 1024 - (wmMeta.width || wmTargetWidth) - padding,
      top: 1024 - (wmMeta.height || wmTargetWidth) - padding,
      blend: 'over',
    }])
    .png()
    .toFile(path.join(UPLOADS_DIR, 'watermark_example.png'));
  
  // Example on a light/colorful background
  const sampleLight = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 220, g: 200, b: 170 } }
  })
    .composite([{
      input: {
        create: { width: 1024, height: 500, channels: 4, background: { r: 60, g: 140, b: 200, alpha: 150 } }
      },
      gravity: 'north', blend: 'over'
    }])
    .png().toBuffer();
  
  await sharp(sampleLight)
    .composite([{
      input: resizedWm,
      left: 1024 - (wmMeta.width || wmTargetWidth) - padding,
      top: 1024 - (wmMeta.height || wmTargetWidth) - padding,
      blend: 'over',
    }])
    .png()
    .toFile(path.join(UPLOADS_DIR, 'watermark_example_light.png'));

  console.log('Examples saved to /uploads/watermark_example.png and /uploads/watermark_example_light.png');
}

processWatermark().catch(console.error);
