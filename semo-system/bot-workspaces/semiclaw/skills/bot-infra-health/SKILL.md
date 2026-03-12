---
name: bot-infra-health
description: Monitor and fix Semicolon bot team infrastructure health. Use when running daily/weekly bot health checks, diagnosing auth failures, detecting token burn anomalies, validating configs, or auto-fixing common bot issues (401 errors, broken auth-profiles, stuck delivery queues).
---

# Bot Infrastructure Health Check

Detect and fix infrastructure issues across all 7 Semicolon bots before they become outages.

## Bot Inventory

| Bot | Home Dir | Port |
|---|---|---|
| SemiClaw | `~/.openclaw` | 18789 |
| WorkClaw | `~/.openclaw-workclaw` | 18869 |
| PlanClaw | `~/.openclaw-planclaw` | 18809 |
| ReviewClaw | `~/.openclaw-reviewclaw` | 18829 |
| DesignClaw | `~/.openclaw-designclaw` | 18889 |
| GrowthClaw | `~/.openclaw-growthclaw` | 18909 |
| InfraClaw | `~/.openclaw-infraclaw` | 18849 |

## Health Check Workflow

### 1. Run Diagnostic Script

```bash
bash skills/bot-infra-health/scripts/health-check.sh [lookback_hours]
```

Returns JSON report with per-bot: process status, auth health, config issues, error counts, activity metrics, cron health, delivery backlog.

Default lookback: 24 hours.

### 2. Evaluate Against Alert Rules

Read `references/alert-rules.md` for severity thresholds.

Classify each finding as 🔴 CRITICAL / 🟡 WARNING / 🟢 INFO.

### 3. Auto-Fix (CRITICAL issues only)

For each CRITICAL finding, apply the matching auto-fix from `references/alert-rules.md`:

- **Auth format broken** → Rewrite auth-profiles.json to canonical format:
  ```json
  {
    "type": "token",
    "provider": "anthropic",
    "token": "<from working bot>",
    "autoRefresh": true,
    "refreshIntervalMs": 28800000
  }
  ```
  Copy token from the first bot with `auth.ok = true`.

- **Bot process down** → `launchctl kickstart -k gui/$(id -u)/ai.openclaw.<bot>`

- **Config invalid** → Fix key placement (e.g., top-level `heartbeat` → `agents.defaults.heartbeat`)

After fixes, restart affected bots and re-run the diagnostic to verify.

### 4. Generate Report

Format for Slack (#bot-ops channel `C0AFBQ209E0`):

```
🏥 봇 인프라 헬스체크 — YYYY-MM-DD HH:MM

🔴 CRITICAL (N건)
• [봇이름] 문제 설명 → 자동 수정 완료/수동 조치 필요

🟡 WARNING (N건)
• [봇이름] 문제 설명

🟢 ALL CLEAR — N개 봇 정상
```

If all bots are healthy (zero CRITICAL, zero WARNING): post a brief one-liner instead of full report.

### 5. Escalate if Needed

- CRITICAL issues that auto-fix fails → DM Reus (URSQYUNQJ) with details
- 3+ consecutive days with same WARNING → escalate to CRITICAL

## Config Reference

### Correct heartbeat config path
```json
{ "agents": { "defaults": { "heartbeat": { "every": "15m" } } } }
```
NOT top-level `"heartbeat"` (causes config validation failure on v2026.2.x).

### Correct auth-profiles.json structure
```json
{
  "version": 1,
  "profiles": {
    "anthropic:default": { "type": "token", "provider": "anthropic", "token": "...", "autoRefresh": true, "refreshIntervalMs": 28800000 },
    "anthropic:claude_code_oauth_token": { "type": "token", "provider": "anthropic", "token": "...", "autoRefresh": true, "refreshIntervalMs": 28800000 }
  },
  "lastGood": { "anthropic": "anthropic:claude_code_oauth_token" },
  "usageStats": { ... }
}
```

### Token sync script
`~/.openclaw/scripts/sync-claude-token.sh` — runs every 10min via launchd (`ai.openclaw.token-sync`). Syncs OAuth token from macOS Keychain to all bots. If token-sync itself is failing, check `~/.openclaw/logs/token-sync.log`.
