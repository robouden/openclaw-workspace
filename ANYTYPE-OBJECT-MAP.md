# AnyType Object ID Mapping

This file maps workspace filenames to their AnyType object IDs to prevent duplicates.

## Daily Reports

| Filename | AnyType Object ID | Title | Last Synced |
|----------|-------------------|-------|-------------|
| VPS-DAILY-REPORT-2026-03-03.md | bafyreigwwp3rnndjur6qcbpmdm2yau2smmyd6i56o3a6vmyifer7h44egi | VPS Daily Health Report — 2026-03-03 | 2026-03-04 15:06:19 |
| VPS-DAILY-REPORT-2026-03-04.md | bafyreigwwp3rnndjur6qcbpmdm2yau2smmyd6i56o3a6vmyifer7h44egi | VPS Daily Health Report — 2026-03-04 | 2026-03-04 22:00:14 |

## Major Documents

| Filename | AnyType Object ID | Title | Last Synced |
|----------|-------------------|-------|-------------|
| MISTRAL-MIGRATION-2026-03-04.md | bafyreifulhlu2u5h66bhrcqsiqf53622ipduutokfoiovnmet2ixnrvrim | Mistral Migration & Cost Optimization — 2026-03-04 | 2026-03-04 22:02:09 |
| SAFECAST-REPOS-CHANGES-2026-03-04.md | bafyreib6pctuf52s77u2p4nobboo7x2syws3vol24zjbtl523kjkslflmi | Safecast GitHub Repos — Daily Changes Report | 2026-03-04 14:20:48 |
| MCP-TEST-RESULTS-ANALYSIS.md | bafyreien2rkedys67pp7gy5y2q4c3ghvuaa4vrt53t4v2fwonhazrvrhzm | MCP AI Bot Testing — Results & Analysis | 2026-03-04 04:25:49 |

## Duplicates to Delete (Manual Cleanup in AnyType)

These are older versions that should be removed:

| Title | Keep ID | Delete ID | Reason |
|-------|---------|-----------|--------|
| VPS Daily Health Report — 2026-03-04 | bafyreigwwp3rnndjur6qcbpmdm2yau2smmyd6i56o3a6vmyifer7h44egi | bafyreic5ofsrk6qlv5cn3aatpat7gte3wrn2urn65uk3gkuugo6mkdgnmq | Duplicate from 22:00:16 sync |
| Mistral Migration & Cost Optimization — 2026-03-04 | bafyreifulhlu2u5h66bhrcqsiqf53622ipduutokfoiovnmet2ixnrvrim | bafyreibtyhswnvpv2v5mybm2edwijw36kijbzkrrnx2d4lilddy34h4fpa | Duplicate from 22:02:07 sync |

## How to Use

When syncing a file, the service should:
1. Check if filename exists in this mapping
2. If yes → Update the existing object (use ID in map)
3. If no → Create new object and add to map

This prevents duplicates by ensuring one filename = one object ID.
