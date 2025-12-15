# Error Handling

Spring ErrorResponse → Next.js 에러 처리 패턴

## ApiError 클래스

```typescript
// lib/api-clients/errors.ts

/**
 * API 에러 클래스
 * Spring ErrorResponse를 래핑
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';

    // Error 클래스 상속 시 프로토타입 체인 복구
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * 사용자 친화적 메시지 반환
   */
  get userMessage(): string {
    return ERROR_MESSAGES[this.code] || this.message;
  }

  /**
   * 재시도 가능한 에러인지 확인
   */
  get isRetryable(): boolean {
    return this.status !== undefined && this.status >= 500;
  }

  /**
   * 인증 관련 에러인지 확인
   */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}
```

## 에러 코드 → 사용자 메시지 매핑

```typescript
// lib/api-clients/error-messages.ts

/**
 * Spring 에러 코드 → 사용자 친화적 메시지
 * core-backend의 에러 코드와 동기화 필요
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // 공통
  'INTERNAL_ERROR': '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  'BAD_REQUEST': '잘못된 요청입니다.',
  'VALIDATION_ERROR': '입력 값을 확인해주세요.',

  // 인증/인가
  'UNAUTHORIZED': '로그인이 필요합니다.',
  'FORBIDDEN': '접근 권한이 없습니다.',
  'TOKEN_EXPIRED': '세션이 만료되었습니다. 다시 로그인해주세요.',
  'INVALID_TOKEN': '유효하지 않은 인증 정보입니다.',

  // 게시글
  'POST_NOT_FOUND': '게시글을 찾을 수 없습니다.',
  'POST_DELETED': '삭제된 게시글입니다.',
  'POST_FORBIDDEN': '게시글에 대한 권한이 없습니다.',

  // 댓글
  'COMMENT_NOT_FOUND': '댓글을 찾을 수 없습니다.',
  'COMMENT_FORBIDDEN': '댓글에 대한 권한이 없습니다.',

  // 사용자
  'USER_NOT_FOUND': '사용자를 찾을 수 없습니다.',
  'USER_ALREADY_EXISTS': '이미 존재하는 사용자입니다.',

  // 게시판
  'BOARD_NOT_FOUND': '게시판을 찾을 수 없습니다.',

  // HTTP 상태 기반 (폴백)
  'HTTP_400': '잘못된 요청입니다.',
  'HTTP_401': '로그인이 필요합니다.',
  'HTTP_403': '접근 권한이 없습니다.',
  'HTTP_404': '요청한 리소스를 찾을 수 없습니다.',
  'HTTP_409': '요청이 충돌했습니다.',
  'HTTP_500': '서버 오류가 발생했습니다.',
};

/**
 * 에러 코드로 사용자 메시지 조회
 */
export function getUserErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || '오류가 발생했습니다.';
}
```

## React Query 에러 처리

```typescript
// lib/api-clients/query-error-handler.ts

import { ApiError } from './errors';
import { toast } from 'sonner'; // 또는 사용 중인 toast 라이브러리

/**
 * React Query 전역 에러 핸들러
 */
export function handleQueryError(error: unknown): void {
  if (error instanceof ApiError) {
    // 인증 에러 → 로그인 페이지로
    if (error.isAuthError) {
      // signOut() 또는 redirect to login
      toast.error(error.userMessage);
      return;
    }

    // 일반 에러 → 토스트 표시
    toast.error(error.userMessage);
    return;
  }

  // 네트워크 에러
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    toast.error('네트워크 연결을 확인해주세요.');
    return;
  }

  // 알 수 없는 에러
  console.error('Unexpected error:', error);
  toast.error('오류가 발생했습니다.');
}
```

## QueryClient 설정

```typescript
// lib/query-client.ts

import { QueryClient } from '@tanstack/react-query';
import { handleQueryError } from './api-clients/query-error-handler';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // ApiError이고 재시도 불가능하면 retry 안함
        if (error instanceof ApiError && !error.isRetryable) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 1000 * 60, // 1분
    },
    mutations: {
      onError: handleQueryError,
    },
  },
});
```

## 컴포넌트에서 에러 처리

### useQuery 에러 처리

```typescript
// hooks/posts/usePost.ts

import { useQuery } from '@tanstack/react-query';
import { postsClient } from '@/lib/api-clients/posts.client';
import { ApiError } from '@/lib/api-clients/errors';

export function usePost(id: string) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: () => postsClient.getPost(id),
    // 404는 에러로 처리하지 않음 (optional)
    throwOnError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }
      return true;
    },
  });
}
```

### useMutation 에러 처리

```typescript
// hooks/posts/useCreatePost.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsClient } from '@/lib/api-clients/posts.client';
import { ApiError } from '@/lib/api-clients/errors';
import { toast } from 'sonner';

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postsClient.createPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('게시글이 작성되었습니다.');
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        // 유효성 검증 에러 → 상세 표시
        if (error.code === 'VALIDATION_ERROR' && error.details) {
          const messages = Object.values(error.details).join(', ');
          toast.error(messages);
          return;
        }
        toast.error(error.userMessage);
        return;
      }
      toast.error('게시글 작성에 실패했습니다.');
    },
  });
}
```

## Error Boundary

```typescript
// components/error-boundary.tsx

'use client';

import { Component, type ReactNode } from 'react';
import { ApiError } from '@/lib/api-clients/errors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const { error } = this.state;

      // ApiError인 경우 사용자 친화적 메시지 표시
      if (error instanceof ApiError) {
        return (
          <div className="error-container">
            <h2>오류가 발생했습니다</h2>
            <p>{error.userMessage}</p>
            {error.isRetryable && (
              <button onClick={() => this.setState({ hasError: false })}>
                다시 시도
              </button>
            )}
          </div>
        );
      }

      return this.props.fallback || <div>오류가 발생했습니다.</div>;
    }

    return this.props.children;
  }
}
```

## 에러 로깅

```typescript
// lib/api-clients/error-logger.ts

import { ApiError } from './errors';

/**
 * 에러 로깅 (프로덕션에서는 외부 서비스로 전송)
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  if (error instanceof ApiError) {
    console.error('[API Error]', {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
      ...context,
    });

    // TODO: Sentry, DataDog 등 외부 서비스 연동
    // Sentry.captureException(error, { extra: context });
    return;
  }

  console.error('[Unknown Error]', error, context);
}
```
