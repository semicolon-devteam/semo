---
name: weekly-code-quality-scan
description: Run weekly code quality scan (lint, build, security audit) on Semicolon repos and report results. Use when weekly-code-quality-scan cron triggers (Monday 00:00 KST).
---

# Weekly Code Quality Scan

## Target Repos
`core-backend`, `core-interface`, `cm-office`, `proj-game-land`, `proj-play-land`

## Per-Repo Steps
1. Clone via `gh` and run:
   - `npm run lint` + `npm run build` (or `./gradlew build`)
   - Dead code / unused imports detection
   - `npm audit` (or `gradle dependencyCheck`) for vulnerabilities
   - Test coverage check
2. Classify findings by severity
3. For severe issues: create GitHub Issue with label `bot:code-quality`

## Important
- `cm-office` is confidential — do **not** expose business logic details in issues
- Report results summary to Slack `#bot-ops` (C0AFBQ209E0)
