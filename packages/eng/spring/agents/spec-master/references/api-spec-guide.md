# API Spec Guide

## core-interface Reference

### OpenAPI Spec 조회

```bash
gh api repos/semicolon-devteam/core-interface/contents/openapi-spec.json \
  --jq '.content' | base64 -d
```

### Swagger UI

https://core-interface-ashen.vercel.app/

## DTO Naming Convention

| OpenAPI Operation | Request DTO | Response DTO |
|-------------------|-------------|--------------|
| createPost | CreatePostRequest | CreatePostResponse |
| getPost | - | GetPostResponse |
| updatePost | UpdatePostRequest | UpdatePostResponse |
| deletePost | - | - |
| listPosts | - | PagedPostsResponse |

## Response Patterns

### Success Response

```kotlin
ApiResponse.Success(
    success = true,
    data = postResponse,
    message = "게시글이 생성되었습니다."
)
```

### Paged Response

```kotlin
ApiResponse.PagedSuccess(
    success = true,
    data = posts,
    pagination = Pagination(
        page = 1,
        size = 20,
        totalElements = 100,
        totalPages = 5
    )
)
```

### Error Response

```kotlin
ApiResponse.Error(
    success = false,
    message = "게시글을 찾을 수 없습니다.",
    errorCode = "POST_NOT_FOUND"
)
```

## Spec Alignment Checklist

- [ ] Endpoint path 일치
- [ ] HTTP method 일치
- [ ] Request body schema 일치
- [ ] Response body schema 일치
- [ ] Error codes 정의
