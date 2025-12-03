---
name: onboarding
description: 신규 디자이너 온보딩 프로세스 시작
---

# /SAX:onboarding Command

신규 디자이너를 위한 온보딩 프로세스를 시작합니다.

## Trigger

- `/SAX:onboarding` 명령어
- "처음이에요", "신규", "온보딩 시작" 키워드

## Action

`onboarding-master` Agent를 호출하여 6단계 온보딩 프로세스를 안내합니다.

## Process

```text
Phase 0: 환경 진단 (skill:health-check)
Phase 1: 조직 참여 확인 (Slack, GitHub, Figma)
Phase 2: SAX 개념 학습 (디자이너 워크플로우)
Phase 3: Antigravity 설정 (선택)
Phase 4: 실습 (목업 생성 또는 핸드오프)
Phase 5: 참조 문서 안내
Phase 6: 온보딩 완료 및 메타데이터 저장
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 온보딩 요청

[SAX] Agent: onboarding-master 호출 (트리거: /SAX:onboarding)

=== SAX-Design 온보딩 프로세스 시작 ===

Phase 0: 환경 진단
...

Phase 2: 디자이너 워크플로우
1. 목업 생성 ("로그인 화면 목업 만들어줘")
2. 핸드오프 문서 생성 ("개발팀에 전달할 문서 만들어줘")
3. Figma 연동 ("Figma에서 디자인 가져와")
4. 개발팀 협업
```

## Related

- [onboarding-master Agent](../../agents/onboarding-master/onboarding-master.md)
- [health-check Skill](../../skills/health-check/SKILL.md)
- [design-master Agent](../../agents/design-master/design-master.md)
