/**
 * Extracted data import handlers (client-side processed imports)
 * Extracted from the main catch-all route.js for maintainability.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err } from '@/lib/api-utils';
import { extractMemoriesFromImport } from '@/lib/handlers/cloud-import';
import { invalidateSystemPromptCache } from '@/lib/handlers/chat-cache';

async function handleImportExtracted(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { type, messages, posts } = body;

  if (!messages || !Array.isArray(messages)) {
    return err('Messages array required');
  }

  const db = await getDb();
  const importId = uuidv4();

  await db.collection('import_jobs').insertOne({
    id: importId,
    user_id: user.id,
    type: type || 'chatgpt',
    source: 'extracted',
    status: 'processing',
    progress: 10,
    message: 'Processing extracted data...',
    messages_count: 0,
    created_at: new Date(),
  });

  processExtractedImport(db, user.id, importId, type, messages, posts || []).catch(importErr => {
    console.error('[ExtractedImport] Error:', importErr);
    db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status: 'failed', error: importErr.message } }
    );
  });

  return ok({ success: true, importId });
}

async function processExtractedImport(db, userId, importId, importType, messages, posts) {
  const updateStatus = async (status, message, progress, extra = {}) => {
    await db.collection('import_jobs').updateOne(
      { id: importId },
      { $set: { status, message, progress, ...extra, updated_at: new Date() } }
    );
  };

  try {
    await updateStatus('processing', 'Deduplicating messages...', 20);

    const hashMessage = (m) => {
      const str = `${m.content}|${m.role}|${m.timestamp || ''}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash.toString(16);
    };

    const messagesWithHash = messages.map(m => ({
      ...m,
      content_hash: hashMessage(m)
    }));

    const existingMsgs = await db.collection('imported_messages')
      .find({ user_id: userId })
      .project({ content_hash: 1 })
      .toArray();
    const existingHashes = new Set(existingMsgs.map(m => m.content_hash));

    const newMessages = messagesWithHash.filter(m => !existingHashes.has(m.content_hash));

    await updateStatus('processing', `Importing ${newMessages.length} new messages...`, 40);

    if (newMessages.length > 0) {
      const docs = newMessages.map(m => ({
        id: uuidv4(),
        user_id: userId,
        content: m.content,
        role: m.role,
        timestamp: m.timestamp,
        source: importType,
        content_hash: m.content_hash,
        conversation_id: m.conversation_id,
        conversation_title: m.conversation_title,
        sender: m.sender,
        imported_at: new Date(),
      }));

      const batchSize = 1000;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        await db.collection('imported_messages').insertMany(batch);
      }
    }

    if (posts && posts.length > 0) {
      const postDocs = posts.map(p => ({
        id: uuidv4(),
        user_id: userId,
        content: p.content,
        timestamp: p.timestamp,
        source: importType,
        imported_at: new Date(),
      }));
      await db.collection('imported_posts').insertMany(postDocs);
    }

    await updateStatus('processing', 'Analyzing communication patterns...', 60);

    const dataImportId = uuidv4();
    await db.collection('data_imports').insertOne({
      id: dataImportId,
      user_id: userId,
      source: importType,
      status: 'processing',
      stats: {
        source: importType,
        conversationCount: new Set(messages.filter(m => m.conversation_id).map(m => m.conversation_id)).size,
        messageCount: newMessages.length,
        postCount: posts?.length || 0
      },
      created_at: new Date(),
    });

    let analysis = null;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_KEY && newMessages.length > 0) {
      try {
        const userMsgs = newMessages
          .filter(m => m.role === 'user' || m.role === 'human')
          .slice(0, 50)
          .map(m => m.content)
          .join('\n---\n');

        if (userMsgs.length > 100) {
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
                  content: `Analyze this user's conversation history and create a personality/communication profile.
Return JSON with:
{
  "summary": "2-3 sentence summary of the person",
  "communicationStyle": {"formality": "formal/casual/mixed", "verbosity": "detailed/concise/balanced", "tone": "analytical/supportive/direct/friendly"},
  "interests": ["interest1", "interest2", ...],
  "vocabulary": {"complexity": "sophisticated/moderate/simple", "uniquePhrases": [], "emoji_usage": "frequent/occasional/none"},
  "questionStyle": "direct/context-heavy/exploratory",
  "insights": ["insight1", "insight2", "insight3"]
}`
                },
                {
                  role: 'user',
                  content: `Analyze these ${importType} messages:\n\n${userMsgs.substring(0, 15000)}`
                }
              ],
              temperature: 0.3,
              max_tokens: 1500,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              analysis = JSON.parse(jsonMatch[0]);
            }
          }
        }
      } catch (e) {
        console.error('[ExtractedImport] Analysis error:', e);
      }
    }

    await db.collection('data_imports').updateOne(
      { id: dataImportId },
      { $set: { status: 'complete', analysis, completed_at: new Date() } }
    );

    await updateStatus('processing', 'Extracting memories...', 80);

    const memoriesAdded = await extractMemoriesFromImport(db, userId, newMessages, importType);

    if (analysis) {
      await db.collection('soul_profiles').updateOne(
        { user_id: userId },
        {
          $set: {
            insights: {
              communicationStyle: analysis.communicationStyle,
              vocabulary: analysis.vocabulary
            },
            updated_at: new Date()
          },
          $addToSet: {
            interests: { $each: analysis.interests || [] }
          }
        },
        { upsert: true }
      );
    }

    invalidateSystemPromptCache(userId);

    await updateStatus('completed', 
      `Successfully imported ${newMessages.length} messages${memoriesAdded > 0 ? ` and added ${memoriesAdded} memories` : ''}!`, 
      100, 
      { messages_count: newMessages.length, memories_added: memoriesAdded }
    );

  } catch (error) {
    console.error('[ExtractedImport] Processing error:', error);
    await updateStatus('failed', error.message, 0, { error: error.message });
    throw error;
  }
}

export {
  handleImportExtracted,
  processExtractedImport,
};
