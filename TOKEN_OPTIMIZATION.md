# Token Optimization Strategy

**Date:** 2026-02-27  
**Model:** Claude Haiku (primary) + Sonnet (complex tasks)  
**Goal:** Reduce token consumption by ~40-50%

## Current Setup (Baseline)

- Using Haiku: ~$0.80/M input, $4/M output
- Main session: ~50k tokens/day
- Web-chat: ~10-20 requests/day
- Total estimated: ~$0.20-0.30/day

## Applied Optimizations

### 1. Context Management ✅
- **Persistent Files**: SOUL.md, USER.md, MEMORY.md auto-loaded (no repeats)
- **Clear Boundaries**: Use `/clear` when switching between:
  - AnyType sync work
  - VPS monitoring
  - Cost tracking
  - Coding tasks
- **Compact Strategy**: When chat exceeds 50 messages, use `/compact` to summarize

### 2. Model Selection ✅
- **Haiku** for: Monitoring, simple edits, routine checks, summaries
- **Sonnet** for: Complex algorithms, architecture decisions, debugging
- **Hybrid**: Start with Sonnet for planning, finish with Haiku

### 3. Prompt Engineering ✅
- **Batch requests**: Group 3-5 related tasks in one message
- **Concise language**: "Check X" not "Could you possibly check X?"
- **No preamble**: Direct to task, skip courtesy phrases
- **Output limits**: Use `--max-tokens 500` for summaries

### 4. Technical Optimizations
- **Disable unused MCP tools**: Check `openclaw models` config
- **Cache frequently used docs**: Keep AnyType proto specs in GRPC_CLIENT.md
- **Plan Mode**: (Claude Code) Shift+Tab to outline before coding

## Expected Impact

| Strategy | Reduction |
|----------|-----------|
| Persistent files | 20-30% |
| Model selection | 10-15% |
| Prompt batching | 15-20% |
| Caching/projects | 30-40% |
| **Combined** | **40-50%** |

**New estimate:** ~$0.10-0.15/day (down from $0.20-0.30)

## Rules for This Session

1. **Start focused**: One task per session max
2. **Batch before asking**: Combine 3-5 related questions
3. **Compact regularly**: Every 50 messages, summarize and start fresh
4. **Use files**: Put recurring instructions in MEMORY.md, TOOLS.md, SKILL.md
5. **Route by complexity**: Simple → Haiku, Hard → Sonnet

## Checklist

- [ ] Document all work in MEMORY.md (avoid re-explaining)
- [ ] Use `/compact` after long conversations
- [ ] Batch related tasks (don't ask one-by-one)
- [ ] Review token usage weekly in COST_TRACKING.md
- [ ] Switch models based on task complexity

## Files to Keep Updated

- **MEMORY.md** - Long-term context (load this instead of re-explaining)
- **TOOLS.md** - Environment-specific notes (camera names, SSH keys, etc.)
- **COST_TRACKING.md** - Daily token burn rate

---
**Source:** Rob's token optimization guide (2026-02-27)  
**Review:** Weekly, report in COST_TRACKING.md
