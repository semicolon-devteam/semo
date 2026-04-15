# Data Routing (NON-NEGOTIABLE)

> v100+: `services`, `service_*` 13개 테이블은 KB로 이식 완료. 모든 서비스 데이터의 SoT는 KB.
> 봇은 아래 라우팅 규칙을 반드시 준수.

## 읽기 라우팅
| 정보 | 조회 방법 | 이유 |
|------|-----------|------|
| 서비스 구조화 메타 (status, po, tech-stack, url, repo, slack, BM) | KB: `semo kb get {domain} pipeline/config` 또는 `semo service get {domain}` | **KB pipeline/config가 SoT** |
| 서비스 분류/계층 (service_type, parent) | KB: `semo kb get {domain} pipeline/config` → metadata.service_type, parent_service_id | KB 메타데이터 |
| 프로젝트 실행 상태 (phase, sections) | KB: `semo kb get {domain} pipeline/config` → metadata.current_phase + section/* 키 조회 | KB 기반 워크플로우 |
| 서비스 자유형 지식 (base-info, 소개, 현황) | KB: `semo kb get {service} base-information` | 자유형 마크다운 |
| 완료된 스펙 (discovery, prd 등) | KB: `semo kb get {service} spec/{phase}` | PM 파이프라인이 자동 동기화 |
| 섹션 콘텐츠 | KB: `semo kb get {service} section/{track}/{phase}/{key}` | 파이프라인 섹션 |
| 기능 카탈로그 | KB: `semo kb get {service} feature/{slug}` | 기능별 스펙+상태 |
| 산출물 | KB: `semo kb get {service} material/{id}` | 기획서, 디자인 export |
| 의사결정/프로세스 | KB: `semo kb get semicolon decision {slug}` | 조직 지식 SoT |
| 인시던트/장애 기록 | KB: `semo kb get {service} incident {slug}` | 서비스별 장애 이력 |

## 쓰기 라우팅
| 작업 | 쓰기 대상 |
|------|-----------|
| 서비스 메타 변경 (status, tech-stack, phase 등) | KB: `semo service update --domain {domain} ...` (→ pipeline/config 업데이트) |
| 섹션 제출/재생성 | PM API: `POST /api/projects/callback` |
| 서비스 자유형 지식 변경 | KB: `semo kb upsert {service} {key}` |
| 인시던트/장애 기록 | KB: `semo kb upsert {service} incident {slug} --metadata '{"occurred_at":"...","severity":"...","status":"..."}'` |
| 진행 상태 요약 | (자동) PM 파이프라인 → KB projection |

## KB 키 매핑 (v100+)

서비스 데이터는 모두 KB `(domain, key, sub_key)` 구조:

| 키 | 타입 | source | 설명 |
|----|------|--------|------|
| `pipeline/config` | singleton | pipeline | 프로젝트 워크플로우 상태 (phase, lifecycle, metadata 등) |
| `section/{track}/{phase}/{key}` | collection | pipeline | 파이프라인 섹션 콘텐츠 + 상태 |
| `feature/{uuid}` | collection | pipeline | 기능 카탈로그 |
| `material/{uuid}` | collection | manual | 산출물 (기획서, Stitch export) |
| `iteration/{uuid}` | collection | manual | 운영 이터레이션 |
| `incident/{slug}` | collection | manual | 인시던트 |
| `infra-request/{uuid}` | collection | pipeline | 인프라 요청 |
| `research/{uuid}` | collection | pipeline | 리서치 태스크 |
| `session/{type}/{uuid}` | collection | pipeline | 대화 세션 (discovery, conversation) |
| `deploy-verify/{phase}/{date}` | collection | pipeline | 배포 검증 결과 |
| `spec/*` | collection | projection | 승인된 섹션 자동 합산 |
| `pm-status` | singleton | projection | phase 진행도 자동 업데이트 |
| `infra-status` | singleton | projection | 인프라 트랙 상태 |
| `pm-summary` | singleton | projection | 라이프사이클 요약 |
| `base-information` | singleton | manual | 서비스 기본 설명 |
| `role/*` | collection | manual | 역할 매핑 (po, lead-dev 등) |

## Projection Key (읽기 전용)
`spec/*`, `pm-status`, `infra-status`, `pm-summary`는 PM 파이프라인이 자동 동기화. CLI 직접 쓰기 거부.

## 모듈 도메인 라우팅 (v067+)
SEMO 플랫폼 하위 모듈(`module` 타입)은 자체 KB 도메인을 가진다. `parent` 컬럼으로 상위 서비스와 연결.

| 정보 | 조회 방법 | 이유 |
|------|-----------|------|
| 모듈 개요 | KB: `semo kb get {module} base-information` | 모듈 자체 도메인이 SoT |
| 모듈 기능 스펙 | KB: `semo kb get {module} spec/{feature}` | 수동 관리 |
| 모듈 의사결정 | KB: `semo kb get {module} decision {slug}` | 모듈 레벨 |
| 상위 서비스 → 모듈 탐색 | `semo kb ontology --action children --domain {service}` | parent 계층 조회 |

현재 등록된 모듈: `semo-incubator` (parent: `semo`).

## DB 전용 데이터 타입 (v069+)

아래 데이터는 **KB가 아닌 전용 DB 테이블**이 SoT:

| 데이터 타입 | SoT 테이블 | 읽기 | 쓰기 |
|------------|-----------|------|------|
| 액션 아이템 | `action_items` | `semo action-items list [--owner {domain}]` | `semo action-items create --owner {domain} --description "..."` |
| 커밋먼트 | `bot_commitments` | `semo commitments list [--bot-id {botId}]` | `semo commitments create --bot-id {botId} --title "..."` |
| KPI 메트릭 | **KB metadata** | `semo kb get {domain} kpi/{YYYY-MM-DD}` | `semo kb upsert {domain} kpi/{YYYY-MM-DD} --metadata '{"metrics":[...]}'` |
| 회의 | `meetings` | target_domain (ontology FK) 기반 | — |

## 삭제된 테이블 (v097-v101)

아래 테이블은 KB로 이식 완료 후 삭제됨. 코드에서 직접 참조 금지:
- `services` → KB `pipeline/config`
- `service_sections` → KB `section/*`
- `service_materials` → KB `material/*`
- `service_features` → KB `feature/*`
- `service_iterations` → KB `iteration/*`
- `service_incidents` → KB `incident/*`
- `service_infra_requests` → KB `infra-request/*`
- `service_research_tasks` → KB `research/*`
- `feature_discovery_sessions` → KB `session/discovery/*`
- `feature_conversation_sessions` → KB `session/conversation/*`
- `deploy_verifications` → KB `deploy-verify/*`
- `feature_status_transitions` → feature metadata `transitions[]`
- `service_kpi_metrics` → KB `kpi/*`

레거시 VIEW(`gfp_*`, `service_projects`)도 삭제됨.

## 서비스 역할 매핑 (v072+)

서비스별 역할은 `role` collection 키로 관리:
```
semo kb upsert {service} role/po --content "{team-domain}"
semo kb upsert {service} role/lead-dev --content "{team-domain}"
```

| 표준 역할명 | 설명 |
|------------|------|
| `po` | 프로젝트 오너 |
| `lead-dev` | 리드 개발자 |
| `backend` | 백엔드 개발 |
| `frontend` | 프론트엔드 개발 |
| `designer` | 디자이너 |
| `ops` | 운영/인프라 |
| `planner` | 기획자 |

## KB 쓰기 전 스키마 확인 (NON-NEGOTIABLE)

KB에 새 엔트리를 쓸 때 키를 추측하지 않는다.
1. `semo kb ontology --action schema --type {entity_type}` 으로 허용 키 목록 확인
2. collection 키는 value_hint의 sub_key 형태를 따른다
3. 스키마에 없는 키는 upsert가 차단된다
