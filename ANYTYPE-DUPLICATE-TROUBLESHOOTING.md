# AnyType Duplicate Files — Troubleshooting Guide

**Date:** 2026-03-04  
**Issue:** Same files appearing multiple times in AnyType with different object IDs

---

## Problem

When files in `/root/anytype-workspace/` are synced to AnyType, the sync service sometimes creates **NEW objects instead of updating existing ones**, resulting in duplicates:

**Example:**
```
VPS Daily Health Report — 2026-03-04
├─ ID: bafyreigwwp3rnndjur6qcbpmdm2yau2smmyd6i56o3a6vmyifer7h44egi (22:00:14) ✓ Keep this
└─ ID: bafyreic5ofsrk6qlv5cn3aatpat7gte3wrn2urn65uk3gkuugo6mkdgnmq (22:00:16) ✗ DELETE this
```

---

## Root Cause

The `anytype-workspace-sync` service does NOT track which objects have already been created. When a file is synced multiple times (due to retries, service restarts, etc.), it creates a NEW object instead of updating the existing one.

**What should happen:**
```
File updated → Query for existing object → Update it
```

**What actually happens:**
```
File updated → Create a new object (ignoring old one)
```

---

## Current Duplicates (Manual Cleanup Required)

**In AnyType, delete these:**

1. **VPS Daily Health Report — 2026-03-04**
   - ❌ Delete: `ID: bafyreic5ofsrk6qlv5cn3aatpat7gte3wrn2urn65uk3gkuugo6mkdgnmq`
   - ✅ Keep: `ID: bafyreigwwp3rnndjur6qcbpmdm2yau2smmyd6i56o3a6vmyifer7h44egi`

2. **Mistral Migration & Cost Optimization — 2026-03-04**
   - ❌ Delete: `ID: bafyreibtyhswnvpv2v5mybm2edwijw36kijbzkrrnx2d4lilddy34h4fpa`
   - ✅ Keep: `ID: bafyreifulhlu2u5h66bhrcqsiqf53622ipduutokfoiovnmet2ixnrvrim`

---

## Permanent Fix (Long-term)

Update `/root/anytype-workspace-sync-bin` to:

1. **Track Object IDs:** Store mapping of filename → AnyType object ID
2. **Query Before Create:** Check if object with same title already exists
3. **Update vs Create:** Use existing ID if found, create new only if needed
4. **Store Mapping:** Save to `~/.openclaw/workspace/ANYTYPE-OBJECT-MAP.md`

**Modified behavior:**
```go
// Before syncing a file:
if objectID := getObjectID(filename); objectID != "" {
    // Object exists, update it
    updateObject(objectID, content)
} else {
    // New file, create object
    objectID := createObject(content)
    storeObjectID(filename, objectID)
}
```

---

## Prevention Going Forward

### Immediate (Manual)
Keep the mapping file updated: `ANYTYPE-OBJECT-MAP.md`
- Before syncing: Check if file has a known object ID
- If yes: Use that ID (don't create new)
- If no: Create new object and record ID

### Medium-term (Script)
Create a pre-sync check script:
```bash
#!/bin/bash
# Check if file already exists in AnyType before syncing
FILE=$1
OBJECT_ID=$(grep "$FILE" ANYTYPE-OBJECT-MAP.md | cut -d'|' -f3)
if [ ! -z "$OBJECT_ID" ]; then
    # Update existing object (if API supports it)
    echo "Updating existing object: $OBJECT_ID"
else
    # Create new object
    echo "Creating new object for: $FILE"
fi
```

### Long-term (Code)
Patch the Go binary to:
1. Load mapping at startup
2. Query for existing objects before creating
3. Save new object IDs to mapping after creation
4. Only create if no existing object found

---

## Testing the Fix

After implementing the permanent fix, test with:

```bash
# 1. Create initial file
echo "Test content" > /root/anytype-workspace/TEST-DUPLICATE.md
# → Should create object with ID: A

# 2. Modify file
echo "Updated content" > /root/anytype-workspace/TEST-DUPLICATE.md
# → Should UPDATE object ID: A (not create new ID: B)

# 3. Verify in AnyType
# → Should show only ONE object "TEST-DUPLICATE"
```

---

## Workaround (Until Fixed)

Disable auto-resync for files:
```bash
# Temporarily disable the sync service
systemctl stop anytype-workspace-sync.service

# Make your changes
# Edit files without triggering sync

# Re-enable when done
systemctl start anytype-workspace-sync.service
```

Or use a file lock mechanism:
```bash
# Add to vps-daily-report.sh
LOCK_FILE="/tmp/anytype-sync.lock"
if [ ! -f "$LOCK_FILE" ]; then
    # Only sync if not currently syncing
    touch "$LOCK_FILE"
    # ... sync code ...
    rm "$LOCK_FILE"
fi
```

---

## Monitoring

Check for new duplicates regularly:
```bash
journalctl -u anytype-workspace-sync.service | grep "Created/updated object" | \
  awk '{print $NF}' | sort | uniq -d
```

If duplicates appear, it means:
1. File was synced multiple times
2. Service created new objects instead of updating

---

## Summary

| Aspect | Current | Desired |
|--------|---------|---------|
| **Duplicates** | Yes (multiple per file) | No (one per filename) |
| **Sync behavior** | Always create new | Update if exists, else create |
| **ID tracking** | None | Store filename → ID mapping |
| **Prevention** | Manual | Automatic via code |

**Status:** Awaiting code patch to `anytype-workspace-sync`  
**Workaround:** Manual cleanup + mapping file  
**Timeline:** Fix in next Go binary update
