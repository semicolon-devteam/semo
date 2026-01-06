# 08-Job Scheduler: Job 스케줄링 및 큐 관리

> 의존성 기반 Job 실행 순서 결정, 큐 관리, 타임아웃 처리

---

## Overview

Job Scheduler는 Task Decomposer가 생성한 Job들을 의존성 순서에 따라 실행합니다.
병렬 실행 제한, 타임아웃, 재시도 정책을 관리하여 안정적인 작업 수행을 보장합니다.

### 워크플로우

```text
[Task Decomposer]
      │
      │ Jobs 생성 (status: pending)
      ▼
┌─────────────────────────────────────────────────────────┐
│                    Job Scheduler                         │
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │ Dependency      │    │ Execution       │            │
│  │ Resolver        │───▶│ Queue           │            │
│  │ (의존성 확인)    │    │ (실행 대기열)    │            │
│  └─────────────────┘    └────────┬────────┘            │
│                                  │                      │
│                    ┌─────────────┼─────────────┐       │
│                    ▼             ▼             ▼       │
│              ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│              │ Worker 1 │ │ Worker 2 │ │ Worker 3 │   │
│              │ (FE Job) │ │ (BE Job) │ │ (QA Job) │   │
│              └──────────┘ └──────────┘ └──────────┘   │
│                    │             │             │       │
│                    └─────────────┴─────────────┘       │
│                                  │                      │
│                    ┌─────────────┴─────────────┐       │
│                    │      Completion Handler    │       │
│                    │   (완료/실패/타임아웃)      │       │
│                    └─────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [Session Executor]
```

---

## User Stories

### US-JS01: 의존성 기반 Job 활성화

> "의존성이 없거나 모든 선행 Job이 완료된 Job을 ready 상태로 전환한다"

**AC**:
- 의존성 없는 Job → 생성 즉시 ready
- 의존성 있는 Job → 선행 Job 완료 후 ready
- depends_on 배열의 모든 Job이 done일 때만 전환
- 순환 의존성 감지 시 오류 반환

---

### US-JS02: 병렬 실행 제한

> "동시에 실행되는 Job 수를 제한하여 리소스를 관리한다"

**AC**:
- Office당 최대 동시 실행 Job 수 설정 (기본: 3)
- ready 상태 Job이 제한 초과 시 큐에서 대기
- 역할별 동시 실행 제한 옵션 (예: FE 최대 1개)
- 우선순위 기반 실행 순서

---

### US-JS03: Job 타임아웃

> "지정된 시간 내 완료되지 않은 Job을 타임아웃 처리한다"

**AC**:
- Job별 타임아웃 설정 (기본: 30분)
- 타임아웃 시 Job 상태 → failed
- 실행 중인 세션에 cancel 명령 전송
- 타임아웃 이벤트 로깅

---

### US-JS04: 재시도 정책

> "실패한 Job을 설정된 정책에 따라 재시도한다"

**AC**:
- 최대 재시도 횟수 (기본: 2)
- 재시도 간격 (지수 백오프: 1분, 2분, 4분)
- 재시도 가능 실패 유형 정의 (타임아웃, 세션 오류)
- 영구 실패 시 사용자 알림

---

### US-JS05: Job 우선순위

> "우선순위에 따라 Job 실행 순서를 결정한다"

**AC**:
- priority 필드 기반 정렬 (낮을수록 먼저)
- 같은 우선순위 시 생성 시간순
- 긴급 Job 우선 처리 옵션
- 우선순위 동적 조정 API

---

### US-JS06: Job 일괄 취소

> "특정 조건의 Job들을 일괄 취소한다"

**AC**:
- Office 내 모든 pending/ready Job 취소
- 특정 작업(task)의 모든 Job 취소
- 실행 중 Job도 cancel 명령으로 중단
- 취소된 Job 상태 → cancelled

---

## Data Models

### JobSchedulerConfig

```typescript
interface JobSchedulerConfig {
  maxConcurrentJobs: number;       // Office당 최대 동시 실행 (기본: 3)
  maxConcurrentByRole?: {          // 역할별 최대 동시 실행
    [role: string]: number;
  };
  defaultTimeout: number;          // 기본 타임아웃 ms (기본: 1800000 = 30분)
  maxRetries: number;              // 최대 재시도 (기본: 2)
  retryBackoff: 'linear' | 'exponential';  // 백오프 전략
  retryBaseDelay: number;          // 기본 재시도 대기 ms (기본: 60000 = 1분)
}
```

### JobExecution

```typescript
interface JobExecution {
  job_id: string;
  attempt: number;                 // 현재 시도 횟수 (1부터)
  started_at: string;
  timeout_at: string;              // 타임아웃 예정 시간
  session_id?: string;
  status: ExecutionStatus;
}

type ExecutionStatus =
  | 'running'      // 실행 중
  | 'completed'    // 완료
  | 'failed'       // 실패
  | 'timeout'      // 타임아웃
  | 'cancelled';   // 취소됨
```

### JobQueueStats

```typescript
interface JobQueueStats {
  office_id: string;
  pending: number;
  ready: number;
  processing: number;
  done: number;
  failed: number;
  cancelled: number;
  avg_completion_time: number;     // ms
}
```

---

## DB Schema

### 테이블: job_executions

```sql
CREATE TABLE job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES job_queue(id) ON DELETE CASCADE,
  attempt INT NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timeout_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  session_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_executions_job ON job_executions(job_id);
CREATE INDEX idx_job_executions_status ON job_executions(status);
```

### job_queue 확장

```sql
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS
  retry_count INT DEFAULT 0;

ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS
  timeout_ms INT DEFAULT 1800000;

ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS
  cancelled_at TIMESTAMPTZ;

-- 새 상태 추가
-- status: 'pending' | 'ready' | 'processing' | 'done' | 'failed' | 'cancelled' | 'timeout'
```

---

## API Endpoints

### 스케줄러 관리

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices/:id/scheduler/stats` | 큐 통계 조회 |
| GET | `/api/offices/:id/scheduler/config` | 스케줄러 설정 조회 |
| PATCH | `/api/offices/:id/scheduler/config` | 스케줄러 설정 변경 |
| POST | `/api/offices/:id/scheduler/process` | 수동 스케줄링 트리거 |

### Job 제어

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices/:id/jobs/:jobId/retry` | Job 재시도 |
| POST | `/api/offices/:id/jobs/:jobId/cancel` | Job 취소 |
| POST | `/api/offices/:id/jobs/cancel-all` | 전체 Job 취소 |
| PATCH | `/api/offices/:id/jobs/:jobId/priority` | 우선순위 변경 |

---

## Scheduler Service

### DependencyResolver

```typescript
class DependencyResolver {
  // 의존성 확인하여 ready로 전환할 Job 조회
  async getReadyJobs(officeId: string): Promise<Job[]> {
    const jobs = await this.getJobsByOffice(officeId);

    return jobs.filter(job => {
      // 이미 처리 중이거나 완료된 Job 제외
      if (job.status !== 'pending') return false;

      // 의존성 없으면 ready
      if (!job.depends_on?.length) return true;

      // 모든 의존 Job이 완료됨
      return job.depends_on.every(depId => {
        const depJob = jobs.find(j => j.id === depId);
        return depJob?.status === 'done';
      });
    });
  }

  // 순환 의존성 감지
  detectCycle(jobs: Job[]): string[] | null {
    // 토폴로지 정렬로 순환 감지
    // 순환 발견 시 관련 Job ID 배열 반환
  }
}
```

### ExecutionQueue

```typescript
class ExecutionQueue {
  constructor(
    private config: JobSchedulerConfig,
    private sessionExecutor: SessionOrchestrator
  ) {}

  // 실행 가능한 Job 수 확인
  getAvailableSlots(officeId: string): number {
    const running = this.getRunningCount(officeId);
    return this.config.maxConcurrentJobs - running;
  }

  // Job 실행 시작
  async executeJob(job: Job): Promise<void> {
    // 1. 실행 기록 생성
    const execution = await this.createExecution(job);

    // 2. Job 상태 업데이트
    await this.updateJobStatus(job.id, 'processing');

    // 3. 타임아웃 타이머 설정
    this.setTimeoutTimer(job.id, execution.timeout_at);

    // 4. 세션 실행 위임
    await this.sessionExecutor.executeJob(job);
  }

  // 실행 완료 처리
  async onJobComplete(jobId: string, success: boolean, error?: string): Promise<void> {
    if (success) {
      await this.updateJobStatus(jobId, 'done');
    } else {
      await this.handleFailure(jobId, error);
    }

    // 다음 Job 스케줄링 트리거
    await this.scheduleNext(jobId);
  }

  // 실패 처리 (재시도 또는 영구 실패)
  private async handleFailure(jobId: string, error?: string): Promise<void> {
    const job = await this.getJob(jobId);

    if (job.retry_count < this.config.maxRetries) {
      // 재시도 스케줄링
      const delay = this.calculateRetryDelay(job.retry_count);
      await this.scheduleRetry(job, delay);
    } else {
      // 영구 실패
      await this.updateJobStatus(jobId, 'failed');
      await this.notifyFailure(job, error);
    }
  }
}
```

### TimeoutManager

```typescript
class TimeoutManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  // 타임아웃 타이머 설정
  setTimer(jobId: string, timeoutAt: Date, callback: () => void): void {
    const delay = timeoutAt.getTime() - Date.now();

    const timer = setTimeout(() => {
      this.timers.delete(jobId);
      callback();
    }, delay);

    this.timers.set(jobId, timer);
  }

  // 타이머 취소
  clearTimer(jobId: string): void {
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
  }

  // 타임아웃 처리
  async handleTimeout(jobId: string): Promise<void> {
    // 1. 세션 cancel 명령
    await this.sessionExecutor.cancelJob(jobId);

    // 2. Job 상태 업데이트
    await this.updateJobStatus(jobId, 'timeout');

    // 3. 실행 기록 업데이트
    await this.updateExecution(jobId, 'timeout', 'Job execution timed out');

    // 4. 재시도 또는 실패 처리
    await this.executionQueue.handleFailure(jobId, 'timeout');
  }
}
```

### SchedulerLoop

```typescript
class SchedulerLoop {
  private running = false;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private dependencyResolver: DependencyResolver,
    private executionQueue: ExecutionQueue,
    private pollInterval: number = 5000  // 5초
  ) {}

  // 스케줄러 시작
  start(): void {
    if (this.running) return;

    this.running = true;
    this.interval = setInterval(() => this.tick(), this.pollInterval);
    this.tick();  // 즉시 첫 실행
  }

  // 스케줄러 중지
  stop(): void {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  // 스케줄링 사이클
  private async tick(): Promise<void> {
    const offices = await this.getActiveOffices();

    for (const office of offices) {
      await this.processOffice(office.id);
    }
  }

  // Office별 스케줄링
  private async processOffice(officeId: string): Promise<void> {
    // 1. 가용 슬롯 확인
    const slots = this.executionQueue.getAvailableSlots(officeId);
    if (slots <= 0) return;

    // 2. ready 상태로 전환할 Job 확인
    const readyJobs = await this.dependencyResolver.getReadyJobs(officeId);

    // 3. pending → ready 전환
    for (const job of readyJobs) {
      await this.updateJobStatus(job.id, 'ready');
    }

    // 4. ready Job 실행 (슬롯 수만큼)
    const toExecute = await this.getReadyJobs(officeId, slots);

    for (const job of toExecute) {
      await this.executionQueue.executeJob(job);
    }
  }
}
```

---

## Sequence Diagram

### Job 스케줄링 플로우

```text
Task Decomposer    Scheduler         DB           Session Executor
      │                │               │                 │
      │ Insert Jobs    │               │                 │
      │ (pending)      │               │                 │
      │───────────────▶│               │                 │
      │                │               │                 │
      │                │ Check deps    │                 │
      │                │──────────────▶│                 │
      │                │               │                 │
      │                │◀──────────────│                 │
      │                │ ready Jobs    │                 │
      │                │               │                 │
      │                │ Check slots   │                 │
      │                │──────────────▶│                 │
      │                │               │                 │
      │                │◀──────────────│                 │
      │                │ 2 available   │                 │
      │                │               │                 │
      │                │ Execute Job   │                 │
      │                │───────────────│────────────────▶│
      │                │               │                 │
      │                │               │ Update status   │
      │                │               │◀────────────────│
      │                │               │ (processing)    │
      │                │               │                 │
      │                │               │   [작업 수행]    │
      │                │               │                 │
      │                │ Job Complete  │                 │
      │                │◀──────────────│─────────────────│
      │                │               │                 │
      │                │ Update status │                 │
      │                │──────────────▶│                 │
      │                │ (done)        │                 │
      │                │               │                 │
      │                │ Schedule next │                 │
      │                │──────────────▶│                 │
```

---

## Configuration

### 기본 설정

```typescript
const defaultSchedulerConfig: JobSchedulerConfig = {
  maxConcurrentJobs: 3,
  maxConcurrentByRole: {
    'FE': 1,
    'BE': 1,
    'QA': 1,
    'DevOps': 1
  },
  defaultTimeout: 30 * 60 * 1000,  // 30분
  maxRetries: 2,
  retryBackoff: 'exponential',
  retryBaseDelay: 60 * 1000,       // 1분
};
```

### 역할별 타임아웃 권장값

| 역할 | 타임아웃 | 이유 |
|------|----------|------|
| PO | 15분 | 문서 작업, 빠른 완료 |
| Architect | 20분 | 설계 문서 |
| FE | 30분 | UI 구현 |
| BE | 30분 | API 구현 |
| QA | 45분 | 테스트 작성 + 실행 |
| DevOps | 20분 | 설정 작업 |

---

## Error Handling

### 실패 유형별 처리

| 실패 유형 | 재시도 | 처리 |
|----------|--------|------|
| 타임아웃 | O | 세션 재생성 후 재시도 |
| 세션 오류 | O | 새 세션으로 재시도 |
| Git 충돌 | X | 사용자 개입 필요 |
| 권한 오류 | X | 설정 확인 필요 |
| 의존성 실패 | X | 선행 Job 해결 필요 |

### 알림 이벤트

```typescript
interface SchedulerEvent {
  type: 'job_started' | 'job_completed' | 'job_failed' | 'job_timeout' | 'job_retrying';
  job_id: string;
  office_id: string;
  details: Record<string, unknown>;
  timestamp: string;
}
```

---

## Related Specs

- [02-Task Decomposer](../02-task-decomposer/spec.md) - Job 생성
- [04-Session Execution](../04-session-execution/spec.md) - Job 실행
- [05-PR Workflow](../05-pr-workflow/spec.md) - Job 완료 후 PR
