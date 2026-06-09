# E0 온톨로지 1사이클 PoC — 결과 (2026-06-09)

**목적**: 가게별 소형 온톨로지(핵심 차별점)의 핵심 루프 — 추출 → `proposed` → confidence 임계 승인 → live 조회 → 그라운딩 — 이 **실 스키마(`128_entity_relations`/`relation_types`, `129` tenant)에서 실제로 도는지** 검증.

**실행**: `node docs/reports/poc/e0-ontology-cycle-poc.mjs` (라이브 appdb, 고정 테스트 tenant, 종료 후 스크래치 정리).

## 결과 (PASS)

| 단계                                    | 결과                                           |
| --------------------------------------- | ---------------------------------------------- |
| 1. 추출(시뮬) → proposed INSERT         | 6건                                            |
| 2. confidence ≥ 0.85 자동 승인          | **4건 approved**                               |
| 2. 임계 미달(0.72·0.69) → proposed 유지 | **2건** (= 대시보드 1-탭 넛지 / 컨시어지 대상) |
| 3. `v_entity_relations_live` 조회       | 승인 4건만 노출(유효기간 필터 포함)            |
| 4. 그라운딩 컨텍스트 조립               | 생성 모듈 주입용 문장 4줄                      |
| 5. cleanup                              | 테스트 tenant 6행 삭제(잔여 0)                 |

**그라운딩 컨텍스트 샘플** (생성 모듈이 "이 가게를 알고" 쓰도록 주입):

```
- 실버 미니멀 반지 —[made_of]→ 925 실버
- 실버 미니멀 반지 —[in_category]→ 반지
- 실버 미니멀 반지 —[listed_on]→ 스마트스토어
- 실버 미니멀 반지 —[gift_suitable_for]→ 기념일 선물
```

## 입증된 것 vs 잔여(build)

- ✅ **입증**: 스키마 사이클(proposed→approved), **confidence 임계 하이브리드 승인**(자동/보류 분기), `v_entity_relations_live` 그라운딩 조회, tenant 격리, 멱등 cleanup. → E0의 데이터/승인 메커니즘은 라이브로 작동.
- ⏳ **잔여(build ticket)**: (T0.2) 추출을 Colony hermes(`semo-colony`) LLM 실호출로 교체(현재 후보 triple 모사). (T0.3) 보류분 대시보드 1-탭 넛지 UI. (T0.4) 그라운딩을 콘텐츠 5모듈 생성 컨텍스트에 실제 주입(kb-gateway 경유). (T0.5) `/my/knowledge` 라이브 그래프.
- 어휘: `130_jewelry_relation_types.sql`(주얼리 관계 27종) 라이브 적용 완료 → 추출이 통제 어휘로 관계 생성 가능.

## 운영 메모

- entity_relations 는 현재 gateway API 미노출(직접 pg). E0 build 시 gateway에 `/relations` (테넌트 스코프) 추가 검토 — 고객 PC/대시보드가 직접 DB 안 보게.
