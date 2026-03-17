# Multi-Agent Orchestration - Integration & Documentation Implementation Plan

## Overview

전체 시스템 E2E 테스트, 성능 최적화, 문서화 진행.
CI/CD 파이프라인에 통합 가능한 테스트 구조 구축.

## Technical Approach

### 1. E2E 테스트 구조

```
packages/office-server/tests/e2e/
├── setup.ts              # 테스트 환경 설정
├── teardown.ts           # 테스트 정리
├── helpers/
│   ├── db.ts             # DB 헬퍼
│   ├── session.ts        # 세션 헬퍼
│   └── wait.ts           # 대기 유틸
├── scenarios/
│   ├── office-creation.test.ts
│   ├── agent-invocation.test.ts
│   ├── user-question.test.ts
│   ├── result-delivery.test.ts
│   └── full-workflow.test.ts
└── fixtures/
    ├── agents.json
    └── workflows.json
```

### 2. E2E 테스트 시나리오

```typescript
// scenarios/full-workflow.test.ts

describe('Full Workflow E2E', () => {
  let office: Office;
  let orchestratorSession: AgentSession;

  beforeAll(async () => {
    // 테스트 Office 생성
    office = await createTestOffice();
    // Orchestrator 세션 시작
    orchestratorSession = await sessionManager.createSession(
      office.orchestratorId,
      office.id
    );
  });

  afterAll(async () => {
    await cleanupTestOffice(office.id);
  });

  it('should complete feature request workflow', async () => {
    // 1. 사용자 명령 전송
    await orchestratorSession.sendPrompt('로그인 기능을 추가해줘');

    // 2. PO 호출 감지 대기
    const invocation = await waitForInvocation(office.id, 'PO');
    expect(invocation).toBeDefined();

    // 3. PO 세션 생성 확인
    const poSession = await waitForSession(invocation.calleeAgentId);
    expect(poSession).toBeDefined();

    // 4. 사용자 질문 대기
    const question = await waitForQuestion(office.id);
    expect(question.question).toContain('로그인');

    // 5. 사용자 응답
    await answerQuestion(question.id, '소셜 로그인');

    // 6. 결과물 생성 대기
    const result = await waitForResult(office.id, 'PO');
    expect(result.resultType).toBe('github_issue');

    // 7. 워크플로우 완료 대기
    const workflow = await waitForWorkflowComplete(office.id);
    expect(workflow.status).toBe('completed');
  });
});
```

### 3. 성능 최적화 계획

#### DB 인덱스
```sql
-- 자주 조회되는 컬럼에 인덱스 추가
CREATE INDEX idx_agent_definitions_office_id ON agent_definitions(office_id);
CREATE INDEX idx_agent_definitions_office_name ON agent_definitions(office_id, name);
CREATE INDEX idx_user_questions_office_status ON user_questions(office_id, status);
CREATE INDEX idx_agent_invocations_office_status ON agent_invocations(office_id, status);
CREATE INDEX idx_workflow_instances_office_status ON workflow_instances(office_id, status);
CREATE INDEX idx_workflow_step_executions_instance ON workflow_step_executions(instance_id);
```

#### Realtime 최적화
```typescript
// 채널을 세분화하여 불필요한 이벤트 수신 방지
const questionChannel = supabase
  .channel(`questions:${officeId}:pending`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'user_questions',
    filter: `office_id=eq.${officeId}&status=eq.pending`,
  }, handleQuestion);
```

### 4. 문서 구조

```
docs/
├── api/
│   ├── openapi.yaml          # OpenAPI 3.0 스펙
│   └── examples/             # API 사용 예시
├── architecture/
│   ├── overview.md           # 시스템 개요
│   ├── data-layer.md         # 데이터 레이어
│   ├── sync-layer.md         # 동기화 레이어
│   ├── session-layer.md      # 세션 레이어
│   ├── protocol-layer.md     # 프로토콜 레이어
│   └── diagrams/             # 아키텍처 다이어그램
├── guides/
│   ├── deployment.md         # 배포 가이드
│   ├── monitoring.md         # 모니터링 가이드
│   └── troubleshooting.md    # 트러블슈팅 가이드
└── README.md                 # 문서 인덱스
```

## Dependencies

### 외부 의존성
- `vitest` 또는 `jest` (테스트 프레임워크)
- `openapi-generator` (API 문서)

### 선행 작업
- Epic 1-7 완료

## File Structure

```
packages/office-server/
├── tests/
│   ├── e2e/
│   │   ├── setup.ts
│   │   ├── scenarios/
│   │   └── helpers/
│   └── performance/
│       └── benchmarks.ts
docs/
├── api/
├── architecture/
└── guides/
```
