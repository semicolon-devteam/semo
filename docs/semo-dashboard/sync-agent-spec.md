# SEMO Dashboard - Sync Agent 스펙

> **프로젝트:** SEMO Dashboard  
> **컴포넌트:** Sync Agent (봇 상태 동기화)  
> **작성일:** 2026-03-07  
> **작성자:** PlanClaw  

---

## 1. 개요

### 목적
Mac Mini에서 실행 중인 OpenClaw 봇들의 상태 정보를 주기적으로 수집하여 OCI 인프라의 PostgreSQL DB에 동기화.

### 아키텍처
```
[Mac Mini]                          [OCI]
봇 OpenClaw 파일들              SEMO Dashboard
~/.openclaw-*/                  (Next.js)
    ↓                               ↓
Sync Agent (크론)              PostgreSQL (appdb)
- sessions.json 읽기    →      - bot_status
- cron/jobs.json 읽기   →      - cron_jobs  
- gateway.log 읽기      →      - gateway_logs
    ↓                               ↑
    └──── HTTP POST ────────────────┘
```

### 실행 방식
- **크론 스케줄:** 1분마다 (조정 가능)
- **실행 위치:** Mac Mini
- **구현:** Node.js 스크립트

---

## 2. 수집 데이터

### 2.1. 봇 목록
- **소스:** `~/.openclaw-*` 디렉토리 목록
- **추출:** 디렉토리명에서 봇 ID 추출 (예: `~/.openclaw-planclaw` → `planclaw`)

### 2.2. 세션 상태
- **소스:** `~/.openclaw-{봇}/agents/main/sessions/sessions.json`
- **수집 항목:**
  - `sessionKey` - 세션 고유 ID
  - `label` - 세션 라벨
  - `kind` - 세션 종류 (main, isolated)
  - `chatType` - 채팅 타입 (slack, telegram 등)
  - `lastActivity` - 마지막 활동 시간
  - `messageCount` - 메시지 개수 (세션 로그에서 계산)

### 2.3. 크론 작업
- **소스:** `~/.openclaw-{봇}/cron/jobs.json`
- **수집 항목:**
  - `jobId` - 크론 작업 고유 ID
  - `name` - 작업 이름
  - `schedule` - 스케줄 정보 (kind, expr/everyMs 등)
  - `enabled` - 활성화 여부
  - `lastRun` - 마지막 실행 시간
  - `nextRun` - 다음 실행 예정 시간
  - `sessionTarget` - 세션 타겟 (main, isolated)

### 2.4. 게이트웨이 로그 (선택적)
- **소스:** `~/.openclaw-{봇}/logs/gateway.log`
- **수집 항목:**
  - 최근 100줄 (또는 마지막 1시간)
  - 에러 로그 우선

---

## 3. DB 스키마

### 3.1. `bot_status` 테이블
봇별 전체 상태 정보

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

**컬럼 설명:**
- `bot_id` - 봇 고유 ID (예: planclaw)
- `name` - 봇 이름 (예: PlanClaw)
- `emoji` - 봇 이모지 (IDENTITY.md에서 추출 - GitHub API)
- `role` - 봇 역할 (USER.md에서 추출 - GitHub API)
- `last_active` - 가장 최근 세션 활동 시간
- `session_count` - 활성 세션 개수
- `workspace_path` - 워크스페이스 경로 (예: semo-system/bot-workspaces/planclaw)
- `status` - 봇 상태
  - `active`: last_active < 1시간 전
  - `idle`: last_active >= 1시간 전
  - `error`: 오류 로그 존재
- `synced_at` - 마지막 동기화 시간

### 3.2. `bot_sessions` 테이블
세션 상세 정보

```sql
CREATE TABLE bot_sessions (
  bot_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  label TEXT,
  kind TEXT, -- 'main' | 'isolated'
  chat_type TEXT, -- 'slack' | 'telegram' | ...
  last_activity TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  synced_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (bot_id, session_key)
);

CREATE INDEX idx_bot_sessions_bot_id ON bot_sessions(bot_id);
CREATE INDEX idx_bot_sessions_last_activity ON bot_sessions(last_activity DESC);
```

### 3.3. `bot_cron_jobs` 테이블
크론 작업 정보

```sql
CREATE TABLE bot_cron_jobs (
  bot_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  name TEXT,
  schedule JSONB, -- 스케줄 전체 구조 (kind, expr, everyMs 등)
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  session_target TEXT, -- 'main' | 'isolated'
  synced_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (bot_id, job_id)
);

CREATE INDEX idx_bot_cron_jobs_bot_id ON bot_cron_jobs(bot_id);
CREATE INDEX idx_bot_cron_jobs_next_run ON bot_cron_jobs(next_run);
```

### 3.4. `bot_gateway_logs` 테이블 (선택적)
게이트웨이 로그

```sql
CREATE TABLE bot_gateway_logs (
  id SERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  log_level TEXT, -- 'info' | 'warn' | 'error'
  message TEXT,
  timestamp TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bot_gateway_logs_bot_id ON bot_gateway_logs(bot_id);
CREATE INDEX idx_bot_gateway_logs_timestamp ON bot_gateway_logs(timestamp DESC);
```

---

## 4. Sync Agent 구현

### 4.1. 파일 구조
```
semo-system/sync-agent/
├── sync.js                 # 메인 스크립트
├── package.json
├── lib/
│   ├── collector.js        # 데이터 수집 로직
│   ├── parser.js           # 파일 파싱 (sessions.json, jobs.json)
│   └── uploader.js         # DB 업로드 로직
└── config.js               # 설정 (DB URL, sync interval)
```

### 4.2. 메인 스크립트 (sync.js)

```javascript
#!/usr/bin/env node

const { collectBotData } = require('./lib/collector');
const { uploadToDatabase } = require('./lib/uploader');

async function main() {
  try {
    console.log(`[Sync Agent] Starting at ${new Date().toISOString()}`);
    
    // 1. 데이터 수집
    const botData = await collectBotData();
    console.log(`[Sync Agent] Collected data for ${botData.length} bots`);
    
    // 2. DB 업로드
    await uploadToDatabase(botData);
    console.log(`[Sync Agent] Upload completed`);
  } catch (error) {
    console.error(`[Sync Agent] Error:`, error);
    process.exit(1);
  }
}

main();
```

### 4.3. 데이터 수집 (lib/collector.js)

```javascript
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { parseSessions, parseCronJobs } = require('./parser');

async function collectBotData() {
  const homeDir = os.homedir();
  const openclawDirs = await fs.readdir(homeDir);
  
  const bots = [];
  
  for (const dir of openclawDirs) {
    if (!dir.startsWith('.openclaw-')) continue;
    
    const botId = dir.replace('.openclaw-', '');
    const botPath = path.join(homeDir, dir);
    
    try {
      // 세션 데이터 수집
      const sessionsPath = path.join(botPath, 'agents/main/sessions/sessions.json');
      const sessions = await parseSessions(sessionsPath);
      
      // 크론 데이터 수집
      const cronPath = path.join(botPath, 'cron/jobs.json');
      const cronJobs = await parseCronJobs(cronPath);
      
      // 봇 상태 계산
      const lastActive = sessions.length > 0 
        ? new Date(Math.max(...sessions.map(s => new Date(s.lastActivity))))
        : null;
      
      const status = lastActive 
        ? (Date.now() - lastActive < 3600000 ? 'active' : 'idle')
        : 'idle';
      
      bots.push({
        botId,
        lastActive,
        sessionCount: sessions.length,
        status,
        sessions,
        cronJobs
      });
    } catch (error) {
      console.warn(`[Collector] Failed to collect data for ${botId}:`, error.message);
    }
  }
  
  return bots;
}

module.exports = { collectBotData };
```

### 4.4. 파일 파싱 (lib/parser.js)

```javascript
const fs = require('fs').promises;

async function parseSessions(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // sessions.json 구조에 맞게 파싱
    return Object.entries(data).map(([sessionKey, session]) => ({
      sessionKey,
      label: session.label || '',
      kind: session.kind || 'main',
      chatType: session.chatType || '',
      lastActivity: session.lastActivity || new Date().toISOString(),
      messageCount: session.messageCount || 0
    }));
  } catch (error) {
    console.warn(`[Parser] Failed to parse sessions:`, error.message);
    return [];
  }
}

async function parseCronJobs(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // jobs.json 구조에 맞게 파싱
    return data.jobs.map(job => ({
      jobId: job.jobId,
      name: job.name || '',
      schedule: job.schedule,
      enabled: job.enabled !== false,
      lastRun: job.lastRun || null,
      nextRun: job.nextRun || null,
      sessionTarget: job.sessionTarget || 'main'
    }));
  } catch (error) {
    console.warn(`[Parser] Failed to parse cron jobs:`, error.message);
    return [];
  }
}

module.exports = { parseSessions, parseCronJobs };
```

### 4.5. DB 업로드 (lib/uploader.js)

```javascript
const { Client } = require('pg');
const config = require('../config');

async function uploadToDatabase(botData) {
  const client = new Client({
    connectionString: config.DATABASE_URL
  });
  
  await client.connect();
  
  try {
    for (const bot of botData) {
      // bot_status UPSERT
      await client.query(`
        INSERT INTO bot_status (bot_id, last_active, session_count, status, synced_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (bot_id) 
        DO UPDATE SET 
          last_active = EXCLUDED.last_active,
          session_count = EXCLUDED.session_count,
          status = EXCLUDED.status,
          synced_at = NOW()
      `, [bot.botId, bot.lastActive, bot.sessionCount, bot.status]);
      
      // bot_sessions 삭제 후 재삽입
      await client.query('DELETE FROM bot_sessions WHERE bot_id = $1', [bot.botId]);
      for (const session of bot.sessions) {
        await client.query(`
          INSERT INTO bot_sessions (bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [bot.botId, session.sessionKey, session.label, session.kind, session.chatType, session.lastActivity, session.messageCount]);
      }
      
      // bot_cron_jobs 삭제 후 재삽입
      await client.query('DELETE FROM bot_cron_jobs WHERE bot_id = $1', [bot.botId]);
      for (const job of bot.cronJobs) {
        await client.query(`
          INSERT INTO bot_cron_jobs (bot_id, job_id, name, schedule, enabled, last_run, next_run, session_target, synced_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [bot.botId, job.jobId, job.name, JSON.stringify(job.schedule), job.enabled, job.lastRun, job.nextRun, job.sessionTarget]);
      }
    }
  } finally {
    await client.end();
  }
}

module.exports = { uploadToDatabase };
```

### 4.6. 설정 (config.js)

```javascript
module.exports = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://app:password@central-db.semi-dev.internal:5432/appdb',
  SYNC_INTERVAL_MS: parseInt(process.env.SYNC_INTERVAL_MS || '60000', 10) // 1분
};
```

---

## 5. 크론 설정

### 5.1. OpenClaw 크론 사용 (추천)

SEMO 봇 중 하나(예: SemiClaw)의 크론에 등록:

```javascript
// SemiClaw 크론 작업 추가
{
  "name": "sync-bot-status",
  "schedule": {
    "kind": "every",
    "everyMs": 60000 // 1분
  },
  "payload": {
    "kind": "systemEvent",
    "text": "node /path/to/semo-system/sync-agent/sync.js"
  },
  "sessionTarget": "main",
  "enabled": true
}
```

### 5.2. 시스템 크론 사용 (대안)

Mac Mini crontab:

```bash
# crontab -e
* * * * * cd /path/to/semo-system/sync-agent && node sync.js >> /tmp/sync-agent.log 2>&1
```

---

## 6. Dashboard API 변경

### 6.1. Bot API

**기존:**
- OpenClaw Gateway API 호출

**변경 후:**
- PostgreSQL 쿼리

```typescript
// app/api/bots/route.ts
import { Client } from 'pg';

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

### 6.2. Bot Detail API

```typescript
// app/api/bots/[botId]/detail/route.ts
export async function GET(req: Request, { params }: { params: { botId: string } }) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // 세션 조회
  const sessions = await client.query(`
    SELECT * FROM bot_sessions WHERE bot_id = $1 ORDER BY last_activity DESC
  `, [params.botId]);
  
  // 크론 작업 조회
  const cronJobs = await client.query(`
    SELECT * FROM bot_cron_jobs WHERE bot_id = $1 ORDER BY next_run
  `, [params.botId]);
  
  await client.end();
  
  return Response.json({
    sessions: sessions.rows,
    cronJobs: cronJobs.rows
  });
}
```

---

## 7. 배포 및 운영

### 7.1. 초기 설정

1. **DB 스키마 생성** (InfraClaw)
   ```bash
   psql $DATABASE_URL -f semo-system/sync-agent/schema.sql
   ```

2. **Sync Agent 설치** (Mac Mini)
   ```bash
   cd semo-system/sync-agent
   npm install
   ```

3. **환경변수 설정**
   ```bash
   export DATABASE_URL="postgresql://app:password@..."
   ```

4. **크론 등록** (OpenClaw or crontab)

### 7.2. 모니터링

- **Sync Agent 로그:** `/tmp/sync-agent.log`
- **DB 확인:**
  ```sql
  SELECT bot_id, status, synced_at FROM bot_status ORDER BY synced_at DESC;
  ```

### 7.3. 문제 해결

**Sync 실패 시:**
- 로그 확인: `/tmp/sync-agent.log`
- DB 연결 확인: `psql $DATABASE_URL`
- 파일 권한 확인: `~/.openclaw-*` 읽기 권한

**동기화 지연 시:**
- Sync interval 조정 (config.js)
- DB 인덱스 확인

---

## 8. Phase 1 제약사항

- **읽기 전용:** Phase 1에서는 봇 상태 조회만
- **게이트웨이 로그:** 선택적 구현 (Phase 2+)
- **실시간성:** 1~5분 주기 (실시간 아님)

---

**Sync Agent 스펙 작성 완료**  
작성일: 2026-03-07  
작성자: PlanClaw  
버전: 1.0
