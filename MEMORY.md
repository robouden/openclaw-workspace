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
- IP: 65.108.24.131, Ubuntu 24.04, Hetzner
- Production Safecast server — don't touch existing services
- OpenClaw installed, gateway running as system service
- SSH tunnel to access: `ssh -L 18790:localhost:18789 root@65.108.24.131 -N`
- AnyType already running there

## Pending / TODO
- [ ] Telegram bot setup (Rob has tablet with Telegram)
- [ ] Gmail API setup (Google Cloud project + OAuth credentials)
- [ ] AnyType API integration
