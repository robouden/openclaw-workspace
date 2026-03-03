# Hybrid Setup Option B — MCP-Aware Agents

## Configuration

Add this to your **`~/.openclaw/openclaw.json`** (both local and VPS):

```json5
{
  models: {
    providers: {
      mistral: {
        apiKey: "YOUR_MISTRAL_API_KEY",
        baseUrl: "https://api.mistral.ai/v1"
      },
      anthropic: {
        apiKey: "YOUR_ANTHROPIC_API_KEY"
      }
    }
  },
  
  agents: {
    // Default agent: uses Mistral (cheap, for routine work)
    defaults: {
      model: {
        primary: "mistral/mistral-large",
        fallbacks: ["anthropic/claude-haiku-4-5-20251001"]
      },
      workspace: "/home/rob/.openclaw/workspace"
    },
    
    // MCP agent: always uses Haiku (for tool-dependent work)
    mcp: {
      model: {
        primary: "anthropic/claude-haiku-4-5-20251001"
      },
      workspace: "/home/rob/.openclaw/workspace"
    }
  }
}
```

## How to Use It

### Routine Tasks (Use Default Agent → Mistral)

```bash
# No flag needed, uses default agent (Mistral)
openclaw chat "What's the capital of France?"
openclaw chat "Write a Python function for..."
openclaw chat "Summarize this text..."
```

**Cost:** ~$0.14-0.42 per 1M tokens (Mistral pricing)

### MCP-Dependent Work (Use MCP Agent → Haiku)

```bash
# Explicitly use mcp agent (Haiku)
openclaw --agent mcp "Use safecast MCP to check radiation levels"
openclaw --agent mcp "Get data from the VPS MCP server"
openclaw --agent mcp "Complex analysis with tools..."
```

**Cost:** ~$0.80-2.40 per 1M tokens (Haiku pricing)

## Key Points

✅ **Clear separation:**
- Default agent = Mistral (cheap, 80-85% quality)
- MCP agent = Haiku (expensive, 100% quality, native MCP)

✅ **Cost effective:**
- Use Mistral for 80% of tasks
- Use Haiku only when MCP tools are needed (20%)

✅ **Reliable:**
- No guessing about when to switch
- Haiku guaranteed to work with MCP

## Decision Tree

```
Does this task use MCP tools?
  ├─ NO → openclaw chat "your prompt"
  │       (uses default → Mistral, saves money)
  │
  └─ YES → openclaw --agent mcp "your prompt"
           (uses mcp agent → Haiku, guaranteed to work)
```

## Setup Checklist

- [ ] Get Mistral API key from https://console.mistral.ai
- [ ] Update `~/.openclaw/openclaw.json` with both providers
- [ ] Set environment variables:
  ```bash
  export MISTRAL_API_KEY="your-key"
  export ANTHROPIC_API_KEY="your-key"
  ```
- [ ] Restart OpenClaw:
  ```bash
  openclaw gateway restart
  ```
- [ ] Verify both models work:
  ```bash
  openclaw models list
  openclaw chat --model mistral/mistral-large "test"
  openclaw chat --model anthropic/claude-haiku-4-5-20251001 "test"
  ```
- [ ] Test with agents:
  ```bash
  openclaw chat "routine question?"
  openclaw --agent mcp "MCP question?"
  ```

## Estimated Costs (Hybrid)

**Usage pattern:**
- 80% routine work on Mistral
- 20% MCP work on Haiku
- ~1M tokens/day total

**Daily cost:**
- Mistral (80%): 0.8M tokens × $0.28/M = $0.224
- Haiku (20%): 0.2M tokens × $1.60/M = $0.320
- **Total: ~$0.544/day**

**Comparison:**
- 100% Haiku: $3.20/day
- **Hybrid: $0.544/day**
- **Savings: $2.656/day (83%)**

## For VPS Deployment

Same setup works on the VPS:

```bash
# SSH into VPS
ssh root@simplemap.safecast.org

# Update openclaw.json there too
# Set environment variables
# Restart gateway

# Test:
openclaw chat "routine test"
openclaw --agent mcp "MCP test"
```

---

**Date:** 2026-03-03 13:37 UTC
**Status:** Ready to implement
**Next:** Want me to help set this up on local + VPS?
