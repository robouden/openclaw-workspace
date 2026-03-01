# AnyType Bot Account Setup Guide

Complete walkthrough for creating a dedicated AnyType bot account for OpenClaw sync.

## Prerequisites

- AnyType CLI installed: https://github.com/anyproto/anytype-cli/releases
- Linux/macOS with bash (Windows can use WSL2)
- Network connectivity to your AnyType server (local or cloud)

## Step 1: Create a Bot Account

Create a fresh account specifically for your OpenClaw bot (not your personal account):

```bash
# Create new bot account
anytype auth create openclaw-bot

# You'll see output like:
# ✓ Bot account created successfully!
# BOT ACCOUNT KEY: abc123...xyz (SAVE THIS)
# Account Id: A123...XYZ
```

**⚠️ IMPORTANT:** Save the **Account Key** in a secure location. This is your master authentication credential.

## Step 2: Generate API Key

Create an API key for programmatic access:

```bash
# Generate API key
anytype auth apikey create openclaw-sync

# Output:
# ✓ API key created successfully
# Name: openclaw-sync
# Key: ABC123...XYZ (SAVE THIS)
```

The API key is what OpenClaw will use to authenticate requests.

## Step 3: Verify Bot Setup

Check the bot account status:

```bash
anytype auth status

# Output should show:
# ✓ Logged in to account [Account-ID]
# - Active session: true
# - Account Key: [masked]
# - Session Token: [masked]
```

## Step 4: Create/Join a Space

List available spaces:

```bash
anytype space list

# Output:
# SPACE ID                                          NAME         STATUS
# bafyrei...                                        <unnamed>    Active
```

If no space exists, the bot creates one automatically on first use.

**Note the Space ID** — you'll need this for configuration.

## Step 5: Enable Self-Hosting (Optional)

If using a self-hosted AnyType network, configure the server:

```bash
# Start AnyType server
anytype serve

# Or install as system service (Linux)
anytype service install
anytype service start
```

Server runs on:
- **gRPC:** 127.0.0.1:31010
- **gRPC-Web:** 127.0.0.1:31011
- **HTTP API:** 127.0.0.1:31012 ← Use this for OpenClaw

## Step 6: Configure OpenClaw

Add these credentials to your OpenClaw config file:

**Option A: Config File** (`~/.openclaw/openclaw.json` or workspace config)

```json
{
  "anytype": {
    "apiUrl": "http://127.0.0.1:31012",
    "apiKey": "your-api-key-here",
    "spaceId": "your-space-id",
    "accountId": "your-account-id"
  }
}
```

**Option B: Environment Variables**

```bash
export ANYTYPE_API_URL="http://127.0.0.1:31012"
export ANYTYPE_API_KEY="your-api-key-here"
export ANYTYPE_SPACE_ID="your-space-id"
```

**Option C: CLI Flags**

Pass directly to sync script:
```bash
node sync-notes.js \
  --apiUrl "http://127.0.0.1:31012" \
  --apiKey "your-api-key-here" \
  --spaceId "your-space-id"
```

## Step 7: Test the Connection

Test that OpenClaw can reach AnyType:

```bash
node ~/.npm-global/lib/node_modules/openclaw/skills/anytype-sync/scripts/anytype-api.js \
  --apiKey "your-api-key" \
  --spaceId "your-space-id" \
  list-spaces

# Should output JSON with your spaces
```

## Step 8: Enable Sync in OpenClaw

### Via Heartbeat (Periodic)

Add to your `HEARTBEAT.md`:

```markdown
## AnyType Sync

Backup session notes every heartbeat:

```bash
node ~/.npm-global/lib/node_modules/openclaw/skills/anytype-sync/scripts/sync-notes.js \
  --verbose
```
```

### Via Cron (Scheduled)

Create a cron job for automatic sync:

```bash
# Every 30 minutes
*/30 * * * * node /path/to/sync-notes.js >> /var/log/anytype-sync.log 2>&1

# Every day at 2 AM
0 2 * * * node /path/to/sync-notes.js --type backup >> /var/log/anytype-sync.log 2>&1
```

### Via Slack Command (Manual)

If using OpenClaw Slack bot on VPS:

```
@openclaw sync-notes
```

(Requires setting up the sync script as an OpenClaw command)

## Troubleshooting

### "API key is invalid"
```bash
# Regenerate a new API key
anytype auth apikey create new-key
```

### "Space not found"
```bash
# List all available spaces
anytype space list

# Verify the Space ID is correct
```

### "Connection refused on port 31012"
```bash
# Check if AnyType server is running
ps aux | grep anytype

# Start the server if not running
anytype serve &
```

### "Permission denied" when creating pages
- Verify the bot account has access to the space
- Check space permissions via `anytype space list`
- Bot may need to be invited to shared spaces

## Multi-Device Sync

To sync OpenClaw across multiple devices:

1. Use the **Account Key** to authenticate other devices
2. All devices connect to the same space
3. Changes sync automatically via AnyType's protocol

```bash
# On another device, authenticate with Account Key
anytype auth login
# Paste your Account Key when prompted
```

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for sensitive data in scripts
3. **Rotate API keys** periodically:
   ```bash
   anytype auth apikey revoke old-key-id
   anytype auth apikey create new-key
   ```

4. **Limit network exposure** — keep AnyType on internal network
5. **Monitor logs** for suspicious activity:
   ```bash
   tail -f /var/log/anytype-sync.log
   ```

6. **Self-host for privacy** — avoid cloud AnyType if handling sensitive data

## Next Steps

- See `examples.md` for real-world integration patterns
- See `api-docs.md` for complete API reference
- Check main SKILL.md for usage instructions
