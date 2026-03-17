# 08-Job Scheduler: 구현 태스크

> spec.md 기반 구현 체크리스트

---

## Phase 1: 데이터 모델 및 DB

### TASK-JS01: DB 스키마 확장
- [ ] `job_queue` 테이블에 컬럼 추가
  - `retry_count INT DEFAULT 0`
  - `max_retries INT DEFAULT 3`
  - `timeout_at TIMESTAMPTZ`
  - `error_message TEXT`
- [ ] `job_executions` 테이블 생성
- [ ] 인덱스 추가 (status, priority, timeout_at)
- [ ] Supabase 마이그레이션 파일 작성

### TASK-JS02: 타입 정의
- [ ] `JobSchedulerConfig` 인터페이스
- [ ] `JobExecution` 인터페이스
- [ ] `ExecutionStatus` 타입
- [ ] `JobQueueStats` 인터페이스

---

## Phase 2: 코어 서비스

### TASK-JS03: DependencyResolver 구현
- [ ] `canExecute(job)` - 실행 가능 여부 확인
- [ ] `getReadyJobs(jobs)` - 실행 가능한 Job 목록
- [ ] `topologicalSort(jobs)` - 토폴로지 정렬
- [ ] `detectCycles(jobs)` - 순환 의존성 감지
- [ ] 단위 테스트 작성

### TASK-JS04: ExecutionQueue 구현
- [ ] `enqueue(job)` - Job 큐 추가
- [ ] `dequeue()` - 우선순위 기반 추출
- [ ] `getRunningCount()` - 실행 중 Job 수
- [ ] `getRunningByRole(role)` - 역할별 실행 수
- [ ] 역할별 동시 실행 제한 로직
- [ ] 단위 테스트 작성

### TASK-JS05: TimeoutManager 구현
- [ ] `setJobTimeout(jobId, timeout)` - 타임아웃 설정
- [ ] `clearJobTimeout(jobId)` - 타임아웃 해제
- [ ] `checkTimeouts()` - 만료 Job 확인
- [ ] 폴링 루프 (10초 간격)
- [ ] 단위 테스트 작성

### TASK-JS06: RetryManager 구현
- [ ] `shouldRetry(job)` - 재시도 여부 결정
- [ ] `calculateDelay(attempt)` - 지수 백오프 계산
- [ ] `scheduleRetry(job)` - 재시도 스케줄링
- [ ] 재시도 불가 에러 타입 정의
- [ ] 단위 테스트 작성

---

## Phase 3: 스케줄러 루프

### TASK-JS07: SchedulerLoop 구현
- [ ] `start()` - 스케줄러 시작
- [ ] `stop()` - 스케줄러 정지
- [ ] `tick()` - 단일 스케줄링 사이클
- [ ] 폴링 간격 설정 (기본 1초)
- [ ] 에러 핸들링 및 로깅

### TASK-JS08: Job 상태 전이 로직
- [ ] `pending` → `ready` (의존성 해결 시)
- [ ] `ready` → `processing` (실행 시작 시)
- [ ] `processing` → `done` / `failed` / `timeout`
- [ ] 상태 변경 시 Realtime 브로드캐스트
- [ ] 통합 테스트 작성

---

## Phase 4: API 엔드포인트

### TASK-JS09: 스케줄러 관리 API
- [ ] `GET /api/offices/:id/scheduler/status`
- [ ] `POST /api/offices/:id/scheduler/start`
- [ ] `POST /api/offices/:id/scheduler/stop`
- [ ] `GET /api/offices/:id/scheduler/stats`

### TASK-JS10: Job 제어 API
- [ ] `POST /api/offices/:id/jobs/:jobId/cancel`
- [ ] `POST /api/offices/:id/jobs/:jobId/retry`
- [ ] `POST /api/offices/:id/jobs/batch-cancel`
- [ ] 입력 검증 및 에러 응답

---

## Phase 5: 통합

### TASK-JS11: office-server 통합
- [ ] 스케줄러 서비스 초기화
- [ ] 오피스 생성 시 스케줄러 설정
- [ ] 오피스 삭제 시 스케줄러 정리

### TASK-JS12: Session Execution 연동
- [ ] Job 실행 시 세션 생성 트리거
- [ ] 세션 완료 콜백 처리
- [ ] 세션 타임아웃 처리

### TASK-JS13: Realtime 연동
- [ ] Job 상태 변경 브로드캐스트
- [ ] 스케줄러 통계 브로드캐스트
- [ ] UI 연동 테스트

---

## Phase 6: 테스트 및 문서화

### TASK-JS14: 테스트
- [ ] 단위 테스트 (각 서비스)
- [ ] 통합 테스트 (전체 흐름)
- [ ] 스트레스 테스트 (동시 Job 100개)
- [ ] 타임아웃 시나리오 테스트

### TASK-JS15: 문서화
- [ ] API 문서 업데이트
- [ ] 설정 가이드 작성
- [ ] 트러블슈팅 가이드

---

## Dependencies

| 태스크 | 의존 |
|--------|------|
| TASK-JS03~06 | TASK-JS01, JS02 |
| TASK-JS07~08 | TASK-JS03~06 |
| TASK-JS09~10 | TASK-JS07 |
| TASK-JS11~13 | TASK-JS09~10 |
| TASK-JS14~15 | 전체 |

---

## Acceptance Criteria

- [ ] 의존성 있는 Job이 선행 Job 완료 후 실행됨
- [ ] 동시 실행 제한이 정상 동작함
- [ ] 타임아웃 Job이 정확히 감지됨
- [ ] 재시도가 지수 백오프로 동작함
- [ ] 우선순위가 정확히 반영됨
- [ ] 일괄 취소가 전파됨
