# SEMO Dashboard - Feature 스펙 (Phase 1 MVP)

> **프로젝트:** SEMO Dashboard  
> **Phase:** Phase 1 (MVP)  
> **작성일:** 2026-03-07  
> **작성자:** PlanClaw  
> **디자인 프리뷰:** https://semicolon-devteam.github.io/semo/ui-designs/semo-dashboard/

---

## 1. Phase 1 개요

### 목표
AI 봇 팀의 기본 모니터링 + Knowledge Base 조회 기능 구현

### 구현 범위
1. **Bot Team Overview** - 봇별 상태 카드 + 기본 상세 정보
2. **Knowledge Base** - 시맨틱 검색 + 테이블 조회 (읽기 전용)

### 제외 사항 (Phase 2+)
- SEMO Core (에이전트/스킬 카탈로그)
- KB CRUD 기능
- Ontology & Vector DB

---

## 2. 기술 스택

### 프론트엔드
- **프레임워크:** Next.js 14+ (App Router)
- **스타일링:** TailwindCSS
- **상태 관리:** React Server Components + Client Components (필요 시)
- **데이터 페칭:** Server Actions / API Routes

### 백엔드
- **API:** Next.js API Routes
- **데이터 소스:**
  - PostgreSQL (appdb semo 스키마) - KB/벡터DB
  - GitHub API - 봇 워크스페이스 파일
  - OpenClaw Gateway API - 봇 세션/크론 상태

### 배포
- **인프라:** Semicolon OCI (InfraClaw 문의)
- **모노레포 위치:** `packages/semo-dashboard`

---

## 3. 데이터 소스 상세

### 3.1. 봇 워크스페이스 파일 (GitHub API 접근)

**사용 이유:**
- OCI 인프라 배포 시 원격 접근 가능
- 항상 최신 상태 보장
- 버전 관리/히스토리 추적 가능

**접근 방법:**
- **GitHub API v3/v4** 사용
- **레포:** `semicolon-devteam/semo`
- **경로:** `semo-system/bot-workspaces/{봇이름}/`
- **읽을 파일:**
  - `IDENTITY.md` - 봇 이름, 이모지
  - `SOUL.md` - vibe, boundaries
  - `AGENTS.md` - R&R, 핵심 규칙
  - `USER.md` - 사용자 정보
  - `MEMORY.md` - 큐레이션된 메모리
  - `memory/decisions.md` - 의사결정 로그
  - `memory/team.md` - 팀원 정보
  - `memory/YYYY-MM-DD.md` - 일일 로그 (최근 3일)

**API 예시:**
```javascript
// GitHub REST API
const response = await fetch(
  'https://api.github.com/repos/semicolon-devteam/semo/contents/semo-system/bot-workspaces/planclaw/SOUL.md',
  {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3.raw'
    }
  }
);
const content = await response.text();
```

**캐싱 전략:**
- Server-side 캐싱 (5분 TTL)
- GitHub API rate limit 고려 (5000 req/hour)

### 3.2. OpenClaw Gateway API

**목적:** 봇 세션, 크론 상태 조회

**API 엔드포인트 (추정):**
- `GET /api/sessions` - 세션 목록
- `GET /api/sessions/:sessionKey` - 세션 상세
- `GET /api/cron/status` - 크론 스케줄러 상태
- `GET /api/cron/jobs` - 크론 작업 목록

**필요 정보:**
- OpenClaw Gateway URL (환경변수 `OPENCLAW_GATEWAY_URL`)
- 인증 토큰 (환경변수 `OPENCLAW_TOKEN`)

**데이터 구조 (예상):**
```typescript
interface Session {
  sessionKey: string;
  label: string;
  kind: string; // 'main' | 'isolated'
  agentId: string;
  lastActive: string;
  messageCount: number;
}

interface CronJob {
  jobId: string;
  name: string;
  schedule: { kind: 'cron' | 'every' | 'at'; /* ... */ };
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}
```

### 3.3. Knowledge Base (KB CLI 래핑)

**사용 도구:** 기존 KB CLI (`kb-cli` 또는 `semo-system` 내 KB 관리 도구)

**데이터 소스:** appdb semo 스키마 (PostgreSQL + pgvector)

**필요 기능:**
1. **시맨틱 검색**
   - 입력: 검색 쿼리 (텍스트)
   - 출력: 유사도 순 KB 항목 (Top 20)
   - 사용: Voyage-3 임베딩 + pgvector 코사인 유사도

2. **도메인별 필터링**
   - 도메인 목록: decision, service, infra, team, operations
   - 출력: 특정 도메인의 KB 항목만 필터링

3. **KB 항목 조회**
   - 입력: KB key
   - 출력: 전체 value (JSON 포맷)

**API 래핑 예시:**
```typescript
// Next.js API Route: /api/kb/search
export async function POST(req: Request) {
  const { query } = await req.json();
  // KB CLI 실행 또는 직접 PostgreSQL 쿼리
  const results = await execKBSearch(query);
  return Response.json(results);
}

// Next.js API Route: /api/kb/list?domain=decision
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  const items = await listKBByDomain(domain);
  return Response.json(items);
}
```

**DB 스키마 (추정):**
```sql
CREATE TABLE kb_items (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  owner_bot TEXT,
  embedding vector(1536), -- Voyage-3 임베딩
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(domain, key)
);
```

---

## 4. 화면별 기능 스펙

### 4.1. Bot Team Overview

#### A. Bot Status Cards (그리드)

**데이터 소스:**
- GitHub API: `semo-system/bot-workspaces/` 하위 디렉토리 목록 → 봇 목록
- 각 봇별:
  - `IDENTITY.md` → 이름, 이모지
  - `USER.md` → 역할
  - OpenClaw Gateway API → 세션 상태 (lastActive)

**UI 컴포넌트:**
```tsx
<BotCard
  name="PlanClaw"
  emoji="🗓️"
  role="PO/기획 전담"
  status="active" // active | idle | error
  lastActive="2026-03-07 22:00"
  sessionCount={3}
  workspacePath="semo-system/bot-workspaces/planclaw"
/>
```

**상태 판단 로직:**
- 🟢 Active: lastActive < 1시간 전
- 🟡 Idle: lastActive >= 1시간 전
- 🔴 Error: 세션 크래시 또는 오류 로그 존재

**API 엔드포인트:**
```
GET /api/bots
→ [
  {
    id: "planclaw",
    name: "PlanClaw",
    emoji: "🗓️",
    role: "PO/기획 전담",
    status: "active",
    lastActive: "2026-03-07T13:00:00Z",
    sessionCount: 3,
    workspacePath: "semo-system/bot-workspaces/planclaw"
  },
  ...
]
```

#### B. Bot Detail Panel (슬라이드인)

**트리거:** 봇 카드 클릭

**표시 정보:**
1. **설정 파일 요약**
   - SOUL.md → Core Truths, Vibe
   - AGENTS.md → R&R, 핵심 규칙 (첫 3개 섹션)
   - USER.md → 사용자 정보

2. **워크스페이스 파일 트리**
   - GitHub API로 `semo-system/bot-workspaces/{봇}/` 하위 파일 목록
   - 파일 클릭 → 내용 모달 표시

3. **메모리 파일**
   - `memory/decisions.md`
   - `memory/team.md`
   - `memory/YYYY-MM-DD.md` (최근 3일)

4. **최근 활동 로그**
   - OpenClaw Gateway API → 세션 히스토리 (최근 10개 메시지)
   - 크론 작업 실행 내역 (최근 5개)

**API 엔드포인트:**
```
GET /api/bots/:botId/detail
→ {
  config: {
    soul: "Core Truths:\n...",
    agents: "## R&R\n...",
    user: "Name: Reus\n..."
  },
  files: [
    { path: "SOUL.md", type: "file" },
    { path: "memory/", type: "directory" },
    ...
  ],
  memory: {
    decisions: "...",
    team: "...",
    dailyLogs: [
      { date: "2026-03-07", content: "..." },
      ...
    ]
  },
  activity: {
    sessions: [...],
    cronJobs: [...]
  }
}
```

**UI 컴포넌트:**
```tsx
<BotDetailPanel
  botId="planclaw"
  onClose={() => {}}
>
  <Tabs>
    <TabPanel label="Config">
      <ConfigSummary soul={...} agents={...} user={...} />
    </TabPanel>
    <TabPanel label="Files">
      <FileTree files={...} onFileClick={...} />
    </TabPanel>
    <TabPanel label="Memory">
      <MemoryViewer decisions={...} team={...} dailyLogs={...} />
    </TabPanel>
    <TabPanel label="Activity">
      <ActivityLog sessions={...} cronJobs={...} />
    </TabPanel>
  </Tabs>
</BotDetailPanel>
```

---

### 4.2. Knowledge Base

#### A. 시맨틱 검색 (상단 검색 바)

**입력:**
- 검색 쿼리 (텍스트)
- 예: "UI handoff process"

**출력:**
- 유사도 순 KB 항목 (Top 20)
- 표시: 도메인, 키, 값 요약, 유사도 점수

**API 호출:**
```typescript
POST /api/kb/search
{
  "query": "UI handoff process"
}

→ [
  {
    domain: "decision",
    key: "2026-03-01-ui-handoff",
    value: "DesignClaw UI 프로토타입 승인 후...",
    similarity: 0.92,
    ownerBot: "SemiClaw",
    createdAt: "2026-03-07"
  },
  ...
]
```

**UI 컴포넌트:**
```tsx
<SearchBar
  placeholder="Search knowledge base..."
  onSearch={(query) => handleSearch(query)}
/>

<SearchResults results={results}>
  {results.map(item => (
    <SearchResultCard
      domain={item.domain}
      key={item.key}
      valueSummary={item.value.slice(0, 100)}
      similarity={item.similarity}
      onClick={() => showDetailModal(item)}
    />
  ))}
</SearchResults>
```

#### B. 도메인별 필터링

**도메인 목록:**
- All (전체)
- decision
- service
- infra
- team
- operations

**UI:**
- 탭 또는 드롭다운 필터
- 선택 시 해당 도메인 KB만 테이블 표시

**API 호출:**
```typescript
GET /api/kb/list?domain=decision

→ [
  {
    domain: "decision",
    key: "2026-03-01-ui-handoff",
    valueSummary: "DesignClaw UI...",
    ownerBot: "SemiClaw",
    createdAt: "2026-03-07",
    updatedAt: "2026-03-07"
  },
  ...
]
```

#### C. KB 항목 테이블

**컬럼:**
- 도메인
- 키(key)
- 값 요약 (첫 100자)
- 소유 봇
- 생성일
- 수정일
- 액션 (👁️ 조회)

**UI 컴포넌트:**
```tsx
<KBTable items={items}>
  <TableRow>
    <td>{item.domain}</td>
    <td>{item.key}</td>
    <td>{item.valueSummary}</td>
    <td>{item.ownerBot}</td>
    <td>{formatDate(item.createdAt)}</td>
    <td>{formatDate(item.updatedAt)}</td>
    <td>
      <Button onClick={() => showDetailModal(item)}>👁️ 조회</Button>
    </td>
  </TableRow>
</KBTable>
```

#### D. KB 항목 상세 모달 (읽기 전용)

**트리거:** 👁️ 조회 버튼 클릭 또는 검색 결과 클릭

**표시 정보:**
- 도메인
- 키
- 전체 값 (JSON 포맷팅)
- 소유 봇
- 생성일/수정일

**UI 컴포넌트:**
```tsx
<Modal title="KB Item Detail" onClose={...}>
  <dl>
    <dt>Domain</dt>
    <dd>{item.domain}</dd>
    <dt>Key</dt>
    <dd>{item.key}</dd>
    <dt>Value</dt>
    <dd>
      <CodeBlock language="json">
        {JSON.stringify(item.value, null, 2)}
      </CodeBlock>
    </dd>
    <dt>Owner Bot</dt>
    <dd>{item.ownerBot}</dd>
    <dt>Created</dt>
    <dd>{formatDate(item.createdAt)}</dd>
    <dt>Updated</dt>
    <dd>{formatDate(item.updatedAt)}</dd>
  </dl>
</Modal>
```

---

## 5. API 설계

### 5.1. Bot API

#### `GET /api/bots`
봇 목록 + 상태 조회

**Response:**
```json
[
  {
    "id": "planclaw",
    "name": "PlanClaw",
    "emoji": "🗓️",
    "role": "PO/기획 전담",
    "status": "active",
    "lastActive": "2026-03-07T13:00:00Z",
    "sessionCount": 3,
    "workspacePath": "semo-system/bot-workspaces/planclaw"
  }
]
```

#### `GET /api/bots/:botId/detail`
봇 상세 정보 (설정, 파일 트리, 메모리, 활동)

**Response:**
```json
{
  "config": {
    "soul": "...",
    "agents": "...",
    "user": "..."
  },
  "files": [
    { "path": "SOUL.md", "type": "file" },
    { "path": "memory/", "type": "directory" }
  ],
  "memory": {
    "decisions": "...",
    "team": "...",
    "dailyLogs": [...]
  },
  "activity": {
    "sessions": [...],
    "cronJobs": [...]
  }
}
```

#### `GET /api/bots/:botId/files/:filePath`
특정 파일 내용 조회

**Example:** `GET /api/bots/planclaw/files/SOUL.md`

**Response:**
```json
{
  "path": "SOUL.md",
  "content": "# SOUL.md - Who You Are\n\n..."
}
```

---

### 5.2. KB API

#### `POST /api/kb/search`
시맨틱 검색

**Request:**
```json
{
  "query": "UI handoff process",
  "limit": 20
}
```

**Response:**
```json
[
  {
    "domain": "decision",
    "key": "2026-03-01-ui-handoff",
    "value": "...",
    "similarity": 0.92,
    "ownerBot": "SemiClaw",
    "createdAt": "2026-03-07T10:00:00Z"
  }
]
```

#### `GET /api/kb/list?domain={domain}`
도메인별 KB 항목 목록

**Query Params:**
- `domain` (optional): decision | service | infra | team | operations

**Response:**
```json
[
  {
    "domain": "decision",
    "key": "2026-03-01-ui-handoff",
    "valueSummary": "DesignClaw UI...",
    "ownerBot": "SemiClaw",
    "createdAt": "2026-03-07T10:00:00Z",
    "updatedAt": "2026-03-07T10:00:00Z"
  }
]
```

#### `GET /api/kb/item/:domain/:key`
특정 KB 항목 상세 조회

**Example:** `GET /api/kb/item/decision/2026-03-01-ui-handoff`

**Response:**
```json
{
  "domain": "decision",
  "key": "2026-03-01-ui-handoff",
  "value": { ... },
  "ownerBot": "SemiClaw",
  "createdAt": "2026-03-07T10:00:00Z",
  "updatedAt": "2026-03-07T10:00:00Z"
}
```

---

## 6. 데이터 흐름 다이어그램

### Bot Team Overview 데이터 흐름
```
User → Bot Team Overview 화면
  → Next.js SSR: GET /api/bots
    → GitHub API: semo-system/bot-workspaces/ 목록
    → 각 봇별 IDENTITY.md, USER.md 읽기
    → OpenClaw Gateway API: 세션 상태 조회
  → 봇 카드 렌더링
    → 사용자 카드 클릭
      → GET /api/bots/:botId/detail
        → GitHub API: 파일 트리 + 내용
        → OpenClaw Gateway API: 세션 히스토리 + 크론
      → 상세 패널 슬라이드인
```

### Knowledge Base 데이터 흐름
```
User → KB 화면
  → 검색 쿼리 입력
    → POST /api/kb/search
      → KB CLI: 시맨틱 검색 (Voyage-3 + pgvector)
    → 결과 표시
  → 도메인 필터 선택
    → GET /api/kb/list?domain=decision
      → KB CLI: PostgreSQL 쿼리
    → 테이블 갱신
  → 항목 클릭
    → GET /api/kb/item/:domain/:key
      → KB CLI: 항목 상세 조회
    → 모달 표시
```

---

## 7. 환경 변수

```env
# GitHub API
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_REPO=semicolon-devteam/semo

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=http://localhost:3000 # 또는 실제 Gateway URL
OPENCLAW_TOKEN=xxxxxxxxx

# PostgreSQL (appdb)
DATABASE_URL=postgresql://user:password@host:5432/appdb
```

---

## 8. 프로젝트 구조

```
packages/semo-dashboard/
├── app/
│   ├── layout.tsx                 # 글로벌 레이아웃
│   ├── page.tsx                   # 홈 (리다이렉트 → /bots)
│   ├── bots/
│   │   ├── page.tsx               # Bot Team Overview
│   │   └── [botId]/
│   │       └── page.tsx           # Bot Detail (옵션)
│   ├── kb/
│   │   └── page.tsx               # Knowledge Base
│   └── api/
│       ├── bots/
│       │   ├── route.ts           # GET /api/bots
│       │   └── [botId]/
│       │       ├── detail/route.ts
│       │       └── files/[...path]/route.ts
│       └── kb/
│           ├── search/route.ts    # POST /api/kb/search
│           ├── list/route.ts      # GET /api/kb/list
│           └── item/[domain]/[key]/route.ts
├── components/
│   ├── BotCard.tsx
│   ├── BotDetailPanel.tsx
│   ├── SearchBar.tsx
│   ├── KBTable.tsx
│   └── Modal.tsx
├── lib/
│   ├── github.ts                  # GitHub API 래퍼
│   ├── openclaw.ts                # OpenClaw Gateway API 래퍼
│   └── kb.ts                      # KB CLI 래퍼
├── types/
│   └── index.ts                   # TypeScript 타입 정의
├── tailwind.config.js
├── next.config.js
└── package.json
```

---

## 9. 구현 순서 (Phase 1)

### Step 1: 프로젝트 셋업 (1일)
- [ ] `packages/semo-dashboard` 디렉토리 생성
- [ ] Next.js 14 + TailwindCSS 초기화
- [ ] 환경 변수 설정
- [ ] 기본 레이아웃 컴포넌트 작성

### Step 2: 데이터 소스 연동 (2일)
- [ ] GitHub API 래퍼 구현 (`lib/github.ts`)
  - [ ] 파일 목록 조회
  - [ ] 파일 내용 읽기
  - [ ] 캐싱 레이어
- [ ] OpenClaw Gateway API 래퍼 구현 (`lib/openclaw.ts`)
  - [ ] 세션 목록/상세 조회
  - [ ] 크론 작업 조회
- [ ] KB CLI 래퍼 구현 (`lib/kb.ts`)
  - [ ] 시맨틱 검색
  - [ ] 도메인별 목록
  - [ ] 항목 상세 조회

### Step 3: Bot Team Overview (3일)
- [ ] API Routes 구현
  - [ ] `GET /api/bots`
  - [ ] `GET /api/bots/:botId/detail`
  - [ ] `GET /api/bots/:botId/files/:filePath`
- [ ] UI 컴포넌트 구현
  - [ ] BotCard
  - [ ] BotDetailPanel
  - [ ] FileTree
  - [ ] ConfigSummary
  - [ ] MemoryViewer
  - [ ] ActivityLog
- [ ] `/bots` 페이지 구현 (SSR)

### Step 4: Knowledge Base (3일)
- [ ] API Routes 구현
  - [ ] `POST /api/kb/search`
  - [ ] `GET /api/kb/list`
  - [ ] `GET /api/kb/item/:domain/:key`
- [ ] UI 컴포넌트 구현
  - [ ] SearchBar
  - [ ] SearchResults
  - [ ] DomainFilter
  - [ ] KBTable
  - [ ] KBDetailModal
- [ ] `/kb` 페이지 구현 (SSR + Client Components)

### Step 5: 통합 및 테스트 (2일)
- [ ] 네비게이션 통합 (사이드바)
- [ ] 에러 핸들링
- [ ] 로딩 상태
- [ ] 반응형 대응
- [ ] 통합 테스트

### Step 6: 배포 준비 (1일)
- [ ] InfraClaw에 OCI 인프라 배포 요청
- [ ] 환경 변수 설정 (프로덕션)
- [ ] 빌드 최적화
- [ ] 배포 문서 작성

**총 예상 기간:** 12일 (약 2.5주)

---

## 10. 제약사항 및 고려사항

### 제약사항
1. **Phase 1은 읽기 전용**
   - KB CRUD는 Phase 2
   - 봇 설정 파일 수정 불가

2. **GitHub API rate limit**
   - 5000 req/hour (인증된 요청)
   - 캐싱 필수

3. **OpenClaw Gateway 가용성**
   - Gateway URL 확인 필요
   - API 문서 확인 필요

### 고려사항
1. **에러 핸들링**
   - GitHub API 실패 시 폴백
   - OpenClaw Gateway 미응답 시 대체 UI

2. **성능 최적화**
   - Server-side 캐싱 (5분 TTL)
   - 페이지네이션 (KB 테이블)
   - 이미지 최적화 (봇 아바타 등)

3. **보안**
   - GitHub Token 노출 방지 (서버 사이드만)
   - OpenClaw Token 환경변수 관리
   - CORS 설정 (필요 시)

4. **접근성**
   - 키보드 네비게이션
   - ARIA 레이블
   - 색상 대비

---

## 11. 다음 단계 (Phase 2+)

### Phase 2
- SEMO Core (에이전트/스킬 카탈로그)
- KB CRUD 기능 (추가/수정/삭제)
- 인증 레이어 추가

### Phase 3
- Ontology & Vector DB (그래프 시각화)
- 벡터 유사도 탐색기
- 실시간 갱신 (WebSocket)

---

**Feature 스펙 (Phase 1) 작성 완료**  
작성일: 2026-03-07  
작성자: PlanClaw  
버전: 1.0
