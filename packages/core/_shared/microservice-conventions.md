# 마이크로서비스 규약

> Semicolon 마이크로서비스 공통 규약 (ms-* 레포지토리)

## 1. 서비스 코드 체계

| 서비스 | 코드 | 테이블 Prefix | 스키마 | 포트 |
|--------|------|---------------|--------|------|
| ms-notifier | NF | nf_ | notifier | 3000 |
| ms-scheduler | SC | sc_ | scheduler | 3003 |
| ms-ledger | LG | lg_ | ledger | 3000 |
| ms-media-processor | MP | - | - | 3001 |
| ms-crawler | CR | - | - | 3333 |

**네이밍 규칙**:
- 서비스 코드: 2글자 대문자
- 테이블 Prefix: `{코드 소문자}_`
- 스키마: 서비스 전체 이름 (소문자)

---

## 2. 테이블 네이밍

### 2.1 형식

```text
{서비스코드}_{도메인}_{옵션}

예시:
- sc_schedules         # 스케줄 정의
- sc_executions        # 실행 로그
- lg_transactions      # 거래 내역
- lg_audit_logs        # 감사 로그
```

### 2.2 공통 테이블

각 서비스에 권장되는 공통 테이블:

| 테이블 | 용도 |
|--------|------|
| `{prefix}configs` | 서비스 설정 |
| `{prefix}audit_logs` | 감사 로그 |
| `{prefix}jobs_outbox` | 이벤트 발행 (Outbox 패턴) |

---

## 3. 스키마 분리

### 3.1 원칙

- 각 마이크로서비스는 **독립 PostgreSQL 스키마** 사용
- core-supabase의 `public` 스키마와 분리
- 교차 스키마 조인 최소화

### 3.2 설정

```sql
-- 스키마 생성
CREATE SCHEMA IF NOT EXISTS scheduler;
CREATE SCHEMA IF NOT EXISTS ledger;
CREATE SCHEMA IF NOT EXISTS notifier;

-- 앱 유저 권한
GRANT USAGE ON SCHEMA scheduler TO scheduler_app;
GRANT ALL ON ALL TABLES IN SCHEMA scheduler TO scheduler_app;
```

### 3.3 Prisma 설정

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["scheduler"]  // 서비스별 스키마
}

model Schedule {
  @@schema("scheduler")
  @@map("sc_schedules")
}
```

---

## 4. 이벤트 봉투 표준

### 4.1 구조

```typescript
interface EventEnvelope {
  metadata: {
    eventId: string;           // UUID
    service: string;           // 발신 서비스명
    type: string;              // 이벤트 유형
    severity: 'info' | 'warning' | 'error' | 'critical';
    occurredAt: string;        // ISO 8601
  };
  context: {
    env: 'development' | 'staging' | 'production';
    tenantId?: string;
    traceId?: string;
    resource?: { type: string; id: string };
  };
  data: Record<string, unknown>;  // 서비스별 페이로드
  notification: {
    channels: string[];           // ['slack', 'telegram', 'kakao']
    targets: string[];            // 수신 대상
    template?: string;
    policy?: {
      throttle?: { maxPerHour: number; maxPerDay: number };
      retry?: { maxAttempts: number; backoffMs: number };
    };
  };
}
```

### 4.2 예시

```json
{
  "metadata": {
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "service": "scheduler",
    "type": "job.failed",
    "severity": "error",
    "occurredAt": "2024-12-05T10:30:00Z"
  },
  "context": {
    "env": "production",
    "traceId": "abc123",
    "resource": { "type": "job", "id": "job-456" }
  },
  "data": {
    "jobName": "daily-report",
    "error": "Connection timeout"
  },
  "notification": {
    "channels": ["slack"],
    "targets": ["#_협업"],
    "policy": {
      "retry": { "maxAttempts": 3, "backoffMs": 1000 }
    }
  }
}
```

---

## 5. API 엔드포인트 패턴

### 5.1 표준 경로

```text
/api/v1/{domain}           # 목록 조회, 생성
/api/v1/{domain}/:id       # 단일 조회, 수정, 삭제
/api/v1/{domain}/:id/{action}  # 커스텀 액션

/api/health                # 헬스체크 (필수)
/api/statistics            # 통계 (선택)
/api/jobs                  # 작업 큐 상태 (워커 있는 경우)
```

### 5.2 헬스체크 응답

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

---

## 6. 백그라운드 워커 패턴

### 6.1 환경 변수

```bash
JOB_POLL_INTERVAL=1000     # 폴링 간격 (ms)
JOB_BATCH_SIZE=10          # 배치 크기
JOB_MAX_RETRIES=3          # 최대 재시도
WORKER_CONCURRENCY=5       # 동시 작업 수
```

### 6.2 재시도 로직

```typescript
// 지수 백오프
const backoffMs = baseBackoff * Math.pow(2, attempt - 1);

// 재시도 조건
if (attempt < maxRetries && isRetryableError(error)) {
  await delay(backoffMs);
  return retry();
}
```

---

## 7. 디렉토리 구조 (권장)

```text
src/
├── app/              # Next.js App Router
│   ├── api/         # API 라우트
│   └── dashboard/   # 대시보드 UI (선택)
├── services/        # 비즈니스 로직
├── workers/         # 백그라운드 워커
├── adapters/        # 외부 연동 어댑터
├── repositories/    # 데이터 액세스 레이어
├── libs/            # 유틸리티
└── types/           # TypeScript 타입
```

---

## 8. 참조

- [core-supabase](https://github.com/semicolon-devteam/core-supabase) - 중앙 DB
- [core-compose](https://github.com/semicolon-devteam/core-compose) - Docker 오케스트레이션
- [ms-notifier](https://github.com/semicolon-devteam/ms-notifier) - 알림 서비스 (레퍼런스)
