# Mistral API Usage Tracking

## Account Status

**Account Type:** Experimental (Free Tier)
**Status:** Active
**Last Updated:** 2026-03-03

---

## Free Tier Limits

| Metric | Limit | Period |
|--------|-------|--------|
| **Monthly Tokens** | ~10-15M (estimated) | Per calendar month |
| **Requests/Minute** | 5-10 (estimated) | Rate limit |
| **Available Models** | All (7B, Small, Medium, Large) | ✅ |
| **API Access** | Full | ✅ |

⚠️ **Note:** These are estimates. Verify exact limits at https://console.mistral.ai

---

## Daily Usage Tracking

### March 2026

| Date | Routine Tasks | MCP Tasks | Input Tokens | Output Tokens | Total | Estimated Cost | Notes |
|------|---|---|---|---|---|---|---|
| 2026-03-01 | - | - | - | - | - | $0 (free) | Mistral setup |
| 2026-03-02 | ~5 | ~2 | - | - | - | $0 (free) | Testing |
| 2026-03-03 | ~8 | ~2 | - | - | - | $0 (free) | Local setup verified |
| | | | | | | | |
| **Monthly Total** | | | | | | **~$0 (free)** | |

---

## Monthly Summary

```
Month: March 2026
Start Date: 2026-03-01
Free Limit: ~10-15M tokens
Used: TBD
Remaining: TBD
% of Quota: 0%
Status: ✅ Well within limits
```

---

## Cost Projection

**If usage continues:**
- Routine (80% on Mistral): ~800k tokens/day
- MCP (20% on Haiku): ~200k tokens/day
- **Total: ~1M tokens/day**

**Free tier burndown:**
- Current burn rate: ~1M tokens/day
- Estimated free tier: 10-15M tokens
- Expected expiration: ~10-15 days from March 1

**After free tier ends:**
- Mistral Large: $1.08/1M tokens
- Cost: ~$1.08/day (~$32/month)
- vs Claude Haiku: $3.20/1M tokens ($96/month)
- **Savings: 66%**

---

## Usage by Task Type

| Task Type | Daily Volume | Model | Cost |
|-----------|--------------|-------|------|
| **Routine (80%)** | ~800k tokens | Mistral Large | $0.86/day (free tier) |
| **MCP work (20%)** | ~200k tokens | Claude Haiku | $0.64/day (if using Haiku) |
| **Total** | ~1M tokens/day | Hybrid | ~$1.50/day (after free tier) |

---

## How to Monitor

### Check at admin.mistral.ai/organization/billing ✅

1. Go to: https://admin.mistral.ai/organization/billing
2. Sign in to your account
3. View:
   - **Current usage this month**
   - **Free credits remaining**
   - **Tokens consumed**
   - **Expiration date (if shown)**

### Log Your Usage

**Every few days, update this table:**
- Check https://admin.mistral.ai/organization/billing
- Record tokens used
- Note remaining balance
- Update projection

---

## Renewal/Upgrade Plan

### If Free Tier Expires

**Option A: Continue with Mistral API**
- Cost: ~$32/month (Mistral Large)
- Save: ~$64/month vs Haiku (66% savings)
- Setup: Already done

**Option B: Switch to Claude Haiku**
- Cost: ~$96/month
- Quality: Better (+10% vs Mistral)
- MCP: Native support ✅

**Option C: Hybrid (Recommended)**
- Mistral Large: $32/month (routine 80%)
- Claude Haiku: For MCP tasks only
- Blended: ~$40-50/month
- Save: ~$50/month vs 100% Haiku

---

## Timeline

```
2026-03-03  ← Today (Start tracking)
    ↓
2026-03-13  ← ~10 days: Free tier likely exhausted
    ↓
2026-03-15  ← Decision point: Upgrade or hybrid?
    ↓
2026-03-20  ← Review actual usage patterns
    ↓
2026-04-01  ← New month: Confirm pricing model
```

---

## Key Metrics to Track

- **Input tokens/day:** Requests sent to Mistral
- **Output tokens/day:** Responses from Mistral
- **Free credits remaining:** Burndown rate
- **Models used:** Which models getting most use?
- **Cost trend:** Monitor after free tier ends

---

## Quick Reference

**To see usage:**
```bash
# Go to admin dashboard in browser
https://admin.mistral.ai/organization/billing
```

**To estimate tokens:**
- ~1 token ≈ 4 characters
- Average prompt: ~200 tokens
- Average response: ~300 tokens
- Per interaction: ~500 tokens

---

## Notes

- Free tier is temporary (exact end date unknown)
- Plan for paid tier transition by mid-March
- Mistral API offers best price/quality balance
- MCP support still requires Claude Haiku for reliability
- Hybrid approach recommended long-term

---

## Checklist

- [ ] Verify exact free tier limits at https://admin.mistral.ai/organization/billing ✅
- [ ] Start tracking daily usage (update table above)
- [ ] Monitor free tier burndown
- [ ] Test Mistral quality for your workload
- [ ] Plan renewal/upgrade by March 13
- [ ] Configure billing if upgrading
- [ ] Review actual costs vs projections after week 1

---

**Last Updated:** 2026-03-03 14:30 UTC
**Status:** Active tracking
**Next Review:** 2026-03-10 (end of first week)
