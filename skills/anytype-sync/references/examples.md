# Real-World Integration Examples

Practical patterns for syncing OpenClaw with AnyType.

## Example 1: Daily Session Backup

Auto-backup each day's work to a persistent page in AnyType.

### Setup

1. Create a cron job that runs every morning:

```bash
# /etc/cron.d/openclaw-daily-sync
0 2 * * * node /opt/openclaw/skills/anytype-sync/scripts/sync-notes.js \
  --sessionKey main \
  --type backup \
  >> /var/log/openclaw-sync.log 2>&1
```

2. Configure in `.openclaw/openclaw.json`:

```json
{
  "anytype": {
    "apiUrl": "http://127.0.0.1:31012",
    "apiKey": "your-api-key",
    "spaceId": "your-space-id"
  },
  "sync": {
    "enabled": true,
    "schedule": "daily",
    "backupPath": "/var/backups/openclaw"
  }
}
```

### Result

Each morning, your OpenClaw session history, memory files, and notes are automatically saved as a new AnyType page with today's date and tags like `#openclaw #session #backup`.

---

## Example 2: Team Workspace (Multi-User)

Multiple OpenClaw instances (different team members) backing up to a shared AnyType workspace.

### Setup

Create a shared bot account on your self-hosted AnyType:

```bash
# On VPS
anytype auth create team-bot-account
anytype auth apikey create team-sync-key
anytype space list  # Note the space ID
```

Share the credentials with team members via secure channel (1Password, LastPass, etc.):

```env
ANYTYPE_API_URL=https://anytype.company.internal
ANYTYPE_API_KEY=team-key-abc123xyz
ANYTYPE_SPACE_ID=bafyrei...
```

Each team member runs locally:

```bash
# Install skill on their machine
npm install -g @openclaw/anytype-sync

# Configure with shared credentials
export ANYTYPE_API_URL="https://anytype.company.internal"
export ANYTYPE_API_KEY="team-key-abc123xyz"
export ANYTYPE_SPACE_ID="bafyrei..."

# Enable periodic sync
node sync-notes.js --continuous --interval 3600000  # 1 hour
```

### Result

Each team member's OpenClaw sessions are automatically backed up to a shared workspace. Add tags by role (`#frontend`, `#backend`, `#ops`) to organize.

---

## Example 3: Query AnyType from OpenClaw

Read stored notes back into OpenClaw for context in responses.

### Script

```javascript
// custom-skill/get-context.js
const { createClient } = require('anytype-sync/scripts/anytype-api.js');

async function getRecentNotes(query) {
  const client = createClient({
    apiUrl: process.env.ANYTYPE_API_URL,
    apiKey: process.env.ANYTYPE_API_KEY,
    spaceId: process.env.ANYTYPE_SPACE_ID
  });

  // Search for recent sessions matching query
  const results = await client.queryPages({
    query: query,
    tags: ['openclaw'],
    limit: 5
  });

  // Format for context
  let context = '## Recent Context from AnyType\n\n';
  results.objects.forEach(obj => {
    context += `- **${obj.name}** (${obj.created})\n`;
  });

  return context;
}

module.exports = { getRecentNotes };
```

### Usage in OpenClaw

```javascript
// In your OpenClaw agent code
const { getRecentNotes } = require('./get-context.js');

async function respond(userMessage) {
  // Add context from recent sessions
  const context = await getRecentNotes(userMessage);
  
  const systemPrompt = `You are an assistant with access to past session notes.
${context}

Use this context to inform your response.`;

  // ... rest of your response logic
}
```

---

## Example 4: Continuous Sync with Slack

Stream OpenClaw activity to AnyType while using Slack as chat interface.

### Setup

1. Configure OpenClaw Slack bot on VPS (already done in your setup)

2. Add sync as a skill command:

```javascript
// slack-command-handler.js
const sync = require('anytype-sync/scripts/sync-notes.js');

exports.handleSlackCommand = async (command, args) => {
  if (command === 'sync') {
    const result = await sync.syncAsNewPage();
    return `✅ Synced to AnyType: ${result.id}`;
  }
  if (command === 'query') {
    const results = await sync.queryPages(args.join(' '));
    return `Found ${results.length} pages: ${results.map(r => r.name).join(', ')}`;
  }
};
```

3. In Slack:

```
@openclaw sync
> ✅ Synced to AnyType: bafyrei...

@openclaw query "project-x"
> Found 3 pages: Project X Notes, Project X Decisions, Project X Roadmap
```

---

## Example 5: Archive Old Sessions

Automatically compress and archive old sessions.

### Script

```bash
#!/bin/bash
# archive-old-sessions.sh

API_KEY=$ANYTYPE_API_KEY
SPACE_ID=$ANYTYPE_SPACE_ID

# Query sessions older than 30 days
AGE_THRESHOLD=$((30 * 24 * 60 * 60))
NOW=$(date +%s)

curl -s -H "Authorization: Bearer $API_KEY" \
  "http://127.0.0.1:31012/api/v1/objects?space=$SPACE_ID&tags=openclaw" | \
  jq -r '.objects[] | select((.created | tonumber) < ('$NOW' - '$AGE_THRESHOLD')) | .id' | \
  while read PAGE_ID; do
    echo "Archiving $PAGE_ID..."
    curl -X PATCH -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"tags": ["archived", "openclaw"]}' \
      "http://127.0.0.1:31012/api/v1/objects/$PAGE_ID"
  done

echo "Archive complete"
```

### Cron

```bash
# Monthly archive
0 0 1 * * /opt/scripts/archive-old-sessions.sh
```

---

## Example 6: Full-Text Search via AnyType

Index your entire session history and make it searchable.

### Usage

```bash
# Search for sessions containing "project-x"
node sync-notes.js --export markdown --output project-x-sessions.md

# Or query via API
curl -s -H "Authorization: Bearer $ANYTYPE_API_KEY" \
  "http://127.0.0.1:31012/api/v1/objects?space=$ANYTYPE_SPACE_ID&q=project-x" | \
  jq '.objects[] | {name, created, snippet: .content[0:200]}'
```

---

## Example 7: Integration with External Tools

Pipe AnyType data to other tools via OpenClaw.

### Example: Sync to Obsidian

```bash
#!/bin/bash
# sync-to-obsidian.sh

# Export all AnyType pages as markdown
node sync-notes.js --export markdown --output /tmp/anytype-export.md

# Split into individual files for Obsidian vault
mkdir -p ~/Obsidian\ Vault/OpenClaw
csplit /tmp/anytype-export.md '/^# /' '{*}'

# Move to vault
mv xx* ~/Obsidian\ Vault/OpenClaw/

echo "Synced to Obsidian"
```

---

## Example 8: Self-Hosted Setup on Docker

Run OpenClaw + AnyType on a single VPS with Docker.

### docker-compose.yml

```yaml
version: '3.8'
services:
  anytype:
    image: anytype:latest
    ports:
      - "127.0.0.1:31010:31010"  # gRPC
      - "127.0.0.1:31011:31011"  # gRPC-Web
      - "127.0.0.1:31012:31012"  # HTTP API
    volumes:
      - anytype-data:/root/.anytype
    environment:
      - ANYTYPE_LOG_LEVEL=info

  openclaw:
    image: openclaw:latest
    ports:
      - "127.0.0.1:18789:18789"
    volumes:
      - openclaw-workspace:/root/.openclaw/workspace
    environment:
      - ANYTYPE_API_URL=http://anytype:31012
      - ANYTYPE_API_KEY=${ANYTYPE_API_KEY}
      - ANYTYPE_SPACE_ID=${ANYTYPE_SPACE_ID}
    depends_on:
      - anytype

volumes:
  anytype-data:
  openclaw-workspace:
```

Deploy:

```bash
export ANYTYPE_API_KEY="your-key"
export ANYTYPE_SPACE_ID="your-space-id"

docker-compose up -d
```

---

## Example 9: Monitoring & Alerting

Monitor sync health and get alerts if sync fails.

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

LOG_FILE="/var/log/anytype-sync.log"
ERROR_COUNT=$(grep -c ERROR "$LOG_FILE" | tail -100)

if [ "$ERROR_COUNT" -gt 5 ]; then
  echo "⚠️ AnyType sync has $ERROR_COUNT errors in last 100 lines"
  # Send Slack alert
  curl -X POST $SLACK_WEBHOOK -d '{
    "text": "OpenClaw AnyType sync degraded: '$ERROR_COUNT' errors"
  }'
fi
```

Cron:

```bash
# Check every hour
0 * * * * /opt/scripts/health-check.sh
```

---

## Example 10: Development & Testing

Test the sync script locally before deploying.

### Test Script

```bash
#!/bin/bash
# test-sync.sh

set -e

echo "1. Testing API connection..."
node scripts/anytype-api.js \
  --apiKey "$ANYTYPE_API_KEY" \
  --spaceId "$ANYTYPE_SPACE_ID" \
  list-spaces

echo "2. Testing session sync..."
node scripts/sync-notes.js \
  --sessionKey test \
  --verbose

echo "3. Testing query..."
node scripts/anytype-api.js \
  --apiKey "$ANYTYPE_API_KEY" \
  --spaceId "$ANYTYPE_SPACE_ID" \
  query "test"

echo "✅ All tests passed"
```

Run before deploying:

```bash
./test-sync.sh && echo "Ready to deploy"
```

---

## Troubleshooting Common Issues

### Sync is slow

- Check network latency to AnyType server
- Reduce `batchSize` in config (default 100)
- Run sync during off-hours

### Pages not appearing in AnyType

- Verify API key is valid: `anytype auth apikey list`
- Check space ID exists: `anytype space list`
- Review logs: `tail -f /var/log/anytype-sync.log`

### Sync stops running

- Check cron logs: `grep CRON /var/log/syslog`
- Verify environment variables are set: `env | grep ANYTYPE`
- Restart service: `systemctl restart openclaw`

