# Schema Patterns Reference

## Common Table Patterns

### Basic Entity

```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);
```

### With Foreign Key

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Self-Reference

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    -- ...
);
```

## Index Patterns

```sql
-- Single column
CREATE INDEX idx_posts_status ON posts(status);

-- Composite
CREATE INDEX idx_posts_author_created ON posts(author_id, created_at DESC);

-- Partial
CREATE INDEX idx_posts_published ON posts(created_at DESC)
    WHERE status = 'PUBLISHED';
```

## Migration Naming

```text
V001__create_users.sql
V002__create_posts.sql
V003__create_comments.sql
V004__add_posts_index.sql
```
