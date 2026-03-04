# Clean Up AnyType Duplicates — Step-by-Step Guide

**Duplicates Found:** 2 objects  
**Time to fix (manual):** ~2 minutes  
**Time to fix (database):** ~5 minutes  
**Risk level (manual):** ✅ Low  
**Risk level (database):** ⚠️ Medium (requires DB access)

---

## Option 1: Manual Cleanup (Recommended) ✅

### Step-by-Step in AnyType UI

#### 1. Delete: VPS Daily Health Report — 2026-03-04 (duplicate)

1. Open your AnyType workspace
2. Find "VPS Daily Health Report — 2026-03-04"
   - You'll see it appears **TWICE**
3. Click the **first one** (older version)
   - Look for the created date or scroll position to find the older entry
4. Click the **menu (⋮)** in the top right
5. Select **Delete**
6. Confirm deletion

**Keep:** `bafyreigwwp3rnndjur6qcbpmdm2yau2smmyd6i56o3a6vmyifer7h44egi`  
**Delete:** `bafyreic5ofsrk6qlv5cn3aatpat7gte3wrn2urn65uk3gkuugo6mkdgnmq`

#### 2. Delete: Mistral Migration & Cost Optimization — 2026-03-04 (duplicate)

1. Find "Mistral Migration & Cost Optimization — 2026-03-04"
   - Again, should appear **TWICE**
2. Click the **first one** (older version)
3. Click menu (⋮)
4. Select **Delete**
5. Confirm

**Keep:** `bafyreifulhlu2u5h66bhrcqsiqf53622ipduutokfoiovnmet2ixnrvrim`  
**Delete:** `bafyreibtyhswnvpv2v5mybm2edwijw36kijbzkrrnx2d4lilddy34h4fpa`

#### 3. Verify

After deletion:
- ✅ "VPS Daily Health Report — 2026-03-04" appears **once**
- ✅ "Mistral Migration & Cost Optimization — 2026-03-04" appears **once**

---

## Option 2: Database Cleanup (Advanced) ⚠️

If you prefer automated cleanup, you can delete directly from AnyType's SQLite database.

### Prerequisites

- Access to `/root/.anytype/` directory
- Basic SQL knowledge
- Backup before making changes

### Steps

1. **Stop AnyType service**
```bash
systemctl stop anytype-cli.service
```

2. **Find the space database**
```bash
SPACE_ID="bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws3dhn3uaxhh3u37k4"
DB_PATH="/root/.config/anytype/data/$(openssl dgst -sha256 -hex $SPACE_ID | cut -d' ' -f2).db"
# Or search for it
find /root/.anytype -name "objects.db" -type f
```

3. **Connect to SQLite**
```bash
sqlite3 /path/to/space/objects.db
```

4. **Delete the duplicate objects**
```sql
-- Delete VPS Daily Report duplicate
DELETE FROM _objects_docs 
WHERE id = X'<object-id-as-hex>';

-- Delete Mistral Migration duplicate  
DELETE FROM _objects_docs 
WHERE id = X'<object-id-as-hex>';

-- Verify deletion
SELECT COUNT(*) FROM _objects_docs;
```

5. **Restart AnyType**
```bash
systemctl start anytype-cli.service
```

### Object IDs for Database

Convert these IDs to hex for SQLite:

**VPS Daily Report duplicate:**
```
ID: bafyreic5ofsrk6qlv5cn3aatpat7gte3wrn2urn65uk3gkuugo6mkdgnmq
Hex: [needs conversion from IPFS CID format]
```

**Mistral Migration duplicate:**
```
ID: bafyreibtyhswnvpv2v5mybm2edwijw36kijbzkrrnx2d4lilddy34h4fpa
Hex: [needs conversion from IPFS CID format]
```

---

## Verification Checklist

After cleanup, verify:

- [ ] Only one "VPS Daily Health Report — 2026-03-04" exists
- [ ] Only one "Mistral Migration & Cost Optimization — 2026-03-04" exists
- [ ] Both documents open and display correctly
- [ ] No errors in AnyType logs

---

## Prevention Going Forward

To prevent future duplicates:

1. **Use ANYTYPE-OBJECT-MAP.md** as reference
2. **Keep object IDs documented** for known files
3. **Report duplicates** to the sync service maintainer
4. **Consider patching** sync service to track object IDs

---

## Troubleshooting

### "I can't find the duplicates"

The duplicates might not be visible if they're in a different collection. Try:
1. Search for "VPS Daily" in the search bar
2. Look in "All Objects" view
3. Check your workspace settings for visibility

### "I accidentally deleted the wrong one"

AnyType supports **Undo** (Ctrl+Z / Cmd+Z) for recent deletions.

### "Database deletion failed"

If SQLite deletion doesn't work:
1. Restore from backup
2. Try manual UI deletion instead
3. Contact AnyType support

---

## Status

**Duplicates identified:** ✅ Yes (2 objects)  
**Root cause:** Sync service creates new objects instead of updating  
**Recommended fix:** Option 1 (Manual) — fast and safe  
**Timeline:** 2 minutes via UI

---

**Next steps after cleanup:**
1. Update ANYTYPE-OBJECT-MAP.md with final object IDs
2. Commit to GitHub
3. Watch for new duplicates (should not occur once fix is deployed)
