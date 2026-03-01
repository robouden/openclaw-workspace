# AnyType Workspace Sync - Technical Architecture

This document describes the technical architecture, design decisions, and implementation details of the AnyType Workspace Sync system.

## System Overview

The system enables programmatic access to self-hosted AnyType spaces by bridging filesystem operations with AnyType's gRPC API.

```
┌──────────────────────────────────────────────────────────────┐
│                    External Systems                           │
│                  (Bots, Scripts, Tools)                       │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      │ Writes markdown files
                      ▼
┌──────────────────────────────────────────────────────────────┐
│              Filesystem Layer                                 │
│                                                                │
│  /root/anytype-workspace/*.md                                │
│  - test-note.md                                               │
│  - project-doc.md                                             │
│  - meeting-notes.md                                           │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      │ fsnotify events
                      ▼
┌──────────────────────────────────────────────────────────────┐
│           anytype-workspace-sync Service                      │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ File Watcher │  │ Object Map   │  │ gRPC Client  │       │
│  │  (fsnotify)  │  │  (JSON DB)   │  │ (with auth)  │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │                │
│         └──────────────────┴──────────────────┘                │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      │ gRPC over localhost:31010
                      │ (with session token)
                      ▼
┌──────────────────────────────────────────────────────────────┐
│         AnyType Desktop (serve -q mode)                       │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ gRPC Server  │  │   Auth       │  │ Space Mgmt   │       │
│  │  :31010      │  │ Middleware   │  │              │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │                │
│         └──────────────────┴──────────────────┘                │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      │ P2P sync
                      ▼
┌──────────────────────────────────────────────────────────────┐
│         Self-Hosted AnyType Network                           │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Coordinator │  │   Consensus  │  │  File Node   │       │
│  │  (MongoDB)   │  │   (MongoDB)  │  │   (Redis)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. File Watcher (fsnotify)

**Purpose**: Monitor filesystem for changes in real-time.

**Implementation**:
```go
watcher, _ := fsnotify.NewWatcher()
watcher.Add("/root/anytype-workspace")

for {
    select {
    case event := <-watcher.Events:
        if event.Op&fsnotify.Remove == fsnotify.Remove {
            DeleteFile(event.Name)
        } else if event.Op&fsnotify.Write == fsnotify.Write {
            SyncFile(event.Name)
        }
    }
}
```

**Features**:
- Recursive directory watching
- Debouncing (2 second delay to avoid duplicate events)
- File timestamp tracking
- `.md` file filtering

**Events Handled**:
- `Create` - New file created → Sync to AnyType
- `Write` - File modified → Update in AnyType
- `Remove` - File deleted → Delete from AnyType

### 2. Object Map (Persistent Storage)

**Purpose**: Maintain bidirectional mapping between filenames and AnyType object IDs.

**File Location**: `/root/.anytype-workspace-objectmap.json`

**Structure**:
```json
{
  "filename-without-extension": "bafyreif6xrpi4yx4fmhy7...",
  "another-file": "bafyreickujocrhaglvvru..."
}
```

**Implementation**:
```go
type ObjectMap struct {
    mu      sync.RWMutex
    mapping map[string]string
}

func (om *ObjectMap) Set(filename, objectID string) error {
    om.mu.Lock()
    defer om.mu.Unlock()
    om.mapping[filename] = objectID
    return om.save()
}
```

**Thread Safety**: Uses `sync.RWMutex` for concurrent access.

**Persistence**: Saves to disk after every modification.

**Use Cases**:
1. **Create/Update**: Store object ID after successful creation
2. **Delete**: Look up object ID, delete from AnyType, remove from map
3. **Restart Recovery**: Load mappings from disk on service start

### 3. gRPC Client

**Purpose**: Communicate with AnyType's gRPC API for object operations.

**Connection**:
```go
conn, _ := grpc.Dial("127.0.0.1:31010",
    grpc.WithTransportCredentials(insecure.NewCredentials()))
client := service.NewClientCommandsClient(conn)
```

**Authentication**:
```go
// Read session token from config
token := readSessionToken() // from ~/.anytype/config.json

// Add to every request
ctx = metadata.AppendToOutgoingContext(ctx, "token", token)
```

**RPCs Used**:

1. **WorkspaceOpen** - Opens a space for operations
   ```go
   resp, _ := client.WorkspaceOpen(ctx, &pb.RpcWorkspaceOpenRequest{
       SpaceId: spaceID,
   })
   ```

2. **ObjectCreate** - Creates a new note
   ```go
   resp, _ := client.ObjectCreate(ctx, &pb.RpcObjectCreateRequest{
       SpaceId:             spaceID,
       Details:             details,
       ObjectTypeUniqueKey: "ot-note",
   })
   ```

3. **ObjectListDelete** - Deletes objects
   ```go
   resp, _ := client.ObjectListDelete(ctx, &pb.RpcObjectListDeleteRequest{
       ObjectIds: []string{objectID},
   })
   ```

### 4. AnyType Desktop (Server Mode)

**Start Command**:
```bash
anytype serve -q
```

**Features**:
- Runs headless (no GUI)
- gRPC server on `127.0.0.1:31010`
- gRPC-Web proxy on `127.0.0.1:31011`
- Auto-login from stored credentials

**Authentication Flow**:
1. Reads account key from `/root/.anytype/config.json`
2. Generates session token
3. Stores token back in config
4. Validates token on every gRPC request

**Session Token Format**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZWVkIjoiSGNHc3l3T0gifQ.xWn_B2psFw1...
```
- JWT (JSON Web Token)
- HS256 algorithm
- Contains account seed

## Data Flow

### Create/Update Flow

```
1. User/Bot creates file
   ↓
   echo "# Note" > /root/anytype-workspace/note.md

2. fsnotify detects Write event
   ↓
   event.Op == fsnotify.Write

3. Debounce check (2 seconds)
   ↓
   if now - lastChange < 2s: skip

4. Parse markdown file
   ↓
   title := extractTitle(content)
   content := readFile()

5. Create gRPC request
   ↓
   ObjectCreate(title, content, spaceID)

6. Add authentication
   ↓
   ctx = withAuth(ctx, sessionToken)

7. Send to AnyType
   ↓
   resp := client.ObjectCreate(ctx, req)

8. Store object ID
   ↓
   objectMap.Set("note", resp.ObjectId)

9. Log success
   ↓
   ✓ note synced to AnyType
```

### Delete Flow

```
1. User/Bot deletes file
   ↓
   rm /root/anytype-workspace/note.md

2. fsnotify detects Remove event
   ↓
   event.Op == fsnotify.Remove

3. Extract filename
   ↓
   filename := "note" (without .md)

4. Lookup object ID
   ↓
   objectID := objectMap.Get("note")

5. Create delete request
   ↓
   ObjectListDelete(objectID)

6. Add authentication
   ↓
   ctx = withAuth(ctx, sessionToken)

7. Send to AnyType
   ↓
   resp := client.ObjectListDelete(ctx, req)

8. Remove from map
   ↓
   objectMap.Delete("note")

9. Log success
   ↓
   ✓ note deleted from AnyType
```

## Security Model

### Authentication Chain

```
1. Account Creation
   anytype auth create bot-name --network-config ...
   ↓
   Generates: Account Key (private key)

2. Login
   anytype auth login --account-key KEY
   ↓
   Stores: Account Key in ~/.anytype/config.json

3. Server Start
   anytype serve -q
   ↓
   Auto-login: Reads account key
   Generates: Session Token (JWT)
   Stores: Session Token in config.json

4. Workspace Sync
   Reads: Session Token from config.json
   Sends: Token with every gRPC request
   ↓
   Server validates: Token signature and expiry
```

### Security Boundaries

1. **Local Only**: gRPC server binds to `127.0.0.1` (not accessible remotely)
2. **Session Tokens**: Short-lived, rotated on server restart
3. **Account Keys**: Long-lived, stored encrypted on disk
4. **File Permissions**: Config files readable only by root

### Threat Model

**Protected Against**:
- ✅ Remote access (localhost binding)
- ✅ Unauthorized local processes (session token required)
- ✅ Token theft (short-lived)

**Not Protected Against**:
- ❌ Root-level compromise
- ❌ Session token expiry (requires restart)
- ❌ Account key theft

## Performance Characteristics

### Latency

| Operation | Typical Time | Notes |
|-----------|-------------|-------|
| File detection | <1s | fsnotify is immediate |
| Debounce delay | 2s | Prevents duplicate events |
| gRPC object create | 100-300ms | Network + processing |
| gRPC object delete | 50-150ms | Faster than create |
| Total create sync | ~2.5s | Detection + debounce + RPC |
| Total delete sync | ~2.5s | Detection + debounce + RPC |

### Resource Usage

| Resource | Idle | Active Sync |
|----------|------|-------------|
| CPU | <1% | 2-5% |
| Memory | 20-30 MB | 40-50 MB |
| Disk I/O | Minimal | < 1 KB/s |
| Network | 0 | < 10 KB/s |

### Scalability

| Metric | Limit | Notes |
|--------|-------|-------|
| Files watched | ~10,000 | fsnotify limit |
| Object map size | Unlimited | JSON in memory |
| Concurrent syncs | 1 | Sequential processing |
| gRPC connection | 1 | Persistent connection |

## Error Handling

### Retry Strategy

**No Retries**: Currently, failed operations are logged but not retried.

**Rationale**:
- File changes can be re-triggered by modifying the file again
- Automatic retry could mask authentication issues
- Systemd handles service-level restarts

### Error Categories

1. **Authentication Errors** (`Unauthenticated`)
   - Action: Log error
   - Recovery: Restart services
   - Prevention: Implement token refresh

2. **Network Errors** (`Unavailable`)
   - Action: Log error
   - Recovery: Service auto-restart
   - Prevention: Health checks

3. **Application Errors** (`InvalidArgument`, `Internal`)
   - Action: Log error with details
   - Recovery: Manual investigation
   - Prevention: Input validation

### Logging

**Format**: RFC3339 timestamp + message
```
[2026-03-01T12:00:00Z] ✓ file synced to AnyType
```

**Levels**:
- `✓` Success
- `⚠` Warning (non-fatal)
- `✗` Error (operation failed)
- `→` Debug/Info

**Destinations**:
- Stdout → systemd journal
- Journal → `journalctl -u anytype-workspace-sync`

## Design Decisions

### Why Filesystem-Based?

**Pros**:
- ✅ Simple interface (any tool can write files)
- ✅ Version control friendly (git works)
- ✅ No API learning curve
- ✅ Observable (can see files)

**Cons**:
- ❌ Not real-time (2s debounce)
- ❌ No conflict resolution
- ❌ Filesystem limits apply

**Alternative Considered**: Direct gRPC API
- Rejected: Requires every client to understand AnyType protocol

### Why Session Tokens?

**Pros**:
- ✅ No password in memory
- ✅ Can be revoked
- ✅ Time-limited

**Cons**:
- ❌ Expire quickly
- ❌ Require server restart to refresh

**Alternative Considered**: Account Key directly
- Rejected: Security risk (long-lived credential)

### Why Object Map?

**Pros**:
- ✅ Enables delete operations
- ✅ Survives restarts
- ✅ Simple JSON format

**Cons**:
- ❌ Can get out of sync
- ❌ No garbage collection

**Alternative Considered**: Query AnyType for object by name
- Rejected: API doesn't support efficient name-based lookup

### Why Go?

**Pros**:
- ✅ Static binary (easy deployment)
- ✅ Good gRPC support
- ✅ Cross-compilation
- ✅ AnyType SDK in Go

**Cons**:
- ❌ Larger binary size (~10 MB)
- ❌ GC overhead (minimal)

**Alternative Considered**: Python
- Rejected: Requires runtime, slower gRPC

## Future Enhancements

### 1. Token Refresh
**Problem**: Session tokens expire
**Solution**: Implement automatic refresh
```go
if resp.Error == "Unauthenticated" {
    token := refreshToken(accountKey)
    retry(request, token)
}
```

### 2. Bidirectional Sync
**Problem**: Changes in AnyType don't reflect in files
**Solution**: Subscribe to space changes
```go
stream := client.ObjectSubscribe(spaceID)
for change := range stream {
    writeFile(change.ObjectId, change.Content)
}
```

### 3. Conflict Resolution
**Problem**: Simultaneous changes cause data loss
**Solution**: Implement last-write-wins or merge
```go
if localModTime > remoteModTime {
    pushToRemote()
} else {
    pullFromRemote()
}
```

### 4. Health Endpoint
**Problem**: Hard to monitor service health
**Solution**: HTTP health check
```go
http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    if isHealthy() {
        w.WriteHeader(200)
    } else {
        w.WriteHeader(500)
    }
})
```

## Debugging Guide

### Enable Debug Logging

Modify main.go:
```go
const debugMode = true // Add this

if debugMode {
    fmt.Printf("[DEBUG] Token: %s\n", token)
    fmt.Printf("[DEBUG] Request: %+v\n", req)
}
```

### Trace gRPC Calls

```bash
# Set environment variable
export GRPC_GO_LOG_SEVERITY_LEVEL=info
export GRPC_GO_LOG_VERBOSITY_LEVEL=2

# Restart service
systemctl restart anytype-workspace-sync
```

### Inspect Traffic

```bash
# Monitor gRPC port
tcpdump -i lo -A 'port 31010'

# Count requests
ss -tn | grep 31010 | wc -l
```

### Check Object Map Consistency

```bash
# Compare files to map
ls /root/anytype-workspace/*.md | \
  sed 's/.*\///' | sed 's/\.md$//' | \
  sort > /tmp/files.txt

jq -r 'keys[]' /root/.anytype-workspace-objectmap.json | \
  sort > /tmp/map.txt

diff /tmp/files.txt /tmp/map.txt
```

## Testing

### Unit Tests

```bash
go test ./...
```

### Integration Test

```bash
# Create test file
echo "# Test" > /root/anytype-workspace/integration-test.md

# Wait for sync
sleep 5

# Verify in logs
journalctl -u anytype-workspace-sync | grep integration-test

# Delete
rm /root/anytype-workspace/integration-test.md

# Verify deletion
sleep 5
journalctl -u anytype-workspace-sync | grep "Deleting integration-test"
```

### Load Test

```bash
# Create 100 files
for i in {1..100}; do
    echo "# Test $i" > /root/anytype-workspace/load-test-$i.md
done

# Monitor performance
journalctl -u anytype-workspace-sync -f
```

## Maintenance

### Regular Tasks

**Daily**:
- Check service status: `systemctl status anytype-workspace-sync`
- Review error logs: `journalctl -u anytype-workspace-sync -p err --since today`

**Weekly**:
- Check disk usage: `du -sh /root/anytype-workspace`
- Review object map size: `wc -l /root/.anytype-workspace-objectmap.json`

**Monthly**:
- Rotate logs: `journalctl --vacuum-time=30d`
- Test backup/restore procedure

### Backup

```bash
# Backup script
#!/bin/bash
tar -czf anytype-backup-$(date +%Y%m%d).tar.gz \
    /root/anytype-workspace \
    /root/.anytype/config.json \
    /root/.anytype-workspace-objectmap.json
```

### Upgrade Procedure

1. Stop service: `systemctl stop anytype-workspace-sync`
2. Backup: Run backup script
3. Build new binary: `go build -o anytype-workspace-sync-bin`
4. Deploy: `scp anytype-workspace-sync-bin root@VPS:/root/`
5. Start service: `systemctl start anytype-workspace-sync`
6. Verify: `journalctl -u anytype-workspace-sync -n 50`

---

**Document Version**: 1.0
**Last Updated**: 2026-03-01
**Author**: Architecture Team
