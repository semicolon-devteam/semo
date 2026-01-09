# 07-Agent Communication: 구현 계획

> Agent 간 메시지 전달, 핸드오프, 협업 프로토콜

---

## 요구사항 요약

- Agent 간 직접 메시지 (1:1)
- 브로드캐스트 메시지 (1:N)
- 작업 핸드오프 (인계)
- 요청-응답 패턴 (동기/비동기)
- 협업 세션
- 메시지 우선순위 (low, normal, high, urgent)

---

## 영향 범위 분석

| 영역 | 변경 유형 | 설명 |
|------|----------|---------|
| `packages/office-server/src/api/messages/` | 신규 | 메시지 API |
| `packages/office-server/src/api/handoffs/` | 신규 | 핸드오프 API |
| `packages/office-server/src/api/collaborations/` | 신규 | 협업 세션 API |
| `packages/office-server/src/services/message/` | 신규 | MessageService, HandoffService, CollaborationService |
| `packages/office-server/src/db/migrations/` | 수정 | agent_messages, handoff_requests, collaboration_sessions 테이블 |
| `packages/office-web/src/components/ChatPanel.tsx` | 신규 | 채팅 패널 UI |
| `packages/office-web/src/components/HandoffDialog.tsx` | 신규 | 핸드오프 대화창 |

---

## 구현 단계

### Phase 1: DB 스키마 및 모델 정의

**작업 내용**:
1. `agent_messages` 테이블 확장
   - priority, subject, reply_to, status, read_at 필드 추가
   - 인덱스 추가 (from, to, priority, reply_to)
2. `handoff_requests` 테이블 생성
3. `collaboration_sessions`, `collaboration_messages` 테이블 생성
4. TypeScript 인터페이스 정의

**예상 시간**: 1일

**체크리스트**:
- [ ] `agent_messages` 테이블 ALTER 마이그레이션
- [ ] `handoff_requests` 테이블 CREATE 마이그레이션
- [ ] `collaboration_sessions` 테이블 CREATE 마이그레이션
- [ ] `collaboration_messages` 테이블 CREATE 마이그레이션
- [ ] TypeScript 인터페이스 작성
- [ ] 마이그레이션 테스트

---

### Phase 2: MessageService

**작업 내용**:
1. `MessageService` 클래스 작성
   - `sendMessage(payload)` - 메시지 전송
   - `getThread(messageId)` - 대화 스레드 조회
   - `getUnreadCount(agentId)` - 읽지 않은 메시지 수
   - `markAsRead(messageId)` - 읽음 표시
2. Realtime 통합
   - Direct message → Agent 채널
   - Broadcast → Office 채널
3. urgent 우선순위 처리 로직

**예상 시간**: 2일

**체크리스트**:
- [ ] `MessageService` 클래스
- [ ] `sendMessage()` 메서드
- [ ] `getThread()` - reply_to 체인 조회
- [ ] `getUnreadCount()` 메서드
- [ ] `markAsRead()` 메서드
- [ ] Realtime 채널 전송 (`agent:{id}`, `office:{id}:messages`)
- [ ] urgent 메시지 핸들러 (세션 중단 트리거)
- [ ] 단위 테스트

---

### Phase 3: HandoffService

**작업 내용**:
1. `HandoffService` 클래스 작성
   - `requestHandoff(payload)` - 핸드오프 요청
   - `acceptHandoff(handoffId)` - 핸드오프 수락
   - `rejectHandoff(handoffId)` - 핸드오프 거절
   - `completeHandoff(handoffId)` - 핸드오프 완료
2. 순환 핸드오프 감지 로직
3. Job 담당자 자동 변경

**예상 시간**: 2일

**체크리스트**:
- [ ] `HandoffService` 클래스
- [ ] `requestHandoff()` 메서드
- [ ] `detectHandoffLoop()` - 순환 감지 함수
- [ ] `acceptHandoff()` - Job 담당자 변경
- [ ] `rejectHandoff()` 메서드
- [ ] `completeHandoff()` 메서드
- [ ] MessageService 연동 (알림)
- [ ] 단위 테스트

---

### Phase 4: CollaborationService

**작업 내용**:
1. `CollaborationService` 클래스 작성
   - `createSession(payload)` - 세션 생성
   - `sendSessionMessage(sessionId, agentId, content)` - 세션 메시지
   - `updateSharedContext(sessionId, updates)` - 공유 컨텍스트 업데이트
   - `joinSession(sessionId, agentId)` - 세션 참여
   - `leaveSession(sessionId, agentId)` - 세션 퇴장
   - `endSession(sessionId)` - 세션 종료
2. 협업 채널 브로드캐스트

**예상 시간**: 2일

**체크리스트**:
- [ ] `CollaborationService` 클래스
- [ ] `createSession()` 메서드
- [ ] `sendSessionMessage()` 메서드
- [ ] `updateSharedContext()` 메서드
- [ ] `joinSession()` / `leaveSession()` 메서드
- [ ] `endSession()` 메서드
- [ ] Realtime 채널 브로드캐스트 (`collab:{sessionId}`)
- [ ] 단위 테스트

---

### Phase 5: API 엔드포인트

**작업 내용**:
1. 메시지 API (5개 엔드포인트)
   - `POST /api/offices/:id/messages`
   - `GET /api/offices/:id/messages`
   - `GET /api/offices/:id/agents/:agentId/messages`
   - `POST /api/offices/:id/messages/:msgId/read`
   - `POST /api/offices/:id/messages/:msgId/reply`
2. 핸드오프 API (4개 엔드포인트)
   - `POST /api/offices/:id/handoffs`
   - `GET /api/offices/:id/handoffs`
   - `POST /api/offices/:id/handoffs/:handoffId/accept`
   - `POST /api/offices/:id/handoffs/:handoffId/reject`
3. 협업 세션 API (6개 엔드포인트)
   - `POST /api/offices/:id/collaborations`
   - `GET /api/offices/:id/collaborations/:sessionId`
   - `POST /api/offices/:id/collaborations/:sessionId/join`
   - `POST /api/offices/:id/collaborations/:sessionId/leave`
   - `POST /api/offices/:id/collaborations/:sessionId/end`
   - `POST /api/offices/:id/collaborations/:sessionId/messages`

**예상 시간**: 3일

**체크리스트**:
- [ ] 메시지 CRUD API (5개 엔드포인트)
- [ ] 핸드오프 API (4개 엔드포인트)
- [ ] 협업 세션 API (6개 엔드포인트)
- [ ] 요청 검증 (Zod)
- [ ] 에러 핸들링
- [ ] API 테스트

---

### Phase 6: Realtime 채널 통합

**작업 내용**:
1. Agent별 개인 채널 구독
   - `agent:{agentId}` - 직접 메시지, 핸드오프 알림
2. Office 전체 채널
   - `office:{officeId}:messages` - 브로드캐스트
3. 협업 세션 채널
   - `collab:{sessionId}` - 세션 메시지, 컨텍스트 업데이트
4. 이벤트 타입별 핸들러

**예상 시간**: 1일

**체크리스트**:
- [ ] Agent 개인 채널 구독 로직
- [ ] Office 채널 구독 로직
- [ ] 협업 세션 채널 구독 로직
- [ ] 이벤트 핸들러 (`agent_message`, `handoff_request`, `collaboration_message` 등)
- [ ] 재연결 처리
- [ ] 채널 구독 테스트

---

### Phase 7: UI 컴포넌트

**작업 내용**:
1. 채팅 패널
   - 메시지 목록
   - 메시지 전송 입력창
   - 대화 스레드 표시
   - 읽지 않은 개수 배지
2. 핸드오프 대화창
   - 핸드오프 요청 폼
   - 수락/거절 버튼
   - 핸드오프 이력
3. 협업 세션 UI
   - 세션 생성 폼
   - 참여자 목록
   - 세션 메시지 로그
   - 공유 컨텍스트 표시

**예상 시간**: 3일

**체크리스트**:
- [ ] `ChatPanel` 컴포넌트
- [ ] `MessageItem` 컴포넌트
- [ ] `MessageInput` 컴포넌트
- [ ] `HandoffDialog` 컴포넌트
- [ ] `HandoffRequestCard` 컴포넌트
- [ ] `CollaborationSession` 컴포넌트
- [ ] `SessionMessageLog` 컴포넌트
- [ ] Realtime 구독 훅 (`useAgentMessages`, `useHandoffs`, `useCollaboration`)
- [ ] 우선순위별 스타일링
- [ ] 알림 사운드/진동

---

### Phase 8: 통합 테스트

**작업 내용**:
1. E2E 시나리오
   - 메시지 전송 → 수신 → 답장
   - 핸드오프 요청 → 수락 → Job 담당자 변경
   - 협업 세션 생성 → 참여 → 메시지 교환 → 종료
2. Request-Response 패턴 테스트
3. urgent 메시지 처리 테스트

**예상 시간**: 2일

**체크리스트**:
- [ ] `e2e/agent-communication.spec.ts`
- [ ] 메시지 전송/수신 플로우
- [ ] 대화 스레드 테스트
- [ ] 핸드오프 플로우 (요청 → 수락 → 완료)
- [ ] 순환 핸드오프 감지 테스트
- [ ] 협업 세션 플로우
- [ ] urgent 메시지 처리 테스트
- [ ] Realtime 동기화 검증

---

## 의존성

### 외부 라이브러리
- `@supabase/supabase-js`: Realtime

### 내부 모듈
- **01-Core**: Agent, Office 조회
- **04-Session Execution**: urgent 메시지 시 세션 제어
- **06-Realtime UI**: 메시지/핸드오프 UI 표시
- **08-Job Scheduler**: 핸드오프 시 Job 담당자 변경

---

## 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 순환 핸드오프 | 중간 | 핸드오프 이력 추적, 감지 알고리즘 |
| Realtime 메시지 손실 | 중간 | DB 저장 + Realtime 전송, 재연결 시 동기화 |
| 협업 세션 충돌 | 낮음 | shared_context JSONB 병합 전략 |
| urgent 메시지 남용 | 낮음 | 우선순위 정책 문서화, 로깅 |

---

## 예상 결과물

- [ ] `MessageService` (메시지 전송/조회)
- [ ] `HandoffService` (핸드오프 관리)
- [ ] `CollaborationService` (협업 세션)
- [ ] 메시지 API (5개 엔드포인트)
- [ ] 핸드오프 API (4개 엔드포인트)
- [ ] 협업 세션 API (6개 엔드포인트)
- [ ] DB 마이그레이션 (3개 테이블)
- [ ] Realtime 채널 통합
- [ ] UI 컴포넌트 (ChatPanel, HandoffDialog, CollaborationSession)
- [ ] 통합 테스트 스위트

---

## 다음 단계

✅ 07-Agent Communication 완료 후:
- **UI 개선** (말풍선 애니메이션, 알림 사운드)
- **Agent 간 협업 최적화** (컨텍스트 자동 공유)
