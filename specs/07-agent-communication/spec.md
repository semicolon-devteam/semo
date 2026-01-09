# 07-Agent Communication: Agent 간 통신

> Agent 간 메시지 전달, 핸드오프, 협업 프로토콜

---

## Overview

Office 내 Agent들은 독립적으로 작업하지만, 특정 상황에서 다른 Agent와 통신해야 합니다.
이 모듈은 Agent 간 메시지 전달, 작업 핸드오프, 협업 요청 등의 통신 프로토콜을 정의합니다.

### 통신 유형

```text
┌─────────────────────────────────────────────────────────────┐
│                    Agent Communication Types                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Direct Message (1:1)                                    │
│     Agent-FE ──────────────────▶ Agent-BE                   │
│               "API 스펙 확인 요청"                           │
│                                                             │
│  2. Broadcast (1:N)                                         │
│     Agent-PO ──────────────────▶ All Agents                 │
│               "스프린트 목표 공유"                            │
│                                                             │
│  3. Handoff (작업 인계)                                      │
│     Agent-BE ──────────────────▶ Agent-QA                   │
│               "API 완료, 테스트 요청"                         │
│                                                             │
│  4. Request-Response (요청-응답)                             │
│     Agent-FE ◀─────────────────▶ Agent-BE                   │
│               "타입 정의 요청/응답"                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## User Stories

### US-AC01: 직접 메시지 전송

> "Agent가 다른 Agent에게 직접 메시지를 보낸다"

**AC**:
- 특정 Agent를 대상으로 메시지 전송
- 메시지 타입: notification, question, request
- 수신 Agent에게 실시간 전달
- 메시지 히스토리 저장

### US-AC02: 브로드캐스트 메시지

> "Agent가 Office 내 모든 Agent에게 공지한다"

**AC**:
- 모든 활성 Agent에게 메시지 전달
- 중요도 레벨: info, warning, critical
- Realtime 채널로 브로드캐스트
- UI에 공지 표시

### US-AC03: 작업 핸드오프

> "Agent가 작업을 다른 Agent에게 인계한다"

**AC**:
- 핸드오프 컨텍스트 포함 (파일, 변경사항, 설명)
- 수신 Agent의 Job 큐에 자동 추가
- 핸드오프 이력 추적
- 순환 핸드오프 방지

### US-AC04: 요청-응답 패턴

> "Agent가 다른 Agent에게 정보를 요청하고 응답을 받는다"

**AC**:
- 동기/비동기 요청 지원
- 타임아웃 설정 가능
- 응답 대기 중 상태 표시
- 응답 실패 시 폴백 처리

### US-AC05: 협업 세션

> "여러 Agent가 동시에 협업 세션에 참여한다"

**AC**:
- 협업 세션 생성/종료
- 세션 내 실시간 메시지 교환
- 공유 컨텍스트 관리
- 세션 로그 저장

### US-AC06: 메시지 우선순위

> "긴급 메시지가 일반 메시지보다 우선 처리된다"

**AC**:
- 우선순위: low, normal, high, urgent
- urgent 메시지는 현재 작업 중단 트리거
- 우선순위별 알림 방식 차등
- UI에 우선순위 표시

---

## Data Models

### AgentMessage

```typescript
interface AgentMessage {
  id: string;
  office_id: string;
  from_agent_id: string;
  to_agent_id?: string;      // null = broadcast
  message_type: MessageType;
  priority: MessagePriority;
  subject?: string;
  content: string;
  context?: MessageContext;
  reply_to?: string;         // 답장 대상 메시지 ID
  status: MessageStatus;
  created_at: string;
  read_at?: string;
}

type MessageType =
  | 'notification'  // 단순 알림
  | 'question'      // 질문 (응답 기대)
  | 'request'       // 작업 요청
  | 'response'      // 응답
  | 'handoff'       // 작업 인계
  | 'broadcast';    // 전체 공지

type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

type MessageStatus = 'sent' | 'delivered' | 'read' | 'responded';
```

### MessageContext

```typescript
interface MessageContext {
  // 관련 Job/PR 정보
  job_id?: string;
  pr_number?: number;

  // 파일 참조
  files?: string[];

  // 코드 스니펫
  code_snippets?: {
    file: string;
    line_start: number;
    line_end: number;
    content: string;
  }[];

  // 커스텀 데이터
  metadata?: Record<string, unknown>;
}
```

### HandoffRequest

```typescript
interface HandoffRequest {
  id: string;
  office_id: string;
  from_agent_id: string;
  to_agent_id: string;
  job_id: string;
  reason: string;
  context: {
    description: string;
    files_modified: string[];
    pending_tasks: string[];
    notes?: string;
  };
  status: HandoffStatus;
  created_at: string;
  accepted_at?: string;
}

type HandoffStatus =
  | 'pending'    // 대기 중
  | 'accepted'   // 수락됨
  | 'rejected'   // 거절됨
  | 'completed'; // 완료됨
```

### CollaborationSession

```typescript
interface CollaborationSession {
  id: string;
  office_id: string;
  title: string;
  participants: string[];    // agent_id 목록
  status: 'active' | 'ended';
  shared_context: {
    objective: string;
    files: string[];
    decisions: string[];
  };
  created_at: string;
  ended_at?: string;
}
```

---

## DB Schema

### 테이블: agent_messages (확장)

```sql
-- agent_messages 테이블 확장
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS subject VARCHAR(200);
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES agent_messages(id);
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 인덱스 추가
CREATE INDEX idx_messages_from ON agent_messages(from_agent_id);
CREATE INDEX idx_messages_to ON agent_messages(to_agent_id);
CREATE INDEX idx_messages_priority ON agent_messages(priority);
CREATE INDEX idx_messages_reply ON agent_messages(reply_to);
```

### 테이블: handoff_requests

```sql
CREATE TABLE handoff_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES office_agents(id),
  to_agent_id UUID REFERENCES office_agents(id),
  job_id UUID REFERENCES job_queue(id),
  reason TEXT,
  context JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_handoff_office ON handoff_requests(office_id);
CREATE INDEX idx_handoff_status ON handoff_requests(status);
```

### 테이블: collaboration_sessions

```sql
CREATE TABLE collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  participants UUID[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  shared_context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_collab_office ON collaboration_sessions(office_id);
CREATE INDEX idx_collab_status ON collaboration_sessions(status);
```

### 테이블: collaboration_messages

```sql
CREATE TABLE collaboration_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES office_agents(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collab_msg_session ON collaboration_messages(session_id);
```

---

## API Endpoints

### 메시지

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices/:id/messages` | 메시지 전송 |
| GET | `/api/offices/:id/messages` | 메시지 목록 조회 |
| GET | `/api/offices/:id/agents/:agentId/messages` | Agent 메시지 조회 |
| POST | `/api/offices/:id/messages/:msgId/read` | 읽음 표시 |
| POST | `/api/offices/:id/messages/:msgId/reply` | 답장 |

### 핸드오프

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices/:id/handoffs` | 핸드오프 요청 |
| GET | `/api/offices/:id/handoffs` | 핸드오프 목록 |
| POST | `/api/offices/:id/handoffs/:handoffId/accept` | 핸드오프 수락 |
| POST | `/api/offices/:id/handoffs/:handoffId/reject` | 핸드오프 거절 |

### 협업 세션

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices/:id/collaborations` | 세션 생성 |
| GET | `/api/offices/:id/collaborations/:sessionId` | 세션 조회 |
| POST | `/api/offices/:id/collaborations/:sessionId/join` | 세션 참여 |
| POST | `/api/offices/:id/collaborations/:sessionId/leave` | 세션 퇴장 |
| POST | `/api/offices/:id/collaborations/:sessionId/end` | 세션 종료 |
| POST | `/api/offices/:id/collaborations/:sessionId/messages` | 세션 메시지 전송 |

---

## Service Implementation

### MessageService

```typescript
class MessageService {
  // 메시지 전송
  async sendMessage(payload: SendMessagePayload): Promise<AgentMessage> {
    // 1. 메시지 저장
    const message = await this.db.insert('agent_messages', {
      ...payload,
      status: 'sent',
      created_at: new Date().toISOString()
    });

    // 2. Realtime 전송
    if (payload.to_agent_id) {
      // Direct message
      await this.realtime.sendToAgent(payload.to_agent_id, {
        type: 'agent_message',
        message
      });
    } else {
      // Broadcast
      await this.realtime.broadcast(payload.office_id, {
        type: 'agent_broadcast',
        message
      });
    }

    // 3. urgent 우선순위 처리
    if (payload.priority === 'urgent') {
      await this.triggerUrgentHandler(payload.to_agent_id, message);
    }

    return message;
  }

  // 대화 스레드 조회
  async getThread(messageId: string): Promise<AgentMessage[]> {
    // reply_to 체인을 따라 전체 스레드 조회
  }

  // 읽지 않은 메시지 수
  async getUnreadCount(agentId: string): Promise<number> {
    return this.db.count('agent_messages', {
      to_agent_id: agentId,
      read_at: null
    });
  }
}
```

### HandoffService

```typescript
class HandoffService {
  // 핸드오프 요청
  async requestHandoff(payload: HandoffPayload): Promise<HandoffRequest> {
    // 1. 순환 핸드오프 체크
    const hasLoop = await this.detectHandoffLoop(
      payload.job_id,
      payload.to_agent_id
    );
    if (hasLoop) {
      throw new Error('Circular handoff detected');
    }

    // 2. 핸드오프 요청 저장
    const handoff = await this.db.insert('handoff_requests', {
      ...payload,
      status: 'pending'
    });

    // 3. 대상 Agent에게 알림
    await this.messageService.sendMessage({
      office_id: payload.office_id,
      from_agent_id: payload.from_agent_id,
      to_agent_id: payload.to_agent_id,
      message_type: 'handoff',
      priority: 'high',
      subject: '작업 인계 요청',
      content: payload.reason,
      context: {
        handoff_id: handoff.id,
        job_id: payload.job_id
      }
    });

    return handoff;
  }

  // 핸드오프 수락
  async acceptHandoff(handoffId: string): Promise<void> {
    const handoff = await this.db.findById('handoff_requests', handoffId);

    // 1. 상태 업데이트
    await this.db.update('handoff_requests', handoffId, {
      status: 'accepted',
      accepted_at: new Date().toISOString()
    });

    // 2. Job 담당자 변경
    await this.db.update('job_queue', handoff.job_id, {
      agent_id: handoff.to_agent_id
    });

    // 3. 원래 Agent에게 알림
    await this.messageService.sendMessage({
      office_id: handoff.office_id,
      from_agent_id: handoff.to_agent_id,
      to_agent_id: handoff.from_agent_id,
      message_type: 'notification',
      subject: '핸드오프 수락됨',
      content: `작업이 인계되었습니다.`
    });
  }

  // 순환 핸드오프 감지
  private async detectHandoffLoop(
    jobId: string,
    targetAgentId: string
  ): Promise<boolean> {
    // 같은 Job에 대해 이미 해당 Agent가 핸드오프한 이력이 있는지 확인
    const history = await this.db.find('handoff_requests', {
      job_id: jobId,
      from_agent_id: targetAgentId,
      status: 'completed'
    });
    return history.length > 0;
  }
}
```

### CollaborationService

```typescript
class CollaborationService {
  // 협업 세션 생성
  async createSession(payload: CreateSessionPayload): Promise<CollaborationSession> {
    const session = await this.db.insert('collaboration_sessions', {
      office_id: payload.office_id,
      title: payload.title,
      participants: payload.participants,
      shared_context: payload.context || {},
      status: 'active'
    });

    // 참여자들에게 알림
    for (const agentId of payload.participants) {
      await this.realtime.sendToAgent(agentId, {
        type: 'collaboration_invite',
        session
      });
    }

    return session;
  }

  // 세션 내 메시지 전송
  async sendSessionMessage(
    sessionId: string,
    agentId: string,
    content: string
  ): Promise<void> {
    // 1. 메시지 저장
    const message = await this.db.insert('collaboration_messages', {
      session_id: sessionId,
      agent_id: agentId,
      content
    });

    // 2. 참여자들에게 브로드캐스트
    const session = await this.db.findById('collaboration_sessions', sessionId);
    await this.realtime.broadcastToAgents(session.participants, {
      type: 'collaboration_message',
      session_id: sessionId,
      message
    });
  }

  // 공유 컨텍스트 업데이트
  async updateSharedContext(
    sessionId: string,
    updates: Partial<SharedContext>
  ): Promise<void> {
    const session = await this.db.findById('collaboration_sessions', sessionId);
    const newContext = {
      ...session.shared_context,
      ...updates
    };

    await this.db.update('collaboration_sessions', sessionId, {
      shared_context: newContext
    });

    // 변경 사항 브로드캐스트
    await this.realtime.broadcastToAgents(session.participants, {
      type: 'collaboration_context_update',
      session_id: sessionId,
      context: newContext
    });
  }
}
```

---

## Communication Protocols

### 1. Request-Response 패턴

```text
Agent-FE                                Agent-BE
    │                                       │
    │  REQUEST (question)                   │
    │  "GET /api/users 응답 형식?"          │
    │──────────────────────────────────────▶│
    │                                       │
    │                              처리 중...│
    │                                       │
    │  RESPONSE                             │
    │  "{ users: User[], total: number }"   │
    │◀──────────────────────────────────────│
    │                                       │
```

### 2. Handoff 패턴

```text
Agent-BE                                Agent-QA
    │                                       │
    │  HANDOFF REQUEST                      │
    │  job_id: job-be-001                   │
    │  reason: "API 완료, 테스트 필요"       │
    │──────────────────────────────────────▶│
    │                                       │
    │  HANDOFF ACCEPT                       │
    │◀──────────────────────────────────────│
    │                                       │
    │  [Job 담당자 변경: BE → QA]            │
    │                                       │
```

### 3. Collaboration 패턴

```text
┌─────────────────────────────────────────────┐
│           Collaboration Session             │
│  Title: "API 스펙 논의"                      │
│  Participants: [FE, BE, PO]                 │
├─────────────────────────────────────────────┤
│                                             │
│  PO: "인증 방식 JWT로 결정"                   │
│  BE: "액세스 토큰 만료 시간은?"               │
│  PO: "15분, 리프레시 토큰 7일"               │
│  FE: "토큰 갱신 로직은 BE에서?"              │
│  BE: "네, /api/auth/refresh 제공"           │
│                                             │
│  [Shared Context Updated]                   │
│  - decisions: ["JWT 인증", "15분/7일"]      │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Realtime Integration

### Supabase Realtime 채널

```typescript
// Agent별 개인 채널
const agentChannel = supabase.channel(`agent:${agentId}`)
  .on('broadcast', { event: 'agent_message' }, handleMessage)
  .on('broadcast', { event: 'handoff_request' }, handleHandoff)
  .subscribe();

// Office 전체 채널
const officeChannel = supabase.channel(`office:${officeId}:messages`)
  .on('broadcast', { event: 'agent_broadcast' }, handleBroadcast)
  .subscribe();

// 협업 세션 채널
const collabChannel = supabase.channel(`collab:${sessionId}`)
  .on('broadcast', { event: 'collaboration_message' }, handleCollabMessage)
  .on('broadcast', { event: 'context_update' }, handleContextUpdate)
  .subscribe();
```

---

## UI Integration

### 메시지 표시

```text
┌─────────────────────────────────────────────┐
│  [말풍선 - Agent-FE]                        │
│  ┌─────────────────────┐                    │
│  │ API 연동 확인해주세요 │◀─── 최근 메시지    │
│  └─────────────────────┘                    │
│                                             │
│  [채팅 로그 패널]                            │
│  BE → FE: "API 완료! GET /api/users"        │
│  FE: "확인했습니다. 연동 시작합니다"          │
│  QA: "테스트 케이스 작성 중..."              │
│                                             │
└─────────────────────────────────────────────┘
```

### 핸드오프 알림

```text
┌─────────────────────────────────────────────┐
│  🔔 핸드오프 요청                            │
│  ─────────────────────────────────────────  │
│  From: Agent-BE (이백엔드)                   │
│  Job: API 인증 구현                          │
│  이유: "API 완료, 테스트 필요"               │
│                                             │
│  [수락]  [거절]  [상세보기]                   │
└─────────────────────────────────────────────┘
```

---

## Sequence Diagram

### 메시지 전송 플로우

```text
Agent-FE      Office Server      Supabase        Agent-BE
    │              │                │               │
    │  POST /messages              │               │
    │─────────────▶│                │               │
    │              │  INSERT        │               │
    │              │───────────────▶│               │
    │              │                │               │
    │              │  broadcast     │               │
    │              │───────────────▶│               │
    │              │                │  notify       │
    │              │                │──────────────▶│
    │              │                │               │
    │◀─────────────│                │               │
    │  { id, status }              │               │
```

---

## Related Specs

- [01-Core](../01-core/spec.md) - Agent 정의
- [04-Session Execution](../04-session-execution/spec.md) - 세션 관리
- [06-Realtime UI](../06-realtime-ui/spec.md) - UI 표시
- [08-Job Scheduler](../08-job-scheduler/spec.md) - Job 관리
