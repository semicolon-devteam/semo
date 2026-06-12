# SemiColony 지식 도서관(Knowledge Library) 설계 스펙

> 작성 2026-06-12 · 상태: 설계 확정(브레인스토밍+Codex 교차검토 반영) → 구현 계획 단계.
> 출발 근거: 리포트 `docs/reports/2026-06-12-kb-shelving-analysis-supermemory-comparison.md`(§1~§8),
> Codex 2차 리뷰 KB `semicolony/research/knowledge-library-codex-review-2026-06-12`,
> 압박검증 `docs/plans/2026-06-12-semicolony-strategy-stress-test.md`, 인포그래픽 `docs/reports/2026-06-12-knowledge-library-infographic.pdf`.

## 목표 (Goal)
이미 업계 최상위(선언형 셸 4.5/5)인 `knowledge_base`를 **갈아엎지 않고 증축**해, "쓸수록 똑똑해지는 지식 도서관"을 만든다. 빠진 것 = **(1) 시간(폐가/최신판) (2) 사실 단위 정밀도 (3) 관계의 응대 연결**. Colony를 **"제안하는 사서"**로 세워 이 운영을 맡긴다.

## 용어 (이후 통일)
지식 도서관(KB 전체) · 서가(ontology 분류) · 장서(knowledge_base 행) · 청구기호(`(domain,key,sub_key)`) · 주제검색(벡터) · 상호참조(entity_relations) · 대출이력(kb_history) · **폐가/제적(supersede/decay)** · **사서(Colony)**.

## 아키텍처 (4겹, additive)
정확한 형태 = **문서 shell + 원자 사실 sidecar + 통제 관계 + 시간유효성** (Codex 정정). "B+C+time"의 구체화.
1. **문서 shell** = 기존 `knowledge_base` 행. 결정/문서/절차/서술 근거의 canonical 주소. **그대로 유지**.
2. **원자 사실(claim) sidecar** = 신설 `kb_claims` 테이블. 가격·담당자·상태·정책·영업시간·고객속성처럼 *바뀌고 검증가능한 최소 단위*. 문서를 쪼개는 게 아니라 옆에 붙인다.
3. **통제 관계** = 기존 `entity_relations`(128). relation_types 통제어휘 + proposed→approved 이미 존재. **게이트웨이/응대에 연결**(현재 미노출).
4. **시간유효성** = 문서·사실·관계 모두에 `valid_from/valid_to`(현실시간) + supersession. ⚠️ `valid_at` 추정오류가 치명적 → **unknown/approximate 허용** 필수.

## 확정 결정 (Decisions)
- **D1 진화(증축), 재건축 금지.** `UNIQUE(domain,key,sub_key)` + `ON CONFLICT upsert` 계약이 시스템 곳곳 writer와 엮여 있어 전면 변경은 주소·writer 계약을 깬다. → 모든 변경은 **additive**.
- **D2 권위 경로 = "제안형".** LLM 추출은 배제도 권위화도 아닌 **비권위 proposal generator**. Colony는 제안·중복탐지·supersede 후보·근거첨부만; **승인 전 live retrieval 금지**.
- **D3 선택적 승인 게이트.** proposed→approved 게이트는 *자동 LLM 추출 / tenant-visible·shared / 가격·법무·정책·페르소나·라우팅* 에만. 사람이 명시적으로 쓰는 *내부 decision/incident/cron report* 는 audit-only(게이트 없음). 전역 게이트는 운영을 막으므로 금지.
- **D4 검색 계약(전 표면 통일).** 기본 `current`(=현행 유효만), 옵션 `include_superseded`, `as_of(timestamp)`. **한 경로만 필터 넣으면 CLI/gateway/dashboard/bot이 서로 다른 KB를 보게 됨** → kb.ts·gateway·dashboard·MCP 전부 동일 계약.
- **D5 관계는 approved live view만** 응답 그라운딩에 사용. 관계-only 응답 금지(거짓단정). 응답은 KB 속성(RAG) 우선 + 관계 보강.
- **D6 온톨로지(관계) = 1차 핵심 차별점 유지(reus 결정)** — 단 GA 게이트: (a)게이트웨이 노출+응대연결 (b)파일럿 A/B에서 ON>OFF 증분 양(+) (c)stale 자동폐기 경로. 미충족 시 2차 보강층 강등.

## 데이터 모델 (additive, 실DB 적용은 확인 후)
### M1. `knowledge_base` 본문 supersession (컬럼 추가)
- `is_latest boolean NOT NULL DEFAULT true`
- `superseded_by uuid NULL REFERENCES knowledge_base(kb_id)` + `supersedes uuid NULL`
- `valid_from timestamptz NULL`, `valid_to timestamptz NULL` (unknown 허용 = NULL)
- ⚠️ `kb_history` 트리거는 OLD 스냅샷(감사)만 보관 → **검색가능한 superseded 행이 아님**. 따라서 본문 supersession은 위 컬럼으로 별도 표현. (히스토리 재사용 불가)
- 모순 쓰기(같은 청구기호 의미상 대체)는 옛 행 `is_latest=false`+`superseded_by` 세팅, 새 행 `is_latest=true`. 단순 in-place 수정(오타·보강)은 현행 UPSERT 유지(version bump).

### M2. `kb_claims` sidecar (신설)
`kb_claim_id, tenant_id, scope(tenant-local|platform-global), source_kb_id(FK knowledge_base, nullable), subject_ref jsonb, predicate text, object_ref jsonb|object_value text, status(proposed|approved|retired|rejected) DEFAULT proposed, valid_from, valid_to, tx_from DEFAULT now(), tx_to, confidence numeric, evidence jsonb, extractor_version text, created_by, approved_by, approved_at`.
- live view `v_kb_claims_current` = `status='approved' AND tx_to IS NULL AND (valid_to IS NULL OR valid_to > now())`.
- 인덱스: `(tenant_id, status)`, `(tenant_id, subject_ref)`, partial on current.

### M3. 관계 연결
- `entity_relations`(128) 그대로 사용. 게이트웨이에 **read-only live view 엔드포인트** 추가(approved만). 응대 파이프라인이 1~2 hop 확장에 사용.

## 검색 = "똑똑한 검색" 4단계 (Attention 아이디어의 정확한 구현)
1. **후보 생성**: tenant/domain/type/time prefilter + 벡터(+BM25). (현행 보유)
2. **그래프 확장**: relation_type allowlist + max 1~2 hop (constrained expansion; GAT/무제한 multi-hop 금지 — 관계폭발·허위연결).
3. **재정렬(rerank)**: authority·freshness·evidence·semantic fit. (cross-encoder는 후속 옵션)
4. **컨텍스트 패킹**: 다양성·recency·token budget·충돌처리.
- ⚠️ "Transformer attention을 KB 전체에 직접 실행"은 범주오류(n²/창 한계). 위 검색이 *모델이 볼 것을 고르는* 단계.

## Colony = 사서 워크플로
수집(채널/세션) → **proposed**(claim/relation/supersede 후보 + evidence + confidence) → 승인(D3 선택 게이트) → **approved**(live 노출). 폐가도 "이거 뺄까요?" 제안형(자동 영구삭제 금지). 현 Colony 라우터는 단일키 롤링 버퍼(`semo/iteration/colony-context-memory-latest`)일 뿐 → 사서 직무(claim 추출·supersede 제안)는 별도 워커/스킬로 신설하되 **proposed-only**.

## SMB 멀티테넌트 리스크 & 방어 (최대 위험 = 신뢰 붕괴)
- 추출품질: proposed 게이트 · evidence span · confidence · **unknown fallback(없으면 "확인 후 안내", 거짓단정 금지)** · schema별 extractor · negative example.
- drift: `last_seen_at` · type별 expiry · scheduled revalidation · conflict queue · 사장님 확인 UX.
- write amplification: message fingerprint · batch 추출 · stable-fact threshold · **approved/current만 임베딩**(raw 메시지 전량 임베딩 금지).
- 검색성능: tenant/domain/type/time prefilter · partial index · synthetic tenant 벤치.
- 테넌트 격리: platform-global은 `metadata.tenant_visible=true` allowlist만 공유(현 gateway 원칙) — claim/relation에도 동일 적용.
- UX: SMB에 bitemporal 노출 금지 — "현재 지식 / 바뀐 내용 / 근거"만.

## 단계적 롤아웃 (Codex 7스텝, 안전순)
1. **caller 인벤토리 + 회귀테스트 고정** (변경 전 안전망). ← 진행 중 산출물.
2. **본문 supersede(M1) + 검색계약(D4)** — 기본 current/옵션 include_superseded·as_of, 전 표면 동일.
3. **kb_claims sidecar(M2)** 추가 + live view.
4. **approved/current live view를 gateway에 read-only 먼저** 노출.
5. **Colony extraction = proposed-only** 연결.
6. **한 테넌트/가게 도메인 backfill + A/B**(온톨로지 ON>OFF 증분 = D6 GA 게이트).
7. **semo/semicolony dual-domain canonicalize**(스키마 flip 후).

## Accept / Reject (Codex 프레임)
- **Accept**: 선언형 KB 보존 · 관계는 approved live view만 · temporal fact sidecar · Colony=proposed 사서 · 검색 current 기본+옵션.
- **Reject**: knowledge_base 전면 append-temporal 재구축 · LLM 그래프 1차 SoT · 관계-only 응답 · 모든 write 전역 게이트 · tenant-visible/platform-global 자동 공유.

## 범위 밖 (Out of scope, 이번 사이클)
- 완전 자동 fact-extraction(P5의 무인 운영) — proposed-only로만 시작.
- On-device LLM(별도 deferred 결정).
- cross-encoder rerank(후속 옵션).

## ⚠️ 확인 필요(구현 게이트 — 사용자 승인 전 보류)
- 마이그레이션 **실DB 적용**, kb.ts **검색 기본동작 실변경**, Colony **프로덕션 와이어링**, 브랜치 **push/배포**, 인포그래픽 **공개 퍼블리시**.
- 본 사이클의 자율 산출물 = 이 스펙 + 구현계획 + **추가전용 마이그 파일(미적용)** + caller 영향분석 + 회귀테스트 골격, 전부 브랜치(미push).
