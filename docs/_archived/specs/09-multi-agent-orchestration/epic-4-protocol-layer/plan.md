# Multi-Agent Orchestration - Protocol Layer Implementation Plan

## Overview

Claude Code 세션 출력에서 프로토콜 메시지를 파싱하고 처리하는 핸들러 구현.
3가지 핵심 프로토콜: `[ASK_USER]`, `[INVOKE:Agent]`, `[DELIVER_RESULT:Agent]`

## Technical Approach

### 1. 프로토콜 메시지 파서 설계

```typescript
// packages/office-server/src/protocol/parser.ts

interface ProtocolMessage {
  type: 'ASK_USER' | 'INVOKE' | 'DELIVER_RESULT' | 'STEP_COMPLETE';
  target?: string;        // INVOKE, DELIVER_RESULT의 대상 에이전트
  payload: Record<string, unknown>;
  rawContent: string;
}

class ProtocolParser {
  // PTY 출력에서 프로토콜 메시지 추출
  parse(output: string): ProtocolMessage[];

  // ANSI 이스케이프 코드 제거
  private stripAnsi(text: string): string;

  // 개별 프로토콜 파서
  private parseAskUser(content: string): ProtocolMessage | null;
  private parseInvoke(content: string): ProtocolMessage | null;
  private parseDeliverResult(content: string): ProtocolMessage | null;
}
```

### 2. ASK_USER 처리 흐름

```
PTY 출력 → [ASK_USER] 감지
        ↓
ProtocolParser.parseAskUser() 호출
        ↓
user_questions 테이블 INSERT
        ↓
세션 상태를 'waiting_input'으로 변경
        ↓
(Realtime) 웹 UI에 질문 표시
        ↓
사용자 응답 (user_questions UPDATE)
        ↓
(Realtime) 세션에 응답 전달
        ↓
세션 상태를 'active'로 변경
```

### 3. INVOKE 처리 흐름

```
PTY 출력 → [INVOKE:AgentName] 감지
        ↓
ProtocolParser.parseInvoke() 호출
        ↓
agent_invocations 테이블 INSERT
        ↓
대상 에이전트 세션 확인
  [존재함] → 기존 세션에 작업 전달
  [없음]   → 새 세션 생성 후 작업 전달
        ↓
호출 완료 대기 (agent_invocations UPDATE)
        ↓
결과를 호출자 세션에 전달
```

### 4. DELIVER_RESULT 처리 흐름

```
PTY 출력 → [DELIVER_RESULT:AgentName] 감지
        ↓
ProtocolParser.parseDeliverResult() 호출
        ↓
agent_results 테이블 INSERT
        ↓
수신 에이전트 세션에 결과 통지
(또는 대기열에 추가)
```

### 5. 프로토콜 핸들러 구현

```typescript
// packages/office-server/src/protocol/ask-user-handler.ts

class AskUserHandler {
  constructor(
    private supabase: SupabaseClient,
    private sessionManager: AgentSessionManager
  ) {}

  async handle(sessionId: string, message: ProtocolMessage): Promise<void> {
    // 1. DB에 질문 저장
    const { data: question } = await this.supabase
      .from('user_questions')
      .insert({
        agent_id: session.agentId,
        office_id: session.officeId,
        question_type: message.payload.type,
        question: message.payload.question,
        options: message.payload.options,
        status: 'pending',
      })
      .select()
      .single();

    // 2. 세션 상태 업데이트
    await this.sessionManager.setSessionStatus(sessionId, 'waiting_input');

    // 3. 응답 대기 핸들러 등록
    this.sessionManager.waitForQuestionResponse(sessionId, question.id);
  }

  async handleResponse(questionId: string, response: string): Promise<void> {
    const { data: question } = await this.supabase
      .from('user_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    // 해당 세션에 응답 전달
    await this.sessionManager.sendPrompt(
      question.session_id,
      response
    );
  }
}
```

## Dependencies

### 외부 의존성
- Epic 3의 `AgentSessionManager`
- `@supabase/supabase-js` (Realtime 포함)

### 선행 작업
- Epic 1-3 완료
- `user_questions`, `agent_invocations`, `agent_results` 테이블 존재

## Risk Assessment

### 높음
- **PTY 출력 파싱 복잡도**: 프로토콜 메시지가 여러 줄에 걸쳐 출력될 수 있음
  - 대안: 버퍼링 후 완전한 메시지 감지

### 중간
- **동시 호출 경쟁 조건**: 여러 에이전트가 동시에 같은 에이전트 호출
  - 대안: Epic 6에서 동시성 처리로 해결

## File Structure

```
packages/office-server/src/protocol/
├── parser.ts              # 프로토콜 메시지 파서
├── ask-user-handler.ts    # [ASK_USER] 처리
├── invoke-handler.ts      # [INVOKE:Agent] 처리
├── result-handler.ts      # [DELIVER_RESULT:Agent] 처리
├── types.ts               # 프로토콜 타입 정의
└── index.ts               # 통합 익스포트
```
