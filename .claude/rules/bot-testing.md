# 봇/에이전트 테스트 규칙 (NON-NEGOTIABLE)

> 봇 관련 변경 후 반드시 E2E 테스트를 직접 수행한다. 사용자에게 위임하지 않는다.

## 아키텍처 (2026-04-08~)

SEMO Agents는 **Agent SDK 기반 Orchestrator** 아키텍처:

- Slack Socket Mode → SlackGateway → Router → SessionPool → `@anthropic-ai/claude-agent-sdk` query()
- 봇 정의: `~/.claude/agents/{botId}/{botId}.md` (YAML frontmatter)
- 세션 상태: `~/.semo/sessions/.session-state.json`
- 오케스트레이터: `packages/orchestrator/`

**OpenClaw HTTP 엔드포인트(18789~18909)는 폐기됨.**

## 테스트 방법

### 1. Slack 채널 직접 테스트 (권장)

```
@SemoBot [Route: planclaw] {테스트 메시지}
@SemoBot [Route: reviewclaw] {코드 리뷰 요청}
```

`[Route: {botId}]` 태그로 특정 봇에 직접 라우팅.

### 2. Orchestrator 로그 확인

오케스트레이터가 Slack Gateway로 동작 중이면 로그에서 확인:

- 라우팅 결과: `[router] → {botId}`
- 세션 dispatch: `[session-pool] dispatch {botId}`
- 에이전트 응답: `[session-pool] response from {botId}`
- 에스컬레이션: `[escalation] {fromBot} → {toBot}`

### 3. 에이전트 정의 검증

```bash
# 에이전트 frontmatter 확인
head -10 ~/.claude/agents/{botId}/{botId}.md

# 모든 에이전트 모델 확인
for f in ~/.claude/agents/*/; do echo "$(basename $f): $(head -5 $f/*.md | grep model)"; done
```

## 테스트 체크리스트

봇 설정/스킬/에이전트 정의 변경 시:

1. **라우팅**: 올바른 봇으로 라우팅되는지 (Phase 기반 + 키워드 기반)
2. **모델 동작**: frontmatter에 지정된 모델로 응답하는지
3. **KB-First**: 서비스 관련 질문 → KB 조회 후 답변하는지
4. **URL 정확성**: 응답에 날조 URL이 없는지
5. **응답 길이**: 10줄 이내 핵심 답변인지
6. **에스컬레이션**: 봇 간 인계가 올바르게 동작하는지

## 봇별 정보

| 봇         | 역할              | Phase       |
| ---------- | ----------------- | ----------- |
| semiclaw   | PM/오케스트레이터 | 0           |
| planclaw   | 기획              | 1-3, 5-6, 9 |
| designclaw | 디자인            | 4           |
| workclaw   | 개발              | 7-8         |
| reviewclaw | 코드 리뷰         | PR 라벨     |
| infraclaw  | 인프라            | Track B     |
| growthclaw | 마케팅/성장       | KPI         |

## 훅 테스트 (공유 훅)

```bash
# URL 가드
echo '{"cwd":"~/.semo/sessions/semiclaw","last_assistant_message":"테스트 내용"}' \
  | bash ~/.semo/shared/hooks/url-validator-guard.sh

# context-router
echo '{"user_message":"테스트 질문","cwd":"~/.semo/sessions/semiclaw"}' \
  | bash ~/.semo/shared/hooks/context-router.sh
```
