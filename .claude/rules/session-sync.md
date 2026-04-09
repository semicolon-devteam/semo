# Agent Session Synchronization (NON-NEGOTIABLE)

> 모든 환경(로컬 Claude Code, Agent SDK 오케스트레이터)에서 봇 디스패치 시
> commitment claim/release와 session lifecycle 추적을 반드시 수행한다.

## 핵심 규칙

1. **Commitment 필수**: 봇에게 작업을 위임할 때 반드시 `bot_commitments` 레코드를 생성
   - 로컬: `semo commitments create` CLI → 서브에이전트 spawn → SubagentStop 훅에서 `semo agent-flush`로 자동 done
   - 오케스트레이터: `CommitmentTracker.claimForDispatch()` → dispatch → `markDone()`

2. **Session 추적 필수**: 봇 세션 시작/종료 시 `bot_sessions` 업데이트
   - 로컬: SubagentStop 훅 → `semo agent-flush` → bot_sessions terminated
   - 오케스트레이터: `CommitmentTracker.registerSessions()` / `terminateSessions()`

3. **동시 점유 금지**: 같은 commitment를 두 세션이 동시에 claim할 수 없음
   - `assigned_session`이 이미 설정된 commitment는 다른 세션이 claim 불가
   - 소프트 락: `UPDATE ... WHERE assigned_session IS NULL OR assigned_session = $me`

4. **환경 식별 필수**: `session_owner` 필드로 환경 구분
   - 로컬: `{username}-local` (예: `reus-local`)
   - Agent SDK: `agent-sdk`
   - OpenClaw: `openclaw-{botId}`

5. **Stale 감지**: 24시간 이상 상태 변경 없는 active commitment은 stale 처리
   - `semo commitments stale --threshold 24`

## 구현 위치

| 환경 | Commitment 관리 | Session 관리 | 비용 추적 |
|------|----------------|-------------|----------|
| 로컬 Claude Code | CLI `semo commitments` + SubagentStop 훅 | `semo agent-flush` | Claude Code 내장 |
| Agent SDK 오케스트레이터 | `CommitmentTracker` (`packages/orchestrator/src/commitment-tracker.ts`) | 동일 모듈 | `CostTracker` + commitment_id 연동 |

## 코드 변경 시 체크리스트

봇 디스패치 로직을 수정할 때:
- [ ] commitment claim/done이 누락되지 않았는가?
- [ ] 에러/타임아웃 시 commitment가 failed/stale로 처리되는가?
- [ ] bot_sessions 상태가 정확히 반영되는가?
- [ ] 로컬과 오케스트레이터 양쪽에 동일한 패턴이 적용되는가?
