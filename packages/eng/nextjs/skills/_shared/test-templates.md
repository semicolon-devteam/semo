# Test Templates

> **Constitution Principle III**: Test-Driven Quality

## Repository Tests

```typescript
// app/{domain}/_repositories/__tests__/{Domain}Repository.test.ts
import { describe, it, expect, vi } from 'vitest';
import { {Domain}Repository } from '../{Domain}Repository';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

describe('{Domain}Repository', () => {
  const repository = new {Domain}Repository();

  describe('get{Domain}s', () => {
    it('should return {domain}s list', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'Test' }];
      // Mock setup...

      // Act
      const result = await repository.get{Domain}s({});

      // Assert
      expect(result).toEqual(mockData);
    });

    it('should handle errors gracefully', async () => {
      // Test error handling
    });
  });
});
```

## Hook Tests

```typescript
// app/{domain}/_hooks/__tests__/use{Domain}s.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { use{Domain}s } from '../use{Domain}s';
import { createWrapper } from '@/lib/test-utils';

// Mock API Client
vi.mock('../../_api-clients', () => ({
  {domain}Client: {
    get{Domain}s: vi.fn(),
  },
}));

describe('use{Domain}s', () => {
  it('should fetch {domain}s successfully', async () => {
    const { result } = renderHook(() => use{Domain}s(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle loading state', () => {
    const { result } = renderHook(() => use{Domain}s(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });
});
```

## Component Tests

```typescript
// app/{domain}/_components/__tests__/{Domain}Header.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { {Domain}Header } from '../{Domain}Header';

describe('{Domain}Header', () => {
  it('should render header correctly', () => {
    render(<{Domain}Header />);

    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<{Domain}Header onClick={onClick} />);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

## Test Directory Structure

```text
app/{domain}/
├── _repositories/
│   └── __tests__/
│       └── {Domain}Repository.test.ts
├── _hooks/
│   └── __tests__/
│       └── use{Domain}s.test.ts
└── _components/
    └── __tests__/
        ├── {Domain}Header.test.tsx
        ├── {Domain}List.test.tsx
        └── {Domain}Filter.test.tsx
```

## Test Naming Conventions

| 패턴 | 예시 |
|------|------|
| Repository | `{Domain}Repository.test.ts` |
| Hook | `use{Domain}s.test.ts` |
| Component | `{Domain}Header.test.tsx` |

## Test Coverage Requirements

| Layer | Minimum |
|-------|---------|
| Repository | 80% |
| Hooks | 80% |
| Components | 70% |
