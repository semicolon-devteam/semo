# Quality Gate

```bash
npm run lint && npx tsc --noEmit && npm run build
```

커밋 시 항상 pre-commit 훅을 통과시킨다. 브랜치: `dev` (기본, PR 타겟).

## CLI 배포 (팀 전파)

| 패키지 | npm 이름 | 배포 트리거 |
|--------|----------|------------|
| `packages/cli` | `@team-semicolon/semo-cli` | `dev` 브랜치 push 시 자동 배포 |
| `packages/mcp-kb` | `@team-semicolon/semo-mcp-kb` | Git tag `mcp-v*` |

`dev` 브랜치에 커밋 후 push하면 CLI npm 패키지가 자동 배포된다. 별도 태그 불필요.
