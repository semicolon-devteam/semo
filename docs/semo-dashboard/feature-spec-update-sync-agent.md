# SEMO Dashboard - Feature 스펙 업데이트 (Sync Agent 반영)

> **업데이트일:** 2026-03-07  
> **작성자:** PlanClaw  
> **변경 사유:** OpenClaw Gateway API 접근 불가 → Sync Agent 방식으로 전환

---

## 변경 사항 요약

### AS-IS (기존 Phase 1 스펙)
- OpenClaw Gateway API 직접 호출
- 환경변수: `OPENCLAW_GATEWAY_URL`, `OPENCLAW_TOKEN`
- 실시간 봇 상태 조회

### TO-BE (업데이트 후)
- **Sync Agent** 통한 DB 동기화 방식
- 환경변수: `DATABASE_URL` (기존 appdb 활용)
- 주기적 동기화 (1분 주기)

---

## 아키텍처 변경

### 기존
```
SEMO Dashboard (OCI)
    ↓
OpenClaw Gateway API (Mac Mini) → 접근 불가
    ↓
봇 상태 파일
```

### 변경 후
```
[Mac Mini]                          [OCI]
봇 OpenClaw 파일들              SEMO Dashboard
~/.openclaw-*/                  (Next.js)
    ↓                               ↓
Sync Agent (크론)              PostgreSQL (appdb)
- sessions.json 읽기    →      - bot_status
- cron/jobs.json 읽기   →      - bot_sessions
                               - bot_cron_jobs
    ↓                               ↑
    └──── HTTP POST ────────────────┘
```

---

## 새로운 컴포넌트: Sync Agent

### 목적
Mac Mini에서 실행 중인 봇들의 상태 정보를 주기적으로 수집하여 OCI PostgreSQL에 동기화

### 구현
- **위치:** `semo-system/sync-agent/`
- **언어:** Node.js
- **실행:** 크론 (1분 주기)
- **상세 스펙:** `sync-agent-spec.md`

### 수집 데이터
1. 세션 상태 (`~/.openclaw-{봇}/agents/main/sessions/sessions.json`)
2. 크론 작업 (`~/.openclaw-{봇}/cron/jobs.json`)
3. 게이트웨이 로그 (선택적)

---

## DB 스키마 추가

### `bot_status` 테이블
```sql
CREATE TABLE bot_status (
  bot_id TEXT PRIMARY KEY,
  name TEXT,
  emoji TEXT,
  role TEXT,
  last_active TIMESTAMP,
  session_count INTEGER DEFAULT 0,
  workspace_path TEXT,
  status TEXT, -- 'active' | 'idle' | 'error'
  synced_at TIMESTAMP DEFAULT NOW()
);
```

### `bot_sessions` 테이블
```sql
CREATE TABLE bot_sessions (
  bot_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  label TEXT,
  kind TEXT,
  chat_type TEXT,
  last_activity TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  synced_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (bot_id, session_key)
);

CREATE INDEX idx_bot_sessions_bot_id ON bot_sessions(bot_id);
CREATE INDEX idx_bot_sessions_last_activity ON bot_sessions(last_activity DESC);
```

### `bot_cron_jobs` 테이블
```sql
CREATE TABLE bot_cron_jobs (
  bot_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  name TEXT,
  schedule JSONB,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  session_target TEXT,
  synced_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (bot_id, job_id)
);

CREATE INDEX idx_bot_cron_jobs_bot_id ON bot_cron_jobs(bot_id);
CREATE INDEX idx_bot_cron_jobs_next_run ON bot_cron_jobs(next_run);
```

---

## API 변경

### Bot API

**AS-IS:**
```typescript
// OpenClaw Gateway API 호출
const response = await fetch(`${OPENCLAW_GATEWAY_URL}/api/sessions`);
```

**TO-BE:**
```typescript
// PostgreSQL 쿼리
export async function GET(req: Request) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const result = await client.query(`
    SELECT * FROM bot_status ORDER BY bot_id
  `);
  
  await client.end();
  return Response.json(result.rows);
}
```

### Bot Detail API

**AS-IS:**
```typescript
// OpenClaw Gateway API 호출
const sessions = await fetch(`${OPENCLAW_GATEWAY_URL}/api/sessions`);
const cronJobs = await fetch(`${OPENCLAW_GATEWAY_URL}/api/cron/jobs`);
```

**TO-BE:**
```typescript
// PostgreSQL 쿼리
const sessions = await client.query(`
  SELECT * FROM bot_sessions WHERE bot_id = $1 ORDER BY last_activity DESC
`, [botId]);

const cronJobs = await client.query(`
  SELECT * FROM bot_cron_jobs WHERE bot_id = $1 ORDER BY next_run
`, [botId]);
```

---

## 환경변수 변경

### AS-IS
```env
GITHUB_TOKEN=...
GITHUB_REPO=semicolon-devteam/semo
OPENCLAW_GATEWAY_URL=http://...  # 제거
OPENCLAW_TOKEN=...                # 제거
DATABASE_URL=...
```

### TO-BE
```env
GITHUB_TOKEN=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
GITHUB_REPO=semicolon-devteam/semo
DATABASE_URL=postgresql://app:<PASSWORD>@central-db.semi-dev.internal:5432/appdb
```

---

## 장점

1. **단순성:** Dashboard는 DB만 조회 (복잡도 감소)
2. **보안:** Mac Mini 직접 노출 불필요
3. **유연성:** Sync 주기 조절 가능 (1~5분)
4. **독립성:** Dashboard 배포 위치 독립적 (OCI 가능)

---

## 제약사항

- **실시간성:** 1~5분 지연 (Sync 주기에 따라)
- **의존성:** Sync Agent가 정상 동작해야 Dashboard 정상 작동

---

## 구현 순서 업데이트

### AS-IS (기존 Phase 1)
1. 프로젝트 셋업 (1일)
2. 데이터 소스 연동 (GitHub + OpenClaw Gateway + KB) (2일)
3. Bot Team Overview (3일)
4. Knowledge Base (3일)
5. 통합/테스트 (2일)
6. 배포 준비 (1일)

**총 12일**

### TO-BE (Sync Agent 반영)
1. 프로젝트 셋업 (1일)
2. **Sync Agent 구현 (2일)** ← 새로 추가
3. 데이터 소스 연동 (GitHub + **PostgreSQL** + KB) (2일)
4. Bot Team Overview (3일)
5. Knowledge Base (3일)
6. 통합/테스트 (2일)
7. 배포 준비 (1일)

**총 14일 (2일 추가)**

---

## 작업 분담

### PlanClaw (완료)
- ✅ Sync Agent 스펙 작성 (`sync-agent-spec.md`)
- ✅ DB 스키마 설계
- ✅ Feature 스펙 업데이트

### InfraClaw
- DB 스키마 생성 (appdb)
- OCI 인프라 구성 (SEMO Dashboard)
- K8S Secret 설정

### WorkClaw
- Sync Agent 구현 (`semo-system/sync-agent/`)
- SEMO Dashboard 구현 (DB 쿼리 기반)
- 통합 테스트

---

**업데이트 완료**  
작성일: 2026-03-07  
작성자: PlanClaw  
버전: 1.1
