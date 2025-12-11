# Versioning Guide

> SAX 패키지 버저닝 상세 가이드

## Semantic Versioning

| 유형 | 형식 | 조건 | 예시 |
|------|------|------|------|
| **MAJOR** | x.0.0 | 호환성 깨짐, 워크플로우 근본 변경 | 라우팅 규칙 전면 개편 |
| **MINOR** | 0.x.0 | Agent/Skill 추가/삭제, 기능 추가 | 새 Agent 추가 |
| **PATCH** | 0.0.x | 버그 수정, 오타 수정 | 문서 오타 수정 |

## VERSION 파일 업데이트

```bash
# 현재 버전 확인
cat VERSION

# 새 버전으로 업데이트
echo "{new_version}" > VERSION
```

## CHANGELOG 생성

**파일 경로**: `CHANGELOG/{new_version}.md`

```markdown
# SAX v{new_version} - {YYYY-MM-DD}

### Added

- **{Component Name}** ({Package})
  - {설명}

### Changed

- **{Component Name}** ({Package})
  - {변경 내용}

### Removed

- **{Component Name}** ({Package})
  - {제거 이유}

### Migration Guide (MAJOR/MINOR만)

**{Package} 사용자**:

1. {변경사항 설명}
2. {마이그레이션 절차}
```

## INDEX 업데이트

**파일 경로**: `CHANGELOG/INDEX.md`

업데이트 항목:
1. "Latest Version" 업데이트
2. "Version History" 섹션에 새 버전 추가

## 버저닝 체크리스트

- [ ] `VERSION` 업데이트
- [ ] `CHANGELOG/{version}.md` 생성
- [ ] `CHANGELOG/INDEX.md` 업데이트 (Latest Version, Version History)
- [ ] CLAUDE.md 업데이트 (해당 시)
- [ ] orchestrator.md 업데이트 (Agent 추가/삭제 시)
- [ ] .claude/ 동기화
- [ ] Git 커밋 (`📝 [SAX] vX.Y.Z` 형식)

## Git 커밋 형식

```bash
git commit -m "📝 [SAX] v{new_version}

🚀 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```
