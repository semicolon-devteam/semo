# team.md — 팀 정보

## 팀 Semicolon
- 시니어 엔지니어 팀, 풀스택 (웹/앱/인프라)
- GitHub 조직: `semicolon-devteam`
- 주요 스택: TypeScript(프론트), Kotlin/Spring Boot(백엔드), HCL(인프라), Supabase, React Native

## 레포 프리픽스 규칙
- `proj-` → 프로젝트 / `cm-` → 레거시 / `ms-` → 마이크로서비스 / `core-` → 코어 인프라/공통

## 주요 레포
- `core-backend` (Spring Boot+Kotlin), `core-interface`, `core-terraform`/`core-infra` (HCL), `core-supabase`
- MS: `ms-media-processor`, `ms-crawler`, `ms-scheduler`, `ms-notifier`, `ms-ledger`, `ms-collector`, `ms-allocator`, `ms-point-exchanger`
- 프로젝트: `proj-game-land`, `proj-play-land`, `proj-bebecare`, `axoracle`, `mvp-link-collect`
- 레거시: `cm-jungchipan`, `cm-office`, `cm-land`

## CI/CD
- `actions-template` — 재사용 워크플로우 허브
- 3단계: Dev → Staging → Production
- GitOps: `semi-colon-ops` (Kustomize), DockerHub: `semicolonmanager`
- 주요 워크플로우: `ci-without-env.yml`, `ci-next*.yml`, `ci-go.yml`, `claude-code-review.yml`

## 로컬 프로젝트 디렉토리 (2026-02-25, SemiClaw 제공 + 확인)
- Semicolon 프로젝트 루트: `/Users/reus/Desktop/Sources/semicolon`
- 개별 프로젝트: `/Users/reus/Desktop/Sources/semicolon/projects`
- 랜드 서비스: `/Users/reus/Desktop/Sources/semicolon/projects/land`
- bebecare: `/Users/reus/Desktop/Sources/semicolon/projects/bebecare` (GitHub: proj-bebecare, 로컬: proj- 접두사 없음)

### 🔴 클론 규칙 (2026-02-25, Reus 지시)
- **절대 금지**: `/Users/reus/Desktop/Sources/semicolon` 루트에 직접 클론
- **필수**: `/Users/reus/Desktop/Sources/semicolon/projects` 안에만 클론
- 위반 시 Reus가 직접 삭제함

## 프로젝트 → Slack 채널 매핑 (2026-02-23, SemiClaw 제공)
| Repo | 채널 ID | 채널명 | 비고 |
|---|---|---|---|
| `cm-jungchipan` | C09AL1LUFV4 | #cm-jungchipan | 정치판 |
| `proj-game-land` | C0AEV7QN6R0 | #proj-game-land | 게임랜드 |
| `ps` | C0A5Q5CL2DR | #ps | PS |
| `cm-office` | (확인 필요) | #proj-office-land? | |
| (기타) | C0AFBQ209E0 | #bot-ops | 기본값 |

**로직**: 리뷰 완료 후 레포명으로 매핑 테이블 검색 → 채널 있으면 해당 채널로, 없으면 #bot-ops로 결과 공유
