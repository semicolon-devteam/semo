# Semantic Versioning Rules

> npm 패키지 버저닝 규칙

## MAJOR (x.0.0)

**트리거**: Breaking Change

- CLI 명령어 제거/변경
- API 인터페이스 변경
- 필수 옵션 추가
- 기존 기능 동작 변경

**예시**:
- `semo init` 옵션 구조 변경
- MCP 서버 프로토콜 변경

## MINOR (0.x.0)

**트리거**: 기능 추가

- 새 명령어 추가
- 새 옵션 추가
- 새 기능 추가

**예시**:
- `semo add` 명령어 추가
- `--force` 옵션 추가

## PATCH (0.0.x)

**트리거**: 버그 수정

- 버그 수정
- 문서 수정
- 성능 개선

**예시**:
- 심볼릭 링크 버그 수정
- 에러 메시지 개선

## npm version 명령어

```bash
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0
```
