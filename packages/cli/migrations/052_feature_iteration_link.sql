-- 052: service_features에 iteration_id FK 추가 (스프린트 기반 기능 관리)
BEGIN;

ALTER TABLE semo.service_features
  ADD COLUMN IF NOT EXISTS iteration_id UUID REFERENCES semo.service_iterations(iteration_id);

CREATE INDEX IF NOT EXISTS idx_service_features_iteration
  ON semo.service_features(iteration_id)
  WHERE iteration_id IS NOT NULL;

COMMIT;
