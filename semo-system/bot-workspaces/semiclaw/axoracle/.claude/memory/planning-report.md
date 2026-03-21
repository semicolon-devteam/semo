# AXOracle 프로젝트 기획 보고서

> **AI Transformation Oracle** - AI로 인한 직업 위험도 평가 서비스
>
> **작성일**: 2026-02-07
> **작성자**: User + SEMO AI Assistant
> **문서 버전**: 1.0

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [앱 구현 계획](#2-앱-구현-계획)
3. [데이터 수집 전략](#3-데이터-수집-전략)
4. [기술 아키텍처](#4-기술-아키텍처)
5. [개발 로드맵](#5-개발-로드맵)
6. [리스크 및 대응 방안](#6-리스크-및-대응-방안)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 배경

AI 기술의 급속한 발전으로 많은 직업과 직무가 자동화될 위험에 처해 있습니다. 그러나 대부분의 근로자들은 자신의 직무가 얼마나 위험한지, 어떤 AI 서비스가 자신의 업무를 대체하고 있는지 정확히 알지 못합니다.

**AXOracle**은 이러한 정보 비대칭을 해소하고, 데이터 기반의 객관적인 위험도 평가를 제공하여 사용자들이 선제적으로 커리어를 준비할 수 있도록 돕습니다.

### 1.2 핵심 가치 제안

| 문제 | 해결책 | 가치 |
|------|--------|------|
| 자신의 직무 위험도를 모름 | 국가별/직업별 구체적인 위험도 점수 제공 | **투명성** |
| 어떤 AI가 내 직무를 대체하는지 모름 | 직무별 AI 서비스 매핑 | **인사이트** |
| 평균 연봉 정보 부족 | 국가별/직업별 평균 연봉 데이터 제공 | **정보** |
| 막연한 불안감 | 객관적 데이터 기반 평가 | **신뢰** |

### 1.3 타겟 사용자

#### Primary Users (핵심 사용자)

**1. 일반 직장인 (30-40대)**
- **니즈**: 현재 직무의 안정성 확인, 재교육 필요성 판단
- **시나리오**: "내 직업이 10년 후에도 안전할까?"
- **기대 행동**: 위험도 확인 → 재교육/전직 고민 → 커리어 전환 결정

**2. 취업 준비생 (20대)**
- **니즈**: 진로 선택 시 AI 영향도 고려
- **시나리오**: "어떤 직업을 선택해야 미래가 안정적일까?"
- **기대 행동**: 여러 직업 비교 → 위험도 낮은 직업 선택 → 해당 분야 준비

**3. 인사/HR 담당자**
- **니즈**: 조직의 인력 구조 변화 예측, 채용/교육 전략 수립
- **시나리오**: "우리 회사의 어떤 직무가 AI로 대체될까?"
- **기대 행동**: 여러 직무 분석 → 채용 우선순위 조정 → 재교육 프로그램 기획

#### Secondary Users (부가 사용자)

- **정책 입안자**: 노동 정책 수립을 위한 데이터 참고
- **교육 기관**: 미래 지향적인 커리큘럼 설계
- **연구자**: AI 영향 연구를 위한 데이터 소스

---

## 2. 앱 구현 계획

### 2.1 사용자 플로우

```
┌─────────────────┐
│  1. Landing     │
│  국가 선택       │ → 한국 / 미국 / 일본 중 선택
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  2. Input       │
│  직업 정보 입력  │ → 직업명 (자동완성) + 연차 입력
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  3. Result      │
│  결과 표시       │
├─────────────────┤
│ • 평균 연봉      │
│ • 직무 목록      │
│ • AI 서비스 매핑 │
│ • 위험도 점수    │
└─────────────────┘
         │
         ↓
┌─────────────────┐
│  4. Detail      │
│  상세 분석       │ → 각 직무별 위험도, AI 서비스 상세 정보
└─────────────────┘
```

### 2.2 화면 구성

#### 2.2.1 Landing Page (국가 선택)

**목적**: 사용자의 국가 선택 및 프로젝트 소개

**UI 구성**:
```
┌───────────────────────────────────────┐
│           [AXOracle Logo]             │
│                                       │
│   AI 시대, 당신의 직업은 안전한가요?  │
│                                       │
│  ┌─────┐  ┌─────┐  ┌─────┐          │
│  │ 🇰🇷  │  │ 🇺🇸  │  │ 🇯🇵  │          │
│  │한국  │  │미국  │  │일본  │          │
│  └─────┘  └─────┘  └─────┘          │
│                                       │
│  "3개국, 50개 직업 데이터 기반"       │
└───────────────────────────────────────┘
```

**기능**:
- 3개국 선택 버튼 (큰 클릭 영역)
- 선택 시 Input Page로 이동
- 간단한 서비스 소개 문구
- (Optional) 예시 결과 미리보기

#### 2.2.2 Input Page (직업 정보 입력)

**목적**: 사용자의 직업과 경력 정보 수집

**UI 구성**:
```
┌───────────────────────────────────────┐
│  [← 뒤로]         한국 🇰🇷             │
├───────────────────────────────────────┤
│                                       │
│  직업을 입력하세요                     │
│  ┌─────────────────────────────────┐ │
│  │ 소프트웨어 개발자         [🔍] │ │
│  └─────────────────────────────────┘ │
│  [추천: 데이터 분석가, PM, 디자이너]  │
│                                       │
│  경력을 입력하세요 (선택)              │
│  ┌─────────────────────────────────┐ │
│  │ 5년                             │ │
│  └─────────────────────────────────┘ │
│                                       │
│       [분석 시작하기]                 │
│                                       │
└───────────────────────────────────────┘
```

**기능**:
- **직업명 자동완성**: 입력 시 DB에서 매칭되는 직업 제안
- **연차 입력**: 숫자만 입력 가능 (0-50년)
- **추천 직업 태그**: 인기 직업 빠른 선택
- **유효성 검사**: 직업이 DB에 없으면 "해당 직업 데이터가 없습니다" 안내

#### 2.2.3 Result Page (결과 표시)

**목적**: 위험도 점수 및 주요 정보 표시

**UI 구성**:
```
┌───────────────────────────────────────┐
│  [← 뒤로]    소프트웨어 개발자 (한국)  │
├───────────────────────────────────────┤
│                                       │
│  위험도: 45%  [Medium Risk]           │
│  ┌───────────────────────────────┐   │
│  │ ████████████░░░░░░░░░░░░░░░░ │   │
│  └───────────────────────────────┘   │
│                                       │
│  💰 평균 연봉: ₩ 68,000,000          │
│  📊 분석 직무: 8개                    │
│  🤖 매핑된 AI: 12개                   │
│                                       │
├───────────────────────────────────────┤
│  주요 직무 및 AI 서비스                │
│                                       │
│  1. 코드 작성 (35%)                   │
│     • GitHub Copilot                  │
│     • Cursor AI                       │
│     위험도: 60% [High]                │
│                                       │
│  2. 디버깅 (20%)                      │
│     • Sentry AI                       │
│     • DeepCode                        │
│     위험도: 40% [Medium]              │
│                                       │
│  [더 보기...]                         │
│                                       │
│  [결과 공유하기] [다른 직업 분석]     │
└───────────────────────────────────────┘
```

**기능**:
- **위험도 점수 시각화**: 진행 바 + 색상 (녹색/노랑/빨강)
- **핵심 지표**: 평균 연봉, 분석 직무 수, AI 서비스 수
- **직무별 상세**: 각 직무의 비중 + 관련 AI 서비스 + 위험도
- **공유 기능**: URL 복사 또는 SNS 공유
- **비교 기능**: 다른 직업 분석하기

#### 2.2.4 Detail Page (상세 분석)

**목적**: 각 직무별 상세 정보 제공

**UI 구성**:
```
┌───────────────────────────────────────┐
│  [← 뒤로]    직무 상세 분석            │
├───────────────────────────────────────┤
│  직무: 코드 작성                       │
│  업무 비중: 35%                        │
│  AI 대체율: 60%                        │
│  위험도: 60% [High]                    │
│                                       │
│  관련 AI 서비스                        │
│  ┌─────────────────────────────────┐ │
│  │ GitHub Copilot                  │ │
│  │ • 코드 자동완성                 │ │
│  │ • 함수 제안                     │ │
│  │ • 출시: 2021년                  │ │
│  │ [자세히 보기 →]                 │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │ Cursor AI                       │ │
│  │ • AI 페어 프로그래밍            │ │
│  │ • 자동 리팩토링                 │ │
│  │ • 출시: 2023년                  │ │
│  │ [자세히 보기 →]                 │ │
│  └─────────────────────────────────┘ │
│                                       │
│  대응 전략                             │
│  • AI 도구를 적극 활용하여 생산성 향상 │
│  • 코드 설계 및 아키텍처 역량 강화    │
│  • 비즈니스 이해도 향상                │
└───────────────────────────────────────┘
```

**기능**:
- 각 직무의 상세 정보
- 관련 AI 서비스 목록 + 설명
- 대응 전략 제안
- 외부 링크 (AI 서비스 공식 사이트)

### 2.3 주요 기능 명세

#### 2.3.1 국가 선택 기능

**입력**: 사용자 클릭 (한국/미국/일본)
**출력**: 선택된 국가 정보를 세션에 저장
**로직**:
```typescript
function selectCountry(country: 'KR' | 'US' | 'JP') {
  // 세션 스토리지에 저장
  sessionStorage.setItem('selectedCountry', country);
  // Input Page로 이동
  router.push('/input');
}
```

#### 2.3.2 직업 검색 및 자동완성

**입력**: 사용자 입력 텍스트
**출력**: 매칭되는 직업 목록 (최대 10개)
**로직**:
```typescript
async function searchOccupations(query: string, country: string) {
  const { data } = await supabase
    .from('occupations')
    .select('id, name_local, name_en')
    .eq('country', country)
    .ilike('name_local', `%${query}%`)
    .limit(10);

  return data;
}
```

**DB 스키마** (occupations 테이블):
```sql
CREATE TABLE occupations (
  id UUID PRIMARY KEY,
  country VARCHAR(2) NOT NULL,  -- 'KR', 'US', 'JP'
  name_en VARCHAR(255) NOT NULL,
  name_local VARCHAR(255) NOT NULL,
  average_salary DECIMAL(12, 2),
  currency VARCHAR(3),
  data_source VARCHAR(255),
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.3.3 위험도 계산 로직

**입력**: 직업 ID
**출력**: 위험도 점수 (0-100%)
**로직**:
```typescript
async function calculateRiskScore(occupationId: string) {
  // 1. 직무(Task) 목록 조회
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, name, time_percentage, ai_replacement_rate')
    .eq('occupation_id', occupationId);

  // 2. 위험도 계산: Σ(AI 대체율 × 업무 비중)
  const riskScore = tasks.reduce((sum, task) => {
    return sum + (task.ai_replacement_rate * task.time_percentage / 100);
  }, 0);

  // 3. Risk Level 판정
  const riskLevel =
    riskScore >= 76 ? 'Critical' :
    riskScore >= 51 ? 'High' :
    riskScore >= 26 ? 'Medium' : 'Low';

  return { riskScore, riskLevel, tasks };
}
```

**DB 스키마** (tasks 테이블):
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  occupation_id UUID REFERENCES occupations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  time_percentage DECIMAL(5, 2),  -- 업무 비중 (0-100%)
  ai_replacement_rate DECIMAL(5, 2),  -- AI 대체율 (0-100%)
  data_source VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.3.4 AI 서비스 매핑

**입력**: 직무(Task) ID
**출력**: 관련 AI 서비스 목록
**로직**:
```typescript
async function getAIServices(taskId: string) {
  const { data } = await supabase
    .from('task_ai_services')
    .select(`
      ai_services (
        id, name, description, url, release_year
      )
    `)
    .eq('task_id', taskId);

  return data.map(d => d.ai_services);
}
```

**DB 스키마** (ai_services 및 관계 테이블):
```sql
-- AI 서비스 테이블
CREATE TABLE ai_services (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(500),
  release_year INTEGER,
  category VARCHAR(100),  -- 'Coding', 'Design', 'Writing', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Task-AI 서비스 관계 테이블 (Many-to-Many)
CREATE TABLE task_ai_services (
  task_id UUID REFERENCES tasks(id),
  ai_service_id UUID REFERENCES ai_services(id),
  relevance_score DECIMAL(3, 2),  -- 관련도 (0-1)
  PRIMARY KEY (task_id, ai_service_id)
);
```

### 2.4 UI/UX 디자인 원칙

#### 2.4.1 색상 시스템

| 색상 | 용도 | Hex Code |
|------|------|----------|
| Primary | 브랜드 컬러, CTA 버튼 | #2563EB (Blue) |
| Success | 낮은 위험도 (0-25%) | #10B981 (Green) |
| Warning | 보통 위험도 (26-50%) | #F59E0B (Yellow) |
| Danger | 높은 위험도 (51-75%) | #EF4444 (Red) |
| Critical | 매우 높은 위험도 (76-100%) | #991B1B (Dark Red) |
| Neutral | 텍스트, 배경 | #6B7280 (Gray) |

#### 2.4.2 타이포그래피

- **Headline (H1)**: 48px, Bold, Line Height 1.2
- **Title (H2)**: 32px, Semibold, Line Height 1.3
- **Subtitle (H3)**: 24px, Medium, Line Height 1.4
- **Body**: 16px, Regular, Line Height 1.6
- **Caption**: 14px, Regular, Line Height 1.5

**Font Family**:
- 한글: Pretendard Variable
- 영문/숫자: Inter

#### 2.4.3 반응형 디자인

| Breakpoint | 화면 크기 | 레이아웃 |
|-----------|----------|---------|
| Mobile | < 640px | 1 column, 전체 너비 |
| Tablet | 640px - 1024px | 1-2 columns, 패딩 증가 |
| Desktop | > 1024px | 2-3 columns, 최대 너비 1280px |

#### 2.4.4 접근성 (Accessibility)

- **WCAG 2.1 Level AA 준수**
- 최소 색상 대비비 4.5:1
- 키보드 네비게이션 지원
- 스크린 리더 호환 (ARIA 속성)
- 포커스 인디케이터 명확히

### 2.5 성능 최적화

#### 2.5.1 로딩 속도

**목표**:
- First Contentful Paint (FCP) < 1.5초
- Largest Contentful Paint (LCP) < 2.5초
- Time to Interactive (TTI) < 3.5초

**전략**:
- Next.js SSR/SSG 활용
- 이미지 최적화 (next/image)
- 코드 스플리팅
- CDN 활용 (Vercel Edge Network)

#### 2.5.2 SEO 최적화

- **메타 태그**: Open Graph, Twitter Card
- **Structured Data**: JSON-LD (직업 정보)
- **Sitemap**: 자동 생성 (next-sitemap)
- **Robots.txt**: 크롤링 허용 설정
- **다국어 태그**: hreflang 설정

#### 2.5.3 데이터베이스 최적화

- **인덱스 생성**:
  - `occupations(country, name_local)`
  - `tasks(occupation_id)`
  - `task_ai_services(task_id, ai_service_id)`

- **쿼리 최적화**:
  - JOIN 최소화 (View 활용)
  - N+1 문제 방지 (Eager loading)
  - 페이지네이션 (무한 스크롤)

---

## 3. 데이터 수집 전략

### 3.1 데이터 수집 개요

#### 3.1.1 수집 대상 데이터

| 데이터 유형 | 국가 | 수집 주기 | 저장 위치 |
|-----------|------|----------|----------|
| 연봉 정보 | 한국, 미국, 일본 | 월 1회 | occupations 테이블 |
| 직무 정보 | 미국 (O*NET) | 분기 1회 | tasks 테이블 |
| AI 서비스 | 글로벌 | 수동 업데이트 | ai_services 테이블 |

#### 3.1.2 데이터 수집 방식

**방식 1: 웹 크롤링** (Playwright)
- 연봉 정보 (한국: 사람인, 잡코리아)
- 연봉 정보 (일본: 후생노동성)

**방식 2: API 호출**
- 연봉 정보 (미국: BLS API)
- 직무 정보 (O*NET Web Services API)

**방식 3: 수동 큐레이션**
- AI 서비스 정보 (엑셀 → JSON → DB)

### 3.2 국가별 데이터 소스

#### 3.2.1 한국 🇰🇷

**연봉 데이터**:

| 출처 | URL | 크롤링 대상 | 업데이트 주기 |
|------|-----|------------|-------------|
| 사람인 | saramin.co.kr | 직업별 평균 연봉 | 월 1회 |
| 잡코리아 | jobkorea.co.kr | 직종별 연봉 통계 | 월 1회 |

**크롤링 로직** (예시 - 사람인):
```typescript
async function crawlKoreaSalary() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  // 1. 연봉 통계 페이지 접속
  await page.goto('https://www.saramin.co.kr/zf_user/salaryinfo');

  // 2. 직업 카테고리 선택
  const categories = await page.locator('.category-list li').all();

  for (const category of categories) {
    await category.click();
    await page.waitForLoadState('networkidle');

    // 3. 직업별 연봉 데이터 추출
    const salaries = await page.locator('.salary-item').evaluateAll(items => {
      return items.map(item => ({
        occupation: item.querySelector('.occupation-name').textContent,
        averageSalary: parseFloat(item.querySelector('.salary-value').textContent),
        currency: 'KRW'
      }));
    });

    // 4. DB에 저장
    await saveSalaryData('KR', salaries);
  }

  await browser.close();
}
```

**직무 데이터**:
- O*NET 데이터를 한글로 번역 (Google Translate API)
- 한국 고용정보원 워크넷 참고 (보조)

#### 3.2.2 미국 🇺🇸

**연봉 데이터**:

| 출처 | URL | API | 업데이트 주기 |
|------|-----|-----|-------------|
| BLS | bls.gov | Occupational Employment Statistics API | 월 1회 |

**API 호출 로직**:
```typescript
async function fetchUSSalary() {
  const BLS_API_KEY = process.env.BLS_API_KEY;
  const seriesId = 'OEUN000000000000003'; // Software Developers

  const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesid: [seriesId],
      registrationkey: BLS_API_KEY,
      startyear: '2025',
      endyear: '2026'
    })
  });

  const data = await response.json();
  const latestSalary = data.Results.series[0].data[0].value;

  await saveSalaryData('US', [{
    occupation: 'Software Developer',
    averageSalary: latestSalary,
    currency: 'USD'
  }]);
}
```

**직무 데이터**:

| 출처 | URL | API | 업데이트 주기 |
|------|-----|-----|-------------|
| O*NET | onetonline.org | O*NET Web Services | 분기 1회 |

**API 호출 로직**:
```typescript
async function fetchONETTasks(occupationCode: string) {
  const ONET_USERNAME = process.env.ONET_USERNAME;
  const ONET_PASSWORD = process.env.ONET_PASSWORD;

  const response = await fetch(
    `https://services.onetcenter.org/ws/online/occupations/${occupationCode}/details`,
    {
      headers: {
        'Authorization': `Basic ${btoa(`${ONET_USERNAME}:${ONET_PASSWORD}`)}`
      }
    }
  );

  const data = await response.json();
  const tasks = data.tasks.task.map(t => ({
    name: t.title,
    description: t.description,
    timePercentage: estimateTimePercentage(t), // 추정 로직
    aiReplacementRate: 0 // 초기값, 나중에 수동 입력
  }));

  return tasks;
}
```

#### 3.2.3 일본 🇯🇵

**연봉 데이터**:

| 출처 | URL | 크롤링 대상 | 업데이트 주기 |
|------|-----|------------|-------------|
| 후생노동성 | mhlw.go.jp/toukei | 직종별 평균 임금 통계 | 월 1회 |

**크롤링 로직** (예시):
```typescript
async function crawlJapanSalary() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  // 1. 임금 통계 페이지 접속
  await page.goto('https://www.mhlw.go.jp/toukei/itiran/roudou/chingin/kouzou/z2023/index.html');

  // 2. PDF 다운로드 링크 찾기
  const pdfUrl = await page.locator('a:has-text("職種別賃金")').getAttribute('href');
  const pdfPath = await downloadPDF(pdfUrl);

  // 3. PDF 파싱 (pdf-parse 라이브러리)
  const pdfText = await parsePDF(pdfPath);
  const salaries = extractSalariesFromText(pdfText);

  // 4. DB에 저장
  await saveSalaryData('JP', salaries);

  await browser.close();
}
```

**직무 데이터**:
- O*NET 데이터를 일본어로 번역 (Google Translate API)

### 3.3 AI 서비스 데이터 수집

#### 3.3.1 MVP: 수동 큐레이션

**프로세스**:
```
1. 엑셀/구글 시트에 수동 입력
   ├─ AI 서비스 이름
   ├─ 설명
   ├─ URL
   ├─ 출시 연도
   ├─ 카테고리
   └─ 관련 직무(Task)

2. 엑셀 → JSON 변환 (스크립트)

3. JSON → DB 임포트 (Supabase SQL Editor)
```

**초기 목록** (50개 예상):

| 카테고리 | AI 서비스 예시 | 관련 직무 |
|---------|---------------|----------|
| Coding | GitHub Copilot, Cursor, TabNine | 코드 작성, 디버깅 |
| Design | Midjourney, DALL-E, Figma AI | 디자인, 이미지 생성 |
| Writing | ChatGPT, Jasper, Copy.ai | 문서 작성, 콘텐츠 제작 |
| Data Analysis | Julius AI, DataRobot | 데이터 분석, 리포트 생성 |
| Customer Support | Intercom AI, Zendesk AI | 고객 상담, 문의 응대 |

**엑셀 템플릿**:
```csv
name,description,url,release_year,category,related_tasks
"GitHub Copilot","AI 코드 자동완성","https://github.com/features/copilot",2021,"Coding","코드 작성,디버깅"
"Midjourney","AI 이미지 생성","https://midjourney.com",2022,"Design","디자인,이미지 생성"
...
```

**JSON 변환 스크립트**:
```typescript
import fs from 'fs';
import csv from 'csv-parser';

const results = [];

fs.createReadStream('ai-services.csv')
  .pipe(csv())
  .on('data', (row) => results.push({
    name: row.name,
    description: row.description,
    url: row.url,
    release_year: parseInt(row.release_year),
    category: row.category,
    related_tasks: row.related_tasks.split(',')
  }))
  .on('end', () => {
    fs.writeFileSync('ai-services.json', JSON.stringify(results, null, 2));
    console.log('Conversion complete!');
  });
```

#### 3.3.2 향후 확장: 자동화

**Phase 2 (3개월 후)**:
- Product Hunt API 연동
- GitHub Trending AI 크롤링
- 주간 자동 업데이트

### 3.4 데이터 정제 및 품질 관리

#### 3.4.1 데이터 정제 프로세스

```
Raw Data
   ↓
1. 중복 제거
   ↓
2. 형식 통일 (연봉 단위, 직업명 표준화)
   ↓
3. 이상치 제거 (연봉 0원, 음수 등)
   ↓
4. 누락 값 처리 (평균값 또는 NULL)
   ↓
Clean Data → DB 저장
```

**정제 스크립트 예시**:
```typescript
function cleanSalaryData(rawData) {
  return rawData
    .filter(d => d.averageSalary > 0)  // 이상치 제거
    .filter(d => d.occupation && d.occupation.length > 0)  // 누락 값 제거
    .map(d => ({
      ...d,
      occupation: normalizeOccupationName(d.occupation),  // 표준화
      averageSalary: Math.round(d.averageSalary)  // 반올림
    }));
}

function normalizeOccupationName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, ' ')  // 공백 정리
    .replace(/[0-9]/g, '')  // 숫자 제거
    .toLowerCase();
}
```

#### 3.4.2 데이터 품질 지표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| **완전성** | 95% 이상 | NULL 값 비율 < 5% |
| **정확성** | 90% 이상 | 수동 샘플 검증 (월 1회) |
| **최신성** | 1개월 이내 | `last_updated` 컬럼 체크 |
| **일관성** | 100% | 동일 직업의 연봉 편차 < 20% |

### 3.5 크롤링 스케줄러 구현

#### 3.5.1 Vercel Cron Jobs

**설정 파일**: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/crawl-salaries",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

**API Route**: `/app/api/cron/crawl-salaries/route.ts`
```typescript
export async function GET(request: Request) {
  // 1. 인증 토큰 확인 (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. 크롤링 실행
  try {
    await crawlKoreaSalary();
    await fetchUSSalary();
    await crawlJapanSalary();

    return Response.json({ success: true, message: 'Crawling completed' });
  } catch (error) {
    console.error('Crawling failed:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

#### 3.5.2 GitHub Actions (대안)

**워크플로우**: `.github/workflows/crawl-data.yml`
```yaml
name: Crawl Salary Data

on:
  schedule:
    - cron: '0 0 1 * *'  # 매월 1일 00:00
  workflow_dispatch:  # 수동 트리거

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run crawling scripts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: npm run crawl:all

      - name: Notify Slack
        if: failure()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"Crawling failed! Check logs."}'
```

### 3.6 데이터베이스 스키마 (전체)

```sql
-- 국가 정보
CREATE TABLE countries (
  code VARCHAR(2) PRIMARY KEY,  -- 'KR', 'US', 'JP'
  name_en VARCHAR(100) NOT NULL,
  name_local VARCHAR(100) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  flag_emoji VARCHAR(10)
);

-- 직업 정보
CREATE TABLE occupations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(2) REFERENCES countries(code),
  name_en VARCHAR(255) NOT NULL,
  name_local VARCHAR(255) NOT NULL,
  average_salary DECIMAL(12, 2),
  currency VARCHAR(3),
  data_source VARCHAR(255),
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_country_name (country, name_local)
);

-- 직무 정보
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id UUID REFERENCES occupations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  time_percentage DECIMAL(5, 2) CHECK (time_percentage BETWEEN 0 AND 100),
  ai_replacement_rate DECIMAL(5, 2) CHECK (ai_replacement_rate BETWEEN 0 AND 100),
  data_source VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_occupation (occupation_id)
);

-- AI 서비스 정보
CREATE TABLE ai_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(500),
  release_year INTEGER,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Task-AI 서비스 관계 (Many-to-Many)
CREATE TABLE task_ai_services (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  ai_service_id UUID REFERENCES ai_services(id) ON DELETE CASCADE,
  relevance_score DECIMAL(3, 2) CHECK (relevance_score BETWEEN 0 AND 1),
  PRIMARY KEY (task_id, ai_service_id),

  INDEX idx_task (task_id),
  INDEX idx_ai_service (ai_service_id)
);

-- 크롤링 로그
CREATE TABLE crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(2),
  data_type VARCHAR(50),  -- 'salary', 'tasks', 'ai_services'
  status VARCHAR(20),  -- 'success', 'failed'
  records_count INTEGER,
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. 기술 아키텍처

### 4.1 시스템 아키텍처

```
┌─────────────────────────────────────────────┐
│              User Devices                   │
│  (Mobile, Tablet, Desktop)                  │
└────────────────┬────────────────────────────┘
                 │
                 ↓ HTTPS
┌─────────────────────────────────────────────┐
│         Vercel Edge Network (CDN)           │
│  - Static Assets Caching                    │
│  - Edge Functions                           │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│         Next.js Application (Vercel)        │
├─────────────────────────────────────────────┤
│  Frontend (React + TypeScript)              │
│  - App Router                               │
│  - Server Components                        │
│  - Client Components                        │
├─────────────────────────────────────────────┤
│  Backend (API Routes)                       │
│  - /api/countries                           │
│  - /api/occupations/search                  │
│  - /api/occupations/[id]/risk-score         │
│  - /api/cron/crawl-salaries                 │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│       Supabase (PostgreSQL)                 │
│  - occupations, tasks, ai_services          │
│  - Real-time subscriptions (optional)       │
│  - Row Level Security (RLS)                 │
└─────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│       External Data Sources                 │
│  - BLS API (미국 연봉)                      │
│  - O*NET API (직무 정보)                    │
│  - 사람인/잡코리아 (한국 연봉, 크롤링)      │
│  - 후생노동성 (일본 연봉, 크롤링)           │
└─────────────────────────────────────────────┘
```

### 4.2 폴더 구조

```
axoracle/
├── .github/
│   └── workflows/
│       └── crawl-data.yml          # GitHub Actions
├── .claude/                        # SEMO 설정
│   ├── memory/
│   ├── agents/
│   └── skills/
├── app/                            # Next.js App Router
│   ├── (marketing)/                # Marketing pages
│   │   ├── layout.tsx
│   │   └── page.tsx                # Landing page
│   ├── input/
│   │   └── page.tsx                # Input page
│   ├── result/
│   │   └── [occupationId]/
│   │       └── page.tsx            # Result page
│   ├── api/
│   │   ├── countries/
│   │   │   └── route.ts
│   │   ├── occupations/
│   │   │   ├── search/
│   │   │   │   └── route.ts
│   │   │   └── [id]/
│   │   │       └── risk-score/
│   │   │           └── route.ts
│   │   └── cron/
│   │       └── crawl-salaries/
│   │           └── route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                         # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── progress.tsx
│   ├── CountrySelector.tsx
│   ├── OccupationSearch.tsx
│   ├── RiskScoreCard.tsx
│   └── TaskList.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Supabase client
│   │   └── queries.ts              # Database queries
│   ├── crawlers/
│   │   ├── korea.ts
│   │   ├── us.ts
│   │   └── japan.ts
│   ├── utils.ts                    # Utility functions
│   └── constants.ts                # Constants
├── public/
│   ├── images/
│   └── favicon.ico
├── scripts/
│   ├── crawl-all.ts                # 모든 크롤링 실행
│   ├── import-ai-services.ts       # AI 서비스 임포트
│   └── seed-db.ts                  # DB 시드 데이터
├── supabase/
│   ├── migrations/
│   │   └── 20260207_initial_schema.sql
│   └── seed.sql
├── .env.local                      # 환경 변수
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

### 4.3 기술 스택 상세

#### 4.3.1 Frontend

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 15.x | React 프레임워크 |
| React | 19.x | UI 라이브러리 |
| TypeScript | 5.x | 타입 안전성 |
| Tailwind CSS | 3.x | 스타일링 |
| shadcn/ui | latest | UI 컴포넌트 |
| Recharts | 2.x | 차트/그래프 |
| Zod | 3.x | 스키마 검증 |

#### 4.3.2 Backend

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js API Routes | 15.x | REST API |
| Supabase | latest | Database + Auth |
| Prisma (optional) | 5.x | ORM |

#### 4.3.3 Data Collection

| 기술 | 버전 | 용도 |
|------|------|------|
| Playwright | 1.x | 웹 크롤링 |
| Axios | 1.x | HTTP 클라이언트 |
| pdf-parse | 1.x | PDF 파싱 |

#### 4.3.4 DevOps

| 기술 | 용도 |
|------|------|
| Vercel | 호스팅 + CI/CD |
| GitHub Actions | 크롤링 스케줄러 |
| Sentry (optional) | 에러 트래킹 |

### 4.4 API 엔드포인트

#### 4.4.1 GET /api/countries

**목적**: 지원하는 국가 목록 조회

**Request**:
```
GET /api/countries
```

**Response**:
```json
{
  "countries": [
    {
      "code": "KR",
      "name_en": "South Korea",
      "name_local": "대한민국",
      "currency": "KRW",
      "flag_emoji": "🇰🇷"
    },
    {
      "code": "US",
      "name_en": "United States",
      "name_local": "United States",
      "currency": "USD",
      "flag_emoji": "🇺🇸"
    },
    {
      "code": "JP",
      "name_en": "Japan",
      "name_local": "日本",
      "currency": "JPY",
      "flag_emoji": "🇯🇵"
    }
  ]
}
```

#### 4.4.2 GET /api/occupations/search

**목적**: 직업 검색 (자동완성)

**Request**:
```
GET /api/occupations/search?q=소프트웨어&country=KR
```

**Response**:
```json
{
  "occupations": [
    {
      "id": "uuid-1",
      "name_local": "소프트웨어 개발자",
      "name_en": "Software Developer",
      "average_salary": 68000000,
      "currency": "KRW"
    },
    {
      "id": "uuid-2",
      "name_local": "소프트웨어 테스터",
      "name_en": "Software Tester",
      "average_salary": 52000000,
      "currency": "KRW"
    }
  ]
}
```

#### 4.4.3 GET /api/occupations/[id]/risk-score

**목적**: 위험도 점수 및 상세 정보 조회

**Request**:
```
GET /api/occupations/uuid-1/risk-score
```

**Response**:
```json
{
  "occupation": {
    "id": "uuid-1",
    "name_local": "소프트웨어 개발자",
    "name_en": "Software Developer",
    "average_salary": 68000000,
    "currency": "KRW"
  },
  "risk_score": 45.5,
  "risk_level": "Medium",
  "tasks": [
    {
      "id": "task-1",
      "name": "코드 작성",
      "time_percentage": 35,
      "ai_replacement_rate": 60,
      "ai_services": [
        {
          "name": "GitHub Copilot",
          "description": "AI 코드 자동완성",
          "url": "https://github.com/features/copilot"
        }
      ]
    }
  ]
}
```

### 4.5 환경 변수

`.env.local` 파일:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# BLS API (미국 연봉 데이터)
BLS_API_KEY=your-bls-api-key

# O*NET API (직무 데이터)
ONET_USERNAME=your-onet-username
ONET_PASSWORD=your-onet-password

# Vercel Cron Secret
CRON_SECRET=your-cron-secret

# Google Translate API (번역)
GOOGLE_TRANSLATE_API_KEY=your-translate-api-key

# Sentry (에러 트래킹, optional)
SENTRY_DSN=your-sentry-dsn
```

---

## 5. 개발 로드맵

### 5.1 Phase 1: 프로젝트 설정 (Week 1)

#### Day 1-2: 환경 설정
- [x] Next.js 프로젝트 생성
- [ ] Supabase 프로젝트 생성
- [ ] 환경 변수 설정
- [ ] Git 초기 커밋

#### Day 3-4: DB 스키마 설계 및 생성
- [ ] Supabase 마이그레이션 작성
- [ ] 테이블 생성 (countries, occupations, tasks, ai_services, etc.)
- [ ] 인덱스 최적화
- [ ] RLS 정책 설정

#### Day 5-7: 데이터 수집 스크립트 구현
- [ ] 한국 연봉 크롤러 (사람인)
- [ ] 미국 연봉 API (BLS)
- [ ] 일본 연봉 크롤러 (후생노동성)
- [ ] O*NET 직무 데이터 API
- [ ] AI 서비스 수동 입력 (엑셀 → JSON)

### 5.2 Phase 2: 데이터 수집 및 정제 (Week 2)

#### Day 8-10: 크롤링 실행 및 데이터 정제
- [ ] 모든 크롤러 실행
- [ ] 데이터 정제 스크립트 실행
- [ ] DB 임포트
- [ ] 데이터 품질 검증

#### Day 11-12: AI 서비스 매핑
- [ ] 50개 AI 서비스 목록 작성
- [ ] 각 직무(Task)와 AI 서비스 매핑
- [ ] task_ai_services 테이블 채우기

#### Day 13-14: 크롤링 스케줄러 설정
- [ ] Vercel Cron Jobs 또는 GitHub Actions 설정
- [ ] 알림 설정 (Slack webhook)
- [ ] 로그 테이블 생성 및 모니터링

### 5.3 Phase 3: 프론트엔드 구현 (Week 3)

#### Day 15-16: 공통 컴포넌트
- [ ] shadcn/ui 설치 및 설정
- [ ] Layout 컴포넌트
- [ ] Button, Input, Card 등 기본 컴포넌트
- [ ] 반응형 네비게이션

#### Day 17-18: Landing Page
- [ ] 국가 선택 UI
- [ ] 서비스 소개
- [ ] 애니메이션 효과
- [ ] SEO 메타 태그

#### Day 19-20: Input Page
- [ ] 직업 검색 자동완성
- [ ] 연차 입력
- [ ] 유효성 검사
- [ ] 로딩 상태

#### Day 21: Result Page
- [ ] 위험도 점수 카드
- [ ] 진행 바 시각화
- [ ] 핵심 지표 표시
- [ ] 직무 목록 표시
- [ ] AI 서비스 매핑 표시

### 5.4 Phase 4: 로직 구현 및 테스트 (Week 4)

#### Day 22-23: API 구현
- [ ] GET /api/countries
- [ ] GET /api/occupations/search
- [ ] GET /api/occupations/[id]/risk-score
- [ ] 에러 핸들링

#### Day 24-25: 위험도 계산 로직
- [ ] 가중평균 계산 함수
- [ ] Risk Level 판정 로직
- [ ] 단위 테스트 작성
- [ ] 엣지 케이스 처리

#### Day 26-27: 통합 테스트
- [ ] E2E 테스트 (Playwright)
- [ ] 사용자 플로우 테스트
- [ ] 성능 테스트
- [ ] 버그 수정

#### Day 28: 배포 준비
- [ ] 환경 변수 Vercel에 설정
- [ ] Supabase RLS 정책 재확인
- [ ] Lighthouse 점수 확인
- [ ] 프로덕션 빌드 테스트

### 5.5 Phase 5: 폴리싱 및 배포 (Week 5+)

#### Week 5: 디자인 폴리싱
- [ ] UI/UX 개선
- [ ] 색상 시스템 일관성 확보
- [ ] 타이포그래피 조정
- [ ] 애니메이션 추가
- [ ] 접근성 개선

#### Week 6: 최적화
- [ ] 이미지 최적화
- [ ] 코드 스플리팅
- [ ] 캐싱 전략
- [ ] SEO 최적화
- [ ] 성능 프로파일링

#### Week 7: 배포 및 모니터링
- [ ] Vercel 배포
- [ ] 도메인 연결 (optional)
- [ ] Sentry 에러 트래킹 설정
- [ ] Google Analytics 설정 (optional)
- [ ] 유저 피드백 수집

---

## 6. 리스크 및 대응 방안

### 6.1 기술적 리스크

#### 6.1.1 크롤링 차단

**리스크**:
- 사람인, 잡코리아 등에서 크롤링 봇 감지 및 IP 차단
- robots.txt 또는 이용약관 위반

**대응 방안**:
- **User-Agent 변경**: 실제 브라우저처럼 위장
- **Rate Limiting**: 요청 간격 조정 (1-2초 대기)
- **Proxy 사용**: 여러 IP 로테이션 (optional)
- **API 우선**: 가능한 경우 공식 API 사용 (BLS, O*NET)
- **면책 조항**: 데이터 출처 명시 및 비상업적 사용 명시

**대안**:
- 공개 데이터셋 활용 (Kaggle, 정부 공개 데이터)
- 수동 입력 (MVP 단계)

#### 6.1.2 데이터 품질 문제

**리스크**:
- 크롤링한 데이터의 정확도 낮음
- 연봉 정보 편차 큼
- 직무 정보 불완전

**대응 방안**:
- **다중 출처 검증**: 여러 출처의 데이터 평균
- **이상치 제거**: 통계적 방법으로 아웃라이어 제거
- **수동 검증**: 주요 직업은 수동으로 재확인
- **업데이트 주기**: 월 1회 정기 업데이트
- **피드백 수집**: 사용자 제보 기능 (optional)

#### 6.1.3 성능 문제

**리스크**:
- 대량 데이터 조회 시 느린 응답
- 크롤링 실행 중 서버 부하

**대응 방안**:
- **DB 인덱싱**: 자주 조회되는 컬럼 인덱스 생성
- **캐싱**: Redis 또는 Next.js 캐싱 활용
- **페이지네이션**: 대량 데이터 분할 로드
- **비동기 크롤링**: 백그라운드 작업으로 분리

### 6.2 비즈니스 리스크

#### 6.2.1 사용자 유입 부족

**리스크**:
- MVP 출시 후 사용자 유입 저조
- 검색 엔진 노출 부족

**대응 방안**:
- **SEO 최적화**: 메타 태그, 구조화된 데이터
- **소셜 미디어**: 트위터, 레딧, 커뮤니티 공유
- **콘텐츠 마케팅**: 블로그 글 작성 (AI 직업 영향 분석)
- **PR**: 기술 미디어 보도자료 (optional)

#### 6.2.2 데이터 저작권 문제

**리스크**:
- 크롤링한 데이터의 저작권 분쟁
- 출처 사이트의 법적 조치

**대응 방안**:
- **공개 데이터 우선**: 정부 공개 데이터 활용
- **출처 명시**: 모든 데이터 출처 명확히 표시
- **비상업적 사용**: 무료 서비스로 운영
- **이용약관**: 데이터 정확성 면책 조항

#### 6.2.3 수익 모델 부재

**리스크**:
- 서버 비용 지속 가능성 문제
- 장기 운영 동기 부족

**대응 방안** (Phase 2):
- **광고**: Google Adsense (트래픽 확보 후)
- **프리미엄 기능**: 상세 리포트, CSV 다운로드
- **API 제공**: 기업/연구기관 대상 유료 API
- **스폰서십**: 채용 플랫폼과 제휴

### 6.3 일정 리스크

#### 6.3.1 개발 지연

**리스크**:
- 예상보다 구현 시간 초과
- 예상치 못한 기술적 난관

**대응 방안**:
- **MVP 범위 축소**: 핵심 기능만 먼저 출시
- **우선순위 조정**: Must-have 기능 먼저 구현
- **Weekly Review**: 매주 진행 상황 점검

---

## 7. 결론 및 다음 단계

### 7.1 프로젝트 요약

**AXOracle**은 AI로 인한 직업 위험도를 데이터 기반으로 평가하는 혁신적인 서비스입니다. 3개국(한국, 미국, 일본) × 50개 직업 데이터를 제공하며, 각 직무별 AI 서비스 매핑과 위험도 점수를 산출합니다.

**핵심 강점**:
- ✅ 객관적 데이터 기반 평가
- ✅ 직무 수준의 세밀한 분석
- ✅ 실시간 AI 서비스 매핑
- ✅ 직관적인 UI/UX

### 7.2 다음 단계

1. **Speckit 문서 생성** (오늘)
   - specify.md: 기능 명세 상세화
   - plan.md: 구현 계획 구체화
   - tasks.md: DDD 레이어별 태스크 분해

2. **프로젝트 초기 설정** (내일)
   - Next.js 프로젝트 생성
   - Supabase 연동
   - 기본 폴더 구조

3. **Phase 1 시작** (Week 1)
   - DB 스키마 생성
   - 크롤링 스크립트 구현
   - 데이터 수집 시작

---

**작성 완료**: 2026-02-07
**다음 리뷰**: 2026-02-14 (Phase 1 완료 후)
