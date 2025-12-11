---
name: feedback
description: SEMO에 대한 피드백 (버그 리포트, 개선 제안) 수집 및 GitHub 이슈 생성 (공통)
---

# /SEMO:feedback Command

SEMO 사용 중 발생한 문제나 개선 아이디어를 GitHub 이슈로 생성합니다.

> **공통 커맨드**: 모든 SEMO 프로젝트에서 사용 가능

## Trigger

- `/SEMO:feedback` 명령어
- "피드백", "피드백해줘", "버그 신고", "제안할게" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **버그 리포트**: SEMO가 의도한 대로 동작하지 않았을 때
2. **개선 제안**: 새로운 기능이나 개선 아이디어가 있을 때

## Action

`/SEMO:feedback` 실행 시 GitHub 이슈를 생성합니다.

```markdown
[SEMO] Command: feedback 실행

> GitHub 이슈를 생성합니다.
```

## Workflow

### Step 1: 피드백 유형 선택

```markdown
[SEMO] Command: feedback 실행

## SEMO 피드백

어떤 유형의 피드백인가요?

1. **Bug**: 의도한 대로 동작하지 않았어요
2. **Feature**: 개선 아이디어가 있어요

번호를 선택하거나 자유롭게 설명해주세요.
```

### Step 2: 정보 수집

사용자의 설명을 바탕으로 이슈 내용을 정리합니다.

### Step 3: 이슈 생성

```bash
gh issue create \
  --repo semicolon-devteam/semo \
  --title "[Feedback] {제목}" \
  --body "{본문}" \
  --label "{bug|enhancement}"
```

### Step 4: 완료 안내

```markdown
[SEMO] Command: feedback 완료

피드백이 등록되었습니다!

**이슈**: semicolon-devteam/semo#{이슈번호}
**유형**: {버그/제안}

팀에서 검토 후 처리할 예정입니다.
```

## Expected Output

```markdown
[SEMO] Command: feedback 실행

## SEMO 피드백

어떤 유형의 피드백인가요?

1. **Bug**: 의도한 대로 동작하지 않았어요
2. **Feature**: 개선 아이디어가 있어요

번호를 선택하거나 자유롭게 설명해주세요.
```

## Configuration

GitHub CLI 인증이 필요합니다:

```bash
gh auth login
```

## Related

- [SEMO Repository](https://github.com/semicolon-devteam/semo)
- [SEMO Principles](../../principles/PRINCIPLES.md)
