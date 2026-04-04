# semo — Claude Configuration

> SEMO v4.4.0 (2026-04-04)

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
- 서비스 KPI → `domain: {serviceName}`, key: `kpi`, sub_key: `{YYYY-MM-DD}`
- 봇 정보 → `domain: {botId}`, key: `identity` / `role` / `gateway-config`
- SEMO 시스템 스펙 → `domain: semo`, key: `spec`, sub_key: `{name}`

#### 네이밍 컨벤션 (NON-NEGOTIABLE)
- **도메인, key, sub_key 모두 kebab-case** 사용: `base-information`, `slack-channel`, `tech-stack`
- **snake_case 금지**: `base_information` ✗ → `base-information` ✓
- 단일 단어는 그대로: `status`, `po`, `bm`, `repo`, `kpi`

#### 도메인 구조
| 패턴 | 예시 | 용도 |
|------|------|------|
| `semicolon` | `semicolon` | 조직 공통 — decision/process/infra 하위 키 |
| `{service}` | `semo`, `axoracle` | 서비스 고유 — base-information/status/spec/kpi 하위 키 |
| `{botId}` | `semiclaw`, `workclaw` | 봇 프로필 — identity/role/gateway-config 하위 키 |

**답변근거 표기**: KB 기반 답변 첫 줄에 출처 명시 — `[답변근거: KB {domain} {key}]`

**금지:** 위 주제를 자체 지식/세션 기억만으로 답변하는 것.
KB에 없으면: "KB에 해당 정보가 없습니다. 알려주시면 등록하겠습니다."

### 쓰기 (Write-Back) — 자동 KB 기록

다음 상황 발생 시 **사용자 지시 없이도** 즉시 `semo kb upsert`로 KB에 기록:

| 트리거 | KB 경로 |
|--------|---------|
| 의사결정/합의 | `semicolon decision/{date}/{slug}` |
| 프로세스/규칙 변경 | `semicolon process/{slug}` |
| 인프라 정책 변경 | `semicolon infra/{name}` |
| 서비스 상태/정보 변경 | `{service} {key}` |
| 팀원 정보 정정/추가 | `{member} {key}` |

- **쓰기 대상 고지**: upsert 전 대상 명시 — `[KB 기록: {domain} {key} — 생성|수정]`
- **금지:** "알겠습니다/기억하겠습니다"만 하고 KB에 쓰지 않는 것.

---

## Quality Gate

`npm run lint && npx tsc --noEmit && npm run build` — `--no-verify` 금지. 브랜치: `dev`.

---

## 상세 규칙 (필요 시 참조)

코드/프로세스/스펙 변경 시 → `.claude/rules/sync-checklist.md` (3자 동기화)
GFP 파이프라인 작업 시 → `.claude/rules/gfp-slack-first.md` (Slack-First 원칙)
PM 데이터 읽기/쓰기 시 → `.claude/rules/data-routing.md` (Data Routing)
KB 상세 조회 경로 → `.claude/rules/kb-reference.md` (조회 명령 테이블)
빌드/배포 상세 → `.claude/rules/quality-gate.md` (CLI 배포 포함)

---

## 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:health` | 환경 헬스체크 |
