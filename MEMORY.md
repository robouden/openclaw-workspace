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

## VPS Mail Server (yr-design.biz) — 80.208.225.44
- **Status (2026-03-23):** ✅ Fully operational — spinfish.tv, magneticarts.com, legalvideoasia.com all delivering
- **Mail stack:** Postfix + Dovecot + Virtualmin
- **SSH:** `ssh root@80.208.225.44`

### Postfix Virtual Mailbox Config (critical lessons learned)
- `virtual_mailbox_base = /` (must be set — empty string causes fatal error)
- `virtual_mailbox_domains = hash:/etc/postfix/virtual_mailbox_domains` — domains that have local mailbox delivery
- `virtual_mailbox_maps = hash:/etc/postfix/virtual_mailbox` — full absolute paths required, e.g. `/home/spinfish/homes/rob/Maildir/`
- `virtual_uid_maps = hash:/etc/postfix/virtual_uid` — must match actual system UIDs
- `virtual_gid_maps = hash:/etc/postfix/virtual_gid` — must match actual system GIDs
- `virtual_alias_maps = hash:/etc/postfix/virtual` — only for generic aliases (postmaster, abuse, etc.); mailbox users must NOT be here

### Domain Config Summary
| Domain | Mailbox Base | Owner UID | Owner GID |
|--------|-------------|-----------|-----------|
| spinfish.tv | /home/spinfish/homes/{user}/Maildir/ | 1079 (spinfish) | 1031 |
| magneticarts.com | /home/magneticarts/homes/{user}/Maildir/ | per-user UIDs | 1030 |
| legalvideoasia.com | /home/legalvideoasia/homes/{user}/Maildir/ | per-user UIDs | 1020 |

### Key rules (don't break these)
1. **Never put mailbox users in virtual_alias_maps** — causes "User unknown in virtual alias table" or delivery loops
2. **Never put bare domain entries (e.g. `spinfish.tv → spinfish.tv`) in virtual** — causes "mail loops back to myself"
3. **virtual_mailbox_base must be `/` when using absolute paths** — empty string crashes Postfix
4. **Maildir ownership must match virtual_uid_maps** — wrong UID = "Permission denied"
5. **Each mailbox user has their own UID** (Virtualmin approach) — don't assume same UID for all users in a domain

### Virtualmin gotchas
- Virtualmin regenerates `/etc/postfix/virtual` on save — can overwrite manual fixes
- Fix: set `chattr +i /etc/postfix/virtual` before Virtualmin edits, remove with `chattr -i` after
- Virtualmin writes self-referencing entries like `rob@spinfish.tv → rob@spinfish.tv` — these must be removed
- `virtual_mailbox_domains` hash file needs format: `domain.com OK` (not just domain name)

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

## VPS Auth & API Keys
- **Anthropic (local):** `sk-ant-...` (main account)
- **Anthropic (VPS):** `sk-ant-api03-qYNAf7xWQ...` (dedicated key, profile `anthropic:vps`)
- **Qwen (VPS):** `REDACTED-ROTATE-IN-DASHSCOPE-CONSOLE` (direct DashScope API)
- **safecast-web-chat** also on VPS (port 3334) — shares same Anthropic account, separate key
- Both Anthropic keys share account-level rate limits — that's why VPS moved off Anthropic

## AnyType Bot Account (Fresh Setup - 2026-02-28)

**New bot account created on VPS:**
- Name: `openclaw-bot-selfhosted`
- Account ID: `A6JZwRq6eouJi4F5pumdZug7rG2jNLkGDBpKEwkDPUV96ZtS`
- Account Key: `N4Hw/9GQmio2f4sBU7PXZbl5akrL+2kmhP7SZ9RJp956u5/08V9LgdW975DSYXSk8b3+kZbIP0sZpuEOxFwp6g==`
- API Key: `DzVdxvMC41698O2sTET4e7KrusuU/zXW4V/7wCRuJlk=`
- Space ID: `bafyreibwatfpuq23i74kdfzev5woe64aduy6u4fuijljmzycoawuanjmmq.35fpfsusofs1o`
- Tech Space ID (auto): `bafyreif42oladpa4vafbnyldvmqwg7n6ag5jh5jhwt6332gqbd6xvy2xem.35fpfsusofs1o`

**Status:** ✅ Account created, API key generated, space active
**API Access:** 
- HTTP API available on port 31012 (localhost)
- gRPC on port 31010, gRPC-Web on 31011
- Use API key in Authorization header: `Bearer DzVdxvMC41698O2sTET4e7KrusuU/zXW4V/7wCRuJlk=`
- API docs: https://developers.anytype.io/

**Self-Hosted Setup:** ✅ READY
- Any device/user can connect with Account Key to sync workspace
- OpenClaw on VPS has full HTTP API access for reading/writing pages and data

## AnyType Sync Tooling (Built 2026-02-28)

**Skill package:** `anytype-sync.skill` — in `skills/anytype-sync/`
- Pure Node.js MongoDB client (no Go binary needed) — `slack/handler.js`
- Slack commands: `@openclaw anytype spaces|summary|count|activity|help`
- Deployed on VPS at `/root/.openclaw/workspace/skills/anytype-sync/`

**AnyType data architecture on VPS:**
- MongoDB (localhost:27017): coordinator/consensus data (23 spaces)
- SQLite (per-space): `/root/.config/anytype/data/{ACCOUNT_ID}/objectstore/{SPACE_ID}/objects.db`
- HTTP API on port 31012 (limited — many endpoints return 404 in CLI v0.1.9)
- gRPC on port 31010 — the reliable integration path

**Known limitation:** HTTP REST API incomplete; direct MongoDB queries are the working approach.

## Pending / TODO
- [ ] gRPC integration for AnyType (code in `code/anytype-workspace-sync/`) — debugging handshake issues
- [ ] Integrate Slack handler with OpenClaw event processing
- [ ] Gmail API setup (future, separate project)
