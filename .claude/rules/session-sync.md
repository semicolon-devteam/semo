# Agent Session Synchronization (NON-NEGOTIABLE)

> 모든 환경(로컬 Claude Code, Architecture B 봇 세션)에서 봇 디스패치 시
> commitment 생성/마감과 session lifecycle 추적을 반드시 수행한다.

## 핵심 규칙

1. **Commitment 필수**: 봇에게 작업을 위임할 때 반드시 `bot_commitments` 레코드를 생성
   - **Slack 수신 (Architecture B)**: slack-router가 메시지 수신 시 INSERT, outbox reply 포스팅 후 UPDATE done (`source_type='slack-inbox'`)
   - **로컬 reus Claude Code**: PreToolUse(Task) 훅 → `semo agent-claim` → SubagentStop 훅 → `semo agent-flush` done (`source_type='claude-code-local'`)

2. **Session 추적 필수**: `bot_sessions` 테이블로 활성 세션 기록
   - 로컬: SessionStart 훅 → `semo session-register` / SessionEnd 훅 → `semo session-terminate`
   - Architecture B 봇 Claude 세션: 현재 session row 자체는 생성하지 않음 (commitment만 기록)

3. **환경 식별**: `session_owner` 필드로 환경 구분
   - 로컬 reus: `reus-local` (일반), 로컬 session_key 접두어 `local-`
   - Slack 수신 Architecture B: `{botId}-slack`
   - (레거시) Agent SDK: `agent-sdk` — 2026-04-14 삭제됨

4. **Stale 감지**: slack-router가 1시간 주기 setInterval로 reap
   - 24시간 이상 상태 변경 없는 active commitment → `status='failed'`, `metadata.fail_reason='stale_auto'`
   - 24시간 이상 지속된 active session → `status='terminated'`
   - slack-router가 살아있는 한 `claude-code-local`과 `slack-inbox` 양쪽 모두 reap 대상

## 구현 위치

| 환경 | Commitment 진입 | Commitment 마감 | Stale Reaper |
|------|----------------|----------------|-------------|
| Slack 수신 (Architecture B) | `packages/slack-router/src/index.ts` handleSlackMessage | OutboxReader onReplyPosted → handleReplyPosted | slack-router setInterval 1h |
| 로컬 reus Claude Code | `semo agent-claim` (PreToolUse 훅) | `semo agent-flush` (SubagentStop 훅) | slack-router setInterval 1h (공유) |

## Architecture B 경계

- **봇 세션 내부 subagent spawn은 현재 추적 대상 아님**. planclaw가 workclaw를 내부 위임해도 DB에는 별도 commitment가 생기지 않는다. Slack 메시지 1건 = commitment 1행.
- 봇 재기동 시 legacy Stop 훅(`semo agent-flush --bot ${botId}`)의 fallback 쿼리는 `source_type != 'slack-inbox'` 가드로 slack-inbox commitment를 건드리지 않는다.
- Migration 089 (`bot_commitments_slack_event_uniq`)가 `(bot_id, pipeline_context->>'slack_event_id')` 부분 유니크 인덱스로 중복 router 인스턴스를 DB 레벨에서 차단한다.

## 코드 변경 시 체크리스트

봇 디스패치 로직을 수정할 때:
- [ ] Slack 경로 수정 시 slack-router INSERT/UPDATE가 여전히 동작하는가?
- [ ] 로컬 경로 수정 시 agent-claim/flush 훅이 끊어지지 않는가?
- [ ] source_type을 새로 추가할 경우 reaper 쿼리와 legacy fallback 가드도 고려했는가?
- [ ] 에러/타임아웃 시 commitment가 stale_auto로 결국 reap되는가?
