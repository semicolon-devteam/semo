---
name: /SAX:help
description: SAX-Next 도움말 - sax-help skill 호출
trigger: "/SAX:help"
---

# /SAX:help Command

SAX-Next 패키지 사용 가이드를 표시합니다.

## Trigger

- `/SAX:help` 명령어
- "도움말", "뭘 해야 하지", "help" 키워드

## Action

이 Command는 `skill:sax-help`를 호출합니다.

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 도움 요청

[SAX] Skill 호출: sax-help
```

**상세 구현**: [sax-help Skill](../../skills/sax-help/SKILL.md) 참조
