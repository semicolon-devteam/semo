# Review Report Format

> semicolon-reviewer Agent의 리뷰 리포트 템플릿

## Report Template

```markdown
# Code Review: {feature/domain}

## ✅ Approved / ⚠️ Changes Requested / 🚫 Blocked

### Summary
Brief overview of changes and overall assessment.

---

## Team Codex Compliance

### Commits
- ✅ All commits follow convention
- ⚠️ Found 2 commits without proper scope

### Code Quality
- ✅ ESLint passes
- ❌ TypeScript errors: 3 found
- ⚠️ Found 5 console.log statements

**Action Required**:
\`\`\`bash
npx tsc --noEmit
grep -r "console.log" src/app/{domain}
\`\`\`

---

## DDD Architecture

### Structure
- ✅ All 4 layers implemented
- ⚠️ Missing index export in `_hooks/`

### Layer Compliance
- ✅ Repository uses server client
- ❌ Component imports repository directly (violation)

**Action Required**:
\`\`\`typescript
// ❌ Remove this
import { {Domain}Repository } from '../_repositories';

// ✅ Use this instead
import { use{Domain} } from '../_hooks';
\`\`\`

---

## Supabase Integration

### Pattern Compliance
- ✅ Uses createServerSupabaseClient
- ⚠️ Type assertion could be improved

**Suggestion**:
\`\`\`typescript
// Better (follows core-supabase)
const data = result.data as unknown as PostType[];
\`\`\`

---

## Testing

### Coverage
- ✅ Repository: 85%
- ⚠️ Hooks: 65% (below 80% target)
- ✅ Components: 72%

**Action Required**:
Add tests for error scenarios in hooks.

---

## Performance & Best Practices

- ✅ Server Components used appropriately
- ⚠️ Could optimize with dynamic imports

---

## Security & Accessibility

- ✅ No security issues
- ⚠️ Color contrast on button could be improved

---

## 🔴 Critical Issues (Must Fix)

1. TypeScript errors in {file}.ts:15,23,45
2. Component directly importing repository

## 🟡 Warnings (Should Fix)

1. Missing index export in _hooks/
2. Hook test coverage below 80%

## 🟢 Suggestions (Nice to Have)

1. Dynamic imports for optimization
2. Color contrast improvement

---

## Next Steps

1. Fix critical issues
2. Address warnings
3. Run quality checks:
   \`\`\`bash
   npm run lint && npx tsc --noEmit && npm test
   \`\`\`
4. Request re-review

---

## References

- Team Codex: https://github.com/semicolon-devteam/docs/wiki/Team-Codex
- DDD Architecture: See CLAUDE.md
- Reference Implementation: app/posts/
```
