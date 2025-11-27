# Test Templates

## Repository Tests

```typescript
// app/{domain}/_repositories/__tests__/{Domain}Repository.test.ts
import { describe, it, expect, vi } from 'vitest';
import { {Domain}Repository } from '../{Domain}Repository';

// Mock createServerSupabaseClient
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

describe('{Domain}Repository', () => {
  it('should fetch {domain}s successfully', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
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

// Mock API client
vi.mock('../../_api-clients', () => ({
  {domain}Client: {
    get{Domain}s: vi.fn(),
  },
}));

describe('use{Domain}s', () => {
  it('should fetch {domain}s successfully', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});
```

## Component Tests

```typescript
// app/{domain}/_components/__tests__/{Domain}Header.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { {Domain}Header } from '../{Domain}Header';

describe('{Domain}Header', () => {
  it('should render header', () => {
    render(<{Domain}Header />);
    expect(screen.getByText('{Domain} Header')).toBeInTheDocument();
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
        └── {Domain}Header.test.tsx
```
