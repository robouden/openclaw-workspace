# OpenClaw → AnyType Integration Guide

**Simple guide for OpenClaw to sync data to AnyType**

## Quick Answer: Just Write Markdown Files!

The easiest way to sync to AnyType is to **write markdown files** to `/root/anytype-workspace/` on the VPS. That's it! The sync service watches that directory and automatically syncs to AnyType within 2-5 seconds.

---

## Option 1: Write Files Directly (Simplest)

### From OpenClaw's Code

```javascript
const fs = require('fs').promises;

// Write a note to AnyType
async function writeToAnyType(filename, title, content) {
    const filepath = `/root/anytype-workspace/${filename}.md`;
    const markdown = `# ${title}\n\n${content}`;

    await fs.writeFile(filepath, markdown, 'utf8');
    console.log(`✓ Written to AnyType: ${filename}`);
    // File automatically syncs to AnyType within 2-5 seconds!
}

// Example usage
await writeToAnyType('my-note', 'My Note Title', 'This is the content...');
```

### What You Can Do

**Create/Update Notes:**
```javascript
await fs.writeFile('/root/anytype-workspace/note.md', '# Title\n\nContent...', 'utf8');
// ✓ Syncs to AnyType automatically
```

**Delete Notes:**
```javascript
await fs.unlink('/root/anytype-workspace/note.md');
// ✓ Deletes from AnyType automatically
```

**List Synced Notes:**
```javascript
const files = await fs.readdir('/root/anytype-workspace');
const notes = files.filter(f => f.endsWith('.md'));
console.log('Synced notes:', notes);
```

---

## Option 2: Use the Helper Module (Recommended)

### Setup

```javascript
// Import the helper
const AnyType = require('./code/anytype-helper');
const anytype = new AnyType();
```

### Basic Operations

**Write a Note:**
```javascript
await anytype.write('note-id', 'Note Title', 'Content here...');
// ✓ Creates /root/anytype-workspace/note-id.md
// ✓ Syncs to AnyType automatically
```

**Update a Note:**
```javascript
await anytype.update('note-id', '# Updated Title\n\nNew content...');
// ✓ Updates the file
// ✓ Syncs to AnyType automatically
```

**Delete a Note:**
```javascript
await anytype.delete('note-id');
// ✓ Deletes the file
// ✓ Deletes from AnyType automatically
```

**Read a Note:**
```javascript
const content = await anytype.read('note-id');
console.log(content);
```

**List All Notes:**
```javascript
const notes = await anytype.list();
console.log('All synced notes:', notes);
// ['note-id', 'another-note', ...]
```

---

## Option 3: Sync MongoDB Data to AnyType

### Auto-Format MongoDB Documents

```javascript
const AnyType = require('./code/anytype-helper');
const anytype = new AnyType();

// When a document changes in MongoDB
mongoChangeStream.on('change', async (change) => {
    const doc = change.fullDocument;

    // Automatically formats and syncs to AnyType
    await anytype.syncFromMongo(doc);
});
```

### Manual Format

```javascript
// Convert MongoDB doc to AnyType note
const doc = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Task: Fix Bug',
    status: 'in-progress',
    priority: 'high',
    description: 'Users unable to login',
    createdAt: new Date()
};

await anytype.syncFromMongo(doc);
// ✓ Creates: /root/anytype-workspace/mongo-507f1f77bcf86cd799439011.md
// ✓ Syncs to AnyType automatically
```

---

## Option 4: Task Tracking

### Create Task Notes

```javascript
await anytype.createTask({
    id: '123',
    title: 'Fix authentication bug',
    description: 'Users unable to login after password reset',
    status: 'in-progress',
    priority: 'high'
});
// ✓ Creates: /root/anytype-workspace/task-123.md
```

### Update Task Status

```javascript
await anytype.updateTaskStatus('123', 'completed');
// ✓ Updates the status in the note
// ✓ Syncs to AnyType automatically
```

### Delete Completed Task

```javascript
await anytype.delete('task-123');
// ✓ Deletes from filesystem and AnyType
```

---

## Option 5: Create Logs

### Timestamped Log Entries

```javascript
const logId = await anytype.log('System Event', 'Server restarted successfully');
// ✓ Creates: /root/anytype-workspace/log-1709305200000.md
// ✓ Includes timestamp automatically
// Returns: 'log-1709305200000'
```

### Custom Log Prefix

```javascript
const eventId = await anytype.log('Error Occurred', 'Database connection failed', 'error');
// ✓ Creates: /root/anytype-workspace/error-1709305200000.md
```

---

## Query AnyType Data via MongoDB?

**Short Answer**: You can't query AnyType directly via MongoDB. AnyType uses its own database (not MongoDB).

**What You CAN Do**:
1. **Write from MongoDB to AnyType** (one-way sync)
   - Use `anytype.syncFromMongo(doc)` to push MongoDB data to AnyType

2. **Read from AnyType** (via the file system)
   - Read files from `/root/anytype-workspace/` to see what's synced

3. **Store mapping in MongoDB**
   - Keep track of which MongoDB docs map to which AnyType notes

```javascript
// Example: Track sync status in MongoDB
await mongoCollection.updateOne(
    { _id: docId },
    {
        $set: {
            anytypeSynced: true,
            anytypeNoteId: 'task-123',
            anytypeSyncedAt: new Date()
        }
    }
);
```

---

## Call Node.js Helper from Anywhere

### From OpenClaw's Main Process

```javascript
const AnyType = require('/root/openclaw-workspace/code/anytype-helper');
const anytype = new AnyType();

// Use anywhere in OpenClaw
await anytype.write('bot-status', 'Bot Status', 'OpenClaw is running...');
```

### From OpenClaw's Event Handlers

```javascript
// When OpenClaw receives a message
bot.on('message', async (msg) => {
    await anytype.log('Message Received', `From: ${msg.author}\n\n${msg.content}`);
});

// When OpenClaw completes a task
bot.on('taskComplete', async (task) => {
    await anytype.updateTaskStatus(task.id, 'completed');
});
```

### From OpenClaw's MongoDB Watchers

```javascript
// Watch MongoDB for changes
const changeStream = collection.watch();

changeStream.on('change', async (change) => {
    if (change.operationType === 'insert') {
        await anytype.syncFromMongo(change.fullDocument);
    }

    if (change.operationType === 'delete') {
        await anytype.delete(`mongo-${change.documentKey._id}`);
    }
});
```

---

## Best Practices

### 1. Use Meaningful Filenames

✅ **Good**: `task-123`, `user-note-456`, `system-log-789`
❌ **Bad**: `temp`, `test123`, `asdf`

### 2. Always Include Title

```javascript
// ✅ Good - has a clear title
await anytype.write('note', 'Meeting Notes', 'Discussed project timeline...');

// ❌ Bad - no title, uses filename as title
await anytype.write('note', 'note', 'Content...');
```

### 3. Don't Rapidly Update Same File

```javascript
// ❌ Bad - will trigger multiple syncs
for (let i = 0; i < 100; i++) {
    await anytype.write('counter', 'Counter', `Count: ${i}`);
}

// ✅ Good - batch and write once
let content = '';
for (let i = 0; i < 100; i++) {
    content += `Count ${i}\n`;
}
await anytype.write('counter', 'Counter Results', content);
```

### 4. Use Try-Catch for Error Handling

```javascript
try {
    await anytype.write('note', 'Title', 'Content');
    console.log('✓ Synced to AnyType');
} catch (error) {
    console.error('✗ Sync failed:', error.message);
    // Handle error - maybe retry or log to MongoDB
}
```

---

## Complete Example: OpenClaw Integration

```javascript
const AnyType = require('./code/anytype-helper');
const MongoClient = require('mongodb').MongoClient;

class OpenClawAnyTypeSync {
    constructor() {
        this.anytype = new AnyType();
    }

    // Sync bot memory to AnyType
    async saveBotMemory(memory) {
        const content = `# Bot Memory Snapshot

**Timestamp**: ${new Date().toISOString()}

## Context
${memory.context}

## Recent Actions
${memory.actions.map(a => `- ${a}`).join('\n')}

## Current State
\`\`\`json
${JSON.stringify(memory.state, null, 2)}
\`\`\`
`;

        await this.anytype.write('bot-memory', 'Bot Memory', content);
    }

    // Sync MongoDB tasks to AnyType
    async syncTasksFromMongo(mongoUri) {
        const client = await MongoClient.connect(mongoUri);
        const db = client.db('openclaw');
        const tasks = await db.collection('tasks').find({}).toArray();

        for (const task of tasks) {
            await this.anytype.createTask({
                id: task._id.toString(),
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority
            });
        }

        console.log(`✓ Synced ${tasks.length} tasks to AnyType`);
    }

    // Watch MongoDB and sync changes
    async watchMongo(mongoUri) {
        const client = await MongoClient.connect(mongoUri);
        const db = client.db('openclaw');
        const collection = db.collection('tasks');

        const changeStream = collection.watch();

        changeStream.on('change', async (change) => {
            if (change.operationType === 'insert' || change.operationType === 'update') {
                await this.anytype.syncFromMongo(change.fullDocument);
                console.log(`✓ Synced ${change.documentKey._id} to AnyType`);
            }

            if (change.operationType === 'delete') {
                await this.anytype.delete(`mongo-${change.documentKey._id}`);
                console.log(`✓ Deleted ${change.documentKey._id} from AnyType`);
            }
        });

        console.log('✓ Watching MongoDB for changes...');
    }
}

// Usage
const sync = new OpenClawAnyTypeSync();
await sync.saveBotMemory(botMemory);
await sync.watchMongo('mongodb://localhost:27017');
```

---

## Monitoring & Debugging

### Check Sync Status on VPS

```bash
# View live sync logs
ssh root@65.108.24.131 "journalctl -u anytype-workspace-sync -f"

# Check service status
ssh root@65.108.24.131 "systemctl status anytype-workspace-sync"

# List synced files
ssh root@65.108.24.131 "ls -la /root/anytype-workspace/"
```

### Test from Command Line

```bash
# Create test note
ssh root@65.108.24.131 "echo '# Test\nThis is a test' > /root/anytype-workspace/test.md"

# Wait 5 seconds, check if it synced
ssh root@65.108.24.131 "journalctl -u anytype-workspace-sync -n 10"
# Should show: ✓ test synced to AnyType

# Delete test note
ssh root@65.108.24.131 "rm /root/anytype-workspace/test.md"
```

---

## FAQ

### Q: How fast does it sync?
**A**: 2-5 seconds from file write to AnyType.

### Q: What happens if the token expires?
**A**: The service automatically refreshes the token and retries. No manual intervention needed! (v1.1.0)

### Q: Can I sync images or PDFs?
**A**: No, only `.md` (markdown) files are synced.

### Q: What if two processes write to the same file?
**A**: Last write wins. There's no conflict resolution (yet).

### Q: Can I read data FROM AnyType into MongoDB?
**A**: Not currently. This is one-way sync (MongoDB/OpenClaw → AnyType only).

### Q: Where are the files stored?
**A**: VPS at `/root/anytype-workspace/` (watched by the sync service)

### Q: How do I know if a file synced successfully?
**A**: Check the logs: `journalctl -u anytype-workspace-sync -f`

---

## Summary: What OpenClaw Can Do

✅ **Write notes to AnyType** (via markdown files)
✅ **Update existing notes** (overwrite files)
✅ **Delete notes** (remove files)
✅ **Sync MongoDB data** (use helper to format)
✅ **Track tasks** (structured task notes)
✅ **Create logs** (timestamped events)
✅ **Auto-sync** (2-5 second latency)
✅ **Self-healing** (automatic token renewal)

❌ **Can't query AnyType via MongoDB** (different databases)
❌ **Can't read FROM AnyType** (one-way sync only)
❌ **Can't sync non-markdown files** (only `.md` files)

---

**Need Help?**
- Check logs: `journalctl -u anytype-workspace-sync -f`
- Read full docs: [README.md](code/anytype-workspace-sync/README.md)
- Integration guide: [ANYTYPE_SYNC_SETUP.md](ANYTYPE_SYNC_SETUP.md)

**GitHub**: https://github.com/robouden/openclaw-workspace
