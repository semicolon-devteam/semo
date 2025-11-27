---
name: /SAX:feedback
description: SAX-PO 패키지에 대한 피드백 (버그 리포트, 개선 제안) 수집 및 GitHub 이슈 생성
trigger: "/SAX:feedback"
---

# /SAX:feedback Command

SAX-PO 패키지 사용 중 발생한 문제나 개선 아이디어를 GitHub 이슈로 생성합니다.

## Trigger

- `/SAX:feedback` 명령어
- "피드백", "피드백해줘", "버그 신고", "제안할게" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **버그 리포트**: SAX가 의도한 대로 동작하지 않았을 때
2. **개선 제안**: 새로운 기능이나 개선 아이디어가 있을 때

## Action

`/SAX:feedback` 실행 시 `skill:feedback`을 호출합니다.

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 피드백 요청

[SAX] Skill: feedback 사용
```

## Workflow

### Step 1: 피드백 유형 선택

```markdown
[SAX] Skill: feedback 호출

## 📝 SAX 피드백

어떤 유형의 피드백인가요?

1. **🐛 버그**: 의도한 대로 동작하지 않았어요
2. **💡 제안**: 개선 아이디어가 있어요

번호를 선택하거나 자유롭게 설명해주세요.
```

### Step 2: 정보 수집

사용자의 설명을 바탕으로 이슈 내용을 정리합니다.

### Step 3: 이슈 생성

```bash
gh issue create \
  --repo semicolon-devteam/sax-po \
  --title "[Feedback] {제목}" \
  --body "{본문}" \
  --label "{bug|enhancement},sax-po"
```

### Step 4: 완료 안내

```markdown
[SAX] Feedback: 이슈 생성 완료

✅ 피드백이 등록되었습니다!

**이슈**: semicolon-devteam/sax-po#{이슈번호}
**유형**: {버그/제안}

협업 매니저 Reus가 검토 후 처리할 예정입니다.
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 피드백 요청

[SAX] Skill: feedback 사용

## 📝 SAX 피드백

어떤 유형의 피드백인가요?

1. **🐛 버그**: 의도한 대로 동작하지 않았어요
2. **💡 제안**: 개선 아이디어가 있어요

번호를 선택하거나 자유롭게 설명해주세요.
```

## Related

- [feedback Skill](../skills/feedback/SKILL.md)
- [Orchestrator](../agents/orchestrator.md)
