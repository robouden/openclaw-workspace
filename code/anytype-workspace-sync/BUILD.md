# Build Instructions

## Quick Start (VPS)

```bash
cd /root/.openclaw/workspace/code/anytype-workspace-sync

# Pull latest changes
git pull origin main

# Fix dependencies first (if build fails with missing go.sum entries)
./fix-deps.sh

# Build and install
make install

# Restart service
systemctl restart anytype-workspace-sync.service

# Check status
systemctl status anytype-workspace-sync.service

# View logs
journalctl -u anytype-workspace-sync.service -f
```

## Manual Build Steps

If the Makefile doesn't work:

```bash
# 1. Navigate to source directory
cd /root/.openclaw/workspace/code/anytype-workspace-sync

# 2. Download dependencies
go mod download
go mod tidy

# 3. Build binary
go build -o anytype-workspace-sync-bin .

# 4. Copy to /root
cp anytype-workspace-sync-bin /root/

# 5. Restart service
systemctl restart anytype-workspace-sync.service
```

## Testing the Implementation

After building and restarting:

```bash
# 1. Check service is running
systemctl status anytype-workspace-sync.service

# 2. Watch logs in real-time
journalctl -u anytype-workspace-sync.service -f

# 3. Test with a new file
echo "# Test Page" > /root/anytype-workspace/TEST-$(date +%s).md

# 4. Verify in logs:
# - File change detected
# - gRPC connection established
# - ObjectCreate called
# - ObjectSetDetails called
# - Sync completed

# 5. Check in AnyType app
# - Open AnyType desktop/web app
# - Navigate to your space
# - Look for new "Test Page" object
```

## Troubleshooting

### gRPC Connection Failed

```bash
# Check if AnyType is running
ps aux | grep anytype

# Check port 31009 is listening (actual AnyType gRPC port)
ss -tlnp | grep 31009

# Check space ID is correct
cat /root/.openclaw/workspace/code/anytype-workspace-sync/main.go | grep spaceID
```

### Build Errors

```bash
# Clear Go cache
go clean -cache -modcache

# Re-download dependencies
rm go.sum
go mod download
go mod tidy

# Rebuild
make clean build
```

### Proto Import Errors / Missing go.sum Entries

If you see errors like:
```
api.go:8:2: missing go.sum entry for module providing package github.com/anyproto/anytype-heart/pb
```

**Quick Fix:**
```bash
# Use the fix script
./fix-deps.sh
```

**Manual Fix:**
```bash
# Clean and regenerate dependencies
go clean -modcache
rm -f go.sum
go mod download
go mod tidy

# Verify anytype-heart is present
go list -m all | grep anytype-heart
```

This regenerates `go.sum` with the correct checksums for all subpackages.

## Dependencies

- **Go:** 1.24.6 or later
- **anytype-heart:** v0.48.1 (provides proto definitions)
- **grpc:** v1.75.0
- **protobuf:** v1.36.11
- **fsnotify:** v1.7.0

## Files Modified

- `api.go` - Implemented ObjectCreate and ObjectSetDetails RPCs
- `go.mod` - Added anytype-heart dependency
- `Makefile` - Build automation
- `BUILD.md` - This file

## Implementation Details

### ObjectCreate RPC

Creates a new AnyType object (page) in the specified space:

```go
req := &pb.RpcObjectCreateRequest{
    SpaceId: spaceID,
    Details: &structpb.Struct{
        Fields: map[string]*structpb.Value{
            "name": structpb.NewStringValue(title),
        },
    },
}
```

### ObjectSetDetails RPC

Updates object properties (title and content):

```go
req := &pb.RpcObjectSetDetailsRequest{
    ContextId: objectID,
    Details: []*pb.RpcObjectSetDetailsDetail{
        {Key: "name", Value: structpb.NewStringValue(title)},
        {Key: "description", Value: structpb.NewStringValue(content)},
    },
}
```

## Next Steps

After successful deployment:

1. Monitor logs for any gRPC errors
2. Verify objects are created in AnyType space
3. Test with various markdown files
4. Handle edge cases (large files, special characters, etc.)
5. Implement proper error recovery
6. Add object search/update logic (currently creates new objects each time)

---

Last updated: 2026-02-28
