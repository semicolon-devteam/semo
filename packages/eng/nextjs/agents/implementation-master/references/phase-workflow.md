# Phase Workflow Details

> implementation-master Agent의 상세 Phase 워크플로우

## Phase v0.0.x: CONFIG

**Purpose**: Set up dependencies and explore technical approach

**Tasks**:

```bash
# 1. Check dependencies from plan.md
grep -A 10 "Dependencies" specs/*/plan.md

# 2. Install if needed
npm install [packages]

# 3. If technical approach unclear, suggest spike
# Example: "WebSocket implementation unclear. Run /spike realtime-tech?"
```

**Approval Gate**:

```markdown
✅ Phase v0.0.x Complete: CONFIG

**Completed**:
- Dependencies verified/installed
- Technical approach confirmed
- No spikes needed (or spike completed)

**Ready for v0.1.x (PROJECT)**:
- DDD structure scaffolding
- Directory creation
- Index file setup

Proceed to v0.1.x? (yes/no)
```

## Phase v0.1.x: PROJECT

**Purpose**: Scaffold DDD 4-layer structure

**Tasks**:

```bash
# Create domain directory structure
mkdir -p app/{domain}/_repositories/__tests__
mkdir -p app/{domain}/_api-clients
mkdir -p app/{domain}/_hooks/__tests__
mkdir -p app/{domain}/_components/__tests__

# Create index files for clean exports
touch app/{domain}/_repositories/index.ts
touch app/{domain}/_api-clients/index.ts
touch app/{domain}/_hooks/index.ts
touch app/{domain}/_components/index.ts
```

**Reference**: Follow existing domains (posts, dashboard, profile)

**Approval Gate**:

```markdown
✅ Phase v0.1.x Complete: PROJECT

**Created Structure**:
app/{domain}/
├── _repositories/__tests__/ ✅
├── _api-clients/ ✅
├── _hooks/__tests__/ ✅
└── _components/__tests__/ ✅

**Ready for v0.2.x (TESTS)**:
- Write tests BEFORE implementation
- Test-Driven Development approach

⚠️ **CRITICAL**: Next phase writes tests first.
Constitution Principle III requires tests before code.

Proceed to v0.2.x? (yes/no)
```

## Phase v0.2.x: TESTS

**Purpose**: Write tests BEFORE implementation (TDD)

**Critical**: This phase MUST complete before v0.4.x (CODE)

> 📚 테스트 템플릿: [test-patterns.md](test-patterns.md)

**Approval Gate**:

```markdown
✅ Phase v0.2.x Complete: TESTS

**Test Files Created**:
- Repository tests: [count] test cases ✅
- Hook tests: [count] test cases ✅
- Component tests: [count] test cases ✅

**Test Status**:
- All tests written ✅
- Tests currently FAILING (expected - no implementation yet) ⚠️

**Ready for v0.3.x (DATA)**:
- Define models and types
- Create Supabase schemas
- Generate database types

Proceed to v0.3.x? (yes/no)
```

## Phase v0.3.x: DATA

**Purpose**: Define data models and Supabase schemas

**Tasks**:

1. **Create Type Definitions** (`models/{domain}/`)

```typescript
// models/posts/index.ts
export interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
  updated_at: string;
}

export interface GetPostsParams {
  limit?: number;
  offset?: number;
  author_id?: string;
}

export interface GetPostsResponse {
  posts: Post[];
  total: number;
}
```

2. **Verify Supabase Schema** (if needed)

```bash
# Check if RPC functions exist in core-supabase
gh api repos/semicolon-devteam/core-supabase/contents/document/test/{domain}
```

3. **Update Database Types**

```bash
npx supabase gen types typescript --project-id [project-id] > lib/supabase/database.types.ts
```

**Approval Gate**:

```markdown
✅ Phase v0.3.x Complete: DATA

**Type Definitions**:
- models/{domain}/index.ts ✅
- Database types updated ✅

**Supabase Verification**:
- RPC functions verified in core-supabase ✅
- Schema matches types ✅

**Ready for v0.4.x (CODE)**:
- Implement Repository (using core-supabase patterns)
- Implement API Client (Factory Pattern)
- Implement Hooks (React Query)
- Implement Components (Domain-specific UI)

⚠️ **IMPORTANT**: Implementation will make v0.2.x tests PASS.

Proceed to v0.4.x? (yes/no)
```

## Phase v0.4.x: CODE

**Purpose**: Implement all 4 DDD layers following TDD

**Order**: Repository → API Client → Hooks → Components

### 1. Repository Layer (`_repositories/`)

```bash
# Fetch core-supabase example
gh api repos/semicolon-devteam/core-supabase/contents/document/test/{domain}/{operation}.ts \
  --jq '.content' | base64 -d
```

```typescript
// app/{domain}/_repositories/{Domain}Repository.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { GetItemsParams, GetItemsResponse } from '@/models/{domain}';

export class {Domain}Repository {
  async getItems(params: GetItemsParams): Promise<GetItemsResponse> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('{domain}_read', {
      p_limit: params.limit ?? 20,
      p_offset: params.offset ?? 0,
    });

    if (error) {
      console.error(`Supabase error in getItems:`, error);
      throw new Error(`Failed to fetch items: ${error.message}`);
    }

    if (!data) {
      return { items: [], total: 0 };
    }

    return {
      items: data as unknown as ItemType[],
      total: data.length,
    };
  }
}
```

**Verify**: Repository tests should START PASSING

### 2. API Client Layer (`_api-clients/`)

```typescript
// app/{domain}/_api-clients/{domain}.client.ts
import { API_BASE } from '@/lib/api-clients/config';
import type { GetItemsParams, GetItemsResponse } from '@/models/{domain}';

export class {Domain}ApiClient {
  private baseUrl = `${API_BASE}/{domain}`;

  async getItems(params: GetItemsParams): Promise<GetItemsResponse> {
    const queryParams = new URLSearchParams({
      limit: params.limit?.toString() ?? '20',
      offset: params.offset?.toString() ?? '0',
    });

    const response = await fetch(`${this.baseUrl}?${queryParams}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch items: ${response.statusText}`);
    }

    return response.json();
  }
}

// Factory Pattern: Export singleton
export const {domain}Client = new {Domain}ApiClient();
```

### 3. Hooks Layer (`_hooks/`)

```typescript
// app/{domain}/_hooks/use{Domain}.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { {domain}Client } from '../_api-clients';
import type { GetItemsParams } from '@/models/{domain}';

export function use{Domain}(params: GetItemsParams = {}) {
  return useQuery({
    queryKey: ['{domain}', params],
    queryFn: () => {domain}Client.getItems(params),
    staleTime: 60 * 1000, // 1 minute
  });
}
```

**Verify**: Hook tests should START PASSING

### 4. Components Layer (`_components/`)

Create 6 standard components:

- {Domain}Header.tsx
- {Domain}Filter.tsx
- {Domain}List.tsx
- {Domain}EmptyState.tsx
- {Domain}LoadingState.tsx
- {Domain}ErrorState.tsx

**Verify**: Component tests should START PASSING

### 5. Run All Tests

```bash
npm test

# Expected:
# Repository tests: ✅ PASSING
# Hook tests: ✅ PASSING
# Component tests: ✅ PASSING
```

**Approval Gate**:

```markdown
✅ Phase v0.4.x Complete: CODE

**Implementation Status**:
- Repository Layer: ✅ Implemented (core-supabase patterns)
- API Client Layer: ✅ Implemented (Factory Pattern)
- Hooks Layer: ✅ Implemented (React Query)
- Components Layer: ✅ Implemented (6 components)

**Test Results**:
- Repository: X/X passing ✅
- Hooks: X/X passing ✅
- Components: X/X passing ✅
- Total: X/X tests passing (100%)

**Code Quality**:
```bash
npm run lint     # ✅ Passed
npx tsc --noEmit # ✅ Passed
```

**Constitution Compliance**:
- DDD Architecture (Principle I): ✅
- SSR-First (Principle II): ✅
- Test-Driven Quality (Principle III): ✅
- Spec-Driven Development (Principle VIII): ✅
- Agent-Driven Collaboration (Principle IX): ✅

**Ready for Browser Testing** (Phase v0.4.x Gate)
```

## Delegation Pattern

```markdown
User: /implement posts:comments

You:
1. Read specs/*/tasks.md
2. Run v0.0.x: CONFIG
   └─ Request approval
3. Run v0.1.x: PROJECT (scaffold)
   └─ Request approval
4. Run v0.2.x: TESTS (write tests first)
   └─ Request approval
5. Run v0.3.x: DATA (models, schemas)
   └─ Request approval
6. Run v0.4.x: CODE
   ├─ Call /speckit.implement (for task execution)
   ├─ Enhance with DDD 4-layer compliance
   ├─ Add Supabase patterns from core-supabase
   └─ Request final approval
7. Verify all tests pass
8. Report completion
```
