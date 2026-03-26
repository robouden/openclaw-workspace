---
name: anytype-sync
description: "Interact with AnyType workspaces via MCP and HTTP API. Use when: (1) creating or updating pages in AnyType, (2) querying objects in a space, (3) managing daily reports, (4) searching AnyType content, (5) cleaning up duplicate objects."
---

# AnyType Sync

Interact with AnyType workspaces from OpenClaw via the official AnyType MCP server or direct HTTP API calls.

## Architecture

See `ANYTYPE-MCP-ARCHITECTURE.mmd` for the full architecture diagram.

```
OpenClaw / Claude Code
    ↓ MCP tools
@anyproto/anytype-mcp
    ↓ HTTP REST
AnyType HTTP API (:31012)
    ↓
AnyType Space (synced to all devices)
```

### Two Access Methods

1. **MCP (preferred)** — `@anyproto/anytype-mcp` provides structured tools for Claude/OpenClaw
2. **HTTP API (scripts/cron)** — Direct REST calls for automation (daily reports, cleanup)

## MCP Setup

### On Laptop (via SSH tunnel)

Start the SSH tunnel:
```bash
ssh -L 31012:127.0.0.1:31012 root@65.108.24.131
```

MCP is configured in `.claude/settings.local.json`:
```json
{
  "mcpServers": {
    "anytype": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/anytype-mcp"],
      "env": {
        "ANYTYPE_API_URL": "http://127.0.0.1:31012",
        "ANYTYPE_API_KEY": "<laptop-api-key>"
      }
    }
  }
}
```

### On VPS

MCP is configured in `/root/.openclaw/openclaw.json` with the `openclaw-vps` API key.

## HTTP API Reference

### Authentication

All requests require:
```
Authorization: Bearer <API_KEY>
Anytype-Version: 2025-11-08
Content-Type: application/json
```

### Endpoints

**Search objects:**
```bash
curl -X POST http://127.0.0.1:31012/v1/spaces/{SPACE_ID}/search \
  -H "Authorization: Bearer $API_KEY" \
  -H "Anytype-Version: 2025-11-08" \
  -H "Content-Type: application/json" \
  -d '{"query": "", "limit": 100, "offset": 0}'
```

**Create a note:**
```bash
curl -X POST http://127.0.0.1:31012/v1/spaces/{SPACE_ID}/objects \
  -H "Authorization: Bearer $API_KEY" \
  -H "Anytype-Version: 2025-11-08" \
  -H "Content-Type: application/json" \
  -d '{"name": "Title", "type_key": "note", "body": "Markdown content"}'
```

**Delete an object:**
```bash
curl -X DELETE http://127.0.0.1:31012/v1/spaces/{SPACE_ID}/objects/{OBJECT_ID} \
  -H "Authorization: Bearer $API_KEY" \
  -H "Anytype-Version: 2025-11-08"
```

### API Key Management

```bash
# Create a new API key
ssh root@65.108.24.131 'anytype auth apikey create --name my-key'

# List API keys
ssh root@65.108.24.131 'anytype auth apikey list'
```

## Scripts

### daily-report-api.sh (VPS)

Generates and pushes a daily health report to AnyType:
- Located at `/root/scripts/daily-report-api.sh`
- Runs via cron at 22:01 UTC (07:01 JST)
- Creates a note with system metrics, service status, and security info

### anytype-api.js

Node.js HTTP API client with convenience methods:
- `createPage()`, `updatePage()`, `getPage()`, `queryPages()`, `deletePage()`
- Located at `scripts/anytype-api.js`

### Cleanup Scripts

Python scripts for identifying and removing duplicate objects:
- Scan: `anytype-scan.py` — lists all objects, groups by name
- Cleanup: `anytype-cleanup.py` — removes duplicates, keeps objectmap entries

## Legacy (Deprecated)

The following are no longer in use:

- **anytype-workspace-sync** (Go service) — File watcher that synced via gRPC. Had a bug where it always created new objects instead of updating. Replaced by MCP + HTTP API.
- **anytype-db** (Go CLI) — Direct MongoDB queries. Replaced by HTTP API.
- **anytype-watcher** — Systemd file watcher. Replaced by cron + API.

## Troubleshooting

### "Connection refused" on HTTP API
AnyType CLI not running:
```bash
ssh root@65.108.24.131 'systemctl status anytype-cli.service'
ssh root@65.108.24.131 'systemctl restart anytype-cli.service'
```

### SSH tunnel not working
```bash
ssh -L 31012:127.0.0.1:31012 root@65.108.24.131
# Verify: curl http://127.0.0.1:31012/v1/spaces -H "Authorization: Bearer $KEY" -H "Anytype-Version: 2025-11-08"
```

### MCP not connecting
Check that the SSH tunnel is active and the API key is correct.

## Support

- GitHub: https://github.com/robouden/openclaw-workspace
- Issues: https://github.com/robouden/openclaw-workspace/issues
