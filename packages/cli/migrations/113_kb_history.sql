-- 113_kb_history.sql
-- P1-5: KB 변경 이력 — knowledge_base 의 INSERT/UPDATE/DELETE 자동 기록
--
-- 목적: context push / kb upsert 가 잘못된 값으로 덮어썼을 때 롤백·감사·diff 분석 가능.
-- snapshot 형식: kb_snapshot JSONB 에 OLD/NEW 행 통째 직렬화 (스키마 확장에 robust).

CREATE TABLE IF NOT EXISTS semo.knowledge_base_history (
  history_id BIGSERIAL PRIMARY KEY,
  kb_id BIGINT,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  changed_by VARCHAR(100),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  -- INSERT/DELETE: 해당 행 통째. UPDATE: 변경 전(OLD) 행 통째.
  kb_snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_history_kb_id
  ON semo.knowledge_base_history(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_history_changed_at
  ON semo.knowledge_base_history(changed_at DESC);
-- 도메인/키 검색 위해 JSONB 부분 인덱스 (kb_snapshot.domain / .key)
CREATE INDEX IF NOT EXISTS idx_kb_history_domain_key
  ON semo.knowledge_base_history(
    (kb_snapshot->>'domain'),
    (kb_snapshot->>'key')
  );

CREATE OR REPLACE FUNCTION semo.kb_history_trigger_fn() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO semo.knowledge_base_history(kb_id, operation, changed_by, kb_snapshot)
      VALUES (NEW.kb_id, 'insert', NEW.created_by, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO semo.knowledge_base_history(kb_id, operation, changed_by, kb_snapshot)
      VALUES (OLD.kb_id, 'update', COALESCE(NEW.created_by, OLD.created_by), to_jsonb(OLD));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO semo.knowledge_base_history(kb_id, operation, changed_by, kb_snapshot)
      VALUES (OLD.kb_id, 'delete', OLD.created_by, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_history_trigger ON semo.knowledge_base;
CREATE TRIGGER kb_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON semo.knowledge_base
  FOR EACH ROW EXECUTE FUNCTION semo.kb_history_trigger_fn();

COMMENT ON TABLE semo.knowledge_base_history IS
  'P1-5: KB 변경 이력. AFTER INSERT/UPDATE/DELETE 트리거로 자동 기록.';
