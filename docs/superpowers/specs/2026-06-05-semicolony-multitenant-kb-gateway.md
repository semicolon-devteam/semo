# SemiColony 멀티테넌트 KB 게이트웨이 — 설계 & 스캐폴딩

- **날짜**: 2026-06-05
- **상태**: Phase 1 스캐폴딩 (코드/마이그 작성·검증 완료, 라이브 적용·배포 대기)
- **결정 SoT(KB)**:
  - `semicolony/decision/semicolony-kb-access-via-multitenant-api-gateway` (원 결정)
  - `semicolony/decision/semicolony-gateway-tenancy-auth-persona-resolved` (3 오픈포인트 확정)
- **선행 설계**: `2026-06-04-customer-dynamic-delegation-design.md`, `2026-06-02-agent-behavior-sot-and-propagation-design.md`

## 1. 배경 / 문제

고객마다 Colony가 기기 1대씩 배정되지만 KB는 중앙집중형(고객당 1개 개인화 KB)이다.
Colony 에이전트가 중앙 KB DB에 **직접 커넥션**을 맺으면 (1) colony 증가 → connection pool 폭증,
(2) DB 접속정보/스키마가 고객 기기에 노출, (3) 공격 표면 확대.

→ **DB를 바라보는 단일 백엔드 API 서버(멀티테넌트 게이트웨이)** 를 두고 모든 KB 읽기/쓰기/임베딩/페르소나를
이 게이트웨이로 단일화한다. (Reus·Bae 2026-06-05 Slack 확정.)

## 2. 핵심 발견 — 그린필드가 아니다

이미 존재하는 자산을 진화시킨다:

| 자산                   | 위치                                                    | 역할                                                                    |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `kb-gateway` (Fastify) | `packages/kb-gateway`                                   | `/kb/get·search·upsert`, `/embed`, HMAC auth — **이미 단일 게이트웨이** |
| 테넌시 모델            | `public.tenants` / `agent_installs` / `tenant_channels` | slug, tenant_type, persona_override, Slack team_id(암호화)              |
| 페르소나 SoT           | `semo.agent_personas`                                   | slug=botId, `soul_md` (override>template>synthesis 가 투영됨)           |
| tenant 패턴 선례       | `128_entity_relations.sql`                              | `tenant_id UUID` + `scope CHECK('tenant-local'\|'platform-global')`     |
| 토큰 vault 선례        | `107_agent_service_credentials.sql`                     | `token_hash UNIQUE`, `token_prefix`, `scopes[]`, 만료/폐기              |

`public`·`semo`·`semicolony` 스키마는 **동일 물리 DB(appdb)** → 크로스스키마 FK 가능.

## 3. 확정된 3개 오픈포인트

### #1 테넌트 격리 — tenant_id+scope 컬럼 + per-tenant 도메인 (하이브리드)

- `semo.knowledge_base`에 `tenant_id UUID` + `scope TEXT CHECK('tenant-local'|'platform-global') DEFAULT 'platform-global'`
  **가산 추가**. 제약 `scope='platform-global' OR tenant_id IS NOT NULL` (128과 동형). 기존 행 전부 platform-global/NULL → 무변경.
- **물리적 키 격리 = per-tenant 도메인 `t-{tenantSlug}`** (017 dot-notation 호환, `service` generated 컬럼 자동 그룹).
  → 기존 `UNIQUE(domain,key,sub_key)` 와 `ON CONFLICT(domain,key,sub_key)` 를 쓰는 **10개 writer**
  (slack-router, kb-pg, cli/kb.ts, incubator, bots-factory, memory…) 를 **건드리지 않는다** (zero blast radius).
- `tenant_id` 컬럼 = RLS(Phase 2)·cascade·분석·게이트웨이 이중검증용 비정규화.
- 게이트웨이가 자격증명에서 `domain=t-{slug}` + `tenant_id` 를 **파생·강제** → 클라이언트 spoof 불가.
- 공유 베이스 읽기는 **`metadata.tenant_visible='true'` 인 platform-global 행만** allowlist 한다.
  (마이그 129 후 기존 내부 KB 전부가 platform-global 이 되므로, scope 만으로 공유하면 팀 내부 KB 가 tenant 검색에 누출됨 → 명시 플래그 필요. tenant search 기본은 자기 테넌트만 + opt-in 공유.)
- per-tenant 도메인은 ontology FK(015) 충족 위해 `entity_type='tenant-kb'` 로 idempotent 등록(게이트웨이 `ensureTenantDomain`).
- **기각**: (a) 순수 tenant_id unique 키 → 10 writer 파손. (b) schema-per-tenant → ops 폭발, 5-conn 풀과 배치.

### #2 인증 발급·회전 — per-tenant bearer 자격증명 (107 미러), 내부는 HMAC 유지

- 신규 `semo.gateway_credentials` (107 동형): `token_hash UNIQUE`(sha256, pepper 없음), `token_prefix`, `scopes[]`,
  `status`, `expires_at`, `revoked_at`, `issued_by`, `tenant_id UUID FK→public.tenants(id) ON DELETE CASCADE`, `tenant_slug`.
- 토큰 `sck_{tenantSlug}_{base64url(32)}`, 평문은 발급 시 1회만 노출.
- 게이트웨이 preHandler 듀얼 경로:
  - `Authorization: Bearer sck_...` → `TenantCredentialResolver` (stateless 조회 + 30s in-proc 캐시) → tenant 컨텍스트.
  - 없으면 기존 `X-Bot-Id`+`X-Signature`(공유 HMAC) → internal 컨텍스트 (`scope='*'`, platform-global 전체).
  - → **7개 내부 봇·CLI 무마이그레이션.**
- 발급·회전 = 중앙 플랫폼. CLI `semo gateway issue-key|rotate-key|revoke-key|list-keys`.
  회전 = 신규 발급 + 기존 활성 키에 grace 만료(무중단). 고객 provisioning 이 `SEMICOLONY_API_KEY` 로 주입(후속 wiring).

### #3 페르소나/init fetch — 동일 게이트웨이 경유 (`POST /persona/resolve`)

- Colony 는 `agent_personas` 에 직결하지 않는다(단일-DB-접근 불변식).
- `POST /persona/resolve {slug?}` → 자격증명 tenant 로 스코프된 `soul_md`(+display_name, version).
- soul_md 는 이미 `customer-runtime.projectInstallToBotStatus()` 가 `resolveCustomerSoul()`
  (override>template>synthesis)로 해소해 `agent_personas` 에 투영한 값 → 게이트웨이는 그 SoT 를 읽고 스코프만 강제.
- tenant 자격증명은 자기 소유 에이전트(botId prefix `ag-{tenantSlug}-`)만 해소; 내부 HMAC=admin 전체 허용.

## 4. API 표면 (변경/추가)

| 메서드/경로                  | internal(HMAC)    | tenant(Bearer)                                                    |
| ---------------------------- | ----------------- | ----------------------------------------------------------------- |
| `POST /kb/get`               | domain+key 그대로 | key (domain=t-{slug} 강제), 자기 네임스페이스만                   |
| `POST /kb/search`            | 기존 동작         | 자기 tenant + `tenant_visible` 공유만 (옵션 `own_only` 로 자기만) |
| `POST /kb/upsert`            | 기존 동작         | domain 무시, tenant-local 강제, scope `kb:write` 필요             |
| `POST /persona/resolve`      | 임의 slug         | 자기 prefix slug만, scope `persona:read` 필요                     |
| `POST /embed`, `GET /health` | 동일              | 동일                                                              |

scope enforcement: tenant=`kb:read`/`kb:write`/`persona:read`, internal=`*`.

## 5. 스키마 (migration `129_kb_multitenant_gateway.sql`)

- `knowledge_base.tenant_id UUID`, `knowledge_base.scope TEXT` + CHECK 2종, partial index `idx_kb_tenant WHERE tenant_id IS NOT NULL`.
- `semo.gateway_credentials` (+ FK→public.tenants, 인덱스 2종).
- 가산적·비파괴. 러너(db.ts)가 BEGIN/COMMIT 래핑 + `semo.`→활성 스키마 retarget (`public.` 불변).
- **검증**: 트랜잭션 dry-run(BEGIN→실행→ROLLBACK)으로 실제 appdb 스키마에 대해 통과 — 컬럼/테이블/제약 생성 및
  tenant-scope CHECK enforce 확인(영속 안 됨).

## 6. 파일 (이 스캐폴딩에서 추가/변경)

```
packages/cli/migrations/129_kb_multitenant_gateway.sql        (신규)
packages/kb-gateway/src/lib/tenant-credentials.ts            (신규) Bearer 발급/검증
packages/kb-gateway/src/lib/tenant-kb.ts                     (신규) tenant-scoped get/search/upsert
packages/kb-gateway/src/lib/persona-service.ts               (신규) /persona/resolve 로직
packages/kb-gateway/src/types.ts                             (변경) TenantContext 등
packages/kb-gateway/src/app.ts                               (변경) 듀얼 auth + tenant 분기 + persona 라우트
packages/kb-gateway/src/server.ts                            (변경) 신규 deps 와이어링 + KB_GATEWAY_HOST
packages/kb-gateway/src/index.ts                             (변경) export
packages/kb-gateway/src/__tests__/tenant-credentials.test.ts (신규)
packages/kb-gateway/src/__tests__/app-tenant.test.ts         (신규)
packages/cli/src/commands/gateway-credentials.ts             (신규) semo gateway …
packages/cli/src/index.ts                                    (변경) 명령 등록
```

검증: kb-gateway `tsc --noEmit` 클린, vitest **36/36** (기존 19 회귀 없음 + 신규 17). cli `tsc` 0 에러.

## 7. Phase 2 / 비-목표

- **Postgres RLS**: tenant_id 기반 행 수준 보안(현 enforcement는 게이트웨이 쿼리 경계 — 레포 관행과 일치, 128 acl도 later phase).
- **다른 9개 writer의 tenant 인지화**: 게이트웨이가 유일한 tenant-local writer인 한 불필요.
- **HNSW + tenant 필터 recall**: 현재 post-filter. 규모 확장 시 per-tenant partial HNSW 또는 ivfflat 재검토.
- **provisioning wiring**: `customer-runtime` 가 install 시 `issue-key` 호출 → Colony env 주입 (별건).
- **배포**: kb-gateway Dockerfile 부재 → 외부 노출 시 `KB_GATEWAY_HOST=0.0.0.0` + ingress TLS. (현재 127.0.0.1 기본 유지.)

## 9. 리뷰 경화 (16-에이전트 adversarial review)

4-렌즈(격리·인증·SQL·회귀) 리뷰 + 검증 패스. 거짓 critical 3건(Bearer 미구현/파일 부재/kb-service tenant_id 미설정)은
adversarial verify 가 정확히 기각. VERIFIED 항목: 해시 일치(CLI sha256↔게이트웨이), 격리, 페르소나 교차테넌트 차단,
내부 HMAC 경로 무회귀, 마이그 가산성.

확정·반영된 실제 이슈:

- **자격증명 캐시 안전성** → null 미캐시(발급 직후 즉시 유효 + 폐기 토큰 null 고착 DoS 방지), 기본 TTL 30s→5s,
  폐기/만료 전파 lag=TTL 명문화. cross-process 즉시 무효화(LISTEN/NOTIFY)는 Phase 2.
- **tenant search 공유 누출** → `metadata.tenant_visible='true'` allowlist (위 §3 #1).
- `/kb/search` tenant 분기: 클라이언트 `domain` 무시 명시.

검증 후: kb-gateway vitest **40/40**, tsc 클린.

## 8. 운영 메모 (환경 사고, 2026-06-05)

이 작업 중 macOS iCloud "데스크탑&문서" 동기화가 비활성화되어 레포가 `~/Desktop` → iCloud 컨테이너
(`~/Library/Mobile Documents/.../Desktop/.../semo`)로 이동. 사용자가 iCloud 동기화를 끈 채 현재 환경에서 작업 진행.
레포 무결, `semo` CLI 재설치로 복구. slack/discord 라우터는 옛 inode 로 생존 중 → 재기동 시 새 경로 사용 필요(별도).
