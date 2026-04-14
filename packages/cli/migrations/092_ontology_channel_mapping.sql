-- 092: ontology 채널 매핑 컬럼 추가
--
-- Orchestrator 라우터가 services 테이블 대신 ontology에서 직접 채널→도메인 매핑을 조회.
-- 비-서비스 도메인(organization, team, module 등)도 채널 라우팅 가능.
--
-- 선행 조건:
--   070: services.slack_channel 컬럼 존재
--   082: services.discord_channel 컬럼 존재

-- Step 1: ontology에 채널 컬럼 추가
ALTER TABLE semo.ontology
  ADD COLUMN IF NOT EXISTS slack_channel TEXT,
  ADD COLUMN IF NOT EXISTS discord_channel TEXT;

-- Step 2: 라우터 성능용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_ontology_slack_channel
  ON semo.ontology (slack_channel) WHERE slack_channel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ontology_discord_channel
  ON semo.ontology (discord_channel) WHERE discord_channel IS NOT NULL;

-- Step 3: services → ontology 기존 매핑 역동기화
UPDATE semo.ontology o
SET slack_channel = s.slack_channel,
    discord_channel = s.discord_channel
FROM semo.services s
WHERE o.domain = s.service_domain
  AND o.entity_type IN ('service', 'platform', 'module')
  AND (s.slack_channel IS NOT NULL OR s.discord_channel IS NOT NULL);
