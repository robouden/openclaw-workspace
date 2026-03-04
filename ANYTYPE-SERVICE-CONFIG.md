# AnyType Service Configuration — Zombie Process Prevention

**Updated:** 2026-03-04  
**Purpose:** Prevent zombie processes and improve service stability

---

## Problem

AnyType service was creating zombie processes because:
1. ❌ `Restart=on-failure` doesn't restart on graceful exits (exit code 0)
2. ❌ No `KillMode` specified → children not properly killed
3. ❌ No `TimeoutStopSec` → slow shutdown leaves orphaned processes
4. ❌ No resource limits → unbounded memory/CPU usage

---

## Solution: Improved systemd Configuration

### Current Config (Fixed)

**File:** `/etc/systemd/system/anytype-cli.service`

```ini
[Unit]
Description=Anytype CLI headless server
After=network.target
Wants=anytype-cli.service

[Service]
Type=simple
User=root
ExecStart=/root/.local/bin/anytype serve -q

# Process management (avoid zombies) ⭐
KillMode=mixed                    # Kill main process + all children
KillSignal=SIGTERM                # Graceful shutdown (SIGTERM first)
TimeoutStopSec=30                 # Force kill after 30 seconds

# Auto-restart (for graceful exits) ⭐
Restart=always                    # Restart on ANY exit (not just failures)
RestartSec=10                     # Wait 10 seconds between restarts
StartLimitInterval=300            # Prevent restart loop (5 restarts per 5min)
StartLimitBurst=5

# Resource limits (prevent runaway)
MemoryLimit=500M                  # Cap memory at 500MB
CPUQuota=50%                      # Cap CPU at 50% of 1 core

# Security
PrivateTmp=yes                    # Isolated /tmp
NoNewPrivileges=true              # Can't escalate privileges

[Install]
WantedBy=multi-user.target
```

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

✅ **Applied:** 2026-03-04  
✅ **Service:** anytype-cli (active, running)  
✅ **Zombie Prevention:** Enabled  
✅ **Resource Limits:** Active (500MB memory, 50% CPU)  
✅ **Auto-restart:** Enabled with rate limiting  

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
