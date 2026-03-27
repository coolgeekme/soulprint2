/**
 * Data Import & Analysis — chunked upload, ZIP extraction, insights
 * Extracted from route.js for maintainability.
 */
import { getDb } from '@/lib/mongodb';
import { ok, err, authenticate } from '@/lib/api-utils';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import yauzl from 'yauzl';

// DATA IMPORT & ANALYSIS ENDPOINTS
// ============================================================

// Chunked upload: Initialize an upload session
async function handleChunkedUploadInit(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { filename, fileSize, source, totalChunks } = body;
  
  if (!filename || !fileSize || !totalChunks) {
    return err('filename, fileSize, and totalChunks required');
  }

  const db = await getDb();
  const uploadId = uuidv4();
  
  // Create upload session - chunks will be stored separately
  await db.collection('chunked_uploads').insertOne({
    id: uploadId,
    user_id: user.id,
    filename,
    file_size: fileSize,
    source: source || 'chatgpt',
    total_chunks: totalChunks,
    received_chunks: [],
    status: 'uploading',
    created_at: new Date(),
  });
  
  return ok({ uploadId, message: 'Upload session created' });
}

// Chunked upload: Receive a chunk and store it
async function handleChunkedUploadChunk(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const uploadId = formData.get('uploadId');
    const chunkIndex = parseInt(formData.get('chunkIndex'));
    const chunk = formData.get('chunk');
    
    if (!uploadId || chunkIndex === undefined || !chunk) {
      return err('uploadId, chunkIndex, and chunk required');
    }

    const db = await getDb();
    const upload = await db.collection('chunked_uploads').findOne({ id: uploadId, user_id: user.id });
    
    if (!upload) return err('Upload session not found', 404);
    if (upload.status !== 'uploading') return err('Upload already completed or failed');

    // Convert chunk to base64 and store as separate document
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkBase64 = chunkBuffer.toString('base64');
    
    // Store chunk as separate document to avoid 16MB limit
    await db.collection('upload_chunks').updateOne(
      { upload_id: uploadId, chunk_index: chunkIndex },
      { 
        $set: { 
          upload_id: uploadId,
          chunk_index: chunkIndex,
          data: chunkBase64,
          size: chunkBuffer.length,
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    
    // Update received chunks list
    await db.collection('chunked_uploads').updateOne(
      { id: uploadId },
      { $addToSet: { received_chunks: chunkIndex } }
    );
    
    return ok({ 
      received: chunkIndex, 
      message: `Chunk ${chunkIndex + 1} received` 
    });
  } catch (e) {
    console.error('Chunk upload error:', e);
    return err(`Chunk upload failed: ${e.message}`, 500);
  }
}

// Chunked upload: Complete - reassemble ZIP and extract messages properly
async function handleChunkedUploadComplete(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { uploadId } = body;
  
  if (!uploadId) return err('uploadId required');

  const db = await getDb();
  const upload = await db.collection('chunked_uploads').findOne({ id: uploadId, user_id: user.id });
  
  if (!upload) return err('Upload session not found', 404);
  if (upload.status !== 'uploading') return err('Upload already completed or failed');
  
  // Verify all chunks received
  if (upload.received_chunks.length !== upload.total_chunks) {
    return err(`Missing chunks: received ${upload.received_chunks.length} of ${upload.total_chunks}`);
  }

  const tempDir = `/tmp/upload_${uploadId}`;
  const tempZipPath = `${tempDir}/upload.zip`;

  try {
    // Update status
    await db.collection('chunked_uploads').updateOne(
      { id: uploadId },
      { $set: { status: 'processing' } }
    );

    // Create temp directory
    await mkdir(tempDir, { recursive: true });

    // Reassemble chunks into a ZIP file (process in batches to manage memory)
    console.log(`Reassembling ${upload.total_chunks} chunks into ZIP file...`);
    
    const writeStream = fs.createWriteStream(tempZipPath);
    const BATCH_SIZE = 50; // Process 50 chunks at a time
    
    for (let batchStart = 0; batchStart < upload.total_chunks; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, upload.total_chunks);
      
      // Fetch chunks for this batch
      const chunkDocs = await db.collection('upload_chunks')
        .find({ 
          upload_id: uploadId, 
          chunk_index: { $gte: batchStart, $lt: batchEnd } 
        })
        .sort({ chunk_index: 1 })
        .toArray();
      
      // Write chunks to file
      for (const doc of chunkDocs) {
        const buffer = Buffer.from(doc.data, 'base64');
        writeStream.write(buffer);
      }
      
      // Delete processed chunks to free memory
      await db.collection('upload_chunks').deleteMany({ 
        upload_id: uploadId, 
        chunk_index: { $gte: batchStart, $lt: batchEnd } 
      });
      
      console.log(`Processed chunks ${batchStart}-${batchEnd} of ${upload.total_chunks}`);
    }
    
    // Close the write stream and wait for it to finish
    await new Promise((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`ZIP file created at ${tempZipPath}`);

    // Extract messages from the ZIP file
    const messages = await extractMessagesFromZip(tempZipPath, upload.source);
    
    console.log(`Extracted ${messages.length} messages from ZIP`);

    // Check if we have enough data
    if (messages.length < 5) {
      // Clean up
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      await db.collection('chunked_uploads').deleteOne({ id: uploadId });
      return err('Could not extract enough messages from your export. The file may be empty, corrupted, or in an unsupported format. Please ensure you uploaded a ChatGPT or Facebook data export ZIP file.', 400);
    }

    // Prepare data for analysis
    const parsedData = { 
      source: upload.source || 'chatgpt', 
      sampleMessages: messages.slice(0, 200),
      userMessages: messages.slice(0, 200),
      conversationCount: Math.ceil(messages.length / 10),
      userMessageCount: messages.length,
    };

    // Create import record
    const importId = uuidv4();
    await db.collection('data_imports').insertOne({
      id: importId,
      user_id: user.id,
      filename: upload.filename,
      source: parsedData.source,
      status: 'analyzing',
      file_size: upload.file_size,
      parsed_stats: {
        source: parsedData.source,
        conversationCount: parsedData.conversationCount,
        messageCount: parsedData.userMessageCount,
      },
      created_at: new Date(),
    });

    // Analyze communication style
    const analysis = await analyzeCommmunicationStyle(parsedData);
    
    if (analysis.error) {
      await db.collection('data_imports').updateOne(
        { id: importId },
        { $set: { status: 'error', error: analysis.error } }
      );
      console.error('Analysis error:', analysis.error);
    } else {
      // Save analysis results
      await db.collection('data_imports').updateOne(
        { id: importId },
        { $set: { status: 'complete', analysis, completed_at: new Date() } }
      );

      // Update soul profile
      const existingProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
      const updatedInsights = mergeInsights(existingProfile?.insights || {}, analysis, parsedData.source);
      
      await db.collection('soul_profiles').updateOne(
        { user_id: user.id },
        { 
          $set: { insights: updatedInsights, updated_at: new Date() },
          $push: { import_history: { import_id: importId, source: parsedData.source, analyzed_at: new Date() } }
        },
        { upsert: true }
      );

      // Invalidate system prompt cache
      invalidateSystemPromptCache(user.id);
    }

    // Clean up temp files and database records
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await db.collection('chunked_uploads').deleteOne({ id: uploadId });

    return ok({
      success: true,
      importId,
      analysis: analysis.error ? { summary: 'Import completed but analysis had issues.' } : analysis,
      stats: {
        source: parsedData.source,
        messagesExtracted: messages.length,
        messagesAnalyzed: Math.min(messages.length, 200),
      }
    });

  } catch (e) {
    console.error('Upload complete error:', e);
    
    // Clean up on error
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await db.collection('upload_chunks').deleteMany({ upload_id: uploadId }).catch(() => {});
    await db.collection('chunked_uploads').updateOne(
      { id: uploadId },
      { $set: { status: 'error', error: e.message } }
    );
    
    return err(`Processing failed: ${e.message}`, 500);
  }
}

// Helper function to extract messages from ZIP file using yauzl (memory efficient)
async function extractMessagesFromZip(zipPath, source) {
  const messages = [];
  const MAX_FILES = 100; // Limit files to process (increased for split files)
  const MAX_MESSAGES = 1000; // Stop once we have enough messages
  
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('Failed to open ZIP:', err);
        return reject(new Error(`Failed to open ZIP: ${err.message}`));
      }
      
      let filesProcessed = 0;
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        const fileName = entry.fileName.toLowerCase();
        const originalName = entry.fileName;
        
        // Skip if we have enough data
        if (messages.length >= MAX_MESSAGES || filesProcessed >= MAX_FILES) {
          zipfile.close();
          return;
        }
        
        // Skip directories and non-JSON files
        if (/\/$/.test(entry.fileName) || !fileName.endsWith('.json')) {
          zipfile.readEntry();
          return;
        }
        
        // Skip obviously non-conversation files
        if (fileName.includes('model_comparisons') || 
            fileName.includes('shared_conversations') ||
            fileName.includes('user_info') ||
            fileName.includes('settings')) {
          zipfile.readEntry();
          return;
        }
        
        // Prioritize conversation files (including split format)
        const isConversationFile = fileName.includes('conversation') || 
                                   /conversations-\d+\.json$/.test(originalName);
        
        filesProcessed++;
        
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            console.log(`Error reading ${fileName}:`, err.message);
            zipfile.readEntry();
            return;
          }
          
          const chunks = [];
          let totalSize = 0;
          const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max per file (increased for split files)
          
          readStream.on('data', (chunk) => {
            totalSize += chunk.length;
            if (totalSize <= MAX_FILE_SIZE) {
              chunks.push(chunk);
            }
          });
          
          readStream.on('end', () => {
            try {
              const content = Buffer.concat(chunks).toString('utf8');
              const data = JSON.parse(content);
              
              // Extract messages based on source type
              if (source === 'chatgpt' || isConversationFile) {
                extractChatGPTMessages(data, messages);
              } else if (source === 'facebook' || fileName.includes('message') || fileName.includes('inbox')) {
                extractFacebookMessages(data, messages);
              } else {
                // Try both formats
                extractChatGPTMessages(data, messages);
                extractFacebookMessages(data, messages);
              }
              
              console.log(`Processed ${originalName}: now have ${messages.length} messages`);
            } catch (parseErr) {
              console.log(`Skipping ${originalName}: invalid JSON`);
            }
            
            zipfile.readEntry();
          });
          
          readStream.on('error', (err) => {
            console.log(`Stream error for ${fileName}:`, err.message);
            zipfile.readEntry();
          });
        });
      });
      
      zipfile.on('end', () => {
        console.log(`ZIP processing complete. Processed ${filesProcessed} files, extracted ${messages.length} messages`);
        
        // Remove duplicates and clean
        const uniqueMessages = [...new Set(messages)]
          .filter(m => m && m.length > 10 && m.length < 5000)
          .map(m => m.trim().substring(0, 2000));
        
        resolve(uniqueMessages);
      });
      
      zipfile.on('error', (err) => {
        console.error('ZIP error:', err);
        reject(new Error(`ZIP processing error: ${err.message}`));
      });
    });
  });
}

// Extract messages from ChatGPT export format
function extractChatGPTMessages(data, messages) {
  // Handle array of conversations
  if (Array.isArray(data)) {
    for (const conv of data) {
      extractChatGPTMessages(conv, messages);
    }
    return;
  }
  
  // Handle single conversation object
  if (data.mapping) {
    // New ChatGPT export format with mapping
    for (const [, node] of Object.entries(data.mapping)) {
      if (node.message?.content?.parts) {
        for (const part of node.message.content.parts) {
          if (typeof part === 'string' && part.length > 10) {
            messages.push(part);
          }
        }
      }
      // Also check for text field
      if (node.message?.content?.text && typeof node.message.content.text === 'string') {
        messages.push(node.message.content.text);
      }
    }
  }
  
  // Handle older format with messages array
  if (data.messages && Array.isArray(data.messages)) {
    for (const msg of data.messages) {
      if (msg.content?.parts) {
        for (const part of msg.content.parts) {
          if (typeof part === 'string' && part.length > 10) {
            messages.push(part);
          }
        }
      }
      if (msg.text && typeof msg.text === 'string' && msg.text.length > 10) {
        messages.push(msg.text);
      }
    }
  }
  
  // Handle conversation_turns format
  if (data.conversation_turns && Array.isArray(data.conversation_turns)) {
    for (const turn of data.conversation_turns) {
      if (turn.content && typeof turn.content === 'string' && turn.content.length > 10) {
        messages.push(turn.content);
      }
    }
  }
}

// Extract messages from Facebook export format
function extractFacebookMessages(data, messages) {
  // Handle messages array
  if (data.messages && Array.isArray(data.messages)) {
    for (const msg of data.messages) {
      if (msg.content && typeof msg.content === 'string' && msg.content.length > 10) {
        messages.push(decodeUTF8(msg.content));
      }
    }
  }
  
  // Handle participants format
  if (data.participants && data.messages) {
    // This is likely a conversation export
    for (const msg of (data.messages || [])) {
      if (msg.content && typeof msg.content === 'string') {
        messages.push(decodeUTF8(msg.content));
      }
    }
  }
  
  // Handle nested structure
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.content && typeof item.content === 'string') {
        messages.push(decodeUTF8(item.content));
      }
      if (item.messages) {
        extractFacebookMessages(item, messages);
      }
    }
  }
}

// Decode Facebook's UTF-8 encoded strings
function decodeUTF8(str) {
  if (!str) return '';
  try {
    // Facebook encodes special characters as \u00XX sequences
    return str.replace(/\\u00([0-9a-fA-F]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  } catch {
    return str;
  }
}

// Handle data import (small files - direct upload, kept for backward compatibility)
async function handleDataImportUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const source = formData.get('source') || 'unknown'; // 'chatgpt' or 'facebook'
    
    if (!file) return err('No file provided');
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || 'upload.zip';
    
    // Validate it's a ZIP
    if (!filename.toLowerCase().endsWith('.zip')) {
      return err('Please upload a ZIP file');
    }
    
    const db = await getDb();
    const uploadId = uuidv4();
    
    // Create upload record
    await db.collection('data_imports').insertOne({
      id: uploadId,
      user_id: user.id,
      filename,
      source,
      status: 'processing',
      file_size: buffer.length,
      created_at: new Date(),
    });

    // Parse based on source
    let parsedData;
    if (source === 'chatgpt') {
      parsedData = await parseChatGPTExport(buffer);
    } else if (source === 'facebook') {
      parsedData = await parseFacebookExport(buffer);
    } else {
      // Try to auto-detect
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
        return err('Could not detect data format. Please specify if this is ChatGPT or Facebook data.');
      }
    }

    // Update with parsed stats
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

    // Analyze communication style
    const analysis = await analyzeCommmunicationStyle(parsedData);
    
    if (analysis.error) {
      await db.collection('data_imports').updateOne(
        { id: uploadId },
        { $set: { status: 'error', error: analysis.error } }
      );
      return err(`Analysis failed: ${analysis.error}`);
    }

    // Save analysis results
    await db.collection('data_imports').updateOne(
      { id: uploadId },
      { $set: { 
        status: 'complete',
        analysis,
        completed_at: new Date(),
      } }
    );

    // Update user's soul profile with aggregated insights
    const existingProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
    const updatedInsights = mergeInsights(existingProfile?.insights || {}, analysis, parsedData.source);
    
    await db.collection('soul_profiles').updateOne(
      { user_id: user.id },
      { 
        $set: { 
          insights: updatedInsights,
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

    // Invalidate system prompt cache so both web and Telegram get updated profile
    invalidateSystemPromptCache(user.id);

    // Raw data is NOT stored - only the analysis results
    // The ZIP buffer is already garbage collected after this function

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

// Merge new insights with existing profile
function mergeInsights(existing, newAnalysis, source) {
  const updated = { ...existing };
  
  // Add or update communication style
  updated.communicationStyle = updated.communicationStyle || {};
  updated.communicationStyle[source] = newAnalysis.communicationStyle;
  
  // Merge interests (dedupe)
  const existingInterests = updated.interests || [];
  const newInterests = newAnalysis.interests || [];
  updated.interests = [...new Set([...existingInterests, ...newInterests])].slice(0, 20);
  
  // Add insights
  updated.insights = updated.insights || [];
  updated.insights = [...(newAnalysis.insights || []), ...updated.insights].slice(0, 15);
  
  // Vocabulary
  updated.vocabulary = updated.vocabulary || {};
  updated.vocabulary[source] = newAnalysis.vocabulary;
  
  // Question style
  updated.questionStyle = updated.questionStyle || {};
  updated.questionStyle[source] = newAnalysis.questionStyle;
  
  // Latest summary
  updated.latestSummary = newAnalysis.summary;
  updated.sources = [...new Set([...(updated.sources || []), source])];
  
  return updated;
}

// Get user's data imports and soul profile
async function handleGetDataImports(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  
  // Get all imports for this user
  const imports = await db.collection('data_imports')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();
  
  // Get soul profile
  const soulProfile = await db.collection('soul_profiles').findOne({ user_id: user.id });
  
  return ok({
    imports: imports.map(i => {
      const stats = i.parsed_stats || {};
      // If stats show 0 but analysis completed, flag it
      if ((!stats.messageCount && !stats.conversationCount) && i.analysis) {
        const a = i.analysis;
        if (a.interests?.length > 0 || a.communicationStyle || a.summary) {
          stats.analyzed = true;
        }
      }
      return {
        id: i.id,
        source: stats.source || i.source,
        status: i.status,
        stats,
        analysis: i.analysis,
        created_at: i.created_at,
        completed_at: i.completed_at,
      };
    }),
    soulProfile: soulProfile?.insights || null,
  });
}

// Delete a specific import (keeps the analysis in soul profile)
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

// ============================================================


export {
  handleChunkedUploadInit,
  handleChunkedUploadChunk,
  handleChunkedUploadComplete,
  extractMessagesFromZip,
  extractChatGPTMessages,
  extractFacebookMessages,
  decodeUTF8,
  handleDataImportUpload,
  mergeInsights,
  handleGetDataImports,
  handleDeleteDataImport,
};
