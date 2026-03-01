# AnyType Workspace Sync - OpenClaw Integration

## Status

**File Watcher:** ✅ Running (systemd service: `anytype-workspace-sync.service`)
**gRPC Sync:** ✅ **COMPLETE** (authenticated gRPC on port 31010)
**Delete Support:** ✅ Implemented with object ID tracking
**Auto Token Renewal:** ✅ Self-healing authentication (v1.1.0)

## Quick Start for OpenClaw

### 1. Write Markdown Files

OpenClaw should write `.md` files to the workspace directory:

```javascript
const fs = require('fs').promises;
const path = require('path');

// Workspace directory on VPS
const WORKSPACE_DIR = '/root/anytype-workspace';

// Write a note to AnyType
async function writeToAnyType(filename, title, content) {
    const filepath = path.join(WORKSPACE_DIR, `${filename}.md`);
    const markdown = `# ${title}\n\n${content}`;

    await fs.writeFile(filepath, markdown, 'utf8');
    console.log(`✓ Written to AnyType: ${filename}`);
}

// Example usage
await writeToAnyType('meeting-notes', 'Meeting Notes', 'Discussion about project timeline...');
await writeToAnyType('task-list', 'Tasks for Today', '- [ ] Review PR\n- [ ] Update docs');
```

### 2. Update Existing Notes

Just overwrite the file - the sync service will detect the change:

```javascript
async function updateNote(filename, newContent) {
    const filepath = path.join(WORKSPACE_DIR, `${filename}.md`);
    await fs.writeFile(filepath, newContent, 'utf8');
    console.log(`✓ Updated: ${filename}`);
}
```

### 3. Delete Notes

Remove the file - the sync service will delete it from AnyType:

```javascript
async function deleteNote(filename) {
    const filepath = path.join(WORKSPACE_DIR, `${filename}.md`);
    await fs.unlink(filepath);
    console.log(`✓ Deleted: ${filename}`);
}
```

### 4. List Synced Files

```javascript
async function listSyncedFiles() {
    const files = await fs.readdir(WORKSPACE_DIR);
    return files.filter(f => f.endsWith('.md'));
}
```

## How It Works

```
OpenClaw (writes .md files)
        ↓
/root/anytype-workspace/
        ↓
anytype-workspace-sync (fsnotify watcher)
        ↓
gRPC Client (authenticated with session token)
        ↓
anytype serve (local gRPC server :31010)
        ↓
AnyType Space (self-hosted network)
        ↓
All AnyType Clients (desktop, mobile, web)
```

## File Format

### Simple Note

```markdown
# Note Title

This is the content of the note.

It can have multiple paragraphs.
```

### Note with Structure

```markdown
# Project Update

## Current Status

We're making good progress on the authentication system.

## Next Steps

- Implement token refresh
- Add error handling
- Write tests

## Notes

Remember to update the documentation.
```

**Important**: The first `# heading` becomes the note title in AnyType.

## Configuration

### Current Settings

| Setting | Value |
|---------|-------|
| **Workspace Directory** | `/root/anytype-workspace/` |
| **Space ID** | `bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws3dhn3uaxhh3u37k4.10piockh34xft` |
| **Bot Account** | `A8bgLxVCmHc4eRCzUi9bVLMXKEZjKFmqa8DExbNFTsLLXHr7` (claw-bot-v2) |
| **gRPC Port** | `127.0.0.1:31010` |
| **Network ID** | `N5Xkmn5vF7cwthDjh6avXem2q1Q56P5xkji19SDU8PQ9m6uD` |

### Service Management

```bash
# View sync status
systemctl status anytype-workspace-sync

# View live logs
journalctl -u anytype-workspace-sync -f

# Restart service
systemctl restart anytype-workspace-sync

# Check if anytype server is running
ps aux | grep 'anytype serve'

# Check gRPC port
ss -tlnp | grep 31010
```

## Sync Behavior

### Timing

- **File Change Detection**: < 1 second (fsnotify)
- **Debounce Period**: 2 seconds (prevents duplicate syncs)
- **gRPC Object Creation**: 100-300ms
- **Total Sync Time**: ~2-5 seconds from file write to AnyType

### What Gets Synced

✅ **CREATE**: New `.md` files are created as AnyType note objects
✅ **UPDATE**: Modified `.md` files update the corresponding AnyType objects
✅ **DELETE**: Deleted `.md` files are removed from AnyType
❌ **Non-.md files**: Ignored by the watcher

### Object ID Tracking

The sync service maintains a mapping in `/root/.anytype-workspace-objectmap.json`:

```json
{
  "meeting-notes": "bafyreihhafrdbvkjyp6j3lc2cmzrcdw5iqyfibnkz7yjrbkkyvtuur3bbu",
  "task-list": "bafyreihbbwwe7ppapdmxpmsztra74jotfdiupjgeptb2gyfcwezklm4qxi"
}
```

This allows proper deletion of objects when files are removed.

## OpenClaw Integration Examples

### Store Bot Memory to AnyType

```javascript
async function saveBotMemory(memoryData) {
    const content = `# Bot Memory Snapshot

**Timestamp**: ${new Date().toISOString()}

## Conversation Context
${memoryData.context}

## Recent Actions
${memoryData.actions.map(a => `- ${a}`).join('\n')}

## State
\`\`\`json
${JSON.stringify(memoryData.state, null, 2)}
\`\`\`
`;

    await writeToAnyType('bot-memory', 'Bot Memory Snapshot', content);
}
```

### Log Bot Events

```javascript
async function logEvent(eventType, details) {
    const timestamp = new Date().toISOString();
    const filename = `event-${Date.now()}`;

    const content = `# Event: ${eventType}

**Time**: ${timestamp}

## Details
${details}
`;

    await writeToAnyType(filename, `Event: ${eventType}`, content);
}
```

### Track Tasks from MongoDB

```javascript
// When OpenClaw detects a new task in MongoDB
async function syncTaskToAnyType(task) {
    const content = `# Task: ${task.title}

**Status**: ${task.status}
**Priority**: ${task.priority}
**Created**: ${task.createdAt}

## Description
${task.description}

## Notes
${task.notes || 'No notes yet.'}
`;

    const filename = `task-${task._id}`;
    await writeToAnyType(filename, `Task: ${task.title}`, content);
}

// When task is completed in MongoDB
async function completeTask(taskId) {
    const filename = `task-${taskId}`;
    await deleteNote(filename);
}
```

## Monitoring & Debugging

### Check Recent Sync Activity

```bash
# View last 50 sync events
journalctl -u anytype-workspace-sync -n 50

# View errors only
journalctl -u anytype-workspace-sync -p err -n 20

# Follow syncs in real-time
journalctl -u anytype-workspace-sync -f | grep -E "synced|deleted|error"
```

### Test Sync from Command Line

```bash
# Create test file
echo "# Test Note\nThis is a test" > /root/anytype-workspace/test.md

# Watch logs to see sync
journalctl -u anytype-workspace-sync -f

# Delete test file
rm /root/anytype-workspace/test.md
```

### Verify Object Map

```bash
# View all synced objects
cat /root/.anytype-workspace-objectmap.json | jq .

# Count synced objects
jq 'length' /root/.anytype-workspace-objectmap.json

# Check if specific file is tracked
jq '.["test"]' /root/.anytype-workspace-objectmap.json
```

## Automatic Token Renewal (v1.1.0)

The sync service now automatically handles expired session tokens:

When an auth error occurs:
1. 🔄 Detects "not authenticated" error
2. 🛑 Stops anytype server
3. ▶️  Starts new anytype server
4. 📥 Reloads fresh session token
5. 🔁 Retries failed operation

**You'll see these logs:**
```
⚠ Authentication error detected: not authenticated
🔄 Attempting to refresh session token...
  → Stopping anytype server...
  → Starting anytype server...
  → Waiting for server to initialize...
  → Reading new session token...
✓ Session token refreshed successfully
🔁 Retrying operation with refreshed token...
```

**No manual intervention required!**

## Troubleshooting

### Files Not Syncing

**Check service status:**
```bash
systemctl status anytype-workspace-sync
```

**Check anytype server:**
```bash
ps aux | grep 'anytype serve'
ss -tlnp | grep 31010
```

**View recent errors:**
```bash
journalctl -u anytype-workspace-sync -p err -n 20
```

### Authentication Errors

The service now automatically refreshes tokens. If it fails:

```bash
# Manually restart everything
pkill -f 'anytype serve'
sleep 5
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &
sleep 10
systemctl restart anytype-workspace-sync
```

### Object Map Issues

If files and objects get out of sync:

```bash
# Reset object map (files will resync, creating duplicates in AnyType)
rm /root/.anytype-workspace-objectmap.json
systemctl restart anytype-workspace-sync
```

## Best Practices for OpenClaw

### File Naming

✅ **Good**: `task-123.md`, `memory-snapshot.md`, `event-2026-03-01.md`
❌ **Avoid**: Files with spaces, special characters, or very long names

### Content Structure

- Always start with `# Title` for proper note naming in AnyType
- Use markdown formatting (headers, lists, code blocks)
- Keep files focused on a single topic
- Use descriptive titles

### Performance

- **Batch writes**: If creating many notes, write them all at once
- **Debounce updates**: Don't rapidly modify the same file
- **File size**: Keep files under 1MB for fast sync

### Integration Pattern

```javascript
class AnyTypeSync {
    constructor() {
        this.workspaceDir = '/root/anytype-workspace';
    }

    async write(id, title, content) {
        const filepath = path.join(this.workspaceDir, `${id}.md`);
        const markdown = `# ${title}\n\n${content}`;
        await fs.writeFile(filepath, markdown, 'utf8');
    }

    async update(id, content) {
        await this.write(id, content.split('\n')[0].replace('# ', ''), content);
    }

    async delete(id) {
        const filepath = path.join(this.workspaceDir, `${id}.md`);
        await fs.unlink(filepath);
    }

    async list() {
        const files = await fs.readdir(this.workspaceDir);
        return files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
    }
}

// Usage in OpenClaw
const anytype = new AnyTypeSync();

// When MongoDB document changes
mongoChangeStream.on('change', async (change) => {
    const doc = change.fullDocument;
    await anytype.write(
        `mongo-${doc._id}`,
        doc.title,
        formatDocumentAsMarkdown(doc)
    );
});
```

## Architecture

See detailed documentation:
- [SYSTEM_FLOW.md](code/anytype-workspace-sync/SYSTEM_FLOW.md) - Complete flow diagrams
- [README.md](code/anytype-workspace-sync/README.md) - Technical reference
- [TROUBLESHOOTING.md](code/anytype-workspace-sync/TROUBLESHOOTING.md) - Diagnostic guide

---

**Last Updated**: 2026-03-01 (v1.1.0 with automatic token renewal)
**Status**: ✅ Production Ready
**GitHub**: https://github.com/robouden/openclaw-workspace/tree/master/code/anytype-workspace-sync
