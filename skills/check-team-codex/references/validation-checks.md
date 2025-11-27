# Validation Checks

> **SoT 참조**: 모든 검증 규칙은 `sax-core/TEAM_RULES.md`에서 관리됩니다.

## Check 1: Commit Messages (섹션 1.2 참조)

```bash
# Check last 10 commits
git log -10 --oneline --format="%s"
```

**Validation**:
- [ ] Format: `type(scope): subject`
- [ ] Valid type (feat/fix/docs/test/refactor/style/chore)
- [ ] Scope present
- [ ] Subject < 72 characters
- [ ] Imperative mood
- [ ] No period at end

**Common Violations**:
- `updated code` → Should be `feat(domain): Add feature description`
- `fixes` → Should be `fix(domain): Fix issue description`
- `WIP` → Should be squashed before merge

## Check 2: Code Quality

```bash
# Run linter
npm run lint

# Check TypeScript
npx tsc --noEmit

# Find debug code
grep -r "console\.log\|debugger" src/ --exclude-dir=node_modules --exclude="*.test.*"

# Find commented code (approximate)
grep -rn "^[[:space:]]*\/\/" src/ | grep -v "^[[:space:]]*\/\/ " | wc -l

# Check for any types
grep -r ": any\|as any" src/ --exclude-dir=node_modules --exclude="*.test.*"
```

**Validation**:
- [ ] ESLint passes (0 errors)
- [ ] TypeScript passes (0 errors)
- [ ] No console.log statements (except logging utilities)
- [ ] No debugger statements
- [ ] No large commented code blocks
- [ ] No `any` types

## Check 3: Pre-commit Hook Compliance

```bash
# Check if any commits bypassed hooks
git log --all --grep="--no-verify\|-n " --oneline

# Check Husky configuration
cat .husky/pre-commit
```

**Validation**:
- [ ] No `--no-verify` or `-n` flag usage
- [ ] Husky hooks configured
- [ ] Pre-commit hook runs lint and type check

## Check 4: DDD Architecture

```bash
# Check domain structure
for domain in app/*/; do
  echo "Checking $domain"
  ls -la "$domain" | grep -E "(_repositories|_api-clients|_hooks|_components)"
done

# Check for architecture violations
grep -r "'use client'" app/*/_repositories/
grep -r "createServerSupabaseClient" app/*/_components/
```

**Validation**:
- [ ] Domain structure follows DDD pattern
- [ ] No 'use client' in repositories
- [ ] No server client in components
- [ ] Each layer has index.ts exports

## Check 5: Testing Coverage

```bash
# Run tests
npm test

# Generate coverage report
npm run test:coverage

# Check coverage thresholds
cat coverage/coverage-summary.json | jq '.total'
```

**Validation**:
- [ ] All tests pass
- [ ] Overall coverage > 70%
- [ ] Repository coverage > 80%
- [ ] Hooks coverage > 80%
- [ ] Component coverage > 70%

## Check 6: Import Standards

```bash
# Check for wildcard imports
grep -r "import \*" src/ --exclude-dir=node_modules

# Check for relative imports beyond parent
grep -r "from '\.\./\.\./\.\." src/

# Check for missing @ alias
grep -r "from 'src/" src/
```

**Validation**:
- [ ] No wildcard imports
- [ ] Uses `@/` alias for deep imports
- [ ] Modular imports for large libraries
