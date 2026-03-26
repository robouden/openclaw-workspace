# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## VPS — simplemap.safecast.org

- **IP:** 65.108.24.131
- **SSH:** `ssh root@65.108.24.131`
- **Purpose:** AnyType self-hosted sync backend, OpenClaw agent, daily reports

### AnyType Services

| Service | Port | Status |
|---------|------|--------|
| `anytype-cli.service` | gRPC :31010, HTTP :31012 | active, enabled |
| `anytype.service` (any-sync-bundle) | sync :33010 | active |
| MongoDB | :27017 | active (used by sync bundle) |
| Redis | :6379 | active (used by sync bundle) |

### AnyType API Access

- **HTTP API:** `http://127.0.0.1:31012/v1/` (on VPS)
- **From laptop:** SSH tunnel `ssh -L 31012:127.0.0.1:31012 root@65.108.24.131`
- **VPS API key name:** `openclaw-vps`
- **Laptop API key name:** `openclaw-laptop`
- **Space ID:** `bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws3dhn3uaxhh3u37k4.10piockh34xft`
- **Space name:** "Rob New Place"
- **API version header:** `Anytype-Version: 2025-11-08`

### MCP Integration

AnyType MCP (`@anyproto/anytype-mcp`) is configured on both:
- **Laptop:** Via SSH tunnel in `.claude/settings.local.json`
- **VPS:** In OpenClaw config `/root/.openclaw/openclaw.json`

### Cron Jobs

```
1 22 * * * /root/scripts/daily-report-api.sh >> /var/log/anytype-daily-report.log 2>&1
```

### Key Paths (VPS)

- AnyType config: `/root/.anytype/config.json`
- Object map: `/root/.anytype-workspace-objectmap.json`
- Daily report script: `/root/scripts/daily-report-api.sh`
- OpenClaw config: `/root/.openclaw/openclaw.json`

---

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
