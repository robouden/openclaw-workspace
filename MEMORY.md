# MEMORY.md - Long-Term Memory

## Identity
- **Name:** Claw 🐧
- **Role:** Linux expert assistant
- **Setup date:** 2026-02-24

## Rob Oudendijk
- CEO at YR-DESIGN (yr-design.biz) — software engineer, designer, consultant
- Based in Mitsue, Japan (GMT+9)
- Dutch background, long-time Japan resident
- SAFECAST.org supporter (open radiation monitoring)
- GitHub: https://github.com/robouden
- Technically deep: Linux, AI, web, embedded, full-stack
- **Slack workspace:** T025D5MGJ (Safecast/company workspace)
- **Slack user ID:** U025D964S (primary contact for OpenClaw bot)

## GitHub Setup
- Single repo: https://github.com/robouden/openclaw-workspace
- Everything lives here: config, memory, daily logs
- Commit after every session

## VPS (simplemap.safecast.org)
- IP: 65.108.24.131, Ubuntu 24.04, Hetzner — production Safecast server, be careful
- OpenClaw installed, gateway running as system service (port 18789, loopback)
- SSH tunnel: `ssh -L 18790:localhost:18789 root@65.108.24.131 -N` → http://localhost:18790
- AnyType, Docker, MongoDB, PostgreSQL, Redis, Nginx already running
- **Tailscale**: userspace mode (LXC container), IP `100.76.253.38`, hostname `simplemap.taila8498c.ts.net`
- Tailscale Serve: OpenClaw at `https://simplemap.taila8498c.ts.net` (tailnet only)
- Rob's tablet `p08-t` on tailnet at `100.70.8.86` — can reach OpenClaw directly!

## Tablet Webchat (p08-t)
- Accessible at `https://simplemap.taila8498c.ts.net` via Tailscale
- Config changes made to `~/.openclaw/openclaw.json`:
  - `gateway.auth.allowTailscale: true`
  - `gateway.controlUi.allowedOrigins: ["https://simplemap.taila8498c.ts.net"]`
- Device pairing: one-time approval via `openclaw devices approve <requestId>`
- Already approved — tablet paired ✅

## Local OpenClaw (Rob's laptop/desktop)
- Path: `/home/rob/.openclaw/`
- **Status (2026-02-27):** ✅ Anthropic API key restored, gateway running clean on Claude Haiku

## VPS OpenClaw (simplemap.safecast.org)
- Primary model: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Status (2026-02-28 08:25 JST):** ✅ ONLINE & SECURED
  - Gateway: ws://127.0.0.1:18789 (loopback) — 16ms response
  - Tailscale Serve: https://simplemap.taila8498c.ts.net ✅
  - Slack: Connected ✅
  - 3 active sessions (last main activity: 2m ago)
- **Security fixes applied (2026-02-28):**
  - ✅ Config file `/root/.openclaw/openclaw.json` → `chmod 600` (owner-only)
  - ✅ Slack DM access restricted to `U025D964S` (Rob only)
  - ✅ Slack channel access remains open (`allowFrom: "*"`) — as intended
  - ✅ CRITICAL issues: 0 (was 1)

## API Key Strategy
**Problem:** VPS bot shares Claude Haiku key with local OpenClaw + assistant.safecast.org → rate limit contention
**Solution:** Separate Anthropic API key for VPS bot (2026-02-28)

### Implementation ✅
- **New key:** Created separate Anthropic API key for VPS bot
- **Location:** `/root/.openclaw/auth-profiles.json` under profile `anthropic:vps`
- **Status:** Ready to use (config valid, gateway responsive)

### Auth Profiles on VPS
- `anthropic:default` → Original shared key (sk-ant-oat01-...)
- `anthropic:vps` → NEW dedicated key (sk-ant-api03-qYNAf7xWQ...) 
- `qwen-portal:default` → Qwen free tier

**Note:** Currently, OpenClaw will use `anthropic:default` unless configured otherwise. To use `anthropic:vps` by default on the VPS bot:
- Option A: Set `OPENCLAW_AUTH_PROFILE=anthropic:vps` env var
- Option B: Rename or remove `anthropic:default` if VPS should be isolated
- Option C: Create a separate agent/runtime config that specifies the profile

## Rate Limiting Investigation (2026-02-28)

### Two Services on VPS Using Anthropic API
1. **OpenClaw VPS Bot** (port 18789)
   - Key: sk-ant-api03-qYNAf7xWQ-... (newly configured `anthropic:vps`)
   - Rate limit errors: ✅ Found (Feb 27, 23:11-23:43 in journals)

2. **safecast-web-chat** (port 3334)
   - Key: sk-ant-api03-YL2ST48_... (from `/root/safecast-web-chat-server/.env`)
   - Rate limit errors: None visible (running normally)
   - Status: Active, forwarded through safecast-chat-proxy (3335)

### Root Cause
- Both services use DIFFERENT API keys
- Both belong to SAME Anthropic account → account-level rate limits
- Keys are separate but quota is shared

### Plan: Switch to Qwen to Reduce Anthropic Load
- Configure OpenClaw to use Qwen as fallback or primary
- `qwen-portal/coder-model` already available (free tier)

## Pending / TODO
- [ ] **IN PROGRESS:** Configure request queuing/rate limiting on VPS
- [ ] Telegram bot setup (Rob has tablet with Telegram)
- [ ] Gmail API setup (Google Cloud project + OAuth credentials)
- [ ] AnyType API integration
