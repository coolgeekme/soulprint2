# SoulPrint Support Knowledge Base
# Last Updated: 2026-03-20
# This file is read by the AI at runtime to provide accurate in-app support.
# Update this file whenever features are added, changed, or bugs are discovered.

---

## RECENT UPDATES (What's New)

### March 2026
- **User Analytics Dashboard** - Admins can click any user to see detailed analytics: LLM model usage, conversation topics, memory categories, platform usage, cost breakdowns
- **Smart Chat Deletion** - Deleting from "All Chats" now only hides chats that belong to Projects (they remain in the Project). Deleting from within a Project permanently removes the chat.
- **What's New Section** - Users can click the sparkles icon (✨) in the chat sidebar to see the latest app updates

---

## APP OVERVIEW
SoulPrint is a personal AI companion that learns your communication style, interests, and preferences over time. It supports multi-model chat, image/video generation, voice chat, data imports, and Telegram integration.

**URL**: https://soulprintengine.ai
**Support Email**: team@archeforge.com

---

## FEATURES

### 1. Chat
- Users can chat with the AI in real-time via streaming (Server-Sent Events).
- Conversations are auto-saved and can be resumed. When a user returns, their last conversation loads automatically.
- Users can start a new chat by clicking the "+" button in the sidebar.
- The sidebar shows conversation history with search (searches titles AND message content).
- Messages support markdown formatting, code blocks, and LaTeX.
- Users can attach images (including HEIC from iOS), PDFs, text files, CSVs, JSON, and DOCX files.
- Thumbs up/down feedback is available on assistant messages.

**Common Issues:**
- "Connection error" — Usually caused by network issues or CDN timeout. Suggest: refresh the page, check internet connection. If persistent, this may be a server issue → ESCALATE.
- Messages not sending — Check if the input field is empty or if there's a network issue. Try refreshing.
- Slow responses — Some models (Claude Opus, Gemini Pro) take longer. The "Dynamic Intelligence" mode auto-selects the fastest appropriate model.
- Streaming cuts off mid-response — May be a proxy/CDN timeout. Suggest refreshing and trying again. If it happens repeatedly → ESCALATE.

### 2. AI Model Selection
Users can choose from multiple LLM providers:

**Available Models:**
- **Dynamic Intelligence** (default) — AI auto-selects the best model per query
- **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4.1
- **Claude**: Opus 4.5, Sonnet 4.5, Haiku 3.5
- **Gemini**: 2.5 Pro, 2.0 Flash
- **Perplexity**: Sonar Pro (online search), Sonar, Sonar Reasoning
- **Kimi**: K2 Flagship, Moonshot 32k, Moonshot 8k

**Coming Soon**: GPT-5.2, GPT-5, o3, o3 Mini

**Default Model**: Users can set a default model by:
1. Opening the model picker (bottom-left of chat input)
2. Selecting a model
3. Clicking "set default" next to the selected model
The default persists across sessions.

**Common Issues:**
- Model not responding — Some models may be temporarily unavailable. Suggest switching to a different model.
- "Coming Soon" models cannot be selected — These are placeholders for upcoming models.

### 3. Image Generation
Users can generate images by explicitly asking (e.g., "generate an image of a sunset").

**Available Image Models:**
- Seedream 5.0 Lite (~$0.03)
- Nano Banana / Gemini (~$0.05)
- GPT-4o Image (~$0.10)
- Flux Pro (~$0.13)
- Midjourney V7 (~$0.20)
- GPT Image 1.5 (~$0.25)

**How it works:**
1. User types a message with clear image generation intent
2. A generation bar appears with "Generate Image" and "Just Chat" options
3. User clicks "Generate Image" to proceed
4. The image appears in the chat when ready

**The generation bar does NOT trigger on:**
- Questions about generating ("how do I generate images?")
- Metaphorical use ("visualize your goals", "picture this")
- Non-visual generation ("generate a list", "generate code")

**Common Issues:**
- Generation takes too long — Image generation can take 10-60 seconds depending on the model. This is normal.
- "Generation failed" — Could be a content policy violation or service issue. Suggest trying a different prompt or model.
- Generation triggered accidentally — The app should only show the generation bar for explicit requests. If it triggers unexpectedly → ESCALATE.

### 4. Video Generation
Similar to image generation but for video content.

**Available Video Models:**
- Kling 3.0 Standard (~$0.10/s)
- Kling 3.0 Pro (~$0.14/s)
- Sora 2 (~$0.15/10s)
- Seedance 1.5 Pro (~$0.25/s)
- Kling 2.6 (~$0.27/s)
- Wan 2.6 (~$0.35/5s)
- Sora 2 Pro HD (~$0.50/10s)

**Common Issues:**
- Video generation is slow — Videos take 1-5 minutes. This is normal.
- Video quality issues — Try a different model or provide a more detailed prompt.

### 5. Voice Chat
Real-time voice conversation with the AI using OpenAI's Realtime API.

**How to use:**
1. Click the microphone icon in the chat input
2. Speak naturally — the AI responds with voice
3. Click the stop button to end the voice session

**Settings:**
- Default voice can be changed in Settings → Voice Chat
- Web search can be enabled/disabled for voice sessions

**Common Issues:**
- Microphone not working — Browser needs microphone permission. Check browser settings.
- Voice chat not starting — Ensure the browser supports WebRTC. Chrome/Safari recommended.
- No audio output — Check device volume and audio output settings.
- Echo or feedback — Use headphones.

### 6. Data Imports (Chat History)
Users can import their chat history from other platforms to help SoulPrint learn their communication style.

**Supported Platforms:**
- ChatGPT (ZIP export from OpenAI)
- Claude (coming soon)
- Other platforms via manual upload

**How to import ChatGPT data:**
1. Go to Settings → Import Data tab
2. Export your ChatGPT data from https://chat.openai.com → Settings → Data Controls → Export Data
3. Upload the ZIP file in SoulPrint
4. The app extracts messages, analyzes communication patterns, and updates your Soul Profile

**Common Issues:**
- "0 items analyzed" — This was a known bug (now fixed). If it still happens, try re-importing. The import should show the correct message count.
- Import stuck on "processing" — Large files may take several minutes. If stuck for more than 5 minutes → ESCALATE.
- "Invalid file format" — Only ZIP files are supported. Make sure you're uploading the original ZIP from ChatGPT, not an extracted folder.
- Import completed but no profile update — The analysis runs in the background. Refresh the page after a few minutes.

### 7. Telegram Integration
Users can chat with SoulPrint directly in Telegram.

**How to link:**
1. Go to Settings → Telegram tab
2. Message @soulprintbot on Telegram
3. The bot sends a link code
4. Enter the code in Settings → Telegram tab

**How to disconnect:**
1. Go to Settings → Telegram tab
2. Click "Disconnect" button
3. Confirm the disconnection

**Features in Telegram:**
- Full chat capabilities
- Model selection via `/model` command
- Help via `/help` command

**Common Issues:**
- Link code expired — Codes expire after 24 hours. Send /start to the bot for a new code.
- Bot not responding — Check if Telegram integration is enabled in admin settings. If the bot is down → ESCALATE.
- Messages not syncing — Telegram messages appear in their own conversation thread, separate from web conversations.

### 8. File Attachments
Users can attach files to messages for analysis.

**Supported file types:**
- Images: JPG, JPEG, PNG, WebP, GIF, HEIC, HEIF
- Documents: PDF, DOCX
- Data: TXT, MD, CSV, JSON

**HEIC/HEIF (iOS photos):**
- Automatically converted to JPEG for compatibility
- No user action needed — just select the photo

**Common Issues:**
- HEIC file not uploading — Make sure the app has been updated. HEIC support was recently added.
- PDF not readable — Very large PDFs (>50 pages) may be truncated. Suggest breaking into smaller files.
- "File type not supported" — Check if the file extension is in the supported list above.

### 9. Conversation Search
**In the chat sidebar:**
- Type in the search box to search across all conversations
- Searches both conversation titles AND message content
- Results update after a brief pause (300ms debounce)
- Click "x" to clear search and show all conversations

### 10. Settings
Accessible via the gear icon in the chat sidebar.

**Tabs:**
- **Settings**: Display name, assistant name, privacy settings (AI training opt-out, analytics opt-out)
- **Telegram**: Link/unlink Telegram account, select Telegram model
- **Import Data**: Import chat history from other platforms
- **Assessment**: Personality/communication assessment
- **Voice Chat**: Default voice selection, web search toggle

### 11. Assessment
A guided questionnaire that helps SoulPrint understand the user better.

**Common Issues:**
- Assessment not loading — Refresh the page. If persistent → ESCALATE.
- Can't redo assessment — There's a "Reset Assessment" option in Settings.

---

## PROJECTS & ORGANIZATION

### Projects
Users can organize conversations into Projects for better organization.

**How to use:**
1. Click "New Project" in the sidebar to create a project
2. Move conversations to projects via the context menu (right-click or three dots)
3. Click a project name to view only conversations in that project

### Deleting Conversations
**Smart Deletion Behavior:**
- **From "All Chats" view**: If a chat belongs to a Project, it's only hidden from All Chats (still accessible in the Project)
- **From Project view**: Permanently deletes the conversation
- **Chat without a Project**: Permanently deletes from All Chats

This prevents accidentally losing conversations that are organized into Projects.

---

## ACCOUNT & AUTH

### Login Methods
- Email/password registration
- Google OAuth (via Firebase)

### Common Auth Issues
- "Firebase not configured" — This is a server configuration issue → ESCALATE immediately.
- Google login returns error — May be a redirect URI mismatch or server issue. Suggest trying email/password login. If Google login consistently fails → ESCALATE.
- Session expired — User needs to log in again. Sessions last 30 days.
- Forgot password — Use the "Forgot Password" link on the login page.

---

## KNOWN ISSUES & WORKAROUNDS

1. **520 errors / "Connection error"** — Occasionally caused by CDN/proxy issues. Usually resolves on refresh. If persistent across multiple users → ESCALATE.
2. **Long messages may be truncated in context** — Very long messages (>16,000 characters) are automatically truncated to preserve conversation context. The AI notes when truncation occurs.

---

## ADMIN DASHBOARD (Admin Users Only)

### Tabs:
- **Metrics**: Quick Stats, Costs (LLM + Voice + Media), Engagement
- **Insights**: Business analytics, pricing recommendations, revenue potential, churn indicators
- **Waitlist/Users**: User management with detailed user profiles
- **Conversations**: Search and view conversation metadata (content is privacy-protected)
- **Blog/Announcements**: Content management
- **App Updates**: Manage "What's New" updates shown to users
- **Feedback**: User feedback review
- **Beta Codes**: Access code management
- **Assessments**: View user assessment data
- **Imports**: Track user data imports
- **Settings**: App-wide configuration

### User Details Page (User Analytics)
- Click any user in the Users tab to view detailed analytics
- **Usage Stats**: Conversations, messages, memories, media generated, voice minutes, total cost
- **LLM Model Usage**: Which AI models the user prefers (with usage counts)
- **Conversation Topics**: Smart analysis of what users discuss (e.g., Software Development, Business & Startups, Content Writing, etc.)
- **Memory Categories**: Breakdown of saved memories by category
- **Platform Usage**: Web vs Telegram vs Voice usage distribution
- **Media Generation**: Images/videos created, by type and model
- **Integrations**: Telegram, Google connection status
- **Assessment Status**: Completion level and pillars covered
- **Feedback Summary**: Thumbs up/down counts and satisfaction rate

### App Updates (What's New)
- Admins can create updates to show users new features, improvements, bug fixes
- Updates appear in the "What's New" modal (sparkles icon in user's sidebar)
- Users see unread badge count
- Support types: feature, improvement, fix, announcement

### Auto-Refresh
- Dashboard metrics auto-refresh every 30 seconds when "Live" is enabled
- Click the refresh icon for manual refresh
- Toggle "Live" / "Paused" in the top-right corner

---

## WHAT'S NEW FEATURE (User-facing)

Users can see app updates by clicking the sparkles (✨) icon in the chat sidebar:
- Shows latest features, improvements, and bug fixes
- Unread count badge appears for new updates
- Click "Mark all as read" to clear the badge

---

## ESCALATION GUIDELINES

**ESCALATE to engineering (email team@archeforge.com) when:**
- Server errors (500, 502, 520) that persist after refresh
- Features completely broken (not just slow)
- Data loss or corruption
- Authentication system failures
- Payment/billing issues
- Security concerns
- Repeated identical errors across multiple attempts

**DO NOT escalate (handle with guidance):**
- "How do I..." questions → Guide the user
- Slow performance → Explain it's normal for certain models/operations
- File format issues → Point to supported formats
- Browser compatibility → Suggest Chrome/Safari
- Network issues → Suggest checking connection, refreshing
