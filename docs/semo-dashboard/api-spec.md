# SEMO Dashboard API 스펙

> **프로젝트:** SEMO Dashboard  
> **작성일:** 2026-03-12  
> **작성자:** PlanClaw  
> **버전:** 1.0

---

## 개요

SEMO Dashboard의 백엔드 API 스펙 정의.
- **Phase 1 (MVP):** Bot Team Overview + Knowledge Base (읽기 전용)
- **Phase 2:** CRUD 추가 + 실시간 갱신

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Framework | Next.js 14 API Routes |
| Database | PostgreSQL (appdb, semo 스키마) |
| Vector | pgvector (Voyage-3, 1024dim) |
| OpenClaw | Gateway API (세션, 크론) |
| Filesystem | Direct read from `semo-system/` |

---

## 환경변수

```bash
# PostgreSQL (KB)
KB_DB_HOST=127.0.0.1
KB_DB_PORT=15432           # SSH 터널 포트
KB_DB_USER=app
KB_DB_PASSWORD=ProductionPassword2024!@#
KB_DB_NAME=appdb

# Voyage AI (임베딩)
VOYAGE_API_KEY=pa-Y0tghHW8EVRVhTRmDoIpHuuNx6JBs1sZzBwqQMgCISN

# GitHub API (봇 메타데이터)
GITHUB_TOKEN=<your-token>

# OpenClaw Gateway (세션, 크론)
OPENCLAW_GATEWAY_URL=http://localhost:8080  # 또는 실제 게이트웨이 URL
OPENCLAW_GATEWAY_TOKEN=<your-token>         # 필요 시
```

---

## 📦 Priority 1: Bot Team Overview API

### 1. `GET /api/bots`

**목적:** 전체 봇 목록 조회 (상태, 역할, 마지막 활동)

**응답:**
```json
{
  "bots": [
    {
      "bot_id": "semiclaw",
      "name": "SemiClaw",
      "emoji": "🦞",
      "role": "PM & Orchestrator",
      "status": "active",           // active | idle | error
      "last_activity": "2026-03-12T17:30:00Z",
      "session_count": 3,
      "workspace_path": "/Users/reus/semo-system/bot-workspaces/semiclaw"
    },
    // ...
  ]
}
```

**구현 참고:**
- 이미 구현됨 (`/api/bots/route.ts`)
- PostgreSQL `semo.bot_status` 테이블 조회
- GitHub API로 IDENTITY.md, USER.md 메타데이터 enrichment

---

### 2. `GET /api/bots/:botId/detail`

**목적:** 특정 봇의 상세 정보 조회

**응답:**
```json
{
  "bot_id": "semiclaw",
  "config": {
    "soul": {
      "core_truths": ["Be genuinely helpful...", "Have opinions..."],
      "boundaries": ["Private things stay private.", "..."],
      "vibe": "Be the assistant you'd actually want to talk to..."
    },
    "agents": {
      "rr": "PM & Orchestrator — 봇 팀 조율, 프로젝트 전략",
      "protocols": ["범위 밖 요청 → SemiClaw 인계", "..."]
    },
    "user": {
      "name": "Reus",
      "timezone": "Asia/Seoul",
      "notes": "First contact on 2026-02-17"
    }
  },
  "workspace": {
    "path": "/Users/reus/semo-system/bot-workspaces/semiclaw",
    "files": [
      { "path": "SOUL.md", "size": 1024, "modified": "2026-03-10T12:00:00Z" },
      { "path": "AGENTS.md", "size": 2048, "modified": "2026-03-10T12:00:00Z" },
      { "path": "memory/decisions.md", "size": 512, "modified": "2026-03-12T10:00:00Z" },
      // ...
    ]
  },
  "memory": {
    "recent_logs": [
      { "date": "2026-03-12", "path": "memory/2026-03-12.md", "summary": "..." },
      { "date": "2026-03-11", "path": "memory/2026-03-11.md", "summary": "..." },
      { "date": "2026-03-10", "path": "memory/2026-03-10.md", "summary": "..." }
    ],
    "key_files": [
      { "path": "memory/decisions.md", "summary": "주요 의사결정 및 원칙" },
      { "path": "memory/team.md", "summary": "팀원 및 프로젝트 정보" }
    ]
  },
  "activity": {
    "sessions": [
      { "session_key": "main-123", "label": "#proj-semo", "last_message": "2026-03-12T17:30:00Z" },
      // ... (최근 10개)
    ],
    "cron_jobs": [
      { "job_id": "heartbeat", "schedule": "*/30 * * * *", "last_run": "2026-03-12T17:00:00Z", "status": "success" },
      // ...
    ]
  }
}
```

**구현 방법:**

1. **config 섹션:**
   - 파일시스템에서 `SOUL.md`, `AGENTS.md`, `USER.md` 읽기
   - Markdown 파싱 (간단한 섹션 추출)

2. **workspace 섹션:**
   - `fs.readdir` 재귀로 파일 트리 생성
   - 주요 파일: `*.md`, `memory/*`, `skills/*`

3. **memory 섹션:**
   - `memory/YYYY-MM-DD.md` 최근 3일
   - `memory/decisions.md`, `memory/team.md` 등

4. **activity 섹션:**
   - **세션:** `sessions_list` tool 호출 (OpenClaw Gateway API)
   - **크론:** `cron` tool (`action: list`) 호출

**OpenClaw API 호출 예시:**
```javascript
// sessions_list 호출 (tool 사용)
const sessions = await fetch(`${OPENCLAW_GATEWAY_URL}/api/sessions/list`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 10, messageLimit: 1 })
});

// cron list 호출
const cronJobs = await fetch(`${OPENCLAW_GATEWAY_URL}/api/cron/list`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
```

**참고:**
- OpenClaw Gateway API는 tool 기반이므로, 실제 엔드포인트는 Gateway 문서 확인 필요
- 또는 `exec` tool로 `openclaw` CLI 호출 (예: `openclaw sessions list --json`)

---

### 3. `GET /api/bots/:botId/files/:filePath`

**목적:** 특정 봇의 워크스페이스 파일 내용 조회

**예시 요청:**
- `GET /api/bots/semiclaw/files/SOUL.md`
- `GET /api/bots/semiclaw/files/memory/2026-03-12.md`

**응답:**
```json
{
  "path": "SOUL.md",
  "content": "# SOUL.md - Who You Are\n\n_You're not a chatbot..._",
  "size": 1024,
  "modified": "2026-03-10T12:00:00Z"
}
```

**구현:**
- `fs.readFile` (UTF-8)
- 보안: 경로 검증 (path traversal 방지 — `..` 금지)

---

## 📚 Priority 2: Knowledge Base API

### 4. `POST /api/kb/search`

**목적:** 시맨틱 검색 (Voyage-3 임베딩 + pgvector)

**요청:**
```json
{
  "query": "프론트엔드 개발자",
  "limit": 10,
  "bot_id": "semiclaw"  // 옵션: 봇별 KB 검색
}
```

**응답:**
```json
{
  "results": [
    {
      "kb_id": 123,
      "domain": "team",
      "key": "frontend-dev",
      "content": "Reus — React/Next.js 전문가...",
      "similarity_pct": 87.3,
      "created_by": "semiclaw",
      "updated_at": "2026-03-10T12:00:00Z"
    },
    // ...
  ]
}
```

**구현:**
1. Voyage API로 쿼리 임베딩 생성
2. PostgreSQL 쿼리:
   ```sql
   -- 전체 KB 검색
   SELECT kb_id, domain, key, content,
          ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) as similarity_pct
   FROM semo.knowledge_base
   ORDER BY embedding <=> $1::vector
   LIMIT $2
   ```
**참고:** `kb-cli.js` 의 `search()` 함수

---

### 5. `GET /api/kb/list`

**목적:** KB 항목 목록 조회 (도메인별 필터링 지원)

**쿼리 파라미터:**
- `domain` (옵션): 도메인 필터 (예: `team`, `decision`)
- `created_by` (옵션): 작성자 필터

**응답:**
```json
{
  "items": [
    {
      "kb_id": 123,
      "domain": "team",
      "key": "frontend-dev",
      "summary": "Reus — React/Next.js 전문가, Tailwind CSS...",
      "created_by": "semiclaw",
      "updated_at": "2026-03-10T12:00:00Z"
    },
    // ...
  ]
}
```

**구현:**
```sql
-- 전체 목록
SELECT kb_id, domain, key, LEFT(content, 80) as summary, created_by, updated_at
FROM semo.knowledge_base
ORDER BY domain, key

-- 도메인 필터
SELECT kb_id, domain, key, LEFT(content, 80) as summary, created_by, updated_at
FROM semo.knowledge_base
WHERE domain = $1
ORDER BY key
```

**참고:** `kb-cli.js` 의 `list()` / `botList()` 함수

---

### 6. `GET /api/kb/domains`

**목적:** 도메인 목록 및 통계 조회

**응답:**
```json
{
  "domains": [
    {
      "domain": "decision",
      "description": "의사결정 및 원칙",
      "entry_count": 15
    },
    {
      "domain": "team",
      "description": "팀원 정보",
      "entry_count": 8
    },
    // ...
  ]
}
```

**구현:**
```sql
SELECT o.domain, o.description, COUNT(k.kb_id) as entry_count
FROM semo.ontology o
LEFT JOIN semo.knowledge_base k ON o.domain = k.domain
GROUP BY o.domain, o.description
ORDER BY o.domain
```

**참고:** `kb-cli.js` 의 `listDomains()` 함수

---

### 7. `GET /api/kb/item/:domain/:key`

**목적:** 특정 KB 항목 상세 조회

**예시:** `GET /api/kb/item/team/frontend-dev`

**응답:**
```json
{
  "kb_id": 123,
  "domain": "team",
  "key": "frontend-dev",
  "content": "Reus — React/Next.js 전문가, Tailwind CSS, TypeScript...",
  "metadata": {},
  "created_by": "semiclaw",
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-10T12:00:00Z",
  "use_count": 5,
  "last_used_at": "2026-03-12T09:00:00Z"
}
```

**구현:**
```sql
SELECT kb_id, domain, key, content, metadata, created_by, created_at, updated_at, use_count, last_used_at
FROM semo.knowledge_base
WHERE domain = $1 AND key = $2
```

**참고:** `kb-cli.js` 의 `get()` / `botGet()` 함수

---

### 8. `GET /api/kb/stats`

**목적:** KB 전체 통계 조회

**응답:**
```json
{
  "knowledge_base": {
    "total": 50,
    "emb": 48,  // 임베딩 생성된 항목 수
    "by_domain": [
      { "domain": "decision", "cnt": 15, "emb_cnt": 15 },
      { "domain": "team", "cnt": 8, "emb_cnt": 8 },
      // ...
    ]
  },
}
```

**구현:**
```sql
-- knowledge_base 통계
SELECT domain, count(*) as cnt, count(embedding) as emb_cnt
FROM semo.knowledge_base
GROUP BY domain
ORDER BY domain

SELECT count(*) as total, count(embedding) as emb
FROM semo.knowledge_base
```

**참고:** `kb-cli.js` 의 `stats()` 함수

---

## 📊 Phase 2 (CRUD) — 향후 추가

### 9. `POST /api/kb/item` (Create)

**요청:**
```json
{
  "domain": "service",
  "key": "cm-land-api",
  "content": "https://api.cm-land.com — CM Land API 엔드포인트",
  "created_by": "semiclaw"
}
```

**응답:**
```json
{
  "kb_id": 124,
  "embedded": true
}
```

---

### 10. `PATCH /api/kb/item/:domain/:key` (Update)

**요청:**
```json
{
  "content": "https://api.cm-land.com — 업데이트된 내용..."
}
```

**응답:**
```json
{
  "kb_id": 124,
  "embedded": true
}
```

---

### 11. `DELETE /api/kb/item/:domain/:key` (Delete)

**응답:**
```json
{
  "deleted": true,
  "kb_id": 124
}
```

---

## 🔧 구현 가이드라인

### 파일 구조

```
packages/semo-dashboard/
├── app/
│   ├── api/
│   │   ├── bots/
│   │   │   ├── route.ts                  # ✅ 완료
│   │   │   └── [botId]/
│   │   │       ├── detail/
│   │   │       │   └── route.ts          # 🔄 미구현
│   │   │       └── files/
│   │   │           └── [...filePath]/
│   │   │               └── route.ts      # 🔄 미구현
│   │   └── kb/
│   │       ├── search/
│   │       │   └── route.ts              # 🔄 미구현 (POST)
│   │       ├── list/
│   │       │   └── route.ts              # 🔄 미구현
│   │       ├── domains/
│   │       │   └── route.ts              # 🔄 미구현
│   │       ├── item/
│   │       │   └── [domain]/
│   │       │       └── [key]/
│   │       │           └── route.ts      # 🔄 미구현
│   │       └── stats/
│   │           └── route.ts              # 🔄 미구현
├── lib/
│   ├── github.ts                          # 🔄 분리 필요 (현재 /api/bots에 인라인)
│   ├── openclaw.ts                        # 🔄 미생성 (세션, 크론 API)
│   ├── kb.ts                              # 🔄 미생성 (KB 쿼리)
│   └── voyage.ts                          # 🔄 미생성 (임베딩)
```

---

### lib/kb.ts 예시

```typescript
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.KB_DB_HOST || "127.0.0.1",
  port: parseInt(process.env.KB_DB_PORT || "15432"),
  user: process.env.KB_DB_USER || "app",
  password: process.env.KB_DB_PASSWORD || "",
  database: process.env.KB_DB_NAME || "appdb",
  ssl: false,
});

export async function search(query: string, limit = 10) {
  const embedding = await genEmbedding(query);
  const res = await pool.query(
    `SELECT kb_id, domain, key, content,
            ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) as similarity_pct
     FROM semo.knowledge_base
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [`[${embedding.join(",")}]`, limit]
  );
  return res.rows;
}

export async function list(domain?: string) {
  const query = domain
    ? "SELECT kb_id, domain, key, LEFT(content, 80) as summary, created_by, updated_at FROM semo.knowledge_base WHERE domain=$1 ORDER BY key"
    : "SELECT kb_id, domain, key, LEFT(content, 80) as summary, created_by, updated_at FROM semo.knowledge_base ORDER BY domain, key";
  const res = await pool.query(query, domain ? [domain] : []);
  return res.rows;
}

// genEmbedding, listDomains, getItem, stats 등 추가...
```

---

### lib/voyage.ts 예시

```typescript
const VOYAGE_KEY = process.env.VOYAGE_API_KEY || "";

export async function genEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VOYAGE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "voyage-3",
      input: [text],
      output_dimension: 1024,
    }),
  });

  if (!res.ok) {
    throw new Error(`Embedding API error: ${await res.text()}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}
```

---

### lib/openclaw.ts 예시

```typescript
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:8080";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

export async function listSessions(limit = 10) {
  // OpenClaw Gateway API 호출 (실제 엔드포인트는 문서 확인 필요)
  // 또는 exec tool로 CLI 호출: `openclaw sessions list --json`
  const res = await fetch(`${GATEWAY_URL}/api/sessions/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit, messageLimit: 1 }),
  });

  if (!res.ok) {
    throw new Error(`Gateway API error: ${await res.text()}`);
  }

  return res.json();
}

export async function listCronJobs() {
  const res = await fetch(`${GATEWAY_URL}/api/cron/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Gateway API error: ${await res.text()}`);
  }

  return res.json();
}
```

**주의:** OpenClaw Gateway API의 실제 엔드포인트는 문서 확인 필요. 위는 가상 예시.

---

## 🔐 보안

### Path Traversal 방지

```typescript
// lib/filesystem.ts
import path from "path";

export function safeReadFile(basePath: string, userPath: string) {
  const resolved = path.resolve(basePath, userPath);
  if (!resolved.startsWith(basePath)) {
    throw new Error("Invalid path");
  }
  return fs.readFileSync(resolved, "utf-8");
}
```

### PostgreSQL Injection 방지

- 모든 쿼리에서 Parameterized Query 사용 (`$1`, `$2`, ...)
- 사용자 입력을 SQL에 직접 삽입 금지

### API Rate Limiting (Phase 2)

- Voyage API 호출 제한 (임베딩 생성 비용 고려)
- PostgreSQL 쿼리 성능 최적화 (인덱스 확인)

---

## 📈 성능 최적화

### KB 검색 최적화

1. **Hot KB 우선 조회** (`hot_until` 필드 활용)
2. **Archived KB 제외** (`archived = false`)
3. **Vector 인덱스** (pgvector IVFFlat/HNSW)

### 캐싱 (Phase 2)

- 도메인 목록 캐싱 (Redis 또는 메모리)
- 봇 메타데이터 캐싱 (GitHub API 호출 최소화)

---

## 🧪 테스트

### API 테스트

```bash
# Bot 목록
curl http://localhost:3000/api/bots

# Bot 상세
curl http://localhost:3000/api/bots/semiclaw/detail

# KB 검색
curl -X POST http://localhost:3000/api/kb/search \
  -H "Content-Type: application/json" \
  -d '{"query": "프론트엔드 개발자", "limit": 5}'

# KB 목록
curl "http://localhost:3000/api/kb/list?domain=team"

# KB 도메인
curl http://localhost:3000/api/kb/domains

# KB 항목
curl http://localhost:3000/api/kb/item/team/frontend-dev

# KB 통계
curl http://localhost:3000/api/kb/stats
```

---

## 📋 체크리스트

### Priority 1 (Bot Detail Panel)

- [ ] `GET /api/bots/:botId/detail` 구현
  - [ ] config 섹션 (SOUL.md, AGENTS.md, USER.md 파싱)
  - [ ] workspace 섹션 (파일 트리)
  - [ ] memory 섹션 (최근 로그, key 파일)
  - [ ] activity 섹션 (세션, 크론)
- [ ] `GET /api/bots/:botId/files/:filePath` 구현
  - [ ] Path traversal 방지
- [ ] `lib/openclaw.ts` 구현 (세션, 크론 API)
- [ ] `lib/github.ts` 분리 (기존 /api/bots에서 추출)

### Priority 2 (Knowledge Base)

- [ ] `POST /api/kb/search` 구현
  - [ ] Voyage API 임베딩 생성
  - [ ] pgvector 유사도 쿼리
  - [ ] bot_id 필터 지원
- [ ] `GET /api/kb/list` 구현
  - [ ] 도메인 필터
  - [ ] bot_id 필터
- [ ] `GET /api/kb/domains` 구현
- [ ] `GET /api/kb/item/:domain/:key` 구현
- [ ] `GET /api/kb/stats` 구현
- [ ] `lib/kb.ts` 구현 (KB 쿼리 함수)
- [ ] `lib/voyage.ts` 구현 (임베딩 생성)

---

**API 스펙 작성 완료**  
작성일: 2026-03-12  
작성자: PlanClaw  
버전: 1.0

다음 단계: WorkClaw에게 인계 (GitHub 이슈 생성)
