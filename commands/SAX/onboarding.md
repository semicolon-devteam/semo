---
name: onboarding
description: 신규 PO/기획자 온보딩 프로세스 시작
---

# /SAX:onboarding Command

신규 PO/기획자를 위한 온보딩 프로세스를 시작합니다.

## Trigger

- `/SAX:onboarding` 명령어
- "처음이에요", "신규", "온보딩 시작" 키워드

## Action

`onboarding-master` Agent를 호출하여 5단계 온보딩 프로세스를 안내합니다.

## Process

```text
1. 환경 진단 (skill:health-check)
2. 조직 참여 확인 (Slack, GitHub)
3. SAX 개념 학습 (PO 워크플로우)
4. 실습 (Epic 생성)
5. 온보딩 완료 및 메타데이터 저장
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 온보딩 요청

[SAX] Agent: onboarding-master 호출 (트리거: /SAX:onboarding)

=== SAX 온보딩 프로세스 시작 ===

Phase 0: 환경 진단
...

Phase 2: PO 워크플로우
1. Epic 생성 ("댓글 기능 Epic 만들어줘")
2. (선택) Spec 초안 작성
3. 개발팀 전달
4. Task 동기화
5. 진행도 추적
```

## Related

- [onboarding-master Agent](../../agents/onboarding-master/onboarding-master.md)
- [health-check Skill](../../skills/health-check/SKILL.md)
- [epic-master Agent](../../agents/epic-master.md)
