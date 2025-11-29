---
name: task-progress
description: Track developer task progress with automated checklist and workflow support. Use when (1) developer is assigned an issue, (2) checking current progress status, (3) tracking development workflow from assignment to review, (4) automating workflow steps.
tools: [Bash, Read, Grep, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: task-progress 호출 - {이슈번호}` 시스템 메시지를 첫 줄에 출력하세요.

# task-progress Skill

> 개발자 업무 진행도를 체크리스트 형태로 표시하고 자동 진행 지원

## 트리거

- `/SAX:task-progress` 명령어
- "어디까지 했어", "현황", "체크리스트", "진행도" 키워드
- 이슈 URL 제공 시 orchestrator가 자동 호출
- "cm-office#32 할당받았어요" 패턴 감지 시

## 개발자 전체 프로세스

```text
1. 업무할당 (검수대기 → 검수완료)
2. GitHub Project 상태 변경 (검수완료 → 작업중)
3. Feature 브랜치 생성
4. Draft PR 생성
5. Speckit 기반 구현 (Spec → Plan → Tasks)
6. 테스트코드 작성 및 테스트 진행
7. 린트 및 빌드 통과
8. 푸시 및 리뷰 요청 (작업중 → 리뷰요청)
9. PR 승인 및 dev 머지 (리뷰요청 → 테스트중)
10. STG 환경 QA 테스트 (테스트중 → 병합됨)
```

### GitHub Project 상태 흐름

> **SoT**: 상태 목록은 `이슈관리` Project에서 직접 조회 - [project-status.md](../git-workflow/references/project-status.md) 참조

```text
검수대기 → 검수완료 → 작업중 → 리뷰요청 → 테스트중 → 병합됨
                        ↓         ↑
                    확인요청    수정요청
```

## Quick Checks

| Step | Command |
|------|---------|
| 브랜치 | `git branch --show-current` |
| PR 확인 | `gh pr list --head {branch} --json number,isDraft` |
| 린트 | `npm run lint` |
| 타입체크 | `npx tsc --noEmit` |
| 미푸시 확인 | `git log origin/{branch}..HEAD --oneline` |

## 자동화 가능 작업

- Draft PR 자동 생성 (빈 커밋 + gh pr create --draft)
- GitHub Project 상태 자동 변경
- 작업완료일 자동 설정

## SAX 메타데이터

작업 시작 시 `~/.claude.json` 업데이트:

```json
{
  "SAX": {
    "currentTask": {
      "issueNumber": 32,
      "repo": "cm-office",
      "branch": "feature/32-add-comments"
    }
  }
}
```

## Related Skills

- `health-check` - 환경 검증
- `implement` - 구현 진행

## References

For detailed documentation, see:

- [Verification Steps](references/verification-steps.md) - 10단계 검증 로직 상세
- [Automation](references/automation.md) - 자동화 명령, 출력 형식, 메타데이터
