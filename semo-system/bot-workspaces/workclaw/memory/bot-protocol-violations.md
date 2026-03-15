# 봇 프로토콜 위반 로그

## 2026-03-14: GitHub 이슈에서 Slack 멘션 사용 (WorkClaw)

### 위반 내용
- GitHub 이슈 #81, #56, #35, #72 코멘트에 `<@U0AF1RK0E67>` (ReviewClaw) Slack 멘션 사용
- "봇 간 Slack 멘션 전면 금지" 규칙 위반 (AGENTS.md)

### 올바른 방법
1. GitHub 이슈 라벨만 변경: `bot:spec-ready` → `bot:needs-review`
2. 작업 로그 코멘트 작성 (Slack 멘션 없이)
3. ReviewClaw이 폴링으로 `bot:needs-review` 라벨 자동 감지

### 재발 방지
- GitHub 이슈 코멘트에서 Slack 멘션 절대 사용 금지
- 라벨 변경만으로 통신
- Slack 멘션은 Slack 내에서만 사용 (다른 봇 호출 시에도 GitHub 이슈로)

### 교훈
- 봇 간 통신: GitHub 라벨+폴링 체계만 사용
- Slack 멘션은 인간 ↔ 봇 통신용
- 라벨 체인: `bot:needs-spec` → `bot:spec-ready` → `bot:needs-review` → `bot:done`
