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

## Pending / TODO
- [ ] Telegram bot setup (Rob has tablet with Telegram)
- [ ] Gmail API setup (Google Cloud project + OAuth credentials)
- [ ] AnyType API integration
