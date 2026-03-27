/**
 * Cloud Import — chunked upload, batch processing for large files
 * Extracted from route.js for maintainability.
 */
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';

// CLOUD IMPORT (for large files)
// ============================================================

// Chunked upload - Initialize
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

// Chunked upload - Receive chunk (store on disk, not MongoDB)
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

    // Store chunk on disk instead of MongoDB (better for large files)
    const fs = require('fs').promises;
    const path = require('path');
    const chunkDir = path.join('/tmp', 'uploads', uploadId);
    
    // Create directory if it doesn't exist
    await fs.mkdir(chunkDir, { recursive: true });
    
    // Write chunk to disk
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkPath = path.join(chunkDir, `chunk_${String(chunkIndex).padStart(6, '0')}`);
    await fs.writeFile(chunkPath, chunkBuffer);

    // Update session
    await db.collection('upload_sessions').updateOne(
      { id: uploadId },
      { 
        $addToSet: { received_chunks: chunkIndex },
        $set: { updated_at: new Date() }
      }
    );

    console.log(`[ChunkedUpload] Stored chunk ${chunkIndex + 1}/${session.total_chunks} for ${uploadId} (${chunkBuffer.length} bytes)`);

    return ok({ received: chunkIndex });
  } catch (error) {
    console.error('[ChunkedChunk] Error:', error);
    return err(error.message || 'Failed to process chunk', 500);
  }
}

// Extract memories from imported messages using AI
async function extractMemoriesFromImport(db, userId, messages, source) {
  if (!messages || messages.length === 0) return 0;

  // Sample messages for memory extraction (take up to 100 representative messages for better coverage)
  const userMessages = messages
    .filter(m => m.role === 'user' || m.role === 'human')
    .slice(0, 100);

  if (userMessages.length === 0) return 0;

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    console.log('[MemoryExtract] No OpenAI key, skipping memory extraction');
    return 0;
  }

  try {
    // Prepare messages for analysis
    const messagesText = userMessages
      .map(m => m.content)
      .filter(c => c && c.length > 20) // Only meaningful messages
      .join('\n---\n');

    if (messagesText.length < 100) return 0;

    // Use AI to extract important facts/memories AND communication style
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are analyzing a user's conversation history to extract TWO things:

1. MEMORIES: Important personal facts that a personal AI assistant should remember
2. COMMUNICATION PROFILE: How this person communicates and their personality

For MEMORIES, extract facts like:
- Personal details (name, location, family, relationships)
- Preferences and favorites (food, music, hobbies)
- Work/career information
- Health information
- Important life events
- Goals and aspirations
- Recurring topics they care about

For COMMUNICATION PROFILE, analyze:
- Writing style (formal vs casual, verbose vs concise)
- Emotional expression (expressive vs reserved)
- How they ask questions
- Topics they're passionate about
- Their sense of humor (if any)
- How they prefer to receive information

Return JSON with this EXACT format:
{
  "memories": [{"content": "fact", "category": "personal|preference|work|health|event|goal|interest", "importance": "high|medium|low"}],
  "communication_profile": {
    "style": "brief description of their communication style",
    "formality": "formal|casual|mixed",
    "verbosity": "concise|moderate|verbose",
    "emotional_expression": "expressive|neutral|reserved",
    "interests": ["topic1", "topic2"],
    "personality_traits": ["trait1", "trait2"],
    "preferred_response_style": "how they likely want responses"
  }
}

Maximum 20 memories. Be specific and factual.`
          },
          {
            role: 'user',
            content: `Analyze these ${source} messages:\n\n${messagesText.substring(0, 20000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      console.log('[MemoryExtract] OpenAI API error:', response.status);
      return 0;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Parse the JSON response
    let parsed = { memories: [], communication_profile: null };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.log('[MemoryExtract] Failed to parse response:', parseError);
      // Try to extract just memories array as fallback
      try {
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          parsed.memories = JSON.parse(arrayMatch[0]);
        }
      } catch (e) {}
    }

    let memoriesAdded = 0;

    // Save memories to database
    const memories = parsed.memories || [];
    if (Array.isArray(memories) && memories.length > 0) {
      const memoryDocs = memories
        .filter(m => m.content && m.content.length > 5)
        .map(m => ({
          id: uuidv4(),
          user_id: userId,
          content: m.content,
          category: m.category || 'general',
          importance: m.importance || 'medium',
          source: `${source}_import`,
          pinned: m.importance === 'high',
          created_at: new Date(),
        }));

      if (memoryDocs.length > 0) {
        // Check for duplicates
        const existingMemories = await db.collection('user_memories')
          .find({ user_id: userId })
          .toArray();
        
        const existingContents = new Set(existingMemories.map(m => m.content?.toLowerCase().trim()));
        const newMemories = memoryDocs.filter(m => !existingContents.has(m.content.toLowerCase().trim()));

        if (newMemories.length > 0) {
          await db.collection('user_memories').insertMany(newMemories);
          memoriesAdded = newMemories.length;
          console.log(`[MemoryExtract] Added ${newMemories.length} memories from ${source} import`);
        }
      }
    }

    // Update SoulPrint/Communication Profile
    const commProfile = parsed.communication_profile;
    if (commProfile) {
      console.log('[MemoryExtract] Updating SoulPrint with communication profile');
      
      // Update or create soul_profiles entry
      await db.collection('soul_profiles').updateOne(
        { user_id: userId },
        {
          $set: {
            user_id: userId,
            'insights.communicationStyle': commProfile.style,
            'insights.formality': commProfile.formality,
            'insights.verbosity': commProfile.verbosity,
            'insights.emotionalExpression': commProfile.emotional_expression,
            'insights.interests': commProfile.interests || [],
            'insights.personalityTraits': commProfile.personality_traits || [],
            'insights.preferredResponseStyle': commProfile.preferred_response_style,
            'insights.lastUpdatedFrom': `${source}_import`,
            updated_at: new Date(),
          },
          $setOnInsert: {
            created_at: new Date(),
          }
        },
        { upsert: true }
      );
      
      // Also update communication_profiles collection
      await db.collection('communication_profiles').updateOne(
        { user_id: userId },
        {
          $set: {
            user_id: userId,
            formality_preference: commProfile.formality,
            information_density: commProfile.verbosity,
            emotional_expression: commProfile.emotional_expression,
            imported_style_description: commProfile.style,
            imported_interests: commProfile.interests || [],
            imported_traits: commProfile.personality_traits || [],
            updated_at: new Date(),
          },
          $setOnInsert: {
            created_at: new Date(),
          }
        },
        { upsert: true }
      );
      
      console.log('[MemoryExtract] SoulPrint communication profile updated');
    }

    return memoriesAdded;
  } catch (error) {
    console.error('[MemoryExtract] Error:', error);
    return 0;
  }
}

// Chunked upload - Process batch of files
async function handleChunkedProcessBatch(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { uploads, type = 'chatgpt' } = body;

  if (!uploads || !Array.isArray(uploads) || uploads.length === 0) {
    return err('No uploads provided');
  }

  const db = await getDb();
  const importId = uuidv4();

  // Create import job
  await db.collection('import_jobs').insertOne({
    id: importId,
    user_id: user.id,
    type,
    source: 'chunked_batch',
    upload_ids: uploads.map(u => u.uploadId),
    total_files: uploads.length,
    processed_files: 0,
    status: 'pending',
    progress: 0,
    message: `Processing ${uploads.length} file(s)...`,
    messages_count: 0,
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Process in background
  processChunkedBatch(importId, user.id, uploads, type).catch(err => {
    console.error('Chunked batch processing error:', err);
    db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status: 'failed', error: err.message, updated_at: new Date() } }
    );
  });

  return ok({ importId, status: 'pending' });
}

// Process chunked uploads batch - using disk-based streaming
async function processChunkedBatch(importId, userId, uploads, importType) {
  const db = await getDb();
  const fs = require('fs').promises;
  const fsSync = require('fs');
  const path = require('path');
  
  const updateStatus = async (status, message, progress = 0, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    let totalMessages = [];
    const totalFiles = uploads.length;

    for (let i = 0; i < uploads.length; i++) {
      const upload = uploads[i];
      const fileNum = i + 1;

      await updateStatus('processing', `Reassembling file ${fileNum}/${totalFiles}: ${upload.fileName}...`, Math.round((i / totalFiles) * 30));

      try {
        const chunkDir = path.join('/tmp', 'uploads', upload.uploadId);
        const outputPath = path.join('/tmp', 'uploads', `${upload.uploadId}.zip`);
        
        // Check if chunk directory exists
        try {
          await fs.access(chunkDir);
        } catch {
          console.error(`[ChunkedBatch] Chunk directory not found: ${chunkDir}`);
          continue;
        }

        // Get all chunk files sorted by name
        const chunkFiles = (await fs.readdir(chunkDir))
          .filter(f => f.startsWith('chunk_'))
          .sort();

        if (chunkFiles.length === 0) {
          console.error(`[ChunkedBatch] No chunks found for upload ${upload.uploadId}`);
          continue;
        }

        console.log(`[ChunkedBatch] Found ${chunkFiles.length} chunks for ${upload.fileName}`);

        // Stream chunks to output file (avoids loading all into memory)
        const writeStream = fsSync.createWriteStream(outputPath);
        
        for (const chunkFile of chunkFiles) {
          const chunkPath = path.join(chunkDir, chunkFile);
          const chunkData = await fs.readFile(chunkPath);
          writeStream.write(chunkData);
        }
        
        await new Promise((resolve, reject) => {
          writeStream.end();
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        // Get file size
        const stats = await fs.stat(outputPath);
        console.log(`[ChunkedBatch] Reassembled file ${fileNum}: ${upload.fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        await updateStatus('processing', `Extracting messages from file ${fileNum}/${totalFiles}...`, Math.round((i / totalFiles) * 30) + 30);

        // Extract messages using optimized streaming approach for large files
        let messages = [];
        if (importType === 'chatgpt') {
          // Sample across ALL files for comprehensive personality/memory coverage
          messages = await extractChatGPTMessagesFromFile(outputPath, { 
            maxMessages: 1000,
            forSoulprint: true 
          });
        } else if (importType === 'facebook') {
          messages = await extractFacebookMessagesFromFile(outputPath);
        }

        console.log(`[ChunkedBatch] Extracted ${messages.length} messages from file ${fileNum}`);
        totalMessages = totalMessages.concat(messages);

        // Clean up
        await fs.rm(chunkDir, { recursive: true, force: true });
        await fs.unlink(outputPath).catch(() => {});
        await db.collection('upload_sessions').deleteOne({ id: upload.uploadId });

      } catch (fileError) {
        console.error(`Error processing file ${fileNum}:`, fileError);
      }
    }

    await updateStatus('processing', 'Saving messages...', 80);

    // Deduplicate and save all messages
    if (totalMessages.length > 0) {
      const existingHashes = new Set();
      const existingMsgs = await db.collection('imported_messages')
        .find({ user_id: userId })
        .project({ content_hash: 1 })
        .toArray();
      existingMsgs.forEach(m => existingHashes.add(m.content_hash));

      const crypto = require('crypto');
      const newMessages = totalMessages.filter(m => {
        const hash = crypto.createHash('md5').update(m.content || '').digest('hex');
        m.content_hash = hash;
        return !existingHashes.has(hash);
      });

      if (newMessages.length > 0) {
        const docs = newMessages.map(m => ({
          id: uuidv4(),
          user_id: userId,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp,
          source: importType,
          content_hash: m.content_hash,
          imported_at: new Date(),
        }));

        // Insert in batches
        const batchSize = 1000;
        for (let j = 0; j < docs.length; j += batchSize) {
          const batch = docs.slice(j, j + batchSize);
          await db.collection('imported_messages').insertMany(batch);
        }
      }

      // Extract and save memories from the imported messages
      const memoriesAdded = await extractMemoriesFromImport(db, userId, newMessages, importType);

      await updateStatus('completed', `Successfully imported ${newMessages.length} new messages from ${totalFiles} file(s) (${totalMessages.length - newMessages.length} duplicates skipped)`, 100, {
        messages_count: newMessages.length,
        total_extracted: totalMessages.length,
        files_processed: totalFiles,
        memories_added: memoriesAdded
      });
    } else {
      await updateStatus('completed', `No messages found in ${totalFiles} file(s)`, 100, { messages_count: 0 });
    }

  } catch (error) {
    console.error('[ChunkedBatch] Processing error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

// Extract ChatGPT messages from ZIP file on disk (streaming, memory-efficient)
// OPTIMIZED: Samples across ALL files for comprehensive personality/memory extraction
async function extractChatGPTMessagesFromFile(filePath, options = {}) {
  const { maxMessages = 1000, forSoulprint = true } = options;
  const messages = [];
  let conversationCount = 0;
  let totalFilesFound = 0;
  
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    // Find conversation files - both single file and split format
    const conversationFiles = zipEntries.filter(entry => {
      const name = entry.entryName;
      return name === 'conversations.json' || 
             name.endsWith('/conversations.json') ||
             /conversations-\d+\.json$/.test(name);
    }).sort((a, b) => a.entryName.localeCompare(b.entryName));
    
    totalFilesFound = conversationFiles.length;
    console.log(`[extractChatGPTMessagesFromFile] Found ${totalFilesFound} conversation file(s), maxMessages=${maxMessages}`);
    
    // Calculate how many messages to take from each file for even coverage
    const messagesPerFile = Math.ceil(maxMessages / Math.max(1, conversationFiles.length));
    console.log(`[extractChatGPTMessagesFromFile] Taking ~${messagesPerFile} messages per file for comprehensive coverage`);
    
    for (const entry of conversationFiles) {
      const fileMessages = [];
      
      try {
        const content = entry.getData().toString('utf8');
        const conversations = JSON.parse(content);
        const convArray = Array.isArray(conversations) ? conversations : [conversations];
        
        conversationCount += convArray.length;
        
        // For SoulPrint enhancement, prioritize USER messages and sample evenly
        const totalConvs = convArray.length;
        const convsToSample = Math.min(totalConvs, Math.ceil(messagesPerFile / 3)); // ~3 messages per conv
        const step = Math.max(1, Math.floor(totalConvs / convsToSample));
        
        for (let i = 0; i < totalConvs && fileMessages.length < messagesPerFile; i += step) {
          const conv = convArray[i];
          
          if (conv.mapping) {
            // New format with mapping - extract user messages for personality analysis
            const nodes = Object.values(conv.mapping);
            for (const node of nodes) {
              if (fileMessages.length >= messagesPerFile) break;
              
              if (node?.message?.content?.parts?.[0]) {
                const authorRole = node.message.author?.role;
                // For SoulPrint, prioritize user messages (shows personality/style)
                if (authorRole === 'user') {
                  const msgContent = node.message.content.parts.join('\n');
                  if (msgContent && msgContent.trim().length > 20) {
                    fileMessages.push({
                      content: msgContent.slice(0, 2000),
                      role: authorRole,
                      timestamp: node.message.create_time ? new Date(node.message.create_time * 1000) : new Date(),
                      conversationTitle: conv.title || 'Untitled',
                    });
                  }
                }
              }
            }
          }
          
          // Alternative format: direct messages array
          if (conv.messages && Array.isArray(conv.messages)) {
            for (const msg of conv.messages) {
              if (fileMessages.length >= messagesPerFile) break;
              
              if (msg.content && msg.role === 'user') {
                fileMessages.push({
                  content: typeof msg.content === 'string' ? msg.content.slice(0, 2000) : JSON.stringify(msg.content).slice(0, 2000),
                  role: msg.role,
                  timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
                });
              }
            }
          }
        }
        
        messages.push(...fileMessages);
        console.log(`[extractChatGPTMessagesFromFile] ${entry.entryName}: +${fileMessages.length} messages (total: ${messages.length})`);
      } catch (parseErr) {
        console.error(`[extractChatGPTMessagesFromFile] Error parsing ${entry.entryName}:`, parseErr.message);
      }
    }
  } catch (e) {
    console.error('[extractChatGPTMessagesFromFile] Error:', e);
  }
  
  console.log(`[extractChatGPTMessagesFromFile] Complete: ${messages.length} messages from ${conversationCount} conversations across ${totalFilesFound} files`);
  return messages;
}

// Extract Facebook messages from ZIP file on disk (streaming, memory-efficient)
async function extractFacebookMessagesFromFile(filePath) {
  const messages = [];
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    for (const entry of zipEntries) {
      if (entry.entryName.includes('messages/') && entry.entryName.endsWith('.json')) {
        try {
          const content = entry.getData().toString('utf8');
          const data = JSON.parse(content);
          
          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (msg.content) {
                messages.push({
                  content: msg.content,
                  role: 'user',
                  timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms) : new Date(),
                });
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON files
        }
      }
    }
  } catch (e) {
    console.error('[extractFacebookMessagesFromFile] Error:', e);
  }
  return messages;
}

// Handle direct file upload -> process directly (no external service)
async function handleDirectUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type') || 'chatgpt';

    if (!file) return err('No file provided');

    const fileName = file.name || 'upload.zip';
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    console.log(`[DirectUpload] Processing ${fileName} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB) directly`);

    const db = await getDb();
    const importId = uuidv4();

    // Create import job
    await db.collection('import_jobs').insertOne({
      id: importId,
      user_id: user.id,
      type,
      source: 'direct_upload',
      provider: 'direct',
      status: 'processing',
      progress: 10,
      message: 'Processing file...',
      messages_count: 0,
      error: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Process the file directly in memory
    processDirectUpload(importId, user.id, fileBuffer, type).catch(err => {
      console.error('Direct upload processing error:', err);
      db.collection('import_jobs').updateOne(
        { id: importId },
        { $set: { status: 'failed', error: err.message, updated_at: new Date() } }
      );
    });

    return ok({ importId, status: 'processing' });
  } catch (error) {
    console.error('[DirectUpload] Error:', error);
    return err(error.message || 'Upload failed', 500);
  }
}

// Process file buffer directly
async function processDirectUpload(importId, userId, buffer, importType) {
  const db = await getDb();
  const updateStatus = async (status, message, progress = 0, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    await updateStatus('processing', 'Extracting messages...', 30);

    // Process the file based on type
    let messages = [];
    
    if (importType === 'chatgpt') {
      messages = await extractChatGPTMessagesFromBuffer(buffer);
    } else if (importType === 'facebook') {
      messages = await extractFacebookMessagesFromBuffer(buffer);
    }

    console.log(`[DirectUpload] Extracted ${messages.length} messages`);
    await updateStatus('processing', 'Saving messages...', 60);

    // Save messages to database
    if (messages.length > 0) {
      // Deduplicate
      const existingHashes = new Set();
      const existingMsgs = await db.collection('imported_messages')
        .find({ user_id: userId })
        .project({ content_hash: 1 })
        .toArray();
      existingMsgs.forEach(m => existingHashes.add(m.content_hash));

      const crypto = require('crypto');
      const newMessages = messages.filter(m => {
        const hash = crypto.createHash('md5').update(m.content || '').digest('hex');
        m.content_hash = hash;
        return !existingHashes.has(hash);
      });

      if (newMessages.length > 0) {
        const docs = newMessages.map(m => ({
          id: uuidv4(),
          user_id: userId,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp,
          source: importType,
          content_hash: m.content_hash,
          imported_at: new Date(),
        }));

        await db.collection('imported_messages').insertMany(docs);
      }

      await updateStatus('completed', `Successfully imported ${newMessages.length} new messages (${messages.length - newMessages.length} duplicates skipped)`, 100, { messages_count: newMessages.length });
    } else {
      await updateStatus('completed', 'No messages found in the file', 100, { messages_count: 0 });
    }

  } catch (error) {
    console.error('[DirectUpload] Processing error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

async function handleCloudImport(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { url, type = 'chatgpt', provider = 'direct' } = body;

  if (!url) return err('URL required');

  const db = await getDb();
  const importId = uuidv4();

  // Create import job
  await db.collection('import_jobs').insertOne({
    id: importId,
    user_id: user.id,
    type,
    source: 'cloud',
    provider,
    cloud_url: url,
    status: 'pending',
    progress: 0,
    message: 'Starting download...',
    messages_count: 0,
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Process in background
  processCloudImport(importId, user.id, url, type, provider).catch(err => {
    console.error('Cloud import error:', err);
    db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status: 'failed', error: err.message, updated_at: new Date() } }
    );
  });

  return ok({ importId, status: 'pending' });
}

// Handle batch cloud import (multiple files from GoFile)
async function handleCloudBatchImport(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { files, type = 'chatgpt', provider = 'gofile' } = body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return err('No files provided');
  }

  const db = await getDb();
  const importId = uuidv4();

  // Create import job
  await db.collection('import_jobs').insertOne({
    id: importId,
    user_id: user.id,
    type,
    source: 'cloud_batch',
    provider,
    files: files,
    total_files: files.length,
    processed_files: 0,
    status: 'pending',
    progress: 0,
    message: `Processing ${files.length} file(s)...`,
    messages_count: 0,
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Process in background
  processCloudBatchImport(importId, user.id, files, type, provider).catch(err => {
    console.error('Cloud batch import error:', err);
    db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status: 'failed', error: err.message, updated_at: new Date() } }
    );
  });

  return ok({ importId, status: 'pending' });
}

// Process multiple files from cloud storage
async function processCloudBatchImport(importId, userId, files, importType, provider) {
  const db = await getDb();
  const updateStatus = async (status, message, progress = 0, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    let totalMessages = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];
      const fileNum = i + 1;
      
      await updateStatus('processing', `Downloading file ${fileNum}/${totalFiles}: ${fileInfo.fileName}...`, Math.round((i / totalFiles) * 50));

      try {
        let downloadUrl;
        
        if (provider === 'gofile' && fileInfo.fileId) {
          // GoFile requires fetching the direct download link via API
          // Extract content code from download page URL (e.g., https://gofile.io/d/XXXXX)
          let contentCode = fileInfo.fileId;
          if (fileInfo.url) {
            const match = fileInfo.url.match(/\/d\/([a-zA-Z0-9]+)/);
            if (match) contentCode = match[1];
          }
          
          console.log(`[BatchImport] Fetching GoFile content info for: ${contentCode}`);
          
          // Get the direct download link from GoFile API
          const contentRes = await fetch(`https://api.gofile.io/contents/${contentCode}?wt=4fd6sg89d7s6`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            }
          });
          
          if (!contentRes.ok) {
            console.error(`[BatchImport] Failed to get GoFile content info: ${contentRes.status}`);
            // Try alternative: use the server from upload response
            const server = fileInfo.server || 'store1';
            downloadUrl = `https://${server}.gofile.io/download/web/${fileInfo.fileId}/${encodeURIComponent(fileInfo.fileName)}`;
          } else {
            const contentData = await contentRes.json();
            console.log(`[BatchImport] GoFile content response:`, JSON.stringify(contentData).substring(0, 500));
            
            if (contentData.status === 'ok' && contentData.data) {
              // Find the file in the children
              const children = contentData.data.children || contentData.data.contents?.children;
              if (children) {
                const fileData = Object.values(children).find(f => 
                  f.id === fileInfo.fileId || f.name === fileInfo.fileName
                ) || Object.values(children)[0];
                
                if (fileData) {
                  downloadUrl = fileData.link || fileData.directLink;
                  console.log(`[BatchImport] Found direct link: ${downloadUrl}`);
                }
              }
            }
            
            // Fallback if we couldn't extract the link
            if (!downloadUrl) {
              const server = fileInfo.server || 'store1';
              downloadUrl = `https://${server}.gofile.io/download/web/${fileInfo.fileId}/${encodeURIComponent(fileInfo.fileName)}`;
            }
          }
        } else {
          downloadUrl = fileInfo.url;
        }

        console.log(`[BatchImport] Downloading file ${fileNum}/${totalFiles} from: ${downloadUrl}`);

        // Download the file with proper headers
        const response = await fetch(downloadUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://gofile.io/',
          },
          redirect: 'follow',
        });

        if (!response.ok) {
          console.error(`Failed to download file ${fileNum}: ${response.status}`);
          continue; // Skip this file but continue with others
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Check if we got HTML instead of a ZIP file
        const firstBytes = buffer.slice(0, 20).toString();
        if (firstBytes.includes('<!DOCTYPE') || firstBytes.includes('<html')) {
          console.error(`[BatchImport] Got HTML instead of file for ${fileInfo.fileName}. GoFile may require authentication.`);
          continue;
        }
        
        console.log(`[BatchImport] Downloaded file ${fileNum}, size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        await updateStatus('processing', `Extracting messages from file ${fileNum}/${totalFiles}...`, Math.round((i / totalFiles) * 50) + 25);

        // Extract messages
        let messages = [];
        if (importType === 'chatgpt') {
          messages = await extractChatGPTMessagesFromBuffer(buffer);
        } else if (importType === 'facebook') {
          messages = await extractFacebookMessagesFromBuffer(buffer);
        }

        console.log(`[BatchImport] Extracted ${messages.length} messages from file ${fileNum}`);
        totalMessages = totalMessages.concat(messages);

      } catch (fileError) {
        console.error(`Error processing file ${fileNum}:`, fileError);
        // Continue with other files
      }
    }

    await updateStatus('processing', 'Saving messages...', 80);

    // Deduplicate and save all messages
    if (totalMessages.length > 0) {
      const existingHashes = new Set();
      const existingMsgs = await db.collection('imported_messages')
        .find({ user_id: userId })
        .project({ content_hash: 1 })
        .toArray();
      existingMsgs.forEach(m => existingHashes.add(m.content_hash));

      const crypto = require('crypto');
      const newMessages = totalMessages.filter(m => {
        const hash = crypto.createHash('md5').update(m.content || '').digest('hex');
        m.content_hash = hash;
        return !existingHashes.has(hash);
      });

      if (newMessages.length > 0) {
        const docs = newMessages.map(m => ({
          id: uuidv4(),
          user_id: userId,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp,
          source: importType,
          content_hash: m.content_hash,
          imported_at: new Date(),
        }));

        // Insert in batches to avoid memory issues
        const batchSize = 1000;
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = docs.slice(i, i + batchSize);
          await db.collection('imported_messages').insertMany(batch);
        }
      }

      await updateStatus('completed', `Successfully imported ${newMessages.length} new messages from ${totalFiles} file(s) (${totalMessages.length - newMessages.length} duplicates skipped)`, 100, { 
        messages_count: newMessages.length,
        total_extracted: totalMessages.length,
        files_processed: totalFiles
      });
    } else {
      await updateStatus('completed', `No messages found in ${totalFiles} file(s)`, 100, { messages_count: 0 });
    }

  } catch (error) {
    console.error('[BatchImport] Processing error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

async function processCloudImport(importId, userId, cloudUrl, importType, provider) {
  const db = await getDb();
  const updateStatus = async (status, message, progress = 0, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    // Convert cloud URLs to direct download URLs
    let downloadUrl = cloudUrl;
    let fileId = null;
    
    // Handle WeTransfer URLs
    if (provider === 'wetransfer' || cloudUrl.includes('we.tl') || cloudUrl.includes('wetransfer.com')) {
      console.log(`[CloudImport] Processing WeTransfer URL: ${cloudUrl}`);
      
      try {
        // First, resolve we.tl short URL to full URL
        let fullUrl = cloudUrl;
        if (cloudUrl.includes('we.tl')) {
          const redirectRes = await fetch(cloudUrl, { 
            method: 'HEAD',
            redirect: 'manual' 
          });
          fullUrl = redirectRes.headers.get('location') || cloudUrl;
          console.log(`[CloudImport] WeTransfer resolved to: ${fullUrl}`);
        }
        
        // Extract transfer ID and security hash from URL
        // Format: https://wetransfer.com/downloads/TRANSFER_ID/SECURITY_HASH
        const wtMatch = fullUrl.match(/wetransfer\.com\/downloads\/([^\/]+)\/([^\/\?]+)/);
        
        if (wtMatch) {
          const transferId = wtMatch[1];
          const securityHash = wtMatch[2];
          
          // Get download link from WeTransfer API
          const apiUrl = `https://wetransfer.com/api/v4/transfers/${transferId}/download`;
          const apiRes = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ security_hash: securityHash, intent: 'entire_transfer' }),
          });
          
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.direct_link) {
              downloadUrl = apiData.direct_link;
              console.log(`[CloudImport] Got WeTransfer direct link`);
            }
          }
        }
        
        if (downloadUrl === cloudUrl) {
          throw new Error('Could not extract download link from WeTransfer. Please make sure the link is valid and has not expired.');
        }
      } catch (wtError) {
        console.error(`[CloudImport] WeTransfer error:`, wtError);
        throw new Error('Failed to process WeTransfer link. Please make sure the link is valid and has not expired (links expire after 7 days).');
      }
    } else if (provider === 'gofile' || cloudUrl.includes('gofile.io')) {
      // GoFile requires premium account for API access - show helpful error
      console.log(`[CloudImport] GoFile URL detected - requires premium API`);
      throw new Error('GoFile requires a premium account for direct downloads. Please use WeTransfer instead (free, no account needed).');
    } else if (provider === 'google' || cloudUrl.includes('drive.google.com')) {
      // Extract file ID from Google Drive URL
      const match = cloudUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        fileId = match[1];
        // For large files, we need to use a special approach
        // First try the direct download URL
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    } else if (provider === 'dropbox' || cloudUrl.includes('dropbox.com')) {
      // Convert Dropbox share link to direct download
      downloadUrl = cloudUrl.replace('?dl=0', '?dl=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    } else if (provider === 'onedrive' || cloudUrl.includes('1drv.ms') || cloudUrl.includes('onedrive.live.com')) {
      // OneDrive: need to convert share link
      downloadUrl = cloudUrl.replace('redir?', 'download?');
    }

    await updateStatus('processing', 'Downloading file...', 10);

    // Download the file
    console.log(`[CloudImport] Downloading from: ${downloadUrl}`);
    let response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}. Make sure the file is publicly accessible.`);
    }

    // For Google Drive large files, check if we got an HTML page (virus scan warning)
    let buffer;
    const contentType = response.headers.get('content-type') || '';
    
    if (fileId && contentType.includes('text/html')) {
      console.log('[CloudImport] Got HTML response, trying to extract confirmation token...');
      const html = await response.text();
      
      // Look for download confirmation URL in the HTML
      // Google Drive returns a page with a "Download anyway" link for large files
      const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
      const atMatch = html.match(/at=([a-zA-Z0-9_-]+)/);
      const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);
      
      // Extract any cookies from the initial response
      const setCookieHeader = response.headers.get('set-cookie') || '';
      
      if (confirmMatch || atMatch) {
        // Try with confirmation token
        const confirmToken = confirmMatch ? confirmMatch[1] : 't';
        const atToken = atMatch ? `&at=${atMatch[1]}` : '';
        const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${fileId}${atToken}`;
        console.log(`[CloudImport] Retrying with confirmation token: ${confirmUrl}`);
        
        response = await fetch(confirmUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': setCookieHeader.split(';')[0] || '',
          },
          redirect: 'follow',
        });
        
        if (!response.ok) {
          throw new Error('Failed to download file after confirmation. Make sure the file is publicly accessible.');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        
        // Check if we still got HTML after confirmation
        const firstCheck = buffer.slice(0, 100).toString();
        if (firstCheck.includes('<!DOCTYPE html') || firstCheck.includes('<html')) {
          // Final fallback - try with confirm=t&uuid
          const uuid = uuidMatch ? uuidMatch[1] : '';
          const finalUrl = `https://drive.google.com/uc?export=download&confirm=t&uuid=${uuid}&id=${fileId}`;
          console.log(`[CloudImport] Final attempt with uuid: ${finalUrl}`);
          
          response = await fetch(finalUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Cookie': setCookieHeader.split(';')[0] || '',
            },
            redirect: 'follow',
          });
          
          const arrayBuffer2 = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer2);
          
          const secondCheck = buffer.slice(0, 100).toString();
          if (secondCheck.includes('<!DOCTYPE html') || secondCheck.includes('<html')) {
            throw new Error('Google Drive is blocking direct download for this large file. Please use Dropbox instead: 1) Upload your ZIP to Dropbox, 2) Get shareable link, 3) Change ?dl=0 to ?dl=1 in the URL, 4) Paste here.');
          }
        }
      } else {
        // Try alternative approaches
        const exportUrl = `https://drive.google.com/uc?id=${fileId}&export=download&confirm=t`;
        console.log(`[CloudImport] Trying export URL: ${exportUrl}`);
        
        response = await fetch(exportUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
          },
          redirect: 'follow',
        });
        
        if (!response.ok) {
          throw new Error('Failed to download from Google Drive. For files over 100MB, please use Dropbox instead.');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        
        // Check if we still got HTML
        const firstBytes = buffer.slice(0, 100).toString();
        if (firstBytes.includes('<!DOCTYPE html') || firstBytes.includes('<html')) {
          throw new Error('Google Drive requires virus scan confirmation for this file. Please use Dropbox instead: 1) Upload to Dropbox, 2) Get shareable link (dl=1), 3) Paste here.');
        }
      }
    } else {
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const contentLength = buffer.length;
    console.log(`[CloudImport] Downloaded file size: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
    
    if (contentLength < 100) {
      throw new Error('Downloaded file is too small. Please ensure the file is publicly accessible and the link is correct.');
    }

    await updateStatus('processing', 'Processing file...', 30);
    await updateStatus('processing', 'Extracting messages...', 50);

    // Process the file based on type
    let messages = [];
    
    if (importType === 'chatgpt') {
      messages = await extractChatGPTMessagesFromBuffer(buffer);
    } else if (importType === 'facebook') {
      messages = await extractFacebookMessagesFromBuffer(buffer);
    }

    await updateStatus('processing', 'Saving messages...', 80);

    // Save messages to database
    if (messages.length > 0) {
      // Deduplicate
      const existingHashes = new Set();
      const existingMsgs = await db.collection('imported_messages')
        .find({ user_id: userId })
        .project({ content_hash: 1 })
        .toArray();
      existingMsgs.forEach(m => existingHashes.add(m.content_hash));

      const crypto = require('crypto');
      const newMessages = messages.filter(m => {
        const hash = crypto.createHash('md5').update(m.content || '').digest('hex');
        m.content_hash = hash;
        return !existingHashes.has(hash);
      });

      if (newMessages.length > 0) {
        const docs = newMessages.map(m => ({
          id: uuidv4(),
          user_id: userId,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp,
          source: importType,
          content_hash: m.content_hash,
          imported_at: new Date(),
        }));

        await db.collection('imported_messages').insertMany(docs);
      }

      await updateStatus('completed', `Successfully imported ${newMessages.length} new messages (${messages.length - newMessages.length} duplicates skipped)`, 100, { messages_count: newMessages.length });
    } else {
      await updateStatus('completed', 'No messages found in the file', 100, { messages_count: 0 });
    }

  } catch (error) {
    console.error('[CloudImport] Error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

// Helper to extract ChatGPT messages from ZIP buffer using adm-zip
async function extractChatGPTMessagesFromBuffer(buffer) {
  const messages = [];
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    for (const entry of zipEntries) {
      if (entry.entryName === 'conversations.json' || entry.entryName.endsWith('/conversations.json')) {
        const content = entry.getData().toString('utf8');
        const conversations = JSON.parse(content);
        
        for (const conv of conversations) {
          if (conv.mapping) {
            for (const node of Object.values(conv.mapping)) {
              if (node?.message?.content?.parts?.[0]) {
                const role = node.message.author?.role === 'user' ? 'user' : 'assistant';
                messages.push({
                  content: node.message.content.parts[0],
                  role,
                  timestamp: node.message.create_time ? new Date(node.message.create_time * 1000) : new Date(),
                });
              }
            }
          }
        }
        break;
      }
    }
  } catch (e) {
    console.error('[extractChatGPTMessagesFromBuffer] Error:', e);
  }
  return messages;
}

// Helper to extract Facebook messages from ZIP buffer using adm-zip
async function extractFacebookMessagesFromBuffer(buffer) {
  const messages = [];
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    for (const entry of zipEntries) {
      if (entry.entryName.includes('messages/') && entry.entryName.endsWith('.json')) {
        try {
          const content = entry.getData().toString('utf8');
          const data = JSON.parse(content);
          
          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (msg.content) {
                messages.push({
                  content: msg.content,
                  role: 'user',
                  timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms) : new Date(),
                });
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON files
        }
      }
    }
  } catch (e) {
    console.error('[extractFacebookMessagesFromBuffer] Error:', e);
  }
  return messages;
}

// Get import job status
async function handleImportStatus(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const importId = url.searchParams.get('importId');
  if (!importId) return err('importId required');

  const db = await getDb();
  const job = await db.collection('import_jobs').findOne({ id: importId, user_id: user.id });
  
  if (!job) return err('Import not found', 404);

  // If completed, also fetch the analysis and profile data
  let analysis = null;
  let profileComparison = null;
  let memoriesAdded = 0;
  
  if (job.status === 'completed') {
    // Get the data import record with analysis
    const dataImport = await db.collection('data_imports').findOne({ 
      user_id: user.id,
      created_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
    }, { sort: { created_at: -1 } });
    
    if (dataImport?.analysis) {
      analysis = dataImport.analysis;
    }
    
    // Get current soul profile for comparison
    const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
    if (soulProfile) {
      profileComparison = {
        interests: soulProfile.interests || [],
        communicationStyle: soulProfile.insights?.communicationStyle || null,
        vocabulary: soulProfile.insights?.vocabulary || null,
        personalityTraits: soulProfile.insights?.personalityTraits || []
      };
    }
    
    // Count memories added from this import
    memoriesAdded = job.memories_added || 0;
  }

  return ok({
    status: job.status,
    message: job.message,
    progress: job.progress,
    messagesCount: job.messages_count,
    error: job.error,
    analysis,
    profileComparison,
    memoriesAdded
  });
}

// ============================================================


export {
  handleChunkedInit,
  handleChunkedChunk,
  extractMemoriesFromImport,
  handleChunkedProcessBatch,
  processChunkedBatch,
  extractChatGPTMessagesFromFile,
  extractFacebookMessagesFromFile,
  handleDirectUpload,
  processDirectUpload,
  handleCloudImport,
  handleCloudBatchImport,
  processCloudBatchImport,
  processCloudImport,
  extractChatGPTMessagesFromBuffer,
  extractFacebookMessagesFromBuffer,
  handleImportStatus,
};
