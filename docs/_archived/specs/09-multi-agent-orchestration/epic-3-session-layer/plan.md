# Multi-Agent Orchestration - Session Layer Implementation Plan

## Overview

Claude Code 세션을 생성, 관리, 제어하는 `AgentSessionManager` 구현.
node-pty를 사용하여 터미널을 에뮬레이션하고, Supabase Realtime을 통해 명령을 수신.

## Technical Approach

### 1. AgentSessionManager 클래스 설계

```typescript
class AgentSessionManager extends EventEmitter {
  private sessions: Map<string, AgentSession> = new Map();
  private definitionSync: AgentDefinitionSync;
  private realtimeChannel: RealtimeChannel | null = null;

  constructor(private supabase: SupabaseClient) {
    this.definitionSync = new AgentDefinitionSync(supabase);
  }

  // 세션 생성
  async createSession(agentId: string, officeId: string): Promise<AgentSession>

  // 세션 종료
  async destroySession(sessionId: string): Promise<void>

  // 프롬프트 전송
  async sendPrompt(sessionId: string, prompt: string): Promise<void>

  // 프롬프트 전송 및 응답 대기
  async sendPromptAndWait(sessionId: string, prompt: string): Promise<string>

  // Realtime 구독 시작
  async startListening(officeId: string): Promise<void>

  // Realtime 구독 종료
  async stopListening(): Promise<void>
}
```

### 2. 세션 생성 흐름

```
createSession(agentId, officeId)
├── 1. Worktree 경로 확보 (getOrCreateWorktree)
├── 2. DB → 파일 동기화 (definitionSync.syncToWorktree)
├── 3. node-pty 터미널 생성
├── 4. Claude Code 시작 (`claude` 명령)
├── 5. 세션 객체 등록 (sessions Map)
├── 6. PTY 출력 이벤트 핸들러 설정
└── 7. DB에 세션 상태 등록 (agent_sessions)
```

### 3. PTY 출력 처리

```typescript
interface OutputBuffer {
  content: string;
  lastUpdate: number;
  isWaitingForPrompt: boolean;
}

// 출력 이벤트 핸들러
pty.onData((data: string) => {
  buffer.content += data;
  buffer.lastUpdate = Date.now();

  // 프롬프트 대기 상태 감지
  if (this.isPromptReady(buffer.content)) {
    buffer.isWaitingForPrompt = true;
    this.emit('output', sessionId, buffer.content);
    buffer.content = '';
  }
});
```

### 4. Supabase Realtime 구독

```typescript
async startListening(officeId: string): Promise<void> {
  this.realtimeChannel = this.supabase
    .channel(`office:${officeId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'agent_commands',
      filter: `office_id=eq.${officeId}`,
    }, (payload) => this.handleCommand(payload.new))
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'user_questions',
      filter: `office_id=eq.${officeId}`,
    }, (payload) => this.handleQuestionResponse(payload.new))
    .subscribe();
}
```

## Dependencies

### 외부 의존성
- `node-pty` (터미널 에뮬레이션)
- `@supabase/supabase-js` (Realtime 포함)
- Epic 2의 `AgentDefinitionSync`

### 선행 작업
- Epic 1-2 완료
- `agent_sessions` 테이블 필요 (Epic 1에서 누락 시 추가)

## Risk Assessment

### 높음
- **PTY 출력 파싱 복잡도**: Claude Code 출력에서 프롬프트 대기 상태 감지가 어려울 수 있음
  - 대안: 타임아웃 기반 감지 + 정규식 패턴 조합

### 중간
- **Realtime 연결 끊김**: 네트워크 문제로 Realtime 연결이 끊길 수 있음
  - 대안: 자동 재연결 로직 구현

## File Structure

```
packages/office-server/src/
├── agent-client/
│   ├── session-manager.ts      # AgentSessionManager
│   ├── realtime-handler.ts     # Realtime 이벤트 처리
│   ├── output-parser.ts        # PTY 출력 파싱
│   └── types.ts                # 타입 정의
└── sync/
    └── (Epic 2에서 구현)
```
