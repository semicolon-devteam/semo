# Multi-Agent Orchestration - Advanced Features Tasks

## Task Overview

| ID | Layer | Task | Complexity | Dependencies |
|----|-------|------|------------|--------------|
| T1 | v0.2.x PROJECT | concurrency/workflow 디렉토리 구조 생성 | S | - |
| T2 | v0.3.x DATA | 동시성/워크플로우 타입 정의 | S | T1 |
| T3 | v0.5.x CODE | AgentAvailabilityManager 기본 구조 | M | T2 |
| T4 | v0.5.x CODE | Wait 전략 구현 | M | T3 |
| T5 | v0.5.x CODE | Queue 전략 구현 | M | T3 |
| T6 | v0.5.x CODE | Parallel 전략 구현 | L | T3, Epic 3 |
| T7 | v0.5.x CODE | 세션 매니저에 동시성 통합 | M | T3-T6 |
| T8 | v0.5.x CODE | WorkflowExecutor 기본 구조 | M | T2 |
| T9 | v0.5.x CODE | 명령 분류기 (키워드 매칭) | M | T8 |
| T10 | v0.5.x CODE | 워크플로우 인스턴스 생성 | M | T8 |
| T11 | v0.5.x CODE | 단계 실행 로직 | L | T8, T7 |
| T12 | v0.5.x CODE | [STEP_COMPLETE] 파서 추가 | S | Epic 4 |
| T13 | v0.5.x CODE | 단계 완료 → 다음 단계 트리거 | M | T11, T12 |
| T14 | v0.3.x DATA | 기본 워크플로우 정의 (시드) | M | T8 |
| T15 | v0.4.x TESTS | 동시성 전략 단위 테스트 | M | T3-T6 |
| T16 | v0.4.x TESTS | 워크플로우 실행 통합 테스트 | M | T8-T13 |

## Task Details

### T1: [v0.2.x PROJECT] concurrency/workflow 디렉토리 구조 생성
- **Complexity**: S
- **Dependencies**: -
- **Description**: 고급 기능 관련 파일 구조 생성
- **Acceptance Criteria**:
  - [ ] `packages/office-server/src/concurrency/` 디렉토리
  - [ ] `packages/office-server/src/workflow/` 디렉토리
  - [ ] `types.ts` 파일들

### T2: [v0.3.x DATA] 동시성/워크플로우 타입 정의
- **Complexity**: S
- **Dependencies**: T1
- **Description**: 관련 타입 및 인터페이스 정의
- **Acceptance Criteria**:
  - [ ] `ConcurrencyStrategy` 타입
  - [ ] `RoleConfig` 인터페이스
  - [ ] `WorkflowDefinition`, `WorkflowStep` 인터페이스

```typescript
// packages/office-server/src/concurrency/types.ts

export type ConcurrencyStrategy = 'wait' | 'queue' | 'parallel' | 'reject';

export interface RoleConfig {
  strategy: ConcurrencyStrategy;
  maxParallel?: number;
  maxQueueDepth?: number;
  waitTimeout?: number;
}

export interface AgentState {
  agentId: string;
  role: string;
  status: 'idle' | 'busy';
  currentTaskId?: string;
  activeSessions: number;
}

export interface Task {
  id: string;
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  priority: number;
  createdAt: Date;
}

export type EnqueueResult =
  | { status: 'accepted' }
  | { status: 'queued'; position: number }
  | { status: 'rejected'; reason: string };
```

```typescript
// packages/office-server/src/workflow/types.ts

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentRole: string;
  promptTemplate: string;
  dependsOn?: string[];
  optional?: boolean;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  officeId: string;
  userCommand: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  currentStepId?: string;
  context: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
}

export interface StepExecution {
  id: string;
  instanceId: string;
  stepId: string;
  agentId: string;
  status: 'pending' | 'in_progress' | 'waiting_input' | 'completed' | 'failed';
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  artifacts?: string[];
  startedAt?: Date;
  completedAt?: Date;
}
```

### T3: [v0.5.x CODE] AgentAvailabilityManager 기본 구조
- **Complexity**: M
- **Dependencies**: T2
- **Description**: 동시성 관리자 클래스 골격
- **Acceptance Criteria**:
  - [ ] 역할별 설정 로드
  - [ ] 에이전트 상태 관리
  - [ ] 메서드 시그니처 정의

```typescript
// packages/office-server/src/concurrency/availability-manager.ts

import { ConcurrencyStrategy, RoleConfig, AgentState, Task, EnqueueResult } from './types';

const ROLE_CONFIGS: Record<string, RoleConfig> = {
  Orchestrator: { strategy: 'reject' },  // Orchestrator는 항상 단일
  PO: { strategy: 'queue', maxQueueDepth: 3 },
  PM: { strategy: 'queue', maxQueueDepth: 5 },
  Designer: { strategy: 'wait', waitTimeout: 60000 },
  Architect: { strategy: 'wait', waitTimeout: 60000 },
  FE: { strategy: 'parallel', maxParallel: 2 },
  BE: { strategy: 'parallel', maxParallel: 2 },
  QA: { strategy: 'parallel', maxParallel: 2 },
};

export class AgentAvailabilityManager {
  private agentStates: Map<string, AgentState> = new Map();
  private taskQueues: Map<string, Task[]> = new Map();
  private waitingTasks: Map<string, { task: Task; resolve: Function; reject: Function }[]> = new Map();

  constructor(private sessionManager: AgentSessionManager) {}

  // 에이전트 등록
  registerAgent(agentId: string, role: string): void {
    this.agentStates.set(agentId, {
      agentId,
      role,
      status: 'idle',
      activeSessions: 0,
    });
    this.taskQueues.set(agentId, []);
  }

  // 작업 수락 가능 여부
  canAcceptTask(agentId: string): boolean {
    const state = this.agentStates.get(agentId);
    if (!state) return false;

    const config = ROLE_CONFIGS[state.role] || { strategy: 'reject' };

    switch (config.strategy) {
      case 'reject':
        return state.status === 'idle';
      case 'wait':
      case 'queue':
        return true;  // 대기열/대기 가능
      case 'parallel':
        return state.activeSessions < (config.maxParallel || 1);
    }
  }

  // 작업 제출
  async submitTask(agentId: string, task: Task): Promise<EnqueueResult> {
    const state = this.agentStates.get(agentId);
    if (!state) return { status: 'rejected', reason: 'Agent not found' };

    const config = ROLE_CONFIGS[state.role] || { strategy: 'reject' };

    // 전략별 처리
    return this.handleByStrategy(agentId, task, config);
  }

  // 에이전트 상태 변경
  setAgentStatus(agentId: string, status: 'idle' | 'busy'): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.status = status;
      if (status === 'idle') {
        this.processQueue(agentId);
      }
    }
  }
}
```

### T4: [v0.5.x CODE] Wait 전략 구현
- **Complexity**: M
- **Dependencies**: T3
- **Description**: 타임아웃까지 대기하는 전략
- **Acceptance Criteria**:
  - [ ] Promise 기반 대기
  - [ ] 타임아웃 시 reject
  - [ ] 에이전트 idle 시 즉시 resolve

```typescript
// availability-manager.ts에 추가

private async handleWaitStrategy(
  agentId: string,
  task: Task,
  config: RoleConfig
): Promise<EnqueueResult> {
  const state = this.agentStates.get(agentId)!;

  if (state.status === 'idle') {
    return { status: 'accepted' };
  }

  // 대기 목록에 추가
  return new Promise((resolve, reject) => {
    const waitEntry = { task, resolve, reject };

    if (!this.waitingTasks.has(agentId)) {
      this.waitingTasks.set(agentId, []);
    }
    this.waitingTasks.get(agentId)!.push(waitEntry);

    // 타임아웃 설정
    setTimeout(() => {
      const waitList = this.waitingTasks.get(agentId) || [];
      const idx = waitList.indexOf(waitEntry);
      if (idx >= 0) {
        waitList.splice(idx, 1);
        resolve({ status: 'rejected', reason: 'Wait timeout' });
      }
    }, config.waitTimeout || 60000);
  });
}

// 에이전트가 idle이 되면 대기 중인 작업 처리
private processWaitingTasks(agentId: string): void {
  const waitList = this.waitingTasks.get(agentId) || [];
  if (waitList.length > 0) {
    const { resolve } = waitList.shift()!;
    resolve({ status: 'accepted' });
  }
}
```

### T5: [v0.5.x CODE] Queue 전략 구현
- **Complexity**: M
- **Dependencies**: T3
- **Description**: 대기열 기반 순차 처리 전략
- **Acceptance Criteria**:
  - [ ] 최대 깊이 제한
  - [ ] FIFO 처리
  - [ ] 위치 반환

```typescript
// availability-manager.ts에 추가

private handleQueueStrategy(
  agentId: string,
  task: Task,
  config: RoleConfig
): EnqueueResult {
  const state = this.agentStates.get(agentId)!;
  const queue = this.taskQueues.get(agentId) || [];

  if (state.status === 'idle' && queue.length === 0) {
    return { status: 'accepted' };
  }

  const maxDepth = config.maxQueueDepth || 3;
  if (queue.length >= maxDepth) {
    return { status: 'rejected', reason: `Queue full (max: ${maxDepth})` };
  }

  queue.push(task);
  this.taskQueues.set(agentId, queue);

  return { status: 'queued', position: queue.length };
}

// 대기열에서 다음 작업 가져오기
dequeueTask(agentId: string): Task | null {
  const queue = this.taskQueues.get(agentId) || [];
  return queue.shift() || null;
}

// 에이전트가 idle이 되면 대기열 처리
private processQueue(agentId: string): void {
  const task = this.dequeueTask(agentId);
  if (task) {
    this.emit('taskReady', agentId, task);
  }
}
```

### T6: [v0.5.x CODE] Parallel 전략 구현
- **Complexity**: L
- **Dependencies**: T3, Epic 3
- **Description**: 병렬 세션 생성 전략
- **Acceptance Criteria**:
  - [ ] 활성 세션 수 추적
  - [ ] 최대 병렬 수 제한
  - [ ] 초과 시 Queue fallback

```typescript
// availability-manager.ts에 추가

private async handleParallelStrategy(
  agentId: string,
  task: Task,
  config: RoleConfig
): Promise<EnqueueResult> {
  const state = this.agentStates.get(agentId)!;
  const maxParallel = config.maxParallel || 2;

  if (state.activeSessions < maxParallel) {
    // 새 세션 생성 가능
    state.activeSessions++;
    return { status: 'accepted' };
  }

  // 병렬 한도 초과 → Queue로 fallback
  return this.handleQueueStrategy(agentId, task, {
    strategy: 'queue',
    maxQueueDepth: 5,
  });
}

// 세션 종료 시 활성 세션 감소
decrementActiveSessions(agentId: string): void {
  const state = this.agentStates.get(agentId);
  if (state && state.activeSessions > 0) {
    state.activeSessions--;
    this.processQueue(agentId);
  }
}
```

### T7: [v0.5.x CODE] 세션 매니저에 동시성 통합
- **Complexity**: M
- **Dependencies**: T3-T6
- **Description**: AgentSessionManager에서 동시성 관리자 사용
- **Acceptance Criteria**:
  - [ ] 세션 생성 전 `canAcceptTask` 확인
  - [ ] 작업 시작/종료 시 상태 업데이트
  - [ ] 대기열 작업 자동 실행

### T8: [v0.5.x CODE] WorkflowExecutor 기본 구조
- **Complexity**: M
- **Dependencies**: T2
- **Description**: 워크플로우 실행 엔진 골격
- **Acceptance Criteria**:
  - [ ] 클래스 골격
  - [ ] 메서드 시그니처
  - [ ] 워크플로우 정의 로드

```typescript
// packages/office-server/src/workflow/executor.ts

import { WorkflowDefinition, WorkflowInstance, StepExecution } from './types';
import { AgentSessionManager } from '../agent-client/session-manager';
import { AgentAvailabilityManager } from '../concurrency/availability-manager';

export class WorkflowExecutor {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  constructor(
    private supabase: SupabaseClient,
    private sessionManager: AgentSessionManager,
    private availabilityManager: AgentAvailabilityManager
  ) {
    this.loadWorkflowDefinitions();
  }

  // 워크플로우 정의 로드
  private loadWorkflowDefinitions(): void {
    // 기본 워크플로우 로드
    const defaultWorkflows = require('./definitions');
    for (const wf of defaultWorkflows) {
      this.workflows.set(wf.id, wf);
    }
  }

  // 명령 분류
  async classifyCommand(command: string): Promise<WorkflowDefinition | null> {
    // 구현 (T9)
  }

  // 인스턴스 생성
  async createInstance(officeId: string, command: string): Promise<WorkflowInstance> {
    // 구현 (T10)
  }

  // 단계 실행
  async executeStep(instanceId: string, stepId: string): Promise<void> {
    // 구현 (T11)
  }

  // 단계 완료
  async completeStep(instanceId: string, stepId: string, result: StepResult): Promise<void> {
    // 구현 (T13)
  }
}
```

### T9: [v0.5.x CODE] 명령 분류기 (키워드 매칭)
- **Complexity**: M
- **Dependencies**: T8
- **Description**: 사용자 명령을 워크플로우로 분류
- **Acceptance Criteria**:
  - [ ] 키워드 매칭
  - [ ] 가중치 기반 선택
  - [ ] 매칭 실패 시 기본 워크플로우

```typescript
// workflow/classifier.ts

export class WorkflowClassifier {
  constructor(private workflows: Map<string, WorkflowDefinition>) {}

  classify(command: string): WorkflowDefinition | null {
    const normalizedCommand = command.toLowerCase();
    let bestMatch: WorkflowDefinition | null = null;
    let bestScore = 0;

    for (const workflow of this.workflows.values()) {
      let score = 0;
      for (const keyword of workflow.keywords) {
        if (normalizedCommand.includes(keyword.toLowerCase())) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = workflow;
      }
    }

    return bestMatch;
  }
}
```

### T10: [v0.5.x CODE] 워크플로우 인스턴스 생성
- **Complexity**: M
- **Dependencies**: T8
- **Description**: 워크플로우 실행 인스턴스 DB 생성
- **Acceptance Criteria**:
  - [ ] `workflow_instances` INSERT
  - [ ] 첫 단계 자동 시작
  - [ ] 컨텍스트 초기화

```typescript
// executor.ts에 추가

async createInstance(officeId: string, command: string): Promise<WorkflowInstance> {
  const workflow = await this.classifyCommand(command);
  if (!workflow) {
    throw new Error('Cannot classify command to any workflow');
  }

  // 인스턴스 생성
  const { data: instance, error } = await this.supabase
    .from('workflow_instances')
    .insert({
      office_id: officeId,
      workflow_id: workflow.id,
      user_command: command,
      status: 'active',
      current_step: workflow.steps[0].id,
      context: { originalCommand: command },
    })
    .select()
    .single();

  if (error) throw error;

  // 첫 단계 실행
  await this.executeStep(instance.id, workflow.steps[0].id);

  return instance;
}
```

### T11: [v0.5.x CODE] 단계 실행 로직
- **Complexity**: L
- **Dependencies**: T8, T7
- **Description**: 워크플로우 단계 실행
- **Acceptance Criteria**:
  - [ ] 해당 역할 에이전트 찾기
  - [ ] 동시성 확인 후 프롬프트 전송
  - [ ] `workflow_step_executions` INSERT

```typescript
// executor.ts에 추가

async executeStep(instanceId: string, stepId: string): Promise<void> {
  // 인스턴스 및 워크플로우 조회
  const { data: instance } = await this.supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  const workflow = this.workflows.get(instance.workflow_id);
  const step = workflow?.steps.find(s => s.id === stepId);
  if (!step) throw new Error('Step not found');

  // 해당 역할 에이전트 찾기
  const { data: agent } = await this.supabase
    .from('office_agents')
    .select('*')
    .eq('office_id', instance.office_id)
    .eq('role', step.agentRole)
    .single();

  if (!agent) throw new Error(`Agent with role ${step.agentRole} not found`);

  // 단계 실행 기록
  const { data: execution } = await this.supabase
    .from('workflow_step_executions')
    .insert({
      instance_id: instanceId,
      step_name: step.name,
      agent_id: agent.id,
      status: 'pending',
      input_data: { ...instance.context },
    })
    .select()
    .single();

  // 동시성 확인 후 프롬프트 전송
  const canAccept = this.availabilityManager.canAcceptTask(agent.id);
  if (!canAccept) {
    // 대기열에 추가
    await this.availabilityManager.submitTask(agent.id, {
      id: execution.id,
      agentId: agent.id,
      prompt: this.buildPrompt(step, instance.context),
      priority: 1,
      createdAt: new Date(),
    });
  } else {
    // 즉시 실행
    await this.sendStepPrompt(agent.id, execution.id, step, instance.context);
  }
}
```

### T12: [v0.5.x CODE] [STEP_COMPLETE] 파서 추가
- **Complexity**: S
- **Dependencies**: Epic 4
- **Description**: 단계 완료 프로토콜 메시지 파싱
- **Acceptance Criteria**:
  - [ ] 파서 패턴 추가
  - [ ] 산출물 정보 추출

### T13: [v0.5.x CODE] 단계 완료 → 다음 단계 트리거
- **Complexity**: M
- **Dependencies**: T11, T12
- **Description**: 단계 완료 시 다음 단계 자동 실행
- **Acceptance Criteria**:
  - [ ] 의존성 확인
  - [ ] 다음 단계 결정
  - [ ] 모든 단계 완료 시 인스턴스 완료

```typescript
// executor.ts에 추가

async completeStep(instanceId: string, stepId: string, result: StepResult): Promise<void> {
  // 단계 실행 완료 처리
  await this.supabase
    .from('workflow_step_executions')
    .update({
      status: 'completed',
      output_data: result.output,
      artifacts: result.artifacts,
      completed_at: new Date().toISOString(),
    })
    .eq('instance_id', instanceId)
    .eq('step_name', stepId);

  // 인스턴스 컨텍스트 업데이트
  const { data: instance } = await this.supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  const workflow = this.workflows.get(instance.workflow_id);
  const currentIdx = workflow!.steps.findIndex(s => s.id === stepId);

  // 다음 단계 확인
  if (currentIdx < workflow!.steps.length - 1) {
    const nextStep = workflow!.steps[currentIdx + 1];

    // 의존성 확인 (선택적)
    if (!nextStep.dependsOn || await this.checkDependencies(instanceId, nextStep.dependsOn)) {
      await this.supabase
        .from('workflow_instances')
        .update({ current_step: nextStep.id })
        .eq('id', instanceId);

      await this.executeStep(instanceId, nextStep.id);
    }
  } else {
    // 모든 단계 완료
    await this.supabase
      .from('workflow_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', instanceId);
  }
}
```

### T14: [v0.3.x DATA] 기본 워크플로우 정의 (시드)
- **Complexity**: M
- **Dependencies**: T8
- **Description**: 기본 워크플로우 정의 생성
- **Acceptance Criteria**:
  - [ ] feature-request 워크플로우
  - [ ] bug-fix 워크플로우

```typescript
// workflow/definitions/feature-request.ts

export const featureRequestWorkflow: WorkflowDefinition = {
  id: 'feature-request',
  name: '기능 요청 처리',
  description: '새 기능 요청을 분석하고 구현하는 워크플로우',
  keywords: ['기능', '추가', '구현', '만들어', '개발'],
  steps: [
    {
      id: 'analyze',
      name: '요구사항 분석',
      agentRole: 'PO',
      promptTemplate: '다음 요청을 분석하고 요구사항을 정리해주세요: {{originalCommand}}',
    },
    {
      id: 'design',
      name: '설계',
      agentRole: 'Architect',
      promptTemplate: '다음 요구사항에 대한 기술 설계를 작성해주세요.',
      dependsOn: ['analyze'],
    },
    {
      id: 'implement',
      name: '구현',
      agentRole: 'FE',
      promptTemplate: '설계에 따라 구현을 진행해주세요.',
      dependsOn: ['design'],
    },
    {
      id: 'test',
      name: '테스트',
      agentRole: 'QA',
      promptTemplate: '구현된 기능을 테스트해주세요.',
      dependsOn: ['implement'],
    },
  ],
};
```

### T15: [v0.4.x TESTS] 동시성 전략 단위 테스트
- **Complexity**: M
- **Dependencies**: T3-T6
- **Description**: AgentAvailabilityManager 테스트
- **Acceptance Criteria**:
  - [ ] Wait 전략 테스트
  - [ ] Queue 전략 테스트
  - [ ] Parallel 전략 테스트

### T16: [v0.4.x TESTS] 워크플로우 실행 통합 테스트
- **Complexity**: M
- **Dependencies**: T8-T13
- **Description**: WorkflowExecutor 통합 테스트
- **Acceptance Criteria**:
  - [ ] 명령 분류 테스트
  - [ ] 인스턴스 생성 테스트
  - [ ] 단계 순차 실행 테스트
  - [ ] 완료 트리거 테스트

## Test Requirements

### 동시성 테스트
```typescript
describe('AgentAvailabilityManager', () => {
  describe('Queue Strategy', () => {
    it('should accept task when idle', () => {
      manager.registerAgent('po-1', 'PO');
      const result = manager.submitTask('po-1', mockTask);
      expect(result.status).toBe('accepted');
    });

    it('should queue task when busy', () => {
      manager.setAgentStatus('po-1', 'busy');
      const result = manager.submitTask('po-1', mockTask);
      expect(result.status).toBe('queued');
      expect(result.position).toBe(1);
    });

    it('should reject when queue full', () => {
      // 3개 작업 대기열 채우기
      for (let i = 0; i < 3; i++) {
        manager.submitTask('po-1', mockTask);
      }
      const result = manager.submitTask('po-1', mockTask);
      expect(result.status).toBe('rejected');
    });
  });
});
```

### 워크플로우 테스트
```typescript
describe('WorkflowExecutor', () => {
  it('should classify command to correct workflow', async () => {
    const workflow = await executor.classifyCommand('로그인 기능 추가해줘');
    expect(workflow?.id).toBe('feature-request');
  });

  it('should execute steps in order', async () => {
    const instance = await executor.createInstance('office-1', '버튼 추가해줘');

    // 첫 단계 실행 확인
    const { data: execution } = await supabase
      .from('workflow_step_executions')
      .select('*')
      .eq('instance_id', instance.id)
      .single();

    expect(execution.step_name).toBe('analyze');
  });
});
```
