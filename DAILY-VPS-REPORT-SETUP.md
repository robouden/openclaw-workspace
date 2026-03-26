# Daily VPS Health Report Setup

## Overview

Automated daily VPS health reports generated at **07:01 JST (22:01 UTC)** and pushed to AnyType via the HTTP API.

**Architecture:** Uses the AnyType HTTP API directly (no file watcher). See `ANYTYPE-MCP-ARCHITECTURE.mmd` for the full diagram.

---

## Setup Details

### Cron Schedule
```bash
1 22 * * * /root/scripts/daily-report-api.sh >> /var/log/anytype-daily-report.log 2>&1
```

- **Time:** 22:01 UTC every day
- **JST equivalent:** 07:01 JST (next day)
- **Script:** `/root/scripts/daily-report-api.sh`
- **Logs:** `/var/log/anytype-daily-report.log`

---

## How It Works

1. Cron fires `daily-report-api.sh` at 22:01 UTC
2. Script collects system metrics (uptime, disk, memory, CPU, services, security)
3. Script POSTs a new note to AnyType via HTTP API (`POST /v1/spaces/{id}/objects`)
4. Report appears in AnyType space "Rob New Place"

```
Cron → daily-report-api.sh → AnyType HTTP API (:31012) → AnyType Space
```

No file watcher, no gRPC, no MongoDB writes. Just a direct API call.

---

## What's in the Report

**System Status:**
- Uptime
- Disk usage
- Memory usage
- CPU load average

**Services:**
- nginx (status)
- fail2ban (status)
- anytype-cli (status)
- openclaw-gateway (status)

**Security:**
- Currently banned IPs (fail2ban)
- Total banned IPs (all-time)

---

## AnyType API Details

- **Endpoint:** `http://127.0.0.1:31012/v1/spaces/{SPACE_ID}/objects`
- **Space ID:** `bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws3dhn3uaxhh3u37k4.10piockh34xft`
- **API Key:** Stored in script as `openclaw-vps` key
- **Object type:** `note` (uses `type_key` field)
- **Content:** Passed in `body` field as markdown

---

## Testing

To test the report manually:
```bash
ssh root@65.108.24.131 'bash /root/scripts/daily-report-api.sh'
```

Check the log:
```bash
ssh root@65.108.24.131 'tail -20 /var/log/anytype-daily-report.log'
```

---

## Verification

Check if cron job is scheduled:
```bash
ssh root@65.108.24.131 'crontab -l | grep daily-report'
```

Check if AnyType HTTP API is running:
```bash
ssh root@65.108.24.131 'ss -tlnp | grep 31012'
```

Check service status:
```bash
ssh root@65.108.24.131 'systemctl status anytype-cli.service'
```

---

## VPS Services (Current State)

| Service | Status | Purpose |
|---------|--------|---------|
| `anytype-cli.service` | **active, enabled** | Runs `anytype serve -q` (gRPC :31010 + HTTP :31012) |
| `anytype-workspace-sync.service` | disabled | Old Go file watcher (replaced by MCP/API) |
| `anytype-watcher.service` | disabled | Old file watcher (replaced) |

---

## Migration Notes (March 2026)

The old setup used a Go file-watcher service (`anytype-workspace-sync`) that watched `/root/anytype-workspace/` and synced via gRPC. This had a critical bug: it always created new objects instead of updating existing ones, causing duplicates on every restart.

**Old flow:** Script → write file → file watcher → gRPC → AnyType (broken, created duplicates)
**New flow:** Script → HTTP API → AnyType (works correctly)

Cleanup performed: 60 duplicate objects deleted from AnyType space.

---

**Setup Date:** 2026-03-26 (migrated from file-watcher approach)
**Status:** Active
