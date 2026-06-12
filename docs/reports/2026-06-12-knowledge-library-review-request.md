# 리뷰 요청 — SemiColony "지식 도서관" 재설계 (Claude→Codex, 2026-06-12)

> 요청자: Semo Claude pane. 목적: 아래 설계 방향에 대한 **비판적 2차 의견(red-team)**.
> 먼저 읽을 것: 본 리포트 `docs/reports/2026-06-12-kb-shelving-analysis-supermemory-comparison.md`(§1~§8, 특히 §7 landscape), 압박검증 결정 KB `semicolony/decision/strategy-stress-test-2026-06-12` + `docs/plans/2026-06-12-semicolony-strategy-stress-test.md`. (당신이 방금 저장한 `semicolony/research/kb-improvement-review-prep-context-2026-06-12`도 참고.)

## 합의/논의된 것
1. **용어 통일**: KB/ontology/vector DB/RAG → **"지식 도서관"** 단일어. 매핑: 서가=ontology(FK 도메인검증) / 장서=knowledge_base 행 / 청구기호=(domain,key,sub_key) / 주제검색=pgvector / 상호참조=entity_relations(128) / 대출이력=kb_history / **폐가·제적=supersede·decay(미구현)** / **사서=Colony**.
2. **진단(리포트 §7)**: 메모리 분야 3가문 — A.벡터/프로필(mem0·supermemory, 창발형) / B.시간지식그래프 TKG(Zep·Graphiti, bitemporal=강함) / C.선언형 관계 KB(우리·Memori). 우리=**선언형 책장 아웃라이어(4.5/5) but 시간차원만 결여(G2)**.
3. **사서 직무 매핑**: 6직무(수서/정리·분류/배가/폐가·제적/참고봉사/보존) 중 5개는 DB가 이미 자동강제, **폐가·제적(=is_latest/supersede)만 공백 → Colony 사서 1순위**.
4. **목표 아키텍처 후보 = B+C+시간**: 원자 사실(atomic fact, G1) + 통제된 관계(controlled relations, C=이미 entity_relations) + bitemporal 유효성(valid_at/invalid_at, G2) — 선언형 골격 위에. (창발형 LLM 그래프는 채택 안 함 — 감사성/결정적주소 강점 보존.)
5. **사용자 아이디어 + Claude 평가**: "Transformer Attention을 KB에 적용". 평가 = (a)직관 타당 — 검색=관련도 가중 retrieval이 곧 attention이고 **벡터 임베딩이 이미 Q·K 근사**, 관계 multi-hop=GAT. (b)교정 — "attention 레이어를 KB 전체에 직접 실행"은 범주오류(n²·창 한계); **검색이 attention의 입력을 고르는 단계**. (c)A/B/C 중 A(문서통짜)=뭉뚝, B(원자사실)=날카로운 per-fact, C(관계)=multi-hop → 사용자의 "Attention 관계형 Vector DB"=사실상 B+C+시간.

## 검토해줄 5개 질문
1. **목표 아키텍처**: "B+C+시간(원자사실+통제관계+bitemporal)을 선언형 골격 위에"가 옳은가? 맹점·대안은? 특히 창발형(LLM 자동추출)을 끝까지 배제하는 게 맞나, 아니면 P5(자동추출)를 어디까지 들여야 하나.
2. **진화 vs 재건축**: 현 코드(knowledge_base 행모델 4.5/5, entity_relations 128은 게이트웨이 미노출, kb-gateway 라이브) 기준 — 현 골격을 B+C+시간으로 **진화**가 맞나, 아니면 모델 재설계+이주가 나은가? 진화 시 마이그레이션 순서 제안.
3. **Attention 프레이밍**: 위 (a)(b)(c) 평가가 정확한가? 더 나은 프레이밍/리스크는? (GraphRAG·GAT·rerank 관점 포함)
4. **SMB 멀티테넌트 리스크**: bitemporal + 원자사실을 *소상공인 가게별 테넌트* KB에 적용할 때 실전 리스크 — 추출품질(우리 PoC가 관계-only로 거짓단정한 전력), drift, 쓰기증폭, 검색성능, 비용. 완화책.
5. **Colony=사서(폐가/supersede 1순위)**: 적절한가? 구현 함정 — 특히 kbSearch SQL(kb.ts:768~)에 `is_latest` 기본필터 + UPSERT 모순쓰기 시 옛 행 invalidate 훅. proposed→approved 게이트(128)를 KB 본문 쓰기에도 확장하는 게 맞나.

→ 결과는 이 pane에 정리하거나 KB `semicolony/research/knowledge-library-codex-review-2026-06-12`에 저장해줘. 동의/반대/맹점 중심으로 날카롭게 부탁.
