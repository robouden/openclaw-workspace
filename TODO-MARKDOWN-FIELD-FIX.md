# TODO: Fix Markdown Field Mapping in AnyType Sync

## Problem
Markdown files sync to AnyType as Notes, but **only the title displays** — the body content is invisible.

## Root Cause
The sync service stores markdown content in the **"description"** field:
```go
// File: code/anytype-workspace-sync/api.go
// Line ~75 in createObject()
details := &types.Struct{
  Fields: map[string]*types.Value{
    "name": { StringValue: title },
    "description": { StringValue: content },  // ← WRONG FIELD?
  }
}
```

## What Works
- ✅ PDF files display full content (binary storage)
- ✅ Image files display visuals
- ✅ Titles appear correctly

## What's Broken
- ❌ Markdown body content doesn't display in AnyType Notes
- Only visible field: title ("name")
- Content field ("description") seems to be ignored or mapped wrong

## Solution Needed
Identify the correct AnyType Note field name for body content. Options:
- `"text"` (common in note objects)
- `"content"` (alternative)
- `"body"` (another possibility)
- Check AnyType proto definitions for Note object fields

## Files to Update
1. `code/anytype-workspace-sync/api.go` — Fix the field name in `createObject()`
2. Rebuild binary: `go build -o /root/anytype-workspace-sync-bin ./`
3. Restart service: `systemctl restart anytype-workspace-sync`
4. Test: Re-sync a .md file and verify content appears

## Test Case
- File: `/root/anytype-workspace/MEMORY-ARCHIVE-README.md`
- Expected: Full markdown content visible in AnyType
- Current: Only title "MEMORY-ARCHIVE-README" shows, body missing

## Context
- Sync service: /root/.openclaw/workspace/code/anytype-workspace-sync/
- Test space ID: bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws3dhn3uaxhh3u37k4.10piockh34xft
- Claw will wait for this fix before auto-syncing more memory files

---
**Created:** 2026-03-02 11:05 UTC
**Status:** Awaiting Claude's fix
**Priority:** Medium (memory archive visibility)
