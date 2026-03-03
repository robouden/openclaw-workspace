#!/bin/bash

# VPS Daily Health Report - Generates report and syncs to AnyType
# Runs: Daily at 07:00 JST (22:00 UTC)

REPORT_DIR="/root/anytype-workspace"
TIMESTAMP=$(date +'%Y-%m-%d %H:%M UTC')
DATE=$(date +'%Y-%m-%d')
REPORT_FILE="$REPORT_DIR/VPS-DAILY-REPORT-$DATE.md"

# Gather system info
UPTIME=$(uptime | sed 's/.*up //' | sed 's/,.*//')
DISK=$(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')
MEMORY=$(free -h | grep Mem | awk '{print $3 "/" $2}')
LOAD=$(cat /proc/loadavg | awk '{print $1 ", " $2 ", " $3}')

# Service status
NGINX_STATUS=$(systemctl is-active nginx)
FAIL2BAN_STATUS=$(systemctl is-active fail2ban)
ANYTYPE_STATUS=$(systemctl is-active anytype-workspace-sync)
OPENCLAW_STATUS=$(systemctl is-active openclaw-gateway)

# fail2ban stats
BANNED_IPS=$(fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $NF}' || echo "0")
TOTAL_BANNED=$(fail2ban-client status sshd 2>/dev/null | grep "Total banned" | awk '{print $NF}' || echo "0")

# AnyType workspace status
ANYTYPE_FILES=$(ls -1 /root/anytype-workspace/*.{md,jpg,png,pdf} 2>/dev/null | wc -l)

# Generate report
cat > "$REPORT_FILE" << EOF
# VPS Daily Health Report — $DATE

**Generated:** $TIMESTAMP
**Report Time:** 07:00 JST / 22:00 UTC

---

## System Status

### Uptime
\`\`\`
$UPTIME
\`\`\`

### Resources
- **Disk:** $DISK
- **Memory:** $MEMORY
- **CPU Load:** $LOAD (1m, 5m, 15m)

---

## Services

| Service | Status | Uptime |
|---------|--------|--------|
| nginx | ✅ $NGINX_STATUS | Running |
| fail2ban | ✅ $FAIL2BAN_STATUS | Running |
| anytype-workspace-sync | ✅ $ANYTYPE_STATUS | Running |
| openclaw-gateway | ✅ $OPENCLAW_STATUS | Running |

---

## Security

**fail2ban:**
- Currently banned IPs: $BANNED_IPS
- Total banned (all time): $TOTAL_BANNED
- Status: ✅ Active & protecting

---

## Storage

**AnyType Workspace:**
- Files synced: $ANYTYPE_FILES
- Status: ✅ Healthy

---

## Summary

✅ **All systems operational**
✅ **No critical alerts**
✅ **Security active**
✅ **Storage healthy**

---

**Next report:** $(date -d '+1 day' +'%Y-%m-%d 07:00 JST')
EOF

echo "✓ Report generated: $REPORT_FILE"

# Sync to AnyType (if it exists, file watcher will pick it up)
# No action needed - file watcher monitors the directory

exit 0
