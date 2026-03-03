# Setup Hybrid Models — VPS (simplemap.safecast.org)

## Step 1: SSH into VPS

```bash
ssh root@65.108.24.131
# or
ssh root@simplemap.safecast.org
```

---

## Step 2: Check Current Config

```bash
cat ~/.openclaw/openclaw.json | head -50
```

Note: The VPS gateway might have minimal config. That's OK.

---

## Step 3: Update OpenClaw Config on VPS

### Backup current config
```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup
```

### Edit the config
```bash
nano ~/.openclaw/openclaw.json
```

Or use your preferred editor. Add/update these sections:

```json5
{
  "meta": {
    "lastTouchedVersion": "2026.2.26"
  },
  
  "models": {
    "providers": {
      "mistral": {
        "apiKey": "YOUR_MISTRAL_API_KEY",
        "baseUrl": "https://api.mistral.ai/v1"
      },
      "anthropic": {
        "apiKey": "YOUR_ANTHROPIC_API_KEY"
      }
    }
  },
  
  "agents": {
    "defaults": {
      "model": {
        "primary": "mistral/mistral-large",
        "fallbacks": ["anthropic/claude-haiku-4-5-20251001"]
      },
      "workspace": "/root/.openclaw/workspace"
    },
    "mcp": {
      "model": {
        "primary": "anthropic/claude-haiku-4-5-20251001"
      },
      "workspace": "/root/.openclaw/workspace"
    }
  },
  
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "your-token-here"
    }
  }
}
```

### Save and verify
```bash
# Check syntax
cat ~/.openclaw/openclaw.json | jq . > /dev/null && echo "✅ Valid JSON"
```

---

## Step 4: Set Environment Variables on VPS

```bash
# Set Mistral key
export MISTRAL_API_KEY="your-mistral-key-here"

# Set Claude key (should already be set)
export ANTHROPIC_API_KEY="your-claude-key-here"

# Make permanent
echo 'export MISTRAL_API_KEY="your-mistral-key-here"' >> /root/.bashrc
echo 'export ANTHROPIC_API_KEY="your-claude-key-here"' >> /root/.bashrc
source /root/.bashrc
```

---

## Step 5: Restart OpenClaw Gateway on VPS

```bash
systemctl restart openclaw-gateway.service

# Wait for it to start
sleep 5

# Check status
systemctl status openclaw-gateway.service --no-pager
```

You should see:
```
Active: active (running)
```

---

## Step 6: Verify Models on VPS

```bash
# Check if accessible via SSH tunnel
# From your local machine:
ssh -L 18790:localhost:18789 root@65.108.24.131 -N &
sleep 2

# Test local tunnel
curl http://localhost:18790/api/models 2>/dev/null | jq .

# Should show both mistral and anthropic models
```

Or directly on VPS:
```bash
openclaw models list
```

---

## Step 7: Test Models on VPS

### Via SSH tunnel (from local machine)
```bash
# Keep SSH tunnel open in one terminal
ssh -L 18790:localhost:18789 root@65.108.24.131 -N

# In another terminal:
export OPENCLAW_GATEWAY=http://localhost:18790
openclaw chat "test routine task"
openclaw --agent mcp "test MCP task"
```

### Directly on VPS
```bash
# SSH into VPS
ssh root@65.108.24.131

# Test models
openclaw chat --model mistral/mistral-large "test"
openclaw chat --model anthropic/claude-haiku-4-5-20251001 "test"
```

---

## Step 8: Test with AnyType Sync Service

The AnyType sync service should still work:

```bash
# Check if service is running
systemctl status anytype-workspace-sync.service --no-pager

# Service should use Claude Haiku (or keep current config)
```

**Note:** The sync service config is separate. You can update it to use Mistral too if desired.

---

## Cost & Usage on VPS

**VPS traffic pattern:**
- Tablet + local machine → VPS OpenClaw gateway
- Routes to Mistral (cheap) or Haiku (quality)

**Expected daily cost:**
- 80% routine tasks on Mistral: saves money
- 20% MCP tasks on Haiku: guaranteed to work
- **Total: ~$0.544/day** (vs $3.20/day with 100% Haiku)

---

## Monitoring VPS Usage

```bash
# Check logs
journalctl -u openclaw-gateway.service -f | grep -E "model|mistral|haiku"

# Check which model is being used
tail -100 /var/log/openclaw.log | grep -i "model\|mistral"

# Track API calls
# Mistral costs: $0.14/1M input, $0.42/1M output
# Haiku costs: $0.80/1M input, $2.40/1M output
```

---

## Troubleshooting on VPS

### Service won't restart
```bash
# Check for errors
journalctl -u openclaw-gateway.service -n 50 --no-pager

# Try manual restart
systemctl restart openclaw-gateway.service
sleep 5
systemctl status openclaw-gateway.service
```

### Models not available
```bash
# Restart and check
systemctl restart openclaw-gateway.service
openclaw models list

# Check environment variables
env | grep -E "MISTRAL|ANTHROPIC"
```

### API key errors
```bash
# Verify keys are set
echo $MISTRAL_API_KEY
echo $ANTHROPIC_API_KEY

# If empty, set them again in /root/.bashrc
nano /root/.bashrc
# Add: export MISTRAL_API_KEY="..."
# Add: export ANTHROPIC_API_KEY="..."

source /root/.bashrc
systemctl restart openclaw-gateway.service
```

---

## Verification Checklist

- [ ] SSH into VPS works
- [ ] Config file updated with both providers
- [ ] Environment variables set
- [ ] OpenClaw gateway restarted
- [ ] Both models show up: `openclaw models list`
- [ ] Test Mistral: `openclaw chat "test"`
- [ ] Test Haiku: `openclaw chat --model anthropic/... "test"`
- [ ] Test MCP agent: `openclaw --agent mcp "test"`
- [ ] AnyType sync service still running

---

## Next: Monitor & Optimize

After setup:

1. **Use for 1 week** — See actual costs
2. **Check logs** — Confirm model usage patterns
3. **Optimize agent usage** — Make sure MCP tasks use correct agent
4. **Track savings** — Compare vs 100% Haiku

---

**Date:** 2026-03-03 13:43 UTC
**Status:** Ready to implement
**Estimated time:** 15 minutes for VPS setup
