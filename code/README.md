# Code Directory

This directory contains Go applications for AnyType workspace management.

## Projects

### anytype-workspace-sync

File watcher service that monitors `/root/anytype-workspace/` for markdown changes and syncs to AnyType.

**Status**: ✅ Running as systemd service  
**Build**: `cd anytype-workspace-sync && /usr/local/go/bin/go build`  
**Output**: `/root/anytype-workspace-sync-bin`  
**Service**: `anytype-workspace-sync.service`

#### Building

```bash
cd anytype-workspace-sync
/usr/local/go/bin/go mod tidy
/usr/local/go/bin/go build -o /root/anytype-workspace-sync-bin ./main.go
```

#### Usage

The service is managed by systemd:

```bash
# Check status
systemctl status anytype-workspace-sync.service

# View logs
journalctl -u anytype-workspace-sync.service -f

# Restart
systemctl restart anytype-workspace-sync.service
```

#### TODO

- [ ] Implement gRPC client to sync with AnyType (port 31011)
- [ ] Handle sync conflicts
- [ ] Add support for daily log files
- [ ] Tests

---

All Go code should be in this `/code` directory. Keep it organized and documented.
