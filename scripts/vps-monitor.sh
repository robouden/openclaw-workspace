#!/bin/bash
# VPS health monitor — called from heartbeat
# Sends Slack DM alerts to Rob (U025D964S) via OpenClaw message tool
# Exit 0 = all good, exit 1 = alerts sent

ALERTS=()

# --- Disk usage ---
DISK_PCT=$(df / --output=pcent | tail -1 | tr -d ' %')
if [ "$DISK_PCT" -gt 80 ]; then
  ALERTS+=("⚠️ *Disk*: ${DISK_PCT}% used on /")
fi

# --- Memory usage ---
MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
MEM_USED=$(free -m | awk '/^Mem:/{print $3}')
MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))
if [ "$MEM_PCT" -gt 90 ]; then
  ALERTS+=("⚠️ *Memory*: ${MEM_PCT}% used (${MEM_USED}MB / ${MEM_TOTAL}MB)")
fi

# --- CPU load (1-min) vs CPU count ---
CPU_COUNT=$(nproc)
LOAD=$(cat /proc/loadavg | awk '{print $1}')
LOAD_INT=$(echo "$LOAD * 100" | bc | cut -d. -f1)
THRESHOLD=$((CPU_COUNT * 200))  # alert at 2x CPU count
if [ "$LOAD_INT" -gt "$THRESHOLD" ]; then
  ALERTS+=("⚠️ *CPU Load*: ${LOAD} (${CPU_COUNT} cores)")
fi

# --- Critical services ---
for SVC in nginx postgresql openclaw-gateway; do
  STATUS=$(systemctl is-active "$SVC" 2>/dev/null)
  if [ "$STATUS" != "active" ]; then
    ALERTS+=("🔴 *Service down*: ${SVC} (${STATUS})")
  fi
done

# --- Output alerts (caller handles Slack DM) ---
if [ ${#ALERTS[@]} -gt 0 ]; then
  echo "🚨 *VPS Alert — simplemap.safecast.org*"
  for ALERT in "${ALERTS[@]}"; do
    echo "$ALERT"
  done
  exit 1
fi

exit 0
