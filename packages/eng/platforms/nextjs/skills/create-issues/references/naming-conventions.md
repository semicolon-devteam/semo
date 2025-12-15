# Issue Naming Conventions

## Title Format

```
[Layer] Description
```

Examples:
- `[v0.0.x CONFIG] Check dependencies`
- `[v0.1.x PROJECT] Scaffold posts domain structure`
- `[v0.2.x TESTS] Write PostsRepository unit tests`
- `[v0.3.x DATA] Define Post and Comment models`
- `[v0.4.x CODE] Implement useComments hook`

## Label Conventions

### Layer Labels (required)
- `v0.0.x-config`
- `v0.1.x-project`
- `v0.2.x-tests`
- `v0.3.x-data`
- `v0.4.x-code`

### Domain Labels (required)
- `domain:posts`
- `domain:auth`
- `domain:dashboard`
- `domain:profile`

### Complexity Labels (optional)
- `complexity:simple` - Straightforward, < 1 hour
- `complexity:medium` - Moderate, 1-3 hours
- `complexity:complex` - Challenging, > 3 hours

### Type Labels (required)
- `task` - From tasks.md
- `bug` - Bug fix
- `feature` - New feature
- `epic` - Parent Epic
