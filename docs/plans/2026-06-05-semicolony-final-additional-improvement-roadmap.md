# semicolony 최종 추가 개선 로드맵 — schema flip + multitenant gateway + product facade

- 작성일: 2026-06-05
- 갱신일: 2026-06-05
- 상태: gateway Phase 1 live verified, product facade foundation committed, schema flip pending.
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

세 갈래는 같은 제품화 축의 서로 다른 층위다.

1. **Schema flip**은 내부 저장소 이름을 `semicolony`로 전환하는 substrate 작업이다. 코드는 flip-ready지만, 실제 flip은 유지보수창에서만 한다.
2. **Multitenant KB gateway**는 외부 Colony/고객 runtime이 중앙 DB에 직접 붙지 않게 하는 API boundary다. Phase 1은 live DB에서 검증됐고, 이미지 배포만 남았다.
3. **Product facade graph**는 내부 KB/ontology/action_items/bot_commitments를 고객이 이해하는 업무 모델로 감싸는 semantic layer다. dashboard v5는 이 layer를 렌더링해야 한다.

최종 방향은 다음이다.

> `semo` source schema에서 gateway/facade를 먼저 안정화하고, 유지보수창 직전 `semicolony` target을 `clone --reset`으로 재동기한 뒤, preflight 0 failure일 때만 `SEMICOLONY_DB_SCHEMA=semicolony`로 flip한다.

## 2. 현재 상태

### 2.1 Schema flip

완료된 것:

- `semo` -> `semicolony` schema copy 스크립트 존재.
- backend/dashboard는 `SEMICOLONY_DB_SCHEMA ?? SEMO_DB_SCHEMA ?? 'semo'` 패턴으로 cutover-prep 완료.
- migration runner는 `retargetSchemaSql()`로 `semo.` schema-qualified SQL을 활성 schema로 재작성한다.
- rollback은 env 한 줄 제거로 가능하다.
- `scripts/check-semicolony-schema-flip-preflight.mjs`가 read-only flip gate로 추가됐다.

2026-06-05 최신 preflight 결과:

- runtime env는 아직 `semo`로 해소된다. flip은 미실행이다.
- source `semo` schema는 128/129 적용 완료, disk 기준 pending 0.
- target `semicolony` schema는 아직 128/129가 pending이다.
- target에는 `entity_relations`, `relation_types`, `gateway_credentials`가 없다.
- copy 이후 live write drift가 있다. 예: `knowledge_base`, `knowledge_base_history`, `bot_commitments`, `action_items`, `agent_personas`, `ontology_types` 등.
- object-count parity도 깨져 있다. tables/views/functions/triggers/FKs가 target에서 뒤처진다.

따라서 **지금 즉시 flip은 금지**다. 하지만 블로커 성격은 바뀌었다. 이제 남은 일은 source migration 적용이 아니라 **유지보수창 직전 target 재동기**다.

### 2.2 Multitenant KB gateway

완료된 것:

- migration 129 live 적용: `knowledge_base.tenant_id`, `knowledge_base.scope`, `gateway_credentials`, CHECK 2종, `idx_kb_tenant`.
- `ontology.entity_type -> ontology_types(type_key)` FK 때문에 `tenant-kb` ontology type seed를 migration 129에 추가했고 live DB에도 적용했다.
- CLI: `semo gateway issue-key|rotate-key|revoke-key|list-keys`.
- Gateway: Bearer tenant auth + 기존 HMAC internal auth dual path.
- Tenant KB: tenant write는 `domain=t-{tenantSlug}`, `tenant_id`, `scope='tenant-local'` 강제.
- Persona: `/persona/resolve`가 `agent_personas`를 gateway 경유로 제공.
- Tenant search는 `tenant-local` + `metadata.tenant_visible='true'` platform-global allowlist만 반환한다.
- `own_only` 검색은 platform-global을 완전히 제외한다.
- provisioning wiring: `customer-runtime.createPlainAgent()`가 install 시 `ensureTenantGatewayCredential()`을 호출한다.

검증된 것:

- live E2E 13/13 PASS: upsert, get/search 격리, client domain 무시, persona 교차 차단, scope 403, invalid 401, revoke 401, cleanup 0.
- CLI live smoke PASS: issue-key -> list-keys -> revoke-key -> list-keys.
- provisioning ensure live PASS: 첫 호출 발급, 둘째 호출 idempotent skip, active=1, cleanup 0.
- `kb-gateway` tsc clean + vitest 40/40.
- CLI tsc 0 + eslint clean.

남은 것:

- Dockerfile은 작성됐지만 이 환경에서 Docker daemon이 미가동이라 image build/health 검증은 못 했다.
- 팀 전역 `semo` CLI에는 아직 새 gateway 명령 전파가 필요하다. 현재 검증은 repo source CLI 기준이다.
- 외부 노출은 `KB_GATEWAY_HOST=0.0.0.0` + ingress TLS + secret injection을 배포 파이프라인에서 확인해야 한다.

### 2.3 Product facade graph

완료된 것:

- `ProductWorkItem` read model 추가.
- `action_items`는 `plan`, `bot_commitments`는 `in-flight`로 분리했다.
- migration 128 live 적용: `relation_types`, `entity_relations`, `v_entity_relations_live`.
- relation은 `tenant_id`, `scope`, `source_ref`, `target_ref`, `relation_type`, `status`, `confidence`, `provenance`, `acl`, temporal validity를 가진다.
- live projection은 `status='approved'`이고 temporal window가 유효한 relation만 노출한다.

남은 것:

- 아직 facade는 read-model과 schema foundation 중심이다.
- onboarding extraction -> proposed relation -> approval -> approved relation -> dashboard/runtime 반영 루프는 다음 phase다.
- agent activity는 새 write path가 아니라 commitments/sessions/mailbox audit의 read projection으로 가야 한다.

## 3. 세 갈래가 맞물리는 방식

### 3.1 공통 tenant/scope 계약

128과 129는 같은 tenant/scope 계약을 쓴다.

- `tenant-local`: 반드시 `tenant_id` 필요.
- `platform-global`: 내부/공유 후보일 뿐, 외부 tenant read 허용을 의미하지 않는다.
- 외부 tenant에게 공개할 platform-global KB는 `metadata.tenant_visible=true` 명시 allowlist가 필요하다.
- relation graph도 같은 원칙으로, `platform-global` relation은 marketplace/library/template 같은 검수된 public asset에만 쓴다.

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
- 128/129는 이미 `semo` source에 적용됐다.
- `semicolony` target은 유지보수창 직전 `clone --reset`으로 최신 source를 다시 받아야 한다.
- flip 전후 어느 시점에도 source/target이 동시에 write source가 되면 안 된다.

## 4. 우선순위

### P0 — 현재 유지해야 할 차단선

1. Tenant search 공유 누출 차단을 유지한다.
   - tenant search는 자기 tenant + `metadata.tenant_visible=true` platform-global만 반환.
   - 기존 내부 KB는 `scope='platform-global'`이어도 tenant-visible이 아니므로 미노출.
2. Gateway credential은 plaintext 1회 출력, 저장은 hash, list는 prefix-only를 유지한다.
3. 신규 install은 `ensureTenantGatewayCredential()` 경로로 gateway key를 보장한다.
4. preflight script를 flip gate로 유지한다.
5. 전역 CLI 재배포 전에는 source CLI 기준 명령과 팀 전역 `semo` 명령의 차이를 문서화한다.

### P1 — 유지보수창 schema flip

유지보수창 절차:

```bash
# 0. DB env 로드
set -a && source ~/.claude/semo/.env && set +a

# 1. source schema pending 0 확인
semo db migrate --dry-run

# 2. target 재동기. 이 시점 전까지 semicolony target write source는 없어야 한다.
node scripts/clone-schema-semo-to-semicolony.mjs --reset

# 3. read-only gate. failure 0이어야 한다.
node scripts/check-semicolony-schema-flip-preflight.mjs

# 4. env flip
# SEMICOLONY_DB_SCHEMA=semicolony

# 5. router/cron/kb-gateway/dashboard 재기동 및 smoke
```

Rollback:

- `SEMICOLONY_DB_SCHEMA` 제거 또는 `semo`로 복귀.
- 동일 서비스 재기동.
- target schema는 보존해도 된다. 필요 시 다음 유지보수창에 다시 `clone --reset`.

### P2 — Gateway 배포 + dashboard v5 render

1. `kb-gateway` 이미지를 배포 파이프라인에서 build하고 `/health`를 검증한다.
2. 외부 노출은 `KB_GATEWAY_HOST=0.0.0.0`, ingress TLS, `KB_GATEWAY_SECRET`, DB env, OpenAI embedding env를 명시 주입한다.
3. Colony runtime env에 `SEMICOLONY_API_URL`, `SEMICOLONY_API_KEY`, agent slug를 주입한다.
4. dashboard v5는 다음 read model을 우선 렌더링한다.
   - Agent install/status: `agent_installs` -> `bot_status` projection
   - WorkItem: `action_items(plan)` + `bot_commitments(in-flight)`
   - Activity: commitments/sessions/mailbox audit projection
   - KB: tenant-local docs + tenant-visible shared docs
5. 외부 tenant 화면에서 내부 SEMO domain/key가 노출되지 않게 domain label을 product object로 변환한다.

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
4. credential cache 즉시 무효화는 LISTEN/NOTIFY로 분리한다. 현재 revoke 전파는 gateway in-proc TTL 정책에 의존한다.
5. active install runtime propagation은 별도 phase로 둔다. facade가 즉시반영을 약속하지 않는다.

## 5. 주요 리스크와 완화

| 리스크                                    | 영향                                      | 완화                                                                  |
| ----------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `platform-global` 전체 tenant search 노출 | 내부 KB 외부 노출 critical                | `metadata.tenant_visible=true` allowlist. 기본 미노출.                |
| target schema가 128/129 이전 상태         | flip 직후 gateway/facade 계약이 없음      | 유지보수창 직전 `clone --reset`; preflight 0 failure 후 flip.         |
| copy 이후 row-count drift                 | flip 직후 데이터 누락                     | 유지보수창 직전 `clone --reset`; target write freeze.                 |
| clone reset이 target-only write 삭제      | 이미 semicolony로 쓰는 서비스 데이터 유실 | flip 전에는 target write source 금지. preflight에서 runtime env 확인. |
| gateway token 유출                        | tenant KB write 권한 탈취                 | hash 저장, prefix-only list, rotate/revoke, scopes 최소화, 만료 권장. |
| Docker image 미검증                       | 배포 시 runtime 실패 가능                 | 배포 파이프라인에서 build + container `/health` smoke 필수.           |
| 전역 CLI 미전파                           | 운영자가 `semo gateway`를 못 씀           | cli-v\* 태그/배포 전까지 repo source CLI 사용 경로 문서화.            |
| dashboard v5가 내부 domain/key 노출       | 제품 abstraction 깨짐                     | facade read model만 UI 계약으로 사용.                                 |
| relation graph 무승인 적용                | 잘못 추출된 관계가 runtime에 반영         | proposed 기본값, approved live view, reversible temporal validity.    |

## 6. Acceptance gate

라이브 schema flip 전 필수:

- `semo db migrate --dry-run` source pending 0.
- `node scripts/clone-schema-semo-to-semicolony.mjs --reset` 완료.
- `node scripts/check-semicolony-schema-flip-preflight.mjs` failure 0.
- router/kb-gateway/dashboard가 모두 `SEMICOLONY_DB_SCHEMA=semicolony` 환경으로 재기동 가능한 유지보수창 확보.
- smoke: `semo kb get`, gateway `/health`, tenant search, dashboard DB read, rollback env 복귀.

외부 tenant pilot 전 필수:

- tenant search가 tenant-local + tenant-visible shared만 반환하는 테스트 유지.
- platform-global shared KB seed는 별도 검수/allowlist migration으로만 추가.
- gateway key issue/rotate/revoke smoke.
- persona resolve가 own `ag-{tenantSlug}-*`만 허용하는 smoke.
- kb-gateway Docker image build + container `/health` 검증.
- 전역 CLI 배포 또는 운영용 source CLI runbook 확정.

## 7. 다음 액션

1. 유지보수창 직전 `clone-schema-semo-to-semicolony.mjs --reset` 실행 후 preflight 0 failure를 확인한다.
2. `kb-gateway` Docker build/health를 배포 파이프라인에서 검증하고 외부 ingress TLS를 붙인다.
3. 팀 전역 `semo` CLI에 gateway 명령을 배포한다.
4. dashboard v5에서 WorkItem facade를 우선 렌더링하고, relation approval UI는 다음 phase로 분리한다.
5. tenant-visible shared KB seed 정책을 별도 decision으로 확정한다.
6. RLS와 LISTEN/NOTIFY credential cache invalidation은 Phase 2 hardening으로 설계한다.
