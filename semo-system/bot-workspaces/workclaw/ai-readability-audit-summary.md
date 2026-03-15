# AI Readability ESLint Audit Summary (2026-03-14)

## 프로젝트별 위반 사항 집계

| 프로젝트 | AI Readability 위반 | 총 ESLint 에러/경고 | 주요 위반 |
|---------|------------------|------------------|---------|
| **axoracle** | 17건 | 77건 (60 error, 17 warn) | max-lines-per-function: 9건<br>complexity: 7건<br>max-lines: 1건 (734줄) |
| **bebecare** | 61건 | ~150건+ | max-lines-per-function: 많음<br>complexity: 많음<br>max-depth: 3건 |
| **star-spot** | 24건 | ~80건+ | max-lines-per-function: 여러 건<br>complexity: 일부<br>TODO 주석: 5건 |
| **by-buyer** | 28건 | ~120건+ | max-lines-per-function: 7건<br>complexity: 4건<br>import/order: 많음 |

## 공통 위반 패턴

### 1. import/order 위반 (전 프로젝트)
- React import가 first가 아님
- `@/` alias import 순서 불일치
- type import 순서 불일치

### 2. @typescript-eslint/consistent-type-imports (전 프로젝트)
- `import type` 미사용
- 런타임 import와 타입 import 혼재

### 3. max-lines-per-function (컴포넌트 100줄 초과)
- **axoracle**: 9건
  - OccupationDetail: 542줄 (복잡도 38)
  - TaskDetailModal: 417줄 (복잡도 17)
  - CountryPageClient: 246줄
  - SurveyOverlay: 446줄 (복잡도 27)
- **bebecare**: 많음
  - API routes에서 빈번 (GET/POST 핸들러)
  - chat/page.tsx: 249줄
  - log/page.tsx: 244줄
- **star-spot**: 여러 건
  - ScrapePage: 267줄
  - PrivacyPage: 209줄
  - ReportDetailPage: 209줄
- **by-buyer**: 7건
  - VehicleWizard: 447줄 (복잡도 38)
  - AppraisalsPage: 274줄 (복잡도 24)

### 4. complexity (복잡도 >15)
- **axoracle**:
  - OccupationDetail: 38
  - TaskPieChart: 16
  - getAllOccupationData: 36
  - SurveyOverlay: 27
- **bebecare**:
  - API routes에서 빈번 (19~38)
  - buildCategoryMessage: 16
- **by-buyer**:
  - VehicleWizard: 38
  - MessageBubble: 24
  - AppraisalsPage: 24

### 5. no-warning-comments (TODO/FIXME 금지)
- **star-spot**: 5건 (profile/page.tsx, celebrities/route.ts)
- 다른 프로젝트는 비교적 적음

### 6. max-depth (중첩 >5)
- **bebecare**: chat/route.ts (6단계 중첩), chat/page.tsx (7단계 중첩)

## 리팩토링 우선순위

### Phase 1 — Import 정리 (자동 수정 가능)
```bash
# 각 프로젝트에서 실행
npx eslint src --ext .ts,.tsx --fix
```
- import/order, type-imports 대부분 자동 수정됨
- 예상 소요 시간: 프로젝트당 ~5분

### Phase 2 — 큰 파일/함수 분리 (수동)
**우선순위 높음 (>400줄 또는 복잡도 >30)**:
1. **axoracle/OccupationDetail.tsx** (734줄, 복잡도 38)
   - 훅 분리: `useOccupationData`, `useCountryData`
   - 컴포넌트 분리: TaskSection, SalarySection, EducationSection
2. **axoracle/SurveyOverlay.tsx** (446줄, 복잡도 27)
   - 컴포넌트 분리: SurveyForm, SurveySteps
3. **bebecare/chat/route.ts** (API 핸들러 141줄, 복잡도 24)
   - 함수 분리: buildPrompt, handleStreamResponse
4. **by-buyer/VehicleWizard.tsx** (447줄, 복잡도 38)
   - 컴포넌트 분리: StepManufacturer, StepModel, StepTrim 등

**우선순위 중간 (100~400줄)**:
- 각 프로젝트의 200줄 이상 파일들

### Phase 3 — 복잡도 개선 (수동)
- 복잡도 20+ 함수들 early return, 조건 추출로 단순화

## 추천 작업 순서

1. **오늘 (2026-03-14)**: Import 정리 (--fix)
2. **주말**: axoracle 2개 큰 파일 리팩토링
3. **다음 주**: bebecare, by-buyer 리팩토링
4. **지속**: 새 코드에서 ESLint 룰 준수

## 자동 수정 가능한 것
- import/order
- @typescript-eslint/consistent-type-imports (일부)
- @typescript-eslint/no-unused-vars (일부)

## 수동 작업 필요한 것
- max-lines-per-function
- complexity
- max-depth
- no-warning-comments (TODO → GitHub Issue)
