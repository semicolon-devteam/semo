---
name: play-idol-e2e-test
description: Run E2E tests on Play Idol (플레이아이돌) dev server and create GitHub issues for failures. Use when play-idol-e2e-test cron triggers or when manually requested.
---

# Play Idol E2E Test (ReviewClaw)

## Target
- URL: http://play-land-dev.semi-colon.space
- Repo: semicolon-devteam/proj-play-land
- Test checklist: Issue #12

## Accounts
- General: `test` / `123123`
- Admin: `admin` / `ComAdminPass1212`

## Test Rules
- Navigate via buttons/links only (no direct URL access, except initial login)
- Test in order: general user → idol user → admin
- Follow Issue #12 checklist items in sequence

## On Failure
- **DO NOT modify code** — create GitHub issues only
- Issue contents: failed item, reproduction path, expected behavior, screenshot
- Labels: `bot:spec-ready`, assignee: WorkClaw (@U0AFECSJHK3)
- Update Issue #12 checklist (pass/fail status)
- Report to Slack `C08P9TDK0UR`: pass rate, failed items summary
