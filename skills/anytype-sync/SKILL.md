---
name: anytype-sync
description: "Sync OpenClaw session notes and data to AnyType self-hosted or cloud workspaces. Use when: (1) backing up and syncing session conversation history, (2) storing structured notes in a collaborative workspace, (3) querying/retrieving data from AnyType, (4) integrating OpenClaw with AnyType for continuous data synchronization."
---

# AnyType Sync

Automatically sync OpenClaw session notes, conversations, and structured data to AnyType workspaces. Perfect for teams wanting a shared knowledge base that syncs across devices.

## Quick Start

### 1. Set Up Your AnyType Bot Account

See `references/setup-guide.md` for complete walkthrough. In brief:

```bash
# Create bot account
anytype auth create my-bot-account

# Generate API key
anytype auth apikey create sync-key

# Note your credentials
anytype auth status
```

You'll need:
- **Account ID** (from status output)
- **Account Key** (from account creation)
- **API Key** (from apikey creation)
- **Space ID** (workspace to sync to)
- **API URL** (default: http://localhost:31012)

### 2. Configure OpenClaw

Store credentials in your workspace config or environment:

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

### 3. Enable Sync

Use the included scripts to automate syncing:

```bash
# Run sync script to backup current session
node scripts/sync-notes.js --sessionKey main --type backup

# Or set up periodic sync via cron/heartbeat
# See references/examples.md for full integration patterns
```

## How It Works

**Three main capabilities:**

### 1. Backup Session Notes
Automatically create a new AnyType page for each OpenClaw session with:
- Session metadata (date, duration, model used)
- Conversation history
- Tools used and results
- Structured tags for search/filtering

### 2. Query AnyType Data
Retrieve stored information from your AnyType workspace:
- Search pages by content or tags
- Get page metadata and structure
- Use results in OpenClaw workflows

### 3. Update Pages
Append notes, add tags, or modify existing pages:
- Continuous sync of session notes
- Add context from OpenClaw responses
- Maintain version history

## API Reference

See `references/api-docs.md` for complete AnyType HTTP API reference.

The `scripts/anytype-api.js` module handles authentication and provides these methods:

```javascript
const anytype = require('./scripts/anytype-api.js');

// Initialize with your credentials
const client = anytype.createClient({
  apiUrl: 'http://127.0.0.1:31012',
  apiKey: 'your-api-key'
});

// Create a new page
await client.createPage({
  spaceId: 'your-space-id',
  title: 'Session Notes - 2026-02-28',
  content: '# OpenClaw Session\n\nSession notes here...',
  type: 'page'
});

// Query pages
const results = await client.queryPages({
  spaceId: 'your-space-id',
  query: 'OpenClaw',
  limit: 10
});

// Update a page
await client.updatePage({
  spaceId: 'your-space-id',
  pageId: 'page-id',
  content: 'Updated content...'
});
```

## Real-World Integration

### Heartbeat Sync
Add to your `HEARTBEAT.md`:

```markdown
## AnyType Sync

Run periodically to backup session notes:

```bash
node ~/.npm-global/lib/node_modules/openclaw/skills/anytype-sync/scripts/sync-notes.js
```
```

### Cron Job (Self-Hosted)
```bash
# Every 30 minutes, sync to AnyType
*/30 * * * * node /path/to/sync-notes.js --continuous
```

### Manual Session Export
```bash
node scripts/sync-notes.js \
  --sessionKey main \
  --export markdown \
  --output ~/session-backup.md
```

## Configuration

All options can be set via:
1. Command-line flags: `--apiUrl`, `--apiKey`, `--spaceId`
2. Environment variables: `ANYTYPE_API_URL`, `ANYTYPE_API_KEY`, `ANYTYPE_SPACE_ID`
3. Config file: Pass `--config /path/to/config.json`

Priority order: CLI flags > env vars > config file > defaults

## Examples

See `references/examples.md` for:
- Setting up multi-user sync
- Backing up to self-hosted AnyType
- Querying archived sessions
- Team collaboration workflows
- Integrating with other tools

## Troubleshooting

**API Connection Issues**
- Verify AnyType server is running: `anytype serve` or service running
- Check port is accessible: `curl http://127.0.0.1:31012/health`
- Ensure API key is valid: `anytype auth apikey list`

**Sync Failures**
- Check permissions on target space
- Verify space still exists: `anytype space list`
- Review logs for specific error messages

**Performance**
- For large sync batches, use `--batch-size 50` (default: 100)
- Run sync during off-hours for production systems
- Monitor OpenClaw memory usage on constrained systems

## Security

- **Never commit API keys** to version control
- **Use environment variables** for production deployments
- **Rotate API keys** periodically via `anytype auth apikey revoke <key-id>`
- **Limit space access** by device and user through AnyType permissions
- **Self-host for privacy** — keep AnyType on your VPS/local network

## Architecture

```
OpenClaw Session
    ↓
[anytype-api.js] - HTTP client with auth
    ↓
[sync-notes.js] - Session export/formatting
    ↓
AnyType HTTP API (port 31012)
    ↓
AnyType Storage (MongoDB backend)
    ↓
Sync to Devices (via AnyType protocol)
```

Data flows one direction: OpenClaw → AnyType. To pull data from AnyType back into OpenClaw, use the query methods in anytype-api.js.
