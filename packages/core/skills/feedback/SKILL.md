---
name: feedback
description: |
  SEMO 패키지 피드백 수집 및 GitHub 이슈 생성 (공통 Skill).
  Use when (1) /SEMO:feedback 명령어 호출, (2) 사용자가 SEMO 동작 오류 지적, (3) 개선 제안 요청.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: feedback 호출 - {피드백 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# feedback Skill

> SEMO 패키지에 대한 사용자 피드백을 GitHub 이슈로 생성 (SEMO 공통 Skill)

## Purpose

모든 SEMO 패키지에서 공통으로 사용하는 피드백 수집 Skill입니다.

## Feedback Types

| 유형 | 설명 | 라벨 |
|------|------|------|
| **bug** | 의도한 대로 동작하지 않음 | `bug`, `{package}` |
| **enhancement** | 개선 아이디어, 새 기능 요청 | `enhancement`, `{package}` |

## Workflow

1. **피드백 유형 확인**: 버그 or 제안
2. **정보 수집**: 질문/결과/기대사항
3. **이슈 생성**: GitHub issue create
4. **완료 메시지**: 이슈 번호 안내

## Output

```markdown
[SEMO] Feedback: 이슈 생성 완료

✅ 피드백이 등록되었습니다!

**이슈**: semicolon-devteam/{package}#{이슈번호}
**제목**: {이슈 제목}
**유형**: {버그/제안}
```

## References

- [Issue Templates](references/issue-templates.md)
- [Trigger Detection](references/trigger-detection.md)
