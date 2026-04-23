# Quality Gate

```bash
npm run lint && npx tsc --noEmit && npm run build
```

커밋 시 항상 pre-commit 훅을 통과시킨다. 브랜치: `dev` (기본, PR 타겟).

## CLI 배포 (팀 전파)

| 패키지            | npm 이름                      | 배포 트리거                               | 워크플로우                          |
| ----------------- | ----------------------------- | ----------------------------------------- | ----------------------------------- |
| `packages/cli`    | `@team-semicolon/semo-cli`    | Git tag `cli-v*` 또는 `workflow_dispatch` | `.github/workflows/publish-cli.yml` |
| `packages/mcp-kb` | `@team-semicolon/semo-mcp-kb` | Git tag `mcp-v*`                          | `.github/workflows/publish-mcp.yml` |

> **중요**: `dev` 브랜치 push 는 `packages/semo-dashboard` Docker 빌드만 트리거한다 (`dev-ci-cd.yml`). CLI npm 배포는 자동이 아니다.

### CLI 배포 절차

```bash
# 1) packages/cli/package.json 의 version 필드를 올린다
cd packages/cli && npm version {patch|minor|major} --no-git-tag-version

# 2) 루트에서 커밋 + tag push
git commit -am "chore(cli): bump to vX.Y.Z"
git tag cli-vX.Y.Z
git push origin dev --tags
```

또는 Actions UI 에서 `Publish semo-cli` → `Run workflow` → 버전 직접 입력.

## Bin Alias 계약 (NON-NEGOTIABLE)

`packages/cli/package.json`의 `bin` 필드는 다음 두 개를 **모두** 유지한다:

- `semo` — 권장 이름
- `semo-cli` — 레거시 호환 (운영 스크립트·crontab·훅이 의존 중)

하나만 남기면 `semo-system/bot-workspaces/**/scripts/*.sh`, 사용자 crontab, shared hooks 등 PATH 참조 지점이 깨진다. 통합/리네이밍 시에도 두 bin 모두 유지.
