---
name: bot-onboarding
description: Onboard new OpenClaw bot instances to the Semicolon team. Use when creating a new bot (WorkClaw, ReviewClaw, PlanClaw, etc.), setting up Slack Bot + OpenClaw gateway config, injecting team context and role-specific knowledge, or verifying bot connectivity. Covers the full pipeline from Slack app creation through config setup, context injection, communication verification, and memory structure initialization.
---

# Bot Onboarding

End-to-end pipeline for creating and onboarding a new Semicolon team bot.

## Prerequisites

- Slack Bot Token + App Token (from Slack API console)
- OpenClaw installed on target machine
- Anthropic API key for the bot
- Bot's role decided (Coder, Reviewer, Planner, Designer, Growth, Infra, etc.)

## Procedure

### Phase 1: Config Setup

1. Create the bot's home directory: `~/.openclaw-<botname>`
2. Create `openclaw.json` using the template in [references/config-template.md](references/config-template.md)
   - Fill in `gateway.auth.token`, Slack tokens, Anthropic API key
   - Set `channels.slack.groupPolicy: "open"` (never `"allowlist"`)
   - Set `channels.slack.allowBots: true`
   - Set `plugins.entries.slack.enabled: true`
   - Set `messages.ackReaction: "eyes"`, `ackReactionScope: "all"`
   - Add Reus (`URSQYUNQJ`) and SemiClaw (`U0ADGB42N79`) to `dm.allowFrom`
3. Validate config with: `bash <skill-path>/scripts/validate-bot-config.sh <path-to-openclaw.json>`

### Phase 2: Gateway Start & Verify

4. Start gateway: `OPENCLAW_HOME=~/.openclaw-<botname> openclaw gateway start`
5. Confirm gateway connects (check logs for Slack socket connection)
6. Invite bot to `#bot-ops` (C0AFBQ209E0) and relevant project channels
7. Test bidirectional communication:
   - SemiClaw → new bot (mention in #bot-ops)
   - New bot → SemiClaw (reply with mention)

### Phase 3: Context Injection (via Slack DM)

8. Send common context from [references/common-context.md](references/common-context.md):
   - Team info, members, GitHub org
   - Security classification rules
   - Bot communication rules (멘션 필수, config.patch only, etc.)
   - Memory structure guide
9. Send role-specific context from [references/role-templates.md](references/role-templates.md):
   - Select the matching role template
   - Customize SOUL.md for the bot's specific responsibilities
10. Instruct bot to save context to proper memory files:
    - SOUL.md ← role + personality + rules
    - MEMORY.md ← slim index only
    - `memory/team.md` ← team members
    - `memory/bots.md` ← bot architecture
    - `memory/decisions.md` ← rules and principles

### Phase 4: Final Verification

11. Verify bot responds correctly in assigned channels
12. Optional: context quiz ("우리 팀 GitHub org 이름은?")
13. Record bot info in `bot-setup-pipeline.md` table (port, home dir, Slack ID)
14. Announce new bot in `#bot-ops`

## Critical Rules

- **Never use `config.apply`** — always `config.patch` (prevents token wipeout)
- **Never touch token/secret fields** in config
- **Gateway restart requires prior notice** in #bot-ops
- **`groupPolicy: "open"`** always — never `"allowlist"`
- **Bot mentions are mandatory** for inter-bot communication
