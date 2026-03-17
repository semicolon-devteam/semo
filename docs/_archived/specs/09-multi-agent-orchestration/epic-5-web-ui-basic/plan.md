# Multi-Agent Orchestration - Web UI Basic Implementation Plan

## Overview

사용자 질문 패널과 에이전트 호출 애니메이션 구현.
Supabase Realtime을 사용하여 실시간 업데이트 제공.

## Technical Approach

### 1. useUserQuestions 훅 설계

```typescript
// packages/office-web/src/hooks/useUserQuestions.ts

interface UserQuestion {
  id: string;
  agentId: string;
  agentName: string;
  questionType: 'text' | 'selection' | 'confirmation';
  question: string;
  options?: string[];
  status: 'pending' | 'answered' | 'timeout';
  createdAt: Date;
  expiresAt?: Date;
}

interface UseUserQuestionsResult {
  questions: UserQuestion[];
  pendingCount: number;
  answerQuestion: (questionId: string, response: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

function useUserQuestions(officeId: string): UseUserQuestionsResult;
```

### 2. UserQuestionPanel 컴포넌트 설계

```
+------------------------------------------+
| 🔔 대기 중인 질문 (3)                      |
+------------------------------------------+
| ┌────────────────────────────────────┐   |
| │ 🤖 PO Agent                        │   |
| │ 로그인 방식을 선택해주세요             │   |
| │ ⏰ 4:32 남음                        │   |
| │ [응답하기]                           │   |
| └────────────────────────────────────┘   |
| ┌────────────────────────────────────┐   |
| │ 🤖 Planner                         │   |
| │ 마감일을 확인해주세요                  │   |
| │ ⏰ 2:15 남음                        │   |
| │ [응답하기]                           │   |
| └────────────────────────────────────┘   |
+------------------------------------------+
```

### 3. 질문 타입별 응답 UI

```typescript
// 텍스트 입력
interface TextQuestionModal {
  question: string;
  onSubmit: (text: string) => void;
}

// 선택지
interface SelectionQuestionModal {
  question: string;
  options: string[];
  onSelect: (selected: string) => void;
}

// 확인/취소
interface ConfirmationQuestionModal {
  question: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

### 4. useAgentInvocation 훅 설계

```typescript
// packages/office-web/src/hooks/useAgentInvocation.ts

interface AgentInvocation {
  id: string;
  callerAgentId: string;
  calleeAgentId: string;
  callerPosition: { x: number; y: number };
  status: 'pending' | 'in_progress' | 'completed';
}

interface UseAgentInvocationResult {
  activeInvocations: AgentInvocation[];
  getAgentAnimation: (agentId: string) => AgentAnimationState | null;
}

interface AgentAnimationState {
  targetPosition: { x: number; y: number };
  originalPosition: { x: number; y: number };
  isMoving: boolean;
}
```

### 5. 애니메이션 흐름

```
agent_invocations INSERT 감지
        ↓
callee 에이전트 위치 저장 (originalPosition)
        ↓
caller 위치로 이동 애니메이션 시작 (300ms)
        ↓
invocation status: 'completed' 감지
        ↓
원래 위치로 복귀 애니메이션 (300ms)
```

## Dependencies

### 외부 의존성
- `@supabase/supabase-js` (Realtime)
- `framer-motion` (애니메이션)
- 기존 Office Web 컴포넌트

### 선행 작업
- Epic 1-4 완료
- Office Web 기본 레이아웃 존재

## File Structure

```
packages/office-web/src/
├── hooks/
│   ├── useUserQuestions.ts
│   └── useAgentInvocation.ts
├── components/
│   ├── UserQuestionPanel/
│   │   ├── index.tsx
│   │   ├── QuestionCard.tsx
│   │   ├── TextQuestionModal.tsx
│   │   ├── SelectionQuestionModal.tsx
│   │   └── ConfirmationQuestionModal.tsx
│   └── AgentGrid/
│       └── AgentWithAnimation.tsx
└── types/
    └── questions.ts
```
