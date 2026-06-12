# SemiColony 전략 압박검증 — Decision & Risk Map (2026-06-12)

> 근거: 화이트보드(2026-06-11) + 이 세션 멀티에이전트 red-team(6베팅 × red-team+적대검증, 12에이전트). decided_by: reus.
> 관련 SoT: KB `semicolony/decision/soho-installable-product-direction-2026-06-09`(v9, B1~D2), `docs/plans/2026-06-09-soho-1st-delivery-spec.md`.

## 한 줄 결론
해자(가게별 지식 × 제품화된 손 × 컨시어지)는 살아있다. 단 **화이트보드의 "두뇌=우리 Proxmox 고객별 VM"은 사실상 사망**(canonical KB B4와 split-brain + 데이터센터 IP anti-bot 차단 + SPOF). 실가치를 내는 지식 레이어는 **Vector KB RAG(라이브)**이고, **관계 온톨로지는 아직 게이트웨이에 미연결된 스키마 단계**다.

## 확정 결정 (Resolved)
- **D1 — 두뇌·추론 실행 위치 = 클라우드 관리형 확정** (E2B/Modal/Fly 류). Proxmox VM-per-customer는 명시 기각(anti-bot IP 차단 PoC + SPOF + canonical B4와 충돌). **손 = 고객 PC**(주거 IP + 고객 세션 — 선택 아니라 anti-bot이 강제). 워크스테이션은 "두뇌 VM"이 아니라 **미래 on-device 옵션 전용**으로만 남김.
- **D2 — 가격 SoT = 라이브 시드(29k/79k/199k)로 freeze.** "월 30만"은 *목표*로만 유지. 손(스마트스토어 자동등록 등) ROI가 파일럿 1건에서 측정 입증되기 전까지 30만 플랜 신설·영업·결제 카탈로그 동결.
- **D3 — 관계 온톨로지 = 1차 핵심 차별점으로 유지(창업자 결정).** 단 아래 GA 게이트 충족 조건부. (압박검증 권고는 "2차 강등"이었으나 reus가 1차 유지 결정 → 리스크를 게이트로 관리.)
- **D4 — On-device "특이점" 베팅 = DEFERRED(call-option).** 코드는 이미 옵션(`preferred_hosts` 폴백·host_kind 어댑터). GPU 하드웨어 capex ₩0 유지 + 피칭/로드맵에서 "온디바이스로 비용 0" 서사 제거. 위반(워크스테이션 GPU 선구매/투자자 단가우위 약속) 즉시 risk→blocker 승격.
- **D5 — Visual Office = DEFERRED.** 풀 가상오피스 신규 빌드 금지. 기존 `screen-team.jsx`(현 mock)를 E5.4 실데이터 **결과중심** read-only 뷰로 wiring만. 타겟 canonical 확정 후 재검토.

## 용어 정리 (KB vs Vector DB vs Ontology — 혼선 해소)
- **KB ⊃ (Vector index + Ontology)**. KB=지식 저장소 전체, Vector=의미유사도 검색(RAG 엔진), Ontology=명시적 관계 그래프(책장).
- ⚠️ 코드에 "ontology"가 둘: (1) `semo.ontology`=도메인 스키마 레지스트리(게이트웨이 upsert 검증용, 관계그래프 아님), (2) `entity_relations`+`relation_types`=팔란티어식 관계그래프(보드의 온톨로지).
- **현 위치**: KB/게이트웨이 🟢라이브 · Vector RAG 🟢라이브(게이트웨이 노출·E2E 통과, **제품이 실제 소비하는 그라운딩**) · 관계 온톨로지 🟡스키마/시드(주얼리 27)/PoC만, **게이트웨이 미노출 → 응대·생성에 미연결**.

## 남은 리스크 (Remaining Risks)
- **R1 면책 환상(보안, blocker였음)** — "우리 서버 미보관/YOLO 책임 고객"이 이미 깨짐: Gmail/Calendar OAuth 토큰을 `tenant_channels`에 중앙 암호화 저장 → 우리가 이미 *처리자*. 완화: "미보관" 마케팅 표현 즉시 폐기 + D2(개인정보/위탁) 법무·동의 UX + 최소수집 + E&O 보험. owner: reus/법무.
- **R2 실행층 격리 미설계** — kb-gateway 데이터 격리는 견고하나 *에이전트 실행 프로세스·자격증명·키* 테넌트 격리 미설계. 완화: 손 실행을 테넌트별 격리 프로세스(컨테이너/VM)로 강제, userDataDir·OS키체인·ANTHROPIC_API_KEY를 경계 밖 접근 불가로 코드 검증.
- **R3 손-loop reason 위치** — 멀티스텝 폼 자동화의 observe→reason→act 폐루프. 중앙 추론이면 매 스텝 왕복 + 고객 세션이 중앙으로 흘러 B2 미보관 위반. → reason도 **고객 PC 엣지(Hermes) 폐루프** 강제가 정답에 가까움(중앙=계획/그라운딩/결과수집만). 검증 필요.
- **R4 컨시어지·셋업 = 구조적 마진 잠식** — 1차 차별점 4개 중 3개(설치대행·컨시어지 이미지·온보딩 시드·저신뢰 온톨로지 넛지)가 사람 손. 완화: 컨시어지 이미지=종량 add-on 분리, 셋업=셀프 마법사+화이트글러브 30분 상한, LTV 모델에 사람비용 명시 변동비 계상.
- **R5 타겟 분열** — 라이브 대시보드 코드 페르소나 = **shop/personal/worker(소상공인)**가 SoT. "3–30명 프로젝트 운영조직"은 stale(아카이브) → **내가 개선한 사업소개서 덱(`semicolony-business-intro.html`)이 오히려 어긋남.** 덱 타겟을 소상공인으로 재정렬 필요(별도 작업).
- **R6 온톨로지 자동추출 품질/부패** — 자체 PoC: 관계-only는 거짓단정("주문제작 안 함")으로 일반 챗봇보다 나빴음. 자동승인(≥0.85) 관계의 stale 폐기 경로 미설계.

## Implementation Gates (구현 전 충족 조건)
- **G1(E5.1 선결)**: kb-gateway 공개배포 + TLS/ingress (현재 127.0.0.1).
- **G2(D3 온톨로지 1차 유지의 조건)**: (a) 관계 온톨로지를 **게이트웨이에 노출 + 응대/생성 파이프라인에 연결**, (b) 파일럿에서 **온톨로지 ON vs OFF A/B 증분이 양(+)** 이고 컨시어지/추출 비용을 단위경제 내에서 초과, (c) **stale 관계 자동폐기 경로**(카탈로그 동기화 시 retire / valid_to TTL). 셋 다 못 넘으면 자동으로 2차 보강층으로 강등.
- **G3(R1/R2)**: 테넌트별 실행 격리 코드 강제 + D2 법무·동의 UX 마감 = 출시 차단조건.
- **G4(D2)**: 객단가별 [API토큰 + 컨시어지분 + 지원(+GPU 감가는 on-device 시)]을 29k·79k·199k에 대입한 **1페이지 손익분기 모델**(현재 부재).
- **G5(D1)**: 손-loop reason=엣지 확정 + inbox/outbox 오프라인 큐(E5.3, 현재 미구현) 스파이크.

## Required Tests / QA
- 온톨로지 A/B: 파일럿 3업종 실데이터(잡담·오타 포함)에서 RAG-only vs RAG+온톨로지 응대 정확도/만족도.
- 손 E2E: 스마트스토어 자동등록 멀티스텝 성공률(테스트 판매자계정 확보 후).
- 격리: 동일 두뇌가 N테넌트 손 무인 구동 시 프로필/키 교차오염 0 검증.

## Deferred Questions
- On-device 전환 트리거 메트릭(오픈웨이트 통과율 ≥ 프론티어 X% AND 토큰단가 < Y) — 재검토: 파일럿 후.
- 워크스테이션 fleet(20+ 노드) 활용처 — on-device 옵션 외 용도 재정의.

## KB / Action Items
- KB write-back: `semicolony/decision/strategy-stress-test-2026-06-12` (이 문서 요약 + D1~D5).
- Action item 후보: G1(게이트웨이 TLS 배포)·G4(손익분기 1페이지)·R5(사업소개서 덱 소상공인 재정렬)·R1(미보관 표현 폐기+법무).
