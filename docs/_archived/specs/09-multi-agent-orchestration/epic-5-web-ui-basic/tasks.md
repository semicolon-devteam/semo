# Multi-Agent Orchestration - Web UI Basic Tasks

## Task Overview

| ID | Layer | Task | Complexity | Dependencies |
|----|-------|------|------------|--------------|
| T1 | v0.2.x PROJECT | hooks/components 디렉토리 구조 생성 | S | - |
| T2 | v0.3.x DATA | UserQuestion 타입 정의 | S | T1 |
| T3 | v0.5.x CODE | useUserQuestions 훅 구현 | M | T2 |
| T4 | v0.5.x CODE | Realtime 구독 로직 | M | T3 |
| T5 | v0.5.x CODE | QuestionCard 컴포넌트 | M | T2 |
| T6 | v0.5.x CODE | TextQuestionModal 구현 | S | T5 |
| T7 | v0.5.x CODE | SelectionQuestionModal 구현 | M | T5 |
| T8 | v0.5.x CODE | ConfirmationQuestionModal 구현 | S | T5 |
| T9 | v0.5.x CODE | UserQuestionPanel 통합 | M | T3-T8 |
| T10 | v0.3.x DATA | AgentInvocation 타입 정의 | S | T1 |
| T11 | v0.5.x CODE | useAgentInvocation 훅 구현 | M | T10 |
| T12 | v0.5.x CODE | 에이전트 이동 애니메이션 로직 | L | T11 |
| T13 | v0.5.x CODE | AgentWithAnimation 컴포넌트 | M | T12 |
| T14 | v0.4.x TESTS | 훅 단위 테스트 | M | T3, T11 |

## Task Details

### T1: [v0.2.x PROJECT] hooks/components 디렉토리 구조 생성
- **Complexity**: S
- **Dependencies**: -
- **Description**: Web UI 파일 구조 생성
- **Acceptance Criteria**:
  - [ ] `packages/office-web/src/hooks/` 디렉토리
  - [ ] `packages/office-web/src/components/UserQuestionPanel/` 디렉토리
  - [ ] `packages/office-web/src/types/questions.ts` 파일

### T2: [v0.3.x DATA] UserQuestion 타입 정의
- **Complexity**: S
- **Dependencies**: T1
- **Description**: 사용자 질문 관련 타입 정의
- **Acceptance Criteria**:
  - [ ] `UserQuestion` 인터페이스
  - [ ] `QuestionType` 열거형
  - [ ] `QuestionStatus` 열거형

```typescript
// packages/office-web/src/types/questions.ts

export type QuestionType = 'text' | 'selection' | 'confirmation';
export type QuestionStatus = 'pending' | 'answered' | 'timeout';

export interface UserQuestion {
  id: string;
  officeId: string;
  agentId: string;
  agentName?: string;
  questionType: QuestionType;
  question: string;
  options?: string[];
  context?: Record<string, unknown>;
  status: QuestionStatus;
  response?: string;
  createdAt: Date;
  expiresAt?: Date;
  answeredAt?: Date;
}
```

### T3: [v0.5.x CODE] useUserQuestions 훅 구현
- **Complexity**: M
- **Dependencies**: T2
- **Description**: 사용자 질문 목록 관리 훅
- **Acceptance Criteria**:
  - [ ] 초기 질문 목록 로드
  - [ ] 질문 응답 함수
  - [ ] 로딩/에러 상태 관리

```typescript
// packages/office-web/src/hooks/useUserQuestions.ts

import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import type { UserQuestion } from '../types/questions';

interface UseUserQuestionsResult {
  questions: UserQuestion[];
  pendingCount: number;
  answerQuestion: (questionId: string, response: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useUserQuestions(officeId: string): UseUserQuestionsResult {
  const supabase = useSupabase();
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 초기 로드
  useEffect(() => {
    async function loadQuestions() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_questions')
        .select('*, office_agents(name)')
        .eq('office_id', officeId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        setError(new Error(error.message));
      } else {
        setQuestions(data.map(mapToUserQuestion));
      }
      setIsLoading(false);
    }

    loadQuestions();
  }, [officeId, supabase]);

  // 응답 함수
  const answerQuestion = useCallback(async (questionId: string, response: string) => {
    const { error } = await supabase
      .from('user_questions')
      .update({
        status: 'answered',
        response,
        answered_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) throw new Error(error.message);

    // 로컬 상태 업데이트
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  }, [supabase]);

  return {
    questions,
    pendingCount: questions.length,
    answerQuestion,
    isLoading,
    error,
  };
}
```

### T4: [v0.5.x CODE] Realtime 구독 로직
- **Complexity**: M
- **Dependencies**: T3
- **Description**: 실시간 질문 업데이트 구독
- **Acceptance Criteria**:
  - [ ] INSERT 이벤트로 새 질문 추가
  - [ ] UPDATE 이벤트로 상태 변경 반영
  - [ ] 컴포넌트 언마운트 시 구독 해제

```typescript
// useUserQuestions.ts에 추가

useEffect(() => {
  const channel = supabase
    .channel(`questions:${officeId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'user_questions',
      filter: `office_id=eq.${officeId}`,
    }, (payload) => {
      setQuestions(prev => [mapToUserQuestion(payload.new), ...prev]);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'user_questions',
      filter: `office_id=eq.${officeId}`,
    }, (payload) => {
      if (payload.new.status !== 'pending') {
        setQuestions(prev => prev.filter(q => q.id !== payload.new.id));
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [officeId, supabase]);
```

### T5: [v0.5.x CODE] QuestionCard 컴포넌트
- **Complexity**: M
- **Dependencies**: T2
- **Description**: 개별 질문 카드 UI
- **Acceptance Criteria**:
  - [ ] 에이전트 이름/아이콘 표시
  - [ ] 질문 내용 표시
  - [ ] 남은 시간 표시 (타이머)
  - [ ] 응답하기 버튼

```typescript
// packages/office-web/src/components/UserQuestionPanel/QuestionCard.tsx

interface QuestionCardProps {
  question: UserQuestion;
  onAnswer: () => void;
}

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  useEffect(() => {
    if (!question.expiresAt) return;

    const interval = setInterval(() => {
      const remaining = question.expiresAt!.getTime() - Date.now();
      if (remaining <= 0) {
        clearInterval(interval);
        setRemainingTime(0);
      } else {
        setRemainingTime(Math.floor(remaining / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [question.expiresAt]);

  return (
    <div className="question-card">
      <div className="question-header">
        <span className="agent-name">🤖 {question.agentName}</span>
        {remainingTime !== null && (
          <span className="remaining-time">
            ⏰ {formatTime(remainingTime)}
          </span>
        )}
      </div>
      <p className="question-text">{question.question}</p>
      <button onClick={onAnswer} className="answer-button">
        응답하기
      </button>
    </div>
  );
}
```

### T6: [v0.5.x CODE] TextQuestionModal 구현
- **Complexity**: S
- **Dependencies**: T5
- **Description**: 텍스트 입력 타입 질문 모달
- **Acceptance Criteria**:
  - [ ] 텍스트 입력 필드
  - [ ] 제출/취소 버튼
  - [ ] 입력 검증

```typescript
// packages/office-web/src/components/UserQuestionPanel/TextQuestionModal.tsx

interface TextQuestionModalProps {
  question: UserQuestion;
  onSubmit: (response: string) => void;
  onClose: () => void;
}

export function TextQuestionModal({ question, onSubmit, onClose }: TextQuestionModalProps) {
  const [value, setValue] = useState('');

  return (
    <Modal onClose={onClose}>
      <h3>{question.question}</h3>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="응답을 입력하세요..."
      />
      <div className="modal-actions">
        <button onClick={onClose}>취소</button>
        <button
          onClick={() => onSubmit(value)}
          disabled={!value.trim()}
        >
          제출
        </button>
      </div>
    </Modal>
  );
}
```

### T7: [v0.5.x CODE] SelectionQuestionModal 구현
- **Complexity**: M
- **Dependencies**: T5
- **Description**: 선택지 타입 질문 모달
- **Acceptance Criteria**:
  - [ ] 옵션 버튼 그리드
  - [ ] 선택 시 즉시 제출
  - [ ] 선택 상태 표시

### T8: [v0.5.x CODE] ConfirmationQuestionModal 구현
- **Complexity**: S
- **Dependencies**: T5
- **Description**: 확인/취소 타입 질문 모달
- **Acceptance Criteria**:
  - [ ] 확인/취소 버튼
  - [ ] 키보드 단축키 (Enter/Esc)

### T9: [v0.5.x CODE] UserQuestionPanel 통합
- **Complexity**: M
- **Dependencies**: T3-T8
- **Description**: 질문 패널 전체 통합
- **Acceptance Criteria**:
  - [ ] 질문 목록 렌더링
  - [ ] 모달 상태 관리
  - [ ] 타입별 모달 분기
  - [ ] 응답 처리

```typescript
// packages/office-web/src/components/UserQuestionPanel/index.tsx

export function UserQuestionPanel({ officeId }: { officeId: string }) {
  const { questions, pendingCount, answerQuestion, isLoading } = useUserQuestions(officeId);
  const [activeQuestion, setActiveQuestion] = useState<UserQuestion | null>(null);

  const handleAnswer = async (response: string) => {
    if (!activeQuestion) return;
    await answerQuestion(activeQuestion.id, response);
    setActiveQuestion(null);
  };

  return (
    <div className="user-question-panel">
      <header>
        <h2>🔔 대기 중인 질문 ({pendingCount})</h2>
      </header>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="question-list">
          {questions.map(q => (
            <QuestionCard
              key={q.id}
              question={q}
              onAnswer={() => setActiveQuestion(q)}
            />
          ))}
        </div>
      )}

      {activeQuestion && (
        <QuestionModal
          question={activeQuestion}
          onSubmit={handleAnswer}
          onClose={() => setActiveQuestion(null)}
        />
      )}
    </div>
  );
}
```

### T10: [v0.3.x DATA] AgentInvocation 타입 정의
- **Complexity**: S
- **Dependencies**: T1
- **Description**: 에이전트 호출 관련 타입 정의
- **Acceptance Criteria**:
  - [ ] `AgentInvocation` 인터페이스
  - [ ] `AgentAnimationState` 인터페이스

```typescript
// packages/office-web/src/types/invocations.ts

export interface AgentInvocation {
  id: string;
  officeId: string;
  callerAgentId: string;
  calleeAgentId: string;
  callerPositionX: number;
  callerPositionY: number;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  createdAt: Date;
  completedAt?: Date;
}

export interface AgentAnimationState {
  agentId: string;
  targetPosition: { x: number; y: number };
  originalPosition: { x: number; y: number };
  isMoving: boolean;
  invocationId: string;
}
```

### T11: [v0.5.x CODE] useAgentInvocation 훅 구현
- **Complexity**: M
- **Dependencies**: T10
- **Description**: 에이전트 호출 추적 훅
- **Acceptance Criteria**:
  - [ ] Realtime 구독으로 호출 감지
  - [ ] 활성 호출 목록 관리
  - [ ] 에이전트별 애니메이션 상태 제공

```typescript
// packages/office-web/src/hooks/useAgentInvocation.ts

export function useAgentInvocation(officeId: string): UseAgentInvocationResult {
  const supabase = useSupabase();
  const [animations, setAnimations] = useState<Map<string, AgentAnimationState>>(new Map());

  useEffect(() => {
    const channel = supabase
      .channel(`invocations:${officeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_invocations',
        filter: `office_id=eq.${officeId}`,
      }, (payload) => {
        const invocation = payload.new as AgentInvocation;
        // 애니메이션 시작
        startAnimation(invocation);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agent_invocations',
        filter: `office_id=eq.${officeId}`,
      }, (payload) => {
        if (payload.new.status === 'completed') {
          // 복귀 애니메이션
          returnAnimation(payload.new.id);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [officeId]);

  const getAgentAnimation = (agentId: string): AgentAnimationState | null => {
    return animations.get(agentId) || null;
  };

  return {
    activeInvocations: Array.from(animations.values()),
    getAgentAnimation,
  };
}
```

### T12: [v0.5.x CODE] 에이전트 이동 애니메이션 로직
- **Complexity**: L
- **Dependencies**: T11
- **Description**: Framer Motion 기반 이동 애니메이션
- **Acceptance Criteria**:
  - [ ] 호출 시 caller 위치로 이동
  - [ ] 완료 시 원래 위치로 복귀
  - [ ] 부드러운 전환 (easing)

```typescript
// packages/office-web/src/hooks/useAgentInvocation.ts에 추가

const startAnimation = (invocation: AgentInvocation) => {
  setAnimations(prev => {
    const next = new Map(prev);
    next.set(invocation.calleeAgentId, {
      agentId: invocation.calleeAgentId,
      targetPosition: {
        x: invocation.callerPositionX,
        y: invocation.callerPositionY,
      },
      originalPosition: getAgentPosition(invocation.calleeAgentId),
      isMoving: true,
      invocationId: invocation.id,
    });
    return next;
  });
};

const returnAnimation = (invocationId: string) => {
  setAnimations(prev => {
    const next = new Map(prev);
    for (const [agentId, state] of next) {
      if (state.invocationId === invocationId) {
        next.set(agentId, {
          ...state,
          targetPosition: state.originalPosition,
          isMoving: true,
        });
        // 애니메이션 완료 후 제거
        setTimeout(() => {
          setAnimations(p => {
            const n = new Map(p);
            n.delete(agentId);
            return n;
          });
        }, 300);
      }
    }
    return next;
  });
};
```

### T13: [v0.5.x CODE] AgentWithAnimation 컴포넌트
- **Complexity**: M
- **Dependencies**: T12
- **Description**: 애니메이션이 적용된 에이전트 컴포넌트
- **Acceptance Criteria**:
  - [ ] Framer Motion animate 속성
  - [ ] 이동 중 상태 표시 (글로우 효과 등)

```typescript
// packages/office-web/src/components/AgentGrid/AgentWithAnimation.tsx

import { motion } from 'framer-motion';

interface AgentWithAnimationProps {
  agent: Agent;
  animationState: AgentAnimationState | null;
}

export function AgentWithAnimation({ agent, animationState }: AgentWithAnimationProps) {
  const position = animationState?.isMoving
    ? animationState.targetPosition
    : { x: agent.positionX, y: agent.positionY };

  return (
    <motion.div
      className={`agent ${animationState?.isMoving ? 'moving' : ''}`}
      animate={{
        x: position.x,
        y: position.y,
      }}
      transition={{
        duration: 0.3,
        ease: 'easeInOut',
      }}
    >
      <AgentAvatar agent={agent} />
      <AgentLabel name={agent.name} />
    </motion.div>
  );
}
```

### T14: [v0.4.x TESTS] 훅 단위 테스트
- **Complexity**: M
- **Dependencies**: T3, T11
- **Description**: useUserQuestions, useAgentInvocation 테스트
- **Acceptance Criteria**:
  - [ ] Mock Supabase 클라이언트
  - [ ] Realtime 이벤트 시뮬레이션
  - [ ] 상태 업데이트 검증

## Test Requirements

### useUserQuestions 테스트
```typescript
describe('useUserQuestions', () => {
  it('should load pending questions on mount', async () => {
    const { result } = renderHook(() => useUserQuestions('office-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.questions).toHaveLength(2);
  });

  it('should add new question on INSERT event', async () => {
    const { result } = renderHook(() => useUserQuestions('office-1'));

    // INSERT 이벤트 시뮬레이션
    act(() => {
      mockChannel.emit('INSERT', { new: mockQuestion });
    });

    expect(result.current.questions).toHaveLength(3);
  });

  it('should remove question after answering', async () => {
    const { result } = renderHook(() => useUserQuestions('office-1'));

    await act(async () => {
      await result.current.answerQuestion('q-1', '응답');
    });

    expect(result.current.questions.find(q => q.id === 'q-1')).toBeUndefined();
  });
});
```
