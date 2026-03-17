# Multi-Agent Orchestration - Advanced Features Implementation Plan

## Overview

역할별 동시성 전략과 워크플로우 실행 엔진 구현.
AgentAvailabilityManager가 작업 분배를 관리하고, WorkflowExecutor가 단계별 실행을 조율.

## Technical Approach

### 1. AgentAvailabilityManager 설계

```typescript
// packages/office-server/src/concurrency/availability-manager.ts

type ConcurrencyStrategy = 'wait' | 'queue' | 'parallel' | 'reject';

interface RoleConfig {
  strategy: ConcurrencyStrategy;
  maxParallel?: number;     // parallel 전략
  maxQueueDepth?: number;   // queue 전략
  waitTimeout?: number;     // wait 전략 (ms)
}

const ROLE_CONFIGS: Record<string, RoleConfig> = {
  PO: { strategy: 'queue', maxQueueDepth: 3 },
  PM: { strategy: 'queue', maxQueueDepth: 5 },
  Designer: { strategy: 'wait', waitTimeout: 60000 },
  Architect: { strategy: 'wait', waitTimeout: 60000 },
  FE: { strategy: 'parallel', maxParallel: 2 },
  BE: { strategy: 'parallel', maxParallel: 2 },
  QA: { strategy: 'parallel', maxParallel: 2 },
};

class AgentAvailabilityManager {
  private agentStates: Map<string, AgentState> = new Map();
  private taskQueues: Map<string, Task[]> = new Map();

  canAcceptTask(agentId: string): boolean;
  enqueueTask(agentId: string, task: Task): EnqueueResult;
  dequeueTask(agentId: string): Task | null;
  setAgentBusy(agentId: string, busy: boolean): void;
}
```

### 2. 동시성 처리 흐름

```
작업 요청 도착
      ↓
에이전트 상태 확인 (idle/busy)
      ↓
[idle] → 즉시 작업 시작, 상태를 busy로
      ↓
[busy] → 역할별 전략 적용
         ├─ [Wait] → 타임아웃까지 대기, 실패 시 에러
         ├─ [Queue] → 대기열 추가 (깊이 제한 내)
         │            → 초과 시 거부
         ├─ [Parallel] → 새 세션 생성 (limit까지)
         │              → 초과 시 Queue로 fallback
         └─ [Reject] → 즉시 거부
```

### 3. WorkflowExecutor 설계

```typescript
// packages/office-server/src/workflow/executor.ts

interface WorkflowDefinition {
  id: string;
  name: string;
  keywords: string[];
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  name: string;
  agentRole: string;
  prompt: string;
  dependsOn?: string[];
}

class WorkflowExecutor {
  constructor(
    private supabase: SupabaseClient,
    private sessionManager: AgentSessionManager,
    private availabilityManager: AgentAvailabilityManager
  ) {}

  // 사용자 명령을 워크플로우로 분류
  async classifyCommand(command: string): Promise<WorkflowDefinition>;

  // 워크플로우 인스턴스 생성
  async createInstance(command: string): Promise<WorkflowInstance>;

  // 단계 실행
  async executeStep(instanceId: string, stepId: string): Promise<void>;

  // 단계 완료 처리 → 다음 단계 트리거
  async completeStep(instanceId: string, stepId: string, result: StepResult): Promise<void>;
}
```

### 4. 워크플로우 실행 흐름

```
사용자 명령 입력
      ↓
classifyCommand() - 키워드 매칭 또는 LLM 분류
      ↓
createInstance() - workflow_instances INSERT
      ↓
executeStep(첫 번째 단계)
      ↓
해당 역할 에이전트에 프롬프트 전송
      ↓
(에이전트 작업 수행)
      ↓
[STEP_COMPLETE] 감지
      ↓
completeStep() - workflow_step_executions UPDATE
      ↓
다음 단계 자동 트리거 (의존성 확인)
      ↓
모든 단계 완료 시 workflow_instances UPDATE
```

### 5. STEP_COMPLETE 프로토콜

```typescript
// protocol/parser.ts에 추가

private parseStepComplete(content: string): ProtocolMessage[] {
  const pattern = /\[STEP_COMPLETE\]([\s\S]*?)(?=\[|$)/g;
  const messages: ProtocolMessage[] = [];

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const body = match[1].trim();
    const payload: Record<string, unknown> = {};

    const lines = body.split('\n');
    for (const line of lines) {
      if (line.startsWith('산출물:')) {
        payload.artifacts = line.substring(4).trim();
      } else if (line.startsWith('상태:')) {
        payload.status = line.substring(3).trim();
      }
    }

    messages.push({
      type: 'STEP_COMPLETE',
      payload,
      rawContent: match[0],
    });
  }

  return messages;
}
```

## Dependencies

### 외부 의존성
- Epic 3의 `AgentSessionManager`
- Epic 4의 `ProtocolParser`

### 선행 작업
- Epic 1-5 완료
- `workflow_instances`, `workflow_step_executions` 테이블 존재

## File Structure

```
packages/office-server/src/
├── concurrency/
│   ├── availability-manager.ts
│   ├── strategies/
│   │   ├── wait-strategy.ts
│   │   ├── queue-strategy.ts
│   │   └── parallel-strategy.ts
│   └── types.ts
├── workflow/
│   ├── executor.ts
│   ├── classifier.ts        # 명령 → 워크플로우 분류
│   ├── definitions/         # 기본 워크플로우 정의
│   │   ├── feature-request.ts
│   │   └── bug-fix.ts
│   └── types.ts
└── protocol/
    └── step-complete-handler.ts
```
