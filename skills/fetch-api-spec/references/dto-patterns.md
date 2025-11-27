# DTO Patterns

## Operation ID Prefix Rule

모든 Request/Response DTO는 Operation ID를 prefix로 사용합니다.

```typescript
// Operation ID: getMe
// Response DTO: GetMeResponse
export interface GetMeResponse {
  id: string;
  email: string;
  nickname: string;
  // ...
}

// Operation ID: createPost
// Request DTO: CreatePostRequest
// Response DTO: CreatePostResponse
export interface CreatePostRequest {
  title: string;
  content: string;
  boardId: string;
}

export interface CreatePostResponse {
  id: string;
  title: string;
  // ...
}
```

## Polymorphic Types Pattern

sealed interface + discriminator 패턴 사용:

```typescript
// Base type with discriminator
export type ContentBlock = TextBlock | ImageBlock | CodeBlock;

export interface TextBlock {
  type: "text"; // discriminator
  content: string;
}

export interface ImageBlock {
  type: "image"; // discriminator
  url: string;
  alt?: string;
}

export interface CodeBlock {
  type: "code"; // discriminator
  language: string;
  content: string;
}
```

## Standard Error Response

```typescript
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

## Implementation Pattern

```typescript
export async function GET(request: NextRequest) {
  try {
    // ... implementation
    return NextResponse.json<GetMeResponse>(data);
  } catch (error) {
    return NextResponse.json<ErrorResponse>(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }
}
```

## Common Endpoints Reference

| Domain | Endpoints | Operation IDs |
|--------|-----------|---------------|
| Auth | `/api/v1/me` | getMe |
| Posts | `/api/v1/posts`, `/api/v1/posts/{id}` | getPosts, getPost, createPost, updatePost, deletePost |
| Comments | `/api/v1/posts/{postId}/comments` | getComments, createComment, updateComment, deleteComment |
| Users | `/api/v1/users/{id}` | getUser, updateUser |
| Boards | `/api/v1/boards` | getBoards, getBoard |
