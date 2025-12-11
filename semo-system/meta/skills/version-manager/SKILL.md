---
name: version-manager
description: SEMO 패키지 버저닝 및 npm 배포 자동화. Use when (1) packages/ 변경 후 npm 배포, (2) package.json 버전 업데이트, (3) Slack 릴리스 알림.
tools: [Bash, Read, Write, Edit]
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: version-manager 호출` 시스템 메시지를 첫 줄에 출력하세요.

# version-manager Skill

> SEMO 패키지 버저닝 및 npm 배포 자동화

## Purpose

packages/ 디렉토리의 npm 패키지 버저닝과 배포를 자동화합니다.

## Quick Start

```bash
# 1. 변경된 패키지 확인
git diff HEAD~1 --name-only | grep "^packages/"

# 2. 버전 타입 결정 (major/minor/patch)

# 3. 빌드 & 버전 업데이트 & 배포
cd packages/cli
npm run build
npm version {type}  # patch, minor, major
npm publish --access public

# 4. 커밋 & 푸시
git add -A && git commit -m "release: @anthropic/semo v{version}"
git push origin main

# 5. Slack 알림
```

## 배포 대상 패키지

| 패키지 | npm 이름 | 배포 |
|--------|----------|------|
| `packages/cli` | `@anthropic/semo` | ✅ |
| `packages/mcp-server` | `@anthropic/semo-mcp` | ✅ |
| `semo-system/*` | - | ❌ (npm 미배포) |

## Semantic Versioning

| 버전 | 트리거 | 예시 |
|------|--------|------|
| **MAJOR** | Breaking Change | API 변경, 호환성 깨짐 |
| **MINOR** | 기능 추가 | 새 명령어, 새 옵션 |
| **PATCH** | 버그 수정 | 오류 수정, 문서 보완 |

## 배포 프로세스

### 1. 빌드 및 버전 업데이트

```bash
cd packages/cli  # 또는 packages/mcp-server

# 빌드
npm run build

# 버전 업데이트 (자동으로 package.json 수정)
npm version patch  # 또는 minor, major
```

### 2. npm 배포

```bash
# 배포 전 확인
npm whoami
npm publish --dry-run

# 실제 배포
npm publish --access public
```

### 3. 커밋 & 푸시

```bash
git add -A
git commit -m "release: @anthropic/semo v{version}"
git push origin main
```

### 4. Slack 알림

`notify-slack` Skill 호출하여 `#_협업` 채널에 릴리스 알림 전송.

## SEMO Message

```markdown
[SEMO] Skill: version-manager 호출

[SEMO] Versioning: @anthropic/semo {old} → {new} ({type})

[SEMO] Versioning: npm publish 완료

[SEMO] Versioning: 커밋 & 푸시 완료

[SEMO] Skill: notify-slack 호출 - 릴리스 알림
```

## Error Handling

| 에러 | 원인 | 해결 |
|------|------|------|
| `npm ERR! 403` | 권한 없음 | `npm login` 실행 |
| `npm ERR! 402` | Private 패키지 | `--access public` 추가 |
| `npm ERR! 404` | 패키지 없음 | 최초 배포 시 정상 |

## Related

- [notify-slack Skill](../../../semo-skills/notify-slack/SKILL.md)
- [Workflow](references/workflow.md) - 상세 워크플로우
