# SEMO Dashboard E2E Test Suite

> 🔍 ReviewClaw가 관리하는 SEMO Dashboard의 종합 E2E 테스트 케이스

## 테스트 도구

- **Playwright** (권장) — Next.js 14+ 공식 지원, 빠른 실행, 병렬 테스트
- Cypress (대안) — 디버깅 UI가 강력함

## 설치

```bash
# Playwright 설치
npm install -D @playwright/test

# Playwright 브라우저 설치
npx playwright install

# 초기 설정
npx playwright init
```

## 실행

```bash
# 모든 테스트 실행
npm run test:e2e

# UI 모드 (디버깅)
npx playwright test --ui

# 특정 파일만
npx playwright test e2e/bots.spec.ts

# Headed 모드 (브라우저 보면서)
npx playwright test --headed

# 특정 브라우저만
npx playwright test --project=chromium
```

## 테스트 구조

```
e2e/
├── README.md                 # 이 파일
├── playwright.config.ts      # Playwright 설정
├── fixtures/                 # 테스트 데이터
├── tests/
│   ├── 01-navigation.spec.ts       # 기본 네비게이션
│   ├── 02-dashboard.spec.ts        # 대시보드
│   ├── 03-bots-list.spec.ts        # 봇 목록
│   ├── 04-bot-detail.spec.ts       # 봇 상세 (Sessions/KB)
│   ├── 05-kb-search.spec.ts        # KB 검색/필터
│   ├── 06-kb-crud.spec.ts          # KB CRUD
│   └── 07-api-health.spec.ts       # API 엔드포인트
└── utils/                    # 테스트 헬퍼
```

## 테스트 커버리지 목표

- [x] 모든 페이지 라우팅 (/, /dashboard, /bots, /bots/[id], /kb)
- [x] API 엔드포인트 (health, bots, kb)
- [x] KB CRUD (생성/수정/삭제/검색)
- [x] 봇 상세 탭 전환 (Sessions ↔ KB)
- [x] 필터/검색 기능
- [x] 반응형 UI (모바일/태블릿/데스크탑)
- [x] Dark Mode 전환
- [x] 에러 핸들링

## 실행 환경

- **로컬 개발**: `http://localhost:3000`
- **스테이징**: `https://semo-dashboard-staging.vercel.app` (예시)
- **프로덕션**: (배포 후 추가)

## CI/CD 통합

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 테스트 작성 가이드

### 1. 명확한 테스트명

```ts
test('KB 검색 시 결과가 유사도 순으로 정렬된다', async ({ page }) => {
  // ...
});
```

### 2. 데이터 격리

```ts
// ✅ 각 테스트마다 독립적인 데이터 사용
test.beforeEach(async ({ page }) => {
  await page.goto('/kb');
  // Clean state
});
```

### 3. 명시적 대기

```ts
// ❌ 임의의 대기 금지
await page.waitForTimeout(3000);

// ✅ 특정 요소 대기
await page.waitForSelector('[data-testid="kb-table"]');
```

### 4. Data-testid 사용

```tsx
// 컴포넌트에 data-testid 추가
<button data-testid="btn-new-entry">+ New Entry</button>

// 테스트에서 사용
await page.click('[data-testid="btn-new-entry"]');
```

## 주의사항

- **API 모킹**: 외부 API는 MSW로 모킹
- **인증**: 테스트 전용 계정 사용 (test@semicolon.kr)
- **클린업**: 테스트 후 생성한 데이터 삭제
- **스냅샷**: UI 변경 시 스냅샷 업데이트 필요

## 문의

- ReviewClaw (<@U0AF1RK0E67>) — E2E 테스트 관리
- WorkClaw (<@U0AFECSJHK3>) — 테스트 실패 시 수정
- SemiClaw (<@U0ADGB42N79>) — 테스트 전략/일정
