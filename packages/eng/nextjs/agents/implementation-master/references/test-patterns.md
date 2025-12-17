# Test Patterns (TDD)

> implementation-master Agent의 TDD 테스트 템플릿

## Repository Tests (`_repositories/__tests__/`)

```typescript
// Example: PostsRepository.test.ts
import { PostsRepository } from "../PostsRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server");

describe("PostsRepository", () => {
  describe("getPosts", () => {
    it("should fetch posts successfully", async () => {
      // Mock Supabase client
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({
          data: [{ id: "1", title: "Test" }],
          error: null,
        }),
      };

      (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase);

      const repository = new PostsRepository();
      const result = await repository.getPosts({ limit: 10 });

      expect(result.posts).toHaveLength(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("posts_read", expect.any(Object));
    });

    it("should handle errors", async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      };

      (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase);

      const repository = new PostsRepository();

      await expect(repository.getPosts({ limit: 10 }))
        .rejects.toThrow("Failed to fetch posts");
    });
  });
});
```

## Hook Tests (`_hooks/__tests__/`)

```typescript
// Example: usePosts.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePosts } from '../usePosts';
import { postsClient } from '../../_api-clients';

jest.mock('../../_api-clients');

describe('usePosts', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };

  it('should fetch posts', async () => {
    (postsClient.getPosts as jest.Mock).mockResolvedValue({
      posts: [{ id: '1', title: 'Test' }],
      total: 1,
    });

    const { result } = renderHook(() => usePosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.posts).toHaveLength(1);
  });

  it('should handle loading state', () => {
    (postsClient.getPosts as jest.Mock).mockReturnValue(
      new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => usePosts(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('should handle error state', async () => {
    (postsClient.getPosts as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() => usePosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});
```

## Component Tests (`_components/__tests__/`)

```typescript
// Example: PostsList.test.tsx
import { render, screen } from '@testing-library/react';
import { PostsList } from '../PostsList';
import { usePosts } from '../../_hooks';

jest.mock('../../_hooks');

describe('PostsList', () => {
  it('should render posts', () => {
    (usePosts as jest.Mock).mockReturnValue({
      data: { posts: [{ id: '1', title: 'Test Post' }] },
      isLoading: false,
      error: null,
    });

    render(<PostsList />);
    expect(screen.getByText('Test Post')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    (usePosts as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(<PostsList />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should show error state', () => {
    (usePosts as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'Failed to load' },
    });

    render(<PostsList />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('should show empty state', () => {
    (usePosts as jest.Mock).mockReturnValue({
      data: { posts: [] },
      isLoading: false,
      error: null,
    });

    render(<PostsList />);
    expect(screen.getByText(/no posts/i)).toBeInTheDocument();
  });
});
```

## Test Naming Convention

| Layer | File Pattern | Test Focus |
|-------|--------------|------------|
| Repository | `{Domain}Repository.test.ts` | Supabase RPC 호출, 에러 핸들링 |
| Hook | `use{Domain}.test.ts` | React Query 상태, 데이터 변환 |
| Component | `{Domain}{Component}.test.tsx` | 렌더링, 인터랙션, 상태별 UI |

## Test Checklist

### Repository Tests
- [ ] 성공 케이스 (데이터 반환)
- [ ] 빈 데이터 케이스
- [ ] 에러 핸들링 케이스
- [ ] RPC 파라미터 검증

### Hook Tests
- [ ] 로딩 상태
- [ ] 성공 상태
- [ ] 에러 상태
- [ ] 파라미터 변경 시 재요청

### Component Tests
- [ ] 로딩 UI
- [ ] 데이터 렌더링
- [ ] 빈 상태 UI
- [ ] 에러 UI
- [ ] 사용자 인터랙션
