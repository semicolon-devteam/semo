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
| `/SEMO:dry-run {프롬프트}` | 명령 검증 (라우팅 시뮬레이션) |
| `/SEMO:routing-map` | 라우팅 구조 시각화 |

## 기본 사용법

자연어로 요청하면 SEMO가 적절한 Skill로 라우팅합니다:

- "로그인 기능 만들어줘" → implement skill
- "테스트 작성해줘" → tester skill
- "슬랙에 알려줘" → notify-slack skill
- "피드백 등록해줘" → feedback skill
- "커밋하고 PR 만들어줘" → git-workflow skill

## 구조 (v4.0)

- `semo-system/semo-core/` - 166개 스킬, 41개 에이전트 통합
  - `skills/` - 모든 스킬 (Runtime 접두사로 구분)
  - `agents/` - 모든 에이전트
  - `references/` - Runtime/Domain별 참조 문서
- `.claude/memory/` - 컨텍스트 저장소
- `.claude/agents/` → semo-core/agents 심볼릭 링크
- `.claude/skills/` → semo-core/skills 심볼릭 링크
```
