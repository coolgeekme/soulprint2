'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Cloud, Link2, HardDrive, AlertCircle, FileArchive, Newspaper, Loader2, Check, Globe, ChevronRight, ExternalLink, Search, Upload, CheckCircle2, Shield, Sparkles, Zap } from 'lucide-react';
import { CloudUploadIcon } from '@/components/icons/SoulPrintIcons';

// ── CloudImportModal: Universal Import with Auto-Detection ──────────────────
function CloudImportModal({ onClose, token, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [detectedPlatform, setDetectedPlatform] = useState(null);
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const getTotalSize = () => selectedFiles.reduce((sum, f) => sum + f.size, 0);

  // Upload large file in chunks for server-side processing
  // Upload large files using disk-based chunked upload (more reliable for GB-sized files)
  const uploadLargeFileForImport = async (file, onProgress, onStatus) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for faster upload
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const MAX_RETRIES = 3;
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    
    console.log(`[LargeUpload] Starting upload: ${file.name} (${fileSizeMB} MB, ${totalChunks} chunks)`);
    onStatus?.(`Preparing upload of ${fileSizeMB} MB file...`);
    
    // Step 1: Initialize upload session using disk-based storage
    let initRes;
    try {
      initRes = await fetch('/api/import/chunked/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          filename: file.name, 
          fileSize: file.size, 
          totalChunks,
          type: 'chatgpt'
        }),
      });
    } catch (networkErr) {
      console.error('[LargeUpload] Network error during init:', networkErr);
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      console.error('[LargeUpload] Init failed:', errData);
      throw new Error(errData.error || 'Failed to start upload. Please try again.');
    }
    
    const { uploadId } = await initRes.json();
    console.log(`[LargeUpload] Upload session created: ${uploadId}`);
    onProgress(2);
    
    // Step 2: Upload chunks with retry logic
    let uploadedBytes = 0;
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkSizeMB = ((end - start) / (1024 * 1024)).toFixed(1);
      
      let retries = 0;
      let success = false;
      
      while (retries < MAX_RETRIES && !success) {
        try {
          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', i.toString());
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout for large chunks
          
          const chunkRes = await fetch('/api/import/chunked/chunk', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (chunkRes.ok) {
            success = true;
            uploadedBytes += (end - start);
            const uploadedMB = (uploadedBytes / (1024 * 1024)).toFixed(1);
            onStatus?.(`Uploaded ${uploadedMB} MB of ${fileSizeMB} MB...`);
          } else {
            const errData = await chunkRes.json().catch(() => ({}));
            throw new Error(errData.error || `Chunk ${i+1} failed`);
          }
        } catch (chunkErr) {
          retries++;
          console.warn(`[LargeUpload] Chunk ${i+1}/${totalChunks} failed (attempt ${retries}):`, chunkErr.message);
          
          if (retries < MAX_RETRIES) {
            const waitTime = 2000 * retries;
            onStatus?.(`Upload interrupted, retrying in ${waitTime/1000}s...`);
            await new Promise(r => setTimeout(r, waitTime));
          } else {
            const progressPct = Math.round((i / totalChunks) * 100);
            throw new Error(`Upload failed at ${progressPct}% (${(uploadedBytes / (1024 * 1024)).toFixed(1)} MB uploaded). ${chunkErr.message || 'Please check your connection and try again.'}`);
          }
        }
      }
      
      // Progress: chunks take 2-85%, processing takes 85-100%
      const progressPct = 2 + Math.round(((i + 1) / totalChunks) * 83);
      onProgress(progressPct);
    }
    
    console.log(`[LargeUpload] All ${totalChunks} chunks uploaded successfully`);
    onStatus?.('Processing your data...');
    onProgress(87);
    
    // Step 3: Process the uploaded file
    const processRes = await fetch('/api/import/chunked/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        uploads: [{ uploadId, fileName: file.name }],
        type: 'chatgpt'
      }),
    });
    
    if (!processRes.ok) {
      const errData = await processRes.json().catch(() => ({}));
      console.error('[LargeUpload] Processing failed:', errData);
      throw new Error(errData.error || 'Processing failed. Your file was uploaded but could not be processed.');
    }
    
    const result = await processRes.json();
    console.log(`[LargeUpload] Processing started:`, result);
    onProgress(95);
    
    // Return the import job ID for status tracking
    return result;
  };

  // Auto-detect platform and extract data from ZIP file
  const extractFromZip = async (file) => {
    try {
      // Check file size - warn for very large files
      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`Processing ZIP file: ${fileSizeMB.toFixed(1)} MB`);
      
      if (fileSizeMB > 500) {
        console.warn('Large file detected, processing may take a while...');
      }
      
      const JSZip = (await import('jszip')).default;
      
      // Load the ZIP with timeout protection
      let zip;
      try {
        zip = await Promise.race([
          JSZip.loadAsync(file),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('ZIP loading timed out. File may be too large for browser processing.')), 120000)
          )
        ]);
      } catch (loadErr) {
        console.error('Failed to load ZIP:', loadErr);
        throw new Error(`Failed to open ZIP file: ${loadErr.message}. Try a smaller export or upload individual JSON files.`);
      }
      
      const allFiles = Object.keys(zip.files);
      const messages = [];
      const posts = [];
      let platform = 'unknown';

    // ── Detect ChatGPT ──
    const hasChatGPT = allFiles.some(f => 
      f.includes('conversations.json') || 
      f.includes('chat.html') ||
      f.includes('model_comparisons') ||
      /conversations-\d+\.json$/.test(f)
    );

    // ── Detect Facebook ──
    const hasFacebook = allFiles.some(f => 
      f.includes('messages/inbox/') || 
      f.includes('your_posts') ||
      f.includes('profile_information')
    );

    // ── Detect Claude ──
    const hasClaude = allFiles.some(f => 
      f.includes('conversations') && f.endsWith('.json')
    ) && allFiles.some(f => f.includes('Claude') || f.includes('claude'));

    // ── Detect Google/Gemini ──
    const hasGoogle = allFiles.some(f => 
      f.includes('Takeout') || 
      f.includes('My Activity') ||
      f.includes('Gemini')
    );

    // Process based on detected platform
    if (hasChatGPT) {
      platform = 'ChatGPT';
      
      // Look for conversations.json or split files (conversations-000.json, etc.)
      let conversationFiles = [];
      
      // Check for single conversations.json
      let conversationsFile = zip.file('conversations.json');
      if (conversationsFile) {
        conversationFiles.push(conversationsFile);
      } else {
        // Check for nested conversations.json
        const convFile = allFiles.find(f => f.endsWith('conversations.json'));
        if (convFile) {
          conversationFiles.push(zip.file(convFile));
        }
      }
      
      // Check for split conversation files (conversations-000.json, conversations-001.json, etc.)
      const splitFiles = allFiles.filter(f => /conversations-\d+\.json$/.test(f));
      if (splitFiles.length > 0) {
        console.log('Found split conversation files:', splitFiles.length);
        for (const splitFile of splitFiles.sort()) {
          const zf = zip.file(splitFile);
          if (zf) conversationFiles.push(zf);
        }
      }
      
      console.log('Total conversation files to process:', conversationFiles.length);
      
      for (const convFileObj of conversationFiles) {
        if (!convFileObj) continue;
        try {
          const content = await convFileObj.async('string');
          const conversations = JSON.parse(content);
          const convArray = Array.isArray(conversations) ? conversations : [conversations];
          
          for (const conv of convArray) {
            // Standard ChatGPT format with mapping
            if (conv.mapping) {
              for (const nodeId in conv.mapping) {
                const node = conv.mapping[nodeId];
                if (node.message?.content?.parts?.[0]) {
                  const role = node.message.author?.role;
                  const msgContent = node.message.content.parts.join('\n');
                  if (msgContent && msgContent.trim() && (role === 'user' || role === 'assistant')) {
                    messages.push({
                      role: role === 'user' ? 'user' : 'assistant',
                      content: msgContent.trim(),
                      timestamp: node.message.create_time ? new Date(node.message.create_time * 1000).toISOString() : null,
                      conversation_id: conv.id,
                      conversation_title: conv.title,
                      source: 'chatgpt'
                    });
                  }
                }
              }
            }
            
            // Alternative format - direct messages array
            if (conv.messages && Array.isArray(conv.messages)) {
              for (const msg of conv.messages) {
                if (msg.content && (msg.role === 'user' || msg.role === 'assistant')) {
                  messages.push({
                    role: msg.role,
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                    timestamp: msg.timestamp || msg.create_time ? new Date((msg.timestamp || msg.create_time) * 1000).toISOString() : null,
                    conversation_id: conv.id || conv.conversation_id,
                    conversation_title: conv.title,
                    source: 'chatgpt'
                  });
                }
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing ChatGPT conversations file:', parseError);
        }
      }
    }
    
    if (hasFacebook) {
      platform = platform === 'unknown' ? 'Facebook' : platform + ' + Facebook';
      
      // Look for messages in inbox folder
      const messageFiles = allFiles.filter(f => 
        f.includes('messages/inbox/') && f.endsWith('.json') && !f.includes('__MACOSX')
      );
      
      for (const filePath of messageFiles) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (msg.content) {
                // Decode Facebook's UTF-8 encoding
                let decodedContent = msg.content;
                try {
                  decodedContent = decodeURIComponent(escape(msg.content));
                } catch (e) {}
                
                messages.push({
                  role: 'user', // Facebook messages are your side of conversations
                  content: decodedContent,
                  timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms).toISOString() : null,
                  sender: msg.sender_name,
                  source: 'facebook'
                });
              }
            }
          }
        } catch (e) {
          // Skip unparseable files
        }
      }

      // Look for posts
      const postFiles = allFiles.filter(f => 
        (f.includes('posts/') || f.includes('your_posts')) && f.endsWith('.json')
      );
      
      for (const filePath of postFiles) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          const postArray = Array.isArray(data) ? data : (data.posts || []);
          
          for (const post of postArray) {
            const postContent = post.data?.[0]?.post || post.post || post.message;
            if (postContent) {
              posts.push({
                content: postContent,
                timestamp: post.timestamp ? new Date(post.timestamp * 1000).toISOString() : null,
                source: 'facebook'
              });
            }
          }
        } catch (e) {
          // Skip unparseable files
        }
      }
    }

    if (hasClaude) {
      platform = platform === 'unknown' ? 'Claude' : platform + ' + Claude';
      
      const jsonFiles = allFiles.filter(f => f.endsWith('.json') && !f.includes('__MACOSX'));
      for (const filePath of jsonFiles) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          
          // Handle Claude's conversation format
          if (data.chat_messages || data.messages) {
            const msgArray = data.chat_messages || data.messages;
            for (const msg of msgArray) {
              if (msg.text || msg.content) {
                messages.push({
                  role: msg.sender === 'human' ? 'user' : 'assistant',
                  content: msg.text || msg.content,
                  timestamp: msg.created_at || msg.timestamp,
                  source: 'claude'
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    // Fallback: Try to find ANY JSON with conversation-like data
    if (messages.length === 0 && posts.length === 0) {
      platform = 'Auto-detected';
      const jsonFiles = allFiles.filter(f => f.endsWith('.json') && !f.includes('__MACOSX'));
      
      for (const filePath of jsonFiles.slice(0, 20)) {
        try {
          const content = await zip.file(filePath).async('string');
          const data = JSON.parse(content);
          
          // Look for any array of message-like objects
          const findMessages = (obj, depth = 0) => {
            if (depth > 3) return;
            if (Array.isArray(obj)) {
              for (const item of obj) {
                if (item.content || item.text || item.message) {
                  messages.push({
                    role: item.role || (item.sender === 'user' ? 'user' : 'assistant'),
                    content: item.content || item.text || item.message,
                    timestamp: item.timestamp || item.created_at,
                    source: 'auto'
                  });
                }
                if (typeof item === 'object') findMessages(item, depth + 1);
              }
            } else if (typeof obj === 'object' && obj !== null) {
              for (const key of Object.keys(obj)) {
                findMessages(obj[key], depth + 1);
              }
            }
          };
          
          findMessages(data);
        } catch (e) {}
      }
    }

    console.log(`Import: Detected ${platform}, found ${messages.length} messages, ${posts.length} posts`);
    return { messages, posts, platform };
    } catch (zipErr) {
      console.error('ZIP extraction error:', zipErr);
      // Throw a more descriptive error
      throw new Error(zipErr.message || 'Failed to read ZIP file');
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const invalidFiles = files.filter(f => !f.name.endsWith('.zip'));
    if (invalidFiles.length > 0) {
      setError('Please select only ZIP files');
      return;
    }
    
    // Clear all previous state first
    setSelectedFiles(files);
    setError('');
    setExtractedData(null);
    setDetectedPlatform(null);
    setImportStatus(null);
    
    const file = files[0];
    const fileSizeMB = file.size / (1024 * 1024);
    const fileSizeGB = fileSizeMB / 1024;
    
    console.log(`Processing file: ${file.name}, size: ${fileSizeMB.toFixed(1)} MB`);
    
    // === LARGE FILE DETECTION ===
    // For files larger than 100MB, skip client-side processing entirely
    // Browser memory cannot handle loading large ZIPs with JSZip
    const LARGE_FILE_THRESHOLD_MB = 100;
    
    if (fileSizeMB > LARGE_FILE_THRESHOLD_MB) {
      console.log(`Large file detected (${fileSizeMB.toFixed(1)} MB > ${LARGE_FILE_THRESHOLD_MB} MB), using server-side processing`);
      setImportStatus({ 
        status: 'ready', 
        message: `Large file (${fileSizeGB >= 1 ? fileSizeGB.toFixed(2) + ' GB' : fileSizeMB.toFixed(0) + ' MB'}) ready for upload. Click Import to begin.`, 
        progress: 100 
      });
      setDetectedPlatform('ChatGPT (Server Processing)');
      setExtractedData({
        messages: [],
        posts: [],
        messageCount: 0,
        totalSize: fileSizeMB,
        useServerFallback: true,
        isLargeFile: true
      });
      return;
    }
    
    setImportStatus({ status: 'extracting', message: `Reading ${file.name}...`, progress: 10 });
    
    try {
      // === Try client-side extraction (only for files under 100MB) ===
      const JSZip = (await import('jszip')).default;
      
      setImportStatus({ status: 'extracting', message: 'Opening ZIP file...', progress: 20 });
      
      const zip = await JSZip.loadAsync(file);
      const allFiles = Object.keys(zip.files);
      
      setImportStatus({ status: 'extracting', message: `Found ${allFiles.length} files, analyzing...`, progress: 30 });
      
      let messages = [];
      let platform = 'Unknown';
      
      // Check for ChatGPT format (single file OR split files)
      const chatgptFile = allFiles.find(f => f.endsWith('conversations.json'));
      const splitChatgptFiles = allFiles.filter(f => /conversations-\d+\.json$/.test(f)).sort();
      
      if (chatgptFile || splitChatgptFiles.length > 0) {
        platform = 'ChatGPT';
        const filesToProcess = chatgptFile ? [chatgptFile] : splitChatgptFiles;
        setImportStatus({ status: 'extracting', message: `Detected ChatGPT export, reading ${filesToProcess.length} file(s)...`, progress: 40 });
        
        let fileIndex = 0;
        for (const convFile of filesToProcess) {
          fileIndex++;
          const progressPct = 40 + Math.floor((fileIndex / filesToProcess.length) * 40);
          setImportStatus({ status: 'extracting', message: `Processing file ${fileIndex}/${filesToProcess.length}...`, progress: progressPct });
          
          try {
            const content = await zip.file(convFile).async('string');
            const conversations = JSON.parse(content);
            const convArray = Array.isArray(conversations) ? conversations : [conversations];
            
            for (const conv of convArray) {
              if (conv.mapping) {
                for (const nodeId in conv.mapping) {
                  const node = conv.mapping[nodeId];
                  const msg = node?.message;
                  if (msg?.content?.parts?.[0] && (msg.author?.role === 'user' || msg.author?.role === 'assistant')) {
                    messages.push({
                      role: msg.author.role,
                      content: msg.content.parts.join('\n').slice(0, 2000),
                      timestamp: msg.create_time ? new Date(msg.create_time * 1000) : new Date()
                    });
                  }
                }
              }
            }
          } catch (parseErr) {
            console.error(`Error parsing ${convFile}:`, parseErr);
          }
        }
      }
      
      // Check for Facebook format
      if (messages.length === 0) {
        const fbFiles = allFiles.filter(f => f.includes('message_') && f.endsWith('.json'));
        if (fbFiles.length > 0) {
          platform = 'Facebook';
          setImportStatus({ status: 'extracting', message: `Detected Facebook export, reading ${fbFiles.length} files...`, progress: 40 });
          
          for (const fbFile of fbFiles.slice(0, 100)) {
            try {
              const content = await zip.file(fbFile).async('string');
              const data = JSON.parse(content);
              if (data.messages) {
                for (const msg of data.messages) {
                  if (msg.content) {
                    messages.push({
                      role: 'user',
                      content: msg.content.slice(0, 2000),
                      sender: msg.sender_name,
                      timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms) : new Date()
                    });
                  }
                }
              }
            } catch (e) { /* skip bad files */ }
          }
        }
      }
      
      // === SUCCESS: Found messages client-side ===
      if (messages.length > 0) {
        setImportStatus({ status: 'complete', message: `Found ${messages.length} messages from ${platform}!`, progress: 100 });
        setDetectedPlatform(platform);
        setExtractedData({
          messages,
          posts: [],
          dataSize: JSON.stringify(messages).length
        });
        return;
      }
      
      // === STEP 2: No messages found client-side, try server upload ===
      setImportStatus({ status: 'uploading', message: 'Uploading to server for processing...', progress: 40 });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'auto');
      
      const uploadRes = await fetch('/api/import/data', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      
      const uploadData = await uploadRes.json();
      const jobId = uploadData.jobId || uploadData.importId;
      
      if (jobId) {
        setImportStatus({ status: 'processing', message: 'Server is processing your data...', progress: 60 });
        
        // Poll for completion
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          
          const statusRes = await fetch(`/api/imports/status?importId=${jobId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const statusData = await statusRes.json();
          
          if (statusData.status === 'completed' || statusData.status === 'complete') {
            setImportStatus({ status: 'complete', message: 'Import complete!', progress: 100 });
            setDetectedPlatform(statusData.stats?.source || 'Unknown');
            setExtractedData({
              messages: [],
              posts: [],
              dataSize: 0,
              serverProcessed: true,
              stats: statusData.stats
            });
            return;
          }
          
          if (statusData.status === 'failed') {
            throw new Error(statusData.error || 'Processing failed');
          }
          
          setImportStatus({ 
            status: 'processing', 
            message: `Processing... ${Math.round((i / 60) * 100)}%`, 
            progress: 60 + Math.round((i / 60) * 35) 
          });
        }
        
        // Timeout but still processing
        setImportStatus({ status: 'complete', message: 'Still processing, check back soon!', progress: 100 });
        setExtractedData({ messages: [], posts: [], dataSize: 0, serverProcessed: true });
        return;
      }
      
      // No job ID means direct success
      setImportStatus({ status: 'complete', message: 'Upload complete!', progress: 100 });
      setExtractedData({ messages: [], posts: [], dataSize: 0, serverProcessed: true });
      
    } catch (err) {
      console.error('Client-side extraction error:', err);
      
      // Offer server fallback for large/complex files
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        setImportStatus({ status: 'ready', message: `Browser processing failed. Will upload to server instead.`, progress: 100 });
        setDetectedPlatform('Server Processing');
        setExtractedData({
          messages: [],
          posts: [],
          messageCount: 0,
          totalSize: fileSizeMB,
          useServerFallback: true
        });
      } else {
        setError(`Import failed: ${err.message}`);
        setImportStatus(null);
      }
    }
  };

  const removeFile = () => {
    setSelectedFiles([]);
    setExtractedData(null);
    setError('');
  };

  const handleImport = async () => {
    // Handle server fallback for files that couldn't be read client-side
    if (extractedData?.useServerFallback && selectedFiles.length > 0) {
      setIsImporting(true);
      setError('');
      
      const file = selectedFiles[0];
      const fileSizeMB = file.size / (1024 * 1024);
      const fileSizeDisplay = fileSizeMB >= 1024 
        ? `${(fileSizeMB / 1024).toFixed(2)} GB` 
        : `${fileSizeMB.toFixed(0)} MB`;
      
      // For large files, use chunked upload with disk-based storage
      setImportStatus({ status: 'uploading', message: `Preparing to upload ${fileSizeDisplay}...`, progress: 1 });
      
      try {
        const result = await uploadLargeFileForImport(
          file, 
          (progress) => {
            // Progress callback
            setImportStatus(prev => ({ 
              ...prev, 
              progress: Math.min(progress, 99) 
            }));
          },
          (statusMessage) => {
            // Status message callback
            setImportStatus(prev => ({ 
              ...prev, 
              message: statusMessage 
            }));
          }
        );
        
        // Check if we got an import job ID to poll
        if (result.importId) {
          setImportStatus({ status: 'processing', message: 'Analyzing your conversation history...', progress: 95 });
          
          // Poll for import job completion
          const pollImportStatus = async (attempts = 0) => {
            if (attempts > 120) { // 4 minutes max
              setImportStatus({ status: 'complete', message: 'Processing in background. Check Settings for results when done.', progress: 100 });
              setIsImporting(false);
              onImportComplete?.({ memoriesAdded: 0, messagesCount: 0, conversationCount: 0, background: true });
              return;
            }
            
            try {
              const statusRes = await fetch(`/api/imports/status?importId=${result.importId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const statusData = await statusRes.json();
              
              if (statusData.status === 'completed' || statusData.status === 'complete') {
                const memoriesCount = statusData.memoriesAdded || statusData.stats?.memoriesAdded || 0;
                const messagesCount = statusData.messagesCount || statusData.stats?.messagesCount || 0;
                const conversationCount = statusData.stats?.conversationCount || 0;
                
                let completeMessage = 'Import complete!';
                const details = [];
                if (conversationCount > 0) details.push(`${conversationCount} conversations`);
                if (messagesCount > 0) details.push(`${messagesCount} messages`);
                if (memoriesCount > 0) details.push(`${memoriesCount} new memories`);
                if (details.length > 0) completeMessage += ` ${details.join(', ')} analyzed.`;
                
                setImportStatus({ 
                  status: 'complete', 
                  message: completeMessage, 
                  progress: 100,
                  memoriesAdded: memoriesCount,
                  messagesCount,
                  conversationCount,
                });
                setIsImporting(false);
                // Notify parent with import stats (for toast notification)
                onImportComplete?.({
                  memoriesAdded: memoriesCount,
                  messagesCount,
                  conversationCount,
                  analysis: statusData.analysis,
                });
                // Don't auto-close — let user see the results
                return;
              }
              
              if (statusData.status === 'failed') {
                throw new Error(statusData.error || 'Processing failed');
              }
              
              // Still processing
              setImportStatus({ 
                status: 'processing', 
                message: statusData.message || 'Processing your data...', 
                progress: Math.min(95 + attempts * 0.04, 99) 
              });
              
              setTimeout(() => pollImportStatus(attempts + 1), 2000);
            } catch (pollErr) {
              console.error('Poll error:', pollErr);
              setTimeout(() => pollImportStatus(attempts + 1), 3000);
            }
          };
          
          pollImportStatus();
        } else {
          // No import ID, assume success - backend processed synchronously
          // Try to get stats from the result
          const memoriesCount = result?.memoriesAdded || 0;
          const messagesCount = result?.messageCount || 0;
          const conversationCount = result?.conversationCount || 0;
          
          let completeMessage = 'Import complete!';
          const details = [];
          if (conversationCount > 0) details.push(`${conversationCount} conversations`);
          if (messagesCount > 0) details.push(`${messagesCount} messages`);
          if (memoriesCount > 0) details.push(`${memoriesCount} new memories`);
          if (details.length > 0) completeMessage += ` ${details.join(', ')} analyzed.`;
          else completeMessage += ' Your data is being processed.';
          
          setImportStatus({ 
            status: 'complete', 
            message: completeMessage, 
            progress: 100,
            memoriesAdded: memoriesCount,
            messagesCount,
            conversationCount,
          });
          setIsImporting(false);
          // Notify parent with import stats
          onImportComplete?.({
            memoriesAdded: memoriesCount,
            messagesCount,
            conversationCount,
          });
          // Don't auto-close — let user see results
        }
      } catch (err) {
        console.error('Upload error:', err);
        setError(err.message || 'Upload failed. Please try again.');
        setIsImporting(false);
        setImportStatus(null);
      }
      return;
    }
    
    if (!extractedData || extractedData.messages.length === 0) {
      setError('No messages found to import');
      return;
    }
    
    setIsImporting(true);
    setError('');
    setImportStatus({ status: 'uploading', message: 'Uploading extracted data...', progress: 20 });

    try {
      // Upload extracted data (much smaller than full ZIP!)
      const res = await fetch('/api/import/data', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: detectedPlatform?.toLowerCase() || 'auto',
          messages: extractedData.messages,
          posts: extractedData.posts
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      
      setImportStatus({ status: 'processing', message: 'Analyzing your data...', progress: 60 });
      
      // Poll for completion
      if (data.importId) {
        const poll = async (polls = 0) => {
          if (polls > 120) return setError('Timeout');
          const r = await fetch(`/api/imports/status?importId=${data.importId}`, { 
            headers: { Authorization: `Bearer ${token}` } 
          });
          const d = await r.json();
          
          if (d.status === 'completed') {
            setImportStatus({ 
              status: 'completed', 
              message: d.message || `Imported ${d.messagesCount || 0} messages!`, 
              progress: 100 
            });
            setIsImporting(false);
            if (d.analysis || d.profileComparison || d.memoriesAdded) {
              setAnalysisResult({
                analysis: d.analysis,
                profile: d.profileComparison,
                memoriesAdded: d.memoriesAdded || 0,
                messagesCount: d.messagesCount || 0
              });
            }
          } else if (d.status === 'failed') {
            setError(d.error || 'Import failed');
            setImportStatus(null);
            setIsImporting(false);
          } else {
            setImportStatus({ 
              status: 'processing', 
              message: d.message || 'Processing...', 
              progress: Math.min(95, 60 + polls) 
            });
            setTimeout(() => poll(polls + 1), 2000);
          }
        };
        poll();
      }
    } catch (err) {
      setError(err.message);
      setImportStatus(null);
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#141a21] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#141a21] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Import History</h2>
              <p className="text-xs text-gray-500">Currently supports ChatGPT • More platforms coming soon</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1" disabled={isImporting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Instructions - only show before file selected */}
          {!selectedFiles.length && !extractedData && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-sm text-gray-300 mb-3">Upload your data export ZIP file from any of these:</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs rounded-full">ChatGPT</span>
                <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">Facebook</span>
                <span className="px-2.5 py-1 bg-orange-500/10 text-orange-400 text-xs rounded-full">Claude</span>
                <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">Google/Gemini</span>
              </div>
              <p className="text-xs text-gray-500 mt-3">We'll automatically detect the format.</p>
            </div>
          )}

          {/* File Selection */}
          <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".zip" 
              className="hidden" 
              disabled={isImporting} 
            />
            
            {!extractedData ? (
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isImporting || importStatus?.status === 'extracting'}
                className="w-full py-8 border-2 border-dashed border-white/20 hover:border-orange-500/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-all">
                {importStatus?.status === 'extracting' ? (
                  <>
                    <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />
                    <span className="text-sm text-orange-400">{importStatus.message}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-500" />
                    <span className="text-sm text-gray-400">Click to select your ZIP file</span>
                    <div className="flex items-center gap-1 text-xs text-green-500/80">
                      <Shield className="w-3 h-3" />
                      <span>Messages analyzed then deleted — only insights kept</span>
                    </div>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                {/* Selected File */}
                <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileArchive className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-gray-300 truncate">{selectedFiles[0]?.name}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(getTotalSize())})</span>
                  </div>
                  <button onClick={removeFile} disabled={isImporting} className="text-gray-500 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Detected platform */}
                {detectedPlatform && (
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400">Detected platform:</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      detectedPlatform.toLowerCase().includes('chatgpt') ? 'bg-green-500/20 text-green-400' :
                      detectedPlatform.toLowerCase().includes('facebook') ? 'bg-blue-500/20 text-blue-400' :
                      detectedPlatform.toLowerCase().includes('claude') ? 'bg-orange-500/20 text-orange-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>{detectedPlatform}</span>
                  </div>
                )}
                
                {/* Server Processed Success */}
                {extractedData?.serverProcessed ? (
                  <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Import Complete!</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Your {detectedPlatform || 'chat'} history has been processed and added to your SoulPrint profile.
                    </p>
                    {extractedData.stats && (
                      <div className="mt-3 text-xs text-gray-500">
                        {extractedData.stats.messageCount && <span>• {extractedData.stats.messageCount} messages analyzed</span>}
                      </div>
                    )}
                  </div>
                ) : extractedData?.useServerFallback ? (
                  <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Upload className="w-5 h-5 text-blue-400" />
                      <span className="text-blue-400 font-medium">Server Upload Available</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Your browser couldn't read this file directly. Click below to upload it to our servers for processing.
                    </p>
                    <div className="text-xs text-blue-400/80 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span>Files are processed securely and deleted after import</span>
                    </div>
                  </div>
                ) : (
                  /* Extraction Preview */
                  <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Ready to Import</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-black/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-white">{extractedData.messages.length.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Messages Found</div>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-white">{formatFileSize(extractedData.dataSize)}</div>
                        <div className="text-xs text-gray-500">Data to Upload</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-emerald-400/80 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      <span>
                        {getTotalSize() > 100 * 1024 * 1024 
                          ? `${Math.round(getTotalSize() / extractedData.dataSize)}x smaller than original file!` 
                          : 'Fast upload - only conversation data'
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Progress */}
          {importStatus && importStatus.status !== 'extracting' && importStatus.status !== 'complete' && importStatus.status !== 'completed' && (
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                <span className="text-sm font-medium text-cyan-400">
                  {importStatus.message}
                </span>
              </div>
              {importStatus.progress > 0 && (
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div 
                    className="bg-cyan-500 h-2 rounded-full transition-all" 
                    style={{ width: `${importStatus.progress}%` }} 
                  />
                </div>
              )}
            </div>
          )}

          {/* Completion Screen */}
          {(importStatus?.status === 'completed' || importStatus?.status === 'complete') && (
            <div className="space-y-3">
              {/* Success Header */}
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-medium text-green-400">
                    {importStatus.message}
                  </span>
                </div>
              </div>

              {/* Stats Grid — show whenever we have stats from polling or analysis */}
              {(importStatus.memoriesAdded > 0 || importStatus.messagesCount > 0 || importStatus.conversationCount > 0 || analysisResult) && (
                <div className="grid grid-cols-3 gap-3">
                  {(importStatus.conversationCount > 0 || analysisResult?.conversationCount > 0) && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-white">{(importStatus.conversationCount || analysisResult?.conversationCount || 0).toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Conversations</div>
                    </div>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{(importStatus.messagesCount || analysisResult?.messagesCount || 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Messages</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-400">{(importStatus.memoriesAdded || analysisResult?.memoriesAdded || 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">New Memories</div>
                  </div>
                </div>
              )}

              {/* Analysis Details */}
              {analysisResult?.analysis && (
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Personalization Enhanced</span>
                  </div>
                  
                  {analysisResult.analysis.summary && (
                    <p className="text-gray-300 text-sm mb-3">{analysisResult.analysis.summary}</p>
                  )}

                  {analysisResult.analysis.interests?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {analysisResult.analysis.interests.slice(0, 5).map((interest, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white/10 text-gray-300 text-xs rounded">
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Memories Added Hint — when no analysis detail is available but memories were added */}
              {!analysisResult?.analysis && (importStatus.memoriesAdded > 0) && (
                <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-medium text-orange-300">Memories Extracted</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    {importStatus.memoriesAdded} new memories have been extracted from your conversation history. 
                    These will help personalize your AI experience.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          {(importStatus?.status === 'completed' || importStatus?.status === 'complete') ? (
            <button 
              onClick={onClose} 
              className="w-full py-3 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Continue to Chat
            </button>
          ) : (
            <button 
              onClick={handleImport} 
              disabled={(!extractedData || (extractedData.messages.length === 0 && !extractedData.useServerFallback)) || isImporting}
              className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                extractedData && (extractedData.messages.length > 0 || extractedData.useServerFallback) && !isImporting
                  ? extractedData.useServerFallback 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90'
                    : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:opacity-90' 
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}>
              {isImporting 
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {extractedData?.useServerFallback ? 'Uploading...' : 'Importing...'}</>
                : extractedData?.useServerFallback 
                  ? <><Upload className="w-4 h-4" /> Upload to Server</>
                  : <><Zap className="w-4 h-4" /> Import {extractedData?.messages?.length?.toLocaleString() || 0} Messages</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
// Schedule templates for UI

export default CloudImportModal;
