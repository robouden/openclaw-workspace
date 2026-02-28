---
name: anytype-sync
description: "Query and monitor AnyType workspaces from OpenClaw via MongoDB. Use when: (1) listing workspace spaces, (2) querying object counts in spaces, (3) getting workspace summaries, (4) monitoring team activity in AnyType, (5) taking actions based on workspace data."
---

# AnyType Sync

Query AnyType workspaces directly from OpenClaw. Perfect for team collaboration — monitor workspace changes and take automated actions via Slack or other channels.

## Quick Start

### 1. Prerequisites

- AnyType running with MongoDB (localhost:27017)
- Go binary compiled: `anytype-db` (pre-built in skill)
- OpenClaw with Slack bot enabled (optional, for notifications)

### 2. Basic Commands

```bash
# List all spaces
anytype-db spaces

# Get space summary (object count, recent activity)
anytype-db summary <space-id>

# Count objects in a space
anytype-db count <space-id>

# Get recent activity
anytype-db activity <space-id>
```

### 3. Use in OpenClaw

Add to your OpenClaw config or as a Slack command:

```javascript
// Query workspace
const { execSync } = require('child_process');

const result = execSync('/path/to/anytype-db spaces');
console.log(result.toString());
```

## How It Works

**Direct MongoDB Access:**

The skill includes a compiled Go binary (`anytype-db`) that queries AnyType's MongoDB directly:

```
AnyType Workspace (MongoDB)
    ↓
anytype-db (Go CLI tool)
    ↓
OpenClaw
    ↓
Slack / Actions / Responses
```

**No APIs, no intermediaries.** Just direct database queries.

## Available Commands

### List Spaces

```bash
anytype-db spaces
```

Shows all workspaces available to the bot account:
- Space ID (bafyrei...)
- Identity (account that created it)
- Shareable status

**Example:**
```
23 spaces found:

  ID: bafyreibwatfpuq23i74kdfzev5woe64aduy6u4fuijljmzycoawuanjmmq.35fpfsusofs1o
  Identity: A6JZwRq6eouJi4F5pumdZug7rG2jNLkGDBpKEwkDPUV96ZtS
  Shareable: true
```

### Space Summary

```bash
anytype-db summary <space-id>
```

Get workspace overview:
- Total objects in space
- Recent activity
- Last modified timestamp

**Example output:**
```json
{
  "spaceId": "bafyrei...",
  "totalObjects": 42,
  "recentActivity": [...],
  "lastUpdated": "2026-02-28T14:00:00Z"
}
```

### Count Objects

```bash
anytype-db count <space-id>
```

Get object count for a space (useful for monitoring changes):
```
42 payloads in space bafyrei...
```

### Recent Activity

```bash
anytype-db activity <space-id>
```

Show recent changes:
```
5 recent activities:

  2026-02-28T14:00:00Z: page_created
  2026-02-28T13:55:00Z: page_updated
  ...
```

## Integration Examples

### Slack Command Handler

Add to your OpenClaw Slack bot:

```javascript
const { execSync } = require('child_process');

async function handleSlackCommand(cmd, args) {
  const binaryPath = '/path/to/anytype-db';
  
  if (cmd === 'spaces') {
    const result = execSync(`${binaryPath} spaces`);
    return result.toString();
  }
  
  if (cmd === 'summary') {
    const spaceId = args[0];
    const result = execSync(`${binaryPath} summary ${spaceId}`);
    const summary = JSON.parse(result.toString());
    return `Space has ${summary.totalObjects} objects`;
  }
  
  return 'Unknown command';
}

// Usage:
// @openclaw anytype spaces
// @openclaw anytype summary bafyrei...
```

### Monitor Workspace Changes

```javascript
const { execSync } = require('child_process');
const cron = require('node-cron');

const binaryPath = '/path/to/anytype-db';
let previousCount = 0;

// Check every 5 minutes
cron.schedule('*/5 * * * *', () => {
  const result = execSync(`${binaryPath} count <space-id>`);
  const match = result.toString().match(/(\d+) payloads/);
  const currentCount = parseInt(match[1]);
  
  if (currentCount > previousCount) {
    const added = currentCount - previousCount;
    console.log(`🎉 ${added} new objects added to workspace!`);
    // Post to Slack, trigger action, etc.
  }
  
  previousCount = currentCount;
});
```

### Sync to Slack

```javascript
const { execSync } = require('child_process');
const { WebClient } = require('@slack/web-api');

const slack = new WebClient(process.env.SLACK_TOKEN);
const binaryPath = '/path/to/anytype-db';

async function postWorkspaceUpdate(spaceId, slackChannel) {
  const result = execSync(`${binaryPath} summary ${spaceId}`);
  const summary = JSON.parse(result.toString());
  
  await slack.chat.postMessage({
    channel: slackChannel,
    text: `📊 Workspace Update: ${summary.totalObjects} objects`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Workspace Activity*\n` +
                `Objects: ${summary.totalObjects}\n` +
                `Last updated: ${summary.lastUpdated}`
        }
      }
    ]
  });
}
```

## Configuration

### MongoDB Connection

By default connects to: `mongodb://127.0.0.1:27017`

Override with environment variable:

```bash
export MONGODB_URL=mongodb://user:pass@host:27017
anytype-db spaces
```

### Binary Location

The compiled `anytype-db` binary is located at:
```
~/.openclaw/workspace/skills/anytype-sync/cmd/anytype-db/main.go
```

Compiled binary path (after building):
```
~/.openclaw/workspace/skills/anytype-sync/anytype-db
```

## Building from Source

```bash
cd ~/.openclaw/workspace/skills/anytype-sync

# Requires Go 1.21+
go mod tidy
go build -o anytype-db ./cmd/anytype-db

# Test it
./anytype-db spaces
```

## Troubleshooting

### "Connection refused"
MongoDB not running. Start AnyType:
```bash
anytype serve
```

### "23 spaces found" but empty
AnyType needs a running instance. The bot account must be logged in:
```bash
anytype auth status
```

### Binary not found
Compile it first:
```bash
cd skills/anytype-sync
go build -o anytype-db ./cmd/anytype-db
```

## Architecture

```
┌─────────────────────────────────────┐
│  AnyType Desktop/Web UI             │
│  (Team creates/edits pages)         │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  MongoDB (localhost:27017)          │
│  - Stores spaces, objects, activity │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  anytype-db (Go CLI)                │
│  Direct MongoDB queries             │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  OpenClaw                           │
│  - Query workspaces                 │
│  - Monitor changes                  │
│  - Post to Slack                    │
│  - Take automated actions           │
└─────────────────────────────────────┘
```

## API Reference

See `scripts/anytype-db/main.go` for the source code.

**Available Go functions:**

```go
db := New("mongodb://127.0.0.1:27017")
defer db.Disconnect()

spaces, _ := db.ListSpaces()
space, _ := db.GetSpace(spaceID)
count, _ := db.CountPayloads(spaceID)
summary, _ := db.GetSpaceSummary(spaceID)
activity, _ := db.GetRecentActivity(spaceID, limit)
```

## Next Steps

- See `references/setup-guide.md` for bot account setup
- See `references/examples.md` for integration patterns
- See `cmd/anytype-db/main.go` for source code

## Support

- GitHub: https://github.com/robouden/openclaw-workspace
- Issues: https://github.com/robouden/openclaw-workspace/issues
