# Slack App Setup for AnyType Skill

Complete guide to set up a Slack app for the AnyType skill (if needed).

## Prerequisites

- Slack workspace admin access
- App already connected to OpenClaw (if using existing bot)
- Or create a new app from scratch

## Option 1: Using Existing OpenClaw Slack Bot

If you already have OpenClaw connected to Slack (recommended):

**No additional setup needed!** 

Just follow the integration steps in `SETUP.md`. The bot token and signing secret are already configured in `/root/.openclaw/openclaw.json`.

## Option 2: Create New Slack App

If you want a dedicated app just for AnyType:

### Step 1: Create App

1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. Name: `AnyType OpenClaw`
5. Select your workspace
6. Click "Create App"

### Step 2: Configure Scopes

Under "OAuth & Permissions":

1. Go to **Scopes** → **Bot Token Scopes**
2. Add these scopes:
   - `chat:write` - Post messages
   - `chat:write.public` - Post in channels
   - `commands` - Handle slash commands
   - `app_mentions:read` - Listen for mentions
   - `message.channels` - Read channel messages

3. Click "Install to Workspace"
4. Grant permissions when prompted
5. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### Step 3: Enable Event Subscriptions

1. Go to **Event Subscriptions** → Toggle "On"
2. Request URL: `https://your-domain/slack/events` (or via tunnel)
3. Subscribe to bot events:
   - `app_mention`
   - `message.channels`
   - `message.groups` (optional)
   - `message.im` (optional)

4. Save changes
5. Copy **Signing Secret** from "Basic Information"

### Step 4: Configure Slash Commands (Optional)

For `/anytype` slash command:

1. Go to **Slash Commands** → "Create New Command"
2. Command: `/anytype`
3. Request URL: `https://your-domain/slack/commands`
4. Short description: "Query AnyType workspaces"
5. Click "Save"

## Token Configuration

### In OpenClaw Config

Update `/root/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-YOUR-BOT-TOKEN",
      "appToken": "xapp-1-YOUR-APP-TOKEN",
      "signingSecret": "YOUR-SIGNING-SECRET",
      "webhookPath": "/slack/events"
    }
  }
}
```

### As Environment Variables

Or set environment variables:

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_SIGNING_SECRET=...
export SLACK_APP_TOKEN=xapp-1-...
```

## Testing

### 1. Start OpenClaw

```bash
openclaw gateway start
```

### 2. In Slack

Try:
```
@AnyType OpenClaw anytype spaces
```

Or use slash command:
```
/anytype spaces
```

### 3. Check Logs

```bash
openclaw logs | grep -i anytype
```

## Troubleshooting

### "App not responding"

1. Check webhook URL is accessible from Slack
   - Slack must reach: `https://your-domain/slack/events`
   - Use ngrok for local testing: `ngrok http 18789`

2. Verify signing secret matches
   - App setup page vs. openclaw.json

3. Check OpenClaw logs
   ```bash
   openclaw logs | tail -100
   ```

### "Invalid token"

- Tokens expire after app uninstall/reinstall
- Get fresh tokens from app settings
- Update openclaw.json and restart

### "Permission denied"

Ensure bot has these scopes (from OAuth & Permissions):
- `chat:write`
- `chat:write.public`
- `app_mentions:read`

## Network Access

Your Slack app needs to reach your OpenClaw instance.

### Local Development

Use ngrok for localhost:

```bash
# Terminal 1: Start OpenClaw
openclaw gateway start

# Terminal 2: Tunnel local to public
ngrok http 18789

# Terminal 3: Update Slack webhook
# Use ngrok URL in Slack App settings → Event Subscriptions → Request URL
```

### Production VPS

For your VPS (`65.108.24.131`):

**Via Tailscale** (if OpenClaw is on Tailscale):
```
https://simplemap.taila8498c.ts.net/slack/events
```

**Via Public Domain** (if you have one):
```
https://your-domain.com/slack/events
```

## Security Notes

- **Signing Secret**: Verify signatures on incoming requests
- **Token Storage**: Store tokens in environment, not config files (if possible)
- **Rate Limits**: Slack has rate limits; cache summaries if querying frequently
- **Permissions**: Grant minimum scopes needed

## What the App Needs

For the AnyType skill to work, the app needs:

✅ **Bot permissions:**
- Post messages (`chat:write`)
- Read messages (to parse commands)
- Respond to mentions

✅ **Events:**
- App mentions (`app_mentions:read`)
- Messages in channels

✅ **OAuth:**
- Bot token with proper scopes
- Signing secret for request verification

That's it! The app doesn't need profile access, file access, or user management.

## File Structure

```
slack/
├── SETUP.md              ← Integration guide (use this)
├── SLACK-APP-SETUP.md    ← This file (for new Slack app)
├── handler.js            ← Main handler
└── examples/
    └── openclawbot.js    ← OpenClaw integration example
```
