---
name: anytype-sync
description: "Sync OpenClaw session notes and data to AnyType self-hosted or cloud workspaces. Use when: (1) backing up and syncing session conversation history, (2) storing structured notes in a collaborative workspace, (3) querying/retrieving data from AnyType, (4) integrating OpenClaw with AnyType for continuous data synchronization."
---

# AnyType Sync

Query and monitor AnyType workspaces directly from OpenClaw via MongoDB. Perfect for teams wanting OpenClaw to understand and act on shared workspace data.

## Quick Start

### 1. Prerequisites

AnyType running on your system with:
- MongoDB available (usually on `localhost:27017`)
- Bot account created and logged in
- At least one space configured

See `references/setup-guide.md` for complete bot account setup.

### 2. Query AnyType Data

```bash
# List all spaces
node scripts/anytype-db.js spaces

# Get space summary
node scripts/anytype-db.js summary bafyrei...

# Monitor for changes in real-time
node scripts/anytype-db.js monitor bafyrei... 30
```

### 3. Use in OpenClaw

```javascript
const { AnytypeDB } = require('./scripts/anytype-db.js');

// Connect to MongoDB
const anytype = new AnytypeDB();
await anytype.connect();

// Query spaces
const spaces = await anytype.listSpaces();
const summary = await anytype.getSpaceSummary(spaceId);

// Watch for changes
const stream = await anytype.watchSpace(spaceId, (change) => {
  console.log('Workspace changed!', change);
});

// Clean up
await anytype.disconnect();
```

## How It Works

**Direct MongoDB Access:**

OpenClaw queries AnyType's MongoDB databases directly (no API needed):

### 1. List & Discover Spaces
```javascript
const spaces = await anytype.listSpaces();
// Get all workspaces available to the bot account
```

### 2. Query Workspace Objects
```javascript
const payloads = await anytype.getPayloadsBySpace(spaceId);
// Get all objects/pages in a space
```

### 3. Monitor for Changes
```javascript
const stream = await anytype.watchSpace(spaceId, (change) => {
  // React to new/updated objects in real-time
});
```

### 4. Get Activity & Context
```javascript
const activity = await anytype.getRecentActivity(spaceId);
// See what's been happening in the workspace
```

## API Reference

See `scripts/anytype-db.js` for the MongoDB client.

**Available Methods:**

```javascript
const { AnytypeDB } = require('./scripts/anytype-db.js');
const anytype = new AnytypeDB();
await anytype.connect();

// Spaces
const spaces = await anytype.listSpaces();
const space = await anytype.getSpace(spaceId);

// Objects
const payloads = await anytype.getPayloadsBySpace(spaceId);
const count = await anytype.getPayloadCount(spaceId);

// Activity
const summary = await anytype.getSpaceSummary(spaceId);
const activity = await anytype.getRecentActivity(spaceId, limit);
const messages = await anytype.getInboxMessages();

// Watch for changes
const stream = await anytype.watchSpace(spaceId, callback);

// Cleanup
await anytype.disconnect();
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
