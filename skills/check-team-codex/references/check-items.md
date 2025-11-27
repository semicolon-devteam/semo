# Check Items Detail

## 1. Commit Message Format

**📚 Reference**: [Git Rules - Commit Messages](https://github.com/semicolon-devteam/docs/wiki/rules-git)

```bash
# Check last 10 commits
git log --oneline -10
```

- Validate against Git Rules documentation (GIT-CM-xxx rules)
- 규칙 상세 내용은 위 링크 참조 (직접 명시하지 않음)

## 2. ESLint Compliance

```bash
npm run lint
```

- Zero errors expected
- Zero warnings expected (strict mode)
- Custom rules from `.eslintrc.json`

## 3. TypeScript Strict Mode

```bash
npx tsc --noEmit
```

- Zero type errors expected
- Strict mode enabled
- No implicit any
- Strict null checks

## 4. Debug Code Detection

Search patterns:

```bash
# Find console.log
grep -r "console\.log" src/

# Find debugger statements
grep -r "debugger" src/
```

- Search for `console.log`
- Search for `console.debug`
- Search for `debugger`
- Check for commented-out code blocks
- Detect TODO comments in production code

## 5. 'any' Type Detection

```bash
grep -r ":\s*any" src/
grep -r "as any" src/
```

- Report all 'any' usages
- Categorize by severity
- Suggest explicit types

## 6. Pre-commit Hook Bypass Check

```bash
git log -1 --format=%B | grep -i "no-verify"
```

- Detect `--no-verify` or `-n` flag usage
- Flag as CRITICAL violation
- Team Codex prohibits hook bypassing

## 7. Architecture Compliance

- Verify no `'use client'` in Repository files
- Check no direct Supabase imports in components
- Validate Factory Pattern for API clients
- Ensure proper layer separation

## Severity Levels

### 🔴 CRITICAL (Blocks PR)

- ESLint errors
- TypeScript errors
- Pre-commit hook bypass
- Architecture violations

### 🟡 WARNING (Should fix)

- Debug code (console.log, debugger)
- 'any' types
- TODO comments
- ESLint warnings

### 🟢 INFO (Nice to have)

- Code style suggestions
- Performance hints
- Documentation improvements
