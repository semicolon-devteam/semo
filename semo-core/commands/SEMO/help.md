# /SEMO:help

SEMO 도움말을 표시합니다.

## 응답

```markdown
# SEMO 도움말

## 사용 가능한 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 이 도움말 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:update` | SEMO 업데이트 |
| `/SEMO:onboarding` | 온보딩 가이드 |

## 기본 사용법

자연어로 요청하면 SEMO가 적절한 Skill로 라우팅합니다:

- "로그인 기능 만들어줘" → coder skill
- "테스트 작성해줘" → tester skill
- "슬랙에 알려줘" → notify-slack skill
- "피드백 등록해줘" → feedback skill

## 구조

- `.claude/agents/` - Agent 정의
- `.claude/skills/` - Skill 정의
- `.claude/memory/` - 컨텍스트 저장소
- `semo-system/` - SEMO 코어 (White Box)
```
