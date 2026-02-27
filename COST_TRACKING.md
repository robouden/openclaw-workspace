# Cost Tracking Setup

## Overview
Two independent services consuming Anthropic API (Claude Haiku). Both are tracked separately and reconciled daily.

## Services

### 1. Main OpenClaw Session (VPS Gateway)
**Location:** `/root/.openclaw/`  
**Port:** 18789 (loopback)  
**Model:** claude-haiku-4-5-20251001  
**API Key:** Configured in `/root/.openclaw/openclaw.json` (anthropic:default profile)

**Token Usage:**
```bash
openclaw status
```
Look for line like: `Tokens: 33k/200k (16%) · 🗄️ 99% cached`

**Cost Calculation:**
- Input: tokens_in × $0.80 / 1M
- Output: tokens_out × $4.00 / 1M
- Cached reads don't count (free)
- Cached writes: $0.10 / 1M

### 2. Web-Chat (Safecast Web UI)
**Location:** `/root/safecast-web-chat-server/`  
**Port:** 3334  
**Model:** claude-haiku-4-5-20251001  
**API Key:** `/root/safecast-web-chat-server/.env` (ANTHROPIC_API_KEY)  
**Service:** safecast-web-chat.service

**Token Usage:**
Check web-chat logs:
```bash
journalctl -u safecast-web-chat.service -n 100 --no-pager
# or
tail -50 /var/log/syslog | grep safecast-web-chat
```

Manually count API calls and estimate tokens per call:
- Simple queries: ~500–1000 input + 1000–2000 output tokens
- Complex queries with MCP tools: ~2000–5000 input + 2000–5000 output tokens

**Cost Calculation:**
Same rates as main session: $0.80/M input, $4/M output

## Daily Cost Tracking

**When:** Every morning (Rob's morning, Japan time)  
**Where:** Update `MEMORY.md` under "Cost Tracking (Haiku)"  
**What to track:**
1. Main session tokens from `openclaw status`
2. Web-chat request count (estimate from logs)
3. Combined daily cost

**Format Example:**
```
## Daily Cost Log

**2026-02-27:**
- Main session: 45k input / 12k output = $0.036 + $0.048 = $0.084
- Web-chat: ~8 requests × 3k avg = $0.012 + $0.030 = $0.042
- **Daily total: $0.126**
- **Running total (month): $0.126**
```

## Automated Tracking (Optional)

To automate daily cost reports to Slack:
1. Create a cron job that runs at start of day (Rob's timezone)
2. Script queries both services for token counts
3. Calculates costs
4. Sends summary to Slack DM (D0AHMTHF201)

No automation set up yet — can add if useful.

## Rate Reference

**Claude Haiku 4.5 (2025-10-01):**
- Input: $0.80 per 1M tokens
- Output: $4.00 per 1M tokens
- Cache read: Free (included in input)
- Cache write: $0.10 per 1M tokens

**Typical daily usage:**
- Main session: 50k tokens/day = $0.04–0.20/day (varies by cache hit ratio)
- Web-chat: 10–20 requests/day = $0.01–0.10/day (varies by traffic)

---
Last updated: 2026-02-27 13:16 UTC
