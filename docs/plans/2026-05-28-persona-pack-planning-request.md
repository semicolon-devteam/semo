# Persona Pack — "실제 동작" 기획 요청 (→ Semo Hermes)

> 요청자: reus 경유 (Claude 세션) · 2026-05-28
> 수신: Semo Hermes (기획) · 산출물은 문서 저장 + action-items 등록 → 타 AI 리뷰
> 대상 기능: SEMO Dashboard v5 의 **Persona Pack** ("제품 1개, 경험은 페르소나로 분기")

## 0. 지금 상태 (퍼블리싱 완료분)

- 새 디자인 handoff#2(Claude Design)가 페르소나 레이어를 추가: 3 팩 `shop`(소상공인)/`personal`(개인)/`worker`(직장인), 같은 레이아웃 다른 콘텐츠.
- **퍼블리시됨**: `/my/personas` 라우트 — 페르소나×뷰(홈/채용/요금제) 전환 미리보기. 파일(신규, additive):
  - `app/(customer)/_ui/personas.jsx` (3 팩 데이터 + PersonaProvider/usePersona/getAgent)
  - `app/(customer)/_ui/screen-persona.jsx` (PersonaHome/Library/Plan)
  - `app/(customer)/my/personas/page.tsx`
- ⚠️ **SEMO Renewel 이 기존 /my·\_ui/screen-\* ·lib/customer·api/my 를 동시 편집 중**(실데이터/테넌시 배선). 충돌 회피로 위 3개 신규 파일만 추가, 기존 파일 미접촉.

## 1. 기획해 주실 것 — "실제로 동작하기 위해 해야 하는 것들"

현재 페르소나 팩은 **mock 데이터(personas.jsx 하드코딩)** 이고 미리보기만 동작. 실제 제품으로 동작하려면:

1. **페르소나 감지·상태 모델**: URL query → 사용자 설정 → 온보딩 선택 → fallback(shop) 우선순위. 어디에 저장(테넌트 메타? 사용자 프로필?), 세션 전파, SSR 일관성.
2. **Persona Pack 스키마·저장소**: 현재 mock 팩 → 실 스키마(JSON) + 저장 위치. 정본 7봇(소상공인)과 개인/직장인 로스터의 관계. agent_listings 의 audience 확장(`customer-shop`/`personal`/`worker`?) 또는 별도 pack 테이블.
3. **per-persona 콘텐츠 파이프라인**: 카피/KPI/활동피드/플랜이 팩마다 다름 → 콘텐츠 소스(누가 채우나, i18n/locale 분리 전략).
4. **SEMO Renewel 실데이터 작업과의 통합**: 그쪽은 소상공인(jeongmin-cafe) 실데이터 배선 중. 페르소나는 그 위에 얹혀야 함 — getInstalledAgents/getActivity 등을 persona-aware 로 일반화하는 방식. **논리 충돌 시 docs/plans/2026-05-28-customer-dashboard-handoff.md 를 SoT 로.**
5. **분석 이벤트**: 어떤 페르소나에서 어떤 위젯/CTA 반응이 좋은지 (handoff#2 eng deliverable 에 9개 이벤트 초안 있음).
6. **나브 노출**: `/my/personas` 진입로(현재 URL only). Sidebar 링크는 shared components.jsx 편집이라 SEMO Renewel 충돌 우려 → 추가 시점·방식 정해주세요.

## 2. 산출물 형식 (요청)

- **기획 문서 저장**: `docs/plans/2026-05-2X-persona-pack-plan.md` (Exec Summary / 상태모델 / Pack 스키마 JSON / 콘텐츠·i18n / 통합 / 분석 / P0·P1·P2).
- **action-items 등록** (타 AI 리뷰용): `semo action-items create --owner planclaw --description "..." --target semo` 식으로 P0/P1 항목을 등록. 리뷰어가 집어갈 수 있게 구체적으로.
- 디자이너/프론트가 바로 이어받을 수준.

## 3. 소스 (참고)

- 새 디자인 번들: `/tmp/semo_handoff2/semo/project/` — 특히 `screen-persona-meta.jsx`(이미 6개 산출물 설계됨: Exec Summary/IA/JSON spec/UX writing/checklist/P0~P2/eng handoff), `personas.jsx`, `brief.md`, `chats/chat2.md`.
- repo 문서: `docs/plans/2026-05-28-customer-dashboard-handoff.md`(SoT), `2026-05-28-customer-dashboard-agents-integration.md` §9(현 실데이터 상태), `2026-05-28-customer-personas-reconciliation.md`(정본 7봇).
- KB: `semo kb get semo decision customer-tables-appdb-architecture-2026-05-28`, `customer-personas-v1-canonical-2026-05-28`.

## 4. 주의

- 소상공인 경험 퀄리티 저하 없이 개인/직장인 확장 가능성이 명확할 것.
- 구현은 SEMO Renewel/추후 담당이 — 지금은 **기획+action-items** 까지.
