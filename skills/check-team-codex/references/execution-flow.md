# Execution Flow

## 1. Quick Check (Pre-commit)

```bash
# Essential checks before commit
npm run lint && \
npx tsc --noEmit && \
grep -r "console\.log\|debugger" src/ --exclude-dir=node_modules --exclude="*.test.*"
```

**Exit Codes**:
- `0`: All checks passed ✅
- `1`: Lint errors ❌
- `2`: TypeScript errors ❌
- `3`: Debug code found ⚠️

## 2. Full Check (Pre-PR)

```bash
# Comprehensive validation
npm run lint && \
npx tsc --noEmit && \
npm test && \
npm run test:coverage && \
git log -10 --oneline
```

## 3. CI/CD Check

Include in GitHub Actions:

```yaml
# .github/workflows/quality-check.yml
- name: Team Codex Validation
  run: |
    npm run lint
    npx tsc --noEmit
    npm test -- --coverage --watchAll=false
    # Check commit messages
    git log -10 --oneline --format="%s" | grep -E "^(feat|fix|docs|test|refactor|style|chore)\(.+\): .+"
```

## Output Format

### Summary Report

```markdown
# Team Codex Validation Report

## ✅ Passed / ⚠️ Warnings / ❌ Failed

### 1. Commit Messages
- ✅ All 10 recent commits follow convention
- Format: `type(scope): subject`

### 2. Code Quality
- ✅ ESLint: Passed (0 errors, 0 warnings)
- ❌ TypeScript: 3 errors found
  - `app/posts/_repositories/PostsRepository.ts:15` - Type error
  - `app/posts/_hooks/usePosts.ts:23` - Missing type
  - `models/posts/index.ts:8` - Invalid type assertion
- ⚠️ Debug Code: 2 instances found
  - `app/dashboard/page.tsx:45` - console.log
  - `app/posts/_components/PostsList.tsx:78` - console.log

### 3. Architecture
- ✅ DDD structure compliant
- ✅ No server code in client components
- ✅ All layers have index exports

### 4. Testing
- ✅ All tests passed (137/137)
- ✅ Coverage: 82.5% (above 70% threshold)
  - Repositories: 85%
  - Hooks: 80%
  - Components: 78%

### 5. Import Standards
- ✅ No wildcard imports
- ✅ Uses @ alias correctly
- ✅ Modular imports

---

## 🔴 Critical Issues (Must Fix)

1. **TypeScript Errors**: 3 errors must be resolved
   ```bash
   npx tsc --noEmit
   ```

2. **Debug Code**: Remove console.log statements
   ```bash
   # Remove these:
   app/dashboard/page.tsx:45
   app/posts/_components/PostsList.tsx:78
   ```

## 🟡 Warnings

None

## 🟢 All Checks Passed

- Commit messages
- ESLint
- Architecture
- Testing
- Imports

---

## Next Steps

1. Fix TypeScript errors
2. Remove debug code
3. Re-run validation:
   ```bash
   npm run lint && npx tsc --noEmit && npm test
   ```
4. Commit with proper message:
   ```bash
   git commit -m "fix(posts): Resolve type errors and remove debug code"
   ```
```

### Detailed Report (for CI/CD)

```json
{
  "status": "failed",
  "checks": {
    "commits": {
      "passed": true,
      "issues": []
    },
    "eslint": {
      "passed": true,
      "errors": 0,
      "warnings": 0
    },
    "typescript": {
      "passed": false,
      "errors": 3,
      "details": [
        {
          "file": "app/posts/_repositories/PostsRepository.ts",
          "line": 15,
          "message": "Type error"
        }
      ]
    },
    "debugCode": {
      "passed": false,
      "instances": 2,
      "locations": [
        "app/dashboard/page.tsx:45",
        "app/posts/_components/PostsList.tsx:78"
      ]
    },
    "architecture": {
      "passed": true,
      "violations": []
    },
    "tests": {
      "passed": true,
      "total": 137,
      "failed": 0,
      "coverage": 82.5
    }
  },
  "criticalIssues": 2,
  "warnings": 0
}
```
