/**
 * CONVERSATION EXPORT HANDLER
 * Exports chat conversations as CSV or Excel files
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { authenticate } from '@/lib/api-utils';

/**
 * GET /api/conversations/export
 * Export a conversation as CSV or Excel
 */
export async function handleConversationExport(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const format = searchParams.get('format') || 'csv'; // csv or xlsx
    
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const db = await getDb();
    
    // Get conversation
    const conversation = await db.collection('conversations').findOne({ 
      id: conversationId,
      user_id: user.id 
    });
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get all messages in the conversation
    const messages = await db.collection('messages')
      .find({ conversation_id: conversationId })
      .sort({ created_at: 1 })
      .toArray();

    // Format data for export
    const exportData = [
      ['Timestamp', 'Role', 'Content', 'Model'],
      ...messages.map(msg => [
        msg.created_at ? new Date(msg.created_at).toISOString() : '',
        msg.role || '',
        msg.content || '',
        msg.model_used || msg.model || ''
      ])
    ];

    if (format === 'csv') {
      // Generate CSV
      const csvContent = exportData
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      
      const fileName = `conversation_${conversationId}_${Date.now()}.csv`;
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    } else {
      // Generate Excel using the document generator
      const XLSX = require('xlsx');
      
      const worksheet = XLSX.utils.aoa_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Conversation');
      
      const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const fileName = `conversation_${conversationId}_${Date.now()}.xlsx`;
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    }

  } catch (error) {
    console.error('[ConversationExport] Error:', error);
    return NextResponse.json({ 
      error: 'Export failed', 
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/conversations/export-all
 * Export all conversations for a user as a single file
 */
export async function handleAllConversationsExport(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    
    const db = await getDb();
    
    // Get all conversations for user
    const conversations = await db.collection('conversations')
      .find({ user_id: user.id })
      .sort({ updated_at: -1 })
      .toArray();

    // Get all messages for all conversations
    const conversationIds = conversations.map(c => c.id);
    const allMessages = await db.collection('messages')
      .find({ conversation_id: { $in: conversationIds } })
      .sort({ conversation_id: 1, created_at: 1 })
      .toArray();

    // Create a map of conversation titles
    const convTitles = {};
    conversations.forEach(c => {
      convTitles[c.id] = c.title || 'Untitled Conversation';
    });

    // Format data for export
    const exportData = [
      ['Conversation', 'Timestamp', 'Role', 'Content', 'Model'],
      ...allMessages.map(msg => [
        convTitles[msg.conversation_id] || msg.conversation_id,
        msg.created_at ? new Date(msg.created_at).toISOString() : '',
        msg.role || '',
        msg.content || '',
        msg.model_used || msg.model || ''
      ])
    ];

    if (format === 'csv') {
      const csvContent = exportData
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      
      const fileName = `all_conversations_${Date.now()}.csv`;
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    } else {
      const XLSX = require('xlsx');
      
      const worksheet = XLSX.utils.aoa_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'All Conversations');
      
      const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const fileName = `all_conversations_${Date.now()}.xlsx`;
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    }

  } catch (error) {
    console.error('[ConversationExportAll] Error:', error);
    return NextResponse.json({ 
      error: 'Export failed', 
      details: error.message 
    }, { status: 500 });
  }
}
