# Data Routing (NON-NEGOTIABLE)

> PM 테이블(`services`, `service_*`)과 KB는 역할이 다르다. 봇은 아래 라우팅 규칙을 반드시 준수.

## 읽기 라우팅
| 정보 | 조회 방법 | 이유 |
|------|-----------|------|
| 프로젝트 실행 상태 (phase, sections, approvals) | PM API: `GET /api/projects/{id}` | 실시간 워크플로우 상태 |
| 서비스 정체성 (base-info, po, tech-stack) | KB: `semo kb get {service} base-information` | 서비스 메타데이터 SoT |
| 완료된 스펙 (discovery, prd 등) | KB: `semo kb get {service} spec/{phase}` | PM 파이프라인이 자동 동기화 |
| 의사결정/프로세스 | KB: `semo kb get semicolon decision {slug}` | 조직 지식 SoT |
| 인시던트/장애 기록 | KB: `semo kb get {service} incident {slug}` | 서비스별 장애 이력 |

## 쓰기 라우팅
| 작업 | 쓰기 대상 |
|------|-----------|
| 섹션 제출/재생성 | PM API: `POST /api/projects/callback` |
| 서비스 정보 변경 | KB: `semo kb upsert {service} {key}` |
| 인시던트/장애 기록 | KB: `semo kb upsert {service} incident {slug} --metadata '{"occurred_at":"...","severity":"...","status":"..."}'` |
| 진행 상태 요약 | (자동) PM 파이프라인 → KB projection |

## Projection Key (읽기 전용)
아래 KB 키는 PM 파이프라인(`pm-pipeline`)이 자동 동기화. 읽기만 가능하며 CLI가 직접 쓰기를 거부한다:
- `{service} spec/*` — 승인된 섹션 콘텐츠 자동 합산
- `{service} pm-status` — phase 진행도 자동 업데이트
- `{service} infra-status` — 인프라 트랙 상태
- `{service} pm-summary` — 라이프사이클 요약

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
