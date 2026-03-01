# AnyType Slack Integration Setup

Connect the AnyType Slack handler to your OpenClaw bot.

## Prerequisites

- OpenClaw bot running with Slack connected
- AnyType bot account set up (see main SKILL.md)
- MongoDB accessible to OpenClaw (localhost:27017)

## Installation

### Option A: Add to Your OpenClaw Plugin (Recommended)

1. Copy the handler into your OpenClaw plugin system:

```bash
cp slack/handler.js ~/.openclaw/plugins/anytype-slack.js
```

2. Register the handler in your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "slack": {
    "handlers": [
      {
        "name": "anytype",
        "path": "~/.openclaw/plugins/anytype-slack.js",
        "export": "AnytypeSlackHandler",
        "enabled": true,
        "trigger": "message:anytype.*"
      }
    ]
  }
}
```

3. Restart OpenClaw:

```bash
openclaw gateway restart
```

### Option B: Manual Message Middleware

If your OpenClaw setup uses message middleware, add to your middleware chain:

```javascript
const { AnytypeSlackHandler } = require('./slack/handler.js');

// Initialize with Slack client
const anytypeHandler = new AnytypeSlackHandler(slackClient, {
  mongoUrl: 'mongodb://127.0.0.1:27017'
});

// In your message handler:
async function handleMessage(message) {
  // Check if this is an anytype command
  if (message.text && message.text.includes('anytype')) {
    return await anytypeHandler.handle(message);
  }
  // ... other handlers
}
```

### Option C: Custom Slash Command

Set up a Slack slash command handler:

```javascript
const { AnytypeSlackHandler } = require('./slack/handler.js');

const handler = new AnytypeSlackHandler(slackClient);

app.command('/anytype', async ({ ack, body, respond }) => {
  await ack();
  
  const message = {
    text: body.text,
    channel: body.channel_id,
    ts: body.response_url
  };
  
  await handler.handle(message);
});
```

## Usage

Once installed, team members can use:

### List Workspaces
```
@openclaw anytype spaces
```

### Get Workspace Summary
```
@openclaw anytype summary bafyreibwatfpuq23i74kdfzev5woe64aduy6u4fuijljmzycoawuanjmmq.35fpfsusofs1o
```

### Count Objects
```
@openclaw anytype count <space-id>
```

### See Recent Activity
```
@openclaw anytype activity <space-id>
```

### Get Help
```
@openclaw anytype help
```

## Response Format

Responses are formatted as Slack blocks for nice display:

- **Spaces** → Header with shareable status and full space IDs
- **Summary** → Fields showing object count and last updated time
- **Count** → Simple emoji message with count
- **Activity** → List of recent changes with timestamps
- **Errors** → Red error blocks with helpful hints

## Configuration Options

Pass options when initializing:

```javascript
const handler = new AnytypeSlackHandler(slackClient, {
  mongoUrl: 'mongodb://user:pass@host:27017',  // Override MongoDB URL
  logger: customLogger                          // Use custom logger
});
```

## Troubleshooting

### "MongoDB connection refused"
Ensure AnyType is running and MongoDB is accessible:
```bash
anytype serve &
```

### "Bot not responding"
1. Check OpenClaw logs: `openclaw logs | grep anytype`
2. Verify handler is registered in config
3. Restart gateway: `openclaw gateway restart`

### "Unknown command"
Make sure the command format is exactly:
```
@openclaw anytype <command> [arg]
```

Note the spacing — it's important!

## Advanced: Custom Response Handler

Extend the handler for custom behavior:

```javascript
class CustomAnytypeHandler extends AnytypeSlackHandler {
  async postSummary(message, result) {
    if (result.error) {
      return super.postError(message, result.error);
    }
    
    // Custom formatting
    const summary = result.summary;
    
    // Maybe ping team if count increased significantly?
    if (summary.totalObjects > lastCount + 10) {
      // Send alert
    }
    
    return super.postSummary(message, result);
  }
}
```

## Integration with Monitoring

For automated workspace updates, pair this with a monitoring cron job:

```bash
# Every 30 minutes, check for new objects
*/30 * * * * /root/.openclaw/workspace/skills/anytype-sync/anytype-db count bafyrei... | grep -oP '\d+' | \
  awk -v prev=$(cat /tmp/last_count) '{ if ($1 > prev) { echo "New objects added!"; echo $1 > /tmp/last_count } }'
```

Then post to Slack via OpenClaw's message command.

## File Structure

```
slack/
├── handler.js          ← Main Slack handler (this file)
├── SETUP.md           ← This setup guide
└── examples/
    ├── middleware.js   ← Middleware example
    ├── slash-command.js← Slash command example
    └── polling.js      ← Polling monitor example
```
