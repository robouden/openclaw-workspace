# HEARTBEAT.md

## Tasks

### Sync & push session transcripts to GitHub
- Copy any new/updated `.jsonl` files from `/root/.openclaw/agents/main/sessions/` to `sessions/` in workspace
- Run: `cp /root/.openclaw/agents/main/sessions/*.jsonl /root/.openclaw/workspace/sessions/ 2>/dev/null`
- Then: `cd /root/.openclaw/workspace && git add -A && git diff --cached --quiet || git commit -m "Auto-sync: sessions + memory $(date -u +%Y-%m-%d)" && git push`
- Do this on every heartbeat (lightweight, only commits if there are changes)
