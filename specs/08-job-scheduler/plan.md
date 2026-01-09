# 08-Job Scheduler: 구현 계획

> Job 스케줄링 및 큐 관리, 의존성 기반 실행 순서 결정

---

## 요구사항 요약

- 의존성 기반 Job 활성화 (pending → ready)
- 병렬 실행 제한 (Office당 최대 3개)
- Job 타임아웃 처리 (기본 30분)
- 재시도 정책 (최대 2회, 지수 백오프)
- Job 우선순위 관리
- Job 일괄 취소

---

## 영향 범위 분석

| 영역 | 변경 유형 | 설명 |
|------|----------|---------|
| `packages/office-server/src/api/scheduler/` | 신규 | 스케줄러 API |
| `packages/office-server/src/services/scheduler/` | 신규 | DependencyResolver, ExecutionQueue, TimeoutManager, SchedulerLoop |
| `packages/office-server/src/db/migrations/` | 수정 | job_executions 테이블, job_queue 확장 |
| `packages/office-server/src/workers/` | 신규 | Scheduler 워커 프로세스 |

---

## 구현 단계

### Phase 1: DB 스키마 및 모델 정의

**작업 내용**:
1. `job_executions` 테이블 생성
   - 실행 이력 추적 (attempt, started_at, timeout_at, status, error_message)
2. `job_queue` 테이블 확장
   - retry_count, timeout_ms, cancelled_at 필드 추가
   - status 타입 확장 (cancelled, timeout 추가)
3. TypeScript 인터페이스 정의

**예상 시간**: 1일

**체크리스트**:
- [ ] `job_executions` 테이블 CREATE 마이그레이션
- [ ] `job_queue` 테이블 ALTER 마이그레이션 (retry_count, timeout_ms, cancelled_at)
- [ ] TypeScript 인터페이스 (`JobExecution`, `JobSchedulerConfig`, `JobQueueStats`)
- [ ] 마이그레이션 테스트

---

### Phase 2: DependencyResolver

**작업 내용**:
1. `DependencyResolver` 클래스 작성
   - `getReadyJobs(officeId)` - pending 중 의존성 완료된 Job 조회
   - `detectCycle(jobs)` - 순환 의존성 감지 (토폴로지 정렬)
   - `getExecutionOrder(jobs)` - 병렬 실행 그룹 계산
2. 의존성 확인 로직
   - depends_on 배열의 모든 Job이 done인지 확인

**예상 시간**: 2일

**체크리스트**:
- [ ] `DependencyResolver` 클래스
- [ ] `getReadyJobs()` 메서드 (의존성 필터링)
- [ ] `detectCycle()` 토폴로지 정렬 알고리즘
- [ ] `getExecutionOrder()` 병렬 그룹 계산
- [ ] 단위 테스트 (순환 의존성 케이스 포함)

---

### Phase 3: ExecutionQueue

**작업 내용**:
1. `ExecutionQueue` 클래스 작성
   - `getAvailableSlots(officeId)` - 가용 슬롯 수 확인
   - `executeJob(job)` - Job 실행 시작
   - `onJobComplete(jobId, success, error)` - 완료 처리
   - `handleFailure(jobId, error)` - 실패 처리 (재시도/영구 실패)
2. 실행 제한 관리
   - maxConcurrentJobs (기본 3)
   - maxConcurrentByRole (역할별)
3. 우선순위 기반 실행 순서

**예상 시간**: 3일

**체크리스트**:
- [ ] `ExecutionQueue` 클래스
- [ ] `getAvailableSlots()` 메서드
- [ ] `executeJob()` - 실행 기록 생성, 상태 업데이트
- [ ] `onJobComplete()` - 완료/실패 분기
- [ ] `handleFailure()` - 재시도 로직
- [ ] `calculateRetryDelay()` - 지수 백오프
- [ ] `notifyFailure()` - 영구 실패 알림
- [ ] SessionOrchestrator 연동
- [ ] 단위 테스트

---

### Phase 4: TimeoutManager

**작업 내용**:
1. `TimeoutManager` 클래스 작성
   - `setTimer(jobId, timeoutAt, callback)` - 타이머 설정
   - `clearTimer(jobId)` - 타이머 취소
   - `handleTimeout(jobId)` - 타임아웃 처리
2. 타임아웃 시 세션 cancel 명령 전송
3. 타임아웃된 Job 재시도 또는 실패 처리

**예상 시간**: 1일

**체크리스트**:
- [ ] `TimeoutManager` 클래스
- [ ] `setTimer()` 메서드 (setTimeout 래퍼)
- [ ] `clearTimer()` 메서드
- [ ] `handleTimeout()` - 세션 cancel, 상태 업데이트
- [ ] 타이머 맵 관리 (jobId → Timer)
- [ ] 단위 테스트

---

### Phase 5: SchedulerLoop

**작업 내용**:
1. `SchedulerLoop` 클래스 작성
   - `start()` / `stop()` - 스케줄러 시작/중지
   - `tick()` - 스케줄링 사이클 (5초마다)
   - `processOffice(officeId)` - Office별 스케줄링
2. 스케줄링 로직
   - pending → ready 전환
   - ready Job 실행 (가용 슬롯 수만큼)
3. 다중 Office 지원

**예상 시간**: 2일

**체크리스트**:
- [ ] `SchedulerLoop` 클래스
- [ ] `start()` / `stop()` 메서드
- [ ] `tick()` 스케줄링 사이클
- [ ] `processOffice()` - Office별 로직
- [ ] `getActiveOffices()` - 활성 Office 목록 조회
- [ ] 우선순위 정렬 (priority, created_at)
- [ ] 단위 테스트

---

### Phase 6: API 엔드포인트

**작업 내용**:
1. 스케줄러 관리 API (4개 엔드포인트)
   - `GET /api/offices/:id/scheduler/stats` - 큐 통계
   - `GET /api/offices/:id/scheduler/config` - 설정 조회
   - `PATCH /api/offices/:id/scheduler/config` - 설정 변경
   - `POST /api/offices/:id/scheduler/process` - 수동 트리거
2. Job 제어 API (4개 엔드포인트)
   - `POST /api/offices/:id/jobs/:jobId/retry` - 재시도
   - `POST /api/offices/:id/jobs/:jobId/cancel` - 취소
   - `POST /api/offices/:id/jobs/cancel-all` - 전체 취소
   - `PATCH /api/offices/:id/jobs/:jobId/priority` - 우선순위 변경

**예상 시간**: 2일

**체크리스트**:
- [ ] 스케줄러 관리 API (4개 엔드포인트)
- [ ] Job 제어 API (4개 엔드포인트)
- [ ] 요청 검증 (Zod)
- [ ] 에러 핸들링
- [ ] API 테스트

---

### Phase 7: Scheduler 워커 프로세스

**작업 내용**:
1. 별도 워커 프로세스로 Scheduler 실행
   - Express 서버와 독립적으로 동작
   - 장애 발생 시 자동 재시작
2. 워커 헬스 체크 API
3. 프로세스 매니저 통합 (PM2)

**예상 시간**: 1일

**체크리스트**:
- [ ] `workers/scheduler.ts` 워커 프로세스
- [ ] 워커 시작/중지 스크립트
- [ ] 헬스 체크 엔드포인트 (`/health`)
- [ ] PM2 ecosystem 설정
- [ ] 워커 재시작 정책

---

### Phase 8: 통합 및 이벤트 알림

**작업 내용**:
1. Session Execution 연동
   - OutputMonitor 완료 감지 → onJobComplete 호출
   - 세션 실행 시작 시 Scheduler 알림
2. 이벤트 브로드캐스트
   - job_started, job_completed, job_failed, job_timeout, job_retrying
3. Slack 알림 (선택적)
   - 영구 실패 시 알림

**예상 시간**: 1일

**체크리스트**:
- [ ] `onJobComplete()` 호출 통합 (OutputMonitor → Scheduler)
- [ ] 이벤트 브로드캐스트 (Supabase Realtime)
- [ ] `SchedulerEvent` 인터페이스
- [ ] Slack 알림 (notify-slack 연동)
- [ ] 이벤트 로깅

---

### Phase 9: 통합 테스트

**작업 내용**:
1. E2E 시나리오
   - Job 생성 → 의존성 확인 → 순서대로 실행 → 완료
   - 병렬 실행 제한 테스트 (최대 3개)
   - 타임아웃 테스트
   - 재시도 테스트 (지수 백오프)
2. 실패 케이스 테스트
   - 타임아웃, 세션 오류, 영구 실패
3. 순환 의존성 감지 테스트

**예상 시간**: 2일

**체크리스트**:
- [ ] `e2e/job-scheduler.spec.ts`
- [ ] 의존성 순서 실행 테스트
- [ ] 병렬 실행 제한 테스트
- [ ] 타임아웃 처리 테스트
- [ ] 재시도 정책 테스트 (지수 백오프)
- [ ] 순환 의존성 감지 테스트
- [ ] Job 취소 테스트
- [ ] 우선순위 정렬 테스트
- [ ] 워커 재시작 테스트

---

## 의존성

### 외부 라이브러리
- (없음, 내부 로직 사용)

### 내부 모듈
- **02-Task Decomposer**: Job 생성 (depends_on 설정)
- **04-Session Execution**: Job 실행 위임 (SessionOrchestrator)
- **05-PR Workflow**: Job 완료 시 PR 생성 트리거
- **07-Agent Communication**: 핸드오프 시 Job 담당자 변경

---

## 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 의존성 해결 오류 (순환 의존성) | 높음 | 토폴로지 정렬 검증, Task Decomposer 단계에서 차단 |
| 스케줄러 워커 크래시 | 중간 | PM2 자동 재시작, 헬스 체크 |
| 타임아웃 부정확 (긴 작업) | 중간 | 역할별 타임아웃 권장값 제공, 동적 조정 API |
| 동시 실행 제한 초과 | 낮음 | 엄격한 슬롯 관리, 락 메커니즘 |

---

## 예상 결과물

- [ ] `DependencyResolver` (의존성 확인)
- [ ] `ExecutionQueue` (실행 큐 관리)
- [ ] `TimeoutManager` (타임아웃 처리)
- [ ] `SchedulerLoop` (스케줄링 사이클)
- [ ] 스케줄러 API (8개 엔드포인트)
- [ ] DB 마이그레이션 (job_executions, job_queue 확장)
- [ ] Scheduler 워커 프로세스
- [ ] 이벤트 브로드캐스트 시스템
- [ ] 통합 테스트 스위트

---

## 다음 단계

✅ 08-Job Scheduler 완료 후:
- **성능 최적화** (대규모 Office 대응, 수평 확장)
- **모니터링 대시보드** (큐 상태, 실행 통계)
- **스케줄러 정책 튜닝** (역할별 타임아웃, 재시도 전략)
