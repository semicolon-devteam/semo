# 02-Task Decomposer: Implementation Tasks

---

## Task Summary

| Layer | Tasks | Version |
|-------|-------|---------|
| DATA | 1 | v0.1.1 |
| APPLICATION | 5 | v0.1.3 |
| PRESENTATION | 2 | v0.1.4 |
| **Total** | **8** | |

---

## Layer 1: DATA

### TASK-TD01: Job 테이블 스키마

**파일**: `004_office_tables.sql`

**작업 내용**:
- [ ] job_queue 테이블 생성
- [ ] 인덱스 생성 (office_id, status)
- [ ] depends_on 배열 필드

---

## Layer 3: APPLICATION

### TASK-TD02: Project Context Analyzer

**파일**: `packages/office-server/src/decomposer/analyzer.ts`

**작업 내용**:
```typescript
class ProjectAnalyzer {
  async analyze(repoPath: string): Promise<ProjectContext> {
    // 1. package.json 분석 (기술 스택)
    // 2. 디렉토리 구조 분석
    // 3. 기존 패턴 감지
  }
}
```

**AC**:
- package.json에서 dependencies 추출
- src/, tests/, e2e/ 등 구조 파악

---

### TASK-TD03: Job Generator

**파일**: `packages/office-server/src/decomposer/jobGenerator.ts`

**작업 내용**:
```typescript
class JobGenerator {
  async generate(
    task: string,
    context: ProjectContext
  ): Promise<DecomposedJob[]> {
    // 1. 요청 분석 (키워드 추출)
    // 2. 필요한 역할 식별
    // 3. 역할별 Job 설명 생성
  }
}
```

**AC**:
- "로그인 기능" → FE, BE, QA Job 생성
- 각 Job에 구체적인 설명 포함

---

### TASK-TD04: Dependency Graph Builder

**파일**: `packages/office-server/src/decomposer/dependencyGraph.ts`

**작업 내용**:
```typescript
class DependencyGraphBuilder {
  build(jobs: DecomposedJob[]): DependencyEdge[] {
    // 1. 역할 간 기본 의존성 적용
    // 2. 순환 의존성 감지
    // 3. 실행 순서 계산
  }

  getExecutionOrder(edges: DependencyEdge[]): string[][] {
    // 토폴로지 정렬로 병렬 실행 그룹 계산
  }
}
```

---

### TASK-TD05: Persona Matcher

**파일**: `packages/office-server/src/decomposer/personaMatcher.ts`

**작업 내용**:
```typescript
class PersonaMatcher {
  async match(
    jobs: DecomposedJob[],
    personas: AgentPersona[]
  ): Promise<JobWithPersona[]> {
    // 1. Job의 estimatedFiles와 Persona scope_patterns 매칭
    // 2. 우선순위 결정
  }
}
```

---

### TASK-TD06: Task Decomposer (Main)

**파일**: `packages/office-server/src/decomposer/index.ts`

**작업 내용**:
```typescript
class TaskDecomposer {
  constructor(
    private analyzer: ProjectAnalyzer,
    private generator: JobGenerator,
    private graphBuilder: DependencyGraphBuilder,
    private matcher: PersonaMatcher
  ) {}

  async decompose(request: DecompositionRequest): Promise<DecompositionResult> {
    // 1. 프로젝트 컨텍스트 분석
    const context = await this.analyzer.analyze(repoPath);

    // 2. Job 생성
    const jobs = await this.generator.generate(request.task, context);

    // 3. 의존성 그래프 생성
    const graph = this.graphBuilder.build(jobs);
    const order = this.graphBuilder.getExecutionOrder(graph);

    // 4. Persona 매칭
    const matched = await this.matcher.match(jobs, personas);

    return { jobs: matched, dependencyGraph: graph, executionOrder: order };
  }
}
```

---

## Layer 4: PRESENTATION

### TASK-TD07: Tasks API Route

**파일**: `packages/office-server/src/api/routes/tasks.ts`

**작업 내용**:
- [ ] POST /api/offices/:id/tasks
- [ ] 요청 검증
- [ ] 분해 결과 반환

---

### TASK-TD08: Jobs API Route

**파일**: `packages/office-server/src/api/routes/jobs.ts`

**작업 내용**:
- [ ] GET /api/offices/:id/jobs
- [ ] GET /api/offices/:id/jobs/:jobId
- [ ] PATCH /api/offices/:id/jobs/:jobId (상태 업데이트)

---

## Completion Checklist

- [ ] job_queue 테이블 생성
- [ ] ProjectAnalyzer 동작 (기술 스택, 구조)
- [ ] JobGenerator 동작 (자연어 → Job)
- [ ] DependencyGraphBuilder 동작 (의존성 추론)
- [ ] PersonaMatcher 동작 (역할 매칭)
- [ ] POST /tasks API 동작
- [ ] "로그인 기능 구현해줘" → 3개 Job 생성 테스트
