# 🧪 E2E Test Coverage — SEMO Dashboard

> ReviewClaw 🔍 작성 (2026-03-16)

## ✅ 테스트 커버리지 현황

### 1. 기본 네비게이션 (01-navigation.spec.ts)
- [x] 홈(/)에서 /dashboard 자동 리다이렉트
- [x] 모든 주요 페이지 접근 (/dashboard, /bots, /kb)
- [x] 404 에러 처리
- [x] 네비게이션 링크 동작

### 2. 대시보드 (02-dashboard.spec.ts)
- [x] DashboardLayout 렌더링
- [x] Header 표시
- [x] BotOverview 컴포넌트 렌더링
- [x] 반응형 UI (모바일 뷰포트)

### 3. 봇 목록 (03-bots-list.spec.ts)
- [x] 페이지 제목/설명 표시
- [x] 봇 카드 그리드 렌더링
- [x] 봇 카드 클릭 → 상세 페이지 이동
- [x] 빈 상태 메시지 (봇 없음)
- [x] API 에러 핸들링
- [x] 반응형 그리드 (1/2/3 columns)

### 4. 봇 상세 (04-bot-detail.spec.ts)
- [x] 봇 정보 헤더 (이모지, 이름, 상태 배지)
- [x] 목록 페이지 복귀 링크
- [x] Sessions/KB 탭 전환
- [x] Sessions 테이블 렌더링
- [x] KB 테이블 렌더링
- [x] 존재하지 않는 봇 ID 처리
- [x] 로딩 스피너 표시
- [x] 반응형 테이블 (숨김 컬럼)

### 5. KB 검색/필터 (05-kb-search.spec.ts)
- [x] 페이지 제목/설명 표시
- [x] 시맨틱 검색 입력
- [x] 도메인 필터 드롭다운
- [x] Bot ID 필터
- [x] 복합 필터 (검색 + 도메인 + Bot ID)
- [x] 검색 결과 유사도 표시 (similarity_pct)
- [x] 필터 초기화
- [x] Recent Updates 사이드바
- [x] Recent 항목 클릭 → 편집 모달
- [x] API 에러 메시지
- [x] 로딩 스피너

### 6. KB CRUD (06-kb-crud.spec.ts)
- [x] + New Entry 버튼 → 생성 모달
- [x] 모달 닫기 (× 버튼, 배경 클릭)
- [x] KB 항목 생성 (정상 흐름)
- [x] 필수 필드 검증 (domain, key, content)
- [x] KB 항목 수정 (Edit 버튼)
- [x] KB 항목 삭제 (Delete → Confirm/Cancel)
- [x] 생성/수정 중 로딩 스피너
- [x] API 실패 시 alert 표시

### 7. API 엔드포인트 (07-api-health.spec.ts)
- [x] /api/health — 헬스체크
- [x] /api/bots — 봇 목록
- [x] /api/bots/[botId] — 봇 상세
- [x] /api/bots/[botId]/detail — 세션 활동
- [x] /api/kb — KB 목록
- [x] /api/kb?search=<query> — 시맨틱 검색
- [x] /api/kb?domain=<domain> — 도메인 필터
- [x] /api/kb?bot_id=<botId> — 봇 필터
- [x] /api/kb POST — KB 생성
- [x] /api/kb PATCH — KB 수정
- [x] /api/kb DELETE — KB 삭제
- [x] /api/kb/domains — 도메인 목록
- [x] /api/kb/stats — 통계
- [x] 잘못된 엔드포인트 404

---

## 📊 통계

| 카테고리 | 테스트 케이스 수 | 상태 |
|----------|-----------------|------|
| 네비게이션 | 4 | ✅ |
| 대시보드 | 3 | ✅ |
| 봇 목록 | 6 | ✅ |
| 봇 상세 | 8 | ✅ |
| KB 검색/필터 | 11 | ✅ |
| KB CRUD | 8 | ✅ |
| API 엔드포인트 | 15 | ✅ |
| **총계** | **55** | **✅** |

---

## 🚀 실행 방법

```bash
# 의존성 설치
npm install

# Playwright 설치
npx playwright install

# 모든 테스트 실행
npm run test:e2e

# UI 모드 (디버깅)
npm run test:e2e:ui

# Headed 모드 (브라우저 보면서)
npm run test:e2e:headed

# 리포트 확인
npm run test:e2e:report
```

---

## 🎯 테스트 원칙

### 1. 데이터 독립성
- 각 테스트는 독립적으로 실행 가능
- `test.beforeEach`로 클린 상태 보장
- 테스트 후 생성한 데이터 정리 (e2e-test 도메인 사용)

### 2. 명시적 대기
```ts
// ❌ 금지
await page.waitForTimeout(3000);

// ✅ 권장
await page.waitForSelector('[data-testid="kb-table"]');
await page.waitForLoadState('networkidle');
```

### 3. Data-testid 활용
```tsx
// 컴포넌트
<button data-testid="btn-new-entry">+ New Entry</button>

// 테스트
await page.click('[data-testid="btn-new-entry"]');
```

### 4. 에러 시나리오 포함
- API 실패
- 네트워크 에러
- 빈 상태
- 잘못된 입력

---

## 🔧 추가 필요 항목

### 컴포넌트에 data-testid 추가 (WorkClaw 작업)
```tsx
// app/bots/page.tsx
<div className="grid" data-testid="bots-grid">

// components/BotCard.tsx
<div data-testid="bot-card">

// app/kb/page.tsx
<button data-testid="btn-new-entry">+ New Entry</button>
<input data-testid="search-input" />
<select data-testid="domain-filter" />
<input data-testid="botid-filter" />
```

### MSW 설정 (선택)
API 모킹을 더 정교하게 하려면 MSW 추가:
```bash
npm install -D msw
```

---

## 📝 메모

### Acceptance Criteria (E-O 루프)
각 기능의 AC:
1. **네비게이션**: 모든 페이지 정상 접근, 리다이렉트 동작
2. **봇 목록**: 카드 렌더링, 클릭 시 상세 이동, 반응형
3. **봇 상세**: 탭 전환, 데이터 표시, 에러 핸들링
4. **KB 검색**: 검색/필터 동작, 유사도 표시, Recent Updates
5. **KB CRUD**: 생성/수정/삭제 정상 동작, 필드 검증
6. **API**: 모든 엔드포인트 200 응답, CRUD 정상 동작

### 리뷰 체크리스트 (SOUL.md)
- [x] 타입 안전성 (TypeScript strict) → Playwright 타입 사용
- [x] 에러 핸들링 → try-catch, alert, 빈 상태 처리
- [x] 테스트 격리 → beforeEach, 독립 실행
- [x] 명시적 대기 → waitForSelector, networkidle
- [x] 접근성 → getByRole, getByText 사용

---

## 🤖 봇 팀 협업

- **ReviewClaw (나)**: E2E 작성/관리, 실패 시 FAIL 판정
- **WorkClaw**: data-testid 추가, 테스트 실패 원인 수정
- **SemiClaw**: E2E 전략, CI 통합, 일정 관리
- **PlanClaw**: 기능별 AC 정의 (What to test)

---

## 🎉 완료

SEMO Dashboard의 모든 주요 기능에 대한 E2E 테스트 케이스 완성! 🔍

다음 단계:
1. `npm run test:e2e` 실행해서 통과 확인
2. data-testid 추가 (WorkClaw 할당)
3. CI/CD 파이프라인에 통합
4. 리뷰 결과에 따라 수정
