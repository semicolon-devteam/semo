# SEMO Persona Pack 실제 동작 기획안 (P0/P1/P2)

작성일: 2026-05-28
범위: 구현 제외, 운영 가능한 설계/작업분할/action-items 정의
SoT 우선순위: `docs/plans/2026-05-28-customer-dashboard-handoff.md` > 본 문서

## 1) Executive Summary

- 방향은 "별도 대시보드 3개"가 아니라 "공통 코어 1개 + persona pack 3개(shop/personal/worker)"로 확정한다.
- 공통 IA(Home/Team/Knowledge/Library/Plan)는 고정, 페르소나는 콘텐츠/카피/추천/지표만 바꾼다.
- persona 결정은 URL → 사용자설정 → 온보딩선택 → fallback(shop) 순으로 resolve한다.
- `/my/personas`는 디자인 미리보기로 유지하고, 실서비스 `/my*`는 동일 스키마로 점진 전환한다.
- SEMO Renewel의 실데이터/테넌시 배선과 충돌을 피하기 위해 신규 레이어(`lib/customer/persona/*`)를 additive로 추가한다.
- P0는 상태결정/스키마/서버주입 경계 확정, P1은 `/my` 실제 적용+분석 이벤트, P2는 콘텐츠 운영 자동화로 분리한다.

## 2) Persona 상태 모델 (실동작)

### 2.1 해석 우선순위

1. URL Query `?p=shop|personal|worker` (세션 임시 오버라이드)
2. 사용자 저장값 `customer_user_settings.persona_id`
3. 온보딩 선택값 `customer_onboarding.persona_id`
4. fallback `shop`

### 2.2 저장 위치

- 사용자 기준: `public.customer_user_settings` (tenant+user 스코프)
- 테넌트 기본값: `public.customer_tenant_settings.default_persona_id` (신규 사용자 초기값)
- 이유: 같은 tenant 안에서도 user별 사용 시나리오가 다를 수 있음(대표/실무자 분리)

### 2.3 SSR 일관성

- 서버 페이지에서 `resolvePersonaContext(request, user, tenant)` 1회 수행 후 모든 화면 prop에 주입
- 클라이언트는 hydration 후 동일 persona를 context로 소비 (깜빡임 방지)

## 3) Persona Pack 스키마/저장소

### 3.1 정본 구조

- Pack 정본은 코드 저장소(`packages/semo-dashboard/personas/*.json`)에 버전 관리
- 런타임 캐시는 `lib/customer/persona/registry.ts`로 로드
- 운영자가 수정 가능한 동적 오버라이드가 필요하면 P2에서 DB 테이블(`customer_persona_overrides`) 추가

### 3.2 최소 JSON 스키마

```json
{
  "id": "shop",
  "label": "소상공인",
  "workspace": { "name": "정민 카페", "subtitle": "Customer" },
  "ownerLabel": "사장님",
  "home": {
    "greeting": { "title": "...", "subtitle": "..." },
    "kpis": [{ "id": "kpi1", "label": "...", "value": "...", "hint": "..." }],
    "feedTemplates": [{ "id": "f1", "verb": "...", "target": "..." }],
    "nudgeTemplates": [{ "id": "n1", "title": "...", "primary": "...", "secondary": "..." }],
    "planLabel": "..."
  },
  "team": { "title": "...", "ctaNew": "...", "filters": ["..."] },
  "knowledge": { "title": "...", "categories": ["..."] },
  "library": { "heroTitle": "...", "audienceChips": ["..."], "rows": ["..."] },
  "plan": { "audienceCopy": "..." },
  "analytics": { "personaKey": "shop" }
}
```

### 3.3 정본 7봇과의 관계

- `shop`은 `2026-05-28-customer-personas-reconciliation.md`의 7봇 정본을 그대로 사용
- `personal/worker`는 동일 agent_listings를 재사용하되, 기본 추천/라벨/노출순만 pack에서 제어
- audience 확장은 `agent_listings.metadata.audience_tags[]` (`customer-shop`,`customer-personal`,`customer-worker`) 권장

## 4) 콘텐츠/i18n 운영

- 카피는 화면 하드코딩 금지, `persona pack + i18n key`로 분리
- 규칙:
  - 구조 텍스트(버튼/탭/고정 라벨): i18n
  - 맥락 텍스트(인사/피드 템플릿/위젯문구): persona pack
- 운영 주체:
  - Product/PlanClaw: 문안 정책
  - DesignClaw: 톤 검수
  - Engineering: schema validation + fallback 보장

## 5) SEMO Renewel 실데이터 작업과 통합

- 충돌 회피 원칙: 기존 `/my*` 실데이터 함수 수정 최소화, persona 레이어만 얇게 추가
- 통합 방식:
  1. 기존 `getInstalledAgents/getActivity/getBilling` 결과 유지
  2. `applyPersonaViewModel(data, personaPack)`로 표시 텍스트/카테고리/CTA만 치환
  3. 실데이터 없는 영역만 pack 템플릿 사용
- 금지:
  - 테넌시/인증 경로 재설계
  - `app/(customer)/_ui/screen-*` 대규모 병렬수정

## 6) 분석 이벤트

필수 이벤트(공통 payload: tenant_id, user_id, persona_id, screen, ts)

1. `persona_resolved`
2. `persona_switched`
3. `home_nudge_clicked`
4. `library_recommendation_clicked`
5. `library_hire_started`
6. `library_hire_completed`
7. `plan_upgrade_clicked`
8. `team_quick_action_clicked`
9. `knowledge_filter_changed`

## 7) /my/personas 노출 전략

- 즉시 Sidebar 고정 노출하지 않음(충돌 위험)
- 단계:
  - P0/P1: URL direct 진입 유지(`/my/personas`)
  - P2: 공용 nav 안정화 후 `Labs` 또는 `Preview` 섹션에 조건부 노출

## 8) 실행 우선순위

### P0 (설계 잠금 + 안전한 골조)

1. Persona resolution 규칙/저장모델 확정 (URL→settings→onboarding→fallback)
2. persona JSON schema + validator + default pack(shop) 고정
3. 서버 주입 경계(`resolvePersonaContext`, `applyPersonaViewModel`) 설계 문서화
4. `agent_listings` audience_tags 확장안 확정(마이그레이션 설계까지만)

### P1 (실서비스 최소 적용)

1. `/my` Home에 persona pack 적용(카피/KPI 라벨/CTA), 실데이터는 유지
2. `/my/library`, `/my/plan`에 persona 카피/추천 행만 적용
3. 분석 이벤트 9종 중 핵심 5종 먼저 계측
4. fallback/SSR/hydration 회귀 체크리스트 통과

### P2 (운영 확장)

1. 콘텐츠 편집 운영(override DB 또는 CMS) 도입
2. Team/Knowledge까지 full persona 적용
3. Sidebar 노출 전략 확정 및 롤아웃
4. persona별 성과 대시보드(전환/잔존/업셀)

## 9) 리스크/완화

- 리스크: 실데이터 함수와 persona 치환 로직이 섞여 회귀 발생
  - 완화: 데이터(fetch)와 표현(view model) 레이어 분리 강제
- 리스크: shop 품질 저하
  - 완화: snapshot 기준선 테스트(현재 shop UI를 golden으로 보존)
- 리스크: Renewel과 파일 충돌
  - 완화: 신규 파일 중심(additive), 기존 screen 파일 대규모 수정 금지

## 10) Sync 상태

- Local files: 본 계획문서 신규 작성 완료
- KB/DB: 본 문서는 planning artifact이며 KB write-back 미수행
- Workspace runtime: Renewel의 실데이터 배선과 병행 가능하도록 충돌 회피 설계 반영
