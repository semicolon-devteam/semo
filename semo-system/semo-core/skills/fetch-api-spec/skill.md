---
name: fetch-api-spec
description: Fetch API specification from core-interface repository. Use when (1) implementing /api/v1/* routes, (2) need endpoint request/response schema, (3) require DTO naming conventions, (4) looking for API error response patterns.
tools: [Bash, Read, GitHub CLI]
---

# Fetch API Spec Skill

**Purpose**: Retrieve official API specification from core-interface repository for consistent API implementation

## Background

```text
core-interface (OpenAPI 3.1 Spec)
        ↓ (Single Source of Truth)
   ┌────┴────┐
   ↓         ↓
core-backend   Next.js API Routes
(Spring Boot)  (cm-template)
```

- **Swagger UI**: https://core-interface-ashen.vercel.app/
- **Role**: API 계약의 Single Source of Truth

## When to Use

- Implementing `/api/v1/*` routes in Next.js
- Need endpoint request/response schema
- Require DTO naming conventions
- During v0.4.x CODE phase

## Quick Start

```bash
# Fetch OpenAPI spec
gh api repos/semicolon-devteam/core-interface/contents/openapi-spec.json \
  --jq '.content' | base64 -d
```

## DTO Naming Convention

**Operation ID Prefix Rule**:

```typescript
// Operation ID: createPost
// Request: CreatePostRequest
// Response: CreatePostResponse
```

## Usage

```javascript
skill: fetchApiSpec("posts", "GET /api/v1/posts");
// Returns: path, method, parameters, response schema, TypeScript interfaces
```

## Critical Rules

1. **Always check spec first**: Never implement API without checking core-interface
2. **Follow DTO naming**: Operation ID prefix (e.g., GetMeResponse)
3. **Polymorphic patterns**: Use discriminator field for union types
4. **Error responses**: Follow standard ErrorResponse format

## Dependencies

- GitHub CLI (`gh`) with authentication
- Access to `semicolon-devteam/core-interface` repository

## Related Resources

- **Swagger UI**: https://core-interface-ashen.vercel.app/
- **core-interface repo**: https://github.com/semicolon-devteam/core-interface

## References

For detailed documentation, see:

- [DTO Patterns](references/dto-patterns.md) - Naming conventions, polymorphic types, examples
- [GitHub Commands](references/github-commands.md) - Fetch commands, usage examples
