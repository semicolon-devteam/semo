---
name: deploy-npm
description: |
  SEMO npm 패키지 배포. Use when (1) "npm 배포", "패키지 배포해줘",
  (2) CLI/MCP 변경 후 배포, (3) "버전 올리고 배포".
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: deploy-npm 호출`

# deploy-npm Skill

> SEMO npm 패키지 (@team-semicolon/semo-cli, @team-semicolon/semo-mcp) 배포 자동화

## Purpose

Meta 환경에서 CLI 또는 MCP 서버 변경 후 npm 레지스트리에 배포합니다.

## Trigger Keywords

- "npm 배포해줘", "패키지 배포"
- "CLI 배포", "MCP 배포"
- "버전 올리고 배포해줘"

## 배포 대상 패키지

| 패키지 | npm 이름 | 경로 |
|--------|----------|------|
| CLI | @team-semicolon/semo-cli | packages/cli |
| MCP | @team-semicolon/semo-mcp | packages/mcp-server |

## Workflow

### Step 1: 변경 감지

```bash
# CLI 변경 확인
git diff --name-only HEAD~1 | grep -q "packages/cli" && echo "CLI 변경됨"

# MCP 변경 확인
git diff --name-only HEAD~1 | grep -q "packages/mcp-server" && echo "MCP 변경됨"
```

### Step 2: 버전 범프

```bash
# packages/cli/
cd packages/cli
npm version patch  # or minor/major

# packages/mcp-server/
cd packages/mcp-server
npm version patch  # or minor/major
```

### Step 3: 빌드

```bash
# CLI 빌드
cd packages/cli && npm run build

# MCP 빌드
cd packages/mcp-server && npm run build
```

### Step 4: npm 배포

```bash
# CLI 배포
cd packages/cli && npm publish --access public

# MCP 배포
cd packages/mcp-server && npm publish --access public
```

### Step 5: Git 태그

```bash
# 태그 생성
git tag -a "cli-v$(cat packages/cli/package.json | jq -r .version)" -m "CLI release"
git tag -a "mcp-v$(cat packages/mcp-server/package.json | jq -r .version)" -m "MCP release"
git push origin --tags
```

## Version Bump Rules

| 변경 유형 | 버전 범프 | 예시 |
|----------|----------|------|
| 버그 수정, 문서 수정 | patch | 1.0.0 → 1.0.1 |
| 새 기능 추가 | minor | 1.0.0 → 1.1.0 |
| Breaking Change | major | 1.0.0 → 2.0.0 |

## Output Format

```markdown
[SEMO] Skill: deploy-npm 호출

## npm 배포 결과

| 패키지 | 이전 버전 | 새 버전 | 상태 |
|--------|----------|--------|------|
| @team-semicolon/semo-cli | 3.0.0 | 3.0.1 | ✅ 배포 완료 |
| @team-semicolon/semo-mcp | 1.2.0 | - | ⏭️ 변경 없음 |

### 배포 로그

\`\`\`
npm notice package size: 12.5 kB
npm notice total files: 8
+ @team-semicolon/semo-cli@3.0.1
\`\`\`

[SEMO] Skill: deploy-npm 완료
```

## Error Handling

### npm 인증 오류

```markdown
❌ npm 인증 실패

**해결 방법**:
\`\`\`bash
npm login --registry=https://registry.npmjs.org/
\`\`\`
```

### 버전 충돌

```markdown
❌ 버전 충돌: 3.0.1 이미 존재

**해결 방법**:
\`\`\`bash
npm version patch  # 다음 버전으로 범프
\`\`\`
```

## Pre-requisites

- npm 로그인 상태 (`npm whoami`)
- @team-semicolon 조직 publish 권한

## Related

- [version-manager](../version-manager/SKILL.md) - 버저닝 자동화
- [package-sync](../package-sync/SKILL.md) - 로컬 동기화
