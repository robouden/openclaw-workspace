# Quick MCP Bot Testing — Run Now!

## Run on Your Local Machine

### Option 1: Automated Script (Easiest)

```bash
# Make script executable
chmod +x ~/.openclaw/workspace/scripts/test-mcp-bots.sh

# Run the tests (will test all 3 models against Safecast MCP)
bash ~/.openclaw/workspace/scripts/test-mcp-bots.sh

# Results saved to: ~/.openclaw/mcp-test-results-TIMESTAMP.txt
```

This will:
- ✅ Test Claude Haiku
- ✅ Test Mistral Large
- ✅ Test Mistral Medium
- ✅ Save results automatically
- ✅ Copy to shared workspace

**Time:** ~5-10 minutes

---

### Option 2: Manual Testing (If Script Fails)

Run each test individually:

#### Claude Haiku
```bash
openclaw chat --model anthropic/claude-haiku-4-5-20251001 "Can you connect to the Safecast MCP server and list the available tools?"

openclaw chat --model anthropic/claude-haiku-4-5-20251001 "Using the Safecast MCP server, get radiation data for Tokyo"

openclaw chat --model anthropic/claude-haiku-4-5-20251001 "Try to query radiation data for an invalid location via MCP and explain the error"
```

#### Mistral Large
```bash
openclaw chat --model mistral/mistral-large-latest "Can you connect to the Safecast MCP server and list the available tools?"

openclaw chat --model mistral/mistral-large-latest "Using the Safecast MCP server, get radiation data for Tokyo"

openclaw chat --model mistral/mistral-large-latest "Try to query radiation data for an invalid location via MCP and explain the error"
```

#### Mistral Medium
```bash
openclaw chat --model mistral/mistral-medium "Can you connect to the Safecast MCP server and list the available tools?"

openclaw chat --model mistral/mistral-medium "Using the Safecast MCP server, get radiation data for Tokyo"

openclaw chat --model mistral/mistral-medium "Try to query radiation data for an invalid location via MCP and explain the error"
```

---

## What We're Testing

### Test 1: Connection
**Can the model connect to Safecast MCP and list tools?**
- ✅ Good: Lists real tools available
- ❌ Bad: Hallucinated tools or no connection

### Test 2: Query
**Can the model query real data from MCP?**
- ✅ Good: Returns actual radiation data, proper format
- ❌ Bad: Hallucinated data, wrong format

### Test 3: Error Handling
**How does it handle invalid requests?**
- ✅ Good: Explains the error, suggests alternatives
- ❌ Bad: Crashes, ignores error, or confusing response

---

## After Testing

**Results will be at:**
- Local: `~/.openclaw/mcp-test-results-TIMESTAMP.txt`
- Shared: `/root/anytype-workspace/MCP-TEST-RESULTS.txt`

I'll then:
1. Score results (100-point scale)
2. Create comparison table
3. Sync detailed analysis to AnyType
4. Recommend best model for production

---

## Scoring Criteria

| Metric | Score |
|--------|-------|
| Connects to MCP correctly | 0-25 pts |
| Query accuracy | 0-25 pts |
| Response clarity | 0-25 pts |
| Error handling | 0-25 pts |
| **Total** | **0-100 pts** |

---

## Timeline

- **Now:** Run quick tests (5-10 min)
- **After:** I score and analyze results (30 min)
- **Then:** Detailed analysis with full rubric (1-2 hours)
- **Finally:** Report synced to AnyType

---

**Ready? Run:** `bash ~/.openclaw/workspace/scripts/test-mcp-bots.sh`
