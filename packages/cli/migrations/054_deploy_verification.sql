-- Deploy Verification Gate
-- GFP 인프라 Phase 승인 시 배포 검증 결과를 저장하는 테이블.
-- InfraClaw 또는 Dashboard API가 검증 결과를 기록하고,
-- handleInfraTrackApproval()이 Phase 0/2 승인 전 통과 여부를 확인한다.

CREATE TABLE IF NOT EXISTS semo.deploy_verifications (
  verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES semo.services(service_id) ON DELETE CASCADE,
  infra_phase     INT  NOT NULL,
  checks          JSONB NOT NULL,
  overall_status  TEXT NOT NULL CHECK (overall_status IN ('pass', 'fail')),
  verified_by     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deploy_verif_service
  ON semo.deploy_verifications(service_id, infra_phase);
