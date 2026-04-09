# Data Routing (NON-NEGOTIABLE)

> PM 테이블(`services`, `service_*`)과 KB는 역할이 다르다. 봇은 아래 라우팅 규칙을 반드시 준수.

## 읽기 라우팅
| 정보 | 조회 방법 | 이유 |
|------|-----------|------|
| 서비스 구조화 메타 (status, po, tech-stack, url, repo, slack, BM) | DB: `semo service get {domain}` | **services 테이블이 SoT** (v070+) |
| 프로젝트 실행 상태 (phase, sections, approvals) | PM API: `GET /api/projects/{id}` | 실시간 워크플로우 상태 |
| 서비스 자유형 지식 (base-info, 소개, 현황) | KB: `semo kb get {service} base-information` | 자유형 마크다운 |
| 완료된 스펙 (discovery, prd 등) | KB: `semo kb get {service} spec/{phase}` | PM 파이프라인이 자동 동기화 |
| 의사결정/프로세스 | KB: `semo kb get semicolon decision {slug}` | 조직 지식 SoT |
| 인시던트/장애 기록 | KB: `semo kb get {service} incident {slug}` | 서비스별 장애 이력 |

## 쓰기 라우팅
| 작업 | 쓰기 대상 |
|------|-----------|
| 서비스 구조화 메타 변경 (status, tech-stack, url, repo 등) | DB: `semo service update --domain {domain} ...` |
| 섹션 제출/재생성 | PM API: `POST /api/projects/callback` |
| 서비스 자유형 지식 변경 (base-info, decision, process 등) | KB: `semo kb upsert {service} {key}` |
| 인시던트/장애 기록 | KB: `semo kb upsert {service} incident {slug} --metadata '{"occurred_at":"...","severity":"...","status":"..."}'` |
| 진행 상태 요약 | (자동) PM 파이프라인 → KB projection |

> **v070+**: `status`, `po`, `tech-stack`, `service-url`, `bm`, `repo`, `slack-channel`은 KB 스키마에서 제거됨. `semo kb upsert`로 이 키에 쓰기 시도하면 거부됨.

## Projection Key (읽기 전용)
아래 KB 키는 PM 파이프라인(`pm-pipeline`)이 자동 동기화. 읽기만 가능하며 CLI가 직접 쓰기를 거부한다:
- `{service} spec/*` — 승인된 섹션 콘텐츠 자동 합산
- `{service} pm-status` — phase 진행도 자동 업데이트
- `{service} infra-status` — 인프라 트랙 상태
- `{service} pm-summary` — 라이프사이클 요약

## 모듈 도메인 라우팅 (v067+)
SEMO 플랫폼 하위 모듈(`module` 타입)은 자체 KB 도메인을 가진다. `parent` 컬럼으로 상위 서비스와 연결.

| 정보 | 조회 방법 | 이유 |
|------|-----------|------|
| 모듈 개요 (인큐베이터, 보이스 등) | KB: `semo kb get {module} base-information` | 모듈 자체 도메인이 SoT |
| 모듈 기능 스펙/레퍼런스 | KB: `semo kb get {module} spec/{feature}` 또는 `reference/{feature}` | projection 아님, 수동 관리 |
| 모듈 의사결정 | KB: `semo kb get {module} decision {slug}` | 모듈 레벨 의사결정 |
| 상위 서비스 → 모듈 탐색 | `semo kb ontology --action children --domain {service}` | parent 계층 조회 |

현재 등록된 모듈: `semo-incubator` (parent: `semo`). 향후: `semo-voice`, `semo-meeting`, `semo-agents`.

## DB 전용 데이터 타입 (v069+)

아래 데이터는 **KB가 아닌 전용 DB 테이블**이 SoT. `semo kb`로 접근하면 guard가 차단한다.

| 데이터 타입 | SoT 테이블 | 읽기 | 쓰기 |
|------------|-----------|------|------|
| 액션 아이템 | `action_items` | `semo action-items list [--owner {domain}] [--status open]` | `semo action-items create --owner {domain} --description "..."` |
| 커밋먼트 | `bot_commitments` | `semo commitments list [--bot-id {botId}]` | `semo commitments create --bot-id {botId} --title "..."` |
| KPI 메트릭 | `service_kpi_metrics` | `GET /api/projects/{id}/kpi-metrics` | KB upsert → 자동 DB sync |

**`semo kb`로 접근하면 안 되는 키**: `action-item` (kb_type_schema에서 제거됨)

## 테이블 매핑 (v052+)
| 테이블 | 설명 |
|--------|------|
| `services` | 서비스 정의 (PK: service_id) |
| `service_sections` | 섹션 (FK: service_id) |
| `service_materials` | 자료 (FK: service_id) |
| `service_research_tasks` | 리서치 (FK: service_id) |
| `service_infra_requests` | 인프라 요청 (FK: service_id) |
| `service_iterations` | 운영 이터레이션 (FK: service_id) |
| `service_incidents` | 운영 인시던트 (FK: service_id) |

레거시 하위 호환 VIEW(`gfp_*`, `service_projects`)가 존재하므로 기존 쿼리도 동작. 신규 코드는 `services` 사용. (VIEW는 추후 제거 예정)
