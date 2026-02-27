# gRPC Client Development

## Status

**File Watcher:** ✅ Complete and running  
**gRPC Connection:** ✅ Implemented with graceful fallback  
**API Implementation:** 🚧 Pending (API discovery needed)

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

## Next Steps: Implement Actual gRPC Calls

To complete the implementation, we need to:

### 1. Discover the AnyType gRPC API

**Blocked by:**
- gRPC reflection not enabled on AnyType server (timeout)
- No public proto files available in anytype-heart repo

**Options:**
a) **Check AnyType documentation** for gRPC API details
b) **Use anytype-heart as a library** - Add as Go module dependency
c) **Reverse-engineer from TypeScript client** - Look at anytype-ts code
d) **Contact AnyType** - Request API documentation or proto files

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
