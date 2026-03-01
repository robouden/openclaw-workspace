# AnyType Workspace Sync - Complete Setup Guide

This guide walks you through setting up AnyType workspace sync from scratch on a fresh Ubuntu VPS.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: Install AnyType CLI](#part-1-install-anytype-cli)
3. [Part 2: Create Bot Account](#part-2-create-bot-account)
4. [Part 3: Join Space](#part-3-join-space)
5. [Part 4: Install Workspace Sync](#part-4-install-workspace-sync)
6. [Part 5: Verification](#part-5-verification)
7. [Quick Reference](#quick-reference)

---

## Prerequisites

### What You Need

- ✅ Ubuntu 24.04 VPS with root access
- ✅ Self-hosted AnyType network with:
  - Network ID (example: `N5Xkmn5vF7cwthDjh6avXem2q1Q56P5xkji19SDU8PQ9m6uD`)
  - Network configuration file (`client-config.yml`)
  - Space ID (example: `bafyreig4q7t3vt7b...`)
- ✅ Invite to the AnyType space
  - Invite CID
  - Invite key
- ✅ SSH access to VPS
- ✅ Go 1.21+ installed locally (for building)

### Network Information Template

Fill this out before starting:

```
Network ID: _______________________________________
Space ID: __________________________________________
Invite CID: ________________________________________
Invite Key: ________________________________________
VPS IP: ____________________________________________
```

---

## Part 1: Install AnyType CLI

### Step 1.1: SSH to Your VPS

```bash
ssh root@YOUR_VPS_IP
```

### Step 1.2: Download AnyType CLI

```bash
# Download latest anytype-cli
wget https://github.com/anyproto/anytype-cli/releases/latest/download/anytype-linux-amd64

# Make it executable
chmod +x anytype-linux-amd64

# Move to local bin
mkdir -p /root/.local/bin
mv anytype-linux-amd64 /root/.local/bin/anytype

# Verify installation
/root/.local/bin/anytype version
```

Expected output:
```
anytype version X.X.X
```

### Step 1.3: Install Go (if needed for building)

```bash
# Download Go
cd /tmp
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz

# Install
tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz

# Add to PATH (temporary)
export PATH=$PATH:/usr/local/go/bin

# Verify
/usr/local/go/bin/go version
```

### Step 1.4: Verify Network Configuration

```bash
# Check if network config exists
cat /var/lib/anytype/data/client-config.yml
```

Expected output format:
```yaml
id: SOME_ID
networkId: N5Xkmn5vF...
nodes:
  - peerId: 12D3KooW...
    addresses:
      - quic://hostname:33020
      - hostname:33010
```

If this file doesn't exist, you need to set up your self-hosted AnyType network first.

---

## Part 2: Create Bot Account

### Step 2.1: Create Account

```bash
/root/.local/bin/anytype auth create my-sync-bot \
  --network-config /var/lib/anytype/data/client-config.yml
```

**IMPORTANT**: Save the output! You'll see:

```
✓ Bot account created successfully!

╔════════════════════════════════════════════════╗
║                BOT ACCOUNT KEY                  ║
╠════════════════════════════════════════════════╣
║  4FCU3Gvp...very...long...key...here...==      ║
╚════════════════════════════════════════════════╝

📋 Bot Account Details:
   Name: my-sync-bot
   Account Id: A8bgLxVCmHc4eRCzUi9bVLMXKEZjKFmqa8DExbNFTsLLXHr7
```

**Save these securely**:
- ✅ Account ID: `A8bgLxVCmHc4eRCzUi9bVLMXKEZjKFmqa8DExbNFTsLLXHr7`
- ✅ Account Key: `4FCU3Gvp...==`

### Step 2.2: Verify Account Status

```bash
/root/.local/bin/anytype auth status
```

Should show:
```
✓ Logged in to account A8bgLxVC...
- Active session: true
```

---

## Part 3: Join Space

### Step 3.1: Start AnyType Server

```bash
# Start in background
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &

# Wait a few seconds
sleep 5

# Verify it's running
ps aux | grep 'anytype serve' | grep -v grep
```

Should show a process running.

### Step 3.2: Verify gRPC Port

```bash
ss -tlnp | grep 31010
```

Should show:
```
LISTEN 0 4096 127.0.0.1:31010 0.0.0.0:* users:(("anytype",pid=XXXXX,fd=3))
```

### Step 3.3: Join the Space

Format your invite link:
```
anytype://invite/?cid=YOUR_INVITE_CID&key=YOUR_INVITE_KEY
```

Then join:

```bash
/root/.local/bin/anytype space join \
  'anytype://invite/?cid=YOUR_INVITE_CID&key=YOUR_INVITE_KEY' \
  --network YOUR_NETWORK_ID
```

Expected output:
```
Joining space '' created by OWNER_NAME...
✓ Successfully sent join request to space 'bafyreig...'
```

### Step 3.4: Verify Space Access

```bash
/root/.local/bin/anytype space list
```

Should show your space:
```
SPACE ID                                            NAME            STATUS
────────                                            ────            ──────
bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws...     Your Space      Active
```

**✅ Checkpoint**: If you see your space listed as "Active", proceed to Part 4.

---

## Part 4: Install Workspace Sync

### Step 4.1: Create Workspace Directory (on VPS)

```bash
ssh root@YOUR_VPS_IP "mkdir -p /root/anytype-workspace"
```

### Step 4.2: Build on Local Machine

```bash
# Clone or navigate to the workspace-sync directory
cd /path/to/anytype-workspace-sync

# Build
/usr/local/go/bin/go build -o anytype-workspace-sync-bin
```

### Step 4.3: Update Configuration

Edit `main.go` and update the space ID:

```go
const (
    workspaceDir = "/root/anytype-workspace"
    spaceID      = "YOUR_SPACE_ID_HERE"  // ← Update this!
    grpcAddr     = "127.0.0.1:31010"
)
```

Rebuild:
```bash
/usr/local/go/bin/go build -o anytype-workspace-sync-bin
```

### Step 4.4: Deploy to VPS

```bash
scp anytype-workspace-sync-bin root@YOUR_VPS_IP:/root/
```

### Step 4.5: Create Systemd Service

On the VPS, create `/etc/systemd/system/anytype-workspace-sync.service`:

```bash
cat > /etc/systemd/system/anytype-workspace-sync.service <<'EOF'
[Unit]
Description=AnyType Workspace Sync Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/root/anytype-workspace-sync-bin
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

### Step 4.6: Enable and Start Service

```bash
systemctl daemon-reload
systemctl enable anytype-workspace-sync.service
systemctl start anytype-workspace-sync.service
```

### Step 4.7: Check Service Status

```bash
systemctl status anytype-workspace-sync
```

Should show:
```
● anytype-workspace-sync.service - AnyType Workspace Sync Service
   Loaded: loaded
   Active: active (running)
```

### Step 4.8: View Logs

```bash
journalctl -u anytype-workspace-sync -f
```

Should show:
```
[2026-03-01T12:00:00Z] Connected to AnyType
[2026-03-01T12:00:00Z] Running initial sync...
[2026-03-01T12:00:00Z] ✓ file1 synced to AnyType
[2026-03-01T12:00:00Z] ✓ file2 synced to AnyType
[2026-03-01T12:00:00Z] Initial sync complete
[2026-03-01T12:00:00Z] Watching /root/anytype-workspace for changes...
```

---

## Part 5: Verification

### Test 1: Create a File

```bash
ssh root@YOUR_VPS_IP "echo '# Test Note\nThis is a test' > /root/anytype-workspace/test.md"

# Wait a few seconds, then check logs
ssh root@YOUR_VPS_IP "journalctl -u anytype-workspace-sync -n 10"
```

Should show:
```
[...] Syncing test...
[...] ✓ test synced to AnyType
```

### Test 2: Verify in AnyType

Open your AnyType app and check if "Test Note" appears in your space.

### Test 3: Delete a File

```bash
ssh root@YOUR_VPS_IP "rm /root/anytype-workspace/test.md"

# Check logs
ssh root@YOUR_VPS_IP "journalctl -u anytype-workspace-sync -n 10"
```

Should show:
```
[...] Deleting test...
[...] ✓ test deleted from AnyType
```

### Test 4: Check Object Map

```bash
ssh root@YOUR_VPS_IP "cat /root/.anytype-workspace-objectmap.json"
```

Should show JSON mapping of files to object IDs.

---

## Quick Reference

### Common Commands

```bash
# View sync logs
journalctl -u anytype-workspace-sync -f

# Restart sync service
systemctl restart anytype-workspace-sync

# Check service status
systemctl status anytype-workspace-sync

# List spaces
/root/.local/bin/anytype space list

# Check auth status
/root/.local/bin/anytype auth status

# View anytype server logs
tail -f /tmp/anytype-serve.log

# Check if gRPC is running
ss -tlnp | grep 31010
```

### File Locations

```
/root/anytype-workspace/              # Watched directory
/root/anytype-workspace-sync-bin      # Sync service binary
/root/.anytype/config.json            # AnyType config + session token
/root/.anytype-workspace-objectmap.json  # File→Object ID mapping
/tmp/anytype-serve.log                # AnyType server logs
/etc/systemd/system/anytype-workspace-sync.service  # Service file
```

### Restart Everything (if stuck)

```bash
# Stop services
systemctl stop anytype-workspace-sync
pkill -f 'anytype serve'

# Wait
sleep 3

# Start anytype server
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &

# Wait for server to start
sleep 5

# Start sync service
systemctl start anytype-workspace-sync

# Check status
systemctl status anytype-workspace-sync
journalctl -u anytype-workspace-sync -n 20
```

---

## Troubleshooting

### Problem: "not authenticated - check network membership"

**Solution**:
```bash
# Restart both services
pkill -f 'anytype serve'
sleep 2
nohup /root/.local/bin/anytype serve -q > /tmp/anytype-serve.log 2>&1 &
sleep 5
systemctl restart anytype-workspace-sync
```

### Problem: Files not syncing

**Check**:
1. Service running: `systemctl status anytype-workspace-sync`
2. AnyType running: `ps aux | grep 'anytype serve'`
3. Logs: `journalctl -u anytype-workspace-sync -n 50`

### Problem: Space not found

**Check**:
1. Space is joined: `/root/.local/bin/anytype space list`
2. Correct space ID in `main.go`
3. Service restarted after changing `main.go`

### Problem: Can't join space

**Check**:
1. Account created with correct network: `/root/.local/bin/anytype auth status`
2. AnyType server running: `ss -tlnp | grep 31010`
3. Valid invite link (not expired)
4. Network configuration correct: `cat /var/lib/anytype/data/client-config.yml`

---

## Success Checklist

- [ ] AnyType CLI installed and working
- [ ] Bot account created with correct network
- [ ] AnyType server running on port 31010
- [ ] Space joined successfully
- [ ] Workspace directory created
- [ ] Sync service binary deployed
- [ ] Space ID updated in main.go
- [ ] Systemd service created and enabled
- [ ] Service running without errors
- [ ] Test file synced successfully
- [ ] Test deletion worked
- [ ] Object map file exists

---

## Next Steps

After successful setup:

1. **Monitor** - Keep an eye on logs for the first few days
2. **Test** - Create, update, and delete various markdown files
3. **Backup** - Save your account key securely
4. **Automate** - Use this for bot integrations (like OpenClaw)
5. **Document** - Note any custom configurations for your setup

## Getting Help

If you get stuck:

1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Review [README.md](README.md) for detailed information
3. Check logs: `journalctl -u anytype-workspace-sync -n 100`
4. Verify all prerequisites are met
5. Try the "Restart Everything" procedure

---

**Setup Date**: _______________
**VPS IP**: _______________
**Account ID**: _______________
**Space ID**: _______________
**Network ID**: _______________

Good luck! 🚀
