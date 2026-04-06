/**
 * Import upload handlers and helpers (ChatGPT, Facebook data import)
 * Extracted from the main catch-all route.js for maintainability.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err } from '@/lib/api-utils';
import path from 'path';
import fs from 'fs';
import { writeFile, mkdir, rm } from 'fs/promises';
import yauzl from 'yauzl';
import { parseDocumentContent } from '@/lib/handlers/document-parsing';
import { extractMemoriesFromImport } from '@/lib/handlers/memory-system';
import { invalidateSystemPromptCache } from '@/lib/handlers/chat-cache';

async function parseChatGPTExport(zipBuffer) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  
  let conversations = [];
  let userMessages = [];
  
  for (const entry of entries) {
    if (entry.entryName.endsWith('conversations.json') || entry.entryName === 'conversations.json') {
      try {
        const content = entry.getData().toString('utf8');
        const data = JSON.parse(content);
        
        if (Array.isArray(data)) {
          for (const conv of data) {
            const title = conv.title || 'Untitled';
            const mapping = conv.mapping || {};
            
            for (const [, node] of Object.entries(mapping)) {
              if (node?.message?.author?.role === 'user' && node?.message?.content?.parts) {
                const text = node.message.content.parts.join(' ').trim();
                if (text && text.length > 10) {
                  userMessages.push(text);
                }
              }
            }
            conversations.push({ title, messageCount: Object.keys(mapping).length });
          }
        }
      } catch (e) {
        console.error('Error parsing conversations.json:', e.message);
      }
    }
  }
  
  return { 
    source: 'chatgpt', 
    conversationCount: conversations.length, 
    userMessageCount: userMessages.length,
    sampleMessages: userMessages.slice(0, 100), // Limit for analysis
    conversations: conversations.slice(0, 50)
  };
}

// Parse Facebook export ZIP and extract messages/posts
async function parseFacebookExport(zipBuffer) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  
  let messages = [];
  let posts = [];
  
  for (const entry of entries) {
    const name = entry.entryName.toLowerCase();
    
    // Parse messages
    if (name.includes('messages/') && name.endsWith('.json')) {
      try {
        const content = entry.getData().toString('utf8');
        const data = JSON.parse(content);
        
        if (data.messages && Array.isArray(data.messages)) {
          for (const msg of data.messages) {
            if (msg.content && msg.sender_name) {
              // Decode Facebook's encoding
              const text = decodeURIComponent(escape(msg.content));
              if (text.length > 10) {
                messages.push({ text, sender: msg.sender_name });
              }
            }
          }
        }
      } catch (e) { /* skip invalid files */ }
    }
    
    // Parse posts
    if ((name.includes('posts/') || name.includes('your_posts')) && name.endsWith('.json')) {
      try {
        const content = entry.getData().toString('utf8');
        const data = JSON.parse(content);
        
        const postArray = Array.isArray(data) ? data : (data.posts || data.status_updates || []);
        for (const post of postArray) {
          const text = post.data?.[0]?.post || post.post || post.title || '';
          if (text && text.length > 10) {
            posts.push(decodeURIComponent(escape(text)));
          }
        }
      } catch (e) { /* skip invalid files */ }
    }
  }
  
  return {
    source: 'facebook',
    messageCount: messages.length,
    postCount: posts.length,
    sampleMessages: messages.slice(0, 100),
    samplePosts: posts.slice(0, 50)
  };
}

// Analyze communication style using LLM
async function analyzeCommmunicationStyle(parsedData, existingProfile = null) {
  const provider = getProvider('openai', 'gpt-4o-mini');
  
  let sampleText = '';
  // Handle both sampleMessages (from full parsing) and userMessages (from batch processing)
  const messages = parsedData.sampleMessages || parsedData.userMessages || [];
  const posts = parsedData.samplePosts || [];
  
  if (parsedData.source === 'chatgpt' || parsedData.source === 'unknown') {
    sampleText = messages.slice(0, 50).join('\n---\n');
  } else if (parsedData.source === 'facebook') {
    const msgTexts = messages.slice(0, 30).map(m => typeof m === 'string' ? m : m.text).filter(Boolean).join('\n---\n');
    const postTexts = posts.slice(0, 20).join('\n---\n');
    sampleText = `MESSAGES:\n${msgTexts}\n\nPOSTS:\n${postTexts}`;
  }
  
  if (!sampleText || sampleText.length < 50) {
    return { error: 'Not enough data to analyze. Please ensure your export contains conversation history.' };
  }
  
  const analysisPrompt = `Analyze the following user-written content and extract insights about their communication style and personality. This is from their ${parsedData.source === 'chatgpt' ? 'ChatGPT conversation history' : 'Facebook messages and posts'}.

CONTENT TO ANALYZE:
${sampleText.substring(0, 12000)}

Provide a JSON response with the following structure:
{
  "summary": "A 2-3 sentence friendly summary of what you learned about this person",
  "communicationStyle": {
    "formality": "formal/casual/mixed",
    "verbosity": "concise/detailed/balanced",
    "tone": "analytical/emotional/supportive/humorous/direct/mixed",
    "description": "Brief description of their communication style"
  },
  "interests": ["list", "of", "topics", "they", "discuss", "often"],
  "vocabulary": {
    "complexity": "simple/moderate/sophisticated",
    "uniquePhrases": ["any", "distinctive", "phrases", "they", "use"],
    "emoji_usage": "frequent/occasional/rare/none"
  },
  "questionStyle": "How they tend to ask questions (direct, context-heavy, etc)",
  "insights": [
    "Specific insight 1 about their personality or preferences",
    "Specific insight 2",
    "Specific insight 3"
  ]
}

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await provider.generateChatCompletion({
      systemPrompt: 'You are an expert at analyzing communication patterns and personality from text. Return only valid JSON.',
      messages: [{ role: 'user', content: analysisPrompt }],
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });
    
    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { error: 'Could not parse analysis' };
  } catch (e) {
    console.error('Analysis error:', e);
    return { error: e.message };
  }
}

// ============================================================
// Detect URLs in text
// ============================================================
// GOOGLE PLACES API
// ============================================================

const PLACE_TYPES = {
  restaurant: 'restaurant',
  restaurants: 'restaurant',
  food: 'restaurant',
  cafe: 'cafe',
  coffee: 'cafe',
  bar: 'bar',
  bars: 'bar',
  pub: 'bar',
  hotel: 'lodging',
  hotels: 'lodging',
  lodging: 'lodging',
  gas: 'gas_station',
  gasstation: 'gas_station',
  fuel: 'gas_station',
  pharmacy: 'pharmacy',
  hospital: 'hospital',
  doctor: 'doctor',
  dentist: 'dentist',
  gym: 'gym',
  fitness: 'gym',
  bank: 'bank',
  atm: 'atm',
  grocery: 'supermarket',
  supermarket: 'supermarket',
  store: 'store',
  shopping: 'shopping_mall',
  mall: 'shopping_mall',
  park: 'park',
  museum: 'museum',
  library: 'library',
  movie: 'movie_theater',
  movies: 'movie_theater',
  cinema: 'movie_theater',
  cinemas: 'movie_theater',
  theater: 'movie_theater',
  theaters: 'movie_theater',
  'movie theater': 'movie_theater',
  'movie theaters': 'movie_theater',
  parking: 'parking',
  airport: 'airport',
  trainstation: 'train_station',
  busstation: 'bus_station',
  subway: 'subway_station',
  church: 'church',
  mosque: 'mosque',
  temple: 'hindu_temple',
  synagogue: 'synagogue',
  school: 'school',
  university: 'university',
  spa: 'spa',
  salon: 'beauty_salon',
  haircut: 'hair_care',
  laundry: 'laundry',
  carwash: 'car_wash',
  mechanic: 'car_repair',
};

// Geocode an address to coordinates
// Get location from IP address (automatic, no user action required)

async function handleImportUpload(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  await ensureUploadsDir();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const importType = formData.get('type') || 'chatgpt';

    if (!file) return err('No file provided');

    const fileName = `${user.id}_${Date.now()}_${file.name}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const db = await getDb();
    const jobId = uuidv4();
    await db.collection('import_jobs').insertOne({
      id: jobId,
      user_id: user.id,
      type: importType,
      status: 'processing',
      file_path: filePath,
      file_name: file.name,
      error: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Process in background (non-blocking)
    processImportJob(jobId, user.id, importType, filePath, buffer).catch(console.error);

    return ok({ jobId, status: 'processing' });
  } catch (error) {
    return err(`Upload failed: ${error.message}`, 500);
  }
}

async function processImportJob(jobId, userId, importType, filePath, buffer) {
  const db = await getDb();
  try {
    let extractedText = '';
    const fileName = filePath.toLowerCase();
    let detectedType = importType;

    if (fileName.endsWith('.zip')) {
      try {
        const AdmZip = (await import('adm-zip')).default;
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        const entryNames = entries.map(e => e.entryName.toLowerCase());
        
        // Auto-detect format from file structure
        if (importType === 'auto' || !importType) {
          if (entryNames.some(n => n.includes('conversations.json') || n.includes('model_comparisons'))) {
            detectedType = 'chatgpt';
          } else if (entryNames.some(n => n.includes('messages/inbox/') || n.includes('your_posts') || n.includes('message_1.json'))) {
            detectedType = 'facebook';
          } else if (entryNames.some(n => n.includes('claude') && n.endsWith('.json'))) {
            detectedType = 'claude';
          } else if (entryNames.some(n => n.includes('takeout') || n.includes('my activity') || n.includes('gemini'))) {
            detectedType = 'google';
          } else {
            detectedType = 'auto'; // Will try all formats
          }
        }
        
        console.log(`[Import] Processing ${jobId}, detected type: ${detectedType}, entries: ${entries.length}`);
        
        for (const entry of entries) {
          if (!entry.isDirectory) {
            const name = entry.entryName.toLowerCase();
            if (name.endsWith('.json') || name.endsWith('.html') || name.endsWith('.txt')) {
              const content = entry.getData().toString('utf8');
              if (name.endsWith('.json')) {
                try {
                  const parsed = JSON.parse(content);
                  extractedText += extractTextFromJson(parsed, detectedType) + '\n\n';
                } catch { extractedText += content.slice(0, 5000) + '\n\n'; }
              } else {
                extractedText += content.replace(/<[^>]+>/g, ' ').slice(0, 5000) + '\n\n';
              }
              if (extractedText.length > 50000) break;
            }
          }
        }
      } catch (e) {
        extractedText = 'Could not extract zip: ' + e.message;
      }
    } else if (fileName.endsWith('.json')) {
      try {
        const parsed = JSON.parse(buffer.toString('utf8'));
        extractedText = extractTextFromJson(parsed, importType);
      } catch {
        extractedText = buffer.toString('utf8').slice(0, 50000);
      }
    } else {
      extractedText = buffer.toString('utf8').slice(0, 50000);
    }

    // Chunk text
    const chunkSize = 2000;
    const chunks = [];
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      chunks.push(extractedText.slice(i, i + chunkSize));
    }

    // Store chunks
    for (const chunkText of chunks.slice(0, 25)) {
      await db.collection('source_corpus_chunks').insertOne({
        id: uuidv4(),
        user_id: userId,
        import_job_id: jobId,
        chunk_text: chunkText,
        metadata: { type: importType },
        created_at: new Date(),
      });
    }

    // Generate soul profile summary using LLM
    let soulSummary = '';
    if (extractedText.length > 100) {
      try {
        const provider = getProvider('hosted', 'gpt-4o-mini');
        soulSummary = await provider.generateChatCompletion({
          systemPrompt: `You are analyzing personal data exports to understand someone's communication style, personality, and preferences. Be concise and insightful.`,
          messages: [{
            role: 'user',
            content: `Based on this data export (type: ${importType}), create a brief soul profile summary (200-300 words) covering:
1. Communication style and tone
2. Main interests and recurring topics
3. Work/life patterns and goals
4. Personality traits visible from their messages
5. What they seem to value most

Data sample:
${extractedText.slice(0, 8000)}`,
          }],
          model: 'gpt-4o-mini',
          temperature: 0.5,
        });
      } catch (e) {
        soulSummary = 'Could not generate summary: ' + e.message;
      }
    }

    // Update profile with soul summary
    if (soulSummary) {
      await db.collection('profiles').updateOne(
        { user_id: userId },
        { $set: { soul_profile_summary: soulSummary, soul_profile_updated_at: new Date() } }
      );
    }

    // PRIVACY: Delete the raw imported data - we only keep the insights
    // Delete chunks (which contain raw message text)
    await db.collection('import_chunks').deleteMany({ import_id: jobId });
    
    // Delete any imported messages from this import
    await db.collection('imported_messages').deleteMany({ 
      user_id: userId,
      import_id: jobId 
    });
    
    console.log(`[Import] Deleted raw data for import ${jobId} after processing - only insights retained`);

    // Mark job complete
    await db.collection('import_jobs').updateOne(
      { id: jobId },
      { $set: { 
        status: 'complete', 
        chunk_count: chunks.length, 
        updated_at: new Date(),
        raw_data_deleted: true,
        message: 'Import complete. Raw messages deleted - only insights retained for your SoulPrint.'
      } }
    );
  } catch (error) {
    await db.collection('import_jobs').updateOne(
      { id: jobId },
      { $set: { status: 'error', error: error.message, updated_at: new Date() } }
    );
  }
}

function extractTextFromJson(parsed, type) {
  let text = '';
  
  // ChatGPT format
  if (type === 'chatgpt' || type === 'auto') {
    if (Array.isArray(parsed)) {
      for (const conv of parsed.slice(0, 20)) {
        if (conv.mapping) {
          for (const node of Object.values(conv.mapping)) {
            const msg = node?.message;
            if (msg?.content?.parts) {
              const role = msg.author?.role || 'unknown';
              const content = msg.content.parts.filter(p => typeof p === 'string').join(' ');
              if (content.trim()) text += `[${role}]: ${content.slice(0, 500)}\n`;
            }
          }
        }
      }
    }
  }
  
  // Facebook Messenger format
  if ((type === 'facebook' || type === 'auto') && !text) {
    // Facebook messages are usually in format: { participants: [], messages: [] }
    if (parsed.messages && Array.isArray(parsed.messages)) {
      for (const msg of parsed.messages.slice(0, 100)) {
        const sender = msg.sender_name || 'Unknown';
        const content = msg.content || '';
        if (content.trim()) {
          text += `[${sender}]: ${content.slice(0, 500)}\n`;
        }
      }
    }
    // Or it could be an array of message objects
    if (Array.isArray(parsed) && parsed[0]?.content) {
      for (const msg of parsed.slice(0, 100)) {
        const sender = msg.sender_name || msg.sender || 'Unknown';
        const content = msg.content || msg.text || '';
        if (content.trim()) {
          text += `[${sender}]: ${content.slice(0, 500)}\n`;
        }
      }
    }
  }
  
  // Claude format
  if ((type === 'claude' || type === 'auto') && !text) {
    if (parsed.chat_messages && Array.isArray(parsed.chat_messages)) {
      for (const msg of parsed.chat_messages.slice(0, 100)) {
        const role = msg.sender === 'human' ? 'user' : 'assistant';
        const content = msg.text || '';
        if (content.trim()) {
          text += `[${role}]: ${content.slice(0, 500)}\n`;
        }
      }
    }
  }
  
  // Generic extraction for unknown formats
  if (!text) {
    // Try to find any messages array
    const findMessages = (obj, depth = 0) => {
      if (depth > 5 || text.length > 30000) return;
      if (Array.isArray(obj)) {
        for (const item of obj.slice(0, 50)) {
          if (item.content || item.text || item.message) {
            const content = item.content || item.text || item.message;
            const role = item.role || item.sender || item.sender_name || 'unknown';
            if (typeof content === 'string' && content.trim()) {
              text += `[${role}]: ${content.slice(0, 500)}\n`;
            }
          }
          if (typeof item === 'object') findMessages(item, depth + 1);
        }
      } else if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (key === 'messages' || key === 'chat_messages' || key === 'mapping') {
            findMessages(obj[key], depth + 1);
          }
        }
      }
    };
    findMessages(parsed);
  }
  
  return text || JSON.stringify(parsed).slice(0, 50000);
}

// IMPORTS - Get user imports
async function handleGetImports(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const db = await getDb();
  const imports = await db.collection('import_jobs')
    .find({ user_id: user.id })
    .sort({ created_at: -1 })
    .toArray();

  return ok(imports.map(i => ({
    id: i.id,
    type: i.type,
    status: i.status,
    file_name: i.file_name,
    error: i.error,
    chunk_count: i.chunk_count,
    created_at: i.created_at,
    updated_at: i.updated_at,
  })));
}

// ============================================================
// ADMIN HANDLERS
// ============================================================




// ADMIN - Create new user

// ADMIN - Delete user

// ADMIN - Get detailed user info




export {
  parseChatGPTExport,
  parseFacebookExport,
  analyzeCommmunicationStyle,
  handleImportUpload,
  processImportJob,
  extractTextFromJson,
  handleGetImports,
};
