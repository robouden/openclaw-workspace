# 🦞 OC — OpenClaw Workspace

This is the workspace for **OC**, Rob's personal AI assistant running on [OpenClaw](https://openclaw.ai), hosted on `simplemap.safecast.org`.

## What's in here

| File | Purpose |
|------|---------|
| `SOUL.md` | Who OC is — personality, values, and vibe |
| `IDENTITY.md` | Name, emoji, avatar |
| `USER.md` | About Rob — context that helps OC be more useful |
| `AGENTS.md` | How OC operates — memory, sessions, tools, heartbeats |
| `TOOLS.md` | Local setup notes (cameras, SSH, TTS preferences, etc.) |
| `HEARTBEAT.md` | Periodic check-in tasks (email, calendar, reminders) |
| `memory/` | Daily notes and long-term memory files |

## How it works

OC runs 24/7 on the VPS. You can reach it via:

### 💬 Web chat (SSH tunnel)

The OpenClaw dashboard runs on `http://127.0.0.1:18789` — loopback only, not exposed publicly. To access it, open an SSH tunnel from your local machine:

```bash
ssh -L 18789:localhost:18789 root@simplemap.safecast.org -N
```

Then open your browser at: **[http://localhost:18789](http://localhost:18789)**

Tip: add `-f` to run the tunnel in the background:
```bash
ssh -fNL 18789:localhost:18789 root@simplemap.safecast.org
```

### 📱 Messaging apps
- **Telegram / WhatsApp / Signal** — if configured in `openclaw.json`

Changes OC makes to these files (updating memory, learning preferences, etc.) are automatically committed and pushed here.

## Stack

- **Runtime:** [OpenClaw](https://github.com/openclaw/openclaw)
- **Model:** Anthropic Claude (Sonnet)
- **Host:** `simplemap.safecast.org`
- **Owner:** [Rob Oudendijk](https://yr-design.biz)
