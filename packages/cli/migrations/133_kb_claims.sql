-- 133_kb_claims.sql
-- 지식 도서관 "원자 사실 카드"(G1) sidecar — 문서 행을 쪼개지 않고 옆에 붙인다.
-- 설계: docs/superpowers/specs/2026-06-12-knowledge-library-design.md (M2).
-- additive only / 멱등. 가격·담당자·상태·정책·영업시간·고객속성 등 바뀌고 검증가능한 최소 단위.
-- 권위 모델: Colony 추출 등은 status='proposed'로만 적재 → 승인(D3 선택 게이트) 후 approved 만 응대에 사용.

CREATE TABLE IF NOT EXISTS semo.kb_claims (
  kb_claim_id      BIGSERIAL PRIMARY KEY,
  tenant_id        UUID NOT NULL,
  scope            TEXT NOT NULL DEFAULT 'tenant-local'
    CHECK (scope IN ('tenant-local', 'platform-global')),
  source_kb_id     BIGINT NULL REFERENCES semo.knowledge_base(kb_id),  -- 출처 문서(있으면)
  subject_ref      JSONB NOT NULL,             -- 주어(엔티티) 참조 {kind,id,...}
  predicate        TEXT  NOT NULL,             -- 술어(통제 어휘 권장)
  object_ref       JSONB NULL,                 -- 목적어가 엔티티면
  object_value     TEXT  NULL,                 -- 목적어가 리터럴(가격·상태 등)이면
  status           TEXT  NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'retired', 'rejected')),
  confidence       NUMERIC NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  evidence         JSONB NULL,                 -- 근거(메시지 ts·span·출처)
  extractor_version TEXT NULL,                 -- 어떤 추출기/버전이 제안했나
  valid_from       TIMESTAMPTZ NULL,           -- 현실시간 유효(미상=NULL 허용)
  valid_to         TIMESTAMPTZ NULL,
  tx_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- DB 시간(bitemporal)
  tx_to            TIMESTAMPTZ NULL,
  created_by       TEXT NULL,
  approved_by      TEXT NULL,
  approved_at      TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (object_ref IS NOT NULL OR object_value IS NOT NULL)
);
COMMENT ON TABLE semo.kb_claims IS
  '원자 사실 카드(sidecar). proposed→approved 게이트. bitemporal(valid_*/tx_*). 응대는 approved+current만.';

CREATE INDEX IF NOT EXISTS idx_kb_claims_tenant_status ON semo.kb_claims (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_claims_subject       ON semo.kb_claims USING gin (subject_ref);
CREATE INDEX IF NOT EXISTS idx_kb_claims_source        ON semo.kb_claims (source_kb_id) WHERE source_kb_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_claims_current       ON semo.kb_claims (tenant_id, predicate)
  WHERE status = 'approved' AND tx_to IS NULL;

DROP TRIGGER IF EXISTS trg_kb_claims_updated ON semo.kb_claims;
CREATE TRIGGER trg_kb_claims_updated
  BEFORE UPDATE ON semo.kb_claims
  FOR EACH ROW EXECUTE FUNCTION semo.trg_relations_updated();  -- 128 정의 updated_at 트리거 재사용

-- 현행·승인된 사실만(응대 그라운딩용)
CREATE OR REPLACE VIEW semo.v_kb_claims_current AS
  SELECT * FROM semo.kb_claims
  WHERE status = 'approved'
    AND tx_to IS NULL
    AND (valid_to IS NULL OR valid_to > NOW());
