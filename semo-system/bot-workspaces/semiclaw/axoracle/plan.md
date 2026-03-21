# AXOracle 구현 계획 (Implementation Plan)

> **AI Transformation Oracle** - AI로 인한 직업 위험도 평가 서비스
>
> **문서 버전**: 1.0
> **작성일**: 2026-02-07
> **예상 기간**: 1개월+ (5주)

---

## 목차

1. [구현 전략](#1-구현-전략)
2. [Phase별 상세 계획](#2-phase별-상세-계획)
3. [기술 의사결정](#3-기술-의사결정)
4. [리스크 관리 계획](#4-리스크-관리-계획)
5. [품질 보증 계획](#5-품질-보증-계획)

---

## 1. 구현 전략

### 1.1 전체 접근 방식

**전략**: **Iterative & Incremental Development**

프로젝트를 5개 Phase로 나누어 각 Phase마다 동작하는 프로토타입을 생성합니다. 각 Phase 종료 시 데모 가능한 상태를 유지하여 피드백을 빠르게 반영할 수 있도록 합니다.

**핵심 원칙**:
1. **기능 우선** (MVP-first): 핵심 기능부터 구현
2. **테스트 주도** (TDD): 위험도 계산 등 핵심 로직은 테스트 먼저 작성
3. **데이터 중심** (Data-driven): 데이터 수집이 완료되어야 UI 구현
4. **점진적 개선** (Incremental): 한 번에 완벽하게 만들지 않고 반복 개선

### 1.2 Phase 개요

| Phase | 기간 | 목표 | 산출물 |
|-------|------|------|--------|
| **Phase 1** | Week 1 | 프로젝트 설정 + 데이터 수집 스크립트 | 크롤러, DB 스키마 |
| **Phase 2** | Week 2 | 데이터 수집 + 정제 | 정제된 데이터셋 |
| **Phase 3** | Week 3 | 프론트엔드 UI 구현 | 동작하는 UI |
| **Phase 4** | Week 4 | 로직 구현 + 테스트 | 완전한 MVP |
| **Phase 5** | Week 5+ | 폴리싱 + 배포 | 프로덕션 배포 |

### 1.3 우선순위 정의

**P0 (Must-have)**: MVP에 필수적인 기능
- 국가 선택, 직업 검색, 위험도 계산, 결과 표시

**P1 (Should-have)**: 중요하지만 MVP에 필수는 아닌 기능
- 결과 공유, 연차 입력, 다른 직업 분석

**P2 (Could-have)**: 있으면 좋은 기능, 시간 여유 시 구현
- Detail Page, 대응 전략 제안, 추천 직업 태그

**P3 (Won't-have)**: Phase 2 이후로 미룸
- 다국어 지원, 결과 저장, 직업 비교

---

## 2. Phase별 상세 계획

### Phase 1: 프로젝트 설정 + 데이터 수집 스크립트 (Week 1)

#### 목표
- Next.js 프로젝트 기본 구조 완성
- Supabase 연동 및 DB 스키마 생성
- 데이터 수집 스크립트 구현 (크롤러 + API)

#### Day 1-2: 환경 설정

**작업 목록**:
```bash
# 1. Next.js 프로젝트 생성
npx create-next-app@latest axoracle --typescript --tailwind --app --src-dir

# 2. 필수 의존성 설치
npm install @supabase/supabase-js
npm install playwright
npm install zod
npm install recharts
npm install class-variance-authority clsx tailwind-merge

# 3. shadcn/ui 설치
npx shadcn@latest init

# 4. ESLint, Prettier 설정
npm install -D eslint-config-prettier prettier

# 5. Supabase CLI 설치 (로컬 개발)
npm install -D supabase

# 6. 환경 변수 설정
cp .env.example .env.local
```

**.env.local 템플릿**:
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

# Google Translate (Optional)
GOOGLE_TRANSLATE_API_KEY=
```

**폴더 구조 생성**:
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

**Deliverables**:
- [ ] Next.js 프로젝트 생성 완료
- [ ] 의존성 설치 완료
- [ ] 폴더 구조 생성 완료
- [ ] 환경 변수 템플릿 작성 완료
- [ ] Git 초기 커밋 완료

#### Day 3-4: DB 스키마 설계 및 생성

**Supabase 프로젝트 생성**:
1. https://supabase.com 접속
2. 새 프로젝트 생성 (이름: axoracle)
3. Database Password 설정
4. Region 선택 (Northeast Asia - Seoul)
5. URL 및 API Key 복사 → `.env.local`에 저장

**마이그레이션 작성**:
`supabase/migrations/20260207_initial_schema.sql`
```sql
-- countries 테이블
CREATE TABLE countries (
  code VARCHAR(2) PRIMARY KEY,
  name_en VARCHAR(100) NOT NULL,
  name_local VARCHAR(100) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  flag_emoji VARCHAR(10)
);

-- occupations 테이블
CREATE TABLE occupations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(2) REFERENCES countries(code),
  name_en VARCHAR(255) NOT NULL,
  name_local VARCHAR(255) NOT NULL,
  average_salary DECIMAL(12, 2),
  currency VARCHAR(3),
  data_source VARCHAR(255),
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_occupations_country_name ON occupations(country, name_local);

-- tasks 테이블
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id UUID REFERENCES occupations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  time_percentage DECIMAL(5, 2) CHECK (time_percentage BETWEEN 0 AND 100),
  ai_replacement_rate DECIMAL(5, 2) CHECK (ai_replacement_rate BETWEEN 0 AND 100),
  data_source VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_occupation ON tasks(occupation_id);

-- ai_services 테이블
CREATE TABLE ai_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(500),
  release_year INTEGER,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- task_ai_services 관계 테이블
CREATE TABLE task_ai_services (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  ai_service_id UUID REFERENCES ai_services(id) ON DELETE CASCADE,
  relevance_score DECIMAL(3, 2) CHECK (relevance_score BETWEEN 0 AND 1),
  PRIMARY KEY (task_id, ai_service_id)
);

CREATE INDEX idx_task_ai_services_task ON task_ai_services(task_id);
CREATE INDEX idx_task_ai_services_ai ON task_ai_services(ai_service_id);

-- crawl_logs 테이블 (모니터링용)
CREATE TABLE crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(2),
  data_type VARCHAR(50),
  status VARCHAR(20),
  records_count INTEGER,
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

**마이그레이션 실행**:
```bash
# Supabase에 마이그레이션 적용
supabase db push
```

**시드 데이터 작성**:
`supabase/seed.sql`
```sql
-- 국가 데이터
INSERT INTO countries VALUES
  ('KR', 'South Korea', '대한민국', 'KRW', '🇰🇷'),
  ('US', 'United States', 'United States', 'USD', '🇺🇸'),
  ('JP', 'Japan', '日本', 'JPY', '🇯🇵');
```

**Deliverables**:
- [ ] Supabase 프로젝트 생성 완료
- [ ] 마이그레이션 파일 작성 완료
- [ ] 마이그레이션 실행 완료
- [ ] 시드 데이터 삽입 완료
- [ ] Supabase Studio에서 테이블 확인 완료

#### Day 5-7: 데이터 수집 스크립트 구현

**작업 1: 한국 연봉 크롤러 (사람인)**

`lib/crawlers/korea.ts`
```typescript
import { chromium } from 'playwright';
import { supabase } from '../supabase/client';

export async function crawlKoreaSalary() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 사람인 연봉 통계 페이지
    await page.goto('https://www.saramin.co.kr/zf_user/salaryinfo');

    // 직업 카테고리 선택
    const categories = await page.locator('.category-list li').all();
    const salaries = [];

    for (const category of categories) {
      await category.click();
      await page.waitForLoadState('networkidle');

      // 직업별 연봉 데이터 추출
      const data = await page.locator('.salary-item').evaluateAll(items => {
        return items.map(item => ({
          occupation: item.querySelector('.occupation-name')?.textContent || '',
          averageSalary: parseFloat(item.querySelector('.salary-value')?.textContent || '0'),
          currency: 'KRW'
        }));
      });

      salaries.push(...data);
    }

    // DB에 저장
    for (const salary of salaries) {
      await supabase.from('occupations').upsert({
        country: 'KR',
        name_local: salary.occupation,
        name_en: salary.occupation, // 번역 필요
        average_salary: salary.averageSalary,
        currency: 'KRW',
        data_source: '사람인',
        last_updated: new Date().toISOString()
      });
    }

    // 로그 저장
    await supabase.from('crawl_logs').insert({
      country: 'KR',
      data_type: 'salary',
      status: 'success',
      records_count: salaries.length
    });

    console.log(`✅ 한국 연봉 데이터 ${salaries.length}개 수집 완료`);
  } catch (error) {
    console.error('❌ 한국 연봉 크롤링 실패:', error);

    // 에러 로그
    await supabase.from('crawl_logs').insert({
      country: 'KR',
      data_type: 'salary',
      status: 'failed',
      error_message: error.message
    });
  } finally {
    await browser.close();
  }
}
```

**작업 2: 미국 연봉 API (BLS)**

`lib/crawlers/us.ts`
```typescript
import { supabase } from '../supabase/client';

export async function fetchUSSalary() {
  const BLS_API_KEY = process.env.BLS_API_KEY;

  // BLS Series IDs (주요 직업)
  const seriesIds = [
    'OEUN000000000000003', // Software Developers
    'OEUN000000000000005', // Data Scientists
    // ... 50개 직업
  ];

  try {
    const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: seriesIds,
        registrationkey: BLS_API_KEY,
        startyear: '2025',
        endyear: '2026'
      })
    });

    const data = await response.json();
    const salaries = [];

    for (const series of data.Results.series) {
      const latestSalary = series.data[0].value;
      salaries.push({
        occupation: getOccupationName(series.seriesID), // Helper function
        averageSalary: latestSalary,
        currency: 'USD'
      });
    }

    // DB에 저장
    for (const salary of salaries) {
      await supabase.from('occupations').upsert({
        country: 'US',
        name_local: salary.occupation,
        name_en: salary.occupation,
        average_salary: salary.averageSalary,
        currency: 'USD',
        data_source: 'BLS',
        last_updated: new Date().toISOString()
      });
    }

    console.log(`✅ 미국 연봉 데이터 ${salaries.length}개 수집 완료`);
  } catch (error) {
    console.error('❌ 미국 연봉 API 호출 실패:', error);
  }
}
```

**작업 3: O*NET 직무 데이터 API**

`lib/crawlers/onet.ts`
```typescript
import { supabase } from '../supabase/client';

export async function fetchONETTasks(occupationCode: string) {
  const ONET_USERNAME = process.env.ONET_USERNAME;
  const ONET_PASSWORD = process.env.ONET_PASSWORD;

  try {
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
  } catch (error) {
    console.error('❌ O*NET API 호출 실패:', error);
    return [];
  }
}

// Helper: 업무 비중 추정 (임시)
function estimateTimePercentage(task: any): number {
  // 초기에는 균등 분배, 나중에 수동 조정
  return 100 / 8; // 8개 직무 가정
}
```

**작업 4: 통합 스크립트**

`scripts/crawl-all.ts`
```typescript
import { crawlKoreaSalary } from '../lib/crawlers/korea';
import { fetchUSSalary } from '../lib/crawlers/us';
import { crawlJapanSalary } from '../lib/crawlers/japan';

async function main() {
  console.log('🚀 데이터 수집 시작...\n');

  await crawlKoreaSalary();
  await fetchUSSalary();
  await crawlJapanSalary();

  console.log('\n✅ 모든 데이터 수집 완료!');
}

main().catch(console.error);
```

**package.json에 스크립트 추가**:
```json
{
  "scripts": {
    "crawl:all": "ts-node scripts/crawl-all.ts",
    "crawl:kr": "ts-node scripts/crawl-korea.ts",
    "crawl:us": "ts-node scripts/crawl-us.ts"
  }
}
```

**Deliverables**:
- [ ] 한국 연봉 크롤러 구현 완료
- [ ] 미국 연봉 API 호출 구현 완료
- [ ] 일본 연봉 크롤러 구현 완료
- [ ] O*NET 직무 데이터 API 호출 구현 완료
- [ ] 통합 스크립트 작성 완료
- [ ] 로컬에서 크롤링 테스트 성공

---

### Phase 2: 데이터 수집 + 정제 (Week 2)

#### 목표
- 모든 크롤러 실행 및 데이터 수집
- 데이터 정제 및 품질 검증
- AI 서비스 목록 작성 및 매핑

#### Day 8-10: 크롤링 실행 및 데이터 정제

**작업 1: 크롤링 실행**
```bash
# 모든 크롤러 실행
npm run crawl:all
```

**작업 2: 데이터 정제 스크립트**

`scripts/clean-data.ts`
```typescript
import { supabase } from '../lib/supabase/client';

async function cleanData() {
  // 1. 중복 제거
  const { data: duplicates } = await supabase
    .from('occupations')
    .select('name_local, country, COUNT(*)')
    .group(['name_local', 'country'])
    .having('COUNT(*) > 1');

  for (const dup of duplicates) {
    // 최신 데이터만 남기고 삭제
    const { data: toDelete } = await supabase
      .from('occupations')
      .select('id')
      .eq('name_local', dup.name_local)
      .eq('country', dup.country)
      .order('last_updated', { ascending: true })
      .limit(1);

    await supabase.from('occupations').delete().eq('id', toDelete[0].id);
  }

  // 2. 이상치 제거 (연봉 0원 또는 음수)
  await supabase
    .from('occupations')
    .delete()
    .lte('average_salary', 0);

  // 3. 직업명 표준화
  const { data: occupations } = await supabase
    .from('occupations')
    .select('*');

  for (const occ of occupations) {
    const normalized = occ.name_local
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[0-9]/g, '');

    await supabase
      .from('occupations')
      .update({ name_local: normalized })
      .eq('id', occ.id);
  }

  console.log('✅ 데이터 정제 완료');
}

cleanData().catch(console.error);
```

**작업 3: 데이터 품질 검증**

`scripts/validate-data.ts`
```typescript
async function validateData() {
  // 완전성 체크 (NULL 값 비율)
  const { count: totalCount } = await supabase
    .from('occupations')
    .select('*', { count: 'exact', head: true });

  const { count: nullCount } = await supabase
    .from('occupations')
    .select('*', { count: 'exact', head: true })
    .is('average_salary', null);

  const completeness = ((totalCount - nullCount) / totalCount) * 100;
  console.log(`완전성: ${completeness.toFixed(2)}%`);

  // 최신성 체크 (1개월 이내 업데이트)
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const { count: outdatedCount } = await supabase
    .from('occupations')
    .select('*', { count: 'exact', head: true })
    .lt('last_updated', oneMonthAgo.toISOString());

  const freshness = ((totalCount - outdatedCount) / totalCount) * 100;
  console.log(`최신성: ${freshness.toFixed(2)}%`);
}
```

**Deliverables**:
- [ ] 모든 크롤러 실행 완료 (50개 직업 × 3개국)
- [ ] 데이터 정제 스크립트 실행 완료
- [ ] 데이터 품질 검증 완료 (완전성 95% 이상)
- [ ] Supabase Studio에서 데이터 확인 완료

#### Day 11-12: AI 서비스 매핑

**작업 1: AI 서비스 목록 작성 (엑셀)**

`ai-services.csv` (50개 AI 서비스)
```csv
name,description,url,release_year,category
"GitHub Copilot","AI 코드 자동완성","https://github.com/features/copilot",2021,"Coding"
"Cursor AI","AI 페어 프로그래밍","https://cursor.sh",2023,"Coding"
"Midjourney","AI 이미지 생성","https://midjourney.com",2022,"Design"
"ChatGPT","AI 텍스트 생성","https://openai.com/chatgpt",2022,"Writing"
...
```

**작업 2: CSV → JSON 변환**

`scripts/import-ai-services.ts`
```typescript
import fs from 'fs';
import csv from 'csv-parser';
import { supabase } from '../lib/supabase/client';

async function importAIServices() {
  const services = [];

  fs.createReadStream('ai-services.csv')
    .pipe(csv())
    .on('data', (row) => services.push(row))
    .on('end', async () => {
      // DB에 삽입
      for (const service of services) {
        await supabase.from('ai_services').insert({
          name: service.name,
          description: service.description,
          url: service.url,
          release_year: parseInt(service.release_year),
          category: service.category
        });
      }

      console.log(`✅ AI 서비스 ${services.length}개 임포트 완료`);
    });
}

importAIServices();
```

**작업 3: Task-AI 서비스 매핑 (수동)**

`task-ai-mapping.csv`
```csv
task_name,ai_service_name,relevance_score
"코드 작성","GitHub Copilot",0.95
"코드 작성","Cursor AI",0.90
"디버깅","Sentry AI",0.80
"디자인","Midjourney",0.90
...
```

**매핑 스크립트**:
```typescript
async function mapTasksToAIServices() {
  const mappings = []; // CSV 파싱 결과

  for (const mapping of mappings) {
    // Task ID 찾기
    const { data: task } = await supabase
      .from('tasks')
      .select('id')
      .eq('name', mapping.task_name)
      .single();

    // AI Service ID 찾기
    const { data: aiService } = await supabase
      .from('ai_services')
      .select('id')
      .eq('name', mapping.ai_service_name)
      .single();

    // 관계 저장
    await supabase.from('task_ai_services').insert({
      task_id: task.id,
      ai_service_id: aiService.id,
      relevance_score: mapping.relevance_score
    });
  }

  console.log('✅ Task-AI 매핑 완료');
}
```

**Deliverables**:
- [ ] AI 서비스 50개 목록 작성 완료
- [ ] CSV → DB 임포트 완료
- [ ] Task-AI 서비스 매핑 완료 (각 직무당 평균 3개)
- [ ] Supabase Studio에서 관계 확인 완료

#### Day 13-14: 크롤링 스케줄러 설정

**작업 1: Vercel Cron Jobs 설정**

`vercel.json`
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

**작업 2: Cron API Route 구현**

`app/api/cron/crawl-salaries/route.ts`
```typescript
export async function GET(request: Request) {
  // 인증 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await crawlKoreaSalary();
    await fetchUSSalary();
    await crawlJapanSalary();

    return Response.json({
      success: true,
      message: 'Crawling completed'
    });
  } catch (error) {
    console.error('Crawling failed:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**Deliverables**:
- [ ] Vercel Cron Jobs 설정 완료
- [ ] Cron API Route 구현 완료
- [ ] 로컬에서 API 테스트 완료
- [ ] Slack 알림 설정 (optional)

---

### Phase 3: 프론트엔드 UI 구현 (Week 3)

#### 목표
- shadcn/ui 기반 공통 컴포넌트 구현
- 4개 페이지 UI 구현 (Landing, Input, Result, Detail)
- 반응형 디자인 적용

#### Day 15-16: 공통 컴포넌트

**작업 1: shadcn/ui 컴포넌트 추가**
```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add card
npx shadcn@latest add progress
npx shadcn@latest add badge
npx shadcn@latest add toast
```

**작업 2: Layout 컴포넌트**

`app/layout.tsx`
```typescript
export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="font-pretendard">
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

**작업 3: RiskScoreCard 컴포넌트**

`components/RiskScoreCard.tsx`
```typescript
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface RiskScoreCardProps {
  score: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
}

export function RiskScoreCard({ score, level }: RiskScoreCardProps) {
  const colorMap = {
    Low: 'bg-green-500',
    Medium: 'bg-yellow-500',
    High: 'bg-red-500',
    Critical: 'bg-red-900'
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">위험도</h2>
        <Badge variant={level.toLowerCase()}>{level} Risk</Badge>
      </div>

      <div className="text-5xl font-bold mb-2">{score.toFixed(1)}%</div>

      <Progress value={score} className={colorMap[level]} />
    </div>
  );
}
```

**Deliverables**:
- [ ] shadcn/ui 컴포넌트 추가 완료
- [ ] Layout 컴포넌트 구현 완료
- [ ] RiskScoreCard 컴포넌트 구현 완료
- [ ] 기타 재사용 컴포넌트 구현 완료

#### Day 17-18: Landing Page

**작업: Landing Page 구현**

`app/(marketing)/page.tsx`
```typescript
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const router = useRouter();

  const selectCountry = (country: string) => {
    sessionStorage.setItem('selectedCountry', country);
    router.push('/input');
  };

  return (
    <div className="max-w-4xl mx-auto text-center">
      <h1 className="text-5xl font-bold mb-4">
        AI 시대, 당신의 직업은 안전한가요?
      </h1>

      <p className="text-xl text-gray-600 mb-12">
        3개국, 50개 직업 데이터 기반 AI 위험도 평가
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Button
          size="lg"
          onClick={() => selectCountry('KR')}
          className="h-32 text-2xl"
        >
          🇰🇷<br />한국
        </Button>

        <Button
          size="lg"
          onClick={() => selectCountry('US')}
          className="h-32 text-2xl"
        >
          🇺🇸<br />미국
        </Button>

        <Button
          size="lg"
          onClick={() => selectCountry('JP')}
          className="h-32 text-2xl"
        >
          🇯🇵<br />일본
        </Button>
      </div>
    </div>
  );
}
```

**Deliverables**:
- [ ] Landing Page UI 구현 완료
- [ ] 국가 선택 기능 구현 완료
- [ ] 반응형 레이아웃 적용 완료

#### Day 19-20: Input Page

**작업: Input Page 구현**

`app/input/page.tsx`
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function InputPage() {
  const [country, setCountry] = useState('');
  const [query, setQuery] = useState('');
  const [occupations, setOccupations] = useState([]);
  const [selectedOccupation, setSelectedOccupation] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const savedCountry = sessionStorage.getItem('selectedCountry');
    if (!savedCountry) {
      router.push('/');
    } else {
      setCountry(savedCountry);
    }
  }, []);

  const handleSearch = async (q: string) => {
    setQuery(q);

    if (q.length < 2) {
      setOccupations([]);
      return;
    }

    const res = await fetch(`/api/occupations/search?q=${q}&country=${country}`);
    const data = await res.json();
    setOccupations(data.occupations);
  };

  const handleSubmit = () => {
    if (selectedOccupation) {
      router.push(`/result/${selectedOccupation.id}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" onClick={() => router.back()}>
        ← 뒤로
      </Button>

      <h1 className="text-3xl font-bold mb-8 mt-4">
        직업을 입력하세요
      </h1>

      <Input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="예: 소프트웨어 개발자"
        className="mb-4"
      />

      {occupations.length > 0 && (
        <ul className="border rounded-lg">
          {occupations.map((occ) => (
            <li
              key={occ.id}
              onClick={() => setSelectedOccupation(occ)}
              className="px-4 py-3 hover:bg-gray-100 cursor-pointer"
            >
              {occ.name_local}
            </li>
          ))}
        </ul>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!selectedOccupation}
        className="w-full mt-8"
        size="lg"
      >
        분석 시작하기
      </Button>
    </div>
  );
}
```

**Deliverables**:
- [ ] Input Page UI 구현 완료
- [ ] 직업 검색 자동완성 구현 완료
- [ ] 유효성 검사 구현 완료

#### Day 21: Result Page

**작업: Result Page 구현**

`app/result/[occupationId]/page.tsx`
```typescript
import { RiskScoreCard } from '@/components/RiskScoreCard';
import { TaskList } from '@/components/TaskList';

export default async function ResultPage({ params }) {
  const { occupationId } = params;

  const res = await fetch(`/api/occupations/${occupationId}/risk-score`);
  const data = await res.json();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">
        {data.occupation.name_local}
      </h1>

      <RiskScoreCard
        score={data.risk_score}
        level={data.risk_level}
      />

      <div className="grid grid-cols-3 gap-4 my-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">평균 연봉</div>
          <div className="text-2xl font-bold">
            {data.occupation.currency} {data.occupation.average_salary.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">분석 직무</div>
          <div className="text-2xl font-bold">
            {data.summary.total_tasks}개
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">매핑된 AI</div>
          <div className="text-2xl font-bold">
            {data.summary.total_ai_services}개
          </div>
        </div>
      </div>

      <TaskList tasks={data.tasks} />
    </div>
  );
}
```

**Deliverables**:
- [ ] Result Page UI 구현 완료
- [ ] 위험도 점수 시각화 완료
- [ ] 핵심 지표 표시 완료
- [ ] 직무 목록 표시 완료

---

### Phase 4: 로직 구현 + 테스트 (Week 4)

#### 목표
- API 엔드포인트 구현
- 위험도 계산 로직 구현 및 테스트
- E2E 테스트 작성

#### Day 22-23: API 구현

**작업 1: GET /api/countries**

`app/api/countries/route.ts`
```typescript
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .order('code');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ countries: data });
}
```

**작업 2: GET /api/occupations/search**

`app/api/occupations/search/route.ts`
```typescript
import { supabase } from '@/lib/supabase/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const country = searchParams.get('country');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!query || query.length < 2) {
    return Response.json(
      { error: '검색어는 최소 2글자 이상이어야 합니다' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('occupations')
    .select('id, name_local, name_en, average_salary, currency')
    .eq('country', country)
    .ilike('name_local', `%${query}%`)
    .limit(limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (data.length === 0) {
    return Response.json(
      { error: '검색 결과가 없습니다' },
      { status: 404 }
    );
  }

  return Response.json({ occupations: data });
}
```

**작업 3: GET /api/occupations/[id]/risk-score**

`app/api/occupations/[id]/risk-score/route.ts`
```typescript
import { supabase } from '@/lib/supabase/client';
import { calculateRiskScore } from '@/lib/risk-calculator';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // 1. 직업 정보 조회
  const { data: occupation, error: occError } = await supabase
    .from('occupations')
    .select('*')
    .eq('id', id)
    .single();

  if (occError || !occupation) {
    return Response.json(
      { error: '직업을 찾을 수 없습니다' },
      { status: 404 }
    );
  }

  // 2. 직무 목록 조회
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      id,
      name,
      time_percentage,
      ai_replacement_rate,
      task_ai_services (
        ai_services (
          id, name, description, url, release_year, category
        )
      )
    `)
    .eq('occupation_id', id);

  if (tasksError) {
    return Response.json({ error: tasksError.message }, { status: 500 });
  }

  // 3. 위험도 계산
  const { riskScore, riskLevel } = calculateRiskScore(tasks);

  // 4. 응답 데이터 구성
  return Response.json({
    occupation,
    risk_score: riskScore,
    risk_level: riskLevel,
    tasks: tasks.map(task => ({
      ...task,
      task_risk_score: (task.ai_replacement_rate * task.time_percentage) / 100,
      ai_services: task.task_ai_services.map(tas => tas.ai_services)
    })),
    summary: {
      total_tasks: tasks.length,
      total_ai_services: tasks.reduce((sum, t) => sum + t.task_ai_services.length, 0),
      highest_risk_task: tasks.reduce((max, t) =>
        t.ai_replacement_rate > max.ai_replacement_rate ? t : max
      )
    }
  });
}
```

**Deliverables**:
- [ ] 3개 API 엔드포인트 구현 완료
- [ ] 에러 핸들링 구현 완료
- [ ] Postman/Insomnia로 API 테스트 완료

#### Day 24-25: 위험도 계산 로직

**작업 1: 위험도 계산 함수**

`lib/risk-calculator.ts`
```typescript
export interface Task {
  time_percentage: number;
  ai_replacement_rate: number;
}

export function calculateRiskScore(tasks: Task[]) {
  // Σ(AI 대체율 × 업무 비중) / 100
  const riskScore = tasks.reduce((sum, task) => {
    return sum + (task.ai_replacement_rate * task.time_percentage) / 100;
  }, 0);

  // Risk Level 판정
  const riskLevel =
    riskScore >= 76 ? 'Critical' :
    riskScore >= 51 ? 'High' :
    riskScore >= 26 ? 'Medium' : 'Low';

  return { riskScore, riskLevel };
}
```

**작업 2: 단위 테스트**

`lib/risk-calculator.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from './risk-calculator';

describe('calculateRiskScore', () => {
  it('should calculate correct risk score', () => {
    const tasks = [
      { time_percentage: 35, ai_replacement_rate: 60 }, // 21.0
      { time_percentage: 20, ai_replacement_rate: 40 }  // 8.0
    ];

    const { riskScore, riskLevel } = calculateRiskScore(tasks);

    expect(riskScore).toBe(29.0);
    expect(riskLevel).toBe('Medium');
  });

  it('should return Low for low risk', () => {
    const tasks = [
      { time_percentage: 50, ai_replacement_rate: 20 }
    ];

    const { riskLevel } = calculateRiskScore(tasks);

    expect(riskLevel).toBe('Low');
  });

  it('should return Critical for very high risk', () => {
    const tasks = [
      { time_percentage: 80, ai_replacement_rate: 95 }
    ];

    const { riskLevel } = calculateRiskScore(tasks);

    expect(riskLevel).toBe('Critical');
  });
});
```

**테스트 실행**:
```bash
npm run test
```

**Deliverables**:
- [ ] 위험도 계산 함수 구현 완료
- [ ] 단위 테스트 작성 완료
- [ ] 모든 테스트 통과 확인

#### Day 26-27: 통합 테스트

**작업: E2E 테스트 (Playwright)**

`tests/e2e/user-flow.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test('complete user flow', async ({ page }) => {
  // 1. Landing Page
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('AI 시대');

  // 2. 국가 선택 (한국)
  await page.click('button:has-text("한국")');
  await expect(page).toHaveURL('/input');

  // 3. 직업 검색
  await page.fill('input[placeholder*="직업"]', '소프트웨어');
  await page.waitForSelector('ul li:has-text("소프트웨어 개발자")');
  await page.click('li:has-text("소프트웨어 개발자")');

  // 4. 분석 시작
  await page.click('button:has-text("분석 시작")');
  await page.waitForURL('/result/*');

  // 5. 결과 확인
  await expect(page.locator('h1')).toContainText('소프트웨어 개발자');
  await expect(page.locator('text=위험도')).toBeVisible();
  await expect(page.locator('text=평균 연봉')).toBeVisible();
});
```

**Deliverables**:
- [ ] E2E 테스트 작성 완료
- [ ] 모든 테스트 통과 확인

#### Day 28: 배포 준비

**작업 1: 환경 변수 Vercel에 설정**
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add CRON_SECRET
```

**작업 2: Lighthouse 점수 확인**
```bash
npm run build
npx lighthouse http://localhost:3000 --view
```

**목표 점수**:
- Performance > 90
- Accessibility > 90
- Best Practices > 90
- SEO > 90

**Deliverables**:
- [ ] 환경 변수 설정 완료
- [ ] Lighthouse 점수 확인 완료
- [ ] 프로덕션 빌드 테스트 완료

---

### Phase 5: 폴리싱 + 배포 (Week 5+)

#### 목표
- UI/UX 개선
- 성능 최적화
- 프로덕션 배포

#### Week 5: 디자인 폴리싱

**작업 목록**:
- [ ] 색상 시스템 일관성 확인
- [ ] 타이포그래피 조정
- [ ] 애니메이션 추가 (Framer Motion)
- [ ] 로딩 상태 개선
- [ ] 에러 메시지 개선

#### Week 6: 최적화

**작업 목록**:
- [ ] 이미지 최적화 (next/image)
- [ ] 코드 스플리팅 확인
- [ ] 캐싱 전략 적용 (ISR)
- [ ] SEO 메타 태그 추가
- [ ] OG Image 생성

#### Week 7: 배포

**작업 목록**:
- [ ] Vercel에 배포
- [ ] 도메인 연결 (optional)
- [ ] Sentry 에러 트래킹 설정
- [ ] Google Analytics 설정 (optional)
- [ ] 유저 피드백 수집

---

## 3. 기술 의사결정

### 3.1 Next.js vs Create React App

**결정**: Next.js 15 (App Router)

**이유**:
- SSR/SSG로 SEO 최적화 (공개 서비스에 중요)
- API Routes로 백엔드 불필요
- Vercel 배포 간편
- 성능 최적화 기본 제공

### 3.2 Supabase vs Firebase vs PostgreSQL

**결정**: Supabase

**이유**:
- PostgreSQL 기반 (관계형 DB 필요)
- 무료 플랜 충분 (500MB, 2GB 전송)
- RLS (Row Level Security) 지원
- Real-time 구독 (향후 확장 가능)

### 3.3 Playwright vs Cheerio

**결정**: Playwright

**이유**:
- 동적 웹사이트 크롤링 가능 (사람인, 잡코리아)
- 헤드리스 브라우저로 실제 사용자처럼 동작
- MCP 서버로 이미 설정됨

### 3.4 Tailwind CSS vs Styled Components

**결정**: Tailwind CSS + shadcn/ui

**이유**:
- 빠른 프로토타이핑
- 일관된 디자인 시스템
- shadcn/ui로 고품질 컴포넌트 제공
- Zero runtime CSS

---

## 4. 리스크 관리 계획

### 4.1 기술적 리스크

| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|----------|
| 크롤링 차단 | 중 | 높음 | Rate limiting, Proxy, API 우선 |
| 데이터 품질 낮음 | 중 | 중 | 수동 검증, 다중 출처 |
| 성능 문제 | 낮음 | 중 | DB 인덱싱, 캐싱 |
| 서버리스 제약 | 낮음 | 낮음 | Vercel Pro 전환 |

### 4.2 일정 리스크

| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|----------|
| 개발 지연 | 높음 | 중 | MVP 범위 축소 |
| 예상치 못한 버그 | 중 | 중 | 주간 버퍼 1일 |
| 데이터 수집 지연 | 중 | 높음 | 정적 데이터셋 대안 |

### 4.3 비즈니스 리스크

| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|----------|
| 사용자 유입 부족 | 높음 | 중 | SEO 최적화, SNS 홍보 |
| 저작권 문제 | 낮음 | 높음 | 출처 명시, 면책 조항 |
| 서버 비용 초과 | 낮음 | 낮음 | 무료 플랜 최대 활용 |

---

## 5. 품질 보증 계획

### 5.1 테스트 전략

| 테스트 유형 | 도구 | 커버리지 목표 | 실행 시점 |
|-----------|------|-------------|----------|
| 단위 테스트 | Vitest | 80% (핵심 로직) | 개발 중 |
| 통합 테스트 | Vitest | 50% (API) | Phase 4 |
| E2E 테스트 | Playwright | 주요 플로우 | Phase 4 |
| 성능 테스트 | Lighthouse | > 90점 | Phase 5 |

### 5.2 코드 품질

- **ESLint**: 모든 파일에 적용
- **Prettier**: 코드 포맷팅
- **TypeScript**: Strict 모드
- **Husky**: Pre-commit hook (lint + typecheck)

### 5.3 모니터링

- **Vercel Analytics**: 페이지 뷰, 성능
- **Supabase Logs**: DB 쿼리 성능
- **Sentry** (optional): 에러 트래킹

---

**문서 버전**: 1.0
**최종 수정일**: 2026-02-07
**작성자**: User + SEMO AI Assistant
