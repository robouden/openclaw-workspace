#!/bin/bash
# nginx traffic monitor — checks for suspicious activity in the last 30 minutes
# Outputs alert text if threats found, exits 1. Exits 0 if all clear.

LOG=/var/log/nginx/access.log
ALERTS=()
WINDOW=30  # minutes

# Time filter: last N minutes
SINCE=$(date -d "$WINDOW minutes ago" '+%d/%b/%Y:%H:%M:%S')

# Get recent log lines (exclude localhost)
RECENT=$(awk -v d="[$SINCE" '$4 > d' "$LOG" 2>/dev/null | grep -v '^127\.0\.0\.1 \|^::1 ')

if [ -z "$RECENT" ]; then
  exit 0
fi

# --- Probe/scan patterns ---
SCAN_PATTERNS='\.env|\.git|wp-config|xmlrpc|phpinfo|\.htpasswd|phpmyadmin|\.php\b|cgi-bin|passwd|\.aws|\.ssh|shell'
SCAN_COUNT=$(echo "$RECENT" | grep -E "$SCAN_PATTERNS" 2>/dev/null | wc -l)
if [ "$SCAN_COUNT" -gt 10 ]; then
  TOP_SCANNER=$(echo "$RECENT" | grep -E "$SCAN_PATTERNS" | awk '{print $1}' | sort | uniq -c | sort -rn | head -1)
  ALERTS+=("🔍 *Scanning activity*: ${SCAN_COUNT} probe requests in last ${WINDOW}min (top: ${TOP_SCANNER})")
fi

# --- Path traversal attempts ---
TRAVERSAL=$(echo "$RECENT" | grep -E '(\.\.|%2e%2e|%252e)' 2>/dev/null | wc -l)
if [ "$TRAVERSAL" -gt 0 ]; then
  ALERTS+=("🚨 *Path traversal attempt*: ${TRAVERSAL} requests")
fi

# --- 5xx spike ---
ERROR5XX=$(echo "$RECENT" | awk '$9 ~ /^5/' | wc -l)
if [ "$ERROR5XX" -gt 10 ]; then
  ALERTS+=("⚠️ *Server errors*: ${ERROR5XX} 5xx responses in last ${WINDOW}min")
fi

# --- Single IP hammering (>100 requests in window) ---
while IFS= read -r line; do
  COUNT=$(echo "$line" | awk '{print $1}')
  IP=$(echo "$line" | awk '{print $2}')
  if [ "$COUNT" -gt 100 ]; then
    ALERTS+=("🔨 *High traffic*: ${IP} made ${COUNT} requests in last ${WINDOW}min")
  fi
done < <(echo "$RECENT" | awk '{print $1}' | sort | uniq -c | sort -rn | head -5)

# --- Output ---
if [ ${#ALERTS[@]} -gt 0 ]; then
  echo "🌐 *nginx Alert — simplemap.safecast.org*"
  for ALERT in "${ALERTS[@]}"; do
    echo "$ALERT"
  done
  exit 1
fi

exit 0
