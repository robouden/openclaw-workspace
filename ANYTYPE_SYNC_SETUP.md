# AnyType Workspace Sync Setup

## Status

**File Watcher:** ✅ Running (systemd service: `anytype-workspace-sync.service`)  
**gRPC Sync:** 🚧 In Progress (discovered gRPC API on port 31011)

## How It Works

1. **File Watcher** monitors `/root/anytype-workspace/` for `.md` file changes
2. **Detects changes** and queues them for sync
3. **gRPC client** (to be implemented) sends to AnyType database
4. **Synced to AnyType** shared space across all devices

## Current Setup

### Workspace Folder
```
/root/anytype-workspace/
├── COST_TRACKING.md
├── IDENTITY.md
├── MEMORY.md
├── README.md
├── SOUL.md
├── TOOLS.md
└── USER.md
```

### Watcher Service
```bash
# View status
systemctl status anytype-workspace-sync.service

# View logs
journalctl -u anytype-workspace-sync.service -f

# Restart
systemctl restart anytype-workspace-sync.service
```

### Files to Sync
Any `.md` file in `/root/anytype-workspace/` is monitored.

**Current workflow:**
1. Edit a file in `/root/anytype-workspace/`
2. Watcher detects change
3. File is queued for sync
4. (TODO) gRPC client sends to AnyType

## Technical Details

### AnyType API Discovery
- **gRPC**: `127.0.0.1:31011` (main API)
- **HTTP REST**: `127.0.0.1:31012` (404 - not available)
- **Unknown**: `127.0.0.1:47800`

### Next Steps

To implement gRPC sync:

1. **Install grpcurl** (optional, for debugging):
   ```bash
   go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest
   ```

2. **Get gRPC proto files** from AnyType to understand the API

3. **Implement gRPC client** in Node.js or Go to:
   - Create/update objects in shared space
   - Map markdown files to AnyType pages
   - Handle sync conflicts

4. **Update watcher.js** to call gRPC client on file change

## Manual Sync (Current Workaround)

Until gRPC sync is implemented, you can manually sync files through the AnyType app:

1. Open AnyType desktop or web app
2. Edit workspace documents directly
3. Changes sync automatically across devices via P2P

The `/root/anytype-workspace/` folder remains the source of truth for backups.

## Space ID Reference

- **Shared Space**: `bafyreietc6lmsanpkyfz4m3x2xd4hb5vvxex7ywalouqcugufarmhy3nue.10piockh34xft`
- **Bot Account**: `AB4nnRmgS8ocfTdV5UNFX8st5dZZoWnXp7gowBpbpVjS7CPK`

---
Last updated: 2026-02-27 15:45 UTC
