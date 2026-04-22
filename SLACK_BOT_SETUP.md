# Slack Bot Setup Instructions
## Step-by-Step Guide to Get Your Bot Token

---

## Step 1: Access Slack API Portal

1. Open your browser and go to: **https://api.slack.com/apps**
2. Sign in with your Slack account (use the same account as your workspace)

---

## Step 2: Create a New App

1. Click the green **"Create New App"** button (top right)
2. Choose **"From scratch"** (not from manifest)
3. Fill in the form:
   - **App Name**: `SoulPrint Support Bot`
   - **Pick a workspace**: Select your organization's workspace
4. Click **"Create App"**

> **If you see an error saying you don't have permission:**
> You need to ask your Workspace Admin to either:
> - Give you permission to create apps, OR
> - Create the app for you and share the credentials

---

## Step 3: Configure Bot Permissions

After creating the app, you'll be on the app's settings page.

1. In the left sidebar, click **"OAuth & Permissions"**
2. Scroll down to **"Scopes"** section
3. Under **"Bot Token Scopes"**, click **"Add an OAuth Scope"** and add these:

| Scope | Purpose |
|-------|---------|
| `chat:write` | Send messages |
| `channels:history` | Read channel messages |
| `channels:read` | View channel info |
| `groups:history` | Read private channel messages |
| `groups:read` | View private channel info |
| `im:history` | Read direct messages |
| `im:read` | View DM info |
| `im:write` | Send direct messages |
| `users:read` | View user info |
| `users:read.email` | View user emails |
| `app_mentions:read` | Know when bot is mentioned |

---

## Step 4: Install App to Workspace

1. Scroll up on the same page ("OAuth & Permissions")
2. Click **"Install to Workspace"** button
3. Review the permissions and click **"Allow"**
4. You'll be redirected back - now you'll see your tokens!

---

## Step 5: Copy Your Tokens

On the "OAuth & Permissions" page, you'll now see:

### Bot User OAuth Token
```
xoxb-1234567890123-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx
```
**Copy this token** - it starts with `xoxb-`

---

## Step 6: Get Signing Secret

1. In the left sidebar, click **"Basic Information"**
2. Scroll down to **"App Credentials"**
3. Find **"Signing Secret"** and click **"Show"**
4. **Copy this secret** - it's a long alphanumeric string

---

## Step 7: Enable Event Subscriptions (Required for Bot to Receive Messages)

1. In the left sidebar, click **"Event Subscriptions"**
2. Toggle **"Enable Events"** to ON
3. For **"Request URL"**, you'll enter your webhook URL (I'll provide this after building the bot):
   ```
   https://perfil-soul.preview.emergentagent.com/api/slack/webhook
   ```
4. Under **"Subscribe to bot events"**, click **"Add Bot User Event"** and add:
   - `message.channels` - Messages in public channels
   - `message.groups` - Messages in private channels
   - `message.im` - Direct messages to bot
   - `app_mention` - When someone @mentions the bot
5. Click **"Save Changes"**

---

## Step 8: Enable Interactivity (For Buttons/Actions)

1. In the left sidebar, click **"Interactivity & Shortcuts"**
2. Toggle **"Interactivity"** to ON
3. For **"Request URL"**, enter:
   ```
   https://perfil-soul.preview.emergentagent.com/api/slack/interactive
   ```
4. Click **"Save Changes"**

---

## Summary: What You Need to Give Me

Once you complete the steps above, please provide:

| Item | Where to Find | Example |
|------|---------------|---------|
| **Bot Token** | OAuth & Permissions page | `xoxb-123...` |
| **Signing Secret** | Basic Information → App Credentials | `abc123def456...` |
| **Your Slack User ID** | (for escalation alerts) | `U0123456789` |

### How to Find Your Slack User ID:
1. In Slack, click on your profile picture (top right)
2. Click **"Profile"**
3. Click the **"..."** (more) button
4. Click **"Copy member ID"**

---

## Troubleshooting

### "You don't have permission to create apps"
→ Contact your Workspace Admin and ask them to:
- Go to **Workspace Settings → Manage Apps**
- Add you as an "App Manager" OR create the app for you

### "App not responding"
→ Make sure Event Subscriptions URL is verified (green checkmark)

### "Bot can't see messages"
→ Invite the bot to the channel: `/invite @SoulPrint Support Bot`

---

## What the Bot Will Do

Once set up, your team can:

1. **DM the bot** with an issue description
2. **@mention the bot** in a channel
3. **Use slash commands** like `/soulprint-help`

The bot will:
- Analyze the issue against the knowledge base
- Suggest a solution with code changes
- Create a ticket/alert for your review
- Escalate if it's outside known features

---

## Next Steps

1. Complete the steps above
2. Share the Bot Token + Signing Secret + Your User ID with me
3. I'll build and deploy the bot
4. We'll test it together!

