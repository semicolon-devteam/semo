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

### 쓰기 (Write-Back)
다음 상황 → **반드시 `semo kb upsert`로 KB에 즉시 기록:**
- 사용자가 팀 정보를 정정하거나 새 사실을 알려줄 때
- 의사결정이 내려졌을 때
- 프로세스/규칙이 변경되었을 때
- **쓰기 대상 고지**: upsert 전 대상 명시 — `[KB 기록: {domain} {key} — 생성|수정]`

**금지:** "알겠습니다/기억하겠습니다"만 하고 KB에 쓰지 않는 것.

---

## 3자 동기화 검증 규칙 (NON-NEGOTIABLE)

> 이 프로젝트의 모든 변경은 3자 동기화 관점에서 평가되어야 한다.

### 변경 전 체크리스트

1. **SoT 위치**: DB 테이블 → DB에서 읽기 (하드코딩 금지). KB → `semo kb get/search` 조회.
2. **동기화 영향**: CLI만/CLI+봇/DB 스키마/봇 워크스페이스 규격 중 어디에 영향?
3. **하드코딩 금지**: 봇 목록 → `bot_status` DB. 도메인 → `ontology` DB. 워크스페이스 규격 → `bot_workspace_standard` DB.
4. **봇 워크스페이스 파일 수정 시**: SOUL.md, MEMORY.md 등 봇 파일을 수정하기 전에 반드시 `bot_workspace_standard`에서 해당 파일의 `content_rules`(max_lines, required_sections, forbidden_patterns)를 확인하고, 수정 후 규격 위반이 없는지 검증할 것.
5. **KB 데이터 쓰기 시**: 반드시 `semo kb upsert` CLI 또는 `kbUpsert()` 함수를 사용 (임베딩 + 도메인/스키마 검증 포함). raw SQL INSERT 금지.
6. **검증**: `semo test run workspace-audit` / `semo test run 018-transplant` / KB 도구 호출 테스트.

### 위반 사례
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
