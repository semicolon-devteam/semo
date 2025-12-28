# GitHub Commands

## Fetch from core-interface

```bash
# Fetch complete OpenAPI spec
gh api repos/semicolon-devteam/core-interface/contents/openapi-spec.json \
  --jq '.content' | base64 -d

# Quick reference: Swagger UI
# https://core-interface-ashen.vercel.app/
```

## Fetch Documentation

```bash
# Fetch README for contribution guidelines
gh api repos/semicolon-devteam/core-interface/contents/README.md \
  --jq '.content' | base64 -d

# Fetch CONTRIBUTING.md for DTO rules
gh api repos/semicolon-devteam/core-interface/contents/CONTRIBUTING.md \
  --jq '.content' | base64 -d
```

## Usage Examples

### Example 1: Fetch Posts API Spec

```javascript
// Agent invokes this skill
skill: fetchApiSpec("posts", "GET /api/v1/posts");

// Returns:
// - Path: /api/v1/posts
// - Method: GET
// - Query Parameters: limit, offset, boardId
// - Response: GetPostsResponse (Post[])
// - TypeScript interfaces
```

### Example 2: Create Comment API Spec

```javascript
// Agent invokes this skill
skill: fetchApiSpec("comments", "POST /api/v1/posts/{postId}/comments");

// Returns:
// - Path: /api/v1/posts/{postId}/comments
// - Method: POST
// - Path Parameters: postId
// - Request Body: CreateCommentRequest
// - Response: CreateCommentResponse
// - Error codes and handling
```

## Return Values

```javascript
{
  endpoint: "/api/v1/posts",
  method: "GET",
  operationId: "getPosts",
  parameters: [
    { name: "limit", in: "query", type: "number", required: false },
    { name: "offset", in: "query", type: "number", required: false }
  ],
  requestBody: null,
  responseSchema: "GetPostsResponse",
  typeDefinitions: "// TypeScript interface code",
  errorCodes: ["NOT_FOUND", "UNAUTHORIZED", "INTERNAL_ERROR"],
  swaggerUrl: "https://core-interface-ashen.vercel.app/#/Posts/getPosts"
}
```

## Related Resources

- **Swagger UI**: https://core-interface-ashen.vercel.app/
- **core-interface repo**: https://github.com/semicolon-devteam/core-interface
- **core-backend repo**: https://github.com/semicolon-devteam/core-backend
