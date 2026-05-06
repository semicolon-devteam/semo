-- 118_retire_semiclaw_semobot_alias
--
-- 2026-04-23 의 migration 104 가 'semiclaw → semobot' 리브랜드 1단계로 alias 를 깔았다.
-- 그러나 2026-05-06 의사결정(KB: semo decision/semobot-independent-agent-2026-05-06)으로
-- SemoBot 은 SemiClaw 의 후계가 아니라 별 system_guide 에이전트로 분리되었다.
--
-- 현재 alias 가 살아 있는 동안에는:
--   * channel-router 의 모든 'semiclaw' 입력(직접 [Route: semiclaw] / 하드코딩된
--     orchestrator 폴백 / phase 폴백 등)이 'semobot' 으로 재라우팅된다.
--   * SemoBot 의 runtime_source 는 'slack-router-system' (persona only, inbox 없음).
--   * 결과적으로 orchestrator 트래픽이 처리 불능 상태로 빠지는 잠재적 버그.
--
-- 본 마이그레이션은 alias 를 retire(soft delete) 한다. 향후 다시 켜고 싶다면
-- retired_at = NULL 로 되돌리면 된다. 'orphan' 로 보존되는 row 자체는 삭제하지
-- 않는다 (감사용).
--
-- 별 후속 정리 항목 (이 PR 범위 밖):
--   * SemoBot bot_status row 의 role 을 'orchestrator' → 'system_management' 로 정리
--   * SemoBot 의 bot_delegation 행들(SemiClaw 복제) 정리 — persona only 이므로 위임 불필요
--   * SemoBot 의 seat_id (snamanager0) 가 다른 봇에 할당되지 않은 sanity check

BEGIN;

UPDATE semo.bot_id_aliases
SET retired_at = NOW()
WHERE alias = 'semiclaw'
  AND canonical_bot_id = 'semobot'
  AND retired_at IS NULL;

COMMIT;
