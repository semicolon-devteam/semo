-- 131_concierge_requests.sql
-- E4 컨시어지 요청 큐 — 고객이 요청(예: 이미지 생성)하면 적재 → 우리 팀이 처리 → 산출물 전달.
-- additive only. tenant_id 격리(129 패턴). kind 통제(현재 image; 확장 가능).
CREATE TABLE IF NOT EXISTS semo.concierge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image'
    CHECK (kind IN ('image', 'other')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,       -- 요청 상세(상품·스타일·문구 등)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'delivered', 'rejected', 'canceled')),
  requested_by TEXT,                                 -- 사장님/에이전트
  assignee TEXT,                                     -- 처리 담당(우리 팀)
  result_ref JSONB,                                  -- 전달 산출물 참조(중앙 저장 경로 등)
  notified_at TIMESTAMPTZ,                           -- 우리 슬랙 알림 시각
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE semo.concierge_requests IS
  'E4 컨시어지 요청 큐(이미지 등). pending→in_progress→delivered. tenant 격리.';

CREATE INDEX IF NOT EXISTS idx_concierge_tenant_status
  ON semo.concierge_requests (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_concierge_status_created
  ON semo.concierge_requests (status, created_at);

DROP TRIGGER IF EXISTS trg_concierge_updated ON semo.concierge_requests;
CREATE TRIGGER trg_concierge_updated
  BEFORE UPDATE ON semo.concierge_requests
  FOR EACH ROW EXECUTE FUNCTION semo.trg_relations_updated();  -- 128에서 정의한 updated_at 트리거 재사용

-- 우리 팀 처리 대기열 뷰(오래된 순)
CREATE OR REPLACE VIEW semo.v_concierge_queue AS
SELECT id, tenant_id, kind, payload, requested_by, created_at
FROM semo.concierge_requests
WHERE status = 'pending'
ORDER BY created_at;
