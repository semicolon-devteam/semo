# 07-Agent Communication: 구현 태스크

> spec.md 기반 구현 체크리스트

---

## Phase 1: 데이터 모델 및 DB

### TASK-AC01: DB 스키마 확장
- [ ] `agent_messages` 테이블 컬럼 추가
  - priority, subject, reply_to, status, read_at
- [ ] `handoff_requests` 테이블 생성
- [ ] `collaboration_sessions` 테이블 생성
- [ ] `collaboration_messages` 테이블 생성
- [ ] 인덱스 추가
- [ ] Supabase 마이그레이션 파일 작성

### TASK-AC02: 타입 정의
- [ ] `AgentMessage` 인터페이스 확장
- [ ] `MessageType`, `MessagePriority`, `MessageStatus` 타입
- [ ] `MessageContext` 인터페이스
- [ ] `HandoffRequest`, `HandoffStatus` 인터페이스
- [ ] `CollaborationSession` 인터페이스

---

## Phase 2: 코어 서비스

### TASK-AC03: MessageService 구현
- [ ] `sendMessage()` - 메시지 전송
- [ ] `sendBroadcast()` - 브로드캐스트 전송
- [ ] `getThread()` - 대화 스레드 조회
- [ ] `markAsRead()` - 읽음 표시
- [ ] `getUnreadCount()` - 읽지 않은 메시지 수
- [ ] urgent 우선순위 핸들러
- [ ] 단위 테스트 작성

### TASK-AC04: HandoffService 구현
- [ ] `requestHandoff()` - 핸드오프 요청
- [ ] `acceptHandoff()` - 핸드오프 수락
- [ ] `rejectHandoff()` - 핸드오프 거절
- [ ] `detectHandoffLoop()` - 순환 핸드오프 감지
- [ ] Job 담당자 변경 로직
- [ ] 단위 테스트 작성

### TASK-AC05: CollaborationService 구현
- [ ] `createSession()` - 세션 생성
- [ ] `joinSession()` - 세션 참여
- [ ] `leaveSession()` - 세션 퇴장
- [ ] `endSession()` - 세션 종료
- [ ] `sendSessionMessage()` - 세션 메시지 전송
- [ ] `updateSharedContext()` - 공유 컨텍스트 업데이트
- [ ] 단위 테스트 작성

---

## Phase 3: API 엔드포인트

### TASK-AC06: 메시지 API
- [ ] `POST /api/offices/:id/messages` - 메시지 전송
- [ ] `GET /api/offices/:id/messages` - 메시지 목록
- [ ] `GET /api/offices/:id/agents/:agentId/messages` - Agent 메시지
- [ ] `POST /api/offices/:id/messages/:msgId/read` - 읽음 표시
- [ ] `POST /api/offices/:id/messages/:msgId/reply` - 답장
- [ ] 입력 검증 및 에러 응답

### TASK-AC07: 핸드오프 API
- [ ] `POST /api/offices/:id/handoffs` - 핸드오프 요청
- [ ] `GET /api/offices/:id/handoffs` - 핸드오프 목록
- [ ] `POST /api/offices/:id/handoffs/:handoffId/accept` - 수락
- [ ] `POST /api/offices/:id/handoffs/:handoffId/reject` - 거절
- [ ] 입력 검증 및 에러 응답

### TASK-AC08: 협업 세션 API
- [ ] `POST /api/offices/:id/collaborations` - 세션 생성
- [ ] `GET /api/offices/:id/collaborations/:sessionId` - 세션 조회
- [ ] `POST /api/offices/:id/collaborations/:sessionId/join` - 참여
- [ ] `POST /api/offices/:id/collaborations/:sessionId/leave` - 퇴장
- [ ] `POST /api/offices/:id/collaborations/:sessionId/end` - 종료
- [ ] `POST /api/offices/:id/collaborations/:sessionId/messages` - 메시지

---

## Phase 4: Realtime 연동

### TASK-AC09: Supabase Realtime 채널
- [ ] Agent 개인 채널 구현
- [ ] Office 전체 채널 구현
- [ ] 협업 세션 채널 구현
- [ ] 메시지 이벤트 핸들러
- [ ] 핸드오프 이벤트 핸들러
- [ ] 협업 이벤트 핸들러

### TASK-AC10: 클라이언트 Hooks
- [ ] `useAgentMessages()` - Agent 메시지 구독
- [ ] `useHandoffRequests()` - 핸드오프 구독
- [ ] `useCollaborationSession()` - 협업 세션 구독
- [ ] 메시지 캐싱 전략

---

## Phase 5: UI 컴포넌트

### TASK-AC11: 메시지 UI
- [ ] `MessageBubble` - 말풍선 컴포넌트
- [ ] `ChatLog` - 채팅 로그 패널
- [ ] `MessageComposer` - 메시지 입력
- [ ] 우선순위별 스타일링
- [ ] 읽음/안읽음 표시

### TASK-AC12: 핸드오프 UI
- [ ] `HandoffNotification` - 핸드오프 알림
- [ ] `HandoffModal` - 핸드오프 상세 모달
- [ ] 수락/거절 버튼
- [ ] 핸드오프 이력 표시

### TASK-AC13: 협업 세션 UI
- [ ] `CollaborationPanel` - 협업 패널
- [ ] `SessionParticipants` - 참여자 목록
- [ ] `SharedContextView` - 공유 컨텍스트 표시
- [ ] 실시간 메시지 표시

---

## Phase 6: 통합

### TASK-AC14: office-server 통합
- [ ] 서비스 초기화
- [ ] API 라우터 등록
- [ ] Realtime 핸들러 등록

### TASK-AC15: office-web 통합
- [ ] 스토어 업데이트 (messages, handoffs, collaborations)
- [ ] UI 컴포넌트 연동
- [ ] PixiJS Agent 아바타와 연동 (말풍선 표시)

### TASK-AC16: Session Execution 연동
- [ ] Agent 세션에서 메시지 생성
- [ ] 핸드오프 시 세션 컨텍스트 전달
- [ ] 협업 세션과 Claude Code 세션 연동

---

## Phase 7: 테스트 및 문서화

### TASK-AC17: 테스트
- [ ] 단위 테스트 (각 서비스)
- [ ] 통합 테스트 (전체 플로우)
- [ ] Realtime 테스트
- [ ] E2E 테스트 (메시지 전송 → 수신)

### TASK-AC18: 문서화
- [ ] API 문서
- [ ] 프로토콜 가이드
- [ ] UI 컴포넌트 가이드

---

## Dependencies

| 태스크 | 의존 |
|--------|------|
| TASK-AC03~05 | TASK-AC01, AC02 |
| TASK-AC06~08 | TASK-AC03~05 |
| TASK-AC09~10 | TASK-AC06~08 |
| TASK-AC11~13 | TASK-AC09~10 |
| TASK-AC14~16 | TASK-AC11~13 |
| TASK-AC17~18 | 전체 |

---

## Acceptance Criteria

- [ ] 1:1 메시지가 대상 Agent에게 실시간 전달됨
- [ ] 브로드캐스트가 모든 Agent에게 전달됨
- [ ] 핸드오프 수락 시 Job 담당자가 변경됨
- [ ] 순환 핸드오프가 방지됨
- [ ] 협업 세션에서 실시간 메시지 교환됨
- [ ] urgent 메시지가 우선 처리됨
- [ ] UI에 메시지/핸드오프/협업이 표시됨
