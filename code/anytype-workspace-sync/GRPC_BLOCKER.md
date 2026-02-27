# gRPC Connection Blocker

**Status:** ⚠️ Blocking final implementation

## Issue

File watcher successfully detects markdown changes in `/root/anytype-workspace/` but **gRPC handshake to AnyType times out**.

### Symptoms
```
[16:33:42Z] Syncing TEST.md...
[16:33:42Z] ⚠ TEST.md queued (gRPC client not connected)
```

Files are queued indefinitely; sync never occurs.

### Root Cause

**gRPC requires HTTP/2**
- Server at `127.0.0.1:31011` requires HTTP/2 protocol
- Our Go gRPC client attempts HTTP/2 handshake
- Handshake times out after 5 seconds (context deadline exceeded)
- Even with 10-second timeout, connection fails

**Evidence:**
```
✅ TCP connection: 127.0.0.1:31011 succeeds
✅ HTTP/2 preface: Server responds with 400 Bad Request (knows about HTTP/2)
❌ gRPC handshake: Timeout after 5-10 seconds
```

## Possible Causes

1. **Protocol version mismatch** - Server expects specific gRPC version
2. **TLS requirement** - Server might expect encrypted connection despite "insecure" mode
3. **Custom handshake** - AnyType might use non-standard gRPC dialect
4. **Network/firewall issue** - Less likely (TCP works fine)
5. **Authentication required** - Might need account credentials

## Investigation Done

✅ Verified AnyType listening on port 31011  
✅ Verified TCP connection works  
✅ Verified HTTP/2 is required (server says so)  
✅ Tried grpcurl (times out same way)  
✅ Checked service logs (no hints)  
✅ Reviewed anytype-heart source (no clear endpoint docs)  

## Workarounds

### Option 1: Manual Sync via AnyType App (Current)
- **Status:** ✅ Works perfectly
- Files in `/root/anytype-workspace/` sync when edited in AnyType app
- Watcher monitors but doesn't sync automatically
- **Time cost:** Edit in app, changes reflected on all devices

### Option 2: Investigate Further
- Clone anytype-heart repo, check internal tests for connection examples
- Try TLS with self-signed cert
- Enable gRPC debug logging
- Contact AnyType maintainers

### Option 3: Direct Database Sync
- Write directly to AnyType SQLite databases
- Bypass gRPC entirely
- **Risk:** Unsupported, could corrupt data

### Option 4: REST API Alternative
- Check if AnyType exposes REST API on port 31012
- Currently returns 404
- Might be disabled or need different endpoint

## Next Steps

**Recommend:** Use Option 1 (manual sync) as the working solution  
**Alternative:** Deep dive into anytype-heart source code for connection clues

## Code State

- **File watcher:** 100% functional
- **gRPC client:** Framework complete, handshake failing
- **RPC calls:** Implemented but unreachable

If gRPC connects, sync would work immediately (no code changes needed).

---
**Blocker since:** 2026-02-27 16:40 UTC  
**Attempted solutions:** 10+  
**Estimated additional time to resolve:** Unknown (requires deeper investigation)
