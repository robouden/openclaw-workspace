# Hybrid Setup Summary — Quick Reference

## What You're Setting Up

**Two OpenClaw agents:**
- **Default agent** → Mistral (cheap, 80-85% quality)
- **MCP agent** → Claude Haiku (expensive, 100% quality, native MCP)

**Cost savings: 83%** (~$2.656/day less)

---

## Quick Setup Steps

### 1. Get API Keys
- Mistral: https://console.mistral.ai
- Claude: Already have it

### 2. Update Config
```json5
{
  agents: {
    defaults: { model: { primary: "mistral/mistral-large" } },
    mcp: { model: { primary: "anthropic/claude-haiku-4-5-20251001" } }
  }
}
```

### 3. Set Env Vars
```bash
export MISTRAL_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
```

### 4. Restart & Test
```bash
openclaw gateway restart
openclaw chat "routine task"
openclaw --agent mcp "MCP task"
```

---

## Usage Rules

**Remember this:**
```
Does it use MCP tools?
├─ NO  → openclaw chat "..."           (Mistral, cheap)
└─ YES → openclaw --agent mcp "..."   (Haiku, works)
```

---

## Files Created

1. **SETUP-LOCAL-MACHINE.md** — Step-by-step for your laptop
2. **SETUP-VPS.md** — Step-by-step for VPS
3. **HYBRID-SETUP-OPTION-B.md** — Configuration details
4. **HYBRID-MODEL-SETUP.md** — All options explained

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Cost Savings | 83% (~$2.656/day) |
| Mistral Quality | 80-85% of Haiku |
| Haiku Quality | 100% (baseline) |
| MCP Support | ✅ Haiku only |

---

## Recommended Implementation Order

1. ✅ Local machine first (test with your workload)
2. ✅ VPS second (same config, scale up)
3. ✅ Monitor for 1 week
4. ✅ Optimize agent usage based on actual patterns

---

## Support

If issues occur:
- Check `/SETUP-LOCAL-MACHINE.md` for local troubleshooting
- Check `/SETUP-VPS.md` for VPS troubleshooting
- Verify API keys are set: `echo $MISTRAL_API_KEY`
- Check logs: `openclaw logs --follow`

---

**Ready to go!** Start with local machine setup. 🚀
