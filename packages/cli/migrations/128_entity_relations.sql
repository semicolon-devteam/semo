-- 128_entity_relations.sql
-- semicolony 제품 facade 기반: 고객/플랫폼 엔티티 관계 그래프.
--
-- 원칙:
--   - additive only: 기존 KB/ontology/action_items/bot_commitments write path 변경 없음.
--   - relation_type은 DB 등록 테이블로 통제한다. free-string relation을 금지한다.
--   - 추출 relation은 proposed가 기본이며 승인 후 approved로 live projection에 노출한다.
--   - tenant_id와 scope를 분리해 tenant-local 관계와 platform-global 관계를 구분한다.
-- runner(db.ts)가 파일 전체를 BEGIN/COMMIT 으로 감싸므로 여기엔 트랜잭션 구문을 넣지 않는다.

CREATE TABLE IF NOT EXISTS semo.relation_types (
  relation_type TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  inverse_type TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE semo.relation_types IS
  '등록형 relation enum. 코드 배포 없이 relation_type을 통제 추가하되 free-string 관계 생성을 막는다.';

INSERT INTO semo.relation_types (relation_type, description, inverse_type)
VALUES
  ('owned_by', '엔티티의 소유/책임 주체', 'owns'),
  ('owns', '소유/책임지는 대상', 'owned_by'),
  ('depends_on', '완료/운영에 필요한 선행 의존성', 'required_by'),
  ('required_by', '다른 엔티티가 의존하는 선행 항목', 'depends_on'),
  ('decided_by', '결정한 사람/팀/에이전트', 'decided'),
  ('decided', '결정 주체가 내린 결정', 'decided_by'),
  ('blocks', '다른 업무/엔티티를 막는 원인', 'blocked_by'),
  ('blocked_by', '다른 업무/엔티티에 의해 막힘', 'blocks'),
  ('uses_tool', '업무 수행에 사용하는 도구/시스템', 'used_by'),
  ('used_by', '도구/시스템을 사용하는 주체', 'uses_tool'),
  ('requires_approval', '실행 전 승인이 필요한 대상', 'approves'),
  ('approves', '승인 권한/승인 주체', 'requires_approval'),
  ('reported_to', '보고 대상 사람/팀/에이전트', 'receives_report_from'),
  ('receives_report_from', '보고를 받는 관계의 역방향', 'reported_to')
ON CONFLICT (relation_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS semo.entity_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  scope TEXT NOT NULL DEFAULT 'tenant-local'
    CHECK (scope IN ('tenant-local', 'platform-global')),
  source_ref JSONB NOT NULL
    CHECK (jsonb_typeof(source_ref) = 'object'),
  relation_type TEXT NOT NULL
    REFERENCES semo.relation_types(relation_type),
  target_ref JSONB NOT NULL
    CHECK (jsonb_typeof(target_ref) = 'object'),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'retired', 'rejected')),
  confidence NUMERIC(5,4)
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  acl JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (scope = 'platform-global' OR tenant_id IS NOT NULL),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

COMMENT ON TABLE semo.entity_relations IS
  '고객 업무 facade용 관계 그래프. proposed→approved 승인 게이트를 통과한 관계만 live projection에서 사용한다.';
COMMENT ON COLUMN semo.entity_relations.source_ref IS
  '관계 출발점. 예: {"kind":"agent","id":"ag-team-jumuni"} 또는 {"kind":"kb","domain":"axoracle","key":"decision","sub_key":"..."}';
COMMENT ON COLUMN semo.entity_relations.target_ref IS
  '관계 도착점. source_ref와 같은 JSON object reference 규약을 쓴다.';
COMMENT ON COLUMN semo.entity_relations.provenance IS
  '추출/승인 출처. 예: {"source":"onboarding","message_ts":"...","extractor":"colony"}';
COMMENT ON COLUMN semo.entity_relations.acl IS
  'tenant/user/agent별 읽기·실행 제한 메타데이터. enforcement는 후속 phase에서 적용한다.';

CREATE INDEX IF NOT EXISTS idx_relation_types_status
  ON semo.relation_types (status);

CREATE INDEX IF NOT EXISTS idx_entity_relations_tenant_status
  ON semo.entity_relations (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_entity_relations_scope_status
  ON semo.entity_relations (scope, status);

CREATE INDEX IF NOT EXISTS idx_entity_relations_type_status
  ON semo.entity_relations (relation_type, status);

CREATE INDEX IF NOT EXISTS idx_entity_relations_source_ref
  ON semo.entity_relations USING GIN (source_ref jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_entity_relations_target_ref
  ON semo.entity_relations USING GIN (target_ref jsonb_path_ops);

CREATE OR REPLACE FUNCTION semo.trg_relations_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_relation_types_updated ON semo.relation_types;
CREATE TRIGGER trg_relation_types_updated
  BEFORE UPDATE ON semo.relation_types
  FOR EACH ROW EXECUTE FUNCTION semo.trg_relations_updated();

DROP TRIGGER IF EXISTS trg_entity_relations_updated ON semo.entity_relations;
CREATE TRIGGER trg_entity_relations_updated
  BEFORE UPDATE ON semo.entity_relations
  FOR EACH ROW EXECUTE FUNCTION semo.trg_relations_updated();

CREATE OR REPLACE VIEW semo.v_entity_relations_live AS
SELECT *
FROM semo.entity_relations
WHERE status = 'approved'
  AND (valid_from IS NULL OR valid_from <= NOW())
  AND (valid_to IS NULL OR valid_to > NOW());
