-- 055: Feature Lifecycle Pipeline
--
-- service_features.status 확장: planned → in-spec → spec-ready → in-dev → in-test → active / deprecated
-- 상태 전환 감사 로그 테이블 추가
--
-- 선행 조건: 049_service_features.sql, 052_services_table_rename.sql

BEGIN;

-- 1. status 컬럼 확장 (varchar(20) → varchar(30) for 'spec-ready' etc.)
ALTER TABLE semo.service_features
  ALTER COLUMN status TYPE VARCHAR(30);

-- 2. CHECK 제약 추가 — 유효 상태값 강제
ALTER TABLE semo.service_features
  ADD CONSTRAINT chk_feature_status
  CHECK (status IN ('planned', 'in-spec', 'spec-ready', 'in-dev', 'in-test', 'active', 'deprecated'));

-- 3. 상태 전환 감사 로그
CREATE TABLE IF NOT EXISTS semo.feature_status_transitions (
  transition_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id     UUID NOT NULL REFERENCES semo.service_features(feature_id) ON DELETE CASCADE,
  from_status    VARCHAR(30) NOT NULL,
  to_status      VARCHAR(30) NOT NULL,
  triggered_by   VARCHAR(50) NOT NULL DEFAULT 'system',  -- 'system' | 'user' | bot_id
  reason         TEXT,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_transitions_feature
  ON semo.feature_status_transitions(feature_id, created_at DESC);

COMMENT ON TABLE semo.feature_status_transitions IS
  'Feature lifecycle 상태 전환 감사 로그. 누가/언제/왜 상태를 바꿨는지 추적.';

COMMIT;
