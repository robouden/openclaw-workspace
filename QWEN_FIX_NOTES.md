# OpenClaw Qwen Integration Fix - 2026-02-28

## Summary
Successfully configured OpenClaw VPS to use Qwen models from Alibaba Cloud Model Studio (Singapore) after debugging authentication and configuration issues.

## Problems Found

### 1. **API Key Location Issue**
- **Problem**: API key was only in main config `/root/.openclaw/openclaw.json`
- **Root Cause**: OpenClaw agents look for credentials in agent-specific directory
- **Solution**: Added API key to `/root/.openclaw/agents/main/agent/auth-profiles.json`:
  ```json
  {
    "version": 1,
    "profiles": {
      "qwen-portal:default": {
        "type": "api_key",
        "provider": "qwen-portal",
        "apiKey": "sk-510999c2200e4d37adab8ead9cace6f6"
      }
    }
  }
  ```

### 2. **Wrong API Endpoint**
- **Problem**: Agent's models.json used incorrect baseURL `https://portal.qwen.ai/v1`
- **Root Cause**: Old/incorrect endpoint configuration
- **Solution**: Updated `/root/.openclaw/agents/main/agent/models.json`:
  ```json
  {
    "providers": {
      "qwen-portal": {
        "baseUrl": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "api": "openai-completions"
      }
    }
  }
  ```

### 3. **Stale Gateway Process**
- **Problem**: Old gateway process (PID 317514) blocked port 18789 for 180+ restart attempts
- **Root Cause**: Process not properly killed during restarts
- **Solution**:
  ```bash
  kill -9 317514
  pkill -9 openclaw
  systemctl restart openclaw-gateway.service
  ```

### 4. **Cached Session Data**
- **Problem**: Old sessions retained Anthropic model references
- **Solution**: Cleared session cache:
  ```bash
  rm -f /root/.openclaw/agents/main/sessions/*.jsonl
  rm -f /root/.openclaw/agents/main/sessions/sessions.json
  ```

## Working Configuration

### API Key Source
- **Platform**: Alibaba Cloud Model Studio (International)
- **Region**: Singapore
- **Dashboard**: https://bailian.console.aliyun.com/
- **Path**: API References → API Key
- **Key Format**: `sk-XXXXXXXXXX` (Model Studio format, NOT DashScope China)

### Current Setup
- **Model**: `qwen-portal/qwen-turbo`
- **Auth Mode**: `api_key`
- **Endpoint**: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- **Gateway**: Running on port 18789
- **Slack Integration**: Connected and working

### Files Modified
1. `/root/.openclaw/openclaw.json` - Main configuration
2. `/root/.openclaw/agents/main/agent/auth-profiles.json` - Agent authentication
3. `/root/.openclaw/agents/main/agent/models.json` - Model endpoint configuration

## Verification
Successful gateway startup shows:
```
[gateway] agent model: qwen-portal/qwen-turbo
[slack] socket mode connected
```

## Testing
✅ Slack bot responds using Qwen models
✅ Web chat interface working
✅ No more OAuth or authentication errors

## Key Lessons
1. OpenClaw uses **agent-specific config directories** for auth and models
2. **Kill stale processes** properly before assuming config changes work
3. International Model Studio uses **different endpoint** than DashScope China
4. **Clear session cache** when changing models to avoid cached references
