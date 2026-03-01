# MEMORY.md - Long-Term Memory

## Identity
- **Name:** Claw 🐧
- **Role:** Linux expert assistant
- **Setup date:** 2026-02-24

## Rob Oudendijk
- CEO at YR-DESIGN (yr-design.biz) — software engineer, designer, consultant
- Based in Mitsue, Japan (GMT+9)
- Dutch background, long-time Japan resident
- SAFECAST.org supporter (open radiation monitoring)
- GitHub: https://github.com/robouden
- Technically deep: Linux, AI, web, embedded, full-stack

## GitHub Setup
- Single repo: https://github.com/robouden/openclaw-workspace
- Everything lives here: config, memory, daily logs
- Commit after every session

## VPS (simplemap.safecast.org)
- IP: 65.108.24.131, Ubuntu 24.04, Hetzner — production Safecast server, be careful
- OpenClaw installed, gateway running as system service (port 18789, loopback)
- SSH tunnel: `ssh -L 18790:localhost:18789 root@65.108.24.131 -N` → http://localhost:18790
- Running services: nginx, postgresql, openclaw-gateway, anytype (any-sync-bundle)
- MongoDB + Redis ARE in use — required by AnyType sync server (any-sync-bundle uses mongo:27017 + redis:6379 internally)
- Docker installed but not actively used
- **Slack**: configured via Socket Mode, bot token in openclaw.json, Rob's DM channel D0AHMTHF201, user ID U025D964S
- **Slack DM is the primary communication channel** — send all updates, alerts, and proactive messages here
- VPS monitoring active: heartbeat checks disk/memory/CPU/services + nginx traffic, alerts via Slack DM
- **Tailscale**: userspace mode (LXC container), IP `100.76.253.38`, hostname `simplemap.taila8498c.ts.net`
- Tailscale Serve: OpenClaw at `https://simplemap.taila8498c.ts.net` (tailnet only)
- Rob's tablet `p08-t` on tailnet at `100.70.8.86` — can reach OpenClaw directly!
- **fail2ban**: Installed 2026-03-01, version 1.0.2-3ubuntu0.1, active since 09:52:02 UTC
  - SSH jail configured for brute force protection
  - Monitoring active due to nginx scanning/path traversal alerts

## Tablet Webchat (p08-t)
- Accessible at `https://simplemap.taila8498c.ts.net` via Tailscale
- Config changes made to `~/.openclaw/openclaw.json`:
  - `gateway.auth.allowTailscale: true`
  - `gateway.controlUi.allowedOrigins: ["https://simplemap.taila8498c.ts.net"]`
- Device pairing: one-time approval via `openclaw devices approve <requestId>`
- Already approved — tablet paired ✅

## Local OpenClaw (Rob's laptop/desktop)
- Path: `/home/rob/.openclaw/`
- Ran out of Anthropic credits → switched to Qwen free tier (2025-02-25)
- Fix applied: `openclaw plugins enable qwen-portal-auth` → restart gateway → `openclaw models auth login --provider qwen-portal --set-default` → `openclaw models set qwen-portal/coder-model`
- Qwen free tier: 2000 req/day via OAuth, no API key needed
- To switch back to Claude when credits are restored: `openclaw models set anthropic/claude-sonnet-4-6`

## AnyType Workspace Migration (2026-02-27)
- ✅ Created `/root/anytype-workspace/` folder as source of truth (replacing GitHub)
- ✅ Copied key docs: COST_TRACKING.md, MEMORY.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md
- ✅ Built file watcher service (anytype-workspace-sync.service) running Node.js
- **Status**: Service is running and watching for changes, but REST API sync not yet functional (504)
- **Next step**: Fix REST API endpoint or use direct SQLite write

## AnyType Full Access (2026-02-28)
✅ **Full MongoDB access to AnyType data**
- 23 spaces synced + live access
- Can read/write/delete files from MongoDB
- Created `/root/.openclaw/workspace/scripts/anytype-manager.py` for file operations
- Main workspace: `bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws3dhn3uaxhh3u37k4.10piockh34xft`
- Identity: `A5edxL8hm6Dk9ZCpjDrycB7ZJ1Jqa2zL86scGoMHDZ5L8xEM`

## AnyType Helper Integration (2026-03-01)
✅ **Claude built self-healing AnyType integration for OpenClaw**
- Node.js helper module at `./code/anytype-helper`
- Service running: `anytype-workspace-sync.service` on VPS
- ✅ Self-healing: No manual token refreshes needed
- ✅ Reliable: Automatic recovery from auth errors
- ✅ Complete CRUD: Create, read, update, delete all working
- ✅ Production Ready: Running on VPS with monitoring
- **Sync latency**: 2-5 seconds from file write to AnyType
- **How it works**: Write `.md` files to `/root/anytype-workspace/`, service auto-syncs

### Methods Available:
```javascript
const AnyType = require('./code/anytype-helper');
const anytype = new AnyType();

// Write/create note
await anytype.write('note-id', 'Title', 'Content...');

// Update note
await anytype.update('note-id', 'New markdown content...');

// Delete note
await anytype.delete('note-id');

// Read note
const content = await anytype.read('note-id');

// List all notes
const notes = await anytype.list();

// Sync MongoDB doc to AnyType
await anytype.syncFromMongo(mongoDoc);

// Create task with metadata
await anytype.createTask({id, title, description, status, priority});

// Create timestamped log entry
const logId = await anytype.log('Event Name', 'Content...');
```

### Quick Start:
```javascript
// Simplest: Write markdown file (auto-syncs)
const fs = require('fs').promises;
await fs.writeFile(
    '/root/anytype-workspace/note.md',
    '# My Note\n\nContent here...',
    'utf8'
);
// ✓ Auto-syncs to AnyType in 2-5 seconds
```

## Pending / TODO
- [ ] Telegram bot setup (Rob has tablet with Telegram)
- [ ] Gmail API setup (Google Cloud project + OAuth credentials)
- [x] AnyType CLI installed (v0.1.9), bot account created, running as anytype-cli.service
  - Bot Account ID: AB4nnRmgS8ocfTdV5UNFX8st5dZZoWnXp7gowBpbpVjS7CPK
  - Shared space ID (claw-bot): bafyreietc6lmsanpkyfz4m3x2xd4hb5vvxex7ywalouqcugufarmhy3nue.10piockh34xft
  - ✅ Workspace at `/root/anytype-workspace/` with auto-sync watcher (Node.js service)
  - ✅ AnyType full access via MongoDB — reading/writing encrypted storage
- [ ] Extract Screenshot_20260301-074812 (still syncing from tablet)
- [ ] Reload Anthropic credits on local machine (using Qwen free tier for now — confirmed 2026-02-26)
