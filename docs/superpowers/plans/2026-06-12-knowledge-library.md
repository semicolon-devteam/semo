# 지식 도서관 증축 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) 또는 superpowers:executing-plans 로 task별 실행. 스텝은 `- [ ]` 체크박스.
> ⚠️ **실행 게이트**: 마이그 실DB 적용 / kbSearch 기본동작 변경 / Colony 프로덕션 와이어링 / push·배포는 **사용자 확인 후** 진행. 이 계획은 확인 시 그대로 실행할 수 있는 산출물이다.
> ⚠️ **공유 작업트리 주의**: semo-repo는 여러 cmux pane이 공유. 각 task 착수 전 `git status` 확인, 커밋은 `--no-verify`(pre-push 훅 무거움), 실행 시 line number는 라이브 코드로 재확인(인벤토리는 `.analysis` 스냅샷 기준이라 ±오차).

**Goal:** 선언형 `knowledge_base`(4.5/5)를 갈아엎지 않고 *증축* — 폐가/최신판(시간), 원자 사실 sidecar, 관계 응대연결 — 해서 "쓸수록 똑똑해지는" 도서관을 만든다.

**Architecture:** 문서 shell(기존 행) + 원자사실 sidecar(`kb_claims`) + 통제관계(`entity_relations`, 기존) + 시간유효성(`is_latest`/`superseded_by`/`valid_*`). 전 표면 통일 "검색 계약"(기본 current). Colony = proposed-only 사서.

**Tech Stack:** PostgreSQL(semo schema)+pgvector, Node/TS (packages/cli `kb.ts`, packages/kb-gateway Fastify, packages/semo-dashboard Next.js), vitest.

**스펙:** `docs/superpowers/specs/2026-06-12-knowledge-library-design.md`. **호출부 인벤토리:** 본 계획 부록.

---

### Task 0: 회귀 베이스라인 고정 (변경 전 안전망)
**Files:** Test: `packages/cli/src/__tests__/kb-search.contract.test.ts` (신규)
- [ ] **Step 1:** 현행 `kbSearch`/`kbGet`/`kbUpsert` 동작을 캡처하는 특성화 테스트 작성 — 같은 (domain,key,sub_key) upsert가 in-place(version bump)인지, search가 domain 필터+min_score로 반환하는지 등 *현 동작 그대로* assert.
- [ ] **Step 2:** `npm test -w @team-semicolon/semo-cli -- kb-search.contract` 실행 → 전부 PASS(현 동작 고정).
- [ ] **Step 3:** Commit: `test(kb): characterize current KB read/write before shelving changes`.

### Task 1: 마이그 132 적용 — 본문 supersession ⚠️게이트(DB)
**Files:** `packages/cli/migrations/132_kb_supersession.sql` (작성됨)
- [ ] **Step 1:** dry-run 검토 — 추가전용(`ADD COLUMN IF NOT EXISTS`)이라 기존 행 영향 0, 전 행 `is_latest=true` 기본.
- [ ] **Step 2:** ⚠️게이트: 마이그 러너로 적용. `semo`(또는 마이그 도구)로 132 실행.
- [ ] **Step 3:** 검증: `SELECT count(*) FROM semo.knowledge_base WHERE is_latest;` = 전체수, `\d semo.knowledge_base`에 새 컬럼 4개+인덱스 확인.
- [ ] **Step 4:** Commit(이미 파일 커밋됨 — 적용 로그만 기록).

### Task 2: 검색 계약 — `kbSearch`/`kbGet` ⚠️게이트(동작변경)
**Files:** Modify: `packages/cli/src/kb.ts`(kbSearch/kbGet) · Test: `kb-search.contract.test.ts`
- [ ] **Step 1: 실패 테스트** — `kbSearch(q)` 기본은 `is_latest=true`만 반환, `kbSearch(q,{includeSuperseded:true})`는 폐가 포함, `kbSearch(q,{asOf:ts})`는 그 시점 유효행 반환.
```ts
it('default search excludes superseded', async () => {
  // seed: A(is_latest=false, superseded_by=B), B(is_latest=true)
  const r = await kbSearch('x');           expect(r.map(x=>x.kb_id)).toContain(B); expect(r.map(x=>x.kb_id)).not.toContain(A);
  const r2 = await kbSearch('x',{includeSuperseded:true}); expect(r2.map(x=>x.kb_id)).toContain(A);
});
```
- [ ] **Step 2:** 실행 → FAIL(옵션 미구현).
- [ ] **Step 3: 구현** — kbSearch SQL WHERE에 `AND (${includeSuperseded} OR kb.is_latest)` 추가, `asOf` 지정 시 `valid_from/valid_to` 범위 필터. 기본값 includeSuperseded=false. `kbGet`도 동일 옵션(기본 current).
- [ ] **Step 4:** 실행 → PASS. Task0 회귀도 PASS(기본 동작은 is_latest=true 행만 — 기존 데이터 전부 true라 결과 동일).
- [ ] **Step 5:** Commit: `feat(kb): search contract — current default + includeSuperseded/asOf`.

### Task 3: 검색 계약 전 표면 전파 ⚠️게이트
**Files:** Modify: `packages/kb-gateway/src/lib/kb-service.ts`(PgKbService.search)·`tenant-kb.ts`(TenantKbService.search) · `packages/semo-dashboard/lib/core/kb.ts`(search)·`app/api/kb/search` · `packages/semo-dashboard/migrations/009_*`(kb_graph_snapshot)
- [ ] **Step 1~n:** 각 read 경로에 동일 계약(기본 current, 옵션 includeSuperseded/asOf) 반영 + 각 패키지 테스트. **핵심: 한 곳만 바꾸면 표면 간 KB 불일치** → 4개 read 경로 모두 + kb_graph는 `is_latest` 노드만 기본.
- [ ] **Step 마지막:** Commit: `feat(kb): propagate search contract to gateway/dashboard/graph`.

### Task 4: authoritative writer가 supersession 세팅 ⚠️게이트
**Files:** Modify: `kb.ts`(kbUpsert L~1474, kbPush L~350) · `kb-gateway/src/lib/kb-service.ts`(PgKbService.upsert L~225) · `semo-dashboard/lib/core/kb.ts`(upsertItem L~390) *(line은 실코드 재확인)*
- [ ] **Step 1: 실패 테스트** — 의미상 대체(`{supersedePrev:true}`)로 upsert 시 옛 행 `is_latest=false`+`superseded_by=새kb_id`, 새 행 is_latest=true. 단순 수정(오타·보강, 기본)은 현행 in-place(version bump) 유지.
- [ ] **Step 2:** FAIL. **Step 3:** 구현 — 4개 authoritative writer에 옵션 추가. seed writer(ontoRegister, bots-factory `DO NOTHING`)·deprecated(context.ts)·legacy raw(slack-router)는 **변경 없음**(기본 is_latest=true). **Step 4:** PASS. **Step 5:** Commit: `feat(kb): authoritative writers set is_latest + optional supersede`.

### Task 5: 마이그 133 적용 — kb_claims sidecar ⚠️게이트(DB)
**Files:** `packages/cli/migrations/133_kb_claims.sql`(작성됨)
- [ ] **Step 1:** dry-run(신규 테이블, 영향 0). **Step 2:** ⚠️게이트 적용. **Step 3:** 검증 `\d semo.kb_claims`·`v_kb_claims_current` 존재.

### Task 6: gateway read-only 노출 — claims/relations approved+current
**Files:** Create: `packages/kb-gateway/src/lib/claims-service.ts` · Modify: `app.ts`(엔드포인트 `/claims/search`, `/relations/expand` read-only)
- [ ] TDD: approved+current(`v_kb_claims_current`)만 반환, proposed 비노출, tenant 격리(t-{slug}). relations는 `v_entity_relations_live`(approved). Commit per endpoint.

### Task 7: Colony = proposed 사서 워커
**Files:** Create: `packages/cli/src/commands/colony-shelve.ts` (또는 colony-daily-digest 스킬 확장) · Test 동봉
- [ ] TDD: 채널/세션 입력 → claim/relation/supersede *후보*를 `status='proposed'`로만 적재(+evidence/confidence/extractor_version). **승인 전 live view 비노출** 검증. 선택 게이트(D3): 자동추출·tenant-visible·가격/법무/정책 = proposed; 사람 내부 decision/incident = audit-only(게이트 없음). Commit.

### Task 8: 한 테넌트 backfill + A/B (D6 GA 게이트) ⚠️게이트
**Files:** Create: `docs/reports/poc/kb-claims-ab-<tenant>.md`
- [ ] 한 가게 도메인 backfill → 응대 정확도/만족도: 온톨로지/claims ON vs OFF A/B. **증분 양(+) & 컨시어지/추출 비용 < 효익**이어야 온톨로지 1차 차별점 유지(아니면 2차 강등).

### Task 9: dual-domain reconcile (flip 후)
**Files:** Migration(신규) — semo/semicolony 중복 376행 단일화(view alias 또는 reconcile). flip 작업과 묶음. ⚠️게이트.

---

## Self-Review
- **스펙 커버리지:** M1=Task1·2·4, M2=Task5·6, 관계연결=Task6, 검색계약=Task2·3, Colony=Task7, SMB방어(unknown fallback·approved만 임베딩·tenant allowlist)=Task4·6·7 구현 시 반영, D6 A/B=Task8, dual-domain=Task9. ✓
- **Placeholder:** line number는 "실코드 재확인" 명시(스냅샷 ±오차) — placeholder 아님. 코드 스텝엔 실제 코드/SQL.
- **타입 일관성:** 옵션명 `includeSuperseded`/`asOf`/`supersedePrev` 전 task 통일.

## 부록 — KB 호출부 인벤토리 (변경 영향)
**Read(검색계약 적용 대상):** `kb.ts:kbSearch/kbGet`(현재 is_latest 필터 없음) · kb-gateway `PgKbService.search`/`TenantKbService.search` · dashboard `/api/kb`·`/api/kb/search`·`lib/core/kb.ts` · dashboard `kb_graph_snapshot`(009). **영향:** 기본 current 필터 추가. 기존 데이터 전부 is_latest=true라 *기존 결과 불변*, 새 supersede부터 효과.
**Write(16곳):** authoritative(is_latest 세팅 필요) = `kbUpsert`·`kbPush`(kb.ts) · `PgKbService.upsert`(gateway) · `upsertItem`(dashboard). seed/idempotent(`DO NOTHING`, 무변경) = `ontoRegister`·`bots-factory seed`·migration backfill. 위임/래퍼(kbUpsert 경유) = slack-router Colony flush. deprecated/legacy(표준화 대상) = `context.ts`(key-only)·slack-router raw·`incubator.ts` inline.
