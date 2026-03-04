---
name: release
description: |
  릴리즈 버전 관리 및 배포. Use when:
  (1) 버전 업데이트, (2) CHANGELOG 작성, (3) 릴리즈 노트 생성.
tools: [Bash, Read, Write]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: release 호출` 시스템 메시지를 첫 줄에 출력하세요.

# release Skill

> 릴리즈 버전 관리 및 배포

## Actions

| Action | 설명 | 트리거 |
|--------|------|--------|
| **version** | 버전 업데이트 | "버전 올려줘", "릴리즈 준비" |
| **changelog** | CHANGELOG 생성 | "CHANGELOG 작성" |
| **publish** | npm/GitHub 배포 | "릴리즈해줘" |

---

## Action: version (버전 업데이트)

### Workflow

```bash
# 1. 현재 버전 확인
CURRENT_VERSION=$(jq -r '.version' package.json)

# 2. 새 버전 결정 (Semantic Versioning)
# major.minor.patch
# 1.2.3 → 1.2.4 (patch)
# 1.2.3 → 1.3.0 (minor)
# 1.2.3 → 2.0.0 (major)

# 3. package.json 업데이트
npm version patch  # or minor, major

# 4. Git 태그 생성
git tag v1.2.4
git push origin v1.2.4
```

---

## Action: changelog (CHANGELOG 생성)

### 템플릿

```markdown
# CHANGELOG

## [1.2.4] - 2025-03-04

### Added
- 새로운 기능 추가

### Changed
- 기존 기능 변경

### Fixed
- 버그 수정

### Deprecated
- 곧 제거될 기능

### Removed
- 제거된 기능

### Security
- 보안 패치
```

---

## Action: publish (배포)

### npm 배포

```bash
# 1. 빌드
npm run build

# 2. npm 배포
npm publish --access public

# 3. GitHub 릴리즈
gh release create v1.2.4 \
  --title "v1.2.4" \
  --notes-file CHANGELOG.md
```

---

## 출력

```markdown
[SEMO] Skill: release 완료

✅ 릴리즈 v1.2.4 완료

**Version**: 1.2.4
**CHANGELOG**: 업데이트됨
**npm**: 배포 완료
**GitHub**: 릴리즈 생성됨
```

---

## Related

- `verify` - 배포 전 검증
- `deploy` - 서비스 배포
- `notify` - 릴리즈 알림
