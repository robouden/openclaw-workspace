# AnyType Service Configuration — Zombie Process Prevention & Port Binding Fix

**Updated:** 2026-04-04
**Purpose:** Prevent zombie processes, port binding crashes, and improve service stability

---

## Problems Solved

### Problem 1: Zombie Processes (Fixed 2026-03-04)

AnyType service was creating zombie processes because:
1. ❌ `Restart=on-failure` doesn't restart on graceful exits (exit code 0)
2. ❌ No `KillMode` specified → children not properly killed
3. ❌ No `TimeoutStopSec` → slow shutdown leaves orphaned processes
4. ❌ No resource limits → unbounded memory/CPU usage

### Problem 2: Port Binding Crashes (Fixed 2026-04-04)

Service repeatedly crashed with `"address already in use"` on ports 31010/31011/31012:

**The crash cycle:**
```
1. anytype-cli.service restarts (after crash or manual restart)
2. Tries to bind to 127.0.0.1:31010 (gRPC), 31011 (gRPC proxy), 31012 (HTTP)
3. Old process hasn't fully released sockets yet (TIME_WAIT)
4. "address already in use" → crash
5. Systemd hits StartLimitBurst → gives up → manual intervention needed
```

**Root causes identified:**
- No `SO_REUSEADDR`/`SO_REUSEPORT` in anytype binary
- Previous prestart script used `netstat` (not installed on VPS)
- Brace expansion `{1..30}` doesn't work in `/bin/sh` (systemd context)
- Malformed `fuser` command with line break in script
- Redundant second `ExecStartPre` that blocked starts when ports were in use

---

## Solution: Improved systemd Configuration

### Current Config (Final — Both Fixes Applied)

**File:** `/etc/systemd/system/anytype-cli.service`

```ini
[Unit]
Description=Anytype CLI headless server
After=network.target

[Service]
Type=simple
User=root

# Pre-start: wait for ports to be released (prevents "address already in use")
ExecStartPre=/usr/local/bin/anytype-prestart.sh

ExecStart=/root/.local/bin/anytype serve -q --listen-address 127.0.0.1:31012

# Process management (avoid zombies)
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=60

# Auto-restart on ANY exit (not just failures)
Restart=always
RestartSec=10
StartLimitInterval=600
StartLimitBurst=10

# Resource limits
MemoryMax=500M
CPUQuota=50%

# Security
PrivateTmp=yes
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

**File:** `/usr/local/bin/anytype-prestart.sh`

```bash
#!/bin/bash
# Pre-start cleanup: Wait for anytype ports to be released, force-kill if stuck
# Ports: 31010 (gRPC), 31011 (gRPC web proxy), 31012 (HTTP API)

PORTS="31010 31011 31012"
MAX_WAIT=30

for i in $(seq 1 $MAX_WAIT); do
    # Check if any of our ports are still in use
    IN_USE=false
    for port in $PORTS; do
        if ss -tln | grep -q ":${port} "; then
            IN_USE=true
            break
        fi
    done

    if [ "$IN_USE" = false ]; then
        echo "All ports clear, proceeding with start"
        exit 0
    fi

    echo "Waiting for ports to be released... ($i/$MAX_WAIT)"
    sleep 1
done

# Force kill whatever is holding the ports after timeout
echo "Timeout reached, force-killing processes on ports $PORTS"
for port in $PORTS; do
    fuser -k "${port}/tcp" 2>/dev/null || true
done
sleep 2
exit 0
```

### Port Pre-Start Script — How It Works

```
Service restart triggered
        ↓
ExecStartPre: anytype-prestart.sh runs
        ↓
Loop (up to 30 seconds):
  ├─ Check ports 31010, 31011, 31012 with `ss -tln`
  ├─ If ALL clear → exit 0 → service starts
  └─ If ANY in use → wait 1s → retry
        ↓
After 30s timeout (if still stuck):
  ├─ Force-kill with `fuser -k` on each port
  ├─ Wait 2s for cleanup
  └─ exit 0 → service starts
        ↓
anytype serve binds successfully
```

**Key design decisions:**
- Uses `ss` instead of `netstat` (the latter isn't installed on the VPS)
- Uses `$(seq 1 30)` instead of `{1..30}` (brace expansion doesn't work in `/bin/sh`)
- Loops over all three ports individually (not a regex, avoids false matches)
- Force-kill is a last resort, not the first action

---

## Key Changes Explained

### 1. KillMode=mixed
**What it does:** Kills the main process + all children (no orphans)
```
❌ Before: KillMode=control-group (sometimes leaves children)
✅ After: KillMode=mixed (kills everything)
```

### 2. TimeoutStopSec=30
**What it does:** Gives 30 seconds for graceful shutdown, then force-kills
```
Sequence:
1. Send SIGTERM (graceful)
2. Wait 30 seconds
3. If still running → Send SIGKILL (force)
```

### 3. Restart=always
**What it does:** Restarts on ANY exit, not just failures
```
❌ Before: Restart=on-failure (graceful exits = no restart)
✅ After: Restart=always (all exits get restarted)
```

### 4. StartLimitInterval=300 + StartLimitBurst=5
**What it does:** Prevents restart loops
```
If service restarts >5 times in 300 seconds (5 min):
→ Stop restarting (likely broken config)
→ Manual intervention needed
```

### 5. Memory/CPU Limits
**What it does:** Prevents runaway resource usage
```
MemoryLimit=500M  → Kill if exceeds 500MB
CPUQuota=50%      → Hard limit at 50% CPU
```

---

## General Best Practices for Zombie Prevention

### **A. Use Proper Process Supervisors** (Recommended)

Instead of raw systemd:

```bash
# Option 1: Runit (lightweight, battle-tested)
/etc/sv/anytype-cli/run:
#!/bin/sh
exec 2>&1
exec chpst -u root /root/.local/bin/anytype serve -q

# Option 2: Supervisord (feature-rich)
[program:anytype-cli]
command=/root/.local/bin/anytype serve -q
autorestart=true
startsecs=3
stopwaitsecs=10
stopsignal=TERM
killasgroup=true

# Option 3: S6 (minimal, reliable)
# Run as supervised service with automatic reaping
```

### **B. Application-Level Fixes**

If the app (AnyType) is spawning children:

**Go:**
```go
func reapChildren() {
    sigChan := make(chan os.Signal)
    signal.Notify(sigChan, syscall.SIGCHLD)
    go func() {
        for range sigChan {
            var status syscall.WaitStatus
            for {
                pid, _ := syscall.Wait4(-1, &status, syscall.WNOHANG, nil)
                if pid <= 0 { break }
            }
        }
    }()
}
```

**Bash:**
```bash
# In script that spawns children
set -m  # Enable job control
trap 'wait' SIGCHLD  # Reap on SIGCHLD
```

### **C. Systemd Best Practices**

```ini
[Service]
Type=forking                # For services that background themselves
# OR
Type=simple                 # For services that stay in foreground

# Child process cleanup
KillMode=mixed              # Kill children properly
KillSignal=SIGTERM          # Graceful first
TimeoutStopSec=30           # Force kill timeout

# Restart strategy
Restart=always              # Or: on-failure, on-abnormal, etc.
RestartSec=10               # Wait between restarts
StartLimitInterval=300      # Restart rate limiting
StartLimitBurst=5
```

---

## Monitoring for Zombies

### Check for zombies now:
```bash
ps aux | grep defunct    # Shows zombie processes
ps -eo ppid,pid,status,comm | grep Z  # List all zombies
```

### Automatic monitoring:
```bash
# Add to crontab (check every 5 minutes)
*/5 * * * * COUNT=$(ps -eo status | grep -c Z) && [ $COUNT -gt 0 ] && echo "Zombies: $COUNT" | mail -s "WARNING" root@localhost
```

### With systemd:
```bash
# Create /etc/systemd/system-generators/check-zombies
#!/bin/bash
ZOMBIES=$(ps -eo status | grep -c Z)
[ $ZOMBIES -gt 0 ] && echo "Zombie processes detected: $ZOMBIES"
```

---

## Testing the Config

```bash
# Apply config
systemctl daemon-reload

# Restart service
systemctl restart anytype-cli.service

# Check status
systemctl status anytype-cli.service

# Watch for 1 minute
watch -n 1 'ps aux | grep anytype | grep -v grep'

# Force a crash test (verify auto-restart works)
kill -9 $(pgrep -f "anytype serve")
sleep 5
systemctl status anytype-cli.service  # Should be running again
```

---

## Current Status

✅ **Zombie Prevention:** Enabled (2026-03-04)
✅ **Port Binding Fix:** Applied (2026-04-04)
✅ **Service:** anytype-cli (active, running)
✅ **Prestart Script:** `/usr/local/bin/anytype-prestart.sh` (working)
✅ **Auto-restart:** Enabled with rate limiting (Restart=always, Burst=10/600s)
✅ **Resource Limits:** Active (500MB memory, 50% CPU)
✅ **Verified:** 3x sequential restart + hard kill -9 recovery — all passed

### Deployment Artifacts
- `vps/systemd/anytype-cli.service` — Unit file (for reference/redeployment)
- `vps/systemd/anytype-prestart.sh` — Pre-start cleanup script

---

## Maintenance

### Monitor weekly:
```bash
journalctl -u anytype-cli.service --since "1 week ago" | grep -E "Restart|Restart" | wc -l
```

### Review logs for issues:
```bash
journalctl -u anytype-cli.service -n 100
```

### If still seeing zombies:
1. Check what child processes are being spawned
2. Check if AnyType has signal handler bugs
3. Consider switching to a process supervisor (runit/supervisord)
