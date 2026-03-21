# AXOracle 태스크 분해 (Tasks Breakdown)

> **AI Transformation Oracle** - AI로 인한 직업 위험도 평가 서비스
>
> **문서 버전**: 1.0
> **작성일**: 2026-02-07
> **총 예상 기간**: 5주

---

## DDD 레이어 기반 태스크 분해

이 문서는 **Domain-Driven Design (DDD) 4-Layer Architecture**를 기반으로 태스크를 분해합니다.

### 레이어 정의

| 레이어 | 버전 | 목적 | 예시 |
|--------|------|------|------|
| **CONFIG** | v0.1.x | 환경 설정, 의존성 | Next.js 설치, Supabase 연동 |
| **PROJECT** | v0.2.x | 프로젝트 구조, 라우팅 | 폴더 구조, Layout |
| **DATA** | v0.3.x | 데이터 스키마, API | DB 스키마, 크롤링, API |
| **TESTS** | v0.4.x | 테스트 설정 | 단위/통합/E2E 테스트 |
| **CODE** | v0.5.x | 비즈니스 로직, UI | 컴포넌트, 위험도 계산 |

---

## 목차

1. [CONFIG Layer (v0.1.x)](#config-layer-v01x)
2. [PROJECT Layer (v0.2.x)](#project-layer-v02x)
3. [DATA Layer (v0.3.x)](#data-layer-v03x)
4. [TESTS Layer (v0.4.x)](#tests-layer-v04x)
5. [CODE Layer (v0.5.x)](#code-layer-v05x)
6. [태스크 요약](#태스크-요약)

---

## CONFIG Layer (v0.1.x)

### v0.1.1: Next.js 프로젝트 초기 설정

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: 없음

**Description**:
Next.js 15 프로젝트를 생성하고 기본 환경을 구성합니다.

**Acceptance Criteria**:
- [ ] Next.js 15 프로젝트 생성 완료 (TypeScript, Tailwind, App Router)
- [ ] Git 저장소 초기화 및 첫 커밋 완료
- [ ] package.json 기본 스크립트 설정 완료

**Implementation Steps**:
```bash
npx create-next-app@latest axoracle \
  --typescript \
  --tailwind \
  --app \
  --src-dir

cd axoracle
git init
git add .
git commit -m "Initial commit: Next.js 15 setup"
```

---

### v0.1.2: 필수 의존성 설치

**Priority**: P0 (Must-have)
**예상 시간**: 1시간
**의존성**: v0.1.1

**Description**:
프로젝트에 필요한 모든 npm 패키지를 설치합니다.

**Acceptance Criteria**:
- [ ] Supabase 클라이언트 설치 완료
- [ ] Playwright 설치 완료
- [ ] shadcn/ui 설치 및 초기화 완료
- [ ] Zod, Recharts 등 추가 라이브러리 설치 완료

**Implementation Steps**:
```bash
# Core dependencies
npm install @supabase/supabase-js
npm install playwright
npm install zod
npm install recharts
npm install class-variance-authority clsx tailwind-merge

# shadcn/ui
npx shadcn@latest init

# Dev dependencies
npm install -D eslint-config-prettier prettier
npm install -D vitest @vitejs/plugin-react
npm install -D @playwright/test
```

---

### v0.1.3: 환경 변수 설정

**Priority**: P0 (Must-have)
**예상 시간**: 30분
**의존성**: v0.1.2

**Description**:
환경 변수 템플릿을 작성하고 .env.local 파일을 설정합니다.

**Acceptance Criteria**:
- [ ] .env.example 파일 작성 완료
- [ ] .env.local 파일 생성 (gitignore에 포함)
- [ ] 모든 필수 환경 변수 정의 완료

**Implementation Steps**:
1. `.env.example` 작성:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# BLS API
BLS_API_KEY=

# O*NET API
ONET_USERNAME=
ONET_PASSWORD=

# Vercel Cron
CRON_SECRET=
```

2. `.env.local` 복사 및 실제 값 입력

---

### v0.1.4: Supabase 프로젝트 생성

**Priority**: P0 (Must-have)
**예상 시간**: 30분
**의존성**: v0.1.3

**Description**:
Supabase 클라우드에서 새 프로젝트를 생성하고 연결합니다.

**Acceptance Criteria**:
- [ ] Supabase 프로젝트 생성 완료 (axoracle)
- [ ] Database Password 설정 완료
- [ ] SUPABASE_URL 및 API Key 확보 완료
- [ ] .env.local에 환경 변수 저장 완료

**Implementation Steps**:
1. https://supabase.com 접속
2. "New Project" 클릭
3. Organization 선택
4. Project name: axoracle
5. Database Password 설정
6. Region: Northeast Asia (Seoul)
7. URL 및 API Key 복사 → .env.local

---

### v0.1.5: ESLint 및 Prettier 설정

**Priority**: P1 (Should-have)
**예상 시간**: 30분
**의존성**: v0.1.2

**Description**:
코드 품질 도구를 설정하고 규칙을 구성합니다.

**Acceptance Criteria**:
- [ ] .eslintrc.json 설정 완료
- [ ] .prettierrc 설정 완료
- [ ] VSCode 설정 파일 작성 완료
- [ ] Pre-commit hook 설정 (optional)

**Implementation Steps**:
1. `.prettierrc` 작성:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

2. `.eslintrc.json` 수정:
```json
{
  "extends": ["next/core-web-vitals", "prettier"]
}
```

---

## PROJECT Layer (v0.2.x)

### v0.2.1: 폴더 구조 생성

**Priority**: P0 (Must-have)
**예상 시간**: 30분
**의존성**: v0.1.1

**Description**:
프로젝트 전체 폴더 구조를 생성합니다.

**Acceptance Criteria**:
- [ ] app/ 폴더 구조 생성 완료
- [ ] components/ 폴더 생성 완료
- [ ] lib/ 폴더 생성 완료
- [ ] scripts/ 폴더 생성 완료

**Implementation Steps**:
```bash
mkdir -p app/(marketing)
mkdir -p app/input
mkdir -p app/result/[occupationId]
mkdir -p app/api/countries
mkdir -p app/api/occupations/search
mkdir -p app/api/occupations/[id]/risk-score
mkdir -p app/api/cron/crawl-salaries
mkdir -p components/ui
mkdir -p lib/supabase
mkdir -p lib/crawlers
mkdir -p scripts
mkdir -p supabase/migrations
```

---

### v0.2.2: Root Layout 구현

**Priority**: P0 (Must-have)
**예상 시간**: 1시간
**의존성**: v0.2.1

**Description**:
전체 애플리케이션에 적용되는 Root Layout을 구현합니다.

**Acceptance Criteria**:
- [ ] app/layout.tsx 작성 완료
- [ ] 네비게이션 바 구현 완료
- [ ] 푸터 구현 완료
- [ ] 기본 스타일링 완료

**Implementation Steps**:
`app/layout.tsx`:
```typescript
import './globals.css';

export const metadata = {
  title: 'AXOracle - AI 직업 위험도 평가',
  description: 'AI로 인한 직업 대체 위험도를 데이터 기반으로 평가합니다.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <nav className="border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">AXOracle</h1>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="border-t mt-12">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-600">
            © 2026 AXOracle. 데이터 출처: 사람인, BLS, O*NET
          </div>
        </footer>
      </body>
    </html>
  );
}
```

---

### v0.2.3: Supabase 클라이언트 설정

**Priority**: P0 (Must-have)
**예상 시간**: 30분
**의존성**: v0.1.4

**Description**:
Supabase 클라이언트를 초기화하고 재사용 가능한 유틸리티를 작성합니다.

**Acceptance Criteria**:
- [ ] lib/supabase/client.ts 작성 완료
- [ ] 클라이언트 초기화 테스트 완료
- [ ] 환경 변수 연결 확인 완료

**Implementation Steps**:
`lib/supabase/client.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

---

### v0.2.4: 라우팅 구조 확인

**Priority**: P0 (Must-have)
**예상 시간**: 30분
**의존성**: v0.2.1, v0.2.2

**Description**:
Next.js App Router 라우팅이 올바르게 동작하는지 확인합니다.

**Acceptance Criteria**:
- [ ] / (Landing Page) 라우팅 확인
- [ ] /input (Input Page) 라우팅 확인
- [ ] /result/[occupationId] (Result Page) 라우팅 확인
- [ ] API 라우트 구조 확인

**Implementation Steps**:
각 폴더에 임시 `page.tsx` 생성하여 라우팅 테스트

---

## DATA Layer (v0.3.x)

### v0.3.1: DB 스키마 설계 및 마이그레이션

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: v0.1.4

**Description**:
Supabase에 필요한 모든 테이블을 생성하는 마이그레이션을 작성합니다.

**Acceptance Criteria**:
- [ ] supabase/migrations/20260207_initial_schema.sql 작성 완료
- [ ] 5개 테이블 생성 완료 (countries, occupations, tasks, ai_services, task_ai_services)
- [ ] 인덱스 생성 완료
- [ ] 마이그레이션 실행 완료

**Implementation Steps**:
(상세 스키마는 spec.md 참조)

---

### v0.3.2: 시드 데이터 삽입

**Priority**: P0 (Must-have)
**예상 시간**: 30분
**의존성**: v0.3.1

**Description**:
countries 테이블에 초기 데이터를 삽입합니다.

**Acceptance Criteria**:
- [ ] 3개국 데이터 삽입 완료 (KR, US, JP)
- [ ] Supabase Studio에서 데이터 확인 완료

**Implementation Steps**:
```sql
INSERT INTO countries VALUES
  ('KR', 'South Korea', '대한민국', 'KRW', '🇰🇷'),
  ('US', 'United States', 'United States', 'USD', '🇺🇸'),
  ('JP', 'Japan', '日本', 'JPY', '🇯🇵');
```

---

### v0.3.3: 한국 연봉 크롤러 구현

**Priority**: P0 (Must-have)
**예상 시간**: 4시간
**의존성**: v0.3.1

**Description**:
사람인 웹사이트에서 한국 직업별 평균 연봉 데이터를 크롤링합니다.

**Acceptance Criteria**:
- [ ] lib/crawlers/korea.ts 작성 완료
- [ ] Playwright로 사람인 접속 및 데이터 추출 완료
- [ ] 50개 직업 연봉 데이터 수집 완료
- [ ] occupations 테이블에 저장 완료

**Test Cases**:
- 크롤링 실행: `npm run crawl:kr`
- 예상 결과: 50개 데이터 삽입 완료

---

### v0.3.4: 미국 연봉 API 호출 구현

**Priority**: P0 (Must-have)
**예상 시간**: 3시간
**의존성**: v0.3.1

**Description**:
BLS (Bureau of Labor Statistics) API를 호출하여 미국 직업별 평균 연봉을 가져옵니다.

**Acceptance Criteria**:
- [ ] lib/crawlers/us.ts 작성 완료
- [ ] BLS API 호출 성공 완료
- [ ] 50개 직업 연봉 데이터 수집 완료
- [ ] occupations 테이블에 저장 완료

---

### v0.3.5: 일본 연봉 크롤러 구현

**Priority**: P0 (Must-have)
**예상 시간**: 4시간
**의존성**: v0.3.1

**Description**:
일본 후생노동성 웹사이트에서 직업별 평균 임금 데이터를 크롤링합니다.

**Acceptance Criteria**:
- [ ] lib/crawlers/japan.ts 작성 완료
- [ ] PDF 파싱 구현 완료 (pdf-parse)
- [ ] 50개 직업 연봉 데이터 수집 완료
- [ ] occupations 테이블에 저장 완료

---

### v0.3.6: O*NET 직무 데이터 API 호출

**Priority**: P0 (Must-have)
**예상 시간**: 3시간
**의존성**: v0.3.3, v0.3.4, v0.3.5

**Description**:
O*NET Web Services API를 호출하여 각 직업의 직무(Task) 데이터를 가져옵니다.

**Acceptance Criteria**:
- [ ] lib/crawlers/onet.ts 작성 완료
- [ ] O*NET API 인증 성공 완료
- [ ] 50개 직업 × 평균 8개 직무 = 400개 직무 데이터 수집 완료
- [ ] tasks 테이블에 저장 완료

---

### v0.3.7: 데이터 정제 스크립트 작성

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: v0.3.6

**Description**:
수집된 데이터의 중복 제거, 이상치 제거, 형식 통일을 수행합니다.

**Acceptance Criteria**:
- [ ] scripts/clean-data.ts 작성 완료
- [ ] 중복 데이터 제거 완료
- [ ] 이상치 제거 완료 (연봉 0원 또는 음수)
- [ ] 직업명 표준화 완료

---

### v0.3.8: AI 서비스 목록 작성 및 임포트

**Priority**: P0 (Must-have)
**예상 시간**: 4시간
**의존성**: v0.3.1

**Description**:
50개 AI 서비스 목록을 작성하고 DB에 임포트합니다.

**Acceptance Criteria**:
- [ ] ai-services.csv 작성 완료 (50개 서비스)
- [ ] scripts/import-ai-services.ts 작성 완료
- [ ] CSV → JSON 변환 완료
- [ ] ai_services 테이블에 저장 완료

---

### v0.3.9: Task-AI 서비스 매핑

**Priority**: P0 (Must-have)
**예상 시간**: 4시간
**의존성**: v0.3.6, v0.3.8

**Description**:
각 직무(Task)와 관련 AI 서비스를 매핑합니다.

**Acceptance Criteria**:
- [ ] task-ai-mapping.csv 작성 완료
- [ ] scripts/map-tasks-to-ai.ts 작성 완료
- [ ] task_ai_services 테이블에 저장 완료
- [ ] 각 직무당 평균 3개 AI 서비스 매핑 완료

---

### v0.3.10: 크롤링 스케줄러 설정 (Vercel Cron)

**Priority**: P1 (Should-have)
**예상 시간**: 1시간
**의존성**: v0.3.3, v0.3.4, v0.3.5

**Description**:
Vercel Cron Jobs를 설정하여 월 1회 자동 크롤링을 실행합니다.

**Acceptance Criteria**:
- [ ] vercel.json 작성 완료
- [ ] app/api/cron/crawl-salaries/route.ts 작성 완료
- [ ] 인증 토큰 검증 구현 완료
- [ ] 로컬 테스트 완료

---

### v0.3.11: API 엔드포인트 - GET /api/countries

**Priority**: P0 (Must-have)
**예상 시간**: 30분
**의존성**: v0.3.2

**Description**:
지원하는 국가 목록을 반환하는 API를 구현합니다.

**Acceptance Criteria**:
- [ ] app/api/countries/route.ts 작성 완료
- [ ] Supabase에서 countries 조회 구현 완료
- [ ] 에러 핸들링 구현 완료
- [ ] Postman 테스트 완료

---

### v0.3.12: API 엔드포인트 - GET /api/occupations/search

**Priority**: P0 (Must-have)
**예상 시간**: 1시간
**의존성**: v0.3.7

**Description**:
직업 검색(자동완성) API를 구현합니다.

**Acceptance Criteria**:
- [ ] app/api/occupations/search/route.ts 작성 완료
- [ ] 쿼리 파라미터 검증 구현 완료 (q, country, limit)
- [ ] Supabase ILIKE 검색 구현 완료
- [ ] 에러 핸들링 구현 완료
- [ ] Postman 테스트 완료

---

### v0.3.13: API 엔드포인트 - GET /api/occupations/[id]/risk-score

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: v0.3.9

**Description**:
위험도 점수 및 상세 정보를 반환하는 API를 구현합니다.

**Acceptance Criteria**:
- [ ] app/api/occupations/[id]/risk-score/route.ts 작성 완료
- [ ] 직업, 직무, AI 서비스 조회 구현 완료
- [ ] 위험도 계산 함수 호출 구현 완료
- [ ] 응답 데이터 구성 완료
- [ ] 에러 핸들링 구현 완료
- [ ] Postman 테스트 완료

---

## TESTS Layer (v0.4.x)

### v0.4.1: Vitest 설정

**Priority**: P1 (Should-have)
**예상 시간**: 1시간
**의존성**: v0.1.2

**Description**:
Vitest를 설정하고 테스트 환경을 구성합니다.

**Acceptance Criteria**:
- [ ] vitest.config.ts 작성 완료
- [ ] 테스트 유틸리티 설정 완료
- [ ] npm test 명령 작동 확인

**Implementation Steps**:
`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
```

---

### v0.4.2: 위험도 계산 로직 단위 테스트

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: v0.4.1

**Description**:
위험도 계산 함수의 정확성을 검증하는 단위 테스트를 작성합니다.

**Acceptance Criteria**:
- [ ] lib/risk-calculator.test.ts 작성 완료
- [ ] 5개 이상의 테스트 케이스 작성 완료
- [ ] 모든 테스트 통과 확인
- [ ] Edge case 테스트 포함

**Test Cases**:
- 정상 케이스: 위험도 계산 정확성
- Low Risk: 0-25% 범위
- Medium Risk: 26-50% 범위
- High Risk: 51-75% 범위
- Critical Risk: 76-100% 범위

---

### v0.4.3: API 통합 테스트

**Priority**: P1 (Should-have)
**예상 시간**: 2시간
**의존성**: v0.3.11, v0.3.12, v0.3.13

**Description**:
API 엔드포인트의 정상 동작을 검증하는 통합 테스트를 작성합니다.

**Acceptance Criteria**:
- [ ] tests/api/*.test.ts 작성 완료
- [ ] 각 API 엔드포인트당 2-3개 테스트 케이스 작성
- [ ] 모든 테스트 통과 확인

---

### v0.4.4: Playwright E2E 테스트 설정

**Priority**: P1 (Should-have)
**예상 시간**: 1시간
**의존성**: v0.1.2

**Description**:
Playwright를 설정하고 E2E 테스트 환경을 구성합니다.

**Acceptance Criteria**:
- [ ] playwright.config.ts 작성 완료
- [ ] tests/ 폴더 생성 완료
- [ ] npx playwright test 명령 작동 확인

---

### v0.4.5: 사용자 플로우 E2E 테스트

**Priority**: P1 (Should-have)
**예상 시간**: 2시간
**의존성**: v0.4.4, CODE Layer 완료

**Description**:
전체 사용자 플로우를 검증하는 E2E 테스트를 작성합니다.

**Acceptance Criteria**:
- [ ] tests/e2e/user-flow.spec.ts 작성 완료
- [ ] Landing → Input → Result 플로우 테스트 완료
- [ ] 모든 테스트 통과 확인

---

## CODE Layer (v0.5.x)

### v0.5.1: shadcn/ui 컴포넌트 추가

**Priority**: P0 (Must-have)
**예상 시간**: 1시간
**의존성**: v0.1.2

**Description**:
필요한 shadcn/ui 컴포넌트를 프로젝트에 추가합니다.

**Acceptance Criteria**:
- [ ] button, input, card, progress, badge, toast 추가 완료
- [ ] components/ui/ 폴더에 컴포넌트 생성 확인

**Implementation Steps**:
```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add card
npx shadcn@latest add progress
npx shadcn@latest add badge
npx shadcn@latest add toast
```

---

### v0.5.2: RiskScoreCard 컴포넌트 구현

**Priority**: P0 (Must-have)
**예상 시간**: 1시간
**의존성**: v0.5.1

**Description**:
위험도 점수를 시각화하는 카드 컴포넌트를 구현합니다.

**Acceptance Criteria**:
- [ ] components/RiskScoreCard.tsx 작성 완료
- [ ] 진행 바 시각화 구현 완료
- [ ] Risk Level별 색상 적용 완료
- [ ] 반응형 디자인 적용 완료

---

### v0.5.3: TaskList 컴포넌트 구현

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: v0.5.1

**Description**:
직무 목록 및 관련 AI 서비스를 표시하는 컴포넌트를 구현합니다.

**Acceptance Criteria**:
- [ ] components/TaskList.tsx 작성 완료
- [ ] 직무별 정보 표시 구현 완료
- [ ] AI 서비스 목록 표시 구현 완료
- [ ] "더 보기" 접기/펼치기 기능 구현 완료

---

### v0.5.4: Landing Page 구현

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: v0.5.1, v0.2.2

**Description**:
국가 선택 화면(Landing Page)을 구현합니다.

**Acceptance Criteria**:
- [ ] app/(marketing)/page.tsx 작성 완료
- [ ] 3개 국가 버튼 구현 완료
- [ ] 국가 선택 시 sessionStorage 저장 구현 완료
- [ ] /input으로 라우팅 구현 완료
- [ ] 반응형 디자인 적용 완료

---

### v0.5.5: Input Page 구현

**Priority**: P0 (Must-have)
**예상 시간**: 3시간
**의존성**: v0.5.1, v0.3.12

**Description**:
직업 검색 및 입력 화면을 구현합니다.

**Acceptance Criteria**:
- [ ] app/input/page.tsx 작성 완료
- [ ] 직업 검색 자동완성 구현 완료 (API 연동)
- [ ] 선택된 직업 상태 관리 구현 완료
- [ ] 유효성 검사 및 에러 메시지 표시 구현 완료
- [ ] "분석 시작하기" 버튼 구현 완료

---

### v0.5.6: Result Page 구현

**Priority**: P0 (Must-have)
**예상 시간**: 4시간
**의존성**: v0.5.2, v0.5.3, v0.3.13

**Description**:
위험도 점수 및 상세 정보 표시 화면을 구현합니다.

**Acceptance Criteria**:
- [ ] app/result/[occupationId]/page.tsx 작성 완료
- [ ] 위험도 점수 표시 구현 완료
- [ ] 핵심 지표 (연봉, 직무 수, AI 서비스 수) 표시 구현 완료
- [ ] 직무 목록 표시 구현 완료
- [ ] 로딩 상태 처리 구현 완료
- [ ] 에러 처리 구현 완료

---

### v0.5.7: 위험도 계산 로직 구현

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: v0.3.9

**Description**:
위험도 점수 계산 로직을 구현합니다.

**Acceptance Criteria**:
- [ ] lib/risk-calculator.ts 작성 완료
- [ ] calculateRiskScore 함수 구현 완료
- [ ] Risk Level 판정 로직 구현 완료
- [ ] 단위 테스트 통과 확인

**Formula**:
```typescript
risk_score = Σ(task.ai_replacement_rate × task.time_percentage) / 100
```

---

### v0.5.8: 결과 공유 기능 구현

**Priority**: P1 (Should-have)
**예상 시간**: 1시간
**의존성**: v0.5.6

**Description**:
결과 URL을 클립보드에 복사하는 공유 기능을 구현합니다.

**Acceptance Criteria**:
- [ ] "결과 공유하기" 버튼 구현 완료
- [ ] 클립보드 API 사용 구현 완료
- [ ] 복사 완료 토스트 메시지 표시 구현 완료

---

### v0.5.9: 로딩 상태 및 에러 핸들링

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: v0.5.5, v0.5.6

**Description**:
모든 페이지에 로딩 상태와 에러 핸들링을 추가합니다.

**Acceptance Criteria**:
- [ ] 로딩 스피너 컴포넌트 구현 완료
- [ ] API 호출 중 로딩 상태 표시 구현 완료
- [ ] 에러 발생 시 에러 메시지 표시 구현 완료
- [ ] "다시 시도" 버튼 구현 완료

---

### v0.5.10: 반응형 디자인 최종 점검

**Priority**: P0 (Must-have)
**예상 시간**: 2시간
**의존성**: v0.5.4, v0.5.5, v0.5.6

**Description**:
모든 페이지의 반응형 디자인을 점검하고 개선합니다.

**Acceptance Criteria**:
- [ ] 모바일 (<640px) 레이아웃 확인 완료
- [ ] 태블릿 (640-1024px) 레이아웃 확인 완료
- [ ] 데스크톱 (>1024px) 레이아웃 확인 완료
- [ ] Chrome DevTools로 테스트 완료

---

### v0.5.11: SEO 최적화

**Priority**: P1 (Should-have)
**예상 시간**: 1시간
**의존성**: v0.5.4, v0.5.5, v0.5.6

**Description**:
메타 태그, Open Graph, Structured Data를 추가하여 SEO를 최적화합니다.

**Acceptance Criteria**:
- [ ] 각 페이지의 메타 태그 작성 완료
- [ ] Open Graph 태그 추가 완료
- [ ] JSON-LD Structured Data 추가 완료
- [ ] sitemap.xml 생성 완료

---

### v0.5.12: Lighthouse 점수 최적화

**Priority**: P1 (Should-have)
**예상 시간**: 2시간
**의존성**: v0.5.10, v0.5.11

**Description**:
Lighthouse 점수를 90점 이상으로 개선합니다.

**Acceptance Criteria**:
- [ ] Performance > 90
- [ ] Accessibility > 90
- [ ] Best Practices > 90
- [ ] SEO > 90

**Optimization Steps**:
- 이미지 최적화 (next/image)
- 코드 스플리팅
- 캐싱 전략
- 접근성 개선

---

## 태스크 요약

### 레이어별 태스크 수

| 레이어 | 태스크 수 | 예상 총 시간 |
|--------|----------|-------------|
| CONFIG | 5 | 4.5시간 |
| PROJECT | 4 | 2.5시간 |
| DATA | 13 | 34시간 |
| TESTS | 5 | 8시간 |
| CODE | 12 | 25시간 |
| **총계** | **39** | **74시간** |

### 우선순위별 태스크 수

| 우선순위 | 태스크 수 | 비율 |
|---------|----------|------|
| P0 (Must-have) | 32 | 82% |
| P1 (Should-have) | 7 | 18% |
| P2 (Could-have) | 0 | 0% |

### Phase별 태스크 매핑

| Phase | 레이어 | 태스크 범위 | 예상 기간 |
|-------|--------|-----------|----------|
| Phase 1 | CONFIG, PROJECT | v0.1.1 - v0.2.4 | Week 1 |
| Phase 2 | DATA | v0.3.1 - v0.3.10 | Week 2 |
| Phase 3 | CODE (UI) | v0.5.1 - v0.5.6 | Week 3 |
| Phase 4 | DATA (API), TESTS, CODE (Logic) | v0.3.11 - v0.5.7 | Week 4 |
| Phase 5 | CODE (Optimization) | v0.5.8 - v0.5.12 | Week 5+ |

---

## 의존성 그래프 (주요 태스크)

```
v0.1.1 (Next.js 설정)
  ├─ v0.1.2 (의존성 설치)
  │   ├─ v0.1.5 (ESLint/Prettier)
  │   ├─ v0.4.1 (Vitest 설정)
  │   └─ v0.5.1 (shadcn/ui)
  │       ├─ v0.5.2 (RiskScoreCard)
  │       ├─ v0.5.3 (TaskList)
  │       └─ v0.5.4 (Landing Page)
  ├─ v0.1.3 (환경 변수)
  │   └─ v0.1.4 (Supabase 프로젝트)
  │       ├─ v0.2.3 (Supabase 클라이언트)
  │       └─ v0.3.1 (DB 스키마)
  │           ├─ v0.3.2 (시드 데이터)
  │           ├─ v0.3.3 (한국 크롤러)
  │           ├─ v0.3.4 (미국 API)
  │           ├─ v0.3.5 (일본 크롤러)
  │           ├─ v0.3.6 (O*NET API)
  │           │   └─ v0.3.7 (데이터 정제)
  │           ├─ v0.3.8 (AI 서비스 임포트)
  │           └─ v0.3.9 (Task-AI 매핑)
  │               ├─ v0.3.13 (API: risk-score)
  │               │   └─ v0.5.6 (Result Page)
  │               └─ v0.5.7 (위험도 계산 로직)
  │                   └─ v0.4.2 (단위 테스트)
  └─ v0.2.1 (폴더 구조)
      ├─ v0.2.2 (Root Layout)
      └─ v0.2.4 (라우팅 확인)
```

---

## 실행 가이드

### 1. CONFIG Layer 실행
```bash
# v0.1.1 - v0.1.5
npx create-next-app@latest axoracle --typescript --tailwind --app --src-dir
cd axoracle
npm install @supabase/supabase-js playwright zod recharts
npx shadcn@latest init
```

### 2. PROJECT Layer 실행
```bash
# v0.2.1 - v0.2.4
mkdir -p app/(marketing) app/input app/result/[occupationId]
mkdir -p app/api/countries app/api/occupations/search
mkdir -p components/ui lib/supabase lib/crawlers scripts
```

### 3. DATA Layer 실행
```bash
# v0.3.1 - v0.3.10
supabase db push  # 마이그레이션 실행
npm run crawl:all  # 크롤링 실행
npm run clean-data  # 데이터 정제
npm run import-ai-services  # AI 서비스 임포트
```

### 4. TESTS Layer 실행
```bash
# v0.4.1 - v0.4.5
npm run test  # Vitest 단위 테스트
npx playwright test  # E2E 테스트
```

### 5. CODE Layer 실행
```bash
# v0.5.1 - v0.5.12
npm run dev  # 개발 서버 시작
npx lighthouse http://localhost:3000 --view  # Lighthouse 점수 확인
```

---

**문서 버전**: 1.0
**최종 수정일**: 2026-02-07
**작성자**: User + SEMO AI Assistant
