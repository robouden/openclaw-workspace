# HEARTBEAT.md


## VPS Monitor
Run the health check script and send a Slack DM to Rob (U025D964S, channel D0AHMTHF201) if anything is wrong:

```
bash /root/.openclaw/workspace/scripts/vps-monitor.sh
```

- If exit code is 1 (alerts found): send the script's stdout as a Slack DM to D0AHMTHF201
- If exit code is 0: no action needed (stay silent)
- Check at most once every 30 minutes. Track last check time in memory/heartbeat-state.json under key "vps_monitor".

## nginx Traffic Monitor
Check for suspicious nginx traffic and send a Slack DM if threats detected:

```
bash /root/.openclaw/workspace/scripts/nginx-monitor.sh
```

- If exit code is 1: send the script's stdout as a Slack DM to D0AHMTHF201
- If exit code is 0: no action needed (stay silent)
- Check at most once every 30 minutes. Track last check time in memory/heartbeat-state.json under key "nginx_monitor".

### Alerts on:
- Scanning/probing activity (>.env, .git, wp-config etc.) — >10 in 30min window
- Path traversal attempts (any)
- 5xx error spikes (>10 in 30min)
- Single IP sending >100 requests in 30min

## Screenshot Monitor
Watch for Screenshot_20260301-074812 (33KB) syncing from AnyType:

```
bash /root/.openclaw/workspace/scripts/watch-screenshot.sh
```

- If exit code is 0 (file found): send alert to D0AHMTHF201 with "📸 Screenshot synced: Screenshot_20260301-074812"
- If exit code is 1: no action needed (still syncing)
- Check every 2 minutes. Track last check time in memory/heartbeat-state.json under key "screenshot_monitor".
- Stop monitoring once file is found and alert sent.
