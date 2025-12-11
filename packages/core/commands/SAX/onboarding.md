---
name: onboarding
description: SAX 통합 온보딩 프로세스 시작 - 모든 패키지 공통
---

# /SAX:onboarding Command

신규 팀원을 위한 SAX 통합 온보딩 프로세스를 시작합니다.

## Trigger

- `/SAX:onboarding` 명령어
- "처음이에요", "신규", "온보딩 시작", "시작 방법" 키워드
- health-check 실패 후 orchestrator 위임

## 동작

`skill:onboarding` (sax-core) 호출:

1. **Phase 0**: 환경 진단 (skill:health-check)
2. **Phase 1**: 조직 참여 확인 (Slack, GitHub)
3. **Phase 2**: SAX 개념 학습
4. **Phase 3**: 패키지별 온보딩 (skill:onboarding-{package})
5. **Phase 4**: 온보딩 완료 및 메타데이터 저장

## 패키지별 온보딩 자동 위임

설치된 패키지에 따라 Phase 3에서 해당 패키지의 온보딩 스킬을 자동 호출합니다:

| 패키지 | 호출 스킬 | 실습 내용 |
|--------|----------|----------|
| sax-po | skill:onboarding-po | Epic 생성 실습 |
| sax-next | skill:onboarding-next | cm-template 클론 실습 |
| sax-qa | skill:onboarding-qa | 테스트 케이스 작성 실습 |
| sax-design | skill:onboarding-design | Figma + MCP 연동 실습 |
| sax-backend | skill:onboarding-backend | API 설계 실습 |
| sax-pm | skill:onboarding-pm | Task 관리 실습 |
| sax-infra | skill:onboarding-infra | 인프라 설정 실습 |
| sax-ms | skill:onboarding-ms | 마이크로서비스 실습 |

> 패키지에 `skill:onboarding-{package}`가 없으면 Phase 3 건너뜀

## Expected Output

```markdown
[SAX] Skill: onboarding 호출

=== SAX 온보딩 프로세스 시작 ===

Phase 0: 환경 진단
✅ GitHub CLI: v2.40.0
✅ Git: v2.43.0
✅ Node.js: v20.10.0
...

Phase 1: 조직 참여 확인
✅ GitHub Org: semicolon-devteam 멤버
✅ Slack: #_협업 채널 참여

Phase 2: SAX 개념 학습
📚 SAX 4대 원칙 안내
📚 Orchestrator-First 설명
📚 개발자 워크플로우 안내

Phase 3: 패키지별 온보딩
[SAX] Skill: onboarding-next 호출
📚 cm-template 클론 실습
📚 SAX 인터랙션 체험

Phase 4: 온보딩 완료
✅ 메타데이터 업데이트 완료

=== 온보딩 완료 ===
다음 단계: 팀 리더에게 업무 할당 요청
```

## Related

- [onboarding Skill](../../skills/onboarding/SKILL.md)
- [health Command](./health.md)
- [health-check Skill](../../skills/health-check/SKILL.md)
