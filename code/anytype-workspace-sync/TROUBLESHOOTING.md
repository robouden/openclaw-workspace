# AnyType Workspace Sync - Troubleshooting Guide

Quick reference for diagnosing and fixing common issues.

## Quick Diagnostics

Run these commands first:

```bash
# Check all services
systemctl status anytype-workspace-sync
ps aux | grep 'anytype serve' | grep -v grep
ss -tlnp | grep 31010

# Check recent logs
journalctl -u anytype-workspace-sync -n 50

# Check auth status
/root/.local/bin/anytype auth status

# Check space access
/root/.local/bin/anytype space list
```

---

## Common Issues

### 1. "not authenticated - check network membership"

**Symptoms**:
```
✗ Sync error: failed to create object: not authenticated - check network membership
```

**Cause**: Session token expired or invalid

**Fix**:
```bash
# Quick fix (restarts everything)
pkill -f 'anytype serve'
sleep 2
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &
sleep 5
systemctl restart anytype-workspace-sync

# Verify
journalctl -u anytype-workspace-sync -n 20
```

**Prevention**: Set up automated restart (future enhancement)

---

### 2. Files Not Syncing

**Symptoms**:
- Create file, nothing happens
- No logs appearing

**Diagnosis**:
```bash
# Is service running?
systemctl status anytype-workspace-sync

# Are there any errors?
journalctl -u anytype-workspace-sync -p err -n 20

# Is anytype server running?
ps aux | grep 'anytype serve'

# Is gRPC port open?
ss -tlnp | grep 31010
```

**Fixes**:

**If service stopped**:
```bash
systemctl start anytype-workspace-sync
```

**If anytype server not running**:
```bash
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &
```

**If port not listening**:
```bash
# Check anytype server logs
tail -f /tmp/anytype-serve.log

# Look for startup errors
```

---

### 3. Space Not Found

**Symptoms**:
```
✗ Failed to open space: space not found
```

**Diagnosis**:
```bash
# List joined spaces
/root/.local/bin/anytype space list

# Check space ID in code
grep "spaceID" /root/anytype-workspace-sync-bin
```

**Fix**:

**If space not joined**:
```bash
/root/.local/bin/anytype space join \
  'anytype://invite/?cid=YOUR_CID&key=YOUR_KEY' \
  --network YOUR_NETWORK_ID
```

**If wrong space ID in code**:
1. Edit `main.go`
2. Update `spaceID` constant
3. Rebuild: `go build -o anytype-workspace-sync-bin`
4. Redeploy: `scp anytype-workspace-sync-bin root@VPS:/root/`
5. Restart: `systemctl restart anytype-workspace-sync`

---

### 4. Delete Not Working

**Symptoms**:
- Delete file locally
- Object still exists in AnyType

**Diagnosis**:
```bash
# Check if object ID exists
cat /root/.anytype-workspace-objectmap.json | jq .

# Check delete logs
journalctl -u anytype-workspace-sync | grep -i delete
```

**Causes & Fixes**:

**No object ID mapping**:
- File was created before object map was implemented
- Delete won't work (object ID unknown)
- Manual deletion required in AnyType UI

**Authentication error during delete**:
- Same as issue #1
- Restart services

**Object map corrupted**:
```bash
# Backup first
cp /root/.anytype-workspace-objectmap.json /root/.anytype-workspace-objectmap.json.backup

# Reset
rm /root/.anytype-workspace-objectmap.json
systemctl restart anytype-workspace-sync

# All files will resync and rebuild map
```

---

### 5. Service Keeps Restarting

**Symptoms**:
```bash
systemctl status anytype-workspace-sync
# Shows: activating (auto-restart)
```

**Diagnosis**:
```bash
# Check crash logs
journalctl -u anytype-workspace-sync -p err --since "5 minutes ago"

# Common errors:
# - "panic: runtime error"
# - "Failed to initialize object map"
# - "Failed to connect to AnyType gRPC"
```

**Fixes**:

**Object map error**:
```bash
rm /root/.anytype-workspace-objectmap.json
systemctl restart anytype-workspace-sync
```

**gRPC connection error**:
```bash
# Start anytype server first
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &
sleep 5
systemctl restart anytype-workspace-sync
```

**Workspace directory missing**:
```bash
mkdir -p /root/anytype-workspace
systemctl restart anytype-workspace-sync
```

---

### 6. High CPU Usage

**Symptoms**:
```bash
top
# anytype-workspace-sync shows >20% CPU
```

**Diagnosis**:
```bash
# Check if stuck in loop
journalctl -u anytype-workspace-sync --since "1 minute ago" | wc -l
# If > 1000 lines, likely looping

# Check for file event storm
journalctl -u anytype-workspace-sync --since "1 minute ago" | grep "Syncing"
```

**Causes**:
- File being rapidly modified
- Sync triggering file modification (loop)
- Too many files in watched directory

**Fix**:
```bash
# Stop service
systemctl stop anytype-workspace-sync

# Identify problematic file
journalctl -u anytype-workspace-sync -n 1000 | grep "Syncing" | sort | uniq -c | sort -rn | head

# Move or remove problematic files
mv /root/anytype-workspace/problematic-file.md /tmp/

# Restart
systemctl start anytype-workspace-sync
```

---

### 7. Object Map Out of Sync

**Symptoms**:
- Files exist but not in map
- Map has entries for deleted files
- Delete fails with "No object ID found"

**Diagnosis**:
```bash
# List files
ls /root/anytype-workspace/*.md | sed 's/.*\///' | sed 's/\.md$//' | sort > /tmp/files.txt

# List map entries
jq -r 'keys[]' /root/.anytype-workspace-objectmap.json | sort > /tmp/map.txt

# Compare
diff /tmp/files.txt /tmp/map.txt
```

**Fix**:

**Reset and resync**:
```bash
# Backup
cp /root/.anytype-workspace-objectmap.json /root/map-backup.json

# Reset
rm /root/.anytype-workspace-objectmap.json

# Restart (will resync all files)
systemctl restart anytype-workspace-sync

# This creates duplicate objects in AnyType!
# Clean up duplicates manually in AnyType UI
```

**Selective fix**:
```bash
# Remove orphaned map entries manually
jq 'del(.["deleted-file"])' /root/.anytype-workspace-objectmap.json > /tmp/map-new.json
mv /tmp/map-new.json /root/.anytype-workspace-objectmap.json

# Restart
systemctl restart anytype-workspace-sync
```

---

### 8. Can't Join Space

**Symptoms**:
```
✗ Failed to view invite: space invite view error
```

**Diagnosis**:
```bash
# Check auth status
/root/.local/bin/anytype auth status

# Check network configuration
cat /var/lib/anytype/data/client-config.yml

# Check anytype server logs
tail -f /tmp/anytype-serve.log
```

**Causes & Fixes**:

**Wrong network**:
```bash
# Logout
/root/.local/bin/anytype auth logout

# Login with correct network config
/root/.local/bin/anytype auth login \
  --account-key 'YOUR_KEY' \
  --network-config /var/lib/anytype/data/client-config.yml

# Restart server
pkill -f 'anytype serve'
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &

# Try join again
/root/.local/bin/anytype space join 'anytype://invite/...' --network YOUR_NETWORK_ID
```

**Invite expired**:
- Request new invite from space owner

**Server not running**:
```bash
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &
sleep 5
/root/.local/bin/anytype space join 'anytype://invite/...' --network YOUR_NETWORK_ID
```

---

## Emergency Procedures

### Complete Reset

**WARNING**: This deletes all local data and mappings!

```bash
# Stop everything
systemctl stop anytype-workspace-sync
pkill -f 'anytype serve'

# Backup
tar -czf anytype-emergency-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
    /root/anytype-workspace \
    /root/.anytype \
    /root/.anytype-workspace-objectmap.json

# Clean slate
rm /root/.anytype-workspace-objectmap.json
# DO NOT delete /root/.anytype/config.json (has account key!)

# Restart
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &
sleep 8
systemctl start anytype-workspace-sync

# Verify
journalctl -u anytype-workspace-sync -f
```

### Restore from Backup

```bash
# Stop services
systemctl stop anytype-workspace-sync
pkill -f 'anytype serve'

# Extract backup
tar -xzf anytype-emergency-backup-TIMESTAMP.tar.gz -C /

# Restart
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &
sleep 8
systemctl start anytype-workspace-sync
```

---

## Diagnostic Commands

### Check Everything

```bash
#!/bin/bash
echo "=== Service Status ==="
systemctl status anytype-workspace-sync --no-pager

echo -e "\n=== AnyType Server ==="
ps aux | grep 'anytype serve' | grep -v grep

echo -e "\n=== gRPC Port ==="
ss -tlnp | grep 31010

echo -e "\n=== Auth Status ==="
/root/.local/bin/anytype auth status

echo -e "\n=== Spaces ==="
/root/.local/bin/anytype space list

echo -e "\n=== Recent Errors ==="
journalctl -u anytype-workspace-sync -p err --since "1 hour ago" --no-pager

echo -e "\n=== Recent Logs ==="
journalctl -u anytype-workspace-sync -n 20 --no-pager

echo -e "\n=== File Count ==="
ls -1 /root/anytype-workspace/*.md 2>/dev/null | wc -l

echo -e "\n=== Object Map Size ==="
jq 'length' /root/.anytype-workspace-objectmap.json 2>/dev/null || echo "Object map not found"

echo -e "\n=== Disk Usage ==="
du -sh /root/anytype-workspace 2>/dev/null || echo "Workspace not found"
```

Save as `/root/check-anytype.sh`, make executable, run anytime:
```bash
chmod +x /root/check-anytype.sh
/root/check-anytype.sh
```

---

## Getting Help

### Information to Provide

When asking for help, include:

```bash
# System info
uname -a

# Service status
systemctl status anytype-workspace-sync --no-pager

# Last 100 log lines
journalctl -u anytype-workspace-sync -n 100 --no-pager

# Auth status
/root/.local/bin/anytype auth status

# Space list
/root/.local/bin/anytype space list

# Config (REDACT account key!)
cat /root/.anytype/config.json | sed 's/"accountKey":.*/"accountKey": "REDACTED"/'
```

### Support Channels

1. GitHub Issues: [anytype-workspace-sync issues]
2. AnyType Community: https://community.anytype.io/
3. Documentation: Check README.md and ARCHITECTURE.md

---

## Prevention Checklist

Set up these monitoring practices:

- [ ] Daily: Check service status
- [ ] Daily: Review error logs
- [ ] Weekly: Verify object map consistency
- [ ] Weekly: Test create/delete operations
- [ ] Monthly: Rotate logs
- [ ] Monthly: Test backup/restore
- [ ] On deploy: Verify all services start correctly
- [ ] Before upgrade: Full backup

---

**Quick Commands Reference Card**

```bash
# Status
systemctl status anytype-workspace-sync
/root/.local/bin/anytype auth status
/root/.local/bin/anytype space list

# Logs
journalctl -u anytype-workspace-sync -f
journalctl -u anytype-workspace-sync -p err -n 50
tail -f /tmp/anytype-serve.log

# Restart (nuclear option)
pkill -f 'anytype serve' && \
sleep 2 && \
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 & && \
sleep 5 && \
systemctl restart anytype-workspace-sync

# Check health
ss -tlnp | grep 31010
ps aux | grep anytype
cat /root/.anytype-workspace-objectmap.json | jq length
```

Save this page for quick reference! 📋
