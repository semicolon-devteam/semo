# Supabase Integration Command

You are implementing a Supabase data access feature for the Semicolon project.

## Step 1: Fetch Architecture Guide

1. Access the Supabase Integration Guide:
   - URL: https://github.com/semicolon-devteam/docs/wiki/guides-architecture-supabase-interaction
   - Use WebFetch or gh cli to read the guide
2. Read the index and find the relevant section for the user's request
3. Identify the corresponding example file in core-supabase

## Step 2: Get Example Code

1. Based on the guide, navigate to the corresponding example in core-supabase
2. Example path pattern: `semicolon-devteam/core-supabase/blob/dev/document/test/{domain}/{operation}.ts`
3. Use gh cli to fetch the example:
   ```bash
   gh api repos/semicolon-devteam/core-supabase/contents/document/test/{domain}/{file}.ts \
     --jq '.content' | base64 -d
   ```

## Step 3: Implement Following Pattern

1. Create Repository in `app/{domain}/_repositories/`
2. Follow the exact pattern from the example
3. Use `createServerSupabaseClient` from `@/lib/supabase/server`
4. Apply team conventions from Team Codex

## Implementation Checklist:

- [ ] Repository class created with proper naming (`{Domain}Repository`)
- [ ] Uses `createServerSupabaseClient` for server-side access
- [ ] RPC function name matches core-supabase example
- [ ] Parameter types defined in models/
- [ ] Error handling implemented
- [ ] Return type properly typed
- [ ] Index export added to `_repositories/index.ts`
- [ ] Unit tests created in `__tests__/`

## Example Workflow:

For "게시글 조회" request:
- Guide: Wiki → "게시글 조회 getPosts.ts"
- Example: `core-supabase/document/test/posts/getPosts.ts`
- Implement: `app/posts/_repositories/PostsRepository.ts`

## Code Template:

```typescript
// app/{domain}/_repositories/{Domain}Repository.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { GetXxxParams, GetXxxResponse } from '@/models/{domain}';

export class {Domain}Repository {
  async getXxx(params: GetXxxParams): Promise<GetXxxResponse> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('{rpc_function_name}', {
      // RPC parameters from core-supabase example
    });

    if (error) {
      throw new Error(`Failed to fetch {domain}: ${error.message}`);
    }

    return {
      items: data as unknown as XxxType[],
      total: data?.length ?? 0,
    };
  }
}
```

Ask the user which operation they want to implement, then follow this workflow step by step.
