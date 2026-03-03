# Hybrid Model Setup — Mistral API + Claude Haiku

## Overview

Run **both models in OpenClaw** and switch based on task:
- **Mistral API** — Routine tasks, general chat (saves money 💰)
- **Claude Haiku** — Complex reasoning, MCP-heavy work (best quality ⭐)

## Setup Options

### Option 1: Primary + Fallback (Automatic)

**OpenClaw automatically tries Mistral first, falls back to Haiku if needed:**

```json5
{
  models: {
    providers: {
      mistral: {
        apiKey: "YOUR_MISTRAL_API_KEY",
        baseUrl: "https://api.mistral.ai/v1"
      },
      anthropic: {
        apiKey: "YOUR_CLAUDE_API_KEY"
      }
    }
  },
  agents: {
    defaults: {
      model: {
        primary: "mistral/mistral-large",
        fallbacks: [
          "anthropic/claude-haiku-4-5-20251001"
        ]
      }
    }
  }
}
```

**How it works:**
- Uses Mistral by default (cheaper)
- If Mistral fails/times out → tries Claude Haiku
- Saves money while maintaining reliability

### Option 2: Per-Task Switching (Manual)

**Use different models for different tasks:**

```bash
# Routine task (use Mistral - cheaper)
openclaw chat --model mistral/mistral-large "Write a summary of..."

# Complex task (use Haiku - better quality)
openclaw chat --model anthropic/claude-haiku-4-5-20251001 "Analyze this complex problem..."

# MCP-heavy task (use Haiku - native MCP)
openclaw chat --model anthropic/claude-haiku-4-5-20251001 "Use the safecast tools to..."
```

### Option 3: Conditional Switching (Smart)

**OpenClaw can route based on task characteristics:**

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "mistral/mistral-large",
        fallbacks: ["anthropic/claude-haiku-4-5-20251001"]
      }
    },
    // Custom agent for MCP-heavy work
    mcp_agent: {
      model: {
        primary: "anthropic/claude-haiku-4-5-20251001"
      }
    }
  }
}
```

**Usage:**
```bash
# Routine chat (default agent → Mistral)
openclaw chat "What's the weather?"

# MCP work (mcp_agent → Haiku)
openclaw --agent mcp_agent "Use safecast tools..."
```

## Configuration Details

### Mistral API Setup

1. **Get API key:** https://console.mistral.ai
2. **Available models:**
   - `mistral-tiny` (smallest, fastest)
   - `mistral-small` (balanced)
   - `mistral-large` (best quality)

3. **Add to OpenClaw:**
```bash
export MISTRAL_API_KEY="your-key-here"
openclaw config set models.providers.mistral.apiKey "$MISTRAL_API_KEY"
```

### Claude Haiku Setup

Already configured (you're using it now):
```bash
# Verify it's set
openclaw models list | grep haiku
```

## Cost Tracking (Hybrid)

**Estimated monthly costs (1M tokens/day):**

| Scenario | Model Mix | Cost |
|----------|-----------|------|
| All Haiku | 100% Haiku | ~$96/month |
| All Mistral | 100% Mistral | ~$17/month |
| **Hybrid** | 70% Mistral + 30% Haiku | ~$38/month |
| **Smart Hybrid** | 80% Mistral + 20% Haiku | ~$25/month |

**Savings:** ~60-74% vs all Haiku

## Testing the Hybrid Setup

### Step 1: Configure both providers

```bash
# Mistral
export MISTRAL_API_KEY="your-mistral-key"

# Claude (already set)
export ANTHROPIC_API_KEY="your-claude-key"

# Restart OpenClaw gateway
openclaw gateway restart
```

### Step 2: List available models

```bash
openclaw models list
# Should show both mistral/* and anthropic/* models
```

### Step 3: Test each model

```bash
# Test Mistral (cheaper)
openclaw chat --model mistral/mistral-large "Hello, what can you do?"

# Test Haiku (better quality)
openclaw chat --model anthropic/claude-haiku-4-5-20251001 "Hello, what can you do?"

# Test fallback (tries Mistral, falls back to Haiku)
openclaw chat "Hello, what can you do?"
```

### Step 4: Test with MCP tools

```bash
# Use Haiku for MCP work (native support)
openclaw chat --model anthropic/claude-haiku-4-5-20251001 "Use the safecast MCP to check radiation levels"

# Try Mistral with MCP (might need wrapper)
openclaw chat --model mistral/mistral-large "Use the safecast tools to check radiation levels"
```

## Monitoring & Optimization

**Track which model is being used:**

```bash
# Check OpenClaw logs
openclaw logs --follow | grep -E "model|mistral|haiku"

# Cost tracking
# Mistral: $0.56/day (estimate)
# Haiku: $3.20/day (estimate)
# Hybrid (70/30): ~$1.27/day
```

## Troubleshooting

**If Mistral fails and Haiku doesn't take over:**
- Check API keys are set correctly
- Verify network access to mistral API
- Check OpenClaw logs for errors

**If MCP tools don't work with Mistral:**
- Use `--model anthropic/claude-haiku...` explicitly for MCP tasks
- Or keep Mistral as primary, Haiku as fallback

## Recommendation for Your VPS

**For the VPS (simplemap.safecast.org):**

1. **Set Mistral as primary** (cheaper, good enough for most tasks)
2. **Keep Haiku as fallback** (safety net + MCP support)
3. **For MCP-heavy work**, explicitly use Haiku:

```bash
openclaw chat --model anthropic/claude-haiku-4-5-20251001 "Use safecast MCP..."
```

**Expected cost:**
- Current (100% Haiku): ~$3.20/day
- Hybrid (70% Mistral): ~$1.27/day
- **Savings: ~$1.93/day (~60%)**

---

**Date:** 2026-03-03 13:05 UTC
**Status:** Ready to implement
**Next:** Which option appeals most? (1, 2, or 3?)
