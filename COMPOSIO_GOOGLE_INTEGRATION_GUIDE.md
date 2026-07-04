# Google Account Integration via Composio - Complete Guide

## Overview

SoulPrint now provides **full Google Account access** through Composio integration. Users can connect their Google accounts and perform actions across all major Google services directly through the AI chat interface.

---

## ✅ Supported Google Services

### 📧 **Gmail**
- **Read emails** - Fetch and search your inbox
- **Send emails** - Compose and send messages
- **Manage emails** - Archive, delete, mark as read/unread

### 📅 **Google Calendar**
- **View events** - See your schedule for any time period
- **Create events** - Schedule meetings, appointments, reminders
- **Edit events** - Update existing calendar entries
- **Delete events** - Remove calendar items

### 📁 **Google Drive**
- **List files** - Browse your Drive contents
- **Upload files** - Add new files to Drive
- **Download files** - Retrieve file contents
- **Share files** - Manage sharing permissions
- **Delete files** - Remove files from Drive

### 📄 **Google Docs**
- **Create documents** - Start new Google Docs
- **Read documents** - View document content
- **Edit documents** - Modify existing docs
- **Delete documents** - Remove docs

### 📊 **Google Sheets**
- **Create spreadsheets** - New Google Sheets
- **Read data** - Fetch cell values and ranges
- **Update data** - Modify spreadsheet contents
- **Format cells** - Apply formatting
- **Delete spreadsheets** - Remove sheets

### 🎞️ **Google Slides**
- **Create presentations** - New slide decks
- **Read slides** - View presentation content
- **Edit slides** - Modify presentations
- **Delete presentations** - Remove slide decks

### 👥 **Google Contacts**
- **List contacts** - View your contact list
- **Create contacts** - Add new contacts
- **Update contacts** - Edit contact information
- **Delete contacts** - Remove contacts

---

## 🔐 How to Connect Your Google Account

### Step 1: Navigate to Integrations
1. Log into SoulPrint
2. Click on **Settings** or **Profile** in the navigation
3. Select **Integrations** from the menu

### Step 2: Connect Google Services
1. Find the Google service you want to connect (e.g., Gmail, Calendar, Drive)
2. Click **Connect** button
3. You'll be redirected to Google's OAuth authorization page
4. **Grant permissions** for the requested scopes
5. You'll be redirected back to SoulPrint with a success message

### Step 3: Verify Connection
- Your connected Google accounts will appear in the Integrations page
- Each service shows:
  - ✅ Connected status
  - 📧 Email address used
  - 🔗 Which scopes are authorized

---

## 💬 Using Google Services in Chat

Once connected, you can interact with your Google account naturally through the chat interface.

### Example Commands

#### 📧 **Gmail Examples**
```
"Show me my latest 5 emails"
"Send an email to john@example.com with subject 'Meeting Tomorrow'"
"Search my emails for messages from Sarah"
"Draft an email to my team about the project update"
```

#### 📅 **Calendar Examples**
```
"What's on my calendar this week?"
"Schedule a meeting with Sarah tomorrow at 2pm"
"Show me my calendar for next Monday"
"Create a calendar event for team standup every Monday at 9am"
```

#### 📁 **Drive Examples**
```
"List my recent Drive files"
"Upload this document to my Drive"
"Find files in my Drive related to 'budget'"
"Share the Q4 report with jane@example.com"
```

#### 📄 **Docs Examples**
```
"Create a new Google Doc called 'Project Proposal'"
"Read the document titled 'Meeting Notes'"
"Add a paragraph to my 'Ideas' doc"
"Delete the doc called 'Old Draft'"
```

#### 📊 **Sheets Examples**
```
"Create a new spreadsheet for tracking expenses"
"Show me the data in sheet 'Sales Q1' range A1:D10"
"Update cell B5 in my Budget sheet to 5000"
"Add a new row to my Task Tracker"
```

#### 👥 **Contacts Examples**
```
"Show me all my contacts"
"Add a new contact: John Smith, john@example.com"
"Find contact information for Sarah"
"Update Jane's phone number to 555-0123"
```

---

## 🔧 Technical Details

### API Actions Available

#### Gmail Actions
- `GMAIL_FETCH_EMAILS` - Retrieve emails
- `GMAIL_SEND_EMAIL` - Send email
- `GMAIL_CREATE_DRAFT` - Create draft
- `GMAIL_DELETE_EMAIL` - Delete email
- `GMAIL_MARK_AS_READ` - Mark as read
- `GMAIL_ARCHIVE_EMAIL` - Archive email

#### Calendar Actions
- `GOOGLECALENDAR_FIND_EVENT` - List events
- `GOOGLECALENDAR_CREATE_EVENT` - Create event
- `GOOGLECALENDAR_UPDATE_EVENT` - Update event
- `GOOGLECALENDAR_DELETE_EVENT` - Delete event

#### Drive Actions
- `GOOGLEDRIVE_LIST_FILES` - List files
- `GOOGLEDRIVE_CREATE_FILE` - Upload file
- `GOOGLEDRIVE_GET_FILE` - Download file
- `GOOGLEDRIVE_DELETE_FILE` - Delete file
- `GOOGLEDRIVE_SHARE_FILE` - Share file

#### Docs Actions
- `GOOGLEDOCS_CREATE_DOCUMENT` - Create doc
- `GOOGLEDOCS_GET_DOCUMENT` - Read doc
- `GOOGLEDOCS_UPDATE_DOCUMENT` - Edit doc
- `GOOGLEDOCS_DELETE_DOCUMENT` - Delete doc

#### Sheets Actions
- `GOOGLESHEETS_CREATE_SPREADSHEET` - Create sheet
- `GOOGLESHEETS_GET_VALUES` - Read data
- `GOOGLESHEETS_UPDATE_VALUES` - Write data
- `GOOGLESHEETS_BATCH_UPDATE` - Bulk updates

#### Contacts Actions
- `GOOGLECONTACTS_LIST_CONTACTS` - List contacts
- `GOOGLECONTACTS_CREATE_CONTACT` - Create contact
- `GOOGLECONTACTS_UPDATE_CONTACT` - Update contact
- `GOOGLECONTACTS_DELETE_CONTACT` - Delete contact

---

## 🔒 Security & Privacy

### OAuth 2.0 Authentication
- SoulPrint uses Google's official OAuth 2.0 protocol
- Your Google password is **never** shared with SoulPrint
- Authorization is handled directly by Google

### Permissions (Scopes)
- SoulPrint only requests the **minimum necessary permissions**
- You can **revoke access** at any time via:
  - SoulPrint Integrations page (Disconnect button)
  - Google Account Settings → Security → Third-party apps

### Data Storage
- **SoulPrint does NOT store your Gmail/Drive/Docs content**
- Only connection tokens are stored (encrypted)
- All data access happens in real-time via Google's APIs
- No emails, files, or documents are cached on our servers

---

## ❓ Troubleshooting

### "No Google Account Connected" Error
**Solution:** Go to Integrations page and connect the service first

### "Permission Denied" Error
**Possible causes:**
1. You denied a required permission during OAuth
2. Your Google account has 2FA enabled but app password not set
3. Google Workspace admin restricted third-party apps

**Solution:** 
- Disconnect and reconnect the service
- Grant all requested permissions
- Check with your IT admin if using Workspace account

### "Token Expired" Error
**Cause:** OAuth tokens expire after a period of inactivity

**Solution:** 
- Go to Integrations page
- Click "Reconnect" on the expired service
- Re-authorize with Google

### Actions Not Working
**Debugging steps:**
1. Check Integrations page - is service showing as "Connected"?
2. Try disconnecting and reconnecting
3. Check browser console for errors (F12 → Console)
4. Contact support with your conversation ID

---

## 🚀 Advanced Usage

### Multiple Google Accounts
You can connect **multiple Google accounts** for the same service:

**Example:**
- Work Gmail (john@company.com)
- Personal Gmail (john@gmail.com)

**Usage:**
```
"Send email from my work account to client@example.com"
"Check my personal calendar"
```

The AI will automatically use the correct account based on context, or you can specify explicitly.

### Batch Operations
```
"Send the same email to john@example.com, sarah@example.com, and mike@example.com"
"Create calendar events for every Monday in March at 10am"
"Upload all files in folder X to my Drive"
```

### Cross-Service Workflows
```
"Find emails from Sarah about the budget, extract the key numbers, 
and create a Google Sheet summary"

"Check my calendar for next week and email my team the schedule"

"Read the Google Doc 'Q4 Goals', summarize it, and send via Gmail to my manager"
```

---

## 📊 Subscription Requirements

### Free Tier
- ❌ No Composio integrations available

### Base Plan ($20/mo)
- ✅ Gmail (read only)
- ✅ Calendar (view only)
- 🔒 Other services: Coming soon

### Power Plan ($99/mo)
- ✅ **Full access to all Google services**
- ✅ Gmail (read, send, manage)
- ✅ Calendar (full access)
- ✅ Drive (full access)
- ✅ Docs, Sheets, Slides (full access)
- ✅ Contacts (full access)
- ✅ **Unlimited actions per month**

---

## 🆘 Support

### Getting Help
- **Email:** support@soulprintengine.ai
- **Chat:** Use the support button in-app
- **Documentation:** https://docs.soulprintengine.ai

### Reporting Issues
When reporting a problem, please include:
1. Which Google service (Gmail, Drive, etc.)
2. What action you were trying to perform
3. Exact error message shown
4. Your conversation ID (found in browser URL)
5. Screenshots (if applicable)

---

## 🔄 API Rate Limits

### Google API Quotas
Google enforces rate limits on their APIs:
- **Gmail:** 250 emails/day (sending), unlimited reads
- **Calendar:** 1000 requests/day
- **Drive:** 1000 requests/100 seconds

If you hit a rate limit, the AI will inform you and suggest waiting before retrying.

---

## ✅ What's Next?

### Coming Soon
- 📸 **Google Photos** - Access and manage photos
- 🎬 **YouTube** - Manage playlists, upload videos
- 🗺️ **Google Maps** - Location-based queries
- 📋 **Google Keep** - Note-taking integration
- 🏢 **Google Workspace Admin** - User management (Enterprise)

### Request Features
Have a specific Google service you need? Let us know:
- Feature request form: https://soulprintengine.ai/feature-request
- Or just tell the AI: "I'd like to request a feature..."

---

## 📝 Developer Notes

### Environment Variables Required
```bash
COMPOSIO_API_KEY=your_composio_key_here
```

### Testing Locally
```bash
# Check Composio status
curl http://localhost:3000/api/composio/status

# List available toolkits
curl http://localhost:3000/api/composio/toolkits \
  -H "Authorization: Bearer YOUR_TOKEN"

# List user connections
curl http://localhost:3000/api/composio/connections \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📄 License & Terms

By connecting your Google account to SoulPrint:
- You agree to SoulPrint's Terms of Service
- You agree to Google's API Services User Data Policy
- You authorize SoulPrint to access your Google data per the scopes you grant

**Review policies:**
- SoulPrint Terms: https://soulprintengine.ai/terms
- Google API Policy: https://developers.google.com/terms/api-services-user-data-policy

---

**Last Updated:** 2026-07-04  
**Version:** 1.0.0
