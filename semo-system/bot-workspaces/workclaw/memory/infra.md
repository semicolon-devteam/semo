# infra.md — 인프라/크론/자동화

## GitHub 폴링 cron (2026-02-17)

- Job: `github-polling-spec-ready` (ae833ef7)
- 5분마다 `bot:spec-ready` + not `bot:in-progress` 이슈 감지 → 구현 → PR
- 코딩 게이트 준수: feature 브랜치 → 코딩 → 빌드 → 테스트 → PR (dev 대상)
