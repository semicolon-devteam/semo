---
name: suggest-refactoring
description: |
  리팩토링 제안. Use when (1) "리팩토링 제안", (2) "코드 개선 방안",
  (3) "이 코드 어떻게 개선?". 기술 부채 분석 기반 구체적 리팩토링 방안 제시.
tools: [Read, Grep, Glob]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: suggest-refactoring 호출`

# suggest-refactoring Skill

> 리팩토링 제안

## Purpose

분석된 기술 부채에 대해 구체적인 리팩토링 방안을 제시합니다.

## Refactoring Patterns

### 1. N+1 쿼리 해결

```typescript
// Before: N+1 패턴
const posts = await getPosts();
const postsWithComments = await Promise.all(
  posts.map(async (post) => ({
    ...post,
    comments: await getComments(post.id), // N번 호출
  }))
);

// After: Join 또는 Batch 쿼리
const postsWithComments = await getPostsWithComments(); // 1번 호출
// 또는 RPC 함수 사용: get_posts_with_comments()
```

### 2. 대용량 파일 분리

```text
Before: Form.tsx (450줄)

After:
├── Form.tsx (80줄) - 메인 컴포넌트
├── FormFields.tsx - 필드 컴포넌트
├── FormValidation.ts - 검증 로직
├── useFormState.ts - 상태 훅
└── types.ts - 타입 정의
```

### 3. any 타입 제거

```typescript
// Before
const handleData = (data: any) => { ... }

// After
interface DataType {
  id: string;
  name: string;
  value: number;
}
const handleData = (data: DataType) => { ... }
```

### 4. 중복 코드 추출

```typescript
// Before: 여러 파일에 중복
const formatDate = (date: Date) => date.toLocaleDateString('ko-KR');

// After: 공통 유틸로 추출
// src/lib/utils/date.ts
export const formatDate = (date: Date) => date.toLocaleDateString('ko-KR');
```

### 5. 캐시 적용

```typescript
// Before: 매번 fetch
const { data } = await supabase.rpc('get_posts');

// After: React Query 캐싱
const { data } = useQuery({
  queryKey: ['posts'],
  queryFn: () => supabase.rpc('get_posts'),
  staleTime: 5 * 60 * 1000, // 5분 캐시
});
```

## Output Format

```markdown
## 리팩토링 제안

### 1. N+1 쿼리 해결
**파일**: src/app/posts/_repositories/post.repository.ts
**현재 코드**:
\`\`\`typescript
// 문제 코드
\`\`\`

**제안 코드**:
\`\`\`typescript
// 개선 코드
\`\`\`

**예상 효과**:
- DB 쿼리 N+1 → 1회로 감소
- 응답 시간 약 60% 개선

---

### 2. 파일 분리
**파일**: src/components/Editor.tsx (380줄)

**제안 구조**:
\`\`\`
Editor/
├── index.tsx (메인)
├── Toolbar.tsx
├── ContentArea.tsx
├── useEditor.ts
└── types.ts
\`\`\`

**예상 효과**:
- 유지보수성 향상
- 테스트 용이성 증가

---

**총 제안**: 5건
**예상 소요**: 약 3일
```

## Expected Output

```markdown
[SEMO] Skill: suggest-refactoring 호출

## 리팩토링 제안

### 1. N+1 쿼리 해결 (High)

**파일**: post.repository.ts:45

**현재**:
\`\`\`typescript
posts.map(async (p) => ({ ...p, author: await getUser(p.authorId) }))
\`\`\`

**제안**:
\`\`\`typescript
await supabase.rpc('get_posts_with_authors')
\`\`\`

---

**총 2건 제안**
개선 이슈를 생성할까요?

[SEMO] Skill: suggest-refactoring 완료
```

## References

- [ops/improve CLAUDE.md](../../CLAUDE.md)
- [analyze-tech-debt Skill](../analyze-tech-debt/SKILL.md)
- [create-improvement-issue Skill](../create-improvement-issue/SKILL.md)
