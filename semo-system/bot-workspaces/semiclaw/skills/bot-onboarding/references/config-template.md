# openclaw.json Config Template

> Copy and fill in the values marked with `<...>`. Fields marked ⚠️ are critical.

```json
{
  "gateway": {
    "auth": {
      "token": "<GATEWAY_TOKEN>"
    },
    "port": "<PORT_NUMBER>"
  },
  "auth": {
    "profiles": {
      "anthropic:default": {
        "provider": "anthropic",
        "mode": "token"
      }
    }
  },
  "channels": {
    "slack": {
      "botToken": "<SLACK_BOT_TOKEN>",
      "appToken": "<SLACK_APP_TOKEN>",
      "groupPolicy": "open",
      "allowBots": true,
      "channels": {
        "C0AFBQ209E0": {
          "allowBots": true
        }
      },
      "dm": {
        "enabled": true,
        "policy": "allowlist",
        "allowFrom": ["URSQYUNQJ", "U0ADGB42N79"]
      }
    }
  },
  "plugins": {
    "entries": {
      "slack": {
        "enabled": true
      }
    }
  },
  "messages": {
    "ackReaction": "eyes",
    "ackReactionScope": "all"
  }
}
```

## Field Notes

| Field | Notes |
|---|---|
| `gateway.auth.token` | ⚠️ **Never overwrite** — losing this kills the gateway |
| `gateway.port` | Each bot needs a unique port (18789, 18790, 18791, ...) |
| `auth.profiles` | ⚠️ `mode: "token"` = OpenClaw 내부 크레덴셜 관리. `openclaw doctor`로 셋업 시 자동 저장됨 |
| `groupPolicy` | ⚠️ Must be `"open"` — never use `"allowlist"` |
| `allowBots` | Must be `true` at both top level and for `#bot-ops` channel |
| `plugins.entries.slack.enabled` | ⚠️ Must be `true` — bot won't connect to Slack without this |
| `ackReaction` | `"eyes"` = 👀 auto-reaction on mention |
| `channels.slack.dm` | DM 설정 — `policy: "allowlist"` + Reus/SemiClaw 최소 포함 |

## ⚠️ Warnings

1. **Never use `config.apply`** — it overwrites the entire config and will wipe tokens
2. **Always use `config.patch`** for changes — partial update, preserves existing values
3. **Before any config change**: run `config.get` to check current state
4. **Never modify token/secret fields** programmatically
5. **After config change**: send `SIGUSR1` to reload without restart, or `gateway restart` (with #bot-ops notice)
