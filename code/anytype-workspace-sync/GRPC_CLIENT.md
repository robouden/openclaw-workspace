# gRPC Client Development

## Status

**File Watcher:** ✅ Complete and running (detects changes instantly)
**gRPC Connection:** ✅ Fixed - connecting to correct port (31009, not 31011)
**API Layer:** ✅ Implemented (api.go with ObjectCreate/ObjectSetDetails)
**Proto Code Generation:** ✅ Complete (using anytype-heart module v0.48.1)
**RPC Calls:** ✅ Implemented (ready for testing)

## Architecture

### `client.go` - AnyType gRPC Client

Implements the gRPC client connection to AnyType on port 31011.

**Key functions:**
- `NewAnyTypeClient(addr)` - Creates and connects to gRPC server
- `SyncMarkdown(ctx, change, spaceID)` - Syncs a markdown file (placeholder)
- `HealthCheck(ctx)` - Verifies connection (placeholder)
- `Close()` - Closes the connection

### `main.go` - File Watcher with gRPC Integration

Updated to use the gRPC client:
- Connects to AnyType on startup
- Gracefully continues if connection fails
- Passes client to file sync operations
- Files queued with `⚠ queued` status when client unavailable

## Current Behavior

1. Service starts and attempts gRPC connection
2. If connection times out after 5 seconds, logs warning and continues
3. File watcher monitors `/root/anytype-workspace/` for changes
4. When file changes, attempts to sync via gRPC (or queues if not connected)
5. On successful connection, will sync queued files

## API Discovery ✅ Complete

**Found:** AnyType proto files in anytype-heart repo  
**Location:** `pb/protos/service/service.proto`, `commands.proto`, `events.proto`  
**Copied to:** `code/anytype-workspace-sync/proto/`

**Key RPC Methods for Sync:**
- `rpc ObjectCreate` - Create a new object/page in a space
- `rpc ObjectSetDetails` - Set properties (title, content, etc.)
- `rpc WorkspaceObjectAdd` - Add object to workspace

## Next Steps: Generate Proto Code

To complete the implementation:

### 1. Generate Go Code from Proto Files ✅

Install protoc and compile:
```bash
# Already copied proto files to: code/anytype-workspace-sync/proto/
# Commands defined in proto files:
# - ObjectCreate(Request) -> Response
# - ObjectSetDetails(Request) -> Response
```

### 2. Add Proto Definitions

Once we have the API, create `.proto` files:

```bash
mkdir -p code/anytype-workspace-sync/proto
# Add proto files here
```

Generate Go code:
```bash
protoc --go_out=. --go-grpc_out=. proto/*.proto
```

### 3. Implement SyncMarkdown()

In `client.go`:

```go
func (c *AnyTypeClient) SyncMarkdown(ctx context.Context, change *FileChange, spaceID string) error {
    // Create gRPC client stub
    // Call appropriate RPC method to create/update object
    // Handle response and errors
    return nil
}
```

### 4. Map Markdown to AnyType Objects

Design mapping:
- Each `.md` file → AnyType Page object
- File title → Page title
- Markdown content → Page content (or convert to blocks)
- Sync metadata (timestamps, versions)

## Testing

**Current:**
```bash
# Check logs
journalctl -u anytype-workspace-sync.service -f

# Create test file
echo "# Test" > /root/anytype-workspace/TEST.md

# Watch logs for sync event
journalctl -u anytype-workspace-sync.service -n 1 --no-pager
```

**Once API implemented:**
- Verify files actually sync to AnyType
- Test with various markdown structures
- Handle sync conflicts
- Verify data appears in AnyType clients

## References

- AnyType Heart: https://github.com/anyproto/anytype-heart
- AnyType TypeScript Client: https://github.com/anyproto/anytype-ts
- gRPC Go: https://grpc.io/docs/languages/go/
- Protocol Buffers: https://developers.google.com/protocol-buffers

---

Last updated: 2026-02-27 15:50 UTC
