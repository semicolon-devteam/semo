# AIR (AI Readability) Convention

**Version:** 1.0.0  
**Last Updated:** 2026-03-15  
**Target:** SEMO Dashboard (Next.js 14 + TypeScript)

---

## 목적

AI 에이전트(WorkClaw, Claude, Cursor 등)가 SEMO 코드베이스를 읽고 수정할 때:
- **빠르게 컨텍스트를 파악**할 수 있도록
- **의도를 명확히 전달**하여 오류를 줄이고
- **일관된 패턴**으로 예측 가능한 코드 구조 유지

---

## 핵심 원칙

### 1. **명시적 타입 정의 (Explicit Types)**

❌ **Bad:**
```typescript
export function fetchBotStatus(id) {
  return db.query('SELECT * FROM bots WHERE id = ?', [id]);
}
```

✅ **Good:**
```typescript
/**
 * 봇 상태 조회
 * @param id - 봇 ID (UUID)
 * @returns 봇 상태 객체 (status, lastSeen, tokenUsage 포함)
 */
export async function fetchBotStatus(id: string): Promise<BotStatus> {
  const result = await db.query<BotStatus>(
    'SELECT * FROM bots WHERE id = ?',
    [id]
  );
  return result;
}

interface BotStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
  tokenUsage: number;
}
```

**Why:** AI는 타입 힌트로 데이터 구조를 즉시 이해. 암묵적 타입은 추론 비용 증가.

---

### 2. **파일 헤더 주석 (File Header Comment)**

모든 `.ts`, `.tsx` 파일 상단에 파일 역할 명시:

```typescript
/**
 * @file lib/supabase/client.ts
 * @description Supabase 클라이언트 초기화 및 DB 헬퍼 함수
 * @dependencies supabase-js, process.env (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * @usage import { supabase } from '@/lib/supabase/client'
 */

import { createClient } from '@supabase/supabase-js';
// ...
```

**필수 필드:**
- `@file` - 파일 경로
- `@description` - 파일의 책임과 역할
- `@dependencies` - 주요 의존성 (외부 라이브러리, 환경변수)
- `@usage` - 사용 예시 (import 경로)

---

### 3. **컴포넌트 Props 스키마 (Component Props Schema)**

React 컴포넌트는 Props를 명시적 인터페이스로 정의:

❌ **Bad:**
```tsx
export default function BotCard({ bot, onClick }) {
  return <div onClick={() => onClick(bot.id)}>{bot.name}</div>;
}
```

✅ **Good:**
```tsx
/**
 * @component BotCard
 * @description 봇 상태 카드 UI (대시보드 메인)
 * @example
 * <BotCard
 *   bot={{ id: 'abc', name: 'WorkClaw', status: 'online' }}
 *   onClick={(id) => console.log(id)}
 * />
 */

interface BotCardProps {
  /** 봇 정보 객체 */
  bot: {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'error';
    lastSeen: Date;
  };
  /** 클릭 시 호출될 콜백 (봇 ID 전달) */
  onClick: (botId: string) => void;
}

export default function BotCard({ bot, onClick }: BotCardProps) {
  return (
    <div onClick={() => onClick(bot.id)} className="bot-card">
      <h3>{bot.name}</h3>
      <span className={`status-${bot.status}`}>{bot.status}</span>
    </div>
  );
}
```

**Why:** AI가 컴포넌트 사용법을 즉시 파악. Props 오류 사전 방지.

---

### 4. **함수 의도 주석 (Function Intent Comment)**

함수 상단에 JSDoc으로 **무엇을**, **왜** 하는지 명시:

❌ **Bad:**
```typescript
function process(data: any[]) {
  return data.filter(d => d.active).map(d => d.id);
}
```

✅ **Good:**
```typescript
/**
 * 활성 봇 ID 목록 추출
 * 
 * @description 전체 봇 목록에서 status='online'인 봇만 필터링하여 ID 배열 반환.
 * 대시보드 실시간 업데이트에 사용.
 * 
 * @param bots - 전체 봇 목록 (Supabase bots 테이블)
 * @returns 활성 봇 ID 배열 (예: ['bot-1', 'bot-2'])
 * 
 * @example
 * const activeBots = getActiveBotIds(allBots);
 * // activeBots = ['abc123', 'def456']
 */
function getActiveBotIds(bots: Bot[]): string[] {
  return bots
    .filter(bot => bot.status === 'online')
    .map(bot => bot.id);
}
```

**Why:** AI가 함수 목적을 추론하지 않아도 됨. 수정 시 의도 파악 시간 단축.

---

### 5. **디렉토리 구조 문서화 (Directory Manifest)**

각 주요 디렉토리에 `_README.md` 또는 `index.ts` 주석으로 구조 설명:

**예시: `app/_README.md`**
```markdown
# app/ - Next.js 14 App Router

## 구조
- `layout.tsx` - 루트 레이아웃 (전역 네비게이션, 메타 태그)
- `page.tsx` - 홈 페이지 (대시보드 메인)
- `dashboard/` - 봇 모니터링 대시보드
  - `[botId]/` - 개별 봇 상세 페이지
- `api/` - API Routes (백엔드 프록시, Webhook)
  - `bots/` - 봇 CRUD
  - `metrics/` - 메트릭 수집

## 라우팅 규칙
- `/` → 대시보드 메인
- `/dashboard/[botId]` → 봇 상세
- `/api/bots` → 봇 목록 API
```

**예시: `lib/index.ts`**
```typescript
/**
 * @file lib/index.ts
 * @description 유틸리티 라이브러리 진입점
 * 
 * ## 모듈 구조
 * - `supabase/` - Supabase 클라이언트, DB 헬퍼
 * - `utils/` - 공통 유틸 (날짜 포맷, 토큰 계산)
 * - `hooks/` - React 커스텀 훅 (useBotStatus, useMetrics)
 * - `types/` - 전역 타입 정의 (Bot, Metric, Session)
 */

export * from './supabase';
export * from './utils';
export * from './hooks';
```

**Why:** AI가 파일 위치를 빠르게 탐색. "어디에 있는지" 질문 감소.

---

### 6. **상태 관리 스키마 (State Schema Documentation)**

전역 상태/컨텍스트는 스키마를 명시:

```typescript
/**
 * @context BotContext
 * @description 봇 목록 및 실시간 상태 관리
 * 
 * ## State Schema
 * - `bots`: Bot[] - 전체 봇 목록
 * - `activeBotId`: string | null - 현재 선택된 봇 ID
 * - `loading`: boolean - 로딩 상태
 * - `error`: Error | null - 에러 상태
 * 
 * ## Actions
 * - `fetchBots()` - Supabase에서 봇 목록 fetch
 * - `selectBot(id)` - 봇 선택 (activeBotId 업데이트)
 * - `updateBotStatus(id, status)` - 실시간 상태 업데이트
 */

interface BotContextState {
  bots: Bot[];
  activeBotId: string | null;
  loading: boolean;
  error: Error | null;
}

interface BotContextActions {
  fetchBots: () => Promise<void>;
  selectBot: (id: string) => void;
  updateBotStatus: (id: string, status: BotStatus['status']) => void;
}

export const BotContext = createContext<BotContextState & BotContextActions>(/* ... */);
```

**Why:** AI가 상태 흐름을 즉시 파악. 디버깅 시간 단축.

---

### 7. **에러 처리 주석 (Error Handling Comment)**

try-catch 블록에 **어떤 에러를 예상하는지** 명시:

❌ **Bad:**
```typescript
try {
  const data = await fetch('/api/bots');
  return data.json();
} catch (e) {
  console.error(e);
}
```

✅ **Good:**
```typescript
try {
  const data = await fetch('/api/bots');
  return data.json();
} catch (error) {
  /**
   * 예상 에러:
   * - NetworkError: API 서버 다운
   * - 401 Unauthorized: Supabase 인증 만료
   * - 500 Internal: DB 연결 실패
   * 
   * 처리 방식: 에러 토스트 표시 + Sentry 전송
   */
  console.error('Failed to fetch bots:', error);
  toast.error('봇 목록을 불러올 수 없습니다.');
  Sentry.captureException(error);
  throw error;
}
```

**Why:** AI가 에러 컨텍스트를 이해하고 적절한 핸들링 제안 가능.

---

### 8. **API 엔드포인트 문서화 (API Endpoint Docs)**

API Route는 OpenAPI 스타일 주석:

```typescript
/**
 * @api {GET} /api/bots 봇 목록 조회
 * @apiName GetBots
 * @apiGroup Bot
 * 
 * @apiQuery {string} [status] - 필터: 'online' | 'offline' | 'error'
 * @apiQuery {number} [limit=50] - 결과 개수 제한
 * 
 * @apiSuccess {Bot[]} bots - 봇 목록
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *   "bots": [
 *     { "id": "abc", "name": "WorkClaw", "status": "online" }
 *   ]
 * }
 * 
 * @apiError {string} error - 에러 메시지
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 401 Unauthorized
 * { "error": "Invalid API key" }
 */

export async function GET(request: Request) {
  // ...
}
```

**Why:** AI가 API 스펙을 즉시 파악. 클라이언트 코드 자동 생성 가능.

---

## 네이밍 규칙

### 파일명
- **컴포넌트:** `PascalCase` (예: `BotCard.tsx`, `MetricChart.tsx`)
- **유틸리티:** `camelCase` (예: `formatDate.ts`, `calculateTokens.ts`)
- **타입 정의:** `PascalCase.types.ts` (예: `Bot.types.ts`, `Metric.types.ts`)
- **훅:** `use[Name].ts` (예: `useBotStatus.ts`, `useMetrics.ts`)
- **API Route:** `route.ts` (Next.js 14 App Router 컨벤션)

### 변수/함수명
- **함수:** `동사 + 명사` (예: `fetchBotStatus`, `updateMetric`, `formatTimestamp`)
- **Boolean:** `is/has/should + 형용사` (예: `isOnline`, `hasError`, `shouldRefetch`)
- **상수:** `UPPER_SNAKE_CASE` (예: `API_BASE_URL`, `MAX_RETRY_COUNT`)

### 타입/인터페이스명
- **인터페이스:** `명사 + Props/State/Config` (예: `BotCardProps`, `DashboardState`, `SupabaseConfig`)
- **타입 별칭:** `명사` (예: `BotStatus`, `MetricType`)

---

## 디렉토리 구조 규칙

```
packages/semo-dashboard/
├── app/                    # Next.js 14 App Router
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 홈 (/dashboard)
│   ├── dashboard/
│   │   └── [botId]/
│   │       └── page.tsx    # 봇 상세
│   └── api/
│       └── bots/
│           └── route.ts    # GET /api/bots
├── components/             # React 컴포넌트
│   ├── BotCard.tsx
│   └── MetricChart.tsx
├── lib/                    # 유틸리티/헬퍼
│   ├── supabase/
│   │   └── client.ts       # Supabase 클라이언트
│   ├── utils/
│   │   └── formatDate.ts
│   └── hooks/
│       └── useBotStatus.ts
├── types/                  # 전역 타입
│   ├── Bot.types.ts
│   └── Metric.types.ts
└── public/                 # 정적 파일
```

**규칙:**
- **1 파일 = 1 책임**: 컴포넌트, 유틸, 타입을 한 파일에 섞지 않음
- **index.ts 금지**: AI가 파일명으로 역할을 즉시 파악할 수 있도록 명시적 파일명 사용
- **_README.md**: 각 주요 디렉토리에 구조 설명 문서 추가

---

## 코드 예시

### Server Component (RSC)

```typescript
/**
 * @file app/dashboard/page.tsx
 * @description 대시보드 메인 페이지 (Server Component)
 * @dependencies Supabase (봇 목록 fetch), BotCard 컴포넌트
 * @route /dashboard
 */

import { supabase } from '@/lib/supabase/client';
import BotCard from '@/components/BotCard';
import type { Bot } from '@/types/Bot.types';

/**
 * 대시보드 페이지
 * 
 * @description 모든 봇의 현재 상태를 카드 형태로 표시.
 * Server Component로 구현하여 초기 로드 시 SSR.
 * 
 * @returns 봇 카드 리스트 UI
 */
export default async function DashboardPage() {
  // 서버에서 봇 목록 fetch (SSR)
  const { data: bots, error } = await supabase
    .from<Bot>('bots')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    /**
     * 에러 처리: Supabase 연결 실패 시
     * - 에러 메시지 표시
     * - Sentry로 에러 전송 (프로덕션)
     */
    console.error('Failed to fetch bots:', error);
    return <div>봇 목록을 불러올 수 없습니다.</div>;
  }

  return (
    <div className="dashboard-grid">
      {bots?.map((bot) => (
        <BotCard
          key={bot.id}
          bot={bot}
          onClick={(id) => console.log('Bot clicked:', id)}
        />
      ))}
    </div>
  );
}
```

### Client Component with State

```typescript
/**
 * @file components/MetricChart.tsx
 * @description 봇 메트릭 차트 (Client Component)
 * @dependencies recharts, useBotMetrics 훅
 * @usage <MetricChart botId="abc123" />
 */

'use client';

import { LineChart, Line, XAxis, YAxis } from 'recharts';
import { useBotMetrics } from '@/lib/hooks/useBotMetrics';

interface MetricChartProps {
  /** 봇 ID (메트릭 조회 키) */
  botId: string;
}

/**
 * 봇 메트릭 차트 컴포넌트
 * 
 * @description 봇의 토큰 사용량을 시간별 그래프로 표시.
 * 실시간 업데이트 (5초 폴링).
 * 
 * @param props.botId - 봇 ID
 * @returns Recharts LineChart
 */
export default function MetricChart({ botId }: MetricChartProps) {
  // 커스텀 훅으로 메트릭 fetch (5초 폴링)
  const { metrics, loading, error } = useBotMetrics(botId, {
    interval: 5000,
  });

  if (loading) return <div>로딩 중...</div>;
  if (error) {
    /**
     * 에러 처리: 메트릭 조회 실패
     * - 네트워크 에러
     * - 봇 ID 없음
     */
    return <div>메트릭을 불러올 수 없습니다.</div>;
  }

  return (
    <LineChart width={600} height={300} data={metrics}>
      <XAxis dataKey="timestamp" />
      <YAxis />
      <Line type="monotone" dataKey="tokenUsage" stroke="#8884d8" />
    </LineChart>
  );
}
```

### Custom Hook

```typescript
/**
 * @file lib/hooks/useBotMetrics.ts
 * @description 봇 메트릭 조회 훅 (실시간 폴링)
 * @dependencies Supabase, React hooks
 * @usage const { metrics, loading } = useBotMetrics(botId);
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Metric } from '@/types/Metric.types';

interface UseBotMetricsOptions {
  /** 폴링 간격 (ms, 기본 10000) */
  interval?: number;
}

interface UseBotMetricsReturn {
  /** 메트릭 데이터 배열 */
  metrics: Metric[];
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 객체 */
  error: Error | null;
}

/**
 * 봇 메트릭 실시간 조회
 * 
 * @description Supabase에서 봇 메트릭을 주기적으로 fetch.
 * interval 옵션으로 폴링 간격 조정 가능.
 * 
 * @param botId - 봇 ID
 * @param options - 폴링 옵션
 * @returns 메트릭, 로딩, 에러 상태
 * 
 * @example
 * const { metrics } = useBotMetrics('abc123', { interval: 5000 });
 */
export function useBotMetrics(
  botId: string,
  options: UseBotMetricsOptions = {}
): UseBotMetricsReturn {
  const { interval = 10000 } = options;
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const { data, error: fetchError } = await supabase
          .from<Metric>('metrics')
          .select('*')
          .eq('bot_id', botId)
          .order('timestamp', { ascending: false })
          .limit(100);

        if (fetchError) throw fetchError;
        setMetrics(data || []);
        setError(null);
      } catch (err) {
        /**
         * 예상 에러:
         * - NetworkError: Supabase 연결 실패
         * - 404: 봇 ID 없음
         */
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    // 초기 fetch
    fetchMetrics();

    // 폴링 설정
    const intervalId = setInterval(fetchMetrics, interval);

    // 클린업
    return () => clearInterval(intervalId);
  }, [botId, interval]);

  return { metrics, loading, error };
}
```

---

## 체크리스트

코드 작성/리뷰 시 확인:

- [ ] 파일 헤더 주석 (`@file`, `@description`, `@dependencies`)
- [ ] 함수/컴포넌트 JSDoc 주석 (`@param`, `@returns`, `@example`)
- [ ] Props/State 인터페이스 명시적 정의
- [ ] 타입 명시 (`any` 금지)
- [ ] 에러 처리 주석 (예상 에러 케이스)
- [ ] 네이밍 규칙 준수 (동사+명사, PascalCase, camelCase)
- [ ] 디렉토리 `_README.md` 업데이트 (새 모듈 추가 시)

---

## AI 에이전트 프롬프트 템플릿

WorkClaw, Claude 등에게 작업 지시 시 사용:

```
작업: [기능명] 구현

컨텍스트:
- 파일 경로: packages/semo-dashboard/[path]
- 의존성: [라이브러리 목록]
- 관련 타입: [타입 파일 경로]

요구사항:
1. AIR 컨벤션 준수 (파일 헤더, JSDoc, 타입 명시)
2. [구체적 요구사항]
3. 에러 처리 포함 (네트워크 에러, 인증 실패)

제약 조건:
- Server Component 사용 (클라이언트 상태 불필요 시)
- Supabase RLS 정책 준수
- 기존 BotCard 컴포넌트 재사용

체크리스트:
- [ ] 파일 헤더 주석
- [ ] Props 인터페이스
- [ ] 함수 JSDoc
- [ ] 에러 처리
- [ ] 예시 코드
```

---

## 버전 히스토리

- **v1.0.0 (2026-03-15)**: 초안 작성 (WorkClaw 제안)

---

## 참고 자료

- [Next.js 14 Docs](https://nextjs.org/docs)
- [TypeScript JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
