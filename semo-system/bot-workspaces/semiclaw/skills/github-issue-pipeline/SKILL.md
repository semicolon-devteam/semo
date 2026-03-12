---
name: github-issue-pipeline
description: Create GitHub issues with the Semicolon team's mandatory 5-step pipeline. Use when creating bugs, features, or tasks — covers duplicate check, issue creation, project board registration, bot label assignment, and polling-based handoff. Prevents the most common mistakes (missing project board, wrong labels, duplicate issues).
---

# GitHub Issue Pipeline

This skill packages the Semicolon team's standard GitHub workflow into a single, repeatable process. Every bug report, feature request, and task follows this 5-step pipeline.

## Quick Start

```bash
# 0. Pre-flight: Check for duplicates (MANDATORY)
gh issue list --search "keywords" --state all --repo semicolon-devteam/<repo>
gh pr list --search "keywords" --state all --repo semicolon-devteam/<repo>

# 1. Create issue with bot label
gh issue create --repo semicolon-devteam/<repo> \
  --title "..." \
  --body "..." \
  --label "bot:spec-ready"

# 2. Register to project board (MOST COMMONLY SKIPPED - DON'T FORGET!)
gh project item-add 1 --owner semicolon-devteam --url <issue-url>

# 3. Bot picks up via polling (automatic)
```

## Pipeline Overview

```
Duplicate Check → Create Issue → Project Board → Bot Label → Bot Picks Up
     (MUST)         (Step 1)      (Step 2)       (Step 3)     (polling)
                                  ⚠️ OFTEN SKIPPED
```

---

## Pre-flight: Duplicate Check (MANDATORY)

**Always check before creating new issues.** Duplicates waste bot time and fragment discussion.

### Search Issues

```bash
gh issue list \
  --search "keyword1 keyword2" \
  --state all \
  --repo semicolon-devteam/<repo>
```

### Search Pull Requests

```bash
gh pr list \
  --search "keyword1 keyword2" \
  --state all \
  --repo semicolon-devteam/<repo>
```

### If Duplicate Found

- **DO NOT** create new issue
- Link to existing issue instead
- Add comment with additional context if needed
- Example: "Duplicate of #123 — same symptom in different environment"

---

## Step 1: Create Issue

### Basic Command

```bash
gh issue create \
  --repo semicolon-devteam/<repo> \
  --title "Clear, actionable title" \
  --body "Detailed description with steps to reproduce" \
  --label "bot:spec-ready"
```

### Requirements

1. **Always include `bot:*` label** — determines which bot picks it up
2. **One feature = one issue** — no bundling multiple requests
3. **Clear title** — bot reads title for context
4. **Actionable body** — include steps, expected/actual behavior, or acceptance criteria

### Common Labels

```bash
# Bug fix ready for implementation
--label "bug,bot:spec-ready"

# New feature needing planning
--label "enhancement,bot:needs-spec"

# PR ready for review
--label "bot:needs-review"

# Needs human attention
--label "bot:blocked"
```

---

## Step 2: Register to Project Board

**⚠️ THIS STEP IS MOST COMMONLY SKIPPED — DON'T FORGET IT!**

Without project board registration, the issue won't appear in team dashboards and may be lost.

### Command

```bash
gh project item-add 1 \
  --owner semicolon-devteam \
  --url <issue-url>
```

### Details

- **Project number:** `1`
- **Project ID:** `PVT_kwDOC01-Rc4AtDz2`
- **Owner:** `semicolon-devteam`
- **URL:** Full GitHub issue URL (from Step 1 output)

### Example

```bash
# After creating issue #456
gh project item-add 1 \
  --owner semicolon-devteam \
  --url https://github.com/semicolon-devteam/semo/issues/456
```

### Why This Matters

- Team dashboard visibility
- Progress tracking across repos
- Sprint planning integration
- Bot won't skip issues registered on the board

---

## Step 3: Assign Bot Label

Bot labels determine which bot picks up the issue via polling. Choose the right label based on issue state.

### Bot Label Reference

| Label | Meaning | Picked up by | Poll Interval |
|---|---|---|---|
| `bot:needs-spec` | Needs planning/design | PlanClaw | 10min |
| `bot:spec-ready` | Ready for implementation | WorkClaw | 5min |
| `bot:needs-review` | PR needs code review | ReviewClaw | 5min |
| `bot:blocked` | Needs human intervention | SemiClaw | 15min |
| `bot:done` | Completed, ready to close | SemiClaw | 15min |
| `bot:in-progress` | Bot actively working (lock) | — | — |
| `bot:info-req` | Waiting for info from reporter | — | Close after answer |

### Label Assignment Examples

```bash
# Simple bug fix — ready for WorkClaw
gh issue create ... --label "bug,bot:spec-ready"

# Complex feature — needs PlanClaw
gh issue create ... --label "enhancement,bot:needs-spec"

# PR ready for review
gh issue create ... --label "bot:needs-review"

# Blocked on external dependency
gh issue create ... --label "bot:blocked"
```

### Label Lifecycle

```
bot:needs-spec → PlanClaw plans → creates new issue with bot:spec-ready
                                      ↓
bot:spec-ready → WorkClaw implements → creates PR → bot:needs-review
                                                         ↓
bot:needs-review → ReviewClaw reviews → approves → bot:done
                                                       ↓
bot:done → Human merges PR → Human closes issue
```

### Lock Labels

- **`bot:in-progress`** — Bot is actively working on this issue. Do NOT manually assign.
- Bots set this label when starting work, remove when done or blocked.

---

## Issue Creation R&R

Who creates issues for what?

### SemiClaw (Main Agent)

- **Bugs** reported by users or team
- **Simple fixes** that don't need planning
- **Labels:** `bug,bot:spec-ready`
- **Next:** WorkClaw picks up

### PlanClaw

- **Features needing planning**
- Creates design spec, then creates NEW issue with implementation plan
- **Labels:** Original issue gets planning notes, new issue gets `bot:spec-ready`
- **Next:** WorkClaw picks up new issue

### DesignClaw

- **NO issue creation** — adds design specs as comments on existing issues
- Works from issues created by SemiClaw or PlanClaw
- Annotates with design mockups, assets, style guides

### ReviewClaw

- **E2E bugs found during review**
- Creates issue with reproduction steps
- **Labels:** `bug,bot:spec-ready` (skip planning, go straight to fix)
- **Next:** WorkClaw picks up

### WorkClaw

- **NO issue creation** — only works on existing issues
- Picks up issues with `bot:spec-ready` label
- Creates PRs, sets `bot:needs-review` when done

---

## PR Rules

### Before Creating PR

```bash
# Check for existing PRs touching same files
gh pr list --repo semicolon-devteam/<repo> --state open
git log --oneline --all --decorate <file-path>
```

**Why:** Avoid merge conflicts and duplicate work.

### Bot PR Behavior

- Bots **NEVER merge PRs** — only humans merge
- ReviewClaw: approve → apply `bot:done` label (no merge)
- WorkClaw: creates PR → apply `bot:needs-review` label → wait

### Self-PR Review Rule

If bot is reviewing its own PR:

- **Comment only** — provide review notes
- **DO NOT approve** — avoid circular approval
- **Assign human reviewer** instead

### Human Handoff

```
Bot creates PR → bot:needs-review → ReviewClaw reviews → bot:done → Human merges
```

---

## Clone Path Rules

All Semicolon repos follow standard path conventions.

### Base Path

```
/Users/reus/Desktop/Sources/semicolon/projects/
```

### Remove Prefixes

Strip repo prefixes when cloning locally:

| Repo Name | Local Dir Name |
|---|---|
| `cm-semo` | `semo` |
| `proj-gameland` | `gameland` |
| `ms-point-exchanger` | `point-exchanger` |

### Clone Command

```bash
# Always specify directory name explicitly
git clone git@github.com:semicolon-devteam/cm-semo.git \
  /Users/reus/Desktop/Sources/semicolon/projects/semo
```

### Why Explicit Paths

- Consistent across all bots
- Avoids prefix clutter in local filesystem
- Makes project switching predictable

---

## Common Workflows

### Bug Report from User

```bash
# 1. Check duplicates
gh issue list --search "login error" --state all --repo semicolon-devteam/semo

# 2. Create issue
gh issue create --repo semicolon-devteam/semo \
  --title "Login fails with 'Invalid session' error" \
  --body "Steps: 1. Open app 2. Click login 3. See error..." \
  --label "bug,bot:spec-ready"

# 3. Register to board
gh project item-add 1 --owner semicolon-devteam --url <issue-url>

# 4. WorkClaw picks up automatically (5min polling)
```

### Feature Request Needing Planning

```bash
# 1. Check duplicates
gh issue list --search "dark mode" --state all --repo semicolon-devteam/semo

# 2. Create issue for planning
gh issue create --repo semicolon-devteam/semo \
  --title "Add dark mode support" \
  --body "Users request dark mode for better night-time UX..." \
  --label "enhancement,bot:needs-spec"

# 3. Register to board
gh project item-add 1 --owner semicolon-devteam --url <issue-url>

# 4. PlanClaw picks up (10min polling)
# 5. PlanClaw creates NEW issue with implementation spec + bot:spec-ready
# 6. WorkClaw picks up new issue
```

### PR Ready for Review

```bash
# 1. Create issue for tracking
gh issue create --repo semicolon-devteam/semo \
  --title "Review PR #789: Add OAuth2 integration" \
  --body "PR: https://github.com/semicolon-devteam/semo/pull/789" \
  --label "bot:needs-review"

# 2. Register to board
gh project item-add 1 --owner semicolon-devteam --url <issue-url>

# 3. ReviewClaw picks up (5min polling)
```

---

## Troubleshooting

### Issue Not Picked Up by Bot

**Check:**

1. Issue has correct `bot:*` label?
2. Issue registered on project board?
3. Issue not already `bot:in-progress` (locked by another bot)?
4. Wait for polling interval (5-15min depending on bot)

### Project Board Registration Failed

```bash
# Verify project exists
gh project list --owner semicolon-devteam

# Manual re-add
gh project item-add 1 --owner semicolon-devteam --url <issue-url>
```

### Duplicate Issue Created by Mistake

```bash
# Close duplicate, link to original
gh issue close <duplicate-number> --repo semicolon-devteam/<repo> \
  --comment "Duplicate of #<original-number>"
```

### Wrong Bot Label Applied

```bash
# Remove wrong label
gh issue edit <number> --repo semicolon-devteam/<repo> \
  --remove-label "bot:needs-spec"

# Add correct label
gh issue edit <number> --repo semicolon-devteam/<repo> \
  --add-label "bot:spec-ready"
```

---

## Reference Commands

### List Issues

```bash
# All open issues
gh issue list --repo semicolon-devteam/<repo>

# Filter by label
gh issue list --label "bot:spec-ready" --repo semicolon-devteam/<repo>

# Search by keyword
gh issue list --search "login" --state all --repo semicolon-devteam/<repo>
```

### Edit Issue

```bash
# Add label
gh issue edit <number> --repo semicolon-devteam/<repo> --add-label "bug"

# Remove label
gh issue edit <number> --repo semicolon-devteam/<repo> --remove-label "bot:blocked"

# Change title
gh issue edit <number> --repo semicolon-devteam/<repo> --title "New title"

# Update body
gh issue edit <number> --repo semicolon-devteam/<repo> --body "Updated description"
```

### Close Issue

```bash
gh issue close <number> --repo semicolon-devteam/<repo> \
  --comment "Fixed in PR #123"
```

### Project Board

```bash
# List projects
gh project list --owner semicolon-devteam

# Add issue to project
gh project item-add 1 --owner semicolon-devteam --url <issue-url>

# View project
gh project view 1 --owner semicolon-devteam
```

---

## Checklist

Before reporting completion, verify:

- [ ] Duplicate check performed (issues + PRs)
- [ ] Issue created with clear title + body
- [ ] Correct `bot:*` label applied
- [ ] **Issue registered on project board** ⚠️
- [ ] Issue URL saved/logged for tracking

If all checked, bot will pick up automatically within polling interval.
