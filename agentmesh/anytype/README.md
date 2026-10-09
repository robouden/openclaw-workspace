# AgentMesh → Anytype sync

One-way sync of AgentMesh Postgres data into six read-only overview pages in an Anytype space, so the data can be viewed in Anytype on other devices (tablet) via Anytype's own sync.

| Anytype page | Source | Layout |
|---|---|---|
| AgentMesh – People | `people` | table |
| AgentMesh – Outreach | `outreach` | table |
| AgentMesh – Tasks | `tasks` | table |
| AgentMesh – Village Models | `village_models` | table |
| AgentMesh – CHP Equipment | `chp_equipment` | table |
| AgentMesh – Chats | `threads` + `messages` | latest 20 messages per thread, 300 chars each |

`messages` (~18k rows) is not synced in full. Cells are truncated to 200 chars.

## How it works
- Talks to the Anytype desktop local API (`http://127.0.0.1:31009/v1`, header `Anytype-Version: 2025-11-08`). Anytype desktop must be running.
- Reads Postgres with `psql` (port 5433).
- Upserts one page per table; the page → Anytype object ID mapping and a content hash are kept in `~/.local/share/agentmesh/anytype_map.json`. Unchanged pages are skipped.
- Retries on HTTP 429 with backoff and sleeps 0.5 s between calls.
- Edits made in Anytype are overwritten on the next run (AgentMesh is the source of truth).

## Setup
Files live in `~/.local/share/agentmesh/` (not in the repo, never commit them):

- `agentmesh.env` — existing AgentMesh DSN/password file (`AGENTMESH_PASSWORD`).
- `anytype.env` — `chmod 600`:
  ```
  ANYTYPE_API_KEY=<Anytype → Settings → API Keys → Create>
  ANYTYPE_SPACE_ID=<target space id>
  ```
  List space IDs: `curl -H "Authorization: Bearer $ANYTYPE_API_KEY" -H 'Anytype-Version: 2025-11-08' http://127.0.0.1:31009/v1/spaces`

Install:
```bash
cp sync_anytype.py ~/.local/share/agentmesh/
cp agentmesh-anytype-sync.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now agentmesh-anytype-sync.timer
```
The timer runs 2 min after boot and every 30 min after that. Logs: `journalctl --user -u agentmesh-anytype-sync.service`. Stop: `systemctl --user disable --now agentmesh-anytype-sync.timer`.

Manual run: `python3 ~/.local/share/agentmesh/sync_anytype.py`

## Why overview pages, not one object per row
Tried both (2026-10-09):
- One Anytype page per row: ~170 pages cluttering the Pages list. Rejected.
- Custom types + properties per table (for Anytype Sets with sort/filter): worked through the API (types/properties/objects can be created), but did not give a usable result in the UI and was rolled back. Sets cannot be created via the API, so they would need manual creation per type.

Anytype markdown tables are static: no sorting or filtering. Use the AgentMesh web UI for that.

## Rollback
Delete the six "AgentMesh – …" pages in Anytype (or `DELETE /v1/spaces/{space}/objects/{id}` for each ID in `anytype_map.json`), disable the timer, and remove `anytype_map.json`.
