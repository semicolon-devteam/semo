-- P2-C (2026-05-28): bot_commitments 변경 NOTIFY trigger
-- Dashboard 의 /api/bots/stream SSE handler 가 LISTEN 'semo_commitment_change' 로 받음.
-- Payload: { id, bot_id, status, runtime_source, source_type }

CREATE OR REPLACE FUNCTION semo.notify_bot_commitment_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  payload := json_build_object(
    'op', TG_OP,
    'id', COALESCE(NEW.id, OLD.id),
    'bot_id', COALESCE(NEW.bot_id, OLD.bot_id),
    'status', COALESCE(NEW.status, OLD.status),
    'runtime_source', COALESCE(NEW.runtime_source, OLD.runtime_source),
    'source_type', COALESCE(NEW.source_type, OLD.source_type)
  );
  PERFORM pg_notify('semo_commitment_change', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_bot_commitments_notify ON semo.bot_commitments;
CREATE TRIGGER trig_bot_commitments_notify
AFTER INSERT OR UPDATE OR DELETE ON semo.bot_commitments
FOR EACH ROW EXECUTE FUNCTION semo.notify_bot_commitment_change();
