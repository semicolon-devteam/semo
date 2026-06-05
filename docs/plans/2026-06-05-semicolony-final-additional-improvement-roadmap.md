# semicolony 최종 추가 개선 로드맵 — schema flip + multitenant gateway + product facade

- 작성일: 2026-06-05
- 상태: 실행 로드맵. 라이브 flip은 미실행.
- 관련 KB:
  - `semicolony/decision/schema-rebrand-copy-cutover-prep-2026-06-05`
  - `semicolony/decision/product-facade-workitem-relation-graph-phase1-2026-06-05`
  - `semicolony/decision/semicolony-kb-access-via-multitenant-api-gateway`
  - `semicolony/decision/semicolony-gateway-tenancy-auth-persona-resolved`
- 관련 코드/문서:
  - `docs/plans/2026-06-04-semicolony-rebrand-status-and-remaining.md`
  - `docs/superpowers/specs/2026-06-05-semicolony-multitenant-kb-gateway.md`
  - `packages/cli/migrations/128_entity_relations.sql`
  - `packages/cli/migrations/129_kb_multitenant_gateway.sql`
  - `scripts/clone-schema-semo-to-semicolony.mjs`
  - `scripts/check-semicolony-schema-flip-preflight.mjs`

## 1. 결론

세 갈래는 별개가 아니라 같은 제품화 축의 층위다.

1. **schema flip**은 내부 저장소 이름을 `semicolony`로 전환하는 substrate 작업이다. 코드/러너는 준비됐지만, 실제 flip은 유지보수창에서만 한다.
2. **multitenant KB gateway**는 외부 Colony/고객 runtime이 중앙 DB에 직접 붙지 않게 하는 API boundary다. 이 경계가 tenant 인증, KB 쓰기, persona fetch, embedding을 단일화한다.
3. **product facade graph**는 내부 KB/ontology/action_items/bot_commitments를 고객이 이해하는 업무 모델로 감싸는 semantic layer다. dashboard v5는 이 layer를 렌더링해야 한다.

따라서 최종 방향은 다음이다.

> `semicolony` schema를 안정 substrate로 flip-ready 상태에 두고, tenant gateway를 외부 API boundary로 세운 뒤, 그 위에 WorkItem/Relation/Approval facade를 얹어 dashboard v5와 Colony runtime이 같은 제품 객체를 보게 한다.

## 2. 현재 상태

### 2.1 Schema flip

완료된 것:

- `semo` -> `semicolony` schema copy 스크립트 존재.
- backend/dashboard는 `SEMICOLONY_DB_SCHEMA ?? SEMO_DB_SCHEMA ?? 'semo'` 패턴으로 cutover-prep 완료.
- migration runner는 `retargetSchemaSql()`로 `semo.` schema-qualified SQL을 활성 schema로 재작성한다.
- rollback은 env 한 줄 제거로 가능하다.

이번 점검에서 추가한 것:

- `scripts/check-semicolony-schema-flip-preflight.mjs` 추가.
- 이 스크립트는 read-only로 다음을 검사한다.
  - `semo`/`semicolony` schema 존재
  - `schema_migrations` parity
  - disk migration pending 여부
  - table row-count parity
  - table/view/sequence/function/trigger/FK object-count parity
  - runtime env가 아직 `semo`인지, 이미 `semicolony`인지

현재 preflight 결과:

- DB 연결/read-only 검사는 성공.
- `schema_migrations` parity는 134/134로 일치.
- 하지만 disk 기준 신규 migration `128_entity_relations`, `129_kb_multitenant_gateway`가 source/target 모두 pending.
- copy 이후 live write로 row-count drift가 있다. 예: `action_items`, `bot_commitments`, `knowledge_base`, `knowledge_base_history` 등.
- 따라서 **지금 즉시 flip은 금지**다. 유지보수창 직전 additive migration 적용과 `clone --reset` delta 재동기 후 preflight 0 failure가 필요하다.

### 2.2 Multitenant KB gateway

완료/진행 중인 것:

- migration 129: `knowledge_base.tenant_id`, `knowledge_base.scope`, `gateway_credentials` 추가.
- CLI: `semo gateway issue-key|rotate-key|revoke-key|list-keys`.
- Gateway: Bearer tenant auth + 기존 HMAC internal auth dual path.
- Tenant KB: tenant write는 `domain=t-{tenantSlug}`, `tenant_id`, `scope='tenant-local'` 강제.
- Persona: `/persona/resolve`가 `agent_personas`를 gateway 경유로 제공.

이번 점검에서 보강한 것:

- tenant search의 `platform-global` 누출 위험을 차단했다.
- migration 129 직후 기존 KB 행은 모두 `scope='platform-global'`이므로, `scope`만으로 tenant search에 포함하면 내부 SEMO KB가 외부 tenant에 노출된다.
- 검색 공유 범위를 `metadata.tenant_visible = true` allowlist로 좁혔다.
- `ownOnly=true`인 검색은 platform-global을 완전히 제외한다.
- migration 129의 CHECK constraint 존재 확인을 `conname` 단독이 아니라 `conrelid = 'semo.knowledge_base'::regclass`로 scope했다. schema retarget 후 cross-schema constraint 오판을 막기 위함이다.

### 2.3 Product facade graph

완료/진행 중인 것:

- `ProductWorkItem` read model 추가.
- `action_items`는 `plan`, `bot_commitments`는 `in-flight`로 분리했다.
- migration 128: `relation_types`, `entity_relations`, `v_entity_relations_live` 추가.
- relation은 `tenant_id`, `scope`, `source_ref`, `target_ref`, `relation_type`, `status`, `confidence`, `provenance`, `acl`, temporal validity를 가진다.
- live projection은 `status='approved'`이고 temporal window가 유효한 relation만 노출한다.

남은 것:

- 아직 facade는 read-model과 schema foundation만 있다.
- onboarding extraction -> proposed relation -> approval -> approved relation -> dashboard/runtime 반영 루프는 다음 phase다.
- agent activity는 새 write path가 아니라 commitments/sessions/mailbox audit의 read projection으로 가야 한다.

## 3. 세 갈래가 맞물리는 방식

### 3.1 공통 tenant/scope 계약

`128_entity_relations`와 `129_kb_multitenant_gateway`는 같은 tenant/scope 계약을 써야 한다.

- tenant-local: 반드시 `tenant_id` 필요.
- platform-global: 기본적으로 내부/공유 후보일 뿐, 외부 tenant read 허용을 의미하지 않는다.
- 외부 tenant에게 공개할 platform-global KB는 `metadata.tenant_visible=true` 같은 명시 allowlist가 있어야 한다.
- relation graph도 같은 원칙으로, `platform-global` relation은 marketplace/library/template 같은 검수된 public asset에만 써야 한다.

### 3.2 Gateway는 execution boundary, facade는 product contract

Gateway가 해결하는 것:

- 외부 Colony가 DB credential을 알지 않는다.
- tenant credential 발급/회전/폐기가 중앙화된다.
- tenant KB write가 항상 tenant-local로 강제된다.
- persona fetch가 DB 직결이 아니라 API 경유가 된다.

Facade graph가 해결하는 것:

- 고객 UI와 agent prompt가 내부 ontology/KB 원시 구조를 직접 보지 않는다.
- 업무 상태는 `plan`과 `in-flight`로 분리된다.
- entity/relation은 승인 전 `proposed`, 승인 후 `approved`로 lifecycle을 가진다.
- dashboard v5는 KB 문서 목록이 아니라 WorkItem, Agent, Relation, Approval, Activity를 렌더링한다.

### 3.3 Schema flip은 마지막 substrate switch

Schema flip은 제품 기능이 아니라 운영 substrate 전환이다.

- gateway와 facade 모두 `DB_SCHEMA` parameterization 위에서 동작해야 한다.
- 128/129 같은 신규 migration은 flip 전에 `semo` source에 적용되고, `clone --reset`으로 `semicolony` target에 반영되어야 한다.
- flip 후 신규 migration은 runner retarget을 통해 `semicolony`에 적용된다.
- flip 전후 어느 시점에도 source/target이 동시에 write source가 되면 안 된다.

## 4. 우선순위

### P0 — 외부 tenant 노출 전 차단선

1. `tenant-search platform-global` 누출 차단을 유지한다.
   - tenant search는 자기 tenant + `metadata.tenant_visible=true` platform-global만 반환.
   - 기존 내부 KB는 `scope='platform-global'`이어도 tenant-visible이 아니므로 미노출.
2. migration 129 constraint check는 table-scoped로 유지한다.
3. gateway credential 발급 명령은 token plaintext를 1회만 출력하고 `list-keys`는 prefix만 노출한다.
4. preflight script를 flip gate로 문서화한다.
5. 128/129 migration은 live flip 전에 source schema에 적용하고 target은 `clone --reset`으로 재동기한다.

### P1 — 유지보수창 schema flip

유지보수창 절차:

```bash
# 0. DB env 로드
set -a && source ~/.claude/semo/.env && set +a

# 1. source schema에 pending additive migration 적용 여부 확인
semo db migrate --dry-run

# 2. 필요 시 128/129 등 additive migration 적용
semo db migrate

# 3. target 재동기. 이 시점 전까지 semicolony target write source는 없어야 한다.
node scripts/clone-schema-semo-to-semicolony.mjs --reset

# 4. read-only gate. failure 0이어야 한다.
node scripts/check-semicolony-schema-flip-preflight.mjs

# 5. env flip
# SEMICOLONY_DB_SCHEMA=semicolony

# 6. router/cron/kb-gateway/dashboard 재기동 및 smoke
```

Rollback:

- `SEMICOLONY_DB_SCHEMA` 제거 또는 `semo`로 복귀.
- 동일 서비스 재기동.
- target schema는 보존해도 된다. 필요 시 다음 유지보수창에 다시 `clone --reset`.

### P2 — Gateway provisioning + dashboard v5 render

1. `customer-runtime` install/projection 단계에서 gateway key 발급을 연결한다.
2. Colony runtime env에 `SEMICOLONY_API_URL`, `SEMICOLONY_API_KEY`, agent slug를 주입한다.
3. dashboard v5는 다음 read model을 우선 렌더링한다.
   - Agent install/status: `agent_installs` -> `bot_status` projection
   - WorkItem: `action_items(plan)` + `bot_commitments(in-flight)`
   - Activity: commitments/sessions/mailbox audit projection
   - KB: tenant-local docs + tenant-visible shared docs
4. 외부 tenant 화면에서 내부 SEMO domain/key가 노출되지 않게 domain label을 product object로 변환한다.

### P3 — Relation approval loop

1. onboarding/대화/문서에서 entity/relation 후보를 추출한다.
2. 모든 추출 relation은 `status='proposed'`로만 저장한다.
3. dashboard에서 entity별 approve/edit/reject/re-extract를 제공한다.
4. 승인된 relation만 `v_entity_relations_live`에 노출한다.
5. rollback은 relation status 또는 temporal validity로 처리한다.

### P4 — Defense in depth

1. Postgres RLS를 tenant-local KB/relation에 추가한다.
2. gateway query-layer enforcement와 RLS가 같은 결과를 내는 parity test를 둔다.
3. tenant credential audit/last_used_at update와 abuse rate limit을 추가한다.
4. active install runtime propagation은 별도 phase로 둔다. facade가 즉시반영을 약속하지 않는다.

## 5. 주요 리스크와 완화

| 리스크                                    | 영향                                      | 완화                                                                  |
| ----------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `platform-global` 전체 tenant search 노출 | 내부 KB 외부 노출 critical                | `metadata.tenant_visible=true` allowlist. 기본 미노출.                |
| 128/129 pending 상태에서 schema flip      | target schema가 새 계약을 모름            | source migrate -> clone reset -> preflight 0 failure 후 flip.         |
| copy 이후 row-count drift                 | flip 직후 데이터 누락                     | 유지보수창 직전 `clone --reset`; target write freeze.                 |
| clone reset이 target-only write 삭제      | 이미 semicolony로 쓰는 서비스 데이터 유실 | flip 전에는 target write source 금지. preflight에서 runtime env 확인. |
| migration 129 constraint 이름 충돌        | target constraint 미생성 가능             | `conrelid` scoped check.                                              |
| gateway token 유출                        | tenant KB write 권한 탈취                 | hash 저장, prefix-only list, rotate/revoke, scopes 최소화, 만료 권장. |
| dashboard v5가 내부 domain/key 노출       | 제품 abstraction 깨짐                     | facade read model만 UI 계약으로 사용.                                 |
| relation graph 무승인 적용                | 잘못 추출된 관계가 runtime에 반영         | proposed 기본값, approved live view, reversible temporal validity.    |

## 6. Acceptance gate

라이브 flip 전 필수:

- `npm test --workspace=@team-semicolon/semo-kb-gateway` 통과.
- `npx tsc --noEmit -p packages/kb-gateway/tsconfig.json` 통과.
- `node scripts/check-semicolony-schema-flip-preflight.mjs` failure 0.
- `semo db migrate --dry-run` pending 0.
- router/kb-gateway/dashboard가 모두 `SEMICOLONY_DB_SCHEMA=semicolony` 환경으로 재기동 가능한 유지보수창 확보.
- rollback 명령과 담당자 확정.

외부 tenant pilot 전 필수:

- tenant search가 tenant-local + tenant-visible shared만 반환하는 테스트 유지.
- platform-global shared KB seed는 별도 검수/allowlist migration으로만 추가.
- gateway key issue/rotate/revoke smoke.
- persona resolve가 own `ag-{tenantSlug}-*`만 허용하는 smoke.

## 7. 다음 액션

1. 128/129를 source schema에 적용할지 여부를 유지보수창 계획에 포함한다. 둘 다 additive지만, flip gate에 걸리므로 적용 순서가 필요하다.
2. 적용 후 `clone-schema-semo-to-semicolony.mjs --reset`을 실행하고 preflight 0 failure를 확인한다.
3. gateway를 외부 노출하기 전 tenant-visible shared KB seed 정책을 별도 decision으로 확정한다.
4. dashboard v5에서 WorkItem facade를 우선 렌더링하고, relation approval UI는 다음 phase로 분리한다.
5. customer provisioning에서 gateway key 발급과 Colony env 주입을 연결한다.
