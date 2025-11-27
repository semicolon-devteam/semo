---
name: version-manager
description: SAX 패키지 시맨틱 버저닝 자동화. Use when (1) Agent/Skill/Command 변경 후 릴리스, (2) VERSION 및 CHANGELOG 업데이트, (3) Keep a Changelog 형식 버전 관리.
tools: [Bash, Read, Write, Edit]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: version-manager 호출 - {버전 타입}` 시스템 메시지를 첫 줄에 출력하세요.

# version-manager Skill

> SAX 패키지 버저닝 자동화 Skill

## Purpose

SAX 패키지의 Semantic Versioning 관리를 자동화합니다.

- VERSION 파일 업데이트
- CHANGELOG/{version}.md 파일 생성
- CHANGELOG/INDEX.md 업데이트
- Keep a Changelog 형식 준수

## Quick Start

```bash
# 1. 현재 버전 확인
cat sax/VERSION
# 예: 3.14.0

# 2. 변경사항 분석 후 버전 타입 결정
# MAJOR: 호환성 깨지는 변경
# MINOR: 기능 추가/삭제 (Agent, Skill, Command)
# PATCH: 버그 수정, 오타, 문서 보완

# 3. VERSION 업데이트
echo "3.15.0" > sax/VERSION

# 4. CHANGELOG 생성
touch sax/CHANGELOG/3.15.0.md

# 5. INDEX.md 업데이트
# Latest Version, Version History 섹션 업데이트

# 6. 커밋
git commit -m "📝 [SAX] v3.15.0"
```

## Semantic Versioning 요약

| 버전 | 트리거 | 예시 |
|------|--------|------|
| **MAJOR** | 호환성 깨지는 변경 | 워크플로우 근본 변경 |
| **MINOR** | 기능 추가/삭제 | Agent/Skill 추가, CLAUDE.md 변경 |
| **PATCH** | 버그/오타 수정 | 문서 보완, 성능 개선 |

## SAX Message

```markdown
[SAX] Skill: version-manager 사용

[SAX] Versioning: {old_version} → {new_version} ({version_type})
```

## Related

- [sax-architect Agent](../../agents/sax-architect.md)
- [package-validator Skill](../package-validator/SKILL.md)
- [SAX Core - Principles](https://github.com/semicolon-devteam/docs/blob/main/sax/core/PRINCIPLES.md)

## References

For detailed documentation, see:

- [Semantic Versioning Rules](references/semantic-versioning.md) - MAJOR/MINOR/PATCH 상세 규칙
- [Workflow](references/workflow.md) - 6단계 버저닝 프로세스
- [Changelog Format](references/changelog-format.md) - Keep a Changelog 템플릿
- [Output Format](references/output-format.md) - 성공/실패 출력, Edge Cases
