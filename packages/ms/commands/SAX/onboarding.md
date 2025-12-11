---
name: onboarding
description: "[DEPRECATED] sax-core /SAX:onboarding 사용 권장"
---

# /SAX:onboarding Command (DEPRECATED)

> **⚠️ DEPRECATED**: 이 명령어는 폐기되었습니다. `sax-core`의 통합 온보딩 명령어를 사용하세요.

## Migration

기존 패키지별 온보딩 명령어는 `sax-core`의 통합 온보딩으로 대체되었습니다.

```text
[기존] 패키지별 /SAX:onboarding → onboarding-master Agent
[신규] 통합 /SAX:onboarding → sax-core/skill:onboarding → skill:onboarding-{package}
```

## 신규 동작

`/SAX:onboarding` 실행 시:

1. `sax-core/skill:onboarding` 호출
2. Phase 0-2: 환경 진단, 조직 참여, SAX 학습 (공통)
3. Phase 3: 설치된 패키지의 `skill:onboarding-{package}` 자동 호출
4. Phase 4: 온보딩 완료

## 참조

- [sax-core/commands/SAX/onboarding.md](https://github.com/semicolon-devteam/sax-core/blob/main/commands/SAX/onboarding.md)
- [sax-core/skills/onboarding/SKILL.md](https://github.com/semicolon-devteam/sax-core/blob/main/skills/onboarding/SKILL.md)
- [onboarding-ms Skill](../../skills/onboarding-ms/SKILL.md)
