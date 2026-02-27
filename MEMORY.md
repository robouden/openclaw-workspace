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

## Pending / TODO
- [ ] Telegram bot setup (Rob has tablet with Telegram)
- [ ] Gmail API setup (Google Cloud project + OAuth credentials)
- [ ] AnyType API integration
- [ ] Reload Anthropic credits on local machine (currently using Qwen free tier)
