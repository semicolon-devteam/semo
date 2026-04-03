# semo — Claude Configuration

> SEMO v4.3.0 (2026-03-24)

---

## SEMO란?

**SEMO (Semicolon Orchestrate)** 는 [OpenClaw 봇팀] ↔ [Core DB] ↔ [로컬 Claude Code 세션]의 3자 컨텍스트 동기화 시스템이다. 이 디렉토리는 SEMO 시스템 자체의 소스코드.

---

## KB 접근 (semo CLI)

| 명령어 | 설명 |
|--------|------|
| `semo kb search "쿼리"` | 벡터+텍스트 하이브리드 검색 |
| `semo kb get <domain> <key> [sub_key]` | domain+key 정확 조회 |
| `semo kb list --domain <domain>` | 도메인별 엔트리 목록 |
| `semo kb upsert <domain> <key> [sub_key] --content "내용"` | KB 항목 쓰기 |
| `semo kb ontology --action <action>` | 온톨로지 조회 (list/show/services/types/instances/schema/routing-table) |

**정확한 경로를 모를 때:** `semo kb search "검색어"` → 결과의 `[domain] key/sub_key` 경로 확인
**도메인 자체를 모를 때:** `semo kb ontology --action instances` 또는 `--action routing-table`

---

## KB-First 행동 규칙 (NON-NEGOTIABLE)

> KB는 팀의 Single Source of Truth이다. 아래 규칙은 예외 없이 적용된다.

### 읽기 (Query-First)
다음 주제 질문 → **반드시 `semo kb search`/`semo kb get`으로 KB 먼저 조회** 후 답변:
- 팀원 정보 → `domain: {name}` (개인 도메인, team 타입), key: `contact` or `role`
- 프로젝트/서비스 현황 → `semo kb ontology --action instances` 또는 `domain: {serviceName}`
- 의사결정 기록 → `domain: semicolon`, key: `decision`, sub_key: `{date}/{slug}`
- 업무 프로세스 → `domain: semicolon`, key: `process`, sub_key: `{name}`
- 인프라 구성 → `domain: semicolon`, key: `infra`, sub_key: `{name}`
- 서비스 KPI → `domain: {serviceName}`, key: `kpi`, sub_key: `{YYYY-MM-DD}` (최신: 가장 최근 날짜 조회)
- 봇 정보 → `domain: {botId}`, key: `identity` / `role` / `gateway-config`
- SEMO 시스템 스펙 → `domain: semo`, key: `spec`, sub_key: `{name}`
- 서비스 스코프 전체 검색 → `--service {serviceName}` 파라미터

#### 네이밍 컨벤션 (NON-NEGOTIABLE)
- **도메인, key, sub_key 모두 kebab-case** 사용: `base-information`, `slack-channel`, `tech-stack`
- **snake_case 금지**: `base_information` ✗ → `base-information` ✓
- CLI가 snake_case 키를 자동 거부함 (upsert, ontology add-key 모두)
- 단일 단어는 그대로: `status`, `po`, `bm`, `repo`, `kpi`

#### 도메인 구조
| 패턴 | 예시 | 용도 |
|------|------|------|
| `semicolon` | `semicolon` | 조직 공통 — decision/process/infra/slack-channel 하위 키 |
| `{service}` | `semo`, `axoracle` | 서비스 고유 — base-information/status/spec/kpi/slack-channel 하위 키 |
| `{botId}` | `semiclaw`, `workclaw` | 봇 프로필 — identity/role/status/gateway-config 하위 키 |

**답변근거 표기**: KB 기반 답변 첫 줄에 출처 명시 — `[답변근거: KB {domain} {key}]`
  복수 조회 시: `[답변근거: KB semo bot-ids, axoracle base-information]`

**금지:** 위 주제를 자체 지식/세션 기억만으로 답변하는 것.
KB에 없으면: "KB에 해당 정보가 없습니다. 알려주시면 등록하겠습니다."

### 쓰기 (Write-Back) — 자동 KB 기록

다음 상황 발생 시 **사용자 지시 없이도** 즉시 `semo kb upsert`로 KB에 기록:

| 트리거 | KB 경로 | 예시 |
|--------|---------|------|
| 의사결정/합의 | `semicolon decision/{date}/{slug}` | 봇 규칙 이동, 배포 정책 변경 |
| 프로세스/규칙 변경 | `semicolon process/{slug}` | naming convention, GFP 프리셋 정책 |
| 봇 설정 변경 (SOUL.md, AGENTS.md, 스킬) | `semicolon decision/{date}/{slug}` | Commitment Protocol 위치 이동 |
| 인프라 정책 변경 | `semicolon infra/{name}` | 배포 전략, CI/CD 채널 설정 |
| 서비스 상태/정보 변경 | `{service} {key}` | preset 변경, slack-channel 설정 |
| 팀원 정보 정정/추가 | `{member} {key}` | 역할 변경, 연락처 업데이트 |

- **쓰기 대상 고지**: upsert 전 대상 명시 — `[KB 기록: {domain} {key} — 생성|수정]`
- **금지:** "알겠습니다/기억하겠습니다"만 하고 KB에 쓰지 않는 것.

---

## 3자 동기화 검증 규칙 (NON-NEGOTIABLE)

> 이 프로젝트의 모든 변경은 3자 동기화 관점에서 평가되어야 한다.
> 3자 = **소스코드** ↔ **KB 포함 DB** ↔ **OpenClaw 봇 워크스페이스 로컬 파일**

### 3자 정의

| 축 | 위치 | 예시 |
|----|------|------|
| **소스코드** | 이 레포 (`packages/cli`, `packages/semo-dashboard` 등) | Phase 정의, API 라우트, 타입, 마이그레이션 |
| **KB 포함 DB** | semo-kb (PostgreSQL + 벡터 임베딩) | `semicolon process/gfp-phases`, `{botId} role`, 온톨로지 |
| **봇 로컬 파일** | `~/.openclaw-{botId}/workspace/` (SOUL.md, skills/, memory/) + `~/.claude/semo/` (semo CLI 로컬 환경) | 봇 스킬 SKILL.md, 스크립트, SOUL.md, MEMORY.md |

### 변경 시 동기화 체크리스트

**기능/프로세스/스펙을 변경할 때** 아래 질문을 반드시 확인:

1. **소스코드 변경 시** → KB와 봇 로컬 파일에 반영할 내용이 있는가?
   - 예: Phase 구조 변경 → KB `semicolon process/gfp-phases` 업데이트 + 관련 봇 SKILL.md 수정
   - 예: API 엔드포인트 추가 → 봇 스킬 스크립트가 참조하면 스크립트도 수정
2. **KB 변경 시** → 소스코드나 봇 로컬 파일과 불일치가 생기지 않는가?
   - 예: 봇 역할(role) 변경 → 해당 봇 SOUL.md, 스킬 파일 동시 수정
3. **봇 로컬 파일 변경 시** → KB에 기록할 사항이 있는가? 소스코드와 정합성이 맞는가?
   - 예: 봇 스킬 워크플로우 변경 → KB의 프로세스 엔트리와 일치하는지 확인
   - `bot_workspace_standard`에서 해당 파일의 `content_rules` 확인 필수

### 추가 규칙

1. **SoT 위치**: DB 테이블 → DB에서 읽기 (하드코딩 금지). KB → `semo kb get/search` 조회.
2. **하드코딩 금지**: 봇 목록 → `bot_status` DB. 도메인 → `ontology` DB. 워크스페이스 규격 → `bot_workspace_standard` DB.
3. **KB 데이터 쓰기 시**: 반드시 `semo kb upsert` CLI 또는 `kbUpsert()` 함수를 사용 (임베딩 + 도메인/스키마 검증 포함). raw SQL INSERT 금지.
4. **검증**: `semo test run workspace-audit` / `semo test run 018-transplant` / KB 도구 호출 테스트.

### 위반 사례
- 소스코드에서 Phase 구조를 바꾸고 KB/봇 스킬을 업데이트하지 않음 (**→ 봇이 잘못된 답변**)
- KB에 프로세스를 등록하고 봇 SKILL.md에 반영하지 않음 (**→ 봇이 구버전 워크플로우 실행**)
- 봇 이름을 배열로 하드코딩
- 워크스페이스 규칙을 스크립트에 직접 작성 (DB `bot_workspace_standard`가 SoT)
- 서비스 고유 정보를 `semicolon` 조직 도메인에 저장 (해당 서비스 도메인 사용)
- DB 스키마 변경 시 마이그레이션 없이 직접 ALTER

---

## KB 참조 가이드

봇/인프라/프로세스 상세 정보는 KB에서 조회:

| 정보 | 조회 명령 |
|------|-----------|
| 봇 프로필 | `semo kb get {botId} identity` |
| 봇 역할 | `semo kb get {botId} role` |
| 봇 게이트웨이 | `semo kb get {botId} gateway-config` |
| SEMO 데이터 흐름 | `semo kb get semo spec data-flow` |
| SEMO 워크스페이스 규격 | `semo kb get semo spec workspace-v2` |
| SEMO MCP 서버 설정 | `semo kb get semo spec mcp-server-config` |
| OpenClaw 설정 | `semo kb get semo spec openclaw-config` |
| 환경변수 (~/.claude/semo/.env) | `semo kb get semo infra env-config` |
| 복구 명령어 | `semo kb get semo process recovery` |
| 코딩 컨벤션 | `semo kb get semo process coding-convention` |
| 도메인 삭제 | `semo onto unregister <domain> [--force --yes]` |

---

## GFP Slack-First 원칙 (NON-NEGOTIABLE)

> GFP 파이프라인은 **Slack-first, Dashboard-as-visual-companion** 구조.

### 핵심 규칙
1. **PO는 Slack에서 봇과의 대화만으로 전 Phase를 진행** 가능해야 함
2. 진입점: `@SemiClaw 신규서비스 GFP 시작해줘` → Phase 0 온보딩 → 자동 포크
3. 봇이 섹션을 제출하면 Slack에 승인/거절 버튼 포함 알림 발송 (`sendGfpSectionPendingReviewSlack`)
4. **시각적 산출물**(디자인 팔레트, HTML 프로토타입, 다이어그램)은 **Dashboard에서 확인** 필수 → Slack 알림에 "대시보드에서 보기" 버튼 포함
5. **양방향 싱크**: Slack 버튼 클릭 → Dashboard DB 반영 / Dashboard 승인 → Slack 메시지 업데이트
6. Phase 0에서 RPG식 PO 프로파일링(tech_level, design_sensitivity, domain_area 등) 수행 → `metadata.po_profile`에 저장

### 아키텍처
- **공유 액션 레이어**: `lib/gfp-actions.ts` → `executeSectionAction()` — Dashboard와 Slack 양쪽에서 호출
- **Slack Interactivity**: `POST /api/slack/interactions` — 버튼 클릭/모달 제출 핸들러
- **알림 함수**: `sendGfpSectionPendingReviewSlack()` — 승인/거절 액션 버튼 포함
- **사전 조건**: Slack App에 Interactivity Request URL 설정 + `SLACK_SIGNING_SECRET` 환경변수

### 봇 스킬 작성 시 주의
- 섹션 제출 완료 안내 시: "Slack에서 바로 승인/거절 가능합니다. 시각 산출물은 대시보드에서 확인하세요."
- "대시보드에서 검토해주세요"만 안내하면 안 됨 — Slack-first 원칙 위반

---

## Data Routing (NON-NEGOTIABLE)

> PM 테이블(`service_*`)과 KB는 역할이 다르다. 봇은 아래 라우팅 규칙을 반드시 준수.

### 읽기 라우팅
| 정보 | 조회 방법 | 이유 |
|------|-----------|------|
| 프로젝트 실행 상태 (phase, sections, approvals) | PM API: `GET /api/gfp/{id}` | 실시간 워크플로우 상태 |
| 서비스 정체성 (base-info, po, tech-stack) | KB: `semo kb get {service} base-information` | 서비스 메타데이터 SoT |
| 완료된 스펙 (discovery, prd 등) | KB: `semo kb get {service} spec/{phase}` | PM 파이프라인이 자동 동기화 |
| 의사결정/프로세스 | KB: `semo kb get semicolon decision/...` | 조직 지식 SoT |

### 쓰기 라우팅
| 작업 | 쓰기 대상 | 금지 |
|------|-----------|------|
| 섹션 제출/재생성 | PM API: `POST /api/gfp/callback` | KB에 직접 spec/* 쓰기 ✗ |
| 서비스 정보 변경 | KB: `semo kb upsert {service} {key}` | PM 테이블 직접 수정 ✗ |
| 진행 상태 요약 | (자동) PM 파이프라인 → KB projection | 봇이 pm-status 직접 쓰기 ✗ |

### Projection Key (읽기 전용)
아래 KB 키는 PM 파이프라인(`pm-pipeline`)이 자동 동기화. **봇이 직접 쓰면 CLI가 거부:**
- `{service} spec/*` — 승인된 섹션 콘텐츠 자동 합산
- `{service} pm-status` — phase 진행도 자동 업데이트
- `{service} infra-status` — 인프라 트랙 상태
- `{service} pm-summary` — 라이프사이클 요약

### 테이블 매핑 (v045+)
| 기존 (`gfp_*`) | 신규 (`service_*`) | 비고 |
|----------------|--------------------|------|
| `gfp_projects` | `service_projects` | +lifecycle, +launched_at |
| `gfp_phase_sections` | `service_sections` | +iteration_id (ops phase) |
| `gfp_materials` | `service_materials` | |
| `gfp_research_tasks` | `service_research_tasks` | |
| `gfp_infra_requests` | `service_infra_requests` | |
| (신규) | `service_iterations` | 운영 이터레이션 |
| (신규) | `service_incidents` | 운영 인시던트 |

하위 호환 VIEW(`gfp_*`)가 존재하므로 기존 쿼리도 동작. 신규 코드는 `service_*` 사용.

---

## Quality Gate

```bash
npm run lint && npx tsc --noEmit && npm run build
```

`--no-verify` 사용 금지. 브랜치: `dev` (기본, PR 타겟).

### CLI 배포 (팀 전파)

| 패키지 | npm 이름 | 배포 트리거 |
|--------|----------|------------|
| `packages/cli` | `@team-semicolon/semo-cli` | `dev` 브랜치 push 시 자동 배포 |
| `packages/mcp-kb` | `@team-semicolon/semo-mcp-kb` | Git tag `mcp-v*` |

`dev` 브랜치에 커밋 후 push하면 CLI npm 패키지가 자동 배포된다. 별도 태그 불필요.

---

## 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:health` | 환경 헬스체크 |
