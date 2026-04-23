-- Migration 105: semo.knowledge_base 변경 이벤트 NOTIFY 트리거
--
-- Phase 1c KbStore.watch() 구현을 지원한다. 클라이언트는
-- `LISTEN semo_kb_change` 로 구독하고 JSON payload 를 파싱한다.
--
-- payload 스키마: { "type": "upsert" | "delete", "domain": "...", "key": "...",
--                   "subKey": "...", "kbId": 123 }

CREATE OR REPLACE FUNCTION semo.notify_kb_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  row_data RECORD;
  change_type TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := OLD;
    change_type := 'delete';
  ELSE
    row_data := NEW;
    change_type := 'upsert';
  END IF;

  payload := jsonb_build_object(
    'type', change_type,
    'domain', row_data.domain,
    'key', row_data.key,
    'subKey', COALESCE(row_data.sub_key, ''),
    'kbId', row_data.kb_id
  );

  PERFORM pg_notify('semo_kb_change', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_kb_change') THEN
    CREATE TRIGGER trg_notify_kb_change
      AFTER INSERT OR UPDATE OR DELETE ON semo.knowledge_base
      FOR EACH ROW EXECUTE FUNCTION semo.notify_kb_change();
  END IF;
END $$;
