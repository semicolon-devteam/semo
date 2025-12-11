# Workflow

> version-manager의 npm 배포 워크플로우

## 전체 흐름

```
1. 변경 감지
   ↓
2. 빌드
   ↓
3. 버전 업데이트
   ↓
4. npm 배포
   ↓
5. 커밋 & 푸시
   ↓
6. Slack 알림
```

## Phase 1: 변경 감지

```bash
# 변경된 패키지 확인
git diff HEAD~1 --name-only | grep "^packages/"

# CLI 변경 여부
if git diff HEAD~1 --name-only | grep -q "^packages/cli/"; then
  DEPLOY_CLI=true
fi

# MCP 서버 변경 여부
if git diff HEAD~1 --name-only | grep -q "^packages/mcp-server/"; then
  DEPLOY_MCP=true
fi
```

## Phase 2: 빌드

```bash
cd packages/cli  # 또는 packages/mcp-server
npm run build
```

**빌드 검증**:
- `dist/` 디렉토리 생성 확인
- TypeScript 컴파일 에러 없음

## Phase 3: 버전 업데이트

```bash
# 버전 타입에 따라 선택
npm version patch  # 버그 수정: 1.0.0 → 1.0.1
npm version minor  # 기능 추가: 1.0.0 → 1.1.0
npm version major  # Breaking: 1.0.0 → 2.0.0
```

**자동 처리**:
- `package.json`의 `version` 필드 업데이트
- Git 태그 생성 (선택적)

## Phase 4: npm 배포

```bash
# 로그인 상태 확인
npm whoami

# Dry-run 테스트
npm publish --dry-run

# 실제 배포
npm publish --access public
```

**배포 대상**:

| 패키지 | npm 이름 |
|--------|----------|
| `packages/cli` | `@anthropic/semo` |
| `packages/mcp-server` | `@anthropic/semo-mcp` |

## Phase 5: 커밋 & 푸시

```bash
git add -A
git commit -m "release: @anthropic/semo v{version}"
git push origin main
```

**커밋 메시지 형식**:
```
release: @anthropic/semo v{version}
```

## Phase 6: Slack 알림

`notify-slack` Skill 호출:

```bash
# 알림 데이터
channel: "#_협업"
type: "release"
package: "@anthropic/semo"
version: "{new_version}"
```

## Validation

**배포 전**:
- ✅ npm 로그인 상태 (`npm whoami`)
- ✅ 빌드 성공 (`npm run build`)
- ✅ dry-run 성공 (`npm publish --dry-run`)

**배포 후**:
- ✅ npm 패키지 게시 확인
- ✅ 커밋 & 푸시 완료
- ✅ Slack 알림 전송

## Error Recovery

| 에러 | 원인 | 해결 |
|------|------|------|
| `npm ERR! 403` | 권한 없음 | `npm login` |
| `npm ERR! 402` | Private 패키지 | `--access public` |
| `npm ERR! 409` | 버전 중복 | 버전 번호 변경 |
| `ENEEDAUTH` | 미인증 | `npm login` |
