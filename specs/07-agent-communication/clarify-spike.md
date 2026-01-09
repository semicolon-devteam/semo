# 07-Agent Communication: Clarify & Spike

> Agent 간 통신에 대한 불확실성 제거 및 기술 검증

---

## Clarify (명확화 필요 사항)

### 1. 메시지 전달 보장

**질문**:
- 메시지 손실 시 재전송?
- 메시지 순서 보장 필요?
- 읽음 확인 필수?

**결정 필요**:
- 메시지 저장 기간 (30일?)
- 대량 메시지 처리 (스팸 방지)
- 메시지 삭제 정책

### 2. 핸드오프 프로토콜

**질문**:
- 핸드오프 거절 사유 필수?
- 거절된 핸드오프 재요청 가능?
- 핸드오프 타임아웃 설정?

**결정 필요**:
- 핸드오프 대기 시간 제한
- 자동 핸드오프 조건 (예: QA는 BE 완료 후 자동)
- 핸드오프 히스토리 표시 방법

### 3. 협업 세션

**질문**:
- 세션 최대 참여자 수?
- 세션 종료 조건 (시간? 목표 달성?)
- 세션 내 권한 관리 필요?

**결정 필요**:
- 공유 컨텍스트 구조
- 세션 로그 저장 기간
- 세션 중 Agent 퇴장 처리

### 4. 우선순위 처리

**질문**:
- urgent 메시지 시 Agent 작업 중단 기준?
- 우선순위 낮은 메시지 지연 허용 범위?
- 우선순위 변경 가능?

**결정 필요**:
- urgent 메시지 알림 방법 (소리? 진동? UI 강조?)
- 우선순위별 SLA
- 메시지 큐 관리 전략

---

## Spike (기술 검증 필요 사항)

### SPIKE-07-01: Realtime 메시지 처리량

**목적**: Agent 간 대량 메시지 처리 성능 측정

**실험 계획**:
1. Office에 Agent 8개 생성
2. 초당 100개 메시지 브로드캐스트 (1분간)
3. 메시지 손실률, 지연 시간 측정
4. 메모리, CPU 사용량 모니터링

**성공 기준**:
- 메시지 손실률 < 0.1%
- 평균 지연 < 1초
- 시스템 안정성 유지

**예상 시간**: 1일

---

### SPIKE-07-02: 핸드오프 워크플로우 시뮬레이션

**목적**: 핸드오프 과정의 실제 효용성 검증

**실험 계획**:
1. 5가지 핸드오프 시나리오 준비
   - BE → QA (정상 케이스)
   - FE → BE (타입 정의 요청)
   - QA → BE (버그 발견)
   - BE → FE (API 변경 알림)
   - 순환 핸드오프 (A → B → A)
2. 각 시나리오 실행, 소요 시간 측정
3. 사용자 경험 평가

**성공 기준**:
- 핸드오프 완료 시간 < 30초
- 순환 핸드오프 차단 100%
- 명확한 핸드오프 이유 제공

**예상 시간**: 2일

---

### SPIKE-07-03: 협업 세션 실시간성

**목적**: 여러 Agent가 동시에 협업 세션에서 메시지 교환 시 동기화 검증

**실험 계획**:
1. 협업 세션 생성 (Agent 3명)
2. 각 Agent가 초당 1개 메시지 전송
3. 메시지 순서, 동기화 지연 측정
4. 공유 컨텍스트 업데이트 충돌 테스트

**성공 기준**:
- 메시지 순서 보장
- 동기화 지연 < 500ms
- 컨텍스트 충돌 해결 메커니즘 동작

**예상 시간**: 1일

---

### SPIKE-07-04: urgent 메시지 영향도

**목적**: urgent 메시지가 Agent 작업 흐름에 미치는 영향 분석

**실험 계획**:
1. Agent가 30분 작업 수행 중
2. 10분 시점에 urgent 메시지 전송
3. Agent 작업 중단, 메시지 처리, 작업 재개 시간 측정
4. 작업 컨텍스트 손실 여부 확인

**성공 기준**:
- 메시지 수신 < 5초
- 작업 재개 < 1분
- 컨텍스트 손실 없음

**예상 시간**: 1일

---

## Decisions (결정 사항)

### ✅ 결정됨: 메시지 타입별 처리

```typescript
const MESSAGE_HANDLING = {
  notification: {
    priority: 'normal',
    requiresRead: false,
    timeout: null,
  },
  question: {
    priority: 'high',
    requiresRead: true,
    requiresResponse: true,
    timeout: '30m',
  },
  request: {
    priority: 'high',
    requiresRead: true,
    requiresResponse: true,
    timeout: '1h',
  },
  handoff: {
    priority: 'urgent',
    requiresRead: true,
    requiresResponse: true,
    timeout: '5m',
  },
  broadcast: {
    priority: 'normal',
    requiresRead: false,
    timeout: null,
  },
};
```

### ✅ 결정됨: 핸드오프 프로토콜

```
[핸드오프 요청]
    ↓
대상 Agent에게 알림
    ↓
5분 이내 응답 필요
    ├─ 수락 → Job 담당자 변경, 컨텍스트 전달
    ├─ 거절 → 이유 제공, 원 Agent에게 다시 할당
    └─ 타임아웃 → 자동 거절, 수동 해결 요청
```

### ✅ 결정됨: 협업 세션 구조

```typescript
interface CollaborationSession {
  id: string;
  title: string;
  participants: string[];
  shared_context: {
    objective: string;          // "API 스펙 논의"
    files: string[];            // 관련 파일
    decisions: string[];        // 합의된 결정 사항
    action_items: {             // 액션 아이템
      description: string;
      assignee: string;
      status: 'pending' | 'done';
    }[];
  };
  messages: CollaborationMessage[];
  status: 'active' | 'ended';
}
```

### ✅ 결정됨: 우선순위별 처리

| 우선순위 | 알림 방법 | SLA | 처리 |
|---------|---------|-----|------|
| low | 배지만 | - | 시간 날 때 |
| normal | 배지 + 목록 | 1시간 | 다음 휴식 시간 |
| high | 팝업 + 소리 | 15분 | 현재 작업 완료 후 |
| urgent | 전면 모달 | 즉시 | 작업 중단, 즉시 처리 |

---

## Open Questions (미결정 사항)

| 질문 | 담당자 | 기한 |
|------|--------|------|
| 메시지 암호화 필요? | Security | v0.2.0 |
| 협업 세션 녹화 기능? | PO | Phase 4 |
| 메시지 검색 기능 범위 | UX | Phase 7 |
| 읽지 않은 메시지 푸시 알림 | FE Dev | Phase 7 |

---

## Risk Mitigation (리스크 완화)

### 만약 SPIKE-07-01 실패 시 (메시지 처리량 부족)

**대안 1**: 메시지 배칭
- 1초마다 배치로 묶어 전송
- 지연 증가하지만 부하 감소

**대안 2**: Redis 메시지 큐 사용
- Supabase Realtime 대신 Redis Pub/Sub
- 더 높은 처리량

**대안 3**: 메시지 우선순위 필터링
- urgent, high만 Realtime 전송
- low, normal은 폴링

### 만약 SPIKE-07-04 실패 시 (urgent 메시지가 작업 방해)

**대안**: 사용자 설정
- urgent 메시지 수신 여부 설정
- "방해 금지 모드" 제공

---

## Next Steps

1. ✅ Clarify 문서 작성 완료
2. ⏳ SPIKE-07-02 최우선 실행 (핸드오프 워크플로우)
3. ⏳ SPIKE-07-01 실행 (메시지 처리량)
4. ⏳ 메시지 타입별 UI 목업 작성
5. ⏳ Open Questions 답변 수집
