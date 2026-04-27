# SEMO Personal/Team 분리 — 진행 상태 (2026-04-27)

> 세션 인계용 컨텍스트 문서. SEMO 가 OSS 베타(Personal) 와 내부 팀 사용(Team) 두 갈래로 분리되는 중간 상태를 한 곳에 모았다.
> 흩어진 1차 자료: `docs/OSS-BETA-PLAYBOOK.md`, `docs/L2-INVENTORY.md`, `docs/semo-v4-improvement-plan.md`, `docs/ARCHITECTURE.md`, KB `decision/dashboard-ui-absorbed-into-host`.
> 다음 단계 실행 계획: **`docs/runtime-portable-roadmap.md`** (Phase 0 cli 번들화 → Phase 1 Runtime Portable 5 컴포넌트).
> 핵심 결정: KB `semo decision personal-team-split-status-snapshot` (Option A 채택, 2026-04-27).

---

## 1. 배경 & 목표

SEMO v4 는 PostgreSQL SSoT + 7봇 오케스트레이터로 시작했지만, OSS 공개·개인 사용자 흡수를 위해 두 갈래 디스트리뷰션이 필요해졌다.

| 갈래                       | 대상                         | 백엔드              | 외부 의존                |
| -------------------------- | ---------------------------- | ------------------- | ------------------------ |
| **Personal (`semo-solo`)** | 1인 사용자, OSS 베타         | SQLite + Ollama/MLX | 없음 — 빈 머신 30분 설치 |
| **Team (`semo-cli`)**      | Semicolon 내부 / 조직 사용자 | PostgreSQL          | Slack/GitHub/Discord 봇  |

L0 진입점은 `semo-core` (Profile 판별 → 둘 중 하나로 dispatch). 사용자는 `semo init --profile personal-discord` 같은 단일 명령으로 자기 갈래 선택.

분리의 부산물: **L2 격리** (세미콜론 고유 고객/팀원 식별자가 OSS 코드 경로에 노출되지 않게 정리).

---

## 2. 패키지 매핑

| 패키지                            | 버전    | npm 배포      | 갈래            | 역할                                     | 상태                  |
| --------------------------------- | ------- | ------------- | --------------- | ---------------------------------------- | --------------------- |
| `cli-core` (semo-core)            | 0.1.0   | ✅            | 공통 L0         | profile 판별 → cli/solo dispatch         | 배포 완료             |
| `cli-solo` (semo-solo)            | 0.1.1   | ✅ (beta tag) | Personal        | SQLite/Ollama 단일 esbuild 번들          | 배포 완료             |
| `cli` (semo-cli)                  | 4.18.11 | ✅            | Team            | PG SSoT + Slack/GitHub                   | **번들 미완** ⚠       |
| `semo-dashboard`                  | —       | (Docker)      | Team            | 팀 운영 대시보드                         | dev push → ArgoCD     |
| `semo-dashboard-personal`         | —       | ❌            | Personal        | 1인용 대시보드 (action_items/KB)         | 패키지화만, 배포 미정 |
| `common`                          | —       | ❌            | 공통 라이브러리 | slack/mailbox/router/monitoring/resolver | 동적 import 의존      |
| `discord-router`                  | —       | ❌            | 공통            | Discord 어댑터                           | 동적 import 의존      |
| `kb-core` / `kb-pg` / `ops-store` | —       | ❌            | 공통            | KB 백엔드 + ops.db                       | 동적 import 의존      |

> **임계점**: `semo-cli` 가 위 5개 미배포 패키지를 동적 require 하므로, Team 사용자가 npm install 해도 `factory parse`, `templates list`, `chat` 등 명령이 실패한다. 해결책 결정 필요 (3번 항목 참조).

---

## 3. 완료된 작업

### 3.1 L2 격리 (OSS 차단 항목 = 0)

`docs/L2-INVENTORY.md:274-285` 기준 모두 완료.

- HIGH 12건: ontology 시드 제거 (017/030/108), kb-manager 프롬프트 일반화 (027/031/110), HOME fallback, slack workspace 동적 도출 — 커밋 `2fad628e`, `0dd051de`
- MEDIUM 6건: templates/builtin.ts, migration 065 COMMENT, hook-regex.test.ts L2 닉네임 → `alice` — 커밋 `4f90626c`
- MEDIUM 실행 2건: migration 015/109 description 일반화 — 커밋 `b057e630`
- P0 자산 인벤토리 1차 격리 — 커밋 `85fbf367`

### 3.2 패키지 인프라

- `semo-core` 신규 스캐폴딩 + 0.1.0 npm 배포 — 커밋 `1b54a7db`, `4d4b2655`
- `semo-solo` SQLite adapter + personal install toolchain — 커밋 `88b28589`
- `semo-solo` semo_home 지원 + ultrareview 픽스 — 커밋 `e353826b`
- `semo-dashboard-personal` 신규 패키지 (action_items CRUD + KB + bots) — 커밋 `ec10370b`, `3c45d130`
- `dashboard-ui` 워크스페이스 패키지 → 양쪽 dashboard `lib/shared-ui/` 로 흡수 — 커밋 `8e066fa3`, KB decision `dashboard-ui-absorbed-into-host`
- `common` 폴더 재조직 (slack/mailbox/router/monitoring/resolver) — 커밋 `ea3199ca`
- `pg` 를 optionalDependencies 로 이관, lazy require — 커밋 `25fb6831`, `29db9a93` (Personal 설치 시 PG 미설치 허용)
- LICENSE/NOTICE 동봉 — 커밋 `b52e36a8`, `7cfc6299`

### 3.3 OSS 번들 & CI

- esbuild 번들 인프라 (`packages/cli/scripts/bundle.mjs`) — 커밋 `5af4d65a`
- pr-gate 워크플로우에 cli 번들 smoke (esbuild + --version + dry-run init) — 커밋 `935839ea`, `bab08afb`
- `dev` push 도 pr-gate 트리거 — 커밋 `bab08afb`
- npm 패키지에 LICENSE + migrations/ + migrations-sqlite/ 동봉 — 커밋 `13d772f4`

### 3.4 사용자 경험

- `semo doctor` config.toml 미존재 시 ⚠ + init 안내 — 커밋 `882b6de9`
- `semo migrate-sqlite` config 누락 시 init 안내 + exit 2 — 커밋 `2eca0d6c`
- factory-conversation 스킬 + kernel skill catalog (P3.3) — 커밋 `8894aebe`
- deploy 플레이북 update 단계 + doctor kernel-skills 체크 (P5.2/P5.3) — 커밋 `980ce823`
- OSS 베타 플레이북 (`docs/OSS-BETA-PLAYBOOK.md`) — 커밋 `7feb637d`
- v3 레거시 문서에 v4.18 redirect 배너 — 커밋 `29b12541`
- 베타 사용자용 issue template — 커밋 `a23d5d70`, `d338962a`

### 3.5 v4 설계 이행 (P0–P2)

`docs/semo-v4-improvement-plan.md` 16단계 중 6개 완료 (`83fcad4c` 일괄):

- P0-1 bots sync status 보존
- P0-2 context push 도메인 가드
- P1-4 7개 봇 훅 sessions push
- P2-1 spawnSync 제거
- P2-2 IDENTITY.md 파서 개선
- P2-3 임베딩 배치 API 호출

---

## 4. 남은 작업

### 4.1 결정 필요 — Team OSS 배포 경로 ⚠

**현 문제**: `semo-cli` 가 미배포 5개 패키지에 동적 의존. Team 사용자 npm install → 일부 명령 실패.

| 옵션                                    | 작업량  | Trade-off                                                |
| --------------------------------------- | ------- | -------------------------------------------------------- |
| **A. cli 번들화** (semo-solo 패턴 복제) | 2–3시간 | esbuild 인프라 이미 있음. main/bin 전환만. ✅ 추천       |
| **B. 5개 패키지 npm 공개 발행**         | 1–2일   | 워크플로우 5개 신설 + tsc 산출물 준비. 버전 동기화 부담. |
| **C. Personal-only OSS 광고**           | 0       | Team 갈래 OSS 미공개. 단기 우회.                         |

**제안**: A 채택. Personal 갈래는 이미 안정적이므로 Team 도 동일 방식으로 묶어 단일 배포본화.

### 4.2 OSS 베타 발행 체크리스트 (`OSS-BETA-PLAYBOOK.md:8-20`)

현재 `--tag beta` 로 발행 대기. 4개 통과 후 `latest` 태그:

- ☐ `npm run bundle` 산출물 동작 검증
- ☐ `semo init --profile personal-discord` 빈 머신 통과
- ☐ `semo migrate-sqlite` 스키마 적용 확인
- ☐ `semo doctor` green 확인

### 4.3 v4 설계 이행 잔여 (P1–P3)

| ID   | 내용                                                        | 의존 | 추정  |
| ---- | ----------------------------------------------------------- | ---- | ----- |
| P1-1 | 마이그레이션 시스템 (`semo db migrate`, migrations/ 구조화) | —    | 1일   |
| P1-2 | DB 인덱스 추가                                              | P1-1 | 0.5일 |
| P1-3 | DB FK 추가                                                  | P1-1 | 0.5일 |
| P0-3 | session_count 트리거                                        | P1-1 | 0.5일 |
| P1-5 | KB 변경 이력 (`knowledge_base_history`)                     | P1-1 | 1일   |
| P2-4 | 메모리 Hot/Cold 분리 (`semo memory archive`)                | —    | 1일   |
| P3-1 | 임베딩 backfill (context push 경로)                         | —    | 2일   |
| P3-2 | 온톨로지 검증 확장                                          | —    | 1일   |
| P3-3 | `semo context stats`                                        | —    | 1일   |

P1-1 이 4건의 선행 조건 → 가장 먼저 착수 권장.

### 4.4 Personal 잔여

- `semo-dashboard-personal` Vercel/자가호스팅 배포 가이드 미작성
- Personal 모드에서 KB 임베딩 비용 (OpenAI API key 없을 때 대체) 정책 미확정
- `semo init --profile personal-slack`, `personal-discord` 외 추가 프로필 필요성 검토

### 4.5 LOW 우선순위

- packages/cli, packages/semo-dashboard README.md 신규 작성 (P4-1)
- packages/semo-dashboard 내 wise-platform/axoracle 예시 → generic 화 (P4 dashboard L2 분리)
- `actions/checkout@v4`, `actions/setup-node@v4` Node 24 대응 (publish-cli.yml deprecation 경고)

---

## 5. 빠른 컨텍스트 회복 명령어

```bash
# 현재 진행 상태 확인
cat docs/personal-team-split-status.md      # 이 문서
cat docs/L2-INVENTORY.md                    # L2 격리 현황
cat docs/OSS-BETA-PLAYBOOK.md               # 베타 발행 절차
cat docs/semo-v4-improvement-plan.md        # v4 설계 이행 트래커

# 패키지 구조
ls packages/                                # cli, cli-core, cli-solo, semo-dashboard*, common, ...
cat packages/cli-core/package.json          # L0 dispatch 정의
cat packages/cli-solo/package.json          # Personal 번들 entry

# npm 배포 현황
npm view @team-semicolon/semo-cli versions --json
npm view @team-semicolon/semo-core version
npm view @team-semicolon/semo-solo dist-tags

# KB 의사결정 조회
semo kb get semo decision dashboard-ui-absorbed-into-host
semo kb search "OSS 베타"
semo kb search "L2 leakage"
```

---

## 6. 변경 이력

- 2026-04-27 — 초안 작성 (reus 요청, semiclaw 정리). Explore agent 종합 보고 + git log + KB 의사결정 통합.
