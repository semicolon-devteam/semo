---
name: /SAX:onboarding
description: 신규 개발자 온보딩 프로세스 시작
trigger: "/SAX:onboarding"
---

# /SAX:onboarding Command

신규 개발자를 위한 온보딩 프로세스를 시작합니다.

## Trigger

- `/SAX:onboarding` 명령어
- "처음이에요", "신규", "온보딩 시작" 키워드

## Action

`onboarding-master` Agent를 호출하여 5단계 온보딩 프로세스를 안내합니다.

## Process

```text
1. 환경 진단 (skill:health-check)
2. 조직 참여 확인 (Slack, GitHub)
3. SAX 개념 학습
4. 실습 (cm-template)
5. 온보딩 완료 및 메타데이터 저장
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 온보딩 요청

[SAX] Agent: onboarding-master 호출 (트리거: /SAX:onboarding)

=== SAX 온보딩 프로세스 시작 ===

Phase 0: 환경 진단
...
```

## References

- [onboarding-master Agent](../agents/onboarding-master.md)
- [health-check Skill](../skills/health-check/skill.md)
