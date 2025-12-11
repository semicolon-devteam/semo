---
name: feedback
description: SAX 패키지에 대한 피드백 (버그 리포트, 개선 제안) 수집 및 GitHub 이슈 생성 (공통)
---

# /SAX:feedback Command

SAX 패키지 사용 중 발생한 문제나 개선 아이디어를 GitHub 이슈로 생성합니다.

> **공통 커맨드**: 모든 SAX 패키지에서 사용 가능. 현재 컨텍스트의 패키지에 이슈 생성.

## Trigger

- `/SAX:feedback` 명령어
- "피드백", "피드백해줘", "버그 신고", "제안할게" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **버그 리포트**: SAX가 의도한 대로 동작하지 않았을 때
2. **개선 제안**: 새로운 기능이나 개선 아이디어가 있을 때

## Supported Packages

| 패키지 | Repository |
|--------|------------|
| sax-po | `semicolon-devteam/sax-po` |
| sax-next | `semicolon-devteam/sax-next` |
| sax-pm | `semicolon-devteam/sax-pm` |
| sax-qa | `semicolon-devteam/sax-qa` |
| sax-infra | `semicolon-devteam/sax-infra` |
| sax-meta | `semicolon-devteam/sax-meta` |
| sax-core | `semicolon-devteam/sax-core` |

## Action

`/SAX:feedback` 실행 시 `sax-core/skill:feedback`을 호출합니다.

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 피드백 요청

[SAX] Skill: feedback 호출 - {현재 패키지}
```

## Workflow

### Step 1: 피드백 유형 선택

```markdown
[SAX] Skill: feedback 호출 - {package}

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
  --repo semicolon-devteam/{package} \
  --title "[Feedback] {제목}" \
  --body "{본문}" \
  --label "{bug|enhancement},{package}"
```

### Step 4: 완료 안내

```markdown
[SAX] Feedback: 이슈 생성 완료

✅ 피드백이 등록되었습니다!

**이슈**: semicolon-devteam/{package}#{이슈번호}
**유형**: {버그/제안}

협업 매니저 Reus가 검토 후 처리할 예정입니다.
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 피드백 요청

[SAX] Skill: feedback 호출 - {package}

## 📝 SAX 피드백

어떤 유형의 피드백인가요?

1. **🐛 버그**: 의도한 대로 동작하지 않았어요
2. **💡 제안**: 개선 아이디어가 있어요

번호를 선택하거나 자유롭게 설명해주세요.
```

## Package Detection

현재 작업 컨텍스트에서 패키지를 자동 감지합니다:

| 컨텍스트 | 감지 방법 |
|----------|-----------|
| SAX-PO 작업 중 | 최근 sax-po Agent/Skill 사용 |
| SAX-Next 작업 중 | 최근 sax-next Agent/Skill 사용 |
| 불명확 | 사용자에게 확인 질문 |

### 패키지 불명확 시

```markdown
[SAX] Skill: feedback 호출

⚠️ 어떤 패키지에 대한 피드백인가요?

1. **sax-po** - 기획 도구
2. **sax-next** - 프론트엔드 도구
3. **sax-pm** - 프로젝트 관리 도구
4. **sax-qa** - QA 도구
5. **sax-infra** - 인프라 도구
6. **sax-meta** - SAX 관리 도구
7. **sax-core** - 공통 컴포넌트

번호 또는 패키지명으로 응답해주세요.
```

## Related

- [feedback Skill](../../skills/feedback/SKILL.md)
- [SAX Core - Principles](../../PRINCIPLES.md)
