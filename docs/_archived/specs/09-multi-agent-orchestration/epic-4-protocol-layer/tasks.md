# Multi-Agent Orchestration - Protocol Layer Tasks

## Task Overview

| ID | Layer | Task | Complexity | Dependencies |
|----|-------|------|------------|--------------|
| T1 | v0.2.x PROJECT | protocol 디렉토리 구조 생성 | S | - |
| T2 | v0.5.x CODE | ProtocolParser 기본 구조 | M | T1 |
| T3 | v0.5.x CODE | ANSI 이스케이프 코드 제거 유틸 | S | T2 |
| T4 | v0.5.x CODE | [ASK_USER] 파서 구현 | M | T2 |
| T5 | v0.5.x CODE | [INVOKE:Agent] 파서 구현 | M | T2 |
| T6 | v0.5.x CODE | [DELIVER_RESULT:Agent] 파서 구현 | M | T2 |
| T7 | v0.5.x CODE | AskUserHandler 구현 | L | T4, Epic 3 |
| T8 | v0.5.x CODE | 사용자 응답 전달 로직 | M | T7 |
| T9 | v0.5.x CODE | InvokeHandler 구현 | L | T5, Epic 3 |
| T10 | v0.5.x CODE | 호출 완료 처리 로직 | M | T9 |
| T11 | v0.5.x CODE | ResultHandler 구현 | M | T6, Epic 3 |
| T12 | v0.5.x CODE | 세션 매니저에 프로토콜 통합 | M | T7-T11 |
| T13 | v0.4.x TESTS | 프로토콜 파서 단위 테스트 | M | T2-T6 |
| T14 | v0.4.x TESTS | 핸들러 통합 테스트 | M | T7-T12 |

## Task Details

### T1: [v0.2.x PROJECT] protocol 디렉토리 구조 생성
- **Complexity**: S
- **Dependencies**: -
- **Description**: 프로토콜 처리 관련 파일 구조 생성
- **Acceptance Criteria**:
  - [ ] `packages/office-server/src/protocol/` 디렉토리
  - [ ] `types.ts`, `index.ts` 파일

### T2: [v0.5.x CODE] ProtocolParser 기본 구조
- **Complexity**: M
- **Dependencies**: T1
- **Description**: 프로토콜 메시지 파서 클래스 골격 구현
- **Acceptance Criteria**:
  - [ ] `ProtocolParser` 클래스
  - [ ] `parse(output: string): ProtocolMessage[]` 메서드 시그니처
  - [ ] 프로토콜 패턴 정규식 정의

```typescript
// packages/office-server/src/protocol/parser.ts

export interface ProtocolMessage {
  type: 'ASK_USER' | 'INVOKE' | 'DELIVER_RESULT' | 'STEP_COMPLETE';
  target?: string;
  payload: Record<string, unknown>;
  rawContent: string;
}

export class ProtocolParser {
  private patterns = {
    askUser: /\[ASK_USER\]([\s\S]*?)(?=\[(?:ASK_USER|INVOKE|DELIVER_RESULT|STEP_COMPLETE)\]|$)/g,
    invoke: /\[INVOKE:(\w+)\]([\s\S]*?)(?=\[(?:ASK_USER|INVOKE|DELIVER_RESULT|STEP_COMPLETE)\]|$)/g,
    deliverResult: /\[DELIVER_RESULT:(\w+)\]([\s\S]*?)(?=\[(?:ASK_USER|INVOKE|DELIVER_RESULT|STEP_COMPLETE)\]|$)/g,
  };

  parse(output: string): ProtocolMessage[] {
    const cleaned = this.stripAnsi(output);
    const messages: ProtocolMessage[] = [];

    // 각 패턴별 파싱
    messages.push(...this.parseAskUser(cleaned));
    messages.push(...this.parseInvoke(cleaned));
    messages.push(...this.parseDeliverResult(cleaned));

    return messages;
  }
}
```

### T3: [v0.5.x CODE] ANSI 이스케이프 코드 제거 유틸
- **Complexity**: S
- **Dependencies**: T2
- **Description**: PTY 출력에서 ANSI 코드 제거
- **Acceptance Criteria**:
  - [ ] `stripAnsi(text: string): string` 메서드
  - [ ] 색상, 커서 이동 등 모든 ANSI 코드 처리

```typescript
private stripAnsi(text: string): string {
  // ANSI 이스케이프 코드 패턴
  const ansiPattern = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return text.replace(ansiPattern, '');
}
```

### T4: [v0.5.x CODE] [ASK_USER] 파서 구현
- **Complexity**: M
- **Dependencies**: T2
- **Description**: ASK_USER 프로토콜 메시지 파싱
- **Acceptance Criteria**:
  - [ ] 질문 타입 파싱 (text, selection, confirmation)
  - [ ] 옵션 배열 파싱
  - [ ] 컨텍스트 정보 파싱

```typescript
private parseAskUser(content: string): ProtocolMessage[] {
  const messages: ProtocolMessage[] = [];
  let match;

  while ((match = this.patterns.askUser.exec(content)) !== null) {
    const body = match[1].trim();
    const lines = body.split('\n');

    const payload: Record<string, unknown> = {};

    for (const line of lines) {
      if (line.startsWith('질문:')) {
        payload.question = line.substring(3).trim();
      } else if (line.startsWith('타입:')) {
        payload.type = line.substring(3).trim();
      } else if (line.startsWith('옵션:')) {
        const optStr = line.substring(3).trim();
        payload.options = JSON.parse(optStr.replace(/'/g, '"'));
      }
    }

    messages.push({
      type: 'ASK_USER',
      payload,
      rawContent: match[0],
    });
  }

  return messages;
}
```

### T5: [v0.5.x CODE] [INVOKE:Agent] 파서 구현
- **Complexity**: M
- **Dependencies**: T2
- **Description**: INVOKE 프로토콜 메시지 파싱
- **Acceptance Criteria**:
  - [ ] 대상 에이전트 이름 추출
  - [ ] 작업 내용 파싱
  - [ ] 컨텍스트 정보 파싱

```typescript
private parseInvoke(content: string): ProtocolMessage[] {
  const messages: ProtocolMessage[] = [];
  let match;

  while ((match = this.patterns.invoke.exec(content)) !== null) {
    const target = match[1];
    const body = match[2].trim();

    const payload: Record<string, unknown> = {
      task: '',
      context: {},
    };

    const lines = body.split('\n');
    const contextIdx = lines.findIndex(l => l.startsWith('컨텍스트:'));

    if (contextIdx >= 0) {
      payload.task = lines.slice(0, contextIdx).join('\n').trim();
      payload.context = lines.slice(contextIdx + 1).join('\n').trim();
    } else {
      payload.task = body;
    }

    messages.push({
      type: 'INVOKE',
      target,
      payload,
      rawContent: match[0],
    });
  }

  return messages;
}
```

### T6: [v0.5.x CODE] [DELIVER_RESULT:Agent] 파서 구현
- **Complexity**: M
- **Dependencies**: T2
- **Description**: DELIVER_RESULT 프로토콜 메시지 파싱
- **Acceptance Criteria**:
  - [ ] 대상 에이전트 이름 추출
  - [ ] 결과 타입 파싱 (github_issue, markdown, json, file_path)
  - [ ] 결과 내용 파싱

```typescript
private parseDeliverResult(content: string): ProtocolMessage[] {
  const messages: ProtocolMessage[] = [];
  let match;

  while ((match = this.patterns.deliverResult.exec(content)) !== null) {
    const target = match[1];
    const body = match[2].trim();

    const payload: Record<string, unknown> = {};
    const lines = body.split('\n');

    for (const line of lines) {
      if (line.startsWith('타입:')) {
        payload.resultType = line.substring(3).trim();
      } else if (line.startsWith('내용:')) {
        payload.content = line.substring(3).trim();
      }
    }

    // 나머지 내용을 content로
    if (!payload.content) {
      payload.content = body;
    }

    messages.push({
      type: 'DELIVER_RESULT',
      target,
      payload,
      rawContent: match[0],
    });
  }

  return messages;
}
```

### T7: [v0.5.x CODE] AskUserHandler 구현
- **Complexity**: L (Large)
- **Dependencies**: T4, Epic 3
- **Description**: ASK_USER 메시지 처리 핸들러
- **Acceptance Criteria**:
  - [ ] `user_questions` 테이블에 INSERT
  - [ ] 세션 상태를 'waiting_input'으로 변경
  - [ ] 응답 대기 핸들러 등록

```typescript
// packages/office-server/src/protocol/ask-user-handler.ts

export class AskUserHandler {
  constructor(
    private supabase: SupabaseClient,
    private sessionManager: AgentSessionManager
  ) {}

  async handle(sessionId: string, message: ProtocolMessage): Promise<string> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    // 1. DB에 질문 저장
    const { data: question, error } = await this.supabase
      .from('user_questions')
      .insert({
        agent_id: session.agentId,
        office_id: session.officeId,
        question_type: message.payload.type || 'text',
        question: message.payload.question,
        options: message.payload.options,
        status: 'pending',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5분 타임아웃
      })
      .select()
      .single();

    if (error) throw error;

    // 2. 세션 상태 업데이트
    session.status = 'waiting_input';
    session.pendingQuestionId = question.id;

    return question.id;
  }
}
```

### T8: [v0.5.x CODE] 사용자 응답 전달 로직
- **Complexity**: M
- **Dependencies**: T7
- **Description**: Realtime으로 수신한 사용자 응답을 세션에 전달
- **Acceptance Criteria**:
  - [ ] `user_questions` UPDATE 이벤트 수신
  - [ ] 해당 세션 찾기
  - [ ] 응답을 PTY에 전달

```typescript
async handleQuestionResponse(payload: UserQuestionRow): Promise<void> {
  if (payload.status !== 'answered') return;

  // 해당 질문을 기다리는 세션 찾기
  const session = this.sessionManager.findSessionByPendingQuestion(payload.id);
  if (!session) return;

  // 응답 전달
  await this.sessionManager.sendPrompt(session.id, payload.response || '');

  // 세션 상태 복원
  session.status = 'active';
  session.pendingQuestionId = null;
}
```

### T9: [v0.5.x CODE] InvokeHandler 구현
- **Complexity**: L
- **Dependencies**: T5, Epic 3
- **Description**: INVOKE 메시지 처리 핸들러
- **Acceptance Criteria**:
  - [ ] `agent_invocations` 테이블에 INSERT
  - [ ] 대상 에이전트 세션 확인/생성
  - [ ] 작업 프롬프트 전달

```typescript
// packages/office-server/src/protocol/invoke-handler.ts

export class InvokeHandler {
  constructor(
    private supabase: SupabaseClient,
    private sessionManager: AgentSessionManager
  ) {}

  async handle(sessionId: string, message: ProtocolMessage): Promise<string> {
    const callerSession = this.sessionManager.getSession(sessionId);
    if (!callerSession) throw new Error('Caller session not found');

    // 대상 에이전트 찾기
    const { data: targetAgent } = await this.supabase
      .from('office_agents')
      .select('*')
      .eq('office_id', callerSession.officeId)
      .eq('name', message.target)
      .single();

    if (!targetAgent) throw new Error(`Agent ${message.target} not found`);

    // 1. 호출 기록 저장
    const { data: invocation } = await this.supabase
      .from('agent_invocations')
      .insert({
        office_id: callerSession.officeId,
        caller_agent_id: callerSession.agentId,
        callee_agent_id: targetAgent.id,
        reason: message.payload.task,
        context: message.payload.context,
        status: 'pending',
      })
      .select()
      .single();

    // 2. 대상 에이전트 세션 생성 또는 가져오기
    let targetSession = this.sessionManager.getSessionByAgentId(targetAgent.id);
    if (!targetSession) {
      targetSession = await this.sessionManager.createSession(
        targetAgent.id,
        callerSession.officeId
      );
    }

    // 3. 작업 전달
    const prompt = `[작업 요청 from ${callerSession.agentId}]\n${message.payload.task}`;
    await this.sessionManager.sendPrompt(targetSession.id, prompt);

    // 4. 호출 상태 업데이트
    await this.supabase
      .from('agent_invocations')
      .update({ status: 'in_progress' })
      .eq('id', invocation.id);

    return invocation.id;
  }
}
```

### T10: [v0.5.x CODE] 호출 완료 처리 로직
- **Complexity**: M
- **Dependencies**: T9
- **Description**: 에이전트 호출 완료 시 호출자에게 결과 전달
- **Acceptance Criteria**:
  - [ ] `agent_invocations` UPDATE (status: completed)
  - [ ] 호출자 세션에 결과 통지

### T11: [v0.5.x CODE] ResultHandler 구현
- **Complexity**: M
- **Dependencies**: T6, Epic 3
- **Description**: DELIVER_RESULT 메시지 처리 핸들러
- **Acceptance Criteria**:
  - [ ] `agent_results` 테이블에 INSERT
  - [ ] 수신 에이전트에 결과 통지

```typescript
// packages/office-server/src/protocol/result-handler.ts

export class ResultHandler {
  constructor(
    private supabase: SupabaseClient,
    private sessionManager: AgentSessionManager
  ) {}

  async handle(sessionId: string, message: ProtocolMessage): Promise<string> {
    const senderSession = this.sessionManager.getSession(sessionId);
    if (!senderSession) throw new Error('Sender session not found');

    // 수신 에이전트 찾기
    const { data: targetAgent } = await this.supabase
      .from('office_agents')
      .select('*')
      .eq('office_id', senderSession.officeId)
      .eq('name', message.target)
      .single();

    if (!targetAgent) throw new Error(`Agent ${message.target} not found`);

    // 결과 저장
    const { data: result } = await this.supabase
      .from('agent_results')
      .insert({
        office_id: senderSession.officeId,
        from_agent_id: senderSession.agentId,
        to_agent_id: targetAgent.id,
        result_type: message.payload.resultType || 'message',
        content_type: message.payload.contentType,
        content: message.payload.content,
        status: 'pending',
      })
      .select()
      .single();

    // 수신 에이전트 세션에 통지
    const targetSession = this.sessionManager.getSessionByAgentId(targetAgent.id);
    if (targetSession) {
      await this.sessionManager.sendPrompt(
        targetSession.id,
        `[결과 수신 from ${senderSession.agentId}]\n${JSON.stringify(message.payload.content)}`
      );
    }

    return result.id;
  }
}
```

### T12: [v0.5.x CODE] 세션 매니저에 프로토콜 통합
- **Complexity**: M
- **Dependencies**: T7-T11
- **Description**: AgentSessionManager에 프로토콜 파싱 및 핸들링 통합
- **Acceptance Criteria**:
  - [ ] PTY 출력 시 ProtocolParser 호출
  - [ ] 메시지 타입별 핸들러 디스패치
  - [ ] 에러 처리

```typescript
// session-manager.ts에 추가

private setupProtocolHandler(session: AgentSession): void {
  const parser = new ProtocolParser();

  session.ptyProcess.onData((data: string) => {
    // 버퍼에 추가
    session.outputBuffer.content += data;

    // 프로토콜 메시지 파싱
    const messages = parser.parse(session.outputBuffer.content);

    for (const message of messages) {
      this.handleProtocolMessage(session.id, message);
    }
  });
}

private async handleProtocolMessage(sessionId: string, message: ProtocolMessage): Promise<void> {
  switch (message.type) {
    case 'ASK_USER':
      await this.askUserHandler.handle(sessionId, message);
      break;
    case 'INVOKE':
      await this.invokeHandler.handle(sessionId, message);
      break;
    case 'DELIVER_RESULT':
      await this.resultHandler.handle(sessionId, message);
      break;
  }
}
```

### T13: [v0.4.x TESTS] 프로토콜 파서 단위 테스트
- **Complexity**: M
- **Dependencies**: T2-T6
- **Description**: ProtocolParser 단위 테스트
- **Acceptance Criteria**:
  - [ ] ASK_USER 파싱 테스트
  - [ ] INVOKE 파싱 테스트
  - [ ] DELIVER_RESULT 파싱 테스트
  - [ ] ANSI 코드 제거 테스트

### T14: [v0.4.x TESTS] 핸들러 통합 테스트
- **Complexity**: M
- **Dependencies**: T7-T12
- **Description**: 프로토콜 핸들러 통합 테스트
- **Acceptance Criteria**:
  - [ ] Mock SessionManager 사용
  - [ ] ASK_USER → DB INSERT → 응답 전달 플로우
  - [ ] INVOKE → 세션 생성 → 프롬프트 전달 플로우
  - [ ] DELIVER_RESULT → DB INSERT → 통지 플로우

## Test Requirements

### 파서 테스트
```typescript
describe('ProtocolParser', () => {
  it('should parse ASK_USER message', () => {
    const output = `[ASK_USER]
질문: 로그인 방식을 선택해주세요
타입: selection
옵션: ['이메일', '소셜', 'SSO']`;

    const messages = parser.parse(output);
    expect(messages[0].type).toBe('ASK_USER');
    expect(messages[0].payload.question).toBe('로그인 방식을 선택해주세요');
    expect(messages[0].payload.options).toEqual(['이메일', '소셜', 'SSO']);
  });

  it('should parse INVOKE message', () => {
    const output = `[INVOKE:PO]
요구사항 분석을 진행해주세요.
컨텍스트: 로그인 기능 구현`;

    const messages = parser.parse(output);
    expect(messages[0].type).toBe('INVOKE');
    expect(messages[0].target).toBe('PO');
  });
});
```

### 핸들러 테스트
```typescript
describe('AskUserHandler', () => {
  it('should insert question to DB and update session status', async () => {
    const handler = new AskUserHandler(mockSupabase, mockSessionManager);

    const message: ProtocolMessage = {
      type: 'ASK_USER',
      payload: { question: 'Test?', type: 'text' },
      rawContent: '[ASK_USER]\n질문: Test?',
    };

    const questionId = await handler.handle('session-1', message);

    expect(mockSupabase.from).toHaveBeenCalledWith('user_questions');
    expect(mockSessionManager.getSession('session-1').status).toBe('waiting_input');
  });
});
```
