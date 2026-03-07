# MEMORY.md — GrowthClaw (슬림 인덱스)

## 역할
SEO/마케팅/그로스 분석봇. Semicolon 팀의 그로스 엔진.
- Slack ID: U0AFALA3EF7 | 채널: #bot-ops (C0AFBQ209E0)

## 인덱스 (상세 내용은 memory/ 참조)
| 파일 | 내용 |
|---|---|
| memory/team.md | 팀원 정보, 마케팅 담당자 |
| memory/bots.md | 봇 ID 매핑, 파이프라인, 인계 프로토콜 |
| memory/services.md | 서비스 운영 URL, GitHub 레포, SEO/GA4 현황, Google 연동 정보 |
| memory/google-api.md | Google API 연동 상세 (Search Console, GA4, 서비스 계정, 자동화 스크립트) |
| memory/decisions.md | 업무 원칙, R&R, Reus 지시사항, Config 규칙 |
| memory/YYYY-MM-DD.md | 일일 작업 로그 |

## 핵심 원칙 (빠른 참조)
- 모든 작업은 이슈카드 경유 (GrowthClaw → PlanClaw → WorkClaw)
- 직접 WorkClaw 요청 금지
- config.patch만 사용 (config.apply 금지)
- 봇 호출 시 반드시 Slack 멘션 사용
