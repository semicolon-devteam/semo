# 02-Task Decomposer: 구현 계획

> 자연어 요청을 역할별 Job으로 분해하고 의존성 그래프 생성

---

## 요구사항 요약

- Decomposer Agent 세션 생성 및 관리
- 자연어 → Job 분해 (Claude Code CLI 기반)
- 프로젝트 컨텍스트 자동 분석
- 역할별 Job 매칭 (Persona scope_patterns 활용)
- 의존성 그래프 생성 (DAG)
- Job Scheduler 연동

---

## 영향 범위 분석

| 영역 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/office-server/src/api/tasks/` | 신규 | Task 분해 API |
| `packages/office-server/src/services/decomposer/` | 신규 | TaskDecomposer, DependencyGraphBuilder |
| `packages/office-server/src/services/session/` | 수정 | Decomposer 세션 관리 추가 |
| `packages/office-server/src/db/migrations/` | 수정 | job_queue 테이블 추가 |
| `packages/office-web/src/components/TaskInput.tsx` | 신규 | 작업 요청 입력 UI |
| `packages/office-web/src/components/DecompositionPreview.tsx` | 신규 | 분해 결과 미리보기 |

---

## 구현 단계

### Phase 1: Decomposer Persona 및 세션 설정

**작업 내용**:
1. Decomposer Persona 시드 데이터 추가
   - `role`: `Decomposer`
   - `name`: `김분해`
   - `persona_prompt`: 작업 분해 전문가 프롬프트 작성
   - `scope_patterns`: `['*']` (모든 파일 분석 가능)
   - `core_skills`: `['planner']`
2. Decomposer 전용 세션 관리 로직

**예상 시간**: 1일

**체크리스트**:
- [ ] `supabase/seed.sql`에 Decomposer Persona 추가
- [ ] `SessionManager.createDecomposerSession()` 함수 작성
- [ ] Office당 하나의 Decomposer 세션 유지 로직
- [ ] 메인 레포에서 실행 (Worktree 미사용)

---

### Phase 2: 분해 로직 구현

**작업 내용**:
1. `TaskDecomposer` 서비스 작성
   - `decompose(request: DecompositionRequest)` 메서드
   - 프로젝트 컨텍스트 수집 (`package.json`, 디렉토리 구조)
   - 분해 프롬프트 생성
   - Claude Code 세션에 프롬프트 전송
2. 출력 파싱
   - `[SEMO:DECOMPOSE_DONE]` 패턴 감지
   - JSON 형식 DecompositionResult 파싱

**예상 시간**: 3일

**체크리스트**:
- [ ] `TaskDecomposer` 클래스 작성
- [ ] `buildDecompositionPrompt()` 함수
- [ ] `parseDecompositionResult()` 파서
- [ ] 프로젝트 컨텍스트 분석 함수 (`analyzeProject()`)
- [ ] 타임아웃 60초 설정
- [ ] 단위 테스트 (Mock 세션)

---

### Phase 3: 의존성 그래프 생성

**작업 내용**:
1. `DependencyGraphBuilder` 작성
   - 의존성 추론 규칙 구현
   - 순환 의존성 감지 (토폴로지 정렬)
   - 실행 순서 계산 (병렬 실행 그룹)

**예상 시간**: 2일

**체크리스트**:
- [ ] `DependencyGraphBuilder` 클래스
- [ ] `inferDependencies(jobs: DecomposedJob[])` 메서드
- [ ] `detectCycle(graph: DependencyEdge[])` 함수
- [ ] `calculateExecutionOrder(jobs, graph)` 함수
- [ ] 의존성 규칙 테스트 (QA는 FE/BE 후 등)

---

### Phase 4: Job Scheduler 연동

**작업 내용**:
1. Job DB 저장
   - DecompositionResult → job_queue INSERT
   - `status`: `pending`
   - `depends_on`: UUID 배열
2. Scheduler 시작 트리거

**예상 시간**: 1일

**체크리스트**:
- [ ] `enqueueJobs(officeId, jobs)` 함수
- [ ] `setDependency(fromJobId, toJobId)` 함수
- [ ] Job Scheduler `start(officeId)` 호출
- [ ] 트랜잭션 처리 (모든 Job이 성공적으로 저장되어야 함)

---

### Phase 5: API 엔드포인트

**작업 내용**:
1. Task 요청 API
   - `POST /api/offices/:id/tasks`
   - Body: `{ task: string, context?: {...} }`
   - Response: `{ summary, jobs, dependencyGraph, executionOrder }`
2. Job 목록 API
   - `GET /api/offices/:id/jobs`
   - Query: `?status=pending`
3. Job 상세 API
   - `GET /api/offices/:id/jobs/:jobId`

**예상 시간**: 1일

**체크리스트**:
- [ ] `POST /api/offices/:id/tasks` 엔드포인트
- [ ] `GET /api/offices/:id/jobs` 엔드포인트
- [ ] `GET /api/offices/:id/jobs/:jobId` 엔드포인트
- [ ] 요청 검증 (Zod 스키마)
- [ ] 에러 핸들링

---

### Phase 6: UI 컴포넌트

**작업 내용**:
1. 작업 입력 컴포넌트
   - 텍스트 입력창
   - 전송 버튼
   - 로딩 상태 표시
2. 분해 결과 미리보기
   - Job 카드 목록
   - 의존성 화살표 시각화 (간단한 SVG)
   - 승인/수정 옵션

**예상 시간**: 2일

**체크리스트**:
- [ ] `TaskInput` 컴포넌트
- [ ] `DecompositionPreview` 컴포넌트
- [ ] `JobCard` 컴포넌트
- [ ] 의존성 그래프 시각화 (SVG 또는 React Flow)
- [ ] API 호출 및 상태 관리 (React Query)

---

### Phase 7: 통합 테스트

**작업 내용**:
1. E2E 시나리오
   - "로그인 기능 구현해줘" → Job 3개 생성 (FE, BE, QA)
   - 의존성 확인 (QA depends on FE, BE)
   - 실행 순서 검증
2. 에러 케이스 테스트
   - 순환 의존성 감지
   - 프롬프트 타임아웃

**예상 시간**: 1일

**체크리스트**:
- [ ] `e2e/task-decomposition.spec.ts` 작성
- [ ] 순환 의존성 테스트
- [ ] 타임아웃 테스트
- [ ] 통합 테스트 (실제 Decomposer 세션 사용)

---

## 의존성

### 외부 라이브러리
- (없음, 내부 세션 관리 사용)

### 내부 모듈
- **01-Core**: Office, Agent, Persona 조회
- **04-Session Execution**: Decomposer 세션 생성 및 제어
- **08-Job Scheduler**: Job 등록 및 스케줄러 시작

---

## 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 분해 품질 저하 (부정확한 역할 매칭) | 높음 | Persona 프롬프트 튜닝, Few-shot 예제 추가 |
| 순환 의존성 생성 | 중간 | 토폴로지 정렬 알고리즘으로 감지 및 차단 |
| 분해 타임아웃 (복잡한 요청) | 중간 | 타임아웃 60초 설정, 재시도 옵션 제공 |
| 프로젝트 컨텍스트 분석 실패 | 낮음 | 명시적 컨텍스트 입력 옵션 제공 |

---

## 예상 결과물

- [ ] `TaskDecomposer` 서비스
- [ ] `DependencyGraphBuilder` 유틸리티
- [ ] Task 요청 API (`POST /api/offices/:id/tasks`)
- [ ] Job 목록/상세 API (2개 엔드포인트)
- [ ] `TaskInput` UI 컴포넌트
- [ ] `DecompositionPreview` UI 컴포넌트
- [ ] 통합 테스트 스위트
- [ ] Decomposer Persona 시드 데이터

---

## 다음 단계

✅ 02-Task Decomposer 완료 후:
- **08-Job Scheduler** 구현 시작 (Job 실행 순서 관리)
- **04-Session Execution** 강화 (Decomposer 외 일반 Agent 세션)
