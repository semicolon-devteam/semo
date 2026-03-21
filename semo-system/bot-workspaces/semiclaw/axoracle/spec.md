# AXOracle 프로젝트 명세서 (Specification)

> **AI Transformation Oracle** - AI로 인한 직업 위험도 평가 서비스
>
> **문서 버전**: 1.0
> **작성일**: 2026-02-07
> **상태**: Draft

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기능 요구사항](#2-기능-요구사항)
3. [비기능 요구사항](#3-비기능-요구사항)
4. [데이터 명세](#4-데이터-명세)
5. [API 명세](#5-api-명세)
6. [UI/UX 명세](#6-uiux-명세)
7. [제약사항](#7-제약사항)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 목적

AI 기술의 급속한 발전으로 많은 직업이 자동화 위험에 처해 있습니다. **AXOracle**은 데이터 기반의 객관적인 위험도 평가를 제공하여 사용자들이 선제적으로 커리어를 준비할 수 있도록 돕습니다.

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| **투명성** | 국가별/직업별 구체적인 위험도 점수 공개 |
| **인사이트** | 직무별 AI 서비스 매핑으로 구체적인 위협 요소 파악 |
| **정보** | 평균 연봉 데이터 제공으로 진로 선택 지원 |
| **신뢰** | 객관적 데이터 기반 평가 및 출처 명시 |

### 1.3 사용자 플로우

```
Start
  ↓
1. Landing Page - 국가 선택 (KR/US/JP)
  ↓
2. Input Page - 직업명 + 연차 입력
  ↓
3. Result Page - 위험도 점수 + 주요 정보 표시
  ↓
4. Detail Page - 직무별 상세 분석 (Optional)
  ↓
End (공유 또는 다른 직업 분석)
```

---

## 2. 기능 요구사항

### 2.1 Landing Page (국가 선택)

#### FR-LP-001: 국가 선택
**설명**: 사용자는 3개 국가(한국, 미국, 일본) 중 하나를 선택할 수 있다.

**Acceptance Criteria**:
- [ ] 3개 국가 버튼이 크고 명확하게 표시된다
- [ ] 국가 선택 시 Input Page로 이동한다
- [ ] 선택된 국가 정보가 세션에 저장된다
- [ ] 국가 플래그 이모지가 표시된다 (🇰🇷 🇺🇸 🇯🇵)

**Priority**: P0 (Must-have)

#### FR-LP-002: 서비스 소개
**설명**: 사용자는 서비스의 목적과 제공 데이터 범위를 이해할 수 있다.

**Acceptance Criteria**:
- [ ] 서비스 소개 문구가 표시된다 ("AI 시대, 당신의 직업은 안전한가요?")
- [ ] 데이터 범위가 표시된다 ("3개국, 50개 직업 데이터 기반")
- [ ] 로고 또는 브랜드 이름이 표시된다

**Priority**: P0 (Must-have)

#### FR-LP-003: 반응형 디자인
**설명**: 모든 화면 크기에서 최적화된 레이아웃이 표시된다.

**Acceptance Criteria**:
- [ ] 모바일 (<640px): 세로 레이아웃, 버튼 전체 너비
- [ ] 태블릿 (640-1024px): 2열 레이아웃
- [ ] 데스크톱 (>1024px): 3열 레이아웃, 중앙 정렬

**Priority**: P0 (Must-have)

### 2.2 Input Page (직업 정보 입력)

#### FR-IP-001: 직업 검색 (자동완성)
**설명**: 사용자는 직업명을 입력하면 매칭되는 직업 목록이 표시된다.

**Acceptance Criteria**:
- [ ] 입력 필드에 2글자 이상 입력 시 자동완성 목록 표시
- [ ] 최대 10개 직업이 표시된다
- [ ] 검색어가 포함된 직업만 표시된다 (대소문자 무시)
- [ ] 선택된 국가의 직업만 표시된다
- [ ] 클릭 시 직업명이 입력 필드에 채워진다

**Priority**: P0 (Must-have)

**Test Cases**:
```
Input: "소프트"
Expected Output: ["소프트웨어 개발자", "소프트웨어 테스터", ...]

Input: "developer"
Expected Output: ["Software Developer", "Web Developer", ...]
```

#### FR-IP-002: 연차 입력
**설명**: 사용자는 경력 연차를 입력할 수 있다 (선택 사항).

**Acceptance Criteria**:
- [ ] 숫자만 입력 가능 (0-50년)
- [ ] 음수 입력 불가
- [ ] 빈 값 허용 (선택 사항)
- [ ] 플레이스홀더: "예: 5년"

**Priority**: P1 (Should-have)

#### FR-IP-003: 직업 추천 태그
**설명**: 사용자는 인기 직업을 빠르게 선택할 수 있다.

**Acceptance Criteria**:
- [ ] 입력 필드 아래에 3-5개 추천 직업 태그 표시
- [ ] 클릭 시 직업명이 자동 입력된다
- [ ] 국가별로 다른 추천 직업이 표시된다

**Priority**: P2 (Could-have)

**Examples**:
- 한국: "소프트웨어 개발자", "데이터 분석가", "프로덕트 매니저"
- 미국: "Software Developer", "Data Scientist", "UX Designer"

#### FR-IP-004: 유효성 검사
**설명**: 사용자는 유효하지 않은 입력 시 에러 메시지를 받는다.

**Acceptance Criteria**:
- [ ] 직업명이 비어있으면 "직업을 입력해주세요" 표시
- [ ] DB에 없는 직업이면 "해당 직업 데이터가 없습니다" 표시
- [ ] 에러 메시지는 빨간색으로 표시된다

**Priority**: P0 (Must-have)

#### FR-IP-005: 분석 시작 버튼
**설명**: 사용자는 "분석 시작하기" 버튼을 클릭하여 결과 페이지로 이동한다.

**Acceptance Criteria**:
- [ ] 직업명이 유효하면 버튼이 활성화된다
- [ ] 클릭 시 Result Page로 이동한다
- [ ] 로딩 상태가 표시된다 (스피너)

**Priority**: P0 (Must-have)

### 2.3 Result Page (결과 표시)

#### FR-RP-001: 위험도 점수 표시
**설명**: 사용자는 선택한 직업의 AI 대체 위험도 점수를 확인할 수 있다.

**Acceptance Criteria**:
- [ ] 위험도 점수가 0-100% 범위로 표시된다
- [ ] Risk Level이 표시된다 (Low/Medium/High/Critical)
- [ ] 진행 바가 색상으로 시각화된다 (녹색/노랑/빨강)
- [ ] 점수는 소수점 1자리까지 표시된다 (예: 45.5%)

**Priority**: P0 (Must-have)

**Risk Level Mapping**:
| 점수 | Risk Level | 색상 |
|------|-----------|------|
| 0-25% | Low | 녹색 (#10B981) |
| 26-50% | Medium | 노랑 (#F59E0B) |
| 51-75% | High | 빨강 (#EF4444) |
| 76-100% | Critical | 진빨강 (#991B1B) |

#### FR-RP-002: 핵심 지표 표시
**설명**: 사용자는 평균 연봉, 분석 직무 수, 매핑된 AI 서비스 수를 확인할 수 있다.

**Acceptance Criteria**:
- [ ] 평균 연봉이 통화 기호와 함께 표시된다 (예: ₩ 68,000,000)
- [ ] 분석 직무 수가 표시된다 (예: 8개)
- [ ] 매핑된 AI 서비스 수가 표시된다 (예: 12개)
- [ ] 각 지표에 아이콘이 표시된다 (💰, 📊, 🤖)

**Priority**: P0 (Must-have)

#### FR-RP-003: 직무별 상세 정보
**설명**: 사용자는 각 직무의 업무 비중, 관련 AI 서비스, 위험도를 확인할 수 있다.

**Acceptance Criteria**:
- [ ] 직무 목록이 업무 비중 순으로 정렬되어 표시된다
- [ ] 각 직무마다 다음이 표시된다:
  - 직무명 (예: "코드 작성")
  - 업무 비중 (예: 35%)
  - 관련 AI 서비스 목록 (최대 3개)
  - 직무별 위험도 (Low/Medium/High/Critical)
- [ ] "더 보기" 버튼으로 나머지 직무 표시 (접기/펼치기)

**Priority**: P0 (Must-have)

#### FR-RP-004: 결과 공유 기능
**설명**: 사용자는 분석 결과를 다른 사람과 공유할 수 있다.

**Acceptance Criteria**:
- [ ] "결과 공유하기" 버튼이 표시된다
- [ ] 클릭 시 현재 페이지 URL이 클립보드에 복사된다
- [ ] 복사 완료 토스트 메시지가 표시된다

**Priority**: P1 (Should-have)

#### FR-RP-005: 다른 직업 분석
**설명**: 사용자는 다른 직업을 분석할 수 있다.

**Acceptance Criteria**:
- [ ] "다른 직업 분석" 버튼이 표시된다
- [ ] 클릭 시 Input Page로 이동한다
- [ ] 국가 선택은 유지된다

**Priority**: P1 (Should-have)

### 2.4 Detail Page (상세 분석)

#### FR-DP-001: 직무 상세 정보
**설명**: 사용자는 특정 직무의 상세 정보를 확인할 수 있다.

**Acceptance Criteria**:
- [ ] 직무명, 업무 비중, AI 대체율, 위험도가 표시된다
- [ ] 관련 AI 서비스 목록이 표시된다 (제한 없음)
- [ ] 각 AI 서비스마다 다음이 표시된다:
  - 서비스명
  - 간단한 설명
  - 출시 연도
  - 공식 사이트 링크

**Priority**: P2 (Could-have)

#### FR-DP-002: 대응 전략 제안
**설명**: 사용자는 해당 직무에 대한 대응 전략을 확인할 수 있다.

**Acceptance Criteria**:
- [ ] 3-5개의 대응 전략이 불릿 포인트로 표시된다
- [ ] 위험도에 따라 다른 전략이 제시된다
  - Low: "AI 도구를 적극 활용하여 생산성 향상"
  - High: "AI가 대체하기 어려운 영역에 집중"

**Priority**: P2 (Could-have)

### 2.5 공통 기능

#### FR-CM-001: 네비게이션
**설명**: 사용자는 이전 페이지로 돌아갈 수 있다.

**Acceptance Criteria**:
- [ ] 모든 페이지에 "← 뒤로" 버튼이 표시된다 (Landing Page 제외)
- [ ] 클릭 시 브라우저 히스토리 기준으로 이전 페이지로 이동한다

**Priority**: P0 (Must-have)

#### FR-CM-002: 로딩 상태
**설명**: 사용자는 데이터 로딩 중임을 알 수 있다.

**Acceptance Criteria**:
- [ ] API 호출 중 로딩 스피너가 표시된다
- [ ] 로딩 중에는 사용자 입력이 비활성화된다
- [ ] 로딩이 3초 이상 지속되면 "잠시만 기다려주세요" 메시지 표시

**Priority**: P0 (Must-have)

#### FR-CM-003: 에러 핸들링
**설명**: 사용자는 에러 발생 시 명확한 안내를 받는다.

**Acceptance Criteria**:
- [ ] 네트워크 에러 시 "네트워크 오류가 발생했습니다" 표시
- [ ] 서버 에러 시 "일시적인 오류가 발생했습니다" 표시
- [ ] 에러 메시지 아래 "다시 시도" 버튼 표시
- [ ] 404 에러 시 "페이지를 찾을 수 없습니다" 표시

**Priority**: P0 (Must-have)

---

## 3. 비기능 요구사항

### 3.1 성능 요구사항

#### NFR-PF-001: 페이지 로드 시간
**요구사항**: 모든 페이지는 2초 이내에 로드되어야 한다.

**측정 지표**:
- First Contentful Paint (FCP) < 1.5초
- Largest Contentful Paint (LCP) < 2.5초
- Time to Interactive (TTI) < 3.5초

**검증 방법**: Lighthouse 측정

#### NFR-PF-002: API 응답 시간
**요구사항**: 모든 API는 500ms 이내에 응답해야 한다 (95th percentile).

**측정 지표**:
- GET /api/countries < 100ms
- GET /api/occupations/search < 200ms
- GET /api/occupations/[id]/risk-score < 500ms

**검증 방법**: 성능 테스트 (k6, Artillery)

#### NFR-PF-003: 데이터베이스 쿼리 최적화
**요구사항**: 모든 DB 쿼리는 100ms 이내에 완료되어야 한다.

**구현 방법**:
- 인덱스 생성 (country, name_local, occupation_id)
- N+1 쿼리 방지 (Eager loading)
- 쿼리 결과 캐싱

### 3.2 확장성 요구사항

#### NFR-SC-001: 동시 사용자
**요구사항**: 최소 1,000명의 동시 사용자를 지원해야 한다.

**구현 방법**:
- Vercel 자동 스케일링
- CDN 캐싱 (정적 자산)
- DB 연결 풀링

#### NFR-SC-002: 데이터 확장성
**요구사항**: 향후 10개국, 500개 직업까지 확장 가능해야 한다.

**구현 방법**:
- 유연한 DB 스키마 설계
- 국가별/직업별 파티셔닝 (optional)

### 3.3 보안 요구사항

#### NFR-SC-001: API 보안
**요구사항**: 모든 API는 Rate Limiting을 적용해야 한다.

**구현 방법**:
- Vercel Edge Config로 IP당 100 req/min 제한
- CORS 정책 설정 (허용된 도메인만)

#### NFR-SC-002: 데이터 보안
**요구사항**: 민감한 환경 변수는 안전하게 관리되어야 한다.

**구현 방법**:
- .env.local은 .gitignore에 추가
- Vercel Environment Variables 사용
- Supabase RLS (Row Level Security) 적용

#### NFR-SC-003: HTTPS
**요구사항**: 모든 통신은 HTTPS로 암호화되어야 한다.

**구현 방법**:
- Vercel 자동 HTTPS 적용
- Supabase PostgreSQL 연결 SSL 사용

### 3.4 사용성 요구사항

#### NFR-US-001: 접근성 (Accessibility)
**요구사항**: WCAG 2.1 Level AA 기준을 준수해야 한다.

**구현 방법**:
- 최소 색상 대비비 4.5:1
- 키보드 네비게이션 지원 (Tab, Enter)
- ARIA 속성 추가 (role, aria-label)
- 스크린 리더 호환

**검증 방법**: axe DevTools, WAVE

#### NFR-US-002: 반응형 디자인
**요구사항**: 모든 화면 크기에서 최적화된 UI를 제공해야 한다.

**Breakpoints**:
- Mobile: < 640px
- Tablet: 640-1024px
- Desktop: > 1024px

**검증 방법**: Chrome DevTools, BrowserStack

#### NFR-US-003: 다국어 지원 (i18n)
**요구사항**: UI 텍스트는 국가별로 현지화되어야 한다 (MVP 제외, Phase 2).

**지원 언어**:
- 한국어 (ko)
- 영어 (en)
- 일본어 (ja)

### 3.5 유지보수성 요구사항

#### NFR-MT-001: 코드 품질
**요구사항**: 모든 코드는 ESLint, Prettier 규칙을 준수해야 한다.

**검증 방법**:
- Pre-commit hook (husky)
- CI/CD 파이프라인에서 lint 체크

#### NFR-MT-002: 테스트 커버리지
**요구사항**: 핵심 로직은 80% 이상의 테스트 커버리지를 달성해야 한다.

**테스트 범위**:
- 위험도 계산 로직: Unit test
- API 엔드포인트: Integration test
- 사용자 플로우: E2E test (Playwright)

#### NFR-MT-003: 문서화
**요구사항**: 주요 기능은 README 또는 주석으로 문서화되어야 한다.

**문서 포함 사항**:
- 프로젝트 설치 방법
- 환경 변수 설정
- 크롤링 스크립트 실행 방법
- API 엔드포인트 목록

---

## 4. 데이터 명세

### 4.1 데이터베이스 스키마

#### Table: `countries`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| code | VARCHAR(2) | PRIMARY KEY | 국가 코드 (KR, US, JP) |
| name_en | VARCHAR(100) | NOT NULL | 영문 국가명 |
| name_local | VARCHAR(100) | NOT NULL | 현지어 국가명 |
| currency | VARCHAR(3) | NOT NULL | 통화 코드 (KRW, USD, JPY) |
| flag_emoji | VARCHAR(10) | | 플래그 이모지 |

**Sample Data**:
```sql
INSERT INTO countries VALUES
  ('KR', 'South Korea', '대한민국', 'KRW', '🇰🇷'),
  ('US', 'United States', 'United States', 'USD', '🇺🇸'),
  ('JP', 'Japan', '日本', 'JPY', '🇯🇵');
```

#### Table: `occupations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | 직업 고유 ID |
| country | VARCHAR(2) | FK → countries.code | 국가 코드 |
| name_en | VARCHAR(255) | NOT NULL | 영문 직업명 |
| name_local | VARCHAR(255) | NOT NULL | 현지어 직업명 |
| average_salary | DECIMAL(12,2) | | 평균 연봉 |
| currency | VARCHAR(3) | | 통화 코드 |
| data_source | VARCHAR(255) | | 데이터 출처 |
| last_updated | TIMESTAMP | | 마지막 업데이트 |
| created_at | TIMESTAMP | DEFAULT NOW() | 생성일 |

**Indexes**:
```sql
CREATE INDEX idx_occupations_country_name ON occupations(country, name_local);
```

**Sample Data**:
```sql
INSERT INTO occupations (id, country, name_en, name_local, average_salary, currency, data_source) VALUES
  (gen_random_uuid(), 'KR', 'Software Developer', '소프트웨어 개발자', 68000000, 'KRW', '사람인'),
  (gen_random_uuid(), 'US', 'Software Developer', 'Software Developer', 110000, 'USD', 'BLS');
```

#### Table: `tasks`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | 직무 고유 ID |
| occupation_id | UUID | FK → occupations.id ON DELETE CASCADE | 직업 ID |
| name | VARCHAR(255) | NOT NULL | 직무명 |
| description | TEXT | | 직무 설명 |
| time_percentage | DECIMAL(5,2) | CHECK (0-100) | 업무 비중 (%) |
| ai_replacement_rate | DECIMAL(5,2) | CHECK (0-100) | AI 대체율 (%) |
| data_source | VARCHAR(255) | | 데이터 출처 |
| created_at | TIMESTAMP | DEFAULT NOW() | 생성일 |

**Indexes**:
```sql
CREATE INDEX idx_tasks_occupation ON tasks(occupation_id);
```

**Sample Data**:
```sql
INSERT INTO tasks (id, occupation_id, name, time_percentage, ai_replacement_rate) VALUES
  (gen_random_uuid(), 'uuid-of-software-developer', '코드 작성', 35, 60),
  (gen_random_uuid(), 'uuid-of-software-developer', '디버깅', 20, 40);
```

#### Table: `ai_services`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | AI 서비스 고유 ID |
| name | VARCHAR(255) | NOT NULL | 서비스명 |
| description | TEXT | | 서비스 설명 |
| url | VARCHAR(500) | | 공식 사이트 URL |
| release_year | INTEGER | | 출시 연도 |
| category | VARCHAR(100) | | 카테고리 (Coding, Design, Writing) |
| created_at | TIMESTAMP | DEFAULT NOW() | 생성일 |

**Sample Data**:
```sql
INSERT INTO ai_services (id, name, description, url, release_year, category) VALUES
  (gen_random_uuid(), 'GitHub Copilot', 'AI 코드 자동완성', 'https://github.com/features/copilot', 2021, 'Coding'),
  (gen_random_uuid(), 'Midjourney', 'AI 이미지 생성', 'https://midjourney.com', 2022, 'Design');
```

#### Table: `task_ai_services` (Many-to-Many)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| task_id | UUID | FK → tasks.id ON DELETE CASCADE | 직무 ID |
| ai_service_id | UUID | FK → ai_services.id ON DELETE CASCADE | AI 서비스 ID |
| relevance_score | DECIMAL(3,2) | CHECK (0-1) | 관련도 (0-1) |
| PRIMARY KEY | (task_id, ai_service_id) | | 복합 키 |

**Indexes**:
```sql
CREATE INDEX idx_task_ai_services_task ON task_ai_services(task_id);
CREATE INDEX idx_task_ai_services_ai ON task_ai_services(ai_service_id);
```

**Sample Data**:
```sql
INSERT INTO task_ai_services (task_id, ai_service_id, relevance_score) VALUES
  ('uuid-of-code-writing-task', 'uuid-of-github-copilot', 0.95),
  ('uuid-of-code-writing-task', 'uuid-of-cursor-ai', 0.90);
```

### 4.2 데이터 수집 출처

| 데이터 유형 | 국가 | 출처 | 업데이트 주기 |
|-----------|------|------|-------------|
| 연봉 | 한국 | 사람인, 잡코리아 | 월 1회 |
| 연봉 | 미국 | BLS (Bureau of Labor Statistics) | 월 1회 |
| 연봉 | 일본 | 후생노동성 | 월 1회 |
| 직무 | 미국 (공통) | O*NET Online | 분기 1회 |
| AI 서비스 | 글로벌 | 수동 큐레이션 | 수동 |

### 4.3 데이터 품질 기준

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 완전성 | 95% 이상 | NULL 값 비율 < 5% |
| 정확성 | 90% 이상 | 수동 샘플 검증 |
| 최신성 | 1개월 이내 | last_updated 컬럼 체크 |
| 일관성 | 100% | 동일 직업 연봉 편차 < 20% |

---

## 5. API 명세

### 5.1 GET /api/countries

**목적**: 지원하는 국가 목록 조회

**Request**:
```http
GET /api/countries HTTP/1.1
Host: axoracle.vercel.app
```

**Response** (200 OK):
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

**Error Responses**:
- 500 Internal Server Error: DB 연결 실패

### 5.2 GET /api/occupations/search

**목적**: 직업 검색 (자동완성)

**Request**:
```http
GET /api/occupations/search?q=소프트웨어&country=KR HTTP/1.1
Host: axoracle.vercel.app
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | 검색어 (최소 2글자) |
| country | string | Yes | 국가 코드 (KR/US/JP) |
| limit | integer | No | 최대 결과 수 (기본: 10) |

**Response** (200 OK):
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

**Error Responses**:
- 400 Bad Request: 검색어가 2글자 미만 또는 country 누락
- 404 Not Found: 검색 결과 없음
- 500 Internal Server Error: DB 연결 실패

### 5.3 GET /api/occupations/[id]/risk-score

**목적**: 위험도 점수 및 상세 정보 조회

**Request**:
```http
GET /api/occupations/uuid-1/risk-score HTTP/1.1
Host: axoracle.vercel.app
```

**Response** (200 OK):
```json
{
  "occupation": {
    "id": "uuid-1",
    "name_local": "소프트웨어 개발자",
    "name_en": "Software Developer",
    "average_salary": 68000000,
    "currency": "KRW",
    "country": "KR"
  },
  "risk_score": 45.5,
  "risk_level": "Medium",
  "tasks": [
    {
      "id": "task-1",
      "name": "코드 작성",
      "time_percentage": 35,
      "ai_replacement_rate": 60,
      "task_risk_score": 21.0,
      "ai_services": [
        {
          "id": "ai-1",
          "name": "GitHub Copilot",
          "description": "AI 코드 자동완성",
          "url": "https://github.com/features/copilot",
          "release_year": 2021,
          "category": "Coding"
        },
        {
          "id": "ai-2",
          "name": "Cursor AI",
          "description": "AI 페어 프로그래밍",
          "url": "https://cursor.sh",
          "release_year": 2023,
          "category": "Coding"
        }
      ]
    },
    {
      "id": "task-2",
      "name": "디버깅",
      "time_percentage": 20,
      "ai_replacement_rate": 40,
      "task_risk_score": 8.0,
      "ai_services": [
        {
          "id": "ai-3",
          "name": "Sentry AI",
          "description": "자동 에러 분석 및 해결 제안",
          "url": "https://sentry.io",
          "release_year": 2020,
          "category": "Debugging"
        }
      ]
    }
  ],
  "summary": {
    "total_tasks": 8,
    "total_ai_services": 12,
    "highest_risk_task": {
      "name": "코드 작성",
      "risk_score": 21.0
    }
  }
}
```

**Calculation Logic**:
```
risk_score = Σ(task.ai_replacement_rate × task.time_percentage) / 100
task_risk_score = ai_replacement_rate × time_percentage / 100

Example:
Task 1: 60% × 35% = 21.0%
Task 2: 40% × 20% = 8.0%
Total Risk Score = 21.0 + 8.0 + ... = 45.5%
```

**Error Responses**:
- 404 Not Found: 직업 ID가 존재하지 않음
- 500 Internal Server Error: DB 연결 실패

### 5.4 POST /api/cron/crawl-salaries (Internal)

**목적**: 크롤링 스케줄러 (Vercel Cron Jobs)

**Request**:
```http
POST /api/cron/crawl-salaries HTTP/1.1
Host: axoracle.vercel.app
Authorization: Bearer {CRON_SECRET}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Crawling completed",
  "results": {
    "KR": { "status": "success", "records": 50 },
    "US": { "status": "success", "records": 50 },
    "JP": { "status": "success", "records": 50 }
  },
  "timestamp": "2026-02-07T10:00:00Z"
}
```

**Error Responses**:
- 401 Unauthorized: CRON_SECRET 불일치
- 500 Internal Server Error: 크롤링 실패

---

## 6. UI/UX 명세

### 6.1 색상 시스템

| 용도 | 색상 | Hex Code | 사용 예시 |
|------|------|----------|----------|
| Primary | Blue | #2563EB | CTA 버튼, 링크 |
| Success (Low Risk) | Green | #10B981 | 위험도 0-25% |
| Warning (Medium Risk) | Yellow | #F59E0B | 위험도 26-50% |
| Danger (High Risk) | Red | #EF4444 | 위험도 51-75% |
| Critical (Critical Risk) | Dark Red | #991B1B | 위험도 76-100% |
| Neutral | Gray | #6B7280 | 텍스트, 배경 |
| Background | White | #FFFFFF | 페이지 배경 |
| Surface | Light Gray | #F3F4F6 | 카드 배경 |

### 6.2 타이포그래피

| 요소 | Font Size | Font Weight | Line Height | 용도 |
|------|-----------|-------------|-------------|------|
| H1 | 48px | Bold | 1.2 | 페이지 제목 |
| H2 | 32px | Semibold | 1.3 | 섹션 제목 |
| H3 | 24px | Medium | 1.4 | 서브섹션 제목 |
| Body | 16px | Regular | 1.6 | 본문 텍스트 |
| Caption | 14px | Regular | 1.5 | 보조 텍스트 |
| Button | 16px | Semibold | 1 | 버튼 텍스트 |

**Font Family**:
- 한글: Pretendard Variable
- 영문/숫자: Inter

### 6.3 간격 시스템 (Spacing)

| 크기 | Pixels | 용도 |
|------|--------|------|
| XS | 4px | 아이콘-텍스트 간격 |
| SM | 8px | 버튼 패딩 (세로) |
| MD | 16px | 카드 패딩, 섹션 간격 |
| LG | 24px | 페이지 여백 |
| XL | 32px | 섹션 구분 |
| 2XL | 48px | 페이지 상단/하단 |

### 6.4 반응형 Breakpoints

| 디바이스 | 화면 크기 | 레이아웃 변경 |
|---------|----------|-------------|
| Mobile | < 640px | 1 column, 전체 너비, 작은 폰트 |
| Tablet | 640-1024px | 2 columns, 패딩 증가 |
| Desktop | > 1024px | 3 columns, 최대 너비 1280px, 중앙 정렬 |

### 6.5 컴포넌트 명세

#### 6.5.1 Button

**Variants**:
- Primary: 파란색 배경, 흰색 텍스트
- Secondary: 흰색 배경, 파란색 테두리, 파란색 텍스트
- Danger: 빨간색 배경, 흰색 텍스트

**States**:
- Default
- Hover: 밝기 10% 감소
- Active: 밝기 20% 감소
- Disabled: 회색 배경, 회색 텍스트

**Sizes**:
- SM: 높이 36px, 패딩 8px 16px
- MD: 높이 44px, 패딩 12px 24px
- LG: 높이 52px, 패딩 16px 32px

#### 6.5.2 Input Field

**States**:
- Default: 회색 테두리
- Focus: 파란색 테두리, 그림자
- Error: 빨간색 테두리, 에러 메시지
- Disabled: 회색 배경

**Props**:
- placeholder: 안내 문구
- label: 입력 필드 라벨
- helperText: 도움말 텍스트
- error: 에러 메시지

#### 6.5.3 Progress Bar

**Variants**:
- Low Risk: 녹색
- Medium Risk: 노랑
- High Risk: 빨강
- Critical Risk: 진빨강

**Props**:
- value: 0-100 (숫자)
- showLabel: 라벨 표시 여부 (boolean)

#### 6.5.4 Card

**Structure**:
- Header (optional)
- Body
- Footer (optional)

**Props**:
- title: 카드 제목
- subtitle: 부제목
- children: 카드 내용

---

## 7. 제약사항

### 7.1 기술적 제약사항

#### C-TC-001: 크롤링 제약
- 사람인, 잡코리아는 robots.txt 및 이용약관 준수 필요
- Rate Limiting 적용 (1-2초 간격)
- IP 차단 위험으로 인해 Proxy 사용 검토

#### C-TC-002: 데이터베이스 제약
- Supabase Free Tier: 500MB 저장공간, 2GB 전송량
- 초과 시 유료 전환 필요

#### C-TC-003: 서버리스 제약
- Vercel 무료 플랜: 월 100GB 대역폭, 100 serverless executions/day
- Cron Job 최소 간격: 1분

### 7.2 데이터 제약사항

#### C-DC-001: 데이터 완전성
- MVP 단계에서는 50개 직업만 지원
- 일부 직업은 직무 정보가 불완전할 수 있음

#### C-DC-002: 데이터 정확성
- 크롤링 데이터의 정확도는 80-90% 수준
- 수동 검증 필요

#### C-DC-003: 데이터 최신성
- 월 1회 업데이트로 인해 최대 1개월 지연 가능
- 실시간 데이터는 제공하지 않음

### 7.3 비즈니스 제약사항

#### C-BC-001: 수익 모델 부재
- MVP 단계에서는 무료 서비스
- 서버 비용은 개발자 부담

#### C-BC-002: 법적 책임
- 데이터 정확성 보장 불가 (면책 조항 필요)
- 직업 선택 또는 전직 결정에 대한 법적 책임 없음

#### C-BC-003: 다국어 지원 제한
- MVP 단계에서는 UI 다국어 지원 안 함
- 데이터만 국가별 언어 제공

### 7.4 일정 제약사항

#### C-SC-001: MVP 개발 기간
- 1개월+ 소요 예상
- 혼자 개발하므로 일정 지연 위험

---

## 8. 향후 확장 계획 (Phase 2)

### 8.1 기능 확장

- [ ] 연차 반영 위험도 조정 (경력에 따른 가중치)
- [ ] 결과 저장 기능 (로그인 필요)
- [ ] 직업 비교 기능 (2개 이상 직업 동시 비교)
- [ ] 공유 이미지 자동 생성 (OG Image)
- [ ] AI 서비스 자동 수집 (Product Hunt API)

### 8.2 데이터 확장

- [ ] 10개국 이상 지원
- [ ] 500개 직업 지원
- [ ] AI 서비스 100개 이상
- [ ] 실시간 크롤링 (주 1회 → 일 1회)

### 8.3 기술 확장

- [ ] 다국어 지원 (i18n)
- [ ] PWA (Progressive Web App)
- [ ] 모바일 앱 (React Native)
- [ ] API 제공 (유료)

---

**문서 버전**: 1.0
**최종 수정일**: 2026-02-07
**작성자**: User + SEMO AI Assistant
