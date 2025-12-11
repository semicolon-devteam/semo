# Output Format

> version-manager의 출력 형식

## 성공 시

```json
{
  "status": "SUCCESS",
  "package": "@anthropic/semo",
  "old_version": "1.0.0",
  "new_version": "1.1.0",
  "version_type": "minor",
  "npm_url": "https://www.npmjs.com/package/@anthropic/semo"
}
```

## 실패 시

```json
{
  "status": "FAILED",
  "package": "@anthropic/semo",
  "error": "npm ERR! 403 Forbidden",
  "recovery": [
    "npm login으로 재인증",
    "npm publish --dry-run으로 문제 진단"
  ]
}
```

## Error Types

| Error | 설명 | 해결 |
|-------|------|------|
| `NPM_NOT_LOGGED_IN` | npm 미로그인 | `npm login` |
| `NPM_FORBIDDEN` | 권한 없음 | 패키지 소유자 확인 |
| `NPM_VERSION_EXISTS` | 버전 중복 | 새 버전으로 변경 |
| `BUILD_FAILED` | 빌드 실패 | TypeScript 에러 수정 |
