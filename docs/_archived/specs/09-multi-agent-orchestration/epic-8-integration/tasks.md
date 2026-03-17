# Multi-Agent Orchestration - Integration & Documentation Tasks

## Task Overview

| ID | Layer | Task | Complexity | Dependencies |
|----|-------|------|------------|--------------|
| T1 | v0.2.x PROJECT | E2E 테스트 디렉토리 구조 | S | - |
| T2 | v0.4.x TESTS | E2E 테스트 환경 설정 | M | T1 |
| T3 | v0.4.x TESTS | 테스트 헬퍼 함수 구현 | M | T2 |
| T4 | v0.4.x TESTS | Office 생성 시나리오 테스트 | M | T3 |
| T5 | v0.4.x TESTS | 에이전트 호출 시나리오 테스트 | M | T3 |
| T6 | v0.4.x TESTS | 사용자 질문 시나리오 테스트 | M | T3 |
| T7 | v0.4.x TESTS | 전체 워크플로우 시나리오 테스트 | L | T4-T6 |
| T8 | v0.3.x DATA | DB 인덱스 최적화 | M | Epic 1 |
| T9 | v0.5.x CODE | Realtime 채널 최적화 | M | Epic 3 |
| T10 | v0.4.x TESTS | 성능 벤치마크 테스트 | M | T8-T9 |
| T11 | v0.2.x PROJECT | 문서 디렉토리 구조 | S | - |
| T12 | v0.6.x DOCS | OpenAPI 스펙 작성 | L | Epic 2 |
| T13 | v0.6.x DOCS | 아키텍처 개요 문서 | M | - |
| T14 | v0.6.x DOCS | 레이어별 상세 문서 | L | T13 |
| T15 | v0.6.x DOCS | 배포 가이드 | M | - |
| T16 | v0.6.x DOCS | 트러블슈팅 가이드 | M | - |

## Task Details

### T1: [v0.2.x PROJECT] E2E 테스트 디렉토리 구조
- **Complexity**: S
- **Dependencies**: -
- **Description**: E2E 테스트 파일 구조 생성
- **Acceptance Criteria**:
  - [ ] `packages/office-server/tests/e2e/` 디렉토리
  - [ ] `scenarios/`, `helpers/`, `fixtures/` 서브 디렉토리

### T2: [v0.4.x TESTS] E2E 테스트 환경 설정
- **Complexity**: M
- **Dependencies**: T1
- **Description**: 테스트 환경 설정 및 초기화
- **Acceptance Criteria**:
  - [ ] 테스트 DB 연결 설정
  - [ ] 테스트 전후 데이터 정리
  - [ ] 환경 변수 로드

```typescript
// packages/office-server/tests/e2e/setup.ts

import { createClient } from '@supabase/supabase-js';

export const testSupabase = createClient(
  process.env.TEST_SUPABASE_URL!,
  process.env.TEST_SUPABASE_SERVICE_KEY!
);

export async function setupTestEnvironment() {
  // 테스트 데이터 초기화
  await cleanupTestData();
}

export async function teardownTestEnvironment() {
  // 테스트 후 정리
  await cleanupTestData();
}

async function cleanupTestData() {
  // 테스트용 Office 삭제 (CASCADE로 관련 데이터 삭제)
  await testSupabase
    .from('offices')
    .delete()
    .like('name', 'TEST_%');
}
```

### T3: [v0.4.x TESTS] 테스트 헬퍼 함수 구현
- **Complexity**: M
- **Dependencies**: T2
- **Description**: E2E 테스트용 유틸리티 함수
- **Acceptance Criteria**:
  - [ ] `createTestOffice()` - 테스트 Office 생성
  - [ ] `waitForInvocation()` - 에이전트 호출 대기
  - [ ] `waitForQuestion()` - 사용자 질문 대기
  - [ ] `waitForResult()` - 결과물 대기

```typescript
// packages/office-server/tests/e2e/helpers/db.ts

export async function createTestOffice(): Promise<TestOffice> {
  const { data: office } = await testSupabase
    .from('offices')
    .insert({
      name: `TEST_${Date.now()}`,
      description: 'E2E Test Office',
    })
    .select()
    .single();

  // 기본 템플릿 복사 트리거
  await initializeOfficeDefinitions(office.id);

  // 에이전트 조회
  const { data: agents } = await testSupabase
    .from('office_agents')
    .select('*')
    .eq('office_id', office.id);

  return {
    id: office.id,
    name: office.name,
    orchestratorId: agents.find(a => a.role === 'Orchestrator')?.id,
    agents,
  };
}
```

```typescript
// packages/office-server/tests/e2e/helpers/wait.ts

export async function waitForInvocation(
  officeId: string,
  targetRole: string,
  timeout = 10000
): Promise<AgentInvocation | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const { data } = await testSupabase
      .from('agent_invocations')
      .select('*, office_agents!callee_agent_id(role)')
      .eq('office_id', officeId)
      .eq('office_agents.role', targetRole)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) return data;

    await sleep(500);
  }

  return null;
}

export async function waitForQuestion(
  officeId: string,
  timeout = 10000
): Promise<UserQuestion | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const { data } = await testSupabase
      .from('user_questions')
      .select('*')
      .eq('office_id', officeId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) return data;

    await sleep(500);
  }

  return null;
}
```

### T4: [v0.4.x TESTS] Office 생성 시나리오 테스트
- **Complexity**: M
- **Dependencies**: T3
- **Description**: Office 생성 및 초기화 테스트
- **Acceptance Criteria**:
  - [ ] Office 생성 성공
  - [ ] 기본 에이전트 템플릿 복사 확인
  - [ ] 기본 스킬 템플릿 복사 확인

```typescript
// packages/office-server/tests/e2e/scenarios/office-creation.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestOffice, cleanupTestOffice } from '../helpers/db';

describe('Office Creation', () => {
  let officeId: string;

  afterAll(async () => {
    if (officeId) await cleanupTestOffice(officeId);
  });

  it('should create office with default templates', async () => {
    const office = await createTestOffice();
    officeId = office.id;

    // 에이전트 정의 확인
    const { data: agents } = await testSupabase
      .from('agent_definitions')
      .select('*')
      .eq('office_id', office.id);

    expect(agents).toHaveLength(6);
    expect(agents.map(a => a.role)).toContain('Orchestrator');
    expect(agents.map(a => a.role)).toContain('PO');
    expect(agents.map(a => a.role)).toContain('FE');

    // 스킬 정의 확인
    const { data: skills } = await testSupabase
      .from('skill_definitions')
      .select('*')
      .eq('office_id', office.id);

    expect(skills).toHaveLength(3);
    expect(skills.map(s => s.name)).toContain('write-code');
  });
});
```

### T5: [v0.4.x TESTS] 에이전트 호출 시나리오 테스트
- **Complexity**: M
- **Dependencies**: T3
- **Description**: 에이전트 간 호출 테스트
- **Acceptance Criteria**:
  - [ ] INVOKE 메시지 처리 확인
  - [ ] 호출 기록 DB 저장 확인
  - [ ] 호출된 에이전트 세션 생성 확인

### T6: [v0.4.x TESTS] 사용자 질문 시나리오 테스트
- **Complexity**: M
- **Dependencies**: T3
- **Description**: 사용자 질문 및 응답 테스트
- **Acceptance Criteria**:
  - [ ] ASK_USER 메시지 처리 확인
  - [ ] 질문 DB 저장 확인
  - [ ] 응답 전달 확인

### T7: [v0.4.x TESTS] 전체 워크플로우 시나리오 테스트
- **Complexity**: L
- **Dependencies**: T4-T6
- **Description**: 처음부터 끝까지 전체 플로우 테스트
- **Acceptance Criteria**:
  - [ ] 사용자 명령 → 워크플로우 생성
  - [ ] 단계별 에이전트 호출
  - [ ] 결과물 전달
  - [ ] 워크플로우 완료

```typescript
// packages/office-server/tests/e2e/scenarios/full-workflow.test.ts

describe('Full Workflow E2E', () => {
  let office: TestOffice;
  let sessionManager: AgentSessionManager;

  beforeAll(async () => {
    office = await createTestOffice();
    sessionManager = new AgentSessionManager(testSupabase);
  });

  afterAll(async () => {
    await cleanupTestOffice(office.id);
  });

  it('should complete feature request workflow end-to-end', async () => {
    // 1. Orchestrator 세션 생성
    const orchestratorSession = await sessionManager.createSession(
      office.orchestratorId,
      office.id
    );
    expect(orchestratorSession).toBeDefined();

    // 2. 사용자 명령 전송
    await sessionManager.sendPrompt(
      orchestratorSession.id,
      '로그인 기능을 추가해줘'
    );

    // 3. 워크플로우 인스턴스 생성 확인
    const workflow = await waitForWorkflow(office.id);
    expect(workflow).toBeDefined();
    expect(workflow.status).toBe('active');

    // 4. PO 에이전트 호출 대기
    const invocation = await waitForInvocation(office.id, 'PO', 15000);
    expect(invocation).toBeDefined();

    // 5. 사용자 질문 대기 및 응답
    const question = await waitForQuestion(office.id, 15000);
    if (question) {
      await answerQuestion(question.id, '소셜 로그인으로 구현해주세요');
    }

    // 6. 결과물 생성 대기
    const result = await waitForResult(office.id, 30000);
    expect(result).toBeDefined();

    // 7. 워크플로우 완료 대기 (긴 타임아웃)
    const completedWorkflow = await waitForWorkflowComplete(office.id, 120000);
    expect(completedWorkflow.status).toBe('completed');
  }, 180000); // 3분 타임아웃
});
```

### T8: [v0.3.x DATA] DB 인덱스 최적화
- **Complexity**: M
- **Dependencies**: Epic 1
- **Description**: 성능 최적화를 위한 인덱스 추가
- **Acceptance Criteria**:
  - [ ] 자주 조회되는 컬럼에 인덱스 추가
  - [ ] 복합 인덱스 검토
  - [ ] 마이그레이션 파일 작성

```sql
-- supabase/migrations/XXX_performance_indexes.sql

-- 에이전트 정의 조회 최적화
CREATE INDEX IF NOT EXISTS idx_agent_definitions_office_active
  ON agent_definitions(office_id, is_active);

CREATE INDEX IF NOT EXISTS idx_agent_definitions_office_name
  ON agent_definitions(office_id, name);

-- 스킬 정의 조회 최적화
CREATE INDEX IF NOT EXISTS idx_skill_definitions_office_active
  ON skill_definitions(office_id, is_active);

-- 사용자 질문 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_questions_office_pending
  ON user_questions(office_id, status)
  WHERE status = 'pending';

-- 에이전트 호출 조회 최적화
CREATE INDEX IF NOT EXISTS idx_agent_invocations_office_active
  ON agent_invocations(office_id, status)
  WHERE status IN ('pending', 'in_progress');

-- 워크플로우 조회 최적화
CREATE INDEX IF NOT EXISTS idx_workflow_instances_office_active
  ON workflow_instances(office_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_instance
  ON workflow_step_executions(instance_id);

-- 에이전트 결과 조회 최적화
CREATE INDEX IF NOT EXISTS idx_agent_results_office_pending
  ON agent_results(office_id, status)
  WHERE status = 'pending';
```

### T9: [v0.5.x CODE] Realtime 채널 최적화
- **Complexity**: M
- **Dependencies**: Epic 3
- **Description**: Realtime 구독 효율화
- **Acceptance Criteria**:
  - [ ] 채널별 필터 세분화
  - [ ] 불필요한 이벤트 필터링
  - [ ] 연결 재사용

```typescript
// packages/office-server/src/agent-client/optimized-realtime.ts

export class OptimizedRealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();

  constructor(private supabase: SupabaseClient) {}

  // 세분화된 채널 구독
  subscribeToQuestions(officeId: string, onQuestion: (q: UserQuestion) => void) {
    const channelKey = `questions:${officeId}`;

    if (this.channels.has(channelKey)) {
      return; // 이미 구독 중
    }

    const channel = this.supabase
      .channel(channelKey)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_questions',
        filter: `office_id=eq.${officeId}`,
      }, (payload) => {
        if (payload.new.status === 'pending') {
          onQuestion(payload.new);
        }
      })
      .subscribe();

    this.channels.set(channelKey, channel);
  }

  // 채널 해제
  unsubscribe(channelKey: string) {
    const channel = this.channels.get(channelKey);
    if (channel) {
      this.supabase.removeChannel(channel);
      this.channels.delete(channelKey);
    }
  }

  // 모든 채널 해제
  unsubscribeAll() {
    for (const [key, channel] of this.channels) {
      this.supabase.removeChannel(channel);
    }
    this.channels.clear();
  }
}
```

### T10: [v0.4.x TESTS] 성능 벤치마크 테스트
- **Complexity**: M
- **Dependencies**: T8-T9
- **Description**: 성능 측정 및 검증
- **Acceptance Criteria**:
  - [ ] DB 쿼리 응답 시간 측정
  - [ ] Realtime 이벤트 지연 측정
  - [ ] 동시 세션 테스트

```typescript
// packages/office-server/tests/performance/benchmarks.ts

describe('Performance Benchmarks', () => {
  it('should query agent definitions under 100ms', async () => {
    const start = performance.now();

    await testSupabase
      .from('agent_definitions')
      .select('*')
      .eq('office_id', testOfficeId)
      .eq('is_active', true);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should handle 10 concurrent sessions', async () => {
    const sessions = await Promise.all(
      Array(10).fill(null).map((_, i) =>
        sessionManager.createSession(`agent-${i}`, testOfficeId)
      )
    );

    expect(sessions.every(s => s !== null)).toBe(true);

    // 정리
    await Promise.all(
      sessions.map(s => sessionManager.destroySession(s.id))
    );
  });

  it('should deliver realtime events under 500ms', async () => {
    let receivedAt: number;

    // 구독 설정
    const channel = testSupabase
      .channel('test-latency')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_questions',
      }, () => {
        receivedAt = performance.now();
      })
      .subscribe();

    await sleep(1000); // 구독 안정화 대기

    const sentAt = performance.now();

    // 이벤트 발생
    await testSupabase.from('user_questions').insert({
      office_id: testOfficeId,
      agent_id: testAgentId,
      question: 'Latency test',
      question_type: 'text',
    });

    await sleep(1000);

    const latency = receivedAt - sentAt;
    expect(latency).toBeLessThan(500);

    await testSupabase.removeChannel(channel);
  });
});
```

### T11: [v0.2.x PROJECT] 문서 디렉토리 구조
- **Complexity**: S
- **Dependencies**: -
- **Description**: 문서 파일 구조 생성
- **Acceptance Criteria**:
  - [ ] `docs/api/` 디렉토리
  - [ ] `docs/architecture/` 디렉토리
  - [ ] `docs/guides/` 디렉토리

### T12: [v0.6.x DOCS] OpenAPI 스펙 작성
- **Complexity**: L
- **Dependencies**: Epic 2
- **Description**: REST API 문서화
- **Acceptance Criteria**:
  - [ ] 모든 API 엔드포인트 문서화
  - [ ] 요청/응답 스키마 정의
  - [ ] 예시 포함

```yaml
# docs/api/openapi.yaml

openapi: 3.0.0
info:
  title: SEMO Office Multi-Agent API
  version: 1.0.0
  description: SEMO Office 멀티 에이전트 오케스트레이션 API

paths:
  /api/offices/{officeId}/agent-definitions:
    get:
      summary: 에이전트 정의 목록 조회
      parameters:
        - name: officeId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: 성공
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/AgentDefinition'

  /api/offices/{officeId}/agent-definitions/{name}:
    put:
      summary: 에이전트 정의 수정
      parameters:
        - name: officeId
          in: path
          required: true
          schema:
            type: string
        - name: name
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                definition_content:
                  type: string
                frontmatter:
                  type: object
      responses:
        '200':
          description: 성공

components:
  schemas:
    AgentDefinition:
      type: object
      properties:
        id:
          type: string
          format: uuid
        office_id:
          type: string
          format: uuid
        name:
          type: string
        role:
          type: string
        definition_content:
          type: string
        frontmatter:
          type: object
        is_active:
          type: boolean
```

### T13: [v0.6.x DOCS] 아키텍처 개요 문서
- **Complexity**: M
- **Dependencies**: -
- **Description**: 시스템 아키텍처 개요 문서
- **Acceptance Criteria**:
  - [ ] 시스템 구조 다이어그램
  - [ ] 핵심 원칙 설명
  - [ ] 컴포넌트 관계 설명

### T14: [v0.6.x DOCS] 레이어별 상세 문서
- **Complexity**: L
- **Dependencies**: T13
- **Description**: 각 레이어별 상세 문서
- **Acceptance Criteria**:
  - [ ] 데이터 레이어 문서
  - [ ] 동기화 레이어 문서
  - [ ] 세션 레이어 문서
  - [ ] 프로토콜 레이어 문서

### T15: [v0.6.x DOCS] 배포 가이드
- **Complexity**: M
- **Dependencies**: -
- **Description**: 시스템 배포 가이드
- **Acceptance Criteria**:
  - [ ] 환경 변수 설정
  - [ ] DB 마이그레이션 절차
  - [ ] 서버 시작 절차
  - [ ] Docker 설정 (선택)

### T16: [v0.6.x DOCS] 트러블슈팅 가이드
- **Complexity**: M
- **Dependencies**: -
- **Description**: 일반적인 문제 해결 가이드
- **Acceptance Criteria**:
  - [ ] DB 연결 문제
  - [ ] Realtime 연결 문제
  - [ ] 세션 생성 실패
  - [ ] 프로토콜 파싱 오류

## Test Requirements

### E2E 테스트 실행
```bash
# 테스트 환경 준비
export TEST_SUPABASE_URL=...
export TEST_SUPABASE_SERVICE_KEY=...

# E2E 테스트 실행
npm run test:e2e

# 성능 테스트 실행
npm run test:performance
```

### 성능 기준
| 항목 | 기준 |
|------|------|
| DB 쿼리 응답 | < 100ms |
| Realtime 이벤트 지연 | < 500ms |
| 동시 세션 | >= 10개 |
| 메모리 사용 | < 500MB (서버당) |
