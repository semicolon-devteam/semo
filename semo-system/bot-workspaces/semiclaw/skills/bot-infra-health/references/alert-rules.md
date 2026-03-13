# Alert Rules

## Severity Levels

| Level | Action | Example |
|---|---|---|
| 🔴 CRITICAL | Immediate fix + Slack alert to Reus | Auth broken, bot down, 401 spam |
| 🟡 WARNING | Log + include in daily report | High error count, delivery backlog, version outdated |
| 🟢 INFO | Report only | Normal metrics, version info |

## Alert Thresholds

### Auth
- 🔴 `auth.ok = false` — any bot with broken auth
- 🔴 `errors.401_auth > 5` in 24h — token expired/invalid
- 🔴 `errors.no_api_key > 0` — missing key

### Process
- 🔴 `process.up = false AND process.launchd_pid = null` — bot completely dead
- 🟡 `process.up = false AND process.launchd_pid != null` — process crashed but launchd managing

### Config
- 🟡 `config.issues != "OK"` — invalid config keys present

### Activity
- 🟡 `activity.agent_runs > 300/day` — excessive token burn (per bot)
- 🟡 `cron.errored > 0` — cron jobs failing

### Delivery
- 🟡 `delivery_backlog > 10` — messages stuck in queue
- 🔴 `delivery_backlog > 100` — severe delivery jam
- 🟡 `errors.channel_not_found > 20` — channel config broken

### Version
- 🟡 All bots should be on same version; flag mismatches
- 🟢 New version available — include in report

## Auto-Fix Actions

The skill can attempt these fixes automatically:

| Issue | Auto-Fix | Requires Restart |
|---|---|---|
| `type: "oauth"` in auth-profiles | Rewrite to `type: "token"` format | Yes |
| Cooldown/error state stuck | Clear usageStats | Yes |
| Invalid top-level config key | Move to correct path or remove | Yes |
| Bot process down | `launchctl kickstart` | N/A |

After any auto-fix that requires restart: `launchctl kickstart -k gui/$(id -u)/ai.openclaw.<bot>`
