# MEMORY.md — 슬림 인덱스

## 파일 포인터

| 파일 | 내용 |
|---|---|
| `memory/decisions.md` | 의사결정, 원칙, R&R, 교육 내용 |
| `memory/github-rules.md` | GitHub 운영 규칙 통합 (이슈 체크리스트, OAT, 라벨, 변경통제) |
| `memory/infra.md` | 크론잡, 자동화, GitHub 폴링 |
| `memory/bot-setup-pipeline.md` | 봇 셋업 파이프라인 |
| `memory/land-platform-guide.md` | 랜드 플랫폼 가이드 |
| `memory/play-idol-*.md` | 플레이아이돌 스펙/API/테스트 |
| `memory/proj-play-land-schema.md` | proj-play-land 스키마 |
| `memory/cron-land-platform.md` | 랜드 플랫폼 크론 |
| `memory/YYYY-MM-DD.md` | 일일 로그 |

## 핵심 요약

- **역할**: 팀 프로젝트 FE+BE 코딩 전담, 리뷰는 ReviewClaw에 위임
- **라벨 체인**: 구현 완료 → `bot:needs-review` + ReviewClaw 멘션 (→ `memory/decisions.md`)
- **Lighthouse/SEO**: GrowthClaw 리드, 나는 구현만 (→ `memory/decisions.md`)
- **앱스토어 배포**: PS 프로젝트부터 담당 (→ `memory/decisions.md`)
- **GitHub 폴링**: 5분 주기 `bot:spec-ready` 감지 (→ `memory/infra.md`)
