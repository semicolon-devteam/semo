-- 114_runtime_target_columns.sql
-- P5-6: ExecutionTarget / Runtime Portable DB 스키마 확장
--
-- 봇이 어떤 호스트에서 어떤 모델로 어떤 도구·투사 채널과 결합해 동작할지를
-- DB SoT 로 표현. 기존 capability 는 packages/common/src/runtime 인터페이스에
-- 코드로만 있었지만, 봇 인스턴스별 선호/제약은 DB 가 SoT.
--
-- 모든 컬럼 nullable — 기존 봇은 변경 없이 동작 (회귀 0).

ALTER TABLE semo.bot_status
  ADD COLUMN IF NOT EXISTS runtime_hint TEXT[],
  ADD COLUMN IF NOT EXISTS tool_capabilities TEXT[],
  ADD COLUMN IF NOT EXISTS projection_targets JSONB;

COMMENT ON COLUMN semo.bot_status.runtime_hint IS
  'P5-6: 선호 호스트 우선순위 배열. 예: [''claude-code'', ''codex-cli'', ''ollama-cli'']. RuntimeHarness 가 첫 번째 사용 가능 host 선택.';

COMMENT ON COLUMN semo.bot_status.tool_capabilities IS
  'P5-6: 봇이 호출 가능한 도구 이름 배열. ToolGateway register 결과와 매칭. 예: [''kb_get'', ''kb_upsert'', ''commitments_create''].';

COMMENT ON COLUMN semo.bot_status.projection_targets IS
  'P5-6: 기본 투사 타깃 JSONB 배열. 예: [{"channel":"slack-block","destination":"C123","options":{"botId":"semiclaw"}}]. ProjectionEmitter.emitAll 에 전달.';

-- 인덱스 — runtime_hint 로 호스트별 봇 조회 자주 발생 시
CREATE INDEX IF NOT EXISTS idx_bot_status_runtime_hint
  ON semo.bot_status USING GIN (runtime_hint);
