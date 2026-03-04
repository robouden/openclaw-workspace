# MCP Server Testing Plan — AI Bot Comparison

## Objective

Test how well different AI models can:
1. **Connect to MCP servers** (VPS MCP server)
2. **Query tools/resources** available via MCP
3. **Parse responses** and follow up appropriately
4. **Handle errors** gracefully

---

## Models to Test

| Model | Type | MCP Support | Cost | Quality Baseline |
|-------|------|-------------|------|------------------|
| **Claude Haiku** | API | ✅ Native | $3.20/1M | 100% (baseline) |
| **Mistral Large** | API | ⚠️ Function calling | $1.08/1M | ~90% |
| **Mistral Medium** | API | ⚠️ Function calling | $0.27/1M | ~80% |

---

## Test Scenarios

### Test 1: Basic MCP Connection
**Prompt:** "Connect to the Safecast MCP server and list available tools"

**Success Criteria:**
- ✅ Identifies MCP server endpoint
- ✅ Authenticates successfully
- ✅ Lists available tools
- ✅ Returns tool definitions

**Expected Output:**
```
Available Tools:
- get_radiation_data
- check_location
- query_history
[... etc]
```

---

### Test 2: MCP Query with Context
**Prompt:** "Query the Safecast MCP server for radiation data in Tokyo for the last 7 days"

**Success Criteria:**
- ✅ Calls correct tool with right parameters
- ✅ Handles time filtering
- ✅ Parses JSON response
- ✅ Summarizes data in human-readable format

**Evaluation:**
- Response accuracy
- Parameter handling
- Data interpretation quality

---

### Test 3: Error Handling
**Prompt:** "Query an invalid location via MCP server and handle the error gracefully"

**Success Criteria:**
- ✅ Detects error from MCP
- ✅ Explains error to user
- ✅ Suggests alternatives
- ✅ Doesn't crash/hang

---

### Test 4: Multi-Tool Workflow
**Prompt:** "Use MCP to check radiation in 3 locations and compare results"

**Success Criteria:**
- ✅ Makes multiple tool calls
- ✅ Coordinates results
- ✅ Performs comparison
- ✅ Provides summary/analysis

---

### Test 5: Context Persistence
**Prompt:** "Query location A, then location B, then compare how radiation changed"

**Success Criteria:**
- ✅ Maintains conversation context
- ✅ Remembers previous queries
- ✅ Makes logical comparisons
- ✅ Draws conclusions

---

## Scoring Rubric

### Connection Quality (0-25 points)
- **25:** Connects immediately, authenticates perfectly
- **20:** Connects, minor auth issues
- **15:** Connects after retry, authentication works
- **10:** Eventually connects, unclear process
- **0:** Cannot connect

### Query Accuracy (0-25 points)
- **25:** Perfect parameters, correct tool selection
- **20:** Right tool, minor parameter issues
- **15:** Right tool, some parameter confusion
- **10:** Wrong tool but gets data somehow
- **0:** Query fails

### Response Quality (0-25 points)
- **25:** Clear, accurate, well-formatted
- **20:** Accurate, minor formatting issues
- **15:** Generally accurate, some confusion
- **10:** Correct but hard to understand
- **0:** Inaccurate or nonsensical

### Error Handling (0-25 points)
- **25:** Graceful handling, user guidance
- **20:** Handles errors, explains to user
- **15:** Detects errors, basic explanation
- **10:** Detects errors, unclear response
- **0:** Doesn't handle errors

**Total: 100 points max**

---

## Testing Process

### Step 1: Setup
```bash
# Configure each model in OpenClaw
openclaw models set anthropic/claude-haiku-4-5-20251001
# Test 1-5 below

openclaw models set mistral/mistral-large-latest
# Test 1-5 below

openclaw models set mistral/mistral-medium
# Test 1-5 below
```

### Step 2: Run Tests
For each model:
```bash
openclaw chat --model <MODEL> "Test 1 prompt..."
openclaw chat --model <MODEL> "Test 2 prompt..."
... etc
```

### Step 3: Score Results
Record response quality for each test/model combo

### Step 4: Document
Create comparison report with:
- Scores by test
- Scores by model
- Qualitative observations
- Recommendations

---

## Expected Results

### Claude Haiku
- **Strength:** Native MCP support, excellent error handling
- **Weakness:** Highest cost
- **Expected Score:** 90-100/100

### Mistral Large
- **Strength:** Good quality, moderate cost, function calling support
- **Weakness:** No native MCP, may need workarounds
- **Expected Score:** 75-85/100

### Mistral Medium
- **Strength:** Lowest cost, acceptable quality
- **Weakness:** May struggle with complex MCP interactions
- **Expected Score:** 60-75/100

---

## Report Structure

**MCP Server Testing Results — March 2026**

1. Executive Summary
   - Best performer: [Model X]
   - Best value: [Model Y]
   - Recommendation for production

2. Detailed Results
   - Test 1-5 scores by model
   - Qualitative observations
   - Example responses

3. Cost Analysis
   - Cost per test
   - Cost/quality ratio
   - ROI comparison

4. Recommendation
   - Which model for production?
   - Hybrid strategy if needed?
   - Fallback options?

---

## Timeline

- **Phase 1 (Today):** Run all tests on all models
- **Phase 2 (Tomorrow):** Compile results, create report
- **Phase 3 (Day 3):** Finalize recommendations, sync to AnyType

---

**Status:** Ready to execute
**Estimated Time:** 2-3 hours total
**Report Destination:** AnyType + GitHub
