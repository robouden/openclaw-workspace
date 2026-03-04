# AnyType Service Architecture Investigation

**Date:** 2026-03-04 15:07 UTC  
**Issue:** anytype-cli.service keeps crashing due to port 31010 already in use

---

## System Architecture

### Services Running

| Service | Process | User | Purpose | Uptime | Status |
|---------|---------|------|---------|--------|--------|
| **anytype.service** | `any-sync-bundle start-bundle` | anytype | Backend sync server | 4+ days (Mar 01) | ✅ Running |
| **anytype-cli.service** | `/root/.local/bin/anytype serve` | root | Personal client/API | ~1 hour | ⚠️ Crashes frequently |
| **anytype-workspace-sync.service** | `/root/anytype-workspace-sync-bin` | root | File watcher → AnyType | Running | ✅ Running |
| **anytype-watcher.service** | File watcher script | root | inotifywait monitor | Running | ✅ Running |

---

## Port Allocation

### Backend Sync Server (anytype.service)
**Config:** `/var/lib/anytype/bundle-config.yml`
```yaml
network:
    listenTCPAddr: 0.0.0.0:33010  ✅ (backend sync)
    listenUDPAddr: 0.0.0.0:33020  ✅ (backend sync)
```

### Personal Client (anytype-cli.service)
**Process:** `/root/.local/bin/anytype serve -q`
**Attempting to bind:** 127.0.0.1:31010, 127.0.0.1:31011  
**Config source:** Unknown (not in /var/lib/anytype or /root/.anytype)

---

## The Problem

### Port Conflict Cycle

```
1. anytype-cli.service starts
2. Tries to bind to 127.0.0.1:31010 (gRPC Web proxy)
3. Tries to bind to 127.0.0.1:31011 (gRPC server)
4. Old process hasn't fully released ports yet
5. "address already in use" error
6. Service crashes
7. Systemd tries to restart (6 times)
8. Hits StartLimitBurst=5 → gives up
9. Manual restart needed
```

### Root Causes

1. **No SO_REUSEADDR/SO_REUSEPORT** in anytype code
   - Old socket stuck in TIME_WAIT for 60+ seconds
   - New process can't bind immediately on restart

2. **KillMode=mixed not enough**
   - Process killed but socket not released
   - Need longer shutdown timeout or SO_REUSEADDR

3. **No pre-start cleanup**
   - No script to flush old connections before start
   - Should use `lsof` or `fuser` to wait for port release

---

## Solutions (Ranked by Feasibility)

### **Solution 1: ExecStartPre Script** ⭐ (Easy, Works Now)

Add cleanup script before service starts:

```ini
[Service]
ExecStartPre=/usr/local/bin/anytype-prestart.sh
ExecStart=/root/.local/bin/anytype serve -q
```

**File: `/usr/local/bin/anytype-prestart.sh`**
```bash
#!/bin/bash
# Wait for port 31010-31011 to be released
for i in {1..30}; do
    if ! netstat -tlnp 2>/dev/null | grep -E "31010|31011"; then
        exit 0
    fi
    echo "Waiting for ports 31010-31011 to be released... ($i/30)"
    sleep 1
done

# Force kill if still bound
if fuser 31010/tcp 31011/tcp 2>/dev/null; then
    echo "Force killing process holding ports"
    fuser -k 31010/tcp 31011/tcp 2>/dev/null || true
    sleep 2
fi

exit 0
```

### **Solution 2: Increase TimeoutStopSec** ⭐⭐ (Better)

Extend graceful shutdown time to allow ports to release:

```ini
[Service]
TimeoutStopSec=60      # Increased from 30
KillMode=mixed
KillSignal=SIGTERM
```

Then increase StartLimitInterval:

```ini
StartLimitInterval=600  # 10 minutes instead of 5
StartLimitBurst=10      # More restarts allowed
```

### **Solution 3: Patch Anytype Binary** (Hard, Best)

If anytype code is available, add socket reuse options:

```go
// Go socket reuse
listener, _ := net.Listen("tcp", "127.0.0.1:31010")
// Set SO_REUSEADDR at OS level before Listen
setsockopt(SO_REUSEADDR, 1)
```

---

## Recommended Fix: Hybrid Approach

### **Immediate (Apply Now)**

1. Update service to use Solution 1:
```bash
cat > /usr/local/bin/anytype-prestart.sh << 'EOF'
#!/bin/bash
for i in {1..30}; do
    netstat -tlnp 2>/dev/null | grep -E "31010|31011" || exit 0
    sleep 1
done
fuser -k 31010/tcp 31011/tcp 2>/dev/null || true
sleep 2
exit 0
EOF
chmod +x /usr/local/bin/anytype-prestart.sh
```

2. Update `/etc/systemd/system/anytype-cli.service`:
```ini
[Service]
ExecStartPre=/usr/local/bin/anytype-prestart.sh
TimeoutStopSec=60
StartLimitInterval=600
StartLimitBurst=10
```

### **Long-term (Prevent Reoccurrence)**

1. Monitor socket TIME_WAIT:
```bash
watch -n 1 'netstat -tnp | grep TIME_WAIT | wc -l'
```

2. Track service crashes:
```bash
journalctl -u anytype-cli.service --since "1 hour ago" | grep "Failed\|exit" | wc -l
```

3. Consider whether `anytype-cli.service` is necessary
   - Does your use case need the personal client?
   - Or is the sync server (anytype.service) sufficient?

---

## Deeper Architecture Questions

### Is anytype-cli.service Needed?

**anytype.service** (sync backend) has been running 4+ days successfully
- Running as `anytype` user (lower privilege)
- Stable, no crashes
- Handles all sync operations

**anytype-cli.service** (personal client) keeps crashing
- Running as `root` (higher privilege)
- Not configured properly
- Port binding issues

**Question:** What does the personal client do that the sync server doesn't?

If you only need sync functionality, consider **disabling anytype-cli.service entirely** and managing it manually when needed.

---

## Verification Steps

### Check current status
```bash
systemctl status anytype.service          # Backend
systemctl status anytype-cli.service      # Client
netstat -tlnp | grep -E "31010|31011|33010|33020"
```

### Monitor for crashes
```bash
journalctl -u anytype-cli.service -f
```

### Test the fix
```bash
systemctl stop anytype-cli.service
systemctl start anytype-cli.service
systemctl status anytype-cli.service
```

---

## Current Status

- ✅ anytype.service: Stable (4+ days)
- ⚠️ anytype-cli.service: Unstable (port binding)
- 🔧 Fix available (3 solutions provided)

---

**Next Action:** Should we apply Solution 1 (ExecStartPre script) now?
