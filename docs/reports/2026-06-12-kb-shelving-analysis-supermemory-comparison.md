# SemiColony KB 개선 참고자료 — "책장 없는 도서관" 분석 & supermemory 비교

> 작성: 2026-06-12 · 목적: SemiColony 지식베이스(KB) 개선의 참고자료
> 분석 방법: supermemory 심층 조사 + semo KB 라이브 특성화 + 에이전트-메모리 실패 문제공간 조사 → 사실관계 적대적 검증
> 한 줄 요약: **문제는 "책장이 없다"가 아니라 "책장을 누가 짓느냐"다. 자동 사서(supermemory)냐 분류 서고(우리)냐 — 우리는 후자를 먼저 지었고, 이제 자동 supersede만 빌려오면 된다.**

---

## 0. 출발점 — "책장 없는 도서관" 비유

현재 다수 에이전틱 AI 메모리(OpenClaw/Hermes/Claude류 `Memory/` 폴더, generic agent-memory 플러그인)는
**일기 쓰듯 md 파일을 append**한다. 일주일만 써도 파일이 넘쳐 맥락을 못 찾고 *오히려 처음보다 멍청해진다*.

→ 도서관의 핵심은 "책"이 아니라 **수많은 책 중 원하는 걸 찾게 해주는 정리 시스템(책장·분류·정렬)** 이다.
   책장 없이 책만 찍어내는 게 현 시점 에이전트 메모리의 근본 결함. **이 비유는 측정 데이터로 뒷받침된다(아래 §1).**

---

## 1. "책장 없는 책"은 느낌이 아니라 문서화된 실패 모드 (셸빙 성숙도 1/5)

naive append-only md 메모리의 degrade 메커니즘 (체인):

1. unbounded append → 파일이 선형 증가 (몇 달이면 ~15K 토큰)
2. 통째 주입 → 컨텍스트 윈도우 bloat
3. **context rot** — 토큰 증가 시 *단순 작업조차* 성능 저하. 200K 윈도우 모델도 50K에서 유의미 degrade
4. **lost-in-the-middle** — 새/묻힌 사실이 attention 약한 자리로 → 정확도 30%+ 하락
5. signal-to-noise 단조 악화 — 모순·stale 노트가 distractor로 *능동적* 품질 저하, 환각 유발
6. 비용 선형 증가

**중복/모순/staleness가 이 패턴의 최악 지점이자 사용자가 겪은 바로 그것**:
주소(addressing)가 안정적이지 않으니 무엇도 갱신/supersede되지 않고 *재append만* 됨.
→ 3개월 MEMORY.md = "47개 선호(일부 모순) + 89개 '중요' 결정 + 156개 잡노트", 호출마다 ~15K 토큰.
지난 deadline·rename된 파일이 그대로 남아 "에이전트가 자신만만하게 outdated 패턴을 제안".
(보안: memory poisoning / MemoryGraft — innocuous md 아티팩트로 가짜 '성공 경험'을 심는 공격면도 됨.)

근거: Chroma *Context Rot* (18모델, Claude 4 포함) · Liu et al. *Lost in the Middle* (TACL 2024, arXiv:2307.03172) · Letta/MemGPT *Agent Memory*.

---

## 2. 같은 축으로 세 시스템 해부

| 축 | naive md 메모리 | **supermemory** | **SemiColony KB (semo)** |
|---|---|---|---|
| 책장(구조) | 없음 (폴더) | **창발형** — 컨테이너 태그 + LLM이 자동 구축하는 관계 그래프 | **선언형** — ontology FK로 도메인 검증 + 타입별 JSON-Schema |
| 주소 | 파일명(모호) | 파티션 + 의미검색, id는 변경(mutation)용 | **`(domain,key,sub_key)` 결정적 3-튜플 주소** |
| 검색 | grep / 통째 주입 | 벡터 하이브리드 + 옵션 rerank + 그래프 시간추론 | pgvector 1024d HNSW 하이브리드 + min-score 랭킹 |
| 중복/모순 | 그냥 재append | **Updates/Extends/Derives 엣지 + isLatest** | **UPSERT 덮어쓰기 + version**, sha256 24h 멱등 훅 |
| 망각/decay | 없음 | **시간만료 + significance decay** | `hot_until`/`last_used_at`/`use_count`/`archived` (부분 enforce) |
| 출처/감사 | 없음 | 버전·출처태그 (정확 span 인용은 약함) | **전체 audit history 트리거 + created_by/decided_by** |
| **셸빙 판정** | **1/5** | **3.5/5** 창발형 셸 | **4.5/5** 선언형 셸 |

### 두 가지 "책장" 철학 (핵심 통찰)

도서관 비유의 함정은 *"올바른 책장은 하나(듀이십진)"* 라는 암시다. 현장은 **"무엇이 책장이냐"에 두 답으로 갈라진다**:

- **supermemory = 자동 사서.** 사람은 컨테이너 태그만 던지고, LLM이 사실을 추출해 그래프로 *알아서 재배치·supersede·망각*.
  저마찰·퍼지. 개인/대화 메모리에 최적. 약점 = 출처 정밀도·감사성·벤더 마법 의존, 태그 스킴은 *up-front 하드 모델링 결정*(잘못 태깅하면 사실상 검색 불가).
- **SemiColony KB = 분류된 서고.** 책장(ontology)을 *사람이 미리 설계*하고, 쓰기는 거기 맞춰야 함.
  결정적 주소·강한 감사·롤백·human-navigable. 팀 지식의 canonical SoT에 최적. 약점 = ontology 유지 규율 필요, 자동 fact-extraction 없음.

> 공정성: 두 시스템은 **다른 목적을 최적화**한다. supermemory를 "ontology 없다"고 깎거나, KB를 "자동 추출 없다"고 깎는 건 부당.
> 둘 다 의도된 트레이드오프다.

---

## 3. SemiColony KB 현재 상태 — 왜 4.5/5인가 (강점, 근거 포함)

semo KB는 naive md가 *범주적으로 결여한* enforced 셸빙을 갖춤:

1. **DB FK 검증 도메인 분류** — `knowledge_base.domain` → `ontology(domain)` FOREIGN KEY (`015_kb_domain_enforcement.sql:25-26`).
   미등록 도메인 쓰기는 *거부됨*.
2. **타입별 key/sub_key JSON-Schema** — `ontology_types` (`016/018`), `[singleton]`/`[collection]` + `required *` 마커.
3. **결정적 복합 주소** — `UNIQUE(domain,key,sub_key)` (`025_kb_flat_keys.sql:20-22`). `semo kb get <domain> <key> [sub_key]`로 정확 위치.
4. **하이브리드 의미검색** — `embedding vector(1024)` (text-embedding-3-small), HNSW `(m=16, ef_construction=64)` cosine ANN (`001_initial.sql:209`).
   추가가 grep처럼 선형으로 recall을 깎지 않음(sub-linear).
5. **UPSERT 중복제거 + optimistic lock** — 같은 주소 재쓰기는 in-place 덮어쓰기 + `version` bump (md "X에 대한 두 노트" sprawl 없음).
   SEMO_DECISION 훅: `sha256(domain|key|sub_key|content)[:16]` 24h 멱등으로 무한 version 증가 방지.
6. **전체 audit trail** — `knowledge_base_history` + `kb_history_trigger`가 OLD/NEW 전체를 `kb_snapshot JSONB`로 직렬화 (`113_kb_history.sql`).
   `semo kb history <domain> <key>`로 누가·언제·이전 버전 추적/롤백 가능.
7. **usage/decay 컬럼** — `last_used_at`/`use_count`/`hot_until`/`archived` (접근 시 usage-touch).

→ **카탈로그(분류) + 청구기호(주소) + 대출데스크(감사)를 갖춘 큐레이트된 도서관.** flat한 MEMORY.md 폴더와 *근본적으로 다름*.

---

## 4. 그럼에도 — SemiColony KB에 남은 "책장 없는 책" 증상 (개선 타깃)

자랑으로 끝내지 않기 위한 정직한 갭. **셋 다 supermemory가 강한 지점과 정확히 대칭**이다:

### G1. 행(row) 내부는 여전히 free prose — "책은 제 칸에 꽂혔는데 책 안이 일기장"
- `content` 본문이 길어지면 *그 안에서* context rot. 책장은 있는데 책 내부엔 목차가 없음.
- 개선: 긴 결정/스펙 본문에 구조 강제(요약 헤더 + 구조화 필드) 또는 본문을 sub_key 단위로 쪼개 주소화.

### G2. Supersession이 "구조"가 아니라 "관습" — stale 항목이 검색에 계속 섞임
- 현재는 stale을 `DEPRECATED` *텍스트*로 표기할 뿐. supermemory의 **isLatest / Updates 하드 엣지(tombstone)가 없음**.
- 결과: 오래된 결정이 의미검색에 계속 올라옴 = 사용자가 겪은 "옛 맥락이 현재를 오염"의 KB판 잔재.
- **개선(최우선)**: `supersedes`/`superseded_by` 하드링크 + `is_latest` 플래그 도입. 검색 기본 필터 = `is_latest=true`.

### G3. dual-domain(semo/semicolony) 중복 — canonical 주소 시스템의 아이러니한 일관성 사마귀
- 리브랜딩 migration이 ~376행을 `semo`/`semicolony` 두 도메인에 *복제*. 검색이 양쪽을 반환, `kb get semo`는 alias 변환 통지.
- 스키마 flip 전까지 실재하는 duplicate-content 일관성 해저드.
- 개선: flip 완료 후 한쪽 도메인으로 reconcile(또는 view alias로 단일 SoT화).

### supermemory에서 훔쳐올 단 하나
> **`supersedes` 하드링크 + `is_latest` 플래그 + decay *enforcement*** (컬럼 `hot_until`/`last_used_at`는 이미 있으나 enforce가 부분적).
> 이거면 G2가 닫히고, KB가 **"선언형 셸(우리) + 자동 supersede(그들)"의 좋은 부분만** 갖게 된다.

---

## 5. 개선 권고 (우선순위)

| # | 권고 | 닫는 갭 | 난이도 | 비고 |
|---|---|---|---|---|
| P1 | `is_latest` 플래그 + `supersedes`/`superseded_by` 하드링크. 의미검색 기본 `is_latest=true` 필터 | G2 | 중 | supermemory Updates 엣지 차용. 가장 높은 ROI |
| P2 | decay enforcement — `hot_until` 만료/`use_count` 기반 검색 가중 또는 자동 `archived` | G2 | 중 | 컬럼은 이미 존재, 로직만 |
| P3 | 긴 `content` 본문 구조화 — 요약 헤더 강제 / sub_key 분해 | G1 | 중 | 행 내부 context rot 방지 |
| P4 | dual-domain reconcile (flip 후) | G3 | 저 | 스키마 flip 작업과 묶음 |
| P5 | (탐색) 자동 fact-extraction 레이어 — 대화/세션에서 KB 후보를 LLM이 추출·제안 | — | 고 | supermemory 창발형의 선택적 차용. enforced 셸 위에 자동 ingest |

---

## 6. 공정성·정확성 caveat (적대적 검증 결과)

- **supermemory는 현재 MIT 오픈소스 + self-host 가능** (단일 바이너리·임베디드 그래프엔진·로컬 임베딩).
  조사 중 한 소스("closed/enterprise-only")는 *outdated 경쟁사 프레이밍*으로 검증에서 기각됨.
- supermemory **벤치 #1 (LongMemEval 81.6%, LoCoMo, ConvoMem)은 자체 보고 수치**(자사 memorybench 하니스). 독립 재현 전까지 marketing-spin으로 취급.
- supermemory 코어 엔진 internals(벡터/그래프 저장)는 비공개 부분 존재 — exact-span 인용·독립 감사성은 약함(우리 KB가 강한 지점).

---

## 7. 경쟁 KB/메모리 landscape 비교 (2026-06-12 확장 — supermemory 외 6+종)

supermemory 외 주요 에이전트 메모리/KB 시스템을 동일 축으로 조사·적대적 검증한 결과.
**이 분야는 두 가문으로 분기 중이고, SemiColony는 제3의 위치(선언형 관계 KB)에 있다.**

### 7.1 가문 지도

| 가문 | 대표 (★=GitHub stars 근사) | 구조(책장) | supersession(G2) | 셸빙 |
|---|---|---|---|---|
| **A. 벡터/프로필 스토어** | mem0(58k), supermemory, LangMem, Memobase, A-MEM | **창발형** — LLM 사실추출 + 느슨한 scope id | 약함 | 2.5~3.5 |
| **B. 시간 지식그래프(TKG)** | **Zep/Graphiti(27k)**, Cognee(18k), Memary | 그래프(LLM 파생, 옵션 ontology) | **강함(bitemporal)** | **4~5** |
| **C. 선언형 관계 KB** | **SemiColony**, Memori(SQL-native) | **enforced 선언형(FK ontology + 결정적 주소)** | 소프트(관습) | 4.5 |

> 핵심: OSS 진영 **거의 전부가 "창발형 구조"에 베팅**했는데 **우리만 "선언형 구조"** — 동류는 Memori(SQL-native 메모리)뿐.
> 우리는 **선언형 책장은 이 분야 아웃라이어(최상위)**, 단 **시간 차원(valid_at/invalid_at)만 비어 있음** = G2.

### 7.2 시스템별 차이 (우리 KB 대비)

- **Zep / Graphiti — 우리 G2의 정답지(가장 중요).** 모든 엣지에 `valid_at`/`invalid_at`(현실시간)+`created_at`/`expired_at`(DB시간) bitemporal. 모순 정보 시 옛 사실을 **삭제 않고 invalidate**(히스토리 보존), "1월의 리드 ≠ 지금 리드" 시간질의 가능. 검증 에이전트 판정 "거의 사실오류 없음"(신뢰 높음). vs 우리: UPSERT 덮어쓰기 + `DEPRECATED` 텍스트 → 시간질의 불가, stale이 검색 혼입.
- **mem0 — 반면교사.** 시장 1위지만 V3(2026.04)에서 UPDATE/DELETE 제거 → 순수 append(NY→SF 영원 공존). issue #5330이 "만료/decay 없음" 공식 인정. vs 우리: 우리의 소프트 supersession조차 **mem0 V3보다 강함**(최소 UPSERT+audit). 교훈: **supersession을 앱에 미루면 staleness 누적**(G2가 왜 중요한지의 증거). ⚠️ "V3 49% 붕괴"는 비판측 수치, mem0는 +29.6 temporal gain 주장 — 한쪽만 인용 주의.
- **Cognee — 우리와 가장 닮은 "파이프라인 선언형".** ECL(Extract-Cognify-Load) 타입 그래프 + **옵션 RDF/OWL ontology**, `identity_fields` UUID5 dedup. vs 우리: 우리 ontology는 **강제(FK)**, Cognee는 사후 옵션. supersession은 동급 갭.
- **Basic Memory — 비유의 "한쪽 정답".** md 파일이 SoT인데 그 위에 entity/observation/relation 그래프(SQLite) 파생 = **"책장 단 마크다운"**. vs 우리: Postgres-first(md-first 아님). **행 내부를 atomic observation으로 쪼개는 패턴**이 우리 G1 해법.
- **Letta/MemGPT — self-editing 핫캐시.** core memory 블록을 LLM이 in-place 편집/consolidate(문자수 hard-limit). vs 우리: 권위 행이 SoT. Letta 블록은 우리 행 **위의 핫캐시 레이어**로 차용.
- **LangMem — 메모리 타입 분류축.** semantic/episodic/procedural **3종 타입** + 백그라운드 consolidation. vs 우리: domain 분류만 — **type 축을 domain 위 2차축**으로 얹으면 절차/사례 지식 분리.
- **신흥(2026)**: EverMemOS(engram lifecycle), **Memori(SQL-native 메모리 — 우리 관계형 베팅의 시장 검증)**.

### 7.3 빌려올 것 (우선순위 — 다수 에이전트 + 검증 일치)

| 순위 | 차용 | 출처 | 닫는 갭 |
|---|---|---|---|
| 🥇 | **bitemporal 유효성 레이어** — `valid_at`/`invalid_at`(또는 `is_latest`+`superseded_by` FK) + UPSERT 경로 invalidation 훅(모순 쓰기 시 옛 행 close). 검색 기본 `is_latest`. **TKG 가문 전체가 여기로 수렴 = 강한 신호** | Zep/Graphiti | **G2** (=§5 P1 강화) |
| 🥈 | **atomic observation 분해** — 행 내부 prose를 개별 주소가능 observation으로 | Basic Memory, Cognee | **G1** |
| 🥉 | **memory-type 축**(semantic/episodic/procedural)을 domain 위 추가 | LangMem | — |
| 4 | bounded self-editing 핫캐시 레이어(탐색적) | Letta | — |

> **§5의 P1(is_latest/supersedes)이 이제 "TKG 가문 전체가 수렴하는 사실상 표준"으로 격상.** 단순 개선이 아니라 **분야 컨센서스를 따라가는 것**.

### 7.4 landscape caveat

- 별 수·벤치 수치 다수가 vendor 자체보고. mem0 그래프 기능은 OSS에서 제거(유료화).
- Zep/Graphiti 특성화만 적대적 검증에서 "거의 사실오류 없음"으로 확인 — 나머지는 1차 조사 수준.

---

## 8. 결론

- **"책장 없는 도서관" 비유는 적절하고 강력하다.** naive md 메모리 = 셸빙 1/5 = 측정된 실패 모드와 정확히 일치.
- **SemiColony KB는 그 비판에 대한 답(선언형 셸, 4.5/5)으로 이미 지어져 있다** — 대외적으로 "우리는 책장을 먼저 지었다"는 반대 증명으로 쓸 수 있음.
- landscape 대비 우리는 **선언형 책장은 아웃라이어(최상위), 시간 차원만 결여.** 남은 일은 **bitemporal supersession(isLatest/supersedes)을 빌려와 G1~G3을 닫는 것** — 그러면 선언형 셸 + 시간유효성으로 A·B·C 가문 강점을 동시 보유.

---

## 부록 — 출처

- supermemory: github.com/supermemoryai/supermemory (README, MIT), supermemory.ai/docs (memory-vs-rag, how-it-works, graph-memory, filtering, search, user-profiles, self-hosting), deepwiki.com/supermemoryai/supermemory
- 문제공간: Chroma *Context Rot* (trychroma.com/research/context-rot) · Liu et al. *Lost in the Middle* (arXiv:2307.03172, TACL 2024) · Letta *Agent Memory*
- SemiColony KB: semo-cli v4.18.49, migrations `001_initial.sql` / `015_kb_domain_enforcement.sql` / `016·018_ontology_types` / `025_kb_flat_keys.sql` / `113_kb_history.sql` / `127_kb_domain_semicolony_dual.sql`; `semo kb ontology|get|search|history`
- landscape(§7): mem0 (github.com/mem0ai/mem0, arXiv:2504.19413, issue #5330) · Zep/Graphiti (github.com/getzep/graphiti, arXiv:2501.13956, blog.getzep.com) · Letta/MemGPT (github.com/letta-ai/letta, arXiv:2310.08560) · Cognee (github.com/topoteretes/cognee) · Basic Memory (github.com/basicmachines-co/basic-memory) · LangMem (langchain-ai) · Honcho (github.com/plastic-labs/honcho) · A-MEM (arXiv:2502.12110) · MemoryOS (arXiv:2506.06326) · Memobase · MemoryScope (Alibaba) · txtai · RAGFlow · Memary · Memori (GibsonAI) · EverMemOS (arXiv:2601.02163)
