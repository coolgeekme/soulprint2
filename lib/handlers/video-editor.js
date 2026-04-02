/**
 * Video Editor Handlers
 * Provides video upload, AI review, trim, and text overlay capabilities.
 * Uses ffmpeg for all video processing operations.
 */

import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { writeFile, mkdir, unlink, readFile, stat } from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const VIDEO_DIR = '/tmp/video-editor';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_DURATION = 120; // 2 minutes
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg'];

// Ensure video directory exists
async function ensureVideoDir() {
  await mkdir(VIDEO_DIR, { recursive: true });
}

// Get video metadata using ffprobe
async function getVideoMetadata(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ], { timeout: 15000 });

    const data = JSON.parse(stdout);
    const videoStream = data.streams?.find(s => s.codec_type === 'video');
    const audioStream = data.streams?.find(s => s.codec_type === 'audio');

    return {
      duration: parseFloat(data.format?.duration || 0),
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      codec: videoStream?.codec_name || 'unknown',
      fps: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : 30,
      bitrate: parseInt(data.format?.bit_rate || 0),
      size: parseInt(data.format?.size || 0),
      hasAudio: !!audioStream,
    };
  } catch (e) {
    console.error('[VideoEditor] ffprobe error:', e.message);
    return null;
  }
}

// Extract key frames from video for AI analysis
async function extractKeyFrames(filePath, duration, count = 6) {
  const frames = [];
  const interval = Math.max(duration / (count + 1), 0.5);

  for (let i = 1; i <= count; i++) {
    const timestamp = Math.min(interval * i, duration - 0.1);
    const framePath = path.join(VIDEO_DIR, `frame_${Date.now()}_${i}.jpg`);

    try {
      await execFileAsync('ffmpeg', [
        '-ss', String(timestamp),
        '-i', filePath,
        '-vframes', '1',
        '-q:v', '3',
        '-s', '512x512',
        '-y',
        framePath,
      ], { timeout: 10000 });

      const frameData = await readFile(framePath);
      frames.push({
        timestamp: Math.round(timestamp * 10) / 10,
        base64: frameData.toString('base64'),
      });
      await unlink(framePath).catch(() => {});
    } catch (e) {
      console.log(`[VideoEditor] Frame extraction at ${timestamp}s failed:`, e.message);
    }
  }

  return frames;
}

// ── Upload Video ─────────────────────────────────────────────────────────────
async function handleVideoUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  await ensureVideoDir();

  try {
    const formData = await request.formData();
    const file = formData.get('video');

    if (!file || !file.name) {
      return err('No video file provided', 400);
    }

    // Validate file type
    const mimeType = file.type || '';
    if (!ALLOWED_TYPES.some(t => mimeType.includes(t.split('/')[1])) && !file.name.match(/\.(mp4|mov|webm|avi|mpeg)$/i)) {
      return err('Unsupported video format. Supported: MP4, MOV, WebM, AVI', 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return err(`Video too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`, 400);
    }

    const videoId = uuidv4();
    const ext = path.extname(file.name) || '.mp4';
    const filePath = path.join(VIDEO_DIR, `${videoId}${ext}`);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Get metadata
    const metadata = await getVideoMetadata(filePath);
    if (!metadata) {
      await unlink(filePath).catch(() => {});
      return err('Could not read video file. It may be corrupt or unsupported.', 400);
    }

    if (metadata.duration > MAX_DURATION) {
      await unlink(filePath).catch(() => {});
      return err(`Video too long (${Math.round(metadata.duration)}s). Maximum duration is ${MAX_DURATION} seconds.`, 400);
    }

    // Generate thumbnail
    const thumbnailPath = path.join(VIDEO_DIR, `${videoId}_thumb.jpg`);
    try {
      await execFileAsync('ffmpeg', [
        '-ss', String(Math.min(1, metadata.duration / 2)),
        '-i', filePath,
        '-vframes', '1',
        '-q:v', '5',
        '-s', '320x240',
        '-y',
        thumbnailPath,
      ], { timeout: 10000 });
    } catch (e) {
      console.log('[VideoEditor] Thumbnail generation failed:', e.message);
    }

    let thumbnailBase64 = null;
    try {
      const thumbData = await readFile(thumbnailPath);
      thumbnailBase64 = thumbData.toString('base64');
      await unlink(thumbnailPath).catch(() => {});
    } catch {}

    // Store video record in DB
    const db = await getDb();
    await db.collection('video_edits').insertOne({
      id: videoId,
      user_id: user.id,
      original_filename: file.name,
      file_path: filePath,
      ext,
      metadata,
      thumbnail: thumbnailBase64,
      edits: [],
      created_at: new Date(),
    });

    return ok({
      videoId,
      filename: file.name,
      metadata: {
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        fps: Math.round(metadata.fps),
        hasAudio: metadata.hasAudio,
      },
      thumbnail: thumbnailBase64 ? `data:image/jpeg;base64,${thumbnailBase64}` : null,
    });
  } catch (e) {
    console.error('[VideoEditor] Upload error:', e);
    return err('Failed to upload video: ' + e.message, 500);
  }
}

// ── AI Video Analysis ────────────────────────────────────────────────────────
async function handleVideoAnalyze(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const { videoId, prompt } = await request.json();
    if (!videoId) return err('videoId required', 400);

    const db = await getDb();
    const video = await db.collection('video_edits').findOne({ id: videoId, user_id: user.id });
    if (!video) return err('Video not found', 404);

    if (!existsSync(video.file_path)) {
      return err('Video file no longer available. Please re-upload.', 404);
    }

    // Extract key frames
    const frames = await extractKeyFrames(video.file_path, video.metadata.duration, 6);
    if (frames.length === 0) {
      return err('Could not extract frames from video', 500);
    }

    // Build vision messages for GPT-4o
    const userContent = [
      {
        type: 'text',
        text: prompt || `Analyze this ${Math.round(video.metadata.duration)}s video (${video.metadata.width}x${video.metadata.height}) for social media/marketing use. Review:
1. Visual quality & composition
2. Content & messaging effectiveness  
3. Pacing & timing
4. Suggestions for improvement (trim points, text overlay ideas, etc.)
5. Overall rating (1-10) for social media readiness

The frames below are sampled at regular intervals from the video:`,
      },
      ...frames.map(f => ({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${f.base64}`,
          detail: 'low',
        },
      })),
    ];

    // Call GPT-4o
    const { getProvider } = await import('@/lib/llm/providers');
    const provider = getProvider('openai', 'gpt-4o');
    const analysis = await provider.generateChatCompletion({
      systemPrompt: 'You are a professional video editor and social media content strategist. Analyze videos and provide actionable feedback. Be specific about timestamps when suggesting edits.',
      messages: [{ role: 'user', content: userContent }],
      model: 'gpt-4o',
      temperature: 0.5,
      max_tokens: 1500,
    });

    // Store analysis
    await db.collection('video_edits').updateOne(
      { id: videoId },
      { $set: { analysis, analyzed_at: new Date() } }
    );

    return ok({
      analysis,
      frameCount: frames.length,
      timestamps: frames.map(f => f.timestamp),
    });
  } catch (e) {
    console.error('[VideoEditor] Analyze error:', e);
    return err('Failed to analyze video: ' + e.message, 500);
  }
}

// ── Trim Video ───────────────────────────────────────────────────────────────
async function handleVideoTrim(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const { videoId, startTime, endTime } = await request.json();
    if (!videoId) return err('videoId required', 400);
    if (startTime === undefined || endTime === undefined) return err('startTime and endTime required', 400);
    if (startTime >= endTime) return err('startTime must be less than endTime', 400);

    const db = await getDb();
    const video = await db.collection('video_edits').findOne({ id: videoId, user_id: user.id });
    if (!video) return err('Video not found', 404);

    if (!existsSync(video.file_path)) {
      return err('Video file no longer available. Please re-upload.', 404);
    }

    const outputId = uuidv4();
    const outputPath = path.join(VIDEO_DIR, `${outputId}_trimmed.mp4`);

    await execFileAsync('ffmpeg', [
      '-ss', String(startTime),
      '-i', video.file_path,
      '-t', String(endTime - startTime),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ], { timeout: 60000 });

    // Get new metadata
    const newMeta = await getVideoMetadata(outputPath);

    // Generate new thumbnail
    let thumbnailBase64 = null;
    const thumbPath = path.join(VIDEO_DIR, `${outputId}_thumb.jpg`);
    try {
      await execFileAsync('ffmpeg', [
        '-ss', '0.5',
        '-i', outputPath,
        '-vframes', '1',
        '-q:v', '5',
        '-s', '320x240',
        '-y',
        thumbPath,
      ], { timeout: 10000 });
      const thumbData = await readFile(thumbPath);
      thumbnailBase64 = thumbData.toString('base64');
      await unlink(thumbPath).catch(() => {});
    } catch {}

    // Store as new version
    const newVideoId = outputId;
    await db.collection('video_edits').insertOne({
      id: newVideoId,
      user_id: user.id,
      original_filename: `trimmed_${video.original_filename}`,
      file_path: outputPath,
      ext: '.mp4',
      metadata: newMeta,
      thumbnail: thumbnailBase64,
      parent_id: videoId,
      edit_type: 'trim',
      edit_params: { startTime, endTime },
      edits: [],
      created_at: new Date(),
    });

    return ok({
      videoId: newVideoId,
      filename: `trimmed_${video.original_filename}`,
      metadata: {
        duration: newMeta?.duration || (endTime - startTime),
        width: newMeta?.width || video.metadata.width,
        height: newMeta?.height || video.metadata.height,
      },
      thumbnail: thumbnailBase64 ? `data:image/jpeg;base64,${thumbnailBase64}` : null,
    });
  } catch (e) {
    console.error('[VideoEditor] Trim error:', e);
    return err('Failed to trim video: ' + e.message, 500);
  }
}

// ── Add Text Overlay ─────────────────────────────────────────────────────────
async function handleVideoTextOverlay(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const { videoId, textOverlays } = await request.json();
    if (!videoId) return err('videoId required', 400);
    if (!textOverlays || !textOverlays.length) return err('textOverlays array required', 400);

    const db = await getDb();
    const video = await db.collection('video_edits').findOne({ id: videoId, user_id: user.id });
    if (!video) return err('Video not found', 404);

    if (!existsSync(video.file_path)) {
      return err('Video file no longer available. Please re-upload.', 404);
    }

    const outputId = uuidv4();
    const outputPath = path.join(VIDEO_DIR, `${outputId}_text.mp4`);

    // Build ffmpeg drawtext filter chain
    const filters = textOverlays.map((overlay, i) => {
      const text = (overlay.text || '').replace(/'/g, "\\'").replace(/:/g, '\\:');
      const fontSize = overlay.fontSize || 32;
      const fontColor = overlay.fontColor || 'white';
      const bgColor = overlay.bgColor || 'black@0.5';
      const x = overlay.x || 'center';
      const y = overlay.y || 'center';
      
      // Convert percentage positions to pixel expressions
      let xExpr = x;
      let yExpr = y;
      if (typeof x === 'number') xExpr = `(w*${x / 100})`;
      if (typeof y === 'number') yExpr = `(h*${y / 100})`;
      if (x === 'center') xExpr = '(w-text_w)/2';
      if (y === 'center') yExpr = '(h-text_h)/2';
      if (y === 'top') yExpr = `${fontSize}`;
      if (y === 'bottom') yExpr = `h-text_h-${fontSize}`;

      // Time range for text display
      let enableExpr = '';
      if (overlay.startTime !== undefined && overlay.endTime !== undefined) {
        enableExpr = `:enable='between(t,${overlay.startTime},${overlay.endTime})'`;
      }

      return `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${xExpr}:y=${yExpr}:box=1:boxcolor=${bgColor}:boxborderw=8${enableExpr}`;
    });

    const filterStr = filters.join(',');

    await execFileAsync('ffmpeg', [
      '-i', video.file_path,
      '-vf', filterStr,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ], { timeout: 60000 });

    const newMeta = await getVideoMetadata(outputPath);

    // Generate thumbnail
    let thumbnailBase64 = null;
    const thumbPath = path.join(VIDEO_DIR, `${outputId}_thumb.jpg`);
    try {
      await execFileAsync('ffmpeg', [
        '-ss', '1',
        '-i', outputPath,
        '-vframes', '1',
        '-q:v', '5',
        '-s', '320x240',
        '-y',
        thumbPath,
      ], { timeout: 10000 });
      const thumbData = await readFile(thumbPath);
      thumbnailBase64 = thumbData.toString('base64');
      await unlink(thumbPath).catch(() => {});
    } catch {}

    const newVideoId = outputId;
    await db.collection('video_edits').insertOne({
      id: newVideoId,
      user_id: user.id,
      original_filename: `text_${video.original_filename}`,
      file_path: outputPath,
      ext: '.mp4',
      metadata: newMeta,
      thumbnail: thumbnailBase64,
      parent_id: videoId,
      edit_type: 'text_overlay',
      edit_params: { textOverlays },
      edits: [],
      created_at: new Date(),
    });

    return ok({
      videoId: newVideoId,
      filename: `text_${video.original_filename}`,
      metadata: {
        duration: newMeta?.duration || video.metadata.duration,
        width: newMeta?.width || video.metadata.width,
        height: newMeta?.height || video.metadata.height,
      },
      thumbnail: thumbnailBase64 ? `data:image/jpeg;base64,${thumbnailBase64}` : null,
    });
  } catch (e) {
    console.error('[VideoEditor] Text overlay error:', e);
    return err('Failed to add text overlay: ' + e.message, 500);
  }
}

// ── Serve Video File ─────────────────────────────────────────────────────────
async function handleVideoServe(request, videoId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  if (!videoId) return err('videoId required', 400);

  const db = await getDb();
  const video = await db.collection('video_edits').findOne({ id: videoId, user_id: user.id });
  if (!video) return err('Video not found', 404);

  if (!existsSync(video.file_path)) {
    return err('Video file no longer available', 404);
  }

  try {
    const fileStat = await stat(video.file_path);
    const fileBuffer = await readFile(video.file_path);

    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Length', String(fileStat.size));
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Disposition', `inline; filename="${video.original_filename || 'video.mp4'}"`);
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(fileBuffer, { status: 200, headers });
  } catch (e) {
    console.error('[VideoEditor] Serve error:', e);
    return err('Failed to serve video', 500);
  }
}

// ── Download Video File ──────────────────────────────────────────────────────
async function handleVideoDownload(request, videoId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  if (!videoId) return err('videoId required', 400);

  const db = await getDb();
  const video = await db.collection('video_edits').findOne({ id: videoId, user_id: user.id });
  if (!video) return err('Video not found', 404);

  if (!existsSync(video.file_path)) {
    return err('Video file no longer available', 404);
  }

  try {
    const fileBuffer = await readFile(video.file_path);
    const fileStat = await stat(video.file_path);

    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Length', String(fileStat.size));
    headers.set('Content-Disposition', `attachment; filename="${video.original_filename || 'video.mp4'}"`);

    return new Response(fileBuffer, { status: 200, headers });
  } catch (e) {
    console.error('[VideoEditor] Download error:', e);
    return err('Failed to download video', 500);
  }
}

export {
  handleVideoUpload,
  handleVideoAnalyze,
  handleVideoTrim,
  handleVideoTextOverlay,
  handleVideoServe,
  handleVideoDownload,
};
