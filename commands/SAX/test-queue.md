---
name: test-queue
description: 테스트 대기 이슈 목록 조회
---

# /SAX:test-queue Command

테스트 대기 중인 이슈 목록을 조회합니다.

## Trigger

- `/SAX:test-queue` 명령어
- "테스트할 이슈", "테스트 대기", "뭐 테스트해" 키워드

## Action

`skill:test-queue`를 실행하여:

1. "테스트중" 상태 이슈 조회
2. 대기 시간 기준 정렬
3. 레포지토리별 그룹핑

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 테스트 대기열 조회

[SAX] Skill: test-queue 호출

## 📋 테스트 대기열

### cm-office (2건)

| # | 이슈 | 제목 | 대기 | 담당자 |
|---|------|------|------|--------|
| 1 | #45 | 댓글 기능 추가 | 2시간 | @developer1 |
| 2 | #48 | 좋아요 버튼 | 1일 | @developer2 |

---

테스트할 이슈를 선택하세요: "{repo}#{number} 테스트해줘"
```

## Related

- [test-queue Skill](../../skills/test-queue/SKILL.md)
