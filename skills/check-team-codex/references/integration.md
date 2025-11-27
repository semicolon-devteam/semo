# Integration Examples

## Git Hook (Husky)

```bash
# .husky/pre-commit
#!/bin/sh

echo "🔍 Running Team Codex validation..."

# Run checks
npm run lint || exit 1
npx tsc --noEmit || exit 1

# Check for debug code
DEBUG_CODE=$(grep -r "console\.log\|debugger" src/ --exclude-dir=node_modules --exclude="*.test.*" || true)
if [ -n "$DEBUG_CODE" ]; then
  echo "❌ Debug code found:"
  echo "$DEBUG_CODE"
  echo ""
  echo "Remove debug code before committing."
  exit 1
fi

echo "✅ Team Codex validation passed"
```

## VS Code Task

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Team Codex Check",
      "type": "shell",
      "command": "npm run lint && npx tsc --noEmit && npm test",
      "problemMatcher": [],
      "group": {
        "kind": "test",
        "isDefault": true
      }
    }
  ]
}
```

## Package.json Scripts

```json
{
  "scripts": {
    "check:codex": "npm run lint && npx tsc --noEmit && npm test",
    "check:commits": "git log -10 --oneline --format='%s' | grep -E '^(feat|fix|docs|test|refactor|style|chore)\\(.+\\): .+'",
    "check:debug": "grep -r 'console\\.log\\|debugger' src/ --exclude-dir=node_modules --exclude='*.test.*' || true"
  }
}
```

## Reference Links

- **Team Codex**: https://github.com/semicolon-devteam/docs/wiki/Team-Codex
- **DDD Architecture**: See `CLAUDE.md`
- **Commit Convention**: https://www.conventionalcommits.org/

## Remember

- **Run before every commit**: Prevent issues early
- **Fix all critical issues**: Never bypass with `--no-verify`
- **Maintain standards**: Consistency across the team
- **Automate checks**: Use Husky, CI/CD
- **Review regularly**: Keep Team Codex up to date
