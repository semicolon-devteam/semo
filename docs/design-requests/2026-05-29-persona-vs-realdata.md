# 디자인 요청 — Persona(모드) ↔ 실데이터 대시보드 정합 (2026-05-29)

> 대상: SEMO Dashboard v5 디자인(claude.ai/design 핸드오프, "완본"). 구현 중 발견한
> **디자인 ↔ 실제 소스/로직 불일치**를 정리하고 디자인 판단을 요청합니다.

## 배경

- 디자인의 **persona 시스템**(`personas.jsx`, `screen-persona.jsx`, `screen-persona-meta.jsx` →
  구현: `/my/personas`)은 **대시보드 전체(home/team/knowledge/library/plan)** 를
  페르소나별 **mock 팩**(`personas/{shop,personal,worker}.json`)으로 렌더한다.
  즉 페르소나를 바꾸면 화면 전체 콘텐츠가 통째로 바뀐다.
- 반면 실제 제품 **`/my`**(home/team/knowledge/library/plan)는 **실 appdb 데이터**
  (테넌트의 실제 `agent_installs`·`agent_activity`·`subscriptions`)로 렌더되며,
  페르소나-특정 카피가 아니라 범용이다.
- 결과: **두 개의 평행 대시보드**가 존재 — `/my`(실데이터) vs `/my/personas`(페르소나 mock).
  사용자에게 둘의 관계가 모호하다.

## 이번에 구현한 것 (불일치와 무관한 sound 부분)

- 처음 1회 페르소나 선택(`/my/start`) → `customer_user_settings` 저장 → `resolvePersonaId`가
  사용자 저장값을 기본값으로 사용.
- 어드민 셸 스위처: 모든 모드(가게/개인/직장인 미리보기 `/my/personas?p=` + 운영팀 `/`).
- 비어드민 팀원: 내 가게 ↔ 운영팀. 외부 고객: 자기 페르소나 고정.

## 결정이 필요한 디자인 질문

1. **persona가 실 `/my`에 어떻게 반영되어야 하나?**
   - (A, 권장) persona = **온보딩 프레이밍 + 추천 직원(library) + 빈상태/인사 카피**만 좌우.
     라이브 대시보드는 실데이터 유지(페르소나는 "개인화"이지 콘텐츠 교체 아님).
     `/my/personas`는 어드민/영업 **미리보기 쇼케이스**로만.
   - (B) `/my` 전체를 persona별로 스왑 — 그러면 실데이터를 persona 템플릿에 **머지**해야 함
     (예: 직장인 페르소나인데 카페 직원을 채용한 경우 무엇을 보여줄지) → 실데이터 모델과 충돌, 복잡.
2. **per-persona 직원 카탈로그?** persona 팩은 페르소나마다 **다른 직원 세트**(가게=주문이/회계도리,
   직장인=다른 봇)를 가정한다. 그러나 실 `agent_listings`는 **단일 카탈로그**(`audience='customer'`).
   → persona별 추천/필터가 필요하면 `agent_listings`에 **audience_tags(또는 persona_tags)** 컬럼이
   필요(데이터 모델 변경). 디자인은 이를 전제하는지?
3. **`/my` vs `/my/personas` 라우트 관계** — `/my`를 persona-aware로 통합할지(머지),
   아니면 `/my/personas`를 미리보기 전용으로 둘지.

## 권장

**(1)=A, (2)=audience_tags 도입(추천 한정), (3)=`/my` 유지 + `/my/personas`는 미리보기.**
이러면 실데이터를 깨지 않고 persona가 카피·추천만 개인화한다. 확정 주시면 그에 맞춰
`/my` 화면에 persona 카피/추천을 결선하겠습니다(현재는 persona 선택·저장·어드민 스위처까지 구현됨).
