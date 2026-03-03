# Setup Hybrid Models — Local Machine (Your Laptop)

## Step 1: Get API Keys

### Mistral API Key
1. Go to https://console.mistral.ai
2. Sign up or log in
3. Create API key
4. Copy the key (you'll need it)

### Claude API Key
1. You should already have this (using Haiku now)
2. Verify: `echo $ANTHROPIC_API_KEY`
3. If empty, go to https://console.anthropic.com

---

## Step 2: Update OpenClaw Config

### Find your config file
```bash
cat ~/.openclaw/openclaw.json
```

### Backup current config
```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup
```

### Update with new agents

Edit `~/.openclaw/openclaw.json` and replace the `agents` section:

**If you already have a config:**
```json5
{
  // ... existing config ...
  
  "agents": {
    "defaults": {
      "model": {
        "primary": "mistral/mistral-large",
        "fallbacks": ["anthropic/claude-haiku-4-5-20251001"]
      },
      "workspace": "/home/rob/.openclaw/workspace",
      "compaction": { "mode": "safeguard" },
      "maxConcurrent": 4,
      "subagents": { "maxConcurrent": 8 }
    },
    "mcp": {
      "model": {
        "primary": "anthropic/claude-haiku-4-5-20251001"
      },
      "workspace": "/home/rob/.openclaw/workspace",
      "compaction": { "mode": "safeguard" },
      "maxConcurrent": 4,
      "subagents": { "maxConcurrent": 8 }
    }
  },
  
  // ... rest of config ...
}
```

**If starting fresh:**
```bash
cat > ~/.openclaw/openclaw.json << 'EOF'
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
      "workspace": "/home/rob/.openclaw/workspace"
    },
    "mcp": {
      "model": {
        "primary": "anthropic/claude-haiku-4-5-20251001"
      },
      "workspace": "/home/rob/.openclaw/workspace"
    }
  }
}
EOF
```

---

## Step 3: Set Environment Variables

```bash
# Set Mistral API key
export MISTRAL_API_KEY="your-mistral-key-here"

# Claude should already be set, but verify
export ANTHROPIC_API_KEY="your-claude-key-here"

# Make permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export MISTRAL_API_KEY="your-mistral-key-here"' >> ~/.bashrc
echo 'export ANTHROPIC_API_KEY="your-claude-key-here"' >> ~/.bashrc
source ~/.bashrc
```

---

## Step 4: Restart OpenClaw Gateway

```bash
openclaw gateway restart
```

Wait for it to start:
```bash
openclaw gateway status
```

You should see:
```
Gateway: ✅ running
```

---

## Step 5: Verify Models Are Available

```bash
openclaw models list
```

You should see:
```
✅ mistral/mistral-large
✅ mistral/mistral-small
✅ anthropic/claude-haiku-4-5-20251001
```

---

## Step 6: Test Both Models

### Test Mistral (routine chat)
```bash
openclaw chat "What is 2+2? Answer briefly."
```

Should respond quickly and cheaply ✅

### Test Haiku (high-quality response)
```bash
openclaw chat --model anthropic/claude-haiku-4-5-20251001 "Explain quantum computing in 2 sentences"
```

Should give detailed, high-quality response ✅

### Test MCP Agent
```bash
openclaw --agent mcp "Hello from the MCP agent"
```

Should use Haiku automatically ✅

---

## Step 7: Test with MCP Tools

When you have MCP configured:

```bash
# Routine work (uses Mistral - default agent)
openclaw chat "write a python function"

# MCP work (uses Haiku - mcp agent)
openclaw --agent mcp "Use the safecast MCP to check radiation levels"
```

---

## Troubleshooting

### Models not showing up
```bash
# Force reload
openclaw gateway restart
openclaw models list
```

### API key errors
```bash
# Check environment variables
echo $MISTRAL_API_KEY
echo $ANTHROPIC_API_KEY

# If empty, set them again
export MISTRAL_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
```

### Model fails to respond
```bash
# Check logs
openclaw logs --follow | grep -E "mistral|error"

# Try other model
openclaw chat --model anthropic/claude-haiku-4-5-20251001 "test"
```

---

## Expected Behavior

| Command | Model Used | Cost | Speed |
|---------|-----------|------|-------|
| `openclaw chat "..."` | Mistral | 💰 Low | ⚡ Fast |
| `openclaw --agent mcp "..."` | Haiku | 💸 Higher | ⚡ Fast |
| `openclaw chat --model anthropic/...` | Haiku | 💸 Higher | ⚡ Fast |

---

## Cost Tracking

**Monitor your usage:**
```bash
# Check which model is being used
openclaw logs --follow | grep "model"

# Estimate costs
# Mistral: ~$0.28 per 1M tokens
# Haiku: ~$1.60 per 1M tokens
```

---

**Date:** 2026-03-03 13:43 UTC
**Status:** Ready to implement
**Next:** Follow these steps, then do the same for VPS
