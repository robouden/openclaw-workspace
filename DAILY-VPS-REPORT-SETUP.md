# Daily VPS Health Report Setup

## Overview

Automated daily VPS health reports generated at **07:00 JST (22:00 UTC)** and synced to AnyType.

---

## Setup Details

### Cron Schedule
```bash
0 22 * * * /root/.openclaw/workspace/scripts/vps-daily-report.sh >> /var/log/vps-daily-report.log 2>&1
```

- **Time:** 22:00 UTC every day
- **JST equivalent:** 07:00 JST (next day)
- **Script:** `/root/.openclaw/workspace/scripts/vps-daily-report.sh`
- **Logs:** `/var/log/vps-daily-report.log`

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
- anytype-workspace-sync (status)
- openclaw-gateway (status)

**Security:**
- Currently banned IPs (fail2ban)
- Total banned IPs (all-time)

**Storage:**
- AnyType workspace files count
- Sync status

---

## Auto-Sync to AnyType

The report file is automatically picked up by the file watcher:

1. Script generates: `/root/anytype-workspace/VPS-DAILY-REPORT-2026-03-03.md`
2. File watcher detects new file
3. anytype-workspace-sync service syncs it
4. Appears in AnyType workspace as: `VPS Daily Health Report — 2026-03-03`

**Sync time:** <5 seconds after generation

---

## Testing

To test the report manually:
```bash
bash /root/.openclaw/workspace/scripts/vps-daily-report.sh
```

File will appear in:
- `/root/anytype-workspace/VPS-DAILY-REPORT-YYYY-MM-DD.md`
- AnyType workspace (within 5 seconds)

---

## Verification

Check if cron job is scheduled:
```bash
crontab -l | grep vps-daily-report
```

Expected output:
```
0 22 * * * /root/.openclaw/workspace/scripts/vps-daily-report.sh >> /var/log/vps-daily-report.log 2>&1
```

---

## View Reports in AnyType

**Location:** Your workspace
**Name format:** `VPS Daily Health Report — YYYY-MM-DD`
**Updated:** Every day at 07:00 JST

Each report contains:
- System metrics snapshot
- Service status check
- Security stats
- Storage info

---

## Next Reports

- **2026-03-04:** 07:00 JST
- **2026-03-05:** 07:00 JST
- ... and so on (daily)

---

## Maintenance

No manual action needed. Reports are:
- ✅ Auto-generated daily
- ✅ Auto-synced to AnyType
- ✅ Auto-logged for auditing

If you need to modify:
1. Edit `/root/.openclaw/workspace/scripts/vps-daily-report.sh`
2. Test: `bash /root/.openclaw/workspace/scripts/vps-daily-report.sh`
3. Cron will use updated version next run

---

**Setup Date:** 2026-03-03 23:29 UTC
**Status:** ✅ Active
**Next Run:** 2026-03-04 22:00 UTC (07:00 JST)
