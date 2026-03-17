import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate, requireAdmin } from '@/lib/api-utils';

// ============================================================
// CONSTANTS & HELPERS
// ============================================================

const UPLOADS_DIR = '/tmp/uploads';

async function ensureUploadsDir() {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

function extractTextFromJson(obj, type = 'auto') {
  const results = [];
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item.mapping) {
        // ChatGPT format
        for (const [, node] of Object.entries(item.mapping)) {
          const msg = node?.message;
          if (msg?.content?.parts) {
            results.push(msg.content.parts.join(' '));
          }
        }
      } else if (item.message) {
        results.push(item.message);
      } else if (item.content) {
        results.push(typeof item.content === 'string' ? item.content : JSON.stringify(item.content));
      } else if (item.text) {
        results.push(item.text);
      }
    }
  } else if (obj.mapping) {
    for (const [, node] of Object.entries(obj.mapping)) {
      const msg = node?.message;
      if (msg?.content?.parts) {
        results.push(msg.content.parts.join(' '));
      }
    }
  }
  
  return results.join('\n\n').slice(0, 50000);
}

// ============================================================
// CHUNKED UPLOAD HANDLERS
// ============================================================

async function handleChunkedInit(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { filename, fileSize, totalChunks, type = 'chatgpt' } = body;

  if (!filename || !totalChunks) {
    return err('Missing required fields');
  }

  const db = await getDb();
  const uploadId = uuidv4();

  await db.collection('upload_sessions').insertOne({
    id: uploadId,
    user_id: user.id,
    filename,
    file_size: fileSize,
    total_chunks: totalChunks,
    received_chunks: [],
    type,
    status: 'uploading',
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(`[ChunkedUpload] Initialized upload ${uploadId} for ${filename} (${totalChunks} chunks)`);

  return ok({ uploadId });
}

async function handleChunkedChunk(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const uploadId = formData.get('uploadId');
    const chunkIndex = parseInt(formData.get('chunkIndex'), 10);
    const chunk = formData.get('chunk');

    if (!uploadId || chunkIndex === undefined || !chunk) {
      return err('Missing required fields');
    }

    const db = await getDb();
    const session = await db.collection('upload_sessions').findOne({ id: uploadId, user_id: user.id });

    if (!session) {
      return err('Upload session not found', 404);
    }

    // Store chunk on disk instead of MongoDB
    const fs = require('fs').promises;
    const chunkDir = path.join('/tmp', 'uploads', uploadId);
    await fs.mkdir(chunkDir, { recursive: true });
    
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkPath = path.join(chunkDir, `chunk_${String(chunkIndex).padStart(6, '0')}`);
    await fs.writeFile(chunkPath, chunkBuffer);

    await db.collection('upload_sessions').updateOne(
      { id: uploadId },
      { 
        $addToSet: { received_chunks: chunkIndex },
        $set: { updated_at: new Date() }
      }
    );

    console.log(`[ChunkedUpload] Stored chunk ${chunkIndex + 1}/${session.total_chunks} for ${uploadId}`);

    return ok({ received: chunkIndex });
  } catch (error) {
    console.error('[ChunkedChunk] Error:', error);
    return err(error.message || 'Failed to process chunk', 500);
  }
}

async function handleChunkedComplete(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { uploadId } = body;

  if (!uploadId) return err('uploadId required');

  const db = await getDb();
  const session = await db.collection('upload_sessions').findOne({ id: uploadId, user_id: user.id });

  if (!session) return err('Upload session not found', 404);

  const fs = require('fs').promises;
  const chunkDir = path.join('/tmp', 'uploads', uploadId);

  try {
    // Read and combine all chunks
    const files = await fs.readdir(chunkDir);
    const sortedFiles = files.sort();
    const chunks = [];

    for (const file of sortedFiles) {
      const chunkPath = path.join(chunkDir, file);
      const chunkData = await fs.readFile(chunkPath);
      chunks.push(chunkData);
    }

    const buffer = Buffer.concat(chunks);
    console.log(`[ChunkedUpload] Assembled ${buffer.length} bytes from ${chunks.length} chunks`);

    // Clean up chunk directory
    for (const file of files) {
      await fs.unlink(path.join(chunkDir, file)).catch(() => {});
    }
    await fs.rmdir(chunkDir).catch(() => {});

    // Update session status
    await db.collection('upload_sessions').updateOne(
      { id: uploadId },
      { $set: { status: 'processing', assembled_at: new Date() } }
    );

    // Process the file
    const result = await processUploadedFile(db, user.id, uploadId, session.type, buffer, session.filename);

    return ok({
      success: true,
      uploadId,
      ...result,
    });
  } catch (error) {
    console.error('[ChunkedComplete] Error:', error);
    await db.collection('upload_sessions').updateOne(
      { id: uploadId },
      { $set: { status: 'error', error: error.message } }
    );
    return err(error.message || 'Failed to process upload', 500);
  }
}

// ============================================================
// FILE PROCESSING
// ============================================================

async function processUploadedFile(db, userId, uploadId, type, buffer, filename) {
  let extractedText = '';
  let detectedType = type;
  let conversationCount = 0;
  let messageCount = 0;

  const lowerFilename = filename.toLowerCase();

  if (lowerFilename.endsWith('.zip')) {
    try {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const entryNames = entries.map(e => e.entryName.toLowerCase());

      // Auto-detect format
      if (type === 'auto' || !type) {
        if (entryNames.some(n => n.includes('conversations.json'))) {
          detectedType = 'chatgpt';
        } else if (entryNames.some(n => n.includes('messages/inbox/'))) {
          detectedType = 'facebook';
        } else if (entryNames.some(n => n.includes('claude'))) {
          detectedType = 'claude';
        }
      }

      // Extract text from relevant files
      for (const entry of entries) {
        if (!entry.isDirectory) {
          const name = entry.entryName.toLowerCase();
          if (name.endsWith('.json') || name.endsWith('.txt')) {
            const content = entry.getData().toString('utf8');
            if (name.endsWith('.json')) {
              try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) conversationCount += parsed.length;
                extractedText += extractTextFromJson(parsed, detectedType) + '\n\n';
              } catch {
                extractedText += content.slice(0, 5000) + '\n\n';
              }
            } else {
              extractedText += content.slice(0, 5000) + '\n\n';
            }
            if (extractedText.length > 50000) break;
          }
        }
      }
    } catch (e) {
      throw new Error('Could not extract zip: ' + e.message);
    }
  } else if (lowerFilename.endsWith('.json')) {
    try {
      const parsed = JSON.parse(buffer.toString('utf8'));
      if (Array.isArray(parsed)) conversationCount = parsed.length;
      extractedText = extractTextFromJson(parsed, type);
    } catch {
      extractedText = buffer.toString('utf8').slice(0, 50000);
    }
  } else {
    extractedText = buffer.toString('utf8').slice(0, 50000);
  }

  // Count approximate messages
  messageCount = (extractedText.match(/\n\n/g) || []).length;

  // Generate soul profile summary using AI
  let soulSummary = '';
  if (extractedText.length > 100) {
    try {
      const { getProvider } = await import('@/lib/llm/providers');
      const provider = getProvider('openai', 'gpt-4o-mini');
      soulSummary = await provider.generateChatCompletion({
        systemPrompt: 'You are analyzing personal data exports to understand communication style and personality. Be concise.',
        messages: [{
          role: 'user',
          content: `Based on this data export (type: ${detectedType}), create a brief profile summary (200 words) covering communication style, interests, and personality traits.\n\nData:\n${extractedText.slice(0, 8000)}`,
        }],
        model: 'gpt-4o-mini',
        temperature: 0.5,
      });
    } catch (e) {
      console.log('[Import] AI summary failed:', e.message);
    }
  }

  // Store chunks for soul profile
  const chunkSize = 2000;
  const chunks = [];
  for (let i = 0; i < extractedText.length; i += chunkSize) {
    chunks.push(extractedText.slice(i, i + chunkSize));
  }

  for (const chunkText of chunks.slice(0, 25)) {
    await db.collection('source_corpus_chunks').insertOne({
      id: uuidv4(),
      user_id: userId,
      import_job_id: uploadId,
      chunk_text: chunkText,
      metadata: { type: detectedType },
      created_at: new Date(),
    });
  }

  // Update profile with summary
  if (soulSummary) {
    await db.collection('profiles').updateOne(
      { user_id: userId },
      { 
        $set: { 
          soul_profile_summary: soulSummary,
          soul_profile_updated_at: new Date(),
          soul_profile_source: detectedType,
        }
      }
    );
  }

  // Update upload session
  await db.collection('upload_sessions').updateOne(
    { id: uploadId },
    {
      $set: {
        status: 'complete',
        detected_type: detectedType,
        conversation_count: conversationCount,
        message_count: messageCount,
        summary_generated: !!soulSummary,
        completed_at: new Date(),
      }
    }
  );

  return {
    detectedType,
    conversationCount,
    messageCount,
    summaryGenerated: !!soulSummary,
  };
}

// ============================================================
// DATA IMPORT HANDLERS (ChatGPT/Facebook)
// ============================================================

async function parseChatGPTExport(buffer) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(buffer);
  
  let conversations = [];
  let userMessages = [];
  
  for (const entry of zip.getEntries()) {
    if (entry.entryName.toLowerCase().includes('conversations.json')) {
      try {
        const data = JSON.parse(entry.getData().toString('utf8'));
        if (Array.isArray(data)) {
          conversations = data;
          for (const conv of data) {
            if (conv.mapping) {
              for (const node of Object.values(conv.mapping)) {
                const msg = node?.message;
                if (msg?.author?.role === 'user' && msg?.content?.parts) {
                  userMessages.push({
                    role: 'user',
                    content: msg.content.parts.join(' '),
                    timestamp: msg.create_time,
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('ChatGPT parse error:', e);
      }
    }
  }
  
  return {
    source: 'chatgpt',
    conversationCount: conversations.length,
    userMessageCount: userMessages.length,
    userMessages: userMessages.slice(0, 500),
  };
}

async function parseFacebookExport(buffer) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(buffer);
  
  let messages = [];
  let posts = [];
  
  for (const entry of zip.getEntries()) {
    const name = entry.entryName.toLowerCase();
    
    if (name.includes('messages/inbox/') && name.endsWith('.json')) {
      try {
        const data = JSON.parse(entry.getData().toString('utf8'));
        if (data.messages) {
          for (const msg of data.messages) {
            if (msg.content && msg.sender_name) {
              messages.push({
                content: msg.content,
                sender: msg.sender_name,
                timestamp: msg.timestamp_ms,
              });
            }
          }
        }
      } catch (e) {}
    }
    
    if ((name.includes('your_posts') || name.includes('posts/')) && name.endsWith('.json')) {
      try {
        const data = JSON.parse(entry.getData().toString('utf8'));
        const postList = Array.isArray(data) ? data : (data.posts || []);
        for (const post of postList) {
          if (post.data?.[0]?.post) {
            posts.push({ content: post.data[0].post, timestamp: post.timestamp });
          }
        }
      } catch (e) {}
    }
  }
  
  return {
    source: 'facebook',
    messageCount: messages.length,
    postCount: posts.length,
    messages: messages.slice(0, 500),
    posts: posts.slice(0, 200),
  };
}

async function analyzeCommmunicationStyle(parsedData) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return { error: 'OpenAI API key not configured' };
  }

  let textSample = '';
  
  if (parsedData.source === 'chatgpt') {
    textSample = parsedData.userMessages
      ?.slice(0, 100)
      .map(m => m.content)
      .filter(c => c && c.length > 20)
      .join('\n---\n')
      .slice(0, 15000) || '';
  } else if (parsedData.source === 'facebook') {
    const msgText = parsedData.messages?.slice(0, 100).map(m => m.content).join('\n---\n') || '';
    const postText = parsedData.posts?.slice(0, 50).map(p => p.content).join('\n---\n') || '';
    textSample = (msgText + '\n\n' + postText).slice(0, 15000);
  }

  if (textSample.length < 100) {
    return { error: 'Not enough data to analyze' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are analyzing a user's communication data. Output valid JSON only.`,
          },
          {
            role: 'user',
            content: `Analyze this ${parsedData.source} data and return JSON with:
{
  "communicationStyle": { "tone": "", "formality": "", "verbosity": "", "emotionalExpression": "" },
  "interests": ["topic1", "topic2", ...],
  "vocabulary": { "averageSentenceLength": "", "commonPhrases": [], "uniqueExpressions": [] },
  "questionStyle": { "frequency": "", "types": [] },
  "insights": ["insight1", "insight2", ...],
  "summary": "2-3 sentence personality summary"
}

Data sample:
${textSample}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { error: 'Could not parse analysis response' };
  } catch (e) {
    console.error('Analysis error:', e);
    return { error: e.message };
  }
}

async function handleDataImportUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const contentType = request.headers.get('content-type') || '';
    const db = await getDb();
    const uploadId = uuidv4();

    // Handle JSON body (pre-extracted messages from client-side processing)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const messages = body.messages || [];
      const posts = body.posts || [];
      const source = body.type || 'unknown';
      
      if (messages.length === 0 && posts.length === 0) {
        return err('No messages or posts found in the data');
      }

      // Create import record
      await db.collection('data_imports').insertOne({
        id: uploadId,
        user_id: user.id,
        source,
        status: 'processing',
        created_at: new Date(),
      });

      // Build parsed data for analysis
      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      
      // Build extracted text for analysis
      const extractedText = messages
        .map(m => `[${m.role}]: ${m.content}`)
        .join('\n\n')
        .slice(0, 50000);

      const conversationCount = Math.max(1, Math.ceil(messages.length / 10));

      const parsedData = {
        source,
        extractedText,
        conversationCount,
        messageCount: messages.length,
        userMessageCount: userMessages.length,
        postCount: posts.length,
        userMessages: userMessages.slice(0, 500),
        messages: messages.filter(m => m.role !== 'assistant').slice(0, 500),
        posts: posts.slice(0, 200),
      };

      // Update with parsed stats
      await db.collection('data_imports').updateOne(
        { id: uploadId },
        { $set: { 
          status: 'analyzing',
          parsed_stats: {
            source: parsedData.source,
            conversationCount: parsedData.conversationCount,
            messageCount: parsedData.messageCount,
            userMessageCount: parsedData.userMessageCount,
            postCount: parsedData.postCount,
          }
        } }
      );

      // Analyze communication style
      const analysis = await analyzeCommmunicationStyle(parsedData);
      
      if (analysis.error) {
        await db.collection('data_imports').updateOne(
          { id: uploadId },
          { $set: { status: 'error', error: analysis.error } }
        );
        return err(`Analysis failed: ${analysis.error}`);
      }

      await db.collection('data_imports').updateOne(
        { id: uploadId },
        { $set: { status: 'complete', analysis, completed_at: new Date() } }
      );

      // Update soul profile
      await db.collection('soul_profiles').updateOne(
        { user_id: user.id },
        { 
          $set: { insights: analysis, updated_at: new Date() },
          $push: {
            import_history: {
              import_id: uploadId,
              source: parsedData.source,
              analyzed_at: new Date(),
            }
          }
        },
        { upsert: true }
      );

      return ok({
        success: true,
        uploadId,
        importId: uploadId,
        analysis,
        stats: {
          source: parsedData.source,
          conversationsAnalyzed: parsedData.conversationCount,
          messagesAnalyzed: parsedData.messageCount,
        }
      });
    }

    // Handle FormData (ZIP file upload)
    const formData = await request.formData();
    const file = formData.get('file');
    const source = formData.get('source') || 'unknown';
    
    if (!file) return err('No file provided');
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || 'upload.zip';
    
    if (!filename.toLowerCase().endsWith('.zip')) {
      return err('Please upload a ZIP file');
    }
    
    await db.collection('data_imports').insertOne({
      id: uploadId,
      user_id: user.id,
      filename,
      source,
      status: 'processing',
      file_size: buffer.length,
      created_at: new Date(),
    });

    let parsedData;
    if (source === 'chatgpt') {
      parsedData = await parseChatGPTExport(buffer);
    } else if (source === 'facebook') {
      parsedData = await parseFacebookExport(buffer);
    } else {
      // Auto-detect
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries().map(e => e.entryName.toLowerCase());
      
      if (entries.some(e => e.includes('conversations.json'))) {
        parsedData = await parseChatGPTExport(buffer);
      } else if (entries.some(e => e.includes('messages/') || e.includes('posts/'))) {
        parsedData = await parseFacebookExport(buffer);
      } else {
        await db.collection('data_imports').updateOne(
          { id: uploadId },
          { $set: { status: 'error', error: 'Could not detect data format' } }
        );
        return err('Could not detect data format');
      }
    }

    await db.collection('data_imports').updateOne(
      { id: uploadId },
      { $set: { 
        status: 'analyzing',
        parsed_stats: {
          source: parsedData.source,
          conversationCount: parsedData.conversationCount || 0,
          messageCount: parsedData.userMessageCount || parsedData.messageCount || 0,
          postCount: parsedData.postCount || 0,
        }
      } }
    );

    const analysis = await analyzeCommmunicationStyle(parsedData);
    
    if (analysis.error) {
      await db.collection('data_imports').updateOne(
        { id: uploadId },
        { $set: { status: 'error', error: analysis.error } }
      );
      return err(`Analysis failed: ${analysis.error}`);
    }

    await db.collection('data_imports').updateOne(
      { id: uploadId },
      { $set: { status: 'complete', analysis, completed_at: new Date() } }
    );

    // Update soul profile
    await db.collection('soul_profiles').updateOne(
      { user_id: user.id },
      { 
        $set: { 
          insights: analysis,
          updated_at: new Date(),
        },
        $push: {
          import_history: {
            import_id: uploadId,
            source: parsedData.source,
            analyzed_at: new Date(),
          }
        }
      },
      { upsert: true }
    );

    return ok({
      success: true,
      uploadId,
      analysis,
      stats: {
        source: parsedData.source,
        conversationsAnalyzed: parsedData.conversationCount || 0,
        messagesAnalyzed: parsedData.userMessageCount || parsedData.messageCount || 0,
        postsAnalyzed: parsedData.postCount || 0,
      }
    });

  } catch (e) {
    console.error('Data import error:', e);
    return err(`Import failed: ${e.message}`, 500);
  }
}

async function handleGetDataImports(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  const imports = await db.collection('data_imports')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();
  
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
  
  return ok({
    imports: imports.map(i => ({
      id: i.id,
      source: i.parsed_stats?.source || i.source,
      status: i.status,
      stats: i.parsed_stats,
      analysis: i.analysis,
      created_at: i.created_at,
      completed_at: i.completed_at,
    })),
    soulProfile: soulProfile?.insights || null,
  });
}

async function handleDeleteDataImport(request, importId) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const result = await db.collection('data_imports').deleteOne({ 
    id: importId, 
    user_id: user.id 
  });
  
  if (result.deletedCount === 0) return err('Import not found', 404);
  return ok({ success: true });
}

async function handleGetImportStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const uploadId = url.searchParams.get('uploadId');

  if (!uploadId) return err('uploadId required');

  const db = await getDb();
  const session = await db.collection('upload_sessions').findOne({ id: uploadId, user_id: user.id });

  if (!session) return err('Upload not found', 404);

  return ok({
    uploadId: session.id,
    status: session.status,
    filename: session.filename,
    totalChunks: session.total_chunks,
    receivedChunks: session.received_chunks?.length || 0,
    detectedType: session.detected_type,
    conversationCount: session.conversation_count,
    messageCount: session.message_count,
    error: session.error,
  });
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

export async function GET(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr === 'data') return handleGetDataImports(request);
    if (pathStr === 'status') return handleGetImportStatus(request);
    
    return err('Import endpoint not found', 404);
  } catch (error) {
    console.error('[Import API] GET Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function POST(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    // Chunked upload
    if (pathStr === 'chunked/init') return handleChunkedInit(request);
    if (pathStr === 'chunked/chunk') return handleChunkedChunk(request);
    if (pathStr === 'chunked/complete') return handleChunkedComplete(request);
    
    // Data import (ChatGPT/Facebook)
    if (pathStr === 'data') return handleDataImportUpload(request);
    
    return err('Import endpoint not found', 404);
  } catch (error) {
    console.error('[Import API] POST Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(request, { params }) {
  const pathArr = params?.path || [];
  const pathStr = pathArr.join('/');

  try {
    if (pathStr.match(/^data\/[^\/]+$/)) {
      return handleDeleteDataImport(request, pathArr[1]);
    }
    
    return err('Import endpoint not found', 404);
  } catch (error) {
    console.error('[Import API] DELETE Error:', error);
    return err(error.message || 'Internal server error', 500);
  }
}
