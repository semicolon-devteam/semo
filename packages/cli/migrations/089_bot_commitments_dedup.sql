-- 089: bot_commitments dedup guard
-- 동일한 Slack 이벤트(msg.ts)가 여러 slack-router 인스턴스에 의해 중복 dispatch되는
-- 경우 commitment이 중복 생성되는 것을 DB 레벨에서 차단한다.
--
-- 배경: 4/12-13 period에 slack-router가 2개 동시 실행되어 거의 모든 commitment이
-- 15~20초 간격으로 짝을 이뤄 중복 생성됨. 루터 정리로 즉발은 해결됐으나 재발 방지를
-- 위해 DB 유니크 제약을 추가한다.
--
-- 키: (bot_id, pipeline_context->>'slack_event_id')
-- 조건: status IN ('pending','active') AND pipeline_context ? 'slack_event_id'
--   - done/failed 행은 포함하지 않아 재처리(재시도)는 허용
--   - slack_event_id가 없는 로컬/크론/github 경로는 영향 없음

CREATE UNIQUE INDEX IF NOT EXISTS bot_commitments_slack_event_uniq
  ON semo.bot_commitments (bot_id, (pipeline_context->>'slack_event_id'))
  WHERE status IN ('pending', 'active')
    AND pipeline_context ? 'slack_event_id';
